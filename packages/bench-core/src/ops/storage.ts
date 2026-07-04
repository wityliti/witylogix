import type { Readable } from "node:stream";
import type { BenchConfigStorage } from "../config.js";

export interface StorageObject {
  size: number;
  contentType?: string;
  lastModified?: Date;
}

export interface StorageClient {
  get(key: string): Promise<Readable>;
  put(
    key: string,
    body: Readable | Buffer,
    meta?: { contentType?: string },
  ): Promise<void>;
  head(key: string): Promise<StorageObject | null>;
  exists(key: string): Promise<boolean>;
}

export async function createStorageClient(
  config: BenchConfigStorage,
): Promise<StorageClient> {
  switch (config.backend) {
    case "local": {
      const { LocalStorageClient } = await import("./storage-local.js");
      if (!config.path) {
        throw new Error("storage.path is required when backend=local");
      }
      return new LocalStorageClient(config.path);
    }
    case "s3":
    case "r2": {
      const { S3StorageClient } = await import("./storage-s3.js");
      return new S3StorageClient(config);
    }
    case "gcs":
      throw new Error("GCS storage backend is planned for Phase 1c");
    default:
      throw new Error(
        `Unknown storage backend: ${(config as { backend: string }).backend}`,
      );
  }
}
