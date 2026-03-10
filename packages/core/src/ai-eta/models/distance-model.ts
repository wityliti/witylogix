/**
 * Distance-Based ETA Model
 *
 * Linear regression model: ETA = base_time + (distance * speed_factor)
 *
 * Speed factors vary by zone type:
 * - Urban: ~30 km/h
 * - Suburban: ~45 km/h
 * - Rural: ~60 km/h
 */

import type { TimeInterval, HistoricalRoute, ModelPrediction } from '../types.js';

/**
 * Linear regression result
 */
interface RegressionResult {
  intercept: number;
  slope: number;
  rSquared: number;
}

export class DistanceModel {
  /**
   * Historical data
   */
  private historicalData: HistoricalRoute[] = [];

  /**
   * Regression parameters by zone type
   */
  private regressionsByZone: Map<
    string,
    RegressionResult
  > = new Map();

  /**
   * Default zone speeds (km/h)
   */
  private readonly DEFAULT_SPEEDS = {
    urban: 30,
    suburban: 45,
    rural: 60,
  };

  constructor(historicalData?: HistoricalRoute[]) {
    if (historicalData) {
      this.historicalData = historicalData;
      this.trainModel();
    } else {
      this.initializeDefaults();
    }
  }

  /**
   * Add data and retrain
   */
  addData(data: HistoricalRoute[]): void {
    this.historicalData.push(...data);
    this.trainModel();
  }

  /**
   * Predict ETA based on distance and zone
   */
  predict(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    distanceKm: number,
    zoneType: 'urban' | 'suburban' | 'rural',
    departureTime: Date,
  ): ModelPrediction {
    const regression =
      this.regressionsByZone.get(zoneType) ||
      this.getDefaultRegression(zoneType);

    // ETA = intercept + (distance * slope)
    const expectedMinutes = regression.intercept + distanceKm * regression.slope;

    // Calculate confidence
    const dataPoints = this.historicalData.filter(
      (d) => d.zoneType === zoneType && d.success,
    ).length;
    let confidence = Math.min(dataPoints / 50, 1.0);

    // Adjust confidence by R-squared
    confidence *= regression.rSquared;

    // Estimate error: residual standard deviation
    const residuals = this.calculateResiduals(zoneType);
    const stdDev = Math.sqrt(
      residuals.reduce((sum, r) => sum + r * r, 0) /
        residuals.length,
    );

    return {
      modelName: 'DistanceModel',
      prediction: {
        low: new Date(
          departureTime.getTime() +
            (expectedMinutes - stdDev * 1.96) * 60000,
        ),
        expected: new Date(
          departureTime.getTime() + expectedMinutes * 60000,
        ),
        high: new Date(
          departureTime.getTime() +
            (expectedMinutes + stdDev * 1.96) * 60000,
        ),
      },
      confidence,
      errorMetrics: {
        mae: stdDev / 0.6745,
        rmse: stdDev * 1.25,
        mape: (stdDev / expectedMinutes) * 100,
      },
    };
  }

  /**
   * Train linear regression for each zone type
   */
  private trainModel(): void {
    if (this.historicalData.length === 0) {
      this.initializeDefaults();
      return;
    }

    // Group data by zone type
    const zoneData: Record<string, HistoricalRoute[]> = {
      urban: [],
      suburban: [],
      rural: [],
    };

    this.historicalData.forEach((route) => {
      if (route.success) {
        zoneData[route.zoneType].push(route);
      }
    });

    // Compute regression for each zone
    Object.entries(zoneData).forEach(([zoneType, routes]) => {
      if (routes.length < 3) {
        // Not enough data
        this.regressionsByZone.delete(zoneType);
        return;
      }

      const x = routes.map((r) => r.distanceKm);
      const y = routes.map(
        (r) =>
          (r.actualArrival.getTime() -
            r.departureTime.getTime()) /
          60000,
      );

      const regression = this.linearRegression(x, y);
      this.regressionsByZone.set(zoneType, regression);
    });

    // Fill missing zones with defaults
    ['urban', 'suburban', 'rural'].forEach((zone) => {
      if (!this.regressionsByZone.has(zone)) {
        this.regressionsByZone.set(
          zone,
          this.getDefaultRegression(zone as any),
        );
      }
    });
  }

  /**
   * Linear regression
   */
  private linearRegression(x: number[], y: number[]): RegressionResult {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i]!, 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const pred = intercept + slope * x[i]!;
      return sum + (yi - pred) ** 2;
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return { intercept, slope, rSquared };
  }

  /**
   * Get default regression for zone
   */
  private getDefaultRegression(zoneType: string): RegressionResult {
    const speed = this.DEFAULT_SPEEDS[zoneType as keyof typeof this.DEFAULT_SPEEDS] ?? 40;
    const slope = 60 / speed; // minutes per km

    return {
      intercept: 5, // 5 minute base
      slope,
      rSquared: 0.7, // Assume moderate fit
    };
  }

  /**
   * Initialize with defaults
   */
  private initializeDefaults(): void {
    this.regressionsByZone.clear();
    ['urban', 'suburban', 'rural'].forEach((zone) => {
      this.regressionsByZone.set(
        zone,
        this.getDefaultRegression(zone),
      );
    });
  }

  /**
   * Calculate residuals for a zone type
   */
  private calculateResiduals(zoneType: string): number[] {
    const zoneData = this.historicalData.filter(
      (d) => d.zoneType === zoneType && d.success,
    );

    if (zoneData.length === 0) {
      return [10]; // Default residual
    }

    const regression = this.regressionsByZone.get(zoneType);
    if (!regression) {
      return [10];
    }

    return zoneData.map((route) => {
      const predicted =
        regression.intercept + route.distanceKm * regression.slope;
      const actual =
        (route.actualArrival.getTime() -
          route.departureTime.getTime()) /
        60000;

      return actual - predicted;
    });
  }

  /**
   * Get speed for zone type
   */
  getSpeed(zoneType: string): number {
    const regression = this.regressionsByZone.get(zoneType);
    if (!regression) {
      return this.DEFAULT_SPEEDS[zoneType as keyof typeof this.DEFAULT_SPEEDS] ?? 45;
    }

    return 60 / regression.slope; // Convert slope to speed
  }

  /**
   * Calculate model accuracy
   */
  calculateAccuracy(): {
    meanAbsoluteError: number;
    rootMeanSquareError: number;
  } {
    if (this.historicalData.length === 0) {
      return { meanAbsoluteError: 0, rootMeanSquareError: 0 };
    }

    let sumAbsError = 0;
    let sumSquaredError = 0;
    let count = 0;

    this.historicalData.forEach((route) => {
      if (!route.success) return;

      const regression = this.regressionsByZone.get(route.zoneType);
      if (!regression) return;

      const predicted =
        regression.intercept + route.distanceKm * regression.slope;
      const actual =
        (route.actualArrival.getTime() -
          route.departureTime.getTime()) /
        60000;

      const error = Math.abs(predicted - actual);

      sumAbsError += error;
      sumSquaredError += error * error;
      count++;
    });

    return {
      meanAbsoluteError: sumAbsError / count,
      rootMeanSquareError: Math.sqrt(sumSquaredError / count),
    };
  }
}

/**
 * Singleton instance
 */
export const distanceModel = new DistanceModel();
