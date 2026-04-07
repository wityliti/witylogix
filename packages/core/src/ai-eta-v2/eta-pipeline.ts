/**
 * ETA Adjustment Pipeline
 *
 * Transforms raw ML prediction through a series of adjustment steps:
 * 1. Traffic adjustment (using traffic providers)
 * 2. Weather adjustment (rain, snow, fog, etc.)
 * 3. Time-of-day correction (rush hour, night, holidays)
 * 4. Zone-specific correction (urban vs suburban vs rural)
 * 5. Confidence interval calculation
 * 6. Final ETA output
 *
 * Each step logs its adjustment factor for transparency and debugging.
 * Pipeline is configurable - steps can be enabled/disabled.
 */

import type { Coordinates } from '../ai-eta/types.js';

/**
 * Pipeline step definition
 */
export interface PipelineStep {
  name: string;
  enabled: boolean;
  adjustmentFactor?: number;
  description?: string;
}

/**
 * Pipeline configuration
 */
export interface ETAPipelineConfig {
  enableTrafficAdjustment?: boolean;
  enableWeatherAdjustment?: boolean;
  enableTimeOfDayCorrection?: boolean;
  enableZoneSpecificCorrection?: boolean;
  minConfidence?: number;
  logAdjustments?: boolean;
}

/**
 * Weather condition
 */
export type WeatherCondition = 'clear' | 'rain' | 'snow' | 'fog' | 'extreme_heat' | 'wind';

/**
 * Weather input
 */
export interface WeatherInput {
  condition: WeatherCondition;
  severity?: 'light' | 'moderate' | 'heavy'; // for rain, snow
  temperature?: number; // celsius
  windSpeed?: number; // km/h
}

/**
 * Adjustment factor result
 */
export interface AdjustmentFactor {
  step: string;
  factor: number; // 1.0 = no adjustment, > 1.0 = increase, < 1.0 = decrease
  delayMinutes: number;
  reasoning: string;
}

/**
 * ETA prediction result from pipeline
 */
export interface ETAPipelineResult {
  baseDurationMin: number;
  adjustedDurationMin: number;
  adjustmentFactors: AdjustmentFactor[];
  confidence: number; // 0-1
  eta: Date;
  departureTime: Date;
  lowerBoundMin: number; // 10th percentile
  upperBoundMin: number; // 90th percentile
}

/**
 * ETA Pipeline
 */
export class ETAPipeline {
  private config: Required<ETAPipelineConfig>;
  private weatherFactors: Record<WeatherCondition, Record<string, number>>;

  constructor(config?: ETAPipelineConfig) {
    this.config = {
      enableTrafficAdjustment: config?.enableTrafficAdjustment ?? true,
      enableWeatherAdjustment: config?.enableWeatherAdjustment ?? true,
      enableTimeOfDayCorrection: config?.enableTimeOfDayCorrection ?? true,
      enableZoneSpecificCorrection: config?.enableZoneSpecificCorrection ?? true,
      minConfidence: config?.minConfidence ?? 0.5,
      logAdjustments: config?.logAdjustments ?? true,
    };

    // Weather adjustment factors (multiplier on base duration)
    this.weatherFactors = {
      clear: { factor: 1.0 },
      rain: { factor_light: 1.15, factor_moderate: 1.2, factor_heavy: 1.25 },
      snow: { factor_light: 1.3, factor_moderate: 1.4, factor_heavy: 1.5 },
      fog: { factor_light: 1.1, factor_moderate: 1.15, factor_heavy: 1.2 },
      extreme_heat: { factor: 1.05 },
      wind: { factor_light: 1.05, factor_moderate: 1.1, factor_heavy: 1.15 },
    };
  }

  /**
   * Apply traffic adjustment
   *
   * Adjusts ETA based on current/predicted traffic conditions
   */
  private applyTrafficAdjustment(
    baseDurationMin: number,
    trafficDelayMin: number,
  ): AdjustmentFactor {
    const adjustedDuration = baseDurationMin + trafficDelayMin;
    const factor = adjustedDuration / baseDurationMin;

    return {
      step: 'traffic',
      factor,
      delayMinutes: trafficDelayMin,
      reasoning: `Traffic delay of ${trafficDelayMin.toFixed(1)} minutes applied`,
    };
  }

  /**
   * Apply weather adjustment
   */
  private applyWeatherAdjustment(
    baseDurationMin: number,
    weather: WeatherInput,
  ): AdjustmentFactor {
    let factor = 1.0;
    let delayMinutes = 0;

    if (weather.condition === 'clear') {
      factor = 1.0;
    } else if (weather.condition === 'rain') {
      const severity = weather.severity || 'moderate';
      const severityMap = { light: 1.15, moderate: 1.2, heavy: 1.25 };
      factor = severityMap[severity] || 1.2;
    } else if (weather.condition === 'snow') {
      const severity = weather.severity || 'moderate';
      const severityMap = { light: 1.3, moderate: 1.4, heavy: 1.5 };
      factor = severityMap[severity] || 1.4;
    } else if (weather.condition === 'fog') {
      const severity = weather.severity || 'moderate';
      const severityMap = { light: 1.1, moderate: 1.15, heavy: 1.2 };
      factor = severityMap[severity] || 1.15;
    } else if (weather.condition === 'extreme_heat') {
      factor = 1.05; // Slight slowdown due to heat
    } else if (weather.condition === 'wind') {
      const severity = weather.severity || 'moderate';
      const severityMap: Record<string, number> = { light: 1.05, moderate: 1.1, heavy: 1.15 };
      factor = severityMap[severity] || 1.1;
    }

    delayMinutes = baseDurationMin * (factor - 1.0);

    return {
      step: 'weather',
      factor,
      delayMinutes,
      reasoning: `${weather.condition} (${weather.severity || 'moderate'}) increases duration by ${((factor - 1.0) * 100).toFixed(1)}%`,
    };
  }

  /**
   * Apply time-of-day correction
   *
   * Adjusts for peak hours, nights, weekends, holidays
   */
  private applyTimeOfDayCorrection(
    baseDurationMin: number,
    departureTime: Date,
  ): AdjustmentFactor {
    const hour = departureTime.getHours();
    const dayOfWeek = departureTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let factor = 1.0;
    let reasoning = '';

    // Peak hours: 7-9 AM, 5-7 PM
    if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) {
      factor = isWeekend ? 1.15 : 1.35;
      reasoning = `${isWeekend ? 'Weekend' : 'Weekday'} peak hours`;
    }
    // Shoulder hours: 6-7 AM, 9-10 AM, 4-5 PM, 7-8 PM
    else if ((hour >= 6 && hour < 7) || (hour >= 9 && hour < 10) || (hour >= 16 && hour < 17) || (hour >= 19 && hour < 20)) {
      factor = isWeekend ? 1.1 : 1.25;
      reasoning = `${isWeekend ? 'Weekend' : 'Weekday'} shoulder hours`;
    }
    // Night hours: 10 PM - 5 AM
    else if (hour >= 22 || hour < 5) {
      factor = 0.8;
      reasoning = 'Night-time, minimal traffic';
    }
    // Midday
    else {
      factor = isWeekend ? 1.0 : 1.1;
      reasoning = `${isWeekend ? 'Weekend' : 'Weekday'} off-peak hours`;
    }

    const delayMinutes = baseDurationMin * (factor - 1.0);

    return {
      step: 'time_of_day',
      factor,
      delayMinutes,
      reasoning,
    };
  }

  /**
   * Apply zone-specific correction
   *
   * Adjusts based on urban/suburban/rural characteristics
   */
  private applyZoneSpecificCorrection(
    baseDurationMin: number,
    zoneType: 'urban' | 'suburban' | 'rural' | 'highway',
  ): AdjustmentFactor {
    const zoneFactors: Record<string, number> = {
      urban: 1.2, // Variable traffic in cities
      suburban: 1.0, // Baseline
      rural: 0.95, // Slightly faster, less congestion
      highway: 0.9, // Faster speeds
    };

    const factor = zoneFactors[zoneType] || 1.0;
    const delayMinutes = baseDurationMin * (factor - 1.0);

    return {
      step: 'zone_specific',
      factor,
      delayMinutes,
      reasoning: `${zoneType} zone adjustment`,
    };
  }

  /**
   * Process ETA through the pipeline
   *
   * @param request Pipeline request with base duration and adjustments
   * @returns Adjusted ETA with confidence interval
   */
  process(request: {
    baseDurationMin: number;
    departureTime: Date;
    origin?: Coordinates;
    destination?: Coordinates;
    traffic?: {
      delayMin: number;
      confidence: number;
    };
    weather?: WeatherInput;
    zoneType?: 'urban' | 'suburban' | 'rural' | 'highway';
    confidence?: number;
  }): ETAPipelineResult {
    const adjustments: AdjustmentFactor[] = [];
    let currentDuration = request.baseDurationMin;

    // Step 1: Traffic adjustment
    if (this.config.enableTrafficAdjustment && request.traffic) {
      const trafficAdj = this.applyTrafficAdjustment(currentDuration, request.traffic.delayMin);
      if (this.config.logAdjustments) {
        console.log(`[ETA Pipeline] ${trafficAdj.step}: ${trafficAdj.reasoning}`);
      }
      adjustments.push(trafficAdj);
      currentDuration *= trafficAdj.factor;
    }

    // Step 2: Weather adjustment
    if (this.config.enableWeatherAdjustment && request.weather) {
      const weatherAdj = this.applyWeatherAdjustment(currentDuration, request.weather);
      if (this.config.logAdjustments) {
        console.log(`[ETA Pipeline] ${weatherAdj.step}: ${weatherAdj.reasoning}`);
      }
      adjustments.push(weatherAdj);
      currentDuration *= weatherAdj.factor;
    }

    // Step 3: Time-of-day correction
    if (this.config.enableTimeOfDayCorrection) {
      const timeAdj = this.applyTimeOfDayCorrection(currentDuration, request.departureTime);
      if (this.config.logAdjustments) {
        console.log(`[ETA Pipeline] ${timeAdj.step}: ${timeAdj.reasoning}`);
      }
      adjustments.push(timeAdj);
      currentDuration *= timeAdj.factor;
    }

    // Step 4: Zone-specific correction
    if (this.config.enableZoneSpecificCorrection && request.zoneType) {
      const zoneAdj = this.applyZoneSpecificCorrection(currentDuration, request.zoneType);
      if (this.config.logAdjustments) {
        console.log(`[ETA Pipeline] ${zoneAdj.step}: ${zoneAdj.reasoning}`);
      }
      adjustments.push(zoneAdj);
      currentDuration *= zoneAdj.factor;
    }

    // Step 5: Calculate confidence interval (80% confidence = 10th to 90th percentile)
    // Standard approach: use z-score for normal distribution
    const baseConfidence = Math.min(
      1.0,
      Math.max(this.config.minConfidence, request.confidence || 0.8),
    );

    // Calculate bounds using confidence intervals
    // Lower bound: 10th percentile (z = -1.28)
    // Upper bound: 90th percentile (z = 1.28)
    const stdDev = currentDuration * 0.15; // Assume 15% standard deviation
    const lowerBound = currentDuration - 1.28 * stdDev;
    const upperBound = currentDuration + 1.28 * stdDev;

    // Step 6: Calculate final ETA
    const eta = new Date(request.departureTime.getTime() + currentDuration * 60 * 1000);

    if (this.config.logAdjustments) {
      console.log(
        `[ETA Pipeline] Final ETA: ${eta.toISOString()} (${currentDuration.toFixed(1)} min)`,
      );
    }

    return {
      baseDurationMin: request.baseDurationMin,
      adjustedDurationMin: currentDuration,
      adjustmentFactors: adjustments,
      confidence: baseConfidence,
      eta,
      departureTime: request.departureTime,
      lowerBoundMin: Math.max(0, lowerBound),
      upperBoundMin: upperBound,
    };
  }

  /**
   * Get pipeline configuration
   */
  getConfig(): Required<ETAPipelineConfig> {
    return this.config;
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(config: Partial<ETAPipelineConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Enable specific pipeline step
   */
  enableStep(stepName: string): void {
    const stepMap: Record<string, keyof typeof this.config> = {
      traffic: 'enableTrafficAdjustment',
      weather: 'enableWeatherAdjustment',
      time_of_day: 'enableTimeOfDayCorrection',
      zone_specific: 'enableZoneSpecificCorrection',
    };

    const configKey = stepMap[stepName];
    if (configKey) {
      this.config[configKey] = true;
    }
  }

  /**
   * Disable specific pipeline step
   */
  disableStep(stepName: string): void {
    const stepMap: Record<string, keyof typeof this.config> = {
      traffic: 'enableTrafficAdjustment',
      weather: 'enableWeatherAdjustment',
      time_of_day: 'enableTimeOfDayCorrection',
      zone_specific: 'enableZoneSpecificCorrection',
    };

    const configKey = stepMap[stepName];
    if (configKey) {
      this.config[configKey] = false;
    }
  }
}
