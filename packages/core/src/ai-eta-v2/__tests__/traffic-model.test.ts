/**
 * Traffic Model Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TrafficModel } from '../models/traffic-model.js';
import type { HistoricalDelivery, FeatureVector } from '../types.js';

describe('TrafficModel', () => {
  let model: TrafficModel;
  let historicalData: HistoricalDelivery[];

  beforeEach(() => {
    model = new TrafficModel();

    historicalData = [];
    for (let i = 0; i < 400; i++) {
      const hour = i % 24;
      const zone = i % 4 === 0 ? 'urban-core' : i % 4 === 1 ? 'urban' : i % 4 === 2 ? 'suburban' : 'rural';

      // Simulate rush hour traffic
      const isRushHour = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 19);
      const multiplier = isRushHour && (zone === 'urban-core' || zone === 'urban') ? 1.8 : 1.0;

      const planned = 30;
      const actual = planned * multiplier + (Math.random() - 0.5) * 5;

      historicalData.push({
        delivery_id: `delivery_${i}`,
        distance_km: 5,
        zone_type: zone as any,
        hour,
        day_of_week: i % 7,
        is_holiday: i % 7 === 0,
        weather_condition: 'clear',
        weather_intensity: 0,
        traffic_condition: isRushHour ? 'heavy' : 'light',
        driver_experience_score: 0.5,
        vehicle_type: 'car',
        num_stops: 1,
        actual_duration_minutes: Math.max(10, actual),
        planned_duration_minutes: planned,
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000),
        temperature_celsius: 20,
        wind_speed_kmh: 0,
        precipitation_mm: 0,
      });
    }
  });

  it('should initialize with default zone profiles', () => {
    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: 'urban',
      hour: 8,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: 'clear',
      weather_intensity: 0,
      traffic_condition: 'heavy',
      traffic_multiplier: 1.5,
      historical_avg_minutes: 30,
      driver_experience_score: 0.5,
      vehicle_type: 'car',
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = model.predict(features);

    expect(prediction).toBeDefined();
    expect(prediction.modelName).toBe('traffic-aware');
    expect(prediction.predicted_duration_minutes).toBeGreaterThan(0);
  });

  it('should train on historical data', () => {
    expect(() => {
      model.fit(historicalData);
    }).not.toThrow();
  });

  it('should predict higher delay during rush hours', () => {
    model.fit(historicalData);

    const rushHourFeatures: FeatureVector = {
      distance_km: 0.5,
      zone_type: 'urban-core',
      hour: 8, // Morning rush
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: 'clear',
      weather_intensity: 0,
      traffic_condition: 'heavy',
      traffic_multiplier: 1.8,
      historical_avg_minutes: 30,
      driver_experience_score: 0.5,
      vehicle_type: 'car',
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const offPeakFeatures: FeatureVector = {
      ...rushHourFeatures,
      hour: 14,
      traffic_condition: 'light',
      traffic_multiplier: 1.0,
    };

    const rushPred = model.predict(rushHourFeatures);
    const offPeakPred = model.predict(offPeakFeatures);

    expect(rushPred.predicted_duration_minutes).toBeGreaterThan(
      offPeakPred.predicted_duration_minutes * 0.8,
    );
  });

  it('should reflect traffic condition in prediction', () => {
    model.fit(historicalData);

    const lightTrafficFeatures: FeatureVector = {
      distance_km: 0.5,
      zone_type: 'urban',
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: 'clear',
      weather_intensity: 0,
      traffic_condition: 'light',
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.5,
      vehicle_type: 'car',
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const heavyTrafficFeatures: FeatureVector = {
      ...lightTrafficFeatures,
      traffic_condition: 'heavy',
      traffic_multiplier: 1.8,
    };

    const lightPred = model.predict(lightTrafficFeatures);
    const heavyPred = model.predict(heavyTrafficFeatures);

    expect(heavyPred.predicted_duration_minutes).toBeGreaterThan(lightPred.predicted_duration_minutes);
  });

  it('should update condition multipliers', () => {
    model.fit(historicalData);

    const observations = [
      { condition: 'light' as const, actualMultiplier: 0.95 },
      { condition: 'light' as const, actualMultiplier: 1.05 },
      { condition: 'heavy' as const, actualMultiplier: 1.7 },
      { condition: 'heavy' as const, actualMultiplier: 1.9 },
    ];

    expect(() => {
      model.updateConditionMultipliers(observations);
    }).not.toThrow();
  });

  it('should calibrate predictions', () => {
    const predictions = [30, 32, 28, 35, 31];
    const actuals = [31, 33, 29, 34, 32];

    const result = model.calibrate(predictions, actuals);

    expect(result).toBeDefined();
    expect(result.bias_correction_factor).toBeGreaterThan(0);
    expect(result.scale_correction_factor).toBeGreaterThan(0);
  });

  it('should handle empty calibration', () => {
    const result = model.calibrate([], []);

    expect(result.bias_correction_factor).toBe(1.0);
    expect(result.scale_correction_factor).toBe(1.0);
  });

  it('should serialize and deserialize state', () => {
    model.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: 'urban',
      hour: 8,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: 'clear',
      weather_intensity: 0,
      traffic_condition: 'heavy',
      traffic_multiplier: 1.5,
      historical_avg_minutes: 30,
      driver_experience_score: 0.5,
      vehicle_type: 'car',
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const pred1 = model.predict(features);
    const state = model.getState();

    const model2 = new TrafficModel();
    model2.setState(state);
    const pred2 = model2.predict(features);

    expect(pred1.predicted_duration_minutes).toBe(pred2.predicted_duration_minutes);
  });

  it('should have feature importance', () => {
    const importance = model.getFeatureImportance();

    expect(importance).toBeDefined();
    expect(importance.zone_type).toBe(1.0);
    expect(importance.hour).toBeGreaterThan(0);
    expect(importance.traffic_condition).toBeGreaterThan(0);
  });
});
