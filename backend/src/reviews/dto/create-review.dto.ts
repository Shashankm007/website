import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Payload for creating a product review (one per user per product). */
export class CreateReviewDto {
  @ApiProperty({ example: 'ckv9z1a2b3c4d5e6f7g8h9i0' })
  @IsString()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Excellent print quality' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ example: 'Crisp layers, fast shipping, would buy again.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;
}
