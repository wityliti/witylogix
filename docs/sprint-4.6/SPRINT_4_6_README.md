# Customer Portal v2 - Sprint 4.6: Real-Time Tracking & Enhanced Ratings

## Overview

Sprint 4.6 introduces a comprehensive real-time delivery tracking system with live maps, WebSocket integration, and enhanced rating experiences. This brings the customer portal to feature parity with modern delivery apps like Uber Eats and DoorDash.

## New Features

### 1. Real-Time Live Tracking Page (`apps/customer-portal/src/app/track/[id]/page.tsx`)

Full-featured tracking experience for active deliveries:

**Desktop Layout:**
- Full-width interactive map with driver and destination markers
- Right sidebar with stacked information panels
- ETA countdown timer with progress bar
- Driver info card with contact options
- Order items summary
- Delivery status timeline
- Share tracking link button

**Mobile Layout:**
- Full-screen map
- Bottom sheet for details (peek/half/full snap points)
- Swipe-to-dismiss functionality

**Features:**
- Real-time driver position updates with bearing/direction arrow
- Route visualization (completed in solid blue, remaining in dashed gray)
- Destination marker with pulse animation
- Connection status indicator
- Auto-recenter map button when panned
- Responsive zoom controls

### 2. WebSocket Hook (`apps/customer-portal/src/hooks/use-delivery-tracking.ts`)

Client-side WebSocket management for real-time updates:

```typescript
const { driverPosition, deliveryStatus, eta, isConnected, error, retryCount } =
  useDeliveryTracking({
    orderId: 'ORD-2024-001',
    token: 'tracking-token',
    autoReconnect: true,
    reconnectMaxAttempts: 5,
  });
```

**Events Handled:**
- `driver:location` - Driver position updates (lat/lng/bearing/speed)
- `delivery:status-update` - Status change (ordered → confirmed → dispatched → etc)
- `delivery:eta-update` - ETA recalculation

**Features:**
- Exponential backoff reconnection
- Heartbeat ping/pong at 30s intervals
- Auto-cleanup on unmount
- Connection state tracking
- Error handling with user feedback

### 3. Enhanced Live Map Component (`apps/customer-portal/src/components/live-map.tsx`)

Canvas-based map implementation (production: integrate with Leaflet/Mapbox):

**Visual Elements:**
- Driver marker: Amber circle with heading arrow (rotates based on bearing)
- Destination marker: Green circle with pulse animation
- Route polyline: Blue for completed, dashed gray for remaining
- Geofence circle: 500m radius around destination
- Connection status: Green/red indicator
- Zoom controls: +/- buttons with 5-20x range
- Pan support: Drag to move, recenter button

**Interactions:**
- Mouse drag to pan
- Scroll wheel zoom
- Touch drag on mobile
- Center/recenter functionality
- Smooth animations with CSS transitions

### 4. ETA Countdown Display (`apps/customer-portal/src/components/eta-countdown.tsx`)

Live ETA timer with status tracking:

**Display Elements:**
- Large countdown: "Arriving in X min"
- Route progress bar (0-100%)
- Status indicator: "On time" / "Delayed" / "Arriving soon"
- Last updated timestamp
- Updates every 1 second

**Status Logic:**
- On time: Default state
- Delayed: When > 15 min remaining
- Early: When < 3 min remaining

### 5. Enhanced Delivery Status Timeline (`apps/customer-portal/src/components/delivery-status-timeline.tsx`)

6-step delivery journey with expandable details:

**Steps:**
1. **Ordered** - Order placed
2. **Confirmed** - Confirmed by store/restaurant
3. **Dispatched** - Driver assigned and route started
4. **Out for Delivery** - En route to customer
5. **Nearby** - Driver approaching (within geofence)
6. **Delivered** - Order completed

**Features:**
- Circle indicators: Gray (pending), Blue (current), Green (completed)
- Vertical connector lines
- Expandable details per step
- Timestamps for completed steps
- POD (Proof of Delivery) display at final step
- Smooth animations and transitions

**Expandable Information:**
- Driver name at Dispatched step
- Estimated arrival time
- Proof of delivery (photo + signature)
- Delivery notes

### 6. Driver Info Card (`apps/customer-portal/src/components/driver-info-card.tsx`)

Driver profile and contact interface:

**Information Displayed:**
- Driver name and photo
- Star rating (1-5)
- Vehicle type, color, and license plate
- Connection status indicator

**Actions:**
- Call button (tel: link)
- Text button (sms: link)
- Disabled when offline

### 7. Mobile Bottom Sheet (`apps/customer-portal/src/components/bottom-sheet.tsx`)

Touch-friendly bottom sheet component:

**Features:**
- Configurable snap points (default: peek 120px, half, full)
- Draggable handle with visual feedback
- Smooth spring animations
- Swipe down to dismiss
- Backdrop click to close
- Optional title with close button

**Usage:**
```typescript
<BottomSheet
  isOpen={isOpen}
  onClose={closeHandler}
  title="Delivery Details"
  snapPoints={[120, 280, 500]}
>
  {/* Content */}
</BottomSheet>
```

### 8. Delivery History Page (`apps/customer-portal/src/app/deliveries/page.tsx`)

Past deliveries with filtering and details:

**Features:**
- List view with delivery cards
- Quick info: Date, order number, status badge
- Items summary with "N more" indicator
- Star rating display
- Total price
- Delivery address
- Filter dropdown: Date range (all/7d/30d/90d) & Status (all/delivered/cancelled)
- Load more button for pagination
- Empty state with illustration

**Card Information:**
- Order date and number
- Status badge (green for delivered, red for cancelled)
- Item preview (first 2 items)
- Driver rating
- Total price
- Delivery address with map pin icon

### 9. Enhanced Rating Page (`apps/customer-portal/src/app/orders/[id]/rate/page.tsx`)

Multi-step rating experience with category ratings:

**Steps:**
1. **Initial Ratings** (2 questions)
   - Driver rating (1-5 stars)
   - Overall experience rating (1-5 stars)

2. **Category Ratings** (3 sub-categories)
   - Driver professionalism/courtesy
   - Delivery timeliness
   - Item condition

3. **Feedback** (Optional details)
   - Free-text feedback
   - "Would you order again?" toggle
   - Photo upload (max 5 photos)

4. **Success** (Confirmation)
   - Thank you message
   - Summary of all ratings
   - Links to orders/dashboard

**Features:**
- Progress bar showing all 4 steps
- Visual feedback for all selections
- Photo upload with thumbnail preview
- Toggle button for "Would order again"
- Disabled submit until required fields filled
- Success animation with summary review

## Technical Stack

### Dependencies Added (Consider Adding)
- `socket.io-client@^4.6.0` - For WebSocket connection
- `leaflet@^1.9.4` - For map rendering (optional, canvas fallback included)
- `date-fns@^4.1.0` - Already included

### Key Design Patterns

**Component Architecture:**
- Functional components with React Hooks
- Client-side rendering ('use client')
- Controlled components for form state
- Custom hooks for business logic separation

**Styling:**
- Tailwind CSS v3.4 with --wl-* CSS variables
- Dark theme by default
- Responsive design (mobile-first)
- cn() utility for conditional classes

**Type Safety:**
- TypeScript throughout
- Exported interfaces in types/index.ts
- NAMED imports only (per project rules)

**State Management:**
- React hooks (useState, useEffect, useRef, useCallback)
- No external state library (kept simple for single portal)
- WebSocket hook handles connection state

## Mock Data

All pages include realistic mock data:
- Delivery tracking with animated driver positions
- Multiple delivery history entries
- Driver profiles with photos and ratings
- Order items with prices
- Timeline with realistic timestamps

To integrate with real backend:
1. Replace mock data with API calls
2. Update `/tracking` WebSocket endpoint
3. Implement actual image uploads
4. Connect to driver location service

## Component Usage Examples

### Basic Tracking Page
```typescript
import { useDeliveryTracking } from '@/hooks/use-delivery-tracking';
import { LiveMap } from '@/components/live-map';
import { ETACountdown } from '@/components/eta-countdown';

export default function TrackingPage() {
  const { driverPosition, eta, isConnected } = useDeliveryTracking({
    orderId: params.id,
    token: trackingToken,
  });

  return (
    <div className="flex gap-6">
      <LiveMap
        driverPosition={driverPosition}
        destinationLat={40.7164}
        destinationLng={-74.0084}
      />
      <ETACountdown eta={eta} routeProgress={65} />
    </div>
  );
}
```

### Bottom Sheet for Mobile
```typescript
const [isOpen, setIsOpen] = useState(false);

return (
  <>
    <button onClick={() => setIsOpen(true)}>Show Details</button>
    <BottomSheet
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Delivery Details"
      snapPoints={[120, 280, 500]}
    >
      {/* Details content */}
    </BottomSheet>
  </>
);
```

## Responsive Design

### Mobile (< 768px)
- Full-screen map
- Bottom sheet for details
- Single column layouts
- Touch-optimized buttons
- Snap points for sheet

### Tablet (768px - 1024px)
- Map on left (50%)
- Details on right (50%)
- Stacked cards
- Medium spacing

### Desktop (> 1024px)
- Full map on left (66%)
- Right sidebar (33%)
- All details visible
- Optimal spacing/padding

## Performance Considerations

1. **WebSocket Optimization:**
   - Heartbeat at 30s (not 10s) to reduce server load
   - Connection batching for location updates
   - Auto-disconnect cleanup

2. **Rendering:**
   - Canvas-based map (lightweight)
   - Memoized components where needed
   - Smooth animations with CSS (not JS)
   - Virtual scrolling for history (implement if >100 items)

3. **Bundle Size:**
   - No heavy charting libraries
   - Lucide icons (tree-shakeable)
   - Tailwind CSS (production build optimized)

## Testing Checklist

- [ ] Tracking page loads with mock data
- [ ] Map displays driver and destination
- [ ] ETA updates every 30s
- [ ] Bottom sheet snaps to all points
- [ ] Timeline expands/collapses correctly
- [ ] Driver info card shows correct details
- [ ] Rating page flows through all steps
- [ ] Mobile responsive (< 768px)
- [ ] Tablet layout (768-1024px)
- [ ] Desktop layout (> 1024px)
- [ ] Share link copies to clipboard
- [ ] Filter dropdown works on history page
- [ ] Photos upload preview works
- [ ] Connection status updates

## Future Enhancements

1. **Maps Integration:**
   - Replace canvas with Leaflet/Mapbox
   - Real map tiles instead of grid
   - Routing layer showing actual streets

2. **Notifications:**
   - Push notifications for status updates
   - ETA change notifications
   - Driver approaching alert

3. **Advanced Features:**
   - Live chat with driver
   - Driver acceptance delay counter
   - Multiple delivery tracking
   - Geofencing alerts
   - Delivery notes voice recording

4. **Analytics:**
   - Tracking page view time
   - Rating submission rate
   - Average delivery times
   - Driver performance metrics

## File Structure

```
apps/customer-portal/
├── src/
│   ├── app/
│   │   ├── track/[id]/
│   │   │   └── page.tsx          # Live tracking page
│   │   ├── deliveries/
│   │   │   └── page.tsx          # Delivery history
│   │   └── orders/[id]/rate/
│   │       └── page.tsx          # Enhanced rating
│   ├── components/
│   │   ├── live-map.tsx          # Interactive map
│   │   ├── eta-countdown.tsx     # ETA timer
│   │   ├── delivery-status-timeline.tsx
│   │   ├── driver-info-card.tsx
│   │   └── bottom-sheet.tsx      # Mobile sheet
│   ├── hooks/
│   │   └── use-delivery-tracking.ts
│   └── types/
│       └── index.ts              # TypeScript definitions
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Deployment Notes

1. **Environment Variables:** None required for mock data mode
2. **Build:** `npm run build` creates production bundle
3. **Start:** `npm run start` serves built app
4. **Development:** `npm run dev` with Turbopack for fast HMR

## Support & Questions

For implementation details or to integrate real APIs, refer to:
- Component prop types in TypeScript interfaces
- Mock data structure in each page component
- Tailwind CSS variable definitions in tailwind.config.ts
- Global styles in styles/globals.css

---

**Sprint 4.6 Completed:** March 11, 2024
**Status:** Ready for testing and API integration
