/**
 * Abstract E-Commerce Adapter Base Class
 * Provides common functionality for all e-commerce platform adapters:
 * rate limiting, circuit breaker, retry logic, request logging, and webhook verification
 */

import { createHmac } from "node:crypto";
import type {
  IECommerceAdapter,
  ECommerceAdapterConfig,
  RateLimiterConfig,
  CircuitBreakerConfig,
  RetryConfig,
  RequestLog,
} from "./types.js";

/**
 * Rate Limiter with sliding window
 */
export class RateLimiter {
  private requestTimes: number[] = [];
  private maxRequests: number;
  private windowMs: number;
  private maxBurst: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.requestsPerSecond;
    this.windowMs = config.windowMs || 1000;
    this.maxBurst = config.maxBurst || config.requestsPerSecond * 2;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter((t) => t > now - this.windowMs);

    if (this.requestTimes.length >= this.maxBurst) {
      const oldestTime = this.requestTimes[0];
      const waitTime = this.windowMs - (now - oldestTime) + 1;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requestTimes.push(now);
  }

  reset(): void {
    this.requestTimes = [];
  }
}

/**
 * Circuit Breaker pattern implementation
 */
export class CircuitBreaker {
  private failureCount = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private lastFailureTime = 0;
  private failureThreshold: number;
  private resetTimeoutMs: number;

  constructor(config: CircuitBreakerConfig) {
    this.failureThreshold = config.failureThreshold;
    this.resetTimeoutMs = config.resetTimeoutMs;
  }

  async execute<T>(
    fn: () => Promise<T>,
  ): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  getState(): "closed" | "open" | "half-open" {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.state = "closed";
    this.lastFailureTime = 0;
  }
}

/**
 * Retry handler with exponential backoff
 */
export class RetryHandler {
  private maxRetries: number;
  private initialDelayMs: number;
  private maxDelayMs: number;
  private backoffMultiplier: number;
  private retryableStatuses: number[];

  constructor(config: RetryConfig) {
    this.maxRetries = config.maxRetries;
    this.initialDelayMs = config.initialDelayMs;
    this.maxDelayMs = config.maxDelayMs;
    this.backoffMultiplier = config.backoffMultiplier;
    this.retryableStatuses = config.retryableStatuses;
  }

  async execute<T>(
    fn: () => Promise<T>,
    context?: string,
  ): Promise<T> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryable(error) || attempt === this.maxRetries) {
          throw error;
        }

        const delayMs = this.calculateBackoff(attempt);
        console.warn(
          `[Retry] Attempt ${attempt + 1}/${this.maxRetries} failed for ${context}, waiting ${delayMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Error && "statusCode" in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      return this.retryableStatuses.includes(statusCode);
    }
    return true; // Retry network errors by default
  }

  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt);
    return Math.min(exponentialDelay, this.maxDelayMs);
  }
}

/**
 * Abstract E-Commerce Adapter Base Class
 */
export abstract class ECommerceAdapterBase implements IECommerceAdapter {
  protected config: ECommerceAdapterConfig;
  protected rateLimiter: RateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected retryHandler: RetryHandler;
  protected requestLogs: RequestLog[] = [];
  protected maxLogs = 1000;

  constructor(config: ECommerceAdapterConfig) {
    this.config = config;

    this.rateLimiter = new RateLimiter({
      requestsPerSecond: config.rateLimit || 10,
      windowMs: 1000,
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      monitoringIntervalMs: 5000,
    });

    this.retryHandler = new RetryHandler({
      maxRetries: config.retries || 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    });
  }

  /**
   * Verify webhook signature - must be implemented by subclasses
   */
  abstract verifyWebhookSignature(payload: unknown, signature: string): boolean;

  /**
   * Parse webhook event - must be implemented by subclasses
   */
  abstract parseWebhookEvent(payload: unknown): Promise<any>;

  /**
   * Health check - must be implemented by subclasses
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Validate connection - must be implemented by subclasses
   */
  abstract validateConnection(): Promise<boolean>;

  // Stub implementations for abstract methods from IECommerceAdapter
  // Subclasses will override these with actual implementations
  async getOrders() {
    throw new Error("Not implemented");
  }

  async getOrderById() {
    throw new Error("Not implemented");
  }

  async updateOrder() {
    throw new Error("Not implemented");
  }

  async getProducts() {
    throw new Error("Not implemented");
  }

  async getProductById() {
    throw new Error("Not implemented");
  }

  async createProduct() {
    throw new Error("Not implemented");
  }

  async updateProduct() {
    throw new Error("Not implemented");
  }

  async getCustomers() {
    throw new Error("Not implemented");
  }

  async getCustomerById() {
    throw new Error("Not implemented");
  }

  async updateCustomer() {
    throw new Error("Not implemented");
  }

  async createFulfillment() {
    throw new Error("Not implemented");
  }

  async updateFulfillment() {
    throw new Error("Not implemented");
  }

  async updateInventory() {
    throw new Error("Not implemented");
  }

  async getInventory() {
    throw new Error("Not implemented");
  }

  /**
   * Make HTTP request with rate limiting, circuit breaker, and retry logic
   */
  protected async makeRequest<T>(
    method: string,
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
      timeout?: number;
      context?: string;
    } = {},
  ): Promise<T> {
    const startTime = Date.now();
    const context = options.context || `${method} ${url}`;

    try {
      await this.rateLimiter.waitIfNeeded();

      const result = await this.circuitBreaker.execute(async () => {
        return this.retryHandler.execute(async () => {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "Witylogix/1.0",
            ...options.headers,
          };

          const fetchOptions: RequestInit = {
            method,
            headers,
            timeout: options.timeout || 30000,
          };

          if (options.body && (method === "POST" || method === "PUT" || method === "PATCH")) {
            fetchOptions.body = JSON.stringify(options.body);
          }

          const response = await fetch(url, fetchOptions);

          if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as unknown;
            const error = new Error(
              `HTTP ${response.status}: ${JSON.stringify(errorData)}`,
            ) as Error & { statusCode: number };
            (error as any).statusCode = response.status;
            throw error;
          }

          return (await response.json()) as T;
        }, context);
      });

      this.logRequest({
        timestamp: new Date(),
        method,
        endpoint: url,
        statusCode: 200,
        duration: Date.now() - startTime,
        cached: false,
      });

      return result;
    } catch (error) {
      this.logRequest({
        timestamp: new Date(),
        method,
        endpoint: url,
        statusCode: 500,
        duration: Date.now() - startTime,
        cached: false,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Generate HMAC-SHA256 signature for webhook verification
   */
  protected generateSignature(payload: string, secret: string): string {
    return createHmac("sha256", secret)
      .update(payload)
      .digest("base64");
  }

  /**
   * Verify HMAC-SHA256 signature
   */
  protected verifySignature(
    payload: string,
    providedSignature: string,
    secret: string,
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return expectedSignature === providedSignature;
  }

  /**
   * Log request for debugging and monitoring
   */
  protected logRequest(log: RequestLog): void {
    this.requestLogs.push(log);

    // Keep only recent logs
    if (this.requestLogs.length > this.maxLogs) {
      this.requestLogs = this.requestLogs.slice(-this.maxLogs);
    }

    // Log to console in development
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[${log.statusCode}] ${log.method} ${log.endpoint} (${log.duration}ms)`);
    }
  }

  /**
   * Get recent request logs
   */
  getRequestLogs(limit = 100): RequestLog[] {
    return this.requestLogs.slice(-limit);
  }

  /**
   * Clear request logs
   */
  clearRequestLogs(): void {
    this.requestLogs = [];
  }

  /**
   * Get health metrics
   */
  getMetrics() {
    return {
      circuitBreakerState: this.circuitBreaker.getState(),
      recentRequests: this.requestLogs.slice(-10),
      totalRequests: this.requestLogs.length,
      failureRate: this.calculateFailureRate(),
    };
  }

  private calculateFailureRate(): number {
    if (this.requestLogs.length === 0) return 0;

    const failures = this.requestLogs.filter((log) => log.statusCode >= 400).length;
    return failures / this.requestLogs.length;
  }

  /**
   * Reset adapter state (used in tests)
   */
  reset(): void {
    this.rateLimiter.reset();
    this.circuitBreaker.reset();
    this.clearRequestLogs();
  }
}
