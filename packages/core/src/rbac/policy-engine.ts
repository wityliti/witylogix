/**
 * RBAC Policy Engine
 * Core permission checking logic with caching and wildcard support
 */

import {
  Permission,
  PermissionContext,
  ROLE_HIERARCHY,
  PermissionDeniedError,
} from "./types";

/**
 * Cached permission entry
 */
interface CachedPermission {
  permissions: Permission[];
  expiresAt: number; // Timestamp when cache expires
}

/**
 * PolicyEngine
 * Evaluates permissions against roles and policies
 */
export class PolicyEngine {
  private permissionCache: Map<string, CachedPermission> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {}

  /**
   * Check if a user can perform an action on a resource
   * @param permissions User's effective permissions
   * @param resource Resource to check access for
   * @param action Action to perform
   * @param context Optional permission context for condition evaluation
   * @returns true if permission is granted
   */
  can(
    permissions: Permission[],
    resource: string,
    action: string,
    context?: PermissionContext,
  ): boolean {
    if (!permissions || permissions.length === 0) {
      return false;
    }

    for (const permission of permissions) {
      if (this.permissionMatches(permission, resource, action, context)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user can perform ALL of the given permissions
   * @param permissions User's effective permissions
   * @param requiredPermissions All required permissions
   * @param context Optional permission context
   * @returns true if ALL permissions are granted
   */
  canAll(
    permissions: Permission[],
    requiredPermissions: Permission[],
    context?: PermissionContext,
  ): boolean {
    return requiredPermissions.every((required) =>
      this.can(permissions, required.resource, required.action, context),
    );
  }

  /**
   * Check if user can perform ANY of the given permissions
   * @param permissions User's effective permissions
   * @param requiredPermissions Any required permission
   * @param context Optional permission context
   * @returns true if ANY permission is granted
   */
  canAny(
    permissions: Permission[],
    requiredPermissions: Permission[],
    context?: PermissionContext,
  ): boolean {
    return requiredPermissions.some((required) =>
      this.can(permissions, required.resource, required.action, context),
    );
  }

  /**
   * Check if a single permission matches the resource and action
   * Handles wildcards: 'orders:*' or '*'
   * @private
   */
  private permissionMatches(
    permission: Permission,
    resource: string,
    action: string,
    context?: PermissionContext,
  ): boolean {
    // Check if resource matches
    if (!this.resourceMatches(permission.resource as string, resource)) {
      return false;
    }

    // Check if action matches
    if (!this.actionMatches(permission.action as string, action)) {
      return false;
    }

    // Check conditions if specified
    if (permission.conditions && context) {
      return this.conditionsMatch(permission.conditions, context);
    }

    return true;
  }

  /**
   * Check if permission resource matches requested resource
   * Supports wildcards: '*' matches all, 'orders:*' matches all orders actions
   * @private
   */
  private resourceMatches(
    permissionResource: string,
    requestedResource: string,
  ): boolean {
    // Wildcard match all resources
    if (permissionResource === "*") {
      return true;
    }

    // Exact match
    if (permissionResource === requestedResource) {
      return true;
    }

    // Wildcard resource like 'orders:*'
    if (permissionResource.endsWith(":*")) {
      const resourcePrefix = permissionResource.slice(0, -2); // Remove ':*'
      return requestedResource.startsWith(resourcePrefix);
    }

    return false;
  }

  /**
   * Check if permission action matches requested action
   * Supports wildcards: '*' matches all
   * MANAGE action grants all permissions (create, read, update, delete, export, import)
   * @private
   */
  private actionMatches(
    permissionAction: string,
    requestedAction: string,
  ): boolean {
    // Wildcard match all actions
    if (permissionAction === "*") {
      return true;
    }

    // Exact match
    if (permissionAction === requestedAction) {
      return true;
    }

    // MANAGE grants all actions
    if (permissionAction === "manage") {
      return true;
    }

    return false;
  }

  /**
   * Evaluate permission conditions against context
   * @private
   */
  private conditionsMatch(
    conditions: Record<string, any>,
    context: PermissionContext,
  ): boolean {
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const contextValue = context[key];

      // If context doesn't have the key, condition fails
      if (contextValue === undefined) {
        return false;
      }

      // Simple equality check (can be extended for complex logic)
      if (contextValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get or create a cache key for permissions
   * @private
   */
  private getCacheKey(userId: string, tenantId: string): string {
    return `${tenantId}:${userId}`;
  }

  /**
   * Cache permissions for a user
   * @internal - Used by RoleManager
   */
  cachePermissions(
    userId: string,
    tenantId: string,
    permissions: Permission[],
  ): void {
    const key = this.getCacheKey(userId, tenantId);
    this.permissionCache.set(key, {
      permissions,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  /**
   * Get cached permissions if still valid
   * @internal - Used by RoleManager
   */
  getCachedPermissions(userId: string, tenantId: string): Permission[] | null {
    const key = this.getCacheKey(userId, tenantId);
    const cached = this.permissionCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache expired
    if (Date.now() > cached.expiresAt) {
      this.permissionCache.delete(key);
      return null;
    }

    return cached.permissions;
  }

  /**
   * Invalidate cached permissions for a user
   * Call after role changes
   * @internal - Used by RoleManager
   */
  invalidateCache(userId: string, tenantId: string): void {
    const key = this.getCacheKey(userId, tenantId);
    this.permissionCache.delete(key);
  }

  /**
   * Clear all cached permissions
   * Useful for testing or global invalidation
   */
  clearAllCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: number } {
    let validCount = 0;
    for (const cached of this.permissionCache.values()) {
      if (Date.now() <= cached.expiresAt) {
        validCount++;
      }
    }
    return {
      size: this.permissionCache.size,
      entries: validCount,
    };
  }
}

/**
 * Singleton instance for use across the application
 */
export const policyEngine = new PolicyEngine();
