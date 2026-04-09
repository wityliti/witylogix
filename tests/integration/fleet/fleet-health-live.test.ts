/**
 * Fleet Health Live Integration Tests (WIT-86)
 *
 * Tests covering:
 * - TelematicsAggregator: register providers, compute fleet health score
 * - Fleet health scoring from real vehicle state (connectivity, fault codes)
 * - Vehicle telemetry aggregation across multiple providers
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TelematicsAggregator,
  type FleetHealthScore,
} from "../../../packages/core/src/integrations/telematics/telematics-aggregator.js";
import type {
  ITelematicsAdapter,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
} from "../../../packages/core/src/integrations/telematics/types.js";

// ─── Test Fixtures ─────────────────────────────────────────────────────────

function makeVehicle(externalId: string, name: string): NormalizedVehicle {
  return { externalVehicleId: externalId, name, status: "ACTIVE" };
}

function makePosition(externalId: string, staleMins = 5): NormalizedPosition {
  return {
    externalVehicleId: externalId,
    latitude: 40.7 + Math.random() * 0.1,
    longitude: -74.0 + Math.random() * 0.1,
    speed: 45,
    heading: 90,
    timestamp: new Date(Date.now() - staleMins * 60 * 1000),
  };
}

function makeDiagnostic(externalId: string, hasFault: boolean): NormalizedDiagnostic {
  return {
    externalVehicleId: externalId,
    engineRunning: true,
    faultCodes: hasFault
      ? [{ code: "P0101", description: "MAF Sensor", severity: "WARNING", system: "ENGINE" }]
      : [],
    timestamp: new Date(),
  };
}

/**
 * An in-memory telematics adapter for testing the aggregator.
 * Implements the full ITelematicsAdapter interface.
 */
class TestTelematicsAdapter implements ITelematicsAdapter {
  private vehicles: NormalizedVehicle[];
  private positions: Map<string, NormalizedPosition>;
  private diagnostics: Map<string, NormalizedDiagnostic>;

  constructor(
    vehicles: NormalizedVehicle[],
    positionStaleMap: Map<string, number> = new Map(),
    faultMap: Map<string, boolean> = new Map(),
  ) {
    this.vehicles = vehicles;
    this.positions = new Map();
    this.diagnostics = new Map();

    for (const v of vehicles) {
      const id = v.externalVehicleId;
      const staleMins = positionStaleMap.get(id) ?? 5;
      this.positions.set(id, makePosition(id, staleMins));
      this.diagnostics.set(id, makeDiagnostic(id, faultMap.get(id) ?? false));
    }
  }

  async authenticate(): Promise<void> {}

  async getVehicles(): Promise<NormalizedVehicle[]> {
    return this.vehicles;
  }

  async getVehiclePosition(vehicleId: string): Promise<NormalizedPosition> {
    const pos = this.positions.get(vehicleId);
    if (!pos) throw new Error(`No position for ${vehicleId}`);
    return pos;
  }

  async getVehicleDiagnostics(vehicleId: string): Promise<NormalizedDiagnostic> {
    const diag = this.diagnostics.get(vehicleId);
    if (!diag) throw new Error(`No diagnostics for ${vehicleId}`);
    return diag;
  }

  async getDriverBehaviorEvents(
    _driverId: string,
    _dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]> {
    return [];
  }

  async getFuelLevel(_vehicleId: string): Promise<NormalizedFuelReading> {
    return {
      externalVehicleId: _vehicleId,
      level: 75,
      unit: "percent",
      timestamp: new Date(),
    };
  }

  async subscribeToEvents(_webhookUrl: string, _eventTypes: string[]): Promise<string> {
    return "webhook-test-id";
  }

  async unsubscribeFromEvents(_subscriptionId: string): Promise<void> {}

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ─── TelematicsAggregator Tests ────────────────────────────────────────────

describe("TelematicsAggregator fleet health (live integration)", () => {
  it("returns 100% connectivity for a fully online fleet", async () => {
    const aggregator = new TelematicsAggregator();

    const vehicles = [makeVehicle("v1", "Truck 1"), makeVehicle("v2", "Truck 2")];
    const stale = new Map([["v1", 5], ["v2", 5]]); // fresh positions
    const faults = new Map<string, boolean>([["v1", false], ["v2", false]]);

    aggregator.registerProvider("samsara", new TestTelematicsAdapter(vehicles, stale, faults));

    const health = await aggregator.getFleetHealthScore();

    expect(health.connectivity).toBe(100);
    expect(health.faultCodeRate).toBe(0);
    expect(health.overall).toBeGreaterThan(80);
  });

  it("reduces health score when vehicles have fault codes", async () => {
    const aggregator = new TelematicsAggregator();

    const vehicles = [
      makeVehicle("v1", "Truck 1"),
      makeVehicle("v2", "Truck 2"),
      makeVehicle("v3", "Truck 3"),
    ];
    const stale = new Map([["v1", 5], ["v2", 5], ["v3", 5]]);
    const faults = new Map([["v1", true], ["v2", false], ["v3", false]]);

    aggregator.registerProvider("geotab", new TestTelematicsAdapter(vehicles, stale, faults));

    const health = await aggregator.getFleetHealthScore();

    expect(health.faultCodeRate).toBeGreaterThan(0);
    expect(health.overall).toBeLessThan(100);
  });

  it("aggregates data from multiple providers", async () => {
    const aggregator = new TelematicsAggregator();

    const samsaraVehicles = [makeVehicle("s1", "Samsara Truck 1"), makeVehicle("s2", "Samsara Truck 2")];
    const geotabVehicles = [makeVehicle("g1", "Geotab Truck 1")];

    aggregator.registerProvider("samsara", new TestTelematicsAdapter(samsaraVehicles));
    aggregator.registerProvider("geotab", new TestTelematicsAdapter(geotabVehicles));

    const fleet = await aggregator.getUnifiedFleet();
    // 3 unique vehicles (2 from Samsara + 1 from Geotab, different IDs so no dedup)
    expect(fleet.length).toBe(3);
  });

  it("handles empty fleet gracefully", async () => {
    const aggregator = new TelematicsAggregator();
    aggregator.registerProvider("samsara", new TestTelematicsAdapter([]));

    const health = await aggregator.getFleetHealthScore();

    expect(health.overall).toBeDefined();
    expect(health.connectivity).toBeDefined();
    expect(health.alertCount).toBe(0);
  });

  it("reports provider health status", async () => {
    const aggregator = new TelematicsAggregator();
    aggregator.registerProvider("samsara", new TestTelematicsAdapter([makeVehicle("v1", "T1")]));

    const status = await aggregator.getProviderStatus();

    expect(status["samsara"]).toBeDefined();
    expect(status["samsara"].healthy).toBe(true);
  });

  it("throws when registering same provider twice", () => {
    const aggregator = new TelematicsAggregator();
    const adapter = new TestTelematicsAdapter([]);

    aggregator.registerProvider("samsara", adapter);
    expect(() => aggregator.registerProvider("samsara", adapter)).toThrow();
  });

  it("allows unregistering and re-registering a provider", () => {
    const aggregator = new TelematicsAggregator();
    const adapter = new TestTelematicsAdapter([]);

    aggregator.registerProvider("samsara", adapter);
    aggregator.unregisterProvider("samsara");
    // Should not throw
    expect(() => aggregator.registerProvider("samsara", adapter)).not.toThrow();
  });
});

// ─── Fleet Health Scoring Logic Tests ──────────────────────────────────────

describe("Fleet health score properties", () => {
  it("overall score is bounded between 0 and 100", async () => {
    const aggregator = new TelematicsAggregator();

    const vehicles = Array.from({ length: 5 }, (_, i) => makeVehicle(`v${i}`, `Truck ${i}`));
    const faults = new Map(vehicles.map((v, i) => [v.externalVehicleId, i % 2 === 0]));

    aggregator.registerProvider("test", new TestTelematicsAdapter(vehicles, new Map(), faults));

    const health = await aggregator.getFleetHealthScore();

    expect(health.overall).toBeGreaterThanOrEqual(0);
    expect(health.overall).toBeLessThanOrEqual(100);
    expect(health.connectivity).toBeGreaterThanOrEqual(0);
    expect(health.connectivity).toBeLessThanOrEqual(100);
    expect(health.faultCodeRate).toBeGreaterThanOrEqual(0);
    expect(health.faultCodeRate).toBeLessThanOrEqual(100);
  });
});
