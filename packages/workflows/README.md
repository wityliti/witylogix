# @witylogix/workflows

Workflow orchestration and reusable step library for Witylogix delivery platform.

## Overview

This package implements a **Saga pattern** workflow architecture (inspired by Medusa v2 ADR-009) for managing distributed delivery operations. All delivery workflows compose from reusable, compensatable steps that ensure data consistency across the system.

## Architecture

### Core Concepts

1. **WorkflowStep**: A reusable unit of work with forward (`invoke`) and compensating (`compensate`) operations
2. **WorkflowContext**: Runtime context providing Prisma access, logging, user info
3. **StepResult**: Typed result with success/error and data payload
4. **Compensation Chain**: Automatic rollback on failure (saga pattern)

### Step Lifecycle

```
invoke() → success ✓
         → error ✗ → compensate() [previous steps]
```

Each step is idempotent and can be safely retried.

## Package Structure

```
packages/workflows/
├── src/
│   ├── types.ts                    # Core interfaces (WorkflowStep, WorkflowContext, etc.)
│   ├── index.ts                    # Package entry point
│   ├── steps/                      # Reusable step library
│   │   ├── validation.ts           # Order validation (150+ lines)
│   │   ├── geocoding.ts            # Address geocoding (100+ lines)
│   │   ├── rating.ts               # Rate calculation (120+ lines)
│   │   ├── assignment.ts           # Zone/driver assignment (200+ lines)
│   │   ├── order.ts                # Order creation (100+ lines)
│   │   ├── delivery.ts             # POD verification & status update (180+ lines)
│   │   ├── billing.ts              # Billing record creation (100+ lines)
│   │   ├── notification.ts         # Email/SMS/push notifications (100+ lines)
│   │   └── index.ts                # Steps re-exports
│   └── definitions/                # Workflow definitions (populated by team)
│       ├── create-delivery-order.ts
│       ├── assign-driver.ts
│       ├── complete-delivery.ts
│       └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Reusable Steps

### Validation Pipeline

#### `validateOrderStep`

Validates order data integrity before processing.

**Input**: Order details (items, addresses, customer info)
**Output**: Validation status + warnings
**Compensation**: None (read-only)

```typescript
import { validateOrderStep } from "@witylogix/workflows/steps";

const result = await validateOrderStep.invoke(
  {
    orderId: "order_123",
    addressLine1: "123 Main St",
    city: "New York",
    postalCode: "10001",
    country: "US",
    itemCount: 3,
  },
  context,
);
```

### Geocoding Pipeline

#### `geocodeAddressStep`

Geocodes pickup and delivery addresses to lat/lng coordinates.

**Input**: Pickup + delivery addresses
**Output**: Geocoded locations + distance/duration estimates
**Compensation**: None (read-only)

```typescript
import { geocodeAddressStep } from "@witylogix/workflows/steps";

const result = await geocodeAddressStep.invoke(
  {
    pickupAddress: {
      /* ... */
    },
    deliveryAddress: {
      /* ... */
    },
  },
  context,
);

// Returns: { distanceKm, routeDurationMinutes }
```

### Pricing Pipeline

#### `calculateRateStep`

Calculates shipping rate based on distance, weight, zone, and surcharges.

**Input**: Distance, weight, zone, time slot
**Output**: Rate breakdown (base + distance + weight + surcharge)
**Compensation**: None (read-only)

```typescript
import { calculateRateStep } from "@witylogix/workflows/steps";

const result = await calculateRateStep.invoke(
  {
    distanceKm: 12.5,
    weightKg: 5,
    zoneId: "zone_123",
    itemCount: 3,
    deliveryDate: new Date(),
  },
  context,
);

// Returns: { baseRate, distanceCharge, weightCharge, totalRate, rateBreakdown }
```

### Zone & Driver Assignment

#### `assignZoneStep`

Assigns delivery zone based on geocoded address.

**Input**: Delivery coordinates, shop ID
**Output**: Zone ID + pricing info
**Compensation**: Clear zone assignment

```typescript
import { assignZoneStep } from "@witylogix/workflows/steps";

const result = await assignZoneStep.invoke(
  {
    deliveryLat: 40.7128,
    deliveryLng: -74.006,
    shopId: "shop_123",
  },
  context,
);
```

#### `findAvailableDriversStep`

Queries for available drivers near pickup location.

**Input**: Pickup coordinates, shop ID
**Output**: List of driver candidates filtered by distance
**Compensation**: None (read-only)

```typescript
import { findAvailableDriversStep } from "@witylogix/workflows/steps";

const result = await findAvailableDriversStep.invoke(
  {
    pickupLat: 40.7128,
    pickupLng: -74.006,
    shopId: "shop_123",
    maxDistance: 15, // km
  },
  context,
);

// Returns: { driverCandidates: [...], totalAvailable: N }
```

#### `optimizeAssignmentStep`

Selects best driver using multi-factor scoring algorithm.

**Factors**:

- Distance to pickup (40% weight)
- Vehicle capacity (30% weight)
- Vehicle type suitability (30% weight)

**Input**: Driver candidates + order details
**Output**: Selected driver with score breakdown
**Compensation**: None (analytical only)

```typescript
import { optimizeAssignmentStep } from "@witylogix/workflows/steps";

const result = await optimizeAssignmentStep.invoke({
  driverCandidates: [...],
  itemCount: 3,
  totalWeight: 12,
  deliveryDate: new Date(),
}, context);

// Returns: { selectedDriverId, selectedDriver, score, scoreBreakdown }
```

#### `assignDriverRecordStep`

Creates driver assignment in database (updates order).

**Input**: Driver ID, order ID
**Output**: Assignment confirmation
**Compensation**: Unassign driver + revert status

```typescript
import { assignDriverRecordStep } from "@witylogix/workflows/steps";

const result = await assignDriverRecordStep.invoke(
  {
    driverId: "driver_123",
    orderId: "order_123",
    shopId: "shop_123",
  },
  context,
);
```

### Order Creation

#### `createOrderRecordStep`

Creates order record in database with validated/geocoded data.

**Input**: Full order details (addresses, items, pricing)
**Output**: Created order ID + tracking token
**Compensation**: Cancel order

```typescript
import { createOrderRecordStep } from "@witylogix/workflows/steps";

const result = await createOrderRecordStep.invoke(
  {
    shopId: "shop_123",
    shopifyOrderId: "gid://shopify/Order/123",
    customerName: "John Doe",
    addressLine1: "123 Main St",
    city: "New York",
    // ... full order data
  },
  context,
);

// Returns: { orderId, trackingToken, status: "PENDING" }
```

### Delivery Completion

#### `verifyProofOfDeliveryStep`

Validates proof of delivery (photos, signature, code).

**Validations**:

- At least 1 photo required
- Valid photo URLs
- Valid delivery coordinates
- Optional signature validation

**Input**: POD data (photos, signature, recipient name, location)
**Output**: POD verification result
**Compensation**: None (read-only)

```typescript
import { verifyProofOfDeliveryStep } from "@witylogix/workflows/steps";

const result = await verifyProofOfDeliveryStep.invoke(
  {
    orderId: "order_123",
    photoUrls: ["https://...", "https://..."],
    recipientName: "John Doe",
    deliveryLat: 40.7128,
    deliveryLng: -74.006,
  },
  context,
);
```

#### `updateDeliveryStatusStep`

Updates order/shipment delivery status with validation.

**Valid Transitions**:

- PENDING → ACCEPTED, CANCELLED
- ACCEPTED → ASSIGNED, CANCELLED
- ASSIGNED → PICKED_UP, CANCELLED
- PICKED_UP → OUT_FOR_DELIVERY, FAILED
- OUT_FOR_DELIVERY → ARRIVED, FAILED
- ARRIVED → DELIVERED, FAILED
- DELIVERED, CANCELLED, RETURNED → terminal states

**Input**: Order ID, new status, optional POD data
**Output**: Status update confirmation
**Compensation**: Revert to previous status

```typescript
import { updateDeliveryStatusStep } from "@witylogix/workflows/steps";

const result = await updateDeliveryStatusStep.invoke(
  {
    orderId: "order_123",
    newStatus: "DELIVERED",
    podData: {
      photoUrls: ["https://..."],
      recipientName: "John Doe",
      deliveryLocation: { lat: 40.7128, lng: -74.006 },
    },
  },
  context,
);
```

### Billing

#### `triggerBillingStep`

Creates billing record for completed delivery.

**Calculates**:

- Shipping cost
- COD amount (if applicable)
- Insurance amount
- Discount amount

**Input**: Order/shipment ID, cost breakdown
**Output**: Billing record ID + total amount
**Compensation**: Void billing record

```typescript
import { triggerBillingStep } from "@witylogix/workflows/steps";

const result = await triggerBillingStep.invoke(
  {
    orderId: "order_123",
    shopId: "shop_123",
    shippingCost: 25.0,
    codAmount: 100.0,
    insuranceAmount: 2.5,
  },
  context,
);

// Returns: { billingId, totalAmount: 127.50 }
```

### Notifications

#### `sendNotificationStep`

Sends notifications via email, SMS, and/or push.

**Features**:

- Multi-channel support (EMAIL, SMS, PUSH)
- Template-based messaging
- Automatic recipient lookup from order/driver
- Best-effort delivery (no rollback)

**Input**: Notification config (channels, template, recipient type)
**Output**: Notification logs with delivery status
**Compensation**: None (best-effort)

```typescript
import { sendNotificationStep } from "@witylogix/workflows/steps";

const result = await sendNotificationStep.invoke(
  {
    orderId: "order_123",
    recipientType: "CUSTOMER",
    channels: ["EMAIL", "SMS"],
    templateKey: "DELIVERY_ARRIVED",
    templateData: {
      driverName: "John",
      estimatedArrival: "2:30 PM",
    },
  },
  context,
);

// Returns: { notificationLogs: [...], successful: 2, failed: 0 }
```

## Workflow Definitions

Three main workflows are composed from these steps:

### 1. Order Acceptance Workflow (OAW)

**Trigger**: Shopify `order.created` webhook

**Steps**:

1. `validateOrderStep` — Validate order data
2. `geocodeAddressStep` — Geocode delivery address
3. `calculateRateStep` — Calculate shipping rate
4. `createOrderRecordStep` — Create order in DB

**Compensation Chain** (on failure):

- Undo: `createOrderRecordStep` → cancel order

**Timeout**: 30 seconds

### 2. Driver Assignment Workflow (DAW)

**Trigger**: Manual dispatch or scheduled batch job

**Steps**:

1. `assignZoneStep` — Assign delivery zone
2. `findAvailableDriversStep` — Find nearby drivers
3. `optimizeAssignmentStep` — Score and select best driver
4. `assignDriverRecordStep` — Create assignment in DB

**Compensation Chain** (on failure):

- Undo: `assignDriverRecordStep` → unassign driver

**Timeout**: 15 seconds

### 3. Delivery Completion Workflow (DCW)

**Trigger**: Driver submits POD or app auto-marks delivery

**Steps**:

1. `verifyProofOfDeliveryStep` — Validate POD
2. `updateDeliveryStatusStep` — Update order status
3. `triggerBillingStep` — Create billing record
4. `sendNotificationStep` — Notify customer

**Compensation Chain** (on failure):

- Undo: `triggerBillingStep` → void billing
- Undo: `updateDeliveryStatusStep` → revert status

**Timeout**: 20 seconds

## Usage Example

### Composing a Custom Workflow

```typescript
import {
  validateOrderStep,
  geocodeAddressStep,
  calculateRateStep,
  createOrderRecordStep,
  type WorkflowContext,
} from "@witylogix/workflows";
import { prisma, forTenant } from "@witylogix/db";
import { createDefaultLogger } from "@witylogix/workflows";

const shopId = "shop_123";
const context: WorkflowContext = {
  prisma: forTenant(shopId),
  shopId,
  logger: createDefaultLogger("ORDER_WORKFLOW"),
};

// Execute steps in sequence
const validationResult = await validateOrderStep.invoke(
  {
    orderId: "order_123",
    addressLine1: "123 Main St",
    city: "New York",
    // ... validation input
  },
  context,
);

if (!validationResult.success) {
  console.error("Validation failed:", validationResult.error);
  return;
}

const geocodingResult = await geocodeAddressStep.invoke(
  {
    pickupAddress: {
      /* ... */
    },
    deliveryAddress: {
      /* ... */
    },
  },
  context,
);

const ratingResult = await calculateRateStep.invoke(
  {
    distanceKm: geocodingResult.data!.distanceKm,
    zoneId: "zone_123",
    // ... rating input
  },
  context,
);

const orderResult = await createOrderRecordStep.invoke(
  {
    shopId,
    shopifyOrderId: "gid://shopify/Order/123",
    // ... order data
  },
  context,
);

if (orderResult.success) {
  console.log("Order created:", orderResult.data?.orderId);
}
```

### Error Handling & Compensation

```typescript
// If any step fails, compensation runs automatically
try {
  const results = await executeWorkflow(
    [
      step1,
      step2,
      step3, // <- fails here
    ],
    context,
  );

  // On failure, compensation chain runs in reverse:
  // step3.compensate() [skipped, never completed]
  // step2.compensate()
  // step1.compensate()
} catch (error) {
  console.error("Workflow failed:", error);
  // All side effects have been rolled back
}
```

## Logging & Observability

All steps use the `WorkflowContext.logger` for consistent logging:

```typescript
logger?.info("Starting validation", { orderId });
logger?.debug("Geocoding address", { address });
logger?.warn("Address format unusual", { address });
logger?.error("Database error", { error });
```

Set `NODE_ENV=development` to enable debug logs.

## Database Integration

All steps use the Prisma scoping functions from `@witylogix/db`:

```typescript
import { forTenant } from "@witylogix/db";

const shopDb = forTenant(shopId);
const order = await shopDb.order.findUnique({ where: { id } });
```

Steps automatically enforce shop-level and org-level RLS (Row-Level Security).

## Testing

Each step is independently testable:

```typescript
import { validateOrderStep } from "@witylogix/workflows/steps";

describe("validateOrderStep", () => {
  it("should validate valid orders", async () => {
    const result = await validateOrderStep.invoke(
      {
        orderId: "123",
        addressLine1: "123 Main St",
        city: "New York",
        postalCode: "10001",
        country: "US",
        itemCount: 1,
      },
      mockContext,
    );

    expect(result.success).toBe(true);
    expect(result.data?.isValid).toBe(true);
  });

  it("should reject invalid addresses", async () => {
    const result = await validateOrderStep.invoke(
      {
        orderId: "123",
        addressLine1: "",
        // ...
      },
      mockContext,
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("INVALID_ADDRESS");
  });
});
```

## Metrics

- **Total step files**: 9
- **Total lines of code**: 2,368+ (excluding definitions)
- **Re-exported steps**: 12
- **Validation warnings**: Comprehensive (postal code format, phone number, address length, etc.)
- **Status transitions**: Fully validated across all enums

## Future Enhancements

- [ ] Workflow execution tracking/persistence
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Automatic retry policies
- [ ] Event sourcing for audit trails
- [ ] Real geocoding API integration (Google Maps, Mapbox)
- [ ] Driver location tracking middleware
- [ ] Advanced route optimization (OSRM, Vroom)

## References

- ADR-009: Medusa v2-inspired workflow architecture
- Saga Pattern: https://microservices.io/patterns/data/saga.html
- Prisma Client: https://www.prisma.io/docs/orm/reference/prisma-client-reference
