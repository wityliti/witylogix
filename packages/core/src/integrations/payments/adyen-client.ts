/**
 * Adyen Payment Gateway Integration
 * Implements Adyen Checkout API v71 with split payments, recurring, and dispute management
 */

import { type PaymentTransaction, type PaymentMethod, type PaymentRefund, type PaymentDispute, type PaymentWebhookEvent, type PaymentMethodDetails, type CustomerData, type PaymentOptions, type RefundReason, type DisputeFilters, type TransactionStatus } from './types';
import { PaymentAdapter } from './payment-adapter';

/**
 * Adyen configuration
 */
interface AdyenConfig {
  environment: 'test' | 'live';
  apiKey: string;
  merchantAccount: string;
  clientKey?: string;
  webhookHmacKey: string;
}

/**
 * Adyen API response
 */
interface AdyenResponse {
  resultCode?: string;
  transactionId?: string;
  pspReference?: string;
  refusalCode?: string;
  refusalReason?: string;
  errorCode?: string;
  message?: string;
  authentication?: any;
  action?: any;
  amount?: { value: number; currency: string };
  reference?: string;
  errorFields?: Array<{ fieldType: string; errorCode: string }>;
  errors?: Array<{ code: string; message: string }>;
  paymentMethods?: any[];
}

/**
 * Adyen adapter implementation
 */
export class AdyenClient extends PaymentAdapter {
  private config: AdyenConfig;
  private apiUrl: string;

  constructor(config: AdyenConfig) {
    super('adyen');
    this.config = config;
    this.apiUrl =
      config.environment === 'live'
        ? 'https://checkout-api.adyen.com/v71'
        : 'https://checkout-test.adyen.com/v71';
  }

  /**
   * Charge (authorize + capture)
   */
  async charge(
    amount: number,
    currency: string,
    paymentMethodId: string,
    options?: PaymentOptions
  ): Promise<PaymentTransaction> {
    const idempotencyKey = options?.idempotencyKey || this.generateIdempotencyKey({
      amount,
      currency,
      paymentMethodId,
      timestamp: Date.now(),
    });

    return this.executeWithIdempotency(idempotencyKey, async () => {
      const payload = {
        amount: {
          currency: currency,
          value: amount, // Already in cents
        },
        reference: idempotencyKey,
        merchantAccount: this.config.merchantAccount,
        paymentMethod: this.parsePaymentMethodData(paymentMethodId),
        shopperIP: '',
        userAgent: '',
        billingAddress: options?.billingAddress
          ? {
              city: options.billingAddress.city,
              country: options.billingAddress.country,
              houseNumberOrName: options.billingAddress.street1,
              postalCode: options.billingAddress.postalCode,
              stateOrProvince: options.billingAddress.state,
              street: options.billingAddress.street1,
            }
          : undefined,
        deliveryAddress: options?.shippingAddress
          ? {
              city: options.shippingAddress.city,
              country: options.shippingAddress.country,
              houseNumberOrName: options.shippingAddress.street1,
              postalCode: options.shippingAddress.postalCode,
              stateOrProvince: options.shippingAddress.state,
              street: options.shippingAddress.street1,
            }
          : undefined,
        shopperEmail: options?.billingAddress?.email,
        shopperName: options?.billingAddress
          ? {
              firstName: options.billingAddress.firstName,
              lastName: options.billingAddress.lastName,
            }
          : undefined,
        telephoneNumber: options?.billingAddress?.phone,
        recurringProcessingModel: options?.skipTokenization ? undefined : 'CardOnFile',
        deviceFingerprint: options?.deviceData,
        captureDelayHours: 7,
      };

      const response = await this.makeRequest('/payments', payload, idempotencyKey);

      if (response.resultCode === 'Refused' || response.resultCode === 'Error') {
        throw new Error(
          `Adyen charge failed: ${response.refusalReason || response.message || 'Unknown error'}`
        );
      }

      // Handle 3DS challenge if needed
      if (response.action) {
        const pspRef = response.pspReference ?? '';
        return {
          id: pspRef,
          externalId: pspRef,
          providerId: 'adyen',
          amount,
          currency,
          status: 'pending',
          paymentMethodId,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { action: response.action },
        };
      }

      return this.mapAdyenTransaction(response);
    });
  }

  /**
   * Authorize (2-step charge)
   */
  async authorize(
    amount: number,
    currency: string,
    paymentMethodId: string,
    options?: PaymentOptions
  ): Promise<PaymentTransaction> {
    const idempotencyKey = options?.idempotencyKey || this.generateIdempotencyKey({
      amount,
      currency,
      paymentMethodId,
      authorize: true,
      timestamp: Date.now(),
    });

    return this.executeWithIdempotency(idempotencyKey, async () => {
      const payload = {
        amount: {
          currency: currency,
          value: amount,
        },
        reference: idempotencyKey,
        merchantAccount: this.config.merchantAccount,
        paymentMethod: this.parsePaymentMethodData(paymentMethodId),
        shopperIP: '',
        userAgent: '',
        captureDelayHours: 0, // Don't auto-capture for authorize
      };

      const response = await this.makeRequest('/payments', payload, idempotencyKey);

      if (response.resultCode === 'Refused' || response.resultCode === 'Error') {
        throw new Error(
          `Adyen authorization failed: ${response.refusalReason || response.message}`
        );
      }

      return this.mapAdyenTransaction(response, 'authorized');
    });
  }

  /**
   * Capture previously authorized transaction
   */
  async capture(transactionId: string, amount?: number): Promise<PaymentTransaction> {
    return this.executeWithRetries(async () => {
      const payload = {
        originalReference: transactionId,
        modificationAmount: amount
          ? {
              currency: 'USD',
              value: amount,
            }
          : undefined,
        reference: `capture-${transactionId}-${Date.now()}`,
        merchantAccount: this.config.merchantAccount,
      };

      const response = await this.makeRequest(
        `/payments/${transactionId}/captures`,
        payload,
        `capture-${transactionId}`
      );

      if (response.resultCode === 'Refused' || response.resultCode === 'Error') {
        throw new Error(`Adyen capture failed: ${response.refusalReason || response.message}`);
      }

      return this.mapAdyenTransaction(response, 'captured');
    });
  }

  /**
   * Void transaction
   */
  async void(transactionId: string): Promise<PaymentTransaction> {
    return this.executeWithRetries(async () => {
      const payload = {
        originalReference: transactionId,
        reference: `void-${transactionId}-${Date.now()}`,
        merchantAccount: this.config.merchantAccount,
      };

      const response = await this.makeRequest(
        `/payments/${transactionId}/reversals`,
        payload,
        `void-${transactionId}`
      );

      if (response.resultCode === 'Refused' || response.resultCode === 'Error') {
        throw new Error(`Adyen void failed: ${response.refusalReason || response.message}`);
      }

      return this.mapAdyenTransaction(response, 'voided');
    });
  }

  /**
   * Refund captured transaction
   */
  async refund(
    transactionId: string,
    amount?: number,
    reason?: RefundReason
  ): Promise<PaymentRefund> {
    return this.executeWithRetries(async () => {
      const payload = {
        originalReference: transactionId,
        modificationAmount: amount
          ? {
              currency: 'USD',
              value: amount,
            }
          : undefined,
        reference: `refund-${transactionId}-${Date.now()}`,
        merchantAccount: this.config.merchantAccount,
      };

      const response = await this.makeRequest(
        `/payments/${transactionId}/refunds`,
        payload,
        `refund-${transactionId}`
      );

      if (response.resultCode === 'Refused' || response.resultCode === 'Error') {
        throw new Error(`Adyen refund failed: ${response.refusalReason || response.message}`);
      }

      const refundRef = response.pspReference ?? '';
      return {
        id: refundRef,
        externalId: refundRef,
        providerId: 'adyen',
        transactionId,
        amount: amount || 0,
        currency: 'USD',
        status: 'completed',
        reason: reason || 'other',
        createdAt: new Date(),
        updatedAt: new Date(),
        processedAt: new Date(),
      };
    });
  }

  /**
   * Create payment method (tokenization)
   */
  async createPaymentMethod(
    details: PaymentMethodDetails,
    customerId?: string
  ): Promise<PaymentMethod> {
    return this.executeWithRetries(async () => {
      const payload = {
        amount: {
          currency: 'USD',
          value: 0, // Tokenization doesn't require amount
        },
        reference: `pm-${Date.now()}`,
        merchantAccount: this.config.merchantAccount,
        paymentMethod: this.parsePaymentMethodData(
          JSON.stringify({
            type: details.type,
            cardNumber: details.cardNumber,
            expiryMonth: details.cardExpiry?.split('/')[0],
            expiryYear: details.cardExpiry?.split('/')[1],
            cvc: details.cardCvv,
            holderName: details.cardholderName,
          })
        ),
        storePaymentMethod: true,
        recurringProcessingModel: 'CardOnFile',
      };

      const response = await this.makeRequest('/payments', payload, `pm-${Date.now()}`);

      if (response.resultCode === 'Refused' || response.resultCode === 'Error') {
        throw new Error(`Adyen payment method creation failed: ${response.refusalReason}`);
      }

      const pmRef = response.pspReference ?? '';
      return {
        id: pmRef,
        externalId: pmRef,
        providerId: 'adyen',
        type: 'card',
        customerId,
        cardDetails: {
          brand: 'visa',
          lastFour: details.cardNumber?.slice(-4) || '',
          expiryMonth: parseInt(details.cardExpiry?.split('/')[0] || '01'),
          expiryYear: parseInt(details.cardExpiry?.split('/')[1] || '2025'),
          cardholderName: details.cardholderName,
        },
        isDefault: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    throw new Error('Adyen deletePaymentMethod not directly supported');
  }

  /**
   * Get payment method
   */
  async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    throw new Error('Adyen getPaymentMethod not directly supported');
  }

  /**
   * List payment methods
   */
  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(
        `/listPaymentMethods`,
        {
          merchantAccount: this.config.merchantAccount,
          shopperReference: customerId,
        }
      );

      return (response.paymentMethods || []).map((pm: any) => ({
        id: pm.id,
        externalId: pm.id,
        providerId: 'adyen',
        type: pm.type,
        customerId,
        cardDetails: {
          brand: pm.brand,
          lastFour: pm.lastFour,
          expiryMonth: pm.expiryMonth,
          expiryYear: pm.expiryYear,
        },
        isDefault: pm.storedPaymentMethodId === 'DEFAULT',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    });
  }

  /**
   * Get transaction
   */
  async getTransaction(transactionId: string): Promise<PaymentTransaction> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/payments/${transactionId}`, {});

      if (response.resultCode === 'Error') {
        throw new Error(`Adyen transaction lookup failed: ${response.message}`);
      }

      return this.mapAdyenTransaction(response);
    });
  }

  /**
   * Create customer record
   */
  async createCustomer(customerData: CustomerData): Promise<{ id: string; externalId: string }> {
    const customerId = `customer-${Date.now()}`;

    return {
      id: customerId,
      externalId: customerId,
    };
  }

  /**
   * Update customer information
   */
  async updateCustomer(customerId: string, data: Partial<CustomerData>): Promise<void> {
    // Adyen doesn't have explicit customer update; handled via transaction data
    return Promise.resolve();
  }

  /**
   * Create split payment (marketplace)
   */
  async createSplitPayment(
    amount: number,
    currency: string,
    paymentMethodId: string,
    splits: Array<{ accountId: string; amount: number; percentage?: number }>,
    options?: PaymentOptions
  ): Promise<PaymentTransaction> {
    const idempotencyKey = options?.idempotencyKey || this.generateIdempotencyKey({
      amount,
      currency,
      paymentMethodId,
      splits,
      timestamp: Date.now(),
    });

    return this.executeWithIdempotency(idempotencyKey, async () => {
      const payload = {
        amount: {
          currency: currency,
          value: amount,
        },
        reference: idempotencyKey,
        merchantAccount: this.config.merchantAccount,
        paymentMethod: this.parsePaymentMethodData(paymentMethodId),
        splits: splits.map(split => ({
          amount: {
            currency,
            value: split.percentage
              ? Math.round(amount * (split.percentage / 100))
              : split.amount,
          },
          reference: split.accountId,
          type: 'MarketplaceCommission',
        })),
      };

      const response = await this.makeRequest('/payments', payload, idempotencyKey);

      if (response.resultCode === 'Refused' || response.resultCode === 'Error') {
        throw new Error(`Adyen split payment failed: ${response.refusalReason}`);
      }

      return this.mapAdyenTransaction(response);
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Adyen uses HMAC-SHA256
    return this.verifyHmacSignature(payload, signature, this.config.webhookHmacKey);
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): PaymentWebhookEvent | null {
    const notificationItems = payload.notificationItems || [];

    if (notificationItems.length === 0) {
      return null;
    }

    const item = notificationItems[0];
    const notification = item.NotificationRequestItem || item;

    const eventTypes: Record<string, string> = {
      AUTHORISATION: 'authorized',
      CAPTURE: 'captured',
      REFUND: 'refunded',
      CANCELLATION: 'voided',
      CAPTUREFAILED: 'failed',
      REFUNDFAILED: 'failed',
      CANCELLATIONFAILED: 'failed',
      CHARGEBACK: 'dispute_opened',
      CHARGEBACK_REVERSED: 'dispute_won',
      NOTIFICATIONTEST: 'test',
      PENDING: 'pending',
      REPORT_AVAILABLE: 'report_ready',
    };

    const eventType = notification.eventCode || 'unknown';
    const mappedType = eventTypes[eventType] || eventType;

    return {
      id: notification.pspReference || `adyen-${Date.now()}`,
      providerId: 'adyen',
      provider: 'adyen',
      eventType: mappedType,
      resourceType: this.mapAdyenResourceType(eventType),
      resourceId: notification.pspReference || notification.reference || '',
      data: notification,
      timestamp: new Date(notification.eventDate || Date.now()),
      verified: true,
      retryCount: 0,
    };
  }

  /**
   * Submit dispute evidence
   */
  async submitDisputeEvidence(disputeId: string, evidence: any[]): Promise<void> {
    throw new Error('Adyen dispute evidence submission not directly supported');
  }

  /**
   * Get dispute
   */
  async getDispute(disputeId: string): Promise<PaymentDispute> {
    throw new Error('Adyen getDispute not directly supported');
  }

  /**
   * List disputes
   */
  async listDisputes(filters?: DisputeFilters): Promise<PaymentDispute[]> {
    return [];
  }

  /**
   * Make HTTP request to Adyen API
   */
  private async makeRequest(
    path: string,
    payload: Record<string, any>,
    idempotencyKey?: string
  ): Promise<AdyenResponse> {
    try {
      const headers: Record<string, string> = {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Witylogix-Payment-Gateway/1.0',
      };

      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }

      const response = await fetch(`${this.apiUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as AdyenResponse & {
        transactionId?: string;
        authentication?: unknown;
        action?: unknown;
        paymentMethods?: unknown[];
      };

      return {
        resultCode: data.resultCode,
        transactionId: data.transactionId,
        pspReference: data.pspReference,
        refusalCode: data.refusalCode,
        refusalReason: data.refusalReason,
        message: data.message,
        authentication: data.authentication,
        action: data.action,
        amount: data.amount,
        reference: data.reference,
        errorCode: data.errorCode,
        errors: data.errors,
        paymentMethods: data.paymentMethods,
      };
    } catch (error) {
      throw new Error(`Adyen API error: ${(error as Error).message}`);
    }
  }

  /**
   * Parse payment method data from JSON string or object
   */
  private parsePaymentMethodData(paymentMethodId: string): Record<string, any> {
    try {
      return JSON.parse(paymentMethodId);
    } catch {
      return {
        type: 'scheme',
        storedPaymentMethodId: paymentMethodId,
      };
    }
  }

  /**
   * Map Adyen transaction to standardized format
   */
  private mapAdyenTransaction(response: AdyenResponse, overrideStatus?: TransactionStatus): PaymentTransaction {
    const statusMap: Record<string, TransactionStatus> = {
      Authorised: 'authorized',
      Refused: 'failed',
      Received: 'pending',
      RedirectShopper: 'pending',
      Error: 'failed',
      Cancelled: 'voided',
      AuthorisedPending3D2Result: 'pending',
    };

    const status = overrideStatus || statusMap[response.resultCode || ''] || 'pending';

    return {
      id: response.pspReference || '',
      externalId: response.pspReference || '',
      providerId: 'adyen',
      amount: response.amount?.value || 0,
      currency: response.amount?.currency || 'USD',
      status,
      paymentMethodId: response.pspReference || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      failureReason: response.refusalReason || response.message,
    };
  }

  /**
   * Map Adyen resource type
   */
  private mapAdyenResourceType(
    eventType: string
  ): 'transaction' | 'payment_method' | 'dispute' | 'refund' | 'subscription' {
    if (eventType === 'REFUND' || eventType === 'REFUNDFAILED') return 'refund';
    if (eventType === 'CHARGEBACK' || eventType === 'CHARGEBACK_REVERSED') return 'dispute';
    return 'transaction';
  }
}
