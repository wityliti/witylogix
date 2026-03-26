/**
 * Authorize.Net Payment Gateway Integration
 * Implements Authorize.Net API for transactions, customer profiles, recurring billing, and fraud detection
 */

import { type PaymentTransaction, type PaymentMethod, type PaymentRefund, type PaymentDispute, type PaymentWebhookEvent, type PaymentMethodDetails, type CustomerData, type PaymentOptions, type RefundReason, type DisputeFilters, type TransactionStatus } from './types';
import { PaymentAdapter } from './payment-adapter';

/**
 * Authorize.Net configuration
 */
interface AuthorizeNetConfig {
  environment: 'sandbox' | 'production';
  apiLoginId: string;
  transactionKey: string;
  publicKey?: string;
  signatureKey: string;
}

/**
 * Authorize.Net response
 */
interface AuthorizeNetResponse {
  resultCode: 'Ok' | 'Error';
  messages: Array<{ code: string; text: string }>;
  transactionResponse?: any;
  customerProfileId?: string;
  customerPaymentProfileId?: string;
  customerShippingAddressId?: string;
  validationDirectResponse?: string;
  errors?: Array<{ code: string; text: string }>;
}

/**
 * Authorize.Net adapter implementation
 */
export class AuthorizeNetClient extends PaymentAdapter {
  private config: AuthorizeNetConfig;
  private apiUrl: string;

  constructor(config: AuthorizeNetConfig) {
    super('authorize-net');
    this.config = config;
    this.apiUrl =
      config.environment === 'production'
        ? 'https://api.authorize.net/xml/v1/request.api'
        : 'https://apitest.authorize.net/xml/v1/request.api';
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
        createTransactionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          refId: idempotencyKey,
          transactionRequest: {
            transactionType: 'authCaptureTransaction',
            amount: this.formatAmount(amount).toString(),
            currencyCode: currency,
            payment: {
              opaqueData: {
                dataDescriptor: 'COMMON.APPLE.INAPP.PAYMENT',
                dataValue: paymentMethodId,
              },
            },
            deviceData: options?.deviceData,
            orderId: options?.orderId,
            description: options?.description,
            billTo: options?.billingAddress
              ? {
                  firstName: options.billingAddress.firstName,
                  lastName: options.billingAddress.lastName,
                  address: options.billingAddress.street1,
                  city: options.billingAddress.city,
                  state: options.billingAddress.state,
                  zip: options.billingAddress.postalCode,
                  country: options.billingAddress.country,
                  email: options.billingAddress.email,
                  phoneNumber: options.billingAddress.phone,
                }
              : undefined,
            shipTo: options?.shippingAddress
              ? {
                  firstName: options.shippingAddress.firstName,
                  lastName: options.shippingAddress.lastName,
                  address: options.shippingAddress.street1,
                  city: options.shippingAddress.city,
                  state: options.shippingAddress.state,
                  zip: options.shippingAddress.postalCode,
                  country: options.shippingAddress.country,
                }
              : undefined,
            userFields: options?.metadata
              ? Object.entries(options.metadata).map(([name, value]) => ({ name, value: String(value) }))
              : [],
            processingOptions: {
              isStoredCredential: !options?.skipTokenization,
              skipFraudDetection: false,
            },
            subsequentAuthInformation: {
              originalNetworkTransId: '',
              originalAuthAmount: '',
              reason: 'resubmission',
            },
            authorizationIndicatorType: {
              authorizationIndicator: 'pre',
            },
            customerIP: '',
          },
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net charge failed: ${errorMsg}`);
      }

      return this.mapAuthorizeNetTransaction(response.transactionResponse);
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
        createTransactionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          refId: idempotencyKey,
          transactionRequest: {
            transactionType: 'authOnlyTransaction',
            amount: this.formatAmount(amount).toString(),
            currencyCode: currency,
            payment: {
              opaqueData: {
                dataDescriptor: 'COMMON.APPLE.INAPP.PAYMENT',
                dataValue: paymentMethodId,
              },
            },
            orderId: options?.orderId,
            description: options?.description,
            billTo: options?.billingAddress
              ? {
                  firstName: options.billingAddress.firstName,
                  lastName: options.billingAddress.lastName,
                  address: options.billingAddress.street1,
                  city: options.billingAddress.city,
                  state: options.billingAddress.state,
                  zip: options.billingAddress.postalCode,
                  country: options.billingAddress.country,
                }
              : undefined,
          },
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net authorization failed: ${errorMsg}`);
      }

      return this.mapAuthorizeNetTransaction(response.transactionResponse);
    });
  }

  /**
   * Capture previously authorized transaction
   */
  async capture(transactionId: string, amount?: number): Promise<PaymentTransaction> {
    return this.executeWithRetries(async () => {
      const payload = {
        createTransactionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          refId: `capture-${transactionId}-${Date.now()}`,
          transactionRequest: {
            transactionType: 'priorAuthCaptureTransaction',
            refTransId: transactionId,
            amount: amount ? this.formatAmount(amount).toString() : undefined,
          },
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net capture failed: ${errorMsg}`);
      }

      return this.mapAuthorizeNetTransaction(response.transactionResponse);
    });
  }

  /**
   * Void transaction
   */
  async void(transactionId: string): Promise<PaymentTransaction> {
    return this.executeWithRetries(async () => {
      const payload = {
        createTransactionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          refId: `void-${transactionId}-${Date.now()}`,
          transactionRequest: {
            transactionType: 'voidTransaction',
            refTransId: transactionId,
          },
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net void failed: ${errorMsg}`);
      }

      return this.mapAuthorizeNetTransaction(response.transactionResponse);
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
        createTransactionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          refId: `refund-${transactionId}-${Date.now()}`,
          transactionRequest: {
            transactionType: 'refundTransaction',
            refTransId: transactionId,
            amount: amount ? this.formatAmount(amount).toString() : undefined,
          },
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net refund failed: ${errorMsg}`);
      }

      return {
        id: response.transactionResponse?.transId,
        externalId: response.transactionResponse?.transId,
        providerId: 'authorize-net',
        transactionId,
        amount: amount ? this.formatAmountToCents(amount) : 0,
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
   * Create customer vault (Customer Information Manager)
   */
  async createCustomer(customerData: CustomerData): Promise<{ id: string; externalId: string }> {
    return this.executeWithRetries(async () => {
      const payload = {
        createCustomerProfileRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          profile: {
            merchantCustomerId: `${Date.now()}`,
            description: customerData.email,
            email: customerData.email,
            phoneNumber: customerData.phone,
            faxNumber: '',
            taxId: '',
            type: 'individual',
          },
          validationMode: 'liveMode',
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net customer creation failed: ${errorMsg}`);
      }

      return {
        id: response.customerProfileId,
        externalId: response.customerProfileId,
      };
    });
  }

  /**
   * Update customer information
   */
  async updateCustomer(customerId: string, data: Partial<CustomerData>): Promise<void> {
    return this.executeWithRetries(async () => {
      const payload = {
        updateCustomerProfileRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          profile: {
            customerProfileId: customerId,
            email: data.email,
            phoneNumber: data.phone,
          },
          validationMode: 'liveMode',
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net customer update failed: ${errorMsg}`);
      }
    });
  }

  /**
   * Create payment method (payment profile)
   */
  async createPaymentMethod(
    details: PaymentMethodDetails,
    customerId?: string
  ): Promise<PaymentMethod> {
    return this.executeWithRetries(async () => {
      const payload: any = {
        createCustomerPaymentProfileRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          customerProfileId: customerId,
          paymentProfile: {
            billTo: {
              firstName: details.cardholderName?.split(' ')[0] || '',
              lastName: details.cardholderName?.split(' ')[1] || '',
              address: details.billingAddress?.street1,
              city: details.billingAddress?.city,
              state: details.billingAddress?.state,
              zip: details.billingAddress?.postalCode,
              country: details.billingAddress?.country,
            },
            payment: {
              creditCard: {
                cardNumber: details.cardNumber,
                expirationDate: details.cardExpiry, // YYYY-MM
              },
            },
            customerType: 'individual',
          },
          validationMode: 'liveMode',
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net payment method creation failed: ${errorMsg}`);
      }

      return {
        id: response.customerPaymentProfileId,
        externalId: response.customerPaymentProfileId,
        providerId: 'authorize-net',
        type: 'card',
        customerId,
        cardDetails: {
          brand: 'visa',
          lastFour: details.cardNumber?.slice(-4) || '',
          expiryMonth: parseInt(details.cardExpiry?.split('-')[1] || '01'),
          expiryYear: parseInt(details.cardExpiry?.split('-')[0] || '2025'),
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
    return this.executeWithRetries(async () => {
      // Authorize.Net requires customer profile ID
      throw new Error('Authorize.Net deletePaymentMethod requires customerProfileId');
    });
  }

  /**
   * Get payment method
   */
  async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
    throw new Error('Authorize.Net getPaymentMethod not supported without customerProfileId');
  }

  /**
   * List payment methods
   */
  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    return this.executeWithRetries(async () => {
      const payload = {
        getCustomerProfileRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          customerProfileId: customerId,
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net payment methods list failed: ${errorMsg}`);
      }

      return (response.profile?.paymentProfiles || []).map((pp: any) => ({
        id: pp.customerPaymentProfileId,
        externalId: pp.customerPaymentProfileId,
        providerId: 'authorize-net',
        type: 'card',
        customerId,
        cardDetails: {
          brand: 'visa',
          lastFour: pp.payment?.creditCard?.cardNumber?.slice(-4) || '',
          expiryMonth: parseInt(pp.payment?.creditCard?.expirationDate?.split('-')[1] || '01'),
          expiryYear: parseInt(pp.payment?.creditCard?.expirationDate?.split('-')[0] || '2025'),
        },
        isDefault: pp.defaultPaymentProfile,
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
      const payload = {
        getTransactionDetailsRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          transId: transactionId,
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net transaction lookup failed: ${errorMsg}`);
      }

      return this.mapAuthorizeNetTransaction(response.transactionResponse);
    });
  }

  /**
   * Create recurring billing (Automated Recurring Billing)
   */
  async createRecurringBilling(
    customerPaymentProfileId: string,
    amount: number,
    intervalDays: number,
    totalOccurrences: number,
    options?: Record<string, any>
  ): Promise<{ id: string; externalId: string }> {
    return this.executeWithRetries(async () => {
      const payload = {
        ARBCreateSubscriptionRequest: {
          merchantAuthentication: {
            name: this.config.apiLoginId,
            transactionKey: this.config.transactionKey,
          },
          refId: `subscription-${Date.now()}`,
          subscription: {
            name: options?.name || `Subscription-${Date.now()}`,
            paymentSchedule: {
              interval: {
                length: intervalDays,
                unit: 'days',
              },
              startDate: new Date().toISOString().split('T')[0],
              totalOccurrences: totalOccurrences,
              trialOccurrences: 0,
            },
            amount: this.formatAmount(amount).toString(),
            trialAmount: '0.00',
            payment: {
              creditCard: {
                cardNumber: options?.cardNumber,
                expirationDate: options?.expirationDate,
              },
            },
            customer: {
              id: options?.customerId,
              email: options?.customerEmail,
              phoneNumber: options?.customerPhone,
            },
            billTo: {
              firstName: options?.firstName,
              lastName: options?.lastName,
              address: options?.address,
              city: options?.city,
              state: options?.state,
              zip: options?.zip,
              country: options?.country,
            },
            shipTo: {
              firstName: options?.firstName,
              lastName: options?.lastName,
              address: options?.address,
              city: options?.city,
              state: options?.state,
              zip: options?.zip,
              country: options?.country,
            },
          },
        },
      };

      const response = await this.makeRequest(payload);

      if (response.resultCode !== 'Ok') {
        const errorMsg = response.messages?.map((m: any) => m.text).join(', ') || 'Unknown error';
        throw new Error(`Authorize.Net recurring billing creation failed: ${errorMsg}`);
      }

      return {
        id: response.subscriptionId,
        externalId: response.subscriptionId,
      };
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.verifyHmacSignature(payload, signature, this.config.signatureKey);
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): PaymentWebhookEvent | null {
    const eventTypes: Record<string, string> = {
      'net.authorize.payment.authcapture.created': 'captured',
      'net.authorize.payment.capture.created': 'captured',
      'net.authorize.payment.void.created': 'voided',
      'net.authorize.payment.refund.created': 'refunded',
      'net.authorize.payment.fraud.approved': 'fraud_approved',
      'net.authorize.payment.fraud.declined': 'fraud_declined',
      'net.authorize.payment.dispute.created': 'dispute_opened',
      'net.authorize.payment.dispute.resolved': 'dispute_resolved',
      'net.authorize.customer.subscription.created': 'subscription_created',
      'net.authorize.customer.subscription.updated': 'subscription_updated',
      'net.authorize.customer.subscription.expiring': 'subscription_expiring',
      'net.authorize.customer.subscription.suspended': 'subscription_suspended',
      'net.authorize.customer.subscription.terminated': 'subscription_terminated',
    };

    const eventType = payload.eventType || 'unknown';
    const mappedType = eventTypes[eventType] || eventType;

    return {
      id: payload.eventId || `authnet-${Date.now()}`,
      providerId: 'authorize-net',
      provider: 'authorize-net',
      eventType: mappedType,
      resourceType: this.mapAuthorizeNetResourceType(eventType),
      resourceId: payload.payload?.id || payload.transactionId || '',
      data: payload,
      timestamp: new Date(payload.eventDate || Date.now()),
      verified: true,
      retryCount: 0,
    };
  }

  /**
   * Submit dispute evidence
   */
  async submitDisputeEvidence(disputeId: string, evidence: any[]): Promise<void> {
    throw new Error('Authorize.Net dispute evidence submission not directly supported');
  }

  /**
   * Get dispute
   */
  async getDispute(disputeId: string): Promise<PaymentDispute> {
    throw new Error('Authorize.Net getDispute not supported');
  }

  /**
   * List disputes
   */
  async listDisputes(filters?: DisputeFilters): Promise<PaymentDispute[]> {
    return [];
  }

  /**
   * Make HTTP request to Authorize.Net API
   */
  private async makeRequest(payload: Record<string, any>): Promise<AuthorizeNetResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Witylogix-Payment-Gateway/1.0',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      return {
        resultCode: data.messages?.resultCode || (response.ok ? 'Ok' : 'Error'),
        messages: data.messages?.message || [],
        transactionResponse: data.transactionResponse,
        customerProfileId: data.customerProfileId,
        customerPaymentProfileId: data.customerPaymentProfileId,
        validationDirectResponse: data.validationDirectResponse,
        subscriptionId: data.subscriptionId,
      };
    } catch (error) {
      throw new Error(`Authorize.Net API error: ${(error as Error).message}`);
    }
  }

  /**
   * Map Authorize.Net transaction to standardized format
   */
  private mapAuthorizeNetTransaction(tr: any): PaymentTransaction {
    const statusMap: Record<string, TransactionStatus> = {
      1: 'authorized',
      2: 'declined',
      3: 'failed',
      4: 'held',
      '4': 'held',
      captureOnlyTransaction: 'captured',
      authOnlyTransaction: 'authorized',
      authCaptureTransaction: 'captured',
      voidTransaction: 'voided',
      refundTransaction: 'refunded',
      priorAuthCaptureTransaction: 'captured',
    };

    return {
      id: tr.transId || tr.refId,
      externalId: tr.transId,
      providerId: 'authorize-net',
      amount: this.formatAmountToCents(parseFloat(tr.amount)),
      currency: 'USD',
      status: statusMap[tr.responseCode] || statusMap[tr.transactionType] || 'pending',
      paymentMethodId: tr.payment?.creditCard?.cardNumber?.slice(-4) || '',
      description: tr.description,
      authorizationCode: tr.authCode,
      avs: {
        code: tr.avsResultCode || '',
        message: tr.avsResultCode || '',
      },
      cvv: {
        code: tr.cvvResultCode || '',
        message: tr.cvvResultCode || '',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Map Authorize.Net resource type
   */
  private mapAuthorizeNetResourceType(
    eventType: string
  ): 'transaction' | 'payment_method' | 'dispute' | 'refund' | 'subscription' {
    if (eventType.includes('subscription')) return 'subscription';
    if (eventType.includes('dispute')) return 'dispute';
    if (eventType.includes('fraud')) return 'transaction';
    return 'transaction';
  }
}
