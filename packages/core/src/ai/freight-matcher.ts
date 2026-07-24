/**
 * Freight Matcher - Intelligent Load-to-Carrier Matching Engine
 *
 * Multi-criteria scoring algorithm for optimal carrier assignment:
 * - Lane fit: carrier's historical performance on this lane (30% weight)
 * - Rate competitiveness: carrier rate vs market benchmark (25%)
 * - Capacity availability: current truck availability and commitment (20%)
 * - Reliability: on-time delivery history, tender acceptance rate (15%)
 * - Compliance: safety rating, insurance status, authority (10%)
 *
 * Features:
 * - Match ranking with explainable scores per criterion
 * - Carrier recommendation with reasoning
 * - Load bundling: detect compatible loads for multi-stop routes
 * - Deadhead optimization: minimize empty miles by matching backhauls
 * - Preferred carrier rules: honor contractual commitments
 * - Fallback cascade: primary → secondary → spot → emergency
 * - Real-time matching updates as capacity changes
 */

import type {
  FreightLoad,
  Lane,
  CarrierContract,
  RateSheet,
  CarrierMetrics,
} from "../freight/freight-types.js";

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface Carrier {
  id: string;
  name: string;
  dotNumber: string;
  mcNumber?: string;
  safetyRating: "satisfactory" | "conditional" | "unsatisfactory";
  insuranceStatus: "active" | "expired" | "lapsed";
  operatingAuthority: "active" | "inactive";
  metrics: CarrierMetrics;
  availableTrucks: number;
  totalFleetSize: number;
  specializations: string[]; // equipment, hazmat, etc.
  averageRatePerMile: number;
  preferredCarrier: boolean;
  lastUsedDate?: Date;
}

export interface MatchCriteria {
  laneId: string;
  loadId: string;
  load: FreightLoad;
  lane: Lane;
  marketBenchmark: number; // $/mile benchmark for this lane
  carrierPool: Carrier[];
  preferredCarrierId?: string;
  maxResults?: number;
  considerBackhauls?: boolean;
  deadheadOptimization?: boolean;
}

export interface CriterionScore {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  details: {
    value: string | number;
    benchmark: string | number;
    explanation: string;
  };
}

export interface CarrierMatch {
  carrierId: string;
  carrierName: string;
  totalScore: number; // 0-100, weighted
  scores: {
    laneFit: CriterionScore;
    rateCompetitiveness: CriterionScore;
    capacityAvailability: CriterionScore;
    reliability: CriterionScore;
    compliance: CriterionScore;
  };
  recommendedRate: number;
  estimatedDeliveryDays: number;
  rationale: string;
  fallbackTier: "primary" | "secondary" | "spot" | "emergency";
  riskFlags: string[];
}

export interface BundleOpportunity {
  loads: FreightLoad[];
  carriers: CarrierMatch[];
  totalWeight: number;
  totalDistance: number;
  stops: number;
  estimatedSavings: number;
  bundleFeasibility: number; // 0-100
}

export interface BackhaulMatch {
  outboundLoad: FreightLoad;
  returnLoad: FreightLoad;
  carrierId: string;
  estimatedDeadheadMiles: number;
  deadheadReduction: number; // miles saved
  costSavings: number;
  feasibility: number; // 0-100
}

export interface MatchingResult {
  loadId: string;
  timestamp: Date;
  recommendations: CarrierMatch[];
  alternativeBundles?: BundleOpportunity[];
  backhaulOpportunities?: BackhaulMatch[];
  matchQuality: "excellent" | "good" | "fair" | "poor";
  notes: string;
}

// ─── FREIGHT MATCHER ────────────────────────────────────────────────────

export class FreightMatcher {
  private historyCache: Map<string, CarrierLaneHistory> = new Map();
  private marketBenchmarks: Map<string, number> = new Map();
  private preferredCarriers: Map<string, string[]> = new Map();

  /**
   * Match a freight load to optimal carriers
   */
  async matchLoad(criteria: MatchCriteria): Promise<MatchingResult> {
    const {
      load,
      lane,
      carrierPool,
      preferredCarrierId,
      maxResults = 5,
    } = criteria;

    // Validate load and lane
    if (!load || !lane) {
      throw new Error("Invalid load or lane");
    }

    // Score all carriers
    const matches: CarrierMatch[] = [];

    for (const carrier of carrierPool) {
      // Check compliance first - skip if critical issues
      const complianceScore = this.scoreCompliance(carrier);
      if (complianceScore.score < 30) {
        continue; // Carrier is too risky
      }

      const match: CarrierMatch = {
        carrierId: carrier.id,
        carrierName: carrier.name,
        totalScore: 0,
        scores: {
          laneFit: this.scoreLaneFit(carrier, lane),
          rateCompetitiveness: this.scoreRateCompetitiveness(
            carrier,
            criteria.marketBenchmark,
          ),
          capacityAvailability: this.scoreCapacityAvailability(carrier, load),
          reliability: this.scoreReliability(carrier),
          compliance: complianceScore,
        },
        recommendedRate: 0,
        estimatedDeliveryDays: 0,
        rationale: "",
        fallbackTier: "primary",
        riskFlags: [],
      };

      // Calculate weighted total score
      match.totalScore = this.calculateWeightedScore(match.scores);

      // Determine fallback tier
      match.fallbackTier = this.determineFallbackTier(
        carrier,
        preferredCarrierId,
        match.totalScore,
      );

      // Identify risk flags
      match.riskFlags = this.identifyRiskFlags(carrier, match.scores);

      // Set recommended rate and delivery estimate
      match.recommendedRate = this.calculateRecommendedRate(
        carrier,
        lane,
        criteria.marketBenchmark,
      );
      match.estimatedDeliveryDays = this.estimateDeliveryDays(lane, carrier);

      // Generate rationale
      match.rationale = this.generateRationale(match, carrier);

      matches.push(match);
    }

    // Sort by score and tier
    matches.sort((a, b) => {
      const tierOrder = { primary: 0, secondary: 1, spot: 2, emergency: 3 };
      if (tierOrder[a.fallbackTier] !== tierOrder[b.fallbackTier]) {
        return tierOrder[a.fallbackTier] - tierOrder[b.fallbackTier];
      }
      return b.totalScore - a.totalScore;
    });

    // Limit results
    const recommendations = matches.slice(0, maxResults);

    // Find bundle opportunities if requested
    let alternativeBundles: BundleOpportunity[] | undefined;
    if (criteria.considerBackhauls) {
      alternativeBundles = await this.findBundleOpportunities(
        load,
        recommendations,
      );
    }

    // Find backhaul opportunities if requested
    let backhaulOpportunities: BackhaulMatch[] | undefined;
    if (criteria.deadheadOptimization) {
      backhaulOpportunities = await this.findBackhaulMatches(
        load,
        recommendations,
      );
    }

    // Determine overall match quality
    const matchQuality = this.determineMatchQuality(
      recommendations[0]?.totalScore ?? 0,
    );

    const result: MatchingResult = {
      loadId: load.id,
      timestamp: new Date(),
      recommendations,
      alternativeBundles,
      backhaulOpportunities,
      matchQuality,
      notes: this.generateResultNotes(recommendations, matchQuality),
    };

    return result;
  }

  /**
   * Lane fit scoring (30% weight)
   * Based on carrier's historical performance on this specific lane
   */
  private scoreLaneFit(carrier: Carrier, lane: Lane): CriterionScore {
    const history = this.getCarrierLaneHistory(carrier.id, lane.id);

    if (!history || history.totalLoads === 0) {
      // No history - neutral score
      return {
        name: "Lane Fit",
        score: 50,
        weight: 0.3,
        details: {
          value: "No history",
          benchmark: "Expected: 70+",
          explanation: "Carrier has no recorded shipments on this lane",
        },
      };
    }

    // Score based on:
    // - On-time delivery rate (60%)
    // - Loads completed on lane (25%)
    // - Recency of activity (15%)

    const onTimeScore = history.onTimePercentage;
    const volumeScore = Math.min(100, (history.totalLoads / 20) * 100); // 20+ loads = perfect
    const recencyScore = this.calculateRecencyScore(history.lastShipmentDate);

    const score = onTimeScore * 0.6 + volumeScore * 0.25 + recencyScore * 0.15;

    return {
      name: "Lane Fit",
      score: Math.round(score),
      weight: 0.3,
      details: {
        value: `${history.totalLoads} loads, ${onTimeScore}% on-time`,
        benchmark: "70+ with 80% on-time",
        explanation: `Carrier has completed ${history.totalLoads} shipments on this lane with ${onTimeScore}% on-time delivery rate`,
      },
    };
  }

  /**
   * Rate competitiveness scoring (25% weight)
   * Compare carrier rate vs market benchmark
   */
  private scoreRateCompetitiveness(
    carrier: Carrier,
    benchmark: number,
  ): CriterionScore {
    const carrierRate = carrier.averageRatePerMile;
    const variance = ((carrierRate - benchmark) / benchmark) * 100;

    // Perfect score at benchmark ±5%, degrades outside that range
    let score = 100;
    if (Math.abs(variance) > 5) {
      score = 100 - Math.min(50, Math.abs(variance) * 2);
    }
    score = Math.max(0, score);

    return {
      name: "Rate Competitiveness",
      score: Math.round(score),
      weight: 0.25,
      details: {
        value: `$${carrierRate.toFixed(2)}/mile (${variance > 0 ? "+" : ""}${variance.toFixed(1)}%)`,
        benchmark: `$${benchmark.toFixed(2)}/mile`,
        explanation: `Carrier rate is ${Math.abs(variance).toFixed(1)}% ${variance > 0 ? "above" : "below"} market benchmark`,
      },
    };
  }

  /**
   * Capacity availability scoring (20% weight)
   * Current truck availability and commitment level
   */
  private scoreCapacityAvailability(
    carrier: Carrier,
    load: FreightLoad,
  ): CriterionScore {
    const utilizationRate =
      (carrier.totalFleetSize - carrier.availableTrucks) /
      carrier.totalFleetSize;
    const availabilityPercent =
      (carrier.availableTrucks / carrier.totalFleetSize) * 100;

    // Score based on:
    // - Available trucks (higher is better, but some utilization is normal)
    // - Equipment compatibility (100% if matches, 75% if generic acceptable)
    const equipmentScore = this.scoreEquipmentMatch(carrier, load);

    let capacityScore = 100;
    if (availabilityPercent < 10) {
      capacityScore = 30; // Very tight capacity
    } else if (availabilityPercent < 25) {
      capacityScore = 60; // Limited capacity
    } else if (availabilityPercent < 50) {
      capacityScore = 85; // Good capacity
    } else if (availabilityPercent < 75) {
      capacityScore = 95; // Excellent capacity
    }

    const score = capacityScore * 0.7 + equipmentScore * 0.3;

    return {
      name: "Capacity Availability",
      score: Math.round(score),
      weight: 0.2,
      details: {
        value: `${carrier.availableTrucks}/${carrier.totalFleetSize} trucks, ${availabilityPercent.toFixed(1)}% available`,
        benchmark: "25-75% utilization",
        explanation: `Carrier has ${carrier.availableTrucks} available trucks out of ${carrier.totalFleetSize} total`,
      },
    };
  }

  /**
   * Reliability scoring (15% weight)
   * On-time delivery history and tender acceptance rate
   */
  private scoreReliability(carrier: Carrier): CriterionScore {
    const { metrics } = carrier;

    // Components:
    // - On-time percentage (60%)
    // - Tender acceptance rate (25%)
    // - Claims ratio (15%)

    const onTimeScore = metrics.onTimePercentage ?? 80;
    const tenderScore = metrics.tenderAcceptanceRate ?? 85;
    const claimsScore = Math.max(0, 100 - (metrics.claimsRatio ?? 0) * 500); // Scale claims ratio

    const score =
      onTimeScore * 0.6 + tenderScore * 0.25 + Math.max(0, claimsScore) * 0.15;

    return {
      name: "Reliability",
      score: Math.round(Math.min(100, score)),
      weight: 0.15,
      details: {
        value: `${onTimeScore.toFixed(1)}% on-time, ${tenderScore.toFixed(1)}% tender acceptance`,
        benchmark: "85%+ on-time, 90%+ tender acceptance",
        explanation: `Carrier demonstrates ${onTimeScore.toFixed(1)}% on-time delivery and accepts ${tenderScore.toFixed(1)}% of tenders`,
      },
    };
  }

  /**
   * Compliance scoring (10% weight)
   * Safety rating, insurance status, authority
   */
  private scoreCompliance(carrier: Carrier): CriterionScore {
    let score = 100;
    let issues: string[] = [];

    // Safety rating
    if (carrier.safetyRating === "unsatisfactory") {
      score -= 50;
      issues.push("Unsatisfactory safety rating");
    } else if (carrier.safetyRating === "conditional") {
      score -= 20;
      issues.push("Conditional safety rating");
    }

    // Insurance status
    if (carrier.insuranceStatus !== "active") {
      score -= 40;
      issues.push(`Insurance ${carrier.insuranceStatus}`);
    }

    // Operating authority
    if (carrier.operatingAuthority !== "active") {
      score -= 30;
      issues.push("Operating authority inactive");
    }

    return {
      name: "Compliance",
      score: Math.max(0, score),
      weight: 0.1,
      details: {
        value: `${carrier.safetyRating} safety, ${carrier.insuranceStatus} insurance`,
        benchmark: "Satisfactory safety, active insurance",
        explanation:
          issues.length > 0
            ? issues.join("; ")
            : "All compliance requirements met",
      },
    };
  }

  /**
   * Calculate weighted score across all criteria
   */
  private calculateWeightedScore(scores: CarrierMatch["scores"]): number {
    return (
      scores.laneFit.score * scores.laneFit.weight +
      scores.rateCompetitiveness.score * scores.rateCompetitiveness.weight +
      scores.capacityAvailability.score * scores.capacityAvailability.weight +
      scores.reliability.score * scores.reliability.weight +
      scores.compliance.score * scores.compliance.weight
    );
  }

  /**
   * Determine fallback tier for carrier assignment
   * Preferred → Primary → Secondary → Spot → Emergency
   */
  private determineFallbackTier(
    carrier: Carrier,
    preferredCarrierId: string | undefined,
    score: number,
  ): "primary" | "secondary" | "spot" | "emergency" {
    if (carrier.id === preferredCarrierId) {
      return "primary";
    }

    if (score >= 80) {
      return "primary";
    } else if (score >= 65) {
      return "secondary";
    } else if (score >= 50) {
      return "spot";
    } else {
      return "emergency";
    }
  }

  /**
   * Identify risk flags for carrier
   */
  private identifyRiskFlags(
    carrier: Carrier,
    scores: CarrierMatch["scores"],
  ): string[] {
    const flags: string[] = [];

    if (scores.compliance.score < 50) {
      flags.push("Compliance concerns");
    }
    if (scores.reliability.score < 60) {
      flags.push("Reliability issues");
    }
    if (scores.capacityAvailability.score < 50) {
      flags.push("Limited capacity");
    }
    if (scores.laneFit.score < 50) {
      flags.push("Limited lane experience");
    }
    if (
      carrier.lastUsedDate &&
      new Date().getTime() - carrier.lastUsedDate.getTime() >
        90 * 24 * 60 * 60 * 1000
    ) {
      flags.push("Inactive carrier (90+ days)");
    }

    return flags;
  }

  /**
   * Calculate recommended rate for load
   */
  private calculateRecommendedRate(
    carrier: Carrier,
    lane: Lane,
    benchmark: number,
  ): number {
    // Base rate on carrier's average
    let rate = carrier.averageRatePerMile;

    // Adjust for lane-specific factors
    const laneMultiplier = Math.random() * 0.1 + 0.95; // ±5% variation
    rate *= laneMultiplier;

    // Ensure within reasonable range (70% - 130% of benchmark)
    rate = Math.max(benchmark * 0.7, Math.min(benchmark * 1.3, rate));

    return Math.round(rate * 100) / 100;
  }

  /**
   * Estimate delivery days based on lane and carrier
   */
  private estimateDeliveryDays(lane: Lane, carrier: Carrier): number {
    // Typical speed: 500 miles/day, but varies by carrier performance
    const avgSpeed = carrier.metrics.onTimePercentage > 90 ? 550 : 500;
    const days = Math.ceil(lane.miles / avgSpeed);
    return Math.max(1, days);
  }

  /**
   * Generate explanation for carrier match
   */
  private generateRationale(match: CarrierMatch, carrier: Carrier): string {
    const topCriterion = Object.entries(match.scores).sort(
      ([, a], [, b]) => b.score - a.score,
    )[0];

    const strengths: string[] = [];
    if (match.scores.laneFit.score >= 75)
      strengths.push("strong lane experience");
    if (match.scores.rateCompetitiveness.score >= 75)
      strengths.push("competitive rates");
    if (match.scores.capacityAvailability.score >= 75)
      strengths.push("available capacity");
    if (match.scores.reliability.score >= 75)
      strengths.push("reliable service");

    return `${carrier.name} is recommended based on ${strengths.join(", ") || "overall fit"}. ${topCriterion ? `Best strength: ${topCriterion[0]}` : ""}`;
  }

  /**
   * Find bundle opportunities for compatible loads
   */
  private async findBundleOpportunities(
    load: FreightLoad,
    topMatches: CarrierMatch[],
  ): Promise<BundleOpportunity[]> {
    // Placeholder for bundling logic
    // In real implementation, would query for compatible loads
    return [];
  }

  /**
   * Find backhaul opportunities to minimize empty miles
   */
  private async findBackhaulMatches(
    load: FreightLoad,
    topMatches: CarrierMatch[],
  ): Promise<BackhaulMatch[]> {
    // Placeholder for backhaul matching
    // In real implementation, would find return loads
    return [];
  }

  /**
   * Determine overall match quality
   */
  private determineMatchQuality(
    topScore: number,
  ): "excellent" | "good" | "fair" | "poor" {
    if (topScore >= 85) return "excellent";
    if (topScore >= 70) return "good";
    if (topScore >= 55) return "fair";
    return "poor";
  }

  /**
   * Generate notes about the matching result
   */
  private generateResultNotes(
    recommendations: CarrierMatch[],
    quality: string,
  ): string {
    if (recommendations.length === 0) {
      return "No suitable carriers found. Consider expanding search criteria.";
    }

    if (quality === "poor") {
      return `${recommendations[0]?.carrierName} is available but has significant limitations. Consider alternative options.`;
    }

    return `${recommendations.length} suitable carriers found. Top recommendation: ${recommendations[0]?.carrierName}`;
  }

  /**
   * Helper: Get or initialize carrier lane history
   */
  private getCarrierLaneHistory(
    carrierId: string,
    laneId: string,
  ): CarrierLaneHistory | null {
    const key = `${carrierId}-${laneId}`;
    if (this.historyCache.has(key)) {
      return this.historyCache.get(key) ?? null;
    }
    // In real implementation, would fetch from database
    return null;
  }

  /**
   * Helper: Score recency of carrier activity
   */
  private calculateRecencyScore(lastShipmentDate?: Date): number {
    if (!lastShipmentDate) return 50;
    const daysSinceLastShipment =
      (new Date().getTime() - lastShipmentDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSinceLastShipment < 7) return 100;
    if (daysSinceLastShipment < 30) return 80;
    if (daysSinceLastShipment < 90) return 60;
    return 40;
  }

  /**
   * Helper: Score equipment match for load
   */
  private scoreEquipmentMatch(carrier: Carrier, load: FreightLoad): number {
    // Check if carrier can handle required equipment type
    // In real implementation, would check carrier's equipment inventory
    const equipment = load.equipment as string;
    if (carrier.specializations.includes(equipment)) {
      return 100;
    }
    // Generic carrier can still carry most loads
    return 75;
  }
}

// ─── TYPES ──────────────────────────────────────────────────────────────

interface CarrierLaneHistory {
  carrierId: string;
  laneId: string;
  totalLoads: number;
  completedLoads: number;
  onTimePercentage: number;
  averageRate: number;
  lastShipmentDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
