/**
 * Tenant Middleware — Express/Next.js middleware for multi-tenant isolation.
 *
 * This middleware:
 * - Resolves tenant from request (subdomain, header, JWT, API key)
 * - Validates tenant is active
 * - Checks plan limits (reject if over quota)
 * - Attaches TenantContext to request for downstream handlers
 * - Adds X-Tenant-ID response header for audit trails
 *
 * Errors:
 * - 401: No tenant found / invalid credentials
 * - 403: Tenant inactive
 * - 429: Quota exceeded
 */

import type { Request, Response, NextFunction } from "express";
import { resolveTenant } from "./tenant-resolver";
import { checkQuota } from "./usage-meter";
import type { TenantContext } from "./types";
import { TenantResolutionError, QuotaExceededError } from "./types";
import { prisma } from "@witylogix/db";

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      tenantId?: string;
      userId?: string;
    }
  }
}

// ─── BYPASS ROUTES (Public endpoints, no auth required) ──────────────────

const BYPASS_ROUTES = [
  "/health",
  "/healthz",
  "/health/ready",
  "/health/live",
  "/ping",
  "/status",
  "/public",
  "/api/v1/public",
  "/.well-known",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

/**
 * Check if route should bypass tenant middleware.
 */
function shouldBypassTenant(req: Request): boolean {
  const path = req.path;

  // Check exact matches
  if (BYPASS_ROUTES.includes(path)) {
    return true;
  }

  // Check prefix matches
  return BYPASS_ROUTES.some((route) => {
    if (route.endsWith("/")) {
      return path.startsWith(route);
    }
    return path.startsWith(route + "/");
  });
}

// ─── MAIN MIDDLEWARE ────────────────────────────────────────────────────

/**
 * Express middleware for tenant resolution and validation.
 *
 * Usage:
 *   app.use(tenantMiddleware());
 *   app.get("/api/routes", (req, res) => {
 *     const { orgId, plan, limits } = req.tenant!;
 *     // ...
 *   });
 */
export function tenantMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip public routes
    if (shouldBypassTenant(req)) {
      return next();
    }

    try {
      // Resolve tenant from request
      const tenant = await resolveTenant(req, req.userId);

      // Validate tenant is active
      if (!tenant) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "No tenant identified in request",
          code: "NO_TENANT",
        });
      }

      // Check organization is active (double-check in case of cache staleness)
      const org = await prisma.organization.findUnique({
        where: { id: tenant.orgId },
      });

      if (!org?.isActive) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Organization is not active",
          code: "TENANT_INACTIVE",
        });
      }

      // Check quota (daily request limit)
      const quotaOk = await checkQuota(tenant.orgId);
      if (!quotaOk) {
        return res.status(429).json({
          error: "QUOTA_EXCEEDED",
          message: `Organization ${tenant.orgId} has exceeded daily request limit`,
          code: "DAILY_LIMIT_EXCEEDED",
          retryAfter: 86400, // 24 hours
        });
      }

      // Attach tenant context to request
      req.tenant = tenant;
      req.tenantId = tenant.orgId;

      // Add X-Tenant-ID response header
      res.setHeader("X-Tenant-ID", tenant.orgId);
      res.setHeader("X-Request-ID", tenant.requestId);

      // Continue to next handler
      next();
    } catch (err) {
      if (err instanceof TenantResolutionError) {
        // 401 for resolution errors (invalid credentials, tenant not found)
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: err.message,
          code: err.code,
        });
      }

      if (err instanceof QuotaExceededError) {
        return res.status(429).json({
          error: "QUOTA_EXCEEDED",
          message: err.message,
          code: "QUOTA_EXCEEDED",
          resource: err.resource,
          limit: err.limit,
          current: err.current,
          retryAfter: 3600,
        });
      }

      // Log unexpected errors
      console.error("[TenantMiddleware] Unexpected error:", err);

      return res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to process tenant context",
        code: "TENANT_ERROR",
      });
    }
  };
}

// ─── OPTIONAL: WORKSPACE SWITCHER ──────────────────────────────────────

/**
 * Optional middleware to validate/switch workspace context.
 * Applies only if ?workspace=<id> query param is present.
 */
export function workspaceSwitcherMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Requires tenant context (must come after tenantMiddleware)
    if (!req.tenant) {
      return next();
    }

    const workspaceId = req.query.workspace as string | undefined;
    if (!workspaceId) {
      return next();
    }

    try {
      // Validate user has access to workspace
      // This depends on your workspace/shop model structure
      // For now, just validate it exists within the org

      // This is a placeholder - adjust based on your actual model
      // const shop = await prisma.shop.findFirst({
      //   where: {
      //     id: workspaceId,
      //     orgId: req.tenant.orgId,
      //   },
      // });
      //
      // if (!shop) {
      //   return res.status(403).json({
      //     error: "FORBIDDEN",
      //     message: `Workspace ${workspaceId} not found or not accessible`,
      //     code: "WORKSPACE_NOT_FOUND",
      //   });
      // }
      //
      // req.tenant.workspaceId = workspaceId;

      next();
    } catch (err) {
      console.error("[WorkspaceSwitcher] Error:", err);
      return res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to switch workspace",
      });
    }
  };
}

// ─── GUARD: REQUIRE PERMISSION ─────────────────────────────────────────

/**
 * Guard middleware that requires specific permission.
 * Returns 403 if user lacks permission.
 *
 * Usage:
 *   app.post("/api/routes", requirePermission("routes:write"), (req, res) => {
 *     // ...
 *   });
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Tenant context required",
      });
    }

    if (!req.tenant.permissions.includes(permission)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: `Permission required: ${permission}`,
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    next();
  };
}

// ─── GUARD: REQUIRE ROLE ──────────────────────────────────────────────

/**
 * Guard middleware that requires specific role.
 *
 * Usage:
 *   app.post("/api/users", requireRole("OWNER", "ADMIN"), (req, res) => {
 *     // ...
 *   });
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Tenant context required",
      });
    }

    if (!req.tenant.role || !roles.includes(req.tenant.role)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: `Role required: ${roles.join(" or ")}`,
        code: "INSUFFICIENT_ROLE",
      });
    }

    next();
  };
}

// ─── GUARD: REQUIRE FEATURE ────────────────────────────────────────────

/**
 * Guard middleware that requires feature to be enabled.
 *
 * Usage:
 *   app.post("/api/webhooks", requireFeature("webhooksOutbound"), (req, res) => {
 *     // ...
 *   });
 */
export function requireFeature(feature: keyof any) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Tenant context required",
      });
    }

    if (!req.tenant.features[feature]) {
      return res.status(403).json({
        error: "FEATURE_NOT_AVAILABLE",
        message: `Feature not available in ${req.tenant.plan} plan`,
        code: "FEATURE_UNAVAILABLE",
        feature,
        plan: req.tenant.plan,
      });
    }

    next();
  };
}

// ─── GUARD: RATE LIMIT CHECK ──────────────────────────────────────────

/**
 * Optional: More granular rate limit check middleware.
 * The main middleware checks daily limit; this checks per-minute.
 *
 * Usage:
 *   app.use(rateLimitMiddleware({ windowMs: 60000, maxRequests: 100 }));
 */
export function rateLimitMiddleware(options: {
  windowMs: number;
  maxRequests: number;
}) {
  // Use a simple in-memory map or Redis for tracking
  const requests = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return next(); // Require tenant middleware first
    }

    const key = req.tenant.orgId;
    const now = Date.now();
    const record = requests.get(key);

    if (!record || record.resetAt < now) {
      // New window
      requests.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return next();
    }

    record.count++;

    if (record.count > options.maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded: ${options.maxRequests} requests per ${options.windowMs / 1000}s`,
        code: "RATE_LIMIT",
        retryAfter,
      });
    }

    res.setHeader("X-RateLimit-Limit", options.maxRequests);
    res.setHeader("X-RateLimit-Remaining", options.maxRequests - record.count);
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(record.resetAt / 1000)
    );

    next();
  };
}

// ─── LOGGING MIDDLEWARE ────────────────────────────────────────────────

/**
 * Optional: Log tenant context (useful for debugging/audit).
 */
export function tenantLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const original = res.json;

    res.json = function (body: any) {
      if (req.tenant) {
        console.log(
          `[${req.tenant.orgId}] ${req.method} ${req.path} - ${res.statusCode}`
        );
      }
      return original.call(this, body);
    };

    next();
  };
}
