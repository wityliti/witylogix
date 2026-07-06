# Shared UI Component Library - Sprint 4.5

Complete component library for Witylogix checkout widget and dispatch dashboard. All components are built with **Tailwind CSS v3.4** using `--wl-*` CSS variables with full dark theme support.

## Overview

This Sprint 4.5 delivery includes **13 production-ready components** across three categories:

1. **Dispatch Components** (5) - Real-time route visualization
2. **Checkout Components** (5) - Embeddable checkout widget UI
3. **Shared Utility Components** (3) - Cross-platform status & metrics

---

## Dispatch Components

Located at: `apps/dashboard/src/components/dispatch/`

### 1. RouteTimelineBar

Horizontal timeline showing delivery stops throughout the day with visual capacity indicators.

**File**: `route-timeline-bar.tsx`

```typescript
<RouteTimelineBar
  stops={[
    {
      id: "stop-1",
      sequenceNumber: 1,
      startTime: new Date("2026-03-11T09:00"),
      endTime: new Date("2026-03-11T09:30"),
      customerName: "John Doe",
      address: "123 Main St",
      status: "delivered",
    },
  ]}
  routeColor="#3b82f6"
  startHour={8}
  endHour={19}
/>
```

**Props**:

- `stops: DeliveryStop[]` - Array of delivery stops with timing
- `routeColor: string` - Hex color for route visualization
- `startHour?: number` - Timeline start hour (default: 8)
- `endHour?: number` - Timeline end hour (default: 19)
- `className?: string` - Additional CSS classes

**Features**:

- Hour markers (8am-7pm with configurable range)
- Colored bar segments per stop
- Hover tooltip with stop details
- Current time indicator line with pulse
- Status colors: pending (40% opacity), in-transit (80%), delivered (100%)

---

### 2. DriverAvatar

Circular avatar component with driver photo, initials fallback, status ring, and vehicle type overlay.

**File**: `driver-avatar.tsx`

```typescript
<DriverAvatar
  name="Alex Johnson"
  photoUrl="https://example.com/avatar.jpg"
  status="active"
  vehicleType="van"
  size="lg"
/>
```

**Props**:

- `name: string` - Driver full name
- `photoUrl?: string` - URL to driver photo
- `status?: DriverStatus` - "active" | "idle" | "offline"
- `vehicleType?: VehicleType` - "car" | "van" | "bike" | "truck"
- `size?: AvatarSize` - "sm" | "md" | "lg"
- `className?: string` - Additional CSS classes

**Features**:

- Photo or initials fallback
- Status ring with pulse animation (green=active, yellow=idle, gray=offline)
- Vehicle type emoji overlay
- Responsive sizes: 8px (sm), 10px (md), 14px (lg)

---

### 3. StopMarker

Numbered circular marker for map display with sequence number, status, and pulse animation.

**File**: `stop-marker.tsx`

```typescript
<StopMarker
  number={5}
  color="#10b981"
  isNext={true}
  isDelivered={false}
  size="large"
/>
```

**Props**:

- `number: number` - Sequence number (1, 2, 3...)
- `color: string` - Route color (hex)
- `isNext?: boolean` - Highlight next delivery
- `isDelivered?: boolean` - Show checkmark instead of number
- `size?: MarkerSize` - "small" | "large"
- `className?: string` - Additional CSS classes

**Features**:

- Numbered or checkmark display
- White border with shadow
- Pulse animation for next delivery
- Ring and offset glow effect

---

### 4. RouteStatsBadge

Compact badge displaying route statistics: stops, distance, estimated time.

**File**: `route-stats-badge.tsx`

```typescript
<RouteStatsBadge
  stops={32}
  distance={45}
  estimatedTime="6h 15m"
  unit="km"
/>
```

**Props**:

- `stops: number` - Number of delivery stops
- `distance: number` - Total distance
- `estimatedTime: string` - Estimated delivery time
- `unit?: "km" | "mi"` - Distance unit (default: "km")
- `icon?: boolean` - Show emoji icons (default: true)
- `className?: string` - Additional CSS classes

**Features**:

- Horizontal layout with dividers
- Icon indicators (📍 stops, 📏 distance, ⏱️ time)
- Rounded pill shape with elevation

---

### 5. DispatchFilterBar

Comprehensive filter/search component for dispatch management with search, status filter, sort, and view toggle.

**File**: `dispatch-filter-bar.tsx`

```typescript
<DispatchFilterBar
  onSearchChange={(search) => console.log(search)}
  onStatusChange={(status) => console.log(status)}
  onSortChange={(sort) => console.log(sort)}
  onViewChange={(view) => console.log(view)}
/>
```

**Props**:

- `onSearchChange?: (search: string) => void`
- `onStatusChange?: (status: OrderStatus) => void`
- `onSortChange?: (sort: SortOption) => void`
- `onViewChange?: (view: ViewMode) => void`
- `className?: string` - Additional CSS classes

**Types**:

- `OrderStatus`: "all" | "pending" | "in-transit" | "delivered"
- `SortOption`: "time" | "distance" | "priority"
- `ViewMode`: "map" | "list" | "timeline"

**Features**:

- Search by order ID, customer name, address
- Dropdown filters for status
- Sort options with icons
- View toggle buttons (map, list, timeline)
- Active filters summary display

---

## Checkout Widget Components

Located at: `packages/checkout-widget/src/components/`

### 6. CalendarDay

Single calendar day cell with availability indicator, slots left counter, and selection states.

**File**: `calendar-day.tsx`

```typescript
<CalendarDay
  date={15}
  status="available"
  slotsLeft={8}
  isSelected={false}
  isToday={true}
  onClick={() => handleSelect()}
/>
```

**Props**:

- `date: number` - Day of month (1-31)
- `status?: AvailabilityStatus` - "available" | "limited" | "full" | "unavailable"
- `slotsLeft?: number` - Number of remaining slots
- `isSelected?: boolean` - Selection state
- `isToday?: boolean` - Highlight today
- `isBlackedOut?: boolean` - Disable and strikethrough
- `onClick?: () => void` - Selection handler
- `className?: string` - Additional CSS classes

**Types**:

- `AvailabilityStatus`: "available" (green) | "limited" (yellow) | "full" (gray) | "unavailable" (disabled)

**Features**:

- Availability dot indicator (colored)
- Slots left micro-text
- Selected state with accent border
- Today indicator (red pulse dot)
- Blackout state with strikethrough
- Disabled state for unavailable dates

---

### 7. TimeSlotCard

Individual time slot with capacity bar, price, and state-specific styling.

**File**: `time-slot-card.tsx`

```typescript
<TimeSlotCard
  timeSlot={{
    id: "slot-1",
    startTime: new Date("2026-03-12T10:00"),
    endTime: new Date("2026-03-12T11:00"),
    capacity: { total: 10, available: 3, reserved: 7 },
    price: 4.99,
  }}
  state="few-left"
  cutoffTime="4:00 PM"
  showCutoffWarning={true}
/>
```

**Props**:

- `timeSlot: TimeSlot` - Slot data with times and capacity
- `state?: SlotState` - "available" | "few-left" | "full" | "selected"
- `cutoffTime?: string` - Cutoff time for ordering
- `price?: number` - Slot price in currency
- `showCutoffWarning?: boolean` - Display cutoff warning
- `onClick?: () => void` - Selection handler
- `className?: string` - Additional CSS classes

**Features**:

- Time range display (formatted)
- Capacity bar with fill percentage
- Available slots count
- State badges (few left, full, selected)
- Optional cutoff warning with red styling
- Selection indicator checkmark

---

### 8. DeliveryMethodCard

Radio-button style card for selecting delivery method with icon, description, price, and eta.

**File**: `delivery-method-card.tsx`

```typescript
<DeliveryMethodCard
  method={{
    id: DeliveryMethodType.STANDARD,
    name: "Standard Delivery",
    description: "Next business day",
    estimatedTime: "24-48 hours",
    price: 0,
    enabled: true,
  }}
  isSelected={true}
/>
```

**Props**:

- `method: DeliveryMethod` - Delivery method details
- `isSelected?: boolean` - Selection state
- `isDisabled?: boolean` - Disabled state
- `disabledReason?: string` - Why method is unavailable
- `onClick?: () => void` - Selection handler
- `className?: string` - Additional CSS classes

**Features**:

- Icon, name, and description
- Estimated time and price display
- Radio button selection indicator
- Disabled state with reason message
- Hover effects for interactive feedback

---

### 9. ZoneMapMini

Miniature SVG-based zone map showing delivery zone polygon and customer location.

**File**: `zone-map-mini.tsx`

```typescript
<ZoneMapMini
  zoneName="Zone A"
  zoneColor="#10b981"
  isInZone={true}
  customerLat={40.7128}
  customerLng={-74.0060}
/>
```

**Props**:

- `zoneName: string` - Zone identifier
- `zoneColor?: string` - Zone color (hex, default: "#3b82f6")
- `isInZone?: boolean` - Whether customer is in zone
- `zonePolygonCoords?: Array<{lat, lng}>` - Zone boundary coordinates
- `customerLat?: number` - Customer latitude
- `customerLng?: number` - Customer longitude
- `className?: string` - Additional CSS classes

**Features**:

- SVG-rendered zone polygon
- Customer location marker (red pin)
- Glow effect around marker
- Status indicator badge (in/out of zone)
- Responsive 16:9 aspect ratio
- Informative zone status message

---

### 10. AddressSuggestionItem

Autocomplete suggestion item with address text, zone indicator, and deliverability badge.

**File**: `address-suggestion-item.tsx`

```typescript
<AddressSuggestionItem
  address="123 Main Street"
  city="New York"
  state="NY"
  zipcode="10001"
  zoneName="Zone A"
  isDeliverable={true}
  matchedText="Main"
  onClick={() => handleSelect()}
/>
```

**Props**:

- `address: string` - Street address
- `city: string` - City name
- `state: string` - State/Province
- `zipcode: string` - Postal code
- `zoneName?: string` - Delivery zone
- `isDeliverable?: boolean` - Deliverability status
- `matchedText?: string` - Text to highlight
- `onClick?: () => void` - Selection handler
- `className?: string` - Additional CSS classes

**Features**:

- Address with matched text highlighting
- City, state, zip on secondary line
- Zone badge
- Deliverability status icon (✓ or ✕)
- Hover effects and disabled states

---

## Shared Utility Components

Located at: `apps/dashboard/src/components/ui/`

### 11. StatusTimeline

Vertical or horizontal timeline showing delivery status steps with icons, timestamps, and POD images.

**File**: `status-timeline.tsx`

```typescript
<StatusTimeline
  steps={[
    {
      id: "ordered",
      title: "Order Placed",
      timestamp: "Mar 11, 2:30 PM",
      status: "completed",
      icon: "📦",
    },
    {
      id: "delivering",
      title: "Out for Delivery",
      description: "Driver is 5 minutes away",
      status: "active",
      icon: "🚚",
      podImage: "https://...",
      podLabel: "Delivered to",
    },
  ]}
  currentStep={1}
  orientation="vertical"
/>
```

**Props**:

- `steps: TimelineStep[]` - Array of timeline steps
- `currentStep?: number` - Currently active step index
- `orientation?: TimelineOrientation` - "vertical" (default) | "horizontal"
- `showPODImage?: boolean` - Display proof-of-delivery images
- `className?: string` - Additional CSS classes

**Types**:

- `TimelineStepStatus`: "completed" | "active" | "pending"
- `TimelineOrientation`: "vertical" | "horizontal"

**Features**:

- Connected dots with status colors
- Auto-filled connection line up to current step
- Horizontal layout with progress bar
- Vertical layout with descriptions
- POD image display for delivered steps
- Pulse animation on active step

---

### 12. MetricCard

Animated counter card displaying a metric with trend indicator.

**File**: `metric-card.tsx`

```typescript
<MetricCard
  value={2847}
  label="Orders Delivered"
  trend={{ value: 12, label: "vs last week" }}
  icon={<TrendingUpIcon />}
  accentColor="var(--wl-success-500)"
  format={(val) => `${val.toLocaleString()}`}
/>
```

**Props**:

- `value: number` - Metric value to display
- `label: string` - Metric label
- `trend?: { value: number; label: string }` - Trend data
- `icon?: ReactNode` - Icon component
- `accentColor?: string` - CSS color variable or hex
- `animated?: boolean` - Enable counter animation (default: true)
- `format?: (val: number) => string` - Custom value formatter
- `className?: string` - Additional CSS classes

**Features**:

- Animated counter from 0 to target value
- 1-second animation duration
- Trend indicator with ↑/↓ arrow
- Green color for positive, red for negative trends
- Accent color bar at top
- Large bold typography

---

### 13. ColorLegend

Route color legend with toggleable route visibility on map.

**File**: `color-legend.tsx`

```typescript
<ColorLegend
  routes={[
    { id: "route-1", color: "#3b82f6", driverName: "Alex Johnson", isVisible: true },
    { id: "route-2", color: "#10b981", driverName: "Sarah Smith", isVisible: true },
  ]}
  onToggleRoute={(routeId, isVisible) => console.log(routeId, isVisible)}
  compact={false}
/>
```

**Props**:

- `routes: RouteColor[]` - Array of route colors and driver names
- `onToggleRoute?: (routeId: string, isVisible: boolean) => void` - Toggle handler
- `compact?: boolean` - Compact mode (horizontal badges vs list)
- `className?: string` - Additional CSS classes

**Types**:

- `RouteColor`: { id, color, driverName, isVisible? }

**Features**:

- Two layout modes: compact (badges) and full (list)
- Color swatch with ring indicator when active
- Eye icon for visibility toggle
- Opacity change for hidden routes
- Helper text in full mode
- Click to toggle route visibility

---

## Installation & Usage

### Dispatch Components

```typescript
import {
  RouteTimelineBar,
  DriverAvatar,
  StopMarker,
  RouteStatsBadge,
  DispatchFilterBar,
} from "@/components/dispatch";
```

### Checkout Components

```typescript
import {
  CalendarDay,
  TimeSlotCard,
  DeliveryMethodCard,
  ZoneMapMini,
  AddressSuggestionItem,
} from "@witylogix/checkout-widget";
```

### Shared UI Components

```typescript
import { StatusTimeline, MetricCard, ColorLegend } from "@/components/ui";
```

---

## Styling & Theming

All components use **Witylogix CSS Variables**:

### Color Tokens

- Primary: `--wl-primary-*` (500, 600, 700)
- Success: `--wl-success-*` (400, 500, 600)
- Warning: `--wl-warning-*` (500, 600)
- Danger: `--wl-danger-*` (400, 500, 600)
- Neutral: `--wl-neutral-*` (300, 400, 500)

### Semantic Tokens

- Background: `--wl-bg-primary`, `--wl-bg-secondary`, `--wl-bg-elevated`
- Border: `--wl-border-default`, `--wl-border-subtle`, `--wl-border-strong`
- Text: `--wl-text-primary`, `--wl-text-secondary`, `--wl-text-tertiary`

### Dark Mode

All components have full dark mode support via Tailwind dark: prefix.

Example:

```tsx
className = "bg-wl-bg-primary dark:bg-wl-bg-elevated";
```

---

## Accessibility

All components include:

- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Status announcements
- Semantic HTML

---

## Browser Support

- Chrome/Edge: Latest
- Firefox: Latest
- Safari: Latest (14+)
- Mobile browsers: iOS Safari 14+, Chrome Android

---

## Files Checklist

### Dispatch Components ✓

- [x] route-timeline-bar.tsx
- [x] driver-avatar.tsx
- [x] stop-marker.tsx
- [x] route-stats-badge.tsx
- [x] dispatch-filter-bar.tsx
- [x] index.ts (barrel export)

### Checkout Components ✓

- [x] calendar-day.tsx
- [x] time-slot-card.tsx
- [x] delivery-method-card.tsx
- [x] zone-map-mini.tsx
- [x] address-suggestion-item.tsx
- [x] cn.ts (utility function)
- [x] index.ts (barrel export)

### Shared UI Components ✓

- [x] status-timeline.tsx
- [x] metric-card.tsx
- [x] color-legend.tsx
- [x] Updated index.ts with exports

---

## Technical Details

### Dependencies

- React 18+
- Tailwind CSS 3.4
- clsx 2.0 (for cn utility)
- date-fns 3.0 (for date utilities in checkout-widget)
- lucide-react (for icons)

### Build & Export

- **Dashboard**: Uses Next.js with TypeScript
- **Checkout Widget**: Standalone package with tsup build
- All components are fully typed with exported interfaces

### Performance

- CSS-based animations (no heavy libraries)
- Optimized renders with proper memoization
- No unnecessary re-renders with proper dependency tracking

---

## Next Steps

1. **Integration**: Import components into your pages/views
2. **Testing**: Add component tests in respective `__tests__` directories
3. **Documentation**: Update Storybook stories for visual testing
4. **Customization**: Override CSS variables for brand customization

---

Generated as part of Witylogix Sprint 4.5
Created by: Component Development Team
Date: March 11, 2026
