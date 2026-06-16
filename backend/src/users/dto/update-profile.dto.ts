import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Self-service profile update (name + phone only). */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Maker' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '+1 555 123 4567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
