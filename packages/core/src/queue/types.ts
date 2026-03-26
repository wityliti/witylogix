/**
 * Queue job type definitions for Witylogix message processing.
 *
 * Each job type represents a distinct business process with its own payload structure.
 * Jobs flow through BullMQ with retry logic, dead letter queues, and metrics tracking.
 */

/**
 * External order webhook payload — triggers order sync, fulfillment processing.
 * Default source is SHOPIFY, but supports any e-commerce platform.
 */
export interface OrderWebhookJob {
  shopId: string;
  externalOrderId: string;
  source?: string; // Defaults to "SHOPIFY"
  payload: {
    id: string;
    created_at: string;
    email: string;
    currency: string;
    total_price: string;
    subtotal_price: string;
    total_tax: string;
    total_weight: number;
    financial_status: "authorized" | "pending" | "paid" | "refunded" | "voided";
    fulfillment_status: "fulfilled" | "partial" | "unshipped" | "unfinished" | "scheduled" | null;
    line_items: Array<{
      id: string;
      product_id: string;
      variant_id: string;
      title: string;
      quantity: number;
      price: string;
      sku: string;
    }>;
    shipping_address: {
      first_name: string;
      last_name: string;
      address1: string;
      address2?: string;
      city: string;
      province: string;
      country: string;
      zip: string;
      phone?: string;
    };
  };
}

/**
 * External product data sync webhook — updates product catalog, collections.
 * Default source is SHOPIFY, but supports any e-commerce platform.
 */
export interface ProductWebhookJob {
  shopId: string;
  externalProductId: string;
  source?: string; // Defaults to "SHOPIFY"
  action: "create" | "update" | "delete";
  payload?: {
    id: string;
    title: string;
    vendor: string;
    product_type: string;
    handle: string;
    tags: string[];
    variants: Array<{
      id: string;
      sku: string;
      barcode: string;
      title: string;
      inventory_quantity: number;
      weight: number;
      price: string;
    }>;
    collections?: string[];
  };
}

/**
 * Inventory level change — tracks stock updates across channels.
 */
export interface InventoryWebhookJob {
  shopId: string;
  variantId: string;
  locationId: string;
  payload: {
    inventory_item_id: string;
    inventory_quantity: number;
    sku: string;
    old_quantity: number;
    new_quantity: number;
    updated_at: string;
  };
}

/**
 * Driver GPS location update — real-time tracking for active routes.
 */
export interface DriverTrackingJob {
  driverId: string;
  companyId: string;
  payload: {
    latitude: number;
    longitude: number;
    heading: number;
    speed: number; // km/h
    accuracy: number; // meters
    timestamp: number; // milliseconds
    routeId?: string;
    orderId?: string;
  };
}

/**
 * Scheduled event trigger — cron/timer-based job execution.
 * Examples: send reminder SMS, generate daily report, archive old orders.
 */
export interface EventSchedulerJob {
  companyId: string;
  eventId: string;
  eventType: "notification" | "report" | "cleanup" | "sync" | "custom";
  payload: {
    triggerId: string;
    triggerType: "cron" | "interval" | "at" | "once";
    actionType: string; // e.g., "send_sms", "generate_report", "update_status"
    actionPayload: Record<string, unknown>;
    recurrence?: {
      interval: number; // days, hours, minutes
      unit: "minutes" | "hours" | "days" | "weeks";
      endDate?: string; // ISO datetime
    };
  };
}

/**
 * Analytics event — tracks user actions, conversions, system events.
 */
export interface AnalyticsEventJob {
  companyId: string;
  shopId?: string;
  eventName: string;
  payload: {
    eventId: string;
    timestamp: number;
    userId?: string;
    sessionId?: string;
    context: Record<string, unknown>;
    properties: Record<string, unknown>;
  };
}

/**
 * Notification delivery — multi-channel message send (email, SMS, push, WhatsApp).
 */
export interface NotificationJob {
  shopId: string;
  notificationId: string;
  channel: "email" | "sms" | "whatsapp" | "push";
  payload: {
    templateId: string;
    recipientId: string;
    recipientAddress: string; // email/phone/device token
    templateData: Record<string, unknown>;
    priority: "high" | "normal" | "low";
    ttl?: number; // time-to-live in seconds
    retryPolicy?: {
      maxAttempts: number;
      initialDelayMs: number;
      maxDelayMs: number;
      backoffMultiplier: number;
    };
  };
}

/**
 * Union type for all queue job types.
 * Use discriminated union pattern with job type names.
 */
export type QueueJobPayload =
  | { type: "order_webhook"; data: OrderWebhookJob }
  | { type: "product_webhook"; data: ProductWebhookJob }
  | { type: "inventory_webhook"; data: InventoryWebhookJob }
  | { type: "driver_tracking"; data: DriverTrackingJob }
  | { type: "event_scheduler"; data: EventSchedulerJob }
  | { type: "analytics_event"; data: AnalyticsEventJob }
  | { type: "notification"; data: NotificationJob };

/**
 * Metadata attached to queue job for tracking and routing.
 */
export interface QueueJobMetadata {
  jobId: string;
  type: QueueJobPayload["type"];
  createdAt: number;
  processingStartedAt?: number;
  processingEndedAt?: number;
  attempts: number;
  maxAttempts: number;
  lastError?: {
    message: string;
    code: string;
    timestamp: number;
  };
  tags?: string[];
}

/**
 * Queue consumer processing result.
 */
export interface JobProcessingResult {
  success: boolean;
  jobId: string;
  processingTimeMs: number;
  data?: Record<string, unknown>; // output data if needed
  error?: {
    message: string;
    code: string;
    retriable: boolean;
  };
}

/**
 * Queue metrics snapshot for monitoring.
 */
export interface QueueMetrics {
  queueName: string;
  activeCount: number;
  waitingCount: number;
  completedCount: number;
  failedCount: number;
  delayedCount: number;
  paused: boolean;
  processingRate: number; // jobs/second
  averageProcessingTimeMs: number;
  peakConcurrency: number;
}

/**
 * Graceful shutdown signal options.
 */
export interface ShutdownOptions {
  timeoutMs: number; // maximum time to wait for jobs to complete
  force: boolean; // force shutdown without waiting
  drainQueue: boolean; // complete all waiting jobs before shutdown
}

/**
 * Consumer configuration.
 */
export interface ConsumerConfig {
  queueName: string;
  concurrency: number;
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  lockDuration: number; // milliseconds
  lockRenewTime: number; // milliseconds
  prefix: string; // Redis key prefix
}
