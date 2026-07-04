/**
 * HOS Violation Detector - Real-time violation detection from duty status changes
 *
 * Detects:
 * - Driving after 11h limit (Form/Manner violation)
 * - Beyond 14h window
 * - Missing 30-min break
 * - Cycle limit exceeded
 * - Incomplete daily logs
 * - Falsified logs (GPS vs duty status discrepancy)
 *
 * Tracks:
 * - Violation severity (CRITICAL, WARNING, INFO)
 * - Auto-resolution after rest periods
 * - Repeat offender scoring
 * - FMCSA violation codes (395.3, 395.8, etc.)
 */

import type {
  LogEntry,
  DutyStatus,
  HOSViolation,
  RuleSet,
} from "./hos-types.js";
import { HOSCalculator } from "./hos-calculator.js";

/**
 * Real-time violation detection and tracking.
 */
export class ViolationDetector {
  private violations: Map<string, HOSViolation[]> = new Map();
  private repeatOffenders: Map<string, number> = new Map();

  /**
   * Detect violations when duty status changes.
   * Called after each new log entry to immediately flag violations.
   */
  detectFromDutyChange(
    driverId: string,
    accountId: string,
    vehicleId: string,
    newLog: LogEntry,
    allLogs: LogEntry[],
    ruleSet: RuleSet,
  ): HOSViolation[] {
    const detectedViolations: HOSViolation[] = [];

    // 1. Check for driving after 11h limit
    const driving11Remaining = HOSCalculator.calculateDrivingRemaining(allLogs);
    if (newLog.dutyStatus === "DRIVING" && driving11Remaining <= 0) {
      detectedViolations.push({
        id: `vio_${Date.now()}_11h_active`,
        accountId,
        driverId,
        vehicleId,
        violationType: "DRIVING_11",
        description:
          "Driver is operating vehicle after exhausting 11-hour driving limit",
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: newLog.startTime,
          end: newLog.endTime,
        },
        hosContext: { hours11: driving11Remaining },
        fmcsaViolationCode: "395.3",
        resolved: false,
        createdAt: new Date(),
      });
    }

    // 2. Check for operating beyond 14h window
    const window14Remaining = HOSCalculator.calculateWindowRemaining(allLogs);
    if (
      (newLog.dutyStatus === "DRIVING" || newLog.dutyStatus === "ON_DUTY") &&
      window14Remaining <= 0
    ) {
      detectedViolations.push({
        id: `vio_${Date.now()}_14h_active`,
        accountId,
        driverId,
        vehicleId,
        violationType: "ON_DUTY_14",
        description: "Driver is on-duty beyond 14-hour operating window",
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: newLog.startTime,
          end: newLog.endTime,
        },
        hosContext: { hours14: window14Remaining },
        fmcsaViolationCode: "395.3",
        resolved: false,
        createdAt: new Date(),
      });
    }

    // 3. Check for missing 30-minute break
    const breakStatus = HOSCalculator.calculateBreakRequired(allLogs);
    if (
      newLog.dutyStatus === "DRIVING" &&
      breakStatus.required &&
      breakStatus.minutesSinceBreak > 8 * 60
    ) {
      detectedViolations.push({
        id: `vio_${Date.now()}_break_missing`,
        accountId,
        driverId,
        vehicleId,
        violationType: "BREAK_30MIN",
        description: `Driver exceeded 8 hours of driving without required 30-minute break`,
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: breakStatus.lastBreakTime || newLog.startTime,
          end: newLog.endTime,
        },
        hosContext: { minutesSinceBreak: breakStatus.minutesSinceBreak },
        fmcsaViolationCode: "395.8(a)(3)",
        resolved: false,
        createdAt: new Date(),
      });
    }

    // 4. Form/Manner violation - incomplete daily log
    if (!this.isLogComplete(newLog)) {
      detectedViolations.push({
        id: `vio_${Date.now()}_form_manner`,
        accountId,
        driverId,
        vehicleId,
        violationType: "FORM_MANNER",
        description: "Incomplete or improperly formatted log entry",
        severity: "WARNING",
        detectedAt: new Date(),
        violationTimeRange: {
          start: newLog.startTime,
          end: newLog.endTime,
        },
        hosContext: {},
        fmcsaViolationCode: "395.8(a)",
        resolved: false,
        createdAt: new Date(),
      });
    }

    // 5. Falsified log detection (GPS vs duty status discrepancy)
    const falsificationFlag = this.detectFalsifiedLog(
      newLog,
      allLogs.slice(-5),
    );
    if (falsificationFlag) {
      detectedViolations.push({
        id: `vio_${Date.now()}_falsified`,
        accountId,
        driverId,
        vehicleId,
        violationType: "FALSIFIED_LOG",
        description:
          "Suspected falsified log: GPS movement inconsistent with duty status",
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: newLog.startTime,
          end: newLog.endTime,
        },
        hosContext: {},
        fmcsaViolationCode: "395.3",
        resolved: false,
        createdAt: new Date(),
      });
    }

    // Store violations for this driver
    const key = `${accountId}:${driverId}`;
    if (!this.violations.has(key)) {
      this.violations.set(key, []);
    }
    this.violations.get(key)!.push(...detectedViolations);

    // Update repeat offender count
    this.updateRepeatOffender(driverId, detectedViolations);

    return detectedViolations;
  }

  /**
   * Detect cycle limit violations.
   */
  detectCycleViolations(
    driverId: string,
    accountId: string,
    vehicleId: string,
    logs: LogEntry[],
    ruleSet: RuleSet,
  ): HOSViolation[] {
    const detectedViolations: HOSViolation[] = [];

    const cycleRemaining = HOSCalculator.calculateCycleRemaining(
      logs,
      ruleSet.cycleRule,
    );

    if (cycleRemaining < 0) {
      detectedViolations.push({
        id: `vio_${Date.now()}_cycle`,
        accountId,
        driverId,
        vehicleId,
        violationType:
          ruleSet.cycleRule.ruleType === "70_HOUR_8_DAY"
            ? "CYCLE_70_HOUR"
            : "CYCLE_60_HOUR",
        description: `Driver exceeded ${ruleSet.cycleRule.ruleType} cycle limit`,
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: logs[0].startTime,
          end: logs[logs.length - 1].endTime,
        },
        hosContext: {},
        fmcsaViolationCode: "395.8(b)",
        resolved: false,
        createdAt: new Date(),
      });
    }

    return detectedViolations;
  }

  /**
   * Check if violation has auto-resolved due to rest.
   * A driving violation clears after 10-hour off-duty period.
   */
  checkAutoResolution(
    violation: HOSViolation,
    currentLogs: LogEntry[],
  ): boolean {
    if (!currentLogs || currentLogs.length === 0) return false;

    const sortedLogs = [...currentLogs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    // For driving violations, check if adequate rest has been taken
    if (
      violation.violationType === "DRIVING_11" ||
      violation.violationType === "ON_DUTY_14"
    ) {
      // Look for 10-hour off-duty period after violation
      let offDutyMinutes = 0;
      for (let i = sortedLogs.length - 1; i >= 0; i--) {
        const log = sortedLogs[i];
        if (log.startTime >= violation.violationTimeRange.end) {
          if (
            log.dutyStatus === "OFF_DUTY" ||
            log.dutyStatus === "SLEEPER_BERTH"
          ) {
            offDutyMinutes += Math.round(log.hours * 60);
          } else {
            break;
          }
        }
      }

      return offDutyMinutes >= 10 * 60;
    }

    // For break violations, check if 30-minute break was taken
    if (violation.violationType === "BREAK_30MIN") {
      for (let i = sortedLogs.length - 1; i >= 0; i--) {
        const log = sortedLogs[i];
        if (log.startTime >= violation.violationTimeRange.end) {
          if (
            (log.dutyStatus === "OFF_DUTY" ||
              log.dutyStatus === "SLEEPER_BERTH") &&
            log.hours >= 0.5
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Historical violation analysis - calculate repeat offender score.
   * Score increases with frequency of similar violations.
   */
  calculateRepeatOffenderScore(driverId: string): number {
    const violations = this.violations.get(`*:${driverId}`) || [];
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const recentViolations = violations.filter(
      (v) => v.createdAt.getTime() >= ninetyDaysAgo,
    );

    let score = 0;

    // Count violations by type
    const violationCounts: { [key: string]: number } = {};
    for (const v of recentViolations) {
      violationCounts[v.violationType] =
        (violationCounts[v.violationType] || 0) + 1;
    }

    // Score: 1 point per violation, 5 bonus points for repeat violations of same type
    for (const [type, count] of Object.entries(violationCounts)) {
      score += count;
      if (count > 1) {
        score += count * 5; // Escalated penalty for repeats
      }
    }

    // CRITICAL violations weighted 2x
    const criticalCount = recentViolations.filter(
      (v) => v.severity === "CRITICAL",
    ).length;
    score += criticalCount * 2;

    return score;
  }

  /**
   * Get all violations for a driver.
   */
  getViolations(
    accountId: string,
    driverId: string,
    days?: number,
  ): HOSViolation[] {
    const key = `${accountId}:${driverId}`;
    const violations = this.violations.get(key) || [];

    if (!days) return violations;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return violations.filter((v) => v.createdAt.getTime() >= cutoff);
  }

  /**
   * Clear resolved violations.
   */
  clearResolvedViolations(accountId: string, driverId: string): void {
    const key = `${accountId}:${driverId}`;
    const violations = this.violations.get(key) || [];

    const unresolved = violations.filter((v) => !v.resolved);
    this.violations.set(key, unresolved);
  }

  // ─── Helper Methods ──────────────────────────────────────────

  /**
   * Check if log entry is complete and properly formatted.
   */
  private isLogComplete(log: LogEntry): boolean {
    // Required fields
    if (!log.id || !log.driverId || !log.vehicleId) return false;
    if (!log.startTime || !log.endTime) return false;
    if (!log.dutyStatus) return false;

    // Validate time range
    if (log.endTime <= log.startTime) return false;

    // Driving logs should have miles or at least hours
    if (log.dutyStatus === "DRIVING" && log.hours <= 0) return false;

    return true;
  }

  /**
   * Detect falsified log by comparing GPS movement to duty status.
   * Heuristic: If driver is "off-duty" but vehicle moved > 5 miles, flag as suspicious.
   */
  private detectFalsifiedLog(
    newLog: LogEntry,
    recentLogs: LogEntry[],
  ): boolean {
    if (
      newLog.dutyStatus !== "OFF_DUTY" &&
      newLog.dutyStatus !== "SLEEPER_BERTH"
    ) {
      return false;
    }

    // Check GPS movement during off-duty period
    if (
      newLog.startLocation &&
      newLog.endLocation &&
      newLog.miles !== undefined
    ) {
      // Calculate approximate distance
      const distance = this.calculateDistance(
        newLog.startLocation.latitude,
        newLog.startLocation.longitude,
        newLog.endLocation.latitude,
        newLog.endLocation.longitude,
      );

      // If off-duty but moved > 5 miles, flag as suspicious
      if (distance > 5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula).
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 3959; // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Update repeat offender count.
   */
  private updateRepeatOffender(
    driverId: string,
    violations: HOSViolation[],
  ): void {
    if (violations.length === 0) return;

    const current = this.repeatOffenders.get(driverId) || 0;
    const criticalCount = violations.filter(
      (v) => v.severity === "CRITICAL",
    ).length;

    this.repeatOffenders.set(driverId, current + criticalCount);
  }

  /**
   * Get repeat offender count.
   */
  getRepeatOffenderCount(driverId: string): number {
    return this.repeatOffenders.get(driverId) || 0;
  }

  /**
   * Reset violation history (e.g., after driver re-certification).
   */
  resetDriverViolationHistory(accountId: string, driverId: string): void {
    const key = `${accountId}:${driverId}`;
    this.violations.delete(key);
    this.repeatOffenders.delete(driverId);
  }
}
