/**
 * Health check middleware — provides liveness, readiness, and detailed status endpoints.
 *
 * Endpoints:
 * - GET /health — basic liveness check (no auth required)
 * - GET /health/ready — readiness check (verifies DB & Redis connections)
 * - GET /health/detailed — comprehensive status with version, uptime, memory, connections
 *
 * All endpoints return JSON with:
 * - status: "ok" | "degraded" | "unhealthy"
 * - checks: array of individual check results
 * - uptime: process uptime in seconds
 * - timestamp: ISO 8601 timestamp
 * - version: from package.json
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { prisma } from "@witylogix/db";
import { getRedis } from "../lib/redis.js";
import { getConfig } from "../lib/config.js";
import { readFileSync } from "fs";
import { resolve } from "path";

interface HealthCheckResult {
  name: string;
  status: "ok" | "degraded" | "unhealthy";
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: "ok" | "degraded" | "unhealthy";
  checks: HealthCheckResult[];
  uptime: number;
  timestamp: string;
  version: string;
}

/**
 * Safely check database connectivity
 */
async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: "database",
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "database",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Safely check Redis connectivity
 */
async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    return {
      name: "redis",
      status: "ok",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "redis",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get app version from package.json
 */
function getAppVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Basic liveness check (no dependencies)
 */
async function handleHealth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const response: HealthResponse = {
    status: "ok",
    checks: [{ name: "liveness", status: "ok" }],
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: getAppVersion(),
  };

  reply.code(200).send(response);
}

/**
 * Readiness check (verifies critical dependencies)
 */
async function handleReadiness(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const checks: HealthCheckResult[] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
  const status = hasUnhealthy ? "unhealthy" : "ok";

  const response: HealthResponse = {
    status,
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: getAppVersion(),
  };

  const statusCode = hasUnhealthy ? 503 : 200;
  reply.code(statusCode).send(response);
}

/**
 * Detailed status check (includes memory, uptime, config info)
 */
async function handleDetailed(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const config = getConfig();
  const memUsage = process.memoryUsage();

  const checks: HealthCheckResult[] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
  const status = hasUnhealthy ? "unhealthy" : "ok";

  const response: HealthResponse & {
    memory: {
      heapUsed: string;
      heapTotal: string;
      external: string;
      rss: string;
    };
    environment: string;
    databaseUrl: string;
    redisUrl: string;
  } = {
    status,
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: getAppVersion(),
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
    },
    environment: config.NODE_ENV,
    databaseUrl: config.DATABASE_URL.split("://")[0] || "postgresql",
    redisUrl: config.REDIS_URL.split("://")[0] || "redis",
  };

  const statusCode = hasUnhealthy ? 503 : 200;
  reply.code(statusCode).send(response);
}

/**
 * Health check plugin — registers three health endpoints
 */
const healthPlugin = fastifyPlugin(
  async (fastify: FastifyInstance): Promise<void> => {
    // Basic liveness (no auth, used by load balancers)
    fastify.get("/health", async (request, reply) => {
      await handleHealth(request, reply);
    });

    // Readiness check (no auth, checks dependencies)
    fastify.get("/health/ready", async (request, reply) => {
      await handleReadiness(request, reply);
    });

    // Detailed status (no auth, includes memory + config)
    fastify.get("/health/detailed", async (request, reply) => {
      await handleDetailed(request, reply);
    });
  },
  {
    name: "health",
  },
);

export default healthPlugin;
