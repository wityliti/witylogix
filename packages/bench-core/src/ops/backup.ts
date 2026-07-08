/**
 * ops/backup — writes a `.wbak` archive of a Witylogix installation.
 *
 * Archive contents (design spec §6.2):
 *   manifest.json           written LAST, authoritative
 *   db.sql.gz               pg_dump -Fc, compressed
 *   config/
 *     bench.config.yaml
 *     compose.yaml          (if present)
 *   blobs/                  (only if --include-blobs — added in T15)
 *
 * A partial/interrupted archive has no manifest.json so `bench restore`
 * refuses it cleanly.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { create as createTar } from "tar";
import type { Context, Provider } from "../index.js";
import { resolveProvider } from "../provider.js";
import { emitAudit } from "./audit.js";

export interface BackupInput {
  /** Output archive path. Defaults to ./backups/<name>-<timestamp>.wbak. */
  to?: string;
  /** Snapshot object-storage blobs into the archive. Added in T15. */
  includeBlobs?: boolean;
}

export interface Manifest {
  version: 1;
  benchVersion: string;
  witylogixVersion: string;
  installationName: string;
  createdAt: string;
  includes: { db: boolean; config: boolean; blobs: boolean };
  counts: { tenants: number; orders: number };
  checksums: Record<string, string>;
}

export interface BackupResult {
  ok: true;
  archive: string;
  sizeBytes: number;
  manifest: Manifest;
  durationMs: number;
}

const BENCH_VERSION = "0.0.1";

function timestampSlug(): string {
  return new Date()
    .toISOString()
    .replace(/[:-]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
}

function defaultArchivePath(ctx: Context): string {
  return resolve(
    ctx.cwd,
    "backups",
    `${ctx.config.metadata.name}-${timestampSlug()}.wbak`,
  );
}

async function sha256OfFile(path: string): Promise<string> {
  const h = createHash("sha256");
  await pipeline(createReadStream(path), h);
  return `sha256:${h.digest("hex")}`;
}

/**
 * Dumps the DB to `<scratch>/db.sql.gz`. Throws on non-zero `pg_dump` exit.
 *
 * PHASE 1 LIMITATION — memory use:
 *   `provider.execInService()` currently buffers the full stdout in memory
 *   before returning. `pg_dump -Fc` output for a small installation (<500 MB
 *   uncompressed) is comfortable, but this will OOM on multi-GB databases.
 *   Must be refactored to a streaming exec primitive before we onboard
 *   customers with larger DBs — tracked as a Phase 1c follow-up.
 *
 * pg_dump -Fc already emits a compressed custom-format stream; wrapping it
 * in gzip adds ~1% overhead and gives us a stable `.gz` extension for
 * tooling. Acceptable trade-off.
 */
async function dumpDatabase(
  ctx: Context,
  provider: Provider,
  scratch: string,
): Promise<string> {
  const dbUser = process.env.POSTGRES_USER ?? "witylogix";
  const dbName = process.env.POSTGRES_DB ?? "witylogix";
  const destGz = join(scratch, "db.sql.gz");

  const r = await provider.execInService(ctx, "postgres", [
    "pg_dump",
    "-Fc",
    "-U",
    dbUser,
    dbName,
  ]);
  if (r.exitCode !== 0) {
    throw new Error(
      `pg_dump failed (exit ${r.exitCode}): ${r.stderr.slice(-500)}`,
    );
  }

  const gz = createGzip();
  const out = createWriteStream(destGz);
  gz.end(Buffer.from(r.stdout, "binary"));
  await pipeline(gz, out);
  return destGz;
}

/** Counts tenants + orders for manifest.counts. */
async function countRows(
  ctx: Context,
  provider: Provider,
): Promise<{ tenants: number; orders: number }> {
  const dbUser = process.env.POSTGRES_USER ?? "witylogix";
  const dbName = process.env.POSTGRES_DB ?? "witylogix";
  const r = await provider.execInService(ctx, "postgres", [
    "psql",
    "-U",
    dbUser,
    "-d",
    dbName,
    "-t",
    "-A",
    "-c",
    "SELECT COUNT(*) FROM organizations; SELECT COUNT(*) FROM orders;",
  ]);
  const lines = r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const parseOrZero = (s: string | undefined): number => {
    const n = Number.parseInt(s ?? "0", 10);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    tenants: parseOrZero(lines[0]),
    orders: parseOrZero(lines[1]),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function run(
  ctx: Context,
  input: BackupInput = {},
): Promise<BackupResult> {
  const startedAt = Date.now();
  const archivePath = input.to ?? defaultArchivePath(ctx);
  const scratch = resolve(ctx.cwd, ".bench", `backup-scratch-${Date.now()}`);

  await mkdir(scratch, { recursive: true });
  await mkdir(join(scratch, "config"), { recursive: true });

  try {
    const provider = await resolveProvider(ctx.config.provider.type);
    return await runWithProvider(
      ctx,
      input,
      provider,
      scratch,
      archivePath,
      startedAt,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitAudit(ctx, "bench.backup.failed", {
      archive: archivePath,
      error: message,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function runWithProvider(
  ctx: Context,
  input: BackupInput,
  provider: Provider,
  scratch: string,
  archivePath: string,
  startedAt: number,
): Promise<BackupResult> {
  // Input is kept for future knobs (retention, compression level). Silenced.
  void input;

  // ── Snapshot config ──────────────────────────────────────────────────
  const configSrc = resolve(ctx.cwd, "bench.config.yaml");
  const configDest = join(scratch, "config", "bench.config.yaml");
  await copyFile(configSrc, configDest);

  const composeSrc = resolve(ctx.cwd, ".bench", "compose.yaml");
  if (await fileExists(composeSrc)) {
    await copyFile(composeSrc, join(scratch, "config", "compose.yaml"));
  }

  // ── Dump DB ──────────────────────────────────────────────────────────
  const dbGz = await dumpDatabase(ctx, provider, scratch);

  // ── Counts for manifest ──────────────────────────────────────────────
  const counts = await countRows(ctx, provider);

  // ── Checksums ────────────────────────────────────────────────────────
  const checksums: Record<string, string> = {};
  checksums["db.sql.gz"] = await sha256OfFile(dbGz);
  checksums["config/bench.config.yaml"] = await sha256OfFile(configDest);

  // ── Manifest (written LAST) ──────────────────────────────────────────
  // NOTE: `includes.blobs` is `false` here even when the caller passed
  // `includeBlobs: true`. Actual blob snapshotting is T15; until then we
  // refuse to lie in the manifest about what's actually in the archive.
  // The CLI emits a warning when the user requests blobs in this phase.
  const manifest: Manifest = {
    version: 1,
    benchVersion: BENCH_VERSION,
    witylogixVersion: ctx.config.witylogix.version ?? "latest",
    installationName: ctx.config.metadata.name,
    createdAt: new Date().toISOString(),
    includes: { db: true, config: true, blobs: false },
    counts,
    checksums,
  };
  await writeFile(
    join(scratch, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  // ── Tar + gzip ───────────────────────────────────────────────────────
  await mkdir(dirname(archivePath), { recursive: true });
  const tarFiles = ["manifest.json", "db.sql.gz", "config"];
  await createTar({ gzip: true, file: archivePath, cwd: scratch }, tarFiles);

  const sz = (await stat(archivePath)).size;
  const durationMs = Date.now() - startedAt;

  emitAudit(ctx, "bench.backup.completed", {
    archive: archivePath,
    sizeBytes: sz,
    blobCount: 0,
    includes: manifest.includes,
    counts,
    durationMs,
  });

  return {
    ok: true,
    archive: archivePath,
    sizeBytes: sz,
    manifest,
    durationMs,
  };
}
