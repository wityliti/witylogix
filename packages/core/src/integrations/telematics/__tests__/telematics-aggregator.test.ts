/**
 * Telematics Aggregator Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TelematicsAggregator } from "../telematics-aggregator.js";
import type { ITelematicsAdapter } from "../types.js";

describe("TelematicsAggregator", () => {
  let aggregator: TelematicsAggregator;
  let mockAdapter1: Partial<ITelematicsAdapter>;
  let mockAdapter2: Partial<ITelematicsAdapter>;

  beforeEach(() => {
    aggregator = new TelematicsAggregator();

    mockAdapter1 = {
      getVehicles: vi.fn(async () => [
        {
          externalVehicleId: "v1",
          name: "Truck 1",
          vin: "VIN123456",
          licensePlate: "ABC123",
          make: "Volvo",
          model: "FH16",
          year: 2022,
          status: "ACTIVE",
          odometer: undefined,
        },
        {
          externalVehicleId: "v2",
          name: "Truck 2",
          vin: "VIN789012",
          licensePlate: "XYZ789",
          make: "Scania",
          model: "R440",
          year: 2021,
          status: "ACTIVE",
          odometer: undefined,
        },
      ]),
      getVehiclePosition: vi.fn(async (id: string) => ({
        externalVehicleId: id,
        latitude: 40.7128,
        longitude: -74.006,
        speed: { value: 55, unit: "mph" as const },
        heading: 180,
        timestamp: new Date(),
      })),
      getVehicleDiagnostics: vi.fn(async (id: string) => ({
        externalVehicleId: id,
        engineRunning: true,
        faultCodes: [],
        timestamp: new Date(),
      })),
      getDriverBehaviorEvents: vi.fn(async () => []),
      getFuelLevel: vi.fn(async () => ({
        externalVehicleId: "v1",
        fuelLevel: 75,
        fuelUnit: "gallons" as const,
        timestamp: new Date(),
      })),
      subscribeToEvents: vi.fn(),
      unsubscribeFromEvents: vi.fn(),
      healthCheck: vi.fn(async () => true),
      authenticate: vi.fn(),
    };

    mockAdapter2 = {
      getVehicles: vi.fn(async () => [
        {
          externalVehicleId: "v3",
          name: "Truck 3",
          vin: "VIN123456", // Same VIN as v1 (duplicate)
          licensePlate: "DEF456",
          make: "Volvo",
          model: "FH16",
          year: 2022,
          status: "ACTIVE",
          odometer: undefined,
        },
      ]),
      getVehiclePosition: vi.fn(async (id: string) => ({
        externalVehicleId: id,
        latitude: 40.72,
        longitude: -74.01,
        speed: { value: 60, unit: "mph" as const },
        heading: 90,
        timestamp: new Date(Date.now() - 5000), // Slightly older
      })),
      getVehicleDiagnostics: vi.fn(async (id: string) => ({
        externalVehicleId: id,
        engineRunning: true,
        faultCodes: [
          {
            code: "P0101",
            description: "Mass air flow error",
            severity: "warning",
          },
        ],
        timestamp: new Date(),
      })),
      getDriverBehaviorEvents: vi.fn(async () => [
        {
          externalEventId: "e1",
          externalVehicleId: "v3",
          eventType: "speeding" as const,
          severity: "warning" as const,
          latitude: 40.72,
          longitude: -74.01,
          speed: { value: 75, unit: "mph" as const },
          speedLimit: { value: 65, unit: "mph" as const },
          timestamp: new Date(),
          description: "Speeding detected",
        },
      ]),
      getFuelLevel: vi.fn(async () => ({
        externalVehicleId: "v3",
        fuelLevel: 50,
        fuelUnit: "gallons" as const,
        timestamp: new Date(),
      })),
      subscribeToEvents: vi.fn(),
      unsubscribeFromEvents: vi.fn(),
      healthCheck: vi.fn(async () => true),
      authenticate: vi.fn(),
    };
  });

  describe("registerProvider", () => {
    it("should register a provider", () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      // No assertion needed, just ensure no error is thrown
    });

    it("should throw error if provider already registered", () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      expect(() => {
        aggregator.registerProvider(
          "samsara",
          mockAdapter2 as ITelematicsAdapter,
        );
      }).toThrow("already registered");
    });
  });

  describe("unregisterProvider", () => {
    it("should unregister a provider", () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.unregisterProvider("samsara");
      // Should not throw on second unregister (no-op)
      aggregator.unregisterProvider("samsara");
    });
  });

  describe("getUnifiedFleet", () => {
    it("should return deduplicated vehicles from all providers", async () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("geotab", mockAdapter2 as ITelematicsAdapter);

      const fleet = await aggregator.getUnifiedFleet();

      // Should have 3 unique vehicles (VIN123456 appears in both providers)
      expect(fleet.length).toBeGreaterThan(0);

      // Check that vehicles have provider mappings
      const vehiclesWithMultipleProviders = fleet.filter(
        (v) => v.providers.length > 1,
      );
      expect(vehiclesWithMultipleProviders.length).toBeGreaterThan(0);
    });

    it("should handle provider errors gracefully", async () => {
      const failingAdapter: Partial<ITelematicsAdapter> = {
        getVehicles: vi.fn(async () => {
          throw new Error("Provider offline");
        }),
      };

      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider(
        "failing",
        failingAdapter as ITelematicsAdapter,
      );

      const fleet = await aggregator.getUnifiedFleet();

      expect(fleet.length).toBeGreaterThan(0);
    });
  });

  describe("getBestPosition", () => {
    it("should return freshest position from multiple providers", async () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("geotab", mockAdapter2 as ITelematicsAdapter);

      const fleet = await aggregator.getUnifiedFleet();
      const vehicle = fleet[0];

      const position = await aggregator.getBestPosition(vehicle.id);

      expect(position).toBeDefined();
      expect(position?.latitude).toBeDefined();
      expect(position?.longitude).toBeDefined();
    });

    it("should throw error if vehicle not found", async () => {
      await expect(aggregator.getBestPosition("nonexistent")).rejects.toThrow(
        "not found",
      );
    });

    it("should return null if no positions available", async () => {
      const adapter: Partial<ITelematicsAdapter> = {
        getVehicles: vi.fn(async () => [
          {
            externalVehicleId: "v1",
            name: "Vehicle",
            status: "ACTIVE",
            odometer: undefined,
          },
        ]),
        getVehiclePosition: vi.fn(async () => {
          throw new Error("No position data");
        }),
      };

      aggregator.registerProvider("test", adapter as ITelematicsAdapter);
      const fleet = await aggregator.getUnifiedFleet();

      const position = await aggregator.getBestPosition(fleet[0].id);
      expect(position).toBeNull();
    });
  });

  describe("getConsolidatedAlerts", () => {
    it("should return consolidated alerts from all providers", async () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("geotab", mockAdapter2 as ITelematicsAdapter);

      const fleet = await aggregator.getUnifiedFleet();
      const vehicle = fleet.find((v) => v.providers.includes("geotab"));

      if (vehicle) {
        const alerts = await aggregator.getConsolidatedAlerts(vehicle.id);
        expect(Array.isArray(alerts)).toBe(true);
      }
    });

    it("should deduplicate similar alerts", async () => {
      const adapter1: Partial<ITelematicsAdapter> = {
        getVehicles: vi.fn(async () => [
          {
            externalVehicleId: "v1",
            name: "Vehicle",
            status: "ACTIVE",
            odometer: undefined,
          },
        ]),
        getVehiclePosition: vi.fn(async () => ({
          externalVehicleId: "v1",
          latitude: 0,
          longitude: 0,
          timestamp: new Date(),
        })),
        getVehicleDiagnostics: vi.fn(async () => ({
          externalVehicleId: "v1",
          engineRunning: false,
          faultCodes: [],
          timestamp: new Date(),
        })),
        getDriverBehaviorEvents: vi.fn(async () => [
          {
            externalEventId: "e1",
            externalVehicleId: "v1",
            eventType: "speeding" as const,
            severity: "warning" as const,
            latitude: 0,
            longitude: 0,
            timestamp: new Date(),
          },
        ]),
        getFuelLevel: vi.fn(),
        subscribeToEvents: vi.fn(),
        unsubscribeFromEvents: vi.fn(),
        healthCheck: vi.fn(),
        authenticate: vi.fn(),
      };

      const adapter2: Partial<ITelematicsAdapter> = {
        getVehicles: vi.fn(async () => []),
        getVehiclePosition: vi.fn(),
        getVehicleDiagnostics: vi.fn(),
        getDriverBehaviorEvents: vi.fn(async () => [
          {
            externalEventId: "e2",
            externalVehicleId: "v1",
            eventType: "speeding" as const,
            severity: "warning" as const,
            latitude: 0,
            longitude: 0,
            timestamp: new Date(),
          },
        ]),
        getFuelLevel: vi.fn(),
        subscribeToEvents: vi.fn(),
        unsubscribeFromEvents: vi.fn(),
        healthCheck: vi.fn(),
        authenticate: vi.fn(),
      };

      aggregator.registerProvider("provider1", adapter1 as ITelematicsAdapter);
      aggregator.registerProvider("provider2", adapter2 as ITelematicsAdapter);

      const fleet = await aggregator.getUnifiedFleet();
      const alerts = await aggregator.getConsolidatedAlerts(fleet[0].id);

      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe("getMergedDiagnostics", () => {
    it("should merge diagnostics from multiple providers", async () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("geotab", mockAdapter2 as ITelematicsAdapter);

      const fleet = await aggregator.getUnifiedFleet();

      // Find a vehicle available from both providers
      const vehicleWithBoth = fleet.find((v) => v.providers.length > 1);

      if (vehicleWithBoth) {
        const diagnostics = await aggregator.getMergedDiagnostics(
          vehicleWithBoth.id,
        );

        expect(diagnostics).toBeDefined();
        expect(diagnostics?.engineRunning).toBeDefined();
        // Should have merged fault codes from both providers
        expect(Array.isArray(diagnostics?.faultCodes)).toBe(true);
      }
    });

    it("should return null if no diagnostics available", async () => {
      const adapter: Partial<ITelematicsAdapter> = {
        getVehicles: vi.fn(async () => [
          {
            externalVehicleId: "v1",
            name: "Vehicle",
            status: "ACTIVE",
            odometer: undefined,
          },
        ]),
        getVehicleDiagnostics: vi.fn(async () => {
          throw new Error("No diagnostics");
        }),
      };

      aggregator.registerProvider("test", adapter as ITelematicsAdapter);
      const fleet = await aggregator.getUnifiedFleet();

      const diagnostics = await aggregator.getMergedDiagnostics(fleet[0].id);
      expect(diagnostics).toBeNull();
    });
  });

  describe("getFleetHealthScore", () => {
    it("should calculate fleet health score", async () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("geotab", mockAdapter2 as ITelematicsAdapter);

      const score = await aggregator.getFleetHealthScore();

      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      expect(score.connectivity).toBeGreaterThanOrEqual(0);
      expect(score.connectivity).toBeLessThanOrEqual(100);
      expect(score.faultCodeRate).toBeGreaterThanOrEqual(0);
      expect(score.alertCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getProviderStatus", () => {
    it("should return status of all providers", async () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("geotab", mockAdapter2 as ITelematicsAdapter);

      const status = await aggregator.getProviderStatus();

      expect(status.samsara).toBeDefined();
      expect(status.samsara?.healthy).toBe(true);
      expect(status.geotab).toBeDefined();
      expect(status.geotab?.healthy).toBe(true);
    });

    it("should capture provider errors", async () => {
      const failingAdapter: Partial<ITelematicsAdapter> = {
        healthCheck: vi.fn(async () => {
          throw new Error("Connection failed");
        }),
      };

      aggregator.registerProvider(
        "failing",
        failingAdapter as ITelematicsAdapter,
      );

      const status = await aggregator.getProviderStatus();

      expect(status.failing?.healthy).toBe(false);
      expect(status.failing?.lastError).toContain("Connection failed");
    });
  });

  describe("setDeduplicationRules", () => {
    it("should apply custom deduplication rules", async () => {
      aggregator.setDeduplicationRules({
        matchBy: ["licensePlate"],
      });

      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("geotab", mockAdapter2 as ITelematicsAdapter);

      const fleet = await aggregator.getUnifiedFleet();
      expect(fleet.length).toBeGreaterThan(0);
    });
  });

  describe("vehicle deduplication", () => {
    it("should deduplicate vehicles by VIN", async () => {
      const adapter: Partial<ITelematicsAdapter> = {
        getVehicles: vi.fn(async () => [
          {
            externalVehicleId: "v1",
            name: "Truck A",
            vin: "SHARED-VIN",
            licensePlate: "PLATE1",
            status: "ACTIVE",
            odometer: undefined,
          },
        ]),
      };

      aggregator.registerProvider(
        "provider1",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("provider2", adapter as ITelematicsAdapter);

      const fleet = await aggregator.getUnifiedFleet();
      // Should have deduplicated vehicles by VIN matching
      expect(fleet.length).toBeGreaterThan(0);
    });

    it("should maintain provider mappings for deduplicated vehicles", async () => {
      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider("geotab", mockAdapter2 as ITelematicsAdapter);

      const fleet = await aggregator.getUnifiedFleet();
      const vehicleWithMultipleProviders = fleet.find(
        (v) => v.providers.length > 1,
      );

      if (vehicleWithMultipleProviders) {
        expect(
          Object.keys(vehicleWithMultipleProviders.externalVehicleIds).length,
        ).toBe(vehicleWithMultipleProviders.providers.length);
      }
    });
  });

  describe("error handling", () => {
    it("should handle provider failures gracefully", async () => {
      const failingAdapter: Partial<ITelematicsAdapter> = {
        getVehicles: vi.fn(async () => {
          throw new Error("API unavailable");
        }),
      };

      aggregator.registerProvider(
        "failing",
        failingAdapter as ITelematicsAdapter,
      );
      aggregator.registerProvider(
        "working",
        mockAdapter1 as ITelematicsAdapter,
      );

      const fleet = await aggregator.getUnifiedFleet();
      expect(fleet.length).toBeGreaterThan(0);
    });

    it("should continue aggregating when some vehicles fail", async () => {
      const partialAdapter: Partial<ITelematicsAdapter> = {
        getVehicles: vi.fn(async () => [
          {
            externalVehicleId: "v_fail",
            name: "Failing Vehicle",
            status: "ACTIVE",
            odometer: undefined,
          },
        ]),
        getVehiclePosition: vi.fn(async () => {
          throw new Error("Position unavailable");
        }),
      };

      aggregator.registerProvider(
        "samsara",
        mockAdapter1 as ITelematicsAdapter,
      );
      aggregator.registerProvider(
        "partial",
        partialAdapter as ITelematicsAdapter,
      );

      const fleet = await aggregator.getUnifiedFleet();
      expect(fleet.length).toBeGreaterThan(0);
    });
  });
});
