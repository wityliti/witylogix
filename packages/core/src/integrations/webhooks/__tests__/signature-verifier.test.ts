/**
 * Webhook Signature Verifier Tests — HMAC verification, timestamp, replay protection
 *
 * Tests cover:
 * - HMAC-SHA256 signature verification (Stripe, Shopify, EasyPost)
 * - Timestamp validation (reject old events)
 * - Replay protection with nonce tracking
 * - Provider-specific signature formats
 * - Error messages for failed verification
 * - Clock skew tolerance
 *
 * Run with: npm test -- signature-verifier.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  WebhookSignatureVerifier,
  SignatureFormat,
  InMemoryNonceStorage,
  type SignatureVerifierConfig,
} from "../signature-verifier.js";
import { createHmac } from "crypto";

// ─── Test Utilities ─────────────────────────────────────────────────

function generateStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedContent = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function generateShopifySignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64");
}

function generateEasyPostSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("WebhookSignatureVerifier", () => {
  const signingSecret = "test_signing_secret";
  let config: SignatureVerifierConfig;

  beforeEach(() => {
    config = {
      signingSecret,
      maxEventAgeSec: 300,
      enableReplayProtection: true,
      nonceStorage: new InMemoryNonceStorage(),
    };
  });

  // ─── STRIPE SIGNATURE TESTS ─────────────────────────────────────

  describe("Stripe signature verification", () => {
    it("should verify valid Stripe signature", async () => {
      const payload = '{"id":"evt_123","type":"charge.succeeded"}';
      const signature = generateStripeSignature(payload, signingSecret);
      const timestamp = Math.floor(Date.now() / 1000);

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.STRIPE,
      );
      const result = await verifier.verify(payload, {
        "x-stripe-signature": signature,
      });

      expect(result.valid).toBe(true);
      expect(result.timestamp).toBe(timestamp);
    });

    it("should reject invalid Stripe signature", async () => {
      const payload = '{"id":"evt_123","type":"charge.succeeded"}';
      const invalidSignature = "v1=invalid_signature";

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.STRIPE,
      );
      const result = await verifier.verify(payload, {
        "x-stripe-signature": invalidSignature,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Signature verification failed");
    });

    it("should reject old Stripe events", async () => {
      const payload = '{"id":"evt_123","type":"charge.succeeded"}';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const signedContent = `${oldTimestamp}.${payload}`;
      const signature = createHmac("sha256", signingSecret)
        .update(signedContent)
        .digest("hex");
      const stripeSignature = `t=${oldTimestamp},v1=${signature}`;

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.STRIPE,
      );
      const result = await verifier.verify(payload, {
        "x-stripe-signature": stripeSignature,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("timestamp too old");
    });
  });

  // ─── SHOPIFY SIGNATURE TESTS ────────────────────────────────────

  describe("Shopify signature verification", () => {
    it("should verify valid Shopify signature", async () => {
      const payload = '{"orders":[{"id":1}]}';
      const signature = generateShopifySignature(payload, signingSecret);

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.SHOPIFY,
      );
      const result = await verifier.verify(payload, {
        "x-shopify-hmac-sha256": signature,
      });

      expect(result.valid).toBe(true);
    });

    it("should reject invalid Shopify signature", async () => {
      const payload = '{"orders":[{"id":1}]}';

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.SHOPIFY,
      );
      const result = await verifier.verify(payload, {
        "x-shopify-hmac-sha256": "invalid_signature_base64",
      });

      expect(result.valid).toBe(false);
    });
  });

  // ─── EASYPOST SIGNATURE TESTS ───────────────────────────────────

  describe("EasyPost signature verification", () => {
    it("should verify valid EasyPost signature", async () => {
      const payload = '{"id":"evt_123","type":"batch.created"}';
      const signature = generateEasyPostSignature(payload, signingSecret);

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.EASYPOST,
      );
      const result = await verifier.verify(payload, {
        "x-hmac-sha256": signature,
      });

      expect(result.valid).toBe(true);
    });

    it("should reject invalid EasyPost signature", async () => {
      const payload = '{"id":"evt_123","type":"batch.created"}';

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.EASYPOST,
      );
      const result = await verifier.verify(payload, {
        "x-hmac-sha256": "invalid_signature_hex",
      });

      expect(result.valid).toBe(false);
    });
  });

  // ─── GENERIC SIGNATURE TESTS ────────────────────────────────────

  describe("Generic signature verification", () => {
    it("should verify valid generic signature", async () => {
      const payload = '{"event":"test"}';
      const signature = generateEasyPostSignature(payload, signingSecret);

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.GENERIC_SIGNATURE,
      );
      const result = await verifier.verify(payload, {
        "x-signature": signature,
      });

      expect(result.valid).toBe(true);
    });

    it("should return error when no signature header found", async () => {
      const payload = '{"event":"test"}';

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.GENERIC_SIGNATURE,
      );
      const result = await verifier.verify(payload, {});

      expect(result.valid).toBe(false);
      expect(result.error).toContain("No signature found");
    });
  });

  // ─── TIMESTAMP VALIDATION TESTS ─────────────────────────────────

  describe("Timestamp validation", () => {
    it("should allow timestamp within window", async () => {
      const payload = '{"id":"evt_123"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const signedContent = `${timestamp}.${payload}`;
      const signature = createHmac("sha256", signingSecret)
        .update(signedContent)
        .digest("hex");

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.STRIPE,
      );
      const result = await verifier.verify(payload, {
        "x-stripe-signature": `t=${timestamp},v1=${signature}`,
      });

      expect(result.valid).toBe(true);
    });

    it("should reject timestamp too far in the future (clock skew)", async () => {
      const payload = '{"id":"evt_123"}';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 300; // 5 minutes in future
      const signedContent = `${futureTimestamp}.${payload}`;
      const signature = createHmac("sha256", signingSecret)
        .update(signedContent)
        .digest("hex");

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.STRIPE,
      );
      const result = await verifier.verify(payload, {
        "x-stripe-signature": `t=${futureTimestamp},v1=${signature}`,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("future");
    });

    it("should allow 60 seconds of clock skew", async () => {
      const payload = '{"id":"evt_123"}';
      const skewedTimestamp = Math.floor(Date.now() / 1000) + 30; // 30 seconds in future
      const signedContent = `${skewedTimestamp}.${payload}`;
      const signature = createHmac("sha256", signingSecret)
        .update(signedContent)
        .digest("hex");

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.STRIPE,
      );
      const result = await verifier.verify(payload, {
        "x-stripe-signature": `t=${skewedTimestamp},v1=${signature}`,
      });

      expect(result.valid).toBe(true);
    });
  });

  // ─── REPLAY PROTECTION TESTS ────────────────────────────────────

  describe("Replay protection", () => {
    it("should reject duplicate nonce", async () => {
      const payload = '{"id":"evt_123"}';
      const signature = generateEasyPostSignature(payload, signingSecret);
      const nonce = "nonce_123_abc";

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.GENERIC_SIGNATURE,
      );

      // First request should succeed
      const result1 = await verifier.verify(
        payload,
        { "x-signature": signature },
        nonce,
      );
      expect(result1.valid).toBe(true);

      // Second request with same nonce should fail
      const result2 = await verifier.verify(
        payload,
        { "x-signature": signature },
        nonce,
      );
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain("Nonce already seen");
    });

    it("should allow nonce replay protection to be disabled", async () => {
      const payload = '{"id":"evt_123"}';
      const signature = generateEasyPostSignature(payload, signingSecret);
      const nonce = "nonce_123_abc";

      const configNoReplay = { ...config, enableReplayProtection: false };
      const verifier = new WebhookSignatureVerifier(
        configNoReplay,
        SignatureFormat.GENERIC_SIGNATURE,
      );

      const result1 = await verifier.verify(
        payload,
        { "x-signature": signature },
        nonce,
      );
      const result2 = await verifier.verify(
        payload,
        { "x-signature": signature },
        nonce,
      );

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  // ─── ERROR MESSAGE TESTS ────────────────────────────────────────

  describe("Error messages", () => {
    it("should provide detailed error for signature mismatch", async () => {
      const payload = '{"id":"evt_123"}';

      const verifier = new WebhookSignatureVerifier(
        config,
        SignatureFormat.GENERIC_SIGNATURE,
      );
      const result = await verifier.verify(payload, {
        "x-signature": "wrong_signature_hash",
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Signature verification failed");
      expect(result.details).toBeDefined();
    });
  });

  // ─── IN-MEMORY NONCE STORAGE TESTS ──────────────────────────────

  describe("InMemoryNonceStorage", () => {
    it("should track nonces", async () => {
      const storage = new InMemoryNonceStorage();

      const nonce = "nonce_test_123";
      let exists = await storage.has(nonce);
      expect(exists).toBe(false);

      await storage.set(nonce, 5000);
      exists = await storage.has(nonce);
      expect(exists).toBe(true);
    });

    it("should expire nonces after TTL", async () => {
      const storage = new InMemoryNonceStorage();

      const nonce = "nonce_test_123";
      await storage.set(nonce, 100); // 100ms TTL

      expect(await storage.has(nonce)).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(await storage.has(nonce)).toBe(false);
    });
  });
});
