/**
 * Chaos Testing API — integration fault-injection scenarios.
 *
 * Scenarios are stored as JSON in shop.settings.chaosScenarios[].
 * Executions and results are stored in ActivityLog (entityType = 'CHAOS_EXECUTION').
 *
 * Routes:
 *   GET    /scenarios           List scenarios for current shop
 *   POST   /scenarios           Create a scenario
 *   DELETE /scenarios/:id       Remove a scenario
 *   POST   /scenarios/:id/execute  Start a simulated chaos execution
 *   GET    /executions/:id      Get execution state
 *   GET    /history             List all past executions
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const createScenarioSchema = z.object({
  name: z.string().min(1).max(120),
  provider: z.string().min(1).max(80),
  faultType: z.enum(["latency", "error", "timeout", "partial_failure"]),
  severity: z.enum(["low", "medium", "high"]),
  duration: z.number().int().min(5).max(3600),
  targetEndpoints: z.array(z.string()).default([]),
});

// ─── Types ──────────────────────────────────────────────────

interface StoredScenario {
  id: string;
  name: string;
  provider: string;
  faultType: string;
  severity: string;
  duration: number;
  targetEndpoints: string[];
  createdAt: string;
}

interface ShopSettings {
  chaosScenarios?: StoredScenario[];
  [key: string]: unknown;
}

// ─── Helpers ────────────────────────────────────────────────

function makeScenarioId(): string {
  return `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function getScenarios(
  db: FastifyRequest["tenantDb"],
  shopId: string,
): Promise<StoredScenario[]> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { settings: true },
  });
  const settings = (shop?.settings ?? {}) as ShopSettings;
  return Array.isArray(settings.chaosScenarios) ? settings.chaosScenarios : [];
}

async function saveScenarios(
  db: FastifyRequest["tenantDb"],
  shopId: string,
  scenarios: StoredScenario[],
): Promise<void> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { settings: true },
  });
  const settings = (shop?.settings ?? {}) as ShopSettings;
  await db.shop.update({
    where: { id: shopId },
    data: { settings: { ...settings, chaosScenarios: scenarios } },
  });
}

// ─── Routes ─────────────────────────────────────────────────

async function chaosRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST SCENARIOS ───────────────────────────────────────
  fastify.get("/scenarios", async (request: FastifyRequest) => {
    const scenarios = await getScenarios(request.tenantDb, request.shopId);
    return { data: scenarios };
  });

  // ── CREATE SCENARIO ──────────────────────────────────────
  fastify.post("/scenarios", async (request: FastifyRequest) => {
    try {
      const body = createScenarioSchema.parse(request.body);
      const scenarios = await getScenarios(request.tenantDb, request.shopId);
      const scenario: StoredScenario = {
        id: makeScenarioId(),
        ...body,
        createdAt: new Date().toISOString(),
      };
      await saveScenarios(request.tenantDb, request.shopId, [
        ...scenarios,
        scenario,
      ]);
      return { data: scenario };
    } catch (err) {
      if (err instanceof ZodError) throw new ValidationError(err.message);
      throw err;
    }
  });

  // ── DELETE SCENARIO ──────────────────────────────────────
  fastify.delete("/scenarios/:id", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const scenarios = await getScenarios(request.tenantDb, request.shopId);
    const updated = scenarios.filter((s) => s.id !== id);
    if (updated.length === scenarios.length)
      throw new NotFoundError("ChaosScenario", id);
    await saveScenarios(request.tenantDb, request.shopId, updated);
    return { status: "ok" };
  });

  // ── EXECUTE SCENARIO ────────────────────────────────────
  fastify.post("/scenarios/:id/execute", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const scenarios = await getScenarios(request.tenantDb, request.shopId);
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) throw new NotFoundError("ChaosScenario", id);

    const executionId = randomUUID();
    const assertions = [
      { name: "Circuit breaker activates within threshold", passed: false },
      { name: "Fallback cache serves within SLA", passed: false },
      { name: "Error rate stays below 10%", passed: false },
    ];

    await request.tenantDb.activityLog.create({
      data: {
        shopId: request.shopId,
        entityType: "CHAOS_EXECUTION",
        entityId: executionId,
        action: "STARTED",
        actorType: "user",
        actorId: request.auth.userId ?? undefined,
        metadata: {
          scenarioId: id,
          scenario,
          status: "running",
          progress: 0,
          startedAt: new Date().toISOString(),
          metrics: {
            requestsImpacted: 0,
            errorRate: 0,
            latencyMs: 0,
            circuitBreakerTrips: 0,
          },
          assertions,
        },
      },
    });

    return {
      data: {
        id: executionId,
        scenarioId: id,
        status: "running",
        progress: 0,
        metrics: {
          requestsImpacted: 0,
          errorRate: 0,
          latencyMs: 0,
          circuitBreakerTrips: 0,
        },
        assertions,
        startedAt: new Date().toISOString(),
      },
    };
  });

  // ── GET EXECUTION ───────────────────────────────────────
  fastify.get("/executions/:id", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const log = await request.tenantDb.activityLog.findFirst({
      where: {
        shopId: request.shopId,
        entityType: "CHAOS_EXECUTION",
        entityId: id,
      },
      orderBy: { timestamp: "desc" },
    });
    if (!log) throw new NotFoundError("ChaosExecution", id);
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const elapsed = Date.now() - new Date(log.timestamp).getTime();
    const scenario = meta.scenario as StoredScenario | undefined;
    const durationMs = (scenario?.duration ?? 60) * 1_000;
    const progress = Math.min(100, Math.round((elapsed / durationMs) * 100));
    const status = progress >= 100 ? "completed" : "running";
    return {
      data: {
        id,
        scenarioId: meta.scenarioId,
        status,
        progress,
        metrics: meta.metrics ?? {
          requestsImpacted: 0,
          errorRate: 0,
          latencyMs: 0,
          circuitBreakerTrips: 0,
        },
        assertions: (meta.assertions ?? []) as unknown[],
        startedAt: log.timestamp.toISOString(),
      },
    };
  });

  // ── HISTORY ──────────────────────────────────────────────
  fastify.get("/history", async (request: FastifyRequest) => {
    const logs = await request.tenantDb.activityLog.findMany({
      where: { shopId: request.shopId, entityType: "CHAOS_EXECUTION" },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    const data = logs.map((log) => {
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      const elapsed = Date.now() - new Date(log.timestamp).getTime();
      const scenario = meta.scenario as StoredScenario | undefined;
      const durationMs = (scenario?.duration ?? 60) * 1_000;
      const progress = Math.min(100, Math.round((elapsed / durationMs) * 100));
      return {
        id: log.entityId,
        scenarioId: meta.scenarioId,
        status: progress >= 100 ? "completed" : "running",
        progress,
        findings: (meta.findings ?? []) as string[],
        duration: scenario?.duration ?? 60,
        createdAt: log.timestamp.toISOString(),
        scenario: scenario ?? null,
      };
    });
    return { data };
  });
}

export default chaosRoutes;
