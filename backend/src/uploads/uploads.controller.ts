import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PresignUploadDto, RecordCustomUploadDto } from './dto/uploads.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Request a presigned PUT URL for a direct browser upload to S3/R2. */
  @Post('presign')
  presign(@Body() dto: PresignUploadDto) {
    return this.uploads.presignPut(dto);
  }

  /** Record a completed customer custom-print upload against the user. */
  @Post('custom')
  recordCustom(@CurrentUser('id') userId: string, @Body() dto: RecordCustomUploadDto) {
    return this.uploads.recordCustomUpload(userId, dto);
  }
}
