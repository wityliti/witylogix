import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create as createTar } from "tar";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { registerProvider, type Provider } from "../provider.js";
import { run as runRestore } from "../ops/restore.js";
import type { Context } from "../types.js";
import type { Manifest } from "../ops/backup.js";

let tmp: string;

const execMock = vi.fn();
const runOneShotMock = vi.fn();
const stopMock = vi.fn().mockResolvedValue(undefined);
const startMock = vi.fn().mockResolvedValue(undefined);

const fakeProvider: Provider = {
  id: "fake",
  preflight: async () => ({ ok: true, checks: [] }),
  provision: async () => ({ ok: true, operationsApplied: 0 }),
  deploy: async () => ({ ok: true, version: "0", rolledBack: false }),
  start: startMock,
  stop: stopMock,
  restart: async () => {},
  async *logs() {},
  status: async () => ({ services: [] }),
  backup: async () => {
    throw new Error();
  },
  restore: async () => {
    throw new Error();
  },
  rotateSecret: async () => {},
  destroy: async () => {},
  execInService: execMock,
  runOneShot: runOneShotMock,
};
registerProvider("restore-test-provider", async () => fakeProvider);

function ctxOf(overrides: Partial<Context["config"]> = {}): Context {
  return {
    cwd: tmp,
    config: {
      metadata: { name: "demo" },
      provider: { type: "restore-test-provider" as never, config: {} },
      witylogix: { version: "4.0.0", channel: "stable" },
      services: { api: {}, dashboard: {} },
      ...overrides,
    } as unknown as Context["config"],
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    dryRun: false,
    json: false,
  };
}

async function makeArchive(
  manifestOverride: Partial<Manifest> = {},
): Promise<string> {
  const scratch = mkdtempSync(join(tmpdir(), "wbak-make-"));
  try {
    const manifest: Manifest = {
      version: 1,
      benchVersion: "0.0.1",
      witylogixVersion: "4.0.0",
      installationName: "demo",
      createdAt: new Date().toISOString(),
      includes: { db: true, config: true, blobs: false },
      counts: { tenants: 1, orders: 2 },
      checksums: {},
      ...manifestOverride,
    };
    writeFileSync(
      join(scratch, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    // gzip a fake pg_dump payload so createGunzip doesn't blow up during restore
    await pipeline(
      Readable.from(Buffer.from("fake-pgdump-bytes")),
      createGzip(),
      createWriteStream(join(scratch, "db.sql.gz")),
    );
    mkdirSync(join(scratch, "config"));
    writeFileSync(join(scratch, "config", "bench.config.yaml"), "demo\n");
    const out = join(tmp, `a-${Date.now()}.wbak`);
    await createTar(
      { gzip: true, file: out, cwd: scratch },
      ["manifest.json", "db.sql.gz", "config"],
    );
    return out;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-restore-"));
  mkdirSync(join(tmp, ".bench"), { recursive: true });
  writeFileSync(join(tmp, "bench.config.yaml"), "demo\n");
  process.env.BENCH_SERVICE_TOKEN = "t";
  process.env.BENCH_API_BASE_URL = "http://api.test";
  execMock.mockReset();
  runOneShotMock.mockReset();
  stopMock.mockClear();
  startMock.mockClear();

  // Default exec + runOneShot to success
  execMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
  runOneShotMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }),
  );
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  delete process.env.BENCH_SERVICE_TOKEN;
  delete process.env.BENCH_API_BASE_URL;
  vi.unstubAllGlobals();
});

describe("ops/restore safety gates", () => {
  it("refuses an archive with no manifest.json", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "bad-"));
    writeFileSync(join(scratch, "db.sql.gz"), "x");
    const out = join(tmp, "bad.wbak");
    await createTar({ gzip: true, file: out, cwd: scratch }, ["db.sql.gz"]);
    rmSync(scratch, { recursive: true, force: true });

    await expect(runRestore(ctxOf(), out)).rejects.toThrow(/missing manifest/);
  });

  it("refuses an unknown manifest version", async () => {
    const archive = await makeArchive({ version: 99 as never });
    await expect(runRestore(ctxOf(), archive)).rejects.toThrow(
      /unknown manifest version/,
    );
  });

  it("refuses cross-major restore without --force-version", async () => {
    const archive = await makeArchive({ witylogixVersion: "3.9.0" });
    await expect(runRestore(ctxOf(), archive)).rejects.toThrow(
      /cross-major restore blocked/,
    );
  });

  it("allows cross-major restore with --force-version", async () => {
    const archive = await makeArchive({ witylogixVersion: "3.9.0" });
    const r = await runRestore(ctxOf(), archive, {
      yes: true,
      forceVersion: true,
    });
    expect(r.ok).toBe(true);
  });

  it("refuses cross-installation restore without --cross-install", async () => {
    const archive = await makeArchive({ installationName: "other" });
    await expect(runRestore(ctxOf(), archive)).rejects.toThrow(
      /does not match target/,
    );
  });

  it("refuses when target DB is non-empty and --yes not set", async () => {
    // First execInService call is the organizations count — return >0
    execMock.mockResolvedValueOnce({
      stdout: "5\n",
      stderr: "",
      exitCode: 0,
    });
    // Subsequent calls default-succeed
    const archive = await makeArchive();
    await expect(runRestore(ctxOf(), archive)).rejects.toThrow(
      /target DB has \d+ tenant/,
    );
  });

  it("refuses when archive has blobs but --target-storage missing", async () => {
    const archive = await makeArchive({
      includes: { db: true, config: true, blobs: true },
    });
    await expect(
      runRestore(ctxOf(), archive, { yes: true }),
    ).rejects.toThrow(/target-storage/);
  });

  it("honors --skip-blobs when archive has blobs", async () => {
    const archive = await makeArchive({
      includes: { db: true, config: true, blobs: true },
    });
    const r = await runRestore(ctxOf(), archive, {
      yes: true,
      skipBlobs: true,
    });
    expect(r.ok).toBe(true);
    expect(r.rewrittenUrls).toBe(0);
  });
});

describe("ops/restore flow", () => {
  it("stops declared services, drops schema, restores, migrates, starts", async () => {
    const archive = await makeArchive();
    await runRestore(ctxOf(), archive, { yes: true });

    expect(stopMock).toHaveBeenCalledTimes(2);
    expect(startMock).toHaveBeenCalledTimes(2);
    expect(runOneShotMock).toHaveBeenCalledWith(
      expect.anything(),
      "api",
      ["pnpm", "prisma", "migrate", "deploy"],
    );
    // One exec call should contain DROP SCHEMA
    const dropCall = execMock.mock.calls.find((c) =>
      c[2].some(
        (arg: string) => typeof arg === "string" && arg.includes("DROP SCHEMA"),
      ),
    );
    expect(dropCall).toBeDefined();
    // One exec call should be pg_restore
    const restoreCall = execMock.mock.calls.find((c) => c[2][0] === "pg_restore");
    expect(restoreCall).toBeDefined();
  });

  it("emits bench.restore.completed audit event on success", async () => {
    const archive = await makeArchive();
    await runRestore(ctxOf(), archive, { yes: true });
    const auditLines = readFileSync(join(tmp, "bench.audit.log"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const event = auditLines.find(
      (e) => e.event === "bench.restore.completed",
    );
    expect(event).toBeDefined();
    expect(event.data.manifest.installationName).toBe("demo");
  });

  it("emits bench.restore.failed audit event when pg_restore fails", async () => {
    // With yes:true the count check is skipped, so the mock sequence is:
    //   1. DROP SCHEMA — success
    //   2. pg_restore  — failure
    execMock
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "bad archive",
        exitCode: 1,
      });
    const archive = await makeArchive();
    await expect(runRestore(ctxOf(), archive, { yes: true })).rejects.toThrow(
      /pg_restore failed/,
    );

    const auditLines = readFileSync(join(tmp, "bench.audit.log"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(auditLines.some((e) => e.event === "bench.restore.failed")).toBe(true);
  });
});
