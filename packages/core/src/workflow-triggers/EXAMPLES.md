# Workflow Triggers — Usage Examples

Complete examples demonstrating real-world usage patterns for the workflow trigger system.

## Example 1: Basic Order Workflow

Trigger a delivery order workflow when orders are created:

```typescript
import { TriggerRegistry } from "@witylogix/core/workflow-triggers";

const registry = new TriggerRegistry();

// Register trigger for order creation
registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  conditions: [
    // Only trigger if order status is PENDING
    (ctx) => ctx.entity.status === "PENDING",
    // Only trigger if there are items
    (ctx) => ctx.entity.items?.length > 0,
    // Only trigger if total price is positive
    (ctx) => (ctx.entity.totalPrice || 0) > 0,
  ],
  priority: 100,
  debounceMs: 100, // Prevent rapid re-triggering
  onExecute: async (context) => {
    console.log(`Creating delivery order for ${context.entityId}`);
    // Your workflow execution logic here
  },
});

// In order creation endpoint
app.post("/api/orders", async (request, reply) => {
  const order = await db.orders.create(request.body);

  // Match and execute triggers
  const matches = await registry.match("order.created", {
    entityId: order.id,
    entity: order,
    shopId: request.shopId,
    userId: request.userId,
  });

  // Execute all matching triggers (non-blocking)
  matches.forEach((match) => {
    match.execute().catch((err) => {
      logger.error("Trigger execution failed", err);
    });
  });

  return { success: true, orderId: order.id };
});
```

## Example 2: Multi-Stage Workflow Chain

Multiple triggers executing in priority order:

```typescript
const registry = new TriggerRegistry();

// Stage 1: Validate order (highest priority)
registry.register({
  eventType: "order.created",
  workflowName: "validateOrder",
  priority: 100,
  conditions: [(ctx) => ctx.entity.status === "PENDING"],
  onExecute: async (ctx) => {
    console.log("1. Validating order", ctx.entityId);
    // Validate order fields, items, etc.
  },
});

// Stage 2: Geocode address (medium priority)
registry.register({
  eventType: "order.created",
  workflowName: "geocodeAddress",
  priority: 50,
  conditions: [(ctx) => ctx.entity.shippingAddress],
  onExecute: async (ctx) => {
    console.log("2. Geocoding delivery address");
    // Geocode the delivery address
  },
});

// Stage 3: Create delivery order (lowest priority)
registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  priority: 0,
  onExecute: async (ctx) => {
    console.log("3. Creating delivery order");
    // Create the actual delivery order
  },
});

// When order is created, all three workflows execute in order:
// 1. validateOrder
// 2. geocodeAddress
// 3. createDeliveryOrder
```

## Example 3: Conditional Workflow Triggering

Complex conditions with async validation:

```typescript
const registry = new TriggerRegistry();

registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  conditions: [
    // Basic property checks
    (ctx) => ctx.entity.status === "PENDING",

    // Complex condition
    (ctx) => {
      return (
        ctx.entity.items.some((item) => item.quantity > 0) &&
        ctx.entity.totalPrice > 0 &&
        ctx.entity.shippingAddress !== null
      );
    },

    // Async condition: check if shop has auto-workflows enabled
    async (ctx) => {
      const shop = await db.shops.findById(ctx.shopId);
      return shop?.autoWorkflowsEnabled === true;
    },

    // Async condition: check if customer credit is valid
    async (ctx) => {
      const customer = await fetchCustomerData(ctx.entity.customerId);
      return customer?.creditStatus !== "BLOCKED";
    },
  ],
});
```

## Example 4: Shopify Integration

Process Shopify webhooks and auto-trigger workflows:

```typescript
import {
  TriggerRegistry,
  ShopifyWorkflowBridge,
} from "@witylogix/core/workflow-triggers";

const registry = new TriggerRegistry();
const bridge = new ShopifyWorkflowBridge({
  apiSecret: process.env.SHOPIFY_API_SECRET,
  verifySignature: true,
});

// Register workflows for Shopify events
registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  onExecute: async (ctx) => {
    console.log(
      "Creating delivery for Shopify order",
      ctx.entity.externalOrderNumber,
    );
  },
});

registry.register({
  eventType: "shipment.status_changed",
  workflowName: "updateDeliveryStatus",
  conditions: [(ctx) => ctx.entity.status === "DELIVERED"],
  onExecute: async (ctx) => {
    console.log("Delivery completed, updating Shopify fulfillment");
  },
});

// Webhook handler
app.post("/webhooks/shopify", async (request, reply) => {
  const result = await bridge.handleWebhook(request.body, request.headers);

  if (!result.success) {
    return { error: result.error };
  }

  // Match triggers based on webhook type
  const matches = await registry.match(result.eventType, result.context);

  // Execute triggers
  for (const match of matches) {
    await match.execute({
      timeout: 30000,
      onSuccess: () =>
        logger.info(`Trigger succeeded for ${match.trigger.workflowName}`),
      onError: (err) => logger.error(`Trigger failed: ${err.message}`),
    });
  }

  return { success: true };
});
```

## Example 5: Real-time Workflow Progress

Emit workflow events to clients via Socket.io:

```typescript
import {
  WorkflowSocketEmitter,
  setupClientListeners,
} from "@witylogix/core/workflow-triggers";
import { Server as IOServer } from "socket.io";

const io = new IOServer(server);
const emitter = new WorkflowSocketEmitter(io);

// Setup socket connection handler
io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Setup reconnection handlers
  emitter.setupReconnectionHandler(socket);

  // Setup client-side event listeners
  setupClientListeners(socket, {
    onStarted: (payload) => {
      console.log("Workflow started", payload.workflowName);
    },
    onStepCompleted: (payload) => {
      console.log(
        `Step ${payload.stepName} completed in ${payload.durationMs}ms`,
      );
    },
    onCompleted: (payload) => {
      console.log("Workflow completed with output", payload.output);
    },
    onFailed: (payload) => {
      console.log("Workflow failed with error", payload.error);
    },
  });
});

// In your workflow engine, emit progress events
async function executeWorkflow(executionId, workflowName, context) {
  emitter.workflowStarted({
    executionId,
    workflowName,
    orgId: context.orgId,
    userId: context.userId,
    entityId: context.entityId,
    input: context.input,
    timestamp: new Date(),
  });

  try {
    let stepIndex = 0;
    for (const step of workflow.steps) {
      const startTime = Date.now();

      const result = await step.invoke(context.input, context);

      const durationMs = Date.now() - startTime;

      emitter.stepCompleted({
        executionId,
        workflowName,
        stepName: step.name,
        stepIndex,
        output: result.data,
        durationMs,
        timestamp: new Date(),
      });

      context.input = result.data;
      stepIndex++;
    }

    const totalDuration = Date.now() - startTime;

    emitter.workflowCompleted({
      executionId,
      workflowName,
      output: context.input,
      durationMs: totalDuration,
      totalSteps: workflow.steps.length,
      timestamp: new Date(),
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;

    emitter.workflowFailed({
      executionId,
      workflowName,
      error: error.message,
      durationMs: totalDuration,
      timestamp: new Date(),
    });
  }
}
```

## Example 6: API Hooks Integration

Automatic workflow triggering without explicit handler code:

```typescript
import fastify from "fastify";
import {
  TriggerRegistry,
  registerApiHooks,
} from "@witylogix/core/workflow-triggers";

const app = fastify();
const registry = new TriggerRegistry();

// Register workflows
registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  onExecute: async (ctx) => {
    console.log("Auto-triggered from API hook");
  },
});

// Install API hooks (one line!)
registerApiHooks(app, {
  registry,
  logger: app.log,
  timeout: 30000,
});

// Now all these routes auto-trigger workflows:

// POST /orders → triggers order.created
app.post("/orders", async (req, reply) => {
  const order = await db.orders.create(req.body);
  return { orderId: order.id };
  // Workflow automatically triggered!
});

// PATCH /orders/:id → triggers order.updated
app.patch("/orders/:id", async (req, reply) => {
  const order = await db.orders.update(req.params.id, req.body);
  return order;
  // Workflow automatically triggered!
});

// POST /shipments → triggers shipment.created
app.post("/shipments", async (req, reply) => {
  const shipment = await db.shipments.create(req.body);
  return { shipmentId: shipment.id };
  // Workflow automatically triggered!
});
```

## Example 7: Debounce Pattern

Prevent duplicate executions within a time window:

```typescript
const registry = new TriggerRegistry();

// Example: Order sync workflow debounced to once per 100ms
registry.register({
  eventType: "order.updated",
  workflowName: "syncOrder",
  debounceMs: 100, // Wait 100ms after last update before syncing
  onExecute: async (ctx) => {
    console.log("Syncing order to external system");
    // This executes once even if order.updated fires 10 times in 100ms
  },
});

// If order is updated 10 times in 50ms, sync only happens once after the last update
```

## Example 8: Registry Management

Query and manage registered triggers:

```typescript
const registry = new TriggerRegistry();

// Register multiple triggers
const id1 = registry.register({
  eventType: "order.created",
  workflowName: "workflow1",
});

const id2 = registry.register({
  eventType: "order.created",
  workflowName: "workflow2",
});

const id3 = registry.register({
  eventType: "shipment.created",
  workflowName: "workflow3",
});

// Get statistics
const stats = registry.getStats();
console.log(stats);
// Output: {
//   totalTriggers: 3,
//   enabledTriggers: 3,
//   triggersByEvent: {
//     'order.created': 2,
//     'shipment.created': 1
//   }
// }

// Get all triggers for an event
const orderTriggers = registry.getTriggersByEvent("order.created");
console.log(orderTriggers.length); // 2

// Disable a trigger temporarily
registry.setEnabled(id1, false);

const stats2 = registry.getStats();
console.log(stats2.enabledTriggers); // 2 (id1 is disabled)

// Re-enable the trigger
registry.setEnabled(id1, true);

// Unregister a trigger
registry.unregister(id1);
console.log(registry.getStats().totalTriggers); // 2
```

## Example 9: Error Handling

Graceful error handling in trigger execution:

```typescript
const registry = new TriggerRegistry();

registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  onExecute: async (ctx) => {
    // This might fail
    await unreliableWorkflowEngine.execute(ctx);
  },
});

const matches = await registry.match("order.created", {
  entityId: "order_123",
  entity: { id: "order_123" },
});

for (const match of matches) {
  await match.execute({
    timeout: 30000,
    onSuccess: () => {
      console.log("Trigger executed successfully");
      // Update success metrics
    },
    onError: (error) => {
      console.error("Trigger execution failed", error);
      // Log error for debugging
      // Send alert to monitoring system
      // Don't throw - API request still succeeds
    },
  });
}
```

## Example 10: Complex Integration

Complete system with all features:

```typescript
import fastify from "fastify";
import { Server as IOServer } from "socket.io";
import {
  TriggerRegistry,
  registerApiHooks,
  WorkflowSocketEmitter,
  ShopifyWorkflowBridge,
} from "@witylogix/core/workflow-triggers";

// Setup
const app = fastify();
const httpServer = http.createServer(app.server);
const io = new IOServer(httpServer);

const registry = new TriggerRegistry();
const socketEmitter = new WorkflowSocketEmitter(io);
const shopifyBridge = new ShopifyWorkflowBridge({
  apiSecret: process.env.SHOPIFY_SECRET,
  verifySignature: true,
});

// Register triggers for order workflow
registry.register({
  eventType: "order.created",
  workflowName: "validateOrder",
  priority: 100,
  onExecute: async (ctx) => {
    socketEmitter.workflowStarted({
      executionId: randomUUID(),
      workflowName: "validateOrder",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityId: ctx.entityId,
      input: ctx.entity,
      timestamp: new Date(),
    });
  },
});

registry.register({
  eventType: "order.created",
  workflowName: "createDeliveryOrder",
  priority: 50,
  debounceMs: 100,
  onExecute: async (ctx) => {
    socketEmitter.workflowStarted({
      executionId: randomUUID(),
      workflowName: "createDeliveryOrder",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityId: ctx.entityId,
      input: ctx.entity,
      timestamp: new Date(),
    });
  },
});

// Setup API hooks
registerApiHooks(app, { registry, logger: app.log });

// Setup Socket.io
io.on("connection", (socket) => {
  emitter.setupReconnectionHandler(socket);
});

// Setup Shopify webhook
app.post("/webhooks/shopify", async (req, reply) => {
  const result = await shopifyBridge.handleWebhook(req.body, req.headers);

  if (result.success) {
    const matches = await registry.match(result.eventType, result.context);

    for (const match of matches) {
      await match.execute({
        timeout: 30000,
        onError: (err) => app.log.error(err),
      });
    }

    return { success: true };
  }

  return { error: result.error };
});

// Ready!
app.listen({ port: 3000 });
```
