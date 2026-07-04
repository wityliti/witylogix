/**
 * Freight Management Engine
 * Core system for rate negotiation, carrier management, capacity planning, and scorecard tracking
 */

import {
  Lane,
  CarrierContract,
  RateSheet,
  PricingTier,
  VolumeCommitment,
  AccessorialCharge,
  ScoreCard,
  CarrierMetrics,
  WeightedScores,
  NegotiationRound,
  CarrierBid,
  CounterOffer,
  NegotiationStatus,
  CapacityForecast,
  ForecastPoint,
  ContractTerms,
  FreightLoad,
} from "./freight-types";

// ────────────────────────────────────────────────────────────────────────────
// LANE MANAGER
// ────────────────────────────────────────────────────────────────────────────

export class LaneManager {
  /**
   * Create new freight lane with initial pricing
   */
  createLane(
    tenantId: string,
    laneData: Omit<Lane, "id" | "createdAt" | "updatedAt">,
  ): Lane {
    return {
      id: this.generateId("lane"),
      ...laneData,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Add pricing tier to lane
   */
  addPricingTier(lane: Lane, tier: Omit<PricingTier, "tierId">): Lane {
    const newTier: PricingTier = {
      tierId: this.generateId("tier"),
      ...tier,
    };

    return {
      ...lane,
      pricingTiers: [...lane.pricingTiers, newTier],
      updatedAt: new Date(),
    };
  }

  /**
   * Add volume commitment to lane
   */
  addVolumeCommitment(
    lane: Lane,
    commitment: Omit<VolumeCommitment, "commitmentId">,
  ): Lane {
    const newCommitment: VolumeCommitment = {
      commitmentId: this.generateId("commitment"),
      ...commitment,
    };

    return {
      ...lane,
      volumeCommitments: [...lane.volumeCommitments, newCommitment],
      updatedAt: new Date(),
    };
  }

  /**
   * Get applicable pricing tier based on volume
   */
  getPricingTier(lane: Lane, loadsThisMonth: number): PricingTier | null {
    const now = new Date();
    const applicableTiers = lane.pricingTiers.filter(
      (tier) =>
        tier.effectiveDate <= now &&
        now <= tier.expiryDate &&
        loadsThisMonth >= tier.minLoads &&
        (!tier.maxLoads || loadsThisMonth <= tier.maxLoads),
    );

    if (applicableTiers.length === 0) return null;

    // Return the tier with the highest minimum load requirement (most specific)
    return applicableTiers.sort((a, b) => b.minLoads - a.minLoads)[0];
  }

  /**
   * Check volume commitment fulfillment
   */
  checkCommitmentFulfillment(
    lane: Lane,
    monthNumber: number,
    loadsDelivered: number,
  ): {
    commitment: VolumeCommitment;
    fulfilled: boolean;
    shortfall: number;
    penalty?: number;
  }[] {
    const now = new Date();

    return lane.volumeCommitments
      .filter((c) => c.startDate <= now && now <= c.endDate)
      .map((commitment) => {
        const fulfilled = loadsDelivered >= commitment.loadsPerMonth;
        const shortfall = Math.max(
          0,
          commitment.loadsPerMonth - loadsDelivered,
        );
        const penalty = fulfilled
          ? undefined
          : shortfall * (commitment.penalty ?? 100);

        return {
          commitment,
          fulfilled,
          shortfall,
          penalty,
        };
      });
  }

  /**
   * Update lane status
   */
  updateLaneStatus(
    lane: Lane,
    status: "active" | "inactive" | "archived",
  ): Lane {
    return {
      ...lane,
      status,
      updatedAt: new Date(),
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CARRIER SCORECARD
// ────────────────────────────────────────────────────────────────────────────

export interface ScorecardConfig {
  onTimeWeight: number;
  claimsWeight: number;
  tenderWeight: number;
  costWeight: number;
  safetyWeight: number;
}

const DEFAULT_SCORECARD_CONFIG: ScorecardConfig = {
  onTimeWeight: 0.25,
  claimsWeight: 0.25,
  tenderWeight: 0.15,
  costWeight: 0.2,
  safetyWeight: 0.15,
};

export class CarrierScorecard {
  private config: ScorecardConfig;

  constructor(config: Partial<ScorecardConfig> = {}) {
    this.config = {
      ...DEFAULT_SCORECARD_CONFIG,
      ...config,
    };
  }

  /**
   * Create scorecard from metrics
   */
  createScorecard(
    tenantId: string,
    carrierId: string,
    carrierName: string,
    metrics: CarrierMetrics,
    reviewPeriod: "monthly" | "quarterly" | "annual",
  ): ScoreCard {
    const scores = this.calculateWeightedScores(metrics);
    const overallScore = this.calculateOverallScore(scores);

    return {
      id: this.generateId("scorecard"),
      tenantId,
      carrierId,
      carrierName,
      reviewPeriod,
      period: {
        startDate: this.getPeriodStart(reviewPeriod),
        endDate: new Date(),
      },
      metrics,
      scores,
      overallScore,
      recommendations: this.generateRecommendations(metrics, overallScore),
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update scorecard metrics
   */
  updateScorecard(
    scorecard: ScoreCard,
    metrics: Partial<CarrierMetrics>,
  ): ScoreCard {
    const updatedMetrics = {
      ...scorecard.metrics,
      ...metrics,
    };

    const scores = this.calculateWeightedScores(updatedMetrics);
    const overallScore = this.calculateOverallScore(scores);

    return {
      ...scorecard,
      metrics: updatedMetrics,
      scores,
      overallScore,
      recommendations: this.generateRecommendations(
        updatedMetrics,
        overallScore,
      ),
      updatedAt: new Date(),
    };
  }

  /**
   * Calculate weighted scores from metrics
   */
  private calculateWeightedScores(metrics: CarrierMetrics): WeightedScores {
    // On-time score (0-100, higher is better)
    const onTimeScore = Math.min(100, metrics.onTimePercentage);

    // Claims score (0-100, lower claims ratio is better)
    const maxClaimsRatio = 0.05; // 5% is poor
    const claimsScore = Math.max(
      0,
      100 - (metrics.claimsRatio / maxClaimsRatio) * 100,
    );

    // Tender acceptance score (0-100, higher is better)
    const tenderScore = Math.min(100, metrics.tenderAcceptanceRate * 100);

    // Cost score (0-100, lower cost is better)
    const targetCostPerMile = 1.5;
    const costScore = Math.max(
      0,
      100 - (metrics.costPerMile / targetCostPerMile) * 100,
    );

    // Safety score (0-100, based on FMCSA rating)
    let safetyScore = 100;
    if (metrics.safetyRating === "conditional") safetyScore = 70;
    if (metrics.safetyRating === "unsatisfactory") safetyScore = 40;
    safetyScore -= metrics.inspectionDeficitPercentage;
    safetyScore -= metrics.outOfServiceRate * 10;

    return {
      onTimeScore: Math.max(0, Math.min(100, onTimeScore)),
      claimsScore: Math.max(0, Math.min(100, claimsScore)),
      tenderScore: Math.max(0, Math.min(100, tenderScore)),
      costScore: Math.max(0, Math.min(100, costScore)),
      safetyScore: Math.max(0, Math.min(100, safetyScore)),
    };
  }

  /**
   * Calculate overall score from weighted scores
   */
  private calculateOverallScore(scores: WeightedScores): number {
    return Math.round(
      scores.onTimeScore * this.config.onTimeWeight +
        scores.claimsScore * this.config.claimsWeight +
        scores.tenderScore * this.config.tenderWeight +
        scores.costScore * this.config.costWeight +
        scores.safetyScore * this.config.safetyWeight,
    );
  }

  /**
   * Generate recommendations based on scorecard
   */
  private generateRecommendations(
    metrics: CarrierMetrics,
    overallScore: number,
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.onTimePercentage < 95) {
      recommendations.push("Improve on-time delivery performance");
    }

    if (metrics.claimsRatio > 0.03) {
      recommendations.push(
        "Reduce cargo claims through better loading/securing practices",
      );
    }

    if (metrics.tenderAcceptanceRate < 0.9) {
      recommendations.push(
        "Increase tender acceptance rate to maintain lane assignments",
      );
    }

    if (metrics.costPerMile > 1.5) {
      recommendations.push("Review cost structure and operational efficiency");
    }

    if (metrics.safetyRating !== "satisfactory") {
      recommendations.push("Work with FMCSA to improve safety rating");
    }

    if (metrics.inspectionDeficitPercentage > 10) {
      recommendations.push("Reduce roadside inspection defects");
    }

    if (overallScore < 70) {
      recommendations.push(
        "Consider performance improvement plan or contract termination",
      );
    } else if (overallScore > 90) {
      recommendations.push(
        "Consider preferred carrier status and volume commitments",
      );
    }

    return recommendations;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPeriodStart(reviewPeriod: string): Date {
    const now = new Date();
    const start = new Date(now);

    switch (reviewPeriod) {
      case "monthly":
        start.setDate(1);
        break;
      case "quarterly":
        start.setMonth(Math.floor(now.getMonth() / 3) * 3);
        start.setDate(1);
        break;
      case "annual":
        start.setMonth(0);
        start.setDate(1);
        break;
    }

    return start;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// RATE NEGOTIATION TRACKER
// ────────────────────────────────────────────────────────────────────────────

export class RateNegotiationTracker {
  /**
   * Initiate rate negotiation round
   */
  initiateNegotiation(
    tenantId: string,
    laneId: string,
    carrierIds: string[],
    bidDueDays: number = 5,
  ): NegotiationRound {
    const bidDueDate = new Date();
    bidDueDate.setDate(bidDueDate.getDate() + bidDueDays);

    return {
      id: this.generateId("negotiation"),
      tenantId,
      laneId,
      roundNumber: 1,
      status: NegotiationStatus.BID_REQUESTED,
      bidDueDate,
      carriers: carrierIds.map((carrierId) => ({
        carrierId,
        carrierName: "", // would be populated from DB
        baseRate: 0,
        total: 0,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Receive bid from carrier
   */
  receiveBid(
    negotiation: NegotiationRound,
    carrierId: string,
    bid: Omit<CarrierBid, "carrierId" | "carrierName">,
  ): NegotiationRound {
    const updatedCarriers = negotiation.carriers.map((c) =>
      c.carrierId === carrierId
        ? {
            ...c,
            ...bid,
            carrierId,
          }
        : c,
    );

    const allBidsReceived = updatedCarriers.every((c) => c.baseRate > 0);

    return {
      ...negotiation,
      carriers: updatedCarriers,
      status: allBidsReceived
        ? NegotiationStatus.BIDS_RECEIVED
        : NegotiationStatus.BID_REQUESTED,
      updatedAt: new Date(),
    };
  }

  /**
   * Send counter-offer to carrier
   */
  sendCounterOffer(
    negotiation: NegotiationRound,
    carrierId: string,
    counterOffer: Omit<CounterOffer, "offerId" | "createdAt">,
  ): NegotiationRound {
    const updatedCarriers = negotiation.carriers.map((c) =>
      c.carrierId === carrierId
        ? {
            ...c,
            counterOffers: [
              ...(c.counterOffers ?? []),
              {
                ...counterOffer,
                offerId: this.generateId("offer"),
                createdAt: new Date(),
              } as CounterOffer,
            ],
          }
        : c,
    );

    return {
      ...negotiation,
      carriers: updatedCarriers,
      status: NegotiationStatus.COUNTER_OFFERED,
      updatedAt: new Date(),
    };
  }

  /**
   * Award contract to carrier
   */
  awardContract(
    negotiation: NegotiationRound,
    carrierId: string,
    rate: number,
  ): NegotiationRound {
    const awardDate = new Date();

    const updatedCarriers = negotiation.carriers.map((c) =>
      c.carrierId === carrierId
        ? { ...c, awardedAt: awardDate }
        : { ...c, rejectedAt: awardDate, rejectReason: "Not selected" },
    );

    return {
      ...negotiation,
      carriers: updatedCarriers,
      status: NegotiationStatus.AWARDED,
      selectedCarrierId: carrierId,
      selectedRate: rate,
      awardDate,
      updatedAt: new Date(),
    };
  }

  /**
   * Reject all bids and re-negotiate
   */
  rejectAllBids(negotiation: NegotiationRound): NegotiationRound {
    return {
      ...negotiation,
      roundNumber: negotiation.roundNumber + 1,
      status: NegotiationStatus.BID_REQUESTED,
      bidDueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      carriers: negotiation.carriers.map((c) => ({
        ...c,
        baseRate: 0,
        total: 0,
        counterOffers: undefined,
      })),
      updatedAt: new Date(),
    };
  }

  /**
   * Get negotiation summary
   */
  getSummary(negotiation: NegotiationRound): {
    lowestBid: CarrierBid | null;
    highestBid: CarrierBid | null;
    averageBid: number;
    totalDaysToAward: number;
  } {
    const activeBids = negotiation.carriers.filter((c) => c.baseRate > 0);

    if (activeBids.length === 0) {
      return {
        lowestBid: null,
        highestBid: null,
        averageBid: 0,
        totalDaysToAward: Math.floor(
          (new Date().getTime() - negotiation.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      };
    }

    const sorted = [...activeBids].sort((a, b) => a.baseRate - b.baseRate);

    return {
      lowestBid: sorted[0],
      highestBid: sorted[sorted.length - 1],
      averageBid:
        activeBids.reduce((sum, b) => sum + b.baseRate, 0) / activeBids.length,
      totalDaysToAward: Math.floor(
        (new Date().getTime() - negotiation.createdAt.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CAPACITY PLANNER
// ────────────────────────────────────────────────────────────────────────────

export class CapacityPlanner {
  /**
   * Generate capacity forecast
   */
  generateForecast(
    tenantId: string,
    laneId: string | null,
    historicalLoads: { date: Date; loads: number }[],
    forecastDays: number = 90,
  ): CapacityForecast {
    const forecastData = this.calculateForecasts(historicalLoads, forecastDays);
    const seasonalIndex = this.calculateSeasonalIndex(historicalLoads);
    const surgeDetected = this.detectSurges(forecastData);

    return {
      id: this.generateId("forecast"),
      tenantId,
      laneId: laneId ?? undefined,
      period: {
        startDate: new Date(),
        endDate: new Date(Date.now() + forecastDays * 24 * 60 * 60 * 1000),
      },
      forecastData,
      seasonalIndex,
      surgeDetected,
      surgeThreshold: this.calculateSurgeThreshold(forecastData),
      backupCarriers: [],
      recommendations: this.generateRecommendations(
        surgeDetected,
        seasonalIndex,
      ),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Activate backup carriers for surge periods
   */
  activateBackupCarriers(
    forecast: CapacityForecast,
    backupCarrierIds: string[],
  ): CapacityForecast {
    return {
      ...forecast,
      backupCarriers: backupCarrierIds,
      updatedAt: new Date(),
    };
  }

  /**
   * Detect surge patterns
   */
  private detectSurges(forecastData: ForecastPoint[]): boolean {
    const avgLoad =
      forecastData.reduce((sum, f) => sum + f.expectedLoads, 0) /
      forecastData.length;
    return forecastData.some((f) => f.expectedLoads > avgLoad * 1.2);
  }

  /**
   * Calculate seasonal index
   */
  private calculateSeasonalIndex(
    historicalLoads: { date: Date; loads: number }[],
  ): number {
    if (historicalLoads.length === 0) return 1.0;

    const avgLoad =
      historicalLoads.reduce((sum, h) => sum + h.loads, 0) /
      historicalLoads.length;
    const maxLoad = Math.max(...historicalLoads.map((h) => h.loads));

    return Math.round((maxLoad / avgLoad) * 100) / 100;
  }

  /**
   * Calculate surge threshold
   */
  private calculateSurgeThreshold(forecastData: ForecastPoint[]): number {
    const avgLoad =
      forecastData.reduce((sum, f) => sum + f.expectedLoads, 0) /
      forecastData.length;
    return Math.round(avgLoad * 1.2);
  }

  /**
   * Calculate forecasts using moving average
   */
  private calculateForecasts(
    historicalLoads: { date: Date; loads: number }[],
    forecastDays: number,
  ): ForecastPoint[] {
    const forecastData: ForecastPoint[] = [];

    if (historicalLoads.length === 0) {
      for (let i = 0; i < forecastDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        forecastData.push({
          date,
          expectedLoads: 10,
          confidence: 50,
          seasonalFactor: 1.0,
          surgeRisk: false,
          recommendedCarriers: [],
        });
      }
      return forecastData;
    }

    const windowSize = Math.min(7, historicalLoads.length);
    const avgLoads =
      historicalLoads.reduce((sum, h) => sum + h.loads, 0) /
      historicalLoads.length;

    for (let i = 0; i < forecastDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      const expectedLoads = Math.round(
        avgLoads * (0.9 + Math.random() * 0.2), // Add some variance
      );

      forecastData.push({
        date,
        expectedLoads,
        confidence: Math.max(50, 100 - i),
        seasonalFactor: this.getSeasonalFactor(date),
        surgeRisk: expectedLoads > avgLoads * 1.2,
        recommendedCarriers: [],
      });
    }

    return forecastData;
  }

  /**
   * Get seasonal factor for date
   */
  private getSeasonalFactor(date: Date): number {
    const month = date.getMonth();
    // Q4 typically has higher shipping volume
    if (month >= 10 || month <= 11) return 1.3;
    if (month >= 6 && month <= 8) return 1.1; // Summer holidays
    return 1.0;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    surgeDetected: boolean,
    seasonalIndex: number,
  ): string[] {
    const recommendations: string[] = [];

    if (surgeDetected) {
      recommendations.push(
        "Activate backup carriers for upcoming surge periods",
      );
      recommendations.push(
        "Consider freight forwarding for peak demand periods",
      );
    }

    if (seasonalIndex > 1.2) {
      recommendations.push(
        "Negotiate volume commitments to secure capacity during peaks",
      );
    }

    recommendations.push(
      "Review historical trends and adjust forecasts quarterly",
    );

    return recommendations;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// FREIGHT MANAGEMENT ENGINE - Main Class
// ────────────────────────────────────────────────────────────────────────────

export class FreightManagementEngine {
  private laneManager: LaneManager;
  private carriersScorecard: CarrierScorecard;
  private negotiationTracker: RateNegotiationTracker;
  private capacityPlanner: CapacityPlanner;

  constructor() {
    this.laneManager = new LaneManager();
    this.carriersScorecard = new CarrierScorecard();
    this.negotiationTracker = new RateNegotiationTracker();
    this.capacityPlanner = new CapacityPlanner();
  }

  /**
   * Get Lane Manager for lane operations
   */
  getLaneManager(): LaneManager {
    return this.laneManager;
  }

  /**
   * Get Scorecard service for performance tracking
   */
  getScorecardService(): CarrierScorecard {
    return this.carriersScorecard;
  }

  /**
   * Get Negotiation Tracker for rate bidding
   */
  getNegotiationTracker(): RateNegotiationTracker {
    return this.negotiationTracker;
  }

  /**
   * Get Capacity Planner for demand forecasting
   */
  getCapacityPlanner(): CapacityPlanner {
    return this.capacityPlanner;
  }

  /**
   * Create contract from awarded negotiation
   */
  createContractFromAward(
    tenantId: string,
    negotiation: NegotiationRound,
    rateSheet: Omit<RateSheet, "id" | "contractId">,
  ): CarrierContract {
    if (!negotiation.selectedCarrierId) {
      throw new Error("No carrier selected in negotiation");
    }

    const contractId = this.generateId("contract");
    const selectedCarrier = negotiation.carriers.find(
      (c) => c.carrierId === negotiation.selectedCarrierId,
    );

    if (!selectedCarrier) {
      throw new Error("Selected carrier not found");
    }

    return {
      id: contractId,
      tenantId,
      carrierId: negotiation.selectedCarrierId,
      carrierName: selectedCarrier.carrierName,
      lanes: [negotiation.laneId],
      rateSheets: [
        {
          ...rateSheet,
          id: this.generateId("ratesheet"),
          contractId,
        },
      ],
      volumeCommitments: [],
      status: "active",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create FreightManagementEngine
 */
export function createFreightManagementEngine(): FreightManagementEngine {
  return new FreightManagementEngine();
}
