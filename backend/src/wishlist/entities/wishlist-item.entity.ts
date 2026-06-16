import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';

/** Product summary embedded in a wishlist entry (card view). */
export class WishlistProductSummary {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ description: 'Base price in integer paise (INR).' })
  priceCents: number;

  @ApiPropertyOptional({ description: 'Optional "was" price in paise.' })
  compareAtCents: number | null;

  @ApiProperty({ description: 'Formatted price string, e.g. "₹1,499.00".' })
  price: string;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: ProductStatus })
  status: ProductStatus;

  @ApiProperty()
  ratingAvg: number;

  @ApiProperty()
  ratingCount: number;

  @ApiPropertyOptional({ description: 'Primary product image URL, if any.' })
  imageUrl: string | null;
}

/** A wishlist entry returned to the client. */
export class WishlistItemEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({ description: 'When the product was added to the wishlist.' })
  createdAt: Date;

  @ApiProperty({ type: WishlistProductSummary })
  product: WishlistProductSummary;
}
