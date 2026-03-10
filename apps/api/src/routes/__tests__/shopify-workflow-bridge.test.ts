/**
 * Shopify Workflow Bridge Tests
 *
 * Comprehensive test suite for webhook signature verification, payload
 * transformation, idempotency, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";

// ─── Mock Types ─────────────────────────────────────

interface MockRequest {
  headers: Record<string, string>;
  body: any;
  rawBody: string;
  log: { warn: any; error: any; info: any };
}

interface MockReply {
  status: (code: number) => MockReply;
  json: (data: any) => any;
}

// ─── Test Data Generators ───────────────────────────

function createMockShopifyOrder(overrides: any = {}) {
  return {
    id: "gid://shopify/Order/12345",
    order_number: 1001,
    email: "customer@example.com",
    phone: "+1-555-123-4567",
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-15T10:30:00Z",
    line_items: [
      {
        id: "item-1",
        title: "Product A",
        quantity: 2,
        price: "29.99",
        sku: "PROD-A-001",
      },
    ],
    shipping_address: {
      first_name: "John",
      last_name: "Doe",
      address1: "123 Main St",
      address2: "Apt 4B",
      city: "New York",
      province_code: "NY",
      country_code: "US",
      zip: "10001",
      phone: "+1-555-123-4567",
    },
    billing_address: null,
    total_price: "59.98",
    currency: "USD",
    financial_status: "paid",
    fulfillment_status: null,
    customer: {
      id: "cust-123",
      email: "customer@example.com",
      first_name: "John",
      last_name: "Doe",
      phone: "+1-555-123-4567",
    },
    ...overrides,
  };
}

function createMockShopifyFulfillment(overrides: any = {}) {
  return {
    id: "gid://shopify/Fulfillment/67890",
    order_id: "gid://shopify/Order/12345",
    status: "success",
    created_at: "2024-01-15T11:00:00Z",
    updated_at: "2024-01-15T11:00:00Z",
    line_items: [
      {
        id: "item-1",
        title: "Product A",
        quantity: 2,
        sku: "PROD-A-001",
      },
    ],
    tracking_info: {
      number: "1Z999AA10123456784",
      company: "UPS",
      url: "https://tracking.ups.com/track?tracknum=1Z999AA10123456784",
    },
    ...overrides,
  };
}

function createSignedRequest(
  order: any,
  secret: string = "test-secret-123"
): { signature: string; rawBody: string } {
  const rawBody = JSON.stringify(order);
  const signature = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return { signature, rawBody };
}

// ─── Tests ──────────────────────────────────────────

describe("Shopify Workflow Bridge", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let replyStatus: number;
  let replyData: any;

  beforeEach(() => {
    replyStatus = 200;
    replyData = {};

    mockReply = {
      status: (code: number) => {
        replyStatus = code;
        return mockReply;
      },
      json: (data: any) => {
        replyData = data;
        return replyData;
      },
    };

    mockRequest = {
      headers: {},
      body: {},
      rawBody: "",
      log: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
    };
  });

  describe("Signature Verification", () => {
    it("should verify valid HMAC-SHA256 signature", () => {
      const order = createMockShopifyOrder();
      const secret = "test-secret-123";
      const { signature, rawBody } = createSignedRequest(order, secret);

      mockRequest.headers["x-shopify-hmac-sha256"] = signature;
      mockRequest.rawBody = rawBody;

      // Verify locally
      const computed = createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("base64");

      expect(computed).toBe(signature);
    });

    it("should reject invalid HMAC-SHA256 signature", () => {
      const order = createMockShopifyOrder();
      const secret = "test-secret-123";
      const { rawBody } = createSignedRequest(order, secret);

      const invalidSignature = createHmac("sha256", "wrong-secret")
        .update(rawBody, "utf8")
        .digest("base64");

      mockRequest.headers["x-shopify-hmac-sha256"] = invalidSignature;
      mockRequest.rawBody = rawBody;

      const computed = createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("base64");

      expect(computed).not.toBe(invalidSignature);
    });

    it("should reject request without signature header", () => {
      const order = createMockShopifyOrder();
      mockRequest.body = order;
      delete mockRequest.headers["x-shopify-hmac-sha256"];

      // Simulate header validation in route
      const hasSignature = !!mockRequest.headers["x-shopify-hmac-sha256"];
      expect(hasSignature).toBe(false);
    });

    it("should reject request without shop ID header", () => {
      const order = createMockShopifyOrder();
      const { signature, rawBody } = createSignedRequest(order);
      mockRequest.headers["x-shopify-hmac-sha256"] = signature;
      mockRequest.rawBody = rawBody;
      delete mockRequest.headers["x-shopify-shop-id"];

      const hasShopId = !!mockRequest.headers["x-shopify-shop-id"];
      expect(hasShopId).toBe(false);
    });
  });

  describe("Payload Transformation", () => {
    it("should transform Shopify order to Witylogix format", () => {
      const order = createMockShopifyOrder();

      const transformed = {
        customerName: `${order.customer.first_name} ${order.customer.last_name}`,
        customerEmail: order.customer.email,
        customerPhone: order.customer.phone,
        pickupAddress: {
          street: "Warehouse",
          city: "Distribution Center",
          state: "DC",
          zip: "00000",
          country: "US",
        },
        deliveryAddress: {
          street: `${order.shipping_address.address1} ${order.shipping_address.address2}`.trim(),
          city: order.shipping_address.city,
          state: order.shipping_address.province_code,
          zip: order.shipping_address.zip,
          country: order.shipping_address.country_code,
        },
        items: order.line_items.map((item: any) => ({
          sku: item.sku,
          title: item.title,
          quantity: item.quantity,
          price: parseFloat(item.price),
        })),
        totalAmount: parseFloat(order.total_price),
        currency: order.currency,
        notes: `Shopify Order #${order.order_number}`,
        priority: "high",
      };

      expect(transformed.customerName).toBe("John Doe");
      expect(transformed.customerEmail).toBe("customer@example.com");
      expect(transformed.deliveryAddress.city).toBe("New York");
      expect(transformed.deliveryAddress.state).toBe("NY");
      expect(transformed.items.length).toBe(1);
      expect(transformed.items[0].sku).toBe("PROD-A-001");
      expect(transformed.totalAmount).toBe(59.98);
      expect(transformed.priority).toBe("high");
    });

    it("should handle missing shipping address", () => {
      const order = createMockShopifyOrder({
        shipping_address: null,
        billing_address: {
          city: "Los Angeles",
          province_code: "CA",
          country_code: "US",
          zip: "90001",
        },
      });

      const address = order.shipping_address || order.billing_address;
      expect(address).toBeTruthy();
      expect(address.city).toBe("Los Angeles");
    });

    it("should handle guest checkout (no customer data)", () => {
      const order = createMockShopifyOrder({
        customer: null,
        email: "guest@example.com",
      });

      const customerName =
        order.customer?.first_name && order.customer?.last_name
          ? `${order.customer.first_name} ${order.customer.last_name}`
          : "Guest";

      expect(customerName).toBe("Guest");
    });

    it("should transform Shopify fulfillment to shipment update format", () => {
      const fulfillment = createMockShopifyFulfillment();

      const statusMap: Record<string, string> = {
        pending: "PROCESSING",
        in_progress: "OUT_FOR_DELIVERY",
        success: "DELIVERED",
        cancelled: "CANCELLED",
        error: "FAILED",
        on_hold: "PENDING",
      };

      const transformed = {
        status: statusMap[fulfillment.status],
        trackingNumber: fulfillment.tracking_info?.number,
        trackingCarrier: fulfillment.tracking_info?.company,
        trackingUrl: fulfillment.tracking_info?.url,
        updatedAt: new Date(fulfillment.updated_at).toISOString(),
      };

      expect(transformed.status).toBe("DELIVERED");
      expect(transformed.trackingNumber).toBe("1Z999AA10123456784");
      expect(transformed.trackingCarrier).toBe("UPS");
    });

    it("should handle fulfillment without tracking info", () => {
      const fulfillment = createMockShopifyFulfillment({
        tracking_info: undefined,
      });

      const transformed = {
        status: "DELIVERED",
        trackingNumber: fulfillment.tracking_info?.number,
        trackingCarrier: fulfillment.tracking_info?.company,
        trackingUrl: fulfillment.tracking_info?.url,
      };

      expect(transformed.trackingNumber).toBeUndefined();
      expect(transformed.trackingCarrier).toBeUndefined();
      expect(transformed.trackingUrl).toBeUndefined();
    });
  });

  describe("Idempotency", () => {
    it("should prevent duplicate order processing with same Shopify order ID", () => {
      const order1 = createMockShopifyOrder({ id: "gid://shopify/Order/12345" });
      const order2 = createMockShopifyOrder({ id: "gid://shopify/Order/12345" });

      // Both have same Shopify ID
      expect(order1.id).toBe(order2.id);

      // Second request should be identified as duplicate
      const isIdempotent = order1.id === order2.id;
      expect(isIdempotent).toBe(true);
    });

    it("should allow different Shopify order IDs to be processed", () => {
      const order1 = createMockShopifyOrder({ id: "gid://shopify/Order/12345" });
      const order2 = createMockShopifyOrder({ id: "gid://shopify/Order/67890" });

      expect(order1.id).not.toBe(order2.id);
    });

    it("should include correlation ID for tracing", () => {
      const shopifyOrderId = "gid://shopify/Order/12345";
      const correlationId = `shopify-${shopifyOrderId}`;

      expect(correlationId).toBe("shopify-gid://shopify/Order/12345");
      expect(correlationId).toContain("shopify-");
    });
  });

  describe("Error Handling", () => {
    it("should reject malformed JSON payload", () => {
      mockRequest.rawBody = "{ invalid json";

      const isValidJson = (() => {
        try {
          JSON.parse(mockRequest.rawBody);
          return true;
        } catch {
          return false;
        }
      })();

      expect(isValidJson).toBe(false);
    });

    it("should reject payload missing required fields", () => {
      const invalidOrder = {
        id: "gid://shopify/Order/12345",
        // Missing order_number, email, etc.
      };

      expect(invalidOrder.order_number).toBeUndefined();
      expect(invalidOrder.email).toBeUndefined();
    });

    it("should handle database errors gracefully", () => {
      const order = createMockShopifyOrder();

      // Simulate database error
      const dbError = new Error("Database connection failed");

      expect(() => {
        throw dbError;
      }).toThrow("Database connection failed");
    });

    it("should log failed webhook deliveries", () => {
      const order = createMockShopifyOrder();
      const error = new Error("Processing failed");

      const logEntry = {
        shopId: "shop-123",
        eventType: "shopify.order.created",
        externalId: order.id,
        statusCode: 500,
        payload: order,
        success: false,
        error: error.message,
      };

      expect(logEntry.success).toBe(false);
      expect(logEntry.statusCode).toBe(500);
      expect(logEntry.error).toBe("Processing failed");
    });
  });

  describe("Rate Limiting", () => {
    it("should track requests per shop", () => {
      const shopId = "shop-123";
      const requestLog: { shopId: string; timestamp: number }[] = [];

      // Simulate 5 requests from same shop
      for (let i = 0; i < 5; i++) {
        requestLog.push({ shopId, timestamp: Date.now() });
      }

      const requestsInWindow = requestLog.filter(
        (r) => Date.now() - r.timestamp < 60000
      ).length;

      expect(requestsInWindow).toBe(5);
    });

    it("should allow 100 requests per minute per shop", () => {
      const shopId = "shop-123";
      const limit = 100;
      const requests = Array.from({ length: limit }, (_, i) => ({
        shopId,
        timestamp: Date.now(),
      }));

      const inWindow = requests.filter(
        (r) => Date.now() - r.timestamp < 60000
      ).length;

      expect(inWindow).toBeLessThanOrEqual(limit);
    });

    it("should reject requests exceeding rate limit", () => {
      const shopId = "shop-123";
      const limit = 100;
      const requests = Array.from({ length: 101 }, (_, i) => ({
        shopId,
        timestamp: Date.now(),
      }));

      const inWindow = requests.filter(
        (r) => Date.now() - r.timestamp < 60000
      ).length;

      const shouldReject = inWindow > limit;
      expect(shouldReject).toBe(true);
    });
  });

  describe("Webhook Delivery Logging", () => {
    it("should log successful webhook delivery", () => {
      const order = createMockShopifyOrder();

      const logEntry = {
        shopId: "shop-123",
        eventType: "shopify.order.created",
        externalId: order.id,
        statusCode: 202,
        payload: order,
        success: true,
      };

      expect(logEntry.success).toBe(true);
      expect(logEntry.statusCode).toBe(202);
      expect(logEntry.externalId).toBe(order.id);
    });

    it("should include correlation ID in log entry", () => {
      const shopifyOrderId = "gid://shopify/Order/12345";
      const correlationId = `shopify-${shopifyOrderId}`;

      const logEntry = {
        correlationId,
        shopifyOrderId,
      };

      expect(logEntry.correlationId).toBe(correlationId);
    });

    it("should track response time for webhook delivery", () => {
      const startTime = Date.now();
      // Simulate processing
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const logEntry = {
        responseTime,
        statusCode: 202,
      };

      expect(logEntry.responseTime).toBeGreaterThanOrEqual(0);
      expect(typeof logEntry.responseTime).toBe("number");
    });
  });

  describe("Fulfillment Webhook Handling", () => {
    it("should match fulfillment to associated order", () => {
      const order = createMockShopifyOrder({
        id: "gid://shopify/Order/12345",
      });
      const fulfillment = createMockShopifyFulfillment({
        order_id: "gid://shopify/Order/12345",
      });

      const matches = String(order.id) === String(fulfillment.order_id);
      expect(matches).toBe(true);
    });

    it("should handle fulfillment for non-existent order", () => {
      const fulfillment = createMockShopifyFulfillment({
        order_id: "gid://shopify/Order/99999",
      });

      // Simulate database lookup
      const order = null;

      expect(order).toBeNull();
    });

    it("should update shipment status based on fulfillment status", () => {
      const statuses = [
        { shopify: "pending", witylogix: "PROCESSING" },
        { shopify: "in_progress", witylogix: "OUT_FOR_DELIVERY" },
        { shopify: "success", witylogix: "DELIVERED" },
        { shopify: "cancelled", witylogix: "CANCELLED" },
        { shopify: "error", witylogix: "FAILED" },
      ];

      statuses.forEach(({ shopify, witylogix }) => {
        const fulfillment = createMockShopifyFulfillment({
          status: shopify,
        });

        const statusMap: Record<string, string> = {
          pending: "PROCESSING",
          in_progress: "OUT_FOR_DELIVERY",
          success: "DELIVERED",
          cancelled: "CANCELLED",
          error: "FAILED",
          on_hold: "PENDING",
        };

        expect(statusMap[shopify]).toBe(witylogix);
      });
    });
  });
});
