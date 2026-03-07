/**
 * Example: Event-Driven Notification Trigger System
 *
 * This file demonstrates how to use the event bus and trigger engine
 * in real-world scenarios.
 *
 * IMPORTANT: This is an example file for documentation purposes.
 * It is not imported or executed during normal operation.
 */

import {
  eventBus,
  triggerEngine,
  TriggerEvent,
  EventPayload,
  TriggerRule,
  type RuleLoader,
  type NotificationQueueHandler,
  NotificationQueueItem,
} from "./index.js";

import {
  buildShipmentVars,
  buildOrderVars,
  buildDriverVars,
  buildPaymentVars,
} from "./template-vars.js";

// ───────────────────────────────────────────────────────────────────
// EXAMPLE 1: Basic Setup with Custom Rule Loader
// ───────────────────────────────────────────────────────────────────

/**
 * Mock database implementation for loading trigger rules.
 * In production, this would query a real database.
 */
const mockRuleLoader: RuleLoader = async (shopId, event) => {
  // Simulate database query
  const allRules: Record<string, TriggerRule[]> = {
    shop_123: [
      {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl_delivery_confirmation",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [
          {
            field: "shipment.zone",
            operator: "eq",
            value: "north_zone_1",
          },
        ],
        delay: 0,
        isActive: true,
      },
      {
        id: "rule_002",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_FAILED,
        templateId: "tmpl_delivery_failed",
        channel: "SMS",
        recipientType: "customer",
        delay: 300, // 5 minutes
        isActive: true,
      },
      {
        id: "rule_003",
        shopId: "shop_123",
        event: TriggerEvent.DRIVER_ASSIGNED,
        templateId: "tmpl_driver_notification",
        channel: "WHATSAPP",
        recipientType: "driver",
        isActive: true,
      },
    ],
  };

  const rules = allRules[shopId] || [];
  if (event) {
    return rules.filter((r) => r.event === event);
  }
  return rules;
};

/**
 * Mock notification queue implementation.
 * In production, this would queue to a message broker (Bull, RabbitMQ, etc).
 */
const mockNotificationQueue: NotificationQueueHandler = async (item) => {
  console.log(`[Queue] Notification queued:`, {
    ruleId: item.ruleId,
    templateId: item.templateId,
    channel: item.channel,
    recipient: item.recipient,
    delay: item.delay,
    templateVars: item.templateVars,
  });

  // In production:
  // - Create a job in Bull/Redis with delay
  // - Or publish to RabbitMQ with scheduled delivery
  // - Or add to database queue table
};

/**
 * Create engine with custom dependencies.
 * This is typically done once at application startup.
 */
function setupTriggerEngine() {
  // Re-create the trigger engine with our custom implementations
  const newEngine = new (triggerEngine as any).constructor(
    eventBus,
    mockRuleLoader,
    mockNotificationQueue,
  );

  // In production, you'd export this as the singleton
  return newEngine;
}

// ───────────────────────────────────────────────────────────────────
// EXAMPLE 2: Emitting Shipment Delivered Event
// ───────────────────────────────────────────────────────────────────

async function exampleShipmentDelivered() {
  const engine = setupTriggerEngine();

  const payload: EventPayload = {
    shopId: "shop_123",
    shipmentId: "ship_001",
    trackingNumber: "1Z999AA10123456784",
    customerId: "cust_456",
    customerEmail: "john@example.com",
    customerName: "John Doe",
    zone: "north_zone_1",
    deliveredAt: new Date(),
    driverId: "drv_789",
    driverName: "Alice Smith",
    deliveryNotes: "Left at front door",
  };

  console.log(
    "\n=== Example 1: Shipment Delivered Event ===\n",
  );

  // Emit the event
  // The trigger engine automatically:
  // - Loads rules for shop_123
  // - Finds rule_001 (SHIPMENT_DELIVERED)
  // - Evaluates condition (zone === "north_zone_1") ✓
  // - Resolves recipient: customerEmail = "john@example.com"
  // - Builds template variables (tracking number, delivered at, etc.)
  // - Queues notification to send via EMAIL template
  await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, payload);

  console.log("Event emitted successfully!");
}

// ───────────────────────────────────────────────────────────────────
// EXAMPLE 3: Emitting Delivery Failed Event with Delay
// ───────────────────────────────────────────────────────────────────

async function exampleDeliveryFailed() {
  const engine = setupTriggerEngine();

  const payload: EventPayload = {
    shopId: "shop_123",
    shipmentId: "ship_002",
    trackingNumber: "1Z999AA10987654321",
    customerId: "cust_789",
    customerEmail: "jane@example.com",
    customerName: "Jane Smith",
    zone: "south_zone_2",
    attemptedAt: new Date(),
    driverId: "drv_456",
    deliveryNotes: "Building locked, will retry",
  };

  console.log(
    "\n=== Example 2: Delivery Failed Event (with 5 min delay) ===\n",
  );

  // Emit delivery failed event
  // The trigger engine:
  // - Loads rules for shop_123
  // - Finds rule_002 (SHIPMENT_FAILED)
  // - No conditions, so always matches
  // - Resolves recipient: customerId = "cust_789"
  // - Builds template variables
  // - Queues notification with 300s delay (will send after 5 minutes)
  await eventBus.emit(TriggerEvent.SHIPMENT_FAILED, payload);

  console.log("Event emitted successfully!");
}

// ───────────────────────────────────────────────────────────────────
// EXAMPLE 4: Emitting Driver Assigned Event
// ───────────────────────────────────────────────────────────────────

async function exampleDriverAssigned() {
  const engine = setupTriggerEngine();

  const payload: EventPayload = {
    shopId: "shop_123",
    shipmentId: "ship_003",
    trackingNumber: "1Z999AA11234567890",
    driverId: "drv_789",
    driverPhone: "+1-555-123-4567",
    driverEmail: "alice@example.com",
    driverName: "Alice Smith",
    vehicleNumber: "ABC-1234",
    vehicleType: "delivery_van",
    zone: "north_zone_1",
    assignedAt: new Date(),
  };

  console.log(
    "\n=== Example 3: Driver Assigned Event ===\n",
  );

  // Emit driver assigned event
  // The trigger engine:
  // - Loads rules for shop_123
  // - Finds rule_003 (DRIVER_ASSIGNED)
  // - Evaluates conditions (none, so always matches)
  // - Resolves recipient: driverPhone = "+1-555-123-4567"
  // - Queues notification via WHATSAPP to driver
  await eventBus.emit(TriggerEvent.DRIVER_ASSIGNED, payload);

  console.log("Event emitted successfully!");
}

// ───────────────────────────────────────────────────────────────────
// EXAMPLE 5: Template Variable Building
// ───────────────────────────────────────────────────────────────────

function exampleTemplateVariables() {
  console.log(
    "\n=== Example 4: Template Variable Building ===\n",
  );

  // Build shipment variables
  const shipmentVars = buildShipmentVars({
    id: "ship_001",
    trackingNumber: "1Z999AA10123456784",
    zone: "north_zone_1",
    weight: { kg: 2.5, lbs: 5.5 },
    dimensions: { length: 20, width: 15, height: 10 },
    pickupAddress: {
      street: "123 Main St",
      city: "New York",
      state: "NY",
      postalCode: "10001",
    },
    deliveryAddress: {
      street: "456 Park Ave",
      city: "Boston",
      state: "MA",
      postalCode: "02101",
    },
    status: "delivered",
    createdAt: "2024-03-06T10:30:00Z",
    deliveryNotes: "Left at front door",
  });

  console.log("Shipment Variables:");
  console.log(shipmentVars);

  // Build order variables
  const orderVars = buildOrderVars({
    id: "ord_456",
    orderNumber: "ORD-2024-001234",
    customerId: "cust_456",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    subtotal: 99.99,
    shippingCost: 10.0,
    tax: 8.8,
    total: 118.79,
    currency: "USD",
    items: [
      { name: "Wireless Headphones", quantity: 1 },
      { name: "USB-C Cable", quantity: 2 },
    ],
    status: "confirmed",
    createdAt: "2024-03-06T10:15:00Z",
  });

  console.log("\nOrder Variables:");
  console.log(orderVars);

  // Build driver variables
  const driverVars = buildDriverVars({
    id: "drv_789",
    name: "Alice Smith",
    phone: "+1-555-123-4567",
    email: "alice@example.com",
    vehicleNumber: "ABC-1234",
    vehicleType: "delivery_van",
    zone: "north_zone_1",
    rating: 4.8,
    deliveriesCompleted: 156,
    onTimePercentage: 94.5,
    status: "active",
  });

  console.log("\nDriver Variables:");
  console.log(driverVars);

  // Build payment variables
  const paymentVars = buildPaymentVars({
    id: "pay_101112",
    amount: 118.79,
    currency: "USD",
    method: "credit_card",
    cardLastFour: "4242",
    cardBrand: "Visa",
    status: "completed",
    processedAt: "2024-03-06T10:20:00Z",
    receiptUrl: "https://example.com/receipts/pay_101112.pdf",
  });

  console.log("\nPayment Variables:");
  console.log(paymentVars);
}

// ───────────────────────────────────────────────────────────────────
// EXAMPLE 6: Multiple Events in Sequence
// ───────────────────────────────────────────────────────────────────

async function exampleOrderShipmentFlow() {
  const engine = setupTriggerEngine();

  console.log(
    "\n=== Example 5: Complete Order-to-Delivery Flow ===\n",
  );

  const shopId = "shop_123";
  const orderId = "ord_789";
  const customerId = "cust_123";

  // 1. Order Created
  console.log("1. Emitting ORDER_CREATED event...");
  await eventBus.emit(TriggerEvent.ORDER_CREATED, {
    shopId,
    orderId,
    customerId,
    customerEmail: "customer@example.com",
    customerName: "Customer Name",
    orderTotal: 150.0,
  });

  // 2. Order Confirmed
  console.log("2. Emitting ORDER_CONFIRMED event...");
  await eventBus.emit(TriggerEvent.ORDER_CONFIRMED, {
    shopId,
    orderId,
    customerId,
    customerEmail: "customer@example.com",
  });

  // 3. Shipment Created
  console.log("3. Emitting SHIPMENT_CREATED event...");
  await eventBus.emit(TriggerEvent.SHIPMENT_CREATED, {
    shopId,
    shipmentId: "ship_789",
    trackingNumber: "TRACK123",
    customerId,
    zone: "north_zone_1",
  });

  // 4. Driver Assigned
  console.log("4. Emitting DRIVER_ASSIGNED event...");
  await eventBus.emit(TriggerEvent.DRIVER_ASSIGNED, {
    shopId,
    shipmentId: "ship_789",
    driverId: "drv_789",
    driverPhone: "+1-555-123-4567",
    driverName: "Driver Name",
  });

  // 5. Shipment In Transit
  console.log("5. Emitting SHIPMENT_IN_TRANSIT event...");
  await eventBus.emit(TriggerEvent.SHIPMENT_IN_TRANSIT, {
    shopId,
    shipmentId: "ship_789",
    customerId,
    customerEmail: "customer@example.com",
    zone: "north_zone_1",
  });

  // 6. Shipment Out for Delivery
  console.log("6. Emitting SHIPMENT_OUT_FOR_DELIVERY event...");
  await eventBus.emit(TriggerEvent.SHIPMENT_OUT_FOR_DELIVERY, {
    shopId,
    shipmentId: "ship_789",
    customerId,
    customerEmail: "customer@example.com",
    driverId: "drv_789",
  });

  // 7. Shipment Delivered
  console.log("7. Emitting SHIPMENT_DELIVERED event...");
  await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, {
    shopId,
    shipmentId: "ship_789",
    customerId,
    customerEmail: "customer@example.com",
    deliveredAt: new Date(),
    driverId: "drv_789",
    proofUrl: "https://example.com/proofs/delivery.jpg",
  });

  // 8. Payment Received
  console.log("8. Emitting PAYMENT_RECEIVED event...");
  await eventBus.emit(TriggerEvent.PAYMENT_RECEIVED, {
    shopId,
    paymentId: "pay_789",
    orderId,
    customerId,
    amount: 150.0,
    currency: "USD",
    status: "completed",
  });

  console.log("\nOrder-to-delivery flow complete!\n");
}

// ───────────────────────────────────────────────────────────────────
// MAIN: Run Examples
// ───────────────────────────────────────────────────────────────────

/**
 * Run all examples (for demonstration purposes).
 */
async function runExamples() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  Event-Driven Notification Trigger System - Examples        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  try {
    await exampleShipmentDelivered();
    await exampleDeliveryFailed();
    await exampleDriverAssigned();
    exampleTemplateVariables();
    await exampleOrderShipmentFlow();

    console.log(
      "\n╔════════════════════════════════════════════════════════════╗",
    );
    console.log("║  All examples completed successfully!                      ║");
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n",
    );
  } catch (error) {
    console.error("Error running examples:", error);
    process.exit(1);
  }
}

// Uncomment to run examples:
// runExamples().catch(console.error);

export { exampleShipmentDelivered, exampleDeliveryFailed, exampleDriverAssigned, exampleOrderShipmentFlow, exampleTemplateVariables };
