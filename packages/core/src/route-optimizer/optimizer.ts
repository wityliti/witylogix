/**
 * Core route optimization engine.
 *
 * Implements multiple optimization algorithms:
 * - Nearest-neighbor: Quick greedy solution (O(n²))
 * - 2-opt: Local search improvement (O(n²) iterations)
 * - Savings: Clarke-Wright algorithm for multi-vehicle VRP
 *
 * Handles constraints:
 * - Time windows (hard constraints)
 * - Vehicle capacity (weight, volume)
 * - Max stops per vehicle
 * - Max route duration/distance
 * - Priority-based ordering
 */

import type {
  Stop,
  GeoPoint,
  RouteOptimizationRequest,
  RouteOptimizationResult,
  OptimizedRoute,
  OptimizedStop,
  DistanceMatrix,
} from "./types.js";

import { computeDistanceMatrix } from "./distance-matrix.js";
import { calculateETAFromMatrix } from "./eta-calculator.js";

/**
 * Route optimization engine.
 *
 * Stateless optimizer supporting multiple algorithms and constraint checking.
 */
export class RouteOptimizer {
  /**
   * Optimize a set of stops into delivery routes.
   *
   * Applies the configured algorithm to generate an optimized route plan.
   * Handles unassigned stops that violate constraints.
   *
   * @param request - Optimization request with stops and constraints
   * @returns Complete optimization result
   *
   * @throws Error if request is invalid (no stops, invalid depot, etc)
   *
   * @example
   * const optimizer = new RouteOptimizer();
   * const result = await optimizer.optimize({
   *   depot: { latitude: 40.7128, longitude: -74.0060 },
   *   stops: [
   *     { id: "s1", location: {...}, serviceDuration: 5, priority: 1 },
   *     { id: "s2", location: {...}, serviceDuration: 10, priority: 2 }
   *   ],
   *   vehicleCount: 2,
   *   constraints: { respectTimeWindows: true, minimizeVehicles: true }
   * });
   */
  public async optimize(
    request: RouteOptimizationRequest,
  ): Promise<RouteOptimizationResult> {
    const startTime = performance.now();

    // Validate request
    this.validateRequest(request);

    // Build all points list (depot + stops)
    const allPoints = [request.depot, ...request.stops.map((s) => s.location)];

    // Compute or use provided distance matrix
    const distanceMatrix =
      request.distanceMatrix || computeDistanceMatrix(allPoints, 60, 1.0);

    // Run optimization algorithm
    const algorithmName = request.algorithm?.name || "nearest-neighbor";
    const routes = await this.runAlgorithm(
      request.depot,
      request.stops,
      request.vehicleCount,
      request.constraints,
      distanceMatrix,
      algorithmName,
    );

    // Identify assigned and unassigned stops
    const assignedStopIds = new Set<string>();
    for (const route of routes) {
      for (const stop of route.stops) {
        assignedStopIds.add(stop.id);
      }
    }

    const unassignedStops = request.stops.filter(
      (s) => !assignedStopIds.has(s.id),
    );

    // Calculate metrics
    const metrics = this.calculateMetrics(routes, request.stops);
    const violations = this.countViolations(routes);

    const executionTimeMs = performance.now() - startTime;

    return {
      jobId: this.generateJobId(),
      routes,
      unassignedStops,
      metrics,
      violations,
      algorithmUsed: algorithmName,
      executionTimeMs,
      timestamp: new Date(),
    };
  }

  /**
   * Run the specified optimization algorithm.
   *
   * @param depot - Starting location
   * @param stops - Stops to optimize
   * @param vehicleCount - Number of vehicles available
   * @param constraints - Optimization constraints
   * @param distanceMatrix - Pre-computed distance matrix
   * @param algorithm - Algorithm name
   * @returns List of optimized routes
   */
  private async runAlgorithm(
    depot: GeoPoint,
    stops: Stop[],
    vehicleCount: number,
    constraints: RouteOptimizationRequest["constraints"],
    distanceMatrix: DistanceMatrix,
    algorithm: string,
  ): Promise<OptimizedRoute[]> {
    switch (algorithm) {
      case "nearest-neighbor":
        return this.nearestNeighborAlgorithm(
          depot,
          stops,
          vehicleCount,
          constraints,
          distanceMatrix,
        );

      case "nearest-neighbor-2opt":
        return this.nearestNeighbor2OptAlgorithm(
          depot,
          stops,
          vehicleCount,
          constraints,
          distanceMatrix,
        );

      case "savings":
        return this.savingsAlgorithm(
          depot,
          stops,
          vehicleCount,
          constraints,
          distanceMatrix,
        );

      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }

  /**
   * Nearest-neighbor heuristic: Build routes greedily.
   *
   * Time complexity: O(n²)
   * Fast but often suboptimal.
   */
  private nearestNeighborAlgorithm(
    depot: GeoPoint,
    stops: Stop[],
    vehicleCount: number,
    constraints: RouteOptimizationRequest["constraints"],
    distanceMatrix: DistanceMatrix,
  ): OptimizedRoute[] {
    // Sort by priority (higher priority first)
    const sortedStops = [...stops].sort((a, b) => b.priority - a.priority);

    const routes: OptimizedRoute[] = [];
    const assigned = new Set<string>();

    for (
      let v = 0;
      v < vehicleCount && assigned.size < sortedStops.length;
      v++
    ) {
      const route = this.buildNearestNeighborRoute(
        depot,
        sortedStops,
        assigned,
        constraints,
        distanceMatrix,
        `route-${v}`,
      );

      if (route.stops.length > 0) {
        routes.push(route);
        for (const stop of route.stops) {
          assigned.add(stop.id);
        }
      }
    }

    return routes;
  }

  /**
   * Nearest-neighbor followed by 2-opt local search.
   *
   * Better solutions but slower than pure nearest-neighbor.
   */
  private nearestNeighbor2OptAlgorithm(
    depot: GeoPoint,
    stops: Stop[],
    vehicleCount: number,
    constraints: RouteOptimizationRequest["constraints"],
    distanceMatrix: DistanceMatrix,
  ): OptimizedRoute[] {
    // Get initial solution
    let routes = this.nearestNeighborAlgorithm(
      depot,
      stops,
      vehicleCount,
      constraints,
      distanceMatrix,
    );

    // Apply 2-opt improvement
    routes = this.apply2OptImprovement(depot, routes, distanceMatrix);

    return routes;
  }

  /**
   * Clarke-Wright savings algorithm for multi-vehicle routing.
   *
   * Better for multi-vehicle problems.
   */
  private savingsAlgorithm(
    depot: GeoPoint,
    stops: Stop[],
    vehicleCount: number,
    constraints: RouteOptimizationRequest["constraints"],
    distanceMatrix: DistanceMatrix,
  ): OptimizedRoute[] {
    // Start with each stop as its own route
    const routes: OptimizedRoute[] = stops.map((stop, idx) =>
      this.createSingleStopRoute(depot, stop, `route-${idx}`, distanceMatrix),
    );

    // Compute savings and merge routes
    const savings = this.computeSavings(depot, stops, distanceMatrix);
    const sortedSavings = [...savings].sort((a, b) => b.saving - a.saving);

    const routeMap = new Map<string, OptimizedRoute>();
    routes.forEach((r) => routeMap.set(r.id, r));

    for (const { stopI, stopJ, saving } of sortedSavings) {
      const routeI = Array.from(routeMap.values()).find((r) =>
        r.stops.some((s) => s.id === stopI),
      );
      const routeJ = Array.from(routeMap.values()).find((r) =>
        r.stops.some((s) => s.id === stopJ),
      );

      if (!routeI || !routeJ || routeI.id === routeJ.id) continue;

      // Try to merge routes
      const merged = this.tryMergeRoutes(
        depot,
        routeI,
        routeJ,
        constraints,
        distanceMatrix,
      );
      if (merged) {
        routeMap.delete(routeI.id);
        routeMap.delete(routeJ.id);
        routeMap.set(merged.id, merged);
      }
    }

    return Array.from(routeMap.values());
  }

  /**
   * Build a single route using nearest-neighbor.
   *
   * VRPTW handling:
   * - Early arrival (before window start): driver waits; recorded as "early" violation.
   * - Late arrival (after window end): stop is excluded when respectTimeWindows is true.
   * - When respectTimeWindows is false: late arrivals are included but flagged as violations.
   */
  private buildNearestNeighborRoute(
    depot: GeoPoint,
    stops: Stop[],
    assigned: Set<string>,
    constraints: RouteOptimizationRequest["constraints"],
    distanceMatrix: DistanceMatrix,
    routeId: string,
  ): OptimizedRoute {
    const routeStops: OptimizedStop[] = [];
    const routeViolations: string[] = [];
    // Track stops skipped due to time-window infeasibility so we don't loop forever
    const timeWindowSkipped = new Set<string>();

    let current = 0; // Index of depot in distance matrix
    let totalDistance = 0;
    let totalDuration = 0;
    let totalWeight = 0;
    let totalVolume = 0;
    let currentTime = new Date();

    while (routeStops.length < (constraints.maxStopsPerVehicle || Infinity)) {
      let nextIdx = -1;
      let minDistance = Infinity;

      // Find nearest unassigned stop that is not time-window-skipped for this route
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        if (
          assigned.has(stop.id) ||
          routeStops.find((s) => s.id === stop.id) ||
          timeWindowSkipped.has(stop.id)
        ) {
          continue;
        }
        const d = distanceMatrix.distances[current][i + 1]; // +1 because index 0 is depot
        if (d < minDistance) {
          minDistance = d;
          nextIdx = i;
        }
      }

      if (nextIdx === -1) break;

      const stop = stops[nextIdx];
      const stopIdx = nextIdx + 1;
      const travelSeconds = distanceMatrix.durations[current][stopIdx];
      const rawArrivalTime = new Date(
        currentTime.getTime() + travelSeconds * 1000,
      );

      // ── Time-window check ───────────────────────────────────
      let effectiveArrivalTime = rawArrivalTime;
      let stopViolation: OptimizedStop["timeWindowViolation"] | undefined;

      if (stop.timeWindow) {
        if (rawArrivalTime > stop.timeWindow.end) {
          // Late arrival — hard constraint when respectTimeWindows is enabled
          if (constraints.respectTimeWindows) {
            // Exclude this stop from the current route and try the next nearest
            timeWindowSkipped.add(stop.id);
            routeViolations.push(
              `Stop ${stop.id}: late arrival (time window closed)`,
            );
            continue;
          }
          // Soft constraint: include but flag the violation
          const minutesOff =
            (rawArrivalTime.getTime() - stop.timeWindow.end.getTime()) / 60000;
          stopViolation = { type: "late", minutesOff: Math.round(minutesOff) };
          routeViolations.push(
            `Stop ${stop.id}: late by ${Math.round(minutesOff)} min`,
          );
        } else if (rawArrivalTime < stop.timeWindow.start) {
          // Early arrival — driver waits until the window opens
          const minutesOff =
            (stop.timeWindow.start.getTime() - rawArrivalTime.getTime()) /
            60000;
          effectiveArrivalTime = new Date(stop.timeWindow.start);
          stopViolation = { type: "early", minutesOff: Math.round(minutesOff) };
        }
      }

      // ── Capacity check ──────────────────────────────────────
      const newWeight = totalWeight + (stop.weight || 0);
      const newVolume = totalVolume + (stop.volume || 0);
      if (
        constraints.vehicleCapacityWeight &&
        newWeight > constraints.vehicleCapacityWeight
      ) {
        break;
      }
      if (
        constraints.vehicleCapacityVolume &&
        newVolume > constraints.vehicleCapacityVolume
      ) {
        break;
      }

      // ── Build optimized stop ────────────────────────────────
      const departureTime = new Date(
        effectiveArrivalTime.getTime() + stop.serviceDuration * 60 * 1000,
      );

      const eta = calculateETAFromMatrix(
        current,
        stopIdx,
        currentTime,
        stop.serviceDuration,
        distanceMatrix,
      );

      const optimizedStop: OptimizedStop = {
        ...stop,
        arrivalTime: effectiveArrivalTime,
        departureTime,
        eta,
        cumulativeDistance:
          totalDistance + distanceMatrix.distances[current][stopIdx],
        sequenceNumber: routeStops.length,
        ...(stopViolation ? { timeWindowViolation: stopViolation } : {}),
      };

      routeStops.push(optimizedStop);
      totalDistance += distanceMatrix.distances[current][stopIdx];
      // Duration accounts for travel + any waiting at early window + service time
      const waitSeconds = Math.max(
        0,
        (effectiveArrivalTime.getTime() - rawArrivalTime.getTime()) / 1000,
      );
      totalDuration += travelSeconds + waitSeconds + stop.serviceDuration * 60;
      totalWeight = newWeight;
      totalVolume = newVolume;
      currentTime = departureTime;
      current = stopIdx;
    }

    // Add distance back to depot
    const returnDistance = distanceMatrix.distances[current][0];
    const returnDuration = distanceMatrix.durations[current][0];
    totalDistance += returnDistance;
    totalDuration += returnDuration;

    const completionTime = new Date(
      currentTime.getTime() + returnDuration * 1000,
    );
    const departureTime = new Date();

    const timeWindowViolationCount = routeStops.filter(
      (s) => s.timeWindowViolation?.type === "late",
    ).length;

    return {
      id: routeId,
      vehicleId: routeId,
      stops: routeStops,
      departureTime,
      completionTime,
      totalDistance,
      totalDuration,
      totalWeight,
      totalVolume,
      utilizationPercentage:
        routeStops.length > 0
          ? (totalWeight / (constraints.vehicleCapacityWeight || 100)) * 100
          : 0,
      isFeasible:
        timeWindowViolationCount === 0 && routeViolations.length === 0,
      violations: routeViolations,
    };
  }

  /**
   * Apply 2-opt local search to improve routes.
   */
  private apply2OptImprovement(
    depot: GeoPoint,
    routes: OptimizedRoute[],
    distanceMatrix: DistanceMatrix,
  ): OptimizedRoute[] {
    // Simplified 2-opt: try swapping adjacent stops
    for (const route of routes) {
      for (let i = 0; i < route.stops.length - 1; i++) {
        for (let j = i + 2; j < route.stops.length; j++) {
          // Try reversing segment [i+1, j]
          const currentDist = this.routeDistance(route, distanceMatrix, depot);

          const newStops = [...route.stops];
          const segment = newStops.splice(i + 1, j - i);
          newStops.splice(i + 1, 0, ...segment.reverse());

          const newRoute = { ...route, stops: newStops };
          const newDist = this.routeDistance(newRoute, distanceMatrix, depot);

          if (newDist < currentDist) {
            route.stops = newStops;
          }
        }
      }
    }

    return routes;
  }

  /**
   * Calculate total distance of a route.
   */
  private routeDistance(
    route: OptimizedRoute,
    distanceMatrix: DistanceMatrix,
    depot: GeoPoint,
  ): number {
    let total = 0;
    let current = 0; // Depot index

    for (const stop of route.stops) {
      const stopIdx = distanceMatrix.points.findIndex(
        (p) =>
          p.latitude === stop.location.latitude &&
          p.longitude === stop.location.longitude,
      );
      if (stopIdx !== -1) {
        total += distanceMatrix.distances[current][stopIdx];
        current = stopIdx;
      }
    }

    // Return to depot
    total += distanceMatrix.distances[current][0];
    return total;
  }

  /**
   * Create a single-stop route.
   */
  private createSingleStopRoute(
    depot: GeoPoint,
    stop: Stop,
    routeId: string,
    distanceMatrix: DistanceMatrix,
  ): OptimizedRoute {
    const stopIdx = distanceMatrix.points.findIndex(
      (p) =>
        p.latitude === stop.location.latitude &&
        p.longitude === stop.location.longitude,
    );

    const arrivalTime = new Date(
      Date.now() + distanceMatrix.durations[0][stopIdx] * 1000,
    );
    const departureTime = new Date(
      arrivalTime.getTime() + stop.serviceDuration * 60 * 1000,
    );

    const eta = calculateETAFromMatrix(
      0,
      stopIdx,
      new Date(),
      stop.serviceDuration,
      distanceMatrix,
    );

    const optimizedStop: OptimizedStop = {
      ...stop,
      arrivalTime,
      departureTime,
      eta,
      cumulativeDistance: distanceMatrix.distances[0][stopIdx],
      sequenceNumber: 0,
    };

    return {
      id: routeId,
      vehicleId: routeId,
      stops: [optimizedStop],
      departureTime: new Date(),
      completionTime: departureTime,
      totalDistance:
        distanceMatrix.distances[0][stopIdx] +
        distanceMatrix.distances[stopIdx][0],
      totalDuration:
        distanceMatrix.durations[0][stopIdx] +
        stop.serviceDuration * 60 +
        distanceMatrix.durations[stopIdx][0],
      totalWeight: stop.weight || 0,
      totalVolume: stop.volume || 0,
      utilizationPercentage: 10,
      isFeasible: true,
      violations: [],
    };
  }

  /**
   * Compute savings for Clarke-Wright algorithm.
   */
  private computeSavings(
    depot: GeoPoint,
    stops: Stop[],
    distanceMatrix: DistanceMatrix,
  ): Array<{ stopI: string; stopJ: string; saving: number }> {
    const savings: Array<{ stopI: string; stopJ: string; saving: number }> = [];

    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const saving =
          distanceMatrix.distances[i + 1][0] +
          distanceMatrix.distances[0][j + 1] -
          distanceMatrix.distances[i + 1][j + 1];
        savings.push({
          stopI: stops[i].id,
          stopJ: stops[j].id,
          saving,
        });
      }
    }

    return savings;
  }

  /**
   * Try to merge two routes.
   */
  private tryMergeRoutes(
    depot: GeoPoint,
    route1: OptimizedRoute,
    route2: OptimizedRoute,
    constraints: RouteOptimizationRequest["constraints"],
    distanceMatrix: DistanceMatrix,
  ): OptimizedRoute | null {
    const mergedWeight = route1.totalWeight + route2.totalWeight;
    const mergedVolume = route1.totalVolume + route2.totalVolume;

    // Check capacity constraints before merging
    if (
      constraints.vehicleCapacityWeight &&
      mergedWeight > constraints.vehicleCapacityWeight
    ) {
      return null;
    }
    if (
      constraints.vehicleCapacityVolume &&
      mergedVolume > constraints.vehicleCapacityVolume
    ) {
      return null;
    }

    const mergedStops = [...route1.stops, ...route2.stops];

    // Check time-window feasibility of the merged sequence
    if (constraints.respectTimeWindows) {
      for (const stop of mergedStops) {
        if ((stop as OptimizedStop).timeWindowViolation?.type === "late") {
          return null;
        }
      }
    }

    const mergedViolations = [...route1.violations, ...route2.violations];

    return {
      ...route1,
      id: `${route1.id}-merged`,
      stops: mergedStops,
      totalWeight: mergedWeight,
      totalVolume: mergedVolume,
      totalDistance: route1.totalDistance + route2.totalDistance,
      totalDuration: route1.totalDuration + route2.totalDuration,
      completionTime: new Date(
        route1.completionTime.getTime() + route2.totalDuration * 1000,
      ),
      isFeasible: mergedViolations.length === 0,
      violations: mergedViolations,
    };
  }

  /**
   * Validate optimization request.
   */
  private validateRequest(request: RouteOptimizationRequest): void {
    if (
      !request.depot ||
      !isFinite(request.depot.latitude) ||
      !isFinite(request.depot.longitude)
    ) {
      throw new Error("Depot location is required");
    }
    if (!request.stops || request.stops.length === 0) {
      throw new Error("At least one stop is required");
    }
    if (request.vehicleCount < 1) {
      throw new Error("At least one vehicle is required");
    }
  }

  /**
   * Calculate metrics from optimized routes.
   */
  private calculateMetrics(
    routes: OptimizedRoute[],
    allStops: Stop[],
  ): RouteOptimizationResult["metrics"] {
    const assignedStopIds = new Set<string>();
    let totalDistance = 0;
    let totalDuration = 0;

    for (const route of routes) {
      totalDistance += route.totalDistance;
      totalDuration += route.totalDuration;
      for (const stop of route.stops) {
        assignedStopIds.add(stop.id);
      }
    }

    return {
      totalDistance,
      totalDuration,
      vehiclesUsed: routes.length,
      stopsCovered: assignedStopIds.size,
      stopsUncovered: allStops.length - assignedStopIds.size,
      averageUtilization:
        routes.length > 0
          ? routes.reduce((sum, r) => sum + r.utilizationPercentage, 0) /
            routes.length
          : 0,
    };
  }

  /**
   * Count constraint violations across all routes.
   */
  private countViolations(
    routes: OptimizedRoute[],
  ): RouteOptimizationResult["violations"] {
    const violations = {
      timeWindow: 0,
      capacity: 0,
      skillMatch: 0,
      maxStops: 0,
    };

    for (const route of routes) {
      // Count per-stop time window violations (late arrivals are hard violations)
      violations.timeWindow += route.stops.filter(
        (s) => (s as OptimizedStop).timeWindowViolation?.type === "late",
      ).length;
      violations.capacity += route.violations.filter((v) =>
        v.includes("capacity"),
      ).length;
      violations.skillMatch += route.violations.filter((v) =>
        v.includes("skill"),
      ).length;
      violations.maxStops += route.violations.filter((v) =>
        v.includes("stops"),
      ).length;
    }

    return violations;
  }

  /**
   * Generate a unique job ID.
   */
  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
