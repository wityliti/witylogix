/**
 * Payment Gateway Service
 * Integrates with payment processors (Stripe) and manual payment methods
 * Handles payment reconciliation, webhook processing, and refunds
 */

import type { Invoice, PaymentRecord, PaymentMethod } from './types.js';

// ─── PAYMENT GATEWAY TYPES ──────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  failureReason?: string;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentLinkOptions {
  invoiceId: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  returnUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutSessionOptions extends PaymentLinkOptions {
  lineItems?: Array<{
    name: string;
    description?: string;
    amount: number;
    quantity: number;
  }>;
}

export interface RefundOptions {
  paymentId: string;
  amount?: number; // Partial refund if specified
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookPayload {
  type: string;
  id: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

// ─── PAYMENT GATEWAY INTERFACE ──────────────────────────────────────────

export interface IPaymentGateway {
  createPaymentLink(options: PaymentLinkOptions): Promise<{ url: string; id: string }>;
  createCheckoutSession(options: CheckoutSessionOptions): Promise<{ url: string; sessionId: string }>;
  getPaymentStatus(paymentId: string): Promise<Payment>;
  processRefund(options: RefundOptions): Promise<{ refundId: string; status: PaymentStatus }>;
  validateWebhook(payload: WebhookPayload, signature: string): Promise<boolean>;
  handleWebhook(payload: WebhookPayload): Promise<void>;
}

// ─── STRIPE ADAPTER ──────────────────────────────────────────────────────

export class StripeAdapter implements IPaymentGateway {
  private apiKey: string;
  private webhookSecret: string;

  constructor(apiKey: string, webhookSecret: string) {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  /**
   * Create a payment link for Stripe
   */
  async createPaymentLink(options: PaymentLinkOptions): Promise<{ url: string; id: string }> {
    try {
      // Mock Stripe API call - in production, use @stripe/stripe-js
      const paymentLink = {
        id: `pl_${this.generateId()}`,
        url: `https://pay.stripe.com/${this.generateId()}`,
        invoice_id: options.invoiceId,
        amount: Math.round(options.amount * 100), // Convert to cents
        currency: options.currency.toLowerCase(),
        customer_email: options.customerEmail,
        metadata: {
          invoiceId: options.invoiceId,
          ...options.metadata,
        },
      };

      return {
        url: paymentLink.url,
        id: paymentLink.id,
      };
    } catch (error) {
      throw new PaymentGatewayError(`Failed to create Stripe payment link: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Create a Stripe checkout session
   */
  async createCheckoutSession(options: CheckoutSessionOptions): Promise<{ url: string; sessionId: string }> {
    try {
      // Mock Stripe checkout session creation
      const sessionId = `cs_${this.generateId()}`;

      return {
        url: `https://checkout.stripe.com/pay/${sessionId}`,
        sessionId,
      };
    } catch (error) {
      throw new PaymentGatewayError(
        `Failed to create Stripe checkout session: ${this.getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Get payment status from Stripe
   */
  async getPaymentStatus(paymentId: string): Promise<Payment> {
    try {
      // Mock Stripe payment retrieval
      // In production, call Stripe API: stripe.paymentIntents.retrieve(paymentId)

      return {
        id: paymentId,
        invoiceId: '',
        amount: 0,
        currency: 'USD',
        method: 'credit_card',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new PaymentGatewayError(`Failed to retrieve payment status: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Process refund through Stripe
   */
  async processRefund(options: RefundOptions): Promise<{ refundId: string; status: PaymentStatus }> {
    try {
      // Mock Stripe refund processing
      const refundId = `re_${this.generateId()}`;

      return {
        refundId,
        status: 'refunded',
      };
    } catch (error) {
      throw new PaymentGatewayError(`Failed to process refund: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Validate webhook signature
   */
  async validateWebhook(payload: WebhookPayload, signature: string): Promise<boolean> {
    try {
      // In production, use crypto to validate HMAC signature
      // const expectedSignature = crypto
      //   .createHmac('sha256', this.webhookSecret)
      //   .update(JSON.stringify(payload))
      //   .digest('hex');
      // return signature === expectedSignature;

      return true; // Mock validation
    } catch (error) {
      throw new PaymentGatewayError(`Webhook validation failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Handle incoming webhook from Stripe
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    switch (payload.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(payload);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(payload);
        break;

      case 'charge.refunded':
        await this.handleRefunded(payload);
        break;

      default:
        // Ignore unknown event types
        break;
    }
  }

  /**
   * Handle payment succeeded event
   */
  private async handlePaymentSucceeded(payload: WebhookPayload): Promise<void> {
    const { id, metadata } = payload.data as any;
    const invoiceId = metadata?.invoiceId;

    if (!invoiceId) {
      throw new PaymentGatewayError('Payment webhook missing invoiceId in metadata');
    }

    // Emit event or trigger callback
    // This would be handled by the payment service
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(payload: WebhookPayload): Promise<void> {
    const { id, last_payment_error } = payload.data as any;
    const error = last_payment_error?.message || 'Unknown error';

    // Emit event or trigger callback
  }

  /**
   * Handle refund event
   */
  private async handleRefunded(payload: WebhookPayload): Promise<void> {
    const { id, amount_refunded } = payload.data as any;

    // Emit event or trigger callback
  }

  /**
   * Generate ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

// ─── MANUAL PAYMENT ADAPTER ──────────────────────────────────────────────

export class ManualPaymentAdapter implements IPaymentGateway {
  /**
   * Manual payments don't use payment links
   */
  async createPaymentLink(options: PaymentLinkOptions): Promise<{ url: string; id: string }> {
    throw new PaymentGatewayError('Manual payments do not support payment links');
  }

  /**
   * Manual payments don't use checkout sessions
   */
  async createCheckoutSession(options: CheckoutSessionOptions): Promise<{ url: string; sessionId: string }> {
    throw new PaymentGatewayError('Manual payments do not support checkout sessions');
  }

  /**
   * Record bank transfer
   */
  async recordBankTransfer(
    invoiceId: string,
    amount: number,
    reference: string,
  ): Promise<PaymentRecord> {
    return {
      id: `pay_${this.generateId()}`,
      invoiceId,
      amount,
      method: 'bank_transfer',
      reference,
      paidAt: new Date(),
      metadata: {
        type: 'bank_transfer',
        recordedAt: new Date().toISOString(),
      },
      createdAt: new Date(),
    };
  }

  /**
   * Record cash payment
   */
  async recordCashPayment(invoiceId: string, amount: number): Promise<PaymentRecord> {
    return {
      id: `pay_${this.generateId()}`,
      invoiceId,
      amount,
      method: 'cash',
      paidAt: new Date(),
      metadata: {
        type: 'cash',
        recordedAt: new Date().toISOString(),
      },
      createdAt: new Date(),
    };
  }

  /**
   * Record check payment
   */
  async recordCheckPayment(invoiceId: string, amount: number, checkNumber: string): Promise<PaymentRecord> {
    return {
      id: `pay_${this.generateId()}`,
      invoiceId,
      amount,
      method: 'check',
      reference: checkNumber,
      paidAt: new Date(),
      metadata: {
        type: 'check',
        checkNumber,
        recordedAt: new Date().toISOString(),
      },
      createdAt: new Date(),
    };
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<Payment> {
    return {
      id: paymentId,
      invoiceId: '',
      amount: 0,
      currency: 'USD',
      method: 'other',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Process refund manually
   */
  async processRefund(options: RefundOptions): Promise<{ refundId: string; status: PaymentStatus }> {
    return {
      refundId: `ref_${this.generateId()}`,
      status: 'refunded',
    };
  }

  /**
   * Validate webhook - not applicable for manual payments
   */
  async validateWebhook(payload: WebhookPayload, signature: string): Promise<boolean> {
    return false;
  }

  /**
   * Handle webhook - not applicable for manual payments
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    // No-op for manual payments
  }

  /**
   * Generate ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// ─── PAYMENT RECONCILIATION SERVICE ─────────────────────────────────────

export class PaymentReconciliation {
  /**
   * Match payment to invoice
   */
  static matchPaymentToInvoice(payment: Payment, invoice: Invoice): boolean {
    // Match by amount
    if (payment.amount === invoice.total) {
      return true;
    }

    // Match within tolerance (1 cent for currency conversion)
    if (Math.abs(payment.amount - invoice.total) < 0.01) {
      return true;
    }

    return false;
  }

  /**
   * Handle partial payment
   */
  static handlePartialPayment(payment: Payment, invoice: Invoice): void {
    const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0) + payment.amount;

    if (totalPaid < invoice.total) {
      // Still outstanding - invoice remains overdue
      return;
    }

    // Payment complete
  }

  /**
   * Handle overpayment
   */
  static handleOverpayment(payment: Payment, invoice: Invoice): { overpayment: number; refundRequired: boolean } {
    const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0) + payment.amount;
    const overpayment = Math.max(0, totalPaid - invoice.total);

    return {
      overpayment,
      refundRequired: overpayment > 0,
    };
  }

  /**
   * Find unmatched payments
   */
  static findUnmatchedPayments(payments: Payment[], invoices: Invoice[]): Payment[] {
    return payments.filter(payment => {
      const matchedInvoice = invoices.find(inv => this.matchPaymentToInvoice(payment, inv));
      return !matchedInvoice;
    });
  }

  /**
   * Reconcile payments to invoices
   */
  static reconcile(
    payments: Payment[],
    invoices: Invoice[],
  ): {
    matched: Array<{ payment: Payment; invoice: Invoice }>;
    unmatched: Payment[];
    overpaid: Array<{ payment: Payment; invoice: Invoice; amount: number }>;
  } {
    const matched: Array<{ payment: Payment; invoice: Invoice }> = [];
    const unmatched: Payment[] = [];
    const overpaid: Array<{ payment: Payment; invoice: Invoice; amount: number }> = [];

    for (const payment of payments) {
      let found = false;

      for (const invoice of invoices) {
        if (payment.invoiceId === invoice.id) {
          matched.push({ payment, invoice });
          found = true;

          // Check for overpayment
          const result = this.handleOverpayment(payment, invoice);
          if (result.refundRequired) {
            overpaid.push({ payment, invoice, amount: result.overpayment });
          }
          break;
        }
      }

      if (!found) {
        unmatched.push(payment);
      }
    }

    return { matched, unmatched, overpaid };
  }
}

// ─── PAYMENT GATEWAY ERROR ──────────────────────────────────────────────

export class PaymentGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

// ─── PAYMENT GATEWAY FACTORY ────────────────────────────────────────────

export class PaymentGatewayFactory {
  private static instances: Map<string, IPaymentGateway> = new Map();

  /**
   * Get or create payment gateway instance
   */
  static getGateway(
    type: 'stripe' | 'manual',
    credentials?: { apiKey?: string; webhookSecret?: string },
  ): IPaymentGateway {
    const key = `${type}:${credentials?.apiKey || 'default'}`;

    if (!this.instances.has(key)) {
      let gateway: IPaymentGateway;

      if (type === 'stripe') {
        if (!credentials?.apiKey || !credentials?.webhookSecret) {
          throw new PaymentGatewayError('Stripe requires apiKey and webhookSecret');
        }
        gateway = new StripeAdapter(credentials.apiKey, credentials.webhookSecret);
      } else {
        gateway = new ManualPaymentAdapter();
      }

      this.instances.set(key, gateway);
    }

    return this.instances.get(key)!;
  }

  /**
   * Clear all instances
   */
  static clearInstances(): void {
    this.instances.clear();
  }
}

/**
 * Helper function to create payment options
 */
export function createPaymentLinkOptions(
  invoiceId: string,
  amount: number,
  currency: string,
  options?: {
    customerEmail?: string;
    customerName?: string;
    returnUrl?: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, unknown>;
  },
): PaymentLinkOptions {
  return {
    invoiceId,
    amount,
    currency,
    ...options,
  };
}
