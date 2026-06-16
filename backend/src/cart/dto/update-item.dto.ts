import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Body for `PATCH /cart/items/:id` — update quantity / customization of a line. */
export class UpdateItemDto {
  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Replacement option values keyed by option name.',
    example: { Material: 'PLA', Color: 'Blue' },
  })
  @IsOptional()
  @IsObject()
  optionsJson?: Record<string, string>;

  @ApiPropertyOptional({ example: 'New engraving', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customText?: string;
}
