/**
 * Payment SDK Shared Types
 * Provider-agnostic payment data structures for Stripe and PayPal integrations
 */

/**
 * Unified payment status enumeration
 */
export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "processing"
  | "failed"
  | "canceled";

/**
 * Subscription status enumeration
 */
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "suspended"
  | "ended";

/**
 * Refund status enumeration
 */
export type RefundStatus = "pending" | "succeeded" | "failed" | "canceled";

/**
 * Refund reason enumeration
 */
export type RefundReason =
  | "duplicate"
  | "fraudulent"
  | "requested_by_customer"
  | "expired_uncaptured_charge"
  | "general"
  | "customer_request"
  | "unrecognized";

/**
 * Invoice status enumeration
 */
export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible"
  | "scheduled";

/**
 * Dispute status enumeration
 */
export type DisputeStatus =
  | "warning_opened"
  | "warning_under_review"
  | "warning_won"
  | "warning_lost"
  | "opened"
  | "under_review"
  | "charge_refunded"
  | "won"
  | "lost"
  | "accepted";

/**
 * Dispute reason enumeration
 */
export type DisputeReason =
  | "bank_account_closed"
  | "bank_cannot_process"
  | "check_returned"
  | "credit_not_processed"
  | "customer_initiated_transfer_reversal"
  | "duplicate"
  | "fraudulent"
  | "general"
  | "improper_account_info"
  | "insufficient_funds"
  | "product_unacceptable"
  | "product_not_received"
  | "unauthorised"
  | "unrecognized_transaction";

/**
 * Unified payment intent metadata
 */
export interface PaymentIntent {
  id: string;
  externalId: string; // Provider-specific ID
  provider: "stripe" | "paypal";
  amount: number; // In cents
  currency: string; // ISO 4217
  status: PaymentStatus;
  customerId?: string;
  orderId?: string;
  description?: string;
  metadata?: Record<string, any>;
  paymentMethodId?: string;
  clientSecret?: string; // For frontend-side confirmation
  receiptEmail?: string;
  createdAt: Date;
  updatedAt: Date;
  capturedAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  idempotencyKey?: string;
  statementDescriptor?: string;
  nextAction?: {
    type: "use_stripe_sdk" | "redirect_to_url" | "oob_otp_verification";
    url?: string;
  };
}

/**
 * Unified subscription metadata
 */
export interface Subscription {
  id: string;
  externalId: string; // Provider-specific ID
  provider: "stripe" | "paypal";
  customerId: string;
  status: SubscriptionStatus;
  items: SubscriptionItem[];
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  canceledAt?: Date;
  endedAt?: Date;
  nextBillingDate?: Date;
  currency: string;
  metadata?: Record<string, any>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  latestInvoiceId?: string;
  pauseCollection?: {
    resumesAt?: Date;
  };
  transferData?: {
    destination: string;
  };
}

/**
 * Subscription line item
 */
export interface SubscriptionItem {
  id: string;
  externalId: string;
  priceId: string;
  quantity: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Unified invoice metadata
 */
export interface Invoice {
  id: string;
  externalId: string; // Provider-specific ID
  provider: "stripe" | "paypal";
  customerId: string;
  subscriptionId?: string;
  amount: number; // In cents
  amountPaid: number; // In cents
  amountDue: number; // In cents
  currency: string;
  status: InvoiceStatus;
  dueDate?: Date;
  paidAt?: Date;
  voidedAt?: Date;
  description?: string;
  metadata?: Record<string, any>;
  hostedInvoiceUrl?: string;
  pdfUrl?: string;
  number?: string;
  createdAt: Date;
  updatedAt: Date;
  lines: InvoiceLineItem[];
  attemptCount?: number;
  nextPaymentAttempt?: Date;
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  id: string;
  externalId: string;
  description: string;
  amount: number; // In cents
  quantity: number;
  unitAmount?: number; // In cents
  currency: string;
  metadata?: Record<string, any>;
  period?: {
    start: Date;
    end: Date;
  };
}

/**
 * Unified refund metadata
 */
export interface Refund {
  id: string;
  externalId: string; // Provider-specific ID
  provider: "stripe" | "paypal";
  chargeId: string;
  amount: number; // In cents
  currency: string;
  status: RefundStatus;
  reason: RefundReason;
  metadata?: Record<string, any>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  failureReason?: string;
  receiptNumber?: string;
  idempotencyKey?: string;
}

/**
 * Unified dispute/chargeback metadata
 */
export interface Dispute {
  id: string;
  externalId: string; // Provider-specific ID
  provider: "stripe" | "paypal";
  chargeId: string;
  amount: number; // In cents
  currency: string;
  status: DisputeStatus;
  reason: DisputeReason;
  evidence?: string[];
  metadata?: Record<string, any>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  openedAt: Date;
  closedAt?: Date;
  dueDate?: Date;
  submittedEvidenceAt?: Date;
}

/**
 * Checkout session for hosted payment page
 */
export interface CheckoutSession {
  id: string;
  externalId: string; // Provider-specific ID
  provider: "stripe" | "paypal";
  customerId?: string;
  mode: "payment" | "setup" | "subscription";
  paymentStatus: "unpaid" | "paid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  clientSecret?: string;
  url?: string; // Hosted page URL
  successUrl?: string;
  cancelUrl?: string;
  lineItems: CheckoutLineItem[];
  currency: string;
  metadata?: Record<string, any>;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
  customerEmail?: string;
  billingAddressCollection?: boolean;
}

/**
 * Checkout session line item
 */
export interface CheckoutLineItem {
  id: string;
  priceId: string;
  quantity: number;
  adjustableQuantity?: {
    enabled: boolean;
    minimum?: number;
    maximum?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Stripe-specific configuration
 */
export interface StripeConfig {
  apiKey: string;
  publishableKey?: string;
  webhookSecret?: string;
  environment: "test" | "live";
  apiVersion?: string; // e.g., '2023-10-16'
  maxNetworkRetries?: number;
  timeout?: number; // milliseconds
  appInfo?: {
    name: string;
    version?: string;
    url?: string;
  };
}

/**
 * PayPal-specific configuration
 */
export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "live";
  webhookId?: string;
  returnUrl?: string;
  cancelUrl?: string;
  requestTimeout?: number; // milliseconds
  partnerId?: string;
  partnerAttributionId?: string;
}

/**
 * Unified payment webhook event
 */
export interface WitylogixPaymentEvent {
  id: string;
  timestamp: Date;
  provider: "stripe" | "paypal";
  externalEventId?: string; // Provider-specific event ID
  type:
    | "payment.completed"
    | "payment.failed"
    | "refund.completed"
    | "refund.failed"
    | "subscription.created"
    | "subscription.updated"
    | "subscription.canceled"
    | "subscription.paused"
    | "subscription.resumed"
    | "subscription.ended"
    | "invoice.created"
    | "invoice.paid"
    | "invoice.payment_failed"
    | "invoice.voided"
    | "invoice.marked_uncollectible"
    | "dispute.opened"
    | "dispute.closed"
    | "chargeback.created"
    | "checkout.completed";
  resourceType:
    | "payment_intent"
    | "subscription"
    | "invoice"
    | "refund"
    | "dispute"
    | "checkout_session";
  resourceId: string;
  data: {
    paymentIntent?: PaymentIntent;
    subscription?: Subscription;
    invoice?: Invoice;
    refund?: Refund;
    dispute?: Dispute;
    checkoutSession?: CheckoutSession;
  };
  rawEvent?: Record<string, any>; // Original provider event
  verified: boolean;
  idempotencyKey?: string;
}

/**
 * Payment webhook payload wrapper
 */
export interface PaymentWebhookPayload {
  provider: "stripe" | "paypal";
  body: string | Record<string, any>;
  signature?: string;
  headers?: Record<string, string>;
  timestamp?: string;
}

/**
 * Error types for payment operations
 */
export interface PaymentError extends Error {
  code: string;
  statusCode?: number;
  provider: "stripe" | "paypal";
  retryable: boolean;
  originalError?: Error;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limitRequests: number;
  limitPeriod: number; // seconds
  remainingRequests: number;
  resetAt: Date;
}

/**
 * Currency conversion details
 */
export interface CurrencyConversion {
  from: string;
  to: string;
  rate: number;
  amount: number; // In smallest unit (cents/pence)
  convertedAmount: number; // In smallest unit
  timestamp: Date;
}
