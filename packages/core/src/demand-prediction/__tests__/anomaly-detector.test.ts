/**
 * Anomaly Detection Tests
 *
 * Tests for CUSUM detection, EWMA control charts, and anomaly classification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeStatistics,
  updateEWMA,
  CUSUMDetector,
  classifyAnomaly,
  calculateSeverity,
  detectAnomaly,
  detectAnomalies,
  calculateControlLimits,
} from '../models/anomaly-detector';

describe('Anomaly Detection', () => {
  let historicalValues: number[];
  let controlValues: number[];

  beforeEach(() => {
    // Create realistic historical demand data
    historicalValues = Array.from({ length: 100 }, (_, i) => {
      const base = 50;
      const seasonal = 10 * Math.sin((i * 2 * Math.PI) / 24);
      const noise = (Math.random() - 0.5) * 5;
      return Math.max(0, base + seasonal + noise);
    });

    // Control period without anomalies
    controlValues = Array.from({ length: 50 }, (_, i) => {
      const base = 50;
      const seasonal = 10 * Math.sin((i * 2 * Math.PI) / 24);
      return base + seasonal;
    });
  });

  describe('initializeStatistics', () => {
    it('should calculate mean correctly', () => {
      const stats = initializeStatistics(historicalValues);
      const expectedMean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;

      expect(Math.abs(stats.mean - expectedMean)).toBeLessThan(1);
    });

    it('should calculate standard deviation', () => {
      const stats = initializeStatistics(historicalValues);

      expect(stats.stdDev).toBeGreaterThan(0);
      expect(stats.stdDev).toBeLessThan(20);
    });

    it('should initialize EWMA', () => {
      const stats = initializeStatistics(historicalValues);

      expect(stats.ewma).toBeGreaterThan(0);
      expect(stats.ewmaVar).toBeGreaterThan(0);
    });

    it('should handle empty array', () => {
      const stats = initializeStatistics([]);

      expect(stats.mean).toBe(0);
      expect(stats.stdDev).toBe(0);
    });
  });

  describe('updateEWMA', () => {
    it('should update EWMA with new observation', () => {
      const stats = initializeStatistics(controlValues);
      const newObs = 55;
      const updated = updateEWMA(stats, newObs, 0.3);

      expect(updated.ewma).toBeGreaterThan(0);
      expect(updated.ewmaVar).toBeGreaterThan(0);
    });

    it('should move toward observation over time', () => {
      let stats = initializeStatistics(controlValues);
      const newObs = 100; // Much higher than mean

      // Apply multiple times
      for (let i = 0; i < 10; i++) {
        stats = updateEWMA(stats, newObs, 0.2);
      }

      expect(stats.ewma).toBeGreaterThan(50);
      expect(stats.ewma).toBeLessThan(newObs);
    });

    it('different lambda values should affect convergence speed', () => {
      const stats0 = initializeStatistics(controlValues);
      const newObs = 80;

      let s1 = stats0;
      let s2 = stats0;

      for (let i = 0; i < 5; i++) {
        s1 = updateEWMA(s1, newObs, 0.1); // Slow
        s2 = updateEWMA(s2, newObs, 0.5); // Fast
      }

      expect(s2.ewma).toBeGreaterThan(s1.ewma); // s2 converged faster
    });
  });

  describe('CUSUMDetector', () => {
    it('should initialize without error', () => {
      const detector = new CUSUMDetector(historicalValues);
      expect(detector).toBeDefined();
    });

    it('should detect spike anomaly', () => {
      const detector = new CUSUMDetector(controlValues);

      // Normal observations
      for (let i = 0; i < 10; i++) {
        const result = detector.update(50);
        expect(result.isAnomaly).toBe(false);
      }

      // Spike
      const result = detector.update(100);
      expect(result.isAnomaly).toBe(true);
    });

    it('should accumulate positive sum on high values', () => {
      const detector = new CUSUMDetector(controlValues);

      for (let i = 0; i < 20; i++) {
        detector.update(60); // Above mean
      }

      const result = detector.update(55);
      expect(result.positiveSum).toBeGreaterThan(0);
    });

    it('should accumulate negative sum on low values', () => {
      const detector = new CUSUMDetector(controlValues);

      for (let i = 0; i < 20; i++) {
        detector.update(40); // Below mean
      }

      const result = detector.update(45);
      expect(result.negativeSum).toBeLessThan(0);
    });

    it('should reset after detection', () => {
      const detector = new CUSUMDetector(controlValues, 3);

      // Feed high values until anomaly detected (CUSUM resets on detection)
      let detected = false;
      for (let i = 0; i < 30; i++) {
        const result = detector.update(70);
        if (result.isAnomaly) {
          detected = true;
          // After anomaly detection, sums should be reset to 0
          expect(result.positiveSum).toBe(0);
          expect(result.negativeSum).toBe(0);
          break;
        }
      }

      expect(detected).toBe(true);
    });
  });

  describe('classifyAnomaly', () => {
    it('should classify spike', () => {
      const expected = 50;
      const observed = 100;
      const type = classifyAnomaly(observed, expected, 5, controlValues);

      expect(type).toBe('spike');
    });

    it('should classify drop', () => {
      const expected = 50;
      const observed = 10;
      const type = classifyAnomaly(observed, expected, 5, controlValues);

      expect(type).toBe('drop');
    });

    it('should classify trend-shift', () => {
      const expected = 50;
      const observed = 55;
      // Create history showing trend shift
      const history = Array(40)
        .fill(50)
        .concat(Array(20).fill(70));

      const type = classifyAnomaly(observed, expected, 5, history);
      expect(['trend-shift', 'gradual-drift', 'none']).toContain(type);
    });

    it('should return none for normal values', () => {
      const expected = 50;
      const observed = 51;
      const type = classifyAnomaly(observed, expected, 5, controlValues);

      expect(type).toBe('none');
    });
  });

  describe('calculateSeverity', () => {
    it('should give higher severity to larger deviations', () => {
      const s1 = calculateSeverity(55, 50, 5, 'spike');
      const s2 = calculateSeverity(100, 50, 5, 'spike');

      expect(s2).toBeGreaterThan(s1);
    });

    it('should adjust severity by anomaly type', () => {
      const obs = 80;
      const exp = 50;

      const sSpike = calculateSeverity(obs, exp, 5, 'spike');
      const sGradual = calculateSeverity(obs, exp, 5, 'gradual-drift');
      const sTrendShift = calculateSeverity(obs, exp, 5, 'trend-shift');

      expect(sTrendShift).toBeGreaterThan(sSpike);
      expect(sSpike).toBeGreaterThan(sGradual);
    });

    it('should be between 1 and 10', () => {
      for (let i = 0; i < 10; i++) {
        const severity = calculateSeverity(
          Math.random() * 100,
          50,
          5,
          'spike',
        );

        expect(severity).toBeGreaterThanOrEqual(1);
        expect(severity).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('detectAnomaly', () => {
    it('should detect spike anomalies', () => {
      const observation = 120;
      const expected = 50;
      const timestamp = new Date();
      const detector = new CUSUMDetector(controlValues);

      const anomaly = detectAnomaly(
        observation,
        expected,
        controlValues,
        timestamp,
        detector,
      );

      expect(anomaly.type).toBe('spike');
      expect(anomaly.severity).toBeGreaterThan(5);
      expect(anomaly.shouldAlert).toBe(true);
    });

    it('should not alert on minor variations', () => {
      const observation = 52;
      const expected = 50;
      const timestamp = new Date();
      const detector = new CUSUMDetector(controlValues);

      const anomaly = detectAnomaly(
        observation,
        expected,
        controlValues,
        timestamp,
        detector,
      );

      expect(anomaly.type).toBe('none');
      expect(anomaly.shouldAlert).toBe(false);
    });

    it('should generate meaningful message', () => {
      const observation = 90;
      const expected = 50;
      const timestamp = new Date();
      const detector = new CUSUMDetector(controlValues);

      const anomaly = detectAnomaly(
        observation,
        expected,
        controlValues,
        timestamp,
        detector,
      );

      expect(anomaly.message).toBeTruthy();
      expect(anomaly.message.length).toBeGreaterThan(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect multiple anomalies', () => {
      const observations = [
        { value: 50, expected: 50, timestamp: new Date() },
        { value: 150, expected: 50, timestamp: new Date() }, // Spike
        { value: 55, expected: 50, timestamp: new Date() },
        { value: 10, expected: 50, timestamp: new Date() }, // Drop
      ];

      const anomalies = detectAnomalies(observations, controlValues);

      expect(anomalies.length).toBeGreaterThan(0);
      const types = anomalies.map((a) => a.type);
      expect(types).toContain('spike');
      expect(types).toContain('drop');
    });

    it('should handle empty observations', () => {
      const anomalies = detectAnomalies([], controlValues);
      expect(anomalies).toHaveLength(0);
    });
  });

  describe('calculateControlLimits', () => {
    it('should calculate Shewhart control limits', () => {
      const limits = calculateControlLimits(controlValues);

      expect(limits.center).toBeGreaterThan(0);
      expect(limits.upper_control_limit).toBeGreaterThan(limits.center);
      expect(limits.lower_control_limit).toBeLessThan(limits.center);
    });

    it('should have warning limits inside control limits', () => {
      const limits = calculateControlLimits(controlValues);

      expect(limits.upper_warning_limit).toBeLessThan(limits.upper_control_limit);
      expect(limits.lower_warning_limit).toBeGreaterThan(limits.lower_control_limit);
    });

    it('should have non-negative lower limits', () => {
      const limits = calculateControlLimits(controlValues);
      expect(limits.lower_control_limit).toBeGreaterThanOrEqual(0);
      expect(limits.lower_warning_limit).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle demand spike during peak hours', () => {
      const normal = Array(20).fill(50);
      const spike = Array(5).fill(150); // Peak surge
      const recovery = Array(20).fill(55);
      const full = [...normal, ...spike, ...recovery];

      const anomalies = detectAnomalies(
        spike.map((v, i) => ({
          value: v,
          expected: 50,
          timestamp: new Date(),
        })),
        normal,
      );

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some((a) => a.type === 'spike')).toBe(true);
    });

    it('should detect sustained demand drop', () => {
      const normal = Array(30).fill(50);
      const drop = Array(10).fill(20); // Sustained low demand
      const observations = drop.map((v) => ({
        value: v,
        expected: 50,
        timestamp: new Date(),
      }));

      const anomalies = detectAnomalies(observations, normal);

      const dropDetected = anomalies.some(
        (a) => a.type === 'drop' || a.type === 'trend-shift',
      );
      expect(dropDetected).toBe(true);
    });
  });
});
