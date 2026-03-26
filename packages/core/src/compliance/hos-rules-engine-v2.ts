/**
 * HOS Rules Engine v2 - Authoritative Hours of Service Compliance Implementation
 *
 * Comprehensive multi-jurisdictional HOS compliance engine supporting:
 * - FMCSA Part 395 (US Property-Carrying & Passenger-Carrying)
 * - Canadian Federal HOS (Part 121)
 * - Mexico NOM-087-SCT
 *
 * Features:
 * - Real-time clock computation from log entries
 * - Violation detection with regulatory codes
 * - Projection: "how many hours can this driver legally drive?"
 * - Sleeper berth split tracking (7/3, 8/2)
 * - 34-hour restart validation
 * - Short-haul and adverse condition exemptions
 */

import type {
  LogEntry,
  DutyStatus,
  HOSClock,
  HOSViolation,
  ComplianceResult,
  RuleSet,
  CycleRule,
  SleeperBerthSplit,
  RestartQualification,
  BreakStatus,
} from "./hos-types.js";
import { DutyStatus as DutyStatusEnum } from "./hos-types.js";
import { HOSCalculator } from "./hos-calculator.js";

/**
 * Main HOS Rules Engine - Evaluates compliance against configurable rule sets.
 */
export class HOSRulesEngine {
  private ruleSets: Map<string, RuleSet> = new Map();
  private violationHistory: Map<string, HOSViolation[]> = new Map();

  constructor() {
    this.initializeDefaultRuleSets();
  }

  /**
   * Initialize FMCSA and international HOS rules.
   */
  private initializeDefaultRuleSets(): void {
    // US Property-Carrying (FMCSA Part 395 - most common)
    this.ruleSets.set("US_PROPERTY", {
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
      sleeperBerthSplits: [
        {
          firstPeriodHours: 7,
          secondPeriodHours: 3,
          qualifiesAsHours: 10,
          pausesClock14: true,
        },
        {
          firstPeriodHours: 8,
          secondPeriodHours: 2,
          qualifiesAsHours: 10,
          pausesClock14: true,
        },
      ],
      shortHaulExceptionAllowed: true,
      shortHaulRadiusMiles: 150,
      shortHaulWindowHours: 14,
      adverseConditionsExtensionAllowed: true,
      adverseConditionsExtensionHours: 2,
      sixteenHourExceptionAllowed: true,
    });

    // US Passenger-Carrying (49 CFR 395, Subpart B)
    this.ruleSets.set("US_PASSENGER", {
      jurisdiction: "US_PASSENGER",
      maxDrivingHours: 10,
      maxOnDutyWindow: 15,
      breakRequiredAfterMinutes: 8 * 60,
      requiredBreakDurationMinutes: 30,
      cycleRule: {
        ruleType: "70_HOUR_8_DAY",
        maxDrivingHours: 60,
        cycleDays: 7,
        measurementType: "ROLLING_WINDOW",
        restartAvailable: false,
        restartRequires1To5Am: false,
      },
      sleeperBerthSplits: [],
      shortHaulExceptionAllowed: false,
      adverseConditionsExtensionAllowed: true,
      adverseConditionsExtensionHours: 2,
    });

    // Canadian Federal (Interprovincial)
    this.ruleSets.set("CANADA_FEDERAL", {
      jurisdiction: "CANADA_FEDERAL",
      maxDrivingHours: 13,
      maxOnDutyWindow: 14,
      breakRequiredAfterMinutes: 8 * 60,
      requiredBreakDurationMinutes: 30,
      cycleRule: {
        ruleType: "70_HOUR_8_DAY",
        maxDrivingHours: 70,
        cycleDays: 7,
        measurementType: "ROLLING_WINDOW",
        restartAvailable: false,
        restartRequires1To5Am: false,
      },
      sleeperBerthSplits: [],
      shortHaulExceptionAllowed: false,
      adverseConditionsExtensionAllowed: false,
    });

    // Mexico NOM-087-SCT
    this.ruleSets.set("MEXICO", {
      jurisdiction: "MEXICO",
      maxDrivingHours: 14,
      maxOnDutyWindow: 24,
      breakRequiredAfterMinutes: 14 * 60,
      requiredBreakDurationMinutes: 60,
      cycleRule: {
        ruleType: "60_HOUR_7_DAY",
        maxDrivingHours: 60,
        cycleDays: 1,
        measurementType: "ROLLING_WINDOW",
        restartAvailable: false,
        restartRequires1To5Am: false,
      },
      sleeperBerthSplits: [],
      shortHaulExceptionAllowed: false,
      adverseConditionsExtensionAllowed: false,
    });

    // 60-hour/7-day variant (for carriers electing this option)
    const us_60_7day = { ...this.ruleSets.get("US_PROPERTY")! };
    us_60_7day.cycleRule = {
      ruleType: "60_HOUR_7_DAY",
      maxDrivingHours: 60,
      cycleDays: 7,
      measurementType: "ROLLING_WINDOW",
      restartAvailable: true,
      restartRequires1To5Am: true,
    };
    this.ruleSets.set("US_PROPERTY_60_7DAY", us_60_7day);
  }

  /**
   * Evaluate driver compliance against a rule set.
   * Returns comprehensive ComplianceResult with violations and projections.
   */
  evaluate(
    logEntries: LogEntry[],
    ruleSetId: string,
    advancedOptions?: {
      shortHaulApplied?: boolean;
      adverseWeatherApplied?: boolean;
      sixteenHourExceptionUsed?: boolean;
      daysInPeriod?: number;
    }
  ): ComplianceResult {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) {
      throw new Error(`Unknown rule set: ${ruleSetId}`);
    }

    const violations: HOSViolation[] = [];
    const driverId = logEntries[0]?.driverId || "unknown";
    const now = new Date();

    // Compute HOS clock
    const hosClock = HOSCalculator.computeHOSClock(logEntries, ruleSet);

    // Detect violations
    const dailyViolations = this.detectDailyViolations(
      logEntries,
      ruleSet,
      advancedOptions
    );
    violations.push(...dailyViolations);

    const cycleViolations = this.detectCycleViolations(
      logEntries,
      ruleSet,
      advancedOptions
    );
    violations.push(...cycleViolations);

    const breakViolations = this.detectBreakViolations(logEntries, ruleSet);
    violations.push(...breakViolations);

    // Calculate compliance score
    const complianceScore = this.calculateComplianceScore(
      violations,
      hosClock,
      ruleSet
    );

    // Calculate trend
    const trend = this.calculateTrend(driverId, violations);

    // Calculate repeat offender count
    const repeatOffenderCount = this.getRepeatOffenderCount(driverId);

    // Projection
    const projection = HOSCalculator.projectAvailability(
      logEntries,
      1,
      ruleSet.cycleRule
    );

    return {
      driverId,
      asOf: now,
      isCompliant: violations.filter((v) => v.severity === "CRITICAL").length === 0,
      violations,
      hosClock,
      projectionMaxDrivableHours: projection.maxDrivable / 60,
      projectionNextAvailableDriving: projection.availableAt,
      complianceScore,
      trend,
      repeatOffenderCount,
    };
  }

  /**
   * Detect daily violations (11h, 14h, 30min break).
   */
  private detectDailyViolations(
    logs: LogEntry[],
    ruleSet: RuleSet,
    options?: { shortHaulApplied?: boolean; adverseWeatherApplied?: boolean }
  ): HOSViolation[] {
    const violations: HOSViolation[] = [];
    if (logs.length === 0) return violations;

    const driverId = logs[0].driverId;
    const accountId = logs[0].accountId;
    const vehicleId = logs[0].vehicleId;

    const sortedLogs = [...logs].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    // 11-hour driving limit
    const driving11Remaining = HOSCalculator.calculateDrivingRemaining(logs);
    const drivingMinutes11 = ruleSet.maxDrivingHours * 60 - driving11Remaining;

    let driving11Limit = ruleSet.maxDrivingHours;
    if (
      options?.adverseWeatherApplied &&
      ruleSet.adverseConditionsExtensionAllowed
    ) {
      driving11Limit += ruleSet.adverseConditionsExtensionHours || 0;
    }

    if (drivingMinutes11 > driving11Limit * 60) {
      violations.push({
        id: `vio_${Date.now()}_11h`,
        accountId,
        driverId,
        vehicleId,
        violationType: "DRIVING_11",
        description: `Driver exceeded ${driving11Limit}-hour driving limit: ${(drivingMinutes11 / 60).toFixed(2)} hours`,
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: sortedLogs[0].startTime,
          end: sortedLogs[sortedLogs.length - 1].endTime,
        },
        hosContext: { hours11: drivingMinutes11 / 60 },
        fmcsaViolationCode: "395.8(a)(1)",
        resolved: false,
        createdAt: new Date(),
      });
    }

    // 14-hour on-duty window
    const window14Remaining = HOSCalculator.calculateWindowRemaining(logs);
    const elapsedWindow14 = ruleSet.maxOnDutyWindow * 60 - window14Remaining;

    if (elapsedWindow14 > ruleSet.maxOnDutyWindow * 60) {
      violations.push({
        id: `vio_${Date.now()}_14h`,
        accountId,
        driverId,
        vehicleId,
        violationType: "ON_DUTY_14",
        description: `Driver exceeded ${ruleSet.maxOnDutyWindow}-hour on-duty window: ${(elapsedWindow14 / 60).toFixed(2)} hours`,
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: sortedLogs[0].startTime,
          end: sortedLogs[sortedLogs.length - 1].endTime,
        },
        hosContext: { hours14: elapsedWindow14 / 60 },
        fmcsaViolationCode: "395.8(a)(2)",
        resolved: false,
        createdAt: new Date(),
      });
    }

    // 30-minute break requirement
    const breakStatus = HOSCalculator.calculateBreakRequired(logs);
    if (
      breakStatus.required &&
      breakStatus.minutesSinceBreak > 8 * 60
    ) {
      violations.push({
        id: `vio_${Date.now()}_break`,
        accountId,
        driverId,
        vehicleId,
        violationType: "BREAK_30MIN",
        description: `Driver exceeded 8 hours of driving without 30-minute break: ${(breakStatus.minutesSinceBreak / 60).toFixed(2)} hours since break`,
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: breakStatus.lastBreakTime || sortedLogs[0].startTime,
          end: sortedLogs[sortedLogs.length - 1].endTime,
        },
        hosContext: { minutesSinceBreak: breakStatus.minutesSinceBreak },
        fmcsaViolationCode: "395.8(a)(3)",
        resolved: false,
        createdAt: new Date(),
      });
    }

    return violations;
  }

  /**
   * Detect cycle violations (60h/7d or 70h/8d).
   */
  private detectCycleViolations(
    logs: LogEntry[],
    ruleSet: RuleSet,
    options?: any
  ): HOSViolation[] {
    const violations: HOSViolation[] = [];
    if (logs.length === 0) return violations;

    const driverId = logs[0].driverId;
    const accountId = logs[0].accountId;
    const vehicleId = logs[0].vehicleId;

    const cycleRemaining = HOSCalculator.calculateCycleRemaining(
      logs,
      ruleSet.cycleRule
    );
    const drivingMinutes8Day =
      ruleSet.cycleRule.maxDrivingHours * 60 - cycleRemaining;

    if (drivingMinutes8Day > ruleSet.cycleRule.maxDrivingHours * 60) {
      const cycleLabel =
        ruleSet.cycleRule.ruleType === "60_HOUR_7_DAY"
          ? "60-hour/7-day"
          : "70-hour/8-day";

      violations.push({
        id: `vio_${Date.now()}_cycle`,
        accountId,
        driverId,
        vehicleId,
        violationType:
          ruleSet.cycleRule.ruleType === "70_HOUR_8_DAY"
            ? "CYCLE_70_HOUR"
            : "CYCLE_60_HOUR",
        description: `Driver exceeded ${cycleLabel} cycle limit: ${(drivingMinutes8Day / 60).toFixed(2)} hours`,
        severity: "CRITICAL",
        detectedAt: new Date(),
        violationTimeRange: {
          start: logs[0].startTime,
          end: logs[logs.length - 1].endTime,
        },
        hosContext: { hours70: drivingMinutes8Day / 60 },
        fmcsaViolationCode: "395.8(b)",
        resolved: false,
        createdAt: new Date(),
      });
    }

    return violations;
  }

  /**
   * Detect break requirement violations.
   */
  private detectBreakViolations(
    logs: LogEntry[],
    ruleSet: RuleSet
  ): HOSViolation[] {
    const violations: HOSViolation[] = [];
    if (logs.length === 0) return violations;

    const breakStatus = HOSCalculator.calculateBreakRequired(logs);

    if (
      breakStatus.required &&
      !breakStatus.breakCompleted &&
      breakStatus.minutesSinceBreak >
        ruleSet.breakRequiredAfterMinutes
    ) {
      const driverId = logs[0].driverId;
      const accountId = logs[0].accountId;
      const vehicleId = logs[0].vehicleId;

      violations.push({
        id: `vio_${Date.now()}_break_req`,
        accountId,
        driverId,
        vehicleId,
        violationType: "BREAK_30MIN",
        description: `${ruleSet.requiredBreakDurationMinutes}-minute break required but not taken`,
        severity: "WARNING",
        detectedAt: new Date(),
        violationTimeRange: {
          start: breakStatus.lastBreakTime || logs[0].startTime,
          end: breakStatus.deadline || logs[logs.length - 1].endTime,
        },
        hosContext: { minutesSinceBreak: breakStatus.minutesSinceBreak },
        fmcsaViolationCode: "395.8(a)(3)",
        resolved: false,
        createdAt: new Date(),
      });
    }

    return violations;
  }

  /**
   * Calculate compliance score (0-100).
   */
  private calculateComplianceScore(
    violations: HOSViolation[],
    hosClock: HOSClock,
    ruleSet: RuleSet
  ): number {
    let score = 100;

    // Deduct for critical violations
    const criticalCount = violations.filter(
      (v) => v.severity === "CRITICAL"
    ).length;
    score -= criticalCount * 25;

    // Deduct for warnings
    const warningCount = violations.filter(
      (v) => v.severity === "WARNING"
    ).length;
    score -= warningCount * 10;

    // Deduct for approaching limits
    const drivingUtilization =
      (ruleSet.maxDrivingHours * 60 - hosClock.drivingRemaining11) /
      (ruleSet.maxDrivingHours * 60);
    if (drivingUtilization > 0.9) score -= 5;
    if (drivingUtilization > 0.95) score -= 10;

    // Deduct if break required soon
    if (hosClock.breakRequired) score -= 15;

    return Math.max(0, score);
  }

  /**
   * Calculate trend based on violation history.
   */
  private calculateTrend(
    driverId: string,
    currentViolations: HOSViolation[]
  ): "IMPROVING" | "STABLE" | "DETERIORATING" {
    const history = this.violationHistory.get(driverId) || [];
    const recentViolations = history.filter(
      (v) =>
        Date.now() - v.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000
    ); // 30 days

    if (
      currentViolations.length < recentViolations.length * 0.8
    ) {
      return "IMPROVING";
    }
    if (
      currentViolations.length > recentViolations.length * 1.2
    ) {
      return "DETERIORATING";
    }

    return "STABLE";
  }

  /**
   * Get repeat offender count from violation history.
   */
  private getRepeatOffenderCount(driverId: string): number {
    const history = this.violationHistory.get(driverId) || [];
    const nineDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    return history.filter((v) => v.createdAt.getTime() >= nineDaysAgo).length;
  }

  /**
   * Record violation for history tracking.
   */
  recordViolation(violation: HOSViolation): void {
    const driverId = violation.driverId;
    if (!this.violationHistory.has(driverId)) {
      this.violationHistory.set(driverId, []);
    }

    this.violationHistory.get(driverId)!.push(violation);
  }

  /**
   * Get rule set by ID.
   */
  getRuleSet(ruleSetId: string): RuleSet | undefined {
    return this.ruleSets.get(ruleSetId);
  }

  /**
   * List all available rule sets.
   */
  listRuleSets(): string[] {
    return Array.from(this.ruleSets.keys());
  }

  /**
   * Register custom rule set.
   */
  registerRuleSet(ruleSetId: string, ruleSet: RuleSet): void {
    this.ruleSets.set(ruleSetId, ruleSet);
  }

  /**
   * Validate driver projection: can they legally drive N more hours?
   */
  canDrive(logs: LogEntry[], ruleSetId: string, hours: number): boolean {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) return false;

    const projection = HOSCalculator.projectAvailability(
      logs,
      hours,
      ruleSet.cycleRule
    );

    return projection.canDrive;
  }

  /**
   * Get maximum drivable hours without hitting limits.
   */
  getMaxDrivableHours(logs: LogEntry[], ruleSetId: string): number {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) return 0;

    const projection = HOSCalculator.projectAvailability(
      logs,
      1,
      ruleSet.cycleRule
    );

    return projection.maxDrivable / 60;
  }
}

/**
 * RuleEvaluator - Higher-level evaluation interface.
 */
export class RuleEvaluator {
  private engine: HOSRulesEngine;

  constructor() {
    this.engine = new HOSRulesEngine();
  }

  /**
   * Evaluate logs against a rule set.
   */
  evaluate(
    logEntries: LogEntry[],
    ruleSetId: string,
    advancedOptions?: any
  ): ComplianceResult {
    return this.engine.evaluate(logEntries, ruleSetId, advancedOptions);
  }

  /**
   * Get available rule sets.
   */
  getAvailableRuleSets(): string[] {
    return this.engine.listRuleSets();
  }

  /**
   * Validate HOS compliance for a driver.
   */
  validateCompliance(
    logs: LogEntry[],
    ruleSetId: string
  ): {
    compliant: boolean;
    violations: HOSViolation[];
  } {
    const result = this.engine.evaluate(logs, ruleSetId);
    return {
      compliant: result.isCompliant,
      violations: result.violations,
    };
  }
}
