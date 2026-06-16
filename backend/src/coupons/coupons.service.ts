import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { paginate, Paginated } from '../common/interfaces/api-response.interface';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { sanitizePlain } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

/** Result of a successful coupon validation. */
export interface CouponPricing {
  coupon: Coupon;
  discountCents: number;
}

/**
 * Owns coupon validation/pricing (consumed by OrdersService) and admin CRUD.
 * Codes are normalized to uppercase on write and lookup.
 */
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  /** Compute the discount for a coupon against a subtotal (both in cents). */
  private computeDiscount(coupon: Coupon, subtotalCents: number): number {
    if (coupon.type === DiscountType.PERCENTAGE) {
      return Math.floor((subtotalCents * coupon.value) / 100);
    }
    return Math.min(coupon.value, subtotalCents);
  }

  /**
   * Validate a coupon and compute its discount. Throws BadRequest on any failure
   * (unknown/inactive code, outside window, subtotal too low, redemptions exhausted,
   * or per-user limit reached). `userId` is used only for the per-user limit check.
   */
  async validateAndPrice(code: string, subtotalCents: number, userId?: string): Promise<CouponPricing> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: this.normalizeCode(code) } });
    if (!coupon || !coupon.active) {
      throw new BadRequestException('Invalid coupon code');
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('This coupon is not active yet');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('This coupon has expired');
    }
    if (subtotalCents < coupon.minSubtotalCents) {
      throw new BadRequestException('Order subtotal does not meet the minimum for this coupon');
    }
    if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions) {
      throw new BadRequestException('This coupon has reached its redemption limit');
    }
    if (coupon.perUserLimit != null && userId) {
      const used = await this.prisma.order.count({ where: { couponId: coupon.id, userId } });
      if (used >= coupon.perUserLimit) {
        throw new BadRequestException('You have already used this coupon the maximum number of times');
      }
    }

    return { coupon, discountCents: this.computeDiscount(coupon, subtotalCents) };
  }

  /**
   * Increment a coupon's redemption counter. Designed to run inside the order
   * transaction — pass the transaction client as `tx` so it commits atomically.
   */
  async redeem(couponId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.coupon.update({
      where: { id: couponId },
      data: { redemptions: { increment: 1 } },
    });
  }

  // --- Admin CRUD ----------------------------------------------------------

  /** Paginated list of all coupons (admin), newest first. */
  async list(query: PaginationQueryDto): Promise<Paginated<Coupon>> {
    const { page, limit, skip } = query;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.coupon.count(),
    ]);
    return paginate(items, total, page, limit);
  }

  /** Create a coupon (admin). */
  async create(dto: CreateCouponDto): Promise<Coupon> {
    return this.prisma.coupon.create({
      data: {
        code: this.normalizeCode(dto.code),
        description: dto.description ? sanitizePlain(dto.description) : undefined,
        type: dto.type,
        value: dto.value,
        minSubtotalCents: dto.minSubtotalCents ?? 0,
        maxRedemptions: dto.maxRedemptions ?? null,
        perUserLimit: dto.perUserLimit ?? null,
        startsAt: dto.startsAt ?? null,
        expiresAt: dto.expiresAt ?? null,
        active: dto.active ?? true,
      },
    });
  }

  /** Update a coupon (admin). */
  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    await this.findByIdOrThrow(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        code: dto.code !== undefined ? this.normalizeCode(dto.code) : undefined,
        description: dto.description !== undefined ? sanitizePlain(dto.description) : undefined,
        type: dto.type,
        value: dto.value,
        minSubtotalCents: dto.minSubtotalCents,
        maxRedemptions: dto.maxRedemptions,
        perUserLimit: dto.perUserLimit,
        startsAt: dto.startsAt,
        expiresAt: dto.expiresAt,
        active: dto.active,
      },
    });
  }

  /** Delete a coupon (admin). */
  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.coupon.delete({ where: { id } });
  }

  private async findByIdOrThrow(id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }
}
