import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { LocalStorageClient } from "../ops/storage-local.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "storage-local-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function streamToString(s: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of s) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString("utf8");
}

describe("LocalStorageClient", () => {
  it("put + get round-trip", async () => {
    const c = new LocalStorageClient(tmp);
    await c.put("a/b/c.txt", Buffer.from("hello"));
    const s = await c.get("a/b/c.txt");
    expect(await streamToString(s)).toBe("hello");
  });

  it("head returns metadata for existing object", async () => {
    const c = new LocalStorageClient(tmp);
    await c.put("x.txt", Buffer.from("12345"));
    const h = await c.head("x.txt");
    expect(h?.size).toBe(5);
  });

  it("head returns null for missing object", async () => {
    const c = new LocalStorageClient(tmp);
    expect(await c.head("missing")).toBeNull();
  });

  it("rejects path traversal", async () => {
    const c = new LocalStorageClient(tmp);
    await c.put("../escape.txt", Buffer.from("nope"));
    // sanitized — the file ends up inside rootPath, not outside
    expect(await c.exists("escape.txt")).toBe(true);
  });
});
