/**
 * Invoice Service
 * Core business logic for invoice creation, finalization, payment tracking, and reporting.
 * Integrates cost calculator, number generator, and discount/tax application.
 */

import { PrismaClient } from "@witylogix/db";
import { generateInvoiceNumber } from "./invoice-number.js";
import { calculateDeliveryCost } from "./cost-calculator.js";
import type {
  Invoice,
  InvoiceStatus,
  CreateInvoiceParams,
  UpdateInvoiceParams,
  MarkAsPaidParams,
  InvoiceSummary,
  InvoiceDetailedSummary,
  RateCard,
  DeliveryForCosting,
  TaxConfig,
  InvoiceLineItem,
  InvoiceDiscount,
  InvoiceTax,
  PaymentRecord,
  CostBreakdown,
  ManualLineItemInput,
} from "./types.js";
import {
  InvoiceError,
  InvoiceNotFoundError,
  InvalidInvoiceStateError,
  RateCardNotFoundError,
  DeliveryNotFoundError,
} from "./types.js";

export class InvoiceService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new invoice from deliveries or routes
   * Calculates line items using rate cards, applies discounts, and computes taxes
   * @param params - Creation parameters including tenant, delivery/route IDs
   * @returns Invoice - Created invoice in DRAFT status
   */
  async createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    const {
      tenantId,
      customerId,
      deliveryIds = [],
      routeIds = [],
      manualLineItems,
      dueDate,
      currency = "USD",
      notes,
      terms,
      status: requestedStatus,
      taxRate,
      discountPercentage,
      discounts = [],
      taxConfig = [],
      rateCardId,
      metadata = {},
    } = params;

    const isManual = manualLineItems != null && manualLineItems.length > 0;

    // ─── VALIDATE INPUTS ────────────────────────────────────────────
    if (!isManual && deliveryIds.length === 0 && routeIds.length === 0) {
      throw new InvoiceError(
        "Must provide either deliveryIds, routeIds, or manualLineItems",
      );
    }

    // ─── MANUAL LINE ITEMS PATH ─────────────────────────────────────
    if (isManual) {
      const lineItems: Omit<
        InvoiceLineItem,
        "id" | "invoiceId" | "createdAt"
      >[] = (manualLineItems as ManualLineItemInput[]).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
      }));

      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

      // Normalize simple discountPercentage into discounts array
      const effectiveDiscounts =
        discounts.length > 0
          ? discounts
          : discountPercentage && discountPercentage > 0
            ? [
                {
                  description: "Discount",
                  type: "percentage" as const,
                  value: discountPercentage,
                },
              ]
            : [];

      const discountItems: Omit<
        InvoiceDiscount,
        "id" | "invoiceId" | "createdAt"
      >[] = [];
      let discountTotal = 0;
      for (const discount of effectiveDiscounts) {
        const amount =
          discount.type === "percentage"
            ? subtotal * (discount.value / 100)
            : discount.value;
        discountTotal += amount;
        discountItems.push({
          description: discount.description,
          type: discount.type,
          value: discount.value,
          amount,
        });
      }

      // Normalize simple taxRate into taxConfig
      const effectiveTaxConfig: TaxConfig[] =
        taxConfig.length > 0
          ? taxConfig
          : taxRate != null && taxRate > 0
            ? [{ jurisdiction: "standard", rate: taxRate }]
            : [];

      const taxItems: Omit<InvoiceTax, "id" | "invoiceId" | "createdAt">[] = [];
      const taxableAmount = subtotal - discountTotal;
      let taxTotal = 0;
      for (const tax of effectiveTaxConfig) {
        const amount = taxableAmount * (tax.rate / 100);
        taxTotal += amount;
        taxItems.push({
          description:
            tax.description || `Tax (${tax.jurisdiction || "Standard"})`,
          rate: tax.rate,
          amount,
          jurisdiction: tax.jurisdiction,
        });
      }

      const issuedAt = new Date();
      const dueAtDate =
        dueDate || new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const dbStatus = requestedStatus === "sent" ? "SENT" : "DRAFT";
      const notesValue = terms
        ? `${notes || ""}\n\n${terms}`.trim()
        : notes || null;

      const dbInvoice = await (this.prisma.invoice as any).create({
        data: {
          tenantId,
          customerId: customerId || null,
          invoiceNumber: "DRAFT-TEMP",
          status: dbStatus,
          subtotal,
          discountTotal,
          taxTotal,
          total: subtotal - discountTotal + taxTotal,
          currency,
          issuedAt,
          dueAt: dueAtDate,
          notes: notesValue,
          metadata: { ...metadata, createdFrom: "manual" },
          lineItems: { create: lineItems },
          discounts: { create: discountItems },
          taxes: { create: taxItems },
        },
        include: {
          lineItems: true,
          discounts: true,
          taxes: true,
          payments: true,
        },
      });

      return this.mapDbInvoice(dbInvoice);
    }

    // ─── GET RATE CARD (delivery/route path) ────────────────────────
    let rateCard: RateCard | null = null;
    if (rateCardId) {
      const dbRateCard = await (this.prisma.rateCard as any).findUnique({
        where: { id: rateCardId },
      });
      if (!dbRateCard) {
        throw new RateCardNotFoundError(rateCardId);
      }
      rateCard = this.mapDbRateCard(dbRateCard);
    } else {
      // Get default rate card
      const dbRateCard = await (this.prisma.rateCard as any).findFirst({
        where: { tenantId, isDefault: true },
        orderBy: { createdAt: "desc" },
      });
      if (!dbRateCard) {
        throw new RateCardNotFoundError(
          "No default rate card found for tenant",
        );
      }
      rateCard = this.mapDbRateCard(dbRateCard);
    }

    // ─── FETCH DELIVERIES ───────────────────────────────────────────
    const deliveryData: Array<{
      id: string;
      cost: CostBreakdown;
      metadata: Record<string, unknown>;
    }> = [];

    // From delivery IDs (orders/route stops)
    if (deliveryIds.length > 0) {
      for (const deliveryId of deliveryIds) {
        const delivery = await this.getDeliveryForCosting(deliveryId);
        if (!delivery) {
          throw new DeliveryNotFoundError(deliveryId);
        }
        const cost = calculateDeliveryCost(delivery, rateCard);
        deliveryData.push({
          id: deliveryId,
          cost,
          metadata: delivery.metadata || {},
        });
      }
    }

    // From route IDs (all stops in route)
    if (routeIds.length > 0) {
      for (const routeId of routeIds) {
        const stops = await this.getRouteStopsForCosting(routeId);
        for (const stop of stops) {
          const cost = calculateDeliveryCost(stop, rateCard);
          deliveryData.push({
            id: stop.id,
            cost,
            metadata: stop.metadata || {},
          });
        }
      }
    }

    // ─── CALCULATE SUBTOTAL ─────────────────────────────────────────
    const lineItems: Omit<InvoiceLineItem, "id" | "invoiceId" | "createdAt">[] =
      deliveryData.map((delivery) => ({
        description: `Delivery ${delivery.id.slice(0, 8)}`,
        deliveryId: delivery.id,
        quantity: 1,
        unitPrice: delivery.cost.finalCharge,
        amount: delivery.cost.finalCharge,
        metadata: delivery.cost,
      }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // ─── APPLY DISCOUNTS ────────────────────────────────────────────
    const discountItems: Omit<
      InvoiceDiscount,
      "id" | "invoiceId" | "createdAt"
    >[] = [];
    let discountTotal = 0;

    for (const discount of discounts) {
      let amount = 0;
      if (discount.type === "percentage") {
        amount = subtotal * (discount.value / 100);
      } else {
        amount = discount.value;
      }
      discountTotal += amount;
      discountItems.push({
        description: discount.description,
        type: discount.type,
        value: discount.value,
        amount,
      });
    }

    // ─── CALCULATE TAXES ────────────────────────────────────────────
    const taxItems: Omit<InvoiceTax, "id" | "invoiceId" | "createdAt">[] = [];
    const taxableAmount = subtotal - discountTotal;
    let taxTotal = 0;

    for (const tax of taxConfig) {
      const amount = taxableAmount * (tax.rate / 100);
      taxTotal += amount;
      taxItems.push({
        description:
          tax.description || `Tax (${tax.jurisdiction || "Standard"})`,
        rate: tax.rate,
        amount,
        jurisdiction: tax.jurisdiction,
      });
    }

    // ─── CREATE INVOICE IN DATABASE ─────────────────────────────────
    const issuedAt = new Date();
    const dueAtDate =
      dueDate || new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    const dbInvoice = await (this.prisma.invoice as any).create({
      data: {
        tenantId,
        customerId: customerId || null,
        invoiceNumber: "DRAFT-TEMP", // Will be updated on finalize
        status: "DRAFT",
        subtotal,
        discountTotal,
        taxTotal,
        total: subtotal - discountTotal + taxTotal,
        currency,
        issuedAt,
        dueAt: dueAtDate,
        notes: notes || null,
        metadata: {
          ...metadata,
          rateCardId,
          createdFrom: deliveryIds.length > 0 ? "deliveries" : "routes",
        },
        lineItems: {
          create: lineItems,
        },
        discounts: {
          create: discountItems,
        },
        taxes: {
          create: taxItems,
        },
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    return this.mapDbInvoice(dbInvoice);
  }

  /**
   * Finalize an invoice: assign invoice number and lock from editing
   * @param invoiceId - Invoice ID
   * @param tenantId - Tenant ID (for authorization)
   * @returns Invoice - Finalized invoice with assigned number
   */
  async finalizeInvoice(invoiceId: string, tenantId: string): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId, tenantId);

    if (invoice.status !== "draft") {
      throw new InvalidInvoiceStateError(invoiceId, invoice.status, "finalize");
    }

    // Generate unique invoice number
    const numberResult = await generateInvoiceNumber(tenantId, this.prisma);

    const updated = await (this.prisma.invoice as any).update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: numberResult.invoiceNumber,
        status: "FINALIZED",
        issuedAt: new Date(),
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    return this.mapDbInvoice(updated);
  }

  /**
   * Mark a finalized invoice as sent to the customer
   * @param invoiceId - Invoice ID
   * @param tenantId - Tenant ID
   * @returns Invoice - Updated invoice with status SENT
   */
  async sendInvoice(invoiceId: string, tenantId: string): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId, tenantId);

    if (invoice.status === "draft") {
      throw new InvalidInvoiceStateError(invoiceId, invoice.status, "send");
    }

    if (invoice.status === "voided") {
      throw new InvalidInvoiceStateError(invoiceId, invoice.status, "send");
    }

    const updated = await (this.prisma.invoice as any).update({
      where: { id: invoiceId },
      data: {
        status: "SENT",
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    return this.mapDbInvoice(updated);
  }

  /**
   * Void an invoice and record reason in audit trail
   * @param invoiceId - Invoice ID
   * @param tenantId - Tenant ID
   * @param reason - Reason for void
   * @returns Invoice - Voided invoice
   */
  async voidInvoice(
    invoiceId: string,
    tenantId: string,
    reason: string,
  ): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId, tenantId);

    if (invoice.status === "voided") {
      throw new InvalidInvoiceStateError(invoiceId, invoice.status, "void");
    }

    const updated = await (this.prisma.invoice as any).update({
      where: { id: invoiceId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidReason: reason,
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    return this.mapDbInvoice(updated);
  }

  /**
   * Record a payment against an invoice
   * @param invoiceId - Invoice ID
   * @param tenantId - Tenant ID
   * @param params - Payment details
   * @returns Invoice - Updated invoice
   */
  async markAsPaid(
    invoiceId: string,
    tenantId: string,
    params: MarkAsPaidParams,
  ): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId, tenantId);

    if (invoice.status === "voided") {
      throw new InvalidInvoiceStateError(
        invoiceId,
        invoice.status,
        "record payment for",
      );
    }

    // Create payment record
    await (this.prisma.invoicePayment as any).create({
      data: {
        invoiceId,
        amount: params.amount,
        method: params.method,
        reference: params.reference || null,
        paidAt: new Date(),
        metadata: params.metadata || {},
      },
    });

    // Calculate total paid
    const payments = await (this.prisma.invoicePayment as any).findMany({
      where: { invoiceId },
    });

    const totalPaid = payments.reduce(
      (sum: number, p: any) => sum + parseFloat(p.amount),
      0,
    );

    // Update status if fully paid
    const newStatus = totalPaid >= invoice.total ? "PAID" : invoice.status;

    const updated = await (this.prisma.invoice as any).update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        paidAt: totalPaid >= invoice.total ? new Date() : null,
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    return this.mapDbInvoice(updated);
  }

  /**
   * Get invoice by ID with all related data
   * @param invoiceId - Invoice ID
   * @param tenantId - Tenant ID (for authorization)
   * @returns Invoice - Full invoice data
   */
  async getInvoice(invoiceId: string, tenantId: string): Promise<Invoice> {
    const dbInvoice = await (this.prisma.invoice as any).findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    if (!dbInvoice) {
      throw new InvoiceNotFoundError(invoiceId);
    }

    return this.mapDbInvoice(dbInvoice);
  }

  /**
   * Get invoice by invoice number
   * @param invoiceNumber - Invoice number (INV-2026-00001 format)
   * @param tenantId - Tenant ID
   * @returns Invoice
   */
  async getInvoiceByNumber(
    invoiceNumber: string,
    tenantId: string,
  ): Promise<Invoice> {
    const dbInvoice = await (this.prisma.invoice as any).findFirst({
      where: { invoiceNumber, tenantId },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    if (!dbInvoice) {
      throw new InvoiceNotFoundError(invoiceNumber);
    }

    return this.mapDbInvoice(dbInvoice);
  }

  /**
   * Get invoices with filtering
   * @param tenantId - Tenant ID
   * @param filters - Status, customer, date range, amount range
   * @param pagination - Limit and offset
   * @returns Array of invoices
   */
  async listInvoices(
    tenantId: string,
    filters?: {
      status?: InvoiceStatus[];
      customerId?: string;
      fromDate?: Date;
      toDate?: Date;
      minAmount?: number;
      maxAmount?: number;
    },
    pagination?: { limit: number; offset: number },
  ): Promise<{ invoices: Invoice[]; total: number }> {
    const where: any = { tenantId };

    if (filters?.status && filters.status.length > 0) {
      where.status = { in: filters.status.map((s) => s.toUpperCase()) };
    }
    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }
    if (filters?.fromDate || filters?.toDate) {
      where.issuedAt = {};
      if (filters.fromDate) {
        where.issuedAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.issuedAt.lte = filters.toDate;
      }
    }
    if (filters?.minAmount !== undefined || filters?.maxAmount !== undefined) {
      where.total = {};
      if (filters.minAmount !== undefined) {
        where.total.gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        where.total.lte = filters.maxAmount;
      }
    }

    const [dbInvoices, total] = await Promise.all([
      (this.prisma.invoice as any).findMany({
        where,
        include: {
          lineItems: true,
          discounts: true,
          taxes: true,
          payments: true,
        },
        take: pagination?.limit || 50,
        skip: pagination?.offset || 0,
        orderBy: { issuedAt: "desc" },
      }),
      (this.prisma.invoice as any).count({ where }),
    ]);

    return {
      invoices: dbInvoices.map((inv: any) => this.mapDbInvoice(inv)),
      total,
    };
  }

  /**
   * Get aggregate invoice statistics for a date range
   * @param tenantId - Tenant ID
   * @param dateRange - From and to dates
   * @returns InvoiceSummary with totals and breakdown
   */
  async getInvoiceSummary(
    tenantId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<InvoiceSummary> {
    const from = dateRange?.from || new Date(new Date().getFullYear(), 0, 1);
    const to = dateRange?.to || new Date();

    const where = {
      tenantId,
      issuedAt: {
        gte: from,
        lte: to,
      },
    };

    const invoices = await (this.prisma.invoice as any).findMany({
      where,
      include: {
        payments: true,
      },
    });

    const totalInvoices = invoices.length;
    const totalBilled = invoices.reduce(
      (sum: number, inv: any) => sum + parseFloat(inv.total),
      0,
    );
    const totalPaid = invoices
      .filter((inv: any) => inv.status === "PAID")
      .reduce((sum: number, inv: any) => sum + parseFloat(inv.total), 0);
    const totalOutstanding = invoices
      .filter((inv: any) =>
        ["FINALIZED", "SENT", "OVERDUE"].includes(inv.status),
      )
      .reduce((sum: number, inv: any) => sum + parseFloat(inv.total), 0);
    const totalOverdue = invoices
      .filter((inv: any) => inv.status === "OVERDUE")
      .reduce((sum: number, inv: any) => sum + parseFloat(inv.total), 0);
    const totalVoided = invoices
      .filter((inv: any) => inv.status === "VOIDED")
      .reduce((sum: number, inv: any) => sum + parseFloat(inv.total), 0);

    const byStatus = {
      draft: invoices.filter((inv: any) => inv.status === "DRAFT").length,
      finalized: invoices.filter((inv: any) => inv.status === "FINALIZED")
        .length,
      sent: invoices.filter((inv: any) => inv.status === "SENT").length,
      paid: invoices.filter((inv: any) => inv.status === "PAID").length,
      overdue: invoices.filter((inv: any) => inv.status === "OVERDUE").length,
      voided: invoices.filter((inv: any) => inv.status === "VOIDED").length,
    };

    const byCurrency: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      byCurrency[inv.currency] =
        (byCurrency[inv.currency] || 0) + parseFloat(inv.total);
    });

    const averageInvoiceAmount =
      totalInvoices > 0 ? totalBilled / totalInvoices : 0;
    const finalizedCount = invoices.filter(
      (inv: any) => inv.status !== "DRAFT",
    ).length;
    const paymentRate =
      finalizedCount > 0 ? (byStatus.paid / finalizedCount) * 100 : 0;

    return {
      tenantId,
      dateRange: { from, to },
      totalInvoices,
      totalBilled,
      totalPaid,
      totalOutstanding,
      totalOverdue,
      totalVoided,
      byStatus,
      byCurrency,
      averageInvoiceAmount,
      paymentRate,
    };
  }

  // ─── PRIVATE HELPER METHODS ──────────────────────────────────────

  /**
   * Fetch a delivery/order for costing
   */
  private async getDeliveryForCosting(
    deliveryId: string,
  ): Promise<DeliveryForCosting | null> {
    // For MVP: fetch from Order/RouteStop with distance/weight data
    const order = await (this.prisma.order as any).findUnique({
      where: { id: deliveryId },
    });

    if (!order) {
      return null;
    }

    const distanceKm = order.metadata?.distanceKm || 0;
    const weightKg = order.totalWeight ? parseFloat(order.totalWeight) : 0;

    return {
      id: deliveryId,
      distanceKm,
      weightKg,
      pickupTime: order.createdAt,
      deliveryTime: order.actualDelivery,
      specialHandling: order.metadata?.specialHandling,
      metadata: order.metadata,
    };
  }

  /**
   * Fetch all stops in a route for costing
   */
  private async getRouteStopsForCosting(
    routeId: string,
  ): Promise<DeliveryForCosting[]> {
    const route = await (this.prisma.route as any).findUnique({
      where: { id: routeId },
      include: { stops: true },
    });

    if (!route) {
      return [];
    }

    return route.stops.map((stop: any) => ({
      id: stop.id,
      distanceKm: stop.metadata?.distanceKm || 0,
      weightKg: stop.metadata?.weightKg || 0,
      pickupTime: stop.createdAt,
      deliveryTime: stop.departedAt,
      specialHandling: stop.metadata?.specialHandling,
      metadata: stop.metadata,
    }));
  }

  /**
   * Map database rate card to RateCard type
   */
  private mapDbRateCard(dbCard: any): RateCard {
    return {
      id: dbCard.id,
      tenantId: dbCard.tenantId,
      name: dbCard.name,
      baseRate: parseFloat(dbCard.baseRate),
      perKmRate: parseFloat(dbCard.perKmRate),
      perKgRate: parseFloat(dbCard.perKgRate),
      distanceTiers: dbCard.distanceTierJson || [],
      weightTiers: dbCard.weightTierJson || [],
      peakSurchargePct: parseFloat(dbCard.peakSurchargePct),
      fuelSurchargePct: parseFloat(dbCard.fuelSurchargePct),
      specialHandling: dbCard.specialHandlingJson || {},
      minimumCharge: parseFloat(dbCard.minimumCharge),
      isDefault: dbCard.isDefault,
      effectiveFrom: dbCard.effectiveFrom,
      effectiveTo: dbCard.effectiveTo,
      createdAt: dbCard.createdAt,
      updatedAt: dbCard.updatedAt,
    };
  }

  /**
   * Map database invoice to Invoice type
   */
  private mapDbInvoice(dbInv: any): Invoice {
    return {
      id: dbInv.id,
      tenantId: dbInv.tenantId,
      invoiceNumber: dbInv.invoiceNumber,
      customerId: dbInv.customerId,
      status: dbInv.status.toLowerCase() as InvoiceStatus,
      subtotal: parseFloat(dbInv.subtotal),
      discountTotal: parseFloat(dbInv.discountTotal),
      taxTotal: parseFloat(dbInv.taxTotal),
      total: parseFloat(dbInv.total),
      currency: dbInv.currency,
      issuedAt: dbInv.issuedAt,
      dueAt: dbInv.dueAt,
      paidAt: dbInv.paidAt,
      voidedAt: dbInv.voidedAt,
      voidReason: dbInv.voidReason,
      notes: dbInv.notes,
      metadata: dbInv.metadata,
      lineItems: dbInv.lineItems?.map((item: any) => ({
        id: item.id,
        invoiceId: item.invoiceId,
        description: item.description,
        deliveryId: item.deliveryId,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        amount: parseFloat(item.amount),
        metadata: item.metadata,
        createdAt: item.createdAt,
      })),
      discounts: dbInv.discounts?.map((disc: any) => ({
        id: disc.id,
        invoiceId: disc.invoiceId,
        description: disc.description,
        type: disc.type.toLowerCase() as "percentage" | "fixed",
        value: parseFloat(disc.value),
        amount: parseFloat(disc.amount),
        createdAt: disc.createdAt,
      })),
      taxes: dbInv.taxes?.map((tax: any) => ({
        id: tax.id,
        invoiceId: tax.invoiceId,
        description: tax.description,
        rate: parseFloat(tax.rate),
        amount: parseFloat(tax.amount),
        jurisdiction: tax.jurisdiction,
        createdAt: tax.createdAt,
      })),
      payments: dbInv.payments?.map((pmt: any) => ({
        id: pmt.id,
        invoiceId: pmt.invoiceId,
        amount: parseFloat(pmt.amount),
        method: pmt.method,
        reference: pmt.reference,
        paidAt: pmt.paidAt,
        metadata: pmt.metadata,
        createdAt: pmt.createdAt,
      })),
      createdAt: dbInv.createdAt,
      updatedAt: dbInv.updatedAt,
    };
  }
}
