/**
 * Type definitions for the Witylogix Event Bus system.
 *
 * Provides comprehensive typing for event-driven architecture with Redis Streams backend,
 * including typed event handlers, stream adapters, and configuration structures.
 */

// ───────────────────────────────────────────────────────────────────
// EVENT METADATA & ENVELOPE
// ───────────────────────────────────────────────────────────────────

/**
 * Metadata attached to every event for tracing, correlation, and routing.
 */
export interface EventMetadata {
  /** Unique event identifier (UUID v4). */
  id: string;

  /** Event type, e.g., "order.created", "delivery.completed". */
  type: string;

  /** Source service/module that emitted the event. */
  source: string;

  /** ISO 8601 timestamp when event was created. */
  timestamp: string;

  /** Tenant/shop ID for multi-tenancy. */
  tenantId: string;

  /** Correlation ID for tracing related events across workflow steps. */
  correlationId: string;

  /** Event schema version (for backward compatibility). */
  version: number;

  /** Optional user ID who triggered the event. */
  userId?: string;

  /** Optional request ID from HTTP request that triggered the event. */
  requestId?: string;

  /** Custom tags for filtering and categorization. */
  tags?: Record<string, string>;
}

/**
 * Envelope wrapping event data with metadata.
 * Used for serialization to Redis Streams.
 */
export interface EventEnvelope<T = unknown> {
  metadata: EventMetadata;
  data: T;
}

// ───────────────────────────────────────────────────────────────────
// EVENT HANDLER & SUBSCRIPTION
// ───────────────────────────────────────────────────────────────────

/**
 * Function signature for event handlers.
 * Handlers receive the full event envelope and must return successfully or throw.
 */
export type EventHandler<T = unknown> = (
  envelope: EventEnvelope<T>,
) => Promise<void>;

/**
 * Subscription configuration for a single handler.
 */
export interface EventSubscription {
  /** Unique identifier for this subscription. */
  id: string;

  /** Event type pattern: exact match or wildcard (e.g., "order.*"). */
  pattern: string;

  /** Consumer group name (for Redis Streams consumer groups). */
  consumerGroup: string;

  /** The handler function. */
  handler: EventHandler;

  /** Should the handler be called for past events when subscribing? */
  replay?: boolean;

  /** Optional tags for filtering subscriptions. */
  tags?: string[];
}

// ───────────────────────────────────────────────────────────────────
// STREAM ADAPTER INTERFACE
// ───────────────────────────────────────────────────────────────────

/**
 * Interface for pluggable stream adapters (Redis, In-Memory, etc.).
 * Abstracts away the underlying pub/sub mechanism.
 */
export interface StreamAdapter {
  /**
   * Connect to the stream backend.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the stream backend.
   */
  disconnect(): Promise<void>;

  /**
   * Publish an event envelope to a stream.
   *
   * @param streamKey The Redis stream key (e.g., "events:orders")
   * @param envelope The event envelope with metadata
   * @returns The message ID assigned by the backend
   */
  publish(streamKey: string, envelope: EventEnvelope): Promise<string>;

  /**
   * Create or ensure a consumer group exists.
   *
   * @param streamKey The Redis stream key
   * @param groupName The consumer group name
   * @param startId Where to start consuming from (e.g., "0-0", "$" for new messages, or specific ID)
   */
  createConsumerGroup(
    streamKey: string,
    groupName: string,
    startId: string,
  ): Promise<void>;

  /**
   * Read messages from a consumer group.
   *
   * @param streamKey The Redis stream key
   * @param groupName The consumer group name
   * @param consumerId Unique consumer ID within the group
   * @param count Number of messages to read
   * @param timeoutMs Block timeout in milliseconds
   * @returns Array of messages with IDs and data
   */
  readGroup(
    streamKey: string,
    groupName: string,
    consumerId: string,
    count: number,
    timeoutMs: number,
  ): Promise<Array<{ id: string; data: Record<string, string> }>>;

  /**
   * Acknowledge a message as processed.
   *
   * @param streamKey The Redis stream key
   * @param groupName The consumer group name
   * @param messageId The message ID to acknowledge
   */
  acknowledge(
    streamKey: string,
    groupName: string,
    messageId: string,
  ): Promise<void>;

  /**
   * Get pending messages for a consumer group (dead letter detection).
   *
   * @param streamKey The Redis stream key
   * @param groupName The consumer group name
   * @param count Number of pending messages to retrieve
   * @returns Pending message IDs and metadata
   */
  getPendingMessages(
    streamKey: string,
    groupName: string,
    count: number,
  ): Promise<Array<{ id: string; consumer: string; ageMs: number }>>;

  /**
   * Reclaim pending messages (dead letter retry).
   *
   * @param streamKey The Redis stream key
   * @param groupName The consumer group name
   * @param messageIds Message IDs to reclaim
   * @param consumerId The consumer to assign to
   */
  reclaimMessages(
    streamKey: string,
    groupName: string,
    messageIds: string[],
    consumerId: string,
  ): Promise<Array<{ id: string; data: Record<string, string> }>>;

  /**
   * Trim the stream to a maximum length (housekeeping).
   *
   * @param streamKey The Redis stream key
   * @param maxLength Maximum number of messages to keep
   */
  trimStream(streamKey: string, maxLength: number): Promise<number>;

  /**
   * Get stream info (message count, first/last IDs, groups).
   */
  getStreamInfo(streamKey: string): Promise<{
    length: number;
    firstId?: string;
    lastId?: string;
    groups: number;
  }>;

  /**
   * Permanently delete a message from the stream.
   */
  deleteMessage(streamKey: string, messageId: string): Promise<void>;
}

// ───────────────────────────────────────────────────────────────────
// RETRY & DEAD LETTER CONFIGURATION
// ───────────────────────────────────────────────────────────────────

/**
 * Retry policy for failed event handlers.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts. */
  maxAttempts: number;

  /** Initial delay in milliseconds. */
  initialDelayMs: number;

  /** Maximum delay in milliseconds. */
  maxDelayMs: number;

  /** Exponential backoff multiplier. */
  backoffMultiplier: number;

  /** Jitter factor (0-1) to prevent thundering herd. */
  jitterFactor?: number;
}

/**
 * Dead letter queue configuration.
 */
export interface DeadLetterConfig {
  /** Enable dead letter queue for failed messages. */
  enabled: boolean;

  /** Stream key for dead letter events. */
  streamKey: string;

  /** Consumer group name for dead letter processing. */
  consumerGroup: string;

  /** Optional handler for dead letter messages. */
  handler?: (envelope: EventEnvelope, error: Error) => Promise<void>;
}

// ───────────────────────────────────────────────────────────────────
// CONSUMER GROUP CONFIGURATION
// ───────────────────────────────────────────────────────────────────

/**
 * Configuration for a consumer group (for horizontal scaling).
 */
export interface ConsumerGroupConfig {
  /** Name of the consumer group. */
  name: string;

  /** Consumer ID within the group (defaults to UUID). */
  consumerId?: string;

  /** Start consuming from this ID (default: "$" for new messages only). */
  startFrom?: string;

  /** Claim pending messages older than this (milliseconds). */
  claimAfterMs?: number;

  /** Number of messages to read per batch. */
  batchSize?: number;

  /** Block timeout for XREADGROUP (milliseconds). */
  blockTimeoutMs?: number;
}

// ───────────────────────────────────────────────────────────────────
// EVENT BUS CONFIGURATION
// ───────────────────────────────────────────────────────────────────

/**
 * Middleware for processing events (logging, metrics, validation).
 */
export interface EventMiddleware {
  /** Called before event is published. */
  beforePublish?(envelope: EventEnvelope): Promise<EventEnvelope | void>;

  /** Called after event is published. */
  afterPublish?(envelope: EventEnvelope, messageId: string): Promise<void>;

  /** Called before handler is invoked. */
  beforeHandle?(envelope: EventEnvelope): Promise<EventEnvelope | void>;

  /** Called after handler succeeds. */
  afterHandle?(envelope: EventEnvelope): Promise<void>;

  /** Called when handler throws. */
  onError?(envelope: EventEnvelope, error: Error): Promise<void>;
}

/**
 * Main event bus configuration.
 */
export interface EventBusConfig {
  /** Name of this event bus instance. */
  name: string;

  /** Stream adapter (Redis, In-Memory, etc.). */
  adapter: StreamAdapter;

  /** Retry policy for failed handlers. */
  retryPolicy?: RetryPolicy;

  /** Dead letter configuration. */
  deadLetter?: DeadLetterConfig;

  /** Consumer group configuration for this instance. */
  consumerGroup?: ConsumerGroupConfig;

  /** Middleware pipeline for cross-cutting concerns. */
  middleware?: EventMiddleware[];

  /** Maximum number of messages to trim streams to (default: 10000). */
  maxStreamLength?: number;

  /** Enable automatic consumer group creation (default: true). */
  autoCreateConsumerGroups?: boolean;

  /** Enable health checks and metrics collection (default: true). */
  enableMetrics?: boolean;
}

// ───────────────────────────────────────────────────────────────────
// DOMAIN EVENTS TYPE MAP
// ───────────────────────────────────────────────────────────────────

/**
 * Master map of all domain events across Witylogix.
 * Used for type-safe emit/subscribe operations.
 *
 * Structure: { "event.type": EventPayload }
 */
export interface WitylogixEvents {
  // ── Order Events ────────────────────────────────────────────
  "order.created": {
    orderId: string;
    shopId: string;
    customerId: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
  };

  "order.confirmed": {
    orderId: string;
    shopId: string;
    confirmedAt: string;
  };

  "order.cancelled": {
    orderId: string;
    shopId: string;
    reason: string;
    cancelledAt: string;
  };

  // ── Delivery Events ─────────────────────────────────────────
  "delivery.started": {
    deliveryId: string;
    orderId: string;
    driverId: string;
    startedAt: string;
  };

  "delivery.completed": {
    deliveryId: string;
    orderId: string;
    driverId: string;
    completedAt: string;
    proofUrl?: string;
  };

  "delivery.failed": {
    deliveryId: string;
    orderId: string;
    driverId: string;
    reason: string;
    failedAt: string;
  };

  // ── Driver Events ───────────────────────────────────────────
  "driver.assigned": {
    driverId: string;
    orderId: string;
    assignedAt: string;
  };

  "driver.unassigned": {
    driverId: string;
    orderId: string;
    reason: string;
    unassignedAt: string;
  };

  "driver.location_updated": {
    driverId: string;
    latitude: number;
    longitude: number;
    heading: number;
    speed: number;
    accuracy: number;
    timestamp: string;
  };

  // ── Workflow Events ─────────────────────────────────────────
  "workflow.started": {
    workflowId: string;
    workflowType: string;
    input: Record<string, unknown>;
    startedAt: string;
  };

  "workflow.completed": {
    workflowId: string;
    workflowType: string;
    output: Record<string, unknown>;
    completedAt: string;
  };

  "workflow.failed": {
    workflowId: string;
    workflowType: string;
    error: {
      message: string;
      code: string;
    };
    failedAt: string;
  };

  "workflow.step_completed": {
    workflowId: string;
    stepName: string;
    stepOutput: Record<string, unknown>;
    completedAt: string;
  };

  // ── Webhook Events ──────────────────────────────────────────
  "webhook.delivered": {
    webhookId: string;
    subscriptionId: string;
    event: string;
    statusCode: number;
    responseTimeMs: number;
    deliveredAt: string;
  };

  "webhook.failed": {
    webhookId: string;
    subscriptionId: string;
    event: string;
    error: string;
    attempt: number;
    maxAttempts: number;
    failedAt: string;
  };

  // ── Billing Events ──────────────────────────────────────────
  "billing.invoice_created": {
    invoiceId: string;
    shopId: string;
    amount: number;
    currency: string;
    dueDate: string;
    createdAt: string;
  };

  "billing.payment_received": {
    invoiceId: string;
    shopId: string;
    amount: number;
    method: string;
    receivedAt: string;
  };
}

/**
 * Event type discriminated union for runtime dispatch.
 */
export type DomainEvent = {
  [K in keyof WitylogixEvents]: {
    type: K;
    data: WitylogixEvents[K];
  };
}[keyof WitylogixEvents];

// ───────────────────────────────────────────────────────────────────
// VALIDATION & SCHEMA REGISTRY
// ───────────────────────────────────────────────────────────────────

/**
 * Runtime validator for event payloads.
 */
export type EventValidator = (data: unknown) => boolean | Promise<boolean>;

/**
 * Schema registry entry for a single event type.
 */
export interface EventSchemaEntry {
  type: string;
  schema: Record<string, unknown>; // JSON Schema or similar
  validator?: EventValidator;
  version: number;
}

/**
 * Event schema registry for validation and documentation.
 */
export interface EventSchemaRegistry {
  register(entry: EventSchemaEntry): void;
  get(type: string, version?: number): EventSchemaEntry | undefined;
  validate(type: string, data: unknown): Promise<boolean>;
  listSchemas(): EventSchemaEntry[];
}

// ───────────────────────────────────────────────────────────────────
// METRICS & MONITORING
// ───────────────────────────────────────────────────────────────────

/**
 * Event bus health and metrics snapshot.
 */
export interface EventBusMetrics {
  /** Timestamp of metrics snapshot. */
  timestamp: string;

  /** Total events published. */
  publishedCount: number;

  /** Total events handled successfully. */
  handledCount: number;

  /** Total handler failures. */
  failedCount: number;

  /** Active subscriptions. */
  activeSubscriptions: number;

  /** Consumer groups being tracked. */
  consumerGroups: {
    name: string;
    streamKey: string;
    consumers: number;
    pendingCount: number;
  }[];

  /** Average latency in milliseconds. */
  averageLatencyMs: number;

  /** P95 latency. */
  p95LatencyMs: number;

  /** P99 latency. */
  p99LatencyMs: number;

  /** Dead letter queue size. */
  deadLetterCount: number;
}

/**
 * Callback for metrics collection.
 */
export type MetricsCollector = (metrics: EventBusMetrics) => Promise<void>;
