import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';

const BASE = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // Shiprocket tokens last ~10 days

export interface ShiprocketOrderInput {
  orderNumber: string;
  orderDateISO: string;
  billing: {
    name: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    country?: string;
    email: string;
    phone: string;
  };
  items: { name: string; sku: string; units: number; sellingPriceRupees: number }[];
  subTotalRupees: number;
  weightKg: number;
  paymentMethod: 'Prepaid' | 'COD';
  dimensionsCm?: { length: number; breadth: number; height: number };
}

export interface ShiprocketTracking {
  trackingUrl: string;
  currentStatus?: string;
  activities: { date?: string; status?: string; activity?: string; location?: string }[];
}

/**
 * Thin client over the Shiprocket External API: token-cached auth, adhoc order
 * creation, AWB assignment, pickup, and tracking. All money sent in rupees.
 */
@Injectable()
export class ShiprocketService {
  private readonly logger = new Logger(ShiprocketService.name);
  private readonly cfg: AppConfig['shiprocket'];
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor(config: ConfigService) {
    this.cfg = config.get<AppConfig['shiprocket']>('shiprocket')!;
  }

  /**
   * Create a hosted checkout session (if supported by Shiprocket) and return a redirect URL.
   * Falls back to creating an adhoc order and constructing a URL from `checkoutUrl` config.
   */
  async createHostedCheckout(input: ShiprocketOrderInput, returnUrl: string): Promise<string> {
    this.assertConfigured();
    // Try a direct Shiprocket hosted checkout API if available
    try {
      const r = await fetch(`${BASE}/orders/create/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = (await r.json().catch(() => ({}))) as Record<string, any>;
      if (r.ok && json.checkout_url) return String(json.checkout_url);
    } catch (e) {
      this.logger.debug(`Hosted checkout endpoint not available or failed: ${(e as Error).message}`);
    }

    // Fallback: create a Shiprocket adhoc order and use an externally configured checkout URL
    const created = await this.createOrder(input);
    const checkoutBase = this.cfg.checkoutUrl as unknown as string | undefined;
    if (!checkoutBase) {
      // No hosted checkout available — return a simple instruction URL (or throw)
      throw new Error('Shiprocket hosted checkout is not available and no fallback checkout URL is configured.');
    }
    const url = new URL(checkoutBase);
    url.searchParams.set('order_id', created.shiprocketOrderId);
    url.searchParams.set('shipment_id', created.shipmentId);
    url.searchParams.set('return_url', returnUrl);
    return url.toString();
  }

  isConfigured(): boolean {
    return Boolean(this.cfg.email && this.cfg.password);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to enable shipping.',
      );
    }
  }

  private async getToken(): Promise<string> {
    this.assertConfigured();
    if (this.token && Date.now() < this.tokenExpiry) return this.token;
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.cfg.email, password: this.cfg.password }),
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
    if (!res.ok || !data.token) {
      throw new BadRequestException(`Shiprocket auth failed: ${data.message ?? res.status}`);
    }
    this.token = data.token;
    this.tokenExpiry = Date.now() + TOKEN_TTL_MS;
    return this.token;
  }

  private async req<T>(path: string, method: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.error(`Shiprocket ${path} -> ${res.status}: ${JSON.stringify(json)}`);
      throw new BadRequestException((json?.message as string) ?? `Shiprocket request failed (${res.status})`);
    }
    return json as T;
  }

  /** Create an adhoc order in Shiprocket; returns its order + shipment ids. */
  async createOrder(input: ShiprocketOrderInput): Promise<{ shiprocketOrderId: string; shipmentId: string }> {
    const body = {
      order_id: input.orderNumber,
      order_date: input.orderDateISO.slice(0, 10),
      pickup_location: this.cfg.pickupLocation || 'Primary',
      ...(this.cfg.channelId ? { channel_id: this.cfg.channelId } : {}),
      billing_customer_name: input.billing.name,
      billing_last_name: '',
      billing_address: input.billing.address,
      billing_address_2: input.billing.address2 ?? '',
      billing_city: input.billing.city,
      billing_pincode: input.billing.pincode,
      billing_state: input.billing.state,
      billing_country: input.billing.country ?? 'India',
      billing_email: input.billing.email,
      billing_phone: input.billing.phone,
      shipping_is_billing: true,
      order_items: input.items.map((i) => ({
        name: i.name,
        sku: i.sku,
        units: i.units,
        selling_price: i.sellingPriceRupees,
      })),
      payment_method: input.paymentMethod,
      sub_total: input.subTotalRupees,
      length: input.dimensionsCm?.length ?? 12,
      breadth: input.dimensionsCm?.breadth ?? 12,
      height: input.dimensionsCm?.height ?? 8,
      weight: input.weightKg,
    };
    const r = await this.req<{ order_id: number | string; shipment_id: number | string }>(
      '/orders/create/adhoc',
      'POST',
      body,
    );
    return { shiprocketOrderId: String(r.order_id), shipmentId: String(r.shipment_id) };
  }

  /** Assign the cheapest recommended courier + AWB to a shipment. */
  async assignAwb(shipmentId: string): Promise<{ awbCode: string; courierName: string }> {
    const r = await this.req<{ response?: { data?: { awb_code?: string; courier_name?: string } } }>(
      '/courier/assign/awb',
      'POST',
      { shipment_id: Number(shipmentId) },
    );
    const d = r.response?.data ?? {};
    if (!d.awb_code) throw new BadRequestException('Shiprocket could not assign a courier (no serviceable AWB).');
    return { awbCode: String(d.awb_code), courierName: String(d.courier_name ?? 'Courier') };
  }

  /** Request a pickup for a shipment (best-effort; logs on failure). */
  async requestPickup(shipmentId: string): Promise<void> {
    try {
      await this.req('/courier/generate/pickup', 'POST', { shipment_id: [Number(shipmentId)] });
    } catch (e) {
      this.logger.warn(`Pickup request failed for shipment ${shipmentId}: ${(e as Error).message}`);
    }
  }

  /** Live tracking for an AWB. */
  async track(awb: string): Promise<ShiprocketTracking> {
    const r = await this.req<{
      tracking_data?: {
        track_url?: string;
        shipment_track?: { current_status?: string }[];
        shipment_activity?: { date?: string; status?: string; activity?: string; location?: string }[];
      };
    }>(`/courier/track/awb/${encodeURIComponent(awb)}`, 'GET');
    const td = r.tracking_data ?? {};
    return {
      trackingUrl: td.track_url || this.trackingUrlFor(awb),
      currentStatus: td.shipment_track?.[0]?.current_status,
      activities: td.shipment_activity ?? [],
    };
  }

  /** Public Shiprocket tracking page for an AWB. */
  trackingUrlFor(awb: string): string {
    return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
  }
}
