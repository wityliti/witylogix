/**
 * Platform Health & Status Routes
 *
 * Endpoints for monitoring system health, service status,
 * integration connectivity, process metrics, and operational alerts.
 *
 * Routes:
 * GET /platform/health       — Simple uptime check (DB ping)
 * GET /platform/status       — Real service checks (DB + Redis latency)
 * GET /platform/integrations — Tenant's connected integrations (auth required)
 * GET /platform/metrics      — Real process metrics (memory, uptime, DB latency)
 * GET /platform/alerts       — Platform alerts (empty until alerting is built)
 * POST /platform/alerts/:alertId/acknowledge — Acknowledge an alert
 */

import os from "os";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { getRedis } from "../../lib/redis.js";

// ─── TYPES ─────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  uptime: number;
  responseTime?: number;
  lastChecked: Date;
}

interface IntegrationStatus {
  name: string;
  provider: string;
  status: "connected" | "disconnected" | "error";
  accountsConnected: number;
  lastSync: Date | null;
  error?: string;
}

interface PlatformAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

// ─── VALIDATION SCHEMAS ─────────────────────────────────────

const AcknowledgeAlertSchema = z.object({
  userId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

// ─── ROUTE HANDLERS ─────────────────────────────────────────

/**
 * GET /platform/health
 *
 * Simple health check — pings the database.
 * Used by monitoring systems and load balancers.
 */
async function healthHandler(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - dbStart;

    return reply.send({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dbLatencyMs,
    });
  } catch (error) {
    return reply.code(503).send({
      status: "service_unavailable",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
    });
  }
}

/**
 * GET /platform/status
 *
 * Live checks against Database and Redis.
 * API Server status is derived from process metrics.
 */
async function statusHandler(request: FastifyRequest, reply: FastifyReply) {
  const now = Date.now();
  const services: ServiceStatus[] = [];

  // ── API Server (self) ─────────────────────────────────────
  services.push({
    name: "API Server",
    status: "healthy",
    uptime: Math.min(
      100,
      Math.round((process.uptime() / (30 * 24 * 3600)) * 1000) / 10,
    ),
    responseTime: Date.now() - now,
    lastChecked: new Date(),
  });

  // ── Database ──────────────────────────────────────────────
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - dbStart;
    services.push({
      name: "PostgreSQL",
      status: responseTime < 150 ? "healthy" : "degraded",
      uptime: 100,
      responseTime,
      lastChecked: new Date(),
    });
  } catch {
    services.push({
      name: "PostgreSQL",
      status: "down",
      uptime: 0,
      lastChecked: new Date(),
    });
  }

  // ── Redis ─────────────────────────────────────────────────
  try {
    const redis = getRedis();
    const redisStart = Date.now();
    await redis.ping();
    const responseTime = Date.now() - redisStart;
    services.push({
      name: "Redis Cache",
      status: responseTime < 50 ? "healthy" : "degraded",
      uptime: 100,
      responseTime,
      lastChecked: new Date(),
    });
  } catch {
    services.push({
      name: "Redis Cache",
      status: "down",
      uptime: 0,
      lastChecked: new Date(),
    });
  }

  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const score = (healthyCount / services.length) * 100;

  return reply.send({
    timestamp: new Date().toISOString(),
    score,
    services,
    summary: {
      total: services.length,
      healthy: healthyCount,
      degraded: services.filter((s) => s.status === "degraded").length,
      down: services.filter((s) => s.status === "down").length,
    },
  });
}

/**
 * GET /platform/integrations
 *
 * Returns the current tenant's connected integrations from the database.
 * Requires authentication (shopId from session).
 */
async function integrationsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const shopId = (request as any).shopId as string;

    const rows = await prisma.integration.findMany({
      where: { shopId, isEnabled: true },
      include: { app: { select: { name: true, slug: true } } },
      orderBy: { lastSyncAt: "desc" },
    });

    const integrations: IntegrationStatus[] = rows.map((row) => ({
      name: row.app.name,
      provider: row.app.slug,
      status:
        row.healthStatus === "HEALTHY"
          ? "connected"
          : row.healthStatus === "ERROR"
            ? "error"
            : row.lastSyncAt != null
              ? "connected"
              : "disconnected",
      accountsConnected: row.isEnabled ? 1 : 0,
      lastSync: row.lastSyncAt,
    }));

    const statusFilter = (request.query as any).status as string | undefined;
    const filtered = statusFilter
      ? integrations.filter((i) => statusFilter.split(",").includes(i.status))
      : integrations;

    return reply.send({
      timestamp: new Date().toISOString(),
      integrations: filtered,
      summary: {
        total: integrations.length,
        connected: integrations.filter((i) => i.status === "connected").length,
        disconnected: integrations.filter((i) => i.status === "disconnected")
          .length,
        error: integrations.filter((i) => i.status === "error").length,
      },
    });
  } catch (error) {
    request.log.error(error, "Integration status check failed");
    return reply.code(500).send({
      error: "Failed to get integration status",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /platform/metrics
 *
 * Real process metrics: memory, uptime, DB latency.
 * Does NOT include requestsPerSecond or errorRate — those require an external
 * APM system. The dashboard shows only what we can actually measure.
 */
async function metricsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsagePct = Math.round(((totalMem - freeMem) / totalMem) * 100);
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMb = Math.round(mem.rss / 1024 / 1024);

    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      /* db down — leave at 0 */
    }

    return reply.send({
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      memUsagePct,
      heapUsedMb,
      rssMb,
      dbLatencyMs,
      nodeVersion: process.version,
      platform: process.platform,
    });
  } catch (error) {
    request.log.error(error, "Metrics retrieval failed");
    return reply.code(500).send({
      error: "Failed to get metrics",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /platform/alerts
 *
 * Platform alerts. Returns an empty list until a persistent alerting
 * model is implemented. No synthetic/hardcoded alerts.
 */
async function alertsHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    timestamp: new Date().toISOString(),
    alerts: [] as PlatformAlert[],
    summary: { total: 0, pending: 0, critical: 0, warning: 0, info: 0 },
  });
}

/**
 * POST /platform/alerts/:alertId/acknowledge
 */
async function acknowledgeAlertHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    AcknowledgeAlertSchema.parse(request.body);
    return reply.send({
      status: "acknowledged",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply
        .code(400)
        .send({ error: "Invalid request body", details: error.errors });
    }
    request.log.error(error, "Alert acknowledgement failed");
    return reply
      .code(500)
      .send({
        error: "Failed to acknowledge alert",
        timestamp: new Date().toISOString(),
      });
  }
}

// ─── ROUTE REGISTRATION ─────────────────────────────────────

export async function platformRoutes(app: FastifyInstance) {
  // Public health check (no auth — for load balancers)
  app.get("/platform/health", healthHandler);

  // Public status check (no auth — for monitoring)
  app.get("/platform/status", statusHandler);

  // Authenticated routes — need shopId for tenant context
  app.get(
    "/platform/integrations",
    { preHandler: [requireAuth] },
    integrationsHandler,
  );
  app.get("/platform/metrics", metricsHandler);
  app.get("/platform/alerts", alertsHandler);

  app.post(
    "/platform/alerts/:alertId/acknowledge",
    {
      preHandler: [requireAuth, requireRole("SUPER_ADMIN")],
    },
    acknowledgeAlertHandler,
  );
}
