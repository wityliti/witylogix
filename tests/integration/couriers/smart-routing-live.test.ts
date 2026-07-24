/**
 * Smart Routing Live Integration Tests (WIT-86)
 *
 * Tests covering:
 * - SmartRouter with real ICourierProvider implementations
 * - SLAEnforcer: define SLA, evaluate compliance, generate reports
 * - CostOptimizer: compare costs across courier options
 * - PartnerPerformance: score calculation from delivery metrics
 *
 * These tests use actual service instances (no mocks) to verify
 * the live integration works end-to-end.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SmartRouter,
  SLAEnforcer,
  PartnerPerformance,
  CostOptimizer,
  type ICourierProvider,
  type CourierAvailability,
  type DeliveryRequest,
  type SLAConfig,
} from "../../../packages/core/src/integrations/couriers/index.js";
import type {
  CourierQuote,
  PackageSpec,
  LocationInfo,
} from "../../../packages/core/src/integrations/couriers/types.js";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const PICKUP: LocationInfo = {
  latitude: 40.7128,
  longitude: -74.006,
  address: "123 Main St, New York, NY",
  name: "Warehouse A",
};

const DROPOFF: LocationInfo = {
  latitude: 40.758,
  longitude: -73.9855,
  address: "456 Park Ave, New York, NY",
  name: "Customer",
};

/**
 * A deterministic in-memory courier provider for testing.
 */
class TestCourierProvider implements ICourierProvider {
  constructor(
    private readonly name: string,
    private readonly price: number,
    private readonly etaMinutes: number,
    private readonly loadPct: number = 30,
    private readonly healthy: boolean = true,
  ) {}

  async getAvailability(): Promise<CourierAvailability> {
    return {
      provider: this.name,
      available: this.healthy,
      loadPercentage: this.loadPct,
      activeDeliveries: Math.round(this.loadPct * 0.1),
      maxCapacity: 100,
      serviceAreas: [{ area: "NYC", available: true }],
      apiStatus: this.healthy ? "healthy" : "offline",
      lastUpdated: new Date(),
    };
  }

  async getQuote(_delivery: DeliveryRequest): Promise<CourierQuote> {
    if (!this.healthy) throw new Error(`${this.name} API is offline`);
    return {
      price: this.price,
      currency: "USD",
      estimatedMinutes: this.etaMinutes,
      provider: this.name,
    };
  }

  async canServiceArea(
    _pickup: LocationInfo,
    _dropoff: LocationInfo,
  ): Promise<boolean> {
    return this.healthy;
  }

  canHandlePackage(pkg: PackageSpec): boolean {
    return !pkg.weight || pkg.weight <= 25;
  }
}

// ─── SmartRouter Tests ─────────────────────────────────────────────────────

describe("SmartRouter (live integration)", () => {
  let router: SmartRouter;

  beforeEach(() => {
    router = new SmartRouter();
    router.registerProvider(
      "fastcourier",
      new TestCourierProvider("fastcourier", 8.5, 20),
    );
    router.registerProvider(
      "cheapcourier",
      new TestCourierProvider("cheapcourier", 4.0, 45),
    );
    router.registerProvider(
      "premium",
      new TestCourierProvider("premium", 15.0, 12, 10),
    );
  });

  it("routes a delivery and returns ranked options with the cheapest/fastest tradeoff", async () => {
    const delivery: DeliveryRequest = { pickup: PICKUP, dropoff: DROPOFF };
    const result = await router.routeDelivery(delivery);

    expect(result.options.length).toBe(3);
    expect(result.recommended).not.toBeNull();
    expect(result.recommended!.isViable).toBe(true);
    expect(result.fallbackChain.length).toBeGreaterThan(0);
  });

  it("respects maxCost constraint and excludes expensive options", async () => {
    const delivery: DeliveryRequest = {
      pickup: PICKUP,
      dropoff: DROPOFF,
      maxCost: 10,
    };
    const result = await router.routeDelivery(delivery);

    const viableOptions = result.options.filter((o) => o.isViable);
    for (const opt of viableOptions) {
      expect(opt.quote.price).toBeLessThanOrEqual(10);
    }
    // Premium ($15) should be excluded
    const premium = result.options.find((o) => o.provider === "premium");
    expect(premium?.isViable).toBe(false);
  });

  it("respects maxDeliveryMinutes constraint", async () => {
    const delivery: DeliveryRequest = {
      pickup: PICKUP,
      dropoff: DROPOFF,
      maxDeliveryMinutes: 25,
    };
    const result = await router.routeDelivery(delivery);

    const viable = result.options.filter((o) => o.isViable);
    for (const opt of viable) {
      expect(opt.quote.estimatedMinutes).toBeLessThanOrEqual(25);
    }
    // cheapcourier (45 min) should be excluded
    const cheap = result.options.find((o) => o.provider === "cheapcourier");
    expect(cheap?.isViable).toBe(false);
  });

  it("excludes offline providers", async () => {
    router.registerProvider(
      "broken",
      new TestCourierProvider("broken", 5.0, 30, 0, false),
    );
    const result = await router.routeDelivery({
      pickup: PICKUP,
      dropoff: DROPOFF,
    });

    const brokenOpt = result.options.find((o) => o.provider === "broken");
    expect(brokenOpt?.isViable).toBe(false);
  });

  it("prioritizes speed when requested", async () => {
    const result = await router.routeDelivery(
      { pickup: PICKUP, dropoff: DROPOFF },
      { prioritizeSpeed: true },
    );
    const viable = result.options.filter((o) => o.isViable);
    if (viable.length > 1) {
      expect(viable[0].quote.estimatedMinutes).toBeLessThanOrEqual(
        viable[1].quote.estimatedMinutes,
      );
    }
  });

  it("prioritizes cost when requested", async () => {
    const result = await router.routeDelivery(
      { pickup: PICKUP, dropoff: DROPOFF },
      { prioritizeCost: true },
    );
    const viable = result.options.filter((o) => o.isViable);
    if (viable.length > 1) {
      expect(viable[0].quote.price).toBeLessThanOrEqual(viable[1].quote.price);
    }
  });

  it("handles batch routing with cost optimization", async () => {
    const deliveries: DeliveryRequest[] = [
      { orderId: "order-1", pickup: PICKUP, dropoff: DROPOFF },
      { orderId: "order-2", pickup: DROPOFF, dropoff: PICKUP },
    ];

    const result = await router.routeBatch(deliveries);

    expect(result.results.size).toBe(2);
    expect(result.optimizedAssignment.size).toBeGreaterThan(0);
    expect(result.costOptimization.individualTotal).toBeGreaterThanOrEqual(0);
  });

  it("returns empty options gracefully when no providers registered", async () => {
    const emptyRouter = new SmartRouter();
    const result = await emptyRouter.routeDelivery({
      pickup: PICKUP,
      dropoff: DROPOFF,
    });

    expect(result.options).toHaveLength(0);
    expect(result.recommended).toBeNull();
    expect(result.fallbackChain).toHaveLength(0);
  });
});

// ─── SLAEnforcer Tests ─────────────────────────────────────────────────────

describe("SLAEnforcer (live integration)", () => {
  let enforcer: SLAEnforcer;
  const PARTNER_ID = "partner-test-001";

  const testSLA: SLAConfig = {
    partnerId: PARTNER_ID,
    name: "Standard SLA",
    description: "Test SLA for WIT-86 integration",
    maxPickupTimeMinutes: 30,
    maxDeliveryTimeMinutes: 60,
    maxDamageRate: 2,
    minRating: 4.0,
    responseTimeTargetMinutes: 5,
    onTimeTargetPercent: 95,
    penalties: {
      latePickupPenalty: 0.5,
      lateDeliveryPenalty: 1.0,
      damagePenalty: 25,
      lowRatingPenalty: 10,
    },
    escalation: {
      warningThreshold: 3,
      reviewThreshold: 7,
      suspensionThreshold: 15,
    },
    effectiveFrom: new Date(),
    status: "active",
  };

  beforeEach(() => {
    enforcer = new SLAEnforcer();
    enforcer.defineSLA(testSLA);
  });

  it("stores and retrieves SLA configuration", () => {
    const sla = enforcer.getSLA(PARTNER_ID);
    expect(sla).not.toBeUndefined();
    expect(sla!.name).toBe("Standard SLA");
    expect(sla!.maxPickupTimeMinutes).toBe(30);
  });

  it("marks compliant delivery as passing", () => {
    const result = enforcer.evaluateCompliance("del-001", PARTNER_ID, {
      pickupTime: 20,
      deliveryTime: 45,
      damageClaimed: false,
      customerRating: 4.5,
    });

    expect(result.compliant).toBe(true);
    expect(result.breaches).toHaveLength(0);
    expect(result.penaltyAmount).toBe(0);
  });

  it("detects late pickup breach and calculates penalty", () => {
    const result = enforcer.evaluateCompliance("del-002", PARTNER_ID, {
      pickupTime: 50, // 20 min over max 30
      deliveryTime: 45,
    });

    expect(result.compliant).toBe(false);
    const pickupBreach = result.breaches.find(
      (b) => b.metric === "pickup_time",
    );
    expect(pickupBreach).toBeDefined();
    expect(result.penaltyAmount).toBeGreaterThan(0);
    // 20 min × $0.50/min = $10
    expect(result.penaltyAmount).toBeCloseTo(10, 1);
  });

  it("detects damage breach with correct penalty", () => {
    const result = enforcer.evaluateCompliance("del-003", PARTNER_ID, {
      damageClaimed: true,
    });

    expect(result.compliant).toBe(false);
    const damageBreach = result.breaches.find((b) => b.metric === "damage");
    expect(damageBreach).toBeDefined();
    expect(result.penaltyAmount).toBe(25);
  });

  it("detects low customer rating breach", () => {
    const result = enforcer.evaluateCompliance("del-004", PARTNER_ID, {
      customerRating: 2.5,
    });

    expect(result.compliant).toBe(false);
    const ratingBreach = result.breaches.find((b) => b.metric === "rating");
    expect(ratingBreach).toBeDefined();
  });

  it("returns compliance pass when no SLA is configured", () => {
    const result = enforcer.evaluateCompliance("del-005", "unknown-partner", {
      pickupTime: 999,
    });

    expect(result.compliant).toBe(true);
    expect(result.breaches).toHaveLength(0);
  });

  it("generates compliance report for partner", () => {
    // Record some breaches first
    enforcer.evaluateCompliance("del-006", PARTNER_ID, { pickupTime: 60 });
    enforcer.evaluateCompliance("del-007", PARTNER_ID, { deliveryTime: 90 });

    const report = enforcer.getComplianceReport(PARTNER_ID, 30);

    expect(report.partnerId).toBe(PARTNER_ID);
    expect(report.breaches.totalBreaches).toBeGreaterThanOrEqual(2);
    expect(report.metrics.overallCompliance).toBeDefined();
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("escalates partner after breach threshold", () => {
    // Trigger enough breaches to reach warning threshold (3)
    for (let i = 0; i < 4; i++) {
      enforcer.evaluateCompliance(`del-esc-${i}`, PARTNER_ID, {
        pickupTime: 999,
        deliveryTime: 999,
      });
    }

    const report = enforcer.getComplianceReport(PARTNER_ID, 30);
    expect(["warning", "under_review", "suspended"]).toContain(
      report.escalationStatus,
    );
  });
});

// ─── PartnerPerformance Tests ──────────────────────────────────────────────

describe("PartnerPerformance (live integration)", () => {
  let perf: PartnerPerformance;

  beforeEach(() => {
    perf = new PartnerPerformance();
  });

  it("assigns gold tier to high-performing partner", () => {
    const score = perf.calculatePerformanceScore({
      onTimeRate: 98,
      damageRate: 0.1,
      customerRating: 4.8,
      costPerDelivery: 6,
      pickupSpeed: 8,
      communicationScore: 95,
      totalDeliveries: 500,
      onTimeDeliveries: 490,
      damagedDeliveries: 1,
      ratingsCount: 100,
      ratingsSum: 480,
      period: "30d",
      startDate: new Date(Date.now() - 30 * 86400000),
      endDate: new Date(),
    });

    expect(score.score).toBeGreaterThan(80);
    expect(score.tier).toBe("gold");
  });

  it("assigns review tier to poor performer", () => {
    const score = perf.calculatePerformanceScore({
      onTimeRate: 60,
      damageRate: 10,
      customerRating: 2.5,
      costPerDelivery: 20,
      pickupSpeed: 60,
      communicationScore: 40,
      totalDeliveries: 50,
      onTimeDeliveries: 30,
      damagedDeliveries: 5,
      ratingsCount: 20,
      ratingsSum: 50,
      period: "30d",
      startDate: new Date(Date.now() - 30 * 86400000),
      endDate: new Date(),
    });

    expect(score.score).toBeLessThan(60);
    expect(["bronze", "review"]).toContain(score.tier);
  });
});

// ─── CostOptimizer Tests ───────────────────────────────────────────────────

describe("CostOptimizer (live integration)", () => {
  let optimizer: CostOptimizer;
  let router: SmartRouter;

  beforeEach(() => {
    optimizer = new CostOptimizer();
    router = new SmartRouter();
    router.registerProvider(
      "courier-a",
      new TestCourierProvider("courier-a", 8.0, 30),
    );
    router.registerProvider(
      "courier-b",
      new TestCourierProvider("courier-b", 5.0, 50),
    );
    router.registerProvider(
      "courier-c",
      new TestCourierProvider("courier-c", 12.0, 15),
    );
  });

  it("identifies cheapest option and computes potential savings", async () => {
    const delivery: DeliveryRequest = { pickup: PICKUP, dropoff: DROPOFF };
    const result = await router.routeDelivery(delivery);

    const viable = result.options.filter((o) => o.isViable);
    expect(viable.length).toBeGreaterThan(0);

    const comparison = optimizer.compareCosts(delivery, result.options);

    expect(comparison.cheapest).toBeDefined();
    expect(comparison.cheapest.effectiveCost).toBeLessThanOrEqual(
      comparison.averageCost,
    );
    expect(comparison.potentialSavings.vsAverage).toBeGreaterThanOrEqual(0);
  });

  it("handles batch cost optimization across multiple deliveries", async () => {
    const deliveries: DeliveryRequest[] = [
      { orderId: "batch-1", pickup: PICKUP, dropoff: DROPOFF },
      { orderId: "batch-2", pickup: DROPOFF, dropoff: PICKUP },
      { orderId: "batch-3", pickup: PICKUP, dropoff: DROPOFF },
    ];

    const routingResults = new Map<string, { options: any[] }>();
    for (const d of deliveries) {
      const r = await router.routeDelivery(d);
      routingResults.set(d.orderId!, { options: r.options });
    }

    const batchResult = optimizer.optimizeBatchCost(
      deliveries,
      routingResults as any,
    );

    expect(batchResult.assignments.length).toBeGreaterThan(0);
    expect(batchResult.summary.ifRoutedIndividually).toBeGreaterThan(0);
  });
});
