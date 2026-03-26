/**
 * Core route optimization engine for Witylogix.
 *
 * Implements multiple optimization strategies:
 * - Nearest-neighbor for quick initial solutions
 * - 2-opt local search for improvement
 * - Clarke-Wright savings for multi-vehicle VRP
 * - Genetic algorithms for large-scale problems (stub for extensibility)
 *
 * Handles:
 * - Vehicle capacity constraints (weight, volume)
 * - Time windows (hard delivery time constraints)
 * - Driver skills (specializations required for specific stops)
 * - Shift time limits
 * - Distance/time matrix computation
 */

import type { GeoPoint } from "./distance.js";
import { computeDistanceMatrix, computeETAs, haversineDistance, estimateTravelTime } from "./distance.js";
import type { OptimizationStop, Vehicle, RouteSolution } from "./constraints.js";
import { checkCapacity, checkSkillMatch, checkTimeWindows, calculateRouteMetrics, checkShiftLimits } from "./constraints.js";
import { nearestNeighbor, multiStartNearestNeighbor } from "./algorithms/nearest-neighbor.js";
import { twoOptBestImprovement } from "./algorithms/two-opt.js";
import { clarkeWrightSavings, assignRoutesToVehicles } from "./algorithms/savings.js";

// ── Type Definitions ────────────────────────────────────────

/**
 * Request parameters for route optimization.
 */
export interface OptimizationRequest {
  depot: GeoPoint; // Start/end point (warehouse)
  stops: OptimizationStop[]; // Delivery stops
  vehicles: Vehicle[]; // Available vehicles
  constraints: OptimizationConstraints;
  settings: OptimizationSettings;
}

/**
 * Optimization constraints that must be satisfied.
 */
export interface OptimizationConstraints {
  maxRouteTime?: number; // minutes
  maxRouteDistance?: number; // km
  respectTimeWindows: boolean;
  balanceWorkload: boolean;
  minimizeVehicles: boolean;
}

/**
 * Algorithm selection and tuning parameters.
 */
export interface OptimizationSettings {
  algorithm: "nearest_neighbor" | "nearest_neighbor_2opt" | "savings" | "genetic";
  maxIterations: number;
  timeLimit: number; // seconds
  distanceMatrix?: number[][]; // pre-computed
  speedKmh?: number; // for travel time estimation (default: 60)
}

/**
 * Complete optimization result.
 */
export interface OptimizationResult {
  routes: RouteSolution[];
  unassignedStops: OptimizationStop[];
  metrics: {
    totalDistance: number; // km
    totalDuration: number; // minutes
    totalVehiclesUsed: number;
    averageVehicleUtilization: number; // percent
    stopsCovered: number;
    stopsUncovered: number;
  };
  violations: {
    timeWindow: number;
    capacity: number;
    skillMatch: number;
    shiftTime: number;
  };
  algorithmUsed: string;
  executionTime: number; // ms
}

// ── Main Optimization Function ──────────────────────────

/**
 * Optimize routes using the specified algorithm.
 *
 * @param request - Optimization request with stops, vehicles, constraints
 * @returns Complete optimization result with assigned and unassigned stops
 *
 * @example
 * const result = await optimizeRoutes({
 *   depot: { lat: 40.7128, lng: -74.0060 },
 *   stops: [
 *     { id: '1', location: { lat: 40.758, lng: -73.985 }, serviceDuration: 5, priority: 1 },
 *     { id: '2', location: { lat: 40.753, lng: -73.981 }, serviceDuration: 10, priority: 2 },
 *   ],
 *   vehicles: [
 *     { id: 'v1', driverId: 'd1', startLocation: depot, capacity: { weight: 1000, volume: 5000 }, ... },
 *   ],
 *   constraints: {
 *     respectTimeWindows: true,
 *     balanceWorkload: true,
 *     minimizeVehicles: true,
 *   },
 *   settings: {
 *     algorithm: 'nearest_neighbor_2opt',
 *     maxIterations: 100,
 *     timeLimit: 30,
 *   },
 * });
 */
export async function optimizeRoutes(request: OptimizationRequest): Promise<OptimizationResult> {
  const startTime = Date.now();

  // Validate inputs
  if (request.stops.length === 0) {
    return createEmptyResult(0, request.settings.algorithm);
  }

  if (request.vehicles.length === 0) {
    return createEmptyResult(request.stops.length, request.settings.algorithm);
  }

  // Compute distance matrix if not provided
  const distanceMatrix =
    request.settings.distanceMatrix ||
    computeDistanceMatrix([request.depot, ...request.stops.map((s) => s.location)]);

  const speedKmh = request.settings.speedKmh || 60;

  let routes: RouteSolution[] = [];
  let unassignedStops: OptimizationStop[] = [];

  try {
    // Run optimization based on selected algorithm
    switch (request.settings.algorithm) {
      case "nearest_neighbor":
        [routes, unassignedStops] = optimizeNearestNeighbor(
          request.stops,
          request.depot,
          request.vehicles,
          distanceMatrix,
          speedKmh,
        );
        break;

      case "nearest_neighbor_2opt":
        [routes, unassignedStops] = optimizeNearestNeighbor2Opt(
          request.stops,
          request.depot,
          request.vehicles,
          distanceMatrix,
          speedKmh,
          request.settings.maxIterations,
        );
        break;

      case "savings":
        [routes, unassignedStops] = optimizeSavings(
          request.stops,
          request.depot,
          request.vehicles,
          distanceMatrix,
          speedKmh,
        );
        break;

      case "genetic":
        // Placeholder for genetic algorithm
        [routes, unassignedStops] = optimizeNearestNeighbor2Opt(
          request.stops,
          request.depot,
          request.vehicles,
          distanceMatrix,
          speedKmh,
          request.settings.maxIterations,
        );
        break;

      default:
        throw new Error(`Unknown algorithm: ${request.settings.algorithm}`);
    }

    // Validate routes against constraints
    routes = validateAndFilterRoutes(
      routes,
      request.vehicles,
      request.depot,
      request.constraints,
      distanceMatrix,
      speedKmh,
    );

    // Collect stops that couldn't be assigned
    const assignedStopIds = new Set(routes.flatMap((r) => r.stops.map((s) => s.id)));
    unassignedStops = request.stops.filter((s) => !assignedStopIds.has(s.id));

    // Calculate metrics
    const metrics = calculateMetrics(routes, request.stops, request.vehicles);

    // Count violations
    const violations = countViolations(routes, request.vehicles, request.depot, distanceMatrix);

    const result: OptimizationResult = {
      routes,
      unassignedStops,
      metrics,
      violations,
      algorithmUsed: request.settings.algorithm,
      executionTime: Date.now() - startTime,
    };

    return result;
  } catch (error) {
    console.error("[optimizer] Error during optimization:", error);

    // Return best-effort result with error
    return {
      routes,
      unassignedStops: request.stops,
      metrics: {
        totalDistance: 0,
        totalDuration: 0,
        totalVehiclesUsed: 0,
        averageVehicleUtilization: 0,
        stopsCovered: 0,
        stopsUncovered: request.stops.length,
      },
      violations: { timeWindow: 0, capacity: 0, skillMatch: 0, shiftTime: 0 },
      algorithmUsed: request.settings.algorithm,
      executionTime: Date.now() - startTime,
    };
  }
}

// ── Algorithm Implementations ───────────────────────────

/**
 * Nearest-neighbor algorithm: greedy solution without improvement.
 */
function optimizeNearestNeighbor(
  stops: OptimizationStop[],
  depot: GeoPoint,
  vehicles: Vehicle[],
  distanceMatrix: number[][],
  speedKmh: number,
): [RouteSolution[], OptimizationStop[]] {
  // Use first vehicle for simplicity (single-vehicle case)
  if (vehicles.length === 0) {
    return [[], stops];
  }

  const vehicle = vehicles[0];
  const route = nearestNeighbor(distanceMatrix, 0);

  // Convert route indices to stops (skip depot at start and end)
  const assignedStops = route.slice(1, -1).map((idx) => stops[idx - 1]);

  if (!checkCapacity(vehicle, assignedStops)) {
    // Can't fit all stops, return empty
    return [[], stops];
  }

  const routeSolution = buildRouteSolution(
    vehicle,
    assignedStops,
    depot,
    vehicle.shiftStart,
    distanceMatrix,
    speedKmh,
  );

  return [[routeSolution], []];
}

/**
 * Nearest-neighbor with 2-opt improvement.
 */
function optimizeNearestNeighbor2Opt(
  stops: OptimizationStop[],
  depot: GeoPoint,
  vehicles: Vehicle[],
  distanceMatrix: number[][],
  speedKmh: number,
  maxIterations: number,
): [RouteSolution[], OptimizationStop[]] {
  if (vehicles.length === 0) {
    return [[], stops];
  }

  const vehicle = vehicles[0];

  // Get initial solution
  let route = multiStartNearestNeighbor(distanceMatrix, 0, Math.min(3, stops.length));

  // Improve with 2-opt
  route = twoOptBestImprovement(route, distanceMatrix, maxIterations);

  // Convert to stops
  const assignedStops = route.slice(1, -1).map((idx) => stops[idx - 1]);

  if (!checkCapacity(vehicle, assignedStops)) {
    return [[], stops];
  }

  const routeSolution = buildRouteSolution(
    vehicle,
    assignedStops,
    depot,
    vehicle.shiftStart,
    distanceMatrix,
    speedKmh,
  );

  return [[routeSolution], []];
}

/**
 * Clarke-Wright savings algorithm for multi-vehicle routing.
 */
function optimizeSavings(
  stops: OptimizationStop[],
  depot: GeoPoint,
  vehicles: Vehicle[],
  distanceMatrix: number[][],
  speedKmh: number,
): [RouteSolution[], OptimizationStop[]] {
  // Run Clarke-Wright
  const routes = clarkeWrightSavings(stops, depot, vehicles, distanceMatrix);

  // Assign routes to vehicles
  const routeAssignments = assignRoutesToVehicles(routes, stops, vehicles);

  // Build route solutions
  const routeSolutions: RouteSolution[] = [];
  const assignedStopIds = new Set<string>();

  for (let i = 0; i < routes.length; i++) {
    const vehicleIdx = routeAssignments[i];

    if (vehicleIdx >= 0 && vehicleIdx < vehicles.length) {
      const vehicle = vehicles[vehicleIdx];
      const routeStops = routes[i].map((idx) => stops[idx]);

      // Check if feasible
      if (checkCapacity(vehicle, routeStops)) {
        const routeSolution = buildRouteSolution(
          vehicle,
          routeStops,
          depot,
          vehicle.shiftStart,
          distanceMatrix,
          speedKmh,
        );

        routeSolutions.push(routeSolution);
        routeStops.forEach((s) => assignedStopIds.add(s.id));
      }
    }
  }

  const unassignedStops = stops.filter((s) => !assignedStopIds.has(s.id));

  return [routeSolutions, unassignedStops];
}

// ── Helper Functions ────────────────────────────────────

/**
 * Build a RouteSolution from a vehicle and ordered stops.
 */
function buildRouteSolution(
  vehicle: Vehicle,
  stops: OptimizationStop[],
  depot: GeoPoint,
  departureTime: Date,
  distanceMatrix: number[][],
  speedKmh: number,
): RouteSolution {
  const metrics = calculateRouteMetrics(stops, depot, distanceMatrix, speedKmh);

  const arrivalTime = new Date(
    departureTime.getTime() + metrics.totalDuration * 60 * 1000,
  );

  return {
    vehicleId: vehicle.id,
    stops,
    departureTime,
    arrivalTime,
    totalDistance: metrics.totalDistance,
    totalDuration: metrics.totalDuration,
    totalWeight: metrics.totalWeight,
    totalVolume: metrics.totalVolume,
    isFeasible: checkCapacity(vehicle, stops),
    violations: [],
  };
}

/**
 * Validate routes and filter out infeasible ones.
 */
function validateAndFilterRoutes(
  routes: RouteSolution[],
  vehicles: Vehicle[],
  depot: GeoPoint,
  constraints: OptimizationConstraints,
  distanceMatrix: number[][],
  speedKmh: number,
): RouteSolution[] {
  return routes.filter((route) => {
    const vehicle = vehicles.find((v) => v.id === route.vehicleId);
    if (!vehicle) return false;

    // Check basic feasibility
    if (!checkCapacity(vehicle, route.stops)) return false;

    // Check skills
    for (const stop of route.stops) {
      if (!checkSkillMatch(vehicle, stop)) return false;
    }

    // Check shift time
    if (!checkShiftLimits(vehicle, route)) return false;

    // Check time windows
    if (constraints.respectTimeWindows) {
      const violations = checkTimeWindows(route, depot, distanceMatrix, speedKmh);
      if (violations.length > 0) return false;
    }

    return true;
  });
}

/**
 * Calculate optimization metrics.
 */
function calculateMetrics(
  routes: RouteSolution[],
  allStops: OptimizationStop[],
  vehicles: Vehicle[],
): OptimizationResult["metrics"] {
  let totalDistance = 0;
  let totalDuration = 0;
  let totalWeight = 0;
  let totalVolume = 0;
  let stopsCovered = 0;

  for (const route of routes) {
    totalDistance += route.totalDistance;
    totalDuration += route.totalDuration;
    totalWeight += route.totalWeight;
    totalVolume += route.totalVolume;
    stopsCovered += route.stops.length;
  }

  const vehiclesUsed = new Set(routes.map((r) => r.vehicleId)).size;
  const totalCapacityWeight = vehicles.reduce((sum, v) => sum + v.capacity.weight, 0);
  const averageUtilization =
    vehiclesUsed > 0 ? (totalWeight / (vehiclesUsed * (totalCapacityWeight / vehicles.length))) * 100 : 0;

  return {
    totalDistance,
    totalDuration,
    totalVehiclesUsed: vehiclesUsed,
    averageVehicleUtilization: Math.min(100, averageUtilization),
    stopsCovered,
    stopsUncovered: allStops.length - stopsCovered,
  };
}

/**
 * Count constraint violations.
 */
function countViolations(
  routes: RouteSolution[],
  vehicles: Vehicle[],
  depot: GeoPoint,
  distanceMatrix: number[][],
): OptimizationResult["violations"] {
  let timeWindowViolations = 0;
  let capacityViolations = 0;
  let skillMatchViolations = 0;
  let shiftTimeViolations = 0;

  for (const route of routes) {
    const vehicle = vehicles.find((v) => v.id === route.vehicleId);
    if (!vehicle) continue;

    // Capacity
    if (!checkCapacity(vehicle, route.stops)) capacityViolations++;

    // Time windows
    const twViolations = checkTimeWindows(route, depot, distanceMatrix);
    timeWindowViolations += twViolations.length;

    // Skills
    for (const stop of route.stops) {
      if (!checkSkillMatch(vehicle, stop)) skillMatchViolations++;
    }

    // Shift time
    if (!checkShiftLimits(vehicle, route)) shiftTimeViolations++;
  }

  return {
    timeWindow: timeWindowViolations,
    capacity: capacityViolations,
    skillMatch: skillMatchViolations,
    shiftTime: shiftTimeViolations,
  };
}

/**
 * Create an empty result for error cases.
 */
function createEmptyResult(
  unassignedCount: number,
  algorithm: string,
): OptimizationResult {
  return {
    routes: [],
    unassignedStops: [],
    metrics: {
      totalDistance: 0,
      totalDuration: 0,
      totalVehiclesUsed: 0,
      averageVehicleUtilization: 0,
      stopsCovered: 0,
      stopsUncovered: unassignedCount,
    },
    violations: { timeWindow: 0, capacity: 0, skillMatch: 0, shiftTime: 0 },
    algorithmUsed: algorithm,
    executionTime: 0,
  };
}
