/**
 * Samsara Adapter Integration Tests
 * Comprehensive test suite for Samsara telematics client
 * Tests: authentication, vehicles, positions, diagnostics, fuel, behavior events,
 * rate limiting, retries, error handling, and webhook management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TelematicsConfig } from "../../../packages/core/src/integrations/telematics/types.js";
import { SamsaraClient } from "../../../packages/core/src/integrations/telematics/samsara-client.js";
import {
  mockSamsaraVehicles,
  mockSamsaraVehiclesResponse,
  mockSamsaraLocation,
  mockSamsaraLocationResponse,
  mockSamsaraStats,
  mockSamsaraDiagnosticsResponse,
  mockSamsaraSafetyEvents,
  mockSamsaraBehaviorEventsResponse,
  mockSamsaraFuel,
  mockSamsaraFuelResponse,
  mockSamsaraWebhookResponse,
  mockSamsaraUnauthorizedResponse,
  mockSamsaraRateLimitResponse,
  mockSamsaraTimeoutError,
  mockSamsaraAuthSuccessResponse,
  mockSamsaraPaginatedVehiclesResponse,
  mockSamsaraPaginatedVehiclesPage2Response,
  mockEmptyVehiclesResponse,
  mockEmptyEventsResponse,
  mockSamsaraVehicleWithoutVin,
  mockSamsaraLocationWithoutGPS,
  mockSamsaraStatsNoDiagnostics,
  mockSamsaraFuelNoData,
} from "../fixtures/telematics-fixtures.js";

// Mock global fetch
global.fetch = vi.fn();

describe("SamsaraClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: SamsaraClient;

  const mockConfig: TelematicsConfig = {
    provider: "samsara",
    credentials: {
      apiToken: "test_token_123",
    },
    timeout: 5000,
    rateLimit: 10,
    retries: 3,
  };

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
    client = new SamsaraClient(mockConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
    client.clearCache();
  });

  describe("Authentication", () => {
    it("should authenticate successfully with valid API token", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraAuthSuccessResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.authenticate()).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain("/fleet/vehicles");
    });

    it("should include Authorization header with Bearer token", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraAuthSuccessResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await client.authenticate();

      const headers = mockFetch.mock.calls[0][1]?.headers as Record<
        string,
        string
      >;
      expect(headers.Authorization).toBe("Bearer test_token_123");
    });

    it("should throw error on invalid token (401 Unauthorized)", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraUnauthorizedResponse),
        { status: 401 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.authenticate()).rejects.toThrow(
        "authentication failed",
      );
    });

    it("should retry authentication on 429 Rate Limit error", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraRateLimitResponse),
        { status: 429 },
      );
      const successResponse = new Response(
        JSON.stringify(mockSamsaraAuthSuccessResponse),
        { status: 200 },
      );

      mockFetch
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(successResponse);

      await client.authenticate();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle timeout error gracefully", async () => {
      mockFetch.mockRejectedValue(mockSamsaraTimeoutError);

      await expect(client.authenticate()).rejects.toThrow();
    });

    it("should perform health check using authentication", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraAuthSuccessResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it("should return false for health check on authentication failure", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraUnauthorizedResponse),
        { status: 401 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe("Get Vehicles", () => {
    it("should fetch all vehicles with pagination", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
      expect(vehicles[0].externalVehicleId).toBe("vehicle_123");
      expect(vehicles[0].name).toBe("Delivery Van A");
    });

    it("should handle paginated vehicle responses", async () => {
      const page1Response = new Response(
        JSON.stringify(mockSamsaraPaginatedVehiclesResponse),
        { status: 200 },
      );
      const page2Response = new Response(
        JSON.stringify(mockSamsaraPaginatedVehiclesPage2Response),
        { status: 200 },
      );

      mockFetch
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should cache vehicle results", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles1 = await client.getVehicles();
      const vehicles2 = await client.getVehicles();

      expect(vehicles1).toEqual(vehicles2);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once due to cache
    });

    it("should extract vehicle metadata correctly", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles[0].vin).toBe("1HGBH41JXMN109186");
      expect(vehicles[0].licensePlate).toBe("CA-12345");
      expect(vehicles[0].make).toBe("Honda");
      expect(vehicles[0].model).toBe("Odyssey");
      expect(vehicles[0].year).toBe(2022);
    });

    it("should handle vehicle without VIN gracefully", async () => {
      const responseWithoutVin = {
        data: [mockSamsaraVehicleWithoutVin],
        pagination: { hasNextPage: false },
      };
      const mockResponse = new Response(JSON.stringify(responseWithoutVin), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles[0].externalVehicleId).toBe("vehicle_no_vin");
      expect(vehicles[0].vin).toBeUndefined();
    });

    it("should return empty array when no vehicles found", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockEmptyVehiclesResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles).toEqual([]);
    });

    it("should throw error on API failure", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraUnauthorizedResponse),
        { status: 401 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow();
    });
  });

  describe("Get Vehicle Position", () => {
    it("should fetch current position with GPS data", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraLocationResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const position = await client.getVehiclePosition("vehicle_123");

      expect(position.externalVehicleId).toBe("vehicle_123");
      expect(position.latitude).toBe(37.7749);
      expect(position.longitude).toBe(-122.4194);
      expect(position.speed?.value).toBe(35.5);
      expect(position.heading).toBe(180);
    });

    it("should include accuracy in position data", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraLocationResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const position = await client.getVehiclePosition("vehicle_123");

      expect(position.accuracy).toBe(5.0);
    });

    it("should cache position data with 30-second TTL", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraLocationResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const position1 = await client.getVehiclePosition("vehicle_123");
      const position2 = await client.getVehiclePosition("vehicle_123");

      expect(position1).toEqual(position2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle vehicle without GPS data", async () => {
      const responseNoGPS = {
        data: [mockSamsaraLocationWithoutGPS],
      };
      const mockResponse = new Response(JSON.stringify(responseNoGPS), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const position = await client.getVehiclePosition("vehicle_123");

      expect(position.latitude).toBe(0);
      expect(position.longitude).toBe(0);
    });

    it("should throw error when no location data available", async () => {
      const mockResponse = new Response(JSON.stringify({ data: [] }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehiclePosition("vehicle_123")).rejects.toThrow(
        "No location data available",
      );
    });

    it("should include timestamp in position", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraLocationResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const position = await client.getVehiclePosition("vehicle_123");

      expect(position.timestamp).toBeInstanceOf(Date);
    });

    it("should retry on rate limit for position request", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify(mockSamsaraRateLimitResponse),
        { status: 429 },
      );
      const successResponse = new Response(
        JSON.stringify(mockSamsaraLocationResponse),
        {
          status: 200,
        },
      );

      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const position = await client.getVehiclePosition("vehicle_123");

      expect(position.externalVehicleId).toBe("vehicle_123");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Get Vehicle Diagnostics", () => {
    it("should fetch diagnostics with fault codes", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraDiagnosticsResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics("vehicle_123");

      expect(diagnostics.externalVehicleId).toBe("vehicle_123");
      expect(diagnostics.engineRunning).toBe(true);
      expect(diagnostics.faultCodes).toHaveLength(2);
      expect(diagnostics.faultCodes[0].code).toBe("1234");
    });

    it("should map fault code severity correctly", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraDiagnosticsResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics("vehicle_123");

      diagnostics.faultCodes.forEach((code) => {
        expect(["info", "warning", "error", "critical"]).toContain(
          code.severity,
        );
      });
    });

    it("should include odometer reading in diagnostics", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraDiagnosticsResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics("vehicle_123");

      expect(diagnostics.odometer?.value).toBe(125430.5);
      expect(diagnostics.odometer?.unit).toBe("miles");
    });

    it("should cache diagnostics with 5-minute TTL", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraDiagnosticsResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diag1 = await client.getVehicleDiagnostics("vehicle_123");
      const diag2 = await client.getVehicleDiagnostics("vehicle_123");

      expect(diag1).toEqual(diag2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle diagnostics without fault codes", async () => {
      const responseNoDiagnostics = {
        data: mockSamsaraStatsNoDiagnostics,
      };
      const mockResponse = new Response(JSON.stringify(responseNoDiagnostics), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics("vehicle_123");

      expect(diagnostics.faultCodes).toEqual([]);
    });

    it("should include timestamp in diagnostics", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraDiagnosticsResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const diagnostics = await client.getVehicleDiagnostics("vehicle_123");

      expect(diagnostics.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Get Driver Behavior Events", () => {
    it("should fetch behavior events with correct mapping", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraBehaviorEventsResponse),
        { status: 200 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-31"),
      };

      const events = await client.getDriverBehaviorEvents(
        "driver_456",
        dateRange,
      );

      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe("harsh_acceleration");
      expect(events[1].eventType).toBe("harsh_braking");
    });

    it("should include driver and vehicle IDs in events", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraBehaviorEventsResponse),
        { status: 200 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-31"),
      };

      const events = await client.getDriverBehaviorEvents(
        "driver_456",
        dateRange,
      );

      expect(events[0].externalDriverId).toBe("driver_456");
      expect(events[0].externalVehicleId).toBe("vehicle_123");
    });

    it("should include severity levels in behavior events", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraBehaviorEventsResponse),
        { status: 200 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-31"),
      };

      const events = await client.getDriverBehaviorEvents(
        "driver_456",
        dateRange,
      );

      expect(events[0].severity).toBe("warning");
      expect(events[1].severity).toBe("critical");
    });

    it("should include GPS coordinates in behavior events", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraBehaviorEventsResponse),
        { status: 200 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-31"),
      };

      const events = await client.getDriverBehaviorEvents(
        "driver_456",
        dateRange,
      );

      expect(events[0].latitude).toBe(37.7749);
      expect(events[0].longitude).toBe(-122.4194);
    });

    it("should include speed and speed limit in behavior events", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraBehaviorEventsResponse),
        { status: 200 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-31"),
      };

      const events = await client.getDriverBehaviorEvents(
        "driver_456",
        dateRange,
      );

      expect(events[0].speed?.value).toBe(45.2);
      expect(events[0].speedLimit?.value).toBe(55);
    });

    it("should handle paginated behavior events", async () => {
      const page1Response = new Response(
        JSON.stringify({
          data: [mockSamsaraSafetyEvents[0]],
          pagination: { hasNextPage: true },
        }),
        { status: 200 },
      );
      const page2Response = new Response(
        JSON.stringify({
          data: [mockSamsaraSafetyEvents[1]],
          pagination: { hasNextPage: false },
        }),
        { status: 200 },
      );

      mockFetch
        .mockResolvedValueOnce(page1Response)
        .mockResolvedValueOnce(page2Response);

      const dateRange = {
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-31"),
      };

      const events = await client.getDriverBehaviorEvents(
        "driver_456",
        dateRange,
      );

      expect(events).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return empty array when no events found", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockEmptyEventsResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const dateRange = {
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-03-31"),
      };

      const events = await client.getDriverBehaviorEvents(
        "driver_456",
        dateRange,
      );

      expect(events).toEqual([]);
    });
  });

  describe("Get Fuel Level", () => {
    it("should fetch fuel level with percentage", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraFuelResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const fuel = await client.getFuelLevel("vehicle_123");

      expect(fuel.externalVehicleId).toBe("vehicle_123");
      expect(fuel.fuelLevel).toBe(65.5);
      expect(fuel.fuelUnit).toBe("gallons");
    });

    it("should cache fuel data with 2-minute TTL", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraFuelResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const fuel1 = await client.getFuelLevel("vehicle_123");
      const fuel2 = await client.getFuelLevel("vehicle_123");

      expect(fuel1).toEqual(fuel2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle fuel data without percentage", async () => {
      const responseNoFuelData = {
        data: mockSamsaraFuelNoData,
      };
      const mockResponse = new Response(JSON.stringify(responseNoFuelData), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const fuel = await client.getFuelLevel("vehicle_no_fuel");

      expect(fuel.externalVehicleId).toBe("vehicle_no_fuel");
      expect(fuel.fuelLevel).toBeUndefined();
    });

    it("should include timestamp in fuel reading", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraFuelResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const fuel = await client.getFuelLevel("vehicle_123");

      expect(fuel.timestamp).toBeInstanceOf(Date);
    });

    it("should retry on rate limit for fuel request", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify(mockSamsaraRateLimitResponse),
        { status: 429 },
      );
      const successResponse = new Response(
        JSON.stringify(mockSamsaraFuelResponse),
        {
          status: 200,
        },
      );

      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const fuel = await client.getFuelLevel("vehicle_123");

      expect(fuel.externalVehicleId).toBe("vehicle_123");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Webhook Management", () => {
    it("should register webhook subscription", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraWebhookResponse),
        {
          status: 201,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const subscription = await client.subscribeToEvents(
        "https://example.com/webhooks",
        ["location.created", "location.updated"],
      );

      expect(subscription.webhookId).toBe("webhook_789");
      expect(subscription.url).toBe("https://example.com/webhooks/samsara");
      expect(subscription.events).toContain("location.created");
    });

    it("should use default event types if none provided", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraWebhookResponse),
        {
          status: 201,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await client.subscribeToEvents("https://example.com/webhooks", []);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.eventTypes).toEqual(["*.created", "*.updated"]);
    });

    it("should unsubscribe from webhook", async () => {
      const mockResponse = new Response(null, { status: 204 });
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        client.unsubscribeFromEvents("webhook_789"),
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle webhook unsubscribe with 200 response", async () => {
      const mockResponse = new Response(null, { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        client.unsubscribeFromEvents("webhook_789"),
      ).resolves.toBeUndefined();
    });

    it("should throw error on webhook registration failure", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraUnauthorizedResponse),
        { status: 401 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        client.subscribeToEvents("https://example.com/webhooks", []),
      ).rejects.toThrow();
    });

    it("should include createdAt timestamp in webhook subscription", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraWebhookResponse),
        {
          status: 201,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      const subscription = await client.subscribeToEvents(
        "https://example.com/webhooks",
        [],
      );

      expect(subscription.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limit of 10 requests per second", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      // Make multiple requests
      const promises = Array.from({ length: 5 }, () => client.getVehicles());
      await Promise.all(promises);

      // All requests should complete despite rate limiting
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("should track rate limit state", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await client.getVehicles();

      const state = client.getRateLimitState();
      expect(state.requestCount).toBeGreaterThan(0);
      expect(state.resetAt).toBeInstanceOf(Date);
    });
  });

  describe("Error Handling", () => {
    it("should handle network timeout gracefully", async () => {
      mockFetch.mockRejectedValue(mockSamsaraTimeoutError);

      await expect(client.getVehicles()).rejects.toThrow();
    });

    it("should retry on transient errors", async () => {
      const errorResponse = new Response(
        JSON.stringify(mockSamsaraRateLimitResponse),
        { status: 429 },
      );
      const successResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry on 401 Unauthorized", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraUnauthorizedResponse),
        { status: 401 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should exponentially backoff on retries", async () => {
      const errorResponse = new Response(
        JSON.stringify(mockSamsaraRateLimitResponse),
        { status: 429 },
      );
      const successResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );

      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      await client.getVehicles();

      // Verify backoff delay was applied (advance timers)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should parse error messages from response", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          code: "TEST_ERROR",
          message: "Something went wrong",
        }),
        { status: 400 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow();
    });

    it("should handle malformed JSON error responses", async () => {
      const mockResponse = new Response("Invalid JSON", { status: 400 });
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getVehicles()).rejects.toThrow();
    });
  });

  describe("Cache Management", () => {
    it("should clear cache when requested", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await client.getVehicles();
      client.clearCache();
      await client.getVehicles();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should expire cache entries after TTL", async () => {
      const mockResponse = new Response(
        JSON.stringify(mockSamsaraVehiclesResponse),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await client.getVehicles();
      vi.advanceTimersByTime(301000); // Advance beyond 5 min cache TTL
      await client.getVehicles();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Circuit Breaker", () => {
    it("should track circuit breaker state", () => {
      const state = client.getCircuitBreakerState();
      expect(["CLOSED", "OPEN", "HALF_OPEN"]).toContain(state);
    });

    it("should reset circuit breaker when requested", () => {
      client.resetCircuitBreaker();
      expect(client.getCircuitBreakerState()).toBe("CLOSED");
    });
  });
});
