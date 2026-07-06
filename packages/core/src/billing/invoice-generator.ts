/**
 * Invoice Generator
 * Generates invoices for subscriptions, prorations, and overages.
 * Supports line-item calculations, discount application, and PDF export.
 */

import { PrismaClient } from "@witylogix/db";

// ─── LOCAL TYPE DEFINITIONS ─────────────────────────────────────────

// Simple Decimal replacement using numbers
type Decimal = number;

// Helper to convert values to Decimal (number)
const toDecimal = (value: number | string): Decimal => {
  return typeof value === "number" ? value : parseFloat(value);
};

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  interval: "monthly" | "yearly";
  trialDays?: number;
  limits?: Record<string, number | null>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BillingSubscription {
  id: string;
  shopId: string;
  planId: string;
  status: "trialing" | "active" | "cancelled" | "expired";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date | null;
  paymentMethodId?: string | null;
  cancelledAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  shopId: string;
  amount: number;
  discountAmount?: number;
  currency: string;
  status: "draft" | "finalized" | "paid" | "failed";
  lineItems?: string; // JSON string
  couponCode?: string | null;
  dueDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── ERROR CLASSES ──────────────────────────────────────────────────

export class InvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceError";
  }
}

export class SubscriptionNotFoundError extends Error {
  constructor(subscriptionId: string) {
    super(`Subscription not found: ${subscriptionId}`);
    this.name = "SubscriptionNotFoundError";
  }
}

// ─── TYPES ──────────────────────────────────────────────────────────

export interface LineItem {
  description: string;
  amount: number;
  quantity: number;
}

export interface InvoiceLineItems {
  items: LineItem[];
  subtotal: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

// ─── INVOICE GENERATOR ──────────────────────────────────────────────

export class InvoiceGenerator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate invoice for current subscription period
   * Creates line items for base plan charge + any overages
   */
  async generateInvoice(subscriptionId: string): Promise<Invoice> {
    const subscription = await this.getSubscriptionWithPlan(subscriptionId);

    const lineItems = await this.calculateLineItems(subscription);
    const subtotal = lineItems.subtotal;

    const dueDate = new Date(subscription.currentPeriodEnd);
    dueDate.setDate(dueDate.getDate() + 14); // Net 14 terms

    const invoice = await (this.prisma as any).invoice.create({
      data: {
        subscriptionId,
        shopId: subscription.shopId,
        amount: subtotal,
        currency: "usd",
        status: "draft",
        lineItems: JSON.stringify(lineItems.items),
        dueDate,
      },
    });

    return invoice;
  }

  /**
   * Generate proration invoice when plan changes mid-cycle
   * Calculates credit for unused days on old plan + charge for new plan
   */
  async generateProrationInvoice(
    subscriptionId: string,
    oldPlan: BillingPlan,
    newPlan: BillingPlan,
  ): Promise<Invoice> {
    const subscription = await this.getSubscriptionWithPlan(subscriptionId);
    const daysRemaining = this.calculateDaysRemaining(
      subscription.currentPeriodEnd,
    );

    const proration = this.calculateProration(oldPlan, newPlan, daysRemaining);

    const items: LineItem[] = [];

    // Credit line for unused time on old plan
    if (proration.creditAmount > 0) {
      items.push({
        description: `${oldPlan.name} - Unused time (${daysRemaining} days)`,
        amount: -proration.creditAmount,
        quantity: 1,
      });
    }

    // Charge line for new plan
    items.push({
      description: `${newPlan.name} - Prorated for ${daysRemaining} days`,
      amount: proration.chargeAmount,
      quantity: 1,
    });

    const subtotal = proration.netDueAmount > 0 ? proration.netDueAmount : 0;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // Prorations due in 3 days

    const invoice = await (this.prisma as any).invoice.create({
      data: {
        subscriptionId,
        shopId: subscription.shopId,
        amount: subtotal,
        currency: "usd",
        status: "draft",
        lineItems: JSON.stringify(items),
        dueDate,
      },
    });

    return invoice;
  }

  /**
   * Calculate line items for invoice
   * Includes base plan charge and any overage charges
   */
  async calculateLineItems(
    subscription: BillingSubscription & { plan: BillingPlan },
  ): Promise<InvoiceLineItems> {
    const items: LineItem[] = [];
    let subtotal = 0;

    // Base plan charge
    const planAmount = toDecimal(subscription.plan.price);
    items.push({
      description: `${subscription.plan.name} (${subscription.plan.interval})`,
      amount: planAmount,
      quantity: 1,
    });
    subtotal += planAmount;

    // Note: Overage calculations would go here if implemented
    // This would require tracking usage above plan limits and applying overage rates

    return {
      items,
      subtotal,
    };
  }

  /**
   * Apply discount to invoice
   * Supports both percentage and fixed-amount discounts
   */
  async applyDiscounts(
    invoiceId: string,
    couponCode?: string,
  ): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId);

    if (invoice.status !== "draft") {
      throw new InvoiceError("Can only apply discounts to draft invoices");
    }

    let discountAmount = 0;

    if (couponCode) {
      // In production, validate coupon against coupon database
      // For now, basic validation
      discountAmount = this.calculateCouponDiscount(couponCode, invoice.amount);
    }

    const newAmount = invoice.amount - discountAmount;

    const updated = await (this.prisma as any).invoice.update({
      where: { id: invoiceId },
      data: {
        discountAmount,
        couponCode,
        amount: newAmount,
      },
    });

    return updated;
  }

  /**
   * Finalize invoice and mark ready for payment
   * In production, this would trigger payment processing
   */
  async finalizeInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId);

    if (invoice.status !== "draft") {
      throw new InvoiceError("Only draft invoices can be finalized");
    }

    const updated = await (this.prisma as any).invoice.update({
      where: { id: invoiceId },
      data: {
        status: "finalized",
      },
    });

    // Emit event for payment processing
    this.emitEvent("invoice.finalized", {
      invoiceId,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
    });

    return updated;
  }

  /**
   * Get invoice history for a shop with pagination
   */
  async getInvoiceHistory(
    shopId: string,
    options: PaginationOptions,
  ): Promise<{
    invoices: Invoice[];
    total: number;
    page: number;
    pages: number;
  }> {
    const skip = (options.page - 1) * options.limit;

    const [invoices, total] = await Promise.all([
      (this.prisma as any).invoice.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        skip,
        take: options.limit,
      }),
      (this.prisma as any).invoice.count({
        where: { shopId },
      }),
    ]);

    const pages = Math.ceil(total / options.limit);

    return {
      invoices,
      total,
      page: options.page,
      pages,
    };
  }

  /**
   * Export invoice as PDF
   * Returns PDF buffer for download/email
   */
  async exportInvoicePdf(invoiceId: string): Promise<Buffer> {
    const invoice = await this.getInvoice(invoiceId);
    const subscription = await this.getSubscriptionWithPlan(
      invoice.subscriptionId,
    );

    // Generate HTML invoice template
    const html = this.generateInvoiceHtml(invoice, subscription);

    // Simple HTML to Buffer conversion
    // In production, would use a library like pdf-lib or puppeteer
    const buffer = Buffer.from(html, "utf-8");

    return buffer;
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────

  private async getInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await (this.prisma as any).invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new InvoiceError(`Invoice not found: ${invoiceId}`);
    }

    return invoice;
  }

  private async getSubscriptionWithPlan(
    subscriptionId: string,
  ): Promise<BillingSubscription & { plan: BillingPlan }> {
    const subscription = await (
      this.prisma as any
    ).billingSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    return subscription;
  }

  private calculateDaysRemaining(periodEnd: Date): number {
    const now = new Date();
    const timeDiff = periodEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
  }

  private calculateProration(
    oldPlan: BillingPlan,
    newPlan: BillingPlan,
    daysRemaining: number,
  ): {
    creditAmount: number;
    chargeAmount: number;
    netDueAmount: number;
  } {
    const oldPrice = toDecimal(oldPlan.price);
    const newPrice = toDecimal(newPlan.price);
    const daysInPeriod = oldPlan.interval === "yearly" ? 365 : 30;

    // Daily rates
    const oldDailyRate = oldPrice / daysInPeriod;
    const creditAmount = oldDailyRate * daysRemaining;

    // Charge for new plan (full period)
    const chargeAmount = newPrice;

    // Net due
    const netDueAmount = chargeAmount - creditAmount;

    return {
      creditAmount,
      chargeAmount,
      netDueAmount,
    };
  }

  private calculateCouponDiscount(
    couponCode: string,
    invoiceAmount: number,
  ): number {
    // Placeholder coupon logic
    // In production, would lookup coupon in database and apply rules
    const codeUpper = couponCode.toUpperCase();

    if (codeUpper === "WELCOME10") {
      // 10% off
      return invoiceAmount * 0.1;
    }

    if (codeUpper === "SAVE20") {
      // 20% off
      return invoiceAmount * 0.2;
    }

    return 0;
  }

  private generateInvoiceHtml(
    invoice: Invoice,
    subscription: BillingSubscription & { plan: BillingPlan },
  ): string {
    let lineItemsHtml = "";
    try {
      const items = JSON.parse(
        typeof invoice.lineItems === "string" ? invoice.lineItems : "[]",
      ) as LineItem[];
      lineItemsHtml = items
        .map(
          (item) =>
            `<tr>
          <td>${item.description}</td>
          <td style="text-align:right">${item.quantity}</td>
          <td style="text-align:right">$${item.amount.toFixed(2)}</td>
          <td style="text-align:right">$${(item.amount * item.quantity).toFixed(2)}</td>
        </tr>`,
        )
        .join("");
    } catch {
      lineItemsHtml = '<tr><td colspan="4">Invalid line items</td></tr>';
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${invoice.id}</title>
  <style>
    body { font-family: Arial, sans-serif; }
    .invoice { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .section { margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .total-section { text-align: right; margin-top: 20px; }
    .total-row { font-size: 18px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <h1>Invoice</h1>
      <p>Invoice #${invoice.id}</p>
    </div>

    <div class="details">
      <div>
        <strong>Bill To:</strong>
        <p>Shop ID: ${subscription.shopId}</p>
      </div>
      <div>
        <strong>Invoice Date:</strong>
        <p>${new Date(invoice.createdAt || Date.now()).toLocaleDateString()}</p>
        <strong>Due Date:</strong>
        <p>${new Date(invoice.dueDate).toLocaleDateString()}</p>
      </div>
    </div>

    <div class="section">
      <h3>Billing Details</h3>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:right">Qty</th>
            <th style="text-align:right">Unit Price</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>

      <div class="total-section">
        ${invoice.discountAmount ? `<p>Discount: -$${invoice.discountAmount.toFixed(2)}</p>` : ""}
        <p class="total-row">Total: $${invoice.amount.toFixed(2)}</p>
      </div>
    </div>

    <div class="section">
      <p style="color: #666; font-size: 12px;">
        Thank you for your business. If you have any questions about this invoice,
        please contact support@witylogix.com
      </p>
    </div>
  </div>
</body>
</html>
  `;
  }

  private emitEvent(eventType: string, data: Record<string, unknown>): void {
    // In production, emit to event bus/pubsub
    console.log(`[InvoiceEvent] ${eventType}:`, JSON.stringify(data));
  }
}
