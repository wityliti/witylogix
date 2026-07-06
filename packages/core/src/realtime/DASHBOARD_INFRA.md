# Real-Time Dashboard Infrastructure (Sprint 7.1)

Complete WebSocket infrastructure for real-time dashboard updates with Socket.io, Redis pub/sub, and React hooks.

## Architecture Overview

```
┌─────────────────┐
│   Event Bus     │ (Redis Streams)
│  (Domain        │
│  Events)        │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ Event Broadcaster    │ Subscribes to event bus
├──────────────────────┤
│ • Fan-out logic      │ Order → shop + org
│ • Metrics aggregation│ Driver location → org + driver
│ • Event serialization│ Debounce: 1s for metrics
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│  Dashboard Hub       │ Socket.io server
├──────────────────────┤
│ • Redis adapter      │ Horizontal scaling
│ • Room management    │ org, shop, driver, delivery
│ • Authentication     │ JWT verification
│ • Rate limiting      │ 50 events/sec per conn
│ • Event replay buffer│ 100 events per room
│ • Heartbeat mgmt     │ 30s interval, 60s timeout
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Connection Manager   │ Tenant connection tracking
├──────────────────────┤
│ • Plan-based limits  │ FREE:5, STARTER:25, GROWTH:100, ENTERPRISE:∞
│ • Connection metrics │ Active, peak, errors, latency
│ • Room subscriptions │ Per-connection tracking
│ • Cleanup loop       │ Stale connection removal
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│  React Hooks         │
├──────────────────────┤
│ • useRealtime        │ Core WebSocket connection
│ • useRealtimeMetrics │ Aggregated metrics subscription
│ • useAnimatedMetric  │ Smooth value transitions
│ • useFormattedSLA    │ SLA display with trends
└──────────────────────┘
```

## Files Created

### Backend (packages/core/src/realtime/)

1. **types.ts** (~330 lines)
   - Discriminated union `DashboardEvent` for all event types
   - Event filters, room configuration, connection state
   - Plan-based limits (FREE/STARTER/GROWTH/ENTERPRISE)
   - Constants: `CONNECTION_LIMITS`, `RATE_LIMIT_PER_CONNECTION` (50 events/sec), `EVENT_BUFFER_SIZE` (100), `HEARTBEAT_INTERVAL` (30s)

2. **connection-manager.ts** (~330 lines)
   - `ConnectionManager` class: Tracks active connections per tenant
   - `registerConnection()`: Enforces plan-based connection limits
   - `getConnectionsInRoom()`: Get subscribers for broadcast
   - `subscribeToRoom()`, `unsubscribeFromRoom()`: Room lifecycle
   - `recordHeartbeat()`: Track connection health
   - `updateConnectionMetrics()`: Event counts, latency, drops
   - Stale connection cleanup loop (30s interval)
   - `getConnectionManager()`: Singleton accessor

3. **event-broadcaster.ts** (~345 lines)
   - `EventBroadcaster` class: Bridges event bus → WebSocket rooms
   - Subscribes to event bus with wildcard handlers:
     - `order.*` → shop + org rooms
     - `delivery.*` → shop + org + delivery rooms
     - `driver.location_updated` → org + driver rooms (immediate broadcast)
     - `driver.status_changed` → org + driver rooms
     - `alert.*` → admin + org + shop rooms
   - Metrics aggregation: Debounced 1s for location updates
   - Event sequencing per room for ordering
   - Event serialization with timestamps

4. **dashboard-hub.ts** (~455 lines)
   - `DashboardHub` class: Socket.io server
   - Initialization: Redis adapter setup, broadcaster start
   - Authentication middleware: JWT verification on connect
   - Event handlers:
     - `connection`: Register connection, auto-join org room
     - `subscribe`: Join room with optional filter + event replay
     - `unsubscribe`: Leave room
     - `heartbeat`: Send ack with latency
     - `disconnect`: Cleanup
   - Rate limiting: Tracks per-connection event count with 1s window
   - Event buffer: Stores last 100 events per room
   - Event filtering: By type, shop, driver, severity
   - Singleton: `getDashboardHub(config?)`

5. ****tests**/dashboard-hub.test.ts** (~290 lines)
   - Room management tests (join/leave)
   - Authentication tests (reject without token, invalid token)
   - Rate limiting verification
   - Event replay with filters
   - Connection limits per plan
   - Event broadcasting to correct rooms
   - Heartbeat/timeout handling

### Frontend (apps/dashboard/src/hooks/)

1. **use-realtime.ts** (~340 lines)
   - `useRealtime(roomId, filter?, config?)` hook
   - Socket.io client with auto-reconnect and exponential backoff
   - Configuration:
     - `url`: WebSocket URL (default: `${origin}/realtime`)
     - `token`: JWT for auth
     - `autoReconnect`: Default true
     - `maxReconnectAttempts`: Default 5
     - `initialBackoffMs`: Default 1000ms
     - `maxBackoffMs`: Default 30000ms
   - Returns API:
     - `status`: "connected" | "connecting" | "disconnected" | "error" | "reconnecting"
     - `subscribe(roomId, filter?)`: Join room with optional filter
     - `unsubscribe(roomId)`: Leave room
     - `onEvent(callback)`: Register event listener
     - `offEvent(callback)`: Unregister listener
     - `eventBuffer`: Last 100 events
     - `lastEventId`: For manual replay tracking
     - `latency`: Current connection latency
     - `lastError`: Last error message
   - Event handlers: connect, error, replay_complete, subscribed/unsubscribed
   - Automatic heartbeat: Every 30s
   - Reconnection with exponential backoff (capped at maxBackoffMs)

2. **use-realtime-metrics.ts** (~225 lines)
   - `useRealtimeMetrics(shopId?, config?)` hook
   - Returns `RealtimeMetrics`:
     ```typescript
     {
       ordersToday: number,
       activeDeliveries: number,
       availableDrivers: number,
       slaPercentage: number,
       lastUpdatedAt: string,
       isLoading: boolean,
       prevValues?: RealtimeMetrics
     }
     ```
   - Subscribes to `metrics.updated` events with auto-filter
   - Optional `onMetricsUpdate` callback
   - `useAnimatedMetric(current, previous?, duration)`: Smooth counter transitions
   - `useFormattedSLA(current, previous?)`: Returns formatted string + change indicators

3. **hooks/index.ts** (updated)
   - Added exports for new hooks:
     - `useRealtime`, `UseRealtimeConfig`, `UseRealtimeReturn`
     - `useRealtimeMetrics`, `useAnimatedMetric`, `useFormattedSLA`, `RealtimeMetrics`

4. **realtime/index.ts** (updated)
   - Added exports for dashboard infrastructure:
     - All type definitions (DashboardEvent, EventEnvelope, etc)
     - `ConnectionManager`, `getConnectionManager`
     - `EventBroadcaster`
     - `DashboardHub`, `getDashboardHub`

## Event Types

### Order Events

- `order.created`: { orderId, shopId, customerId?, totalAmount, currency }
- `order.updated`: { orderId, shopId, status, changes? }
- `order.cancelled`: { orderId, shopId, reason? }

### Delivery Events

- `delivery.assigned`: { deliveryId, shopId, driverId, orderId }
- `delivery.status_changed`: { deliveryId, shopId, status, location? }
- `delivery.completed`: { deliveryId, shopId, driverId, duration, distance? }

### Driver Events

- `driver.location_updated`: { driverId, shopId, latitude, longitude, accuracy?, heading?, speed? }
- `driver.status_changed`: { driverId, shopId, status }

### Alert Events

- `alert.sla_breach`: { shopId, breachType, slaTimeMs, actualTimeMs, severity }
- `alert.system`: { alertType, severity, message }

### Metrics Events

- `metrics.updated`: { shopId, ordersToday, activeDeliveries, availableDrivers, slaPercentage }

## Room Organization

| Room                    | Subscribers             | Events                                  |
| ----------------------- | ----------------------- | --------------------------------------- |
| `org:{orgId}`           | All users in org        | Order, delivery, driver, alert, metrics |
| `shop:{shopId}`         | Shop-level users        | Order, delivery, metrics                |
| `driver:{driverId}`     | Driver + dispatch team  | Location, status changes                |
| `delivery:{deliveryId}` | Relevant dispatch staff | Delivery status updates                 |
| `admin`                 | Platform admins         | System alerts                           |

## Plan-Based Limits

| Tier       | Connections | Requests/min | Features         |
| ---------- | ----------- | ------------ | ---------------- |
| FREE       | 5           | 60           | Basic realtime   |
| STARTER    | 25          | 300          | + Metrics        |
| GROWTH     | 100         | 1000         | + Alerts         |
| ENTERPRISE | ∞           | ∞            | + SLA guarantees |

## Rate Limiting

- **Per connection**: 50 events/second
- **Window**: 1 second sliding
- **Behavior**: Excess events dropped, tracked in metrics
- **Consumer sees**: Connection metrics showing `eventsDropped`

## Event Replay

- **Buffer size**: 100 events per room
- **Trigger**: Client subscribes with optional `lastEventId` query parameter
- **Behavior**: Sends all buffered events after `lastEventId`
- **Filtering**: Applied during replay if client specifies filters

## Heartbeat & Health

- **Interval**: 30 seconds
- **Client**: Sends `heartbeat` event
- **Server response**: `heartbeat_ack` with latency + timestamp
- **Timeout**: 60 seconds (2x interval)
- **Stale cleanup**: Every 30s, remove connections that missed heartbeat

## Integration Example

### Server Setup

```typescript
import { createServer } from "http";
import { getDashboardHub } from "@witylogix/core/realtime";
import { jwtService } from "@witylogix/core/auth";
import { eventBus } from "@witylogix/core/event-bus";

const httpServer = createServer();
const hub = getDashboardHub({
  httpServer,
  redisUrl: process.env.REDIS_URL,
  jwtService,
  eventBus,
});

await hub.initialize();
httpServer.listen(3000);
```

### React Component

```typescript
import { useRealtime, useRealtimeMetrics } from "@witylogix/dashboard/hooks";

function DashboardMetrics({ token, shopId }) {
  const metrics = useRealtimeMetrics(shopId, { token });

  return (
    <div>
      <div>Orders Today: {metrics.ordersToday}</div>
      <div>Active Deliveries: {metrics.activeDeliveries}</div>
      <div>Available Drivers: {metrics.availableDrivers}</div>
      <div>SLA: {metrics.slaPercentage}%</div>
    </div>
  );
}

function RealtimeOrderFeed({ token, shopId }) {
  const realtime = useRealtime(`shop:${shopId}`,
    { eventTypes: ["order.created", "order.updated"] },
    { token }
  );

  const [orders, setOrders] = useState([]);

  realtime.onEvent((event) => {
    if (event.data.event === "order.created") {
      setOrders(prev => [event.data, ...prev]);
    }
  });

  return (
    <div>
      {orders.map(o => <OrderCard key={o.orderId} order={o} />)}
    </div>
  );
}
```

## Performance Considerations

1. **Location aggregation**: Driver location updates are debounced 1s before broadcast
2. **Event buffer**: Limited to 100 events per room to manage memory
3. **Connection cleanup**: Stale connections removed every 30s
4. **Rate limiting**: Prevents single connection from overwhelming server
5. **Redis adapter**: Enables horizontal scaling across multiple Socket.io instances
6. **Event filtering**: Clients can filter by event type, shop, driver on subscribe

## Security

- **Authentication**: All connections require valid JWT token
- **Token verification**: On connect, validated with JwtService
- **Room isolation**: Users can only access org-level rooms for their org
- **Plan enforcement**: Connection limits enforced per plan tier
- **Rate limiting**: Malicious high-volume clients rate-limited

## Testing

Run dashboard hub tests:

```bash
cd packages/core
npm test -- src/realtime/__tests__/dashboard-hub.test.ts
```

Test files include:

- Room join/leave
- Authentication (valid/invalid tokens)
- Rate limiting enforcement
- Event replay with filters
- Connection limits per plan
- Event broadcasting
- Heartbeat/timeout
