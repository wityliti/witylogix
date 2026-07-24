/**
 * Rate Limit Enforcer — Per-provider sliding window rate limiter.
 *
 * Features:
 * - Per-provider sliding window rate limiting (configurable RPM)
 * - Request queuing when at limit (with max queue size)
 * - Rate limit headers on responses
 * - Burst allowance configuration
 * - In-memory store with Redis adapter interface
 * - Rate limit exceeded error with retry-after
 * - Analytics tracking per provider
 *
 * Rate limits are read from integration metadata (rateLimitRpm field).
 * Sliding window: requests are tracked in 60-second windows.
 */

import { EventEmitter } from "events";
import type { Logger } from "pino";

// ─── Types ──────────────────────────────────────────────────────────

/** Rate limit configuration per provider */
export interface RateLimitConfig {
  /** Provider slug (e.g., "stripe", "shopify") */
  provider: string;
  /** Maximum requests per minute */
  rateLimitRpm: number;
  /** Burst allowance (e.g., 10% extra capacity for short bursts) */
  burstAllowance: number;
  /** Maximum queue size when rate limited */
  maxQueueSize: number;
}

/** Window bucket for tracking request timestamps */
export interface WindowBucket {
  /** Array of request timestamps (milliseconds since epoch) */
  timestamps: number[];
  /** Queued requests waiting for capacity */
  queue: PendingRequest[];
}

/** Request pending in queue */
export interface PendingRequest {
  /** Unique request ID */
  id: string;
  /** Resolve when request can proceed */
  resolve: () => void;
  /** Reject if queue is full or timeout */
  reject: (error: Error) => void;
  /** Queue entry time */
  queuedAt: number;
  /** Request timeout in ms */
  timeout: number;
}

/** Rate limit response headers */
export interface RateLimitHeaders {
  "X-RateLimit-Limit": number;
  "X-RateLimit-Remaining": number;
  "X-RateLimit-Reset": number;
  "X-RateLimit-Retry-After"?: number;
}

/** Rate limit analytics event */
export interface RateLimitAnalytics {
  provider: string;
  timestamp: Date;
  requestCount: number;
  queueLength: number;
  rejected: number;
  retried: number;
}

/** Redis adapter interface for distributed rate limiting */
export interface RateLimitStore {
  /** Increment counter for provider in current window */
  incrementWindow(provider: string, window: number): Promise<number>;
  /** Get current window count */
  getWindowCount(provider: string, window: number): Promise<number>;
  /** Clean up old windows */
  cleanupWindows(provider: string, olderThan: number): Promise<void>;
  /** Set provider configuration */
  setConfig(provider: string, config: RateLimitConfig): Promise<void>;
  /** Get provider configuration */
  getConfig(provider: string): Promise<RateLimitConfig | null>;
}

/** In-memory rate limit store implementation */
export class InMemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, WindowBucket>();
  private configs = new Map<string, RateLimitConfig>();

  async incrementWindow(provider: string, window: number): Promise<number> {
    const key = `${provider}:${window}`;
    if (!this.buckets.has(key)) {
      this.buckets.set(key, { timestamps: [], queue: [] });
    }
    const bucket = this.buckets.get(key)!;
    bucket.timestamps.push(Date.now());
    return bucket.timestamps.length;
  }

  async getWindowCount(provider: string, window: number): Promise<number> {
    const key = `${provider}:${window}`;
    return this.buckets.get(key)?.timestamps.length ?? 0;
  }

  async cleanupWindows(provider: string, olderThan: number): Promise<void> {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(`${provider}:`)) {
        const bucket = this.buckets.get(key)!;
        bucket.timestamps = bucket.timestamps.filter((ts) => ts > olderThan);
        if (bucket.timestamps.length === 0 && bucket.queue.length === 0) {
          this.buckets.delete(key);
        }
      }
    }
  }

  async setConfig(provider: string, config: RateLimitConfig): Promise<void> {
    this.configs.set(provider, config);
  }

  async getConfig(provider: string): Promise<RateLimitConfig | null> {
    return this.configs.get(provider) ?? null;
  }

  getQueue(provider: string, window: number): PendingRequest[] {
    const key = `${provider}:${window}`;
    return this.buckets.get(key)?.queue ?? [];
  }

  setQueue(provider: string, window: number, queue: PendingRequest[]): void {
    const key = `${provider}:${window}`;
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.queue = queue;
    }
  }
}

/**
 * Rate Limit Enforcer — Sliding window rate limiter per provider.
 *
 * Enforces rate limits based on provider configuration. Tracks requests
 * in 60-second windows and queues excess requests.
 */
export class RateLimitEnforcer extends EventEmitter {
  private store: RateLimitStore;
  private configs = new Map<string, RateLimitConfig>();
  private activeRequests = new Map<string, number>();
  private analytics = new Map<string, RateLimitAnalytics>();
  private logger?: Logger;

  constructor(store?: RateLimitStore, logger?: Logger) {
    super();
    this.store = store ?? new InMemoryRateLimitStore();
    this.logger = logger;
  }

  /**
   * Register a provider's rate limit configuration.
   */
  async registerProvider(config: RateLimitConfig): Promise<void> {
    this.configs.set(config.provider, config);
    await this.store.setConfig(config.provider, config);
    this.logger?.debug(
      { provider: config.provider, config },
      "Provider registered",
    );
  }

  /**
   * Check and enforce rate limit for a request.
   * Returns rate limit headers and throws if over limit and queue is full.
   */
  async checkLimit(
    provider: string,
    requestId: string,
    timeout: number = 5000,
  ): Promise<RateLimitHeaders> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`Provider ${provider} not registered`);
    }

    const now = Date.now();
    const window = Math.floor(now / 60000); // 60-second window
    const windowStart = window * 60000;
    const windowEnd = windowStart + 60000;

    // Clean up old requests outside window
    await this.store.cleanupWindows(provider, windowStart);

    // Get current window count
    const currentCount = await this.store.getWindowCount(provider, window);
    const allowedCount = Math.ceil(
      config.rateLimitRpm * (1 + config.burstAllowance / 100),
    );

    const headers: RateLimitHeaders = {
      "X-RateLimit-Limit": config.rateLimitRpm,
      "X-RateLimit-Remaining": Math.max(0, allowedCount - currentCount),
      "X-RateLimit-Reset": Math.ceil(windowEnd / 1000),
    };

    if (currentCount >= allowedCount) {
      // Over limit - queue the request
      const queue = (this.store as InMemoryRateLimitStore).getQueue(
        provider,
        window,
      );

      if (queue.length >= config.maxQueueSize) {
        this.analytics.set(provider, {
          provider,
          timestamp: new Date(),
          requestCount: currentCount,
          queueLength: queue.length,
          rejected: (this.analytics.get(provider)?.rejected ?? 0) + 1,
          retried: this.analytics.get(provider)?.retried ?? 0,
        });

        const error = new Error(
          `Rate limit exceeded for ${provider}. Queue is full (max: ${config.maxQueueSize})`,
        );
        (error as any).code = "INTEGRATION_RATE_LIMITED";
        (error as any).retryAfter = headers["X-RateLimit-Reset"];
        throw error;
      }

      // Queue the request
      return new Promise((resolve, reject) => {
        const pending: PendingRequest = {
          id: requestId,
          resolve: () => resolve(headers),
          reject,
          queuedAt: now,
          timeout,
        };

        queue.push(pending);
        (this.store as InMemoryRateLimitStore).setQueue(
          provider,
          window,
          queue,
        );

        // Reject if timeout exceeded
        const timeoutHandle = setTimeout(() => {
          reject(
            new Error(`Request timeout in rate limit queue after ${timeout}ms`),
          );
        }, timeout);

        // Clean up timeout on resolution
        pending.resolve = () => {
          clearTimeout(timeoutHandle);
          resolve(headers);
        };
        pending.reject = (error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        };

        this.logger?.debug(
          { provider, requestId, queueLength: queue.length },
          "Request queued due to rate limit",
        );
        this.emit("queued", { provider, requestId, position: queue.length });
      });
    }

    // Under limit - increment and proceed
    await this.store.incrementWindow(provider, window);

    // Update active request count
    const count = (this.activeRequests.get(provider) ?? 0) + 1;
    this.activeRequests.set(provider, count);

    return headers;
  }

  /**
   * Record request completion and process queue.
   */
  async recordCompletion(provider: string, requestId: string): Promise<void> {
    const count = Math.max(0, (this.activeRequests.get(provider) ?? 1) - 1);
    this.activeRequests.set(provider, count);

    // Process queue
    const config = this.configs.get(provider);
    if (!config) return;

    const now = Date.now();
    const window = Math.floor(now / 60000);

    const queue = (this.store as InMemoryRateLimitStore).getQueue(
      provider,
      window,
    );
    if (queue.length > 0) {
      const pending = queue.shift();
      if (pending) {
        (this.store as InMemoryRateLimitStore).setQueue(
          provider,
          window,
          queue,
        );
        pending.resolve();
        this.logger?.debug(
          { provider, requestId: pending.id, queuePosition: queue.length },
          "Request dequeued and allowed to proceed",
        );
        this.emit("dequeued", {
          provider,
          requestId: pending.id,
          remaining: queue.length,
        });
      }
    }
  }

  /**
   * Get analytics for a provider.
   */
  getAnalytics(provider: string): RateLimitAnalytics | undefined {
    return this.analytics.get(provider);
  }

  /**
   * Reset analytics for a provider.
   */
  resetAnalytics(provider: string): void {
    this.analytics.delete(provider);
  }

  /**
   * Get current rate limit status for a provider.
   */
  async getStatus(provider: string): Promise<{
    provider: string;
    activeRequests: number;
    queueLength: number;
    config: RateLimitConfig | undefined;
  }> {
    const config = this.configs.get(provider);
    const active = this.activeRequests.get(provider) ?? 0;
    const now = Date.now();
    const window = Math.floor(now / 60000);
    const queue = (this.store as InMemoryRateLimitStore).getQueue(
      provider,
      window,
    );

    return {
      provider,
      activeRequests: active,
      queueLength: queue.length,
      config,
    };
  }
}

export type { Logger };
