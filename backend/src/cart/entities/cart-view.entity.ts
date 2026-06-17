import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A single resolved line in the cart (Swagger response shape). */
export class CartItemView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  variantId!: string | null;

  @ApiProperty({
    description: 'Selected option values keyed by option name.',
    example: { Material: 'PLA', Color: 'Red' },
  })
  options!: Record<string, string>;

  @ApiPropertyOptional({ nullable: true })
  customText!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'External 3D model link (e.g. MakerWorld).' })
  modelLink!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "URL of the customer's uploaded custom file." })
  customUploadUrl!: string | null;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ description: 'Resolved unit price in integer cents.' })
  unitPriceCents!: number;

  @ApiProperty({ description: 'unitPriceCents * quantity.' })
  lineTotalCents!: number;

  @ApiProperty({ description: 'False when a STOCKED product can no longer satisfy the quantity.' })
  inStock!: boolean;
}

/** The full cart payload returned by all cart read/write endpoints. */
export class CartView {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({
    description: 'Guest cart token — only present for anonymous carts. Send it back via the x-cart-token header.',
  })
  token?: string;

  @ApiProperty({ type: [CartItemView] })
  items!: CartItemView[];

  @ApiProperty({ description: 'Sum of every lineTotalCents.' })
  subtotalCents!: number;

  @ApiProperty({ description: 'Sum of item quantities.' })
  itemCount!: number;
}
