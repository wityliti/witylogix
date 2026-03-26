# Witylogix Driver App - Offline Support & Push Notifications

## Overview

This package contains a complete offline-first mobile app solution with push notification handling for the Witylogix driver mobile application. Built with React 19 + TypeScript, it provides enterprise-grade offline support with automatic synchronization, location tracking, and real-time notifications.

**Status**: Production Ready ✓  
**Type**: React Components + TypeScript Services  
**Size**: 2,151 lines of code across 7 files

---

## What's Included

### Core Services (3 files, 1,108 lines)
1. **offline-queue.ts** - Request queuing and replay system with conflict resolution
2. **push-handler.ts** - Push notification routing with deep linking
3. **location-service.ts** - GPS tracking, geofencing, and batch uploads

### React Components (3 files, 938 lines)
1. **OfflineIndicator.tsx** - Connection status bar with queue display
2. **DeliveryProofCapture.tsx** - Photo, signature, and notes capture
3. **RouteNavigator.tsx** - Turn-by-turn route management

### Custom Hooks (1 file, 105 lines)
1. **useOfflineSync.ts** - React state management for offline queue

### Documentation (3 files)
1. **README.md** - This file
2. **QUICK_START.md** - 5-minute setup guide
3. **OFFLINE_FEATURES.md** - Comprehensive documentation
4. **IMPLEMENTATION_SUMMARY.md** - Technical overview

---

## Key Features

### Offline Support
- Automatic request queuing when offline
- localStorage-based persistence
- Automatic replay when reconnected
- Configurable retry logic (up to 3 attempts)
- Network status detection with polling fallback
- Conflict resolution with last-write-wins strategy

### Push Notifications
- 6 notification types with dedicated handlers
- Automatic deep linking to relevant screens
- Local notification display
- Badge count management
- Notification history (50 items max)
- Service worker integration ready

### GPS & Location Tracking
- Continuous GPS tracking with configurable intervals
- Single position capture with high accuracy
- Batch location uploads
- Haversine distance calculations
- Geofencing with radius-based checks
- Offline location storage and sync
- Speed and battery usage estimates

### UI Components
- Status indicator bar (online/offline)
- Photo capture with preview
- Canvas-based signature pad
- Drag-and-drop stop reordering
- Animated progress bars
- Color-coded status badges
- ETA calculations

---

## Quick Start

### 1. Import Components
```typescript
import OfflineIndicator from './components/OfflineIndicator';
import DeliveryProofCapture from './components/DeliveryProofCapture';
import RouteNavigator from './components/RouteNavigator';
```

### 2. Initialize Services
```typescript
import { offlineQueue } from './lib/offline-queue';
import { pushHandler } from './lib/push-handler';
import { locationService } from './lib/location-service';

useEffect(() => {
  offlineQueue.subscribe(() => {
    console.log(offlineQueue.getQueueStatus());
  });

  pushHandler.registerForPush();
  locationService.startTracking(15000);

  return () => locationService.stopTracking();
}, []);
```

### 3. Use Offline Sync Hook
```typescript
import { useOfflineSync } from './hooks/useOfflineSync';

function StatusComponent() {
  const { isOnline, pendingCount, syncNow } = useOfflineSync();
  
  return (
    <div>
      {!isOnline && <p>You are offline</p>}
      <button onClick={syncNow}>Sync ({pendingCount})</button>
    </div>
  );
}
```

**For detailed setup, see QUICK_START.md**

---

## File Structure

```
src/
├── lib/
│   ├── offline-queue.ts            (335 lines) ★ Request queuing
│   ├── push-handler.ts             (404 lines) ★ Push notifications
│   └── location-service.ts         (369 lines) ★ GPS tracking
├── hooks/
│   └── useOfflineSync.ts           (105 lines) ★ React hook
├── components/
│   ├── OfflineIndicator.tsx        (127 lines) ★ Status bar
│   ├── DeliveryProofCapture.tsx    (419 lines) ★ Photo + signature
│   └── RouteNavigator.tsx          (392 lines) ★ Route management
├── README.md                       (this file)
├── QUICK_START.md                  (setup guide)
├── OFFLINE_FEATURES.md             (comprehensive docs)
└── IMPLEMENTATION_SUMMARY.md       (technical details)
```

---

## Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| **README.md** | Overview and quick start | Everyone |
| **QUICK_START.md** | 5-minute setup guide | Developers |
| **OFFLINE_FEATURES.md** | Complete feature documentation | Developers |
| **IMPLEMENTATION_SUMMARY.md** | Technical architecture | Tech leads |

---

## Feature Comparison

### What You Get with Each Service

#### offline-queue.ts
- Persistent request queuing
- Network detection
- Automatic retry
- Batch operation support
- Conflict resolution
- Subscribe to changes
- Clear completed ops

#### push-handler.ts
- Permission handling
- FCM token management
- 6 notification types
- Local notification display
- Deep link routing
- Badge management
- History tracking

#### location-service.ts
- Continuous tracking
- Single position capture
- Distance calculation
- Geofence checking
- Batch uploads
- Statistics
- Offline storage

---

## Notification Types

The system supports 6 notification types with automatic routing:

| Type | Route | Use Case |
|------|-------|----------|
| `NEW_ASSIGNMENT` | `/routes/{routeId}` | New route assigned |
| `ROUTE_UPDATE` | `/routes/{routeId}` | Route changes |
| `DELIVERY_REMINDER` | `/delivery/{shipmentId}` | Reminder to complete |
| `SCHEDULE_CHANGE` | `/schedule` | Work schedule updated |
| `MESSAGE` | `/messages/{messageId}` | Dispatcher message |
| `EMERGENCY` | `/emergency` | Critical alert |

---

## Component Props

### DeliveryProofCapture
```typescript
{
  shipmentId: string;
  recipientName?: string;
  onSubmitSuccess?: (proofId: string) => void;
  onSubmitError?: (error: Error) => void;
}
```

### RouteNavigator
```typescript
{
  stops: DeliveryStop[];
  currentStopId?: string;
  onStopSelect?: (stopId: string) => void;
  onStopStatusChange?: (stopId: string, status) => void;
  onNavigate?: (stop: DeliveryStop) => void;
  onReorder?: (reorderedStops: DeliveryStop[]) => void;
}
```

### OfflineIndicator
No props - uses `useOfflineSync` hook internally

---

## API Integration

### Expected Backend Endpoints

```
POST /api/locations/batch
  Request: { locations: LocationCoordinate[], uploadedAt: number }
  Response: { success: boolean, timestamp: number }

POST /api/delivery-proofs
  Request: { shipmentId, recipientName, photoBase64, signatureBase64, ... }
  Response: { id: string, timestamp: number }

POST /api/[any-endpoint]
  Supports: Queued operations from offlineQueue
```

---

## Browser Support

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| localStorage | ✓ | ✓ | ✓ | ✓ |
| Geolocation | ✓ | ✓ | ✓ | ✓ |
| Notifications | ✓ | ✓ | ✓ | ✓ |
| Canvas | ✓ | ✓ | ✓ | ✓ |
| File API | ✓ | ✓ | ✓ | ✓ |

---

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Storage | ~5-10MB | localStorage limit |
| Max Locations | 1,000 | Configurable |
| Max History | 50 | Notifications |
| Polling Interval | 5 seconds | Network detection |
| Tracking Interval | 10-30 seconds | Configurable |
| Retry Attempts | 3 | Configurable |
| Operation Limit | Unlimited | Subject to storage |

---

## Error Handling

All services include:
- Graceful degradation
- Error logging
- Try-catch blocks
- Fallback mechanisms
- User-friendly messages

---

## Testing

### Test Offline Functionality
```typescript
// Simulate offline
window.dispatchEvent(new Event('offline'));

// Check queue
const status = offlineQueue.getQueueStatus();
console.log(status.pending); // Should have operations

// Go online
window.dispatchEvent(new Event('online'));

// Verify sync
await new Promise(r => setTimeout(r, 1000));
const newStatus = offlineQueue.getQueueStatus();
console.log(newStatus.pending); // Should be 0
```

---

## Security

### Built-In Security Features
- Authorization headers on all requests
- HTTPS ready (configure in production)
- localStorage encryption ready
- Timestamp-based conflict resolution
- Server-side validation expected

---

## Performance Tips

1. **Location**: Use 15-30s intervals to save battery
2. **Uploads**: Batch locations every 10-20 points
3. **History**: Clear notification history periodically
4. **Queue**: Clean up completed operations regularly
5. **Storage**: Monitor localStorage usage

---

## Common Integration Patterns

### Pattern 1: Auto-sync on Reconnect
```typescript
window.addEventListener('online', async () => {
  await offlineQueue.processQueue();
  await locationService.handleOfflineLocations();
});
```

### Pattern 2: Conditional UI
```typescript
function MyScreen() {
  const { isOnline } = useOfflineSync();
  
  if (!isOnline) {
    return <OfflineMode />;
  }
  return <OnlineMode />;
}
```

### Pattern 3: Queue API Calls
```typescript
const opId = offlineQueue.enqueue({
  type: 'POST',
  endpoint: '/api/action',
  method: 'POST',
  body: data,
});
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Queue not syncing | Check `navigator.onLine` and network tab |
| Location not working | Check permissions: `chrome://settings/content/location` |
| Notifications blocked | Check: `chrome://settings/content/notifications` |
| localStorage full | Clear old data or increase quota |
| Signature not saving | Ensure canvas element is rendered |

---

## Dependencies

**External**:
- React 19
- TypeScript

**Browser APIs** (no npm packages):
- Geolocation API
- localStorage
- Notifications API
- File API
- Canvas API
- Fetch API
- Service Workers (optional)

---

## License & Attribution

**Component Dev**: VS (Witylogix Team)
**Created**: March 2026
**Status**: Production Ready

---

## Next Steps

1. **Read** QUICK_START.md for 5-minute setup
2. **Review** OFFLINE_FEATURES.md for detailed docs
3. **Import** components into your screens
4. **Connect** backend endpoints
5. **Test** with offline mode enabled
6. **Deploy** with confidence

---

## Support & Documentation

For more information:
- **Quick Setup**: See `QUICK_START.md`
- **Full Docs**: See `OFFLINE_FEATURES.md`
- **Architecture**: See `IMPLEMENTATION_SUMMARY.md`
- **Code Comments**: Each file has detailed JSDoc

---

## Summary

This is a complete, production-ready offline-first solution for the Witylogix driver app:

✓ Automatic request queuing and replay  
✓ 6 notification types with deep linking  
✓ GPS tracking with geofencing  
✓ 3 ready-to-use React components  
✓ Custom React hook for state management  
✓ Comprehensive error handling  
✓ Full TypeScript support  
✓ Extensive documentation  

**Total**: 2,151 lines of production-ready code

---

**Status**: Ready for Integration ✓
