/**
 * AI Slot Recommendation API Routes
 *
 * Routes:
 *   GET    /api/ai/slots/recommend     Recommend delivery slots for customer
 *   GET    /api/ai/demand              Demand forecast for zone
 *   GET    /api/ai/slots/top           Get single top recommended slot
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";
import {
  slotRecommender,
  demandPredictor,
  driverAvailabilityPredictor,
  type TimeSlot,
  type DriverShift,
  type ZoneCoverage,
} from "@witylogix/core/ai-slots";

// ─── Zod Schemas ────────────────────────────────────────────

const recommendSlotsQuerySchema = z.object({
  customerId: z.string().uuid(),
  zoneId: z.string().uuid(),
  date: z
    .string()
    .datetime()
    .transform((s) => new Date(s)),
  maxSlots: z.coerce.number().int().min(1).max(10).default(5),
});

const demandForecastQuerySchema = z.object({
  zoneId: z.string().uuid(),
  date: z
    .string()
    .datetime()
    .transform((s) => new Date(s)),
  hour: z.coerce.number().int().min(0).max(23).optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

export default async function aiSlotRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // NOTE: Time slots are loaded lazily when needed in route handlers

  // ── GET /api/ai/slots/recommend — Recommend slots ────────

  fastify.get<{ Querystring: z.infer<typeof recommendSlotsQuerySchema> }>(
    "/recommend",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = recommendSlotsQuerySchema.parse(request.query);
      const shopId = request.shopId;

      try {
        // Load customer preference if exists
        const customerPref = await (
          request.tenantDb as any
        ).customerDeliveryPreference.findFirst({
          where: {
            customerId: query.customerId,
            shopId,
          },
        });

        // Get recommendations
        const recommendations = slotRecommender.recommendSlots({
          customerId: query.customerId,
          zoneId: query.zoneId,
          date: query.date,
          maxSlots: query.maxSlots,
          customerPreference: customerPref
            ? {
                customerId: query.customerId,
                averageDeliveryValue: customerPref.averageOrderValue || 0,
                preferredHours: customerPref.preferredHours || [],
                preferredDays: customerPref.preferredDays || [],
                successRate: customerPref.successRate || 0.8,
                totalOrders: customerPref.totalOrders || 0,
                lastOrderDate: customerPref.lastOrderDate,
                averageDeliveryDuration:
                  customerPref.averageDeliveryDuration || 30,
              }
            : undefined,
        });

        return reply.send({
          recommendations,
          count: recommendations.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error recommending slots:");
        return reply.status(500).send({
          error: "Failed to generate slot recommendations",
        });
      }
    },
  );

  // ── GET /api/ai/slots/top — Get top recommendation ────────

  fastify.get<{ Querystring: z.infer<typeof recommendSlotsQuerySchema> }>(
    "/top",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = recommendSlotsQuerySchema.parse(request.query);
      const shopId = request.shopId;

      try {
        const customerPref = await (
          request.tenantDb as any
        ).customerDeliveryPreference.findFirst({
          where: {
            customerId: query.customerId,
            shopId,
          },
        });

        const top = slotRecommender.getTopRecommendation({
          customerId: query.customerId,
          zoneId: query.zoneId,
          date: query.date,
          customerPreference: customerPref
            ? {
                customerId: query.customerId,
                averageDeliveryValue: customerPref.averageOrderValue || 0,
                preferredHours: customerPref.preferredHours || [],
                preferredDays: customerPref.preferredDays || [],
                successRate: customerPref.successRate || 0.8,
                totalOrders: customerPref.totalOrders || 0,
                lastOrderDate: customerPref.lastOrderDate,
                averageDeliveryDuration:
                  customerPref.averageDeliveryDuration || 30,
              }
            : undefined,
        });

        if (!top) {
          return reply.status(404).send({
            error: "No available slots found",
          });
        }

        return reply.send({
          slot: top,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error getting top slot:");
        return reply.status(500).send({
          error: "Failed to get top slot recommendation",
        });
      }
    },
  );

  // ── GET /api/ai/demand — Demand forecast ────────────────────

  fastify.get<{ Querystring: z.infer<typeof demandForecastQuerySchema> }>(
    "/demand",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = demandForecastQuerySchema.parse(request.query);

      try {
        if (query.hour !== undefined) {
          // Single hour forecast
          const forecast = demandPredictor.predictDemand(
            query.zoneId,
            query.date,
            query.hour,
          );

          return reply.send({
            forecast,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Full day forecast
          const forecasts = demandPredictor.predictDemandBatch(
            query.zoneId,
            query.date,
            0,
            23,
          );

          const stats = demandPredictor.getZoneStatistics(query.zoneId);

          return reply.send({
            forecasts,
            statistics: stats,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Error predicting demand:");
        return reply.status(500).send({
          error: "Failed to predict demand",
        });
      }
    },
  );

  // ── GET /api/ai/demand/peak — Peak hours analysis ────────────

  fastify.get<{ Querystring: { zoneId: string } }>(
    "/demand/peak",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { zoneId } = request.query as { zoneId: string };

      try {
        const stats = demandPredictor.getZoneStatistics(zoneId);

        // Find peak hour
        let peakHour = 12;
        let maxDemand = 0;

        for (let hour = 0; hour < 24; hour++) {
          const pattern = demandPredictor.getHistoricalPattern(zoneId, 0);
          const demand = pattern.hourlyAverages[hour] || 0;

          if (demand > maxDemand) {
            maxDemand = demand;
            peakHour = hour;
          }
        }

        return reply.send({
          zoneId,
          peakHour,
          maxDemand,
          statistics: stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error({ err: error }, "Error analyzing peak hours:");
        return reply.status(500).send({
          error: "Failed to analyze peak hours",
        });
      }
    },
  );
}
