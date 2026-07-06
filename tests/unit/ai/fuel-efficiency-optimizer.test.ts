/**
 * Fuel Efficiency Optimizer Unit Tests
 * Test driver scoring, vehicle profiling, route optimization, fuel stop planning,
 * benchmarking, and savings calculation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DriverBehaviorScorer,
  VehicleFuelProfile,
  RouteFuelOptimizer,
  FuelStopPlanner,
  FleetFuelBenchmark,
  SavingsCalculator,
  type DriverBehaviorMetrics,
  type VehicleFuelProfile as FuelProfileType,
  type RouteSegment,
  type FuelStop,
} from "../../../packages/core/src/ai/fuel-efficiency-optimizer.js";

// ─── TEST DATA ──────────────────────────────────────────────────────────────

const createMockDriverMetrics = (
  overrides?: Partial<DriverBehaviorMetrics>,
): DriverBehaviorMetrics => ({
  driverId: "drv-001",
  hardAccelerations: 5,
  hardBrakings: 8,
  idleTimePercent: 8,
  speedViolations: 2,
  routeAdherence: 95,
  fuelStopEfficiency: 80,
  periodDays: 7,
  ...overrides,
});

const createMockVehicleProfile = (
  overrides?: Partial<FuelProfileType>,
): FuelProfileType => ({
  vehicleId: "veh-001",
  vehicleNumber: "VH-001",
  baselineMpg: 22,
  currentMpg: 20,
  degradationTrend: -0.5,
  mileage: 45000,
  fuelSamples: [
    {
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      mpg: 20.5,
      distance: 250,
    },
    {
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      mpg: 20.2,
      distance: 245,
    },
    {
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      mpg: 19.8,
      distance: 240,
    },
  ],
  expectedVsActual: -9,
  anomalies: [],
  profileDate: new Date(),
  ...overrides,
});

const createMockRouteSegment = (
  overrides?: Partial<RouteSegment>,
): RouteSegment => ({
  id: "seg-001",
  startPoint: { latitude: 40.7128, longitude: -74.006 },
  endPoint: { latitude: 40.7548, longitude: -73.9776 },
  distance: 5,
  elevation: 50,
  speedLimit: 35,
  terrain: "urban",
  ...overrides,
});

const createMockFuelStop = (overrides?: Partial<FuelStop>): FuelStop => ({
  stationId: "fs-001",
  name: "Shell Station",
  location: { latitude: 40.758, longitude: -73.985 },
  pricePerLiter: 1.45,
  distanceFromRoute: 2,
  estimatedWaitTime: 8,
  fuelQuality: "standard",
  score: 0,
  ...overrides,
});

// ─── DRIVER BEHAVIOR SCORER TESTS ───────────────────────────────────────────

describe("DriverBehaviorScorer", () => {
  let scorer: DriverBehaviorScorer;

  beforeEach(() => {
    scorer = new DriverBehaviorScorer();
  });

  it("should score excellent driver high", () => {
    const metrics = createMockDriverMetrics({
      hardAccelerations: 1,
      hardBrakings: 2,
      idleTimePercent: 2,
      speedViolations: 0,
      routeAdherence: 99,
      fuelStopEfficiency: 95,
    });

    const score = scorer.scoreDriver(metrics);

    expect(score.overallScore).toBeGreaterThan(85);
    expect(score.recommendation).toBe("perfect");
  });

  it("should score poor driver low", () => {
    const metrics = createMockDriverMetrics({
      hardAccelerations: 15,
      hardBrakings: 20,
      idleTimePercent: 25,
      speedViolations: 10,
      routeAdherence: 60,
      fuelStopEfficiency: 40,
    });

    const score = scorer.scoreDriver(metrics);

    expect(score.overallScore).toBeLessThan(50);
    expect(score.recommendations.length).toBeGreaterThan(0);
  });

  it("should provide specific coaching recommendations", () => {
    const metrics = createMockDriverMetrics({
      hardAccelerations: 10,
      hardBrakings: 15,
    });

    const score = scorer.scoreDriver(metrics);
    const coaching = scorer.recommendCoaching(score);

    expect(coaching.length).toBeGreaterThan(0);
    expect(coaching[0].focus).toBeDefined();
    expect(coaching[0].estimatedImpact).toBeGreaterThan(0);
  });

  it("should estimate MPG improvement potential", () => {
    const goodMetrics = createMockDriverMetrics({
      hardAccelerations: 2,
      hardBrakings: 3,
      speedViolations: 0,
    });

    const poorMetrics = createMockDriverMetrics({
      hardAccelerations: 20,
      hardBrakings: 25,
      speedViolations: 15,
    });

    const goodScore = scorer.scoreDriver(goodMetrics);
    const poorScore = scorer.scoreDriver(poorMetrics);

    expect(poorScore.estimatedMpgImprovement).toBeGreaterThan(
      goodScore.estimatedMpgImprovement,
    );
  });

  it("should score all sub-metrics independently", () => {
    const metrics = createMockDriverMetrics();
    const score = scorer.scoreDriver(metrics);

    expect(score.accelerationScore).toBeGreaterThanOrEqual(0);
    expect(score.accelerationScore).toBeLessThanOrEqual(100);
    expect(score.brakingScore).toBeGreaterThanOrEqual(0);
    expect(score.brakingScore).toBeLessThanOrEqual(100);
    expect(score.idleScore).toBeGreaterThanOrEqual(0);
    expect(score.idleScore).toBeLessThanOrEqual(100);
    expect(score.speedScore).toBeGreaterThanOrEqual(0);
    expect(score.speedScore).toBeLessThanOrEqual(100);
  });
});

// ─── VEHICLE FUEL PROFILE TESTS ──────────────────────────────────────────────

describe("VehicleFuelProfile", () => {
  let profileCalc: VehicleFuelProfile;

  beforeEach(() => {
    profileCalc = new VehicleFuelProfile();
  });

  it("should calculate current MPG from recent samples", () => {
    const profile = createMockVehicleProfile();

    const mpg = profileCalc.calculateCurrentMpg(
      profile.fuelSamples.map((s) => ({ mpg: s.mpg, distance: s.distance })),
    );

    expect(mpg).toBeGreaterThan(0);
    expect(mpg).toBeLessThan(25);
  });

  it("should detect degradation trend", () => {
    const profile = createMockVehicleProfile({
      fuelSamples: [
        {
          date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          mpg: 22,
          distance: 300,
        },
        {
          date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          mpg: 21.5,
          distance: 300,
        },
        {
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          mpg: 21,
          distance: 300,
        },
        {
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          mpg: 20.5,
          distance: 300,
        },
        { date: new Date(), mpg: 20, distance: 300 },
      ],
    });

    const trend = profileCalc.calculateDegradationTrend(profile);

    expect(trend).toBeLessThan(0); // Negative trend
  });

  it("should detect fuel economy anomalies", () => {
    const profile = createMockVehicleProfile({
      currentMpg: 15,
      baselineMpg: 22,
    });

    const anomalies = profileCalc.detectAnomalies(profile);

    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0]).toContain("below baseline");
  });

  it("should not flag anomalies for normal vehicles", () => {
    const profile = createMockVehicleProfile({
      currentMpg: 21,
      baselineMpg: 22,
      degradationTrend: -0.2,
      anomalies: [],
    });

    const anomalies = profileCalc.detectAnomalies(profile);

    expect(anomalies.length).toBe(0);
  });
});

// ─── ROUTE FUEL OPTIMIZER TESTS ──────────────────────────────────────────────

describe("RouteFuelOptimizer", () => {
  let optimizer: RouteFuelOptimizer;

  beforeEach(() => {
    optimizer = new RouteFuelOptimizer();
  });

  it("should optimize route for fuel efficiency", () => {
    const route: RouteSegment[] = [
      createMockRouteSegment({ id: "seg-1", distance: 10, speedLimit: 55 }),
      createMockRouteSegment({
        id: "seg-2",
        distance: 15,
        speedLimit: 70,
        elevation: 200,
      }),
    ];

    const optimized = optimizer.optimizeRoute(route, 20, 1.5);

    expect(optimized.estimatedMpgImprovement).toBeGreaterThan(0);
    expect(optimized.fuelSavings).toBeGreaterThan(0);
    expect(optimized.costSavings).toBeGreaterThan(0);
    expect(optimized.recommendations.length).toBeGreaterThan(0);
  });

  it("should recommend reasonable MPG improvements (5-8%)", () => {
    const route: RouteSegment[] = [createMockRouteSegment({ distance: 50 })];

    const optimized = optimizer.optimizeRoute(route, 20, 1.5);

    expect(optimized.estimatedMpgImprovement).toBeGreaterThanOrEqual(5);
    expect(optimized.estimatedMpgImprovement).toBeLessThanOrEqual(8);
  });
});

// ─── FUEL STOP PLANNER TESTS ────────────────────────────────────────────────

describe("FuelStopPlanner", () => {
  let planner: FuelStopPlanner;

  beforeEach(() => {
    planner = new FuelStopPlanner();
  });

  it("should score fuel stops correctly", () => {
    const stop = createMockFuelStop();

    const scored = planner.scoreFuelStop(stop, 1.5, 60, 30);

    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(100);
  });

  it("should prefer cheaper fuel stops", () => {
    const cheap = createMockFuelStop({ pricePerLiter: 1.3 });
    const expensive = createMockFuelStop({ pricePerLiter: 1.7 });

    const cheapScored = planner.scoreFuelStop(cheap, 1.5, 60, 30);
    const expensiveScored = planner.scoreFuelStop(expensive, 1.5, 60, 30);

    expect(cheapScored.score).toBeGreaterThan(expensiveScored.score);
  });

  it("should prefer stops closer to route", () => {
    const closeStop = createMockFuelStop({ distanceFromRoute: 1 });
    const farStop = createMockFuelStop({ distanceFromRoute: 10 });

    const closeScored = planner.scoreFuelStop(closeStop, 1.5, 60, 30);
    const farScored = planner.scoreFuelStop(farStop, 1.5, 60, 30);

    expect(closeScored.score).toBeGreaterThan(farScored.score);
  });

  it("should plan stops when tank capacity exceeded", () => {
    const stops = [
      createMockFuelStop({ stationId: "fs-1", pricePerLiter: 1.4 }),
      createMockFuelStop({ stationId: "fs-2", pricePerLiter: 1.5 }),
      createMockFuelStop({ stationId: "fs-3", pricePerLiter: 1.35 }),
    ];

    const plan = planner.planFuelStops(500, 18, stops, 50, 10);

    expect(plan.planDate).toBeDefined();
    expect(plan.totalDetourKm).toBeGreaterThanOrEqual(0);
  });
});

// ─── FLEET FUEL BENCHMARK TESTS ──────────────────────────────────────────────

describe("FleetFuelBenchmark", () => {
  let benchmark: FleetFuelBenchmark;

  beforeEach(() => {
    benchmark = new FleetFuelBenchmark();
  });

  it("should generate fleet benchmark report", () => {
    const vehicles = [
      createMockVehicleProfile({ vehicleId: "v-1", currentMpg: 22 }),
      createMockVehicleProfile({ vehicleId: "v-2", currentMpg: 18 }),
      createMockVehicleProfile({ vehicleId: "v-3", currentMpg: 20 }),
      createMockVehicleProfile({ vehicleId: "v-4", currentMpg: 15 }),
    ];

    const drivers = [
      {
        driverId: "drv-1",
        overallScore: 85,
        accelerationScore: 80,
        brakingScore: 85,
        idleScore: 90,
        speedScore: 85,
        routeScore: 90,
        fuelStopScore: 80,
        recommendations: [],
        estimatedMpgImprovement: 3,
        scoredDate: new Date(),
      },
    ];

    const report = benchmark.generateBenchmarkReport(
      vehicles,
      drivers,
      "monthly",
    );

    expect(report.fleetAverageMpg).toBeGreaterThan(0);
    expect(report.topPerformers.length).toBeGreaterThan(0);
    expect(report.bottomPerformers.length).toBeGreaterThan(0);
    expect(report.improvementPotential).toBeGreaterThanOrEqual(0);
  });

  it("should identify top and bottom performers", () => {
    const vehicles = [
      createMockVehicleProfile({ vehicleNumber: "VH-001", currentMpg: 25 }),
      createMockVehicleProfile({ vehicleNumber: "VH-002", currentMpg: 12 }),
      createMockVehicleProfile({ vehicleNumber: "VH-003", currentMpg: 20 }),
    ];

    const drivers: any[] = [];
    const report = benchmark.generateBenchmarkReport(
      vehicles,
      drivers,
      "weekly",
    );

    const topMpg = report.topPerformers[0]?.mpg || 0;
    const bottomMpg = report.bottomPerformers[0]?.mpg || 0;

    expect(topMpg).toBeGreaterThanOrEqual(bottomMpg);
  });
});

// ─── SAVINGS CALCULATOR TESTS ───────────────────────────────────────────────

describe("SavingsCalculator", () => {
  let calculator: SavingsCalculator;

  beforeEach(() => {
    calculator = new SavingsCalculator();
  });

  it("should calculate fuel savings from MPG improvement", () => {
    const savings = calculator.calculateSavings(
      10000, // miles
      20, // current MPG
      22, // improved MPG
      3.5, // fuel price
    );

    expect(savings.baselineScenario.totalGallons).toBeGreaterThan(0);
    expect(savings.improvementScenario.totalGallons).toBeLessThan(
      savings.baselineScenario.totalGallons,
    );
    expect(savings.savings.gallonsSaved).toBeGreaterThan(0);
    expect(savings.savings.costSaved).toBeGreaterThan(0);
  });

  it("should calculate 10% improvement correctly", () => {
    const savings = calculator.calculateSavings(10000, 20, 22, 3.5, 1);

    expect(savings.savings.percentMpgImprovement).toBeCloseTo(10, 1);
  });

  it("should annualize savings", () => {
    const savings = calculator.calculateSavings(10000, 20, 22, 3.5);

    expect(savings.savings.annualizedCostSavings).toBeGreaterThan(
      savings.savings.costSaved,
    );
  });

  it("should scale savings by fleet size", () => {
    const savings1Vehicle = calculator.calculateSavings(10000, 20, 22, 3.5, 1);
    const savings5Vehicles = calculator.calculateSavings(10000, 20, 22, 3.5, 5);

    expect(savings5Vehicles.savings.costSaved).toBeCloseTo(
      savings1Vehicle.savings.costSaved * 5,
      -1,
    );
  });

  it("should return zero savings if no improvement", () => {
    const savings = calculator.calculateSavings(10000, 20, 20, 3.5);

    expect(savings.savings.costSaved).toBe(0);
    expect(savings.savings.gallonsSaved).toBe(0);
  });
});
