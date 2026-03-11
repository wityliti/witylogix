/**
 * Time-of-Day ETA Model
 *
 * Learns delivery time patterns by hour of day using Gaussian kernel smoothing.
 * Captures rush hour effects and variations by weekday/weekend/holiday.
 * Uses seasonal adjustments for weather-related time variations.
 */

import type {
  FeatureVector,
  HistoricalDelivery,
  ModelPrediction,
  TimeOfDayModelState,
} from '../types.js';

interface HourlyProfile {
  baseline_minutes: number;
  std_dev: number;
  weekday_multiplier: number;
  weekend_multiplier: number;
  holiday_multiplier: number;
  sample_count: number;
}

export class TimeOfDayModel {
  private hourlyProfiles: Map<number, HourlyProfile>;
  private seasonFactors: Map<string, number>;

  constructor() {
    this.hourlyProfiles = new Map();
    this.seasonFactors = new Map();
    this.initializeDefaultProfiles();
  }

  /**
   * Initialize with reasonable defaults based on typical delivery patterns
   */
  private initializeDefaultProfiles(): void {
    // Rush hour multipliers
    const rushHourMultiplier = 1.3;
    const earlyMorningMultiplier = 1.1;
    const nightMultiplier = 1.15;

    for (let hour = 0; hour < 24; hour++) {
      let baseline = 30; // Default 30 minutes

      // Typical traffic patterns
      if (hour >= 7 && hour <= 9) {
        // Morning rush
        baseline = 30 * rushHourMultiplier;
      } else if (hour >= 17 && hour <= 19) {
        // Evening rush
        baseline = 30 * rushHourMultiplier;
      } else if (hour >= 4 && hour <= 6) {
        // Early morning
        baseline = 30 * earlyMorningMultiplier;
      } else if (hour >= 22 || hour <= 5) {
        // Night
        baseline = 30 * nightMultiplier;
      }

      this.hourlyProfiles.set(hour, {
        baseline_minutes: baseline,
        std_dev: baseline * 0.2, // 20% standard deviation
        weekday_multiplier: 1.0,
        weekend_multiplier: 0.9, // Weekends slightly faster
        holiday_multiplier: 0.85, // Holidays much faster
        sample_count: 0,
      });
    }

    // Seasonal factors (winter slower due to weather)
    this.seasonFactors.set('winter', 1.15);
    this.seasonFactors.set('spring', 1.0);
    this.seasonFactors.set('summer', 0.95);
    this.seasonFactors.set('fall', 1.05);
  }

  /**
   * Get season from month
   */
  private getSeason(month: number): string {
    if (month >= 11 || month <= 1) return 'winter';
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    return 'fall';
  }

  /**
   * Gaussian kernel smoothing: smooth predictions across adjacent hours
   */
  private gaussianSmooth(hour: number, bandwidth: number = 2): number {
    let weightedSum = 0;
    let weightSum = 0;

    for (let h = Math.max(0, hour - 3); h <= Math.min(23, hour + 3); h++) {
      const profile = this.hourlyProfiles.get(h);
      if (!profile) continue;

      // Gaussian kernel: exp(-(h - hour)^2 / (2 * bandwidth^2))
      const distance = Math.abs(h - hour);
      const weight = Math.exp(-(distance * distance) / (2 * bandwidth * bandwidth));

      weightedSum += weight * profile.baseline_minutes;
      weightSum += weight;
    }

    return weightSum > 0 ? weightedSum / weightSum : 30;
  }

  /**
   * Train model on historical deliveries
   */
  fit(historicalDeliveries: HistoricalDelivery[]): void {
    // Reset sample counts
    for (let i = 0; i < 24; i++) {
      const profile = this.hourlyProfiles.get(i);
      if (profile) {
        profile.sample_count = 0;
      }
    }

    // Group deliveries by hour
    const hourlyData: Map<number, number[]> = new Map();
    const weekdayData: Map<number, number[]> = new Map();
    const weekendData: Map<number, number[]> = new Map();
    const holidayData: Map<number, number[]> = new Map();

    for (const delivery of historicalDeliveries) {
      const hour = delivery.hour;

      if (!hourlyData.has(hour)) hourlyData.set(hour, []);
      hourlyData.get(hour)!.push(delivery.actual_duration_minutes);

      if (delivery.is_holiday) {
        if (!holidayData.has(hour)) holidayData.set(hour, []);
        holidayData.get(hour)!.push(delivery.actual_duration_minutes);
      } else if (delivery.day_of_week === 0 || delivery.day_of_week === 6) {
        if (!weekendData.has(hour)) weekendData.set(hour, []);
        weekendData.get(hour)!.push(delivery.actual_duration_minutes);
      } else {
        if (!weekdayData.has(hour)) weekdayData.set(hour, []);
        weekdayData.get(hour)!.push(delivery.actual_duration_minutes);
      }
    }

    // Update profiles with computed statistics
    for (let hour = 0; hour < 24; hour++) {
      const profile = this.hourlyProfiles.get(hour)!;
      const durations = hourlyData.get(hour) || [];

      if (durations.length > 0) {
        const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
        const variance = durations.reduce((sum, val) => sum + (val - mean) ** 2, 0) / durations.length;
        const stdDev = Math.sqrt(variance);

        profile.baseline_minutes = mean;
        profile.std_dev = stdDev || mean * 0.2;
        profile.sample_count = durations.length;
      }

      // Calculate multipliers for different day types
      const weekdayHours = weekdayData.get(hour) || [];
      const weekendHours = weekendData.get(hour) || [];
      const holidayHours = holidayData.get(hour) || [];

      if (weekdayHours.length > 0 && weekendHours.length > 0) {
        const weekdayMean = weekdayHours.reduce((a, b) => a + b, 0) / weekdayHours.length;
        const weekendMean = weekendHours.reduce((a, b) => a + b, 0) / weekendHours.length;
        profile.weekday_multiplier = weekdayMean / (profile.baseline_minutes || 1);
        profile.weekend_multiplier = weekendMean / (profile.baseline_minutes || 1);
      }

      if (holidayHours.length > 0) {
        const holidayMean = holidayHours.reduce((a, b) => a + b, 0) / holidayHours.length;
        profile.holiday_multiplier = holidayMean / (profile.baseline_minutes || 1);
      }
    }
  }

  /**
   * Predict delivery time for given hour, day type, and season
   */
  predict(features: FeatureVector): ModelPrediction {
    const hour = features.hour;
    const isHoliday = features.is_holiday;
    const dayOfWeek = features.day_of_week;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const profile = this.hourlyProfiles.get(hour);
    if (!profile) {
      return {
        modelName: 'time-of-day',
        predicted_duration_minutes: 30,
        confidence: 0.3,
        lower_bound_minutes: 20,
        upper_bound_minutes: 40,
      };
    }

    // Get smoothed baseline using Gaussian kernel
    const smoothedBaseline = this.gaussianSmooth(hour);

    // Apply day type multiplier
    let multiplier = 1.0;
    if (isHoliday) {
      multiplier = profile.holiday_multiplier;
    } else if (isWeekend) {
      multiplier = profile.weekend_multiplier;
    } else {
      multiplier = profile.weekday_multiplier;
    }

    // Get season factor (approximate from current date)
    const now = new Date();
    const seasonFactor = this.seasonFactors.get(this.getSeason(now.getMonth())) || 1.0;

    // Compute prediction
    const predictedDuration = smoothedBaseline * multiplier * seasonFactor;
    const stdDev = profile.std_dev * Math.sqrt(multiplier * seasonFactor);

    // Confidence based on sample count (more data = higher confidence)
    const confidence = Math.min(0.95, 0.4 + (Math.log(profile.sample_count + 1) / 10));

    return {
      modelName: 'time-of-day',
      predicted_duration_minutes: Math.round(predictedDuration * 10) / 10,
      confidence,
      lower_bound_minutes: Math.max(
        5,
        Math.round((predictedDuration - 1.96 * stdDev) * 10) / 10,
      ),
      upper_bound_minutes: Math.round((predictedDuration + 1.96 * stdDev) * 10) / 10,
    };
  }

  /**
   * Get state for serialization
   */
  getState(): TimeOfDayModelState {
    return {
      hourly_profiles: Object.fromEntries(
        Array.from(this.hourlyProfiles.entries()).map(([hour, profile]) => [
          hour,
          profile,
        ]),
      ),
      season_factors: Object.fromEntries(this.seasonFactors.entries()),
    };
  }

  /**
   * Restore state from serialization
   */
  setState(state: TimeOfDayModelState): void {
    this.hourlyProfiles.clear();
    for (const [hourStr, profile] of Object.entries(state.hourly_profiles)) {
      const hour = parseInt(hourStr, 10);
      this.hourlyProfiles.set(hour, profile);
    }

    this.seasonFactors.clear();
    for (const [season, factor] of Object.entries(state.season_factors)) {
      this.seasonFactors.set(season, factor);
    }
  }

  /**
   * Get feature importance for this model
   */
  getFeatureImportance(): Record<string, number> {
    return {
      hour: 1.0,
      day_of_week: 0.8,
      is_holiday: 0.7,
      is_weekend: 0.6,
      weather_condition: 0.3,
      temperature_celsius: 0.2,
    };
  }
}
