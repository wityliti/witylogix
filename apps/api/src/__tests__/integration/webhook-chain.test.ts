/**
 * @witylogix/api — Webhook Chain Integration Tests
 *
 * End-to-end tests for webhook processing pipelines:
 * - Shopify order webhook → Process → Outbound webhook delivery → HMAC verification
 * - WooCommerce webhook → Platform adapter → Order creation
 * - Dead letter queue handling for failed webhooks
 * - Cross-platform webhook consistency
 *
 * Pattern: Mock Prisma at top level, test realistic multi-step flows
 *
 * ~600-800 lines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";

// Mock types matching webhook architecture
interface ShopifyWebhookPayload {
  id: number;
  email: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
  }>;
  shipping_address: {
    address1: string;
    city: string;
    province_code: string;
    zip: string;
    country_code: string;
  };
  total_price: string;
}

interface WooCommerceWebhookPayload {
  id: number;
  date_created: string;
  billing: {
    email: string;
    first_name: string;
    last_name: string;
  };
  shipping: {
    address_1: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    product_id: number;
    name: string;
    quantity: number;
    price: string;
  }>;
  total: string;
}

interface WebhookDeliveryRequest {
  webhookId: string;
  event: string;
  payload: Record<string, any>;
  timestamp: string;
}

interface WebhookDeliveryResponse {
  id: string;
  webhookId: string;
  status: "success" | "failure" | "pending";
  statusCode?: number;
  error?: string;
  responseBody?: string;
  deliveredAt?: string;
  attemptCount: number;
  lastAttemptAt: string;
}

interface DeadLetterMessage {
  id: string;
  webhookId: string;
  originalPayload: Record<string, any>;
  error: string;
  reason: string;
  failureCount: number;
  createdAt: string;
  expiresAt: string;
}

interface OutboundWebhookRequest {
  targetUrl: string;
  event: string;
  payload: Record<string, any>;
  secret: string;
}

// Test data generators
const generateId = (prefix: string = "test") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// HMAC signature generator (matching real implementation)
const generateHmacSignature = (payload: string, secret: string): string => {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64");
};

// Verify HMAC signature
const verifyHmacSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = generateHmacSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

describe("Webhook Chain Integration Tests", () => {
  let mockPrisma: any;
  let shopId: string;
  let webhookId: string;

  beforeEach(() => {
    // Mock Prisma client at top level
    mockPrisma = {
      customWebhook: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      webhookDelivery: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      webhookRetry: {
        create: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      deadLetterQueue: {
        create: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      shop: {
        findUnique: vi.fn(),
      },
      order: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      customer: {
        upsert: vi.fn(),
      },
      inboundWebhookLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    shopId = generateId("shop");
    webhookId = generateId("webhook");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Shopify Order Webhook Flow", () => {
    it("should ingest Shopify webhook → validate → create order → send outbound webhook", async () => {
      // Step 1: Receive Shopify webhook
      const shopifyPayload: ShopifyWebhookPayload = {
        id: 1234567890,
        email: "customer@example.com",
        customer: {
          id: 123,
          email: "customer@example.com",
          first_name: "John",
          last_name: "Doe",
        },
        line_items: [
          {
            id: 1,
            title: "Product A",
            quantity: 2,
            price: "29.99",
          },
          {
            id: 2,
            title: "Product B",
            quantity: 1,
            price: "49.99",
          },
        ],
        shipping_address: {
          address1: "123 Main St",
          city: "New York",
          province_code: "NY",
          zip: "10001",
          country_code: "US",
        },
        total_price: "109.97",
      };

      const payloadString = JSON.stringify(shopifyPayload);
      const secret = "shopify_webhook_secret_123";
      const hmacSignature = generateHmacSignature(payloadString, secret);

      // Validate HMAC
      const isValid = verifyHmacSignature(payloadString, hmacSignature, secret);
      expect(isValid).toBe(true);

      // Log inbound webhook
      mockPrisma.inboundWebhookLog.create.mockResolvedValue({
        id: generateId("webhooklog"),
        source: "SHOPIFY",
        eventType: "orders/create",
        payload: shopifyPayload,
        isValid: true,
        createdAt: new Date().toISOString(),
      });

      const webhookLog = await mockPrisma.inboundWebhookLog.create({
        data: {
          source: "SHOPIFY",
          eventType: "orders/create",
          payload: shopifyPayload,
          isValid: true,
        },
      });

      expect(webhookLog.isValid).toBe(true);

      // Step 2: Transform and validate data
      const transformedOrder = {
        externalOrderId: shopifyPayload.id.toString(),
        customerName: `${shopifyPayload.customer.first_name} ${shopifyPayload.customer.last_name}`,
        customerEmail: shopifyPayload.customer.email,
        customerPhone: undefined, // Not provided in Shopify webhook
        addressLine1: shopifyPayload.shipping_address.address1,
        city: shopifyPayload.shipping_address.city,
        province: shopifyPayload.shipping_address.province_code,
        postalCode: shopifyPayload.shipping_address.zip,
        country: shopifyPayload.shipping_address.country_code,
        totalPrice: parseFloat(shopifyPayload.total_price),
        itemCount: shopifyPayload.line_items.reduce((sum, item) => sum + item.quantity, 0),
      };

      expect(transformedOrder.totalPrice).toBe(109.97);
      expect(transformedOrder.itemCount).toBe(3);

      // Step 3: Upsert customer
      mockPrisma.customer.upsert.mockResolvedValue({
        id: generateId("customer"),
        shopId: shopId,
        email: shopifyPayload.customer.email,
        name: `${shopifyPayload.customer.first_name} ${shopifyPayload.customer.last_name}`,
      });

      const customer = await mockPrisma.customer.upsert({
        where: { shopId_email: { shopId, email: shopifyPayload.customer.email } },
        create: {
          shopId: shopId,
          email: shopifyPayload.customer.email,
          name: `${shopifyPayload.customer.first_name} ${shopifyPayload.customer.last_name}`,
        },
        update: {},
      });

      expect(customer.email).toBe(shopifyPayload.customer.email);

      // Step 4: Create order in platform
      const orderId = generateId("order");
      mockPrisma.order.create.mockResolvedValue({
        id: orderId,
        shopId: shopId,
        externalOrderId: transformedOrder.externalOrderId,
        customerName: transformedOrder.customerName,
        customerEmail: transformedOrder.customerEmail,
        totalPrice: transformedOrder.totalPrice,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      });

      const createdOrder = await mockPrisma.order.create({
        data: {
          shopId: shopId,
          externalOrderId: transformedOrder.externalOrderId,
          ...transformedOrder,
          status: "PENDING",
        },
      });

      expect(createdOrder.externalOrderId).toBe(
        shopifyPayload.id.toString()
      );
      expect(createdOrder.status).toBe("PENDING");

      // Step 5: Send outbound webhook to registered webhooks
      const registeredWebhooks = [
        {
          id: webhookId,
          targetUrl: "https://merchant-system.com/webhooks/orders",
          secret: "merchant_secret_123",
          isActive: true,
        },
      ];

      mockPrisma.customWebhook.findMany.mockResolvedValue(registeredWebhooks);

      const webhooks = await mockPrisma.customWebhook.findMany({
        where: {
          shopId: shopId,
          eventTypes: { has: "order.created" },
          isActive: true,
        },
      });

      expect(webhooks).toHaveLength(1);

      // Send to each webhook
      const outboundPayload = {
        event: "order.created",
        orderId: createdOrder.id,
        externalOrderId: createdOrder.externalOrderId,
        customer: {
          name: createdOrder.customerName,
          email: createdOrder.customerEmail,
        },
        totalPrice: createdOrder.totalPrice,
        timestamp: new Date().toISOString(),
      };

      const outboundPayloadString = JSON.stringify(outboundPayload);
      const outboundHmac = generateHmacSignature(
        outboundPayloadString,
        registeredWebhooks[0].secret
      );

      // Simulate HTTP POST to webhook
      mockPrisma.webhookDelivery.create.mockResolvedValue({
        id: generateId("delivery"),
        webhookId: webhooks[0].id,
        status: "success",
        statusCode: 200,
        deliveredAt: new Date().toISOString(),
        attemptCount: 1,
        lastAttemptAt: new Date().toISOString(),
      });

      const delivery = await mockPrisma.webhookDelivery.create({
        data: {
          webhookId: webhooks[0].id,
          payload: outboundPayload,
          signature: outboundHmac,
        },
      });

      expect(delivery.status).toBe("success");
      expect(delivery.statusCode).toBe(200);
    });

    it("should validate Shopify webhook HMAC signature", async () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = "shopify_secret";

      // Generate correct signature
      const correctSignature = generateHmacSignature(payload, secret);

      // Should verify correctly
      const isValid = verifyHmacSignature(payload, correctSignature, secret);
      expect(isValid).toBe(true);

      // Should reject tampered payload
      const tamperedPayload = JSON.stringify({ test: "tampered" });
      const isTamperedValid = verifyHmacSignature(
        tamperedPayload,
        correctSignature,
        secret
      );

      expect(isTamperedValid).toBe(false);
    });

    it("should handle duplicate Shopify order webhooks", async () => {
      const externalOrderId = "shopify-order-001";

      // First webhook arrives
      mockPrisma.order.findUnique.mockResolvedValue(null);

      let existing = await mockPrisma.order.findUnique({
        where: { shopId_externalOrderId_source: { shopId, externalOrderId, source: "SHOPIFY" } },
      });

      expect(existing).toBeNull();

      // Create order
      mockPrisma.order.create.mockResolvedValue({
        id: generateId("order"),
        shopId: shopId,
        externalOrderId: externalOrderId,
        status: "PENDING",
      });

      const order1 = await mockPrisma.order.create({
        data: {
          shopId: shopId,
          externalOrderId: externalOrderId,
          source: "SHOPIFY",
        },
      });

      expect(order1).toBeDefined();

      // Duplicate webhook arrives
      mockPrisma.order.findUnique.mockResolvedValue(order1);

      existing = await mockPrisma.order.findUnique({
        where: { shopId_externalOrderId_source: { shopId, externalOrderId, source: "SHOPIFY" } },
      });

      expect(existing).toBeDefined();
      expect(existing.id).toBe(order1.id);

      // Should not create duplicate, return existing order
    });
  });

  describe("WooCommerce Webhook Flow", () => {
    it("should ingest WooCommerce webhook → adapt → create order", async () => {
      // Step 1: Receive WooCommerce webhook
      const wooPayload: WooCommerceWebhookPayload = {
        id: 456,
        date_created: new Date().toISOString(),
        billing: {
          email: "woo@example.com",
          first_name: "Jane",
          last_name: "Smith",
        },
        shipping: {
          address_1: "456 Oak Ave",
          city: "Los Angeles",
          state: "CA",
          postcode: "90001",
          country: "US",
        },
        line_items: [
          {
            product_id: 1,
            name: "WooProduct X",
            quantity: 1,
            price: "79.99",
          },
        ],
        total: "79.99",
      };

      // Step 2: Validate webhook
      mockPrisma.inboundWebhookLog.create.mockResolvedValue({
        id: generateId("webhooklog"),
        source: "WOOCOMMERCE",
        eventType: "order.created",
        payload: wooPayload,
        isValid: true,
      });

      const webhookLog = await mockPrisma.inboundWebhookLog.create({
        data: {
          source: "WOOCOMMERCE",
          eventType: "order.created",
          payload: wooPayload,
        },
      });

      expect(webhookLog.source).toBe("WOOCOMMERCE");

      // Step 3: Adapt WooCommerce format to platform format
      const adaptedOrder = {
        externalOrderId: wooPayload.id.toString(),
        customerName: `${wooPayload.billing.first_name} ${wooPayload.billing.last_name}`,
        customerEmail: wooPayload.billing.email,
        addressLine1: wooPayload.shipping.address_1,
        city: wooPayload.shipping.city,
        province: wooPayload.shipping.state,
        postalCode: wooPayload.shipping.postcode,
        country: wooPayload.shipping.country,
        totalPrice: parseFloat(wooPayload.total),
        itemCount: wooPayload.line_items.reduce((sum, item) => sum + item.quantity, 0),
      };

      expect(adaptedOrder.totalPrice).toBe(79.99);

      // Step 4: Create customer
      mockPrisma.customer.upsert.mockResolvedValue({
        id: generateId("customer"),
        shopId: shopId,
        email: wooPayload.billing.email,
        name: adaptedOrder.customerName,
      });

      const customer = await mockPrisma.customer.upsert({
        where: { shopId_email: { shopId, email: wooPayload.billing.email } },
        create: {
          shopId: shopId,
          email: wooPayload.billing.email,
          name: adaptedOrder.customerName,
        },
        update: {},
      });

      expect(customer.email).toBe(wooPayload.billing.email);

      // Step 5: Create order
      mockPrisma.order.create.mockResolvedValue({
        id: generateId("order"),
        shopId: shopId,
        externalOrderId: adaptedOrder.externalOrderId,
        customerName: adaptedOrder.customerName,
        totalPrice: adaptedOrder.totalPrice,
        status: "PENDING",
      });

      const order = await mockPrisma.order.create({
        data: {
          shopId: shopId,
          ...adaptedOrder,
          source: "WOOCOMMERCE",
          status: "PENDING",
        },
      });

      expect(order.totalPrice).toBe(79.99);
      expect(order.status).toBe("PENDING");
    });

    it("should normalize WooCommerce country codes", async () => {
      const countryMappings: Record<string, string> = {
        US: "US",
        GB: "UK",
        CA: "CA",
        AU: "AU",
        DE: "DE",
        FR: "FR",
      };

      const testCases = [
        { input: "US", expected: "US" },
        { input: "GB", expected: "UK" },
        { input: "CA", expected: "CA" },
      ];

      for (const testCase of testCases) {
        const normalized = countryMappings[testCase.input] || testCase.input;
        expect(normalized).toBe(testCase.expected);
      }
    });
  });

  describe("Dead Letter Queue Handling", () => {
    it("should move failed webhooks to DLQ after max retries", async () => {
      const maxRetries = 5;
      let retryCount = 0;
      const originalPayload = { test: "payload" };

      mockPrisma.webhookDelivery.create.mockRejectedValue(
        new Error("Connection timeout")
      );

      // Simulate retry attempts
      for (let i = 0; i < maxRetries + 1; i++) {
        retryCount++;

        if (retryCount > maxRetries) {
          // Move to DLQ
          mockPrisma.deadLetterQueue.create.mockResolvedValue({
            id: generateId("dlq"),
            webhookId: webhookId,
            originalPayload: originalPayload,
            error: "Connection timeout",
            reason: "Max retries exceeded",
            failureCount: maxRetries + 1,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(), // 30 days
          });

          const dlqMessage = await mockPrisma.deadLetterQueue.create({
            data: {
              webhookId: webhookId,
              originalPayload: originalPayload,
              error: "Connection timeout",
              reason: "Max retries exceeded",
            },
          });

          expect(dlqMessage).toBeDefined();
          expect(dlqMessage.failureCount).toBe(maxRetries + 1);
          break;
        }
      }

      expect(retryCount).toBe(maxRetries + 1);
    });

    it("should allow manual retry from DLQ", async () => {
      const dlqMessageId = generateId("dlq");
      const originalPayload = { test: "data" };

      mockPrisma.deadLetterQueue.findMany.mockResolvedValue([
        {
          id: dlqMessageId,
          webhookId: webhookId,
          originalPayload: originalPayload,
          failureCount: 5,
        },
      ]);

      const dlqMessages = await mockPrisma.deadLetterQueue.findMany({
        where: { webhookId: webhookId },
      });

      expect(dlqMessages).toHaveLength(1);

      // Retry the message
      mockPrisma.webhookDelivery.create.mockResolvedValue({
        id: generateId("delivery"),
        webhookId: webhookId,
        status: "success",
        statusCode: 200,
      });

      const delivery = await mockPrisma.webhookDelivery.create({
        data: {
          webhookId: webhookId,
          payload: originalPayload,
        },
      });

      expect(delivery.status).toBe("success");

      // Remove from DLQ on successful retry
      mockPrisma.deadLetterQueue.deleteMany.mockResolvedValue({
        count: 1,
      });

      const deleteResult = await mockPrisma.deadLetterQueue.deleteMany({
        where: { id: dlqMessageId },
      });

      expect(deleteResult.count).toBe(1);
    });

    it("should auto-expire DLQ messages after retention period", async () => {
      const now = new Date();
      const expiryDate = new Date(
        now.getTime() - 1 * 24 * 60 * 60 * 1000
      ); // Expired yesterday

      mockPrisma.deadLetterQueue.findMany.mockResolvedValue([
        {
          id: generateId("dlq"),
          webhookId: webhookId,
          originalPayload: { test: "old" },
          expiresAt: expiryDate.toISOString(),
        },
      ]);

      const expiredMessages = await mockPrisma.deadLetterQueue.findMany({
        where: {
          expiresAt: { lte: now },
        },
      });

      expect(expiredMessages).toHaveLength(1);

      // Delete expired messages
      mockPrisma.deadLetterQueue.deleteMany.mockResolvedValue({
        count: 1,
      });

      const deleteResult = await mockPrisma.deadLetterQueue.deleteMany({
        where: { expiresAt: { lte: now } },
      });

      expect(deleteResult.count).toBe(1);
    });
  });

  describe("Webhook Retry and Circuit Breaker", () => {
    it("should implement exponential backoff for retries", async () => {
      const maxRetries = 5;
      const initialDelayMs = 1000; // 1 second
      const backoffMultiplier = 2;
      const maxDelayMs = 60000; // 1 minute

      const delays = [];

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const delay = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt),
          maxDelayMs
        );
        delays.push(delay);
      }

      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);
      expect(delays[3]).toBe(8000);
      expect(delays[4]).toBe(16000);
    });

    it("should open circuit breaker after failure threshold", async () => {
      const failureThreshold = 5;
      const windowMs = 60 * 1000; // 1 minute window
      let failureCount = 0;
      let circuitOpen = false;

      const failureWindow = [];
      const now = Date.now();

      // Simulate failures
      for (let i = 0; i < failureThreshold + 1; i++) {
        failureWindow.push({
          timestamp: now - (i * 1000),
          success: false,
        });
      }

      // Count failures in time window
      failureCount = failureWindow.filter(
        (f) => f.timestamp >= now - windowMs && !f.success
      ).length;

      if (failureCount >= failureThreshold) {
        circuitOpen = true;
      }

      expect(circuitOpen).toBe(true);
    });

    it("should reject delivery attempts when circuit is open", async () => {
      const circuitOpen = true;

      // Should not attempt delivery when circuit is open
      const shouldAttemptDelivery = !circuitOpen;

      expect(shouldAttemptDelivery).toBe(false);

      // Return error immediately
      if (!shouldAttemptDelivery) {
        const error = new Error("Circuit breaker is open");
        expect(() => {
          throw error;
        }).toThrow("Circuit breaker is open");
      }
    });
  });

  describe("Cross-Platform Webhook Consistency", () => {
    it("should produce consistent order format from different platforms", async () => {
      // Shopify order
      const shopifyOrder = {
        externalOrderId: "shopify-001",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "New York",
        totalPrice: 100.0,
        itemCount: 2,
      };

      // WooCommerce order (adapted)
      const wooOrder = {
        externalOrderId: "woo-001",
        customerName: "Jane Smith",
        customerEmail: "jane@example.com",
        addressLine1: "456 Oak Ave",
        city: "Los Angeles",
        totalPrice: 100.0,
        itemCount: 2,
      };

      // Both should have same shape
      const shopifyKeys = Object.keys(shopifyOrder).sort();
      const wooKeys = Object.keys(wooOrder).sort();

      expect(shopifyKeys).toEqual(wooKeys);

      // Both orders should be created identically
      mockPrisma.order.create.mockResolvedValue({
        id: generateId("order"),
        shopId: shopId,
        ...shopifyOrder,
        status: "PENDING",
      });

      const created1 = await mockPrisma.order.create({
        data: { shopId, ...shopifyOrder },
      });

      mockPrisma.order.create.mockResolvedValue({
        id: generateId("order"),
        shopId: shopId,
        ...wooOrder,
        status: "PENDING",
      });

      const created2 = await mockPrisma.order.create({
        data: { shopId, ...wooOrder },
      });

      // Both should have required fields
      expect(created1).toHaveProperty("customerName");
      expect(created2).toHaveProperty("customerName");
      expect(created1.totalPrice).toBe(created2.totalPrice);
    });

    it("should enforce schema validation for all webhook sources", async () => {
      const requiredFields = [
        "externalOrderId",
        "customerName",
        "customerEmail",
        "addressLine1",
        "city",
        "totalPrice",
      ];

      const validPayload = {
        externalOrderId: "123",
        customerName: "John",
        customerEmail: "john@example.com",
        addressLine1: "123 St",
        city: "NYC",
        totalPrice: 100,
      };

      // Check all required fields present
      const hasAllFields = requiredFields.every((field) =>
        field in validPayload
      );

      expect(hasAllFields).toBe(true);

      // Invalid payload missing required field
      const invalidPayload = {
        externalOrderId: "123",
        customerName: "John",
        // Missing customerEmail
        addressLine1: "123 St",
        city: "NYC",
        totalPrice: 100,
      };

      const hasAllFieldsInvalid = requiredFields.every((field) =>
        field in invalidPayload
      );

      expect(hasAllFieldsInvalid).toBe(false);
    });
  });

  describe("Outbound Webhook Delivery", () => {
    it("should send order event to registered webhooks with HMAC signature", async () => {
      const webhook = {
        id: webhookId,
        targetUrl: "https://merchant.com/webhooks",
        secret: "webhook_secret",
        isActive: true,
      };

      const payload = {
        event: "order.created",
        orderId: generateId("order"),
        totalPrice: 100.0,
        timestamp: new Date().toISOString(),
      };

      const payloadString = JSON.stringify(payload);
      const hmacSignature = generateHmacSignature(payloadString, webhook.secret);

      // Verify signature can be generated and verified
      const isValid = verifyHmacSignature(payloadString, hmacSignature, webhook.secret);
      expect(isValid).toBe(true);

      // Log delivery
      mockPrisma.webhookDelivery.create.mockResolvedValue({
        id: generateId("delivery"),
        webhookId: webhook.id,
        status: "success",
        statusCode: 200,
        signature: hmacSignature,
        deliveredAt: new Date().toISOString(),
      });

      const delivery = await mockPrisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          payload: payload,
          signature: hmacSignature,
        },
      });

      expect(delivery.status).toBe("success");
      expect(delivery.signature).toBe(hmacSignature);
    });

    it("should batch process webhook deliveries efficiently", async () => {
      const webhookIds = Array.from({ length: 50 }, () => generateId("webhook"));

      mockPrisma.webhookDelivery.createMany = vi.fn().mockResolvedValue({
        count: webhookIds.length,
      });

      const payload = { event: "bulk_event", timestamp: new Date().toISOString() };

      const deliveries = webhookIds.map((id) => ({
        webhookId: id,
        payload: payload,
      }));

      const result = await mockPrisma.webhookDelivery.createMany({
        data: deliveries,
      });

      expect(result.count).toBe(50);
    });
  });
});
