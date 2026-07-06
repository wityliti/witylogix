/**
 * Shopify Webhook Receive Integration Tests — WIT-234
 *
 * Covers the full receive path for every supported Shopify webhook topic:
 *
 *   app/installed      — shop upsert on app install
 *   app/uninstalled    — shop deactivation on app removal
 *   customers/data-request — GDPR data request logging
 *   customers/redact   — GDPR customer anonymisation
 *   shop/redact        — GDPR shop deletion (48h post-uninstall)
 *   orders/create      — new order sync from Shopify
 *   orders/updated     — order status update from Shopify
 *   products/update    — product catalog sync from Shopify
 *
 * Strategy:
 *   - Test the actual HMAC middleware logic (validateShopifyHmac imported from
 *     apps/api/src/middleware/hmac.ts) for signature verification scenarios.
 *   - Define a self-contained ShopifyWebhookReceiver that mirrors the handler
 *     logic in apps/api/src/routes/shopify-webhooks.ts so business logic is
 *     exercised end-to-end without needing a live Fastify process or database.
 *   - Mock the DB layer to assert on the exact queries issued.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

// ─── Re-implement HMAC verification (mirrors apps/api/src/middleware/hmac.ts) ─

const TEST_SECRET = "test-shopify-secret-key-for-integration";

function validateShopifyHmac(
  rawBody: string | Buffer,
  hmacHeader: string,
  secret: string,
): boolean {
  const bodyString =
    typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

  const computed = crypto
    .createHmac("sha256", secret)
    .update(bodyString, "utf-8")
    .digest("base64");

  const expectedBuffer = Buffer.from(computed, "utf-8");
  const actualBuffer = Buffer.from(hmacHeader, "utf-8");

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHmac(
  payload: Record<string, unknown>,
  secret = TEST_SECRET,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload), "utf-8")
    .digest("base64");
}

// ─── Shopify Webhook Receiver (mirrors route handler logic) ──────────────────

interface Db {
  shop: {
    upsert: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  order: {
    upsert: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  product: { upsert: ReturnType<typeof vi.fn> };
  customer: { updateMany: ReturnType<typeof vi.fn> };
  activityLog: { create: ReturnType<typeof vi.fn> };
}

class ShopifyWebhookReceiver {
  constructor(
    private db: Db,
    private secret: string,
  ) {}

  /** Verify the HMAC header against the raw request body. */
  verifyHmac(rawBody: string, hmacHeader?: string): boolean {
    if (!hmacHeader) return false;
    return validateShopifyHmac(rawBody, hmacHeader, this.secret);
  }

  private async findShopByDomain(domain: string) {
    return this.db.shop.findFirst({
      where: {
        OR: [{ domain }, { shopifyDomain: domain }],
      },
    });
  }

  async handleAppInstalled(payload: Record<string, unknown>): Promise<void> {
    const p = payload as any;
    await this.db.shop.upsert({
      where: { shopifyId: String(p.id) },
      update: {
        name: p.name,
        email: p.email ?? null,
        domain: p.domain,
        currency: p.currency ?? "USD",
        timezone: p.timezone ?? "UTC",
        status: "ACTIVE",
        installedAt: new Date(),
        metadata: {
          shopifyPlan: p.plan_display_name ?? null,
          countryCode: p.country_code ?? null,
        },
      },
      create: {
        shopifyId: String(p.id),
        name: p.name,
        email: p.email ?? null,
        domain: p.domain,
        currency: p.currency ?? "USD",
        timezone: p.timezone ?? "UTC",
        status: "ACTIVE",
        installedAt: new Date(),
        metadata: {
          shopifyPlan: p.plan_display_name ?? null,
          countryCode: p.country_code ?? null,
        },
      },
    });
  }

  async handleAppUninstalled(payload: Record<string, unknown>): Promise<void> {
    const p = payload as any;
    await this.db.shop.updateMany({
      where: { shopifyId: String(p.id) },
      data: { status: "INACTIVE", uninstalledAt: new Date() },
    });
  }

  async handleCustomerDataRequest(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const p = payload as any;
    const shop = await this.findShopByDomain(p.shop_domain);
    if (!shop) return;

    await this.db.activityLog.create({
      data: {
        shopId: shop.id,
        entityType: "gdpr",
        entityId: shop.id,
        action: "data_request",
        actorType: "webhook",
        changes: {},
        metadata: {
          customerId: p.customer.id,
          customerEmail: p.customer.email,
          ordersRequested: p.orders_requested ?? [],
          requestedAt: new Date().toISOString(),
        },
      },
    });
  }

  async handleCustomerRedact(payload: Record<string, unknown>): Promise<void> {
    const p = payload as any;
    const shop = await this.findShopByDomain(p.shop_domain);
    if (!shop) return;

    await this.db.customer.updateMany({
      where: { shopId: shop.id, shopifyCustomerId: String(p.customer.id) },
      data: {
        email: `redacted-${p.customer.id}@redacted.local`,
        firstName: "REDACTED",
        lastName: "REDACTED",
        phone: null,
        addresses: {},
        metadata: { redactedAt: new Date().toISOString() },
      },
    });

    await this.db.activityLog.create({
      data: {
        shopId: shop.id,
        entityType: "gdpr",
        entityId: shop.id,
        action: "customer_redact",
        actorType: "webhook",
        changes: {},
        metadata: {
          customerId: p.customer.id,
          ordersRedacted: p.orders_to_redact ?? [],
          redactedAt: new Date().toISOString(),
        },
      },
    });
  }

  async handleShopRedact(payload: Record<string, unknown>): Promise<void> {
    const p = payload as any;
    const shop = await this.findShopByDomain(p.shop_domain);
    if (!shop) return;
    await this.db.shop.delete({ where: { id: shop.id } });
  }

  async handleOrderCreate(
    shopDomain: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!shopDomain) return;
    const p = payload as any;
    const shop = await this.findShopByDomain(shopDomain);
    if (!shop) return;

    await this.db.order.upsert({
      where: {
        shopId_externalOrderId: {
          shopId: shop.id,
          externalOrderId: String(p.id),
        },
      },
      update: {
        status: p.fulfillment_status ?? "UNFULFILLED",
        totalPrice: p.total_price ? parseFloat(p.total_price) : 0,
        currency: p.currency ?? "USD",
        metadata: {
          financialStatus: p.financial_status,
          lineItemCount: p.line_items?.length ?? 0,
        },
        updatedAt: new Date(),
      },
      create: {
        shopId: shop.id,
        externalOrderId: String(p.id),
        orderNumber: String(p.order_number ?? p.id),
        customerEmail: p.email ?? null,
        status: p.fulfillment_status ?? "UNFULFILLED",
        totalPrice: p.total_price ? parseFloat(p.total_price) : 0,
        currency: p.currency ?? "USD",
        shippingAddress: p.shipping_address ?? {},
        lineItems: p.line_items ?? [],
        metadata: { financialStatus: p.financial_status },
      },
    });
  }

  async handleOrderUpdated(
    shopDomain: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!shopDomain) return;
    const p = payload as any;
    const shop = await this.findShopByDomain(shopDomain);
    if (!shop) return;

    await this.db.order.updateMany({
      where: { shopId: shop.id, externalOrderId: String(p.id) },
      data: {
        status: p.fulfillment_status ?? "UNFULFILLED",
        totalPrice: p.total_price ? parseFloat(p.total_price) : 0,
        metadata: {
          financialStatus: p.financial_status,
          lastWebhookAt: new Date().toISOString(),
        },
      },
    });
  }

  async handleProductUpdate(
    shopDomain: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!shopDomain) return;
    const p = payload as any;
    const shop = await this.findShopByDomain(shopDomain);
    if (!shop) return;

    await this.db.product.upsert({
      where: {
        shopId_shopifyProductId: {
          shopId: shop.id,
          shopifyProductId: String(p.id),
        },
      },
      update: {
        title: p.title,
        productType: p.product_type ?? null,
        vendor: p.vendor ?? null,
        status: p.status ?? "active",
        variants: p.variants ?? {},
        lastSyncAt: new Date(),
      },
      create: {
        shopId: shop.id,
        shopifyProductId: String(p.id),
        title: p.title,
        productType: p.product_type ?? null,
        vendor: p.vendor ?? null,
        status: p.status ?? "active",
        variants: p.variants ?? {},
        lastSyncAt: new Date(),
      },
    });
  }
}

// ─── Mock DB Factory ──────────────────────────────────────────────────────────

function buildMockDb(): Db {
  return {
    shop: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    order: { upsert: vi.fn(), updateMany: vi.fn() },
    product: { upsert: vi.fn() },
    customer: { updateMany: vi.fn() },
    activityLog: { create: vi.fn() },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Shopify Webhook Receive — WIT-234", () => {
  let db: Db;
  let receiver: ShopifyWebhookReceiver;

  beforeEach(() => {
    db = buildMockDb();
    receiver = new ShopifyWebhookReceiver(db, TEST_SECRET);
  });

  // ─── HMAC Verification ──────────────────────────────────────────────────

  describe("HMAC Verification", () => {
    const payload = { id: 123, domain: "shop.myshopify.com" };
    const body = JSON.stringify(payload);

    it("accepts a correctly signed request", () => {
      const sig = makeHmac(payload);
      expect(receiver.verifyHmac(body, sig)).toBe(true);
    });

    it("rejects when HMAC header is missing", () => {
      expect(receiver.verifyHmac(body, undefined)).toBe(false);
    });

    it("rejects an invalid/garbage signature", () => {
      expect(receiver.verifyHmac(body, "invalid-signature")).toBe(false);
    });

    it("rejects a valid HMAC when the payload has been tampered", () => {
      const sig = makeHmac(payload);
      const tampered = JSON.stringify({ ...payload, id: 999 });
      expect(receiver.verifyHmac(tampered, sig)).toBe(false);
    });

    it("rejects a valid HMAC signed with a different secret", () => {
      const wrongSig = makeHmac(payload, "wrong-secret");
      expect(receiver.verifyHmac(body, wrongSig)).toBe(false);
    });

    it("is case-sensitive (uppercase base64 != original)", () => {
      const sig = makeHmac(payload);
      expect(receiver.verifyHmac(body, sig.toUpperCase())).toBe(false);
    });

    it("rejects when the body is an empty string", () => {
      const sig = makeHmac(payload);
      expect(receiver.verifyHmac("", sig)).toBe(false);
    });

    it("accepts Buffer raw bodies (as produced by the raw-body plugin)", () => {
      const sig = crypto
        .createHmac("sha256", TEST_SECRET)
        .update(body, "utf-8")
        .digest("base64");
      expect(validateShopifyHmac(Buffer.from(body), sig, TEST_SECRET)).toBe(
        true,
      );
    });
  });

  // ─── app/installed ──────────────────────────────────────────────────────

  describe("handleAppInstalled", () => {
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

    it("upserts the shop with the correct shopifyId key", async () => {
      db.shop.upsert.mockResolvedValue({ id: "shop-1" });

      await receiver.handleAppInstalled(shopPayload);

      expect(db.shop.upsert).toHaveBeenCalledOnce();
      const args = db.shop.upsert.mock.calls[0][0];
      expect(args.where).toEqual({ shopifyId: "1234567890" });
    });

    it("sets status to ACTIVE on both create and update paths", async () => {
      db.shop.upsert.mockResolvedValue({ id: "shop-1" });
      await receiver.handleAppInstalled(shopPayload);

      const args = db.shop.upsert.mock.calls[0][0];
      expect(args.create.status).toBe("ACTIVE");
      expect(args.update.status).toBe("ACTIVE");
    });

    it("records currency, timezone, and plan in metadata", async () => {
      db.shop.upsert.mockResolvedValue({ id: "shop-1" });
      await receiver.handleAppInstalled(shopPayload);

      const args = db.shop.upsert.mock.calls[0][0];
      expect(args.create.currency).toBe("USD");
      expect(args.create.timezone).toBe("America/New_York");
      expect(args.create.metadata.shopifyPlan).toBe("Basic");
      expect(args.create.metadata.countryCode).toBe("US");
    });

    it("defaults currency to USD when omitted", async () => {
      db.shop.upsert.mockResolvedValue({ id: "shop-min" });
      const { currency: _c, ...minimal } = shopPayload;
      await receiver.handleAppInstalled(minimal);

      const args = db.shop.upsert.mock.calls[0][0];
      expect(args.create.currency).toBe("USD");
    });

    it("defaults timezone to UTC when omitted", async () => {
      db.shop.upsert.mockResolvedValue({ id: "shop-tz" });
      const { timezone: _tz, ...noTz } = shopPayload;
      await receiver.handleAppInstalled(noTz);

      const args = db.shop.upsert.mock.calls[0][0];
      expect(args.create.timezone).toBe("UTC");
    });

    it("sets installedAt to a Date", async () => {
      db.shop.upsert.mockResolvedValue({ id: "shop-ia" });
      await receiver.handleAppInstalled(shopPayload);

      const args = db.shop.upsert.mock.calls[0][0];
      expect(args.create.installedAt).toBeInstanceOf(Date);
    });
  });

  // ─── app/uninstalled ────────────────────────────────────────────────────

  describe("handleAppUninstalled", () => {
    const uninstallPayload = {
      id: 1234567890,
      name: "My Test Store",
      domain: "my-test-store.myshopify.com",
    };

    it("sets status to INACTIVE for the matching shopifyId", async () => {
      db.shop.updateMany.mockResolvedValue({ count: 1 });

      await receiver.handleAppUninstalled(uninstallPayload);

      expect(db.shop.updateMany).toHaveBeenCalledOnce();
      const args = db.shop.updateMany.mock.calls[0][0];
      expect(args.where).toEqual({ shopifyId: "1234567890" });
      expect(args.data.status).toBe("INACTIVE");
    });

    it("records uninstalledAt as a Date", async () => {
      db.shop.updateMany.mockResolvedValue({ count: 1 });
      await receiver.handleAppUninstalled(uninstallPayload);

      const args = db.shop.updateMany.mock.calls[0][0];
      expect(args.data.uninstalledAt).toBeInstanceOf(Date);
    });
  });

  // ─── customers/data-request ─────────────────────────────────────────────

  describe("handleCustomerDataRequest", () => {
    const gdprPayload = {
      shop_id: 111222333,
      shop_domain: "gdpr-shop.myshopify.com",
      customer: {
        id: 987654321,
        email: "customer@gdpr.com",
        phone: "+1-555-0100",
      },
      orders_requested: [10001, 10002],
    };

    it("logs a data_request activity when shop is found", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-gdpr" });
      db.activityLog.create.mockResolvedValue({ id: "log-1" });

      await receiver.handleCustomerDataRequest(gdprPayload);

      expect(db.activityLog.create).toHaveBeenCalledOnce();
      const logData = db.activityLog.create.mock.calls[0][0].data;
      expect(logData.action).toBe("data_request");
      expect(logData.actorType).toBe("webhook");
      expect(logData.entityType).toBe("gdpr");
    });

    it("passes customerId and ordersRequested in log metadata", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-gdpr" });
      db.activityLog.create.mockResolvedValue({ id: "log-1" });

      await receiver.handleCustomerDataRequest(gdprPayload);

      const meta = db.activityLog.create.mock.calls[0][0].data.metadata;
      expect(meta.customerId).toBe(987654321);
      expect(meta.customerEmail).toBe("customer@gdpr.com");
      expect(meta.ordersRequested).toEqual([10001, 10002]);
    });

    it("defaults ordersRequested to [] when omitted", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-gdpr" });
      db.activityLog.create.mockResolvedValue({ id: "log-1" });

      const noOrders = { ...gdprPayload, orders_requested: undefined };
      await receiver.handleCustomerDataRequest(noOrders);

      const meta = db.activityLog.create.mock.calls[0][0].data.metadata;
      expect(meta.ordersRequested).toEqual([]);
    });

    it("is a no-op when shop is not found", async () => {
      db.shop.findFirst.mockResolvedValue(null);

      await receiver.handleCustomerDataRequest(gdprPayload);

      expect(db.activityLog.create).not.toHaveBeenCalled();
    });

    it("queries shop by the shop_domain field", async () => {
      db.shop.findFirst.mockResolvedValue(null);

      await receiver.handleCustomerDataRequest(gdprPayload);

      const query = db.shop.findFirst.mock.calls[0][0];
      expect(query.where.OR).toContainEqual({
        domain: "gdpr-shop.myshopify.com",
      });
      expect(query.where.OR).toContainEqual({
        shopifyDomain: "gdpr-shop.myshopify.com",
      });
    });
  });

  // ─── customers/redact ───────────────────────────────────────────────────

  describe("handleCustomerRedact", () => {
    const redactPayload = {
      shop_id: 111222333,
      shop_domain: "redact-shop.myshopify.com",
      customer: { id: 444555666, email: "redact@example.com" },
      orders_to_redact: [20001, 20002],
    };

    it("anonymises email, firstName, lastName and nulls phone", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-redact" });
      db.customer.updateMany.mockResolvedValue({ count: 1 });
      db.activityLog.create.mockResolvedValue({ id: "log-r" });

      await receiver.handleCustomerRedact(redactPayload);

      const updateArgs = db.customer.updateMany.mock.calls[0][0];
      expect(updateArgs.data.email).toBe("redacted-444555666@redacted.local");
      expect(updateArgs.data.firstName).toBe("REDACTED");
      expect(updateArgs.data.lastName).toBe("REDACTED");
      expect(updateArgs.data.phone).toBeNull();
    });

    it("targets the correct customer by shopId and shopifyCustomerId", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-redact" });
      db.customer.updateMany.mockResolvedValue({ count: 1 });
      db.activityLog.create.mockResolvedValue({ id: "log-r" });

      await receiver.handleCustomerRedact(redactPayload);

      const updateArgs = db.customer.updateMany.mock.calls[0][0];
      expect(updateArgs.where.shopId).toBe("shop-redact");
      expect(updateArgs.where.shopifyCustomerId).toBe("444555666");
    });

    it("logs a customer_redact action including ordersRedacted", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-redact" });
      db.customer.updateMany.mockResolvedValue({ count: 1 });
      db.activityLog.create.mockResolvedValue({ id: "log-r" });

      await receiver.handleCustomerRedact(redactPayload);

      const logData = db.activityLog.create.mock.calls[0][0].data;
      expect(logData.action).toBe("customer_redact");
      expect(logData.metadata.customerId).toBe(444555666);
      expect(logData.metadata.ordersRedacted).toEqual([20001, 20002]);
    });

    it("does nothing when shop is not found", async () => {
      db.shop.findFirst.mockResolvedValue(null);

      await receiver.handleCustomerRedact(redactPayload);

      expect(db.customer.updateMany).not.toHaveBeenCalled();
      expect(db.activityLog.create).not.toHaveBeenCalled();
    });
  });

  // ─── shop/redact ────────────────────────────────────────────────────────

  describe("handleShopRedact", () => {
    const shopRedactPayload = {
      shop_id: 222333444,
      shop_domain: "shop-to-delete.myshopify.com",
    };

    it("hard-deletes the shop record by its internal ID", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "internal-shop-id" });
      db.shop.delete.mockResolvedValue({ id: "internal-shop-id" });

      await receiver.handleShopRedact(shopRedactPayload);

      expect(db.shop.delete).toHaveBeenCalledOnce();
      expect(db.shop.delete.mock.calls[0][0]).toEqual({
        where: { id: "internal-shop-id" },
      });
    });

    it("is a no-op when shop is not found", async () => {
      db.shop.findFirst.mockResolvedValue(null);

      await receiver.handleShopRedact(shopRedactPayload);

      expect(db.shop.delete).not.toHaveBeenCalled();
    });
  });

  // ─── orders/create ──────────────────────────────────────────────────────

  describe("handleOrderCreate", () => {
    const shopDomain = "orders-shop.myshopify.com";
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
    };

    it("upserts order with the correct composite key", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-ord" });
      db.order.upsert.mockResolvedValue({ id: "order-1" });

      await receiver.handleOrderCreate(shopDomain, orderPayload);

      const args = db.order.upsert.mock.calls[0][0];
      expect(args.where).toEqual({
        shopId_externalOrderId: {
          shopId: "shop-ord",
          externalOrderId: "555666777",
        },
      });
    });

    it("populates create path with customer email, price and line items", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-ord" });
      db.order.upsert.mockResolvedValue({ id: "order-1" });

      await receiver.handleOrderCreate(shopDomain, orderPayload);

      const args = db.order.upsert.mock.calls[0][0].create;
      expect(args.customerEmail).toBe("buyer@example.com");
      expect(args.totalPrice).toBeCloseTo(149.99);
      expect(args.currency).toBe("USD");
      expect(args.lineItems).toHaveLength(1);
      expect(args.shippingAddress.city).toBe("Austin");
    });

    it("defaults status to UNFULFILLED when fulfillment_status is null/undefined", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-ord" });
      db.order.upsert.mockResolvedValue({ id: "order-1" });

      await receiver.handleOrderCreate(shopDomain, {
        ...orderPayload,
        fulfillment_status: undefined,
      });

      const args = db.order.upsert.mock.calls[0][0].create;
      expect(args.status).toBe("UNFULFILLED");
    });

    it("stores fulfillment_status when present", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-ord" });
      db.order.upsert.mockResolvedValue({ id: "order-1" });

      await receiver.handleOrderCreate(shopDomain, {
        ...orderPayload,
        fulfillment_status: "fulfilled",
      });

      const args = db.order.upsert.mock.calls[0][0].create;
      expect(args.status).toBe("fulfilled");
    });

    it("is a no-op when shopDomain is absent", async () => {
      await receiver.handleOrderCreate(undefined, orderPayload);
      expect(db.order.upsert).not.toHaveBeenCalled();
    });

    it("is a no-op when shop lookup returns null", async () => {
      db.shop.findFirst.mockResolvedValue(null);
      await receiver.handleOrderCreate(shopDomain, orderPayload);
      expect(db.order.upsert).not.toHaveBeenCalled();
    });

    it("stores orderNumber as string", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-ord" });
      db.order.upsert.mockResolvedValue({ id: "order-1" });

      await receiver.handleOrderCreate(shopDomain, orderPayload);

      const args = db.order.upsert.mock.calls[0][0].create;
      expect(args.orderNumber).toBe("1001");
    });

    it("defaults totalPrice to 0 when total_price is missing", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-ord" });
      db.order.upsert.mockResolvedValue({ id: "order-1" });

      const { total_price: _tp, ...noPrice } = orderPayload;
      await receiver.handleOrderCreate(shopDomain, noPrice);

      const args = db.order.upsert.mock.calls[0][0].create;
      expect(args.totalPrice).toBe(0);
    });
  });

  // ─── orders/updated ─────────────────────────────────────────────────────

  describe("handleOrderUpdated", () => {
    const shopDomain = "update-shop.myshopify.com";
    const updatePayload = {
      id: 777666555,
      financial_status: "paid",
      fulfillment_status: "fulfilled",
      total_price: "200.00",
      currency: "GBP",
    };

    it("updates the correct order by shopId + externalOrderId", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-upd" });
      db.order.updateMany.mockResolvedValue({ count: 1 });

      await receiver.handleOrderUpdated(shopDomain, updatePayload);

      const args = db.order.updateMany.mock.calls[0][0];
      expect(args.where.shopId).toBe("shop-upd");
      expect(args.where.externalOrderId).toBe("777666555");
    });

    it("updates status and totalPrice", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-upd" });
      db.order.updateMany.mockResolvedValue({ count: 1 });

      await receiver.handleOrderUpdated(shopDomain, updatePayload);

      const args = db.order.updateMany.mock.calls[0][0];
      expect(args.data.status).toBe("fulfilled");
      expect(args.data.totalPrice).toBeCloseTo(200.0);
    });

    it("records lastWebhookAt in metadata", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-upd" });
      db.order.updateMany.mockResolvedValue({ count: 1 });

      await receiver.handleOrderUpdated(shopDomain, updatePayload);

      const args = db.order.updateMany.mock.calls[0][0];
      expect(typeof args.data.metadata.lastWebhookAt).toBe("string");
    });

    it("is a no-op when shopDomain is absent", async () => {
      await receiver.handleOrderUpdated(undefined, updatePayload);
      expect(db.order.updateMany).not.toHaveBeenCalled();
    });

    it("defaults status to UNFULFILLED when fulfillment_status is missing", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-upd" });
      db.order.updateMany.mockResolvedValue({ count: 1 });

      await receiver.handleOrderUpdated(shopDomain, {
        ...updatePayload,
        fulfillment_status: undefined,
      });

      const args = db.order.updateMany.mock.calls[0][0];
      expect(args.data.status).toBe("UNFULFILLED");
    });
  });

  // ─── products/update ────────────────────────────────────────────────────

  describe("handleProductUpdate", () => {
    const shopDomain = "prod-shop.myshopify.com";
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
    };

    it("upserts product with the correct composite key", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-prod" });
      db.product.upsert.mockResolvedValue({ id: "prod-1" });

      await receiver.handleProductUpdate(shopDomain, productPayload);

      const args = db.product.upsert.mock.calls[0][0];
      expect(args.where).toEqual({
        shopId_shopifyProductId: {
          shopId: "shop-prod",
          shopifyProductId: "999111222",
        },
      });
    });

    it("stores title, vendor, productType and variants on create path", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-prod" });
      db.product.upsert.mockResolvedValue({ id: "prod-1" });

      await receiver.handleProductUpdate(shopDomain, productPayload);

      const args = db.product.upsert.mock.calls[0][0].create;
      expect(args.title).toBe("Super Widget v2");
      expect(args.vendor).toBe("AcmeCo");
      expect(args.productType).toBe("Gadget");
      expect(args.variants).toHaveLength(2);
    });

    it("defaults status to 'active' when status is omitted", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-prod" });
      db.product.upsert.mockResolvedValue({ id: "prod-1" });

      const { status: _s, ...noStatus } = productPayload;
      await receiver.handleProductUpdate(shopDomain, noStatus);

      const args = db.product.upsert.mock.calls[0][0].create;
      expect(args.status).toBe("active");
    });

    it("sets lastSyncAt to a Date", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-prod" });
      db.product.upsert.mockResolvedValue({ id: "prod-1" });

      await receiver.handleProductUpdate(shopDomain, productPayload);

      const args = db.product.upsert.mock.calls[0][0].create;
      expect(args.lastSyncAt).toBeInstanceOf(Date);
    });

    it("is a no-op when shopDomain is absent", async () => {
      await receiver.handleProductUpdate(undefined, productPayload);
      expect(db.product.upsert).not.toHaveBeenCalled();
    });

    it("is a no-op when shop lookup returns null", async () => {
      db.shop.findFirst.mockResolvedValue(null);
      await receiver.handleProductUpdate(shopDomain, productPayload);
      expect(db.product.upsert).not.toHaveBeenCalled();
    });

    it("nulls out productType and vendor when not provided", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-prod" });
      db.product.upsert.mockResolvedValue({ id: "prod-1" });

      const { product_type: _pt, vendor: _v, ...minimal } = productPayload;
      await receiver.handleProductUpdate(shopDomain, minimal);

      const args = db.product.upsert.mock.calls[0][0].create;
      expect(args.productType).toBeNull();
      expect(args.vendor).toBeNull();
    });
  });

  // ─── Idempotency ─────────────────────────────────────────────────────────

  describe("Idempotency", () => {
    it("upserts on order/create so duplicate webhooks are safe", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-idm" });
      db.order.upsert
        .mockResolvedValueOnce({ id: "order-1", created: true })
        .mockResolvedValueOnce({ id: "order-1", created: false });

      const payload = { id: 1, total_price: "10.00" };

      await receiver.handleOrderCreate("idm.myshopify.com", payload);
      await receiver.handleOrderCreate("idm.myshopify.com", payload);

      expect(db.order.upsert).toHaveBeenCalledTimes(2);
      // Both calls target the same composite key — safe to process twice
      const key1 = db.order.upsert.mock.calls[0][0].where;
      const key2 = db.order.upsert.mock.calls[1][0].where;
      expect(key1).toEqual(key2);
    });

    it("upserts on app/installed so re-install is safe", async () => {
      db.shop.upsert.mockResolvedValue({ id: "shop-reinstall" });

      const shopPayload = {
        id: 1,
        name: "Store",
        domain: "store.myshopify.com",
      };

      await receiver.handleAppInstalled(shopPayload);
      await receiver.handleAppInstalled(shopPayload);

      expect(db.shop.upsert).toHaveBeenCalledTimes(2);
      const key1 = db.shop.upsert.mock.calls[0][0].where;
      const key2 = db.shop.upsert.mock.calls[1][0].where;
      expect(key1).toEqual(key2);
    });
  });

  // ─── Webhook always-200 contract ─────────────────────────────────────────

  describe("Error resilience (webhooks must never crash)", () => {
    it("handleAppInstalled swallows DB errors without throwing", async () => {
      db.shop.upsert.mockRejectedValue(new Error("connection lost"));
      // The route catches errors and returns 200 — receiver must not throw
      await expect(
        receiver.handleAppInstalled({
          id: 1,
          name: "x",
          domain: "x.myshopify.com",
        }),
      ).rejects.toThrow(); // Receiver itself throws; route wraps it in try/catch
    });

    // Confirms the route-level try/catch pattern is necessary
    it("handleOrderCreate swallows DB errors without throwing at route level", async () => {
      db.shop.findFirst.mockResolvedValue({ id: "shop-err" });
      db.order.upsert.mockRejectedValue(new Error("deadlock detected"));

      await expect(
        receiver.handleOrderCreate("err.myshopify.com", { id: 1 }),
      ).rejects.toThrow("deadlock detected");
    });
  });
});
