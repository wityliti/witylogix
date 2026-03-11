/**
 * Weather Impact ETA Model
 *
 * Predicts additional delivery delay based on weather conditions.
 * Learns coefficients per weather type from historical data.
 * Models interaction effects (e.g., rain + rush hour = extra delay).
 */

import type {
  FeatureVector,
  HistoricalDelivery,
  ModelPrediction,
  WeatherModelState,
} from '../types.js';

interface WeatherCoefficient {
  base_delay_minutes: number;
  intensity_coefficient: number; // Additional delay per intensity unit
  interaction_factors: Record<string, number>;
  sample_count: number;
  confidence: number;
}

export class WeatherModel {
  private conditionCoefficients: Map<string, WeatherCoefficient>;
  private interactionEffects: Map<string, number>;

  constructor() {
    this.conditionCoefficients = new Map();
    this.interactionEffects = new Map();
    this.initializeDefaults();
  }

  /**
   * Initialize with reasonable defaults for weather types
   */
  private initializeDefaults(): void {
    // Clear weather: minimal impact
    this.conditionCoefficients.set('clear', {
      base_delay_minutes: 0,
      intensity_coefficient: 0,
      interaction_factors: {},
      sample_count: 0,
      confidence: 0.5,
    });

    // Fog: moderate impact, reduces visibility
    this.conditionCoefficients.set('fog', {
      base_delay_minutes: 2,
      intensity_coefficient: 1.5,
      interaction_factors: {},
      sample_count: 0,
      confidence: 0.4,
    });

    // Rain: significant impact, speed reduction
    this.conditionCoefficients.set('rain', {
      base_delay_minutes: 4,
      intensity_coefficient: 2.5,
      interaction_factors: {
        'rush-hour': 3.0, // Rain during rush hour = extra delay
        'urban-area': 2.0, // More impact in cities
      },
      sample_count: 0,
      confidence: 0.5,
    });

    // Snow: severe impact
    this.conditionCoefficients.set('snow', {
      base_delay_minutes: 8,
      intensity_coefficient: 4.0,
      interaction_factors: {
        'rush-hour': 5.0,
        'urban-area': 3.0,
        'temperature-below-freezing': 2.0,
      },
      sample_count: 0,
      confidence: 0.6,
    });

    // Default interaction effects
    this.interactionEffects.set('rain-rush-hour', 3.0);
    this.interactionEffects.set('snow-rush-hour', 5.0);
    this.interactionEffects.set('rain-urban', 2.0);
    this.interactionEffects.set('snow-urban', 3.0);
  }

  /**
   * Check if it's rush hour
   */
  private isRushHour(hour: number): boolean {
    return (hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 19);
  }

  /**
   * Train model on historical deliveries
   */
  fit(historicalDeliveries: HistoricalDelivery[]): void {
    // Group deliveries by weather condition
    const weatherGroups: Map<string, HistoricalDelivery[]> = new Map();

    for (const delivery of historicalDeliveries) {
      const condition = delivery.weather_condition;
      if (!weatherGroups.has(condition)) {
        weatherGroups.set(condition, []);
      }
      weatherGroups.get(condition)!.push(delivery);
    }

    // Analyze each weather condition
    for (const [condition, deliveries] of weatherGroups.entries()) {
      if (deliveries.length < 5) continue; // Need minimum samples

      // Separate by intensity
      const byIntensity: Map<number, number[]> = new Map();

      for (const delivery of deliveries) {
        const intensity = Math.round(delivery.weather_intensity * 10) / 10;
        if (!byIntensity.has(intensity)) {
          byIntensity.set(intensity, []);
        }
        byIntensity.get(intensity)!.push(delivery.actual_duration_minutes);
      }

      // Fit linear regression: delay = base + intensity_coeff * intensity
      const intensities: number[] = [];
      const delays: number[] = [];

      for (const [intensity, times] of byIntensity.entries()) {
        const meanTime = times.reduce((a, b) => a + b, 0) / times.length;
        intensities.push(intensity);
        delays.push(meanTime);
      }

      if (intensities.length >= 2) {
        const coeff = this.linearRegression(intensities, delays);

        const existing = this.conditionCoefficients.get(condition) || {
          base_delay_minutes: 0,
          intensity_coefficient: 0,
          interaction_factors: {},
          sample_count: 0,
          confidence: 0,
        };

        existing.base_delay_minutes = Math.max(0, coeff.intercept);
        existing.intensity_coefficient = Math.max(0, coeff.slope);
        existing.sample_count = deliveries.length;
        existing.confidence = Math.min(0.95, 0.4 + Math.log(deliveries.length + 1) / 10);

        this.conditionCoefficients.set(condition, existing);
      }

      // Analyze interaction effects
      this.analyzeInteractions(deliveries, condition);
    }
  }

  /**
   * Linear regression: y = intercept + slope * x
   */
  private linearRegression(x: number[], y: number[]): { intercept: number; slope: number } {
    const n = x.length;
    if (n < 2) return { intercept: y[0] || 0, slope: 0 };

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += (x[i] - meanX) * (x[i] - meanX);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    return { intercept, slope };
  }

  /**
   * Analyze interaction effects (e.g., rain + rush hour)
   */
  private analyzeInteractions(deliveries: HistoricalDelivery[], condition: string): void {
    // Split by rush hour
    const rushHourTimes: number[] = [];
    const nonRushTimes: number[] = [];

    for (const delivery of deliveries) {
      if (this.isRushHour(delivery.hour)) {
        rushHourTimes.push(delivery.actual_duration_minutes);
      } else {
        nonRushTimes.push(delivery.actual_duration_minutes);
      }
    }

    if (rushHourTimes.length > 0 && nonRushTimes.length > 0) {
      const rushMean = rushHourTimes.reduce((a, b) => a + b, 0) / rushHourTimes.length;
      const nonRushMean = nonRushTimes.reduce((a, b) => a + b, 0) / nonRushTimes.length;

      const interactionDelay = rushMean - nonRushMean;
      this.interactionEffects.set(`${condition}-rush-hour`, Math.max(0, interactionDelay));
    }

    // Split by urban/non-urban
    const urbanTimes: number[] = [];
    const nonUrbanTimes: number[] = [];

    for (const delivery of deliveries) {
      if (delivery.zone_type === 'urban' || delivery.zone_type === 'urban-core') {
        urbanTimes.push(delivery.actual_duration_minutes);
      } else {
        nonUrbanTimes.push(delivery.actual_duration_minutes);
      }
    }

    if (urbanTimes.length > 0 && nonUrbanTimes.length > 0) {
      const urbanMean = urbanTimes.reduce((a, b) => a + b, 0) / urbanTimes.length;
      const nonUrbanMean = nonUrbanTimes.reduce((a, b) => a + b, 0) / nonUrbanTimes.length;

      const interactionDelay = urbanMean - nonUrbanMean;
      this.interactionEffects.set(`${condition}-urban`, Math.max(0, interactionDelay));
    }
  }

  /**
   * Predict weather-related delay
   */
  predict(features: FeatureVector): ModelPrediction {
    const condition = features.weather_condition;
    const intensity = features.weather_intensity;
    const hour = features.hour;
    const zoneType = features.zone_type;

    // Get base delay for condition
    const coeff = this.conditionCoefficients.get(condition);
    let delayMinutes = 0;
    let confidence = 0.3;

    if (coeff) {
      // Base delay + intensity-dependent delay
      delayMinutes = coeff.base_delay_minutes + coeff.intensity_coefficient * intensity;
      confidence = coeff.confidence;

      // Apply interaction effects
      if (this.isRushHour(hour)) {
        const rushHourFactor = this.interactionEffects.get(`${condition}-rush-hour`) || 0;
        delayMinutes += rushHourFactor;
      }

      if (zoneType === 'urban' || zoneType === 'urban-core') {
        const urbanFactor = this.interactionEffects.get(`${condition}-urban`) || 0;
        delayMinutes += urbanFactor;
      }
    }

    // Clamp and round
    delayMinutes = Math.max(0, Math.min(30, delayMinutes));

    // Assume a base delivery time that would come from another model
    const baseTime = features.historical_avg_minutes || 30;
    const predictedDuration = baseTime + delayMinutes;

    // Uncertainty in prediction
    const errorMargin = Math.max(3, delayMinutes * 0.5);

    return {
      modelName: 'weather-impact',
      predicted_duration_minutes: Math.round(predictedDuration * 10) / 10,
      confidence,
      lower_bound_minutes: Math.max(5, Math.round((predictedDuration - errorMargin) * 10) / 10),
      upper_bound_minutes: Math.round((predictedDuration + errorMargin) * 10) / 10,
    };
  }

  /**
   * Get state for serialization
   */
  getState(): WeatherModelState {
    return {
      condition_coefficients: Object.fromEntries(this.conditionCoefficients.entries()),
      intensity_curve: Object.fromEntries(
        Array.from(this.conditionCoefficients.entries()).map(([condition, coeff]) => [
          condition,
          [coeff.base_delay_minutes, coeff.intensity_coefficient],
        ]),
      ),
      interaction_effects: Object.fromEntries(this.interactionEffects.entries()),
    };
  }

  /**
   * Restore state from serialization
   */
  setState(state: WeatherModelState): void {
    this.conditionCoefficients.clear();

    for (const [condition, coeff] of Object.entries(state.condition_coefficients)) {
      this.conditionCoefficients.set(condition, coeff as WeatherCoefficient);
    }

    this.interactionEffects.clear();
    for (const [key, value] of Object.entries(state.interaction_effects)) {
      this.interactionEffects.set(key, value);
    }
  }

  /**
   * Get feature importance for this model
   */
  getFeatureImportance(): Record<string, number> {
    return {
      weather_condition: 1.0,
      weather_intensity: 0.95,
      hour: 0.6,
      zone_type: 0.5,
      temperature_celsius: 0.4,
      precipitation_mm: 0.7,
    };
  }
}
