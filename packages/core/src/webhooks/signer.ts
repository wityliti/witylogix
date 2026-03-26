/**
 * Webhook Signing and Verification
 * Implements HMAC-SHA256 signing for secure webhook delivery
 */

import { createHmac, randomBytes } from "crypto";

/**
 * Sign a webhook payload with HMAC-SHA256
 * @param payload - Stringified payload to sign
 * @param secret - Webhook secret key
 * @returns Hex-encoded signature
 */
export function signPayload(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

/**
 * Verify a webhook signature
 * Uses constant-time comparison to prevent timing attacks
 * @param payload - Stringified payload
 * @param signature - Signature to verify
 * @param secret - Webhook secret key
 * @returns True if signature is valid, false otherwise
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = signPayload(payload, secret);
  return constantTimeCompare(signature, expectedSignature);
}

/**
 * Constant-time string comparison
 * Prevents timing attacks on signature verification
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate a secure webhook secret
 * Uses 32 bytes (256 bits) of random data
 * @returns Hex-encoded secret
 */
export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Standard webhook header names
 */
export const WEBHOOK_HEADERS = {
  SIGNATURE: "X-Witylogix-Signature",
  TIMESTAMP: "X-Witylogix-Timestamp",
  EVENT: "X-Witylogix-Event",
  DELIVERY_ID: "X-Witylogix-Delivery-Id",
} as const;
