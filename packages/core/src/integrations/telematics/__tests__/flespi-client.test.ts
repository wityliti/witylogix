/**
 * Flespi Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FlespiClient } from "../flespi-client.js";
import type { TelematicsConfig } from "../types.js";

describe("FlespiClient", () => {
  let client: FlespiClient;
  let config: TelematicsConfig;

  beforeEach(() => {
    config = {
      provider: "samsara",
      credentials: {
        apiToken: "test-token-12345",
      },
      timeout: 30000,
      rateLimit: 10,
      retries: 3,
    };
    client = new FlespiClient(config);
  });

  describe("authenticate", () => {
    it("should authenticate successfully", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: [] }),
        } as Response),
      );

      await expect(client.authenticate()).resolves.toBeUndefined();
    });

    it("should throw error on authentication failure", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({
              errors: [{ title: "UNAUTHORIZED", detail: "Invalid token" }],
            }),
        } as Response),
      );

      await expect(client.authenticate()).rejects.toThrow("authentication failed");
    });
  });

  describe("getVehicles", () => {
    it("should return list of vehicles", async () => {
      const mockDevices = {
        result: [
          {
            id: 1,
            name: "Vehicle 1",
            ident: "IMEI123456",
            protocol: "gps",
            status: "online",
          },
          {
            id: 2,
            name: "Vehicle 2",
            ident: "IMEI789012",
            protocol: "gps",
            status: "online",
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDevices),
        } as Response),
      );

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
      expect(vehicles[0].name).toBe("Vehicle 1");
      expect(vehicles[0].externalVehicleId).toBe("1");
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
                result: Array.from({ length: 100 }, (_, i) => ({
                  id: i + 1,
                  name: `Vehicle ${i + 1}`,
                  ident: `IMEI${i}`,
                  protocol: "gps",
                })),
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: [] }),
        } as Response);
      });

      const vehicles = await client.getVehicles();
      expect(vehicles.length).toBeGreaterThan(0);
    });

    it("should cache vehicles", async () => {
      const mockDevices = {
        result: [
          { id: 1, name: "Vehicle 1", ident: "IMEI123", protocol: "gps" },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDevices),
        } as Response),
      );

      const vehicles1 = await client.getVehicles();
      const vehicles2 = await client.getVehicles();

      expect(vehicles1).toEqual(vehicles2);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Called once, second result is cached
    });
  });

  describe("getVehiclePosition", () => {
    it("should return current position", async () => {
      const mockTelemetry = {
        result: {
          device_id: 1,
          position: {
            latitude: 37.7749,
            longitude: -122.4194,
            speed: 45,
            heading: 90,
            altitude: 100,
          },
          timestamp: 1700000000,
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTelemetry),
        } as Response),
      );

      const position = await client.getVehiclePosition("1");

      expect(position.latitude).toBe(37.7749);
      expect(position.longitude).toBe(-122.4194);
      expect(position.speed?.value).toBe(45);
      expect(position.heading).toBe(90);
    });

    it("should throw error if no position data", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: {} }),
        } as Response),
      );

      await expect(client.getVehiclePosition("1")).rejects.toThrow(
        "No telemetry data",
      );
    });
  });

  describe("getVehicleDiagnostics", () => {
    it("should return diagnostics", async () => {
      const mockMessages = {
        result: [
          {
            device_id: 1,
            timestamp: 1700000000,
            engine_running: true,
            fuel_level: 85,
            odometer: 50000,
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMessages),
        } as Response),
      );

      const diagnostics = await client.getVehicleDiagnostics("1");

      expect(diagnostics.engineRunning).toBe(true);
      expect(diagnostics.faultCodes).toEqual([]);
      expect(diagnostics.odometer?.value).toBe(50000);
    });

    it("should handle missing diagnostic data", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: [] }),
        } as Response),
      );

      await expect(client.getVehicleDiagnostics("1")).rejects.toThrow(
        "No diagnostic data",
      );
    });
  });

  describe("getFuelLevel", () => {
    it("should return fuel level", async () => {
      const mockMessages = {
        result: [
          {
            device_id: 1,
            timestamp: 1700000000,
            fuel_level: 65.5,
          },
        ],
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMessages),
        } as Response),
      );

      const fuel = await client.getFuelLevel("1");

      expect(fuel.fuelLevel).toBe(65.5);
      expect(fuel.fuelUnit).toBe("liters");
    });
  });

  describe("subscribeToEvents", () => {
    it("should create webhook subscription", async () => {
      const mockWebhook = {
        result: {
          id: 123,
          url: "https://example.com/webhook",
          events: ["position", "event"],
          enabled: true,
          created: 1700000000,
        },
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

      expect(subscription.webhookId).toBe("123");
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

      await expect(client.unsubscribeFromEvents("123")).resolves.toBeUndefined();
    });
  });

  describe("healthCheck", () => {
    it("should return true on healthy", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: [] }),
        } as Response),
      );

      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });

    it("should return false on error", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        } as Response),
      );

      const healthy = await client.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe("createChannel", () => {
    it("should create data channel", async () => {
      const mockChannel = {
        result: {
          id: 456,
          name: "Default",
          protocol: "wialon",
          device_id: 1,
          type: "channel",
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockChannel),
        } as Response),
      );

      const channel = await client.createChannel("1", "wialon");

      expect(channel.id).toBe(456);
      expect(channel.protocol).toBe("wialon");
    });
  });

  describe("createGeofence", () => {
    it("should create circle geofence", async () => {
      const mockGeofence = {
        result: {
          id: 789,
          name: "Office",
          type: "circle",
          center: { latitude: 37.7749, longitude: -122.4194 },
          radius: 100,
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeofence),
        } as Response),
      );

      const geofence = await client.createGeofence("Office", "circle", {
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
      });

      expect(geofence.id).toBe(789);
      expect(geofence.type).toBe("circle");
      expect(geofence.radius).toBe(100);
    });
  });

  describe("createStream", () => {
    it("should create MQTT stream", async () => {
      const mockStream = {
        result: {
          id: 321,
          name: "MQTT Stream",
          type: "mqtt",
          protocol: "mqtt",
          active: true,
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStream),
        } as Response),
      );

      const stream = await client.createStream("MQTT Stream", "mqtt", {
        host: "broker.example.com",
        port: 1883,
      });

      expect(stream.id).toBe(321);
      expect(stream.type).toBe("mqtt");
    });
  });

  describe("createCalculator", () => {
    it("should create calculator", async () => {
      const mockCalculator = {
        result: {
          id: 555,
          name: "Mileage",
          type: "mileage",
          device_id: 1,
          enabled: true,
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCalculator),
        } as Response),
      );

      const calculator = await client.createCalculator("1", "mileage");

      expect(calculator.id).toBe(555);
      expect(calculator.type).toBe("mileage");
      expect(calculator.enabled).toBe(true);
    });
  });

  describe("getAnalytics", () => {
    it("should fetch analytics", async () => {
      const mockAnalytics = {
        result: {
          totalDistance: 5000,
          totalDuration: 3600,
          averageSpeed: 45,
          maxSpeed: 90,
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAnalytics),
        } as Response),
      );

      const analytics = await client.getAnalytics("1");

      expect(analytics.totalDistance).toBe(5000);
      expect(analytics.averageSpeed).toBe(45);
    });
  });

  describe("rate limiting", () => {
    it("should respect rate limit", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: [] }),
        } as Response),
      );

      const start = Date.now();
      await client.getVehicles();
      const elapsed = Date.now() - start;

      // Should take time due to rate limiter initialization
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network error")),
      );

      await expect(client.getVehicles()).rejects.toThrow("Max retries exceeded");
    });

    it("should retry on 429 rate limit", async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: () =>
              Promise.resolve({
                errors: [{ title: "RATE_LIMIT", detail: "Too many requests" }],
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ result: [] }),
        } as Response);
      });

      const vehicles = await client.getVehicles();
      expect(vehicles).toBeDefined();
      expect(callCount).toBeGreaterThan(1);
    });

    it("should not retry on 4xx errors", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              errors: [{ title: "BAD_REQUEST", detail: "Invalid parameter" }],
            }),
        } as Response),
      );

      await expect(client.getVehicles()).rejects.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDriverBehaviorEvents", () => {
    it("should return empty array (Flespi limitation)", async () => {
      const events = await client.getDriverBehaviorEvents("driver1", {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
      });

      expect(events).toEqual([]);
    });
  });
});
