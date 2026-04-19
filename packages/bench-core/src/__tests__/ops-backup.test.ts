import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extract as extractTar } from "tar";
import { registerProvider, type Provider } from "../provider.js";
import { run as runBackup } from "../ops/backup.js";
import type { Context } from "../types.js";

let tmp: string;

const execMock = vi.fn();

const fakeProvider: Provider = {
  id: "fake",
  preflight: async () => ({ ok: true, checks: [] }),
  provision: async () => ({ ok: true, operationsApplied: 0 }),
  deploy: async () => ({ ok: true, version: "0", rolledBack: false }),
  start: async () => {},
  stop: async () => {},
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
  runOneShot: vi
    .fn()
    .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
};
registerProvider("backup-test-provider", async () => fakeProvider);

function ctxOf(): Context {
  return {
    cwd: tmp,
    config: {
      metadata: { name: "demo" },
      provider: { type: "backup-test-provider" as never, config: {} },
      witylogix: { version: "4.0.0", channel: "stable" },
    } as unknown as Context["config"],
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    dryRun: false,
    json: false,
  };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-backup-"));
  mkdirSync(join(tmp, ".bench"), { recursive: true });
  writeFileSync(
    join(tmp, "bench.config.yaml"),
    "apiVersion: bench.witylogix.io/v1\nkind: Installation\nmetadata:\n  name: demo\nprovider:\n  type: docker-compose\n",
  );
  writeFileSync(join(tmp, ".bench", "compose.yaml"), "services: {}\n");
  execMock.mockReset();
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

/** Default psql + pg_dump mock: tenants=7, orders=123, fake pg_dump bytes. */
function wireDefaultDb() {
  execMock.mockImplementation(async (_ctx, _svc, cmd: string[]) => {
    if (cmd[0] === "pg_dump") {
      return { stdout: "PGDUMP_BYTES", stderr: "", exitCode: 0 };
    }
    if (cmd[0] === "psql") {
      return { stdout: "7\n123\n", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  });
}

async function readArchive(archivePath: string) {
  const extractDir = mkdtempSync(join(tmpdir(), "wbak-inspect-"));
  try {
    await extractTar({ file: archivePath, cwd: extractDir });
    return {
      manifest: JSON.parse(
        readFileSync(join(extractDir, "manifest.json"), "utf8"),
      ),
      hasDb: existsSync(join(extractDir, "db.sql.gz")),
      hasConfig: existsSync(
        join(extractDir, "config", "bench.config.yaml"),
      ),
      hasCompose: existsSync(join(extractDir, "config", "compose.yaml")),
      dir: extractDir,
    };
  } finally {
    // leave extract dir; caller may need to inspect files further
  }
}

describe("ops/backup.run", () => {
  it("produces a well-formed .wbak with manifest/db/config", async () => {
    wireDefaultDb();
    const out = join(tmp, "out.wbak");
    const r = await runBackup(ctxOf(), { to: out });
    expect(r.ok).toBe(true);
    expect(r.sizeBytes).toBeGreaterThan(0);
    expect(existsSync(out)).toBe(true);

    const arch = await readArchive(out);
    expect(arch.manifest.version).toBe(1);
    expect(arch.manifest.counts).toEqual({ tenants: 7, orders: 123 });
    expect(arch.manifest.includes).toEqual({
      db: true,
      config: true,
      blobs: false,
    });
    expect(arch.manifest.checksums["db.sql.gz"]).toMatch(/^sha256:/);
    expect(arch.hasDb).toBe(true);
    expect(arch.hasConfig).toBe(true);
    expect(arch.hasCompose).toBe(true);
  });

  it("writes a bench.backup.completed audit event", async () => {
    wireDefaultDb();
    await runBackup(ctxOf(), { to: join(tmp, "out.wbak") });
    const auditLines = readFileSync(join(tmp, "bench.audit.log"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const event = auditLines.find(
      (e) => e.event === "bench.backup.completed",
    );
    expect(event).toBeDefined();
    expect(event.data.sizeBytes).toBeGreaterThan(0);
  });

  it("throws cleanly if pg_dump fails", async () => {
    execMock.mockResolvedValueOnce({
      stdout: "",
      stderr: "could not connect",
      exitCode: 1,
    });
    await expect(
      runBackup(ctxOf(), { to: join(tmp, "fail.wbak") }),
    ).rejects.toThrow(/pg_dump failed/);
    // Archive should NOT exist on failure
    expect(existsSync(join(tmp, "fail.wbak"))).toBe(false);
  });

  it("emits bench.backup.failed audit event on failure", async () => {
    execMock.mockResolvedValueOnce({
      stdout: "",
      stderr: "boom",
      exitCode: 2,
    });
    await expect(
      runBackup(ctxOf(), { to: join(tmp, "x.wbak") }),
    ).rejects.toThrow();
    const auditLines = readFileSync(join(tmp, "bench.audit.log"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const event = auditLines.find((e) => e.event === "bench.backup.failed");
    expect(event).toBeDefined();
    expect(event.data.error).toContain("pg_dump failed");
  });

  it("includeBlobs=true still records blobs=false in manifest (T15 stub)", async () => {
    wireDefaultDb();
    const r = await runBackup(ctxOf(), {
      to: join(tmp, "out.wbak"),
      includeBlobs: true,
    });
    expect(r.manifest.includes.blobs).toBe(false);
  });

  it("cleans up scratch directory on success", async () => {
    wireDefaultDb();
    await runBackup(ctxOf(), { to: join(tmp, "out.wbak") });
    // No scratch dirs left in .bench
    const benchEntries = readFileSync(join(tmp, ".bench", "compose.yaml"), "utf8");
    expect(benchEntries).toBeTruthy();
    // Find scratch — should be zero
    const { readdirSync } = await import("node:fs");
    const entries = readdirSync(join(tmp, ".bench"));
    const leftover = entries.filter((e) => e.startsWith("backup-scratch-"));
    expect(leftover).toEqual([]);
  });

  it("cleans up scratch directory on failure", async () => {
    execMock.mockResolvedValueOnce({
      stdout: "",
      stderr: "db unreachable",
      exitCode: 2,
    });
    await expect(
      runBackup(ctxOf(), { to: join(tmp, "fail.wbak") }),
    ).rejects.toThrow();
    const { readdirSync } = await import("node:fs");
    const entries = readdirSync(join(tmp, ".bench"));
    const leftover = entries.filter((e) => e.startsWith("backup-scratch-"));
    expect(leftover).toEqual([]);
  });

  it("default archive path lives under <cwd>/backups/ with timestamp slug", async () => {
    wireDefaultDb();
    const r = await runBackup(ctxOf(), {});
    expect(r.archive).toContain(join(tmp, "backups"));
    expect(r.archive).toMatch(/demo-\d{8}-\d{6}\.wbak$/);
    expect(existsSync(r.archive)).toBe(true);
  });

  it("manifest.installationName + witylogixVersion come from ctx.config", async () => {
    wireDefaultDb();
    const r = await runBackup(ctxOf(), { to: join(tmp, "o.wbak") });
    expect(r.manifest.installationName).toBe("demo");
    expect(r.manifest.witylogixVersion).toBe("4.0.0");
  });

  it("omits compose.yaml from archive when not present", async () => {
    wireDefaultDb();
    rmSync(join(tmp, ".bench", "compose.yaml"));
    const out = join(tmp, "no-compose.wbak");
    await runBackup(ctxOf(), { to: out });
    const arch = await readArchive(out);
    expect(arch.hasCompose).toBe(false);
    expect(arch.hasConfig).toBe(true);
  });
});
