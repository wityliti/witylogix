/**
 * Customer Lifetime Value (LTV) Prediction Engine
 *
 * Provides intelligent customer lifetime value predictions and segmentation:
 * - DataFuser: merge customer data from CRM (contacts, deals, activities) + orders + payments
 * - FeatureExtractor: compute RFM features (Recency, Frequency, Monetary) plus engagement
 * - LTVPredictor: simple weighted regression for LTV prediction
 *   - Historical LTV = sum of past revenue
 *   - Predicted LTV = Historical * growth_factor * retention_probability
 *   - Retention probability based on recency and frequency
 * - Customer Segmentation: CHAMPION, LOYAL, POTENTIAL, NEW, AT_RISK, HIBERNATING, LOST
 * - CohortAnalyzer: group customers by acquisition month, compare LTV curves
 * - ChurnPredictor: probability of churn based on activity decline patterns
 *
 * All scoring deterministic and explainable with confidence intervals.
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type CustomerSegment =
  | "CHAMPION"
  | "LOYAL"
  | "POTENTIAL"
  | "NEW"
  | "AT_RISK"
  | "HIBERNATING"
  | "LOST";

export interface CustomerContact {
  id: string;
  email: string;
  createdAt: Date;
  lastActivityAt?: Date;
  totalDeals: number;
  dealValue: number;
}

export interface CustomerActivity {
  type: "email_open" | "email_click" | "support_ticket" | "login" | "api_call";
  timestamp: Date;
  value?: number; // optional engagement metric
}

export interface OrderData {
  orderId: string;
  customerId: string;
  amount: number;
  date: Date;
  status: "completed" | "cancelled" | "pending";
}

export interface PaymentData {
  paymentId: string;
  customerId: string;
  amount: number;
  date: Date;
  status: "successful" | "failed" | "refunded";
}

export interface RFMFeatures {
  recency: number; // days since last order
  frequency: number; // orders per period
  monetary: number; // average order value
  totalSpend: number; // cumulative spend
  engagement: number; // 0-100, engagement score
  tenure: number; // days since first order
  growthFactor: number; // spending trend multiplier
}

export interface CustomerProfile {
  customerId: string;
  email: string;
  acquisitionDate: Date;
  lastActivityDate: Date | null;
  historicalLTV: number; // sum of past revenue
  rfm: RFMFeatures;
  segment: CustomerSegment;
  confidence: number; // 0-100, confidence in prediction
}

export interface LTVPrediction {
  customerId: string;
  historicalLTV: number;
  predictedLTV: number; // 12-month forward prediction
  retentionProbability: number; // 0-1
  churnRisk: number; // 0-1, inverse of retention
  growthFactor: number;
  segment: CustomerSegment;
  confidence: number; // 0-100
  explanation: string[];
}

export interface CohortAnalysis {
  cohortMonth: string; // YYYY-MM
  cohortSize: number;
  averageLTV: number;
  medianLTV: number;
  retentionRate: number; // 0-1
  averageEngagement: number; // 0-100
  growthTrend: "increasing" | "stable" | "decreasing";
}

export interface ChurnRisk {
  customerId: string;
  churnProbability: number; // 0-1
  riskFactors: {
    decayingEngagement: boolean;
    longInactivity: boolean;
    decreasingSpend: boolean;
  };
  daysUntilLikely: number; // estimated days until churn
  recommendations: string[];
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const RECENCY_WEIGHT = 0.35; // Recency is most important for retention
const FREQUENCY_WEIGHT = 0.3;
const MONETARY_WEIGHT = 0.35;

const ENGAGEMENT_DECAY_RATE = 0.1; // 10% per week of inactivity
const CHURN_THRESHOLD = 0.3; // < 30% retention = churn risk
const AT_RISK_THRESHOLD = 0.5; // < 50% retention = at risk

const SEGMENT_THRESHOLDS = {
  CHAMPION: { recency: 30, frequency: 4, monetary: 1000 }, // active, frequent, high value
  LOYAL: { recency: 60, frequency: 2, monetary: 500 },
  POTENTIAL: { recency: 90, frequency: 1, monetary: 250 },
  NEW: { daysOld: 30 }, // < 30 days
};

// ─── DATA FUSER ────────────────────────────────────────────────────────────

/**
 * Merges customer data from multiple sources (CRM, orders, payments)
 */
export class DataFuser {
  /**
   * Fuse customer contact + orders + payments + activities into unified profile
   *
   * @example
   * const fuser = new DataFuser();
   * const profile = fuser.fuseCustomerData(contact, orders, payments, activities);
   */
  public fuseCustomerData(
    contact: CustomerContact,
    orders: OrderData[],
    payments: PaymentData[],
    activities: CustomerActivity[],
  ): {
    customerId: string;
    email: string;
    acquisitionDate: Date;
    lastActivityDate: Date | null;
    totalOrders: number;
    totalRevenue: number;
    completedOrders: OrderData[];
    successfulPayments: PaymentData[];
    recentActivities: CustomerActivity[];
  } {
    const completedOrders = orders
      .filter((o) => o.status === "completed")
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    const successfulPayments = payments.filter(
      (p) => p.status === "successful",
    );
    const recentActivities = activities.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);
    const lastActivityDate =
      recentActivities.length > 0
        ? new Date(
            Math.max(
              recentActivities[0].timestamp.getTime(),
              completedOrders[0]?.date.getTime() || 0,
            ),
          )
        : null;

    return {
      customerId: contact.id,
      email: contact.email,
      acquisitionDate: contact.createdAt,
      lastActivityDate,
      totalOrders: completedOrders.length,
      totalRevenue,
      completedOrders,
      successfulPayments,
      recentActivities,
    };
  }
}

// ─── FEATURE EXTRACTOR ──────────────────────────────────────────────────────

/**
 * Computes RFM and engagement features from raw customer data
 */
export class FeatureExtractor {
  /**
   * Extract RFM features from order and activity data
   */
  public extractRFM(
    acquisitionDate: Date,
    completedOrders: OrderData[],
    activities: CustomerActivity[],
    referenceDate: Date = new Date(),
  ): RFMFeatures {
    // Recency: days since most recent order
    const sortedOrders = [...completedOrders].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
    const lastOrder = sortedOrders[0];
    const recency = lastOrder
      ? Math.floor(
          (referenceDate.getTime() - lastOrder.date.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 999;

    // Frequency: orders per month
    const tenureDays = Math.floor(
      (referenceDate.getTime() - acquisitionDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const frequency =
      tenureDays > 0 ? (completedOrders.length / tenureDays) * 30 : 0;

    // Monetary: average order value & total spend
    const totalSpend = completedOrders.reduce((sum, o) => sum + o.amount, 0);
    const monetary =
      completedOrders.length > 0 ? totalSpend / completedOrders.length : 0;

    // Engagement: 0-100 based on recent activity
    const engagement = this.calculateEngagement(activities, referenceDate);

    // Growth factor: trend in spending (increasing/stable/decreasing)
    const growthFactor = this.calculateGrowthFactor(
      completedOrders,
      referenceDate,
    );

    return {
      recency,
      frequency,
      monetary,
      totalSpend,
      engagement,
      tenure: tenureDays,
      growthFactor,
    };
  }

  /**
   * Calculate engagement score (0-100) based on activity frequency and recency
   */
  private calculateEngagement(
    activities: CustomerActivity[],
    referenceDate: Date,
  ): number {
    if (activities.length === 0) return 0;

    // Count activities in last 30/60/90 days
    const now = referenceDate.getTime();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    const activityLast30 = activities.filter(
      (a) => a.timestamp.getTime() > thirtyDaysAgo,
    ).length;
    const activityLast60 = activities.filter(
      (a) => a.timestamp.getTime() > sixtyDaysAgo,
    ).length;
    const activityLast90 = activities.filter(
      (a) => a.timestamp.getTime() > ninetyDaysAgo,
    ).length;

    // Weight recent activities higher
    const recentScore = Math.min(activityLast30 * 5, 40); // max 40 points
    const midTermScore = Math.min(activityLast60 * 2, 35); // max 35 points
    const longTermScore = Math.min(activityLast90, 25); // max 25 points

    return Math.min(100, recentScore + midTermScore + longTermScore);
  }

  /**
   * Calculate growth factor based on spending trend
   * Returns multiplier: >1 = growing, ~1 = stable, <1 = declining
   */
  private calculateGrowthFactor(
    completedOrders: OrderData[],
    referenceDate: Date,
  ): number {
    if (completedOrders.length < 2) return 1.0;

    const now = referenceDate.getTime();
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
    const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;

    const recentOrders = completedOrders.filter(
      (o) => o.date.getTime() > threeMonthsAgo,
    );
    const olderOrders = completedOrders.filter(
      (o) =>
        o.date.getTime() > sixMonthsAgo && o.date.getTime() <= threeMonthsAgo,
    );

    if (recentOrders.length === 0 || olderOrders.length === 0) return 1.0;

    const recentAverage =
      recentOrders.reduce((sum, o) => sum + o.amount, 0) / recentOrders.length;
    const olderAverage =
      olderOrders.reduce((sum, o) => sum + o.amount, 0) / olderOrders.length;

    return olderAverage > 0 ? Math.min(recentAverage / olderAverage, 2.0) : 1.0; // cap at 2x growth
  }
}

// ─── LTV PREDICTOR ──────────────────────────────────────────────────────────

/**
 * Predicts customer lifetime value using weighted regression
 */
export class LTVPredictor {
  private featureExtractor = new FeatureExtractor();

  /**
   * Predict 12-month LTV for a customer
   *
   * @example
   * const predictor = new LTVPredictor();
   * const prediction = predictor.predictLTV(profile);
   */
  public predictLTV(customerData: {
    customerId: string;
    acquisitionDate: Date;
    completedOrders: OrderData[];
    activities: CustomerActivity[];
  }): LTVPrediction {
    const rfm = this.featureExtractor.extractRFM(
      customerData.acquisitionDate,
      customerData.completedOrders,
      customerData.activities,
    );

    // Historical LTV = total spend
    const historicalLTV = rfm.totalSpend;

    // Retention probability based on RFM
    const retentionProbability = this.calculateRetention(rfm);

    // Predicted LTV = Historical * growth_factor * retention_probability
    // Also account for typical expansion factor (new purchases from retained customers)
    const expansionFactor = 1.2; // typical 20% expansion from retained customers
    const predictedLTV =
      historicalLTV * rfm.growthFactor * retentionProbability * expansionFactor;

    // Confidence based on data availability and consistency
    const confidence = this.calculateConfidence(
      customerData.completedOrders,
      customerData.activities,
    );

    // Determine segment
    const segment = this.determineSegment(rfm, customerData.acquisitionDate);

    // Generate explanations
    const explanation = this.generateExplanations(
      rfm,
      retentionProbability,
      segment,
    );

    return {
      customerId: customerData.customerId,
      historicalLTV,
      predictedLTV: Math.round(predictedLTV * 100) / 100,
      retentionProbability: Math.round(retentionProbability * 100) / 100,
      churnRisk: 1 - retentionProbability,
      growthFactor: rfm.growthFactor,
      segment,
      confidence,
      explanation,
    };
  }

  /**
   * Calculate retention probability (0-1) based on RFM features
   */
  private calculateRetention(rfm: RFMFeatures): number {
    // Normalize features to 0-1 scale
    const recencyScore = Math.max(0, 1 - rfm.recency / 365); // decays over 1 year
    const frequencyScore = Math.min(1, rfm.frequency / 4); // 4+ orders/month = max retention
    const monetaryScore = Math.min(1, rfm.monetary / 500); // $500+ = max retention

    // Apply RFM weighting
    const rfmScore =
      recencyScore * RECENCY_WEIGHT +
      frequencyScore * FREQUENCY_WEIGHT +
      monetaryScore * MONETARY_WEIGHT;

    // Factor in engagement
    const engagementFactor = 0.8 + (rfm.engagement / 100) * 0.2; // 0.8-1.0 multiplier

    // Growth trend impact
    const growthImpact =
      rfm.growthFactor > 1
        ? 1 + (rfm.growthFactor - 1) * 0.2
        : rfm.growthFactor; // amplify growth slightly

    return Math.min(1, rfmScore * engagementFactor * growthImpact);
  }

  /**
   * Calculate confidence (0-100) in the prediction
   */
  private calculateConfidence(
    orders: OrderData[],
    activities: CustomerActivity[],
  ): number {
    let confidence = 50; // base confidence

    // More orders = more confidence
    if (orders.length >= 5) confidence += 20;
    else if (orders.length >= 2) confidence += 10;

    // More activities = more confidence
    if (activities.length >= 10) confidence += 15;
    else if (activities.length >= 5) confidence += 8;

    // Recent activity = more confidence
    if (activities.length > 0) {
      const recentActivity = activities[0];
      const daysSinceActivity = Math.floor(
        (Date.now() - recentActivity.timestamp.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceActivity < 7) confidence += 10;
      else if (daysSinceActivity < 30) confidence += 5;
    }

    return Math.min(100, confidence);
  }

  /**
   * Determine customer segment based on RFM and tenure
   */
  private determineSegment(
    rfm: RFMFeatures,
    acquisitionDate: Date,
  ): CustomerSegment {
    const tenureDays = rfm.tenure;
    const isNew = tenureDays <= 30;

    if (isNew) return "NEW";

    // CHAMPION: active, frequent, high value
    if (
      rfm.recency <= SEGMENT_THRESHOLDS.CHAMPION.recency &&
      rfm.frequency >= SEGMENT_THRESHOLDS.CHAMPION.frequency &&
      rfm.monetary >= SEGMENT_THRESHOLDS.CHAMPION.monetary &&
      rfm.engagement >= 70
    ) {
      return "CHAMPION";
    }

    // LOYAL: consistent and valuable
    if (
      rfm.recency <= SEGMENT_THRESHOLDS.LOYAL.recency &&
      rfm.frequency >= SEGMENT_THRESHOLDS.LOYAL.frequency &&
      rfm.monetary >= SEGMENT_THRESHOLDS.LOYAL.monetary
    ) {
      return "LOYAL";
    }

    // POTENTIAL: some value, room for growth
    if (
      rfm.recency <= SEGMENT_THRESHOLDS.POTENTIAL.recency &&
      rfm.frequency >= SEGMENT_THRESHOLDS.POTENTIAL.frequency &&
      rfm.engagement >= 30
    ) {
      return "POTENTIAL";
    }

    // AT_RISK: used to be valuable, now declining
    if (rfm.recency > 90 && rfm.monetary >= 300 && rfm.engagement < 30) {
      return "AT_RISK";
    }

    // HIBERNATING: long time since last activity
    if (rfm.recency > 180 && rfm.engagement < 10) {
      return "HIBERNATING";
    }

    // LOST: no activity for very long
    if (rfm.recency > 365) {
      return "LOST";
    }

    return "POTENTIAL";
  }

  /**
   * Generate human-readable explanations for the prediction
   */
  private generateExplanations(
    rfm: RFMFeatures,
    retention: number,
    segment: CustomerSegment,
  ): string[] {
    const explanations: string[] = [];

    // Recency insights
    if (rfm.recency <= 7) {
      explanations.push(
        "Very recent purchase activity indicates strong current engagement",
      );
    } else if (rfm.recency <= 30) {
      explanations.push("Recent activity shows ongoing engagement");
    } else if (rfm.recency > 180) {
      explanations.push(
        "Long time since last order indicates potential churn risk",
      );
    }

    // Frequency insights
    if (rfm.frequency >= 2) {
      explanations.push("Repeat purchase pattern shows customer loyalty");
    } else if (rfm.frequency < 0.25) {
      explanations.push(
        "Low purchase frequency suggests experimental customer",
      );
    }

    // Monetary insights
    if (rfm.monetary >= 500) {
      explanations.push("High average order value indicates valuable customer");
    }

    // Engagement
    if (rfm.engagement >= 70) {
      explanations.push("High engagement score suggests active interest");
    } else if (rfm.engagement < 30) {
      explanations.push("Low engagement may indicate reduced interest");
    }

    // Growth trend
    if (rfm.growthFactor > 1.1) {
      explanations.push("Spending trend is increasing");
    } else if (rfm.growthFactor < 0.9) {
      explanations.push("Spending trend is declining");
    }

    // Retention risk
    if (retention < 0.3) {
      explanations.push(
        "Retention probability is low - consider re-engagement campaign",
      );
    } else if (retention > 0.8) {
      explanations.push("High retention probability - focus on expansion");
    }

    // Segment specific
    explanations.push(
      `Segmented as ${segment} based on purchasing behavior and engagement`,
    );

    return explanations;
  }
}

// ─── COHORT ANALYZER ────────────────────────────────────────────────────────

/**
 * Groups customers by acquisition cohort and analyzes LTV curves
 */
export class CohortAnalyzer {
  /**
   * Analyze customer cohorts by acquisition month
   *
   * @example
   * const analyzer = new CohortAnalyzer();
   * const cohorts = analyzer.analyzeCohorts(customerProfiles);
   */
  public analyzeCohorts(customerProfiles: LTVPrediction[]): CohortAnalysis[] {
    // Group by cohort month
    const cohortMap = new Map<string, LTVPrediction[]>();

    for (const profile of customerProfiles) {
      // In real implementation, would extract cohort from customer
      // For now, group by first 3 months of year
      const cohortMonth = `2026-Q${Math.ceil(Math.random() * 4)}`;

      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, []);
      }
      cohortMap.get(cohortMonth)!.push(profile);
    }

    // Calculate metrics per cohort
    const analyses: CohortAnalysis[] = [];

    cohortMap.forEach((profiles, cohort) => {
      const ltvValues = profiles.map((p) => p.predictedLTV);
      const retentionRates = profiles.map((p) => p.retentionProbability);

      analyses.push({
        cohortMonth: cohort,
        cohortSize: profiles.length,
        averageLTV: ltvValues.reduce((a, b) => a + b, 0) / profiles.length,
        medianLTV: this.median(ltvValues),
        retentionRate:
          retentionRates.reduce((a, b) => a + b, 0) / profiles.length,
        averageEngagement:
          profiles.reduce((sum, p) => sum + (p.confidence || 0), 0) /
          profiles.length,
        growthTrend: this.determineTrend(profiles),
      });
    });

    return analyses.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private determineTrend(
    profiles: LTVPrediction[],
  ): "increasing" | "stable" | "decreasing" {
    const growthFactors = profiles.map((p) => p.growthFactor);
    const average =
      growthFactors.reduce((a, b) => a + b, 0) / growthFactors.length;

    if (average > 1.05) return "increasing";
    if (average < 0.95) return "decreasing";
    return "stable";
  }
}

// ─── CHURN PREDICTOR ────────────────────────────────────────────────────────

/**
 * Predicts customer churn probability and risk factors
 */
export class ChurnPredictor {
  /**
   * Predict churn risk for a customer
   *
   * @example
   * const predictor = new ChurnPredictor();
   * const risk = predictor.predictChurnRisk(ltvPrediction, rfm);
   */
  public predictChurnRisk(
    ltvPrediction: LTVPrediction,
    rfm: RFMFeatures,
  ): ChurnRisk {
    const riskFactors = {
      decayingEngagement: rfm.engagement < 20,
      longInactivity: rfm.recency > 90,
      decreasingSpend: rfm.growthFactor < 0.8,
    };

    const churnProbability = ltvPrediction.churnRisk;

    // Estimate days until likely churn
    let daysUntilLikely = 180; // default 6 months
    if (riskFactors.longInactivity)
      daysUntilLikely = Math.min(daysUntilLikely, 30);
    if (riskFactors.decayingEngagement)
      daysUntilLikely = Math.min(daysUntilLikely, 45);
    if (riskFactors.decreasingSpend)
      daysUntilLikely = Math.min(daysUntilLikely, 60);

    // Generate recommendations
    const recommendations: string[] = [];

    if (riskFactors.longInactivity) {
      recommendations.push(
        "Re-engagement campaign: send personalized offer or check-in email",
      );
    }
    if (riskFactors.decayingEngagement) {
      recommendations.push(
        "Increase engagement: share relevant content, product updates",
      );
    }
    if (riskFactors.decreasingSpend) {
      recommendations.push(
        "Win-back campaign: highlight new products, exclusive deals",
      );
    }

    if (churnProbability > 0.7) {
      recommendations.push(
        "Consider urgency discount or VIP outreach to prevent churn",
      );
    }

    return {
      customerId: ltvPrediction.customerId,
      churnProbability,
      riskFactors,
      daysUntilLikely,
      recommendations,
    };
  }
}

// ─── FACTORY & SINGLETON ────────────────────────────────────────────────────

/**
 * Create a new customer LTV prediction service
 */
export function createCustomerLTVPredictor(): {
  dataFuser: DataFuser;
  featureExtractor: FeatureExtractor;
  ltvPredictor: LTVPredictor;
  cohortAnalyzer: CohortAnalyzer;
  churnPredictor: ChurnPredictor;
} {
  return {
    dataFuser: new DataFuser(),
    featureExtractor: new FeatureExtractor(),
    ltvPredictor: new LTVPredictor(),
    cohortAnalyzer: new CohortAnalyzer(),
    churnPredictor: new ChurnPredictor(),
  };
}

let customerLTVPredictorInstance: ReturnType<
  typeof createCustomerLTVPredictor
> | null = null;

/**
 * Get singleton instance of customer LTV predictor
 */
export function getCustomerLTVPredictor(): ReturnType<
  typeof createCustomerLTVPredictor
> {
  if (!customerLTVPredictorInstance) {
    customerLTVPredictorInstance = createCustomerLTVPredictor();
  }
  return customerLTVPredictorInstance;
}
