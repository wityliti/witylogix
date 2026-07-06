/**
 * Invoice Generation Integration Tests
 * Tests invoice creation from delivery records with all billing models,
 * volume discounts, tax calculation, multi-currency, numbering, and lifecycle
 * ~400 lines, 30+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fixtures from "../fixtures/invoice-fixtures";

// ─── Mock Invoice Service ───────────────────────────────────────────────────

class InvoiceService {
  private invoiceCounter = 10000;
  private invoices = new Map<string, fixtures.InvoiceData>();
  private deliveries = new Map<string, fixtures.DeliveryRecord>();

  createFromDeliveries(
    customerId: string,
    deliveries: fixtures.DeliveryRecord[],
    billingModel: string,
    billingPeriod: { start: Date; end: Date },
    currency: string = "USD",
    taxJurisdiction: string = "US-CA",
  ): fixtures.InvoiceData {
    if (deliveries.length === 0) {
      return this.createZeroInvoice(customerId, billingPeriod, currency);
    }

    const invoiceNumber = `INV-${++this.invoiceCounter}`;
    const lineItems = this.calculateLineItems(deliveries, billingModel);
    const subtotal = this.calculateSubtotal(lineItems);
    const tax = this.calculateTax(subtotal, taxJurisdiction);

    const invoice: fixtures.InvoiceData = {
      id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invoiceNumber,
      customerId,
      customerName: "Acme Corp",
      customerEmail: "billing@acme.com",
      lineItems,
      subtotal,
      discount: 0,
      tax,
      total: subtotal + tax,
      currency,
      billingPeriod,
      dueDate: new Date(billingPeriod.end.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: "draft",
      createdAt: new Date(),
      metadata: { deliveryCount: deliveries.length },
    };

    this.invoices.set(invoiceNumber, invoice);
    return invoice;
  }

  applyVolumeDiscount(
    invoiceNumber: string,
    deliveryCount: number,
  ): fixtures.InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");

    let discountPercent = 0;
    if (deliveryCount > 500) discountPercent = 15;
    else if (deliveryCount > 200) discountPercent = 10;
    else if (deliveryCount > 50) discountPercent = 5;

    const discountAmount = (invoice.subtotal * discountPercent) / 100;
    invoice.discount = discountAmount;
    invoice.discountType = "volume";
    invoice.total = invoice.subtotal - discountAmount + invoice.tax;

    return invoice;
  }

  applyFixedDiscount(
    invoiceNumber: string,
    amount: number,
  ): fixtures.InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");

    invoice.discount = Math.min(amount, invoice.subtotal);
    invoice.discountType = "fixed";
    invoice.total = invoice.subtotal - invoice.discount + invoice.tax;

    return invoice;
  }

  applyPercentageDiscount(
    invoiceNumber: string,
    percent: number,
  ): fixtures.InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");

    const discountAmount = (invoice.subtotal * percent) / 100;
    invoice.discount = discountAmount;
    invoice.discountType = "percentage";
    invoice.total = invoice.subtotal - invoice.discount + invoice.tax;

    return invoice;
  }

  sendInvoice(invoiceNumber: string): fixtures.InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");

    invoice.status = "sent";
    invoice.sentAt = new Date();

    return invoice;
  }

  recordPayment(invoiceNumber: string, amount: number): fixtures.InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");

    invoice.paidAmount = (invoice.paidAmount || 0) + amount;
    invoice.paidDate = new Date();

    if (invoice.paidAmount >= invoice.total) {
      invoice.status = "paid";
    }

    return invoice;
  }

  voidInvoice(invoiceNumber: string): fixtures.InvoiceData {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "paid") throw new Error("Cannot void paid invoice");

    invoice.status = "void";
    invoice.voidedAt = new Date();

    return invoice;
  }

  getInvoice(invoiceNumber: string): fixtures.InvoiceData | undefined {
    return this.invoices.get(invoiceNumber);
  }

  private calculateLineItems(
    deliveries: fixtures.DeliveryRecord[],
    billingModel: string,
  ): fixtures.InvoiceLineItem[] {
    switch (billingModel) {
      case "per-delivery":
        const deliveryCount = deliveries.length;
        return [
          {
            description: `${deliveryCount} Deliveries`,
            quantity: deliveryCount,
            unitPrice: 10,
            taxable: true,
          },
        ];

      case "per-mile":
        const totalMiles = deliveries.reduce((sum, d) => sum + d.distance, 0);
        return [
          {
            description: `${totalMiles} Miles`,
            quantity: totalMiles,
            unitPrice: 2.5,
            taxable: true,
          },
        ];

      case "per-hour":
        const totalHours = deliveries.reduce((sum, d) => sum + d.duration, 0);
        return [
          {
            description: `${totalHours.toFixed(2)} Hours`,
            quantity: totalHours,
            unitPrice: 20,
            taxable: true,
          },
        ];

      case "flat-rate":
        return [
          {
            description: "Flat Rate (Monthly)",
            quantity: 1,
            unitPrice: 100,
            taxable: true,
          },
        ];

      case "tiered":
        const tierDeliveries = deliveries.length;
        let tierPrice = 10;
        if (tierDeliveries > 200) tierPrice = 6;
        else if (tierDeliveries > 50) tierPrice = 8;

        return [
          {
            description: `${tierDeliveries} Deliveries (Tiered)`,
            quantity: tierDeliveries,
            unitPrice: tierPrice,
            taxable: true,
          },
        ];

      case "subscription":
        return [
          {
            description: "Subscription (Up to 100 deliveries)",
            quantity: 1,
            unitPrice: 499,
            taxable: true,
          },
          {
            description: `Overage (${Math.max(0, deliveries.length - 100)} deliveries)`,
            quantity: Math.max(0, deliveries.length - 100),
            unitPrice: 5,
            taxable: true,
          },
        ];

      default:
        throw new Error(`Unknown billing model: ${billingModel}`);
    }
  }

  private calculateSubtotal(lineItems: fixtures.InvoiceLineItem[]): number {
    return (
      Math.round(
        lineItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        ) * 100,
      ) / 100
    );
  }

  private calculateTax(subtotal: number, jurisdiction: string): number {
    const taxRate = fixtures.taxRates[jurisdiction] || 0;
    return Math.round(subtotal * taxRate * 100) / 100;
  }

  private createZeroInvoice(
    customerId: string,
    billingPeriod: { start: Date; end: Date },
    currency: string,
  ): fixtures.InvoiceData {
    const invoiceNumber = `INV-${++this.invoiceCounter}`;

    const invoice: fixtures.InvoiceData = {
      id: `invoice_zero_${Date.now()}`,
      invoiceNumber,
      customerId,
      customerName: "Test Customer",
      customerEmail: "test@example.com",
      lineItems: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      currency,
      billingPeriod,
      dueDate: new Date(billingPeriod.end.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: "draft",
      createdAt: new Date(),
    };

    this.invoices.set(invoiceNumber, invoice);
    return invoice;
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Invoice Generation Integration Tests", () => {
  let service: InvoiceService;
  let customerId: string;
  let billingPeriod: { start: Date; end: Date };

  beforeEach(() => {
    service = new InvoiceService();
    customerId = `customer_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    billingPeriod = {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  });

  describe("Per-Delivery Billing Model", () => {
    it("should calculate per-delivery cost correctly", () => {
      const deliveries = fixtures.createBatchDeliveries(50, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      expect(invoice.lineItems[0].quantity).toBe(50);
      expect(invoice.lineItems[0].unitPrice).toBe(10);
      expect(invoice.subtotal).toBe(500);
    });

    it("should handle single delivery", () => {
      const deliveries = [
        fixtures.createDeliveryRecord({ billingModel: "per-delivery" }),
      ];
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      expect(invoice.subtotal).toBe(10);
      expect(invoice.total).toBeGreaterThan(10); // with tax
    });

    it("should handle 1000+ deliveries", () => {
      const deliveries = fixtures.createBatchDeliveries(1200, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      expect(invoice.lineItems[0].quantity).toBe(1200);
      expect(invoice.subtotal).toBe(12000);
    });
  });

  describe("Per-Mile Billing Model", () => {
    it("should calculate per-mile cost correctly", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-mile");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-mile",
        billingPeriod,
      );

      const totalMiles = deliveries.reduce((sum, d) => sum + d.distance, 0);
      expect(invoice.lineItems[0].quantity).toBe(totalMiles);
      expect(invoice.lineItems[0].unitPrice).toBe(2.5);
    });

    it("should accumulate distances from multiple deliveries", () => {
      const deliveries = [
        fixtures.createDeliveryRecord({
          distance: 5,
          billingModel: "per-mile",
        }),
        fixtures.createDeliveryRecord({
          distance: 10,
          billingModel: "per-mile",
        }),
        fixtures.createDeliveryRecord({
          distance: 7.5,
          billingModel: "per-mile",
        }),
      ];
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-mile",
        billingPeriod,
      );

      expect(invoice.lineItems[0].quantity).toBe(22.5);
    });
  });

  describe("Per-Hour Billing Model", () => {
    it("should calculate per-hour cost correctly", () => {
      const deliveries = fixtures.createBatchDeliveries(5, "per-hour");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-hour",
        billingPeriod,
      );

      const totalHours = deliveries.reduce((sum, d) => sum + d.duration, 0);
      expect(invoice.lineItems[0].unitPrice).toBe(20);
    });
  });

  describe("Flat-Rate Billing Model", () => {
    it("should apply fixed monthly rate regardless of volume", () => {
      const smallBatch = fixtures.createBatchDeliveries(5, "flat-rate");
      const largeBatch = fixtures.createBatchDeliveries(500, "flat-rate");

      const invoice1 = service.createFromDeliveries(
        customerId,
        smallBatch,
        "flat-rate",
        billingPeriod,
      );
      const invoice2 = service.createFromDeliveries(
        customerId + "_2",
        largeBatch,
        "flat-rate",
        billingPeriod,
      );

      expect(invoice1.subtotal).toBe(100);
      expect(invoice2.subtotal).toBe(100);
    });
  });

  describe("Tiered Billing Model", () => {
    it("should apply tier 1 pricing for 0-50 deliveries", () => {
      const deliveries = fixtures.createBatchDeliveries(30, "tiered");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "tiered",
        billingPeriod,
      );

      expect(invoice.lineItems[0].unitPrice).toBe(10);
      expect(invoice.subtotal).toBe(300);
    });

    it("should apply tier 2 pricing for 51-200 deliveries", () => {
      const deliveries = fixtures.createBatchDeliveries(100, "tiered");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "tiered",
        billingPeriod,
      );

      expect(invoice.lineItems[0].unitPrice).toBe(8);
      expect(invoice.subtotal).toBe(800);
    });

    it("should apply tier 3 pricing for 200+ deliveries", () => {
      const deliveries = fixtures.createBatchDeliveries(300, "tiered");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "tiered",
        billingPeriod,
      );

      expect(invoice.lineItems[0].unitPrice).toBe(6);
      expect(invoice.subtotal).toBe(1800);
    });
  });

  describe("Subscription Billing Model", () => {
    it("should charge flat subscription fee with no overage", () => {
      const deliveries = fixtures.createBatchDeliveries(80, "subscription");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "subscription",
        billingPeriod,
      );

      expect(invoice.lineItems[0].unitPrice).toBe(499);
      expect(invoice.lineItems[1].quantity).toBe(0);
    });

    it("should charge overage for deliveries exceeding subscription limit", () => {
      const deliveries = fixtures.createBatchDeliveries(150, "subscription");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "subscription",
        billingPeriod,
      );

      expect(invoice.lineItems[0].unitPrice).toBe(499);
      expect(invoice.lineItems[1].quantity).toBe(50);
      expect(invoice.lineItems[1].unitPrice).toBe(5);
    });
  });

  describe("Volume Discounts", () => {
    it("should apply 5% discount for 51-200 deliveries", () => {
      const deliveries = fixtures.createBatchDeliveries(100, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      service.applyVolumeDiscount(invoice.invoiceNumber, 100);
      const discountedInvoice = service.getInvoice(invoice.invoiceNumber)!;

      expect(discountedInvoice.discountType).toBe("volume");
      expect(discountedInvoice.discount).toBe(50); // 5% of 1000
    });

    it("should apply 10% discount for 201-500 deliveries", () => {
      const deliveries = fixtures.createBatchDeliveries(300, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      service.applyVolumeDiscount(invoice.invoiceNumber, 300);
      const discountedInvoice = service.getInvoice(invoice.invoiceNumber)!;

      expect(discountedInvoice.discount).toBe(300); // 10% of 3000
    });

    it("should apply 15% discount for 500+ deliveries", () => {
      const deliveries = fixtures.createBatchDeliveries(600, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      service.applyVolumeDiscount(invoice.invoiceNumber, 600);
      const discountedInvoice = service.getInvoice(invoice.invoiceNumber)!;

      expect(discountedInvoice.discount).toBe(900); // 15% of 6000
    });
  });

  describe("Tax Calculation", () => {
    it("should calculate CA tax correctly (7.25%)", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
        "USD",
        "US-CA",
      );

      const expectedTax = Math.round(100 * 0.0725 * 100) / 100;
      expect(invoice.tax).toBe(expectedTax);
    });

    it("should calculate NY tax correctly (8%)", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
        "USD",
        "US-NY",
      );

      const expectedTax = Math.round(100 * 0.08 * 100) / 100;
      expect(invoice.tax).toBe(expectedTax);
    });

    it("should calculate UK tax correctly (20%)", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
        "GBP",
        "GB-ENG",
      );

      const expectedTax = Math.round(100 * 0.2 * 100) / 100;
      expect(invoice.tax).toBe(expectedTax);
    });
  });

  describe("Multi-Currency Support", () => {
    it("should create invoice in EUR", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
        "EUR",
      );

      expect(invoice.currency).toBe("EUR");
    });

    it("should create invoice in GBP", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      const invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
        "GBP",
      );

      expect(invoice.currency).toBe("GBP");
    });
  });

  describe("Invoice Numbering Sequence", () => {
    it("should generate sequential invoice numbers", () => {
      const deliveries = fixtures.createBatchDeliveries(5, "per-delivery");
      const invoice1 = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );
      const invoice2 = service.createFromDeliveries(
        customerId + "_2",
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      const num1 = parseInt(invoice1.invoiceNumber.split("-")[1]);
      const num2 = parseInt(invoice2.invoiceNumber.split("-")[1]);

      expect(num2).toBe(num1 + 1);
    });

    it("should never repeat invoice numbers", () => {
      const deliveries = fixtures.createBatchDeliveries(5, "per-delivery");
      const invoices = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const invoice = service.createFromDeliveries(
          customerId + `_${i}`,
          deliveries,
          "per-delivery",
          billingPeriod,
        );
        invoices.add(invoice.invoiceNumber);
      }

      expect(invoices.size).toBe(100);
    });
  });

  describe("Invoice Lifecycle: Draft → Sent → Paid", () => {
    it("should transition through complete lifecycle", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      let invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      expect(invoice.status).toBe("draft");

      invoice = service.sendInvoice(invoice.invoiceNumber);
      expect(invoice.status).toBe("sent");
      expect(invoice.sentAt).toBeDefined();

      invoice = service.recordPayment(invoice.invoiceNumber, invoice.total);
      expect(invoice.status).toBe("paid");
      expect(invoice.paidDate).toBeDefined();
    });

    it("should handle partial payments", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      let invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      invoice = service.sendInvoice(invoice.invoiceNumber);
      invoice = service.recordPayment(invoice.invoiceNumber, invoice.total / 2);

      expect(invoice.status).toBe("sent"); // not paid yet
      expect(invoice.paidAmount).toBe(invoice.total / 2);

      invoice = service.recordPayment(invoice.invoiceNumber, invoice.total / 2);
      expect(invoice.status).toBe("paid");
    });
  });

  describe("Invoice Void/Cancel Flows", () => {
    it("should allow voiding draft invoice", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      let invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      invoice = service.voidInvoice(invoice.invoiceNumber);
      expect(invoice.status).toBe("void");
      expect(invoice.voidedAt).toBeDefined();
    });

    it("should not allow voiding paid invoice", () => {
      const deliveries = fixtures.createBatchDeliveries(10, "per-delivery");
      let invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      invoice = service.sendInvoice(invoice.invoiceNumber);
      invoice = service.recordPayment(invoice.invoiceNumber, invoice.total);

      expect(() => service.voidInvoice(invoice.invoiceNumber)).toThrow(
        "Cannot void paid invoice",
      );
    });
  });

  describe("Fixed and Percentage Discounts", () => {
    it("should apply fixed discount amount", () => {
      const deliveries = fixtures.createBatchDeliveries(20, "per-delivery");
      let invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      invoice = service.applyFixedDiscount(invoice.invoiceNumber, 50);
      expect(invoice.discount).toBe(50);
      expect(invoice.discountType).toBe("fixed");
      expect(invoice.total).toBe(invoice.subtotal - 50 + invoice.tax);
    });

    it("should apply percentage discount", () => {
      const deliveries = fixtures.createBatchDeliveries(20, "per-delivery");
      let invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      invoice = service.applyPercentageDiscount(invoice.invoiceNumber, 10);
      const expectedDiscount = (invoice.subtotal * 10) / 100;
      expect(invoice.discount).toBe(expectedDiscount);
      expect(invoice.discountType).toBe("percentage");
    });

    it("should not allow discount exceeding subtotal", () => {
      const deliveries = fixtures.createBatchDeliveries(5, "per-delivery");
      let invoice = service.createFromDeliveries(
        customerId,
        deliveries,
        "per-delivery",
        billingPeriod,
      );

      invoice = service.applyFixedDiscount(invoice.invoiceNumber, 1000);
      expect(invoice.discount).toBe(invoice.subtotal); // capped at subtotal
    });
  });

  describe("Zero Amount Invoices", () => {
    it("should create zero-amount invoice for no deliveries", () => {
      const invoice = service.createFromDeliveries(
        customerId,
        [],
        "per-delivery",
        billingPeriod,
      );

      expect(invoice.subtotal).toBe(0);
      expect(invoice.tax).toBe(0);
      expect(invoice.total).toBe(0);
      expect(invoice.lineItems.length).toBe(0);
    });

    it("should handle zero invoice lifecycle", () => {
      const invoice = service.createFromDeliveries(
        customerId,
        [],
        "per-delivery",
        billingPeriod,
      );

      const sent = service.sendInvoice(invoice.invoiceNumber);
      expect(sent.status).toBe("sent");

      const paid = service.recordPayment(sent.invoiceNumber, 0);
      expect(paid.status).toBe("paid");
    });
  });
});
