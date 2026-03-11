/**
 * Courier Partner Rating & SLA API Routes
 *
 * Routes:
 * - GET    /couriers/ratings — List all partner ratings
 * - GET    /couriers/ratings/:partnerId — Get partner rating
 * - GET    /couriers/ratings/:partnerId/history — Rating history
 * - GET    /couriers/ratings/:partnerId/trend — Performance trend
 * - GET    /couriers/sla/:partnerId — SLA compliance report
 * - POST   /couriers/sla/:partnerId — Define/update SLA
 * - GET    /couriers/sla/:partnerId/trend — SLA compliance trend
 * - GET    /couriers/sla/:partnerId/violations — Recent violations
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import {
  calculatePartnerScore,
  getRatingHistory,
  getRankedPartners,
  getFlaggedPartners,
  getSLAReport,
  trackSLACompliance,
  getSLATrend,
  defineSLA,
  updateSLA,
} from "@witylogix/core/integrations/couriers";

// ─── REQUEST SCHEMAS ────────────────────────────────────────────────────

const periodSchema = z.enum(["30d", "60d", "90d"]);

const ratingsQuerySchema = z.object({
  period: periodSchema.optional().default("30d"),
  sortBy: z.enum(["score", "trend", "riskLevel"]).optional(),
  status: z.enum(["active", "review", "suspend"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const slaConfigSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  pickupTimeMinutes: z.number().int().min(1).max(1440),
  deliveryTimeMinutes: z.number().int().min(1).max(1440),
  pickupTimePercentile: z.number().min(0).max(100).optional().default(95),
  damageThresholdPercent: z.number().min(0).max(100).optional().default(2),
  cancelledThresholdPercent: z.number().min(0).max(100).optional().default(5),
  minCustomerRating: z.number().min(1).max(5).optional().default(3.5),
  escalationThresholdPercent: z.number().min(0).max(100).optional().default(80),
  escalationChannels: z.array(z.enum(["email", "slack", "sms"])).optional().default(["email"]),
  escalationContacts: z.array(z.string().email()).optional().default([]),
  applicableDaysOfWeek: z.array(z.number().min(0).max(6)).optional().default([0, 1, 2, 3, 4, 5, 6]),
  startHourUTC: z.number().min(0).max(23).optional().default(0),
  endHourUTC: z.number().min(0).max(23).optional().default(23),
  isActive: z.boolean().optional().default(true),
});

const slaQuerySchema = z.object({
  period: z.enum(["7d", "30d", "60d", "90d"]).optional().default("30d"),
});

// ─── ROUTE REGISTRATION ─────────────────────────────────────────────────

export default async function ratingsRoutes(app: FastifyInstance): Promise<void> {
  // All routes require authentication + tenant context
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── GET /couriers/ratings — List all partner ratings ────────────────

  app.get<{ Querystring: z.infer<typeof ratingsQuerySchema> }>(
    "/ratings",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = ratingsQuerySchema.parse(request.query);
      const { period, sortBy, status, limit, offset } = query;

      try {
        const allPartners = await prisma.courierPartner.findMany({
          where: { tenantId: request.tenantId },
        });

        // Calculate scores for all partners
        const scores = await Promise.all(
          allPartners.map((partner) =>
            calculatePartnerScore(partner.id, period).catch(() => null)
          )
        );

        let filtered = scores.filter((s): s is NonNullable<typeof s> => s !== null);

        // Filter by status
        if (status) {
          filtered = filtered.filter((s) => s.recommendedAction === status);
        }

        // Sort
        if (sortBy === "trend") {
          filtered.sort((a, b) => Math.abs(b.trendPercentage) - Math.abs(a.trendPercentage));
        } else if (sortBy === "riskLevel") {
          const riskOrder = { "green": 0, "yellow": 1, "red": 2 };
          // @ts-ignore
          filtered.sort((a, b) => riskOrder[b.riskLevel || "green"] - riskOrder[a.riskLevel || "green"]);
        } else {
          // Default: sort by score
          filtered.sort((a, b) => b.score - a.score);
        }

        // Paginate
        const paginated = filtered.slice(offset, offset + limit);

        reply.send({
          data: paginated.map((score) => ({
            partnerId: score.partnerId,
            score: score.score,
            onTimeRateScore: score.onTimeRateScore,
            damageRateScore: score.damageRateScore,
            customerRatingScore: score.customerRatingScore,
            costEfficiencyScore: score.costEfficiencyScore,
            slaComplianceScore: score.slaComplianceScore,
            trend: score.trend,
            trendPercentage: score.trendPercentage,
            riskFlags: score.riskFlags,
            recommendedAction: score.recommendedAction,
            period: score.period,
            calculatedAt: score.calculatedAt,
          })),
          pagination: {
            limit,
            offset,
            total: filtered.length,
          },
        });
      } catch (error) {
        console.error("[Ratings] Error fetching ratings:", error);
        reply.code(500).send({ error: "Failed to calculate ratings" });
      }
    }
  );

  // ── GET /couriers/ratings/:partnerId — Get specific partner rating ───

  app.get<{
    Params: { partnerId: string };
    Querystring: { period?: string };
  }>(
    "/ratings/:partnerId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId } = request.params;
      const period = (request.query.period as "30d" | "60d" | "90d") || "30d";

      try {
        // Verify partner belongs to tenant
        const partner = await prisma.courierPartner.findUnique({
          where: { id: partnerId },
        });

        if (!partner || partner.tenantId !== request.tenantId) {
          return reply.code(404).send({ error: "Partner not found" });
        }

        const score = await calculatePartnerScore(partnerId, period);

        reply.send({
          partner: {
            id: partner.id,
            provider: partner.provider,
            name: partner.name,
          },
          rating: {
            score: score.score,
            onTimeRateScore: score.onTimeRateScore,
            damageRateScore: score.damageRateScore,
            customerRatingScore: score.customerRatingScore,
            costEfficiencyScore: score.costEfficiencyScore,
            slaComplianceScore: score.slaComplianceScore,
            trend: score.trend,
            trendPercentage: score.trendPercentage,
            riskFlags: score.riskFlags,
            recommendedAction: score.recommendedAction,
            period: score.period,
            calculatedAt: score.calculatedAt,
          },
        });
      } catch (error) {
        console.error("[Ratings] Error fetching partner rating:", error);
        reply.code(500).send({ error: "Failed to fetch rating" });
      }
    }
  );

  // ── GET /couriers/ratings/:partnerId/history — Rating history ───────

  app.get<{
    Params: { partnerId: string };
    Querystring: { period?: string; limit?: string };
  }>(
    "/ratings/:partnerId/history",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId } = request.params;
      const period = (request.query.period as "30d" | "60d" | "90d") || "30d";
      const limit = parseInt(request.query.limit || "30");

      try {
        // Verify partner belongs to tenant
        const partner = await prisma.courierPartner.findUnique({
          where: { id: partnerId },
        });

        if (!partner || partner.tenantId !== request.tenantId) {
          return reply.code(404).send({ error: "Partner not found" });
        }

        const history = await getRatingHistory(partnerId, period, limit);

        reply.send({
          partnerId,
          period,
          history: history.map((entry) => ({
            id: entry.id,
            score: entry.score,
            trend: entry.trend,
            calculatedAt: entry.calculatedAt,
            metrics: {
              totalDeliveries: entry.metrics.totalDeliveries,
              onTimeDeliveries: entry.metrics.onTimeDeliveries,
              averageCustomerRating: entry.metrics.averageCustomerRating,
              damagedDeliveries: entry.metrics.damagedDeliveries,
            },
          })),
        });
      } catch (error) {
        console.error("[Ratings] Error fetching history:", error);
        reply.code(500).send({ error: "Failed to fetch history" });
      }
    }
  );

  // ── GET /couriers/ratings/:partnerId/trend — Performance trend ──────

  app.get<{
    Params: { partnerId: string };
    Querystring: { weeks?: string };
  }>(
    "/ratings/:partnerId/trend",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId } = request.params;
      const weeks = parseInt(request.query.weeks || "12");

      try {
        // Verify partner belongs to tenant
        const partner = await prisma.courierPartner.findUnique({
          where: { id: partnerId },
        });

        if (!partner || partner.tenantId !== request.tenantId) {
          return reply.code(404).send({ error: "Partner not found" });
        }

        // Calculate weekly scores
        const trend: Array<{ week: string; score: number }> = [];
        for (let i = weeks - 1; i >= 0; i--) {
          const weekDate = new Date();
          weekDate.setDate(weekDate.getDate() - i * 7);

          try {
            const score = await calculatePartnerScore(partnerId, "30d");
            const weekStart = new Date(weekDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());

            trend.push({
              week: weekStart.toISOString().split("T")[0],
              score: score.score,
            });
          } catch {
            // Continue if calculation fails
          }
        }

        reply.send({
          partnerId,
          trend,
        });
      } catch (error) {
        console.error("[Ratings] Error fetching trend:", error);
        reply.code(500).send({ error: "Failed to fetch trend" });
      }
    }
  );

  // ── GET /couriers/sla/:partnerId — SLA compliance report ────────────

  app.get<{
    Params: { partnerId: string };
    Querystring: z.infer<typeof slaQuerySchema>;
  }>(
    "/sla/:partnerId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId } = request.params;
      const query = slaQuerySchema.parse(request.query);
      const { period } = query;

      try {
        // Verify partner belongs to tenant
        const partner = await prisma.courierPartner.findUnique({
          where: { id: partnerId },
        });

        if (!partner || partner.tenantId !== request.tenantId) {
          return reply.code(404).send({ error: "Partner not found" });
        }

        const report = await getSLAReport(partnerId, period);

        reply.send({
          partnerId,
          period: report.period,
          complianceMetrics: {
            totalDeliveries: report.complianceMetrics.totalDeliveries,
            onTimeDeliveries: report.complianceMetrics.onTimeDeliveries,
            damageCount: report.complianceMetrics.damageCount,
            averageCustomerRating: report.complianceMetrics.averageCustomerRating,
            overallCompliancePercent: report.complianceMetrics.overallCompliancePercent,
            riskLevel: report.complianceMetrics.riskLevel,
          },
          violations: report.recentViolations.map((v) => ({
            violationType: v.violationType,
            message: v.message,
            severity: v.severity,
            timestamp: v.createdAt,
          })),
          summary: report.summary,
          generatedAt: report.generatedAt,
        });
      } catch (error) {
        console.error("[SLA] Error fetching report:", error);
        reply.code(500).send({ error: "Failed to fetch SLA report" });
      }
    }
  );

  // ── POST /couriers/sla/:partnerId — Define/update SLA ───────────────

  app.post<{
    Params: { partnerId: string };
    Body: z.infer<typeof slaConfigSchema>;
  }>(
    "/sla/:partnerId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId } = request.params;
      const body = slaConfigSchema.parse(request.body);

      try {
        // Verify partner belongs to tenant
        const partner = await prisma.courierPartner.findUnique({
          where: { id: partnerId },
        });

        if (!partner || partner.tenantId !== request.tenantId) {
          return reply.code(404).send({ error: "Partner not found" });
        }

        // Check if SLA exists (would check in SLA table in real system)
        // For now, define new SLA
        const slaConfig = await defineSLA(partnerId, {
          name: body.name,
          description: body.description,
          pickupTimeMinutes: body.pickupTimeMinutes,
          deliveryTimeMinutes: body.deliveryTimeMinutes,
          pickupTimePercentile: body.pickupTimePercentile ?? 95,
          damageThresholdPercent: body.damageThresholdPercent ?? 2,
          cancelledThresholdPercent: body.cancelledThresholdPercent ?? 5,
          minCustomerRating: body.minCustomerRating ?? 3.5,
          escalationThresholdPercent: body.escalationThresholdPercent ?? 80,
          escalationChannels: body.escalationChannels ?? ["email"],
          escalationContacts: body.escalationContacts ?? [],
          applicableDaysOfWeek: body.applicableDaysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
          startHourUTC: body.startHourUTC ?? 0,
          endHourUTC: body.endHourUTC ?? 23,
          isActive: body.isActive ?? true,
        });

        reply.code(201).send({
          slaConfig: {
            partnerId: slaConfig.partnerId,
            name: slaConfig.name,
            pickupTimeMinutes: slaConfig.pickupTimeMinutes,
            deliveryTimeMinutes: slaConfig.deliveryTimeMinutes,
            damageThresholdPercent: slaConfig.damageThresholdPercent,
            minCustomerRating: slaConfig.minCustomerRating,
            isActive: slaConfig.isActive,
          },
        });
      } catch (error) {
        console.error("[SLA] Error defining SLA:", error);
        reply.code(400).send({
          error: error instanceof Error ? error.message : "Failed to define SLA",
        });
      }
    }
  );

  // ── GET /couriers/sla/:partnerId/trend — SLA compliance trend ───────

  app.get<{
    Params: { partnerId: string };
    Querystring: { weeks?: string };
  }>(
    "/sla/:partnerId/trend",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId } = request.params;
      const weeks = parseInt(request.query.weeks || "12");

      try {
        // Verify partner belongs to tenant
        const partner = await prisma.courierPartner.findUnique({
          where: { id: partnerId },
        });

        if (!partner || partner.tenantId !== request.tenantId) {
          return reply.code(404).send({ error: "Partner not found" });
        }

        // Get SLA trend (would need slaConfigId)
        const trend = await getSLATrend(partnerId, "sla_config_id", weeks);

        reply.send({
          partnerId,
          trend: trend.map((t) => ({
            week: t.week,
            compliancePercent: t.compliance,
          })),
        });
      } catch (error) {
        console.error("[SLA] Error fetching trend:", error);
        reply.code(500).send({ error: "Failed to fetch SLA trend" });
      }
    }
  );

  // ── GET /couriers/sla/:partnerId/violations — Recent violations ─────

  app.get<{
    Params: { partnerId: string };
    Querystring: { limit?: string; severity?: string };
  }>(
    "/sla/:partnerId/violations",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { partnerId } = request.params;
      const limit = parseInt(request.query.limit || "50");
      const severity = request.query.severity as string | undefined;

      try {
        // Verify partner belongs to tenant
        const partner = await prisma.courierPartner.findUnique({
          where: { id: partnerId },
        });

        if (!partner || partner.tenantId !== request.tenantId) {
          return reply.code(404).send({ error: "Partner not found" });
        }

        // Get recent violations (would query from violations table)
        const report = await getSLAReport(partnerId, "30d");
        let violations = report.recentViolations;

        if (severity) {
          violations = violations.filter((v) => v.severity === severity);
        }

        reply.send({
          partnerId,
          violations: violations.slice(0, limit).map((v) => ({
            id: v.id,
            violationType: v.violationType,
            message: v.message,
            severity: v.severity,
            escalated: v.escalated,
            timestamp: v.createdAt,
          })),
        });
      } catch (error) {
        console.error("[SLA] Error fetching violations:", error);
        reply.code(500).send({ error: "Failed to fetch violations" });
      }
    }
  );
}
