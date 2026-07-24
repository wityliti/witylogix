/**
 * Driver Scoring Engine
 * Pure functions for calculating individual component scores and composite ratings
 */

import {
  DriverMetrics,
  DriverScore,
  ScoreBreakdown,
  ScoringWeights,
} from "./types";

/**
 * Default scoring weights
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
  onTime: 0.3,
  customerRating: 0.25,
  podCompliance: 0.15,
  routeEfficiency: 0.15,
  reliability: 0.15,
};

/**
 * Calculate on-time delivery score
 * 100 if >= 95% on-time, scales down linearly below that
 */
export function calculateOnTimeScore(
  onTimeCount: number,
  totalDeliveries: number,
): number {
  if (totalDeliveries === 0) return 0;

  const onTimePercentage = (onTimeCount / totalDeliveries) * 100;

  if (onTimePercentage >= 95) {
    return 100;
  }

  // Scale linearly from 0 to 100 as percentage goes from 0 to 95
  return (onTimePercentage / 95) * 100;
}

/**
 * Calculate customer rating score
 * Normalize 1-5 star rating to 0-100 scale
 */
export function calculateCustomerRatingScore(
  ratingSum: number,
  ratingCount: number,
): number {
  if (ratingCount === 0) return 0;

  const avgRating = ratingSum / ratingCount;

  // Convert 1-5 scale to 0-100 scale: (rating - 1) / 4 * 100
  return ((avgRating - 1) / 4) * 100;
}

/**
 * Calculate POD compliance score
 * Percentage of deliveries with proper proof-of-delivery
 */
export function calculatePodComplianceScore(
  podCompliantCount: number,
  totalDeliveries: number,
): number {
  if (totalDeliveries === 0) return 0;

  const compliancePercentage = (podCompliantCount / totalDeliveries) * 100;
  return compliancePercentage;
}

/**
 * Calculate route efficiency score
 * Based on ratio of actual to optimal distance (lower is better)
 * Efficiency ratio: optimal / actual (where < 1 = efficient, > 1 = inefficient)
 */
export function calculateRouteEfficiencyScore(
  efficiencyRatioSum: number,
  deliveryCount: number,
): number {
  if (deliveryCount === 0) return 0;

  const avgEfficiencyRatio = efficiencyRatioSum / deliveryCount;

  // Convert ratio to score: target is 1.0, penalize higher ratios
  // Score = 100 if ratio <= 1.0, decreases as ratio increases
  // At ratio 1.5, score = 33.3
  if (avgEfficiencyRatio <= 1.0) {
    return 100;
  }

  return Math.max(0, 100 / avgEfficiencyRatio);
}

/**
 * Calculate reliability score
 * Based on total deliveries and incidents
 * Higher incident rate penalizes score
 */
export function calculateReliabilityScore(
  totalDeliveries: number,
  incidentCount: number,
): number {
  if (totalDeliveries === 0) return 0;

  const incidentRate = incidentCount / totalDeliveries;

  // Start with 100, deduct 10 points per incident rate of 5%
  // At 0 incidents: 100
  // At 1 incident per 10 deliveries (10%): 80
  // At 1 incident per 5 deliveries (20%): 60
  const penaltyPerUnit = 10; // -10 points per 5% incident rate
  const baselineIncidentRate = 0.05; // 5% baseline

  const penalty = Math.max(
    0,
    ((incidentRate - baselineIncidentRate) / baselineIncidentRate) *
      penaltyPerUnit,
  );

  return Math.max(0, 100 - penalty);
}

/**
 * Determine driver tier based on composite score
 */
export function determineTier(
  score: number,
): "platinum" | "gold" | "silver" | "bronze" {
  if (score >= 90) return "platinum";
  if (score >= 75) return "gold";
  if (score >= 60) return "silver";
  return "bronze";
}

/**
 * Determine score trend
 * Up: +3 or more points
 * Down: -3 or more points
 * Stable: -3 to +3
 */
export function determineTrend(
  currentScore: number,
  previousScore: number | null,
): "up" | "down" | "stable" {
  if (previousScore === null) return "stable";

  const delta = currentScore - previousScore;

  if (delta >= 3) return "up";
  if (delta <= -3) return "down";
  return "stable";
}

/**
 * Calculate individual component scores
 */
function calculateComponentScores(metrics: DriverMetrics): ScoreBreakdown {
  return {
    onTimeScore: calculateOnTimeScore(
      metrics.onTimeCount,
      metrics.totalDeliveries,
    ),
    customerRatingScore: calculateCustomerRatingScore(
      metrics.customerRatingSum,
      metrics.customerRatingCount,
    ),
    podComplianceScore: calculatePodComplianceScore(
      metrics.podComplianceCount,
      metrics.totalDeliveries,
    ),
    routeEfficiencyScore: calculateRouteEfficiencyScore(
      metrics.routeEfficiencySum,
      metrics.totalDeliveries,
    ),
    reliabilityScore: calculateReliabilityScore(
      metrics.totalDeliveries,
      metrics.incidentCount,
    ),
  };
}

/**
 * Calculate composite driver score
 * Weighted average of all component scores (0-100)
 */
export function calculateDriverScore(
  metrics: DriverMetrics,
  weights?: Partial<ScoringWeights>,
): DriverScore {
  const finalWeights = { ...DEFAULT_WEIGHTS, ...weights };

  // Validate weights sum to 1.0 (with tolerance for floating point)
  const weightSum = Object.values(finalWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1.0) > 0.001) {
    console.warn(`Scoring weights do not sum to 1.0: ${weightSum}`);
  }

  const breakdown = calculateComponentScores(metrics);

  // Calculate weighted composite score
  const compositeScore =
    breakdown.onTimeScore * finalWeights.onTime +
    breakdown.customerRatingScore * finalWeights.customerRating +
    breakdown.podComplianceScore * finalWeights.podCompliance +
    breakdown.routeEfficiencyScore * finalWeights.routeEfficiency +
    breakdown.reliabilityScore * finalWeights.reliability;

  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, compositeScore));

  return {
    driverId: metrics.driverId,
    tenantId: metrics.tenantId,
    compositeScore: Math.round(clampedScore * 10) / 10, // Round to 1 decimal
    breakdown: {
      onTimeScore: Math.round(breakdown.onTimeScore * 10) / 10,
      customerRatingScore: Math.round(breakdown.customerRatingScore * 10) / 10,
      podComplianceScore: Math.round(breakdown.podComplianceScore * 10) / 10,
      routeEfficiencyScore:
        Math.round(breakdown.routeEfficiencyScore * 10) / 10,
      reliabilityScore: Math.round(breakdown.reliabilityScore * 10) / 10,
    },
    tier: determineTier(clampedScore),
    rank: 0, // Will be set by leaderboard aggregator
    trend: "stable", // Will be set by aggregator if previous score available
    previousScore: null,
    calculatedAt: new Date(),
  };
}

/**
 * Update score with trend and previous score information
 */
export function updateScoreWithTrend(
  score: DriverScore,
  previousScore: number | null,
): DriverScore {
  return {
    ...score,
    previousScore,
    trend: determineTrend(score.compositeScore, previousScore),
  };
}
