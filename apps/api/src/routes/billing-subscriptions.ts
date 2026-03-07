/**
 * Billing Subscriptions — subscription lifecycle and usage management.
 *
 * Routes:
 *   POST   /subscribe           Create subscription { planId, paymentMethodId? }
 *   GET    /current             Get current subscription + plan + usage
 *   PUT    /upgrade             Upgrade plan { newPlanId }
 *   PUT    /downgrade           Downgrade plan { newPlanId }
 *   POST   /cancel              Cancel subscription { immediate?: boolean }
 *   GET    /plans               List available billing plans
 *   GET    /invoices            List invoices with pagination { page?, limit? }
 *   GET    /invoices/:id        Get invoice detail
 *   GET    /usage               Get quota usage summary
 *   POST   /invoices/:id/pay    Manually trigger payment on invoice
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────────

const planIdSchema = z.enum(["FREE", "STARTER", "GROWTH", "ENTERPRISE"]);

const subscribeSchema = z.object({
  planId: planIdSchema,
  paymentMethodId: z.string().optional(),
});

const upgradeSchema = z.object({
  newPlanId: planIdSchema,
});

const downgradeSchema = z.object({
  newPlanId: planIdSchema,
});

const cancelSchema = z.object({
  immediate: z.boolean().optional().default(false),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Route Plugin ────────────────────────────────────────────────

async function billingSubscriptionsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── POST /subscribe ──────────────────────────────────────────

  fastify.post("/subscribe", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = subscribeSchema.parse(request.body);
    const { planId, paymentMethodId } = body;

    // Check if subscription already exists
    const existing = await (request.tenantDb as any).subscription.findFirst({
      where: { shopId: request.shopId },
    });

    if (existing && existing.status === "ACTIVE") {
      throw new ConflictError("Shop already has an active subscription");
    }

    // If downgrading from existing, validate transition
    if (existing && existing.planTier !== "FREE") {
      const planHierarchy: Record<string, number> = {
        FREE: 0,
        STARTER: 1,
        GROWTH: 2,
        ENTERPRISE: 3,
      };
      if (planHierarchy[planId] < planHierarchy[existing.planTier]) {
        throw new ValidationError(
          `Cannot directly downgrade from ${existing.planTier} to ${planId}. Use downgrade endpoint instead.`,
        );
      }
    }

    // Create subscription
    const subscription = await (request.tenantDb as any).subscription.create({
      data: {
        shopId: request.shopId,
        planTier: planId as any,
        status: "ACTIVE",
        billingCycleStart: new Date(),
        billingCycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentMethodId,
        isAutoRenew: true,
      },
      include: {
        plan: true,
      },
    });

    fastify.log.info(
      { shopId: request.shopId, planId, subscriptionId: subscription.id },
      "Subscription created",
    );

    reply.status(201);
    return { data: subscription };
  });

  // ── GET /current ─────────────────────────────────────────────

  fastify.get("/current", async (request: FastifyRequest, reply: FastifyReply) => {
    const subscription = await (request.tenantDb as any).subscription.findFirst({
      where: { shopId: request.shopId },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundError("Subscription for shop", request.shopId);
    }

    // Get usage summary
    const usageSummary = await (request.tenantDb as any).usageEvent.groupBy({
      by: ["eventType"],
      where: { shopId: request.shopId },
      _count: true,
    });

    return {
      data: {
        subscription,
        usage: usageSummary,
        isExpiringSoon:
          subscription.billingCycleEnd &&
          new Date(subscription.billingCycleEnd).getTime() - Date.now() <
            7 * 24 * 60 * 60 * 1000,
      },
    };
  });

  // ── PUT /upgrade ─────────────────────────────────────────────

  fastify.put("/upgrade", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = upgradeSchema.parse(request.body);
    const { newPlanId } = body;

    const subscription = await (request.tenantDb as any).subscription.findFirst({
      where: { shopId: request.shopId },
    });

    if (!subscription) {
      throw new NotFoundError("Subscription for shop", request.shopId);
    }

    if (subscription.status !== "ACTIVE") {
      throw new ConflictError("Cannot upgrade inactive subscription");
    }

    // Validate upgrade path
    const planHierarchy: Record<string, number> = {
      FREE: 0,
      STARTER: 1,
      GROWTH: 2,
      ENTERPRISE: 3,
    };
    if (planHierarchy[newPlanId] <= planHierarchy[subscription.planTier]) {
      throw new ValidationError(
        `Cannot upgrade from ${subscription.planTier} to ${newPlanId}. Use downgrade endpoint to change to a lower tier.`,
      );
    }

    // Calculate proration credit (simplified)
    const daysRemaining = Math.ceil(
      (subscription.billingCycleEnd!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const prorationCredit = (daysRemaining / 30) * 100; // Simplified calculation

    const updated = await (request.tenantDb as any).subscription.update({
      where: { id: subscription.id },
      data: {
        planTier: newPlanId as any,
        lastPlanChange: new Date(),
      },
      include: { plan: true },
    });

    fastify.log.info(
      {
        shopId: request.shopId,
        fromPlan: subscription.planTier,
        toPlan: newPlanId,
        prorationCredit,
      },
      "Subscription upgraded",
    );

    return {
      data: {
        subscription: updated,
        prorationCredit,
        message: `Upgraded to ${newPlanId}. Proration credit: $${prorationCredit.toFixed(2)}`,
      },
    };
  });

  // ── PUT /downgrade ───────────────────────────────────────────

  fastify.put("/downgrade", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = downgradeSchema.parse(request.body);
    const { newPlanId } = body;

    const subscription = await (request.tenantDb as any).subscription.findFirst({
      where: { shopId: request.shopId },
    });

    if (!subscription) {
      throw new NotFoundError("Subscription for shop", request.shopId);
    }

    if (subscription.status !== "ACTIVE") {
      throw new ConflictError("Cannot downgrade inactive subscription");
    }

    // Validate downgrade path
    const planHierarchy: Record<string, number> = {
      FREE: 0,
      STARTER: 1,
      GROWTH: 2,
      ENTERPRISE: 3,
    };
    if (planHierarchy[newPlanId] >= planHierarchy[subscription.planTier]) {
      throw new ValidationError(
        `Cannot downgrade from ${subscription.planTier} to ${newPlanId}. Use upgrade endpoint to move to higher tier.`,
      );
    }

    const updated = await (request.tenantDb as any).subscription.update({
      where: { id: subscription.id },
      data: {
        planTier: newPlanId as any,
        lastPlanChange: new Date(),
      },
      include: { plan: true },
    });

    fastify.log.info(
      {
        shopId: request.shopId,
        fromPlan: subscription.planTier,
        toPlan: newPlanId,
      },
      "Subscription downgraded",
    );

    return {
      data: {
        subscription: updated,
        message: `Downgraded to ${newPlanId}. Changes take effect on next billing cycle.`,
      },
    };
  });

  // ── POST /cancel ─────────────────────────────────────────────

  fastify.post("/cancel", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = cancelSchema.parse(request.body);
    const { immediate } = body;

    const subscription = await (request.tenantDb as any).subscription.findFirst({
      where: { shopId: request.shopId },
    });

    if (!subscription) {
      throw new NotFoundError("Subscription for shop", request.shopId);
    }

    if (subscription.status === "CANCELLED") {
      throw new ConflictError("Subscription is already cancelled");
    }

    const updated = await (request.tenantDb as any).subscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelEffectiveDate: immediate ? new Date() : subscription.billingCycleEnd,
      },
    });

    fastify.log.info(
      {
        shopId: request.shopId,
        immediate,
        effectiveDate: updated.cancelEffectiveDate,
      },
      "Subscription cancelled",
    );

    reply.status(200);
    return {
      data: updated,
      message: immediate
        ? "Subscription cancelled immediately"
        : "Subscription scheduled for cancellation at end of billing cycle",
    };
  });

  // ── GET /plans ───────────────────────────────────────────────

  fastify.get("/plans", async (request: FastifyRequest, reply: FastifyReply) => {
    const plans = await (request.tenantDb as any).plan.findMany({
      orderBy: { tier: "asc" },
    });

    return {
      data: plans,
      total: plans.length,
    };
  });

  // ── GET /invoices ────────────────────────────────────────────

  fastify.get("/invoices", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const { page, limit } = query;

    const [invoices, total] = await Promise.all([
      (request.tenantDb as any).invoice.findMany({
        where: { shopId: request.shopId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          subscription: { select: { planTier: true } },
        },
      }),
      (request.tenantDb as any).invoice.count({
        where: { shopId: request.shopId },
      }),
    ]);

    return {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // ── GET /invoices/:id ────────────────────────────────────────

  fastify.get("/invoices/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const invoice = await (request.tenantDb as any).invoice.findUnique({
      where: { id },
      include: {
        subscription: true,
        lineItems: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError("Invoice", id);
    }

    if (invoice.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot access invoice from another shop");
    }

    return { data: invoice };
  });

  // ── GET /usage ───────────────────────────────────────────────

  fastify.get("/usage", async (request: FastifyRequest, reply: FastifyReply) => {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const usageBreakdown = await (request.tenantDb as any).usageEvent.groupBy({
      by: ["eventType"],
      where: {
        shopId: request.shopId,
        createdAt: { gte: last30Days },
      },
      _count: true,
    });

    // Get subscription limits
    const subscription = await (request.tenantDb as any).subscription.findFirst({
      where: { shopId: request.shopId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundError("Subscription for shop", request.shopId);
    }

    const usagePercentages = usageBreakdown.map((item: any) => ({
      eventType: item.eventType,
      count: item._count,
      limit: (subscription.plan as any)[`${item.eventType}_limit`] || null,
      percentage:
        (subscription.plan as any)[`${item.eventType}_limit`] > 0
          ? Math.round(
              (item._count / (subscription.plan as any)[`${item.eventType}_limit`]) * 100,
            )
          : 0,
    }));

    return {
      data: {
        billingPeriod: {
          start: subscription.billingCycleStart,
          end: subscription.billingCycleEnd,
        },
        usage: usagePercentages,
        isOverLimit: usagePercentages.some((u: any) => u.percentage > 100),
      },
    };
  });

  // ── POST /invoices/:id/pay ───────────────────────────────────

  fastify.post(
    "/invoices/:id/pay",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };

      const invoice = await (request.tenantDb as any).invoice.findUnique({
        where: { id },
      });

      if (!invoice) {
        throw new NotFoundError("Invoice", id);
      }

      if (invoice.shopId !== request.shopId) {
        throw new ForbiddenError("Cannot process payment for invoice from another shop");
      }

      if (invoice.status === "PAID") {
        throw new ConflictError("Invoice is already paid");
      }

      if (invoice.status === "CANCELLED") {
        throw new ConflictError("Cannot pay a cancelled invoice");
      }

      // Update invoice status
      const updated = await (request.tenantDb as any).invoice.update({
        where: { id },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      // Create payment record
      await (request.tenantDb as any).payment.create({
        data: {
          invoiceId: id,
          amount: invoice.totalAmount,
          method: "MANUAL",
          status: "COMPLETED",
          transactionId: `MANUAL-${Date.now()}`,
        },
      });

      fastify.log.info(
        { shopId: request.shopId, invoiceId: id, amount: invoice.totalAmount },
        "Invoice payment processed",
      );

      reply.status(200);
      return { data: updated };
    },
  );
}

export default billingSubscriptionsRoutes;
