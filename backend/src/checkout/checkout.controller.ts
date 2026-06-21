import { Body, Controller, Post, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from '../orders/orders.service';
import { ShiprocketService } from '../shipping/shiprocket.service';
import { PaymentsService } from '../payments/payments.service';
import { ShippingService } from '../shipping/shipping.service';
import { VerifyPaymentDto } from '../payments/dto/payments.dto';

interface InitiateCheckoutDto {
  orderId: string;
  returnUrl?: string;
}

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);
  constructor(
    private readonly orders: OrdersService,
    private readonly shiprocket: ShiprocketService,
    private readonly payments: PaymentsService,
    private readonly shipping: ShippingService,
  ) {}

  /** Create/prepare a hosted Shiprocket checkout and return a redirect URL. */
  @Post('initiate')
  async initiate(@CurrentUser('id') userId: string, @Body() dto: InitiateCheckoutDto) {
    // Ensure order exists and belongs to user (orders.getForUser will throw if not).
    const order = await this.orders.getForUser(userId, dto.orderId);

    // Build Shiprocket input from order snapshot
    const snap = (order.shippingSnapshot as Record<string, any> | null) ?? {};
    const input = {
      orderNumber: order.orderNumber,
      orderDateISO: order.createdAt.toISOString(),
      billing: {
        name: snap.fullName ?? order.email,
        address: snap.line1 ?? '',
        address2: snap.line2 ?? '',
        city: snap.city ?? '',
        state: snap.state ?? '',
        pincode: snap.postalCode ?? '',
        country: snap.country ?? 'India',
        email: order.email,
        phone: snap.phone ?? '',
      },
      items: (order.items ?? []).map((i) => ({ name: i.nameSnapshot, sku: i.skuSnapshot, units: i.quantity, sellingPriceRupees: Math.round(i.unitPriceCents / 100) })),
      subTotalRupees: Math.round(order.subtotalCents / 100),
      weightKg: 0.5,
      paymentMethod: 'Prepaid' as const,
    };

    const returnUrl = dto.returnUrl ?? `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/checkout/success?order=${encodeURIComponent(order.orderNumber)}`;
    // We do not use Shiprocket-hosted checkout. Create a Razorpay order and
    // return its details to the client so the frontend can open Razorpay Checkout.
    const rzp = await this.payments.createOrder(userId, order.id);
    return { razorpay: rzp };
  }

  /** After client-side Razorpay checkout completes, verify and create Shiprocket order. */
  @Post('confirm')
  async confirm(@CurrentUser('id') userId: string, @Body() dto: VerifyPaymentDto) {
    // Log incoming payload for debugging (temporary)
    this.logger.debug(`checkout.confirm called by user=${userId} order=${dto.orderId} payment=${(dto as any).razorpayPaymentId ?? 'N/A'}`);
    // Verify payment signature and mark paid (PaymentsService will call OrdersService.markPaid)
    const verified = await this.payments.verifyCheckout(userId, dto as any);
    // After successful payment, trigger Shiprocket fulfilment in background so
    // the client doesn't wait on external API latency. Log failures for retry.
    this.shipping
      .fulfil(dto.orderId, { id: userId, email: '', role: 'USER' as any })
      .then(() => this.logger.log(`Triggered fulfilment for order ${dto.orderId}`))
      .catch((e) => this.logger.warn(`Fulfilment failed for order ${dto.orderId}: ${(e as Error).message}`));

    // Respond immediately: payment verification is authoritative for the SPA UX.
    return verified;
  }
}
