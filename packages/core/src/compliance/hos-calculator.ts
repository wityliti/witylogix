/**
 * HOS Calculator - Pure functional clock calculations
 *
 * Computes HOS availability from log entries with support for:
 * - 11-hour driving limit (per 10-hour off-duty period)
 * - 14-hour on-duty window
 * - 30-minute break requirement
 * - 60-hour/7-day or 70-hour/8-day cycles
 * - 34-hour restart with 1-5am periods
 * - Sleeper berth splits (7/3, 8/2)
 * - Timezone-aware calculations
 */

import type {
  LogEntry,
  DutyStatus,
  HOSClock,
  BreakStatus,
  RestartQualification,
  RuleSet,
  CycleRule,
  SleeperBerthSplit,
} from "./hos-types.js";

export class HOSCalculator {
  /**
   * Calculate remaining driving hours before 11-hour limit.
   * 11-hour limit after 10 consecutive hours off-duty (49 CFR 395.8(a)(1))
   */
  static calculateDrivingRemaining(logs: LogEntry[]): number {
    if (logs.length === 0) return 11 * 60; // 660 minutes

    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const driving11Window = this.find11HourWindow(sortedLogs);
    if (!driving11Window) return 11 * 60;

    const drivingMinutes = driving11Window.reduce((sum, log) => {
      return (
        sum +
        (log.dutyStatus === "DRIVING"
          ? Math.round((log.hours * 60) / 60) * 60
          : 0)
      );
    }, 0);

    return Math.max(0, 11 * 60 - drivingMinutes);
  }

  /**
   * Calculate remaining time in 14-hour on-duty window.
   * 14-hour window cannot extend beyond 14 hours (49 CFR 395.8(a)(2))
   */
  static calculateWindowRemaining(logs: LogEntry[]): number {
    if (logs.length === 0) return 14 * 60; // 840 minutes

    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const window14 = this.find14HourWindow(sortedLogs);
    if (!window14) return 14 * 60;

    const windowStartTime = window14[0].startTime.getTime();
    const now = Date.now();
    const elapsedMinutes = Math.round((now - windowStartTime) / 60000);

    return Math.max(0, 14 * 60 - elapsedMinutes);
  }

  /**
   * Calculate remaining driving hours in 8-day cycle.
   * Supports both 60/7-day and 70/8-day limits.
   */
  static calculateCycleRemaining(
    logs: LogEntry[],
    cycleRule: CycleRule
  ): number {
    if (logs.length === 0) {
      return cycleRule.maxDrivingHours * 60;
    }

    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // Get window based on cycle type
    const cycleDays = cycleRule.cycleDays;
    const now = Date.now();
    const windowStart = now - cycleDays * 24 * 3600000;

    const cycleWindow = sortedLogs.filter(
      (log) => log.startTime.getTime() >= windowStart && log.startTime.getTime() <= now
    );

    const drivingMinutes = cycleWindow.reduce((sum, log) => {
      return (
        sum + (log.dutyStatus === "DRIVING" ? Math.round(log.hours * 60) : 0)
      );
    }, 0);

    return Math.max(0, cycleRule.maxDrivingHours * 60 - drivingMinutes);
  }

  /**
   * Calculate break requirement status.
   * 30-minute break required after 8 cumulative hours of driving (49 CFR 395.8(a)(3))
   */
  static calculateBreakRequired(logs: LogEntry[]): BreakStatus {
    if (logs.length === 0) {
      return {
        required: false,
        minutesSinceBreak: 0,
        requiredDurationMinutes: 30,
        breakCompleted: false,
      };
    }

    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // Find the time of last break (off-duty or sleeper)
    let lastBreakTime: Date | null = null;
    for (let i = sortedLogs.length - 1; i >= 0; i--) {
      const log = sortedLogs[i];
      if (
        log.dutyStatus === "OFF_DUTY" ||
        log.dutyStatus === "SLEEPER_BERTH"
      ) {
        // Must be at least 30 minutes
        if (log.hours >= 0.5) {
          lastBreakTime = log.endTime;
          break;
        }
      }
    }

    // Calculate driving since last break
    let drivingMinutesSinceBreak = 0;
    for (const log of sortedLogs) {
      if (lastBreakTime && log.startTime >= lastBreakTime) {
        if (log.dutyStatus === "DRIVING") {
          drivingMinutesSinceBreak += Math.round(log.hours * 60);
        }
      } else if (!lastBreakTime) {
        if (log.dutyStatus === "DRIVING") {
          drivingMinutesSinceBreak += Math.round(log.hours * 60);
        }
      }
    }

    const required = drivingMinutesSinceBreak > 8 * 60;
    const deadline = lastBreakTime
      ? new Date(lastBreakTime.getTime() + 8 * 60 * 60000)
      : undefined;

    return {
      required,
      minutesSinceBreak: drivingMinutesSinceBreak,
      deadline,
      requiredDurationMinutes: 30,
      breakCompleted: !required,
      lastBreakTime,
    };
  }

  /**
   * Calculate when driver can next legally drive.
   * Takes into account 11-hour, 14-hour, break, and cycle limits.
   */
  static calculateNextAvailableDriving(logs: LogEntry[]): Date | null {
    if (logs.length === 0) return null;

    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const lastLog = sortedLogs[sortedLogs.length - 1];
    const baseTime = lastLog.endTime.getTime();

    // Case 1: Need 10-hour break for 11-hour reset
    const driving11Remaining = this.calculateDrivingRemaining(logs);
    if (driving11Remaining === 0) {
      return new Date(baseTime + 10 * 60 * 60000);
    }

    // Case 2: 14-hour window exhausted
    const window14Remaining = this.calculateWindowRemaining(logs);
    if (window14Remaining === 0) {
      const window14 = this.find14HourWindow(sortedLogs);
      if (window14) {
        return new Date(window14[0].startTime.getTime() + 14 * 60 * 60000);
      }
    }

    // Case 3: Need 30-minute break
    const breakStatus = this.calculateBreakRequired(logs);
    if (breakStatus.required && !breakStatus.breakCompleted) {
      if (breakStatus.deadline) {
        return breakStatus.deadline;
      }
    }

    return null;
  }

  /**
   * Calculate sleeper berth credit for cycle restart (US-specific).
   * Supports 7/3 and 8/2 splits that qualify as 10-hour break.
   */
  static calculateSleeperBerthCredit(
    logs: LogEntry[],
    splits: SleeperBerthSplit[]
  ): { qualifies: boolean; creditMinutes: number } {
    if (logs.length === 0) {
      return { qualifies: false, creditMinutes: 0 };
    }

    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // Look for consecutive sleeper + off-duty periods matching defined splits
    for (let i = 0; i < sortedLogs.length - 1; i++) {
      const log1 = sortedLogs[i];
      const log2 = sortedLogs[i + 1];

      if (log1.endTime.getTime() !== log2.startTime.getTime()) continue;

      const isValidPair = [
        log1.dutyStatus === "SLEEPER_BERTH" && log2.dutyStatus === "OFF_DUTY",
        log1.dutyStatus === "OFF_DUTY" && log2.dutyStatus === "SLEEPER_BERTH",
      ].some((condition) => condition);

      if (!isValidPair) continue;

      // Check against defined splits
      for (const split of splits) {
        const hours1 = log1.hours;
        const hours2 = log2.hours;

        if (
          (hours1 === split.firstPeriodHours &&
            hours2 === split.secondPeriodHours) ||
          (hours1 === split.secondPeriodHours &&
            hours2 === split.firstPeriodHours)
        ) {
          return {
            qualifies: true,
            creditMinutes: split.qualifiesAsHours * 60,
          };
        }
      }
    }

    return { qualifies: false, creditMinutes: 0 };
  }

  /**
   * Calculate 34-hour restart eligibility (49 CFR 395.8(a)(4)).
   * US rules require 2x 1-5am periods for restart to be valid.
   */
  static calculate34HourRestart(
    logs: LogEntry[]
  ): RestartQualification {
    if (logs.length === 0) {
      return {
        eligible: true,
        restartHours: 34,
        requiresTwoPeriods1To5Am: true,
        firstPeriodCompleted: false,
        secondPeriodCompleted: false,
      };
    }

    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // Check for consecutive off-duty + sleeper periods totaling >= 34 hours
    let restartStartTime: Date | null = null;
    let restartEndTime: Date | null = null;
    let restartTotalMinutes = 0;

    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];

      if (log.dutyStatus === "OFF_DUTY" || log.dutyStatus === "SLEEPER_BERTH") {
        if (!restartStartTime) {
          restartStartTime = log.startTime;
        }
        restartTotalMinutes += Math.round(log.hours * 60);
        restartEndTime = log.endTime;
      } else {
        if (restartTotalMinutes >= 34 * 60) {
          break;
        }
        restartStartTime = null;
        restartTotalMinutes = 0;
        restartEndTime = null;
      }
    }

    const eligible = restartTotalMinutes >= 34 * 60;

    // Check for 1-5am periods
    let firstPeriodCompleted = false;
    let secondPeriodCompleted = false;

    if (eligible && restartStartTime && restartEndTime) {
      const restartLogs = sortedLogs.filter(
        (log) =>
          log.startTime >= restartStartTime &&
          log.endTime <= restartEndTime &&
          (log.dutyStatus === "OFF_DUTY" || log.dutyStatus === "SLEEPER_BERTH")
      );

      let periodCount = 0;
      for (const log of restartLogs) {
        if (this.hasPeriod1To5Am(log)) {
          periodCount++;
          if (periodCount === 1) firstPeriodCompleted = true;
          if (periodCount === 2) secondPeriodCompleted = true;
        }
      }
    }

    const restartCompleteAt = restartEndTime
      ? new Date(restartEndTime.getTime())
      : undefined;

    return {
      eligible,
      restartHours: 34,
      requiresTwoPeriods1To5Am: true,
      firstPeriodCompleted,
      secondPeriodCompleted,
      restartStartTime,
      restartEndTime,
      restartCompleteAt,
    };
  }

  /**
   * Project when driver can complete available driving.
   * Returns: { canDrive, availableAt, maxDriving }
   */
  static projectAvailability(
    logs: LogEntry[],
    hoursNeeded: number,
    cycleRule: CycleRule
  ): {
    canDrive: boolean;
    availableAt?: Date;
    maxDrivable: number;
  } {
    const drivingRemaining = this.calculateDrivingRemaining(logs);
    const windowRemaining = this.calculateWindowRemaining(logs);
    const cycleRemaining = this.calculateCycleRemaining(logs, cycleRule);
    const breakStatus = this.calculateBreakRequired(logs);

    const maxDrivable = Math.min(
      drivingRemaining,
      windowRemaining,
      cycleRemaining
    );
    const neededMinutes = hoursNeeded * 60;

    if (maxDrivable >= neededMinutes && !breakStatus.required) {
      return { canDrive: true, maxDrivable };
    }

    const nextAvailable = this.calculateNextAvailableDriving(logs);
    return { canDrive: false, availableAt: nextAvailable || undefined, maxDrivable };
  }

  /**
   * Compute complete HOS clock state from logs.
   */
  static computeHOSClock(logs: LogEntry[], ruleSet: RuleSet): HOSClock {
    const now = new Date();
    const drivingRemaining11 = this.calculateDrivingRemaining(logs);
    const windowRemaining14 = this.calculateWindowRemaining(logs);
    const cycleRemaining = this.calculateCycleRemaining(logs, ruleSet.cycleRule);
    const breakStatus = this.calculateBreakRequired(logs);
    const nextAvailable = this.calculateNextAvailableDriving(logs);

    // Calculate current totals for context
    const window14 = this.find14HourWindow(logs);
    let totalOnDutyMinutes14 = 0;
    if (window14) {
      totalOnDutyMinutes14 = window14.reduce((sum, log) => {
        return (
          sum +
          (log.dutyStatus === "DRIVING" || log.dutyStatus === "ON_DUTY"
            ? Math.round(log.hours * 60)
            : 0)
        );
      }, 0);
    }

    const driving11Window = this.find11HourWindow(logs);
    let drivingMinutes11 = 0;
    if (driving11Window) {
      drivingMinutes11 = driving11Window.reduce((sum, log) => {
        return (
          sum + (log.dutyStatus === "DRIVING" ? Math.round(log.hours * 60) : 0)
        );
      }, 0);
    }

    return {
      asOf: now,
      drivingMinutes11,
      drivingRemaining11,
      onDutyMinutes14: Math.max(
        0,
        totalOnDutyMinutes14 - drivingMinutes11
      ),
      totalOnDutyMinutes14,
      windowRemaining14,
      drivingMinutes8Day: (ruleSet.cycleRule.maxDrivingHours * 60) - cycleRemaining,
      cycleRemaining8Day: cycleRemaining,
      minutesSinceBreak: breakStatus.minutesSinceBreak,
      breakRequired: breakStatus.required,
      breakDeadline: breakStatus.deadline,
      canDrive: !breakStatus.required && drivingRemaining11 > 0 && windowRemaining14 > 0,
      nextAvailableDriving: nextAvailable,
    };
  }

  // ─── Helper Methods ──────────────────────────────────────────

  /**
   * Find the 11-hour driving window (after 10 consecutive hours off-duty).
   */
  private static find11HourWindow(logs: LogEntry[]): LogEntry[] | null {
    if (logs.length === 0) return null;

    // Start from the most recent log and work backwards
    const now = Date.now();
    const sortedLogs = [...logs].sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );

    let offDutyStart: Date | null = null;

    for (const log of sortedLogs) {
      if (log.dutyStatus === "OFF_DUTY" || log.dutyStatus === "SLEEPER_BERTH") {
        // Track off-duty start
        if (!offDutyStart) {
          offDutyStart = log.startTime;
        }
      } else {
        // Driving or on-duty
        if (offDutyStart) {
          const offDutyMinutes = (offDutyStart.getTime() - log.endTime.getTime()) / 60000;
          if (offDutyMinutes >= 10 * 60) {
            // Found 10-hour off-duty period
            return sortedLogs
              .filter((l) => l.startTime >= log.endTime && l.startTime <= new Date(now))
              .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
          }
        }
        offDutyStart = null;
      }
    }

    return sortedLogs
      .filter((l) => l.startTime <= new Date(now))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Find the 14-hour on-duty window (starts with first on-duty/driving).
   */
  private static find14HourWindow(logs: LogEntry[]): LogEntry[] | null {
    if (logs.length === 0) return null;

    const now = Date.now();
    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // Find the first on-duty or driving after last off-duty
    let windowStart: Date | null = null;

    for (let i = sortedLogs.length - 1; i >= 0; i--) {
      const log = sortedLogs[i];

      if (log.dutyStatus === "OFF_DUTY" || log.dutyStatus === "SLEEPER_BERTH") {
        windowStart = log.endTime;
        break;
      }
    }

    if (!windowStart) {
      windowStart = sortedLogs[0].startTime;
    }

    const windowEnd = new Date(windowStart.getTime() + 14 * 60 * 60000);

    return sortedLogs.filter(
      (l) =>
        l.startTime >= windowStart &&
        l.startTime <= new Date(Math.min(windowEnd.getTime(), now))
    );
  }

  /**
   * Check if log contains period between 1-5am.
   */
  private static hasPeriod1To5Am(log: LogEntry): boolean {
    const start = log.startTime;
    const end = log.endTime;

    // Check if any part of the log falls between 1-5am
    const startHour = start.getHours();
    const endHour = end.getHours();

    // Simple check: start is between 1-5am or end is between 1-5am
    return (startHour >= 1 && startHour < 5) || (endHour > 1 && endHour <= 5);
  }
}
