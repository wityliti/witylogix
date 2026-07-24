/**
 * Signature Verifier Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignatureVerifier } from "../signature-verifier";

describe("SignatureVerifier", () => {
  let verifier: SignatureVerifier;

  beforeEach(() => {
    verifier = new SignatureVerifier(300); // 5 minutes
  });

  describe("generateSignature", () => {
    it("should generate consistent signature", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";

      const sig1 = verifier.generateSignature(payload, secret);
      const sig2 = verifier.generateSignature(payload, secret);

      expect(sig1).toBe(sig2);
    });

    it("should generate different signatures for different secrets", () => {
      const payload = '{"event":"order.created"}';

      const sig1 = verifier.generateSignature(payload, "secret1");
      const sig2 = verifier.generateSignature(payload, "secret2");

      expect(sig1).not.toBe(sig2);
    });

    it("should support sha512 algorithm", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";

      const sig256 = verifier.generateSignature(payload, secret, "sha256");
      const sig512 = verifier.generateSignature(payload, secret, "sha512");

      expect(sig256).not.toBe(sig512);
      expect(sig512.length).toBeGreaterThan(sig256.length);
    });
  });

  describe("verify", () => {
    it("should verify valid signature", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const timestamp = new Date().toISOString();

      const signature = verifier.generateSignature(payload, secret);
      const result = verifier.verify(payload, signature, timestamp, secret);

      expect(result.valid).toBe(true);
    });

    it("should reject invalid signature", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const timestamp = new Date().toISOString();
      const invalidSignature = "invalid_signature";

      const result = verifier.verify(
        payload,
        invalidSignature,
        timestamp,
        secret,
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Signature mismatch");
    });

    it("should reject old timestamp", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min old

      const signature = verifier.generateSignature(payload, secret);
      const result = verifier.verify(payload, signature, oldTimestamp, secret);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Timestamp too old");
    });

    it("should reject future timestamp", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const futureTimestamp = new Date(
        Date.now() + 10 * 60 * 1000,
      ).toISOString(); // 10 min future

      const signature = verifier.generateSignature(payload, secret);
      const result = verifier.verify(
        payload,
        signature,
        futureTimestamp,
        secret,
      );

      expect(result.valid).toBe(false);
    });

    it("should accept recent future timestamp (clock skew tolerance)", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const slightlyFutureTimestamp = new Date(
        Date.now() + 10 * 1000,
      ).toISOString(); // 10 sec future

      const signature = verifier.generateSignature(payload, secret);
      const result = verifier.verify(
        payload,
        signature,
        slightlyFutureTimestamp,
        secret,
      );

      expect(result.valid).toBe(true);
    });
  });

  describe("verifyWithNonce", () => {
    it("should verify signature and check nonce", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const timestamp = new Date().toISOString();
      const nonce = SignatureVerifier.generateNonce();
      const tenantId = "tenant_1";

      const signature = verifier.generateSignature(payload, secret);
      const result = verifier.verifyWithNonce(
        payload,
        signature,
        timestamp,
        nonce,
        tenantId,
        secret,
      );

      expect(result.valid).toBe(true);
    });

    it("should reject replay attacks (duplicate nonce)", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const timestamp = new Date().toISOString();
      const nonce = SignatureVerifier.generateNonce();
      const tenantId = "tenant_1";

      const signature = verifier.generateSignature(payload, secret);

      // First request should succeed
      const result1 = verifier.verifyWithNonce(
        payload,
        signature,
        timestamp,
        nonce,
        tenantId,
        secret,
      );
      expect(result1.valid).toBe(true);

      // Second request with same nonce should fail
      const result2 = verifier.verifyWithNonce(
        payload,
        signature,
        timestamp,
        nonce,
        tenantId,
        secret,
      );
      expect(result2.valid).toBe(false);
      expect(result2.reason).toContain("replay attack");
    });

    it("should allow different nonces from same tenant", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const timestamp = new Date().toISOString();
      const tenantId = "tenant_1";

      const signature = verifier.generateSignature(payload, secret);

      const nonce1 = SignatureVerifier.generateNonce();
      const result1 = verifier.verifyWithNonce(
        payload,
        signature,
        timestamp,
        nonce1,
        tenantId,
        secret,
      );

      const nonce2 = SignatureVerifier.generateNonce();
      const result2 = verifier.verifyWithNonce(
        payload,
        signature,
        timestamp,
        nonce2,
        tenantId,
        secret,
      );

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  describe("buildHeaders", () => {
    it("should build valid webhook headers", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";

      const headers = verifier.buildHeaders(payload, secret);

      expect(headers["X-Witylogix-Signature"]).toBeDefined();
      expect(headers["X-Witylogix-Timestamp"]).toBeDefined();
      expect(headers["X-Witylogix-Nonce"]).toBeDefined();
      expect(headers["X-Witylogix-Algorithm"]).toBe("sha256");
    });

    it("should use provided nonce", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const customNonce = "custom_nonce_123";

      const headers = verifier.buildHeaders(payload, secret, customNonce);

      expect(headers["X-Witylogix-Nonce"]).toBe(customNonce);
    });

    it("should support custom algorithm", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";

      const headers = verifier.buildHeaders(
        payload,
        secret,
        undefined,
        "sha512",
      );

      expect(headers["X-Witylogix-Algorithm"]).toBe("sha512");
    });
  });

  describe("static methods", () => {
    it("should generate random nonce", () => {
      const nonce1 = SignatureVerifier.generateNonce();
      const nonce2 = SignatureVerifier.generateNonce();

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
    });

    it("should generate ISO timestamp", () => {
      const timestamp = SignatureVerifier.generateTimestamp();

      expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(new Date(timestamp)).toBeInstanceOf(Date);
    });
  });

  describe("getNonceStats", () => {
    it("should track nonce statistics", () => {
      const payload = '{"event":"order.created"}';
      const secret = "test_secret";
      const timestamp = new Date().toISOString();

      const signature = verifier.generateSignature(payload, secret);

      for (let i = 0; i < 3; i++) {
        const nonce = SignatureVerifier.generateNonce();
        verifier.verifyWithNonce(
          payload,
          signature,
          timestamp,
          nonce,
          "tenant_1",
          secret,
        );
      }

      const stats = verifier.getNonceStats();
      expect(stats.tenants).toBe(1);
      expect(stats.totalNonces).toBe(3);
    });
  });
});
