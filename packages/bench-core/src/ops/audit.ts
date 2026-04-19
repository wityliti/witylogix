/**
 * Structured audit event emitter for bench operations.
 *
 * Events are written as JSONL to `<installation>/bench.audit.log` and, when
 * the caller is in `--json` mode, also streamed on stderr so the Cloud
 * control plane (Phase 2) can tail them over SSH.
 *
 * The schema is intentionally small and stable: `event`, `actor`, `initiator`,
 * `timestamp` (ISO 8601), `installation`, `data`. Callers put domain-specific
 * fields into `data`. Downstream consumers (dashboards, alerts) filter by
 * `event`.
 *
 * Env override: `BENCH_INITIATOR` replaces the default `"cli"` initiator.
 * The Cloud control plane sets this to `"cloud"` so audit consumers can
 * distinguish CLI-driven from web-driven actions.
 *
 * Failure mode: audit write failures are logged as warnings, never thrown.
 * An audit drop should not cascade into an operation failure.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Context } from "../types.js";

export interface AuditEvent {
  event: string;
  actor: string;
  initiator: string;
  /** ISO 8601 string, e.g. "2026-04-20T14:30:00.000Z". */
  timestamp: string;
  installation: string;
  data: Record<string, unknown>;
}

export const AUDIT_LOG_FILENAME = "bench.audit.log";

export function emitAudit(
  ctx: Context,
  event: string,
  data: Record<string, unknown> = {},
): AuditEvent {
  const payload: AuditEvent = {
    event,
    actor: "bench",
    initiator: process.env.BENCH_INITIATOR ?? "cli",
    timestamp: new Date().toISOString(),
    installation: ctx.config.metadata.name,
    data,
  };
  const path = resolve(ctx.cwd, AUDIT_LOG_FILENAME);
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(payload)}\n`);
  } catch (err) {
    ctx.logger.warn(
      `failed to write audit event: ${(err as Error).message}`,
    );
  }
  if (ctx.json) {
    try {
      process.stderr.write(`${JSON.stringify({ audit: payload })}\n`);
    } catch (err) {
      ctx.logger.warn(
        `failed to emit audit event on stderr: ${(err as Error).message}`,
      );
    }
  }
  return payload;
}
