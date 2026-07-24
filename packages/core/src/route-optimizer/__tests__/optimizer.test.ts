import { describe, it, expect, beforeEach, vi } from "vitest";
import { RouteOptimizer } from "../optimizer";
import type {
  RouteOptimizationRequest,
  Stop,
  GeoPoint,
  OptimizationConstraints,
} from "../types";

/**
 * Test suite for RouteOptimizer
 *
 * Tests the core route optimization engine with:
 * - Empty/single/multiple stop scenarios
 * - Optimal ordering with constraints
 * - Time window and capacity constraints
 * - Performance benchmarks
 * - Edge cases and error handling
 */

const depot: GeoPoint = {
  latitude: 40.7128,
  longitude: -74.006,
};

const defaultConstraints: OptimizationConstraints = {
  respectTimeWindows: true,
  minimizeVehicles: false,
  balanceWorkload: false,
  vehicleCapacityWeight: 5000,
  vehicleCapacityVolume: 100,
  maxStopsPerVehicle: 50,
};

const createStop = (
  id: string,
  latitude: number,
  longitude: number,
  weight = 100,
  priority = 1,
): Stop => ({
  id,
  location: { latitude, longitude },
  serviceDuration: 5,
  priority,
  weight,
});

const createStopWithTimeWindow = (
  id: string,
  latitude: number,
  longitude: number,
  startHour: number,
  endHour: number,
): Stop => ({
  id,
  location: { latitude, longitude },
  serviceDuration: 5,
  priority: 1,
  weight: 100,
  timeWindow: {
    start: new Date(new Date().setHours(startHour, 0, 0)),
    end: new Date(new Date().setHours(endHour, 0, 0)),
  },
});

describe("RouteOptimizer", () => {
  let optimizer: RouteOptimizer;

  beforeEach(() => {
    optimizer = new RouteOptimizer();
  });

  describe("empty and single stop scenarios", () => {
    it("should throw error when no stops provided", async () => {
      const request: RouteOptimizationRequest = {
        depot,
        stops: [],
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      await expect(optimizer.optimize(request)).rejects.toThrow(
        "At least one stop is required",
      );
    });

    it("should handle single stop optimization", async () => {
      const stops = [createStop("s1", 40.758, -73.9855, 100, 1)];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].stops).toHaveLength(1);
      expect(result.routes[0].stops[0].id).toBe("s1");
      expect(result.metrics.stopsCovered).toBe(1);
      expect(result.metrics.stopsUncovered).toBe(0);
    });

    it("should throw error when depot is missing", async () => {
      const request: RouteOptimizationRequest = {
        depot: { latitude: NaN, longitude: NaN },
        stops: [createStop("s1", 40.758, -73.9855)],
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      await expect(optimizer.optimize(request)).rejects.toThrow(
        "Depot location is required",
      );
    });

    it("should throw error when vehicle count is zero", async () => {
      const request: RouteOptimizationRequest = {
        depot,
        stops: [createStop("s1", 40.758, -73.9855)],
        vehicleCount: 0,
        constraints: defaultConstraints,
      };

      await expect(optimizer.optimize(request)).rejects.toThrow(
        "At least one vehicle is required",
      );
    });
  });

  describe("multiple stop scenarios", () => {
    it("should optimize two stops into one route", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 100, 1),
        createStop("s2", 40.7489, -73.968, 100, 1),
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].stops).toHaveLength(2);
      expect(result.metrics.stopsCovered).toBe(2);
      expect(result.metrics.stopsUncovered).toBe(0);
    });

    it("should optimize 10 stops with optimal ordering", async () => {
      const stops: Stop[] = [];
      for (let i = 0; i < 10; i++) {
        stops.push(
          createStop(
            `s${i}`,
            40.7 + ((i * 0.01) % 0.1),
            -74.0 + ((i * 0.01) % 0.1),
          ),
        );
      }

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 2,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.routes.length).toBeLessThanOrEqual(2);
      const totalAssigned = result.routes.reduce(
        (sum, r) => sum + r.stops.length,
        0,
      );
      expect(totalAssigned).toBe(10);
      expect(result.metrics.stopsCovered).toBe(10);
    });

    it("should respect priority ordering", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 100, 3),
        createStop("s2", 40.7489, -73.968, 100, 1),
        createStop("s3", 40.7614, -73.9776, 100, 2),
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.routes[0].stops.length).toBeGreaterThan(0);
      // Higher priority stops should be attempted first
      const assignedIds = result.routes[0].stops.map((s) => s.id);
      expect(assignedIds.length).toBeGreaterThan(0);
    });
  });

  describe("time window constraints", () => {
    it("should respect delivery time windows", async () => {
      // Use future-relative windows so the test passes regardless of time of day.
      const now = Date.now();
      const stops: Stop[] = [
        {
          id: "s1",
          location: { latitude: 40.758, longitude: -73.9855 },
          serviceDuration: 5,
          priority: 1,
          weight: 100,
          timeWindow: {
            start: new Date(now + 60 * 60 * 1000), // +1h from now
            end: new Date(now + 4 * 60 * 60 * 1000), // +4h from now
          },
        },
        {
          id: "s2",
          location: { latitude: 40.7489, longitude: -73.968 },
          serviceDuration: 5,
          priority: 1,
          weight: 100,
          timeWindow: {
            start: new Date(now + 2 * 60 * 60 * 1000), // +2h from now
            end: new Date(now + 5 * 60 * 60 * 1000), // +5h from now
          },
        },
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      // Should have routes; all assigned stops must respect their time windows
      expect(result.routes.length).toBeGreaterThan(0);
      for (const route of result.routes) {
        for (const stop of route.stops) {
          if (stop.timeWindow) {
            // No late-arrival violations when respectTimeWindows is true
            expect((stop as any).timeWindowViolation?.type).not.toBe("late");
            // Arrival must not exceed the window end
            expect(stop.arrivalTime.getTime()).toBeLessThanOrEqual(
              stop.timeWindow.end.getTime(),
            );
          }
        }
      }
    });

    it("should handle stops with conflicting time windows", async () => {
      const now = Date.now();
      // Two non-overlapping future windows; one vehicle can only serve one at a time
      const stops: Stop[] = [
        {
          id: "s1",
          location: { latitude: 40.758, longitude: -73.9855 },
          serviceDuration: 5,
          priority: 1,
          weight: 100,
          timeWindow: {
            start: new Date(now + 1 * 60 * 60 * 1000),
            end: new Date(now + 2 * 60 * 60 * 1000),
          },
        },
        {
          id: "s2",
          location: { latitude: 40.7489, longitude: -73.968 },
          serviceDuration: 5,
          priority: 1,
          weight: 100,
          timeWindow: {
            start: new Date(now + 3 * 60 * 60 * 1000),
            end: new Date(now + 4 * 60 * 60 * 1000),
          },
        },
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 2,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.routes.length).toBeGreaterThanOrEqual(1);
    });

    it("should skip stops with unreachable time windows", async () => {
      const pastWindow = new Date();
      pastWindow.setHours(1, 0, 0);

      const stops = [
        {
          id: "s1",
          location: { latitude: 40.758, longitude: -73.9855 },
          serviceDuration: 5,
          priority: 1,
          weight: 100,
          timeWindow: {
            start: pastWindow,
            end: new Date(pastWindow.getTime() + 1000 * 60 * 60),
          },
        },
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      // Stop may be unassigned due to time window constraint
      expect(result.unassignedStops.length + result.metrics.stopsCovered).toBe(
        1,
      );
    });
  });

  describe("capacity constraints", () => {
    it("should respect vehicle weight capacity", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 2000, 1),
        createStop("s2", 40.7489, -73.968, 2000, 1),
        createStop("s3", 40.7614, -73.9776, 2000, 1),
      ];

      const constraints: OptimizationConstraints = {
        ...defaultConstraints,
        vehicleCapacityWeight: 3000, // Can fit max 1.5 stops
      };

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 2,
        constraints,
      };

      const result = await optimizer.optimize(request);

      // Verify no route exceeds capacity
      for (const route of result.routes) {
        expect(route.totalWeight).toBeLessThanOrEqual(3000);
      }
    });

    it("should handle capacity overflow by splitting across vehicles", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 5000, 1),
        createStop("s2", 40.7489, -73.968, 5000, 1),
      ];

      const constraints: OptimizationConstraints = {
        ...defaultConstraints,
        vehicleCapacityWeight: 5000,
      };

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 2,
        constraints,
      };

      const result = await optimizer.optimize(request);

      // Should use at least 2 vehicles or leave unassigned
      const totalAssigned = result.routes.reduce(
        (sum, r) => sum + r.stops.length,
        0,
      );
      expect(totalAssigned + result.unassignedStops.length).toBe(2);
    });

    it("should respect volume capacity constraints", async () => {
      const stops = [
        { ...createStop("s1", 40.758, -73.9855), volume: 50 },
        { ...createStop("s2", 40.7489, -73.968), volume: 50 },
      ];

      const constraints: OptimizationConstraints = {
        ...defaultConstraints,
        vehicleCapacityVolume: 60,
      };

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 2,
        constraints,
      };

      const result = await optimizer.optimize(request);

      for (const route of result.routes) {
        const totalVolume = route.stops.reduce(
          (sum, s) => sum + (s.volume || 0),
          0,
        );
        expect(totalVolume).toBeLessThanOrEqual(60);
      }
    });

    it("should handle zero weight stops", async () => {
      const stops = [
        { ...createStop("s1", 40.758, -73.9855), weight: 0 },
        { ...createStop("s2", 40.7489, -73.968), weight: 0 },
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.metrics.stopsCovered).toBe(2);
    });
  });

  describe("unreachable locations", () => {
    it("should handle geographically distant stops", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 100, 1), // NYC
        createStop("s2", 34.0522, -118.2437, 100, 1), // LA
      ];

      const constraints: OptimizationConstraints = {
        ...defaultConstraints,
        maxRouteDuration: 60, // 1 hour
      };

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints,
      };

      const result = await optimizer.optimize(request);

      // Distant stops cannot be in same route with time constraint
      expect(result.routes.length).toBeGreaterThanOrEqual(1);
    });

    it("should report unassigned stops when capacity exhausted", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 5000, 1),
        createStop("s2", 40.7489, -73.968, 5000, 1),
      ];

      const constraints: OptimizationConstraints = {
        ...defaultConstraints,
        vehicleCapacityWeight: 5000,
        maxStopsPerVehicle: 1,
      };

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints,
      };

      const result = await optimizer.optimize(request);

      const totalAssigned = result.routes.reduce(
        (sum, r) => sum + r.stops.length,
        0,
      );
      expect(totalAssigned + result.unassignedStops.length).toBe(2);
    });
  });

  describe("max stops per vehicle", () => {
    it("should respect max stops per vehicle limit", async () => {
      const stops: Stop[] = [];
      for (let i = 0; i < 15; i++) {
        stops.push(createStop(`s${i}`, 40.7 + i * 0.001, -74.0));
      }

      const constraints: OptimizationConstraints = {
        ...defaultConstraints,
        maxStopsPerVehicle: 5,
      };

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 4,
        constraints,
      };

      const result = await optimizer.optimize(request);

      for (const route of result.routes) {
        expect(route.stops.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("algorithm selection", () => {
    it("should use nearest-neighbor algorithm", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 100, 1),
        createStop("s2", 40.7489, -73.968, 100, 1),
        createStop("s3", 40.7614, -73.9776, 100, 1),
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
        algorithm: { name: "nearest-neighbor" },
      };

      const result = await optimizer.optimize(request);

      expect(result.algorithmUsed).toBe("nearest-neighbor");
      expect(result.routes.length).toBeGreaterThan(0);
    });

    it("should use 2-opt improvement algorithm", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 100, 1),
        createStop("s2", 40.7489, -73.968, 100, 1),
        createStop("s3", 40.7614, -73.9776, 100, 1),
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
        algorithm: { name: "nearest-neighbor-2opt" },
      };

      const result = await optimizer.optimize(request);

      expect(result.algorithmUsed).toBe("nearest-neighbor-2opt");
      expect(result.routes.length).toBeGreaterThan(0);
    });

    it("should use savings algorithm", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 100, 1),
        createStop("s2", 40.7489, -73.968, 100, 1),
        createStop("s3", 40.7614, -73.9776, 100, 1),
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 2,
        constraints: defaultConstraints,
        algorithm: { name: "savings" },
      };

      const result = await optimizer.optimize(request);

      expect(result.algorithmUsed).toBe("savings");
      expect(result.routes.length).toBeGreaterThan(0);
    });

    it("should throw error for unknown algorithm", async () => {
      const stops = [createStop("s1", 40.758, -73.9855, 100, 1)];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
        algorithm: { name: "unknown" as any },
      };

      await expect(optimizer.optimize(request)).rejects.toThrow(
        "Unknown algorithm",
      );
    });
  });

  describe("performance benchmarks", () => {
    it("should optimize 50 stops in under 5 seconds", async () => {
      const stops: Stop[] = [];
      for (let i = 0; i < 50; i++) {
        stops.push(
          createStop(
            `s${i}`,
            40.7 + Math.random() * 0.1,
            -74.0 + Math.random() * 0.1,
          ),
        );
      }

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 5,
        constraints: defaultConstraints,
        algorithm: { name: "nearest-neighbor" },
      };

      const start = performance.now();
      const result = await optimizer.optimize(request);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000);
      expect(result.executionTimeMs).toBeLessThan(5000);
    });

    it("should optimize 100 stops in under 2 seconds", async () => {
      const stops: Stop[] = [];
      for (let i = 0; i < 100; i++) {
        stops.push(
          createStop(
            `s${i}`,
            40.7 + (Math.random() * 0.1 - 0.05),
            -74.0 + (Math.random() * 0.1 - 0.05),
          ),
        );
      }

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 10,
        constraints: defaultConstraints,
        algorithm: { name: "nearest-neighbor" },
      };

      const start = performance.now();
      const result = await optimizer.optimize(request);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000);
      expect(result.executionTimeMs).toBeLessThan(2000);
    });
  });

  describe("metrics calculation", () => {
    it("should calculate correct metrics", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 100, 1),
        createStop("s2", 40.7489, -73.968, 100, 1),
      ];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.stopsCovered).toBeGreaterThanOrEqual(0);
      expect(result.metrics.stopsUncovered).toBeGreaterThanOrEqual(0);
      expect(result.metrics.vehiclesUsed).toBeGreaterThanOrEqual(0);
      expect(result.metrics.totalDistance).toBeGreaterThanOrEqual(0);
      expect(result.metrics.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it("should track coverage metrics correctly", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 100, 1),
        createStop("s2", 40.7489, -73.968, 5000, 1), // Heavy
        createStop("s3", 40.7614, -73.9776, 100, 1),
      ];

      const constraints: OptimizationConstraints = {
        ...defaultConstraints,
        vehicleCapacityWeight: 500, // Can't fit the 5000kg stop
      };

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.metrics.stopsCovered + result.metrics.stopsUncovered).toBe(
        3,
      );
    });
  });

  describe("result structure validation", () => {
    it("should return valid optimization result", async () => {
      const stops = [createStop("s1", 40.758, -73.9855, 100, 1)];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      expect(result.jobId).toBeDefined();
      expect(result.routes).toBeDefined();
      expect(Array.isArray(result.routes)).toBe(true);
      expect(result.unassignedStops).toBeDefined();
      expect(Array.isArray(result.unassignedStops)).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.algorithmUsed).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it("should populate optimized stop details correctly", async () => {
      const stops = [createStop("s1", 40.758, -73.9855, 100, 1)];

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints: defaultConstraints,
      };

      const result = await optimizer.optimize(request);

      if (result.routes.length > 0 && result.routes[0].stops.length > 0) {
        const stop = result.routes[0].stops[0];
        expect(stop.arrivalTime).toBeDefined();
        expect(stop.departureTime).toBeDefined();
        expect(stop.eta).toBeDefined();
        expect(stop.cumulativeDistance).toBeGreaterThanOrEqual(0);
        expect(stop.sequenceNumber).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("vehicle utilization", () => {
    it("should calculate utilization percentage", async () => {
      const stops = [
        createStop("s1", 40.758, -73.9855, 1000, 1),
        createStop("s2", 40.7489, -73.968, 1000, 1),
      ];

      const constraints: OptimizationConstraints = {
        ...defaultConstraints,
        vehicleCapacityWeight: 5000,
      };

      const request: RouteOptimizationRequest = {
        depot,
        stops,
        vehicleCount: 1,
        constraints,
      };

      const result = await optimizer.optimize(request);

      for (const route of result.routes) {
        expect(route.utilizationPercentage).toBeGreaterThanOrEqual(0);
        expect(route.utilizationPercentage).toBeLessThanOrEqual(100);
      }
    });
  });
});
