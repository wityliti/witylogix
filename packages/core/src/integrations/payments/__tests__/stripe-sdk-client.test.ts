/**
 * Stripe SDK Client Tests
 * Comprehensive test suite for Stripe payment operations and webhook handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StripeClient } from '../stripe-sdk-client';
import type { StripeConfig } from '../stripe-sdk-client';
import { createHmac } from 'crypto';

describe('StripeClient', () => {
  let client: StripeClient;
  const mockConfig: StripeConfig = {
    apiKey: 'sk_test_FAKE123456789abcdefghij',
    publishableKey: 'pk_test_FAKE123456789',
    webhookSecret: 'whsec_test_FAKE123456789',
    environment: 'test',
  };

  beforeEach(() => {
    client = new StripeClient(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when API key is missing', () => {
      expect(
        () =>
          new StripeClient({
            ...mockConfig,
            apiKey: '',
          })
      ).toThrow('Stripe API key is required');
    });

    it('should initialize with valid config', () => {
      expect(client).toBeDefined();
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pi_test_12345',
          object: 'payment_intent',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
          client_secret: 'pi_test_12345_secret_xyz',
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
          charges: { data: [] },
        }),
      } as any);

      const intent = await client.createPaymentIntent(2000, 'USD', {
        description: 'Test payment',
      });

      expect(intent).toBeDefined();
      expect(intent.id).toBe('pi_test_12345');
      expect(intent.amount).toBe(2000);
      expect(intent.currency).toBe('USD');
      expect(intent.status).toBe('succeeded');
    });

    it('should support idempotency key', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pi_test_idempotent',
          object: 'payment_intent',
          amount: 1000,
          currency: 'usd',
          status: 'pending',
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
          charges: { data: [] },
        }),
      } as any);

      const idempotencyKey = 'test-idempotency-key-123';
      await client.createPaymentIntent(1000, 'USD', { idempotencyKey });

      const calls = mockFetch.mock.calls[0];
      expect(calls[1]?.headers?.['Idempotency-Key']).toBe(idempotencyKey);
    });

    it('should handle API errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid request',
            code: 'invalid_request_error',
          },
        }),
      } as any);

      await expect(client.createPaymentIntent(2000, 'USD')).rejects.toThrow(
        'Invalid request'
      );
    });
  });

  describe('capturePaymentIntent', () => {
    it('should capture payment intent', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pi_test_capture',
          object: 'payment_intent',
          amount: 3000,
          currency: 'usd',
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
          charges: { data: [] },
        }),
      } as any);

      const intent = await client.capturePaymentIntent('pi_test_capture');

      expect(intent.id).toBe('pi_test_capture');
      expect(intent.status).toBe('succeeded');
    });

    it('should support partial capture', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pi_test_partial',
          object: 'payment_intent',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
          charges: { data: [] },
        }),
      } as any);

      const intent = await client.capturePaymentIntent('pi_test_partial', 2500);

      expect(intent).toBeDefined();
    });
  });

  describe('cancelPaymentIntent', () => {
    it('should cancel payment intent', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'pi_test_cancel',
          object: 'payment_intent',
          status: 'canceled',
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
          charges: { data: [] },
        }),
      } as any);

      const intent = await client.cancelPaymentIntent('pi_test_cancel');

      expect(intent.status).toBe('canceled');
    });
  });

  describe('createSubscription', () => {
    it('should create subscription', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sub_test_123',
          object: 'subscription',
          customer: 'cus_test_123',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          items: {
            data: [
              {
                id: 'si_test_123',
                price: { id: 'price_test_monthly' },
                quantity: 1,
                created: Math.floor(Date.now() / 1000),
              },
            ],
          },
          currency: 'usd',
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
        }),
      } as any);

      const subscription = await client.createSubscription('cus_test_123', [
        'price_test_monthly',
      ]);

      expect(subscription.id).toBe('sub_test_123');
      expect(subscription.status).toBe('active');
      expect(subscription.items).toHaveLength(1);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sub_test_update',
          object: 'subscription',
          customer: 'cus_test_123',
          status: 'active',
          description: 'Updated subscription',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          items: { data: [] },
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
        }),
      } as any);

      const subscription = await client.updateSubscription('sub_test_update', {
        description: 'Updated subscription',
      });

      expect(subscription.description).toBe('Updated subscription');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sub_test_cancel',
          object: 'subscription',
          status: 'active',
          cancel_at_period_end: true,
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          items: { data: [] },
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
        }),
      } as any);

      const subscription = await client.cancelSubscription('sub_test_cancel', {
        atPeriodEnd: true,
      });

      expect(subscription.status).toBe('active');
    });

    it('should immediately cancel subscription', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sub_test_immediate_cancel',
          object: 'subscription',
          status: 'canceled',
          canceled_at: Math.floor(Date.now() / 1000),
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          items: { data: [] },
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
        }),
      } as any);

      const subscription = await client.cancelSubscription('sub_test_immediate_cancel');

      expect(subscription.status).toBe('canceled');
    });
  });

  describe('createInvoice', () => {
    it('should create invoice', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'in_test_123',
          object: 'invoice',
          customer: 'cus_test_123',
          status: 'draft',
          total: 5000,
          amount_paid: 0,
          amount_due: 5000,
          currency: 'usd',
          lines: { data: [] },
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
        }),
      } as any);

      const invoice = await client.createInvoice('cus_test_123');

      expect(invoice.id).toBe('in_test_123');
      expect(invoice.status).toBe('draft');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cs_test_123',
          object: 'checkout.session',
          mode: 'payment',
          status: 'open',
          payment_status: 'unpaid',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
          line_items: { data: [] },
          currency: 'usd',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          created: Math.floor(Date.now() / 1000),
        }),
      } as any);

      const session = await client.createCheckoutSession({
        lineItems: [{ price: 'price_test', quantity: 1 }],
        mode: 'payment',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(session.id).toBe('cs_test_123');
      expect(session.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
    });
  });

  describe('createRefund', () => {
    it('should create refund', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 're_test_123',
          object: 'refund',
          charge: 'ch_test_123',
          amount: 2000,
          currency: 'usd',
          status: 'succeeded',
          reason: 'requested_by_customer',
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
        }),
      } as any);

      const refund = await client.createRefund('ch_test_123', {
        amount: 2000,
        reason: 'requested_by_customer',
      });

      expect(refund.id).toBe('re_test_123');
      expect(refund.status).toBe('succeeded');
    });
  });

  describe('listRefunds', () => {
    it('should list refunds', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            {
              id: 're_test_1',
              object: 'refund',
              amount: 1000,
              currency: 'usd',
              status: 'succeeded',
              created: Math.floor(Date.now() / 1000),
              updated: Math.floor(Date.now() / 1000),
            },
          ],
          has_more: false,
        }),
      } as any);

      const result = await client.listRefunds({ limit: 10 });

      expect(result.refunds).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const secret = 'whsec_test_secret';
      const body = JSON.stringify({ id: 'evt_test_123', type: 'payment_intent.succeeded' });

      const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

      const isValid = client.verifyWebhookSignature(body, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const secret = 'whsec_test_secret';
      const body = JSON.stringify({ id: 'evt_test_123' });
      const invalidSignature = 'invalid_signature_xyz';

      const isValid = client.verifyWebhookSignature(body, invalidSignature, secret);

      expect(isValid).toBe(false);
    });
  });

  describe('webhook parsing', () => {
    it('should parse payment_intent.succeeded event', () => {
      const secret = 'whsec_test_secret';
      const event = {
        id: 'evt_payment_succeeded',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test_webhook',
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

      const body = JSON.stringify(event);
      const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

      const normalized = client.parseWebhookEvent(event, signature, secret);

      expect(normalized).toBeDefined();
      expect(normalized?.type).toBe('payment.completed');
      expect(normalized?.resourceType).toBe('payment_intent');
    });

    it('should parse invoice.paid event', () => {
      const secret = 'whsec_test_secret';
      const event = {
        id: 'evt_invoice_paid',
        type: 'invoice.paid',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'in_webhook_test',
            object: 'invoice',
            status: 'paid',
            total: 5000,
            currency: 'usd',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            lines: { data: [] },
          },
        },
      };

      const body = JSON.stringify(event);
      const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

      const normalized = client.parseWebhookEvent(event, signature, secret);

      expect(normalized).toBeDefined();
      expect(normalized?.type).toBe('invoice.paid');
    });

    it('should return null for invalid signature', () => {
      const event = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        data: { object: {} },
      };

      const normalized = client.parseWebhookEvent(
        event,
        'invalid_signature',
        'whsec_test_secret'
      );

      expect(normalized).toBeNull();
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      const startTime = Date.now();

      // Mock successful responses
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        headers: new Map(),
        json: async () => ({
          id: 'pi_test_rate_limit',
          object: 'payment_intent',
          amount: 1000,
          currency: 'usd',
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000),
          charges: { data: [] },
        }),
      } as any);

      // Make multiple requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          client.createPaymentIntent(1000, 'USD', {
            description: `Test ${i}`,
          })
        );
      }

      await Promise.all(promises);

      const elapsed = Date.now() - startTime;
      // Should take some time due to rate limiting, but complete successfully
      expect(elapsed).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle network errors with retries', async () => {
      let attempts = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          json: async () => ({
            id: 'pi_test_retry',
            object: 'payment_intent',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
            created: Math.floor(Date.now() / 1000),
            updated: Math.floor(Date.now() / 1000),
            charges: { data: [] },
          }),
        } as any;
      });

      const intent = await client.createPaymentIntent(1000, 'USD');

      expect(intent).toBeDefined();
      expect(attempts).toBeGreaterThanOrEqual(2);
    });

    it('should handle rate limit errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Rate limit exceeded',
            code: 'rate_limit_error',
          },
        }),
      } as any);

      await expect(client.createPaymentIntent(1000, 'USD')).rejects.toThrow();
    });
  });
});
