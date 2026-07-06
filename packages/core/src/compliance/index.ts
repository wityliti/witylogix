/**
 * Compliance Engine - Barrel Exports
 * Exports GDPR, data privacy, and HOS compliance modules
 */

// ─── GDPR/Data Compliance ────────────────────────────────────────

// Types and interfaces
export {
  DataSubjectRequest,
  DataSubjectRequestType,
  RequestStatus,
  ConsentRecord,
  PIIField,
  AnonymizationConfig,
  ComplianceReport,
  ComplianceError,
  AuditEntry,
  RetentionPolicy,
  DataExportPackage,
  DatabaseRecord,
  AnonymizationReportData,
} from "./types.js";

// Data export service
export { DataExportService, type DatabaseInterface } from "./data-export.js";

// Anonymizer
export { DataAnonymizer } from "./anonymizer.js";

// Consent management
export { ConsentManager } from "./consent-manager.js";

// Retention management
export { RetentionManager } from "./retention.js";

// Audit logging
export { ComplianceAuditLogger } from "./audit-logger.js";

// ─── HOS (Hours of Service) Compliance v2 ──────────────────────

// HOS Types
export type {
  LogEntry,
  HOSClock,
  HOSViolation,
  ComplianceResult,
  CycleRule,
  RuleSet,
  SleeperBerthSplit,
  RestartQualification,
  BreakStatus,
  DriverQualification,
  MedicalCertificate,
  CDLInfo,
  DVIREntry,
  VehicleDefect,
  InspectionResult,
} from "./hos-types.js";

export { DutyStatus } from "./hos-types.js";

// HOS Rules Engine
export { HOSRulesEngine, RuleEvaluator } from "./hos-rules-engine-v2.js";

// HOS Calculator
export { HOSCalculator } from "./hos-calculator.js";

// HOS Violation Detector
export { ViolationDetector } from "./hos-violation-detector.js";

// DVIR Engine
export { DVIREngine } from "./dvir-engine.js";
