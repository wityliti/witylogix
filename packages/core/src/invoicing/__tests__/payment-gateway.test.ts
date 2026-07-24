/**
 * Payment Gateway Tests
 * Comprehensive test suite for payment processing and reconciliation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  StripeAdapter,
  ManualPaymentAdapter,
  PaymentReconciliation,
  PaymentGatewayFactory,
  PaymentGatewayError,
  createPaymentLinkOptions,
  type Payment,
} from "../index.js";
import type { Invoice } from "../index.js";

describe("StripeAdapter", () => {
  let adapter: StripeAdapter;

  beforeEach(() => {
    adapter = new StripeAdapter("sk_test_123", "whsec_test_456");
  });

  describe("createPaymentLink", () => {
    it("should create payment link", async () => {
      const result = await adapter.createPaymentLink({
        invoiceId: "inv-1",
        amount: 100,
        currency: "USD",
        customerEmail: "test@example.com",
      });

      expect(result.url).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.url).toContain("stripe.com");
    });

    it("should include metadata in payment link", async () => {
      const result = await adapter.createPaymentLink({
        invoiceId: "inv-1",
        amount: 100,
        currency: "USD",
        metadata: { customField: "value" },
      });

      expect(result.id).toBeDefined();
    });
  });

  describe("createCheckoutSession", () => {
    it("should create checkout session", async () => {
      const result = await adapter.createCheckoutSession({
        invoiceId: "inv-1",
        amount: 100,
        currency: "USD",
        lineItems: [
          {
            name: "Delivery Service",
            amount: 100,
            quantity: 1,
          },
        ],
      });

      expect(result.url).toBeDefined();
      expect(result.sessionId).toBeDefined();
    });
  });

  describe("getPaymentStatus", () => {
    it("should get payment status", async () => {
      const payment = await adapter.getPaymentStatus("pi_123");

      expect(payment.id).toBe("pi_123");
      expect(payment.status).toBe("completed");
    });
  });

  describe("processRefund", () => {
    it("should process refund", async () => {
      const result = await adapter.processRefund({
        paymentId: "pi_123",
        amount: 50,
        reason: "Customer request",
      });

      expect(result.refundId).toBeDefined();
      expect(result.status).toBe("refunded");
    });

    it("should handle full refund without amount", async () => {
      const result = await adapter.processRefund({
        paymentId: "pi_123",
      });

      expect(result.status).toBe("refunded");
    });
  });

  describe("validateWebhook", () => {
    it("should validate webhook signature", async () => {
      const isValid = await adapter.validateWebhook(
        { type: "test", id: "123", data: {}, timestamp: new Date() },
        "sig_test",
      );

      expect(typeof isValid).toBe("boolean");
    });
  });
});

describe("ManualPaymentAdapter", () => {
  let adapter: ManualPaymentAdapter;

  beforeEach(() => {
    adapter = new ManualPaymentAdapter();
  });

  describe("recordBankTransfer", () => {
    it("should record bank transfer", async () => {
      const payment = await adapter.recordBankTransfer(
        "inv-1",
        100,
        "TRANSFER-123",
      );

      expect(payment.invoiceId).toBe("inv-1");
      expect(payment.amount).toBe(100);
      expect(payment.method).toBe("bank_transfer");
      expect(payment.reference).toBe("TRANSFER-123");
    });
  });

  describe("recordCashPayment", () => {
    it("should record cash payment", async () => {
      const payment = await adapter.recordCashPayment("inv-1", 100);

      expect(payment.invoiceId).toBe("inv-1");
      expect(payment.amount).toBe(100);
      expect(payment.method).toBe("cash");
    });
  });

  describe("recordCheckPayment", () => {
    it("should record check payment", async () => {
      const payment = await adapter.recordCheckPayment(
        "inv-1",
        100,
        "CHECK-123",
      );

      expect(payment.invoiceId).toBe("inv-1");
      expect(payment.amount).toBe(100);
      expect(payment.method).toBe("check");
      expect(payment.reference).toBe("CHECK-123");
    });
  });

  describe("createPaymentLink", () => {
    it("should throw error for payment links", async () => {
      await expect(
        adapter.createPaymentLink({
          invoiceId: "inv-1",
          amount: 100,
          currency: "USD",
        }),
      ).rejects.toThrow("Manual payments do not support payment links");
    });
  });

  describe("createCheckoutSession", () => {
    it("should throw error for checkout sessions", async () => {
      await expect(
        adapter.createCheckoutSession({
          invoiceId: "inv-1",
          amount: 100,
          currency: "USD",
        }),
      ).rejects.toThrow("Manual payments do not support checkout sessions");
    });
  });
});

describe("PaymentReconciliation", () => {
  describe("matchPaymentToInvoice", () => {
    it("should match exact payment to invoice", () => {
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        amount: 110,
        currency: "USD",
        method: "bank_transfer",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "sent",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(
        PaymentReconciliation.matchPaymentToInvoice(payment, invoice),
      ).toBe(true);
    });

    it("should match payment within tolerance", () => {
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        amount: 110.005,
        currency: "USD",
        method: "bank_transfer",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "sent",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(
        PaymentReconciliation.matchPaymentToInvoice(payment, invoice),
      ).toBe(true);
    });

    it("should not match mismatched payment", () => {
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        amount: 100,
        currency: "USD",
        method: "bank_transfer",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "sent",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(
        PaymentReconciliation.matchPaymentToInvoice(payment, invoice),
      ).toBe(false);
    });
  });

  describe("handlePartialPayment", () => {
    it("should handle partial payment correctly", () => {
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        amount: 50,
        currency: "USD",
        method: "bank_transfer",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "sent",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should not throw
      expect(() =>
        PaymentReconciliation.handlePartialPayment(payment, invoice),
      ).not.toThrow();
    });
  });

  describe("handleOverpayment", () => {
    it("should detect overpayment", () => {
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        amount: 120,
        currency: "USD",
        method: "bank_transfer",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "sent",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = PaymentReconciliation.handleOverpayment(payment, invoice);

      expect(result.refundRequired).toBe(true);
      expect(result.overpayment).toBe(10);
    });

    it("should detect no overpayment for exact payment", () => {
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        amount: 110,
        currency: "USD",
        method: "bank_transfer",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "sent",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = PaymentReconciliation.handleOverpayment(payment, invoice);

      expect(result.refundRequired).toBe(false);
      expect(result.overpayment).toBe(0);
    });
  });

  describe("reconcile", () => {
    it("should reconcile matched payments", () => {
      const payments: Payment[] = [
        {
          id: "pay-1",
          invoiceId: "inv-1",
          amount: 110,
          currency: "USD",
          method: "bank_transfer",
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const invoices: Invoice[] = [
        {
          id: "inv-1",
          tenantId: "tenant-1",
          invoiceNumber: "INV-2026-00001",
          status: "sent",
          subtotal: 100,
          discountTotal: 0,
          taxTotal: 10,
          total: 110,
          currency: "USD",
          issuedAt: new Date(),
          dueAt: new Date(),
          lineItems: [],
          discounts: [],
          taxes: [],
          payments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = PaymentReconciliation.reconcile(payments, invoices);

      expect(result.matched).toHaveLength(1);
      expect(result.unmatched).toHaveLength(0);
      expect(result.overpaid).toHaveLength(0);
    });

    it("should identify unmatched payments", () => {
      const payments: Payment[] = [
        {
          id: "pay-1",
          invoiceId: "inv-999",
          amount: 100,
          currency: "USD",
          method: "bank_transfer",
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const invoices: Invoice[] = [
        {
          id: "inv-1",
          tenantId: "tenant-1",
          invoiceNumber: "INV-2026-00001",
          status: "sent",
          subtotal: 100,
          discountTotal: 0,
          taxTotal: 10,
          total: 110,
          currency: "USD",
          issuedAt: new Date(),
          dueAt: new Date(),
          lineItems: [],
          discounts: [],
          taxes: [],
          payments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = PaymentReconciliation.reconcile(payments, invoices);

      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(1);
    });

    it("should identify overpaid invoices", () => {
      const payments: Payment[] = [
        {
          id: "pay-1",
          invoiceId: "inv-1",
          amount: 120,
          currency: "USD",
          method: "bank_transfer",
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const invoices: Invoice[] = [
        {
          id: "inv-1",
          tenantId: "tenant-1",
          invoiceNumber: "INV-2026-00001",
          status: "sent",
          subtotal: 100,
          discountTotal: 0,
          taxTotal: 10,
          total: 110,
          currency: "USD",
          issuedAt: new Date(),
          dueAt: new Date(),
          lineItems: [],
          discounts: [],
          taxes: [],
          payments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = PaymentReconciliation.reconcile(payments, invoices);

      expect(result.matched).toHaveLength(1);
      expect(result.overpaid).toHaveLength(1);
      expect(result.overpaid[0].amount).toBe(10);
    });
  });
});

describe("PaymentGatewayFactory", () => {
  beforeEach(() => {
    PaymentGatewayFactory.clearInstances();
  });

  describe("getGateway", () => {
    it("should get Stripe gateway", () => {
      const gateway = PaymentGatewayFactory.getGateway("stripe", {
        apiKey: "sk_test_123",
        webhookSecret: "whsec_test_456",
      });

      expect(gateway).toBeInstanceOf(StripeAdapter);
    });

    it("should get manual payment gateway", () => {
      const gateway = PaymentGatewayFactory.getGateway("manual");

      expect(gateway).toBeInstanceOf(ManualPaymentAdapter);
    });

    it("should throw error for Stripe without credentials", () => {
      expect(() => {
        PaymentGatewayFactory.getGateway("stripe");
      }).toThrow("Stripe requires apiKey and webhookSecret");
    });

    it("should cache gateway instances", () => {
      const gateway1 = PaymentGatewayFactory.getGateway("stripe", {
        apiKey: "sk_test_123",
        webhookSecret: "whsec_test_456",
      });

      const gateway2 = PaymentGatewayFactory.getGateway("stripe", {
        apiKey: "sk_test_123",
        webhookSecret: "whsec_test_456",
      });

      expect(gateway1).toBe(gateway2);
    });
  });
});

describe("createPaymentLinkOptions", () => {
  it("should create payment link options", () => {
    const options = createPaymentLinkOptions("inv-1", 100, "USD", {
      customerEmail: "test@example.com",
      customerName: "John Doe",
    });

    expect(options.invoiceId).toBe("inv-1");
    expect(options.amount).toBe(100);
    expect(options.currency).toBe("USD");
    expect(options.customerEmail).toBe("test@example.com");
    expect(options.customerName).toBe("John Doe");
  });
});
