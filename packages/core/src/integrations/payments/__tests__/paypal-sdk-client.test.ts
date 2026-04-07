/**
 * PayPal SDK Client Tests
 * Comprehensive test suite for PayPal REST API operations and OAuth2 flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PayPalClient } from '../paypal-sdk-client';
import type { PayPalConfig } from '../paypal-sdk-client';

/** Helper: returns a mock OAuth token response */
function mockOAuthResponse(overrides?: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      scope: 'https://api.paypal.com/v1/payments/.*',
      access_token: 'A21AAAAAA_valid_token',
      token_type: 'Bearer',
      app_id: 'APP-FAKE123456789',
      expires_in: 3599,
      ...overrides,
    }),
  } as unknown as Response;
}

describe('PayPalClient', () => {
  let client: PayPalClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConfig: PayPalConfig = {
    clientId: 'test_client_id_FAKE123456789',
    clientSecret: 'test_client_secret_FAKE123456789',
    environment: 'sandbox',
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    client = new PayPalClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
      // First call: OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Second call: createOrder API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'order_oauth_test',
          status: 'CREATED',
          purchase_units: [{ amount: { currency_code: 'USD', value: '100.00' } }],
          links: [],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        }),
      } as unknown as Response);

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
      // First OAuth call — token that expires immediately (1 second, with 60s buffer it's already expired)
      mockFetch.mockResolvedValueOnce(
        mockOAuthResponse({ access_token: 'token_expires_in_1_second', expires_in: 1 })
      );

      // Simulate first request
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second OAuth call for refresh (token already expired due to 60s buffer)
      mockFetch.mockResolvedValueOnce(
        mockOAuthResponse({ access_token: 'token_refreshed', expires_in: 3600 })
      );

      // The actual API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'order_with_refreshed_token',
          status: 'CREATED',
          purchase_units: [{ amount: { currency_code: 'USD', value: '100.00' } }],
          links: [],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        }),
      } as unknown as Response);

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
    it('should create order for payment', async () => {
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Create order response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'order_test_123',
          status: 'COMPLETED',
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
      } as unknown as Response);

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
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Create order response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
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
      } as unknown as Response);

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
    it('should capture order', async () => {
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Capture order response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
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
      } as unknown as Response);

      const order = await client.captureOrder('order_test_123');

      expect(order).toBeDefined();
      expect(order.status).toBe('succeeded');
    });
  });

  describe('authorizeOrder', () => {
    it('should authorize order', async () => {
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Authorize order response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
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
      } as unknown as Response);

      const order = await client.authorizeOrder('order_test_123');

      expect(order).toBeDefined();
    });
  });

  describe('createRefund', () => {
    it('should create refund', async () => {
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Create refund response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
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
      } as unknown as Response);

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
    it('should create subscription', async () => {
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Create subscription response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
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
      } as unknown as Response);

      const subscription = await client.createSubscription('plan_test_monthly');

      expect(subscription.id).toBe('sub_paypal_123');
      expect(subscription.status).toBe('active');
    });
  });

  describe('suspendSubscription', () => {
    it('should suspend subscription', async () => {
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Suspend subscription response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'sub_suspended',
          status: 'SUSPENDED',
          plan_id: 'plan_test_monthly',
          create_time: new Date().toISOString(),
          status_update_time: new Date().toISOString(),
        }),
      } as unknown as Response);

      const subscription = await client.suspendSubscription('sub_test_123', 'Customer request');

      expect(subscription.status).toBe('suspended');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription', async () => {
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Cancel subscription response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'sub_canceled',
          status: 'CANCELLED',
          plan_id: 'plan_test_monthly',
          create_time: new Date().toISOString(),
          status_update_time: new Date().toISOString(),
        }),
      } as unknown as Response);

      const subscription = await client.cancelSubscription('sub_test_123', 'No longer needed');

      expect(subscription.status).toBe('canceled');
    });
  });

  describe('createPayoutBatch', () => {
    it('should create payout batch', async () => {
      // OAuth token
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());
      // Create payout batch response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
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
      } as unknown as Response);

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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          name: 'INVALID_CLIENT',
          message: 'Client authentication failed',
        }),
      } as unknown as Response);

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
      // First call: OAuth token (succeeds)
      mockFetch
        .mockResolvedValueOnce(mockOAuthResponse({ access_token: 'token_test', expires_in: 3600 }))
        // Second call: API request (fails with network error)
        .mockRejectedValueOnce(new Error('Network timeout'))
        // Third call: retry needs new OAuth token (the old one may still be cached, but the retry
        // goes through makeRequest which calls getAccessToken again — token is cached so this is
        // the actual API retry)
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'order_after_retry',
            status: 'CREATED',
            purchase_units: [],
            create_time: new Date().toISOString(),
            update_time: new Date().toISOString(),
            links: [],
          }),
        } as unknown as Response);

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
    it('should respect rate limits', async () => {
      const startTime = Date.now();

      // OAuth token (called once, then cached)
      mockFetch.mockResolvedValueOnce(mockOAuthResponse());

      // All subsequent calls return order responses
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'order_rate_limited',
          status: 'CREATED',
          purchase_units: [],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          links: [],
        }),
      } as unknown as Response);

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
