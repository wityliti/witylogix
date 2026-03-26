/**
 * Event Bus Module — Type Definitions
 *
 * Defines event types, schemas, and interfaces for the event-driven architecture.
 * Supports domain events, event handlers, subscriptions, and filtering.
 */

// ──────────────────────────────────────────────────────────────────────────
// BASE EVENT INTERFACE
// ──────────────────────────────────────────────────────────────────────────

/**
 * Base event structure
 * All domain events must extend or conform to this interface
 */
export interface BaseEvent {
  /** Unique event ID (UUID or snowflake ID) */
  id: string;

  /** Event type (e.g., "order.created", "shipment.updated") */
  type: string;

  /** Service/domain that emitted the event */
  source: string;

  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Correlation ID for tracing related events across services */
  correlationId: string;

  /** Additional metadata about the event */
  metadata?: Record<string, any>;

  /** Event payload - domain-specific data */
  data: Record<string, any>;

  /** Schema version for event versioning/evolution */
  schemaVersion?: number;

  /** Optional trace ID for distributed tracing */
  traceId?: string;

  /** Optional parent event ID for causality tracking */
  parentEventId?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// DOMAIN EVENT TYPES
// ──────────────────────────────────────────────────────────────────────────

/**
 * Order domain events
 */
export interface OrderCreatedEvent extends BaseEvent {
  type: 'order.created';
  data: {
    orderId: string;
    shopId: string;
    customerId: string;
    totalAmount: number;
    currency: string;
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      price: number;
    }>;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    createdAt: string;
  };
}

export interface OrderUpdatedEvent extends BaseEvent {
  type: 'order.updated';
  data: {
    orderId: string;
    shopId: string;
    changes: Record<string, any>;
    status?: string;
    updatedAt: string;
  };
}

/**
 * Shipment domain events
 */
export interface ShipmentCreatedEvent extends BaseEvent {
  type: 'shipment.created';
  data: {
    shipmentId: string;
    orderId: string;
    shopId: string;
    trackingNumber: string;
    carrier: string;
    weight: number;
    dimensions?: {
      length: number;
      width: number;
      height: number;
    };
    createdAt: string;
  };
}

export interface ShipmentStatusChangedEvent extends BaseEvent {
  type: 'shipment.status_changed';
  data: {
    shipmentId: string;
    orderId: string;
    previousStatus: string;
    newStatus: string;
    reason?: string;
    changedAt: string;
  };
}

/**
 * Driver domain events
 */
export interface DriverAssignedEvent extends BaseEvent {
  type: 'driver.assigned';
  data: {
    shipmentId: string;
    driverId: string;
    driverName: string;
    driverPhone?: string;
    driverVehicle?: string;
    estimatedPickupTime?: string;
    assignedAt: string;
  };
}

export interface DriverLocationUpdatedEvent extends BaseEvent {
  type: 'driver.location_updated';
  data: {
    driverId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    shipmentId?: string;
    updatedAt: string;
  };
}

/**
 * Delivery domain events
 */
export interface DeliveryCompletedEvent extends BaseEvent {
  type: 'delivery.completed';
  data: {
    shipmentId: string;
    orderId: string;
    driverId: string;
    deliveryProof?: {
      signature?: string;
      photo?: string;
      notes?: string;
    };
    completedAt: string;
  };
}

export interface ETAUpdatedEvent extends BaseEvent {
  type: 'eta.updated';
  data: {
    shipmentId: string;
    previousEta?: string;
    newEta: string;
    reason?: string;
    confidence?: number; // 0-100 percentage
    updatedAt: string;
  };
}

/**
 * Webhook domain events
 */
export interface WebhookDeliveredEvent extends BaseEvent {
  type: 'webhook.delivered';
  data: {
    webhookId: string;
    shopId: string;
    endpoint: string;
    event: string;
    statusCode: number;
    responseTime: number;
    retryAttempt?: number;
    deliveredAt: string;
  };
}

/**
 * Workflow domain events
 */
export interface WorkflowTriggeredEvent extends BaseEvent {
  type: 'workflow.triggered';
  data: {
    workflowId: string;
    workflowName: string;
    triggeredBy: string; // event type that triggered this
    entityId: string; // e.g., orderId, shipmentId
    entityType: string; // e.g., 'order', 'shipment'
    workflowData?: Record<string, any>;
    triggeredAt: string;
  };
}

/**
 * Union type of all domain events
 */
export type DomainEvent =
  | OrderCreatedEvent
  | OrderUpdatedEvent
  | ShipmentCreatedEvent
  | ShipmentStatusChangedEvent
  | DriverAssignedEvent
  | DriverLocationUpdatedEvent
  | DeliveryCompletedEvent
  | ETAUpdatedEvent
  | WebhookDeliveredEvent
  | WorkflowTriggeredEvent
  | BaseEvent;

// ──────────────────────────────────────────────────────────────────────────
// EVENT HANDLER INTERFACE
// ──────────────────────────────────────────────────────────────────────────

/**
 * Handler function that processes an event
 * Must return a promise
 */
export type EventHandler = (event: BaseEvent) => Promise<void>;

/**
 * Metadata about a subscription
 */
export interface EventSubscription {
  /** Unique subscription ID */
  id: string;

  /** Event pattern to match (e.g., "order.*", "shipment.created") */
  pattern: string;

  /** Handler function */
  handler: EventHandler;

  /** Max retries for failed events (default: 3) */
  maxRetries?: number;

  /** Retry backoff in milliseconds (default: 1000) */
  retryBackoff?: number;

  /** Consumer group name for distributed processing */
  consumerGroup?: string;

  /** Subscription created timestamp */
  createdAt: Date;

  /** Whether subscription is active */
  active: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// EVENT FILTERING
// ──────────────────────────────────────────────────────────────────────────

/**
 * Filter options for event queries
 */
export interface EventFilter {
  /** Event type(s) to match (supports wildcards: "order.*") */
  type?: string | string[];

  /** Source service to filter by */
  source?: string;

  /** Correlation ID to trace related events */
  correlationId?: string;

  /** Start timestamp (inclusive) */
  startTime?: Date;

  /** End timestamp (inclusive) */
  endTime?: Date;

  /** Metadata key-value pairs to match */
  metadata?: Record<string, any>;

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

// ──────────────────────────────────────────────────────────────────────────
// EVENT STORE INTERFACE
// ──────────────────────────────────────────────────────────────────────────

/**
 * Options for event store queries
 */
export interface EventStoreQueryOptions {
  /** Filter criteria */
  filter: EventFilter;

  /** Sort order ('asc' or 'desc') */
  sortOrder?: 'asc' | 'desc';

  /** Whether to include archived events */
  includeArchived?: boolean;
}

/**
 * Result from event store query
 */
export interface EventStoreQueryResult {
  /** Matched events */
  events: BaseEvent[];

  /** Total count of matching events */
  total: number;

  /** Cursor for pagination */
  cursor?: string;

  /** Whether more results are available */
  hasMore: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// DEAD LETTER QUEUE
// ──────────────────────────────────────────────────────────────────────────

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry {
  /** Unique DLQ entry ID */
  id: string;

  /** The failed event */
  event: BaseEvent;

  /** Error that caused the failure */
  error: {
    message: string;
    code: string;
    stack?: string;
  };

  /** Number of retry attempts */
  retryCount: number;

  /** Last error timestamp */
  lastErrorAt: Date;

  /** First occurrence timestamp */
  createdAt: Date;

  /** DLQ status */
  status: 'pending' | 'resolved' | 'ignored';

  /** Additional context */
  context?: Record<string, any>;
}

/**
 * DLQ statistics
 */
export interface DeadLetterStats {
  /** Total entries in DLQ */
  total: number;

  /** Pending entries waiting for resolution */
  pending: number;

  /** Resolved entries */
  resolved: number;

  /** Ignored entries */
  ignored: number;

  /** Oldest pending entry timestamp */
  oldestPending?: Date;

  /** Most recent entry timestamp */
  latestAt?: Date;
}

// ──────────────────────────────────────────────────────────────────────────
// REDIS STREAM ADAPTER INTERFACE
// ──────────────────────────────────────────────────────────────────────────

/**
 * Configuration for Redis Stream adapter
 */
export interface RedisStreamConfig {
  /** Redis client instance */
  redis: any;

  /** Stream name prefix (will be used as: {prefix}:{eventType}) */
  streamPrefix: string;

  /** Consumer group name */
  consumerGroup: string;

  /** Consumer name for this instance */
  consumerName: string;

  /** Max events to read per batch */
  batchSize?: number;

  /** Max length of stream (automatic trimming) */
  maxStreamLength?: number;

  /** Block timeout in milliseconds for XREAD */
  blockTimeout?: number;

  /** Claim pending messages older than this (milliseconds) */
  claimTimeout?: number;
}

/**
 * Message processed by Redis Streams
 */
export interface StreamMessage {
  /** Message ID in stream (e.g., "1526569495631-0") */
  id: string;

  /** Message data as array of [key, value, key, value, ...] */
  data: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// EVENT BUS CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────

/**
 * Event bus configuration
 */
export interface EventBusConfig {
  /** Redis client instance (optional for in-memory mode) */
  redis?: any;

  /** Redis stream config (if using Redis persistence) */
  streamConfig?: RedisStreamConfig;

  /** Enable in-memory fallback when Redis is unavailable */
  enableFallback?: boolean;

  /** Max in-memory events to store (default: 1000) */
  maxInMemoryEvents?: number;

  /** Default correlation ID generator */
  correlationIdGenerator?: () => string;

  /** Source identifier for this service */
  source?: string;

  /** Enable event store persistence */
  enableEventStore?: boolean;

  /** Event store retention (days) */
  eventStoreRetentionDays?: number;
}

// ──────────────────────────────────────────────────────────────────────────
// ERRORS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Event bus error
 */
export class EventBusError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'EventBusError';
  }
}

/**
 * Event serialization error
 */
export class EventSerializationError extends EventBusError {
  constructor(message: string) {
    super('EVENT_SERIALIZATION_ERROR', message, 400);
    this.name = 'EventSerializationError';
  }
}

/**
 * Event handler error
 */
export class EventHandlerError extends EventBusError {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super('EVENT_HANDLER_ERROR', message, 500);
    this.name = 'EventHandlerError';
  }
}

/**
 * Redis stream error
 */
export class RedisStreamError extends EventBusError {
  constructor(message: string) {
    super('REDIS_STREAM_ERROR', message, 500);
    this.name = 'RedisStreamError';
  }
}

// ──────────────────────────────────────────────────────────────────────────
// UTILITY TYPES
// ──────────────────────────────────────────────────────────────────────────

/**
 * Wildcard matcher for event patterns
 * Supports: "order.*", "*.created", "*"
 */
export interface PatternMatcher {
  /** Check if event type matches pattern */
  matches(eventType: string): boolean;

  /** Get pattern string */
  getPattern(): string;
}

/**
 * Published event metadata
 */
export interface PublishedEvent {
  /** Event that was published */
  event: BaseEvent;

  /** Stream message ID (if persisted to Redis) */
  messageId?: string;

  /** Number of subscribers notified */
  subscriberCount: number;

  /** Publishing timestamp */
  publishedAt: Date;
}
