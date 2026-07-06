# Quick Start Guide - Offline & Push Features

## 5-Minute Setup

### 1. Import in Your App Root

```typescript
// src/App.tsx
import OfflineIndicator from './components/OfflineIndicator';
import { offlineQueue } from './lib/offline-queue';
import { pushHandler } from './lib/push-handler';
import { locationService } from './lib/location-service';

function App() {
  useEffect(() => {
    // Register for push notifications
    pushHandler.registerForPush();

    // Start tracking location
    locationService.startTracking(15000);

    // Cleanup
    return () => {
      locationService.stopTracking();
    };
  }, []);

  return (
    <>
      <OfflineIndicator />
      <Routes>{/* Your routes */}</Routes>
    </>
  );
}
```

### 2. Use in Your Screens

```typescript
// Delivery proof screen
import DeliveryProofCapture from './components/DeliveryProofCapture';

export function DeliveryScreen() {
  return (
    <DeliveryProofCapture
      shipmentId={shipmentId}
      recipientName={recipientName}
      onSubmitSuccess={() => navigateNext()}
    />
  );
}
```

```typescript
// Route management screen
import RouteNavigator from './components/RouteNavigator';

export function RouteScreen() {
  const [stops, setStops] = useState([...]);

  return (
    <RouteNavigator
      stops={stops}
      onStopStatusChange={(id, status) => {
        setStops(stops.map(s => s.id === id ? {...s, status} : s));
      }}
    />
  );
}
```

### 3. Queue API Calls Manually

```typescript
// services/api.ts
import { offlineQueue } from "../lib/offline-queue";

export async function submitData(data: any) {
  const opId = offlineQueue.enqueue({
    type: "POST",
    endpoint: "/api/data",
    method: "POST",
    body: data,
  });

  // Try sync if online
  if (navigator.onLine) {
    await offlineQueue.processQueue();
  }

  return opId;
}
```

---

## Common Tasks

### Check Online Status

```typescript
import { useOfflineSync } from './hooks/useOfflineSync';

function MyComponent() {
  const { isOnline, pendingCount, syncNow } = useOfflineSync();

  return (
    <div>
      <p>{isOnline ? 'Online' : 'Offline'} ({pendingCount} pending)</p>
      <button onClick={syncNow}>Sync Now</button>
    </div>
  );
}
```

### Get Current Location

```typescript
import { locationService } from "./lib/location-service";

const location = await locationService.getCurrentPosition();
console.log(`${location?.latitude}, ${location?.longitude}`);
```

### Track Distance Traveled

```typescript
const stats = locationService.getTrackingStats();
console.log(`Distance: ${stats.distanceTraveledKm} km`);
console.log(`Speed: ${stats.averageSpeedKmh} km/h`);
```

### Check Geofence

```typescript
const inZone = locationService.isInGeofence(lat, lng, {
  id: "zone-1",
  name: "Delivery Zone",
  latitude: 40.7128,
  longitude: -74.006,
  radiusMeters: 500,
});
```

### Handle Push Notifications

```typescript
import { pushHandler, PushPayload } from "./lib/push-handler";

useEffect(() => {
  const unsub = pushHandler.subscribe((payload: PushPayload) => {
    console.log(`Received: ${payload.type}`);
    // Deep linking happens automatically
  });
  return () => unsub();
}, []);
```

### Get Notification History

```typescript
const history = pushHandler.getNotificationHistory();
history.forEach((item) => {
  console.log(`${item.displayedAt}: ${item.payload.title}`);
});
```

---

## What Each File Does

| File                                  | Purpose                 | Main Class         |
| ------------------------------------- | ----------------------- | ------------------ |
| `lib/offline-queue.ts`                | Queue & replay requests | `offlineQueue`     |
| `lib/push-handler.ts`                 | Push notifications      | `pushHandler`      |
| `lib/location-service.ts`             | GPS tracking            | `locationService`  |
| `hooks/useOfflineSync.ts`             | React state hook        | `useOfflineSync()` |
| `components/OfflineIndicator.tsx`     | Status bar              | Self-contained     |
| `components/DeliveryProofCapture.tsx` | Photo + signature       | Self-contained     |
| `components/RouteNavigator.tsx`       | Route display           | Self-contained     |

---

## API Endpoints Expected

Your backend should have:

```
POST /api/locations/batch
  { locations: LocationCoordinate[], uploadedAt: number }

POST /api/delivery-proofs
  { shipmentId, recipientName, photoBase64, signatureBase64, ... }
```

---

## Offline Testing

In Chrome DevTools:

1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Try submitting data
5. Should queue automatically
6. Uncheck "Offline" to see auto-sync

---

## Common Integration Patterns

### Pattern 1: Form Submission with Offline Support

```typescript
const handleSubmit = async (data) => {
  const opId = offlineQueue.enqueue({
    type: "POST",
    endpoint: "/api/submit",
    method: "POST",
    body: data,
  });

  if (navigator.onLine) {
    await offlineQueue.processQueue();
  }

  showMessage("Submitted" + (navigator.onLine ? "" : " (will sync)"));
};
```

### Pattern 2: Get Status with Hook

```typescript
function StatusBar() {
  const { isOnline, pendingCount, syncNow, syncInProgress } = useOfflineSync();

  return (
    <>
      {!isOnline && <div>OFFLINE</div>}
      {pendingCount > 0 && (
        <button onClick={syncNow} disabled={syncInProgress}>
          Sync ({pendingCount})
        </button>
      )}
    </>
  );
}
```

### Pattern 3: Conditional Rendering

```typescript
function MyComponent() {
  const { isOnline } = useOfflineSync();

  if (!isOnline) {
    return <OfflineMode />;
  }
  return <OnlineMode />;
}
```

---

## Troubleshooting

| Issue                     | Solution                              |
| ------------------------- | ------------------------------------- |
| Queue not syncing         | Check `offlineQueue.getQueueStatus()` |
| Location not capturing    | Check geolocation permissions         |
| Notifications not showing | Check `Notification.permission`       |
| Signature not saving      | Ensure canvas ref is properly set     |
| Photo preview not showing | Check File API browser support        |

---

## Performance Tips

1. **GPS Tracking**: Use 15-30 second intervals to save battery
2. **Location Upload**: Batch uploads every 10-20 locations
3. **History Cleanup**: `pushHandler.clearHistory()` periodically
4. **Queue Cleanup**: `offlineQueue.clearCompleted()` after syncs
5. **Storage**: Monitor localStorage usage, clear old data

---

## Next Steps

1. Copy all files into your project
2. Import components where needed
3. Initialize services in App.tsx
4. Connect your backend API endpoints
5. Test with DevTools offline mode
6. Deploy!

---

**Need full documentation?** See `OFFLINE_FEATURES.md`

**Need implementation details?** See `IMPLEMENTATION_SUMMARY.md`
