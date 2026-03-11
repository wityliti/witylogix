/**
 * Invoice API Routes
 * RESTful API endpoints for invoice management
 * GET/POST/PUT for invoices, PDF generation, payments, and reminders
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '@witylogix/db';
import {
  InvoiceGenerator,
  generateInvoicePDF,
  PaymentReminderService,
  InvoiceNotFoundError,
  InvalidInvoiceStateError,
} from '@witylogix/core';
import type {
  Invoice,
  InvoiceStatus,
  CreateInvoiceParams,
  UpdateInvoiceParams,
  MarkAsPaidParams,
  InvoiceSummary,
} from '@witylogix/core';

const router = Router();

// ─── MIDDLEWARE ────────────────────────────────────────────────────────

interface AuthenticatedRequest extends Request {
  tenantId?: string;
  userId?: string;
}

const requireAuth = (req: AuthenticatedRequest, res: Response, next: () => void): void => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

// ─── LIST INVOICES ────────────────────────────────────────────────────

/**
 * GET /invoices
 * List invoices with filtering and pagination
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const {
      status,
      customerId,
      from,
      to,
      minAmount,
      maxAmount,
      skip = 0,
      take = 20,
    } = req.query;

    const filters: Prisma.InvoiceWhereInput = {
      tenantId,
    };

    if (status) {
      filters.status = status as InvoiceStatus;
    }

    if (customerId) {
      filters.customerId = customerId as string;
    }

    if (from || to) {
      filters.issuedAt = {};
      if (from) {
        (filters.issuedAt as any).gte = new Date(from as string);
      }
      if (to) {
        (filters.issuedAt as any).lte = new Date(to as string);
      }
    }

    if (minAmount || maxAmount) {
      filters.total = {};
      if (minAmount) {
        (filters.total as any).gte = parseFloat(minAmount as string);
      }
      if (maxAmount) {
        (filters.total as any).lte = parseFloat(maxAmount as string);
      }
    }

    const [invoices, total] = await Promise.all([
      (prisma as any).Invoice.findMany({
        where: filters,
        include: {
          lineItems: true,
          discounts: true,
          taxes: true,
          payments: true,
        },
        orderBy: { issuedAt: 'desc' },
        skip: parseInt(skip as string),
        take: parseInt(take as string),
      }),
      (prisma as any).Invoice.count({ where: filters }),
    ]);

    res.json({
      data: invoices,
      pagination: {
        total,
        skip: parseInt(skip as string),
        take: parseInt(take as string),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list invoices', details: String(error) });
  }
});

// ─── GET INVOICE DETAIL ────────────────────────────────────────────────

/**
 * GET /invoices/:id
 * Get invoice details
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const invoice = await (prisma as any).Invoice.findUnique({
      where: { id },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json({ data: invoice });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve invoice', details: String(error) });
  }
});

// ─── CREATE INVOICE ────────────────────────────────────────────────────

/**
 * POST /invoices
 * Create a new invoice
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { customerId, lineItems, discounts, taxes, notes, currency = 'USD', dueDate } = req.body;

    // Calculate totals
    const subtotal = (lineItems || []).reduce((sum: number, item: any) => sum + item.amount, 0);
    const discountTotal = (discounts || []).reduce((sum: number, item: any) => sum + item.amount, 0);
    const taxTotal = (taxes || []).reduce((sum: number, item: any) => sum + item.amount, 0);
    const total = subtotal - discountTotal + taxTotal;

    // Generate invoice number
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const counter = await (prisma as any).InvoiceNumberCounter.findUnique({
      where: { tenantId },
    });

    const nextNumber = ((counter?.currentNumber || 0) + 1).toString().padStart(5, '0');
    const invoiceNumber = `WL-INV-${year}${month}-${nextNumber}`;

    // Create invoice
    const invoice = await (prisma as any).Invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        customerId,
        status: 'draft',
        subtotal,
        discountTotal,
        taxTotal,
        total,
        currency,
        issuedAt: new Date(),
        dueAt: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes,
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    // Update counter
    if (counter) {
      await (prisma as any).InvoiceNumberCounter.update({
        where: { tenantId },
        data: { currentNumber: nextNumber },
      });
    } else {
      await (prisma as any).InvoiceNumberCounter.create({
        data: {
          tenantId,
          year,
          currentNumber: parseInt(nextNumber),
        },
      });
    }

    res.status(201).json({ data: invoice });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create invoice', details: String(error) });
  }
});

// ─── UPDATE INVOICE ────────────────────────────────────────────────────

/**
 * PUT /invoices/:id
 * Update invoice (only draft invoices)
 */
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { notes, dueDate } = req.body;

    const invoice = await (prisma as any).Invoice.findUnique({
      where: { id },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (invoice.status !== 'DRAFT') {
      res.status(400).json({ error: 'Only draft invoices can be modified' });
      return;
    }

    const updated = await (prisma as any).Invoice.update({
      where: { id },
      data: {
        notes: notes || invoice.notes,
        dueAt: dueDate || invoice.dueAt,
        updatedAt: new Date(),
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    res.json({ data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update invoice', details: String(error) });
  }
});

// ─── GENERATE PDF ────────────────────────────────────────────────────

/**
 * POST /invoices/:id/pdf
 * Generate and download invoice PDF
 */
router.post('/:id/pdf', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const invoice = await (prisma as any).Invoice.findUnique({
      where: { id },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, {
      companyName: 'Witylogix',
      companyEmail: 'billing@witylogix.com',
      companyPhone: '+1 (555) 123-4567',
      primaryColor: '#2563EB',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate PDF', details: String(error) });
  }
});

// ─── SEND INVOICE ────────────────────────────────────────────────────

/**
 * POST /invoices/:id/send
 * Send invoice to customer
 */
router.post('/:id/send', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { email } = req.body;

    const invoice = await (prisma as any).Invoice.findUnique({
      where: { id },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (invoice.status === 'DRAFT') {
      res.status(400).json({ error: 'Cannot send draft invoice. Finalize it first.' });
      return;
    }

    if (invoice.status === 'VOIDED') {
      res.status(400).json({ error: 'Cannot send voided invoice.' });
      return;
    }

    // Update status to SENT
    const updated = await (prisma as any).Invoice.update({
      where: { id },
      data: {
        status: 'SENT',
        updatedAt: new Date(),
      },
    });

    // In production, send email here using invoice-email service
    // await sendInvoiceEmail({ invoice, recipientEmail: email });

    res.json({
      data: updated,
      message: `Invoice sent to ${email}`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send invoice', details: String(error) });
  }
});

// ─── MARK AS PAID ────────────────────────────────────────────────────

/**
 * POST /invoices/:id/mark-paid
 * Record payment and mark invoice as paid
 */
router.post('/:id/mark-paid', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { amount, method, reference } = req.body;

    const invoice = await (prisma as any).Invoice.findUnique({
      where: { id },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (invoice.status === 'DRAFT') {
      res.status(400).json({ error: 'Cannot mark draft invoice as paid.' });
      return;
    }

    // Record payment
    await (prisma as any).InvoicePayment.create({
      data: {
        invoiceId: id,
        amount,
        method,
        reference,
        paidAt: new Date(),
      },
    });

    // Calculate total paid
    const payments = await (prisma as any).InvoicePayment.findMany({
      where: { invoiceId: id },
    });

    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

    // Update invoice status
    const newStatus = totalPaid >= invoice.total ? 'PAID' : invoice.status;

    const updated = await (prisma as any).Invoice.update({
      where: { id },
      data: {
        status: newStatus,
        paidAt: newStatus === 'PAID' ? new Date() : undefined,
        updatedAt: new Date(),
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    res.json({ data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record payment', details: String(error) });
  }
});

// ─── VOID INVOICE ────────────────────────────────────────────────────

/**
 * POST /invoices/:id/void
 * Void an invoice
 */
router.post('/:id/void', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { reason } = req.body;

    const invoice = await (prisma as any).Invoice.findUnique({
      where: { id },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (invoice.status === 'VOIDED') {
      res.status(400).json({ error: 'Invoice is already voided.' });
      return;
    }

    const updated = await (prisma as any).Invoice.update({
      where: { id },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidReason: reason,
        updatedAt: new Date(),
      },
      include: {
        lineItems: true,
        discounts: true,
        taxes: true,
        payments: true,
      },
    });

    res.json({ data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to void invoice', details: String(error) });
  }
});

// ─── SEND REMINDER ────────────────────────────────────────────────────

/**
 * POST /invoices/:id/reminder
 * Send payment reminder for invoice
 */
router.post('/:id/reminder', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { email, reminderType = 'after-due' } = req.body;

    const invoice = await (prisma as any).Invoice.findUnique({
      where: { id },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Build reminder message
    const subject = PaymentReminderService.getReminderSubject(invoice, reminderType);
    const body = PaymentReminderService.getReminderBody(invoice, reminderType);

    // In production, send email here
    // await sendPaymentReminderEmail({ invoice, email, daysOverdue, ...});

    res.json({
      message: 'Reminder sent',
      reminder: {
        invoiceId: id,
        type: reminderType,
        sentTo: email,
        subject,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reminder', details: String(error) });
  }
});

export default router;
