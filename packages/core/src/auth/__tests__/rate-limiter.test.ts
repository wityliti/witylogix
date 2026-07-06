/**
 * Rate Limiter Tests
 *
 * Comprehensive test suite for sliding window rate limiting.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SlidingWindowRateLimiter,
  createRateLimiter,
  createEndpointRateLimiter,
  getRateLimiter,
  resetRateLimiter,
} from "../rate-limiter";

describe("SlidingWindowRateLimiter", () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter();
  });

  afterEach(() => {
    resetRateLimiter();
  });

  describe("Basic Rate Limiting", () => {
    it("should allow requests within limit", () => {
      const result = limiter.check({
        ip: "192.168.1.1",
        endpoint: "/api/test",
      });

      expect(result.allowed).toBe(true);
      expect(result.primary?.remaining).toBeGreaterThanOrEqual(0);
    });

    it("should block requests exceeding limit", () => {
      // Exceed per-endpoint limit (5 per minute)
      for (let i = 0; i < 5; i++) {
        const result = limiter.check({
          ip: "192.168.1.1",
          endpoint: "/auth/login",
        });
        expect(result.allowed).toBe(true);
      }

      // This should be blocked
      const result = limiter.check({
        ip: "192.168.1.1",
        endpoint: "/auth/login",
      });

      expect(result.allowed).toBe(false);
      expect(result.primary?.retryAfter).toBeDefined();
    });

    it("should track remaining requests correctly", () => {
      const limit = 100;

      const result = limiter.check({
        ip: "192.168.1.2",
        endpoint: "/api/test",
      });

      expect(result.primary?.limit).toBe(limit);
      expect(result.primary?.remaining).toBeLessThanOrEqual(limit - 1);
    });
  });

  describe("Per-IP Rate Limiting", () => {
    it("should enforce per-IP limits", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perIp: { windowMs: 1000, maxRequests: 2 },
      });

      let result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result1.allowed).toBe(true);

      let result2 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result2.allowed).toBe(true);

      let result3 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result3.allowed).toBe(false);
    });

    it("should isolate limits between different IPs", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perIp: { windowMs: 1000, maxRequests: 1 },
      });

      const result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result1.allowed).toBe(true);

      const result2 = limiterWithConfig.check({
        ip: "192.168.1.2",
      });
      expect(result2.allowed).toBe(true);
    });
  });

  describe("Per-User Rate Limiting", () => {
    it("should enforce per-user limits", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perUser: { windowMs: 1000, maxRequests: 2 },
      });

      let result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
        userId: "user-123",
      });
      expect(result1.allowed).toBe(true);

      let result2 = limiterWithConfig.check({
        ip: "192.168.1.1",
        userId: "user-123",
      });
      expect(result2.allowed).toBe(true);

      let result3 = limiterWithConfig.check({
        ip: "192.168.1.1",
        userId: "user-123",
      });
      expect(result3.allowed).toBe(false);
    });

    it("should isolate limits between different users", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perUser: { windowMs: 1000, maxRequests: 1 },
      });

      const result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
        userId: "user-123",
      });
      expect(result1.allowed).toBe(true);

      const result2 = limiterWithConfig.check({
        ip: "192.168.1.1",
        userId: "user-456",
      });
      expect(result2.allowed).toBe(true);
    });
  });

  describe("Per-Endpoint Rate Limiting", () => {
    it("should apply endpoint-specific limits", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perEndpoint: {
          "/auth/login": { windowMs: 1000, maxRequests: 1 },
        },
      });

      const result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
        endpoint: "/auth/login",
      });
      expect(result1.allowed).toBe(true);

      const result2 = limiterWithConfig.check({
        ip: "192.168.1.1",
        endpoint: "/auth/login",
      });
      expect(result2.allowed).toBe(false);
    });

    it("should use different limits for different endpoints", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perEndpoint: {
          "/auth/login": { windowMs: 1000, maxRequests: 1 },
          "/api/data": { windowMs: 1000, maxRequests: 10 },
        },
      });

      const result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
        endpoint: "/auth/login",
      });
      expect(result1.allowed).toBe(true);

      const result2 = limiterWithConfig.check({
        ip: "192.168.1.1",
        endpoint: "/api/data",
      });
      expect(result2.allowed).toBe(true);
    });

    it("should not apply endpoint limit if not configured", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perEndpoint: {
          "/auth/login": { windowMs: 1000, maxRequests: 1 },
        },
      });

      const result = limiterWithConfig.check({
        ip: "192.168.1.1",
        endpoint: "/unconfigured",
      });

      expect(result.limits.perEndpoint).toBeUndefined();
    });
  });

  describe("Rate Limit Headers", () => {
    it("should include limit information in result", () => {
      const result = limiter.check({
        ip: "192.168.1.1",
      });

      expect(result.primary?.limit).toBeDefined();
      expect(result.primary?.remaining).toBeDefined();
      expect(result.primary?.resetAt).toBeDefined();
    });

    it("should calculate Retry-After correctly", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perIp: { windowMs: 1000, maxRequests: 1 },
      });

      limiterWithConfig.check({ ip: "192.168.1.1" });

      const result = limiterWithConfig.check({
        ip: "192.168.1.1",
      });

      expect(result.primary?.retryAfter).toBeDefined();
      expect(result.primary?.retryAfter).toBeGreaterThan(0);
      expect(result.primary?.retryAfter).toBeLessThanOrEqual(1);
    });
  });

  describe("Window Expiry", () => {
    it("should reset counter after window expires", async () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perIp: { windowMs: 100, maxRequests: 1 },
      });

      let result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result1.allowed).toBe(true);

      let result2 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result2.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      let result3 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result3.allowed).toBe(true);
    });
  });

  describe("Reset Operations", () => {
    it("should reset limit for specific key", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perIp: { windowMs: 1000, maxRequests: 1 },
      });

      limiterWithConfig.check({ ip: "192.168.1.1" });

      let result = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result.allowed).toBe(false);

      limiterWithConfig.reset("ip:192.168.1.1");

      result = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result.allowed).toBe(true);
    });

    it("should reset all limits", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perIp: { windowMs: 1000, maxRequests: 1 },
      });

      limiterWithConfig.check({ ip: "192.168.1.1" });
      limiterWithConfig.check({ ip: "192.168.1.2" });

      let result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result1.allowed).toBe(false);

      limiterWithConfig.resetAll();

      result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
      });
      expect(result1.allowed).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("should provide stats", () => {
      limiter.check({ ip: "192.168.1.1" });
      limiter.check({ ip: "192.168.1.2" });

      const stats = limiter.getStats();

      expect(stats.totalKeys).toBeGreaterThan(0);
      expect(stats.config).toBeDefined();
    });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance", () => {
      const limiter1 = getRateLimiter();
      const limiter2 = getRateLimiter();

      expect(limiter1).toBe(limiter2);
    });

    it("should reset singleton", () => {
      getRateLimiter();
      resetRateLimiter();

      const limiter1 = getRateLimiter();
      const limiter2 = getRateLimiter();

      expect(limiter1).toBe(limiter2);
    });
  });

  describe("Middleware Factory", () => {
    it("should create middleware", () => {
      const middleware = createRateLimiter();

      expect(typeof middleware).toBe("function");
    });

    it("should create endpoint-specific middleware", () => {
      const middleware = createEndpointRateLimiter("/auth/login", {
        windowMs: 1000,
        maxRequests: 5,
      });

      expect(typeof middleware).toBe("function");
    });
  });

  describe("Most Restrictive Limit", () => {
    it("should use most restrictive limit", () => {
      const limiterWithConfig = new SlidingWindowRateLimiter({
        perIp: { windowMs: 1000, maxRequests: 100 },
        perUser: { windowMs: 1000, maxRequests: 2 },
      });

      let result1 = limiterWithConfig.check({
        ip: "192.168.1.1",
        userId: "user-123",
      });
      expect(result1.allowed).toBe(true);

      let result2 = limiterWithConfig.check({
        ip: "192.168.1.1",
        userId: "user-123",
      });
      expect(result2.allowed).toBe(true);

      // Should be blocked by per-user limit, not per-IP limit
      let result3 = limiterWithConfig.check({
        ip: "192.168.1.1",
        userId: "user-123",
      });
      expect(result3.allowed).toBe(false);
    });
  });
});
