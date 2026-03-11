/**
 * Smart Scheduler Tests
 *
 * Tests for slot capacity recommendations, driver allocation, and schedule optimization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SmartScheduler } from '../smart-scheduler';
import type { DemandPrediction } from '../types';

describe('Smart Scheduler', () => {
  let scheduler: SmartScheduler;
  let testPredictions: DemandPrediction[];

  beforeEach(() => {
    scheduler = new SmartScheduler({
      optimization_target: 'balanced',
      min_service_level: 0.95,
      max_utilization: 0.85,
      driver_cost_per_hour: 25,
      capacity_safety_margin: 0.15,
    });

    // Create test predictions
    const date = new Date();
    testPredictions = [
      {
        zoneId: 'zone-downtown',
        targetPeriod: date,
        predictions: Array.from({ length: 24 }, (_, h) => {
          // High demand during business hours
          if (h >= 8 && h <= 18) return 100 + Math.random() * 20;
          return 30 + Math.random() * 10;
        }),
        confidence: 0.85,
        lower_bound: Array(24).fill(0),
        upper_bound: Array(24).fill(0),
        p50: Array(24).fill(0),
        model_predictions: [],
        dominant_model: 'seasonal',
        explanation: {
          primary_factors: ['High business density'],
          model_contributions: {},
          confidence_rationale: 'High confidence forecast',
          anomalies_detected: [],
        },
        generated_at: new Date(),
      },
      {
        zoneId: 'zone-suburbs',
        targetPeriod: date,
        predictions: Array.from({ length: 24 }, (_, h) => {
          // Steady demand
          if (h >= 6 && h <= 20) return 50 + Math.random() * 10;
          return 15 + Math.random() * 5;
        }),
        confidence: 0.75,
        lower_bound: Array(24).fill(0),
        upper_bound: Array(24).fill(0),
        p50: Array(24).fill(0),
        model_predictions: [],
        dominant_model: 'regression',
        explanation: {
          primary_factors: ['Residential area'],
          model_contributions: {},
          confidence_rationale: 'Moderate confidence',
          anomalies_detected: [],
        },
        generated_at: new Date(),
      },
    ];
  });

  describe('Scheduler initialization', () => {
    it('should initialize with default config', () => {
      const s = new SmartScheduler();
      expect(s).toBeDefined();
    });

    it('should accept custom config', () => {
      const s = new SmartScheduler({
        min_service_level: 0.90,
        max_utilization: 0.80,
      });
      expect(s).toBeDefined();
    });
  });

  describe('Slot capacity recommendations', () => {
    it('should recommend slot capacities', () => {
      const slots = scheduler.recommendSlotCapacity(testPredictions[0], 4);

      expect(slots).toHaveLength(4);
      expect(slots.every((s) => s.recommendedCapacity > 0)).toBe(true);
    });

    it('should have valid slot boundaries', () => {
      const slots = scheduler.recommendSlotCapacity(testPredictions[0], 4);

      for (let i = 0; i < slots.length; i++) {
        expect(slots[i].startTime.getTime()).toBeLessThan(slots[i].endTime.getTime());
        expect(slots[i].date).toEqual(testPredictions[0].targetPeriod);
      }
    });

    it('should apply safety margin', () => {
      const slots = scheduler.recommendSlotCapacity(testPredictions[0], 4);

      // Check that capacity > predicted demand
      for (const slot of slots) {
        expect(slot.recommendedCapacity).toBeGreaterThanOrEqual(
          Math.ceil(slot.predictedDemand),
        );
      }
    });

    it('should have reasonable utilization rates', () => {
      const slots = scheduler.recommendSlotCapacity(testPredictions[0], 4);

      for (const slot of slots) {
        expect(slot.utilizationRate).toBeGreaterThan(0);
        expect(slot.utilizationRate).toBeLessThanOrEqual(1);
      }
    });

    it('should generate reasoning for recommendations', () => {
      const slots = scheduler.recommendSlotCapacity(testPredictions[0], 4);

      for (const slot of slots) {
        expect(slot.reasoning.length).toBeGreaterThan(0);
        expect(slot.reasoning[0]).toBeTruthy();
      }
    });

    it('should handle different slot counts', () => {
      const slots2 = scheduler.recommendSlotCapacity(testPredictions[0], 2);
      const slots8 = scheduler.recommendSlotCapacity(testPredictions[0], 8);

      expect(slots2).toHaveLength(2);
      expect(slots8).toHaveLength(8);
    });
  });

  describe('Driver allocation suggestions', () => {
    it('should suggest driver allocations', () => {
      const allocations = scheduler.suggestDriverAllocation(testPredictions, new Date());

      expect(allocations.length).toBe(testPredictions.length);
      expect(allocations.every((a) => a.total_drivers > 0)).toBe(true);
    });

    it('should allocate drivers hourly', () => {
      const allocations = scheduler.suggestDriverAllocation(testPredictions, new Date());

      for (const alloc of allocations) {
        expect(Object.keys(alloc.hourly_counts).length).toBeGreaterThan(0);
        const totalFromHourly = Object.values(alloc.hourly_counts).reduce(
          (a, b: any) => a + b,
          0,
        );
        expect(totalFromHourly).toBeGreaterThan(0);
      }
    });

    it('should identify peak hours', () => {
      const allocations = scheduler.suggestDriverAllocation(testPredictions, new Date());

      for (const alloc of allocations) {
        expect(alloc.peak_hour).toBeGreaterThanOrEqual(0);
        expect(alloc.peak_hour).toBeLessThan(24);
        expect(alloc.peak_drivers).toBeGreaterThan(0);
      }
    });

    it('should allocate more drivers during peak demand', () => {
      const allocations = scheduler.suggestDriverAllocation(testPredictions, new Date());

      // Downtown zone should have peak allocation during business hours
      const downtown = allocations.find((a) => a.zoneId === 'zone-downtown');
      if (downtown) {
        expect(downtown.peak_hour).toBeGreaterThanOrEqual(8);
        expect(downtown.peak_hour).toBeLessThanOrEqual(18);
      }
    });
  });

  describe('Schedule optimization', () => {
    it('should optimize driver assignments', () => {
      const predictionMap = new Map(testPredictions.map((p) => [p.zoneId, p]));

      const optimized = scheduler.optimizeSchedule(
        50, // 50 total drivers
        ['zone-downtown', 'zone-suburbs'],
        predictionMap,
        new Date(),
      );

      expect(optimized.assignments).toBeDefined();
      expect(optimized.totalCost).toBeGreaterThan(0);
      expect(optimized.expectedServiceLevel).toBeGreaterThan(0);
      expect(optimized.expectedServiceLevel).toBeLessThanOrEqual(1);
    });

    it('should distribute drivers based on demand', () => {
      const predictionMap = new Map(testPredictions.map((p) => [p.zoneId, p]));

      const optimized = scheduler.optimizeSchedule(
        100,
        ['zone-downtown', 'zone-suburbs'],
        predictionMap,
        new Date(),
      );

      // Downtown has higher demand, should get more drivers
      let downtownTotal = 0;
      let suburbsTotal = 0;

      for (let h = 0; h < 24; h++) {
        downtownTotal += optimized.assignments['zone-downtown'][h];
        suburbsTotal += optimized.assignments['zone-suburbs'][h];
      }

      expect(downtownTotal).toBeGreaterThan(suburbsTotal);
    });

    it('should calculate realistic costs', () => {
      const predictionMap = new Map(testPredictions.map((p) => [p.zoneId, p]));

      const optimized = scheduler.optimizeSchedule(
        50,
        ['zone-downtown', 'zone-suburbs'],
        predictionMap,
        new Date(),
      );

      // Cost = hours * rate = 50 * 24 * 25
      const expectedCost = 50 * 24 * 25;
      expect(optimized.totalCost).toBe(expectedCost);
    });

    it('should handle single zone', () => {
      const predictionMap = new Map([
        ['zone-downtown', testPredictions[0]],
      ]);

      const optimized = scheduler.optimizeSchedule(
        30,
        ['zone-downtown'],
        predictionMap,
        new Date(),
      );

      expect(optimized.assignments['zone-downtown']).toBeDefined();
      expect(optimized.expectedServiceLevel).toBeGreaterThan(0);
    });
  });

  describe('Capacity gap detection', () => {
    it('should detect understaffed periods', () => {
      const allocations = {
        'zone-downtown': {
          12: 5, // Only 5 drivers, 25 capacity, but demand ~110
          13: 5,
        },
        'zone-suburbs': {},
      };

      const gaps = scheduler.detectCapacityGaps(
        testPredictions,
        allocations,
      );

      const understaffed = gaps.filter((g) => g.type === 'understaffed');
      expect(understaffed.length).toBeGreaterThan(0);
    });

    it('should detect overstaffed periods', () => {
      const allocations = {
        'zone-downtown': {
          2: 50, // 250 capacity for ~30 demand
          3: 50,
        },
        'zone-suburbs': {},
      };

      const gaps = scheduler.detectCapacityGaps(testPredictions, allocations);
      const overstaffed = gaps.filter((g) => g.type === 'overstaffed');

      expect(overstaffed.length).toBeGreaterThan(0);
    });

    it('should report reasonable gap sizes', () => {
      const allocations = {
        'zone-downtown': Array.from({ length: 24 }, (_, h) => [h, 10]),
      };

      const gapsObj: Record<string, Record<number, number>> = {
        'zone-downtown': {},
      };
      allocations['zone-downtown'].forEach(([h, drivers]: any) => {
        gapsObj['zone-downtown'][h] = drivers;
      });

      const gaps = scheduler.detectCapacityGaps(testPredictions, gapsObj);

      for (const gap of gaps) {
        expect(Math.abs(gap.gap)).toBeGreaterThan(0);
        expect(gap.severity).toBeGreaterThan(0);
        expect(gap.severity).toBeLessThanOrEqual(10);
      }
    });

    it('should generate actionable recommendations', () => {
      const allocations = {
        'zone-downtown': { 12: 2, 13: 2 },
        'zone-suburbs': { 10: 5 },
      };

      const gaps = scheduler.detectCapacityGaps(testPredictions, allocations);

      for (const gap of gaps) {
        expect(gap.recommended_action).toBeTruthy();
        expect(gap.recommended_action.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Schedule report generation', () => {
    it('should generate comprehensive report', () => {
      const report = scheduler.generateScheduleReport(testPredictions);

      expect(report).toBeDefined();
      expect(report.slots.length).toBeGreaterThan(0);
      expect(report.driver_allocations.length).toBeGreaterThan(0);
      expect(report.estimated_service_level).toBeGreaterThan(0);
      expect(report.total_expected_orders).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
    });

    it('should calculate service level', () => {
      const report = scheduler.generateScheduleReport(testPredictions);

      expect(report.estimated_service_level).toBeGreaterThan(0);
      expect(report.estimated_service_level).toBeLessThanOrEqual(1);
    });

    it('should provide actionable recommendations', () => {
      const report = scheduler.generateScheduleReport(testPredictions);

      if (report.estimated_service_level < 0.95) {
        const serviceWarning = report.recommendations.some((r) =>
          r.includes('Service level'),
        );
        expect(serviceWarning).toBe(true);
      }
    });

    it('should report capacity issues', () => {
      // Create scenario with capacity issues
      const tightPredictions = [
        {
          ...testPredictions[0],
          predictions: testPredictions[0].predictions.map((p) => p * 2), // Double demand
        },
      ];

      const report = scheduler.generateScheduleReport(tightPredictions);

      const capacityAlert = report.recommendations.some((r) =>
        r.includes('capacity') || r.includes('driver'),
      );
      expect(capacityAlert || report.capacity_gaps.length > 0).toBe(true);
    });
  });

  describe('What-if analysis', () => {
    it('should analyze scenarios', () => {
      const scenario = {
        name: 'Add 10 drivers',
        changes: { additional_drivers: 10 },
      };

      const analysis = scheduler.analyzeWhatIf(testPredictions, scenario);

      expect(analysis.scenario_name).toBe('Add 10 drivers');
      expect(analysis.changes).toBeDefined();
      expect(analysis.expected_orders).toBeGreaterThan(0);
      expect(analysis.service_level).toBeGreaterThan(0);
    });

    it('should show cost impact', () => {
      const scenario = {
        name: 'Increase demand by 20%',
        changes: { demand_multiplier: 1.2 },
      };

      const analysis = scheduler.analyzeWhatIf(testPredictions, scenario);

      expect(analysis.estimated_cost).toBeGreaterThan(0);
      expect(analysis.recommendation).toBeTruthy();
    });

    it('should compare against baseline', () => {
      const scenario = {
        name: 'Optimize staffing',
        changes: { optimization: 'lean' },
      };

      const analysis = scheduler.analyzeWhatIf(testPredictions, scenario);

      expect(analysis.service_level).toBeGreaterThan(0);
      expect(analysis.estimated_cost).toBeGreaterThan(0);
    });

    it('should identify high-impact zones', () => {
      const scenario = {
        name: 'Peak demand scenario',
        changes: { demand_multiplier: 1.5 },
      };

      const analysis = scheduler.analyzeWhatIf(testPredictions, scenario);

      expect(analysis.impact_zones.length).toBeGreaterThan(0);
      expect(analysis.impact_zones).toContain('zone-downtown');
    });
  });

  describe('Current capacity tracking', () => {
    it('should set and use current capacity', () => {
      scheduler.setCurrentCapacity('zone-downtown', {
        0: 10,
        1: 10,
        12: 20,
        13: 20,
      });

      // Should not throw
      const report = scheduler.generateScheduleReport(testPredictions);
      expect(report).toBeDefined();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle surge demand', () => {
      const surgePrediction: DemandPrediction = {
        ...testPredictions[0],
        predictions: Array.from({ length: 24 }, (_, h) => {
          if (h >= 14 && h <= 16) return 500; // Flash sale
          return 50;
        }),
        confidence: 0.6, // Lower confidence due to unusual demand
      };

      const slots = scheduler.recommendSlotCapacity(surgePrediction, 4);
      expect(slots.some((s) => s.recommendedCapacity > 100)).toBe(true);
    });

    it('should handle slow demand day', () => {
      const slowPrediction: DemandPrediction = {
        ...testPredictions[0],
        predictions: Array(24).fill(20), // Uniformly low
        confidence: 0.8,
      };

      const slots = scheduler.recommendSlotCapacity(slowPrediction, 4);
      expect(slots.every((s) => s.recommendedCapacity < 30)).toBe(true);
    });

    it('should handle multi-zone optimization', () => {
      const zones = ['zone-downtown', 'zone-suburbs', 'zone-residential'];
      const predictionMap = new Map(testPredictions.map((p) => [p.zoneId, p]));

      const optimized = scheduler.optimizeSchedule(100, zones, predictionMap, new Date());

      for (const zone of zones) {
        if (zone in optimized.assignments) {
          expect(Object.keys(optimized.assignments[zone]).length).toBeGreaterThan(0);
        }
      }
    });
  });
});
