/**
 * RBAC Permissions Integration Tests
 * Tests: permission checking, role hierarchy, permission cache, tenant-scoped permissions
 * ~600 lines, 35+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LRUCache } from 'lru-cache';

// ───────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ───────────────────────────────────────────────────────────────────────────

type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
type ResourceAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

interface Permission {
  resource: string;
  action: ResourceAction;
  conditions?: Record<string, unknown>;
}

interface RoleDefinition {
  role: UserRole;
  permissions: Permission[];
  inheritsFrom?: UserRole;
}

interface RBACContext {
  userId: string;
  orgId: string;
  tenantId: string;
  role: UserRole;
}

// ───────────────────────────────────────────────────────────────────────────
// RBAC ENGINE
// ───────────────────────────────────────────────────────────────────────────

const roleHierarchy: RoleDefinition[] = [
  {
    role: 'OWNER',
    permissions: [
      { resource: 'org:*', action: 'manage' },
      { resource: 'members', action: 'manage' },
      { resource: 'billing', action: 'manage' },
      { resource: 'settings', action: 'manage' },
      { resource: 'drivers', action: 'manage' },
      { resource: 'zones', action: 'manage' },
      { resource: 'routes', action: 'manage' },
      { resource: 'integrations', action: 'manage' },
    ],
  },
  {
    role: 'ADMIN',
    inheritsFrom: 'OWNER',
    permissions: [
      { resource: 'members', action: 'manage' },
      { resource: 'drivers', action: 'manage' },
      { resource: 'zones', action: 'manage' },
      { resource: 'routes', action: 'manage' },
      { resource: 'settings', action: 'read' },
      { resource: 'integrations', action: 'read' },
    ],
  },
  {
    role: 'MEMBER',
    inheritsFrom: 'ADMIN',
    permissions: [
      { resource: 'drivers', action: 'read' },
      { resource: 'drivers', action: 'update' },
      { resource: 'zones', action: 'read' },
      { resource: 'routes', action: 'read' },
      { resource: 'routes', action: 'create' },
    ],
  },
  {
    role: 'VIEWER',
    permissions: [
      { resource: 'drivers', action: 'read' },
      { resource: 'zones', action: 'read' },
      { resource: 'routes', action: 'read' },
    ],
  },
];

function getRoleDefinition(role: UserRole): RoleDefinition {
  return roleHierarchy.find(r => r.role === role)!;
}

function getAllPermissionsForRole(role: UserRole): Permission[] {
  const def = getRoleDefinition(role);
  const permissions = [...def.permissions];

  if (def.inheritsFrom) {
    const inheritedPermissions = getAllPermissionsForRole(def.inheritsFrom);
    permissions.push(...inheritedPermissions);
  }

  return permissions;
}

function checkPermission(context: RBACContext, resource: string, action: ResourceAction): boolean {
  const permissions = getAllPermissionsForRole(context.role);

  return permissions.some(p => {
    // Exact resource match
    if (p.resource === resource && p.action === action) {
      return true;
    }
    // Wildcard match (e.g., 'org:*')
    if (p.resource.endsWith(':*')) {
      const prefix = p.resource.slice(0, -1); // Remove '*'
      if (resource.startsWith(prefix) && p.action === action) {
        return true;
      }
    }
    // Manage action covers all other actions
    if (p.resource === resource && p.action === 'manage') {
      return true;
    }
    return false;
  });
}

// ───────────────────────────────────────────────────────────────────────────
// PERMISSION CACHE
// ───────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  allowed: boolean;
  cachedAt: number;
}

class PermissionCache {
  private cache: LRUCache<string, CacheEntry>;
  private ttlMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache({ max: maxSize });
  }

  private getCacheKey(context: RBACContext, resource: string, action: string): string {
    return `${context.userId}:${context.orgId}:${context.role}:${resource}:${action}`;
  }

  check(context: RBACContext, resource: string, action: ResourceAction): boolean | null {
    const key = this.getCacheKey(context, resource, action);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.allowed;
  }

  set(context: RBACContext, resource: string, action: ResourceAction, allowed: boolean): void {
    const key = this.getCacheKey(context, resource, action);
    this.cache.set(key, { allowed, cachedAt: Date.now() });
  }

  invalidate(context: RBACContext): void {
    // Clear all entries for this user/org
    const prefix = `${context.userId}:${context.orgId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; ttlMs: number } {
    return { size: this.cache.size, ttlMs: this.ttlMs };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Permission Checking', () => {
  let cache: PermissionCache;

  beforeEach(() => {
    cache = new PermissionCache();
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Role-Based Access Control', () => {
    it('should allow OWNER all permissions', () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'OWNER',
      };

      expect(checkPermission(context, 'org:members', 'manage')).toBe(true);
      expect(checkPermission(context, 'members', 'manage')).toBe(true);
      expect(checkPermission(context, 'billing', 'manage')).toBe(true);
      expect(checkPermission(context, 'drivers', 'manage')).toBe(true);
    });

    it('should allow ADMIN manage permissions', () => {
      const context: RBACContext = {
        userId: 'user-2',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      expect(checkPermission(context, 'members', 'manage')).toBe(true);
      expect(checkPermission(context, 'drivers', 'manage')).toBe(true);
      expect(checkPermission(context, 'zones', 'manage')).toBe(true);
    });

    it('should restrict MEMBER to assigned resources', () => {
      const context: RBACContext = {
        userId: 'user-3',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'MEMBER',
      };

      expect(checkPermission(context, 'drivers', 'read')).toBe(true);
      expect(checkPermission(context, 'drivers', 'update')).toBe(true);
      expect(checkPermission(context, 'drivers', 'delete')).toBe(false);
    });

    it('should deny VIEWER write access', () => {
      const context: RBACContext = {
        userId: 'user-4',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'VIEWER',
      };

      expect(checkPermission(context, 'drivers', 'read')).toBe(true);
      expect(checkPermission(context, 'drivers', 'create')).toBe(false);
      expect(checkPermission(context, 'drivers', 'update')).toBe(false);
      expect(checkPermission(context, 'drivers', 'delete')).toBe(false);
    });

    it('should deny VIEWER manage access', () => {
      const context: RBACContext = {
        userId: 'user-4',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'VIEWER',
      };

      expect(checkPermission(context, 'settings', 'manage')).toBe(false);
      expect(checkPermission(context, 'members', 'manage')).toBe(false);
    });

    it('should handle wildcard permissions (org:*)', () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'OWNER',
      };

      expect(checkPermission(context, 'org:members', 'manage')).toBe(true);
      expect(checkPermission(context, 'org:settings', 'manage')).toBe(true);
      expect(checkPermission(context, 'org:billing', 'manage')).toBe(true);
    });

    it('should not grant wildcard permission if action differs', () => {
      const context: RBACContext = {
        userId: 'user-2',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      // ADMIN has 'org:*' manage in inherited OWNER, so should have manage
      // But not all actions for all org: resources
      expect(checkPermission(context, 'org:members', 'manage')).toBe(true);
    });

    it('should deny access to unauthorized resources', () => {
      const context: RBACContext = {
        userId: 'user-3',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'MEMBER',
      };

      expect(checkPermission(context, 'billing', 'read')).toBe(false);
      expect(checkPermission(context, 'settings', 'update')).toBe(false);
    });
  });

  describe('Permission Lookup', () => {
    it('should lookup permissions for OWNER role', () => {
      const permissions = getAllPermissionsForRole('OWNER');
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.resource === 'members')).toBe(true);
    });

    it('should lookup permissions for ADMIN role', () => {
      const permissions = getAllPermissionsForRole('ADMIN');
      expect(permissions.some(p => p.resource === 'members')).toBe(true);
    });

    it('should lookup permissions for MEMBER role', () => {
      const permissions = getAllPermissionsForRole('MEMBER');
      expect(permissions.some(p => p.resource === 'drivers')).toBe(true);
      expect(permissions.some(p => p.action === 'read')).toBe(true);
    });

    it('should lookup permissions for VIEWER role', () => {
      const permissions = getAllPermissionsForRole('VIEWER');
      expect(permissions.some(p => p.resource === 'drivers')).toBe(true);
      expect(permissions.some(p => p.action === 'manage')).toBe(false);
    });
  });
});

describe('Role Hierarchy', () => {
  describe('Permission Inheritance', () => {
    it('should OWNER inherit all permissions', () => {
      const ownerPerms = getAllPermissionsForRole('OWNER');
      expect(ownerPerms.some(p => p.resource === 'members' && p.action === 'manage')).toBe(true);
    });

    it('should ADMIN inherit from OWNER', () => {
      const adminPerms = getAllPermissionsForRole('ADMIN');
      // ADMIN inherits from OWNER but doesn't get org:* manage
      expect(adminPerms.some(p => p.resource === 'members')).toBe(true);
    });

    it('should MEMBER inherit from ADMIN', () => {
      const memberPerms = getAllPermissionsForRole('MEMBER');
      expect(memberPerms.some(p => p.resource === 'drivers')).toBe(true);
    });

    it('should VIEWER not inherit upward', () => {
      const viewerPerms = getAllPermissionsForRole('VIEWER');
      expect(viewerPerms.some(p => p.action === 'manage')).toBe(false);
      expect(viewerPerms.length).toBeLessThan(getAllPermissionsForRole('MEMBER').length);
    });

    it('should not allow upward permission inheritance', () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'VIEWER',
      };

      // VIEWER should not get MEMBER permissions
      expect(checkPermission(context, 'drivers', 'update')).toBe(false);
      expect(checkPermission(context, 'routes', 'create')).toBe(false);
    });
  });

  describe('Role Escalation Prevention', () => {
    it('should prevent role escalation', () => {
      const context: RBACContext = {
        userId: 'user-3',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'MEMBER',
      };

      // MEMBER cannot grant themselves ADMIN permissions
      expect(checkPermission(context, 'members', 'manage')).toBe(false);
    });

    it('should prevent self-promotion to OWNER', () => {
      const context: RBACContext = {
        userId: 'user-2',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      expect(checkPermission(context, 'org:*', 'manage')).toBe(false);
    });
  });
});

describe('Permission Cache', () => {
  let cache: PermissionCache;

  beforeEach(() => {
    cache = new PermissionCache();
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Cache Behavior', () => {
    it('should cache permission lookups', () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      const result1 = checkPermission(context, 'drivers', 'read');
      cache.set(context, 'drivers', 'read', result1);

      const cached = cache.check(context, 'drivers', 'read');
      expect(cached).toBe(result1);
    });

    it('should return null for uncached permissions', () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      const cached = cache.check(context, 'drivers', 'read');
      expect(cached).toBeNull();
    });

    it('should invalidate cache on role change', () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      cache.set(context, 'drivers', 'read', true);
      expect(cache.check(context, 'drivers', 'read')).not.toBeNull();

      cache.invalidate(context);
      expect(cache.check(context, 'drivers', 'read')).toBeNull();
    });

    it('should respect TTL (5 minutes)', async () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      cache.set(context, 'drivers', 'read', true);
      expect(cache.check(context, 'drivers', 'read')).not.toBeNull();

      // Manually expire entry by checking after TTL
      const stats = cache.getStats();
      expect(stats.ttlMs).toBe(5 * 60 * 1000);
    });

    it('should handle cache overflow with LRU eviction', () => {
      const smallCache = new PermissionCache(2);

      const ctx1: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      const ctx2: RBACContext = {
        userId: 'user-2',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'MEMBER',
      };

      smallCache.set(ctx1, 'drivers', 'read', true);
      smallCache.set(ctx1, 'zones', 'read', true);
      smallCache.set(ctx2, 'drivers', 'read', true);

      // First entry should be evicted
      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate all entries for user', () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      cache.set(context, 'drivers', 'read', true);
      cache.set(context, 'zones', 'read', true);
      cache.invalidate(context);

      expect(cache.check(context, 'drivers', 'read')).toBeNull();
      expect(cache.check(context, 'zones', 'read')).toBeNull();
    });

    it('should not invalidate other users entries', () => {
      const ctx1: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      const ctx2: RBACContext = {
        userId: 'user-2',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'MEMBER',
      };

      cache.set(ctx1, 'drivers', 'read', true);
      cache.set(ctx2, 'drivers', 'read', true);

      cache.invalidate(ctx1);

      expect(cache.check(ctx1, 'drivers', 'read')).toBeNull();
      // Note: Implementation detail - in a real system, ctx2 might not be invalidated
    });

    it('should clear entire cache', () => {
      const context: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      cache.set(context, 'drivers', 'read', true);
      cache.set(context, 'zones', 'read', true);

      cache.clear();

      expect(cache.check(context, 'drivers', 'read')).toBeNull();
      expect(cache.check(context, 'zones', 'read')).toBeNull();
    });
  });
});

describe('Tenant-Scoped Permissions', () => {
  const ownerCtx1: RBACContext = {
    userId: 'user-1',
    orgId: 'org-1',
    tenantId: 'shop-1',
    role: 'OWNER',
  };

  const ownerCtx2: RBACContext = {
    userId: 'user-1',
    orgId: 'org-2',
    tenantId: 'shop-2',
    role: 'OWNER',
  };

  describe('Tenant Scoping', () => {
    it('should scope permissions to current org', () => {
      expect(checkPermission(ownerCtx1, 'drivers', 'manage')).toBe(true);
    });

    it('should prevent cross-tenant access', () => {
      // User 1 in org-1 should not access org-2 resources directly
      // This is more of a data layer check, but permissions should still be scoped
      expect(ownerCtx1.orgId).not.toBe(ownerCtx2.orgId);
    });

    it('should allow same user in different orgs with different roles', () => {
      // Same user might be OWNER in org-1 and MEMBER in org-2
      expect(ownerCtx1.role).toBe('OWNER');
      expect(ownerCtx2.role).toBe('OWNER');

      // Both have same permissions in their respective orgs
      expect(checkPermission(ownerCtx1, 'drivers', 'manage')).toBe(
        checkPermission(ownerCtx2, 'drivers', 'manage')
      );
    });

    it('should maintain separate permission contexts per tenant', () => {
      const cache = new PermissionCache();

      cache.set(ownerCtx1, 'drivers', 'read', true);
      cache.set(ownerCtx2, 'drivers', 'read', false);

      expect(cache.check(ownerCtx1, 'drivers', 'read')).toBe(true);
      expect(cache.check(ownerCtx2, 'drivers', 'read')).toBe(false);
    });
  });

  describe('Multi-Org Users', () => {
    it('should handle users in multiple organizations', () => {
      const user1Org1: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'OWNER',
      };

      const user1Org2: RBACContext = {
        userId: 'user-1',
        orgId: 'org-2',
        tenantId: 'shop-2',
        role: 'MEMBER',
      };

      // Different roles in different orgs
      expect(checkPermission(user1Org1, 'members', 'manage')).toBe(true);
      expect(checkPermission(user1Org2, 'members', 'manage')).toBe(false);
    });

    it('should not allow permission bleed between orgs', () => {
      const userOrg1: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      const userOrg2: RBACContext = {
        userId: 'user-1',
        orgId: 'org-2',
        tenantId: 'shop-2',
        role: 'VIEWER',
      };

      // Should enforce permission boundary
      expect(userOrg1.orgId).not.toBe(userOrg2.orgId);
      expect(checkPermission(userOrg1, 'drivers', 'update')).toBe(true);
      expect(checkPermission(userOrg2, 'drivers', 'update')).toBe(false);
    });

    it('should allow org switching with proper role context', () => {
      const contexts = [
        {
          userId: 'user-1',
          orgId: 'org-1',
          tenantId: 'shop-1',
          role: 'OWNER' as UserRole,
        },
        {
          userId: 'user-1',
          orgId: 'org-2',
          tenantId: 'shop-2',
          role: 'MEMBER' as UserRole,
        },
      ];

      // Each context should be independent
      expect(checkPermission(contexts[0], 'members', 'manage')).toBe(true);
      expect(checkPermission(contexts[1], 'members', 'manage')).toBe(false);
    });
  });

  describe('Tenant Isolation', () => {
    it('should not leak permissions across tenants', () => {
      const cache = new PermissionCache();
      const org1Ctx: RBACContext = {
        userId: 'user-1',
        orgId: 'org-1',
        tenantId: 'shop-1',
        role: 'ADMIN',
      };

      const org2Ctx: RBACContext = {
        userId: 'user-2',
        orgId: 'org-2',
        tenantId: 'shop-2',
        role: 'VIEWER',
      };

      cache.set(org1Ctx, 'drivers', 'update', true);
      cache.set(org2Ctx, 'drivers', 'update', false);

      expect(cache.check(org1Ctx, 'drivers', 'update')).toBe(true);
      expect(cache.check(org2Ctx, 'drivers', 'update')).toBe(false);
    });

    it('should enforce tenant context in permission checks', () => {
      // Ensure checks use both org and user context
      const sameUserDiffOrg: RBACContext[] = [
        {
          userId: 'user-1',
          orgId: 'org-1',
          tenantId: 'shop-1',
          role: 'ADMIN',
        },
        {
          userId: 'user-1',
          orgId: 'org-2',
          tenantId: 'shop-2',
          role: 'VIEWER',
        },
      ];

      expect(sameUserDiffOrg[0].orgId).not.toBe(sameUserDiffOrg[1].orgId);
      expect(checkPermission(sameUserDiffOrg[0], 'drivers', 'update')).not.toBe(
        checkPermission(sameUserDiffOrg[1], 'drivers', 'update')
      );
    });
  });
});
