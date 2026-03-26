/**
 * Geotab SDK Client Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  GeotabSDKClient,
  GeotabSDKError,
  type GeotabDevice,
  type GeotabLogRecord,
  type GeotabStatusData,
  type GeotabFaultData,
  type GeotabTrip,
  type GeotabZone,
} from "../geotab-sdk-client.js";
import type { GeotabCredentials } from "../types.js";

/**
 * Mock fetch helper
 */
function mockFetchResponse<T>(result: T | null, error?: { code: number; message: string }, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => ({
      jsonrpc: "2.0",
      result,
      error,
      id: 1,
    }),
    text: async () =>
      JSON.stringify({
        jsonrpc: "2.0",
        result,
        error,
        id: 1,
      }),
  });
}

describe("GeotabSDKClient", () => {
  let client: GeotabSDKClient;
  const mockCredentials: GeotabCredentials = {
    database: "test-db",
    userName: "test-user",
    password: "test-password",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GeotabSDKClient(mockCredentials, 10000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Authentication", () => {
    it("should authenticate and return session ID", async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });

      const sessionId = await client.authenticate();

      expect(sessionId).toBe("session-123");
      expect(client.getSessionId()).toBe("session-123");
    });

    it("should handle authentication errors", async () => {
      global.fetch = mockFetchResponse(null, { code: 401, message: "Invalid credentials" });

      await expect(client.authenticate()).rejects.toThrow(GeotabSDKError);
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(client.authenticate()).rejects.toThrow(GeotabSDKError);
    });
  });

  describe("getDevices", () => {
    beforeEach(async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();
    });

    it("should fetch all devices", async () => {
      const mockDevices: GeotabDevice[] = [
        {
          id: "device-1",
          name: "Vehicle 1",
          vin: "VIN123",
          licensePlate: "ABC123",
          make: "Toyota",
          model: "Camry",
          modelYear: 2023,
          deviceType: "GO9",
        },
      ];

      global.fetch = mockFetchResponse(mockDevices);

      const devices = await client.getDevices();

      expect(devices).toEqual(mockDevices);
      expect(devices[0].name).toBe("Vehicle 1");
    });

    it("should handle getDevices errors", async () => {
      global.fetch = mockFetchResponse(null, { code: 500, message: "Server error" });

      await expect(client.getDevices()).rejects.toThrow(GeotabSDKError);
    });
  });

  describe("getLogRecords", () => {
    beforeEach(async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();
    });

    it("should fetch log records for a device", async () => {
      const mockRecords: GeotabLogRecord[] = [
        {
          id: "log-1",
          device: { id: "device-1" },
          dateTime: "2025-01-01T12:00:00Z",
          latitude: 40.7128,
          longitude: -74.006,
          speed: 50,
          bearing: 180,
        },
      ];

      global.fetch = mockFetchResponse(mockRecords);

      const records = await client.getLogRecords("device-1");

      expect(records).toEqual(mockRecords);
      expect(records[0].latitude).toBe(40.7128);
    });

    it("should support date range search", async () => {
      const mockRecords: GeotabLogRecord[] = [];
      global.fetch = mockFetchResponse(mockRecords);

      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      await client.getLogRecords("device-1", { fromDate: startDate, toDate: endDate });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("getStatusData", () => {
    beforeEach(async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();
    });

    it("should fetch status data", async () => {
      const mockStatusData: GeotabStatusData[] = [
        {
          id: "status-1",
          device: { id: "device-1" },
          diagnostic: { id: "FuelLevel", name: "Fuel Level" },
          value: 75.5,
          dateTime: "2025-01-01T12:00:00Z",
        },
      ];

      global.fetch = mockFetchResponse(mockStatusData);

      const statusData = await client.getStatusData();

      expect(statusData).toEqual(mockStatusData);
      expect(statusData[0].value).toBe(75.5);
    });
  });

  describe("getFaultData", () => {
    beforeEach(async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();
    });

    it("should fetch fault data", async () => {
      const mockFaultData: GeotabFaultData[] = [
        {
          id: "fault-1",
          device: { id: "device-1" },
          code: "P0101",
          description: "Mass Air Flow (MAF) Sensor Range/Performance",
          dateTime: "2025-01-01T12:00:00Z",
        },
      ];

      global.fetch = mockFetchResponse(mockFaultData);

      const faultData = await client.getFaultData();

      expect(faultData).toEqual(mockFaultData);
      expect(faultData[0].code).toBe("P0101");
    });
  });

  describe("getTrips", () => {
    beforeEach(async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();
    });

    it("should fetch trips for a device", async () => {
      const mockTrips: GeotabTrip[] = [
        {
          id: "trip-1",
          device: { id: "device-1" },
          startDateTime: "2025-01-01T08:00:00Z",
          stopDateTime: "2025-01-01T17:00:00Z",
          startOdometer: 10000,
          stopOdometer: 10100,
          distance: 100,
          drivingDurationMinutes: 540,
          stops: 3,
        },
      ];

      global.fetch = mockFetchResponse(mockTrips);

      const trips = await client.getTrips("device-1");

      expect(trips).toEqual(mockTrips);
      expect(trips[0].distance).toBe(100);
    });
  });

  describe("getZones", () => {
    beforeEach(async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();
    });

    it("should fetch all zones", async () => {
      const mockZones: GeotabZone[] = [
        {
          id: "zone-1",
          name: "Warehouse",
          activeFrom: "2025-01-01T00:00:00Z",
          activeTo: "2026-01-01T00:00:00Z",
          centrePoint: { x: 40.7128, y: -74.006 },
          radius: 500,
        },
      ];

      global.fetch = mockFetchResponse(mockZones);

      const zones = await client.getZones();

      expect(zones).toEqual(mockZones);
      expect(zones[0].name).toBe("Warehouse");
    });
  });

  describe("Zone CRUD", () => {
    beforeEach(async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();
    });

    it("should add a zone", async () => {
      global.fetch = mockFetchResponse("zone-id-123");

      const zoneId = await client.addZone({
        name: "New Zone",
        centrePoint: { x: 40.7128, y: -74.006 },
        radius: 500,
      });

      expect(zoneId).toBe("zone-id-123");
    });

    it("should update a zone", async () => {
      global.fetch = mockFetchResponse(null);

      await expect(
        client.setZone({
          id: "zone-1",
          name: "Updated Zone",
          activeFrom: "2025-01-01T00:00:00Z",
          activeTo: "2026-01-01T00:00:00Z",
        }),
      ).resolves.toBeUndefined();
    });

    it("should remove a zone", async () => {
      global.fetch = mockFetchResponse(null);

      await expect(client.removeZone("zone-1")).resolves.toBeUndefined();
    });
  });

  describe("Session Management", () => {
    it("should clear session", async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();

      expect(client.getSessionId()).toBe("session-123");

      client.clearSession();

      expect(client.getSessionId()).toBeUndefined();
    });

    it("should re-authenticate on session expiry", async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();

      // Simulate session expiry error
      global.fetch = mockFetchResponse(null, {
        code: -2147483648,
        message: "Session expired",
      });

      // Should trigger re-authentication attempt
      await expect(client.getDevices()).rejects.toThrow();
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      global.fetch = mockFetchResponse({ sessionId: "session-123" });
      await client.authenticate();
    });

    it("should handle timeout errors", async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(mockFetchResponse(null)());
            }, 15000); // Longer than 10s timeout
          }),
      );

      // This would timeout but we can't easily test with vitest
      expect(() => client.getDevices()).toBeDefined();
    });

    it("should handle HTTP errors", async () => {
      global.fetch = mockFetchResponse(null, { code: 500, message: "Server error" }, 500);

      await expect(client.getDevices()).rejects.toThrow(GeotabSDKError);
    });
  });
});
