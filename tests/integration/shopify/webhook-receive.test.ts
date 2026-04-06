/**
 * Shopify Webhook Receive Integration Tests — WIT-234
 *
 * Tests the full receive path for all Shopify webhook topics:
 *   POST /api/v4/shopify/webhooks/app/installed
 *   POST /api/v4/shopify/webhooks/app/uninstalled
 *   POST /api/v4/shopify/webhooks/customers/data-request
 *   POST /api/v4/shopify/webhooks/customers/redact
 *   POST /api/v4/shopify/webhooks/shop/redact
 *   POST /api/v4/shopify/webhooks/orders/create
 *   POST /api/v4/shopify/webhooks/orders/updated
 *   POST /api/v4/shopify/webhooks/products/update
 *
 * Strategy: spin up a minimal Fastify instance with the raw-body plugin and
 * mock DB decorator, then use fastify.inject() to exercise the actual route
 * handlers and HMAC middleware without touching the database or network.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import crypto from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-shopify-secret-key-for-integration";
const PREFIX = "/api/v4/shopify/webhooks";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute X-Shopify-Hmac-SHA256 for a JSON payload using the test secret.
 */
function hmacHeader(payload: Record<string, unknown>): string {
  const raw = JSON.stringify(payload);
  return crypto
    .createHmac("sha256", TEST_SECRET)
    .update(raw, "utf-8")
    .digest("base64");
}

/**
 * Build a signed inject options object so every test call is DRY.
 */
function signedPost(path: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  return {
    method: "POST" as const,
    url: `${PREFIX}${path}`,
    headers: {
      "content-type": "application/json",
      "x-shopify-hmac-sha256": crypto
        .createHmac("sha256", TEST_SECRET)
        .update(body, "utf-8")
        .digest("base64"),
    },
    body,
  };
}

// ─── Raw-body plugin (mirrors apps/api/src/plugins/raw-body.ts) ───────────────

async function rawBodyPlugin(fastify: FastifyInstance) {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req: any, body: Buffer, done: any) => {
      (req as any).rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );
}

// ─── Test App Builder ─────────────────────────────────────────────────────────

let mockDb: {
  shop: ReturnType<typeof buildShopMock>;
  order: ReturnType<typeof buildOrderMock>;
  product: ReturnType<typeof buildProductMock>;
  customer: ReturnType<typeof buildCustomerMock>;
  activityLog: ReturnType<typeof buildActivityLogMock>;
};

function buildShopMock() {
  return {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  };
}
function buildOrderMock() {
  return { upsert: vi.fn(), updateMany: vi.fn() };
}
function buildProductMock() {
  return { upsert: vi.fn() };
}
function buildCustomerMock() {
  return { updateMany: vi.fn() };
}
function buildActivityLogMock() {
  return { create: vi.fn() };
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Capture raw body for HMAC verification
  await app.register(fp(rawBodyPlugin));

  // Inject mock DB (mirrors how the real server exposes prisma)
  app.decorate("db", mockDb);

  // Override the env variable so the route picks up our test secret
  process.env.SHOPIFY_API_SECRET = TEST_SECRET;

  // Register the actual route plugin under the same prefix as production
  await app.register(
    (await import("../../../apps/api/src/routes/shopify-webhooks.js")).default,
    { prefix: PREFIX }
  );

  await app.ready();
  return app;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Shopify Webhook Receive — WIT-234", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    mockDb = {
      shop: buildShopMock(),
      order: buildOrderMock(),
      product: buildProductMock(),
      customer: buildCustomerMock(),
      activityLog: buildActivityLogMock(),
    };
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── HMAC Verification ────────────────────────────────────────────────────

  describe("HMAC verification middleware", () => {
    const validPayload = {
      id: 1,
      name: "test-store.myshopify.com",
      domain: "test-store.myshopify.com",
      email: "owner@test.com",
    };

    it("rejects request with missing HMAC header (401)", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${PREFIX}/app/installed`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("Unauthorized");
    });

    it("rejects request with invalid HMAC signature (401)", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${PREFIX}/app/installed`,
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": "invalid-signature",
        },
        body: JSON.stringify(validPayload),
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.message).toBe("Invalid HMAC signature");
    });

    it("rejects a valid HMAC when the payload has been tampered with (401)", async () => {
      const original = { ...validPayload };
      const tampered = { ...validPayload, id: 999 };

      // HMAC computed over the original; body contains the tampered version
      const sig = crypto
        .createHmac("sha256", TEST_SECRET)
        .update(JSON.stringify(original), "utf-8")
        .digest("base64");

      const res = await app.inject({
        method: "POST",
        url: `${PREFIX}/app/installed`,
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": sig,
        },
        body: JSON.stringify(tampered),
      });

      expect(res.statusCode).toBe(401);
    });

    it("accepts a correctly signed request (200)", async () => {
      mockDb.shop.upsert.mockResolvedValue({ id: "shop-1", name: "test" });

      const res = await app.inject(signedPost("/app/installed", validPayload));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ success: true });
    });
  });

  // ─── POST /app/installed ──────────────────────────────────────────────────

  describe("POST /app/installed", () => {
    const shopPayload = {
      id: 1234567890,
      name: "My Test Store",
      email: "owner@mystore.com",
      domain: "my-test-store.myshopify.com",
      currency: "USD",
      timezone: "America/New_York",
      plan_display_name: "Basic",
      country_code: "US",
    };

    it("upserts the shop record with correct fields", async () => {
      mockDb.shop.upsert.mockResolvedValue({ id: "shop-abc" });

      await app.inject(signedPost("/app/installed", shopPayload));

      expect(mockDb.shop.upsert).toHaveBeenCalledOnce();
      const call = mockDb.shop.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ shopifyId: "1234567890" });
      expect(call.create.shopifyId).toBe("1234567890");
      expect(call.create.domain).toBe("my-test-store.myshopify.com");
      expect(call.create.status).toBe("ACTIVE");
      expect(call.create.currency).toBe("USD");
    });

    it("returns 200 even when the DB call throws", async () => {
      mockDb.shop.upsert.mockRejectedValue(new Error("DB unavailable"));

      const res = await app.inject(signedPost("/app/installed", shopPayload));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ success: true });
    });

    it("handles minimal payload (only required fields)", async () => {
      mockDb.shop.upsert.mockResolvedValue({ id: "shop-min" });

      const minimal = {
        id: 9999,
        name: "Minimal Store",
        domain: "minimal.myshopify.com",
      };

      const res = await app.inject(signedPost("/app/installed", minimal));

      expect(res.statusCode).toBe(200);
      expect(mockDb.shop.upsert).toHaveBeenCalledOnce();
    });
  });

  // ─── POST /app/uninstalled ────────────────────────────────────────────────

  describe("POST /app/uninstalled", () => {
    const uninstallPayload = {
      id: 1234567890,
      name: "My Test Store",
      domain: "my-test-store.myshopify.com",
    };

    it("deactivates the shop record", async () => {
      mockDb.shop.updateMany.mockResolvedValue({ count: 1 });

      await app.inject(signedPost("/app/uninstalled", uninstallPayload));

      expect(mockDb.shop.updateMany).toHaveBeenCalledOnce();
      const call = mockDb.shop.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ shopifyId: "1234567890" });
      expect(call.data.status).toBe("INACTIVE");
      expect(call.data.uninstalledAt).toBeInstanceOf(Date);
    });

    it("returns 200 even when DB throws", async () => {
      mockDb.shop.updateMany.mockRejectedValue(new Error("DB error"));

      const res = await app.inject(
        signedPost("/app/uninstalled", uninstallPayload)
      );

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── POST /customers/data-request ─────────────────────────────────────────

  describe("POST /customers/data-request", () => {
    const gdprPayload = {
      shop_id: 111222333,
      shop_domain: "gdpr-shop.myshopify.com",
      customer: { id: 987654321, email: "customer@gdpr.com", phone: "+1-555-0100" },
      orders_requested: [10001, 10002],
    };

    it("logs the GDPR data request when shop is found", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-gdpr" });
      mockDb.activityLog.create.mockResolvedValue({ id: "log-1" });

      await app.inject(signedPost("/customers/data-request", gdprPayload));

      expect(mockDb.shop.findFirst).toHaveBeenCalledOnce();
      expect(mockDb.activityLog.create).toHaveBeenCalledOnce();
      const logData = mockDb.activityLog.create.mock.calls[0][0].data;
      expect(logData.action).toBe("data_request");
      expect(logData.actorType).toBe("webhook");
      expect(logData.metadata.customerId).toBe(987654321);
      expect(logData.metadata.ordersRequested).toEqual([10001, 10002]);
    });

    it("skips activity log when shop is not found", async () => {
      mockDb.shop.findFirst.mockResolvedValue(null);

      const res = await app.inject(
        signedPost("/customers/data-request", gdprPayload)
      );

      expect(res.statusCode).toBe(200);
      expect(mockDb.activityLog.create).not.toHaveBeenCalled();
    });

    it("returns 200 on error (webhooks must always ack)", async () => {
      mockDb.shop.findFirst.mockRejectedValue(new Error("DB timeout"));

      const res = await app.inject(
        signedPost("/customers/data-request", gdprPayload)
      );

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── POST /customers/redact ────────────────────────────────────────────────

  describe("POST /customers/redact", () => {
    const redactPayload = {
      shop_id: 111222333,
      shop_domain: "redact-shop.myshopify.com",
      customer: { id: 444555666, email: "redact@example.com" },
      orders_to_redact: [20001, 20002],
    };

    it("anonymises the customer record", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-redact" });
      mockDb.customer.updateMany.mockResolvedValue({ count: 1 });
      mockDb.activityLog.create.mockResolvedValue({ id: "log-redact" });

      await app.inject(signedPost("/customers/redact", redactPayload));

      expect(mockDb.customer.updateMany).toHaveBeenCalledOnce();
      const updateArgs = mockDb.customer.updateMany.mock.calls[0][0];
      expect(updateArgs.data.email).toMatch(/redacted.*@redacted\.local/);
      expect(updateArgs.data.firstName).toBe("REDACTED");
      expect(updateArgs.data.lastName).toBe("REDACTED");
      expect(updateArgs.data.phone).toBeNull();
    });

    it("logs customer_redact action", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-redact" });
      mockDb.customer.updateMany.mockResolvedValue({ count: 1 });
      mockDb.activityLog.create.mockResolvedValue({ id: "log-r" });

      await app.inject(signedPost("/customers/redact", redactPayload));

      const logData = mockDb.activityLog.create.mock.calls[0][0].data;
      expect(logData.action).toBe("customer_redact");
      expect(logData.metadata.customerId).toBe(444555666);
      expect(logData.metadata.ordersRedacted).toEqual([20001, 20002]);
    });

    it("does nothing when shop is not found", async () => {
      mockDb.shop.findFirst.mockResolvedValue(null);

      const res = await app.inject(
        signedPost("/customers/redact", redactPayload)
      );

      expect(res.statusCode).toBe(200);
      expect(mockDb.customer.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── POST /shop/redact ─────────────────────────────────────────────────────

  describe("POST /shop/redact", () => {
    const shopRedactPayload = {
      shop_id: 222333444,
      shop_domain: "shop-to-delete.myshopify.com",
    };

    it("deletes the shop record when found", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-to-delete" });
      mockDb.shop.delete.mockResolvedValue({ id: "shop-to-delete" });

      await app.inject(signedPost("/shop/redact", shopRedactPayload));

      expect(mockDb.shop.delete).toHaveBeenCalledOnce();
      expect(mockDb.shop.delete.mock.calls[0][0]).toEqual({
        where: { id: "shop-to-delete" },
      });
    });

    it("is a no-op when shop is not found", async () => {
      mockDb.shop.findFirst.mockResolvedValue(null);

      const res = await app.inject(
        signedPost("/shop/redact", shopRedactPayload)
      );

      expect(res.statusCode).toBe(200);
      expect(mockDb.shop.delete).not.toHaveBeenCalled();
    });

    it("returns 200 on error", async () => {
      mockDb.shop.findFirst.mockRejectedValue(new Error("gone"));

      const res = await app.inject(
        signedPost("/shop/redact", shopRedactPayload)
      );

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── POST /orders/create ───────────────────────────────────────────────────

  describe("POST /orders/create", () => {
    const orderPayload = {
      id: 555666777,
      order_number: 1001,
      name: "#1001",
      email: "buyer@example.com",
      financial_status: "paid",
      fulfillment_status: null,
      total_price: "149.99",
      currency: "USD",
      line_items: [
        { id: 1, product_id: 100, variant_id: 10, quantity: 2, price: "74.99" },
      ],
      shipping_address: {
        address1: "42 Main St",
        city: "Austin",
        province: "TX",
        zip: "78701",
        country: "US",
      },
      created_at: "2026-04-06T10:00:00Z",
      updated_at: "2026-04-06T10:00:00Z",
    };

    it("upserts order when shop header and shop record are present", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-orders" });
      mockDb.order.upsert.mockResolvedValue({ id: "order-new" });

      const opts = signedPost("/orders/create", orderPayload);
      opts.headers["x-shopify-shop-domain"] = "orders-shop.myshopify.com";

      await app.inject(opts);

      expect(mockDb.order.upsert).toHaveBeenCalledOnce();
      const upsertArgs = mockDb.order.upsert.mock.calls[0][0];
      expect(upsertArgs.where).toEqual({
        shopId_externalOrderId: {
          shopId: "shop-orders",
          externalOrderId: "555666777",
        },
      });
      expect(upsertArgs.create.orderNumber).toBe("1001");
      expect(upsertArgs.create.customerEmail).toBe("buyer@example.com");
      expect(upsertArgs.create.totalPrice).toBeCloseTo(149.99);
      expect(upsertArgs.create.currency).toBe("USD");
      expect(upsertArgs.create.lineItems).toHaveLength(1);
    });

    it("skips upsert when x-shopify-shop-domain header is absent", async () => {
      const res = await app.inject(signedPost("/orders/create", orderPayload));

      // Header missing → route bails out early, still 200
      expect(res.statusCode).toBe(200);
      expect(mockDb.order.upsert).not.toHaveBeenCalled();
    });

    it("skips upsert when shop record cannot be found", async () => {
      mockDb.shop.findFirst.mockResolvedValue(null);

      const opts = signedPost("/orders/create", orderPayload);
      opts.headers["x-shopify-shop-domain"] = "unknown.myshopify.com";

      const res = await app.inject(opts);

      expect(res.statusCode).toBe(200);
      expect(mockDb.order.upsert).not.toHaveBeenCalled();
    });

    it("handles orders with no fulfillment_status (defaults to UNFULFILLED)", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-x" });
      mockDb.order.upsert.mockResolvedValue({ id: "order-x" });

      const noFulfillment = { ...orderPayload, fulfillment_status: undefined };
      const opts = signedPost("/orders/create", noFulfillment);
      opts.headers["x-shopify-shop-domain"] = "shop-x.myshopify.com";

      await app.inject(opts);

      const upsertArgs = mockDb.order.upsert.mock.calls[0][0];
      expect(upsertArgs.create.status).toBe("UNFULFILLED");
    });

    it("returns 200 even when DB throws", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-err" });
      mockDb.order.upsert.mockRejectedValue(new Error("constraint"));

      const opts = signedPost("/orders/create", orderPayload);
      opts.headers["x-shopify-shop-domain"] = "shop-err.myshopify.com";

      const res = await app.inject(opts);

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── POST /orders/updated ──────────────────────────────────────────────────

  describe("POST /orders/updated", () => {
    const updatePayload = {
      id: 777666555,
      order_number: 1002,
      financial_status: "paid",
      fulfillment_status: "fulfilled",
      total_price: "200.00",
      currency: "GBP",
      updated_at: "2026-04-06T11:00:00Z",
    };

    it("updates the order status when shop is found", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-upd" });
      mockDb.order.updateMany.mockResolvedValue({ count: 1 });

      const opts = signedPost("/orders/updated", updatePayload);
      opts.headers["x-shopify-shop-domain"] = "update-shop.myshopify.com";

      await app.inject(opts);

      expect(mockDb.order.updateMany).toHaveBeenCalledOnce();
      const updateArgs = mockDb.order.updateMany.mock.calls[0][0];
      expect(updateArgs.where.shopId).toBe("shop-upd");
      expect(updateArgs.where.externalOrderId).toBe("777666555");
      expect(updateArgs.data.status).toBe("fulfilled");
      expect(updateArgs.data.totalPrice).toBeCloseTo(200.0);
    });

    it("returns 200 even when DB throws", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-upd-err" });
      mockDb.order.updateMany.mockRejectedValue(new Error("lock timeout"));

      const opts = signedPost("/orders/updated", updatePayload);
      opts.headers["x-shopify-shop-domain"] = "update-err.myshopify.com";

      const res = await app.inject(opts);

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── POST /products/update ─────────────────────────────────────────────────

  describe("POST /products/update", () => {
    const productPayload = {
      id: 999111222,
      title: "Super Widget v2",
      product_type: "Gadget",
      vendor: "AcmeCo",
      status: "active",
      variants: [
        { id: 1, title: "Red / M", price: "29.99", inventory_quantity: 50 },
        { id: 2, title: "Blue / L", price: "29.99", inventory_quantity: 30 },
      ],
      updated_at: "2026-04-06T12:00:00Z",
    };

    it("upserts the product when shop is found", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-prod" });
      mockDb.product.upsert.mockResolvedValue({ id: "prod-1" });

      const opts = signedPost("/products/update", productPayload);
      opts.headers["x-shopify-shop-domain"] = "prod-shop.myshopify.com";

      await app.inject(opts);

      expect(mockDb.product.upsert).toHaveBeenCalledOnce();
      const upsertArgs = mockDb.product.upsert.mock.calls[0][0];
      expect(upsertArgs.where).toEqual({
        shopId_shopifyProductId: {
          shopId: "shop-prod",
          shopifyProductId: "999111222",
        },
      });
      expect(upsertArgs.create.title).toBe("Super Widget v2");
      expect(upsertArgs.create.vendor).toBe("AcmeCo");
      expect(upsertArgs.create.status).toBe("active");
      expect(upsertArgs.create.variants).toHaveLength(2);
    });

    it("upserts with default status 'active' when status is omitted", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-prod-d" });
      mockDb.product.upsert.mockResolvedValue({ id: "prod-d" });

      const noStatus = { ...productPayload, status: undefined };
      const opts = signedPost("/products/update", noStatus);
      opts.headers["x-shopify-shop-domain"] = "prod-d.myshopify.com";

      await app.inject(opts);

      const upsertArgs = mockDb.product.upsert.mock.calls[0][0];
      expect(upsertArgs.create.status).toBe("active");
    });

    it("skips upsert when shop header is absent", async () => {
      const res = await app.inject(
        signedPost("/products/update", productPayload)
      );

      expect(res.statusCode).toBe(200);
      expect(mockDb.product.upsert).not.toHaveBeenCalled();
    });

    it("returns 200 even when DB throws", async () => {
      mockDb.shop.findFirst.mockResolvedValue({ id: "shop-prod-err" });
      mockDb.product.upsert.mockRejectedValue(new Error("deadlock"));

      const opts = signedPost("/products/update", productPayload);
      opts.headers["x-shopify-shop-domain"] = "prod-err.myshopify.com";

      const res = await app.inject(opts);

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── Payload Schema Validation ────────────────────────────────────────────

  describe("Payload schema validation", () => {
    it("returns 200 for app/installed with invalid payload (error caught gracefully)", async () => {
      // Route catches Zod parse errors internally and returns 200
      const invalid = { notAShopifyPayload: true };
      const res = await app.inject(signedPost("/app/installed", invalid));
      expect(res.statusCode).toBe(200);
    });

    it("returns 200 for orders/create with malformed order (error caught gracefully)", async () => {
      const opts = signedPost("/orders/create", { garbage: "data" });
      opts.headers["x-shopify-shop-domain"] = "test.myshopify.com";
      const res = await app.inject(opts);
      expect(res.statusCode).toBe(200);
    });
  });

  // ─── Response contract ────────────────────────────────────────────────────

  describe("Response contract", () => {
    it("all successful responses return { success: true }", async () => {
      mockDb.shop.upsert.mockResolvedValue({ id: "shop-resp" });

      const payload = {
        id: 1,
        name: "resp-store.myshopify.com",
        domain: "resp-store.myshopify.com",
      };

      const res = await app.inject(signedPost("/app/installed", payload));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ success: true });
    });

    it("error responses also return { success: true } (webhook must always ack)", async () => {
      mockDb.shop.upsert.mockRejectedValue(new Error("chaos"));

      const payload = {
        id: 2,
        name: "chaos-store.myshopify.com",
        domain: "chaos-store.myshopify.com",
      };

      const res = await app.inject(signedPost("/app/installed", payload));

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ success: true });
    });
  });
});
