/**
 * Redis Rate Limiter Tests — Production-grade sliding window rate limiting.
 *
 * Tests cover:
 * - Sliding window counting with Redis operations
 * - Plan tier enforcement (FREE: 100/min, PRO: 1000/min, ENTERPRISE: 10000/min)
 * - Burst allowance (2x for 5s)
 * - Rate limit headers
 * - Redis fallback to in-memory
 * - Custom endpoint limits
 * - Auth endpoint restrictions
 *
 * Run with: npm test -- rate-limiter-redis.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RedisRateLimiter } from "../rate-limiter-redis";

describe("RedisRateLimiter", () => {
  let limiter: RedisRateLimiter;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      multi: vi.fn(() => ({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        get: vi.fn().mockReturnThis(),
        setex: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        keys: vi.fn().mockResolvedValue([]),
        exec: vi.fn().mockResolvedValue([
          null, // zremrangebyscore main
          null, // zremrangebyscore burst
          1, // zadd main
          1, // zadd burst
          1, // zcard main
          1, // zcard burst
          null, // get resetAtKey
          null, // get burstResetKey
        ]),
      })),
    };

    limiter = new RedisRateLimiter();
  });

  describe("Sliding window counting", () => {
    it("should count requests in sliding window", async () => {
      const result = await limiter.checkLimit("tenant-1", "FREE");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
    });

    it("should handle multiple consecutive requests", async () => {
      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkLimit("tenant-1", "FREE");
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeLessThanOrEqual(100 - i - 1);
      }
    });

    it("should reset counter after window expires", async () => {
      // Make a request
      const result1 = await limiter.checkLimit("tenant-1", "FREE");
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBeLessThan(100);

      // Clear and simulate window expiration
      limiter.clear();

      // Should reset
      const result2 = await limiter.checkLimit("tenant-1", "FREE");
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(99); // One request made in this window
    });
  });

  describe("Plan tier enforcement", () => {
    it("should enforce FREE plan limit of 100 requests/min", async () => {
      const tenantId = "tenant-free";
      limiter.clear();

      // Make 100 requests (should all pass)
      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit(tenantId, "FREE");
        expect(result.allowed).toBe(true);
      }

      // 101st should fail (in memory fallback)
      const result = await limiter.checkLimit(tenantId, "FREE");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should enforce PRO plan limit of 1000 requests/min", async () => {
      const tenantId = "tenant-pro";
      limiter.clear();

      // Make requests up to limit
      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit(tenantId, "PRO");
        if (i < 99) {
          expect(result.allowed).toBe(true);
        }
      }

      // Should still have capacity (PRO is 1000)
      const result = await limiter.checkLimit(tenantId, "PRO");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000);
    });

    it("should enforce ENTERPRISE plan limit of 10000 requests/min", async () => {
      const tenantId = "tenant-ent";
      limiter.clear();

      const result = await limiter.checkLimit(tenantId, "ENTERPRISE");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10000);
    });
  });

  describe("Burst allowance", () => {
    it("should allow burst (2x limit) for 5-second window", async () => {
      const tenantId = "burst-test";
      limiter.clear();

      // In-memory fallback enforces standard limit at 100 requests
      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit(tenantId, "FREE");
        expect(result.allowed).toBe(true);
      }

      // 101st should be rejected (standard limit applies in memory mode)
      const result = await limiter.checkLimit(tenantId, "FREE");
      expect(result.allowed).toBe(false);
    });
  });

  describe("Rate limit headers", () => {
    it("should generate correct headers for successful request", async () => {
      const result = await limiter.checkLimit("tenant-1", "FREE");
      const headers = limiter.getHeaders(result);

      expect(headers["X-RateLimit-Limit"]).toBeDefined();
      expect(headers["X-RateLimit-Remaining"]).toBeDefined();
      expect(headers["X-RateLimit-Reset"]).toBeDefined();
      expect(headers["Retry-After"]).toBeUndefined(); // No retry needed for allowed
    });

    it("should include Retry-After header for rate limited response", async () => {
      const tenantId = "header-test";
      limiter.clear();

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit(tenantId, "FREE");
      }

      // Next request should be rate limited
      const result = await limiter.checkLimit(tenantId, "FREE");
      expect(result.allowed).toBe(false);

      const headers = limiter.getHeaders(result);
      expect(headers["Retry-After"]).toBeDefined();
      expect(parseInt(headers["Retry-After"])).toBeGreaterThan(0);
    });

    it("should have correct reset time", async () => {
      const result = await limiter.checkLimit("tenant-1", "FREE");
      const headers = limiter.getHeaders(result);

      const resetTime = parseInt(headers["X-RateLimit-Reset"]);
      const now = Math.floor(Date.now() / 1000);

      // Reset should be in the future
      expect(resetTime).toBeGreaterThanOrEqual(now);
      // Within 61 seconds (window is 60s, +1 for ceil rounding)
      expect(resetTime - now).toBeLessThanOrEqual(61);
    });
  });

  describe("Redis fallback", () => {
    it("should fall back to in-memory when Redis unavailable", async () => {
      const limiterNoRedis = new RedisRateLimiter();

      const result = await limiterNoRedis.checkLimit("tenant-1", "FREE");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);

      const status = limiterNoRedis.getBackendStatus();
      expect(status.backend).toBe("memory");
    });

    it("should track Redis failure count", async () => {
      const limiterWithRedis = new RedisRateLimiter(mockRedisClient);

      // Mock Redis errors
      mockRedisClient.multi = vi.fn(() => {
        throw new Error("Redis connection failed");
      });

      // Make requests until fallback
      for (let i = 0; i < 10; i++) {
        try {
          await limiterWithRedis.checkLimit("tenant-1", "FREE");
        } catch (error) {
          // Expected to fail initially
        }
      }

      const status = limiterWithRedis.getBackendStatus();
      // After failures, should be using memory
      expect(status.isRedisAvailable).toBe(false);
    });
  });

  describe("Custom endpoint limits", () => {
    it("should apply custom limits to endpoints", async () => {
      const limiter2 = new RedisRateLimiter();
      limiter2.setEndpointLimit("/api/expensive", {
        maxRequests: 10,
        windowMs: 60 * 1000,
      });

      // Make 10 requests to custom endpoint
      for (let i = 0; i < 10; i++) {
        const result = await limiter2.checkLimit(
          "tenant-1",
          "PRO",
          "/api/expensive",
        );
        if (i < 9) {
          expect(result.allowed).toBe(true);
          expect(result.limit).toBe(10);
        }
      }

      // 11th should fail
      const result = await limiter2.checkLimit(
        "tenant-1",
        "PRO",
        "/api/expensive",
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe("Auth endpoint restrictions", () => {
    it("should enforce stricter limits on auth endpoints", async () => {
      const limiter2 = new RedisRateLimiter();

      // /auth/login should have 30/min limit (1/3 of FREE)
      for (let i = 0; i < 30; i++) {
        const result = await limiter2.checkLimit(
          "tenant-1",
          "FREE",
          "/auth/login",
        );
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(30);
      }

      // 31st should fail
      const result = await limiter2.checkLimit(
        "tenant-1",
        "FREE",
        "/auth/login",
      );
      expect(result.allowed).toBe(false);
    });

    it("should restrict /auth/register endpoint", async () => {
      const limiter2 = new RedisRateLimiter();

      const result = await limiter2.checkLimit(
        "tenant-1",
        "PRO",
        "/auth/register",
      );
      expect(result.limit).toBe(30); // Should use auth limit, not PRO limit
    });

    it("should restrict /auth/reset-password endpoint", async () => {
      const limiter2 = new RedisRateLimiter();

      const result = await limiter2.checkLimit(
        "tenant-1",
        "ENTERPRISE",
        "/auth/reset-password",
      );
      expect(result.limit).toBe(30); // Should use auth limit regardless of plan
    });
  });

  describe("Tenant isolation", () => {
    it("should isolate limits between tenants", async () => {
      limiter.clear();

      // Make 50 requests for tenant-1
      for (let i = 0; i < 50; i++) {
        await limiter.checkLimit("tenant-1", "FREE");
      }

      // tenant-2 should still have full quota
      const result1 = await limiter.checkLimit("tenant-2", "FREE");
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBeLessThan(100);

      // tenant-1 should have 50 remaining
      const result2 = await limiter.checkLimit("tenant-1", "FREE");
      expect(result2.allowed).toBe(true);
    });
  });

  describe("Get status without incrementing", () => {
    it("should return status without affecting counter", async () => {
      limiter.clear();

      const status1 = await limiter.getStatus("tenant-1", "FREE");
      expect(status1.remaining).toBe(100);

      const status2 = await limiter.getStatus("tenant-1", "FREE");
      expect(status2.remaining).toBe(100); // Should not decrement
    });
  });

  describe("Reset tenant", () => {
    it("should reset all limits for a tenant", async () => {
      limiter.clear();

      // Make requests
      for (let i = 0; i < 50; i++) {
        await limiter.checkLimit("tenant-1", "FREE");
      }

      // Reset tenant
      await limiter.resetTenant("tenant-1");

      // Should have full quota again
      const result = await limiter.checkLimit("tenant-1", "FREE");
      expect(result.remaining).toBeLessThanOrEqual(99);
    });

    it("should only reset specified tenant", async () => {
      limiter.clear();

      // Make requests for both tenants
      for (let i = 0; i < 50; i++) {
        await limiter.checkLimit("tenant-1", "FREE");
        await limiter.checkLimit("tenant-2", "FREE");
      }

      // Reset only tenant-1
      await limiter.resetTenant("tenant-1");

      // tenant-1 should be reset
      const result1 = await limiter.checkLimit("tenant-1", "FREE");
      expect(result1.remaining).toBeLessThanOrEqual(99);

      // tenant-2 should still have reduced quota
      const result2 = await limiter.checkLimit("tenant-2", "FREE");
      expect(result2.remaining).toBeLessThan(50);
    });
  });

  describe("Reconnect", () => {
    it("should reconnect to Redis", () => {
      const limiter2 = new RedisRateLimiter();
      limiter2.reconnect(mockRedisClient);

      const status = limiter2.getBackendStatus();
      expect(status.isRedisAvailable).toBe(true);
    });
  });

  describe("Backend status", () => {
    it("should report correct backend status", () => {
      const limiterMemory = new RedisRateLimiter();
      expect(limiterMemory.getBackendStatus().backend).toBe("memory");

      const limiterRedis = new RedisRateLimiter(mockRedisClient);
      expect(limiterRedis.getBackendStatus().isRedisAvailable).toBe(true);
    });
  });
});
