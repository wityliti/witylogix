# Real-Time Dashboard Implementation Guide

Quick reference for developers integrating the real-time dashboard infrastructure.

## Quick Start

### 1. Initialize Hub (Server-Side)

```typescript
// api/server.ts
import http from "http";
import express from "express";
import { getDashboardHub } from "@witylogix/core/realtime";
import { jwtService } from "@witylogix/core/auth";
import { eventBus } from "@witylogix/core/event-bus";

const app = express();
const httpServer = http.createServer(app);

// Initialize realtime hub
const hub = getDashboardHub({
  httpServer,
  redisUrl: process.env.REDIS_URL, // Optional, enables clustering
  jwtService,
  eventBus,
  namespace: "/realtime", // Default
});

await hub.initialize();

httpServer.listen(3000);
```

### 2. Subscribe to Events (Server-Side)

Events flow automatically from the event bus to rooms. No additional setup needed. The `EventBroadcaster` handles all subscriptions:

```typescript
// Events are auto-broadcast based on fan-out rules:
// - order.* → shop:{shopId} + org:{orgId}
// - delivery.* → shop:{shopId} + org:{orgId} + delivery:{deliveryId}
// - driver.location_updated → org:{orgId} + driver:{driverId}
// - alert.* → admin + org:{orgId} + shop:{shopId}

await eventBus.emit("order.created", {
  orderId: "order_123",
  shopId: "shop_456",
  customerId: "cust_789",
  totalAmount: 99.99,
  currency: "USD",
  createdAt: new Date().toISOString(),
}, {
  tenantId: "shop_456",
  correlationId: "req_uuid",
});
```

### 3. Connect Client (React)

```typescript
// dashboard/pages/Dashboard.tsx
import { useRealtime, useRealtimeMetrics } from "@/hooks";
import { useAuth } from "@/auth";

export function Dashboard() {
  const { token } = useAuth();
  const { orgId, shopId } = useCurrentOrg();

  // Subscribe to metrics
  const metrics = useRealtimeMetrics(shopId, { token });

  // Subscribe to orders
  const orders = useRealtime(
    `shop:${shopId}`,
    { eventTypes: ["order.created", "order.updated"] },
    { token }
  );

  const [orderList, setOrderList] = useState([]);

  // Listen for order events
  orders.onEvent((event) => {
    if (event.data.event === "order.created") {
      setOrderList(prev => [event.data, ...prev]);
    }
  });

  return (
    <div>
      <h1>Dashboard</h1>
      <div>Orders: {metrics.ordersToday}</div>
      <div>Deliveries: {metrics.activeDeliveries}</div>
      {orderList.map(order => (
        <OrderCard key={order.orderId} order={order} />
      ))}
    </div>
  );
}
```

## Common Patterns

### Pattern 1: Real-Time Order Feed

```typescript
function OrderFeed({ shopId, token }) {
  const realtime = useRealtime(
    `shop:${shopId}`,
    { eventTypes: ["order.created", "order.updated"] },
    { token }
  );

  const [orders, setOrders] = useState([]);

  realtime.onEvent((event) => {
    setOrders(prev => {
      const updated = [...prev];

      if (event.data.event === "order.created") {
        updated.unshift(event.data);
      } else if (event.data.event === "order.updated") {
        const idx = updated.findIndex(o => o.orderId === event.data.orderId);
        if (idx >= 0) updated[idx] = event.data;
      }

      return updated.slice(0, 50); // Keep last 50
    });
  });

  return (
    <div>
      {orders.map(o => <OrderCard key={o.orderId} order={o} />)}
    </div>
  );
}
```

### Pattern 2: Driver Location Tracking

```typescript
function DriverMap({ driverId, orgId, token }) {
  const realtime = useRealtime(
    `driver:${driverId}`,
    { eventTypes: ["driver.location_updated", "driver.status_changed"] },
    { token }
  );

  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("offline");

  realtime.onEvent((event) => {
    if (event.data.event === "driver.location_updated") {
      setLocation({
        lat: event.data.latitude,
        lng: event.data.longitude,
        heading: event.data.heading,
      });
    } else if (event.data.event === "driver.status_changed") {
      setStatus(event.data.status);
    }
  });

  return (
    <Map center={location} markers={[{ ...location, status }]} />
  );
}
```

### Pattern 3: SLA Alert Monitoring

```typescript
function SLAAlerts({ shopId, token }) {
  const realtime = useRealtime(
    `shop:${shopId}`,
    {
      eventTypes: ["alert.sla_breach"],
      minSeverity: "warning"
    },
    { token }
  );

  const [alerts, setAlerts] = useState([]);

  realtime.onEvent((event) => {
    if (event.data.event === "alert.sla_breach") {
      setAlerts(prev => [event.data, ...prev].slice(0, 20));
    }
  });

  return (
    <div>
      {alerts.map(alert => (
        <Alert key={alert.id} severity={alert.severity}>
          {alert.breachType}: {alert.actualTimeMs / 1000}s
          (SLA: {alert.slaTimeMs / 1000}s)
        </Alert>
      ))}
    </div>
  );
}
```

### Pattern 4: Animated Metrics

```typescript
import { useAnimatedMetric, useFormattedSLA } from "@/hooks";

function MetricsCard({ metrics }) {
  const animatedOrders = useAnimatedMetric(
    metrics.ordersToday,
    metrics.prevValues?.ordersToday
  );

  const animatedDeliveries = useAnimatedMetric(
    metrics.activeDeliveries,
    metrics.prevValues?.activeDeliveries,
    300 // 300ms animation
  );

  const { formatted: sla, improved } = useFormattedSLA(
    metrics.slaPercentage,
    metrics.prevValues?.slaPercentage
  );

  return (
    <div className="metrics-grid">
      <Card title="Orders Today">
        <Counter value={animatedOrders} />
      </Card>
      <Card title="Active Deliveries">
        <Counter value={animatedDeliveries} />
      </Card>
      <Card title="SLA Compliance">
        <div className={improved ? "text-green-600" : "text-amber-600"}>
          {sla}
        </div>
      </Card>
    </div>
  );
}
```

## Debugging

### Connection Status Monitoring

```typescript
function DebugPanel({ token, shopId }) {
  const realtime = useRealtime(`shop:${shopId}`, {}, { token });

  return (
    <div style={{ fontSize: 12, fontFamily: "monospace" }}>
      <div>Status: <span style={{ color:
        realtime.status === "connected" ? "green" : "red"
      }}>{realtime.status}</span></div>
      <div>Latency: {realtime.latency}ms</div>
      <div>Events: {realtime.eventBuffer.length}</div>
      {realtime.lastError && (
        <div style={{ color: "red" }}>Error: {realtime.lastError}</div>
      )}
    </div>
  );
}
```

### Event Logging

```typescript
function EventLogger({ token, roomId }) {
  const realtime = useRealtime(roomId, {}, { token });
  const [logs, setLogs] = useState([]);

  realtime.onEvent((event) => {
    setLogs(prev => [
      {
        time: new Date().toLocaleTimeString(),
        event: event.data.event,
        seq: event.seq,
      },
      ...prev
    ].slice(0, 100));
  });

  return (
    <div>
      {logs.map((log, i) => (
        <div key={i}>
          {log.time} | #{log.seq} | {log.event}
        </div>
      ))}
    </div>
  );
}
```

## Error Handling

```typescript
function SafeDashboard({ token, shopId }) {
  const realtime = useRealtime(`shop:${shopId}`, {}, { token });

  useEffect(() => {
    if (realtime.lastError) {
      console.error("Connection error:", realtime.lastError);
      // Show user-facing error
      showNotification({
        type: "error",
        message: "Connection lost. Attempting to reconnect...",
      });
    }
  }, [realtime.lastError]);

  if (realtime.status === "error") {
    return <ErrorFallback onRetry={() => window.location.reload()} />;
  }

  if (realtime.status === "connecting" || realtime.status === "disconnected") {
    return <LoadingSpinner />;
  }

  return <DashboardContent />;
}
```

## Configuration

### Advanced useRealtime Config

```typescript
const realtime = useRealtime(
  `shop:${shopId}`,
  { eventTypes: ["order.created"] },
  {
    url: "wss://api.example.com/realtime", // Custom URL
    token: jwtToken,
    autoReconnect: true,
    maxReconnectAttempts: 10, // Retry 10 times
    initialBackoffMs: 500, // Start with 500ms backoff
    maxBackoffMs: 60000, // Cap at 60s
  }
);
```

## Performance Tips

1. **Debounce handlers**: High-frequency events like location updates
   ```typescript
   import { debounce } from "lodash-es";

   const handleLocation = debounce((event) => {
     updateMap(event.data);
   }, 100);

   realtime.onEvent(handleLocation);
   ```

2. **Unsubscribe from unused rooms**:
   ```typescript
   const realtime = useRealtime(`org:${orgId}`, {}, { token });

   // Leave room when no longer needed
   return () => {
     realtime.unsubscribe(`org:${orgId}`);
   };
   ```

3. **Limit buffer sizes**: Process and discard old events
   ```typescript
   const [orders, setOrders] = useState([]);

   realtime.onEvent((event) => {
     setOrders(prev => [event.data, ...prev].slice(0, 50));
   });
   ```

4. **Use event filters** to reduce client processing:
   ```typescript
   // Only subscribe to critical alerts
   useRealtime(
     `shop:${shopId}`,
     { eventTypes: ["alert.sla_breach"], minSeverity: "critical" },
     { token }
   );
   ```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing auth token" | Ensure token is passed to useRealtime config |
| "Unauthorized room access" | Verify user's org matches room org |
| Connection timeout | Check network, increase `maxBackoffMs` |
| High memory usage | Reduce event buffer by processing less data |
| Events out of order | Use `event.seq` to sort/reorder client-side |
| Metrics not updating | Verify event bus emits to correct shopId |

## API Reference

### useRealtime(roomId, filter?, config?)

```typescript
const realtime = useRealtime(
  "org:org_123",
  { eventTypes: ["order.created"], shopIds: ["shop_456"] },
  { token: "jwt..." }
);

// Returns:
{
  status: "connected" | "connecting" | "disconnected" | "error" | "reconnecting",
  subscribe: (roomId, filter?) => Promise<void>,
  unsubscribe: (roomId) => Promise<void>,
  onEvent: (callback) => void,
  offEvent: (callback) => void,
  eventBuffer: EventEnvelope[],
  lastEventId?: string,
  disconnect: () => void,
  lastError?: string,
  latency: number,
}
```

### useRealtimeMetrics(shopId?, config?)

```typescript
const metrics = useRealtimeMetrics(
  "shop_123",
  { token: "jwt...", onMetricsUpdate: (m) => console.log(m) }
);

// Returns RealtimeMetrics:
{
  ordersToday: number,
  activeDeliveries: number,
  availableDrivers: number,
  slaPercentage: number, // 0-100
  lastUpdatedAt: string,
  isLoading: boolean,
  prevValues?: RealtimeMetrics,
}
```

### useAnimatedMetric(current, previous?, duration?)

```typescript
const animated = useAnimatedMetric(42, 38, 500);
// Smoothly animates from 38 to 42 over 500ms
```

### useFormattedSLA(current, previous?)

```typescript
const { formatted, changed, improved } = useFormattedSLA(95, 90);
// Returns: { formatted: "95%", changed: true, improved: true }
```
