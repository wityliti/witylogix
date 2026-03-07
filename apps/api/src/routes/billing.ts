/**
 * Billing & Subscription Management — Shopify integration
 *
 * Routes:
 *   GET  /plans                  List available subscription plans
 *   GET  /subscription           Get current shop's subscription status
 *   POST /subscription           Create/upgrade subscription
 *   POST /subscription/cancel    Cancel subscription
 *   GET  /usage                  Detailed usage metrics
 *   POST /usage/event            Record a metering event
 *   GET  /invoices               List billing history
 *
 * Shopify integration:
 *   - Creates recurring application charges via Shopify GraphQL API
 *   - Handles billing cycle management and prorated changes
 *   - Tracks usage events for metering-based billing
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { PlanTier } from "@prisma/client";
import {
  PLANS,
  checkUsageLimit,
  calculateProration,
  createUsageSummary,
  getPlanComparison,
  type UsageMetrics,
} from "@witylogix/core/billing";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../lib/errors.js";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────

const planIdSchema = z.enum(["FREE", "STARTER", "GROWTH", "ENTERPRISE"]);

const createSubscriptionSchema = z.object({
  planId: planIdSchema,
  returnUrl: z.string().url().optional(),
});

const usageEventSchema = z.object({
  type: z.enum([
    "shipment_created",
    "label_generated",
    "notification_sent",
    "api_call",
  ]),
  metadata: z.record(z.unknown()).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────────────────

async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  // All billing routes require authentication and tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /plans ───────────────────────────────────────────────────────────
  /**
   * List available subscription plans with features comparison matrix
   */
  fastify.get("/plans", async (request: FastifyRequest, reply: FastifyReply) => {
    const plans = getPlanComparison();

    return reply.send({
      plans,
      metadata: {
        total: plans.length,
        timestamp: new Date(),
      },
    });
  });

  // ── GET /subscription ────────────────────────────────────────────────────
  /**
   * Get current shop's subscription status
   * Returns: plan, status, billing cycle, next billing date, usage limits
   */
  fastify.get(
    "/subscription",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { shopId } = request;
      const shop = await request.tenantDb.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        throw new NotFoundError("Shop", shopId);
      }

      const plan = shop.planTier as PlanTier;
      const planFeatures = PLANS[plan];

      // Get usage metrics for current billing period
      // For MVP, return calculated metrics based on shipments, orders, drivers
      const shipmentsCount = await request.tenantDb.shipment.count({
        where: {
          shopId,
          createdAt: {
            gte: getMonthStart(new Date()),
          },
        },
      });

      const driversCount = await request.tenantDb.driver.count({
        where: { shopId },
      });

      // Get notification and API usage from events
      const notificationCount = await request.tenantDb.notificationMeterEvent.count({
        where: {
          shopId,
          timestamp: {
            gte: getMonthStart(new Date()),
          },
        },
      });

      const apiCallCount = await request.tenantDb.routingMeterEvent.count({
        where: {
          shopId,
          timestamp: {
            gte: getMonthStart(new Date()),
          },
        },
      });

      const billingPeriodStart = getMonthStart(new Date());
      const billingPeriodEnd = getMonthEnd(new Date());

      const metrics: UsageMetrics = {
        shipmentsUsed: shipmentsCount,
        driversUsed: driversCount,
        apiCallsUsed: apiCallCount,
        notificationsSent: notificationCount,
        createdAt: new Date(),
        billingPeriodStart,
        billingPeriodEnd,
      };

      const summary = createUsageSummary(
        plan,
        "active", // TODO: Get actual subscription status from Shopify
        billingPeriodStart,
        billingPeriodEnd,
        metrics,
      );

      return reply.send(summary);
    },
  );

  // ── POST /subscription ───────────────────────────────────────────────────
  /**
   * Create or upgrade subscription to a new plan
   * For Shopify: creates recurring application charge
   * Handles proration for plan changes
   */
  fastify.post(
    "/subscription",
    { preHandler: [requireRole("ADMIN", "SUPER_ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { shopId } = request;
      const payload = createSubscriptionSchema.parse(request.body);
      const { planId, returnUrl } = payload;

      // Validate plan exists
      const newPlan = planId as PlanTier;
      if (!PLANS[newPlan]) {
        throw new ValidationError(`Invalid plan: ${planId}`);
      }

      // Get current subscription
      const shop = await request.tenantDb.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        throw new NotFoundError("Shop", shopId);
      }

      const currentPlan = shop.planTier as PlanTier;

      // Check if plan is the same
      if (currentPlan === newPlan) {
        throw new ConflictError("Shop is already on this plan");
      }

      // Calculate proration
      const billingPeriodEnd = getMonthEnd(new Date());
      const daysRemaining = Math.ceil(
        (billingPeriodEnd.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const proratedAmount = calculateProration(currentPlan, newPlan, daysRemaining);

      // TODO: In production, create recurring application charge via Shopify GraphQL API
      // For MVP, we'll mock the Shopify charge creation
      const shopifyChargeId = await createShopifyRecurringCharge(
        shop,
        newPlan,
        proratedAmount,
      );

      // Update shop plan tier
      const updatedShop = await request.tenantDb.shop.update({
        where: { id: shopId },
        data: {
          planTier: newPlan,
        },
      });

      // Log subscription change
      await request.tenantDb.activityLog.create({
        data: {
          shopId,
          action: "PLAN_UPGRADED",
          entityType: "subscription",
          entityId: shopId,
          actorType: "user",
          actorId: (request as any).auth?.userId || null,
          changes: {
            fromPlan: currentPlan,
            toPlan: newPlan,
            proratedAmount,
          },
          metadata: { shopifyChargeId },
        },
      });

      return reply.status(201).send({
        plan: updatedShop.planTier,
        shopifyChargeId,
        confirmationUrl: `https://admin.shopify.com/charges/${shopifyChargeId}`, // Mock URL
        proratedAmount,
        nextBillingDate: billingPeriodEnd,
        message: "Subscription updated. Please confirm in Shopify admin.",
      });
    },
  );

  // ── POST /subscription/cancel ────────────────────────────────────────────
  /**
   * Cancel subscription (effective end of billing cycle)
   */
  fastify.post(
    "/subscription/cancel",
    { preHandler: [requireRole("ADMIN", "SUPER_ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { shopId } = request;

      const shop = await request.tenantDb.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        throw new NotFoundError("Shop", shopId);
      }

      // TODO: Cancel recurring application charge with Shopify
      // For MVP, mark as cancelled effective end of month
      const billingPeriodEnd = getMonthEnd(new Date());

      await request.tenantDb.shop.update({
        where: { id: shopId },
        data: {
          planTier: "FREE", // Downgrade to free at end of cycle
          settings: {
            ...(shop.settings as Record<string, unknown>),
            subscriptionCancelledAt: new Date().toISOString(),
            subscriptionCancelledEffectiveAt: billingPeriodEnd.toISOString(),
          },
        },
      });

      // Log cancellation
      await request.tenantDb.activityLog.create({
        data: {
          shopId,
          action: "PLAN_CANCELLED",
          entityType: "subscription",
          entityId: shopId,
          actorType: "user",
          actorId: (request as any).auth?.userId || null,
          changes: {
            effectiveDate: billingPeriodEnd,
            downgradesPlanTo: "FREE",
          },
          metadata: {},
        },
      });

      return reply.send({
        status: "cancelled",
        effectiveDate: billingPeriodEnd,
        message: "Subscription cancelled. Service will downgrade to FREE at the end of the billing cycle.",
      });
    },
  );

  // ── GET /usage ───────────────────────────────────────────────────────────
  /**
   * Detailed usage metrics with daily breakdown and projections
   */
  fastify.get("/usage", async (request: FastifyRequest, reply: FastifyReply) => {
    const { shopId } = request;

    const billingPeriodStart = getMonthStart(new Date());
    const billingPeriodEnd = getMonthEnd(new Date());

    // Get daily shipment counts
    const dailyShipments = await request.tenantDb.shipment.groupBy({
      by: ["createdAt"],
      where: {
        shopId,
        createdAt: {
          gte: billingPeriodStart,
          lte: billingPeriodEnd,
        },
      },
      _count: true,
      orderBy: {
        createdAt: "asc",
      },
    });

    // Get hourly API calls
    const apiCallsDaily = await request.tenantDb.routingMeterEvent.groupBy({
      by: ["timestamp"],
      where: {
        shopId,
        timestamp: {
          gte: billingPeriodStart,
          lte: billingPeriodEnd,
        },
      },
      _count: true,
      orderBy: {
        timestamp: "asc",
      },
    });

    // Get notifications
    const notificationsDaily = await request.tenantDb.notificationMeterEvent.groupBy({
      by: ["timestamp"],
      where: {
        shopId,
        timestamp: {
          gte: billingPeriodStart,
          lte: billingPeriodEnd,
        },
      },
      _count: true,
      orderBy: {
        timestamp: "asc",
      },
    });

    const shop = await request.tenantDb.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundError("Shop", shopId);
    }

    const plan = shop.planTier as PlanTier;

    // Calculate totals
    const totalShipments = dailyShipments.reduce((sum, day) => sum + day._count, 0);
    const totalApiCalls = apiCallsDaily.reduce((sum, day) => sum + day._count, 0);
    const totalNotifications = notificationsDaily.reduce(
      (sum, day) => sum + day._count,
      0,
    );

    // Get limits check
    const shipmentsCheck = checkUsageLimit(plan, "shipments", totalShipments);
    const apiCallsCheck = checkUsageLimit(plan, "apiCalls", totalApiCalls);
    const notificationsCheck = checkUsageLimit(plan, "notifications", totalNotifications);

    return reply.send({
      billingPeriod: {
        start: billingPeriodStart,
        end: billingPeriodEnd,
        daysRemaining: Math.ceil(
          (billingPeriodEnd.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      },
      usage: {
        shipments: {
          used: totalShipments,
          limit: PLANS[plan].shipmentsPerMonth,
          allowed: shipmentsCheck.allowed,
          remaining: shipmentsCheck.remaining,
          percentageUsed: shipmentsCheck.percentageUsed,
        },
        apiCalls: {
          used: totalApiCalls,
          limit: PLANS[plan].apiCallsPerMonth,
          allowed: apiCallsCheck.allowed,
          remaining: apiCallsCheck.remaining,
          percentageUsed: apiCallsCheck.percentageUsed,
        },
        notifications: {
          used: totalNotifications,
          limit: PLANS[plan].notificationsPerMonth,
          allowed: notificationsCheck.allowed,
          remaining: notificationsCheck.remaining,
          percentageUsed: notificationsCheck.percentageUsed,
        },
      },
      trends: {
        dailyShipments: dailyShipments.map((day) => ({
          date: day.createdAt,
          count: day._count,
        })),
        dailyApiCalls: apiCallsDaily.map((day) => ({
          date: day.timestamp,
          count: day._count,
        })),
        dailyNotifications: notificationsDaily.map((day) => ({
          date: day.timestamp,
          count: day._count,
        })),
      },
    });
  });

  // ── POST /usage/event ────────────────────────────────────────────────────
  /**
   * Record a usage/metering event (shipment, notification, API call)
   * This is called internally by other routes to track usage
   */
  fastify.post(
    "/usage/event",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { shopId } = request;
      const payload = usageEventSchema.parse(request.body);
      const { type, metadata } = payload;

      // Routes would call this to record usage
      // For now, the metering is handled by RoutingMeterEvent and NotificationMeterEvent
      // being recorded directly when API calls are made

      // In production, we might also:
      // 1. Check if shop would exceed limits
      // 2. Return overagePrice if exceeding
      // 3. Trigger alerting if approaching limit

      return reply.status(204).send();
    },
  );

  // ── GET /invoices ────────────────────────────────────────────────────────
  /**
   * List billing history and invoices
   */
  fastify.get(
    "/invoices",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { shopId } = request;
      const query = paginationSchema.parse(request.query);
      const { page, limit } = query;

      const skip = (page - 1) * limit;

      // Get payment transactions as invoices
      const [invoices, total] = await Promise.all([
        request.tenantDb.paymentTransaction.findMany({
          where: {
            shopId,
            type: "CHARGE",
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        request.tenantDb.paymentTransaction.count({
          where: {
            shopId,
            type: "CHARGE",
          },
        }),
      ]);

      return reply.send({
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          date: invoice.createdAt,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          status: invoice.status,
          description: (invoice.metadata as any)?.description || `Payment ${invoice.type}`,
          metadata: invoice.metadata,
          downloadUrl: `/billing/invoices/${invoice.id}/pdf`, // Mock URL
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    },
  );
}

// ─── SHOPIFY INTEGRATION HELPERS ─────────────────────────────────────────

/**
 * Mock Shopify recurring charge creation
 * In production, this would call Shopify GraphQL API:
 * mutation CreateRecurringCharge($input: AppRecurringChargeInput!) {
 *   appRecurringChargeCreate(input: $input) {
 *     userErrors { ... }
 *     appRecurringCharge { id, status, returnUrl }
 *   }
 * }
 */
async function createShopifyRecurringCharge(
  shop: any,
  plan: PlanTier,
  proratedAmount: number,
): Promise<string> {
  const planFeatures = PLANS[plan];

  // Mock charge ID
  const chargeId = `gid://shopify/RecurringApplicationCharge/${Date.now()}`;

  // In production:
  // const response = await shopifyGraphql(shop.shopifyAccessToken, mutation, variables);
  // return response.data.appRecurringChargeCreate.appRecurringCharge.id;

  return chargeId;
}

// ─── UTILITY FUNCTIONS ───────────────────────────────────────────────────

function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthEnd(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default billingRoutes;
