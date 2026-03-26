/**
 * Gateway Fixtures for Circuit Breaker, Retry, and Cache Tests
 * Provides factory functions for building test configs, mock requests/responses
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenProbeInterval: number;
  slidingWindowType: "count" | "time";
  slidingWindowSize: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  idempotencyKey?: string;
}

export interface CacheConfig {
  maxSize: number;
  ttlMs: number;
  staleWhileRevalidateMs: number;
}

export interface MockRequest {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: number;
}

export interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  latency: number;
  timestamp: number;
}

/**
 * Factory: Create default circuit breaker config
 */
export function createCircuitBreakerConfig(
  overrides?: Partial<CircuitBreakerConfig>
): CircuitBreakerConfig {
  return {
    name: "default-breaker",
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    halfOpenProbeInterval: 5000,
    slidingWindowType: "count",
    slidingWindowSize: 20,
    ...overrides,
  };
}

/**
 * Factory: Create per-provider circuit breaker configs
 */
export function createProviderCircuitBreakerConfigs() {
  return {
    stripe: createCircuitBreakerConfig({
      name: "stripe-breaker",
      failureThreshold: 3,
      successThreshold: 3,
    }),
    paypal: createCircuitBreakerConfig({
      name: "paypal-breaker",
      failureThreshold: 5,
      successThreshold: 2,
    }),
    square: createCircuitBreakerConfig({
      name: "square-breaker",
      failureThreshold: 4,
      successThreshold: 2,
    }),
  };
}

/**
 * Factory: Create default retry policy
 */
export function createRetryPolicy(
  overrides?: Partial<RetryPolicy>
): RetryPolicy {
  return {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    ...overrides,
  };
}

/**
 * Factory: Create idempotency-aware retry policy
 */
export function createIdempotentRetryPolicy(
  idempotencyKey: string
): RetryPolicy {
  return createRetryPolicy({
    idempotencyKey,
    maxAttempts: 5,
    initialDelayMs: 50,
  });
}

/**
 * Factory: Create cache config with LRU behavior
 */
export function createCacheConfig(
  overrides?: Partial<CacheConfig>
): CacheConfig {
  return {
    maxSize: 1000,
    ttlMs: 300000, // 5 minutes
    staleWhileRevalidateMs: 60000, // 1 minute
    ...overrides,
  };
}

/**
 * Factory: Create mock HTTP request
 */
export function createMockRequest(
  overrides?: Partial<MockRequest>
): MockRequest {
  const now = Date.now();
  return {
    id: `req-${now}`,
    method: "GET",
    path: "/api/v1/payments",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + "sk_live_" + "FAKEKEY123456",
      "X-Request-ID": `req-${now}`,
    },
    timestamp: now,
    ...overrides,
  };
}

/**
 * Factory: Create mock HTTP response
 */
export function createMockResponse(
  overrides?: Partial<MockResponse>
): MockResponse {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "X-RateLimit-Remaining": "9999",
    },
    body: { success: true, data: {} },
    latency: 150,
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Factory: Create circuit breaker state transition event
 */
export function createStateTransitionEvent(
  fromState: "closed" | "open" | "half-open",
  toState: "closed" | "open" | "half-open",
  reason: string
) {
  return {
    type: "state-transition",
    from: fromState,
    to: toState,
    reason,
    timestamp: Date.now(),
  };
}

/**
 * Factory: Create concurrent request batch
 */
export function createConcurrentRequestBatch(
  count: number,
  baseDelay: number = 0
): MockRequest[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRequest({
      id: `concurrent-${i}`,
      path: `/api/v1/batch/${i}`,
    })
  );
}

/**
 * Factory: Create sliding window metrics
 */
export function createSlidingWindowMetrics() {
  return {
    successCount: 0,
    failureCount: 0,
    slowCallCount: 0,
    totalCalls: 0,
    callTimestamps: [] as number[],
    failureTimestamps: [] as number[],
  };
}

/**
 * Factory: Create cache entry with TTL
 */
export function createCacheEntry(
  key: string,
  value: unknown,
  ttlMs: number = 300000
) {
  const now = Date.now();
  return {
    key,
    value,
    createdAt: now,
    expiresAt: now + ttlMs,
    hits: 0,
    lastAccessed: now,
  };
}

/**
 * Factory: Create request deduplication key
 */
export function createDeduplicationKey(
  method: string,
  path: string,
  body?: unknown
): string {
  const hash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  const combined = `${method}:${path}:${JSON.stringify(body || {})}`;
  return `dedup-${hash(combined)}`;
}
