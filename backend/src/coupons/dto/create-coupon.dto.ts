import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

/** Payload to create a coupon (admin). Money fields are integer cents. */
export class CreateCouponDto {
  @ApiProperty({ example: 'SUMMER20', description: 'Stored/compared uppercase' })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiPropertyOptional({ example: '20% off summer collection' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({ example: 20, description: 'Percent (0..100) or fixed cents depending on type' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ example: 5000, description: 'Minimum order subtotal in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSubtotalCents?: number;

  @ApiPropertyOptional({ example: 100, description: 'Total redemptions allowed across all users' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @ApiPropertyOptional({ example: 1, description: 'Max uses per user' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  startsAt?: Date;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  expiresAt?: Date;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
