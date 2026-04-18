/**
 * ETA Pipeline Tests
 *
 * Tests for the ETA adjustment pipeline covering:
 * - Traffic adjustment
 * - Weather adjustment
 * - Time-of-day correction
 * - Zone-specific correction
 * - Confidence interval calculation
 * - Pipeline step enable/disable
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ETAPipeline, type WeatherInput } from '../eta-pipeline.js';

describe('ETAPipeline', () => {
  let pipeline: ETAPipeline;

  beforeEach(() => {
    pipeline = new ETAPipeline({
      enableTrafficAdjustment: true,
      enableWeatherAdjustment: true,
      enableTimeOfDayCorrection: true,
      enableZoneSpecificCorrection: true,
      minConfidence: 0.5,
      logAdjustments: false,
    });
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultPipeline = new ETAPipeline();
      expect(defaultPipeline).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const config = {
        enableTrafficAdjustment: false,
        enableWeatherAdjustment: false,
        minConfidence: 0.7,
      };
      const customPipeline = new ETAPipeline(config);
      expect(customPipeline.getConfig().minConfidence).toBe(0.7);
    });
  });

  describe('traffic adjustment', () => {
    it('should apply traffic delay', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        traffic: {
          delayMin: 10,
          confidence: 0.85,
        },
      });

      expect(result.adjustmentFactors).toContainEqual(
        expect.objectContaining({
          step: 'traffic',
          delayMinutes: 10,
        }),
      );
      expect(result.adjustedDurationMin).toBeGreaterThan(result.baseDurationMin);
    });

    it('should not apply traffic adjustment when disabled', () => {
      pipeline.updateConfig({ enableTrafficAdjustment: false });

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        traffic: {
          delayMin: 10,
          confidence: 0.85,
        },
      });

      const trafficFactor = result.adjustmentFactors.find((f) => f.step === 'traffic');
      expect(trafficFactor).toBeUndefined();
    });

    it('should calculate factor correctly', () => {
      const result = pipeline.process({
        baseDurationMin: 20,
        departureTime: new Date(),
        traffic: {
          delayMin: 5,
          confidence: 0.85,
        },
      });

      const trafficFactor = result.adjustmentFactors.find((f) => f.step === 'traffic');
      expect(trafficFactor?.factor).toBe(1.25); // (20 + 5) / 20
    });
  });

  describe('weather adjustment', () => {
    it('should apply rain adjustment', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        weather: {
          condition: 'rain',
          severity: 'moderate',
        },
      });

      const weatherFactor = result.adjustmentFactors.find((f) => f.step === 'weather');
      expect(weatherFactor).toBeDefined();
      expect(weatherFactor?.factor).toBe(1.2);
    });

    it('should apply snow adjustment', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        weather: {
          condition: 'snow',
          severity: 'heavy',
        },
      });

      const weatherFactor = result.adjustmentFactors.find((f) => f.step === 'weather');
      expect(weatherFactor?.factor).toBe(1.5);
    });

    it('should apply fog adjustment', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        weather: {
          condition: 'fog',
          severity: 'light',
        },
      });

      const weatherFactor = result.adjustmentFactors.find((f) => f.step === 'weather');
      expect(weatherFactor?.factor).toBe(1.1);
    });

    it('should apply extreme heat adjustment', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        weather: {
          condition: 'extreme_heat',
        },
      });

      const weatherFactor = result.adjustmentFactors.find((f) => f.step === 'weather');
      expect(weatherFactor?.factor).toBe(1.05);
    });

    it('should apply wind adjustment', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        weather: {
          condition: 'wind',
          severity: 'moderate',
        },
      });

      const weatherFactor = result.adjustmentFactors.find((f) => f.step === 'weather');
      expect(weatherFactor?.factor).toBe(1.1);
    });

    it('should not apply weather adjustment when disabled', () => {
      pipeline.updateConfig({ enableWeatherAdjustment: false });

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        weather: {
          condition: 'rain',
          severity: 'heavy',
        },
      });

      const weatherFactor = result.adjustmentFactors.find((f) => f.step === 'weather');
      expect(weatherFactor).toBeUndefined();
    });
  });

  describe('time-of-day correction', () => {
    it('should increase duration during morning peak hours (7-9 AM)', () => {
      const peakTime = new Date('2026-04-20T08:00:00'); // Monday 8 AM (weekday)

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: peakTime,
      });

      const timeAdj = result.adjustmentFactors.find((f) => f.step === 'time_of_day');
      expect(timeAdj?.factor).toBeGreaterThan(1.2); // Significant peak adjustment
    });

    it('should increase duration during evening peak hours (5-7 PM)', () => {
      const peakTime = new Date('2026-04-20T18:00:00'); // Monday 6 PM (weekday)

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: peakTime,
      });

      const timeAdj = result.adjustmentFactors.find((f) => f.step === 'time_of_day');
      expect(timeAdj?.factor).toBeGreaterThan(1.2);
    });

    it('should decrease duration during night hours (10 PM - 5 AM)', () => {
      const nightTime = new Date();
      nightTime.setHours(23, 0, 0); // 11 PM

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: nightTime,
      });

      const timeAdj = result.adjustmentFactors.find((f) => f.step === 'time_of_day');
      expect(timeAdj?.factor).toBeLessThan(1.0);
    });

    it('should apply lower multiplier on weekends', () => {
      const weekdayPeak = new Date('2024-03-11T08:00:00'); // Monday
      const weekendPeak = new Date('2024-03-16T08:00:00'); // Saturday

      const weekdayResult = pipeline.process({
        baseDurationMin: 30,
        departureTime: weekdayPeak,
      });

      const weekendResult = pipeline.process({
        baseDurationMin: 30,
        departureTime: weekendPeak,
      });

      const weekdayAdj = weekdayResult.adjustmentFactors.find((f) => f.step === 'time_of_day');
      const weekendAdj = weekendResult.adjustmentFactors.find((f) => f.step === 'time_of_day');

      expect(weekdayAdj!.factor).toBeGreaterThan(weekendAdj!.factor);
    });

    it('should not apply time correction when disabled', () => {
      pipeline.updateConfig({ enableTimeOfDayCorrection: false });

      const peakTime = new Date();
      peakTime.setHours(8, 0, 0);

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: peakTime,
      });

      const timeAdj = result.adjustmentFactors.find((f) => f.step === 'time_of_day');
      expect(timeAdj).toBeUndefined();
    });
  });

  describe('zone-specific correction', () => {
    it('should apply urban correction', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        zoneType: 'urban',
      });

      const zoneAdj = result.adjustmentFactors.find((f) => f.step === 'zone_specific');
      expect(zoneAdj?.factor).toBe(1.2);
    });

    it('should apply suburban correction', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        zoneType: 'suburban',
      });

      const zoneAdj = result.adjustmentFactors.find((f) => f.step === 'zone_specific');
      expect(zoneAdj?.factor).toBe(1.0);
    });

    it('should apply rural correction', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        zoneType: 'rural',
      });

      const zoneAdj = result.adjustmentFactors.find((f) => f.step === 'zone_specific');
      expect(zoneAdj?.factor).toBe(0.95);
    });

    it('should apply highway correction', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        zoneType: 'highway',
      });

      const zoneAdj = result.adjustmentFactors.find((f) => f.step === 'zone_specific');
      expect(zoneAdj?.factor).toBe(0.9);
    });

    it('should not apply zone correction when disabled', () => {
      pipeline.updateConfig({ enableZoneSpecificCorrection: false });

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        zoneType: 'urban',
      });

      const zoneAdj = result.adjustmentFactors.find((f) => f.step === 'zone_specific');
      expect(zoneAdj).toBeUndefined();
    });
  });

  describe('confidence interval calculation', () => {
    it('should calculate lower and upper bounds', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
      });

      expect(result.lowerBoundMin).toBeLessThan(result.adjustedDurationMin);
      expect(result.upperBoundMin).toBeGreaterThan(result.adjustedDurationMin);
    });

    it('should have positive lower bound', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
      });

      expect(result.lowerBoundMin).toBeGreaterThanOrEqual(0);
    });

    it('should have confidence between 0 and 1', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        confidence: 0.75,
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should respect minimum confidence', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        confidence: 0.2,
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0.5); // minConfidence default
    });
  });

  describe('ETA calculation', () => {
    it('should calculate correct ETA', () => {
      const departureTime = new Date('2024-01-01T10:00:00');
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime,
      });

      const expectedEta = new Date(departureTime.getTime() + result.adjustedDurationMin * 60 * 1000);
      expect(result.eta.getTime()).toBe(expectedEta.getTime());
    });

    it('should return correct departure time', () => {
      const departureTime = new Date('2024-01-01T10:00:00');
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime,
      });

      expect(result.departureTime.getTime()).toBe(departureTime.getTime());
    });
  });

  describe('step enable/disable', () => {
    it('should enable traffic adjustment', () => {
      pipeline.disableStep('traffic');
      pipeline.enableStep('traffic');

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        traffic: {
          delayMin: 10,
          confidence: 0.85,
        },
      });

      const trafficFactor = result.adjustmentFactors.find((f) => f.step === 'traffic');
      expect(trafficFactor).toBeDefined();
    });

    it('should disable weather adjustment', () => {
      pipeline.disableStep('weather');

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        weather: {
          condition: 'rain',
          severity: 'heavy',
        },
      });

      const weatherFactor = result.adjustmentFactors.find((f) => f.step === 'weather');
      expect(weatherFactor).toBeUndefined();
    });
  });

  describe('configuration management', () => {
    it('should get current config', () => {
      const config = pipeline.getConfig();
      expect(config).toBeDefined();
      expect(config.enableTrafficAdjustment).toBe(true);
    });

    it('should update config', () => {
      pipeline.updateConfig({ minConfidence: 0.8 });
      const config = pipeline.getConfig();
      expect(config.minConfidence).toBe(0.8);
    });
  });

  describe('combined adjustments', () => {
    it('should apply all adjustments together', () => {
      const departureTime = new Date();
      departureTime.setHours(8, 0, 0); // Morning peak

      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime,
        traffic: {
          delayMin: 5,
          confidence: 0.85,
        },
        weather: {
          condition: 'rain',
          severity: 'moderate',
        },
        zoneType: 'urban',
      });

      expect(result.adjustmentFactors.length).toBeGreaterThan(1);
      expect(result.adjustedDurationMin).toBeGreaterThan(result.baseDurationMin);
    });

    it('should maintain order of adjustments', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        traffic: {
          delayMin: 5,
          confidence: 0.85,
        },
        weather: {
          condition: 'rain',
          severity: 'moderate',
        },
      });

      const steps = result.adjustmentFactors.map((f) => f.step);
      const expectedOrder = ['traffic', 'weather', 'time_of_day', 'zone_specific'];
      const actualOrder = steps.filter((s) => expectedOrder.includes(s));

      // Check that traffic comes before weather
      const trafficIdx = actualOrder.indexOf('traffic');
      const weatherIdx = actualOrder.indexOf('weather');
      if (trafficIdx !== -1 && weatherIdx !== -1) {
        expect(trafficIdx).toBeLessThan(weatherIdx);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle zero base duration', () => {
      const result = pipeline.process({
        baseDurationMin: 0,
        departureTime: new Date(),
      });

      expect(result.adjustedDurationMin).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large adjustments', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
        traffic: {
          delayMin: 500,
          confidence: 0.85,
        },
        weather: {
          condition: 'snow',
          severity: 'heavy',
        },
      });

      expect(result.adjustedDurationMin).toBeGreaterThan(result.baseDurationMin);
    });

    it('should produce valid bounds', () => {
      const result = pipeline.process({
        baseDurationMin: 30,
        departureTime: new Date(),
      });

      expect(result.lowerBoundMin).toBeLessThanOrEqual(result.adjustedDurationMin);
      expect(result.adjustedDurationMin).toBeLessThanOrEqual(result.upperBoundMin);
    });
  });
});
