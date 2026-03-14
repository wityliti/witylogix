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
} from "./types";

export {
  ApiKeyScope,
  TenantResolutionStrategy,
  TenantResolutionError,
  QuotaExceededError,
} from "./types";

export type { PlanTier } from "./types";

// ─── TENANT RESOLVER ────────────────────────────────────────────────────

export {
  resolveTenant,
  invalidateTenantCache,
  clearTenantCache,
} from "./tenant-resolver";

// ─── MIDDLEWARE ────────────────────────────────────────────────────────

export {
  tenantMiddleware,
  workspaceSwitcherMiddleware,
  requirePermission,
  requireRole,
  requireFeature,
  rateLimitMiddleware,
  tenantLoggingMiddleware,
} from "./tenant-middleware";

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
} from "./api-key-service";

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
} from "./usage-meter";

// ─── WORKSPACE SWITCHING ───────────────────────────────────────────────

export {
  listWorkspaces,
  switchWorkspace,
  getActiveWorkspace,
  canAccessWorkspace,
  getMemberWorkspaces,
  updateMemberWorkspaceAccess,
} from "./workspace-switcher";

export type { Workspace, WorkspaceContext } from "./workspace-switcher";

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
} from "./webhook-secret-service";

export type { WebhookSecret } from "./webhook-secret-service";
