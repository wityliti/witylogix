# Socket.io Real-time Integration Guide

This document describes the production-grade Socket.io implementation for real-time dashboard updates in Witylogix.

## Architecture Overview

The Socket.io layer provides:
- **Tenant isolation** via shop-specific rooms (`shop:{shopId}`)
- **JWT authentication** on connection
- **Granular subscriptions** for shipments and drivers
- **Type-safe events** shared between API and dashboard
- **Horizontal scaling** with Redis adapter
- **Connection tracking** and health metrics

## Files Created

### 1. `/apps/api/src/lib/socket.ts` (Server)
Production-grade Socket.io server initialization with:
- JWT authentication middleware
- Room management (shop, shipment, driver)
- Connection tracking and stats
- Event emission helpers
- Graceful shutdown support

### 2. `/apps/api/src/lib/events.ts` (Server)
Helper functions for route handlers to emit events:
- `emitShipmentCreated(data)`
- `emitShipmentStatusChanged(data)`
- `emitShipmentAssigned(data)`
- `emitOrderCreated(data)`, `emitOrderStatusChanged(data)`
- `emitDriverStatusChanged(data)`, `emitDriverLocationUpdated(data)`
- `emitNotificationSent(data)`, `emitPaymentReceived(data)`, `emitActivityNew(data)`

### 3. `/packages/core/src/realtime/index.ts` (Shared)
Type-safe event constants and types used by both API and dashboard:
- `EVENTS` object with event name constants
- Room naming helpers (`getShopRoom()`, `getShipmentRoom()`, etc.)
- Type definitions for all event payloads

### 4. `/apps/dashboard/src/lib/socket.ts` (Client)
React hook for real-time updates:
- `useSocket(shopId)` hook
- Automatic reconnection with exponential backoff
- Type-safe event listeners
- Event subscriptions management

## Setup Instructions

### Step 1: Update API Server Initialization

In `/apps/api/src/server.ts`, modify the `buildServer()` function to set up Socket.io:

```typescript
import { setupSocketServer } from "./lib/socket.js";
import { getRedis } from "./lib/redis.js";

export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();
  const app = Fastify({
    // ... existing config
  });

  // ... register existing plugins ...

  // ─── Socket.io Setup ────────────────────────────────────

  // After all plugins are registered, set up Socket.io
  const httpServer = app.server; // Fastify exposes underlying HTTP server
  const redis = getRedis();

  try {
    await setupSocketServer(httpServer, redis, app.log);
    app.log.info("Socket.io real-time server initialized");
  } catch (err) {
    app.log.error(err, "Failed to initialize Socket.io");
    throw err;
  }

  // ... rest of server setup ...

  return app;
}
```

### Step 2: Add Socket.io to Graceful Shutdown

In the `shutdown()` function in `/apps/api/src/server.ts`:

```typescript
import { shutdownSocket } from "./lib/socket.js";

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  app.log.info(`Received ${signal} — starting graceful shutdown`);

  // 1. Stop accepting new connections
  try {
    await app.close();
    app.log.info("HTTP server closed");
  } catch (err) {
    app.log.error(err, "Error closing HTTP server");
  }

  // 2. Shutdown Socket.io (NEW)
  try {
    await shutdownSocket(app.log);
  } catch (err) {
    app.log.error(err, "Error shutting down Socket.io");
  }

  // 3. Drain BullMQ workers and queues
  try {
    await shutdownQueues();
    app.log.info("BullMQ queues closed");
  } catch (err) {
    app.log.error(err, "Error closing BullMQ queues");
  }

  // ... rest of shutdown ...
}
```

### Step 3: Update Dashboard Package.json

Add socket.io-client to `/apps/dashboard/package.json`:

```json
{
  "dependencies": {
    "socket.io-client": "^4.8.0"
  }
}
```

Then run: `pnpm install`

### Step 4: Emit Events from Route Handlers

Example: Update `/apps/api/src/routes/shipments.ts` to emit events:

```typescript
import { emitShipmentCreated, emitShipmentStatusChanged } from "../lib/events.js";

// In POST / (create shipment)
const shipment = await prisma.shipment.create({
  data: { /* ... */ },
});

// Emit to all clients in the shop
emitShipmentCreated({
  id: shipment.id,
  shopId: shipment.shopId,
  status: shipment.status,
  orderId: shipment.orderId,
  trackingNumber: shipment.trackingNumber,
  driverId: shipment.driverId,
  createdAt: shipment.createdAt.toISOString(),
  updatedAt: shipment.updatedAt.toISOString(),
});

return reply.status(201).send(shipment);

// In PATCH /:id/status (update status)
const updated = await prisma.shipment.update({
  where: { id },
  data: { status: newStatus },
});

// Emit status change
emitShipmentStatusChanged({
  id: updated.id,
  shopId: updated.shopId,
  status: updated.status,
  orderId: updated.orderId,
  trackingNumber: updated.trackingNumber,
  driverId: updated.driverId,
  createdAt: updated.createdAt.toISOString(),
  updatedAt: updated.updatedAt.toISOString(),
  previousStatus: oldStatus,
  changedAt: new Date().toISOString(),
  reason: "Status transition via API",
});

return reply.send(updated);
```

## Usage in Dashboard

### Example 1: Display Real-time Shipment List

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/lib/socket";
import { EVENTS } from "@witylogix/core/realtime";
import type { ShipmentEventPayload } from "@witylogix/core/realtime";

export function ShipmentsPage({ shopId }: { shopId: string }) {
  const socket = useSocket(shopId);
  const [shipments, setShipments] = useState<ShipmentEventPayload[]>([]);

  // Subscribe to shipment events
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribe = socket.on(EVENTS.SHIPMENT_CREATED, (data: ShipmentEventPayload) => {
      setShipments((prev) => [data, ...prev]);
    });

    return unsubscribe;
  }, [socket.isConnected, socket.on]);

  // Subscribe to status changes
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribe = socket.on(EVENTS.SHIPMENT_STATUS_CHANGED, (data) => {
      setShipments((prev) =>
        prev.map((s) => (s.id === data.id ? { ...s, status: data.status } : s))
      );
    });

    return unsubscribe;
  }, [socket.isConnected, socket.on]);

  return (
    <div>
      <h1>Shipments</h1>
      {socket.isConnecting && <p>Connecting to real-time updates...</p>}
      {socket.error && <p className="error">{socket.error}</p>}
      <ul>
        {shipments.map((shipment) => (
          <li key={shipment.id}>
            {shipment.trackingNumber} - {shipment.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Example 2: Real-time Driver Location Map

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/lib/socket";
import { EVENTS } from "@witylogix/core/realtime";
import type { DriverLocationEventPayload } from "@witylogix/core/realtime";

export function DriverMapPage({ shopId }: { shopId: string }) {
  const socket = useSocket(shopId);
  const [drivers, setDrivers] = useState<Map<string, DriverLocationEventPayload>>(
    new Map(),
  );

  useEffect(() => {
    if (!socket.isConnected) return;

    // Subscribe to driver location updates
    const unsubscribe = socket.on(
      EVENTS.DRIVER_LOCATION_UPDATED,
      (data: DriverLocationEventPayload) => {
        setDrivers((prev) => new Map(prev).set(data.driverId, data));
      },
    );

    return unsubscribe;
  }, [socket.isConnected, socket.on]);

  return (
    <div>
      <h1>Driver Locations</h1>
      {socket.isConnected ? (
        <div>
          {Array.from(drivers.values()).map((driver) => (
            <div key={driver.driverId}>
              <p>
                {driver.driverName}: ({driver.latitude}, {driver.longitude})
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p>Connecting...</p>
      )}
    </div>
  );
}
```

### Example 3: Notifications with Toast

```typescript
"use client";

import { useEffect } from "react";
import { useSocket } from "@/lib/socket";
import { EVENTS } from "@witylogix/core/realtime";
import type { NotificationEventPayload } from "@witylogix/core/realtime";
import { useToast } from "@/hooks/use-toast";

export function NotificationListener({ shopId }: { shopId: string }) {
  const socket = useSocket(shopId);
  const { toast } = useToast();

  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribe = socket.on(
      EVENTS.NOTIFICATION_SENT,
      (data: NotificationEventPayload) => {
        toast({
          title: data.title,
          description: data.message,
          duration: 5000,
        });
      },
    );

    return unsubscribe;
  }, [socket.isConnected, socket.on, toast]);

  return null; // This component just listens for notifications
}
```

## Event Reference

### Shipment Events

#### `shipment:created`
Fired when a new shipment is created.
```typescript
{
  id: string;
  shopId: string;
  status: string;
  orderId: string;
  trackingNumber: string;
  driverId?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### `shipment:status_changed`
Fired when a shipment's status changes.
```typescript
{
  // ... all shipment fields ...
  previousStatus: string;
  changedAt: string;
  reason?: string;
}
```

#### `shipment:assigned`
Fired when a shipment is assigned to a driver.
```typescript
{
  // ... all shipment fields ...
  driverId: string;
  driverName: string;
  assignedAt: string;
}
```

### Driver Events

#### `driver:status_changed`
Fired when a driver's status changes (ONLINE/OFFLINE/BREAK).

#### `driver:location_updated`
Fired when a driver's location is updated.
```typescript
{
  id: string;
  shopId: string;
  driverId: string;
  driverName: string;
  status: "ONLINE" | "OFFLINE" | "BREAK";
  assignedShipments: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}
```

### Order Events

#### `order:created`
Fired when a new order is created.

#### `order:status_changed`
Fired when an order status changes.

### Other Events

- `notification:sent` - New notification
- `payment:received` - Payment processed
- `activity:new` - New activity log entry
- `system:health` - System health metrics

## Production Considerations

### Scaling with Redis Adapter
The implementation uses Redis as a message bus for horizontal scaling:
```typescript
const pubClient = redis.duplicate();
const subClient = redis.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
ioServer.adapter(createAdapter(pubClient, subClient));
```

This allows Socket.io to work across multiple server instances.

### Connection Limits
Configure these in `setupSocketServer()` based on your infrastructure:
- `pingInterval: 25000` - Server ping interval (ms)
- `pingTimeout: 5000` - Time to wait for client pong (ms)
- `maxHttpBufferSize: 1e6` - Max message size (1MB)

### Monitoring
Access connection stats via:
```typescript
import { getConnectionStats, getSystemHealth } from "./lib/socket";

const stats = getConnectionStats();
// { totalConnections: 42, connectionsPerShop: { "shop-1": 5, ... }, lastUpdated: "..." }

const health = getSystemHealth();
// { status: "healthy", metrics: { connectedClients: 42, activeShops: 3, uptime: ... } }
```

### CORS Configuration
Update CORS in `setupSocketServer()` for your production domain:
```typescript
cors: {
  origin: process.env.DASHBOARD_URL, // e.g., "https://dashboard.witylogix.com"
  credentials: true,
}
```

## Debugging

### Enable Debug Logging
Set environment variable:
```bash
DEBUG=socket.io:* npm run dev
```

### Check Connection Status
In dashboard:
```typescript
const socket = useSocket(shopId);
console.log("Connected:", socket.isConnected);
console.log("Error:", socket.error);
console.log("Last event:", socket.lastEvent);
```

### Test Events in API
```bash
curl -X POST http://localhost:3000/api/v4/shipments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

Watch the dashboard for real-time updates.

## Troubleshooting

### Connection Fails with "Missing authentication token"
Ensure the dashboard stores the JWT token in `sessionStorage` or `localStorage` with key `auth_token`.

### Events Not Being Received
1. Check that the socket is connected: `socket.isConnected === true`
2. Verify subscription: `socket.subscribe(shopId)` was called
3. Check browser console for errors
4. Verify event name matches: use constants from `EVENTS` object

### High Memory Usage
- Check `connectionStats` for unusual connection counts
- Review Redis memory with `redis-cli INFO memory`
- Verify no circular event loops

## Next Steps

1. **Update API Server** - Follow Step 1-2 above
2. **Add Dependencies** - Run `pnpm install` to add socket.io-client
3. **Emit Events** - Update route handlers with `emitShipmentCreated()` etc.
4. **Test Dashboard** - Use examples above to display real-time updates
5. **Monitor** - Use `getConnectionStats()` and `getSystemHealth()` endpoints
