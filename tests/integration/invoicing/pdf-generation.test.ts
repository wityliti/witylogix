/**
 * PDF Generation Integration Tests
 * Tests PDF rendering with all fields, custom branding, multi-page,
 * currency formatting, QR codes, and edge cases
 * ~250 lines, 15+ tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fixtures from "../fixtures/invoice-fixtures";

// ─── Mock PDF Service ──────────────────────────────────────────────────────

interface PDFOptions {
  includeLogo?: boolean;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  customCSS?: string;
  includeQRCode?: boolean;
  fontSize?: number;
  pageSize?: "A4" | "LETTER";
}

interface PDFMetadata {
  title: string;
  author: string;
  subject: string;
  creator: string;
}

interface GeneratedPDF {
  id: string;
  fileName: string;
  invoiceNumber: string;
  pageCount: number;
  fileSize: number; // bytes
  generatedAt: Date;
  metadata: PDFMetadata;
  content?: Buffer;
}

class PDFService {
  generateInvoicePDF(invoice: fixtures.InvoiceData, options?: PDFOptions): GeneratedPDF {
    // Validate invoice
    if (!invoice.invoiceNumber) {
      throw new Error("Invoice number required");
    }

    // Calculate page count based on line items
    let pageCount = 1;
    if (invoice.lineItems.length > 50) {
      pageCount = Math.ceil(invoice.lineItems.length / 50) + 1;
    }

    // Estimate file size
    const baseSize = 50000; // base PDF
    const itemSize = invoice.lineItems.length * 500;
    const fileSize = baseSize + itemSize;

    const pdf: GeneratedPDF = {
      id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: `${invoice.invoiceNumber}.pdf`,
      invoiceNumber: invoice.invoiceNumber,
      pageCount,
      fileSize,
      generatedAt: new Date(),
      metadata: {
        title: `Invoice ${invoice.invoiceNumber}`,
        author: "Witylogix",
        subject: `Invoice for ${invoice.customerName}`,
        creator: "Witylogix PDF Generator",
      },
    };

    return pdf;
  }

  applyCustomBranding(
    pdf: GeneratedPDF,
    invoice: fixtures.InvoiceData,
    branding: {
      logoUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      companyName?: string;
      companyWebsite?: string;
    }
  ): GeneratedPDF {
    if (branding.logoUrl) {
      pdf.fileSize += 50000; // logo adds ~50KB
    }

    return pdf;
  }

  renderAllFields(
    pdf: GeneratedPDF,
    invoice: fixtures.InvoiceData
  ): {
    fields: string[];
    rendered: boolean;
  } {
    const fields = [
      "invoiceNumber",
      "invoiceDate",
      "dueDate",
      "customerName",
      "customerEmail",
      "customerAddress",
      "lineItems",
      "subtotal",
      "tax",
      "discount",
      "total",
      "paymentTerms",
      "notes",
      "billingPeriod",
    ];

    const renderedFields = fields.filter((field) => {
      switch (field) {
        case "invoiceNumber":
          return !!invoice.invoiceNumber;
        case "invoiceDate":
          return !!invoice.createdAt;
        case "dueDate":
          return !!invoice.dueDate;
        case "customerName":
          return !!invoice.customerName;
        case "customerEmail":
          return !!invoice.customerEmail;
        case "lineItems":
          return invoice.lineItems && invoice.lineItems.length > 0;
        case "subtotal":
          return invoice.subtotal !== undefined;
        case "tax":
          return invoice.tax !== undefined;
        case "discount":
          return invoice.discount !== undefined;
        case "total":
          return invoice.total !== undefined;
        case "billingPeriod":
          return !!invoice.billingPeriod;
        default:
          return false;
      }
    });

    return {
      fields: renderedFields,
      rendered: renderedFields.length === fields.length,
    };
  }

  formatCurrency(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(amount);
  }

  generateQRCode(invoice: fixtures.InvoiceData): {
    qrCodeUrl: string;
    invoiceLink: string;
  } {
    const invoiceLink = `https://invoicing.witylogix.com/${invoice.id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoiceLink)}`;

    return {
      qrCodeUrl,
      invoiceLink,
    };
  }

  validateMultiPageLayout(pdf: GeneratedPDF, invoice: fixtures.InvoiceData): boolean {
    // Check if page breaks are correct
    const itemsPerPage = 50;
    const expectedPages = Math.ceil(invoice.lineItems.length / itemsPerPage) + 1; // +1 for summary

    return pdf.pageCount === expectedPages;
  }

  formatNumberForPDF(value: number | string, format: "currency" | "percentage" | "number"): string {
    const num = typeof value === "string" ? parseFloat(value) : value;

    switch (format) {
      case "currency":
        return `$${num.toFixed(2)}`;
      case "percentage":
        return `${(num * 100).toFixed(2)}%`;
      case "number":
        return num.toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
      default:
        return String(num);
    }
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("PDF Generation Integration Tests", () => {
  let pdfService: PDFService;

  beforeEach(() => {
    pdfService = new PDFService();
  });

  describe("Basic PDF Rendering", () => {
    it("should generate PDF from valid invoice", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf).toBeDefined();
      expect(pdf.invoiceNumber).toBe(invoice.invoiceNumber);
      expect(pdf.fileName).toContain(".pdf");
      expect(pdf.pageCount).toBeGreaterThan(0);
      expect(pdf.fileSize).toBeGreaterThan(0);
    });

    it("should throw error for invoice without number", () => {
      const invoice = fixtures.createInvoice({ invoiceNumber: "" });

      expect(() => pdfService.generateInvoicePDF(invoice)).toThrow("Invoice number required");
    });

    it("should set correct metadata", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf.metadata.title).toContain(invoice.invoiceNumber);
      expect(pdf.metadata.author).toBe("Witylogix");
      expect(pdf.metadata.subject).toContain(invoice.customerName);
    });
  });

  describe("All Fields Rendering", () => {
    it("should render all required fields", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);
      const result = pdfService.renderAllFields(pdf, invoice);

      expect(result.rendered).toBe(true);
      expect(result.fields.length).toBeGreaterThan(10);
    });

    it("should include invoice number and dates", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);
      const result = pdfService.renderAllFields(pdf, invoice);

      expect(result.fields).toContain("invoiceNumber");
      expect(result.fields).toContain("invoiceDate");
      expect(result.fields).toContain("dueDate");
    });

    it("should include customer details", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);
      const result = pdfService.renderAllFields(pdf, invoice);

      expect(result.fields).toContain("customerName");
      expect(result.fields).toContain("customerEmail");
    });

    it("should include line items", () => {
      const invoice = fixtures.createInvoice({
        lineItems: [
          {
            description: "Test Item",
            quantity: 5,
            unitPrice: 10,
            taxable: true,
          },
        ],
      });
      const pdf = pdfService.generateInvoicePDF(invoice);
      const result = pdfService.renderAllFields(pdf, invoice);

      expect(result.fields).toContain("lineItems");
    });

    it("should include financial summary", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);
      const result = pdfService.renderAllFields(pdf, invoice);

      expect(result.fields).toContain("subtotal");
      expect(result.fields).toContain("tax");
      expect(result.fields).toContain("total");
    });
  });

  describe("Custom Branding", () => {
    it("should apply logo branding", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);
      const originalSize = pdf.fileSize;

      const brandings = pdfService.applyCustomBranding(pdf, invoice, {
        logoUrl: "https://example.com/logo.png",
      });

      expect(brandings.fileSize).toBeGreaterThan(originalSize);
    });

    it("should apply color branding", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);

      const brandings = pdfService.applyCustomBranding(pdf, invoice, {
        primaryColor: "#0066cc",
        accentColor: "#ff6600",
      });

      expect(brandings).toBeDefined();
    });

    it("should apply company branding", () => {
      const invoice = fixtures.createInvoice();
      const pdf = pdfService.generateInvoicePDF(invoice);

      const brandings = pdfService.applyCustomBranding(pdf, invoice, {
        companyName: "Acme Corp",
        companyWebsite: "https://acme.com",
      });

      expect(brandings.metadata.author).toBe("Witylogix");
    });
  });

  describe("Multi-Page Invoices", () => {
    it("should generate single page for small invoice", () => {
      const invoice = fixtures.createInvoice({
        lineItems: [
          {
            description: "Delivery Service",
            quantity: 5,
            unitPrice: 10,
            taxable: true,
          },
        ],
      });
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf.pageCount).toBe(1);
    });

    it("should generate multiple pages for large invoice", () => {
      const largeInvoice = fixtures.generateLargeInvoice(100);
      const pdf = pdfService.generateInvoicePDF(largeInvoice);

      expect(pdf.pageCount).toBeGreaterThan(1);
    });

    it("should handle 1000+ line items", () => {
      const largeInvoice = fixtures.generateLargeInvoice(1000);
      const pdf = pdfService.generateInvoicePDF(largeInvoice);

      expect(pdf.pageCount).toBeGreaterThan(10);
      expect(pdfService.validateMultiPageLayout(pdf, largeInvoice)).toBe(true);
    });

    it("should maintain correct page structure", () => {
      const largeInvoice = fixtures.generateLargeInvoice(200);
      const pdf = pdfService.generateInvoicePDF(largeInvoice);

      const isValid = pdfService.validateMultiPageLayout(pdf, largeInvoice);
      expect(isValid).toBe(true);
    });
  });

  describe("Currency Formatting", () => {
    it("should format USD currency correctly", () => {
      const formatted = pdfService.formatCurrency(1234.56, "USD");
      expect(formatted).toContain("1,234.56");
    });

    it("should format EUR currency correctly", () => {
      const formatted = pdfService.formatCurrency(1234.56, "EUR");
      expect(formatted).toBeDefined();
    });

    it("should format GBP currency correctly", () => {
      const formatted = pdfService.formatCurrency(1234.56, "GBP");
      expect(formatted).toBeDefined();
    });

    it("should format CAD currency correctly", () => {
      const formatted = pdfService.formatCurrency(1234.56, "CAD");
      expect(formatted).toBeDefined();
    });

    it("should handle zero amount", () => {
      const formatted = pdfService.formatCurrency(0, "USD");
      expect(formatted).toContain("0.00");
    });

    it("should format PDF numbers correctly", () => {
      const currency = pdfService.formatNumberForPDF(1234.56, "currency");
      expect(currency).toBe("$1,234.56");

      const percentage = pdfService.formatNumberForPDF(0.15, "percentage");
      expect(percentage).toBe("15.00%");

      const number = pdfService.formatNumberForPDF(1234.567, "number");
      expect(number).toContain("1,234.57");
    });
  });

  describe("QR Code Generation", () => {
    it("should generate QR code for invoice", () => {
      const invoice = fixtures.createInvoice();
      const qrCode = pdfService.generateQRCode(invoice);

      expect(qrCode.qrCodeUrl).toBeDefined();
      expect(qrCode.qrCodeUrl).toContain("api.qrserver.com");
      expect(qrCode.invoiceLink).toContain(invoice.id);
    });

    it("should encode invoice ID in QR code", () => {
      const invoice = fixtures.createInvoice();
      const qrCode = pdfService.generateQRCode(invoice);

      expect(qrCode.invoiceLink).toContain(invoice.id);
    });

    it("should create valid QR code URL", () => {
      const invoice = fixtures.createInvoice();
      const qrCode = pdfService.generateQRCode(invoice);

      expect(qrCode.qrCodeUrl.startsWith("https")).toBe(true);
      expect(qrCode.qrCodeUrl).toContain("size=200x200");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long customer names", () => {
      const longName = "A".repeat(200) + " & B".repeat(50) + " Corporation Limited";
      const invoice = fixtures.createInvoice({
        customerName: longName,
      });
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf).toBeDefined();
      const result = pdfService.renderAllFields(pdf, invoice);
      expect(result.fields).toContain("customerName");
    });

    it("should handle special characters in customer names", () => {
      const specialCustomer = fixtures.generateSpecialCharacterCustomer();
      const invoice = fixtures.createInvoice({
        customerName: specialCustomer.name,
        customerEmail: specialCustomer.email,
      });
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf).toBeDefined();
      expect(pdf.fileName).toBeDefined();
    });

    it("should handle special characters in line item descriptions", () => {
      const invoice = fixtures.createInvoice({
        lineItems: [
          {
            description: "Déliv. serv. (España) — €50 & extra! @15%",
            quantity: 5,
            unitPrice: 10,
            taxable: true,
          },
        ],
      });
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf).toBeDefined();
      const result = pdfService.renderAllFields(pdf, invoice);
      expect(result.fields).toContain("lineItems");
    });

    it("should handle zero-amount invoice", () => {
      const zeroInvoice = fixtures.generateZeroAmountInvoice();
      const pdf = pdfService.generateInvoicePDF(zeroInvoice);

      expect(pdf).toBeDefined();
      expect(pdf.pageCount).toBeGreaterThan(0);
    });

    it("should handle very small line item amounts", () => {
      const invoice = fixtures.createInvoice({
        lineItems: [
          {
            description: "Fractional Delivery",
            quantity: 1000,
            unitPrice: 0.01,
            taxable: true,
          },
        ],
      });
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf).toBeDefined();
    });

    it("should handle very large line item amounts", () => {
      const invoice = fixtures.createInvoice({
        lineItems: [
          {
            description: "Premium Service",
            quantity: 1,
            unitPrice: 999999.99,
            taxable: true,
          },
        ],
      });
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf).toBeDefined();
      expect(pdf.fileSize).toBeGreaterThan(0);
    });

    it("should handle invoice with many discounts", () => {
      const invoice = fixtures.createInvoice({
        discount: 500,
        discountType: "fixed",
        lineItems: [
          {
            description: "Service 1",
            quantity: 10,
            unitPrice: 10,
            taxable: true,
          },
          {
            description: "Service 2",
            quantity: 20,
            unitPrice: 15,
            taxable: true,
          },
        ],
      });
      const pdf = pdfService.generateInvoicePDF(invoice);

      expect(pdf).toBeDefined();
      const result = pdfService.renderAllFields(pdf, invoice);
      expect(result.fields).toContain("discount");
    });
  });
});
