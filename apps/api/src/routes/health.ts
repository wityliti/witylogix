/**
 * Health Check Routes
 *
 * Provides endpoints for monitoring and orchestration systems to verify:
 * - Liveness (is the process running?)
 * - Readiness (are external dependencies available?)
 * - Overall health status with uptime and version info
 *
 * Usage in Kubernetes:
 *   livenessProbe:
 *     httpGet:
 *       path: /health
 *       port: 3001
 *       scheme: HTTP
 *     initialDelaySeconds: 40
 *     periodSeconds: 10
 *
 *   readinessProbe:
 *     httpGet:
 *       path: /health/ready
 *       port: 3001
 *       scheme: HTTP
 *     initialDelaySeconds: 30
 *     periodSeconds: 5
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@witylogix/db";

// Track server start time for uptime calculation
const SERVER_START_TIME = Date.now();
const API_VERSION = process.env.API_VERSION || "1.0.0";

/**
 * GET /health
 *
 * Simple liveness probe. Returns immediately with basic status.
 * Used by Kubernetes livenessProbe and Docker HEALTHCHECK.
 *
 * Response: 200 OK
 * {
 *   "status": "ok",
 *   "timestamp": "2026-03-06T...",
 *   "version": "1.0.0",
 *   "uptime": 3600
 * }
 */
async function healthHandler(request: FastifyRequest, reply: FastifyReply) {
  const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);

  return reply.send({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    uptime, // seconds
  });
}

/**
 * GET /health/ready
 *
 * Readiness probe. Checks external dependencies (database, Redis).
 * Returns 503 if dependencies are unavailable.
 * Used by Kubernetes readinessProbe for load balancing decisions.
 *
 * Response: 200 OK (ready) or 503 Service Unavailable (not ready)
 * {
 *   "ready": true,
 *   "dependencies": {
 *     "database": "connected",
 *     "redis": "connected"
 *   },
 *   "timestamp": "2026-03-06T..."
 * }
 */
async function readinessHandler(request: FastifyRequest, reply: FastifyReply) {
  const dependencies: Record<string, string> = {};
  let isReady = true;

  // Check database connection
  try {
    // Simple query to verify DB connectivity (very fast)
    await prisma.$queryRaw`SELECT 1`;
    dependencies.database = "connected";
  } catch (error) {
    dependencies.database = "disconnected";
    isReady = false;
    request.log.error({ error }, "Database health check failed");
  }

  // Check Redis connection (if using Redis)
  try {
    // Note: This assumes Redis client is available globally
    // Adjust based on your app's Redis setup
    const redis = (request.server as any).redis; // or get from your DI container
    if (redis) {
      await redis.ping();
      dependencies.redis = "connected";
    } else {
      dependencies.redis = "not-configured";
    }
  } catch (error) {
    dependencies.redis = "disconnected";
    isReady = false;
    request.log.error({ error }, "Redis health check failed");
  }

  const statusCode = isReady ? 200 : 503;

  return reply.code(statusCode).send({
    ready: isReady,
    dependencies,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /health/deep
 *
 * Deep health check for comprehensive monitoring.
 * Includes detailed metrics and performance stats.
 * Slower than /health and /health/ready, use sparingly.
 *
 * Response: 200 OK or 503 Service Unavailable
 * {
 *   "status": "ok" | "degraded" | "unhealthy",
 *   "timestamp": "2026-03-06T...",
 *   "uptime": 3600,
 *   "memory": { "heapUsed": 45.5, "heapTotal": 100.0 },
 *   "dependencies": { ... }
 * }
 */
async function deepHealthHandler(request: FastifyRequest, reply: FastifyReply) {
  const dependencies: Record<string, any> = {};
  let status = "ok";

  // Memory usage (in MB)
  const memUsage = process.memoryUsage();
  const memory = {
    heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 10) / 10,
    heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 10) / 10,
    external: Math.round((memUsage.external / 1024 / 1024) * 10) / 10,
  };

  // Database check with timing
  const dbCheckStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbCheckStart;
    dependencies.database = {
      status: "connected",
      latency_ms: dbLatency,
    };
  } catch (error) {
    dependencies.database = { status: "disconnected" };
    status = "degraded";
  }

  // Redis check with timing
  try {
    const redis = (request.server as any).redis;
    if (redis) {
      const redisCheckStart = Date.now();
      await redis.ping();
      const redisLatency = Date.now() - redisCheckStart;
      dependencies.redis = {
        status: "connected",
        latency_ms: redisLatency,
      };
    } else {
      dependencies.redis = { status: "not-configured" };
    }
  } catch (error) {
    dependencies.redis = { status: "disconnected" };
    status = "degraded";
  }

  const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
  const statusCode = status === "ok" ? 200 : 503;

  return reply.code(statusCode).send({
    status,
    timestamp: new Date().toISOString(),
    uptime,
    version: API_VERSION,
    memory,
    dependencies,
  });
}

/**
 * Register all health check routes
 *
 * Fastify plugin pattern: exported as default async function
 * This allows routes to be registered with: await app.register(healthRoutes)
 */
export default async function healthRoutes(fastify: FastifyInstance) {
  // Liveness probe: simple and fast
  fastify.get("/health", { logLevel: "silent" }, healthHandler);

  // Readiness probe: checks external dependencies
  fastify.get("/health/ready", { logLevel: "silent" }, readinessHandler);

  // Deep health check: comprehensive but slower
  fastify.get("/health/deep", { logLevel: "silent" }, deepHealthHandler);
}

/**
 * Type-safe export for use in other modules
 */
export { healthHandler, readinessHandler, deepHealthHandler };
