/**
 * RBAC Role Manager
 * Manages role creation, assignment, and permission calculation
 */

import {
  Role,
  Permission,
  UserRole,
  BuiltInRoles,
  DEFAULT_PERMISSIONS,
  ROLE_HIERARCHY,
  RoleNotFoundError,
  RoleImmutableError,
  InvalidPermissionError,
} from './types';
import { PolicyEngine } from './policy-engine';

/**
 * RoleManager
 * Manages roles and user role assignments
 */
export class RoleManager {
  // In-memory role storage (in production, use database)
  private roles: Map<string, Role> = new Map();
  private userRoles: Map<string, UserRole[]> = new Map(); // userId -> roles
  private policyEngine: PolicyEngine;

  constructor(policyEngine: PolicyEngine) {
    this.policyEngine = policyEngine;
    this.initializeBuiltInRoles();
  }

  /**
   * Initialize built-in roles
   * Called during construction
   * @private
   */
  private initializeBuiltInRoles(): void {
    const builtInRoles: BuiltInRoles[] = [
      BuiltInRoles.OWNER,
      BuiltInRoles.ADMIN,
      BuiltInRoles.MANAGER,
      BuiltInRoles.DISPATCHER,
      BuiltInRoles.DRIVER,
      BuiltInRoles.VIEWER,
    ];

    for (const roleName of builtInRoles) {
      const role: Role = {
        id: roleName,
        name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
        description: `Built-in ${roleName} role`,
        permissions: DEFAULT_PERMISSIONS[roleName],
        isSystem: true,
        createdAt: new Date(),
      };
      this.roles.set(roleName, role);
    }
  }

  /**
   * Create a new custom role
   * @throws InvalidPermissionError if permissions are invalid
   */
  async createRole(
    tenantId: string,
    name: string,
    permissions: Permission[],
    description?: string,
  ): Promise<Role> {
    // Validate permissions
    this.validatePermissions(permissions);

    // Generate unique role ID
    const roleId = `role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const role: Role = {
      id: roleId,
      name,
      description,
      permissions,
      isSystem: false,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.roles.set(roleId, role);
    return role;
  }

  /**
   * Update an existing custom role
   * @throws RoleImmutableError if trying to modify a built-in role
   * @throws RoleNotFoundError if role doesn't exist
   */
  async updateRole(
    roleId: string,
    updates: {
      name?: string;
      description?: string;
      permissions?: Permission[];
    },
  ): Promise<Role> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    // Prevent modification of built-in roles
    if (role.isSystem) {
      throw new RoleImmutableError(roleId);
    }

    // Validate new permissions if provided
    if (updates.permissions) {
      this.validatePermissions(updates.permissions);
    }

    // Update role
    const updatedRole: Role = {
      ...role,
      ...updates,
      updatedAt: new Date(),
    };

    this.roles.set(roleId, updatedRole);

    // Invalidate affected user caches
    this.invalidateRoleCache(roleId);

    return updatedRole;
  }

  /**
   * Delete a custom role
   * @throws RoleImmutableError if trying to delete a built-in role
   * @throws RoleNotFoundError if role doesn't exist
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    // Prevent deletion of built-in roles
    if (role.isSystem) {
      throw new RoleImmutableError(roleId);
    }

    // Remove role
    this.roles.delete(roleId);

    // Invalidate cache
    this.invalidateRoleCache(roleId);
  }

  /**
   * Assign a role to a user
   */
  async assignRoleToUser(
    userId: string,
    tenantId: string,
    roleId: string,
    expiresAt?: Date,
  ): Promise<UserRole> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    const userRoleId = `ur-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const userRole: UserRole = {
      id: userRoleId,
      userId,
      roleId,
      tenantId,
      assignedAt: new Date(),
      expiresAt,
    };

    // Store user role assignment
    const key = `${tenantId}:${userId}`;
    if (!this.userRoles.has(key)) {
      this.userRoles.set(key, []);
    }
    this.userRoles.get(key)!.push(userRole);

    // Invalidate user's permission cache
    this.policyEngine.invalidateCache(userId, tenantId);

    return userRole;
  }

  /**
   * Remove a role from a user
   */
  async removeRoleFromUser(userId: string, tenantId: string, roleId: string): Promise<void> {
    const key = `${tenantId}:${userId}`;
    const userRoles = this.userRoles.get(key);

    if (userRoles) {
      const filtered = userRoles.filter((ur) => ur.roleId !== roleId);
      if (filtered.length === 0) {
        this.userRoles.delete(key);
      } else {
        this.userRoles.set(key, filtered);
      }
    }

    // Invalidate user's permission cache
    this.policyEngine.invalidateCache(userId, tenantId);
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(userId: string, tenantId: string): Promise<Role[]> {
    const key = `${tenantId}:${userId}`;
    const userRoleAssignments = this.userRoles.get(key) || [];

    // Filter out expired roles
    const now = new Date();
    const activeRoles = userRoleAssignments.filter(
      (ur) => !ur.expiresAt || ur.expiresAt > now,
    );

    return activeRoles
      .map((ur) => this.roles.get(ur.roleId))
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Get effective permissions for a user
   * Merges permissions from all assigned roles
   */
  async getEffectivePermissions(userId: string, tenantId: string): Promise<Permission[]> {
    // Check cache first
    const cachedPermissions = this.policyEngine.getCachedPermissions(userId, tenantId);
    if (cachedPermissions) {
      return cachedPermissions;
    }

    // Get user's roles
    const userRoles = await this.getUserRoles(userId, tenantId);

    // Merge permissions from all roles
    const permissionsMap = new Map<string, Permission>();

    for (const role of userRoles) {
      for (const permission of role.permissions) {
        const key = `${permission.resource}:${permission.action}`;
        // Later permissions override earlier ones
        permissionsMap.set(key, permission);
      }
    }

    const effectivePermissions = Array.from(permissionsMap.values());

    // Cache the permissions
    this.policyEngine.cachePermissions(userId, tenantId, effectivePermissions);

    return effectivePermissions;
  }

  /**
   * Get a role by ID
   */
  async getRole(roleId: string): Promise<Role | undefined> {
    return this.roles.get(roleId);
  }

  /**
   * Get all roles (for admin purposes)
   */
  async getAllRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  /**
   * Validate permissions array
   * @private
   */
  private validatePermissions(permissions: Permission[]): void {
    if (!Array.isArray(permissions)) {
      throw new InvalidPermissionError('Permissions must be an array');
    }

    for (const permission of permissions) {
      if (!permission.resource) {
        throw new InvalidPermissionError('Permission must have a resource');
      }
      if (!permission.action) {
        throw new InvalidPermissionError('Permission must have an action');
      }
      if (typeof permission.resource !== 'string') {
        throw new InvalidPermissionError('Permission resource must be a string');
      }
      if (typeof permission.action !== 'string') {
        throw new InvalidPermissionError('Permission action must be a string');
      }
    }
  }

  /**
   * Invalidate cache for all users with a specific role
   * @private
   */
  private invalidateRoleCache(roleId: string): void {
    for (const [key, userRoles] of this.userRoles.entries()) {
      if (userRoles.some((ur) => ur.roleId === roleId)) {
        const [tenantId, userId] = key.split(':');
        this.policyEngine.invalidateCache(userId, tenantId);
      }
    }
  }

  /**
   * Check if a user has a specific role
   */
  async hasRole(userId: string, tenantId: string, roleId: string): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId, tenantId);
    return userRoles.some((role) => role.id === roleId);
  }

  /**
   * Compare role hierarchy
   * Returns -1 if role1 < role2, 0 if equal, 1 if role1 > role2
   */
  compareRoleHierarchy(roleId1: string, roleId2: string): number {
    const level1 = ROLE_HIERARCHY[roleId1] || 0;
    const level2 = ROLE_HIERARCHY[roleId2] || 0;

    if (level1 < level2) return -1;
    if (level1 > level2) return 1;
    return 0;
  }
}

/**
 * Create a role manager instance with a policy engine
 */
export function createRoleManager(policyEngine: PolicyEngine): RoleManager {
  return new RoleManager(policyEngine);
}
