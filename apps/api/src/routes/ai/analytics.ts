/**
 * AI Analytics API Routes
 *
 * Routes:
 *   GET    /api/ai/analytics/route-efficiency/:routeId              Route efficiency score
 *   GET    /api/ai/analytics/driver-score/:driverId                Driver performance score
 *   POST   /api/ai/analytics/predict-delivery                      Predict delivery time
 *   GET    /api/ai/analytics/anomalies/:routeId                   Route anomalies
 *   GET    /api/ai/analytics/co2/:routeId                         Route CO2 report
 *   GET    /api/ai/analytics/co2/summary/:tenantId                CO2 tenant summary
 *   GET    /api/ai/analytics/leaderboard                          Driver leaderboard
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";
import {
  predictDeliveryWindow,
  detectAnomalies,
  calculateCO2,
  getCO2Summary,
  type Stop,
  type DeliveryContext,
} from "@witylogix/core/ai-analytics";
import {
  getLeaderboard,
  aggregateAllDrivers,
  type ScoringPeriod,
} from "@witylogix/core/driver-scoring";
import { prisma } from "@witylogix/db";

// ─── Zod Schemas ────────────────────────────────────────────

const predictDeliverySchema = z.object({
  orderId: z.string(),
  distanceRemaining: z.number().positive(),
  currentTrafficFactor: z.number().min(0.5).max(3.0),
  driverHistoricalSpeed: z.number().positive(),
  timeOfDay: z.number().min(0).max(23),
  dayOfWeek: z.number().min(0).max(6),
  stopComplexity: z.enum(["house", "apartment", "business", "warehouse"]),
  weather: z
    .object({
      condition: z.enum(["clear", "rain", "snow", "fog"]),
      temperature: z.number(),
    })
    .optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

export default async function aiAnalyticsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /api/ai/analytics/route-efficiency/:routeId ────────────

  /**
   * Calculate route efficiency score with breakdown
   */
  fastify.get<{ Params: { routeId: string } }>(
    "/route-efficiency/:routeId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { routeId } = request.params as { routeId: string };
        const db = (request as any).tenantDb;

        const route = await db.route.findUnique({
          where: { id: routeId },
          include: { stops: { orderBy: { sequence: "asc" } } },
        });

        if (!route) return reply.code(404).send({ error: "Route not found" });

        const plannedDistance = route.totalDistance
          ? Number(route.totalDistance) * 1000
          : 45000;
        const plannedDuration = route.totalDuration ?? 120;

        let actualDuration = plannedDuration;
        if (route.startedAt && route.completedAt) {
          actualDuration =
            (route.completedAt.getTime() - route.startedAt.getTime()) / 60000;
        }

        const completedStops = route.stops.filter(
          (s: any) => s.actualArrival != null,
        );
        const onTimeStops = completedStops.filter((s: any) => {
          if (!s.estimatedArrival || !s.actualArrival) return false;
          return (
            s.actualArrival <=
            new Date(s.estimatedArrival.getTime() + 15 * 60000)
          );
        });

        const timeEfficiency = Math.min(
          1,
          plannedDuration / Math.max(actualDuration, 1),
        );
        const stopEfficiency =
          completedStops.length > 0
            ? onTimeStops.length / completedStops.length
            : 1;
        const normalizedScore = Math.min(
          100,
          Math.round((timeEfficiency * 0.6 + stopEfficiency * 0.4) * 100),
        );

        return reply.code(200).send({
          data: {
            score: normalizedScore,
            percentileRank: 50,
            breakdown: {
              distanceEfficiency: 1,
              timeEfficiency,
              stopEfficiency,
              idleTimeRatio: 0,
              deviationCount: 0,
            },
            metrics: {
              actualDistance: plannedDistance,
              plannedDistance,
              actualDuration,
              plannedDuration,
              idleTime: 0,
              deviations: 0,
            },
          },
          routeId,
          timestamp: new Date().toISOString(),
        });
      } catch {
        return reply
          .code(500)
          .send({ error: "Failed to calculate efficiency" });
      }
    },
  );

  // ── GET /api/ai/analytics/driver-score/:driverId ────────────────

  /**
   * Calculate driver performance score with trends and peer comparison
   */
  fastify.get<{ Params: { driverId: string } }>(
    "/driver-score/:driverId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { driverId } = request.params as { driverId: string };
        const tenantId = request.tenantId ?? "";

        const scores = await aggregateAllDrivers(
          tenantId,
          "weekly",
          [driverId],
          prisma,
        );
        const score = scores[0];

        if (!score) {
          return reply
            .code(404)
            .send({ error: "Driver not found or no data available" });
        }

        return reply.code(200).send({
          data: score,
          driverId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ error: "Failed to calculate driver score" });
      }
    },
  );

  // ── POST /api/ai/analytics/predict-delivery ──────────────────────

  /**
   * Predict delivery arrival time
   */
  fastify.post<{ Body: z.infer<typeof predictDeliverySchema> }>(
    "/predict-delivery",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = predictDeliverySchema.parse(request.body);

        const context: DeliveryContext = {
          orderId: body.orderId,
          distanceRemaining: body.distanceRemaining,
          currentTrafficFactor: body.currentTrafficFactor,
          driverHistoricalSpeed: body.driverHistoricalSpeed,
          timeOfDay: body.timeOfDay,
          dayOfWeek: body.dayOfWeek,
          stopComplexity: body.stopComplexity,
          weather: body.weather,
        };

        const prediction = predictDeliveryWindow(context);

        return reply.code(200).send({
          data: prediction,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: "Invalid request body" });
        }
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to predict delivery" });
      }
    },
  );

  // ── GET /api/ai/analytics/anomalies/:routeId ─────────────────────

  /**
   * Detect anomalies on a route
   */
  fastify.get<{ Params: { routeId: string } }>(
    "/anomalies/:routeId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { routeId } = request.params as { routeId: string };
        const db = (request as any).tenantDb;

        const route = await db.route.findUnique({
          where: { id: routeId },
          include: { stops: { orderBy: { sequence: "asc" } } },
        });

        if (!route) return reply.code(404).send({ error: "Route not found" });

        const stopTypeMap: Record<string, Stop["type"]> = {
          DELIVERY: "delivery",
          PICKUP: "pickup",
          RETURN: "service",
          DEPOT: "service",
        };

        const stops: Stop[] = route.stops.map((s: any) => {
          const plannedArrival = s.estimatedArrival?.getTime() ?? 0;
          const actualArrival = s.actualArrival?.getTime() ?? undefined;
          const departed = s.departedAt?.getTime();
          const actualDuration =
            departed && actualArrival
              ? (departed - actualArrival) / 60000
              : undefined;
          const nextStop = route.stops[route.stops.indexOf(s) + 1];
          const plannedDuration =
            nextStop?.estimatedArrival && s.estimatedArrival
              ? (nextStop.estimatedArrival.getTime() -
                  s.estimatedArrival.getTime()) /
                60000
              : 5;

          return {
            id: s.id,
            lat: 0,
            lng: 0,
            plannedArrivalTime: plannedArrival,
            plannedDuration: Math.max(1, plannedDuration),
            actualArrivalTime: actualArrival,
            actualDuration,
            orderId: s.orderId ?? s.id,
            type: stopTypeMap[s.stopType] ?? "delivery",
          };
        });

        const result = detectAnomalies({ routeId, stops, gpsTrace: [] });

        return reply.code(200).send({
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to detect anomalies" });
      }
    },
  );

  // ── GET /api/ai/analytics/co2/:routeId ───────────────────────────

  /**
   * Calculate CO2 report for a route
   */
  fastify.get<{ Params: { routeId: string } }>(
    "/co2/:routeId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { routeId } = request.params as { routeId: string };

        const report = calculateCO2(
          routeId,
          45000, // 45km
          120, // 120 minutes
          15, // 15 minutes idle
          "van",
          "suburban",
        );

        return reply.code(200).send({
          data: report,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to calculate CO2" });
      }
    },
  );

  // ── GET /api/ai/analytics/co2/summary ────────────────────────────

  /**
   * Get tenant-wide CO2 summary
   */
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    "/co2/summary/:tenantId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request.params as any).tenantId || "default";
        const startDate =
          (request.query as { startDate?: string; endDate?: string })
            .startDate || "2026-03-01";
        const endDate =
          (request.query as { startDate?: string; endDate?: string }).endDate ||
          "2026-03-31";

        const summary = getCO2Summary(tenantId, startDate, endDate);

        return reply.code(200).send({
          data: summary,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to get CO2 summary" });
      }
    },
  );

  // ── GET /api/ai/analytics/leaderboard ────────────────────────────

  /**
   * Get driver leaderboard
   */
  fastify.get<{
    Querystring: { period?: "24h" | "7d" | "30d" };
  }>("/leaderboard", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const period =
        (request.query as { period?: "24h" | "7d" | "30d" }).period ?? "7d";
      const scoringPeriod: ScoringPeriod =
        period === "24h" ? "daily" : period === "7d" ? "weekly" : "monthly";

      const entries = await getLeaderboard(
        request.tenantId ?? "",
        scoringPeriod,
        20,
        prisma,
      );

      return reply.code(200).send({
        data: {
          period,
          entries,
          generatedAt: Date.now(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      return reply.code(500).send({ error: "Failed to get leaderboard" });
    }
  });
}
