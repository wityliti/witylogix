/**
 * Geotab Client Tests
 * Tests for MyGeotab API client implementation (JSONRPC 2.0)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GeotabClient } from "../geotab-client.js";
import type { TelematicsConfig } from "../types.js";

/**
 * Mock fetch helper for JSONRPC responses
 */
function mockFetch(
  result: Record<string, unknown> | Record<string, unknown>[] | null,
  error: { code: number; message: string } | null = null,
  status = 200,
): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => ({
      jsonrpc: "2.0",
      result: result,
      error: error,
      id: 1,
    }),
    text: async () =>
      JSON.stringify({
        jsonrpc: "2.0",
        result,
        error,
        id: 1,
      }),
  }) as unknown as typeof fetch;
}

/**
 * Create test client
 */
function createTestClient(
  overrides: Partial<TelematicsConfig> = {},
): GeotabClient {
  const config: TelematicsConfig = {
    provider: "geotab",
    credentials: {
      database: "test-db",
      userName: "test-user",
      password: "test-password",
      sessionId: "test-session-id",
    },
    timeout: 10000,
    rateLimit: 100,
    retries: 2,
    ...overrides,
  };

  const client = new GeotabClient(config);
  global.fetch = mockFetch({
    sessionId: "test-session-id",
  });
  return client;
}

describe("GeotabClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Authentication", () => {
    /** Create a client without pre-set sessionId for auth tests */
    function createUnauthenticatedClient(): GeotabClient {
      return createTestClient({
        credentials: {
          database: "test-db",
          userName: "test-user",
          password: "test-password",
        },
      });
    }

    it("should authenticate and cache session ID", async () => {
      const client = createUnauthenticatedClient();
      global.fetch = mockFetch({
        sessionId: "new-session-id",
      });

      await client.authenticate();

      // Verify that the session was cached by checking it works for next call
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [],
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.getVehicles();

      // Should have used cached session
      expect(fetchSpy).toHaveBeenCalled();
    });

    it("should throw on authentication failure", async () => {
      const client = createUnauthenticatedClient();
      global.fetch = mockFetch(null, {
        code: 401,
        message: "Invalid credentials",
      });

      await expect(client.authenticate()).rejects.toThrow(
        "authentication failed",
      );
    });

    it("should send credentials in request", async () => {
      const client = createUnauthenticatedClient();
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: { sessionId: "test-session" },
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.authenticate();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("test-user"),
        }),
      );
    });
  });

  describe("getVehicles", () => {
    it("should fetch and normalize devices", async () => {
      const client = createTestClient();
      const mockDevices = [
        {
          id: "device-123",
          name: "Delivery Van 1",
          vin: "VIN123456",
          licensePlate: "ABC-123",
          make: "Ford",
          model: "Transit",
          modelYear: 2020,
          deviceType: "CustomVehicleDevice",
        },
      ];

      global.fetch = mockFetch(mockDevices);

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0]).toMatchObject({
        externalVehicleId: "device-123",
        name: "Delivery Van 1",
        vin: "VIN123456",
        licensePlate: "ABC-123",
        make: "Ford",
        model: "Transit",
        year: 2020,
        status: "ACTIVE",
      });
    });

    it("should use Get method with Device typeName", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [],
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.getVehicles();

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.method).toBe("Get");
      expect(body.params.typeName).toBe("Device");
    });

    it("should cache vehicles for 5 minutes", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [
            {
              id: "d1",
              name: "Vehicle 1",
            },
          ],
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.getVehicles();
      await client.getVehicles();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getVehiclePosition", () => {
    it("should fetch current position from DeviceStatusInfo", async () => {
      const client = createTestClient();
      const mockStatus = [
        {
          device: { id: "device-123" },
          latitude: 40.7128,
          longitude: -74.006,
          speed: 40, // kmh
          bearing: 180,
          dateTime: "2024-03-11T12:00:00Z",
        },
      ];

      global.fetch = mockFetch(mockStatus);

      const position = await client.getVehiclePosition("device-123");

      expect(position).toMatchObject({
        externalVehicleId: "device-123",
        latitude: 40.7128,
        longitude: -74.006,
        speed: {
          value: expect.closeTo(24.85, 0.1), // ~40 kmh to mph
          unit: "mph",
        },
        heading: 180,
      });
    });

    it("should throw when no status available", async () => {
      const client = createTestClient();
      global.fetch = mockFetch([]);

      await expect(client.getVehiclePosition("device-123")).rejects.toThrow(
        "No status info available",
      );
    });

    it("should cache position for 30 seconds", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [
            {
              device: { id: "d1" },
              latitude: 40.7,
              longitude: -74,
              speed: 40,
              bearing: 180,
              dateTime: "2024-03-11T12:00:00Z",
            },
          ],
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.getVehiclePosition("device-123");
      await client.getVehiclePosition("device-123");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getVehicleDiagnostics", () => {
    it("should fetch fault codes and engine status", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();

      // Mock FaultData response
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [
            {
              device: { id: "d1" },
              id: "fault-1",
              code: "P0101",
              description: "Mass air flow sensor circuit",
              dateTime: "2024-03-10T12:00:00Z",
            },
          ],
          id: 1,
        }),
      });

      // Mock StatusData response
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [
            {
              device: { id: "d1" },
              diagnostic: { id: "EngineRunning", name: "Engine Running" },
              value: 1,
              dateTime: "2024-03-11T12:00:00Z",
            },
          ],
          id: 1,
        }),
      });

      global.fetch = fetchSpy;

      const diagnostics = await client.getVehicleDiagnostics("device-123");

      expect(diagnostics).toMatchObject({
        externalVehicleId: "device-123",
        engineRunning: true,
        faultCodes: expect.arrayContaining([
          expect.objectContaining({
            code: "P0101",
            description: "Mass air flow sensor circuit",
          }),
        ]),
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("should cache diagnostics for 5 minutes", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn();

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [],
          id: 1,
        }),
      });

      global.fetch = fetchSpy;

      await client.getVehicleDiagnostics("device-123");
      await client.getVehicleDiagnostics("device-123");

      expect(fetchSpy).toHaveBeenCalledTimes(2); // Only FaultData + StatusData on first call, then all cached
    });
  });

  describe("getDriverBehaviorEvents", () => {
    it("should fetch exception events", async () => {
      const client = createTestClient();
      const mockEvents = [
        {
          id: "event-123",
          device: { id: "device-123" },
          driver: { id: "driver-456" },
          type: "Speeding",
          exceptionType: "Over Speed",
          severity: "Warning",
          latitude: 40.7128,
          longitude: -74.006,
          speed: 60, // kmh
          speedZone: { postedSpeed: 50 },
          dateTime: "2024-03-11T12:00:00Z",
          activeFrom: "2024-03-11T12:00:00Z",
          activeTo: "2024-03-11T12:01:00Z",
        },
      ];

      global.fetch = mockFetch(mockEvents);

      const events = await client.getDriverBehaviorEvents("driver-456", {
        startDate: new Date("2024-03-11T00:00:00Z"),
        endDate: new Date("2024-03-11T23:59:59Z"),
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        externalEventId: "event-123",
        eventType: "speeding",
        severity: "warning",
      });
    });

    it("should use Get method with ExceptionEvent typeName", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [],
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.getDriverBehaviorEvents("driver-456", {
        startDate: new Date(),
        endDate: new Date(),
      });

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);
      expect(body.method).toBe("Get");
      expect(body.params.typeName).toBe("ExceptionEvent");
    });
  });

  describe("getFuelLevel", () => {
    it("should fetch fuel level from StatusData", async () => {
      const client = createTestClient();
      const mockFuel = [
        {
          device: { id: "device-123" },
          diagnostic: { id: "FuelLevel", name: "Fuel Level" },
          value: 65,
          dateTime: "2024-03-11T12:00:00Z",
        },
      ];

      global.fetch = mockFetch(mockFuel);

      const fuel = await client.getFuelLevel("device-123");

      expect(fuel).toMatchObject({
        externalVehicleId: "device-123",
        fuelLevel: 65,
        fuelUnit: "liters",
      });
    });

    it("should throw when no fuel data available", async () => {
      const client = createTestClient();
      global.fetch = mockFetch([]);

      await expect(client.getFuelLevel("device-123")).rejects.toThrow(
        "No fuel level data available",
      );
    });

    it("should cache fuel for 2 minutes", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [
            {
              device: { id: "d1" },
              diagnostic: { id: "FuelLevel" },
              value: 65,
              dateTime: "2024-03-11T12:00:00Z",
            },
          ],
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.getFuelLevel("device-123");
      await client.getFuelLevel("device-123");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribeToEvents", () => {
    it("should return subscription for polling-based events", async () => {
      const client = createTestClient();

      const subscription = await client.subscribeToEvents(
        "https://example.com/webhook",
        ["position", "diagnostic"],
      );

      expect(subscription).toMatchObject({
        webhookId: expect.any(String),
        url: "https://example.com/webhook",
        events: expect.arrayContaining(["position", "diagnostic"]),
      });
    });
  });

  describe("unsubscribeFromEvents", () => {
    it("should be a no-op for polling-based subscriptions", async () => {
      const client = createTestClient();

      await expect(
        client.unsubscribeFromEvents("webhook-123"),
      ).resolves.not.toThrow();
    });
  });

  describe("healthCheck", () => {
    it("should return true when authenticated", async () => {
      const client = createTestClient({
        credentials: { database: "test-db", userName: "test-user", password: "test-password" },
      });
      global.fetch = mockFetch({
        sessionId: "test-session",
      });

      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });

    it("should return false when authentication fails", async () => {
      const client = createTestClient({
        credentials: { database: "test-db", userName: "test-user", password: "test-password" },
      });
      global.fetch = mockFetch(null, {
        code: 401,
        message: "Invalid credentials",
      });

      const healthy = await client.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe("JSONRPC Error Handling", () => {
    it("should handle JSONRPC errors", async () => {
      const client = createTestClient();
      global.fetch = mockFetch(null, {
        code: 401,
        message: "Invalid session",
      });

      await expect(client.getVehicles()).rejects.toThrow(
        "Invalid session",
      );
    });

    it("should handle HTTP errors", async () => {
      const client = createTestClient();
      global.fetch = mockFetch(
        null,
        { code: 500, message: "Internal server error" },
        500,
      );

      await expect(client.getVehicles()).rejects.toThrow();
    });
  });

  describe("Session Management", () => {
    it("should include session ID in credentials", async () => {
      const client = createTestClient({
        credentials: { database: "test-db", userName: "test-user", password: "test-password" },
      });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: { sessionId: "new-session-id" },
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.authenticate();

      // Next call should use session ID
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [],
          id: 2,
        }),
      });

      await client.getVehicles();

      const call = fetchSpy.mock.calls[1];
      const body = JSON.parse(call[1].body as string);
      expect(body.params.credentials.sessionId).toBe("new-session-id");
    });
  });

  describe("Request Formatting", () => {
    it("should format requests as JSONRPC 2.0", async () => {
      const client = createTestClient();
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [],
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.getVehicles();

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1].body as string);

      expect(body).toMatchObject({
        jsonrpc: "2.0",
        method: "Get",
        id: expect.any(Number),
      });

      expect(body.params).toBeDefined();
      expect(body.params.credentials).toBeDefined();
    });

    it("should include URL session ID parameter", async () => {
      const client = createTestClient({
        credentials: { database: "test-db", userName: "test-user", password: "test-password" },
      });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: { sessionId: "new-session-id" },
          id: 1,
        }),
      });
      global.fetch = fetchSpy;

      await client.authenticate();
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          result: [],
          id: 2,
        }),
      });

      await client.getVehicles();

      const call = fetchSpy.mock.calls[1];
      expect(call[0]).toContain("sessionId=");
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limit", async () => {
      const client = createTestClient({ rateLimit: 1 });
      const startTime = Date.now();

      global.fetch = mockFetch([]);

      // First request — goes through rate limiter
      await client.getVehicles();
      client.clearCache();
      // Second request — should be throttled (rate limit = 1 per second)
      await client.getVehicles();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(500);
    });
  });
});
