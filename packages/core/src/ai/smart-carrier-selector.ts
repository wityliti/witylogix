/**
 * Smart Carrier Recommendation Engine
 *
 * AI-powered carrier selection with:
 * - Multi-criteria scoring: cost (30%), speed (25%), reliability (25%), tracking quality (10%), rating (10%)
 * - Reliability tracking: on-time delivery rate, damage rate, exception rate per carrier per lane
 * - Cost optimization: find cheapest option meeting delivery deadline
 * - Speed optimization: find fastest option within budget
 * - Green shipping: eco-friendly carrier/service ranking
 * - Smart default: recommend default carrier based on tenant's patterns
 * - A/B testing: experiment with different carrier recommendations
 * - Explanation: provide human-readable reasoning for each recommendation
 *
 * Algorithm:
 * 1. Filter carriers that can meet deadline with specified service level
 * 2. Score each carrier on 5 dimensions (cost, speed, reliability, tracking, rating)
 * 3. Weight scores according to tenant preferences (customizable weights)
 * 4. Rank by final score
 * 5. Return top carrier with reasoning and alternatives
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type CarrierCode =
  | "ups"
  | "fedex"
  | "dhl"
  | "usps"
  | "canada_post"
  | "generic";
export type ServiceLevel =
  | "ground"
  | "express"
  | "overnight"
  | "economy"
  | "international";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Carrier rate quote from rate shopping
 */
export interface CarrierRate {
  carrier: CarrierCode;
  service: string; // e.g., "UPS Ground", "FedEx Express"
  serviceCode: string; // carrier-specific code
  serviceLevel: ServiceLevel;
  cost: number; // USD
  currency: string;
  estimatedDays: number; // business days
  estimatedDeliveryDate: Date;
}

/**
 * Reliability metrics for a carrier on a specific lane
 */
export interface CarrierReliability {
  carrier: CarrierCode;
  lane: string; // e.g., "CA-NY"
  onTimeRate: number; // 0-1
  damageRate: number; // 0-1 (percentage of damaged packages)
  exceptionRate: number; // 0-1 (percentage with exceptions/delays)
  sampleCount: number; // number of shipments tracked
  customerRating: number; // 1-5 stars
  trackingAccuracy: number; // 0-1, how often tracking is current
  lastUpdated: Date;
}

/**
 * Carbon offset and eco information
 */
export interface EcoInfo {
  carrier: CarrierCode;
  carbonOffsetPerKilo: number; // grams CO2 per kg shipped
  consolidatedShippingAvailable: boolean;
  renewableEnergyPercent: number; // 0-100%
  ecoRating: number; // 1-5 stars
}

/**
 * Score breakdown for a carrier recommendation
 */
export interface CarrierScore {
  carrier: CarrierCode;
  overallScore: number; // 0-100, weighted composite
  costScore: number; // 0-100 (30% weight)
  speedScore: number; // 0-100 (25% weight)
  reliabilityScore: number; // 0-100 (25% weight)
  trackingScore: number; // 0-100 (10% weight)
  ratingScore: number; // 0-100 (10% weight)
  ecoScore: number; // 0-100 (optional bonus)
  estimatedCost: number; // actual cost
  estimatedDays: number; // actual days
  meetsDeadline: boolean;
  reasons: string[];
}

/**
 * Customizable scoring weights for different tenant preferences
 */
export interface ScoringWeights {
  cost: number; // 0-1, default 0.3
  speed: number; // 0-1, default 0.25
  reliability: number; // 0-1, default 0.25
  tracking: number; // 0-1, default 0.1
  rating: number; // 0-1, default 0.1
}

/**
 * Final carrier recommendation
 */
export interface CarrierRecommendation {
  recommendedCarrier: CarrierCode;
  recommendedService: string;
  recommendedServiceCode: string;
  estimatedCost: number;
  currency: string;
  estimatedDeliveryDate: Date;
  estimatedDays: number;
  score: number; // 0-100
  confidence: number; // 0-100%, based on data availability
  reasoning: string[]; // human-readable explanation
  alternatives: {
    carrier: CarrierCode;
    service: string;
    cost: number;
    estimatedDays: number;
    score: number;
  }[]; // top 2-3 alternatives
}

/**
 * Tenant's shipping preferences
 */
export interface ShippingPreference {
  tenantId: string;
  preferredCarriers: CarrierCode[];
  scoringWeights: ScoringWeights;
  maxDeliveryDays?: number; // optional constraint
  prioritizeEco?: boolean;
  defaultServiceLevel: ServiceLevel;
  lastUpdated: Date;
}

/**
 * A/B test experiment for carrier recommendations
 */
export interface CarrierABTest {
  experimentId: string;
  controlCarrier: CarrierCode;
  variantCarrier: CarrierCode;
  splitPercent: number; // 0-100, % of shipments to variant
  successMetric: "onTimeRate" | "damageRate" | "cost" | "customerRating";
  startDate: Date;
  endDate?: Date;
  active: boolean;
}

/**
 * Outcome of an A/B test
 */
export interface ABTestOutcome {
  experimentId: string;
  variant: "control" | "test";
  carrier: CarrierCode;
  success: boolean;
  metricValue: number;
  recordedAt: Date;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: ScoringWeights = {
  cost: 0.3,
  speed: 0.25,
  reliability: 0.25,
  tracking: 0.1,
  rating: 0.1,
};

// ─── CARRIER RELIABILITY TRACKER ────────────────────────────────────────────

/**
 * Tracks carrier reliability metrics across lanes
 */
export class ReliabilityTracker {
  private reliabilityMap: Map<string, CarrierReliability> = new Map();

  /**
   * Record a shipment outcome to update reliability metrics
   */
  public recordShipment(
    carrier: CarrierCode,
    lane: string,
    onTime: boolean,
    damaged: boolean,
    hadException: boolean,
    customerRating: number,
    trackingAccurate: boolean,
  ): void {
    const key = `${carrier}|${lane}`;
    let reliability = this.reliabilityMap.get(key);

    if (!reliability) {
      reliability = {
        carrier,
        lane,
        onTimeRate: onTime ? 1 : 0,
        damageRate: damaged ? 1 : 0,
        exceptionRate: hadException ? 1 : 0,
        sampleCount: 1,
        customerRating,
        trackingAccuracy: trackingAccurate ? 1 : 0,
        lastUpdated: new Date(),
      };
    } else {
      // Update running averages
      const prevCount = reliability.sampleCount;
      reliability.onTimeRate =
        (reliability.onTimeRate * prevCount + (onTime ? 1 : 0)) /
        (prevCount + 1);
      reliability.damageRate =
        (reliability.damageRate * prevCount + (damaged ? 1 : 0)) /
        (prevCount + 1);
      reliability.exceptionRate =
        (reliability.exceptionRate * prevCount + (hadException ? 1 : 0)) /
        (prevCount + 1);
      reliability.customerRating =
        (reliability.customerRating * prevCount + customerRating) /
        (prevCount + 1);
      reliability.trackingAccuracy =
        (reliability.trackingAccuracy * prevCount +
          (trackingAccurate ? 1 : 0)) /
        (prevCount + 1);
      reliability.sampleCount = prevCount + 1;
      reliability.lastUpdated = new Date();
    }

    this.reliabilityMap.set(key, reliability);
  }

  /**
   * Get reliability metrics for a carrier on a lane
   */
  public getReliability(
    carrier: CarrierCode,
    lane: string,
  ): CarrierReliability | undefined {
    return this.reliabilityMap.get(`${carrier}|${lane}`);
  }

  /**
   * Get all reliability data
   */
  public getAllReliability(): CarrierReliability[] {
    return Array.from(this.reliabilityMap.values());
  }
}

// ─── COST OPTIMIZER ────────────────────────────────────────────────────────

/**
 * Finds cost-optimal carrier that meets delivery deadline
 */
export class CostOptimizer {
  /**
   * Find cheapest carrier meeting deadline
   */
  public findCheapestMeetingDeadline(
    rates: CarrierRate[],
    deadlineDays: number,
  ): CarrierRate | null {
    const eligible = rates
      .filter((r) => r.estimatedDays <= deadlineDays)
      .sort((a, b) => a.cost - b.cost);
    return eligible.length > 0 ? eligible[0] : null;
  }

  /**
   * Calculate savings compared to most expensive option
   */
  public calculateSavings(rates: CarrierRate[]): {
    cheapest: number;
    mostExpensive: number;
    savings: number;
    percentSavings: number;
  } {
    if (rates.length === 0)
      return { cheapest: 0, mostExpensive: 0, savings: 0, percentSavings: 0 };

    const costs = rates.map((r) => r.cost).sort((a, b) => a - b);
    const cheapest = costs[0];
    const mostExpensive = costs[costs.length - 1];

    return {
      cheapest,
      mostExpensive,
      savings: mostExpensive - cheapest,
      percentSavings: ((mostExpensive - cheapest) / mostExpensive) * 100,
    };
  }
}

// ─── SPEED OPTIMIZER ──────────────────────────────────────────────────────

/**
 * Finds fastest carrier within budget
 */
export class SpeedOptimizer {
  /**
   * Find fastest carrier within budget
   */
  public findFastestWithinBudget(
    rates: CarrierRate[],
    budgetUSD: number,
  ): CarrierRate | null {
    const eligible = rates
      .filter((r) => r.cost <= budgetUSD)
      .sort((a, b) => a.estimatedDays - b.estimatedDays);
    return eligible.length > 0 ? eligible[0] : null;
  }

  /**
   * Find speed advantage (time saved vs slowest)
   */
  public calculateSpeedAdvantage(rates: CarrierRate[]): number {
    if (rates.length === 0) return 0;
    const days = rates.map((r) => r.estimatedDays).sort((a, b) => a - b);
    return days[days.length - 1] - days[0];
  }
}

// ─── GREEN SHIPPING OPTIMIZER ──────────────────────────────────────────────

/**
 * Ranks carriers by eco-friendliness
 */
export class GreenShippingOptimizer {
  private ecoData: Map<CarrierCode, EcoInfo> = new Map();

  /**
   * Add eco information for a carrier
   */
  public setEcoInfo(carrier: CarrierCode, info: EcoInfo): void {
    this.ecoData.set(carrier, info);
  }

  /**
   * Get eco score for a carrier (0-100)
   */
  public getEcoScore(carrier: CarrierCode): number {
    const info = this.ecoData.get(carrier);
    if (!info) return 50; // neutral if no data

    let score = 0;
    score += info.ecoRating * 20; // rating: 0-100
    score += info.renewableEnergyPercent * 0.5; // renewable energy: 0-50
    score += (info.consolidatedShippingAvailable ? 1 : 0) * 25; // consolidated available: +25

    return Math.min(100, score);
  }

  /**
   * Calculate carbon footprint
   */
  public calculateCarbonFootprint(
    carrier: CarrierCode,
    weightKilo: number,
    distanceKm: number,
  ): number {
    const info = this.ecoData.get(carrier);
    if (!info) return distanceKm * weightKilo * 0.1; // rough estimate

    // Carbon = weight * offset per kg * distance factor
    return weightKilo * info.carbonOffsetPerKilo * Math.log(distanceKm + 1);
  }
}

// ─── CARRIER SCORER ────────────────────────────────────────────────────────

/**
 * Multi-criteria carrier scoring
 */
export class CarrierScorer {
  private reliabilityTracker: ReliabilityTracker;
  private greenOptimizer: GreenShippingOptimizer;

  constructor() {
    this.reliabilityTracker = new ReliabilityTracker();
    this.greenOptimizer = new GreenShippingOptimizer();
  }

  /**
   * Score a single carrier rate
   */
  public scoreCarrier(
    rate: CarrierRate,
    allRates: CarrierRate[],
    lane: string,
    weights: ScoringWeights = DEFAULT_WEIGHTS,
    prioritizeEco: boolean = false,
  ): CarrierScore {
    const reasons: string[] = [];

    // 1. Cost score (0-100, 100 = cheapest)
    const costs = allRates.map((r) => r.cost).sort((a, b) => a - b);
    const minCost = costs[0];
    const maxCost = costs[costs.length - 1];
    const costScore = 100 - ((rate.cost - minCost) / (maxCost - minCost)) * 100;
    if (rate.cost === minCost) reasons.push(`Cheapest option at $${rate.cost}`);

    // 2. Speed score (0-100, 100 = fastest)
    const days = allRates.map((r) => r.estimatedDays).sort((a, b) => a - b);
    const minDays = days[0];
    const maxDays = days[days.length - 1];
    const speedScore =
      100 - ((rate.estimatedDays - minDays) / (maxDays - minDays + 0.1)) * 100;
    if (rate.estimatedDays === minDays)
      reasons.push(`Fastest delivery in ${rate.estimatedDays} days`);

    // 3. Reliability score (0-100)
    let reliabilityScore = 70; // default if no data
    const reliability = this.reliabilityTracker.getReliability(
      rate.carrier,
      lane,
    );
    if (reliability) {
      // Score based on on-time rate, low damage, low exceptions
      reliabilityScore =
        (reliability.onTimeRate * 0.6 +
          (1 - reliability.damageRate) * 0.2 +
          (1 - reliability.exceptionRate) * 0.2) *
        100;
      reasons.push(
        `${(reliability.onTimeRate * 100).toFixed(0)}% on-time delivery rate`,
      );
    }

    // 4. Tracking quality score (0-100)
    let trackingScore = 70;
    if (reliability) {
      trackingScore = reliability.trackingAccuracy * 100;
      reasons.push(
        `${(reliability.trackingAccuracy * 100).toFixed(0)}% tracking accuracy`,
      );
    }

    // 5. Customer rating score (0-100)
    let ratingScore = 75;
    if (reliability && reliability.customerRating > 0) {
      ratingScore = (reliability.customerRating / 5) * 100;
      reasons.push(
        `${reliability.customerRating.toFixed(1)}/5 customer rating`,
      );
    }

    // 6. Eco score (optional bonus)
    let ecoScore = 50;
    if (prioritizeEco) {
      ecoScore = this.greenOptimizer.getEcoScore(rate.carrier);
      reasons.push(`Eco score: ${ecoScore.toFixed(0)}/100`);
    }

    // Weighted composite score
    const overallScore =
      costScore * weights.cost +
      speedScore * weights.speed +
      reliabilityScore * weights.reliability +
      trackingScore * weights.tracking +
      ratingScore * weights.rating;

    return {
      carrier: rate.carrier,
      overallScore: Math.round(overallScore),
      costScore: Math.round(costScore),
      speedScore: Math.round(speedScore),
      reliabilityScore: Math.round(reliabilityScore),
      trackingScore: Math.round(trackingScore),
      ratingScore: Math.round(ratingScore),
      ecoScore: Math.round(ecoScore),
      estimatedCost: rate.cost,
      estimatedDays: rate.estimatedDays,
      meetsDeadline: true,
      reasons,
    };
  }

  /**
   * Score all rates and return ranked list
   */
  public scoreAllCarriers(
    rates: CarrierRate[],
    lane: string,
    deadlineDays?: number,
    weights: ScoringWeights = DEFAULT_WEIGHTS,
    prioritizeEco: boolean = false,
  ): CarrierScore[] {
    // Filter by deadline if specified
    let eligible = rates;
    if (deadlineDays) {
      eligible = rates.filter((r) => r.estimatedDays <= deadlineDays);
    }

    // Score each
    const scores = eligible.map((rate) =>
      this.scoreCarrier(rate, rates, lane, weights, prioritizeEco),
    );

    // Rank by overall score descending
    return scores.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Get reliability tracker for recording outcomes
   */
  public getReliabilityTracker(): ReliabilityTracker {
    return this.reliabilityTracker;
  }

  /**
   * Get green optimizer
   */
  public getGreenOptimizer(): GreenShippingOptimizer {
    return this.greenOptimizer;
  }
}

// ─── A/B TESTING ──────────────────────────────────────────────────────────

/**
 * Manages carrier recommendation A/B tests
 */
export class CarrierABTestManager {
  private experiments: Map<string, CarrierABTest> = new Map();
  private outcomes: ABTestOutcome[] = [];

  /**
   * Create a new experiment
   */
  public createExperiment(
    experimentId: string,
    controlCarrier: CarrierCode,
    variantCarrier: CarrierCode,
    splitPercent: number = 50,
    successMetric:
      | "onTimeRate"
      | "damageRate"
      | "cost"
      | "customerRating" = "onTimeRate",
  ): CarrierABTest {
    const experiment: CarrierABTest = {
      experimentId,
      controlCarrier,
      variantCarrier,
      splitPercent,
      successMetric,
      startDate: new Date(),
      active: true,
    };

    this.experiments.set(experimentId, experiment);
    return experiment;
  }

  /**
   * Get variant to use based on split
   */
  public getVariant(experimentId: string): CarrierCode | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || !experiment.active) return null;

    const random = Math.random() * 100;
    return random < experiment.splitPercent
      ? experiment.variantCarrier
      : experiment.controlCarrier;
  }

  /**
   * Record outcome of variant test
   */
  public recordOutcome(
    experimentId: string,
    variant: "control" | "test",
    carrier: CarrierCode,
    success: boolean,
    metricValue: number,
  ): void {
    this.outcomes.push({
      experimentId,
      variant,
      carrier,
      success,
      metricValue,
      recordedAt: new Date(),
    });
  }

  /**
   * Get results summary for experiment
   */
  public getResults(experimentId: string): {
    experimentId: string;
    totalOutcomes: number;
    controlSuccessRate: number;
    testSuccessRate: number;
    winner: "control" | "test" | "tie";
    confidence: number;
  } | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const outcomes = this.outcomes.filter(
      (o) => o.experimentId === experimentId,
    );
    if (outcomes.length === 0) {
      return {
        experimentId,
        totalOutcomes: 0,
        controlSuccessRate: 0,
        testSuccessRate: 0,
        winner: "tie",
        confidence: 0,
      };
    }

    const controlOutcomes = outcomes.filter((o) => o.variant === "control");
    const testOutcomes = outcomes.filter((o) => o.variant === "test");

    const controlSuccessRate =
      controlOutcomes.length > 0
        ? controlOutcomes.filter((o) => o.success).length /
          controlOutcomes.length
        : 0;
    const testSuccessRate =
      testOutcomes.length > 0
        ? testOutcomes.filter((o) => o.success).length / testOutcomes.length
        : 0;

    const winner =
      testSuccessRate > controlSuccessRate * 1.05
        ? "test"
        : controlSuccessRate > testSuccessRate * 1.05
          ? "control"
          : "tie";
    const minSamples = Math.min(controlOutcomes.length, testOutcomes.length);
    const confidence = Math.min(100, (minSamples / 30) * 100); // rough confidence metric

    return {
      experimentId,
      totalOutcomes: outcomes.length,
      controlSuccessRate,
      testSuccessRate,
      winner,
      confidence,
    };
  }
}

// ─── SMART CARRIER SELECTOR ────────────────────────────────────────────────

/**
 * Main carrier recommendation engine
 */
export class SmartCarrierSelector {
  private scorer: CarrierScorer;
  private costOptimizer: CostOptimizer;
  private speedOptimizer: SpeedOptimizer;
  private abTestManager: CarrierABTestManager;
  private preferences: Map<string, ShippingPreference> = new Map();

  constructor() {
    this.scorer = new CarrierScorer();
    this.costOptimizer = new CostOptimizer();
    this.speedOptimizer = new SpeedOptimizer();
    this.abTestManager = new CarrierABTestManager();
  }

  /**
   * Get recommendation for a shipment
   */
  public recommend(
    tenantId: string,
    rates: CarrierRate[],
    originZip: string,
    destinationZip: string,
    deadlineDays?: number,
    customWeights?: ScoringWeights,
  ): CarrierRecommendation {
    if (rates.length === 0) {
      throw new Error("No carrier rates available");
    }

    const lane = `${originZip}-${destinationZip}`;
    const pref = this.preferences.get(tenantId);
    const weights = customWeights || pref?.scoringWeights || DEFAULT_WEIGHTS;
    const prioritizeEco = pref?.prioritizeEco || false;
    const deadline = deadlineDays || pref?.maxDeliveryDays || 7;

    // Score all carriers
    const scores = this.scorer.scoreAllCarriers(
      rates,
      lane,
      deadline,
      weights,
      prioritizeEco,
    );

    if (scores.length === 0) {
      throw new Error(
        `No carriers available that meet ${deadline} day deadline`,
      );
    }

    // Get top recommendation
    const topScore = scores[0];
    const matchingRate = rates.find(
      (r) =>
        r.carrier === topScore.carrier && r.cost === topScore.estimatedCost,
    );

    if (!matchingRate) {
      throw new Error("Could not find matching rate for top carrier");
    }

    const reasoning = [
      ...topScore.reasons,
      `Overall score: ${topScore.overallScore}/100`,
      `Cost efficiency: ${topScore.costScore}/100`,
      `Speed: ${topScore.speedScore}/100`,
      `Reliability: ${topScore.reliabilityScore}/100`,
    ];

    return {
      recommendedCarrier: topScore.carrier,
      recommendedService: matchingRate.service,
      recommendedServiceCode: matchingRate.serviceCode,
      estimatedCost: topScore.estimatedCost,
      currency: matchingRate.currency,
      estimatedDeliveryDate: matchingRate.estimatedDeliveryDate,
      estimatedDays: topScore.estimatedDays,
      score: topScore.overallScore,
      confidence: this.calculateConfidence(topScore),
      reasoning,
      alternatives: scores
        .slice(1, 4)
        .map((s) => {
          const rate = rates.find(
            (r) => r.carrier === s.carrier && r.cost === s.estimatedCost,
          );
          return {
            carrier: s.carrier,
            service: rate?.service || "Unknown",
            cost: s.estimatedCost,
            estimatedDays: s.estimatedDays,
            score: s.overallScore,
          };
        })
        .filter((a) => a.service !== "Unknown"),
    };
  }

  /**
   * Set tenant shipping preferences
   */
  public setPreference(tenantId: string, pref: ShippingPreference): void {
    this.preferences.set(tenantId, pref);
  }

  /**
   * Get scoring components
   */
  public getScorer(): CarrierScorer {
    return this.scorer;
  }

  public getCostOptimizer(): CostOptimizer {
    return this.costOptimizer;
  }

  public getSpeedOptimizer(): SpeedOptimizer {
    return this.speedOptimizer;
  }

  public getABTestManager(): CarrierABTestManager {
    return this.abTestManager;
  }

  /**
   * Calculate confidence (0-100) based on data and factors
   */
  private calculateConfidence(score: CarrierScore): number {
    // High reliability data = high confidence
    // Multiple strong alternatives = medium confidence
    // Limited data = lower confidence
    let confidence = 80;

    if (score.reliabilityScore < 60) confidence -= 10;
    if (score.trackingScore < 60) confidence -= 5;
    if (score.overallScore < 70) confidence -= 15;

    return Math.max(50, confidence);
  }
}

// ─── FACTORY FUNCTIONS ─────────────────────────────────────────────────────

let globalSelectorInstance: SmartCarrierSelector | null = null;

/**
 * Create new selector instance
 */
export function createSmartCarrierSelector(): SmartCarrierSelector {
  return new SmartCarrierSelector();
}

/**
 * Get global selector instance
 */
export function getSmartCarrierSelector(): SmartCarrierSelector {
  if (!globalSelectorInstance) {
    globalSelectorInstance = new SmartCarrierSelector();
  }
  return globalSelectorInstance;
}
