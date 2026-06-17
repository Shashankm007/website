import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

/** Body for `POST /cart/items` — add (or accumulate) a line in the cart. */
export class AddItemDto {
  @ApiProperty({ example: 'clp123product' })
  @IsString()
  productId!: string;

  @ApiPropertyOptional({ example: 'clp123variant' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Selected option values keyed by option name, e.g. { "Material": "PLA", "Color": "Red" }',
    example: { Material: 'PLA', Color: 'Red' },
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, string>;

  @ApiPropertyOptional({ example: 'Happy Birthday!', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customText?: string;

  @ApiPropertyOptional({ example: 'clp123upload' })
  @IsOptional()
  @IsString()
  customUploadId?: string;

  @ApiPropertyOptional({
    description: 'External 3D model link (e.g. MakerWorld) — alternative to uploading an STL',
    example: 'https://makerworld.com/en/models/123456-cool-model',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  modelLink?: string;
}
