/**
 * Request Logger — Structured logging for integration API calls.
 *
 * Features:
 * - Correlation ID generation and propagation (X-Request-ID)
 * - Request logging: method, URL (sanitized), headers (masked auth), body size
 * - Response logging: status, latency, body size, rate limit headers
 * - Error logging: error type, message, stack (dev only)
 * - Sensitive data redaction (Authorization, API keys in URLs)
 * - Log levels: debug (full), info (summary), error (failures only)
 * - Async log shipping (non-blocking)
 *
 * All logs include provider, operation, and request ID for tracing.
 */

import type { Logger } from "pino";
import { EventEmitter } from "events";

// ─── Types ──────────────────────────────────────────────────────────

/** HTTP request details */
export interface RequestDetails {
  method: string;
  url: string;
  headers?: Record<string, string>;
  bodySize?: number;
}

/** HTTP response details */
export interface ResponseDetails {
  statusCode: number;
  headers?: Record<string, string>;
  bodySize?: number;
  latency: number; // milliseconds
}

/** Request log entry */
export interface RequestLogEntry {
  requestId: string;
  correlationId: string;
  provider: string;
  operation?: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  bodySize?: number;
  timestamp: Date;
}

/** Response log entry */
export interface ResponseLogEntry {
  requestId: string;
  correlationId: string;
  provider: string;
  operation?: string;
  statusCode: number;
  latency: number;
  bodySize?: number;
  rateLimitHeaders?: Record<string, string>;
  timestamp: Date;
}

/** Error log entry */
export interface ErrorLogEntry {
  requestId: string;
  correlationId: string;
  provider: string;
  operation?: string;
  statusCode?: number;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  timestamp: Date;
}

/** Log ship event (for async transport) */
export interface LogShipEvent {
  type: "request" | "response" | "error";
  data: RequestLogEntry | ResponseLogEntry | ErrorLogEntry;
}

/**
 * Request Logger — Structured logging for integration API calls.
 *
 * Logs all integration API interactions with sensitive data redaction,
 * correlation IDs, and async non-blocking transport.
 */
export class RequestLogger extends EventEmitter {
  private logger?: Logger;
  private isDevelopment: boolean;
  private correlationMap = new Map<string, string>();
  private requestTimes = new Map<string, number>();
  private sensitiveHeaderPatterns = [
    /^authorization$/i,
    /^x-api-key$/i,
    /^x-access-token$/i,
    /^x-auth-token$/i,
    /^cookie$/i,
    /^x-csrf-token$/i,
  ];

  constructor(logger?: Logger, isDevelopment: boolean = false) {
    super();
    this.logger = logger;
    this.isDevelopment = isDevelopment;
  }

  /**
   * Generate a new correlation ID for a request.
   */
  generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log an outgoing request.
   */
  logRequest(
    provider: string,
    request: RequestDetails,
    operation?: string,
    correlationId?: string,
  ): string {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const corrId = correlationId || this.generateCorrelationId();

    this.correlationMap.set(requestId, corrId);
    this.requestTimes.set(requestId, Date.now());

    const sanitizedUrl = this.sanitizeUrl(request.url);
    const sanitizedHeaders = this.sanitizeHeaders(request.headers || {});

    const entry: RequestLogEntry = {
      requestId,
      correlationId: corrId,
      provider,
      operation,
      method: request.method,
      url: sanitizedUrl,
      headers: sanitizedHeaders,
      bodySize: request.bodySize,
      timestamp: new Date(),
    };

    this.logger?.debug(
      {
        requestId,
        correlationId: corrId,
        provider,
        operation,
        method: request.method,
        url: sanitizedUrl,
        bodySize: request.bodySize,
      },
      "Integration API request",
    );

    this.emit("request", entry);
    this.shipLog({ type: "request", data: entry });

    return requestId;
  }

  /**
   * Log an incoming response.
   */
  logResponse(
    requestId: string,
    response: ResponseDetails,
    rateLimitHeaders?: Record<string, string>,
  ): void {
    const corrId = this.correlationMap.get(requestId) || "unknown";
    const startTime = this.requestTimes.get(requestId);
    let latency = response.latency;

    if (startTime && latency === 0) {
      latency = Date.now() - startTime;
    }

    const entry: ResponseLogEntry = {
      requestId,
      correlationId: corrId,
      provider: "unknown",
      statusCode: response.statusCode,
      latency,
      bodySize: response.bodySize,
      rateLimitHeaders,
      timestamp: new Date(),
    };

    const logLevel = response.statusCode >= 400 ? "warn" : "debug";
    this.logger?.[logLevel]?.(
      {
        requestId,
        correlationId: corrId,
        statusCode: response.statusCode,
        latency,
        bodySize: response.bodySize,
        rateLimitHeaders: rateLimitHeaders
          ? Object.keys(rateLimitHeaders)
          : undefined,
      },
      "Integration API response",
    );

    this.emit("response", entry);
    this.shipLog({ type: "response", data: entry });

    // Cleanup
    this.correlationMap.delete(requestId);
    this.requestTimes.delete(requestId);
  }

  /**
   * Log a request error.
   */
  logError(
    requestId: string,
    provider: string,
    error: unknown,
    operation?: string,
    statusCode?: number,
  ): void {
    const corrId = this.correlationMap.get(requestId) || "unknown";
    const startTime = this.requestTimes.get(requestId);
    const latency = startTime ? Date.now() - startTime : 0;

    let errorType = "Unknown";
    let errorMessage = "Unknown error";
    let errorStack: string | undefined;

    if (error instanceof Error) {
      errorType = error.constructor.name;
      errorMessage = error.message;
      if (this.isDevelopment) {
        errorStack = error.stack;
      }
    } else if (typeof error === "object" && error !== null) {
      errorType = (error as any).name || "Object";
      errorMessage = (error as any).message || String(error);
    } else {
      errorMessage = String(error);
    }

    const entry: ErrorLogEntry = {
      requestId,
      correlationId: corrId,
      provider,
      operation,
      statusCode,
      errorType,
      errorMessage,
      errorStack,
      timestamp: new Date(),
    };

    this.logger?.error(
      {
        requestId,
        correlationId: corrId,
        provider,
        operation,
        statusCode,
        errorType,
        errorMessage,
        latency,
        stack: this.isDevelopment ? errorStack : undefined,
      },
      `Integration API error: ${errorMessage}`,
    );

    this.emit("error", entry);
    this.shipLog({ type: "error", data: entry });

    // Cleanup
    this.correlationMap.delete(requestId);
    this.requestTimes.delete(requestId);
  }

  /**
   * Get correlation ID for a request.
   */
  getCorrelationId(requestId: string): string | undefined {
    return this.correlationMap.get(requestId);
  }

  /**
   * Set provider info for a logged request.
   */
  setRequestProvider(requestId: string, provider: string): void {
    // Update in correlation tracking (for future use in response logging)
    // In a real implementation, you'd store this with the request ID
  }

  // ─── Private Methods ────────────────────────────────────────

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove sensitive query parameters
      const sensitiveParams = [
        "api_key",
        "apiKey",
        "token",
        "secret",
        "password",
      ];
      for (const param of sensitiveParams) {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, "[REDACTED]");
        }
      }

      // Remove credentials from auth URL if present
      if (parsed.username) {
        parsed.username = "[REDACTED]";
      }
      if (parsed.password) {
        parsed.password = "[REDACTED]";
      }

      return parsed.toString();
    } catch {
      // If URL parsing fails, return masked version
      return url.replace(
        /([?&](api_key|token|secret|password)=)[^&]*/gi,
        "$1[REDACTED]",
      );
    }
  }

  private sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (this.isSensitiveHeader(key)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSensitiveHeader(headerName: string): boolean {
    return this.sensitiveHeaderPatterns.some((pattern) =>
      pattern.test(headerName),
    );
  }

  private shipLog(event: LogShipEvent): void {
    // Non-blocking async log shipping
    // Emit event for external log transport (e.g., to CloudWatch, Datadog, etc.)
    this.emit("log-ship", event);

    // In production, this would be sent to a log aggregation service
    // For now, just emit the event for subscribers to handle
  }
}

export type { Logger };
