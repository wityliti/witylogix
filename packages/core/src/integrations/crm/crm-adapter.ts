/**
 * Abstract CRM Adapter Base Class
 * Provides common OAuth2, rate limiting, circuit breaker, and field mapping logic
 */

import type {
  CRMConnection,
  CRMFieldMapping,
  CRMPaginationParams,
  CRMFieldType,
  RateLimitInfo,
  CRMError,
} from "./types.js";

// ─── CIRCUIT BREAKER STATE ─────────────────────────────────────────

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms
}

// ─── RATE LIMITER ────────────────────────────────────────────────

class RateLimiter {
  private requestTimestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now: number = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts: number) => now - ts < this.windowMs,
    );

    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestTimestamp: number = this.requestTimestamps[0] as number;
      const waitTime: number = this.windowMs - (now - oldestTimestamp);
      await new Promise((resolve: (value: void) => void) => {
        setTimeout(resolve, waitTime);
      });
      return this.acquire();
    }

    this.requestTimestamps.push(now);
  }

  getInfo(): RateLimitInfo {
    const now: number = Date.now();
    const recentRequests: number[] = this.requestTimestamps.filter(
      (ts: number) => now - ts < this.windowMs,
    );
    const remaining: number = Math.max(
      0,
      this.maxRequests - recentRequests.length,
    );
    const resetAt: Date = new Date(now + this.windowMs);

    return {
      remaining,
      limit: this.maxRequests,
      resetAt,
    };
  }
}

// ─── CIRCUIT BREAKER ────────────────────────────────────────────

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now: number = Date.now();
      if (now - this.lastFailureTime >= this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result: T = await fn();
      this.onSuccess();
      return result;
    } catch (error: unknown) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ─── FIELD MAPPING ENGINE ────────────────────────────────────────

export class FieldMappingEngine {
  private mappings: Map<string, CRMFieldMapping> = new Map();

  constructor(mappings: CRMFieldMapping[] = []) {
    mappings.forEach((mapping: CRMFieldMapping) => {
      const key: string = `${mapping.recordType}:${mapping.witylogixField}`;
      this.mappings.set(key, mapping);
    });
  }

  getMapping(
    recordType: string,
    witylogixField: string,
  ): CRMFieldMapping | undefined {
    const key: string = `${recordType}:${witylogixField}`;
    return this.mappings.get(key);
  }

  getAllMappings(recordType: string): CRMFieldMapping[] {
    const results: CRMFieldMapping[] = [];
    this.mappings.forEach((mapping: CRMFieldMapping) => {
      if (mapping.recordType === recordType) {
        results.push(mapping);
      }
    });
    return results;
  }

  mapWitylogixToCRM(
    recordType: string,
    witylogixData: Record<string, unknown>,
  ): Record<string, unknown> {
    const crmData: Record<string, unknown> = {};

    Object.entries(witylogixData).forEach(
      ([field, value]: [string, unknown]) => {
        const mapping: CRMFieldMapping | undefined = this.getMapping(
          recordType,
          field,
        );
        if (
          mapping &&
          (mapping.direction === "to_crm" ||
            mapping.direction === "bidirectional")
        ) {
          const transformedValue: unknown = this.transformValue(value, mapping);
          crmData[mapping.crmField] = transformedValue;
        }
      },
    );

    return crmData;
  }

  mapCRMToWitylogix(
    recordType: string,
    crmData: Record<string, unknown>,
  ): Record<string, unknown> {
    const witylogixData: Record<string, unknown> = {};

    this.getAllMappings(recordType).forEach((mapping: CRMFieldMapping) => {
      if (
        mapping.direction === "from_crm" ||
        mapping.direction === "bidirectional"
      ) {
        const value: unknown = crmData[mapping.crmField];
        if (value !== undefined) {
          const transformedValue: unknown = this.transformValue(value, mapping);
          witylogixData[mapping.witylogixField] = transformedValue;
        }
      }
    });

    return witylogixData;
  }

  private transformValue(value: unknown, mapping: CRMFieldMapping): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    const transformation: string = mapping.transformation || "none";

    switch (transformation) {
      case "uppercase":
        return String(value).toUpperCase();
      case "lowercase":
        return String(value).toLowerCase();
      case "phone_format":
        return this.formatPhone(String(value));
      case "custom":
        return this.applyCustomTransformation(
          value,
          mapping.transformationScript,
        );
      case "none":
      default:
        return value;
    }
  }

  private formatPhone(phone: string): string {
    const digits: string = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  private applyCustomTransformation(value: unknown, script?: string): unknown {
    if (!script) {
      return value;
    }
    try {
      const fn: Function = new Function("value", `return ${script}`);
      return fn(value);
    } catch {
      return value;
    }
  }
}

// ─── PAGINATION HANDLER ────────────────────────────────────────

export class PaginationHandler {
  /**
   * Generate SOQL OFFSET clause for Salesforce pagination
   */
  static generateSFDCOffset(pagination?: CRMPaginationParams): string {
    if (!pagination || pagination.offset === undefined) {
      return "";
    }
    return ` OFFSET ${pagination.offset}`;
  }

  /**
   * Generate LIMIT clause for both Salesforce and HubSpot
   */
  static generateLimit(pagination?: CRMPaginationParams): number {
    const limit: number = pagination?.limit ?? 100;
    return Math.min(limit, 2000); // Max 2000 per API standard
  }

  /**
   * Handle cursor-based pagination for HubSpot
   */
  static parseCursor(cursor?: string): Record<string, unknown> {
    if (!cursor) {
      return {};
    }
    try {
      return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    } catch {
      return {};
    }
  }

  /**
   * Encode pagination state to cursor
   */
  static encodeCursor(state: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(state)).toString("base64");
  }
}

// ─── ABSTRACT BASE ADAPTER ────────────────────────────────────────

export abstract class CRMAdapterBase {
  protected connection: CRMConnection;
  protected rateLimiter: RateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected fieldMappingEngine: FieldMappingEngine;

  protected readonly timeout: number = 30000;
  protected readonly maxRetries: number = 3;

  constructor(
    connection: CRMConnection,
    fieldMappings: CRMFieldMapping[] = [],
  ) {
    this.connection = connection;
    this.fieldMappingEngine = new FieldMappingEngine(fieldMappings);

    // Initialize rate limiter (100 requests per minute)
    this.rateLimiter = new RateLimiter(100, 60000);

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
    });
  }

  /**
   * Ensure OAuth token is valid, refresh if needed
   */
  protected async ensureValidToken(): Promise<string> {
    if (!this.connection.expiresAt) {
      return this.connection.accessToken;
    }

    const now: Date = new Date();
    const expirationBuffer: number = 5 * 60 * 1000; // 5 minutes

    if (
      now.getTime() + expirationBuffer >=
      this.connection.expiresAt.getTime()
    ) {
      return await this.refreshToken();
    }

    return this.connection.accessToken;
  }

  /**
   * Abstract refresh token method - must be implemented by subclasses
   */
  abstract refreshToken(): Promise<string>;

  /**
   * Make rate-limited HTTP request with retry logic
   */
  protected async makeRequest<T>(
    method: string,
    url: string,
    options?: RequestInit,
  ): Promise<T> {
    await this.rateLimiter.acquire();

    return this.circuitBreaker.execute<T>(async () => {
      let lastError: Error | null = null;

      for (let attempt: number = 0; attempt < this.maxRetries; attempt++) {
        try {
          const token: string = await this.ensureValidToken();
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...((options?.headers as Record<string, string>) || {}),
          };

          const controller: AbortController = new AbortController();
          const timeoutId: NodeJS.Timeout = setTimeout(
            () => controller.abort(),
            this.timeout,
          );

          const response: Response = await fetch(url, {
            ...options,
            method,
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const error: CRMError = new Error(
              `API Error: ${response.statusText}`,
            ) as CRMError;
            error.statusCode = response.status;
            error.retryable = response.status >= 500 || response.status === 429;
            error.provider = this.connection.provider;

            if (!error.retryable) {
              throw error;
            }

            if (attempt < this.maxRetries - 1) {
              const waitMs: number = Math.pow(2, attempt) * 1000;
              await new Promise((resolve: (value: void) => void) =>
                setTimeout(resolve, waitMs),
              );
              continue;
            }

            throw error;
          }

          return (await response.json()) as T;
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < this.maxRetries - 1) {
            const waitMs: number = Math.pow(2, attempt) * 1000;
            await new Promise((resolve: (value: void) => void) =>
              setTimeout(resolve, waitMs),
            );
          }
        }
      }

      throw lastError || new Error("Request failed after retries");
    });
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getInfo();
  }

  /**
   * Get field mapping engine
   */
  getFieldMappingEngine(): FieldMappingEngine {
    return this.fieldMappingEngine;
  }
}
