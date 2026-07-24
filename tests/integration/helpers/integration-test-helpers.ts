/**
 * Integration Test Helpers
 * Utility functions for integration testing across all adapter suites
 * Includes mocking, assertions, and async helpers
 * ~400 lines total
 */

import type { Mock } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface MockHTTPClientConfig {
  defaultStatus?: number;
  defaultHeaders?: Record<string, string>;
  responses?: Array<{
    url?: string | RegExp;
    status?: number;
    data?: Record<string, unknown>;
    error?: Error;
  }>;
  delay?: number;
}

export interface RateLimiterState {
  remaining: number;
  reset: number;
  limit: number;
}

export interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failures: number;
  threshold: number;
  lastFailureTime?: number;
  successCount?: number;
}

export interface ProviderHealthCheck {
  provider: string;
  healthy: boolean;
  latency: number;
  timestamp: number;
  lastError?: string;
}

export interface SyncResult {
  provider: string;
  recordsSync: number;
  duration: number;
  conflicts: Array<{
    id: string;
    reason: string;
  }>;
  errors: Array<{
    record: string;
    error: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK HTTP CLIENT FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createMockHTTPClient(config: MockHTTPClientConfig = {}) {
  const {
    defaultStatus = 200,
    defaultHeaders = { "content-type": "application/json" },
    responses = [],
    delay = 0,
  } = config;

  let responseIndex = 0;

  const mockFetch = async (
    url: string | URL,
    options?: RequestInit,
  ): Promise<Response> => {
    // Simulate network delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const urlString = url.toString();
    const response = responses[responseIndex];

    // Match URL pattern if specified
    if (response) {
      let matches = false;
      if (response.url instanceof RegExp) {
        matches = response.url.test(urlString);
      } else if (response.url) {
        matches = urlString.includes(response.url);
      } else {
        matches = true; // Match any URL if not specified
      }

      if (matches) {
        responseIndex++;

        if (response.error) {
          throw response.error;
        }

        const status = response.status ?? defaultStatus;
        const body =
          typeof response.data === "string"
            ? response.data
            : JSON.stringify(response.data);

        return new Response(body, {
          status,
          headers: defaultHeaders,
        });
      }
    }

    // Default response
    return new Response(JSON.stringify({}), {
      status: defaultStatus,
      headers: defaultHeaders,
    });
  };

  return {
    fetch: mockFetch,
    reset: () => {
      responseIndex = 0;
    },
    getCallCount: () => responseIndex,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────

export function createMockRateLimiter(
  limit: number = 100,
  windowMs: number = 60000,
) {
  let state: RateLimiterState = {
    remaining: limit,
    reset: Date.now() + windowMs,
    limit,
  };

  return {
    check: async (key: string): Promise<RateLimiterState> => {
      const now = Date.now();

      // Reset window if expired
      if (now > state.reset) {
        state = {
          remaining: limit,
          reset: now + windowMs,
          limit,
        };
      }

      if (state.remaining > 0) {
        state.remaining--;
        return { ...state };
      }

      // Rate limit exceeded
      const error = new Error("Rate limit exceeded");
      (error as any).status = 429;
      (error as any).retryAfter = Math.ceil((state.reset - now) / 1000);
      throw error;
    },

    getState: () => ({ ...state }),

    reset: () => {
      state = {
        remaining: limit,
        reset: Date.now() + windowMs,
        limit,
      };
    },

    simulate: (decrements: number) => {
      state.remaining = Math.max(0, state.remaining - decrements);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK CIRCUIT BREAKER
// ─────────────────────────────────────────────────────────────────────────────

export function createMockCircuitBreaker(
  failureThreshold: number = 5,
  resetTimeoutMs: number = 60000,
) {
  let state: CircuitBreakerState = {
    state: "closed",
    failures: 0,
    threshold: failureThreshold,
    lastFailureTime: undefined,
    successCount: 0,
  };

  return {
    execute: async <T>(fn: () => Promise<T>): Promise<T> => {
      if (state.state === "open") {
        const now = Date.now();
        if (now - (state.lastFailureTime || 0) > resetTimeoutMs) {
          state.state = "half-open";
          state.successCount = 0;
        } else {
          const error = new Error("Circuit breaker is open");
          (error as any).status = 503;
          throw error;
        }
      }

      try {
        const result = await fn();

        if (state.state === "half-open") {
          state.successCount = (state.successCount || 0) + 1;
          if (state.successCount === 2) {
            state.state = "closed";
            state.failures = 0;
            state.successCount = 0;
          }
        }

        return result;
      } catch (error) {
        state.failures++;
        state.lastFailureTime = Date.now();

        if (state.failures >= failureThreshold) {
          state.state = "open";
        } else if (state.state === "half-open") {
          state.state = "open";
        }

        throw error;
      }
    },

    getState: () => ({ ...state }),

    reset: () => {
      state = {
        state: "closed",
        failures: 0,
        threshold: failureThreshold,
        lastFailureTime: undefined,
        successCount: 0,
      };
    },

    trip: () => {
      state.state = "open";
      state.failures = failureThreshold;
      state.lastFailureTime = Date.now();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER HEALTH ASSERTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function assertProviderHealth(
  provider: string,
  healthCheckFn: () => Promise<boolean>,
  maxLatency: number = 5000,
): Promise<ProviderHealthCheck> {
  const startTime = Date.now();

  try {
    const healthy = await healthCheckFn();
    const latency = Date.now() - startTime;

    return {
      provider,
      healthy: healthy && latency < maxLatency,
      latency,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      provider,
      healthy: false,
      latency: Date.now() - startTime,
      timestamp: Date.now(),
      lastError: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNC RESULT ASSERTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function assertSyncResult(
  result: SyncResult,
  options: {
    minRecords?: number;
    maxErrors?: number;
    maxConflicts?: number;
  } = {},
): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (
    options.minRecords !== undefined &&
    result.recordsSync < options.minRecords
  ) {
    violations.push(
      `Expected at least ${options.minRecords} records synced, got ${result.recordsSync}`,
    );
  }

  if (
    options.maxErrors !== undefined &&
    result.errors.length > options.maxErrors
  ) {
    violations.push(
      `Expected at most ${options.maxErrors} errors, got ${result.errors.length}`,
    );
  }

  if (
    options.maxConflicts !== undefined &&
    result.conflicts.length > options.maxConflicts
  ) {
    violations.push(
      `Expected at most ${options.maxConflicts} conflicts, got ${result.conflicts.length}`,
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER WAIT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function waitForCircuitBreakerReset(
  cb: { getState: () => CircuitBreakerState },
  timeoutMs: number = 5000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const state = cb.getState();
    if (state.state === "closed") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Circuit breaker did not reset within timeout");
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

export async function simulateRateLimitExhaustion(
  rateLimiter: ReturnType<typeof createMockRateLimiter>,
  expectedError?: string,
): Promise<void> {
  const state = rateLimiter.getState();
  // Simulate consuming all available requests
  rateLimiter.simulate(state.remaining);

  // Next request should fail
  try {
    await rateLimiter.check("test-key");
    throw new Error("Expected rate limit error but none was thrown");
  } catch (error) {
    if (expectedError && !error?.toString().includes(expectedError)) {
      throw new Error(
        `Expected error containing "${expectedError}", got: ${error}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OAUTH TOKEN LIFECYCLE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
}

export function createMockOAuthToken(expiresIn: number = 3600): OAuthToken {
  const now = Date.now();
  return {
    accessToken: `access_${Math.random().toString(36).slice(2)}`,
    refreshToken: `refresh_${Math.random().toString(36).slice(2)}`,
    expiresIn,
    expiresAt: now + expiresIn * 1000,
  };
}

export function isMockOAuthTokenExpired(token: OAuthToken): boolean {
  return Date.now() > token.expiresAt - 60000; // 1 minute buffer
}

export async function simulateOAuthTokenRefresh(
  getToken: () => OAuthToken,
  refreshFn: (refreshToken: string) => Promise<OAuthToken>,
): Promise<OAuthToken> {
  const currentToken = getToken();

  if (isMockOAuthTokenExpired(currentToken)) {
    const newToken = await refreshFn(currentToken.refreshToken);
    return newToken;
  }

  return currentToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY ASSERTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryMetrics {
  attempts: number;
  lastError?: string;
  successOnAttempt?: number;
  totalDuration: number;
}

export async function assertRetryBehavior<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    backoffMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {},
): Promise<RetryMetrics> {
  const {
    maxAttempts = 3,
    backoffMs = 100,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  const startTime = Date.now();
  let lastError: Error | undefined;
  let delayMs = backoffMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return {
        attempts: attempt,
        successOnAttempt: attempt,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts && shouldRetry(lastError)) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= backoffMultiplier;
      } else if (attempt === maxAttempts) {
        return {
          attempts: maxAttempts,
          lastError: lastError.message,
          totalDuration: Date.now() - startTime,
        };
      }
    }
  }

  return {
    attempts: maxAttempts,
    lastError: lastError?.message,
    totalDuration: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK DELIVERY ASSERTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface WebhookDeliveryAssert {
  webhookId: string;
  delivered: boolean;
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
}

export async function assertWebhookDelivery(
  webhookId: string,
  checkDeliveryFn: (id: string) => Promise<boolean>,
  maxAttempts: number = 5,
): Promise<WebhookDeliveryAssert> {
  let attempts = 0;
  const startTime = Date.now();

  for (let i = 0; i < maxAttempts; i++) {
    attempts++;
    const delivered = await checkDeliveryFn(webhookId);

    if (delivered) {
      return {
        webhookId,
        delivered: true,
        attempts,
        lastAttempt: new Date(),
      };
    }

    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const nextRetryDelay = 60000; // 1 minute
  return {
    webhookId,
    delivered: false,
    attempts: maxAttempts,
    lastAttempt: new Date(),
    nextRetry: new Date(Date.now() + nextRetryDelay),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK FETCH RESPONSE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export function createMockFetchResponse(
  data: Record<string, unknown>,
  options: {
    status?: number;
    headers?: Record<string, string>;
    delay?: number;
  } = {},
): Response {
  const {
    status = 200,
    headers = { "content-type": "application/json" },
    delay = 0,
  } = options;

  const responseInit: ResponseInit = {
    status,
    headers: new Headers(headers),
  };

  const body = JSON.stringify(data);

  if (delay > 0) {
    // This is a simplified mock; real implementations would need async handling
    return new Response(body, responseInit);
  }

  return new Response(body, responseInit);
}

export function createMockErrorResponse(
  error: string,
  statusCode: number = 500,
  details?: Record<string, unknown>,
): Response {
  return createMockFetchResponse(
    {
      error,
      ...details,
    },
    { status: statusCode },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function createPaginatedResponse<T>(
  items: T[],
  page: number = 1,
  pageSize: number = 20,
): {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
} {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedItems = items.slice(start, end);

  return {
    data: paginatedItems,
    pagination: {
      total: items.length,
      page,
      pageSize,
      hasMore: end < items.length,
    },
  };
}
