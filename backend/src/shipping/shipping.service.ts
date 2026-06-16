import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Role } from '@prisma/client';
import { AppConfig } from '../config/configuration';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShiprocketService } from './shiprocket.service';

const SYSTEM_ACTOR: AuthUser = { id: 'system', email: 'shiprocket@system', role: Role.ADMIN };

/** Maps a Shiprocket status string onto our OrderStatus (null = leave unchanged). */
function mapShiprocketStatus(raw?: string): OrderStatus | null {
  const s = (raw ?? '').toLowerCase();
  if (!s) return null;
  if (s.includes('rto')) return null; // return-to-origin: admin handles manually
  if (s.includes('cancel')) return OrderStatus.CANCELLED;
  if (s.includes('delivered')) return OrderStatus.DELIVERED;
  if (s.includes('in transit') || s.includes('shipped') || s.includes('out for delivery') || s.includes('picked up') || s.includes('pickup')) {
    return OrderStatus.SHIPPED;
  }
  return null;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly webhookToken?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shiprocket: ShiprocketService,
    private readonly orders: OrdersService,
    config: ConfigService,
  ) {
    this.webhookToken = config.get<AppConfig['shiprocket']>('shiprocket')!.webhookToken;
  }

  get configured(): boolean {
    return this.shiprocket.isConfigured();
  }

  /**
   * Create a Shiprocket shipment for an order, assign a courier + AWB, schedule
   * pickup, persist the fulfilment fields, and move the order to SHIPPED.
   */
  async fulfil(orderId: string, actor: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.awbCode) throw new BadRequestException('This order already has a Shiprocket shipment.');
    const terminal: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.DELIVERED];
    if (terminal.includes(order.status)) {
      throw new BadRequestException(`Cannot ship an order that is ${order.status}.`);
    }

    const snap = (order.shippingSnapshot as Record<string, string> | null) ?? {};
    const created = await this.shiprocket.createOrder({
      orderNumber: order.orderNumber,
      orderDateISO: order.createdAt.toISOString(),
      billing: {
        name: snap.fullName || order.email,
        address: snap.line1 || '',
        address2: snap.line2,
        city: snap.city || '',
        state: snap.state || '',
        pincode: snap.postalCode || '',
        country: 'India',
        email: order.email,
        phone: snap.phone || '',
      },
      items: order.items.map((i) => ({
        name: i.nameSnapshot,
        sku: i.skuSnapshot,
        units: i.quantity,
        sellingPriceRupees: Math.round(i.unitPriceCents / 100),
      })),
      subTotalRupees: Math.round(order.subtotalCents / 100),
      weightKg: 0.5,
      paymentMethod: 'Prepaid',
    });

    const { awbCode, courierName } = await this.shiprocket.assignAwb(created.shipmentId);
    await this.shiprocket.requestPickup(created.shipmentId);
    const trackingUrl = this.shiprocket.trackingUrlFor(awbCode);

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        shiprocketOrderId: created.shiprocketOrderId,
        shiprocketShipmentId: created.shipmentId,
        awbCode,
        courierName,
        trackingUrl,
      },
    });

    // Sets SHIPPED + shippedAt + carrier/tracking, adds an event, emails the customer.
    await this.orders.updateStatus(
      order.id,
      { status: OrderStatus.SHIPPED, carrier: courierName, trackingNumber: awbCode, note: `Shipped via Shiprocket (${courierName})` },
      actor,
    );

    return this.prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
  }

  /** Live tracking for an order (owner or admin). */
  async track(orderId: string, requester: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== requester.id && requester.role !== Role.ADMIN) {
      throw new UnauthorizedException('Not your order');
    }
    if (!order.awbCode) {
      return { awbCode: null, courierName: order.courierName, trackingUrl: order.trackingUrl, currentStatus: order.status, activities: [] };
    }
    const live = await this.shiprocket.track(order.awbCode);
    return { awbCode: order.awbCode, courierName: order.courierName, ...live };
  }

  /**
   * Shiprocket tracking webhook. Verifies the shared token (sent as x-api-key),
   * finds the order by AWB, and syncs its status (SHIPPED/DELIVERED/CANCELLED).
   */
  async handleWebhook(payload: Record<string, any>, token?: string): Promise<{ received: true }> {
    if (this.webhookToken && token !== this.webhookToken) {
      throw new UnauthorizedException('Invalid webhook token');
    }
    const awb = String(payload?.awb ?? payload?.awb_code ?? '');
    const statusRaw = String(payload?.current_status ?? payload?.shipment_status ?? payload?.status ?? '');
    if (!awb) return { received: true };

    const order = await this.prisma.order.findFirst({ where: { awbCode: awb } });
    if (!order) {
      this.logger.warn(`Webhook AWB ${awb} matched no order`);
      return { received: true };
    }
    const next = mapShiprocketStatus(statusRaw);
    if (next && next !== order.status) {
      await this.orders
        .updateStatus(order.id, { status: next, note: `Shiprocket update: ${statusRaw}` }, SYSTEM_ACTOR)
        .catch((e) => this.logger.error(`Failed to apply webhook status: ${(e as Error).message}`));
    }
    return { received: true };
  }
}
