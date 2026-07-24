/**
 * Platform Health & Metrics Routes
 *
 * Endpoints:
 * - GET /health — quick health check for load balancers
 * - GET /health/detailed — full health report with all checks
 * - GET /metrics — Prometheus-compatible metrics
 * - GET /api/docs — Swagger UI
 * - GET /api/docs/spec — OpenAPI JSON spec
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@witylogix/db";
import { getRedis } from "../../lib/redis.js";
import {
  PlatformHealthService,
  type HealthStatus,
} from "@witylogix/core/platform";

// ─── Global Health Service Instance ─────────────────────────────

let healthService: PlatformHealthService | null = null;

function getHealthService(): PlatformHealthService {
  if (!healthService) {
    const redis = getRedis();
    healthService = new PlatformHealthService(prisma, redis, {
      databaseQueryTimeout: 5000,
      redisTimeout: 2000,
      externalServiceTimeout: 10000,
      memoryWarningThreshold: 80,
      memoryErrorThreshold: 95,
    });
  }

  return healthService;
}

// ─── Route Handler ──────────────────────────────────────────────

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const service = getHealthService();

  // ─── Quick Health Check ─────────────────────────────────────────
  // For load balancers — fast, minimal dependencies
  fastify.get<{
    Reply: {
      status: string;
      timestamp: string;
    };
  }>("/health", async (request: FastifyRequest, reply: FastifyReply) => {
    const health = await service.getQuickHealth();

    service.recordRequest();

    // Return 200 if healthy, 503 if unhealthy
    const statusCode = health.status === "healthy" ? 200 : 503;

    reply.code(statusCode).send({
      status: health.status,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Detailed Health Check ──────────────────────────────────────
  // For monitoring dashboards — complete report
  fastify.get<{
    Reply: HealthStatus;
  }>(
    "/health/detailed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const health = await service.getDetailedHealth();

      service.recordRequest();

      // Return appropriate status code
      const statusCode =
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 200 // Still return 200 to avoid alerting, but data shows degradation
            : 503;

      reply.code(statusCode).send(health);
    },
  );

  // ─── Plain Text Health Summary ───────────────────────────────────
  // For quick CLI checks
  fastify.get<{
    Reply: string;
  }>("/health/text", async (request: FastifyRequest, reply: FastifyReply) => {
    const health = await service.getDetailedHealth();

    service.recordRequest();

    const text = service.formatHealthStatusText(health);

    const statusCode = health.status === "healthy" ? 200 : 503;

    reply.type("text/plain").code(statusCode).send(text);
  });

  // ─── Prometheus Metrics ─────────────────────────────────────────
  // For metric collection and dashboards
  fastify.get<{
    Reply: string;
  }>("/metrics", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await service.getPrometheusMetrics();

      reply.type("text/plain; version=0.0.4").code(200).send(metrics);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      fastify.log.error("Metrics generation error:", errorMsg);

      reply.code(500).send({
        error: "Failed to generate metrics",
      });
    }
  });

  // ─── Swagger UI ──────────────────────────────────────────────────
  // Interactive API documentation
  fastify.get<{
    Reply: string;
  }>("/api/docs", async (request: FastifyRequest, reply: FastifyReply) => {
    const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Witylogix API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
    <style>
      html {
        box-sizing: border-box;
        overflow: -moz-scrollbars-vertical;
        overflow-y: scroll;
      }
      *, *:before, *:after {
        box-sizing: inherit;
      }
      body {
        margin: 0;
        padding: 0;
        background: #fafafa;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui-standalone-preset.js"></script>
    <script>
      const ui = SwaggerUIBundle({
        url: '/api/docs/spec',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'StandaloneLayout',
        operationsSorter: 'alpha',
        tagsSorter: 'alpha',
      })
      window.ui = ui
    </script>
  </body>
</html>`;

    reply.type("text/html").send(html);
  });

  // ─── OpenAPI Specification ──────────────────────────────────────
  // Machine-readable API spec
  fastify.get<{
    Reply: Record<string, unknown>;
  }>("/api/docs/spec", async (request: FastifyRequest, reply: FastifyReply) => {
    const spec = {
      openapi: "3.1.0",
      info: {
        title: "Witylogix Platform API",
        version: process.env.APP_VERSION ?? "4.0.0",
        description: "Last-mile delivery logistics SaaS platform",
        contact: {
          name: "Witylogix Support",
          email: "support@witylogix.com",
          url: "https://witylogix.com",
        },
      },
      servers: [
        {
          url: process.env.API_URL ?? "http://localhost:3000",
          description: "API Server",
        },
      ],
      paths: {
        "/health": {
          get: {
            tags: ["Health"],
            summary: "Quick health check",
            description: "Returns 200 if healthy, 503 if unhealthy",
            operationId: "getHealth",
            responses: {
              "200": {
                description: "Service is healthy",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: {
                          type: "string",
                          enum: ["healthy", "degraded", "unhealthy"],
                        },
                        timestamp: {
                          type: "string",
                          format: "date-time",
                        },
                      },
                    },
                  },
                },
              },
              "503": {
                description: "Service is unhealthy",
              },
            },
          },
        },
        "/health/detailed": {
          get: {
            tags: ["Health"],
            summary: "Detailed health report",
            description:
              "Returns comprehensive health check with all dependencies",
            operationId: "getDetailedHealth",
            responses: {
              "200": {
                description: "Health status report",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: {
                          type: "string",
                          enum: ["healthy", "degraded", "unhealthy"],
                        },
                        checks: {
                          type: "object",
                          properties: {
                            database: {
                              type: "object",
                            },
                            redis: {
                              type: "object",
                            },
                            externalServices: {
                              type: "object",
                            },
                          },
                        },
                        metrics: {
                          type: "object",
                        },
                        uptime: {
                          type: "number",
                        },
                        timestamp: {
                          type: "string",
                          format: "date-time",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/health/text": {
          get: {
            tags: ["Health"],
            summary: "Health status as plain text",
            description: "Returns human-readable health status",
            operationId: "getHealthText",
            responses: {
              "200": {
                description: "Health status as text",
                content: {
                  "text/plain": {
                    schema: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
        "/metrics": {
          get: {
            tags: ["Metrics"],
            summary: "Prometheus metrics",
            description: "Returns Prometheus-compatible metrics",
            operationId: "getMetrics",
            responses: {
              "200": {
                description: "Prometheus metrics",
                content: {
                  "text/plain": {
                    schema: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
      },
      tags: [
        {
          name: "Health",
          description: "Health check endpoints",
        },
        {
          name: "Metrics",
          description: "Monitoring and metrics endpoints",
        },
      ],
    };

    reply.send(spec);
  });

  // ─── ReDoc Documentation ────────────────────────────────────────
  fastify.get<{
    Reply: string;
  }>(
    "/api/docs/redoc",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Witylogix API - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url='/api/docs/spec'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;

      reply.type("text/html").send(html);
    },
  );

  // ─── Request Tracking Middleware ─────────────────────────────────
  // Record all requests for metrics
  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    // Don't track health check requests to avoid noise
    if (
      !request.url.startsWith("/health") &&
      !request.url.startsWith("/metrics")
    ) {
      service.recordRequest();
    }
  });

  // ─── Error Tracking ─────────────────────────────────────────────
  fastify.addHook(
    "onResponse",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Record errors (5xx responses)
      if (reply.statusCode >= 500) {
        service.recordError();
      }
    },
  );

  fastify.log.info("Health and metrics routes registered");
}

export default healthRoutes;
