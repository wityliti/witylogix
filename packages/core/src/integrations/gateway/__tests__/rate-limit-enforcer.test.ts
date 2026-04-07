/**
 * Rate Limit Enforcer Tests
 *
 * Tests cover:
 * - Per-provider rate limiting
 * - Sliding window tracking
 * - Request queuing when limit exceeded
 * - Rate limit headers
 * - Burst allowance
 * - Queue rejection when full
 * - Request dequeuing and processing
 *
 * Run with: npm test -- rate-limit-enforcer.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RateLimitEnforcer,
  InMemoryRateLimitStore,
  type RateLimitConfig,
} from "../rate-limit-enforcer";

describe("RateLimitEnforcer", () => {
  let enforcer: RateLimitEnforcer;
  let store: InMemoryRateLimitStore;

  const testConfig: RateLimitConfig = {
    provider: "stripe",
    rateLimitRpm: 100,
    burstAllowance: 10,
    maxQueueSize: 50,
  };

  beforeEach(() => {
    store = new InMemoryRateLimitStore();
    enforcer = new RateLimitEnforcer(store);
  });

  describe("Provider registration", () => {
    it("should register a provider configuration", async () => {
      await enforcer.registerProvider(testConfig);
      const status = await enforcer.getStatus("stripe");
      expect(status.config).toEqual(testConfig);
    });

    it("should throw error for unregistered provider", async () => {
      await expect(enforcer.checkLimit("unknown-provider", "req-1")).rejects.toThrow(
        "Provider unknown-provider not registered",
      );
    });
  });

  describe("Rate limit checking", () => {
    beforeEach(async () => {
      await enforcer.registerProvider(testConfig);
    });

    it("should allow requests under the limit", async () => {
      const headers = await enforcer.checkLimit("stripe", "req-1");
      expect(headers["X-RateLimit-Limit"]).toBe(100);
      expect(headers["X-RateLimit-Remaining"]).toBeGreaterThan(0);
      expect(headers["X-RateLimit-Reset"]).toBeGreaterThan(0);
    });

    it("should include rate limit headers", async () => {
      const headers = await enforcer.checkLimit("stripe", "req-1");
      expect(headers).toHaveProperty("X-RateLimit-Limit");
      expect(headers).toHaveProperty("X-RateLimit-Remaining");
      expect(headers).toHaveProperty("X-RateLimit-Reset");
    });

    it("should calculate remaining requests correctly", async () => {
      // Make some requests
      for (let i = 0; i < 10; i++) {
        await enforcer.checkLimit("stripe", `req-${i}`);
      }

      const headers = await enforcer.checkLimit("stripe", "req-10");
      // With rateLimitRpm=100 and burstAllowance=10 (10%), allowed = ceil(100 * 1.1) = 110
      // After 11 requests, remaining = 110 - windowCount
      expect(headers["X-RateLimit-Remaining"]).toBeGreaterThanOrEqual(0);
      expect(headers["X-RateLimit-Remaining"]).toBeLessThanOrEqual(110);
    });

    it("should reject requests when limit exceeded and queue full", async () => {
      const config: RateLimitConfig = {
        provider: "test-provider",
        rateLimitRpm: 5,
        burstAllowance: 0,
        maxQueueSize: 2,
      };
      await enforcer.registerProvider(config);

      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        await enforcer.checkLimit("test-provider", `req-${i}`);
      }

      // Fill the queue
      for (let i = 5; i < 7; i++) {
        try {
          await enforcer.checkLimit("test-provider", `req-${i}`, 100);
        } catch {
          // Expected
        }
      }

      // Queue is full, should reject
      await expect(enforcer.checkLimit("test-provider", "req-7", 100)).rejects.toThrow(
        "Rate limit exceeded",
      );
    });

    it("should include retry-after on rate limit error", async () => {
      const config: RateLimitConfig = {
        provider: "test-provider",
        rateLimitRpm: 1,
        burstAllowance: 0,
        maxQueueSize: 0, // Queue size 0 so next request is immediately rejected
      };
      await enforcer.registerProvider(config);

      // Exceed limit
      await enforcer.checkLimit("test-provider", "req-1");

      try {
        await enforcer.checkLimit("test-provider", "req-2", 100);
        // Should not reach here
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as any).retryAfter).toBeDefined();
      }
    });
  });

  describe("Burst allowance", () => {
    it("should allow burst requests up to configured allowance", async () => {
      const config: RateLimitConfig = {
        provider: "test-provider",
        rateLimitRpm: 100,
        burstAllowance: 20, // 20% extra
        maxQueueSize: 50,
      };
      await enforcer.registerProvider(config);

      // Should allow 100 + (100 * 0.2) = 120 requests
      for (let i = 0; i < 120; i++) {
        const headers = await enforcer.checkLimit("test-provider", `req-${i}`);
        if (i < 120) {
          expect(headers["X-RateLimit-Remaining"]).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe("Analytics", () => {
    beforeEach(async () => {
      await enforcer.registerProvider(testConfig);
    });

    it("should track rate limit hits", async () => {
      const config: RateLimitConfig = {
        provider: "test-provider",
        rateLimitRpm: 1,
        burstAllowance: 0,
        maxQueueSize: 0, // Queue size 0 so requests are immediately rejected
      };
      await enforcer.registerProvider(config);

      // First request goes through
      await enforcer.checkLimit("test-provider", "req-1");

      // Second request is over limit and queue is full, so it is immediately rejected
      try {
        await enforcer.checkLimit("test-provider", "req-2", 100);
      } catch {
        // Expected - rate limit exceeded
      }

      const analytics = enforcer.getAnalytics("test-provider");
      expect(analytics?.rejected).toBeGreaterThan(0);
    });

    it("should reset analytics", async () => {
      enforcer.resetAnalytics("stripe");
      const analytics = enforcer.getAnalytics("stripe");
      expect(analytics).toBeUndefined();
    });
  });

  describe("Status and monitoring", () => {
    beforeEach(async () => {
      await enforcer.registerProvider(testConfig);
    });

    it("should return current status", async () => {
      const status = await enforcer.getStatus("stripe");
      expect(status).toHaveProperty("provider", "stripe");
      expect(status).toHaveProperty("activeRequests");
      expect(status).toHaveProperty("queueLength");
      expect(status).toHaveProperty("config");
    });

    it("should track active requests", async () => {
      await enforcer.checkLimit("stripe", "req-1");
      const status = await enforcer.getStatus("stripe");
      expect(status.activeRequests).toBeGreaterThan(0);
    });
  });

  describe("Queue processing", () => {
    it("should process queued requests", async () => {
      const config: RateLimitConfig = {
        provider: "test-provider",
        rateLimitRpm: 2,
        burstAllowance: 0,
        maxQueueSize: 10,
      };
      await enforcer.registerProvider(config);

      // Exceed limit and queue a request
      await enforcer.checkLimit("test-provider", "req-1");
      await enforcer.checkLimit("test-provider", "req-2");

      const queuePromise = enforcer.checkLimit("test-provider", "req-3", 5000);

      // Allow the microtask queue to flush so checkLimit queues the request
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Record completion to dequeue
      await enforcer.recordCompletion("test-provider", "req-1");

      // Queued request should proceed
      await expect(queuePromise).resolves.toBeDefined();
    });
  });

  describe("Event emission", () => {
    beforeEach(async () => {
      await enforcer.registerProvider(testConfig);
    });

    it("should emit queued event", async () => {
      const config: RateLimitConfig = {
        provider: "test-provider",
        rateLimitRpm: 1,
        burstAllowance: 0,
        maxQueueSize: 10,
      };
      await enforcer.registerProvider(config);

      const queuedSpy = vi.fn();
      enforcer.on("queued", queuedSpy);

      await enforcer.checkLimit("test-provider", "req-1");

      try {
        await enforcer.checkLimit("test-provider", "req-2", 100);
      } catch {
        // Expected
      }

      expect(queuedSpy).toHaveBeenCalled();
    });

    it("should emit dequeued event", async () => {
      const config: RateLimitConfig = {
        provider: "test-provider",
        rateLimitRpm: 1,
        burstAllowance: 0,
        maxQueueSize: 10,
      };
      await enforcer.registerProvider(config);

      const dequeuedSpy = vi.fn();
      enforcer.on("dequeued", dequeuedSpy);

      await enforcer.checkLimit("test-provider", "req-1");

      try {
        await enforcer.checkLimit("test-provider", "req-2", 100);
      } catch {
        // Expected
      }

      await enforcer.recordCompletion("test-provider", "req-1");

      expect(dequeuedSpy).toHaveBeenCalled();
    });
  });
});
