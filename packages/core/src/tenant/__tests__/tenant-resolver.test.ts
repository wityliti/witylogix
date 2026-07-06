/**
 * Tenant Resolver Tests — Multi-strategy tenant resolution and caching.
 *
 * Tests cover:
 * - Subdomain resolution (acme.witylogix.com → org "acme")
 * - Header resolution (X-Tenant-ID)
 * - JWT resolution (orgId in token claims)
 * - API key resolution with prefix lookup
 * - Custom domain resolution
 * - LRU cache behavior (5-minute TTL)
 * - Cache invalidation
 *
 * Run with: npm test -- tenant-resolver.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request } from "express";
import {
  resolveTenant,
  invalidateTenantCache,
  clearTenantCache,
} from "../tenant-resolver";
import { generateApiKey } from "../api-key-service";
import { prisma } from "@witylogix/db";
import * as jwt from "jsonwebtoken";

describe("Tenant Resolver", () => {
  let testOrg: any;
  let testTenantConfig: any;

  beforeEach(async () => {
    // Create test organization
    testOrg = await prisma.organization.create({
      data: {
        id: "test-org-uuid",
        name: "Test Org",
        slug: "test-org",
        planTier: "STARTUP",
        isActive: true,
      },
    });

    // Create tenant config with subdomain
    testTenantConfig = await prisma.tenantConfig.create({
      data: {
        orgId: testOrg.id,
        subdomain: "acme",
        features: {},
        limits: {},
        isActive: true,
      },
    });
  });

  afterEach(async () => {
    clearTenantCache();
    await prisma.tenantConfig.deleteMany({
      where: { orgId: testOrg.id },
    });
    await prisma.apiKey.deleteMany({ where: { orgId: testOrg.id } });
    await prisma.organization.deleteMany({ where: { id: testOrg.id } });
  });

  // ─── SUBDOMAIN RESOLUTION TESTS ─────────────────────────────────────

  describe("Subdomain Resolution", () => {
    it("should resolve tenant from subdomain", async () => {
      const req = {
        hostname: "acme.witylogix.com",
        headers: {},
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      expect(context.orgId).toBe(testOrg.id);
      expect(context.resolvedVia).toBe("SUBDOMAIN");
      expect(context.plan).toBe("STARTUP");
    });

    it("should reject inactive tenant subdomains", async () => {
      await prisma.tenantConfig.update({
        where: { id: testTenantConfig.id },
        data: { isActive: false },
      });

      const req = {
        hostname: "acme.witylogix.com",
        headers: {},
        id: "test-req-id",
      } as any;

      await expect(resolveTenant(req)).rejects.toThrow("TENANT_INACTIVE");
    });

    it("should reject request with no matching subdomain", async () => {
      const req = {
        hostname: "nonexistent.witylogix.com",
        headers: {},
        id: "test-req-id",
      } as any;

      await expect(resolveTenant(req)).rejects.toThrow("NO_TENANT_FOUND");
    });

    it("should ignore www and api subdomains", async () => {
      const reqWww = {
        hostname: "www.witylogix.com",
        headers: { "x-tenant-id": testOrg.id },
        id: "test-req-id",
      } as any;

      // Should fall through to header resolution
      const context = await resolveTenant(reqWww);

      expect(context.resolvedVia).toBe("HEADER"); // Resolved via header, not subdomain
    });
  });

  // ─── HEADER RESOLUTION TESTS ────────────────────────────────────────

  describe("Header Resolution (X-Tenant-ID)", () => {
    it("should resolve tenant from X-Tenant-ID header", async () => {
      const req = {
        hostname: "api.witylogix.com",
        headers: { "x-tenant-id": testOrg.id },
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      expect(context.orgId).toBe(testOrg.id);
      expect(context.resolvedVia).toBe("HEADER");
    });

    it("should prioritize header over subdomain", async () => {
      const otherOrg = await prisma.organization.create({
        data: {
          id: "other-org-id",
          name: "Other Org",
          slug: "other-org",
          planTier: "FREE",
          isActive: true,
        },
      });

      await prisma.tenantConfig.create({
        data: {
          orgId: otherOrg.id,
          subdomain: "other",
          features: {},
          limits: {},
          isActive: true,
        },
      });

      const req = {
        hostname: "acme.witylogix.com", // Would resolve to testOrg
        headers: { "x-tenant-id": otherOrg.id }, // But header says other
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      expect(context.orgId).toBe(otherOrg.id); // Header wins

      // Cleanup
      await prisma.tenantConfig.deleteMany({ where: { orgId: otherOrg.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    });

    it("should reject invalid org ID in header", async () => {
      const req = {
        hostname: "api.witylogix.com",
        headers: { "x-tenant-id": "invalid-uuid" },
        id: "test-req-id",
      } as any;

      await expect(resolveTenant(req)).rejects.toThrow();
    });
  });

  // ─── JWT RESOLUTION TESTS ───────────────────────────────────────────

  describe("JWT Resolution", () => {
    it("should resolve tenant from JWT claims", async () => {
      const token = jwt.sign({ orgId: testOrg.id, sub: "user-123" }, "secret");

      const req = {
        hostname: "api.witylogix.com",
        headers: { authorization: `Bearer ${token}` },
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req, "user-123");

      expect(context.orgId).toBe(testOrg.id);
      expect(context.resolvedVia).toBe("JWT");
    });

    it("should reject invalid JWT tokens", async () => {
      const req = {
        hostname: "api.witylogix.com",
        headers: { authorization: "Bearer invalid.jwt.token" },
        id: "test-req-id",
      } as any;

      // Should fall through to other strategies
      await expect(resolveTenant(req)).rejects.toThrow("NO_TENANT_FOUND");
    });

    it("should extract userId from JWT sub claim", async () => {
      const userId = "test-user-123";
      const token = jwt.sign({ orgId: testOrg.id, sub: userId }, "secret");

      const req = {
        hostname: "api.witylogix.com",
        headers: { authorization: `Bearer ${token}` },
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      // Context userId should come from JWT claim
      expect(context.userId).toBeDefined();
    });
  });

  // ─── API KEY RESOLUTION TESTS ───────────────────────────────────────

  describe("API Key Resolution", () => {
    let validApiKey: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrg.id, "Test Key", ["READ"]);
      validApiKey = response.secret;
    });

    it("should resolve tenant from API key (Authorization header)", async () => {
      const req = {
        hostname: "api.witylogix.com",
        headers: { authorization: `Bearer ${validApiKey}` },
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      expect(context.orgId).toBe(testOrg.id);
      expect(context.resolvedVia).toBe("API_KEY");
      expect(context.apiKeyId).toBeDefined();
      expect(context.apiKeyScopes).toEqual(["READ"]);
    });

    it("should resolve tenant from API key (x-api-key header)", async () => {
      const req = {
        hostname: "api.witylogix.com",
        headers: { "x-api-key": validApiKey },
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      expect(context.orgId).toBe(testOrg.id);
      expect(context.resolvedVia).toBe("API_KEY");
    });

    it("should reject invalid API keys", async () => {
      const req = {
        hostname: "api.witylogix.com",
        headers: { "x-api-key": "wl_live_invalidkey1234567890" },
        id: "test-req-id",
      } as any;

      // Should fall through to other strategies
      await expect(resolveTenant(req)).rejects.toThrow("NO_TENANT_FOUND");
    });

    it("should include API key scopes in context", async () => {
      const response = await generateApiKey(testOrg.id, "Scoped Key", [
        "WRITE",
        "WEBHOOK",
      ]);

      const req = {
        hostname: "api.witylogix.com",
        headers: { "x-api-key": response.secret },
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      expect(context.apiKeyScopes).toEqual(["WRITE", "WEBHOOK"]);
    });
  });

  // ─── CUSTOM DOMAIN RESOLUTION TESTS ─────────────────────────────────

  describe("Custom Domain Resolution", () => {
    beforeEach(async () => {
      await prisma.tenantConfig.update({
        where: { id: testTenantConfig.id },
        data: { customDomain: "logistics.acme.com" },
      });
    });

    it("should resolve tenant from custom domain", async () => {
      const req = {
        hostname: "logistics.acme.com",
        headers: {},
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      expect(context.orgId).toBe(testOrg.id);
      expect(context.resolvedVia).toBe("CUSTOM_DOMAIN");
    });

    it("should reject inactive custom domains", async () => {
      await prisma.tenantConfig.update({
        where: { id: testTenantConfig.id },
        data: { isActive: false },
      });

      const req = {
        hostname: "logistics.acme.com",
        headers: {},
        id: "test-req-id",
      } as any;

      await expect(resolveTenant(req)).rejects.toThrow("TENANT_INACTIVE");
    });
  });

  // ─── RESOLUTION STRATEGY PRIORITY TESTS ──────────────────────────────

  describe("Resolution Strategy Priority", () => {
    let apiKey: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrg.id, "Test", ["READ"]);
      apiKey = response.secret;
    });

    it("should prioritize: Header > JWT > API Key > Subdomain > Custom Domain", async () => {
      const otherOrg = await prisma.organization.create({
        data: {
          id: "other-id",
          name: "Other",
          slug: "other",
          planTier: "FREE",
          isActive: true,
        },
      });

      const token = jwt.sign({ orgId: otherOrg.id, sub: "user-1" }, "secret");

      const req = {
        hostname: "acme.witylogix.com", // Would resolve to testOrg
        headers: {
          "x-tenant-id": otherOrg.id, // Header should win
          authorization: `Bearer ${token}`,
          "x-api-key": apiKey,
        },
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      // Header should win
      expect(context.resolvedVia).toBe("HEADER");
      expect(context.orgId).toBe(otherOrg.id);

      // Cleanup
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    });
  });

  // ─── CACHING TESTS ──────────────────────────────────────────────────

  describe("Tenant Caching", () => {
    it("should cache resolved tenants", async () => {
      const req = {
        hostname: "acme.witylogix.com",
        headers: {},
        id: "test-req-1",
      } as any;

      // First resolution (cache miss)
      const context1 = await resolveTenant(req);

      // Temporarily inactivate org
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: { isActive: false },
      });

      // Second resolution should still work (from cache)
      const req2 = { ...req, id: "test-req-2" } as any;
      const context2 = await resolveTenant(req2);

      expect(context2.orgId).toBe(context1.orgId);
      expect(context2.resolvedAt.getTime()).toBeGreaterThanOrEqual(
        context1.resolvedAt.getTime(),
      );

      // Restore for cleanup
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: { isActive: true },
      });
    });

    it("should invalidate cache on tenant update", async () => {
      const req = {
        hostname: "acme.witylogix.com",
        headers: {},
        id: "test-req-1",
      } as any;

      const context1 = await resolveTenant(req);

      // Invalidate cache
      invalidateTenantCache(testOrg.id);

      // Inactivate org
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: { isActive: false },
      });

      // Should now fail (cache was invalidated)
      const req2 = { ...req, id: "test-req-2" } as any;
      await expect(resolveTenant(req2)).rejects.toThrow("TENANT_INACTIVE");

      // Restore
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: { isActive: true },
      });
    });

    it("should clear all cache entries", async () => {
      const req = {
        hostname: "acme.witylogix.com",
        headers: {},
        id: "test-req-1",
      } as any;

      await resolveTenant(req);

      // Clear cache
      clearTenantCache();

      // Inactivate org
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: { isActive: false },
      });

      // Should now fail
      const req2 = { ...req, id: "test-req-2" } as any;
      await expect(resolveTenant(req2)).rejects.toThrow("TENANT_INACTIVE");

      // Restore
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: { isActive: true },
      });
    });
  });

  // ─── CONTEXT BUILDING TESTS ─────────────────────────────────────────

  describe("Context Building", () => {
    it("should include plan and features in context", async () => {
      const req = {
        hostname: "acme.witylogix.com",
        headers: {},
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);

      expect(context.plan).toBe("STARTUP");
      expect(context.features).toBeDefined();
      expect(context.features.apiAccess).toBe(true);
      expect(context.limits).toBeDefined();
      expect(context.limits.maxRequestsPerDay).toBeDefined();
    });

    it("should include request ID in context", async () => {
      const requestId = "custom-request-id-123";
      const req = {
        hostname: "acme.witylogix.com",
        headers: {},
        id: requestId,
      } as any;

      const context = await resolveTenant(req);

      expect(context.requestId).toBe(requestId);
    });

    it("should set resolvedAt timestamp", async () => {
      const beforeResolve = Date.now();

      const req = {
        hostname: "acme.witylogix.com",
        headers: {},
        id: "test-req-id",
      } as any;

      const context = await resolveTenant(req);
      const afterResolve = Date.now();

      expect(context.resolvedAt.getTime()).toBeGreaterThanOrEqual(
        beforeResolve,
      );
      expect(context.resolvedAt.getTime()).toBeLessThanOrEqual(afterResolve);
    });
  });

  // ─── ERROR HANDLING TESTS ───────────────────────────────────────────

  describe("Error Handling", () => {
    it("should throw when no tenant can be resolved", async () => {
      const req = {
        hostname: "unknown.witylogix.com",
        headers: {},
        id: "test-req-id",
      } as any;

      await expect(resolveTenant(req)).rejects.toThrow("NO_TENANT_FOUND");
    });

    it("should provide helpful error messages", async () => {
      const req = {
        hostname: "invalid.witylogix.com",
        headers: {},
        id: "test-req-id",
      } as any;

      try {
        await resolveTenant(req);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.code).toBe("NO_TENANT_FOUND");
        expect(err.message).toContain("Could not resolve tenant");
      }
    });
  });
});
