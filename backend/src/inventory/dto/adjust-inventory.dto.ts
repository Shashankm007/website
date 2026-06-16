import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryReason } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';

/** Manually adjust a product's stock level (admin). */
export class AdjustInventoryDto {
  @ApiProperty({ description: 'Signed change to apply to quantity (negative removes stock)', example: 25 })
  @IsInt()
  @NotEquals(0, { message: 'delta must be non-zero' })
  delta!: number;

  @ApiProperty({ enum: InventoryReason, example: InventoryReason.RESTOCK })
  @IsEnum(InventoryReason)
  reason!: InventoryReason;

  @ApiPropertyOptional({ example: 'Received purchase order #4821' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
