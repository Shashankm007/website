import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

/** Ordered product ids that appear in the landing-page star carousel. */
export class SetStarProductsDto {
  @ApiProperty({ type: [String], description: 'Ordered product ids (first = first slide)' })
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];
}
