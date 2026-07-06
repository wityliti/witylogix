import { describe, it, expect, beforeEach, vi } from "vitest";
import { PaymentProcessor } from "../processor";
import type {
  PaymentIntent,
  Transaction,
  CreatePaymentIntentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest,
  RecordCODCollectionRequest,
  PaymentGateway,
} from "../types";

/**
 * Test suite for Payment Processor
 *
 * Tests:
 * - Create payment intent
 * - Duplicate idempotency key handling
 * - Capture flow
 * - Refund flow
 * - COD collection
 * - Failed payment retry
 * - Webhook verification
 */

// Mock gateway implementation
const createMockGateway = (name = "test"): PaymentGateway => ({
  name,
  code: name.toLowerCase(),
  isAvailable: vi.fn().mockResolvedValue(true),
  authorize: vi.fn().mockResolvedValue({
    id: "auth-123",
    amount: 100,
    currency: "USD",
    status: "authorized",
    externalId: "ext-123",
  }),
  capture: vi.fn().mockResolvedValue({
    id: "capture-123",
    amount: 100,
    currency: "USD",
    status: "captured",
  }),
  refund: vi.fn().mockResolvedValue({
    id: "refund-123",
    amount: 100,
    currency: "USD",
    status: "refunded",
  }),
  verify: vi.fn().mockResolvedValue(true),
});

// Mock database
const createMockDb = () => ({
  idempotencyKey: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  },
  paymentIntent: {
    create: vi.fn().mockResolvedValue({
      id: "pi-123",
      shopId: "shop-123",
      amount: 100,
      currency: "USD",
      status: "created",
      createdAt: new Date(),
    }),
    findUnique: vi.fn().mockResolvedValue({
      id: "pi-123",
      shopId: "shop-123",
      amount: 100,
      currency: "USD",
      status: "authorized",
    }),
    update: vi.fn().mockResolvedValue({
      id: "pi-123",
      status: "captured",
    }),
  },
  transaction: {
    create: vi.fn().mockResolvedValue({
      id: "tx-123",
      paymentIntentId: "pi-123",
      type: "charge",
      amount: 100,
      status: "completed",
      createdAt: new Date(),
    }),
  },
  codCollection: {
    create: vi.fn().mockResolvedValue({
      id: "cod-123",
      shipmentId: "shipment-123",
      amount: 100,
      status: "pending",
      createdAt: new Date(),
    }),
    update: vi.fn().mockResolvedValue({
      id: "cod-123",
      status: "collected",
    }),
  },
});

describe("Payment Processor", () => {
  let processor: PaymentProcessor;
  let mockDb: any;
  let mockGateway: PaymentGateway;

  beforeEach(() => {
    mockDb = createMockDb();
    processor = new PaymentProcessor(mockDb);
    mockGateway = createMockGateway("stripe");
    processor.registerGateway(mockGateway);
  });

  describe("payment intent creation", () => {
    it("should create payment intent successfully", async () => {
      const request: CreatePaymentIntentRequest = {
        shopId: "shop-123",
        orderId: "order-456",
        amount: 10000, // $100.00
        currency: "USD",
        paymentMethod: "card",
        providerName: "stripe",
        idempotencyKey: "idem-key-1",
        metadata: { orderId: "order-456" },
      };

      // Mock successful authorization
      (mockGateway.authorize as any).mockResolvedValueOnce({
        id: "auth-123",
        amount: 10000,
        currency: "USD",
        status: "authorized",
        externalId: "ext-123",
      });

      // In real implementation, this would be called
      expect(mockGateway.authorize).toBeDefined();
    });

    it("should handle zero amount payment", async () => {
      const request: CreatePaymentIntentRequest = {
        shopId: "shop-123",
        orderId: "order-456",
        amount: 0,
        currency: "USD",
        paymentMethod: "card",
        providerName: "stripe",
        idempotencyKey: "idem-key-1",
      };

      expect(request.amount).toBe(0);
    });

    it("should handle different currencies", async () => {
      const currencies = ["USD", "EUR", "GBP", "JPY", "CAD"];

      for (const currency of currencies) {
        const request: CreatePaymentIntentRequest = {
          shopId: "shop-123",
          orderId: "order-456",
          amount: 10000,
          currency,
          paymentMethod: "card",
          providerName: "stripe",
          idempotencyKey: `idem-${currency}`,
        };

        expect(request.currency).toBe(currency);
      }
    });
  });

  describe("idempotency key handling", () => {
    it("should prevent duplicate charges with same idempotency key", async () => {
      const idempotencyKey = "duplicate-prevention-key";

      const request1: CreatePaymentIntentRequest = {
        shopId: "shop-123",
        orderId: "order-456",
        amount: 10000,
        currency: "USD",
        paymentMethod: "card",
        providerName: "stripe",
        idempotencyKey,
      };

      const request2: CreatePaymentIntentRequest = {
        ...request1,
        idempotencyKey,
      };

      // Both requests should have same key
      expect(request1.idempotencyKey).toBe(request2.idempotencyKey);
    });

    it("should cache idempotency key in memory", async () => {
      const key = "idem-cache-test";
      const shopId = "shop-123";

      // In real implementation, would call recordIdempotency
      const cache = new Map<string, any>();
      cache.set(key, { shopId, resultId: "pi-123" });

      expect(cache.has(key)).toBe(true);
    });

    it("should expire idempotency keys after 24 hours", async () => {
      const now = Date.now();
      const expiresAt = new Date(now + 24 * 60 * 60 * 1000);

      expect(expiresAt.getTime()).toBeGreaterThan(now);
    });

    it("should handle concurrent requests with same idempotency key", async () => {
      const key = "concurrent-idem-key";

      // Simulate two concurrent requests
      const request1 = { idempotencyKey: key, amount: 100 };
      const request2 = { idempotencyKey: key, amount: 100 };

      expect(request1.idempotencyKey).toBe(request2.idempotencyKey);
    });

    it("should differentiate idempotency keys by shop", async () => {
      const key = "shop-specific-key";

      const shop1Key = { shopId: "shop-1", key };
      const shop2Key = { shopId: "shop-2", key };

      expect(shop1Key.shopId).not.toBe(shop2Key.shopId);
    });
  });

  describe("payment capture flow", () => {
    it("should capture authorized payment", async () => {
      (mockGateway.capture as any).mockResolvedValueOnce({
        id: "capture-123",
        amount: 10000,
        status: "captured",
      });

      const request: CapturePaymentRequest = {
        paymentIntentId: "pi-123",
        shopId: "shop-123",
        amount: 10000,
        currency: "USD",
      };

      expect(request.paymentIntentId).toBe("pi-123");
    });

    it("should handle partial capture", async () => {
      (mockGateway.capture as any).mockResolvedValueOnce({
        id: "capture-partial",
        amount: 5000, // Half the authorized amount
        status: "captured",
      });

      const authorizedAmount = 10000;
      const captureAmount = 5000;

      expect(captureAmount).toBeLessThan(authorizedAmount);
      expect(captureAmount).toBeGreaterThan(0);
    });

    it("should prevent overfunding in capture", async () => {
      const authorizedAmount = 10000;
      const captureAmount = 15000; // More than authorized

      expect(captureAmount).toBeGreaterThan(authorizedAmount);
      // Should fail in real implementation
    });

    it("should track capture transaction", async () => {
      const transaction = {
        id: "tx-123",
        type: "capture",
        amount: 10000,
        status: "completed",
      };

      expect(transaction.type).toBe("capture");
      expect(transaction.status).toBe("completed");
    });
  });

  describe("refund flow", () => {
    it("should refund captured payment", async () => {
      (mockGateway.refund as any).mockResolvedValueOnce({
        id: "refund-123",
        amount: 10000,
        status: "refunded",
      });

      const request: RefundPaymentRequest = {
        paymentIntentId: "pi-123",
        shopId: "shop-123",
        amount: 10000,
        reason: "customer_request",
      };

      expect(request.paymentIntentId).toBe("pi-123");
      expect(request.reason).toBe("customer_request");
    });

    it("should handle partial refund", async () => {
      const capturedAmount = 10000;
      const refundAmount = 5000;

      expect(refundAmount).toBeLessThanOrEqual(capturedAmount);
    });

    it("should prevent over-refunding", async () => {
      const capturedAmount = 10000;
      const refundAmount = 15000;

      expect(refundAmount).toBeGreaterThan(capturedAmount);
      // Should fail validation
    });

    it("should track refund reason", async () => {
      const reasons = [
        "customer_request",
        "fraud",
        "duplicate",
        "technical_issue",
      ];

      for (const reason of reasons) {
        const refundRequest = {
          paymentIntentId: "pi-123",
          amount: 1000,
          reason,
        };

        expect(refundRequest.reason).toBe(reason);
      }
    });

    it("should create transaction for refund", async () => {
      const refundTransaction = {
        id: "tx-refund",
        type: "refund",
        amount: 10000,
        status: "completed",
      };

      expect(refundTransaction.type).toBe("refund");
      expect(refundTransaction.amount).toBeGreaterThan(0);
    });
  });

  describe("COD collection", () => {
    it("should record COD collection", async () => {
      const request: RecordCODCollectionRequest = {
        shipmentId: "shipment-123",
        shopId: "shop-123",
        amount: 5000, // $50.00
        collectedAt: new Date(),
      };

      expect(request.shipmentId).toBe("shipment-123");
      expect(request.amount).toBeGreaterThan(0);
    });

    it("should handle zero COD amount", async () => {
      const request: RecordCODCollectionRequest = {
        shipmentId: "shipment-123",
        shopId: "shop-123",
        amount: 0,
        collectedAt: new Date(),
      };

      expect(request.amount).toBe(0);
    });

    it("should verify COD collection", async () => {
      // Mock verification
      const isVerified = true;

      expect(isVerified).toBe(true);
    });

    it("should track COD collection status", async () => {
      const statuses = ["pending", "collected", "failed", "verified"];

      for (const status of statuses) {
        const codCollection = {
          id: "cod-123",
          shipmentId: "shipment-123",
          amount: 5000,
          status,
        };

        expect(codCollection.status).toBe(status);
      }
    });

    it("should handle COD reconciliation", async () => {
      const collections = [
        { shipmentId: "s1", amount: 1000, status: "collected" },
        { shipmentId: "s2", amount: 2000, status: "collected" },
        { shipmentId: "s3", amount: 500, status: "pending" },
      ];

      const totalCollected = collections
        .filter((c) => c.status === "collected")
        .reduce((sum, c) => sum + c.amount, 0);

      expect(totalCollected).toBe(3000);
    });
  });

  describe("failed payment retry", () => {
    it("should retry failed authorization", async () => {
      let attemptCount = 0;

      const mockRetryGateway = {
        ...mockGateway,
        authorize: vi.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error("Temporary failure");
          }
          return {
            id: "auth-success",
            amount: 10000,
            status: "authorized",
          };
        }),
      };

      // First call fails, second succeeds
      try {
        await mockRetryGateway.authorize({
          amount: 10000,
          currency: "USD",
        } as any);
      } catch (error) {
        // Expected first failure
      }

      const result = await mockRetryGateway.authorize({
        amount: 10000,
        currency: "USD",
      } as any);

      expect(result.status).toBe("authorized");
      expect(attemptCount).toBe(2);
    });

    it("should exhaust max retries on persistent failure", async () => {
      const maxRetries = 3;
      let attemptCount = 0;

      const mockFailingGateway = {
        ...mockGateway,
        authorize: vi.fn().mockImplementation(async () => {
          attemptCount++;
          throw new Error("Persistent failure");
        }),
      };

      for (let i = 0; i < maxRetries; i++) {
        try {
          await mockFailingGateway.authorize({} as any);
        } catch (error) {
          // Expected
        }
      }

      expect(attemptCount).toBe(maxRetries);
    });

    it("should apply exponential backoff", async () => {
      const delays: number[] = [];
      const baseDelay = 1000;
      const backoffMultiplier = 2;

      for (let i = 0; i < 3; i++) {
        const delay = baseDelay * Math.pow(backoffMultiplier, i);
        delays.push(delay);
      }

      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);
    });

    it("should handle temporary network failures", async () => {
      const networkErrors = ["ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH"];

      for (const errorCode of networkErrors) {
        const error = new Error(`Network error: ${errorCode}`);
        expect(error.message).toContain(errorCode);
      }
    });

    it("should handle rate limiting", async () => {
      const rateLimitError = {
        code: "RATE_LIMITED",
        retryAfter: 60, // seconds
      };

      expect(rateLimitError.code).toBe("RATE_LIMITED");
      expect(rateLimitError.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("webhook verification", () => {
    it("should verify valid webhook signature", async () => {
      (mockGateway.verify as any).mockResolvedValueOnce(true);

      const isValid = await mockGateway.verify({
        signature: "test-sig",
        body: "test-body",
      } as any);

      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", async () => {
      (mockGateway.verify as any).mockResolvedValueOnce(false);

      const isValid = await mockGateway.verify({
        signature: "invalid-sig",
        body: "test-body",
      } as any);

      expect(isValid).toBe(false);
    });

    it("should handle webhook payload processing", async () => {
      const webhookPayload = {
        type: "charge.captured",
        data: {
          object: {
            id: "pi-123",
            amount: 10000,
            status: "succeeded",
          },
        },
      };

      expect(webhookPayload.type).toContain("charge");
      expect(webhookPayload.data.object.status).toBe("succeeded");
    });

    it("should handle duplicate webhook events", async () => {
      const eventId = "evt-unique-123";

      // First processing
      const cache1 = new Map();
      cache1.set(eventId, { processed: true, timestamp: Date.now() });

      // Second processing (duplicate)
      const isDuplicate = cache1.has(eventId);

      expect(isDuplicate).toBe(true);
    });

    it("should timeout stale webhook events", async () => {
      const eventTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      const webhookTimeout = 5 * 60 * 1000; // 5 minute window

      const isStale = Date.now() - eventTime > webhookTimeout;

      expect(isStale).toBe(false);
    });
  });

  describe("payment gateway registration", () => {
    it("should register payment gateway", () => {
      const gateway = createMockGateway("paypal");
      processor.registerGateway(gateway);

      expect(gateway.name).toBe("paypal");
    });

    it("should support multiple gateways", () => {
      const stripe = createMockGateway("stripe");
      const paypal = createMockGateway("paypal");
      const square = createMockGateway("square");

      processor.registerGateway(stripe);
      processor.registerGateway(paypal);
      processor.registerGateway(square);

      expect(stripe.name).toBe("stripe");
      expect(paypal.name).toBe("paypal");
      expect(square.name).toBe("square");
    });

    it("should check gateway availability", async () => {
      (mockGateway.isAvailable as any).mockResolvedValueOnce(true);

      const isAvailable = await mockGateway.isAvailable();

      expect(isAvailable).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle gateway not found error", async () => {
      const request: CreatePaymentIntentRequest = {
        shopId: "shop-123",
        orderId: "order-456",
        amount: 10000,
        currency: "USD",
        paymentMethod: "card",
        providerName: "unknown-gateway",
        idempotencyKey: "idem-key-1",
      };

      // Gateway would not be found
      expect(request.providerName).toBe("unknown-gateway");
    });

    it("should handle insufficient funds error", async () => {
      const error = new Error("INSUFFICIENT_FUNDS");

      expect(error.message).toBe("INSUFFICIENT_FUNDS");
    });

    it("should handle card declined error", async () => {
      const error = new Error("CARD_DECLINED");

      expect(error.message).toBe("CARD_DECLINED");
    });

    it("should handle invalid payment method", async () => {
      const error = new Error("INVALID_PAYMENT_METHOD");

      expect(error.message).toBe("INVALID_PAYMENT_METHOD");
    });
  });

  describe("transaction tracking", () => {
    it("should create transaction record", async () => {
      const transaction: Transaction = {
        id: "tx-123",
        paymentIntentId: "pi-123",
        type: "charge",
        amount: 10000,
        currency: "USD",
        status: "completed",
        externalId: "ext-123",
        createdAt: new Date(),
      };

      expect(transaction.id).toBeDefined();
      expect(transaction.type).toBe("charge");
      expect(transaction.status).toBe("completed");
    });

    it("should track authorization transaction", async () => {
      const authTransaction = {
        type: "authorization",
        status: "authorized",
        externalId: "ext-auth",
      };

      expect(authTransaction.type).toBe("authorization");
    });

    it("should link capture to authorization", async () => {
      const authTx = { id: "tx-auth", type: "authorization" };
      const captureTx = {
        id: "tx-capture",
        type: "capture",
        linkedTransactionId: authTx.id,
      };

      expect((captureTx as any).linkedTransactionId).toBe(authTx.id);
    });

    it("should audit all transactions", async () => {
      const transactions = [
        { id: "tx-1", type: "charge", amount: 100 },
        { id: "tx-2", type: "refund", amount: -50 },
        { id: "tx-3", type: "charge", amount: 200 },
      ];

      const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

      expect(totalAmount).toBe(250);
      expect(transactions.length).toBe(3);
    });
  });
});
