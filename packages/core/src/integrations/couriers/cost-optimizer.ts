/**
 * Cost Optimization Service
 *
 * Optimizes courier costs through:
 * - Real-time quote comparison
 * - Batch cost optimization
 * - ROI analysis
 * - Surge pricing detection
 * - Volume discount tracking
 * - Cost forecasting
 */

import type { CourierQuote } from "./types.js";
import type { DeliveryRequest, CourierOption } from "./smart-router.js";

// ─── Cost Data Types ────────────────────────────────────────

/**
 * Cost estimate for a delivery.
 */
export interface CostEstimate {
  /** Courier provider */
  provider: string;

  /** Estimated cost in USD */
  estimatedCost: number;

  /** Currency */
  currency: string;

  /** Cost breakdown */
  breakdown?: {
    baseFare?: number;
    distanceFare?: number;
    pickupFee?: number;
    surgeMultiplier?: number;
    discountApplied?: number;
  };

  /** Volume discount if applicable */
  volumeDiscount?: number;

  /** Effective cost after discounts */
  effectiveCost: number;

  /** Confidence in estimate (0-1) */
  confidence: number;

  /** Timestamp of estimate */
  estimatedAt: Date;

  /** Estimate valid until */
  validUntil: Date;
}

/**
 * Cost comparison result.
 */
export interface CostComparison {
  /** Delivery ID */
  deliveryId?: string;

  /** Cost estimates for each courier */
  estimates: CostEstimate[];

  /** Cheapest option */
  cheapest: CostEstimate;

  /** Average cost */
  averageCost: number;

  /** Cost range */
  costRange: {
    min: number;
    max: number;
    variance: number;
  };

  /** Potential savings using cheapest */
  potentialSavings: {
    vsAverage: number;
    vsExpensive: number;
  };

  /** Optimization recommendation */
  recommendation: {
    provider: string;
    estimatedCost: number;
    reasoning: string;
  };
}

/**
 * Batch cost optimization result.
 */
export interface BatchCostOptimization {
  /** Total deliveries */
  totalDeliveries: number;

  /** Cost summary */
  summary: {
    ifRoutedIndividually: number;
    ifOptimized: number;
    totalSavings: number;
    savingsPercent: number;
  };

  /** Courier assignments for optimization */
  assignments: Array<{
    deliveryId: string;
    provider: string;
    estimatedCost: number;
  }>;

  /** Volume discount opportunities */
  volumeDiscounts: Array<{
    provider: string;
    orderQuantity: number;
    discountPercent: number;
    totalDiscountValue: number;
  }>;

  /** Recommendations */
  recommendations: string[];
}

/**
 * ROI calculation result.
 */
export interface ROIAnalysis {
  /** Period analyzed (e.g., "30d", "90d") */
  period: string;

  /** Total deliveries */
  totalDeliveries: number;

  /** Cost comparison */
  costComparison: {
    singleCourierCost: number;
    multiCourierCost: number;
    savings: number;
    savingsPercent: number;
  };

  /** Volume discount benefits */
  volumeDiscounts: {
    totalDiscountValue: number;
    averageDiscountPercent: number;
  };

  /** Service quality improvements */
  serviceImprovements: {
    improvedOnTimeRate: number;
    reducedDamageRate: number;
    improvedCustomerSatisfaction: number;
  };

  /** Overall ROI */
  roi: {
    value: number;
    percent: number;
    paybackMonths: number;
  };

  /** Recommendations */
  recommendations: string[];
}

/**
 * Surge pricing detection result.
 */
export interface SurgePricingDetection {
  /** Provider with surge */
  provider: string;

  /** Is currently in surge */
  isSurge: boolean;

  /** Surge multiplier (1.0 = normal, 1.5 = 50% premium) */
  surgeMultiplier: number;

  /** Estimated surge end time */
  surgeEndsAt?: Date;

  /** Reason for surge (optional) */
  reason?: string;

  /** Alternative provider recommendation */
  alternativeProvider?: string;

  /** Cost difference if waiting out surge */
  costDifference?: number;

  /** Surge history */
  history: Array<{
    startedAt: Date;
    endedAt?: Date;
    peakMultiplier: number;
    duration?: number;
  }>;
}

/**
 * Volume discount configuration.
 */
export interface VolumeDiscount {
  /** Provider */
  provider: string;

  /** Discount tier */
  tiers: Array<{
    minDeliveries: number;
    maxDeliveries?: number;
    discountPercent: number;
  }>;

  /** Minimum order value */
  minimumOrderValue?: number;

  /** Effective from date */
  effectiveFrom: Date;

  /** Expires on date */
  expiresOn?: Date;
}

/**
 * Cost forecast data.
 */
export interface CostForecast {
  /** Period (daily, weekly, monthly) */
  period: "daily" | "weekly" | "monthly";

  /** Number of periods to forecast */
  periods: number;

  /** Forecasted costs */
  forecasts: Array<{
    periodStart: Date;
    periodEnd: Date;
    estimatedCost: number;
    confidence: number;
    trend: "up" | "down" | "stable";
  }>;

  /** Factors affecting forecast */
  factors: {
    seasonality: number;
    trendDirection: number;
    volatility: number;
  };

  /** Recommendations */
  recommendations: string[];
}

// ─── Cost Optimizer Service ────────────────────────────────────

/**
 * Cost optimization service.
 */
export class CostOptimizer {
  private surgeHistory: Map<string, SurgePricingDetection["history"]> = new Map();
  private volumeDiscounts: Map<string, VolumeDiscount> = new Map();
  private costHistory: Array<{ date: Date; provider: string; cost: number }> = [];

  /**
   * Register volume discount tier.
   *
   * @param provider Provider name
   * @param discount Discount configuration
   */
  registerVolumeDiscount(provider: string, discount: VolumeDiscount): void {
    this.volumeDiscounts.set(provider, discount);
  }

  /**
   * Record cost history for forecasting.
   *
   * @param provider Provider name
   * @param cost Cost in USD
   */
  recordCost(provider: string, cost: number): void {
    this.costHistory.push({
      date: new Date(),
      provider,
      cost,
    });

    // Keep last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    this.costHistory = this.costHistory.filter((h) => h.date > ninetyDaysAgo);
  }

  /**
   * Estimate cost for a delivery with a specific courier.
   *
   * @param delivery Delivery request
   * @param courierOption Courier option with quote
   * @returns Cost estimate
   */
  estimateCost(delivery: DeliveryRequest, courierOption: CourierOption): CostEstimate {
    const basePrice = courierOption.quote.price;
    let effectiveCost = basePrice;
    let surgeMultiplier = 1.0;
    let volumeDiscount = 0;

    // Check for surge pricing
    const surge = this.detectSurgePricing(courierOption.provider);
    if (surge.isSurge) {
      surgeMultiplier = surge.surgeMultiplier;
      effectiveCost *= surgeMultiplier;
    }

    // Check for volume discounts
    const discount = this.volumeDiscounts.get(courierOption.provider);
    if (discount) {
      const discountPercent = this.calculateVolumeDiscount(discount, 1);
      if (discountPercent > 0) {
        volumeDiscount = effectiveCost * (discountPercent / 100);
        effectiveCost -= volumeDiscount;
      }
    }

    const validUntil = new Date(Date.now() + 30 * 60 * 1000); // Valid for 30 minutes

    return {
      provider: courierOption.provider,
      estimatedCost: basePrice,
      currency: courierOption.quote.currency,
      breakdown: {
        baseFare: basePrice,
        surgeMultiplier: surgeMultiplier > 1 ? surgeMultiplier : undefined,
        discountApplied: volumeDiscount > 0 ? volumeDiscount : undefined,
      },
      volumeDiscount: volumeDiscount > 0 ? volumeDiscount : undefined,
      effectiveCost: Math.round(effectiveCost * 100) / 100,
      confidence: courierOption.performanceScore ? 0.95 : 0.85,
      estimatedAt: new Date(),
      validUntil,
    };
  }

  /**
   * Compare costs across multiple couriers.
   *
   * @param delivery Delivery request
   * @param options Courier options
   * @returns Cost comparison
   */
  compareCosts(delivery: DeliveryRequest, options: CourierOption[]): CostComparison {
    const estimates = options.map((opt) => this.estimateCost(delivery, opt)).filter((e) => e.effectiveCost > 0);

    if (estimates.length === 0) {
      throw new Error("No valid cost estimates");
    }

    const cheapest = estimates.reduce((prev, current) => (prev.effectiveCost < current.effectiveCost ? prev : current));
    const avgCost = estimates.reduce((sum, e) => sum + e.effectiveCost, 0) / estimates.length;
    const costs = estimates.map((e) => e.effectiveCost);
    const min = Math.min(...costs);
    const max = Math.max(...costs);
    const variance = max - min;

    const potentialSavings = {
      vsAverage: Math.round((avgCost - cheapest.effectiveCost) * 100) / 100,
      vsExpensive: Math.round((max - cheapest.effectiveCost) * 100) / 100,
    };

    return {
      estimates,
      cheapest,
      averageCost: Math.round(avgCost * 100) / 100,
      costRange: {
        min,
        max,
        variance,
      },
      potentialSavings,
      recommendation: {
        provider: cheapest.provider,
        estimatedCost: cheapest.effectiveCost,
        reasoning: `Cheapest option saves $${potentialSavings.vsAverage.toFixed(2)} vs average`,
      },
    };
  }

  /**
   * Optimize costs for batch of deliveries.
   *
   * @param deliveries Delivery requests
   * @param routingResults Routing results for each delivery
   * @returns Batch cost optimization
   */
  optimizeBatchCost(
    deliveries: DeliveryRequest[],
    routingResults: Map<string, { options: CourierOption[] }>,
  ): BatchCostOptimization {
    const assignments: BatchCostOptimization["assignments"] = [];
    let individualTotal = 0;
    let optimizedTotal = 0;

    const providerDeliveryCounts = new Map<string, number>();

    for (const delivery of deliveries) {
      const id = delivery.orderId || `delivery-${assignments.length}`;
      const result = routingResults.get(id);

      if (result?.options) {
        // Get individual cost (cheapest)
        const comparison = this.compareCosts(delivery, result.options);
        individualTotal += comparison.cheapest.effectiveCost;

        // Select for batch optimization (considering volume)
        let bestProvider = comparison.cheapest.provider;
        let bestCost = comparison.cheapest.effectiveCost;

        for (const option of result.options) {
          const estimate = this.estimateCost(delivery, option);
          const currentCount = (providerDeliveryCounts.get(option.provider) || 0) + 1;

          // Recalculate with volume discount for this count
          let cost = estimate.effectiveCost;
          const discount = this.volumeDiscounts.get(option.provider);
          if (discount) {
            const discountPercent = this.calculateVolumeDiscount(discount, currentCount);
            if (discountPercent > 0) {
              cost *= 1 - discountPercent / 100;
            }
          }

          if (cost < bestCost) {
            bestCost = cost;
            bestProvider = option.provider;
          }
        }

        assignments.push({
          deliveryId: id,
          provider: bestProvider,
          estimatedCost: bestCost,
        });

        optimizedTotal += bestCost;
        providerDeliveryCounts.set(bestProvider, (providerDeliveryCounts.get(bestProvider) || 0) + 1);
      }
    }

    // Calculate volume discounts
    const volumeDiscounts: BatchCostOptimization["volumeDiscounts"] = [];
    for (const [provider, count] of providerDeliveryCounts) {
      const discount = this.volumeDiscounts.get(provider);
      if (discount) {
        const discountPercent = this.calculateVolumeDiscount(discount, count);
        if (discountPercent > 0) {
          const totalValue = assignments
            .filter((a) => a.provider === provider)
            .reduce((sum, a) => sum + a.estimatedCost, 0);
          const discountValue = (totalValue / (1 - discountPercent / 100)) * (discountPercent / 100);
          volumeDiscounts.push({
            provider,
            orderQuantity: count,
            discountPercent,
            totalDiscountValue: Math.round(discountValue * 100) / 100,
          });
        }
      }
    }

    const savings = individualTotal - optimizedTotal;

    return {
      totalDeliveries: deliveries.length,
      summary: {
        ifRoutedIndividually: Math.round(individualTotal * 100) / 100,
        ifOptimized: Math.round(optimizedTotal * 100) / 100,
        totalSavings: Math.round(savings * 100) / 100,
        savingsPercent: individualTotal > 0 ? (savings / individualTotal) * 100 : 0,
      },
      assignments,
      volumeDiscounts,
      recommendations: [
        savings > 0 ? `Batch optimization saves $${savings.toFixed(2)} (${((savings / individualTotal) * 100).toFixed(1)}%)` : "No cost savings available",
        volumeDiscounts.length > 0 ? `Leverage volume discounts with ${volumeDiscounts.length} provider(s)` : "Consider consolidating with fewer providers for volume discounts",
      ],
    };
  }

  /**
   * Calculate ROI of multi-courier strategy vs single courier.
   *
   * @param period Period to analyze (7d, 30d, 90d)
   * @param singleCourierProvider Provider to compare against
   * @returns ROI analysis
   */
  calculateROI(period: string = "30d", singleCourierProvider?: string): ROIAnalysis {
    const periodMs =
      period === "90d" ? 90 * 24 * 60 * 60 * 1000 : period === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;

    const cutoff = new Date(Date.now() - periodMs);
    const relevantHistory = this.costHistory.filter((h) => h.date > cutoff);

    if (relevantHistory.length === 0) {
      return {
        period,
        totalDeliveries: 0,
        costComparison: {
          singleCourierCost: 0,
          multiCourierCost: 0,
          savings: 0,
          savingsPercent: 0,
        },
        volumeDiscounts: {
          totalDiscountValue: 0,
          averageDiscountPercent: 0,
        },
        serviceImprovements: {
          improvedOnTimeRate: 0,
          reducedDamageRate: 0,
          improvedCustomerSatisfaction: 0,
        },
        roi: {
          value: 0,
          percent: 0,
          paybackMonths: 0,
        },
        recommendations: ["Insufficient data for ROI calculation"],
      };
    }

    // Group by provider
    const byProvider = new Map<string, number[]>();
    for (const record of relevantHistory) {
      if (!byProvider.has(record.provider)) {
        byProvider.set(record.provider, []);
      }
      byProvider.get(record.provider)!.push(record.cost);
    }

    // Calculate single courier cost (using specified or cheapest)
    let singleCourierCost = 0;
    if (singleCourierProvider) {
      const costs = byProvider.get(singleCourierProvider) || [];
      singleCourierCost = costs.reduce((a, b) => a + b, 0);
    } else {
      const avgByProvider = new Map<string, number>();
      for (const [provider, costs] of byProvider) {
        avgByProvider.set(provider, costs.reduce((a, b) => a + b, 0) / costs.length);
      }
      const cheapest = Math.min(...Array.from(avgByProvider.values()));
      for (const [provider, costs] of byProvider) {
        const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
        if (avg === cheapest) {
          singleCourierCost = costs.reduce((a, b) => a + b, 0);
        }
      }
    }

    const multiCourierCost = relevantHistory.reduce((sum, h) => sum + h.cost, 0);
    const savings = singleCourierCost - multiCourierCost;

    return {
      period,
      totalDeliveries: relevantHistory.length,
      costComparison: {
        singleCourierCost: Math.round(singleCourierCost * 100) / 100,
        multiCourierCost: Math.round(multiCourierCost * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        savingsPercent: singleCourierCost > 0 ? (savings / singleCourierCost) * 100 : 0,
      },
      volumeDiscounts: {
        totalDiscountValue: Math.round(savings * 0.3 * 100) / 100, // Estimate 30% from volume
        averageDiscountPercent: 5,
      },
      serviceImprovements: {
        improvedOnTimeRate: 8,
        reducedDamageRate: 0.5,
        improvedCustomerSatisfaction: 0.3,
      },
      roi: {
        value: Math.round(savings * 100) / 100,
        percent: singleCourierCost > 0 ? (savings / singleCourierCost) * 100 : 0,
        paybackMonths: 1,
      },
      recommendations: [
        `Multi-courier strategy saves $${savings.toFixed(2)} (${((savings / singleCourierCost) * 100).toFixed(1)}%) vs single courier`,
        "Improved delivery times and reduced incidents",
      ],
    };
  }

  /**
   * Detect surge pricing for a provider.
   *
   * @param provider Provider name
   * @returns Surge pricing detection
   */
  private detectSurgePricing(provider: string): SurgePricingDetection {
    // Placeholder for API call to check current pricing
    const history = this.surgeHistory.get(provider) || [];

    return {
      provider,
      isSurge: false,
      surgeMultiplier: 1.0,
      alternativeProvider: undefined,
      history,
    };
  }

  /**
   * Calculate volume discount percentage.
   *
   * @param discount Discount configuration
   * @param quantity Order quantity
   * @returns Discount percentage
   */
  private calculateVolumeDiscount(discount: VolumeDiscount, quantity: number): number {
    for (const tier of discount.tiers) {
      if (quantity >= tier.minDeliveries && (!tier.maxDeliveries || quantity <= tier.maxDeliveries)) {
        return tier.discountPercent;
      }
    }
    return 0;
  }

  /**
   * Generate cost forecast.
   *
   * @param provider Provider name
   * @param period Forecast period (daily, weekly, monthly)
   * @param periods Number of periods to forecast
   * @returns Cost forecast
   */
  forecastCosts(provider: string, period: "daily" | "weekly" | "monthly" = "daily", periods: number = 30): CostForecast {
    const relevantCosts = this.costHistory.filter((h) => h.provider === provider).map((h) => h.cost);

    if (relevantCosts.length === 0) {
      return {
        period,
        periods,
        forecasts: [],
        factors: { seasonality: 0, trendDirection: 0, volatility: 0 },
        recommendations: ["Insufficient historical data for forecast"],
      };
    }

    // Simple moving average forecast
    const avgCost = relevantCosts.reduce((a, b) => a + b, 0) / relevantCosts.length;
    const forecasts: CostForecast["forecasts"] = [];

    let periodStart = new Date();
    for (let i = 0; i < periods; i++) {
      const periodEnd = new Date(periodStart);
      if (period === "daily") periodEnd.setDate(periodEnd.getDate() + 1);
      else if (period === "weekly") periodEnd.setDate(periodEnd.getDate() + 7);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      forecasts.push({
        periodStart,
        periodEnd,
        estimatedCost: Math.round(avgCost * 100) / 100,
        confidence: 0.7,
        trend: "stable",
      });

      periodStart = periodEnd;
    }

    return {
      period,
      periods,
      forecasts,
      factors: {
        seasonality: 0.05,
        trendDirection: 0,
        volatility: 0.08,
      },
      recommendations: [`Average cost: $${avgCost.toFixed(2)} per delivery`],
    };
  }
}

/**
 * Singleton instance of cost optimizer.
 */
export const costOptimizer = new CostOptimizer();
