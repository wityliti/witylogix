import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import type { BenchConfigStorage } from '../config.js';
import type { StorageClient, StorageObject } from './storage.js';

export class S3StorageClient implements StorageClient {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: BenchConfigStorage) {
    if (!config.bucket) {
      throw new Error(`storage.bucket is required when backend=${config.backend}`);
    }
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region ?? 'us-east-1',
      endpoint: config.endpoint ?? undefined,
      forcePathStyle: config.backend === 'r2' || !!config.endpoint,
    });
  }

  async get(key: string): Promise<Readable> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return out.Body as Readable;
  }

  async put(
    key: string,
    body: Readable | Buffer,
    meta?: { contentType?: string },
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: meta?.contentType,
      }),
    );
  }

  async head(key: string): Promise<StorageObject | null> {
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: out.ContentLength ?? 0,
        contentType: out.ContentType,
        lastModified: out.LastModified,
      };
    } catch (err) {
      if ((err as { name?: string }).name === 'NotFound') return null;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.head(key)) !== null;
  }
}
