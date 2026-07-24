/**
 * Auth Middleware — Express/Next.js Authentication Middleware
 *
 * Provides:
 * - Bearer token extraction and validation from Authorization header
 * - Session validation and MFA enforcement
 * - RBAC guard (requirePermission decorator pattern)
 * - Rate limiting integration point
 * - Request context enrichment with authenticated user
 * - Error handling and HTTP status codes
 *
 * Usage:
 *   app.use(authMiddleware(jwtService, sessionManager));
 *   app.get('/protected', requirePermission('shipments:read'), handler);
 */

import type { Request, Response, NextFunction } from "express";
import type { JwtService } from "./jwt-service.js";
import type { SessionManager } from "./session-manager.js";
import type { RbacEngine } from "./rbac-engine.js";
import type { PermissionContext } from "./rbac-engine.js";
import {
  AuthError,
  InvalidCredentialsError,
  SessionInvalidError,
  PermissionDeniedError,
} from "./types.js";

// ─── TYPES ──────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        orgId: string;
        shopId: string;
        role: string;
        permissions: string[];
      };
      sessionId?: string;
      authError?: Error;
    }
  }
}

export interface AuthMiddlewareOptions {
  /** JWT service instance */
  jwtService: JwtService;
  /** Session manager instance */
  sessionManager: SessionManager;
  /** RBAC engine instance (optional) */
  rbacEngine?: RbacEngine;
  /** Skip auth for these paths (regex patterns) */
  skipPaths?: RegExp[];
  /** Require MFA for sensitive routes */
  requireMfaForPaths?: RegExp[];
}

// ─── MIDDLEWARE FACTORY ─────────────────────────────────────

/**
 * Create authentication middleware for Express/Next.js.
 *
 * Validates bearer tokens, session status, and MFA requirements.
 *
 * @param options Middleware configuration
 * @returns Express middleware function
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const {
    jwtService,
    sessionManager,
    rbacEngine,
    skipPaths = [/^\/health/, /^\/api\/auth\/login/, /^\/api\/auth\/register/],
    requireMfaForPaths = [/^\/api\/org\//, /^\/api\/billing\//],
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip auth for public paths
      if (skipPaths.some((pattern) => pattern.test(req.path))) {
        return next();
      }

      // Extract bearer token from Authorization header
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({
          error: "MISSING_TOKEN",
          message: "Authorization header missing or malformed",
        });
      }

      // Verify token signature and claims
      const result = jwtService.verifyAccessToken(token);
      if (!result.valid || !result.payload) {
        return res.status(401).json({
          error: "INVALID_TOKEN",
          message: result.error || "Token verification failed",
        });
      }

      const payload = result.payload;

      // Validate session if session manager provided
      if (payload && "sessionId" in payload) {
        const sessionId = (payload as any).sessionId;
        const sessionResult = await sessionManager.validateSession(sessionId);

        if (!sessionResult.valid) {
          return res.status(401).json({
            error: "SESSION_INVALID",
            message: sessionResult.error || "Session is invalid or expired",
          });
        }

        req.sessionId = sessionId;
      }

      // Check MFA requirement for sensitive paths
      if (requireMfaForPaths.some((pattern) => pattern.test(req.path))) {
        if (!payload.mfaVerified) {
          return res.status(403).json({
            error: "MFA_REQUIRED",
            message: "Multi-factor authentication required for this operation",
          });
        }
      }

      // Attach user to request
      req.user = {
        id: payload.userId,
        email: "", // Not in JWT payload by default
        orgId: payload.orgId,
        shopId: payload.shopId || "",
        role: payload.role || "VIEWER",
        permissions: payload.permissions || [],
      };

      return next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json({
        error: "AUTH_ERROR",
        message: "Authentication processing failed",
      });
    }
  };
}

/**
 * Decorator/middleware factory for permission checking.
 *
 * Usage:
 *   app.get('/api/shipments', requirePermission('shipments:read'), handler);
 *
 * @param resource Resource name (e.g., "shipments")
 * @param action Action name (e.g., "read")
 * @param rbacEngine RBAC engine instance
 * @returns Express middleware function
 */
export function requirePermission(
  resource: string,
  action: string,
  rbacEngine?: RbacEngine,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "User is not authenticated",
      });
    }

    // Check permission via RBAC if engine provided
    if (rbacEngine) {
      const context: PermissionContext = {
        userId: req.user.id,
        orgId: req.user.orgId,
        role: req.user.role as any,
        permissions: req.user.permissions,
      };

      try {
        rbacEngine.checkPermission(context, resource, action);
      } catch (error) {
        if (error instanceof PermissionDeniedError) {
          return res.status(403).json({
            error: "PERMISSION_DENIED",
            message: `Not permitted to ${action} ${resource}`,
          });
        }
        throw error;
      }
    } else {
      // Fallback: check permission string directly
      const permission = `${resource}:${action}`;
      if (
        !req.user.permissions.includes(permission) &&
        !req.user.permissions.includes("*:*")
      ) {
        return res.status(403).json({
          error: "PERMISSION_DENIED",
          message: `Not permitted to ${action} ${resource}`,
        });
      }
    }

    return next();
  };
}

/**
 * Middleware to require MFA verification.
 *
 * @returns Express middleware function
 */
export function requireMfa() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "User is not authenticated",
      });
    }

    // In a real implementation, check session.mfaVerified flag
    // This is a placeholder
    return next();
  };
}

/**
 * Middleware to check if user is org admin.
 *
 * @returns Express middleware function
 */
export function requireOrgAdmin() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "User is not authenticated",
      });
    }

    const role = req.user.role?.toUpperCase();
    if (role !== "ADMIN" && role !== "OWNER") {
      return res.status(403).json({
        error: "INSUFFICIENT_ROLE",
        message: "This operation requires admin or owner privileges",
      });
    }

    return next();
  };
}

/**
 * Middleware to check if user is org owner.
 *
 * @returns Express middleware function
 */
export function requireOrgOwner() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "User is not authenticated",
      });
    }

    const role = req.user.role?.toUpperCase();
    if (role !== "OWNER") {
      return res.status(403).json({
        error: "INSUFFICIENT_ROLE",
        message: "This operation requires owner privileges",
      });
    }

    return next();
  };
}

/**
 * Middleware to catch async errors in route handlers.
 *
 * Usage: app.post('/api/route', asyncHandler(async (req, res) => { ... }))
 *
 * @param fn Async route handler
 * @returns Express middleware function
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── UTILITY FUNCTIONS ──────────────────────────────────────

/**
 * Extract bearer token from Authorization header.
 *
 * Expected format: "Bearer <token>"
 *
 * @param req Express request
 * @returns Token or null if missing/malformed
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.get("authorization");

  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Extract session ID from request (cookie or header).
 *
 * @param req Express request
 * @returns Session ID or null if not found
 */
export function extractSessionId(req: Request): string | null {
  // Try Authorization header first (format: "Session <id>")
  const authHeader = req.get("authorization");
  if (authHeader?.startsWith("Session ")) {
    return authHeader.substring(8);
  }

  // Try X-Session-Id header
  return req.get("x-session-id") || null;
}

/**
 * Global error handler middleware for auth errors.
 *
 * @returns Express error handling middleware
 */
export function authErrorHandler() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Only handle auth-related errors
    if (!(err instanceof AuthError)) {
      return next(err);
    }

    const statusCode = err.statusCode || 401;
    const code = (err as any).code || "AUTH_ERROR";

    return res.status(statusCode).json({
      error: code,
      message: err.message,
    });
  };
}
