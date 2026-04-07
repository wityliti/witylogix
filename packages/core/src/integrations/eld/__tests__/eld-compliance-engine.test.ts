/**
 * ELD Compliance Engine Tests
 *
 * Tests for:
 * - FMCSA Part 395 HOS violation detection
 * - Daily violation detection (11h, 14h, 30min break)
 * - 8-day window violation detection (60/70 hour)
 * - Multi-provider HOS aggregation
 * - Compliance scoring
 * - Exemption management
 * - Audit log generation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ELDComplianceEngine } from "../eld-compliance-engine.js";
import type { ELDDriverLog, ELDViolation } from "../types.js";

describe("ELDComplianceEngine", () => {
  let engine: ELDComplianceEngine;
  let mockLogs: ELDDriverLog[];

  beforeEach(() => {
    engine = new ELDComplianceEngine();

    mockLogs = [
      {
        id: "log_1",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        startTime: new Date("2026-03-12T08:00:00"),
        endTime: new Date("2026-03-12T10:00:00"),
        dutyStatus: "driving",
        miles: 120,
        hours: 2,
        remarks: "Test log",
        sequence: 0,
        edited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("violation detection - daily", () => {
    it("should detect 11-hour driving violation", () => {
      const logsExceeding11 = [
        {
          ...mockLogs[0],
          startTime: new Date("2026-03-12T08:00:00"),
          endTime: new Date("2026-03-12T19:30:00"),
          hours: 11.5,
        },
      ];

      const violations = engine.detectDailyViolations(
        logsExceeding11,
        new Date("2026-03-12")
      );

      const violation11 = violations.find((v) => v.violationType === "hours-11");
      expect(violation11).toBeDefined();
      expect(violation11?.severity).toBe("critical");
    });

    it("should not detect violation if within 11-hour limit", () => {
      const logsWithin11 = [
        {
          ...mockLogs[0],
          startTime: new Date("2026-03-12T08:00:00"),
          endTime: new Date("2026-03-12T18:00:00"),
          hours: 10,
        },
      ];

      const violations = engine.detectDailyViolations(
        logsWithin11,
        new Date("2026-03-12")
      );

      const violation11 = violations.find((v) => v.violationType === "hours-11");
      expect(violation11).toBeUndefined();
    });

    it("should detect 14-hour on-duty violation", () => {
      const logsExceeding14 = [
        {
          ...mockLogs[0],
          startTime: new Date("2026-03-12T08:00:00"),
          endTime: new Date("2026-03-12T23:00:00"),
          dutyStatus: "driving",
          hours: 10,
        },
        {
          ...mockLogs[0],
          id: "log_2",
          startTime: new Date("2026-03-12T23:00:00"),
          endTime: new Date("2026-03-13T05:00:00"),
          dutyStatus: "on-duty",
          hours: 6,
        },
      ];

      const violations = engine.detectDailyViolations(
        logsExceeding14,
        new Date("2026-03-12")
      );

      const violation14 = violations.find((v) => v.violationType === "hours-14");
      expect(violation14).toBeDefined();
      expect(violation14?.severity).toBe("critical");
    });

    it("should detect 30-minute break violation", () => {
      const logsNeedingBreak = [
        {
          ...mockLogs[0],
          startTime: new Date("2026-03-12T08:00:00"),
          endTime: new Date("2026-03-12T16:30:00"),
          hours: 8.5,
        },
      ];

      const violations = engine.detectDailyViolations(
        logsNeedingBreak,
        new Date("2026-03-12")
      );

      const breakViolation = violations.find((v) => v.violationType === "break-30min");
      expect(breakViolation).toBeDefined();
    });

    it("should return empty violations for clean logs", () => {
      const cleanLogs = [
        {
          ...mockLogs[0],
          startTime: new Date("2026-03-12T08:00:00"),
          endTime: new Date("2026-03-12T12:00:00"),
          hours: 4,
        },
      ];

      const violations = engine.detectDailyViolations(
        cleanLogs,
        new Date("2026-03-12")
      );

      expect(violations.filter((v) => v.severity === "critical")).toHaveLength(0);
    });

    it("should return empty array for empty logs", () => {
      const violations = engine.detectDailyViolations([], new Date("2026-03-12"));

      expect(violations).toHaveLength(0);
    });
  });

  describe("violation detection - 8-day window", () => {
    it("should detect 60-hour violation in 8-day window", () => {
      // detect8DayViolations filters: startTime >= (endDate - 7 days) && startTime <= endDate
      // endDate = 2026-03-14T12:00:00Z => window start = 2026-03-07T12:00:00Z
      // 7 logs from 2026-03-08 through 2026-03-14 at 01:00Z => all within window
      // 7 * 9 = 63 driving hours > 60 => violation
      const endDate = new Date("2026-03-14T12:00:00Z");
      const logsExceeding60 = Array.from({ length: 7 }, (_, i) => ({
        ...mockLogs[0],
        id: `log_${i}`,
        startTime: new Date(
          new Date("2026-03-08T01:00:00Z").getTime() + i * 86400000
        ),
        endTime: new Date(
          new Date("2026-03-08T10:00:00Z").getTime() + i * 86400000
        ),
        hours: 9,
      }));

      const violations = engine.detect8DayViolations(
        logsExceeding60,
        endDate
      );

      const violation60 = violations.find((v) => v.violationType === "hours-60-70");
      expect(violation60).toBeDefined();
      expect(violation60?.severity).toBe("critical");
    });

    it("should detect 70-hour violation in 8-day window", () => {
      // endDate = 2026-03-15T23:00:00Z => window start = 2026-03-08T23:00:00Z
      // 8 logs from 2026-03-09 through 2026-03-15 at 08:00Z => all in window
      // 4 driving * 9 = 36h, 4 on-duty * 9 = 36h, total70 = 72h > 70h
      const endDate = new Date("2026-03-15T23:00:00Z");
      const logsExceeding70 = Array.from({ length: 7 }, (_, i) => ({
        ...mockLogs[0],
        id: `log_${i}`,
        startTime: new Date(
          new Date("2026-03-09T08:00:00Z").getTime() + i * 86400000
        ),
        endTime: new Date(
          new Date("2026-03-09T18:00:00Z").getTime() + i * 86400000
        ),
        dutyStatus: i % 2 === 0 ? "driving" : "on-duty",
        hours: 10.5, // 4 driving * 10.5 = 42h, 3 on-duty * 10.5 = 31.5h, total = 73.5h > 70h
      }));

      const violations = engine.detect8DayViolations(
        logsExceeding70,
        endDate
      );

      const violation70 = violations.find((v) => v.violationType === "hours-60-70");
      expect(violation70).toBeDefined();
    });

    it("should not detect violation if within 60/70 limits", () => {
      const cleanLogs = Array.from({ length: 8 }, (_, i) => ({
        ...mockLogs[0],
        id: `log_${i}`,
        startTime: new Date(
          new Date("2026-03-05").getTime() + i * 86400000 + 28800000
        ),
        endTime: new Date(
          new Date("2026-03-05").getTime() + i * 86400000 + 35200000
        ),
        hours: 5, // 8 days * 5 hours = 40 hours
      }));

      const violations = engine.detect8DayViolations(
        cleanLogs,
        new Date("2026-03-13")
      );

      expect(violations).toHaveLength(0);
    });
  });

  describe("exemption management", () => {
    it("should add exemption", () => {
      const exemption = {
        driverId: "driver_1",
        type: "short-haul" as const,
        startDate: new Date("2026-03-12"),
        endDate: new Date("2026-03-13"),
        reason: "Short haul operation",
      };

      engine.addExemption(exemption);
      const activeExemptions = engine.getActiveExemptions(
        "driver_1",
        new Date("2026-03-12")
      );

      expect(activeExemptions).toHaveLength(1);
      expect(activeExemptions[0].type).toBe("short-haul");
    });

    it("should not return exemptions outside date range", () => {
      const exemption = {
        driverId: "driver_1",
        type: "adverse-weather" as const,
        startDate: new Date("2026-03-12"),
        endDate: new Date("2026-03-13"),
      };

      engine.addExemption(exemption);
      const activeExemptions = engine.getActiveExemptions(
        "driver_1",
        new Date("2026-03-15")
      );

      expect(activeExemptions).toHaveLength(0);
    });

    it("should not flag violations if driver is exempted", () => {
      const exemption = {
        driverId: "driver_1",
        type: "short-haul" as const,
        startDate: new Date("2026-03-12"),
        endDate: new Date("2026-03-12"),
      };

      engine.addExemption(exemption);

      const logsExceeding11 = [
        {
          ...mockLogs[0],
          startTime: new Date("2026-03-12T08:00:00"),
          endTime: new Date("2026-03-12T19:30:00"),
          hours: 11.5,
        },
      ];

      const violations = engine.detectDailyViolations(
        logsExceeding11,
        new Date("2026-03-12")
      );

      const violation11 = violations.find((v) => v.violationType === "hours-11");
      expect(violation11).toBeUndefined();
    });
  });

  describe("compliance scoring", () => {
    it("should calculate high compliance score with no violations", () => {
      const violations: ELDViolation[] = [];

      const score = engine.calculateComplianceScore("driver_1", violations);

      expect(score.overallScore).toBe(100);
      expect(score.hosViolationCount).toBe(0);
      expect(score.violationSeverity).toBe("none");
    });

    it("should deduct points for critical violations", () => {
      const violations: ELDViolation[] = [
        {
          id: "vio_1",
          accountId: "acc_123",
          driverId: "driver_1",
          violationType: "hours-11",
          description: "11-hour violation",
          severity: "critical",
          detectedAt: new Date(),
          violationTimeRange: { start: new Date(), end: new Date() },
          hosContext: {},
          acknowledged: false,
          createdAt: new Date(),
        },
      ];

      const score = engine.calculateComplianceScore("driver_1", violations);

      expect(score.overallScore).toBeLessThan(100);
      expect(score.hosViolationCount).toBe(1);
      expect(score.violationSeverity).toBe("critical");
    });

    it("should calculate fleet compliance", () => {
      const drivers = [
        {
          id: "driver_1",
          violations: [] as ELDViolation[],
        },
        {
          id: "driver_2",
          violations: [
            {
              id: "vio_1",
              accountId: "acc_123",
              driverId: "driver_2",
              violationType: "hours-11",
              description: "11-hour violation",
              severity: "critical",
              detectedAt: new Date(),
              violationTimeRange: { start: new Date(), end: new Date() },
              hosContext: {},
              acknowledged: false,
              createdAt: new Date(),
            },
          ],
        },
      ];

      const fleetCompliance = engine.calculateFleetCompliance("acc_123", drivers);

      expect(fleetCompliance.totalDrivers).toBe(2);
      expect(fleetCompliance.driversInCompliance).toBe(1);
      expect(fleetCompliance.driversWithViolations).toBe(1);
      expect(fleetCompliance.criticalViolations).toBe(1);
      expect(fleetCompliance.avgComplianceScore).toBeLessThan(100);
    });

    it("should determine trend based on violations", () => {
      const violations: ELDViolation[] = [];

      const score = engine.calculateComplianceScore("driver_1", violations);

      expect(score.trend).toBe("stable");
    });
  });

  describe("multi-provider HOS aggregation", () => {
    it("should aggregate logs from multiple providers", () => {
      const multiProviderLogs = [
        {
          ...mockLogs[0],
          id: "motive_log",
          startTime: new Date("2026-03-12T08:00:00"),
          endTime: new Date("2026-03-12T12:00:00"),
          hours: 4,
        },
        {
          ...mockLogs[0],
          id: "omnitracs_log",
          startTime: new Date("2026-03-12T13:00:00"),
          endTime: new Date("2026-03-12T17:00:00"),
          hours: 4,
        },
      ];

      const summary = engine.aggregateMultiProviderHOS(
        "driver_1",
        multiProviderLogs,
        new Date("2026-03-12")
      );

      expect(summary.hours11).toBe(8);
      expect(summary.availableDriving).toBe(3);
    });

    it("should handle mixed duty statuses from different providers", () => {
      const mixedLogs = [
        {
          ...mockLogs[0],
          dutyStatus: "driving",
          hours: 5,
        },
        {
          ...mockLogs[0],
          id: "log_2",
          dutyStatus: "on-duty",
          hours: 3,
        },
      ];

      const summary = engine.aggregateMultiProviderHOS(
        "driver_1",
        mixedLogs,
        new Date("2026-03-12")
      );

      expect(summary.hours11).toBe(5);
      expect(summary.hours14).toBe(8);
    });
  });

  describe("audit log", () => {
    it("should create audit log entry", () => {
      const violations: ELDViolation[] = [
        {
          id: "vio_1",
          accountId: "acc_123",
          driverId: "driver_1",
          violationType: "hours-11",
          description: "11-hour violation",
          severity: "critical",
          detectedAt: new Date(),
          violationTimeRange: { start: new Date(), end: new Date() },
          hosContext: {},
          acknowledged: false,
          createdAt: new Date(),
        },
      ];

      const entry = engine.createAuditLogEntry(
        "acc_123",
        "driver_1",
        new Date("2026-03-12"),
        violations
      );

      expect(entry.accountId).toBe("acc_123");
      expect(entry.driverId).toBe("driver_1");
      expect(entry.violationCount).toBe(1);
    });

    it("should retrieve audit log entries", () => {
      const violations: ELDViolation[] = [];

      engine.createAuditLogEntry(
        "acc_123",
        "driver_1",
        new Date("2026-03-12"),
        violations
      );

      const entries = engine.getAuditLog("acc_123", "driver_1");

      expect(entries).toHaveLength(1);
    });

    it("should filter audit log by account ID", () => {
      const violations: ELDViolation[] = [];

      engine.createAuditLogEntry(
        "acc_123",
        "driver_1",
        new Date("2026-03-12"),
        violations
      );
      engine.createAuditLogEntry(
        "acc_456",
        "driver_2",
        new Date("2026-03-12"),
        violations
      );

      const entries = engine.getAuditLog("acc_123");

      expect(entries).toHaveLength(1);
      expect(entries[0].accountId).toBe("acc_123");
    });

    it("should export audit log as CSV", () => {
      const violations: ELDViolation[] = [
        {
          id: "vio_1",
          accountId: "acc_123",
          driverId: "driver_1",
          violationType: "hours-11",
          description: "11-hour violation",
          severity: "critical",
          detectedAt: new Date(),
          violationTimeRange: { start: new Date(), end: new Date() },
          hosContext: {},
          acknowledged: false,
          createdAt: new Date(),
        },
      ];

      engine.createAuditLogEntry(
        "acc_123",
        "driver_1",
        new Date("2026-03-12"),
        violations
      );

      const csv = engine.exportAuditLog("acc_123", "csv");

      expect(csv).toContain("Date");
      expect(csv).toContain("Driver ID");
      expect(csv).toContain("driver_1");
      expect(csv).toContain("hours-11");
    });

    it("should export audit log as JSON", () => {
      const violations: ELDViolation[] = [];

      engine.createAuditLogEntry(
        "acc_123",
        "driver_1",
        new Date("2026-03-12"),
        violations
      );

      const json = engine.exportAuditLog("acc_123", "json");
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].driverId).toBe("driver_1");
    });
  });
});
