import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Min } from 'class-validator';

/** Storefront shipping configuration (all money in integer paise/cents). */
export interface ShippingSettings {
  /** Flat shipping fee charged when free shipping doesn't apply. */
  flatCents: number;
  /** When true, orders at/above `freeThresholdCents` ship free. */
  freeShippingEnabled: boolean;
  /** Order subtotal (after discount) at/above which shipping is free. */
  freeThresholdCents: number;
  updatedAt: string | null;
}

/** Admin payload to update shipping configuration. */
export class UpdateShippingDto {
  @ApiProperty({ description: 'Flat shipping fee in paise/cents', example: 7900, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  flatCents!: number;

  @ApiProperty({ description: 'Enable free shipping over a threshold', default: true })
  @IsBoolean()
  freeShippingEnabled!: boolean;

  @ApiProperty({ description: 'Free-shipping threshold in paise/cents', example: 99900, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  freeThresholdCents!: number;
}
