/**
 * Bench Admin API routes — `/internal/bench/*`.
 *
 * Plugin is conditionally registered by server.ts ONLY when
 * `BENCH_SERVICE_TOKEN` is set. Every route is gated by the benchAuth
 * preHandler (bearer + CIDR).
 *
 * Phase 1b endpoints:
 *  - GET  /internal/bench/health   — version + migration state + drain flag
 *  - POST /internal/bench/drain    — read-only or offline mode
 *  - POST /internal/bench/tenants  — (added in T10)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { benchAuth } from "../../middleware/bench-auth.js";

type DrainMode = "read-only" | "offline";

interface DrainState {
  mode: DrainMode | null;
  drainedAt?: string;
  reason?: string;
}

// Module-level state: drain flag is ephemeral — a process restart clears it.
let drainState: DrainState = { mode: null };

/**
 * Test hook — returns a readonly view of the drain state.
 * Read-only intentionally; only the route handler should mutate.
 */
export function getDrainState(): Readonly<DrainState> {
  return drainState;
}

/**
 * Test hook — reset state between tests.
 */
export function resetDrainState(): void {
  drainState = { mode: null };
}

const drainBody = z.object({
  mode: z.enum(["read-only", "offline"]),
  reason: z.string().max(500).optional(),
});

export default async function benchAdminRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", benchAuth());

  app.get("/health", async () => {
    let applied = 0;
    try {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS applied FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      )) as Array<{ applied: number }>;
      applied = rows[0]?.applied ?? 0;
    } catch {
      // _prisma_migrations may not exist on a fresh DB — treat as zero applied
      applied = 0;
    }

    return {
      apiVersion: process.env.API_VERSION ?? "0.0.0",
      witylogixVersion: process.env.WITYLOGIX_VERSION ?? "0.0.0",
      prismaMigrations: {
        applied,
        pending: 0, // populated in Phase 1c once migration-diff parsing lands
      },
      drained: drainState.mode !== null,
      drainMode: drainState.mode,
      uptimeSec: Math.floor(process.uptime()),
    };
  });

  app.post("/drain", async (req, reply) => {
    const parsed = drainBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: "invalid_body",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      });
    }
    drainState = {
      mode: parsed.data.mode,
      drainedAt: new Date().toISOString(),
      reason: parsed.data.reason,
    };
    return {
      state: "drained",
      mode: drainState.mode,
      drainedAt: drainState.drainedAt,
    };
  });

  app.post("/undrain", async () => {
    drainState = { mode: null };
    return { state: "active" };
  });
}
