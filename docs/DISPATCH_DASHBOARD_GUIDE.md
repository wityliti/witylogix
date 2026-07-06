# Route Timeline Dispatcher Dashboard - Implementation Guide

## Overview

The Route Timeline Dispatcher Dashboard is a real-time route management interface for Witylogix that enables dispatchers to:

- Monitor active delivery routes and driver locations in real-time
- Visualize route timelines with a Gantt-style interface
- Reassign orders between routes via drag-and-drop
- Optimize routes for unscheduled orders
- Track key dispatch metrics and KPIs

## Architecture

### Frontend Components

**Location**: `apps/dashboard/src/app/(dashboard)/dispatch/`

#### Main Page

- **`page.tsx`** - Root dispatch dashboard page
  - Orchestrates all sub-components
  - Manages global state (routes, drivers, stats)
  - Handles WebSocket connections for real-time updates
  - Implements tab switching (scheduled/unscheduled)

#### Components

1. **`stats-bar.tsx`** - Top metrics bar
   - Displays: Active Drivers, Total Stops, Total Distance, Est. Time
   - Real-time metric animations
   - Trend indicators (vs. previous day)
   - Loading states

2. **`dispatch-map.tsx`** - Interactive map view
   - Leaflet integration ready
   - Color-coded route polylines
   - Stop markers with sequence numbers
   - Driver position indicators
   - Cluster markers for zoomed-out views
   - Click handlers for stop selection

3. **`route-timeline.tsx`** - Timeline/Gantt component
   - Horizontal timeline (8 AM - 7 PM)
   - One row per route with color matching
   - Stop dots positioned by ETA
   - Hover tooltips with stop details
   - Drag-and-drop support for reassignment
   - Keyboard accessible

4. **`driver-card.tsx`** - Driver status card
   - Driver name, photo, vehicle type
   - Route statistics (stops, distance, time)
   - Status badge (Active/Idle/On Break)
   - Capacity information
   - Color indicator matching route color

5. **`stop-detail-panel.tsx`** - Stop details sidebar
   - Order information
   - Customer details (name, phone)
   - Delivery address with coordinates
   - Time window and ETA
   - Status badge
   - Action buttons (Reassign, Skip, Prioritize)
   - Complete timeline view

### Backend Services

**Location**: `packages/core/src/dispatch/`

#### Core Files

1. **`types.ts`** - TypeScript type definitions
   - `Route` - Delivery route with stops
   - `Stop` - Individual delivery stop
   - `Driver` - Driver information
   - `DispatchStats` - Aggregated metrics
   - Request/response interfaces
   - Type-safe enums for status values

2. **`dispatch-service.ts`** - Core dispatch logic

   ```typescript
   // Main methods:
   getActiveRoutes(date?: Date): Promise<Route[]>
   getRoute(routeId: string): Promise<Route | null>
   getStop(stopId: string): Promise<Stop | null>
   getActiveDrivers(): Promise<Driver[]>
   reassignStop(request: ReassignStopRequest): Promise<ReassignStopResult>
   skipStop(stopId: string, reason?: string): Promise<Stop | null>
   optimizeRoutes(request: OptimizeRoutesRequest): Promise<OptimizeRoutesResult>
   getDispatchStats(date?: Date): Promise<DispatchStats>
   getUnscheduledOrders(): Promise<string[]>
   getScheduledOrders(): Promise<string[]>
   ```

3. **`route-colors.ts`** - 16-color palette for routes
   - Distinct, accessible colors
   - Color utility functions
   - Deterministic color assignment based on IDs
   - Lighten/darken utilities for UI states

4. **`index.ts`** - Module exports
   - Re-exports all services, types, and utilities
   - Combines with existing NotificationDispatcher exports

#### Tests

- **`dispatch-service.test.ts`** - Unit tests for DispatchService
  - Route retrieval tests
  - Stop management tests
  - Statistics calculation
  - Error handling

## Data Flow

### Initialization

```
Page Mounts
  ↓
Load Active Routes (Prisma)
Load Active Drivers (Prisma)
Calculate Stats
  ↓
Render Map + Timeline
Show Driver Cards
```

### Real-time Updates (Future)

```
Driver GPS Update (WebSocket)
  ↓
Update Driver Location Cache
Update Route Position
  ↓
Re-render Map
Update ETA Calculations
```

### Stop Reassignment

```
Dispatcher Drags Stop
  ↓
Optimistic UI Update
  ↓
Send API Request
  ↓
Validate (Capacity, Time Window, Distance)
  ↓
Update Route Sequences
Recalculate Route Metrics
  ↓
Confirm or Rollback
```

## Integration Points

### Database (Prisma)

The service interacts with:

- `Route` model - Delivery routes
- `RouteStop` model - Individual stops
- `Driver` model - Driver information
- `Order` model - Orders to deliver

### Services

- **Route Optimizer** (`packages/core/src/route-optimizer/`) - For batch optimization
- **Tracking Service** (`packages/core/src/tracking/`) - For real-time locations
- **Notification Service** (`packages/core/src/notifications/`) - For driver alerts

## Configuration

### Environment Variables

```env
# Map tiles (OpenStreetMap is default, no API key needed)
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png

# Optional: Override for paid tile providers
NEXT_PUBLIC_MAP_ATTRIBUTION=© OpenStreetMap contributors

# WebSocket configuration (future)
NEXT_PUBLIC_WS_URL=wss://api.witylogix.local/dispatch
```

### Tailwind Configuration

The dashboard uses Witylogix design tokens via CSS variables:

- `--wl-primary-*` - Primary color palette
- `--wl-success-*`, `--wl-warning-*`, `--wl-danger-*` - Status colors
- `--wl-bg-*` - Background colors
- `--wl-text-*` - Text colors
- `--wl-border-*` - Border colors

See `packages/config/tailwind.config.ts` for definitions.

## Usage Examples

### Basic Page Setup

```tsx
import { dispatch Page } from '@/app/(dashboard)/dispatch/page';

// Automatically loads and displays dispatch dashboard
export default Page;
```

### Using DispatchService Directly

```typescript
import { createDispatchService } from "@witylogix/core/dispatch";

const service = createDispatchService("shop-id-123");

// Get active routes
const routes = await service.getActiveRoutes();

// Reassign a stop
const result = await service.reassignStop({
  stopId: "stop-abc123",
  fromRouteId: "route-1",
  toRouteId: "route-2",
  newPosition: 3,
});

// Optimize routes
const optimization = await service.optimizeRoutes({
  unscheduledOrderIds: ["order-1", "order-2"],
  availableDriverIds: ["driver-1", "driver-2"],
  shopId: "shop-id-123",
  date: new Date(),
});
```

### Using Route Colors

```typescript
import {
  getRouteColor,
  getRouteColorForIdentifier,
  lightenColor,
  ROUTE_COLORS,
} from "@witylogix/core/dispatch";

// Get color by index
const color1 = getRouteColor(0); // "#FF6B6B"
const color2 = getRouteColor(1); // "#4ECDC4"

// Get color deterministically from ID
const color = getRouteColorForIdentifier(routeId);

// Modify color
const lighter = lightenColor(color, 20);
const darker = darkenColor(color, 20);

// All available colors
const allColors = ROUTE_COLORS; // Array of 16 colors
```

## Performance Considerations

### Large Route Lists

When displaying 50+ routes:

1. Use virtualization for driver card lists
2. Implement marker clustering on map
3. Lazy load route details on demand
4. Debounce drag-and-drop operations

### Real-time Updates

- Use WebSocket for location updates (not polling)
- Implement message debouncing (max 1 update per second per driver)
- Cache route metrics, recalculate only when changed
- Use React Query for client-side cache management

### Memory Management

- Clean up WebSocket connections on unmount
- Debounce map redraws
- Remove old location history (keep last 100 points)
- Monitor bundle size (Leaflet ~40KB)

## Testing

### Run Dispatch Service Tests

```bash
cd packages/core
npm run test -- dispatch-service.test.ts
```

### Test the Dashboard Page

```bash
cd apps/dashboard
npm run test dispatch
```

### E2E Testing

The dashboard supports E2E testing with:

- Cypress or Playwright
- Mock WebSocket with MSW (Mock Service Worker)
- Mock Prisma responses

## Roadmap & Future Enhancements

### Phase 2 (Q2 2026)

- [ ] Real-time WebSocket integration
- [ ] Drag-and-drop stop reassignment
- [ ] Multi-select bulk operations
- [ ] Mobile dispatch app

### Phase 3 (Q3 2026)

- [ ] AI-powered route suggestions
- [ ] Traffic data integration
- [ ] Predictive ETAs with ML
- [ ] Historical route replay/analytics

### Phase 4 (Q4 2026)

- [ ] Voice commands for dispatchers
- [ ] Geofence alerts
- [ ] Proof of delivery photo capture
- [ ] Customer tracking page integration

## Troubleshooting

### Map Not Loading

1. Check if Leaflet is installed: `npm list leaflet`
2. Verify tile URL is accessible: `curl https://tile.openstreetmap.org/0/0/0.png`
3. Check console for CORS errors
4. Ensure mapRef div has width and height

### Routes Not Showing

1. Verify database connection (Prisma)
2. Check shop ID matches user's shop
3. Confirm routes exist for today
4. Check route status filters (draft routes hidden)

### Real-time Updates Not Working

1. Verify WebSocket URL in environment
2. Check browser console for connection errors
3. Verify JWT token is valid
4. Check server-side WebSocket handler

### Performance Issues

1. Profile with React DevTools Profiler
2. Check number of rendered routes (use virtualization if >50)
3. Verify Prisma query includes are correct
4. Monitor memory in Chrome DevTools

## Contributing

When extending the dispatch dashboard:

1. **Update Types First** - Add to `types.ts` before implementation
2. **Test Service Methods** - Add tests to `__tests__/dispatch-service.test.ts`
3. **Component Structure** - Follow existing component patterns
4. **Styling** - Use Witylogix design tokens, no hardcoded colors
5. **Accessibility** - Include keyboard navigation and ARIA labels

## Related Documentation

- [ADR-024: Dispatch Dashboard Architecture](./adr/ADR-024-dispatch-dashboard.md)
- [Route Optimizer Service](./packages/core/src/route-optimizer/)
- [Tracking Service](./packages/core/src/tracking/)
- [Tailwind Configuration](./packages/config/tailwind.config.ts)
- [Witylogix Design System](./docs/DESIGN_SYSTEM.md)
