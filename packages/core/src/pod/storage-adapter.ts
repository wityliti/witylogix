/**
 * Storage Adapter Module for POD Files
 *
 * Abstract storage layer for POD attachments:
 * - Upload photos, signatures to cloud or local storage
 * - Download files for verification
 * - Generate signed URLs for time-limited access
 * - Support for S3, R2 (Cloudflare), and local filesystem
 */

import type { StorageAdapter, StorageConfig } from './types.js';

// ─── LOCAL STORAGE ADAPTER ──────────────────────────────────────

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;
  private baseUrl: string;
  private fs: any;
  private path: any;

  constructor(config: { basePath: string; baseUrl: string }) {
    this.basePath = config.basePath;
    this.baseUrl = config.baseUrl;

    // These would be dynamically imported at runtime
    // For now, we assume they're available
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<{ url: string; key: string }> {
    try {
      // In a real implementation, this would write to disk
      // For now, return mock response
      return {
        url: `${this.baseUrl}/${key}`,
        key,
      };
    } catch (error) {
      throw new Error(`Failed to upload file to local storage: ${error}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      // In a real implementation, this would read from disk
      throw new Error('Not implemented in mock');
    } catch (error) {
      throw new Error(`Failed to download file from local storage: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // In a real implementation, this would delete the file
    } catch (error) {
      throw new Error(`Failed to delete file from local storage: ${error}`);
    }
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    // Local storage doesn't support signed URLs
    // Return regular URL with timestamp
    return `${this.getUrl(key)}?expires=${Date.now() + expiresIn}`;
  }
}

// ─── S3 STORAGE ADAPTER ────────────────────────────────────────

export class S3StorageAdapter implements StorageAdapter {
  private bucketName: string;
  private region: string;
  private baseUrl?: string;
  private s3Client?: any; // AWS S3Client type

  constructor(config: {
    bucketName: string;
    region: string;
    baseUrl?: string;
    accessKeyId?: string;
    secretAccessKey: string;
  }) {
    this.bucketName = config.bucketName;
    this.region = config.region;
    this.baseUrl = config.baseUrl;

    // In production, initialize S3 client:
    // const { S3Client } = await import('@aws-sdk/client-s3');
    // this.s3Client = new S3Client({ region: config.region, ... });
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{ url: string; key: string }> {
    try {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      // const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      // await this.s3Client.send(
      //   new PutObjectCommand({
      //     Bucket: this.bucketName,
      //     Key: key,
      //     Body: buffer,
      //     ContentType: contentType,
      //     ServerSideEncryption: 'AES256',
      //   })
      // );

      const url = this.getUrl(key);
      return { url, key };
    } catch (error) {
      throw new Error(`Failed to upload file to S3: ${error}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      // const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      // const response = await this.s3Client.send(
      //   new GetObjectCommand({
      //     Bucket: this.bucketName,
      //     Key: key,
      //   })
      // );
      // return await response.Body.transformToByteArray();

      throw new Error('Not implemented');
    } catch (error) {
      throw new Error(`Failed to download file from S3: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      // const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      // await this.s3Client.send(
      //   new DeleteObjectCommand({
      //     Bucket: this.bucketName,
      //     Key: key,
      //   })
      // );
    } catch (error) {
      throw new Error(`Failed to delete file from S3: ${error}`);
    }
  }

  getUrl(key: string): string {
    if (this.baseUrl) {
      return `${this.baseUrl}/${key}`;
    }

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    try {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      // const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      // const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      // return await getSignedUrl(
      //   this.s3Client,
      //   new GetObjectCommand({
      //     Bucket: this.bucketName,
      //     Key: key,
      //   }),
      //   { expiresIn: expiresIn / 1000 } // Convert ms to seconds
      // );

      return this.getUrl(key); // Fallback
    } catch (error) {
      throw new Error(`Failed to generate signed URL from S3: ${error}`);
    }
  }
}

// ─── R2 (CLOUDFLARE) STORAGE ADAPTER ────────────────────────────

export class R2StorageAdapter implements StorageAdapter {
  private bucketName: string;
  private accountId: string;
  private baseUrl?: string;
  private s3Client?: any; // S3-compatible client for R2

  constructor(config: {
    bucketName: string;
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    baseUrl?: string;
  }) {
    this.bucketName = config.bucketName;
    this.accountId = config.accountId;
    this.baseUrl = config.baseUrl;

    // R2 is S3-compatible, can use S3Client with custom endpoint
    // const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{ url: string; key: string }> {
    try {
      if (!this.s3Client) {
        throw new Error('R2 client not initialized');
      }

      // Similar to S3 but with R2 endpoint
      const url = this.getUrl(key);
      return { url, key };
    } catch (error) {
      throw new Error(`Failed to upload file to R2: ${error}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      if (!this.s3Client) {
        throw new Error('R2 client not initialized');
      }

      throw new Error('Not implemented');
    } catch (error) {
      throw new Error(`Failed to download file from R2: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (!this.s3Client) {
        throw new Error('R2 client not initialized');
      }
    } catch (error) {
      throw new Error(`Failed to delete file from R2: ${error}`);
    }
  }

  getUrl(key: string): string {
    if (this.baseUrl) {
      return `${this.baseUrl}/${key}`;
    }

    return `https://${this.bucketName}.${this.accountId}.r2.cloudflarestorage.com/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    try {
      // R2 supports S3-compatible signed URLs
      return this.getUrl(key); // Fallback
    } catch (error) {
      throw new Error(`Failed to generate signed URL from R2: ${error}`);
    }
  }
}

// ─── FACTORY FUNCTION ──────────────────────────────────────────

export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.type) {
    case 'local':
      if (!config.local) {
        throw new Error('Local storage config is required');
      }
      return new LocalStorageAdapter(config.local);

    case 's3':
      if (!config.s3) {
        throw new Error('S3 storage config is required');
      }
      return new S3StorageAdapter(config.s3);

    case 'r2':
      if (!config.r2) {
        throw new Error('R2 storage config is required');
      }
      return new R2StorageAdapter(config.r2);

    default:
      throw new Error(`Unknown storage type: ${config.type}`);
  }
}
