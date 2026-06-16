import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Inline shipping address used when the buyer has no saved Address row (guest-style checkout). */
export class InlineAddressDto {
  @ApiProperty({ example: 'Jane Maker' })
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '123 Printer Lane' })
  @IsString()
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty({ example: 'Austin' })
  @IsString()
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty({ example: '78701' })
  @IsString()
  @MaxLength(20)
  postalCode!: string;

  @ApiPropertyOptional({ example: 'US', default: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ example: '+1 512 555 0100' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

/**
 * Checkout payload. Provide either a saved `shippingAddressId` (validated to belong to
 * the buyer) or an inline `shippingAddress` that gets snapshotted. A frozen
 * `shippingSnapshot` is always persisted on the order regardless of the source.
 */
export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'Id of a saved Address owned by the user' })
  @ValidateIf((o) => !o.shippingAddress)
  @IsString()
  shippingAddressId?: string;

  @ApiPropertyOptional({ type: InlineAddressDto, description: 'Inline shipping address (snapshotted)' })
  @ValidateIf((o) => !o.shippingAddressId)
  @ValidateNested()
  @Type(() => InlineAddressDto)
  shippingAddress?: InlineAddressDto;

  @ApiPropertyOptional({ description: 'Id of a saved billing Address owned by the user' })
  @IsOptional()
  @IsString()
  billingAddressId?: string;

  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string;

  @ApiPropertyOptional({ example: 'jane@example.com', description: 'Contact email (defaults to the account email)' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'Please leave at the front desk.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
