/**
 * Smart Routing API Routes
 *
 * Advanced multi-courier routing, performance analysis, cost optimization, and SLA management.
 *
 * POST   /couriers/route                           Route single delivery
 * POST   /couriers/route/batch                     Route multiple deliveries
 * GET    /couriers/performance                     List all partner performance
 * GET    /couriers/performance/:partnerId          Detailed performance analysis
 * GET    /couriers/costs/compare                   Compare costs for delivery
 * GET    /couriers/costs/report                    Cost report for period
 * POST   /couriers/sla                             Define/update SLA
 * GET    /couriers/sla/:partnerId/compliance      SLA compliance report
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import {
  PartnerPerformance,
  SmartRouter,
  CostOptimizer,
  SLAEnforcer,
  type PerformanceMetrics,
  type SLAConfig,
  type DeliveryRequest,
} from "@witylogix/core/integrations/couriers";

// ─── Validation Schemas ────────────────────────────────────────

const deliveryRequestSchema = z.object({
  orderId: z.string().optional(),
  pickup: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    instructions: z.string().optional(),
  }),
  dropoff: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    instructions: z.string().optional(),
  }),
  package: z
    .object({
      weight: z.number().optional(),
      dimensions: z.object({ length: z.number(), width: z.number(), height: z.number() }).optional(),
      transportType: z.enum(["bike", "car", "van"]).optional(),
      itemCount: z.number().optional(),
      fragile: z.boolean().optional(),
      requiresSignature: z.boolean().optional(),
    })
    .optional(),
  serviceLevel: z.enum(["asap", "standard", "scheduled"]).optional(),
  maxCost: z.number().optional(),
  maxDeliveryMinutes: z.number().optional(),
  instructions: z.string().optional(),
});

const routeOptionsSchema = z.object({
  providers: z.array(z.string()).optional(),
  prioritizeSpeed: z.boolean().optional(),
  prioritizeCost: z.boolean().optional(),
  maxOptions: z.number().optional(),
});

const slaConfigSchema = z.object({
  partnerId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  maxPickupTimeMinutes: z.number(),
  maxDeliveryTimeMinutes: z.number(),
  maxDamageRate: z.number(),
  minRating: z.number(),
  responseTimeTargetMinutes: z.number(),
  onTimeTargetPercent: z.number(),
  penalties: z.object({
    latePickupPenalty: z.number(),
    lateDeliveryPenalty: z.number(),
    damagePenalty: z.number(),
    lowRatingPenalty: z.number(),
  }),
  escalation: z.object({
    warningThreshold: z.number(),
    reviewThreshold: z.number(),
    suspensionThreshold: z.number(),
  }),
});

// ─── Service Instances ──────────────────────────────────────

const performance = new PartnerPerformance();
const smartRouter = new SmartRouter();
const costOptimizer = new CostOptimizer();
const slaEnforcer = new SLAEnforcer();

// ─── API Route Handlers ─────────────────────────────────────

export async function smartRoutingRoutes(fastify: FastifyInstance) {
  /**
   * POST /couriers/route
   * Route a single delivery with intelligent courier selection
   */
  fastify.post<{ Body: z.infer<typeof deliveryRequestSchema> }>(
    "/couriers/route",
    {
      preHandler: [requireAuth],
      schema: {
        description: "Route a single delivery",
        tags: ["couriers"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const body = deliveryRequestSchema.parse(request.body);
        const options = request.query as Record<string, unknown>;

        // Get available couriers for tenant
        const partners = await (prisma as any).CourierPartner.findMany({
          where: {
            tenantId,
            isEnabled: true,
          },
          select: { id: true, provider: true },
        });

        if (partners.length === 0) {
          return reply.status(400).send({ error: "No courier partners configured" });
        }

        // Route delivery
        const result = await smartRouter.routeDelivery(body as DeliveryRequest, {
          providers: options.providers as string[] | undefined,
          prioritizeSpeed: options.prioritizeSpeed === "true",
          prioritizeCost: options.prioritizeCost === "true",
          maxOptions: options.maxOptions ? parseInt(options.maxOptions as string) : undefined,
        });

        // Get cost comparison for recommended option
        const costComparison =
          result.recommended && result.options.length > 1
            ? costOptimizer.compareCosts(body as DeliveryRequest, result.options)
            : null;

        return reply.send({
          routingResult: result,
          costAnalysis: costComparison,
          recommendedProvider: result.recommended?.provider,
          recommendedCost: result.recommended?.quote.price,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Routing failed" });
      }
    },
  );

  /**
   * POST /couriers/route/batch
   * Route multiple deliveries with batch optimization
   */
  fastify.post<{ Body: { deliveries: z.infer<typeof deliveryRequestSchema>[]; options?: Record<string, unknown> } }>(
    "/couriers/route/batch",
    {
      preHandler: [requireAuth],
      schema: {
        description: "Route multiple deliveries with batch optimization",
        tags: ["couriers"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { deliveries, options } = request.body;

        if (!Array.isArray(deliveries) || deliveries.length === 0) {
          return reply.status(400).send({ error: "Invalid deliveries array" });
        }

        // Validate deliveries
        const validDeliveries = deliveries.map((d) => deliveryRequestSchema.parse(d));

        // Batch route
        const result = await smartRouter.routeBatch(validDeliveries as DeliveryRequest[], {
          optimizeForCost: options?.optimizeForCost === "true",
          optimizeForTime: options?.optimizeForTime === "true",
          allowSplitDeliveries: options?.allowSplitDeliveries === "true",
        });

        // Calculate batch cost optimization
        const batchCostOptimization = costOptimizer.optimizeBatchCost(
          validDeliveries as DeliveryRequest[],
          result.results,
        );

        return reply.send({
          routingResults: Object.fromEntries(result.results),
          optimizedAssignment: Object.fromEntries(result.optimizedAssignment),
          costOptimization: result.costOptimization,
          batchCostOptimization,
          splitAssignments: result.splitAssignments,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Batch routing failed" });
      }
    },
  );

  /**
   * GET /couriers/performance
   * Get performance scores for all courier partners
   */
  fastify.get(
    "/couriers/performance",
    {
      preHandler: [requireAuth],
      schema: {
        description: "List all courier partner performance scores",
        tags: ["couriers"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const partners = await (prisma as any).CourierPartner.findMany({
          where: { tenantId },
          select: { id: true, provider: true, name: true },
        });

        const performances = [];
        for (const partner of partners) {
          // Get recent metrics from deliveries
          const deliveries = await (prisma as any).CourierDelivery.findMany({
            where: {
              partnerId: partner.id,
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
            select: { status: true, quote: true },
          });

          if (deliveries.length > 0) {
            // Calculate metrics from deliveries
            const onTimeDeliveries = deliveries.filter((d: any) => d.status === "DELIVERED").length;
            const damagedDeliveries = deliveries.filter((d: any) => d.status === "FAILED").length;

            const metrics: PerformanceMetrics = {
              onTimeRate: (onTimeDeliveries / deliveries.length) * 100,
              damageRate: (damagedDeliveries / deliveries.length) * 100,
              customerRating: 4.0,
              costPerDelivery: deliveries.reduce((sum: number, d: any) => sum + (d.quote?.price || 0), 0) / deliveries.length,
              pickupSpeed: 15,
              communicationScore: 85,
              totalDeliveries: deliveries.length,
              onTimeDeliveries,
              damagedDeliveries,
              ratingsCount: 0,
              ratingsSum: 0,
              period: "7d",
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              endDate: new Date(),
            };

            const score = performance.calculatePerformanceScore(metrics);
            performances.push({
              partnerId: partner.id,
              provider: partner.provider,
              name: partner.name,
              score: score.score,
              tier: score.tier,
              metrics,
            });
          }
        }

        return reply.send({ performances });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch performance data" });
      }
    },
  );

  /**
   * GET /couriers/performance/:partnerId
   * Get detailed performance analysis for a partner
   */
  fastify.get<{ Params: { partnerId: string } }>(
    "/couriers/performance/:partnerId",
    {
      preHandler: [requireAuth],
      schema: {
        description: "Get detailed performance analysis for a courier partner",
        tags: ["couriers"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { partnerId } = request.params;

        const partner = await (prisma as any).CourierPartner.findFirst({
          where: { id: partnerId, tenantId },
          select: { id: true, name: true },
        });

        if (!partner) {
          return reply.status(404).send({ error: "Partner not found" });
        }

        // Get metrics for different periods
        const getPeriodMetrics = async (days: number) => {
          const deliveries = await (prisma as any).CourierDelivery.findMany({
            where: {
              partnerId,
              createdAt: {
                gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
              },
            },
            select: { status: true, quote: true },
          });

          if (deliveries.length === 0) return null;

          const onTimeDeliveries = deliveries.filter((d: any) => d.status === "DELIVERED").length;
          const damagedDeliveries = deliveries.filter((d: any) => d.status === "FAILED").length;

          return {
            onTimeRate: (onTimeDeliveries / deliveries.length) * 100,
            damageRate: (damagedDeliveries / deliveries.length) * 100,
            customerRating: 4.0,
            costPerDelivery: deliveries.reduce((sum: number, d: any) => sum + (d.quote?.price || 0), 0) / deliveries.length,
            pickupSpeed: 15,
            communicationScore: 85,
            totalDeliveries: deliveries.length,
            onTimeDeliveries,
            damagedDeliveries,
            ratingsCount: 0,
            ratingsSum: 0,
            period: days === 7 ? "7d" : days === 30 ? "30d" : "90d",
            startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
            endDate: new Date(),
          } as PerformanceMetrics;
        };

        const metrics7d = await getPeriodMetrics(7);
        const metrics30d = await getPeriodMetrics(30);
        const metrics90d = await getPeriodMetrics(90);

        if (!metrics7d) {
          return reply.status(404).send({ error: "Insufficient performance data" });
        }

        const report = performance.generatePerformanceReport(
          partnerId,
          partner.name,
          metrics7d,
          metrics30d || undefined,
          metrics90d || undefined,
        );

        return reply.send(report);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch performance report" });
      }
    },
  );

  /**
   * GET /couriers/costs/compare
   * Compare costs for a delivery across couriers
   */
  fastify.get<{ Querystring: { pickup_lat: string; pickup_lng: string; dropoff_lat: string; dropoff_lng: string } }>(
    "/couriers/costs/compare",
    {
      preHandler: [requireAuth],
      schema: {
        description: "Compare courier costs for a delivery",
        tags: ["couriers"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = request.query;

        const delivery: DeliveryRequest = {
          pickup: { latitude: parseFloat(pickup_lat), longitude: parseFloat(pickup_lng) },
          dropoff: { latitude: parseFloat(dropoff_lat), longitude: parseFloat(dropoff_lng) },
        };

        // Route delivery to get options
        const result = await smartRouter.routeDelivery(delivery);

        // Compare costs
        const comparison = costOptimizer.compareCosts(delivery, result.options);

        return reply.send(comparison);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Cost comparison failed" });
      }
    },
  );

  /**
   * GET /couriers/costs/report
   * Get cost report for a period
   */
  fastify.get<{ Querystring: { period?: string } }>(
    "/couriers/costs/report",
    {
      preHandler: [requireAuth],
      schema: {
        description: "Get cost analysis report",
        tags: ["couriers"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const period = (request.query.period as string) || "30d";

        const roi = costOptimizer.calculateROI(period);

        return reply.send(roi);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Cost report generation failed" });
      }
    },
  );

  /**
   * POST /couriers/sla
   * Define or update SLA for a partner
   */
  fastify.post<{ Body: z.infer<typeof slaConfigSchema> }>(
    "/couriers/sla",
    {
      preHandler: [requireAuth],
      schema: {
        description: "Define or update SLA for a courier partner",
        tags: ["couriers"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const body = slaConfigSchema.parse(request.body);

        const config: SLAConfig = {
          partnerId: body.partnerId,
          name: body.name,
          description: body.description,
          maxPickupTimeMinutes: body.maxPickupTimeMinutes,
          maxDeliveryTimeMinutes: body.maxDeliveryTimeMinutes,
          maxDamageRate: body.maxDamageRate,
          minRating: body.minRating,
          responseTimeTargetMinutes: body.responseTimeTargetMinutes,
          onTimeTargetPercent: body.onTimeTargetPercent,
          penalties: body.penalties,
          escalation: body.escalation,
          effectiveFrom: new Date(),
          status: "active",
        };

        slaEnforcer.defineSLA(config);

        return reply.status(201).send({ success: true, sla: config });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "SLA definition failed" });
      }
    },
  );

  /**
   * GET /couriers/sla/:partnerId/compliance
   * Get SLA compliance report for a partner
   */
  fastify.get<{ Params: { partnerId: string }; Querystring: { period_days?: string } }>(
    "/couriers/sla/:partnerId/compliance",
    {
      preHandler: [requireAuth],
      schema: {
        description: "Get SLA compliance report",
        tags: ["couriers"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = request.user?.tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { partnerId } = request.params;
        const periodDays = parseInt((request.query.period_days as string) || "30");

        const report = slaEnforcer.getComplianceReport(partnerId, periodDays);

        return reply.send(report);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Compliance report generation failed" });
      }
    },
  );
}
