import { Body, Controller, HttpCode, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PresignUploadDto, RecordCustomUploadDto } from './dto/uploads.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Request a presigned PUT URL for a direct browser upload to S3/R2 (or the local dev sink). */
  @Post('presign')
  presign(@Body() dto: PresignUploadDto) {
    return this.uploads.presignPut(dto);
  }

  /**
   * Dev-only sink for the local storage driver. The browser PUTs the raw file
   * here (no auth, like a presigned S3 URL); the raw body is captured by the
   * `express.raw` middleware registered for this path in main.ts.
   */
  @Public()
  @Put('local')
  @HttpCode(200)
  async putLocal(@Query('key') key: string, @Req() req: Request) {
    await this.uploads.saveLocal(key, req.body as Buffer);
    return { ok: true };
  }

  /** Record a completed customer custom-print upload against the user. */
  @Post('custom')
  recordCustom(@CurrentUser('id') userId: string, @Body() dto: RecordCustomUploadDto) {
    return this.uploads.recordCustomUpload(userId, dto);
  }
}
