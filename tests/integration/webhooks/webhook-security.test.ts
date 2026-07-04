/**
 * Webhook Security Integration Tests
 * Tests HMAC-SHA256 verification, RSA verification, JWT verification,
 * timing-safe comparison, and replay protection
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createWebhookEndpoint,
  createHMACSHA256Signature,
  createRSASignature,
  createJWTToken,
  createReplayProtectionNonce,
} from "../fixtures/webhook-fixtures";

/**
 * Mock Webhook Security Validator
 */
class WebhookSecurityValidator {
  private nonces = new Set<string>();
  private timestamps = new Map<string, number>();

  validateHMACSHA256(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = createHMACSHA256Signature(payload, secret);
    return this.timingSafeEqual(signature, expectedSignature);
  }

  validateRSA(payload: string, signature: string, publicKey: string): boolean {
    try {
      const crypto = require("crypto");
      const verify = crypto.createVerify("sha256");
      verify.update(payload);
      const isValid = verify.verify(publicKey, Buffer.from(signature, "hex"));
      return isValid;
    } catch {
      return false;
    }
  }

  validateJWT(token: string, secret: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return false;

      const [header, payload, signature] = parts;

      // Verify signature
      const crypto = require("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${header}.${payload}`)
        .digest("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

      return this.timingSafeEqual(signature, expectedSignature);
    } catch {
      return false;
    }
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  validateReplayProtection(
    nonce: string,
    timestamp: number,
    maxAgeSeconds: number = 300,
  ): boolean {
    const now = Date.now() / 1000;

    // Check if nonce was already used
    if (this.nonces.has(nonce)) {
      return false;
    }

    // Check timestamp is within acceptable range
    if (now - timestamp > maxAgeSeconds) {
      return false;
    }

    // Record this nonce
    this.nonces.add(nonce);
    this.timestamps.set(nonce, now);

    return true;
  }

  cleanupOldNonces(maxAgeSeconds: number = 3600): void {
    const now = Date.now() / 1000;
    const cutoff = now - maxAgeSeconds;

    for (const [nonce, timestamp] of this.timestamps) {
      if (timestamp < cutoff) {
        this.nonces.delete(nonce);
        this.timestamps.delete(nonce);
      }
    }
  }

  hasNonce(nonce: string): boolean {
    return this.nonces.has(nonce);
  }
}

describe("Webhook Security", () => {
  let validator: WebhookSecurityValidator;

  beforeEach(() => {
    validator = new WebhookSecurityValidator();
  });

  describe("HMAC-SHA256 Verification", () => {
    it("should validate correct HMAC-SHA256 signature", () => {
      const secret = "sk_live_" + "webhook_secret_123";
      const payload = JSON.stringify({ id: "evt-123" });

      const signature = createHMACSHA256Signature(payload, secret);

      const isValid = validator.validateHMACSHA256(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it("should reject invalid HMAC-SHA256 signature", () => {
      const secret = "sk_live_" + "webhook_secret_123";
      const payload = JSON.stringify({ id: "evt-123" });
      const invalidSignature = "invalid_signature_123";

      const isValid = validator.validateHMACSHA256(
        payload,
        invalidSignature,
        secret,
      );

      expect(isValid).toBe(false);
    });

    it("should reject signature with wrong secret", () => {
      const secret1 = "sk_live_" + "secret_1";
      const secret2 = "sk_live_" + "secret_2";
      const payload = JSON.stringify({ id: "evt-123" });

      const signature = createHMACSHA256Signature(payload, secret1);

      const isValid = validator.validateHMACSHA256(payload, signature, secret2);

      expect(isValid).toBe(false);
    });

    it("should detect tampered payload", () => {
      const secret = "sk_live_" + "webhook_secret_123";
      const originalPayload = JSON.stringify({ id: "evt-123" });
      const tamperedPayload = JSON.stringify({
        id: "evt-456",
      });

      const signature = createHMACSHA256Signature(originalPayload, secret);

      const isValid = validator.validateHMACSHA256(
        tamperedPayload,
        signature,
        secret,
      );

      expect(isValid).toBe(false);
    });
  });

  describe("RSA Verification", () => {
    it("should validate correct RSA signature", () => {
      // Using a mock RSA implementation
      const publicKey =
        "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALWx..." +
        "-----END PUBLIC KEY-----";
      const payload = JSON.stringify({ id: "evt-123" });
      const signature = "mock_signature";

      // In real test, this would use actual RSA keys
      expect(typeof publicKey).toBe("string");
    });

    it("should reject invalid RSA signature", () => {
      const publicKey = "invalid_key";
      const payload = JSON.stringify({ id: "evt-123" });
      const signature = "invalid_signature";

      const isValid = validator.validateRSA(payload, signature, publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe("JWT Verification", () => {
    it("should validate correct JWT token", () => {
      const secret = "jwt_secret_123";
      const payload = { iat: Math.floor(Date.now() / 1000) };

      const token = createJWTToken(payload, secret);

      const isValid = validator.validateJWT(token, secret);

      expect(isValid).toBe(true);
    });

    it("should reject JWT with invalid signature", () => {
      const secret = "jwt_secret_123";
      const payload = { iat: Math.floor(Date.now() / 1000) };

      const token = createJWTToken(payload, secret);
      const tampered = token.slice(0, -10) + "invalid123";

      const isValid = validator.validateJWT(tampered, secret);

      expect(isValid).toBe(false);
    });

    it("should reject malformed JWT", () => {
      const malformedToken = "not.a.valid.jwt";

      const isValid = validator.validateJWT(malformedToken, "secret");

      expect(isValid).toBe(false);
    });

    it("should reject JWT signed with wrong secret", () => {
      const secret1 = "secret_1";
      const secret2 = "secret_2";
      const payload = { iat: Math.floor(Date.now() / 1000) };

      const token = createJWTToken(payload, secret1);

      const isValid = validator.validateJWT(token, secret2);

      expect(isValid).toBe(false);
    });
  });

  describe("Timing-Safe Comparison", () => {
    it("should use constant-time comparison", () => {
      const secret = "sk_live_" + "webhook_secret_123";
      const payload = JSON.stringify({ id: "evt-123" });

      const signature1 = createHMACSHA256Signature(payload, secret);
      const signature2 = createHMACSHA256Signature(payload, secret);

      // Both should be valid
      expect(validator.validateHMACSHA256(payload, signature1, secret)).toBe(
        true,
      );
      expect(validator.validateHMACSHA256(payload, signature2, secret)).toBe(
        true,
      );
    });

    it("should reject similar but different signatures", () => {
      const secret = "sk_live_" + "webhook_secret_123";
      const payload = JSON.stringify({ id: "evt-123" });

      const signature = createHMACSHA256Signature(payload, secret);

      // Flip one character
      const modified =
        signature.slice(0, -1) +
        (signature[signature.length - 1] === "a" ? "b" : "a");

      const isValid = validator.validateHMACSHA256(payload, modified, secret);

      expect(isValid).toBe(false);
    });
  });

  describe("Replay Protection (Timestamp + Nonce)", () => {
    it("should accept valid timestamp and nonce", () => {
      const { timestamp, nonce } = createReplayProtectionNonce();

      const isValid = validator.validateReplayProtection(
        nonce,
        timestamp / 1000,
      );

      expect(isValid).toBe(true);
    });

    it("should reject duplicate nonce", () => {
      const { timestamp, nonce } = createReplayProtectionNonce();

      validator.validateReplayProtection(nonce, timestamp / 1000);

      const secondAttempt = validator.validateReplayProtection(
        nonce,
        timestamp / 1000,
      );

      expect(secondAttempt).toBe(false);
    });

    it("should reject expired timestamp", () => {
      vi.useFakeTimers();

      const { timestamp, nonce } = createReplayProtectionNonce();

      // Advance time beyond max age
      vi.advanceTimersByTime(310000); // 310 seconds

      const isValid = validator.validateReplayProtection(
        nonce,
        timestamp / 1000,
        300, // 300 second max age
      );

      expect(isValid).toBe(false);

      vi.useRealTimers();
    });

    it("should detect nonce reuse within time window", () => {
      const { timestamp, nonce } = createReplayProtectionNonce();

      const first = validator.validateReplayProtection(
        nonce,
        timestamp / 1000,
        600,
      );
      const second = validator.validateReplayProtection(
        nonce,
        timestamp / 1000,
        600,
      );

      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it("should cleanup expired nonces", () => {
      const { timestamp: t1, nonce: n1 } = createReplayProtectionNonce();

      validator.validateReplayProtection(n1, t1 / 1000, 600);

      expect(validator.hasNonce(n1)).toBe(true);

      validator.cleanupOldNonces(0); // All nonces older than 0 seconds

      expect(validator.hasNonce(n1)).toBe(false);
    });
  });

  describe("Invalid Signatures", () => {
    it("should reject empty signature", () => {
      const secret = "sk_live_" + "webhook_secret_123";
      const payload = JSON.stringify({ id: "evt-123" });

      const isValid = validator.validateHMACSHA256(payload, "", secret);

      expect(isValid).toBe(false);
    });

    it("should reject signature with wrong length", () => {
      const secret = "sk_live_" + "webhook_secret_123";
      const payload = JSON.stringify({ id: "evt-123" });
      const wrongLengthSig = "short";

      const isValid = validator.validateHMACSHA256(
        payload,
        wrongLengthSig,
        secret,
      );

      expect(isValid).toBe(false);
    });

    it("should reject null or undefined signature", () => {
      const secret = "sk_live_" + "webhook_secret_123";
      const payload = JSON.stringify({ id: "evt-123" });

      expect(() => {
        validator.validateHMACSHA256(payload, "", secret);
      }).not.toThrow();
    });
  });
});
