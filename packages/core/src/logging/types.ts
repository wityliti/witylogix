/**
 * Structured Logging Types
 * Provides type definitions for a Pino-compatible structured logging system
 * with support for request tracing, correlation IDs, and sensitive field redaction
 */

/**
 * Log level enumeration following standard logging conventions
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

/**
 * Structured log entry with observability metadata
 * All timestamps are ISO 8601 format
 */
export interface LogEntry {
  /** ISO 8601 timestamp when log was created */
  timestamp: string;

  /** Log level (debug, info, warn, error, fatal) */
  level: LogLevel | string;

  /** Primary log message */
  message: string;

  /** Service/module name generating the log */
  service: string;

  /** Optional request trace ID for distributed tracing */
  traceId?: string;

  /** Optional span ID for detailed request tracing */
  spanId?: string;

  /** Optional tenant ID for multi-tenant observability */
  tenantId?: string;

  /** Optional user ID for user action tracking */
  userId?: string;

  /** Additional structured metadata for the log entry */
  metadata?: Record<string, unknown>;

  /** Error object if logging an exception */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };

  /** Request duration in milliseconds (useful for performance tracking) */
  duration?: number;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output (debug < info < warn < error < fatal) */
  level: LogLevel | string;

  /** Service/module name for all logs from this logger */
  service: string;

  /** Pretty print JSON output (human-readable for development) */
  pretty?: boolean;

  /** Output stream for logs (defaults to stdout) */
  outputStream?: NodeJS.WritableStream;
}

/**
 * Request context for tracing and observability
 * Captured at request start and passed through the request lifecycle
 */
export interface RequestContext {
  /** Unique trace ID for the entire request lifecycle */
  traceId: string;

  /** Optional span ID for tracing specific operations */
  spanId?: string;

  /** Optional tenant ID extracted from request */
  tenantId?: string;

  /** Optional authenticated user ID */
  userId?: string;

  /** HTTP method (GET, POST, etc.) */
  method: string;

  /** Request path/URL */
  path: string;

  /** Request start timestamp in milliseconds since epoch */
  startTime: number;
}

/**
 * Sensitive field patterns for automatic redaction
 * These fields will be masked in logs to prevent credential leakage
 */
export const SENSITIVE_FIELD_PATTERNS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "authorization",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "sessionId",
  "session_id",
  "cookieValue",
  "cookie",
  "creditCard",
  "credit_card",
  "ssn",
  "privateKey",
  "private_key",
  "webhookSecret",
  "webhook_secret",
];

/**
 * Sensitive HTTP headers that should be redacted
 */
export const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-access-token",
  "x-csrf-token",
  "set-cookie",
];
