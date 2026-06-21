import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { AppConfig } from '../config/configuration';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { VerifyPaymentDto } from './dto/payments.dto';

/** Returned to the SPA so it can open Razorpay Checkout. */
export interface CreateOrderResult {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // paise
  currency: string;
  orderNumber: string;
}

/**
 * Bridges the storefront and Razorpay: creates Razorpay orders for pending app
 * orders, verifies the client checkout signature, and reconciles webhook events.
 * Amounts are integer paise throughout (Razorpay's smallest INR unit).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    config: ConfigService,
  ) {
    const cfg = config.get<AppConfig['razorpay']>('razorpay')!;
    this.keyId = cfg.keyId;
    this.keySecret = cfg.keySecret;
    this.webhookSecret = cfg.webhookSecret;
    // Placeholder creds keep boot from failing when Razorpay isn't configured yet;
    // live calls only succeed with real keys.
    this.razorpay = new Razorpay({
      key_id: this.keyId || 'rzp_test_unconfigured',
      key_secret: this.keySecret || 'unconfigured',
    });
  }

  // --- Checkout ------------------------------------------------------------

  /** Verifies the order is the user's and PENDING, then creates/reuses a Razorpay order. */
  async createOrder(userId: string, orderId: string): Promise<CreateOrderResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('You do not own this order');
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('Order is not awaiting payment');
    if (!this.keyId || !this.keySecret) {
      throw new BadRequestException('Online payments are not configured yet. Please try again later.');
    }

    let razorpayOrderId = order.payment?.razorpayOrderId ?? null;
    if (!razorpayOrderId) {
      const rzpOrder = await this.razorpay.orders.create({
        amount: order.totalCents, // paise
        currency: order.currency, // INR
        receipt: order.orderNumber,
        notes: { orderId: order.id, orderNumber: order.orderNumber },
      });
      razorpayOrderId = rzpOrder.id;
    }

    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        provider: PaymentProvider.RAZORPAY,
        status: PaymentStatus.PROCESSING,
        amountCents: order.totalCents,
        currency: order.currency,
        razorpayOrderId,
      },
      update: {
        status: PaymentStatus.PROCESSING,
        amountCents: order.totalCents,
        currency: order.currency,
        razorpayOrderId,
      },
    });

    return {
      keyId: this.keyId,
      razorpayOrderId,
      amount: order.totalCents,
      currency: order.currency,
      orderNumber: order.orderNumber,
    };
  }

  /**
   * Verifies the checkout handler signature (HMAC of `order_id|payment_id` with the
   * key secret) and settles the order. The webhook remains the authoritative path.
   */
  async verifyCheckout(userId: string, dto: VerifyPaymentDto) {
    this.logger.debug(`verifyCheckout invoked user=${userId} order=${dto.orderId} payment=${dto.razorpayPaymentId ?? 'N/A'}`);
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('You do not own this order');

    const expected = createHmac('sha256', this.keySecret)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    if (!this.safeEqual(expected, dto.razorpaySignature)) {
      await this.orders.markPaymentFailed(order.id, 'Razorpay signature verification failed').catch(() => undefined);
      throw new BadRequestException('Payment signature verification failed');
    }

    await this.orders.markPaid(order.id, {
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
      amountCents: order.totalCents,
    });

    return { success: true, orderId: order.id, orderNumber: order.orderNumber };
  }

  // --- Webhooks (authoritative) -------------------------------------------

  /** Verifies the webhook HMAC against the raw body, then reconciles the event. */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    if (!this.safeEqual(expected, signature)) {
      throw new BadRequestException('Webhook signature verification failed');
    }

    let event: any;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const type: string = event?.event;
    try {
      switch (type) {
        case 'payment.captured':
          await this.onPaymentCaptured(event.payload?.payment?.entity);
          break;
        case 'payment.failed':
          await this.onPaymentFailedEvent(event.payload?.payment?.entity);
          break;
        case 'refund.created':
        case 'refund.processed':
          await this.onRefund(event.payload?.refund?.entity);
          break;
        default:
          this.logger.debug(`Unhandled Razorpay event: ${type}`);
      }
    } catch (err) {
      this.logger.error(`Error handling Razorpay event ${type}: ${(err as Error).message}`);
    }

    return { received: true };
  }

  private async onPaymentCaptured(payment: any): Promise<void> {
    const orderId = payment?.notes?.orderId ?? (await this.orderIdFromRazorpayOrder(payment?.order_id));
    if (!orderId) {
      this.logger.warn(`payment.captured ${payment?.id} missing orderId`);
      return;
    }
    await this.orders.markPaid(orderId, {
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      amountCents: payment.amount,
    });
  }

  private async onPaymentFailedEvent(payment: any): Promise<void> {
    const orderId = payment?.notes?.orderId ?? (await this.orderIdFromRazorpayOrder(payment?.order_id));
    if (!orderId) return;
    await this.orders.markPaymentFailed(orderId, payment?.error_description ?? 'Payment failed');
  }

  /** Reflects a refund onto the order + payment. Idempotent on re-delivery. */
  private async onRefund(refund: any): Promise<void> {
    const razorpayOrderId = refund?.order_id;
    if (!razorpayOrderId) return;
    const pay = await this.prisma.payment.findUnique({ where: { razorpayOrderId } });
    if (!pay) {
      this.logger.warn(`refund for ${razorpayOrderId} has no matching payment`);
      return;
    }
    const refundedCents = refund?.amount ?? pay.amountCents;
    if (pay.status === PaymentStatus.REFUNDED && pay.refundedCents >= refundedCents) return;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: pay.id },
        data: { status: PaymentStatus.REFUNDED, refundedCents },
      }),
      this.prisma.order.update({ where: { id: pay.orderId }, data: { status: OrderStatus.REFUNDED } }),
      this.prisma.orderEvent.create({
        data: {
          orderId: pay.orderId,
          status: OrderStatus.REFUNDED,
          message: `Refunded ${refundedCents} paise`,
          createdBy: 'system',
        },
      }),
    ]);
  }

  private async orderIdFromRazorpayOrder(razorpayOrderId?: string): Promise<string | null> {
    if (!razorpayOrderId) return null;
    const pay = await this.prisma.payment.findUnique({ where: { razorpayOrderId } });
    return pay?.orderId ?? null;
  }

  /** Constant-time string comparison for signatures. */
  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}
