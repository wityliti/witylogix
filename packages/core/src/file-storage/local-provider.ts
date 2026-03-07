// @ts-nocheck

/**
 * Local File Storage Provider
 * 
 * File system-based implementation for development and self-hosted deployments.
 * Mirrors the FileStorageProvider interface used by S3FileStorage.
 */

import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  statSync,
  rmSync,
} from 'fs';
import { join, basename, relative } from 'path';
import { Readable } from 'stream';
import {
  FileStorageProvider,
  FileMetadata,
  UploadOptions,
  ListFilesResult,
} from './types';

export interface LocalProviderConfig {
  basePath: string;
  baseUrl: string;
  tenantId?: string;
}

/**
 * LocalFileStorage - File system-based implementation
 */
export class LocalFileStorage implements FileStorageProvider {
  private basePath: string;
  private baseUrl: string;
  private tenantId: string;

  constructor(config: LocalProviderConfig) {
    this.basePath = config.basePath;
    this.baseUrl = config.baseUrl;
    this.tenantId = config.tenantId || 'default';

    // Ensure base directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * Build tenant-scoped file path
   */
  private buildPath(key: string): string {
    const tenantPath = join(this.basePath, this.tenantId);
    const filePath = join(tenantPath, key);

    // Ensure we don't escape the tenant directory
    const normalized = filePath.split('..').join('').replace(/\\/g, '/');
    return normalized;
  }

  /**
   * Build tenant-scoped URL
   */
  private buildUrl(key: string): string {
    return `${this.baseUrl}/${this.tenantId}/${key}`;
  }

  /**
   * Upload a file to local storage
   */
  async upload(
    key: string,
    data: Buffer | Readable,
    options?: UploadOptions
  ): Promise<FileMetadata> {
    const filePath = this.buildPath(key);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    // Create directory structure
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    try {
      // Write file
      if (Buffer.isBuffer(data)) {
        await new Promise<void>((resolve, reject) => {
          const stream = createWriteStream(filePath);
          stream.write(data);
          stream.end();
          stream.on('finish', resolve);
          stream.on('error', reject);
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          const writeStream = createWriteStream(filePath);
          data.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
      }

      const stats = statSync(filePath);
      const contentType = options?.contentType || this.detectContentType(key);

      return {
        name: basename(key),
        size: stats.size,
        mimeType: contentType,
        uploadedAt: stats.birthtime,
        url: this.buildUrl(key),
        lastModified: stats.mtime,
      };
    } catch (error) {
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download a file from local storage
   */
  async download(key: string): Promise<Buffer> {
    const filePath = this.buildPath(key);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    try {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = createReadStream(filePath);

        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a file from local storage
   */
  async delete(key: string): Promise<void> {
    const filePath = this.buildPath(key);

    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch (error) {
        throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Get URL for a file
   */
  getUrl(key: string): string {
    return this.buildUrl(key);
  }

  /**
   * Get a signed URL (local storage just returns the regular URL with a fake token)
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, just append a fake token parameter
    const url = this.buildUrl(key);
    const expiresAt = Date.now() + expiresIn * 1000;
    const token = Buffer.from(`${expiresAt}:local`).toString('base64');
    return `${url}?token=${token}`;
  }

  /**
   * List files with optional prefix
   */
  async listFiles(prefix?: string, token?: string): Promise<ListFilesResult> {
    const tenantPath = join(this.basePath, this.tenantId);
    const searchPath = prefix ? join(tenantPath, prefix) : tenantPath;

    if (!existsSync(searchPath)) {
      return { files: [] };
    }

    try {
      const files: FileMetadata[] = [];
      const entries = readdirSync(searchPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(searchPath, entry.name);
        const relativePath = prefix
          ? `${prefix}/${entry.name}`
          : entry.name;

        if (entry.isFile()) {
          const stats = statSync(fullPath);
          files.push({
            name: entry.name,
            size: stats.size,
            mimeType: this.detectContentType(entry.name),
            uploadedAt: stats.birthtime,
            url: this.buildUrl(relativePath),
            lastModified: stats.mtime,
          });
        } else if (entry.isDirectory()) {
          // Recursively list subdirectories
          const subResult = await this.listFiles(relativePath, token);
          files.push(...subResult.files);
        }
      }

      return { files };
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    const filePath = this.buildPath(key);
    return existsSync(filePath);
  }

  /**
   * Detect MIME type from filename
   */
  private detectContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      zip: 'application/zip',
      gz: 'application/gzip',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
