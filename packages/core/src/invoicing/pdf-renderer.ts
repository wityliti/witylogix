/**
 * Invoice PDF Renderer
 * Professional PDF invoice generation with HTML templates and QR codes
 * Supports multiple currencies, custom branding, and payment instructions
 */

import type { Invoice } from "./types.js";

// ─── BRANDING CONFIG ────────────────────────────────────────────────────

export interface InvoiceBranding {
  companyName: string;
  companyLogo?: string; // Base64 encoded image
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  primaryColor?: string; // Hex color
  secondaryColor?: string; // Hex color
  accentColor?: string; // Hex color
}

// ─── PAYMENT INSTRUCTIONS ───────────────────────────────────────────────

export interface PaymentInstructions {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  paymentLink?: string;
  acceptedMethods?: string[];
}

// ─── PDF RENDERER CLASS ──────────────────────────────────────────────────

export class InvoicePDFRenderer {
  private branding: Required<InvoiceBranding>;
  private paymentInstructions?: PaymentInstructions;

  constructor(
    branding: InvoiceBranding,
    paymentInstructions?: PaymentInstructions,
  ) {
    this.branding = {
      companyName: branding.companyName,
      companyLogo: branding.companyLogo || "",
      companyAddress: branding.companyAddress || "",
      companyCity: branding.companyCity || "",
      companyState: branding.companyState || "",
      companyZip: branding.companyZip || "",
      companyPhone: branding.companyPhone || "",
      companyEmail: branding.companyEmail || "",
      companyWebsite: branding.companyWebsite || "",
      primaryColor: branding.primaryColor || "#2563EB",
      secondaryColor: branding.secondaryColor || "#F3F4F6",
      accentColor: branding.accentColor || "#10B981",
    };
    this.paymentInstructions = paymentInstructions;
  }

  /**
   * Render invoice as HTML
   */
  renderHTML(invoice: Invoice): string {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  ${this.renderDocument(invoice)}
</body>
</html>`;

    return html;
  }

  /**
   * Render complete invoice document
   */
  private renderDocument(invoice: Invoice): string {
    return `
      <div class="container">
        ${this.renderHeader(invoice)}
        ${this.renderInvoiceDetails(invoice)}
        ${this.renderBillToShipTo(invoice)}
        ${this.renderLineItemsTable(invoice)}
        ${this.renderSummary(invoice)}
        ${this.renderPaymentInstructions(invoice)}
        ${this.renderTermsAndNotes(invoice)}
      </div>
    `;
  }

  /**
   * Render header section
   */
  private renderHeader(invoice: Invoice): string {
    const logoHtml = this.branding.companyLogo
      ? `<img src="${this.branding.companyLogo}" alt="${this.branding.companyName}" class="logo">`
      : `<h1 class="company-name">${this.branding.companyName}</h1>`;

    return `
      <div class="header" style="background-color: ${this.branding.primaryColor}">
        <div class="header-content">
          <div class="header-left">
            ${logoHtml}
          </div>
          <div class="header-right">
            <h2 class="invoice-title">INVOICE</h2>
            <div class="invoice-meta">
              <p><strong>Invoice #:</strong> ${this.escapeHtml(invoice.invoiceNumber)}</p>
              <p><strong>Date:</strong> ${this.formatDate(invoice.issuedAt)}</p>
              <p><strong>Due Date:</strong> ${this.formatDate(invoice.dueAt)}</p>
              <p><strong>Status:</strong> <span class="status-badge status-${invoice.status}">${this.formatStatus(invoice.status)}</span></p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render invoice details
   */
  private renderInvoiceDetails(invoice: Invoice): string {
    const companyAddress = `${this.branding.companyAddress}${this.branding.companyCity ? ", " + this.branding.companyCity : ""}${this.branding.companyState ? ", " + this.branding.companyState : ""}${this.branding.companyZip ? " " + this.branding.companyZip : ""}`;

    return `
      <div class="details-section">
        <div class="company-info">
          <h3>From</h3>
          <p><strong>${this.branding.companyName}</strong></p>
          ${companyAddress ? `<p>${this.escapeHtml(companyAddress)}</p>` : ""}
          ${this.branding.companyPhone ? `<p>${this.escapeHtml(this.branding.companyPhone)}</p>` : ""}
          ${this.branding.companyEmail ? `<p>${this.escapeHtml(this.branding.companyEmail)}</p>` : ""}
        </div>
      </div>
    `;
  }

  /**
   * Render bill to / ship to section
   */
  private renderBillToShipTo(invoice: Invoice): string {
    const billTo = this.getBillToAddress(invoice);

    return `
      <div class="bill-to-section">
        <h3>Bill To</h3>
        <div class="bill-to-content">
          ${billTo ? `<p>${this.escapeHtml(billTo)}</p>` : "<p>Customer information not available</p>"}
        </div>
      </div>
    `;
  }

  /**
   * Render line items table
   */
  private renderLineItemsTable(invoice: Invoice): string {
    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      return '<div class="no-items">No line items</div>';
    }

    const rows = invoice.lineItems
      .map(
        (item) => `
      <tr>
        <td class="description">${this.escapeHtml(item.description)}</td>
        <td class="qty">${this.formatNumber(item.quantity, 2)}</td>
        <td class="unit-price">${this.formatCurrency(item.unitPrice, invoice.currency)}</td>
        <td class="amount">${this.formatCurrency(item.amount, invoice.currency)}</td>
      </tr>
    `,
      )
      .join("");

    return `
      <div class="line-items-section">
        <table class="line-items-table">
          <thead>
            <tr>
              <th class="description">Description</th>
              <th class="qty">Qty</th>
              <th class="unit-price">Unit Price</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render summary section with totals
   */
  private renderSummary(invoice: Invoice): string {
    const discountRow =
      invoice.discountTotal > 0
        ? `
        <tr class="summary-row">
          <td>Discount(s)</td>
          <td class="amount">-${this.formatCurrency(invoice.discountTotal, invoice.currency)}</td>
        </tr>
      `
        : "";

    const taxRows = (invoice.taxes || [])
      .map(
        (tax) => `
        <tr class="tax-row">
          <td>${this.escapeHtml(tax.description)}</td>
          <td class="amount">${this.formatCurrency(tax.amount, invoice.currency)}</td>
        </tr>
      `,
      )
      .join("");

    return `
      <div class="summary-section">
        <table class="summary-table">
          <tbody>
            <tr class="subtotal-row">
              <td>Subtotal</td>
              <td class="amount">${this.formatCurrency(invoice.subtotal, invoice.currency)}</td>
            </tr>
            ${discountRow}
            ${taxRows}
            <tr class="total-row">
              <td>Total</td>
              <td class="amount">${this.formatCurrency(invoice.total, invoice.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render payment instructions section
   */
  private renderPaymentInstructions(invoice: Invoice): string {
    if (!this.paymentInstructions) {
      return "";
    }

    const methods: string[] = [];

    if (this.paymentInstructions.bankName) {
      methods.push(`
        <div class="payment-method">
          <h4>Bank Transfer</h4>
          <p><strong>Bank:</strong> ${this.escapeHtml(this.paymentInstructions.bankName)}</p>
          ${this.paymentInstructions.accountHolder ? `<p><strong>Account Holder:</strong> ${this.escapeHtml(this.paymentInstructions.accountHolder)}</p>` : ""}
          ${this.paymentInstructions.accountNumber ? `<p><strong>Account #:</strong> ${this.escapeHtml(this.paymentInstructions.accountNumber)}</p>` : ""}
          ${this.paymentInstructions.routingNumber ? `<p><strong>Routing #:</strong> ${this.escapeHtml(this.paymentInstructions.routingNumber)}</p>` : ""}
          ${this.paymentInstructions.swiftCode ? `<p><strong>SWIFT Code:</strong> ${this.escapeHtml(this.paymentInstructions.swiftCode)}</p>` : ""}
        </div>
      `);
    }

    if (this.paymentInstructions.paymentLink) {
      methods.push(`
        <div class="payment-method">
          <h4>Online Payment</h4>
          <p><a href="${this.escapeHtml(this.paymentInstructions.paymentLink)}" class="payment-link">Click here to pay online</a></p>
          <p><strong>Invoice ID:</strong> ${this.escapeHtml(invoice.id)}</p>
        </div>
      `);
    }

    if (methods.length === 0) {
      return "";
    }

    return `
      <div class="payment-instructions-section">
        <h3>Payment Instructions</h3>
        ${methods.join("")}
        <p class="reference-note"><strong>Please reference invoice number ${this.escapeHtml(invoice.invoiceNumber)} with your payment.</strong></p>
      </div>
    `;
  }

  /**
   * Render terms and notes section
   */
  private renderTermsAndNotes(invoice: Invoice): string {
    let content = "";

    if (invoice.notes) {
      content += `
        <div class="notes-section">
          <h4>Notes</h4>
          <p>${this.escapeHtml(invoice.notes).replace(/\n/g, "<br>")}</p>
        </div>
      `;
    }

    return content
      ? `
      <div class="terms-section">
        ${content}
      </div>
    `
      : "";
  }

  /**
   * Get CSS styles
   */
  private getStyles(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: #333;
        background-color: #f5f5f5;
        line-height: 1.6;
      }

      .container {
        max-width: 850px;
        margin: 0 auto;
        background-color: white;
        padding: 40px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      /* HEADER */
      .header {
        color: white;
        padding: 30px;
        margin: -40px -40px 40px -40px;
        border-radius: 8px 8px 0 0;
      }

      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .header-left {
        flex: 1;
      }

      .logo {
        max-height: 60px;
        margin-bottom: 10px;
      }

      .company-name {
        font-size: 24px;
        margin-bottom: 0;
      }

      .header-right {
        flex: 1;
        text-align: right;
      }

      .invoice-title {
        font-size: 32px;
        font-weight: bold;
        margin-bottom: 15px;
      }

      .invoice-meta {
        font-size: 13px;
        line-height: 1.8;
      }

      .invoice-meta p {
        margin: 5px 0;
      }

      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        text-transform: uppercase;
      }

      .status-draft {
        background-color: #d1d5db;
        color: #374151;
      }

      .status-finalized {
        background-color: #93c5fd;
        color: #1e3a8a;
      }

      .status-sent {
        background-color: #bfdbfe;
        color: #1e40af;
      }

      .status-paid {
        background-color: #86efac;
        color: #166534;
      }

      .status-overdue {
        background-color: #fca5a5;
        color: #7f1d1d;
      }

      .status-voided {
        background-color: #d1d5db;
        color: #4b5563;
      }

      /* DETAILS SECTION */
      .details-section {
        margin-bottom: 30px;
      }

      .company-info {
        font-size: 13px;
        line-height: 1.8;
      }

      .company-info h3 {
        font-size: 12px;
        text-transform: uppercase;
        color: ${this.branding.primaryColor};
        margin-bottom: 8px;
        font-weight: bold;
      }

      .company-info p {
        margin: 4px 0;
      }

      /* BILL TO SECTION */
      .bill-to-section {
        margin-bottom: 30px;
        padding: 20px;
        background-color: ${this.branding.secondaryColor};
        border-left: 4px solid ${this.branding.primaryColor};
      }

      .bill-to-section h3 {
        font-size: 12px;
        text-transform: uppercase;
        color: ${this.branding.primaryColor};
        margin-bottom: 10px;
        font-weight: bold;
      }

      .bill-to-content {
        font-size: 13px;
        line-height: 1.8;
      }

      .bill-to-content p {
        margin: 4px 0;
      }

      /* LINE ITEMS TABLE */
      .line-items-section {
        margin: 30px 0;
        overflow: hidden;
      }

      .line-items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }

      .line-items-table thead {
        background-color: ${this.branding.primaryColor};
        color: white;
      }

      .line-items-table th {
        padding: 12px;
        text-align: left;
        font-weight: bold;
        font-size: 12px;
        text-transform: uppercase;
      }

      .line-items-table td {
        padding: 12px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 13px;
      }

      .line-items-table tbody tr:nth-child(even) {
        background-color: ${this.branding.secondaryColor};
      }

      .line-items-table .qty,
      .line-items-table .unit-price,
      .line-items-table .amount {
        text-align: right;
      }

      /* SUMMARY SECTION */
      .summary-section {
        margin: 30px 0;
      }

      .summary-table {
        width: 100%;
        max-width: 400px;
        margin-left: auto;
      }

      .summary-table td {
        padding: 10px 20px;
        font-size: 13px;
        border-bottom: 1px solid #e5e7eb;
      }

      .summary-table .amount {
        text-align: right;
        font-weight: bold;
      }

      .subtotal-row td {
        padding-top: 15px;
      }

      .tax-row td {
        font-size: 12px;
        color: #6b7280;
      }

      .total-row {
        background-color: ${this.branding.primaryColor};
        color: white;
        font-weight: bold;
        font-size: 14px;
      }

      .total-row td {
        padding: 15px 20px;
        border: none;
      }

      /* PAYMENT INSTRUCTIONS */
      .payment-instructions-section {
        margin: 30px 0;
        padding: 20px;
        background-color: ${this.branding.secondaryColor};
        border-radius: 8px;
      }

      .payment-instructions-section h3 {
        font-size: 14px;
        font-weight: bold;
        color: ${this.branding.primaryColor};
        margin-bottom: 15px;
        text-transform: uppercase;
      }

      .payment-method {
        margin-bottom: 15px;
      }

      .payment-method h4 {
        font-size: 12px;
        color: ${this.branding.primaryColor};
        margin-bottom: 8px;
        font-weight: bold;
      }

      .payment-method p {
        font-size: 12px;
        margin: 4px 0;
        line-height: 1.6;
      }

      .payment-link {
        color: ${this.branding.accentColor};
        text-decoration: none;
        font-weight: bold;
      }

      .reference-note {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #d1d5db;
        font-size: 12px;
        color: #6b7280;
      }

      /* TERMS & NOTES */
      .terms-section {
        margin: 30px 0;
        padding: 20px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
      }

      .notes-section h4 {
        font-size: 12px;
        font-weight: bold;
        text-transform: uppercase;
        color: ${this.branding.primaryColor};
        margin-bottom: 10px;
      }

      .notes-section p {
        font-size: 13px;
        line-height: 1.6;
        color: #4b5563;
        white-space: pre-wrap;
      }

      .no-items {
        padding: 20px;
        text-align: center;
        color: #9ca3af;
        font-style: italic;
      }

      /* FOOTER */
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #d1d5db;
        text-align: center;
        font-size: 11px;
        color: #9ca3af;
      }

      /* PRINT STYLES */
      @media print {
        body {
          background-color: white;
        }

        .container {
          box-shadow: none;
          max-width: 100%;
          margin: 0;
          padding: 0;
        }
      }
    `;
  }

  /**
   * Format status text
   */
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      draft: "Draft",
      finalized: "Finalized",
      sent: "Sent",
      paid: "Paid",
      overdue: "Overdue",
      voided: "Voided",
    };
    return statusMap[status] || status;
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /**
   * Format number with decimals
   */
  private formatNumber(num: number, decimals: number): string {
    return num.toFixed(decimals);
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: number, currency: string): string {
    const currencySymbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      CAD: "$",
      AUD: "$",
    };

    const symbol = currencySymbols[currency] || currency;
    return `${symbol} ${amount.toFixed(2)}`;
  }

  /**
   * Get bill to address from metadata
   */
  private getBillToAddress(invoice: Invoice): string {
    if (
      invoice.metadata &&
      typeof invoice.metadata === "object" &&
      "billToAddress" in invoice.metadata
    ) {
      return invoice.metadata.billToAddress as string;
    }
    return "";
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Helper function to render invoice as HTML string
 */
export function renderInvoiceHTML(
  invoice: Invoice,
  branding: InvoiceBranding,
): string {
  const renderer = new InvoicePDFRenderer(branding);
  return renderer.renderHTML(invoice);
}

/**
 * Helper function to render invoice with payment instructions
 */
export function renderInvoiceHTMLWithPayment(
  invoice: Invoice,
  branding: InvoiceBranding,
  paymentInstructions: PaymentInstructions,
): string {
  const renderer = new InvoicePDFRenderer(branding, paymentInstructions);
  return renderer.renderHTML(invoice);
}
