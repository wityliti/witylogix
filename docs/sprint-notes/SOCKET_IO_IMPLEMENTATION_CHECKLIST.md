# Socket.io Implementation Checklist

## Files Created

- [x] `/apps/api/src/lib/socket.ts` - Production-grade Socket.io server
- [x] `/apps/api/src/lib/events.ts` - Event emission helpers for route handlers
- [x] `/packages/core/src/realtime/index.ts` - Shared event types and constants
- [x] `/apps/dashboard/src/lib/socket.ts` - React hook for real-time updates
- [x] `/packages/core/package.json` - Updated with realtime export

## To Complete Integration

### Phase 1: API Server Setup (Required)

- [ ] Update `/apps/api/src/server.ts`:
  - [ ] Import `setupSocketServer` from `./lib/socket.js`
  - [ ] Import `shutdownSocket` from `./lib/socket.js`
  - [ ] Call `setupSocketServer(httpServer, redis, app.log)` after plugins
  - [ ] Call `shutdownSocket(app.log)` in shutdown sequence

### Phase 2: Dashboard Dependencies (Required)

- [ ] Add `socket.io-client` to `/apps/dashboard/package.json`
  - [ ] Run `pnpm install`

### Phase 3: Event Emission (Start with 1-2 routes)

Emit events from route handlers after mutations:

#### Shipments Route (`/apps/api/src/routes/shipments.ts`)

- [ ] Import helpers: `emitShipmentCreated`, `emitShipmentStatusChanged`, `emitShipmentAssigned`
- [ ] After POST `/` (create): emit `emitShipmentCreated(shipmentData)`
- [ ] After PATCH `/:id/status`: emit `emitShipmentStatusChanged(shipmentData)`
- [ ] After PATCH `/:id/assign`: emit `emitShipmentAssigned(shipmentData)`

#### Drivers Route (`/apps/api/src/routes/drivers.ts`)

- [ ] Import: `emitDriverStatusChanged`, `emitDriverLocationUpdated`
- [ ] After status update: emit event
- [ ] After location update: emit event

#### Orders Route (`/apps/api/src/routes/orders.ts`)

- [ ] Import: `emitOrderCreated`, `emitOrderStatusChanged`
- [ ] Emit on create/update

### Phase 4: Dashboard Components (Start with 1-2 pages)

#### Shipments List Page

- [ ] Import `useSocket` from `@/lib/socket`
- [ ] Call `const socket = useSocket(shopId)`
- [ ] Subscribe to `EVENTS.SHIPMENT_CREATED`
- [ ] Subscribe to `EVENTS.SHIPMENT_STATUS_CHANGED`
- [ ] Update state on events

#### Driver Map Page

- [ ] Import `useSocket`
- [ ] Subscribe to `EVENTS.DRIVER_LOCATION_UPDATED`
- [ ] Update map markers on location change

#### Notifications Component

- [ ] Subscribe to `EVENTS.NOTIFICATION_SENT`
- [ ] Display toast/alert on notification

### Phase 5: Testing

- [ ] Test connection with browser DevTools (Application > Cookies/Storage)
- [ ] Check auth token exists
- [ ] Test event emission via API
- [ ] Verify events appear in dashboard
- [ ] Test reconnection after network interruption
- [ ] Test multiple shops isolation
- [ ] Load test with multiple concurrent connections

### Phase 6: Monitoring & Ops

#### Add Health Check Endpoint

- [ ] In `/apps/api/src/server.ts`, add GET `/health/socket`
  - [ ] Returns `getConnectionStats()` and `getSystemHealth()`

#### Set Up Logging

- [ ] Configure DEBUG=socket.io:\* for development
- [ ] Add Socket.io metrics to observability stack

#### Production Configuration

- [ ] Set proper CORS origin
- [ ] Configure Redis adapter for multiple instances
- [ ] Set connection limits based on capacity
- [ ] Configure ping timeouts for network conditions

## Quick Start (Minimal Setup)

If you want to get started with just one feature:

1. Update API server setup in `server.ts` (Phase 1)
2. Add socket.io-client dependency (Phase 2)
3. Emit shipment created events (Phase 3, Shipments only)
4. Add real-time shipment list to dashboard (Phase 4, Shipments only)
5. Test end-to-end

This gives you a working real-time system that can be incrementally expanded.

## File Structure Reference

```
witylogix-platform/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── socket.ts      ← NEW: Server Socket.io setup
│   │       │   └── events.ts      ← NEW: Event emission helpers
│   │       ├── routes/
│   │       │   ├── shipments.ts   ← UPDATE: Emit events
│   │       │   ├── orders.ts      ← UPDATE: Emit events
│   │       │   └── drivers.ts     ← UPDATE: Emit events
│   │       └── server.ts          ← UPDATE: Initialize Socket.io
│   └── dashboard/
│       └── src/
│           └── lib/
│               └── socket.ts      ← NEW: useSocket React hook
└── packages/
    └── core/
        └── src/
            └── realtime/
                └── index.ts       ← NEW: Shared types & events
```

## Code Examples

### Emit Event in Route Handler

```typescript
import { emitShipmentCreated } from "../lib/events.js";

const shipment = await prisma.shipment.create({ data: {...} });
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
```

### Subscribe in Dashboard Component

```typescript
import { useSocket } from "@/lib/socket";
import { EVENTS } from "@witylogix/core/realtime";

export function ShipmentsList({ shopId }) {
  const socket = useSocket(shopId);
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribe = socket.on(EVENTS.SHIPMENT_CREATED, (data) => {
      setShipments(prev => [data, ...prev]);
    });

    return unsubscribe;
  }, [socket.isConnected]);

  return <div>{/* render shipments */}</div>;
}
```

## Support

Refer to `/SOCKET_IO_INTEGRATION.md` for detailed documentation and examples.
