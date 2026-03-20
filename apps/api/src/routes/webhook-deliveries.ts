/**
 * Webhook Delivery API Routes
 *
 * Routes:
 *   GET    /                      List webhook deliveries with filters and pagination
 *   GET    /:id                   Get single delivery detail with payload
 *   POST   /:id/retry             Retry a failed delivery
 *
 * Features:
 *   - Pagination with configurable page size
 *   - Filtering by status (success/failed/pending), event type, date range
 *   - Full payload inspection (request/response)
 *   - Retry with idempotent logic
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { db } from "@witylogix/db";

// ─── ZODI VALIDATION SCHEMAS ────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["success", "failed", "pending"]).optional(),
  eventType: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const deliveryIdSchema = z.object({
  id: z.string().uuid(),
});

const retrySchema = z.object({
  id: z.string().uuid(),
});

// ─── ROUTE REGISTRATION ─────────────────────────────────

export default async function webhookDeliveriesRoutes(
  app: FastifyInstance
): Promise<void> {
  // All routes require authentication + tenant context
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── GET / — List webhook deliveries ─────────────────────

  app.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = listQuerySchema.parse(request.query);
        const shopId = request.shopId;

        // Calculate pagination
        const skip = (query.page - 1) * query.limit;

        // Build where clause
        interface Where {
          shopId: string;
          status?: string;
          eventType?: string;
          timestamp?: {
            gte?: string;
            lte?: string;
          };
        }

        const where: Where = { shopId };

        if (query.status) {
          where.status = query.status;
        }

        if (query.eventType) {
          where.eventType = query.eventType;
        }

        if (query.startDate || query.endDate) {
          where.timestamp = {};
          if (query.startDate) {
            where.timestamp.gte = query.startDate;
          }
          if (query.endDate) {
            where.timestamp.lte = query.endDate;
          }
        }

        // Fetch deliveries and total count
        const [deliveries, total] = await Promise.all([
          db.webhookDelivery.findMany({
            where,
            select: {
              id: true,
              eventType: true,
              endpointUrl: true,
              status: true,
              responseCode: true,
              duration: true,
              timestamp: true,
            },
            orderBy: { timestamp: "desc" },
            skip,
            take: query.limit,
          }),
          db.webhookDelivery.count({ where }),
        ]);

        const totalPages = Math.ceil(total / query.limit);

        return reply.code(200).send({
          data: deliveries,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: "Invalid query parameters",
            details: error.errors,
          });
        }
        throw error;
      }
    }
  );

  // ── GET /:id — Get delivery detail with payload ─────────

  app.get(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = deliveryIdSchema.parse(request.params);
        const shopId = request.shopId;

        const delivery = await db.webhookDelivery.findUnique({
          where: { id },
        });

        if (!delivery) {
          return reply.code(404).send({
            error: "Webhook delivery not found",
          });
        }

        // Verify ownership
        if (delivery.shopId !== shopId) {
          return reply.code(403).send({
            error: "Forbidden: You do not have access to this delivery",
          });
        }

        return reply.code(200).send({
          data: {
            id: delivery.id,
            eventType: delivery.eventType,
            endpointUrl: delivery.endpointUrl,
            status: delivery.status,
            responseCode: delivery.responseCode,
            duration: delivery.duration,
            timestamp: delivery.timestamp,
            requestPayload: delivery.requestPayload,
            responsePayload: delivery.responsePayload,
            errorMessage: delivery.errorMessage,
            retryCount: delivery.retryCount,
            nextRetryAt: delivery.nextRetryAt,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: "Invalid request parameters",
            details: error.errors,
          });
        }
        throw error;
      }
    }
  );

  // ── POST /:id/retry — Retry a failed delivery ────────────

  app.post(
    "/:id/retry",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = retrySchema.parse(request.params);
        const shopId = request.shopId;

        // Find the delivery
        const delivery = await db.webhookDelivery.findUnique({
          where: { id },
        });

        if (!delivery) {
          return reply.code(404).send({
            error: "Webhook delivery not found",
          });
        }

        // Verify ownership
        if (delivery.shopId !== shopId) {
          return reply.code(403).send({
            error: "Forbidden: You do not have access to this delivery",
          });
        }

        // Only allow retrying failed/pending deliveries
        if (!["failed", "pending"].includes(delivery.status)) {
          return reply.code(400).send({
            error: "Cannot retry a successful delivery",
          });
        }

        // Increment retry count
        const maxRetries = 5;
        if (delivery.retryCount >= maxRetries) {
          return reply.code(400).send({
            error: `Maximum retry limit (${maxRetries}) reached`,
          });
        }

        // Update delivery status to pending and increment retry count
        const updatedDelivery = await db.webhookDelivery.update({
          where: { id },
          data: {
            status: "pending",
            retryCount: delivery.retryCount + 1,
            nextRetryAt: new Date(Date.now() + 60000), // Retry in 1 minute
            updatedAt: new Date(),
          },
        });

        // In a real scenario, you would queue this for processing by a worker
        // For example: await webhookQueue.enqueue({ deliveryId: id })

        return reply.code(200).send({
          data: {
            id: updatedDelivery.id,
            status: updatedDelivery.status,
            retryCount: updatedDelivery.retryCount,
            nextRetryAt: updatedDelivery.nextRetryAt,
            message: `Delivery queued for retry (attempt ${updatedDelivery.retryCount}/${maxRetries})`,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: "Invalid request parameters",
            details: error.errors,
          });
        }
        throw error;
      }
    }
  );

  // ── Health endpoint ─────────────────────────────────────

  app.get("/health/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.shopId;
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, success, failed, pending, avgDuration] = await Promise.all([
      db.webhookDelivery.count({
        where: {
          shopId,
          timestamp: { gte: last24h },
        },
      }),
      db.webhookDelivery.count({
        where: {
          shopId,
          status: "success",
          timestamp: { gte: last24h },
        },
      }),
      db.webhookDelivery.count({
        where: {
          shopId,
          status: "failed",
          timestamp: { gte: last24h },
        },
      }),
      db.webhookDelivery.count({
        where: {
          shopId,
          status: "pending",
          timestamp: { gte: last24h },
        },
      }),
      db.webhookDelivery.aggregate({
        where: {
          shopId,
          timestamp: { gte: last24h },
          duration: { gt: 0 },
        },
        _avg: {
          duration: true,
        },
      }),
    ]);

    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : "0";

    return reply.code(200).send({
      data: {
        period: "24h",
        total,
        success,
        failed,
        pending,
        successRate: parseFloat(successRate),
        avgDuration: Math.round(avgDuration._avg.duration || 0),
      },
    });
  });
}
