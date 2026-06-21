import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FulfillmentType, InventoryReason, OrderStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Paginated, paginate } from '../common/interfaces/api-response.interface';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { sanitizePlain } from '../common/utils/sanitize';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { generateInvoicePdf } from './invoice/invoice.generator';

/** Flat shipping fee and free-shipping threshold (paise, INR): ₹79 flat, free over ₹999. */
const SHIPPING_FLAT_CENTS = 7900;
const FREE_SHIPPING_THRESHOLD_CENTS = 99900;
/** GST rate applied to (subtotal - discount). 18% is the standard GST slab. */
const TAX_RATE = 0.18;
const ORDER_COUNTER_KEY = 'order_counter';

/** Items already paid for never need re-processing (idempotency boundary). */
const PAID_OR_BEYOND: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PRINTING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.REFUNDED,
];

/** The slice of CartService.getCheckoutCart that OrdersService relies on. */
interface CheckoutCartItem {
  product: { id: string; name: string; sku: string; imageUrl?: string | null };
  variantId?: string | null;
  quantity: number;
  unitPriceCents: number;
  optionsJson?: Prisma.JsonValue | null;
  customText?: string | null;
  modelLink?: string | null;
  customUploadUrl?: string | null;
}

/** Frozen address snapshot stored on the order. */
interface ShippingSnapshot {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

/**
 * Order lifecycle: checkout from cart, payment reconciliation, cancellation,
 * admin fulfilment, and invoice generation. All money is integer cents.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly coupons: CouponsService,
    private readonly inventory: InventoryService,
    private readonly mail: MailService,
  ) {}

  // --- Checkout ------------------------------------------------------------

  /**
   * Build a PENDING order from the user's cart in a single transaction:
   * price it, reserve stock, snapshot the address, and seed payment/events.
   */
  async createFromCart(userId: string, dto: CreateOrderDto) {
    const cart = await this.cart.getCheckoutCart(userId);
    const cartItems = cart.items as CheckoutCartItem[];
    if (!cartItems.length) {
      throw new BadRequestException('Cart is empty');
    }

    const reservableItems = cartItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));
    await this.inventory.assertAvailable(reservableItems);

    const snapshot = await this.resolveShippingSnapshot(userId, dto);
    const email = (dto.email ?? (await this.resolveUserEmail(userId))).toLowerCase().trim();

    const subtotalCents = cartItems.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );

    let couponId: string | null = null;
    let discountCents = 0;
    if (dto.couponCode) {
      const priced = await this.coupons.validateAndPrice(dto.couponCode, subtotalCents, userId);
      couponId = priced.coupon.id;
      discountCents = priced.discountCents;
    }

    const taxableCents = Math.max(0, subtotalCents - discountCents);
    const shippingCents = taxableCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS;
    const taxCents = Math.round(taxableCents * TAX_RATE);
    const totalCents = taxableCents + shippingCents + taxCents;

    return this.prisma.$transaction(async (tx) => {
      if (couponId) {
        await this.coupons.redeem(couponId);
      }

      const orderNumber = await this.nextOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          email,
          status: OrderStatus.PENDING,
          subtotalCents,
          discountCents,
          shippingCents,
          taxCents,
          totalCents,
          couponId,
          shippingAddressId: dto.shippingAddressId ?? null,
          billingAddressId: dto.billingAddressId ?? null,
          shippingSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          notes: dto.notes ? sanitizePlain(dto.notes) : null,
          placedAt: new Date(),
          items: {
            create: cartItems.map((item) => ({
              productId: item.product.id,
              variantId: item.variantId ?? null,
              nameSnapshot: item.product.name,
              skuSnapshot: item.product.sku,
              imageSnapshot: item.product.imageUrl ?? null,
              optionsJson: (item.optionsJson ?? undefined) as Prisma.InputJsonValue | undefined,
              customText: item.customText ?? null,
              customUploadUrl: item.customUploadUrl ?? null,
              modelLink: item.modelLink ?? null,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              totalCents: item.unitPriceCents * item.quantity,
            })),
          },
          payment: {
            create: {
              status: PaymentStatus.REQUIRES_PAYMENT,
              amountCents: totalCents,
            },
          },
          events: {
            create: {
              status: OrderStatus.PENDING,
              message: 'Order created',
              createdBy: userId,
            },
          },
        },
        include: { items: true, payment: true },
      });

      // If the user provided an inline shipping address (not a saved address),
      // persist it into the user's address book so they can reuse it later.
      if (dto.shippingAddress && !dto.shippingAddressId && userId) {
        // Avoid creating obvious duplicates (match fullName + line1 + postalCode).
        const dup = await tx.address.findFirst({
          where: {
            userId,
            fullName: snapshot.fullName,
            line1: snapshot.line1,
            postalCode: snapshot.postalCode,
          },
        });
        if (!dup) {
          const existingCount = await tx.address.count({ where: { userId } });
          await tx.address.create({
            data: {
              userId,
              fullName: snapshot.fullName,
              line1: snapshot.line1,
              line2: snapshot.line2 ?? undefined,
              city: snapshot.city,
              state: snapshot.state ?? undefined,
              postalCode: snapshot.postalCode,
              country: snapshot.country ?? undefined,
              phone: snapshot.phone ?? undefined,
              isDefault: existingCount === 0,
            },
          });
        }
      }

      // Hold stock for STOCKED products (quantity is decremented only on payment).
      await this.adjustReservation(tx, reservableItems, +1);

      return order;
    });
  }

  // --- Customer reads ------------------------------------------------------

  async listForUser(userId: string, query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const { page, limit, skip } = query;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        include: { items: true, payment: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return paginate(items, total, page, limit);
  }

  async getForUser(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payment: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  // --- Cancellation --------------------------------------------------------

  /** Customer cancellation — only while still PENDING; releases the stock reservation. */
  async cancel(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.adjustReservation(tx, this.toInventoryItems(order.items), -1);
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          events: {
            create: {
              status: OrderStatus.CANCELLED,
              message: 'Cancelled by customer',
              createdBy: userId,
            },
          },
        },
        include: { items: true, payment: true },
      });
      return updated;
    });
  }

  // --- Payment reconciliation (called by PaymentsService) ------------------

  /**
   * Mark an order PAID and finalise stock/sales/cart/email. Idempotent: a no-op
   * if the order is already PAID or beyond.
   */
  async markPaid(
    orderId: string,
    payload: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature?: string;
      amountCents: number;
    },
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('Order not found');
    }
    if (PAID_OR_BEYOND.includes(existing.status)) {
      return existing; // already settled — idempotent no-op
    }

    const paidOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          payment: {
            update: {
              status: PaymentStatus.SUCCEEDED,
              razorpayOrderId: payload.razorpayOrderId,
              razorpayPaymentId: payload.razorpayPaymentId,
              razorpaySignature: payload.razorpaySignature ?? null,
              failureReason: null,
            },
          },
          events: {
            create: {
              status: OrderStatus.PAID,
              message: 'Payment captured',
              createdBy: 'system',
            },
          },
        },
        include: { items: true, payment: true },
      });

      // Decrement stock (skips MADE_TO_ORDER) then release the matching hold.
      const inventoryItems = this.toInventoryItems(order.items);
      await this.inventory.commitForOrder(inventoryItems, order.id, tx);
      await this.adjustReservation(tx, inventoryItems, -1);

      // Bump denormalized salesCount per purchased product (direct write — no ProductsModule dep).
      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { salesCount: { increment: item.quantity } },
        });
      }

      return order;
    });

    if (existing.userId) {
      await this.cart.clearForUser(existing.userId);
    }
    await this.mail.sendOrderConfirmation(paidOrder.email, {
      orderNumber: paidOrder.orderNumber,
      totalCents: paidOrder.totalCents,
    });
    this.logger.log(`Order ${paidOrder.orderNumber} marked paid (${payload.amountCents} cents)`);

    return paidOrder;
  }

  /** Record a failed payment attempt; the order stays PENDING so it can be retried. */
  async markPaymentFailed(orderId: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (PAID_OR_BEYOND.includes(order.status)) {
      return order; // ignore late failures for an already-settled order
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        payment: {
          update: {
            status: PaymentStatus.FAILED,
            failureReason: sanitizePlain(reason).slice(0, 500) || 'Payment failed',
          },
        },
        events: {
          create: {
            status: OrderStatus.PENDING,
            message: `Payment failed: ${sanitizePlain(reason).slice(0, 200)}`,
            createdBy: 'system',
          },
        },
      },
      include: { items: true, payment: true },
    });
  }

  // --- Admin ---------------------------------------------------------------

  async adminList(query: OrderQueryDto): Promise<Paginated<unknown>> {
    const { page, limit, skip, status, search } = query;
    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (search) {
      const term = search.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true, payment: true, user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async adminGetById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payment: true,
        events: { orderBy: { createdAt: 'asc' } },
        user: { select: { id: true, email: true, name: true } },
        coupon: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /**
   * Admin status transition: stamps the relevant timestamp, records tracking,
   * appends an event, emails the customer, and restocks on CANCELLED/REFUNDED.
   */
  async updateStatus(id: string, dto: UpdateOrderStatusDto, actor: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const data: Prisma.OrderUpdateInput = { status: dto.status };
    if (dto.trackingNumber !== undefined) data.trackingNumber = sanitizePlain(dto.trackingNumber);
    if (dto.carrier !== undefined) data.carrier = sanitizePlain(dto.carrier);

    const now = new Date();
    if (dto.status === OrderStatus.PAID && !order.paidAt) data.paidAt = now;
    if (dto.status === OrderStatus.SHIPPED) data.shippedAt = now;
    if (dto.status === OrderStatus.DELIVERED) data.deliveredAt = now;
    if (dto.status === OrderStatus.CANCELLED && !order.cancelledAt) data.cancelledAt = now;

    const restocks = dto.status === OrderStatus.CANCELLED || dto.status === OrderStatus.REFUNDED;
    const restockReason =
      dto.status === OrderStatus.REFUNDED ? InventoryReason.RETURN : InventoryReason.CANCELLATION;
    const inventoryItems = this.toInventoryItems(order.items);
    const wasCommitted = PAID_OR_BEYOND.includes(order.status) && order.status !== OrderStatus.REFUNDED;

    // Committed stock (order was PAID+) must be incremented back via the ledger.
    if (restocks && wasCommitted) {
      await this.inventory.restockForOrder(inventoryItems, order.id, restockReason);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (restocks && order.status === OrderStatus.PENDING) {
        // Still reserved (never paid) — release the hold instead of restocking.
        await this.adjustReservation(tx, inventoryItems, -1);
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          ...data,
          events: {
            create: {
              status: dto.status,
              message: dto.note ? sanitizePlain(dto.note) : `Status set to ${dto.status}`,
              createdBy: actor.id,
            },
          },
        },
        include: { items: true, payment: true, events: { orderBy: { createdAt: 'asc' } } },
      });
    });

    await this.mail.sendOrderStatusUpdate(updated.email, {
      orderNumber: updated.orderNumber,
      status: updated.status,
    });

    return updated;
  }

  // --- Invoice -------------------------------------------------------------

  /** Render a PDF invoice. The requester must own the order or be an admin. */
  async generateInvoicePdf(orderId: string, requester: AuthUser): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== requester.id && requester.role !== Role.ADMIN) {
      throw new ForbiddenException('Not allowed to access this invoice');
    }
    return generateInvoicePdf(order);
  }

  // --- Helpers -------------------------------------------------------------

  /**
   * Adjust `Inventory.reserved` for STOCKED products only (held by unpaid orders;
   * quantity is untouched). `sign` is +1 to hold and -1 to release. MADE_TO_ORDER
   * products carry no stock so they are skipped.
   */
  private async adjustReservation(
    tx: Prisma.TransactionClient,
    items: { productId: string; quantity: number }[],
    sign: 1 | -1,
  ): Promise<void> {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { fulfillment: true },
      });
      if (!product || product.fulfillment !== FulfillmentType.STOCKED) continue;
      await tx.inventory.updateMany({
        where: { productId: item.productId },
        data: { reserved: { increment: sign * item.quantity } },
      });
    }
  }

  /** Map order items to the {productId, quantity} shape Inventory expects. */
  private toInventoryItems(items: { productId: string | null; quantity: number }[]) {
    return items
      .filter((i): i is { productId: string; quantity: number } => Boolean(i.productId))
      .map((i) => ({ productId: i.productId, quantity: i.quantity }));
  }

  private async resolveUserEmail(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.email;
  }

  /**
   * Resolve the shipping snapshot from a saved Address (ownership-validated via
   * Prisma directly to avoid a UsersModule dependency) or an inline address.
   */
  private async resolveShippingSnapshot(userId: string, dto: CreateOrderDto): Promise<ShippingSnapshot> {
    if (dto.shippingAddressId) {
      const address = await this.prisma.address.findFirst({
        where: { id: dto.shippingAddressId, userId },
      });
      if (!address) {
        throw new BadRequestException('Shipping address not found');
      }
      return {
        fullName: address.fullName,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        phone: address.phone,
      };
    }

    if (dto.shippingAddress) {
      const a = dto.shippingAddress;
      return {
        fullName: sanitizePlain(a.fullName),
        line1: sanitizePlain(a.line1),
        line2: a.line2 ? sanitizePlain(a.line2) : null,
        city: sanitizePlain(a.city),
        state: a.state ? sanitizePlain(a.state) : null,
        postalCode: sanitizePlain(a.postalCode),
        country: a.country ? sanitizePlain(a.country) : 'US',
        phone: a.phone ? sanitizePlain(a.phone) : null,
      };
    }

    throw new BadRequestException('A shipping address is required');
  }

  /**
   * Allocate the next order number (`HTC-<year>-<counter padded to 4>`) from a
   * Setting counter row, incremented within the surrounding transaction.
   */
  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const existing = await tx.setting.findUnique({ where: { key: ORDER_COUNTER_KEY } });
    const current = typeof existing?.value === 'number' ? (existing.value as number) : 0;
    const next = current + 1;
    await tx.setting.upsert({
      where: { key: ORDER_COUNTER_KEY },
      create: { key: ORDER_COUNTER_KEY, value: next },
      update: { value: next },
    });
    const year = new Date().getFullYear();
    return `HTC-${year}-${String(next).padStart(4, '0')}`;
  }
}
