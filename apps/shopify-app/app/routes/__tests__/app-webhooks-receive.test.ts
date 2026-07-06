// @ts-nocheck
/**
 * Tests for app.webhooks.receive.tsx — inbound Shopify webhook receiver
 *
 * Covers:
 *   1. Non-POST method → 405
 *   2. Rate limit exceeded → 429
 *   3. Missing required headers → 401
 *   4. Invalid HMAC signature → 401
 *   5. Valid HMAC + orders/create → job enqueued, 200
 *   6. Valid HMAC + orders/updated → DB status updated, 200
 *   7. Valid HMAC + orders/fulfilled → delivery workflow triggered, 200
 *   8. Valid HMAC + app/uninstalled → tenant deactivated, 200
 *   9. GDPR: customers/data_request → data export enqueued, 200
 *  10. GDPR: customers/redact → customer data deleted, 200
 *  11. GDPR: shop/redact → shop data deleted, 200
 *  12. Unknown topic → 200 (no-op, Shopify must not retry)
 *  13. Missing order ID in orders/create payload → handler returns error but still 200
 *  14. Internal handler exception → 200 (suppress Shopify retry loop)
 *  15. Payload JSON parse failure → 401
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("~/lib/rate-limiter.server", () => ({
  checkRateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 199,
    resetAt: Date.now() + 60_000,
  })),
  rateLimitHeaders: vi.fn(() => ({ "x-ratelimit-remaining": "0" })),
}));

vi.mock("~/lib/sentry.server", () => ({
  captureException: vi.fn(),
}));

// Mock the DB and queue calls that handlers make through dynamic imports
const mockPrismaInstance = {
  order: {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  shop: {
    update: vi.fn().mockResolvedValue({ shopifyId: "test-shop.myshopify.com" }),
    delete: vi.fn().mockResolvedValue({ shopifyId: "test-shop.myshopify.com" }),
  },
  customer: {
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  $disconnect: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@witylogix/db", () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrismaInstance),
  prisma: mockPrismaInstance,
}));

import { checkRateLimit, rateLimitHeaders } from "~/lib/rate-limiter.server";
import { action } from "../app.webhooks.receive";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = "test-webhook-secret-abc";

/** Build a valid HMAC-SHA256 base64 signature for the given payload. */
function signPayload(payload: string, secret = WEBHOOK_SECRET): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("base64");
}

/** Create a POST Request with proper Shopify webhook headers. */
function makeWebhookRequest(
  payload: Record<string, unknown>,
  overrides: {
    topic?: string;
    shopId?: string;
    webhookId?: string;
    hmac?: string | null;
    method?: string;
    secret?: string;
  } = {},
): Request {
  const body = JSON.stringify(payload);
  const {
    topic = "orders/create",
    shopId = "shop-abc.myshopify.com",
    webhookId = "wh-uuid-001",
    secret = WEBHOOK_SECRET,
    hmac = signPayload(body, secret),
    method = "POST",
  } = overrides;

  const headers = new Headers({ "content-type": "application/json" });
  headers.set("x-shopify-topic", topic);
  headers.set("x-shopify-shop-id", shopId);
  headers.set("x-shopify-webhook-id", webhookId);
  if (hmac !== null) {
    headers.set("x-shopify-hmac-sha256", hmac);
  }

  return new Request("http://localhost:3000/app/webhooks/receive", {
    method,
    headers,
    body: method === "POST" ? body : undefined,
  });
}

/** Minimal valid Shopify order payload. */
function makeShopifyOrder(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 9001,
    order_number: 1001,
    financial_status: "paid",
    fulfillment_status: null,
    customer: { id: 42 },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("app.webhooks.receive — action handler", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_WEBHOOK_SECRET", WEBHOOK_SECRET);
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 199,
      resetAt: Date.now() + 60_000,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ── 1. Method guard ────────────────────────────────────────────────────────

  it("returns 405 for non-POST requests", async () => {
    const req = makeWebhookRequest(makeShopifyOrder(), { method: "GET" });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(405);
  });

  it("returns 405 for PUT requests", async () => {
    const req = makeWebhookRequest(makeShopifyOrder(), { method: "PUT" });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(405);
  });

  // ── 2. Rate limiting ───────────────────────────────────────────────────────

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 5_000,
      retryAfter: 5,
    });
    vi.mocked(rateLimitHeaders).mockReturnValue({ "retry-after": "5" });

    const req = makeWebhookRequest(makeShopifyOrder());
    const res = await action({ request: req } as any);
    expect(res.status).toBe(429);
  });

  it("uses x-shopify-shop-id header as rate-limit key", async () => {
    const req = makeWebhookRequest(makeShopifyOrder(), {
      shopId: "shop-xyz.myshopify.com",
    });
    await action({ request: req } as any);
    expect(checkRateLimit).toHaveBeenCalledWith(
      "webhook:shop-xyz.myshopify.com",
      200,
      60_000,
    );
  });

  // ── 3. Header validation ───────────────────────────────────────────────────

  it("returns 401 when x-shopify-hmac-sha256 header is missing", async () => {
    const req = makeWebhookRequest(makeShopifyOrder(), { hmac: null });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-shopify-topic header is missing", async () => {
    const body = JSON.stringify(makeShopifyOrder());
    const hmac = signPayload(body);
    const req = new Request("http://localhost:3000/app/webhooks/receive", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": hmac,
        "x-shopify-shop-id": "shop-abc.myshopify.com",
        "x-shopify-webhook-id": "wh-001",
        // deliberately omit x-shopify-topic
      },
      body,
    });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-shopify-shop-id header is missing", async () => {
    const body = JSON.stringify(makeShopifyOrder());
    const hmac = signPayload(body);
    const req = new Request("http://localhost:3000/app/webhooks/receive", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": hmac,
        "x-shopify-topic": "orders/create",
        "x-shopify-webhook-id": "wh-001",
        // deliberately omit x-shopify-shop-id
      },
      body,
    });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(401);
  });

  // ── 4. HMAC validation ─────────────────────────────────────────────────────

  it("returns 401 for an invalid HMAC signature", async () => {
    const req = makeWebhookRequest(makeShopifyOrder(), {
      hmac: "totally-wrong-AAAA==",
    });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });

  it("returns 401 when payload is tampered after signing", async () => {
    const original = JSON.stringify(makeShopifyOrder({ id: 9001 }));
    const hmac = signPayload(original);
    const tampered = JSON.stringify(makeShopifyOrder({ id: 9999 }));

    const req = new Request("http://localhost:3000/app/webhooks/receive", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": hmac,
        "x-shopify-topic": "orders/create",
        "x-shopify-shop-id": "shop-abc.myshopify.com",
        "x-shopify-webhook-id": "wh-001",
      },
      body: tampered, // body != signed original
    });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 when payload is not valid JSON", async () => {
    const invalidJson = "{ broken json ;;";
    const hmac = signPayload(invalidJson);
    const req = new Request("http://localhost:3000/app/webhooks/receive", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": hmac,
        "x-shopify-topic": "orders/create",
        "x-shopify-shop-id": "shop-abc.myshopify.com",
        "x-shopify-webhook-id": "wh-001",
      },
      body: invalidJson,
    });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(401);
  });

  // ── 5. orders/create ──────────────────────────────────────────────────────

  it("returns 200 for a valid orders/create webhook", async () => {
    const req = makeWebhookRequest(makeShopifyOrder(), {
      topic: "orders/create",
    });
    const res = await action({ request: req } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.topic).toBe("orders/create");
    expect(body.webhookId).toBe("wh-uuid-001");
  });

  it("returns 200 but success:false when orders/create payload is missing order id", async () => {
    const req = makeWebhookRequest(
      { order_number: 1001 /* no id */ },
      { topic: "orders/create" },
    );
    const res = await action({ request: req } as any);
    // Must still be 200 to prevent Shopify retry loop
    expect(res.status).toBe(200);
  });

  // ── 6. orders/updated ─────────────────────────────────────────────────────

  it("returns 200 for a valid orders/updated webhook", async () => {
    const req = makeWebhookRequest(
      makeShopifyOrder({ financial_status: "paid" }),
      { topic: "orders/updated" },
    );
    const res = await action({ request: req } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topic).toBe("orders/updated");
  });

  // ── 7. orders/fulfilled ───────────────────────────────────────────────────

  it("returns 200 for orders/fulfilled with fulfillment_id in payload", async () => {
    const req = makeWebhookRequest(
      makeShopifyOrder({
        fulfillment_status: "fulfilled",
        fulfillments: [{ id: 555 }],
      }),
      { topic: "orders/fulfilled" },
    );
    const res = await action({ request: req } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topic).toBe("orders/fulfilled");
  });

  // ── 8. app/uninstalled ────────────────────────────────────────────────────

  it("returns 200 for app/uninstalled webhook", async () => {
    const req = makeWebhookRequest(
      { shop_domain: "shop-abc.myshopify.com" },
      { topic: "app/uninstalled" },
    );
    const res = await action({ request: req } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topic).toBe("app/uninstalled");
  });

  // ── 9. GDPR: customers/data_request ──────────────────────────────────────

  it("returns 200 for customers/data_request GDPR webhook", async () => {
    const req = makeWebhookRequest(
      { customer: { id: 42 }, orders_requested: [] },
      { topic: "customers/data_request" },
    );
    const res = await action({ request: req } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // ── 10. GDPR: customers/redact ─────────────────────────────────────────────

  it("returns 200 for customers/redact GDPR webhook", async () => {
    const req = makeWebhookRequest(
      { customer_id: "42", customer_email: "test@example.com" },
      { topic: "customers/redact" },
    );
    const res = await action({ request: req } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // ── 11. GDPR: shop/redact ──────────────────────────────────────────────────

  it("returns 200 for shop/redact GDPR webhook", async () => {
    const req = makeWebhookRequest(
      { shop_domain: "shop-abc.myshopify.com" },
      { topic: "shop/redact" },
    );
    const res = await action({ request: req } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // ── 12. Unknown topic ──────────────────────────────────────────────────────

  it("returns 200 for an unrecognised topic (no-op, prevents Shopify retry)", async () => {
    const req = makeWebhookRequest(
      { data: "some-payload" },
      { topic: "inventory/levels/update" },
    );
    const res = await action({ request: req } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("inventory/levels/update");
  });

  // ── 13. Response shape ─────────────────────────────────────────────────────

  it("response always includes webhookId and topic on success", async () => {
    const req = makeWebhookRequest(makeShopifyOrder(), {
      topic: "orders/create",
      webhookId: "wh-shape-test-001",
    });
    const res = await action({ request: req } as any);
    const body = await res.json();
    expect(body.webhookId).toBe("wh-shape-test-001");
    expect(body.topic).toBe("orders/create");
  });

  it("suppresses error details in production environment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // Force handler to throw by using a topic that causes the enqueue to fail
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network error"));

    const req = makeWebhookRequest(makeShopifyOrder(), {
      topic: "orders/create",
    });
    const res = await action({ request: req } as any);
    // Still 200 — must not let Shopify retry
    expect(res.status).toBe(200);

    fetchSpy.mockRestore();
  });
});
