/**
 * Abstract Payment Gateway Base Class
 *
 * Provides common functionality for payment gateway implementations:
 * - Idempotency key management
 * - Webhook signature verification
 * - Currency conversion helpers
 * - Payment amount validation
 */

import type {
  PaymentIntent,
  Transaction,
  RefundRequest,
  PaymentGatewayConfig,
  PaymentWebhookPayload,
} from './types.js';

// ─── PAYMENT GATEWAY BASE CLASS ────────────────────────────────────────

export abstract class PaymentGatewayBase {
  abstract readonly name: string;
  abstract readonly code: string;

  protected supportedCurrencies: Set<string> = new Set([
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'AED', 'SGD',
  ]);

  protected minAmount: number = 50; // In smallest currency unit (e.g., cents)
  protected maxAmount: number = 999999999; // $9,999,999.99

  constructor(protected config: PaymentGatewayConfig) {
    this.validateConfig();
  }

  /**
   * Validate gateway configuration
   */
  protected validateConfig(): void {
    if (!this.config.name) {
      throw new Error('Payment gateway config requires name');
    }
    if (!this.config.isEnabled) {
      throw new Error(`Payment gateway ${this.config.name} is not enabled`);
    }
  }

  /**
   * Create a payment intent (authorize funds without capturing)
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
   */
  abstract refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundRequest>;

  /**
   * Verify webhook signature from provider
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

  /**
   * Validate payment amount
   */
  protected validateAmount(amount: number, currency: string): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(`Invalid amount: ${amount}. Must be positive integer.`);
    }

    if (amount < this.minAmount) {
      throw new Error(`Amount ${amount} is below minimum ${this.minAmount}`);
    }

    if (amount > this.maxAmount) {
      throw new Error(`Amount ${amount} exceeds maximum ${this.maxAmount}`);
    }
  }

  /**
   * Validate currency
   */
  protected validateCurrency(currency: string): void {
    if (!this.supportedCurrencies.has(currency.toUpperCase())) {
      throw new Error(`Unsupported currency: ${currency}`);
    }
  }

  /**
   * Generate idempotency key
   */
  protected generateIdempotencyKey(
    shopId: string,
    customerId: string | undefined,
    amount: number,
    timestamp: number,
  ): string {
    const parts = [
      this.code,
      shopId,
      customerId || 'no-customer',
      amount,
      timestamp,
    ];
    return parts.join('-');
  }

  /**
   * Convert amount from dollars to provider currency unit
   * (Most providers require smallest unit: cents for USD, etc.)
   */
  protected amountToCents(amount: number): number {
    // Assumes amount is in smallest unit already
    return Math.round(amount);
  }

  /**
   * Convert amount from provider currency unit to dollars
   */
  protected centsToAmount(cents: number): number {
    // Assumes amount is in smallest unit
    return Math.round(cents);
  }

  /**
   * Parse ISO currency from provider response
   */
  protected parseCurrency(currency: string): string {
    return currency.toUpperCase();
  }

  /**
   * Generate unique transaction ID
   */
  protected generateTransactionId(): string {
    return `${this.code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verify HMAC signature (used by many payment providers)
   */
  protected verifyHmacSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256',
  ): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Get ISO timestamp
   */
  protected getTimestamp(): Date {
    return new Date();
  }

  /**
   * Determine payment method type from provider response
   */
  protected normalizePaymentMethod(
    method: string,
  ): 'card' | 'paypal' | 'bank_transfer' | 'apple_pay' | 'google_pay' | 'cash' {
    const normalized = method.toLowerCase();

    if (normalized.includes('card') || normalized.includes('visa') ||
        normalized.includes('mastercard') || normalized.includes('amex')) {
      return 'card';
    }

    if (normalized.includes('paypal')) {
      return 'paypal';
    }

    if (normalized.includes('bank') || normalized.includes('transfer') ||
        normalized.includes('ach')) {
      return 'bank_transfer';
    }

    if (normalized.includes('apple')) {
      return 'apple_pay';
    }

    if (normalized.includes('google')) {
      return 'google_pay';
    }

    return 'card';
  }

  /**
   * Build request headers with proper authentication
   */
  protected buildAuthHeaders(
    contentType: string = 'application/json',
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'User-Agent': `Witylogix-Payment-Gateway/${this.code}/1.0`,
    };

    return headers;
  }

  /**
   * Handle common payment errors
   */
  protected handlePaymentError(
    error: any,
  ): {
    code: string;
    message: string;
    retryable: boolean;
  } {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        code: 'GATEWAY_UNAVAILABLE',
        message: 'Payment gateway temporarily unavailable',
        retryable: true,
      };
    }

    if (error.response?.status >= 500) {
      return {
        code: 'GATEWAY_ERROR',
        message: 'Payment gateway server error',
        retryable: true,
      };
    }

    if (error.response?.status === 429) {
      return {
        code: 'RATE_LIMITED',
        message: 'Too many requests to payment gateway',
        retryable: true,
      };
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      return {
        code: 'AUTHENTICATION_ERROR',
        message: 'Payment gateway authentication failed',
        retryable: false,
      };
    }

    return {
      code: error.code || 'PAYMENT_ERROR',
      message: error.message || 'Payment processing failed',
      retryable: false,
    };
  }
}
