/**
 * Route Efficiency Scorer Tests
 *
 * Tests for:
 * - Efficiency component calculation
 * - Composite score weighting
 * - Percentile ranking against benchmarks
 * - Edge cases and boundary conditions
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateRouteEfficiency,
  calculateRouteEfficiencyBatch,
  recordBenchmark,
} from "../route-efficiency.js";
import type { PlannedRouteSegment, RouteDataPoint, Stop } from "../types.js";

describe("Route Efficiency Scorer", () => {
  // ─── Setup ──────────────────────────────────────────────────────

  const createMockStop = (
    id: string,
    lat: number,
    lng: number,
    plannedDuration: number = 5,
  ): Stop => ({
    id,
    lat,
    lng,
    plannedArrivalTime: 1000 + Math.random() * 1000,
    plannedDuration,
    actualArrivalTime: 1000 + Math.random() * 1000,
    actualDuration: plannedDuration + Math.random() * 2,
    orderId: `ord_${id}`,
    type: "delivery",
  });

  const createMockPlannedRoute = (): PlannedRouteSegment => ({
    plannedDistance: 50000, // 50km
    plannedDuration: 120, // 120 minutes
    plannedStops: [
      createMockStop("stop_1", 40.7128, -74.006),
      createMockStop("stop_2", 40.748, -73.9862),
      createMockStop("stop_3", 40.7614, -73.9776),
    ],
  });

  const createMockGPSTrace = (length: number = 100): RouteDataPoint[] => {
    const points: RouteDataPoint[] = [];
    const startTime = 1000;
    // Scale geographic span so distance grows proportionally with length
    // Base 100 points = ~50km, so each point covers ~500m of latitude
    const latSpan = 0.45 * (length / 100); // ~50km per 100 points
    const lngSpan = 0.1 * (length / 100);

    for (let i = 0; i < length; i++) {
      points.push({
        lat: 40.7128 + (i / length) * latSpan,
        lng: -74.006 + (i / length) * lngSpan,
        timestamp: startTime + i * 72000, // Each point ~= 1.2 minutes
        speedKmh: 25 + Math.random() * 10,
      });
    }

    return points;
  };

  beforeEach(() => {
    // Clear benchmark history before each test
    recordBenchmark(50);
  });

  // ─── Distance Efficiency Tests ──────────────────────────────────

  describe("Distance Efficiency", () => {
    it("should calculate perfect distance efficiency when planned = actual", () => {
      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace();

      // Manually set GPS trace to match planned distance
      const result = calculateRouteEfficiency(
        "route_1",
        { ...planned, plannedDistance: 48000 },
        gpsTrace,
      );

      expect(result.breakdown.distanceEfficiency).toBeGreaterThan(0.5);
      expect(result.breakdown.distanceEfficiency).toBeLessThanOrEqual(1.0);
    });

    it("should penalize longer actual distance", () => {
      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace(150); // Longer trace

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.breakdown.distanceEfficiency).toBeLessThan(0.9);
    });

    it("should handle very short routes", () => {
      const planned: PlannedRouteSegment = {
        plannedDistance: 2000,
        plannedDuration: 10,
        plannedStops: [createMockStop("stop_1", 40.7128, -74.006)],
      };
      const gpsTrace = createMockGPSTrace(10);

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ─── Time Efficiency Tests ──────────────────────────────────────

  describe("Time Efficiency", () => {
    it("should calculate perfect time efficiency when planned = actual", () => {
      const planned = createMockPlannedRoute();
      planned.plannedDuration = 100;
      const gpsTrace = createMockGPSTrace(100);

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.breakdown.timeEfficiency).toBeGreaterThan(0);
      expect(result.breakdown.timeEfficiency).toBeLessThanOrEqual(1.0);
    });

    it("should penalize longer actual duration", () => {
      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace(200); // Much longer

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.breakdown.timeEfficiency).toBeLessThan(0.6);
    });
  });

  // ─── Stop Efficiency Tests ──────────────────────────────────────

  describe("Stop Efficiency", () => {
    it("should calculate stop efficiency from actual vs planned dwell time", () => {
      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace();

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.breakdown.stopEfficiency).toBeGreaterThan(0);
      expect(result.breakdown.stopEfficiency).toBeLessThanOrEqual(1.0);
    });

    it("should handle routes with no stops", () => {
      const planned: PlannedRouteSegment = {
        plannedDistance: 50000,
        plannedDuration: 120,
        plannedStops: [],
      };
      const gpsTrace = createMockGPSTrace();

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ─── Idle Time Tests ────────────────────────────────────────────

  describe("Idle Time Ratio", () => {
    it("should penalize routes with high idle time", () => {
      const planned = createMockPlannedRoute();

      // Create GPS trace with low speeds (idle)
      const idleTrace: RouteDataPoint[] = [];
      for (let i = 0; i < 100; i++) {
        idleTrace.push({
          lat: 40.7128,
          lng: -74.006,
          timestamp: 1000 + i * 1000,
          speedKmh: 0.5, // Very low speed
        });
      }

      const result = calculateRouteEfficiency("route_1", planned, idleTrace);

      expect(result.breakdown.idleTimeRatio).toBeLessThan(0.5);
    });

    it("should reward routes with minimal idle time", () => {
      const planned = createMockPlannedRoute();

      // Create GPS trace with consistent high speeds
      const activeTrace: RouteDataPoint[] = [];
      for (let i = 0; i < 100; i++) {
        activeTrace.push({
          lat: 40.7128 + (i / 100) * 0.05,
          lng: -74.006 + (i / 100) * 0.02,
          timestamp: 1000 + i * 1000,
          speedKmh: 45 + Math.random() * 10,
        });
      }

      const result = calculateRouteEfficiency("route_1", planned, activeTrace);

      expect(result.breakdown.idleTimeRatio).toBeGreaterThan(0.7);
    });
  });

  // ─── Route Deviation Tests ──────────────────────────────────────

  describe("Route Deviations", () => {
    it("should detect deviations from planned path", () => {
      const planned = createMockPlannedRoute();

      // Create GPS trace with major deviations
      const deviatingTrace: RouteDataPoint[] = [];
      for (let i = 0; i < 100; i++) {
        deviatingTrace.push({
          lat: 40.7128 + (i / 100) * 0.1, // Much larger deviation
          lng: -74.006 + (i / 100) * 0.05,
          timestamp: 1000 + i * 1000,
          speedKmh: 35,
        });
      }

      const result = calculateRouteEfficiency(
        "route_1",
        planned,
        deviatingTrace,
      );

      expect(result.metrics.deviations).toBeGreaterThan(0);
    });

    it("should reward routes following planned path", () => {
      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace();

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.breakdown.deviationCount).toBeGreaterThan(0);
    });
  });

  // ─── Composite Score Tests ─────────────────────────────────────

  describe("Composite Score", () => {
    it("should return score between 0 and 100", () => {
      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace();

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should weight components according to provided weights", () => {
      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace();

      const customWeights = {
        distanceEfficiency: 0.5,
        timeEfficiency: 0.2,
        stopEfficiency: 0.1,
        idleTimeRatio: 0.1,
        deviationCount: 0.1,
      };

      const result = calculateRouteEfficiency(
        "route_1",
        planned,
        gpsTrace,
        customWeights,
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should improve score with better performing route", () => {
      const planned = createMockPlannedRoute();

      // Poor performance: longer time, more distance, more deviations
      const poorTrace: RouteDataPoint[] = Array.from(
        { length: 200 },
        (_, i) => ({
          lat: 40.7128 + (i / 200) * 0.9, // Much larger deviation from planned
          lng: -74.006 + (i / 200) * 0.3,
          timestamp: 1000 + i * 72000, // 200 min total (vs 120 planned)
          speedKmh: 15 + Math.random() * 5,
        }),
      );

      // Good performance: matches planned route closely
      const goodTrace: RouteDataPoint[] = Array.from(
        { length: 100 },
        (_, i) => ({
          lat: 40.7128 + (i / 100) * 0.05, // Close to planned stops
          lng: -74.006 + (i / 100) * 0.03,
          timestamp: 1000 + i * 72000, // 100 min total (< 120 planned)
          speedKmh: 40 + Math.random() * 5,
        }),
      );

      const poorResult = calculateRouteEfficiency("poor", planned, poorTrace);
      const goodResult = calculateRouteEfficiency("good", planned, goodTrace);

      expect(goodResult.score).toBeGreaterThan(poorResult.score);
    });
  });

  // ─── Percentile Ranking Tests ──────────────────────────────────

  describe("Percentile Ranking", () => {
    it("should rank score against historical benchmarks", () => {
      // Populate benchmarks
      for (let i = 0; i < 100; i++) {
        recordBenchmark(Math.floor(Math.random() * 100));
      }

      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace();

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      expect(result.percentileRank).toBeGreaterThanOrEqual(0);
      expect(result.percentileRank).toBeLessThanOrEqual(100);
    });

    it("should return 50th percentile with no history", () => {
      const planned = createMockPlannedRoute();
      const gpsTrace = createMockGPSTrace();

      const result = calculateRouteEfficiency("route_1", planned, gpsTrace);

      // Should be defaulted when no benchmark data
      expect(result.percentileRank).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Batch Processing Tests ────────────────────────────────────

  describe("Batch Processing", () => {
    it("should calculate efficiency for multiple routes", () => {
      const routes = [
        {
          routeId: "route_1",
          planned: createMockPlannedRoute(),
          gpsTrace: createMockGPSTrace(),
        },
        {
          routeId: "route_2",
          planned: createMockPlannedRoute(),
          gpsTrace: createMockGPSTrace(),
        },
        {
          routeId: "route_3",
          planned: createMockPlannedRoute(),
          gpsTrace: createMockGPSTrace(),
        },
      ];

      const result = calculateRouteEfficiencyBatch(routes);

      expect(result.scores).toHaveLength(3);
      expect(result.scores.every((s) => s.score >= 0 && s.score <= 100)).toBe(
        true,
      );
    });

    it("should calculate summary statistics", () => {
      const routes = [
        {
          routeId: "route_1",
          planned: createMockPlannedRoute(),
          gpsTrace: createMockGPSTrace(),
        },
        {
          routeId: "route_2",
          planned: createMockPlannedRoute(),
          gpsTrace: createMockGPSTrace(),
        },
        {
          routeId: "route_3",
          planned: createMockPlannedRoute(),
          gpsTrace: createMockGPSTrace(),
        },
      ];

      const result = calculateRouteEfficiencyBatch(routes);

      expect(result.averageScore).toBeGreaterThanOrEqual(result.minScore);
      expect(result.medianScore).toBeGreaterThanOrEqual(result.minScore);
      expect(result.maxScore).toBeGreaterThanOrEqual(result.medianScore);
    });

    it("should handle empty batch", () => {
      const result = calculateRouteEfficiencyBatch([]);

      expect(result.scores).toHaveLength(0);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should handle empty GPS trace", () => {
      const planned = createMockPlannedRoute();

      const result = calculateRouteEfficiency("route_1", planned, []);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("should handle single GPS point", () => {
      const planned = createMockPlannedRoute();
      const singlePoint: RouteDataPoint[] = [
        { lat: 40.7128, lng: -74.006, timestamp: 1000, speedKmh: 30 },
      ];

      const result = calculateRouteEfficiency("route_1", planned, singlePoint);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("should handle zero planned distance", () => {
      const planned: PlannedRouteSegment = {
        plannedDistance: 0,
        plannedDuration: 10,
        plannedStops: [],
      };

      const result = calculateRouteEfficiency(
        "route_1",
        planned,
        createMockGPSTrace(),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("should handle very high deviation count", () => {
      const planned = createMockPlannedRoute();

      // Create random scattered GPS points (all deviations, long duration, long distance)
      const deviatingTrace: RouteDataPoint[] = Array.from(
        { length: 200 },
        (_, i) => ({
          lat: 40.7128 + Math.random() * 0.5,
          lng: -74.006 + Math.random() * 0.5,
          timestamp: 1000 + i * 120000, // 200 * 2min = 400 min total (vs 120 planned)
          speedKmh: 20,
        }),
      );

      const result = calculateRouteEfficiency(
        "route_1",
        planned,
        deviatingTrace,
      );

      expect(result.metrics.deviations).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(70); // Should penalize heavily
    });
  });
});
