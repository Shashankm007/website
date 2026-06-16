import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { AppConfig } from '../config/configuration';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import { PresignUploadDto, RecordCustomUploadDto, UploadKind } from './dto/uploads.dto';

/** How long a presigned PUT URL stays valid (seconds). */
const PRESIGN_EXPIRY_SECONDS = 300;

/** Object-key prefix per upload kind. */
const KIND_PREFIX: Record<UploadKind, string> = {
  image: 'images',
  video: 'videos',
  model: 'models',
  custom: 'custom',
  photo: 'photos',
};

export interface PresignResult {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
}

/**
 * Issues presigned S3/R2 PUT URLs for direct browser uploads and records
 * customer custom-print uploads. The DB only ever stores the object key + URL.
 */
@Injectable()
export class UploadsService {
  private readonly s3: S3Client;
  private readonly config: AppConfig['s3'];

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.config = configService.getOrThrow<AppConfig['s3']>('s3');
    this.s3 = new S3Client({
      region: this.config.region,
      // An explicit endpoint means a non-AWS, path-style backend (R2/MinIO).
      ...(this.config.endpoint ? { endpoint: this.config.endpoint, forcePathStyle: true } : {}),
      ...(this.config.accessKeyId && this.config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: this.config.accessKeyId,
              secretAccessKey: this.config.secretAccessKey,
            },
          }
        : {}),
    });
  }

  /** Public CDN/bucket URL for a stored object key. */
  publicUrl(objectKey: string): string {
    return `${this.config.publicUrl}/${objectKey}`;
  }

  /**
   * Validates the request by kind, derives a safe object key, and returns a
   * presigned PUT URL (5-min expiry) plus the resulting public URL.
   */
  async presignPut(dto: PresignUploadDto): Promise<PresignResult> {
    const contentType = dto.contentType.trim().toLowerCase();
    const fileName = dto.fileName.trim();
    const ext = this.extension(fileName);

    switch (dto.kind) {
      case 'image':
      // Customer photo uploads (e.g. lithophane) are images too.
      case 'photo':
        if (!contentType.startsWith('image/')) {
          throw new BadRequestException('Images must have an image/* content type');
        }
        break;
      case 'video':
        if (!contentType.startsWith('video/')) {
          throw new BadRequestException('Videos must have a video/* content type');
        }
        break;
      case 'model':
        if (
          ext !== 'stl' &&
          ext !== 'obj' &&
          !contentType.startsWith('model/') &&
          contentType !== 'application/octet-stream'
        ) {
          throw new BadRequestException('3D models must be .stl/.obj or a model/* content type');
        }
        break;
      case 'custom':
        if (ext !== 'stl') {
          throw new BadRequestException('Custom prints must be .stl files');
        }
        break;
    }

    const objectKey = this.buildObjectKey(dto.kind, fileName);
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });

    return { uploadUrl, objectKey, publicUrl: this.publicUrl(objectKey) };
  }

  /** Persists a completed customer custom-print upload. */
  async recordCustomUpload(userId: string, dto: RecordCustomUploadDto) {
    return this.prisma.customUpload.create({
      data: {
        userId,
        fileName: dto.fileName.trim().slice(0, 255),
        objectKey: dto.objectKey,
        url: this.publicUrl(dto.objectKey),
        sizeBytes: dto.sizeBytes,
      },
    });
  }

  /** `<prefix>/<random hex>/<slugified file name>` — collision-resistant + safe. */
  private buildObjectKey(kind: UploadKind, fileName: string): string {
    const prefix = KIND_PREFIX[kind];
    const ext = this.extension(fileName);
    const base = slugify(fileName.replace(/\.[^.]+$/, '')) || 'file';
    const safeName = ext ? `${base}.${ext}` : base;
    return `${prefix}/${randomBytes(16).toString('hex')}/${safeName}`;
  }

  /** Lower-cased file extension without the dot, or '' if none. */
  private extension(fileName: string): string {
    const match = /\.([a-z0-9]+)$/i.exec(fileName);
    return match ? match[1].toLowerCase() : '';
  }
}
