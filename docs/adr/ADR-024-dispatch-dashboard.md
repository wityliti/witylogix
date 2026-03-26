# ADR-024: Route Timeline Dispatcher Dashboard Architecture

**Status**: Accepted
**Date**: 2026-03-11
**Author**: Arjun (CTO & Architect)
**Category**: UI/UX, Real-time Systems

## Context

Witylogix requires a real-time route dispatch dashboard enabling dispatchers to monitor, optimize, and manage delivery routes in real-time. The dashboard must provide:
- Real-time visibility of active delivery routes and driver positions
- Timeline/Gantt visualization of route schedules
- Drag-and-drop route reassignment for orders
- Live metrics and performance tracking
- WebSocket-based real-time updates without polling

## Decision

We will build a two-panel dispatch dashboard with:

### Architecture Components

1. **Real-time Communication**
   - WebSocket connections for live driver location updates (via existing tracking service)
   - Server-sent events (SSE) for route status changes
   - Optimistic UI updates with rollback on conflict

2. **Frontend Stack**
   - Next.js 14 App Router with React Server Components for data loading
   - React Query for cache management and real-time subscriptions
   - Leaflet + React-Leaflet for map rendering (open-source, lightweight)
   - Custom timeline/Gantt component (not third-party to maintain control)
   - Tailwind CSS v3.4 with Witylogix design tokens

3. **Map Rendering Strategy**
   - Leaflet library (open-source, no API key required for base tiles)
   - OpenStreetMap for base maps
   - Color-coded route polylines (16 distinct colors for simultaneous routes)
   - Clustered markers for zoomed-out views
   - Real-time driver position markers with tooltips

4. **Timeline/Gantt Component Design**
   - Horizontal timeline view (8 AM - 7 PM standard operating hours)
   - One row per driver/route with color matching
   - Stop positions based on ETA calculations
   - Drag-and-drop to reassign stops between routes
   - Keyboard accessibility support

5. **Drag-and-Drop Architecture**
   - React DnD for robust drag-and-drop
   - Optimistic updates with server-side validation
   - Conflict detection when reassigning stops
   - Undo capability through optimistic state rollback

### Backend Service Architecture

The dispatch service provides:
- **Route Management**: Fetch active routes with real-time stop tracking
- **Stop Reassignment**: Validate and apply route changes
- **Route Optimization**: Integrate with existing route optimizer for batch optimization
- **Stats Calculation**: Aggregate driver/route metrics

### Data Flow

```
Driver Position (WebSocket) → Tracking Service → Redis Cache
                                    ↓
                            React Query Subscription
                                    ↓
                            Map + Timeline Components

Dispatcher Action (drag stop) → Optimistic Update → API Call
                                    ↓
                              Conflict Detection
                                    ↓
                            Confirm or Rollback
```

## Rationale

1. **Leaflet Choice**: Open-source, no API keys needed, lightweight (~40KB), perfect for Witylogix's open-source mission
2. **Custom Timeline Component**: Third-party timeline libraries lack the specific drag-and-drop + real-time requirements
3. **WebSocket + SSE Hybrid**: WebSocket for location updates, SSE for route status (more reliable for status broadcasts)
4. **Optimistic Updates**: Better UX by immediately reflecting dispatcher actions while validating server-side
5. **Color-Coded Routes**: Human perception of colors improves dispatcher efficiency vs. text-based identification

## Implementation Details

### File Structure
```
apps/dashboard/
├── src/app/(dashboard)/dispatch/
│   ├── page.tsx                          # Main dispatch page
│   ├── components/
│   │   ├── dispatch-map.tsx              # Map with routes
│   │   ├── route-timeline.tsx            # Timeline/Gantt view
│   │   ├── driver-card.tsx               # Driver status card
│   │   ├── stop-detail-panel.tsx         # Stop details sidebar
│   │   └── stats-bar.tsx                 # Top metrics bar
│
packages/core/src/dispatch/
├── dispatch-service.ts                    # Core dispatch logic
├── types.ts                               # TypeScript interfaces
├── route-colors.ts                        # 16-color palette
├── index.ts                               # Exports
└── __tests__/
    └── dispatch-service.test.ts           # Unit tests
```

### Type Safety

All components use strict TypeScript with:
- Explicit type definitions for Route, Stop, Driver
- Type-safe React Query hooks
- Zod validation for API responses
- No `any` types except when accessing Prisma models

### Styling Approach

- Tailwind CSS utility classes with `--wl-*` CSS variables
- Named imports from `@/components/ui/*`
- Button variants: primary, secondary, ghost, danger
- Badge variants: default, success, warning, danger, info, primary
- Dark theme support via CSS variables

## Consequences

### Positive
- Dispatchers have real-time visibility of all active routes
- Drag-and-drop reassignment reduces manual data entry errors
- Open-source stack aligns with Witylogix philosophy
- Timeline view enables batch optimization decisions
- No external API dependencies (except base maps)

### Negative
- Custom timeline component requires maintenance
- WebSocket connections need proper cleanup to prevent memory leaks
- Real-time sync issues possible in low-bandwidth scenarios
- Client-side rendering of many routes (1000+) may require virtualization

### Mitigations
- Implement proper WebSocket cleanup in useEffect hooks
- Add virtualization for large route lists in future
- Monitor memory usage in production
- Implement request debouncing for drag-drop actions

## Testing Strategy

- Unit tests for dispatch service (route assignment, stats calculation)
- Component tests with React Testing Library
- Integration tests for WebSocket subscriptions
- E2E tests for drag-and-drop workflows
- Performance tests for 50+ simultaneous routes

## Future Enhancements

1. **Route Optimization AI**: ML-based route suggestions
2. **Traffic Integration**: Real-time traffic data from HERE/TomTom
3. **Predictive ETAs**: ML-based ETA with learning
4. **Voice Commands**: Voice-based dispatcher control
5. **Mobile Dispatch**: Lightweight dispatch app for tablets
6. **Route Replay**: Historical route playback for analysis

## References

- Leaflet Documentation: https://leafletjs.com/
- React Query: https://tanstack.com/query/latest
- Witylogix Route Optimizer: `packages/core/src/route-optimizer/`
- Tracking Service: `packages/core/src/tracking/`
