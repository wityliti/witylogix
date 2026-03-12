/**
 * PayPal Orders API v2 Payment Gateway Adapter
 *
 * Implements PayPal Checkout with OAuth2 client credentials flow.
 * Supports:
 * - Payment authorization and capture
 * - Full and partial refunds
 * - Webhook signature verification
 * - Order status tracking
 */

import { fetch as nodeFetch } from 'node-fetch';
import type {
  PaymentIntent,
  Transaction,
  RefundRequest,
  PaymentGatewayConfig,
  PaymentWebhookPayload,
} from './types.js';
import { PaymentGatewayBase } from './payment-gateway.js';

// ─── PAYPAL TYPES ─────────────────────────────────────────────────────────

interface PayPalOAuthToken {
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
  scope: string;
}

interface PayPalCreateOrderRequest {
  intent: string;
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    description?: string;
    custom_id?: string;
  }>;
  payer?: Record<string, any>;
  application_context?: {
    return_url: string;
    cancel_url: string;
    brand_name: string;
    locale: string;
    shipping_preference: string;
  };
}

interface PayPalOrder {
  id: string;
  status: string;
  payer?: {
    email_address: string;
    name?: {
      given_name: string;
      surname: string;
    };
  };
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
}

// ─── PAYPAL GATEWAY CLASS ──────────────────────────────────────────────────

export class PayPalGateway extends PaymentGatewayBase {
  readonly name: string = 'PayPal';
  readonly code: string = 'paypal';

  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: PaymentGatewayConfig) {
    super(config);

    const isProduction = config.isProduction || process.env.NODE_ENV === 'production';
    this.baseUrl = isProduction
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';

    this.clientId = config.metadata?.clientId || process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = config.secretKey || process.env.PAYPAL_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal gateway requires clientId and clientSecret');
    }
  }

  /**
   * Get valid access token (refresh if expired)
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && this.tokenExpiresAt > now) {
      return this.accessToken;
    }

    const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await nodeFetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal OAuth failed: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as PayPalOAuthToken;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = now + data.expires_in * 1000;

    return this.accessToken;
  }

  /**
   * Create a payment intent (PayPal Order)
   */
  async createPaymentIntent(
    shopId: string,
    amount: number,
    currency: string,
    customerId?: string,
    metadata?: Record<string, any>,
  ): Promise<PaymentIntent> {
    this.validateAmount(amount, currency);
    this.validateCurrency(currency);

    const accessToken = await this.getAccessToken();

    // Convert cents to dollars for PayPal
    const amountInDollars = (amount / 100).toFixed(2);

    const orderRequest: PayPalCreateOrderRequest = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency.toUpperCase(),
            value: amountInDollars,
          },
          custom_id: `${shopId}-${metadata?.orderId || 'no-order'}`,
          description: metadata?.description || 'Witylogix Delivery Payment',
        },
      ],
      application_context: {
        return_url: metadata?.returnUrl || 'https://app.witylogix.com/payment/return',
        cancel_url: metadata?.cancelUrl || 'https://app.witylogix.com/payment/cancel',
        brand_name: 'Witylogix',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
      },
    };

    const response = await nodeFetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        ...this.buildAuthHeaders(),
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderRequest),
    });

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`PayPal create order failed: ${JSON.stringify(error)}`);
    }

    const order = (await response.json()) as PayPalOrder;

    const idempotencyKey = this.generateIdempotencyKey(shopId, customerId, amount, Date.now());

    return {
      id: order.id,
      shopId,
      amount,
      currency: currency.toUpperCase(),
      status: 'pending',
      methodType: 'paypal',
      idempotencyKey,
      providerName: 'paypal',
      providerIntentId: order.id,
      description: metadata?.description || 'PayPal payment',
      metadata: {
        ...metadata,
        paypalOrderId: order.id,
        paypalStatus: order.status,
      },
      createdAt: this.getTimestamp(),
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
    };
  }

  /**
   * Capture an authorized payment
   */
  async capturePayment(paymentIntentId: string): Promise<Transaction> {
    const accessToken = await this.getAccessToken();

    const response = await nodeFetch(
      `${this.baseUrl}/v2/checkout/orders/${paymentIntentId}/capture`,
      {
        method: 'POST',
        headers: {
          ...this.buildAuthHeaders(),
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      },
    );

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`PayPal capture failed: ${JSON.stringify(error)}`);
    }

    const order = (await response.json()) as PayPalOrder;

    const capture = order.purchase_units[0]?.payments?.captures?.[0];
    if (!capture) {
      throw new Error('No capture found in PayPal response');
    }

    const amount = Math.round(parseFloat(capture.amount.value) * 100);

    return {
      id: this.generateTransactionId(),
      shopId: '', // Set by processor
      amount,
      currency: capture.amount.currency_code,
      status: 'completed',
      type: 'charge',
      methodType: 'paypal',
      providerName: 'paypal',
      providerTransactionId: capture.id,
      providerRef: paymentIntentId,
      metadata: {
        paypalCaptureId: capture.id,
        paypalOrderId: paymentIntentId,
      },
      createdAt: this.getTimestamp(),
      updatedAt: this.getTimestamp(),
      completedAt: this.getTimestamp(),
    };
  }

  /**
   * Refund a captured payment
   */
  async refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundRequest> {
    const accessToken = await this.getAccessToken();

    const refundBody: any = {
      amount: amount ? ((amount / 100).toFixed(2)) : undefined,
    };

    const response = await nodeFetch(
      `${this.baseUrl}/v2/payments/captures/${transactionId}/refund`,
      {
        method: 'POST',
        headers: {
          ...this.buildAuthHeaders(),
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(refundBody),
      },
    );

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`PayPal refund failed: ${JSON.stringify(error)}`);
    }

    const refund = (await response.json()) as any;

    const refundAmount = amount ? amount : Math.round(parseFloat(refund.amount.value) * 100);

    return {
      id: this.generateTransactionId(),
      shopId: '', // Set by processor
      transactionId,
      amount: refundAmount,
      reason: (reason as any) || 'customer_request',
      status: 'completed',
      providerRefundId: refund.id,
      metadata: {
        paypalRefundId: refund.id,
        paypalStatus: refund.status,
      },
      requestedAt: this.getTimestamp(),
      completedAt: this.getTimestamp(),
    };
  }

  /**
   * Get payment status from PayPal
   */
  async getPaymentStatus(providerTransactionId: string): Promise<Transaction> {
    // Extract order ID from transaction ID or use directly
    const orderId = providerTransactionId.includes('-')
      ? providerTransactionId.split('-')[0]
      : providerTransactionId;

    const accessToken = await this.getAccessToken();

    const response = await nodeFetch(
      `${this.baseUrl}/v2/checkout/orders/${orderId}`,
      {
        method: 'GET',
        headers: {
          ...this.buildAuthHeaders(),
          'Authorization': `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(`PayPal get order failed: ${JSON.stringify(error)}`);
    }

    const order = (await response.json()) as PayPalOrder;

    const capture = order.purchase_units[0]?.payments?.captures?.[0];
    const amount = capture
      ? Math.round(parseFloat(capture.amount.value) * 100)
      : 0;

    const statusMap: Record<string, any> = {
      'CREATED': 'pending',
      'APPROVED': 'authorized',
      'VOIDED': 'cancelled',
      'COMPLETED': 'completed',
    };

    return {
      id: providerTransactionId,
      shopId: '',
      amount,
      currency: order.purchase_units[0]?.amount.currency_code || 'USD',
      status: statusMap[order.status] || 'pending',
      type: 'charge',
      methodType: 'paypal',
      providerName: 'paypal',
      providerTransactionId: capture?.id || order.id,
      metadata: {
        paypalOrderId: order.id,
        paypalStatus: order.status,
      },
      createdAt: this.getTimestamp(),
      updatedAt: this.getTimestamp(),
    };
  }

  /**
   * Verify PayPal webhook signature
   */
  async verifyWebhookSignature(
    payload: any,
    signature: string,
  ): Promise<boolean> {
    const accessToken = await this.getAccessToken();

    const verifyRequest = {
      transmission_id: payload.id,
      transmission_time: payload.create_time,
      cert_url: payload.cert_url,
      auth_algo: payload.auth_algo,
      transmission_sig: signature,
      webhook_id: this.config.metadata?.webhookId,
      webhook_event: payload,
    };

    const response = await nodeFetch(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          ...this.buildAuthHeaders(),
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(verifyRequest),
      },
    );

    if (!response.ok) {
      return false;
    }

    const result = (await response.json()) as any;
    return result.verification_status === 'SUCCESS';
  }

  /**
   * Parse PayPal webhook payload
   */
  async parseWebhookPayload(payload: any): Promise<PaymentWebhookPayload> {
    const eventType = payload.event_type || '';

    let webhookType: PaymentWebhookPayload['type'] = 'payment.authorized';

    if (eventType.includes('PAYMENT.CAPTURE.COMPLETED')) {
      webhookType = 'payment.captured';
    } else if (eventType.includes('PAYMENT.CAPTURE.DENIED') ||
               eventType.includes('PAYMENT.CAPTURE.REFUNDED')) {
      webhookType = 'payment.failed';
    }

    const resource = payload.resource || {};
    const amount = Math.round(parseFloat(resource.amount?.value || 0) * 100);

    return {
      type: webhookType,
      provider: 'paypal',
      providerEventId: payload.id,
      timestamp: new Date(payload.create_time),
      data: {
        transactionId: resource.id,
        paymentIntentId: resource.supplementary_data?.related_ids?.order_id,
        amount,
        currency: resource.amount?.currency_code || 'USD',
        status: 'completed',
        providerTransactionId: resource.id,
        metadata: {
          paypalEventType: eventType,
          paypalResource: resource,
        },
      },
      signature: payload.signature,
    };
  }
}
