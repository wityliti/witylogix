/**
 * Abstract Telematics Adapter Base Class
 * Defines the interface for telematics provider integrations
 */

import type {
  ITelematicsAdapter,
  TelematicsConfig,
  NormalizedVehicle,
  NormalizedPosition,
  NormalizedDiagnostic,
  NormalizedBehaviorEvent,
  NormalizedFuelReading,
  WebhookSubscription,
  RateLimitState,
  CircuitBreakerState,
  CircuitBreakerConfig,
} from "./types.js";

/**
 * Rate Limiter with sliding window
 */
export class RateLimiter {
  private requestTimes: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(requestsPerSecond: number) {
    this.maxRequests = requestsPerSecond;
    this.windowMs = 1000;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(
      (t) => t > now - this.windowMs,
    );

    if (this.requestTimes.length >= this.maxRequests) {
      const oldestTime = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestTime) + 1;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimes.push(now);
  }

  getState(): RateLimitState {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(
      (t) => t > now - this.windowMs,
    );
    const oldestTime = this.requestTimes[0];
    const resetAt = oldestTime
      ? new Date(oldestTime + this.windowMs)
      : new Date();
    return { requestCount: this.requestTimes.length, resetAt };
  }
}

/**
 * Circuit Breaker Pattern Implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Retry after ${this.getRetryAfterMs()}ms`,
        );
      }
    }

    try {
      const result = await fn();

      if (this.state === "HALF_OPEN") {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.state = "CLOSED";
          this.failureCount = 0;
          this.successCount = 0;
        }
      } else {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = new Date();

      if (this.failureCount >= this.config.failureThreshold) {
        this.state = "OPEN";
      }

      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.config.timeout;
  }

  private getRetryAfterMs(): number {
    if (!this.lastFailureTime) return 0;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.config.timeout - elapsed);
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }
}

/**
 * Simple In-Memory Cache
 */
export class SimpleCache<T> {
  private cache = new Map<string, { data: T; expiresAt: number }>();

  set(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

/**
 * Abstract Base Class for Telematics Adapters
 */
export abstract class TelematicsAdapter implements ITelematicsAdapter {
  protected config: TelematicsConfig;
  protected rateLimiter: RateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected cache: SimpleCache<unknown>;

  constructor(config: TelematicsConfig) {
    this.config = {
      timeout: 30000,
      rateLimit: 10,
      retries: 3,
      ...config,
    };

    this.rateLimiter = new RateLimiter(this.config.rateLimit!);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
    });
    this.cache = new SimpleCache();
  }

  abstract authenticate(): Promise<void>;
  abstract getVehicles(): Promise<NormalizedVehicle[]>;
  abstract getVehiclePosition(vehicleId: string): Promise<NormalizedPosition>;
  abstract getVehicleDiagnostics(
    vehicleId: string,
  ): Promise<NormalizedDiagnostic>;
  abstract getDriverBehaviorEvents(
    driverId: string,
    dateRange: { startDate: Date; endDate: Date },
  ): Promise<NormalizedBehaviorEvent[]>;
  abstract getFuelLevel(vehicleId: string): Promise<NormalizedFuelReading>;
  abstract subscribeToEvents(
    webhookUrl: string,
    eventTypes: string[],
  ): Promise<WebhookSubscription>;
  abstract unsubscribeFromEvents(webhookId: string): Promise<void>;

  abstract healthCheck(): Promise<boolean>;

  /**
   * Protected helper to retry failed requests with exponential backoff
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.config.retries!,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.rateLimiter.waitIfNeeded();
        return await this.circuitBreaker.execute(fn);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on non-retryable errors (e.g. 4xx except 429 rate limit)
        if (
          error instanceof Error &&
          "retryable" in error &&
          !(error as any).retryable
        ) {
          throw error;
        }

        // Exponential backoff: 100ms, 200ms, 400ms, etc.
        if (attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 100;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Protected helper to make HTTP requests
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout || 30000,
    );

    try {
      // INTEGRATION: Replace with actual fetch in production
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get rate limit state
   */
  getRateLimitState(): ReturnType<RateLimiter["getState"]> {
    return this.rateLimiter.getState();
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}

/**
 * Telematics Adapter Factory
 */
export function createTelematicsAdapter(
  config: TelematicsConfig,
): TelematicsAdapter {
  const { SamsaraClient } = require("./samsara-client.js");
  const { GeotabClient } = require("./geotab-client.js");

  switch (config.provider) {
    case "samsara":
      return new SamsaraClient(config);
    case "geotab":
      return new GeotabClient(config);
    default:
      throw new Error(`Unknown telematics provider: ${config.provider}`);
  }
}
