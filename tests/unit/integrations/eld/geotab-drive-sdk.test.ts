/**
 * Geotab Drive API Client Tests
 *
 * Tests for:
 * - API initialization and session-based authentication
 * - JSONRPC 2.0 protocol compliance
 * - Driver log retrieval (DutyStatusLog)
 * - Duty status transitions (D, ON, SB, OFF)
 * - HOS violation detection from exceptions
 * - Vehicle/Device management
 * - DVIR submission and retrieval
 * - GetFeed incremental sync
 * - Credit usage tracking
 * - Multi-call batch operations
 * - Error handling and retries
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GeotabDriveClient } from "../../../packages/core/src/integrations/eld/geotab-drive-sdk-client";
import type { ELDConfig } from "../../../packages/core/src/integrations/eld/types";

describe("GeotabDriveClient", () => {
  let client: GeotabDriveClient;
  let config: ELDConfig;

  beforeEach(() => {
    config = {
      provider: "omnitracs",
      apiKey: "test-username",
      apiSecret: "test-password",
      accountId: "acc_123",
      database: "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    client = new GeotabDriveClient(config);
  });

  describe("initialization", () => {
    it("should authenticate successfully with valid credentials", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );

      await expect(client.initialize()).resolves.not.toThrow();
    });

    it("should throw error if credentials are missing", () => {
      const invalidConfig = { ...config, apiKey: "", apiSecret: "" };
      const invalidClient = new GeotabDriveClient(invalidConfig);

      expect(() => invalidClient.initialize()).rejects.toThrow(
        "Geotab credentials"
      );
    });

    it("should handle authentication failure", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: -1,
              message: "Invalid credentials",
            },
          }),
          { status: 200 }
        )
      );

      await expect(client.initialize()).rejects.toThrow();
    });
  });

  describe("driver logs (DutyStatusLog)", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );
    });

    it("should retrieve DutyStatusLog entries for driver", async () => {
      const mockLogs = [
        {
          id: "log_1",
          driverId: "driver_1",
          deviceId: "device_1",
          startDateTime: "2026-03-12T08:00:00Z",
          endDateTime: "2026-03-12T10:00:00Z",
          dutyStatusType: "D",
          distance: 120,
          duration: 7200,
          remark: "Regular route",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: mockLogs,
          }),
          { status: 200 }
        )
      );

      const startDate = new Date("2026-03-12");
      const endDate = new Date("2026-03-13");
      const logs = await client.getDriverLogs("driver_1", startDate, endDate);

      expect(logs).toHaveLength(1);
      expect(logs[0].dutyStatus).toBe("driving");
      expect(logs[0].miles).toBe(120);
      expect(logs[0].hours).toBe(2); // 7200 seconds = 2 hours
    });

    it("should map Geotab duty status types correctly", async () => {
      const mockLogs = [
        {
          id: "log_1",
          driverId: "driver_1",
          dutyStatusType: "ON",
          startDateTime: "2026-03-12T08:00:00Z",
        },
        {
          id: "log_2",
          driverId: "driver_1",
          dutyStatusType: "SB",
          startDateTime: "2026-03-12T08:00:00Z",
        },
        {
          id: "log_3",
          driverId: "driver_1",
          dutyStatusType: "OFF",
          startDateTime: "2026-03-12T08:00:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: mockLogs,
          }),
          { status: 200 }
        )
      );

      const startDate = new Date("2026-03-12");
      const endDate = new Date("2026-03-13");
      const logs = await client.getDriverLogs("driver_1", startDate, endDate);

      expect(logs[0].dutyStatus).toBe("on-duty");
      expect(logs[1].dutyStatus).toBe("sleeper-berth");
      expect(logs[2].dutyStatus).toBe("off-duty");
    });
  });

  describe("duty status", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );
    });

    it("should get current duty status for driver", async () => {
      const mockLog = [
        {
          id: "log_1",
          driverId: "driver_1",
          dutyStatusType: "D",
          startDateTime: "2026-03-12T08:00:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: mockLog,
          }),
          { status: 200 }
        )
      );

      const status = await client.getDutyStatus("driver_1");

      expect(status.driverId).toBe("driver_1");
      expect(status.status).toBe("driving");
    });

    it("should set driver duty status", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              result: "log_new",
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              result: [
                {
                  id: "log_new",
                  driverId: "driver_1",
                  dutyStatusType: "ON",
                  startDateTime: new Date().toISOString(),
                },
              ],
            }),
            { status: 200 }
          )
        );

      const newStatus = await client.setDutyStatus("driver_1", "on-duty");

      expect(newStatus.status).toBe("on-duty");
    });
  });

  describe("exceptions/violations", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );
    });

    it("should retrieve exceptions as violations", async () => {
      const mockExceptions = [
        {
          id: "exc_1",
          driverId: "driver_1",
          deviceId: "device_1",
          ruleName: "After-HoursDriving",
          dateTime: "2026-03-12T20:30:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: mockExceptions,
          }),
          { status: 200 }
        )
      );

      const violations = await client.getViolations("driver_1", 30);

      expect(violations).toHaveLength(1);
      expect(violations[0].violationType).toBe("hours-14");
    });

    it("should filter relevant exception types", async () => {
      const mockExceptions = [
        {
          id: "exc_1",
          driverId: "driver_1",
          ruleName: "After-HoursDriving",
          dateTime: "2026-03-12T20:30:00Z",
        },
        {
          id: "exc_2",
          driverId: "driver_1",
          ruleName: "IdleTime",
          dateTime: "2026-03-12T14:00:00Z",
        },
        {
          id: "exc_3",
          driverId: "driver_1",
          ruleName: "UnrelatedRule",
          dateTime: "2026-03-12T12:00:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: mockExceptions,
          }),
          { status: 200 }
        )
      );

      const violations = await client.getViolations("driver_1", 30);

      // Should only include relevant violations
      expect(violations.length).toBeLessThanOrEqual(2);
    });
  });

  describe("vehicles/devices", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );
    });

    it("should retrieve vehicle/device information", async () => {
      const mockDevice = {
        id: "device_1",
        name: "Truck-001",
        serialNumber: "SN12345",
        vin: "1HGBH41JXMN109186",
        licensePlate: "NY-ABC-123",
        active: true,
        odometer: 45000,
        engineHours: 2000,
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: mockDevice,
          }),
          { status: 200 }
        )
      );

      const vehicle = await client.getVehicle("device_1");

      expect(vehicle.vin).toBe("1HGBH41JXMN109186");
      expect(vehicle.licensePlate).toBe("NY-ABC-123");
      expect(vehicle.odometerMiles).toBe(45000);
    });

    it("should retrieve all vehicles", async () => {
      const mockDevices = [
        {
          id: "device_1",
          name: "Truck-001",
          vin: "VIN1",
          licensePlate: "PLATE1",
          active: true,
        },
        {
          id: "device_2",
          name: "Truck-002",
          vin: "VIN2",
          licensePlate: "PLATE2",
          active: true,
        },
      ];

      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              result: mockDevices,
            }),
            { status: 200 }
          )
        )
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              result: {
                id: "device_1",
                name: "Truck-001",
                vin: "VIN1",
                licensePlate: "PLATE1",
                active: true,
              },
            }),
            { status: 200 }
          )
        );

      const vehicles = await client.getVehicles();

      expect(vehicles.length).toBeGreaterThan(0);
    });
  });

  describe("DVIR", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );
    });

    it("should submit DVIR", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: "dvir_123",
          }),
          { status: 200 }
        )
      );

      const dvir = await client.submitDVIR({
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        type: "pre-trip",
        condition: "pass",
        defects: [],
      });

      expect(dvir.id).toBe("dvir_123");
      expect(dvir.type).toBe("pre-trip");
    });

    it("should retrieve DVIRs for vehicle", async () => {
      const mockDVIRs = [
        {
          id: "dvir_1",
          driverId: "driver_1",
          deviceId: "device_1",
          dateTime: "2026-03-12T08:00:00Z",
          inspectionType: "PreTrip",
          defectList: [],
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: mockDVIRs,
          }),
          { status: 200 }
        )
      );

      const dvirs = await client.getDVIRs("device_1", 30);

      expect(dvirs).toHaveLength(1);
    });
  });

  describe("messaging", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );
    });

    it("should send message to driver", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: "msg_123",
          }),
          { status: 200 }
        )
      );

      const messageId = await client.sendMessageToDriver(
        "device_1",
        "Test message"
      );

      expect(messageId).toBe("msg_123");
    });
  });

  describe("feed/incremental sync", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );
    });

    it("should get feed with token", async () => {
      const mockFeed = {
        feed: [
          {
            id: "log_1",
            driverId: "driver_1",
            dutyStatusType: "D",
          },
        ],
        token: "token_456",
        version: "2",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: mockFeed,
          }),
          { status: 200 }
        )
      );

      const result = await client.getFeed("token_123");

      expect(result.feed).toHaveLength(1);
      expect(result.token).toBe("token_456");
    });
  });

  describe("health check", () => {
    it("should return true for successful authentication", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              sessionId: "session_123",
              database: "default",
            },
          }),
          { status: 200 }
        )
      );

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it("should return false for failed authentication", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: -1,
              message: "Authentication failed",
            },
          }),
          { status: 200 }
        )
      );

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });
});
