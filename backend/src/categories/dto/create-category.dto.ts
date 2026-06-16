import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

/** Payload to create a category. Slug is derived from `name` when omitted. */
export class CreateCategoryDto {
  @ApiProperty({ example: 'Tabletop Miniatures' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'tabletop-miniatures', description: 'Auto-generated from name when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({ example: 'Hand-painted resin minis for your campaigns.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.forge3d.com/categories/minis.jpg' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'ckp9x1abc0001qz', description: 'Parent category id (null for a root)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 0, default: 0, minimum: 0, description: 'Sort order among siblings' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
