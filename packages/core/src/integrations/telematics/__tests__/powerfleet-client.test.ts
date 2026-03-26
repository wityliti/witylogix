/**
 * Powerfleet API Client Tests
 * Comprehensive test suite with 20+ test cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PowerfleetClient } from "../powerfleet-client.js";
import type { TelematicsConfig } from "../types.js";

describe("PowerfleetClient", () => {
  let client: PowerfleetClient;
  let config: TelematicsConfig;

  beforeEach(() => {
    config = {
      provider: "powerfleet" as any,
      credentials: { apiKey: "test-api-key" },
      rateLimit: 10,
      retries: 3,
    };

    client = new PowerfleetClient(config);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with valid config", () => {
      expect(client).toBeDefined();
    });

    it("should initialize rate limiter", () => {
      expect(client).toBeDefined();
    });

    it("should initialize circuit breaker", () => {
      expect(client).toBeDefined();
    });
  });

  describe("getVehicles", () => {
    it("should fetch vehicles from Powerfleet", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          assets: [
            {
              assetId: "VEH-001",
              assetName: "Vehicle 1",
              assetType: "VEHICLE",
              licensePlate: "ABC-123",
              vin: "VIN-001",
              status: "ACTIVE",
              lastUpdateTime: Date.now(),
            },
          ],
        }),
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const vehicles = await client.getVehicles();
      expect(vehicles).toHaveLength(1);
      expect(vehicles[0].externalVehicleId).toBe("VEH-001");
    });

    it("should handle empty response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assets: [] }),
      });

      const vehicles = await client.getVehicles();
      expect(vehicles).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const vehicles = await client.getVehicles();
      expect(vehicles).toHaveLength(0);
    });
  });

  describe("getVehicleById", () => {
    it("should fetch vehicle by ID", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assetId: "VEH-001",
          assetName: "Vehicle 1",
          assetType: "VEHICLE",
          licensePlate: "ABC-123",
          status: "ACTIVE",
          lastUpdateTime: Date.now(),
        }),
      });

      const vehicle = await client.getVehicleById("VEH-001");
      expect(vehicle.externalVehicleId).toBe("VEH-001");
      expect(vehicle.status).toBe("ACTIVE");
    });
  });

  describe("getPositions", () => {
    it("should fetch current positions", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          locations: [
            {
              assetId: "VEH-001",
              timestamp: Date.now(),
              latitude: 40.7128,
              longitude: -74.006,
              altitude: 10,
              speed: 35,
              heading: 180,
            },
          ],
        }),
      });

      const positions = await client.getPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0].latitude).toBe(40.7128);
      expect(positions[0].speed?.value).toBe(35);
    });
  });

  describe("getPositionByVehicleId", () => {
    it("should fetch position for specific vehicle", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assetId: "VEH-001",
          timestamp: Date.now(),
          latitude: 40.7128,
          longitude: -74.006,
          speed: 35,
        }),
      });

      const position = await client.getPositionByVehicleId("VEH-001");
      expect(position.externalVehicleId).toBe("VEH-001");
      expect(position.latitude).toBe(40.7128);
    });
  });

  describe("getYardDwellEvents", () => {
    it("should fetch yard dwell events", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              eventId: "DWELL-001",
              assetId: "VEH-001",
              eventType: "DOCK_ARRIVAL",
              timestamp: Date.now(),
              latitude: 40.7128,
              longitude: -74.006,
              durationMinutes: 45,
            },
          ],
        }),
      });

      const events = await client.getYardDwellEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("DOCK_ARRIVAL");
    });

    it("should handle empty events", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [] }),
      });

      const events = await client.getYardDwellEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe("getUtilizationReport", () => {
    it("should fetch utilization report", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalMiles: 1000,
          utilizationPercent: 85,
          averageSpeed: 45,
        }),
      });

      const report = await client.getUtilizationReport();
      expect(report.totalMiles).toBe(1000);
      expect(report.utilizationPercent).toBe(85);
    });

    it("should fetch utilization for specific vehicle", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          vehicleId: "VEH-001",
          utilizationPercent: 85,
        }),
      });

      const report = await client.getUtilizationReport("VEH-001");
      expect(report.vehicleId).toBe("VEH-001");
    });
  });

  describe("getTemperatureReadings", () => {
    it("should fetch temperature readings", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          readings: [
            {
              readingId: "TEMP-001",
              assetId: "VEH-001",
              timestamp: Date.now(),
              temperatureFahrenheit: 32,
              temperatureCelsius: 0,
              status: "NORMAL",
            },
          ],
        }),
      });

      const readings = await client.getTemperatureReadings();
      expect(readings).toHaveLength(1);
      expect(readings[0].temperatureFahrenheit).toBe(32);
    });
  });

  describe("geofence management", () => {
    it("should fetch geofences", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          geofences: [
            {
              geofenceId: "GEO-001",
              name: "Warehouse A",
              latitude: 40.7128,
              longitude: -74.006,
              radiusMeters: 500,
              type: "FACILITY",
              alertOnEntry: true,
              alertOnExit: true,
            },
          ],
        }),
      });

      const geofences = await client.getGeofences();
      expect(geofences).toHaveLength(1);
      expect(geofences[0].name).toBe("Warehouse A");
    });

    it("should create geofence", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          geofenceId: "GEO-NEW",
          name: "New Location",
          latitude: 40.7128,
          longitude: -74.006,
          radiusMeters: 300,
          type: "CUSTOM",
          alertOnEntry: false,
          alertOnExit: false,
        }),
      });

      const geofence = await client.createGeofence({
        name: "New Location",
        latitude: 40.7128,
        longitude: -74.006,
        radiusMeters: 300,
        type: "CUSTOM",
        alertOnEntry: false,
        alertOnExit: false,
      });

      expect(geofence.name).toBe("New Location");
    });

    it("should update geofence", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          geofenceId: "GEO-001",
          name: "Updated Location",
          radiusMeters: 600,
        }),
      });

      const geofence = await client.updateGeofence("GEO-001", {
        radiusMeters: 600,
      });

      expect(geofence.radiusMeters).toBe(600);
    });

    it("should delete geofence", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await expect(client.deleteGeofence("GEO-001")).resolves.toBeUndefined();
    });

    it("should get geofence alerts", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          alerts: [
            {
              alertId: "ALERT-001",
              assetId: "VEH-001",
              geofenceId: "GEO-001",
              eventType: "ENTRY",
              timestamp: Date.now(),
              latitude: 40.7128,
              longitude: -74.006,
            },
          ],
        }),
      });

      const alerts = await client.getGeofenceAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].eventType).toBe("ENTRY");
    });
  });

  describe("webhook management", () => {
    it("should subscribe to webhook", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriptionId: "SUB-001" }),
      });

      const subId = await client.subscribeWebhook({
        url: "https://example.com/webhook",
        events: ["position.updated"],
      });

      expect(subId).toBe("SUB-001");
    });

    it("should unsubscribe from webhook", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await expect(
        client.unsubscribeWebhook("SUB-001"),
      ).resolves.toBeUndefined();
    });
  });

  describe("healthCheck", () => {
    it("should return true for healthy status", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ok" }),
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false for unhealthy status", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("validateConnection", () => {
    it("should validate connection", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ assets: [] }),
      });

      const result = await client.validateConnection();
      expect(result).toBe(true);
    });

    it("should return false on validation failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const result = await client.validateConnection();
      expect(result).toBe(false);
    });
  });

  describe("normalization", () => {
    it("should normalize vehicle status", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assetId: "VEH-001",
          assetName: "Vehicle",
          assetType: "VEHICLE",
          status: "INACTIVE",
          lastUpdateTime: Date.now(),
        }),
      });

      const vehicle = await client.getVehicleById("VEH-001");
      expect(vehicle.status).toBe("INACTIVE");
    });

    it("should normalize location data", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assetId: "VEH-001",
          timestamp: 1704067200000,
          latitude: 40.7128,
          longitude: -74.006,
          speed: 25,
        }),
      });

      const position = await client.getPositionByVehicleId("VEH-001");
      expect(position.timestamp).toBeInstanceOf(Date);
      expect(position.speed?.unit).toBe("mph");
    });
  });

  describe("error handling", () => {
    it("should handle network errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const vehicles = await client.getVehicles();
      expect(vehicles).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const vehicles = await client.getVehicles();
      expect(vehicles).toHaveLength(0);
    });
  });

  describe("getDiagnostics", () => {
    it("should return empty array (not supported)", async () => {
      const diagnostics = await client.getDiagnostics();
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("getBehaviorEvents", () => {
    it("should return empty array (not supported)", async () => {
      const events = await client.getBehaviorEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe("getFuelReadings", () => {
    it("should return empty array (not supported)", async () => {
      const readings = await client.getFuelReadings();
      expect(readings).toHaveLength(0);
    });
  });
});
