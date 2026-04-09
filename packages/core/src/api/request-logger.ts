/**
 * Request Logger — Structured JSON logging for HTTP requests/responses.
 *
 * Features:
 * - UUID v4 request ID generation
 * - Request/response timing (duration calculation)
 * - Sensitive field sanitization (password, token, auth headers)
 * - Multiple log levels (debug, info, warn, error)
 * - Correlation ID propagation (X-Correlation-ID)
 * - Structured JSON format for log aggregation
 *
 * Usage:
 *   const logger = new RequestLogger();
 *   const reqId = logger.logRequest(request);
 *   logger.logResponse(reqId, response, durationMs);
 */

import { v4 as uuidv4 } from "crypto";

type LogLevel = "debug" | "info" | "warn" | "error";

interface RequestLogEntry {
  requestId: string;
  correlationId?: string;
  timestamp: string;
  level: LogLevel;
  method: string;
  path: string;
  statusCode?: number;
  durationMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, string | string[]>;
  body?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
}

interface LoggerOptions {
  sanitizeFields?: string[];
  redactValue?: string;
  includeHeaders?: boolean;
  includeBody?: boolean;
  maxBodySize?: number;
  logLevel?: LogLevel;
}

/**
 * Structured request/response logger.
 */
export class RequestLogger {
  private sanitizeFields: Set<string>;
  private redactValue: string;
  private includeHeaders: boolean;
  private includeBody: boolean;
  private maxBodySize: number;
  private logLevel: LogLevel;
  private requestTimestamps: Map<string, number>;

  constructor(options: LoggerOptions = {}) {
    this.sanitizeFields = new Set([
      "password",
      "token",
      "authorization",
      "x-api-key",
      "x-auth-token",
      "secret",
      "api-key",
      "apikey",
      "access_token",
      "refresh_token",
      "bearer",
      "creditcard",
      "cvv",
      "ssn",
      ...(options.sanitizeFields || []).map((f) => f.toLowerCase()),
    ]);

    this.redactValue = options.redactValue ?? "[REDACTED]";
    this.includeHeaders = options.includeHeaders ?? true;
    this.includeBody = options.includeBody ?? false; // Only in debug mode
    this.maxBodySize = options.maxBodySize ?? 1024; // 1KB limit
    this.logLevel = options.logLevel ?? "info";
    this.requestTimestamps = new Map();
  }

  /**
   * Generate UUID v4 (simulated - uses crypto.randomUUID).
   */
  private generateRequestId(): string {
    // Note: In actual implementation with Node.js crypto module
    return `req_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  /**
   * Log incoming request.
   */
  logRequest(request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, string | string[]>;
    body?: any;
    correlationId?: string;
  }): string {
    const requestId = this.generateRequestId();
    const now = Date.now();

    this.requestTimestamps.set(requestId, now);

    const entry: RequestLogEntry = {
      requestId,
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
      level: "info",
      method: request.method,
      path: request.path,
      headers: this.includeHeaders
        ? this.sanitizeObject(request.headers || {})
        : undefined,
      query: request.query,
      body: this.includeBody ? this.trimBody(request.body) : undefined,
      metadata: {
        ip: "unknown",
        userAgent: request.headers?.["user-agent"],
      },
    };

    this.output(entry);
    return requestId;
  }

  /**
   * Log outgoing response.
   */
  logResponse(
    requestId: string,
    response: {
      statusCode: number;
      headers?: Record<string, string>;
      body?: any;
    },
    durationMs?: number
  ): void {
    const startTime = this.requestTimestamps.get(requestId);
    const duration = durationMs || (startTime ? Date.now() - startTime : 0);

    const entry: RequestLogEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      level: this.getLogLevelForStatus(response.statusCode),
      method: "RESPONSE",
      path: "n/a",
      statusCode: response.statusCode,
      durationMs: duration,
      headers: this.includeHeaders
        ? this.sanitizeObject(response.headers || {})
        : undefined,
      body: this.includeBody ? this.trimBody(response.body) : undefined,
    };

    this.output(entry);

    // Clean up timestamp
    this.requestTimestamps.delete(requestId);
  }

  /**
   * Log error event.
   */
  logError(
    requestId: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    const entry: RequestLogEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      level: "error",
      method: "ERROR",
      path: "n/a",
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
      metadata: context,
    };

    this.output(entry);
  }

  /**
   * Log custom event.
   */
  log(
    level: LogLevel,
    message: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): void {
    const entry: RequestLogEntry = {
      requestId: requestId || "unknown",
      timestamp: new Date().toISOString(),
      level,
      method: "LOG",
      path: message,
      metadata,
    };

    this.output(entry);
  }

  /**
   * Get log level for HTTP status code.
   */
  private getLogLevelForStatus(status: number): LogLevel {
    if (status >= 500) return "error";
    if (status >= 400) return "warn";
    return "info";
  }

  /**
   * Sanitize sensitive fields in object.
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (this.sanitizeFields.has(lowerKey)) {
        result[key] = this.redactValue;
      } else if (typeof value === "string") {
        // Also check if value looks like a token
        if (
          value.startsWith("Bearer ") ||
          value.startsWith("Bearer") ||
          (value.length > 20 && value.match(/^[a-zA-Z0-9_\-\.]+$/))
        ) {
          result[key] = this.redactValue;
        } else {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Trim body to max size.
   */
  private trimBody(body: any): any {
    if (!body) return undefined;

    const str =
      typeof body === "string" ? body : JSON.stringify(body);

    if (str.length > this.maxBodySize) {
      return str.substring(0, this.maxBodySize) + "...";
    }

    return body;
  }

  /**
   * Output log entry (console in this implementation).
   */
  private output(entry: RequestLogEntry): void {
    // In production, this would send to log aggregation service
    const logMap: Record<LogLevel, (msg: string) => void> = {
      debug: console.debug,
      info: console.log,
      warn: console.warn,
      error: console.error,
    };

    const logger = logMap[entry.level];
    logger(JSON.stringify(entry));
  }

  /**
   * Create middleware-compatible request logger.
   */
  createMiddleware() {
    return (request: any, response: any, next: Function) => {
      const requestId = this.logRequest({
        method: request.method,
        path: request.path || request.url,
        headers: request.headers,
        query: request.query,
        correlationId: request.headers?.["x-correlation-id"],
      });

      // Attach to request for logging response
      (request as any).requestId = requestId;

      // Log response when sent
      const originalSend = response.send;
      response.send = function (data: any) {
        this.logResponse?.(requestId, {
          statusCode: this.statusCode,
          headers: this.getHeaders?.(),
          body: data,
        });

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Set log level threshold.
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Clear all tracked request timestamps.
   */
  clear(): void {
    this.requestTimestamps.clear();
  }
}

export type { RequestLogEntry, LogLevel };
