import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const BANNER_VARIANTS = ['info', 'success', 'warning', 'sale'] as const;
export type BannerVariant = (typeof BANNER_VARIANTS)[number];

/** Site-wide announcement banner shown at the top of the storefront. */
export class UpdateBannerDto {
  @ApiProperty({ description: 'Show the banner on the storefront' })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ example: 'Festive sale — flat 20% off all desk accessories!', maxLength: 240 })
  @IsString()
  @MaxLength(240)
  message!: string;

  @ApiPropertyOptional({ description: 'Optional call-to-action link', example: '/products?sort=popular' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @ApiPropertyOptional({ example: 'Shop now', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  linkLabel?: string;

  @ApiProperty({ enum: BANNER_VARIANTS, default: 'info' })
  @IsIn(BANNER_VARIANTS)
  variant!: BannerVariant;

  @ApiProperty({ description: 'Allow visitors to dismiss the banner', default: true })
  @IsBoolean()
  dismissible!: boolean;
}

export interface Banner extends UpdateBannerDto {
  /** Bumped on each save so the client can re-show a dismissed banner when it changes. */
  updatedAt: string | null;
}
