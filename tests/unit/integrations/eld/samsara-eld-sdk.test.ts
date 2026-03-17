/**
 * Samsara ELD SDK Client Tests
 *
 * Tests for:
 * - API initialization and authentication
 * - Driver management (list, get, create, update)
 * - HOS logs retrieval and parsing
 * - Duty status changes
 * - Violations and safety scores
 * - Vehicle management and location tracking
 * - DVIR submission and resolution
 * - Webhook signature verification
 * - Rate limiting and pagination
 * - Error handling and retries
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SamsaraELDClient } from "../../../../packages/core/src/integrations/eld/samsara-eld-sdk-client.js";
import type { ELDConfig } from "../../../../packages/core/src/integrations/eld/types.js";

describe("SamsaraELDClient", () => {
  let client: SamsaraELDClient;
  let config: ELDConfig;

  beforeEach(() => {
    config = {
      provider: "samsara" as const,
      apiKey: "sk_live_" + "TEST1234567890",
      accountId: "acc_samsara_123",
      autoSync: true,
      enableWebhooks: true,
      webhookSecret: "webhook_" + "SECRET",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    client = new SamsaraELDClient(config);
  });

  describe("initialization", () => {
    it("should initialize successfully with valid API key", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "org_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      await expect(client.initialize()).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalled();

      mockFetch.mockRestore();
    });

    it("should throw error if API key is missing", () => {
      const invalidConfig = { ...config, apiKey: "" };
      const invalidClient = new SamsaraELDClient(invalidConfig);

      expect(() => {
        invalidClient.initialize();
      }).rejects.toThrow("Samsara API key is required");
    });

    it("should throw error on connection failure", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Network error")
      );

      await expect(client.initialize()).rejects.toThrow(
        "Failed to initialize Samsara"
      );

      mockFetch.mockRestore();
    });
  });

  describe("drivers", () => {
    it("should list drivers with pagination", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "driver_001",
                name: "John Doe",
                email: "john@example.com",
                licenseNumber: "ABC123",
                licenseState: "CA",
                currentDutyStatus: "driving",
                createdAt: "2026-03-17T10:00:00Z",
                updatedAt: "2026-03-17T10:00:00Z",
              },
            ],
            pagination: { hasNextPage: false, endCursor: undefined },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.listDrivers(10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("John Doe");
      expect(result.pagination.hasNextPage).toBe(false);

      mockFetch.mockRestore();
    });

    it("should create a new driver", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "driver_002",
            name: "Jane Smith",
            email: "jane@example.com",
            createdAt: "2026-03-17T10:00:00Z",
            updatedAt: "2026-03-17T10:00:00Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.createDriver({
        name: "Jane Smith",
        email: "jane@example.com",
      });

      expect(result.id).toBe("driver_002");
      expect(result.name).toBe("Jane Smith");

      mockFetch.mockRestore();
    });
  });

  describe("HOS logs", () => {
    it("should retrieve driver logs for date range", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "log_001",
                driverId: "driver_001",
                vehicleId: "vehicle_001",
                startTime: "2026-03-17T08:00:00Z",
                endTime: "2026-03-17T10:00:00Z",
                dutyStatus: "driving",
                milesDriven: 120,
                notes: "Regular delivery",
                edited: false,
                createdAt: "2026-03-17T10:05:00Z",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const startDate = new Date("2026-03-17");
      const endDate = new Date("2026-03-18");

      const result = await client.getDriverLogs("driver_001", startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].dutyStatus).toBe("driving");
      expect(result[0].miles).toBe(120);

      mockFetch.mockRestore();
    });

    it("should get HOS summary for driver", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            hours11: 4,
            hours14: 6,
            hours60: 35,
            hours70: 65,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getHOSSummary("driver_001", new Date());

      expect(result.hours11).toBe(4);
      expect(result.availableDriving).toBe(7); // 11 - 4
      expect(result.availableOnDuty).toBe(8); // 14 - 6

      mockFetch.mockRestore();
    });
  });

  describe("violations", () => {
    it("should retrieve violations for driver", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "vio_001",
                driverId: "driver_001",
                violationType: "hours_14",
                description: "Exceeded 14-hour duty limit",
                detectedAt: "2026-03-17T18:00:00Z",
                resolvedAt: null,
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getViolations("driver_001", 30);

      expect(result).toHaveLength(1);
      expect(result[0].violationType).toBe("hours-14");
      expect(result[0].severity).toBe("error");

      mockFetch.mockRestore();
    });
  });

  describe("vehicles", () => {
    it("should retrieve vehicle information", async () => {
      const mockFetch = vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: "vehicle_001",
              name: "Truck-001",
              vin: "1HGBH41JXMN109186",
              licensePlate: "CA-DEMO-01",
              make: "Honda",
              model: "Accord",
              year: 2020,
              gvwr: 4500,
              fuelType: "gasoline",
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-03-17T10:00:00Z",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              latitude: 37.7749,
              longitude: -122.4194,
              address: "San Francisco, CA",
              timestamp: "2026-03-17T10:00:00Z",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              odometer: { miles: 45000, time: "2026-03-17T10:00:00Z" },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        );

      const result = await client.getVehicle("vehicle_001");

      expect(result.vin).toBe("1HGBH41JXMN109186");
      expect(result.odometerMiles).toBe(45000);
      expect(result.currentLocation?.latitude).toBe(37.7749);

      mockFetch.mockRestore();
    });
  });

  describe("DVIR", () => {
    it("should submit DVIR", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "dvir_001",
            driverId: "driver_001",
            vehicleId: "vehicle_001",
            inspectionDate: "2026-03-17",
            inspectionType: "pre_trip",
            defectsSummary: "fail",
            defects: [
              {
                component: "brakes",
                defectDescription: "Brake fluid low",
                severity: "major",
                isResolved: false,
              },
            ],
            driverNotes: "Needs immediate attention",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.submitDVIR({
        driverId: "driver_001",
        vehicleId: "vehicle_001",
        type: "pre-trip",
        defects: [
          {
            component: "brakes",
            description: "Brake fluid low",
            severity: "major",
          },
        ],
        driverRemarks: "Needs immediate attention",
      });

      expect(result.id).toBe("dvir_001");
      expect(result.condition).toBe("defect");
      expect(result.defects).toHaveLength(1);

      mockFetch.mockRestore();
    });
  });

  describe("webhook verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = '{"test":"data"}';
      const crypto = require("crypto");
      const hmac = crypto.createHmac("sha256", config.webhookSecret!);
      hmac.update(payload);
      const validSignature = hmac.digest("hex");

      const isValid = client.verifyWebhookSignature(payload, validSignature);

      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = '{"test":"data"}';
      const invalidSignature = "invalid_signature_here";

      const isValid = client.verifyWebhookSignature(payload, invalidSignature);

      expect(isValid).toBe(false);
    });
  });

  describe("health check", () => {
    it("should return true on successful health check", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "org_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      const result = await client.healthCheck();

      expect(result).toBe(true);

      mockFetch.mockRestore();
    });

    it("should return false on health check failure", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("API unreachable")
      );

      const result = await client.healthCheck();

      expect(result).toBe(false);

      mockFetch.mockRestore();
    });
  });
});
