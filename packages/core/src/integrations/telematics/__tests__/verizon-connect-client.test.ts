/**
 * Verizon Connect Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VerizonConnectClient } from "../verizon-connect-client.js";
import type { TelematicsConfig } from "../types.js";

describe("VerizonConnectClient", () => {
  let client: VerizonConnectClient;
  let config: TelematicsConfig;

  beforeEach(() => {
    config = {
      provider: "samsara",
      credentials: {
        accessToken: "test-access-token",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      },
      timeout: 30000,
      rateLimit: 10,
      retries: 3,
    };
    client = new VerizonConnectClient(config);
  });

  describe("authenticate", () => {
    it("should authenticate successfully", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ vehicles: [] }),
        } as Response),
      );

      await expect(client.authenticate()).resolves.toBeUndefined();
    });

    it("should throw on 401 unauthorized", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({
              code: "UNAUTHORIZED",
              message: "Access token expired",
            }),
        } as Response),
      );

      await expect(client.authenticate()).rejects.toThrow(
        "authentication failed",
      );
    });
  });

  describe("getVehicles", () => {
    it("should return list of vehicles", async () => {
      const mockVehicles = {
        vehicles: [
          {
            id: "v1",
            name: "Truck 1",
            vin: "VIN123456",
            licensePlate: "ABC123",
            make: "Volvo",
            model: "FH16",
            year: 2022,
            status: "active",
            lastUpdate: "2024-01-15T10:00:00Z",
            ignitionStatus: "on",
          },
          {
            id: "v2",
            name: "Truck 2",
            vin: "VIN789012",
            licensePlate: "XYZ789",
            make: "Scania",
            model: "R440",
            year: 2021,
            status: "active",
            lastUpdate: "2024-01-15T10:05:00Z",
            ignitionStatus: "off",
          },
        ],
        totalCount: 2,
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVehicles),
        } as Response),
      );

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
      expect(vehicles[0].name).toBe("Truck 1");
      expect(vehicles[0].vin).toBe("VIN123456");
      expect(vehicles[1].licensePlate).toBe("XYZ789");
    });

    it("should handle pagination", async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                vehicles: Array.from({ length: 100 }, (_, i) => ({
                  id: `v${i}`,
                  name: `Vehicle ${i}`,
                  vin: `VIN${i}`,
                  licensePlate: `PLATE${i}`,
                  make: "Make",
                  model: "Model",
                  year: 2022,
                  status: "active",
                  lastUpdate: new Date().toISOString(),
                })),
                totalCount: 150,
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ vehicles: [], totalCount: 150 }),
        } as Response);
      });

      const vehicles = await client.getVehicles();
      expect(vehicles.length).toBeGreaterThanOrEqual(100);
    });
  });

  describe("getVehiclePosition", () => {
    it("should return current vehicle position", async () => {
      const mockVehicle = {
        id: "v1",
        name: "Truck 1",
        vin: "VIN123456",
        licensePlate: "ABC123",
        make: "Volvo",
        model: "FH16",
        year: 2022,
        status: "active",
        lastUpdate: "2024-01-15T10:00:00Z",
        position: {
          latitude: 40.7128,
          longitude: -74.006,
          speed: 55,
          heading: 180,
          accuracy: 5,
        },
        ignitionStatus: "on",
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVehicle),
        } as Response),
      );

      const position = await client.getVehiclePosition("v1");

      expect(position.latitude).toBe(40.7128);
      expect(position.longitude).toBe(-74.006);
      expect(position.speed?.value).toBe(55);
      expect(position.speed?.unit).toBe("mph");
      expect(position.heading).toBe(180);
    });

    it("should throw error if no position data", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "v1",
              name: "Truck 1",
              status: "active",
              position: undefined,
            }),
        } as Response),
      );

      await expect(client.getVehiclePosition("v1")).rejects.toThrow(
        "No position data",
      );
    });
  });

  describe("getVehicleDiagnostics", () => {
    it("should return vehicle diagnostics", async () => {
      const mockDiagnostics = {
        engineRunning: true,
        faultCodes: [
          {
            code: "P0101",
            description: "Mass air flow sensor range/performance",
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDiagnostics),
        } as Response),
      );

      const diagnostics = await client.getVehicleDiagnostics("v1");

      expect(diagnostics.engineRunning).toBe(true);
      expect(diagnostics.faultCodes).toHaveLength(1);
      expect(diagnostics.faultCodes[0].code).toBe("P0101");
    });

    it("should handle empty fault codes", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              engineRunning: false,
              faultCodes: [],
            }),
        } as Response),
      );

      const diagnostics = await client.getVehicleDiagnostics("v1");

      expect(diagnostics.engineRunning).toBe(false);
      expect(diagnostics.faultCodes).toHaveLength(0);
    });
  });

  describe("getDriverBehaviorEvents", () => {
    it("should return behavior alerts", async () => {
      const mockAlerts = {
        alerts: [
          {
            id: "alert1",
            vehicleId: "v1",
            driverId: "d1",
            type: "speeding",
            severity: "warning",
            location: { latitude: 40.7128, longitude: -74.006 },
            speed: 75,
            speedLimit: 65,
            timestamp: "2024-01-15T10:00:00Z",
            message: "Vehicle exceeded speed limit",
          },
          {
            id: "alert2",
            vehicleId: "v1",
            driverId: "d1",
            type: "harsh_braking",
            severity: "critical",
            location: { latitude: 40.713, longitude: -74.005 },
            speed: 30,
            timestamp: "2024-01-15T10:05:00Z",
            message: "Harsh braking detected",
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAlerts),
        } as Response),
      );

      const events = await client.getDriverBehaviorEvents("d1", {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe("speeding");
      expect(events[1].eventType).toBe("harsh_braking");
      expect(events[0].severity).toBe("warning");
    });

    it("should filter non-behavior events", async () => {
      const mockAlerts = {
        alerts: [
          {
            id: "alert1",
            vehicleId: "v1",
            type: "geofence",
            severity: "info",
            timestamp: "2024-01-15T10:00:00Z",
            message: "Vehicle entered geofence",
          },
          {
            id: "alert2",
            vehicleId: "v1",
            type: "speeding",
            severity: "warning",
            location: { latitude: 40.7128, longitude: -74.006 },
            speed: 75,
            timestamp: "2024-01-15T10:05:00Z",
            message: "Speeding",
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAlerts),
        } as Response),
      );

      const events = await client.getDriverBehaviorEvents("d1", {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("speeding");
    });
  });

  describe("getFuelLevel", () => {
    it("should return fuel level", async () => {
      const mockFuel = {
        fuelLevel: 60,
        fuelCapacity: 100,
        lastUpdate: "2024-01-15T10:00:00Z",
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFuel),
        } as Response),
      );

      const fuel = await client.getFuelLevel("v1");

      expect(fuel.fuelLevel).toBe(60); // Should be percentage
      expect(fuel.fuelUnit).toBe("gallons");
      expect(fuel.fuelCapacity).toBe(100);
    });
  });

  describe("subscribeToEvents", () => {
    it("should create webhook subscription", async () => {
      const mockWebhook = {
        id: "hook1",
        url: "https://example.com/webhook",
        events: ["position", "alert"],
        createdAt: "2024-01-15T10:00:00Z",
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockWebhook),
        } as Response),
      );

      const subscription = await client.subscribeToEvents(
        "https://example.com/webhook",
        ["position"],
      );

      expect(subscription.webhookId).toBe("hook1");
      expect(subscription.url).toBe("https://example.com/webhook");
      expect(subscription.events).toContain("position");
    });
  });

  describe("unsubscribeFromEvents", () => {
    it("should delete webhook", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response),
      );

      await expect(
        client.unsubscribeFromEvents("hook1"),
      ).resolves.toBeUndefined();
    });
  });

  describe("healthCheck", () => {
    it("should return true on healthy", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ vehicles: [] }),
        } as Response),
      );

      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });

    it("should return false on error", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

      const healthy = await client.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe("getDrivers", () => {
    it("should return list of drivers", async () => {
      const mockDrivers = {
        drivers: [
          {
            id: "d1",
            name: "John Smith",
            email: "john@example.com",
            phone: "555-1234",
            safetyScore: 92,
            status: "active",
            lastUpdate: "2024-01-15T10:00:00Z",
          },
          {
            id: "d2",
            name: "Jane Doe",
            email: "jane@example.com",
            phone: "555-5678",
            safetyScore: 88,
            status: "active",
            lastUpdate: "2024-01-15T10:00:00Z",
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDrivers),
        } as Response),
      );

      const drivers = await client.getDrivers();

      expect(drivers).toHaveLength(2);
      expect(drivers[0].name).toBe("John Smith");
      expect(drivers[0].safetyScore).toBe(92);
    });
  });

  describe("getTrips", () => {
    it("should return trip history", async () => {
      const mockTrips = {
        trips: [
          {
            id: "trip1",
            vehicleId: "v1",
            driverId: "d1",
            startTime: "2024-01-15T08:00:00Z",
            endTime: "2024-01-15T10:00:00Z",
            distance: 50,
            duration: 7200,
            averageSpeed: 25,
            topSpeed: 65,
            routePoints: [],
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTrips),
        } as Response),
      );

      const trips = await client.getTrips("v1");

      expect(trips).toHaveLength(1);
      expect(trips[0].distance).toBe(50);
      expect(trips[0].averageSpeed).toBe(25);
    });
  });

  describe("createGeofence", () => {
    it("should create geofence", async () => {
      const mockGeofence = {
        geofence: {
          id: "geo1",
          name: "Warehouse",
          type: "polygon",
          polygon: [
            { latitude: 40.7, longitude: -74.0 },
            { latitude: 40.72, longitude: -74.0 },
            { latitude: 40.72, longitude: -74.02 },
            { latitude: 40.7, longitude: -74.02 },
          ],
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeofence),
        } as Response),
      );

      const geofence = await client.createGeofence("Warehouse", "polygon", {
        polygon: mockGeofence.geofence.polygon,
      });

      expect(geofence.id).toBe("geo1");
      expect(geofence.type).toBe("polygon");
    });
  });

  describe("getMaintenance", () => {
    it("should return maintenance records", async () => {
      const mockMaintenance = {
        records: [
          {
            id: "m1",
            vehicleId: "v1",
            type: "oil_change",
            dueDate: "2024-02-15",
            status: "pending",
            description: "Regular oil change",
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMaintenance),
        } as Response),
      );

      const maintenance = await client.getMaintenance("v1");

      expect(maintenance).toHaveLength(1);
      expect(maintenance[0].type).toBe("oil_change");
      expect(maintenance[0].status).toBe("pending");
    });
  });

  describe("caching", () => {
    it("should cache vehicle list", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              vehicles: [
                {
                  id: "v1",
                  name: "Vehicle 1",
                  vin: "VIN1",
                  licensePlate: "PLATE1",
                  make: "Make",
                  model: "Model",
                  year: 2022,
                  status: "active",
                  lastUpdate: new Date().toISOString(),
                },
              ],
              totalCount: 1,
            }),
        } as Response),
      );

      const vehicles1 = await client.getVehicles();
      const vehicles2 = await client.getVehicles();

      expect(vehicles1).toEqual(vehicles2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("should handle API errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              code: "INTERNAL_ERROR",
              message: "Server error",
            }),
        } as Response),
      );

      await expect(client.getVehicles()).rejects.toThrow();
    });

    it("should retry on rate limit", async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: () =>
              Promise.resolve({
                code: "RATE_LIMITED",
                message: "Too many requests",
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ vehicles: [] }),
        } as Response);
      });

      const vehicles = await client.getVehicles();
      expect(vehicles).toBeDefined();
      expect(callCount).toBeGreaterThan(1);
    });
  });
});
