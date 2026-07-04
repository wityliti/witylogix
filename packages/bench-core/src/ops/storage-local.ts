import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { Readable as NodeReadable } from "node:stream";
import type { StorageClient, StorageObject } from "./storage.js";

export class LocalStorageClient implements StorageClient {
  constructor(private readonly rootPath: string) {}

  private absolutePath(key: string): string {
    const sanitized = key.replace(/^\/+/, "").replace(/\.\.\//g, "");
    return resolve(this.rootPath, sanitized);
  }

  async get(key: string): Promise<Readable> {
    return createReadStream(this.absolutePath(key));
  }

  async put(
    key: string,
    body: Readable | Buffer,
    _meta?: { contentType?: string },
  ): Promise<void> {
    const path = this.absolutePath(key);
    await mkdir(dirname(path), { recursive: true });
    const stream = Buffer.isBuffer(body) ? NodeReadable.from(body) : body;
    await pipeline(stream, createWriteStream(path));
  }

  async head(key: string): Promise<StorageObject | null> {
    try {
      const st = await stat(this.absolutePath(key));
      return { size: st.size, lastModified: st.mtime };
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.head(key)) !== null;
  }
}
