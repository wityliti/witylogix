# Workflow Triggers System

Auto-fire workflows from API endpoints and Socket.io real-time events with a priority-ordered, debounced trigger registry.

## Features

- **Trigger Registry**: Register, match, and execute triggers based on event types and conditions
- **API Hooks**: Fastify hooks for automatic workflow triggering on successful API operations
- **Socket.io Real-time Events**: Emit workflow progress events to connected clients
- **Shopify Integration**: Map Shopify webhooks to workflow triggers
- **Priority Ordering**: Execute multiple matching triggers in priority order
- **Debounce/Throttle**: Prevent rapid re-triggering of workflows
- **Condition Evaluation**: Support custom predicates and async conditions
- **Error Handling**: Graceful error handling with callbacks

## Architecture

```
workflow-triggers/
├── trigger-registry.ts      # Core trigger matching and execution
├── api-hooks.ts             # Fastify hooks for auto-triggering
├── socket-events.ts         # Socket.io real-time event emitter
├── integrations/
│   └── shopify-bridge.ts    # Shopify webhook → trigger mapper
└── __tests__/
    ├── trigger-registry.test.ts  # Unit tests
    └── integration.test.ts        # Integration tests
```

## Usage

### 1. Setup Trigger Registry

```typescript
import { TriggerRegistry } from "@witylogix/core/workflow-triggers";

const registry = new TriggerRegistry();

// Register a trigger
const triggerId = registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  conditions: [
    (ctx) => ctx.entity.status === "PENDING",
    (ctx) => ctx.entity.totalPrice > 0,
  ],
  priority: 100,
  debounceMs: 100,
  onExecute: async (context) => {
    // Trigger workflow here
  },
});
```

### 2. Match Triggers in API Handlers

```typescript
// In your order creation endpoint
const matches = await registry.match("order.created", {
  entityId: order.id,
  entity: order,
  shopId: req.shopId,
  userId: req.userId,
});

// Execute matched triggers (non-blocking)
for (const match of matches) {
  await match.execute({
    timeout: 30000,
    onSuccess: (result) => console.log("Trigger succeeded"),
    onError: (error) => console.error("Trigger failed", error),
  });
}
```

### 3. Setup API Hooks

Automatically trigger workflows when API operations succeed:

```typescript
import fastify from "fastify";
import { registerApiHooks } from "@witylogix/core/workflow-triggers";

const app = fastify();
const registry = new TriggerRegistry();

// Register API hooks
registerApiHooks(app, {
  registry,
  logger: app.log,
  timeout: 30000,
});

// Now workflows are triggered automatically on:
// - POST /orders (order.created)
// - PATCH /orders/:id (order.updated)
// - POST /shipments (shipment.created)
// - PATCH /shipments/:id/status (shipment.status_changed)
// - POST /shipments/:id/assign (driver.assigned)
```

### 4. Real-time Events via Socket.io

Emit workflow progress events to connected clients:

```typescript
import { Server as IOServer } from "socket.io";
import { WorkflowSocketEmitter } from "@witylogix/core/workflow-triggers";

const io = new IOServer(server);
const emitter = new WorkflowSocketEmitter(io);

// Subscribe client to execution room
io.on("connection", (socket) => {
  emitter.setupReconnectionHandler(socket);

  socket.on("workflow:subscribe_execution", (data) => {
    emitter.subscribeToExecution(socket, data.executionId);
  });
});

// Emit events from workflow engine
emitter.workflowStarted({
  executionId: "exec_123",
  workflowName: "createDeliveryOrder",
  orgId: "org_456",
  userId: "user_789",
  entityId: "order_xyz",
  input: { orderId: "order_xyz" },
  timestamp: new Date(),
});

emitter.stepCompleted({
  executionId: "exec_123",
  workflowName: "createDeliveryOrder",
  stepName: "validateOrder",
  stepIndex: 0,
  output: { validated: true },
  durationMs: 125,
  timestamp: new Date(),
});

emitter.workflowCompleted({
  executionId: "exec_123",
  workflowName: "createDeliveryOrder",
  output: { deliveryId: "delivery_123" },
  durationMs: 5000,
  totalSteps: 5,
  timestamp: new Date(),
});
```

### 5. Shopify Integration

Process Shopify webhooks:

```typescript
import { ShopifyWorkflowBridge } from "@witylogix/core/workflow-triggers";

const bridge = new ShopifyWorkflowBridge({
  apiSecret: process.env.SHOPIFY_API_SECRET,
  verifySignature: true,
  logger: app.log,
});

app.post("/webhooks/shopify", async (request, reply) => {
  const result = await bridge.handleWebhook(
    request.body,
    request.headers,
  );

  if (result.success) {
    // Match triggers
    const matches = await registry.match(result.eventType, result.context);

    // Execute triggers
    for (const match of matches) {
      await match.execute();
    }

    return { success: true };
  }

  return { success: false, error: result.error };
});
```

## Event Types

### Supported Events

- `order.created` - Order created
- `order.updated` - Order updated
- `shipment.created` - Shipment created
- `shipment.status_changed` - Shipment status changed
- `driver.assigned` - Driver assigned to shipment
- `delivery.completed` - Delivery completed

## Trigger Conditions

Conditions are predicates that determine if a trigger should execute:

```typescript
// Simple condition
registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  conditions: [
    (ctx) => ctx.entity.status === "PENDING",
  ],
});

// Multiple conditions (AND logic)
registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  conditions: [
    (ctx) => ctx.entity.status === "PENDING",
    (ctx) => ctx.entity.totalPrice > 0,
    (ctx) => ctx.entity.items.length > 0,
  ],
});

// Async condition
registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  conditions: [
    async (ctx) => {
      const shop = await db.shops.findById(ctx.shopId);
      return shop?.enableAutoWorkflows === true;
    },
  ],
});
```

## Priority Ordering

Triggers with higher priority execute first:

```typescript
// High priority trigger
registry.register({
  eventType: "order.created",
  workflowName: "validateOrder",
  priority: 100,
});

// Medium priority trigger
registry.register({
  eventType: "order.created",
  workflowName: "geocodeAddress",
  priority: 50,
});

// Low priority trigger (executes last)
registry.register({
  eventType: "order.created",
  workflowName: "createDelivery",
  priority: 0,
});
```

## Debounce and Throttle

Prevent rapid re-triggering:

```typescript
// Debounce: wait 100ms after last trigger before executing
registry.register({
  eventType: "order.updated",
  workflowName: "syncOrder",
  debounceMs: 100,
});

// Throttle: prevent triggering more than once per 1000ms
registry.register({
  eventType: "driver.location_updated",
  workflowName: "updateDeliveryStatus",
  throttleMs: 1000,
});

// Both: debounce first, then throttle
registry.register({
  eventType: "order.updated",
  workflowName: "syncOrder",
  debounceMs: 100,
  throttleMs: 5000,
});
```

## Socket.io Rooms

Events are broadcast to multiple rooms for selective delivery:

```
org:{orgId}                    - Organization-wide events
user:{userId}                  - User-specific events
entity:{entityId}              - Entity-specific events (order, shipment)
workflow:{executionId}         - Execution-specific events
```

Example client-side:

```typescript
// Client subscribes to order updates
socket.emit("workflow:subscribe_entity", { entityId: "order_123" });

socket.on("workflow:started", (payload) => {
  console.log("Workflow started for order", payload.entityId);
});

socket.on("workflow:step_completed", (payload) => {
  console.log("Step completed", payload.stepName);
});

socket.on("workflow:completed", (payload) => {
  console.log("Order workflow completed", payload.output);
});
```

## Testing

### Unit Tests

Test trigger registry functionality:

```bash
npm test -- trigger-registry.test.ts
```

### Integration Tests

Test complete workflow trigger system:

```bash
npm test -- integration.test.ts
```

## API Reference

### TriggerRegistry

#### Methods

- `register(options)` → `triggerId`
  - Register a new trigger
  - Options: `eventType`, `workflowName`, `conditions`, `priority`, `debounceMs`, `throttleMs`, `metadata`, `onExecute`
  - Returns: unique trigger ID

- `unregister(triggerId)` → `boolean`
  - Unregister a trigger by ID

- `getTrigger(triggerId)` → `WorkflowTrigger | undefined`
  - Get trigger by ID

- `getTriggersByEvent(eventType)` → `WorkflowTrigger[]`
  - Get all triggers for an event type

- `match(eventType, context)` → `MatchedTrigger[]`
  - Match triggers to an event
  - Returns: triggers sorted by priority

- `setEnabled(triggerId, enabled)` → `boolean`
  - Enable/disable a trigger

- `getAll()` → `WorkflowTrigger[]`
  - Get all registered triggers

- `getStats()` → `{ totalTriggers, enabledTriggers, triggersByEvent }`
  - Get registry statistics

### WorkflowSocketEmitter

#### Methods

- `workflowStarted(payload)` - Emit workflow started
- `stepCompleted(payload)` - Emit step completed
- `workflowCompleted(payload)` - Emit workflow completed
- `workflowFailed(payload)` - Emit workflow failed
- `compensationStarted(payload)` - Emit compensation started
- `subscribeToExecution(socket, executionId)` - Subscribe socket to execution room
- `getStoredEvents(executionId)` - Get recent events for reconnection
- `getAllRooms()` - Get all rooms and their sizes
- `cleanupOldEvents(maxAgeMs)` - Clean up old events

### ShopifyWorkflowBridge

#### Methods

- `handleWebhook(payload, headers)` → `WebhookProcessResult`
  - Process Shopify webhook
  - Supports: `orders/create`, `orders/update`, `fulfillments/create`, `fulfillments/update`
  - Returns: event type, trigger context, or error

- `getStats()` - Get bridge statistics

## Error Handling

All errors are handled gracefully and never break the API response:

```typescript
// Execution errors are caught
const matches = await registry.match("order.created", context);
for (const match of matches) {
  try {
    await match.execute({
      onError: (error) => {
        logger.error("Trigger execution failed", error);
      },
    });
  } catch (error) {
    // Already logged
  }
}

// Condition evaluation errors skip that trigger
const matches = await registry.match("order.created", context);
// If condition throws, trigger is skipped (not matched)
```

## Performance

- **O(n)** trigger matching where n = number of triggers for event type
- **O(1)** priority ordering (pre-sorted)
- **Debounce**: Prevents duplicate executions within time window
- **Throttle**: Rate-limits executions
- **In-memory storage**: Quick lookups and matching

## File Manifest

- **trigger-registry.ts** (~300 lines)
  - TriggerRegistry class
  - Trigger condition evaluation
  - Priority ordering
  - Debounce/throttle support

- **api-hooks.ts** (~250 lines)
  - Fastify hooks for auto-triggering
  - Order/shipment/driver event detection
  - Context extraction from requests/responses

- **socket-events.ts** (~200 lines)
  - Socket.io event emitter
  - Room-based scoping
  - Reconnection event storage

- **integrations/shopify-bridge.ts** (~250 lines)
  - Shopify webhook processing
  - Order/fulfillment mapping
  - Signature verification
  - Error handling

- **__tests__/trigger-registry.test.ts** (~300 lines)
  - Registration tests
  - Matching tests
  - Priority ordering tests
  - Debounce behavior tests
  - Edge case tests

- **__tests__/integration.test.ts** (~300 lines)
  - End-to-end workflow tests
  - API hook integration tests
  - Socket.io event tests
  - Shopify integration tests
