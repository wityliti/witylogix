// @ts-nocheck
/**
 * Outbound Webhooks API Routes
 *
 * Handles tenant webhook subscriptions to platform events:
 *   POST   /api/webhooks              Register new webhook endpoint
 *   GET    /api/webhooks              List endpoints for tenant
 *   GET    /api/webhooks/:id          Get endpoint details
 *   PATCH  /api/webhooks/:id          Update endpoint configuration
 *   DELETE /api/webhooks/:id          Deactivate endpoint
 *   POST   /api/webhooks/:id/test     Send test webhook
 *   GET    /api/webhooks/:id/deliveries  Delivery history (paginated)
 *   POST   /api/webhooks/:id/deliveries/:deliveryId/retry  Manual retry
 *   POST   /api/webhooks/:id/rotate-secret  Rotate signing secret
 *   GET    /api/webhooks/stats        Webhook statistics
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import {
  WebhookManager,
  WebhookDeliveryService,
  getWebhookManager,
  getWebhookDeliveryService,
} from "@witylogix/core/webhooks";

// ─── Zod Schemas ────────────────────────────────────────────

const createWebhookSchema = z.object({
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.string()).min(1, "At least one event type required"),
  active: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

const updateWebhookSchema = createWebhookSchema.partial();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const deliveryFiltersSchema = paginationSchema.extend({
  status: z.enum(["pending", "delivering", "delivered", "failed", "circuit_open"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

async function outboundWebhooksRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // Initialize webhook manager
  const webhookManager = getWebhookManager(prisma);
  const deliveryService = getWebhookDeliveryService(webhookManager, prisma);

  // ── CREATE WEBHOOK ENDPOINT ────────────────────────────────

  fastify.post<{ Body: any }>(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createWebhookSchema.parse(request.body);
        const tenantId = request.shopId; // Using shopId as tenantId

        request.log.info(
          { tenantId, url: body.url, events: body.events },
          "Creating webhook endpoint"
        );

        const endpoint = await webhookManager.registerEndpoint(tenantId, body);

        reply.status(201);
        return {
          data: endpoint,
          message: "Webhook endpoint created successfully",
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.status(400);
          return {
            error: "Validation failed",
            details: error.errors,
          };
        }

        request.log.error(error, "Failed to create webhook");
        reply.status(500);
        return {
          error: error instanceof Error ? error.message : "Internal server error",
        };
      }
    }
  );

  // ── LIST WEBHOOK ENDPOINTS ─────────────────────────────────

  fastify.get<{ Querystring: any }>(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = paginationSchema.parse(request.query);
        const tenantId = request.shopId;

        const result = await webhookManager.listEndpoints(
          tenantId,
          undefined,
          { page: query.page, limit: query.limit }
        );

        return {
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
          },
        };
      } catch (error) {
        request.log.error(error, "Failed to list webhooks");
        reply.status(500);
        return {
          error: "Failed to list webhooks",
        };
      }
    }
  );

  // ── GET WEBHOOK ENDPOINT DETAILS ───────────────────────────

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const endpoint = await webhookManager.getEndpoint(id);

        if (!endpoint) {
          reply.status(404);
          return { error: "Webhook endpoint not found" };
        }

        // Verify ownership
        if (endpoint.tenantId !== request.shopId) {
          reply.status(403);
          return { error: "Unauthorized" };
        }

        // Don't expose the secret in the response
        const { secret, ...safeEndpoint } = endpoint;

        return { data: safeEndpoint };
      } catch (error) {
        request.log.error(error, "Failed to get webhook");
        reply.status(500);
        return { error: "Failed to get webhook" };
      }
    }
  );

  // ── UPDATE WEBHOOK ENDPOINT ────────────────────────────────

  fastify.patch<{ Params: { id: string }; Body: any }>(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const body = updateWebhookSchema.parse(request.body);

        const endpoint = await webhookManager.getEndpoint(id);

        if (!endpoint) {
          reply.status(404);
          return { error: "Webhook endpoint not found" };
        }

        if (endpoint.tenantId !== request.shopId) {
          reply.status(403);
          return { error: "Unauthorized" };
        }

        request.log.info({ id }, "Updating webhook endpoint");

        const updated = await webhookManager.updateEndpoint(id, body);

        const { secret, ...safeEndpoint } = updated;
        return {
          data: safeEndpoint,
          message: "Webhook endpoint updated successfully",
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.status(400);
          return {
            error: "Validation failed",
            details: error.errors,
          };
        }

        request.log.error(error, "Failed to update webhook");
        reply.status(500);
        return {
          error: error instanceof Error ? error.message : "Internal server error",
        };
      }
    }
  );

  // ── DELETE WEBHOOK ENDPOINT ────────────────────────────────

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const endpoint = await webhookManager.getEndpoint(id);

        if (!endpoint) {
          reply.status(404);
          return { error: "Webhook endpoint not found" };
        }

        if (endpoint.tenantId !== request.shopId) {
          reply.status(403);
          return { error: "Unauthorized" };
        }

        request.log.info({ id }, "Deleting webhook endpoint");

        await webhookManager.deleteEndpoint(id);

        return {
          message: "Webhook endpoint deleted successfully",
        };
      } catch (error) {
        request.log.error(error, "Failed to delete webhook");
        reply.status(500);
        return { error: "Failed to delete webhook" };
      }
    }
  );

  // ── SEND TEST WEBHOOK ──────────────────────────────────────

  fastify.post<{ Params: { id: string } }>(
    "/:id/test",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const endpoint = await webhookManager.getEndpoint(id);

        if (!endpoint) {
          reply.status(404);
          return { error: "Webhook endpoint not found" };
        }

        if (endpoint.tenantId !== request.shopId) {
          reply.status(403);
          return { error: "Unauthorized" };
        }

        request.log.info({ id }, "Sending test webhook");

        const result = await webhookManager.sendTestWebhook(id);

        return {
          data: result,
          message: "Test webhook sent successfully",
        };
      } catch (error) {
        request.log.error(error, "Failed to send test webhook");
        reply.status(500);
        return {
          error: error instanceof Error ? error.message : "Failed to send test webhook",
        };
      }
    }
  );

  // ── GET DELIVERY HISTORY ───────────────────────────────────

  fastify.get<{ Params: { id: string }; Querystring: any }>(
    "/:id/deliveries",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const query = deliveryFiltersSchema.parse(request.query);

        const endpoint = await webhookManager.getEndpoint(id);

        if (!endpoint) {
          reply.status(404);
          return { error: "Webhook endpoint not found" };
        }

        if (endpoint.tenantId !== request.shopId) {
          reply.status(403);
          return { error: "Unauthorized" };
        }

        const result = await webhookManager.getDeliveryHistory(id, {
          page: query.page,
          limit: query.limit,
        });

        // Filter by status if provided
        let data = result.data;
        if (query.status) {
          data = data.filter((d) => d.status === query.status);
        }

        return {
          data,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / query.limit),
          },
        };
      } catch (error) {
        request.log.error(error, "Failed to get delivery history");
        reply.status(500);
        return { error: "Failed to get delivery history" };
      }
    }
  );

  // ── MANUAL RETRY DELIVERY ──────────────────────────────────

  fastify.post<{ Params: { id: string; deliveryId: string } }>(
    "/:id/deliveries/:deliveryId/retry",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, deliveryId } = request.params;

        const endpoint = await webhookManager.getEndpoint(id);

        if (!endpoint) {
          reply.status(404);
          return { error: "Webhook endpoint not found" };
        }

        if (endpoint.tenantId !== request.shopId) {
          reply.status(403);
          return { error: "Unauthorized" };
        }

        request.log.info({ deliveryId }, "Retrying webhook delivery");

        const updated = await deliveryService.retryDelivery(deliveryId);

        if (!updated) {
          reply.status(404);
          return { error: "Delivery not found" };
        }

        return {
          data: updated,
          message: "Delivery queued for retry",
        };
      } catch (error) {
        request.log.error(error, "Failed to retry delivery");
        reply.status(500);
        return {
          error: error instanceof Error ? error.message : "Failed to retry delivery",
        };
      }
    }
  );

  // ── ROTATE WEBHOOK SECRET ──────────────────────────────────

  fastify.post<{ Params: { id: string } }>(
    "/:id/rotate-secret",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const endpoint = await webhookManager.getEndpoint(id);

        if (!endpoint) {
          reply.status(404);
          return { error: "Webhook endpoint not found" };
        }

        if (endpoint.tenantId !== request.shopId) {
          reply.status(403);
          return { error: "Unauthorized" };
        }

        request.log.info({ id }, "Rotating webhook secret");

        const updated = await webhookManager.rotateSecret(id);

        // Return the new secret (one-time)
        return {
          data: {
            id: updated.id,
            secret: updated.secret,
            message: "Secret rotated. Save this new secret securely.",
          },
        };
      } catch (error) {
        request.log.error(error, "Failed to rotate secret");
        reply.status(500);
        return {
          error: error instanceof Error ? error.message : "Failed to rotate secret",
        };
      }
    }
  );

  // ── AD-HOC WEBHOOK TEST ────────────────────────────────────
  // Sends a test payload to an arbitrary URL server-side (avoids browser CORS).

  fastify.post<{ Body: any }>(
    "/test",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        url: z.string().url("Invalid target URL"),
        eventType: z.string().min(1),
        payload: z.record(z.any()).optional().default({}),
      });
      const body = schema.parse(request.body);
      const start = Date.now();

      try {
        const res = await fetch(body.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Witylogix-Event": body.eventType },
          body: JSON.stringify(body.payload),
          signal: AbortSignal.timeout(10000),
        });
        const duration = Date.now() - start;
        const responseText = await res.text().catch(() => "");

        return {
          success: res.ok,
          statusCode: res.status,
          duration,
          response: responseText,
        };
      } catch (error) {
        const duration = Date.now() - start;
        reply.status(502);
        return {
          success: false,
          statusCode: 502,
          duration,
          response: error instanceof Error ? error.message : "Delivery failed",
        };
      }
    }
  );

  // ── WEBHOOK STATISTICS ─────────────────────────────────────

  fastify.get(
    "/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.shopId;

        request.log.debug({ tenantId }, "Fetching webhook statistics");

        const stats = await webhookManager.getStats(tenantId);

        return { data: stats };
      } catch (error) {
        request.log.error(error, "Failed to get statistics");
        reply.status(500);
        return { error: "Failed to get statistics" };
      }
    }
  );
}

export default outboundWebhooksRoutes;
