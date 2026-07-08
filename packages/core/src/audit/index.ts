/**
 * Audit Trail Module — Audit logging and compliance
 * Main barrel exports for audit trail functionality
 */

// Types
export {
  AuditAction,
  AuditEvent,
  ChangedField,
  SENSITIVE_FIELDS,
  AuditQuery,
  AuditQueryResult,
  UserActivitySummary,
  EntityHistory,
  AuditConfig,
  AuditStats,
  AuditError,
  AuditQueryError,
  AuditLogError,
  AuditEventBuilder,
} from "./types";

// Logger
export { AuditLogger } from "./logger";

// Query Engine
export { AuditQueryEngine, createAuditQueryEngine } from "./query";
