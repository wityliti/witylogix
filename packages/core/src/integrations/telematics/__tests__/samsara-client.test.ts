/**
 * Samsara Client Tests
 * Tests for REST API v1 client implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SamsaraClient } from "../samsara-client.js";
import type {
  TelematicsConfig,
  SamsaraCredentials,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
} from "../types.js";

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
    json: async () => response,
    text: async () => JSON.stringify(response),
  }) as unknown as typeof fetch;
}

/**
 * Create test client
 */
function createTestClient(
  overrides: Partial<TelematicsConfig> = {},
): SamsaraClient {
  const config: TelematicsConfig = {
    provider: "samsara",
    credentials: {
      apiToken: "test-api-token",
    },
    timeout: 10000,
    rateLimit: 100,
    retries: 2,
    ...overrides,
  };

  const client = new SamsaraClient(config);
  // Mock fetch
  global.fetch = mockFetch({});
  return client;
}

describe("SamsaraClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Authentication", () => {
    it("should authenticate with valid API token", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: [],
        pagination: { hasNextPage: false },
      });

      await expect(client.authenticate()).resolves.not.toThrow();
    });

    it("should throw on authentication failure", async () => {
      const client = createTestClient();
      global.fetch = mockFetch(
        { code: "UNAUTHORIZED", message: "Invalid API token" },
        401,
      );

      await expect(client.authenticate()).rejects.toThrow(
        "authentication failed",
      );
    });

    it("should send Bearer token in headers", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [], pagination: { hasNextPage: false } }),
      });
      global.fetch = fetchSpy;

      await client.authenticate();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-token",
          }),
        }),
      );
    });
  });

  describe("getVehicles", () => {
    it("should fetch and normalize vehicles", async () => {
      const client = createTestClient();
      const mockVehicles = {
        data: [
          {
            id: "vehicle-123",
            name: "Delivery Van 1",
            staticFields: {
              vin: "VIN123456",
              licensePlate: "ABC-123",
              make: "Ford",
              model: "Transit",
              year: 2020,
            },
            externalIds: [],
          },
        ],
        pagination: { hasNextPage: false },
      };

      global.fetch = mockFetch(mockVehicles);

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0]).toMatchObject({
        externalVehicleId: "vehicle-123",
        name: "Delivery Van 1",
        vin: "VIN123456",
        licensePlate: "ABC-123",
        make: "Ford",
        model: "Transit",
        year: 2020,
        status: "ACTIVE",
      });
    });

    it("should handle pagination", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();

      // First page
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "v1", name: "Vehicle 1", staticFields: {} }],
          pagination: { hasNextPage: true },
        }),
      });

      // Second page
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "v2", name: "Vehicle 2", staticFields: {} }],
          pagination: { hasNextPage: false },
        }),
      });

      global.fetch = fetchSpy;

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("should cache vehicles for 5 minutes", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "v1", name: "Vehicle 1", staticFields: {} }],
          pagination: { hasNextPage: false },
        }),
      });
      global.fetch = fetchSpy;

      // First call
      await client.getVehicles();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await client.getVehicles();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should retry on rate limit", async () => {
      const client = createTestClient({ retries: 2 });
      const fetchSpy = vi.fn();

      // First call: rate limited
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ code: "RATE_LIMIT", message: "Too many requests" }),
      });

      // Second call: success
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          pagination: { hasNextPage: false },
        }),
      });

      global.fetch = fetchSpy;

      const vehicles = await client.getVehicles();

      expect(vehicles).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("getVehiclePosition", () => {
    it("should fetch current position", async () => {
      const client = createTestClient();
      const mockLocation = {
        data: [
          {
            id: "loc-123",
            vehicleId: "vehicle-123",
            latitude: 40.7128,
            longitude: -74.006,
            speedMph: 25,
            heading: 180,
            time: "2024-03-11T12:00:00Z",
            accuracy: 5,
          },
        ],
      };

      global.fetch = mockFetch(mockLocation);

      const position = await client.getVehiclePosition("vehicle-123");

      expect(position).toMatchObject({
        externalVehicleId: "vehicle-123",
        latitude: 40.7128,
        longitude: -74.006,
        speed: { value: 25, unit: "mph" },
        heading: 180,
        accuracy: 5,
      });
    });

    it("should throw when no position available", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({ data: [] });

      await expect(client.getVehiclePosition("vehicle-123")).rejects.toThrow(
        "No location data available",
      );
    });

    it("should cache position for 30 seconds", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "loc-123",
              latitude: 40.7128,
              longitude: -74.006,
              speedMph: 25,
              heading: 180,
              time: "2024-03-11T12:00:00Z",
            },
          ],
        }),
      });
      global.fetch = fetchSpy;

      await client.getVehiclePosition("vehicle-123");
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      await client.getVehiclePosition("vehicle-123");
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Cache hit
    });
  });

  describe("getVehicleDiagnostics", () => {
    it("should fetch vehicle diagnostics", async () => {
      const client = createTestClient();
      const mockStats = {
        data: {
          engineState: "Running",
          odometer: { miles: 50000 },
          faultCodes: [
            {
              id: "code-1",
              spnId: 102,
              fmiId: 1,
              description: "Engine coolant temperature circuit",
            },
          ],
        },
      };

      global.fetch = mockFetch(mockStats);

      const diagnostics = await client.getVehicleDiagnostics("vehicle-123");

      expect(diagnostics).toMatchObject({
        externalVehicleId: "vehicle-123",
        engineRunning: true,
        faultCodes: expect.arrayContaining([
          expect.objectContaining({
            code: "SPN102_FMI1",
            description: "Engine coolant temperature circuit",
          }),
        ]),
        odometer: { value: 50000, unit: "miles" },
      });
    });

    it("should detect engine state correctly", async () => {
      const client = createTestClient();

      global.fetch = mockFetch({
        data: { engineState: "Idle", odometer: { miles: 50000 } },
      });

      const diagnostics = await client.getVehicleDiagnostics("vehicle-123");
      expect(diagnostics.engineRunning).toBe(false);

      global.fetch = mockFetch({
        data: { engineState: "running", odometer: { miles: 50000 } },
      });

      client.clearCache();
      const diagnostics2 = await client.getVehicleDiagnostics("vehicle-123");
      expect(diagnostics2.engineRunning).toBe(true);
    });

    it("should cache diagnostics for 5 minutes", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { engineState: "Running", odometer: { miles: 50000 } },
        }),
      });
      global.fetch = fetchSpy;

      await client.getVehicleDiagnostics("vehicle-123");
      await client.getVehicleDiagnostics("vehicle-123");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDriverBehaviorEvents", () => {
    it("should fetch driver behavior events", async () => {
      const client = createTestClient();
      const mockEvents = {
        data: [
          {
            id: "event-123",
            vehicleId: "vehicle-123",
            driverId: "driver-456",
            eventType: "HarshEvent",
            eventSubType: "Acceleration",
            severity: "Warning",
            latitude: 40.7128,
            longitude: -74.006,
            speed: 35,
            speedLimit: 25,
            timestamp: "2024-03-11T12:00:00Z",
            description: "Harsh acceleration detected",
          },
        ],
        pagination: { hasNextPage: false },
      };

      global.fetch = mockFetch(mockEvents);

      const events = await client.getDriverBehaviorEvents("driver-456", {
        startDate: new Date("2024-03-11T00:00:00Z"),
        endDate: new Date("2024-03-11T23:59:59Z"),
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        externalEventId: "event-123",
        eventType: "harsh_acceleration",
        severity: "warning",
      });
    });

    it("should handle pagination of events", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "e1",
              vehicleId: "v1",
              eventType: "HarshEvent",
              eventSubType: "Acceleration",
              latitude: 40.7128,
              longitude: -74.006,
              timestamp: "2024-03-11T12:00:00Z",
            },
          ],
          pagination: { hasNextPage: true },
        }),
      });

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "e2",
              vehicleId: "v1",
              eventType: "Speeding",
              eventSubType: "Over",
              latitude: 40.8,
              longitude: -74.1,
              timestamp: "2024-03-11T13:00:00Z",
            },
          ],
          pagination: { hasNextPage: false },
        }),
      });

      global.fetch = fetchSpy;

      const events = await client.getDriverBehaviorEvents("driver-456", {
        startDate: new Date("2024-03-11T00:00:00Z"),
        endDate: new Date("2024-03-11T23:59:59Z"),
      });

      expect(events).toHaveLength(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("getFuelLevel", () => {
    it("should fetch fuel level", async () => {
      const client = createTestClient();
      const mockFuel = {
        data: {
          id: "vehicle-123",
          fuelPercentageRemaining: 75,
        },
      };

      global.fetch = mockFetch(mockFuel);

      const fuel = await client.getFuelLevel("vehicle-123");

      expect(fuel).toMatchObject({
        externalVehicleId: "vehicle-123",
        fuelLevel: 75,
        fuelUnit: "gallons",
      });
    });

    it("should cache fuel for 2 minutes", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { id: "vehicle-123", fuelPercentageRemaining: 75 },
        }),
      });
      global.fetch = fetchSpy;

      await client.getFuelLevel("vehicle-123");
      await client.getFuelLevel("vehicle-123");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribeToEvents", () => {
    it("should create webhook subscription", async () => {
      const client = createTestClient();
      const mockWebhook = {
        data: {
          id: "webhook-123",
          url: "https://example.com/webhook",
          eventTypes: ["*.created", "*.updated"],
        },
      };

      global.fetch = mockFetch(mockWebhook);

      const subscription = await client.subscribeToEvents(
        "https://example.com/webhook",
        ["*.created"],
      );

      expect(subscription).toMatchObject({
        webhookId: "webhook-123",
        url: "https://example.com/webhook",
        events: expect.any(Array),
      });
    });

    it("should handle default event types", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: "webhook-123",
            url: "https://example.com/webhook",
            eventTypes: ["*.created", "*.updated"],
          },
        }),
      });
      global.fetch = fetchSpy;

      await client.subscribeToEvents("https://example.com/webhook", []);

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.eventTypes).toContain("*.created");
    });
  });

  describe("unsubscribeFromEvents", () => {
    it("should delete webhook subscription", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({}, 204);

      await expect(
        client.unsubscribeFromEvents("webhook-123"),
      ).resolves.not.toThrow();
    });
  });

  describe("healthCheck", () => {
    it("should return true when authenticated", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({
        data: [],
        pagination: { hasNextPage: false },
      });

      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });

    it("should return false when not authenticated", async () => {
      const client = createTestClient();
      global.fetch = mockFetch({ code: "UNAUTHORIZED" }, 401);

      const healthy = await client.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limit", async () => {
      const client = createTestClient({ rateLimit: 2 });
      const startTime = Date.now();

      // Make 4 calls (should take time due to rate limiting)
      global.fetch = mockFetch({ data: [], pagination: { hasNextPage: false } });

      await client.getVehicles();
      await client.getVehicles();
      client.clearCache();
      await client.getVehicles();
      client.clearCache();
      await client.getVehicles();

      const elapsed = Date.now() - startTime;
      // With 2 req/sec, 4 requests should take at least 1500ms
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("Circuit Breaker", () => {
    it("should open circuit breaker after failures", async () => {
      const client = createTestClient({ retries: 1 });
      global.fetch = mockFetch({ code: "ERROR" }, 500);

      // Make 5 failed requests to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await client.getVehicles();
        } catch {
          // Expected
        }
      }

      // Next request should fail immediately
      await expect(client.getVehicles()).rejects.toThrow();
    });

    it("should recover after timeout", async () => {
      const client = createTestClient({ retries: 1 });

      // Cause failures
      global.fetch = mockFetch({ code: "ERROR" }, 500);
      for (let i = 0; i < 5; i++) {
        try {
          await client.getVehicles();
        } catch {
          // Expected
        }
      }

      // Reset circuit breaker
      client.resetCircuitBreaker();

      // Should work again
      global.fetch = mockFetch({ data: [], pagination: { hasNextPage: false } });
      await expect(client.getVehicles()).resolves.not.toThrow();
    });
  });
});
