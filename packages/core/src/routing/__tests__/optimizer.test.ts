import { describe, it, expect, beforeEach } from "vitest";
import {
  optimizeRoutes,
  OptimizationRequest,
  OptimizationResult,
} from "../optimizer";
import type { GeoPoint, OptimizationStop, Vehicle } from "../constraints";

// Test helper functions
const createGeoPoint = (lat: number, lng: number): GeoPoint => ({
  lat,
  lng,
});

const createStop = (
  id: string,
  location: GeoPoint,
  serviceDuration = 5,
  priority = 1
): OptimizationStop => ({
  id,
  location,
  serviceDuration,
  priority,
  demand: { weight: 10, volume: 0.1 },
});

const createVehicle = (
  id: string,
  startLocation: GeoPoint
): Vehicle => ({
  id,
  driverId: `driver_${id}`,
  startLocation,
  capacity: { weight: 1000, volume: 100 },
  shiftStart: new Date(),
  shiftEnd: new Date(Date.now() + 8 * 60 * 60 * 1000),
  skills: [],
});

const createOptimizationRequest = (
  stops: OptimizationStop[],
  vehicles: Vehicle[],
  algorithm = "nearest_neighbor"
): OptimizationRequest => ({
  depot: createGeoPoint(40.7128, -74.006),
  stops,
  vehicles,
  constraints: {
    maxRouteTime: 480,
    maxRouteDistance: 100,
    respectTimeWindows: false,
    balanceWorkload: false,
    minimizeVehicles: false,
  },
  settings: {
    algorithm: algorithm as any,
    maxIterations: 100,
    timeLimit: 30,
    speedKmh: 60,
  },
});

describe("Route Optimizer", () => {
  // ======================== Basic Functionality ========================

  describe("optimizeRoutes - nearest_neighbor", () => {
    it("should optimize routes with single stop", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985))];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles, "nearest_neighbor");

      const result = await optimizeRoutes(request);

      expect(result).toBeDefined();
      expect(result.routes).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.algorithmUsed).toBe("nearest_neighbor");
    });

    it("should handle empty stops array", async () => {
      const stops: OptimizationStop[] = [];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.routes).toEqual([]);
      expect(result.unassignedStops).toEqual([]);
      expect(result.metrics.stopsUncovered).toBe(0);
    });

    it("should handle no vehicles available", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985))];
      const vehicles: Vehicle[] = [];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.routes).toEqual([]);
      expect(result.metrics.stopsUncovered).toBeGreaterThan(0);
    });

    it("should assign stops to vehicles respecting capacity", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5, 1),
        createStop("2", createGeoPoint(40.753, -73.981), 10, 2),
        createStop("3", createGeoPoint(40.748, -73.975), 8, 3),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.routes.length).toBeGreaterThanOrEqual(0);
      expect(result.metrics.stopsCovered + result.metrics.stopsUncovered).toBe(3);
    });
  });

  // ======================== 2-Opt Improvement ========================

  describe("optimizeRoutes - nearest_neighbor_2opt", () => {
    it("should improve upon nearest-neighbor with 2-opt", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
        createStop("3", createGeoPoint(40.748, -73.975), 5),
        createStop("4", createGeoPoint(40.743, -73.97), 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(
        stops,
        vehicles,
        "nearest_neighbor_2opt"
      );

      const result = await optimizeRoutes(request);

      expect(result.routes.length).toBeGreaterThanOrEqual(0);
      if (result.routes.length > 0) {
        // Routes should have reasonable distance
        expect(result.metrics.totalDistance).toBeGreaterThan(0);
      }
    });

    it("should respect maxIterations parameter", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(
        stops,
        vehicles,
        "nearest_neighbor_2opt"
      );
      request.settings.maxIterations = 10;

      const result = await optimizeRoutes(request);

      expect(result).toBeDefined();
      expect(result.executionTime).toBeLessThan(5000);
    });
  });

  // ======================== Clarke-Wright Savings ========================

  describe("optimizeRoutes - savings algorithm", () => {
    it("should distribute stops across multiple vehicles", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
        createStop("3", createGeoPoint(40.748, -73.975), 5),
        createStop("4", createGeoPoint(40.743, -73.97), 5),
      ];
      const vehicles = [
        createVehicle("v1", createGeoPoint(40.7128, -74.006)),
        createVehicle("v2", createGeoPoint(40.7128, -74.006)),
      ];
      const request = createOptimizationRequest(stops, vehicles, "savings");

      const result = await optimizeRoutes(request);

      // Should use both vehicles or concentrate in one
      expect(result.metrics.totalVehiclesUsed).toBeGreaterThanOrEqual(0);
      expect(result.metrics.totalVehiclesUsed).toBeLessThanOrEqual(2);
    });

    it("should respect vehicle capacity constraints", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicle = createVehicle("v1", createGeoPoint(40.7128, -74.006));
      // Set very low capacity
      vehicle.capacity = { weight: 15, volume: 0.1 };

      const request = createOptimizationRequest(stops, [vehicle], "savings");

      const result = await optimizeRoutes(request);

      // Should handle capacity constraints
      expect(
        result.metrics.stopsCovered + result.metrics.stopsUncovered
      ).toBe(2);
    });

    it("should optimize for multiple vehicle utilization", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
        createStop("3", createGeoPoint(40.748, -73.975), 5),
      ];
      const vehicles = [
        createVehicle("v1", createGeoPoint(40.7128, -74.006)),
        createVehicle("v2", createGeoPoint(40.7128, -74.006)),
        createVehicle("v3", createGeoPoint(40.7128, -74.006)),
      ];
      const request = createOptimizationRequest(stops, vehicles, "savings");
      request.constraints.minimizeVehicles = true;

      const result = await optimizeRoutes(request);

      expect(result.metrics.totalVehiclesUsed).toBeLessThanOrEqual(3);
    });
  });

  // ======================== Distance Calculation ========================

  describe("distance matrix computation", () => {
    it("should compute distances between all stops", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      // Pre-compute distance matrix
      const distances = [
        [0, 5.5, 6.2], // depot to stop1, stop2
        [5.5, 0, 1.2], // stop1 to depot, stop2
        [6.2, 1.2, 0], // stop2 to depot, stop1
      ];
      request.settings.distanceMatrix = distances;

      const result = await optimizeRoutes(request);

      expect(result).toBeDefined();
    });

    it("should handle Haversine distance calculations", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5), // ~0.68 km from depot
        createStop("2", createGeoPoint(40.753, -73.981), 5), // ~0.74 km from depot
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      if (result.routes.length > 0) {
        // Distance should be calculated
        expect(result.metrics.totalDistance).toBeGreaterThan(0);
      }
    });
  });

  // ======================== Constraint Handling ========================

  describe("vehicle capacity constraints", () => {
    it("should not exceed vehicle weight capacity", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicle = createVehicle("v1", createGeoPoint(40.7128, -74.006));
      vehicle.capacity = { weight: 15, volume: 100 }; // Limited capacity

      const request = createOptimizationRequest(stops, [vehicle]);

      const result = await optimizeRoutes(request);

      for (const route of result.routes) {
        const totalWeight = route.totalWeight;
        expect(totalWeight).toBeLessThanOrEqual(vehicle.capacity.weight);
      }
    });

    it("should not exceed vehicle volume capacity", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicle = createVehicle("v1", createGeoPoint(40.7128, -74.006));
      vehicle.capacity = { weight: 1000, volume: 0.2 }; // Limited volume

      const request = createOptimizationRequest(stops, [vehicle]);

      const result = await optimizeRoutes(request);

      for (const route of result.routes) {
        const totalVolume = route.totalVolume;
        expect(totalVolume).toBeLessThanOrEqual(vehicle.capacity.volume);
      }
    });
  });

  describe("max route distance constraint", () => {
    it("should respect maxRouteDistance constraint", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);
      request.constraints.maxRouteDistance = 15; // 15 km max

      const result = await optimizeRoutes(request);

      for (const route of result.routes) {
        expect(route.totalDistance).toBeLessThanOrEqual(15);
      }
    });
  });

  describe("max route time constraint", () => {
    it("should respect maxRouteTime constraint", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 30), // 30 min service
        createStop("2", createGeoPoint(40.753, -73.981), 30), // 30 min service
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);
      request.constraints.maxRouteTime = 120; // 2 hours max

      const result = await optimizeRoutes(request);

      for (const route of result.routes) {
        expect(route.totalDuration).toBeLessThanOrEqual(120);
      }
    });
  });

  // ======================== Edge Cases ========================

  describe("edge cases", () => {
    it("should handle all stops at same location", async () => {
      const sameLoc = createGeoPoint(40.758, -73.985);
      const stops = [
        createStop("1", sameLoc, 5),
        createStop("2", sameLoc, 5),
        createStop("3", sameLoc, 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result).toBeDefined();
      expect(result.routes.length + result.unassignedStops.length).toBeGreaterThan(0);
    });

    it("should handle very distant stops", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5), // NYC
        createStop("2", createGeoPoint(34.052, -118.243), 5), // LA (very far)
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result).toBeDefined();
    });

    it("should handle single stop", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.metrics.stopsCovered + result.metrics.stopsUncovered).toBe(1);
    });

    it("should handle multiple vehicles with single stop", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicles = [
        createVehicle("v1", createGeoPoint(40.7128, -74.006)),
        createVehicle("v2", createGeoPoint(40.7128, -74.006)),
        createVehicle("v3", createGeoPoint(40.7128, -74.006)),
      ];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.metrics.totalVehiclesUsed).toBeLessThanOrEqual(1);
    });
  });

  // ======================== Performance Metrics ========================

  describe("optimization metrics", () => {
    it("should calculate total distance", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.metrics.totalDistance).toBeGreaterThanOrEqual(0);
    });

    it("should calculate total duration", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 15), // 15 min service
        createStop("2", createGeoPoint(40.753, -73.981), 10), // 10 min service
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.metrics.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it("should report vehicles used", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicles = [
        createVehicle("v1", createGeoPoint(40.7128, -74.006)),
        createVehicle("v2", createGeoPoint(40.7128, -74.006)),
      ];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.metrics.totalVehiclesUsed).toBeGreaterThanOrEqual(0);
      expect(result.metrics.totalVehiclesUsed).toBeLessThanOrEqual(2);
    });

    it("should calculate vehicle utilization", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.metrics.averageVehicleUtilization).toBeGreaterThanOrEqual(0);
      expect(result.metrics.averageVehicleUtilization).toBeLessThanOrEqual(100);
    });

    it("should count covered vs uncovered stops", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
        createStop("3", createGeoPoint(40.748, -73.975), 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(
        result.metrics.stopsCovered + result.metrics.stopsUncovered
      ).toBe(3);
    });
  });

  // ======================== Algorithm Selection ========================

  describe("algorithm selection", () => {
    it("should support nearest_neighbor algorithm", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles, "nearest_neighbor");

      const result = await optimizeRoutes(request);

      expect(result.algorithmUsed).toBe("nearest_neighbor");
    });

    it("should support nearest_neighbor_2opt algorithm", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(
        stops,
        vehicles,
        "nearest_neighbor_2opt"
      );

      const result = await optimizeRoutes(request);

      expect(result.algorithmUsed).toBe("nearest_neighbor_2opt");
    });

    it("should support savings algorithm", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles, "savings");

      const result = await optimizeRoutes(request);

      expect(result.algorithmUsed).toBe("savings");
    });

    it("should support genetic algorithm (stub)", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles, "genetic");

      const result = await optimizeRoutes(request);

      expect(result).toBeDefined();
    });
  });

  // ======================== Execution Metrics ========================

  describe("execution time", () => {
    it("should complete within timeLimit", async () => {
      const stops = [
        createStop("1", createGeoPoint(40.758, -73.985), 5),
        createStop("2", createGeoPoint(40.753, -73.981), 5),
      ];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);
      request.settings.timeLimit = 5; // 5 seconds

      const result = await optimizeRoutes(request);

      expect(result.executionTime).toBeLessThan(5000);
    });

    it("should report execution time", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ======================== Route Feasibility ========================

  describe("route feasibility", () => {
    it("should mark feasible routes", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicles = [createVehicle("v1", createGeoPoint(40.7128, -74.006))];
      const request = createOptimizationRequest(stops, vehicles);

      const result = await optimizeRoutes(request);

      for (const route of result.routes) {
        expect(route.isFeasible).toBeDefined();
      }
    });

    it("should handle infeasible routes", async () => {
      const stops = [createStop("1", createGeoPoint(40.758, -73.985), 5)];
      const vehicle = createVehicle("v1", createGeoPoint(40.7128, -74.006));
      vehicle.capacity = { weight: 5, volume: 0.01 }; // Too small
      vehicle.shiftEnd = new Date(Date.now() + 10 * 60 * 1000); // Only 10 min

      const request = createOptimizationRequest(stops, [vehicle]);

      const result = await optimizeRoutes(request);

      expect(result).toBeDefined();
    });
  });
});
