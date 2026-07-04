/**
 * Historical Route Model
 *
 * Looks up similar past deliveries and uses weighted average
 * of their actual delivery times.
 *
 * Similarity criteria:
 * - Same zone type
 * - Same day of week
 * - Same hour range (±2 hours)
 * - Similar distance (±20%)
 *
 * Returns percentile-based confidence intervals.
 */

import type {
  TimeInterval,
  HistoricalRoute,
  ModelPrediction,
} from "../types.js";

export class HistoricalModel {
  /**
   * Historical data
   */
  private historicalData: HistoricalRoute[] = [];

  constructor(historicalData?: HistoricalRoute[]) {
    if (historicalData) {
      this.historicalData = historicalData;
    }
  }

  /**
   * Add data
   */
  addData(data: HistoricalRoute[]): void {
    this.historicalData.push(...data);
  }

  /**
   * Predict ETA based on similar historical routes
   */
  predict(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    distanceKm: number,
    zoneType: "urban" | "suburban" | "rural",
    departureTime: Date,
    dayOfWeek: number,
  ): ModelPrediction {
    // Find similar historical routes
    const similarRoutes = this.findSimilarRoutes(
      distanceKm,
      zoneType,
      dayOfWeek,
      departureTime.getHours(),
    );

    if (similarRoutes.length === 0) {
      // Fallback to simple estimate
      return this.getFallbackPrediction(distanceKm, departureTime);
    }

    // Get actual durations for similar routes
    const durations = similarRoutes.map(
      (r) => (r.actualArrival.getTime() - r.departureTime.getTime()) / 60000,
    );

    // Sort durations for percentile calculation
    durations.sort((a, b) => a - b);

    // Calculate percentiles
    const p50 = this.percentile(durations, 50);
    const p10 = this.percentile(durations, 10);
    const p90 = this.percentile(durations, 90);

    const confidence = Math.min(Math.sqrt(similarRoutes.length) / 10, 1.0);

    return {
      modelName: "HistoricalModel",
      prediction: {
        low: new Date(departureTime.getTime() + p10 * 60000),
        expected: new Date(departureTime.getTime() + p50 * 60000),
        high: new Date(departureTime.getTime() + p90 * 60000),
      },
      confidence,
      errorMetrics: {
        mae: this.calculateMAE(durations, p50),
        rmse: this.calculateRMSE(durations, p50),
        mape: this.calculateMAPE(durations, p50),
      },
    };
  }

  /**
   * Find similar historical routes
   */
  private findSimilarRoutes(
    distanceKm: number,
    zoneType: string,
    dayOfWeek: number,
    hour: number,
  ): HistoricalRoute[] {
    return this.historicalData.filter((route) => {
      // Must be successful
      if (!route.success) return false;

      // Same zone type
      if (route.zoneType !== zoneType) return false;

      // Same day of week (or adjacent days)
      if (Math.abs(route.dayOfWeek - dayOfWeek) > 1) return false;

      // Similar hour (±2 hours)
      if (Math.abs(route.hourOfDay - hour) > 2) return false;

      // Similar distance (±20%)
      const distanceDiff = Math.abs(route.distanceKm - distanceKm);
      if (distanceDiff > distanceKm * 0.2) return false;

      return true;
    });
  }

  /**
   * Fallback prediction when no similar routes found
   */
  private getFallbackPrediction(
    distanceKm: number,
    departureTime: Date,
  ): ModelPrediction {
    // Simple heuristic: 5 min base + 2 min per km
    const expectedMinutes = 5 + distanceKm * 2;
    const stdDev = expectedMinutes * 0.2;

    return {
      modelName: "HistoricalModel (Fallback)",
      prediction: {
        low: new Date(
          departureTime.getTime() + (expectedMinutes - stdDev * 1.96) * 60000,
        ),
        expected: new Date(departureTime.getTime() + expectedMinutes * 60000),
        high: new Date(
          departureTime.getTime() + (expectedMinutes + stdDev * 1.96) * 60000,
        ),
      },
      confidence: 0.3,
      errorMetrics: {
        mae: stdDev / 0.6745,
        rmse: stdDev * 1.25,
        mape: (stdDev / expectedMinutes) * 100,
      },
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    if (arr.length === 1) return arr[0]!;

    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return arr[lower]!;
    }

    return arr[lower]! * (1 - weight) + arr[upper]! * weight;
  }

  /**
   * Calculate Mean Absolute Error
   */
  private calculateMAE(actual: number[], predicted: number): number {
    if (actual.length === 0) return 0;

    const sum = actual.reduce((acc, val) => {
      return acc + Math.abs(val - predicted);
    }, 0);

    return sum / actual.length;
  }

  /**
   * Calculate Root Mean Square Error
   */
  private calculateRMSE(actual: number[], predicted: number): number {
    if (actual.length === 0) return 0;

    const sum = actual.reduce((acc, val) => {
      const error = val - predicted;
      return acc + error * error;
    }, 0);

    return Math.sqrt(sum / actual.length);
  }

  /**
   * Calculate Mean Absolute Percentage Error
   */
  private calculateMAPE(actual: number[], predicted: number): number {
    if (actual.length === 0 || predicted === 0) return 0;

    const sum = actual.reduce((acc, val) => {
      if (val === 0) return acc;
      return acc + Math.abs((val - predicted) / val);
    }, 0);

    return (sum / actual.length) * 100;
  }

  /**
   * Get data statistics for debugging
   */
  getStatistics(): {
    totalRoutes: number;
    successfulRoutes: number;
    averageDuration: number;
    zoneTypeCounts: Record<string, number>;
  } {
    const successful = this.historicalData.filter((r) => r.success);

    const avgDuration =
      successful.length > 0
        ? successful.reduce(
            (sum, r) =>
              sum +
              (r.actualArrival.getTime() - r.departureTime.getTime()) / 60000,
            0,
          ) / successful.length
        : 0;

    const zoneTypeCounts: Record<string, number> = {};
    successful.forEach((r) => {
      zoneTypeCounts[r.zoneType] = (zoneTypeCounts[r.zoneType] ?? 0) + 1;
    });

    return {
      totalRoutes: this.historicalData.length,
      successfulRoutes: successful.length,
      averageDuration: avgDuration,
      zoneTypeCounts,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.historicalData = [];
  }
}

/**
 * Singleton instance
 */
export const historicalModel = new HistoricalModel();
