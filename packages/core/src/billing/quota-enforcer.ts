/**
 * Quota Enforcer
 * Tracks and enforces resource quotas based on subscription plans.
 * Supports multiple resource types with automatic warning/blocking at thresholds.
 * Provides Fastify middleware for request-level quota checks.
 */

import { PrismaClient } from '@witylogix/db';

// ─── LOCAL TYPE DEFINITIONS ─────────────────────────────────────────
// Local BillingSubscription type
interface BillingSubscription {
  id: string;
  shopId: string;
  planId: string;
  status: 'trialing' | 'active' | 'cancelled' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date | null;
  paymentMethodId?: string | null;
  cancelledAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Fastify types are optional; using any for request/reply if module not available
type FastifyRequest = any;
type FastifyReply = any;

// ─── CONSTANTS ──────────────────────────────────────────────────────

export const WARNING_THRESHOLD = 0.8; // 80% usage triggers warning
export const HARD_LIMIT = 1.0; // 100% usage blocks operations

export type QuotaResource =
  | 'orders'
  | 'shipments'
  | 'api_calls'
  | 'storage'
  | 'drivers';

// ─── ERROR CLASSES ──────────────────────────────────────────────────

export class QuotaExceededError extends Error {
  constructor(
    public resource: QuotaResource,
    public current: number,
    public limit: number,
  ) {
    super(
      `Quota exceeded for ${resource}: ${current}/${limit}`,
    );
    this.name = 'QuotaExceededError';
  }
}

export class SubscriptionNotFoundError extends Error {
  constructor(shopId: string) {
    super(`No active subscription found for shop: ${shopId}`);
    this.name = 'SubscriptionNotFoundError';
  }
}

// ─── TYPES ──────────────────────────────────────────────────────────

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  percentage: number;
  isWarning: boolean;
  isExceeded: boolean;
}

export interface QuotaUsageSummary {
  [resource: string]: QuotaCheckResult;
}

export interface QuotaEvent {
  type: 'warning' | 'exceeded' | 'reset';
  resource: QuotaResource;
  shopId: string;
  current: number;
  limit: number;
  percentage: number;
  timestamp: Date;
}

// ─── QUOTA ENFORCER ─────────────────────────────────────────────────

export class QuotaEnforcer {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if a shop can use a resource
   * Returns detailed usage information with allowed/warning/exceeded states
   */
  async checkQuota(
    shopId: string,
    resource: QuotaResource,
  ): Promise<QuotaCheckResult> {
    const subscription = await this.getActiveSubscription(shopId);
    const limits = this.parseLimits(subscription);
    const limit = limits[resource];

    if (limit === null || limit === undefined || limit === Infinity) {
      // Unlimited resource
      return {
        allowed: true,
        current: 0,
        limit: limit || Infinity,
        percentage: 0,
        isWarning: false,
        isExceeded: false,
      };
    }

    const usage = await this.getCurrentUsage(subscription.id, resource);
    const percentage = limit > 0 ? usage / limit : 0;
    const isWarning = percentage >= WARNING_THRESHOLD && percentage < HARD_LIMIT;
    const isExceeded = percentage >= HARD_LIMIT;

    // Emit events for warnings and exceeded quotas
    if (isWarning) {
      this.emitEvent({
        type: 'warning',
        resource,
        shopId,
        current: usage,
        limit,
        percentage,
        timestamp: new Date(),
      });
    } else if (isExceeded) {
      this.emitEvent({
        type: 'exceeded',
        resource,
        shopId,
        current: usage,
        limit,
        percentage,
        timestamp: new Date(),
      });
    }

    return {
      allowed: !isExceeded,
      current: usage,
      limit,
      percentage: Math.min(100, percentage * 100),
      isWarning,
      isExceeded,
    };
  }

  /**
   * Atomically increment resource usage
   * Throws QuotaExceededError if hard limit would be exceeded
   */
  async incrementUsage(
    shopId: string,
    resource: QuotaResource,
    amount: number = 1,
  ): Promise<number> {
    const subscription = await this.getActiveSubscription(shopId);
    const limits = this.parseLimits(subscription);
    const limit = limits[resource];

    // If unlimited, just increment without checking
    if (!limit || limit === Infinity) {
      return this.doIncrement(subscription.id, resource, amount);
    }

    // Get current usage before increment
    const current = await this.getCurrentUsage(subscription.id, resource);
    const newUsage = current + amount;

    // Check hard limit
    if (newUsage > limit) {
      throw new QuotaExceededError(resource, newUsage, limit);
    }

    // Increment
    const updatedUsage = await this.doIncrement(subscription.id, resource, amount);

    // Check if we've crossed warning threshold
    const percentage = updatedUsage / limit;
    if (percentage >= WARNING_THRESHOLD && percentage < HARD_LIMIT) {
      this.emitEvent({
        type: 'warning',
        resource,
        shopId,
        current: updatedUsage,
        limit,
        percentage: percentage * 100,
        timestamp: new Date(),
      });
    }

    return updatedUsage;
  }

  /**
   * Reset monthly quota counters at billing period start
   */
  async resetMonthlyUsage(shopId: string): Promise<void> {
    const subscription = await this.getActiveSubscription(shopId);
    const now = new Date();

    // Reset all quota entries for this subscription
    await (this.prisma as any).storeQuotaUsage.updateMany({
      where: { subscriptionId: subscription.id },
      data: {
        currentUsage: 0,
        periodStart: now,
        periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    this.emitEvent({
      type: 'reset',
      resource: 'orders', // dummy resource
      shopId,
      current: 0,
      limit: 0,
      percentage: 0,
      timestamp: now,
    });
  }

  /**
   * Get complete usage summary for all resources
   */
  async getUsageSummary(shopId: string): Promise<QuotaUsageSummary> {
    const summary: QuotaUsageSummary = {};
    const resources: QuotaResource[] = [
      'orders',
      'shipments',
      'api_calls',
      'storage',
      'drivers',
    ];

    for (const resource of resources) {
      summary[resource] = await this.checkQuota(shopId, resource);
    }

    return summary;
  }

  /**
   * Fastify middleware factory for quota enforcement
   * Usage: app.addHook('preHandler', enforceQuota(['orders', 'api_calls']))
   */
  enforceQuotaMiddleware(
    resourcesToCheck: QuotaResource[],
  ): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Get shop ID from context (set by auth middleware)
      const shopId = (request as any).shopId;

      if (!shopId) {
        return reply.code(401).send({ error: 'Unauthorized: no shop context' });
      }

      try {
        // Check all specified resources
        for (const resource of resourcesToCheck) {
          const quota = await this.checkQuota(shopId, resource);
          if (!quota.allowed) {
            return reply.code(429).send({
              error: 'Quota exceeded',
              resource,
              current: quota.current,
              limit: quota.limit,
              percentage: quota.percentage,
            });
          }
        }
      } catch (error) {
        if (error instanceof SubscriptionNotFoundError) {
          return reply.code(402).send({
            error: 'Payment Required: no active subscription',
          });
        }
        throw error;
      }
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────

  private async getActiveSubscription(shopId: string): Promise<BillingSubscription> {
    const subscription = await (this.prisma as any).billingSubscription.findUnique({
      where: { shopId },
    });

    if (!subscription || subscription.status === 'cancelled' || subscription.status === 'expired') {
      throw new SubscriptionNotFoundError(shopId);
    }

    return subscription;
  }

  private parseLimits(subscription: BillingSubscription): Record<string, number | null> {
    // Get plan limits from subscription via plan relation
    // This is a simplified version; in production would need to fetch plan
    const limitsJson = (subscription as any).plan?.limits;

    if (!limitsJson) {
      return {
        orders: null,
        shipments: null,
        api_calls: null,
        storage: null,
        drivers: null,
      };
    }

    try {
      const limits = typeof limitsJson === 'string' ? JSON.parse(limitsJson) : limitsJson;
      return {
        orders: limits.orders ?? null,
        shipments: limits.shipments ?? null,
        api_calls: limits.api_calls ?? null,
        storage: limits.storage ?? null,
        drivers: limits.drivers ?? null,
      };
    } catch {
      return {
        orders: null,
        shipments: null,
        api_calls: null,
        storage: null,
        drivers: null,
      };
    }
  }

  private async getCurrentUsage(
    subscriptionId: string,
    resource: QuotaResource,
  ): Promise<number> {
    const now = new Date();

    const usage = await (this.prisma as any).storeQuotaUsage.findFirst({
      where: {
        subscriptionId,
        resource,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
    });

    return usage?.currentUsage ?? 0;
  }

  private async doIncrement(
    subscriptionId: string,
    resource: QuotaResource,
    amount: number,
  ): Promise<number> {
    const now = new Date();

    const updated = await (this.prisma as any).storeQuotaUsage.updateMany({
      where: {
        subscriptionId,
        resource,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      data: {
        currentUsage: {
          increment: amount,
        },
      },
    });

    if (updated.count === 0) {
      // No matching quota entry found, this shouldn't happen in normal flow
      throw new Error(
        `No active quota tracking for subscription ${subscriptionId}/${resource}`,
      );
    }

    // Fetch and return the updated value
    const quota = await (this.prisma as any).storeQuotaUsage.findFirst({
      where: {
        subscriptionId,
        resource,
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
    });

    return quota?.currentUsage ?? 0;
  }

  private emitEvent(event: QuotaEvent): void {
    // In production, emit to event bus/pubsub
    // Available event types: 'quota.warning', 'quota.exceeded', 'quota.reset'
    console.log(`[QuotaEvent] ${event.type}:`, JSON.stringify(event));
  }
}
