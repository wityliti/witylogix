/**
 * Payment Integration Types
 * Standardized payment transaction, method, and webhook types
 */

/**
 * Transaction status enumeration
 */
export type TransactionStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'settled'
  | 'refunded'
  | 'voided'
  | 'failed';

/**
 * Payment method type enumeration
 */
export type PaymentMethodType =
  | 'card'
  | 'ach'
  | 'paypal'
  | 'apple-pay'
  | 'google-pay'
  | 'bank-transfer';

/**
 * Card type enumeration
 */
export type CardType = 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb';

/**
 * Refund reason enumeration
 */
export type RefundReason =
  | 'customer_request'
  | 'duplicate'
  | 'fraudulent'
  | 'unrecognized'
  | 'product_unsatisfactory'
  | 'cancelled_order'
  | 'other';

/**
 * Dispute reason enumeration
 */
export type DisputeReason =
  | 'fraudulent'
  | 'authorization_issue'
  | 'chargeback'
  | 'inquiry'
  | 'processing_error'
  | 'unrecognized'
  | 'general';

/**
 * Dispute status enumeration
 */
export type DisputeStatus =
  | 'opened'
  | 'under_review'
  | 'evidence_submitted'
  | 'resolved'
  | 'lost'
  | 'won'
  | 'expired';

/**
 * Payment transaction metadata
 */
export interface PaymentTransaction {
  id: string;
  externalId: string; // Provider's transaction ID
  providerId: string; // Payment provider identifier
  amount: number; // In cents
  currency: string; // ISO 4217 code
  status: TransactionStatus;
  paymentMethodId: string;
  customerId?: string;
  orderId?: string;
  description?: string;
  metadata?: Record<string, any>;
  authorizationCode?: string;
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  avs?: {
    code: string;
    message: string;
  };
  cvv?: {
    code: string;
    message: string;
  };
  threeDSecure?: {
    authenticated: boolean;
    version: string;
    cavv?: string;
    xid?: string;
  };
  billing?: BillingAddress;
  shipping?: ShippingAddress;
  createdAt: Date;
  updatedAt: Date;
  authorizedAt?: Date;
  capturedAt?: Date;
  settledAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  fees?: {
    amount: number;
    percentage: number;
  };
  idempotencyKey?: string;
}

/**
 * Payment method entity
 */
export interface PaymentMethod {
  id: string;
  externalId: string; // Provider's tokenized payment method
  providerId: string;
  type: PaymentMethodType;
  customerId?: string;
  cardDetails?: CardDetails;
  achDetails?: ACHDetails;
  paypalDetails?: PayPalDetails;
  billingAddress?: BillingAddress;
  isDefault: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Card payment details (tokenized)
 */
export interface CardDetails {
  brand: CardType;
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName?: string;
  issuerCountry?: string;
  issuingBank?: string;
  fingerprint?: string; // Unique card identifier
}

/**
 * ACH bank transfer details (tokenized)
 */
export interface ACHDetails {
  accountType: 'checking' | 'savings';
  accountHolderName: string;
  routingNumber?: string; // Last 4 digits only
  accountNumber?: string; // Last 4 digits only
  bankName?: string;
  fingerprint?: string;
}

/**
 * PayPal payment details
 */
export interface PayPalDetails {
  email?: string;
  payerId?: string;
  fingerprint?: string;
}

/**
 * Billing address
 */
export interface BillingAddress {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Shipping address
 */
export interface ShippingAddress {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Payment refund entity
 */
export interface PaymentRefund {
  id: string;
  externalId: string; // Provider's refund ID
  providerId: string;
  transactionId: string;
  amount: number; // In cents
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  reason: RefundReason;
  description?: string;
  metadata?: Record<string, any>;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  idempotencyKey?: string;
}

/**
 * Payment dispute entity
 */
export interface PaymentDispute {
  id: string;
  externalId: string; // Provider's dispute ID
  providerId: string;
  transactionId: string;
  amount: number; // In cents
  currency: string;
  status: DisputeStatus;
  reason: DisputeReason;
  description?: string;
  customerEmail?: string;
  evidence?: DisputeEvidence[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  openedAt: Date;
  closedAt?: Date;
  dueDate?: Date;
  winLossReason?: string;
}

/**
 * Dispute evidence for chargeback defense
 */
export interface DisputeEvidence {
  id: string;
  type:
    | 'invoice'
    | 'shipping_proof'
    | 'customer_communication'
    | 'refund_proof'
    | 'signature_proof'
    | 'other';
  url: string;
  description?: string;
  uploadedAt: Date;
}

/**
 * Payment configuration
 */
export interface PaymentConfig {
  providerId: string;
  provider: 'braintree' | 'authorize-net' | 'adyen' | 'stripe' | 'square';
  credentials: {
    apiKey?: string;
    apiSecret?: string;
    accountId?: string;
    merchantId?: string;
    clientId?: string;
    clientSecret?: string;
    publicKey?: string;
    privateKey?: string;
    environment: 'sandbox' | 'production';
  };
  webhookSecret?: string;
  webhookUrl?: string;
  features: {
    supportsTokenization: boolean;
    supportsSubscriptions: boolean;
    supports3DS: boolean;
    supportsAchTransfers: boolean;
    supportsApplePay: boolean;
    supportsGooglePay: boolean;
    supportsDisputes: boolean;
    supportsRecurring: boolean;
  };
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
  retryPolicy: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

/**
 * Payment webhook event
 */
export interface PaymentWebhookEvent {
  id: string;
  providerId: string;
  provider: string;
  eventType: string;
  resourceType: 'transaction' | 'payment_method' | 'dispute' | 'refund' | 'subscription';
  resourceId: string;
  data: Record<string, any>;
  timestamp: Date;
  signature?: string;
  verified: boolean;
  retryCount: number;
  lastRetryAt?: Date;
  processingError?: string;
}

/**
 * Payment adapter interface
 */
export interface PaymentAdapterInterface {
  /**
   * Charge (authorize + capture)
   */
  charge(
    amount: number,
    currency: string,
    paymentMethodId: string,
    options?: PaymentOptions
  ): Promise<PaymentTransaction>;

  /**
   * Authorize only (2-step charge)
   */
  authorize(
    amount: number,
    currency: string,
    paymentMethodId: string,
    options?: PaymentOptions
  ): Promise<PaymentTransaction>;

  /**
   * Capture a previously authorized transaction
   */
  capture(transactionId: string, amount?: number): Promise<PaymentTransaction>;

  /**
   * Void a transaction (must be same day)
   */
  void(transactionId: string): Promise<PaymentTransaction>;

  /**
   * Refund a captured transaction
   */
  refund(transactionId: string, amount?: number, reason?: RefundReason): Promise<PaymentRefund>;

  /**
   * Create or tokenize a payment method
   */
  createPaymentMethod(
    details: PaymentMethodDetails,
    customerId?: string
  ): Promise<PaymentMethod>;

  /**
   * Delete a tokenized payment method
   */
  deletePaymentMethod(paymentMethodId: string): Promise<void>;

  /**
   * Retrieve payment method details
   */
  getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod>;

  /**
   * List customer's payment methods
   */
  listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;

  /**
   * Get transaction details
   */
  getTransaction(transactionId: string): Promise<PaymentTransaction>;

  /**
   * Create customer vault
   */
  createCustomer(customerData: CustomerData): Promise<{ id: string; externalId: string }>;

  /**
   * Update customer information
   */
  updateCustomer(customerId: string, data: Partial<CustomerData>): Promise<void>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): PaymentWebhookEvent | null;

  /**
   * Handle dispute evidence submission
   */
  submitDisputeEvidence(disputeId: string, evidence: DisputeEvidence[]): Promise<void>;

  /**
   * Get dispute details
   */
  getDispute(disputeId: string): Promise<PaymentDispute>;

  /**
   * List disputes
   */
  listDisputes(filters?: DisputeFilters): Promise<PaymentDispute[]>;
}

/**
 * Payment options for transaction
 */
export interface PaymentOptions {
  customerId?: string;
  orderId?: string;
  description?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  skipTokenization?: boolean;
  attemptThreeDSecure?: boolean;
  billingAddress?: BillingAddress;
  shippingAddress?: ShippingAddress;
  deviceData?: string; // Device fingerprinting
  skipAvs?: boolean;
  skipCvv?: boolean;
}

/**
 * Payment method details for creation
 */
export interface PaymentMethodDetails {
  type: PaymentMethodType;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardholderName?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountHolderName?: string;
  accountType?: 'checking' | 'savings';
  paypalEmail?: string;
  billingAddress?: BillingAddress;
}

/**
 * Customer data for vault
 */
export interface CustomerData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  billingAddress?: BillingAddress;
  shippingAddress?: ShippingAddress;
  metadata?: Record<string, any>;
}

/**
 * Dispute filters for querying
 */
export interface DisputeFilters {
  status?: DisputeStatus;
  reason?: DisputeReason;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  providerId?: string;
}
