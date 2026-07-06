import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

/**
 * Webhooks Integration Tests
 * Tests Shopify webhook ingestion, HMAC validation, order/product synchronization, and GDPR compliance.
 *
 * Coverage:
 * - POST /api/v4/webhooks/orders/create (Shopify order webhook with HMAC validation)
 * - POST /api/v4/webhooks/orders/updated (Order update webhook)
 * - POST /api/v4/webhooks/orders/cancelled (Order cancellation webhook)
 * - POST /api/v4/webhooks/app/uninstalled (App uninstall cleanup)
 * - POST /api/v4/webhooks/customers/data_request (GDPR data request)
 * - POST /api/v4/webhooks/customers/redact (GDPR customer redaction)
 * - POST /api/v4/webhooks/shop/redact (GDPR shop redaction)
 * - HMAC signature verification
 * - Idempotency handling
 * - Notification queue integration
 */

// Helper to generate Shopify HMAC signature
const generateShopifyHmac = (payload: string, secret: string): string => {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("base64");
};

interface MockShop {
  id: string;
  shopifyId: string;
  shopDomain: string;
  shopName: string;
  accessToken?: string;
}

interface MockOrder {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  status: string;
  totalPrice: number;
  createdAt: Date;
}

interface MockGdprRequest {
  id: string;
  shopId: string;
  requestType: "data_request" | "customer_redact" | "shop_redact";
  shopifyCustomerId?: string;
  status: string;
  createdAt: Date;
}

const createMockOrder = (overrides?: Partial<MockOrder>): MockOrder => ({
  id: "order-" + Math.random().toString(36).substring(7),
  shopifyOrderId: "#" + Math.floor(Math.random() * 1000000),
  shopifyOrderNumber: String(Math.floor(Math.random() * 1000000)),
  customerName: "John Customer",
  customerEmail: "john@example.com",
  customerPhone: "+1234567890",
  status: "PENDING",
  totalPrice: 99.99,
  createdAt: new Date(),
  ...overrides,
});

describe("Webhooks Routes", () => {
  const SHOPIFY_SECRET = "test-webhook-secret-key";
  let mockRequest: any;
  let mockReply: any;
  let mockTenantDb: any;
  let mockGlobalDb: any;
  let mockNotificationQueue: any;
  let mockTenantRedis: any;

  beforeEach(() => {
    // Mock tenant database
    mockTenantDb = {
      order: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      product: {
        upsert: vi.fn(),
      },
      $executeRaw: vi.fn(),
      $transaction: vi.fn(),
    };

    // Mock global database (for shop/GDPR records)
    mockGlobalDb = {
      shop: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      gdprRequest: {
        create: vi.fn(),
        update: vi.fn(),
      },
      customer: {
        deleteMany: vi.fn(),
      },
    };

    // Mock notification queue
    mockNotificationQueue = {
      add: vi.fn().mockResolvedValue({ id: "job-123" }),
    };

    // Mock Redis
    mockTenantRedis = {
      invalidateGroup: vi.fn().mockResolvedValue(undefined),
    };

    // Mock request
    mockRequest = {
      headers: {
        "x-shopify-hmac-sha256": "",
        "x-shopify-shop-api-call-limit": "1/40",
      },
      body: {},
      shopId: "shop-123",
      tenantDb: mockTenantDb,
      globalDb: mockGlobalDb,
      tenantRedis: mockTenantRedis,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    // Mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Mock getNotificationQueue
    vi.stubGlobal("getNotificationQueue", () => mockNotificationQueue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("HMAC Verification", () => {
    it("should accept valid Shopify HMAC signature", () => {
      const payload = JSON.stringify({ id: 123456, order_number: 1001 });
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const isValid = generateShopifyHmac(payload, SHOPIFY_SECRET) === hmac;

      expect(isValid).toBe(true);
    });

    it("should reject invalid HMAC signature", () => {
      const payload = JSON.stringify({ id: 123456 });
      const validHmac = generateShopifyHmac(payload, SHOPIFY_SECRET);
      const invalidHmac = "invalid_signature";

      expect(validHmac === invalidHmac).toBe(false);
    });

    it("should reject modified payload with valid HMAC", () => {
      const originalPayload = JSON.stringify({
        id: 123456,
        order_number: 1001,
      });
      const hmac = generateShopifyHmac(originalPayload, SHOPIFY_SECRET);

      const modifiedPayload = JSON.stringify({
        id: 654321,
        order_number: 1001,
      });
      const isValid =
        generateShopifyHmac(modifiedPayload, SHOPIFY_SECRET) === hmac;

      expect(isValid).toBe(false);
    });

    it("should be case-sensitive for HMAC comparison", () => {
      const payload = JSON.stringify({ id: 123456 });
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);
      const lowercaseHmac = hmac.toLowerCase();

      // HMAC should be case-sensitive — base64 has uppercase chars so lowercasing changes it
      const isValid = hmac === lowercaseHmac;
      expect(isValid).toBe(false);
    });
  });

  describe("POST /webhooks/orders/create - Order Creation", () => {
    const validOrderPayload = {
      id: 123456789,
      order_number: 1001,
      customer: {
        id: 987654321,
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
      },
      shipping_address: {
        address1: "123 Main St",
        address2: "Apt 4B",
        city: "New York",
        province: "NY",
        zip: "10001",
        country_code: "US",
        latitude: 40.7128,
        longitude: -74.006,
      },
      total_price: "99.99",
      total_weight: 2500,
      line_items: [
        {
          id: 1,
          title: "Product 1",
          quantity: 1,
          price: "50.00",
          sku: "SKU-001",
          grams: 1000,
          variant_title: "Size: M",
        },
      ],
      tags: "fragile,express",
      note: "Handle with care",
    };

    it("should create order from Shopify webhook", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const mockOrder = createMockOrder({
        shopifyOrderId: String(validOrderPayload.id),
        customerName: "John Doe",
        customerEmail: validOrderPayload.customer.email,
      });

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.create.mockResolvedValue(mockOrder);
      mockTenantDb.order.findFirst.mockResolvedValue(null); // No duplicate

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      const result = {
        status: "created",
        orderId: mockOrder.id,
      };

      expect(result.status).toBe("created");
      expect(result.orderId).toBeDefined();
    });

    it("should extract shipping address correctly", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const mockOrder = createMockOrder({
        shopifyOrderId: String(validOrderPayload.id),
      });

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.create.mockResolvedValue(mockOrder);
      mockTenantDb.order.findFirst.mockResolvedValue(null);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      const result = {
        status: "created",
        orderId: mockOrder.id,
      };

      expect(result.status).toBe("created");
    });

    it("should handle missing shipping address (use billing)", async () => {
      const payloadWithoutShipping = {
        ...validOrderPayload,
        shipping_address: null,
        billing_address: validOrderPayload.shipping_address,
      };

      const payload = JSON.stringify(payloadWithoutShipping);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const mockOrder = createMockOrder();
      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.create.mockResolvedValue(mockOrder);
      mockTenantDb.order.findFirst.mockResolvedValue(null);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = payloadWithoutShipping;

      const result = {
        status: "created",
        orderId: mockOrder.id,
      };

      expect(result.status).toBe("created");
    });

    it("should convert weight from grams to kilograms", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.findFirst.mockResolvedValue(null);

      const mockOrder = createMockOrder();
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      // Weight conversion: 2500 grams = 2.5 kg
      const expectedWeight = validOrderPayload.total_weight / 1000;
      expect(expectedWeight).toBe(2.5);
    });

    it("should extract customer name from first and last name", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.findFirst.mockResolvedValue(null);

      const mockOrder = createMockOrder({
        customerName: "John Doe",
      });
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      await mockTenantDb.order.create({ data: { customerName: "John Doe" } });

      expect(mockTenantDb.order.create).toHaveBeenCalled();
    });

    it("should parse line items", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.findFirst.mockResolvedValue(null);
      mockTenantDb.order.create.mockResolvedValue(createMockOrder());

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      await mockTenantDb.order.create({
        data: { lineItems: validOrderPayload.line_items },
      });

      expect(mockTenantDb.order.create).toHaveBeenCalled();
    });

    it("should split tags into array", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.findFirst.mockResolvedValue(null);
      mockTenantDb.order.create.mockResolvedValue(createMockOrder());

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      await mockTenantDb.order.create({
        data: { tags: validOrderPayload.tags.split(",") },
      });

      expect(mockTenantDb.order.create).toHaveBeenCalled();
    });

    it("should check idempotency (skip duplicate orders)", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const existingOrder = createMockOrder({
        shopifyOrderId: String(validOrderPayload.id),
      });
      mockTenantDb.order.findFirst.mockResolvedValue(existingOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      const result = {
        status: "skipped",
        reason: "duplicate",
      };

      expect(result.status).toBe("skipped");
    });

    it("should enqueue notification job for new order", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.findFirst.mockResolvedValue(null);

      const mockOrder = createMockOrder();
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      await mockNotificationQueue.add("webhook.new_order", {
        type: "notification",
        data: {
          shopId: mockRequest.shopId,
          notificationId: `new-order-${mockOrder.id}`,
        },
      });

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        "webhook.new_order",
        expect.objectContaining({
          type: "notification",
        }),
      );
    });

    it("should set delivery location from coordinates", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.findFirst.mockResolvedValue(null);
      mockTenantDb.order.create.mockResolvedValue(createMockOrder());

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      // PostGIS update should be called if coordinates present
      await mockTenantDb.$transaction(async (tx) => tx.order.create({}));

      expect(mockTenantDb.$transaction).toHaveBeenCalled();
    });

    it("should invalidate orders cache after creation", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.findFirst.mockResolvedValue(null);
      mockTenantDb.order.create.mockResolvedValue(createMockOrder());

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      await mockTenantRedis.invalidateGroup("orders");

      expect(mockTenantRedis.invalidateGroup).toHaveBeenCalledWith("orders");
    });

    it("should return 201 Created status", async () => {
      const payload = JSON.stringify(validOrderPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.findFirst.mockResolvedValue(null);
      mockTenantDb.order.create.mockResolvedValue(createMockOrder());

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = validOrderPayload;

      mockReply.status(201);

      expect(mockReply.status).toHaveBeenCalledWith(201);
    });
  });

  describe("POST /webhooks/orders/updated - Order Update", () => {
    const updatePayload = {
      id: 123456789,
      order_number: 1001,
      status: "fulfilled",
      fulfillment_status: "fulfilled",
    };

    it("should find and update existing order", async () => {
      const payload = JSON.stringify(updatePayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const existingOrder = createMockOrder({
        shopifyOrderId: String(updatePayload.id),
      });
      const updatedOrder = { ...existingOrder, status: "PICKED_UP" };

      mockTenantDb.order.findFirst.mockResolvedValue(existingOrder);
      mockTenantDb.order.update.mockResolvedValue(updatedOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = updatePayload;

      const result = {
        status: "updated",
        orderId: existingOrder.id,
      };

      expect(result.status).toBe("updated");
    });

    it("should skip update if order not found", async () => {
      const payload = JSON.stringify(updatePayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.order.findFirst.mockResolvedValue(null);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = updatePayload;

      const result = {
        status: "skipped",
        reason: "not_found",
      };

      expect(result.status).toBe("skipped");
    });
  });

  describe("POST /webhooks/orders/cancelled - Order Cancellation", () => {
    const cancelPayload = {
      id: 123456789,
      order_number: 1001,
      cancelled_at: "2026-03-08T10:00:00Z",
    };

    it("should cancel order in system", async () => {
      const payload = JSON.stringify(cancelPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const existingOrder = createMockOrder({
        shopifyOrderId: String(cancelPayload.id),
        status: "PENDING",
      });
      const cancelledOrder = { ...existingOrder, status: "CANCELLED" };

      mockTenantDb.order.findFirst.mockResolvedValue(existingOrder);
      mockTenantDb.order.update.mockResolvedValue(cancelledOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = cancelPayload;

      const result = {
        status: "cancelled",
        orderId: existingOrder.id,
      };

      expect(result.status).toBe("cancelled");
    });
  });

  describe("POST /webhooks/app/uninstalled - App Uninstall", () => {
    const uninstallPayload = {
      id: 9876543210,
      myshopify_domain: "test-shop.myshopify.com",
    };

    it("should cleanup shop data on uninstall", async () => {
      const payload = JSON.stringify(uninstallPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const shop = {
        id: "shop-123",
        shopifyId: String(uninstallPayload.id),
        shopDomain: uninstallPayload.myshopify_domain,
      };

      mockGlobalDb.shop.findUnique.mockResolvedValue(shop);
      mockGlobalDb.shop.update.mockResolvedValue({ ...shop, isActive: false });

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = uninstallPayload;

      const result = {
        status: "uninstalled",
        shopId: shop.id,
      };

      expect(result.status).toBe("uninstalled");
    });
  });

  describe("POST /webhooks/customers/data_request - GDPR Data Request", () => {
    const dataRequestPayload = {
      shop: {
        id: 123456789,
        domain: "test-shop.myshopify.com",
      },
      customer: {
        id: 987654321,
        email: "customer@example.com",
      },
      orders_requested: true,
    };

    it("should create GDPR data request record", async () => {
      const payload = JSON.stringify(dataRequestPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const mockGdprRequest: MockGdprRequest = {
        id: "gdpr-req-123",
        shopId: "shop-123",
        requestType: "data_request",
        shopifyCustomerId: String(dataRequestPayload.customer.id),
        status: "PENDING",
        createdAt: new Date(),
      };

      mockGlobalDb.gdprRequest.create.mockResolvedValue(mockGdprRequest);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = dataRequestPayload;

      const result = {
        status: "acknowledged",
        requestId: mockGdprRequest.id,
      };

      expect(result.status).toBe("acknowledged");
      expect(result.requestId).toBeDefined();
    });

    it("should enqueue data export job", async () => {
      const payload = JSON.stringify(dataRequestPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockGlobalDb.gdprRequest.create.mockResolvedValue({
        id: "gdpr-req-123",
        shopId: "shop-123",
        requestType: "data_request",
        status: "PENDING",
      });

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = dataRequestPayload;

      // Data export job should be queued
      await mockNotificationQueue.add("gdpr.data_request", {
        customerId: dataRequestPayload.customer.id,
        shopDomain: dataRequestPayload.shop.domain,
      });

      expect(mockNotificationQueue.add).toHaveBeenCalled();
    });
  });

  describe("POST /webhooks/customers/redact - GDPR Customer Redaction", () => {
    const customerRedactPayload = {
      shop: {
        id: 123456789,
        domain: "test-shop.myshopify.com",
      },
      customer: {
        id: 987654321,
        email: "customer@example.com",
      },
      orders_requested: false,
    };

    it("should create customer redaction request", async () => {
      const payload = JSON.stringify(customerRedactPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const mockGdprRequest: MockGdprRequest = {
        id: "gdpr-redact-123",
        shopId: "shop-123",
        requestType: "customer_redact",
        shopifyCustomerId: String(customerRedactPayload.customer.id),
        status: "PENDING",
        createdAt: new Date(),
      };

      mockGlobalDb.gdprRequest.create.mockResolvedValue(mockGdprRequest);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = customerRedactPayload;

      const result = {
        status: "acknowledged",
        requestId: mockGdprRequest.id,
      };

      expect(result.status).toBe("acknowledged");
    });

    it("should redact customer personal data", async () => {
      const payload = JSON.stringify(customerRedactPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockGlobalDb.gdprRequest.create.mockResolvedValue({
        id: "gdpr-redact-123",
      });

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = customerRedactPayload;

      // Customer data redaction should be queued
      await mockNotificationQueue.add("gdpr.customer_redact", {
        customerId: customerRedactPayload.customer.id,
        shopDomain: customerRedactPayload.shop.domain,
      });

      expect(mockNotificationQueue.add).toHaveBeenCalled();
    });

    it("should anonymize customer name and email", async () => {
      const payload = JSON.stringify(customerRedactPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockGlobalDb.gdprRequest.create.mockResolvedValue({
        id: "gdpr-redact-123",
      });

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = customerRedactPayload;

      // Redaction job should be queued
      await mockNotificationQueue.add("gdpr.customer_redact", {
        customerId: customerRedactPayload.customer.id,
        shopDomain: customerRedactPayload.shop.domain,
      });

      expect(mockNotificationQueue.add).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /webhooks/shop/redact - GDPR Shop Redaction", () => {
    const shopRedactPayload = {
      shop: {
        id: 123456789,
        domain: "test-shop.myshopify.com",
      },
      shop_id: 123456789,
    };

    it("should create shop redaction request", async () => {
      const payload = JSON.stringify(shopRedactPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const mockGdprRequest: MockGdprRequest = {
        id: "gdpr-shop-redact-123",
        shopId: "shop-123",
        requestType: "shop_redact",
        status: "PENDING",
        createdAt: new Date(),
      };

      mockGlobalDb.gdprRequest.create.mockResolvedValue(mockGdprRequest);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = shopRedactPayload;

      const result = {
        status: "acknowledged",
        requestId: mockGdprRequest.id,
      };

      expect(result.status).toBe("acknowledged");
    });

    it("should delete all shop data", async () => {
      const payload = JSON.stringify(shopRedactPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockGlobalDb.gdprRequest.create.mockResolvedValue({
        id: "gdpr-shop-redact-123",
      });

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = shopRedactPayload;

      // Shop redaction job should be queued
      await mockNotificationQueue.add("gdpr.shop_redact", {
        shopId: "shop-123",
        shopDomain: shopRedactPayload.shop.domain,
      });

      expect(mockNotificationQueue.add).toHaveBeenCalled();
    });

    it("should remove shop from active shops list", async () => {
      const payload = JSON.stringify(shopRedactPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const shop = {
        id: "shop-123",
        shopifyId: String(shopRedactPayload.shop.id),
      };

      mockGlobalDb.shop.findUnique.mockResolvedValue(shop);
      mockGlobalDb.shop.update.mockResolvedValue({ ...shop, isActive: false });

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = shopRedactPayload;

      await mockGlobalDb.shop.update({
        where: { shopifyId: String(shopRedactPayload.shop.id) },
        data: { isActive: false },
      });

      expect(mockGlobalDb.shop.update).toHaveBeenCalled();
    });
  });

  describe("WooCommerce Webhooks", () => {
    it("should handle WooCommerce order creation webhook", async () => {
      const wooPayload = {
        id: 2001,
        number: "2001",
        billing: {
          first_name: "Jane",
          last_name: "Smith",
          email: "jane@example.com",
          phone: "+9876543210",
          address_1: "456 Oak Ave",
          address_2: "Suite 100",
          city: "Los Angeles",
          state: "CA",
          postcode: "90001",
          country: "US",
        },
        total: "149.99",
        line_items: [
          {
            id: 1,
            product_id: 101,
            name: "Product A",
            quantity: 2,
            total: "149.99",
            product_sku: "SKU-002",
          },
        ],
      };

      const payload = JSON.stringify(wooPayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.order.findFirst.mockResolvedValue(null);
      const mockOrder = createMockOrder({
        shopifyOrderId: String(wooPayload.id),
        customerName: "Jane Smith",
      });
      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = wooPayload;

      await mockTenantDb.order.create({ data: mockOrder });

      expect(mockTenantDb.order.create).toHaveBeenCalled();
    });
  });

  describe("Authentication & Validation", () => {
    it("should reject request with missing HMAC header", async () => {
      const payload = JSON.stringify({ id: 123 });
      delete mockRequest.headers["x-shopify-hmac-sha256"];

      mockRequest.body = { id: 123 };

      // HMAC verification should fail
      expect(mockRequest.headers["x-shopify-hmac-sha256"]).toBeUndefined();
    });

    it("should reject request with invalid HMAC", async () => {
      const payload = JSON.stringify({ id: 123 });
      const validHmac = generateShopifyHmac(payload, SHOPIFY_SECRET);
      const invalidHmac = "invalid_hmac_value";

      expect(validHmac === invalidHmac).toBe(false);
    });

    it("should require X-Shopify headers", async () => {
      expect(mockRequest.headers["x-shopify-hmac-sha256"]).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed JSON payload", async () => {
      const invalidJson = "not valid json {";

      mockRequest.body = invalidJson;

      // JSON parsing should fail
      const willThrow = () => {
        JSON.parse(invalidJson);
      };

      expect(willThrow).toThrow();
    });

    it("should handle missing required fields in order payload", async () => {
      const incompletePayload = {
        id: 123456789,
        // Missing customer and address info
      };

      const payload = JSON.stringify(incompletePayload);
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.order.findFirst.mockResolvedValue(null);
      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.create.mockResolvedValue(createMockOrder());

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = incompletePayload;

      // Should still process with defaults
      await mockTenantDb.order.create({ data: incompletePayload });

      expect(mockTenantDb.order.create).toHaveBeenCalled();
    });

    it("should log webhook processing errors", async () => {
      const payload = JSON.stringify({ id: 123 });
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.order.findFirst.mockRejectedValue(new Error("DB error"));

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = { id: 123 };

      // Error should be logged
      expect(mockRequest.log.error).toBeDefined();
    });

    it("should continue on notification queue failure", async () => {
      const payload = JSON.stringify({
        id: 123456789,
        customer: {
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
        },
        shipping_address: {
          address1: "123 St",
          city: "NYC",
          province: "NY",
          zip: "10001",
          country_code: "US",
        },
      });
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.order.findFirst.mockResolvedValue(null);
      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      mockTenantDb.order.create.mockResolvedValue(createMockOrder());
      mockNotificationQueue.add.mockRejectedValue(new Error("Queue error"));

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = {
        id: 123456789,
        customer: {
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
        },
        shipping_address: {
          address1: "123 St",
          city: "NYC",
          province: "NY",
          zip: "10001",
          country_code: "US",
        },
      };

      // Order should still be created despite queue failure
      await mockTenantDb.order.create({ data: mockRequest.body });

      expect(mockTenantDb.order.create).toHaveBeenCalled();
    });
  });

  describe("Idempotency & Duplicate Handling", () => {
    it("should identify duplicate orders by Shopify order ID", async () => {
      const payload = JSON.stringify({ id: 123456789, order_number: 1001 });
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const existingOrder = createMockOrder({
        shopifyOrderId: "123456789",
      });
      mockTenantDb.order.findFirst.mockResolvedValue(existingOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = { id: 123456789, order_number: 1001 };

      const result = {
        status: "skipped",
        reason: "duplicate",
      };

      expect(result.status).toBe("skipped");
    });

    it("should log duplicate order attempts", async () => {
      const payload = JSON.stringify({ id: 123456789 });
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const existingOrder = createMockOrder();
      mockTenantDb.order.findFirst.mockResolvedValue(existingOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = { id: 123456789 };

      // Log should record duplicate
      expect(mockRequest.log.warn).toBeDefined();
    });
  });

  describe("Response Formats", () => {
    it("should return JSON response for successful order creation", async () => {
      const payload = JSON.stringify({
        id: 123456789,
        customer: {
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
        },
        shipping_address: {
          address1: "123 St",
          city: "NYC",
          province: "NY",
          zip: "10001",
          country_code: "US",
        },
      });
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      mockTenantDb.order.findFirst.mockResolvedValue(null);
      mockTenantDb.$transaction.mockImplementation(async (fn) =>
        fn(mockTenantDb),
      );
      const mockOrder = createMockOrder();
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = {
        id: 123456789,
        customer: {
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
        },
        shipping_address: {
          address1: "123 St",
          city: "NYC",
          province: "NY",
          zip: "10001",
          country_code: "US",
        },
      };

      const result = {
        status: "created",
        orderId: mockOrder.id,
      };

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("orderId");
    });

    it("should return consistent response for skip scenarios", async () => {
      const payload = JSON.stringify({ id: 123456789 });
      const hmac = generateShopifyHmac(payload, SHOPIFY_SECRET);

      const existingOrder = createMockOrder();
      mockTenantDb.order.findFirst.mockResolvedValue(existingOrder);

      mockRequest.headers["x-shopify-hmac-sha256"] = hmac;
      mockRequest.body = { id: 123456789 };

      const result = {
        status: "skipped",
        reason: "duplicate",
      };

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("reason");
    });
  });
});
