/**
 * Driver Scoring API Routes
 *
 * Routes:
 *   GET    /leaderboard     Get top drivers leaderboard (period, limit)
 *   GET    /:driverId       Get single driver score + breakdown
 *   GET    /:driverId/history   Score history for a driver
 *   POST   /recalculate     Trigger recalculation for all drivers
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  aggregateDriverMetrics,
  aggregateAllDrivers,
  getLeaderboard,
  type DriverLeaderboardEntry,
  type DriverScore,
  type ScoringPeriod,
} from "@witylogix/core";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// ─── Query Schemas ──────────────────────────────────────────

const leaderboardQuery = z.object({
  period: z.enum(["daily", "weekly", "monthly", "all_time"]).optional().default("weekly"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const driverScoreHistoryQuery = z.object({
  period: z.enum(["daily", "weekly", "monthly", "all_time"]).optional().default("monthly"),
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

// ─── Route Plugin ───────────────────────────────────────────

async function driverScoringRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET LEADERBOARD ──────────────────────────────────────────
  /**
   * Get top drivers leaderboard for a given period
   * Query: period (daily|weekly|monthly|all_time), limit (1-100)
   */
  fastify.get("/leaderboard", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = leaderboardQuery.parse(request.query);
    const { period, limit } = query;

    try {
      // Get leaderboard from scoring engine
      const leaderboard = await getLeaderboard(
        request.tenantId,
        period as ScoringPeriod,
        limit,
prisma
      );

      return {
        data: leaderboard.entries,
        meta: {
          period: leaderboard.period,
          totalDrivers: leaderboard.totalDrivers,
          generatedAt: leaderboard.generatedAt,
          tenantId: leaderboard.tenantId,
        },
      };
    } catch (error) {
      throw new ValidationError(`Failed to fetch leaderboard: ${(error as Error).message}`);
    }
  });

  // ── GET SINGLE DRIVER SCORE ──────────────────────────────────
  /**
   * Get detailed score breakdown for a single driver
   * Includes: composite score, tier, trend, all component scores
   */
  fastify.get("/:driverId", async (request: FastifyRequest, reply: FastifyReply) => {
    const { driverId } = request.params as { driverId: string };

    try {
      // Verify driver exists and belongs to tenant
      const driver = await request.tenantDb.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true, avatar: true },
      });

      if (!driver) throw new NotFoundError("Driver", driverId);

      // Default to weekly period
      const period: ScoringPeriod = "weekly";

      // Aggregate metrics for this driver
      const metrics = await aggregateDriverMetrics(
        driverId,
        request.tenantId,
        period,
prisma
      );

      // Get score with breakdown
      const scoreResponse = await aggregateAllDrivers(
        request.tenantId,
        period,
        [driverId],
prisma
      );

      const score = scoreResponse[0];

      if (!score) {
        throw new ValidationError("Unable to calculate score for this driver");
      }

      return {
        data: {
          driverId: score.driverId,
          driverName: driver.name,
          avatar: driver.avatar,
          compositeScore: score.compositeScore,
          tier: score.tier,
          trend: score.trend,
          previousScore: score.previousScore,
          breakdown: {
            onTimeScore: score.breakdown.onTimeScore,
            customerRatingScore: score.breakdown.customerRatingScore,
            podComplianceScore: score.breakdown.podComplianceScore,
            routeEfficiencyScore: score.breakdown.routeEfficiencyScore,
            reliabilityScore: score.breakdown.reliabilityScore,
          },
          metrics: {
            totalDeliveries: metrics.totalDeliveries,
            onTimeCount: metrics.onTimeCount,
            lateCount: metrics.lateCount,
            avgDeliveryMinutes: metrics.avgDeliveryMinutes,
            avgCustomerRating:
              metrics.customerRatingCount > 0
                ? (metrics.customerRatingSum / metrics.customerRatingCount).toFixed(2)
                : null,
            podCompliancePercent:
              metrics.podComplianceCount + metrics.podMissedCount > 0
                ? (
                    (metrics.podComplianceCount /
                      (metrics.podComplianceCount + metrics.podMissedCount)) *
                    100
                  ).toFixed(1)
                : null,
            incidentCount: metrics.incidentCount,
          },
          period,
          calculatedAt: score.calculatedAt,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to fetch driver score: ${(error as Error).message}`);
    }
  });

  // ── GET DRIVER SCORE HISTORY ──────────────────────────────────
  /**
   * Get score history for a driver over time
   * Returns array of daily/weekly scores with timestamps
   */
  fastify.get("/:driverId/history", async (request: FastifyRequest, reply: FastifyReply) => {
    const { driverId } = request.params as { driverId: string };
    const query = driverScoreHistoryQuery.parse(request.query);
    const { period, days } = query;

    try {
      // Verify driver exists
      const driver = await request.tenantDb.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true },
      });

      if (!driver) throw new NotFoundError("Driver", driverId);

      // Query score history from database (if stored)
      // For now, return current scores as a placeholder
      // In production, would fetch from driverScoreHistory table
      const currentScores = await aggregateAllDrivers(
        request.tenantId,
        period as ScoringPeriod,
        [driverId],
prisma
      );

      const score = currentScores[0];

      if (!score) {
        throw new ValidationError("Unable to calculate score for this driver");
      }

      // Return historical data structure
      const history = [
        {
          timestamp: score.calculatedAt,
          compositeScore: score.compositeScore,
          tier: score.tier,
          trend: score.trend,
          breakdown: score.breakdown,
        },
      ];

      return {
        data: history,
        meta: {
          driverId,
          driverName: driver.name,
          period,
          days,
          dataPoints: history.length,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to fetch score history: ${(error as Error).message}`);
    }
  });

  // ── RECALCULATE ALL SCORES ──────────────────────────────────
  /**
   * Trigger manual recalculation of all driver scores
   * Admin/Dispatcher only
   * Returns count of drivers recalculated
   */
  fastify.post("/recalculate", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    try {
      // Get all active drivers in tenant
      const drivers = await request.tenantDb.driver.findMany({
        where: {
          tenantId: request.tenantId,
          isActive: true,
        },
        select: { id: true },
      });

      const driverIds = drivers.map((d) => d.id);

      if (driverIds.length === 0) {
        return {
          status: "ok",
          data: {
            driversRecalculated: 0,
            message: "No active drivers found",
          },
        };
      }

      // Recalculate scores for all drivers across all periods
      const periods: ScoringPeriod[] = ["daily", "weekly", "monthly", "all_time"];

      for (const period of periods) {
        await aggregateAllDrivers(request.tenantId, period, driverIds, prisma);
      }

      return {
        status: "ok",
        data: {
          driversRecalculated: driverIds.length,
          periodsProcessed: periods.length,
          message: `Recalculated scores for ${driverIds.length} drivers across ${periods.length} periods`,
        },
      };
    } catch (error) {
      throw new ValidationError(`Failed to recalculate scores: ${(error as Error).message}`);
    }
  });
}

export default driverScoringRoutes;
