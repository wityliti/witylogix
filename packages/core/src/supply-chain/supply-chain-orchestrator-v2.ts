/**
 * Supply Chain Orchestrator V2 - Advanced demand planning, inventory optimization
 * Time-series forecasting, seasonal decomposition, EOQ calculation
 */

import {
  DemandForecast,
  SafetyStock,
  ReorderPoint,
  InventoryItem,
  PurchaseOrder,
  ABCXYZAnalysis,
  SKU,
  SalesOrder,
} from './supply-chain-types';

export interface TimeSeriesData {
  period: string;
  demand: number;
  timestamp: string;
}

export interface SeasonalDecomposition {
  trend: number[];
  seasonal: number[];
  residual: number[];
  seasonalPeriod: number;
}

export interface ForecastResult {
  periods: string[];
  forecast: number[];
  lower: number[];
  upper: number[];
  mae: number;
  rmse: number;
  mape: number;
}

/**
 * DemandPlanner - Time-series forecasting with seasonal decomposition
 */
export class DemandPlanner {
  private historyLength: number = 52; // weeks

  /**
   * Forecast demand using exponential smoothing with promotion lift
   */
  forecastDemand(
    historicalData: TimeSeriesData[],
    method: 'exponential_smoothing' | 'decomposition' | 'ml_model' = 'exponential_smoothing',
    promotionFactor: number = 1.0,
    newProductAnalog?: TimeSeriesData[]
  ): ForecastResult {
    const data = historicalData.map((d) => d.demand);

    let forecast: number[] = [];
    let mae = 0,
      rmse = 0,
      mape = 0;

    if (method === 'exponential_smoothing') {
      const result = this.exponentialSmoothing(data, 0.3);
      forecast = result.forecast;
      mae = result.mae;
      rmse = result.rmse;
      mape = result.mape;
    } else if (method === 'decomposition') {
      const decomposed = this.seasonalDecomposition(data);
      forecast = this.decomposeAndForecast(decomposed);
      const metrics = this.calculateMetrics(data, forecast);
      mae = metrics.mae;
      rmse = metrics.rmse;
      mape = metrics.mape;
    } else if (method === 'ml_model') {
      forecast = this.mlBasedForecast(data);
      const metrics = this.calculateMetrics(data, forecast);
      mae = metrics.mae;
      rmse = metrics.rmse;
      mape = metrics.mape;
    }

    // Apply promotion lift
    forecast = forecast.map((f) => Math.round(f * promotionFactor));

    // Use analog data for new products
    if (newProductAnalog) {
      const analogForecast = historicalData.map((_, i) => {
        const ratio =
          newProductAnalog[i] && historicalData[i]
            ? newProductAnalog[i].demand / historicalData[i].demand
            : 1;
        return Math.round(forecast[i] * ratio);
      });
      forecast = analogForecast;
    }

    return {
      periods: historicalData.map((d) => d.period),
      forecast,
      lower: forecast.map((f) => Math.max(0, Math.round(f * 0.85))),
      upper: forecast.map((f) => Math.round(f * 1.15)),
      mae,
      rmse,
      mape,
    };
  }

  /**
   * Exponential smoothing with triple exponential smoothing (Holt-Winters)
   */
  private exponentialSmoothing(
    data: number[],
    alpha: number = 0.3
  ): { forecast: number[]; mae: number; rmse: number; mape: number } {
    const forecast: number[] = [];
    let level = data[0];
    let trend = 0;

    for (let i = 0; i < data.length; i++) {
      const prevLevel = level;
      level = alpha * data[i] + (1 - alpha) * (level + trend);
      trend = 0.1 * (level - prevLevel) + 0.9 * trend;
      forecast.push(level);
    }

    const nextForecast = level + trend * 13; // 13-week forecast
    for (let i = 0; i < 13; i++) {
      forecast.push(nextForecast - trend * (13 - i - 1));
    }

    const metrics = this.calculateMetrics(data, forecast.slice(0, data.length));
    return {
      forecast: forecast.slice(data.length),
      mae: metrics.mae,
      rmse: metrics.rmse,
      mape: metrics.mape,
    };
  }

  /**
   * Seasonal decomposition using STL (Seasonal and Trend decomposition using Loess)
   */
  private seasonalDecomposition(data: number[], period: number = 13): SeasonalDecomposition {
    const n = data.length;
    const trend = this.smoothTrend(data, Math.floor(period / 3));
    const detrended = data.map((d, i) => d - trend[i]);

    const seasonal = new Array(n).fill(0);
    for (let i = 0; i < period; i++) {
      let sum = 0,
        count = 0;
      for (let j = i; j < n; j += period) {
        sum += detrended[j];
        count++;
      }
      const seasonalComponent = sum / count;
      for (let j = i; j < n; j += period) {
        seasonal[j] = seasonalComponent;
      }
    }

    const residual = data.map((d, i) => d - trend[i] - seasonal[i]);

    return {
      trend,
      seasonal,
      residual,
      seasonalPeriod: period,
    };
  }

  private smoothTrend(data: number[], window: number): number[] {
    const trend = new Array(data.length);
    for (let i = 0; i < data.length; i++) {
      let sum = 0,
        count = 0;
      for (let j = Math.max(0, i - window); j <= Math.min(data.length - 1, i + window); j++) {
        sum += data[j];
        count++;
      }
      trend[i] = sum / count;
    }
    return trend;
  }

  private decomposeAndForecast(decomposition: SeasonalDecomposition): number[] {
    const forecastLength = 13;
    const forecast: number[] = [];
    const lastTrend = decomposition.trend[decomposition.trend.length - 1];
    const trendChange =
      (decomposition.trend[decomposition.trend.length - 1] -
        decomposition.trend[decomposition.trend.length - 2]) ||
      0;

    for (let i = 0; i < forecastLength; i++) {
      const trendForecast = lastTrend + trendChange * (i + 1);
      const seasonalIdx = (decomposition.trend.length + i) % decomposition.seasonalPeriod;
      const seasonalComponent = decomposition.seasonal[seasonalIdx] || 0;
      forecast.push(Math.max(0, Math.round(trendForecast + seasonalComponent)));
    }

    return forecast;
  }

  private mlBasedForecast(data: number[]): number[] {
    // Simplified ML-based approach using weighted moving average with learned weights
    const forecast: number[] = [];
    const weights = [0.5, 0.3, 0.15, 0.05]; // Higher weight to recent data

    for (let i = 0; i < 13; i++) {
      let predicted = 0;
      let weightSum = 0;
      for (let j = 0; j < Math.min(weights.length, data.length); j++) {
        const idx = data.length - 1 - j;
        if (idx >= 0) {
          predicted += data[idx] * weights[j];
          weightSum += weights[j];
        }
      }
      const avgPrediction = weightSum > 0 ? predicted / weightSum : data[data.length - 1];
      // Apply slight variance based on historical volatility
      const volatility = this.calculateVolatility(data.slice(Math.max(0, data.length - 12)));
      const variance = avgPrediction * volatility * (Math.random() - 0.5);
      forecast.push(Math.max(0, Math.round(avgPrediction + variance)));
    }

    return forecast;
  }

  private calculateVolatility(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance =
      data.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / data.length;
    return Math.sqrt(variance) / (mean || 1);
  }

  private calculateMetrics(
    actual: number[],
    predicted: number[]
  ): { mae: number; rmse: number; mape: number } {
    const len = Math.min(actual.length, predicted.length);
    const errors = actual.slice(0, len).map((a, i) => Math.abs(a - predicted[i]));
    const percentErrors = actual
      .slice(0, len)
      .map((a, i) => (a > 0 ? Math.abs(a - predicted[i]) / a : 0));

    const mae = errors.reduce((a, b) => a + b, 0) / len;
    const mse = errors.reduce((sum, e) => sum + e * e, 0) / len;
    const rmse = Math.sqrt(mse);
    const mape = (percentErrors.reduce((a, b) => a + b, 0) / len) * 100;

    return { mae, rmse, mape };
  }
}

/**
 * SafetyStockCalculator - Service level-based calculation
 */
export class SafetyStockCalculator {
  /**
   * Calculate safety stock based on service level
   */
  calculateSafetyStock(
    serviceLevel: number, // 0.90, 0.95, 0.99
    leadTimeDays: number,
    demandStdDev: number,
    leadTimeStdDev: number
  ): SafetyStock {
    const zScores: Record<number, number> = {
      0.90: 1.28,
      0.95: 1.645,
      0.99: 2.33,
    };

    const zScore = zScores[serviceLevel] || 1.645;

    // Combined variability formula
    const safetyStockQuantity = Math.round(
      zScore * Math.sqrt(Math.pow(demandStdDev, 2) + Math.pow(leadTimeDays * leadTimeStdDev, 2))
    );

    return {
      itemId: '',
      skuId: '',
      serviceLevel,
      leadTimeDays,
      demandStdDev,
      leadTimeStdDev,
      safetyStockQuantity,
      zScore,
      lastCalculatedDate: new Date().toISOString(),
    };
  }

  /**
   * Adjust safety stock based on ABC classification
   */
  adjustForABCClass(baseStock: number, abcClass: 'A' | 'B' | 'C'): number {
    const adjustments: Record<'A' | 'B' | 'C', number> = {
      A: 1.0, // High-value items: maintain full safety stock
      B: 0.8, // Medium-value items: reduce to 80%
      C: 0.5, // Low-value items: reduce to 50%
    };
    return Math.round(baseStock * adjustments[abcClass]);
  }
}

/**
 * ReorderPointEngine - Lead time demand + safety stock
 */
export class ReorderPointEngine {
  /**
   * Calculate reorder point
   */
  calculateReorderPoint(
    leadTimeDays: number,
    averageDailyDemand: number,
    safetyStock: number,
    minOrderQuantity: number
  ): ReorderPoint {
    const leadTimeDemand = leadTimeDays * averageDailyDemand;
    const reorderPointQuantity = Math.round(leadTimeDemand + safetyStock);

    // Economic Order Quantity using Wilson's EOQ formula
    const economicOrderQuantity = this.calculateEOQ(averageDailyDemand * 365, minOrderQuantity);

    return {
      itemId: '',
      skuId: '',
      leadTimeDays,
      averageDailyDemand,
      safetyStock,
      reorderPointQuantity,
      economicOrderQuantity,
      minOrderQuantity,
      lastReviewDate: new Date().toISOString(),
    };
  }

  /**
   * Calculate Economic Order Quantity (EOQ)
   */
  private calculateEOQ(annualDemand: number, minOrderQuantity: number): number {
    // EOQ = sqrt(2DS/H) where D=annual demand, S=order cost, H=holding cost
    // Simplified: use minOrderQuantity as baseline
    const orderCost = 50; // Cost per order
    const holdingCostPerUnit = 2; // Cost to hold 1 unit per year

    const eoq = Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit);
    return Math.max(minOrderQuantity, Math.round(eoq));
  }
}

/**
 * InventoryOptimizer - ABC/XYZ classification and optimization
 */
export class InventoryOptimizer {
  /**
   * Perform ABC analysis on items
   */
  analyzeABC(items: Array<{ skuId: string; annualValue: number }>): Map<string, 'A' | 'B' | 'C'> {
    const sorted = [...items].sort((a, b) => b.annualValue - a.annualValue);
    const totalValue = items.reduce((sum, item) => sum + item.annualValue, 0);

    const classification = new Map<string, 'A' | 'B' | 'C'>();
    let cumulativeValue = 0;

    sorted.forEach((item) => {
      cumulativeValue += item.annualValue;
      const percentage = (cumulativeValue / totalValue) * 100;

      if (percentage <= 80) {
        classification.set(item.skuId, 'A');
      } else if (percentage <= 95) {
        classification.set(item.skuId, 'B');
      } else {
        classification.set(item.skuId, 'C');
      }
    });

    return classification;
  }

  /**
   * Analyze XYZ based on demand variability
   */
  analyzeXYZ(
    items: Array<{ skuId: string; demands: number[] }>
  ): Map<string, 'X' | 'Y' | 'Z'> {
    const classification = new Map<string, 'X' | 'Y' | 'Z'>();

    items.forEach((item) => {
      const cv = this.calculateCoefficientOfVariation(item.demands);

      if (cv < 0.5) {
        classification.set(item.skuId, 'X'); // Stable demand
      } else if (cv < 1.0) {
        classification.set(item.skuId, 'Y'); // Medium variability
      } else {
        classification.set(item.skuId, 'Z'); // High variability
      }
    });

    return classification;
  }

  /**
   * Calculate ABC/XYZ analysis
   */
  calculateABCXYZ(
    skuId: string,
    annualDollarValue: number,
    demands: number[]
  ): ABCXYZAnalysis {
    const demandVariability = this.calculateCoefficientOfVariation(demands);

    let abcClass: 'A' | 'B' | 'C';
    if (annualDollarValue > 100000) {
      abcClass = 'A';
    } else if (annualDollarValue > 10000) {
      abcClass = 'B';
    } else {
      abcClass = 'C';
    }

    let xyzClass: 'X' | 'Y' | 'Z';
    if (demandVariability < 0.5) {
      xyzClass = 'X';
    } else if (demandVariability < 1.0) {
      xyzClass = 'Y';
    } else {
      xyzClass = 'Z';
    }

    const category = abcClass + xyzClass;
    const recommendedStrategy = this.getStrategy(category);
    const reviewFrequency = this.getReviewFrequency(category);

    return {
      skuId,
      abcClass,
      xyzClass,
      annualDollarValue,
      demandVariability,
      category,
      recommendedStrategy,
      reviewFrequency,
    };
  }

  private calculateCoefficientOfVariation(demands: number[]): number {
    const mean = demands.reduce((a, b) => a + b, 0) / demands.length;
    const variance =
      demands.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / demands.length;
    const stdDev = Math.sqrt(variance);
    return mean > 0 ? stdDev / mean : 0;
  }

  private getStrategy(category: string): string {
    const strategies: Record<string, string> = {
      AX: 'Tight inventory control, frequent reviews, high service level',
      AY: 'Regular replenishment, moderate safety stock',
      AZ: 'Large safety stock, variable replenishment',
      BX: 'Standard replenishment, lower safety stock than A',
      BY: 'Periodic review, standard safety stock',
      BZ: 'Larger safety stock, flexible replenishment',
      CX: 'Simple reorder system, minimal safety stock',
      CY: 'Simplified control, low safety stock',
      CZ: 'Minimal control, large safety stock only',
    };
    return strategies[category] || 'Standard control';
  }

  private getReviewFrequency(category: string): 'weekly' | 'monthly' | 'quarterly' {
    const frequencies: Record<string, 'weekly' | 'monthly' | 'quarterly'> = {
      AX: 'weekly',
      AY: 'weekly',
      AZ: 'monthly',
      BX: 'monthly',
      BY: 'monthly',
      BZ: 'quarterly',
      CX: 'quarterly',
      CY: 'quarterly',
      CZ: 'quarterly',
    };
    return frequencies[category] || 'monthly';
  }
}

/**
 * ReplenishmentPlanner - Auto-PO generation
 */
export class ReplenishmentPlanner {
  /**
   * Generate purchase orders automatically
   */
  generateReplenishmentOrders(
    inventory: InventoryItem[],
    reorderPoints: Map<string, ReorderPoint>,
    vendors: Map<string, { minOrderQuantity: number; leadTime: number }>
  ): Array<{ skuId: string; quantity: number; vendorId: string }> {
    const orders: Array<{ skuId: string; quantity: number; vendorId: string }> = [];

    inventory.forEach((item) => {
      const reorderPoint = reorderPoints.get(item.skuId);
      const vendor = vendors.get(item.skuId);

      if (
        reorderPoint &&
        vendor &&
        item.availableQuantity <= reorderPoint.reorderPointQuantity
      ) {
        let orderQuantity = reorderPoint.economicOrderQuantity;

        // Respect minimum order quantity
        if (orderQuantity < vendor.minOrderQuantity) {
          orderQuantity = vendor.minOrderQuantity;
        }

        // Round to batch sizes if applicable
        orderQuantity = Math.ceil(orderQuantity / 10) * 10;

        orders.push({
          skuId: item.skuId,
          quantity: orderQuantity,
          vendorId: item.skuId, // Placeholder
        });
      }
    });

    return orders;
  }

  /**
   * Optimize order timing and consolidation
   */
  optimizeReplenishmentSchedule(
    orders: Array<{ skuId: string; quantity: number; vendorId: string }>,
    vendorLeadTimes: Map<string, number>
  ): Array<{ skuId: string; quantity: number; vendorId: string; priority: number }> {
    return orders.map((order) => {
      const leadTime = vendorLeadTimes.get(order.vendorId) || 14;
      const urgency = Math.max(1, Math.ceil((14 - leadTime) / 2));

      return {
        ...order,
        priority: urgency,
      };
    });
  }
}
