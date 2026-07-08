/**
 * Structured Logger Implementation
 * Pino-compatible JSON logger with sensitive field redaction
 * Supports request tracing, child loggers, and performance monitoring
 */

import {
  LogLevel,
  LogEntry,
  LoggerConfig,
  RequestContext,
  SENSITIVE_FIELD_PATTERNS,
  SENSITIVE_HEADERS,
} from "./types.js";

/**
 * Redaction mask for sensitive values
 */
const REDACTION_MASK = "[REDACTED]";

/**
 * Main Logger class - JSON structured logging with Pino-compatible API
 * Provides debug/info/warn/error/fatal methods
 * Supports child loggers with inherited context
 * Performs automatic sensitive field redaction
 */
export class Logger {
  private config: LoggerConfig;
  private context: Record<string, unknown> = {};
  private requestContext?: RequestContext;

  constructor(config: LoggerConfig) {
    this.config = {
      pretty: false,
      outputStream: process.stdout,
      ...config,
    };
  }

  /**
   * Log at DEBUG level
   * Before serialization, checks if DEBUG level is enabled for performance
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log at INFO level
   * Before serialization, checks if INFO level is enabled for performance
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log at WARN level
   * Before serialization, checks if WARN level is enabled for performance
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log at ERROR level
   * Before serialization, checks if ERROR level is enabled for performance
   */
  error(
    message: string,
    errorOrMetadata?: Error | Record<string, unknown>,
  ): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    let metadata: Record<string, unknown> = {};
    let error: LogEntry["error"] | undefined;

    if (errorOrMetadata instanceof Error) {
      error = {
        name: errorOrMetadata.name,
        message: errorOrMetadata.message,
        stack: errorOrMetadata.stack,
        code: (errorOrMetadata as any).code,
      };
    } else if (errorOrMetadata) {
      metadata = errorOrMetadata;
    }

    this.log(LogLevel.ERROR, message, metadata, error);
  }

  /**
   * Log at FATAL level
   * Before serialization, checks if FATAL level is enabled for performance
   */
  fatal(
    message: string,
    errorOrMetadata?: Error | Record<string, unknown>,
  ): void {
    if (!this.shouldLog(LogLevel.FATAL)) return;

    let metadata: Record<string, unknown> = {};
    let error: LogEntry["error"] | undefined;

    if (errorOrMetadata instanceof Error) {
      error = {
        name: errorOrMetadata.name,
        message: errorOrMetadata.message,
        stack: errorOrMetadata.stack,
        code: (errorOrMetadata as any).code,
      };
    } else if (errorOrMetadata) {
      metadata = errorOrMetadata;
    }

    this.log(LogLevel.FATAL, message, metadata, error);
  }

  /**
   * Create a child logger with additional context bindings
   * Child logger inherits parent's request context
   * Useful for module-specific loggers with bound values
   */
  child(bindings: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.context = { ...this.context, ...bindings };
    childLogger.requestContext = this.requestContext;
    return childLogger;
  }

  /**
   * Create logger with request context for tracing
   * Returns a child logger with traceId, spanId, tenantId, and userId bound
   */
  withContext(requestContext: RequestContext): Logger {
    const childLogger = new Logger(this.config);
    childLogger.context = { ...this.context };
    childLogger.requestContext = requestContext;
    return childLogger;
  }

  /**
   * Internal method: check if log level should be output
   * Performance optimization: skip expensive serialization if level disabled
   */
  private shouldLog(level: LogLevel | string): boolean {
    const levelOrder: Record<string, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.FATAL]: 4,
    };

    const configLevel = levelOrder[this.config.level] ?? 1;
    const currentLevel = levelOrder[level] ?? 1;
    return currentLevel >= configLevel;
  }

  /**
   * Internal method: perform actual logging
   * Redacts sensitive fields, formats output, writes to stream
   */
  private log(
    level: LogLevel | string,
    message: string,
    metadata?: Record<string, unknown>,
    error?: LogEntry["error"],
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      ...(this.requestContext && {
        traceId: this.requestContext.traceId,
        spanId: this.requestContext.spanId,
        tenantId: this.requestContext.tenantId,
        userId: this.requestContext.userId,
      }),
      ...(metadata && { metadata: this.redactSensitiveFields(metadata) }),
      ...(error && { error }),
      ...(this.requestContext && {
        duration: Date.now() - this.requestContext.startTime,
      }),
    };

    // Merge bound context from child loggers
    if (Object.keys(this.context).length > 0) {
      entry.metadata = {
        ...this.redactSensitiveFields(this.context),
        ...(entry.metadata || {}),
      };
    }

    const output = this.formatOutput(entry);
    this.config.outputStream?.write(output + "\n");
  }

  /**
   * Format log entry as JSON
   * Pretty prints for development, compact JSON for production
   */
  private formatOutput(entry: LogEntry): string {
    if (this.config.pretty) {
      return JSON.stringify(entry, null, 2);
    }
    return JSON.stringify(entry);
  }

  /**
   * Recursively redact sensitive fields in an object
   * Masks values of fields matching SENSITIVE_FIELD_PATTERNS
   */
  private redactSensitiveFields(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactSensitiveFields(item));
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if this key matches any sensitive pattern
      const isSensitive = SENSITIVE_FIELD_PATTERNS.some((pattern) =>
        lowerKey.includes(pattern.toLowerCase()),
      );

      if (isSensitive && value !== null && value !== undefined) {
        redacted[key] = REDACTION_MASK;
      } else if (typeof value === "object") {
        redacted[key] = this.redactSensitiveFields(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }
}

/**
 * Create a new logger instance with the given configuration
 * Factory function for consistent logger creation
 */
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}
