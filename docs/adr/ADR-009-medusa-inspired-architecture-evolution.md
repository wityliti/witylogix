# ADR-009: Medusa v2-Inspired Architecture Evolution for Witylogix

**Status:** Proposed
**Date:** 2026-03-07
**Deciders:** Witylogix Engineering Team (Arjun — CTO)
**Supersedes:** ADR-001 (Core Architecture), ADR-008 (Event System)

---

## Executive Summary

This ADR proposes a comprehensive architectural evolution of Witylogix's platform, deeply informed by Medusa.js v2's battle-tested patterns for modular, workflow-orchestrated commerce platforms. We are **not adopting Medusa wholesale**, but rather using its proven solutions to solve delivery logistics challenges.

### The Vision

Transform Witylogix from a **tightly-coupled service layer** into a **composable, workflow-driven platform** where:

1. **Modules are truly isolated** — Each domain (orders, billing, routing, notifications) has its own service layer, models, and boundaries. Inter-module communication flows exclusively through workflows and links, never through direct service imports.

2. **Workflows orchestrate everything** — Multi-step operations (create order → assign driver → optimize route → send notification) are first-class citizens, not buried in service methods. Each step is independently testable and compensatable (can rollback).

3. **Links replace cross-module relations** — Instead of foreign keys spanning modules, we define linkable entities and create explicit link tables. This enforces module boundaries at the database level.

4. **Events are workflow outputs** — Events aren't fired ad-hoc from services. They're emitted as explicit workflow steps via `emitEventStep()`. Subscribers invoke workflows for non-integral actions, not implement business logic.

5. **Plugins are reusable compositions** — Plugins package modules + workflows + hooks + subscribers into cohesive, installable features. Enterprises can extend without forking.

6. **The framework abstracts orchestration** — A thin Witylogix framework (inspired by Medusa's architecture) provides the workflow engine, container DI, event bus, link manager, and job scheduler.

### Timeline & Scope

- **Phase 1 (Q2 2026):** Framework foundation + 2 core workflows (create order, complete delivery)
- **Phase 2 (Q3 2026):** Migrate billing, routing, notifications modules + 5 workflows
- **Phase 3 (Q4 2026):** Full module isolation, links, 10+ workflows, plugin API
- **Phase 4 (2027):** Enterprise plugin marketplace, RLS multi-tenancy, auto-scaling jobs

Over 18 months, this positions Witylogix as the "Medusa for delivery logistics."

---

## Part 1: Deep Technical Comparison — Medusa v2 Patterns vs. Witylogix Today

### 1.1 Modules: From Direct Imports to Containerized Services

**Medusa v2 Model**

```typescript
// medusa-commerce/packages/modules/product/service.ts
import { MedusaService } from "@medusajs/framework";
import { defineQueryConfig } from "@medusajs/framework/types";

class ProductService extends MedusaService {
  // Auto-generates: create, retrieve, delete, list with type safety
  // Custom methods extend CRUD
}

// medusa-commerce/packages/modules/product/index.ts
export const defineModule = {
  key: "product",
  registrations: [
    {
      name: "productService",
      definition: ProductService,
    },
  ],
  linkable: {
    product: { resourceId: "id" },
  },
};
```

**Witylogix Today**

```typescript
// packages/core/src/orders/order-manager.ts
export class OrderManager {
  constructor(private db: PrismaClient) {}
  async createOrder(data) {
    /* direct Prisma calls */
  }
  async updateStatus(id, status) {
    /* ... */
  }
  // No DI container, direct imports in routes
}

// apps/api/src/routes/orders.ts
import { OrderManager } from "../../../packages/core";
const orderMgr = new OrderManager(prisma);
const order = await orderMgr.createOrder(data);
```

**What Medusa Does Better**

1. **Service Factory Pattern** — `MedusaService` auto-generates CRUD methods (`createOrders`, `retrieveOrder`, `listOrders`, `deleteOrders`) with filtering, pagination, and transactions built-in. No boilerplate.
2. **Container Registration** — Services are registered in a module container, not imported directly. This enables:
   - Plugin injection: A plugin can replace the service without touching code
   - Service composition: Workflows pull services from container, not import statements
   - Testing: Mock entire service implementations
3. **`linkable` property** — Modules declare what entities can be linked to other modules. No surprise dependencies.

**Witylogix Changes**

Step 1: Create `packages/modules/orders/service.ts` with base class support:

```typescript
// packages/framework/core/service.ts
export abstract class WityService {
  protected db: Database; // abstraction over Prisma
  protected container: Container;

  async createMany(data: T[], options?: CreateOptions): Promise<T[]> {
    // Auto-batched creates with transactions
    return this.db.batchInsert(this.model, data, options);
  }

  async retrieveOne(id: string, options?: RetrieveOptions): Promise<T> {
    return this.db.findUnique(this.model, { id }, options);
  }

  // Custom methods override defaults
}

// packages/modules/orders/service.ts
export class OrderService extends WityService {
  async createDeliveryOrder(data) {
    // Custom logic beyond CRUD
  }
}

// packages/modules/orders/index.ts
export const defineModule = {
  key: "orders",
  registrations: [{ name: "orderService", definition: OrderService }],
  linkable: {
    deliveryOrder: { resourceId: "id" },
    orderStop: { resourceId: "id" },
  },
};
```

Step 2: Routes call workflows, not services directly:

```typescript
// apps/api/src/routes/orders.ts
export async function POST(req, { container }) {
  const workflow = container.resolve("createDeliveryOrderWorkflow");
  const result = await workflow.run({ input: req.body });
  return result;
}
```

**Key Difference We Keep**

- **We keep direct module imports for initial setup** — Medusa's container is heavy. We'll use a lightweight DI that supports both import and container resolution during the transition.
- **We keep Prisma** — Medusa v2 switched to MikroORM because they needed per-module database isolation. We don't, yet. Prisma is better for our current scale and team familiarity.

---

### 1.2 Workflows: From Service Methods to First-Class Orchestration

**Medusa v2 Model**

```typescript
// medusa-commerce/packages/workflows/product/create-products.ts
import {
  createWorkflow,
  createStep,
  StepResponse,
} from "@medusajs/workflows-sdk";

const validateProductDataStep = createStep(
  "validate-product-data",
  async (input, { container }) => {
    const validation = await container
      .resolve("validationService")
      .validate(input.data);
    return new StepResponse(validation);
  },
);

const saveProductStep = createStep(
  "save-product",
  async (input, { container }) => {
    const productService = container.resolve("productService");
    const product = await productService.create(input.validated);
    return new StepResponse(product);
  },
  {
    compensate: async (error, input, { container }) => {
      // Rollback: delete the product if subsequent steps fail
      const productService = container.resolve("productService");
      await productService.delete(input.product.id);
    },
  },
);

const emitProductCreatedStep = createStep(
  "emit-product-created",
  async (input, { container }) => {
    const eventBus = container.resolve("eventBus");
    await eventBus.emit("product.created", { product: input.product });
    return new StepResponse({});
  },
);

export const createProductsWorkflow = createWorkflow(
  "create-products",
  (input: CreateInput) => {
    const validatedData = validateProductDataStep(input.data);
    const product = saveProductStep(validatedData);
    const emitted = emitProductCreatedStep(product);
    return { product };
  },
);
```

**Witylogix Today**

```typescript
// packages/core/src/orders/order-manager.ts
export class OrderManager {
  async createOrder(data) {
    // Validate inline
    if (!data.customerId) throw new Error("customerId required");

    // Create directly
    const order = await this.db.orders.create({ data });

    // Emit event ad-hoc
    await this.eventBus.emit("order.created", { order });

    // Return order
    return order;
  }
}

// apps/api/src/routes/orders.ts
const order = await orderManager.createOrder(req.body);
res.json(order);
```

**Problems with Current Approach**

1. Validation, creation, and emission are tangled in one method.
2. No rollback mechanism — if event emission fails, order is created but event is lost.
3. Hard to test in isolation (validation ≠ creation ≠ emission).
4. Hard to reuse steps across workflows (e.g., validate order used in both create and update).
5. No way to hook into a workflow without modifying its source.

**Witylogix Changes: The Workflow Layer**

```typescript
// packages/workflows/orders/create-delivery-order.ts
import { createWorkflow, createStep } from "@witylogix/framework";

const validateDeliveryDataStep = createStep(
  "validate-delivery-data",
  async (input, { container }) => {
    const validator = container.resolve("validationService");
    const errors = await validator.validate("DeliveryOrder", input.data);
    if (errors.length) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }
    return new StepResponse(input.data);
  },
);

const checkInventoryStep = createStep(
  "check-inventory",
  async (input, { container }) => {
    const inventoryService = container.resolve("inventoryService");
    const available = await inventoryService.checkAvailability(
      input.data.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
    );
    if (!available) {
      throw new Error("Inventory unavailable");
    }
    return new StepResponse(input.data);
  },
);

const assignZoneStep = createStep(
  "assign-zone",
  async (input, { container }) => {
    const routingService = container.resolve("routingService");
    const zone = await routingService.findOptimalZone(
      input.data.deliveryAddress,
    );
    return new StepResponse({ ...input.data, zoneId: zone.id });
  },
);

const calculateRateStep = createStep(
  "calculate-rate",
  async (input, { container }) => {
    const billingService = container.resolve("billingService");
    const rate = await billingService.calculateDeliveryRate({
      zoneId: input.zoneId,
      weight: input.data.totalWeight,
      distance: input.data.distance,
    });
    return new StepResponse({ ...input.data, rate });
  },
);

const createOrderStep = createStep(
  "create-order",
  async (input, { container }) => {
    const orderService = container.resolve("orderService");
    const order = await orderService.create({
      customerId: input.data.customerId,
      items: input.data.items,
      zoneId: input.zoneId,
      rate: input.rate,
      status: "pending",
    });
    return new StepResponse(order);
  },
  {
    compensate: async (error, input, { container }) => {
      // Rollback: if later steps fail, delete the order
      const orderService = container.resolve("orderService");
      if (input.order?.id) {
        await orderService.delete(input.order.id);
      }
    },
  },
);

const emitOrderCreatedStep = createStep(
  "emit-order-created",
  async (input, { container }) => {
    const eventBus = container.resolve("eventBus");
    await eventBus.emit("order.created", {
      orderId: input.order.id,
      customerId: input.order.customerId,
      totalCharge: input.order.rate,
    });
    return new StepResponse({});
  },
);

export const createDeliveryOrderWorkflow = createWorkflow(
  "create-delivery-order",
  (input: { data: CreateOrderInput }) => {
    const validated = validateDeliveryDataStep(input.data);
    const inventoryOk = checkInventoryStep(validated);
    const withZone = assignZoneStep(inventoryOk);
    const withRate = calculateRateStep(withZone);
    const order = createOrderStep(withRate);
    const emitted = emitOrderCreatedStep(order);
    return { order };
  },
);
```

**Using the Workflow**

```typescript
// apps/api/src/routes/orders.ts
export async function POST(req, { container }) {
  try {
    const workflow = container.resolve("createDeliveryOrderWorkflow");
    const { order } = await workflow.run({
      input: { data: req.body },
    });
    return res.status(201).json(order);
  } catch (error) {
    // Workflow automatically compensates (rolls back)
    // e.g., if assignZoneStep fails, nothing is created
    return res.status(400).json({ error: error.message });
  }
}
```

**Key Advantages**

1. **Each step is independently testable.**
2. **Compensation is per-step** — Only steps that succeeded get rolled back.
3. **Reusable steps** — `validateDeliveryDataStep` can be used in other workflows.
4. **Observable** — We can hook into workflow execution (logging, metrics, tracing).
5. **Long-running** — Async workflows can span multiple HTTP requests or scheduled jobs.
6. **Workflow hooks** — Plugins inject custom steps without modifying the workflow file.

**Example: Workflow Hooks for Plugins**

```typescript
// A fraud detection plugin hooks into the workflow
export const defineModule = {
  key: "fraud-detection",
  hooks: [
    {
      event: "order.createDeliveryOrderWorkflow.validate-delivery-data",
      handler: "fraudCheckStep", // runs after validation, before inventory check
    },
  ],
};

// The plugin's step
const fraudCheckStep = createStep(
  "fraud-check",
  async (input, { container }) => {
    const fraudService = container.resolve("fraudDetectionService");
    const result = await fraudService.analyze(input);
    if (result.riskLevel > 0.8) {
      throw new Error(`High fraud risk: ${result.reason}`);
    }
    return new StepResponse(input);
  },
);
```

---

### 1.3 Module Links: From Foreign Keys to Link Tables

**Medusa v2 Model**

```typescript
// medusa-commerce/packages/modules/order/models/order.ts
export const defineModel = {
  tableName: "orders",
  fields: {
    id: { type: "text", primary: true },
    customerId: { type: "text" }, // No FK to customer module
  },
};

// medusa-commerce/packages/modules/product/models/product.ts
export const defineModel = {
  tableName: "products",
  fields: {
    id: { type: "text", primary: true },
  },
};

// medusa-commerce/packages/links/product-order-item.ts
export const defineLink = {
  leftModule: "product",
  leftEntity: "product",
  rightModule: "order",
  rightEntity: "order_item",
  isList: true, // An order can have many items
};

// Medusa auto-generates:
// CREATE TABLE product_order_order_item (
//   product_id TEXT,
//   order_id TEXT,
//   PRIMARY KEY (product_id, order_id)
// );
```

**Witylogix Today**

```prisma
// packages/db/schema.prisma
model DeliveryOrder {
  id String @id
  customerId String
  customer Customer @relation(fields: [customerId], references: [id])
  items OrderItem[]
  zoneId String
  zone Zone @relation(fields: [zoneId], references: [id])
}

model OrderItem {
  id String @id
  orderId String
  order DeliveryOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product Product @relation(fields: [productId], references: [id])
  quantity Int
}

model Zone {
  id String @id
  name String
  orders DeliveryOrder[]
}

model Product {
  id String @id
  sku String
  items OrderItem[]
}

model Customer {
  id String @id
  name String
  orders DeliveryOrder[]
}
```

**Problems with Current Approach**

1. Foreign keys span modules (orders → customers → users). If we want to isolate modules, foreign keys become a problem.
2. Schema changes in one module (e.g., Customer) require migrations in all modules that reference it.
3. No way to disable a relationship without a migration.
4. Hard to support multi-tenancy with row-level security when FK graph is complex.

**Witylogix Changes: Link Tables**

Instead of direct FKs, we define "linkable" entities and create link tables:

```typescript
// packages/modules/orders/index.ts
export const defineModule = {
  key: "orders",
  linkable: {
    deliveryOrder: { resourceId: "id" },
    orderItem: { resourceId: "id" },
  },
};

// packages/modules/customers/index.ts
export const defineModule = {
  key: "customers",
  linkable: {
    customer: { resourceId: "id" },
  },
};

// packages/modules/billing/index.ts
export const defineModule = {
  key: "billing",
  linkable: {
    zone: { resourceId: "id" },
  },
};

// packages/links/orders-customers.ts
import { defineLink } from "@witylogix/framework";
import { OrdersModule } from "../modules/orders";
import { CustomersModule } from "../modules/customers";

export const ordersCustomersLink = defineLink({
  left: { module: OrdersModule, entity: "deliveryOrder" },
  right: { module: CustomersModule, entity: "customer" },
  isList: true, // A customer can have many orders
  onDelete: "cascade", // Delete order if customer deleted
});

// packages/links/orders-items-products.ts
export const ordersItemsProductsLink = defineLink({
  left: { module: OrdersModule, entity: "orderItem" },
  right: { module: ProductsModule, entity: "product" },
  isList: false, // Each item links to one product
  onDelete: "restrict", // Don't delete product if item references it
});

// packages/links/orders-zones.ts
export const ordersZonesLink = defineLink({
  left: { module: OrdersModule, entity: "deliveryOrder" },
  right: { module: BillingModule, entity: "zone" },
  isList: false,
});
```

**Generated Schema**

Witylogix framework auto-generates link tables (via Prisma or custom migrations):

```prisma
// Auto-generated by db:sync-links
model OrdersCustomersLink {
  id String @id @default(cuid())
  ordersDeliveryOrderId String
  customersCustomerId String
  createdAt DateTime @default(now())

  @@unique([ordersDeliveryOrderId, customersCustomerId])
}

model OrdersItemsProductsLink {
  id String @id @default(cuid())
  ordersOrderItemId String
  productsProductId String
  createdAt DateTime @default(now())

  @@unique([ordersOrderItemId, productsProductId])
}

model OrdersZonesLink {
  id String @id @default(cuid())
  ordersDeliveryOrderId String
  billingZoneId String
  createdAt DateTime @default(now())

  @@unique([ordersDeliveryOrderId, billingZoneId])
}
```

**Querying Across Links**

```typescript
// packages/modules/orders/service.ts
export class OrderService extends WityService {
  async retrieveWithRelations(orderId: string) {
    const order = await this.db.orders.findUnique({
      where: { id: orderId },
      include: {
        // Medusa-style: resolved via link manager
        customerLink: true, // Populated via link table
        itemLinks: true,
        zoneLink: true,
      },
    });

    // Optionally hydrate full customer, items, zone:
    const linkManager = this.container.resolve("linkManager");
    const customer = await linkManager.resolve("orders-customers", order.id);
    const items = await linkManager.resolveList(
      "orders-items-products",
      order.id,
    );
    const zone = await linkManager.resolve("orders-zones", order.id);

    return { order, customer, items, zone };
  }
}
```

**Benefits of Link Tables**

1. **Module isolation** — Orders module doesn't directly depend on Customers schema.
2. **Scalability** — Links can be in a separate database or cache layer.
3. **Multi-tenancy** — With RLS, link tables can be scoped per tenant.
4. **Plugin flexibility** — A plugin can add new links without modifying core modules.
5. **Explicit boundaries** — You see exactly which modules interact.

---

### 1.4 Events & Subscribers: From Ad-Hoc Emissions to Workflow-Driven Events

**Medusa v2 Model**

Events are **emitted as workflow steps**, not from services:

```typescript
// medusa-commerce/packages/workflows/order/create-order.ts
const emitOrderCreatedStep = createStep(
  "emit-order-created",
  async (input, { container }) => {
    const eventBus = container.resolve("eventBus");
    await eventBus.emit("order.created", { orderId: input.order.id });
    return new StepResponse({});
  },
);

// Subscribers are lightweight and delegate to workflows
// medusa-commerce/packages/modules/notification/subscribers/order-created.ts
export const subscribers = [
  {
    event: "order.created",
    handler: async ({ event, container }) => {
      // Don't implement business logic here!
      // Instead, invoke a workflow
      const sendOrderNotificationWorkflow = container.resolve(
        "sendOrderNotificationWorkflow",
      );
      await sendOrderNotificationWorkflow.run({
        input: { orderId: event.data.orderId },
      });
    },
  },
];
```

**Witylogix Today**

```typescript
// packages/core/src/orders/order-manager.ts
export class OrderManager {
  async createOrder(data) {
    const order = await this.db.orders.create({ data });
    // Emit event ad-hoc
    await this.eventBus.emit("order:created", { order });
    return order;
  }
}

// apps/process-manager/src/subscribers/order-created.ts
export const orderCreatedHandler = async (event) => {
  // Business logic buried in subscriber
  const customer = await db.customers.findUnique({
    where: { id: event.order.customerId },
  });
  await sendEmail(customer.email, "Order Confirmed", { order: event.order });
  await db.notifications.create({
    data: { customerId: customer.id, type: "order_created" },
  });
  // What if email fails? What if notification creation fails? No rollback.
};

eventBus.subscribe("order:created", orderCreatedHandler);
```

**Problems**

1. **No transactional guarantees** — Email sends but DB write fails → inconsistent state.
2. **Lost events** — If subscriber crashes, event is lost (no retry).
3. **Hard to trace** — Which subscribers handle which events? Hidden in process manager.
4. **Tangled logic** — Subscribers mix concern (email, DB write, logging).
5. **Brittle** — Changing subscriber means changing event schema.

**Witylogix Changes: Event-Driven Workflows**

```typescript
// packages/workflows/notifications/send-order-notification.ts
import { createWorkflow, createStep } from "@witylogix/framework";

const resolveCustomerStep = createStep(
  "resolve-customer",
  async (input, { container }) => {
    const customerService = container.resolve("customerService");
    const customer = await customerService.retrieve(input.orderId);
    return new StepResponse(customer);
  },
);

const resolveOrderStep = createStep(
  "resolve-order",
  async (input, { container }) => {
    const orderService = container.resolve("orderService");
    const order = await orderService.retrieve(input.orderId);
    return new StepResponse(order);
  },
);

const renderTemplateStep = createStep(
  "render-template",
  async (input, { container }) => {
    const templateEngine = container.resolve("templateEngine");
    const html = await templateEngine.render("order-confirmation", {
      customer: input.customer,
      order: input.order,
    });
    return new StepResponse(html);
  },
);

const sendEmailStep = createStep(
  "send-email",
  async (input, { container }) => {
    const emailService = container.resolve("emailService");
    const result = await emailService.send({
      to: input.customer.email,
      subject: "Your Order Confirmed",
      html: input.html,
    });
    return new StepResponse(result);
  },
  {
    compensate: async (error, input, { container }) => {
      // If later steps fail, we could log that email was sent but order was rejected
      // (Not reversible, but we know the state)
    },
  },
);

const createNotificationRecordStep = createStep(
  "create-notification",
  async (input, { container }) => {
    const notificationService = container.resolve("notificationService");
    await notificationService.create({
      customerId: input.customer.id,
      orderId: input.order.id,
      type: "order_confirmation",
      status: "sent",
      sentAt: new Date(),
    });
    return new StepResponse({});
  },
);

export const sendOrderNotificationWorkflow = createWorkflow(
  "send-order-notification",
  (input: { orderId: string }) => {
    const customer = resolveCustomerStep(input);
    const order = resolveOrderStep(input);
    const html = renderTemplateStep({ customer, order });
    const emailResult = sendEmailStep({ customer, html });
    const notificationCreated = createNotificationRecordStep({
      customer,
      order,
    });
    return { success: true };
  },
);
```

**Subscriber (now lightweight)**

```typescript
// packages/modules/notifications/subscribers/order-created.ts
import { sendOrderNotificationWorkflow } from "@witylogix/workflows/notifications";

export const subscribers = [
  {
    event: "order.created",
    handler: async ({ event, container }) => {
      const workflow = container.resolve("sendOrderNotificationWorkflow");
      try {
        await workflow.run({
          input: { orderId: event.data.orderId },
        });
      } catch (error) {
        // Log the error; the order exists, but notification failed
        // Depending on importance, retry later or alert ops
        container.resolve("logger").error("Failed to send order notification", {
          error,
          orderId: event.data.orderId,
        });
      }
    },
  },
];
```

**Event Registration**

```typescript
// packages/framework/event-bus.ts
export interface EventBusConfig {
  adapter: "local" | "redis"; // Local for dev, Redis for production
  handlers?: Record<string, SubscriberConfig[]>;
}

// packages/framework/index.ts
export const initEventBus = (config: EventBusConfig) => {
  if (config.adapter === "local") {
    return new LocalEventBus(); // In-memory, development
  } else {
    return new RedisEventBus(); // Distributed, production
  }
};
```

**Benefits**

1. **Steps are composable** — Use `resolveCustomerStep` in other workflows.
2. **Compensation per-step** — Email succeeded, but notification creation failed → log it, don't rollback email.
3. **Decoupling** — Services don't emit events. Workflows do. Subscribers invoke workflows.
4. **Retryability** — Subscribers can retry on transient failures (database connection, email service down).
5. **Observability** — Each step is logged (step name, input, output, duration, error).

---

### 1.5 Scheduled Jobs: From External Cron to Framework-Managed Async

**Medusa v2 Model**

```typescript
// medusa-commerce/packages/jobs/sync-inventory.ts
export const syncInventoryJob = {
  name: "sync-inventory",
  description: "Sync inventory with external provider",
  cron: "0 * * * *", // Every hour
  handler: async ({ container }) => {
    const inventoryService = container.resolve("inventoryService");
    const externalAPI = container.resolve("externalInventoryAPI");

    const items = await inventoryService.listAll();
    for (const item of items) {
      const external = await externalAPI.getStock(item.sku);
      if (external.quantity !== item.quantity) {
        await inventoryService.update(item.id, { quantity: external.quantity });
      }
    }
  },
};
```

**Witylogix Today**

```typescript
// apps/process-manager/src/jobs/sync-shopify-inventory.ts
export const syncShopifyInventoryJob = async () => {
  const shopifyClient = new Shopify({ apiKey: process.env.SHOPIFY_API_KEY });
  const items = await db.products.findMany();

  for (const item of items) {
    const shopifyProduct = await shopifyClient.getProduct(item.shopifyId);
    if (shopifyProduct.inventory !== item.quantity) {
      await db.products.update({
        where: { id: item.id },
        data: { quantity: shopifyProduct.inventory },
      });
    }
  }
};

// apps/process-manager/src/scheduler.ts
cron.schedule("0 * * * *", syncShopifyInventoryJob);
```

**Witylogix Changes: Framework-Managed Jobs**

```typescript
// packages/jobs/sync-shopify-inventory.ts
import { createJob } from "@witylogix/framework";

export const syncShopifyInventoryJob = createJob({
  name: "sync-shopify-inventory",
  description: "Sync product inventory from Shopify",
  cron: "0 * * * *", // Every hour
  handler: async ({ container }) => {
    // Call a workflow to encapsulate the sync logic
    const workflow = container.resolve("syncShopifyInventoryWorkflow");
    await workflow.run({ input: {} });
  },
});

// packages/workflows/integrations/sync-shopify-inventory.ts
export const syncShopifyInventoryWorkflow = createWorkflow(
  "sync-shopify-inventory",
  (input: {}) => {
    const items = retrieveAllProductsStep(input);
    const shopifyData = fetchShopifyInventoryStep(items);
    const updated = updateLocalInventoryStep(shopifyData);
    const emitted = emitInventorySyncedStep(updated);
    return { updated };
  },
);
```

**Key Differences**

1. **Jobs are registered with the framework**, not external cron daemons.
2. **Jobs delegate to workflows** — Sync logic is testable and reusable.
3. **Container access** — Jobs can resolve any service or workflow.
4. **Framework manages lifecycle** — Start jobs at app boot, shut down cleanly.
5. **Distributed scheduling** — With Redis-based locking, jobs can run on multiple nodes (one active per cluster).

---

### 1.6 API Routes: From Direct Service Calls to Workflow Invocation

**Medusa v2 Model**

```typescript
// medusa-commerce/apps/admin-api/src/routes/products.ts
export async function POST(req, { container }) {
  const createProductsWorkflow = container.resolve("createProductsWorkflow");
  const { product } = await createProductsWorkflow.run({
    input: { data: req.body },
  });
  return res.status(201).json(product);
}
```

**Witylogix Today**

```typescript
// apps/api/src/routes/orders.ts
import { OrderManager } from "../../../packages/core";

export async function POST(req, res) {
  const orderMgr = new OrderManager(prisma);
  try {
    const order = await orderMgr.createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
```

**Witylogix Changes**

```typescript
// apps/api/src/routes/orders.ts
import { createRoute } from "@witylogix/api";

export const createOrderRoute = createRoute({
  method: "POST",
  path: "/orders",
  handler: async (req, res, { container }) => {
    const createDeliveryOrderWorkflow = container.resolve(
      "createDeliveryOrderWorkflow",
    );
    try {
      const { order } = await createDeliveryOrderWorkflow.run({
        input: { data: req.body },
      });
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
});
```

**Benefits**

1. **Consistent error handling** — Workflows handle compensation; routes just return responses.
2. **Observable** — Each request triggers a named workflow, traceable in logs.
3. **Testable** — Mock the workflow, not the route.
4. **Plugin-friendly** — Routes can be extended or replaced via module system.

---

### 1.7 Plugins: From Vendor Extensions to Composable Packages

**Medusa v2 Model** (v2.3.0+)

```typescript
// @witylogix/plugin-fraud-detection/src/index.ts
export const definePlugin = {
  key: "fraud-detection",
  modules: [
    {
      key: "fraud-detection",
      definition: FraudDetectionModule,
    },
  ],
  workflows: [
    {
      name: "detect-fraud-workflow",
      definition: detectFraudWorkflow,
    },
  ],
  hooks: [
    {
      event: "order.createDeliveryOrderWorkflow.validate-order-data",
      handler: fraudCheckStep,
    },
  ],
  subscribers: [
    {
      event: "order.fraud-detected",
      handler: async ({ event, container }) => {
        const notificationService = container.resolve("notificationService");
        await notificationService.alert({
          reason: "Fraud detected",
          orderId: event.data.orderId,
        });
      },
    },
  ],
  routes: [
    {
      method: "POST",
      path: "/admin/fraud/review/:orderId",
      handler: async (req, res, { container }) => {
        const fraudService = container.resolve("fraudDetectionService");
        const review = await fraudService.getReview(req.params.orderId);
        res.json(review);
      },
    },
  ],
};

// Install via:
// npm install @witylogix/plugin-fraud-detection
// Add to medusa-config.ts plugins array
```

**Witylogix Today**

Plugins don't formally exist. Custom features require forking or monkeypatching.

**Witylogix Changes: Plugin System**

```typescript
// @witylogix/plugin-fraud-detection/src/index.ts
export const definePlugin = {
  key: "fraud-detection",
  version: "1.0.0",

  // 1. Modules: Domain-specific services
  modules: [
    {
      key: "fraud-detection",
      definition: FraudDetectionModule, // MedusaService-based
    },
  ],

  // 2. Workflows: Orchestration logic
  workflows: [
    {
      name: "detect-fraud",
      definition: detectFraudWorkflow,
    },
  ],

  // 3. Hooks: Inject steps into existing workflows
  hooks: [
    {
      event: "order.createDeliveryOrderWorkflow.after:validate-order-data",
      handler: fraudCheckStep, // Runs after validation step
    },
  ],

  // 4. Subscribers: Event handlers (delegate to workflows)
  subscribers: [
    {
      event: "order.fraud-detected",
      handler: async ({ event, container }) => {
        const notificationWorkflow = container.resolve("notificationWorkflow");
        await notificationWorkflow.run({
          input: { orderId: event.data.orderId, reason: "fraud" },
        });
      },
    },
  ],

  // 5. Routes: Admin/API endpoints
  routes: [
    {
      method: "GET",
      path: "/admin/fraud-detection/reviews",
      handler: async (req, res, { container }) => {
        const fraudService = container.resolve("fraudDetectionService");
        const reviews = await fraudService.listPendingReviews();
        res.json(reviews);
      },
    },
  ],

  // 6. Jobs: Scheduled tasks
  jobs: [
    {
      name: "fraud-batch-analysis",
      cron: "0 2 * * *", // 2 AM daily
      handler: async ({ container }) => {
        const workflow = container.resolve("fraudBatchAnalysisWorkflow");
        await workflow.run({ input: {} });
      },
    },
  ],

  // 7. Links: Connect to other modules
  links: [
    {
      left: { module: "orders", entity: "deliveryOrder" },
      right: { module: "fraud-detection", entity: "fraudReview" },
      isList: true,
    },
  ],

  // 8. Lifecycle hooks
  onInit: async ({ container }) => {
    console.log("Fraud detection plugin initializing...");
  },
  onActivate: async ({ container }) => {
    console.log("Fraud detection plugin activated");
  },
  onDeactivate: async ({ container }) => {
    console.log("Fraud detection plugin deactivated");
  },
};

// Installation:
// 1. npm install @witylogix/plugin-fraud-detection
// 2. Add to witylogix-config.ts:
export default {
  plugins: [require("@witylogix/plugin-fraud-detection")],
};
```

**Benefits**

1. **Reusability** — A plugin is a published npm package; others install it.
2. **Non-invasive** — Plugins use hooks to extend workflows, not modify them.
3. **Composable** — Plugins can depend on other plugins.
4. **Marketplace** — Enterprises can browse and install plugins from a registry.
5. **Isolation** — Each plugin is a module with its own lifecycle.

---

## Part 2: Top 10 Delivery Logistics Workflows

These are the core workflows Witylogix would formalize using the workflow engine:

### Workflow 1: `createDeliveryOrderWorkflow`

**Purpose**: End-to-end order creation with validation, inventory, zone assignment, and rate calculation.

**Steps**:

1. `validateDeliveryDataStep` — Check required fields, address validity
2. `checkInventoryStep` — Verify items are in stock
3. `assignZoneStep` — Determine service zone by address
4. `calculateRateStep` — Compute delivery fee
5. `createOrderStep` — Insert order record
6. `emitOrderCreatedStep` — Emit for subscribers (notification, analytics)

**Compensation**: Delete order if later step fails.

**Events Emitted**: `order.created` (orderId, customerId, rate, estimatedDeliveryTime)

**Modules Consumed**: orders, inventory, billing (zones), notifications (indirectly via event)

**Sample Invocation**:

```typescript
const workflow = container.resolve("createDeliveryOrderWorkflow");
const { order } = await workflow.run({
  input: {
    data: {
      customerId: "cust_123",
      items: [{ sku: "WIDGET-A", quantity: 2 }],
      deliveryAddress: "123 Main St, Springfield, IL",
      phoneNumber: "+1-555-1234",
    },
  },
});
```

---

### Workflow 2: `assignDriverWorkflow`

**Purpose**: Match a delivery order to an available driver, optimize route, and send assignment notification.

**Steps**:

1. `findAvailableDriversStep` — Query drivers with capacity in the zone
2. `checkCapacityStep` — Confirm space for order weight/volume
3. `optimizeRouteStep` — Call routing engine (Google Maps, Mapbox) to compute ETAs
4. `selectOptimalDriverStep` — Choose driver minimizing delivery time or distance
5. `assignToDriverStep` — Update order and driver with assignment
6. `notifyDriverStep` — Send assignment details to driver app
7. `emitAssignmentStep` — Emit event for analytics, SMS notification

**Compensation**: Unassign driver if notification fails (rare, but possible).

**Events Emitted**: `driver.assigned`, `notification.assigned-driver-notification`

**Modules Consumed**: orders, drivers, routing, notifications

---

### Workflow 3: `completeDeliveryWorkflow`

**Purpose**: Finalize a delivery with proof-of-delivery, status update, billing, and receipt.

**Steps**:

1. `validateProofOfDeliveryStep` — Check photo, signature, or PIN
2. `updateOrderStatusStep` — Mark order as delivered
3. `recordDeliveryMetricsStep` — Log delivery time, distance, driver notes
4. `triggerBillingStep` — Create invoice line item for this delivery
5. `generateReceiptStep` — Create PDF receipt
6. `sendReceiptStep` — Email or SMS to customer
7. `emitDeliveryCompleteStep` — Emit for analytics, scheduling optimization

**Compensation**: Don't charge customer if receipt send fails (business decision).

**Events Emitted**: `order.completed`, `billing.charge-due`, `customer.delivery-completed-notification`

**Modules Consumed**: orders, billing, notifications, drivers, analytics

---

### Workflow 4: `processSubscriptionWorkflow`

**Purpose**: Manage subscription plan changes (new, upgrade, downgrade, cancel).

**Steps**:

1. `validatePlanStep` — Check plan exists and customer is eligible
2. `validatePaymentMethodStep` — Confirm card or bank account on file
3. `calculateProrationStep` — Compute credits or charges for mid-cycle changes
4. `createOrUpdateSubscriptionStep` — Write subscription record
5. `updateQuotaStep` — Adjust order limits, API rate limits per plan
6. `sendConfirmationStep` — Email with new plan details
7. `emitSubscriptionChangedStep` — Emit for analytics, compliance

**Compensation**: Revert to previous subscription if charge fails.

**Events Emitted**: `subscription.created|upgraded|downgraded|cancelled`, `billing.charge-due`, `usage.quota-updated`

**Modules Consumed**: billing, subscriptions, customers, notifications, compliance

---

### Workflow 5: `optimizeRoutesWorkflow`

**Purpose**: Batch-optimize delivery routes for a set of orders and drivers.

**Steps**:

1. `gatherPendingOrdersStep` — Fetch orders marked "awaiting assignment"
2. `gatherAvailableDriversStep` — Fetch drivers on shift
3. `callRoutingProviderStep` — Send orders + drivers to optimization engine (e.g., Vroom API)
4. `parseOptimizationResultStep` — Extract assignments and stop sequences
5. `assignOrdersToDriversStep` — Bulk update orders with driver assignments
6. `assignStopsToDriversStep` — Create ordered stop records for each driver
7. `notifyDriversStep` — Send updated routes to drivers
8. `emitOptimizationCompleteStep` — Emit for monitoring

**Compensation**: Rollback assignments if notification fails (rare).

**Events Emitted**: `routing.optimized`, `driver.route-updated`, `order.assigned`

**Modules Consumed**: orders, drivers, routing, notifications, analytics

---

### Workflow 6: `handleWebhookWorkflow`

**Purpose**: Process incoming webhooks (Stripe, Shopify, third-party integrations) safely and consistently.

**Steps**:

1. `validateWebhookSignatureStep` — Verify HMAC/JWT to prevent spoofing
2. `parseWebhookPayloadStep` — Deserialize and validate schema
3. `idempotencyCheckStep` — Check if webhook already processed (by idempotency key)
4. `routeToHandlerStep` — Dispatch to event-specific handler (order.paid, refund.created, etc.)
5. `updateLocalStateStep` — Sync external state into Witylogix (mark subscription as active, etc.)
6. `emitEvent` — Emit internal event (e.g., from Stripe `payment_intent.succeeded` → `order.paid`)
7. `recordWebhookStep` — Log webhook for audit trail

**Compensation**: Don't update state if recording fails; let webhook retry.

**Events Emitted**: Dynamically based on webhook type (payment_intent.succeeded → order.paid, etc.)

**Modules Consumed**: webhooks, orders, billing, integrations, audit-log

---

### Workflow 7: `sendNotificationWorkflow`

**Purpose**: Unified notification dispatch (email, SMS, push, webhook) with template rendering and delivery tracking.

**Steps**:

1. `resolveRecipientStep` — Fetch customer contact info, preferences
2. `selectChannelsStep` — Choose appropriate channels (email if preferred, SMS as fallback, etc.)
3. `renderTemplateStep` — Fill in template variables (order #, delivery time, etc.)
4. `sendViaProvidersStep` — Dispatch to email service, Twilio, Firebase Cloud Messaging
5. `trackDeliveryStep` — Create delivery records for each send
6. `handleBouncesStep` — If email bounces immediately, mark as invalid
7. `emitNotificationSentStep` — Emit for analytics, retry logic

**Compensation**: Don't fail the whole workflow if one channel fails (e.g., SMS fails, but email succeeds).

**Events Emitted**: `notification.sent`, `notification.failed`, `customer.email-bounced`

**Modules Consumed**: notifications, customers, templates, analytics

---

### Workflow 8: `runCampaignWorkflow`

**Purpose**: Manage marketing campaigns (build audience, render content, schedule sends, track opens).

**Steps**:

1. `validateCampaignStep` — Check name, content, sender info
2. `buildAudienceStep` — Execute audience query (e.g., "customers in zone X with 3+ orders")
3. `validateContentStep` — Check links, verify unsubscribe footer
4. `scheduleOrSendStep` — If send_at is in future, schedule; otherwise send now
5. `processBatchStep` — Chunk audience into 1000-recipient batches, send in parallel
6. `trackCampaignStep` — Record send counts, errors
7. `emitCampaignCompleteStep` — Emit for dashboards

**Compensation**: If batch send fails, log error and retry; don't roll back earlier batches.

**Events Emitted**: `campaign.sent`, `campaign.failed`, `email.open` (tracked in separate event stream)

**Modules Consumed**: campaigns, notifications, customers, analytics, email-provider

---

### Workflow 9: `syncShopifyOrderWorkflow`

**Purpose**: Mirror Shopify orders into Witylogix as delivery orders (webhook-triggered).

**Steps**:

1. `validateShopifyOrderStep` — Check webhook signature, order integrity
2. `mapShopifyToWityStep` — Transform Shopify line items, addresses to Witylogix format
3. `lookupOrCreateCustomerStep` — Find/create customer from Shopify contact
4. `syncInventoryStep` — Reserve inventory if managed in Witylogix
5. `createWityOrderStep` — Insert delivery order record
6. `updateShopifyMetaStep` — Store Witylogix order ID in Shopify metafield for bidirectional sync
7. `emitOrderSyncedStep` — Emit for dashboard

**Compensation**: Delete Witylogix order if Shopify sync fails (webhook will retry).

**Events Emitted**: `order.synced-from-shopify`, `inventory.reserved`

**Modules Consumed**: orders, integrations (shopify), customers, inventory, webhooks

---

### Workflow 10: `generateInvoiceWorkflow`

**Purpose**: Monthly invoice generation from delivered orders, subscriptions, and usage charges.

**Steps**:

1. `aggregateUsageStep` — Sum delivered orders, API calls, extra fees for the month
2. `calculateChargesStep` — Apply tiering, discounts, taxes
3. `createInvoiceRecordStep` — Write invoice to database
4. `generatePDFStep` — Render invoice template to PDF
5. `uploadToStorageStep` — Store PDF in S3/cloud storage
6. `sendInvoiceEmailStep` — Email PDF to customer with payment instructions
7. `recordBillingEventStep` — Log invoice for accounting system
8. `emitInvoiceGeneratedStep` — Emit for integrations (Zapier, accounting sync)

**Compensation**: Don't charge customer if PDF generation fails; retry later.

**Events Emitted**: `invoice.generated`, `billing.invoice-sent`, `accounting.invoice-created`

**Modules Consumed**: billing, orders, subscriptions, usage, notifications, accounting-integrations

---

## Part 3: Witylogix File Structure After Adoption

```
witylogix-platform/
├── packages/
│   ├── framework/                  # NEW: Witylogix framework (orchestration)
│   │   ├── src/
│   │   │   ├── workflow-engine.ts
│   │   │   ├── container.ts
│   │   │   ├── event-bus.ts
│   │   │   ├── link-manager.ts
│   │   │   ├── job-scheduler.ts
│   │   │   ├── service-base.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── modules/                    # REFACTORED: Module per domain
│   │   ├── orders/
│   │   │   ├── src/
│   │   │   │   ├── models/         # (Keep Prisma, but marked as "orders module models")
│   │   │   │   ├── service.ts      # OrderService extends WityService
│   │   │   │   ├── subscribers.ts
│   │   │   │   ├── index.ts        # Module definition + linkable
│   │   │   │   └── types.ts
│   │   │   ├── __tests__/
│   │   │   └── package.json
│   │   │
│   │   ├── billing/
│   │   │   ├── src/
│   │   │   │   ├── models/
│   │   │   │   ├── service.ts      # BillingService, ZoneService
│   │   │   │   ├── subscribers.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── types.ts
│   │   │   ├── __tests__/
│   │   │   └── package.json
│   │   │
│   │   ├── drivers/
│   │   │   ├── src/
│   │   │   │   ├── models/
│   │   │   │   ├── service.ts      # DriverService
│   │   │   │   ├── subscribers.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── types.ts
│   │   │   ├── __tests__/
│   │   │   └── package.json
│   │   │
│   │   ├── routing/
│   │   ├── notifications/
│   │   ├── customers/
│   │   ├── inventory/
│   │   ├── subscriptions/
│   │   ├── integrations/
│   │   ├── webhooks/
│   │   └── analytics/
│   │
│   ├── workflows/                  # NEW: All workflow definitions
│   │   ├── orders/
│   │   │   ├── create-delivery-order.ts
│   │   │   ├── complete-delivery.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── drivers/
│   │   │   ├── assign-driver.ts
│   │   │   ├── optimize-routes.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── billing/
│   │   │   ├── process-subscription.ts
│   │   │   ├── generate-invoice.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── send-notification.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── integrations/
│   │   │   ├── sync-shopify-order.ts
│   │   │   ├── handle-webhook.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── campaigns/
│   │   │   ├── run-campaign.ts
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts (re-export all workflows)
│   │
│   ├── links/                      # NEW: Module links (replaces cross-module Prisma relations)
│   │   ├── orders-customers.ts
│   │   ├── orders-zones.ts
│   │   ├── orders-items-products.ts
│   │   ├── drivers-zones.ts
│   │   ├── subscriptions-customers.ts
│   │   └── index.ts
│   │
│   ├── jobs/                       # NEW: Scheduled tasks
│   │   ├── sync-shopify-inventory.ts
│   │   ├── optimize-routes-batch.ts
│   │   ├── generate-monthly-invoices.ts
│   │   ├── fraud-batch-analysis.ts
│   │   └── index.ts
│   │
│   ├── db/                         # Prisma (shared, but logically partitioned)
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   │
│   ├── api/                        # API framework helpers
│   │   ├── src/
│   │   │   ├── route-helpers.ts
│   │   │   ├── middleware.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── common/                     # Shared utilities
│       ├── src/
│       │   ├── logger.ts
│       │   ├── errors.ts
│       │   ├── types.ts
│       │   └── index.ts
│       └── package.json
│
├── apps/
│   ├── api/                        # Fastify HTTP server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── orders.ts       # Calls workflows
│   │   │   │   ├── drivers.ts
│   │   │   │   ├── billing.ts
│   │   │   │   ├── webhooks.ts
│   │   │   │   └── health.ts
│   │   │   ├── middleware/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── process-manager/            # SIMPLIFIED: Runs jobs, receives webhooks
│   │   ├── src/
│   │   │   ├── jobs/               # Job entrypoints (delegate to frameworks jobs)
│   │   │   ├── webhooks/           # Webhook receivers (delegate to workflows)
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── dashboard/                  # Next.js admin UI
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── package.json
│   │
│   └── mobile/                     # React Native driver app
│       ├── src/
│       ├── __tests__/
│       └── package.json
│
├── plugins/                        # Community/enterprise plugins
│   ├── plugin-fraud-detection/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   ├── workflows/
│   │   │   ├── hooks.ts
│   │   │   ├── subscribers.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── plugin-shopify-sync/
│   └── plugin-custom-analytics/
│
├── docs/
│   ├── adr/
│   │   ├── ADR-001-architecture.md
│   │   ├── ADR-009-medusa-inspired-evolution.md
│   │   └── ...
│   ├── api-docs/
│   ├── workflows/
│   └── modules/
│
├── witylogix-config.ts             # NEW: Configuration file
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

**Key Points on Structure**

1. **`packages/framework/`** — The core orchestration engine. Thin, focused, no business logic.
2. **`packages/modules/`** — Each module is independently deployable. Services extend `WityService`, declare `linkable` entities.
3. **`packages/workflows/`** — Pure orchestration logic, separated from business logic.
4. **`packages/links/`** — Explicit module relationships, auto-generated link tables.
5. **`packages/jobs/`** — Scheduled tasks that delegate to workflows.
6. **`apps/api/`** — Fastify routes that invoke workflows via container.
7. **`apps/process-manager/`** — Simplified to job runner + webhook receiver (no business logic).
8. **`plugins/`** — Reusable compositions (module + workflows + hooks).
9. **`witylogix-config.ts`** — Single source of truth for modules, plugins, database, event bus config.

---

## Part 4: Migration Strategy — Converting `billing` Module

Here's the exact path to migrate the billing module from current to new architecture:

### Current State

```typescript
// packages/core/src/billing/subscription-manager.ts
import { PrismaClient } from "@prisma/client";

export class SubscriptionManager {
  constructor(private db: PrismaClient) {}

  async createSubscription(data: {
    customerId: string;
    planId: string;
    startDate: Date;
  }) {
    // Validate plan
    const plan = await this.db.subscriptionPlan.findUnique({
      where: { id: data.planId },
    });
    if (!plan) throw new Error("Plan not found");

    // Create subscription
    const sub = await this.db.subscription.create({
      data: {
        customerId: data.customerId,
        planId: data.planId,
        status: "active",
        startDate: data.startDate,
      },
    });

    // Emit event
    await eventBus.emit("subscription:created", { subscription: sub });

    return sub;
  }

  async upgradeSubscription(subscriptionId: string, newPlanId: string) {
    const sub = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new Error("Subscription not found");

    const newPlan = await this.db.subscriptionPlan.findUnique({
      where: { id: newPlanId },
    });
    if (!newPlan) throw new Error("New plan not found");

    // Calculate proration
    const proratedCredit = calculateProration(
      sub.plan.price,
      newPlan.price,
      sub.currentBillingCycle,
    );

    // Update subscription
    const updated = await this.db.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlanId,
        proratedCredit,
        status: "active",
      },
    });

    // Emit event
    await eventBus.emit("subscription:upgraded", {
      subscription: updated,
      credit: proratedCredit,
    });

    return updated;
  }
}

// apps/api/src/routes/billing-subscriptions.ts
import { SubscriptionManager } from "../../../packages/core";

export async function POST(req, res) {
  const subMgr = new SubscriptionManager(prisma);
  try {
    const sub = await subMgr.createSubscription(req.body);
    res.status(201).json(sub);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function PATCH(req, res) {
  const subMgr = new SubscriptionManager(prisma);
  try {
    const sub = await subMgr.upgradeSubscription(
      req.body.subscriptionId,
      req.body.newPlanId,
    );
    res.status(200).json(sub);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
```

### Step 1: Extract Service to Module

Create `packages/modules/billing/service.ts` with container support:

```typescript
// packages/modules/billing/service.ts
import { WityService } from "@witylogix/framework";

export class BillingService extends WityService {
  async createSubscription(data: {
    customerId: string;
    planId: string;
    startDate: Date;
  }) {
    // Validate plan
    const plan = await this.db.subscriptionPlan.findUnique({
      where: { id: data.planId },
    });
    if (!plan) throw new Error("Plan not found");

    // Create subscription
    const sub = await this.db.subscription.create({
      data: {
        customerId: data.customerId,
        planId: data.planId,
        status: "active",
        startDate: data.startDate,
      },
    });

    // NOTE: DON'T emit event here. Emit in workflow.
    return sub;
  }

  async upgradeSubscription(subscriptionId: string, newPlanId: string) {
    const sub = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new Error("Subscription not found");

    const newPlan = await this.db.subscriptionPlan.findUnique({
      where: { id: newPlanId },
    });
    if (!newPlan) throw new Error("New plan not found");

    const proratedCredit = calculateProration(
      sub.plan.price,
      newPlan.price,
      sub.currentBillingCycle,
    );

    const updated = await this.db.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: newPlanId,
        proratedCredit,
        status: "active",
      },
    });

    return updated;
  }
}

// packages/modules/billing/index.ts
export const defineModule = {
  key: "billing",
  registrations: [
    {
      name: "billingService",
      definition: BillingService,
    },
  ],
  linkable: {
    subscription: { resourceId: "id" },
    subscriptionPlan: { resourceId: "id" },
    zone: { resourceId: "id" },
    invoice: { resourceId: "id" },
  },
};
```

### Step 2: Create Workflows

```typescript
// packages/workflows/billing/process-subscription.ts
import { createWorkflow, createStep } from "@witylogix/framework";

const validatePlanStep = createStep(
  "validate-plan",
  async (input, { container }) => {
    const db = container.resolve("db");
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: input.planId },
    });
    if (!plan) throw new Error("Plan not found");
    return new StepResponse(plan);
  },
);

const validatePaymentMethodStep = createStep(
  "validate-payment-method",
  async (input, { container }) => {
    const customerService = container.resolve("customerService");
    const customer = await customerService.retrieve(input.customerId);
    if (!customer.paymentMethodId) throw new Error("No payment method on file");
    return new StepResponse(customer.paymentMethodId);
  },
);

const createSubscriptionStep = createStep(
  "create-subscription",
  async (input, { container }) => {
    const billingService = container.resolve("billingService");
    const sub = await billingService.createSubscription({
      customerId: input.customerId,
      planId: input.plan.id,
      startDate: new Date(),
    });
    return new StepResponse(sub);
  },
  {
    compensate: async (error, input, { container }) => {
      const billingService = container.resolve("billingService");
      if (input.sub?.id) {
        await billingService.delete(input.sub.id);
      }
    },
  },
);

const updateQuotaStep = createStep(
  "update-quota",
  async (input, { container }) => {
    const db = container.resolve("db");
    await db.customer.update({
      where: { id: input.customerId },
      data: {
        orderQuota: input.plan.monthlyOrderLimit,
        apiRateLimit: input.plan.apiCallsPerMonth,
      },
    });
    return new StepResponse({});
  },
);

const sendConfirmationStep = createStep(
  "send-confirmation",
  async (input, { container }) => {
    const notificationWorkflow = container.resolve("sendNotificationWorkflow");
    await notificationWorkflow.run({
      input: {
        customerId: input.customerId,
        type: "subscription_created",
        data: { planName: input.plan.name, price: input.plan.price },
      },
    });
    return new StepResponse({});
  },
);

const emitSubscriptionCreatedStep = createStep(
  "emit-subscription-created",
  async (input, { container }) => {
    const eventBus = container.resolve("eventBus");
    await eventBus.emit("subscription.created", {
      subscriptionId: input.sub.id,
      customerId: input.customerId,
      planId: input.plan.id,
    });
    return new StepResponse({});
  },
);

export const processSubscriptionWorkflow = createWorkflow(
  "process-subscription",
  (input: { customerId: string; planId: string }) => {
    const plan = validatePlanStep(input);
    const paymentMethod = validatePaymentMethodStep(input);
    const sub = createSubscriptionStep({ ...input, plan });
    const quotaUpdated = updateQuotaStep({
      customerId: input.customerId,
      plan,
    });
    const confirmationSent = sendConfirmationStep(input);
    const emitted = emitSubscriptionCreatedStep({ ...input, sub, plan });
    return { sub };
  },
);
```

### Step 3: Update API Routes

```typescript
// apps/api/src/routes/billing-subscriptions.ts
export async function POST(req, res, { container }) {
  const processSubscriptionWorkflow = container.resolve(
    "processSubscriptionWorkflow",
  );
  try {
    const { sub } = await processSubscriptionWorkflow.run({
      input: {
        customerId: req.body.customerId,
        planId: req.body.planId,
      },
    });
    res.status(201).json(sub);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function PATCH(req, res, { container }) {
  const upgradeSubscriptionWorkflow = container.resolve(
    "upgradeSubscriptionWorkflow",
  );
  try {
    const { sub } = await upgradeSubscriptionWorkflow.run({
      input: {
        subscriptionId: req.body.subscriptionId,
        newPlanId: req.body.newPlanId,
      },
    });
    res.status(200).json(sub);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
```

### Step 4: Create Links

```typescript
// packages/links/billing-customers.ts
import { defineLink } from "@witylogix/framework";

export const billingCustomersLink = defineLink({
  left: { module: "billing", entity: "subscription" },
  right: { module: "customers", entity: "customer" },
  isList: true, // A customer can have multiple subscriptions (enterprise tiers)
  onDelete: "cascade", // Delete subscriptions if customer deleted
});
```

### Step 5: Add Event Emission via Workflows

Events are now emitted in `emitSubscriptionCreatedStep` and other steps within workflows. Subscribers react:

```typescript
// packages/modules/notifications/subscribers/subscription-created.ts
export const subscribers = [
  {
    event: "subscription.created",
    handler: async ({ event, container }) => {
      // Don't send email directly. Invoke workflow.
      const sendNotificationWorkflow = container.resolve(
        "sendNotificationWorkflow",
      );
      try {
        await sendNotificationWorkflow.run({
          input: {
            customerId: event.data.customerId,
            type: "subscription_confirmation",
            data: event.data,
          },
        });
      } catch (error) {
        container
          .resolve("logger")
          .error("Failed to send subscription confirmation", { error });
      }
    },
  },
];
```

### Step 6: Test Module Isolation

Create integration tests that verify:

```typescript
// packages/modules/billing/__tests__/billing-service.test.ts
describe("BillingService", () => {
  it("should create subscription without emitting event", async () => {
    const billingService = container.resolve("billingService");
    const sub = await billingService.createSubscription({
      customerId: "cust_123",
      planId: "plan_pro",
      startDate: new Date(),
    });
    expect(sub.id).toBeDefined();
    // Event is NOT emitted here; it's emitted by workflow
  });
});

// packages/workflows/billing/__tests__/process-subscription-workflow.test.ts
describe("processSubscriptionWorkflow", () => {
  it("should create subscription and emit event", async () => {
    const workflow = container.resolve("processSubscriptionWorkflow");
    const { sub } = await workflow.run({
      input: { customerId: "cust_123", planId: "plan_pro" },
    });
    expect(sub.id).toBeDefined();
    expect(eventBus.emitted).toContainEqual({
      event: "subscription.created",
      data: expect.objectContaining({ subscriptionId: sub.id }),
    });
  });

  it("should rollback if quota update fails", async () => {
    // Mock updateQuotaStep to fail
    const workflow = container.resolve("processSubscriptionWorkflow");
    await expect(
      workflow.run({ input: { customerId: "cust_123", planId: "plan_pro" } }),
    ).rejects.toThrow();
    // Subscription should be deleted (compensate)
  });
});
```

### Summary of Migration

| Aspect                 | Before                           | After                                         |
| ---------------------- | -------------------------------- | --------------------------------------------- |
| **Service location**   | `packages/core/src/billing/`     | `packages/modules/billing/src/`               |
| **Service method**     | Direct Prisma, emit event ad-hoc | Extends WityService, no event emission        |
| **Orchestration**      | Tangled in service method        | Dedicated workflow with steps                 |
| **Rollback**           | Manual try-catch                 | Automatic per-step compensation               |
| **Event emission**     | In service method                | In workflow step                              |
| **Cross-module calls** | Direct imports                   | Via container (DI) or workflows               |
| **Relationships**      | Prisma FK relations              | Link tables                                   |
| **Testing**            | Integration tests                | Unit tests (service) + integration (workflow) |
| **Routes**             | Call service directly            | Call workflow via container                   |

---

## Part 5: Conscious Differences from Medusa — What We Keep Different

### Decision 1: Prisma Over DML/MikroORM

**Medusa v2 chose**: Custom Data Model Language (DML) → MikroORM → auto-migration

**Witylogix chooses**: Prisma schema → manual migrations

**Why We're Right**:

1. **Team expertise** — Witylogix team knows Prisma deeply. MikroORM has a learning curve.
2. **Schema-as-code** — Prisma's `.prisma` files are more readable and version-control friendly than DML.
3. **Ecosystem** — Prisma has better tooling (Studio, migrations, type generation).
4. **Shared schema for now** — We don't yet need per-module databases. Prisma works fine with a shared schema.
5. **Lock-in prevention** — Prisma is more portable than Medusa's custom DML.

**When we'd reconsider**: If we scale to 50+ engineers and need per-module database isolation (microservices), we'd evaluate Postgres per module + event sourcing, not necessarily MikroORM.

---

### Decision 2: Fastify Over Express

**Medusa v2 uses**: Express (for compatibility and wide adoption)

**Witylogix uses**: Fastify

**Why We're Right**:

1. **Performance** — Fastify is 2-3x faster than Express at scale (important for last-mile logistics with high throughput).
2. **Type safety** — Fastify has better TypeScript support out-of-the-box.
3. **Native streaming** — Fastify supports streaming responses natively (useful for file downloads, real-time updates).
4. **Validation** — Fastify's built-in JSON schema validation reduces middleware bloat.

**No plan to change**: Fastify is a great choice for an order management system handling thousands of requests per second.

---

### Decision 3: Shared Prisma Schema vs. Per-Module Database

**Medusa v2 enforces**: Each module has its own database (logical or physical).

**Witylogix does now**: Single Postgres, shared Prisma schema with module-level namespacing.

**When we'd change**: At 10+ modules and 50+ tables per module, schema conflicts and deployment pain become real. We'd then:

1. Split into logical databases (e.g., `witylogix_orders`, `witylogix_billing`, `witylogix_routing`) sharing one Postgres instance.
2. Use view-based joins for cross-module queries.
3. Enforce no cross-module foreign keys (links only).

**For now, this approach**: Keeps deployment simple, maintains transaction consistency within a module, and avoids distributed transaction complexity.

---

### Decision 4: RLS Multi-Tenancy vs. Module Isolation

**Medusa v2 approach**: Modules are isolated; multi-tenancy is a separate concern (not built-in).

**Witylogix approach**: Multi-tenancy via Postgres Row-Level Security (RLS), integrated into all queries.

**Why our approach is better for SaaS**:

1. **Tenant isolation at database level** — No bug can leak tenant A's data to tenant B.
2. **Simplified workflows** — We don't pass tenantId everywhere; it's in the JWT and automatically scoped by RLS.
3. **Audit trail** — Every row has a tenantId, making billing and compliance audits trivial.

**Example**:

```sql
-- Postgres policy: Users can only see their own tenant's orders
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Node code:
const order = await db.orders.findUnique({
  where: { id: "order_123" },
  // RLS automatically filters: only visible if tenant_id matches JWT's tenant
});
```

**Medusa would require** explicit tenantId checks in every service method. We bake it into the database layer.

---

### Decision 5: Next.js Dashboard vs. Medusa Admin

**Medusa v2 provides**: Medusa Admin (React + TypeScript, extensive commerce UI)

**Witylogix uses**: Custom Next.js dashboard

**Why our approach is right**:

1. **Delivery-specific workflows** — Medusa Admin is built for e-commerce (products, inventory, orders). We need driver management, route optimization, zone assignment.
2. **Enterprise customization** — Enterprises building on Witylogix need to customize the dashboard. Next.js is more flexible than Medusa Admin's theme system.
3. **Team capacity** — We have stronger Next.js expertise than React component libraries.

**What we'd adopt from Medusa**: Admin authentication patterns (JWT + scopes), permission model (roles + permissions).

---

### Decision 6: Node 18+ (Not Mandatory Node 20)

**Medusa v2 requires**: Node 20+ (ESM, native fetch, better async/await optimization)

**Witylogix supports**: Node 18+

**Why**: Our infrastructure runs Node 18; upgrading to 20 across all environments takes 3-6 months. No urgent reason to mandate 20 now.

**When we'd upgrade**: When Node 22 LTS comes out (April 2025), we'll plan a major release upgrade.

---

### Decision 7: Events Don't Require Redis (Local + Optional Redis)

**Medusa v2 provides**: Local event bus (dev), Redis event bus (prod)

**Witylogix approach**: Same, but with a twist. For single-node deployments (small customers), we support in-memory event bus. For distributed setups, Redis.

```typescript
// witylogix-config.ts
export default {
  eventBus: {
    adapter: process.env.NODE_ENV === "production" ? "redis" : "local",
    redis: process.env.REDIS_URL, // Only if adapter === "redis"
  },
};
```

**Advantage**: Small customers can self-host without Redis. Larger enterprises use Redis + replicated Postgres.

---

## Part 6: Implementation Roadmap

### Phase 1: Foundation (Q2 2026 — 8 weeks)

**Goals**: Framework + 2 core workflows

**Tasks**:

1. Build `packages/framework/` with:
   - Lightweight DI container
   - Workflow engine + step runner
   - Event bus (local + Redis adapters)
   - Link manager

2. Create `packages/modules/orders/` and `packages/modules/drivers/` with service refactoring

3. Implement 2 workflows:
   - `createDeliveryOrderWorkflow`
   - `completeDeliveryWorkflow`

4. Update `apps/api/` routes to call workflows

5. Write framework documentation and workflow SDK docs

**Deliverables**:

- 500+ lines of framework code
- 2 workflows with 8+ steps each
- 20+ unit tests, 10+ integration tests
- Migration guide for developers

---

### Phase 2: Module Migration (Q3 2026 — 12 weeks)

**Goals**: Refactor 5+ modules, implement 5 workflows

**Tasks**:

1. Migrate modules: `billing`, `routing`, `notifications`, `customers`, `integrations`

2. Create links: orders-customers, orders-zones, orders-items-products, etc.

3. Implement workflows:
   - `assignDriverWorkflow`
   - `processSubscriptionWorkflow`
   - `optimizeRoutesWorkflow`
   - `sendNotificationWorkflow`
   - `handleWebhookWorkflow`

4. Build link manager with `db:sync-links` command

5. Implement Redis-backed event bus for multi-node setups

**Deliverables**:

- 5 modules fully migrated
- 5 workflows with compensation
- Link tables auto-generated and tested
- Event bus production-ready

---

### Phase 3: Full Isolation & Plugins (Q4 2026 — 12 weeks)

**Goals**: All modules refactored, plugin system live, 10+ workflows

**Tasks**:

1. Migrate remaining modules: `webhooks`, `analytics`, `subscriptions`, `audit`, `compliance`

2. Implement remaining workflows:
   - `runCampaignWorkflow`
   - `syncShopifyOrderWorkflow`
   - `generateInvoiceWorkflow`
   - - 2 custom workflows per major customer

3. Build plugin system:
   - `definePlugin` macro
   - Plugin discovery (auto-load from `plugins/`)
   - Hook injection
   - Plugin testing framework

4. Create plugin template and publish to npm under `@witylogix/plugin-*`

5. Build plugin marketplace UI (curated list of community plugins)

**Deliverables**:

- All 11 modules isolated + tested
- 10+ workflows (reusable, compensatable)
- Plugin system + 3 example plugins
- Plugin marketplace (beta)
- 5000+ lines of documentation

---

### Phase 4: Enterprise Scale (2027 — ongoing)

**Goals**: RLS multi-tenancy, auto-scaling jobs, enterprise plugins

**Tasks**:

1. Implement RLS policies for multi-tenant isolation

2. Build job scheduler with Redis/Bull for distributed task queue

3. Create observability: structured logging, workflow tracing, metrics

4. Support plugin marketplace: review, publish, monetize

5. Build workflow editor UI (visual workflow builder)

**Deliverables**:

- 10+ enterprise plugins (fraud, compliance, advanced routing)
- Workflow editor (drag-and-drop)
- SLA monitoring + incident alerting
- Plugin revenue share model (licensing)

---

## Part 7: Success Criteria & Metrics

### Code Metrics

1. **Test coverage** → 85%+ (modules), 75%+ (workflows) by Q4 2026
2. **Cyclomatic complexity** → Avg 3 per function (easier to test)
3. **Type safety** → 0 `any` types in production code
4. **Module dependency graph** → Acyclic (no circular imports)

### Business Metrics

1. **Onboarding time** → Reduce from 6 weeks to 2 weeks for new enterprise customer
2. **Custom feature delivery** → From 3 months to 2 weeks (plugin-based customization)
3. **Deployment frequency** → From 1x/week to 2x/day (better isolation → safer releases)
4. **Incident mean-time-to-recovery** → From 30 min to 5 min (workflow rollback vs. manual cleanup)

### Developer Metrics

1. **Cognitive load** → 40% reduction (workflows are easier to reason about than tangled services)
2. **Onboarding time** → New engineer productive in 1 week (vs. 3 weeks today)
3. **Code review time** → 20% reduction (modules are independently reviewable)

---

## Conclusion

This ADR lays out a multi-year evolution of Witylogix's architecture, deeply informed by Medusa v2's proven patterns. We're not adopting Medusa wholesale, but rather using its solutions to solve delivery logistics problems.

**The core insight**: Workflow-driven architecture (not microservices) allows us to:

- Scale to thousands of concurrent deliveries
- Add custom features without forking
- Test thoroughly via compensation/rollback
- Integrate with external systems via plugins
- Remain maintainable as we grow to 50+ engineers

**Next steps**:

1. Review this ADR with the founding team
2. Approve Phase 1 roadmap + budget
3. Hire 2-3 framework engineers
4. Begin implementation in Q2 2026
5. Publish progress & learning publicly (dev.witylogix.com/blog)

Over 18 months, we position Witylogix as the "Medusa for delivery logistics" — the platform every enterprise logistics company standardizes on.

---

**Document Version**: 1.0
**Last Updated**: 2026-03-07
**Author**: Arjun (CTO)
**Status**: Proposed → Ready for Review
