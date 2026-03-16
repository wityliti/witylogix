/**
 * Payment Event Normalizer
 * Normalizes events from Stripe and PayPal into unified WitylogixPaymentEvent format
 * Handles event deduplication, currency conversion, and dispute normalization
 */

import type {
  WitylogixPaymentEvent,
  PaymentIntent,
  Subscription,
  Invoice,
  Refund,
  Dispute,
  CurrencyConversion,
} from './payment-sdk-types';

/**
 * Event deduplication key cache
 */
interface DuplicateCheckEntry {
  timestamp: number;
  expiresAt: number;
}

/**
 * Currency exchange rates cache
 */
interface ExchangeRateEntry {
  rate: number;
  timestamp: number;
  expiresAt: number;
}

/**
 * Payment Event Normalizer
 * Converts provider-specific events to unified format with deduplication
 */
export class PaymentEventNormalizer {
  private deduplicationCache = new Map<string, DuplicateCheckEntry>();
  private exchangeRates = new Map<string, ExchangeRateEntry>();
  private readonly DEDUP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly EXCHANGE_RATE_TTL = 60 * 60 * 1000; // 1 hour

  // Standard currency conversion rates (would be fetched from API in production)
  private static readonly CONVERSION_RATES: Record<string, number> = {
    'USD_EUR': 0.92,
    'USD_GBP': 0.79,
    'USD_JPY': 149.5,
    'EUR_USD': 1.087,
    'GBP_USD': 1.266,
    'JPY_USD': 0.0067,
  };

  /**
   * Normalize a Stripe webhook event
   */
  normalizeStripeEvent(event: Record<string, any>): WitylogixPaymentEvent | null {
    if (!this.isValidStripeEvent(event)) {
      return null;
    }

    // Check for duplicates
    if (this.isDuplicate(event.id, 'stripe')) {
      return null;
    }

    // Mark as processed
    this.recordEventProcessing(event.id, 'stripe');

    const normalized = this.mapStripeEvent(event);

    return normalized;
  }

  /**
   * Normalize a PayPal webhook event
   */
  normalizePayPalEvent(event: Record<string, any>): WitylogixPaymentEvent | null {
    if (!this.isValidPayPalEvent(event)) {
      return null;
    }

    // Check for duplicates
    if (this.isDuplicate(event.id, 'paypal')) {
      return null;
    }

    // Mark as processed
    this.recordEventProcessing(event.id, 'paypal');

    const normalized = this.mapPayPalEvent(event);

    return normalized;
  }

  /**
   * Convert amount between currencies
   */
  convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): CurrencyConversion | null {
    if (fromCurrency === toCurrency) {
      return {
        from: fromCurrency,
        to: toCurrency,
        rate: 1,
        amount,
        convertedAmount: amount,
        timestamp: new Date(),
      };
    }

    const rateKey = `${fromCurrency}_${toCurrency}`;
    const reverseRateKey = `${toCurrency}_${fromCurrency}`;

    let rate: number | null = null;

    // Check cache first
    const cached = this.exchangeRates.get(rateKey);
    if (cached && cached.expiresAt > Date.now()) {
      rate = cached.rate;
    } else {
      // Look up conversion rate
      rate = PaymentEventNormalizer.CONVERSION_RATES[rateKey];

      if (!rate) {
        // Try reverse rate
        const reverseRate = PaymentEventNormalizer.CONVERSION_RATES[reverseRateKey];
        if (reverseRate) {
          rate = 1 / reverseRate;
        }
      }
    }

    if (rate === null || rate === undefined) {
      return null; // Rate not found
    }

    // Cache the rate
    this.exchangeRates.set(rateKey, {
      rate,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.EXCHANGE_RATE_TTL,
    });

    const convertedAmount = Math.round(amount * rate);

    return {
      from: fromCurrency,
      to: toCurrency,
      rate,
      amount,
      convertedAmount,
      timestamp: new Date(),
    };
  }

  /**
   * Normalize dispute/chargeback event
   */
  normalizeDisputeEvent(
    provider: 'stripe' | 'paypal',
    dispute: Record<string, any>
  ): Dispute | null {
    if (provider === 'stripe') {
      return this.mapStripeDispute(dispute);
    } else if (provider === 'paypal') {
      return this.mapPayPalDispute(dispute);
    }

    return null;
  }

  /**
   * Validate Stripe event structure
   */
  private isValidStripeEvent(event: Record<string, any>): boolean {
    return !!(event.id && event.type && event.created && (event.data?.object || event.data?.previous_attributes));
  }

  /**
   * Validate PayPal event structure
   */
  private isValidPayPalEvent(event: Record<string, any>): boolean {
    return !!(event.id && event.event_type && event.create_time && event.resource);
  }

  /**
   * Check if event has been processed (deduplication)
   */
  private isDuplicate(eventId: string, provider: string): boolean {
    const key = `${provider}:${eventId}`;
    const entry = this.deduplicationCache.get(key);

    if (entry && entry.expiresAt > Date.now()) {
      return true; // Duplicate found
    }

    // Clean up expired entries
    for (const [k, v] of this.deduplicationCache.entries()) {
      if (v.expiresAt <= Date.now()) {
        this.deduplicationCache.delete(k);
      }
    }

    return false;
  }

  /**
   * Record event processing
   */
  private recordEventProcessing(eventId: string, provider: string): void {
    const key = `${provider}:${eventId}`;
    this.deduplicationCache.set(key, {
      timestamp: Date.now(),
      expiresAt: Date.now() + this.DEDUP_CACHE_TTL,
    });
  }

  /**
   * Map Stripe event to unified format
   */
  private mapStripeEvent(event: Record<string, any>): WitylogixPaymentEvent | null {
    const eventTypeMap: Record<string, any> = {
      'payment_intent.succeeded': {
        type: 'payment.completed',
        resourceType: 'payment_intent',
      },
      'payment_intent.payment_failed': {
        type: 'payment.failed',
        resourceType: 'payment_intent',
      },
      'charge.refunded': {
        type: 'refund.completed',
        resourceType: 'refund',
      },
      'charge.dispute.created': {
        type: 'dispute.opened',
        resourceType: 'dispute',
      },
      'charge.dispute.closed': {
        type: 'dispute.closed',
        resourceType: 'dispute',
      },
      'invoice.created': {
        type: 'invoice.created',
        resourceType: 'invoice',
      },
      'invoice.paid': {
        type: 'invoice.paid',
        resourceType: 'invoice',
      },
      'invoice.payment_failed': {
        type: 'invoice.payment_failed',
        resourceType: 'invoice',
      },
      'invoice.voided': {
        type: 'invoice.voided',
        resourceType: 'invoice',
      },
      'invoice.marked_uncollectible': {
        type: 'invoice.marked_uncollectible',
        resourceType: 'invoice',
      },
      'customer.subscription.created': {
        type: 'subscription.created',
        resourceType: 'subscription',
      },
      'customer.subscription.updated': {
        type: 'subscription.updated',
        resourceType: 'subscription',
      },
      'customer.subscription.deleted': {
        type: 'subscription.canceled',
        resourceType: 'subscription',
      },
      'customer.subscription.trial_will_end': {
        type: 'subscription.updated',
        resourceType: 'subscription',
      },
      'checkout.session.completed': {
        type: 'checkout.completed',
        resourceType: 'checkout_session',
      },
    };

    const mapping = eventTypeMap[event.type];
    if (!mapping) {
      return null;
    }

    return {
      id: `${event.id}-${Date.now()}`,
      timestamp: new Date(event.created * 1000),
      provider: 'stripe',
      externalEventId: event.id,
      type: mapping.type,
      resourceType: mapping.resourceType,
      resourceId: event.data?.object?.id || '',
      data: this.extractStripeEventData(event.data?.object),
      rawEvent: event,
      verified: true,
      idempotencyKey: event.id,
    };
  }

  /**
   * Map PayPal event to unified format
   */
  private mapPayPalEvent(event: Record<string, any>): WitylogixPaymentEvent | null {
    const eventTypeMap: Record<string, any> = {
      'PAYMENT.CAPTURE.COMPLETED': {
        type: 'payment.completed',
        resourceType: 'payment_intent',
      },
      'PAYMENT.CAPTURE.DENIED': {
        type: 'payment.failed',
        resourceType: 'payment_intent',
      },
      'PAYMENT.CAPTURE.REFUNDED': {
        type: 'refund.completed',
        resourceType: 'refund',
      },
      'CHECKOUT.ORDER.COMPLETED': {
        type: 'checkout.completed',
        resourceType: 'checkout_session',
      },
      'CHECKOUT.ORDER.APPROVED': {
        type: 'payment.completed',
        resourceType: 'payment_intent',
      },
      'BILLING.SUBSCRIPTION.CREATED': {
        type: 'subscription.created',
        resourceType: 'subscription',
      },
      'BILLING.SUBSCRIPTION.UPDATED': {
        type: 'subscription.updated',
        resourceType: 'subscription',
      },
      'BILLING.SUBSCRIPTION.CANCELLED': {
        type: 'subscription.canceled',
        resourceType: 'subscription',
      },
      'BILLING.SUBSCRIPTION.SUSPENDED': {
        type: 'subscription.paused',
        resourceType: 'subscription',
      },
      'BILLING.SUBSCRIPTION.REACTIVATED': {
        type: 'subscription.resumed',
        resourceType: 'subscription',
      },
    };

    const mapping = eventTypeMap[event.event_type];
    if (!mapping) {
      return null;
    }

    return {
      id: `${event.id}-${Date.now()}`,
      timestamp: new Date(event.create_time),
      provider: 'paypal',
      externalEventId: event.id,
      type: mapping.type,
      resourceType: mapping.resourceType,
      resourceId: event.resource?.id || '',
      data: this.extractPayPalEventData(event.resource),
      rawEvent: event,
      verified: true,
      idempotencyKey: event.id,
    };
  }

  /**
   * Extract data from Stripe event object
   */
  private extractStripeEventData(object: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = {};

    if (object?.object === 'payment_intent') {
      data.paymentIntent = {
        id: object.id,
        externalId: object.id,
        amount: object.amount,
        currency: object.currency,
        status: object.status,
      };
    } else if (object?.object === 'invoice') {
      data.invoice = {
        id: object.id,
        externalId: object.id,
        amount: object.total,
        currency: object.currency,
        status: object.status,
      };
    } else if (object?.object === 'charge') {
      data.payment = {
        id: object.id,
        externalId: object.id,
        amount: object.amount,
        currency: object.currency,
        status: object.status,
      };
    } else if (object?.object === 'dispute') {
      data.dispute = {
        id: object.id,
        externalId: object.id,
        amount: object.amount,
        reason: object.reason,
        status: object.status,
      };
    } else if (object?.object === 'subscription') {
      data.subscription = {
        id: object.id,
        externalId: object.id,
        status: object.status,
        customerId: object.customer,
      };
    }

    return data;
  }

  /**
   * Extract data from PayPal event resource
   */
  private extractPayPalEventData(resource: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = {};

    if (resource?.id) {
      const resourceType = resource.status || resource.state;

      if (resourceType?.includes('PAYMENT') || resourceType?.includes('CAPTURE')) {
        data.payment = {
          id: resource.id,
          externalId: resource.id,
          amount: resource.amount?.value ? Math.round(parseFloat(resource.amount.value) * 100) : 0,
          currency: resource.amount?.currency_code || 'USD',
          status: resource.status || resource.state,
        };
      } else if (resourceType?.includes('SUBSCRIPTION')) {
        data.subscription = {
          id: resource.id,
          externalId: resource.id,
          status: resource.status || resource.state,
        };
      }
    }

    return data;
  }

  /**
   * Map Stripe dispute object
   */
  private mapStripeDispute(dispute: Record<string, any>): Dispute | null {
    if (!dispute.id) {
      return null;
    }

    const statusMap: Record<string, any> = {
      warning_opened: 'warning_opened',
      warning_under_review: 'warning_under_review',
      warning_won: 'warning_won',
      warning_lost: 'warning_lost',
      opened: 'opened',
      under_review: 'under_review',
      charge_refunded: 'charge_refunded',
      won: 'won',
      lost: 'lost',
    };

    const reasonMap: Record<string, any> = {
      bank_account_closed: 'bank_account_closed',
      bank_cannot_process: 'bank_cannot_process',
      check_returned: 'check_returned',
      credit_not_processed: 'credit_not_processed',
      customer_initiated_transfer_reversal: 'customer_initiated_transfer_reversal',
      duplicate: 'duplicate',
      fraudulent: 'fraudulent',
      general: 'general',
      improper_account_info: 'improper_account_info',
      insufficient_funds: 'insufficient_funds',
      product_unacceptable: 'product_unacceptable',
      product_not_received: 'product_not_received',
      unauthorised: 'unauthorised',
      unrecognized_transaction: 'unrecognized_transaction',
    };

    return {
      id: dispute.id,
      externalId: dispute.id,
      provider: 'stripe',
      chargeId: dispute.charge || '',
      amount: dispute.amount,
      currency: dispute.currency.toUpperCase(),
      status: statusMap[dispute.status] || 'opened',
      reason: reasonMap[dispute.reason] || 'general',
      metadata: dispute.metadata || {},
      description: dispute.reason,
      createdAt: new Date(dispute.created * 1000),
      updatedAt: new Date(dispute.updated * 1000),
      openedAt: new Date(dispute.created * 1000),
      closedAt: dispute.evidence_due_by ? new Date(dispute.evidence_due_by * 1000) : undefined,
      dueDate: dispute.evidence_due_by ? new Date(dispute.evidence_due_by * 1000) : undefined,
    };
  }

  /**
   * Map PayPal dispute object
   */
  private mapPayPalDispute(dispute: Record<string, any>): Dispute | null {
    if (!dispute.id) {
      return null;
    }

    const statusMap: Record<string, any> = {
      OPENED: 'opened',
      UNDER_REVIEW: 'under_review',
      RESOLVED: 'charge_refunded',
      APPEALED: 'under_review',
      ESCALATED: 'under_review',
    };

    return {
      id: dispute.id,
      externalId: dispute.id,
      provider: 'paypal',
      chargeId: dispute.transaction_id || '',
      amount: dispute.disputed_amount
        ? Math.round(parseFloat(dispute.disputed_amount.value) * 100)
        : 0,
      currency: dispute.disputed_amount?.currency_code || 'USD',
      status: statusMap[dispute.status] || 'opened',
      reason: 'general',
      metadata: {},
      createdAt: new Date(dispute.create_time),
      updatedAt: new Date(dispute.update_time),
      openedAt: new Date(dispute.create_time),
      closedAt: dispute.close_time ? new Date(dispute.close_time) : undefined,
      dueDate: dispute.response_due_date ? new Date(dispute.response_due_date) : undefined,
    };
  }

  /**
   * Clear old cache entries
   */
  cleanupCaches(): void {
    const now = Date.now();

    // Clean deduplication cache
    for (const [key, entry] of this.deduplicationCache.entries()) {
      if (entry.expiresAt <= now) {
        this.deduplicationCache.delete(key);
      }
    }

    // Clean exchange rate cache
    for (const [key, entry] of this.exchangeRates.entries()) {
      if (entry.expiresAt <= now) {
        this.exchangeRates.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    dedupCacheSize: number;
    exchangeRateCacheSize: number;
  } {
    return {
      dedupCacheSize: this.deduplicationCache.size,
      exchangeRateCacheSize: this.exchangeRates.size,
    };
  }
}

export { PaymentEventNormalizer };
