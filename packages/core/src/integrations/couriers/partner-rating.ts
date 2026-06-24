/**
 * Courier Partner Rating Engine
 *
 * Calculates composite partner performance scores based on:
 * - On-time delivery rate (40% weight)
 * - Damage rate (25% weight)
 * - Customer rating average (20% weight)
 * - Cost efficiency (10% weight)
 * - SLA compliance (5% weight)
 *
 * Features:
 * - Rolling 30/60/90 day windows
 * - Trend detection (improving/declining/stable)
 * - Auto-suspension at score < 60
 * - Configurable weights per metric
 * - Rating history tracking
 */

import { prisma } from "@witylogix/db";
import type { Prisma } from "@witylogix/db";

// ─── TYPES ──────────────────────────────────────────────────────────────

/**
 * Metric weights for rating calculation
 */
export interface MetricWeights {
  onTimeRate: number; // 0-1, default 0.40
  damageRate: number; // 0-1, default 0.25
  customerRating: number; // 0-1, default 0.20
  costEfficiency: number; // 0-1, default 0.10
  slaCompliance: number; // 0-1, default 0.05
}

/**
 * Performance metrics for a partner
 */
export interface PerformanceMetrics {
  onTimeDeliveries: number;
  totalDeliveries: number;
  damagedDeliveries: number;
  averageCustomerRating: number;
  totalRatings: number;
  averageCost: number;
  benchmarkCost: number;
  slaCompliance: number;
  period: "30d" | "60d" | "90d";
}

/**
 * Calculated partner score
 */
export interface PartnerScore {
  partnerId: string;
  score: number; // 0-100
  onTimeRateScore: number; // 0-100
  damageRateScore: number; // 0-100
  customerRatingScore: number; // 0-100
  costEfficiencyScore: number; // 0-100
  slaComplianceScore: number; // 0-100
  trend: "improving" | "declining" | "stable";
  trendPercentage: number; // Change percentage from previous period
  riskFlags: string[];
  recommendedAction: "active" | "review" | "suspend";
  period: "30d" | "60d" | "90d";
  calculatedAt: Date;
}

/**
 * Partner rating history entry
 */
export interface PartnerRatingHistoryEntry {
  id: string;
  partnerId: string;
  score: number;
  period: "30d" | "60d" | "90d";
  metrics: PerformanceMetrics;
  trend: "improving" | "declining" | "stable";
  calculatedAt: Date;
}

/**
 * SLA configuration for partner
 */
export interface SLAConfig {
  partnerId: string;
  pickupTimeMinutes: number; // Expected time to pick up
  deliveryTimeMinutes: number; // Expected time to deliver
  damageThresholdPercent: number; // Acceptable damage rate
  onTimeThresholdPercent: number; // Expected on-time rate
  minCustomerRating: number; // Minimum acceptable rating
}

/**
 * SLA violation record
 */
export interface SLAViolation {
  deliveryId: string;
  partnerId: string;
  violationType: "late_pickup" | "late_delivery" | "damage" | "rating";
  expectedTime?: Date;
  actualTime?: Date;
  details: string;
  severity: "low" | "medium" | "high";
  timestamp: Date;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: MetricWeights = {
  onTimeRate: 0.4,
  damageRate: 0.25,
  customerRating: 0.2,
  costEfficiency: 0.1,
  slaCompliance: 0.05,
};

const AUTO_SUSPENSION_THRESHOLD = 60;
const REVIEW_THRESHOLD = 75;
const GOOD_THRESHOLD = 80;

// ─── MAIN RATING CALCULATION ────────────────────────────────────────────

/**
 * Calculate partner score for a given period
 *
 * @param partnerId - Partner ID
 * @param period - Time window ("30d", "60d", or "90d")
 * @param weights - Custom metric weights (optional)
 * @returns PartnerScore
 */
export async function calculatePartnerScore(
  partnerId: string,
  period: "30d" | "60d" | "90d" = "30d",
  weights: Partial<MetricWeights> = {}
): Promise<PartnerScore> {
  const mergedWeights = { ...DEFAULT_WEIGHTS, ...weights };

  // Validate weights sum to 1.0
  const weightSum =
    mergedWeights.onTimeRate +
    mergedWeights.damageRate +
    mergedWeights.customerRating +
    mergedWeights.costEfficiency +
    mergedWeights.slaCompliance;

  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(
      `Weights must sum to 1.0, got ${weightSum.toFixed(2)}`
    );
  }

  // Get metrics
  const metrics = await getPerformanceMetrics(partnerId, period);
  const previousMetrics = await getPerformanceMetrics(
    partnerId,
    period === "30d" ? "60d" : period === "60d" ? "90d" : "90d"
  );

  // Calculate individual scores (0-100)
  const onTimeRateScore = calculateOnTimeRateScore(metrics);
  const damageRateScore = calculateDamageRateScore(metrics);
  const customerRatingScore = calculateCustomerRatingScore(metrics);
  const costEfficiencyScore = calculateCostEfficiencyScore(metrics);
  const slaComplianceScore = calculateSLAComplianceScore(metrics);

  // Calculate weighted composite score
  const score =
    onTimeRateScore * mergedWeights.onTimeRate +
    damageRateScore * mergedWeights.damageRate +
    customerRatingScore * mergedWeights.customerRating +
    costEfficiencyScore * mergedWeights.costEfficiency +
    slaComplianceScore * mergedWeights.slaCompliance;

  // Detect trend
  const { trend, trendPercentage } = detectTrend(
    score,
    previousMetrics ? calculateCompositeScore(
      previousMetrics,
      mergedWeights
    ) : score
  );

  // Identify risk flags
  const riskFlags = identifyRiskFlags(metrics, score);

  // Determine recommended action
  const recommendedAction = getRecommendedAction(score);

  return {
    partnerId,
    score: Math.round(score * 10) / 10, // Round to 1 decimal
    onTimeRateScore: Math.round(onTimeRateScore * 10) / 10,
    damageRateScore: Math.round(damageRateScore * 10) / 10,
    customerRatingScore: Math.round(customerRatingScore * 10) / 10,
    costEfficiencyScore: Math.round(costEfficiencyScore * 10) / 10,
    slaComplianceScore: Math.round(slaComplianceScore * 10) / 10,
    trend,
    trendPercentage: Math.round(trendPercentage * 10) / 10,
    riskFlags,
    recommendedAction,
    period,
    calculatedAt: new Date(),
  };
}

// ─── METRIC RETRIEVAL ────────────────────────────────────────────────────

/**
 * Get performance metrics for partner in a period
 */
async function getPerformanceMetrics(
  partnerId: string,
  period: "30d" | "60d" | "90d"
): Promise<PerformanceMetrics> {
  const days = parseInt(period);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get deliveries in period
  const deliveries = await (prisma.courierDelivery as any).findMany({
    where: {
      partnerId,
      createdAt: { gte: since },
    },
  });

  if (deliveries.length === 0) {
    return {
      onTimeDeliveries: 0,
      totalDeliveries: 0,
      damagedDeliveries: 0,
      averageCustomerRating: 0,
      totalRatings: 0,
      averageCost: 0,
      benchmarkCost: 0,
      slaCompliance: 0,
      period,
    };
  }

  // Count on-time deliveries
  const onTimeCount = deliveries.filter((d: any) => {
    if (!d.quote || !d.deliveredAt) return false;
    const quote = typeof d.quote === "string" ? JSON.parse(d.quote) : d.quote;
    const estimatedMinutes = quote.estimatedMinutes || 0;
    const createdTime = new Date(d.createdAt);
    const estimatedTime = new Date(createdTime.getTime() + estimatedMinutes * 60000);
    return new Date(d.deliveredAt) <= estimatedTime;
  }).length;

  // Count damaged (would come from support tickets or damage reports)
  // For now, assuming damage metadata in metadata field
  const damagedCount = deliveries.filter((d: any) => {
    const metadata = typeof d.metadata === "string" ? JSON.parse(d.metadata) : d.metadata;
    return metadata?.damaged === true;
  }).length;

  // Calculate average cost
  const costs = deliveries
    .filter((d: any) => d.actualCost)
    .map((d: any) => parseFloat(d.actualCost));
  const averageCost = costs.length > 0 ? costs.reduce((a: number, b: number) => a + b, 0) / costs.length : 0;

  // Get benchmark cost (average across all partners)
  const allDeliveries = await (prisma.courierDelivery as any).findMany({
    where: {
      createdAt: { gte: since },
    },
    select: { actualCost: true },
  });
  const allCosts = allDeliveries
    .filter((d: any) => d.actualCost)
    .map((d: any) => parseFloat(d.actualCost));
  const benchmarkCost = allCosts.length > 0 ? allCosts.reduce((a: number, b: number) => a + b, 0) / allCosts.length : averageCost;

  // Get customer ratings (would come from a ratings table)
  // For demonstration, assuming ratings in metadata
  const ratings = deliveries
    .filter((d: any) => {
      const metadata = typeof d.metadata === "string" ? JSON.parse(d.metadata) : d.metadata;
      return metadata?.customerRating !== undefined;
    })
    .map((d: any) => {
      const metadata = typeof d.metadata === "string" ? JSON.parse(d.metadata) : d.metadata;
      return metadata.customerRating as number;
    });

  const averageRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 5.0;

  return {
    onTimeDeliveries: onTimeCount,
    totalDeliveries: deliveries.length,
    damagedDeliveries: damagedCount,
    averageCustomerRating: averageRating,
    totalRatings: ratings.length,
    averageCost,
    benchmarkCost,
    slaCompliance: 100, // Will be set by SLA tracker
    period,
  };
}

// ─── INDIVIDUAL SCORE CALCULATIONS ──────────────────────────────────────

/**
 * Calculate on-time rate score (0-100)
 */
function calculateOnTimeRateScore(metrics: PerformanceMetrics): number {
  if (metrics.totalDeliveries === 0) return 100; // No data = good assumption

  const onTimeRate = metrics.onTimeDeliveries / metrics.totalDeliveries;

  // Linear scale: 50% on-time = 50 score, 100% = 100 score
  return Math.min(100, onTimeRate * 100);
}

/**
 * Calculate damage rate score (0-100)
 */
function calculateDamageRateScore(metrics: PerformanceMetrics): number {
  if (metrics.totalDeliveries === 0) return 100;

  const damageRate = metrics.damagedDeliveries / metrics.totalDeliveries;

  // Inverse: 0% damage = 100, 5% damage = 50, 10%+ = 0
  const score = Math.max(0, 100 - damageRate * 2000);
  return Math.min(100, score);
}

/**
 * Calculate customer rating score (0-100)
 */
function calculateCustomerRatingScore(metrics: PerformanceMetrics): number {
  if (metrics.totalRatings === 0) return 100;

  // Scale 5-star rating to 0-100
  return Math.min(100, (metrics.averageCustomerRating / 5) * 100);
}

/**
 * Calculate cost efficiency score (0-100)
 */
function calculateCostEfficiencyScore(metrics: PerformanceMetrics): number {
  if (metrics.benchmarkCost === 0) return 100;

  // Cost ratio: lower is better
  const ratio = metrics.averageCost / metrics.benchmarkCost;

  // 1.0 ratio = 100 score, 2.0 ratio = 0 score (linear)
  const score = Math.max(0, 100 - (ratio - 1) * 100);
  return Math.min(100, score);
}

/**
 * Calculate SLA compliance score (0-100)
 */
function calculateSLAComplianceScore(metrics: PerformanceMetrics): number {
  // Will be provided by SLA tracker
  return Math.min(100, metrics.slaCompliance);
}

/**
 * Calculate composite score from metrics and weights
 */
function calculateCompositeScore(
  metrics: PerformanceMetrics,
  weights: MetricWeights
): number {
  const onTimeScore = calculateOnTimeRateScore(metrics);
  const damageScore = calculateDamageRateScore(metrics);
  const ratingScore = calculateCustomerRatingScore(metrics);
  const costScore = calculateCostEfficiencyScore(metrics);
  const slaScore = calculateSLAComplianceScore(metrics);

  return (
    onTimeScore * weights.onTimeRate +
    damageScore * weights.damageRate +
    ratingScore * weights.customerRating +
    costScore * weights.costEfficiency +
    slaScore * weights.slaCompliance
  );
}

// ─── TREND DETECTION ────────────────────────────────────────────────────

interface TrendResult {
  trend: "improving" | "declining" | "stable";
  trendPercentage: number;
}

/**
 * Detect trend in partner performance
 */
function detectTrend(currentScore: number, previousScore: number): TrendResult {
  const change = currentScore - previousScore;
  const percentage = previousScore > 0 ? (change / previousScore) * 100 : 0;

  // Stable if within ±2.5%
  if (Math.abs(percentage) <= 2.5) {
    return { trend: "stable", trendPercentage: 0 };
  }

  return {
    trend: change > 0 ? "improving" : "declining",
    trendPercentage: percentage,
  };
}

// ─── RISK IDENTIFICATION ────────────────────────────────────────────────

/**
 * Identify risk flags based on metrics
 */
function identifyRiskFlags(metrics: PerformanceMetrics, score: number): string[] {
  const flags: string[] = [];

  const onTimeRate = metrics.totalDeliveries > 0
    ? (metrics.onTimeDeliveries / metrics.totalDeliveries) * 100
    : 100;
  const damageRate = metrics.totalDeliveries > 0
    ? (metrics.damagedDeliveries / metrics.totalDeliveries) * 100
    : 0;

  if (onTimeRate < 80) {
    flags.push("low_on_time_rate");
  }

  if (damageRate > 3) {
    flags.push("high_damage_rate");
  }

  if (metrics.averageCustomerRating < 3.5) {
    flags.push("low_customer_rating");
  }

  if (metrics.averageCost > metrics.benchmarkCost * 1.5) {
    flags.push("high_cost_relative_to_benchmark");
  }

  if (score < 60) {
    flags.push("critical_performance");
  } else if (score < 75) {
    flags.push("performance_review_needed");
  }

  return flags;
}

// ─── RECOMMENDED ACTIONS ────────────────────────────────────────────────

/**
 * Get recommended action based on score
 */
function getRecommendedAction(
  score: number
): "active" | "review" | "suspend" {
  if (score < AUTO_SUSPENSION_THRESHOLD) {
    return "suspend";
  }
  if (score < REVIEW_THRESHOLD) {
    return "review";
  }
  return "active";
}

// ─── HISTORY & PERSISTENCE ──────────────────────────────────────────────

/**
 * Save rating history entry
 */
export async function saveRatingHistory(
  score: PartnerScore,
  metrics: PerformanceMetrics
): Promise<void> {
  // Store in a hypothetical partner_ratings table
  // This would be expanded in a real schema
  const metadata = {
    metrics,
    riskFlags: score.riskFlags,
  };

  // In a real implementation, we'd create a dedicated PartnerRating model
  // For now, we'll log for audit
  console.log(`[Rating] Partner ${score.partnerId}: Score ${score.score} (${score.period})`);
}

/**
 * Get rating history for partner
 */
export async function getRatingHistory(
  partnerId: string,
  period: "30d" | "60d" | "90d" = "30d",
  limit: number = 30
): Promise<PartnerRatingHistoryEntry[]> {
  // This would query from a PartnerRating history table
  // For demonstration, returning empty array
  console.log(
    `[Rating] Fetching history for partner ${partnerId} (${period}, limit ${limit})`
  );
  return [];
}

/**
 * Get all partners by score
 */
export async function getRankedPartners(
  period: "30d" | "60d" | "90d" = "30d"
): Promise<PartnerScore[]> {
  const partners = await (prisma.courierPartner as any).findMany({
    select: { id: true },
  });

  const scores = await Promise.all(
    partners.map((p: any) => calculatePartnerScore(p.id, period))
  );

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Get partners that need review or suspension
 */
export async function getFlaggedPartners(
  period: "30d" | "60d" | "90d" = "30d"
): Promise<PartnerScore[]> {
  const scores = await getRankedPartners(period);
  return scores.filter(
    (s) => s.recommendedAction === "review" || s.recommendedAction === "suspend"
  );
}

// ─── SLA TRACKING ────────────────────────────────────────────────────────

/**
 * Define SLA for a partner
 */
export async function defineSLA(
  partnerId: string,
  config: Omit<SLAConfig, "partnerId">
): Promise<void> {
  // Store SLA config (would be in a PartnerSLA table)
  console.log(`[SLA] Configured SLA for partner ${partnerId}:`, config);
}

/**
 * Get SLA compliance report
 */
export async function getSLAReport(
  partnerId: string,
  period: "30d" | "60d" | "90d" = "30d"
): Promise<{
  partnerId: string;
  period: string;
  compliancePercentage: number;
  violations: SLAViolation[];
  summary: string;
}> {
  const days = parseInt(period);
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get deliveries
  const deliveries = await (prisma.courierDelivery as any).findMany({
    where: {
      partnerId,
      createdAt: { gte: since },
    },
  });

  // Check for violations
  const violations: SLAViolation[] = [];

  for (const delivery of deliveries) {
    if (delivery.deliveredAt && delivery.quote) {
      const quote = typeof delivery.quote === "string" ? JSON.parse(delivery.quote) : delivery.quote;
      const estimatedMinutes = quote.estimatedMinutes || 0;
      const estimatedTime = new Date(
        new Date(delivery.createdAt).getTime() + estimatedMinutes * 60000
      );

      if (new Date(delivery.deliveredAt) > estimatedTime) {
        violations.push({
          deliveryId: delivery.id,
          partnerId,
          violationType: "late_delivery",
          expectedTime: estimatedTime,
          actualTime: new Date(delivery.deliveredAt),
          details: `Delivered ${Math.round((new Date(delivery.deliveredAt).getTime() - estimatedTime.getTime()) / 60000)} minutes late`,
          severity: "medium",
          timestamp: new Date(),
        });
      }
    }
  }

  const compliancePercentage = deliveries.length > 0
    ? ((deliveries.length - violations.length) / deliveries.length) * 100
    : 100;

  return {
    partnerId,
    period,
    compliancePercentage: Math.round(compliancePercentage * 10) / 10,
    violations,
    summary: `${violations.length} violations out of ${deliveries.length} deliveries`,
  };
}

/**
 * Check delivery against SLA and escalate violations
 */
export async function trackSLACompliance(
  deliveryId: string,
  slaConfig?: SLAConfig
): Promise<{ compliant: boolean; violation?: SLAViolation }> {
  const delivery = await (prisma.courierDelivery as any).findUnique({
    where: { id: deliveryId },
    include: { partner: true },
  });

  if (!delivery) {
    return { compliant: true };
  }

  // Use provided SLA or get from database
  // For now, just check basic time expectations
  if (delivery.quote && delivery.deliveredAt) {
    const quote = typeof delivery.quote === "string" ? JSON.parse(delivery.quote) : delivery.quote;
    const estimatedMinutes = quote.estimatedMinutes || 0;
    const estimatedTime = new Date(
      new Date(delivery.createdAt).getTime() + estimatedMinutes * 60000
    );

    if (new Date(delivery.deliveredAt) > estimatedTime) {
      const violation: SLAViolation = {
        deliveryId,
        partnerId: delivery.partnerId,
        violationType: "late_delivery",
        expectedTime: estimatedTime,
        actualTime: new Date(delivery.deliveredAt),
        details: `Delivery exceeded estimated time`,
        severity: "medium",
        timestamp: new Date(),
      };
      return { compliant: false, violation };
    }
  }

  return { compliant: true };
}

/**
 * Escalate SLA violation to support team
 */
export async function escalateViolation(violation: SLAViolation): Promise<void> {
  console.log(`[SLA] Escalating violation for delivery ${violation.deliveryId}:`, violation);
  // Would trigger support ticket creation or notification
}
