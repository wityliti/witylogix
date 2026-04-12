/**
 * Invoice Management Routes
 *
 * Routes:
 *   POST   /invoices                  — Create invoice from deliveries/routes
 *   GET    /invoices                  — List invoices (with filters: status, customer, dates, amounts)
 *   GET    /invoices/:id              — Get invoice detail with line items
 *   PUT    /invoices/:id              — Update draft invoice (notes, discounts, due date)
 *   POST   /invoices/:id/finalize     — Finalize invoice and assign number
 *   POST   /invoices/:id/void         — Void invoice with reason
 *   POST   /invoices/:id/payment      — Record payment
 *   GET    /invoices/:id/pdf          — Download invoice as PDF
 *   GET    /invoices/summary          — Get aggregate stats (total billed, paid, overdue, etc.)
 *   GET    /rate-cards                — List rate cards
 *   POST   /rate-cards                — Create rate card
 *   PUT    /rate-cards/:id            — Update rate card
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { InvoiceService, generateInvoicePDF } from '@witylogix/core/invoicing';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../lib/errors.js';

// ─── SCHEMAS ─────────────────────────────────────────────────────────

const createInvoiceSchema = z.object({
  customerId: z.string().optional(),
  deliveryIds: z.array(z.string().uuid()).optional(),
  routeIds: z.array(z.string().uuid()).optional(),
  manualLineItems: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().positive(),
      unitPrice: z.number().nonnegative(),
      taxable: z.boolean().optional(),
    }),
  ).optional(),
  dueDate: z.coerce.date().optional(),
  currency: z.string().length(3).default('USD'),
  notes: z.string().optional(),
  terms: z.string().optional(),
  status: z.enum(['draft', 'sent']).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  discounts: z.array(
    z.object({
      description: z.string(),
      type: z.enum(['percentage', 'fixed']),
      value: z.number().positive(),
    }),
  ).optional(),
  taxConfig: z.array(
    z.object({
      jurisdiction: z.string(),
      rate: z.number().min(0).max(100),
      description: z.string().optional(),
    }),
  ).optional(),
  rateCardId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateInvoiceSchema = z.object({
  notes: z.string().optional(),
  discounts: z.array(
    z.object({
      description: z.string(),
      type: z.enum(['percentage', 'fixed']),
      value: z.number().positive(),
    }),
  ).optional(),
  dueDate: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const voidInvoiceSchema = z.object({
  reason: z.string().min(1, 'Void reason is required'),
});

const markAsPaidSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['credit_card', 'bank_transfer', 'check', 'cash', 'other']),
  reference: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listInvoicesSchema = z.object({
  status: z.array(z.enum(['draft', 'finalized', 'sent', 'paid', 'overdue', 'voided'])).optional(),
  customerId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const createRateCardSchema = z.object({
  name: z.string().min(1),
  baseRate: z.number().positive(),
  perKmRate: z.number().positive(),
  perKgRate: z.number().positive(),
  distanceTiers: z.array(
    z.object({
      minKm: z.number().nonnegative(),
      maxKm: z.number().positive().nullable(),
      rateMultiplier: z.number().positive(),
    }),
  ).optional(),
  weightTiers: z.array(
    z.object({
      minKg: z.number().nonnegative(),
      maxKg: z.number().positive().nullable(),
      ratePerKg: z.number().positive(),
    }),
  ).optional(),
  peakSurchargePct: z.number().nonnegative().default(20),
  fuelSurchargePct: z.number().nonnegative().default(10),
  specialHandling: z.object({
    fragile: z.number().optional(),
    refrigerated: z.number().optional(),
    oversized: z.number().optional(),
  }).optional(),
  minimumCharge: z.number().nonnegative().default(8),
  isDefault: z.boolean().default(false),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
});

const updateRateCardSchema = z.object({
  name: z.string().optional(),
  baseRate: z.number().positive().optional(),
  perKmRate: z.number().positive().optional(),
  perKgRate: z.number().positive().optional(),
  peakSurchargePct: z.number().nonnegative().optional(),
  fuelSurchargePct: z.number().nonnegative().optional(),
  minimumCharge: z.number().nonnegative().optional(),
  isDefault: z.boolean().optional(),
  effectiveTo: z.coerce.date().optional(),
});

const summaryDateRangeSchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────────────

async function invoicesRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication and tenant context
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  const invoiceService = new InvoiceService((fastify as any).prisma);

  // ── POST /invoices ───────────────────────────────────────────────────
  /**
   * Create a new invoice from deliveries or routes
   * Calculates line items, applies discounts, and computes taxes
   */
  fastify.post('/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const body = createInvoiceSchema.parse(request.body);

    try {
      const invoice = await invoiceService.createInvoice({
        tenantId,
        ...body,
      });

      return reply.status(201).send({
        invoice,
        message: 'Invoice created successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError('Delivery or Route', body.deliveryIds?.[0] || body.routeIds?.[0] || '');
      }
      throw error;
    }
  });

  // ── GET /invoices ────────────────────────────────────────────────────
  /**
   * List invoices with filtering and pagination
   */
  fastify.get('/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const query = listInvoicesSchema.parse(request.query);

    const result = await invoiceService.listInvoices(
      tenantId,
      {
        status: query.status,
        customerId: query.customerId,
        fromDate: query.fromDate,
        toDate: query.toDate,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
      },
      { limit: query.limit, offset: query.offset },
    );

    return reply.send({
      invoices: result.invoices,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: result.total,
      },
    });
  });

  // ── GET /invoices/summary ────────────────────────────────────────────
  /**
   * Get aggregate invoice statistics
   */
  fastify.get('/invoices/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const query = summaryDateRangeSchema.parse(request.query);

    const summary = await invoiceService.getInvoiceSummary(tenantId, {
      from: query.fromDate || new Date(new Date().getFullYear(), 0, 1),
      to: query.toDate || new Date(),
    });

    return reply.send({
      summary,
    });
  });

  // ── GET /invoices/:id ────────────────────────────────────────────────
  /**
   * Get invoice detail with all line items, discounts, and taxes
   */
  fastify.get('/invoices/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const { id } = request.params as { id: string };

    try {
      const invoice = await invoiceService.getInvoice(id, tenantId);
      return reply.send({ invoice });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError('Invoice', id);
      }
      throw error;
    }
  });

  // ── PUT /invoices/:id ────────────────────────────────────────────────
  /**
   * Update a draft invoice (notes, discounts, due date)
   */
  fastify.put('/invoices/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const { id } = request.params as { id: string };
    const body = updateInvoiceSchema.parse(request.body);

    try {
      // Fetch current invoice
      const invoice = await invoiceService.getInvoice(id, tenantId);

      if (invoice.status !== 'draft') {
        throw new ForbiddenError('Can only update draft invoices');
      }

      // For MVP: simple update to metadata/notes
      // Full update would require recreating line items with new calculations
      const updated = await (fastify as any).prisma.invoice.update({
        where: { id },
        data: {
          notes: body.notes ?? invoice.notes,
          dueAt: body.dueDate ?? invoice.dueAt,
          metadata: body.metadata ?? invoice.metadata,
        },
        include: {
          lineItems: true,
          discounts: true,
          taxes: true,
          payments: true,
        },
      });

      return reply.send({
        invoice: (invoiceService as any).mapDbInvoice(updated),
        message: 'Invoice updated successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError('Invoice', id);
      }
      throw error;
    }
  });

  // ── POST /invoices/:id/finalize ──────────────────────────────────────
  /**
   * Finalize invoice: assign number and lock from editing
   */
  fastify.post('/invoices/:id/finalize', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const { id } = request.params as { id: string };

    try {
      const invoice = await invoiceService.finalizeInvoice(id, tenantId);

      return reply.send({
        invoice,
        message: 'Invoice finalized successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError('Invoice', id);
      }
      throw error;
    }
  });

  // ── POST /invoices/:id/void ──────────────────────────────────────────
  /**
   * Void an invoice with reason
   */
  fastify.post('/invoices/:id/void', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const { id } = request.params as { id: string };
    const body = voidInvoiceSchema.parse(request.body);

    try {
      const invoice = await invoiceService.voidInvoice(id, tenantId, body.reason);

      return reply.send({
        invoice,
        message: 'Invoice voided successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError('Invoice', id);
      }
      throw error;
    }
  });

  // ── POST /invoices/:id/payment ───────────────────────────────────────
  /**
   * Record a payment against an invoice
   */
  fastify.post(
    '/invoices/:id/payment',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tenantId } = request;
      const { id } = request.params as { id: string };
      const body = markAsPaidSchema.parse(request.body);

      try {
        const invoice = await invoiceService.markAsPaid(id, tenantId, body);

        return reply.send({
          invoice,
          message: 'Payment recorded successfully',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new NotFoundError('Invoice', id);
        }
        throw error;
      }
    },
  );

  // ── GET /invoices/:id/pdf ────────────────────────────────────────────
  /**
   * Download invoice as PDF
   */
  fastify.get('/invoices/:id/pdf', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const { id } = request.params as { id: string };

    try {
      const invoice = await invoiceService.getInvoice(id, tenantId);

      const pdfBuffer = await generateInvoicePDF(invoice, {
        companyName: 'Witylogix',
        companyEmail: 'billing@witylogix.com',
        companyPhone: '+1 (555) 123-4567',
        companyWebsite: 'www.witylogix.com',
      });

      reply.header('Content-Type', 'application/pdf');
      reply.header(
        'Content-Disposition',
        `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      );

      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundError('Invoice', id);
      }
      throw error;
    }
  });

  // ── GET /rate-cards ──────────────────────────────────────────────────
  /**
   * List rate cards for tenant
   */
  fastify.get('/rate-cards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;

    const rateCards = await (fastify as any).prisma.rateCard.findMany({
      where: { tenantId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return reply.send({
      rateCards,
    });
  });

  // ── POST /rate-cards ─────────────────────────────────────────────────
  /**
   * Create a new rate card
   */
  fastify.post('/rate-cards', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const body = createRateCardSchema.parse(request.body);

    // If marking as default, unset other defaults
    if (body.isDefault) {
      await (fastify as any).prisma.rateCard.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const rateCard = await (fastify as any).prisma.rateCard.create({
      data: {
        tenantId,
        name: body.name,
        baseRate: body.baseRate,
        perKmRate: body.perKmRate,
        perKgRate: body.perKgRate,
        distanceTierJson: body.distanceTiers || [],
        weightTierJson: body.weightTiers || [],
        peakSurchargePct: body.peakSurchargePct,
        fuelSurchargePct: body.fuelSurchargePct,
        specialHandlingJson: body.specialHandling || {},
        minimumCharge: body.minimumCharge,
        isDefault: body.isDefault,
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo || null,
      },
    });

    return reply.status(201).send({
      rateCard,
      message: 'Rate card created successfully',
    });
  });

  // ── PUT /rate-cards/:id ──────────────────────────────────────────────
  /**
   * Update a rate card
   */
  fastify.put('/rate-cards/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = request;
    const { id } = request.params as { id: string };
    const body = updateRateCardSchema.parse(request.body);

    // Verify ownership
    const existing = await (fastify as any).prisma.rateCard.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Rate Card', id);
    }

    // If marking as default, unset other defaults
    if (body.isDefault) {
      await (fastify as any).prisma.rateCard.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const rateCard = await (fastify as any).prisma.rateCard.update({
      where: { id },
      data: {
        name: body.name,
        baseRate: body.baseRate,
        perKmRate: body.perKmRate,
        perKgRate: body.perKgRate,
        peakSurchargePct: body.peakSurchargePct,
        fuelSurchargePct: body.fuelSurchargePct,
        minimumCharge: body.minimumCharge,
        isDefault: body.isDefault,
        effectiveTo: body.effectiveTo || null,
      },
    });

    return reply.send({
      rateCard,
      message: 'Rate card updated successfully',
    });
  });
}

export default invoicesRoutes;
