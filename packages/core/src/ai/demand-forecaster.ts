/**
 * Demand Forecaster
 *
 * Predicts demand per SKU using:
 * - TimeSeriesAnalyzer: detect trends, seasonality, and anomalies
 * - SeasonalDecomposer: extract seasonal patterns (weekly, monthly, yearly)
 * - TrendDetector: linear trend with slope and acceleration
 * - DemandPredictor: combine trend + seasonality + external factors
 * - ConfidenceInterval: prediction with confidence bands
 * - External factors: holidays, promotions, weather, day-of-week
 * - SKU clustering: group similar SKUs for better prediction with short history
 * - ReorderSuggestion: suggest reorder quantity and timing based on lead time + safety stock
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface SalesDataPoint {
  date: Date;
  quantity: number;
  revenue?: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  isHoliday?: boolean;
  isPromotion?: boolean;
  temperature?: number; // Celsius, for weather-dependent products
  isWeekend: boolean;
}

export interface SeasonalPattern {
  weeklyPattern: Map<number, number>; // dayOfWeek -> seasonal multiplier
  monthlyPattern: Map<number, number>; // dayOfMonth -> seasonal multiplier
  yearlyPattern: Map<number, number>; // month (1-12) -> seasonal multiplier
  weeklyStrength: number; // 0-1, how strong weekly seasonality is
  monthlyStrength: number; // 0-1
  yearlyStrength: number; // 0-1
}

export interface TrendInfo {
  slope: number; // units per day
  acceleration: number; // units per day^2
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: number; // 0-1, how confident the trend is
}

export interface DemandForecast {
  skuId: string;
  forecastedDemand: number;
  confidence: number; // 0-1
  confidenceInterval: {
    lower: number; // P5
    upper: number; // P95
  };
  trend: TrendInfo;
  seasonalInfluence: number; // 0-1, how much seasonality affects forecast
  forecastedDate: Date;
  bases: {
    baseline: number;
    trendAdjustment: number;
    seasonalAdjustment: number;
    externalAdjustment: number;
  };
}

export interface SKUCluster {
  clusterId: string;
  skuIds: string[];
  representativeSKU: string;
  clusterName: string;
  properties: {
    avgPrice: number;
    category: string;
    seasonalityPattern: string; // 'none', 'weekly', 'monthly', 'yearly'
  };
}

export interface ReorderSuggestion {
  skuId: string;
  currentStock: number;
  suggestedReorderQuantity: number;
  reorderPoint: number; // min stock before reorder
  safetyStock: number; // buffer stock
  recommendedReorderDate: Date;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  daysUntilStockout: number;
  leadTimeInDays: number;
}

export interface ExternalFactor {
  date: Date;
  type: 'holiday' | 'promotion' | 'weather_event' | 'supply_disruption';
  impactMultiplier: number; // demand multiplier
  duration?: number; // days
  confidence?: number; // 0-1, how confident this will affect demand
}

// ─── TIME SERIES ANALYZER ───────────────────────────────────────────────────

export class TimeSeriesAnalyzer {
  /**
   * Detect anomalies in historical data using mean absolute deviation.
   * Returns list of anomalous data point indices.
   */
  detectAnomalies(data: SalesDataPoint[], threshold: number = 2): number[] {
    if (data.length < 3) return [];

    const quantities = data.map((d) => d.quantity);
    const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    const deviations = quantities.map((q) => Math.abs(q - mean));
    const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)];

    const anomalies: number[] = [];
    for (let i = 0; i < quantities.length; i++) {
      if (Math.abs(quantities[i] - mean) > threshold * mad) {
        anomalies.push(i);
      }
    }

    return anomalies;
  }

  /**
   * Get clean data (without anomalies) for trend/seasonal analysis.
   */
  getCleanData(data: SalesDataPoint[]): SalesDataPoint[] {
    const anomalyIndices = this.detectAnomalies(data);
    const anomalySet = new Set(anomalyIndices);
    return data.filter((_, i) => !anomalySet.has(i));
  }
}

// ─── SEASONAL DECOMPOSER ────────────────────────────────────────────────────

export class SeasonalDecomposer {
  /**
   * Extract seasonal pattern from historical data.
   * Identifies weekly, monthly, and yearly cycles.
   */
  extractSeasonality(data: SalesDataPoint[]): SeasonalPattern {
    if (data.length < 7) {
      return {
        weeklyPattern: new Map(),
        monthlyPattern: new Map(),
        yearlyPattern: new Map(),
        weeklyStrength: 0,
        monthlyStrength: 0,
        yearlyStrength: 0,
      };
    }

    // Calculate average demand by day of week
    const weeklyMap = new Map<number, number[]>();
    const monthlyMap = new Map<number, number[]>();
    const yearlyMap = new Map<number, number[]>();

    for (const point of data) {
      const dow = point.dayOfWeek;
      const dom = point.date.getDate();
      const month = point.date.getMonth() + 1;

      if (!weeklyMap.has(dow)) weeklyMap.set(dow, []);
      weeklyMap.get(dow)!.push(point.quantity);

      if (!monthlyMap.has(dom)) monthlyMap.set(dom, []);
      monthlyMap.get(dom)!.push(point.quantity);

      if (!yearlyMap.has(month)) yearlyMap.set(month, []);
      yearlyMap.get(month)!.push(point.quantity);
    }

    // Calculate averages and multipliers
    const meanQty = data.reduce((a, b) => a + b.quantity, 0) / data.length;

    const weeklyPattern = new Map<number, number>();
    for (const [dow, values] of weeklyMap) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      weeklyPattern.set(dow, meanQty > 0 ? avg / meanQty : 1);
    }

    const monthlyPattern = new Map<number, number>();
    for (const [dom, values] of monthlyMap) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      monthlyPattern.set(dom, meanQty > 0 ? avg / meanQty : 1);
    }

    const yearlyPattern = new Map<number, number>();
    for (const [month, values] of yearlyMap) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      yearlyPattern.set(month, meanQty > 0 ? avg / meanQty : 1);
    }

    // Calculate strength of each pattern (variance from 1.0)
    const weeklyStrength = this.calculatePatternStrength(Array.from(weeklyPattern.values()));
    const monthlyStrength = this.calculatePatternStrength(Array.from(monthlyPattern.values()));
    const yearlyStrength = this.calculatePatternStrength(Array.from(yearlyPattern.values()));

    return {
      weeklyPattern,
      monthlyPattern,
      yearlyPattern,
      weeklyStrength,
      monthlyStrength,
      yearlyStrength,
    };
  }

  /**
   * Calculate how strong a seasonal pattern is (0-1).
   */
  private calculatePatternStrength(multipliers: number[]): number {
    if (multipliers.length === 0) return 0;

    const mean = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
    const variance = multipliers.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / multipliers.length;
    const stdDev = Math.sqrt(variance);

    // Strength is proportional to coefficient of variation
    return Math.min(1, stdDev / Math.max(mean, 0.1));
  }
}

// ─── TREND DETECTOR ─────────────────────────────────────────────────────────

export class TrendDetector {
  /**
   * Detect linear trend using simple linear regression.
   */
  detectTrend(data: SalesDataPoint[]): TrendInfo {
    if (data.length < 2) {
      return {
        slope: 0,
        acceleration: 0,
        direction: 'stable',
        strength: 0,
      };
    }

    // Linear regression: find best-fit line
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i].quantity;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Calculate acceleration by comparing first and second halves
    const mid = Math.floor(n / 2);
    const firstHalf = data.slice(0, mid);
    const secondHalf = data.slice(mid);

    const firstAvg = firstHalf.reduce((a, b) => a + b.quantity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b.quantity, 0) / secondHalf.length;
    const acceleration = (secondAvg - firstAvg) / (firstHalf.length + 1);

    // Calculate trend strength (R-squared)
    const meanY = sumY / n;
    let ssRes = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const predicted = slope * i + (meanY - (slope * sumX) / n);
      const actual = data[i].quantity;
      ssRes += Math.pow(actual - predicted, 2);
      ssTot += Math.pow(actual - meanY, 2);
    }

    const strength = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return {
      slope,
      acceleration,
      direction: slope > 5 ? 'increasing' : slope < -5 ? 'decreasing' : 'stable',
      strength: Math.max(0, Math.min(1, strength)),
    };
  }
}

// ─── SKU CLUSTERING ─────────────────────────────────────────────────────────

export class SKUClusterer {
  /**
   * Group similar SKUs based on historical patterns.
   * Useful for short-history SKUs to leverage similar products' data.
   */
  clusterSKUs(
    skuDataMap: Map<string, SalesDataPoint[]>,
    skuProperties: Map<string, { price: number; category: string }>
  ): SKUCluster[] {
    const clusters: SKUCluster[] = [];
    const used = new Set<string>();
    const decomposer = new SeasonalDecomposer();

    // Group by category first
    const byCategory = new Map<string, string[]>();
    for (const [skuId, props] of skuProperties) {
      if (!byCategory.has(props.category)) {
        byCategory.set(props.category, []);
      }
      byCategory.get(props.category)!.push(skuId);
    }

    // Within each category, create clusters
    let clusterId = 0;
    for (const [category, skus] of byCategory) {
      // Create sub-clusters within category based on price range
      const priceRanges = new Map<string, string[]>();

      for (const skuId of skus) {
        if (used.has(skuId)) continue;

        const price = skuProperties.get(skuId)?.price ?? 0;
        const priceRange = this.getPriceRange(price);

        if (!priceRanges.has(priceRange)) {
          priceRanges.set(priceRange, []);
        }
        priceRanges.get(priceRange)!.push(skuId);
      }

      for (const [priceRange, clusterSkus] of priceRanges) {
        const representative = clusterSkus[0];
        const repData = skuDataMap.get(representative) ?? [];
        const seasonality = decomposer.extractSeasonality(repData);

        let seasonalityType = 'none';
        if (seasonality.weeklyStrength > 0.2) seasonalityType = 'weekly';
        if (seasonality.monthlyStrength > seasonality.weeklyStrength) seasonalityType = 'monthly';
        if (seasonality.yearlyStrength > seasonality.monthlyStrength) seasonalityType = 'yearly';

        clusters.push({
          clusterId: `cluster_${clusterId++}`,
          skuIds: clusterSkus,
          representativeSKU: representative,
          clusterName: `${category}_${priceRange}`,
          properties: {
            avgPrice: clusterSkus.reduce((sum, skuId) => sum + (skuProperties.get(skuId)?.price ?? 0), 0) / clusterSkus.length,
            category,
            seasonalityPattern: seasonalityType,
          },
        });

        clusterSkus.forEach((id) => used.add(id));
      }
    }

    return clusters;
  }

  private getPriceRange(price: number): string {
    if (price < 10) return 'budget';
    if (price < 50) return 'mid';
    if (price < 200) return 'premium';
    return 'luxury';
  }
}

// ─── DEMAND PREDICTOR ───────────────────────────────────────────────────────

export class DemandPredictor {
  private analyzer: TimeSeriesAnalyzer;
  private decomposer: SeasonalDecomposer;
  private trendDetector: TrendDetector;

  constructor() {
    this.analyzer = new TimeSeriesAnalyzer();
    this.decomposer = new SeasonalDecomposer();
    this.trendDetector = new TrendDetector();
  }

  /**
   * Predict demand for a future date.
   */
  predictDemand(
    skuId: string,
    historicalData: SalesDataPoint[],
    forecastDate: Date,
    externalFactors: ExternalFactor[] = []
  ): DemandForecast {
    if (historicalData.length === 0) {
      return {
        skuId,
        forecastedDemand: 0,
        confidence: 0,
        confidenceInterval: { lower: 0, upper: 0 },
        trend: { slope: 0, acceleration: 0, direction: 'stable', strength: 0 },
        seasonalInfluence: 0,
        forecastedDate: forecastDate,
        bases: {
          baseline: 0,
          trendAdjustment: 0,
          seasonalAdjustment: 0,
          externalAdjustment: 0,
        },
      };
    }

    // Get clean data for analysis
    const cleanData = this.analyzer.getCleanData(historicalData);
    if (cleanData.length < 2) cleanData.push(...historicalData);

    // Calculate baseline (mean demand)
    const baseline = cleanData.reduce((a, b) => a + b.quantity, 0) / cleanData.length;

    // Detect trend
    const trend = this.trendDetector.detectTrend(cleanData);
    const daysSinceLastData = (forecastDate.getTime() - cleanData[cleanData.length - 1].date.getTime()) / (1000 * 60 * 60 * 24);
    const trendAdjustment = trend.slope * daysSinceLastData;

    // Extract seasonality
    const seasonality = this.decomposer.extractSeasonality(cleanData);
    const dow = forecastDate.getDay();
    const dom = forecastDate.getDate();
    const month = forecastDate.getMonth() + 1;

    let seasonalMultiplier = 1;
    if (seasonality.weeklyStrength > 0.1 && seasonality.weeklyPattern.has(dow)) {
      seasonalMultiplier *= seasonality.weeklyPattern.get(dow)!;
    }
    if (seasonality.monthlyStrength > 0.1 && seasonality.monthlyPattern.has(dom)) {
      seasonalMultiplier *= seasonality.monthlyPattern.get(dom)!;
    }
    if (seasonality.yearlyStrength > 0.1 && seasonality.yearlyPattern.has(month)) {
      seasonalMultiplier *= seasonality.yearlyPattern.get(month)!;
    }

    const seasonalAdjustment = (seasonalMultiplier - 1) * baseline;
    const maxSeasonalInfluence = Math.max(seasonality.weeklyStrength, seasonality.monthlyStrength, seasonality.yearlyStrength);

    // Apply external factors
    let externalAdjustment = 0;
    for (const factor of externalFactors) {
      const factorDate = new Date(factor.date);
      const daysUntil = (forecastDate.getTime() - factorDate.getTime()) / (1000 * 60 * 60 * 24);
      const duration = factor.duration ?? 1;

      // Only apply if factor is relevant to forecast date
      if (daysUntil >= 0 && daysUntil < duration && (factor.confidence ?? 1) > 0.5) {
        externalAdjustment += (factor.impactMultiplier - 1) * baseline * (factor.confidence ?? 1);
      }
    }

    // Combine all factors
    const forecast = baseline + trendAdjustment + seasonalAdjustment + externalAdjustment;

    // Calculate confidence based on data recency and trend strength
    const daysInHistory = (cleanData[cleanData.length - 1].date.getTime() - cleanData[0].date.getTime()) / (1000 * 60 * 60 * 24) + 1;
    const recencyFactor = Math.max(0, 1 - daysSinceLastData / daysInHistory);
    const confidence = (0.5 + 0.5 * (trend.strength * 0.5 + recencyFactor * 0.5)) * Math.max(0.3, 1 - externalFactors.length * 0.1);

    // Calculate confidence interval (95% band around forecast)
    const stdDev = Math.sqrt(cleanData.reduce((sum, d) => sum + Math.pow(d.quantity - baseline, 2), 0) / cleanData.length);
    const margin = 1.96 * stdDev * (1 - confidence);

    return {
      skuId,
      forecastedDemand: Math.max(0, Math.round(forecast)),
      confidence: Math.max(0, Math.min(1, confidence)),
      confidenceInterval: {
        lower: Math.max(0, Math.round(forecast - margin)),
        upper: Math.round(forecast + margin),
      },
      trend,
      seasonalInfluence: maxSeasonalInfluence,
      forecastedDate: forecastDate,
      bases: {
        baseline: Math.round(baseline),
        trendAdjustment: Math.round(trendAdjustment),
        seasonalAdjustment: Math.round(seasonalAdjustment),
        externalAdjustment: Math.round(externalAdjustment),
      },
    };
  }
}

// ─── REORDER SUGGESTER ──────────────────────────────────────────────────────

export class ReorderSuggester {
  /**
   * Suggest reorder quantity and timing based on demand forecast, lead time, and safety stock.
   */
  suggestReorder(
    skuId: string,
    currentStock: number,
    averageDailyDemand: number,
    leadTimeInDays: number,
    stockoutBuffer: number = 7 // days to prevent stockout
  ): ReorderSuggestion {
    // Calculate lead time demand
    const leadTimeDemand = averageDailyDemand * leadTimeInDays;

    // Safety stock = avg demand * (lead time + buffer) * std deviation factor
    const safetyStock = Math.ceil(averageDailyDemand * (leadTimeInDays + stockoutBuffer) * 0.3);

    // Reorder point = lead time demand + safety stock
    const reorderPoint = Math.ceil(leadTimeDemand + safetyStock);

    // Days until stockout (if we don't reorder)
    const daysUntilStockout = averageDailyDemand > 0 ? Math.floor(currentStock / averageDailyDemand) : 365;

    // Suggested reorder quantity (economic order quantity approximation)
    // Reorder enough to cover lead time + safety stock + some buffer
    const suggestedQuantity = Math.ceil(leadTimeDemand + safetyStock + averageDailyDemand * 7);

    // Urgency based on days until stockout
    let urgency: 'low' | 'normal' | 'high' | 'critical' = 'normal';
    if (daysUntilStockout < leadTimeInDays) {
      urgency = 'critical';
    } else if (daysUntilStockout < leadTimeInDays + 3) {
      urgency = 'high';
    } else if (daysUntilStockout < leadTimeInDays + 7) {
      urgency = 'normal';
    } else {
      urgency = 'low';
    }

    // Recommended reorder date (lead time before stockout)
    const recommendedDate = new Date();
    recommendedDate.setDate(recommendedDate.getDate() + Math.max(0, daysUntilStockout - leadTimeInDays));

    return {
      skuId,
      currentStock,
      suggestedReorderQuantity: suggestedQuantity,
      reorderPoint,
      safetyStock,
      recommendedReorderDate: recommendedDate,
      urgency,
      daysUntilStockout,
      leadTimeInDays,
    };
  }
}

// ─── FORECASTER SERVICE ─────────────────────────────────────────────────────

export class DemandForecasterService {
  private predictor: DemandPredictor;
  private reorderSuggester: ReorderSuggester;
  private clusterer: SKUClusterer;
  private externalFactors: ExternalFactor[] = [];

  constructor() {
    this.predictor = new DemandPredictor();
    this.reorderSuggester = new ReorderSuggester();
    this.clusterer = new SKUClusterer();
  }

  /**
   * Forecast demand for multiple days ahead.
   */
  forecastMultipleDays(
    skuId: string,
    historicalData: SalesDataPoint[],
    daysAhead: number = 30
  ): DemandForecast[] {
    const forecasts: DemandForecast[] = [];

    for (let i = 1; i <= daysAhead; i++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + i);

      const forecast = this.predictor.predictDemand(skuId, historicalData, forecastDate, this.externalFactors);
      forecasts.push(forecast);
    }

    return forecasts;
  }

  /**
   * Get reorder suggestions for SKU.
   */
  getReorderSuggestion(
    skuId: string,
    currentStock: number,
    historicalData: SalesDataPoint[],
    leadTimeInDays: number
  ): ReorderSuggestion {
    // Calculate average daily demand
    const avgDailyDemand = historicalData.length > 0
      ? historicalData.reduce((a, b) => a + b.quantity, 0) / historicalData.length
      : 0;

    return this.reorderSuggester.suggestReorder(skuId, currentStock, avgDailyDemand, leadTimeInDays);
  }

  /**
   * Add external factor that impacts demand.
   */
  addExternalFactor(factor: ExternalFactor): void {
    this.externalFactors.push(factor);
  }

  /**
   * Cluster SKUs for analysis.
   */
  clusterSKUs(
    skuDataMap: Map<string, SalesDataPoint[]>,
    skuProperties: Map<string, { price: number; category: string }>
  ): SKUCluster[] {
    return this.clusterer.clusterSKUs(skuDataMap, skuProperties);
  }

  /**
   * Get trend analysis for SKU.
   */
  getTrendAnalysis(skuId: string, historicalData: SalesDataPoint[]): TrendInfo {
    const detector = new TrendDetector();
    return detector.detectTrend(historicalData);
  }
}

/**
 * Factory function to create demand forecaster service.
 */
export function createDemandForecaster(): DemandForecasterService {
  return new DemandForecasterService();
}
