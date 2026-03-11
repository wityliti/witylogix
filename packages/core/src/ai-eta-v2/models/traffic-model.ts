/**
 * Traffic-Aware ETA Model
 *
 * Predicts traffic delay factors using traffic zone classification and time-of-day.
 * Learns delay multipliers from planned vs actual data.
 * Integrates with external traffic data when available.
 */

import type {
  FeatureVector,
  HistoricalDelivery,
  ModelPrediction,
  TrafficModelState,
  CalibrationResult,
} from '../types.js';

interface TrafficZoneProfile {
  zone_id: string;
  zone_type: 'urban-core' | 'urban' | 'suburban' | 'rural' | 'highway';
  hourly_factors: number[]; // 24 hours
  confidence: number[];
  sample_count: number;
}

export class TrafficModel {
  private zoneProfiles: Map<string, TrafficZoneProfile>;
  private conditionMultipliers: Record<'light' | 'moderate' | 'heavy', number>;
  private calibrationHistory: CalibrationResult[];

  constructor() {
    this.zoneProfiles = new Map();
    this.calibrationHistory = [];

    // Default traffic condition multipliers
    this.conditionMultipliers = {
      light: 1.0,
      moderate: 1.3,
      heavy: 1.8,
    };

    // Initialize default zone profiles
    this.initializeDefaultZones();
  }

  /**
   * Initialize with reasonable defaults for zone types
   */
  private initializeDefaultZones(): void {
    const defaultZones = ['urban-core', 'urban', 'suburban', 'rural', 'highway'];

    for (const zone of defaultZones) {
      const profile: TrafficZoneProfile = {
        zone_id: zone,
        zone_type: zone as any,
        hourly_factors: [],
        confidence: [],
        sample_count: 0,
      };

      // Initialize hourly factors based on zone type
      for (let hour = 0; hour < 24; hour++) {
        let factor = 1.0;

        if (zone === 'urban-core') {
          // High congestion at peak hours
          if ((hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 19)) {
            factor = 1.7;
          } else if ((hour >= 11 && hour <= 15) || (hour >= 20 && hour <= 22)) {
            factor = 1.3;
          } else {
            factor = 1.05;
          }
        } else if (zone === 'urban') {
          if ((hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 19)) {
            factor = 1.5;
          } else if ((hour >= 11 && hour <= 15)) {
            factor = 1.15;
          } else {
            factor = 1.0;
          }
        } else if (zone === 'suburban') {
          if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
            factor = 1.25;
          } else {
            factor = 1.0;
          }
        } else if (zone === 'highway') {
          // Highways have less variation
          if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
            factor = 1.15;
          } else {
            factor = 1.0;
          }
        } else {
          // Rural: minimal traffic
          factor = 1.0;
        }

        profile.hourly_factors.push(factor);
        profile.confidence.push(0.3); // Low confidence initially
      }

      this.zoneProfiles.set(zone, profile);
    }
  }

  /**
   * Determine zone type from coordinates (simplified)
   */
  private determineZoneType(zoneType: FeatureVector['zone_type']): string {
    return zoneType;
  }

  /**
   * Train model on historical deliveries
   */
  fit(historicalDeliveries: HistoricalDelivery[]): void {
    // Group deliveries by zone and hour
    const zoneHourlyData: Map<string, Map<number, number[]>> = new Map();

    for (const delivery of historicalDeliveries) {
      const zone = this.determineZoneType(delivery.zone_type);
      const hour = delivery.hour;

      if (!zoneHourlyData.has(zone)) {
        zoneHourlyData.set(zone, new Map());
      }

      const hourlyMap = zoneHourlyData.get(zone)!;
      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, []);
      }

      // Calculate actual delay factor: actual_time / planned_time
      const plannedTime = delivery.planned_duration_minutes || 30;
      const delayFactor = Math.max(0.8, Math.min(3.0, delivery.actual_duration_minutes / plannedTime));

      hourlyMap.get(hour)!.push(delayFactor);
    }

    // Update profiles with computed delay factors
    for (const [zone, hourlyMap] of zoneHourlyData.entries()) {
      const profile = this.zoneProfiles.get(zone);
      if (!profile) continue;

      for (let hour = 0; hour < 24; hour++) {
        const delayFactors = hourlyMap.get(hour) || [];

        if (delayFactors.length > 0) {
          // Compute mean delay factor
          const meanDelay = delayFactors.reduce((a, b) => a + b, 0) / delayFactors.length;

          // Compute confidence from sample size
          const confidence = Math.min(0.95, 0.3 + Math.log(delayFactors.length + 1) / 10);

          profile.hourly_factors[hour] = meanDelay;
          profile.confidence[hour] = confidence;
          profile.sample_count = Math.max(profile.sample_count, delayFactors.length);
        }
      }
    }
  }

  /**
   * Predict traffic delay factor for given zone and time
   */
  predict(features: FeatureVector): ModelPrediction {
    const zone = this.determineZoneType(features.zone_type);
    const hour = features.hour;
    const trafficCondition = features.traffic_condition;

    // Get base delay factor from zone profile
    const profile = this.zoneProfiles.get(zone);
    let delayFactor = 1.0;
    let confidence = 0.4;

    if (profile) {
      delayFactor = profile.hourly_factors[hour] || 1.0;
      confidence = profile.confidence[hour] || 0.4;
    }

    // Apply traffic condition multiplier
    const conditionMultiplier = this.conditionMultipliers[trafficCondition];
    if (conditionMultiplier) {
      // Weighted blend: 70% zone-based, 30% condition-based
      delayFactor = delayFactor * 0.7 + conditionMultiplier * 0.3;
      confidence = confidence * 0.8 + 0.2; // Slight confidence boost from external data
    }

    // Smooth extreme values
    delayFactor = Math.max(0.8, Math.min(2.5, delayFactor));

    // Assume a base delivery time (this would come from another model in ensemble)
    const baseTime = features.historical_avg_minutes || 30;
    const predictedDuration = baseTime * delayFactor;

    // Confidence interval based on uncertainty
    const errorMargin = predictedDuration * (1 - confidence) * 1.5;

    return {
      modelName: 'traffic-aware',
      predicted_duration_minutes: Math.round(predictedDuration * 10) / 10,
      confidence,
      lower_bound_minutes: Math.max(5, Math.round((predictedDuration - errorMargin) * 10) / 10),
      upper_bound_minutes: Math.round((predictedDuration + errorMargin) * 10) / 10,
    };
  }

  /**
   * Get state for serialization
   */
  getState(): TrafficModelState {
    return {
      zone_delay_factors: Object.fromEntries(
        Array.from(this.zoneProfiles.entries()).map(([zone, profile]) => [
          zone,
          Object.fromEntries(
            profile.hourly_factors.map((factor, hour) => [hour, factor]),
          ),
        ]),
      ),
      condition_multipliers: this.conditionMultipliers,
      calibration: this.calibrationHistory,
    };
  }

  /**
   * Restore state from serialization
   */
  setState(state: TrafficModelState): void {
    for (const [zone, hourlyFactors] of Object.entries(state.zone_delay_factors)) {
      const profile = this.zoneProfiles.get(zone);
      if (profile) {
        for (const [hourStr, factor] of Object.entries(hourlyFactors)) {
          const hour = parseInt(hourStr, 10);
          profile.hourly_factors[hour] = factor as number;
        }
      }
    }

    Object.assign(this.conditionMultipliers, state.condition_multipliers);
    this.calibrationHistory = state.calibration || [];
  }

  /**
   * Update condition multipliers based on observed data
   */
  updateConditionMultipliers(
    observations: Array<{ condition: 'light' | 'moderate' | 'heavy'; actualMultiplier: number }>,
  ): void {
    const groupedByCondition: Record<'light' | 'moderate' | 'heavy', number[]> = {
      light: [],
      moderate: [],
      heavy: [],
    };

    for (const obs of observations) {
      groupedByCondition[obs.condition].push(obs.actualMultiplier);
    }

    // Update multipliers with exponential moving average
    const alpha = 0.1; // Learning rate
    for (const condition of ['light', 'moderate', 'heavy'] as const) {
      const values = groupedByCondition[condition];
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        this.conditionMultipliers[condition] =
          this.conditionMultipliers[condition] * (1 - alpha) + mean * alpha;
      }
    }
  }

  /**
   * Calibrate model predictions against actuals
   */
  calibrate(predictions: number[], actuals: number[]): CalibrationResult {
    if (predictions.length !== actuals.length || predictions.length === 0) {
      return {
        model_name: 'traffic-aware',
        bias_correction_factor: 1.0,
        scale_correction_factor: 1.0,
        confidence_calibration: {},
        applied_at: new Date(),
      };
    }

    // Compute mean prediction and actual
    const meanPred = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const meanActual = actuals.reduce((a, b) => a + b, 0) / actuals.length;

    // Compute scale factor (regression slope)
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < predictions.length; i++) {
      const predDiff = predictions[i] - meanPred;
      const actualDiff = actuals[i] - meanActual;
      numerator += actualDiff * predDiff;
      denominator += predDiff * predDiff;
    }

    const scaleFactor = denominator !== 0 ? numerator / denominator : 1.0;
    const biasFactor = meanActual / (meanPred || 1);

    const result: CalibrationResult = {
      model_name: 'traffic-aware',
      bias_correction_factor: biasFactor,
      scale_correction_factor: scaleFactor,
      confidence_calibration: {},
      applied_at: new Date(),
    };

    this.calibrationHistory.push(result);

    // Keep only recent calibrations
    if (this.calibrationHistory.length > 100) {
      this.calibrationHistory = this.calibrationHistory.slice(-50);
    }

    return result;
  }

  /**
   * Get feature importance for this model
   */
  getFeatureImportance(): Record<string, number> {
    return {
      zone_type: 1.0,
      hour: 0.9,
      traffic_condition: 0.85,
      traffic_multiplier: 0.8,
      day_of_week: 0.5,
    };
  }
}
