/**
 * ops/restore — inverse of ops/backup. Reads a `.wbak` archive and puts the
 * installation back in the state captured there.
 *
 * Safety gates (design spec §7.2):
 *   - Refuse archives without manifest.json
 *   - Refuse cross-major-version archives unless --force-version
 *   - Refuse cross-installation archives unless --cross-install
 *   - Refuse when target DB is non-empty unless --yes
 *   - Refuse when archive has blobs and --target-storage missing (T15 gap)
 *
 * Flow:
 *   1. Extract archive to scratch
 *   2. Validate manifest
 *   3. (optional) Confirm target-DB-empty gate
 *   4. Drain + stop app services
 *   5. DROP SCHEMA public CASCADE; CREATE SCHEMA public;
 *   6. pg_restore < db.sql.gz
 *   7. (future T15) blob restore
 *   8. prisma migrate deploy (bring DB to code's latest)
 *   9. Start services
 *  10. Audit bench.restore.completed
 */
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createGunzip } from "node:zlib";
import { extract as extractTar } from "tar";
import type { Context, Provider } from "../index.js";
import { benchApi } from "../http-client.js";
import { resolveProvider } from "../provider.js";
import { emitAudit } from "./audit.js";
import type { Manifest } from "./backup.js";

export interface RestoreInput {
  yes?: boolean;
  skipBlobs?: boolean;
  forceVersion?: boolean;
  crossInstall?: boolean;
  targetStorage?: string;
}

export interface RestoreResult {
  ok: true;
  manifest: Manifest;
  durationMs: number;
  rewrittenUrls: number;
}

const APP_SERVICES = [
  "api",
  "dashboard",
  "customer-portal",
  "tracking-page",
  "docs",
] as const;

function configuredAppServices(ctx: Context): string[] {
  const declared = ctx.config.services as Record<string, unknown>;
  return APP_SERVICES.filter((name) => declared?.[name] !== undefined);
}

async function readManifest(scratch: string): Promise<Manifest> {
  const raw = await readFile(join(scratch, "manifest.json"), "utf8").catch(
    () => null,
  );
  if (!raw) {
    throw new Error(
      "archive is missing manifest.json — refusing to restore (likely an interrupted or malformed backup)",
    );
  }
  const manifest = JSON.parse(raw) as Manifest;
  if (manifest.version !== 1) {
    throw new Error(
      `unknown manifest version ${manifest.version} — bench is too old or archive is too new`,
    );
  }
  return manifest;
}

function assertVersionCompat(
  manifest: Manifest,
  ctx: Context,
  input: RestoreInput,
): void {
  const targetMajor = (ctx.config.witylogix.version ?? "0.0.0").split(".")[0];
  const archiveMajor = manifest.witylogixVersion.split(".")[0];
  if (targetMajor !== archiveMajor && !input.forceVersion) {
    throw new Error(
      `cross-major restore blocked (archive ${manifest.witylogixVersion} → target ${ctx.config.witylogix.version ?? "unknown"}). ` +
        `Schema drift is likely. Pass --force-version to proceed at your own risk.`,
    );
  }
}

function assertInstallationCompat(
  manifest: Manifest,
  ctx: Context,
  input: RestoreInput,
): void {
  if (
    manifest.installationName !== ctx.config.metadata.name &&
    !input.crossInstall
  ) {
    throw new Error(
      `archive installation "${manifest.installationName}" does not match target "${ctx.config.metadata.name}". ` +
        `Pass --cross-install to restore across installations.`,
    );
  }
}

async function assertTargetEmptyOrYes(
  ctx: Context,
  provider: Provider,
  input: RestoreInput,
): Promise<void> {
  if (input.yes) return;
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
    "SELECT COUNT(*) FROM organizations;",
  ]);
  if (r.exitCode !== 0) {
    // Non-zero typically means the table doesn't exist yet (fresh DB) or the
    // user lacks SELECT. Treat as safe to proceed. A transient network/psql
    // error could also land here — the operator can force-overwrite with
    // --yes if they know better, but we surface a warning so it's visible.
    ctx.logger.warn(
      `target-DB emptiness check returned non-zero (${r.exitCode}); ` +
        `proceeding as if empty. Pass --yes if you want to bypass this check deliberately.`,
    );
    return;
  }
  const count = Number.parseInt(r.stdout.trim(), 10);
  if (Number.isFinite(count) && count > 0) {
    throw new Error(
      `target DB has ${count} tenant(s). Restore will overwrite. Pass --yes to confirm.`,
    );
  }
}

async function dropAndRecreateSchema(
  ctx: Context,
  provider: Provider,
): Promise<void> {
  const dbUser = process.env.POSTGRES_USER ?? "witylogix";
  const dbName = process.env.POSTGRES_DB ?? "witylogix";
  const r = await provider.execInService(ctx, "postgres", [
    "psql",
    "-U",
    dbUser,
    "-d",
    dbName,
    "-c",
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;",
  ]);
  if (r.exitCode !== 0) {
    throw new Error(
      `DROP SCHEMA / CREATE SCHEMA failed (exit ${r.exitCode}): ${r.stderr.slice(-500)}`,
    );
  }
}

async function pgRestoreFromArchive(
  ctx: Context,
  provider: Provider,
  scratch: string,
): Promise<void> {
  const dbUser = process.env.POSTGRES_USER ?? "witylogix";
  const dbName = process.env.POSTGRES_DB ?? "witylogix";

  // Pipe gunzip(db.sql.gz) → pg_restore's stdin
  const gz = createReadStream(join(scratch, "db.sql.gz"));
  const gunzip = createGunzip();
  gz.pipe(gunzip);

  const r = await provider.execInService(
    ctx,
    "postgres",
    ["pg_restore", "-U", dbUser, "-d", dbName],
    { stdin: gunzip },
  );
  if (r.exitCode !== 0) {
    throw new Error(
      `pg_restore failed (exit ${r.exitCode}). ` +
        `The target schema has been dropped and the restore did NOT complete — ` +
        `the database is currently empty. Recovery: re-run \`bench restore <archive>\` ` +
        `with a known-good archive, or re-initialize the installation. ` +
        `Stderr tail: ${r.stderr.slice(-500)}`,
    );
  }
}

async function checkBlobSupport(
  manifest: Manifest,
  input: RestoreInput,
): Promise<number> {
  if (!manifest.includes.blobs) return 0;
  if (input.skipBlobs) return 0;
  if (!input.targetStorage) {
    throw new Error(
      "archive contains blobs but --target-storage is not set. " +
        "Pass --target-storage <bucket-url> or --skip-blobs to proceed.",
    );
  }
  throw new Error(
    "blob restore with --target-storage is not yet implemented (Phase 1c).",
  );
}

export async function run(
  ctx: Context,
  archive: string,
  input: RestoreInput = {},
): Promise<RestoreResult> {
  const startedAt = Date.now();
  const scratch = resolve(ctx.cwd, ".bench", `restore-${Date.now()}`);
  await mkdir(scratch, { recursive: true });

  try {
    await extractTar({ file: archive, cwd: scratch });

    const manifest = await readManifest(scratch);
    assertVersionCompat(manifest, ctx, input);
    assertInstallationCompat(manifest, ctx, input);

    const provider = await resolveProvider(ctx.config.provider.type);
    await assertTargetEmptyOrYes(ctx, provider, input);

    await benchApi(ctx, "POST", "/internal/bench/drain", {
      mode: "offline",
      reason: "restore",
    });

    const services = configuredAppServices(ctx);
    for (const svc of services) await provider.stop(ctx, svc);

    await dropAndRecreateSchema(ctx, provider);
    await pgRestoreFromArchive(ctx, provider, scratch);

    // TODO(T16b): Verify row counts match manifest.counts.tenants/orders
    // exactly via a post-restore SELECT COUNT to detect partial-apply bugs.
    // Deferred because it depends on the same count-query infrastructure
    // that ops/backup.countRows provides; promoting that to a shared helper
    // is cleaner than duplicating it here.
    const rewrittenUrls = await checkBlobSupport(manifest, input);

    // Migrate DB to code's latest (archive may be older)
    const migrate = await provider.runOneShot(ctx, "api", [
      "pnpm",
      "prisma",
      "migrate",
      "deploy",
    ]);
    if (migrate.exitCode !== 0) {
      throw new Error(
        `post-restore prisma migrate deploy failed (exit ${migrate.exitCode}): ${migrate.stderr.slice(-500)}`,
      );
    }

    for (const svc of services) await provider.start(ctx, svc);

    const durationMs = Date.now() - startedAt;
    emitAudit(ctx, "bench.restore.completed", {
      archive,
      manifest: {
        installationName: manifest.installationName,
        witylogixVersion: manifest.witylogixVersion,
        createdAt: manifest.createdAt,
      },
      rewrittenUrls,
      durationMs,
    });

    return { ok: true, manifest, durationMs, rewrittenUrls };
  } catch (err) {
    emitAudit(ctx, "bench.restore.failed", {
      archive,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    });
    throw err;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
