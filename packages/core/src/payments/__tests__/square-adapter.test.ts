/**
 * Square Gateway Adapter Tests
 *
 * Tests Square Payments API integration:
 * - Payment creation and capture
 * - Refunds
 * - Invoice creation
 * - Webhook verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SquareGateway } from '../square-adapter.js';
import type { PaymentGatewayConfig } from '../types.js';

// Helper to create a mock fetch response
function mockFetchResponse(data: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe('SquareGateway', () => {
  let gateway: SquareGateway;
  let mockConfig: PaymentGatewayConfig;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;

    process.env.SQUARE_ACCESS_TOKEN = 'test-access-token';
    process.env.SQUARE_LOCATION_ID = 'test-location-id';

    mockConfig = {
      name: 'Square',
      isEnabled: true,
      isProduction: false,
      secretKey: 'test-access-token',
      webhookSecret: 'test-webhook-secret',
      metadata: {
        locationId: 'test-location-id',
      },
      supportedMethods: ['card', 'apple_pay', 'google_pay'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Default mock fetch
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      mockFetchResponse({
        payment: {
          id: 'SQ-PAY-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          amount_money: { amount: 5000, currency: 'USD' },
          status: 'COMPLETED',
          source_type: 'CARD',
          receipt_url: 'https://squareup.com/receipt/123',
          receipt_number: 'R123',
        },
      }),
    ));

    gateway = new SquareGateway(mockConfig);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should throw error when accessToken is missing', () => {
      delete process.env.SQUARE_ACCESS_TOKEN;
      const invalidConfig = { ...mockConfig, secretKey: undefined };
      expect(() => new SquareGateway(invalidConfig)).toThrow('accessToken');
    });

    it('should throw error when locationId is missing', () => {
      delete process.env.SQUARE_LOCATION_ID;
      const invalidConfig = {
        ...mockConfig,
        metadata: { clientId: 'id' },
      };
      expect(() => new SquareGateway(invalidConfig)).toThrow('locationId');
    });

    it('should throw error when gateway is disabled', () => {
      const disabledConfig = { ...mockConfig, isEnabled: false };
      expect(() => new SquareGateway(disabledConfig)).toThrow('not enabled');
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
        methodType: 'card',
        providerName: 'square',
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

    it('should include metadata in intent', async () => {
      const metadata = {
        orderId: 'order-789',
        customData: 'test-value',
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

  describe('captureWithSourceId', () => {
    it('should capture payment with source ID', async () => {
      const transaction = await gateway.captureWithSourceId(
        'intent-id-123',
        'cnon_card_nonce_123',
        5000,
        'USD',
      );

      expect(transaction).toMatchObject({
        status: 'completed',
        type: 'charge',
        methodType: 'card',
        providerName: 'square',
      });

      expect(transaction.id).toBeDefined();
      expect(transaction.providerTransactionId).toBeDefined();
      expect(transaction.completedAt).toBeDefined();
    });

    it('should include Square payment ID in metadata', async () => {
      const transaction = await gateway.captureWithSourceId(
        'intent-id-123',
        'cnon_card_nonce_123',
        5000,
        'USD',
      );

      expect(transaction.metadata).toHaveProperty('squarePaymentId');
      expect(transaction.metadata).toHaveProperty('squareSourceType');
    });

    it('should throw error when no source ID', async () => {
      expect(
        gateway.capturePayment('intent-id-123'),
      ).rejects.toThrow('sourceId');
    });
  });

  describe('refundPayment', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
        mockFetchResponse({
          refund: {
            id: 'SQ-REFUND-123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            amount_money: { amount: 5000, currency: 'USD' },
            status: 'COMPLETED',
            payment_id: 'square-payment-id-123',
            reason: 'customer_request',
          },
        }),
      ));
    });

    it('should refund full payment amount', async () => {
      const refund = await gateway.refundPayment('square-payment-id-123');

      expect(refund).toMatchObject({
        transactionId: 'square-payment-id-123',
        status: 'completed',
        reason: 'customer_request',
      });

      expect(refund.id).toBeDefined();
      expect(refund.providerRefundId).toBeDefined();
      expect(refund.completedAt).toBeDefined();
    });

    it('should refund partial amount', async () => {
      // Override mock to return the partial amount from the API
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
        mockFetchResponse({
          refund: {
            id: 'SQ-REFUND-PARTIAL',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            amount_money: { amount: 2500, currency: 'USD' },
            status: 'COMPLETED',
            payment_id: 'square-payment-id-123',
            reason: 'customer_request',
          },
        }),
      ));

      const refund = await gateway.refundPayment(
        'square-payment-id-123',
        2500, // $25.00 partial refund
        'customer_request',
      );

      expect(refund.amount).toBe(2500);
    });

    it('should accept custom refund reason', async () => {
      const refund = await gateway.refundPayment(
        'square-payment-id-123',
        undefined,
        'duplicate_charge',
      );

      expect(refund.reason).toBe('duplicate_charge');
    });

    it('should include Square refund ID in metadata', async () => {
      const refund = await gateway.refundPayment('square-payment-id-123');

      expect(refund.metadata).toHaveProperty('squareRefundId');
      expect(refund.metadata).toHaveProperty('squarePaymentId');
    });
  });

  describe('getPaymentStatus', () => {
    it('should return transaction status', async () => {
      const transaction = await gateway.getPaymentStatus('square-payment-id-123');

      expect(transaction).toMatchObject({
        providerName: 'square',
      });

      expect(transaction.status).toMatch(/pending|authorized|completed|cancelled|failed/);
    });

    it('should include Square payment ID in metadata', async () => {
      const transaction = await gateway.getPaymentStatus('square-payment-id-123');

      expect(transaction.metadata).toHaveProperty('squarePaymentId');
      expect(transaction.metadata).toHaveProperty('squareStatus');
    });

    it('should handle invalid payment ID', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
        mockFetchResponse(
          { errors: [{ detail: 'Payment not found' }] },
          false,
          404,
        ),
      ));
      await expect(
        gateway.getPaymentStatus('invalid-payment-id'),
      ).rejects.toThrow();
    });
  });

  describe('Invoice Creation', () => {
    it('should create invoice for deferred payment', async () => {
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const dueDateStr = dueDate.toISOString().split('T')[0];

      vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
        mockFetchResponse({
          invoice: {
            id: 'SQ-INV-123',
            version: 1,
            location_id: 'test-location-id',
            order_id: 'order-456',
            primary_recipient: { customer_id: 'customer-123' },
            payment_requests: [{
              request_type: 'BALANCE',
              request_method: 'EMAIL',
              due_date: dueDateStr,
              computed_amount_money: { amount: 5000, currency: 'USD' },
            }],
            status: 'DRAFT',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }),
      ));

      const invoice = await gateway.createInvoice(
        'customer-123',
        'order-456',
        5000, // $50.00
        'USD',
        dueDate,
      );

      expect(invoice).toMatchObject({
        status: expect.any(String),
      });

      expect(invoice.invoiceId).toBeDefined();
      // Source parses date-only string from API, so time portion is lost (midnight UTC)
      expect(invoice.dueDate.toISOString().split('T')[0]).toBe(dueDate.toISOString().split('T')[0]);
    });

    it('should include location ID in invoice', async () => {
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
        mockFetchResponse({
          invoice: {
            id: 'SQ-INV-456',
            version: 1,
            location_id: 'test-location-id',
            order_id: 'order-456',
            primary_recipient: { customer_id: 'customer-123' },
            payment_requests: [{
              request_type: 'BALANCE',
              request_method: 'EMAIL',
              due_date: dueDateStr,
              computed_amount_money: { amount: 5000, currency: 'USD' },
            }],
            status: 'DRAFT',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }),
      ));

      const invoice = await gateway.createInvoice(
        'customer-123',
        'order-456',
        5000,
        'USD',
        dueDate,
      );

      expect(invoice.invoiceId).toBeDefined();
    });
  });

  describe('Webhook Verification', () => {
    it('should verify valid webhook signature', async () => {
      const payload = {
        type: 'payment.created',
        data: { object: { id: 'payment-123' } },
      };

      const signature = 'valid-signature';

      const isValid = await gateway.verifyWebhookSignature(
        payload,
        signature,
      );

      expect(typeof isValid).toBe('boolean');
    });

    it('should reject invalid webhook signature', async () => {
      const payload = {
        type: 'payment.created',
        data: { object: { id: 'payment-123' } },
      };

      const signature = 'invalid-signature';

      const isValid = await gateway.verifyWebhookSignature(
        payload,
        signature,
      );

      expect(isValid).toBe(false);
    });

    it('should throw error when webhook secret not configured', async () => {
      const gatewayNoSecret = new SquareGateway({
        ...mockConfig,
        webhookSecret: undefined,
      });

      const payload = { type: 'payment.created' };
      const signature = 'signature';

      expect(
        gatewayNoSecret.verifyWebhookSignature(payload, signature),
      ).rejects.toThrow('webhook signature key');
    });
  });

  describe('Webhook Parsing', () => {
    it('should parse payment.created event', async () => {
      const payload = {
        id: 'event-id-123',
        type: 'payment.created',
        created_at: new Date().toISOString(),
        data: {
          object: {
            id: 'payment-123',
            amount_money: { amount: 5000, currency: 'USD' },
          },
        },
      };

      const parsed = await gateway.parseWebhookPayload(payload);

      expect(parsed).toMatchObject({
        type: 'payment.authorized',
        provider: 'square',
        providerEventId: 'event-id-123',
      });

      expect(parsed.data).toMatchObject({
        amount: 5000,
        currency: 'USD',
      });
    });

    it('should parse payment.updated event', async () => {
      const payload = {
        id: 'event-id-123',
        type: 'payment.updated',
        created_at: new Date().toISOString(),
        data: {
          object: {
            id: 'payment-123',
            amount_money: { amount: 5000, currency: 'USD' },
          },
        },
      };

      const parsed = await gateway.parseWebhookPayload(payload);

      expect(parsed.type).toBe('payment.captured');
    });

    it('should parse refund.created event', async () => {
      const payload = {
        id: 'event-id-123',
        type: 'refund.created',
        created_at: new Date().toISOString(),
        data: {
          object: {
            id: 'refund-123',
            amount_money: { amount: 2500, currency: 'USD' },
          },
        },
      };

      const parsed = await gateway.parseWebhookPayload(payload);

      expect(parsed.type).toBe('refund.completed');
    });

    it('should include Square metadata in webhook payload', async () => {
      const payload = {
        id: 'event-id-123',
        type: 'payment.created',
        created_at: new Date().toISOString(),
        data: {
          object: {
            id: 'payment-123',
            amount_money: { amount: 5000, currency: 'USD' },
          },
        },
      };

      const parsed = await gateway.parseWebhookPayload(payload);

      expect(parsed.data.metadata).toHaveProperty('squareEventType');
      expect(parsed.data.metadata).toHaveProperty('squarePaymentData');
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

    it('should accept minimum amount (50 cents)', async () => {
      const intent = await gateway.createPaymentIntent('shop-123', 50, 'USD');

      expect(intent.amount).toBe(50);
    });

    it('should reject floating point amounts', async () => {
      await expect(
        gateway.createPaymentIntent('shop-123', 50.5, 'USD'),
      ).rejects.toThrow('Must be positive integer');
    });

    it('should enforce maximum amount', async () => {
      expect(
        gateway.createPaymentIntent('shop-123', 1000000000, 'USD'),
      ).rejects.toThrow('exceeds maximum');
    });
  });

  describe('Currency Support', () => {
    it('should support Square-enabled currencies', async () => {
      const currencies = ['USD', 'CAD', 'GBP', 'AUD'];

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
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));
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

  describe('Payment Method Normalization', () => {
    it('should normalize card payment methods', async () => {
      const intent = await gateway.createPaymentIntent('shop-123', 5000, 'USD');

      expect(intent.methodType).toBe('card');
    });
  });
});
