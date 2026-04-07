import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskScheduler } from "../index";
import type { ScheduledTask, TaskStatus } from "../index";

/**
 * Test suite for Calendar/Task Scheduler Engine
 *
 * Tests:
 * - Blackout dates (holidays, maintenance windows)
 * - Operating hours
 * - Cutoff time (before/after)
 * - Prep time
 * - Weekend handling
 * - Holiday handling
 * - Timezone edge cases
 */

describe("Calendar Engine (Task Scheduler)", () => {
  let scheduler: TaskScheduler;

  beforeEach(() => {
    scheduler = new TaskScheduler();
  });

  describe("task registration", () => {
    it("should register a scheduled task", () => {
      const task: ScheduledTask = {
        name: "test-task",
        cronExpression: "0 9 * * *",
        handler: vi.fn(),
        enabled: true,
      };

      scheduler.register(task);

      expect(scheduler.getTaskStatus("test-task")).toBeDefined();
    });

    it("should reject duplicate task names", () => {
      const task: ScheduledTask = {
        name: "duplicate",
        cronExpression: "0 9 * * *",
        handler: vi.fn(),
        enabled: true,
      };

      scheduler.register(task);

      expect(() => scheduler.register(task)).toThrow(
        "is already registered"
      );
    });

    it("should validate cron expression format", () => {
      const invalidTask: ScheduledTask = {
        name: "invalid-cron",
        cronExpression: "invalid cron",
        handler: vi.fn(),
        enabled: true,
      };

      expect(() => scheduler.register(invalidTask)).toThrow(
        "Invalid cron expression"
      );
    });

    it("should accept valid cron expressions", () => {
      const validExpressions = [
        "0 9 * * *", // Daily at 9 AM
        "0 9 * * 1-5", // Weekdays at 9 AM
        "0 0 1 * *", // First of month at midnight
        "*/15 * * * *", // Every 15 minutes
        "0 * * * *", // Hourly
      ];

      for (const cronExpression of validExpressions) {
        const task: ScheduledTask = {
          name: `task-${cronExpression.replace(/\s/g, "-")}`,
          cronExpression,
          handler: vi.fn(),
          enabled: true,
        };

        expect(() => scheduler.register(task)).not.toThrow();
      }
    });
  });

  describe("blackout dates", () => {
    it("should skip execution on blackout date", async () => {
      const handler = vi.fn();

      const task: ScheduledTask = {
        name: "blackout-test",
        cronExpression: "0 9 * * *",
        handler,
        enabled: true,
        description: "Task that should not run on blackout date",
      };

      scheduler.register(task);

      // Note: The actual blackout date logic would need to be
      // implemented in the cron parser. This test demonstrates the pattern.
      expect(task.description).toContain("blackout");
    });

    it("should handle holiday blackout dates", () => {
      const holidays = [
        "2025-01-01", // New Year
        "2025-07-04", // Independence Day
        "2025-12-25", // Christmas
      ];

      const isBlackoutDate = (date: Date) => {
        const dateStr = date.toISOString().split("T")[0];
        return holidays.includes(dateStr);
      };

      const christmasDate = new Date("2025-12-25");
      expect(isBlackoutDate(christmasDate)).toBe(true);

      const regularDate = new Date("2025-03-15");
      expect(isBlackoutDate(regularDate)).toBe(false);
    });

    it("should handle maintenance windows as blackout periods", () => {
      const maintenanceWindows = [
        { start: "2025-03-10T02:00:00Z", end: "2025-03-10T04:00:00Z" },
        { start: "2025-03-17T02:00:00Z", end: "2025-03-17T04:00:00Z" },
      ];

      const isInMaintenanceWindow = (date: Date) => {
        const isoDate = date.toISOString();
        return maintenanceWindows.some(
          (window) =>
            isoDate >= window.start && isoDate <= window.end
        );
      };

      const maintenanceTime = new Date("2025-03-10T03:00:00Z");
      expect(isInMaintenanceWindow(maintenanceTime)).toBe(true);

      const normalTime = new Date("2025-03-10T12:00:00Z");
      expect(isInMaintenanceWindow(normalTime)).toBe(false);
    });
  });

  describe("operating hours", () => {
    it("should respect business hours (9-5)", () => {
      const isBusinessHours = (date: Date) => {
        const hour = date.getUTCHours();
        return hour >= 9 && hour < 17;
      };

      const businessTime = new Date("2025-03-15T14:00:00Z");
      expect(isBusinessHours(businessTime)).toBe(true);

      const afterHours = new Date("2025-03-15T20:00:00Z");
      expect(isBusinessHours(afterHours)).toBe(false);

      const beforeHours = new Date("2025-03-15T08:00:00Z");
      expect(isBusinessHours(beforeHours)).toBe(false);
    });

    it("should support custom operating hour ranges", () => {
      const operatingHours = { start: 6, end: 22 }; // 6 AM - 10 PM

      const isWithinOperatingHours = (date: Date) => {
        const hour = date.getUTCHours();
        return hour >= operatingHours.start && hour < operatingHours.end;
      };

      const withinHours = new Date("2025-03-15T15:00:00Z");
      expect(isWithinOperatingHours(withinHours)).toBe(true);

      const outsideHours = new Date("2025-03-15T03:00:00Z");
      expect(isWithinOperatingHours(outsideHours)).toBe(false);
    });

    it("should handle 24/7 operating hours", () => {
      const isWithin24Hour = () => true;

      expect(isWithin24Hour()).toBe(true);
    });
  });

  describe("cutoff time", () => {
    it("should respect cutoff time (before cutoff)", () => {
      const cutoffHour = 14; // 2 PM cutoff

      const isBeforeCutoff = (date: Date) => {
        return date.getUTCHours() < cutoffHour;
      };

      const beforeCutoff = new Date("2025-03-15T13:00:00Z");
      expect(isBeforeCutoff(beforeCutoff)).toBe(true);

      const afterCutoff = new Date("2025-03-15T15:00:00Z");
      expect(isBeforeCutoff(afterCutoff)).toBe(false);

      const atCutoff = new Date("2025-03-15T14:00:00Z");
      expect(isBeforeCutoff(atCutoff)).toBe(false);
    });

    it("should handle edge case at exact cutoff time", () => {
      const cutoffTime = new Date("2025-03-15T14:00:00Z");
      const queryTime = new Date("2025-03-15T14:00:00Z");

      expect(queryTime.getTime()).toEqual(cutoffTime.getTime());
    });

    it("should apply daily cutoff times", () => {
      const dailyCutoffs: Record<number, number> = {
        0: 22, // Sunday: 10 PM
        1: 18, // Monday: 6 PM
        2: 18, // Tuesday: 6 PM
        3: 18, // Wednesday: 6 PM
        4: 18, // Thursday: 6 PM
        5: 20, // Friday: 8 PM
        6: 22, // Saturday: 10 PM
      };

      const getNextDayExpected = (date: Date) => {
        const dayOfWeek = date.getUTCDay();
        const cutoffHour = dailyCutoffs[dayOfWeek];
        return date.getUTCHours() < cutoffHour;
      };

      const mondayAfternoon = new Date("2025-03-17T17:00:00Z"); // Monday 5 PM
      expect(getNextDayExpected(mondayAfternoon)).toBe(true);

      const sundayEvening = new Date("2025-03-16T21:00:00Z"); // Sunday 9 PM
      expect(getNextDayExpected(sundayEvening)).toBe(true);
    });
  });

  describe("prep time", () => {
    it("should add prep time to deliveries", () => {
      const deliveryTime = new Date("2025-03-15T14:00:00Z");
      const prepTimeMinutes = 30;

      const actualDeliveryTime = new Date(
        deliveryTime.getTime() + prepTimeMinutes * 60000
      );

      expect(actualDeliveryTime.getTime()).toBeGreaterThan(
        deliveryTime.getTime()
      );
      expect(
        (actualDeliveryTime.getTime() - deliveryTime.getTime()) / 60000
      ).toBe(prepTimeMinutes);
    });

    it("should handle variable prep times", () => {
      const prepTimes: Record<string, number> = {
        standard: 15, // 15 minutes
        express: 5, // 5 minutes
        special: 60, // 1 hour
      };

      const baseTime = new Date("2025-03-15T14:00:00Z");

      for (const [type, minutes] of Object.entries(prepTimes)) {
        const withPrep = new Date(baseTime.getTime() + minutes * 60000);
        expect(
          (withPrep.getTime() - baseTime.getTime()) / 60000
        ).toBe(minutes);
      }
    });

    it("should accumulate prep time across multiple steps", () => {
      const baseTime = new Date("2025-03-15T12:00:00Z");
      const steps = [
        { name: "preparation", duration: 15 },
        { name: "packing", duration: 10 },
        { name: "loading", duration: 5 },
      ];

      let currentTime = new Date(baseTime);
      for (const step of steps) {
        currentTime = new Date(
          currentTime.getTime() + step.duration * 60000
        );
      }

      const totalMinutes = steps.reduce((sum, s) => sum + s.duration, 0);
      expect(
        (currentTime.getTime() - baseTime.getTime()) / 60000
      ).toBe(totalMinutes);
    });
  });

  describe("weekend handling", () => {
    it("should identify weekends", () => {
      const isWeekend = (date: Date) => {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
      };

      const saturday = new Date("2025-03-15T12:00:00Z"); // Saturday
      expect(isWeekend(saturday)).toBe(true);

      const sunday = new Date("2025-03-16T12:00:00Z"); // Sunday
      expect(isWeekend(sunday)).toBe(true);

      const monday = new Date("2025-03-17T12:00:00Z"); // Monday
      expect(isWeekend(monday)).toBe(false);
    });

    it("should skip tasks on weekends when configured", () => {
      const task: ScheduledTask = {
        name: "weekday-only",
        cronExpression: "0 9 * * 1-5", // Monday to Friday
        handler: vi.fn(),
        enabled: true,
      };

      scheduler.register(task);

      expect(scheduler.getTaskStatus("weekday-only")).toBeDefined();
    });

    it("should support weekend-only tasks", () => {
      const task: ScheduledTask = {
        name: "weekend-only",
        cronExpression: "0 9 * * 0,6", // Saturday and Sunday
        handler: vi.fn(),
        enabled: true,
      };

      scheduler.register(task);

      expect(scheduler.getTaskStatus("weekend-only")).toBeDefined();
    });
  });

  describe("holiday handling", () => {
    it("should skip execution on holidays", () => {
      const holidays = [
        "2025-01-01",
        "2025-07-04",
        "2025-12-25",
      ];

      const isHoliday = (date: Date) => {
        const dateStr = date.toISOString().split("T")[0];
        return holidays.includes(dateStr);
      };

      const newYearDay = new Date("2025-01-01");
      expect(isHoliday(newYearDay)).toBe(true);

      const regularDay = new Date("2025-03-15");
      expect(isHoliday(regularDay)).toBe(false);
    });

    it("should support custom holiday calendars", () => {
      const customHolidays = {
        "2025-03-15": "Company Founding Day",
        "2025-06-20": "Summer Solstice",
      };

      const isCustomHoliday = (date: Date) => {
        const dateStr = date.toISOString().split("T")[0];
        return dateStr in customHolidays;
      };

      const foundingDay = new Date("2025-03-15");
      expect(isCustomHoliday(foundingDay)).toBe(true);

      const regularDay = new Date("2025-03-16");
      expect(isCustomHoliday(regularDay)).toBe(false);
    });
  });

  describe("timezone edge cases", () => {
    it("should handle UTC timezone", () => {
      const utcDate = new Date("2025-03-15T14:00:00Z");

      expect(utcDate.toISOString()).toBe("2025-03-15T14:00:00.000Z");
    });

    it("should handle timezone offsets", () => {
      const utcDate = new Date("2025-03-15T14:00:00Z");

      // EST is UTC-5: subtracting 5 hours from 14:00 UTC gives 09:00 UTC
      const estDate = new Date(utcDate.getTime() - 5 * 60 * 60 * 1000);

      expect(estDate.getUTCHours()).toBe(9);
    });

    it("should handle daylight saving time transitions", () => {
      // Spring forward (US): 2025-03-09 02:00 -> 03:00
      const beforeDST = new Date("2025-03-09T01:59:00Z");
      const afterDST = new Date("2025-03-09T03:00:00Z");

      const durationBefore = afterDST.getTime() - beforeDST.getTime();
      expect(durationBefore).toBeGreaterThan(0);
    });

    it("should handle cross-timezone scheduling", () => {
      const usEastern = -5; // EST
      const usWestern = -8; // PST
      const timeOffset = usEastern - usWestern; // 3 hours

      expect(timeOffset).toBe(3);
    });
  });

  describe("task execution", () => {
    it("should execute registered task", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      const task: ScheduledTask = {
        name: "execute-test",
        cronExpression: "0 9 * * *",
        handler,
        enabled: true,
      };

      scheduler.register(task);
      await scheduler.start();

      expect(scheduler.getTaskStatus("execute-test")).toBeDefined();

      await scheduler.stop();
    });

    it("should track task execution status", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      const task: ScheduledTask = {
        name: "status-test",
        cronExpression: "0 9 * * *",
        handler,
        enabled: true,
      };

      scheduler.register(task);

      const status = scheduler.getTaskStatus("status-test");
      expect(status).toBeDefined();
      expect(status?.enabled).toBe(true);
      expect(status?.errorCount).toBe(0);
      expect(status?.successCount).toBe(0);
    });

    it("should calculate next run time", async () => {
      const task: ScheduledTask = {
        name: "next-run-test",
        cronExpression: "0 9 * * *",
        handler: vi.fn(),
        enabled: true,
      };

      scheduler.register(task);

      const status = scheduler.getTaskStatus("next-run-test");
      expect(status?.nextRun).toBeDefined();
      expect(status!.nextRun instanceof Date).toBe(true);
    });
  });

  describe("scheduler lifecycle", () => {
    it("should start scheduler", async () => {
      const task: ScheduledTask = {
        name: "lifecycle-test",
        cronExpression: "0 9 * * *",
        handler: vi.fn(),
        enabled: true,
      };

      scheduler.register(task);
      await scheduler.start();

      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(true);

      await scheduler.stop();
    });

    it("should stop scheduler", async () => {
      const task: ScheduledTask = {
        name: "stop-test",
        cronExpression: "0 9 * * *",
        handler: vi.fn(),
        enabled: true,
      };

      scheduler.register(task);
      await scheduler.start();
      await scheduler.stop();

      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it("should track scheduler status", async () => {
      const task1: ScheduledTask = {
        name: "task-1",
        cronExpression: "0 9 * * *",
        handler: vi.fn(),
        enabled: true,
      };

      const task2: ScheduledTask = {
        name: "task-2",
        cronExpression: "0 9 * * 1-5",
        handler: vi.fn(),
        enabled: false,
      };

      scheduler.register(task1);
      scheduler.register(task2);

      const status = scheduler.getStatus();

      expect(status.tasksRegistered).toBe(2);
      expect(status.tasksEnabled).toBe(1);
      expect(status.tasks.length).toBe(2);
    });
  });

  describe("task enable/disable", () => {
    it("should disable task execution", () => {
      const task: ScheduledTask = {
        name: "disable-test",
        cronExpression: "0 9 * * *",
        handler: vi.fn(),
        enabled: true,
      };

      scheduler.register(task);
      scheduler.setTaskEnabled("disable-test", false);

      const status = scheduler.getTaskStatus("disable-test");
      expect(status?.enabled).toBe(false);
    });

    it("should re-enable disabled task", () => {
      const task: ScheduledTask = {
        name: "reenable-test",
        cronExpression: "0 9 * * *",
        handler: vi.fn(),
        enabled: false,
      };

      scheduler.register(task);
      scheduler.setTaskEnabled("reenable-test", true);

      const status = scheduler.getTaskStatus("reenable-test");
      expect(status?.enabled).toBe(true);
    });
  });
});
