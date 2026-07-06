/**
 * API Key Service — Generate, validate, rotate, and revoke API keys.
 *
 * Key features:
 * - Generates keys with format: wl_live_<32 random chars> (production)
 *                             wl_test_<32 random chars> (sandbox)
 * - Stores SHA-256 hashes for security (never store plaintext keys)
 * - Validates expiry, active status, and scopes
 * - Constant-time comparison for validation (prevents timing attacks)
 * - Tracks last used timestamp and IP address
 * - Supports fine-grained scopes (READ, WRITE, ADMIN, WEBHOOK, INTEGRATION)
 *
 * Security notes:
 * - Keys are shown to user only once (at creation time)
 * - All key lookups use prefix first (fast), then hash verification (secure)
 * - Rotation creates new key, deactivates old (no downtime)
 */

import { randomBytes } from "crypto";
import type {
  ApiKeyScope,
  ApiKeyResponse,
  ApiKeyValidationResult,
} from "./types";
import { prisma } from "@witylogix/db";

// ─── CONSTANTS ──────────────────────────────────────────────────────────

const KEY_LIVE_PREFIX = "wl_live_";
const KEY_TEST_PREFIX = "wl_test_";
const KEY_RANDOM_BYTES = 32;
const KEY_PREFIX_LENGTH = 8;

// ─── GENERATE API KEY ──────────────────────────────────────────────────

/**
 * Generate a new API key for an organization.
 *
 * Returns the full secret (shown only once to user).
 * The hash is stored in database for verification.
 *
 * @param orgId - Organization ID
 * @param name - Human-readable name (e.g., "Shopify Integration")
 * @param scopes - Permissions (READ, WRITE, ADMIN, WEBHOOK, INTEGRATION)
 * @param options - Optional: { isTest, expiresAt, permissions, rateLimit }
 * @returns ApiKeyResponse with full secret
 */
export async function generateApiKey(
  orgId: string,
  name: string,
  scopes: ApiKeyScope[],
  options?: {
    isTest?: boolean;
    expiresAt?: Date;
    permissions?: Record<string, boolean>;
    rateLimit?: number;
  },
): Promise<ApiKeyResponse> {
  // Generate random bytes
  const randomPart = randomBytes(KEY_RANDOM_BYTES).toString("base64url");

  // Build full secret with prefix
  const prefix = options?.isTest ? KEY_TEST_PREFIX : KEY_LIVE_PREFIX;
  const secret = prefix + randomPart;

  // Hash for storage
  const keyHash = await hashKey(secret);

  // Create in database
  const dbKey = await prisma.apiKey.create({
    data: {
      orgId,
      name,
      keyHash,
      prefix:
        prefix +
        randomPart.slice(0, KEY_PREFIX_LENGTH - KEY_LIVE_PREFIX.length),
      scopes,
      permissions: options?.permissions || {},
      rateLimit: options?.rateLimit || 100,
      expiresAt: options?.expiresAt || null,
      isActive: true,
      createdBy: "", // Set by caller (current user ID)
    },
  });

  return {
    id: dbKey.id,
    name: dbKey.name,
    secret, // Full key shown only once
    prefix: dbKey.prefix,
    scopes: dbKey.scopes as any,
    expiresAt: dbKey.expiresAt,
    createdAt: dbKey.createdAt,
  };
}

// ─── VALIDATE API KEY ──────────────────────────────────────────────────

/**
 * Validate an API key from a request.
 *
 * Checks:
 * - Key format (wl_live_ or wl_test_)
 * - Prefix exists in database
 * - Hash matches
 * - Not revoked/inactive
 * - Not expired
 *
 * @param rawKey - Full API key from request
 * @returns Validation result with orgId and scopes if valid
 */
export async function validateApiKey(
  rawKey: string,
): Promise<ApiKeyValidationResult> {
  // Check format
  if (
    !rawKey.startsWith(KEY_LIVE_PREFIX) &&
    !rawKey.startsWith(KEY_TEST_PREFIX)
  ) {
    return {
      valid: false,
      reason: "INVALID",
    };
  }

  // Extract prefix (first 8 chars, e.g., "wl_live_")
  const prefix = rawKey.slice(0, KEY_PREFIX_LENGTH);

  // Lookup by prefix (fast)
  const dbKey = await prisma.apiKey.findFirst({
    where: { prefix },
  });

  if (!dbKey) {
    return {
      valid: false,
      reason: "NOT_FOUND",
    };
  }

  if (!dbKey.isActive) {
    return {
      valid: false,
      reason: "REVOKED",
    };
  }

  // Check expiry
  if (dbKey.expiresAt && new Date() > dbKey.expiresAt) {
    return {
      valid: false,
      reason: "EXPIRED",
    };
  }

  // Verify hash (constant-time comparison)
  const calculatedHash = await hashKey(rawKey);
  if (!constantTimeEquals(calculatedHash, dbKey.keyHash)) {
    return {
      valid: false,
      reason: "INVALID",
    };
  }

  return {
    valid: true,
    keyId: dbKey.id,
    orgId: dbKey.orgId,
    scopes: dbKey.scopes as any,
    createdAt: dbKey.createdAt,
    lastUsedAt: dbKey.lastUsedAt,
    lastUsedIp: dbKey.lastUsedIp,
  };
}

// ─── ROTATE API KEY ────────────────────────────────────────────────────

/**
 * Rotate an API key (generate new, deactivate old).
 *
 * Allows seamless key rotation without service interruption.
 * Old key becomes inactive immediately; new key takes over.
 *
 * @param keyId - Key ID to rotate
 * @returns New ApiKeyResponse with secret
 */
export async function rotateApiKey(keyId: string): Promise<ApiKeyResponse> {
  // Get old key
  const oldKey = await prisma.apiKey.findUniqueOrThrow({
    where: { id: keyId },
  });

  // Generate new key with same properties
  const newKeyResponse = await generateApiKey(
    oldKey.orgId,
    `${oldKey.name} (rotated)`,
    oldKey.scopes as any,
    {
      isTest: oldKey.prefix.startsWith(KEY_TEST_PREFIX),
      expiresAt: oldKey.expiresAt || undefined,
      permissions: (oldKey.permissions as any) || {},
      rateLimit: oldKey.rateLimit,
    },
  );

  // Deactivate old key
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
  });

  return newKeyResponse;
}

// ─── REVOKE API KEY ────────────────────────────────────────────────────

/**
 * Revoke (soft-delete) an API key.
 *
 * Marks key as inactive; can be reactivated if needed.
 * Soft delete preserves audit trail.
 *
 * @param keyId - Key ID to revoke
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
  });
}

// ─── REACTIVATE API KEY ────────────────────────────────────────────────

/**
 * Reactivate a previously revoked API key.
 *
 * @param keyId - Key ID to reactivate
 */
export async function reactivateApiKey(keyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: true },
  });
}

// ─── LIST API KEYS ─────────────────────────────────────────────────────

/**
 * List all API keys for an organization (without secrets).
 *
 * Returns public data only (name, prefix, scopes, created date, last used).
 *
 * @param orgId - Organization ID
 * @returns List of API keys (no secrets)
 */
export async function listApiKeys(orgId: string): Promise<
  Array<{
    id: string;
    name: string;
    prefix: string;
    scopes: ApiKeyScope[];
    rateLimit: number;
    isActive: boolean;
    lastUsedAt: Date | null;
    lastUsedIp: string | null;
    expiresAt: Date | null;
    createdAt: Date;
  }>
> {
  const keys = await prisma.apiKey.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      rateLimit: true,
      isActive: true,
      lastUsedAt: true,
      lastUsedIp: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return keys as any;
}

// ─── UPDATE SCOPES ─────────────────────────────────────────────────────

/**
 * Update scopes for an API key.
 *
 * Modifies permissions without regenerating the key (useful for
 * restricting access to leaked keys).
 *
 * @param keyId - Key ID to update
 * @param scopes - New scopes to assign
 */
export async function updateApiKeyScopes(
  keyId: string,
  scopes: ApiKeyScope[],
): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { scopes },
  });
}

// ─── UPDATE RATE LIMIT ──────────────────────────────────────────────────

/**
 * Update rate limit for an API key.
 *
 * @param keyId - Key ID to update
 * @param rateLimit - New requests-per-minute limit
 */
export async function updateApiKeyRateLimit(
  keyId: string,
  rateLimit: number,
): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { rateLimit },
  });
}

// ─── UPDATE EXPIRATION ──────────────────────────────────────────────────

/**
 * Update expiration date for an API key.
 *
 * Set to null to remove expiration.
 *
 * @param keyId - Key ID to update
 * @param expiresAt - New expiration date or null
 */
export async function updateApiKeyExpiration(
  keyId: string,
  expiresAt: Date | null,
): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { expiresAt },
  });
}

// ─── RECORD USAGE ──────────────────────────────────────────────────────

/**
 * Update last used timestamp and IP address for an API key.
 *
 * Called during request processing to track usage patterns.
 *
 * @param keyId - Key ID
 * @param ipAddress - Client IP address
 */
export async function recordApiKeyUsage(
  keyId: string,
  ipAddress: string,
): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      lastUsedAt: new Date(),
      lastUsedIp: ipAddress,
    },
  });
}

// ─── DELETE API KEY ────────────────────────────────────────────────────

/**
 * Permanently delete an API key (hard delete).
 *
 * Use with caution - this removes all audit trail.
 * Prefer revokeApiKey() for normal operations.
 *
 * @param keyId - Key ID to delete
 */
export async function deleteApiKey(keyId: string): Promise<void> {
  await prisma.apiKey.delete({
    where: { id: keyId },
  });
}

// ─── CHECK QUOTA ────────────────────────────────────────────────────────

/**
 * Check if organization has reached max API keys for their plan.
 *
 * @param orgId - Organization ID
 * @param planMaxKeys - Maximum keys allowed by plan
 * @returns true if under limit, false if at limit
 */
export async function checkApiKeyQuota(
  orgId: string,
  planMaxKeys: number,
): Promise<boolean> {
  const activeKeyCount = await prisma.apiKey.count({
    where: { orgId, isActive: true },
  });

  return activeKeyCount < planMaxKeys;
}

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────

/**
 * Hash an API key using SHA-256.
 *
 * Always hash keys before storage to prevent plaintext exposure.
 */
async function hashKey(key: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return Buffer.from(hash).toString("hex");
}

/**
 * Constant-time string comparison.
 *
 * Prevents timing attacks by comparing all bytes,
 * not short-circuiting on first mismatch.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
