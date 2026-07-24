/**
 * Integration Gateway Tests — HTTP client, rate limiting, circuit breaker, retries
 *
 * Tests cover:
 * - Provider registration and configuration
 * - Rate limiting with sliding window
 * - Circuit breaker (CLOSED, OPEN, HALF_OPEN)
 * - Retry with exponential backoff
 * - Interceptors (request, response, error)
 * - Correlation ID injection
 * - Metrics collection
 * - HTTP methods (GET, POST, PUT, PATCH, DELETE)
 *
 * Run with: npm test -- integration-gateway.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  IntegrationGateway,
  type IHttpClient,
  type HttpResponse,
  type HttpRequestOptions,
  type IMetricsCollector,
  type ProviderGatewayConfig,
} from "../integration-gateway.js";

// ─── Mock Implementations ────────────────────────────────────────

class MockHttpClient implements IHttpClient {
  requestCount = 0;
  failUntilAttempt = -1;

  async request<T>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
    this.requestCount++;

    // Simulate failures for retry testing
    if (this.requestCount <= this.failUntilAttempt) {
      const error: any = new Error("Network error");
      error.statusCode = 503;
      throw error;
    }

    return {
      status: 200,
      headers: {},
      data: { message: "ok" } as T,
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.failUntilAttempt = -1;
  }
}

class MockMetricsCollector implements IMetricsCollector {
  metrics: Array<{
    providerId: string;
    method: string;
    status: number;
    durationMs: number;
    error?: string;
  }> = [];

  async recordRequest(
    providerId: string,
    method: string,
    status: number,
    durationMs: number,
    error?: string,
  ): Promise<void> {
    this.metrics.push({
      providerId,
      method,
      status,
      durationMs,
      error,
    });
  }

  reset(): void {
    this.metrics = [];
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("IntegrationGateway", () => {
  let gateway: IntegrationGateway;
  let httpClient: MockHttpClient;
  let metricsCollector: MockMetricsCollector;

  beforeEach(() => {
    httpClient = new MockHttpClient();
    metricsCollector = new MockMetricsCollector();

    gateway = new IntegrationGateway({
      httpClient,
      metricsCollector,
    });

    // Register a test provider
    gateway.registerProvider({
      providerId: "test-provider",
      baseUrl: "https://api.example.com",
      timeoutMs: 5000,
      rateLimit: {
        requestsPerWindow: 10,
        windowSec: 60,
      },
      retry: {
        maxRetries: 3,
        initialBackoffMs: 100,
        maxBackoffMs: 1000,
        multiplier: 2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        successThreshold: 2,
      },
    });
  });

  // ─── PROVIDER REGISTRATION TESTS ────────────────────────────────

  describe("registerProvider", () => {
    it("should register a provider", () => {
      expect(() => {
        gateway.registerProvider({
          providerId: "another-provider",
          baseUrl: "https://api.another.com",
        });
      }).not.toThrow();
    });
  });

  // ─── HTTP METHOD TESTS ──────────────────────────────────────────

  describe("HTTP methods", () => {
    it("should make GET request", async () => {
      const result = await gateway.get("test-provider", "/users/123");

      expect(result).toEqual({ message: "ok" });
      expect(httpClient.requestCount).toBe(1);
    });

    it("should make POST request", async () => {
      const result = await gateway.post("test-provider", "/users", {
        name: "John",
      });

      expect(result).toEqual({ message: "ok" });
      expect(httpClient.requestCount).toBe(1);
    });

    it("should make PUT request", async () => {
      const result = await gateway.put("test-provider", "/users/123", {
        name: "Jane",
      });

      expect(result).toEqual({ message: "ok" });
    });

    it("should make PATCH request", async () => {
      const result = await gateway.patch("test-provider", "/users/123", {
        status: "active",
      });

      expect(result).toEqual({ message: "ok" });
    });

    it("should make DELETE request", async () => {
      const result = await gateway.delete("test-provider", "/users/123");

      expect(result).toEqual({ message: "ok" });
    });
  });

  // ─── RATE LIMITING TESTS ────────────────────────────────────────

  describe("Rate limiting", () => {
    it("should get rate limit status", async () => {
      const status = gateway.getRateLimitStatus("test-provider");

      expect(status).toBeDefined();
      expect(status?.remaining).toBe(10);
      expect(status?.resetAt).toBeInstanceOf(Date);
    });

    it("should decrement remaining requests", async () => {
      let status = gateway.getRateLimitStatus("test-provider");
      expect(status?.remaining).toBe(10);

      await gateway.get("test-provider", "/test");

      status = gateway.getRateLimitStatus("test-provider");
      expect(status?.remaining).toBe(9);
    });

    it("should reject requests when rate limit exceeded", async () => {
      // Register provider with very low limit
      gateway.registerProvider({
        providerId: "limited-provider",
        baseUrl: "https://api.example.com",
        rateLimit: {
          requestsPerWindow: 1,
          windowSec: 60,
        },
      });

      await gateway.get("limited-provider", "/test");

      // Next request should be rejected
      await expect(gateway.get("limited-provider", "/test")).rejects.toThrow(
        /Rate limit exceeded/,
      );
    });
  });

  // ─── CIRCUIT BREAKER TESTS ──────────────────────────────────────

  describe("Circuit breaker", () => {
    it("should start in CLOSED state", () => {
      const state = gateway.getCircuitBreakerStatus("test-provider");
      expect(state).toBe("CLOSED");
    });

    it("should transition to OPEN after failure threshold", async () => {
      httpClient.failUntilAttempt = 100; // Always fail

      // Trigger 5 failures to exceed threshold of 5
      for (let i = 0; i < 5; i++) {
        try {
          await gateway.get("test-provider", `/test${i}`);
        } catch {
          // Expected to fail
        }
      }

      const state = gateway.getCircuitBreakerStatus("test-provider");
      expect(state).toBe("OPEN");
    });

    it("should reject requests when circuit is OPEN", async () => {
      httpClient.failUntilAttempt = 100; // Always fail

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await gateway.get("test-provider", `/test${i}`);
        } catch {
          // Expected
        }
      }

      // Next request should be rejected immediately
      await expect(gateway.get("test-provider", "/test")).rejects.toThrow(
        /Circuit breaker OPEN/,
      );
    });

    it("should transition to HALF_OPEN after reset timeout", async () => {
      httpClient.failUntilAttempt = 100;

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await gateway.get("test-provider", `/test${i}`);
        } catch {
          // Expected
        }
      }

      expect(gateway.getCircuitBreakerStatus("test-provider")).toBe("OPEN");

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      httpClient.failUntilAttempt = -1; // Stop failing
      httpClient.reset();

      // Next request should attempt (HALF_OPEN state)
      const result = await gateway.get("test-provider", "/test");
      expect(result).toEqual({ message: "ok" });

      // With successThreshold: 2, need more successes to fully close
      const result2 = await gateway.get("test-provider", "/test2");
      expect(result2).toEqual({ message: "ok" });

      // Should be back to CLOSED after enough successes
      expect(gateway.getCircuitBreakerStatus("test-provider")).toBe("CLOSED");
    });
  });

  // ─── RETRY TESTS ────────────────────────────────────────────────

  describe("Retry with exponential backoff", () => {
    it("should retry on transient failures", async () => {
      httpClient.failUntilAttempt = 2; // Fail first 2 attempts

      const result = await gateway.get("test-provider", "/test");

      expect(result).toEqual({ message: "ok" });
      expect(httpClient.requestCount).toBe(3); // Initial + 2 retries
    });

    it("should eventually fail after max retries", async () => {
      httpClient.failUntilAttempt = 100; // Always fail

      await expect(gateway.get("test-provider", "/test")).rejects.toThrow();
      expect(httpClient.requestCount).toBe(4); // Initial + 3 retries
    });
  });

  // ─── INTERCEPTOR TESTS ──────────────────────────────────────────

  describe("Interceptors", () => {
    it("should run request interceptors", async () => {
      const mockInterceptor = {
        onRequest: vi.fn(async (options) => {
          options.headers = options.headers || {};
          options.headers["X-Custom"] = "test-value";
          return options;
        }),
      };

      const gatewayWithInterceptor = new IntegrationGateway({
        httpClient,
        interceptors: [mockInterceptor],
      });

      gatewayWithInterceptor.registerProvider({
        providerId: "test-provider",
        baseUrl: "https://api.example.com",
      });

      await gatewayWithInterceptor.get("test-provider", "/test");

      expect(mockInterceptor.onRequest).toHaveBeenCalled();
    });

    it("should run error interceptors", async () => {
      const mockInterceptor = {
        onError: vi.fn(async () => {
          // Error handling
        }),
      };

      const gatewayWithInterceptor = new IntegrationGateway({
        httpClient,
        interceptors: [mockInterceptor],
      });

      gatewayWithInterceptor.registerProvider({
        providerId: "failing-provider",
        baseUrl: "https://api.example.com",
        retry: {
          maxRetries: 0,
          initialBackoffMs: 100,
          maxBackoffMs: 1000,
          multiplier: 2,
          retryableStatusCodes: [],
        },
      });

      httpClient.failUntilAttempt = 100; // Always fail

      try {
        await gatewayWithInterceptor.get("failing-provider", "/test");
      } catch {
        // Expected
      }

      expect(mockInterceptor.onError).toHaveBeenCalled();
    });
  });

  // ─── METRICS TESTS ──────────────────────────────────────────────

  describe("Metrics collection", () => {
    it("should record successful requests", async () => {
      await gateway.get("test-provider", "/test");

      expect(metricsCollector.metrics).toHaveLength(1);
      const metric = metricsCollector.metrics[0];
      expect(metric.providerId).toBe("test-provider");
      expect(metric.method).toBe("GET");
      expect(metric.status).toBe(200);
      expect(metric.error).toBeUndefined();
    });

    it("should record request duration", async () => {
      const startTime = Date.now();
      await gateway.get("test-provider", "/test");
      const endTime = Date.now();

      const metric = metricsCollector.metrics[0];
      expect(metric.durationMs).toBeGreaterThanOrEqual(0);
      expect(metric.durationMs).toBeLessThanOrEqual(endTime - startTime + 100);
    });

    it("should record failed requests", async () => {
      httpClient.failUntilAttempt = 100;

      try {
        await gateway.get("test-provider", "/test");
      } catch {
        // Expected
      }

      const failedMetrics = metricsCollector.metrics.filter((m) => m.error);
      expect(failedMetrics.length).toBeGreaterThan(0);
    });
  });

  // ─── CORRELATION ID TESTS ───────────────────────────────────────

  describe("Correlation IDs", () => {
    it("should inject correlation ID header", async () => {
      const capturedOptions: HttpRequestOptions[] = [];
      const captureClient: IHttpClient = {
        async request<T>(
          options: HttpRequestOptions,
        ): Promise<HttpResponse<T>> {
          capturedOptions.push(options);
          return {
            status: 200,
            headers: {},
            data: { message: "ok" } as T,
          };
        },
      };

      const gatewayWithCapture = new IntegrationGateway({
        httpClient: captureClient,
      });

      gatewayWithCapture.registerProvider({
        providerId: "test-provider",
        baseUrl: "https://api.example.com",
      });

      await gatewayWithCapture.get("test-provider", "/test");

      expect(capturedOptions[0].headers?.["X-Request-ID"]).toMatch(/^req_\d+_/);
    });
  });

  // ─── ERROR HANDLING TESTS ────────────────────────────────────────

  describe("Error handling", () => {
    it("should throw error for unregistered provider", async () => {
      await expect(gateway.get("unknown-provider", "/test")).rejects.toThrow(
        /Provider "unknown-provider" not registered/,
      );
    });
  });
});
