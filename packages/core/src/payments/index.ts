/**
 * Payment Processing System
 *
 * Provides complete payment lifecycle management:
 *   - Payment intent creation (authorization)
 *   - Payment capture (settlement)
 *   - Refunds (full and partial)
 *   - COD (Cash on Delivery) collection and reconciliation
 *   - Webhook processing
 *   - Idempotency support to prevent double-charging
 *   - Audit trail and transaction logging
 */

// Types and interfaces
export type {
  PaymentMethodType,
  PaymentMethod,
  PaymentStatus,
  PaymentLifecycle,
  PaymentIntent,
  Transaction,
  RefundRequest,
  CODCollection,
  PaymentGatewayConfig,
  IdempotencyKey,
  PaymentWebhookPayload,
  CreatePaymentIntentRequest,
  CapturePaymentRequest,
  RefundPaymentRequest,
  RecordCODCollectionRequest,
  VerifyCODCollectionRequest,
  ReconcileCODRequest,
} from './types.js';

export { PaymentError, IdempotencyError } from './types.js';

// Payment gateway abstraction and implementations
export { PaymentGateway, CODGateway, createGateway, getGatewayByName } from './gateway.js';

// Payment processor (main orchestrator)
export { PaymentProcessor, createPaymentProcessor } from './processor.js';
