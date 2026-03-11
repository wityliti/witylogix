/**
 * Invoice Email Delivery Service
 * Builds and sends invoice emails with HTML templates
 * Supports payment reminder emails and payment receipt emails
 */

import type { Invoice, InvoiceLineItem, InvoiceDiscount, InvoiceTax, PaymentRecord } from './types.js';

export interface InvoiceEmailData {
  invoice: Invoice;
  recipientEmail: string;
  companyName?: string;
  companyLogo?: string;
  paymentLink?: string;
  customMessage?: string;
}

export interface EmailReminder {
  invoice: Invoice;
  recipientEmail: string;
  daysOverdue: number;
  companyName?: string;
  companyLogo?: string;
  paymentLink?: string;
}

export interface ReceiptEmailData {
  invoice: Invoice;
  payment: PaymentRecord;
  recipientEmail: string;
  companyName?: string;
  companyLogo?: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Build HTML invoice email
 */
export function buildInvoiceEmail(data: InvoiceEmailData): EmailContent {
  const { invoice, companyName = 'Witylogix', companyLogo, paymentLink, customMessage } = data;

  const logoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="${companyName}" style="height: 40px; margin-bottom: 20px;">`
    : `<h2 style="color: #1f2937; margin: 0 0 20px 0;">${companyName}</h2>`;

  const subject = `Invoice ${invoice.invoiceNumber} - Due ${formatDate(invoice.dueAt)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #374151;
      background-color: #f9fafb;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 30px;
      color: white;
    }
    .header-logo {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
    }
    .content {
      padding: 40px 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    .invoice-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .info-block {
      font-size: 13px;
    }
    .info-label {
      color: #6b7280;
      font-weight: 500;
      margin-bottom: 5px;
    }
    .info-value {
      color: #1f2937;
      font-weight: 600;
      font-size: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background-color: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .amount-right {
      text-align: right;
    }
    .summary {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .summary-row:last-child {
      margin-bottom: 0;
    }
    .summary-label {
      color: #6b7280;
      font-weight: 500;
    }
    .summary-value {
      color: #1f2937;
      font-weight: 600;
    }
    .total-row {
      border-top: 2px solid #e5e7eb;
      padding-top: 15px;
      font-size: 16px;
    }
    .total-row .summary-label {
      color: #1f2937;
      font-weight: 700;
    }
    .total-row .summary-value {
      font-size: 20px;
      color: #667eea;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-paid {
      background-color: #d1fae5;
      color: #065f46;
    }
    .status-pending {
      background-color: #fef3c7;
      color: #92400e;
    }
    .status-overdue {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      text-align: center;
      margin-top: 20px;
      margin-bottom: 20px;
    }
    .cta-button:hover {
      opacity: 0.9;
    }
    .message-box {
      background-color: #eff6ff;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
      font-size: 14px;
      color: #1f2937;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">${logoHtml}</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Invoice ${invoice.invoiceNumber}</h1>
      <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">
        ${getStatusLabel(invoice.status)}
      </p>
    </div>

    <div class="content">
      <!-- Invoice Information -->
      <div class="section">
        <div class="section-title">Invoice Details</div>
        <div class="invoice-info">
          <div class="info-block">
            <div class="info-label">Invoice Number</div>
            <div class="info-value">${invoice.invoiceNumber}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Invoice Date</div>
            <div class="info-value">${formatDate(invoice.issuedAt)}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Due Date</div>
            <div class="info-value" style="color: ${invoice.dueAt < new Date() ? '#dc2626' : '#374151'};">
              ${formatDate(invoice.dueAt)}
            </div>
          </div>
          <div class="info-block">
            <div class="info-label">Currency</div>
            <div class="info-value">${invoice.currency}</div>
          </div>
        </div>
      </div>

      <!-- Line Items -->
      ${invoice.lineItems && invoice.lineItems.length > 0
        ? `
      <div class="section">
        <div class="section-title">Line Items</div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="amount-right">Qty</th>
              <th class="amount-right">Unit Price</th>
              <th class="amount-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.lineItems.map(item => `
            <tr>
              <td>${item.description}</td>
              <td class="amount-right">${item.quantity}</td>
              <td class="amount-right">${formatCurrency(item.unitPrice, invoice.currency)}</td>
              <td class="amount-right"><strong>${formatCurrency(item.amount, invoice.currency)}</strong></td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      `
        : ''
      }

      <!-- Discounts -->
      ${invoice.discounts && invoice.discounts.length > 0
        ? `
      <div class="section">
        <div class="section-title">Discounts</div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="amount-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.discounts.map(discount => `
            <tr>
              <td>${discount.description}</td>
              <td class="amount-right">-${formatCurrency(discount.amount, invoice.currency)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      `
        : ''
      }

      <!-- Summary -->
      <div class="section">
        <div class="summary">
          <div class="summary-row">
            <span class="summary-label">Subtotal</span>
            <span class="summary-value">${formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          ${invoice.discountTotal > 0
            ? `
          <div class="summary-row">
            <span class="summary-label">Discounts</span>
            <span class="summary-value">-${formatCurrency(invoice.discountTotal, invoice.currency)}</span>
          </div>
          `
            : ''
          }
          ${invoice.taxTotal > 0
            ? `
          <div class="summary-row">
            <span class="summary-label">Taxes</span>
            <span class="summary-value">${formatCurrency(invoice.taxTotal, invoice.currency)}</span>
          </div>
          `
            : ''
          }
          <div class="summary-row total-row">
            <span class="summary-label">Total Due</span>
            <span class="summary-value">${formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
        </div>
      </div>

      <!-- Custom Message -->
      ${customMessage
        ? `
      <div class="message-box">
        ${escapeHtml(customMessage)}
      </div>
      `
        : ''
      }

      <!-- Payment CTA -->
      ${paymentLink && invoice.status !== 'paid'
        ? `
      <div style="text-align: center;">
        <a href="${paymentLink}" class="cta-button">Pay Now</a>
        <p style="font-size: 12px; color: #6b7280;">
          Click the button above to securely pay this invoice online
        </p>
      </div>
      `
        : ''
      }

      <!-- Notes -->
      ${invoice.notes
        ? `
      <div class="section">
        <div class="section-title">Notes</div>
        <p style="margin: 0; font-size: 14px; line-height: 1.6;">
          ${escapeHtml(invoice.notes)}
        </p>
      </div>
      `
        : ''
      }
    </div>

    <div class="footer">
      <p style="margin: 0;">
        Questions? Contact us at <a href="mailto:billing@witylogix.com">billing@witylogix.com</a>
      </p>
      <p style="margin: 10px 0 0 0;">
        This is an automated message from ${companyName}. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Invoice ${invoice.invoiceNumber}
${getStatusLabel(invoice.status)}

Invoice Date: ${formatDate(invoice.issuedAt)}
Due Date: ${formatDate(invoice.dueAt)}

SUMMARY:
Subtotal: ${formatCurrency(invoice.subtotal, invoice.currency)}
${invoice.discountTotal > 0 ? `Discounts: -${formatCurrency(invoice.discountTotal, invoice.currency)}\n` : ''}
${invoice.taxTotal > 0 ? `Taxes: ${formatCurrency(invoice.taxTotal, invoice.currency)}\n` : ''}
Total Due: ${formatCurrency(invoice.total, invoice.currency)}

${paymentLink && invoice.status !== 'paid' ? `\nPay online: ${paymentLink}\n` : ''}

For questions, contact billing@witylogix.com
  `.trim();

  return { subject, html, text };
}

/**
 * Build payment reminder email
 */
export function buildPaymentReminderEmail(data: EmailReminder): EmailContent {
  const { invoice, daysOverdue, companyName = 'Witylogix', companyLogo, paymentLink } = data;

  const reminderType =
    daysOverdue <= 7
      ? 'This invoice is due soon'
      : daysOverdue <= 14
        ? 'This invoice is now overdue'
        : 'This invoice is significantly overdue';

  const logoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="${companyName}" style="height: 40px; margin-bottom: 20px;">`
    : `<h2 style="color: #1f2937; margin: 0 0 20px 0;">${companyName}</h2>`;

  const subject = `Payment Reminder: Invoice ${invoice.invoiceNumber} – ${reminderType}`;
  const warningColor = daysOverdue > 14 ? '#dc2626' : daysOverdue > 7 ? '#f59e0b' : '#f59e0b';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #374151;
      background-color: #f9fafb;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: ${warningColor};
      padding: 40px 30px;
      color: white;
    }
    .content {
      padding: 40px 30px;
    }
    .alert-box {
      background-color: #fef2f2;
      border-left: 4px solid ${warningColor};
      padding: 20px;
      margin-bottom: 30px;
      border-radius: 4px;
    }
    .alert-box p {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: ${warningColor};
    }
    .invoice-summary {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .summary-label {
      color: #6b7280;
    }
    .summary-value {
      font-weight: 600;
      color: #1f2937;
    }
    .cta-button {
      display: block;
      background-color: ${warningColor};
      color: white;
      padding: 14px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      text-align: center;
      margin-bottom: 20px;
    }
    .cta-button:hover {
      opacity: 0.9;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>${logoHtml}</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Payment Reminder</h1>
    </div>

    <div class="content">
      <div class="alert-box">
        <p>${reminderType}</p>
      </div>

      <p style="margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
        Invoice <strong>${invoice.invoiceNumber}</strong> was due on <strong>${formatDate(invoice.dueAt)}</strong>.
        ${daysOverdue > 1 ? `It is now <strong>${daysOverdue} days overdue</strong>.` : 'Please pay at your earliest convenience.'}
      </p>

      <div class="invoice-summary">
        <div class="summary-row">
          <span class="summary-label">Invoice Number</span>
          <span class="summary-value">${invoice.invoiceNumber}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Invoice Date</span>
          <span class="summary-value">${formatDate(invoice.issuedAt)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Due Date</span>
          <span class="summary-value">${formatDate(invoice.dueAt)}</span>
        </div>
        <div class="summary-row" style="border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 10px; font-size: 16px;">
          <span class="summary-label" style="font-weight: 700;">Amount Due</span>
          <span class="summary-value" style="color: ${warningColor}; font-size: 18px;">${formatCurrency(invoice.total, invoice.currency)}</span>
        </div>
      </div>

      ${paymentLink
        ? `
      <a href="${paymentLink}" class="cta-button">Pay Now</a>
      `
        : ''
      }

      <p style="font-size: 13px; color: #6b7280; margin: 20px 0;">
        If you have already made a payment, please disregard this notice and accept our thanks.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0;">
        Questions? Contact us at <a href="mailto:billing@witylogix.com" style="color: #667eea;">billing@witylogix.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Payment Reminder: Invoice ${invoice.invoiceNumber}

${reminderType}

Invoice Number: ${invoice.invoiceNumber}
Invoice Date: ${formatDate(invoice.issuedAt)}
Due Date: ${formatDate(invoice.dueAt)}
Amount Due: ${formatCurrency(invoice.total, invoice.currency)}

${daysOverdue > 1 ? `This invoice is ${daysOverdue} days overdue.` : 'Please pay at your earliest convenience.'}

${paymentLink ? `Pay online: ${paymentLink}` : ''}

If you have already made a payment, please disregard this notice and accept our thanks.

For questions, contact billing@witylogix.com
  `.trim();

  return { subject, html, text };
}

/**
 * Build payment receipt email
 */
export function buildPaymentReceiptEmail(data: ReceiptEmailData): EmailContent {
  const { invoice, payment, companyName = 'Witylogix', companyLogo } = data;

  const logoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="${companyName}" style="height: 40px; margin-bottom: 20px;">`
    : `<h2 style="color: #1f2937; margin: 0 0 20px 0;">${companyName}</h2>`;

  const subject = `Payment Received: Invoice ${invoice.invoiceNumber}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #374151;
      background-color: #f9fafb;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 40px 30px;
      color: white;
    }
    .content {
      padding: 40px 30px;
    }
    .success-box {
      background-color: #ecfdf5;
      border: 2px solid #10b981;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
      text-align: center;
    }
    .success-box p {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #059669;
    }
    .summary {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .summary-label {
      color: #6b7280;
    }
    .summary-value {
      font-weight: 600;
      color: #1f2937;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>${logoHtml}</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Payment Received</h1>
    </div>

    <div class="content">
      <div class="success-box">
        <p>Thank you! We have received your payment.</p>
      </div>

      <p style="margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
        Your payment has been successfully processed. Below is a summary of the transaction.
      </p>

      <div class="summary">
        <div class="summary-row">
          <span class="summary-label">Invoice Number</span>
          <span class="summary-value">${invoice.invoiceNumber}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Payment Date</span>
          <span class="summary-value">${formatDate(payment.paidAt)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Payment Method</span>
          <span class="summary-value">${getPaymentMethodLabel(payment.method)}</span>
        </div>
        ${payment.reference
          ? `
        <div class="summary-row">
          <span class="summary-label">Reference</span>
          <span class="summary-value">${payment.reference}</span>
        </div>
        `
          : ''
        }
        <div class="summary-row" style="border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 10px; font-size: 16px;">
          <span class="summary-label" style="font-weight: 700;">Amount Paid</span>
          <span class="summary-value" style="color: #10b981; font-size: 18px;">${formatCurrency(payment.amount, invoice.currency)}</span>
        </div>
      </div>

      <p style="font-size: 13px; color: #6b7280;">
        If you have any questions about this payment, please contact us at
        <a href="mailto:billing@witylogix.com" style="color: #667eea;">billing@witylogix.com</a>.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0;">Thank you for your business!</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Payment Received: Invoice ${invoice.invoiceNumber}

Thank you! We have received your payment.

Invoice Number: ${invoice.invoiceNumber}
Payment Date: ${formatDate(payment.paidAt)}
Payment Method: ${getPaymentMethodLabel(payment.method)}
${payment.reference ? `Reference: ${payment.reference}\n` : ''}
Amount Paid: ${formatCurrency(payment.amount, invoice.currency)}

If you have any questions, contact billing@witylogix.com

Thank you for your business!
  `.trim();

  return { subject, html, text };
}

/**
 * Helper: Format date to readable string
 */
function formatDate(date: Date): string {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(date));
}

/**
 * Helper: Format currency
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Helper: Get status label
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    finalized: 'Sent',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
    voided: 'Voided',
  };
  return labels[status] || 'Pending';
}

/**
 * Helper: Get payment method label
 */
function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    credit_card: 'Credit Card',
    bank_transfer: 'Bank Transfer',
    check: 'Check',
    cash: 'Cash',
    other: 'Other',
  };
  return labels[method] || method;
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Send invoice email (stub for actual notification service)
 * This would integrate with the notification service
 */
export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<void> {
  const emailContent = buildInvoiceEmail(data);
  // INTEGRATION: Send via notification service
  console.log(`[INTEGRATION] Would send invoice email to ${data.recipientEmail}`);
}

/**
 * Send payment reminder email
 */
export async function sendPaymentReminderEmail(data: EmailReminder): Promise<void> {
  const emailContent = buildPaymentReminderEmail(data);
  // INTEGRATION: Send via notification service
  console.log(`[INTEGRATION] Would send reminder email to ${data.recipientEmail}`);
}

/**
 * Send payment receipt email
 */
export async function sendPaymentReceiptEmail(data: ReceiptEmailData): Promise<void> {
  const emailContent = buildPaymentReceiptEmail(data);
  // INTEGRATION: Send via notification service
  console.log(`[INTEGRATION] Would send receipt email to ${data.recipientEmail}`);
}
