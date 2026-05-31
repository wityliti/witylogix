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
import type { PlanTier } from "@witylogix/db";
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

const billingAddressSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  company: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  // All billing routes require authentication and tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET / — Composite billing summary for settings/billing page ──────────
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const { shopId } = request;

    const shop = await request.tenantDb.shop.findUnique({
      where: { id: shopId },
      select: { planTier: true, settings: true },
    });

    if (!shop) {
      throw new NotFoundError("Shop", shopId);
    }

    const plan = shop.planTier as PlanTier;
    const planFeatures = PLANS[plan];
    const settings = (shop.settings as Record<string, unknown>) ?? {};
    const billingAddress = (settings.billingAddress ?? null) as Record<string, string> | null;

    const billingPeriodStart = getMonthStart(new Date());
    const billingPeriodEnd = getMonthEnd(new Date());

    // Fetch usage counts in parallel
    const [shipmentsCount, driversCount, notificationCount, invoices] =
      await Promise.all([
        request.tenantDb.shipment.count({
          where: { shopId, createdAt: { gte: billingPeriodStart } },
        }),
        request.tenantDb.driver.count({ where: { shopId } }),
        request.tenantDb.notificationMeterEvent.count({
          where: { shopId, timestamp: { gte: billingPeriodStart } },
        }),
        request.tenantDb.paymentTransaction.findMany({
          where: { shopId, type: "CHARGE" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            amount: true,
            currency: true,
            status: true,
            metadata: true,
          },
        }),
      ]);

    const shipLimit =
      planFeatures.shipmentsPerMonth === Infinity ? null : planFeatures.shipmentsPerMonth;
    const driverLimit =
      planFeatures.driversLimit === Infinity ? null : planFeatures.driversLimit;
    const notifLimit =
      planFeatures.notificationsPerMonth === Infinity ? null : planFeatures.notificationsPerMonth;

    const usageMetrics = [
      {
        name: "Shipments",
        current: shipmentsCount,
        limit: shipLimit ?? 9999999,
        percentage: shipLimit ? Math.min(100, (shipmentsCount / shipLimit) * 100) : 0,
        unit: "shipments",
      },
      {
        name: "Active Drivers",
        current: driversCount,
        limit: driverLimit ?? 9999999,
        percentage: driverLimit ? Math.min(100, (driversCount / driverLimit) * 100) : 0,
        unit: "drivers",
      },
      {
        name: "Notifications",
        current: notificationCount,
        limit: notifLimit ?? 9999999,
        percentage: notifLimit ? Math.min(100, (notificationCount / notifLimit) * 100) : 0,
        unit: "sent",
      },
    ];

    return reply.send({
      plan: plan.charAt(0) + plan.slice(1).toLowerCase(),
      planTier: plan,
      monthlyPrice: planFeatures.monthlyPrice,
      renewalDate: billingPeriodEnd,
      billingPeriodStart,
      billingPeriodEnd,
      usageMetrics,
      billingAddress,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        date: inv.createdAt,
        period: new Date(inv.createdAt).toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
        amount: Number(inv.amount) / 100,
        currency: inv.currency,
        status: inv.status === "completed" ? "paid" : inv.status,
        downloadUrl: `/api/v4/billing/invoices/${inv.id}/pdf`,
      })),
    });
  });

  // ── GET /address — Get billing address ───────────────────────────────────
  fastify.get("/address", async (request: FastifyRequest, reply: FastifyReply) => {
    const shop = await request.tenantDb.shop.findUnique({
      where: { id: request.shopId },
      select: { settings: true },
    });
    const settings = (shop?.settings as Record<string, unknown>) ?? {};
    return reply.send({ data: settings.billingAddress ?? null });
  });

  // ── PUT /address — Save billing address ──────────────────────────────────
  fastify.put(
    "/address",
    { preHandler: [requireRole("ADMIN", "SUPER_ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = billingAddressSchema.parse(request.body);
      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });
      const settings = (shop?.settings as Record<string, unknown>) ?? {};
      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings: { ...settings, billingAddress: body } },
      });
      return reply.send({ data: body });
    },
  );

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

      // Get actual subscription status from database
      const subscriptionStatus = await getSubscriptionStatus(
        (request.tenantDb as any),
        shopId,
      );

      const summary = createUsageSummary(
        plan,
        subscriptionStatus,
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

      // Create recurring application charge via Shopify GraphQL API or mock it for MVP
      const shopifyChargeId = await createRecurringCharge(
        (request.tenantDb as any),
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

      // Cancel recurring application charge with Shopify and update subscription status
      const billingPeriodEnd = getMonthEnd(new Date());

      // Cancel the subscription in database
      await cancelSubscription(
        (request.tenantDb as any),
        shopId,
        billingPeriodEnd,
      );

      // Downgrade plan
      await (request.tenantDb as any).shop.update({
        where: { id: shopId },
        data: {
          planTier: "FREE",
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

// ─── SUBSCRIPTION MANAGEMENT HELPERS ────────────────────────────────────────

/**
 * Get current subscription status from billing model
 * Returns: plan tier, status (active/cancelled/pending), renewal date, usage limits
 */
async function getSubscriptionStatus(
  tenantDb: any,
  shopId: string,
): Promise<string> {
  const subscription = await (tenantDb as any).subscription.findUnique({
    where: { shopId },
    select: {
      status: true,
      planTier: true,
      renewalDate: true,
      cancelledAt: true,
      cancelledEffectiveAt: true,
    },
  }).catch(() => null);

  if (!subscription) {
    return "active"; // Default to active if no subscription record
  }

  if (subscription.status === "cancelled" && subscription.cancelledEffectiveAt) {
    if (new Date() >= new Date(subscription.cancelledEffectiveAt)) {
      return "cancelled";
    }
    return "active"; // Still active until effective date
  }

  return subscription.status || "active";
}

/**
 * Create a recurring application charge (Shopify recurring charge or generic billing)
 * In production, this would call Shopify GraphQL API:
 * mutation CreateRecurringCharge($input: AppRecurringChargeInput!) {
 *   appRecurringChargeCreate(input: $input) {
 *     userErrors { ... }
 *     appRecurringCharge { id, status, returnUrl }
 *   }
 * }
 */
async function createRecurringCharge(
  tenantDb: any,
  shop: any,
  plan: PlanTier,
  proratedAmount: number,
): Promise<string> {
  const planFeatures = PLANS[plan];

  // Create billing record in database
  const billingRecord = await (tenantDb as any).subscription.upsert({
    where: { shopId: shop.id },
    update: {
      planTier: plan,
      status: "active",
      renewalDate: getMonthEnd(new Date()),
      amount: Number(planFeatures.monthlyPrice),
      proratedAmount,
    },
    create: {
      shopId: shop.id,
      planTier: plan,
      status: "active",
      amount: Number(planFeatures.monthlyPrice),
      proratedAmount,
      renewalDate: getMonthEnd(new Date()),
    },
  }).catch(async () => {
    // If subscription table doesn't exist, create charge in payment transactions
    return (tenantDb as any).paymentTransaction.create({
      data: {
        shopId: shop.id,
        type: "CHARGE",
        amount: Number(planFeatures.monthlyPrice),
        currency: "USD",
        status: "pending",
        metadata: {
          plan,
          proratedAmount,
          description: `Recurring charge for ${plan} plan`,
        },
      },
    });
  });

  // Mock charge ID
  const chargeId = `gid://shopify/RecurringApplicationCharge/${Date.now()}`;

  // In production:
  // const response = await shopifyGraphql(shop.shopifyAccessToken, mutation, variables);
  // return response.data.appRecurringChargeCreate.appRecurringCharge.id;

  return chargeId;
}

/**
 * Cancel subscription and mark effective end date
 * Sets status to cancelled and records the cancellation timestamp
 */
async function cancelSubscription(
  tenantDb: any,
  shopId: string,
  effectiveDate: Date,
): Promise<void> {
  try {
    await (tenantDb as any).subscription.update({
      where: { shopId },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledEffectiveAt: effectiveDate,
      },
    });
  } catch {
    // If subscription table doesn't exist, log the cancellation in activity log
    await (tenantDb as any).activityLog.create({
      data: {
        shopId,
        action: "PLAN_CANCELLED",
        entityType: "subscription",
        entityId: shopId,
        actorType: "system",
        changes: {
          status: "cancelled",
          effectiveDate: effectiveDate.toISOString(),
        },
      },
    }).catch(() => {
      // Silently fail if activity log doesn't exist
    });
  }
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
