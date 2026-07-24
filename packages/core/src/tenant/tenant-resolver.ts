/**
 * Tenant Resolver — Determines tenant from request (multi-strategy).
 *
 * Resolves which organization a request belongs to by checking:
 * 1. Subdomain (acme.witylogix.com → org "acme")
 * 2. X-Tenant-ID header
 * 3. JWT claims (orgId in token)
 * 4. API key prefix lookup
 * 5. Custom domain CNAME
 *
 * Results are cached with 5-minute TTL to avoid repeated lookups.
 */

import type { Request } from "express";
import { LRUCache } from "lru-cache";
import * as jwt from "jsonwebtoken";
import type {
  TenantContext,
  TenantResolutionStrategy,
  PlanTier,
} from "./types";
import { TenantResolutionError } from "./types";
import { prisma } from "@witylogix/db";

interface CachedTenant {
  context: TenantContext;
  expiresAt: number; // Unix timestamp
}

/**
 * LRU cache for resolved tenants.
 * Capacity: 1000 orgs, TTL: 5 minutes.
 */
const tenantCache = new LRUCache<string, CachedTenant>({
  max: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
  updateAgeOnGet: true,
});

// ─── CACHE INVALIDATION ──────────────────────────────────────────────────

/**
 * Invalidate cached tenant (called after tenant config changes).
 */
export function invalidateTenantCache(orgId: string): void {
  const keysToDelete = Array.from(tenantCache.keys()).filter((key) =>
    key.includes(orgId),
  );
  keysToDelete.forEach((key) => tenantCache.delete(key));
}

/**
 * Clear all tenant cache (full refresh).
 */
export function clearTenantCache(): void {
  tenantCache.clear();
}

// ─── RESOLUTION FUNCTIONS ───────────────────────────────────────────────

/**
 * Resolve tenant from request using multiple strategies.
 *
 * Tries in this order:
 * 1. X-Tenant-ID header (explicit org ID)
 * 2. JWT token claims (orgId in payload)
 * 3. API key in Authorization header
 * 4. Subdomain extraction
 * 5. Custom domain CNAME lookup
 */
export async function resolveTenant(
  req: Request,
  userId?: string | null,
): Promise<TenantContext> {
  const requestId = (req.id as string) || crypto.randomUUID();

  // Try explicit header first (highest priority for testing/explicit routing)
  {
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId) {
      const cached = getFromCache(tenantId, "HEADER");
      if (cached) return cached;

      const context = await resolveTenantById(
        tenantId,
        "HEADER",
        requestId,
        userId,
      );
      cacheResult(tenantId, "HEADER", context);
      return context;
    }
  }

  // Try JWT token (Authorization: Bearer <token>)
  {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      try {
        // Decode without verification (verification happens in auth middleware)
        const decoded = jwt.decode(token) as any;
        if (decoded?.orgId) {
          const cached = getFromCache(decoded.orgId, "JWT");
          if (cached) return cached;

          const context = await resolveTenantById(
            decoded.orgId,
            "JWT",
            requestId,
            userId || decoded.sub,
          );
          cacheResult(decoded.orgId, "JWT", context);
          return context;
        }
      } catch {
        // Invalid JWT, continue to next strategy
      }
    }
  }

  // Try API key (Authorization: Bearer wl_live_<key> or x-api-key header)
  {
    let apiKey: string | undefined;
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      apiKey = auth.slice(7);
    } else {
      apiKey = req.headers["x-api-key"] as string | undefined;
    }

    if (apiKey && apiKey.startsWith("wl_")) {
      const prefix = apiKey.slice(0, 8);
      const cached = getFromCache(prefix, "API_KEY");
      if (cached) return cached;

      try {
        const context = await resolveByApiKey(apiKey, requestId);
        cacheResult(prefix, "API_KEY", context);
        return context;
      } catch (err) {
        // Invalid key, continue to next strategy
      }
    }
  }

  // Try subdomain (acme.witylogix.com)
  {
    const host = req.hostname;
    const subdomain = extractSubdomain(host);

    if (subdomain && subdomain !== "www" && subdomain !== "api") {
      const cached = getFromCache(subdomain, "SUBDOMAIN");
      if (cached) return cached;

      try {
        const context = await resolveBySubdomain(subdomain, requestId, userId);
        cacheResult(subdomain, "SUBDOMAIN", context);
        return context;
      } catch (err) {
        // Continue to custom domain
      }
    }
  }

  // Try custom domain CNAME lookup
  {
    const host = req.hostname;
    const cached = getFromCache(host, "CUSTOM_DOMAIN");
    if (cached) return cached;

    try {
      const context = await resolveByCustomDomain(host, requestId, userId);
      cacheResult(host, "CUSTOM_DOMAIN", context);
      return context;
    } catch (err) {
      // Fall through to error
    }
  }

  throw new TenantResolutionError(
    "NO_TENANT_FOUND",
    `Could not resolve tenant from request. Host: ${req.hostname}`,
  );
}

// ─── RESOLUTION STRATEGIES ──────────────────────────────────────────────

/**
 * Resolve by explicit tenant ID.
 */
async function resolveTenantById(
  orgId: string,
  strategy: TenantResolutionStrategy,
  requestId: string,
  userId?: string | null,
): Promise<TenantContext> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });

  if (!org.isActive) {
    throw new TenantResolutionError(
      "TENANT_INACTIVE",
      `Organization ${orgId} is not active`,
    );
  }

  return buildTenantContext(org, strategy, requestId, userId);
}

/**
 * Resolve by API key (validate and extract orgId).
 */
async function resolveByApiKey(
  apiKey: string,
  requestId: string,
): Promise<TenantContext> {
  const prefix = apiKey.slice(0, 8);

  // Lookup by prefix (fast)
  const dbKey = await prisma.apiKey.findFirst({
    where: { prefix, isActive: true },
    include: { organization: true },
  });

  if (!dbKey) {
    throw new TenantResolutionError(
      "INVALID_API_KEY",
      `API key not found or inactive: ${prefix}`,
    );
  }

  // Verify hash matches (constant-time comparison)
  const keyHash = await hashApiKey(apiKey);
  if (!constantTimeEquals(keyHash, dbKey.keyHash)) {
    throw new TenantResolutionError(
      "INVALID_API_KEY",
      `API key verification failed`,
    );
  }

  // Check expiry
  if (dbKey.expiresAt && new Date() > dbKey.expiresAt) {
    throw new TenantResolutionError(
      "INVALID_API_KEY",
      `API key expired: ${dbKey.id}`,
    );
  }

  const org = dbKey.organization;
  if (!org.isActive) {
    throw new TenantResolutionError(
      "TENANT_INACTIVE",
      `Organization ${org.id} is not active`,
    );
  }

  // Update last used
  await prisma.apiKey.update({
    where: { id: dbKey.id },
    data: {
      lastUsedAt: new Date(),
      lastUsedIp: "", // Would be populated from request in real scenario
    },
  });

  const context = await buildTenantContext(
    org,
    "API_KEY",
    requestId,
    undefined,
  );

  // Add API key specific data
  context.apiKeyId = dbKey.id;
  context.apiKeyScopes = dbKey.scopes as any;

  return context;
}

/**
 * Resolve by subdomain (acme.witylogix.com → org "acme").
 */
async function resolveBySubdomain(
  subdomain: string,
  requestId: string,
  userId?: string | null,
): Promise<TenantContext> {
  const tenantConfig = await prisma.tenantConfig.findUniqueOrThrow({
    where: { subdomain },
    include: { organization: true },
  });

  if (!tenantConfig.isActive) {
    throw new TenantResolutionError(
      "TENANT_INACTIVE",
      `Tenant subdomain ${subdomain} is not active`,
    );
  }

  const org = tenantConfig.organization;
  if (!org.isActive) {
    throw new TenantResolutionError(
      "TENANT_INACTIVE",
      `Organization ${org.id} is not active`,
    );
  }

  return buildTenantContext(org, "SUBDOMAIN", requestId, userId);
}

/**
 * Resolve by custom domain CNAME.
 */
async function resolveByCustomDomain(
  customDomain: string,
  requestId: string,
  userId?: string | null,
): Promise<TenantContext> {
  const tenantConfig = await prisma.tenantConfig.findUniqueOrThrow({
    where: { customDomain },
    include: { organization: true },
  });

  if (!tenantConfig.isActive) {
    throw new TenantResolutionError(
      "TENANT_INACTIVE",
      `Tenant custom domain ${customDomain} is not active`,
    );
  }

  const org = tenantConfig.organization;
  if (!org.isActive) {
    throw new TenantResolutionError(
      "TENANT_INACTIVE",
      `Organization ${org.id} is not active`,
    );
  }

  return buildTenantContext(org, "CUSTOM_DOMAIN", requestId, userId);
}

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────

/**
 * Build complete TenantContext from organization.
 */
async function buildTenantContext(
  org: any, // Organization model
  strategy: TenantResolutionStrategy,
  requestId: string,
  userId?: string | null,
): Promise<TenantContext> {
  // Get plan limits and features
  const limits = getPlanLimits(org.planTier);
  const features = getPlanFeatures(org.planTier);

  // Get user permissions if available
  let role: "OWNER" | "ADMIN" | "MEMBER" | null = null;
  let permissions: string[] = [];

  if (userId) {
    const member = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId: org.id, userId } },
    });

    if (member) {
      role = member.role as any;
      permissions = getRolePermissions(member.role);
    }
  }

  return {
    orgId: org.id,
    workspaceId: null,
    userId: userId || null,
    role,
    permissions,
    plan: org.planTier,
    features,
    limits,
    resolvedVia: strategy,
    requestId,
    resolvedAt: new Date(),
  };
}

/**
 * Get plan limits for tier.
 */
function getPlanLimits(tier: PlanTier): any {
  const limits: Record<PlanTier, any> = {
    FREE: {
      maxRequestsPerDay: 1000,
      maxRequestsPerMinute: 10,
      maxConcurrentConnections: 5,
      maxDrivers: 5,
      maxVehicles: 10,
      maxIntegrations: 3,
      maxApiKeys: 1,
      maxWebhooks: 0,
      storageGB: 1,
      usageRetentionDays: 7,
      maxWebhookPayloadBytes: 10000,
    },
    STARTER: {
      maxRequestsPerDay: 10000,
      maxRequestsPerMinute: 100,
      maxConcurrentConnections: 20,
      maxDrivers: 50,
      maxVehicles: 100,
      maxIntegrations: 10,
      maxApiKeys: 5,
      maxWebhooks: 10,
      storageGB: 10,
      usageRetentionDays: 30,
      maxWebhookPayloadBytes: 100000,
    },
    GROWTH: {
      maxRequestsPerDay: 100000,
      maxRequestsPerMinute: 1000,
      maxConcurrentConnections: 100,
      maxDrivers: 500,
      maxVehicles: 1000,
      maxIntegrations: 50,
      maxApiKeys: 20,
      maxWebhooks: 50,
      storageGB: 100,
      usageRetentionDays: 90,
      maxWebhookPayloadBytes: 1000000,
    },
    ENTERPRISE: {
      maxRequestsPerDay: Number.MAX_SAFE_INTEGER,
      maxRequestsPerMinute: Number.MAX_SAFE_INTEGER,
      maxConcurrentConnections: Number.MAX_SAFE_INTEGER,
      maxDrivers: Number.MAX_SAFE_INTEGER,
      maxVehicles: Number.MAX_SAFE_INTEGER,
      maxIntegrations: Number.MAX_SAFE_INTEGER,
      maxApiKeys: Number.MAX_SAFE_INTEGER,
      maxWebhooks: Number.MAX_SAFE_INTEGER,
      storageGB: Number.MAX_SAFE_INTEGER,
      usageRetentionDays: 365,
      maxWebhookPayloadBytes: 10000000,
    },
  };

  return limits[tier];
}

/**
 * Get feature flags for tier.
 */
function getPlanFeatures(tier: PlanTier): any {
  const features: Record<PlanTier, any> = {
    FREE: {
      customDomain: false,
      apiAccess: true,
      webhooksOutbound: false,
      advancedAnalytics: false,
      customIntegrations: false,
      sso: false,
      rbac: false,
      auditLog: false,
      rateLimitCustomization: false,
      dataExport: false,
      whiteLabel: false,
      prioritySupport: false,
      sla: false,
      encryptionAtRest: false,
      mfa: false,
      dedicatedAccountManager: false,
      backupRecovery: false,
    },
    STARTER: {
      customDomain: false,
      apiAccess: true,
      webhooksOutbound: true,
      advancedAnalytics: false,
      customIntegrations: false,
      sso: false,
      rbac: true,
      auditLog: false,
      rateLimitCustomization: false,
      dataExport: true,
      whiteLabel: false,
      prioritySupport: false,
      sla: false,
      encryptionAtRest: true,
      mfa: false,
      dedicatedAccountManager: false,
      backupRecovery: false,
    },
    GROWTH: {
      customDomain: true,
      apiAccess: true,
      webhooksOutbound: true,
      advancedAnalytics: true,
      customIntegrations: true,
      sso: true,
      rbac: true,
      auditLog: true,
      rateLimitCustomization: true,
      dataExport: true,
      whiteLabel: false,
      prioritySupport: true,
      sla: true,
      encryptionAtRest: true,
      mfa: true,
      dedicatedAccountManager: false,
      backupRecovery: true,
    },
    ENTERPRISE: {
      customDomain: true,
      apiAccess: true,
      webhooksOutbound: true,
      advancedAnalytics: true,
      customIntegrations: true,
      sso: true,
      rbac: true,
      auditLog: true,
      rateLimitCustomization: true,
      dataExport: true,
      whiteLabel: true,
      prioritySupport: true,
      sla: true,
      encryptionAtRest: true,
      mfa: true,
      dedicatedAccountManager: true,
      backupRecovery: true,
    },
  };

  return features[tier];
}

/**
 * Get permissions for role.
 */
function getRolePermissions(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    OWNER: [
      "org:read",
      "org:write",
      "billing:read",
      "billing:write",
      "users:read",
      "users:write",
      "settings:read",
      "settings:write",
    ],
    ADMIN: [
      "org:read",
      "org:write",
      "users:read",
      "settings:read",
      "settings:write",
    ],
    MEMBER: ["org:read", "settings:read"],
  };

  return rolePermissions[role] || [];
}

/**
 * Extract subdomain from host (e.g., "acme.witylogix.com" → "acme").
 */
function extractSubdomain(host: string): string | null {
  const parts = host.split(".");
  if (parts.length < 3) return null; // Not a subdomain

  const subdomain = parts[0];
  if (subdomain.length < 1) return null;

  return subdomain;
}

/**
 * Hash API key for storage (SHA-256).
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );
  return Buffer.from(hash).toString("hex");
}

/**
 * Constant-time string comparison (prevents timing attacks).
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// ─── CACHE OPERATIONS ───────────────────────────────────────────────────

/**
 * Get from cache if not expired.
 */
function getFromCache(key: string, strategy: string): TenantContext | null {
  const cached = tenantCache.get(`${key}:${strategy}`);
  if (!cached) return null;

  if (cached.expiresAt < Date.now()) {
    tenantCache.delete(`${key}:${strategy}`);
    return null;
  }

  return cached.context;
}

/**
 * Store in cache.
 */
function cacheResult(
  key: string,
  strategy: string,
  context: TenantContext,
): void {
  tenantCache.set(`${key}:${strategy}`, {
    context,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

export type PlanTier = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";
