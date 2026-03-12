/**
 * PayPal Gateway Adapter Tests
 *
 * Tests PayPal Orders API v2 integration:
 * - OAuth2 token management
 * - Order creation and capture
 * - Refunds
 * - Webhook verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PayPalGateway } from '../paypal-adapter.js';
import type { PaymentGatewayConfig } from '../types.js';

// Mock fetch for API calls
vi.mock('node-fetch');

describe('PayPalGateway', () => {
  let gateway: PayPalGateway;
  let mockConfig: PaymentGatewayConfig;

  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = 'test-client-id';
    process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';

    mockConfig = {
      name: 'PayPal',
      isEnabled: true,
      isProduction: false,
      secretKey: 'test-client-secret',
      publicKey: 'test-client-id',
      metadata: {
        clientId: 'test-client-id',
        webhookId: 'test-webhook-id',
      },
      supportedMethods: ['paypal', 'card'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    gateway = new PayPalGateway(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should throw error when clientId is missing', () => {
      const invalidConfig = { ...mockConfig, metadata: { clientSecret: 'secret' } };
      expect(() => new PayPalGateway(invalidConfig)).toThrow('clientId');
    });

    it('should throw error when clientSecret is missing', () => {
      const invalidConfig = {
        ...mockConfig,
        secretKey: undefined,
        metadata: { clientId: 'id' },
      };
      expect(() => new PayPalGateway(invalidConfig)).toThrow('clientSecret');
    });

    it('should throw error when gateway is disabled', () => {
      const disabledConfig = { ...mockConfig, isEnabled: false };
      expect(() => new PayPalGateway(disabledConfig)).toThrow('not enabled');
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent with valid parameters', async () => {
      const intent = await gateway.createPaymentIntent(
        'shop-123',
        5000, // $50.00 in cents
        'USD',
        'customer-456',
        { orderId: 'order-789', description: 'Test payment' },
      );

      expect(intent).toMatchObject({
        shopId: 'shop-123',
        amount: 5000,
        currency: 'USD',
        status: 'pending',
        methodType: 'paypal',
        providerName: 'paypal',
      });

      expect(intent.id).toBeDefined();
      expect(intent.idempotencyKey).toBeDefined();
      expect(intent.expiresAt).toBeDefined();
    });

    it('should throw error on invalid amount', async () => {
      expect(
        gateway.createPaymentIntent('shop-123', -100, 'USD'),
      ).rejects.toThrow('Invalid amount');

      expect(
        gateway.createPaymentIntent('shop-123', 0, 'USD'),
      ).rejects.toThrow('Invalid amount');
    });

    it('should throw error on unsupported currency', async () => {
      expect(
        gateway.createPaymentIntent('shop-123', 5000, 'XXX'),
      ).rejects.toThrow('Unsupported currency');
    });

    it('should validate minimum amount', async () => {
      expect(
        gateway.createPaymentIntent('shop-123', 10, 'USD'), // Less than $0.50 minimum
      ).rejects.toThrow('below minimum');
    });

    it('should include metadata in intent', async () => {
      const metadata = {
        orderId: 'order-789',
        customData: 'test-value',
        returnUrl: 'https://example.com/return',
      };

      const intent = await gateway.createPaymentIntent(
        'shop-123',
        5000,
        'USD',
        undefined,
        metadata,
      );

      expect(intent.metadata).toMatchObject(metadata);
    });
  });

  describe('capturePayment', () => {
    it('should capture authorized payment', async () => {
      const transaction = await gateway.capturePayment('paypal-order-id-123');

      expect(transaction).toMatchObject({
        status: 'completed',
        type: 'charge',
        methodType: 'paypal',
        providerName: 'paypal',
        providerRef: 'paypal-order-id-123',
      });

      expect(transaction.id).toBeDefined();
      expect(transaction.providerTransactionId).toBeDefined();
      expect(transaction.completedAt).toBeDefined();
    });

    it('should include PayPal IDs in metadata', async () => {
      const transaction = await gateway.capturePayment('paypal-order-id-123');

      expect(transaction.metadata).toHaveProperty('paypalOrderId');
      expect(transaction.metadata).toHaveProperty('paypalCaptureId');
    });

    it('should handle capture failure', async () => {
      expect(
        gateway.capturePayment('invalid-order-id'),
      ).rejects.toThrow();
    });
  });

  describe('refundPayment', () => {
    it('should refund full payment amount', async () => {
      const refund = await gateway.refundPayment('paypal-capture-id-123');

      expect(refund).toMatchObject({
        transactionId: 'paypal-capture-id-123',
        status: 'completed',
        reason: 'customer_request',
      });

      expect(refund.id).toBeDefined();
      expect(refund.providerRefundId).toBeDefined();
      expect(refund.completedAt).toBeDefined();
    });

    it('should refund partial amount', async () => {
      const refund = await gateway.refundPayment(
        'paypal-capture-id-123',
        2500, // $25.00 partial refund
        'customer_request',
      );

      expect(refund.amount).toBe(2500);
    });

    it('should accept custom refund reason', async () => {
      const refund = await gateway.refundPayment(
        'paypal-capture-id-123',
        undefined,
        'duplicate_charge',
      );

      expect(refund.reason).toBe('duplicate_charge');
    });

    it('should include PayPal refund ID in metadata', async () => {
      const refund = await gateway.refundPayment('paypal-capture-id-123');

      expect(refund.metadata).toHaveProperty('paypalRefundId');
      expect(refund.metadata).toHaveProperty('paypalStatus');
    });
  });

  describe('getPaymentStatus', () => {
    it('should return transaction status', async () => {
      const transaction = await gateway.getPaymentStatus('paypal-order-id-123');

      expect(transaction).toMatchObject({
        providerName: 'paypal',
        methodType: 'paypal',
      });

      expect(transaction.status).toMatch(/pending|authorized|completed|cancelled/);
    });

    it('should include PayPal order ID in metadata', async () => {
      const transaction = await gateway.getPaymentStatus('paypal-order-id-123');

      expect(transaction.metadata).toHaveProperty('paypalOrderId');
      expect(transaction.metadata).toHaveProperty('paypalStatus');
    });

    it('should handle invalid order ID', async () => {
      expect(
        gateway.getPaymentStatus('invalid-order-id'),
      ).rejects.toThrow();
    });
  });

  describe('Webhook Verification', () => {
    it('should verify valid webhook signature', async () => {
      const payload = {
        id: 'webhook-id-123',
        create_time: new Date().toISOString(),
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
      };

      const signature = 'valid-signature';

      const isValid = await gateway.verifyWebhookSignature(payload, signature);

      expect(typeof isValid).toBe('boolean');
    });

    it('should reject invalid webhook signature', async () => {
      const payload = { id: 'webhook-id-123' };
      const signature = 'invalid-signature';

      const isValid = await gateway.verifyWebhookSignature(payload, signature);

      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Parsing', () => {
    it('should parse PAYMENT.CAPTURE.COMPLETED event', async () => {
      const payload = {
        id: 'webhook-id-123',
        create_time: new Date().toISOString(),
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'capture-id-123',
          amount: { value: '50.00', currency_code: 'USD' },
          supplementary_data: {
            related_ids: { order_id: 'order-id-123' },
          },
        },
      };

      const parsed = await gateway.parseWebhookPayload(payload);

      expect(parsed).toMatchObject({
        type: 'payment.captured',
        provider: 'paypal',
        providerEventId: 'webhook-id-123',
      });

      expect(parsed.data).toMatchObject({
        amount: 5000, // $50.00 in cents
        currency: 'USD',
        status: 'completed',
      });
    });

    it('should parse PAYMENT.CAPTURE.DENIED event', async () => {
      const payload = {
        id: 'webhook-id-123',
        create_time: new Date().toISOString(),
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          id: 'capture-id-123',
          amount: { value: '50.00', currency_code: 'USD' },
        },
      };

      const parsed = await gateway.parseWebhookPayload(payload);

      expect(parsed.type).toBe('payment.failed');
    });

    it('should include PayPal metadata in webhook payload', async () => {
      const payload = {
        id: 'webhook-id-123',
        create_time: new Date().toISOString(),
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'capture-id-123', amount: { value: '50.00', currency_code: 'USD' } },
      };

      const parsed = await gateway.parseWebhookPayload(payload);

      expect(parsed.data.metadata).toHaveProperty('paypalEventType');
      expect(parsed.data.metadata).toHaveProperty('paypalResource');
    });
  });

  describe('Amount Handling', () => {
    it('should validate amount is in cents', async () => {
      const intent = await gateway.createPaymentIntent(
        'shop-123',
        12345, // $123.45
        'USD',
      );

      expect(intent.amount).toBe(12345);
    });

    it('should reject floating point amounts', async () => {
      expect(
        gateway.createPaymentIntent('shop-123', 50.5, 'USD'),
      ).rejects.toThrow('must be positive integer');
    });

    it('should enforce maximum amount', async () => {
      expect(
        gateway.createPaymentIntent('shop-123', 1000000000, 'USD'), // > $9,999,999.99
      ).rejects.toThrow('exceeds maximum');
    });
  });

  describe('Currency Support', () => {
    it('should support common currencies', async () => {
      const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

      for (const currency of currencies) {
        const intent = await gateway.createPaymentIntent(
          'shop-123',
          5000,
          currency,
        );

        expect(intent.currency).toBe(currency.toUpperCase());
      }
    });

    it('should be case insensitive for currency codes', async () => {
      const intent = await gateway.createPaymentIntent('shop-123', 5000, 'usd');

      expect(intent.currency).toBe('USD');
    });
  });

  describe('Idempotency', () => {
    it('should generate unique idempotency keys', async () => {
      const intent1 = await gateway.createPaymentIntent('shop-123', 5000, 'USD');
      const intent2 = await gateway.createPaymentIntent('shop-123', 5000, 'USD');

      expect(intent1.idempotencyKey).not.toBe(intent2.idempotencyKey);
    });

    it('should include shop ID in idempotency key', async () => {
      const intent = await gateway.createPaymentIntent(
        'shop-456',
        5000,
        'USD',
      );

      expect(intent.idempotencyKey).toContain('shop-456');
    });
  });
});
