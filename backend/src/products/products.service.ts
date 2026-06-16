import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FulfillmentType,
  InventoryReason,
  MediaType,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { Paginated, paginate } from '../common/interfaces/api-response.interface';
import { formatMoney } from '../common/utils/money';
import { sanitizePlain, sanitizeRichText } from '../common/utils/sanitize';
import { slugify } from '../common/utils/slugify';
import { CacheService } from '../redis/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddMediaDto } from './dto/add-media.dto';
import { CreateProductDto, ProductMediaInputDto, ProductOptionInputDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const LIST_TTL = 60; // seconds
const DETAIL_TTL = 60; // seconds
const CACHE_PREFIX = 'products';

/** Compact card shape returned by the catalog listing. */
export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  price: string;
  compareAtCents: number | null;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  fulfillment: FulfillmentType;
  inStock: boolean;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // --- Public catalog ------------------------------------------------------

  /**
   * Paginated catalog of ACTIVE products as cards, with search / filter / sort.
   * Result is cached (~60s) keyed by the full query.
   */
  async findAll(query: ProductQueryDto): Promise<Paginated<ProductCard>> {
    const cacheKey = `${CACHE_PREFIX}:list:${JSON.stringify(this.normalizeQuery(query))}`;
    return this.cache.wrap(cacheKey, LIST_TTL, () => this.queryCatalog(query));
  }

  private normalizeQuery(query: ProductQueryDto): Record<string, unknown> {
    return {
      page: query.page,
      limit: query.limit,
      search: query.search ?? null,
      categoryId: query.categoryId ?? null,
      categorySlug: query.categorySlug ?? null,
      tags: query.tags ?? null,
      minPrice: query.minPrice ?? null,
      maxPrice: query.maxPrice ?? null,
      availability: query.availability ?? null,
      sort: query.sort ?? null,
      featured: query.featured ?? null,
    };
  }

  private async queryCatalog(query: ProductQueryDto): Promise<Paginated<ProductCard>> {
    const where = this.buildCatalogWhere(query);
    const orderBy = this.buildOrderBy(query.sort);
    const { page, limit, skip } = query;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          media: { orderBy: { position: 'asc' }, take: 1 },
          inventory: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const cards = rows
      .map((p) => this.toCard(p))
      // availability=in_stock additionally filters out STOCKED items with zero stock,
      // which cannot be expressed cleanly in a single SQL `where` alongside MADE_TO_ORDER.
      .filter((c) => (query.availability === 'in_stock' ? c.inStock : true));

    return paginate(cards, total, page, limit);
  }

  private buildCatalogWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [{ status: ProductStatus.ACTIVE }];

    if (query.search) {
      // Substring match (case-insensitive). For scale, add a Postgres GIN tsvector
      // index via raw migration (to_tsvector(name || description)) and switch to FTS.
      and.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.categoryId) {
      and.push({ categories: { some: { categoryId: query.categoryId } } });
    }
    if (query.categorySlug) {
      and.push({ categories: { some: { category: { slug: query.categorySlug } } } });
    }

    if (query.tags?.length) {
      const tagSlugs = query.tags.map((t) => slugify(t));
      and.push({ tags: { some: { tag: { slug: { in: tagSlugs } } } } });
    }

    if (typeof query.minPrice === 'number' || typeof query.maxPrice === 'number') {
      and.push({
        priceCents: {
          ...(typeof query.minPrice === 'number' ? { gte: query.minPrice } : {}),
          ...(typeof query.maxPrice === 'number' ? { lte: query.maxPrice } : {}),
        },
      });
    }

    if (query.availability === 'made_to_order') {
      and.push({ fulfillment: FulfillmentType.MADE_TO_ORDER });
    } else if (query.availability === 'in_stock') {
      // MADE_TO_ORDER is always available; STOCKED needs quantity > 0 (post-filtered in JS).
      and.push({
        OR: [
          { fulfillment: FulfillmentType.MADE_TO_ORDER },
          { fulfillment: FulfillmentType.STOCKED, inventory: { quantity: { gt: 0 } } },
        ],
      });
    }

    if (typeof query.featured === 'boolean') {
      and.push({ featured: query.featured });
    }

    return { AND: and };
  }

  private buildOrderBy(sort?: ProductQueryDto['sort']): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc':
        return { priceCents: 'asc' };
      case 'price_desc':
        return { priceCents: 'desc' };
      case 'popular':
        return { salesCount: 'desc' };
      case 'rating':
        return { ratingAvg: 'desc' };
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }

  private toCard(
    p: Prisma.ProductGetPayload<{ include: { media: true; inventory: true } }>,
  ): ProductCard {
    const image = p.media.find((m) => m.type === MediaType.IMAGE) ?? p.media[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      priceCents: p.priceCents,
      price: formatMoney(p.priceCents, p.currency),
      compareAtCents: p.compareAtCents,
      imageUrl: image?.url ?? null,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      fulfillment: p.fulfillment,
      inStock: this.computeInStock(p.fulfillment, p.inventory?.quantity ?? 0),
    };
  }

  private computeInStock(fulfillment: FulfillmentType, quantity: number): boolean {
    return fulfillment === FulfillmentType.MADE_TO_ORDER ? true : quantity > 0;
  }

  /**
   * Full product detail for the storefront PDP, plus up to 4 related ACTIVE
   * products sharing a category. Cached (~60s) by slug.
   */
  async findBySlug(slug: string) {
    const cacheKey = `${CACHE_PREFIX}:detail:${slug}`;
    return this.cache.wrap(cacheKey, DETAIL_TTL, () => this.loadDetail(slug));
  }

  private async loadDetail(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: {
        media: { orderBy: { position: 'asc' } },
        options: {
          orderBy: { position: 'asc' },
          include: { values: { orderBy: { position: 'asc' } } },
        },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        inventory: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const categoryIds = product.categories.map((c) => c.categoryId);
    const related = categoryIds.length
      ? await this.prisma.product.findMany({
          where: {
            status: ProductStatus.ACTIVE,
            id: { not: product.id },
            categories: { some: { categoryId: { in: categoryIds } } },
          },
          orderBy: { salesCount: 'desc' },
          take: 4,
          include: { media: { orderBy: { position: 'asc' }, take: 1 }, inventory: true },
        })
      : [];

    return {
      ...product,
      price: formatMoney(product.priceCents, product.currency),
      categories: product.categories.map((c) => c.category),
      tags: product.tags.map((t) => t.tag),
      inStock: this.computeInStock(product.fulfillment, product.inventory?.quantity ?? 0),
      related: related.map((r) => this.toCard(r)),
    };
  }

  /** Fetch a product by id (used internally / by other modules). */
  async findById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /** Full product (any status) with relations — powers the admin edit form. */
  async adminFindById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        media: { orderBy: { position: 'asc' } },
        options: { orderBy: { position: 'asc' }, include: { values: { orderBy: { position: 'asc' } } } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        inventory: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return {
      ...product,
      price: formatMoney(product.priceCents, product.currency),
      categories: product.categories.map((c) => c.category),
      categoryIds: product.categories.map((c) => c.categoryId),
      tags: product.tags.map((t) => t.tag.name),
    };
  }

  // --- Star products (landing-page carousel) -------------------------------

  private readonly STAR_KEY = 'star_products';

  /** Ordered list of curated star-product ids (Setting-backed). */
  async getStarProductIds(): Promise<string[]> {
    const row = await this.prisma.setting.findUnique({ where: { key: this.STAR_KEY } });
    const val = row?.value;
    return Array.isArray(val) ? (val as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  }

  private cardInclude = { media: { orderBy: { position: 'asc' as const }, take: 1 }, inventory: true };

  /** Public landing-page carousel: curated stars (ordered), else featured flag, else newest. */
  async findFeatured(): Promise<ProductCard[]> {
    const ids = await this.getStarProductIds();
    if (ids.length) {
      const rows = await this.prisma.product.findMany({
        where: { id: { in: ids }, status: ProductStatus.ACTIVE },
        include: this.cardInclude,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r));
      if (ordered.length) return ordered.map((r) => this.toCard(r));
    }
    const featured = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, featured: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: this.cardInclude,
    });
    const rows = featured.length
      ? featured
      : await this.prisma.product.findMany({
          where: { status: ProductStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: this.cardInclude,
        });
    return rows.map((r) => this.toCard(r));
  }

  /** Admin view of the curated star list (ordered, any status, with status shown). */
  async getStarProductsAdmin(): Promise<(ProductCard & { status: ProductStatus })[]> {
    const ids = await this.getStarProductIds();
    if (!ids.length) return [];
    const rows = await this.prisma.product.findMany({ where: { id: { in: ids } }, include: this.cardInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is (typeof rows)[number] => Boolean(r))
      .map((r) => ({ ...this.toCard(r), status: r.status }));
  }

  /** Replace the curated star list (ordered) + keep the `featured` flag in sync. */
  async setStarProducts(productIds: string[]): Promise<(ProductCard & { status: ProductStatus })[]> {
    const ordered: string[] = [];
    for (const id of productIds) if (typeof id === 'string' && !ordered.includes(id)) ordered.push(id);
    const existing = await this.prisma.product.findMany({ where: { id: { in: ordered } }, select: { id: true } });
    const valid = new Set(existing.map((e) => e.id));
    const finalIds = ordered.filter((id) => valid.has(id));

    await this.prisma.$transaction([
      this.prisma.setting.upsert({
        where: { key: this.STAR_KEY },
        create: { key: this.STAR_KEY, value: finalIds },
        update: { value: finalIds },
      }),
      this.prisma.product.updateMany({ where: { id: { in: finalIds } }, data: { featured: true } }),
      this.prisma.product.updateMany({
        where: { id: { notIn: finalIds }, featured: true },
        data: { featured: false },
      }),
    ]);
    await this.invalidate();
    return this.getStarProductsAdmin();
  }

  // --- Admin: listing ------------------------------------------------------

  /** Admin catalog including DRAFT and ARCHIVED products. */
  async adminList(query: ProductQueryDto): Promise<Paginated<unknown>> {
    const where = this.buildAdminWhere(query);
    const orderBy = this.buildOrderBy(query.sort);
    const { page, limit, skip } = query;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          media: { orderBy: { position: 'asc' }, take: 1 },
          inventory: true,
          _count: { select: { reviews: true, orderItems: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  private buildAdminWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [];
    if (query.search) {
      and.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.categoryId) and.push({ categories: { some: { categoryId: query.categoryId } } });
    if (typeof query.featured === 'boolean') and.push({ featured: query.featured });
    return and.length ? { AND: and } : {};
  }

  // --- Admin: mutations ----------------------------------------------------

  /** Create a product with media, options, tags, categories and optional initial stock. */
  async create(dto: CreateProductDto) {
    const name = sanitizePlain(dto.name);
    if (!name) throw new BadRequestException('Product name is required');
    const slug = await this.uniqueSlug(name);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          slug,
          description: sanitizeRichText(dto.description),
          shortDescription: dto.shortDescription ? sanitizePlain(dto.shortDescription) : null,
          sku: dto.sku.trim(),
          priceCents: dto.priceCents,
          compareAtCents: dto.compareAtCents ?? null,
          status: dto.status,
          fulfillment: dto.fulfillment,
          customizationType: dto.customizationType ?? undefined,
          featured: dto.featured ?? false,
          weightGrams: dto.weightGrams ?? null,
          categories: dto.categoryIds?.length
            ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
            : undefined,
          tags: await this.tagConnectCreate(tx, dto.tags),
          media: dto.media?.length ? { create: this.mediaCreateInput(dto.media) } : undefined,
          options: dto.options?.length ? { create: this.optionsCreateInput(dto.options) } : undefined,
        },
      });

      // Seed inventory + opening ledger entry for STOCKED products.
      if (dto.fulfillment === FulfillmentType.STOCKED) {
        const quantity = dto.initialStock ?? 0;
        await tx.inventory.create({
          data: {
            productId: created.id,
            quantity,
            lowStockThreshold: dto.lowStockThreshold ?? 5,
          },
        });
        if (quantity > 0) {
          await tx.inventoryLedger.create({
            data: {
              productId: created.id,
              delta: quantity,
              reason: InventoryReason.RESTOCK,
              note: 'Initial stock',
            },
          });
        }
      }

      return created;
    });

    await this.invalidate();
    return this.findById(product.id);
  }

  /** Patch a product. Scalar fields only; media/options/inventory are managed via dedicated endpoints. */
  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) {
      const name = sanitizePlain(dto.name);
      if (!name) throw new BadRequestException('Product name is required');
      data.name = name;
      if (name !== existing.name) data.slug = await this.uniqueSlug(name, id);
    }
    if (dto.description !== undefined) data.description = sanitizeRichText(dto.description);
    if (dto.shortDescription !== undefined)
      data.shortDescription = dto.shortDescription ? sanitizePlain(dto.shortDescription) : null;
    if (dto.sku !== undefined) data.sku = dto.sku.trim();
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.compareAtCents !== undefined) data.compareAtCents = dto.compareAtCents ?? null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.fulfillment !== undefined) data.fulfillment = dto.fulfillment;
    if (dto.customizationType !== undefined) data.customizationType = dto.customizationType;
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.weightGrams !== undefined) data.weightGrams = dto.weightGrams ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data });

      // Replace category assignments when explicitly provided.
      if (dto.categoryIds) {
        await tx.productCategory.deleteMany({ where: { productId: id } });
        if (dto.categoryIds.length) {
          await tx.productCategory.createMany({
            data: dto.categoryIds.map((categoryId) => ({ productId: id, categoryId })),
            skipDuplicates: true,
          });
        }
      }

      // Replace tag assignments when explicitly provided.
      if (dto.tags) {
        await tx.productTag.deleteMany({ where: { productId: id } });
        for (const name of dto.tags) {
          const tag = await this.upsertTag(tx, name);
          if (tag) {
            await tx.productTag.create({ data: { productId: id, tagId: tag.id } });
          }
        }
      }
    });

    await this.invalidate();
    return this.findById(id);
  }

  /** Delete a product (cascades to media/options/inventory/etc. per schema). */
  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');
    await this.prisma.product.delete({ where: { id } });
    await this.invalidate();
    return { id };
  }

  /** Append media items to an existing product. */
  async addMedia(id: string, items: AddMediaDto[]) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');
    const created = await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.productMedia.create({
          data: {
            productId: id,
            type: item.type,
            url: item.url,
            objectKey: item.objectKey ?? null,
            alt: item.alt ? sanitizePlain(item.alt) : null,
            position: item.position ?? 0,
          },
        }),
      ),
    );
    await this.invalidate();
    return created;
  }

  /** Remove a single media row. */
  async removeMedia(mediaId: string) {
    const media = await this.prisma.productMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Media not found');
    await this.prisma.productMedia.delete({ where: { id: mediaId } });
    await this.invalidate();
    return { id: mediaId };
  }

  /**
   * Bulk import from structured rows or a raw CSV string.
   * Returns a per-row result summary; rows are created independently.
   */
  async bulkImport(input: { rows?: CreateProductDto[]; csv?: string }) {
    const rows = input.rows?.length ? input.rows : input.csv ? this.parseCsv(input.csv) : [];
    if (!rows.length) {
      throw new BadRequestException('Provide non-empty `rows` or `csv`');
    }

    const results: Array<{ index: number; ok: boolean; id?: string; error?: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const created = await this.create(rows[i]);
        results.push({ index: i, ok: true, id: created.id });
      } catch (err) {
        results.push({ index: i, ok: false, error: (err as Error).message });
      }
    }

    await this.invalidate();
    const created = results.filter((r) => r.ok).length;
    return { total: rows.length, created, failed: rows.length - created, results };
  }

  /**
   * Increment lifetime sales for a product (called by OrdersService.markPaid).
   * Best-effort: ignores missing products so an order payment never fails on this.
   */
  async incrementSales(productId: string, qty: number): Promise<void> {
    if (qty <= 0) return;
    try {
      await this.prisma.product.update({
        where: { id: productId },
        data: { salesCount: { increment: qty } },
      });
      await this.invalidate();
    } catch (err) {
      this.logger.warn(`incrementSales skipped for ${productId}: ${(err as Error).message}`);
    }
  }

  // --- Helpers -------------------------------------------------------------

  /** Build nested create input for product media. */
  private mediaCreateInput(media: ProductMediaInputDto[]): Prisma.ProductMediaCreateWithoutProductInput[] {
    return media.map((m) => ({
      type: m.type,
      url: m.url,
      objectKey: m.objectKey ?? null,
      alt: m.alt ? sanitizePlain(m.alt) : null,
      position: m.position ?? 0,
    }));
  }

  /** Build nested create input for product options + values. */
  private optionsCreateInput(
    options: ProductOptionInputDto[],
  ): Prisma.ProductOptionCreateWithoutProductInput[] {
    return options.map((opt, optIdx) => ({
      name: sanitizePlain(opt.name),
      position: optIdx,
      values: {
        create: opt.values.map((v, valIdx) => ({
          value: sanitizePlain(v.value),
          priceDeltaCents: v.priceDeltaCents ?? 0,
          hex: v.hex ?? null,
          position: valIdx,
        })),
      },
    }));
  }

  /** Build nested tag connect/create input, upserting tags by slug. */
  private async tagConnectCreate(
    tx: Prisma.TransactionClient,
    names?: string[],
  ): Promise<Prisma.ProductTagCreateNestedManyWithoutProductInput | undefined> {
    if (!names?.length) return undefined;
    const tagIds: string[] = [];
    for (const name of names) {
      const tag = await this.upsertTag(tx, name);
      if (tag) tagIds.push(tag.id);
    }
    if (!tagIds.length) return undefined;
    return { create: tagIds.map((tagId) => ({ tagId })) };
  }

  /** Upsert a Tag by slug, returning it (or null for empty names). */
  private async upsertTag(tx: Prisma.TransactionClient, rawName: string) {
    const name = sanitizePlain(rawName);
    if (!name) return null;
    const slug = slugify(name);
    if (!slug) return null;
    return tx.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }

  /** Generate a unique slug from a name, appending a short suffix on collision. */
  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name) || 'product';
    let candidate = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await this.prisma.product.findUnique({ where: { slug: candidate } });
      if (!clash || clash.id === excludeId) return candidate;
      candidate = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    }
    // Extremely unlikely fallback.
    return `${base}-${Date.now().toString(36)}`;
  }

  /**
   * Minimal CSV parser (RFC-4180-ish: quoted fields, escaped quotes, commas in quotes).
   * Header row is required. Known columns are mapped onto CreateProductDto.
   */
  private parseCsv(csv: string): CreateProductDto[] {
    const records = this.tokenizeCsv(csv);
    if (records.length < 2) throw new BadRequestException('CSV must have a header and at least one row');

    const header = records[0].map((h) => h.trim());
    const rows: CreateProductDto[] = [];

    for (let i = 1; i < records.length; i++) {
      const cells = records[i];
      if (cells.length === 1 && cells[0] === '') continue; // skip blank lines
      const get = (col: string): string | undefined => {
        const idx = header.indexOf(col);
        const val = idx >= 0 ? cells[idx]?.trim() : undefined;
        return val ? val : undefined;
      };

      const name = get('name');
      const sku = get('sku');
      if (!name || !sku) {
        throw new BadRequestException(`CSV row ${i + 1}: 'name' and 'sku' are required`);
      }

      const dto: CreateProductDto = {
        name,
        description: get('description') ?? '',
        shortDescription: get('shortDescription'),
        sku,
        priceCents: this.toInt(get('priceCents'), `row ${i + 1} priceCents`),
        compareAtCents: this.toOptInt(get('compareAtCents')),
        status: this.toEnum(get('status'), ProductStatus, ProductStatus.DRAFT),
        fulfillment: this.toEnum(get('fulfillment'), FulfillmentType, FulfillmentType.STOCKED),
        featured: get('featured') ? get('featured')!.toLowerCase() === 'true' : undefined,
        weightGrams: this.toOptInt(get('weightGrams')),
        categoryIds: this.toList(get('categoryIds')),
        tags: this.toList(get('tags')),
        initialStock: this.toOptInt(get('initialStock')),
        lowStockThreshold: this.toOptInt(get('lowStockThreshold')),
      };
      rows.push(dto);
    }
    return rows;
  }

  /** Split CSV text into an array of records (each an array of cell strings). */
  private tokenizeCsv(csv: string): string[][] {
    const records: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    const text = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        records.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    // flush trailing field/row
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      records.push(row);
    }
    return records;
  }

  private toInt(value: string | undefined, label: string): number {
    const n = Number(value);
    if (value === undefined || !Number.isInteger(n)) {
      throw new BadRequestException(`Invalid integer for ${label}`);
    }
    return n;
  }

  private toOptInt(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const n = Number(value);
    return Number.isInteger(n) ? n : undefined;
  }

  private toList(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const parts = value
      .split(/[|;]/)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }

  private toEnum<T extends Record<string, string>>(
    value: string | undefined,
    enumObj: T,
    fallback: T[keyof T],
  ): T[keyof T] {
    if (!value) return fallback;
    const upper = value.toUpperCase();
    return (Object.values(enumObj) as string[]).includes(upper) ? (upper as T[keyof T]) : fallback;
  }

  /** Bust all product caches after a mutation. */
  private async invalidate(): Promise<void> {
    await this.cache.del(`${CACHE_PREFIX}:*`);
  }
}
