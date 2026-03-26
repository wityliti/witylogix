/**
 * Webhook Secret Service — Secure webhook signing and verification.
 *
 * Features:
 * - Generate HMAC secrets for webhook endpoints
 * - Sign webhook payloads with HMAC (SHA-256 or SHA-512)
 * - Verify signatures with constant-time comparison (prevents timing attacks)
 * - Support secret rotation with overlap period (24 hours)
 * - Track all webhooks per organization
 *
 * Usage:
 *   1. Generate secret: const secret = await generateSecret(orgId, endpoint)
 *   2. Sign payload: const signature = signPayload(secret, payload)
 *   3. Send webhook with X-Witylogix-Signature header
 *   4. Recipient verifies: verifySignature(secret, payload, signature)
 *   5. Rotate: await rotateSecret(secretId) - old secret still valid for 24h
 */

import { randomBytes, createHmac } from "crypto";
import { prisma } from "@witylogix/db";

// ─── TYPES ─────────────────────────────────────────────────────────────

export interface WebhookSecret {
  id: string;
  orgId: string;
  endpoint: string;
  secret: string; // Base64-encoded secret
  algorithm: "HMAC_SHA256" | "HMAC_SHA512";
  isActive: boolean;
  rotatedAt: Date | null;
  createdAt: Date;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────

const SECRET_BYTES = 32; // 256 bits
const OVERLAP_PERIOD = 24 * 60 * 60 * 1000; // 24 hours after rotation
const CLOCK_SKEW = 5 * 60; // 5 minutes

// ─── GENERATE SECRET ───────────────────────────────────────────────────

/**
 * Generate a new webhook secret for an endpoint.
 *
 * Creates a cryptographically secure random secret and stores it.
 * If a secret already exists for this endpoint, it's deactivated.
 *
 * @param orgId - Organization ID
 * @param endpoint - Webhook endpoint URL (e.g., "https://acme.com/webhooks/shipments")
 * @param algorithm - Signature algorithm (default: HMAC_SHA256)
 * @returns WebhookSecret with generated secret
 */
export async function generateSecret(
  orgId: string,
  endpoint: string,
  algorithm: "HMAC_SHA256" | "HMAC_SHA512" = "HMAC_SHA256"
): Promise<WebhookSecret> {
  // Generate cryptographically secure random bytes
  const randomSecret = randomBytes(SECRET_BYTES);
  const secretBase64 = randomSecret.toString("base64");

  // Deactivate any existing active secret for this endpoint
  await prisma.webhookSecret.updateMany({
    where: { orgId, endpoint, isActive: true },
    data: { isActive: false },
  });

  // Create new secret
  const dbSecret = await prisma.webhookSecret.create({
    data: {
      orgId,
      endpoint,
      secret: secretBase64,
      algorithm,
      isActive: true,
      rotatedAt: null,
    },
  });

  return dbSecret as any;
}

// ─── SIGN PAYLOAD ──────────────────────────────────────────────────────

/**
 * Sign a webhook payload with HMAC.
 *
 * Creates signature using the algorithm stored with the secret.
 * Returns header value for X-Witylogix-Signature.
 *
 * @param secretValue - Base64-encoded secret value
 * @param payload - JSON payload to sign
 * @param algorithm - Algorithm (HMAC_SHA256 or HMAC_SHA512)
 * @returns HMAC signature as hex string
 */
export function signPayload(
  secretValue: string,
  payload: any,
  algorithm: "HMAC_SHA256" | "HMAC_SHA512" = "HMAC_SHA256"
): string {
  // Decode secret from base64
  const secretBuffer = Buffer.from(secretValue, "base64");

  // Serialize payload deterministically
  const payloadStr = JSON.stringify(payload);

  // Determine hash algorithm
  const hashAlgo = algorithm === "HMAC_SHA512" ? "sha512" : "sha256";

  // Create HMAC signature
  const hmac = createHmac(hashAlgo, secretBuffer);
  hmac.update(payloadStr);

  return hmac.digest("hex");
}

// ─── VERIFY SIGNATURE ──────────────────────────────────────────────────

/**
 * Verify a webhook signature.
 *
 * Compares provided signature against calculated signature using
 * constant-time comparison to prevent timing attacks.
 *
 * @param secretValue - Base64-encoded secret
 * @param payload - Original payload that was signed
 * @param signature - Signature to verify (from X-Witylogix-Signature header)
 * @param algorithm - Algorithm used for signing
 * @returns true if signature is valid
 */
export function verifySignature(
  secretValue: string,
  payload: any,
  signature: string,
  algorithm: "HMAC_SHA256" | "HMAC_SHA512" = "HMAC_SHA256"
): boolean {
  // Calculate expected signature
  const expected = signPayload(secretValue, payload, algorithm);

  // Constant-time comparison (prevents timing attacks)
  return constantTimeEquals(signature, expected);
}

// ─── ROTATE SECRET ─────────────────────────────────────────────────────

/**
 * Rotate a webhook secret.
 *
 * Generates new secret and marks old as inactive (but keeps it valid
 * for 24 hours to allow for clock skew and delayed deliveries).
 *
 * @param secretId - Secret ID to rotate
 * @returns New WebhookSecret
 */
export async function rotateSecret(secretId: string): Promise<WebhookSecret> {
  // Get existing secret
  const oldSecret = await prisma.webhookSecret.findUniqueOrThrow({
    where: { id: secretId },
  });

  // Generate new secret with same algorithm and endpoint
  const newSecret = await generateSecret(
    oldSecret.orgId,
    oldSecret.endpoint,
    oldSecret.algorithm
  );

  // Mark old secret with rotation time (keeps it valid for OVERLAP_PERIOD)
  await prisma.webhookSecret.update({
    where: { id: secretId },
    data: { rotatedAt: new Date() },
  });

  return newSecret as any;
}

// ─── GET WEBHOOK SECRET ────────────────────────────────────────────────

/**
 * Get active secret for a webhook endpoint.
 *
 * Returns the currently active secret (or recently rotated if within overlap).
 *
 * @param orgId - Organization ID
 * @param endpoint - Webhook endpoint URL
 * @returns WebhookSecret or null if not found
 */
export async function getWebhookSecret(
  orgId: string,
  endpoint: string
): Promise<WebhookSecret | null> {
  const secret = await prisma.webhookSecret.findUnique({
    where: { orgId_endpoint: { orgId, endpoint } },
  });

  if (!secret) {
    return null;
  }

  // Check if secret is still valid (even if rotated)
  if (secret.rotatedAt) {
    const ageMs = Date.now() - secret.rotatedAt.getTime();
    if (ageMs > OVERLAP_PERIOD) {
      // Secret too old, treat as invalid
      return null;
    }
  }

  return secret as any;
}

// ─── LIST SECRETS FOR ORG ──────────────────────────────────────────────

/**
 * List all webhook secrets for an organization.
 *
 * @param orgId - Organization ID
 * @returns Array of webhook secrets (without sensitive values)
 */
export async function listWebhookSecrets(
  orgId: string
): Promise<
  Array<{
    id: string;
    endpoint: string;
    algorithm: string;
    isActive: boolean;
    rotatedAt: Date | null;
    createdAt: Date;
  }>
> {
  const secrets = await prisma.webhookSecret.findMany({
    where: { orgId },
    select: {
      id: true,
      endpoint: true,
      algorithm: true,
      isActive: true,
      rotatedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return secrets as any;
}

// ─── DELETE SECRET ─────────────────────────────────────────────────────

/**
 * Delete a webhook secret.
 *
 * Use with caution - receivers won't be able to verify signatures
 * with the old secret anymore.
 *
 * @param secretId - Secret ID to delete
 */
export async function deleteWebhookSecret(secretId: string): Promise<void> {
  await prisma.webhookSecret.delete({
    where: { id: secretId },
  });
}

// ─── TEST SECRET VALIDITY ──────────────────────────────────────────────

/**
 * Test if a secret is still valid (hasn't expired).
 *
 * Useful for pre-flight checks before sending webhook.
 *
 * @param secretId - Secret ID
 * @returns true if secret is valid, false if expired or inactive
 */
export async function isSecretValid(secretId: string): Promise<boolean> {
  const secret = await prisma.webhookSecret.findUnique({
    where: { id: secretId },
  });

  if (!secret || !secret.isActive) {
    return false;
  }

  // Check if recently rotated (still in overlap)
  if (secret.rotatedAt) {
    const ageMs = Date.now() - secret.rotatedAt.getTime();
    if (ageMs > OVERLAP_PERIOD) {
      return false;
    }
  }

  return true;
}

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────

/**
 * Constant-time string comparison.
 *
 * Compares all bytes, not short-circuiting on first mismatch.
 * Prevents timing attacks where attacker could measure how long
 * signature verification takes to deduce partial match.
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

// ─── BUILD WEBHOOK SIGNATURE HEADER ────────────────────────────────────

/**
 * Build complete X-Witylogix-Signature header value.
 *
 * Format: algorithm=HMAC_SHA256, signature=<hex>, timestamp=<unix>, nonce=<random>
 *
 * @param secretValue - Base64-encoded secret
 * @param payload - Payload to sign
 * @param algorithm - Algorithm
 * @returns Header value
 */
export function buildSignatureHeader(
  secretValue: string,
  payload: any,
  algorithm: "HMAC_SHA256" | "HMAC_SHA512" = "HMAC_SHA256"
): string {
  const signature = signPayload(secretValue, payload, algorithm);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString("hex");

  return `algorithm=${algorithm}, signature=${signature}, timestamp=${timestamp}, nonce=${nonce}`;
}

// ─── PARSE SIGNATURE HEADER ────────────────────────────────────────────

/**
 * Parse X-Witylogix-Signature header.
 *
 * @param headerValue - Header value from request
 * @returns Parsed components or null if invalid
 */
export function parseSignatureHeader(
  headerValue: string
): {
  algorithm: string;
  signature: string;
  timestamp: number;
  nonce: string;
} | null {
  const parts = headerValue.split(",").map((p) => p.trim());
  const parsed: any = {};

  for (const part of parts) {
    const [key, value] = part.split("=");
    parsed[key] = value;
  }

  if (!parsed.algorithm || !parsed.signature || !parsed.timestamp) {
    return null;
  }

  return {
    algorithm: parsed.algorithm,
    signature: parsed.signature,
    timestamp: parseInt(parsed.timestamp, 10),
    nonce: parsed.nonce || "",
  };
}

// ─── VERIFY WITH CLOCK SKEW ────────────────────────────────────────────

/**
 * Verify signature including timestamp validation (prevents replay attacks).
 *
 * @param secretValue - Base64-encoded secret
 * @param payload - Original payload
 * @param signature - Signature to verify
 * @param timestamp - Timestamp from header (Unix seconds)
 * @param algorithm - Algorithm
 * @returns true if signature valid and timestamp fresh
 */
export function verifyWithTimestamp(
  secretValue: string,
  payload: any,
  signature: string,
  timestamp: number,
  algorithm: "HMAC_SHA256" | "HMAC_SHA512" = "HMAC_SHA256"
): boolean {
  // Check timestamp freshness (allow 5 minute clock skew)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > CLOCK_SKEW) {
    return false; // Timestamp too old (potential replay attack)
  }

  // Verify signature
  return verifySignature(secretValue, payload, signature, algorithm);
}
