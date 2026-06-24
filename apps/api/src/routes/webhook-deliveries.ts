/**
 * Webhook Delivery API Routes
 *
 * Routes:
 *   GET    /                      List webhook deliveries with filters and pagination
 *   GET    /:id                   Get single delivery detail with payload
 *   POST   /:id/retry             Retry a failed delivery
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().max(50).optional(),
  eventType: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const deliveryIdSchema = z.object({
  id: z.string().uuid(),
});

export default async function webhookDeliveriesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // GET / — List webhook deliveries
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuerySchema.parse(request.query);
    const tenantId = request.shopId;
    const skip = (query.page - 1) * query.limit;

    const where: Record<string, unknown> = { tenantId };

    if (query.status) {
      // Map frontend status values to DB values
      const statusMap: Record<string, string> = {
        success: "delivered",
        failed: "failed",
        pending: "pending",
        retrying: "pending",
      };
      where.status = statusMap[query.status] ?? query.status;
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.startDate || query.endDate) {
      const createdAt: Record<string, Date> = {};
      if (query.startDate) createdAt.gte = new Date(query.startDate);
      if (query.endDate) createdAt.lte = new Date(query.endDate);
      where.createdAt = createdAt;
    }

    const [deliveries, total] = await Promise.all([
      request.tenantDb.webhookDelivery.findMany({
        where,
        select: {
          id: true,
          eventType: true,
          status: true,
          responseStatus: true,
          durationMs: true,
          attempt: true,
          maxAttempts: true,
          error: true,
          createdAt: true,
          endpoint: {
            select: { url: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      request.tenantDb.webhookDelivery.count({ where }),
    ]);

    const data = deliveries.map((d) => ({
      id: d.id,
      eventType: d.eventType,
      endpointUrl: d.endpoint?.url ?? "",
      status: d.status === "delivered" ? "success" : d.status,
      statusCode: d.responseStatus,
      duration: d.durationMs ?? 0,
      attempt: d.attempt,
      maxAttempts: d.maxAttempts,
      error: d.error,
      timestamp: d.createdAt,
    }));

    return reply.code(200).send({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  });

  // GET /:id — Get delivery detail with full payload
  app.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = deliveryIdSchema.parse(request.params);
    const tenantId = request.shopId;

    const delivery = await request.tenantDb.webhookDelivery.findUnique({
      where: { id },
      include: {
        endpoint: { select: { url: true } },
      },
    });

    if (!delivery) {
      return reply.code(404).send({ error: "Webhook delivery not found" });
    }

    if (delivery.tenantId !== tenantId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    return reply.code(200).send({
      data: {
        id: delivery.id,
        eventType: delivery.eventType,
        endpointUrl: delivery.endpoint?.url ?? "",
        status: delivery.status === "delivered" ? "success" : delivery.status,
        statusCode: delivery.responseStatus,
        duration: delivery.durationMs ?? 0,
        attempt: delivery.attempt,
        maxAttempts: delivery.maxAttempts,
        error: delivery.error,
        timestamp: delivery.createdAt,
        requestHeaders: delivery.requestHeaders,
        requestBody: delivery.requestBody,
        responseHeaders: delivery.responseHeaders,
        responseBody: delivery.responseBody,
      },
    });
  });

  // POST /:id/retry — Retry a failed delivery
  app.post("/:id/retry", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = deliveryIdSchema.parse(request.params);
    const tenantId = request.shopId;

    const delivery = await request.tenantDb.webhookDelivery.findUnique({
      where: { id },
    });

    if (!delivery) {
      return reply.code(404).send({ error: "Webhook delivery not found" });
    }

    if (delivery.tenantId !== tenantId) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    if (!["failed", "pending"].includes(delivery.status)) {
      return reply.code(400).send({ error: "Cannot retry a non-failed delivery" });
    }

    if (delivery.attempt >= delivery.maxAttempts) {
      return reply.code(400).send({ error: `Maximum retry limit (${delivery.maxAttempts}) reached` });
    }

    const updated = await request.tenantDb.webhookDelivery.update({
      where: { id },
      data: {
        status: "pending",
        nextRetryAt: new Date(Date.now() + 60_000),
      },
    });

    return reply.code(200).send({
      data: {
        id: updated.id,
        status: updated.status,
        attempt: updated.attempt,
        maxAttempts: updated.maxAttempts,
        nextRetryAt: updated.nextRetryAt,
        message: `Delivery queued for retry (attempt ${updated.attempt}/${updated.maxAttempts})`,
      },
    });
  });
}
