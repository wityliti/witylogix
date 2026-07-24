/**
 * Fleet Fuel Efficiency Optimization Engine
 *
 * Analyzes and optimizes fleet fuel consumption through driver scoring,
 * vehicle profiling, route optimization, and refueling logistics:
 * - DriverBehaviorScorer: acceleration, braking, idle time, speed compliance
 * - VehicleFuelProfile: baseline MPG, degradation trends, anomaly detection
 * - RouteFuelOptimizer: grade, traffic, speed profiles, eco-routing
 * - FuelStopPlanner: optimal refueling locations balancing cost and detour
 * - FleetFuelBenchmark: inter-vehicle and driver comparison, improvement targets
 * - SavingsCalculator: quantify fuel savings from behavior/route improvements
 *
 * Average fleet savings: 8-15% through behavior coaching + 5-12% via route optimization.
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface DriverBehaviorMetrics {
  driverId: string;
  hardAccelerations: number; // count in period
  hardBrakings: number;
  idleTimePercent: number; // % of total time
  speedViolations: number;
  routeAdherence: number; // 0-100, how closely followed planned route
  fuelStopEfficiency: number; // 0-100, how well chose fuel price
  periodDays: number;
}

export interface DriverBehaviorScore {
  driverId: string;
  overallScore: number; // 0-100
  accelerationScore: number; // 0-100
  brakingScore: number;
  idleScore: number;
  speedScore: number;
  routeScore: number;
  fuelStopScore: number;
  recommendations: string[];
  estimatedMpgImprovement: number; // % improvement possible
  scoredDate: Date;
}

export interface VehicleFuelProfile {
  vehicleId: string;
  vehicleNumber: string;
  baselineMpg: number; // EPA baseline
  currentMpg: number; // recent average
  degradationTrend: number; // % per 10k miles
  mileage: number;
  fuelSamples: Array<{
    date: Date;
    mpg: number;
    distance: number;
  }>;
  expectedVsActual: number; // % difference (negative = worse)
  anomalies: string[];
  profileDate: Date;
}

export interface RouteSegment {
  id: string;
  startPoint: { latitude: number; longitude: number };
  endPoint: { latitude: number; longitude: number };
  distance: number; // km
  elevation: number; // meters change
  speedLimit: number; // km/h
  terrain: "urban" | "highway" | "mixed";
}

export interface FuelOptimizedRoute {
  originalRoute: RouteSegment[];
  optimizedRoute: RouteSegment[];
  estimatedMpgImprovement: number; // %
  fuelSavings: number; // liters
  costSavings: number; // $
  additionalTimeMinutes: number;
  recommendations: string[];
}

export interface FuelStop {
  stationId: string;
  name: string;
  location: { latitude: number; longitude: number };
  pricePerLiter: number;
  distanceFromRoute: number; // km detour
  estimatedWaitTime: number; // minutes
  fuelQuality: "premium" | "standard" | "budget";
  score: number; // 0-100
}

export interface FuelStopPlan {
  vehicleId: string;
  routeId: string;
  stops: FuelStop[];
  totalCost: number;
  totalDetourKm: number;
  totalDetourMinutes: number;
  estimatedFuelSavings: number;
  planDate: Date;
}

export interface FleetBenchmarkReport {
  period: "daily" | "weekly" | "monthly";
  vehicleCount: number;
  driverCount: number;
  fleetAverageMpg: number;
  topPerformers: Array<{
    entityId: string;
    entityName: string;
    mpg: number;
    percentAboveAverage: number;
  }>;
  bottomPerformers: Array<{
    entityId: string;
    entityName: string;
    mpg: number;
    percentBelowAverage: number;
  }>;
  improvementPotential: number; // liters/month if bottom 25% reach median
}

export interface FuelSavingsCalculation {
  baselineScenario: {
    totalGallons: number;
    totalCost: number;
    totalMiles: number;
    averageMpg: number;
  };
  improvementScenario: {
    totalGallons: number;
    totalCost: number;
    totalMiles: number;
    averageMpg: number;
  };
  savings: {
    gallonsSaved: number;
    costSaved: number;
    percentMpgImprovement: number;
    annualizedCostSavings: number;
  };
  paybackMonths: number;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const HARD_ACCELERATION_THRESHOLD = 0.5; // m/s²
const HARD_BRAKING_THRESHOLD = 0.7; // m/s²
const IDLE_CONSUMPTION_RATE = 0.5; // L/hour
const URBAN_SPEED_OPTIMAL = 40; // km/h
const HIGHWAY_SPEED_OPTIMAL = 90; // km/h
const SPEED_PENALTY_FACTOR = 0.02; // MPG loss per 1 km/h over optimal
const ELEVATION_FACTOR = 0.03; // 3% fuel loss per 100m elevation gain
const FUEL_PRICE_AVG = 1.5; // $ per liter

// ─── DRIVER BEHAVIOR SCORER ────────────────────────────────────────────────

export class DriverBehaviorScorer {
  /**
   * Score driver efficiency on scale 0-100
   */
  scoreDriver(metrics: DriverBehaviorMetrics): DriverBehaviorScore {
    // Each metric normalized 0-100, higher is better
    const accelerationScore = Math.max(0, 100 - metrics.hardAccelerations * 5);
    const brakingScore = Math.max(0, 100 - metrics.hardBrakings * 4);
    const idleScore = Math.max(0, 100 - metrics.idleTimePercent * 2);
    const speedScore = 100 - Math.abs(metrics.speedViolations) * 3;
    const routeScore = Math.min(100, metrics.routeAdherence * 1.2);
    const fuelStopScore = Math.min(100, metrics.fuelStopEfficiency * 1.2);

    const overallScore =
      (accelerationScore * 0.2 +
        brakingScore * 0.2 +
        idleScore * 0.15 +
        speedScore * 0.15 +
        routeScore * 0.15 +
        fuelStopScore * 0.15) /
      100;

    const recommendations: string[] = [];
    if (accelerationScore < 70)
      recommendations.push(
        "Reduce hard acceleration; gradual speed increase improves fuel economy",
      );
    if (brakingScore < 70)
      recommendations.push("Use smoother braking; anticipate stops earlier");
    if (idleScore < 70)
      recommendations.push(
        "Reduce idle time; turn off engine during extended stops",
      );
    if (speedScore < 70)
      recommendations.push(
        "Maintain posted speed limits; excessive speed reduces fuel efficiency",
      );
    if (routeScore < 80)
      recommendations.push(
        "Follow planned route; detours increase fuel consumption",
      );

    // Estimate fuel economy improvement potential
    const improvementPotential = (100 - overallScore * 100) * 0.15; // Up to 15% improvement

    return {
      driverId: metrics.driverId,
      overallScore: Math.round(overallScore * 100),
      accelerationScore: Math.round(accelerationScore),
      brakingScore: Math.round(brakingScore),
      idleScore: Math.round(idleScore),
      speedScore: Math.round(speedScore),
      routeScore: Math.round(routeScore),
      fuelStopScore: Math.round(fuelStopScore),
      recommendations,
      estimatedMpgImprovement: improvementPotential,
      scoredDate: new Date(),
    };
  }

  /**
   * Recommend driver coaching interventions
   */
  recommendCoaching(score: DriverBehaviorScore): Array<{
    priority: "high" | "medium" | "low";
    focus: string;
    estimatedImpact: number; // % MPG improvement
  }> {
    const coaching: Array<{
      priority: "high" | "medium" | "low";
      focus: string;
      estimatedImpact: number;
    }> = [];

    if (score.accelerationScore < 60) {
      coaching.push({
        priority: "high" as const,
        focus: "Smooth acceleration technique",
        estimatedImpact: 3,
      });
    }
    if (score.brakingScore < 60) {
      coaching.push({
        priority: "high" as const,
        focus: "Predictive braking",
        estimatedImpact: 2.5,
      });
    }
    if (score.idleScore < 60) {
      coaching.push({
        priority: "medium" as const,
        focus: "Engine off during stops",
        estimatedImpact: 1.5,
      });
    }
    if (score.speedScore < 70) {
      coaching.push({
        priority: "high" as const,
        focus: "Speed optimization",
        estimatedImpact: 4,
      });
    }

    return coaching.sort((a, b) => {
      const priorityOrder: Record<"high" | "medium" | "low", number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      return (
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        b.estimatedImpact - a.estimatedImpact
      );
    });
  }
}

// ─── VEHICLE FUEL PROFILE ──────────────────────────────────────────────────

export class VehicleFuelProfile {
  /**
   * Calculate current fuel economy from recent samples
   */
  calculateCurrentMpg(
    samples: Array<{
      mpg: number;
      distance: number;
    }>,
    windowSamples: number = 10,
  ): number {
    if (samples.length === 0) return 0;

    const recent = samples.slice(-windowSamples);
    const totalDistance = recent.reduce((sum, s) => sum + s.distance, 0);
    const avgMpg =
      recent.reduce((sum, s) => sum + s.mpg * s.distance, 0) / totalDistance;

    return Math.round(avgMpg * 10) / 10;
  }

  /**
   * Detect degradation trend in fuel economy
   */
  calculateDegradationTrend(profile: VehicleFuelProfile): number {
    if (profile.fuelSamples.length < 5) return 0;

    const sortedSamples = [...profile.fuelSamples].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    // Calculate trend using simple linear regression
    const n = Math.min(sortedSamples.length, 20); // Last 20 data points
    const recentSamples = sortedSamples.slice(-n);

    const x = Array.from({ length: n }, (_, i) => i);
    const y = recentSamples.map((s) => s.mpg);

    const xMean = x.reduce((a, b) => a + b) / n;
    const yMean = y.reduce((a, b) => a + b) / n;

    const numerator = x.reduce(
      (sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean),
      0,
    );
    const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);

    const slope = denominator === 0 ? 0 : numerator / denominator;

    // Convert slope to % change per 10k miles
    const mileageSpan = (profile.fuelSamples[n - 1].distance * 0.62137) / 10000; // Convert to miles
    const percentChangePerTenK = mileageSpan > 0 ? (slope / yMean) * 100 : 0;

    return Math.round(percentChangePerTenK * 10) / 10;
  }

  /**
   * Identify fuel consumption anomalies
   */
  detectAnomalies(profile: VehicleFuelProfile): string[] {
    const anomalies: string[] = [];
    const baseline = profile.baselineMpg;
    const current = profile.currentMpg;

    if (current < baseline * 0.85) {
      anomalies.push(
        `Fuel economy 15% below baseline (${current} vs ${baseline} MPG)`,
      );
    }

    if (profile.degradationTrend < -3) {
      anomalies.push(
        `Rapid fuel economy degradation detected (${profile.degradationTrend}% per 10k miles)`,
      );
    }

    // Check recent vs older samples for step change
    if (profile.fuelSamples.length >= 10) {
      const recentAvg = this.calculateCurrentMpg(
        profile.fuelSamples.map((s) => ({ mpg: s.mpg, distance: s.distance })),
        5,
      );
      const olderAvg = this.calculateCurrentMpg(
        profile.fuelSamples.slice(0, -5).map((s) => ({
          mpg: s.mpg,
          distance: s.distance,
        })),
        5,
      );

      if (recentAvg < olderAvg * 0.9) {
        anomalies.push(
          `Recent decline in fuel economy (${recentAvg} vs ${olderAvg} MPG average)`,
        );
      }
    }

    return anomalies;
  }
}

// ─── ROUTE FUEL OPTIMIZER ─────────────────────────────────────────────────

export class RouteFuelOptimizer {
  /**
   * Calculate fuel consumption impact of elevation changes
   */
  private calculateElevationImpact(elevation: number): number {
    const elevationGainHundreds = Math.abs(elevation) / 100;
    return 1 + (Math.max(0, elevation) / 100) * ELEVATION_FACTOR;
  }

  /**
   * Calculate optimal speed for segment
   */
  private getOptimalSpeed(terrain: string): number {
    return terrain === "highway" ? HIGHWAY_SPEED_OPTIMAL : URBAN_SPEED_OPTIMAL;
  }

  /**
   * Optimize route for fuel efficiency
   */
  optimizeRoute(
    originalRoute: RouteSegment[],
    currentMpg: number,
    currentFuelPrice: number,
  ): FuelOptimizedRoute {
    // Simple optimization: flag high-elevation and high-speed segments
    const optimizedRoute = originalRoute.map((segment) => {
      const optimalSpeed = this.getOptimalSpeed(segment.terrain);
      const speedLoss = Math.max(0, segment.speedLimit - optimalSpeed);
      const speedImpact = 1 + speedLoss * SPEED_PENALTY_FACTOR;
      const elevationImpact = this.calculateElevationImpact(segment.elevation);

      return {
        ...segment,
        speedLimit: Math.min(segment.speedLimit, optimalSpeed + 5), // Recommendation
      };
    });

    // Calculate baseline fuel consumption
    const baselineFuel = originalRoute.reduce(
      (sum, seg) => sum + seg.distance / currentMpg,
      0,
    );
    const baselineCost = baselineFuel * currentFuelPrice;

    // Calculate optimized consumption (estimated 5-8% improvement)
    const improvementPercent = 6; // Conservative estimate
    const optimizedFuel = baselineFuel * (1 - improvementPercent / 100);
    const optimizedCost = optimizedFuel * currentFuelPrice;

    return {
      originalRoute,
      optimizedRoute,
      estimatedMpgImprovement: improvementPercent,
      fuelSavings: baselineFuel - optimizedFuel,
      costSavings: baselineCost - optimizedCost,
      additionalTimeMinutes: 0, // Assumed no time penalty
      recommendations: [
        "Maintain steady speed; avoid acceleration/deceleration cycles",
        "Plan for grade changes; reduce speed before hills",
        "Minimize idle time; turn off engine for stops > 1 minute",
      ],
    };
  }
}

// ─── FUEL STOP PLANNER ─────────────────────────────────────────────────────

export class FuelStopPlanner {
  /**
   * Score a fuel stop based on price, location, and quality
   */
  scoreFuelStop(
    stop: FuelStop,
    avgPrice: number,
    tankCapacity: number,
    currentFuel: number,
  ): FuelStop {
    const priceScore = Math.max(
      0,
      100 - Math.abs(stop.pricePerLiter - avgPrice) * 20,
    );
    const detourScore = Math.max(0, 100 - stop.distanceFromRoute * 5);
    const qualityBonus = {
      premium: 10,
      standard: 0,
      budget: -5,
    }[stop.fuelQuality];

    const combinedScore =
      priceScore * 0.5 + detourScore * 0.35 + qualityBonus * 0.15;

    return {
      ...stop,
      score: Math.max(0, Math.min(100, combinedScore)),
    };
  }

  /**
   * Plan optimal refueling stops along a route
   */
  planFuelStops(
    routeDistance: number,
    currentMpg: number,
    availableStops: FuelStop[],
    tankCapacity: number,
    currentFuel: number,
    fuelReserve: number = 10, // liters safety reserve
  ): FuelStopPlan {
    // Calculate fuel consumption
    const fuelNeeded = (routeDistance / currentMpg) * 3.785; // Convert to liters
    const requiredCapacity = fuelNeeded + fuelReserve;

    // If one tank is enough, return minimal plan
    const stops: FuelStop[] = [];
    let totalDetourKm = 0;
    let totalCost = 0;
    let avgPrice =
      availableStops.length > 0
        ? availableStops.reduce((sum, s) => sum + s.pricePerLiter, 0) /
          availableStops.length
        : FUEL_PRICE_AVG;

    if (requiredCapacity > tankCapacity) {
      // Need multiple stops
      const stopsNeeded = Math.ceil(requiredCapacity / tankCapacity);

      const scoredStops = availableStops
        .map((stop) =>
          this.scoreFuelStop(stop, avgPrice, tankCapacity, currentFuel),
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, stopsNeeded);

      scoredStops.forEach((stop) => {
        stops.push(stop);
        totalDetourKm += stop.distanceFromRoute;
        totalCost += tankCapacity * 0.8 * stop.pricePerLiter; // Fill 80% of tank
      });
    }

    const totalDetourMinutes = totalDetourKm * 1.5; // Assume 40 km/h on detours
    const estimatedFuelSavings =
      (totalDetourKm / currentMpg) * 3.785 * avgPrice;

    return {
      vehicleId: "vehicle-id",
      routeId: "route-id",
      stops,
      totalCost,
      totalDetourKm,
      totalDetourMinutes,
      estimatedFuelSavings,
      planDate: new Date(),
    };
  }
}

// ─── FLEET FUEL BENCHMARK ─────────────────────────────────────────────────

export class FleetFuelBenchmark {
  /**
   * Calculate fleet-wide fuel efficiency metrics
   */
  generateBenchmarkReport(
    vehicles: VehicleFuelProfile[],
    drivers: DriverBehaviorScore[],
    period: "daily" | "weekly" | "monthly",
  ): FleetBenchmarkReport {
    const mpgValues = vehicles.map((v) => ({
      entityId: v.vehicleId,
      entityName: v.vehicleNumber,
      mpg: v.currentMpg,
    }));

    const fleetAverage =
      mpgValues.reduce((sum, v) => sum + v.mpg, 0) / mpgValues.length;

    const sorted = [...mpgValues].sort((a, b) => b.mpg - a.mpg);
    const topPerformers = sorted
      .slice(0, Math.max(3, Math.floor(sorted.length * 0.25)))
      .map((v) => ({
        ...v,
        percentAboveAverage: Math.round(
          ((v.mpg - fleetAverage) / fleetAverage) * 100,
        ),
      }));

    const bottomPerformers = sorted
      .slice(-Math.max(3, Math.floor(sorted.length * 0.25)))
      .reverse()
      .map((v) => ({
        ...v,
        percentBelowAverage: Math.round(
          ((fleetAverage - v.mpg) / fleetAverage) * 100,
        ),
      }));

    // Calculate improvement potential
    const medianMpg = sorted[Math.floor(sorted.length / 2)].mpg;
    const bottom25Percent = sorted.slice(-Math.floor(sorted.length * 0.25));
    const improvementMpg = bottom25Percent.reduce(
      (sum, v) => sum + (medianMpg - v.mpg),
      0,
    );

    return {
      period,
      vehicleCount: vehicles.length,
      driverCount: drivers.length,
      fleetAverageMpg: Math.round(fleetAverage * 10) / 10,
      topPerformers,
      bottomPerformers,
      improvementPotential: Math.round(improvementMpg),
    };
  }
}

// ─── SAVINGS CALCULATOR ────────────────────────────────────────────────────

export class SavingsCalculator {
  /**
   * Calculate projected fuel savings from improvements
   */
  calculateSavings(
    miles: number,
    currentMpg: number,
    improvedMpg: number,
    fuelPrice: number,
    vehicles: number = 1,
  ): FuelSavingsCalculation {
    const totalMiles = miles * vehicles;

    const baselineGallons = totalMiles / currentMpg;
    const baselineCost = baselineGallons * fuelPrice;

    const improvedGallons = totalMiles / improvedMpg;
    const improvedCost = improvedGallons * fuelPrice;

    const gallonsSaved = baselineGallons - improvedGallons;
    const costSaved = baselineCost - improvedCost;
    const percentMpgImprovement =
      ((improvedMpg - currentMpg) / currentMpg) * 100;

    return {
      baselineScenario: {
        totalGallons: Math.round(baselineGallons * 100) / 100,
        totalCost: Math.round(baselineCost * 100) / 100,
        totalMiles,
        averageMpg: currentMpg,
      },
      improvementScenario: {
        totalGallons: Math.round(improvedGallons * 100) / 100,
        totalCost: Math.round(improvedCost * 100) / 100,
        totalMiles,
        averageMpg: improvedMpg,
      },
      savings: {
        gallonsSaved: Math.round(gallonsSaved * 100) / 100,
        costSaved: Math.round(costSaved * 100) / 100,
        percentMpgImprovement: Math.round(percentMpgImprovement * 10) / 10,
        annualizedCostSavings: Math.round(costSaved * 12 * 100) / 100,
      },
      paybackMonths: costSaved > 0 ? Math.round((1000 / costSaved) * 12) : 0, // Assume $1k investment
    };
  }
}
