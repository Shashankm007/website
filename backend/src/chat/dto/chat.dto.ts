import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Existing conversation id to continue' })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({ example: 'How long does delivery take?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ description: 'Visitor name (guests)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class AdminChatQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ChatStatus })
  @IsOptional()
  @IsEnum(ChatStatus)
  status?: ChatStatus;

  @ApiPropertyOptional({ description: 'Only conversations flagged for a human' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  needsHuman?: boolean;
}

export class AdminUpdateChatDto {
  @ApiProperty({ enum: ChatStatus })
  @IsEnum(ChatStatus)
  status!: ChatStatus;
}

export class AdminReplyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
