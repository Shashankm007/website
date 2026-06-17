import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
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

/** Shape of a valid object key: `<prefix>/<32 hex>/<safe file name>`. Guards the local sink. */
const LOCAL_KEY_RE = /^(images|videos|models|custom|photos)\/[a-f0-9]{32}\/(?!\.\.?$)[A-Za-z0-9._-]+$/;

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
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client | null;
  private readonly config: AppConfig['s3'];
  /** Dev fallback: with no S3 credentials, store uploads on local disk + serve at /files. */
  private readonly local: boolean;
  private readonly localBaseUrl: string;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.config = configService.getOrThrow<AppConfig['s3']>('s3');
    const env = configService.get<string>('env') ?? 'development';
    const hasS3 = Boolean(this.config.accessKeyId && this.config.secretAccessKey);

    // Production must use real object storage. Never silently fall back to the
    // public local-disk sink there — it would expose an unauthenticated write
    // endpoint and write to ephemeral container disk.
    if (env === 'production' && !hasS3) {
      throw new Error(
        'S3 storage is required in production: set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL. Refusing to start with the local-disk fallback.',
      );
    }

    this.local = !hasS3;
    const port = configService.get<number>('port') ?? 4000;
    this.localBaseUrl = (process.env.STORAGE_PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, '');

    if (this.local) {
      this.logger.warn(
        'No S3 credentials set — using local disk storage (./storage, served at /files). Dev only; set S3_* env vars for cloud storage.',
      );
      this.s3 = null;
    } else {
      if (!this.config.publicUrl) {
        throw new Error('S3_PUBLIC_URL is required when S3 credentials are configured.');
      }
      this.s3 = new S3Client({
        region: this.config.region,
        // An explicit endpoint means a non-AWS, path-style backend (R2/MinIO).
        ...(this.config.endpoint ? { endpoint: this.config.endpoint, forcePathStyle: true } : {}),
        credentials: {
          accessKeyId: this.config.accessKeyId!,
          secretAccessKey: this.config.secretAccessKey!,
        },
      });
    }
  }

  /** Public CDN/bucket URL for a stored object key. */
  publicUrl(objectKey: string): string {
    if (this.local) return `${this.localBaseUrl}/files/${objectKey}`;
    return `${this.config.publicUrl.replace(/\/+$/, '')}/${objectKey}`;
  }

  /** Absolute path to the local storage root (dev fallback). */
  localRoot(): string {
    return path.join(process.cwd(), 'storage');
  }

  /**
   * Best-effort delete of a stored object (S3/R2 or local disk). Never throws —
   * a storage hiccup must not fail the DB operation that triggered the cleanup.
   */
  async deleteObject(objectKey: string): Promise<void> {
    // Only ever delete well-formed, server-issued keys (guards both sinks).
    if (!objectKey || !LOCAL_KEY_RE.test(objectKey)) return;
    try {
      if (this.local) {
        const root = this.localRoot();
        const dest = path.join(root, objectKey);
        if (dest !== root && !dest.startsWith(root + path.sep)) return;
        await fs.unlink(dest).catch((e: NodeJS.ErrnoException) => {
          if (e.code !== 'ENOENT') throw e;
        });
      } else if (this.s3) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: objectKey }));
      }
    } catch (err) {
      this.logger.warn(`Failed to delete stored object ${objectKey}: ${err instanceof Error ? err.message : err}`);
    }
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

    // Dev fallback: the browser PUTs straight to our own sink endpoint.
    if (this.local || !this.s3) {
      const uploadUrl = `${this.localBaseUrl}/api/v1/uploads/local?key=${encodeURIComponent(objectKey)}`;
      return { uploadUrl, objectKey, publicUrl: this.publicUrl(objectKey) };
    }

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });

    return { uploadUrl, objectKey, publicUrl: this.publicUrl(objectKey) };
  }

  /**
   * Dev-only sink for the local storage driver: persist an uploaded file to
   * disk under the storage root. Validates the key to prevent path traversal.
   */
  async saveLocal(key: string, body: Buffer): Promise<void> {
    if (!this.local) throw new BadRequestException('Local uploads are disabled');
    if (!key || !LOCAL_KEY_RE.test(key)) throw new BadRequestException('Invalid object key');
    // express.raw leaves req.body as `{}` when no body is sent — require a real Buffer.
    if (!Buffer.isBuffer(body) || body.length === 0) throw new BadRequestException('Empty upload body');

    const root = this.localRoot();
    const dest = path.join(root, key);
    // Defense-in-depth: the resolved path must stay inside the storage root.
    if (dest !== root && !dest.startsWith(root + path.sep)) {
      throw new BadRequestException('Invalid object key');
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    // Immutable write: object keys are server-issued + single-use, so refuse to
    // overwrite an existing object (closes the overwrite/replace vector).
    try {
      await fs.writeFile(dest, body, { flag: 'wx' });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new BadRequestException('Object already exists');
      }
      throw err;
    }
  }

  /** Persists a completed customer custom-print upload. */
  async recordCustomUpload(userId: string, dto: RecordCustomUploadDto) {
    const objectKey = dto.objectKey.trim();
    // The client supplies the key; validate its shape (mirrors saveLocal) so a
    // recorded URL can't point at an arbitrary path under the public host.
    if (!LOCAL_KEY_RE.test(objectKey)) throw new BadRequestException('Invalid object key');
    return this.prisma.customUpload.create({
      data: {
        userId,
        fileName: dto.fileName.trim().slice(0, 255),
        objectKey,
        url: this.publicUrl(objectKey),
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
