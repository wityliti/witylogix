/**
 * ShipStation SDK Client Tests
 *
 * Test suite for ShipStation API v2 SDK:
 * - Order CRUD operations
 * - Rate fetching + label creation
 * - Rate limit header tracking
 * - Webhook payload handling
 * - Batch label operations
 * - Authentication (API key + OAuth)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ShipStationSDKClient } from "../shipstation-sdk-client.js";
import type {
  SSOrder,
  SSCreateOrderRequest,
  SSAddress,
  SSLabel,
  SSRate,
  SSCarrier,
  SSRateLimitInfo,
} from "../shipstation-sdk-types.js";

// ─── Mock Data ──────────────────────────────────────────────────

const mockAddress: SSAddress = {
  name: "John Doe",
  company: "Acme Corp",
  street1: "123 Main St",
  street2: "Apt 4",
  city: "San Francisco",
  state: "CA",
  postalCode: "94103",
  country: "US",
  phone: "+1-415-555-0100",
  residential: false,
};

const mockOrder: SSOrder = {
  orderId: "order_123",
  orderNumber: "ORD-001",
  externalOrderId: "ext_123",
  customerId: "cust_456",
  customerUsername: "johndoe",
  orderDate: "2026-03-16T10:00:00Z",
  shipDate: "2026-03-17T10:00:00Z",
  status: "awaiting_shipment",
  shippingStatus: "pending",
  source: {
    sourceId: "src_789",
    sourceName: "Amazon",
  },
  shipTo: mockAddress,
  billTo: mockAddress,
  items: [
    {
      lineItemId: "item_1",
      productId: "prod_123",
      title: "Widget",
      quantity: 2,
      quantityShipped: 0,
      sku: "WIDGET-001",
      unitPrice: 2999,
    },
  ],
  weights: {
    weightUnits: "pounds",
    weight: 2.5,
  },
  customerEmail: "john@example.com",
  customerNotes: "Please handle with care",
  tags: ["urgent"],
};

const mockLabel: SSLabel = {
  labelId: "label_123",
  shipmentId: "ship_123",
  orderId: "order_123",
  shipDate: "2026-03-17T10:00:00Z",
  trackingNumber: "1Z999AA10123456784",
  status: "purchased",
  carrier: {
    code: "fedex",
    name: "FedEx",
  },
  service: {
    code: "fedex_ground",
    name: "FedEx Ground",
  },
  package: {
    code: "package",
    name: "Package",
  },
  labelFormat: "pdf",
  labelLayout: "4x6",
  labelDownload: {
    pdf: "https://example.com/label.pdf",
    png: "https://example.com/label.png",
    href: "https://example.com/label",
  },
  voided: false,
  purchasedDate: "2026-03-17T10:00:00Z",
};

const mockRate: SSRate = {
  rateId: "rate_123",
  shipmentId: "ship_123",
  carrierId: "carrier_fedex",
  carrierCode: "fedex",
  serviceCode: "fedex_ground",
  serviceName: "FedEx Ground",
  shipDate: "2026-03-17T10:00:00Z",
  negotiatedRate: 1299,
  baseRate: 1599,
  otherCost: 0,
  insurance: 0,
  confirmationAmount: 1299,
  zone: 8,
  deliveryDays: 5,
  guaranteedService: false,
  estimatedDeliveryDate: "2026-03-22T23:59:59Z",
  currency: "USD",
};

const mockCarrier: SSCarrier = {
  carrierId: "carrier_fedex",
  name: "FedEx",
  code: "fedex",
  accountNumber: "123456789",
  requiresFundingAccount: true,
  balance: 50000,
  isAccount: true,
};

// ─── Test Suite ─────────────────────────────────────────────────

describe("ShipStationSDKClient", () => {
  let client: ShipStationSDKClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create client with fake API key/secret
    const apiKey = "ss_api_" + "FAKEKEY0123";
    const apiSecret = "ss_secret_" + "FAKESECRET456";

    client = new ShipStationSDKClient({
      apiKey,
      apiSecret,
      baseUrl: "https://ssapi.shipstation.com",
    });

    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── Authentication Tests ───────────────────────────────────

  describe("Authentication", () => {
    it("should throw error when no credentials provided", () => {
      expect(() => new ShipStationSDKClient({})).toThrow(
        "requires either (apiKey + apiSecret) or oauthToken",
      );
    });

    it("should accept API key + secret", () => {
      const c = new ShipStationSDKClient({
        apiKey: "test_key",
        apiSecret: "test_secret",
      });
      expect(c).toBeDefined();
    });

    it("should accept OAuth token", () => {
      const c = new ShipStationSDKClient({
        oauthToken: "test_oauth_token",
      });
      expect(c).toBeDefined();
    });
  });

  // ─── Order Operations Tests ──────────────────────────────────

  describe("Order Operations", () => {
    it("should list orders with pagination", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "39"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          data: [mockOrder],
          pageNumber: 1,
          pageSize: 100,
          totalRecords: 1,
          pages: 1,
        }),
      });

      const result = await client.listOrders({ pageSize: 100 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].orderId).toBe("order_123");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/orders?pageSize=100"),
        expect.any(Object),
      );
    });

    it("should get a single order by ID", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "39"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => mockOrder,
      });

      const result = await client.getOrder("order_123");

      expect(result.orderId).toBe("order_123");
      expect(result.status).toBe("awaiting_shipment");
    });

    it("should create a new order", async () => {
      const createRequest: SSCreateOrderRequest = {
        orderNumber: "ORD-002",
        orderDate: "2026-03-16T10:00:00Z",
        shipTo: mockAddress,
        items: [
          {
            lineItemId: "item_1",
            productId: "prod_123",
            title: "Widget",
            quantity: 1,
            sku: "WIDGET-001",
            unitPrice: 2999,
          },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "38"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({ ...mockOrder, ...createRequest }),
      });

      const result = await client.createOrder(createRequest);

      expect(result.orderNumber).toBe("ORD-002");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/orders"),
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should update an order", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "37"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          ...mockOrder,
          customerNotes: "Updated notes",
        }),
      });

      const result = await client.updateOrder("order_123", {
        customerNotes: "Updated notes",
      });

      expect(result.customerNotes).toBe("Updated notes");
    });

    it("should delete an order", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "36"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({}),
      });

      await expect(client.deleteOrder("order_123")).resolves.not.toThrow();
    });

    it("should assign a tag to an order", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "35"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({}),
      });

      await expect(
        client.assignOrderTag("order_123", "priority"),
      ).resolves.not.toThrow();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/orders/order_123/tags"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ tagName: "priority" }),
        }),
      );
    });

    it("should add a note to an order", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "34"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({}),
      });

      await expect(
        client.addOrderNote("order_123", "Customer requested express shipping"),
      ).resolves.not.toThrow();
    });

    it("should mark an order as shipped", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "33"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({}),
      });

      await expect(client.markOrderShipped("order_123")).resolves.not.toThrow();
    });
  });

  // ─── Shipment & Label Tests ─────────────────────────────────

  describe("Shipment & Label Operations", () => {
    it("should get rates for a shipment", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "32"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          rates: [mockRate],
        }),
      });

      const result = await client.getRates("ship_123");

      expect(result).toHaveLength(1);
      expect(result[0].rateId).toBe("rate_123");
      expect(result[0].negotiatedRate).toBe(1299);
    });

    it("should create a shipping label", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "31"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => mockLabel,
      });

      const result = await client.createLabel({
        shipmentId: "ship_123",
        rateId: "rate_123",
        labelFormat: "pdf",
        labelLayout: "4x6",
      });

      expect(result.labelId).toBe("label_123");
      expect(result.trackingNumber).toBe("1Z999AA10123456784");
      expect(result.status).toBe("purchased");
    });

    it("should void a label", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "30"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({}),
      });

      await expect(client.voidLabel("label_123")).resolves.not.toThrow();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/labels/label_123"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should get label details", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "29"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => mockLabel,
      });

      const result = await client.getLabel("label_123");

      expect(result.labelId).toBe("label_123");
      expect(result.voided).toBe(false);
    });
  });

  // ─── Carrier Operations Tests ────────────────────────────────

  describe("Carrier Operations", () => {
    it("should list all carriers", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "28"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          carriers: [mockCarrier],
        }),
      });

      const result = await client.listCarriers();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("fedex");
      expect(result[0].name).toBe("FedEx");
    });

    it("should list services for a carrier", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "27"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          services: [
            {
              carrierId: "carrier_fedex",
              carrierCode: "fedex",
              code: "fedex_ground",
              name: "FedEx Ground",
              domestic: true,
              international: false,
            },
          ],
        }),
      });

      const result = await client.listServices("carrier_fedex");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("FedEx Ground");
    });

    it("should list packages for a carrier", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "26"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          packages: [
            {
              carrierId: "carrier_fedex",
              carrierCode: "fedex",
              code: "package",
              name: "Package",
            },
          ],
        }),
      });

      const result = await client.listPackages("carrier_fedex");

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("package");
    });
  });

  // ─── Rate Limit Tracking Tests ──────────────────────────────

  describe("Rate Limit Tracking", () => {
    it("should track rate limit headers from responses", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "25"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({ carriers: [mockCarrier] }),
      });

      await client.listCarriers();

      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo.limit).toBe(40);
      expect(rateLimitInfo.remaining).toBe(25);
    });

    it("should detect rate limit status", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "0"],
          ["x-rate-limit-reset", Math.floor(Date.now() / 1000) + 60],
        ]),
        json: async () => ({ carriers: [] }),
      });

      await client.listCarriers();

      expect(client.isRateLimited()).toBe(true);
      expect(client.getRetryAfterMs()).toBeGreaterThan(0);
    });

    it("should provide rate limit info", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "20"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({ carriers: [mockCarrier] }),
      });

      await client.listCarriers();

      const info: SSRateLimitInfo = client.getRateLimitInfo();
      expect(info).toHaveProperty("limit");
      expect(info).toHaveProperty("remaining");
      expect(info).toHaveProperty("reset");
    });
  });

  // ─── Webhook Tests ──────────────────────────────────────────

  describe("Webhook Operations", () => {
    it("should subscribe to webhook", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "24"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          webhookId: "webhook_123",
          url: "https://example.com/webhook",
          eventType: "ORDER_NOTIFY",
          active: true,
          createDate: "2026-03-16T10:00:00Z",
        }),
      });

      const result = await client.subscribeWebhook({
        url: "https://example.com/webhook",
        eventType: "ORDER_NOTIFY",
      });

      expect(result.webhookId).toBe("webhook_123");
      expect(result.active).toBe(true);
    });

    it("should unsubscribe from webhook", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "23"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({}),
      });

      await expect(
        client.unsubscribeWebhook("webhook_123"),
      ).resolves.not.toThrow();
    });

    it("should list webhooks", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "22"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          webhooks: [
            {
              webhookId: "webhook_123",
              url: "https://example.com/webhook",
              eventType: "ORDER_NOTIFY",
              active: true,
              createDate: "2026-03-16T10:00:00Z",
            },
          ],
        }),
      });

      const result = await client.listWebhooks();

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe("ORDER_NOTIFY");
    });
  });

  // ─── Batch Operations Tests ──────────────────────────────────

  describe("Batch Operations", () => {
    it("should create a batch of labels", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "21"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          batchId: "batch_123",
          status: "processing",
          createdDate: "2026-03-16T10:00:00Z",
        }),
      });

      const result = await client.createBatch({
        labelFormat: "pdf",
        labelLayout: "4x6",
        shipmentIds: ["ship_1", "ship_2"],
      });

      expect(result.batchId).toBe("batch_123");
      expect(result.status).toBe("processing");
    });

    it("should get batch status", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "20"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({
          batchId: "batch_123",
          status: "completed",
          createdDate: "2026-03-16T10:00:00Z",
          processedDate: "2026-03-16T10:05:00Z",
          labelLinks: [
            {
              shipmentId: "ship_1",
              labelId: "label_1",
              label: "https://example.com/label1.pdf",
            },
          ],
        }),
      });

      const result = await client.getBatchStatus("batch_123");

      expect(result.status).toBe("completed");
      expect(result.labelLinks).toBeDefined();
    });
  });

  // ─── Error Handling Tests ────────────────────────────────────

  describe("Error Handling", () => {
    it("should handle 401 authentication error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            message: "Invalid API credentials",
          }),
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "19"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
      });

      await expect(client.listCarriers()).rejects.toThrow(
        /Authentication failed/,
      );
    });

    it("should handle 429 rate limit error with retry", async () => {
      // First call: 429 rate limit
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "0"],
          ["x-rate-limit-reset", Math.floor(Date.now() / 1000) + 1],
        ]),
      });

      // Second call: success
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "39"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({ carriers: [mockCarrier] }),
      });

      const result = await client.listCarriers();

      expect(result).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should handle 500 server error with retry", async () => {
      // First call: 500 error
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal server error",
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "38"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
      });

      // Second call: success
      fetchMock.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-rate-limit-limit", "40"],
          ["x-rate-limit-remaining", "37"],
          ["x-rate-limit-reset", "1679001600"],
        ]),
        json: async () => ({ carriers: [mockCarrier] }),
      });

      const result = await client.listCarriers();

      expect(result).toHaveLength(1);
    });
  });
});
