/**
 * Courier Partner Performance Scoring Engine
 *
 * Evaluates partner performance across multiple dimensions:
 * - On-time delivery rate
 * - Damage/incident rate
 * - Customer ratings
 * - Cost efficiency
 * - Pickup speed
 * - Communication quality
 *
 * Provides tiered partner classification: Gold, Silver, Bronze, Review
 */

import type { Prisma } from "@witylogix/db";

// ─── Performance Data Types ──────────────────────────────────────

/**
 * Raw performance metrics for a courier partner.
 */
export interface PerformanceMetrics {
  /** On-time delivery percentage (0-100) */
  onTimeRate: number;

  /** Damage/incident rate as percentage (0-100, lower is better) */
  damageRate: number;

  /** Average customer rating (1-5 scale) */
  customerRating: number;

  /** Cost per delivery in USD */
  costPerDelivery: number;

  /** Average pickup speed in minutes */
  pickupSpeed: number;

  /** Communication score (0-100) */
  communicationScore: number;

  /** Total deliveries in period */
  totalDeliveries: number;

  /** Total on-time deliveries */
  onTimeDeliveries: number;

  /** Total damaged deliveries */
  damagedDeliveries: number;

  /** Total customer ratings collected */
  ratingsCount: number;

  /** Sum of all ratings */
  ratingsSum: number;

  /** Period for metrics (7d, 30d, 90d) */
  period: "7d" | "30d" | "90d";

  /** Date range */
  startDate: Date;
  endDate: Date;
}

/**
 * Performance tier for partner classification.
 */
export type PerformanceTier = "gold" | "silver" | "bronze" | "review";

/**
 * Performance score result with tier assignment.
 */
export interface PerformanceScore {
  /** Composite score (0-100) */
  score: number;

  /** Assigned tier */
  tier: PerformanceTier;

  /** Individual metric scores */
  metrics: {
    onTimeScore: number;
    damageScore: number;
    ratingScore: number;
    costScore: number;
    pickupScore: number;
    communicationScore: number;
  };

  /** Weighted scores per metric */
  weights: {
    onTime: number;
    damage: number;
    rating: number;
    cost: number;
    pickup: number;
    communication: number;
  };

  /** Confidence in score (0-1) */
  confidence: number;
}

/**
 * Performance trend comparing periods.
 */
export interface PerformanceTrend {
  /** Partner ID */
  partnerId: string;

  /** 7-day performance */
  period7d: PerformanceScore | null;

  /** 30-day performance */
  period30d: PerformanceScore | null;

  /** 90-day performance */
  period90d: PerformanceScore | null;

  /** Trend direction (up/down/stable) */
  trend: "up" | "down" | "stable";

  /** Percentage change from previous period */
  change: number;

  /** Key improvements/concerns */
  insights: string[];
}

/**
 * Peer benchmarking result.
 */
export interface BenchmarkResult {
  /** Partner ID */
  partnerId: string;

  /** Performance score */
  score: number;

  /** Percentile ranking (0-100) */
  percentile: number;

  /** Rank among peers */
  rank: number;

  /** Total peers evaluated */
  totalPeers: number;

  /** Above/below average comparison */
  comparison: {
    vsAverage: number;
    vsMedian: number;
    vsTop10: number;
  };
}

/**
 * Strengths and weaknesses analysis.
 */
export interface PerformanceAnalysis {
  /** Partner ID */
  partnerId: string;

  /** Top 3 strengths */
  strengths: Array<{
    metric: keyof PerformanceMetrics;
    value: number;
    description: string;
  }>;

  /** Top 3 weaknesses */
  weaknesses: Array<{
    metric: keyof PerformanceMetrics;
    value: number;
    description: string;
  }>;

  /** Recommendations for improvement */
  recommendations: string[];

  /** Risk level (low/medium/high) */
  riskLevel: "low" | "medium" | "high";
}

/**
 * Comprehensive performance report.
 */
export interface PerformanceReport {
  /** Partner ID */
  partnerId: string;

  /** Partner name */
  partnerName: string;

  /** Current score and tier */
  current: PerformanceScore;

  /** Trend analysis */
  trend: PerformanceTrend;

  /** Benchmarking */
  benchmark: BenchmarkResult;

  /** Analysis */
  analysis: PerformanceAnalysis;

  /** Report generated timestamp */
  generatedAt: Date;

  /** Period covered */
  period: "7d" | "30d" | "90d";
}

// ─── Configurable Weights ──────────────────────────────────────

/**
 * Default performance score weights.
 * Can be customized per tenant/organization.
 */
export const DEFAULT_PERFORMANCE_WEIGHTS = {
  onTime: 0.25,
  damage: 0.2,
  rating: 0.2,
  cost: 0.15,
  pickup: 0.1,
  communication: 0.1,
};

/**
 * Tier thresholds.
 */
export const TIER_THRESHOLDS = {
  gold: 90,
  silver: 75,
  bronze: 60,
  review: 0,
};

// ─── Partner Performance Service ────────────────────────────────

/**
 * Partner performance scoring engine.
 * Calculates composite scores and generates reports.
 */
export class PartnerPerformance {
  private weights = { ...DEFAULT_PERFORMANCE_WEIGHTS };

  constructor(customWeights?: Partial<typeof DEFAULT_PERFORMANCE_WEIGHTS>) {
    if (customWeights) {
      this.weights = { ...this.weights, ...customWeights };
    }
  }

  /**
   * Set custom weights for scoring.
   *
   * @param weights Custom weight distribution
   * @throws Error if weights don't sum to 1.0
   */
  setWeights(weights: Partial<typeof DEFAULT_PERFORMANCE_WEIGHTS>): void {
    const updated = { ...this.weights, ...weights };
    const sum = Object.values(updated).reduce((a, b) => a + b, 0);

    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Weights must sum to 1.0, got ${sum}`);
    }

    this.weights = updated;
  }

  /**
   * Calculate composite performance score from metrics.
   *
   * @param metrics Raw performance metrics
   * @returns Performance score with tier assignment
   */
  calculatePerformanceScore(metrics: PerformanceMetrics): PerformanceScore {
    // Normalize individual metrics to 0-100 scale
    const onTimeScore = Math.min(metrics.onTimeRate, 100);
    const damageScore = Math.max(0, 100 - metrics.damageRate);
    const ratingScore = (metrics.customerRating / 5) * 100;
    const costScore = this.calculateCostScore(metrics.costPerDelivery);
    const pickupScore = this.calculatePickupScore(metrics.pickupSpeed);
    const communicationScore = Math.min(metrics.communicationScore, 100);

    // Calculate composite score
    const score =
      onTimeScore * this.weights.onTime +
      damageScore * this.weights.damage +
      ratingScore * this.weights.rating +
      costScore * this.weights.cost +
      pickupScore * this.weights.pickup +
      communicationScore * this.weights.communication;

    // Calculate confidence based on sample size
    const confidence = Math.min(1.0, metrics.totalDeliveries / 100);

    // Assign tier
    let tier: PerformanceTier = "review";
    if (score >= TIER_THRESHOLDS.gold) tier = "gold";
    else if (score >= TIER_THRESHOLDS.silver) tier = "silver";
    else if (score >= TIER_THRESHOLDS.bronze) tier = "bronze";

    return {
      score: Math.round(score * 10) / 10,
      tier,
      metrics: {
        onTimeScore: Math.round(onTimeScore * 10) / 10,
        damageScore: Math.round(damageScore * 10) / 10,
        ratingScore: Math.round(ratingScore * 10) / 10,
        costScore: Math.round(costScore * 10) / 10,
        pickupScore: Math.round(pickupScore * 10) / 10,
        communicationScore: Math.round(communicationScore * 10) / 10,
      },
      weights: this.weights,
      confidence,
    };
  }

  /**
   * Get performance trend across multiple periods.
   *
   * @param metrics7d 7-day metrics
   * @param metrics30d 30-day metrics
   * @param metrics90d 90-day metrics
   * @returns Trend analysis
   */
  getPerformanceTrend(
    metrics7d?: PerformanceMetrics,
    metrics30d?: PerformanceMetrics,
    metrics90d?: PerformanceMetrics,
  ): PerformanceTrend {
    const score7d = metrics7d
      ? this.calculatePerformanceScore(metrics7d)
      : null;
    const score30d = metrics30d
      ? this.calculatePerformanceScore(metrics30d)
      : null;
    const score90d = metrics90d
      ? this.calculatePerformanceScore(metrics90d)
      : null;

    // Determine trend direction
    let trend: "up" | "down" | "stable" = "stable";
    let change = 0;

    if (score7d && score30d) {
      change = score7d.score - score30d.score;
      if (change > 2) trend = "up";
      else if (change < -2) trend = "down";
    } else if (score30d && score90d) {
      change = score30d.score - score90d.score;
      if (change > 2) trend = "up";
      else if (change < -2) trend = "down";
    }

    // Generate insights
    const insights: string[] = [];
    if (trend === "up") insights.push("Performance is improving");
    else if (trend === "down") insights.push("Performance is declining");
    else insights.push("Performance is stable");

    if (metrics7d && metrics7d.onTimeRate < 85) {
      insights.push("On-time delivery rate below target (85%)");
    }
    if (metrics7d && metrics7d.damageRate > 2) {
      insights.push("Damage rate elevated above 2%");
    }
    if (metrics7d && metrics7d.customerRating < 4) {
      insights.push("Customer satisfaction below 4.0 stars");
    }

    return {
      partnerId:
        metrics7d?.period ||
        metrics30d?.period ||
        metrics90d?.period ||
        "unknown",
      period7d: score7d,
      period30d: score30d,
      period90d: score90d,
      trend,
      change: Math.round(change * 10) / 10,
      insights,
    };
  }

  /**
   * Benchmark partner against peers.
   *
   * @param score Partner's performance score
   * @param allScores Array of all partner scores
   * @returns Benchmarking result
   */
  benchmarkAgainstPeers(
    score: PerformanceScore,
    allScores: PerformanceScore[],
  ): BenchmarkResult {
    const sortedScores = [...allScores].sort((a, b) => b.score - a.score);
    const rank = sortedScores.findIndex((s) => s.score === score.score) + 1;
    const percentile = Math.round(
      ((sortedScores.length - rank) / sortedScores.length) * 100,
    );

    const avgScore =
      sortedScores.reduce((sum, s) => sum + s.score, 0) / sortedScores.length;
    const medianScore =
      sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1].score +
            sortedScores[sortedScores.length / 2].score) /
          2
        : sortedScores[Math.floor(sortedScores.length / 2)].score;
    const top10Score =
      sortedScores
        .slice(0, Math.ceil(sortedScores.length * 0.1))
        .reduce((sum, s) => sum + s.score, 0) /
      Math.ceil(sortedScores.length * 0.1);

    return {
      partnerId: "unknown",
      score: score.score,
      percentile,
      rank,
      totalPeers: sortedScores.length,
      comparison: {
        vsAverage: Math.round((score.score - avgScore) * 10) / 10,
        vsMedian: Math.round((score.score - medianScore) * 10) / 10,
        vsTop10: Math.round((score.score - top10Score) * 10) / 10,
      },
    };
  }

  /**
   * Identify strengths and weaknesses.
   *
   * @param metrics Performance metrics
   * @returns Analysis of strengths and weaknesses
   */
  identifyStrengthsAndWeaknesses(
    metrics: PerformanceMetrics,
  ): PerformanceAnalysis {
    const scores = {
      onTime: metrics.onTimeRate,
      damage: 100 - metrics.damageRate,
      rating: (metrics.customerRating / 5) * 100,
      cost: this.calculateCostScore(metrics.costPerDelivery),
      pickup: this.calculatePickupScore(metrics.pickupSpeed),
      communication: metrics.communicationScore,
    };

    const entries = Object.entries(scores).map(([metric, value]) => ({
      metric: metric as keyof typeof scores,
      value,
    }));

    const sorted = [...entries].sort((a, b) => b.value - a.value);

    // Identify risk level
    let riskLevel: "low" | "medium" | "high" = "low";
    if (metrics.onTimeRate < 75 || metrics.damageRate > 3) riskLevel = "high";
    else if (metrics.onTimeRate < 85 || metrics.damageRate > 1.5)
      riskLevel = "medium";

    // Generate recommendations
    const recommendations: string[] = [];
    if (metrics.onTimeRate < 85) {
      recommendations.push(
        "Implement pickup schedule optimization to improve on-time delivery",
      );
    }
    if (metrics.damageRate > 1) {
      recommendations.push(
        "Review packaging standards and driver training protocols",
      );
    }
    if (metrics.customerRating < 4.2) {
      recommendations.push(
        "Enhance communication with customers and resolve complaints promptly",
      );
    }
    if (metrics.pickupSpeed > 30) {
      recommendations.push(
        "Increase local pickup capacity or reduce service areas",
      );
    }

    return {
      partnerId: "unknown",
      strengths: sorted.slice(0, 3).map(({ metric, value }) => ({
        metric: metric as keyof PerformanceMetrics,
        value: Math.round(value * 10) / 10,
        description: this.getMetricDescription(metric, value, true),
      })),
      weaknesses: sorted
        .slice(-3)
        .reverse()
        .map(({ metric, value }) => ({
          metric: metric as keyof PerformanceMetrics,
          value: Math.round(value * 10) / 10,
          description: this.getMetricDescription(metric, value, false),
        })),
      recommendations,
      riskLevel,
    };
  }

  /**
   * Generate comprehensive performance report.
   *
   * @param partnerId Partner ID
   * @param partnerName Partner name
   * @param metrics7d 7-day metrics
   * @param metrics30d 30-day metrics
   * @param metrics90d 90-day metrics
   * @param allScores All partner scores for benchmarking
   * @returns Comprehensive report
   */
  generatePerformanceReport(
    partnerId: string,
    partnerName: string,
    metrics7d: PerformanceMetrics,
    metrics30d?: PerformanceMetrics,
    metrics90d?: PerformanceMetrics,
    allScores: PerformanceScore[] = [],
  ): PerformanceReport {
    const current = this.calculatePerformanceScore(metrics7d);
    const trend = this.getPerformanceTrend(metrics7d, metrics30d, metrics90d);
    const benchmark = this.benchmarkAgainstPeers(
      current,
      allScores.length > 0 ? allScores : [current],
    );
    const analysis = this.identifyStrengthsAndWeaknesses(metrics7d);

    // Update IDs in nested objects
    benchmark.partnerId = partnerId;
    analysis.partnerId = partnerId;

    return {
      partnerId,
      partnerName,
      current,
      trend,
      benchmark,
      analysis,
      generatedAt: new Date(),
      period: "7d",
    };
  }

  /**
   * Calculate cost score (lower cost = higher score).
   * Benchmarked against industry average of $2.50 per delivery.
   *
   * @param costPerDelivery Cost in USD
   * @returns Score 0-100
   */
  private calculateCostScore(costPerDelivery: number): number {
    const benchmark = 2.5;
    if (costPerDelivery <= benchmark) {
      return Math.min(100, (benchmark / costPerDelivery) * 100);
    }
    return Math.max(0, 100 - (costPerDelivery - benchmark) * 10);
  }

  /**
   * Calculate pickup speed score (lower time = higher score).
   * Benchmarked against target of 15 minutes.
   *
   * @param pickupSpeedMinutes Pickup speed in minutes
   * @returns Score 0-100
   */
  private calculatePickupScore(pickupSpeedMinutes: number): number {
    const target = 15;
    if (pickupSpeedMinutes <= target) {
      return Math.min(100, (target / pickupSpeedMinutes) * 100);
    }
    return Math.max(0, 100 - (pickupSpeedMinutes - target) * 2);
  }

  /**
   * Get human-readable metric description.
   *
   * @param metric Metric name
   * @param value Score value
   * @param isStrength True if strength, false if weakness
   * @returns Description
   */
  private getMetricDescription(
    metric: string,
    value: number,
    isStrength: boolean,
  ): string {
    const descriptions: Record<string, { strength: string; weakness: string }> =
      {
        onTime: {
          strength: "Consistently delivers on time",
          weakness: "Frequent delays in delivery",
        },
        damage: {
          strength: "Excellent package handling",
          weakness: "High damage/incident rates",
        },
        rating: {
          strength: "Outstanding customer satisfaction",
          weakness: "Low customer satisfaction scores",
        },
        cost: {
          strength: "Competitive pricing",
          weakness: "Above-market pricing",
        },
        pickup: {
          strength: "Rapid pickup times",
          weakness: "Slow pickup response",
        },
        communication: {
          strength: "Excellent customer communication",
          weakness: "Poor communication with customers",
        },
      };

    const desc = descriptions[metric];
    return desc
      ? isStrength
        ? desc.strength
        : desc.weakness
      : `${metric} score: ${value.toFixed(1)}`;
  }
}

/**
 * Singleton instance of partner performance engine.
 */
export const partnerPerformance = new PartnerPerformance();
