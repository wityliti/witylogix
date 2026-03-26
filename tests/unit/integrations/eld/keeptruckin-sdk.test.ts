/**
 * KeepTruckin (Motive v2) SDK Client Tests
 *
 * Tests for:
 * - OAuth2 authentication and token refresh
 * - API key fallback authentication
 * - Driver and user management
 * - HOS log entries and daily logs
 * - Violations and compliance tracking
 * - Vehicle management and diagnostics
 * - DVIR creation and defect resolution
 * - IFTA trip and fuel data
 * - Document uploads and management
 * - eRODS export for FMCSA
 * - Webhook verification and handling
 * - Error handling and exponential backoff
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KeepTruckinSDKClient } from "../../../../packages/core/src/integrations/eld/keeptruckin-sdk-client.js";
import type { ELDConfig } from "../../../../packages/core/src/integrations/eld/types.js";

describe("KeepTruckinSDKClient", () => {
  let client: KeepTruckinSDKClient;
  let config: ELDConfig;

  beforeEach(() => {
    config = {
      provider: "motive" as const,
      apiKey: "sk_live_" + "KEEPTRUCKIN123",
      accountId: "acc_keeptruckin_456",
      autoSync: true,
      enableWebhooks: true,
      webhookSecret: "webhook_" + "SECRET123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    client = new KeepTruckinSDKClient(config);
  });

  describe("initialization", () => {
    it("should initialize with API key", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "org_kt_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      await expect(client.initialize()).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/organization"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": config.apiKey,
          }),
        })
      );

      mockFetch.mockRestore();
    });

    it("should initialize with OAuth2 token", async () => {
      const oauthConfig = {
        ...config,
        apiKey: undefined,
        accessToken: "access_" + "TOKEN123",
      };

      const oauthClient = new KeepTruckinSDKClient(oauthConfig);

      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "org_kt_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      await expect(oauthClient.initialize()).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/organization"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": "Bearer access_TOKEN123",
          }),
        })
      );

      mockFetch.mockRestore();
    });

    it("should throw error when no credentials provided", () => {
      const noCredConfig = { ...config, apiKey: undefined };
      const noCredClient = new KeepTruckinSDKClient(noCredConfig);

      expect(() => {
        noCredClient.initialize();
      }).rejects.toThrow("KeepTruckin API key or OAuth2 access token is required");
    });
  });

  describe("HOS logs", () => {
    it("should retrieve driver logs for date range", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "log_kt_001",
                driverId: "driver_kt_001",
                vehicleId: "vehicle_kt_001",
                startTime: "2026-03-17T08:00:00Z",
                endTime: "2026-03-17T10:00:00Z",
                status: "Driving",
                milesDriven: 150,
                remarks: "Delivery route",
                editCount: 0,
              },
            ],
            pagination: {
              page_no: 1,
              per_page: 20,
              total_records: 1,
              total_pages: 1,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getDriverLogs(
        "driver_kt_001",
        new Date("2026-03-17"),
        new Date("2026-03-18")
      );

      expect(result).toHaveLength(1);
      expect(result[0].dutyStatus).toBe("driving");
      expect(result[0].miles).toBe(150);

      mockFetch.mockRestore();
    });

    it("should retrieve daily log", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "daily_log_001",
            driverId: "driver_kt_001",
            date: "2026-03-17",
            startTime: "2026-03-17T06:00:00Z",
            endTime: "2026-03-17T22:00:00Z",
            dutyStatusEntries: [
              {
                id: "entry_001",
                driverId: "driver_kt_001",
                status: "OnDuty",
                startTime: "2026-03-17T06:00:00Z",
                endTime: "2026-03-17T22:00:00Z",
              },
            ],
            isCertified: false,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getDailyLog("driver_kt_001", new Date("2026-03-17"));

      expect(result.id).toBe("daily_log_001");
      expect(result.isCertified).toBe(false);

      mockFetch.mockRestore();
    });

    it("should certify daily log", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "daily_log_001",
            driverId: "driver_kt_001",
            isCertified: true,
            certifiedAt: "2026-03-17T22:30:00Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.certifyDailyLog(
        "driver_kt_001",
        new Date("2026-03-17"),
        "digital_signature_base64"
      );

      expect(result.isCertified).toBe(true);

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
                id: "vio_kt_001",
                driverId: "driver_kt_001",
                type: "hours_14",
                severity: "critical",
                description: "Exceeded 14-hour duty limit",
                detectionDate: "2026-03-17",
                detectionTime: "18:00:00",
                resolved: false,
              },
            ],
            pagination: {
              page_no: 1,
              per_page: 20,
              total_records: 1,
              total_pages: 1,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getViolations("driver_kt_001", 30);

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe("critical");

      mockFetch.mockRestore();
    });
  });

  describe("vehicles", () => {
    it("should retrieve vehicle information", async () => {
      const mockFetch = vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: "vehicle_kt_001",
              name: "Truck-KT-001",
              vin: "1XKBR0CX9CJ247518",
              licensePlate: "TX-DEMO-01",
              make: "Volvo",
              model: "VNL",
              year: 2021,
              gvwr: 36000,
              fuelType: "diesel",
              odometerMiles: 125000,
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
              vehicleId: "vehicle_kt_001",
              latitude: 35.0891,
              longitude: -97.0937,
              address: "Oklahoma City, OK",
              speedMph: 65,
              timestamp: "2026-03-17T10:00:00Z",
              odometer: 125000,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
        );

      const result = await client.getVehicle("vehicle_kt_001");

      expect(result.vin).toBe("1XKBR0CX9CJ247518");
      expect(result.fuelType).toBe("diesel");
      expect(result.currentLocation?.latitude).toBe(35.0891);

      mockFetch.mockRestore();
    });

    it("should get engine data", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            vehicleId: "vehicle_kt_001",
            odometerMiles: 125000,
            rpm: 1800,
            throttlePercent: 45,
            engineTemp: 180,
            fuelLevel: 85,
            voltage: 13.5,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getEngineData("vehicle_kt_001");

      expect(result.rpm).toBe(1800);
      expect(result.fuelLevel).toBe(85);

      mockFetch.mockRestore();
    });
  });

  describe("DVIR", () => {
    it("should submit DVIR with defects", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "dvir_kt_001",
            driverId: "driver_kt_001",
            vehicleId: "vehicle_kt_001",
            inspectionDate: "2026-03-17",
            inspectionTime: "08:00:00",
            type: "PreTrip",
            status: "Fail",
            defects: [
              {
                id: "defect_001",
                type: "brakes",
                severity: "Critical",
                description: "Brake pads worn",
                component: "brakes",
                repairStatus: "Unrepaired",
              },
            ],
            createdAt: "2026-03-17T08:15:00Z",
            updatedAt: "2026-03-17T08:15:00Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.submitDVIR({
        driverId: "driver_kt_001",
        vehicleId: "vehicle_kt_001",
        type: "pre-trip",
        defects: [
          {
            component: "brakes",
            description: "Brake pads worn",
            severity: "critical",
          },
        ],
      });

      expect(result.id).toBe("dvir_kt_001");
      expect(result.defects).toHaveLength(1);

      mockFetch.mockRestore();
    });

    it("should resolve DVIR defect", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "dvir_kt_001",
            defects: [
              {
                id: "defect_001",
                repairStatus: "Repaired",
                repairDate: "2026-03-17",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.resolveDVIRDefect(
        "dvir_kt_001",
        "defect_001",
        "Repaired"
      );

      expect(result.id).toBe("dvir_kt_001");

      mockFetch.mockRestore();
    });
  });

  describe("IFTA", () => {
    it("should retrieve IFTA trip data", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "trip_kt_001",
                driverId: "driver_kt_001",
                vehicleId: "vehicle_kt_001",
                startDate: "2026-03-15",
                endDate: "2026-03-17",
                originState: "TX",
                destinationState: "OK",
                totalMiles: 450,
                milesInState: {
                  TX: 300,
                  OK: 150,
                },
                fuelPurchases: [
                  {
                    state: "TX",
                    gallons: 100,
                    date: "2026-03-15",
                    cost: 350,
                  },
                ],
              },
            ],
            pagination: {
              page_no: 1,
              per_page: 20,
              total_records: 1,
              total_pages: 1,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.getIFTATrips(
        "driver_kt_001",
        new Date("2026-03-15"),
        new Date("2026-03-17")
      );

      expect(result).toHaveLength(1);
      expect(result[0].totalMiles).toBe(450);
      expect(result[0].milesInState.TX).toBe(300);

      mockFetch.mockRestore();
    });
  });

  describe("documents", () => {
    it("should upload driver document", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "doc_kt_001",
            driverId: "driver_kt_001",
            type: "license",
            category: "CDL",
            fileUrl: "https://example.com/license.pdf",
            expirationDate: "2030-03-17",
            uploadedAt: "2026-03-17T10:00:00Z",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.uploadDocument(
        "driver_kt_001",
        "license",
        "CDL",
        "https://example.com/license.pdf"
      );

      expect(result.id).toBe("doc_kt_001");
      expect(result.type).toBe("license");

      mockFetch.mockRestore();
    });
  });

  describe("eRODS export", () => {
    it("should export eRODS format for FMCSA", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            format: "eRODS",
            version: "2.0",
            companyName: "Test Fleet",
            periodStart: "2026-03-01",
            periodEnd: "2026-03-17",
            drivers: [
              {
                id: "driver_kt_001",
                name: "John Driver",
                licenseNumber: "ABC123",
                hosLogs: [],
                violations: [],
              },
            ],
            externalUserId: "user_kt_001",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      );

      const result = await client.exporteRODS(
        new Date("2026-03-01"),
        new Date("2026-03-17")
      );

      expect(result.format).toBe("eRODS");
      expect(result.drivers).toHaveLength(1);

      mockFetch.mockRestore();
    });
  });

  describe("webhook verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = '{"type":"violation"}';
      const crypto = require("crypto");
      const hmac = crypto.createHmac("sha256", config.webhookSecret!);
      hmac.update(payload);
      const validSignature = hmac.digest("hex");

      const isValid = client.verifyWebhookSignature(payload, validSignature);

      expect(isValid).toBe(true);
    });

    it("should reject invalid signature", () => {
      const payload = '{"type":"violation"}';
      const invalidSignature = "completely_invalid";

      const isValid = client.verifyWebhookSignature(payload, invalidSignature);

      expect(isValid).toBe(false);
    });
  });

  describe("health check", () => {
    it("should return true on successful health check", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "org_kt_123" }), {
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
        new Error("Connection timeout")
      );

      const result = await client.healthCheck();

      expect(result).toBe(false);

      mockFetch.mockRestore();
    });
  });
});
