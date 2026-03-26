/**
 * Omnitracs XRS v2 API Client Tests
 *
 * Tests for:
 * - API initialization and authentication
 * - Extended driver management (HOS availability, violations)
 * - Vehicle tracking with GPS and fuel usage
 * - HOS logs with edit request tracking
 * - DVIR with mechanic workflow
 * - Dispatch integration (routes, stops, ETA)
 * - Performance analytics and driver scorecards
 * - Compliance reporting (FMCSA transfer ready, roadside export)
 * - Cursor-based pagination
 * - Error handling and retries
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OmnitrocsXrsV2Client } from "../../../packages/core/src/integrations/eld/omnitracs-xrs-v2-client";
import type { ELDConfig } from "../../../packages/core/src/integrations/eld/types";

describe("OmnitrocsXrsV2Client", () => {
  let client: OmnitrocsXrsV2Client;
  let config: ELDConfig;

  beforeEach(() => {
    config = {
      provider: "omnitracs",
      apiKey: "test-api-key",
      accountId: "acc_123",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    client = new OmnitrocsXrsV2Client(config);
  });

  describe("initialization", () => {
    it("should initialize successfully with valid API key", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ organization: { id: "org_123" } }), {
          status: 200,
        })
      );

      await expect(client.initialize()).resolves.not.toThrow();
    });

    it("should throw error if API key is missing", () => {
      const invalidConfig = { ...config, apiKey: "" };
      const invalidClient = new OmnitrocsXrsV2Client(invalidConfig);

      expect(() => invalidClient.initialize()).rejects.toThrow(
        "Omnitracs XRS API key is required"
      );
    });
  });

  describe("driver logs", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ organization: { id: "org_123" } }), {
          status: 200,
        })
      );
    });

    it("should retrieve driver logs with cursor pagination", async () => {
      const mockLogs = {
        logs: [
          {
            id: "log_1",
            driverId: "driver_1",
            vehicleId: "vehicle_1",
            startTime: "2026-03-12T08:00:00Z",
            endTime: "2026-03-12T10:00:00Z",
            status: "driving",
            miles: 120,
            editable: true,
            editRequests: [],
            unidentifiedDriving: false,
            createdAt: "2026-03-12T10:05:00Z",
            updatedAt: "2026-03-12T10:05:00Z",
          },
        ],
        cursor: "cursor_123",
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

    it("should detect unidentified driving", async () => {
      const mockLogs = {
        logs: [
          {
            id: "log_1",
            driverId: "driver_1",
            startTime: "2026-03-12T08:00:00Z",
            endTime: "2026-03-12T10:00:00Z",
            status: "driving",
            unidentifiedDriving: true,
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

      expect(logs[0].remarks).toContain("Unidentified driving");
    });
  });

  describe("duty status", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ organization: { id: "org_123" } }), {
          status: 200,
        })
      );
    });

    it("should get current duty status with HOS availability", async () => {
      const mockDriver = {
        id: "driver_1",
        firstName: "John",
        lastName: "Doe",
        currentStatus: {
          status: "driving",
          timestamp: "2026-03-12T08:00:00Z",
        },
        hosAvailable: {
          driving: 6,
          onDuty: 8,
        },
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockDriver), { status: 200 })
      );

      const status = await client.getDutyStatus("driver_1");

      expect(status.driverId).toBe("driver_1");
      expect(status.status).toBe("driving");
      expect(status.availableHoursDriving).toBe(6);
      expect(status.availableHoursOnDuty).toBe(8);
    });

    it("should set driver duty status", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: "driver_1",
              currentStatus: {
                status: "on_duty",
                timestamp: "2026-03-12T10:00:00Z",
              },
              hosAvailable: {
                driving: 6,
                onDuty: 8,
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
        new Response(JSON.stringify({ organization: { id: "org_123" } }), {
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
            type: "11-hour",
            description: "Exceeded 11-hour driving limit",
            severity: "critical",
            timestamp: "2026-03-12T20:30:00Z",
            acknowledged: false,
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockViolations), { status: 200 })
      );

      const violations = await client.getViolations("driver_1", 30);

      expect(violations).toHaveLength(1);
      expect(violations[0].violationType).toBe("hours-11");
      expect(violations[0].severity).toBe("critical");
    });
  });

  describe("vehicles", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ organization: { id: "org_123" } }), {
          status: 200,
        })
      );
    });

    it("should retrieve vehicle information", async () => {
      const mockVehicle = {
        id: "vehicle_1",
        name: "Truck-001",
        unitNumber: "UNIT-001",
        vin: "1HGBH41JXMN109186",
        licensePlate: "NY-ABC-123",
        make: "Volvo",
        model: "VNL",
        year: 2020,
        odometer: 45000,
        fuelType: "diesel",
        status: "active",
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

    it("should paginate through vehicles with cursor", async () => {
      const mockVehicles1 = {
        vehicles: [
          {
            id: "vehicle_1",
            name: "Truck-001",
            vin: "VIN1",
            licensePlate: "PLATE1",
            status: "active",
            createdAt: "2020-01-01T00:00:00Z",
            updatedAt: "2026-03-12T12:00:00Z",
          },
          {
            id: "vehicle_2",
            name: "Truck-002",
            vin: "VIN2",
            licensePlate: "PLATE2",
            status: "active",
            createdAt: "2020-01-01T00:00:00Z",
            updatedAt: "2026-03-12T12:00:00Z",
          },
        ],
        cursor: "cursor_123",
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
              name: "Truck-001",
              vin: "VIN1",
              licensePlate: "PLATE1",
              status: "active",
              createdAt: "2020-01-01T00:00:00Z",
              updatedAt: "2026-03-12T12:00:00Z",
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
        new Response(JSON.stringify({ organization: { id: "org_123" } }), {
          status: 200,
        })
      );
    });

    it("should submit DVIR with defects", async () => {
      const mockDVIR = {
        id: "dvir_1",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        timestamp: "2026-03-12T08:00:00Z",
        type: "pre-trip",
        condition: "defect",
        defects: [
          {
            id: "defect_1",
            component: "Lights",
            severity: "minor",
            description: "Right brake light out",
          },
        ],
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
        condition: "defect",
        defects: [
          {
            component: "Lights",
            severity: "minor",
            description: "Right brake light out",
          },
        ],
      });

      expect(dvir.id).toBe("dvir_1");
      expect(dvir.condition).toBe("defect");
      expect(dvir.defects).toHaveLength(1);
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
            condition: "pass",
            defects: [],
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
      expect(dvirs[0].condition).toBe("pass");
    });
  });

  describe("dispatch/performance", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ organization: { id: "org_123" } }), {
          status: 200,
        })
      );
    });

    it("should retrieve driver routes", async () => {
      const mockRoutes = [
        {
          id: "route_1",
          name: "Route-001",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          stops: [
            {
              id: "stop_1",
              address: "123 Main St",
              latitude: 40.7128,
              longitude: -74.006,
              eta: "2026-03-12T10:00:00Z",
            },
          ],
          status: "in-progress",
          createdAt: "2026-03-12T08:00:00Z",
          updatedAt: "2026-03-12T08:00:00Z",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockRoutes), { status: 200 })
      );

      const routes = await client.getRoutes("driver_1");

      expect(routes).toHaveLength(1);
      expect(routes[0].status).toBe("in-progress");
    });

    it("should retrieve performance analytics", async () => {
      const mockPerformance = {
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        period: "monthly",
        speeding: {
          count: 5,
          duration: 300,
        },
        idleTime: 3600,
        fuelEfficiency: 6.5,
        mpg: 6.5,
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockPerformance), { status: 200 })
      );

      const performance = await client.getPerformance("driver_1", "monthly");

      expect(performance.speeding.count).toBe(5);
      expect(performance.mpg).toBe(6.5);
    });

    it("should retrieve driver scorecard", async () => {
      const mockScorecard = {
        driverId: "driver_1",
        period: "monthly",
        overallScore: 85,
        categories: {
          safety: 90,
          efficiency: 80,
          compliance: 85,
        },
        violations: [],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockScorecard), { status: 200 })
      );

      const scorecard = await client.getScorecard("driver_1", "monthly");

      expect(scorecard.overallScore).toBe(85);
      expect(scorecard.categories.safety).toBe(90);
    });
  });

  describe("compliance", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ organization: { id: "org_123" } }), {
          status: 200,
        })
      );
    });

    it("should retrieve compliance report", async () => {
      const mockCompliance = {
        driverId: "driver_1",
        period: "monthly",
        fmcsaTransferReady: true,
        roadsideExportUrl: "https://api.example.com/export/123",
        violations: [],
        certifications: [
          {
            type: "CDL",
            expiryDate: "2026-12-31",
          },
        ],
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockCompliance), { status: 200 })
      );

      const compliance = await client.getComplianceReport("driver_1", "monthly");

      expect(compliance.fmcsaTransferReady).toBe(true);
      expect(compliance.roadsideExportUrl).toBeDefined();
    });

    it("should generate FMCSA transfer file", async () => {
      const mockResponse = {
        fileUrl: "https://api.example.com/fmcsa/file_123",
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const fileUrl = await client.generateFmcsaTransfer("driver_1");

      expect(fileUrl).toBe("https://api.example.com/fmcsa/file_123");
    });
  });

  describe("health check", () => {
    it("should return true for successful health check", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
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
