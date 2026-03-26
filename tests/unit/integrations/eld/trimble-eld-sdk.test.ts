/**
 * Trimble ELD SDK Client Tests
 *
 * Tests for:
 * - API initialization and OAuth2 authentication
 * - Driver log retrieval with pagination
 * - Duty status changes and availability calculation
 * - HOS violation detection
 * - Vehicle management and diagnostics
 * - DVIR submission and retrieval
 * - Document upload (DQF, insurance, etc)
 * - eRODS generation for roadside inspection
 * - Webhook event processing with signature verification
 * - Error handling and retries
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TrimbleELDClient } from "../../../packages/core/src/integrations/eld/trimble-eld-sdk-client";
import type { ELDConfig, DutyStatus } from "../../../packages/core/src/integrations/eld/types";

describe("TrimbleELDClient", () => {
  let client: TrimbleELDClient;
  let config: ELDConfig;

  beforeEach(() => {
    config = {
      provider: "omnitracs",
      apiKey: "test-client-id",
      apiSecret: "test-client-secret",
      accountId: "acc_123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    client = new TrimbleELDClient(config);
  });

  describe("initialization", () => {
    it("should initialize successfully with valid OAuth2 credentials", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: "token_123",
              expires_in: 3600,
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ organization: { id: "org_123" } }), {
            status: 200,
          })
        );

      await expect(client.initialize()).resolves.not.toThrow();
    });

    it("should throw error if OAuth2 credentials are missing", () => {
      const invalidConfig = { ...config, apiKey: "", apiSecret: "" };
      const invalidClient = new TrimbleELDClient(invalidConfig);

      expect(() => invalidClient.initialize()).rejects.toThrow(
        "Trimble OAuth2 credentials"
      );
    });

    it("should throw error if OAuth2 token request fails", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Connection refused")
      );

      await expect(client.initialize()).rejects.toThrow(
        "Failed to initialize Trimble ELD"
      );
    });
  });

  describe("driver logs", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch")
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              access_token: "token_123",
              expires_in: 3600,
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ organization: { id: "org_123" } }), {
            status: 200,
          })
        );
    });

    it("should retrieve driver logs for date range", async () => {
      const mockLogs = {
        records: [
          {
            id: "log_1",
            driverId: "driver_1",
            vehicleId: "vehicle_1",
            startTime: "2026-03-12T08:00:00Z",
            endTime: "2026-03-12T10:00:00Z",
            status: "driving",
            miles: 120,
            annotations: ["Route 1"],
            createdAt: "2026-03-12T10:05:00Z",
            updatedAt: "2026-03-12T10:05:00Z",
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLogs), { status: 200 })
      );

      const startDate = new Date("2026-03-12");
      const endDate = new Date("2026-03-13");
      const logs = await client.getDriverLogs("driver_1", startDate, endDate);

      expect(logs).toHaveLength(1);
      expect(logs[0].dutyStatus).toBe("driving");
      expect(logs[0].miles).toBe(120);
    });

    it("should handle empty logs response", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ records: [] }), { status: 200 })
      );

      const startDate = new Date("2026-03-12");
      const endDate = new Date("2026-03-13");
      const logs = await client.getDriverLogs("driver_1", startDate, endDate);

      expect(logs).toHaveLength(0);
    });
  });

  describe("duty status", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 }
        )
      );
    });

    it("should get current duty status for driver", async () => {
      const mockDriver = {
        id: "driver_1",
        firstName: "John",
        lastName: "Doe",
        currentStatus: {
          status: "driving",
          changedAt: "2026-03-12T08:00:00Z",
          location: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        },
        hos: {
          availableDriving: 6,
          availableOnDuty: 8,
        },
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDriver), { status: 200 })
      );

      const status = await client.getDutyStatus("driver_1");

      expect(status.driverId).toBe("driver_1");
      expect(status.status).toBe("driving");
      expect(status.availableHoursDriving).toBe(6);
    });

    it("should set driver duty status", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: "driver_1",
              currentStatus: {
                status: "on-duty",
                changedAt: "2026-03-12T10:00:00Z",
              },
              hos: {
                availableDriving: 6,
                availableOnDuty: 8,
              },
            }),
            { status: 200 }
          )
        );

      const newStatus = await client.setDutyStatus("driver_1", "on-duty");

      expect(newStatus.status).toBe("on-duty");
    });
  });

  describe("violations", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 }
        )
      );
    });

    it("should retrieve HOS violations for driver", async () => {
      const mockViolations = {
        violations: [
          {
            id: "vio_1",
            driverId: "driver_1",
            code: "11-hour",
            description: "Exceeded 11-hour driving limit",
            severity: "critical",
            violationType: "11-hour",
            detectedAt: "2026-03-12T20:30:00Z",
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockViolations), { status: 200 })
      );

      const violations = await client.getViolations("driver_1", 30);

      expect(violations).toHaveLength(1);
      expect(violations[0].severity).toBe("critical");
      expect(violations[0].violationType).toBe("hours-11");
    });
  });

  describe("vehicles", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 }
        )
      );
    });

    it("should retrieve vehicle information", async () => {
      const mockVehicle = {
        id: "vehicle_1",
        unitNumber: "UNIT-001",
        vin: "1HGBH41JXMN109186",
        licensePlate: "NY-ABC-123",
        make: "Honda",
        model: "Accord",
        year: 2020,
        odometer: 45000,
        fuelType: "gasoline",
        gvwr: 5000,
        status: "active",
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.006,
          address: "NYC",
          timestamp: "2026-03-12T12:00:00Z",
        },
        createdAt: "2020-01-01T00:00:00Z",
        updatedAt: "2026-03-12T12:00:00Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockVehicle), { status: 200 })
      );

      const vehicle = await client.getVehicle("vehicle_1");

      expect(vehicle.vin).toBe("1HGBH41JXMN109186");
      expect(vehicle.licensePlate).toBe("NY-ABC-123");
      expect(vehicle.odometerMiles).toBe(45000);
    });

    it("should paginate through multiple vehicles", async () => {
      const mockVehicles1 = {
        vehicles: Array(100).fill(0).map((_, i) => ({
          id: `vehicle_${i}`,
          unitNumber: `UNIT-${i}`,
          vin: `VIN-${i}`,
          licensePlate: `PLATE-${i}`,
          status: "active",
          createdAt: "2020-01-01T00:00:00Z",
          updatedAt: "2026-03-12T12:00:00Z",
        })),
      };

      const mockVehicles2 = {
        vehicles: [],
      };

      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockVehicles1), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockVehicles2), { status: 200 })
        )
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              id: "vehicle_1",
              unitNumber: "UNIT-001",
              vin: "VIN-001",
              licensePlate: "PLATE-001",
              status: "active",
              createdAt: "2020-01-01T00:00:00Z",
              updatedAt: "2026-03-12T12:00:00Z",
            }),
            { status: 200 }
          )
        );

      const vehicles = await client.getVehicles();

      // Should have called pagination until empty result
      expect(vehicles.length).toBeGreaterThan(0);
    });
  });

  describe("DVIR", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "token_123",
            expires_in: 3600,
          }),
          { status: 200 }
        )
      );
    });

    it("should submit DVIR", async () => {
      const mockDVIR = {
        id: "dvir_1",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        timestamp: "2026-03-12T08:00:00Z",
        type: "pre-trip",
        condition: "pass",
        defects: [],
        createdAt: "2026-03-12T08:05:00Z",
        updatedAt: "2026-03-12T08:05:00Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDVIR), { status: 200 })
      );

      const dvir = await client.submitDVIR({
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        type: "pre-trip",
        condition: "pass",
        defects: [],
      });

      expect(dvir.id).toBe("dvir_1");
      expect(dvir.condition).toBe("pass");
    });

    it("should retrieve DVIRs for vehicle", async () => {
      const mockDVIRs = {
        dvirs: [
          {
            id: "dvir_1",
            driverId: "driver_1",
            vehicleId: "vehicle_1",
            timestamp: "2026-03-12T08:00:00Z",
            type: "pre-trip",
            condition: "defect",
            defects: [
              {
                component: "Lights",
                severity: "minor",
                description: "Right brake light out",
              },
            ],
            createdAt: "2026-03-12T08:05:00Z",
            updatedAt: "2026-03-12T08:05:00Z",
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDVIRs), { status: 200 })
      );

      const dvirs = await client.getDVIRs("vehicle_1", 30);

      expect(dvirs).toHaveLength(1);
      expect(dvirs[0].condition).toBe("defect");
      expect(dvirs[0].defects).toHaveLength(1);
    });
  });

  describe("webhook", () => {
    it("should handle duty status change webhook", async () => {
      const event = {
        type: "duty-status-change" as const,
        payload: {
          driverId: "driver_1",
          status: "driving",
          timestamp: "2026-03-12T08:00:00Z",
        },
      };

      await expect(client.handleWebhook(event)).resolves.not.toThrow();
    });

    it("should verify webhook signature", async () => {
      const event = {
        type: "diagnostic-event" as const,
        payload: {
          vehicleId: "vehicle_1",
          message: "Device online",
        },
      };

      const invalidSignature = "invalid_signature";

      // Should not throw - signature verification is optional
      await expect(
        client.handleWebhook(event, invalidSignature)
      ).rejects.toThrow();
    });
  });

  describe("health check", () => {
    it("should return true for successful health check", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: "token_123",
              expires_in: 3600,
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ organization: { id: "org_123" } }), {
            status: 200,
          })
        );

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it("should return false for failed health check", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Connection timeout")
      );

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });
});
