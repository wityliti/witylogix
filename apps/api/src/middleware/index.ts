/**
 * Middleware barrel exports.
 *
 * This module re-exports all middleware modules for convenient importing.
 * Use as: import { healthPlugin, corsPlugin, ... } from "./middleware/index.js"
 */

// Auth & Tenant
export {
  type AuthContext,
  requireAuth,
  requireRole,
  requireOrgRole,
  verifyShopifyWebhook,
  verifyCarrierRequest,
} from "./auth.js";

export { tenantContext, orgContext } from "./tenant.js";

// Health checks
export { default as healthPlugin } from "./health.js";

// Rate limiting
export {
  createRateLimiter,
  defaultRateLimiter,
  authenticatedRateLimiter,
  apiKeyRateLimiter,
  strictRateLimiter,
  cleanupRateLimiter,
  type RateLimitConfig,
} from "./rate-limiter.js";

// Request logging
export { default as requestLoggerPlugin, redactSensitiveData } from "./request-logger.js";

// Request correlation
export { default as requestIdPlugin } from "./request-id.js";

// Error handling
export { default as errorHandlerPlugin } from "./error-handler.js";

// CORS
export { default as corsPlugin } from "./cors.js";
