/**
 * ELD Compliance Engine
 *
 * FMCSA Part 395 Hours of Service (HOS) rules engine.
 *
 * Features:
 * - Multi-provider HOS aggregation (same driver, multiple ELDs)
 * - Violation detection (14-hour, 11-hour, 30-min break, 60/70-hour)
 * - Compliance scoring per driver and fleet
 * - Audit log generation for DOT inspections
 * - Exemption handling (short-haul, adverse driving conditions)
 * - Safety alerts and notifications
 */

import type {
  ELDDriverLog,
  ELDViolation,
  DutyStatus,
  ViolationType,
  HOSSummary,
  HOSDailyRecord,
  HOS8DayWindow,
} from "./types.js";

// ─── Compliance Rules Configuration ──────────────────────────

/**
 * FMCSA Part 395 HOS limits (in hours).
 */
const HOS_LIMITS = {
  DRIVING_11_HOURS: 11,
  ON_DUTY_14_HOURS: 14,
  DRIVING_8_HOURS: 8,
  BREAK_30_MINUTES: 0.5,
  HOURS_60_DAYS: 60,
  HOURS_70_DAYS: 70,
};

/**
 * Exemptions from HOS rules.
 */
export interface HOSExemption {
  driverId: string;
  type: "short-haul" | "adverse-weather" | "emergency" | "agricultural";
  startDate: Date;
  endDate: Date;
  reason?: string;
}

// ─── Compliance Data Models ─────────────────────────────────

/**
 * Compliance score components.
 */
export interface ComplianceScore {
  driverId: string;
  date: Date;
  overallScore: number; // 0-100
  hosViolationCount: number;
  violationSeverity: "none" | "minor" | "major" | "critical";
  lastViolationDate?: Date;
  trend: "improving" | "stable" | "deteriorating";
}

/**
 * Fleet-level compliance summary.
 */
export interface FleetCompliance {
  accountId: string;
  date: Date;
  totalDrivers: number;
  driversInCompliance: number;
  driversWithViolations: number;
  criticalViolations: number;
  avgComplianceScore: number;
  violations: ELDViolation[];
}

/**
 * Audit log entry for DOT inspection.
 */
export interface AuditLogEntry {
  id: string;
  accountId: string;
  driverId: string;
  date: Date;
  violationCount: number;
  violations: {
    type: ViolationType;
    description: string;
    timeRange: { start: Date; end: Date };
  }[];
  remarks?: string;
  createdAt: Date;
}

// ─── Compliance Engine ──────────────────────────────────────

export class ELDComplianceEngine {
  private exemptions: HOSExemption[] = [];
  private auditLog: AuditLogEntry[] = [];
  private complianceHistory: ComplianceScore[] = [];

  constructor() {}

  // ─── Violation Detection ────────────────────────────────

  /**
   * Detect all HOS violations for a driver on a specific date.
   */
  detectDailyViolations(logs: ELDDriverLog[], date: Date): ELDViolation[] {
    const violations: ELDViolation[] = [];

    if (logs.length === 0) {
      return violations;
    }

    const driverId = logs[0].driverId;
    const accountId = logs[0].accountId;

    // Calculate metrics
    const drivingHours = this.calculateDrivingHours(logs);
    const onDutyHours = this.calculateOnDutyHours(logs);
    const totalOnDutyHours = drivingHours + onDutyHours;

    // Check exemptions
    if (this.isExempted(driverId, date)) {
      return violations;
    }

    // 11-Hour Driving Limit (49 CFR 395.8(a))
    if (drivingHours > HOS_LIMITS.DRIVING_11_HOURS) {
      violations.push({
        id: `vio_${Date.now()}_1`,
        accountId,
        driverId,
        vehicleId: logs[0].vehicleId,
        violationType: "hours-11",
        description: `Driver exceeded 11-hour driving limit: ${drivingHours.toFixed(
          2,
        )} hours`,
        severity: "critical",
        detectedAt: new Date(),
        violationTimeRange: {
          start: logs[0].startTime,
          end: logs[logs.length - 1].endTime,
        },
        hosContext: {
          hours11: drivingHours,
        },
        acknowledged: false,
        createdAt: new Date(),
      });
    }

    // 14-Hour Rule (49 CFR 395.8(a))
    if (totalOnDutyHours > HOS_LIMITS.ON_DUTY_14_HOURS) {
      violations.push({
        id: `vio_${Date.now()}_2`,
        accountId,
        driverId,
        vehicleId: logs[0].vehicleId,
        violationType: "hours-14",
        description: `Driver exceeded 14-hour on-duty period: ${totalOnDutyHours.toFixed(
          2,
        )} hours`,
        severity: "critical",
        detectedAt: new Date(),
        violationTimeRange: {
          start: logs[0].startTime,
          end: logs[logs.length - 1].endTime,
        },
        hosContext: {
          hours14: totalOnDutyHours,
        },
        acknowledged: false,
        createdAt: new Date(),
      });
    }

    // 30-Minute Break Requirement (49 CFR 395.8(a))
    const breakViolation = this.checkBreakViolation(logs);
    if (breakViolation) {
      violations.push({
        id: `vio_${Date.now()}_3`,
        accountId,
        driverId,
        vehicleId: logs[0].vehicleId,
        violationType: "break-30min",
        description: "Driver drove more than 8 hours without a 30-minute break",
        severity: "error",
        detectedAt: new Date(),
        violationTimeRange: breakViolation,
        hosContext: {},
        acknowledged: false,
        createdAt: new Date(),
      });
    }

    // 8-Hour Continuous Driving (simplified check)
    const eightHourViolation = this.checkEightHourViolation(logs);
    if (eightHourViolation) {
      violations.push({
        id: `vio_${Date.now()}_4`,
        accountId,
        driverId,
        vehicleId: logs[0].vehicleId,
        violationType: "hours-8",
        description: "Driver exceeded continuous 8-hour driving without break",
        severity: "warning",
        detectedAt: new Date(),
        violationTimeRange: eightHourViolation,
        hosContext: {},
        acknowledged: false,
        createdAt: new Date(),
      });
    }

    return violations;
  }

  /**
   * Detect 60/70-hour violations for 8-day window.
   */
  detect8DayViolations(logs: ELDDriverLog[], endDate: Date): ELDViolation[] {
    const violations: ELDViolation[] = [];

    if (logs.length === 0) {
      return violations;
    }

    const driverId = logs[0].driverId;
    const accountId = logs[0].accountId;

    // Calculate 8-day totals
    const startDate = new Date(endDate.getTime() - 7 * 86400000);
    const eightyDayLogs = logs.filter(
      (l) => l.startTime >= startDate && l.startTime <= endDate,
    );

    const drivingHours = this.calculateDrivingHours(eightyDayLogs);
    const onDutyHours = this.calculateOnDutyHours(eightyDayLogs);
    const total60Hours = drivingHours;
    const total70Hours = drivingHours + onDutyHours;

    // Check exemptions
    if (this.isExempted(driverId, endDate)) {
      return violations;
    }

    // 60-Hour Limit (49 CFR 395.8(b))
    if (total60Hours > HOS_LIMITS.HOURS_60_DAYS) {
      violations.push({
        id: `vio_${Date.now()}_60`,
        accountId,
        driverId,
        vehicleId: logs[0].vehicleId,
        violationType: "hours-60-70",
        description: `Driver exceeded 60-hour 8-day limit: ${total60Hours.toFixed(
          2,
        )} hours`,
        severity: "critical",
        detectedAt: new Date(),
        violationTimeRange: {
          start: startDate,
          end: endDate,
        },
        hosContext: {
          hours60: total60Hours,
          hours70: total70Hours,
        },
        acknowledged: false,
        createdAt: new Date(),
      });
    }

    // 70-Hour Limit (49 CFR 395.8(b))
    if (total70Hours > HOS_LIMITS.HOURS_70_DAYS) {
      violations.push({
        id: `vio_${Date.now()}_70`,
        accountId,
        driverId,
        vehicleId: logs[0].vehicleId,
        violationType: "hours-60-70",
        description: `Driver exceeded 70-hour 8-day limit: ${total70Hours.toFixed(
          2,
        )} hours`,
        severity: "critical",
        detectedAt: new Date(),
        violationTimeRange: {
          start: startDate,
          end: endDate,
        },
        hosContext: {
          hours60: total60Hours,
          hours70: total70Hours,
        },
        acknowledged: false,
        createdAt: new Date(),
      });
    }

    return violations;
  }

  /**
   * Aggregate HOS data from multiple ELD providers for same driver.
   */
  aggregateMultiProviderHOS(
    driverId: string,
    logs: ELDDriverLog[],
    date: Date,
  ): HOSSummary {
    const dailyLogs = logs.filter((l) => this.isSameDay(l.startTime, date));

    const drivingHours = this.calculateDrivingHours(dailyLogs);
    const onDutyHours = this.calculateOnDutyHours(dailyLogs);

    return {
      driverId,
      date,
      hours11: drivingHours,
      hours14: drivingHours + onDutyHours,
      hours60: 0, // Would need 8-day window
      hours70: 0, // Would need 8-day window
      availableDriving: Math.max(0, HOS_LIMITS.DRIVING_11_HOURS - drivingHours),
      availableOnDuty: Math.max(
        0,
        HOS_LIMITS.ON_DUTY_14_HOURS - (drivingHours + onDutyHours),
      ),
      violations: [],
    };
  }

  // ─── Compliance Scoring ─────────────────────────────────

  /**
   * Calculate compliance score for a driver.
   */
  calculateComplianceScore(
    driverId: string,
    violations: ELDViolation[],
  ): ComplianceScore {
    const baseScore = 100;
    let deductions = 0;

    // Count violations by severity
    const criticalCount = violations.filter(
      (v) => v.severity === "critical",
    ).length;
    const errorCount = violations.filter((v) => v.severity === "error").length;
    const warningCount = violations.filter(
      (v) => v.severity === "warning",
    ).length;

    // Deduct points based on severity
    deductions += criticalCount * 15; // -15 per critical
    deductions += errorCount * 8; // -8 per error
    deductions += warningCount * 3; // -3 per warning

    const score = Math.max(0, Math.min(100, baseScore - deductions));

    // Determine severity level
    let violationSeverity: "none" | "minor" | "major" | "critical" = "none";
    if (criticalCount > 0) violationSeverity = "critical";
    else if (errorCount > 0) violationSeverity = "major";
    else if (warningCount > 0) violationSeverity = "minor";

    return {
      driverId,
      date: new Date(),
      overallScore: Math.round(score),
      hosViolationCount: violations.length,
      violationSeverity,
      lastViolationDate:
        violations.length > 0 ? violations[0].detectedAt : undefined,
      trend: "stable", // Would track historical trend
    };
  }

  /**
   * Calculate fleet-level compliance.
   */
  calculateFleetCompliance(
    accountId: string,
    drivers: Array<{ id: string; violations: ELDViolation[] }>,
  ): FleetCompliance {
    const scores = drivers.map((d) =>
      this.calculateComplianceScore(d.id, d.violations),
    );
    const avgScore =
      scores.length > 0
        ? Math.round(
            scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length,
          )
        : 100;

    const allViolations = drivers.flatMap((d) => d.violations);
    const criticalViolations = allViolations.filter(
      (v) => v.severity === "critical",
    ).length;

    return {
      accountId,
      date: new Date(),
      totalDrivers: drivers.length,
      driversInCompliance: scores.filter((s) => s.hosViolationCount === 0)
        .length,
      driversWithViolations: scores.filter((s) => s.hosViolationCount > 0)
        .length,
      criticalViolations,
      avgComplianceScore: avgScore,
      violations: allViolations,
    };
  }

  // ─── Exemption Management ───────────────────────────────

  /**
   * Add an exemption to the driver's record.
   */
  addExemption(exemption: HOSExemption): void {
    this.exemptions.push(exemption);
  }

  /**
   * Remove an exemption.
   */
  removeExemption(exemptionId: string, driverId: string): void {
    this.exemptions = this.exemptions.filter((e) => !(e.driverId === driverId));
  }

  /**
   * Check if driver is exempt from HOS rules on a specific date.
   */
  private isExempted(driverId: string, date: Date): boolean {
    return this.exemptions.some(
      (e) =>
        e.driverId === driverId && date >= e.startDate && date <= e.endDate,
    );
  }

  /**
   * Get active exemptions for a driver.
   */
  getActiveExemptions(driverId: string, date: Date): HOSExemption[] {
    return this.exemptions.filter(
      (e) =>
        e.driverId === driverId && date >= e.startDate && date <= e.endDate,
    );
  }

  // ─── Audit Log Management ───────────────────────────────

  /**
   * Create audit log entry for DOT inspection.
   */
  createAuditLogEntry(
    accountId: string,
    driverId: string,
    date: Date,
    violations: ELDViolation[],
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}`,
      accountId,
      driverId,
      date,
      violationCount: violations.length,
      violations: violations.map((v) => ({
        type: v.violationType,
        description: v.description,
        timeRange: v.violationTimeRange,
      })),
      createdAt: new Date(),
    };

    this.auditLog.push(entry);
    return entry;
  }

  /**
   * Get audit log entries.
   */
  getAuditLog(accountId?: string, driverId?: string): AuditLogEntry[] {
    return this.auditLog.filter(
      (e) =>
        (!accountId || e.accountId === accountId) &&
        (!driverId || e.driverId === driverId),
    );
  }

  /**
   * Export audit log for DOT inspection (PDF/CSV).
   */
  exportAuditLog(accountId: string, format: "csv" | "json" = "csv"): string {
    const entries = this.getAuditLog(accountId);

    if (format === "json") {
      return JSON.stringify(entries, null, 2);
    }

    // CSV format
    const headers = [
      "Date",
      "Driver ID",
      "Violation Count",
      "Violations",
      "Created At",
    ];
    const rows = entries.map((e) => [
      e.date.toISOString(),
      e.driverId,
      e.violationCount,
      e.violations.map((v) => v.type).join(";"),
      e.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    return csvContent;
  }

  // ─── Private Helper Methods ────────────────────────────

  /**
   * Calculate total driving hours from logs.
   */
  private calculateDrivingHours(logs: ELDDriverLog[]): number {
    return logs
      .filter((l) => l.dutyStatus === "driving")
      .reduce((sum, l) => sum + l.hours, 0);
  }

  /**
   * Calculate total on-duty hours from logs.
   */
  private calculateOnDutyHours(logs: ELDDriverLog[]): number {
    return logs
      .filter((l) => l.dutyStatus === "on-duty")
      .reduce((sum, l) => sum + l.hours, 0);
  }

  /**
   * Check for 30-minute break violation.
   */
  private checkBreakViolation(
    logs: ELDDriverLog[],
  ): { start: Date; end: Date } | null {
    let drivingTime = 0;
    let lastDrivingLog: ELDDriverLog | null = null;

    for (const log of logs) {
      if (log.dutyStatus === "driving") {
        drivingTime += log.hours;
        lastDrivingLog = log;

        if (drivingTime > HOS_LIMITS.DRIVING_8_HOURS) {
          return {
            start: logs[0].startTime,
            end: lastDrivingLog?.endTime || logs[logs.length - 1].endTime,
          };
        }
      } else {
        drivingTime = 0; // Reset on break
      }
    }

    return null;
  }

  /**
   * Check for 8-hour continuous driving violation.
   */
  private checkEightHourViolation(
    logs: ELDDriverLog[],
  ): { start: Date; end: Date } | null {
    let continuousDriving = 0;
    let startLog: ELDDriverLog | null = null;

    for (const log of logs) {
      if (log.dutyStatus === "driving") {
        if (!startLog) startLog = log;
        continuousDriving += log.hours;

        if (continuousDriving > HOS_LIMITS.DRIVING_8_HOURS) {
          return {
            start: startLog?.startTime || log.startTime,
            end: log.endTime,
          };
        }
      } else {
        continuousDriving = 0;
        startLog = null;
      }
    }

    return null;
  }

  /**
   * Check if two dates are the same day.
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
}
