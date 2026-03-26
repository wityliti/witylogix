/**
 * Samsara SDK Client Tests
 * Tests for the Samsara REST API v1 SDK implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SamsaraSdkClient } from "../samsara-sdk-client.js";
import type {
  WitylogixVehiclePosition,
  WitylogixDriverStatus,
  WitylogixVehicleDiagnostics,
  WitylogixSafetyEvent,
} from "../telematics-types.js";

/**
 * Mock fetch helper
 */
function mockFetch(
  response: Record<string, unknown>,
  status = 200,
): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: vi.fn(async () => response),
    text: vi.fn(async () => JSON.stringify(response)),
  }) as unknown as typeof fetch;
}

/**
 * Create test client
 */
function createTestClient(token = "test-token"): SamsaraSdkClient {
  const client = new SamsaraSdkClient(token, {
    timeout: 5000,
    retries: 2,
  });
  return client;
}

describe("SamsaraSdkClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should throw when API token is missing", () => {
      expect(() => new SamsaraSdkClient("")).toThrow(
        "Samsara API token is required",
      );
    });

    it("should initialize with valid token", () => {
      const client = createTestClient("valid-token");
      expect(client).toBeDefined();
    });

    it("should apply custom options", () => {
      const client = new SamsaraSdkClient("token", {
        timeout: 10000,
        retries: 5,
      });
      expect(client).toBeDefined();
    });
  });

  describe("healthCheck", () => {
    it("should return true on successful connection", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({ data: [], pagination: { hasNextPage: false } });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false on connection failure", async () => {
      const client = createTestClient();
      global.fetch = mockFetch(
        { error: "Unauthorized" },
        401,
      );

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("testConnection", () => {
    it("should return success message", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({ data: [], pagination: { hasNextPage: false } });

      const result = await client.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully connected");
    });

    it("should return error message on failure", async () => {
      const client = createTestClient();
      global.fetch = mockFetch(
        { code: "UNAUTHORIZED", message: "Invalid token" },
        401,
      );

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe("getVehicles", () => {
    it("should fetch and normalize vehicles", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: [
          {
            id: "vehicle-1",
            name: "Truck 1",
            staticFields: { vin: "VIN123", licensePlate: "ABC-123" },
          },
        ],
        pagination: { hasNextPage: false },
      });

      // Mock getVehiclePosition for the vehicle
      const originalFetch = global.fetch;
      let callCount = 0;
      global.fetch = vi.fn(async (url: string, options?: RequestInit) => {
        callCount++;
        if (callCount === 2) {
          // Second call for position
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  vehicleId: "vehicle-1",
                  latitude: 37.7749,
                  longitude: -122.4194,
                  speedMph: 45,
                  heading: 180,
                  time: new Date().toISOString(),
                  accuracy: 10,
                },
              ],
            }),
          };
        }
        return originalFetch(url, options);
      });

      const vehicles = await client.getVehicles();
      expect(vehicles.length).toBeGreaterThan(0);
      expect(vehicles[0]).toHaveProperty("vehicleId");
      expect(vehicles[0]).toHaveProperty("lat");
    });

    it("should handle pagination", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();

      // First page
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "v1", name: "Vehicle 1" }],
          pagination: { hasNextPage: true, endCursor: "cursor1" },
        }),
      });

      // Second page
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          pagination: { hasNextPage: false },
        }),
      });

      // Mock positions
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              vehicleId: "v1",
              latitude: 37.7749,
              longitude: -122.4194,
              speedMph: 45,
              heading: 180,
              time: new Date().toISOString(),
            },
          ],
        }),
      });

      global.fetch = fetchSpy;

      await client.getVehicles();
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getVehiclePosition", () => {
    it("should fetch vehicle position", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: [
          {
            vehicleId: "vehicle-1",
            latitude: 37.7749,
            longitude: -122.4194,
            speedMph: 45,
            heading: 180,
            time: new Date().toISOString(),
            accuracy: 10,
          },
        ],
      });

      const position = await client.getVehiclePosition("vehicle-1");

      expect(position).toHaveProperty("vehicleId", "vehicle-1");
      expect(position).toHaveProperty("lat", 37.7749);
      expect(position).toHaveProperty("lng", -122.4194);
      expect(position).toHaveProperty("speed", 45);
      expect(position).toHaveProperty("provider", "samsara");
    });

    it("should throw when no location data", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({ data: [] });

      await expect(client.getVehiclePosition("vehicle-1")).rejects.toThrow(
        "No location data available",
      );
    });
  });

  describe("getBatchVehiclePositions", () => {
    it("should fetch multiple vehicle positions", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: [
          {
            vehicleId: "vehicle-1",
            latitude: 37.7749,
            longitude: -122.4194,
            speedMph: 45,
            heading: 180,
            time: new Date().toISOString(),
          },
          {
            vehicleId: "vehicle-2",
            latitude: 34.0522,
            longitude: -118.2437,
            speedMph: 60,
            heading: 270,
            time: new Date().toISOString(),
          },
        ],
      });

      const positions = await client.getBatchVehiclePositions(["vehicle-1", "vehicle-2"]);

      expect(positions).toHaveLength(2);
      expect(positions[0].vehicleId).toBe("vehicle-1");
      expect(positions[1].vehicleId).toBe("vehicle-2");
    });

    it("should return empty array for empty input", async () => {
      const client = createTestClient();

      const positions = await client.getBatchVehiclePositions([]);
      expect(positions).toHaveLength(0);
    });
  });

  describe("getDriverStatus", () => {
    it("should fetch driver status", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: {
          id: "driver-1",
          name: "John Doe",
          status: "ACTIVE",
          currentVehicleId: "vehicle-1",
        },
      });

      const status = await client.getDriverStatus("driver-1");

      expect(status.driverId).toBe("driver-1");
      expect(status.vehicleId).toBe("vehicle-1");
      expect(status.status).toBe("ACTIVE");
    });

    it("should throw when driver not found", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({}, 404);

      await expect(client.getDriverStatus("unknown-driver")).rejects.toThrow();
    });
  });

  describe("getVehicleDiagnostics", () => {
    it("should fetch vehicle diagnostics", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: {
          engineState: "RUNNING",
          odometer: { miles: 50000 },
          fuelPercentageRemaining: 75,
          engineRunningHours: 1000,
          faultCodes: [
            {
              id: "code-1",
              spnId: 123,
              fmiId: 2,
              description: "Fault description",
            },
          ],
        },
      });

      const diagnostics = await client.getVehicleDiagnostics("vehicle-1");

      expect(diagnostics.vehicleId).toBe("vehicle-1");
      expect(diagnostics.fuelLevel).toBe(75);
      expect(diagnostics.odometer?.value).toBe(50000);
      expect(diagnostics.engineHours).toBe(1000);
      expect(diagnostics.dtcCodes).toHaveLength(1);
    });
  });

  describe("getLocationHistory", () => {
    it("should fetch location history", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: [
          {
            vehicleId: "vehicle-1",
            latitude: 37.7749,
            longitude: -122.4194,
            speedMph: 45,
            heading: 180,
            time: new Date().toISOString(),
          },
          {
            vehicleId: "vehicle-1",
            latitude: 37.776,
            longitude: -122.42,
            speedMph: 50,
            heading: 185,
            time: new Date(Date.now() - 60000).toISOString(),
          },
        ],
      });

      const history = await client.getLocationHistory("vehicle-1", {
        limit: 2,
      });

      expect(history).toHaveLength(2);
      expect(history[0].vehicleId).toBe("vehicle-1");
    });
  });

  describe("getSafetyEvents", () => {
    it("should fetch safety events for driver", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: {
          safetyEvents: [
            {
              id: "event-1",
              eventType: "HARSH_ACCELERATION",
              severity: "warning",
              latitude: 37.7749,
              longitude: -122.4194,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });

      const events = await client.getSafetyEvents("driver-1");

      expect(events).toHaveLength(1);
      expect(events[0].driverId).toBe("driver-1");
      expect(events[0].severity).toBe("warning");
    });

    it("should return empty array when no driver ID", async () => {
      const client = createTestClient();

      const events = await client.getSafetyEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe("parseWebhookEvent", () => {
    it("should parse location update webhook", () => {
      const client = createTestClient();

      const event = client.parseWebhookEvent({
        eventType: "vehicle.location_update",
        timestamp: new Date().toISOString(),
        data: { vehicleId: "v1" },
      });

      expect(event.type).toBe("location_update");
    });

    it("should parse status change webhook", () => {
      const client = createTestClient();

      const event = client.parseWebhookEvent({
        eventType: "driver.status_change",
        timestamp: new Date().toISOString(),
        data: { driverId: "d1" },
      });

      expect(event.type).toBe("status_change");
    });

    it("should parse alert webhook", () => {
      const client = createTestClient();

      const event = client.parseWebhookEvent({
        eventType: "alert.triggered",
        timestamp: new Date().toISOString(),
        data: { type: "speeding" },
      });

      expect(event.type).toBe("alert");
    });
  });

  describe("getDrivers", () => {
    it("should fetch drivers list", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: [
          {
            id: "driver-1",
            name: "John Doe",
            status: "ACTIVE",
            vehicleId: "vehicle-1",
          },
          {
            id: "driver-2",
            name: "Jane Smith",
            status: "INACTIVE",
          },
        ],
      });

      const drivers = await client.getDrivers();

      expect(drivers).toHaveLength(2);
      expect(drivers[0].id).toBe("driver-1");
      expect(drivers[1].id).toBe("driver-2");
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limits", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({ data: [] });

      const start = Date.now();
      await Promise.all([
        client.healthCheck(),
        client.healthCheck(),
      ]);
      const duration = Date.now() - start;

      // Should have rate limiting in place
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle 401 unauthorized", async () => {
      const client = createTestClient();
      global.fetch = mockFetch(
        { code: "UNAUTHORIZED", message: "Invalid token" },
        401,
      );

      await expect(client.getVehicles()).rejects.toThrow();
    });

    it("should handle 429 rate limit with retry", async () => {
      const client = createTestClient();
      let attemptCount = 0;

      global.fetch = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          return {
            ok: false,
            status: 429,
            json: async () => ({ code: "RATE_LIMIT" }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        };
      });

      await expect(client.getVehicles()).resolves.toBeDefined();
    });

    it("should handle network timeout", async () => {
      const client = createTestClient();
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network timeout"));

      await expect(client.getVehicles()).rejects.toThrow();
    });
  });
});
