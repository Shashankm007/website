import { Injectable } from '@nestjs/common';
import { sanitizePlain } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { Banner, UpdateBannerDto } from './dto/banner.dto';
import { ShippingSettings, UpdateShippingDto } from './dto/shipping.dto';

const BANNER_KEY = 'banner';
const SHIPPING_KEY = 'shipping';

const DEFAULT_BANNER: Banner = {
  enabled: false,
  message: '',
  linkUrl: undefined,
  linkLabel: undefined,
  variant: 'info',
  dismissible: true,
  updatedAt: null,
};

/** Defaults match the historical hardcoded rule: ₹79 flat, free over ₹999 (paise). */
const DEFAULT_SHIPPING: ShippingSettings = {
  flatCents: 7900,
  freeShippingEnabled: true,
  freeThresholdCents: 99900,
  updatedAt: null,
};

/** Site settings stored as JSON rows in the `Setting` key/value table. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current announcement banner config (defaults to a disabled banner). */
  async getBanner(): Promise<Banner> {
    const row = await this.prisma.setting.findUnique({ where: { key: BANNER_KEY } });
    if (!row) return DEFAULT_BANNER;
    const value = (row.value as Partial<Banner>) ?? {};
    return {
      enabled: Boolean(value.enabled),
      message: value.message ?? '',
      linkUrl: value.linkUrl ?? undefined,
      linkLabel: value.linkLabel ?? undefined,
      variant: value.variant ?? 'info',
      dismissible: value.dismissible ?? true,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Upsert the banner config (admin). Sanitizes user-facing text. */
  async setBanner(dto: UpdateBannerDto): Promise<Banner> {
    const value = {
      enabled: dto.enabled,
      message: sanitizePlain(dto.message),
      linkUrl: dto.linkUrl?.trim() || undefined,
      linkLabel: dto.linkLabel ? sanitizePlain(dto.linkLabel) : undefined,
      variant: dto.variant,
      dismissible: dto.dismissible,
    };
    const row = await this.prisma.setting.upsert({
      where: { key: BANNER_KEY },
      create: { key: BANNER_KEY, value },
      update: { value },
    });
    return { ...value, updatedAt: row.updatedAt.toISOString() };
  }

  /** Current shipping configuration (defaults to ₹79 flat / free over ₹999). */
  async getShipping(): Promise<ShippingSettings> {
    const row = await this.prisma.setting.findUnique({ where: { key: SHIPPING_KEY } });
    if (!row) return DEFAULT_SHIPPING;
    const value = (row.value as Partial<ShippingSettings>) ?? {};
    return {
      flatCents: Number.isFinite(value.flatCents) ? Number(value.flatCents) : DEFAULT_SHIPPING.flatCents,
      freeShippingEnabled: value.freeShippingEnabled ?? DEFAULT_SHIPPING.freeShippingEnabled,
      freeThresholdCents: Number.isFinite(value.freeThresholdCents)
        ? Number(value.freeThresholdCents)
        : DEFAULT_SHIPPING.freeThresholdCents,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Upsert the shipping configuration (admin). */
  async setShipping(dto: UpdateShippingDto): Promise<ShippingSettings> {
    const value = {
      flatCents: Math.max(0, Math.round(dto.flatCents)),
      freeShippingEnabled: dto.freeShippingEnabled,
      freeThresholdCents: Math.max(0, Math.round(dto.freeThresholdCents)),
    };
    const row = await this.prisma.setting.upsert({
      where: { key: SHIPPING_KEY },
      create: { key: SHIPPING_KEY, value },
      update: { value },
    });
    return { ...value, updatedAt: row.updatedAt.toISOString() };
  }
}
