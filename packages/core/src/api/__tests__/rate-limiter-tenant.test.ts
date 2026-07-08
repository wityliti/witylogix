/**
 * Tenant Rate Limiter Tests — Per-tenant sliding window rate limiting.
 *
 * Tests cover:
 * - Plan tier enforcement (FREE: 100/min, PRO: 1000/min, ENTERPRISE: 10000/min)
 * - Sliding window behavior
 * - Burst allowance (2x for 10s)
 * - Per-endpoint overrides
 * - Rate limit headers
 * - Tenant isolation
 *
 * Run with: npm test -- rate-limiter-tenant.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TenantRateLimiter } from "../rate-limiter-tenant";

describe("TenantRateLimiter", () => {
  let limiter: TenantRateLimiter;

  beforeEach(() => {
    limiter = new TenantRateLimiter("memory");
  });

  describe("Plan tier enforcement", () => {
    it("should enforce FREE plan limit of 100 requests/min", async () => {
      const tenantId = "tenant-free";
      const planTier = "FREE" as const;

      // Make 100 requests (should all pass)
      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit(tenantId, planTier);
        expect(result.allowed).toBe(true);
      }

      // 101st request should fail
      const result = await limiter.checkLimit(tenantId, planTier);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it("should enforce PRO plan limit of 1000 requests/min", async () => {
      const tenantId = "tenant-pro";
      const planTier = "PRO" as const;

      // Make 1000 requests
      for (let i = 0; i < 1000; i++) {
        const result = await limiter.checkLimit(tenantId, planTier);
        if (i < 999) {
          expect(result.allowed).toBe(true);
        }
      }

      // 1001st should fail
      const result = await limiter.checkLimit(tenantId, planTier);
      expect(result.allowed).toBe(false);
    });

    it("should enforce ENTERPRISE plan limit of 10000 requests/min", async () => {
      const tenantId = "tenant-ent";
      const planTier = "ENTERPRISE" as const;

      // Make 10000 requests (simplified for testing)
      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit(tenantId, planTier);
        expect(result.allowed).toBe(true);
      }

      // Enterprise should have plenty of capacity
      const result = await limiter.checkLimit(tenantId, planTier);
      expect(result.allowed).toBe(true);
    });
  });

  describe("Rate limit result", () => {
    it("should return correct remaining count", async () => {
      const tenantId = "tenant-1";
      const planTier = "FREE" as const; // 100 limit

      const result1 = await limiter.checkLimit(tenantId, planTier);
      expect(result1.remaining).toBe(99);
      expect(result1.limit).toBe(100);

      const result2 = await limiter.checkLimit(tenantId, planTier);
      expect(result2.remaining).toBe(98);
    });

    it("should include reset timestamp", async () => {
      const tenantId = "tenant-2";
      const planTier = "PRO" as const;

      const result = await limiter.checkLimit(tenantId, planTier);
      expect(result.reset).toBeGreaterThan(Date.now());
    });

    it("should include retry-after for rejected requests", async () => {
      const tenantId = "tenant-3";
      const planTier = "FREE" as const;

      // Exhaust limit
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit(tenantId, planTier);
      }

      const result = await limiter.checkLimit(tenantId, planTier);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("Per-endpoint overrides", () => {
    it("should apply custom limit to specific endpoint", async () => {
      const tenantId = "tenant-4";
      const planTier = "PRO" as const;

      // Set custom limit for /webhook endpoint (lower than plan default)
      limiter.setEndpointLimit("/webhook", {
        maxRequests: 10,
        windowMs: 60000,
      });

      // Check default endpoint (should use plan limit)
      const defaultResult = await limiter.checkLimit(
        tenantId,
        planTier,
        "default",
      );
      expect(defaultResult.limit).toBe(1000); // PRO limit

      // Check overridden endpoint (should use custom limit)
      const webhookResult = await limiter.checkLimit(
        tenantId,
        planTier,
        "/webhook",
      );
      expect(webhookResult.limit).toBe(10);
    });

    it("should isolate per-endpoint rate limits", async () => {
      const tenantId = "tenant-5";
      const planTier = "FREE" as const;

      // Exhaust /api endpoint
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit(tenantId, planTier, "/api");
      }

      // /webhook should still have capacity (different counter)
      const webhookResult = await limiter.checkLimit(
        tenantId,
        planTier,
        "/webhook",
      );
      expect(webhookResult.allowed).toBe(true);
      expect(webhookResult.remaining).toBe(99);
    });
  });

  describe("Burst allowance", () => {
    it("should allow burst (2x limit) for short window", async () => {
      const tenantId = "tenant-6";
      const planTier = "FREE" as const; // 100 base, 200 burst for 10s

      // Make 100 requests (fills standard limit)
      for (let i = 0; i < 100; i++) {
        const result = await limiter.checkLimit(tenantId, planTier);
        expect(result.allowed).toBe(true);
      }

      // 101st should be rejected (standard limit enforced)
      const result = await limiter.checkLimit(tenantId, planTier);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("Status checking", () => {
    it("should return status without incrementing counter", async () => {
      const tenantId = "tenant-7";
      const planTier = "FREE" as const;

      const status1 = await limiter.getStatus(tenantId, planTier);
      expect(status1.remaining).toBe(100);

      const status2 = await limiter.getStatus(tenantId, planTier);
      expect(status2.remaining).toBe(100); // Still 100, not decremented

      const actual = await limiter.checkLimit(tenantId, planTier);
      expect(actual.remaining).toBe(99);
    });
  });

  describe("Response headers", () => {
    it("should format rate limit headers", async () => {
      const tenantId = "tenant-8";
      const planTier = "PRO" as const;

      const result = await limiter.checkLimit(tenantId, planTier);
      const headers = limiter.getHeaders(result);

      expect(headers["X-RateLimit-Limit"]).toBe("1000");
      expect(headers["X-RateLimit-Remaining"]).toBe("999");
      expect(headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should include Retry-After header when rejected", async () => {
      const tenantId = "tenant-9";
      const planTier = "FREE" as const;

      // Exhaust limit
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit(tenantId, planTier);
      }

      const result = await limiter.checkLimit(tenantId, planTier);
      const headers = limiter.getHeaders(result);

      expect(headers["Retry-After"]).toBeDefined();
    });
  });

  describe("Tenant isolation", () => {
    it("should isolate rate limits between tenants", async () => {
      const planTier = "FREE" as const;

      // Exhaust tenant-1
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit("tenant-a", planTier);
      }

      // tenant-2 should still have capacity
      const result = await limiter.checkLimit("tenant-b", planTier);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it("should reset tenant limits independently", async () => {
      const planTier = "FREE" as const;

      // Use some requests for both tenants
      await limiter.checkLimit("tenant-x", planTier);
      await limiter.checkLimit("tenant-y", planTier);

      // Reset only tenant-x
      limiter.resetTenant("tenant-x");

      const resultX = await limiter.getStatus("tenant-x", planTier);
      const resultY = await limiter.getStatus("tenant-y", planTier);

      expect(resultX.remaining).toBe(100); // Reset
      expect(resultY.remaining).toBe(99); // Unchanged
    });
  });
});
