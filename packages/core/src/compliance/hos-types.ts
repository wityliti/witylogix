/**
 * HOS (Hours of Service) v2 Compliance Engine - Type Definitions
 *
 * Comprehensive type system for multi-jurisdictional HOS compliance:
 * - FMCSA Part 395 (US Property-Carrying and Passenger-Carrying)
 * - Canadian Federal HOS (Part 121 of the Motor Vehicle Transport Act)
 * - Mexico NOM-087-SCT
 *
 * Includes duty status, violation tracking, cycle calculations, and inspection reports.
 */

// ─── Duty Status Enumeration ────────────────────────────────────────

/**
 * FMCSA-compliant duty status values per 49 CFR 395.2
 */
export enum DutyStatus {
  DRIVING = "DRIVING",
  ON_DUTY = "ON_DUTY",
  SLEEPER_BERTH = "SLEEPER_BERTH",
  OFF_DUTY = "OFF_DUTY",
  PERSONAL_CONVEYANCE = "PERSONAL_CONVEYANCE",
  YARD_MOVE = "YARD_MOVE",
}

// ─── Log Entry ──────────────────────────────────────────────────────

/**
 * Individual duty status log entry for HOS tracking.
 */
export interface LogEntry {
  /** Unique log identifier */
  id: string;

  /** Account/fleet ID */
  accountId: string;

  /** Driver ID */
  driverId: string;

  /** Vehicle ID */
  vehicleId: string;

  /** Duty status during this period */
  dutyStatus: DutyStatus;

  /** Start time (ISO 8601 with timezone) */
  startTime: Date;

  /** End time (ISO 8601 with timezone) */
  endTime: Date;

  /** Total miles driven (if dutyStatus is DRIVING) */
  miles?: number;

  /** Total hours in this period */
  hours: number;

  /** Location at start */
  startLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
  };

  /** Location at end */
  endLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
  };

  /** Driver remarks */
  remarks?: string;

  /** Sequence number for ordering */
  sequence: number;

  /** Whether log was edited post-submission */
  edited: boolean;

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;
}

// ─── HOS Clock State ────────────────────────────────────────────────

/**
 * Real-time HOS clock state computed from log entries.
 */
export interface HOSClock {
  /** Time as of calculation */
  asOf: Date;

  /** Minutes of driving in current 11-hour window */
  drivingMinutes11: number;

  /** Minutes remaining before 11-hour limit */
  drivingRemaining11: number;

  /** Minutes on-duty (excluding driving) in 14-hour window */
  onDutyMinutes14: number;

  /** Total on-duty + driving minutes in 14-hour window */
  totalOnDutyMinutes14: number;

  /** Minutes remaining before 14-hour window expires */
  windowRemaining14: number;

  /** Minutes driven in current 8-day cycle */
  drivingMinutes8Day: number;

  /** Minutes remaining in current 8-day cycle (depends on rule type) */
  cycleRemaining8Day: number;

  /** Minutes since last 30-minute break */
  minutesSinceBreak: number;

  /** Whether 30-minute break is currently required */
  breakRequired: boolean;

  /** Deadline for next 30-minute break */
  breakDeadline?: Date;

  /** Whether driver can legally drive right now */
  canDrive: boolean;

  /** Timestamp when next legal driving window opens */
  nextAvailableDriving?: Date;
}

// ─── HOS Violation ──────────────────────────────────────────────────

/**
 * Detected HOS violation with regulatory context.
 */
export interface HOSViolation {
  /** Unique violation ID */
  id: string;

  /** Account ID */
  accountId: string;

  /** Driver ID */
  driverId: string;

  /** Vehicle ID */
  vehicleId: string;

  /** Violation type/rule violated */
  violationType:
    | "DRIVING_11"
    | "ON_DUTY_14"
    | "BREAK_30MIN"
    | "CYCLE_60_HOUR"
    | "CYCLE_70_HOUR"
    | "CYCLE_70_HOUR_8DAY"
    | "FORM_MANNER"
    | "FALSIFIED_LOG";

  /** Human-readable description */
  description: string;

  /** Severity: CRITICAL (active violation), WARNING (approaching), INFO (administrative) */
  severity: "CRITICAL" | "WARNING" | "INFO";

  /** When violation was detected */
  detectedAt: Date;

  /** Time period during which violation occurred */
  violationTimeRange: {
    start: Date;
    end: Date;
  };

  /** HOS context at time of violation */
  hosContext: {
    hours11?: number;
    hours14?: number;
    hours60?: number;
    hours70?: number;
    hours70_8day?: number;
    minutesSinceBreak?: number;
  };

  /** FMCSA CFR violation code (e.g., "395.3", "395.8") */
  fmcsaViolationCode?: string;

  /** Whether violation has auto-resolved */
  resolved: boolean;

  /** When violation was resolved */
  resolvedAt?: Date;

  /** Created timestamp */
  createdAt: Date;
}

// ─── Compliance Result ──────────────────────────────────────────────

/**
 * Overall compliance assessment result.
 */
export interface ComplianceResult {
  /** Driver ID evaluated */
  driverId: string;

  /** As of this timestamp */
  asOf: Date;

  /** Is driver currently in compliance */
  isCompliant: boolean;

  /** List of all active violations */
  violations: HOSViolation[];

  /** Current HOS clock state */
  hosClock: HOSClock;

  /** Projection: maximum hours driver can legally drive */
  projectionMaxDrivableHours: number;

  /** Projection: when driver can next legally drive */
  projectionNextAvailableDriving?: Date;

  /** Compliance score (0-100) */
  complianceScore: number;

  /** Trend: improving, stable, deteriorating */
  trend: "IMPROVING" | "STABLE" | "DETERIORATING";

  /** Repeat offender count (violations in last 90 days) */
  repeatOffenderCount: number;
}

// ─── Cycle Rule Definition ──────────────────────────────────────────

/**
 * Hours-of-service cycle rule configuration.
 */
export interface CycleRule {
  /** Rule name: "60_HOUR_7_DAY" or "70_HOUR_8_DAY" */
  ruleType: "60_HOUR_7_DAY" | "70_HOUR_8_DAY";

  /** Maximum driving hours in cycle */
  maxDrivingHours: number;

  /** Cycle duration in days */
  cycleDays: number;

  /** How to measure the cycle (first-in/rolling) */
  measurementType: "FIRST_IN_FIRST_OUT" | "ROLLING_WINDOW";

  /** 34-hour restart available */
  restartAvailable: boolean;

  /** 34-hour restart requires 2x 1-5am periods (US-specific) */
  restartRequires1To5Am: boolean;
}

// ─── Rule Set ───────────────────────────────────────────────────────

/**
 * Complete set of HOS rules for a jurisdiction.
 */
export interface RuleSet {
  /** Jurisdiction: US_PROPERTY, US_PASSENGER, CANADA_FEDERAL, MEXICO */
  jurisdiction: "US_PROPERTY" | "US_PASSENGER" | "CANADA_FEDERAL" | "MEXICO";

  /** Driving limit in hours per day */
  maxDrivingHours: number;

  /** On-duty window limit in hours per day */
  maxOnDutyWindow: number;

  /** Required break after N hours of driving */
  breakRequiredAfterMinutes: number;

  /** Duration of required break in minutes */
  requiredBreakDurationMinutes: number;

  /** 8-day or 7-day cycle rule */
  cycleRule: CycleRule;

  /** Sleeper berth splits allowed (US-specific) */
  sleeperBerthSplits?: SleeperBerthSplit[];

  /** Short-haul exception allowed (US Property-Carrying) */
  shortHaulExceptionAllowed: boolean;

  /** Short-haul radius in air miles (US-specific) */
  shortHaulRadiusMiles?: number;

  /** Short-haul window in hours (US-specific) */
  shortHaulWindowHours?: number;

  /** Adverse driving conditions extension allowed */
  adverseConditionsExtensionAllowed: boolean;

  /** Extension amount in hours */
  adverseConditionsExtensionHours?: number;

  /** 16-hour short-haul exception (once per 7 days, US Property) */
  sixteenHourExceptionAllowed?: boolean;
}

// ─── Sleeper Berth Split ────────────────────────────────────────────

/**
 * Sleeper berth split configuration for US rules.
 * Allows driver to split required off-duty time and restart cycle.
 * E.g., 7 hours in sleeper + 3 hours off-duty qualifies as 10-hour break.
 */
export interface SleeperBerthSplit {
  /** First period in hours */
  firstPeriodHours: number;

  /** Second period in hours */
  secondPeriodHours: number;

  /** Total qualifies as N hours of rest */
  qualifiesAsHours: number;

  /** Pauses the 14-hour on-duty clock */
  pausesClock14: boolean;
}

// ─── Restart Qualification ──────────────────────────────────────────

/**
 * Validates 34-hour restart eligibility and completion.
 */
export interface RestartQualification {
  /** Driver is eligible for 34-hour restart */
  eligible: boolean;

  /** Restart period in hours */
  restartHours: number;

  /** Requires 2x 1-5am periods (US-specific) */
  requiresTwoPeriods1To5Am: boolean;

  /** First 1-5am period completed */
  firstPeriodCompleted: boolean;

  /** Second 1-5am period completed */
  secondPeriodCompleted: boolean;

  /** Restart period start */
  restartStartTime?: Date;

  /** Restart period end */
  restartEndTime?: Date;

  /** When restart will be complete */
  restartCompleteAt?: Date;
}

// ─── Break Status ───────────────────────────────────────────────────

/**
 * Current break requirement and status.
 */
export interface BreakStatus {
  /** Break is required */
  required: boolean;

  /** Minutes since last qualifying break */
  minutesSinceBreak: number;

  /** When break becomes mandatory */
  deadline?: Date;

  /** Duration of required break in minutes */
  requiredDurationMinutes: number;

  /** Driver has completed required break */
  breakCompleted: boolean;

  /** When last qualifying break was taken */
  lastBreakTime?: Date;
}

// ─── Driver Qualification ───────────────────────────────────────────

/**
 * Driver's qualification and certification status.
 */
export interface DriverQualification {
  /** Driver ID */
  driverId: string;

  /** Account ID */
  accountId: string;

  /** Commercial Driver License (CDL) number */
  cdlNumber: string;

  /** CDL state */
  cdlState: string;

  /** CDL class: A, B, C */
  cdlClass: "A" | "B" | "C";

  /** CDL endorsements (HazMat, Tanker, etc.) */
  cdlEndorsements?: string[];

  /** CDL restrictions */
  cdlRestrictions?: string[];

  /** CDL status: VALID, EXPIRED, SUSPENDED */
  cdlStatus: "VALID" | "EXPIRED" | "SUSPENDED";

  /** Medical certificate on file */
  medicalCertificate?: MedicalCertificate;

  /** Hired date */
  hiredDate: Date;

  /** Last safety training date */
  lastSafetyTrainingDate?: Date;

  /** Accident history in past 3 years */
  accidentHistory?: {
    date: Date;
    description: string;
    severity: "MINOR" | "MAJOR" | "CRITICAL";
  }[];

  /** Violation history in past 3 years */
  violationHistory?: {
    date: Date;
    violationType: string;
    severity: "WARNING" | "CRITICAL";
  }[];
}

// ─── Medical Certificate ────────────────────────────────────────────

/**
 * DOT Medical Examiner's Certificate (FMCSA Form 649-E).
 */
export interface MedicalCertificate {
  /** Certificate ID */
  certificateId: string;

  /** Examiner name */
  examinerName: string;

  /** Examination date */
  examinationDate: Date;

  /** Certificate valid until */
  expirationDate: Date;

  /** Medical examiner's license number */
  examinerLicenseNumber: string;

  /** Status: VALID, EXPIRED, UNDER_REVIEW */
  status: "VALID" | "EXPIRED" | "UNDER_REVIEW";

  /** Restrictions noted */
  restrictions?: string[];

  /** Notes from examiner */
  remarks?: string;
}

// ─── CDL Info ───────────────────────────────────────────────────────

/**
 * CDL information snapshot.
 */
export interface CDLInfo {
  /** CDL number */
  cdlNumber: string;

  /** Issuing state */
  state: string;

  /** CDL class */
  class: "A" | "B" | "C";

  /** Issue date */
  issueDate: Date;

  /** Expiration date */
  expirationDate: Date;

  /** Current endorsements */
  endorsements: string[];

  /** Current restrictions */
  restrictions: string[];

  /** Status */
  status: "VALID" | "EXPIRED" | "SUSPENDED" | "REVOKED";
}

// ─── DVIR Entry ─────────────────────────────────────────────────────

/**
 * Driver Vehicle Inspection Report entry per FMCSA 49 CFR 396.11-396.13.
 */
export interface DVIREntry {
  /** Unique DVIR ID */
  id: string;

  /** Account ID */
  accountId: string;

  /** Driver ID */
  driverId: string;

  /** Vehicle ID */
  vehicleId: string;

  /** Inspection type: PRE_TRIP or POST_TRIP */
  inspectionType: "PRE_TRIP" | "POST_TRIP";

  /** When inspection was performed */
  inspectionDate: Date;

  /** Overall condition */
  condition: "PASS" | "DEFECT" | "OUT_OF_SERVICE";

  /** List of defects found */
  defects: VehicleDefect[];

  /** Driver remarks */
  driverRemarks?: string;

  /** Mechanic repair status */
  repairStatus?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "WAIVED";

  /** Mechanic remarks */
  mechanicRemarks?: string;

  /** Defects certified repaired */
  defectsRepairedDate?: Date;

  /** Vehicle authorized for further operation */
  authorizedForOperation: boolean;

  /** Created timestamp */
  createdAt: Date;

  /** Last updated */
  updatedAt: Date;
}

// ─── Vehicle Defect ─────────────────────────────────────────────────

/**
 * Individual defect reported in DVIR.
 */
export interface VehicleDefect {
  /** Defect ID */
  id: string;

  /** Component affected (e.g., "Brake System", "Lights") */
  component: string;

  /** Detailed description */
  description: string;

  /** Severity: MINOR, MAJOR, CRITICAL */
  severity: DefectSeverity;

  /** Out-of-service defect per CVSA criteria */
  outOfService: boolean;

  /** Repair notes */
  repairNotes?: string;

  /** Repair completion date */
  repairedDate?: Date;

  /** Evidence/photo URLs */
  evidenceUrls?: string[];
}

// ─── Defect Severity ────────────────────────────────────────────────

export type DefectSeverity = "MINOR" | "MAJOR" | "CRITICAL";

// ─── Inspection Result ──────────────────────────────────────────────

/**
 * Result of vehicle inspection (pre-trip or post-trip).
 */
export interface InspectionResult {
  /** Inspection passed */
  passed: boolean;

  /** Defects found */
  defectsFound: VehicleDefect[];

  /** Vehicle out of service */
  outOfService: boolean;

  /** Required repairs before operation */
  requiredRepairs: VehicleDefect[];

  /** When vehicle can be returned to service */
  availableForOperationAt?: Date;
}
