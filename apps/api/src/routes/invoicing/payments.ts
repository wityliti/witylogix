/**
 * Payment API Routes
 * RESTful API endpoints for payment processing and reconciliation
 * Stripe webhook handling, payment recording, and refund management
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '@witylogix/db';
import {
  PaymentReconciliation,
  PaymentGatewayFactory,
  PaymentGatewayError,
  StripeAdapter,
  ManualPaymentAdapter,
} from '@witylogix/core';
import type { PaymentMethod } from '@witylogix/core';

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

// ─── LIST PAYMENTS ────────────────────────────────────────────────────

/**
 * GET /payments
 * List payments with filtering
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { invoiceId, method, from, to, skip = 0, take = 20, status = 'completed' } = req.query;

    const filters: Prisma.InvoicePaymentWhereInput = {
      invoice: {
        tenantId,
      },
    };

    if (invoiceId) {
      filters.invoiceId = invoiceId as string;
    }

    if (method) {
      filters.method = method as PaymentMethod;
    }

    if (from || to) {
      filters.paidAt = {};
      if (from) {
        (filters.paidAt as any).gte = new Date(from as string);
      }
      if (to) {
        (filters.paidAt as any).lte = new Date(to as string);
      }
    }

    const [payments, total] = await Promise.all([
      db.invoicePayment.findMany({
        where: filters,
        include: {
          invoice: true,
        },
        orderBy: { paidAt: 'desc' },
        skip: parseInt(skip as string),
        take: parseInt(take as string),
      }),
      db.invoicePayment.count({ where: filters }),
    ]);

    res.json({
      data: payments,
      pagination: {
        total,
        skip: parseInt(skip as string),
        take: parseInt(take as string),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list payments', details: String(error) });
  }
});

// ─── GET PAYMENT DETAIL ────────────────────────────────────────────────

/**
 * GET /payments/:id
 * Get payment details
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const payment = await db.invoicePayment.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    });

    if (!payment || payment.invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    res.json({ data: payment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve payment', details: String(error) });
  }
});

// ─── CREATE PAYMENT LINK (STRIPE) ──────────────────────────────────────

/**
 * POST /payments/create-link
 * Create Stripe payment link
 */
router.post('/create-link', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { invoiceId, successUrl, cancelUrl } = req.body;
    const tenantId = req.tenantId!;

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Create Stripe payment link
    const gateway = PaymentGatewayFactory.getGateway('stripe', {
      apiKey: process.env.STRIPE_API_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const { url, id } = await gateway.createPaymentLink({
      invoiceId,
      amount: invoice.total,
      currency: invoice.currency,
      returnUrl: successUrl,
      successUrl,
      cancelUrl,
    });

    res.json({
      data: {
        id,
        url,
        invoiceId,
        amount: invoice.total,
        currency: invoice.currency,
      },
    });
  } catch (error) {
    if (error instanceof PaymentGatewayError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create payment link', details: String(error) });
    }
  }
});

// ─── RECORD MANUAL PAYMENT ────────────────────────────────────────────

/**
 * POST /payments
 * Record manual payment (bank transfer, check, cash)
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { invoiceId, amount, method, reference } = req.body;

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Validate payment method
    const validMethods: PaymentMethod[] = ['bank_transfer', 'check', 'cash', 'credit_card', 'other'];
    if (!validMethods.includes(method)) {
      res.status(400).json({ error: `Invalid payment method: ${method}` });
      return;
    }

    // Record payment in database
    const payment = await db.invoicePayment.create({
      data: {
        invoiceId,
        amount,
        method,
        reference,
        paidAt: new Date(),
      },
      include: {
        invoice: true,
      },
    });

    // Calculate total paid
    const allPayments = await db.invoicePayment.findMany({
      where: { invoiceId },
    });

    const totalPaid = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

    // Update invoice status
    let newStatus = invoice.status;
    let paidAt = invoice.paidAt;

    if (totalPaid >= invoice.total) {
      newStatus = 'PAID';
      paidAt = new Date();
    } else if (invoice.status === 'DRAFT') {
      newStatus = 'SENT';
    }

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        paidAt,
        updatedAt: new Date(),
      },
    });

    res.status(201).json({
      data: payment,
      invoice: {
        id: invoice.id,
        status: newStatus,
        totalPaid,
        remaining: Math.max(0, invoice.total - totalPaid),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record payment', details: String(error) });
  }
});

// ─── STRIPE WEBHOOK HANDLER ────────────────────────────────────────────

/**
 * POST /payments/stripe-webhook
 * Handle Stripe webhook events
 */
router.post('/stripe-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    // Verify webhook signature
    const gateway = PaymentGatewayFactory.getGateway('stripe', {
      apiKey: process.env.STRIPE_API_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const isValid = await gateway.validateWebhook(req.body, signature);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Handle the webhook event
    await gateway.handleWebhook(req.body);

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ error: 'Webhook processing failed', details: String(error) });
  }
});

// ─── PAYMENT RECONCILIATION ────────────────────────────────────────────

/**
 * GET /payments/reconciliation
 * Get unmatched payments report
 */
router.get('/reconciliation', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;

    // Get all payments and invoices for tenant
    const [invoices, payments] = await Promise.all([
      db.invoice.findMany({
        where: { tenantId },
        include: {
          payments: true,
        },
      }),
      db.invoicePayment.findMany({
        where: {
          invoice: {
            tenantId,
          },
        },
        include: {
          invoice: true,
        },
      }),
    ]);

    // Reconcile payments
    const result = PaymentReconciliation.reconcile(payments, invoices);

    // Get unmatched and overpaid summary
    const unmatchedAmount = result.unmatched.reduce((sum: number, p: any) => sum + p.amount, 0);
    const overpaidAmount = result.overpaid.reduce((sum: number, item: any) => sum + item.amount, 0);

    res.json({
      data: {
        matched: result.matched.length,
        unmatched: result.unmatched.length,
        overpaid: result.overpaid.length,
        unmatchedAmount,
        overpaidAmount,
        unmatchedPayments: result.unmatched,
        overpaidInvoices: result.overpaid,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate reconciliation report', details: String(error) });
  }
});

// ─── REFUND PAYMENT ────────────────────────────────────────────────────

/**
 * POST /payments/:id/refund
 * Initiate refund for a payment
 */
router.post('/:id/refund', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { amount, reason } = req.body;

    const payment = await db.invoicePayment.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    });

    if (!payment || payment.invoice.tenantId !== tenantId) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      res.status(400).json({ error: 'Refund amount cannot exceed payment amount' });
      return;
    }

    // Create refund record
    const refund = await db.invoicePayment.create({
      data: {
        invoiceId: payment.invoiceId,
        amount: -refundAmount, // Negative for refund
        method: payment.method,
        reference: `REFUND-${payment.reference || payment.id}`,
        paidAt: new Date(),
        metadata: {
          originalPaymentId: payment.id,
          reason,
          refundedAmount: refundAmount,
        },
      },
    });

    res.status(201).json({
      data: refund,
      message: `Refund of ${refundAmount} initiated`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process refund', details: String(error) });
  }
});

// ─── PAYMENT STATISTICS ────────────────────────────────────────────────

/**
 * GET /payments/stats
 * Get payment statistics for tenant
 */
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId!;
    const { from, to } = req.query;

    const filters: Prisma.InvoicePaymentWhereInput = {
      invoice: {
        tenantId,
      },
    };

    if (from || to) {
      filters.paidAt = {};
      if (from) {
        (filters.paidAt as any).gte = new Date(from as string);
      }
      if (to) {
        (filters.paidAt as any).lte = new Date(to as string);
      }
    }

    const payments = await db.invoicePayment.findMany({
      where: filters,
      include: {
        invoice: true,
      },
    });

    // Group by method
    const byMethod: Record<string, { count: number; total: number }> = {};
    let totalAmount = 0;

    for (const payment of payments) {
      if (payment.amount > 0) {
        // Ignore refunds
        totalAmount += payment.amount;
        if (!byMethod[payment.method]) {
          byMethod[payment.method] = { count: 0, total: 0 };
        }
        byMethod[payment.method].count++;
        byMethod[payment.method].total += payment.amount;
      }
    }

    res.json({
      data: {
        totalPayments: payments.filter((p: any) => p.amount > 0).length,
        totalAmount,
        byMethod,
        period: {
          from: from || 'all-time',
          to: to || 'now',
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve payment statistics', details: String(error) });
  }
});

export default router;
