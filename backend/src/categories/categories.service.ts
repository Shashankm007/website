import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { sanitizePlain, sanitizeRichText } from '../common/utils/sanitize';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/** A category node with its descendants nested under `children`. */
export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

/** A category with its immediate children and ancestor breadcrumb (root → parent). */
export type CategoryDetail = Category & { children: Category[]; breadcrumb: Category[] };

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Public reads --------------------------------------------------------

  /** Full category hierarchy: roots (parentId null) with children nested recursively, ordered by position. */
  async findTree(): Promise<CategoryTreeNode[]> {
    const all = await this.prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    const byParent = new Map<string | null, Category[]>();
    for (const cat of all) {
      const key = cat.parentId;
      const bucket = byParent.get(key);
      if (bucket) bucket.push(cat);
      else byParent.set(key, [cat]);
    }

    const build = (parentId: string | null): CategoryTreeNode[] =>
      (byParent.get(parentId) ?? []).map((cat) => ({ ...cat, children: build(cat.id) }));

    return build(null);
  }

  /** A single category by slug with its immediate children and ancestor breadcrumb. */
  async findBySlug(slug: string): Promise<CategoryDetail> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: { children: { orderBy: [{ position: 'asc' }, { name: 'asc' }] } },
    });
    if (!category) throw new NotFoundException('Category not found');

    const breadcrumb = await this.buildBreadcrumb(category.parentId);
    return { ...category, breadcrumb };
  }

  /** Lookup by id (used by other modules); throws if missing. */
  async findById(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // --- Admin mutations -----------------------------------------------------

  /** Create a category, deriving a unique slug from the name when none is supplied. */
  async create(dto: CreateCategoryDto): Promise<Category> {
    const name = sanitizePlain(dto.name);
    if (!name) throw new BadRequestException('Name is required');

    if (dto.parentId) await this.findById(dto.parentId);

    const slug = await this.resolveSlug(dto.slug ?? name);

    return this.prisma.category.create({
      data: {
        name,
        slug,
        description: dto.description !== undefined ? sanitizeRichText(dto.description) : null,
        imageUrl: dto.imageUrl ?? null,
        parentId: dto.parentId ?? null,
        position: dto.position ?? 0,
      },
    });
  }

  /** Update a category; prevents cycles (a category may not become its own ancestor). */
  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const existing = await this.findById(id);

    const data: Prisma.CategoryUncheckedUpdateInput = {};

    if (dto.name !== undefined) {
      const name = sanitizePlain(dto.name);
      if (!name) throw new BadRequestException('Name cannot be empty');
      data.name = name;
    }

    if (dto.slug !== undefined) {
      data.slug = await this.resolveSlug(dto.slug, id);
    }

    if (dto.description !== undefined) {
      data.description = dto.description === null ? null : sanitizeRichText(dto.description);
    }

    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl ?? null;
    if (dto.position !== undefined) data.position = dto.position;

    if (dto.parentId !== undefined) {
      const parentId = dto.parentId ?? null;
      if (parentId === id) throw new BadRequestException('A category cannot be its own parent');
      if (parentId) {
        await this.findById(parentId);
        await this.assertNotDescendant(id, parentId);
      }
      data.parentId = parentId;
    }

    return this.prisma.category.update({ where: { id: existing.id }, data });
  }

  /** Delete a category. Children are detached automatically (schema `onDelete: SetNull`). */
  async remove(id: string): Promise<Category> {
    await this.findById(id);
    return this.prisma.category.delete({ where: { id } });
  }

  // --- Helpers -------------------------------------------------------------

  /** Walk up the parent chain to produce a root → parent breadcrumb. */
  private async buildBreadcrumb(parentId: string | null): Promise<Category[]> {
    const trail: Category[] = [];
    let cursor = parentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const node = await this.prisma.category.findUnique({ where: { id: cursor } });
      if (!node) break;
      trail.unshift(node);
      cursor = node.parentId;
    }
    return trail;
  }

  /**
   * Ensure `candidateParentId` is not `categoryId` itself or one of its descendants,
   * which would create a cycle in the tree.
   */
  private async assertNotDescendant(categoryId: string, candidateParentId: string): Promise<void> {
    let cursor: string | null = candidateParentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      if (cursor === categoryId) {
        throw new BadRequestException('A category cannot be moved under one of its own descendants');
      }
      seen.add(cursor);
      const node: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
    }
  }

  /**
   * Normalize the desired slug and guarantee uniqueness, appending a numeric suffix
   * when a collision exists. `excludeId` lets a category keep its own slug on update.
   */
  private async resolveSlug(desired: string, excludeId?: string): Promise<string> {
    const base = slugify(desired);
    if (!base) throw new BadRequestException('Could not derive a valid slug');

    let candidate = base;
    let attempt = 1;
    // Bounded loop: collisions resolve quickly with an incrementing suffix.
    while (true) {
      const clash = await this.prisma.category.findUnique({ where: { slug: candidate } });
      if (!clash || clash.id === excludeId) return candidate;
      candidate = `${base}-${attempt++}`;
    }
  }
}
