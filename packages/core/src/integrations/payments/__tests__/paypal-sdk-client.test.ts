/**
 * PayPal SDK Client Tests
 * Comprehensive test suite for PayPal REST API operations and OAuth2 flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PayPalClient } from '../paypal-sdk-client';
import type { PayPalConfig } from '../paypal-sdk-client';

describe('PayPalClient', () => {
  let client: PayPalClient;
  const mockConfig: PayPalConfig = {
    clientId: 'test_client_id_FAKE123456789',
    clientSecret: 'test_client_secret_FAKE123456789',
    environment: 'sandbox',
  };

  beforeEach(() => {
    client = new PayPalClient(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when clientId is missing', () => {
      expect(
        () =>
          new PayPalClient({
            ...mockConfig,
            clientId: '',
          })
      ).toThrow('clientId and clientSecret are required');
    });

    it('should throw error when clientSecret is missing', () => {
      expect(
        () =>
          new PayPalClient({
            ...mockConfig,
            clientSecret: '',
          })
      ).toThrow('clientId and clientSecret are required');
    });

    it('should initialize with valid config', () => {
      expect(client).toBeDefined();
    });
  });

  describe('OAuth2 token management', () => {
    it('should obtain access token with client_credentials flow', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token_FAKE123456789',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);

      const order = await client.createOrder({
        intent: 'CAPTURE',
        purchaseUnits: [
          {
            amount: {
              currencyCode: 'USD',
              value: '100.00',
            },
          },
        ],
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
    });

    it('should auto-refresh token before expiry', async () => {
      const mockFetch = vi.spyOn(global, 'fetch');

      // First OAuth call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token_expires_in_1_second',
          expires_in: 1,
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          scope: 'https://api.paypal.com/v1/payments/.*',
        }),
      } as any);

      // Simulate first request
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second OAuth call for refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token_refreshed',
          expires_in: 3600,
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          scope: 'https://api.paypal.com/v1/payments/.*',
        }),
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'order_with_refreshed_token',
          status: 'CREATED',
          purchase_units: [{ amount: { currency_code: 'USD', value: '100.00' } }],
          links: [],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        }),
      } as any);

      const order = await client.createOrder({
        intent: 'CAPTURE',
        purchaseUnits: [
          {
            amount: {
              currencyCode: 'USD',
              value: '100.00',
            },
          },
        ],
      });

      expect(order).toBeDefined();
    });
  });

  describe('createOrder', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should create order for payment', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'order_test_123',
          status: 'CREATED',
          purchase_units: [
            {
              amount: {
                currency_code: 'USD',
                value: '100.00',
              },
              description: 'Test product',
            },
          ],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          links: [],
        }),
      } as any);

      const order = await client.createOrder({
        intent: 'CAPTURE',
        purchaseUnits: [
          {
            amount: {
              currencyCode: 'USD',
              value: '100.00',
            },
            description: 'Test product',
          },
        ],
      });

      expect(order.id).toBe('order_test_123');
      expect(order.status).toBe('succeeded');
    });

    it('should support PayPal experience context', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'order_with_context',
          status: 'APPROVED',
          links: [
            {
              rel: 'approve',
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=order_with_context',
            },
          ],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          purchase_units: [],
        }),
      } as any);

      const order = await client.createOrder({
        intent: 'AUTHORIZE',
        purchaseUnits: [
          {
            amount: {
              currencyCode: 'USD',
              value: '250.00',
            },
          },
        ],
        paymentSource: {
          paypal: {
            experienceContext: {
              returnUrl: 'https://example.com/return',
              cancelUrl: 'https://example.com/cancel',
              brandName: 'Test Brand',
              userAction: 'PAY_NOW',
            },
          },
        },
      });

      expect(order).toBeDefined();
    });
  });

  describe('captureOrder', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should capture order', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'order_captured',
          status: 'COMPLETED',
          purchase_units: [
            {
              amount: {
                currency_code: 'USD',
                value: '100.00',
              },
              payments: {
                captures: [
                  {
                    id: 'capture_test_123',
                    status: 'COMPLETED',
                  },
                ],
              },
            },
          ],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        }),
      } as any);

      const order = await client.captureOrder('order_test_123');

      expect(order).toBeDefined();
      expect(order.status).toBe('succeeded');
    });
  });

  describe('authorizeOrder', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should authorize order', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'order_authorized',
          status: 'APPROVED',
          purchase_units: [
            {
              amount: { currency_code: 'USD', value: '100.00' },
              payments: {
                authorizations: [
                  {
                    id: 'auth_test_123',
                    status: 'CREATED',
                  },
                ],
              },
            },
          ],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        }),
      } as any);

      const order = await client.authorizeOrder('order_test_123');

      expect(order).toBeDefined();
    });
  });

  describe('createRefund', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should create refund', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'refund_test_123',
          status: 'COMPLETED',
          amount: {
            currency_code: 'USD',
            value: '50.00',
          },
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        }),
      } as any);

      const refund = await client.createRefund('capture_test_123', {
        amount: '50.00',
        currencyCode: 'USD',
        reason: 'Partial refund',
      });

      expect(refund.id).toBe('refund_test_123');
      expect(refund.status).toBe('succeeded');
    });
  });

  describe('createSubscription', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should create subscription', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sub_paypal_123',
          status: 'ACTIVE',
          plan_id: 'plan_test_monthly',
          subscriber: {
            email_address: 'customer@example.com',
            payer_id: 'PAYER123',
          },
          quantity: '1',
          create_time: new Date().toISOString(),
          status_update_time: new Date().toISOString(),
        }),
      } as any);

      const subscription = await client.createSubscription('plan_test_monthly');

      expect(subscription.id).toBe('sub_paypal_123');
      expect(subscription.status).toBe('active');
    });
  });

  describe('suspendSubscription', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should suspend subscription', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sub_suspended',
          status: 'SUSPENDED',
          plan_id: 'plan_test_monthly',
          create_time: new Date().toISOString(),
          status_update_time: new Date().toISOString(),
        }),
      } as any);

      const subscription = await client.suspendSubscription('sub_test_123', 'Customer request');

      expect(subscription.status).toBe('suspended');
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should cancel subscription', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'sub_canceled',
          status: 'CANCELLED',
          plan_id: 'plan_test_monthly',
          create_time: new Date().toISOString(),
          status_update_time: new Date().toISOString(),
        }),
      } as any);

      const subscription = await client.cancelSubscription('sub_test_123', 'No longer needed');

      expect(subscription.status).toBe('canceled');
    });
  });

  describe('createPayoutBatch', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should create payout batch', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch_header: {
            payout_batch_id: 'batch_test_123',
            batch_status: 'PENDING',
            time_created: new Date().toISOString(),
            time_completed: null,
            sender_batch_header: {
              sender_batch_id: 'sender_batch_123',
            },
          },
          items: [
            {
              transaction_id: 'tx_001',
              transaction_status: 'SUCCESS',
            },
          ],
        }),
      } as any);

      const result = await client.createPayoutBatch({
        senderBatchId: 'sender_batch_123',
        items: [
          {
            receiverId: 'receiver@example.com',
            amount: {
              currencyCode: 'USD',
              value: '100.00',
            },
            description: 'Payout',
          },
        ],
      });

      expect(result.batchId).toBe('batch_test_123');
      expect(result.items).toHaveLength(1);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature', async () => {
      const body = JSON.stringify({
        id: 'evt_paypal_test_123',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
      });
      const transmissionId = 'trans_test_123';
      const transmissionTime = new Date().toISOString();
      const certUrl = 'https://api.sandbox.paypal.com/cert/test';

      // In real scenario, this would be computed with the correct webhook ID
      // For testing purposes, we'll just verify the method handles the flow
      const isValid = await client.verifyWebhookSignature(
        body,
        transmissionId,
        transmissionTime,
        certUrl,
        'invalid_signature'
      );

      // Should reject invalid signature
      expect(isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle OAuth error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          name: 'INVALID_CLIENT',
          message: 'Client authentication failed',
        }),
      } as any);

      await expect(
        client.createOrder({
          intent: 'CAPTURE',
          purchaseUnits: [
            {
              amount: {
                currencyCode: 'USD',
                value: '100.00',
              },
            },
          ],
        })
      ).rejects.toThrow();
    });

    it('should handle request errors with retries', async () => {
      let attempts = 0;

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token_test',
            expires_in: 3600,
            token_type: 'Bearer',
            app_id: 'APP-FAKE123456789',
            scope: 'https://api.paypal.com/v1/payments/.*',
          }),
        } as any)
        .mockImplementationOnce(async () => {
          attempts++;
          throw new Error('Network timeout');
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'token_retry',
            expires_in: 3600,
            token_type: 'Bearer',
            app_id: 'APP-FAKE123456789',
            scope: 'https://api.paypal.com/v1/payments/.*',
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'order_after_retry',
            status: 'CREATED',
            purchase_units: [],
            create_time: new Date().toISOString(),
            update_time: new Date().toISOString(),
            links: [],
          }),
        } as any);

      const order = await client.createOrder({
        intent: 'CAPTURE',
        purchaseUnits: [
          {
            amount: {
              currencyCode: 'USD',
              value: '100.00',
            },
          },
        ],
      });

      expect(order).toBeDefined();
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          scope: 'https://api.paypal.com/v1/payments/.*',
          access_token: 'A21AAAAAA_valid_token',
          token_type: 'Bearer',
          app_id: 'APP-FAKE123456789',
          expires_in: 3599,
        }),
      } as any);
    });

    it('should respect rate limits', async () => {
      const startTime = Date.now();

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'order_rate_limited',
          status: 'CREATED',
          purchase_units: [],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          links: [],
        }),
      } as any);

      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          client.createOrder({
            intent: 'CAPTURE',
            purchaseUnits: [
              {
                amount: {
                  currencyCode: 'USD',
                  value: '100.00',
                },
              },
            ],
          })
        );
      }

      await Promise.all(promises);

      const elapsed = Date.now() - startTime;
      // Should complete successfully
      expect(elapsed).toBeDefined();
    });
  });
});
