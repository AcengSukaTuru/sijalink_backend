import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageDriver } from './storage.types.js';

export interface MinioConfig {
  endpoint: string;
  port?: number;
  useSsl?: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
}

export class MinioStorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketChecked = false;

  constructor(private readonly config: MinioConfig) {
    this.bucket = config.bucket;
    const protocol = config.useSsl ? 'https' : 'http';
    const port = config.port ? `:${config.port}` : '';
    const endpointUrl =
      config.endpoint.startsWith('http://') ||
      config.endpoint.startsWith('https://')
        ? config.endpoint
        : `${protocol}://${config.endpoint}${port}`;

    this.client = new S3Client({
      endpoint: endpointUrl,
      region: config.region ?? 'us-east-1',
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async init(): Promise<void> {
    await this.ensureBucket();
  }

  async ensureBucket(): Promise<void> {
    if (this.bucketChecked) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketChecked = true;
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.bucketChecked = true;
      } catch (err) {
        const name = (err as { name?: string }).name;
        if (
          name === 'BucketAlreadyOwnedByYou' ||
          name === 'BucketAlreadyExists'
        ) {
          this.bucketChecked = true;
          return;
        }
        throw err;
      }
    }
  }

  async write(
    key: string,
    buffer: Buffer,
    contentType?: string,
  ): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async read(key: string): Promise<Buffer> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!res.Body) {
        const err = new Error('Empty object body');
        (err as NodeJS.ErrnoException).code = 'ENOENT';
        throw err;
      }
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error: unknown) {
      const errName = (error as { name?: string }).name;
      if (errName === 'NoSuchKey' || errName === 'NotFound') {
        const err = new Error('Object not found in bucket');
        (err as NodeJS.ErrnoException).code = 'ENOENT';
        throw err;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error: unknown) {
      const errName = (error as { name?: string }).name;
      if (errName === 'NoSuchKey' || errName === 'NotFound') return;
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}
