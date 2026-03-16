/**
 * Signature Verifier
 * Webhook signature verification with timestamp validation and replay attack prevention
 */

import { createHmac, randomBytes } from "crypto";

/**
 * Supported signature algorithms
 */
export type SignatureAlgorithm = "sha256" | "sha512";

/**
 * Signature verification options
 */
export interface VerificationOptions {
  algorithm?: SignatureAlgorithm;
  maxAgeSeconds?: number;
  checkNonce?: boolean;
}

/**
 * SignatureVerifier
 * Handles webhook signature generation, verification, and replay attack prevention
 */
export class SignatureVerifier {
  private nonceStore: Map<string, Set<string>> = new Map(); // tenantId -> nonces
  private maxAgeSeconds: number = 5 * 60; // 5 minutes default
  private nonceCleanupInterval?: NodeJS.Timeout;

  /**
   * Initialize signature verifier
   * @param maxAgeSeconds - Maximum age for timestamp validation
   */
  constructor(maxAgeSeconds?: number) {
    if (maxAgeSeconds) {
      this.maxAgeSeconds = maxAgeSeconds;
    }
    this.startNonceCleanup();
  }

  /**
   * Generate HMAC signature for payload
   * @param payload - Payload string to sign
   * @param secret - Webhook secret
   * @param algorithm - Signature algorithm (default: sha256)
   * @returns Hex-encoded signature
   */
  generateSignature(
    payload: string,
    secret: string,
    algorithm: SignatureAlgorithm = "sha256"
  ): string {
    const hmac = createHmac(algorithm, secret);
    hmac.update(payload);
    return hmac.digest("hex");
  }

  /**
   * Verify webhook signature and timestamp
   * @param payload - Original payload string
   * @param signature - Signature to verify
   * @param timestamp - Timestamp string (ISO format)
   * @param secret - Webhook secret
   * @param options - Verification options
   * @returns Verification result with detailed status
   */
  verify(
    payload: string,
    signature: string,
    timestamp: string,
    secret: string,
    options: VerificationOptions = {}
  ): {
    valid: boolean;
    reason?: string;
  } {
    // Validate timestamp
    const timestampValid = this.validateTimestamp(
      timestamp,
      options.maxAgeSeconds || this.maxAgeSeconds
    );
    if (!timestampValid) {
      return {
        valid: false,
        reason: "Timestamp too old or invalid format",
      };
    }

    // Verify signature
    const algorithm = options.algorithm || "sha256";
    const expectedSignature = this.generateSignature(payload, secret, algorithm);

    if (!this.constantTimeCompare(signature, expectedSignature)) {
      return {
        valid: false,
        reason: "Signature mismatch",
      };
    }

    return { valid: true };
  }

  /**
   * Verify with replay attack prevention
   * @param payload - Original payload string
   * @param signature - Signature to verify
   * @param timestamp - Timestamp string
   * @param nonce - Nonce for replay prevention
   * @param tenantId - Tenant ID for nonce scoping
   * @param secret - Webhook secret
   * @param options - Verification options
   * @returns Verification result
   */
  verifyWithNonce(
    payload: string,
    signature: string,
    timestamp: string,
    nonce: string,
    tenantId: string,
    secret: string,
    options: VerificationOptions = {}
  ): {
    valid: boolean;
    reason?: string;
  } {
    // First verify signature and timestamp
    const signatureValid = this.verify(
      payload,
      signature,
      timestamp,
      secret,
      options
    );
    if (!signatureValid.valid) {
      return signatureValid;
    }

    // Check nonce for replay attack prevention
    if (!this.validateNonce(nonce, tenantId)) {
      return {
        valid: false,
        reason: "Nonce already used (potential replay attack)",
      };
    }

    // Store nonce to prevent reuse
    this.storeNonce(nonce, tenantId);

    return { valid: true };
  }

  /**
   * Validate timestamp is within acceptable range
   * @param timestamp - Timestamp string (ISO format)
   * @param maxAgeSeconds - Maximum age in seconds
   * @returns True if timestamp is valid
   */
  private validateTimestamp(timestamp: string, maxAgeSeconds: number): boolean {
    try {
      const timestampMs = new Date(timestamp).getTime();
      if (isNaN(timestampMs)) {
        return false;
      }

      const now = Date.now();
      const ageMs = now - timestampMs;

      // Check if timestamp is in the future (clock skew tolerance: 30s)
      if (ageMs < -30000) {
        return false;
      }

      // Check if timestamp is too old
      if (ageMs > maxAgeSeconds * 1000) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate nonce hasn't been used before
   * @param nonce - Nonce to check
   * @param tenantId - Tenant ID for scoping
   * @returns True if nonce is new
   */
  private validateNonce(nonce: string, tenantId: string): boolean {
    const tenantNonces = this.nonceStore.get(tenantId);
    if (!tenantNonces) {
      return true; // No nonces stored yet
    }
    return !tenantNonces.has(nonce);
  }

  /**
   * Store nonce to prevent reuse
   * @param nonce - Nonce to store
   * @param tenantId - Tenant ID for scoping
   */
  private storeNonce(nonce: string, tenantId: string): void {
    if (!this.nonceStore.has(tenantId)) {
      this.nonceStore.set(tenantId, new Set());
    }
    this.nonceStore.get(tenantId)!.add(nonce);
  }

  /**
   * Generate a random nonce for webhook delivery
   * @returns Hex-encoded nonce
   */
  static generateNonce(): string {
    return randomBytes(16).toString("hex");
  }

  /**
   * Generate a timestamp in ISO format
   * @returns ISO timestamp string
   */
  static generateTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   */
  private constantTimeCompare(a: string, b: string): boolean {
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
   * Build signed webhook request headers
   * @param payload - Payload string
   * @param secret - Webhook secret
   * @param nonce - Optional nonce for replay prevention
   * @param algorithm - Signature algorithm
   * @returns Headers object
   */
  buildHeaders(
    payload: string,
    secret: string,
    nonce?: string,
    algorithm: SignatureAlgorithm = "sha256"
  ): Record<string, string> {
    const timestamp = SignatureVerifier.generateTimestamp();
    const signature = this.generateSignature(payload, secret, algorithm);
    const finalNonce = nonce || SignatureVerifier.generateNonce();

    return {
      "X-Witylogix-Signature": signature,
      "X-Witylogix-Timestamp": timestamp,
      "X-Witylogix-Nonce": finalNonce,
      "X-Witylogix-Algorithm": algorithm,
    };
  }

  /**
   * Clean up old nonces
   * Called automatically by cleanup timer
   */
  private cleanupNonces(): void {
    // Clear all nonces every 30 minutes (should be > maxAgeSeconds)
    for (const key of this.nonceStore.keys()) {
      this.nonceStore.delete(key);
    }
  }

  /**
   * Start automatic nonce cleanup timer
   */
  private startNonceCleanup(): void {
    // Run cleanup every 30 minutes
    this.nonceCleanupInterval = setInterval(() => {
      this.cleanupNonces();
    }, 30 * 60 * 1000);

    // Don't keep process alive if this is the only interval
    if (this.nonceCleanupInterval.unref) {
      this.nonceCleanupInterval.unref();
    }
  }

  /**
   * Stop nonce cleanup timer
   */
  stopCleanup(): void {
    if (this.nonceCleanupInterval) {
      clearInterval(this.nonceCleanupInterval);
    }
  }

  /**
   * Get nonce statistics
   */
  getNonceStats(): {
    tenants: number;
    totalNonces: number;
  } {
    let totalNonces = 0;
    for (const nonces of this.nonceStore.values()) {
      totalNonces += nonces.size;
    }

    return {
      tenants: this.nonceStore.size,
      totalNonces,
    };
  }
}
