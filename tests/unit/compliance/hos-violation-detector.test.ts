/**
 * HOS Violation Detector Tests
 *
 * Tests:
 * - Real-time violation detection from duty status changes
 * - Form/Manner violations for incomplete logs
 * - Falsified log detection (GPS vs duty status)
 * - Violation auto-resolution after rest periods
 * - Repeat offender scoring
 * - FMCSA violation code mapping
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ViolationDetector } from "../../../packages/core/src/compliance/hos-violation-detector.js";
import type { LogEntry, RuleSet } from "../../../packages/core/src/compliance/hos-types.js";
import { DutyStatus } from "../../../packages/core/src/compliance/hos-types.js";

describe("ViolationDetector", () => {
  let detector: ViolationDetector;
  let usPropertyRuleSet: RuleSet;

  beforeEach(() => {
    detector = new ViolationDetector();
    usPropertyRuleSet = {
      jurisdiction: "US_PROPERTY",
      maxDrivingHours: 11,
      maxOnDutyWindow: 14,
      breakRequiredAfterMinutes: 8 * 60,
      requiredBreakDurationMinutes: 30,
      cycleRule: {
        ruleType: "70_HOUR_8_DAY",
        maxDrivingHours: 70,
        cycleDays: 8,
        measurementType: "ROLLING_WINDOW",
        restartAvailable: true,
        restartRequires1To5Am: true,
      },
      sleeperBerthSplits: [],
      shortHaulExceptionAllowed: true,
      shortHaulRadiusMiles: 150,
      shortHaulWindowHours: 14,
      adverseConditionsExtensionAllowed: true,
      adverseConditionsExtensionHours: 2,
      sixteenHourExceptionAllowed: true,
    };
  });

  describe("Duty status change detection", () => {
    it("should detect driving after 11h limit exhausted", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T19:30:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 11.5,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const newLog: LogEntry = {
        id: "log_2",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        startTime: new Date("2026-03-17T19:30:00Z"),
        endTime: new Date("2026-03-17T20:00:00Z"),
        dutyStatus: DutyStatus.DRIVING,
        hours: 0.5,
        sequence: 1,
        edited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const violations = detector.detectFromDutyChange(
        "driver_1",
        "acc_123",
        "vehicle_1",
        newLog,
        [...logs, newLog],
        usPropertyRuleSet
      );

      const driving11Violation = violations.find(
        (v) => v.violationType === "DRIVING_11"
      );
      expect(driving11Violation).toBeDefined();
      expect(driving11Violation?.severity).toBe("CRITICAL");
      expect(driving11Violation?.fmcsaViolationCode).toBe("395.3");
    });

    it("should detect operating beyond 14h window", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T22:30:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 14.5,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const newLog: LogEntry = {
        id: "log_2",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        startTime: new Date("2026-03-17T22:30:00Z"),
        endTime: new Date("2026-03-17T23:00:00Z"),
        dutyStatus: DutyStatus.ON_DUTY,
        hours: 0.5,
        sequence: 1,
        edited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const violations = detector.detectFromDutyChange(
        "driver_1",
        "acc_123",
        "vehicle_1",
        newLog,
        [...logs, newLog],
        usPropertyRuleSet
      );

      const window14Violation = violations.find(
        (v) => v.violationType === "ON_DUTY_14"
      );
      expect(window14Violation).toBeDefined();
      expect(window14Violation?.severity).toBe("CRITICAL");
    });

    it("should detect missing 30-minute break", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T16:30:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 8.5,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const newLog: LogEntry = {
        id: "log_2",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        startTime: new Date("2026-03-17T16:30:00Z"),
        endTime: new Date("2026-03-17T17:00:00Z"),
        dutyStatus: DutyStatus.DRIVING,
        hours: 0.5,
        sequence: 1,
        edited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const violations = detector.detectFromDutyChange(
        "driver_1",
        "acc_123",
        "vehicle_1",
        newLog,
        [...logs, newLog],
        usPropertyRuleSet
      );

      const breakViolation = violations.find(
        (v) => v.violationType === "BREAK_30MIN"
      );
      expect(breakViolation).toBeDefined();
      expect(breakViolation?.severity).toBe("CRITICAL");
      expect(breakViolation?.fmcsaViolationCode).toBe("395.8(a)(3)");
    });
  });

  describe("Form/Manner violations", () => {
    it("should detect incomplete log entry", () => {
      const logs: LogEntry[] = [];

      const incompleteLog: LogEntry = {
        id: "",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        startTime: new Date("2026-03-17T08:00:00Z"),
        endTime: new Date("2026-03-17T18:00:00Z"),
        dutyStatus: DutyStatus.DRIVING,
        hours: 10,
        sequence: 0,
        edited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const violations = detector.detectFromDutyChange(
        "driver_1",
        "acc_123",
        "vehicle_1",
        incompleteLog,
        [incompleteLog],
        usPropertyRuleSet
      );

      const formViolation = violations.find(
        (v) => v.violationType === "FORM_MANNER"
      );
      expect(formViolation).toBeDefined();
      expect(formViolation?.severity).toBe("WARNING");
    });

    it("should detect driving log with zero hours", () => {
      const logs: LogEntry[] = [];

      const invalidLog: LogEntry = {
        id: "log_1",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        startTime: new Date("2026-03-17T08:00:00Z"),
        endTime: new Date("2026-03-17T08:00:00Z"),
        dutyStatus: DutyStatus.DRIVING,
        hours: 0,
        sequence: 0,
        edited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const violations = detector.detectFromDutyChange(
        "driver_1",
        "acc_123",
        "vehicle_1",
        invalidLog,
        [invalidLog],
        usPropertyRuleSet
      );

      const formViolation = violations.find(
        (v) => v.violationType === "FORM_MANNER"
      );
      expect(formViolation).toBeDefined();
    });
  });

  describe("Falsified log detection", () => {
    it("should detect off-duty log with significant GPS movement", () => {
      const logs: LogEntry[] = [];

      const suspiciousLog: LogEntry = {
        id: "log_1",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        startTime: new Date("2026-03-17T08:00:00Z"),
        endTime: new Date("2026-03-17T18:00:00Z"),
        dutyStatus: DutyStatus.OFF_DUTY,
        hours: 10,
        startLocation: {
          latitude: 40.7128,
          longitude: -74.006,
          address: "New York, NY",
        },
        endLocation: {
          latitude: 40.7128,
          longitude: -73.5,
          address: "Eastern Long Island, NY",
        },
        miles: 30,
        sequence: 0,
        edited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const violations = detector.detectFromDutyChange(
        "driver_1",
        "acc_123",
        "vehicle_1",
        suspiciousLog,
        [suspiciousLog],
        usPropertyRuleSet
      );

      const falsifiedViolation = violations.find(
        (v) => v.violationType === "FALSIFIED_LOG"
      );
      expect(falsifiedViolation).toBeDefined();
      expect(falsifiedViolation?.severity).toBe("CRITICAL");
      expect(falsifiedViolation?.fmcsaViolationCode).toBe("395.3");
    });
  });

  describe("Cycle violation detection", () => {
    it("should detect cycle limit exceeded", () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const logs: LogEntry[] = [];
      for (let i = 0; i < 7; i++) {
        logs.push({
          id: `log_${i}`,
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000),
          endTime: new Date(
            sevenDaysAgo.getTime() + (i + 1) * 24 * 60 * 60 * 1000
          ),
          dutyStatus: DutyStatus.DRIVING,
          hours: 11,
          sequence: i,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const violations = detector.detectCycleViolations(
        "driver_1",
        "acc_123",
        "vehicle_1",
        logs,
        usPropertyRuleSet
      );

      const cycleViolation = violations.find(
        (v) => v.violationType === "CYCLE_70_HOUR"
      );
      expect(cycleViolation).toBeDefined();
      expect(cycleViolation?.fmcsaViolationCode).toBe("395.8(b)");
    });
  });

  describe("Auto-resolution tracking", () => {
    it("should resolve driving violation after 10-hour rest", () => {
      const violation = {
        id: "vio_1",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        violationType: "DRIVING_11" as const,
        description: "Exceeded 11-hour limit",
        severity: "CRITICAL" as const,
        detectedAt: new Date("2026-03-17T19:30:00Z"),
        violationTimeRange: {
          start: new Date("2026-03-17T08:00:00Z"),
          end: new Date("2026-03-17T19:30:00Z"),
        },
        hosContext: {},
        fmcsaViolationCode: "395.3",
        resolved: false,
        createdAt: new Date("2026-03-17T19:30:00Z"),
      };

      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T19:30:00Z"),
          endTime: new Date("2026-03-18T05:30:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 10,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const autoResolved = detector.checkAutoResolution(violation, logs);
      expect(autoResolved).toBe(true);
    });

    it("should resolve break violation after 30-minute break", () => {
      const violation = {
        id: "vio_1",
        accountId: "acc_123",
        driverId: "driver_1",
        vehicleId: "vehicle_1",
        violationType: "BREAK_30MIN" as const,
        description: "Missing 30-minute break",
        severity: "CRITICAL" as const,
        detectedAt: new Date("2026-03-17T16:30:00Z"),
        violationTimeRange: {
          start: new Date("2026-03-17T08:00:00Z"),
          end: new Date("2026-03-17T16:30:00Z"),
        },
        hosContext: {},
        fmcsaViolationCode: "395.8(a)(3)",
        resolved: false,
        createdAt: new Date(),
      };

      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T16:30:00Z"),
          endTime: new Date("2026-03-17T17:00:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 0.5,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const autoResolved = detector.checkAutoResolution(violation, logs);
      expect(autoResolved).toBe(true);
    });
  });

  describe("Repeat offender tracking", () => {
    it("should calculate repeat offender score", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_repeat",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T20:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 12,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Record multiple violations
      const violations = detector.detectFromDutyChange(
        "driver_repeat",
        "acc_123",
        "vehicle_1",
        logs[0],
        logs,
        usPropertyRuleSet
      );

      detector.recordViolation(violations[0]);
      detector.recordViolation(violations[0]);

      const score = detector.calculateRepeatOffenderScore("driver_repeat");
      expect(score).toBeGreaterThan(0);
    });

    it("should return 0 for driver with no violations", () => {
      const score = detector.calculateRepeatOffenderScore("clean_driver");
      expect(score).toBe(0);
    });

    it("should get repeat offender count", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T20:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 12,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const violations = detector.detectFromDutyChange(
        "driver_1",
        "acc_123",
        "vehicle_1",
        logs[0],
        logs,
        usPropertyRuleSet
      );

      const count = detector.getRepeatOffenderCount("driver_1");
      expect(count).toBeGreaterThanOrEqual(violations.length);
    });
  });

  describe("Violation history management", () => {
    it("should store and retrieve violations", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T20:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 12,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const violations = detector.detectFromDutyChange(
        "driver_1",
        "acc_123",
        "vehicle_1",
        logs[0],
        logs,
        usPropertyRuleSet
      );

      const retrieved = detector.getViolations("acc_123", "driver_1");
      expect(retrieved.length).toBeGreaterThan(0);
    });

    it("should reset violation history", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_reset",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T20:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 12,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      detector.detectFromDutyChange(
        "driver_reset",
        "acc_123",
        "vehicle_1",
        logs[0],
        logs,
        usPropertyRuleSet
      );

      detector.resetDriverViolationHistory("acc_123", "driver_reset");

      const retrieved = detector.getViolations("acc_123", "driver_reset");
      expect(retrieved.length).toBe(0);
    });
  });
});
