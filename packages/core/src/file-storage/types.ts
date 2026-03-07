// @ts-nocheck

/**
 * File Storage Provider Types and Interfaces
 * 
 * Defines the contract for file storage implementations.
 * Supports both cloud (S3) and local filesystem backends.
 */

export interface UploadOptions {
  contentType?: string;
  contentDisposition?: string;
  metadata?: Record<string, string>;
  acl?: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  url: string;
  lastModified?: Date;
}

export interface ListFilesResult {
  files: FileMetadata[];
  nextToken?: string;
}

export interface FileStorageProvider {
  /**
   * Upload a file to storage
   */
  upload(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    options?: UploadOptions
  ): Promise<FileMetadata>;

  /**
   * Download a file from storage
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Get the URL for a file
   */
  getUrl(key: string): string;

  /**
   * Get a signed URL that expires after a certain time
   */
  getSignedUrl(key: string, expiresIn: number): Promise<string>;

  /**
   * List files with optional prefix
   */
  listFiles(prefix?: string, token?: string): Promise<ListFilesResult>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;
}

export interface StorageConfig {
  type: 'local' | 's3';
  tenantId?: string;
  local?: {
    basePath: string;
    baseUrl: string;
  };
  s3?: {
    bucketName: string;
    region: string;
    baseUrl?: string;
    accessKeyId?: string;
    secretAccessKey: string;
  };
}

export interface TenantStorageConfig {
  s3?: {
    bucketName: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface DeployerStorageConfig {
  defaultType: 's3' | 'local';
  s3?: {
    bucketName: string;
    region: string;
    baseUrl?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  local?: {
    basePath: string;
    baseUrl: string;
  };
}
