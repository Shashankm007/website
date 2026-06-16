import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

/** Payload to validate + price a coupon against an order subtotal (cents). */
export class ValidateCouponDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 5000, description: 'Order subtotal in cents' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotalCents!: number;
}
