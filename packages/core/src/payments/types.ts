/**
 * Payment Processing System — Core types and interfaces
 *
 * Provides:
 *   - Payment method abstractions (credit card, debit card, COD, etc.)
 *   - Payment state machine (pending → authorized → captured → refunded)
 *   - Idempotency support with request keys
 *   - Transaction lifecycle management
 *   - COD (Cash on Delivery) collection tracking
 */

// ─── PAYMENT METHODS ──────────────────────────────────────────────────

export type PaymentMethodType =
  | "credit_card"
  | "debit_card"
  | "card" // Generic card (used by Square, Stripe)
  | "cod" // Cash on Delivery
  | "cash" // Cash payment (non-delivery context)
  | "bank_transfer"
  | "wallet"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "platform_payment" // Generic platform payment (Shopify, WooCommerce, Magento, etc.)
  | "other";

export interface PaymentMethod {
  id: string;
  shopId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  isActive: boolean;
  displayName: string;
  /** Provider-specific gateway identifier */
  gatewayId?: string;
  /** Provider-specific customer/token reference */
  providerRef?: string;
  /** Last 4 digits (for cards) or identifier */
  lastDigits?: string;
  expiryDate?: string; // MM/YY format
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ─── PAYMENT STATUS & LIFECYCLE ──────────────────────────────────────

export type PaymentStatus =
  | "pending" // Initial state, awaiting authorization
  | "authorized" // Authorization successful, ready to capture
  | "captured" // Funds captured/settled
  | "refunded" // Refunded to customer
  | "failed" // Payment failed/declined
  | "cancelled"; // Cancelled by user or system

export type PaymentLifecycle =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded"
  | "cancelled";

// ─── PAYMENT INTENT ──────────────────────────────────────────────────
// Represents a customer's intention to pay (not yet committed)

export interface PaymentIntent {
  id: string;
  shopId: string;
  orderId?: string;
  shipmentId?: string;
  amount: number; // In smallest currency unit (cents)
  currency: string; // e.g., 'USD', 'EUR'
  status: PaymentStatus;
  methodType: PaymentMethodType;
  // Idempotency support
  idempotencyKey: string; // Unique key to prevent double-charging
  clientRequestId?: string; // Client-provided request ID
  // Provider details
  providerName?: string; // 'stripe', 'cod', 'shopify', etc.
  providerIntentId?: string;
  // Metadata
  description?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date; // Intent expiration (e.g., 24 hours)
  capturedAt?: Date;
  failedAt?: Date;
}

// ─── TRANSACTION ──────────────────────────────────────────────────────
// A settled payment with audit trail

export interface Transaction {
  id: string;
  shopId: string;
  orderId?: string;
  shipmentId?: string;
  amount: number; // In smallest currency unit (cents)
  currency: string;
  status: PaymentLifecycle;
  type: "charge" | "refund" | "adjustment" | "cod_collection";
  methodType: PaymentMethodType;
  methodId?: string;
  // Provider reference
  providerName?: string; // 'stripe', 'cod', 'shopify', etc.
  providerTransactionId?: string;
  providerRef?: string;
  // Payment intent reference
  paymentIntentId?: string;
  // For refunds: original transaction reference
  refundOf?: string;
  errorMessage?: string;
  errorCode?: string;
  // Audit trail
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// ─── REFUND REQUEST ────────────────────────────────────────────────────

export interface RefundRequest {
  id: string;
  shopId: string;
  transactionId: string; // Original transaction being refunded
  amount?: number; // Partial refund amount; if null, full refund
  reason:
    | "customer_request"
    | "duplicate_charge"
    | "order_cancelled"
    | "merchant_error"
    | "other";
  description?: string;
  status: "pending" | "processing" | "completed" | "failed";
  providerRefundId?: string;
  errorMessage?: string;
  metadata: Record<string, any>;
  requestedAt: Date;
  completedAt?: Date;
}

// ─── COD (CASH ON DELIVERY) ────────────────────────────────────────────

export interface CODCollection {
  id: string;
  shopId: string;
  orderId?: string;
  shipmentId?: string;
  amount: number; // In smallest currency unit (cents)
  currency: string;
  driverId: string; // Driver who collected the cash
  // Collection status
  status: "pending" | "collected" | "verified" | "reconciled" | "failed";
  collectedAt?: Date;
  verifiedAt?: Date;
  reconciledAt?: Date;
  // Reconciliation details
  depositId?: string; // Bank deposit reference
  depositDate?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ─── PAYMENT GATEWAY CONFIG ────────────────────────────────────────────
// Configuration for external payment providers

export interface PaymentGatewayConfig {
  name: string; // 'stripe', 'paypal', 'square', 'cod'
  isEnabled: boolean;
  isProduction: boolean;
  // Credentials (should be encrypted in storage)
  secretKey?: string;
  publicKey?: string;
  webhookSecret?: string;
  // Provider-specific config
  metadata: Record<string, any>;
  // Supported methods
  supportedMethods: PaymentMethodType[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── IDEMPOTENCY ──────────────────────────────────────────────────────

export interface IdempotencyKey {
  key: string; // Unique request identifier
  shopId: string;
  resultId?: string; // Result of the operation (transactionId, etc.)
  status: "pending" | "completed" | "failed";
  result?: Record<string, any>;
  error?: {
    code: string;
    message: string;
  };
  expiresAt: Date; // Idempotency key expiration (24 hours)
  createdAt: Date;
}

// ─── WEBHOOK PAYLOAD ──────────────────────────────────────────────────

export interface PaymentWebhookPayload {
  type:
    | "payment.authorized"
    | "payment.captured"
    | "payment.failed"
    | "refund.completed"
    | "refund.failed";
  provider: string;
  providerEventId: string;
  timestamp: Date;
  data: {
    transactionId: string;
    paymentIntentId?: string;
    amount: number;
    currency: string;
    status: PaymentLifecycle;
    providerTransactionId?: string;
    metadata?: Record<string, any>;
  };
  signature?: string; // For HMAC verification
}

// ─── PAYMENT ERRORS ────────────────────────────────────────────────────

export class PaymentError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export class IdempotencyError extends Error {
  constructor(
    message: string,
    public existingResult?: any,
  ) {
    super(message);
    this.name = "IdempotencyError";
  }
}

// ─── REQUEST/RESPONSE TYPES ────────────────────────────────────────────

export interface CreatePaymentIntentRequest {
  shopId: string;
  orderId?: string;
  shipmentId?: string;
  amount: number; // In smallest currency unit (cents)
  currency: string;
  methodType: PaymentMethodType;
  methodId?: string; // If not new method
  description?: string;
  metadata?: Record<string, any>;
  idempotencyKey: string; // Required for idempotency
}

export interface CapturePaymentRequest {
  shopId: string;
  paymentIntentId: string;
  idempotencyKey?: string; // Optional retry key
}

export interface RefundPaymentRequest {
  shopId: string;
  transactionId: string;
  amount?: number; // Partial refund in cents
  reason:
    | "customer_request"
    | "duplicate_charge"
    | "order_cancelled"
    | "merchant_error"
    | "other";
  description?: string;
  metadata?: Record<string, any>;
  idempotencyKey: string;
}

export interface RecordCODCollectionRequest {
  shopId: string;
  shipmentId: string;
  driverId: string;
  amount: number; // In smallest currency unit (cents)
  currency: string;
  metadata?: Record<string, any>;
  idempotencyKey: string;
}

export interface VerifyCODCollectionRequest {
  shopId: string;
  codCollectionId: string;
}

export interface ReconcileCODRequest {
  shopId: string;
  driverId: string;
  depositDate: Date;
  totalAmount: number; // In cents
  codCollectionIds: string[];
  depositId?: string;
  metadata?: Record<string, any>;
}
