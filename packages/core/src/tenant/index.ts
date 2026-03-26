/**
 * Tenant Management Module — Multi-tenant isolation, API keys, and usage metering.
 *
 * Exports all tenant-related types and services for multi-tenant SaaS support.
 */

// ─── TYPES ─────────────────────────────────────────────────────────────

export type {
  TenantContext,
  ApiKeyScope,
  PlanLimits,
  PlanFeatures,
  UsageMetrics,
  ApiKeyResponse,
  ApiKeyValidationResult,
  RateLimitState,
  WebhookSignature,
} from "./types.js";

export {
  ApiKeyScope,
  TenantResolutionStrategy,
  TenantResolutionError,
  QuotaExceededError,
} from "./types.js";

export type { PlanTier } from "./types.js";

// ─── TENANT RESOLVER ────────────────────────────────────────────────────

export {
  resolveTenant,
  invalidateTenantCache,
  clearTenantCache,
} from "./tenant-resolver.js";

// ─── MIDDLEWARE ────────────────────────────────────────────────────────

export {
  tenantMiddleware,
  workspaceSwitcherMiddleware,
  requirePermission,
  requireRole,
  requireFeature,
  rateLimitMiddleware,
  tenantLoggingMiddleware,
} from "./tenant-middleware.js";

// ─── API KEY SERVICE ───────────────────────────────────────────────────

export {
  generateApiKey,
  validateApiKey,
  rotateApiKey,
  revokeApiKey,
  reactivateApiKey,
  listApiKeys,
  updateApiKeyScopes,
  updateApiKeyRateLimit,
  updateApiKeyExpiration,
  recordApiKeyUsage,
  deleteApiKey,
  checkApiKeyQuota,
} from "./api-key-service.js";

// ─── USAGE METERING ────────────────────────────────────────────────────

export {
  recordUsage,
  getUsageSummary,
  checkQuota,
  getTodayQuotaStatus,
  getTopEndpoints,
  aggregateDailyUsage,
  cleanupOldRecords,
  shutdownUsageMeter,
} from "./usage-meter.js";

// ─── WORKSPACE SWITCHING ───────────────────────────────────────────────

export {
  listWorkspaces,
  switchWorkspace,
  getActiveWorkspace,
  canAccessWorkspace,
  getMemberWorkspaces,
  updateMemberWorkspaceAccess,
} from "./workspace-switcher.js";

export type { Workspace, WorkspaceContext } from "./workspace-switcher.js";

// ─── WEBHOOK SECRETS ───────────────────────────────────────────────────

export {
  generateSecret,
  signPayload,
  verifySignature,
  rotateSecret,
  getWebhookSecret,
  listWebhookSecrets,
  deleteWebhookSecret,
  isSecretValid,
  buildSignatureHeader,
  parseSignatureHeader,
  verifyWithTimestamp,
} from "./webhook-secret-service.js";

export type { WebhookSecret } from "./webhook-secret-service.js";
