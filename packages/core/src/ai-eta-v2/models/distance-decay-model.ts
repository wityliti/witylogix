/**
 * Distance Decay ETA Model
 *
 * Learns non-linear relationship between distance and delivery time.
 * Uses piecewise regression for different distance ranges (short, medium, long).
 * Accounts for zone type (urban vs rural) and vehicle type.
 */

import type {
  FeatureVector,
  HistoricalDelivery,
  ModelPrediction,
  DistanceDecayModelState,
} from '../types.js';

const DISTANCE_RANGES = {
  SHORT_MAX: 5, // km
  MEDIUM_MAX: 20, // km
};

interface RegressionParams {
  intercept: number;
  slope: number;
  r_squared: number;
  sample_count: number;
}

export class DistanceDecayModel {
  private shortRangeParams: RegressionParams;
  private mediumRangeParams: RegressionParams;
  private longRangeParams: RegressionParams;
  private urbanMultiplier: number;
  private loadingUnloadingBaseline: number;

  constructor() {
    // Initialize with reasonable defaults
    // Short range: ~2 min per km + 5 min overhead
    this.shortRangeParams = {
      intercept: 5,
      slope: 2.0,
      r_squared: 0,
      sample_count: 0,
    };

    // Medium range: ~1.5 min per km + 8 min overhead
    this.mediumRangeParams = {
      intercept: 8,
      slope: 1.5,
      r_squared: 0,
      sample_count: 0,
    };

    // Long range: ~1.0 min per km + 10 min overhead
    this.longRangeParams = {
      intercept: 10,
      slope: 1.0,
      r_squared: 0,
      sample_count: 0,
    };

    this.urbanMultiplier = 1.2; // Urban deliveries typically slower
    this.loadingUnloadingBaseline = 3; // Base loading/unloading time
  }

  /**
   * Linear regression implementation
   */
  private linearRegression(
    distances: number[],
    times: number[],
  ): RegressionParams {
    const n = distances.length;
    if (n < 2) {
      return {
        intercept: 0,
        slope: 0,
        r_squared: 0,
        sample_count: 0,
      };
    }

    const meanX = distances.reduce((a, b) => a + b, 0) / n;
    const meanY = times.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    let ssRes = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const x = distances[i];
      const y = times[i];
      numerator += (x - meanX) * (y - meanY);
      denominator += (x - meanX) * (x - meanX);
      ssTot += (y - meanY) * (y - meanY);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    // Calculate predictions and residuals for R²
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * distances[i];
      ssRes += (times[i] - predicted) ** 2;
    }

    const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    return {
      intercept: Math.max(0, intercept),
      slope: Math.max(0.1, slope), // Ensure positive slope
      r_squared: Math.max(0, rSquared),
      sample_count: n,
    };
  }

  /**
   * Train model on historical deliveries
   */
  fit(historicalDeliveries: HistoricalDelivery[]): void {
    const shortRangeData = { distances: [] as number[], times: [] as number[] };
    const mediumRangeData = { distances: [] as number[], times: [] as number[] };
    const longRangeData = { distances: [] as number[], times: [] as number[] };

    let urbanCount = 0;
    let totalCount = 0;

    for (const delivery of historicalDeliveries) {
      const distance = delivery.distance_km;
      const time = delivery.actual_duration_minutes;

      if (distance <= DISTANCE_RANGES.SHORT_MAX) {
        shortRangeData.distances.push(distance);
        shortRangeData.times.push(time);
      } else if (distance <= DISTANCE_RANGES.MEDIUM_MAX) {
        mediumRangeData.distances.push(distance);
        mediumRangeData.times.push(time);
      } else {
        longRangeData.distances.push(distance);
        longRangeData.times.push(time);
      }

      if (delivery.zone_type === 'urban' || delivery.zone_type === 'urban-core') {
        urbanCount++;
      }
      totalCount++;
    }

    // Fit piecewise regression
    if (shortRangeData.distances.length > 0) {
      this.shortRangeParams = this.linearRegression(
        shortRangeData.distances,
        shortRangeData.times,
      );
    }

    if (mediumRangeData.distances.length > 0) {
      this.mediumRangeParams = this.linearRegression(
        mediumRangeData.distances,
        mediumRangeData.times,
      );
    }

    if (longRangeData.distances.length > 0) {
      this.longRangeParams = this.linearRegression(
        longRangeData.distances,
        longRangeData.times,
      );
    }

    // Update urban multiplier
    if (totalCount > 0) {
      const urbanRatio = urbanCount / totalCount;
      this.urbanMultiplier = 1.0 + urbanRatio * 0.3; // 1.0-1.3 range
    }
  }

  /**
   * Predict delivery time for given distance
   */
  predict(features: FeatureVector): ModelPrediction {
    const distance = features.distance_km;
    const zoneType = features.zone_type;
    const numStops = features.num_stops_remaining;

    let params: RegressionParams;

    // Select appropriate regression parameters based on distance
    if (distance <= DISTANCE_RANGES.SHORT_MAX) {
      params = this.shortRangeParams;
    } else if (distance <= DISTANCE_RANGES.MEDIUM_MAX) {
      params = this.mediumRangeParams;
    } else {
      params = this.longRangeParams;
    }

    // Base prediction from linear regression
    let predictedDuration = params.intercept + params.slope * distance;

    // Apply zone multiplier (urban areas slower due to traffic/parking)
    const zoneMultiplier =
      zoneType === 'urban-core'
        ? 1.3
        : zoneType === 'urban'
          ? 1.2
          : zoneType === 'suburban'
            ? 1.05
            : 0.95;

    predictedDuration *= zoneMultiplier;

    // Add time for stops (approximately 2 minutes per stop)
    const stopsTime = Math.max(0, numStops - 1) * 2;
    predictedDuration += stopsTime;

    // Add loading/unloading baseline
    predictedDuration += this.loadingUnloadingBaseline;

    // Estimate error bounds based on R² and model uncertainty
    const confidence = Math.min(0.9, 0.4 + params.r_squared);
    const errorMargin = predictedDuration * (1 - confidence) * 2;

    return {
      modelName: 'distance-decay',
      predicted_duration_minutes: Math.round(predictedDuration * 10) / 10,
      confidence,
      lower_bound_minutes: Math.max(5, Math.round((predictedDuration - errorMargin) * 10) / 10),
      upper_bound_minutes: Math.round((predictedDuration + errorMargin) * 10) / 10,
    };
  }

  /**
   * Get state for serialization
   */
  getState(): DistanceDecayModelState {
    return {
      short_range_slope: this.shortRangeParams.slope,
      medium_range_slope: this.mediumRangeParams.slope,
      long_range_slope: this.longRangeParams.slope,
      urban_multiplier: this.urbanMultiplier,
      loading_unloading_baseline: this.loadingUnloadingBaseline,
    };
  }

  /**
   * Restore state from serialization
   */
  setState(state: DistanceDecayModelState): void {
    this.shortRangeParams.slope = state.short_range_slope;
    this.mediumRangeParams.slope = state.medium_range_slope;
    this.longRangeParams.slope = state.long_range_slope;
    this.urbanMultiplier = state.urban_multiplier;
    this.loadingUnloadingBaseline = state.loading_unloading_baseline;
  }

  /**
   * Get feature importance for this model
   */
  getFeatureImportance(): Record<string, number> {
    return {
      distance_km: 1.0,
      zone_type: 0.8,
      num_stops_remaining: 0.6,
      vehicle_type: 0.3,
      weather_condition: 0.2,
    };
  }
}
