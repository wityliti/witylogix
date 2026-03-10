/**
 * Time-of-Day ETA Model
 *
 * Adjusts base ETA based on hour of day.
 * Accounts for rush hours, night deliveries, etc.
 *
 * Rush hour (7-9 AM, 5-7 PM): +40%
 * Off-peak night (10 PM - 6 AM): -20%
 * Regular hours: normal
 */

import type { TimeInterval, HistoricalRoute, ModelPrediction } from '../types.js';

export class TimeOfDayModel {
  /**
   * Historical data for learning patterns
   */
  private historicalData: HistoricalRoute[] = [];

  /**
   * Learned multipliers by hour
   */
  private multipliersByHour: Map<number, number> = new Map();

  /**
   * Default multipliers (fallback)
   */
  private readonly DEFAULT_MULTIPLIERS: Record<number, number> = {
    0: 0.85, // Midnight
    1: 0.85,
    2: 0.85,
    3: 0.85,
    4: 0.85,
    5: 0.85,
    6: 0.9,
    7: 1.4, // Morning rush
    8: 1.4,
    9: 1.15,
    10: 1.0,
    11: 1.0,
    12: 1.1, // Lunch
    13: 1.0,
    14: 1.0,
    15: 1.0,
    16: 1.05,
    17: 1.35, // Evening rush
    18: 1.35,
    19: 1.2,
    20: 1.0,
    21: 0.95,
    22: 0.9, // Night
    23: 0.85,
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
   * Add historical data and retrain
   */
  addData(data: HistoricalRoute[]): void {
    this.historicalData.push(...data);
    this.trainModel();
  }

  /**
   * Predict ETA for a departure time
   */
  predict(
    baseTimeMinutes: number,
    departureTime: Date,
  ): ModelPrediction {
    const hour = departureTime.getHours();
    const multiplier = this.multipliersByHour.get(hour) ?? 1.0;

    const expectedMinutes = baseTimeMinutes * multiplier;

    // Confidence increases with more data for this hour
    const dataPoints = this.historicalData.filter(
      (d) => d.hourOfDay === hour && d.success,
    ).length;
    const confidence = Math.min(dataPoints / 30, 1.0);

    // Confidence intervals: ±15% standard deviation
    const stdDev = expectedMinutes * 0.15;

    return {
      modelName: 'TimeOfDayModel',
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
        mae: stdDev / 0.6745, // Convert std dev to MAE
        rmse: stdDev * 1.25,
        mape: (stdDev / expectedMinutes) * 100,
      },
    };
  }

  /**
   * Train model from historical data
   */
  private trainModel(): void {
    if (this.historicalData.length === 0) {
      this.initializeDefaults();
      return;
    }

    // Calculate average duration for each hour
    const hourDurations: Map<number, number[]> = new Map();

    this.historicalData.forEach((route) => {
      if (!route.success) return;

      const hour = route.hourOfDay;
      const duration =
        (route.actualArrival.getTime() -
          route.departureTime.getTime()) /
        60000; // Convert to minutes

      if (!hourDurations.has(hour)) {
        hourDurations.set(hour, []);
      }
      hourDurations.get(hour)!.push(duration);
    });

    // Calculate multiplier for each hour
    this.multipliersByHour.clear();

    hourDurations.forEach((durations, hour) => {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const baselineHour = 12; // Noon as baseline

      const baselineDurations = hourDurations.get(baselineHour) || [];
      const baselineAvg =
        baselineDurations.reduce((a, b) => a + b, 0) /
          baselineDurations.length ||
        20;

      const multiplier = avgDuration / baselineAvg;

      // Clamp between 0.5x and 2x
      this.multipliersByHour.set(
        hour,
        Math.max(0.5, Math.min(multiplier, 2.0)),
      );
    });

    // Fill missing hours with defaults
    for (let hour = 0; hour < 24; hour++) {
      if (!this.multipliersByHour.has(hour)) {
        this.multipliersByHour.set(
          hour,
          this.DEFAULT_MULTIPLIERS[hour]!,
        );
      }
    }
  }

  /**
   * Initialize with default multipliers
   */
  private initializeDefaults(): void {
    this.multipliersByHour.clear();
    Object.entries(this.DEFAULT_MULTIPLIERS).forEach(([hour, mult]) => {
      this.multipliersByHour.set(parseInt(hour, 10), mult);
    });
  }

  /**
   * Get multiplier for a specific hour
   */
  getMultiplier(hour: number): number {
    return this.multipliersByHour.get(hour) ?? 1.0;
  }

  /**
   * Get all multipliers
   */
  getAllMultipliers(): Record<number, number> {
    const result: Record<number, number> = {};
    for (let hour = 0; hour < 24; hour++) {
      result[hour] = this.getMultiplier(hour);
    }
    return result;
  }

  /**
   * Get peak hours
   */
  getPeakHours(): number[] {
    const peakHours: number[] = [];
    const baselineMultiplier = 1.1; // 10% above baseline

    for (let hour = 0; hour < 24; hour++) {
      if (this.getMultiplier(hour) > baselineMultiplier) {
        peakHours.push(hour);
      }
    }

    return peakHours;
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

      const baseDuration = route.estimatedTimeMinutes;
      const multiplier = this.getMultiplier(route.hourOfDay);
      const predictedDuration = baseDuration * multiplier;

      const actualDuration =
        (route.actualArrival.getTime() -
          route.departureTime.getTime()) /
        60000;

      const error = Math.abs(predictedDuration - actualDuration);

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
export const timeOfDayModel = new TimeOfDayModel();
