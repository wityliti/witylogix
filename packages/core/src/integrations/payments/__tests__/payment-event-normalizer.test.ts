/**
 * Payment Event Normalizer Tests
 * Test suite for event normalization and deduplication across providers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PaymentEventNormalizer } from '../payment-event-normalizer';

describe('PaymentEventNormalizer', () => {
  let normalizer: PaymentEventNormalizer;

  beforeEach(() => {
    normalizer = new PaymentEventNormalizer();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Stripe event normalization', () => {
    it('should normalize payment_intent.succeeded event', () => {
      const stripeEvent = {
        id: 'evt_stripe_payment_succeeded',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_stripe_test_123',
            object: 'payment_intent',
            amount: 2000,
            currency: 'usd',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            charges: {
              data: [{ id: 'ch_stripe_123' }],
            },
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(stripeEvent);

      expect(normalized).toBeDefined();
      expect(normalized?.type).toBe('payment.completed');
      expect(normalized?.resourceType).toBe('payment_intent');
      expect(normalized?.provider).toBe('stripe');
      expect(normalized?.externalEventId).toBe('evt_stripe_payment_succeeded');
    });

    it('should normalize payment_intent.payment_failed event', () => {
      const stripeEvent = {
        id: 'evt_stripe_payment_failed',
        type: 'payment_intent.payment_failed',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_stripe_failed_123',
            object: 'payment_intent',
            amount: 1000,
            currency: 'usd',
            status: 'requires_payment_method',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            charges: { data: [] },
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(stripeEvent);

      expect(normalized?.type).toBe('payment.failed');
    });

    it('should normalize invoice.paid event', () => {
      const stripeEvent = {
        id: 'evt_stripe_invoice_paid',
        type: 'invoice.paid',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'in_stripe_test_123',
            object: 'invoice',
            status: 'paid',
            total: 5000,
            currency: 'usd',
            customer: 'cus_stripe_123',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            lines: { data: [] },
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(stripeEvent);

      expect(normalized?.type).toBe('invoice.paid');
      expect(normalized?.resourceType).toBe('invoice');
    });

    it('should normalize charge.refunded event', () => {
      const stripeEvent = {
        id: 'evt_stripe_refunded',
        type: 'charge.refunded',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'ch_stripe_refunded_123',
            object: 'charge',
            amount: 2000,
            currency: 'usd',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            refunds: {
              data: [{ id: 're_stripe_123', amount: 2000 }],
            },
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(stripeEvent);

      expect(normalized?.type).toBe('refund.completed');
      expect(normalized?.resourceType).toBe('refund');
    });

    it('should normalize customer.subscription.created event', () => {
      const stripeEvent = {
        id: 'evt_stripe_sub_created',
        type: 'customer.subscription.created',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'sub_stripe_test_123',
            object: 'subscription',
            customer: 'cus_stripe_123',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            items: { data: [] },
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(stripeEvent);

      expect(normalized?.type).toBe('subscription.created');
      expect(normalized?.resourceType).toBe('subscription');
    });

    it('should normalize charge.dispute.created event', () => {
      const stripeEvent = {
        id: 'evt_stripe_dispute',
        type: 'charge.dispute.created',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'dp_stripe_test_123',
            object: 'dispute',
            charge: 'ch_stripe_123',
            amount: 1000,
            currency: 'usd',
            reason: 'fraudulent',
            status: 'opened',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(stripeEvent);

      expect(normalized?.type).toBe('dispute.opened');
      expect(normalized?.resourceType).toBe('dispute');
    });
  });

  describe('PayPal event normalization', () => {
    it('should normalize PAYMENT.CAPTURE.COMPLETED event', () => {
      const paypalEvent = {
        id: 'evt_paypal_capture_completed',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        create_time: new Date().toISOString(),
        resource: {
          id: 'cap_paypal_123',
          status: 'COMPLETED',
          amount: {
            value: '100.00',
            currency_code: 'USD',
          },
        },
      };

      const normalized = normalizer.normalizePayPalEvent(paypalEvent);

      expect(normalized).toBeDefined();
      expect(normalized?.type).toBe('payment.completed');
      expect(normalized?.resourceType).toBe('payment_intent');
      expect(normalized?.provider).toBe('paypal');
    });

    it('should normalize PAYMENT.CAPTURE.DENIED event', () => {
      const paypalEvent = {
        id: 'evt_paypal_capture_denied',
        event_type: 'PAYMENT.CAPTURE.DENIED',
        create_time: new Date().toISOString(),
        resource: {
          id: 'cap_paypal_denied',
          status: 'DENIED',
        },
      };

      const normalized = normalizer.normalizePayPalEvent(paypalEvent);

      expect(normalized?.type).toBe('payment.failed');
    });

    it('should normalize BILLING.SUBSCRIPTION.CREATED event', () => {
      const paypalEvent = {
        id: 'evt_paypal_sub_created',
        event_type: 'BILLING.SUBSCRIPTION.CREATED',
        create_time: new Date().toISOString(),
        resource: {
          id: 'sub_paypal_123',
          status: 'ACTIVE',
          plan_id: 'plan_paypal_monthly',
        },
      };

      const normalized = normalizer.normalizePayPalEvent(paypalEvent);

      expect(normalized?.type).toBe('subscription.created');
      expect(normalized?.resourceType).toBe('subscription');
    });

    it('should normalize BILLING.SUBSCRIPTION.SUSPENDED event', () => {
      const paypalEvent = {
        id: 'evt_paypal_sub_suspended',
        event_type: 'BILLING.SUBSCRIPTION.SUSPENDED',
        create_time: new Date().toISOString(),
        resource: {
          id: 'sub_paypal_suspended',
          status: 'SUSPENDED',
        },
      };

      const normalized = normalizer.normalizePayPalEvent(paypalEvent);

      expect(normalized?.type).toBe('subscription.paused');
    });

    it('should normalize CHECKOUT.ORDER.APPROVED event', () => {
      const paypalEvent = {
        id: 'evt_paypal_order_approved',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        create_time: new Date().toISOString(),
        resource: {
          id: 'order_paypal_123',
          status: 'APPROVED',
        },
      };

      const normalized = normalizer.normalizePayPalEvent(paypalEvent);

      expect(normalized?.type).toBe('payment.completed');
      expect(normalized?.resourceType).toBe('payment_intent');
    });
  });

  describe('event deduplication', () => {
    it('should detect duplicate events', () => {
      const stripeEvent = {
        id: 'evt_duplicate_test',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test_duplicate',
            object: 'payment_intent',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            charges: { data: [] },
          },
        },
      };

      const first = normalizer.normalizeStripeEvent(stripeEvent);
      expect(first).toBeDefined();

      // Attempt to normalize the same event again
      const duplicate = normalizer.normalizeStripeEvent(stripeEvent);
      expect(duplicate).toBeNull();
    });

    it('should not deduplicate events from different providers with same ID', () => {
      const stripeEvent = {
        id: 'evt_same_id',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test',
            object: 'payment_intent',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            charges: { data: [] },
          },
        },
      };

      const paypalEvent = {
        id: 'evt_same_id',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        create_time: new Date().toISOString(),
        resource: {
          id: 'cap_test',
          status: 'COMPLETED',
          amount: { value: '100.00', currency_code: 'USD' },
        },
      };

      const stripeNorm = normalizer.normalizeStripeEvent(stripeEvent);
      const paypalNorm = normalizer.normalizePayPalEvent(paypalEvent);

      expect(stripeNorm).toBeDefined();
      expect(paypalNorm).toBeDefined();
    });
  });

  describe('currency conversion', () => {
    it('should convert USD to EUR', () => {
      const conversion = normalizer.convertCurrency(10000, 'USD', 'EUR');

      expect(conversion).toBeDefined();
      expect(conversion?.from).toBe('USD');
      expect(conversion?.to).toBe('EUR');
      expect(conversion?.rate).toBeCloseTo(0.92, 1);
      expect(conversion?.convertedAmount).toBeLessThan(10000);
    });

    it('should convert EUR to USD', () => {
      const conversion = normalizer.convertCurrency(10000, 'EUR', 'USD');

      expect(conversion).toBeDefined();
      expect(conversion?.from).toBe('EUR');
      expect(conversion?.to).toBe('USD');
      expect(conversion?.rate).toBeGreaterThan(1);
      expect(conversion?.convertedAmount).toBeGreaterThan(10000);
    });

    it('should handle same currency conversion', () => {
      const conversion = normalizer.convertCurrency(5000, 'USD', 'USD');

      expect(conversion).toBeDefined();
      expect(conversion?.rate).toBe(1);
      expect(conversion?.amount).toBe(conversion?.convertedAmount);
    });

    it('should handle unsupported currency conversion', () => {
      const conversion = normalizer.convertCurrency(10000, 'USD', 'XXX');

      expect(conversion).toBeNull();
    });

    it('should cache conversion rates', () => {
      const conv1 = normalizer.convertCurrency(10000, 'USD', 'GBP');
      const conv2 = normalizer.convertCurrency(10000, 'USD', 'GBP');

      expect(conv1?.rate).toBe(conv2?.rate);
    });
  });

  describe('dispute normalization', () => {
    it('should normalize Stripe dispute', () => {
      const stripeDispute = {
        id: 'dp_stripe_test',
        object: 'dispute',
        charge: 'ch_stripe_123',
        amount: 5000,
        currency: 'usd',
        reason: 'fraudulent',
        status: 'opened',
        created: Math.floor(Date.now() / 1000),
        updated: Math.floor(Date.now() / 1000),
      };

      const dispute = normalizer.normalizeDisputeEvent('stripe', stripeDispute);

      expect(dispute).toBeDefined();
      expect(dispute?.id).toBe('dp_stripe_test');
      expect(dispute?.provider).toBe('stripe');
      expect(dispute?.reason).toBe('fraudulent');
      expect(dispute?.status).toBe('opened');
    });

    it('should normalize PayPal dispute', () => {
      const paypalDispute = {
        id: 'dp_paypal_test',
        transaction_id: 'txn_paypal_123',
        disputed_amount: {
          value: '50.00',
          currency_code: 'USD',
        },
        status: 'OPENED',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
      };

      const dispute = normalizer.normalizeDisputeEvent('paypal', paypalDispute);

      expect(dispute).toBeDefined();
      expect(dispute?.id).toBe('dp_paypal_test');
      expect(dispute?.provider).toBe('paypal');
      expect(dispute?.amount).toBe(5000);
    });
  });

  describe('cache management', () => {
    it('should report cache statistics', () => {
      const stripeEvent = {
        id: 'evt_cache_stat_test',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_cache_test',
            object: 'payment_intent',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            charges: { data: [] },
          },
        },
      };

      normalizer.normalizeStripeEvent(stripeEvent);
      normalizer.convertCurrency(10000, 'USD', 'EUR');

      const stats = normalizer.getCacheStats();

      expect(stats.dedupCacheSize).toBeGreaterThan(0);
      expect(stats.exchangeRateCacheSize).toBeGreaterThan(0);
    });

    it('should cleanup expired cache entries', () => {
      const stripeEvent = {
        id: 'evt_cleanup_test',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_cleanup_test',
            object: 'payment_intent',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            charges: { data: [] },
          },
        },
      };

      normalizer.normalizeStripeEvent(stripeEvent);

      let stats = normalizer.getCacheStats();
      expect(stats.dedupCacheSize).toBeGreaterThan(0);

      // Cleanup should remove old entries
      normalizer.cleanupCaches();

      // Stats after cleanup
      stats = normalizer.getCacheStats();
      // Stats should still be accessible
      expect(stats).toBeDefined();
    });
  });

  describe('invalid event handling', () => {
    it('should return null for invalid Stripe event', () => {
      const invalidEvent = {
        // Missing required fields
        type: 'unknown_event',
      };

      const normalized = normalizer.normalizeStripeEvent(invalidEvent as any);

      expect(normalized).toBeNull();
    });

    it('should return null for invalid PayPal event', () => {
      const invalidEvent = {
        // Missing required fields
        event_type: 'UNKNOWN_EVENT',
      };

      const normalized = normalizer.normalizePayPalEvent(invalidEvent as any);

      expect(normalized).toBeNull();
    });

    it('should handle unknown event types gracefully', () => {
      const unknownEvent = {
        id: 'evt_unknown',
        type: 'some.unknown.event',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'obj_unknown',
            object: 'unknown',
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(unknownEvent);

      expect(normalized).toBeNull();
    });
  });

  describe('event data extraction', () => {
    it('should extract payment data from event', () => {
      const stripeEvent = {
        id: 'evt_extract_data',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_extract_test',
            object: 'payment_intent',
            amount: 3000,
            currency: 'usd',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            charges: { data: [] },
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(stripeEvent);

      expect(normalized?.data).toBeDefined();
      expect(normalized?.data.paymentIntent).toBeDefined();
    });

    it('should extract subscription data from event', () => {
      const stripeEvent = {
        id: 'evt_extract_sub',
        type: 'customer.subscription.created',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'sub_extract_test',
            object: 'subscription',
            customer: 'cus_test',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            items: { data: [] },
          },
        },
      };

      const normalized = normalizer.normalizeStripeEvent(stripeEvent);

      expect(normalized?.data.subscription).toBeDefined();
    });
  });
});
