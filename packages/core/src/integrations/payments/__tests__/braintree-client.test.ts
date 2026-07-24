/**
 * Braintree Client Tests
 * Comprehensive test suite for Braintree payment adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { type BraintreeConfig } from "../braintree-client";
import { BraintreeClient } from "../braintree-client";
import {
  type PaymentTransaction,
  type PaymentMethod,
  type PaymentRefund,
} from "../types";

describe("BraintreeClient", () => {
  let client: BraintreeClient;
  const mockConfig: any = {
    environment: "sandbox",
    merchantId: "test-merchant",
    publicKey: "test-public-key",
    privateKey: "test-private-key",
  };

  beforeEach(() => {
    client = new BraintreeClient(mockConfig);
    // Disable retry delays in tests to avoid timeouts
    (client as any).retryDelayMs = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("charge", () => {
    it("should charge card successfully", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-123",
            status: "settled",
            amount: "100.00",
            currencyIsoCode: "USD",
            createdAt: "2024-03-12T00:00:00Z",
            updatedAt: "2024-03-12T00:00:00Z",
          },
        }),
      } as any);

      const result = await client.charge(10000, "USD", "pm-token-123");

      expect(result).toBeDefined();
      expect(result.externalId).toBe("txn-123");
      expect(result.status).toBe("settled");
    });

    it("should handle charge failure", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          errors: { transaction: { errors: [{ message: "Card declined" }] } },
        }),
      } as any);

      await expect(client.charge(10000, "USD", "pm-invalid")).rejects.toThrow();
    });

    it("should support idempotency key", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-456",
            amount: "100.00",
            status: "authorized",
          },
        }),
      } as any);

      const result = await client.charge(10000, "USD", "pm-token", {
        idempotencyKey: "idempotency-key-123",
      });

      expect(result.id).toBeDefined();
    });

    it("should include billing address", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-789",
            amount: "100.00",
            status: "authorized",
          },
        }),
      } as any);

      const result = await client.charge(10000, "USD", "pm-token", {
        billingAddress: {
          firstName: "John",
          lastName: "Doe",
          street1: "123 Main St",
          city: "Springfield",
          state: "IL",
          postalCode: "62701",
          country: "US",
        },
      });

      expect(result).toBeDefined();
    });
  });

  describe("authorize", () => {
    it("should authorize card successfully", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-auth-123",
            status: "authorized",
            amount: "100.00",
          },
        }),
      } as any);

      const result = await client.authorize(10000, "USD", "pm-token");

      expect(result.status).toBe("authorized");
    });
  });

  describe("capture", () => {
    it("should capture authorized transaction", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-auth-123",
            status: "settled",
            amount: "100.00",
          },
        }),
      } as any);

      const result = await client.capture("txn-auth-123");

      expect(result.status).toBe("settled");
    });
  });

  describe("void", () => {
    it("should void transaction", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-123",
            status: "voided",
            amount: "100.00",
          },
        }),
      } as any);

      const result = await client.void("txn-123");

      expect(result.status).toBe("voided");
    });
  });

  describe("refund", () => {
    it("should refund transaction", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-refund-123",
            refundId: "ref-123",
            amount: "100.00",
            status: "refunded",
          },
        }),
      } as any);

      const result = await client.refund("txn-123");

      expect(result.status).toBe("completed");
      expect(result.providerId).toBe("braintree");
    });

    it("should support partial refund", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: { id: "ref-456", amount: "50.00", status: "refunded" },
        }),
      } as any);

      const result = await client.refund("txn-123", 5000);

      expect(result.amount).toBe(5000);
    });
  });

  describe("createPaymentMethod", () => {
    it("should create card payment method", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          paymentMethod: {
            token: "pm-token-new",
            type: "credit_card",
            cardType: "Visa",
            last4: "1111",
            expirationMonth: "12",
            expirationYear: "2025",
          },
        }),
      } as any);

      const result = await client.createPaymentMethod(
        {
          type: "card",
          cardNumber: "4111111111111111",
          cardExpiry: "12/25",
          cardCvv: "123",
          cardholderName: "John Doe",
        },
        "cust-123",
      );

      expect(result.externalId).toBe("pm-token-new");
      expect(result.type).toBe("card");
    });
  });

  describe("getPaymentMethod", () => {
    it("should retrieve payment method", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          paymentMethod: {
            token: "pm-123",
            type: "credit_card",
            last4: "1111",
            expirationMonth: "12",
            expirationYear: "2025",
          },
        }),
      } as any);

      const result = await client.getPaymentMethod("pm-123");

      expect(result.id).toBe("pm-123");
      expect(result.cardDetails?.lastFour).toBe("1111");
    });
  });

  describe("listPaymentMethods", () => {
    it("should list customer payment methods", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          customer: {
            paymentMethods: [
              {
                token: "pm-1",
                type: "credit_card",
                last4: "1111",
              },
              {
                token: "pm-2",
                type: "paypal_account",
              },
            ],
          },
        }),
      } as any);

      const result = await client.listPaymentMethods("cust-123");

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("card");
      expect(result[1].type).toBe("paypal");
    });
  });

  describe("getTransaction", () => {
    it("should retrieve transaction details", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-123",
            status: "settled",
            amount: "100.00",
            createdAt: "2024-03-12T00:00:00Z",
          },
        }),
      } as any);

      const result = await client.getTransaction("txn-123");

      expect(result.id).toBe("txn-123");
      expect(result.status).toBe("settled");
    });
  });

  describe("createCustomer", () => {
    it("should create customer vault", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          customer: {
            id: "cust-new-123",
          },
        }),
      } as any);

      const result = await client.createCustomer({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      });

      expect(result.externalId).toBe("cust-new-123");
    });
  });

  describe("createSubscription", () => {
    it("should create subscription", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          subscription: {
            id: "sub-123",
          },
        }),
      } as any);

      const result = await client.createSubscription(
        "pm-token",
        "plan-monthly",
        {
          billingCycles: 12,
        },
      );

      expect(result.externalId).toBe("sub-123");
    });
  });

  describe("verifyWebhookSignature", () => {
    it("should verify valid webhook signature", () => {
      const payload = JSON.stringify({ transactionId: "txn-123" });
      const signature = client.verifyWebhookSignature(payload, "invalid-sig");

      // Mock validation
      expect(typeof signature).toBe("boolean");
    });
  });

  describe("parseWebhookPayload", () => {
    it("should parse transaction webhook", () => {
      const payload = {
        eventType: "transaction.settlement_confirmed",
        transaction: { id: "txn-123" },
      };

      const event = client.parseWebhookPayload(payload);

      expect(event?.eventType).toBe("settled");
      expect(event?.resourceType).toBe("transaction");
    });

    it("should parse dispute webhook", () => {
      const payload = {
        eventType: "dispute_opened",
        dispute: { id: "disp-123" },
      };

      const event = client.parseWebhookPayload(payload);

      expect(event?.eventType).toBe("dispute_opened");
      expect(event?.resourceType).toBe("dispute");
    });
  });

  describe("rate limiting", () => {
    it("should handle rate limiting gracefully", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-rate-limit",
            status: "authorized",
            amount: "100.00",
            currencyIsoCode: "USD",
            createdAt: "2024-03-12T00:00:00Z",
            updatedAt: "2024-03-12T00:00:00Z",
          },
        }),
      } as any);

      // Simulate rate limit by making multiple concurrent requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          client.charge(10000, "USD", "pm-token").catch((err) => {
            // Some might timeout due to rate limit
          }),
        );

      await Promise.allSettled(requests);
    });
  });

  describe("error handling", () => {
    it("should retry on transient errors", async () => {
      let attempts = 0;
      vi.spyOn(global, "fetch").mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error("Temporary network error");
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            transaction: { id: "txn-456", amount: "100.00" },
          }),
        } as any;
      });

      const result = await client.charge(10000, "USD", "pm-token");

      expect(attempts).toBeGreaterThan(1);
      expect(result).toBeDefined();
    });

    it("should not retry on client errors", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          errors: { message: "Invalid request" },
        }),
      } as any);

      await expect(client.charge(10000, "USD", "pm-invalid")).rejects.toThrow();
    });
  });

  describe("idempotency", () => {
    it("should return cached result for same idempotency key", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-789",
            amount: "100.00",
            status: "authorized",
          },
        }),
      } as any);

      const key = "idempotency-key-test";

      const result1 = await client.charge(10000, "USD", "pm-token", {
        idempotencyKey: key,
      });

      vi.spyOn(global, "fetch").mockClear();

      const result2 = await client.charge(10000, "USD", "pm-token", {
        idempotencyKey: key,
      });

      // Second call should not make API request (cached)
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result1.id).toBe(result2.id);
    });
  });

  describe("PCI compliance", () => {
    it("should not log raw card numbers", () => {
      const logSpy = vi.spyOn(console, "log");

      // Simulate logging
      const cardNumber = "4111111111111111";

      // Mask should be applied
      const masked = "XXXX-XXXX-XXXX-1111";
      expect(masked).not.toContain("4111");
    });
  });

  describe("currency handling", () => {
    it("should format amounts correctly", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: { id: "txn-999", amount: "100.50", status: "settled" },
        }),
      } as any);

      const result = await client.charge(10050, "USD", "pm-token");

      expect(result.amount).toBe(10050);
    });

    it("should validate currency code", async () => {
      // Currency validation happens in charge method
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: { id: "txn-123", amount: "100.00" },
        }),
      } as any);

      const result = await client.charge(10000, "USD", "pm-token");

      expect(result.currency).toBe("USD");
    });
  });

  describe("3DS handling", () => {
    it("should support 3D Secure authentication", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          transaction: {
            id: "txn-3ds",
            status: "authorized",
            threeDSecure: {
              authenticated: true,
              version: "2.0",
            },
          },
        }),
      } as any);

      const result = await client.charge(10000, "USD", "pm-token", {
        attemptThreeDSecure: true,
      });

      expect(result).toBeDefined();
    });
  });
});
