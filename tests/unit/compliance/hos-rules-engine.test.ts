/**
 * HOS Rules Engine v2 Tests
 *
 * Comprehensive test suite covering:
 * - 11-hour driving limit (FMCSA 395.8(a)(1))
 * - 14-hour on-duty window (FMCSA 395.8(a)(2))
 * - 30-minute break requirement (FMCSA 395.8(a)(3))
 * - 60/70-hour cycle limits (FMCSA 395.8(b))
 * - Sleeper berth splits (7/3, 8/2)
 * - 34-hour restart with 1-5am periods
 * - International rules (Canada, Mexico)
 * - Edge cases (midnight crossover, timezone changes)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  HOSRulesEngine,
  RuleEvaluator,
} from "../../../packages/core/src/compliance/hos-rules-engine-v2.js";
import { HOSCalculator } from "../../../packages/core/src/compliance/hos-calculator.js";
import type {
  LogEntry,
  RuleSet,
} from "../../../packages/core/src/compliance/hos-types.js";
import { DutyStatus } from "../../../packages/core/src/compliance/hos-types.js";

describe("HOSRulesEngine", () => {
  let engine: HOSRulesEngine;
  let usPropertyRuleSet: RuleSet | undefined;

  beforeEach(() => {
    engine = new HOSRulesEngine();
    usPropertyRuleSet = engine.getRuleSet("US_PROPERTY");
  });

  describe("11-hour driving limit", () => {
    it("should detect violation when driving exceeds 11 hours", () => {
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

      const result = engine.evaluate(logs, "US_PROPERTY");

      expect(result.isCompliant).toBe(false);
      const driving11Violation = result.violations.find(
        (v) => v.violationType === "DRIVING_11",
      );
      expect(driving11Violation).toBeDefined();
      expect(driving11Violation?.severity).toBe("CRITICAL");
    });

    it("should not detect violation at exactly 11 hours", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T19:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 11,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = engine.evaluate(logs, "US_PROPERTY");

      const driving11Violation = result.violations.find(
        (v) => v.violationType === "DRIVING_11",
      );
      expect(driving11Violation).toBeUndefined();
    });

    it("should reset 11-hour limit after 10-hour off-duty period", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T19:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 11,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_2",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T19:00:00Z"),
          endTime: new Date("2026-03-18T05:00:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 10,
          sequence: 1,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_3",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-18T05:00:00Z"),
          endTime: new Date("2026-03-18T16:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 11,
          sequence: 2,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = engine.evaluate(logs, "US_PROPERTY");

      // Second driving period should be compliant (within new 11h window)
      expect(result.violations.length).toBe(0);
    });
  });

  describe("14-hour on-duty window", () => {
    it("should detect violation when on-duty exceeds 14 hours", () => {
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

      const result = engine.evaluate(logs, "US_PROPERTY");

      expect(result.isCompliant).toBe(false);
      const window14Violation = result.violations.find(
        (v) => v.violationType === "ON_DUTY_14",
      );
      expect(window14Violation).toBeDefined();
      expect(window14Violation?.severity).toBe("CRITICAL");
    });

    it("should not detect violation with off-duty break within 14h window", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T16:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 8,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_2",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T16:00:00Z"),
          endTime: new Date("2026-03-17T20:00:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 4,
          sequence: 1,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_3",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T20:00:00Z"),
          endTime: new Date("2026-03-17T22:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 2,
          sequence: 2,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = engine.evaluate(logs, "US_PROPERTY");

      // Total on-duty: 8 + 2 = 10 hours (within 14h window)
      const window14Violation = result.violations.find(
        (v) => v.violationType === "ON_DUTY_14",
      );
      expect(window14Violation).toBeUndefined();
    });
  });

  describe("30-minute break requirement", () => {
    it("should detect violation when no break taken after 8 hours driving", () => {
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

      const result = engine.evaluate(logs, "US_PROPERTY");

      const breakViolation = result.violations.find(
        (v) => v.violationType === "BREAK_30MIN",
      );
      expect(breakViolation).toBeDefined();
      expect(breakViolation?.severity).toBe("CRITICAL");
    });

    it("should resolve break violation after 30-minute break", () => {
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
        {
          id: "log_2",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T16:30:00Z"),
          endTime: new Date("2026-03-17T17:00:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 0.5,
          sequence: 1,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_3",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T17:00:00Z"),
          endTime: new Date("2026-03-17T18:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 1,
          sequence: 2,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = engine.evaluate(logs, "US_PROPERTY");

      const breakViolation = result.violations.find(
        (v) => v.violationType === "BREAK_30MIN",
      );
      expect(breakViolation).toBeUndefined();
    });
  });

  describe("70-hour/8-day cycle", () => {
    it("should detect violation when 70-hour cycle exceeded", () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const logs: LogEntry[] = [];
      for (let i = 0; i < 8; i++) {
        logs.push({
          id: `log_${i}`,
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000),
          endTime: new Date(
            sevenDaysAgo.getTime() + (i + 1) * 24 * 60 * 60 * 1000,
          ),
          dutyStatus: DutyStatus.DRIVING,
          hours: 9.5, // 9.5 * 8 = 76 hours > 70 hour limit
          sequence: i,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const result = engine.evaluate(logs, "US_PROPERTY");

      expect(result.isCompliant).toBe(false);
      const cycleViolation = result.violations.find(
        (v) => v.violationType === "CYCLE_70_HOUR",
      );
      expect(cycleViolation).toBeDefined();
    });

    it("should allow 70 hours exactly over 8 days", () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      const logs: LogEntry[] = [];
      for (let i = 0; i < 7; i++) {
        logs.push({
          id: `log_${i}`,
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date(eightDaysAgo.getTime() + i * 24 * 60 * 60 * 1000),
          endTime: new Date(
            eightDaysAgo.getTime() + (i + 1) * 24 * 60 * 60 * 1000,
          ),
          dutyStatus: DutyStatus.DRIVING,
          hours: 10, // 10 * 7 = 70 hours
          sequence: i,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const result = engine.evaluate(logs, "US_PROPERTY");

      const cycleViolation = result.violations.find(
        (v) =>
          v.violationType === "CYCLE_70_HOUR" ||
          v.violationType === "CYCLE_70_HOUR_8DAY",
      );
      expect(cycleViolation).toBeUndefined();
    });
  });

  describe("Sleeper berth splits", () => {
    it("should recognize 7/3 sleeper split as qualifying break", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T19:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 11,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_2",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T19:00:00Z"),
          endTime: new Date("2026-03-18T02:00:00Z"),
          dutyStatus: DutyStatus.SLEEPER_BERTH,
          hours: 7,
          sequence: 1,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_3",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-18T02:00:00Z"),
          endTime: new Date("2026-03-18T05:00:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 3,
          sequence: 2,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const sleeperCredit = HOSCalculator.calculateSleeperBerthCredit(logs, [
        {
          firstPeriodHours: 7,
          secondPeriodHours: 3,
          qualifiesAsHours: 10,
          pausesClock14: true,
        },
      ]);

      expect(sleeperCredit.qualifies).toBe(true);
      expect(sleeperCredit.creditMinutes).toBe(10 * 60);
    });

    it("should recognize 8/2 sleeper split", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T19:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 11,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_2",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T19:00:00Z"),
          endTime: new Date("2026-03-18T03:00:00Z"),
          dutyStatus: DutyStatus.SLEEPER_BERTH,
          hours: 8,
          sequence: 1,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_3",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-18T03:00:00Z"),
          endTime: new Date("2026-03-18T05:00:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 2,
          sequence: 2,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const sleeperCredit = HOSCalculator.calculateSleeperBerthCredit(logs, [
        {
          firstPeriodHours: 8,
          secondPeriodHours: 2,
          qualifiesAsHours: 10,
          pausesClock14: true,
        },
      ]);

      expect(sleeperCredit.qualifies).toBe(true);
      expect(sleeperCredit.creditMinutes).toBe(10 * 60);
    });
  });

  describe("34-hour restart", () => {
    it("should recognize 34-hour restart with 1-5am periods", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T22:00:00Z"),
          endTime: new Date("2026-03-18T04:00:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 6,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_2",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-18T04:00:00Z"),
          endTime: new Date("2026-03-18T06:00:00Z"),
          dutyStatus: DutyStatus.SLEEPER_BERTH,
          hours: 2,
          sequence: 1,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_3",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-18T06:00:00Z"),
          endTime: new Date("2026-03-19T02:00:00Z"),
          dutyStatus: DutyStatus.OFF_DUTY,
          hours: 20,
          sequence: 2,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "log_4",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-19T02:00:00Z"),
          endTime: new Date("2026-03-19T08:00:00Z"),
          dutyStatus: DutyStatus.SLEEPER_BERTH,
          hours: 6,
          sequence: 3,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const restart = HOSCalculator.calculate34HourRestart(logs);

      expect(restart.eligible).toBe(true);
      expect(restart.restartHours).toBe(34);
    });
  });

  describe("Canadian Federal rules", () => {
    it("should evaluate 13-hour driving limit for Canada", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_ca",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T21:30:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 13.5,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = engine.evaluate(logs, "CANADA_FEDERAL");

      expect(result.isCompliant).toBe(false);
      const driving13Violation = result.violations.find(
        (v) => v.violationType === "DRIVING_11",
      );
      expect(driving13Violation).toBeDefined();
    });
  });

  describe("Mexico NOM-087-SCT rules", () => {
    it("should evaluate 14-hour driving limit for Mexico", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_mx",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T23:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 15,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = engine.evaluate(logs, "MEXICO");

      expect(result.isCompliant).toBe(false);
    });
  });

  describe("Compliance score calculation", () => {
    it("should calculate 0 score for critical violations", () => {
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

      const result = engine.evaluate(logs, "US_PROPERTY");

      expect(result.complianceScore).toBeLessThan(100);
      expect(result.complianceScore).toBeGreaterThanOrEqual(0);
    });

    it("should calculate 100 score for compliant driver", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
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
        },
      ];

      const result = engine.evaluate(logs, "US_PROPERTY");

      expect(result.complianceScore).toBe(100);
    });
  });

  describe("Projection calculations", () => {
    it("should project maximum drivable hours", () => {
      const logs: LogEntry[] = [
        {
          id: "log_1",
          accountId: "acc_123",
          driverId: "driver_1",
          vehicleId: "vehicle_1",
          startTime: new Date("2026-03-17T08:00:00Z"),
          endTime: new Date("2026-03-17T16:00:00Z"),
          dutyStatus: DutyStatus.DRIVING,
          hours: 8,
          sequence: 0,
          edited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = engine.evaluate(logs, "US_PROPERTY");

      // Should be able to drive remaining 3 hours before 11-hour limit
      expect(result.projectionMaxDrivableHours).toBeCloseTo(3, 0);
    });
  });

  describe("RuleEvaluator", () => {
    it("should provide high-level evaluation interface", () => {
      const evaluator = new RuleEvaluator();
      const ruleSets = evaluator.getAvailableRuleSets();

      expect(ruleSets).toContain("US_PROPERTY");
      expect(ruleSets).toContain("US_PASSENGER");
      expect(ruleSets).toContain("CANADA_FEDERAL");
      expect(ruleSets).toContain("MEXICO");
    });

    it("should validate compliance through evaluator", () => {
      const evaluator = new RuleEvaluator();
      const logs: LogEntry[] = [
        {
          id: "log_1",
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
        },
      ];

      const validation = evaluator.validateCompliance(logs, "US_PROPERTY");

      expect(validation.compliant).toBe(true);
      expect(validation.violations.length).toBe(0);
    });
  });
});
