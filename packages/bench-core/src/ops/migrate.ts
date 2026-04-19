/**
 * ops/migrate — windowed Prisma migration orchestrator.
 *
 * Flow (design spec §4.2):
 *   1. Preflight       — API /health reachable, count pending migrations
 *   2. Drain           — POST /internal/bench/drain { mode: offline }
 *   3. Stop services   — stop app containers (keep postgres + redis)
 *   4. Migrate         — runOneShot(api, prisma migrate deploy)
 *   5. Restart services
 *   6. Post-check      — /health reports expected applied count
 *   7. Audit           — bench.migrate.completed
 *
 * Auto-backup (spec step 2) is deferred until T13 ships `ops/backup`.
 * Until then, `--skip-backup` has no effect and a warning is printed
 * advising manual backup before migration.
 *
 * Rollback guidance (spec §4.3): failures at steps 4–6 leave services
 * stopped; the error message tells the operator how to recover.
 */
import type { Context, Provider } from "../index.js";
import { benchApi } from "../http-client.js";
import { resolveProvider } from "../provider.js";
import { emitAudit } from "./audit.js";

export interface MigrateInput {
  skipBackup?: boolean;
  force?: boolean;
}

export interface MigrateResult {
  ok: boolean;
  /** true when services restarted but post-migrate health check did not recover in time. */
  degraded: boolean;
  migrationsApplied: number;
  durationMs: number;
}

/** App services eligible for stopping during the migration window. */
const CANDIDATE_APP_SERVICES = [
  "api",
  "dashboard",
  "customer-portal",
  "tracking-page",
  "docs",
] as const;

/**
 * Resolve the subset of app services actually declared in bench.config.yaml.
 * Avoids `docker compose stop docs` crashing when a user has disabled `docs`.
 */
function configuredAppServices(ctx: Context): string[] {
  const declared = ctx.config.services;
  return CANDIDATE_APP_SERVICES.filter((name) => declared[name] !== undefined);
}

/** @deprecated kept for tests — prefer {@link configuredAppServices}. */
export const APP_SERVICES = CANDIDATE_APP_SERVICES;

interface HealthResponse {
  prismaMigrations: { applied: number; pending: number };
  drained: boolean;
}

async function getHealth(ctx: Context): Promise<HealthResponse> {
  return benchApi<HealthResponse>(ctx, "GET", "/internal/bench/health");
}

async function stopAppServices(
  ctx: Context,
  provider: Provider,
  services: string[],
): Promise<void> {
  for (const svc of services) {
    await provider.stop(ctx, svc);
  }
}

async function startAppServices(
  ctx: Context,
  provider: Provider,
  services: string[],
): Promise<void> {
  for (const svc of services) {
    await provider.start(ctx, svc);
  }
}

async function pollHealth(
  ctx: Context,
  attempts: number,
  intervalMs: number,
): Promise<HealthResponse | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const h = await getHealth(ctx);
      return h;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return null;
}

export async function run(
  ctx: Context,
  input: MigrateInput = {},
): Promise<MigrateResult> {
  const startedAt = Date.now();

  // ── 1. Preflight ────────────────────────────────────────────────────────

  const pre = await getHealth(ctx);
  const beforeApplied = pre.prismaMigrations.applied;
  const pending = pre.prismaMigrations.pending;

  if (pending === 0 && !input.force) {
    ctx.logger.info("no pending migrations — use --force to re-run anyway");
    return {
      ok: true,
      degraded: false,
      migrationsApplied: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  // ── 2. Auto-backup (deferred until T13) ────────────────────────────────

  if (!input.skipBackup) {
    ctx.logger.warn(
      "auto-backup not yet wired (T13) — run `bench backup` manually before migrating in production",
    );
  }

  // ── 3. Drain ────────────────────────────────────────────────────────────

  await benchApi(ctx, "POST", "/internal/bench/drain", {
    mode: "offline",
    reason: "migrate",
  });
  ctx.logger.info("API drained (offline)");

  // ── 4. Stop app services ───────────────────────────────────────────────
  //
  // Only stop services actually declared in this installation's config, so a
  // user who has disabled `docs` doesn't trip `docker compose stop docs`.

  const provider = await resolveProvider(ctx.config.provider.type);
  const services = configuredAppServices(ctx);
  await stopAppServices(ctx, provider, services);
  ctx.logger.info(`stopped ${services.length} app service(s): ${services.join(", ")}`);

  // ── 5. Run migrations ──────────────────────────────────────────────────

  const migrateResult = await provider.runOneShot(ctx, "api", [
    "pnpm",
    "prisma",
    "migrate",
    "deploy",
  ]);

  if (migrateResult.exitCode !== 0) {
    emitAudit(ctx, "bench.migrate.failed", {
      exitCode: migrateResult.exitCode,
      stderr: migrateResult.stderr.slice(-2000),
    });
    throw new Error(
      `prisma migrate deploy failed (exit ${migrateResult.exitCode}). ` +
        `Services are stopped and the API is drained. ` +
        `Rollback options: (a) restore from a pre-migrate backup with \`bench restore <archive>\`, or ` +
        `(b) fix the schema and re-run \`bench migrate\` (drain + stop state will be reasserted). ` +
        `Stderr tail: ${migrateResult.stderr.slice(-500)}`,
    );
  }
  ctx.logger.info("prisma migrate deploy OK");

  // ── 6. Restart services ────────────────────────────────────────────────

  await startAppServices(ctx, provider, services);
  ctx.logger.info("app services restarted");

  // ── 7. Post-check ──────────────────────────────────────────────────────

  const post = await pollHealth(ctx, 15, 2000);
  let afterApplied = beforeApplied;
  let healthOk = false;
  if (post) {
    afterApplied = post.prismaMigrations.applied;
    healthOk = true;
  } else {
    ctx.logger.warn(
      "post-migrate health check did not recover within 30s — services may still be starting",
    );
  }
  const migrationsApplied = Math.max(0, afterApplied - beforeApplied);

  // ── 8. Audit ───────────────────────────────────────────────────────────

  const durationMs = Date.now() - startedAt;
  emitAudit(ctx, "bench.migrate.completed", {
    before: beforeApplied,
    after: afterApplied,
    migrationsApplied,
    healthRecovered: healthOk,
    durationMs,
  });

  return { ok: true, degraded: !healthOk, migrationsApplied, durationMs };
}
