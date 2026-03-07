/**
 * File storage abstraction layer.
 *
 * Features:
 * - FileStorage interface: upload, download, delete, getUrl, list
 * - LocalFileStorage implementation (local disk)
 * - S3FileStorage stub (interface-compatible, placeholder for AWS SDK)
 * - File metadata: name, size, mimeType, uploadedAt, url
 *
 * Usage:
 * const storage = new LocalFileStorage("./uploads");
 * await storage.upload("file.pdf", fileBuffer);
 * const url = storage.getUrl("file.pdf");
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { Readable } from "stream";

// Types

export interface FileMetadata {
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  url: string;
}

export interface FileStorageProvider {
  upload(key: string, data: Buffer | Readable, mimeType: string): Promise<FileMetadata>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
  list(prefix?: string): Promise<FileMetadata[]>;
  exists(key: string): Promise<boolean>;
}

// Local File Storage

export class LocalFileStorage implements FileStorageProvider {
  private basePath: string;
  private baseUrl: string;

  constructor(basePath: string = "./uploads", baseUrl: string = "/uploads") {
    this.basePath = basePath;
    this.baseUrl = baseUrl;

    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true });
    }
  }

  async upload(key: string, data: Buffer | Readable, mimeType: string): Promise<FileMetadata> {
    const filePath = join(this.basePath, key);

    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (Buffer.isBuffer(data)) {
      await new Promise<void>((resolve, reject) => {
        const stream = createWriteStream(filePath);
        stream.write(data);
        stream.end();
        stream.on("finish", resolve);
        stream.on("error", reject);
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(filePath);
        data.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
    }

    const stats = statSync(filePath);

    return {
      name: basename(key),
      size: stats.size,
      mimeType,
      uploadedAt: stats.birthtime,
      url: this.getUrl(key),
    };
  }

  async download(key: string): Promise<Buffer> {
    const filePath = join(this.basePath, key);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = createReadStream(filePath);

      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on("error", reject);
    });
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);

    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async list(prefix: string = ""): Promise<FileMetadata[]> {
    const searchPath = prefix ? join(this.basePath, prefix) : this.basePath;

    if (!existsSync(searchPath)) {
      return [];
    }

    const files: FileMetadata[] = [];
    const entries = readdirSync(searchPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(searchPath, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isFile()) {
        const stats = statSync(fullPath);
        files.push({
          name: entry.name,
          size: stats.size,
          mimeType: "application/octet-stream",
          uploadedAt: stats.birthtime,
          url: this.getUrl(relativePath),
        });
      } else if (entry.isDirectory()) {
        const subFiles = await this.list(relativePath);
        files.push(...subFiles);
      }
    }

    return files;
  }

  async exists(key: string): Promise<boolean> {
    const filePath = join(this.basePath, key);
    return existsSync(filePath);
  }
}

// S3 File Storage (Stub)

export class S3FileStorage implements FileStorageProvider {
  private bucketName: string;
  private region: string;
  private baseUrl: string;

  constructor(bucketName: string, region: string = "us-east-1", baseUrl?: string) {
    this.bucketName = bucketName;
    this.region = region;
    this.baseUrl = baseUrl || `https://${bucketName}.s3.${region}.amazonaws.com`;
  }

  async upload(_key: string, _data: Buffer | Readable, _mimeType: string): Promise<FileMetadata> {
    throw new Error("S3FileStorage not yet implemented. Install aws-sdk and configure credentials.");
  }

  async download(_key: string): Promise<Buffer> {
    throw new Error("S3FileStorage not yet implemented. Install aws-sdk and configure credentials.");
  }

  async delete(_key: string): Promise<void> {
    throw new Error("S3FileStorage not yet implemented. Install aws-sdk and configure credentials.");
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async list(_prefix?: string): Promise<FileMetadata[]> {
    throw new Error("S3FileStorage not yet implemented. Install aws-sdk and configure credentials.");
  }

  async exists(_key: string): Promise<boolean> {
    throw new Error("S3FileStorage not yet implemented. Install aws-sdk and configure credentials.");
  }
}

// Storage Factory

export type StorageType = "local" | "s3";

export interface StorageConfig {
  type: StorageType;
  local?: {
    basePath: string;
    baseUrl: string;
  };
  s3?: {
    bucketName: string;
    region: string;
    baseUrl?: string;
  };
}

export function createFileStorage(config: StorageConfig): FileStorageProvider {
  if (config.type === "s3") {
    if (!config.s3) {
      throw new Error("S3 config required when type is 's3'");
    }

    return new S3FileStorage(config.s3.bucketName, config.s3.region, config.s3.baseUrl);
  }

  const localConfig = config.local || { basePath: "./uploads", baseUrl: "/uploads" };
  return new LocalFileStorage(localConfig.basePath, localConfig.baseUrl);
}
