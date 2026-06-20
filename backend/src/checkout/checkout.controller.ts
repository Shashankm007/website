import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from '../orders/orders.service';
import { ShiprocketService } from '../shipping/shiprocket.service';

interface InitiateCheckoutDto {
  orderId: string;
  returnUrl?: string;
}

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly orders: OrdersService, private readonly shiprocket: ShiprocketService) {}

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
    const redirectUrl = await this.shiprocket.createHostedCheckout(input, returnUrl);
    return { redirectUrl };
  }
}
