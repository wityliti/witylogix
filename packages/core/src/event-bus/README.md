# Witylogix Event Bus System

**Production-grade event streaming with Redis Streams backend** for decoupled, workflow-driven architecture.

## Overview

The Event Bus is the backbone of Witylogix's event-driven architecture, enabling:

- **Distributed event streaming** — Events are ordered, durable, and replayable
- **Horizontal scaling** — Consumer groups load-balance message processing across workers
- **Strong typing** — Strongly-typed emit/subscribe with IDE autocomplete
- **Reliability** — Acknowledgment semantics with dead-letter queue and retries
- **Flexibility** — Pluggable stream adapters (Redis, In-Memory) and middleware pipeline

## Architecture

```
┌─────────────┐
│   Workflow  │  Emit events as explicit steps
└──────┬──────┘
       │
       ▼
   ┌───────────────────────────┐
   │   TypedEventBus           │
   │  (Generic, strongly-typed)│
   └───────────┬───────────────┘
               │
               ▼
        ┌─────────────────┐
        │ StreamAdapter   │  Pluggable interface
        └────────┬────────┘
                 │
         ┌───────┴──────────┬──────────────┐
         ▼                  ▼              ▼
    ┌─────────┐      ┌──────────┐   ┌──────────┐
    │  Redis  │      │ In-Memory│   │  Kafka?  │
    │ Streams │      │ (testing)│   │(future)  │
    └─────────┘      └──────────┘   └──────────┘
```

## Quick Start

### 1. Setup with Redis

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
  },
  consumerGroup: {
    name: "notification-service",
    consumerId: process.env.WORKER_ID,
    batchSize: 10,
  },
});

await bus.connect();
```

### 2. Emit an Event

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
    correlationId: "req_uuid", // For tracing
    userId: "user_123",
  },
);
```

### 3. Subscribe to Events

```typescript
// Single event type
await bus.subscribe(
  "order.created",
  async (envelope) => {
    console.log("Order created:", envelope.data);
  },
  {
    consumerGroup: "notification-service",
  },
);

// Wildcard patterns
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

### 4. Start Consuming (Blocking Loop)

```typescript
// In a background task or worker process
await bus.startConsuming();

// Listen for shutdown signal
process.on("SIGTERM", async () => {
  await bus.shutdown(30000); // 30 second timeout
  process.exit(0);
});
```

## Type Safety

All events are strongly typed via the `WitylogixEvents` interface:

```typescript
// ✅ Correct — all fields present and typed
await bus.emit('order.created', {
  orderId: 'order_123',     // ✅ string
  shopId: 'shop_456',       // ✅ string
  customerId: 'cust_789',   // ✅ string
  totalAmount: 99.99,       // ✅ number
  currency: 'USD',          // ✅ string
  createdAt: new Date().toISOString(),  // ✅ string
});

// ❌ Error — missing customerId (required)
await bus.emit('order.created', {
  orderId: 'order_123',
  shopId: 'shop_456',
  // customerId: 'cust_789',  ← TypeScript error
  totalAmount: 99.99,
  currency: 'USD',
  createdAt: new Date().toISOString(),
});

// ❌ Error — wrong type for totalAmount
await bus.emit('order.created', {
  orderId: 'order_123',
  shopId: 'shop_456',
  customerId: 'cust_789',
  totalAmount: '99.99',  ← TypeScript error (string, not number)
  currency: 'USD',
  createdAt: new Date().toISOString(),
});
```

## Event Types

All domain events are defined in `WitylogixEvents`:

### Order Events

- `order.created` — New order created
- `order.confirmed` — Order confirmed by shop
- `order.cancelled` — Order cancelled

### Delivery Events

- `delivery.started` — Delivery route started
- `delivery.completed` — Delivery completed
- `delivery.failed` — Delivery failed

### Driver Events

- `driver.assigned` — Driver assigned to route
- `driver.unassigned` — Driver unassigned
- `driver.location_updated` — Real-time location update

### Workflow Events

- `workflow.started` — Workflow execution started
- `workflow.completed` — Workflow execution completed
- `workflow.failed` — Workflow execution failed
- `workflow.step_completed` — Individual workflow step completed

### Webhook Events

- `webhook.delivered` — Webhook delivered successfully
- `webhook.failed` — Webhook delivery failed

### Billing Events

- `billing.invoice_created` — Invoice created
- `billing.payment_received` — Payment received

## Pattern Matching

Subscribe to events using patterns with wildcards:

```typescript
// Exact match
bus.subscribe('order.created', ...);

// Wildcard: all order events
bus.subscribe('order.*', ...);

// Wildcard: all .completed events
bus.subscribe('*.completed', ...);

// Wildcard: all events
bus.subscribe('*', ...);
```

## Event Metadata

Every event carries structured metadata:

```typescript
interface EventMetadata {
  id: string; // UUID — unique event ID
  type: string; // e.g., "order.created"
  source: string; // e.g., "order-service"
  timestamp: string; // ISO 8601
  tenantId: string; // For multi-tenancy isolation
  correlationId: string; // For tracing related events
  version: number; // Schema version
  userId?: string; // Who triggered the event
  requestId?: string; // HTTP request ID
  tags?: Record<string, string>;
}
```

### Usage

```typescript
await bus.subscribe("order.created", async (envelope) => {
  const metadata = envelope.metadata;
  const data = envelope.data;

  // Use metadata for tracing, logging, multi-tenancy checks
  console.log(`Event ${metadata.id} for tenant ${metadata.tenantId}`);
  console.log(`Correlation ID: ${metadata.correlationId}`);
  console.log(`Triggered by user: ${metadata.userId}`);
});
```

## Middleware Pipeline

Use middleware for cross-cutting concerns:

```typescript
const loggingMiddleware = {
  beforePublish: async (envelope) => {
    console.log(`Publishing ${envelope.metadata.type}`);
    return envelope;
  },
  afterPublish: async (envelope, messageId) => {
    console.log(`Published ${envelope.metadata.type} with ID ${messageId}`);
  },
  beforeHandle: async (envelope) => {
    console.log(`Handling ${envelope.metadata.type}`);
    return envelope;
  },
  afterHandle: async (envelope) => {
    console.log(`Handled ${envelope.metadata.type}`);
  },
  onError: async (envelope, error) => {
    console.error(
      `Failed to handle ${envelope.metadata.type}: ${error.message}`,
    );
  },
};

const bus = new TypedEventBus({
  middleware: [loggingMiddleware, metricsMiddleware, validationMiddleware],
  // ...
});
```

## Retry Logic

Failed handlers are retried with exponential backoff:

```typescript
const bus = new TypedEventBus({
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 100, // 100ms first retry
    maxDelayMs: 5000, // Cap at 5 seconds
    backoffMultiplier: 2, // 100ms → 200ms → 400ms
    jitterFactor: 0.1, // Add ±10% randomness
  },
  // ...
});

// Handler fails:
// Attempt 1: immediate fail
// Attempt 2: wait ~100ms, retry
// Attempt 3: wait ~220ms (200 + 10% jitter), retry
// Attempt 4: wait ~500ms (400 + 10% jitter), retry
// All attempts exhausted → move to dead-letter queue
```

## Dead-Letter Queue

Failed messages can be sent to a dead-letter queue for manual review:

```typescript
const bus = new TypedEventBus({
  deadLetter: {
    enabled: true,
    streamKey: "events:dead-letter",
    consumerGroup: "dead-letter-processor",
    handler: async (envelope, error) => {
      // Log to database for manual inspection
      await db.deadLetters.create({
        eventType: envelope.metadata.type,
        eventId: envelope.metadata.id,
        errorMessage: error.message,
        eventData: envelope.data,
        createdAt: new Date(),
      });
    },
  },
  // ...
});
```

## Horizontal Scaling

Use consumer groups to scale message processing across workers:

```typescript
// Worker 1
const bus1 = new TypedEventBus({
  consumerGroup: {
    name: "notification-service", // Same group
    consumerId: "worker-1", // Different ID
  },
  // ...
});
await bus1.startConsuming();

// Worker 2
const bus2 = new TypedEventBus({
  consumerGroup: {
    name: "notification-service", // Same group
    consumerId: "worker-2", // Different ID
  },
  // ...
});
await bus2.startConsuming();

// Redis automatically load-balances:
// Each message is processed by ONE worker.
// If worker-1 crashes, pending messages are auto-claimed by worker-2.
```

## Metrics and Monitoring

Get real-time metrics about event processing:

```typescript
const metrics = await bus.getMetrics();

console.log(`Published: ${metrics.publishedCount}`);
console.log(`Handled: ${metrics.handledCount}`);
console.log(`Failed: ${metrics.failedCount}`);
console.log(`Active subscriptions: ${metrics.activeSubscriptions}`);
console.log(`Average latency: ${metrics.averageLatencyMs}ms`);
console.log(`P95 latency: ${metrics.p95LatencyMs}ms`);
console.log(`P99 latency: ${metrics.p99LatencyMs}ms`);

// Consumer group details
for (const group of metrics.consumerGroups) {
  console.log(`Group: ${group.name}, Pending: ${group.pendingCount}`);
}
```

## Testing

Use the In-Memory adapter for unit tests (no Redis required):

```typescript
import { InMemoryStreamAdapter } from "@witylogix/core/event-bus";

describe("Order Creation Workflow", () => {
  let bus: TypedEventBus<WitylogixEvents>;

  beforeEach(() => {
    bus = new TypedEventBus({
      adapter: new InMemoryStreamAdapter(), // No Redis needed
      name: "test-bus",
    });
  });

  it("should emit order.created event", async () => {
    const received: EventEnvelope[] = [];

    await bus.subscribe("order.created", (envelope) => {
      received.push(envelope);
    });

    await bus.emit("order.created", {
      /* ... */
    });
    await bus.startConsuming();
    await new Promise((r) => setTimeout(r, 100));

    expect(received).toHaveLength(1);
    expect(received[0].data.orderId).toBe("order_123");
  });
});
```

## Workflow Integration

Emit events from workflow steps:

```typescript
import { emitEventStep } from "@witylogix/framework/workflows";

export const orderCreationWorkflow = createWorkflow(
  "create-delivery-order",
  async (input: { orderId; shopId; customerId }) => {
    // Step 1: Create order
    const order = await orderStep(input);

    // Step 2: Emit event (explicit step)
    await emitEventStep({
      type: "order.created",
      data: order,
    });

    // Step 3: Other steps can be triggered by event subscribers
    // (e.g., notification service subscribes to order.created)
  },
);
```

## Configuration Reference

```typescript
interface EventBusConfig {
  name: string; // Bus instance name
  adapter: StreamAdapter; // Redis, In-Memory, etc.
  retryPolicy?: RetryPolicy; // Retry behavior
  deadLetter?: DeadLetterConfig; // DLQ configuration
  consumerGroup?: ConsumerGroupConfig; // Consumer group settings
  middleware?: EventMiddleware[]; // Middleware pipeline
  maxStreamLength?: number; // Max messages per stream (default: 10000)
  autoCreateConsumerGroups?: boolean; // Auto-create groups (default: true)
  enableMetrics?: boolean; // Metrics collection (default: true)
}
```

## Adapters

### RedisStreamAdapter

```typescript
import { RedisStreamAdapter } from "@witylogix/core/event-bus";
import Redis from "ioredis";

const client = new Redis();
const adapter = new RedisStreamAdapter(client, "events" /* key prefix */);
```

**Features:**

- XADD for publishing
- XREADGROUP for consumer groups
- XACK for acknowledgment
- XCLAIM for dead-letter recovery
- XTRIM for housekeeping

### InMemoryStreamAdapter

```typescript
import { InMemoryStreamAdapter } from "@witylogix/core/event-bus";

const adapter = new InMemoryStreamAdapter();
```

**Features:**

- Map-based in-memory storage
- Identical interface to Redis adapter
- Perfect for unit tests

## Performance Considerations

### Throughput

- **Typical:** 10k–100k events/sec per Redis node
- **Bottleneck:** Handler latency (not publish)
- **Scaling:** Add consumer group workers

### Latency

- **Publish:** ~5–10ms (Redis round-trip)
- **Consume:** ~10–20ms (batch read + process)
- **End-to-end:** 20–50ms (publish → handler start)

### Memory

- **Redis:** Streams stored in memory (use MAXLEN trimming)
- **Recommended:** Trim to 10k messages per stream type

### Consumer Group Lag

Monitor consumer group lag:

```typescript
const metrics = await bus.getMetrics();
for (const group of metrics.consumerGroups) {
  console.log(`${group.name}: ${group.pendingCount} pending`);
}
```

## Troubleshooting

### Consumer stuck / messages not being processed

1. Check consumer group lag:

   ```bash
   redis-cli XINFO GROUPS <stream-key>
   ```

2. Check pending messages:

   ```bash
   redis-cli XPENDING <stream-key> <group-name>
   ```

3. Manually reclaim stuck messages:
   ```bash
   redis-cli XCLAIM <stream-key> <group-name> <consumer-id> 60000 <message-id>
   ```

### Dead-letter queue filling up

1. Check DLQ size:

   ```bash
   redis-cli XLEN events:dead-letter
   ```

2. Inspect failed events:

   ```typescript
   const dlq = await adapter.readGroup(
     "events:dead-letter",
     "dead-letter-processor",
     "inspector",
     10,
     0,
   );
   ```

3. Fix underlying handler and replay:
   ```typescript
   // Fix handler logic, then restart consumer
   ```

## References

- **ADR-010:** [Event Bus Architecture Decision Record](../../adr/ADR-010-event-bus-architecture.md)
- **ADR-009:** [Medusa-Inspired Architecture](../../adr/ADR-009-medusa-inspired-architecture-evolution.md)
- **Redis Streams:** [Official Documentation](https://redis.io/docs/data-types/streams/)

## License

Proprietary — Witylogix Platform
