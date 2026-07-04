/**
 * Tenant Context Types — Multi-tenant request isolation and plan limits.
 *
 * This module defines the core types for tenant resolution, API key management,
 * and usage metering. All multi-tenant requests carry a TenantContext that
 * identifies the organization and enforces plan-based resource limits.
 *
 * Key principles:
 * - TenantContext is immutable and attached to each request
 * - Plan limits are enforced at middleware level
 * - API keys have fine-grained scopes (READ, WRITE, ADMIN, WEBHOOK)
 * - All secrets are hashed for storage (SHA-256)
 * - Tenant resolution supports multiple strategies (subdomain, header, JWT, API key)
 */

// ─── TENANT CONTEXT ──────────────────────────────────────────────────────
/**
 * Immutable context attached to each multi-tenant request.
 * Used to enforce isolation, rate limiting, and plan-based features.
 */
export interface TenantContext {
  /** Organization UUID from database. */
  orgId: string;

  /** Workspace/shop context (may be null for org-level requests). */
  workspaceId?: string | null;

  /** User ID if authenticated (null for API key-only auth). */
  userId?: string | null;

  /** User's role in the organization. */
  role?: "OWNER" | "ADMIN" | "MEMBER" | null;

  /** Set of permissions granted by user role and custom scopes. */
  permissions: string[];

  /** Organization's current plan tier (FREE, STARTER, GROWTH, ENTERPRISE). */
  plan: PlanTier;

  /** Feature flags enabled for this organization. */
  features: PlanFeatures;

  /** Resource limits for this organization's plan. */
  limits: PlanLimits;

  /** How the tenant was resolved (for audit/debugging). */
  resolvedVia: TenantResolutionStrategy;

  /** API key ID if authenticated via API key (null for other methods). */
  apiKeyId?: string | null;

  /** API key scopes if authenticated via API key. */
  apiKeyScopes?: ApiKeyScope[];

  /** Request ID for tracing across logs. */
  requestId: string;

  /** Timestamp when context was created. */
  resolvedAt: Date;
}

// ─── PLAN TIER ENUM ──────────────────────────────────────────────────────
export type PlanTier = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";

// ─── API KEY SCOPES ──────────────────────────────────────────────────────
/** Fine-grained permissions for API keys. */
export enum ApiKeyScope {
  /** Read-only access to public endpoints. */
  READ = "READ",

  /** Create/update/delete data via API. */
  WRITE = "WRITE",

  /** Full administrative access including key management. */
  ADMIN = "ADMIN",

  /** Permission to invoke webhooks (for webhook relay services). */
  WEBHOOK = "WEBHOOK",

  /** Access to integration-specific endpoints. */
  INTEGRATION = "INTEGRATION",
}

// ─── PLAN LIMITS ────────────────────────────────────────────────────────
/**
 * Resource limits enforced per plan tier.
 * When org exceeds limit, requests return 429 Too Many Requests.
 */
export interface PlanLimits {
  /** Maximum API requests per day. */
  maxRequestsPerDay: number;

  /** Maximum API requests per minute. */
  maxRequestsPerMinute: number;

  /** Maximum concurrent connections. */
  maxConcurrentConnections: number;

  /** Maximum driver records. */
  maxDrivers: number;

  /** Maximum vehicle records. */
  maxVehicles: number;

  /** Maximum active integrations. */
  maxIntegrations: number;

  /** Maximum API keys per organization. */
  maxApiKeys: number;

  /** Maximum active webhooks. */
  maxWebhooks: number;

  /** Storage quota in GB. */
  storageGB: number;

  /** Maximum days to retain usage logs. */
  usageRetentionDays: number;

  /** Maximum webhook payload size in bytes. */
  maxWebhookPayloadBytes: number;
}

// ─── PLAN FEATURES ──────────────────────────────────────────────────────
/**
 * Feature flags enabled by plan tier.
 * Gate access to premium functionality (analytics, webhooks, etc.).
 */
export interface PlanFeatures {
  /** Enable custom subdomains or CNAME. */
  customDomain: boolean;

  /** Enable API access (all plans get this, but rate-limited). */
  apiAccess: boolean;

  /** Enable webhook outbound notifications. */
  webhooksOutbound: boolean;

  /** Enable advanced analytics (route optimization, ETA). */
  advancedAnalytics: boolean;

  /** Enable custom integrations (OAuth, Zapier, etc.). */
  customIntegrations: boolean;

  /** Enable SSO (SAML, OIDC). */
  sso: boolean;

  /** Enable role-based access control (RBAC). */
  rbac: boolean;

  /** Enable audit logging (who did what, when). */
  auditLog: boolean;

  /** Enable API rate limit overrides. */
  rateLimitCustomization: boolean;

  /** Enable automated data export (CSV, Parquet). */
  dataExport: boolean;

  /** Enable white-label dashboard. */
  whiteLabel: boolean;

  /** Enable priority support. */
  prioritySupport: boolean;

  /** Enable SLA guarantees. */
  sla: boolean;

  /** Enable encryption at rest. */
  encryptionAtRest: boolean;

  /** Enable multi-factor authentication (MFA). */
  mfa: boolean;

  /** Enable dedicated account manager. */
  dedicatedAccountManager: boolean;

  /** Enable backup and recovery. */
  backupRecovery: boolean;
}

// ─── USAGE METRICS ──────────────────────────────────────────────────────
/**
 * Aggregated usage data for billing and analytics.
 */
export interface UsageMetrics {
  /** Total API requests in period. */
  totalRequests: number;

  /** Requests per endpoint (map of endpoint → count). */
  requestsByEndpoint: Record<string, number>;

  /** Total bandwidth in bytes (request + response). */
  totalBandwidthBytes: number;

  /** Error count (4xx + 5xx responses). */
  errorCount: number;

  /** Error rate as percentage (0-100). */
  errorRate: number;

  /** Mean response time in milliseconds. */
  avgResponseTimeMs: number;

  /** 95th percentile response time. */
  p95ResponseTimeMs: number;

  /** 99th percentile response time. */
  p99ResponseTimeMs: number;

  /** Minimum response time. */
  minResponseTimeMs: number;

  /** Maximum response time. */
  maxResponseTimeMs: number;

  /** Number of unique endpoints called. */
  uniqueEndpoints: number;

  /** Top N endpoints by request volume. */
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    count: number;
    errorCount: number;
    avgResponseTimeMs: number;
  }>;

  /** Geographic distribution of requests. */
  geoDistribution: Record<string, number>; // country code → count

  /** Time range for metrics. */
  period: {
    startDate: Date;
    endDate: Date;
  };
}

// ─── TENANT RESOLUTION STRATEGY ──────────────────────────────────────────
/**
 * Multiple strategies to identify which organization/tenant a request belongs to.
 * The resolver tries each in priority order until one succeeds.
 */
export enum TenantResolutionStrategy {
  /** Subdomain (acme.witylogix.com → org "acme"). */
  SUBDOMAIN = "SUBDOMAIN",

  /** X-Tenant-ID header. */
  HEADER = "HEADER",

  /** orgId claim in JWT token (Authorization: Bearer <token>). */
  JWT = "JWT",

  /** API key prefix lookup. */
  API_KEY = "API_KEY",

  /** Custom domain CNAME resolution. */
  CUSTOM_DOMAIN = "CUSTOM_DOMAIN",
}

// ─── API KEY METADATA ───────────────────────────────────────────────────
/**
 * API key details (returned when key is created; not stored in full).
 */
export interface ApiKeyResponse {
  /** Key ID for management/revocation. */
  id: string;

  /** Human-readable name. */
  name: string;

  /** The full secret (shown only once to user). Format: wl_live_<32 random chars>. */
  secret: string;

  /** First 8 characters of secret (for identification). */
  prefix: string;

  /** Scopes granted to this key. */
  scopes: ApiKeyScope[];

  /** Expiration date (or null if no expiry). */
  expiresAt: Date | null;

  /** Creation timestamp. */
  createdAt: Date;
}

// ─── API KEY VALIDATION RESULT ──────────────────────────────────────────
/**
 * Result of validating an API key in a request.
 */
export interface ApiKeyValidationResult {
  /** Whether the key is valid and active. */
  valid: boolean;

  /** If invalid, reason why. */
  reason?: "INVALID" | "EXPIRED" | "REVOKED" | "NOT_FOUND";

  /** Key ID if valid. */
  keyId?: string;

  /** Organization ID if valid. */
  orgId?: string;

  /** Scopes granted to key. */
  scopes?: ApiKeyScope[];

  /** When key was created. */
  createdAt?: Date;

  /** When key was last used. */
  lastUsedAt?: Date | null;

  /** IP address from last request. */
  lastUsedIp?: string | null;
}

// ─── RATE LIMIT STATE ───────────────────────────────────────────────────
/**
 * Current rate limit consumption for a tenant/key.
 */
export interface RateLimitState {
  /** Requests used in current minute. */
  requestsThisMinute: number;

  /** Requests used in current hour. */
  requestsThisHour: number;

  /** Requests used today (UTC). */
  requestsToday: number;

  /** Maximum allowed per minute. */
  limitPerMinute: number;

  /** Maximum allowed per hour. */
  limitPerHour: number;

  /** Maximum allowed per day. */
  limitPerDay: number;

  /** Whether quota exceeded. */
  exceeded: boolean;

  /** Time until quota resets (milliseconds). */
  resetInMs: number;

  /** Remaining requests before hit limit. */
  remainingRequests: number;

  /** Retry-After header value (seconds). */
  retryAfterSeconds: number;
}

// ─── WEBHOOK SIGNATURE ──────────────────────────────────────────────────
/**
 * Details for signing and verifying webhook payloads.
 */
export interface WebhookSignature {
  /** HMAC algorithm used (SHA256 or SHA512). */
  algorithm: "HMAC_SHA256" | "HMAC_SHA512";

  /** X-Witylogix-Signature header value. */
  signature: string;

  /** Request body hash (SHA256 of JSON). */
  bodyHash: string;

  /** Timestamp the webhook was signed. */
  timestamp: string; // ISO 8601

  /** Nonce to prevent replay attacks. */
  nonce: string;
}

// ─── TENANT RESOLUTION ERROR ────────────────────────────────────────────
/**
 * Specific errors during tenant resolution.
 */
export class TenantResolutionError extends Error {
  constructor(
    public code:
      | "NO_TENANT_FOUND"
      | "INVALID_SUBDOMAIN"
      | "INVALID_API_KEY"
      | "TENANT_INACTIVE"
      | "MULTIPLE_MATCHES"
      | "RESOLUTION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

// ─── QUOTA EXCEEDED ERROR ──────────────────────────────────────────────
/**
 * Raised when organization exceeds plan quota.
 */
export class QuotaExceededError extends Error {
  constructor(
    public resource: string, // "requests", "drivers", "vehicles", etc.
    public limit: number,
    public current: number,
  ) {
    super(`Quota exceeded for ${resource}: limit=${limit}, current=${current}`);
    this.name = "QuotaExceededError";
  }

  /** HTTP status code (429 Too Many Requests). */
  get statusCode(): number {
    return 429;
  }
}
