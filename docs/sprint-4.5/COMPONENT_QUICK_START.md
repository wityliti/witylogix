# Component Library Quick Start Guide

## 📦 What You Got

13 production-ready React components across 3 categories:
- **5 Dispatch Components** - Real-time route & driver visualization
- **5 Checkout Components** - Embeddable date/time/method selection
- **3 Shared UI Components** - Cross-platform status & metrics

## 🎯 Quick Import Examples

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

### Shared UI
```typescript
import {
  StatusTimeline,
  MetricCard,
  ColorLegend,
} from "@/components/ui";
```

---

## 🚀 Common Use Cases

### Display a route with stops
```tsx
<RouteTimelineBar
  stops={stops}
  routeColor="#3b82f6"
  startHour={8}
  endHour={19}
/>
```

### Show driver status
```tsx
<DriverAvatar
  name="John Doe"
  photoUrl="..."
  status="active"
  vehicleType="van"
  size="lg"
/>
```

### Filter orders
```tsx
<DispatchFilterBar
  onSearchChange={setSearch}
  onStatusChange={setStatus}
  onViewChange={setView}
/>
```

### Calendar date picker
```tsx
<CalendarDay
  date={15}
  status="available"
  slotsLeft={5}
  isSelected={false}
  onClick={() => selectDate(15)}
/>
```

### Time slot selection
```tsx
<TimeSlotCard
  timeSlot={slot}
  state="available"
  price={4.99}
  cutoffTime="4:00 PM"
/>
```

### Delivery method selection
```tsx
<DeliveryMethodCard
  method={method}
  isSelected={selected}
  onClick={handleSelect}
/>
```

### Show delivery zone
```tsx
<ZoneMapMini
  zoneName="Zone A"
  isInZone={true}
  customerLat={40.7128}
  customerLng={-74.0060}
/>
```

### Delivery status timeline
```tsx
<StatusTimeline
  steps={steps}
  currentStep={2}
  orientation="vertical"
/>
```

### Metrics display
```tsx
<MetricCard
  value={2847}
  label="Orders Delivered"
  trend={{ value: 12, label: "vs last week" }}
  format={(v) => v.toLocaleString()}
/>
```

### Show route visibility
```tsx
<ColorLegend
  routes={routes}
  onToggleRoute={handleToggle}
  compact={false}
/>
```

---

## 🎨 Styling

### Override with Tailwind
```tsx
<RouteTimelineBar
  stops={stops}
  routeColor="#3b82f6"
  className="rounded-xl shadow-lg"
/>
```

### Dark Mode (Automatic)
```tsx
// Dark mode classes are built-in
// Just add dark: prefix in CSS
<div className="bg-wl-bg-primary dark:bg-wl-bg-elevated">
```

### Custom Colors
```tsx
<MetricCard
  value={100}
  label="Growth"
  accentColor="var(--wl-success-500)"
/>
```

---

## 📋 Component Checklist

Use this when integrating components:

- [ ] Import component from correct path
- [ ] Pass required props (no defaults)
- [ ] Add TypeScript types
- [ ] Add click handlers if interactive
- [ ] Test dark mode
- [ ] Test responsive (mobile/tablet/desktop)
- [ ] Add ARIA labels for accessibility
- [ ] Handle loading/error states
- [ ] Test with real data

---

## 🔍 Where Are They?

```
📦 Dispatch Components
   └─ apps/dashboard/src/components/dispatch/
      ├─ route-timeline-bar.tsx ⏱️
      ├─ driver-avatar.tsx 👤
      ├─ stop-marker.tsx 📍
      ├─ route-stats-badge.tsx 📊
      └─ dispatch-filter-bar.tsx 🔍

📦 Checkout Components
   └─ packages/checkout-widget/src/components/
      ├─ calendar-day.tsx 📅
      ├─ time-slot-card.tsx ⏰
      ├─ delivery-method-card.tsx 🚚
      ├─ zone-map-mini.tsx 🗺️
      └─ address-suggestion-item.tsx 📍

📦 Shared UI Components
   └─ apps/dashboard/src/components/ui/
      ├─ status-timeline.tsx 📍
      ├─ metric-card.tsx 📈
      └─ color-legend.tsx 🎨
```

---

## 🧪 Testing

### Example unit test
```typescript
import { render, screen } from '@testing-library/react';
import { RouteTimelineBar } from '@/components/dispatch';

describe('RouteTimelineBar', () => {
  it('renders timeline with stops', () => {
    render(
      <RouteTimelineBar
        stops={mockStops}
        routeColor="#3b82f6"
      />
    );
    expect(screen.getByText('Stop 1')).toBeInTheDocument();
  });
});
```

---

## 🎯 Pro Tips

1. **Use cn() for conditional classes**
   ```typescript
   className={cn(
     "base-class",
     isActive && "active-class",
     "dark:dark-class"
   )}
   ```

2. **Export prop types**
   ```typescript
   import type { RouteTimelineBarProps } from '@/components/dispatch';
   ```

3. **Use Tailwind extensions**
   ```typescript
   // All components support Tailwind's full utility set
   className="p-4 md:p-6 lg:p-8"
   ```

4. **Dark mode works automatically**
   ```typescript
   // No need to manually toggle - Tailwind handles it
   // Just use dark: prefix in classNames
   ```

5. **Responsive by default**
   ```typescript
   // Components adapt to all screen sizes
   // Use md:, lg:, xl: breakpoints as needed
   ```

---

## 📚 Full Documentation

See `COMPONENT_LIBRARY.md` for:
- Detailed prop documentation
- Feature descriptions
- API reference
- Type definitions
- Examples

See `SPRINT_4.5_COMPLETION.md` for:
- Implementation details
- Architecture decisions
- Performance metrics
- Browser compatibility

---

## ⚡ Performance Tips

1. **Memoize components receiving many props**
   ```typescript
   export const MyComponent = memo(Component);
   ```

2. **Use proper key prop in lists**
   ```typescript
   {stops.map(stop => (
     <StopMarker key={stop.id} {...stop} />
   ))}
   ```

3. **Lazy load heavy components**
   ```typescript
   const ZoneMapMini = lazy(() => import('./zone-map-mini'));
   ```

---

## 🐛 Common Issues

### Issue: Component not found
**Solution**: Check import path (dashboard vs checkout-widget)

### Issue: Styles not applied
**Solution**: Ensure Tailwind CSS is configured correctly

### Issue: Dark mode not working
**Solution**: Add `dark` class to root HTML element

### Issue: Props TypeScript error
**Solution**: Import type from component `import type { Props }`

---

## 📞 Support

For issues or questions:
1. Check `COMPONENT_LIBRARY.md` documentation
2. Review component implementation in src
3. Check TypeScript types for available props
4. Test in isolation before integration

---

## ✅ Ready to Use

All components are:
- ✅ Production-ready
- ✅ Fully typed
- ✅ Accessible
- ✅ Responsive
- ✅ Dark mode
- ✅ Animated
- ✅ Documented

**Start building! 🚀**
