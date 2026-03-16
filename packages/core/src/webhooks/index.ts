/**
 * Webhook Delivery System
 * Barrel exports for all webhook-related modules
 */

// Types
export {
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
} from "./types";

// Event Bridge Types
export {
  EventWebhookBridgeConfig,
  EventWebhookMapping,
  BridgeMetrics,
  WebhookPayloadTransformation,
} from "./event-bridge.types";

// Signing and verification
export {
  signPayload,
  verifySignature,
  generateSecret,
  WEBHOOK_HEADERS,
} from "./signer";

// Webhook Manager
export {
  WebhookManager,
  getWebhookManager,
} from "./webhook-manager";

// Delivery Service
export {
  WebhookDeliveryService,
  getWebhookDeliveryService,
  deliverWebhook,
  scheduleRetry,
  getRetryDelay,
  shouldRetry,
  getMaxRetryAttempts,
} from "./webhook-delivery";

// Event dispatcher (legacy)
export {
  dispatchEvent,
  processQueue,
  getDeliveryQueue,
  getDeadLetterQueue,
  registerSubscription,
  unregisterSubscription,
  getStats,
} from "./dispatcher";

// Webhook Processor
export {
  WebhookProcessor,
  getWebhookProcessor,
  initializeWebhookProcessor,
} from "./webhook-processor";

// Event Emitter
export {
  WebhookEventEmitter,
  getWebhookEventEmitter,
} from "./event-emitter";

// Event Bridge
export {
  EventWebhookBridge,
} from "./event-bridge";

// Webhook Reliability System - Dispatcher
export {
  WebhookDispatcher,
} from "./webhook-dispatcher";
export type {
  WebhookRequestMetadata,
  DispatchResponse,
  DispatchOptions,
} from "./webhook-dispatcher";

// Webhook Reliability System - Retry Manager
export {
  RetryManager,
} from "./retry-manager";
export type {
  RetryState,
  RetryConfig,
} from "./retry-manager";

// Webhook Reliability System - Dead Letter Queue
export {
  DeadLetterQueue,
} from "./dead-letter-queue";
export type {
  DeadLetterEntry,
  DLQStatistics,
  FailureReason,
} from "./dead-letter-queue";

// Webhook Reliability System - Signature Verifier
export {
  SignatureVerifier,
} from "./signature-verifier";
export type {
  SignatureAlgorithm,
  VerificationOptions,
} from "./signature-verifier";

// Webhook Reliability System - Idempotency Manager
export {
  IdempotencyManager,
  InMemoryIdempotencyStore,
} from "./idempotency-manager";
export type {
  CachedResponse,
  IdempotencyStore,
} from "./idempotency-manager";

// Webhook Reliability System - Delivery Log
export {
  DeliveryLog,
} from "./delivery-log";
export type {
  DeliveryLogEntry,
  DeliveryStatistics,
  SearchCriteria,
} from "./delivery-log";

// Webhook Reliability System - Registry
export {
  WebhookRegistry,
} from "./webhook-registry";
export type {
  RegisteredEndpoint,
  SecretRotation,
} from "./webhook-registry";
