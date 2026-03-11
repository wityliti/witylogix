/**
 * Feature Extractor for ML ETA Engine
 *
 * Converts raw delivery data into normalized feature vectors for ML models.
 * All features are normalized to appropriate ranges for numerical stability.
 */

import type { FeatureVector, HistoricalDelivery } from './types.js';

const HOLIDAYS_2024 = new Set([
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-03-17', '2024-05-27',
  '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25',
]);

const HOLIDAYS_2025 = new Set([
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-03-17', '2025-05-26',
  '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
]);

const HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-03-17', '2026-05-25',
  '2026-07-04', '2026-09-07', '2026-11-26', '2026-12-25',
]);

export class FeatureExtractor {
  /**
   * Check if a date is a holiday
   */
  private isHoliday(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0];
    return (
      HOLIDAYS_2024.has(dateStr) ||
      HOLIDAYS_2025.has(dateStr) ||
      HOLIDAYS_2026.has(dateStr)
    );
  }

  /**
   * Get day of week (0 = Sunday, 6 = Saturday)
   */
  private getDayOfWeek(date: Date): number {
    return date.getUTCDay();
  }

  /**
   * Get hour of day (0-23)
   */
  private getHourOfDay(date: Date): number {
    return date.getUTCHours();
  }

  /**
   * Determine zone type based on location characteristics
   * In production, would use geofencing, population density, etc.
   */
  private determineZoneType(
    lat: number,
    lng: number,
    distanceKm: number,
  ): FeatureVector['zone_type'] {
    // Simplified logic based on distance and typical urban coordinates
    // In production: use actual zone mapping service
    const isUrbanArea = Math.abs(lat) < 40 && Math.abs(lng) < 120; // Placeholder

    if (distanceKm < 2) return 'urban-core';
    if (distanceKm < 5 && isUrbanArea) return 'urban';
    if (distanceKm < 20 && isUrbanArea) return 'suburban';
    if (distanceKm > 50) return 'highway';
    return 'rural';
  }

  /**
   * Normalize distance to 0-1 range
   * Uses logarithmic scaling to handle wide range
   */
  private normalizeDistance(distanceKm: number): number {
    // Log scale normalization: log(distance + 1) / log(200)
    // This compresses large distances while preserving differences at short range
    return Math.log(distanceKm + 1) / Math.log(200);
  }

  /**
   * Normalize driver experience to 0-1 scale
   */
  private normalizeExperience(yearsExperience: number): number {
    // Sigmoid-like function: 1 - exp(-x/5)
    // Asymptotes at 1.0 after ~20 years
    return Math.min(1, 1 - Math.exp(-yearsExperience / 5));
  }

  /**
   * Normalize temperature to 0-1 scale (for -30C to 50C range)
   */
  private normalizeTemperature(celsius: number): number {
    const clamped = Math.max(-30, Math.min(50, celsius));
    return (clamped + 30) / 80; // Maps [-30, 50] to [0, 1]
  }

  /**
   * Normalize wind speed (0-100 km/h range)
   */
  private normalizeWindSpeed(kmh: number): number {
    return Math.min(1, kmh / 100);
  }

  /**
   * Normalize precipitation (0-500mm range, but typical 0-50mm)
   */
  private normalizePrecipitation(mm: number): number {
    return Math.min(1, mm / 100);
  }

  /**
   * Get weather condition from intensity score
   */
  private getWeatherCondition(intensity: number): FeatureVector['weather_condition'] {
    if (intensity < 0.1) return 'clear';
    if (intensity < 0.3) return 'fog';
    if (intensity < 0.7) return 'rain';
    return 'snow';
  }

  /**
   * Extract feature vector from delivery context
   */
  extractFeatures(
    distanceKm: number,
    departureTime: Date,
    driverExperienceYears: number,
    vehicleType: FeatureVector['vehicle_type'],
    numStopsRemaining: number,
    historicalAvgMinutes: number,
    weatherIntensity: number = 0,
    trafficMultiplier: number = 1.0,
    temperatureCelsius: number = 20,
    windSpeedKmh: number = 0,
    precipitationMm: number = 0,
    originLat: number = 0,
    originLng: number = 0,
  ): FeatureVector {
    const dayOfWeek = this.getDayOfWeek(departureTime);
    const hour = this.getHourOfDay(departureTime);
    const isHoliday = this.isHoliday(departureTime);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

    const zoneType = this.determineZoneType(originLat, originLng, distanceKm);
    const weatherCondition = this.getWeatherCondition(weatherIntensity);

    return {
      distance_km: this.normalizeDistance(distanceKm),
      zone_type: zoneType,
      hour,
      day_of_week: dayOfWeek,
      is_holiday: isHoliday,
      is_weekend: isWeekend,
      weather_condition: weatherCondition,
      weather_intensity: Math.min(1, weatherIntensity / 10), // Normalize 0-10 to 0-1
      traffic_condition: trafficMultiplier > 1.5 ? 'heavy' :
                         trafficMultiplier > 1.2 ? 'moderate' : 'light',
      traffic_multiplier,
      historical_avg_minutes: historicalAvgMinutes,
      driver_experience_score: this.normalizeExperience(driverExperienceYears),
      vehicle_type: vehicleType,
      num_stops_remaining: numStopsRemaining,
      temperature_celsius: this.normalizeTemperature(temperatureCelsius),
      wind_speed_kmh: this.normalizeWindSpeed(windSpeedKmh),
      precipitation_mm: this.normalizePrecipitation(precipitationMm),
    };
  }

  /**
   * Extract features from historical delivery record
   */
  extractFromHistorical(delivery: HistoricalDelivery): FeatureVector {
    const dayOfWeek = delivery.day_of_week;
    const hour = delivery.hour;

    return {
      distance_km: this.normalizeDistance(delivery.distance_km),
      zone_type: delivery.zone_type,
      hour,
      day_of_week: dayOfWeek,
      is_holiday: delivery.is_holiday,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
      weather_condition: delivery.weather_condition,
      weather_intensity: Math.min(1, delivery.weather_intensity / 10),
      traffic_condition: delivery.traffic_condition,
      traffic_multiplier: 1.0, // Will be computed if needed
      historical_avg_minutes: 0, // Not available from historical record
      driver_experience_score: this.normalizeExperience(delivery.driver_experience_score),
      vehicle_type: delivery.vehicle_type,
      num_stops_remaining: delivery.num_stops,
      temperature_celsius: this.normalizeTemperature(delivery.temperature_celsius),
      wind_speed_kmh: this.normalizeWindSpeed(delivery.wind_speed_kmh),
      precipitation_mm: this.normalizePrecipitation(delivery.precipitation_mm),
    };
  }

  /**
   * Compute similarity between two feature vectors (normalized Euclidean distance)
   * Returns value in [0, 1] where 1 = identical, 0 = completely different
   */
  computeSimilarity(features1: FeatureVector, features2: FeatureVector): number {
    let sumSquaredDiff = 0;
    let count = 0;

    // Categorical features with explicit distance
    if (features1.zone_type !== features2.zone_type) sumSquaredDiff += 0.25;
    if (features1.weather_condition !== features2.weather_condition) sumSquaredDiff += 0.09;
    if (features1.traffic_condition !== features2.traffic_condition) sumSquaredDiff += 0.04;
    if (features1.vehicle_type !== features2.vehicle_type) sumSquaredDiff += 0.04;
    count += 4;

    // Numerical features (all normalized to [0, 1])
    const numericalFeatures = [
      'distance_km',
      'hour',
      'weather_intensity',
      'traffic_multiplier',
      'historical_avg_minutes',
      'driver_experience_score',
      'num_stops_remaining',
      'temperature_celsius',
      'wind_speed_kmh',
      'precipitation_mm',
    ] as const;

    for (const feature of numericalFeatures) {
      const val1 = features1[feature] as number;
      const val2 = features2[feature] as number;
      const diff = (val1 - val2) * (val1 - val2);
      sumSquaredDiff += diff;
      count++;
    }

    const rmse = Math.sqrt(sumSquaredDiff / count);
    return Math.exp(-rmse); // Convert distance to similarity using RBF kernel
  }

  /**
   * Weighted Euclidean distance with custom weights for KNN
   */
  weightedDistance(
    features1: FeatureVector,
    features2: FeatureVector,
    weights: Partial<Record<keyof FeatureVector, number>> = {},
  ): number {
    let sumWeightedSquaredDiff = 0;
    let totalWeight = 0;

    // Default equal weights
    const defaultWeights = Object.keys(features1).reduce(
      (acc, key) => ({ ...acc, [key]: 1.0 }),
      {} as Record<string, number>,
    );

    const finalWeights = { ...defaultWeights, ...weights };

    // Categorical features
    const categoricalFeatures = [
      'zone_type',
      'weather_condition',
      'traffic_condition',
      'vehicle_type',
    ] as const;

    for (const feature of categoricalFeatures) {
      const w = finalWeights[feature] || 1.0;
      if ((features1[feature] as unknown) !== (features2[feature] as unknown)) {
        sumWeightedSquaredDiff += w * w; // Distance = 1 for different categorical
      }
      totalWeight += w;
    }

    // Numerical features
    const numericalFeatures = [
      'distance_km',
      'hour',
      'weather_intensity',
      'traffic_multiplier',
      'historical_avg_minutes',
      'driver_experience_score',
      'num_stops_remaining',
      'temperature_celsius',
      'wind_speed_kmh',
      'precipitation_mm',
    ] as const;

    for (const feature of numericalFeatures) {
      const w = finalWeights[feature] || 1.0;
      const val1 = features1[feature] as number;
      const val2 = features2[feature] as number;
      const diff = (val1 - val2) * (val1 - val2);
      sumWeightedSquaredDiff += w * w * diff;
      totalWeight += w;
    }

    return Math.sqrt(sumWeightedSquaredDiff / (totalWeight || 1));
  }
}

export const featureExtractor = new FeatureExtractor();
