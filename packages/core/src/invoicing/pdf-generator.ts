/**
 * Invoice PDF Generator
 * Generates professional PDF invoices with company branding, itemization, and payment terms.
 * Uses pdfkit for layout control and PDF rendering.
 */

import PDFDocument from "pdfkit";
import type { Invoice } from "./types.js";

interface PDFGeneratorOptions {
  companyName: string;
  companyLogo?: string; // Base64 encoded or file path
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  primaryColor?: string; // Hex color for headers
  secondaryColor?: string;
}

const DEFAULT_OPTIONS: Required<Omit<PDFGeneratorOptions, "companyLogo">> = {
  companyName: "Witylogix",
  companyAddress: "123 Main St, San Francisco, CA 94105",
  companyPhone: "+1 (555) 123-4567",
  companyEmail: "billing@witylogix.com",
  companyWebsite: "www.witylogix.com",
  primaryColor: "#2563EB",
  secondaryColor: "#E5E7EB",
};

/**
 * Generate a professional PDF invoice document
 * @param invoice - Invoice data with line items, discounts, taxes
 * @param options - Company branding options
 * @returns Buffer - PDF document as Buffer for storage or transmission
 */
export async function generateInvoicePDF(
  invoice: Invoice,
  options?: Partial<PDFGeneratorOptions>,
): Promise<Buffer> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    try {
      // Create PDF document (A4 size)
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", (err: Error) => {
        reject(err);
      });

      // ─── HEADER SECTION ─────────────────────────────────────────────
      drawHeader(doc, config, invoice);

      doc.moveDown(0.5);

      // ─── INVOICE DETAILS ────────────────────────────────────────────
      drawInvoiceDetails(doc, invoice);

      doc.moveDown(0.5);

      // ─── BILL TO / SHIP TO ──────────────────────────────────────────
      drawBillToShipTo(doc, invoice);

      doc.moveDown(0.5);

      // ─── LINE ITEMS TABLE ───────────────────────────────────────────
      drawLineItemsTable(doc, invoice);

      doc.moveDown(0.3);

      // ─── TOTALS SECTION ─────────────────────────────────────────────
      drawTotalsSection(doc, invoice);

      doc.moveDown(0.5);

      // ─── PAYMENT TERMS & NOTES ──────────────────────────────────────
      drawPaymentTerms(doc, invoice, config);

      doc.moveDown(0.5);

      // ─── FOOTER ─────────────────────────────────────────────────────
      drawFooter(doc, config);

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Draw the header section with company info and invoice title
 */
function drawHeader(
  doc: PDFKit.PDFDocument,
  config: Required<Omit<PDFGeneratorOptions, "companyLogo">>,
  invoice: Invoice,
): void {
  const pageWidth = doc.page.width;
  const pageMargin = 40;
  const contentWidth = pageWidth - 2 * pageMargin;

  // Company name (large)
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text(config.companyName, {
      width: contentWidth * 0.6,
    });

  // Invoice title (right-aligned)
  doc
    .fontSize(16)
    .font("Helvetica")
    .text("INVOICE", pageMargin + contentWidth * 0.6, doc.y - 25, {
      align: "right",
      width: contentWidth * 0.4,
    });

  doc.moveDown(1);

  // Company contact info (smaller)
  doc.fontSize(10).font("Helvetica").fillColor("#666666");
  if (config.companyAddress) {
    doc.text(config.companyAddress);
  }
  if (config.companyPhone) {
    doc.text(`Phone: ${config.companyPhone}`);
  }
  if (config.companyEmail) {
    doc.text(`Email: ${config.companyEmail}`);
  }

  doc.fillColor("#000000");
}

/**
 * Draw invoice number, date, and due date
 */
function drawInvoiceDetails(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  const pageWidth = doc.page.width;
  const pageMargin = 40;
  const contentWidth = pageWidth - 2 * pageMargin;
  const rightX = pageMargin + contentWidth * 0.5;

  const y = doc.y;

  // Left column
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Invoice Number:", pageMargin, y);
  doc.font("Helvetica").text(invoice.invoiceNumber, pageMargin, y + 15);

  doc.font("Helvetica-Bold").text("Invoice Date:", pageMargin, y + 35);
  doc.font("Helvetica").text(formatDate(invoice.issuedAt), pageMargin, y + 50);

  // Right column
  doc.fontSize(10).font("Helvetica-Bold").text("Due Date:", rightX, y);
  doc.font("Helvetica").text(formatDate(invoice.dueAt), rightX, y + 15);

  doc.font("Helvetica-Bold").text("Status:", rightX, y + 35);
  doc
    .font("Helvetica")
    .fillColor(getStatusColor(invoice.status))
    .text(invoice.status.toUpperCase(), rightX, y + 50);

  doc.fillColor("#000000");
  doc.moveDown(4);
}

/**
 * Draw bill to and ship to sections
 */
function drawBillToShipTo(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  const pageWidth = doc.page.width;
  const pageMargin = 40;
  const contentWidth = pageWidth - 2 * pageMargin;
  const colWidth = (contentWidth - 20) / 2;

  const y = doc.y;

  // Bill To
  doc.fontSize(11).font("Helvetica-Bold").text("Bill To:", pageMargin, y);
  doc.fontSize(10).font("Helvetica");

  if (invoice.customerId) {
    doc.text(`Customer ID: ${invoice.customerId}`);
  }

  // Ship To (same as bill to for now, since metadata would contain address)
  const leftCol = pageMargin;
  const rightCol = pageMargin + colWidth + 20;

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Delivery Address:", rightCol, y);
  doc.fontSize(10).font("Helvetica");
  doc.text(
    invoice.metadata?.address || "See attached delivery details",
    rightCol,
    doc.y,
  );

  doc.moveDown(2);
}

/**
 * Draw line items table with headers and rows
 */
function drawLineItemsTable(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  const pageWidth = doc.page.width;
  const pageMargin = 40;
  const contentWidth = pageWidth - 2 * pageMargin;

  // Table headers
  const headerY = doc.y;
  const colWidths = {
    description: contentWidth * 0.45,
    qty: contentWidth * 0.12,
    unitPrice: contentWidth * 0.18,
    amount: contentWidth * 0.18,
  };

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#2563EB");
  doc.rect(pageMargin, headerY, contentWidth, 20).fill("#E0E7FF");

  doc.fillColor("#000000").text("Description", pageMargin + 5, headerY + 5, {
    width: colWidths.description,
  });
  doc.text("Qty", pageMargin + colWidths.description + 5, headerY + 5, {
    width: colWidths.qty,
    align: "right",
  });
  doc.text(
    "Unit Price",
    pageMargin + colWidths.description + colWidths.qty + 5,
    headerY + 5,
    {
      width: colWidths.unitPrice,
      align: "right",
    },
  );
  doc.text(
    "Amount",
    pageMargin +
      colWidths.description +
      colWidths.qty +
      colWidths.unitPrice +
      5,
    headerY + 5,
    {
      width: colWidths.amount,
      align: "right",
    },
  );

  doc.moveDown(1.5);

  // Line items
  if (invoice.lineItems && invoice.lineItems.length > 0) {
    invoice.lineItems.forEach((item) => {
      const y = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor("#000000");

      doc.text(item.description, pageMargin + 5, y, {
        width: colWidths.description - 5,
        ellipsis: true,
      });

      doc.text(
        item.quantity.toFixed(2),
        pageMargin + colWidths.description + 5,
        y,
        {
          width: colWidths.qty,
          align: "right",
        },
      );

      doc.text(
        `$${item.unitPrice.toFixed(2)}`,
        pageMargin + colWidths.description + colWidths.qty + 5,
        y,
        {
          width: colWidths.unitPrice,
          align: "right",
        },
      );

      doc.text(
        `$${item.amount.toFixed(2)}`,
        pageMargin +
          colWidths.description +
          colWidths.qty +
          colWidths.unitPrice +
          5,
        y,
        {
          width: colWidths.amount,
          align: "right",
        },
      );

      doc.moveDown(1);
    });
  }
}

/**
 * Draw totals, discounts, and taxes
 */
function drawTotalsSection(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  const pageWidth = doc.page.width;
  const pageMargin = 40;
  const contentWidth = pageWidth - 2 * pageMargin;
  const rightX = pageMargin + contentWidth * 0.6;
  const amountX = pageMargin + contentWidth * 0.9;

  doc.fontSize(9).font("Helvetica");

  // Subtotal
  doc.text("Subtotal:", rightX, doc.y, { width: contentWidth * 0.2 });
  doc.text(`$${invoice.subtotal.toFixed(2)}`, amountX, doc.y - 11, {
    align: "right",
    width: contentWidth * 0.1,
  });
  doc.moveDown(0.5);

  // Discounts
  if (invoice.discountTotal > 0) {
    if (invoice.discounts && invoice.discounts.length > 0) {
      invoice.discounts.forEach((discount) => {
        doc.fontSize(8).fillColor("#666666");
        doc.text(`  ${discount.description}:`, rightX, doc.y, {
          width: contentWidth * 0.2,
        });
        doc.text(`-$${discount.amount.toFixed(2)}`, amountX, doc.y - 10, {
          align: "right",
          width: contentWidth * 0.1,
        });
        doc.moveDown(0.4);
      });
    }
  }

  doc.fillColor("#000000");

  // Taxes
  if (invoice.taxes && invoice.taxes.length > 0) {
    invoice.taxes.forEach((tax) => {
      doc.fontSize(9).font("Helvetica");
      doc.text(`${tax.description}:`, rightX, doc.y, {
        width: contentWidth * 0.2,
      });
      doc.text(`$${tax.amount.toFixed(2)}`, amountX, doc.y - 11, {
        align: "right",
        width: contentWidth * 0.1,
      });
      doc.moveDown(0.5);
    });
  }

  // Total (emphasized)
  doc.fontSize(11).font("Helvetica-Bold");
  doc
    .rect(pageMargin + contentWidth * 0.55, doc.y - 5, contentWidth * 0.45, 20)
    .fill("#2563EB");
  doc.fillColor("#FFFFFF");
  doc.text("Total:", rightX + 5, doc.y, { width: contentWidth * 0.15 });
  doc.text(
    `${invoice.currency} $${invoice.total.toFixed(2)}`,
    amountX + 5,
    doc.y - 11,
    {
      align: "right",
      width: contentWidth * 0.1,
    },
  );

  doc.fillColor("#000000");
  doc.moveDown(1.5);
}

/**
 * Draw payment terms and notes
 */
function drawPaymentTerms(
  doc: PDFKit.PDFDocument,
  invoice: Invoice,
  config: Required<Omit<PDFGeneratorOptions, "companyLogo">>,
): void {
  const pageMargin = 40;

  doc.fontSize(10).font("Helvetica-Bold").text("Payment Terms:");
  doc.fontSize(9).font("Helvetica");
  doc.text(`Due by: ${formatDate(invoice.dueAt)}`);
  doc.text(`Please reference Invoice #${invoice.invoiceNumber} with payment`);
  doc.text(`Make checks payable to: ${config.companyName}`);

  if (invoice.notes) {
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica-Bold").text("Notes:");
    doc.fontSize(9).font("Helvetica").text(invoice.notes);
  }

  if (invoice.paidAt) {
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor("#28A745").font("Helvetica-Bold");
    doc.text(`Paid on: ${formatDate(invoice.paidAt)}`);
    doc.fillColor("#000000");
  }
}

/**
 * Draw footer with company info and page number
 */
function drawFooter(
  doc: PDFKit.PDFDocument,
  config: Required<Omit<PDFGeneratorOptions, "companyLogo">>,
): void {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const pageMargin = 40;

  doc.fontSize(8).fillColor("#999999").font("Helvetica");

  const footerText = `${config.companyEmail} | ${config.companyWebsite}`;
  doc.text(footerText, pageMargin, pageHeight - 40, {
    align: "center",
    width: pageWidth - 2 * pageMargin,
  });

  doc.text(
    `Generated on ${formatDate(new Date())}`,
    pageMargin,
    pageHeight - 25,
    {
      align: "center",
      width: pageWidth - 2 * pageMargin,
    },
  );
}

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Get color code for invoice status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "#28A745"; // Green
    case "overdue":
      return "#DC3545"; // Red
    case "sent":
      return "#007BFF"; // Blue
    case "draft":
      return "#6C757D"; // Gray
    case "voided":
      return "#999999"; // Light gray
    default:
      return "#000000"; // Black
  }
}
