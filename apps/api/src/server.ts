/**
 * Witylogix API Server
 *
 * Production-grade Fastify 5 server with:
 * - Plugin-based architecture (cors, helmet, jwt, rate-limit, raw-body, error-handler)
 * - Versioned API routes under /api/v4
 * - Socket.io real-time events
 * - BullMQ background job processing
 * - Graceful shutdown with connection draining
 */

import "dotenv/config";
import { initSentry } from "./lib/sentry.js";
import { validateStartupEnv } from "./validate-env.js";
// Import Fastify type augmentations early to ensure they're available throughout the app
import type {} from "./types/fastify.js";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import { prisma } from "@witylogix/db";
import { getConfig, isDev } from "./lib/config.js";
import { getRedis, disconnectRedis } from "./lib/redis.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import rawBodyPlugin from "./plugins/raw-body.js";
import securityHeadersPlugin from "./middleware/security-headers.js";
import { shutdownQueues } from "./lib/queue.js";
import { p95Tracker } from "./lib/p95-tracker.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
// Workers are started lazily to avoid @witylogix/core import failures
const startNotificationWorker = async () => { try { const m = await import("./workers/notification-worker.js"); return m.startNotificationWorker(); } catch { console.warn("[Worker] Notification worker unavailable"); } };
const startOptimizationWorker = async () => { try { const m = await import("./workers/optimization-worker.js"); return m.startOptimizationWorker(); } catch { console.warn("[Worker] Optimization worker unavailable"); } };
const startIntegrationWorker = async () => { try { const m = await import("./workers/integration-worker.js"); return m.startIntegrationWorker(); } catch { console.warn("[Worker] Integration worker unavailable"); } };
const startGeofenceWorker = async () => { try { const m = await import("./workers/geofence-worker.js"); return m.startGeofenceWorker(); } catch { console.warn("[Worker] Geofence worker unavailable"); } };
const startFailedDeliveryWorker = async () => { try { const m = await import("./workers/failed-delivery-worker.js"); return m.startFailedDeliveryWorker(); } catch { console.warn("[Worker] Failed-delivery worker unavailable"); } };
const startWCWebhookWorker = async () => { try { const m = await import("./workers/wc-webhook-worker.js"); return m.startWCWebhookWorker(); } catch { console.warn("[Worker] WC webhook worker unavailable"); } };
// Lazy imports — @witylogix/core modules may not resolve in dev
const onRoutingMeter = (..._args: any[]) => {};
const onNotificationMeter = (..._args: any[]) => {};
const onIntegrationMeter = (..._args: any[]) => {};
import { setupSocketServer, shutdownSocket } from "./lib/socket.js";

// ─── Build Server ───────────────────────────────────────────

export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: isDev()
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
    // Generate request IDs for tracing
    genReqId: () => crypto.randomUUID(),
    // Increase body limit for webhook payloads
    bodyLimit: 2 * 1024 * 1024, // 2MB
    trustProxy: true,
  });

  // Safe route/plugin registration — log errors but don't crash the server
  const safeRegister = async (route: Promise<any>, prefixOrOpts?: string | { prefix: string }) => {
    const opts = typeof prefixOrOpts === "string" ? { prefix: prefixOrOpts } : prefixOrOpts;
    try {
      await app.register(route, opts);
    } catch (err: any) {
      const label = opts?.prefix || "(plugin)";
      app.log.warn(`[Route] Failed to register ${label}: ${err.message}`);
    }
  };

  // ─── Core Plugins (Ordered for Security) ────────────────────
  //
  // Order matters! Security must come first:
  // 1. Security headers (applied to all responses)
  // 2. Raw body capture (must be BEFORE helmet for HMAC verification)
  // 3. CORS (before auth, allows OPTIONS preflight)
  // 4. Rate limiting (per-IP/per-tenant)
  // 5. Auth (JWT + tenant validation)
  // 6. Error handler (catches all errors)

  // 1. Security headers — applies to all responses
  await app.register(securityHeadersPlugin);

  // 2. Raw body capture (must register BEFORE routes that need HMAC)
  await app.register(rawBodyPlugin);

  // 3. CORS — restrictive in production, permissive in dev
  // CORS_ORIGINS env (comma-separated) takes precedence over the config defaults.
  const corsEnvOrigins = process.env.CORS_ORIGINS
    ?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const corsProdOrigins =
    corsEnvOrigins && corsEnvOrigins.length > 0
      ? corsEnvOrigins
      : ([config.SHOPIFY_APP_URL, config.TRACKING_PAGE_URL].filter(
          Boolean,
        ) as string[]);
  await app.register(cors, {
    origin: isDev() ? true : corsProdOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  });

  // 4. Standard helmet security headers (CSP, X-Frame-Options, etc.)
  await app.register(helmet, {
    // Relaxed CSP for Shopify embedded iframe
    contentSecurityPolicy: isDev() ? false : undefined,
  });

  // Sensible defaults (httpErrors, assert, to, etc.)
  await app.register(sensible);

  // JWT signing & verification
  // verify.algorithms: restrict to HS256 to prevent algorithm confusion (CVE-2026-34950)
  // verify.cache: disabled to prevent cache-key collision identity leaks (CVE-2026-35039)
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRES_IN,
      algorithm: "HS256",
    },
    verify: {
      algorithms: ["HS256"],
      cache: false,
    },
  });

  // 5. Global rate limiter — enforced before authentication.
  // In development use the built-in in-memory store to avoid blocking HTTP
  // requests when Railway Redis resets connections (ECONNRESET).
  // In production, Redis-backed rate limiting is used for distributed counting.
  const rateLimitOpts: any = {
    global: true,
    max: isDev() ? 1000 : config.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: "1 minute",
    keyGenerator: (request: any) => {
      return (request as any).auth?.shopId || request.ip;
    },
  };
  if (!isDev()) {
    try {
      rateLimitOpts.redis = getRedis();
    } catch {
      app.log.warn("[RateLimit] Redis unavailable, falling back to in-memory store");
    }
  }
  await app.register(rateLimit, rateLimitOpts);

  // 6. Structured error handler (maps AppError, ZodError, Prisma errors)
  await app.register(errorHandlerPlugin);

  // Bench Admin API — only enabled when BENCH_SERVICE_TOKEN is set
  // (see apps/api/src/routes/internal/bench.ts, docs/bench/ARCHITECTURE.md §3)
  if (process.env.BENCH_SERVICE_TOKEN) {
    const benchAdminRoutes = (
      await import("./routes/internal/bench.js")
    ).default;
    await app.register(benchAdminRoutes, { prefix: "/internal/bench" });
    app.log.info("bench admin API registered at /internal/bench");
  }

  // Workflow integration (auto-trigger workflows from API operations)
  await safeRegister(import("./plugins/workflow-integration.js"));

  // WebSocket real-time events
  await safeRegister(import("./plugins/websocket.js"));

  // Server-Sent Events fallback
  await safeRegister(import("./plugins/sse.js"));

  // ─── Health & Readiness ─────────────────────────────────────

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  app.get("/ready", async (request, reply) => {
    const checks: Record<string, string> = {};

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    // Redis check
    try {
      const redis = getRedis();
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }

    const allOk = Object.values(checks).every((v) => v === "ok");
    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? "ready" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  // ─── Latency Percentile Metrics (p95 dashboard) ─────────────
  // Exposes rolling p50/p95/p99 for BFS-certified endpoints.
  // carrier_rates p95 must stay ≤ 500ms per BFS SLA.
  app.get("/metrics/p95", { preHandler: [requireAuth, requireRole("admin")] }, async (_request, reply) => {
    const stats = p95Tracker.allStats();
    const bfsSla = {
      carrier_rates: { threshold_ms: 500, status: "no_data" as "no_data" | "pass" | "fail" },
    };
    if (stats.carrier_rates) {
      bfsSla.carrier_rates.status = stats.carrier_rates.p95 <= 500 ? "pass" : "fail";
    }
    return reply.send({ timestamp: new Date().toISOString(), endpoints: stats, bfs_sla: bfsSla });
  });

  // ─── API Routes (v4) ───────────────────────────────────────

  await safeRegister(import("./routes/orders.js"), "/api/v4/orders");
  await safeRegister(import("./routes/drivers.js"), "/api/v4/drivers");
  await safeRegister(import("./routes/zones.js"), { prefix: "/api/v4/zones" });
  await safeRegister(import("./routes/routes.js"), { prefix: "/api/v4/routes" });
  await safeRegister(import("./routes/carriers.js"), { prefix: "/api/v4/carriers" });
  await safeRegister(import("./routes/webhooks.js"), { prefix: "/api/v4/webhooks" });
  await safeRegister(import("./routes/tracking.js"), { prefix: "/api/v4/tracking" });
  await safeRegister(import("./routes/time-slots.js"), { prefix: "/api/v4/time-slots" });
  await safeRegister(import("./routes/shops.js"), { prefix: "/api/v4/shops" });
  await safeRegister(import("./routes/orgs.js"), { prefix: "/api/v4/orgs" });
  await safeRegister(import("./routes/auth.js"), { prefix: "/api/v4/auth" });
  // Legacy alias — same handlers (older docs / envs used /api/v1/auth/*).
  await safeRegister(import("./routes/auth.js"), { prefix: "/api/v1/auth" });
  await safeRegister(import("./routes/onboarding.js"), { prefix: "/api/v4/onboarding" });
  await safeRegister(import("./routes/admin.js"), { prefix: "/api/v4/admin" });
  await safeRegister(import("./routes/auth-providers.js"), { prefix: "/api/v4/auth-providers" });
  await safeRegister(import("./routes/users.js"), { prefix: "/api/v4/users" });
  await safeRegister(import("./routes/integrations.js"), { prefix: "/api/v4/integrations" });
  await safeRegister(import("./routes/integrations/crm.js"), { prefix: "/api/v4/integrations/crm" });
  await safeRegister(import("./routes/shipments.js"), { prefix: "/api/v4/shipments" });
  await safeRegister(import("./routes/locations.js"), { prefix: "/api/v4/locations" });
  await safeRegister(import("./routes/shipping-profiles.js"), { prefix: "/api/v4/shipping-profiles" });
  await safeRegister(import("./routes/calendar-rules.js"), { prefix: "/api/v4/calendar-rules" });
  await safeRegister(import("./routes/notification-templates.js"), { prefix: "/api/v4/notification-templates" });
  await safeRegister(import("./routes/activity-logs.js"), { prefix: "/api/v4/activity-logs" });
  await safeRegister(import("./routes/payments.js"), { prefix: "/api/v4/payments" });
  await safeRegister(import("./routes/products.js"), { prefix: "/api/v4/products" });
  await safeRegister(import("./routes/customers.js"), { prefix: "/api/v4/customers" });
  await safeRegister(import("./routes/analytics.js"), { prefix: "/api/v4/analytics" });
  await safeRegister(import("./routes/analytics-events.js"), { prefix: "/api/v4/analytics/v2" });
  await safeRegister(import("./routes/analytics/route-performance.js"), { prefix: "/api/v4/analytics" });
  await safeRegister(import("./routes/dashboard-stats.js"), { prefix: "/api/v4/dashboard" });
  await safeRegister(import("./routes/payment-methods.js"), { prefix: "/api/v4/payment-methods" });
  await safeRegister(import("./routes/billing.js"), { prefix: "/api/v4/billing" });
  await safeRegister(import("./routes/billing-subscriptions.js"), { prefix: "/api/v4/billing/subscriptions" });
  await safeRegister(import("./routes/campaigns.js"), { prefix: "/api/v4/campaigns" });
  await safeRegister(import("./routes/messages.js"), { prefix: "/api/v4/messages" });
  await safeRegister(import("./routes/chaos.js"), { prefix: "/api/v4/chaos" });
  await safeRegister(import("./routes/audit.js"), { prefix: "/api/v4/audit" });
  await safeRegister(import("./routes/permissions.js"), { prefix: "/api/v4/permissions" });
  await safeRegister(import("./routes/support-tickets.js"), { prefix: "/api/v4/support/tickets" });
  await safeRegister(import("./routes/feature-requests.js"), { prefix: "/api/v4/support/feature-requests" });
  await safeRegister(import("./routes/saved-views.js"), { prefix: "/api/v4/views" });
  await safeRegister(import("./routes/widget-config.js"), { prefix: "/api/v4/widgets" });
  await safeRegister(import("./routes/pos.js"), { prefix: "/api/v4/pos" });
  await safeRegister(import("./routes/collections.js"), { prefix: "/api/v4/collections" });
  await safeRegister(import("./routes/couriers.js"), { prefix: "/api/v4/couriers" });
  await safeRegister(import("./routes/dispatch.js"), { prefix: "/api/v4/dispatch" });
  await safeRegister(import("./routes/field-service.js"), { prefix: "/api/v4/field-service" });
  await safeRegister(import("./routes/deliveries.js"), { prefix: "/api/v4/deliveries" });
  await safeRegister(import("./routes/delivery-otp.js"), { prefix: "/api/v4/deliveries" });
  await safeRegister(import("./routes/delivery-events.js"), { prefix: "/api/v4/deliveries" });
  await safeRegister(import("./routes/failed-deliveries.js"), { prefix: "/api/v4/failed-deliveries" });
  await safeRegister(import("./routes/custom-webhooks.js"), { prefix: "/api/v4/custom-webhooks" });
  await safeRegister(import("./routes/driver-scoring.js"), { prefix: "/api/v4/driver-scoring" });
  await safeRegister(import("./routes/ecommerce.js"), { prefix: "/api/v4/ecommerce" });
  await safeRegister(import("./routes/health.js"), { prefix: "/api/v4/health" });
  await safeRegister(import("./routes/invoices.js"), { prefix: "/api/v4/invoices" });
  await safeRegister(import("./routes/magento-webhooks.js"), { prefix: "/api/v4/magento-webhooks" });
  await safeRegister(import("./routes/notification-preferences.js"), { prefix: "/api/v4/notification-preferences" });
  await safeRegister(import("./routes/notifications-v2.js"), { prefix: "/api/v4/notifications" });
  await safeRegister(import("./routes/outbound-webhooks.js"), { prefix: "/api/v4/outbound-webhooks" });
  await safeRegister(import("./routes/oauth.js"), { prefix: "/api/v4/oauth" });
  await safeRegister(import("./routes/operations.js"), { prefix: "/api/v4/operations" });
  await safeRegister(import("./routes/payments-v2.js"), { prefix: "/api/v4/payments/v2" });
  await safeRegister(import("./routes/pod.js"), { prefix: "/api/v4/pod" });
  await safeRegister(import("./routes/returns.js"), { prefix: "/api/v4/returns" });
  await safeRegister(import("./routes/settings.js"), { prefix: "/api/v4/settings" });
  await safeRegister(import("./routes/shopify-webhooks.js"), { prefix: "/api/v4/shopify/webhooks" });
  await safeRegister(import("./routes/shopify-workflow-bridge.js"), { prefix: "/api/v4/shopify/workflow-bridge" });
  await safeRegister(import("./routes/webhook-deliveries.js"), { prefix: "/api/v4/webhook-deliveries" });
  await safeRegister(import("./routes/woocommerce-webhooks.js"), { prefix: "/api/v4/woocommerce/webhooks" });
  await safeRegister(import("./routes/workflow-delivery.js"), { prefix: "/api/v4/workflow/delivery" });
  await safeRegister(import("./routes/workflow-drivers.js"), { prefix: "/api/v4/workflow/drivers" });
  await safeRegister(import("./routes/workflow-executions.js"), { prefix: "/api/v4/workflow/executions" });
  await safeRegister(import("./routes/workflow-orders.js"), { prefix: "/api/v4/workflow/orders" });
  await safeRegister(import("./routes/route-optimization.js"), { prefix: "/api/v4/route-optimization" });
  await safeRegister(import("./routes/live-tracking.js"), { prefix: "/api/v4/tracking/live" });
  await safeRegister(import("./routes/proof-of-delivery.js"), { prefix: "/api/v4/pod/v2" });
  await safeRegister(import("./routes/supply-chain.js"), { prefix: "/api/v4/supply-chain" });
  await safeRegister(import("./routes/healthcare.js"), { prefix: "/api/v4/healthcare" });
  await safeRegister(import("./routes/inventory.js"), { prefix: "/api/v4/inventory" });
  await safeRegister(import("./routes/warehouse.js"), { prefix: "/api/v4/warehouse" });
  await safeRegister(import("./routes/fleet/fleet.js"), { prefix: "/api/v4/fleet" });
  await safeRegister(import("./routes/eld.js"), { prefix: "/api/v4/eld" });
  await safeRegister(import("./routes/cold-chain/cold-chain.js"), { prefix: "/api/v4/cold-chain" });
  await safeRegister(import("./routes/eld.js"), { prefix: "/api/v4/eld" });


  await safeRegister(import("./routes/ai/eta-recalculate.js"), { prefix: "/api/v4/ai/eta/recalculate" });
  await safeRegister(import("./routes/finance-cod.js"), { prefix: "/api/v4/finance/cod" });
  await safeRegister(import("./routes/ai/copilot.js"), { prefix: "/api/v4/ai/copilot" });
  await safeRegister(import("./routes/ai/analytics.js"), { prefix: "/api/v4/ai/analytics" });
  await safeRegister(import("./routes/ai/slots.js"), { prefix: "/api/v4/ai/slots" });

  // ─── Socket.io Real-time Events ──────────────────────────

  // Initialize Socket.io after routes are registered
  // This will set up WebSocket server for real-time dashboard updates
  const httpServer = app.server;
  const redis = getRedis();
  try {
    await setupSocketServer(httpServer, redis, app.log as any);
    app.log.info("Socket.io server initialized successfully");
  } catch (err) {
    app.log.error(err, "Failed to initialize Socket.io server");
    // Continue anyway - Socket.io is optional for server functionality
  }

  // ─── Request Logging ──────────────────────────────────────

  app.addHook("onResponse", (request, reply, done) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
        shopId: (request as any).shopId,
      },
      "request completed",
    );
    done();
  });

  return app;
}

// ─── Start Server ────────────────────────────────────────────

async function start(): Promise<void> {
  await initSentry();
  validateStartupEnv();
  const config = getConfig();
  const app = await buildServer();

  // ─── Graceful Shutdown ──────────────────────────────────────

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    app.log.info(
      { signal, timeoutMs: config.SHUTDOWN_TIMEOUT_MS },
      "Graceful shutdown initiated",
    );

    // Set a hard timeout for shutdown (e.g., 30s)
    const shutdownTimeout = setTimeout(() => {
      app.log.error("Shutdown timeout exceeded — force exiting");
      process.exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS);

    try {
      // 1. Stop accepting new connections
      try {
        await app.close();
        app.log.info("HTTP server closed");
      } catch (err) {
        app.log.error(err, "Error closing HTTP server");
      }

      // 2. Shutdown Socket.io
      try {
        await shutdownSocket(app.log as any);
        app.log.info("Socket.io server shut down");
      } catch (err) {
        app.log.error(err, "Error shutting down Socket.io");
      }

      // 3. Drain BullMQ workers and queues
      try {
        await shutdownQueues();
        app.log.info("BullMQ queues closed");
      } catch (err) {
        app.log.error(err, "Error closing BullMQ queues");
      }

      // 4. Disconnect Redis
      try {
        await disconnectRedis();
        app.log.info("Redis disconnected");
      } catch (err) {
        app.log.error(err, "Error disconnecting Redis");
      }

      // 5. Disconnect database
      try {
        await prisma.$disconnect();
        app.log.info("Database disconnected");
      } catch (err) {
        app.log.error(err, "Error disconnecting database");
      }

      clearTimeout(shutdownTimeout);
      app.log.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      app.log.error(err, "Error during shutdown");
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  }

  // Register shutdown handlers
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, () => shutdown(signal));
  }

  // Catch unhandled rejections in production
  process.on("unhandledRejection", (err) => {
    app.log.error(err, "Unhandled rejection");
    if (!isDev()) {
      shutdown("unhandledRejection");
    }
  });

  // ─── Routing Metering ──────────────────────────────────────
  //
  // When BYOK is enabled and a tenant falls back to the deployer's
  // credentials, every routing API call is metered here. This logs
  // to the application logger and writes to the routing_meter_events
  // table for billing / usage dashboards.
  //
  onRoutingMeter(async (event) => {
    app.log.info(
      {
        shopId: event.shopId,
        provider: event.provider,
        operation: event.operation,
        usedFallback: event.usedFallback,
      },
      "[routing:metering] Fallback usage recorded",
    );
    // Persist to DB for billing dashboard
    try {
      await prisma.routingMeterEvent.create({
        data: {
          shopId: event.shopId,
          provider: event.provider,
          operation: event.operation,
          usedFallback: event.usedFallback,
          timestamp: event.timestamp,
        },
      });
    } catch (err) {
      // Table may not exist yet — log and continue, never block routing
      app.log.debug(err, "[routing:metering] Failed to persist (table may not exist yet)");
    }
  });

  // ─── Notification Metering ────────────────────────────────
  //
  // Same pattern as routing: when NOTIFICATIONS_BYOK is enabled and a
  // tenant falls back to deployer credentials, every notification send
  // is metered for billing / usage dashboards.
  //
  onNotificationMeter(async (event) => {
    app.log.info(
      {
        shopId: event.shopId,
        channel: event.channel,
        provider: event.provider,
        operation: event.operation,
        usedFallback: event.usedFallback,
      },
      "[notifications:metering] Fallback usage recorded",
    );
    try {
      await prisma.notificationMeterEvent.create({
        data: {
          shopId: event.shopId,
          channel: event.channel,
          provider: event.provider,
          operation: event.operation,
          usedFallback: event.usedFallback,
          timestamp: event.timestamp,
        },
      });
    } catch (err) {
      app.log.debug(err, "[notifications:metering] Failed to persist (table may not exist yet)");
    }
  });

  // ─── Integration Metering (Unified) ─────────────────────────
  //
  // Unified metering for all integration categories. Writes to the
  // integration_events table. This runs alongside (not replacing)
  // the existing routing/notification metering for backward compat.
  //
  onIntegrationMeter(async (event) => {
    app.log.info(
      {
        shopId: event.shopId,
        appSlug: event.appSlug,
        eventType: event.eventType,
        operation: event.operation,
        usedFallback: event.usedFallback,
      },
      "[integrations:metering] Event recorded",
    );
    try {
      await prisma.integrationEvent.create({
        data: {
          shopId: event.shopId,
          appSlug: event.appSlug,
          integrationId: event.integrationId,
          eventType: event.eventType,
          operation: event.operation,
          usedFallback: event.usedFallback,
          metadata: (event.metadata ?? {}) as Record<string, string>,
          timestamp: event.timestamp,
        },
      });
    } catch (err) {
      app.log.debug(err, "[integrations:metering] Failed to persist (table may not exist yet)");
    }
  });

  // ─── Start BullMQ Workers ──────────────────────────────────

  startNotificationWorker();
  startOptimizationWorker();
  startIntegrationWorker();

  // Geofence checker — repeatable job every 30s (WIT-140)
  startGeofenceWorker().then(async () => {
    try {
      const { getGeofenceQueue } = await import("./lib/queue.js");
      const intervalMs = parseInt(process.env.GEOFENCE_CHECK_INTERVAL_MS ?? "30000", 10);
      const geofenceQueue = getGeofenceQueue();
      await geofenceQueue.add(
        "geofence-check",
        { triggeredAt: new Date().toISOString() },
        { repeat: { every: intervalMs }, jobId: "geofence-check-repeatable" },
      );
      app.log.info(`[geofence-worker] Repeatable job scheduled every ${intervalMs}ms`);
    } catch (err: any) {
      app.log.warn(`[geofence-worker] Failed to schedule repeatable job: ${err.message}`);
    }
  });

  startFailedDeliveryWorker();
  startWCWebhookWorker();
  app.log.info("BullMQ workers started (notification, optimization, integration, geofence, failed-delivery, wc-webhooks)");

  // ─── Bootstrap Carrier Adapters ───────────────────────────
  try {
    const { bootstrapCarriersFromEnv } = await import("@witylogix/core/integrations/shipping");
    await bootstrapCarriersFromEnv();
    app.log.info("Carrier adapters bootstrapped from env");
  } catch (err) {
    app.log.warn(err, "Carrier adapter bootstrap skipped (non-fatal)");
  }

  // ─── Listen ───────────────────────────────────────────────

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(
      `Witylogix API v4 running on ${config.HOST}:${config.PORT} [${config.NODE_ENV}]`,
    );
  } catch (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }
}

start();
