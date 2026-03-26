/**
 * Error Mapper — Map provider-specific errors to Witylogix error catalog.
 *
 * Features:
 * - HTTP status code mapping to error codes
 * - Provider-specific error parsing (Stripe, Shopify, etc.)
 * - Enriched error context (provider, operation, correlation ID, timestamp)
 * - Retryable vs non-retryable classification
 * - Error sanitization (strip sensitive data before logging)
 *
 * Status code mappings:
 * - 401 → INTEGRATION_AUTH_FAILED
 * - 403 → INTEGRATION_AUTH_FAILED
 * - 404 → INTEGRATION_NOT_FOUND
 * - 429 → INTEGRATION_RATE_LIMITED
 * - 5xx → INTEGRATION_PROVIDER_ERROR
 * - Default → INTEGRATION_ERROR
 */

import type { Logger } from "pino";

// ─── Types ──────────────────────────────────────────────────────────

/** Witylogix error codes for integrations */
export type IntegrationErrorCode =
  | "INTEGRATION_ERROR"
  | "INTEGRATION_AUTH_FAILED"
  | "INTEGRATION_NOT_FOUND"
  | "INTEGRATION_RATE_LIMITED"
  | "INTEGRATION_PROVIDER_ERROR"
  | "INTEGRATION_INVALID_CONFIG"
  | "INTEGRATION_TIMEOUT"
  | "INTEGRATION_NETWORK_ERROR";

/** Enriched integration error */
export interface MappedError {
  /** Witylogix error code */
  code: IntegrationErrorCode;
  /** Human-readable message */
  message: string;
  /** Original error from provider */
  originalError?: unknown;
  /** Provider name */
  provider: string;
  /** Operation being performed (e.g., "createPayment") */
  operation?: string;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryDelay?: number;
  /** Correlation ID for tracing */
  correlationId: string;
  /** Error timestamp */
  timestamp: Date;
  /** Sanitized error details for logging */
  details?: Record<string, unknown>;
}

/** HTTP status code to error code mapping */
const STATUS_CODE_MAP: Record<number, IntegrationErrorCode> = {
  400: "INTEGRATION_ERROR",
  401: "INTEGRATION_AUTH_FAILED",
  403: "INTEGRATION_AUTH_FAILED",
  404: "INTEGRATION_NOT_FOUND",
  408: "INTEGRATION_TIMEOUT",
  429: "INTEGRATION_RATE_LIMITED",
  500: "INTEGRATION_PROVIDER_ERROR",
  502: "INTEGRATION_PROVIDER_ERROR",
  503: "INTEGRATION_PROVIDER_ERROR",
  504: "INTEGRATION_PROVIDER_ERROR",
};

/** Provider-specific error parsers */
type ErrorParser = (error: unknown) => {
  message: string;
  code?: string;
  statusCode?: number;
  retryable?: boolean;
};

/**
 * Error Mapper — Maps provider errors to Witylogix error codes.
 *
 * Handles provider-specific error formats and normalizes them
 * for consistent error handling across the platform.
 */
export class ErrorMapper {
  private parsers = new Map<string, ErrorParser>();
  private logger?: Logger;
  private sensitivePatterns = [
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /authorization/i,
    /password/i,
    /credential/i,
  ];

  constructor(logger?: Logger) {
    this.logger = logger;
    this.registerDefaultParsers();
  }

  /**
   * Map an error from a provider to Witylogix error format.
   */
  mapError(
    error: unknown,
    provider: string,
    operation?: string,
    correlationId?: string,
  ): MappedError {
    const now = new Date();
    const corrId = correlationId || this.generateCorrelationId();

    // Try provider-specific parser
    const parser = this.parsers.get(provider);
    const parsed = parser?.(error) || this.parseGenericError(error);

    // Map status code to error code
    let code: IntegrationErrorCode = "INTEGRATION_ERROR";
    if (parsed.statusCode) {
      code = STATUS_CODE_MAP[parsed.statusCode] || "INTEGRATION_PROVIDER_ERROR";
    } else if (parsed.code) {
      code = this.mapErrorCodeToWitylogix(parsed.code);
    }

    const retryable = this.isRetryable(code, parsed.statusCode);
    const retryDelay = this.getRetryDelay(code, parsed.statusCode);

    const mapped: MappedError = {
      code,
      message: parsed.message,
      originalError: error,
      provider,
      operation,
      statusCode: parsed.statusCode,
      retryable,
      retryDelay,
      correlationId: corrId,
      timestamp: now,
      details: this.sanitizeErrorDetails(error),
    };

    this.logger?.error(
      {
        provider,
        operation,
        code,
        statusCode: parsed.statusCode,
        correlationId: corrId,
        retryable,
      },
      `Integration error: ${parsed.message}`,
    );

    return mapped;
  }

  /**
   * Register a custom error parser for a provider.
   */
  registerParser(provider: string, parser: ErrorParser): void {
    this.parsers.set(provider, parser);
    this.logger?.debug({ provider }, "Custom error parser registered");
  }

  // ─── Private Methods ────────────────────────────────────────

  private registerDefaultParsers(): void {
    // Stripe error parser
    this.parsers.set("stripe", (error) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        typeof error.error === "object"
      ) {
        const stripeError = (error as any).error;
        return {
          message: stripeError.message || "Stripe API error",
          code: stripeError.code || stripeError.type,
          statusCode: (error as any).statusCode || 500,
          retryable: (error as any).statusCode ? (error as any).statusCode >= 500 : false,
        };
      }
      return { message: String(error) };
    });

    // Shopify error parser
    this.parsers.set("shopify", (error) => {
      if (typeof error === "object" && error !== null && "errors" in error) {
        const errors = (error as any).errors;
        let message = "Shopify API error";
        if (Array.isArray(errors) && errors.length > 0) {
          message = errors[0].message || message;
        } else if (typeof errors === "object") {
          const keys = Object.keys(errors);
          if (keys.length > 0) {
            message = `${keys[0]}: ${errors[keys[0]]}`;
          }
        }
        return {
          message,
          statusCode: (error as any).statusCode || 500,
          retryable: (error as any).statusCode ? (error as any).statusCode >= 500 : false,
        };
      }
      return { message: String(error) };
    });

    // AWS error parser
    this.parsers.set("aws", (error) => {
      if (typeof error === "object" && error !== null && "name" in error) {
        return {
          message: (error as any).message || "AWS API error",
          code: (error as any).code || (error as any).name,
          statusCode: (error as any).statusCode || 500,
          retryable: this.isAwsRetryable((error as any).code),
        };
      }
      return { message: String(error) };
    });

    // Google error parser
    this.parsers.set("google", (error) => {
      if (typeof error === "object" && error !== null && "error" in error) {
        const googleError = (error as any).error;
        if (typeof googleError === "object" && "message" in googleError) {
          return {
            message: googleError.message || "Google API error",
            code: googleError.code,
            statusCode: (error as any).statusCode || 500,
          };
        }
      }
      return { message: String(error) };
    });
  }

  private parseGenericError(error: unknown): {
    message: string;
    code?: string;
    statusCode?: number;
    retryable?: boolean;
  } {
    if (error instanceof Error) {
      return {
        message: error.message,
        statusCode: (error as any).statusCode,
      };
    }

    if (typeof error === "object" && error !== null) {
      const obj = error as any;
      return {
        message: obj.message || obj.msg || String(error),
        code: obj.code,
        statusCode: obj.statusCode || obj.status,
        retryable: obj.retryable,
      };
    }

    return { message: String(error) };
  }

  private mapErrorCodeToWitylogix(code: string): IntegrationErrorCode {
    const normalized = code.toLowerCase();

    if (normalized.includes("auth") || normalized.includes("unauthorized")) {
      return "INTEGRATION_AUTH_FAILED";
    }
    if (normalized.includes("rate")) {
      return "INTEGRATION_RATE_LIMITED";
    }
    if (normalized.includes("timeout") || normalized.includes("timed_out")) {
      return "INTEGRATION_TIMEOUT";
    }
    if (normalized.includes("network") || normalized.includes("connection")) {
      return "INTEGRATION_NETWORK_ERROR";
    }

    return "INTEGRATION_ERROR";
  }

  private isRetryable(code: IntegrationErrorCode, statusCode?: number): boolean {
    // Always retryable
    if (
      code === "INTEGRATION_RATE_LIMITED" ||
      code === "INTEGRATION_TIMEOUT" ||
      code === "INTEGRATION_NETWORK_ERROR"
    ) {
      return true;
    }

    // Retryable if 5xx
    if (statusCode && statusCode >= 500) {
      return true;
    }

    return false;
  }

  private getRetryDelay(code: IntegrationErrorCode, statusCode?: number): number | undefined {
    switch (code) {
      case "INTEGRATION_RATE_LIMITED":
        return 60000; // 1 minute
      case "INTEGRATION_TIMEOUT":
      case "INTEGRATION_NETWORK_ERROR":
        return 5000; // 5 seconds
      default:
        if (statusCode && statusCode >= 500) {
          return 10000; // 10 seconds for server errors
        }
        return undefined;
    }
  }

  private isAwsRetryable(code: string): boolean {
    const retryableCodes = [
      "Throttling",
      "ProvisionedThroughputExceededException",
      "RequestLimitExceeded",
      "ServiceUnavailable",
      "RequestTimeout",
    ];
    return retryableCodes.some((c) => code.includes(c));
  }

  private sanitizeErrorDetails(error: unknown): Record<string, unknown> | undefined {
    if (typeof error !== "object" || error === null) {
      return undefined;
    }

    const details: Record<string, unknown> = {};
    const obj = error as any;

    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveKey(key)) {
        details[key] = "[REDACTED]";
      } else if (typeof value === "string" && this.isSensitiveValue(value)) {
        details[key] = "[REDACTED]";
      } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        details[key] = value;
      }
    }

    return Object.keys(details).length > 0 ? details : undefined;
  }

  private isSensitiveKey(key: string): boolean {
    return this.sensitivePatterns.some((p) => p.test(key));
  }

  private isSensitiveValue(value: string): boolean {
    return (
      value.startsWith("sk_") ||
      value.startsWith("pk_") ||
      value.startsWith("Bearer ") ||
      value.startsWith("Basic ")
    );
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export type { Logger };
