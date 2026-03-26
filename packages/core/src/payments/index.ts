/**
 * Payment Processing System
 *
 * Provides complete payment lifecycle management:
 *   - Payment intent creation (authorization)
 *   - Payment capture (settlement)
 *   - Refunds (full and partial)
 *   - COD (Cash on Delivery) collection and reconciliation
 *   - Multi-gateway routing (Stripe, PayPal, Square, etc.)
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

// Abstract payment gateway base class
export { PaymentGatewayBase } from './payment-gateway.js';

// Payment gateway implementations
export { PayPalGateway } from './paypal-adapter.js';
export { SquareGateway } from './square-adapter.js';
export { PaymentGateway, CODGateway, createGateway, getGatewayByName } from './gateway.js';

// Multi-gateway router
export { MultiGatewayRouter } from './multi-gateway-router.js';
export type {
  GatewayMetadata,
  GatewayRoutingParams,
  RoutingDecision,
} from './multi-gateway-router.js';

// Payment processor (main orchestrator)
export { PaymentProcessor, createPaymentProcessor } from './processor.js';
