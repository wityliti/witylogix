/**
 * RBAC (Role-Based Access Control) System — Type Definitions
 * Defines roles, permissions, resources, and actions for access control
 */

/**
 * Resources enum
 * Represents all resources that can be protected by RBAC
 */
export enum Resources {
  ORDERS = 'orders',
  SHIPMENTS = 'shipments',
  ROUTES = 'routes',
  DRIVERS = 'drivers',
  CUSTOMERS = 'customers',
  SETTINGS = 'settings',
  BILLING = 'billing',
  ANALYTICS = 'analytics',
  INTEGRATIONS = 'integrations',
  ZONES = 'zones',
  PRODUCTS = 'products',
  INVENTORY = 'inventory',
  CAMPAIGNS = 'campaigns',
  SUPPORT = 'support',
}

/**
 * Actions enum
 * Represents the actions that can be performed on resources
 */
export enum Actions {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage', // Full control (create, read, update, delete)
  EXPORT = 'export',
  IMPORT = 'import',
}

/**
 * Built-in roles enum
 * Predefined role names for common use cases
 */
export enum BuiltInRoles {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  DISPATCHER = 'dispatcher',
  DRIVER = 'driver',
  VIEWER = 'viewer',
}

/**
 * Permission object
 * Defines a specific permission: resource + action + optional conditions
 */
export interface Permission {
  resource: Resources | string; // Allow wildcards like 'orders:*'
  action: Actions | string; // Allow wildcards like '*'
  conditions?: Record<string, any>; // Optional context-specific conditions
  metadata?: Record<string, any>; // Additional permission metadata
}

/**
 * Role definition
 * Defines a role with associated permissions and metadata
 */
export interface Role {
  id: string; // Unique role identifier (e.g., 'owner', 'custom-role-1')
  name: string; // Human-readable role name
  description?: string;
  permissions: Permission[];
  isSystem: boolean; // If true, role cannot be deleted (built-in roles)
  tenantId?: string; // For multi-tenant systems
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * User role assignment
 * Associates a user with a role within a tenant
 */
export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  tenantId: string;
  assignedAt: Date;
  expiresAt?: Date; // Optional expiration for temporary roles
  metadata?: Record<string, any>;
}

/**
 * Permission check context
 * Additional context for evaluating permission conditions
 */
export interface PermissionContext {
  userId: string;
  tenantId: string;
  resourceId?: string; // ID of the specific resource being accessed
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  [key: string]: any; // Additional custom context
}

/**
 * Role hierarchy
 * Defines the order of role elevation (higher = more permissions)
 * Used for role comparison and inheritance
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  [BuiltInRoles.OWNER]: 6,
  [BuiltInRoles.ADMIN]: 5,
  [BuiltInRoles.MANAGER]: 4,
  [BuiltInRoles.DISPATCHER]: 3,
  [BuiltInRoles.DRIVER]: 2,
  [BuiltInRoles.VIEWER]: 1,
};

/**
 * Default permissions for built-in roles
 * Defines what each built-in role can do
 */
export const DEFAULT_PERMISSIONS: Record<BuiltInRoles, Permission[]> = {
  [BuiltInRoles.OWNER]: [
    // Owner has full control over everything
    { resource: '*', action: '*' },
  ],
  [BuiltInRoles.ADMIN]: [
    // Admin has full control over most resources except billing
    { resource: Resources.ORDERS, action: Actions.MANAGE },
    { resource: Resources.SHIPMENTS, action: Actions.MANAGE },
    { resource: Resources.ROUTES, action: Actions.MANAGE },
    { resource: Resources.DRIVERS, action: Actions.MANAGE },
    { resource: Resources.CUSTOMERS, action: Actions.MANAGE },
    { resource: Resources.SETTINGS, action: Actions.MANAGE },
    { resource: Resources.ANALYTICS, action: Actions.READ },
    { resource: Resources.INTEGRATIONS, action: Actions.MANAGE },
    { resource: Resources.ZONES, action: Actions.MANAGE },
    { resource: Resources.PRODUCTS, action: Actions.MANAGE },
    { resource: Resources.INVENTORY, action: Actions.MANAGE },
    { resource: Resources.CAMPAIGNS, action: Actions.MANAGE },
    { resource: Resources.SUPPORT, action: Actions.READ },
    // Limited billing access
    { resource: Resources.BILLING, action: Actions.READ },
  ],
  [BuiltInRoles.MANAGER]: [
    // Manager oversees operations but cannot modify critical settings
    { resource: Resources.ORDERS, action: Actions.MANAGE },
    { resource: Resources.SHIPMENTS, action: Actions.MANAGE },
    { resource: Resources.ROUTES, action: Actions.READ },
    { resource: Resources.DRIVERS, action: Actions.READ },
    { resource: Resources.DRIVERS, action: Actions.UPDATE },
    { resource: Resources.CUSTOMERS, action: Actions.READ },
    { resource: Resources.ANALYTICS, action: Actions.READ },
    { resource: Resources.ZONES, action: Actions.READ },
    { resource: Resources.PRODUCTS, action: Actions.READ },
    { resource: Resources.INVENTORY, action: Actions.MANAGE },
    { resource: Resources.CAMPAIGNS, action: Actions.READ },
    { resource: Resources.SUPPORT, action: Actions.READ },
  ],
  [BuiltInRoles.DISPATCHER]: [
    // Dispatcher manages routes and driver assignments
    { resource: Resources.ORDERS, action: Actions.READ },
    { resource: Resources.SHIPMENTS, action: Actions.READ },
    { resource: Resources.SHIPMENTS, action: Actions.UPDATE },
    { resource: Resources.ROUTES, action: Actions.MANAGE },
    { resource: Resources.DRIVERS, action: Actions.READ },
    { resource: Resources.DRIVERS, action: Actions.UPDATE },
    { resource: Resources.ANALYTICS, action: Actions.READ },
    { resource: Resources.ZONES, action: Actions.READ },
  ],
  [BuiltInRoles.DRIVER]: [
    // Driver can only read their own shipments and routes
    { resource: Resources.ORDERS, action: Actions.READ },
    { resource: Resources.SHIPMENTS, action: Actions.READ },
    { resource: Resources.ROUTES, action: Actions.READ },
    { resource: Resources.ZONES, action: Actions.READ },
  ],
  [BuiltInRoles.VIEWER]: [
    // Viewer has read-only access to most resources
    { resource: Resources.ORDERS, action: Actions.READ },
    { resource: Resources.SHIPMENTS, action: Actions.READ },
    { resource: Resources.ROUTES, action: Actions.READ },
    { resource: Resources.DRIVERS, action: Actions.READ },
    { resource: Resources.CUSTOMERS, action: Actions.READ },
    { resource: Resources.ANALYTICS, action: Actions.READ },
    { resource: Resources.ZONES, action: Actions.READ },
    { resource: Resources.PRODUCTS, action: Actions.READ },
    { resource: Resources.INVENTORY, action: Actions.READ },
  ],
};

/**
 * RBAC Errors
 */
export class RBACError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'RBACError';
  }
}

export class PermissionDeniedError extends RBACError {
  constructor(message: string = 'Permission denied') {
    super('PERMISSION_DENIED', message, 403);
    this.name = 'PermissionDeniedError';
  }
}

export class RoleNotFoundError extends RBACError {
  constructor(roleId: string) {
    super('ROLE_NOT_FOUND', `Role not found: ${roleId}`, 404);
    this.name = 'RoleNotFoundError';
  }
}

export class RoleImmutableError extends RBACError {
  constructor(roleId: string) {
    super('ROLE_IMMUTABLE', `Built-in role cannot be modified: ${roleId}`, 400);
    this.name = 'RoleImmutableError';
  }
}

export class InvalidPermissionError extends RBACError {
  constructor(message: string = 'Invalid permission specification') {
    super('INVALID_PERMISSION', message, 400);
    this.name = 'InvalidPermissionError';
  }
}
