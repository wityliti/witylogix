/**
 * Queue module — public API exports for message processing.
 *
 * Exports:
 *   • Types: Job definitions, consumer configuration, metrics
 *   • Base Consumer: Abstract class for implementing handlers
 *   • Error Classes: Domain-specific exceptions
 *   • Consumer Implementations: Order, product, driver, scheduling, etc.
 */

// ─── Types ──────────────────────────────────────────────────────

export type {
  OrderWebhookJob,
  ProductWebhookJob,
  InventoryWebhookJob,
  DriverTrackingJob,
  EventSchedulerJob,
  AnalyticsEventJob,
  NotificationJob,
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  QueueMetrics,
  ShutdownOptions,
  ConsumerConfig,
} from "./types.js";

// ─── Base Consumer & Error Classes ──────────────────────────────

export {
  QueueConsumer,
  QueueConsumerError,
  QueueValidationError,
  QueueTransientError,
  QueuePermanentError,
} from "./consumer.js";

// ─── Consumer Implementations ────────────────────────────────────

export { OrderWebhookConsumer } from "./consumers/order-webhook.js";
export { ProductWebhookConsumer } from "./consumers/product-webhook.js";
export { DriverTrackingConsumer } from "./consumers/driver-tracking.js";
export { EventSchedulerConsumer } from "./consumers/event-scheduler.js";

export type { GeofenceViolationType } from "./consumers/driver-tracking.js";
export type { ScheduledActionType } from "./consumers/event-scheduler.js";
