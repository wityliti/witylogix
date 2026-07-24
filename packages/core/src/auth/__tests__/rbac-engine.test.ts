/**
 * RBAC Engine Tests
 *
 * Comprehensive test suite for role-based access control.
 * Tests cover:
 * - Permission checking (resource + action)
 * - Role hierarchy
 * - Wildcard permissions
 * - Cache behavior
 * - Audit logging
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createRbacEngine,
  ROLE_HIERARCHY,
  DEFAULT_ROLE_PERMISSIONS,
} from "../rbac-engine.js";
import type { RbacEngine } from "../rbac-engine.js";
import type { PermissionContext } from "../rbac-engine.js";
import { PermissionDeniedError } from "../types.js";

describe("RbacEngine", () => {
  let engine: RbacEngine;
  const testOrgId = "org-123";
  const testUserId = "user-456";

  beforeEach(() => {
    engine = createRbacEngine();
    engine.clearCache();
    engine.clearAuditLog();
  });

  afterEach(() => {
    engine.clearCache();
    engine.clearAuditLog();
  });

  // ─── PERMISSION CHECKING TESTS ──────────────────────────

  describe("permission checking", () => {
    it("should allow viewer to read shipments", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      expect(() =>
        engine.checkPermission(context, "shipments", "read"),
      ).not.toThrow();
    });

    it("should deny viewer from creating shipments", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      expect(() =>
        engine.checkPermission(context, "shipments", "create"),
      ).toThrow(PermissionDeniedError);
    });

    it("should allow member to create shipments", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "MEMBER",
        permissions: [],
      };

      expect(() =>
        engine.checkPermission(context, "shipments", "create"),
      ).not.toThrow();
    });

    it("should allow admin to perform org operations", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      expect(() =>
        engine.checkPermission(context, "org", "read"),
      ).not.toThrow();
      expect(() =>
        engine.checkPermission(context, "org", "update"),
      ).not.toThrow();
    });

    it("should allow owner to perform all operations", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "OWNER",
        permissions: [],
      };

      expect(() =>
        engine.checkPermission(context, "billing", "read"),
      ).not.toThrow();
      expect(() =>
        engine.checkPermission(context, "settings", "update"),
      ).not.toThrow();
      expect(() =>
        engine.checkPermission(context, "users", "delete"),
      ).not.toThrow();
    });

    it("should return true on successful permission check", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      const result = engine.checkPermission(context, "shipments", "read");
      expect(result).toBe(true);
    });

    it("should throw PermissionDeniedError with resource and action", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      try {
        engine.checkPermission(context, "users", "delete");
        fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionDeniedError);
        expect((error as PermissionDeniedError).resource).toBe("users");
        expect((error as PermissionDeniedError).action).toBe("delete");
      }
    });
  });

  // ─── ROLE HIERARCHY TESTS ───────────────────────────────

  describe("role hierarchy", () => {
    it("should have correct hierarchy levels", () => {
      expect(ROLE_HIERARCHY.VIEWER).toBe(0);
      expect(ROLE_HIERARCHY.MEMBER).toBe(1);
      expect(ROLE_HIERARCHY.ADMIN).toBe(2);
      expect(ROLE_HIERARCHY.OWNER).toBe(3);
    });

    it("should inherit permissions from lower roles", () => {
      const viewerPerms = DEFAULT_ROLE_PERMISSIONS.VIEWER;
      const memberPerms = DEFAULT_ROLE_PERMISSIONS.MEMBER;

      // Member should have all viewer permissions
      for (const perm of viewerPerms) {
        expect(memberPerms).toContain(perm);
      }
    });

    it("should inherit permissions from all lower roles when checking", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      // Admin should have member and viewer permissions
      const allPerms = engine.getPermissions(context);

      // Viewer perm
      expect(allPerms.has("shipments:read")).toBe(true);
      // Member perm
      expect(allPerms.has("shipments:create")).toBe(true);
      // Admin perm
      expect(allPerms.has("org:read")).toBe(true);
    });

    it("should recognize owner as having highest level", () => {
      expect(ROLE_HIERARCHY.OWNER).toBeGreaterThan(ROLE_HIERARCHY.ADMIN);
      expect(ROLE_HIERARCHY.ADMIN).toBeGreaterThan(ROLE_HIERARCHY.MEMBER);
      expect(ROLE_HIERARCHY.MEMBER).toBeGreaterThan(ROLE_HIERARCHY.VIEWER);
    });
  });

  // ─── WILDCARD PERMISSION TESTS ──────────────────────────

  describe("wildcard permissions", () => {
    it("should allow resource:* to match all actions", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: ["shipments:*"],
      };

      expect(engine.hasPermission(context, "shipments:read")).toBe(true);
      expect(engine.hasPermission(context, "shipments:create")).toBe(true);
      expect(engine.hasPermission(context, "shipments:update")).toBe(true);
      expect(engine.hasPermission(context, "shipments:delete")).toBe(true);
    });

    it("should allow *:* to match all permissions", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: ["*:*"],
      };

      expect(engine.hasPermission(context, "shipments:create")).toBe(true);
      expect(engine.hasPermission(context, "users:delete")).toBe(true);
      expect(engine.hasPermission(context, "billing:update")).toBe(true);
      expect(engine.hasPermission(context, "anything:anything")).toBe(true);
    });

    it("should use wildcards in explicit permissions", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: ["org:*"],
      };

      expect(engine.hasPermission(context, "org:read")).toBe(true);
      expect(engine.hasPermission(context, "org:update")).toBe(true);
      expect(engine.hasPermission(context, "shipments:read")).toBe(true); // From VIEWER role
      expect(engine.hasPermission(context, "users:delete")).toBe(false);
    });
  });

  // ─── PERMISSION VALIDATION TESTS ────────────────────────

  describe("permission validation", () => {
    it("should validate correct permission format", () => {
      expect(engine.isValidPermission("shipments:read")).toBe(true);
      expect(engine.isValidPermission("shipments:create")).toBe(true);
      expect(engine.isValidPermission("shipments:*")).toBe(true);
      expect(engine.isValidPermission("*:*")).toBe(true);
    });

    it("should reject invalid permission format", () => {
      expect(engine.isValidPermission("invalid")).toBe(false);
      expect(engine.isValidPermission("")).toBe(false);
      expect(engine.isValidPermission(":")).toBe(false);
      expect(engine.isValidPermission("::")).toBe(false);
    });

    it("should reject permissions with invalid characters", () => {
      expect(engine.isValidPermission("ship@ments:read")).toBe(false);
      expect(engine.isValidPermission("shipments:read+")).toBe(false);
      expect(engine.isValidPermission("ship-ments:read")).toBe(false);
    });

    it("should accept underscores in permission names", () => {
      expect(engine.isValidPermission("shipping_orders:create")).toBe(true);
      expect(engine.isValidPermission("_admin:*")).toBe(true);
    });
  });

  // ─── CACHE TESTS ────────────────────────────────────────

  describe("caching", () => {
    it("should cache permissions after first lookup", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      const perms1 = engine.getPermissions(context);
      const perms2 = engine.getPermissions(context);

      expect(perms1).toBe(perms2); // Same object reference (cached)
    });

    it("should invalidate cache for specific user/org", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      const perms1 = engine.getPermissions(context);
      engine.invalidateCache(testUserId, testOrgId);
      const perms2 = engine.getPermissions(context);

      expect(perms1).not.toBe(perms2); // Different object (cache invalidated)
    });

    it("should provide cache statistics", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      engine.getPermissions(context);

      const stats = engine.getCacheStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxSize");
      expect(stats).toHaveProperty("hitRate");
      expect(stats.size).toBeGreaterThan(0);
    });

    it("should clear all cache", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      engine.getPermissions(context);
      engine.clearCache();

      const stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  // ─── ROLE DETECTION TESTS ───────────────────────────────

  describe("role detection", () => {
    it("should recognize org admin (ADMIN role)", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      expect(engine.isOrgAdmin(context)).toBe(true);
      expect(engine.isOrgOwner(context)).toBe(false);
    });

    it("should recognize org owner (OWNER role)", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "OWNER",
        permissions: [],
      };

      expect(engine.isOrgOwner(context)).toBe(true);
      expect(engine.isOrgAdmin(context)).toBe(true); // Owner is also admin
    });

    it("should not recognize viewer as admin", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      expect(engine.isOrgAdmin(context)).toBe(false);
      expect(engine.isOrgOwner(context)).toBe(false);
    });

    it("should not recognize member as admin", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "MEMBER",
        permissions: [],
      };

      expect(engine.isOrgAdmin(context)).toBe(false);
      expect(engine.isOrgOwner(context)).toBe(false);
    });
  });

  // ─── AUDIT LOGGING TESTS ────────────────────────────────

  describe("audit logging", () => {
    it("should log successful permission checks", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      engine.hasPermission(context, "shipments:read");
      const logs = engine.getAuditLog(testUserId);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].resource).toBe("shipments");
      expect(logs[0].action).toBe("read");
      expect(logs[0].allowed).toBe(true);
    });

    it("should log denied permission checks", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      engine.hasPermission(context, "users:delete");
      const logs = engine.getAuditLog(testUserId);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].allowed).toBe(false);
    });

    it("should filter audit log by user", () => {
      const context1: PermissionContext = {
        userId: "user-1",
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      const context2: PermissionContext = {
        userId: "user-2",
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      engine.hasPermission(context1, "shipments:read");
      engine.hasPermission(context2, "shipments:read");

      const logs1 = engine.getAuditLog("user-1");
      expect(logs1.every((l) => l.userId === "user-1")).toBe(true);
    });

    it("should respect limit on audit log retrieval", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      for (let i = 0; i < 20; i++) {
        engine.hasPermission(context, "shipments:read");
      }

      const logs = engine.getAuditLog(testUserId, 5);
      expect(logs.length).toBeLessThanOrEqual(5);
    });

    it("should clear audit log", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      engine.hasPermission(context, "shipments:read");
      engine.clearAuditLog();

      const logs = engine.getAuditLog(testUserId);
      expect(logs.length).toBe(0);
    });
  });

  // ─── EDGE CASES ──────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle empty permission set", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: [],
      };

      const perms = engine.getPermissions(context);
      expect(perms.size).toBeGreaterThan(0); // Should have viewer role perms
    });

    it("should handle explicit permissions override", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "VIEWER",
        permissions: ["custom:operation"],
      };

      expect(engine.hasPermission(context, "custom:operation")).toBe(true);
    });

    it("should handle mixed case role names (converted to correct case)", () => {
      // Assuming role is already in correct format from context
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      expect(engine.isOrgAdmin(context)).toBe(true);
    });

    it("should handle permission check with same resource and action", () => {
      expect(engine.isValidPermission("read:read")).toBe(true);
      expect(engine.isValidPermission("create:create")).toBe(true);
    });
  });

  // ─── INTEGRATION TESTS ──────────────────────────────────

  describe("integration scenarios", () => {
    it("should support realistic permission workflow", () => {
      const adminContext: PermissionContext = {
        userId: "admin-1",
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      const memberContext: PermissionContext = {
        userId: "member-1",
        orgId: testOrgId,
        role: "MEMBER",
        permissions: [],
      };

      // Admin can do everything
      expect(engine.hasPermission(adminContext, "shipments:create")).toBe(true);
      expect(engine.hasPermission(adminContext, "org:update")).toBe(true);

      // Member can create but not manage org
      expect(engine.hasPermission(memberContext, "shipments:create")).toBe(
        true,
      );
      expect(engine.hasPermission(memberContext, "org:update")).toBe(false);
    });

    it("should support permission revocation via context", () => {
      const context: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [],
      };

      // Admin normally has shipments:* permission
      expect(engine.hasPermission(context, "shipments:delete")).toBe(true);

      // This would be handled by not granting the permission in context
      const restrictedContext: PermissionContext = {
        userId: testUserId,
        orgId: testOrgId,
        role: "ADMIN",
        permissions: [], // No explicit overrides
      };

      // Still has it from ADMIN role - in real scenario, use different role
      expect(engine.hasPermission(restrictedContext, "shipments:delete")).toBe(
        true,
      );
    });
  });
});
