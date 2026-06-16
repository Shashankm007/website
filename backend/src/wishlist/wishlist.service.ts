import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaType, ProductStatus } from '@prisma/client';
import { Paginated, paginate } from '../common/interfaces/api-response.interface';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { formatMoney } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { WishlistItemEntity } from './entities/wishlist-item.entity';

// Product fields needed to render a wishlist card (with its primary image).
const productSummarySelect = {
  id: true,
  name: true,
  slug: true,
  priceCents: true,
  compareAtCents: true,
  currency: true,
  status: true,
  ratingAvg: true,
  ratingCount: true,
  media: {
    where: { type: MediaType.IMAGE },
    orderBy: { position: 'asc' as const },
    take: 1,
    select: { url: true },
  },
} as const;

type WishlistItemWithProduct = {
  id: string;
  productId: string;
  createdAt: Date;
  product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    compareAtCents: number | null;
    currency: string;
    status: ProductStatus;
    ratingAvg: number;
    ratingCount: number;
    media: { url: string }[];
  };
};

/**
 * Manages a customer's wishlist (saved products). Entries are unique per
 * (userId, productId); adds are idempotent and removes are user-scoped.
 */
@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  /** Maps a DB row to the API entity, resolving primary image + formatted price. */
  private toEntity(item: WishlistItemWithProduct): WishlistItemEntity {
    const { product } = item;
    return {
      id: item.id,
      productId: item.productId,
      createdAt: item.createdAt,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        priceCents: product.priceCents,
        compareAtCents: product.compareAtCents,
        price: formatMoney(product.priceCents, product.currency),
        currency: product.currency,
        status: product.status,
        ratingAvg: product.ratingAvg,
        ratingCount: product.ratingCount,
        imageUrl: product.media[0]?.url ?? null,
      },
    };
  }

  /** Lists the user's wishlist, newest first, with product summaries. */
  async list(userId: string, query: PaginationQueryDto): Promise<Paginated<WishlistItemEntity>> {
    const { page, limit, skip } = query;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.wishlistItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          productId: true,
          createdAt: true,
          product: { select: productSummarySelect },
        },
      }),
      this.prisma.wishlistItem.count({ where: { userId } }),
    ]);
    return paginate(items.map((item) => this.toEntity(item)), total, page, limit);
  }

  /** Adds a product to the wishlist; idempotent on the unique (userId, productId). */
  async add(userId: string, productId: string): Promise<WishlistItemEntity> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found');

    // Idempotent: upsert returns the existing row if already wishlisted.
    const item = await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
      select: {
        id: true,
        productId: true,
        createdAt: true,
        product: { select: productSummarySelect },
      },
    });
    return this.toEntity(item);
  }

  /** Removes a product from the user's wishlist (404 if not present). */
  async remove(userId: string, productId: string): Promise<void> {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Wishlist item not found');
    await this.prisma.wishlistItem.delete({ where: { userId_productId: { userId, productId } } });
  }
}
