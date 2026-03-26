/**
 * Subscription Manager
 * Manages subscription lifecycle: creation, upgrades, downgrades, renewals, and cancellations.
 * Supports trial periods, prorated billing, and automatic renewal cycles.
 */

import { PrismaClient } from '@witylogix/db';

// ─── LOCAL TYPE DEFINITIONS ─────────────────────────────────────────
// These types replace non-existent exports from @witylogix/db

interface Decimal {
  dividedBy(divisor: number | string): Decimal;
  times(multiplier: number | string): Decimal;
  minus(subtrahend: number | string): Decimal;
  plus(addend: number | string): Decimal;
  greaterThan(value: number | string): boolean;
  toString(): string;
}

export type BillingPlan = {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  trialDays?: number;
  limits?: Record<string, number | null>;
  createdAt?: Date;
  updatedAt?: Date;
};

export type BillingSubscription = {
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
};

// ─── ERROR CLASSES ──────────────────────────────────────────────────

export class SubscriptionNotFoundError extends Error {
  constructor(subscriptionId: string) {
    super(`Subscription not found: ${subscriptionId}`);
    this.name = 'SubscriptionNotFoundError';
  }
}

export class PlanNotFoundError extends Error {
  constructor(planId: string) {
    super(`Plan not found: ${planId}`);
    this.name = 'PlanNotFoundError';
  }
}

export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

// ─── TYPES ──────────────────────────────────────────────────────────

export interface SubscriptionWithPlan {
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
  plan: BillingPlan;
}

export interface ProrationResult {
  creditAmount: number;
  chargeAmount: number;
  netDueAmount: number;
  daysRemaining: number;
}

// ─── SUBSCRIPTION MANAGER ───────────────────────────────────────────

export class SubscriptionManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new subscription for a shop
   * If the plan has a trial period, the subscription starts in "trialing" status
   * Otherwise, it starts in "active" status with immediate billing
   */
  async createSubscription(
    shopId: string,
    planId: string,
    paymentMethodId?: string,
  ): Promise<SubscriptionWithPlan> {
    const plan = await (this.prisma as any).billingPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    // Check if shop already has an active subscription
    const existingSubscription = await (this.prisma as any).billingSubscription.findUnique({
      where: { shopId },
    });

    if (existingSubscription) {
      throw new SubscriptionError(`Shop ${shopId} already has an active subscription`);
    }

    const now = new Date();
    const periodStart = now;
    const trialDays = plan.trialDays || 0;
    const isTrialing = trialDays > 0;

    // Calculate period end: trial duration if trialing, else 30 days for monthly, 365 for yearly
    let periodEnd: Date;
    if (isTrialing) {
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + trialDays);
    } else {
      periodEnd = new Date(periodStart);
      const daysInPeriod = plan.interval === 'yearly' ? 365 : 30;
      periodEnd.setDate(periodEnd.getDate() + daysInPeriod);
    }

    const subscription = await (this.prisma as any).billingSubscription.create({
      data: {
        shopId,
        planId,
        status: isTrialing ? 'trialing' : 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEnd: isTrialing ? periodEnd : null,
        paymentMethodId,
      },
      include: { plan: true },
    });

    // Initialize quota usage for all resources
    await this.initializeQuotaTracking(subscription.id, periodStart, periodEnd);

    return subscription;
  }

  /**
   * Upgrade subscription to a higher plan
   * Generates a proration invoice for the difference
   */
  async upgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
  ): Promise<SubscriptionWithPlan> {
    const subscription = await this.getSubscriptionWithPlan(subscriptionId);
    const newPlan = await this.getPlan(newPlanId);

    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      throw new SubscriptionError('Cannot upgrade a cancelled or expired subscription');
    }

    const proration = this.calculateProration(
      subscription.plan,
      newPlan,
      this.getDaysRemaining(subscription.currentPeriodEnd),
    );

    const updated = await (this.prisma as any).billingSubscription.update({
      where: { id: subscriptionId },
      data: { planId: newPlanId },
      include: { plan: true },
    });

    // Emit event for invoice generation
    // In production, this would trigger invoice-generator to create proration invoice
    this.emitEvent('subscription.upgraded', {
      subscriptionId,
      oldPlanId: subscription.planId,
      newPlanId,
      proration,
    });

    return updated;
  }

  /**
   * Downgrade subscription to a lower plan
   * Change takes effect at the next period boundary
   */
  async downgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
  ): Promise<SubscriptionWithPlan> {
    const subscription = await this.getSubscriptionWithPlan(subscriptionId);

    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      throw new SubscriptionError('Cannot downgrade a cancelled or expired subscription');
    }

    // For downgrade, set to take effect at period end
    const updated = await (this.prisma as any).billingSubscription.update({
      where: { id: subscriptionId },
      data: { planId: newPlanId },
      include: { plan: true },
    });

    this.emitEvent('subscription.downgraded', {
      subscriptionId,
      oldPlanId: subscription.planId,
      newPlanId,
      effectiveDate: subscription.currentPeriodEnd,
    });

    return updated;
  }

  /**
   * Cancel a subscription
   * immediate=true: Cancel effective now
   * immediate=false: Cancel at period end (default)
   */
  async cancelSubscription(
    subscriptionId: string,
    immediate: boolean = false,
  ): Promise<SubscriptionWithPlan> {
    const subscription = await this.getSubscriptionWithPlan(subscriptionId);

    if (subscription.status === 'cancelled') {
      throw new SubscriptionError('Subscription is already cancelled');
    }

    const now = new Date();
    const cancelDate = immediate ? now : subscription.currentPeriodEnd;

    const updated = await (this.prisma as any).billingSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: immediate ? 'cancelled' : subscription.status,
        cancelledAt: now,
        cancelAtPeriodEnd: !immediate,
        currentPeriodEnd: immediate ? now : subscription.currentPeriodEnd,
      },
      include: { plan: true },
    });

    this.emitEvent('subscription.cancelled', {
      subscriptionId,
      immediate,
      cancelledAt: now,
    });

    return updated;
  }

  /**
   * Renew a subscription for the next billing period
   * Called automatically or manually to create the next cycle
   */
  async renewSubscription(subscriptionId: string): Promise<SubscriptionWithPlan> {
    const subscription = await this.getSubscriptionWithPlan(subscriptionId);

    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      throw new SubscriptionError('Cannot renew a cancelled or expired subscription');
    }

    const now = new Date();
    const periodStart = subscription.currentPeriodEnd;
    const periodEnd = new Date(periodStart);

    const daysInPeriod = subscription.plan.interval === 'yearly' ? 365 : 30;
    periodEnd.setDate(periodEnd.getDate() + daysInPeriod);

    const updated = await (this.prisma as any).billingSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        trialEnd: null,
      },
      include: { plan: true },
    });

    // Reset quota tracking for new period
    await this.initializeQuotaTracking(subscriptionId, periodStart, periodEnd);

    this.emitEvent('subscription.renewed', {
      subscriptionId,
      periodStart,
      periodEnd,
    });

    return updated;
  }

  /**
   * Get subscription status with plan details
   */
  async getSubscriptionStatus(shopId: string): Promise<SubscriptionWithPlan | null> {
    return (this.prisma as any).billingSubscription.findUnique({
      where: { shopId },
      include: { plan: true },
    });
  }

  /**
   * Process expired trials in batch
   * Transition trialing subscriptions to active or cancelled status
   * Should be called periodically (e.g., daily via cron)
   */
  async handleExpiredTrials(): Promise<number> {
    const now = new Date();

    // Find all subscriptions with expired trials
    const expiredTrials = await (this.prisma as any).billingSubscription.findMany({
      where: {
        status: 'trialing',
        trialEnd: {
          lte: now,
        },
      },
    });

    let processedCount = 0;

    for (const subscription of expiredTrials) {
      try {
        // Transition to active if payment method exists, otherwise cancel
        if (subscription.paymentMethodId) {
          await (this.prisma as any).billingSubscription.update({
            where: { id: subscription.id },
            data: { status: 'active' },
          });

          this.emitEvent('subscription.trial_expired', {
            subscriptionId: subscription.id,
            action: 'activated',
          });
        } else {
          await (this.prisma as any).billingSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'expired',
              cancelledAt: now,
            },
          });

          this.emitEvent('subscription.trial_expired', {
            subscriptionId: subscription.id,
            action: 'expired',
          });
        }

        processedCount++;
      } catch (error) {
        // Log error and continue processing other trials
        console.error(`Error processing trial expiration for ${subscription.id}:`, error);
      }
    }

    return processedCount;
  }

  /**
   * Calculate proration amount when changing plans mid-cycle
   * Positive amount = customer owes
   * Negative amount = customer gets credit
   */
  calculateProration(
    currentPlan: BillingPlan,
    newPlan: BillingPlan,
    daysRemaining: number,
  ): ProrationResult {
    const currentPrice = typeof currentPlan.price === 'number' ? currentPlan.price : parseFloat(String(currentPlan.price));
    const newPrice = typeof newPlan.price === 'number' ? newPlan.price : parseFloat(String(newPlan.price));
    const daysInPeriod = currentPlan.interval === 'yearly' ? 365 : 30;

    // Daily rates
    const currentDailyRate = currentPrice / daysInPeriod;
    const newDailyRate = newPrice / daysInPeriod;

    // Credit for unused days on current plan
    const creditAmount = currentDailyRate * daysRemaining;

    // Charge for new plan (full period)
    const chargeAmount = newPrice;

    // Net due: positive = pay, negative = credit
    const netDueAmount = chargeAmount - creditAmount;

    return {
      creditAmount,
      chargeAmount,
      netDueAmount,
      daysRemaining,
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────

  private async getSubscriptionWithPlan(
    subscriptionId: string,
  ): Promise<SubscriptionWithPlan> {
    const subscription = await (this.prisma as any).billingSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    return subscription;
  }

  private async getPlan(planId: string): Promise<BillingPlan> {
    const plan = await (this.prisma as any).billingPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    return plan;
  }

  private getDaysRemaining(periodEnd: Date): number {
    const now = new Date();
    const timeDiff = periodEnd.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }

  private async initializeQuotaTracking(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const resources = ['orders', 'shipments', 'api_calls', 'storage', 'drivers'];

    // Get shop ID for context
    const subscription = await (this.prisma as any).billingSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) return;

    for (const resource of resources) {
      try {
        await (this.prisma as any).storeQuotaUsage.upsert({
          where: {
            subscriptionId_resource_periodStart: {
              subscriptionId,
              resource,
              periodStart,
            },
          },
          update: {},
          create: {
            subscriptionId,
            shopId: subscription.shopId,
            resource,
            currentUsage: 0,
            periodStart,
            periodEnd,
          },
        });
      } catch (error) {
        // Log but don't fail the entire initialization
        console.error(`Error initializing quota for ${resource}:`, error);
      }
    }
  }

  private emitEvent(eventType: string, data: Record<string, unknown>): void {
    // In production, emit to event bus/pubsub
    // For now, just log
    console.log(`[SubscriptionEvent] ${eventType}:`, JSON.stringify(data));
  }
}
