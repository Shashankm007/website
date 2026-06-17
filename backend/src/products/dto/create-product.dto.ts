import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomizationType, FulfillmentType, MediaType, ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** A single media item attached to a product (image or 3D model). */
export class ProductMediaInputDto {
  @ApiProperty({ enum: MediaType, default: MediaType.IMAGE })
  @IsEnum(MediaType)
  type!: MediaType;

  @ApiProperty({ description: 'Public URL of the asset' })
  @IsString()
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional({ description: 'S3/R2 object key' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  objectKey?: string;

  @ApiPropertyOptional({ description: 'Alt text / accessibility label' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;

  @ApiPropertyOptional({ description: 'Display order (ascending)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

/** A selectable value within an option (e.g. "PLA" under "Material"). */
export class ProductOptionValueInputDto {
  @ApiProperty({ example: 'PLA' })
  @IsString()
  @MaxLength(120)
  value!: string;

  @ApiPropertyOptional({ description: 'Upcharge in cents for this value', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceDeltaCents?: number;

  @ApiPropertyOptional({ description: 'Hex color for swatch rendering', example: '#ff0000' })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  hex?: string;

  @ApiPropertyOptional({
    description: 'Human-readable physical size for this value',
    example: '10 × 5 × 3 cm',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dimension?: string;
}

/** A customization dimension (e.g. "Material", "Color"). */
export class ProductOptionInputDto {
  @ApiProperty({ example: 'Material' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: [ProductOptionValueInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionValueInputDto)
  values!: ProductOptionValueInputDto[];
}

/** Create payload for a product (admin). Slug is auto-generated from name. */
export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Long form description (markdown/HTML allowed, sanitized)' })
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  shortDescription?: string;

  @ApiProperty({ description: 'Stock-keeping unit (unique)' })
  @IsString()
  @MaxLength(120)
  sku!: string;

  @ApiProperty({ description: 'Base price in cents', minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @ApiPropertyOptional({ description: 'Optional "was" price in cents', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtCents?: number;

  @ApiProperty({ enum: ProductStatus, default: ProductStatus.DRAFT })
  @IsEnum(ProductStatus)
  status!: ProductStatus;

  @ApiProperty({ enum: FulfillmentType, default: FulfillmentType.STOCKED })
  @IsEnum(FulfillmentType)
  fulfillment!: FulfillmentType;

  @ApiPropertyOptional({
    enum: CustomizationType,
    default: CustomizationType.NONE,
    description: 'Requires a customer file upload (STL or photo) before ordering',
  })
  @IsOptional()
  @IsEnum(CustomizationType)
  customizationType?: CustomizationType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Weight in grams (for shipping)', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @ApiPropertyOptional({ description: 'Category ids this product belongs to', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ description: 'Tag names (upserted by slug)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [ProductMediaInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductMediaInputDto)
  media?: ProductMediaInputDto[];

  @ApiPropertyOptional({ type: [ProductOptionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionInputDto)
  options?: ProductOptionInputDto[];

  @ApiPropertyOptional({ description: 'Initial stock to seed (STOCKED only)', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  initialStock?: number;

  @ApiPropertyOptional({ description: 'Low-stock alert threshold', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
