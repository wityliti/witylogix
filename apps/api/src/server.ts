/**
 * Witylogix API Server
 * Fastify 5 + Socket.io + BullMQ
 */

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { prisma } from "@witylogix/db";

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty" }
          : undefined,
    },
  });

  // ─── Plugins ────────────────────────────────────────────
  await app.register(cors, {
    origin: process.env.NODE_ENV === "development" ? true : [
      process.env.SHOPIFY_APP_URL!,
      process.env.TRACKING_PAGE_URL!,
    ],
  });
  await app.register(helmet);
  await app.register(sensible);

  // ─── Health Check ───────────────────────────────────────
  app.get("/health", async () => {
    // Verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // ─── API Routes ─────────────────────────────────────────
  // TODO: Register route modules
  // await app.register(import("./routes/orders.js"), { prefix: "/api/v4/orders" });
  // await app.register(import("./routes/drivers.js"), { prefix: "/api/v4/drivers" });
  // await app.register(import("./routes/zones.js"), { prefix: "/api/v4/zones" });
  // await app.register(import("./routes/routes.js"), { prefix: "/api/v4/routes" });
  // await app.register(import("./routes/carriers.js"), { prefix: "/api/v4/carriers" });
  // await app.register(import("./routes/webhooks.js"), { prefix: "/api/v4/webhooks" });
  // await app.register(import("./routes/tracking.js"), { prefix: "/api/v4/tracking" });

  return app;
}

// ─── Start Server ───────────────────────────────────────────

async function start() {
  const app = await buildServer();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Witylogix API running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
