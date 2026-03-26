/**
 * RBAC Policy Engine Tests
 * Comprehensive test suite covering permission checks, role hierarchy, wildcards, caching, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PolicyEngine,
  Permission,
  PermissionContext,
  PermissionDeniedError,
  Resources,
  Actions,
  BuiltInRoles,
  DEFAULT_PERMISSIONS,
} from '../index';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  afterEach(() => {
    engine.clearAllCache();
  });

  describe('Basic Permission Checks', () => {
    it('should allow basic exact permission match', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ);
      expect(result).toBe(true);
    });

    it('should deny permission when not in list', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const result = engine.can(permissions, Resources.ORDERS, Actions.DELETE);
      expect(result).toBe(false);
    });

    it('should deny permission for different resource', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const result = engine.can(permissions, Resources.SHIPMENTS, Actions.READ);
      expect(result).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      const result = engine.can([], Resources.ORDERS, Actions.READ);
      expect(result).toBe(false);
    });

    it('should return false for null permissions', () => {
      const result = engine.can(null as any, Resources.ORDERS, Actions.READ);
      expect(result).toBe(false);
    });
  });

  describe('Wildcard Permissions', () => {
    it('should grant all actions with * wildcard', () => {
      const permissions: Permission[] = [{ resource: Resources.ORDERS, action: '*' }];

      expect(engine.can(permissions, Resources.ORDERS, Actions.READ)).toBe(true);
      expect(engine.can(permissions, Resources.ORDERS, Actions.CREATE)).toBe(true);
      expect(engine.can(permissions, Resources.ORDERS, Actions.UPDATE)).toBe(true);
      expect(engine.can(permissions, Resources.ORDERS, Actions.DELETE)).toBe(true);
      expect(engine.can(permissions, Resources.ORDERS, Actions.EXPORT)).toBe(true);
    });

    it('should grant all resources with * wildcard', () => {
      const permissions: Permission[] = [{ resource: '*', action: Actions.READ }];

      expect(engine.can(permissions, Resources.ORDERS, Actions.READ)).toBe(true);
      expect(engine.can(permissions, Resources.SHIPMENTS, Actions.READ)).toBe(true);
      expect(engine.can(permissions, Resources.DRIVERS, Actions.READ)).toBe(true);
      expect(engine.can(permissions, 'custom_resource', Actions.READ)).toBe(true);
    });

    it('should grant all resources and actions with * wildcard', () => {
      const permissions: Permission[] = [{ resource: '*', action: '*' }];

      expect(engine.can(permissions, Resources.ORDERS, Actions.READ)).toBe(true);
      expect(engine.can(permissions, Resources.SHIPMENTS, Actions.CREATE)).toBe(true);
      expect(engine.can(permissions, 'anything', 'anything')).toBe(true);
    });

    it('should handle resource:* wildcard pattern', () => {
      const permissions: Permission[] = [{ resource: 'orders:*', action: Actions.READ }];

      expect(engine.can(permissions, 'orders', Actions.READ)).toBe(true);
      expect(engine.can(permissions, 'orders:pending', Actions.READ)).toBe(true);
      expect(engine.can(permissions, 'orders:completed', Actions.READ)).toBe(true);
      expect(engine.can(permissions, Resources.SHIPMENTS, Actions.READ)).toBe(false);
    });

    it('should grant all permissions with manage action', () => {
      const permissions: Permission[] = [{ resource: Resources.ORDERS, action: 'manage' }];

      expect(engine.can(permissions, Resources.ORDERS, Actions.READ)).toBe(true);
      expect(engine.can(permissions, Resources.ORDERS, Actions.CREATE)).toBe(true);
      expect(engine.can(permissions, Resources.ORDERS, Actions.UPDATE)).toBe(true);
      expect(engine.can(permissions, Resources.ORDERS, Actions.DELETE)).toBe(true);
      expect(engine.can(permissions, Resources.ORDERS, Actions.EXPORT)).toBe(true);
    });
  });

  describe('Role Hierarchy', () => {
    it('owner can do everything', () => {
      const ownerPerms = DEFAULT_PERMISSIONS[BuiltInRoles.OWNER];

      expect(engine.can(ownerPerms, Resources.ORDERS, Actions.READ)).toBe(true);
      expect(engine.can(ownerPerms, Resources.ORDERS, Actions.CREATE)).toBe(true);
      expect(engine.can(ownerPerms, Resources.BILLING, Actions.DELETE)).toBe(true);
      expect(engine.can(ownerPerms, 'anything', 'anything')).toBe(true);
    });

    it('admin has most permissions except billing', () => {
      const adminPerms = DEFAULT_PERMISSIONS[BuiltInRoles.ADMIN];

      expect(engine.can(adminPerms, Resources.ORDERS, Actions.MANAGE)).toBe(true);
      expect(engine.can(adminPerms, Resources.DRIVERS, Actions.MANAGE)).toBe(true);
      expect(engine.can(adminPerms, Resources.BILLING, Actions.READ)).toBe(true);
      expect(engine.can(adminPerms, Resources.BILLING, Actions.DELETE)).toBe(false);
    });

    it('viewer has only read permissions', () => {
      const viewerPerms = DEFAULT_PERMISSIONS[BuiltInRoles.VIEWER];

      expect(engine.can(viewerPerms, Resources.ORDERS, Actions.READ)).toBe(true);
      expect(engine.can(viewerPerms, Resources.ORDERS, Actions.CREATE)).toBe(false);
      expect(engine.can(viewerPerms, Resources.ORDERS, Actions.UPDATE)).toBe(false);
      expect(engine.can(viewerPerms, Resources.ORDERS, Actions.DELETE)).toBe(false);
    });

    it('driver has limited read permissions', () => {
      const driverPerms = DEFAULT_PERMISSIONS[BuiltInRoles.DRIVER];

      expect(engine.can(driverPerms, Resources.SHIPMENTS, Actions.READ)).toBe(true);
      expect(engine.can(driverPerms, Resources.ORDERS, Actions.READ)).toBe(true);
      expect(engine.can(driverPerms, Resources.ORDERS, Actions.CREATE)).toBe(false);
      expect(engine.can(driverPerms, Resources.SETTINGS, Actions.READ)).toBe(false);
    });

    it('dispatcher can manage routes', () => {
      const dispatcherPerms = DEFAULT_PERMISSIONS[BuiltInRoles.DISPATCHER];

      expect(engine.can(dispatcherPerms, Resources.ROUTES, Actions.MANAGE)).toBe(true);
      expect(engine.can(dispatcherPerms, Resources.SHIPMENTS, Actions.READ)).toBe(true);
      expect(engine.can(dispatcherPerms, Resources.SHIPMENTS, Actions.UPDATE)).toBe(true);
      expect(engine.can(dispatcherPerms, Resources.SETTINGS, Actions.READ)).toBe(false);
    });
  });

  describe('canAll Method', () => {
    it('should return true when all permissions are granted', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
        { resource: Resources.ORDERS, action: Actions.CREATE },
        { resource: Resources.ORDERS, action: Actions.UPDATE },
      ];

      const required: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
        { resource: Resources.ORDERS, action: Actions.CREATE },
      ];

      const result = engine.canAll(permissions, required);
      expect(result).toBe(true);
    });

    it('should return false when any permission is missing', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
        { resource: Resources.ORDERS, action: Actions.CREATE },
      ];

      const required: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
        { resource: Resources.ORDERS, action: Actions.DELETE },
      ];

      const result = engine.canAll(permissions, required);
      expect(result).toBe(false);
    });

    it('should work with wildcard permissions', () => {
      const permissions: Permission[] = [{ resource: '*', action: '*' }];

      const required: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
        { resource: Resources.SHIPMENTS, action: Actions.CREATE },
      ];

      const result = engine.canAll(permissions, required);
      expect(result).toBe(true);
    });
  });

  describe('canAny Method', () => {
    it('should return true when at least one permission is granted', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const required: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
        { resource: Resources.ORDERS, action: Actions.DELETE },
      ];

      const result = engine.canAny(permissions, required);
      expect(result).toBe(true);
    });

    it('should return false when no permissions are granted', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const required: Permission[] = [
        { resource: Resources.SHIPMENTS, action: Actions.READ },
        { resource: Resources.ORDERS, action: Actions.DELETE },
      ];

      const result = engine.canAny(permissions, required);
      expect(result).toBe(false);
    });

    it('should return false for empty required permissions', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const result = engine.canAny(permissions, []);
      expect(result).toBe(false);
    });

    it('should return true when multiple permissions match', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
        { resource: Resources.SHIPMENTS, action: Actions.CREATE },
      ];

      const required: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.DELETE },
        { resource: Resources.SHIPMENTS, action: Actions.CREATE },
      ];

      const result = engine.canAny(permissions, required);
      expect(result).toBe(true);
    });
  });

  describe('Conditional Permissions', () => {
    it('should check conditions when provided', () => {
      const permissions: Permission[] = [
        {
          resource: Resources.ORDERS,
          action: Actions.READ,
          conditions: { tenantId: 'tenant-1' },
        },
      ];

      const context: PermissionContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
      };

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ, context);
      expect(result).toBe(true);
    });

    it('should deny when condition does not match', () => {
      const permissions: Permission[] = [
        {
          resource: Resources.ORDERS,
          action: Actions.READ,
          conditions: { tenantId: 'tenant-1' },
        },
      ];

      const context: PermissionContext = {
        userId: 'user-1',
        tenantId: 'tenant-2',
      };

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ, context);
      expect(result).toBe(false);
    });

    it('should ignore conditions when context not provided', () => {
      const permissions: Permission[] = [
        {
          resource: Resources.ORDERS,
          action: Actions.READ,
          conditions: { tenantId: 'tenant-1' },
        },
      ];

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ);
      expect(result).toBe(true);
    });

    it('should check multiple conditions', () => {
      const permissions: Permission[] = [
        {
          resource: Resources.ORDERS,
          action: Actions.UPDATE,
          conditions: { tenantId: 'tenant-1', role: 'admin' },
        },
      ];

      const context: PermissionContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'admin',
      };

      const result = engine.can(permissions, Resources.ORDERS, Actions.UPDATE, context);
      expect(result).toBe(true);
    });

    it('should deny when one condition does not match', () => {
      const permissions: Permission[] = [
        {
          resource: Resources.ORDERS,
          action: Actions.UPDATE,
          conditions: { tenantId: 'tenant-1', role: 'admin' },
        },
      ];

      const context: PermissionContext = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'viewer',
      };

      const result = engine.can(permissions, Resources.ORDERS, Actions.UPDATE, context);
      expect(result).toBe(false);
    });
  });

  describe('Permission Caching', () => {
    it('should cache permissions with TTL', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      engine.cachePermissions('user-1', 'tenant-1', permissions);

      const cached = engine.getCachedPermissions('user-1', 'tenant-1');
      expect(cached).toEqual(permissions);
    });

    it('should return null for non-existent cache', () => {
      const cached = engine.getCachedPermissions('user-1', 'tenant-1');
      expect(cached).toBeNull();
    });

    it('should invalidate cache when requested', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      engine.cachePermissions('user-1', 'tenant-1', permissions);
      engine.invalidateCache('user-1', 'tenant-1');

      const cached = engine.getCachedPermissions('user-1', 'tenant-1');
      expect(cached).toBeNull();
    });

    it('should return expired cache as null', (done) => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      engine.cachePermissions('user-1', 'tenant-1', permissions);

      // Wait for cache to expire (5 seconds)
      setTimeout(() => {
        const cached = engine.getCachedPermissions('user-1', 'tenant-1');
        expect(cached).toBeNull();
        done();
      }, 5100);
    }, { timeout: 10000 });

    it('should support cache stats', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      engine.cachePermissions('user-1', 'tenant-1', permissions);
      engine.cachePermissions('user-2', 'tenant-1', permissions);

      const stats = engine.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
      expect(stats.entries).toBeGreaterThanOrEqual(2);
    });

    it('should clear all cache', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      engine.cachePermissions('user-1', 'tenant-1', permissions);
      engine.cachePermissions('user-2', 'tenant-2', permissions);

      engine.clearAllCache();

      expect(engine.getCachedPermissions('user-1', 'tenant-1')).toBeNull();
      expect(engine.getCachedPermissions('user-2', 'tenant-2')).toBeNull();
    });

    it('should use different cache keys for different users', () => {
      const perms1: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];
      const perms2: Permission[] = [
        { resource: Resources.SHIPMENTS, action: Actions.READ },
      ];

      engine.cachePermissions('user-1', 'tenant-1', perms1);
      engine.cachePermissions('user-2', 'tenant-1', perms2);

      const cached1 = engine.getCachedPermissions('user-1', 'tenant-1');
      const cached2 = engine.getCachedPermissions('user-2', 'tenant-1');

      expect(cached1).toEqual(perms1);
      expect(cached2).toEqual(perms2);
      expect(cached1).not.toEqual(cached2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown resource', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const result = engine.can(permissions, 'unknown_resource', Actions.READ);
      expect(result).toBe(false);
    });

    it('should handle null user context', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ, null as any);
      expect(result).toBe(true);
    });

    it('should handle empty permission action', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: '' },
      ];

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ);
      expect(result).toBe(false);
    });

    it('should handle multiple matching permissions', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
        { resource: Resources.ORDERS, action: '*' },
        { resource: '*', action: Actions.READ },
      ];

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ);
      expect(result).toBe(true);
    });

    it('should handle empty metadata', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ, metadata: {} },
      ];

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ);
      expect(result).toBe(true);
    });

    it('should be case-sensitive for resources and actions', () => {
      const permissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.READ },
      ];

      const result = engine.can(permissions, 'Orders', Actions.READ);
      expect(result).toBe(false);
    });
  });

  describe('Custom Roles with Mixed Permissions', () => {
    it('should support custom role with mixed permissions', () => {
      const customPermissions: Permission[] = [
        { resource: Resources.ORDERS, action: Actions.MANAGE },
        { resource: Resources.SHIPMENTS, action: Actions.READ },
        { resource: Resources.DRIVERS, action: Actions.READ },
        { resource: Resources.DRIVERS, action: Actions.UPDATE },
        { resource: Resources.ANALYTICS, action: Actions.READ },
      ];

      expect(engine.can(customPermissions, Resources.ORDERS, Actions.CREATE)).toBe(true);
      expect(engine.can(customPermissions, Resources.SHIPMENTS, Actions.READ)).toBe(true);
      expect(engine.can(customPermissions, Resources.DRIVERS, Actions.UPDATE)).toBe(true);
      expect(engine.can(customPermissions, Resources.CUSTOMERS, Actions.READ)).toBe(false);
    });

    it('should support wildcards in custom roles', () => {
      const customPermissions: Permission[] = [
        { resource: 'orders:*', action: Actions.READ },
        { resource: 'shipments:*', action: Actions.MANAGE },
        { resource: Resources.DRIVERS, action: Actions.READ },
      ];

      expect(engine.can(customPermissions, 'orders:pending', Actions.READ)).toBe(true);
      expect(engine.can(customPermissions, 'shipments:active', Actions.CREATE)).toBe(true);
      expect(engine.can(customPermissions, Resources.DRIVERS, Actions.READ)).toBe(true);
      expect(engine.can(customPermissions, Resources.CUSTOMERS, Actions.READ)).toBe(false);
    });
  });

  describe('Complex Permission Scenarios', () => {
    it('should handle permission hierarchy correctly', () => {
      const permissions: Permission[] = [
        { resource: '*', action: Actions.READ },
        { resource: Resources.ORDERS, action: 'manage' },
      ];

      expect(engine.can(permissions, Resources.ORDERS, Actions.CREATE)).toBe(true);
      expect(engine.can(permissions, Resources.SHIPMENTS, Actions.READ)).toBe(true);
      expect(engine.can(permissions, Resources.SHIPMENTS, Actions.CREATE)).toBe(false);
    });

    it('should work with very large permission lists', () => {
      const permissions: Permission[] = [];

      // Create 100 permissions
      for (let i = 0; i < 100; i++) {
        permissions.push({
          resource: `resource-${i}`,
          action: 'read',
        });
      }

      expect(engine.can(permissions, 'resource-50', 'read')).toBe(true);
      expect(engine.can(permissions, 'resource-99', 'read')).toBe(true);
      expect(engine.can(permissions, 'resource-100', 'read')).toBe(false);
    });

    it('should handle permission with metadata correctly', () => {
      const permissions: Permission[] = [
        {
          resource: Resources.ORDERS,
          action: Actions.READ,
          metadata: { tier: 'premium', deprecated: false },
        },
      ];

      const result = engine.can(permissions, Resources.ORDERS, Actions.READ);
      expect(result).toBe(true);
    });
  });
});
