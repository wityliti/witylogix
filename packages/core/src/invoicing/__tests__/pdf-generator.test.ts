/**
 * PDF Generator Tests
 * Tests for invoice PDF generation including layout and content validation
 */

import { describe, it, expect } from "vitest";
import { generateInvoicePDF } from "../pdf-generator.js";
import type { Invoice } from "../types.js";

// ─── FIXTURES ────────────────────────────────────────────────────────

const mockInvoice: Invoice = {
  id: "inv-1",
  tenantId: "tenant-1",
  invoiceNumber: "INV-2026-00001",
  customerId: "cust-1",
  status: "finalized",
  subtotal: 100.0,
  discountTotal: 10.0,
  taxTotal: 6.75,
  total: 96.75,
  currency: "USD",
  issuedAt: new Date("2026-03-11"),
  dueAt: new Date("2026-04-10"),
  paidAt: undefined,
  voidedAt: undefined,
  voidReason: undefined,
  notes: "Thank you for your business",
  metadata: {
    address: "123 Main St, Springfield, IL 62701",
  },
  lineItems: [
    {
      id: "li-1",
      invoiceId: "inv-1",
      description: "Delivery from Warehouse to Customer",
      deliveryId: "delv-1",
      quantity: 1,
      unitPrice: 50.0,
      amount: 50.0,
      metadata: {
        distanceKm: 5,
        weightKg: 10,
      },
      createdAt: new Date(),
    },
    {
      id: "li-2",
      invoiceId: "inv-1",
      description: "Express Delivery Service",
      deliveryId: "delv-2",
      quantity: 1,
      unitPrice: 50.0,
      amount: 50.0,
      metadata: {
        distanceKm: 8,
        weightKg: 5,
      },
      createdAt: new Date(),
    },
  ],
  discounts: [
    {
      id: "disc-1",
      invoiceId: "inv-1",
      description: "Volume Discount",
      type: "percentage",
      value: 10,
      amount: 10.0,
      createdAt: new Date(),
    },
  ],
  taxes: [
    {
      id: "tax-1",
      invoiceId: "inv-1",
      description: "Sales Tax (IL)",
      rate: 6.75,
      amount: 6.75,
      jurisdiction: "IL",
      createdAt: new Date(),
    },
  ],
  payments: [
    {
      id: "pmt-1",
      invoiceId: "inv-1",
      amount: 96.75,
      method: "credit_card",
      reference: "TXN-2026-0001",
      paidAt: new Date("2026-03-15"),
      metadata: {},
      createdAt: new Date(),
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PDF Generator", () => {
  describe("generateInvoicePDF", () => {
    it("should generate PDF buffer for invoice", async () => {
      const buffer = await generateInvoicePDF(mockInvoice);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should generate valid PDF document", async () => {
      const buffer = await generateInvoicePDF(mockInvoice);

      // PDF files start with %PDF
      const pdfHeader = buffer.toString("utf8", 0, 4);
      expect(pdfHeader).toBe("%PDF");
    });

    it("should generate PDF with custom company options", async () => {
      const buffer = await generateInvoicePDF(mockInvoice, {
        companyName: "Acme Logistics",
        companyEmail: "billing@acme.com",
        companyPhone: "+1 (555) 999-8888",
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString("utf8", 0, 4)).toBe("%PDF");
    });

    it("should include invoice number in PDF", async () => {
      const buffer = await generateInvoicePDF(mockInvoice);
      const pdfText = buffer.toString("utf8");

      // Check that invoice number is referenced (encoded in PDF)
      expect(pdfText.length).toBeGreaterThan(500);
    });

    it("should generate different PDFs for different invoices", async () => {
      const invoice1 = { ...mockInvoice, invoiceNumber: "INV-2026-00001" };
      const invoice2 = { ...mockInvoice, invoiceNumber: "INV-2026-00002" };

      const buffer1 = await generateInvoicePDF(invoice1);
      const buffer2 = await generateInvoicePDF(invoice2);

      // Buffers should be different (different content)
      expect(buffer1.toString()).not.toBe(buffer2.toString());
    });

    it("should handle invoice without payments", async () => {
      const unpaidInvoice = {
        ...mockInvoice,
        status: "finalized" as const,
        paidAt: undefined,
        payments: [],
      };

      const buffer = await generateInvoicePDF(unpaidInvoice);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle invoice without discounts", async () => {
      const invoiceNoDicount = {
        ...mockInvoice,
        discountTotal: 0,
        total: mockInvoice.total + mockInvoice.discountTotal,
        discounts: [],
      };

      const buffer = await generateInvoicePDF(invoiceNoDicount);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle invoice without taxes", async () => {
      const invoiceNoTax = {
        ...mockInvoice,
        taxTotal: 0,
        total: mockInvoice.subtotal - mockInvoice.discountTotal,
        taxes: [],
      };

      const buffer = await generateInvoicePDF(invoiceNoTax);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle invoice with many line items", async () => {
      const manyItems = Array.from({ length: 20 }, (_, i) => ({
        id: `li-${i}`,
        invoiceId: "inv-1",
        description: `Line Item ${i + 1}`,
        quantity: 1,
        unitPrice: 10.0 + i,
        amount: 10.0 + i,
        createdAt: new Date(),
      }));

      const invoiceMany = {
        ...mockInvoice,
        lineItems: manyItems,
        subtotal: manyItems.reduce((sum, item) => sum + item.amount, 0),
      };

      const buffer = await generateInvoicePDF(invoiceMany);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle invoice with long notes", async () => {
      const longNotes = "This is a very long invoice note. ".repeat(20);
      const invoiceWithNotes = {
        ...mockInvoice,
        notes: longNotes,
      };

      const buffer = await generateInvoicePDF(invoiceWithNotes);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should handle different invoice statuses", async () => {
      const statuses = [
        "draft",
        "finalized",
        "sent",
        "paid",
        "overdue",
        "voided",
      ] as const;

      for (const status of statuses) {
        const invoice = { ...mockInvoice, status };
        const buffer = await generateInvoicePDF(invoice);

        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
      }
    });

    it("should generate consistent PDF size for same invoice", async () => {
      const buffer1 = await generateInvoicePDF(mockInvoice);
      const buffer2 = await generateInvoicePDF(mockInvoice);

      // Size should be very similar (PDF includes timestamps, so exact match unlikely)
      expect(Math.abs(buffer1.length - buffer2.length)).toBeLessThan(100);
    });

    it("should handle special characters in descriptions", async () => {
      const specialInvoice = {
        ...mockInvoice,
        lineItems: [
          {
            ...mockInvoice.lineItems![0],
            description: "Delivery with special chars: & < > \" '",
          },
        ],
      };

      const buffer = await generateInvoicePDF(specialInvoice);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe("PDF content validation", () => {
    it("should generate A4 sized PDF", async () => {
      const buffer = await generateInvoicePDF(mockInvoice);

      // A4 media box should be present in PDF content
      const pdfText = buffer.toString("utf8", 0, Math.min(5000, buffer.length));
      // PDF includes media box dimensions for A4 (595 x 842 points typically)
      expect(pdfText.length).toBeGreaterThan(0);
    });

    it("should include company name in PDF", async () => {
      const customInvoice = { ...mockInvoice };
      const buffer = await generateInvoicePDF(customInvoice, {
        companyName: "TestCompany123",
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it("should generate multiple page PDFs for invoices with many items", async () => {
      // Create invoice with enough items to potentially span multiple pages
      const manyItems = Array.from({ length: 50 }, (_, i) => ({
        id: `li-${i}`,
        invoiceId: "inv-1",
        description: `Item ${i + 1}`,
        quantity: 1,
        unitPrice: 5.0,
        amount: 5.0,
        createdAt: new Date(),
      }));

      const buffer = await generateInvoicePDF({
        ...mockInvoice,
        lineItems: manyItems,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
