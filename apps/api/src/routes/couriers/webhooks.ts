/**
 * Courier Webhook Routes
 *
 * Handles incoming webhooks from courier providers:
 * - POST /webhooks/onfleet — Onfleet webhook receiver
 * - POST /webhooks/stuart — Stuart webhook receiver
 * - POST /webhooks/uber-direct — Uber Direct webhook receiver
 *
 * Each endpoint:
 * 1. Verifies signature
 * 2. Checks for duplicate webhooks (idempotency)
 * 3. Normalizes to unified event format
 * 4. Updates delivery status
 * 5. Logs for audit trail
 * 6. Emits domain events
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import {
  processWebhook,
  verifyOnfleetSignature,
  verifyStuartSignature,
  verifyUberDirectSignature,
} from "@witylogix/core/integrations/couriers/webhooks";

// ─── WEBHOOK RECEIVER SCHEMAS ───────────────────────────────────────────

/**
 * Onfleet webhook signature verification schema
 * Header: X-Onfleet-Signature (HMAC-SHA512)
 */
const onfleetWebhookSchema = z.object({
  id: z.string(),
  triggerId: z.string(),
  action: z.string(),
  time: z.number(),
  taskId: z.string().optional(),
  workerId: z.string().optional(),
  teamId: z.string().optional(),
  data: z.record(z.unknown()),
});

/**
 * Stuart webhook signature verification schema
 * Header: X-Stuart-Signature (HMAC-SHA256)
 */
const stuartWebhookSchema = z.object({
  event_id: z.string(),
  event: z.string(),
  timestamp: z.number(),
  data: z.object({
    id: z.string(),
    status: z.string(),
    customer_reference: z.string().optional(),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
  }),
});

/**
 * Uber Direct webhook signature verification schema
 * Header: X-Uber-Signature (HMAC-SHA256)
 */
const uberDirectWebhookSchema = z.object({
  delivery_id: z.string(),
  status: z.string(),
  event_type: z.string(),
  event_id: z.string(),
  timestamp: z.string(),
  data: z.object({
    previous_status: z.string().optional(),
    current_status: z.string().optional(),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
  }),
});

// ─── ROUTE REGISTRATION ─────────────────────────────────────────────────

export default async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // ── Onfleet Webhook ───────────────────────────────────────────────

  app.post<{ Body: unknown }>(
    "/webhooks/onfleet",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get signature from header
        const signature = request.headers["x-onfleet-signature"] as string;
        if (!signature) {
          return reply.code(401).send({ error: "Missing X-Onfleet-Signature header" });
        }

        // Get request body as string for signature verification
        const bodyString = request.rawBody?.toString("utf-8") || JSON.stringify(request.body);

        // Validate payload schema
        const validatedPayload = onfleetWebhookSchema.parse(request.body);

        // Find partner by provider
        const partner = await prisma.courierPartner.findFirst({
          where: {
            provider: "onfleet",
          },
        });

        if (!partner) {
          return reply.code(404).send({ error: "Onfleet partner not configured" });
        }

        // Get webhook secret from partner credentials
        const credentials = typeof partner.credentials === "string"
          ? JSON.parse(partner.credentials)
          : partner.credentials;
        const secret = credentials.webhookSecret || credentials.apiKey;

        if (!secret) {
          return reply.code(500).send({ error: "Webhook secret not configured" });
        }

        // Process webhook
        const result = await processWebhook(
          "onfleet",
          JSON.stringify(validatedPayload),
          signature,
          secret,
          partner.id,
          bodyString
        );

        if (!result.success && !result.isDuplicate) {
          return reply.code(400).send({ error: result.error });
        }

        // Return 200 OK to acknowledge receipt
        reply.code(200).send({
          success: true,
          deliveryId: result.deliveryId,
          isDuplicate: result.isDuplicate,
        });
      } catch (error) {
        console.error("[Webhook] Onfleet error:", error);
        reply.code(400).send({
          error: error instanceof Error ? error.message : "Invalid payload",
        });
      }
    }
  );

  // ── Stuart Webhook ────────────────────────────────────────────────

  app.post<{ Body: unknown }>(
    "/webhooks/stuart",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get signature from header
        const signature = request.headers["x-stuart-signature"] as string;
        if (!signature) {
          return reply.code(401).send({ error: "Missing X-Stuart-Signature header" });
        }

        // Get request body as string for signature verification
        const bodyString = request.rawBody?.toString("utf-8") || JSON.stringify(request.body);

        // Validate payload schema
        const validatedPayload = stuartWebhookSchema.parse(request.body);

        // Find partner by provider
        const partner = await prisma.courierPartner.findFirst({
          where: {
            provider: "stuart",
          },
        });

        if (!partner) {
          return reply.code(404).send({ error: "Stuart partner not configured" });
        }

        // Get webhook secret from partner credentials
        const credentials = typeof partner.credentials === "string"
          ? JSON.parse(partner.credentials)
          : partner.credentials;
        const secret = credentials.webhookSecret || credentials.clientSecret;

        if (!secret) {
          return reply.code(500).send({ error: "Webhook secret not configured" });
        }

        // Process webhook
        const result = await processWebhook(
          "stuart",
          JSON.stringify(validatedPayload),
          signature,
          secret,
          partner.id,
          bodyString
        );

        if (!result.success && !result.isDuplicate) {
          return reply.code(400).send({ error: result.error });
        }

        // Return 200 OK to acknowledge receipt
        reply.code(200).send({
          success: true,
          deliveryId: result.deliveryId,
          isDuplicate: result.isDuplicate,
        });
      } catch (error) {
        console.error("[Webhook] Stuart error:", error);
        reply.code(400).send({
          error: error instanceof Error ? error.message : "Invalid payload",
        });
      }
    }
  );

  // ── Uber Direct Webhook ───────────────────────────────────────────

  app.post<{ Body: unknown }>(
    "/webhooks/uber-direct",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get signature from header
        const signature = request.headers["x-uber-signature"] as string;
        if (!signature) {
          return reply.code(401).send({ error: "Missing X-Uber-Signature header" });
        }

        // Get request body as string for signature verification
        const bodyString = request.rawBody?.toString("utf-8") || JSON.stringify(request.body);

        // Validate payload schema
        const validatedPayload = uberDirectWebhookSchema.parse(request.body);

        // Find partner by provider
        const partner = await prisma.courierPartner.findFirst({
          where: {
            provider: "uber_direct",
          },
        });

        if (!partner) {
          return reply.code(404).send({ error: "Uber Direct partner not configured" });
        }

        // Get webhook secret from partner credentials
        const credentials = typeof partner.credentials === "string"
          ? JSON.parse(partner.credentials)
          : partner.credentials;
        const secret = credentials.webhookSecret || credentials.clientSecret;

        if (!secret) {
          return reply.code(500).send({ error: "Webhook secret not configured" });
        }

        // Process webhook
        const result = await processWebhook(
          "uber_direct",
          JSON.stringify(validatedPayload),
          signature,
          secret,
          partner.id,
          bodyString
        );

        if (!result.success && !result.isDuplicate) {
          return reply.code(400).send({ error: result.error });
        }

        // Return 200 OK to acknowledge receipt
        reply.code(200).send({
          success: true,
          deliveryId: result.deliveryId,
          isDuplicate: result.isDuplicate,
        });
      } catch (error) {
        console.error("[Webhook] Uber Direct error:", error);
        reply.code(400).send({
          error: error instanceof Error ? error.message : "Invalid payload",
        });
      }
    }
  );

  // ── Webhook Health Check ───────────────────────────────────────────

  app.get<{ Querystring: { partner?: string } }>(
    "/webhooks/health",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const partnerName = request.query.partner;

      if (partnerName) {
        const partner = await prisma.courierPartner.findFirst({
          where: { provider: partnerName },
        });

        if (!partner) {
          return reply.code(404).send({
            error: `Partner not found: ${partnerName}`,
          });
        }

        const recentLogs = await prisma.courierWebhookLog.findMany({
          where: { partnerId: partner.id },
          orderBy: { receivedAt: "desc" },
          take: 10,
        });

        return reply.send({
          partner: partnerName,
          partnerId: partner.id,
          status: partner.healthStatus,
          lastWebhookAt: recentLogs[0]?.receivedAt || null,
          recentWebhookCount: recentLogs.length,
          errors: recentLogs
            .filter((log) => log.error)
            .map((log) => ({
              eventId: log.eventId,
              error: log.error,
              timestamp: log.receivedAt,
            })),
        });
      }

      // Get health for all partners
      const partners = await prisma.courierPartner.findMany();

      const health = await Promise.all(
        partners.map(async (partner) => {
          const recentLogs = await prisma.courierWebhookLog.findMany({
            where: { partnerId: partner.id },
            orderBy: { receivedAt: "desc" },
            take: 1,
          });

          return {
            provider: partner.provider,
            status: partner.healthStatus,
            lastWebhookAt: recentLogs[0]?.receivedAt || null,
          };
        })
      );

      reply.send({
        timestamp: new Date(),
        partners: health,
      });
    }
  );

  // ── Webhook Logs (Admin) ───────────────────────────────────────────

  app.get<{
    Querystring: {
      partnerId?: string;
      limit?: string;
      offset?: string;
      eventType?: string;
    };
  }>(
    "/webhooks/logs",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId, eventType, limit = "50", offset = "0" } = request.query;
      const pageLimit = Math.min(parseInt(limit), 500);
      const pageOffset = parseInt(offset);

      const where: any = {};
      if (partnerId) where.partnerId = partnerId;
      if (eventType) where.eventType = eventType;

      const logs = await prisma.courierWebhookLog.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take: pageLimit,
        skip: pageOffset,
      });

      const total = await prisma.courierWebhookLog.count({ where });

      reply.send({
        logs: logs.map((log) => ({
          id: log.id,
          partnerId: log.partnerId,
          eventType: log.eventType,
          eventId: log.eventId,
          processed: log.processed,
          error: log.error,
          receivedAt: log.receivedAt,
        })),
        pagination: {
          limit: pageLimit,
          offset: pageOffset,
          total,
        },
      });
    }
  );

  // ── Retry Failed Webhooks (Admin) ──────────────────────────────────

  app.post<{ Body: { partnerId: string; limit?: number } }>(
    "/webhooks/retry",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId, limit = 10 } = request.body;

      const failedLogs = await prisma.courierWebhookLog.findMany({
        where: {
          partnerId,
          processed: false,
        },
        take: limit,
        orderBy: { receivedAt: "asc" },
      });

      let successCount = 0;

      for (const log of failedLogs) {
        try {
          // Re-attempt processing
          const partner = await prisma.courierPartner.findUnique({
            where: { id: partnerId },
          });

          if (!partner) continue;

          const credentials = typeof partner.credentials === "string"
            ? JSON.parse(partner.credentials)
            : partner.credentials;
          const secret = credentials.webhookSecret || credentials.apiKey;

          if (!secret) continue;

          const result = await processWebhook(
            partner.provider as "onfleet" | "stuart" | "uber_direct",
            JSON.stringify(log.payload),
            log.eventId, // Use eventId as signature placeholder
            secret,
            partnerId,
            JSON.stringify(log.payload)
          );

          if (result.success) {
            await prisma.courierWebhookLog.update({
              where: { id: log.id },
              data: {
                processed: true,
                processedAt: new Date(),
                error: null,
              },
            });
            successCount++;
          }
        } catch {
          // Continue to next log
        }
      }

      reply.send({
        attempted: failedLogs.length,
        succeeded: successCount,
        failed: failedLogs.length - successCount,
      });
    }
  );
}
