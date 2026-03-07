/**
 * Billing Service — Plan definitions, usage tracking, limit enforcement
 *
 * Exports:
 *   - PLANS: Plan definitions (FREE, STARTER, PROFESSIONAL, ENTERPRISE)
 *   - checkUsageLimit: Verify if usage is within plan limits
 *   - calculateProration: Calculate credits/charges for plan changes
 *   - getUsageSummary: Get current usage metrics for a shop
 *   - recordUsageEvent: Increment usage counters
 */

// PlanTier from Prisma schema: FREE | STARTER | GROWTH | ENTERPRISE
type PlanTier = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";

// ─── PLAN DEFINITIONS ───────────────────────────────────────────────────

export interface PlanFeatures {
  shipmentsPerMonth: number;
  driversLimit: number;
  apiCallsPerMonth: number;
  notificationsPerMonth: number;
  hasRouteOptimization: boolean;
  hasAnalytics: boolean;
  hasMultiCarrier: boolean;
  hasDedicatedSupport: boolean;
  monthlyPrice: number;
  billingCycle: "monthly" | "annual";
}

export const PLANS: Record<PlanTier, PlanFeatures> = {
  FREE: {
    shipmentsPerMonth: 50,
    driversLimit: 1,
    apiCallsPerMonth: 1000,
    notificationsPerMonth: 100,
    hasRouteOptimization: false,
    hasAnalytics: false,
    hasMultiCarrier: false,
    hasDedicatedSupport: false,
    monthlyPrice: 0,
    billingCycle: "monthly",
  },
  STARTER: {
    shipmentsPerMonth: 500,
    driversLimit: 5,
    apiCallsPerMonth: 10000,
    notificationsPerMonth: 5000,
    hasRouteOptimization: true,
    hasAnalytics: true,
    hasMultiCarrier: false,
    hasDedicatedSupport: false,
    monthlyPrice: 29,
    billingCycle: "monthly",
  },
  GROWTH: {
    shipmentsPerMonth: 5000,
    driversLimit: 25,
    apiCallsPerMonth: 100000,
    notificationsPerMonth: 50000,
    hasRouteOptimization: true,
    hasAnalytics: true,
    hasMultiCarrier: true,
    hasDedicatedSupport: false,
    monthlyPrice: 99,
    billingCycle: "monthly",
  },
  ENTERPRISE: {
    shipmentsPerMonth: Infinity,
    driversLimit: Infinity,
    apiCallsPerMonth: Infinity,
    notificationsPerMonth: Infinity,
    hasRouteOptimization: true,
    hasAnalytics: true,
    hasMultiCarrier: true,
    hasDedicatedSupport: true,
    monthlyPrice: 299, // Starting price; actual price negotiated
    billingCycle: "monthly",
  },
};

// ─── USAGE METRICS TYPES ────────────────────────────────────────────────

export interface UsageMetrics {
  shipmentsUsed: number;
  driversUsed: number;
  apiCallsUsed: number;
  notificationsSent: number;
  createdAt: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}

export interface UsageSummary {
  plan: PlanTier;
  status: "active" | "trial" | "cancelled" | "past_due";
  billingCycle: string;
  nextBillingDate: Date | null;
  currentMetrics: UsageMetrics;
  limits: {
    shipments: { used: number; limit: number; remaining: number };
    drivers: { used: number; limit: number; remaining: number };
    apiCalls: { used: number; limit: number; remaining: number };
    notifications: { used: number; limit: number; remaining: number };
  };
  overageProjection: {
    willExceedShipments: boolean;
    willExceedDrivers: boolean;
    willExceedApiCalls: boolean;
    willExceedNotifications: boolean;
  };
}

// ─── USAGE LIMIT CHECKING ───────────────────────────────────────────────

export interface LimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  percentageUsed: number;
}

/**
 * Check if current usage is within plan limits
 * @param plan - The plan tier
 * @param metric - The usage metric to check (shipments | drivers | apiCalls | notifications)
 * @param currentUsage - Current usage count
 * @returns LimitCheckResult with allowed flag and remaining quota
 */
export function checkUsageLimit(
  plan: PlanTier,
  metric: "shipments" | "drivers" | "apiCalls" | "notifications",
  currentUsage: number,
): LimitCheckResult {
  const planFeatures = PLANS[plan];

  let limit: number;
  switch (metric) {
    case "shipments":
      limit = planFeatures.shipmentsPerMonth;
      break;
    case "drivers":
      limit = planFeatures.driversLimit;
      break;
    case "apiCalls":
      limit = planFeatures.apiCallsPerMonth;
      break;
    case "notifications":
      limit = planFeatures.notificationsPerMonth;
      break;
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }

  const remaining = Math.max(0, limit - currentUsage);
  const percentageUsed = limit === Infinity ? 0 : (currentUsage / limit) * 100;

  return {
    allowed: currentUsage < limit,
    remaining,
    limit,
    percentageUsed: Math.min(100, percentageUsed),
  };
}

// ─── PRORATION CALCULATION ──────────────────────────────────────────────

/**
 * Calculate proration credit/charge when changing plans mid-cycle
 * @param currentPlan - Current plan tier
 * @param newPlan - New plan tier
 * @param daysRemaining - Days remaining in current billing cycle
 * @returns Number (positive = credit, negative = charge)
 */
export function calculateProration(
  currentPlan: PlanTier,
  newPlan: PlanTier,
  daysRemaining: number,
): number {
  const currentPlanFeatures = PLANS[currentPlan];
  const newPlanFeatures = PLANS[newPlan];

  // Calculate daily rate for each plan
  const currentDailyRate = currentPlanFeatures.monthlyPrice / 30;
  const newDailyRate = newPlanFeatures.monthlyPrice / 30;

  // Calculate credit for unused days on current plan
  const creditForUnusedDays = currentDailyRate * daysRemaining;

  // Calculate charge for new plan (full month)
  const chargeForNewPlan = newPlanFeatures.monthlyPrice;

  // Net amount due: if positive, customer pays; if negative, customer gets credit
  return chargeForNewPlan - creditForUnusedDays;
}

// ─── USAGE SUMMARY GENERATION ───────────────────────────────────────────

/**
 * Generate a comprehensive usage summary for a shop
 * This would be called by the route to gather current subscription state
 * Implementation would need access to database
 */
export function createUsageSummary(
  plan: PlanTier,
  status: "active" | "trial" | "cancelled" | "past_due",
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  metrics: UsageMetrics,
): UsageSummary {
  const planFeatures = PLANS[plan];

  // Calculate remaining quota
  const shipmentsRemaining = Math.max(
    0,
    planFeatures.shipmentsPerMonth - metrics.shipmentsUsed,
  );
  const driversRemaining = Math.max(
    0,
    planFeatures.driversLimit - metrics.driversUsed,
  );
  const apiCallsRemaining = Math.max(
    0,
    planFeatures.apiCallsPerMonth - metrics.apiCallsUsed,
  );
  const notificationsRemaining = Math.max(
    0,
    planFeatures.notificationsPerMonth - metrics.notificationsSent,
  );

  // Calculate if limits will be exceeded
  const daysInPeriod = Math.ceil(
    (billingPeriodEnd.getTime() - billingPeriodStart.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const daysElapsed = Math.ceil(
    (new Date().getTime() - billingPeriodStart.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const projectedShipmentsPerDay = daysElapsed > 0 ? metrics.shipmentsUsed / daysElapsed : 0;
  const projectedShipmentsTotal = projectedShipmentsPerDay * daysInPeriod;

  return {
    plan,
    status,
    billingCycle: planFeatures.billingCycle,
    nextBillingDate: status === "active" ? billingPeriodEnd : null,
    currentMetrics: metrics,
    limits: {
      shipments: {
        used: metrics.shipmentsUsed,
        limit: planFeatures.shipmentsPerMonth,
        remaining: shipmentsRemaining,
      },
      drivers: {
        used: metrics.driversUsed,
        limit: planFeatures.driversLimit,
        remaining: driversRemaining,
      },
      apiCalls: {
        used: metrics.apiCallsUsed,
        limit: planFeatures.apiCallsPerMonth,
        remaining: apiCallsRemaining,
      },
      notifications: {
        used: metrics.notificationsSent,
        limit: planFeatures.notificationsPerMonth,
        remaining: notificationsRemaining,
      },
    },
    overageProjection: {
      willExceedShipments:
        planFeatures.shipmentsPerMonth !== Infinity &&
        projectedShipmentsTotal > planFeatures.shipmentsPerMonth,
      willExceedDrivers:
        planFeatures.driversLimit !== Infinity &&
        metrics.driversUsed > planFeatures.driversLimit,
      willExceedApiCalls:
        planFeatures.apiCallsPerMonth !== Infinity &&
        metrics.apiCallsUsed > planFeatures.apiCallsPerMonth,
      willExceedNotifications:
        planFeatures.notificationsPerMonth !== Infinity &&
        metrics.notificationsSent > planFeatures.notificationsPerMonth,
    },
  };
}

// ─── PLAN COMPARISON MATRIX ─────────────────────────────────────────────

export interface PlanComparison {
  tier: PlanTier;
  features: PlanFeatures;
  displayName: string;
  description: string;
  recommendedFor: string;
}

export function getPlanComparison(): PlanComparison[] {
  return [
    {
      tier: "FREE",
      features: PLANS.FREE,
      displayName: "Free",
      description: "Perfect for testing and small operations",
      recommendedFor: "Startups, testing",
    },
    {
      tier: "STARTER",
      features: PLANS.STARTER,
      displayName: "Starter",
      description: "Ideal for growing local delivery businesses",
      recommendedFor: "Small to medium businesses",
    },
    {
      tier: "GROWTH",
      features: PLANS.GROWTH,
      displayName: "Growth",
      description: "For rapidly scaling delivery operations",
      recommendedFor: "Growing businesses, multi-carrier",
    },
    {
      tier: "ENTERPRISE",
      features: PLANS.ENTERPRISE,
      displayName: "Enterprise",
      description: "Unlimited usage with dedicated support",
      recommendedFor: "Large enterprises, custom needs",
    },
  ];
}

// ─── EXPORT HELPER TYPES ─────────────────────────────────────────────────

export type BillingEvent =
  | "shipment_created"
  | "label_generated"
  | "notification_sent"
  | "api_call";

export interface BillingEventData {
  type: BillingEvent;
  shopId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
