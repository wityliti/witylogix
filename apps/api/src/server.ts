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
import { shutdownQueues } from "./lib/queue.js";
import { startNotificationWorker } from "./workers/notification-worker.js";
import { startOptimizationWorker } from "./workers/optimization-worker.js";
import { startIntegrationWorker } from "./workers/integration-worker.js";
import { onRoutingMeter } from "@witylogix/core/routing";
import { onNotificationMeter } from "@witylogix/core/notifications";
import { onIntegrationMeter } from "@witylogix/core/integrations";
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

  // ─── Core Plugins ───────────────────────────────────────────

  // Raw body capture (must register BEFORE routes that need HMAC)
  await app.register(rawBodyPlugin);

  // CORS — restrictive in production, permissive in dev
  await app.register(cors, {
    origin: isDev()
      ? true
      : [
          config.SHOPIFY_APP_URL,
          config.TRACKING_PAGE_URL,
        ].filter(Boolean) as string[],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  });

  // Security headers
  await app.register(helmet, {
    // Relaxed CSP for Shopify embedded iframe
    contentSecurityPolicy: isDev() ? false : undefined,
  });

  // Sensible defaults (httpErrors, assert, to, etc.)
  await app.register(sensible);

  // JWT signing & verification
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_EXPIRES_IN,
    },
  });

  // Global rate limiter
  await app.register(rateLimit, {
    global: true,
    max: isDev() ? 1000 : 200,
    timeWindow: "1 minute",
    redis: getRedis(),
    keyGenerator: (request) => {
      // Rate-limit per tenant if authenticated, else by IP
      return (request as any).auth?.shopId || request.ip;
    },
  });

  // Structured error handler (maps AppError, ZodError, Prisma errors)
  await app.register(errorHandlerPlugin);

  // Workflow integration (auto-trigger workflows from API operations)
  await app.register(import("./plugins/workflow-integration.js"));

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

  // ─── API Routes (v4) ───────────────────────────────────────

  await app.register(import("./routes/orders.js"), { prefix: "/api/v4/orders" });
  await app.register(import("./routes/drivers.js"), { prefix: "/api/v4/drivers" });
  await app.register(import("./routes/zones.js"), { prefix: "/api/v4/zones" });
  await app.register(import("./routes/routes.js"), { prefix: "/api/v4/routes" });
  await app.register(import("./routes/carriers.js"), { prefix: "/api/v4/carriers" });
  await app.register(import("./routes/webhooks.js"), { prefix: "/api/v4/webhooks" });
  await app.register(import("./routes/tracking.js"), { prefix: "/api/v4/tracking" });
  await app.register(import("./routes/time-slots.js"), { prefix: "/api/v4/time-slots" });
  await app.register(import("./routes/shops.js"), { prefix: "/api/v4/shops" });
  await app.register(import("./routes/orgs.js"), { prefix: "/api/v4/orgs" });
  await app.register(import("./routes/auth.js"), { prefix: "/api/v4/auth" });
  await app.register(import("./routes/admin.js"), { prefix: "/api/v4/admin" });
  await app.register(import("./routes/auth-providers.js"), { prefix: "/api/v4/auth-providers" });
  await app.register(import("./routes/users.js"), { prefix: "/api/v4/users" });
  await app.register(import("./routes/integrations.js"), { prefix: "/api/v4/integrations" });
  await app.register(import("./routes/shipments.js"), { prefix: "/api/v4/shipments" });
  await app.register(import("./routes/locations.js"), { prefix: "/api/v4/locations" });
  await app.register(import("./routes/shipping-profiles.js"), { prefix: "/api/v4/shipping-profiles" });
  await app.register(import("./routes/calendar-rules.js"), { prefix: "/api/v4/calendar-rules" });
  await app.register(import("./routes/notification-templates.js"), { prefix: "/api/v4/notification-templates" });
  await app.register(import("./routes/activity-logs.js"), { prefix: "/api/v4/activity-logs" });
  await app.register(import("./routes/payments.js"), { prefix: "/api/v4/payments" });
  await app.register(import("./routes/products.js"), { prefix: "/api/v4/products" });
  await app.register(import("./routes/customers.js"), { prefix: "/api/v4/customers" });
  await app.register(import("./routes/analytics.js"), { prefix: "/api/v4/analytics" });
  await app.register(import("./routes/analytics-events.js"), { prefix: "/api/v4/analytics/v2" });
  await app.register(import("./routes/payment-methods.js"), { prefix: "/api/v4/payment-methods" });
  await app.register(import("./routes/billing.js"), { prefix: "/api/v4/billing" });
  await app.register(import("./routes/billing-subscriptions.js"), { prefix: "/api/v4/billing/subscriptions" });
  await app.register(import("./routes/campaigns.js"), { prefix: "/api/v4/campaigns" });
  await app.register(import("./routes/messages.js"), { prefix: "/api/v4/messages" });
  await app.register(import("./routes/audit.js"), { prefix: "/api/v4/audit" });
  await app.register(import("./routes/permissions.js"), { prefix: "/api/v4/permissions" });
  await app.register(import("./routes/support-tickets.js"), { prefix: "/api/v4/support/tickets" });
  await app.register(import("./routes/feature-requests.js"), { prefix: "/api/v4/support/feature-requests" });
  await app.register(import("./routes/saved-views.js"), { prefix: "/api/v4/views" });
  await app.register(import("./routes/widget-config.js"), { prefix: "/api/v4/widgets" });
  await app.register(import("./routes/pos.js"), { prefix: "/api/v4/pos" });
  await app.register(import("./routes/collections.js"), { prefix: "/api/v4/collections" });
  await app.register(import("./routes/couriers.js"), { prefix: "/api/v4/couriers" });
  await app.register(import("./routes/custom-webhooks.js"), { prefix: "/api/v4/custom-webhooks" });
  await app.register(import("./routes/driver-scoring.js"), { prefix: "/api/v4/driver-scoring" });
  await app.register(import("./routes/ecommerce.js"), { prefix: "/api/v4/ecommerce" });
  await app.register(import("./routes/health.js"), { prefix: "/api/v4/health" });
  await app.register(import("./routes/invoices.js"), { prefix: "/api/v4/invoices" });
  await app.register(import("./routes/magento-webhooks.js"), { prefix: "/api/v4/magento-webhooks" });
  await app.register(import("./routes/notification-preferences.js"), { prefix: "/api/v4/notification-preferences" });
  await app.register(import("./routes/notifications-v2.js"), { prefix: "/api/v4/notifications" });
  await app.register(import("./routes/outbound-webhooks.js"), { prefix: "/api/v4/outbound-webhooks" });
  await app.register(import("./routes/payments-v2.js"), { prefix: "/api/v4/payments/v2" });
  await app.register(import("./routes/pod.js"), { prefix: "/api/v4/pod" });
  await app.register(import("./routes/returns.js"), { prefix: "/api/v4/returns" });
  await app.register(import("./routes/settings.js"), { prefix: "/api/v4/settings" });
  await app.register(import("./routes/shopify-webhooks.js"), { prefix: "/api/v4/shopify/webhooks" });
  await app.register(import("./routes/shopify-workflow-bridge.js"), { prefix: "/api/v4/shopify/workflow-bridge" });
  await app.register(import("./routes/webhook-deliveries.js"), { prefix: "/api/v4/webhook-deliveries" });
  await app.register(import("./routes/woocommerce-webhooks.js"), { prefix: "/api/v4/woocommerce/webhooks" });
  await app.register(import("./routes/workflow-delivery.js"), { prefix: "/api/v4/workflow/delivery" });
  await app.register(import("./routes/workflow-drivers.js"), { prefix: "/api/v4/workflow/drivers" });
  await app.register(import("./routes/workflow-executions.js"), { prefix: "/api/v4/workflow/executions" });
  await app.register(import("./routes/workflow-orders.js"), { prefix: "/api/v4/workflow/orders" });

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
  const config = getConfig();
  const app = await buildServer();

  // ─── Graceful Shutdown ──────────────────────────────────────

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    app.log.info(`Received ${signal} — starting graceful shutdown`);

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

    app.log.info("Shutdown complete");
    process.exit(0);
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
  app.log.info("BullMQ workers started (notification, optimization, integration)");

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
