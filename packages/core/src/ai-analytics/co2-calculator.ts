/**
 * CO2 Emissions Calculator
 *
 * Calculates CO2 emissions for routes based on:
 * - Vehicle profile (van, truck, bike, EV)
 * - Driving distance and duration
 * - Idling time
 * - Terrain and weather adjustments
 *
 * Calculates savings from optimized routing and tracks trends.
 */

import type { CO2Report, CO2Summary, VehicleProfile } from "./types.js";

/**
 * Vehicle emissions profiles (g CO2 per km)
 */
const VEHICLE_PROFILES: Record<
  "van" | "truck" | "bike" | "ev",
  VehicleProfile
> = {
  van: {
    type: "van",
    baseEmissionsFactor: 250,
    idlingEmissions: 2.5, // kg per hour
  },
  truck: {
    type: "truck",
    baseEmissionsFactor: 350,
    idlingEmissions: 4.0,
  },
  bike: {
    type: "bike",
    baseEmissionsFactor: 0,
    idlingEmissions: 0,
  },
  ev: {
    type: "ev",
    baseEmissionsFactor: 50, // Grid average
    idlingEmissions: 0,
  },
};

/**
 * Terrain adjustment factors
 */
const TERRAIN_ADJUSTMENTS: Record<string, number> = {
  city: 1.2, // +20% due to congestion
  highway: 0.85, // -15% due to steady speed
  suburban: 1.0, // baseline
  rural: 0.95, // -5% due to open roads
};

/**
 * CO2 history for trend tracking
 */
interface CO2HistoryEntry {
  date: string;
  co2: number;
  saved: number;
  routeCount: number;
}

const co2History: Map<string, CO2HistoryEntry[]> = new Map();

/**
 * Get vehicle profile
 */
function getVehicleProfile(
  type: "van" | "truck" | "bike" | "ev",
): VehicleProfile {
  return VEHICLE_PROFILES[type];
}

/**
 * Calculate driving emissions
 */
function calculateDrivingEmissions(
  distanceMeters: number,
  profile: VehicleProfile,
  terrainType: string = "suburban",
): number {
  const distanceKm = distanceMeters / 1000;
  const terrainFactor = TERRAIN_ADJUSTMENTS[terrainType] ?? 1.0;

  // g CO2 converted to kg
  const emissions =
    (distanceKm * profile.baseEmissionsFactor * terrainFactor) / 1000;

  return emissions;
}

/**
 * Calculate idling emissions
 */
function calculateIdlingEmissions(
  idleTimeMinutes: number,
  profile: VehicleProfile,
): number {
  const idleTimeHours = idleTimeMinutes / 60;
  return idleTimeHours * profile.idlingEmissions;
}

/**
 * Estimate planned route distance (typically 10-15% longer)
 */
function estimatePlannedDistance(
  actualDistanceMeters: number,
  optimizationLevel: number = 0.9,
): number {
  // Less optimized routing = longer distance
  // 0.9 means route is 90% optimized, so ~10% longer than actual
  return actualDistanceMeters / optimizationLevel;
}

/**
 * Record CO2 emissions for trend tracking
 */
export function recordCO2(
  tenantId: string,
  date: string,
  co2: number,
  saved: number,
): void {
  if (!co2History.has(tenantId)) {
    co2History.set(tenantId, []);
  }

  const history = co2History.get(tenantId)!;
  const existing = history.find((e) => e.date === date);

  if (existing) {
    existing.co2 += co2;
    existing.saved += saved;
    existing.routeCount++;
  } else {
    history.push({
      date,
      co2,
      saved,
      routeCount: 1,
    });
  }

  // Keep last 365 days
  if (history.length > 365) {
    history.shift();
  }
}

/**
 * Calculate CO2 report for a route
 *
 * @param routeId - Route identifier
 * @param distance - Actual distance driven in meters
 * @param duration - Route duration in minutes
 * @param idleTime - Idle time in minutes
 * @param vehicleType - Vehicle type (van, truck, bike, ev)
 * @param terrainType - Terrain type (city, highway, suburban, rural)
 * @returns CO2Report with emissions breakdown and efficiency
 */
export function calculateCO2(
  routeId: string,
  distance: number,
  duration: number,
  idleTime: number,
  vehicleType: "van" | "truck" | "bike" | "ev" = "van",
  terrainType: string = "suburban",
): CO2Report {
  const profile = getVehicleProfile(vehicleType);

  // Calculate actual emissions
  const drivingEmissions = calculateDrivingEmissions(
    distance,
    profile,
    terrainType,
  );
  const idlingEmissions = calculateIdlingEmissions(idleTime, profile);
  const actualCO2 = drivingEmissions + idlingEmissions;

  // Estimate planned route (less optimized)
  const plannedDistance = estimatePlannedDistance(distance, 0.88);
  const plannedCO2 =
    calculateDrivingEmissions(plannedDistance, profile, terrainType) +
    idlingEmissions;

  const savedCO2 = Math.max(0, plannedCO2 - actualCO2);
  const savingsPercent =
    plannedCO2 > 0 ? Math.round((savedCO2 / plannedCO2) * 100) : 0;

  // Efficiency: kg CO2 per km
  const efficiency = (actualCO2 / (distance / 1000)) * 1000; // g/km

  // Record for trends
  const today = new Date().toISOString().split("T")[0];
  recordCO2("default-tenant", today, actualCO2, savedCO2);

  return {
    routeId,
    plannedCO2,
    actualCO2,
    savedCO2,
    savingsPercent,
    breakdown: {
      drivingEmissions,
      idlingEmissions,
    },
    vehicleProfile: profile,
    distance,
    duration,
    idleTime,
    efficiency: Math.round(efficiency * 100) / 100,
    periodStart: Date.now() - duration * 60 * 1000,
    periodEnd: Date.now(),
  };
}

/**
 * Calculate CO2 for multiple routes
 */
export function calculateCO2Batch(
  routes: Array<{
    routeId: string;
    distance: number;
    duration: number;
    idleTime: number;
    vehicleType: "van" | "truck" | "bike" | "ev";
    terrainType?: string;
  }>,
): Array<CO2Report> {
  return routes.map((route) =>
    calculateCO2(
      route.routeId,
      route.distance,
      route.duration,
      route.idleTime,
      route.vehicleType,
      route.terrainType,
    ),
  );
}

/**
 * Get tenant-wide CO2 summary
 *
 * @param tenantId - Tenant identifier
 * @param startDate - Start date (ISO format)
 * @param endDate - End date (ISO format)
 * @returns CO2Summary with aggregated metrics and trends
 */
export function getCO2Summary(
  tenantId: string,
  startDate: string,
  endDate: string,
): CO2Summary {
  const history = co2History.get(tenantId) ?? [];

  // Filter by date range
  const periodData = history.filter(
    (h) => h.date >= startDate && h.date <= endDate,
  );

  if (periodData.length === 0) {
    return {
      tenantId,
      period: {
        start: new Date(startDate).getTime(),
        end: new Date(endDate).getTime(),
      },
      totalPlannedCO2: 0,
      totalActualCO2: 0,
      totalSavedCO2: 0,
      averageSavingsPercent: 0,
      vehicleBreakdown: [],
      trend: [],
    };
  }

  const totalActualCO2 = periodData.reduce((sum, d) => sum + d.co2, 0);
  const totalSavedCO2 = periodData.reduce((sum, d) => sum + d.saved, 0);
  const totalPlannedCO2 = totalActualCO2 + totalSavedCO2;
  const averageSavingsPercent =
    totalPlannedCO2 > 0
      ? Math.round((totalSavedCO2 / totalPlannedCO2) * 100)
      : 0;

  // Build trend
  const trend = periodData.map((d) => ({
    date: d.date,
    co2: Math.round(d.co2),
    saved: Math.round(d.saved),
  }));

  // Vehicle breakdown (mock - in production would come from database)
  const vehicleBreakdown = [
    {
      type: "van" as const,
      count: Math.floor(
        periodData.reduce((sum, d) => sum + d.routeCount, 0) * 0.6,
      ),
      totalCO2: Math.round(totalActualCO2 * 0.6),
    },
    {
      type: "truck" as const,
      count: Math.floor(
        periodData.reduce((sum, d) => sum + d.routeCount, 0) * 0.3,
      ),
      totalCO2: Math.round(totalActualCO2 * 0.3),
    },
    {
      type: "bike" as const,
      count: Math.floor(
        periodData.reduce((sum, d) => sum + d.routeCount, 0) * 0.08,
      ),
      totalCO2: 0,
    },
    {
      type: "ev" as const,
      count: Math.floor(
        periodData.reduce((sum, d) => sum + d.routeCount, 0) * 0.02,
      ),
      totalCO2: Math.round(totalActualCO2 * 0.02),
    },
  ];

  return {
    tenantId,
    period: {
      start: new Date(startDate).getTime(),
      end: new Date(endDate).getTime(),
    },
    totalPlannedCO2: Math.round(totalPlannedCO2),
    totalActualCO2: Math.round(totalActualCO2),
    totalSavedCO2: Math.round(totalSavedCO2),
    averageSavingsPercent,
    vehicleBreakdown,
    trend,
  };
}

/**
 * Compare two routes and calculate relative savings
 */
export function compareCO2(
  optimizedRoute: {
    distance: number;
    duration: number;
    idleTime: number;
  },
  unoptimizedRoute: {
    distance: number;
    duration: number;
    idleTime: number;
  },
  vehicleType: "van" | "truck" | "bike" | "ev" = "van",
): {
  savingsKg: number;
  savingsPercent: number;
  distanceSaved: number;
  timeSaved: number;
} {
  const profile = getVehicleProfile(vehicleType);

  const optimizedEmissions =
    calculateDrivingEmissions(optimizedRoute.distance, profile) +
    calculateIdlingEmissions(optimizedRoute.idleTime, profile);

  const unoptimizedEmissions =
    calculateDrivingEmissions(unoptimizedRoute.distance, profile) +
    calculateIdlingEmissions(unoptimizedRoute.idleTime, profile);

  const savingsKg = unoptimizedEmissions - optimizedEmissions;
  const savingsPercent =
    unoptimizedEmissions > 0
      ? Math.round((savingsKg / unoptimizedEmissions) * 100)
      : 0;

  return {
    savingsKg: Math.round(savingsKg * 100) / 100,
    savingsPercent,
    distanceSaved: unoptimizedRoute.distance - optimizedRoute.distance,
    timeSaved: unoptimizedRoute.duration - optimizedRoute.duration,
  };
}
