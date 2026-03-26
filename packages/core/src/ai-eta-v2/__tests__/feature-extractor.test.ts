/**
 * Feature Extractor Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { featureExtractor } from '../feature-extractor.js';
import type { HistoricalDelivery } from '../types.js';

describe('FeatureExtractor', () => {
  beforeEach(() => {
    // Feature extractor is stateless, so nothing to setup
  });

  it('should extract features from delivery context', () => {
    const features = featureExtractor.extractFeatures(
      10, // distance
      new Date('2025-03-11T14:30:00Z'), // departure time (Tuesday)
      3, // driver experience years
      'car', // vehicle type
      2, // stops remaining
      35, // historical avg
      0.1, // weather intensity
      1.0, // traffic multiplier
      20, // temperature
      5, // wind speed
      0, // precipitation
      40.7128, // lat
      -74.006, // lng
    );

    expect(features).toBeDefined();
    expect(features.distance_km).toBeGreaterThanOrEqual(0);
    expect(features.distance_km).toBeLessThanOrEqual(1);
    expect(features.hour).toBe(14);
    expect(features.day_of_week).toBe(2); // Tuesday
    expect(features.is_weekend).toBe(0);
    expect(features.driver_experience_score).toBeGreaterThan(0);
    expect(features.vehicle_type).toBe('car');
  });

  it('should handle holidays', () => {
    const christmasFeatures = featureExtractor.extractFeatures(
      10,
      new Date('2025-12-25T14:30:00Z'),
      3,
      'car',
      2,
      35,
      0,
      1.0,
      20,
      5,
      0,
      0,
      0,
    );

    const regularDayFeatures = featureExtractor.extractFeatures(
      10,
      new Date('2025-12-24T14:30:00Z'),
      3,
      'car',
      2,
      35,
      0,
      1.0,
      20,
      5,
      0,
      0,
      0,
    );

    expect(christmasFeatures.is_holiday).toBe(true);
    expect(regularDayFeatures.is_holiday).toBe(false);
  });

  it('should identify weekends', () => {
    const saturdayFeatures = featureExtractor.extractFeatures(
      10,
      new Date('2025-03-08T14:30:00Z'), // Saturday
      3,
      'car',
      2,
      35,
      0,
      1.0,
      20,
      5,
      0,
      0,
      0,
    );

    const sundayFeatures = featureExtractor.extractFeatures(
      10,
      new Date('2025-03-09T14:30:00Z'), // Sunday
      3,
      'car',
      2,
      35,
      0,
      1.0,
      20,
      5,
      0,
      0,
    );

    const weekdayFeatures = featureExtractor.extractFeatures(
      10,
      new Date('2025-03-10T14:30:00Z'), // Monday
      3,
      'car',
      2,
      35,
      0,
      1.0,
      20,
      5,
      0,
      0,
      0,
    );

    expect(saturdayFeatures.is_weekend).toBe(1);
    expect(sundayFeatures.is_weekend).toBe(1);
    expect(weekdayFeatures.is_weekend).toBe(0);
  });

  it('should extract features from historical delivery', () => {
    const historical: HistoricalDelivery = {
      delivery_id: 'test_1',
      distance_km: 8,
      zone_type: 'urban',
      hour: 14,
      day_of_week: 2,
      is_holiday: false,
      weather_condition: 'rain',
      weather_intensity: 0.5,
      traffic_condition: 'moderate',
      driver_experience_score: 0.7,
      vehicle_type: 'car',
      num_stops: 3,
      actual_duration_minutes: 45,
      temperature_celsius: 18,
      wind_speed_kmh: 8,
      precipitation_mm: 10,
      timestamp: new Date(),
    };

    const features = featureExtractor.extractFromHistorical(historical);

    expect(features).toBeDefined();
    expect(features.zone_type).toBe('urban');
    expect(features.hour).toBe(14);
    expect(features.weather_condition).toBe('rain');
    expect(features.vehicle_type).toBe('car');
    expect(features.num_stops_remaining).toBe(3);
  });

  it('should normalize distance properly', () => {
    const features1km = featureExtractor.extractFeatures(
      1,
      new Date(),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      0,
      0,
    );

    const features100km = featureExtractor.extractFeatures(
      100,
      new Date(),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      0,
      0,
    );

    // Both should be normalized to [0, 1]
    expect(features1km.distance_km).toBeGreaterThan(0);
    expect(features1km.distance_km).toBeLessThanOrEqual(1);
    expect(features100km.distance_km).toBeGreaterThan(0);
    expect(features100km.distance_km).toBeLessThanOrEqual(1);

    // Longer distance should have higher normalized value
    expect(features100km.distance_km).toBeGreaterThan(features1km.distance_km);
  });

  it('should normalize driver experience', () => {
    const inexperienced = featureExtractor.extractFeatures(
      10,
      new Date(),
      0.5, // 6 months
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      0,
      0,
    );

    const experienced = featureExtractor.extractFeatures(
      10,
      new Date(),
      10, // 10 years
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      0,
      0,
    );

    expect(experienced.driver_experience_score).toBeGreaterThan(
      inexperienced.driver_experience_score,
    );
  });

  it('should handle weather conditions', () => {
    const clearWeather = featureExtractor.extractFeatures(
      10,
      new Date(),
      3,
      'car',
      1,
      30,
      0, // No precipitation
      1.0,
      20,
      0,
      0,
      0,
      0,
    );

    const rainWeather = featureExtractor.extractFeatures(
      10,
      new Date(),
      3,
      'car',
      1,
      30,
      0.4, // Rain
      1.0,
      20,
      0,
      10, // 10mm rain
      0,
      0,
    );

    const snowWeather = featureExtractor.extractFeatures(
      10,
      new Date(),
      3,
      'car',
      1,
      30,
      0.8, // Heavy snow
      1.0,
      -5,
      0,
      20, // 20mm snow
      0,
      0,
    );

    expect(clearWeather.weather_condition).toBe('clear');
    expect(rainWeather.weather_condition).toBe('rain');
    expect(snowWeather.weather_condition).toBe('snow');
  });

  it('should compute similarity between feature vectors', () => {
    const features1 = featureExtractor.extractFeatures(
      10,
      new Date('2025-03-11T14:00:00Z'),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      40.7128,
      -74.006,
    );

    // Identical features
    const features2 = featureExtractor.extractFeatures(
      10,
      new Date('2025-03-11T14:00:00Z'),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      40.7128,
      -74.006,
    );

    // Different distance
    const features3 = featureExtractor.extractFeatures(
      20,
      new Date('2025-03-11T14:00:00Z'),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      40.7128,
      -74.006,
    );

    const similarity12 = featureExtractor.computeSimilarity(features1, features2);
    const similarity13 = featureExtractor.computeSimilarity(features1, features3);

    expect(similarity12).toBeGreaterThan(0.95); // Nearly identical
    expect(similarity13).toBeLessThan(similarity12); // Different distance
  });

  it('should compute weighted distance', () => {
    const features1 = featureExtractor.extractFeatures(
      10,
      new Date('2025-03-11T14:00:00Z'),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      40.7128,
      -74.006,
    );

    const features2 = featureExtractor.extractFeatures(
      10,
      new Date('2025-03-11T14:00:00Z'),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      20,
      0,
      0,
      40.7128,
      -74.006,
    );

    const distance = featureExtractor.weightedDistance(features1, features2);

    expect(distance).toBeDefined();
    expect(distance).toBeGreaterThanOrEqual(0);
  });

  it('should handle temperature normalization', () => {
    const coldFeatures = featureExtractor.extractFeatures(
      10,
      new Date(),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      -30, // Very cold
      0,
      0,
      0,
      0,
    );

    const hotFeatures = featureExtractor.extractFeatures(
      10,
      new Date(),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      50, // Very hot
      0,
      0,
      0,
      0,
    );

    const mildFeatures = featureExtractor.extractFeatures(
      10,
      new Date(),
      3,
      'car',
      1,
      30,
      0,
      1.0,
      20, // Mild
      0,
      0,
      0,
      0,
    );

    // All should be normalized to [0, 1]
    expect(coldFeatures.temperature_celsius).toBeGreaterThanOrEqual(0);
    expect(coldFeatures.temperature_celsius).toBeLessThanOrEqual(1);
    expect(hotFeatures.temperature_celsius).toBeGreaterThanOrEqual(0);
    expect(hotFeatures.temperature_celsius).toBeLessThanOrEqual(1);
    expect(mildFeatures.temperature_celsius).toBeGreaterThanOrEqual(0);
    expect(mildFeatures.temperature_celsius).toBeLessThanOrEqual(1);
  });

  it('should extract all hour values correctly', () => {
    for (let hour = 0; hour < 24; hour++) {
      const date = new Date();
      date.setUTCHours(hour);

      const features = featureExtractor.extractFeatures(
        10,
        date,
        3,
        'car',
        1,
        30,
        0,
        1.0,
        20,
        0,
        0,
        0,
        0,
      );

      expect(features.hour).toBe(hour);
    }
  });

  it('should handle all zone types', () => {
    const zoneTypes: Array<'urban-core' | 'urban' | 'suburban' | 'rural' | 'highway'> = [
      'urban-core',
      'urban',
      'suburban',
      'rural',
      'highway',
    ];

    for (const zone of zoneTypes) {
      const historical: HistoricalDelivery = {
        delivery_id: `test_${zone}`,
        distance_km: 10,
        zone_type: zone,
        hour: 14,
        day_of_week: 2,
        is_holiday: false,
        weather_condition: 'clear',
        weather_intensity: 0,
        traffic_condition: 'light',
        driver_experience_score: 0.5,
        vehicle_type: 'car',
        num_stops: 1,
        actual_duration_minutes: 30,
        temperature_celsius: 20,
        wind_speed_kmh: 0,
        precipitation_mm: 0,
        timestamp: new Date(),
      };

      const features = featureExtractor.extractFromHistorical(historical);
      expect(features.zone_type).toBe(zone);
    }
  });
});
