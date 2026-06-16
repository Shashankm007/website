import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

/** The asset family being uploaded; drives validation + object-key prefix. */
export type UploadKind = 'image' | 'video' | 'model' | 'custom' | 'photo';

export class PresignUploadDto {
  @ApiProperty({ example: 'dragon.stl', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'model/stl', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  contentType!: string;

  @ApiProperty({ enum: ['image', 'video', 'model', 'custom', 'photo'], example: 'model' })
  @IsIn(['image', 'video', 'model', 'custom', 'photo'])
  kind!: UploadKind;
}

export class RecordCustomUploadDto {
  @ApiProperty({ example: 'my-part.stl', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'custom/9f8a.../my-part.stl', maxLength: 1024 })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  objectKey!: string;

  @ApiProperty({ example: 1048576, minimum: 1, description: 'Uploaded file size in bytes' })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
