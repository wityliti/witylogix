/**
 * Invoice Service Tests
 * Comprehensive tests for invoice creation, finalization, payment, and reporting
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InvoiceService } from "../invoice-service.js";
import {
  InvoiceNotFoundError,
  InvalidInvoiceStateError,
  RateCardNotFoundError,
} from "../types.js";
import type { RateCard, DeliveryForCosting } from "../types.js";

// ─── FIXTURES ────────────────────────────────────────────────────────

const mockRateCard: RateCard = {
  id: "rc-1",
  tenantId: "tenant-1",
  name: "Standard",
  baseRate: 5.0,
  perKmRate: 1.0,
  perKgRate: 0.5,
  distanceTiers: [
    { minKm: 0, maxKm: 5, rateMultiplier: 1.0 },
    { minKm: 5, maxKm: null, rateMultiplier: 1.5 },
  ],
  weightTiers: [
    { minKm: 0, maxKm: 5, ratePerKg: 0.5 },
    { minKm: 5, maxKm: null, ratePerKg: 2.0 },
  ],
  peakSurchargePct: 20,
  fuelSurchargePct: 10,
  specialHandling: { fragile: 15 },
  minimumCharge: 8.0,
  isDefault: true,
  effectiveFrom: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("InvoiceService", () => {
  let service: InvoiceService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      rateCard: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      invoice: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      invoicePayment: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      invoiceNumberCounter: {
        upsert: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
      },
      route: {
        findUnique: vi.fn(),
      },
    };

    service = new InvoiceService(mockPrisma);
  });

  describe("createInvoice", () => {
    it("should reject if no delivery or route IDs provided", async () => {
      await expect(
        service.createInvoice({
          tenantId: "tenant-1",
        }),
      ).rejects.toThrow(
        "Must provide either deliveryIds, routeIds, or manualLineItems",
      );
    });

    it("should throw if rate card not found", async () => {
      mockPrisma.rateCard.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvoice({
          tenantId: "tenant-1",
          deliveryIds: ["delv-1"],
          rateCardId: "rc-missing",
        }),
      ).rejects.toThrow(RateCardNotFoundError);
    });

    it("should use default rate card when not specified", async () => {
      mockPrisma.rateCard.findFirst.mockResolvedValue(mockRateCard);
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "delv-1",
        totalWeight: 5,
        createdAt: new Date(),
        metadata: { distanceKm: 3 },
      });
      mockPrisma.invoice.create.mockResolvedValue({
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "DRAFT-TEMP",
        status: "DRAFT",
        subtotal: 10,
        discountTotal: 0,
        taxTotal: 0,
        total: 10,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
      });

      const invoice = await service.createInvoice({
        tenantId: "tenant-1",
        deliveryIds: ["delv-1"],
      });

      expect(invoice).toBeDefined();
      expect(invoice.status).toBe("draft");
      expect(invoice.invoiceNumber).toBe("DRAFT-TEMP");
    });

    it("should create invoice with line items", async () => {
      mockPrisma.rateCard.findFirst.mockResolvedValue(mockRateCard);
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "delv-1",
        totalWeight: 2,
        createdAt: new Date(),
        metadata: { distanceKm: 3 },
      });

      const mockCreatedInvoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "DRAFT-TEMP",
        status: "DRAFT",
        subtotal: 10,
        discountTotal: 0,
        taxTotal: 0,
        total: 10,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [{ id: "li-1", description: "Delivery", amount: 10 }],
        discounts: [],
        taxes: [],
        payments: [],
      };

      mockPrisma.invoice.create.mockResolvedValue(mockCreatedInvoice);

      const invoice = await service.createInvoice({
        tenantId: "tenant-1",
        deliveryIds: ["delv-1"],
      });

      expect(mockPrisma.invoice.create).toHaveBeenCalled();
      expect(invoice.lineItems).toBeDefined();
    });

    it("should apply discounts to invoice", async () => {
      mockPrisma.rateCard.findFirst.mockResolvedValue(mockRateCard);
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "delv-1",
        totalWeight: 2,
        createdAt: new Date(),
        metadata: { distanceKm: 3 },
      });

      mockPrisma.invoice.create.mockResolvedValue({
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "DRAFT-TEMP",
        status: "DRAFT",
        subtotal: 10,
        discountTotal: 1, // 10% discount
        taxTotal: 0,
        total: 9,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [
          {
            id: "disc-1",
            description: "Volume Discount",
            type: "PERCENTAGE",
            value: "10",
            amount: "1",
          },
        ],
        taxes: [],
        payments: [],
      });

      const invoice = await service.createInvoice({
        tenantId: "tenant-1",
        deliveryIds: ["delv-1"],
        discounts: [
          { description: "Volume Discount", type: "percentage", value: 10 },
        ],
      });

      expect(invoice.discountTotal).toBe(1);
      expect(invoice.total).toBe(9);
    });

    it("should apply taxes to invoice", async () => {
      mockPrisma.rateCard.findFirst.mockResolvedValue(mockRateCard);
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "delv-1",
        totalWeight: 2,
        createdAt: new Date(),
        metadata: { distanceKm: 3 },
      });

      mockPrisma.invoice.create.mockResolvedValue({
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "DRAFT-TEMP",
        status: "DRAFT",
        subtotal: 10,
        discountTotal: 0,
        taxTotal: 0.75, // 7.5% tax
        total: 10.75,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [
          { id: "tax-1", description: "Sales Tax", rate: 7.5, amount: 0.75 },
        ],
        payments: [],
      });

      const invoice = await service.createInvoice({
        tenantId: "tenant-1",
        deliveryIds: ["delv-1"],
        taxConfig: [{ jurisdiction: "CA", rate: 7.5 }],
      });

      expect(invoice.taxTotal).toBe(0.75);
      expect(invoice.total).toBeCloseTo(10.75, 2);
    });
  });

  describe("finalizeInvoice", () => {
    it("should assign invoice number and finalize", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        id: "inv-1",
        status: "DRAFT",
        tenantId: "tenant-1",
      });

      mockPrisma.invoiceNumberCounter.upsert.mockResolvedValue({
        tenantId: "tenant-1",
        prefix: "INV",
        year: 2026,
        currentNumber: 1,
      });

      mockPrisma.invoice.update.mockResolvedValue({
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "FINALIZED",
        subtotal: 10,
        discountTotal: 0,
        taxTotal: 0,
        total: 10,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
      });

      const invoice = await service.finalizeInvoice("inv-1", "tenant-1");

      expect(invoice.status).toBe("finalized");
      expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    });

    it("should reject finalization of non-draft invoice", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        id: "inv-1",
        status: "FINALIZED",
        tenantId: "tenant-1",
      });

      await expect(
        service.finalizeInvoice("inv-1", "tenant-1"),
      ).rejects.toThrow(InvalidInvoiceStateError);
    });
  });

  describe("voidInvoice", () => {
    it("should void invoice with reason", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        id: "inv-1",
        status: "FINALIZED",
        tenantId: "tenant-1",
      });

      mockPrisma.invoice.update.mockResolvedValue({
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "VOIDED",
        voidedAt: new Date(),
        voidReason: "Duplicate entry",
        subtotal: 10,
        discountTotal: 0,
        taxTotal: 0,
        total: 10,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
      });

      const invoice = await service.voidInvoice(
        "inv-1",
        "tenant-1",
        "Duplicate entry",
      );

      expect(invoice.status).toBe("voided");
      expect(invoice.voidReason).toBe("Duplicate entry");
    });

    it("should reject voiding already voided invoice", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        id: "inv-1",
        status: "VOIDED",
        tenantId: "tenant-1",
      });

      await expect(
        service.voidInvoice("inv-1", "tenant-1", "Already voided"),
      ).rejects.toThrow(InvalidInvoiceStateError);
    });
  });

  describe("markAsPaid", () => {
    it("should record payment and update status", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        id: "inv-1",
        status: "FINALIZED",
        tenantId: "tenant-1",
        total: 100,
      });

      mockPrisma.invoicePayment.create.mockResolvedValue({
        id: "pmt-1",
        invoiceId: "inv-1",
        amount: 100,
        method: "credit_card",
        paidAt: new Date(),
      });

      mockPrisma.invoicePayment.findMany.mockResolvedValue([
        { id: "pmt-1", amount: 100, paidAt: new Date() },
      ]);

      mockPrisma.invoice.update.mockResolvedValue({
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "PAID",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        paidAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [
          {
            id: "pmt-1",
            amount: 100,
            method: "credit_card",
            paidAt: new Date(),
          },
        ],
      });

      const invoice = await service.markAsPaid("inv-1", "tenant-1", {
        amount: 100,
        method: "credit_card",
      });

      expect(invoice.status).toBe("paid");
      expect(invoice.paidAt).toBeDefined();
    });
  });

  describe("getInvoice", () => {
    it("should retrieve invoice by ID", async () => {
      const mockInvoice = {
        id: "inv-1",
        tenantId: "tenant-1",
        invoiceNumber: "INV-2026-00001",
        status: "FINALIZED",
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 7.5,
        total: 107.5,
        currency: "USD",
        issuedAt: new Date(),
        dueAt: new Date(),
        lineItems: [],
        discounts: [],
        taxes: [],
        payments: [],
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      const invoice = await service.getInvoice("inv-1", "tenant-1");

      expect(invoice.id).toBe("inv-1");
      expect(invoice.invoiceNumber).toBe("INV-2026-00001");
    });

    it("should throw if invoice not found", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.getInvoice("inv-missing", "tenant-1"),
      ).rejects.toThrow(InvoiceNotFoundError);
    });
  });

  describe("listInvoices", () => {
    it("should list invoices with pagination", async () => {
      const mockInvoices = [
        {
          id: "inv-1",
          tenantId: "tenant-1",
          status: "FINALIZED",
          total: 100,
          issuedAt: new Date(),
          lineItems: [],
          discounts: [],
          taxes: [],
          payments: [],
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await service.listInvoices(
        "tenant-1",
        {},
        { limit: 10, offset: 0 },
      );

      expect(result.invoices).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should filter by status", async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(0);

      await service.listInvoices("tenant-1", { status: ["paid"] });

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ["PAID"] },
          }),
        }),
      );
    });
  });

  describe("getInvoiceSummary", () => {
    it("should generate summary statistics", async () => {
      const mockInvoices = [
        {
          id: "inv-1",
          status: "PAID",
          total: 100,
          currency: "USD",
          issuedAt: new Date(),
          payments: [],
        },
        {
          id: "inv-2",
          status: "FINALIZED",
          total: 50,
          currency: "USD",
          issuedAt: new Date(),
          payments: [],
        },
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);

      const summary = await service.getInvoiceSummary("tenant-1");

      expect(summary.totalInvoices).toBe(2);
      expect(summary.totalBilled).toBe(150);
      expect(summary.byStatus.paid).toBe(1);
      expect(summary.byStatus.finalized).toBe(1);
    });
  });
});
