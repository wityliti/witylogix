/**
 * RBAC Module — Role-Based Access Control
 * Main barrel exports for RBAC functionality
 */

// Types
export {
  Resources,
  Actions,
  BuiltInRoles,
  Permission,
  Role,
  UserRole,
  PermissionContext,
  ROLE_HIERARCHY,
  DEFAULT_PERMISSIONS,
  RBACError,
  PermissionDeniedError,
  RoleNotFoundError,
  RoleImmutableError,
  InvalidPermissionError,
} from "./types";

// Policy Engine
export { PolicyEngine, policyEngine } from "./policy-engine";

// Role Manager
export { RoleManager, createRoleManager } from "./role-manager";
