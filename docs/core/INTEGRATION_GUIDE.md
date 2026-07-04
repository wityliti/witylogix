# Event-Driven Notification Trigger System - Integration Guide

## Overview

The event-driven notification trigger system automatically sends notifications when shipment lifecycle events occur. It decouples event publishing from notification delivery via an event bus, enabling flexible, configurable notification rules.

**Key Components:**

1. **EventBus**: Simple pub/sub for domain events
2. **NotificationTriggerEngine**: Evaluates rules and queues notifications
3. **TriggerRules**: Configurable rules defining when/how to notify
4. **Template Variables**: Extracted and formatted event data

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Domain Services                           │
│  (Shipments, Orders, Drivers, Payments, etc.)               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ emit(event, payload)
                 ▼
         ┌──────────────────┐
         │   EventBus       │
         │  (pub/sub)       │
         └────────┬─────────┘
                  │
                  │ subscribers listen
                  ▼
      ┌──────────────────────────┐
      │ NotificationTriggerEngine│
      │  - Load rules (DB query) │
      │  - Evaluate conditions   │
      │  - Resolve recipients    │
      │  - Build template vars   │
      └────────┬─────────────────┘
               │
               │ queue notification
               ▼
      ┌──────────────────────────┐
      │ Message Broker           │
      │ (Bull/RabbitMQ/DB queue) │
      └────────┬─────────────────┘
               │
               ▼
      ┌──────────────────────────┐
      │ Notification Orchestrator│
      │ (Send via providers)     │
      └──────────────────────────┘
```

## Setup Instructions

### 1. Install Dependencies

The event system has no external dependencies and works with the existing `@witylogix/core` package.

```bash
npm install  # Already included in workspace
```

### 2. Configure Custom Rule Loader

Create a function to load trigger rules from your database:

```typescript
import type { RuleLoader } from "@witylogix/core/events";
import { prisma } from "@witylogix/db";

const dbRuleLoader: RuleLoader = async (shopId, event) => {
  const rules = await prisma.notificationTriggerRule.findMany({
    where: {
      shopId,
      ...(event ? { event } : {}),
    },
  });
  return rules;
};
```

### 3. Configure Notification Queue Handler

Create a function to queue notifications (e.g., to Bull/Redis):

```typescript
import type { NotificationQueueHandler } from "@witylogix/core/events";
import { notificationQueue } from "./queue"; // Bull job queue

const queueHandler: NotificationQueueHandler = async (item) => {
  await notificationQueue.add(
    "send-notification",
    {
      templateId: item.templateId,
      channel: item.channel,
      recipient: item.recipient,
      templateVars: item.templateVars,
      shopId: item.shopId,
    },
    {
      delay: (item.delay || 0) * 1000, // Convert seconds to ms
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  );
};
```

### 4. Initialize Trigger Engine

In your application bootstrap (e.g., `main.ts` or `app.ts`):

```typescript
import { NotificationTriggerEngine, eventBus } from "@witylogix/core/events";

// Create trigger engine with custom implementations
const triggerEngine = new NotificationTriggerEngine(
  eventBus,
  dbRuleLoader,
  queueHandler,
);

// Export for use throughout your app
export { eventBus, triggerEngine };
```

## Usage Examples

### Emitting Events from Domain Services

**Example: Shipment Service**

```typescript
import { eventBus, TriggerEvent } from "@witylogix/core/events";

export async function markShipmentDelivered(shipmentId: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { order: true, driver: true },
  });

  // ... perform delivery logic ...

  // Emit event (trigger engine will queue notifications)
  await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, {
    shopId: shipment.shopId,
    shipmentId: shipment.id,
    trackingNumber: shipment.trackingNumber,
    customerId: shipment.order.customerId,
    customerEmail: shipment.order.customerEmail,
    customerName: shipment.order.customerName,
    deliveredAt: new Date(),
    driverId: shipment.driverId,
    driverName: shipment.driver.name,
    driverPhone: shipment.driver.phone,
    zone: shipment.zone,
    proofUrl: shipment.deliveryProofUrl,
    deliveryNotes: shipment.deliveryNotes,
  });
}
```

**Example: Payment Service**

```typescript
import { eventBus, TriggerEvent } from "@witylogix/core/events";

export async function processPayment(orderId: string, amount: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  // ... perform payment processing ...

  if (paymentSuccessful) {
    await eventBus.emit(TriggerEvent.PAYMENT_RECEIVED, {
      shopId: order.shopId,
      paymentId: payment.id,
      orderId: order.id,
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      amount,
      currency: order.currency,
      status: "completed",
    });
  } else {
    await eventBus.emit(TriggerEvent.PAYMENT_FAILED, {
      shopId: order.shopId,
      paymentId: payment.id,
      orderId: order.id,
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      amount,
      currency: order.currency,
      status: "failed",
      errorMessage: paymentError.message,
    });
  }
}
```

### Creating Trigger Rules (via API or Admin Panel)

**API Endpoint: POST /api/shops/:shopId/notification-triggers**

```typescript
import { triggerEngine } from "./events";
import { prisma } from "@witylogix/db";

export async function createTriggerRule(req: Request, res: Response) {
  const { shopId } = req.params;
  const {
    event,
    templateId,
    channel,
    recipientType,
    customRecipient,
    conditions,
    delay,
  } = req.body;

  const rule = await prisma.notificationTriggerRule.create({
    data: {
      shopId,
      event,
      templateId,
      channel,
      recipientType,
      customRecipient,
      conditions,
      delay: delay || 0,
      isActive: true,
    },
  });

  res.json(rule);
}
```

**Example Rule Configuration:**

```json
{
  "event": "shipment.delivered",
  "templateId": "tmpl_delivery_confirmation",
  "channel": "EMAIL",
  "recipientType": "customer",
  "conditions": [
    {
      "field": "shipment.zone",
      "operator": "eq",
      "value": "north_zone_1"
    },
    {
      "field": "order.total",
      "operator": "gt",
      "value": 100
    }
  ],
  "delay": 0,
  "isActive": true
}
```

## Template Variables Reference

### Order Variables

- `order_id`: Order ID
- `order_number`: Human-readable order number
- `customer_name`: Customer full name
- `customer_email`: Customer email address
- `item_count`: Number of items ordered
- `subtotal`: Order subtotal (formatted)
- `total`: Order total (formatted)
- `currency`: ISO currency code
- `status_display`: Human-readable status

### Shipment Variables

- `shipment_id`: Shipment ID
- `tracking_number`: Carrier tracking number
- `zone`: Delivery zone
- `weight_kg`: Weight in kilograms
- `weight_lbs`: Weight in pounds
- `dimensions_cm`: Dimensions (formatted)
- `pickup_address`: Full pickup address
- `delivery_address`: Full delivery address
- `status_display`: Human-readable status
- `created_at`: Creation timestamp (formatted)

### Driver Variables

- `driver_id`: Driver ID
- `driver_name`: Driver full name
- `driver_phone`: Driver phone number
- `vehicle_number`: Vehicle registration number
- `vehicle_type_display`: Human-readable vehicle type
- `zone`: Assigned zone
- `rating`: Driver rating (e.g., 4.8)
- `rating_stars`: Visual star rating
- `deliveries_completed`: Completed delivery count

### Payment Variables

- `payment_id`: Payment ID
- `amount`: Payment amount (formatted)
- `currency_symbol`: Currency symbol ($, €, £, etc.)
- `method_display`: Payment method name
- `last_four`: Last 4 digits of card
- `card_brand`: Card issuer (Visa, Mastercard, etc.)
- `status_display`: Human-readable payment status
- `receipt_url`: Link to receipt/invoice

## Supported Events

### Order Lifecycle

- `ORDER_CREATED` - New order placed
- `ORDER_CONFIRMED` - Order confirmed by customer

### Shipment Lifecycle

- `SHIPMENT_CREATED` - Shipment created
- `SHIPMENT_LABEL_CREATED` - Shipping label generated
- `SHIPMENT_PICKED_UP` - Shipment picked up by carrier
- `SHIPMENT_IN_TRANSIT` - In transit to destination
- `SHIPMENT_OUT_FOR_DELIVERY` - Out for delivery
- `SHIPMENT_DELIVERED` - Successfully delivered
- `SHIPMENT_FAILED` - Delivery failed/attempted
- `SHIPMENT_RETURNED` - Shipment returned

### Driver Events

- `DRIVER_ASSIGNED` - Driver assigned to shipment
- `DRIVER_NEAR_DELIVERY` - Driver within 500m geofence

### Delivery Events

- `DELIVERY_ATTEMPTED` - Delivery attempt made
- `DELIVERY_PROOF_SUBMITTED` - Proof of delivery uploaded

### Payment Events

- `PAYMENT_RECEIVED` - Payment successfully received
- `PAYMENT_FAILED` - Payment processing failed

## Condition Operators

### Supported Operators

- `eq` - Equals
- `neq` - Not equals
- `gt` - Greater than (numeric)
- `lt` - Less than (numeric)
- `contains` - String contains substring
- `in` - Value in array

### Example Conditions

```typescript
// Send only for high-value orders
{
  field: "order.total",
  operator: "gt",
  value: 500
}

// Send only for specific zones
{
  field: "shipment.zone",
  operator: "in",
  value: ["north_zone_1", "north_zone_2", "center_zone"]
}

// Send only for overnight deliveries
{
  field: "delivery.isOvernight",
  operator: "eq",
  value: true
}

// Send only if address contains "PO Box"
{
  field: "delivery.address",
  operator: "contains",
  value: "PO Box"
}
```

## Error Handling

The trigger engine handles errors gracefully:

1. **Rule Loading Errors**: Logged to console, processing continues
2. **Condition Evaluation Errors**: Rule skipped with warning
3. **Recipient Resolution Errors**: Notification skipped with warning
4. **Queue Errors**: Returned in `ProcessResult.errors`

### Monitoring

Check processing results:

```typescript
import { triggerEngine, TriggerEvent } from "@witylogix/core/events";

const result = await triggerEngine.processEvent(event, payload);

console.log(`Matched Rules: ${result.matchedRuleCount}`);
console.log(`Queued Notifications: ${result.queuedCount}`);
console.log(`Processing Time: ${result.durationMs}ms`);

if (result.errors.length > 0) {
  console.error("Errors:", result.errors);
}
```

## Best Practices

### 1. Always Include shopId in Event Payload

The trigger engine requires `shopId` to load rules:

```typescript
await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, {
  shopId: "required", // Always include
  shipmentId: "...",
  // ... other fields
});
```

### 2. Use Proper Recipient Resolution

Include the necessary fields for recipient resolution:

```typescript
// For customer notifications, include:
{
  customerEmail: "...",  // or
  customerId: "...",
}

// For driver notifications, include:
{
  driverPhone: "...",    // or
  driverEmail: "...",    // or
  driverId: "...",
}
```

### 3. Test Conditions Carefully

Use dot notation for nested fields:

```typescript
// Correct
{ field: "shipment.zone", operator: "eq", value: "north_zone_1" }

// Wrong (won't work)
{ field: "zone", operator: "eq", value: "north_zone_1" }
```

### 4. Set Appropriate Delays

Use delays for follow-up notifications:

```typescript
// Immediate notification
{
  delay: 0;
}

// 5-minute delay
{
  delay: 300;
}

// 1-hour delay
{
  delay: 3600;
}
```

### 5. Handle Async Operations

EventBus.emit() is async; always await:

```typescript
// Correct
await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, payload);

// Wrong
eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, payload); // Fire and forget
```

## Performance Considerations

1. **Lazy Rule Loading**: Rules are loaded from DB on each event
   - Consider caching for high-volume events
   - Add TTL-based cache invalidation

2. **Async Processing**: Event emission doesn't block domain logic
   - Errors in handlers are logged but don't propagate
   - Notification queuing is non-blocking

3. **Memory Usage**: EventBus stores handler functions in memory
   - Minimal overhead for typical deployments
   - Unsubscribe handlers if no longer needed

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  EventBus,
  NotificationTriggerEngine,
  TriggerEvent,
} from "@witylogix/core/events";

describe("NotificationTriggerEngine", () => {
  let engine: NotificationTriggerEngine;
  let eventBus: EventBus;
  const queuedNotifications: any[] = [];

  beforeEach(() => {
    eventBus = new EventBus();
    const mockRuleLoader = async () => [
      {
        id: "rule_1",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl_1",
        channel: "EMAIL",
        recipientType: "customer",
        isActive: true,
      },
    ];

    const mockQueueHandler = async (item) => {
      queuedNotifications.push(item);
    };

    engine = new NotificationTriggerEngine(
      eventBus,
      mockRuleLoader,
      mockQueueHandler,
    );
  });

  it("should queue notification for matching rule", async () => {
    const payload = {
      shopId: "shop_123",
      shipmentId: "ship_1",
      customerId: "cust_1",
      customerEmail: "test@example.com",
      deliveredAt: new Date(),
    };

    await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, payload);
    expect(queuedNotifications).toHaveLength(1);
    expect(queuedNotifications[0].recipient).toBe("test@example.com");
  });
});
```

## Troubleshooting

### Issue: Notifications Not Being Sent

1. **Check shopId in payload**: Rule loader requires it
2. **Verify rule is active**: `isActive: true`
3. **Validate conditions**: Condition logic is AND'ed
4. **Check recipient resolution**: Ensure required fields present

### Issue: Wrong Recipient

1. **Verify recipientType**: "customer", "driver", "admin", or "custom"
2. **Check payload fields**: `customerEmail`, `driverPhone`, etc.
3. **For custom**: Ensure `customRecipient` is set

### Issue: Notifications Have Wrong Data

1. **Check template variables**: Use `buildShipmentVars()`, etc.
2. **Verify payload fields**: Template vars extracted from payload
3. **Check field names**: Use correct field names in payload

## API Reference

### EventBus

```typescript
class EventBus {
  on(event: TriggerEvent, handler: EventHandler): void;
  off(event: TriggerEvent, handler: EventHandler): void;
  async emit(event: TriggerEvent, payload: EventPayload): Promise<void>;
  getHandlerCount(event: TriggerEvent): number;
  clear(): void;
}
```

### NotificationTriggerEngine

```typescript
class NotificationTriggerEngine {
  constructor(
    eventBus: EventBus,
    ruleLoader?: RuleLoader,
    queueHandler?: NotificationQueueHandler,
  );
  async loadRules(shopId: string, event?: TriggerEvent): Promise<TriggerRule[]>;
  evaluateConditions(rule: TriggerRule, payload: EventPayload): boolean;
  resolveRecipient(rule: TriggerRule, payload: EventPayload): string | null;
  buildTemplateVars(
    event: TriggerEvent,
    payload: EventPayload,
  ): Record<string, unknown>;
  async processEvent(
    event: TriggerEvent,
    payload: EventPayload,
  ): Promise<ProcessResult>;
}
```

### Template Builders

```typescript
function buildShipmentVars(
  shipment: Record<string, unknown>,
): Record<string, unknown>;
function buildOrderVars(
  order: Record<string, unknown>,
): Record<string, unknown>;
function buildDriverVars(
  driver: Record<string, unknown>,
): Record<string, unknown>;
function buildPaymentVars(
  payment: Record<string, unknown>,
): Record<string, unknown>;
```

## Contributing

When adding new events:

1. Add to `TriggerEvent` enum
2. Add payload fields to `EventPayload`
3. Add template variable builder if needed
4. Update this documentation

When adding new conditions:

1. Add operator to `TriggerCondition.operator`
2. Implement evaluation in `evaluateCondition()`
3. Document with examples
