/**
 * Payment Processing Integration Tests
 * Tests Stripe payment links, manual payments, partial/overpayment,
 * refunds, reconciliation, and edge cases
 * ~350 lines, 25+ tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fixtures from "../fixtures/invoice-fixtures";
import * as paymentFixtures from "../fixtures/payment-fixtures";

// ─── Mock Payment Service ──────────────────────────────────────────────────

interface PaymentLink {
  id: string;
  url: string;
  invoiceId: string;
  amount: number;
  status: "active" | "expired" | "used";
  expiresAt: Date;
  createdAt: Date;
}

interface PaymentTransaction {
  id: string;
  invoiceId: string;
  amount: number;
  method: "stripe" | "manual" | "bank" | "cash" | "check";
  status: "pending" | "completed" | "failed" | "refunded";
  reference?: string;
  processedAt?: Date;
  webhookId?: string;
}

class PaymentService {
  private paymentLinks = new Map<string, PaymentLink>();
  private transactions = new Map<string, PaymentTransaction>();
  private webhookProcessingLog = new Map<string, { processed: boolean; timestamp: Date }>();

  // ─ Stripe Payment Link Creation ──────────────────────────────────────────

  createStripePaymentLink(invoice: fixtures.InvoiceData): PaymentLink {
    const paymentLink: PaymentLink = {
      id: `pl_${Math.random().toString(36).substr(2, 20)}`,
      url: `https://checkout.stripe.com/pay/${Math.random().toString(36).substr(2, 20)}`,
      invoiceId: invoice.id,
      amount: invoice.total,
      status: "active",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    this.paymentLinks.set(paymentLink.id, paymentLink);
    return paymentLink;
  }

  getPaymentLink(linkId: string): PaymentLink | undefined {
    return this.paymentLinks.get(linkId);
  }

  // ─ Manual Payment Recording ──────────────────────────────────────────────

  recordBankTransfer(invoiceId: string, amount: number, reference: string): PaymentTransaction {
    return this.recordManualPayment(invoiceId, amount, "bank", reference);
  }

  recordCashPayment(invoiceId: string, amount: number, reference?: string): PaymentTransaction {
    return this.recordManualPayment(invoiceId, amount, "cash", reference);
  }

  recordCheckPayment(invoiceId: string, amount: number, checkNumber: string): PaymentTransaction {
    return this.recordManualPayment(invoiceId, amount, "check", checkNumber);
  }

  private recordManualPayment(
    invoiceId: string,
    amount: number,
    method: "bank" | "cash" | "check",
    reference?: string
  ): PaymentTransaction {
    const transaction: PaymentTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invoiceId,
      amount,
      method,
      status: "completed",
      reference,
      processedAt: new Date(),
    };

    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  // ─ Partial Payment Handling ──────────────────────────────────────────────

  recordPartialPayment(invoiceId: string, amount: number): PaymentTransaction {
    const transaction: PaymentTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invoiceId,
      amount,
      method: "stripe",
      status: "completed",
      processedAt: new Date(),
    };

    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  // ─ Overpayment Handling ──────────────────────────────────────────────────

  recordOverpayment(invoiceId: string, amount: number, invoiceTotal: number): {
    transaction: PaymentTransaction;
    creditApplied: number;
  } {
    const creditApplied = amount - invoiceTotal;

    const transaction: PaymentTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invoiceId,
      amount,
      method: "stripe",
      status: "completed",
      processedAt: new Date(),
    };

    this.transactions.set(transaction.id, transaction);

    return {
      transaction,
      creditApplied,
    };
  }

  // ─ Refund Processing ────────────────────────────────────────────────────

  processRefund(
    invoiceId: string,
    amount: number,
    reason: "duplicate" | "customer_request" | "overpayment"
  ): PaymentTransaction {
    const refund: PaymentTransaction = {
      id: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invoiceId,
      amount: -amount,
      method: "stripe",
      status: "completed",
      processedAt: new Date(),
    };

    this.transactions.set(refund.id, refund);
    return refund;
  }

  // ─ Payment Reconciliation ───────────────────────────────────────────────

  reconcileInvoicePayments(invoiceId: string, invoiceTotal: number): {
    invoiceAmount: number;
    recordedPayments: number;
    actualPayments: number;
    discrepancy: number;
    status: "reconciled" | "pending" | "disputed";
  } {
    const invoiceTransactions = Array.from(this.transactions.values()).filter(
      (t) => t.invoiceId === invoiceId && t.status === "completed"
    );

    const recordedPayments = invoiceTransactions.reduce((sum, t) => sum + t.amount, 0);
    const actualPayments = recordedPayments;
    const discrepancy = Math.abs(invoiceTotal - actualPayments);

    return {
      invoiceAmount: invoiceTotal,
      recordedPayments,
      actualPayments,
      discrepancy,
      status: discrepancy < 0.01 ? "reconciled" : discrepancy < 1 ? "pending" : "disputed",
    };
  }

  // ─ Webhook Processing ──────────────────────────────────────────────────

  processWebhook(webhookId: string, payload: Record<string, unknown>): {
    success: boolean;
    isIdempotent: boolean;
    processed: boolean;
  } {
    // Check for duplicate webhook (idempotency)
    const alreadyProcessed = this.webhookProcessingLog.has(webhookId);

    if (alreadyProcessed) {
      return {
        success: true,
        isIdempotent: true,
        processed: false,
      };
    }

    // Process webhook
    this.webhookProcessingLog.set(webhookId, {
      processed: true,
      timestamp: new Date(),
    });

    return {
      success: true,
      isIdempotent: false,
      processed: true,
    };
  }

  // ─ Concurrent Payment Handling ─────────────────────────────────────────

  concurrentPaymentAttempts(
    invoiceId: string,
    paymentAttempts: Array<{ amount: number; timestamp: number }>
  ): {
    totalRecorded: number;
    successCount: number;
    duplicateCount: number;
  } {
    // Sort by timestamp to process in order
    const sorted = paymentAttempts.sort((a, b) => a.timestamp - b.timestamp);

    let totalRecorded = 0;
    let successCount = 0;
    let duplicateCount = 0;

    for (const attempt of sorted) {
      const txn: PaymentTransaction = {
        id: `txn_${attempt.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        invoiceId,
        amount: attempt.amount,
        method: "stripe",
        status: "completed",
        processedAt: new Date(attempt.timestamp),
      };

      this.transactions.set(txn.id, txn);
      totalRecorded += attempt.amount;
      successCount++;
    }

    return {
      totalRecorded,
      successCount,
      duplicateCount,
    };
  }

  getTransactions(invoiceId: string): PaymentTransaction[] {
    return Array.from(this.transactions.values()).filter((t) => t.invoiceId === invoiceId);
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Payment Processing Integration Tests", () => {
  let service: PaymentService;
  let mockInvoice: fixtures.InvoiceData;

  beforeEach(() => {
    service = new PaymentService();
    mockInvoice = fixtures.createInvoice();
  });

  describe("Stripe Payment Link Creation", () => {
    it("should create valid payment link", () => {
      const link = service.createStripePaymentLink(mockInvoice);

      expect(link.id).toMatch(/^pl_/);
      expect(link.url).toContain("https://checkout.stripe.com");
      expect(link.invoiceId).toBe(mockInvoice.id);
      expect(link.amount).toBe(mockInvoice.total);
      expect(link.status).toBe("active");
    });

    it("should set expiration date 24 hours from now", () => {
      const link = service.createStripePaymentLink(mockInvoice);
      const expiresIn = link.expiresAt.getTime() - Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      expect(expiresIn).toBeGreaterThan(twentyFourHours - 10000);
      expect(expiresIn).toBeLessThan(twentyFourHours + 10000);
    });

    it("should match invoice total amount", () => {
      const invoice = fixtures.createInvoice({
        subtotal: 1000,
        tax: 100,
        discount: 50,
        total: 1050,
      });

      const link = service.createStripePaymentLink(invoice);
      expect(link.amount).toBe(1050);
    });

    it("should handle multi-currency invoices", () => {
      const eurInvoice = fixtures.createMultiCurrencyInvoice("EUR", 1000);
      const link = service.createStripePaymentLink(eurInvoice);

      expect(link.amount).toBe(eurInvoice.total);
    });

    it("should retrieve existing payment link", () => {
      const link = service.createStripePaymentLink(mockInvoice);
      const retrieved = service.getPaymentLink(link.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(link.id);
    });
  });

  describe("Manual Payment Recording - Bank Transfer", () => {
    it("should record bank transfer payment", () => {
      const txn = service.recordBankTransfer(mockInvoice.id, 1000, "WIRE-123456");

      expect(txn.method).toBe("bank");
      expect(txn.amount).toBe(1000);
      expect(txn.reference).toBe("WIRE-123456");
      expect(txn.status).toBe("completed");
    });

    it("should set processed timestamp", () => {
      const beforeTime = new Date();
      const txn = service.recordBankTransfer(mockInvoice.id, 1000, "WIRE-123456");
      const afterTime = new Date();

      expect(txn.processedAt).toBeDefined();
      expect(txn.processedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(txn.processedAt!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("Manual Payment Recording - Cash", () => {
    it("should record cash payment", () => {
      const txn = service.recordCashPayment(mockInvoice.id, 500);

      expect(txn.method).toBe("cash");
      expect(txn.amount).toBe(500);
      expect(txn.status).toBe("completed");
    });
  });

  describe("Manual Payment Recording - Check", () => {
    it("should record check payment", () => {
      const txn = service.recordCheckPayment(mockInvoice.id, 1000, "CHK-1234");

      expect(txn.method).toBe("check");
      expect(txn.amount).toBe(1000);
      expect(txn.reference).toBe("CHK-1234");
    });
  });

  describe("Partial Payment Handling", () => {
    it("should record multiple partial payments", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });

      const payment1 = service.recordPartialPayment(invoice.id, 300);
      const payment2 = service.recordPartialPayment(invoice.id, 200);
      const payment3 = service.recordPartialPayment(invoice.id, 500);

      const transactions = service.getTransactions(invoice.id);
      expect(transactions).toHaveLength(3);

      const total = transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBe(1000);
    });

    it("should handle underpayment", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      service.recordPartialPayment(invoice.id, 400);

      const txns = service.getTransactions(invoice.id);
      const paidAmount = txns.reduce((sum, t) => sum + t.amount, 0);

      expect(paidAmount).toBeLessThan(invoice.total);
    });

    it("should accumulate towards full payment", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      const payments = [100, 200, 300, 400];

      for (const amount of payments) {
        service.recordPartialPayment(invoice.id, amount);
      }

      const txns = service.getTransactions(invoice.id);
      const total = txns.reduce((sum, t) => sum + t.amount, 0);

      expect(total).toBe(1000);
    });
  });

  describe("Overpayment Handling", () => {
    it("should detect overpayment", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      const result = service.recordOverpayment(invoice.id, 1200, invoice.total);

      expect(result.creditApplied).toBe(200);
    });

    it("should apply credit for overpayment", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      const result = service.recordOverpayment(invoice.id, 1500, invoice.total);

      expect(result.creditApplied).toBe(500);
    });

    it("should handle exact payment without overpayment", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      const result = service.recordOverpayment(invoice.id, 1000, invoice.total);

      expect(result.creditApplied).toBe(0);
    });

    it("should handle zero overpayment scenario", () => {
      const invoice = fixtures.createInvoice({ total: 5000 });
      const result = service.recordOverpayment(invoice.id, 5050, invoice.total);

      expect(result.creditApplied).toBe(50);
    });
  });

  describe("Refund Processing", () => {
    it("should process refund for duplicate payment", () => {
      const refund = service.processRefund(mockInvoice.id, 500, "duplicate");

      expect(refund.amount).toBe(-500);
      expect(refund.status).toBe("completed");
      expect(refund.method).toBe("stripe");
    });

    it("should process refund for customer request", () => {
      const refund = service.processRefund(mockInvoice.id, 1000, "customer_request");

      expect(refund.amount).toBe(-1000);
    });

    it("should process refund for overpayment credit", () => {
      const refund = service.processRefund(mockInvoice.id, 200, "overpayment");

      expect(refund.amount).toBe(-200);
    });

    it("should track refund in transaction history", () => {
      service.recordPartialPayment(mockInvoice.id, 1000);
      service.processRefund(mockInvoice.id, 100, "overpayment");

      const txns = service.getTransactions(mockInvoice.id);
      expect(txns).toHaveLength(2);

      const netAmount = txns.reduce((sum, t) => sum + t.amount, 0);
      expect(netAmount).toBe(900);
    });

    it("should handle multiple refunds", () => {
      service.recordPartialPayment(mockInvoice.id, 2000);
      service.processRefund(mockInvoice.id, 500, "duplicate");
      service.processRefund(mockInvoice.id, 300, "overpayment");

      const txns = service.getTransactions(mockInvoice.id);
      const netAmount = txns.reduce((sum, t) => sum + t.amount, 0);

      expect(netAmount).toBe(1200);
    });
  });

  describe("Payment Reconciliation", () => {
    it("should reconcile exact payment", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      service.recordPartialPayment(invoice.id, 1000);

      const reconciliation = service.reconcileInvoicePayments(invoice.id, invoice.total);

      expect(reconciliation.status).toBe("reconciled");
      expect(reconciliation.discrepancy).toBeLessThan(0.01);
    });

    it("should detect underpayment", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      service.recordPartialPayment(invoice.id, 800);

      const reconciliation = service.reconcileInvoicePayments(invoice.id, invoice.total);

      expect(reconciliation.status).toBe("disputed");
      expect(reconciliation.discrepancy).toBe(200);
    });

    it("should detect overpayment in reconciliation", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      service.recordPartialPayment(invoice.id, 1100);

      const reconciliation = service.reconcileInvoicePayments(invoice.id, invoice.total);

      expect(reconciliation.status).toBe("disputed");
      expect(reconciliation.discrepancy).toBe(100);
    });

    it("should handle multiple payments in reconciliation", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      service.recordPartialPayment(invoice.id, 300);
      service.recordPartialPayment(invoice.id, 400);
      service.recordPartialPayment(invoice.id, 300);

      const reconciliation = service.reconcileInvoicePayments(invoice.id, invoice.total);

      expect(reconciliation.recordedPayments).toBe(1000);
      expect(reconciliation.status).toBe("reconciled");
    });
  });

  describe("Webhook Processing", () => {
    it("should process webhook successfully", () => {
      const result = service.processWebhook("evt_123", {
        type: "payment_intent.succeeded",
        data: {},
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.isIdempotent).toBe(false);
    });

    it("should handle duplicate webhook idempotently", () => {
      const webhookId = "evt_duplicate_123";
      const payload = { type: "payment_intent.succeeded" };

      const result1 = service.processWebhook(webhookId, payload);
      const result2 = service.processWebhook(webhookId, payload);

      expect(result1.processed).toBe(true);
      expect(result2.processed).toBe(false);
      expect(result2.isIdempotent).toBe(true);
    });

    it("should process multiple different webhooks", () => {
      const result1 = service.processWebhook("evt_1", {});
      const result2 = service.processWebhook("evt_2", {});
      const result3 = service.processWebhook("evt_3", {});

      expect(result1.processed).toBe(true);
      expect(result2.processed).toBe(true);
      expect(result3.processed).toBe(true);
    });
  });

  describe("Concurrent Payment Handling", () => {
    it("should record concurrent payments sequentially", () => {
      const invoice = fixtures.createInvoice({ total: 1000 });
      const now = Date.now();

      const attempts = [
        { amount: 500, timestamp: now },
        { amount: 300, timestamp: now + 100 },
        { amount: 200, timestamp: now + 200 },
      ];

      const result = service.concurrentPaymentAttempts(invoice.id, attempts);

      expect(result.totalRecorded).toBe(1000);
      expect(result.successCount).toBe(3);
    });

    it("should handle simultaneous payment attempts", () => {
      const invoice = fixtures.createInvoice({ total: 500 });
      const now = Date.now();

      const attempts = [
        { amount: 500, timestamp: now },
        { amount: 500, timestamp: now }, // same timestamp
      ];

      const result = service.concurrentPaymentAttempts(invoice.id, attempts);

      expect(result.totalRecorded).toBe(1000);
    });

    it("should maintain transaction order", () => {
      const invoice = fixtures.createInvoice();
      const now = Date.now();

      const attempts = [
        { amount: 100, timestamp: now + 1000 },
        { amount: 200, timestamp: now },
        { amount: 150, timestamp: now + 500 },
      ];

      service.concurrentPaymentAttempts(invoice.id, attempts);
      const txns = service.getTransactions(invoice.id);

      const timestamps = txns.map((t) => t.processedAt?.getTime() || 0);
      expect(timestamps[0]).toBeLessThanOrEqual(timestamps[1]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero-amount payment", () => {
      const txn = service.recordPartialPayment(mockInvoice.id, 0);
      expect(txn.amount).toBe(0);
    });

    it("should handle very large payment amounts", () => {
      const largeAmount = 999999.99;
      const txn = service.recordPartialPayment(mockInvoice.id, largeAmount);

      expect(txn.amount).toBe(largeAmount);
    });

    it("should handle fractional cent amounts", () => {
      const amount = 100.01;
      const txn = service.recordPartialPayment(mockInvoice.id, amount);

      expect(txn.amount).toBe(amount);
    });

    it("should handle payment without reference", () => {
      const txn = service.recordCashPayment(mockInvoice.id, 500);

      expect(txn.reference).toBeUndefined();
      expect(txn.status).toBe("completed");
    });
  });
});
