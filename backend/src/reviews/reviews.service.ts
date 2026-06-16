import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Review, Role } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Paginated, paginate } from '../common/interfaces/api-response.interface';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { sanitizePlain, sanitizeRichText } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

/** Public-facing review shape (joins author display name, hides nothing sensitive). */
type ReviewView = Pick<
  Review,
  'id' | 'productId' | 'userId' | 'rating' | 'title' | 'body' | 'verified' | 'approved' | 'createdAt' | 'updatedAt'
> & { authorName: string | null };

const REVIEW_AUTHOR_SELECT = {
  user: { select: { name: true } },
} satisfies Prisma.ReviewInclude;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Map a Review (+author) row to the public view shape. */
  private toView(review: Review & { user?: { name: string | null } | null }): ReviewView {
    return {
      id: review.id,
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      verified: review.verified,
      approved: review.approved,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      authorName: review.user?.name ?? null,
    };
  }

  // --- Public ---------------------------------------------------------------

  /** Approved reviews for a product, newest first. */
  async listForProduct(productId: string, query: PaginationQueryDto): Promise<Paginated<ReviewView>> {
    const where: Prisma.ReviewWhereInput = { productId, approved: true };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: REVIEW_AUTHOR_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    const items = rows.map((row) => this.toView(row));
    return paginate(items, total, query.page, query.limit);
  }

  // --- Authenticated --------------------------------------------------------

  /**
   * Create a review — **only verified buyers** (a DELIVERED order containing the
   * product) may review, and only once. Recomputes the product aggregate.
   */
  async create(userId: string, dto: CreateReviewDto): Promise<ReviewView> {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.review.findUnique({
      where: { productId_userId: { productId: dto.productId, userId } },
    });
    if (existing) throw new ConflictException('You have already reviewed this product');

    // Gate reviews on a verified purchase.
    const hasPurchased = await this.hasDeliveredPurchase(userId, dto.productId);
    if (!hasPurchased) {
      throw new ForbiddenException(
        'Only verified buyers can review this product. You can leave a review once your order has been delivered.',
      );
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          productId: dto.productId,
          userId,
          rating: dto.rating,
          title: dto.title ? sanitizePlain(dto.title) : undefined,
          body: dto.body ? sanitizeRichText(dto.body) : undefined,
          verified: true, // enforced above
        },
        include: REVIEW_AUTHOR_SELECT,
      });
      await this.recomputeAggregate(dto.productId, tx);
      return created;
    });

    return this.toView(review);
  }

  /** Whether the current user may review a product (verified buyer, not yet reviewed). */
  async getEligibility(
    userId: string,
    productId: string,
  ): Promise<{ canReview: boolean; hasPurchased: boolean; alreadyReviewed: boolean }> {
    const [hasPurchased, existing] = await Promise.all([
      this.hasDeliveredPurchase(userId, productId),
      this.prisma.review.findUnique({
        where: { productId_userId: { productId, userId } },
        select: { id: true },
      }),
    ]);
    const alreadyReviewed = Boolean(existing);
    return { canReview: hasPurchased && !alreadyReviewed, hasPurchased, alreadyReviewed };
  }

  /** Update an owned review, then recompute the product aggregate. */
  async update(userId: string, id: string, dto: UpdateReviewDto): Promise<ReviewView> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('You can only edit your own review');

    const data: Prisma.ReviewUpdateInput = {};
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.title !== undefined) data.title = dto.title ? sanitizePlain(dto.title) : null;
    if (dto.body !== undefined) data.body = dto.body ? sanitizeRichText(dto.body) : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.review.update({
        where: { id },
        data,
        include: REVIEW_AUTHOR_SELECT,
      });
      await this.recomputeAggregate(review.productId, tx);
      return next;
    });

    return this.toView(updated);
  }

  /** Remove a review (owner or ADMIN), then recompute the product aggregate. */
  async remove(user: AuthUser, id: string): Promise<{ id: string }> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own review');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await this.recomputeAggregate(review.productId, tx);
    });

    return { id };
  }

  // --- Admin moderation -----------------------------------------------------

  /** Set a review's approval flag, then recompute the product aggregate. */
  async setApproval(id: string, approved: boolean): Promise<ReviewView> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.review.update({
        where: { id },
        data: { approved },
        include: REVIEW_AUTHOR_SELECT,
      });
      await this.recomputeAggregate(review.productId, tx);
      return next;
    });

    return this.toView(updated);
  }

  // --- Helpers --------------------------------------------------------------

  /** True if the user has a DELIVERED order containing the given product. */
  private async hasDeliveredPurchase(userId: string, productId: string): Promise<boolean> {
    const count = await this.prisma.orderItem.count({
      where: {
        productId,
        order: { userId, status: OrderStatus.DELIVERED },
      },
    });
    return count > 0;
  }

  /**
   * Recompute and persist `ratingAvg` (avg of approved ratings, 1 decimal) and
   * `ratingCount` onto the Product row. Runs inside the caller's transaction.
   */
  private async recomputeAggregate(productId: string, tx: Prisma.TransactionClient): Promise<void> {
    const agg = await tx.review.aggregate({
      where: { productId, approved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const ratingCount = agg._count._all;
    const ratingAvg = ratingCount > 0 ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : 0;
    await tx.product.update({ where: { id: productId }, data: { ratingAvg, ratingCount } });
  }
}
