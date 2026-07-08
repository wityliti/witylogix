/**
 * Invoice Generator Service
 * Creates invoices from delivery records with configurable billing rules
 * Supports line item generation, discounts, tax calculation, and invoice lifecycle
 */

import type { Decimal } from "@prisma/client/runtime/library";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceDiscount,
  InvoiceTax,
  CreateInvoiceParams,
  InvoiceStatus,
} from "./types.js";
import type {
  BillingRule,
  BillingContext,
  LineItemWithMetadata,
} from "./billing-rules.js";
import { BillingRuleEngine } from "./billing-rules.js";

// ─── INVOICE GENERATOR CONFIG ───────────────────────────────────────────

export interface InvoiceGeneratorConfig {
  tenantId: string;
  customerId?: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  currency?: string;
  billingRules: BillingRule[];
  taxConfig?: Array<{
    jurisdiction: string;
    rate: number;
    description?: string;
  }>;
  discounts?: Array<{
    type: "percentage" | "fixed";
    value: number;
    description?: string;
  }>;
  notes?: string;
}

export interface GenerateInvoiceOptions {
  dueDate?: Date;
  metadata?: Record<string, unknown>;
  skipTaxes?: boolean;
  skipDiscounts?: boolean;
}

// ─── INVOICE LINE ITEM ACCUMULATOR ──────────────────────────────────────

interface LineItemAccumulator {
  deliveryId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  metadata?: Record<string, unknown>;
}

// ─── INVOICE GENERATOR CLASS ────────────────────────────────────────────

export class InvoiceGenerator {
  private billingEngine: BillingRuleEngine;

  constructor() {
    this.billingEngine = new BillingRuleEngine();
  }

  /**
   * Generate invoice from delivery records and billing rules
   */
  async generateInvoice(
    config: InvoiceGeneratorConfig,
    deliveryContexts: BillingContext[],
    options?: GenerateInvoiceOptions,
  ): Promise<Invoice> {
    // Generate line items from billing rules
    const lineItems = this.calculateLineItems(
      deliveryContexts,
      config.billingRules,
    );

    // Apply discounts if not skipped
    let finalLineItems = lineItems;
    let discountTotal = 0;
    let discounts: InvoiceDiscount[] = [];

    if (
      !options?.skipDiscounts &&
      config.discounts &&
      config.discounts.length > 0
    ) {
      const discountResult = this.applyDiscounts(lineItems, config.discounts);
      finalLineItems = discountResult.items;
      discountTotal = discountResult.totalDiscount;
      discounts = discountResult.discountRecords;
    }

    // Calculate subtotal from original line items (before discounts)
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Calculate taxes if not skipped
    let taxTotal = 0;
    let taxes: InvoiceTax[] = [];

    if (
      !options?.skipTaxes &&
      config.taxConfig &&
      config.taxConfig.length > 0
    ) {
      const taxResult = this.calculateTax(subtotal, config.taxConfig);
      taxTotal = taxResult.totalTax;
      taxes = taxResult.taxRecords;
    }

    // Calculate final total
    const total = subtotal - discountTotal + taxTotal;

    // Calculate due date (default: 30 days)
    const dueDate =
      options?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Build invoice object
    const invoice: Invoice = {
      id: this.generateId(),
      tenantId: config.tenantId,
      invoiceNumber: "", // Will be set during finalization
      customerId: config.customerId,
      status: "draft" as InvoiceStatus,
      subtotal,
      discountTotal,
      taxTotal,
      total,
      currency: config.currency || "USD",
      issuedAt: new Date(),
      dueAt: dueDate,
      notes: config.notes,
      metadata: {
        ...options?.metadata,
        billingPeriodStart: config.billingPeriodStart.toISOString(),
        billingPeriodEnd: config.billingPeriodEnd.toISOString(),
        deliveryCount: deliveryContexts.length,
      },
      lineItems: this.convertLineItemsToInvoiceItems(finalLineItems),
      discounts,
      taxes,
      payments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return invoice;
  }

  /**
   * Calculate line items from delivery contexts using billing rules
   */
  private calculateLineItems(
    deliveryContexts: BillingContext[],
    billingRules: BillingRule[],
  ): LineItemWithMetadata[] {
    const lineItems: LineItemWithMetadata[] = [];

    for (const context of deliveryContexts) {
      const ruleItems = this.billingEngine.evaluateRules(context, billingRules);
      lineItems.push(...ruleItems);
    }

    return lineItems;
  }

  /**
   * Apply discounts to line items
   */
  private applyDiscounts(
    lineItems: LineItemWithMetadata[],
    discountConfigs: Array<{
      type: "percentage" | "fixed";
      value: number;
      description?: string;
    }>,
  ): {
    items: LineItemWithMetadata[];
    totalDiscount: number;
    discountRecords: InvoiceDiscount[];
  } {
    if (!discountConfigs || discountConfigs.length === 0) {
      return { items: lineItems, totalDiscount: 0, discountRecords: [] };
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    let totalDiscount = 0;
    const discountRecords: InvoiceDiscount[] = [];

    for (const discount of discountConfigs) {
      let discountAmount: number;

      if (discount.type === "percentage") {
        discountAmount = (subtotal * discount.value) / 100;
      } else {
        discountAmount = discount.value;
      }

      totalDiscount += discountAmount;

      discountRecords.push({
        id: this.generateId(),
        invoiceId: "", // Will be set when invoice is persisted
        description: discount.description || `Discount (${discount.type})`,
        type: discount.type,
        value: discount.value,
        amount: discountAmount,
        createdAt: new Date(),
      });
    }

    // Distribute discount proportionally across items
    if (totalDiscount > 0 && subtotal > 0) {
      const discountProportion = totalDiscount / subtotal;

      const discountedItems = lineItems.map((item) => ({
        ...item,
        amount: item.amount * (1 - discountProportion),
      }));

      return { items: discountedItems, totalDiscount, discountRecords };
    }

    return { items: lineItems, totalDiscount, discountRecords };
  }

  /**
   * Calculate taxes on line items
   */
  private calculateTax(
    taxableAmount: number,
    taxConfigs: Array<{
      jurisdiction: string;
      rate: number;
      description?: string;
    }>,
  ): {
    totalTax: number;
    taxRecords: InvoiceTax[];
  } {
    if (!taxConfigs || taxConfigs.length === 0) {
      return { totalTax: 0, taxRecords: [] };
    }

    let totalTax = 0;
    const taxRecords: InvoiceTax[] = [];

    for (const config of taxConfigs) {
      const taxAmount = (taxableAmount * config.rate) / 100;
      totalTax += taxAmount;

      taxRecords.push({
        id: this.generateId(),
        invoiceId: "", // Will be set when invoice is persisted
        description: config.description || `Tax (${config.jurisdiction})`,
        rate: config.rate,
        amount: taxAmount,
        jurisdiction: config.jurisdiction,
        createdAt: new Date(),
      });
    }

    return { totalTax, taxRecords };
  }

  /**
   * Finalize an invoice - assign invoice number and change status
   */
  async finalizeInvoice(
    invoice: Invoice,
    invoiceNumber: string,
  ): Promise<Invoice> {
    if (invoice.status !== "draft") {
      throw new Error(
        `Cannot finalize invoice in status ${invoice.status}. Only draft invoices can be finalized.`,
      );
    }

    return {
      ...invoice,
      invoiceNumber,
      status: "finalized" as InvoiceStatus,
      issuedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Mark invoice as sent to customer
   */
  async markAsSent(invoice: Invoice): Promise<Invoice> {
    if (invoice.status === "draft") {
      throw new Error("Cannot send draft invoice. Finalize the invoice first.");
    }

    if (invoice.status === "voided") {
      throw new Error("Cannot send voided invoice.");
    }

    return {
      ...invoice,
      status: "sent" as InvoiceStatus,
      updatedAt: new Date(),
    };
  }

  /**
   * Mark invoice as paid when payment is received
   */
  async markAsPaid(invoice: Invoice, paidAmount: number): Promise<Invoice> {
    if (invoice.status === "draft") {
      throw new Error(
        "Cannot mark draft invoice as paid. Finalize the invoice first.",
      );
    }

    if (invoice.status === "voided") {
      throw new Error("Cannot mark voided invoice as paid.");
    }

    if (invoice.status === "paid") {
      throw new Error("Invoice is already marked as paid.");
    }

    const totalPaid =
      (invoice.payments || []).reduce(
        (sum, payment) => sum + payment.amount,
        0,
      ) + paidAmount;

    // Determine new status based on payment
    let newStatus: InvoiceStatus = "paid";
    if (totalPaid < invoice.total) {
      newStatus = "overdue"; // Partial payment, still overdue if past due date
      if (new Date() < invoice.dueAt) {
        newStatus = "sent"; // Partial payment but not yet due
      }
    }

    return {
      ...invoice,
      status: newStatus,
      paidAt: newStatus === "paid" ? new Date() : invoice.paidAt,
      updatedAt: new Date(),
    };
  }

  /**
   * Mark invoice as overdue
   */
  async markAsOverdue(invoice: Invoice): Promise<Invoice> {
    if (invoice.status === "paid" || invoice.status === "voided") {
      throw new Error(`Cannot mark ${invoice.status} invoice as overdue.`);
    }

    if (invoice.status === "overdue") {
      return invoice; // Already overdue
    }

    return {
      ...invoice,
      status: "overdue" as InvoiceStatus,
      updatedAt: new Date(),
    };
  }

  /**
   * Void an invoice
   */
  async voidInvoice(invoice: Invoice, reason?: string): Promise<Invoice> {
    if (invoice.status === "voided") {
      throw new Error("Invoice is already voided.");
    }

    return {
      ...invoice,
      status: "voided" as InvoiceStatus,
      voidedAt: new Date(),
      voidReason: reason,
      updatedAt: new Date(),
    };
  }

  /**
   * Get invoice aging (days overdue)
   */
  getInvoiceAging(invoice: Invoice): number {
    if (invoice.status === "paid" || invoice.status === "draft") {
      return 0;
    }

    const now = new Date();
    const daysOverdue = Math.floor(
      (now.getTime() - invoice.dueAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(0, daysOverdue);
  }

  /**
   * Get payment balance remaining
   */
  getPaymentBalance(invoice: Invoice): number {
    const totalPaid = (invoice.payments || []).reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    return Math.max(0, invoice.total - totalPaid);
  }

  /**
   * Check if invoice can be edited
   */
  canEdit(invoice: Invoice): boolean {
    return invoice.status === "draft";
  }

  /**
   * Group line items by delivery
   */
  groupLineItemsByDelivery(
    lineItems: InvoiceLineItem[],
  ): Map<string | undefined, InvoiceLineItem[]> {
    const grouped = new Map<string | undefined, InvoiceLineItem[]>();

    for (const item of lineItems) {
      const deliveryId = item.deliveryId;
      if (!grouped.has(deliveryId)) {
        grouped.set(deliveryId, []);
      }
      grouped.get(deliveryId)!.push(item);
    }

    return grouped;
  }

  /**
   * Calculate summary statistics for a batch of invoices
   */
  calculateInvoiceSummary(invoices: Invoice[]): {
    totalCount: number;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    overdueAmount: number;
    byStatus: Record<InvoiceStatus, number>;
  } {
    const byStatus: Record<InvoiceStatus, number> = {
      draft: 0,
      finalized: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
      voided: 0,
    };

    let totalAmount = 0;
    let paidAmount = 0;
    let overdueAmount = 0;

    for (const invoice of invoices) {
      byStatus[invoice.status]++;
      totalAmount += invoice.total;

      const totalPaid = (invoice.payments || []).reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      paidAmount += totalPaid;

      if (invoice.status === "overdue") {
        overdueAmount += this.getPaymentBalance(invoice);
      }
    }

    const outstandingAmount = totalAmount - paidAmount;

    return {
      totalCount: invoices.length,
      totalAmount,
      paidAmount,
      outstandingAmount,
      overdueAmount,
      byStatus,
    };
  }

  /**
   * Convert line item metadata to invoice line items
   */
  private convertLineItemsToInvoiceItems(
    lineItems: LineItemWithMetadata[],
  ): InvoiceLineItem[] {
    return lineItems.map((item) => ({
      id: item.id,
      invoiceId: "", // Will be set when persisted
      description: item.description,
      deliveryId: item.deliveryId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      metadata: item.metadata,
      createdAt: new Date(),
    }));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Helper function to create invoice generator config
 */
export function createInvoiceGeneratorConfig(
  tenantId: string,
  billingPeriodStart: Date,
  billingPeriodEnd: Date,
  billingRules: BillingRule[],
  options?: {
    customerId?: string;
    currency?: string;
    taxConfig?: Array<{
      jurisdiction: string;
      rate: number;
      description?: string;
    }>;
    discounts?: Array<{
      type: "percentage" | "fixed";
      value: number;
      description?: string;
    }>;
    notes?: string;
  },
): InvoiceGeneratorConfig {
  return {
    tenantId,
    customerId: options?.customerId,
    billingPeriodStart,
    billingPeriodEnd,
    currency: options?.currency || "USD",
    billingRules,
    taxConfig: options?.taxConfig,
    discounts: options?.discounts,
    notes: options?.notes,
  };
}
