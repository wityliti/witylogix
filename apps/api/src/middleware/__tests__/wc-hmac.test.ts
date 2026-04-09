/**
 * WooCommerce HMAC-SHA256 middleware tests
 * Covers: valid signature, invalid signature, missing header, empty body
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { validateWooCommerceHmac, verifyWooCommerceHmac } from "../hmac.js";

// ─── validateWooCommerceHmac unit tests ──────────────────

describe("validateWooCommerceHmac", () => {
  const secret = "test_wc_secret_12345";

  function sign(body: string, s = secret): string {
    return crypto.createHmac("sha256", s).update(body, "utf-8").digest("base64");
  }

  it("returns true for a valid signature", () => {
    const body = JSON.stringify({ id: 1, status: "pending" });
    expect(validateWooCommerceHmac(body, sign(body), secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const body = JSON.stringify({ id: 1 });
    expect(validateWooCommerceHmac(body, "not-a-valid-sig==", secret)).toBe(false);
  });

  it("returns false when payload is modified after signing", () => {
    const original = JSON.stringify({ id: 1, status: "pending" });
    const sig = sign(original);
    const modified = JSON.stringify({ id: 1, status: "completed" });
    expect(validateWooCommerceHmac(modified, sig, secret)).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const body = JSON.stringify({ id: 1 });
    const sig = sign(body, "wrong_secret");
    expect(validateWooCommerceHmac(body, sig, secret)).toBe(false);
  });

  it("returns true for an empty body with correct signature", () => {
    const body = "";
    expect(validateWooCommerceHmac(body, sign(body), secret)).toBe(true);
  });

  it("returns false for empty body with wrong signature", () => {
    expect(validateWooCommerceHmac("", "badsig==", secret)).toBe(false);
  });

  it("accepts Buffer input", () => {
    const body = JSON.stringify({ id: 2 });
    const buf = Buffer.from(body, "utf-8");
    expect(validateWooCommerceHmac(buf, sign(body), secret)).toBe(true);
  });

  it("returns false for signatures that differ only in case", () => {
    const body = JSON.stringify({ id: 3 });
    const sig = sign(body).toUpperCase();
    expect(validateWooCommerceHmac(body, sig, secret)).toBe(false);
  });

  it("returns false when signature is shorter than expected", () => {
    const body = JSON.stringify({ id: 4 });
    const sig = sign(body).slice(0, 10);
    expect(validateWooCommerceHmac(body, sig, secret)).toBe(false);
  });
});

// ─── verifyWooCommerceHmac preHandler tests ───────────────

describe("verifyWooCommerceHmac preHandler", () => {
  const secret = "tenant_webhook_secret";
  const siteUrl = "https://mystore.example.com";

  function sign(body: string): string {
    return crypto.createHmac("sha256", secret).update(body, "utf-8").digest("base64");
  }

  function makeFastify(shopOverride?: object | null) {
    return {
      log: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
      db: {
        shop: {
          findFirst: vi.fn().mockResolvedValue(
            shopOverride !== undefined
              ? shopOverride
              : { woocommerceWebhookSecret: secret }
          ),
        },
      },
    };
  }

  function makeRequest(overrides: Record<string, unknown> = {}) {
    const body = JSON.stringify({ id: 42, status: "pending" });
    return {
      headers: {
        "x-wc-webhook-signature": sign(body),
        "x-wc-webhook-source": siteUrl,
      },
      rawBody: body,
      body: { id: 42, status: "pending" },
      ...overrides,
    };
  }

  function makeReply() {
    const reply = { code: vi.fn(), send: vi.fn() };
    reply.code.mockReturnValue(reply);
    reply.send.mockReturnValue(reply);
    return reply;
  }

  it("passes through on valid signature", async () => {
    const fastify = makeFastify();
    const request = makeRequest();
    const reply = makeReply();

    await verifyWooCommerceHmac(fastify as any)(request as any, reply as any);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it("returns 401 when signature header is missing", async () => {
    const fastify = makeFastify();
    const request = makeRequest({
      headers: { "x-wc-webhook-source": siteUrl }, // no signature
    });
    const reply = makeReply();

    await verifyWooCommerceHmac(fastify as any)(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Missing") })
    );
  });

  it("returns 401 when signature is invalid", async () => {
    const fastify = makeFastify();
    const request = makeRequest({
      headers: {
        "x-wc-webhook-signature": "invalidsignature==",
        "x-wc-webhook-source": siteUrl,
      },
    });
    const reply = makeReply();

    await verifyWooCommerceHmac(fastify as any)(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Invalid") })
    );
  });

  it("returns 401 when shop is not found", async () => {
    const fastify = makeFastify(null);
    const request = makeRequest();
    const reply = makeReply();

    await verifyWooCommerceHmac(fastify as any)(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Unknown shop") })
    );
  });

  it("returns 401 when shop has no webhook secret configured", async () => {
    const fastify = makeFastify({ woocommerceWebhookSecret: null });
    const request = makeRequest();
    const reply = makeReply();

    await verifyWooCommerceHmac(fastify as any)(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it("returns 500 when DB is unavailable", async () => {
    const fastify = { log: { warn: vi.fn(), error: vi.fn() }, db: null };
    const request = makeRequest();
    const reply = makeReply();

    await verifyWooCommerceHmac(fastify as any)(request as any, reply as any);

    expect(reply.code).toHaveBeenCalledWith(500);
  });

  it("falls back to JSON.stringify(body) when rawBody is absent", async () => {
    const body = { id: 99, status: "processing" };
    const rawBodyStr = JSON.stringify(body);
    const sig = sign(rawBodyStr);
    const fastify = makeFastify();
    const request = {
      headers: { "x-wc-webhook-signature": sig, "x-wc-webhook-source": siteUrl },
      body,
      // no rawBody
    };
    const reply = makeReply();

    await verifyWooCommerceHmac(fastify as any)(request as any, reply as any);

    expect(reply.code).not.toHaveBeenCalled();
  });
});
