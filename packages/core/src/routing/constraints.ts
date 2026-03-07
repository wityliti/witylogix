/**
 * Constraint checking and validation for route optimization.
 *
 * Validates:
 * - Vehicle capacity (weight, volume)
 * - Time windows (hard constraints on delivery time)
 * - Driver skills required for specific stops
 * - Shift time limits
 * - Overall solution feasibility
 */

import type { GeoPoint } from "./distance.js";
import { computeETAs, haversineDistance, estimateTravelTime } from "./distance.js";

// ── Type Definitions ─────────────────────────────────

/**
 * Represents a stop to be optimized.
 */
export interface OptimizationStop {
  id: string;
  location: GeoPoint;
  timeWindow?: { start: Date; end: Date };
  serviceDuration: number; // minutes at stop
  priority: number; // 1-10, higher = more important
  weight?: number; // kg
  volume?: number; // cubic cm
  skills?: string[]; // required driver skills
  shipmentId?: string;
}

/**
 * Represents a vehicle available for deliveries.
 */
export interface Vehicle {
  id: string;
  driverId: string;
  startLocation: GeoPoint;
  endLocation?: GeoPoint;
  capacity: { weight: number; volume: number };
  maxStops: number;
  shiftStart: Date;
  shiftEnd: Date;
  skills: string[];
  breakTime?: { start: Date; duration: number };
}

/**
 * Represents an assigned route for a vehicle.
 */
export interface RouteSolution {
  vehicleId: string;
  stops: OptimizationStop[]; // in order
  departureTime: Date;
  arrivalTime: Date;
  totalDistance: number; // km
  totalDuration: number; // minutes
  totalWeight: number; // kg
  totalVolume: number; // cubic cm
  isFeasible: boolean;
  violations: string[]; // list of constraint violations
}

/**
 * Time window violation details.
 */
export interface TimeWindowViolation {
  stopId: string;
  windowStart: Date;
  windowEnd: Date;
  arrivalTime: Date;
  violationType: "early" | "late";
}

/**
 * Validation report for a complete optimization result.
 */
export interface ValidationReport {
  isValid: boolean;
  totalStopsAssigned: number;
  totalStopsUnassigned: number;
  routeCount: number;
  violations: {
    capacity: string[];
    timeWindow: TimeWindowViolation[];
    skillMatch: string[];
    shiftTime: string[];
  };
  summary: string;
}

// ── Constraint Checking Functions ────────────────────

/**
 * Check if a vehicle has capacity to accommodate all stops.
 *
 * @param vehicle - The vehicle to check
 * @param stops - The stops to assign to the vehicle
 * @returns true if all stops fit within capacity, false otherwise
 */
export function checkCapacity(vehicle: Vehicle, stops: OptimizationStop[]): boolean {
  let totalWeight = 0;
  let totalVolume = 0;

  for (const stop of stops) {
    totalWeight += stop.weight ?? 0;
    totalVolume += stop.volume ?? 0;
  }

  return totalWeight <= vehicle.capacity.weight && totalVolume <= vehicle.capacity.volume;
}

/**
 * Check for time window violations in a route.
 * Returns an array of violations found; empty array = no violations.
 *
 * @param route - The route to check
 * @param depot - Starting location (warehouse)
 * @param distanceMatrix - Pre-computed distance matrix
 * @param speedKmh - Average speed for travel time estimation (default: 60)
 * @returns Array of time window violations (empty if feasible)
 */
export function checkTimeWindows(
  route: RouteSolution,
  depot: GeoPoint,
  distanceMatrix: number[][],
  speedKmh: number = 60,
): TimeWindowViolation[] {
  const violations: TimeWindowViolation[] = [];

  if (route.stops.length === 0) {
    return violations;
  }

  // Build the full route including depot
  const fullRoute = [depot, ...route.stops.map((s) => s.location)];
  const serviceDurations = [0, ...route.stops.map((s) => s.serviceDuration)];

  const etas = computeETAs(fullRoute, route.departureTime, serviceDurations, speedKmh);

  // Check each stop's time window (skip depot at index 0)
  for (let i = 0; i < route.stops.length; i++) {
    const stop = route.stops[i];
    const arrivalTime = etas[i + 1]; // +1 because fullRoute includes depot

    if (stop.timeWindow) {
      if (arrivalTime < stop.timeWindow.start) {
        violations.push({
          stopId: stop.id,
          windowStart: stop.timeWindow.start,
          windowEnd: stop.timeWindow.end,
          arrivalTime,
          violationType: "early",
        });
      } else if (arrivalTime > stop.timeWindow.end) {
        violations.push({
          stopId: stop.id,
          windowStart: stop.timeWindow.start,
          windowEnd: stop.timeWindow.end,
          arrivalTime,
          violationType: "late",
        });
      }
    }
  }

  return violations;
}

/**
 * Check if a vehicle has the required skills to service a stop.
 *
 * @param vehicle - The vehicle to check
 * @param stop - The stop that requires certain skills
 * @returns true if vehicle has all required skills, false otherwise
 */
export function checkSkillMatch(vehicle: Vehicle, stop: OptimizationStop): boolean {
  // If the stop has no skill requirements, it's compatible
  if (!stop.skills || stop.skills.length === 0) {
    return true;
  }

  // Check if vehicle has all required skills
  return stop.skills.every((skill) => vehicle.skills.includes(skill));
}

/**
 * Check if a route can be completed within the vehicle's shift time.
 *
 * @param vehicle - The vehicle
 * @param route - The route solution
 * @returns true if route fits within shift, false otherwise
 */
export function checkShiftLimits(vehicle: Vehicle, route: RouteSolution): boolean {
  // Check if departure is before shift end and arrival is before shift end
  const routeEndTime = new Date(route.departureTime.getTime() + route.totalDuration * 60 * 1000);
  return (
    route.departureTime >= vehicle.shiftStart &&
    routeEndTime <= vehicle.shiftEnd
  );
}

/**
 * Get capacity utilization of a route.
 *
 * @param vehicle - The vehicle
 * @param stops - The stops assigned to the vehicle
 * @returns Object with weight and volume utilization percentages
 */
export function getCapacityUtilization(
  vehicle: Vehicle,
  stops: OptimizationStop[],
): { weight: number; volume: number } {
  let totalWeight = 0;
  let totalVolume = 0;

  for (const stop of stops) {
    totalWeight += stop.weight ?? 0;
    totalVolume += stop.volume ?? 0;
  }

  return {
    weight: (totalWeight / vehicle.capacity.weight) * 100,
    volume: (totalVolume / vehicle.capacity.volume) * 100,
  };
}

/**
 * Calculate total route metrics (distance, duration, weight, volume).
 *
 * @param route - The stops in order
 * @param depot - Starting location
 * @param distanceMatrix - Pre-computed distance matrix (if available)
 * @param speedKmh - Average speed for duration calculation
 * @returns Object with calculated metrics
 */
export function calculateRouteMetrics(
  route: OptimizationStop[],
  depot: GeoPoint,
  distanceMatrix?: number[][],
  speedKmh: number = 60,
): {
  totalDistance: number;
  totalDuration: number;
  totalWeight: number;
  totalVolume: number;
} {
  let totalDistance = 0;
  let totalWeight = 0;
  let totalVolume = 0;

  // Calculate distance
  let currentLocation = depot;
  const points = [depot, ...route.map((s) => s.location)];

  for (let i = 0; i < route.length; i++) {
    const nextLocation = route[i].location;
    if (distanceMatrix) {
      // Use precomputed matrix if available (assuming depot is at index 0)
      // Note: This is a simplified approach; in practice, you'd need proper indexing
      totalDistance += haversineDistance(currentLocation, nextLocation);
    } else {
      totalDistance += haversineDistance(currentLocation, nextLocation);
    }
    currentLocation = nextLocation;
  }

  // Add return to depot
  totalDistance += haversineDistance(currentLocation, depot);

  // Calculate duration
  const serviceDurations = [0, ...route.map((s) => s.serviceDuration), 0];
  let totalDuration = estimateTravelTime(totalDistance, speedKmh);
  for (const duration of serviceDurations) {
    totalDuration += duration;
  }

  // Calculate weight and volume
  for (const stop of route) {
    totalWeight += stop.weight ?? 0;
    totalVolume += stop.volume ?? 0;
  }

  return { totalDistance, totalDuration, totalWeight, totalVolume };
}

/**
 * Comprehensive validation of an optimization result.
 *
 * @param routes - All assigned routes
 * @param vehicle - The vehicle for this route
 * @param depot - The depot location
 * @param unassignedStops - Any stops that couldn't be assigned
 * @returns Detailed validation report
 */
export function validateRoute(
  route: RouteSolution,
  vehicle: Vehicle,
  depot: GeoPoint,
  distanceMatrix?: number[][],
): ValidationReport {
  const violations = {
    capacity: [] as string[],
    timeWindow: [] as TimeWindowViolation[],
    skillMatch: [] as string[],
    shiftTime: [] as string[],
  };

  // Check capacity
  if (!checkCapacity(vehicle, route.stops)) {
    const util = getCapacityUtilization(vehicle, route.stops);
    violations.capacity.push(
      `Vehicle ${vehicle.id} exceeds capacity: weight=${util.weight.toFixed(1)}%, volume=${util.volume.toFixed(1)}%`,
    );
  }

  // Check time windows
  const timeWindowViolations = checkTimeWindows(route, depot, distanceMatrix || [[]], 60);
  violations.timeWindow.push(...timeWindowViolations);

  // Check skill match
  for (const stop of route.stops) {
    if (!checkSkillMatch(vehicle, stop)) {
      const missingSkills = (stop.skills || []).filter((s) => !vehicle.skills.includes(s));
      violations.skillMatch.push(
        `Stop ${stop.id} requires skills [${missingSkills.join(", ")}] not available on vehicle ${vehicle.id}`,
      );
    }
  }

  // Check shift limits
  if (!checkShiftLimits(vehicle, route)) {
    violations.shiftTime.push(
      `Route for vehicle ${vehicle.id} exceeds shift time limits: departure=${route.departureTime.toISOString()}, arrival=${new Date(
        route.departureTime.getTime() + route.totalDuration * 60 * 1000,
      ).toISOString()}`,
    );
  }

  const isValid =
    violations.capacity.length === 0 &&
    violations.timeWindow.length === 0 &&
    violations.skillMatch.length === 0 &&
    violations.shiftTime.length === 0;

  const summary = isValid
    ? `Route ${route.vehicleId} is valid: ${route.stops.length} stops, ${route.totalDistance.toFixed(1)} km`
    : `Route ${route.vehicleId} has ${violations.capacity.length + violations.timeWindow.length + violations.skillMatch.length + violations.shiftTime.length} violations`;

  return {
    isValid,
    totalStopsAssigned: route.stops.length,
    totalStopsUnassigned: 0,
    routeCount: 1,
    violations,
    summary,
  };
}
