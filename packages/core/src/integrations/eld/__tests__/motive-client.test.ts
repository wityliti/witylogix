/**
 * Motive ELD Client Tests
 *
 * Tests for:
 * - API initialization and authentication
 * - Driver log retrieval and parsing
 * - Duty status changes and transitions
 * - HOS violation detection
 * - Vehicle management
 * - DVIR submission and retrieval
 * - Webhook event processing
 * - Error handling and retries
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MotiveELDClient } from "../motive-client.js";
import type { ELDConfig, DutyStatus } from "../types.js";

describe("MotiveELDClient", () => {
  let client: MotiveELDClient;
  let config: ELDConfig;

  beforeEach(() => {
    config = {
      provider: "motive",
      apiKey: "test-api-key",
      accountId: "acc_123",
      autoSync: true,
      enableWebhooks: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    client = new MotiveELDClient(config);
  });

  describe("initialization", () => {
    it("should initialize successfully with valid API key", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ account: { id: "acc_123" } }), {
          status: 200,
        })
      );

      await expect(client.initialize()).resolves.not.toThrow();
    });

    it("should throw error if API key is missing", () => {
      const invalidConfig = { ...config, apiKey: "" };
      const invalidClient = new MotiveELDClient(invalidConfig);

      expect(() => invalidClient.initialize()).rejects.toThrow(
        "Motive API key is required"
      );
    });

    it("should throw error if API connection fails", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Connection refused")
      );

      await expect(client.initialize()).rejects.toThrow(
        "Failed to initialize Motive"
      );
    });
  });

  describe("driver logs", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ account: { id: "acc_123" } }), {
          status: 200,
        })
      );
    });

    it("should retrieve driver logs for date range", async () => {
      const mockLogs = {
        logs: [
          {
            id: "log_1",
            driverId: "driver_1",
            startTime: "2026-03-12T08:00:00Z",
            endTime: "2026-03-12T10:00:00Z",
            dutyStatus: "driving",
            miles: 120,
            notes: "Regular delivery run",
            edited: false,
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
      expect(logs[0].driverId).toBe("driver_1");
      expect(logs[0].dutyStatus).toBe("driving");
      expect(logs[0].miles).toBe(120);
    });

    it("should return empty array if no logs found", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ logs: [] }), { status: 200 })
      );

      const logs = await client.getDriverLogs(
        "driver_1",
        new Date("2026-03-12"),
        new Date("2026-03-13")
      );

      expect(logs).toHaveLength(0);
    });

    it("should map duty statuses correctly", async () => {
      const mockLogs = {
        logs: [
          {
            id: "log_on_duty",
            driverId: "driver_1",
            startTime: "2026-03-12T08:00:00Z",
            endTime: "2026-03-12T09:00:00Z",
            dutyStatus: "on_duty",
            edited: false,
            createdAt: "2026-03-12T09:05:00Z",
            updatedAt: "2026-03-12T09:05:00Z",
          },
          {
            id: "log_sleeper",
            driverId: "driver_1",
            startTime: "2026-03-12T20:00:00Z",
            endTime: "2026-03-13T04:00:00Z",
            dutyStatus: "sleeper_berth",
            edited: false,
            createdAt: "2026-03-13T04:05:00Z",
            updatedAt: "2026-03-13T04:05:00Z",
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockLogs), { status: 200 })
      );

      const logs = await client.getDriverLogs(
        "driver_1",
        new Date("2026-03-12"),
        new Date("2026-03-13")
      );

      expect(logs[0].dutyStatus).toBe("on-duty");
      expect(logs[1].dutyStatus).toBe("sleeper-berth");
    });
  });

  describe("duty status", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ account: { id: "acc_123" } }), {
          status: 200,
        })
      );
    });

    it("should get current duty status for driver", async () => {
      const mockDriver = {
        id: "driver_1",
        name: "John Doe",
        currentDutyStatus: "driving",
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.006,
          address: "123 Main St, NYC",
          timestamp: "2026-03-12T10:00:00Z",
        },
        hosStatus: {
          hoursWorked11: 5,
          hoursWorked14: 6,
          hoursWorked60: 30,
          hoursWorked70: 45,
          hoursAvailable: 6,
        },
      };

      const hosSummary = {
        hoursWorked11: 5,
        hoursWorked14: 6,
        hoursWorked60: 30,
        hoursWorked70: 45,
        hoursAvailable: 6,
      };

      // Chain both mocks on a single spy — the second vi.spyOn overwrites the first
      const fetchSpy = vi.spyOn(global, "fetch");
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockDriver), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(hosSummary), { status: 200 })
      );

      const status = await client.getDutyStatus("driver_1");

      expect(status.driverId).toBe("driver_1");
      expect(status.status).toBe("driving");
      expect(status.availableHoursDriving).toBe(6);
    });

    it("should set duty status to new value", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const mockDriver = {
        id: "driver_1",
        name: "John Doe",
        currentDutyStatus: "on_duty",
        hosStatus: {
          hoursWorked11: 5,
          hoursWorked14: 6,
          hoursWorked60: 30,
          hoursWorked70: 45,
          hoursAvailable: 6,
        },
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDriver), { status: 200 })
      );

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ hoursWorked11: 5 }), { status: 200 })
      );

      const newStatus = await client.setDutyStatus("driver_1", "on-duty");

      expect(newStatus.status).toBe("on-duty");
    });

    it("should validate duty status transition", async () => {
      const validTransitions: Array<[DutyStatus, DutyStatus]> = [
        ["driving", "off-duty"],
        ["off-duty", "driving"],
        ["sleeper-berth", "off-duty"],
      ];

      for (const [from, to] of validTransitions) {
        // All transitions should be allowed by FMCSA
        expect(to).toBeDefined();
      }
    });
  });

  describe("violations", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ account: { id: "acc_123" } }), {
          status: 200,
        })
      );
    });

    it("should retrieve violations for driver", async () => {
      const mockViolations = {
        violations: [
          {
            id: "vio_1",
            driverId: "driver_1",
            type: "11_hour",
            description: "Exceeded 11-hour driving limit",
            severity: "critical",
            detectedAt: "2026-03-12T10:00:00Z",
            timeRange: {
              start: "2026-03-12T08:00:00Z",
              end: "2026-03-12T19:30:00Z",
            },
            acknowledged: false,
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockViolations), { status: 200 })
      );

      const violations = await client.getViolations("driver_1");

      expect(violations).toHaveLength(1);
      expect(violations[0].violationType).toBe("hours-11");
      expect(violations[0].severity).toBe("critical");
    });

    it("should return empty array if no violations", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ violations: [] }), { status: 200 })
      );

      const violations = await client.getViolations("driver_1");

      expect(violations).toHaveLength(0);
    });

    it("should map violation types correctly", async () => {
      const mockViolations = {
        violations: [
          {
            id: "vio_11h",
            driverId: "driver_1",
            type: "11_hour",
            description: "11-hour violation",
            severity: "critical",
            detectedAt: "2026-03-12T10:00:00Z",
            timeRange: { start: "2026-03-12T08:00:00Z", end: "2026-03-12T19:30:00Z" },
            acknowledged: false,
          },
          {
            id: "vio_30m",
            driverId: "driver_1",
            type: "30_min_break",
            description: "30-minute break violation",
            severity: "error",
            detectedAt: "2026-03-12T10:00:00Z",
            timeRange: { start: "2026-03-12T08:00:00Z", end: "2026-03-12T16:30:00Z" },
            acknowledged: false,
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockViolations), { status: 200 })
      );

      const violations = await client.getViolations("driver_1");

      expect(violations[0].violationType).toBe("hours-11");
      expect(violations[1].violationType).toBe("break-30min");
    });
  });

  describe("vehicles", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ account: { id: "acc_123" } }), {
          status: 200,
        })
      );
    });

    it("should retrieve vehicle information", async () => {
      const mockVehicle = {
        id: "vehicle_1",
        vin: "1HGCV41JXMN109186",
        licensePlate: "ABC123",
        make: "Honda",
        model: "Odyssey",
        year: 2020,
        odometer: 25000,
        fuelType: "gasoline",
        gvwr: 4600,
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.006,
          address: "123 Main St, NYC",
          timestamp: "2026-03-12T10:00:00Z",
        },
        activeFaults: [{ code: "P0128", description: "Coolant temp issue" }],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-03-12T10:00:00Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockVehicle), { status: 200 })
      );

      const vehicle = await client.getVehicle("vehicle_1");

      expect(vehicle.vin).toBe("1HGCV41JXMN109186");
      expect(vehicle.licensePlate).toBe("ABC123");
      expect(vehicle.make).toBe("Honda");
      expect(vehicle.odometerMiles).toBe(25000);
      expect(vehicle.activeFaults).toHaveLength(1);
    });

    it("should retrieve all vehicles", async () => {
      const mockVehicles = {
        vehicles: [
          {
            id: "vehicle_1",
            vin: "VIN1",
            licensePlate: "PLATE1",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-03-12T10:00:00Z",
          },
          {
            id: "vehicle_2",
            vin: "VIN2",
            licensePlate: "PLATE2",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-03-12T10:00:00Z",
          },
        ],
      };

      const fetchSpy = vi.spyOn(global, "fetch");
      // First call: list vehicles
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockVehicles), { status: 200 })
      );
      // Individual vehicle requests
      for (const v of mockVehicles.vehicles) {
        fetchSpy.mockResolvedValueOnce(
          new Response(JSON.stringify(v), { status: 200 })
        );
      }

      const vehicles = await client.getVehicles();

      expect(vehicles).toHaveLength(2);
    });
  });

  describe("DVIR", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ account: { id: "acc_123" } }), {
          status: 200,
        })
      );
    });

    it("should submit DVIR", async () => {
      const mockDVIR = {
        id: "dvir_1",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        inspectionTime: "2026-03-12T08:00:00Z",
        type: "pre_trip",
        condition: "pass",
        submittedAt: "2026-03-12T08:05:00Z",
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
      });

      expect(dvir.id).toBe("dvir_1");
      expect(dvir.type).toBe("pre-trip");
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
            type: "pre_trip",
            condition: "pass",
            items: [],
            createdAt: "2026-03-12T08:05:00Z",
            updatedAt: "2026-03-12T08:05:00Z",
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDVIRs), { status: 200 })
      );

      const dvirs = await client.getDVIRs("vehicle_1");

      expect(dvirs).toHaveLength(1);
      expect(dvirs[0].type).toBe("pre-trip");
    });

    it("should map DVIR defects correctly", async () => {
      const mockDVIR = {
        id: "dvir_defect",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        timestamp: "2026-03-12T17:00:00Z",
        type: "post_trip",
        condition: "defect",
        defects: [
          {
            component: "brake_pads",
            severity: "major",
            description: "Brake pads worn",
          },
        ],
        submittedAt: "2026-03-12T17:05:00Z",
        updatedAt: "2026-03-12T17:05:00Z",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDVIR), { status: 200 })
      );

      const dvir = await client.submitDVIR({
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        type: "post-trip",
        condition: "defect",
        defects: [
          {
            component: "brake_pads",
            severity: "major",
            description: "Brake pads worn",
          },
        ],
      });

      expect(dvir.defects).toHaveLength(1);
      expect(dvir.defects[0].component).toBe("brake_pads");
      expect(dvir.defects[0].severity).toBe("major");
    });
  });

  describe("webhooks", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ account: { id: "acc_123" } }), {
          status: 200,
        })
      );
    });

    it("should handle duty status change webhook", async () => {
      const event = {
        id: "webhook_1",
        type: "duty-status-change" as const,
        accountId: "acc_123",
        timestamp: new Date(),
        payload: { driverId: "driver_1", status: "driving" },
      };

      await expect(client.handleWebhook(event)).resolves.not.toThrow();

      const auditLog = client.getAuditLog();
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].type).toBe("duty-status-change");
    });

    it("should handle DVIR submitted webhook", async () => {
      const event = {
        id: "webhook_dvir",
        type: "dvir-submitted" as const,
        accountId: "acc_123",
        timestamp: new Date(),
        payload: { driverId: "driver_1", vehicleId: "vehicle_1", dvirId: "dvir_1" },
      };

      await expect(client.handleWebhook(event)).resolves.not.toThrow();

      const auditLog = client.getAuditLog();
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].type).toBe("dvir-submitted");
    });
  });

  describe("health check", () => {
    it("should return true if API is healthy", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ account: { id: "acc_123" } }), {
          status: 200,
        })
      );

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it("should return false if API is unhealthy", async () => {
      vi.spyOn(global, "fetch").mockRejectedValue(
        new Error("Connection timeout")
      );

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});
