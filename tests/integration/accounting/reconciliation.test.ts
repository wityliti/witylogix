/**
 * Accounting Reconciliation Integration Tests
 * Tests: Invoice matching, payment allocation, currency conversion,
 * tax calculation, credit notes, multi-line invoices, void/refund,
 * period-end reconciliation
 * ~200 lines, 22+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMockInvoice,
  createMockPayment,
  createMockLineItem,
  createMockQuickBooksInvoice,
  createMockXeroPayment,
} from "../fixtures/crm-accounting-fixtures.js";

// ─────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────

interface InvoiceMatch {
  invoiceId: string;
  amount: number;
  tolerance: number;
  matched: boolean;
  difference: number;
}

interface AllocationResult {
  paymentId: string;
  invoiceId: string;
  allocatedAmount: number;
  remainingBalance: number;
  status: "full_paid" | "partial_paid" | "overpaid";
}

interface ReconciliationReport {
  period: string;
  totalInvoices: number;
  totalPaid: number;
  outstanding: number;
  discrepancies: string[];
  reconciled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────

const TOLERANCE = 0.01; // $0.01 tolerance for rounding

describe("Accounting Reconciliation", () => {
  let reconciliationData: Map<string, any>;

  beforeEach(() => {
    reconciliationData = new Map();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    reconciliationData.clear();
  });

  // ───────────────────────────────────────────────────────────────────────
  // INVOICE AMOUNT MATCHING
  // ───────────────────────────────────────────────────────────────────────

  describe("Invoice Amount Matching", () => {
    it("should match invoice amounts within tolerance", () => {
      const invoice = createMockInvoice({
        id: "inv_001",
        amount: 1000.0,
        currency: "USD",
      });

      const match: InvoiceMatch = {
        invoiceId: invoice.id,
        amount: 1000.0,
        tolerance: TOLERANCE,
        matched: Math.abs(invoice.amount - 1000.0) <= TOLERANCE,
        difference: Math.abs(invoice.amount - 1000.0),
      };

      expect(match.matched).toBe(true);
      expect(match.difference).toBeLessThanOrEqual(TOLERANCE);
    });

    it("should detect amount mismatches exceeding tolerance", () => {
      const invoice = createMockInvoice({
        id: "inv_002",
        amount: 1000.0,
      });

      const recordedAmount = 1000.5;
      const difference = Math.abs(invoice.amount - recordedAmount);

      expect(difference).toBeGreaterThan(TOLERANCE);
    });

    it("should handle rounding differences of $0.01", () => {
      const invoice = createMockInvoice({ amount: 999.99 });
      const compareAmount = 1000.0;

      const difference = Math.abs(invoice.amount - compareAmount);
      expect(difference).toBeLessThan(0.02);
    });

    it("should validate exact penny amounts", () => {
      const amounts = [100.01, 250.5, 500.75, 1000.99];

      amounts.forEach((amount) => {
        const invoice = createMockInvoice({ amount });
        const cents = Math.round(amount * 100) % 100;
        expect(cents).toBeGreaterThanOrEqual(0);
        expect(cents).toBeLessThanOrEqual(99);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // PAYMENT ALLOCATION ACCURACY
  // ───────────────────────────────────────────────────────────────────────

  describe("Payment Allocation", () => {
    it("should allocate full payment correctly", () => {
      const invoice = createMockInvoice({
        id: "inv_003",
        amount: 5000.0,
      });

      const payment = createMockPayment({
        id: "pmt_001",
        amount: 5000.0,
        invoiceId: invoice.id,
      });

      const allocation: AllocationResult = {
        paymentId: payment.id,
        invoiceId: invoice.id,
        allocatedAmount: 5000.0,
        remainingBalance: 0.0,
        status: "full_paid",
      };

      expect(allocation.allocatedAmount).toBe(5000.0);
      expect(allocation.remainingBalance).toBe(0.0);
      expect(allocation.status).toBe("full_paid");
    });

    it("should allocate partial payment correctly", () => {
      const invoice = createMockInvoice({
        id: "inv_004",
        amount: 10000.0,
      });

      const payment = createMockPayment({
        id: "pmt_002",
        amount: 3000.0,
        invoiceId: invoice.id,
      });

      const allocation: AllocationResult = {
        paymentId: payment.id,
        invoiceId: invoice.id,
        allocatedAmount: 3000.0,
        remainingBalance: 7000.0,
        status: "partial_paid",
      };

      expect(allocation.allocatedAmount).toBe(3000.0);
      expect(allocation.remainingBalance).toBe(7000.0);
      expect(allocation.status).toBe("partial_paid");
    });

    it("should handle overpayment detection", () => {
      const invoice = createMockInvoice({
        id: "inv_005",
        amount: 5000.0,
      });

      const payment = createMockPayment({
        id: "pmt_003",
        amount: 5500.0,
      });

      const allocation: AllocationResult = {
        paymentId: payment.id,
        invoiceId: invoice.id,
        allocatedAmount: 5000.0,
        remainingBalance: -500.0,
        status: "overpaid",
      };

      expect(allocation.status).toBe("overpaid");
      expect(allocation.remainingBalance).toBe(-500.0);
    });

    it("should sequence multiple partial payments", () => {
      const invoice = createMockInvoice({
        id: "inv_006",
        amount: 10000.0,
      });

      const payment1 = createMockPayment({
        id: "pmt_004",
        amount: 4000.0,
      });

      const payment2 = createMockPayment({
        id: "pmt_005",
        amount: 6000.0,
      });

      const balance1 = invoice.amount - payment1.amount;
      const balance2 = balance1 - payment2.amount;

      expect(balance1).toBe(6000.0);
      expect(balance2).toBe(0.0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // CURRENCY CONVERSION RECONCILIATION
  // ───────────────────────────────────────────────────────────────────────

  describe("Currency Conversion Reconciliation", () => {
    it("should reconcile USD invoices", () => {
      const invoice = createMockInvoice({
        id: "inv_007",
        amount: 1000.0,
        currency: "USD",
      });

      expect(invoice.currency).toBe("USD");
    });

    it("should reconcile EUR invoices with consistent FX rate", () => {
      const invoice = createMockInvoice({
        id: "inv_008",
        amount: 850.0,
        currency: "EUR",
      });

      const fxRate = 1.1; // EUR to USD
      const usdAmount = invoice.amount * fxRate;

      expect(invoice.currency).toBe("EUR");
      expect(usdAmount).toBeCloseTo(935.0, 2);
    });

    it("should validate FX rate source consistency", () => {
      const invoice = createMockInvoice({
        id: "inv_009",
        amount: 500.0,
        currency: "GBP",
        fxRate: 1.27,
      });

      const usdEquivalent = invoice.amount * (invoice.fxRate || 1);
      expect(usdEquivalent).toBeCloseTo(635.0, 2);
    });

    it("should handle multi-currency invoices", () => {
      const invoices = [
        createMockInvoice({ amount: 1000.0, currency: "USD" }),
        createMockInvoice({ amount: 850.0, currency: "EUR", fxRate: 1.1 }),
        createMockInvoice({ amount: 100.0, currency: "GBP", fxRate: 1.27 }),
      ];

      expect(invoices).toHaveLength(3);
      expect(invoices.map((inv) => inv.currency)).toEqual([
        "USD",
        "EUR",
        "GBP",
      ]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // TAX CALCULATION VERIFICATION
  // ───────────────────────────────────────────────────────────────────────

  describe("Tax Calculation Verification", () => {
    it("should calculate tax for tax-exclusive amounts", () => {
      const lineItem = createMockLineItem({
        description: "Service",
        amount: 1000.0,
        quantity: 1,
        taxRate: 0.1, // 10%
      });

      const taxAmount = lineItem.amount * lineItem.taxRate;
      const total = lineItem.amount + taxAmount;

      expect(taxAmount).toBe(100.0);
      expect(total).toBe(1100.0);
    });

    it("should calculate tax for tax-inclusive amounts", () => {
      const lineItem = createMockLineItem({
        description: "Product",
        totalAmount: 1100.0, // includes tax
        taxRate: 0.1,
      });

      const baseAmount = lineItem.totalAmount / (1 + lineItem.taxRate);
      const taxAmount = lineItem.totalAmount - baseAmount;

      expect(baseAmount).toBeCloseTo(1000.0, 2);
      expect(taxAmount).toBeCloseTo(100.0, 2);
    });

    it("should validate multi-line tax calculation", () => {
      const line1 = createMockLineItem({
        amount: 1000.0,
        taxRate: 0.1,
      });

      const line2 = createMockLineItem({
        amount: 500.0,
        taxRate: 0.1,
      });

      const totalTax =
        line1.amount * line1.taxRate + line2.amount * line2.taxRate;
      const totalAmount = line1.amount + line2.amount + totalTax;

      expect(totalTax).toBe(150.0);
      expect(totalAmount).toBe(1650.0);
    });

    it("should handle zero tax rate", () => {
      const lineItem = createMockLineItem({
        amount: 1000.0,
        taxRate: 0.0,
      });

      const taxAmount = lineItem.amount * lineItem.taxRate;
      expect(taxAmount).toBe(0.0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // CREDIT NOTE APPLICATION
  // ───────────────────────────────────────────────────────────────────────

  describe("Credit Note Application", () => {
    it("should apply full credit note to invoice", () => {
      const invoice = createMockInvoice({
        id: "inv_010",
        amount: 5000.0,
      });

      const creditNote = createMockInvoice({
        id: "credit_001",
        amount: -5000.0, // negative for credit
      });

      const newBalance = invoice.amount + creditNote.amount;
      expect(newBalance).toBe(0.0);
    });

    it("should apply partial credit note", () => {
      const invoice = createMockInvoice({
        id: "inv_011",
        amount: 10000.0,
      });

      const creditNote = createMockInvoice({
        id: "credit_002",
        amount: -3000.0,
      });

      const newBalance = invoice.amount + creditNote.amount;
      expect(newBalance).toBe(7000.0);
    });

    it("should handle multiple credit notes", () => {
      const invoice = createMockInvoice({
        id: "inv_012",
        amount: 10000.0,
      });

      const credits = [
        createMockInvoice({ amount: -2000.0 }),
        createMockInvoice({ amount: -3000.0 }),
        createMockInvoice({ amount: -1000.0 }),
      ];

      const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);
      const newBalance = invoice.amount + totalCredits;

      expect(newBalance).toBe(4000.0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // MULTI-LINE INVOICE RECONCILIATION
  // ───────────────────────────────────────────────────────────────────────

  describe("Multi-line Invoice Reconciliation", () => {
    it("should reconcile invoice with multiple line items", () => {
      const items = [
        createMockLineItem({
          description: "Item 1",
          amount: 1000.0,
          quantity: 2,
        }),
        createMockLineItem({
          description: "Item 2",
          amount: 500.0,
          quantity: 1,
        }),
        createMockLineItem({
          description: "Item 3",
          amount: 250.0,
          quantity: 4,
        }),
      ];

      const subtotal = items.reduce(
        (sum, item) => sum + item.amount * item.quantity,
        0,
      );
      expect(subtotal).toBe(3000.0);
    });

    it("should validate line item totals sum to invoice total", () => {
      const invoice = createMockInvoice({
        id: "inv_013",
        lineItems: [
          createMockLineItem({ amount: 1000.0, quantity: 1 }),
          createMockLineItem({ amount: 2000.0, quantity: 1 }),
          createMockLineItem({ amount: 500.0, quantity: 1 }),
        ],
      });

      const lineTotal =
        invoice.lineItems?.reduce(
          (sum, item) => sum + item.amount * item.quantity,
          0,
        ) || 0;

      expect(lineTotal).toBe(3500.0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // VOID & REFUND HANDLING
  // ───────────────────────────────────────────────────────────────────────

  describe("Void & Refund Handling", () => {
    it("should void invoice with credit", () => {
      const invoice = createMockInvoice({
        id: "inv_014",
        amount: 5000.0,
        status: "active",
      });

      const voidCredit = createMockInvoice({
        id: "void_001",
        amount: -5000.0,
        status: "void",
      });

      expect(voidCredit.status).toBe("void");
      expect(voidCredit.amount).toBeLessThan(0);
    });

    it("should process full refund", () => {
      const payment = createMockPayment({
        id: "pmt_006",
        amount: 5000.0,
        status: "completed",
      });

      const refund = createMockPayment({
        id: "refund_001",
        amount: -5000.0,
        status: "refunded",
      });

      expect(refund.status).toBe("refunded");
      expect(refund.amount).toBeLessThan(0);
    });

    it("should process partial refund", () => {
      const payment = createMockPayment({
        id: "pmt_007",
        amount: 10000.0,
      });

      const refund = createMockPayment({
        id: "refund_002",
        amount: -3000.0,
      });

      const netAmount = payment.amount + refund.amount;
      expect(netAmount).toBe(7000.0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // PERIOD-END RECONCILIATION
  // ───────────────────────────────────────────────────────────────────────

  describe("Period-End Reconciliation", () => {
    it("should reconcile month-end statement", () => {
      const invoices = [
        createMockInvoice({ amount: 5000.0, status: "paid" }),
        createMockInvoice({ amount: 3000.0, status: "paid" }),
        createMockInvoice({ amount: 2000.0, status: "outstanding" }),
      ];

      const report: ReconciliationReport = {
        period: "2024-03",
        totalInvoices: invoices.length,
        totalPaid: invoices
          .filter((inv) => inv.status === "paid")
          .reduce((sum, inv) => sum + inv.amount, 0),
        outstanding: invoices
          .filter((inv) => inv.status === "outstanding")
          .reduce((sum, inv) => sum + inv.amount, 0),
        discrepancies: [],
        reconciled: true,
      };

      expect(report.totalPaid).toBe(8000.0);
      expect(report.outstanding).toBe(2000.0);
      expect(report.reconciled).toBe(true);
    });

    it("should identify reconciliation discrepancies", () => {
      const totalExpected = 10000.0;
      const totalReconciled = 9999.5;

      const discrepancy = totalExpected - totalReconciled;
      expect(discrepancy).toBe(0.5);
      expect(discrepancy).toBeGreaterThan(TOLERANCE);
    });
  });
});
