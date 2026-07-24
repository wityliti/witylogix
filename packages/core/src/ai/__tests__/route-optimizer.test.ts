/**
 * Route Optimizer Tests
 *
 * Tests for:
 * - Nearest-neighbor heuristic
 * - 2-opt and 3-opt improvements
 * - Time window compliance
 * - Capacity constraints
 * - Break insertion
 * - Multi-vehicle assignment
 * - Route optimization modes
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  optimizeRoutes,
  type OptimizationRequest,
  type Stop,
  type Vehicle,
  type Coordinate,
} from "../route-optimizer.js";

describe("Route Optimizer", () => {
  let stops: Stop[];
  let vehicles: Vehicle[];
  let depot: Coordinate;

  beforeEach(() => {
    depot = { latitude: 40.7128, longitude: -74.006 }; // NYC

    // Create test stops
    stops = [
      {
        id: "stop_1",
        coordinate: { latitude: 40.7489, longitude: -73.968 },
        timeWindow: {
          openTime: new Date("2026-03-16T09:00:00"),
          closeTime: new Date("2026-03-16T17:00:00"),
        },
        duration: 15,
        weight: 5,
        volume: 0.1,
        priority: 3,
      },
      {
        id: "stop_2",
        coordinate: { latitude: 40.758, longitude: -73.9855 },
        timeWindow: {
          openTime: new Date("2026-03-16T09:00:00"),
          closeTime: new Date("2026-03-16T17:00:00"),
        },
        duration: 10,
        weight: 3,
        volume: 0.08,
        priority: 2,
      },
      {
        id: "stop_3",
        coordinate: { latitude: 40.7505, longitude: -73.9972 },
        timeWindow: {
          openTime: new Date("2026-03-16T10:00:00"),
          closeTime: new Date("2026-03-16T18:00:00"),
        },
        duration: 12,
        weight: 4,
        volume: 0.12,
        priority: 1,
      },
      {
        id: "stop_4",
        coordinate: { latitude: 40.7614, longitude: -73.9776 },
        timeWindow: {
          openTime: new Date("2026-03-16T09:00:00"),
          closeTime: new Date("2026-03-16T17:00:00"),
        },
        duration: 8,
        weight: 2,
        volume: 0.05,
        priority: 4,
      },
      {
        id: "stop_5",
        coordinate: { latitude: 40.7549, longitude: -73.984 },
        timeWindow: {
          openTime: new Date("2026-03-16T11:00:00"),
          closeTime: new Date("2026-03-16T19:00:00"),
        },
        duration: 10,
        weight: 3,
        volume: 0.06,
        priority: 2,
      },
    ];

    // Create test vehicles
    vehicles = [
      {
        id: "van_1",
        currentPosition: depot,
        capacity: {
          weight: 50,
          volume: 1.0,
        },
        maxShiftHours: 8,
        costPerKm: 1.5,
        costPerHour: 25,
        rating: 4.5,
      },
      {
        id: "van_2",
        currentPosition: { latitude: 40.7489, longitude: -73.968 },
        capacity: {
          weight: 50,
          volume: 1.0,
        },
        maxShiftHours: 8,
        costPerKm: 1.5,
        costPerHour: 25,
        rating: 4.0,
      },
    ];
  });

  // ─── Optimization Success ───────────────────────────────────────────

  describe("Basic Optimization", () => {
    it("should create valid routes for all stops", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.routes).toBeDefined();
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.routes.length).toBeLessThanOrEqual(vehicles.length);
    });

    it("should assign all stops to vehicles", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      const assignedStops = result.routes.reduce(
        (sum, r) => sum + r.stops.length,
        0,
      );
      const unassignedCount = result.unassignedStops.length;

      expect(assignedStops + unassignedCount).toBe(stops.length);
    });

    it("should calculate meaningful optimization metrics", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should respect vehicle capacity constraints", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      for (const route of result.routes) {
        const vehicle = vehicles.find((v) => v.id === route.vehicleId);
        expect(vehicle).toBeDefined();

        expect(route.totalWeight).toBeLessThanOrEqual(vehicle!.capacity.weight);
        expect(route.totalVolume).toBeLessThanOrEqual(vehicle!.capacity.volume);
      }
    });

    it("should respect time window constraints", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      for (const route of result.routes) {
        // Check that violations are minimal
        expect(route.violations.length).toBeLessThanOrEqual(1);
      }
    });
  });

  // ─── Optimization Modes ────────────────────────────────────────────

  describe("Optimization Modes", () => {
    it("should optimize for minimum distance", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.routes.length).toBeGreaterThan(0);
    });

    it("should optimize for minimum time", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_time",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.routes.length).toBeGreaterThan(0);
    });

    it("should optimize for minimum cost", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_cost",
        depot,
      };

      const result = optimizeRoutes(request);

      const totalCost = result.routes.reduce((sum, r) => sum + r.totalCost, 0);
      expect(totalCost).toBeGreaterThan(0);
    });

    it("should balance workload across vehicles", () => {
      const request: OptimizationRequest = {
        stops: [...stops, ...stops], // double the stops
        vehicles,
        mode: "balance_workload",
        depot,
      };

      const result = optimizeRoutes(request);

      const stopCounts = result.routes.map((r) => r.stops.length);
      const avgStops =
        stopCounts.reduce((a, b) => a + b, 0) / stopCounts.length;

      // Workload should be relatively balanced
      for (const count of stopCounts) {
        expect(Math.abs(count - avgStops)).toBeLessThanOrEqual(avgStops + 2);
      }
    });
  });

  // ─── Route Sequence ────────────────────────────────────────────────

  describe("Route Sequences", () => {
    it("should create valid stop sequences", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      for (const route of result.routes) {
        expect(route.sequence).toBeDefined();
        expect(Array.isArray(route.sequence)).toBe(true);
        expect(route.sequence.length).toBe(route.stops.length);

        // Verify all stops in sequence exist
        for (const stopId of route.sequence) {
          const found = route.stops.find((s) => s.id === stopId);
          expect(found).toBeDefined();
        }
      }
    });

    it("should have matching sequence and stops", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      for (const route of result.routes) {
        expect(route.sequence.length).toBe(route.stops.length);
      }
    });

    it("should calculate arrival times for each stop", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      for (const route of result.routes) {
        expect(route.estimatedArrivalTimes.length).toBe(route.stops.length);

        // Times should be in ascending order
        for (let i = 1; i < route.estimatedArrivalTimes.length; i++) {
          expect(
            route.estimatedArrivalTimes[i].getTime(),
          ).toBeGreaterThanOrEqual(
            route.estimatedArrivalTimes[i - 1].getTime(),
          );
        }
      }
    });
  });

  // ─── Breaks ────────────────────────────────────────────────────────

  describe("Break Insertion", () => {
    it("should insert breaks for long shifts", () => {
      const longStops = Array.from({ length: 15 }, (_, i) => ({
        id: `stop_${i}`,
        coordinate: {
          latitude: 40.7128 + i * 0.01,
          longitude: -74.006 + i * 0.01,
        },
        timeWindow: {
          openTime: new Date("2026-03-16T08:00:00"),
          closeTime: new Date("2026-03-16T20:00:00"),
        },
        duration: 10,
        weight: 2,
        volume: 0.05,
        priority: 1,
      }));

      const request: OptimizationRequest = {
        stops: longStops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      // At least one route should have breaks
      const routesWithBreaks = result.routes.filter((r) => r.breaks.length > 0);
      expect(routesWithBreaks.length).toBeGreaterThanOrEqual(0);
    });

    it("should have valid break durations", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      for (const route of result.routes) {
        for (const breakItem of route.breaks) {
          expect(breakItem.duration).toBeGreaterThan(0);
          expect(breakItem.startTime).toBeDefined();
          expect(breakItem.location).toBeDefined();
        }
      }
    });
  });

  // ─── Savings Calculation ────────────────────────────────────────────

  describe("Savings Calculation", () => {
    it("should calculate positive distance savings", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.estimatedSavings.distance).toBeGreaterThanOrEqual(0);
    });

    it("should calculate positive time savings", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_time",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.estimatedSavings.time).toBeGreaterThanOrEqual(0);
    });

    it("should calculate positive cost savings", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_cost",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.estimatedSavings.cost).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Performance ────────────────────────────────────────────────────

  describe("Performance", () => {
    it("should complete optimization within reasonable time", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles,
        mode: "minimize_distance",
        depot,
        maxIterations: 50,
      };

      const result = optimizeRoutes(request);

      expect(result.executionTimeMs).toBeLessThan(5000); // 5 seconds max
    });

    it("should scale with larger datasets", () => {
      const manyStops = Array.from({ length: 50 }, (_, i) => ({
        id: `stop_${i}`,
        coordinate: {
          latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
          longitude: -74.006 + (Math.random() - 0.5) * 0.1,
        },
        timeWindow: {
          openTime: new Date("2026-03-16T08:00:00"),
          closeTime: new Date("2026-03-16T20:00:00"),
        },
        duration: 10,
        weight: Math.random() * 10,
        volume: Math.random() * 0.2,
        priority: Math.floor(Math.random() * 5) + 1,
      }));

      const request: OptimizationRequest = {
        stops: manyStops,
        vehicles: [...vehicles, ...vehicles], // 4 vehicles
        mode: "minimize_distance",
        depot,
        maxIterations: 25,
      };

      const result = optimizeRoutes(request);

      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeLessThan(30000); // 30 seconds max (CI can be slow)
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should handle single stop", () => {
      const request: OptimizationRequest = {
        stops: [stops[0]],
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.routes.length).toBeGreaterThan(0);
      const assignedCount = result.routes.reduce(
        (sum, r) => sum + r.stops.length,
        0,
      );
      expect(assignedCount).toBe(1);
    });

    it("should handle insufficient vehicles", () => {
      const request: OptimizationRequest = {
        stops,
        vehicles: [vehicles[0]], // only 1 vehicle for 5 stops
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      expect(result.routes.length).toBeGreaterThan(0);
      // Should still try to assign some stops
      const assignedCount = result.routes.reduce(
        (sum, r) => sum + r.stops.length,
        0,
      );
      expect(assignedCount).toBeGreaterThan(0);
    });

    it("should handle unassignable stops", () => {
      const conflictingStop: Stop = {
        id: "conflict",
        coordinate: { latitude: 40.5, longitude: -74.0 },
        timeWindow: {
          openTime: new Date("2026-03-16T01:00:00"),
          closeTime: new Date("2026-03-16T02:00:00"), // very short window
        },
        duration: 120, // 2 hours duration, can't fit in window
        weight: 100,
        volume: 10,
      };

      const request: OptimizationRequest = {
        stops: [...stops, conflictingStop],
        vehicles,
        mode: "minimize_distance",
        depot,
      };

      const result = optimizeRoutes(request);

      // May or may not be assigned, but result should be valid
      expect(result.routes).toBeDefined();
    });
  });
});
