import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Payload for attaching a single media item to an existing product. */
export class AddMediaDto {
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
