# Driver App - Offline Support & Push Notification Features

## Overview

This document describes the offline support and push notification handling implementation for the Witylogix driver mobile app. The system is built with React 19 + TypeScript and provides comprehensive offline functionality with automatic synchronization when reconnected.

**Total Lines of Code: 2,151 lines across 7 files**

---

## Architecture

### Core Modules

```
src/
├── lib/
│   ├── offline-queue.ts          (335 lines) - Request queuing & replay
│   ├── push-handler.ts           (404 lines) - Push notifications
│   └── location-service.ts       (369 lines) - GPS tracking & geofencing
├── hooks/
│   └── useOfflineSync.ts         (105 lines) - React state management
└── components/
    ├── OfflineIndicator.tsx      (127 lines) - Status UI
    ├── DeliveryProofCapture.tsx  (419 lines) - Photo + signature capture
    └── RouteNavigator.tsx        (392 lines) - Turn-by-turn navigation
```

---

## File Descriptions

### 1. `lib/offline-queue.ts` (335 lines)

**OfflineQueue Class** - Manages API request queuing when offline with localStorage-based persistence.

#### Key Features:

- **Queue Storage**: Persists operations to localStorage using JSON serialization
- **Operation Types**: POST, PUT, PATCH, DELETE with automatic retry
- **Conflict Resolution**: Last-write-wins strategy with server timestamp comparison
- **Network Detection**: `navigator.onLine` with 5-second polling fallback
- **Auto-Sync**: Automatic replay when connection restored
- **Retry Logic**: Configurable max retries (default: 3) with exponential backoff

#### Key Methods:

```typescript
enqueue(operation): string
  // Add operation to queue, returns operation ID

processQueue(): Promise<void>
  // Process all pending operations when online

getQueueStatus(): QueueStatus
  // Returns { pending, failed, total, lastSyncAt }

retryFailed(): Promise<void>
  // Retry all failed operations with reset retry count

clearCompleted(): void
  // Remove completed operations from queue

subscribe(listener): () => void
  // Subscribe to queue changes, returns unsubscribe function

removeOperation(id): void
  // Manually remove operation from queue

isCurrentlyOnline(): boolean
  // Check current online status

destroy(): void
  // Cleanup and clear all data
```

#### Data Structure:

```typescript
interface QueuedOperation {
  id: string; // Unique operation ID
  type: "POST" | "PUT" | "PATCH" | "DELETE"; // HTTP method
  endpoint: string; // API endpoint
  method: string; // Action method name
  body: Record<string, any>; // Request payload
  createdAt: number; // Timestamp
  retryCount: number; // Number of retry attempts
  status: "pending" | "completed" | "failed"; // Current status
  lastError?: string; // Error message if failed
  serverTimestamp?: number; // Server response timestamp
}

interface QueueStatus {
  pending: number; // Count of pending operations
  failed: number; // Count of failed operations
  total: number; // Total operations in queue
  lastSyncAt?: number; // Timestamp of last successful sync
}
```

#### Usage Example:

```typescript
import { offlineQueue } from "../lib/offline-queue";

// Enqueue an operation
const opId = offlineQueue.enqueue({
  type: "POST",
  endpoint: "/api/deliveries",
  method: "recordDelivery",
  body: { shipmentId: "123", status: "completed" },
});

// Subscribe to changes
const unsubscribe = offlineQueue.subscribe(() => {
  const status = offlineQueue.getQueueStatus();
  console.log(`Pending: ${status.pending}, Failed: ${status.failed}`);
});

// Manual sync
await offlineQueue.processQueue();

// Cleanup
unsubscribe();
```

---

### 2. `lib/push-handler.ts` (404 lines)

**PushNotificationHandler Class** - Manages push notifications with routing, local display, and deep linking.

#### Notification Types:

- `NEW_ASSIGNMENT` - New route/shipment assignment
- `ROUTE_UPDATE` - Route changes or updated stops
- `DELIVERY_REMINDER` - Reminder to complete delivery
- `SCHEDULE_CHANGE` - Work schedule/shift changes
- `MESSAGE` - Text message from dispatcher/customer
- `EMERGENCY` - High-priority emergency alert

#### Key Features:

- **FCM Integration**: Request permission, get FCM token (web-compatible)
- **Local Notifications**: Display native notifications with badges
- **Deep Linking**: Route notifications to relevant app screens
- **History Tracking**: Store up to 50 recent notifications locally
- **Badge Management**: Update app badge count
- **Event Broadcasting**: Dispatch custom events for UI updates

#### Key Methods:

```typescript
registerForPush(): Promise<string | null>
  // Request notification permission and return FCM token

handleIncomingPush(payload: PushPayload): Promise<void>
  // Route notification by type and show local notification

showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void>
  // Display browser notification

handleNotificationAction(
  action: string,
  data: Record<string, any>
): void
  // Deep link to relevant screen based on notification type

updateBadgeCount(count: number): void
  // Update app badge and dispatch event

clearBadge(): void
  // Clear app badge

getBadgeCount(): number
  // Get current badge count

getNotificationHistory(): LocalNotificationHistory[]
  // Get recent notifications from localStorage

clearHistory(): void
  // Clear notification history

subscribe(listener): () => void
  // Subscribe to incoming push notifications
```

#### Data Structures:

```typescript
interface PushPayload {
  type: NotificationType; // Notification category
  title: string; // Notification title
  body: string; // Notification body
  data: Record<string, any>; // Additional data
  timestamp: number; // Timestamp
  notificationId?: string; // Optional notification ID
}

interface LocalNotificationHistory {
  id: string; // Unique ID
  payload: PushPayload; // Full payload
  displayedAt: number; // Display timestamp
  actionTaken?: string; // Action user took
}
```

#### Deep Link Mapping:

| Notification Type | Route                    |
| ----------------- | ------------------------ |
| NEW_ASSIGNMENT    | `/routes/{routeId}`      |
| ROUTE_UPDATE      | `/routes/{routeId}`      |
| DELIVERY_REMINDER | `/delivery/{shipmentId}` |
| SCHEDULE_CHANGE   | `/schedule`              |
| MESSAGE           | `/messages/{messageId}`  |
| EMERGENCY         | `/emergency`             |

#### Usage Example:

```typescript
import { pushHandler, PushPayload } from "../lib/push-handler";

// Register for push notifications
const fcmToken = await pushHandler.registerForPush();

// Subscribe to incoming notifications
const unsubscribe = pushHandler.subscribe((payload) => {
  console.log("Received notification:", payload.type);
});

// Simulate incoming notification (for testing)
const payload: PushPayload = {
  type: "NEW_ASSIGNMENT",
  title: "New Delivery Route",
  body: "Route R123 assigned with 5 stops",
  data: { routeId: "R123", stopCount: 5 },
  timestamp: Date.now(),
};
window.PushNotificationHandler?.handleIncomingPush(payload);

// Get notification history
const history = pushHandler.getNotificationHistory();
console.log(`Recent notifications: ${history.length}`);

// Update badge
pushHandler.updateBadgeCount(5);
```

---

### 3. `lib/location-service.ts` (369 lines)

**LocationService Class** - GPS tracking with geofencing, distance calculation, and batch upload.

#### Key Features:

- **Continuous Tracking**: Watch geolocation with configurable intervals
- **High Accuracy**: High accuracy mode with 10-second timeout
- **Haversine Formula**: Accurate distance calculation in kilometers
- **Geofencing**: Check if location is within delivery zone
- **Batch Upload**: Send multiple locations to server efficiently
- **Offline Storage**: Store locations locally when offline
- **Statistics**: Track distance, speed, battery usage estimates

#### Key Methods:

```typescript
startTracking(intervalMs?: number): Promise<void>
  // Start GPS tracking (default: 10s interval)

stopTracking(): void
  // Stop GPS tracking and cleanup

getCurrentPosition(): Promise<LocationCoordinate | null>
  // Get single position with high accuracy

batchUploadLocations(
  positions: LocationCoordinate[]
): Promise<boolean>
  // Upload multiple locations to server

handleOfflineLocations(): Promise<void>
  // Sync stored locations when back online

calculateDistanceTraveled(positions?: LocationCoordinate[]): number
  // Calculate total distance in kilometers

isInGeofence(
  latitude: number,
  longitude: number,
  fence: GeofenceArea
): boolean
  // Check if within delivery zone radius

getTrackingStats(): TrackingStats
  // Get distance, locations count, battery usage, speed

getStoredLocations(): LocationCoordinate[]
  // Get all stored locations

clearLocations(): void
  // Clear stored locations

subscribe(listener): () => void
  // Subscribe to location updates

isTrackingActive(): boolean
  // Check if tracking is running

destroy(): void
  // Cleanup resources
```

#### Data Structures:

```typescript
interface LocationCoordinate {
  latitude: number; // Latitude in decimal degrees
  longitude: number; // Longitude in decimal degrees
  accuracy: number; // Accuracy radius in meters
  altitude?: number; // Altitude in meters (optional)
  speed?: number; // Speed in m/s (optional)
  heading?: number; // Heading in degrees (optional)
  timestamp: number; // Timestamp when captured
}

interface GeofenceArea {
  id: string; // Geofence ID
  name: string; // Zone name
  latitude: number; // Center latitude
  longitude: number; // Center longitude
  radiusMeters: number; // Radius in meters
}

interface TrackingStats {
  distanceTraveledKm: number; // Total distance in km
  locationsRecorded: number; // Count of location points
  batteryUsagePercent: number; // Estimated battery drain
  trackingDurationMinutes: number; // How long tracking has run
  averageSpeedKmh: number; // Average speed
}
```

#### Usage Example:

```typescript
import { locationService } from "../lib/location-service";

// Start tracking
await locationService.startTracking(15000); // 15s interval

// Get current position
const position = await locationService.getCurrentPosition();
console.log(`Current: ${position?.latitude}, ${position?.longitude}`);

// Subscribe to updates
const unsubscribe = locationService.subscribe((location) => {
  console.log(`Location: ${location.latitude}, ${location.longitude}`);
});

// Check geofence
const deliveryZone = {
  id: "zone-1",
  name: "Downtown",
  latitude: 40.7128,
  longitude: -74.006,
  radiusMeters: 500,
};
const inZone = locationService.isInGeofence(
  position!.latitude,
  position!.longitude,
  deliveryZone,
);

// Get stats
const stats = locationService.getTrackingStats();
console.log(
  `Distance: ${stats.distanceTraveledKm}km, Speed: ${stats.averageSpeedKmh}km/h`,
);

// Sync offline locations
await locationService.handleOfflineLocations();

// Stop tracking
locationService.stopTracking();
unsubscribe();
```

---

### 4. `hooks/useOfflineSync.ts` (105 lines)

**useOfflineSync React Hook** - Provides offline queue state management for components.

#### Hook State:

```typescript
interface OfflineSyncState {
  isOnline: boolean; // Current connection status
  pendingCount: number; // Operations awaiting sync
  failedCount: number; // Failed operations
  totalQueueCount: number; // Total in queue
  syncInProgress: boolean; // Sync operation in progress
  lastSyncAt?: number; // Last successful sync timestamp
}
```

#### Hook Returns:

```typescript
{
  // State
  isOnline,
  pendingCount,
  failedCount,
  totalQueueCount,
  syncInProgress,
  lastSyncAt,

  // Actions
  syncNow(): Promise<void>,
  retryFailed(): Promise<void>,
  clearCompleted(): void
}
```

#### Features:

- **Auto-subscription**: Subscribes to OfflineQueue changes
- **Event Listeners**: Responds to window online/offline events
- **Auto-sync**: Automatically syncs when connection restored
- **Error Handling**: Graceful error handling with logging
- **Cleanup**: Proper unsubscribe on unmount

#### Usage Example:

```typescript
import { useOfflineSync } from '../hooks/useOfflineSync';

function MyComponent() {
  const {
    isOnline,
    pendingCount,
    syncInProgress,
    syncNow,
    retryFailed,
  } = useOfflineSync();

  return (
    <div>
      <p>Status: {isOnline ? 'Online' : 'Offline'}</p>
      <p>Pending: {pendingCount}</p>
      <button onClick={syncNow} disabled={syncInProgress}>
        {syncInProgress ? 'Syncing...' : 'Sync Now'}
      </button>
      <button onClick={retryFailed}>Retry Failed</button>
    </div>
  );
}
```

---

### 5. `components/OfflineIndicator.tsx` (127 lines)

**OfflineIndicator Component** - Status bar showing connection and queue status.

#### Props: None (uses `useOfflineSync` hook internally)

#### Features:

- **Status Bar**: Fixed top bar showing online/offline status
- **Queue Count**: Displays pending operations count
- **Sync Button**: "Sync Now" button when online with pending ops
- **Animations**: Slide-down animation and pulse effect when offline
- **Color Coding**: Green for online, orange for offline
- **Auto-hide**: Hides when online with no pending operations

#### Styling:

- Fixed position at top of screen (z-index: 1000)
- Responsive design with flexbox
- Inline CSS with animations
- Touch-friendly button sizing

#### Usage Example:

```typescript
import OfflineIndicator from '../components/OfflineIndicator';

function App() {
  return (
    <>
      <OfflineIndicator />
      {/* Rest of app content */}
    </>
  );
}
```

#### CSS Animations:

```css
@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

---

### 6. `components/DeliveryProofCapture.tsx` (419 lines)

**DeliveryProofCapture Component** - Photo, signature, and notes capture for proof of delivery.

#### Props:

```typescript
interface DeliveryProofCaptureProps {
  shipmentId: string; // Shipment ID
  recipientName?: string; // Initial recipient name
  onSubmitSuccess?: (proofId: string) => void; // Success callback
  onSubmitError?: (error: Error) => void; // Error callback
}
```

#### Features:

- **Camera Integration**: Photo capture using HTML5 File API
- **Signature Pad**: Canvas-based touch drawing signature
- **Recipient Name**: Text input for recipient
- **Notes/Comments**: Optional textarea for delivery notes
- **GPS Capture**: Auto-captures coordinates from LocationService
- **Timestamp**: Automatic timestamp on submit
- **Offline Support**: Uses OfflineQueue for offline submission
- **Form Validation**: Required field checks before submit
- **Preview**: Shows captured photo in-place

#### Captured Data:

```typescript
interface ProofData {
  shipmentId: string; // Shipment ID
  recipientName: string; // Recipient name
  notes: string; // Delivery notes
  photoBase64?: string; // Base64 encoded photo
  signatureBase64?: string; // Base64 encoded signature
  latitude?: number; // GPS latitude
  longitude?: number; // GPS longitude
  timestamp: number; // Submission timestamp
}
```

#### Usage Example:

```typescript
import DeliveryProofCapture from '../components/DeliveryProofCapture';

function DeliveryScreen() {
  return (
    <DeliveryProofCapture
      shipmentId="S12345"
      recipientName="John Smith"
      onSubmitSuccess={(proofId) => {
        console.log('Proof submitted:', proofId);
      }}
      onSubmitError={(error) => {
        console.error('Error:', error.message);
      }}
    />
  );
}
```

#### Form Sections:

1. **Recipient Name** - Required text input
2. **Photo Proof** - Camera capture with preview
3. **Signature** - Canvas drawing pad with save/clear
4. **Notes** - Optional textarea
5. **Location Display** - Read-only GPS coordinates
6. **Submit Button** - Validation and offline queue support

---

### 7. `components/RouteNavigator.tsx` (392 lines)

**RouteNavigator Component** - Turn-by-turn navigation with stop management.

#### Props:

```typescript
interface RouteNavigatorProps {
  stops: DeliveryStop[]; // List of delivery stops
  currentStopId?: string; // Currently selected stop
  onStopSelect?: (stopId: string) => void; // Stop click handler
  onStopStatusChange?: (stopId: string, status: DeliveryStop["status"]) => void;
  onNavigate?: (stop: DeliveryStop) => void; // Navigate button handler
  onReorder?: (reorderedStops: DeliveryStop[]) => void; // Drag reorder
}

interface DeliveryStop {
  id: string; // Unique stop ID
  order: number; // Order in route (1-based)
  address: string; // Delivery address
  customerName: string; // Customer name
  timeWindowStart: string; // Time window start (HH:MM)
  timeWindowEnd: string; // Time window end (HH:MM)
  status: "pending" | "in-progress" | "completed" | "failed" | "skipped";
  notes?: string; // Delivery notes
  latitude?: number; // GPS latitude
  longitude?: number; // GPS longitude
}
```

#### Features:

- **Stop List**: Shows all stops with order, address, customer name
- **Progress Bar**: Visual progress (completed/total)
- **ETA Calculation**: Auto-calculated ETA for each stop
- **Status Badges**: Color-coded status with icons
- **Current Stop Highlighting**: Highlights currently selected stop
- **Quick Actions**: Start, delivered, failed, skip buttons
- **Drag Reorder**: Reorder stops via drag-and-drop
- **Time Windows**: Shows time window for each stop
- **Inline Notes**: Displays delivery notes if present

#### Status Colors:

| Status      | Color            | Icon |
| ----------- | ---------------- | ---- |
| pending     | Orange (#FFC107) | ◯    |
| in-progress | Blue (#2196F3)   | ⟳    |
| completed   | Green (#4CAF50)  | ✓    |
| failed      | Red (#f44336)    | ✕    |
| skipped     | Gray (#9E9E9E)   | ⊘    |

#### Usage Example:

```typescript
import RouteNavigator, { DeliveryStop } from '../components/RouteNavigator';

function RouteScreen() {
  const [stops, setStops] = useState<DeliveryStop[]>([
    {
      id: '1',
      order: 1,
      address: '123 Main St',
      customerName: 'John Smith',
      timeWindowStart: '09:00',
      timeWindowEnd: '10:00',
      status: 'completed',
    },
    // ... more stops
  ]);
  const [currentStopId, setCurrentStopId] = useState<string>('1');

  return (
    <RouteNavigator
      stops={stops}
      currentStopId={currentStopId}
      onStopSelect={setCurrentStopId}
      onStopStatusChange={(id, status) => {
        setStops(stops.map(s => s.id === id ? {...s, status} : s));
      }}
      onNavigate={(stop) => {
        // Open maps navigation
        const url = `https://maps.google.com/?q=${stop.latitude},${stop.longitude}`;
        window.open(url);
      }}
      onReorder={setStops}
    />
  );
}
```

#### Computed Values:

- **Progress Percentage**: `(completedCount / totalCount) * 100`
- **ETA**: `(index + 1) * 15 minutes from current time`
- **Remaining**: `totalCount - completedCount`

---

## Integration Guide

### 1. Setup Offline Queue

```typescript
// app.tsx or main.tsx
import { offlineQueue } from './lib/offline-queue';
import OfflineIndicator from './components/OfflineIndicator';

function App() {
  useEffect(() => {
    // Initialize offline queue
    const unsubscribe = offlineQueue.subscribe(() => {
      console.log('Queue status changed');
    });

    return () => {
      unsubscribe();
      offlineQueue.destroy();
    };
  }, []);

  return (
    <>
      <OfflineIndicator />
      {/* App routes */}
    </>
  );
}
```

### 2. Use in API Calls

```typescript
// services/api.ts
import { offlineQueue } from "../lib/offline-queue";

export async function submitDeliveryProof(data: ProofData) {
  if (!navigator.onLine) {
    // Queue for later
    const id = offlineQueue.enqueue({
      type: "POST",
      endpoint: "/api/delivery-proofs",
      method: "POST",
      body: data,
    });
    return { id, queued: true };
  }

  // Make request directly
  const response = await fetch("/api/delivery-proofs", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.json();
}
```

### 3. Track Locations

```typescript
// During app startup
import { locationService } from "./lib/location-service";

useEffect(() => {
  locationService.startTracking(15000); // 15 second intervals

  // Sync locations when back online
  window.addEventListener("online", () => {
    locationService.handleOfflineLocations();
  });

  return () => {
    locationService.stopTracking();
  };
}, []);
```

### 4. Handle Push Notifications

```typescript
// app.tsx
import { pushHandler } from "./lib/push-handler";

useEffect(() => {
  // Register for notifications
  pushHandler.registerForPush().then((token) => {
    console.log("FCM Token:", token);
    // Send token to server
  });

  // Listen for notifications
  const unsubscribe = pushHandler.subscribe((payload) => {
    console.log("Notification received:", payload);
  });

  return () => unsubscribe();
}, []);
```

### 5. Use Offline Sync Hook

```typescript
import { useOfflineSync } from './hooks/useOfflineSync';

function StatusComponent() {
  const { isOnline, pendingCount, syncNow } = useOfflineSync();

  return (
    <div>
      <p>{isOnline ? '🟢 Online' : '🔴 Offline'}</p>
      <p>Pending: {pendingCount}</p>
      <button onClick={syncNow}>Sync</button>
    </div>
  );
}
```

---

## Error Handling

### Offline Queue Errors

- Failed operations stored with error message in `lastError` field
- Automatic retry up to 3 times (configurable)
- Manual retry via `retryFailed()` method
- Failed operations can be removed manually

### Location Errors

- Graceful fallback if geolocation unavailable
- Timeout handling (10 seconds)
- Error logging without throwing
- Returns `null` on failure

### Push Notification Errors

- Permission denied handling
- Notification API availability check
- Safe error logging

---

## Testing

### Testing Offline Functionality

```typescript
// Simulate going offline
window.dispatchEvent(new Event("offline"));

// Check queue status
const status = offlineQueue.getQueueStatus();
expect(status.pending).toBeGreaterThan(0);

// Go back online
window.dispatchEvent(new Event("online"));

// Verify sync
await new Promise((resolve) => setTimeout(resolve, 1000));
const newStatus = offlineQueue.getQueueStatus();
expect(newStatus.pending).toBe(0);
```

### Testing Notifications

```typescript
// Simulate incoming notification
const payload: PushPayload = {
  type: "NEW_ASSIGNMENT",
  title: "Test",
  body: "Test notification",
  data: { routeId: "test-123" },
  timestamp: Date.now(),
};

window.PushNotificationHandler?.handleIncomingPush(payload);

// Verify history was recorded
const history = pushHandler.getNotificationHistory();
expect(history.length).toBeGreaterThan(0);
```

---

## Performance Considerations

1. **Location Tracking**: 10-15 second intervals balance accuracy and battery
2. **Polling Fallback**: 5-second polling for network detection
3. **LocalStorage Limits**: ~5-10MB available on most browsers
4. **Operation Limits**: Max 1000 locations stored (configurable)
5. **Notification History**: Max 50 items kept (prevents memory bloat)

---

## Browser Compatibility

| Feature            | Chrome | Safari | Firefox | Edge |
| ------------------ | ------ | ------ | ------- | ---- |
| localStorage       | ✓      | ✓      | ✓       | ✓    |
| Geolocation        | ✓      | ✓      | ✓       | ✓    |
| Notifications API  | ✓      | ✓      | ✓       | ✓    |
| Canvas (Signature) | ✓      | ✓      | ✓       | ✓    |
| File API           | ✓      | ✓      | ✓       | ✓    |
| Service Worker     | ✓      | ✓      | ✓       | ✓    |

---

## Security Considerations

1. **Authentication**: Auth token from localStorage sent with requests
2. **HTTPS**: All API calls should use HTTPS in production
3. **Sensitive Data**: Consider encrypting sensitive data in localStorage
4. **Validation**: Server-side validation of all queued operations
5. **Timestamps**: Server timestamps used for conflict resolution

---

## Future Enhancements

1. **IndexedDB Migration**: Move from localStorage for better performance
2. **Service Worker**: Full offline PWA support
3. **Image Compression**: Compress photos before upload
4. **Batch Operations**: Group multiple operations in single API call
5. **Retry Strategy**: Exponential backoff for retries
6. **Encryption**: Client-side encryption of sensitive data
7. **Conflict Resolution**: More sophisticated merge strategies
8. **Analytics**: Track sync failures and performance metrics

---

## Support & Maintenance

All files include:

- Full TypeScript types
- Comprehensive JSDoc comments
- Error handling and logging
- Memory cleanup on destroy
- Singleton pattern for services
- React 19 compatibility

For questions or issues, contact the Witylogix Component Development team.

**Created by**: VS (Component Dev) - Witylogix
**Date**: March 2026
