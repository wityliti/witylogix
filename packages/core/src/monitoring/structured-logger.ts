/**
 * Structured JSON Logger — Production-grade logging with context injection.
 *
 * Features:
 * - Structured JSON output with custom fields
 * - Log levels: trace, debug, info, warn, error, fatal
 * - Context injection: requestId, userId, tenantId
 * - Child logger with inherited context
 * - Automatic sensitive data redaction (passwords, tokens, credit cards)
 * - Multiple output formats: JSON (production), pretty (development)
 * - Transport interface for console, file, and remote logging
 *
 * Usage:
 * const logger = createLogger("my-service");
 * logger.info("Order placed", { orderId: "123", totalAmount: 45.99 });
 * const childLogger = logger.child({ userId: "user-456" });
 * childLogger.error("Payment failed", { reason: "Card declined" });
 */

// ─── TYPES ─────────────────────────────────────────────────────────────

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  fields: Record<string, unknown>;
  context: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

export interface LogTransport {
  write(log: StructuredLog): Promise<void>;
}

export interface LoggerConfig {
  service: string;
  level?: LogLevel;
  format?: "json" | "pretty";
  transports?: LogTransport[];
  redactPatterns?: RegExp[];
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const DEFAULT_REDACT_PATTERNS = [
  /password["\s:=]+[^"}\s]*/gi,
  /token["\s:=]+[^"}\s]*/gi,
  /authorization["\s:=]+[^"}\s]*/gi,
  /credit[_-]?card["\s:=]+[0-9\-\s]*/gi,
  /cvv["\s:=]+[0-9]*/gi,
  /api[_-]?key["\s:=]+[^"}\s]*/gi,
  /secret["\s:=]+[^"}\s]*/gi,
];

// ─── LOGGER CLASS ──────────────────────────────────────────────────────

/**
 * Structured logger with context injection and redaction.
 */
export class Logger {
  private config: LoggerConfig;
  private context: LogContext = {};
  private redactPatterns: RegExp[];
  private consoleTransport: LogTransport;

  constructor(config: LoggerConfig) {
    this.config = {
      level: "info",
      format: "json",
      ...config,
    };

    this.redactPatterns = config.redactPatterns || DEFAULT_REDACT_PATTERNS;

    this.consoleTransport = {
      write: async (log: StructuredLog) => {
        const output =
          this.config.format === "pretty"
            ? this.formatPretty(log)
            : JSON.stringify(log);

        if (log.level === "error" || log.level === "fatal") {
          console.error(output);
        } else if (log.level === "warn") {
          console.warn(output);
        } else {
          console.log(output);
        }
      },
    };
  }

  /**
   * Add context that will be included in all subsequent logs.
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Create a child logger with inherited context.
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger({
      ...this.config,
      transports: this.config.transports,
    });
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  trace(message: string, fields?: Record<string, unknown>): void {
    this.log("trace", message, fields);
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log("debug", message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.log("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.log("warn", message, fields);
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    const fields = error instanceof Error ? { error } : error;
    this.log("error", message, fields);
  }

  fatal(message: string, error?: Error | Record<string, unknown>): void {
    const fields = error instanceof Error ? { error } : error;
    this.log("fatal", message, fields);
  }

  /**
   * Internal logging method.
   */
  private log(
    level: LogLevel,
    message: string,
    fields?: Record<string, unknown>,
  ): void {
    // Check log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level || "info"]) {
      return;
    }

    let errorInfo: StructuredLog["error"] | undefined;
    let processedFields = { ...fields };

    // Handle error object
    if (fields?.error instanceof Error) {
      errorInfo = {
        message: fields.error.message,
        stack: fields.error.stack,
        name: fields.error.name,
      };
      delete processedFields.error;
    }

    // Redact sensitive data
    const redactedFields = this.redactSensitiveData(processedFields);

    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.service,
      message,
      fields: redactedFields,
      context: this.context,
      error: errorInfo,
    };

    // Write to transports
    const transports = this.config.transports || [this.consoleTransport];
    for (const transport of transports) {
      transport.write(log).catch((err) => {
        console.error("Transport error:", err);
      });
    }
  }

  /**
   * Redact sensitive information from fields.
   */
  private redactSensitiveData(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (typeof value === "string") {
        // Check key names for sensitive patterns
        if (
          /password|token|secret|credential|key|authorization|credit|card|cvv|ssn|api_key/i.test(
            key,
          )
        ) {
          result[key] = "[REDACTED]";
          continue;
        }

        // Check value content
        let redacted = value;
        for (const pattern of this.redactPatterns) {
          if (pattern.test(redacted)) {
            redacted = redacted.replace(pattern, "[REDACTED]");
          }
        }
        result[key] = redacted;
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.redactSensitiveData(
          value as Record<string, unknown>,
        );
      }
    }

    return result;
  }

  /**
   * Format log for pretty printing (development).
   */
  private formatPretty(log: StructuredLog): string {
    const levelColors: Record<LogLevel, string> = {
      trace: "\x1b[36m",
      debug: "\x1b[34m",
      info: "\x1b[32m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
      fatal: "\x1b[35m",
    };

    const reset = "\x1b[0m";
    const color = levelColors[log.level];
    const timestamp = log.timestamp;
    const service = log.service;
    const level = log.level.toUpperCase();
    const message = log.message;

    const contextStr =
      Object.keys(log.context).length > 0
        ? ` [${Object.entries(log.context)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}]`
        : "";

    const fieldsStr =
      Object.keys(log.fields).length > 0
        ? ` ${JSON.stringify(log.fields)}`
        : "";

    const errorStr = log.error
      ? `\n  Error: ${log.error.name}: ${log.error.message}${
          log.error.stack ? `\n${log.error.stack}` : ""
        }`
      : "";

    return `${color}${timestamp} [${service}] ${level}${reset} ${message}${contextStr}${fieldsStr}${errorStr}`;
  }
}

// ─── FACTORY FUNCTION ──────────────────────────────────────────────────

/**
 * Create a new logger instance.
 *
 * @param service - Service name for log identification
 * @param config - Optional logger configuration
 * @returns Logger instance
 */
export function createLogger(
  service: string,
  config?: Partial<LoggerConfig>,
): Logger {
  return new Logger({
    service,
    ...config,
  });
}
