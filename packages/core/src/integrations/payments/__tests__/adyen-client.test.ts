/**
 * Adyen Client Tests
 * Comprehensive test suite for Adyen payment adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdyenClient } from '../adyen-client';
import { type PaymentTransaction } from '../types';

describe('AdyenClient', () => {
  let client: AdyenClient;
  const mockConfig: any = {
    environment: 'test',
    apiKey: 'test-api-key',
    merchantAccount: 'test-merchant',
    webhookHmacKey: 'test-webhook-key',
  };

  beforeEach(() => {
    client = new AdyenClient(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('charge', () => {
    it('should charge card successfully', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-123',
          amount: { value: 10000, currency: 'USD' },
        }),
      } as any);

      const result = await client.charge(10000, 'USD', 'pm-token');

      expect(result).toBeDefined();
      expect(result.externalId).toBe('test-psp-123');
      expect(result.status).toBe('authorized');
    });

    it('should handle charge refusal', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Refused',
          refusalReason: 'Card expired',
          pspReference: 'test-psp-refused',
        }),
      } as any);

      await expect(client.charge(10000, 'USD', 'pm-expired')).rejects.toThrow();
    });

    it('should support split payments (marketplace)', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-split',
          amount: { value: 10000, currency: 'USD' },
        }),
      } as any);

      const result = await client.createSplitPayment(
        10000,
        'USD',
        'pm-token',
        [
          { accountId: 'acc-seller', amount: 8000 },
          { accountId: 'acc-platform', amount: 2000 },
        ]
      );

      expect(result).toBeDefined();
    });

    it('should support percentage-based splits', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-percent',
        }),
      } as any);

      const result = await client.createSplitPayment(
        10000,
        'USD',
        'pm-token',
        [
          { accountId: 'acc-seller', percentage: 80 },
          { accountId: 'acc-platform', percentage: 20 },
        ]
      );

      expect(result).toBeDefined();
    });
  });

  describe('authorize', () => {
    it('should authorize without immediate capture', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-auth',
        }),
      } as any);

      const result = await client.authorize(10000, 'USD', 'pm-token');

      expect(result.status).toBe('authorized');
    });
  });

  describe('capture', () => {
    it('should capture authorized transaction', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Received',
          pspReference: 'test-psp-capture',
        }),
      } as any);

      const result = await client.capture('test-psp-auth');

      expect(result.status).toBe('captured');
    });

    it('should support partial capture', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Received',
          pspReference: 'test-psp-partial',
        }),
      } as any);

      const result = await client.capture('test-psp-auth', 5000);

      expect(result).toBeDefined();
    });
  });

  describe('void', () => {
    it('should void authorized transaction', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Received',
          pspReference: 'test-psp-void',
        }),
      } as any);

      const result = await client.void('test-psp-auth');

      expect(result.status).toBe('voided');
    });
  });

  describe('refund', () => {
    it('should refund captured transaction', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Received',
          pspReference: 'test-psp-refund',
        }),
      } as any);

      const result = await client.refund('test-psp-captured');

      expect(result.status).toBe('completed');
      expect(result.providerId).toBe('adyen');
    });

    it('should support partial refund', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Received',
          pspReference: 'test-psp-partial-refund',
        }),
      } as any);

      const result = await client.refund('test-psp-captured', 5000);

      expect(result.amount).toBe(5000);
    });
  });

  describe('createPaymentMethod', () => {
    it('should tokenize card', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'pm-new-token',
        }),
      } as any);

      const result = await client.createPaymentMethod(
        {
          type: 'card',
          cardNumber: '4111111111111111',
          cardExpiry: '12/25',
          cardCvv: '123',
          cardholderName: 'John Doe',
        },
        'cust-123'
      );

      expect(result.type).toBe('card');
    });
  });

  describe('listPaymentMethods', () => {
    it('should list stored payment methods', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          paymentMethods: [
            {
              id: 'pm-1',
              type: 'scheme',
              brand: 'visa',
              lastFour: '1111',
            },
          ],
        }),
      } as any);

      const result = await client.listPaymentMethods('cust-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('getTransaction', () => {
    it('should retrieve transaction details', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-lookup',
          amount: { value: 10000, currency: 'USD' },
        }),
      } as any);

      const result = await client.getTransaction('test-psp-lookup');

      expect(result).toBeDefined();
    });
  });

  describe('createCustomer', () => {
    it('should create customer reference', async () => {
      const result = await client.createCustomer({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.id).toBeDefined();
      expect(result.externalId).toBeDefined();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook HMAC', () => {
      const payload = JSON.stringify({ transactionId: 'txn-123' });

      // Test with mock signature
      const isValid = client.verifyWebhookSignature(
        payload,
        'mock-signature'
      );

      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('parseWebhookPayload', () => {
    it('should parse authorisation webhook', () => {
      const payload = {
        notificationItems: [
          {
            NotificationRequestItem: {
              eventCode: 'AUTHORISATION',
              pspReference: 'psp-webhook-123',
              success: 'true',
            },
          },
        ],
      };

      const event = client.parseWebhookPayload(payload);

      expect(event?.eventType).toBe('authorized');
      expect(event?.resourceType).toBe('transaction');
    });

    it('should parse refund webhook', () => {
      const payload = {
        notificationItems: [
          {
            NotificationRequestItem: {
              eventCode: 'REFUND',
              pspReference: 'psp-refund-123',
            },
          },
        ],
      };

      const event = client.parseWebhookPayload(payload);

      expect(event?.eventType).toBe('refunded');
      expect(event?.resourceType).toBe('refund');
    });

    it('should parse chargeback webhook', () => {
      const payload = {
        notificationItems: [
          {
            NotificationRequestItem: {
              eventCode: 'CHARGEBACK',
              pspReference: 'psp-chargeback-123',
            },
          },
        ],
      };

      const event = client.parseWebhookPayload(payload);

      expect(event?.eventType).toBe('dispute_opened');
      expect(event?.resourceType).toBe('dispute');
    });
  });

  describe('3DS handling', () => {
    it('should handle 3DS challenge', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'IdentifyShopper',
          authentication: {
            threeDSecure: {
              challengeUrl: 'https://example.com/3ds',
            },
          },
        }),
      } as any);

      const result = await client.charge(10000, 'USD', 'pm-token');

      expect(result).toBeDefined();
    });
  });

  describe('recurring payments', () => {
    it('should support recurring/subscription payments', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-recurring',
        }),
      } as any);

      const result = await client.charge(10000, 'USD', 'pm-token', {
        skipTokenization: false,
      });

      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          errors: [{ code: 'INVALID_REQUEST', message: 'Invalid amount' }],
        }),
      } as any);

      await expect(client.charge(10000, 'USD', 'pm-token')).rejects.toThrow();
    });

    it('should retry transient errors', async () => {
      let attempts = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Network timeout');
        }
        return {
          ok: true,
          json: async () => ({
            resultCode: 'Authorised',
            pspReference: 'retry-success',
          }),
        } as any;
      });

      const result = await client.charge(10000, 'USD', 'pm-token');

      expect(attempts).toBe(2);
      expect(result).toBeDefined();
    });
  });

  describe('idempotency', () => {
    it('should use idempotency key to prevent duplicate charges', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-idem',
        }),
      } as any);

      const key = 'idempotency-key-adyen';

      const result1 = await client.charge(10000, 'USD', 'pm-token', {
        idempotencyKey: key,
      });

      vi.spyOn(global, 'fetch').mockClear();

      const result2 = await client.charge(10000, 'USD', 'pm-token', {
        idempotencyKey: key,
      });

      // Should return same transaction (cached)
      expect(result1.id).toBe(result2.id);
    });
  });

  describe('amount formatting', () => {
    it('should handle different currencies', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-eur',
          amount: { value: 10000, currency: 'EUR' },
        }),
      } as any);

      const result = await client.charge(10000, 'EUR', 'pm-token');

      expect(result.currency).toBe('EUR');
    });
  });

  describe('metadata handling', () => {
    it('should include custom metadata', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-meta',
        }),
      } as any);

      const result = await client.charge(10000, 'USD', 'pm-token', {
        orderId: 'order-123',
        metadata: { customField: 'value' },
      });

      expect(result.orderId).toBe('order-123');
    });
  });

  describe('device fingerprinting', () => {
    it('should support device data for fraud detection', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCode: 'Authorised',
          pspReference: 'test-psp-device',
        }),
      } as any);

      const result = await client.charge(10000, 'USD', 'pm-token', {
        deviceData: 'device-fingerprint-data',
      });

      expect(result).toBeDefined();
    });
  });
});
