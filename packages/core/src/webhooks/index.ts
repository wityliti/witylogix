/**
 * Webhook Delivery System
 * Barrel exports for all webhook-related modules
 */

// Types
export type {
  WebhookPayload,
  WebhookEventType,
  WebhookSubscription,
  WebhookDeliveryResult,
  WebhookDeliveryAttempt,
  WebhookEndpoint,
  WebhookEndpointConfig,
  WebhookDelivery,
  WebhookEvent,
  DeliveryStatus,
  DeliveryAttempt,
  RetryPolicy,
  CircuitBreakerState,
  WebhookSignature,
} from "./types.js";

// Event Bridge Types
export type {
  EventWebhookBridgeConfig,
  EventWebhookMapping,
  BridgeMetrics,
  WebhookPayloadTransformation,
} from "./event-bridge.types.js";

// Signing and verification
export {
  signPayload,
  verifySignature,
  generateSecret,
  WEBHOOK_HEADERS,
} from "./signer.js";

// Webhook Manager
export {
  WebhookManager,
  getWebhookManager,
} from "./webhook-manager.js";

// Delivery Service
export {
  WebhookDeliveryService,
  getWebhookDeliveryService,
  deliverWebhook,
  scheduleRetry,
  getRetryDelay,
  shouldRetry,
  getMaxRetryAttempts,
} from "./webhook-delivery.js";

// Event dispatcher (legacy)
export {
  dispatchEvent,
  processQueue,
  getDeliveryQueue,
  getDeadLetterQueue,
  registerSubscription,
  unregisterSubscription,
  getStats,
} from "./dispatcher.js";

// Webhook Processor
export {
  WebhookProcessor,
  getWebhookProcessor,
  initializeWebhookProcessor,
} from "./webhook-processor.js";

// Event Emitter
export {
  WebhookEventEmitter,
  getWebhookEventEmitter,
} from "./event-emitter.js";

// Event Bridge
export {
  EventWebhookBridge,
} from "./event-bridge.js";

// Webhook Reliability System - Dispatcher
export {
  WebhookDispatcher,
} from "./webhook-dispatcher.js";
export type {
  WebhookRequestMetadata,
  DispatchResponse,
  DispatchOptions,
} from "./webhook-dispatcher.js";

// Webhook Reliability System - Retry Manager
export {
  RetryManager,
} from "./retry-manager.js";
export type {
  RetryState,
  RetryConfig,
} from "./retry-manager.js";

// Webhook Reliability System - Dead Letter Queue
export {
  DeadLetterQueue,
} from "./dead-letter-queue.js";
export type {
  DeadLetterEntry,
  DLQStatistics,
  FailureReason,
} from "./dead-letter-queue.js";

// Webhook Reliability System - Signature Verifier
export {
  SignatureVerifier,
} from "./signature-verifier.js";
export type {
  SignatureAlgorithm,
  VerificationOptions,
} from "./signature-verifier.js";

// Webhook Reliability System - Idempotency Manager
export {
  IdempotencyManager,
  InMemoryIdempotencyStore,
} from "./idempotency-manager.js";
export type {
  CachedResponse,
  IdempotencyStore,
} from "./idempotency-manager.js";

// Webhook Reliability System - Delivery Log
export {
  DeliveryLog,
} from "./delivery-log.js";
export type {
  DeliveryLogEntry,
  DeliveryStatistics,
  SearchCriteria,
} from "./delivery-log.js";

// Webhook Reliability System - Registry
export {
  WebhookRegistry,
} from "./webhook-registry.js";
export type {
  RegisteredEndpoint,
  SecretRotation,
} from "./webhook-registry.js";
