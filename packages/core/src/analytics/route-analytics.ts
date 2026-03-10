/**
 * Route Analytics Service
 *
 * Core analytics engine for planned-vs-actual route performance metrics.
 * Implements KPI calculations for benchmarking against Route4Me, Routific.
 *
 * Public API:
 *   - calculateOnTimePercentage(routes, dateRange)
 *   - calculatePlannedVsActual(routes)
 *   - calculateDriverScorecard(driverId, dateRange)
 *   - calculateCO2Estimates(routes)
 *   - calculateServiceLevelMetrics(tenantId, dateRange)
 *   - calculateRouteEfficiency(routeId)
 */

import type { TimeRange } from "./types.js";

/**
 * Route data structure for analytics calculations
 */
export interface RouteData {
  id: string;
  driverId: string;
  zoneId?: string;
  vehicleType: "motorcycle" | "van" | "truck-small" | "truck-large";
  status: "planned" | "in-progress" | "completed" | "failed";

  // Planned metrics
  plannedDistance: number; // km
  plannedDuration: number; // minutes
  plannedStartTime: Date;
  plannedEndTime: Date;

  // Actual metrics
  actualDistance?: number; // km
  actualDuration?: number; // minutes
  actualStartTime?: Date;
  actualEndTime?: Date;
  actualDeparture?: Date;

  // Stops/deliveries
  stops: DeliveryStop[];

  // SLA information
  slaTier?: "premium" | "standard" | "economy";
}

/**
 * Individual delivery/stop information
 */
export interface DeliveryStop {
  orderId: string;
  estimatedArrival: Date;
  actualArrival?: Date;
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes
  status: "planned" | "attempted" | "delivered" | "failed" | "returned";
  customerRating?: number; // 1-5
  firstAttempt?: boolean;
  slaTier?: "premium" | "standard" | "economy";
}

/**
 * Planned vs Actual comparison result
 */
export interface PlannedVsActual {
  routeId: string;
  plannedDuration: number;
  actualDuration: number;
  variance: number;
  variancePercent: number;
  status: "on-time" | "delayed" | "not-completed";
}

/**
 * Driver performance scorecard
 */
export interface DriverScorecard {
  driverId: string;
  period: "24h" | "7d" | "30d";
  deliveriesCompleted: number;
  deliveriesAttempted: number;
  onTimePercentage: number;
  avgTimePerStop: number; // minutes
  customerRatingAvg: number; // 1-5
  firstAttemptRate: number; // percentage
  compositeScore: number; // 0-100
  trend: "up" | "down" | "neutral";
}

/**
 * CO2 impact estimates
 */
export interface CO2Estimates {
  routeId: string;
  vehicleType: string;
  plannedCO2kg: number;
  actualCO2kg: number;
  savedCO2kg: number;
  distanceVariance: number; // km
}

/**
 * Service level metrics per tenant
 */
export interface ServiceLevelMetrics {
  tenantId: string;
  dateRange: TimeRange;
  totalDeliveries: number;
  slaCompliance: {
    premium: number; // percentage
    standard: number;
    economy: number;
    overall: number;
  };
  firstAttemptRate: number; // percentage
  returnRate: number; // percentage
  failureRate: number; // percentage
}

/**
 * Route efficiency metrics
 */
export interface RouteEfficiency {
  routeId: string;
  plannedDistance: number;
  actualDistance: number;
  routeDeviation: number; // percentage
  idleTime: number; // minutes
  idlePercentage: number; // percentage
  deviationEvents: number;
  efficiencyRating: "excellent" | "good" | "fair" | "poor";
}

/**
 * CO2 emission factors by vehicle type (kg/km)
 */
const EMISSION_FACTORS: Record<string, number> = {
  "motorcycle": 0.089,
  "van": 0.156,
  "truck-small": 0.198,
  "truck-large": 0.286,
};

/**
 * SLA tier definitions
 */
const SLA_TIERS = {
  premium: { window: 120 }, // 2-hour window
  standard: { window: 240 }, // 4-hour window
  economy: { window: 480 }, // 8-hour window
};

/**
 * Calculate on-time delivery percentage
 *
 * On-time = deliveries within (estimatedTime ± 5min buffer) / total completed
 * Excludes failed, returned, cancelled
 *
 * @param routes Route data array
 * @param dateRange Optional date filter
 * @returns On-time percentage (0-100)
 */
export function calculateOnTimePercentage(
  routes: RouteData[],
  dateRange?: TimeRange
): number {
  const buffer = 5; // minutes

  const filteredRoutes = dateRange
    ? routes.filter(r => {
        const endTime = r.actualEndTime || r.plannedEndTime;
        return endTime >= dateRange.from && endTime <= dateRange.to;
      })
    : routes;

  if (filteredRoutes.length === 0) return 0;

  const deliveries = filteredRoutes.flatMap(r => r.stops);

  const onTimeDeliveries = deliveries.filter(stop => {
    // Only count completed deliveries
    if (!stop.actualArrival || stop.status !== "delivered") return false;

    const estimatedTime = stop.estimatedArrival.getTime();
    const actualTime = stop.actualArrival.getTime();
    const bufferMs = buffer * 60 * 1000;

    return actualTime >= estimatedTime - bufferMs &&
           actualTime <= estimatedTime + bufferMs;
  }).length;

  if (deliveries.length === 0) return 0;

  return (onTimeDeliveries / deliveries.length) * 100;
}

/**
 * Calculate planned vs actual duration per route
 *
 * @param routes Route data array
 * @returns Array of planned vs actual comparisons
 */
export function calculatePlannedVsActual(
  routes: RouteData[]
): PlannedVsActual[] {
  return routes.map(route => {
    const actualDuration = route.actualDuration || 0;
    const plannedDuration = route.plannedDuration;
    const variance = actualDuration - plannedDuration;
    const variancePercent = plannedDuration > 0
      ? (variance / plannedDuration) * 100
      : 0;

    // Determine status
    let status: "on-time" | "delayed" | "not-completed" = "not-completed";
    if (route.status === "completed") {
      status = variance <= 5 ? "on-time" : "delayed";
    }

    return {
      routeId: route.id,
      plannedDuration,
      actualDuration,
      variance,
      variancePercent,
      status,
    };
  });
}

/**
 * Calculate driver performance scorecard
 *
 * Composite score = (onTime × 0.4) + (efficiency × 0.3) + (rating × 0.2) + (firstAttempt × 0.1)
 *
 * @param driverId Driver ID
 * @param routes All routes for the driver in period
 * @param period Time period for aggregation
 * @returns Driver scorecard
 */
export function calculateDriverScorecard(
  driverId: string,
  routes: RouteData[],
  period: "24h" | "7d" | "30d" = "30d"
): DriverScorecard {
  const driverRoutes = routes.filter(r => r.driverId === driverId);

  if (driverRoutes.length === 0) {
    return {
      driverId,
      period,
      deliveriesCompleted: 0,
      deliveriesAttempted: 0,
      onTimePercentage: 0,
      avgTimePerStop: 0,
      customerRatingAvg: 0,
      firstAttemptRate: 0,
      compositeScore: 0,
      trend: "neutral",
    };
  }

  // Count deliveries
  const allStops = driverRoutes.flatMap(r => r.stops);
  const deliveriesCompleted = allStops.filter(s => s.status === "delivered").length;
  const deliveriesAttempted = allStops.length;

  // On-time percentage
  const onTimePercentage = calculateOnTimePercentage(driverRoutes);

  // Average time per stop
  const stopsWithActualTime = allStops.filter(s => s.actualDuration !== undefined);
  const avgTimePerStop = stopsWithActualTime.length > 0
    ? stopsWithActualTime.reduce((sum, s) => sum + (s.actualDuration || 0), 0) /
      stopsWithActualTime.length
    : 0;

  // Customer rating average
  const stopsWithRating = allStops.filter(s => s.customerRating !== undefined);
  const customerRatingAvg = stopsWithRating.length > 0
    ? stopsWithRating.reduce((sum, s) => sum + (s.customerRating || 0), 0) /
      stopsWithRating.length
    : 0;

  // First attempt rate
  const firstAttemptStops = allStops.filter(s => s.firstAttempt === true).length;
  const firstAttemptRate = deliveriesAttempted > 0
    ? (firstAttemptStops / deliveriesAttempted) * 100
    : 0;

  // Efficiency score (inverse of avg time variance)
  const plannedVsActual = calculatePlannedVsActual(driverRoutes);
  const avgVariancePercent = plannedVsActual.length > 0
    ? Math.abs(
        plannedVsActual.reduce((sum, p) => sum + p.variancePercent, 0) /
        plannedVsActual.length
      )
    : 0;
  const efficiencyScore = Math.max(0, 100 - avgVariancePercent);

  // Composite score
  const ratingScore = (customerRatingAvg / 5) * 100;
  const compositeScore =
    (onTimePercentage * 0.4) +
    (efficiencyScore * 0.3) +
    (ratingScore * 0.2) +
    (firstAttemptRate * 0.1);

  // Determine trend (mock: neutral for now)
  const trend: "up" | "down" | "neutral" = "neutral";

  return {
    driverId,
    period,
    deliveriesCompleted,
    deliveriesAttempted,
    onTimePercentage: Math.round(onTimePercentage * 100) / 100,
    avgTimePerStop: Math.round(avgTimePerStop * 100) / 100,
    customerRatingAvg: Math.round(customerRatingAvg * 100) / 100,
    firstAttemptRate: Math.round(firstAttemptRate * 100) / 100,
    compositeScore: Math.round(compositeScore * 100) / 100,
    trend,
  };
}

/**
 * Calculate CO2 emission estimates
 *
 * CO2 = distance × emissionFactor[vehicleType]
 * Saved CO2 = plannedCO2 - actualCO2
 *
 * @param routes Route data array
 * @returns CO2 estimates for each route
 */
export function calculateCO2Estimates(routes: RouteData[]): CO2Estimates[] {
  return routes.map(route => {
    const emissionFactor = EMISSION_FACTORS[route.vehicleType] || 0.156;

    const plannedCO2kg = route.plannedDistance * emissionFactor;
    const actualDistance = route.actualDistance || route.plannedDistance;
    const actualCO2kg = actualDistance * emissionFactor;
    const savedCO2kg = plannedCO2kg - actualCO2kg;
    const distanceVariance = actualDistance - route.plannedDistance;

    return {
      routeId: route.id,
      vehicleType: route.vehicleType,
      plannedCO2kg: Math.round(plannedCO2kg * 100) / 100,
      actualCO2kg: Math.round(actualCO2kg * 100) / 100,
      savedCO2kg: Math.round(savedCO2kg * 100) / 100,
      distanceVariance: Math.round(distanceVariance * 100) / 100,
    };
  });
}

/**
 * Calculate service level metrics per tenant
 *
 * @param tenantId Tenant ID
 * @param routes All routes in period
 * @param dateRange Date range for metrics
 * @returns Service level metrics by SLA tier
 */
export function calculateServiceLevelMetrics(
  tenantId: string,
  routes: RouteData[],
  dateRange: TimeRange
): ServiceLevelMetrics {
  const allStops = routes.flatMap(r => r.stops);
  const deliverableStops = allStops.filter(s => s.status !== "returned" && s.status !== "cancelled");

  if (deliverableStops.length === 0) {
    return {
      tenantId,
      dateRange,
      totalDeliveries: 0,
      slaCompliance: { premium: 0, standard: 0, economy: 0, overall: 0 },
      firstAttemptRate: 0,
      returnRate: 0,
      failureRate: 0,
    };
  }

  // SLA compliance by tier
  const tiers = ["premium", "standard", "economy"] as const;
  const slaCompliance: Record<string, number> = {};

  for (const tier of tiers) {
    const tierStops = deliverableStops.filter(s => s.slaTier === tier);
    if (tierStops.length === 0) {
      slaCompliance[tier] = 0;
      continue;
    }

    const slaWindow = SLA_TIERS[tier as keyof typeof SLA_TIERS].window;
    const onTimeStops = tierStops.filter(stop => {
      if (!stop.actualArrival) return false;
      const diffMs = stop.actualArrival.getTime() - stop.estimatedArrival.getTime();
      const diffMinutes = diffMs / (60 * 1000);
      return diffMinutes <= slaWindow;
    }).length;

    slaCompliance[tier] = (onTimeStops / tierStops.length) * 100;
  }

  // Overall SLA
  const slaOverall = calculateOnTimePercentage(routes, dateRange);

  // First attempt rate
  const firstAttemptStops = deliverableStops.filter(s => s.firstAttempt === true).length;
  const firstAttemptRate = (firstAttemptStops / deliverableStops.length) * 100;

  // Return rate
  const returnedStops = allStops.filter(s => s.status === "returned").length;
  const returnRate = (returnedStops / allStops.length) * 100;

  // Failure rate
  const failedStops = allStops.filter(s => s.status === "failed").length;
  const failureRate = (failedStops / allStops.length) * 100;

  return {
    tenantId,
    dateRange,
    totalDeliveries: allStops.length,
    slaCompliance: {
      premium: Math.round(slaCompliance.premium * 100) / 100,
      standard: Math.round(slaCompliance.standard * 100) / 100,
      economy: Math.round(slaCompliance.economy * 100) / 100,
      overall: Math.round(slaOverall * 100) / 100,
    },
    firstAttemptRate: Math.round(firstAttemptRate * 100) / 100,
    returnRate: Math.round(returnRate * 100) / 100,
    failureRate: Math.round(failureRate * 100) / 100,
  };
}

/**
 * Calculate route efficiency metrics
 *
 * @param route Route data
 * @returns Route efficiency metrics
 */
export function calculateRouteEfficiency(route: RouteData): RouteEfficiency {
  const actualDistance = route.actualDistance || route.plannedDistance;
  const actualDuration = route.actualDuration || route.plannedDuration;

  const routeDeviation =
    route.plannedDistance > 0
      ? ((actualDistance - route.plannedDistance) / route.plannedDistance) * 100
      : 0;

  // Calculate idle time (time between stops)
  const stops = route.stops
    .filter(s => s.actualArrival && s.actualDuration !== undefined)
    .sort((a, b) => a.estimatedArrival.getTime() - b.estimatedArrival.getTime());

  let idleTime = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const currentStop = stops[i];
    const nextStop = stops[i + 1];

    if (currentStop.actualArrival && currentStop.actualDuration && nextStop.actualArrival) {
      const currentEnd = new Date(
        currentStop.actualArrival.getTime() + (currentStop.actualDuration * 60 * 1000)
      );
      const idleMs = nextStop.actualArrival.getTime() - currentEnd.getTime();
      if (idleMs > 0) {
        idleTime += idleMs / (60 * 1000); // convert to minutes
      }
    }
  }

  const idlePercentage = actualDuration > 0 ? (idleTime / actualDuration) * 100 : 0;

  // Deviation events (simplified: count stops outside planned sequence)
  const deviationEvents = 0; // TODO: compare actual coordinates to planned waypoints

  // Efficiency rating
  let efficiencyRating: "excellent" | "good" | "fair" | "poor";
  if (routeDeviation <= 5 && idlePercentage <= 10) {
    efficiencyRating = "excellent";
  } else if (routeDeviation <= 10 && idlePercentage <= 20) {
    efficiencyRating = "good";
  } else if (routeDeviation <= 20 && idlePercentage <= 30) {
    efficiencyRating = "fair";
  } else {
    efficiencyRating = "poor";
  }

  return {
    routeId: route.id,
    plannedDistance: route.plannedDistance,
    actualDistance: Math.round(actualDistance * 100) / 100,
    routeDeviation: Math.round(routeDeviation * 100) / 100,
    idleTime: Math.round(idleTime * 100) / 100,
    idlePercentage: Math.round(idlePercentage * 100) / 100,
    deviationEvents,
    efficiencyRating,
  };
}
