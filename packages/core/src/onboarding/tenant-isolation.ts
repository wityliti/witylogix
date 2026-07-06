/**
 * Tenant Isolation — Multi-tenant data isolation and scoping.
 *
 * This module provides:
 * - TenantContext class for request-scoped tenant info
 * - Tenant context creation from JWT/headers
 * - Scoped Prisma client that auto-filters by orgId
 * - Cross-tenant access validation
 * - Express middleware for context injection
 *
 * All data queries must be scoped to the tenant context to prevent
 * accidental cross-tenant data leaks.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Permissions a user can have within a tenant.
 */
export type TenantPermission =
  | "READ"
  | "WRITE"
  | "DELETE"
  | "ADMIN"
  | "MANAGE_USERS"
  | "MANAGE_BILLING";

/**
 * Represents the tenant context for a request.
 * Contains user, organization, workspace, and role information.
 */
export class TenantContext {
  constructor(
    readonly orgId: string,
    readonly workspaceId?: string,
    readonly userId?: string,
    readonly role?: string,
    readonly permissions: TenantPermission[] = [],
  ) {}

  /**
   * Checks if context has a specific permission.
   */
  hasPermission(permission: TenantPermission): boolean {
    // ADMIN has all permissions
    if (this.permissions.includes("ADMIN")) {
      return true;
    }
    return this.permissions.includes(permission);
  }

  /**
   * Checks if context is for a specific organization.
   */
  isOrgId(orgId: string): boolean {
    return this.orgId === orgId;
  }

  /**
   * Checks if context is for a specific workspace.
   */
  isWorkspaceId(workspaceId: string): boolean {
    return this.workspaceId === workspaceId;
  }

  /**
   * Serializes context for logging/debugging.
   */
  toJSON(): Record<string, unknown> {
    return {
      orgId: this.orgId,
      workspaceId: this.workspaceId,
      userId: this.userId,
      role: this.role,
      permissions: this.permissions,
    };
  }
}

/**
 * Creates a TenantContext from an Express request.
 *
 * Extracts tenant information from:
 * - JWT token (decoded by auth middleware)
 * - Custom headers (X-Org-Id, X-Workspace-Id)
 * - URL parameters
 *
 * @param request - Express request with auth context
 * @returns Tenant context
 * @throws Error if tenant info not found
 */
export function createTenantContext(request: Request): TenantContext {
  // Extract from JWT payload (assumed decoded by auth middleware)
  const auth = (request as any).auth || (request as any).user;

  if (!auth) {
    throw new Error("Authentication required");
  }

  // Org ID from header or JWT
  const orgId = auth.orgId || request.headers["x-org-id"];

  if (!orgId) {
    throw new Error("Organization context required");
  }

  // Workspace ID from header or JWT (optional)
  const workspaceId = auth.workspaceId || request.headers["x-workspace-id"];

  // User and role from JWT
  const userId = auth.userId || auth.sub;
  const role = auth.role || "MEMBER";

  // Extract permissions from role
  const permissions = roleToPermissions(role);

  return new TenantContext(
    orgId as string,
    workspaceId as string | undefined,
    userId as string | undefined,
    role as string,
    permissions,
  );
}

/**
 * Maps a role string to permissions array.
 *
 * @param role - Role name (OWNER, ADMIN, MEMBER)
 * @returns Array of permissions
 */
function roleToPermissions(role: string): TenantPermission[] {
  const rolePermissions: Record<string, TenantPermission[]> = {
    OWNER: [
      "READ",
      "WRITE",
      "DELETE",
      "ADMIN",
      "MANAGE_USERS",
      "MANAGE_BILLING",
    ],
    ADMIN: ["READ", "WRITE", "DELETE", "MANAGE_USERS"],
    MEMBER: ["READ", "WRITE"],
    VIEWER: ["READ"],
  };

  return rolePermissions[role] || ["READ"];
}

/**
 * Returns a Prisma client wrapper that auto-filters queries by orgId.
 *
 * All queries made through this client are automatically scoped to the
 * tenant's organization. This prevents accidental cross-tenant queries.
 *
 * @param prismaClient - Original Prisma client
 * @param tenantContext - Tenant context for filtering
 * @returns Scoped Prisma-like client
 */
export function withTenantScope(
  prismaClient: any,
  tenantContext: TenantContext,
): any {
  return new Proxy(prismaClient, {
    get(target, model: string | symbol) {
      // Allow certain operations without filtering
      if (typeof model === "symbol" || typeof model !== "string") {
        return Reflect.get(target, model);
      }

      // Models that should be globally accessible (not org-scoped)
      const globalModels = new Set([
        "integrationApp", // Integration catalog
        "prisma$__internal__", // Prisma internals
      ]);

      if (globalModels.has(model)) {
        return Reflect.get(target, model);
      }

      // Get the original model delegate
      const modelDelegate = Reflect.get(target, model);

      if (typeof modelDelegate !== "object" || modelDelegate === null) {
        return modelDelegate;
      }

      // Create a proxy for the model delegate that intercepts query methods
      return new Proxy(modelDelegate, {
        get(modelTarget, method: string | symbol) {
          const delegate = Reflect.get(modelTarget, method);

          // Only wrap query methods
          if (
            ![
              "findUnique",
              "findFirst",
              "findMany",
              "create",
              "update",
              "delete",
              "updateMany",
              "deleteMany",
            ].includes(method as string)
          ) {
            return delegate;
          }

          return function (...args: any[]) {
            const query = args[0] || {};

            // Inject orgId filter for data queries
            if (tenantContext.orgId && shouldFilterByOrgId(model as string)) {
              if (method === "create" || method === "createMany") {
                // For creates, inject orgId into data
                if (query.data) {
                  query.data.orgId = tenantContext.orgId;
                }
              } else {
                // For reads/updates/deletes, add to where clause
                if (!query.where) {
                  query.where = {};
                }
                query.where.orgId = tenantContext.orgId;
              }
            }

            return delegate.apply(modelTarget, [query, ...args.slice(1)]);
          };
        },
      });
    },
  });
}

/**
 * Determines if a model should be filtered by orgId.
 *
 * Some models are organization-scoped, others are not.
 */
function shouldFilterByOrgId(model: string): boolean {
  const nonOrgScopedModels = new Set([
    "integrationApp",
    "integrationAppCategory",
    "notification",
    "user",
  ]);

  return !nonOrgScopedModels.has(model);
}

/**
 * Validates that a resource belongs to the tenant context.
 *
 * Throws an error if a user tries to access a resource from a different org.
 *
 * @param tenantContext - Current tenant context
 * @param resourceOrgId - Organization ID of the resource
 * @throws Error if cross-tenant access attempted
 */
export function validateTenantAccess(
  tenantContext: TenantContext,
  resourceOrgId: string,
): void {
  if (tenantContext.orgId !== resourceOrgId) {
    throw new Error(
      `Unauthorized: Cannot access organization ${resourceOrgId} from context ${tenantContext.orgId}`,
    );
  }
}

/**
 * Express middleware for injecting tenant context into requests.
 *
 * Extracts tenant info and stores in request.tenantContext.
 * Must be used after authentication middleware.
 *
 * Usage:
 *   app.use(authMiddleware);
 *   app.use(tenantMiddleware);
 *
 * @returns Express middleware function
 */
export function tenantMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const tenantContext = createTenantContext(_req);
    (_req as any).tenantContext = tenantContext;
    next();
  } catch (err) {
    // No tenant context — could be a public endpoint
    next();
  }
}

/**
 * Express middleware that requires a tenant context.
 *
 * Throws 401 if tenant context is missing. Use this on endpoints
 * that are organization-scoped.
 *
 * Usage:
 *   router.get("/workspaces", requireTenantContext, handler);
 *
 * @returns Express middleware function
 */
export function requireTenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!(req as any).tenantContext) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Organization context required",
    });
    return;
  }
  next();
}

/**
 * Guard function for checking tenant permissions.
 *
 * Usage:
 *   router.delete("/workspaces/:id", checkTenantPermission("DELETE"), handler);
 *
 * @param permission - Required permission
 * @returns Express middleware function
 */
export function checkTenantPermission(permission: TenantPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const tenantContext = (req as any).tenantContext as
      | TenantContext
      | undefined;

    if (!tenantContext) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Authentication required",
      });
      return;
    }

    if (!tenantContext.hasPermission(permission)) {
      res.status(403).json({
        error: "FORBIDDEN",
        message: `Permission '${permission}' required`,
      });
      return;
    }

    next();
  };
}

/**
 * Request augmentation for TypeScript type safety.
 */
declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}
