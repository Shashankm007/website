import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

/**
 * Bulk product import. Provide EITHER structured `rows` OR a raw `csv` string
 * (parsed server-side). At least one must be present.
 */
export class ImportProductsDto {
  @ApiPropertyOptional({ type: [CreateProductDto], description: 'Structured rows to create' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  rows?: CreateProductDto[];

  @ApiPropertyOptional({ description: 'Raw CSV text (header row required)' })
  @IsOptional()
  @IsString()
  csv?: string;
}
