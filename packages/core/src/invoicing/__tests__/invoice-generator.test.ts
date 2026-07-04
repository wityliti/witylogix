/**
 * Invoice Generator Tests
 * Comprehensive test suite for invoice generation, lifecycle, and calculations
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InvoiceGenerator,
  createInvoiceGeneratorConfig,
  BillingRuleEngine,
  createBillingRule,
  createTier,
  type Invoice,
  type BillingContext,
} from "../index.js";

describe("InvoiceGenerator", () => {
  let generator: InvoiceGenerator;

  beforeEach(() => {
    generator = new InvoiceGenerator();
  });

  describe("generateInvoice", () => {
    it("should generate invoice from delivery contexts", async () => {
      const config = createInvoiceGeneratorConfig(
        "tenant-1",
        new Date("2026-01-01"),
        new Date("2026-01-31"),
        [
          createBillingRule(
            "rule-1",
            "tenant-1",
            "Per Delivery Charge",
            "per-delivery",
            {
              baseAmount: 50,
              isActive: true,
            },
          ),
        ],
        { customerId: "cust-1" },
      );

      const deliveryContexts: BillingContext[] = [
        {
          deliveryId: "del-1",
          customerId: "cust-1",
          distance: 10,
          weight: 5,
          duration: 1,
          pickupTime: new Date("2026-01-15T08:00:00Z"),
        },
      ];

      const invoice = await generator.generateInvoice(config, deliveryContexts);

      expect(invoice.tenantId).toBe("tenant-1");
      expect(invoice.customerId).toBe("cust-1");
      expect(invoice.status).toBe("draft");
      expect(invoice.currency).toBe("USD");
      expect(invoice.lineItems).toHaveLength(1);
      expect(invoice.subtotal).toBe(50);
      expect(invoice.total).toBe(50);
    });

    it("should calculate line items from billing rules", async () => {
      const config = createInvoiceGeneratorConfig(
        "tenant-1",
        new Date("2026-01-01"),
        new Date("2026-01-31"),
        [
          createBillingRule(
            "rule-1",
            "tenant-1",
            "Per Mile Charge",
            "per-mile",
            {
              unitRate: 2.5,
              isActive: true,
            },
          ),
          createBillingRule(
            "rule-2",
            "tenant-1",
            "Per Kilogram Charge",
            "per-kg",
            {
              unitRate: 0.5,
              isActive: true,
            },
          ),
        ],
      );

      const deliveryContexts: BillingContext[] = [
        {
          deliveryId: "del-1",
          distance: 20, // 20 miles
          weight: 10, // 10 kg
          pickupTime: new Date("2026-01-15T08:00:00Z"),
        },
      ];

      const invoice = await generator.generateInvoice(config, deliveryContexts);

      // Per mile: 20 * 2.5 = 50
      // Per kg: 10 * 0.5 = 5
      // Total: 55
      expect(invoice.subtotal).toBe(55);
      expect(invoice.lineItems).toHaveLength(2);
    });

    it("should apply discounts correctly", async () => {
      const config = createInvoiceGeneratorConfig(
        "tenant-1",
        new Date("2026-01-01"),
        new Date("2026-01-31"),
        [
          createBillingRule(
            "rule-1",
            "tenant-1",
            "Base Charge",
            "per-delivery",
            {
              baseAmount: 100,
              isActive: true,
            },
          ),
        ],
        {
          discounts: [
            { type: "percentage", value: 10, description: "Volume Discount" },
            { type: "fixed", value: 5, description: "Early Payment Discount" },
          ],
        },
      );

      const invoice = await generator.generateInvoice(config, [
        {
          deliveryId: "del-1",
          pickupTime: new Date("2026-01-15T08:00:00Z"),
        },
      ]);

      // Subtotal: 100
      // 10% discount: 10
      // Fixed discount: 5
      // Total discount: 15
      // Final: 85
      expect(invoice.discountTotal).toBe(15);
      expect(invoice.total).toBe(85);
    });

    it("should calculate taxes on subtotal", async () => {
      const config = createInvoiceGeneratorConfig(
        "tenant-1",
        new Date("2026-01-01"),
        new Date("2026-01-31"),
        [
          createBillingRule(
            "rule-1",
            "tenant-1",
            "Base Charge",
            "per-delivery",
            {
              baseAmount: 100,
              isActive: true,
            },
          ),
        ],
        {
          taxConfig: [
            { jurisdiction: "US-CA", rate: 7.5 },
            { jurisdiction: "US-CA-COUNTY", rate: 0.5 },
          ],
        },
      );

      const invoice = await generator.generateInvoice(config, [
        {
          deliveryId: "del-1",
          pickupTime: new Date("2026-01-15T08:00:00Z"),
        },
      ]);

      // Tax: 100 * (7.5 + 0.5) / 100 = 8
      expect(invoice.taxTotal).toBe(8);
      expect(invoice.total).toBe(108);
      expect(invoice.taxes).toHaveLength(2);
    });

    it("should set default due date to 30 days from now", async () => {
      const config = createInvoiceGeneratorConfig(
        "tenant-1",
        new Date("2026-01-01"),
        new Date("2026-01-31"),
        [
          createBillingRule("rule-1", "tenant-1", "Charge", "per-delivery", {
            baseAmount: 50,
            isActive: true,
          }),
        ],
      );

      const invoice = await generator.generateInvoice(config, [
        { deliveryId: "del-1" },
      ]);

      const expectedDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expect(invoice.dueAt.getDate()).toBe(expectedDueDate.getDate());
    });

    it("should use custom due date when provided", async () => {
      const config = createInvoiceGeneratorConfig(
        "tenant-1",
        new Date("2026-01-01"),
        new Date("2026-01-31"),
        [
          createBillingRule("rule-1", "tenant-1", "Charge", "per-delivery", {
            baseAmount: 50,
            isActive: true,
          }),
        ],
      );

      const customDueDate = new Date("2026-02-28");
      const invoice = await generator.generateInvoice(
        config,
        [{ deliveryId: "del-1" }],
        {
          dueDate: customDueDate,
        },
      );

      expect(invoice.dueAt.toISOString().split("T")[0]).toBe("2026-02-28");
    });

    it("should include metadata in invoice", async () => {
      const config = createInvoiceGeneratorConfig(
        "tenant-1",
        new Date("2026-01-01"),
        new Date("2026-01-31"),
        [
          createBillingRule("rule-1", "tenant-1", "Charge", "per-delivery", {
            baseAmount: 50,
            isActive: true,
          }),
        ],
      );

      const invoice = await generator.generateInvoice(
        config,
        [{ deliveryId: "del-1" }],
        {
          metadata: { customField: "value" },
        },
      );

      expect(invoice.metadata).toHaveProperty("billingPeriodStart");
      expect(invoice.metadata).toHaveProperty("billingPeriodEnd");
      expect(invoice.metadata).toHaveProperty("deliveryCount");
      expect(invoice.metadata).toHaveProperty("customField");
    });
  });

  describe("finalizeInvoice", () => {
    it("should finalize draft invoice with number", async () => {
      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "",
        status: "draft",
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

      const finalized = await generator.finalizeInvoice(
        invoice,
        "INV-2026-00001",
      );

      expect(finalized.invoiceNumber).toBe("INV-2026-00001");
      expect(finalized.status).toBe("finalized");
    });

    it("should throw error when finalizing non-draft invoice", async () => {
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

      await expect(
        generator.finalizeInvoice(invoice, "INV-2026-00002"),
      ).rejects.toThrow();
    });
  });

  describe("markAsSent", () => {
    it("should mark finalized invoice as sent", async () => {
      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "finalized",
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

      const sent = await generator.markAsSent(invoice);

      expect(sent.status).toBe("sent");
    });

    it("should throw error when sending draft invoice", async () => {
      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "",
        status: "draft",
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

      await expect(generator.markAsSent(invoice)).rejects.toThrow(
        "Cannot send draft invoice",
      );
    });
  });

  describe("markAsPaid", () => {
    it("should mark invoice as paid when full payment received", async () => {
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

      const paid = await generator.markAsPaid(invoice, 110);

      expect(paid.status).toBe("paid");
      expect(paid.paidAt).not.toBeUndefined();
    });

    it("should keep sent status for partial payment", async () => {
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
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const partial = await generator.markAsPaid(invoice, 50);

      expect(partial.status).toBe("sent");
    });
  });

  describe("voidInvoice", () => {
    it("should void invoice with reason", async () => {
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

      const voided = await generator.voidInvoice(invoice, "Duplicate invoice");

      expect(voided.status).toBe("voided");
      expect(voided.voidReason).toBe("Duplicate invoice");
      expect(voided.voidedAt).not.toBeUndefined();
    });

    it("should throw error when voiding already voided invoice", async () => {
      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "voided",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        voidedAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(generator.voidInvoice(invoice)).rejects.toThrow(
        "already voided",
      );
    });
  });

  describe("getInvoiceAging", () => {
    it("should return 0 for paid invoices", () => {
      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "paid",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        paidAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(generator.getInvoiceAging(invoice)).toBe(0);
    });

    it("should calculate days overdue", () => {
      const dueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "overdue",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 10,
        total: 110,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: dueDate,
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const aging = generator.getInvoiceAging(invoice);
      expect(aging).toBeGreaterThanOrEqual(9);
      expect(aging).toBeLessThanOrEqual(10);
    });
  });

  describe("getPaymentBalance", () => {
    it("should calculate remaining balance", () => {
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
        payments: [
          {
            id: "pay-1",
            invoiceId: "inv-1",
            amount: 40,
            method: "bank_transfer",
            paidAt: new Date(),
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(generator.getPaymentBalance(invoice)).toBe(70);
    });
  });

  describe("canEdit", () => {
    it("should allow editing draft invoices", () => {
      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "",
        status: "draft",
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

      expect(generator.canEdit(invoice)).toBe(true);
    });

    it("should not allow editing finalized invoices", () => {
      const invoice: Invoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "finalized",
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

      expect(generator.canEdit(invoice)).toBe(false);
    });
  });

  describe("calculateInvoiceSummary", () => {
    it("should summarize multiple invoices", () => {
      const invoices: Invoice[] = [
        {
          id: "inv-1",
          tenantId: "tenant-1",
          invoiceNumber: "INV-2026-00001",
          status: "paid",
          subtotal: 100,
          discountTotal: 0,
          taxTotal: 10,
          total: 110,
          currency: "USD",
          issuedAt: new Date(),
          dueAt: new Date(),
          paidAt: new Date(),
          lineItems: [],
          discounts: [],
          taxes: [],
          payments: [
            {
              id: "pay-1",
              invoiceId: "inv-1",
              amount: 110,
              method: "bank_transfer",
              paidAt: new Date(),
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "inv-2",
          tenantId: "tenant-1",
          invoiceNumber: "INV-2026-00002",
          status: "sent",
          subtotal: 200,
          discountTotal: 0,
          taxTotal: 20,
          total: 220,
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

      const summary = generator.calculateInvoiceSummary(invoices);

      expect(summary.totalCount).toBe(2);
      expect(summary.totalAmount).toBe(330);
      expect(summary.paidAmount).toBe(110);
      expect(summary.outstandingAmount).toBe(220);
      expect(summary.byStatus.paid).toBe(1);
      expect(summary.byStatus.sent).toBe(1);
    });
  });
});
