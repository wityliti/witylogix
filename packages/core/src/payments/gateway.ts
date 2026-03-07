/**
 * Payment Gateway Abstraction
 *
 * Provides base interface for payment gateways with COD implementation.
 * Each provider (Stripe, PayPal, etc.) extends PaymentGateway to implement
 * their specific authorization/capture/refund workflows.
 */

import type {
  PaymentIntent,
  Transaction,
  RefundRequest,
  CODCollection,
  PaymentGatewayConfig,
  PaymentWebhookPayload,
  PaymentError,
} from './types.js';

// ─── PAYMENT GATEWAY BASE CLASS ────────────────────────────────────────

export abstract class PaymentGateway {
  abstract name: string;
  abstract code: string;

  constructor(protected config: PaymentGatewayConfig) {}

  /**
   * Create a payment intent (authorize funds without capturing)
   * Provider-specific implementation handles the API call
   */
  abstract createPaymentIntent(
    shopId: string,
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: Record<string, any>,
  ): Promise<PaymentIntent>;

  /**
   * Capture an authorized payment (settle funds)
   */
  abstract capturePayment(paymentIntentId: string): Promise<Transaction>;

  /**
   * Refund a captured payment
   * Supports full and partial refunds
   */
  abstract refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundRequest>;

  /**
   * Verify webhook signature from provider
   * All webhooks must be verified before processing
   */
  abstract verifyWebhookSignature(
    payload: any,
    signature: string,
  ): Promise<boolean>;

  /**
   * Parse and validate webhook payload
   */
  abstract parseWebhookPayload(payload: any): Promise<PaymentWebhookPayload>;

  /**
   * Get payment status from provider
   */
  abstract getPaymentStatus(providerTransactionId: string): Promise<Transaction>;
}

// ─── COD (CASH ON DELIVERY) GATEWAY ────────────────────────────────────

export class CODGateway extends PaymentGateway {
  name = 'Cash on Delivery';
  code = 'cod';

  /**
   * COD doesn't create a remote intent — just a local record
   * The collection happens when driver delivers
   */
  async createPaymentIntent(
    shopId: string,
    amount: number,
    currency: string,
    _customerId?: string,
    metadata?: Record<string, any>,
  ): Promise<PaymentIntent> {
    const now = new Date();
    const idempotencyKey = `cod-${shopId}-${amount}-${now.getTime()}`;

    return {
      id: this.generateId(),
      shopId,
      amount,
      currency,
      status: 'pending',
      methodType: 'cod',
      idempotencyKey,
      providerName: 'cod',
      description: 'Cash on delivery payment',
      metadata: metadata || {},
      createdAt: now,
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 48 hours
    };
  }

  /**
   * For COD, "capture" means the driver collected the cash
   * This is recorded via recordCODCollection
   */
  async capturePayment(_paymentIntentId: string): Promise<Transaction> {
    // COD capture happens via recordCODCollection
    throw new Error('COD payments are captured via recordCODCollection method');
  }

  /**
   * Refund a COD payment (driver returns cash to customer)
   */
  async refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundRequest> {
    const now = new Date();

    return {
      id: this.generateId(),
      shopId: '', // Set by processor
      transactionId,
      amount,
      reason: (reason as any) || 'customer_request',
      status: 'pending',
      metadata: { codRefund: true },
      requestedAt: now,
    };
  }

  /**
   * COD doesn't have remote webhooks — only manual reconciliation
   */
  async verifyWebhookSignature(
    _payload: any,
    _signature: string,
  ): Promise<boolean> {
    return false; // COD doesn't use webhooks
  }

  /**
   * COD doesn't parse webhooks
   */
  async parseWebhookPayload(_payload: any): Promise<PaymentWebhookPayload> {
    throw new Error('COD gateway does not support webhooks');
  }

  /**
   * Get COD payment status from transaction record
   */
  async getPaymentStatus(transactionId: string): Promise<Transaction> {
    // In real implementation, query database
    return {
      id: transactionId,
      shopId: '',
      amount: 0,
      currency: 'USD',
      status: 'pending',
      type: 'cod_collection',
      methodType: 'cod',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Record a COD collection from driver
   * Called when driver confirms cash received from customer
   */
  async recordCODCollection(
    shopId: string,
    shipmentId: string,
    driverId: string,
    amount: number,
    currency: string,
  ): Promise<CODCollection> {
    const now = new Date();

    return {
      id: this.generateId(),
      shopId,
      shipmentId,
      driverId,
      amount,
      currency,
      status: 'collected',
      collectedAt: now,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Verify a COD collection (shop manager confirms receipt of driver report)
   */
  async verifyCODCollection(
    shopId: string,
    codCollectionId: string,
  ): Promise<CODCollection> {
    const now = new Date();

    // In real implementation, fetch and update from database
    return {
      id: codCollectionId,
      shopId,
      driverId: '',
      amount: 0,
      currency: 'USD',
      status: 'verified',
      verifiedAt: now,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Reconcile COD collections for a driver (batch deposit to bank)
   * Groups multiple collections into single bank deposit
   */
  async reconcileCODCollections(
    shopId: string,
    driverId: string,
    depositDate: Date,
    totalAmount: number,
    codCollectionIds: string[],
  ): Promise<{
    reconcilationId: string;
    status: 'completed';
    totalAmount: number;
    collectionCount: number;
  }> {
    const now = new Date();

    return {
      reconcilationId: this.generateId(),
      status: 'completed',
      totalAmount,
      collectionCount: codCollectionIds.length,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${this.code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ─── GATEWAY FACTORY ───────────────────────────────────────────────────

export function createGateway(config: PaymentGatewayConfig): PaymentGateway {
  switch (config.name.toLowerCase()) {
    case 'cod':
    case 'cash_on_delivery':
      return new CODGateway(config);

    // Future gateways: Stripe, PayPal, etc.
    // case 'stripe':
    //   return new StripeGateway(config);
    // case 'paypal':
    //   return new PayPalGateway(config);

    default:
      throw new Error(`Unknown payment gateway: ${config.name}`);
  }
}

/**
 * Get gateway instance by provider name
 */
export function getGatewayByName(name: string): PaymentGateway | null {
  const config: PaymentGatewayConfig = {
    name,
    isEnabled: true,
    isProduction: process.env.NODE_ENV === 'production',
    supportedMethods: ['cod'],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    return createGateway(config);
  } catch {
    return null;
  }
}
