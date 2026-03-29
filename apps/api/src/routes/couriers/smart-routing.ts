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
  SmartRouter,
  SLAEnforcer,
  PartnerPerformance,
  CostOptimizer,
  OnfleetClient,
  StuartClient,
  UberDirectClient,
  type DeliveryRequest,
  type SLAConfig,
  type ICourierProvider,
  type CourierAvailability,
} from "@witylogix/core/integrations/couriers";
import type { CourierQuote, PackageSpec, LocationInfo } from "@witylogix/core/integrations/couriers";

// ─── Courier Provider Bridge ────────────────────────────────────
// Adapts CourierAdapter (Onfleet, Stuart, UberDirect) to ICourierProvider

class CourierAdapterProvider implements ICourierProvider {
  private adapter: OnfleetClient | StuartClient | UberDirectClient;
  private providerName: string;

  constructor(adapter: OnfleetClient | StuartClient | UberDirectClient, name: string) {
    this.adapter = adapter;
    this.providerName = name;
  }

  async getAvailability(): Promise<CourierAvailability> {
    const healthy = await this.adapter.healthCheck();
    return {
      provider: this.providerName,
      available: healthy,
      loadPercentage: 0,
      activeDeliveries: 0,
      maxCapacity: 100,
      serviceAreas: [],
      apiStatus: healthy ? "healthy" : "offline",
      lastUpdated: new Date(),
    };
  }

  async getQuote(delivery: DeliveryRequest): Promise<CourierQuote> {
    return this.adapter.getQuote({
      pickup: delivery.pickup,
      dropoff: delivery.dropoff,
      package: delivery.package,
      scheduledFor: delivery.scheduledFor,
      options: delivery.serviceLevel ? { serviceLevel: delivery.serviceLevel } : undefined,
    });
  }

  async canServiceArea(_pickup: LocationInfo, _dropoff: LocationInfo): Promise<boolean> {
    return this.adapter.healthCheck();
  }

  canHandlePackage(pkg: PackageSpec): boolean {
    if (pkg.weight && pkg.weight > 30) return false;
    return true;
  }
}

/**
 * Build a SmartRouter for a given tenant by registering all enabled courier partners.
 */
async function buildTenantSmartRouter(tenantId: string): Promise<SmartRouter> {
  const router = new SmartRouter();

  const partners = await prisma.courierPartner.findMany({
    where: { tenantId, isEnabled: true },
    select: { id: true, provider: true, credentials: true, config: true },
  });

  for (const partner of partners) {
    const creds = partner.credentials as Record<string, unknown>;
    const cfg = partner.config as Record<string, unknown>;
    const courierConfig = { ...creds, ...cfg };

    try {
      const providerKey = partner.provider.toLowerCase().replace(/[_-]/g, "");
      let adapter: OnfleetClient | StuartClient | UberDirectClient | null = null;

      if (providerKey === "onfleet") {
        adapter = new OnfleetClient(courierConfig);
      } else if (providerKey === "stuart") {
        adapter = new StuartClient(courierConfig);
      } else if (providerKey === "uberdirect" || providerKey === "uber") {
        adapter = new UberDirectClient(courierConfig);
      }

      if (adapter) {
        router.registerProvider(partner.provider, new CourierAdapterProvider(adapter, partner.provider));
      }
    } catch {
      // Skip misconfigured partners
    }
  }

  return router;
}

// ─── Singleton service instances ──────────────────────────────

const partnerPerformance = new PartnerPerformance();
const costOptimizer = new CostOptimizer();
const slaEnforcer = new SLAEnforcer();

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

// ─── API Route Handlers ─────────────────────────────────────

export async function smartRoutingRoutes(fastify: FastifyInstance) {
  /**
   * POST /couriers/route
   * Route a single delivery with intelligent courier selection
   */
  fastify.post(
    "/couriers/route",
    {
      preHandler: [requireAuth, tenantContext],
      schema: {
        description: "Route a single delivery",
        tags: ["couriers"],
      },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const body = deliveryRequestSchema.parse(request.body as any);
        const options = request.query as Record<string, unknown>;

        const smartRouter = await buildTenantSmartRouter(tenantId);

        const result = await smartRouter.routeDelivery(body as DeliveryRequest, {
          providers: options.providers as string[] | undefined,
          prioritizeSpeed: options.prioritizeSpeed === "true",
          prioritizeCost: options.prioritizeCost === "true",
          maxOptions: options.maxOptions ? parseInt(options.maxOptions as string) : undefined,
        });

        let costComparison = null;
        if (result.options.length > 0) {
          try {
            costComparison = costOptimizer.compareCosts(body as DeliveryRequest, result.options);
          } catch {
            // Not enough viable options for comparison
          }
        }

        return reply.send({
          routingResult: result,
          costAnalysis: costComparison,
          recommendedProvider: result.recommended?.provider ?? null,
          recommendedCost: result.recommended?.quote?.price ?? null,
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
  fastify.post(
    "/couriers/route/batch",
    {
      preHandler: [requireAuth, tenantContext],
      schema: {
        description: "Route multiple deliveries with batch optimization",
        tags: ["couriers"],
      },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { deliveries, options } = request.body as any;

        if (!Array.isArray(deliveries) || deliveries.length === 0) {
          return reply.status(400).send({ error: "Invalid deliveries array" });
        }

        const validDeliveries = deliveries.map((d) => deliveryRequestSchema.parse(d));

        const smartRouter = await buildTenantSmartRouter(tenantId);

        const result = await smartRouter.routeBatch(validDeliveries as DeliveryRequest[], {
          optimizeForCost: options?.optimizeForCost === "true",
          optimizeForTime: options?.optimizeForTime === "true",
          allowSplitDeliveries: options?.allowSplitDeliveries === "true",
        });

        let batchCostOptimization = null;
        try {
          batchCostOptimization = costOptimizer.optimizeBatchCost(
            validDeliveries as DeliveryRequest[],
            result.results as any,
          );
        } catch {
          // Not enough data for batch optimization
        }

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
      preHandler: [requireAuth, tenantContext],
      schema: {
        description: "List all courier partner performance scores",
        tags: ["couriers"],
      },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const partners = await prisma.courierPartner.findMany({
          where: { tenantId },
          select: { id: true, provider: true, name: true },
        });

        const performances = [];
        for (const partner of partners) {
          const deliveries = await (prisma as any).courierDelivery?.findMany?.({
            where: {
              partnerId: partner.id,
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            select: { status: true, quote: true },
          });

          if (deliveries && deliveries.length > 0) {
            const onTimeDeliveries = deliveries.filter((d: any) => d.status === "DELIVERED").length;
            const damagedDeliveries = deliveries.filter((d: any) => d.status === "FAILED").length;

            const metrics = {
              onTimeRate: (onTimeDeliveries / deliveries.length) * 100,
              damageRate: (damagedDeliveries / deliveries.length) * 100,
              customerRating: 4.0,
              costPerDelivery:
                deliveries.reduce((sum: number, d: any) => sum + ((d.quote as any)?.price || 0), 0) /
                deliveries.length,
              pickupSpeed: 15,
              communicationScore: 85,
              totalDeliveries: deliveries.length,
              onTimeDeliveries,
              damagedDeliveries,
              ratingsCount: 0,
              ratingsSum: 0,
              period: "7d" as const,
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              endDate: new Date(),
            };

            const score = partnerPerformance.calculatePerformanceScore(metrics);
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
  fastify.get(
    "/couriers/performance/:partnerId",
    {
      preHandler: [requireAuth, tenantContext],
      schema: {
        description: "Get detailed performance analysis for a courier partner",
        tags: ["couriers"],
      },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { partnerId } = request.params as { partnerId: string };

        const partner = await prisma.courierPartner.findFirst({
          where: { id: partnerId, tenantId },
          select: { id: true, name: true },
        });

        if (!partner) {
          return reply.status(404).send({ error: "Partner not found" });
        }

        const getPeriodMetrics = async (days: number) => {
          const deliveries = await (prisma as any).courierDelivery?.findMany?.({
            where: {
              partnerId,
              createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
            },
            select: { status: true, quote: true },
          });

          if (!deliveries || deliveries.length === 0) return null;

          const onTimeDeliveries = deliveries.filter((d: any) => d.status === "DELIVERED").length;
          const damagedDeliveries = deliveries.filter((d: any) => d.status === "FAILED").length;

          return {
            onTimeRate: (onTimeDeliveries / deliveries.length) * 100,
            damageRate: (damagedDeliveries / deliveries.length) * 100,
            customerRating: 4.0,
            costPerDelivery:
              deliveries.reduce((sum: number, d: any) => sum + ((d.quote as any)?.price || 0), 0) / deliveries.length,
            pickupSpeed: 15,
            communicationScore: 85,
            totalDeliveries: deliveries.length,
            onTimeDeliveries,
            damagedDeliveries,
            ratingsCount: 0,
            ratingsSum: 0,
            period: (days === 7 ? "7d" : days === 30 ? "30d" : "90d") as "7d" | "30d" | "90d",
            startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
            endDate: new Date(),
          };
        };

        const metrics7d = await getPeriodMetrics(7);
        const metrics30d = await getPeriodMetrics(30);
        const metrics90d = await getPeriodMetrics(90);

        if (!metrics7d) {
          return reply.status(404).send({ error: "Insufficient performance data" });
        }

        return reply.send({
          partnerId,
          partner: partner.name,
          metrics: { metrics7d, metrics30d, metrics90d },
        });
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
  fastify.get(
    "/couriers/costs/compare",
    {
      preHandler: [requireAuth, tenantContext],
      schema: {
        description: "Compare courier costs for a delivery",
        tags: ["couriers"],
      },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = request.query as any;

        const delivery: DeliveryRequest = {
          pickup: { latitude: parseFloat(pickup_lat), longitude: parseFloat(pickup_lng) },
          dropoff: { latitude: parseFloat(dropoff_lat), longitude: parseFloat(dropoff_lng) },
        };

        const smartRouter = await buildTenantSmartRouter(tenantId);
        const result = await smartRouter.routeDelivery(delivery, {});

        let costComparison = null;
        if (result.options.length > 0) {
          try {
            costComparison = costOptimizer.compareCosts(delivery, result.options);
          } catch {
            // Not enough viable options
          }
        }

        return reply.send({
          delivery,
          options: result.options,
          costComparison,
        });
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
  fastify.get(
    "/couriers/costs/report",
    {
      preHandler: [requireAuth, tenantContext],
      schema: {
        description: "Get cost analysis report",
        tags: ["couriers"],
      },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const period = ((request.query as any)?.period as string) || "30d";
        const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;

        const deliveries =
          (await (prisma as any).courierDelivery?.findMany?.({
            where: {
              tenantId,
              createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
            },
            select: { quote: true, status: true },
          })) ?? [];

        const totalCost = deliveries.reduce(
          (sum: number, d: any) => sum + ((d.quote as any)?.price || 0),
          0,
        );
        const delivered = deliveries.filter((d: any) => d.status === "DELIVERED").length;

        return reply.send({
          period,
          totalCost: Math.round(totalCost * 100) / 100,
          totalDeliveries: deliveries.length,
          successfulDeliveries: delivered,
          avgCostPerDelivery:
            deliveries.length > 0 ? Math.round((totalCost / deliveries.length) * 100) / 100 : 0,
          roi: 0,
          totalSavings: 0,
        });
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
  fastify.post(
    "/couriers/sla",
    {
      preHandler: [requireAuth, tenantContext],
      schema: {
        description: "Define or update SLA for a courier partner",
        tags: ["couriers"],
      },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const body = slaConfigSchema.parse(request.body as any);

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
  fastify.get(
    "/couriers/sla/:partnerId/compliance",
    {
      preHandler: [requireAuth, tenantContext],
      schema: {
        description: "Get SLA compliance report",
        tags: ["couriers"],
      },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const tenantId = (request as any).tenantId;
        if (!tenantId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { partnerId } = request.params as { partnerId: string };
        const periodDays = parseInt(((request.query as any)?.period_days as string) || "30");

        const sla = slaEnforcer.getSLA(partnerId);
        if (!sla) {
          return reply.send({
            partnerId,
            compliant: true,
            violations: [],
            periodDays,
            message: "No SLA configured for this partner",
          });
        }

        const report = slaEnforcer.getComplianceReport(partnerId, periodDays);

        return reply.send(report);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Compliance report generation failed" });
      }
    },
  );
}
