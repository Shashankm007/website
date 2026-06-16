import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** Availability filter values (maps to fulfillment + inventory). */
export const AVAILABILITY = ['in_stock', 'made_to_order', 'all'] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Sort order values for the catalog listing. */
export const PRODUCT_SORT = ['price_asc', 'price_desc', 'newest', 'popular', 'rating'] as const;
export type ProductSort = (typeof PRODUCT_SORT)[number];

/**
 * Catalog query params (CONVENTIONS §7). Extends pagination with
 * search / filtering / sorting. Money filters (`minPrice`/`maxPrice`) are in CENTS.
 */
export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Full-text search on name + description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category id' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by category slug' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Comma-separated tag slugs/names', example: 'minis,gaming' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : value,
  )
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Minimum price in cents', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in cents', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: AVAILABILITY, default: 'all' })
  @IsOptional()
  @IsIn(AVAILABILITY)
  availability?: Availability;

  @ApiPropertyOptional({ enum: PRODUCT_SORT, default: 'newest' })
  @IsOptional()
  @IsIn(PRODUCT_SORT)
  sort?: ProductSort;

  @ApiPropertyOptional({ description: 'Only featured products' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' ? false : value))
  @IsBoolean()
  featured?: boolean;
}
