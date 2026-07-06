# ADR-010: Event Bus Architecture — Redis Streams Backend

**Status:** Implemented
**Date:** 2026-03-07
**Deciders:** Arjun (CTO)
**Supersedes:** None
**Relates to:** ADR-009 (Medusa-Inspired Architecture), ADR-008 (Auth Provider Abstraction)

---

## Executive Summary

Witylogix is implementing a **production-grade event bus system** with **Redis Streams backend** to power the Medusa-inspired workflow orchestration architecture (ADR-009). This decision enables:

1. **Distributed event streaming** — Events are ordered, replayed, and processed by multiple consumers
2. **Horizontal scaling** — Redis consumer groups allow multiple workers to process events in parallel
3. **Reliable delivery** — Acknowledgment-based semantics with dead-letter queue handling
4. **Workflow integration** — Workflows emit events as explicit steps; subscribers trigger workflows for side effects
5. **Developer experience** — Strongly-typed event emitters/subscribers with wildcard pattern matching

**Key Design:**

- `TypedEventBus<TEvents>` generic class (500 lines) with Redis Streams backend
- `StreamAdapter` interface enabling pluggable backends (Redis, In-Memory for testing)
- Consumer group management for horizontal scaling
- Retry logic with exponential backoff and jitter
- Dead-letter queue for undeliverable events
- Middleware pipeline for logging, metrics, validation

---

## Context

### Why Events Now?

The Medusa v2-inspired architecture (ADR-009) requires a **decoupling mechanism** between modules:

**Before (Tightly Coupled):**

```typescript
// Service layer calls another service directly
const orderSvc = container.resolve("orderService");
const order = await orderSvc.create(data);

// Notification sent synchronously (blocks order creation)
const notificationSvc = container.resolve("notificationService");
await notificationSvc.send(order);
```

**After (Event-Driven):**

```typescript
// Workflow emits order.created event as an explicit step
const workflow = container.resolve("createOrderWorkflow");
const { order } = await workflow.run({ input: data });
// Event is published to Redis Streams asynchronously

// Separate notification consumer subscribes to order.created
// Can fail independently without blocking order creation
busNotification.subscribe("order.created", async (envelope) => {
  await notificationSvc.send(envelope.data);
});
```

**Benefits:**

1. **Module isolation** — Services don't import each other; communication is event-based
2. **Resilience** — Failed subscribers don't block publishers
3. **Audit trail** — All domain events are persisted for compliance, analytics, replay
4. **Multi-tenancy** — Events carry `tenantId` for proper isolation
5. **Horizontal scaling** — Consumer groups allow multiple workers to handle load

### Workflow Engine Integration

ADR-009 defines workflows as the primary orchestration mechanism:

```typescript
// Example: OrderCreationWorkflow
export const orderCreationWorkflow = createWorkflow(
  "order-creation",
  async (input: { orderId; shopId }) => {
    // Step 1: Create order in database
    const order = await orderStep(input);

    // Step 2: Emit order.created event
    await emitEventStep({
      type: "order.created",
      data: order,
    });

    // Step 3: Optional side effects triggered by event subscribers
    // (validation, notifications, webhooks, routing, etc.)
  },
);
```

The event bus is the **bridge between workflow steps and side-effect subscribers**. This separates:

- **Core business logic** (workflows create/update domain entities)
- **Side effects** (notifications, webhooks, analytics) handled via event subscriptions

### Medusa v2's Proven Pattern

Medusa uses **Event Emitter API** (Node.js stdlib) with **BullMQ** for job distribution. Witylogix adapts this:

- Medusa: `eventBus.emit(type, data)` → BullMQ job
- Witylogix: `eventBus.emit(type, data)` → Redis Stream message

Redis Streams offers superior guarantees for durability and replay.

---

## Decision

**Implement a strongly-typed event bus with Redis Streams backend.**

### Design Rationale

#### 1. Why Redis Streams (Not Kafka, BullMQ Events, RabbitMQ)?

| Aspect                   | Redis Streams                      | Kafka                            | BullMQ Events             | RabbitMQ                          |
| ------------------------ | ---------------------------------- | -------------------------------- | ------------------------- | --------------------------------- |
| **Consistency**          | Strong ordering per stream         | Partition-based                  | Job-queue semantics       | Message-queue semantics           |
| **Replay**               | Built-in (XRANGE, consumer groups) | Native                           | Via job archives          | Via dead-letter                   |
| **Acknowledgment**       | XACK per message                   | Offset-based                     | Jobs tracked by status    | Manual ACK required               |
| **Scaling**              | Consumer groups (simple)           | Partitions (complex rebalancing) | Workers (job-centric)     | Fanout exchanges (loose coupling) |
| **TTL/Retention**        | MAXLEN/MINID (configurable)        | Time-based (log retention)       | Job TTL                   | Indefinite                        |
| **Operational Overhead** | Low (Redis only)                   | High (cluster, ZK)               | Medium (Redis + BullMQ)   | Medium (RabbitMQ broker)          |
| **Delivery Guarantees**  | At-least-once (XACK)               | At-least-once (offset commit)    | At-least-once (job retry) | At-least-once (requeue)           |

**Decision Rationale:**

- **Strong ordering per event type** — Delivery.completed must be processed after delivery.started
- **Consumer groups built-in** — Horizontal scaling without partition rebalancing complexity
- **Low operational overhead** — Reuses existing Redis infrastructure
- **Replay capability** — Critical for audit, analytics, and disaster recovery
- **Simple acknowledgment model** — Per-message ACK (not group offset)

BullMQ events would require wrapping job semantics around events (impedance mismatch). Kafka adds operational complexity for our scale. RabbitMQ is fine but less ergonomic for ordered streams.

#### 2. Generic Typing for DX

```typescript
const bus = new TypedEventBus<WitylogixEvents>(config);

// Type-safe emit
await bus.emit("order.created", {
  orderId: "order_123",
  shopId: "shop_456",
  // ✅ TypeScript error: customerId required
  // ❌ customerId: undefined,
});

// Type-safe subscribe
bus.subscribe("order.created", async (envelope) => {
  // ✅ envelope.data.customerId is string
  const customerId = envelope.data.customerId;
});
```

Strongly-typed events prevent serialization bugs and improve IDE autocomplete.

#### 3. Pluggable Adapter Pattern

```typescript
interface StreamAdapter {
  publish(streamKey, envelope): Promise<string>;
  readGroup(
    streamKey,
    groupName,
    consumerId,
    count,
    timeoutMs,
  ): Promise<Message[]>;
  acknowledge(streamKey, groupName, messageId): Promise<void>;
  // + more methods
}
```

Enables:

- **Redis Streams** for production
- **In-Memory** for unit tests (no Redis required)
- **Future backends** (Kafka, DynamoDB streams) without changing application code

#### 4. Wildcard Subscriptions

```typescript
// Subscribe to all order events
bus.subscribe("order.*", async (envelope) => {
  analytics.track(envelope.type, envelope.data);
});

// Subscribe to all .completed events
bus.subscribe("*.completed", async (envelope) => {
  metrics.recordSuccess(envelope.type);
});
```

Enables:

- Bulk handlers (analytics, logging)
- Cross-cutting concerns (metrics, tracing)
- Loose coupling between event emitters and subscribers

#### 5. Middleware Pipeline

```typescript
const bus = new TypedEventBus({
  middleware: [
    {
      beforePublish: async (envelope) => {
        // Validate event schema
        await schema.validate(envelope.type, envelope.data);
        return envelope;
      },
      afterPublish: async (envelope, messageId) => {
        // Log published events
        logger.info(`Event published: ${envelope.type}`, { messageId });
      },
      onError: async (envelope, error) => {
        // Alert on handler failures
        await alerting.notify(
          `Handler failed for ${envelope.type}: ${error.message}`,
        );
      },
    },
  ],
});
```

Separates business logic from cross-cutting concerns (logging, metrics, validation).

---

## Implementation

### Core Classes (500 lines)

**`TypedEventBus<TEvents>`** — Main event bus

```typescript
class TypedEventBus<TEvents> {
  async emit<K extends keyof TEvents>(
    type: K,
    data: TEvents[K],
    metadata?: Partial<EventMetadata>,
  ): Promise<void>;

  async subscribe<K extends keyof TEvents>(
    pattern: K | string,
    handler: EventHandler<TEvents[K]>,
    options?: SubscribeOptions,
  ): Promise<string>;

  async startConsuming(): Promise<void>;
  async shutdown(timeoutMs): Promise<void>;
  async getMetrics(): Promise<EventBusMetrics>;
}
```

**`RedisStreamAdapter`** (350 lines) — Redis backend

- XADD for publishing
- XREADGROUP + XACK for consumer groups
- XPENDING + XCLAIM for dead-letter recovery
- XTRIM for housekeeping

**`InMemoryStreamAdapter`** (150 lines) — Testing backend

- Map-based in-memory streams
- Identical interface to Redis adapter
- Useful for unit tests (no Docker required)

### Event Type Map (WitylogixEvents)

```typescript
interface WitylogixEvents {
  "order.created": {
    orderId: string;
    shopId: string;
    customerId: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
  };
  "order.confirmed": {
    /* ... */
  };
  "order.cancelled": {
    /* ... */
  };

  "delivery.started": {
    /* ... */
  };
  "delivery.completed": {
    /* ... */
  };
  "delivery.failed": {
    /* ... */
  };

  "driver.assigned": {
    /* ... */
  };
  "driver.location_updated": {
    /* ... */
  };

  "workflow.started": {
    /* ... */
  };
  "workflow.completed": {
    /* ... */
  };
  "workflow.failed": {
    /* ... */
  };

  "webhook.delivered": {
    /* ... */
  };
  "webhook.failed": {
    /* ... */
  };

  "billing.invoice_created": {
    /* ... */
  };
  "billing.payment_received": {
    /* ... */
  };
}
```

### Event Metadata

All events carry structured metadata:

```typescript
interface EventMetadata {
  id: string; // UUID
  type: string; // e.g., "order.created"
  source: string; // e.g., "order-service"
  timestamp: string; // ISO 8601
  tenantId: string; // For multi-tenancy
  correlationId: string; // For tracing workflows
  version: number; // Schema version
  userId?: string; // Who triggered the event
  requestId?: string; // HTTP request ID
  tags?: Record<string, string>;
}
```

**Benefits:**

- Tracing: correlationId links order.created → workflow steps → notifications
- Compliance: audit trail with timestamps, user IDs
- Multi-tenancy: tenantId ensures data isolation
- Schema evolution: version for backward compatibility

### Configuration Example

```typescript
import Redis from "ioredis";
import {
  TypedEventBus,
  RedisStreamAdapter,
  WitylogixEvents,
} from "@witylogix/core/event-bus";

const redisClient = new Redis({ host: "localhost", port: 6379 });
const adapter = new RedisStreamAdapter(redisClient);

const bus = new TypedEventBus<WitylogixEvents>({
  name: "witylogix-events",
  adapter,
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
  consumerGroup: {
    name: "notification-service",
    consumerId: process.env.WORKER_ID,
    batchSize: 10,
    blockTimeoutMs: 1000,
    claimAfterMs: 60000, // Reclaim pending messages after 1 minute
  },
  deadLetter: {
    enabled: true,
    streamKey: "events:dead-letter",
    consumerGroup: "dead-letter-processor",
  },
  middleware: [loggingMiddleware, metricsMiddleware, validationMiddleware],
  maxStreamLength: 10000,
  enableMetrics: true,
});

await bus.connect();
await bus.subscribe("order.*", handleOrderEvent, {
  consumerGroup: "notification-service",
});
await bus.startConsuming();
```

### Horizontal Scaling Pattern

```typescript
// Worker 1
const bus1 = new TypedEventBus({
  consumerGroup: {
    name: "notification-service", // Same group
    consumerId: "worker-1", // Different ID
  },
});
await bus1.startConsuming();

// Worker 2
const bus2 = new TypedEventBus({
  consumerGroup: {
    name: "notification-service", // Same group
    consumerId: "worker-2", // Different ID
  },
});
await bus2.startConsuming();

// Redis automatically load-balances: each message is processed by ONE worker
// If worker-1 crashes, pending messages are auto-claimed by worker-2
```

---

## Consequences

### Positive

1. **Decoupled Architecture** — Modules communicate via events, not direct imports
2. **Scalability** — Consumer groups handle high-throughput with multiple workers
3. **Reliability** — Dead-letter queue, retries, and acknowledgments ensure delivery
4. **Audit Trail** — All domain events are persisted for compliance and analytics
5. **Replay Capability** — Can replay events to rebuild state or fix bugs
6. **Type Safety** — Strongly-typed emit/subscribe prevents serialization errors
7. **Testing** — In-memory adapter requires no external dependencies for unit tests
8. **Flexibility** — Middleware pipeline for logging, metrics, validation
9. **Multi-Tenancy** — Built-in tenantId for proper data isolation

### Negative

1. **Operational Complexity** — Must monitor Redis consumer group lag
   - Mitigation: Built-in metrics API, alerting middleware
2. **Latency** — Event processing is now async (not synchronous)
   - Mitigation: Acceptable for side effects (notifications, webhooks); workflows remain transactional
3. **Eventual Consistency** — Subscribers may lag behind publishers
   - Mitigation: Document SLA per event type; use `replay: true` for critical data
4. **Dead-Letter Handling** — Requires manual intervention if DLQ fills up
   - Mitigation: Dead-letter processor workflow can auto-retry or alert
5. **Message Size** — Redis Streams stores all data in memory (for that shard)
   - Mitigation: Use MAXLEN trimming; archive old events to S3

### Trade-Offs

1. **Redis Streams vs. Kafka**
   - Streams: Simpler ops, fewer moving parts, good for startup scale
   - Kafka: Better for hypergrid scale, but overkill for Witylogix phase 1

2. **Generic Typing vs. Runtime Flexibility**
   - TypeScript generics add safety but prevent dynamic event types
   - Acceptable: All Witylogix events are known upfront; can extend WitylogixEvents type

3. **At-Least-Once vs. Exactly-Once Semantics**
   - Using at-least-once (can re-process messages)
   - Acceptable: Event handlers should be idempotent; use messageId for deduplication if needed

---

## Rationale

### Why Not BullMQ?

BullMQ is excellent for **job queues** (with retries, backoff, job status). However, its events system is a **wrapper around jobs**, requiring:

- Publishing → BullMQ event (internal)
- Subscribing → BullMQ event handler (resolved from job metadata)

This adds impedance:

```typescript
// BullMQ events
bus.on("order.created", (jobData) => {
  // jobData is a Job object, not a pure event
  console.log(jobData.data); // extra nesting
});

// Redis Streams (direct)
bus.subscribe("order.created", (envelope) => {
  console.log(envelope.data); // direct access
});
```

Additionally, BullMQ's consumer groups are managed implicitly by the library; our adapter approach gives more control.

### Why Not Custom Event Broker?

Building a custom event bus on top of Redis Pub/Sub:

- **Pros:** Minimal code
- **Cons:**
  - Pub/Sub doesn't persist messages (subscribers miss events if offline)
  - No consumer groups (scaling requires custom tracking)
  - No acknowledgments (can't guarantee delivery)

**Streams solve all these problems.**

### Why Not EventEmitter (Node.js stdlib)?

EventEmitter is for **in-process** events. We need:

- **Cross-process** communication (multiple workers)
- **Persistence** (replay, audit)
- **Consumer groups** (load balancing)

---

## Related Decisions

### ADR-009 (Medusa-Inspired Architecture)

ADR-009 defines workflows as the orchestration mechanism. Events are **workflow outputs**, emitted as explicit steps:

```typescript
export const orderCreationWorkflow = createWorkflow(
  "create-delivery-order",
  async (input) => {
    const order = await createOrderStep(input);
    await emitEventStep({
      // ← Event is a workflow step
      type: "order.created",
      data: order,
      source: "order-service",
    });
  },
);
```

This ADR (ADR-010) implements the **infrastructure for event streaming and subscription**.

### ADR-008 (Auth Provider Abstraction)

Not directly related. Auth providers handle authentication; events handle domain logic.

---

## Alternatives Considered

### 1. AWS SQS / SNS

**Pros:**

- Managed service (no ops)
- Integrates with AWS ecosystem

**Cons:**

- Vendor lock-in
- Higher latency (network calls)
- Message ordering requires FIFO queues (limited throughput)
- Cost at scale

**Decision:** Rejected. We control our infrastructure.

### 2. Apache Kafka

**Pros:**

- Designed for streaming
- Exactly-once semantics (with exactly-once producer config)
- Mature ecosystem

**Cons:**

- Operational complexity (cluster, ZooKeeper, rebalancing)
- Overkill for current scale
- Higher learning curve

**Decision:** Rejected for now. If we grow to 10k+ events/sec, revisit.

### 3. RabbitMQ

**Pros:**

- Message queuing veteran
- Flexible routing (exchanges, bindings)
- Good for microservices

**Cons:**

- Pub/Sub model less suitable for ordered event streams
- Consumer group semantics less intuitive
- Requires separate broker

**Decision:** Rejected. Redis Streams is simpler, and we already use Redis.

### 4. Temporal / Cadence Workflow Engine

**Pros:**

- Purpose-built for distributed workflows
- Handles retries, compensation, etc.

**Cons:**

- Overkill for our use case (we have ADR-009 workflows)
- Adds another dependency
- Tight coupling to Temporal

**Decision:** Rejected. ADR-009 workflows + event bus is sufficient.

---

## Migration Plan

### Phase 1: Event Bus Foundation (Sprint 3.0)

- [x] Implement `TypedEventBus` with Redis backend
- [x] Implement `InMemoryStreamAdapter` for testing
- [x] Define `WitylogixEvents` type map
- [x] Add to `packages/core/src/event-bus/`
- [x] Update `package.json` exports

### Phase 2: Workflow Integration (Sprint 3.1)

- Emit events from order creation workflow
- Subscribe notification service to `order.created`
- Test end-to-end flow

### Phase 3: Full Migration (Sprint 3.2+)

- Emit events from all workflows (delivery, payment, etc.)
- Migrate notification engine to event subscribers
- Migrate webhook dispatcher to event subscribers
- Migrate analytics to event subscribers

### Testing Strategy

- **Unit tests:** InMemoryStreamAdapter (no external dependencies)
- **Integration tests:** Real Redis container (docker-compose)
- **E2E tests:** Full workflow → event → subscriber flow

---

## References

### Redis Streams Documentation

- [Redis Streams Documentation](https://redis.io/docs/data-types/streams/)
- Consumer Groups: [XGROUP CREATE](https://redis.io/commands/xgroup-create/)
- Reading: [XREADGROUP](https://redis.io/commands/xreadgroup/)

### Medusa v2

- [Medusa v2 Events API](https://docs.medusajs.com/development/events/events/)
- [Medusa v2 Architecture](https://docs.medusajs.com/development/fundamentals/)

### Related ADRs

- **ADR-009:** Medusa-Inspired Architecture Evolution
- **ADR-008:** Auth Provider Abstraction Layer

---

## Appendix: Event Bus API Quick Reference

### Emit an Event

```typescript
await bus.emit(
  "order.created",
  {
    orderId: "order_123",
    shopId: "shop_456",
    customerId: "cust_789",
    totalAmount: 99.99,
    currency: "USD",
    createdAt: new Date().toISOString(),
  },
  {
    tenantId: "shop_456",
    correlationId: "req_uuid",
    userId: "user_123",
  },
);
```

### Subscribe to Events

```typescript
const subId = await bus.subscribe(
  "order.created",
  async (envelope) => {
    console.log("Order created:", envelope.data);
  },
  {
    consumerGroup: "notification-service",
    replay: false,
  },
);
```

### Subscribe with Wildcard

```typescript
await bus.subscribe(
  "order.*",
  async (envelope) => {
    console.log("Order event:", envelope.type);
  },
  {
    consumerGroup: "analytics-service",
  },
);
```

### Start Consuming (Blocking)

```typescript
// In a background task or worker process
bus.startConsuming();
```

### Get Metrics

```typescript
const metrics = await bus.getMetrics();
console.log(`Published: ${metrics.publishedCount}`);
console.log(`Handled: ${metrics.handledCount}`);
console.log(`Failed: ${metrics.failedCount}`);
console.log(`P95 latency: ${metrics.p95LatencyMs}ms`);
```

### Graceful Shutdown

```typescript
process.on("SIGTERM", async () => {
  await bus.shutdown(30000); // 30 second timeout
  process.exit(0);
});
```

---

## Decision Checklist

- [x] Problem clearly defined (event-driven architecture for workflows)
- [x] Alternatives evaluated (Kafka, BullMQ, RabbitMQ, SQS)
- [x] Implementation complexity assessed (500 lines achievable)
- [x] Testing strategy defined (in-memory + Redis containers)
- [x] Operational concerns addressed (metrics, alerting, DLQ)
- [x] Type safety considered (strongly-typed WitylogixEvents)
- [x] Scalability path clear (consumer groups)
- [x] Migration path documented (phased approach)
- [x] Team consensus (ADR reviewed by Arjun)

**Status:** ✅ **APPROVED**
