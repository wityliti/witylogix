/**
 * Invoice Service Tests
 * Tests invoice creation, cost calculation with tiers/surcharges,
 * discount application, tax calculation, number generation, and workflow
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxable?: boolean;
}

interface InvoiceData {
  invoiceNumber: string;
  customerId: string;
  customerEmail: string;
  orderId: string;
  lineItems: InvoiceLineItem[];
  status: "draft" | "finalized" | "voided" | "paid";
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount?: number;
  dueDate: Date;
  createdAt: Date;
  finalizedAt?: Date;
}

/**
 * Mock Invoice Service
 */
class InvoiceService {
  private invoiceNumberSequence = 1000;
  private invoices = new Map<string, InvoiceData>();
  private taxRates: Record<string, number> = {
    "US-CA": 0.0725,
    "US-NY": 0.08,
    "US-TX": 0.0625,
    "CA-ON": 0.13,
    "GB-ENG": 0.20,
  };

  createInvoice(
    customerId: string,
    customerEmail: string,
    orderId: string,
    lineItems: InvoiceLineItem[],
    jurisdiction: string
  ): InvoiceData {
    const invoiceNumber = `INV-${++this.invoiceNumberSequence}`;

    const subtotal = this.calculateSubtotal(lineItems);
    const taxableAmount = lineItems
      .filter((item) => item.taxable !== false)
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const taxRate = this.taxRates[jurisdiction] || 0;
    const tax = Math.round(taxableAmount * taxRate * 100) / 100;

    const invoice: InvoiceData = {
      invoiceNumber,
      customerId,
      customerEmail,
      orderId,
      lineItems,
      status: "draft",
      subtotal,
      tax,
      discount: 0,
      total: subtotal + tax,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    this.invoices.set(invoiceNumber, invoice);
    return invoice;
  }

  calculateSubtotal(lineItems: InvoiceLineItem[]): number {
    return Math.round(
      lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      ) * 100
    ) / 100;
  }

  applyDiscount(
    invoiceNumber: string,
    amount: number,
    type: "fixed" | "percentage"
  ): InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "draft") throw new Error("Can only discount draft invoices");

    const discountAmount =
      type === "percentage" ? (invoice.subtotal * amount) / 100 : amount;

    invoice.discount = Math.min(discountAmount, invoice.subtotal);
    invoice.total = invoice.subtotal + invoice.tax - invoice.discount;

    return invoice;
  }

  finalizeInvoice(invoiceNumber: string): InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "draft") throw new Error("Invoice already finalized");

    invoice.status = "finalized";
    invoice.finalizedAt = new Date();

    return invoice;
  }

  voidInvoice(invoiceNumber: string): InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "paid") throw new Error("Cannot void paid invoice");

    invoice.status = "voided";

    return invoice;
  }

  recordPayment(invoiceNumber: string, amount: number): InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "finalized") throw new Error("Can only pay finalized invoices");

    invoice.paidAmount = (invoice.paidAmount || 0) + amount;

    if (invoice.paidAmount >= invoice.total) {
      invoice.status = "paid";
    }

    return invoice;
  }

  getInvoice(invoiceNumber: string): InvoiceData | undefined {
    return this.invoices.get(invoiceNumber);
  }

  calculateTax(subtotal: number, jurisdiction: string): number {
    const rate = this.taxRates[jurisdiction] || 0;
    return Math.round(subtotal * rate * 100) / 100;
  }

  calculateWithTiers(
    baseAmount: number,
    tier: "economy" | "standard" | "premium"
  ): number {
    const tierMultipliers: Record<string, number> = {
      economy: 1.0,
      standard: 1.15,
      premium: 1.35,
    };

    return Math.round(baseAmount * tierMultipliers[tier] * 100) / 100;
  }

  calculateWithSurcharge(
    baseAmount: number,
    surchargeType: "fuel" | "peak" | "weight",
    percentage: number
  ): number {
    return Math.round(baseAmount * (1 + percentage / 100) * 100) / 100;
  }

  isInvoiceNumberUnique(invoiceNumber: string): boolean {
    return !this.invoices.has(invoiceNumber);
  }

  validateInvoiceNumber(invoiceNumber: string): boolean {
    return /^INV-\d+$/.test(invoiceNumber);
  }
}

describe("InvoiceService", () => {
  let service: InvoiceService;

  beforeEach(() => {
    service = new InvoiceService();
  });

  describe("Invoice Creation", () => {
    it("should create invoice with line items", () => {
      const lineItems: InvoiceLineItem[] = [
        { description: "Delivery Service", quantity: 1, unitPrice: 50 },
        { description: "Handling Fee", quantity: 1, unitPrice: 10 },
      ];

      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        lineItems,
        "US-CA"
      );

      expect(invoice.customerId).toBe("cust_123");
      expect(invoice.customerEmail).toBe("john@example.com");
      expect(invoice.orderId).toBe("order_456");
      expect(invoice.lineItems).toHaveLength(2);
      expect(invoice.status).toBe("draft");
    });

    it("should generate unique invoice numbers", () => {
      const invoice1 = service.createInvoice(
        "cust_1",
        "customer1@example.com",
        "order_1",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      const invoice2 = service.createInvoice(
        "cust_2",
        "customer2@example.com",
        "order_2",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      expect(invoice1.invoiceNumber).not.toBe(invoice2.invoiceNumber);
      expect(service.isInvoiceNumberUnique(invoice1.invoiceNumber)).toBe(false);
      expect(service.isInvoiceNumberUnique("INV-9999")).toBe(true);
    });

    it("should validate invoice number format", () => {
      expect(service.validateInvoiceNumber("INV-1001")).toBe(true);
      expect(service.validateInvoiceNumber("INV-5000")).toBe(true);
      expect(service.validateInvoiceNumber("invalid")).toBe(false);
      expect(service.validateInvoiceNumber("order-123")).toBe(false);
    });

    it("should set default due date to 30 days", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      const dueTime = invoice.dueDate.getTime();
      const expectedTime = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).getTime();

      expect(Math.abs(dueTime - expectedTime)).toBeLessThan(1000);
    });

    it("should start invoice in draft status", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      expect(invoice.status).toBe("draft");
      expect(invoice.finalizedAt).toBeUndefined();
    });
  });

  describe("Cost Calculation with Tiers", () => {
    it("should calculate economy tier pricing", () => {
      const baseAmount = 100;
      const cost = service.calculateWithTiers(baseAmount, "economy");

      expect(cost).toBe(100);
    });

    it("should calculate standard tier pricing with markup", () => {
      const baseAmount = 100;
      const cost = service.calculateWithTiers(baseAmount, "standard");

      expect(cost).toBe(115);
    });

    it("should calculate premium tier pricing with higher markup", () => {
      const baseAmount = 100;
      const cost = service.calculateWithTiers(baseAmount, "premium");

      expect(cost).toBe(135);
    });

    it("should handle decimal amounts in tier calculation", () => {
      const baseAmount = 99.99;
      const cost = service.calculateWithTiers(baseAmount, "standard");

      expect(cost).toBeCloseTo(114.99, 2);
    });
  });

  describe("Cost Calculation with Surcharges", () => {
    it("should apply fuel surcharge", () => {
      const baseAmount = 100;
      const withSurcharge = service.calculateWithSurcharge(
        baseAmount,
        "fuel",
        10
      );

      expect(withSurcharge).toBe(110);
    });

    it("should apply peak hour surcharge", () => {
      const baseAmount = 100;
      const withSurcharge = service.calculateWithSurcharge(
        baseAmount,
        "peak",
        25
      );

      expect(withSurcharge).toBe(125);
    });

    it("should apply weight surcharge", () => {
      const baseAmount = 100;
      const withSurcharge = service.calculateWithSurcharge(
        baseAmount,
        "weight",
        15
      );

      expect(withSurcharge).toBe(115);
    });

    it("should handle multiple surcharges", () => {
      const baseAmount = 100;
      let cost = baseAmount;

      cost = service.calculateWithSurcharge(cost, "fuel", 10);
      cost = service.calculateWithSurcharge(cost, "peak", 15);

      expect(cost).toBeCloseTo(126.5, 1);
    });
  });

  describe("Discount Application", () => {
    it("should apply fixed amount discount", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [
          { description: "Service 1", quantity: 1, unitPrice: 100 },
          { description: "Service 2", quantity: 1, unitPrice: 50 },
        ],
        "US-CA"
      );

      const originalTotal = invoice.total;
      const updated = service.applyDiscount(invoice.invoiceNumber, 20, "fixed");

      expect(updated.discount).toBe(20);
      expect(updated.total).toBe(originalTotal - 20);
    });

    it("should apply percentage discount", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      const subtotal = invoice.subtotal;
      service.applyDiscount(invoice.invoiceNumber, 10, "percentage");

      const updated = service.getInvoice(invoice.invoiceNumber)!;
      expect(updated.discount).toBe(subtotal * 0.1);
    });

    it("should not allow discount to exceed subtotal", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      service.applyDiscount(invoice.invoiceNumber, 200, "fixed");

      const updated = service.getInvoice(invoice.invoiceNumber)!;
      expect(updated.discount).toBeLessThanOrEqual(updated.subtotal);
    });

    it("should prevent discounting finalized invoices", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      service.finalizeInvoice(invoice.invoiceNumber);

      expect(() =>
        service.applyDiscount(invoice.invoiceNumber, 10, "fixed")
      ).toThrow();
    });
  });

  describe("Tax Calculation", () => {
    it("should calculate tax for California", () => {
      const tax = service.calculateTax(100, "US-CA");
      expect(tax).toBe(7.25);
    });

    it("should calculate tax for New York", () => {
      const tax = service.calculateTax(100, "US-NY");
      expect(tax).toBe(8);
    });

    it("should calculate tax for Texas", () => {
      const tax = service.calculateTax(100, "US-TX");
      expect(tax).toBe(6.25);
    });

    it("should calculate tax for Canada Ontario", () => {
      const tax = service.calculateTax(100, "CA-ON");
      expect(tax).toBe(13);
    });

    it("should calculate tax for UK England", () => {
      const tax = service.calculateTax(100, "GB-ENG");
      expect(tax).toBe(20);
    });

    it("should use zero tax for unknown jurisdiction", () => {
      const tax = service.calculateTax(100, "UNKNOWN");
      expect(tax).toBe(0);
    });

    it("should include multiple jurisdiction taxes in invoice", () => {
      const invoice1 = service.createInvoice(
        "cust_1",
        "customer1@example.com",
        "order_1",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      const invoice2 = service.createInvoice(
        "cust_2",
        "customer2@example.com",
        "order_2",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "GB-ENG"
      );

      expect(invoice1.tax).toBe(7.25);
      expect(invoice2.tax).toBe(20);
    });
  });

  describe("Finalize and Void Flow", () => {
    it("should finalize draft invoice", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      const finalized = service.finalizeInvoice(invoice.invoiceNumber);

      expect(finalized.status).toBe("finalized");
      expect(finalized.finalizedAt).toBeDefined();
    });

    it("should prevent re-finalizing finalized invoice", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      service.finalizeInvoice(invoice.invoiceNumber);

      expect(() => service.finalizeInvoice(invoice.invoiceNumber)).toThrow();
    });

    it("should void draft invoice", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      const voided = service.voidInvoice(invoice.invoiceNumber);

      expect(voided.status).toBe("voided");
    });

    it("should void finalized invoice", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      service.finalizeInvoice(invoice.invoiceNumber);
      const voided = service.voidInvoice(invoice.invoiceNumber);

      expect(voided.status).toBe("voided");
    });

    it("should prevent voiding paid invoice", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      service.finalizeInvoice(invoice.invoiceNumber);
      service.recordPayment(invoice.invoiceNumber, 107.25);

      expect(() => service.voidInvoice(invoice.invoiceNumber)).toThrow();
    });
  });

  describe("Payment Recording", () => {
    it("should record full payment", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      service.finalizeInvoice(invoice.invoiceNumber);
      const updated = service.recordPayment(
        invoice.invoiceNumber,
        invoice.total
      );

      expect(updated.paidAmount).toBe(invoice.total);
      expect(updated.status).toBe("paid");
    });

    it("should record partial payments", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      service.finalizeInvoice(invoice.invoiceNumber);
      service.recordPayment(invoice.invoiceNumber, 50);
      const updated = service.recordPayment(invoice.invoiceNumber, 57.25);

      expect(updated.paidAmount).toBe(107.25);
      expect(updated.status).toBe("paid");
    });

    it("should prevent payment on draft invoice", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      expect(() => service.recordPayment(invoice.invoiceNumber, 50)).toThrow();
    });

    it("should track outstanding balance", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 1, unitPrice: 100 }],
        "US-CA"
      );

      service.finalizeInvoice(invoice.invoiceNumber);
      service.recordPayment(invoice.invoiceNumber, 50);

      const updated = service.getInvoice(invoice.invoiceNumber)!;
      const outstanding = updated.total - (updated.paidAmount || 0);

      expect(outstanding).toBe(57.25);
    });
  });

  describe("Edge Cases and Rounding", () => {
    it("should handle rounding in calculations", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Service", quantity: 3, unitPrice: 33.33 }],
        "US-CA"
      );

      expect(invoice.subtotal).toBe(99.99);
      expect(Number.isFinite(invoice.total)).toBe(true);
    });

    it("should handle zero-price line items", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [
          { description: "Paid Service", quantity: 1, unitPrice: 100 },
          { description: "Free Item", quantity: 1, unitPrice: 0 },
        ],
        "US-CA"
      );

      expect(invoice.subtotal).toBe(100);
    });

    it("should handle high-quantity items", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [{ description: "Bulk Item", quantity: 1000, unitPrice: 0.99 }],
        "US-CA"
      );

      expect(invoice.subtotal).toBe(990);
    });

    it("should calculate non-taxable items separately", () => {
      const invoice = service.createInvoice(
        "cust_123",
        "john@example.com",
        "order_456",
        [
          { description: "Taxable Service", quantity: 1, unitPrice: 100, taxable: true },
          { description: "Non-Taxable Item", quantity: 1, unitPrice: 50, taxable: false },
        ],
        "US-CA"
      );

      // Only $100 should be taxed
      expect(invoice.tax).toBe(7.25);
      expect(invoice.subtotal).toBe(150);
    });
  });
});
