# Example: Integrating Socket.io Events into Shipments Route

This document shows exactly how to integrate the Socket.io real-time layer into an existing route handler.

## File: `/apps/api/src/routes/shipments.ts`

### Step 1: Add Imports

At the top of the file, add:

```typescript
import {
  emitShipmentCreated,
  emitShipmentStatusChanged,
  emitShipmentAssigned,
} from "../lib/events.js";
```

### Step 2: Emit on Create (POST /)

Find the create shipment route and add the emit call:

```typescript
// ── CREATE SHIPMENT ─────────────────────────────────────

fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
  const body = createShipmentSchema.parse(request.body);
  const shopId = (request as any).shopId;

  // Validate status transition
  if (!STATUS_TRANSITIONS["PENDING"]?.includes(body.status)) {
    throw new ValidationError(`Invalid initial status: ${body.status}`);
  }

  // Create shipment
  const shipment = await prisma.shipment.create({
    data: {
      shopId,
      orderId: body.orderId,
      status: body.status || "PENDING",
      trackingNumber: body.trackingNumber,
      driverId: body.driverId,
      deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
      deliveryMethod: body.deliveryMethod,
      deliveryAddress: body.deliveryAddress,
      notes: body.notes,
      customData: body.customData || {},
    },
  });

  // NEW: Emit real-time event
  emitShipmentCreated({
    id: shipment.id,
    shopId: shipment.shopId,
    status: shipment.status,
    orderId: shipment.orderId,
    trackingNumber: shipment.trackingNumber,
    driverId: shipment.driverId || undefined,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
  });

  return reply.status(201).send(shipment);
});
```

### Step 3: Emit on Status Change (PATCH /:id/status)

Find the status change route and add the emit:

```typescript
// ── UPDATE SHIPMENT STATUS ──────────────────────────────

fastify.patch(
  "/:id/status",
  async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateShipmentStatusSchema.parse(request.body);
    const shopId = (request as any).shopId;

    // Get current shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id },
    });

    if (!shipment || shipment.shopId !== shopId) {
      throw new NotFoundError(`Shipment ${id} not found`);
    }

    // Validate status transition
    const allowedTransitions = STATUS_TRANSITIONS[shipment.status] || [];
    if (!allowedTransitions.includes(body.status)) {
      throw new ConflictError(
        `Cannot transition from ${shipment.status} to ${body.status}. Allowed: ${allowedTransitions.join(", ")}`,
      );
    }

    const previousStatus = shipment.status;

    // Update shipment
    const updated = await prisma.shipment.update({
      where: { id },
      data: {
        status: body.status,
      },
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        shopId,
        entityType: "SHIPMENT",
        entityId: id,
        action: "STATUS_CHANGED",
        metadata: {
          previousStatus,
          newStatus: body.status,
          reason: body.reason,
        },
      },
    });

    // NEW: Emit real-time event
    emitShipmentStatusChanged({
      id: updated.id,
      shopId: updated.shopId,
      status: updated.status,
      orderId: updated.orderId,
      trackingNumber: updated.trackingNumber,
      driverId: updated.driverId || undefined,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      previousStatus,
      changedAt: new Date().toISOString(),
      reason: body.reason,
    });

    return reply.send(updated);
  },
);
```

### Step 4: Emit on Assign (PATCH /:id/assign)

Find the assign route and add the emit:

```typescript
// ── ASSIGN SHIPMENT TO DRIVER ──────────────────────────

fastify.patch(
  "/:id/assign",
  async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { driverId } = request.body as { driverId: string };
    const shopId = (request as any).shopId;

    // Get shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id },
    });

    if (!shipment || shipment.shopId !== shopId) {
      throw new NotFoundError(`Shipment ${id} not found`);
    }

    // Verify driver exists and belongs to shop
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver || driver.shopId !== shopId) {
      throw new NotFoundError(`Driver ${driverId} not found`);
    }

    // Assign shipment
    const updated = await prisma.shipment.update({
      where: { id },
      data: {
        driverId,
      },
    });

    // NEW: Emit real-time event
    emitShipmentAssigned({
      id: updated.id,
      shopId: updated.shopId,
      status: updated.status,
      orderId: updated.orderId,
      trackingNumber: updated.trackingNumber,
      driverId: driver.id,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      driverName: driver.name,
      assignedAt: new Date().toISOString(),
    });

    return reply.send(updated);
  },
);
```

## Complete Example: Before & After

### Before (Current)

```typescript
fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
  const body = createShipmentSchema.parse(request.body);
  const shipment = await prisma.shipment.create({ data: { ...body } });
  return reply.status(201).send(shipment);
});
```

### After (With Real-time)

```typescript
fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
  const body = createShipmentSchema.parse(request.body);
  const shipment = await prisma.shipment.create({ data: { ...body } });

  // Notify all connected dashboard clients in real-time
  emitShipmentCreated({
    id: shipment.id,
    shopId: shipment.shopId,
    status: shipment.status,
    orderId: shipment.orderId,
    trackingNumber: shipment.trackingNumber,
    driverId: shipment.driverId || undefined,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
  });

  return reply.status(201).send(shipment);
});
```

## Pattern for Other Routes

### Orders Route (`/apps/api/src/routes/orders.ts`)

```typescript
import { emitOrderCreated, emitOrderStatusChanged } from "../lib/events.js";

// Create
const order = await prisma.order.create({...});
emitOrderCreated({
  id: order.id,
  shopId: order.shopId,
  status: order.status,
  orderId: order.externalOrderId,
  customerId: order.customerId,
  totalAmount: order.totalAmount,
  createdAt: order.createdAt.toISOString(),
});

// Status change
const updated = await prisma.order.update({...});
emitOrderStatusChanged({
  id: updated.id,
  shopId: updated.shopId,
  status: updated.status,
  orderId: updated.externalOrderId,
  customerId: updated.customerId,
  totalAmount: updated.totalAmount,
  createdAt: updated.createdAt.toISOString(),
  previousStatus: oldStatus,
  changedAt: new Date().toISOString(),
});
```

### Drivers Route (`/apps/api/src/routes/drivers.ts`)

```typescript
import { emitDriverStatusChanged, emitDriverLocationUpdated } from "../lib/events.js";

// Status change
const updated = await prisma.driver.update({...});
emitDriverStatusChanged({
  id: updated.id,
  shopId: updated.shopId,
  driverId: updated.id,
  driverName: updated.name,
  status: updated.status as "ONLINE" | "OFFLINE" | "BREAK",
  assignedShipments: 5, // Calculate from DB
  lastUpdated: new Date().toISOString(),
});

// Location update
emitDriverLocationUpdated({
  id: updated.id,
  shopId: updated.shopId,
  driverId: updated.id,
  driverName: updated.name,
  status: updated.status as "ONLINE" | "OFFLINE" | "BREAK",
  assignedShipments: 5,
  latitude: request.body.latitude,
  longitude: request.body.longitude,
  accuracy: request.body.accuracy,
  timestamp: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
});
```

## Testing the Integration

### 1. Start the API server

```bash
cd apps/api
npm run dev
```

### 2. Create a shipment via curl

```bash
curl -X POST http://localhost:3000/api/v4/shipments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-123",
    "trackingNumber": "TRACK-456",
    "status": "PENDING",
    "deliveryDate": "2026-03-07",
    "deliveryMethod": "STANDARD",
    "deliveryAddress": "123 Main St, City, State 12345"
  }'
```

### 3. Check browser console (if dashboard is connected)

You should see:

```
[Socket] Subscribed to shop: shop-123
[Socket] Received event: shipment:created
```

### 4. Dashboard updates automatically

The shipment list will show the new shipment without page refresh!

## Common Patterns

### Data Transformation Helper

If you need to transform DB models to event payloads consistently:

```typescript
// In /apps/api/src/lib/events.ts

export function shipmentToEvent(shipment: Prisma.ShipmentGetPayload<{}>): ShipmentEvent {
  return {
    id: shipment.id,
    shopId: shipment.shopId,
    status: shipment.status,
    orderId: shipment.orderId,
    trackingNumber: shipment.trackingNumber,
    driverId: shipment.driverId || undefined,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
  };
}

// Then in routes:
const shipment = await prisma.shipment.create({...});
emitShipmentCreated(shipmentToEvent(shipment));
```

### Batch Operations

For bulk operations, emit separately to avoid overwhelming the queue:

```typescript
const shipments = await prisma.shipment.createMany({
  data: itemsToCreate,
});

// Emit individually (or use batch helper)
for (const shipment of shipments) {
  emitShipmentCreated(shipmentToEvent(shipment));
}

// OR use the batch helper
emitShipmentsCreated(shipments.map(shipmentToEvent));
```

### Error Recovery

If event emission fails, log but don't block the response:

```typescript
const shipment = await prisma.shipment.create({...});

try {
  emitShipmentCreated(shipmentToEvent(shipment));
} catch (err) {
  // Log the error but return success to client
  request.log.error(err, "Failed to emit shipment:created event");
  // In production, you might retry via a background job
}

return reply.status(201).send(shipment);
```

## Summary

The pattern is simple:

1. Import emit helpers at top of file
2. After any mutation (create/update/delete), call emit function
3. Pass the updated data to emit function
4. Dashboard receives event automatically

No additional setup needed in route handlers beyond the emit call!
