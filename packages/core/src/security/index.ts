/**
 * Security Module Barrel Exports — OWASP Top 10 hardening.
 *
 * Central exports for all security hardening features:
 * - CSP headers
 * - CORS configuration
 * - Input sanitization
 * - Security headers
 * - Request fingerprinting
 * - Audit logging
 * - Secret scanning
 */

// Content Security Policy
export {
  CspEnvironment,
  CspManager,
  type CspViolationReport,
} from "./csp-headers";

// CORS Configuration
export {
  CorsManager,
  type CorsPolicyOverride,
  type CorsContext,
  type CorsValidationResult,
} from "./cors-config";

// Input Sanitization
export {
  InputSanitizer,
  type SanitizerConfig,
  type SanitizationResult,
} from "./input-sanitizer";

// Security Headers Middleware
export {
  SecurityHeadersMiddleware,
  type SecurityHeadersConfig,
  type SecurityHeaderOverride,
} from "./security-headers";

// Request Fingerprinting
export {
  RequestFingerprinter,
  type RequestAttributes,
  type StoredFingerprint,
  type AnomalyResult,
} from "./request-fingerprint";

// Audit Logging
export {
  AuditLogger,
  AuditEventType,
  type AuditActor,
  type AuditLogEntry,
  type AuditQuery,
  type AuditQueryResult,
  type StateChange,
} from "./audit-logger";

// Secret Scanning
export {
  SecretScanner,
  type SecretScannerConfig,
  type SecretDetectionResult,
} from "./secret-scanner";
