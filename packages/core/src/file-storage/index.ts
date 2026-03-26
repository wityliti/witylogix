// @ts-nocheck

/**
 * File storage abstraction layer.
 *
 * Features:
 * - FileStorage interface: upload, download, delete, getUrl, list
 * - LocalFileStorage implementation (local disk)
 * - S3FileStorage implementation (real AWS S3)
 * - Provider factory: auto-detect based on configuration
 * - Multi-tenant support with BYOK pattern
 * - File metadata: name, size, mimeType, uploadedAt, url
 *
 * Usage:
 * const storage = createFileStorageProvider({ type: 'local', tenantId: 'tenant-123' });
 * const metadata = await storage.upload('file.pdf', fileBuffer);
 * const url = storage.getUrl('file.pdf');
 */

export type {
  FileStorageProvider,
  FileMetadata,
  UploadOptions,
  ListFilesResult,
  StorageConfig,
  TenantStorageConfig,
  DeployerStorageConfig,
} from './types';

export type { S3ProviderConfig } from './s3-provider';
export { S3FileStorage, resolveS3Credentials } from './s3-provider';

export type { LocalProviderConfig } from './local-provider';
export { LocalFileStorage } from './local-provider';

import type { FileStorageProvider, StorageConfig, TenantStorageConfig, DeployerStorageConfig } from './types';
import { S3FileStorage, resolveS3Credentials } from './s3-provider';
import type { S3ProviderConfig } from './s3-provider';
import { LocalFileStorage } from './local-provider';
import type { LocalProviderConfig } from './local-provider';

export interface FileStorageFactoryConfig {
  type?: 's3' | 'local';
  tenantId?: string;
  tenantConfig?: TenantStorageConfig;
  deployerConfig?: DeployerStorageConfig;
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

/**
 * Create a file storage provider with automatic detection
 * 
 * Priority:
 * 1. Explicit type if provided
 * 2. Tenant S3 credentials
 * 3. Deployer S3 credentials
 * 4. Fall back to local storage
 */
export function createFileStorageProvider(
  config: FileStorageFactoryConfig
): FileStorageProvider {
  const tenantId = config.tenantId || 'default';

  // Explicit type provided
  if (config.type === 's3') {
    if (config.s3) {
      return new S3FileStorage({
        ...config.s3,
        tenantId,
      });
    }

    // Try to resolve from tenant or deployer config
    const s3Config = resolveS3Credentials(config.tenantConfig, config.deployerConfig);
    if (s3Config) {
      return new S3FileStorage({
        ...s3Config,
        tenantId,
      });
    }

    throw new Error(
      'S3 storage type requested but no S3 credentials provided in tenant, deployer, or explicit config'
    );
  }

  // Type not explicitly set - try S3 first if credentials are available
  if (!config.type || config.type === 'local') {
    // Check tenant config
    if (config.tenantConfig?.s3) {
      return new S3FileStorage({
        bucketName: config.tenantConfig.s3.bucketName,
        region: config.tenantConfig.s3.region,
        accessKeyId: config.tenantConfig.s3.accessKeyId,
        secretAccessKey: config.tenantConfig.s3.secretAccessKey,
        tenantId,
      });
    }

    // Check deployer config
    if (config.deployerConfig?.defaultType === 's3' && config.deployerConfig.s3) {
      return new S3FileStorage({
        bucketName: config.deployerConfig.s3.bucketName,
        region: config.deployerConfig.s3.region,
        baseUrl: config.deployerConfig.s3.baseUrl,
        accessKeyId: config.deployerConfig.s3.accessKeyId || '',
        secretAccessKey: config.deployerConfig.s3.secretAccessKey || '',
        tenantId,
      });
    }
  }

  // Fall back to local storage
  const localConfig = config.local || config.deployerConfig?.local || {
    basePath: './uploads',
    baseUrl: '/uploads',
  };

  return new LocalFileStorage({
    ...localConfig,
    tenantId,
  });
}

/**
 * Create file storage from explicit configuration
 * 
 * @deprecated Use createFileStorageProvider instead
 */
export function createFileStorage(config: StorageConfig): FileStorageProvider {
  if (config.type === 's3') {
    if (!config.s3) {
      throw new Error('S3 config required when type is "s3"');
    }

    return new S3FileStorage({
      bucketName: config.s3.bucketName,
      region: config.s3.region,
      baseUrl: config.s3.baseUrl,
      accessKeyId: '',
      secretAccessKey: '',
      tenantId: config.tenantId,
    });
  }

  const localConfig = config.local || { basePath: './uploads', baseUrl: '/uploads' };
  return new LocalFileStorage({
    ...localConfig,
    tenantId: config.tenantId,
  });
}
