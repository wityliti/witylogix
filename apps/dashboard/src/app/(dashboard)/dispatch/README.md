# Route Timeline Dispatcher Dashboard

Real-time dispatch management interface for optimizing and monitoring delivery routes.

## Quick Start

### Accessing the Dashboard

Navigate to `/dispatch` in the dashboard to view the Route Timeline Dispatcher.

```
http://localhost:3000/dispatch
```

## File Structure

```
dispatch/
├── page.tsx                          # Main page component
├── components/
│   ├── stats-bar.tsx                 # Top metrics display
│   ├── dispatch-map.tsx              # Map with routes/stops
│   ├── route-timeline.tsx            # Timeline/Gantt view
│   ├── driver-card.tsx               # Driver status cards
│   └── stop-detail-panel.tsx         # Stop details sidebar
└── README.md                         # This file
```

## Components Overview

### StatsBar

Displays key dispatch metrics at the top of the page:

- Active Driver Count
- Total Stops
- Total Distance (km)
- Estimated Time (hours)

**Props**:

```typescript
interface StatsBarProps {
  stats: DispatchStats;
  isLoading?: boolean;
}
```

### DispatchMap

Interactive map showing routes and stops. Ready for Leaflet integration.

**Features**:

- Color-coded route polylines (16 distinct colors)
- Stop markers with sequence numbers
- Driver position indicators
- Cluster markers for zoomed-out views
- Click handlers for stop selection

**Props**:

```typescript
interface DispatchMapProps {
  routes: Route[];
  drivers: Map<string, Driver>;
  selectedStop?: Stop | null;
  onStopSelect?: (stop: Stop) => void;
  isLoading?: boolean;
  error?: string | null;
}
```

### RouteTimeline

Horizontal timeline showing routes and stops across the operating day.

**Features**:

- Time axis from 8 AM to 7 PM
- One row per route
- Stops positioned by ETA
- Hover tooltips with details
- Ready for drag-and-drop implementation

**Props**:

```typescript
interface RouteTimelineProps {
  routes: Route[];
  selectedStop?: Stop | null;
  onStopSelect?: (stop: Stop) => void;
  onStopDrop?: (stopId: string, toRouteId: string, position: number) => void;
  isLoading?: boolean;
}
```

### DriverCard

Displays driver information and assigned route details.

**Features**:

- Driver name and photo
- Vehicle type and plate number
- Route statistics
- Capacity information
- Status indicator

**Props**:

```typescript
interface DriverCardProps {
  driver: Driver;
  route: Route | null;
  isSelected?: boolean;
  onClick?: () => void;
}
```

### StopDetailPanel

Detailed view of a selected stop with actions.

**Features**:

- Order and customer information
- Delivery address with coordinates
- Time window and ETA
- Status timeline
- Action buttons (Reassign, Skip, Prioritize)

**Props**:

```typescript
interface StopDetailPanelProps {
  stop: Stop | null;
  onClose?: () => void;
  onReassign?: (stopId: string) => void;
  onSkip?: (stopId: string) => void;
  onPrioritize?: (stopId: string) => void;
}
```

## Data Flow

```
page.tsx (Main)
├── useEffect: Load routes, drivers, stats
├── StatsBar (Display metrics)
├── DispatchMap (Left panel - 60%)
│   └── onClick → setSelectedStop
└── Right Panel (40%)
    ├── RouteTimeline
    │   └── onClick → setSelectedStop
    └── StopDetailPanel (when stop selected)
        └── Actions: Reassign, Skip, Prioritize
```

## Key Features

### 1. Real-time Metrics

The `stats-bar` component displays:

- Number of active drivers on the road
- Total delivery stops for the day
- Total kilometers to cover
- Estimated hours to complete all deliveries
- Trend indicators (% change from previous day)

### 2. Route Visualization

The `dispatch-map` is ready for Leaflet integration:

```typescript
// Future: Map will show
// - Polylines for each route (color-coded)
// - Markers for stops (with sequence numbers)
// - Driver position pins with heading
// - Clustering when zoomed out
```

### 3. Timeline View

The `route-timeline` shows all routes horizontally:

- Operating hours: 8 AM to 7 PM
- Stop dots positioned by estimated arrival time
- Hover to see stop details
- Click to select stop

### 4. Stop Management

Click on a stop to see detailed panel:

- Customer and delivery information
- Address with GPS coordinates
- Time window constraints
- Action buttons for dispatcher decisions

### 5. Driver Overview

Right sidebar shows all active drivers:

- Name and vehicle type
- Route progress (stops, distance, time)
- Capacity information
- Current status

## Styling

All components use Witylogix design tokens:

```typescript
// Color system
"bg-wl-bg-primary"; // Main background
"bg-wl-bg-surface"; // Card/surface background
"text-wl-text-primary"; // Main text
"text-wl-text-secondary"; // Secondary text
"border-wl-border-subtle"; // Subtle borders

// Status colors
"text-wl-success-400"; // Success/completed
"text-wl-warning-400"; // Warning/in-progress
"text-wl-danger-400"; // Danger/failed
"text-wl-info-400"; // Info/en-route
```

## Integration with Backend

The page uses `DispatchService` from `@witylogix/core/dispatch`:

```typescript
import { createDispatchService } from "@witylogix/core/dispatch";

const service = createDispatchService("shop-id");

// Load routes
const routes = await service.getActiveRoutes();

// Get statistics
const stats = await service.getDispatchStats();

// Optimize routes
const result = await service.optimizeRoutes({
  unscheduledOrderIds: ["order-1", "order-2"],
  availableDriverIds: ["driver-1"],
  shopId: "shop-id",
  date: new Date(),
});
```

## Actions

### Optimize Routes

Click "Plan Routes" button to trigger batch optimization:

1. Fetches unscheduled orders
2. Gets available drivers
3. Calls optimization algorithm
4. Updates route assignments

### Select Stop

Click a stop marker or timeline dot to view details

### Reassign Stop

From the detail panel, click "Reassign to Another Route"

- In production: Opens modal to select target route
- Updates sequence numbers in both routes
- Recalculates metrics

### Skip Stop

Mark a stop as skipped (customer unavailable, etc.)

- Updates stop status to "skipped"
- Removes from route
- Recalculates route metrics

### Prioritize Stop

Mark a stop as priority (VIP customer, time-sensitive, etc.)

- Moves stop up in route sequence
- Updates ETA calculations
- Notifies driver

## Performance Tips

1. **For 50+ routes**: Implement route virtualization
2. **For 1000+ stops**: Use marker clustering
3. **For real-time**: Debounce WebSocket updates (max 1/sec)
4. **Map rendering**: Lazy load route details on select

## Testing

### Component Tests

```bash
npm run test components/dispatch
```

### Service Tests

```bash
npm run test dispatch-service
```

### E2E Tests

```bash
npm run test:e2e dispatch
```

## Development

### Add a New Feature

1. **Update types** in `@witylogix/core/dispatch/types.ts`
2. **Add service method** in `dispatch-service.ts`
3. **Create component** in `components/`
4. **Integrate** in `page.tsx`
5. **Test** with unit and integration tests

### Debug Mode

Enable detailed logging:

```typescript
// In page.tsx
useEffect(() => {
  console.log("Routes updated:", routes);
  console.log("Stats updated:", stats);
  console.log("Selected stop:", selectedStop);
}, [routes, stats, selectedStop]);
```

## Known Limitations

1. **Map**: Placeholder only - requires Leaflet integration
2. **Drag-drop**: Structure ready, handlers not implemented
3. **WebSocket**: Service methods stubbed, needs real-time integration
4. **Database**: Using mock data, connect to Prisma
5. **Optimization**: Calls route-optimizer stub, needs real integration

## See Also

- [Architecture Decision Record (ADR-024)](../../adr/ADR-024-dispatch-dashboard.md)
- [Implementation Guide](../../DISPATCH_DASHBOARD_GUIDE.md)
- [DispatchService Docs](../../../packages/core/src/dispatch/)
- [Route Optimizer](../../../packages/core/src/route-optimizer/)
