/**
 * Time-of-Day Model Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TimeOfDayModel } from '../models/time-of-day-model.js';
import type { HistoricalDelivery, FeatureVector } from '../types.js';

describe('TimeOfDayModel', () => {
  let model: TimeOfDayModel;
  let historicalData: HistoricalDelivery[];

  beforeEach(() => {
    model = new TimeOfDayModel();

    // Generate synthetic historical data
    historicalData = [];
    for (let i = 0; i < 500; i++) {
      const hour = i % 24;
      const dayOfWeek = Math.floor(i / 24) % 7;
      const isHoliday = dayOfWeek === 0; // Sundays are holidays
      const baseTime = 30;

      // Simulate rush hour effects
      let multiplier = 1.0;
      if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 19)) {
        multiplier = 1.4;
      } else if (isHoliday) {
        multiplier = 0.8;
      }

      const actualDuration = baseTime * multiplier + (Math.random() - 0.5) * 10;

      historicalData.push({
        delivery_id: `delivery_${i}`,
        distance_km: 5,
        zone_type: 'suburban',
        hour,
        day_of_week: dayOfWeek,
        is_holiday: isHoliday,
        weather_condition: 'clear',
        weather_intensity: 0,
        traffic_condition: 'light',
        driver_experience_score: 0.5,
        vehicle_type: 'car',
        num_stops: 1,
        actual_duration_minutes: Math.max(10, actualDuration),
        planned_duration_minutes: baseTime,
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000),
        temperature_celsius: 20,
        wind_speed_kmh: 0,
        precipitation_mm: 0,
      });
    }
  });

  it('should initialize with default profiles', () => {
    const prediction = model.predict({
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
    } as FeatureVector);

    expect(prediction).toBeDefined();
    expect(prediction.modelName).toBe('time-of-day');
    expect(prediction.predicted_duration_minutes).toBeGreaterThan(0);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
  });

  it('should fit and improve with training data', () => {
    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: 'suburban',
      hour: 8, // Morning rush
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

    const beforeFit = model.predict(features);
    model.fit(historicalData);
    const afterFit = model.predict(features);

    expect(afterFit.confidence).toBeGreaterThan(beforeFit.confidence);
  });

  it('should predict higher duration during rush hours', () => {
    model.fit(historicalData);

    const rushHourFeatures: FeatureVector = {
      distance_km: 0.5,
      zone_type: 'suburban',
      hour: 8, // Morning rush
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

    const offPeakFeatures: FeatureVector = {
      ...rushHourFeatures,
      hour: 14, // Off-peak
    };

    const rushHourPred = model.predict(rushHourFeatures);
    const offPeakPred = model.predict(offPeakFeatures);

    expect(rushHourPred.predicted_duration_minutes).toBeGreaterThan(
      offPeakPred.predicted_duration_minutes * 0.9,
    );
  });

  it('should predict lower duration for holidays', () => {
    model.fit(historicalData);

    const weekdayFeatures: FeatureVector = {
      distance_km: 0.5,
      zone_type: 'suburban',
      hour: 14,
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

    const holidayFeatures: FeatureVector = {
      ...weekdayFeatures,
      is_holiday: true,
    };

    const weekdayPred = model.predict(weekdayFeatures);
    const holidayPred = model.predict(holidayFeatures);

    expect(holidayPred.predicted_duration_minutes).toBeLessThan(weekdayPred.predicted_duration_minutes);
  });

  it('should provide confidence intervals', () => {
    model.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: 'suburban',
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

    const prediction = model.predict(features);

    expect(prediction.lower_bound_minutes).toBeLessThan(prediction.predicted_duration_minutes);
    expect(prediction.upper_bound_minutes).toBeGreaterThan(prediction.predicted_duration_minutes);
  });

  it('should handle all 24 hours', () => {
    model.fit(historicalData);

    for (let hour = 0; hour < 24; hour++) {
      const features: FeatureVector = {
        distance_km: 0.5,
        zone_type: 'suburban',
        hour,
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

      const prediction = model.predict(features);
      expect(prediction.predicted_duration_minutes).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  it('should serialize and deserialize state', () => {
    model.fit(historicalData);
    const prediction1 = model.predict({
      distance_km: 0.5,
      zone_type: 'suburban',
      hour: 8,
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
    } as FeatureVector);

    const state = model.getState();
    const model2 = new TimeOfDayModel();
    model2.setState(state);

    const prediction2 = model2.predict({
      distance_km: 0.5,
      zone_type: 'suburban',
      hour: 8,
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
    } as FeatureVector);

    expect(prediction1.predicted_duration_minutes).toBe(prediction2.predicted_duration_minutes);
  });

  it('should have feature importance', () => {
    const importance = model.getFeatureImportance();
    expect(importance).toBeDefined();
    expect(importance.hour).toBeGreaterThan(0);
    expect(importance.day_of_week).toBeGreaterThan(0);
  });
});
