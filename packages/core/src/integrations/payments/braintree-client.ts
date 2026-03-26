/**
 * Braintree Payment Gateway Integration
 * Implements Braintree API for transactions, payment methods, subscriptions, and disputes
 */

import { type PaymentTransaction, type PaymentMethod, type PaymentRefund, type PaymentDispute, type PaymentWebhookEvent, type PaymentMethodDetails, type CustomerData, type PaymentOptions, type RefundReason, type DisputeFilters, type TransactionStatus } from './types';
import { PaymentAdapter } from './payment-adapter';

/**
 * Braintree client configuration
 */
interface BraintreeConfig {
  environment: 'sandbox' | 'production';
  merchantId: string;
  publicKey: string;
  privateKey: string;
}

/**
 * Braintree Gateway API response
 */
interface BraintreeResponse {
  success: boolean;
  transaction?: any;
  payment_method?: any;
  customer?: any;
  errors?: Record<string, any>;
}

/**
 * Braintree adapter implementation
 */
export class BraintreeClient extends PaymentAdapter {
  private config: BraintreeConfig;
  private apiUrl: string;

  constructor(config: BraintreeConfig) {
    super('braintree');
    this.config = config;
    this.apiUrl =
      config.environment === 'production'
        ? 'https://api.braintreegateway.com'
        : 'https://sandbox.braintreegateway.com';
  }

  /**
   * Generate client token for Drop-in UI
   */
  async generateClientToken(customerId?: string): Promise<string> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest('/client_tokens', 'POST', {
        clientToken: {
          customerId: customerId,
        },
      });

      if (!response.success || !response.clientToken?.value) {
        throw new Error('Failed to generate client token');
      }

      return response.clientToken.value;
    });
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
      const response = await this.makeRequest('/transactions', 'POST', {
        transaction: {
          type: 'sale',
          amount: this.formatAmount(amount).toString(),
          paymentMethodNonce: paymentMethodId,
          deviceData: options?.deviceData,
          customFields: {
            orderId: options?.orderId,
            metadata: options?.metadata ? JSON.stringify(options.metadata) : undefined,
          },
          billingAddress: options?.billingAddress
            ? {
                firstName: options.billingAddress.firstName,
                lastName: options.billingAddress.lastName,
                streetAddress: options.billingAddress.street1,
                extendedAddress: options.billingAddress.street2,
                locality: options.billingAddress.city,
                region: options.billingAddress.state,
                postalCode: options.billingAddress.postalCode,
                countryCodeAlpha2: options.billingAddress.country,
              }
            : undefined,
          shippingAddress: options?.shippingAddress
            ? {
                firstName: options.shippingAddress.firstName,
                lastName: options.shippingAddress.lastName,
                streetAddress: options.shippingAddress.street1,
                extendedAddress: options.shippingAddress.street2,
                locality: options.shippingAddress.city,
                region: options.shippingAddress.state,
                postalCode: options.shippingAddress.postalCode,
                countryCodeAlpha2: options.shippingAddress.country,
              }
            : undefined,
          options: {
            submitForSettlement: true,
            skipAvs: options?.skipAvs,
            skipCvv: options?.skipCvv,
            skipAdvancedFraudTools: false,
          },
          skipThreeDSecure:
            options?.attemptThreeDSecure === false || options?.skipTokenization === true,
        },
      });

      if (!response.success) {
        throw new Error(
          `Braintree charge failed: ${JSON.stringify(response.errors)}`
        );
      }

      return this.mapBraintreeTransaction(response.transaction);
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
      const response = await this.makeRequest('/transactions', 'POST', {
        transaction: {
          type: 'authorization',
          amount: this.formatAmount(amount).toString(),
          paymentMethodNonce: paymentMethodId,
          deviceData: options?.deviceData,
          options: {
            submitForSettlement: false,
            skipAvs: options?.skipAvs,
            skipCvv: options?.skipCvv,
          },
        },
      });

      if (!response.success) {
        throw new Error(
          `Braintree authorization failed: ${JSON.stringify(response.errors)}`
        );
      }

      return this.mapBraintreeTransaction(response.transaction);
    });
  }

  /**
   * Capture previously authorized transaction
   */
  async capture(transactionId: string, amount?: number): Promise<PaymentTransaction> {
    return this.executeWithRetries(async () => {
      const captureAmount = amount ? this.formatAmount(amount).toString() : undefined;

      const response = await this.makeRequest(
        `/transactions/${transactionId}/submit_for_settlement`,
        'PUT',
        {
          transaction: {
            amount: captureAmount,
          },
        }
      );

      if (!response.success) {
        throw new Error(
          `Braintree capture failed: ${JSON.stringify(response.errors)}`
        );
      }

      return this.mapBraintreeTransaction(response.transaction);
    });
  }

  /**
   * Void transaction (must be same day)
   */
  async void(transactionId: string): Promise<PaymentTransaction> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/transactions/${transactionId}/void`, 'PUT', {});

      if (!response.success) {
        throw new Error(`Braintree void failed: ${JSON.stringify(response.errors)}`);
      }

      return this.mapBraintreeTransaction(response.transaction);
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
      const refundAmount = amount ? this.formatAmount(amount).toString() : undefined;

      const response = await this.makeRequest(
        `/transactions/${transactionId}/refund`,
        'POST',
        {
          transaction: {
            amount: refundAmount,
          },
        }
      );

      if (!response.success) {
        throw new Error(`Braintree refund failed: ${JSON.stringify(response.errors)}`);
      }

      return {
        id: response.transaction.id,
        externalId: response.transaction.refundId || response.transaction.id,
        providerId: 'braintree',
        transactionId,
        amount: this.formatAmountToCents(parseFloat(response.transaction.amount)),
        currency: response.transaction.currencyIsoCode || 'USD',
        status: 'completed',
        reason: reason || 'other',
        createdAt: new Date(response.transaction.createdAt),
        updatedAt: new Date(response.transaction.updatedAt),
        processedAt: new Date(),
      };
    });
  }

  /**
   * Create or tokenize payment method
   */
  async createPaymentMethod(
    details: PaymentMethodDetails,
    customerId?: string
  ): Promise<PaymentMethod> {
    return this.executeWithRetries(async () => {
      const paymentMethodData: Record<string, any> = {
        paymentMethod: {
          customerId: customerId,
        },
      };

      if (details.type === 'card' && details.cardNumber) {
        paymentMethodData.paymentMethod.type = 'credit_card';
        paymentMethodData.paymentMethod.number = details.cardNumber;
        paymentMethodData.paymentMethod.expirationDate = details.cardExpiry; // MM/YY
        paymentMethodData.paymentMethod.cvv = details.cardCvv;
        paymentMethodData.paymentMethod.cardholderName = details.cardholderName;
      } else if (details.type === 'paypal' && details.paypalEmail) {
        paymentMethodData.paymentMethod.type = 'paypal_account';
        paymentMethodData.paymentMethod.email = details.paypalEmail;
      }

      const response = await this.makeRequest('/payment_methods', 'POST', paymentMethodData);

      if (!response.success) {
        throw new Error(
          `Braintree payment method creation failed: ${JSON.stringify(response.errors)}`
        );
      }

      return this.mapBraintreePaymentMethod(response.paymentMethod);
    });
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(
        `/payment_methods/${paymentMethodId}`,
        'DELETE',
        {}
      );

      if (!response.success) {
        throw new Error(
          `Braintree payment method deletion failed: ${JSON.stringify(response.errors)}`
        );
      }
    });
  }

  /**
   * Retrieve payment method
   */
  async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/payment_methods/${paymentMethodId}`, 'GET');

      if (!response.success) {
        throw new Error(`Braintree payment method lookup failed: ${JSON.stringify(response.errors)}`);
      }

      return this.mapBraintreePaymentMethod(response.paymentMethod);
    });
  }

  /**
   * List customer's payment methods
   */
  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(
        `/customers/${customerId}`,
        'GET'
      );

      if (!response.success) {
        throw new Error(`Braintree customer lookup failed: ${JSON.stringify(response.errors)}`);
      }

      return (response.customer?.paymentMethods || []).map((pm: any) =>
        this.mapBraintreePaymentMethod(pm)
      );
    });
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: string): Promise<PaymentTransaction> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/transactions/${transactionId}`, 'GET');

      if (!response.success) {
        throw new Error(
          `Braintree transaction lookup failed: ${JSON.stringify(response.errors)}`
        );
      }

      return this.mapBraintreeTransaction(response.transaction);
    });
  }

  /**
   * Create customer vault
   */
  async createCustomer(customerData: CustomerData): Promise<{ id: string; externalId: string }> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest('/customers', 'POST', {
        customer: {
          email: customerData.email,
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          phone: customerData.phone,
          customFields: customerData.metadata
            ? { metadata: JSON.stringify(customerData.metadata) }
            : {},
        },
      });

      if (!response.success) {
        throw new Error(
          `Braintree customer creation failed: ${JSON.stringify(response.errors)}`
        );
      }

      return {
        id: response.customer.id,
        externalId: response.customer.id,
      };
    });
  }

  /**
   * Update customer information
   */
  async updateCustomer(customerId: string, data: Partial<CustomerData>): Promise<void> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/customers/${customerId}`, 'PUT', {
        customer: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
        },
      });

      if (!response.success) {
        throw new Error(
          `Braintree customer update failed: ${JSON.stringify(response.errors)}`
        );
      }
    });
  }

  /**
   * Create subscription
   */
  async createSubscription(
    paymentMethodId: string,
    planId: string,
    options?: Record<string, any>
  ): Promise<{ id: string; externalId: string }> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest('/subscriptions', 'POST', {
        subscription: {
          paymentMethodToken: paymentMethodId,
          planId: planId,
          numberOfBillingCycles: options?.billingCycles,
          price: options?.price,
          trialPeriod: options?.trialPeriod,
        },
      });

      if (!response.success) {
        throw new Error(
          `Braintree subscription creation failed: ${JSON.stringify(response.errors)}`
        );
      }

      return {
        id: response.subscription.id,
        externalId: response.subscription.id,
      };
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.verifyHmacSignature(payload, signature, this.config.privateKey);
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): PaymentWebhookEvent | null {
    const eventTypes: Record<string, string> = {
      'transaction.authorized': 'authorized',
      'transaction.settlement_confirmed': 'settled',
      'transaction.settled': 'settled',
      'transaction.voided': 'voided',
      'transaction.submitted_for_settlement': 'captured',
      'transaction.failed': 'failed',
      'transaction.voided': 'voided',
      'payment_method_customer_data_updated': 'payment_method_updated',
      'subscription_charged_successfully': 'subscription_charged',
      'subscription_charging_failed': 'subscription_failed',
      'dispute_opened': 'dispute_opened',
      'dispute_under_review': 'dispute_under_review',
      'dispute_expired': 'dispute_expired',
      'dispute_accepted': 'dispute_won',
      'dispute_lost': 'dispute_lost',
    };

    const eventType = payload.eventType || payload.kind;
    const mappedType = eventTypes[eventType] || eventType;

    return {
      id: payload.id || `braintree-${Date.now()}`,
      providerId: 'braintree',
      provider: 'braintree',
      eventType: mappedType,
      resourceType: this.mapBraintreeResourceType(eventType),
      resourceId: payload.transaction?.id || payload.paymentMethod?.id || payload.subscription?.id || '',
      data: payload,
      timestamp: new Date(),
      verified: true,
      retryCount: 0,
    };
  }

  /**
   * Submit dispute evidence
   */
  async submitDisputeEvidence(disputeId: string, evidence: any[]): Promise<void> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(
        `/disputes/${disputeId}/evidence`,
        'POST',
        {
          evidence: evidence.map((e: any) => ({
            category: e.type,
            url: e.url,
            comment: e.description,
          })),
        }
      );

      if (!response.success) {
        throw new Error(`Braintree dispute evidence submission failed: ${JSON.stringify(response.errors)}`);
      }
    });
  }

  /**
   * Get dispute details
   */
  async getDispute(disputeId: string): Promise<PaymentDispute> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/disputes/${disputeId}`, 'GET');

      if (!response.success) {
        throw new Error(`Braintree dispute lookup failed: ${JSON.stringify(response.errors)}`);
      }

      return this.mapBraintreeDispute(response.dispute);
    });
  }

  /**
   * List disputes
   */
  async listDisputes(filters?: DisputeFilters): Promise<PaymentDispute[]> {
    return this.executeWithRetries(async () => {
      const query: Record<string, any> = {};

      if (filters?.status) {
        query.status = filters.status;
      }
      if (filters?.startDate) {
        query.receivedDate = { min: filters.startDate.toISOString().split('T')[0] };
      }
      if (filters?.endDate) {
        query.receivedDate = { ...query.receivedDate, max: filters.endDate.toISOString().split('T')[0] };
      }

      const response = await this.makeRequest('/disputes', 'POST', query);

      if (!response.success) {
        throw new Error(`Braintree disputes list failed: ${JSON.stringify(response.errors)}`);
      }

      return (response.disputes || []).map((dispute: any) => this.mapBraintreeDispute(dispute));
    });
  }

  /**
   * Make HTTP request to Braintree API
   */
  private async makeRequest(
    path: string,
    method: string = 'GET',
    body?: Record<string, any>
  ): Promise<any> {
    const auth = Buffer.from(`${this.config.publicKey}:${this.config.privateKey}`).toString(
      'base64'
    );

    const options: any = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Witylogix-Payment-Gateway/1.0',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.apiUrl}/merchants/${this.config.merchantId}${path}`, options);
      const data = await response.json();

      if (!response.ok && response.status >= 400) {
        return { success: false, errors: data };
      }

      return { success: response.ok, ...data };
    } catch (error) {
      throw new Error(`Braintree API error: ${(error as Error).message}`);
    }
  }

  /**
   * Map Braintree transaction to standardized format
   */
  private mapBraintreeTransaction(bt: any): PaymentTransaction {
    const statusMap: Record<string, TransactionStatus> = {
      authorized: 'authorized',
      authorizing: 'pending',
      settlement_pending: 'captured',
      settlement_confirmed: 'settled',
      settled: 'settled',
      submitted_for_settlement: 'captured',
      settling: 'captured',
      failed: 'failed',
      voided: 'voided',
      void_pending: 'voided',
      refunded: 'refunded',
    };

    return {
      id: bt.id,
      externalId: bt.id,
      providerId: 'braintree',
      amount: this.formatAmountToCents(parseFloat(bt.amount)),
      currency: bt.currencyIsoCode || 'USD',
      status: statusMap[bt.status] || 'pending',
      paymentMethodId: bt.paymentMethodToken || bt.payment?.id || '',
      customerId: bt.customerId,
      orderId: bt.customFields?.orderId,
      description: bt.description,
      authorizationCode: bt.authorizationCode,
      riskScore: bt.riskData?.score,
      riskLevel: bt.riskData?.level,
      avs: bt.avsErrorResponseCode
        ? {
            code: bt.avsErrorResponseCode,
            message: bt.avsStreetAddressResponseCode,
          }
        : undefined,
      cvv: bt.cvvResponseCode
        ? {
            code: bt.cvvResponseCode,
            message: bt.cvvResponseCode,
          }
        : undefined,
      createdAt: new Date(bt.createdAt),
      updatedAt: new Date(bt.updatedAt),
      authorizedAt: bt.authorizedAt ? new Date(bt.authorizedAt) : undefined,
      capturedAt: bt.submittedForSettlementAt ? new Date(bt.submittedForSettlementAt) : undefined,
      settledAt: bt.settledAt ? new Date(bt.settledAt) : undefined,
      failedAt: bt.failedAt ? new Date(bt.failedAt) : undefined,
      failureReason: bt.statusHistory?.[0]?.message,
    };
  }

  /**
   * Map Braintree payment method to standardized format
   */
  private mapBraintreePaymentMethod(pm: any): PaymentMethod {
    return {
      id: pm.token,
      externalId: pm.token,
      providerId: 'braintree',
      type: pm.type === 'credit_card' ? 'card' : pm.type === 'paypal_account' ? 'paypal' : 'card',
      customerId: pm.customerId,
      cardDetails:
        pm.type === 'credit_card'
          ? {
              brand: (pm.cardType?.toLowerCase() || 'visa') as any,
              lastFour: pm.last4,
              expiryMonth: parseInt(pm.expirationMonth),
              expiryYear: parseInt(pm.expirationYear),
              cardholderName: pm.cardholderName,
              fingerprint: pm.uniqueNumberIdentifier,
            }
          : undefined,
      paypalDetails:
        pm.type === 'paypal_account'
          ? {
              email: pm.email,
              payerId: pm.payerId,
            }
          : undefined,
      isDefault: pm.default,
      isDeleted: false,
      createdAt: new Date(pm.createdAt),
      updatedAt: new Date(pm.updatedAt),
    };
  }

  /**
   * Map Braintree dispute to standardized format
   */
  private mapBraintreeDispute(dispute: any): PaymentDispute {
    const statusMap: Record<string, any> = {
      open: 'opened',
      under_review: 'under_review',
      expired: 'expired',
      accepted: 'won',
      lost: 'lost',
      won: 'won',
    };

    return {
      id: dispute.id,
      externalId: dispute.id,
      providerId: 'braintree',
      transactionId: dispute.transactionDetails?.id || '',
      amount: this.formatAmountToCents(parseFloat(dispute.amountDisputed)),
      currency: dispute.currencyIsoCode || 'USD',
      status: statusMap[dispute.status] || 'opened',
      reason: (dispute.reason?.toLowerCase().replace(/[\s-]/g, '_') as any) || 'general',
      description: dispute.reasonCode,
      openedAt: new Date(dispute.receivedDate),
      dueDate: dispute.replyByDate ? new Date(dispute.replyByDate) : undefined,
      createdAt: new Date(dispute.receivedDate),
      updatedAt: new Date(dispute.updatedDate),
    };
  }

  /**
   * Map Braintree resource type
   */
  private mapBraintreeResourceType(
    eventType: string
  ): 'transaction' | 'payment_method' | 'dispute' | 'refund' | 'subscription' {
    if (eventType.includes('transaction')) return 'transaction';
    if (eventType.includes('payment_method')) return 'payment_method';
    if (eventType.includes('dispute')) return 'dispute';
    if (eventType.includes('subscription')) return 'subscription';
    return 'transaction';
  }
}
