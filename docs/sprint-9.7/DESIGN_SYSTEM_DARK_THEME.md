# Sprint 9.7 — Dark Theme Design System

## Overview

Professional dark theme for all dashboard pages. This document provides the complete color palette and implementation guidelines for applying the dark theme across the remaining 135 pages.

## Color Palette

### Primary Colors

- **Page Background**: `#0a0a0f` — Use for main container
- **Card Background**: `#12121a` — Use for all Card components
- **Input/Overlay Background**: `#1a1a2e` — Use for inputs, modals, hover states
- **Border Color**: `#1e1e2e` — Use for all borders and dividers

### Text Colors

- **Primary Text**: `text-white` — Headings, main content
- **Secondary Text**: `text-gray-400` — Descriptions, labels
- **Tertiary Text**: `text-gray-500` — Meta information, timestamps
- **Muted Text**: `text-gray-600` — Disabled states

### Status Colors (Tailwind v3.4)

- **Success**: `text-emerald-500` / `bg-emerald-500`
- **Warning**: `text-amber-500` / `bg-amber-500`
- **Danger**: `text-red-500` / `bg-red-500`
- **Info**: `text-blue-500` / `bg-blue-500`

## Implementation Pattern

### Page Template

```tsx
export default function YourPage() {
  return (
    <>
      <Header
        title="Page Title"
        subtitle="Subtitle or stats"
        actions={/* buttons */}
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Label"
            value={123}
            change={{ value: 15.3, label: "vs last period" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
        </div>

        {/* Search/Filter Bar */}
        <div className="flex gap-4 mb-5 items-center flex-wrap">
          <input
            className={cn(
              "flex-1 max-w-96 p-2 px-4 bg-[#1a1a2e] border border-[#1e1e2e] rounded-md text-white text-sm outline-none",
            )}
            placeholder="Search..."
          />
        </div>

        {/* Data Table */}
        <Card
          className={cn(
            "overflow-hidden p-0 bg-[#12121a] border border-[#1e1e2e]",
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={cn("border-b border-[#1e1e2e] bg-[#1a1a2e]")}>
                  <th
                    className={cn(
                      "p-3 px-4 text-left font-semibold text-gray-400",
                    )}
                  >
                    Column
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-[#1e1e2e] transition-colors duration-fast hover:bg-[#1a1a2e]",
                      idx % 2 === 0 ? "bg-transparent" : "bg-[#1a1a2e]",
                    )}
                  >
                    <td className="p-3 px-4 text-white">{item.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
```

## Component Styling Guidelines

### Card Component

```tsx
<Card className={cn("bg-[#12121a] border border-[#1e1e2e]")}>
  {/* Content */}
</Card>
```

### Button Component

```tsx
// Primary action (blue)
<Button variant="primary">Action</Button>

// Secondary action (subtle)
<Button variant="secondary">Secondary</Button>

// Danger action (red)
<Button variant="danger">Delete</Button>
```

### Badge Component

```tsx
// Status indicators
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Failed</Badge>
<Badge variant="default">Neutral</Badge>
```

### Form Inputs

```tsx
<input
  className={cn(
    "w-full p-2 px-4 bg-[#1a1a2e] border border-[#1e1e2e] rounded-md text-white text-sm outline-none"
  )}
  placeholder="Placeholder..."
/>

<select
  className={cn(
    "p-2 px-3 bg-[#1a1a2e] border border-[#1e1e2e] rounded-md text-white text-sm cursor-pointer outline-none"
  )}
>
  <option value="">Option</option>
</select>
```

### Filter/Action Chips

```tsx
{
  /* Active */
}
<button
  className={cn(
    "p-1 px-3 rounded-full border text-xs font-semibold cursor-pointer",
    "bg-blue-500 text-white border-blue-500",
  )}
>
  Active Filter
</button>;

{
  /* Inactive */
}
<button
  className={cn(
    "p-1 px-3 rounded-full border text-xs font-semibold cursor-pointer",
    "bg-transparent text-gray-400 border-[#1e1e2e]",
  )}
>
  Inactive Filter
</button>;
```

## Pages Completed (47)

### Finance & Payments (Agent 7)

- ✓ finance/page.tsx
- ✓ finance/invoices/page.tsx
- ✓ finance/reconciliation/page.tsx
- ✓ payments/page.tsx
- ✓ invoices/page.tsx
- ✓ invoices/create/page.tsx
- ✓ invoices/[id]/page.tsx
- ✓ products/page.tsx
- ✓ products/sync/page.tsx
- ✓ inventory/page.tsx

### Orders & Routes (Agents 3-4, partial)

- ✓ orders/page.tsx
- ✓ orders/[id]/page.tsx
- ✓ orders/bulk/page.tsx
- ✓ orders/conflicts/page.tsx
- ✓ orders/create/page.tsx
- ✓ orders/import/page.tsx
- ✓ orders/local/page.tsx
- ✓ routes/page.tsx
- ✓ routes/[id]/page.tsx
- ✓ routes/[id]/edit/page.tsx
- ✓ routes/[id]/assign/page.tsx
- ✓ routes/create/page.tsx
- ✓ routes/plan/page.tsx
- ✓ dispatch/couriers/page.tsx

### Fleet & Shipping (Agent 5, partial)

- ✓ fleet/vehicles/page.tsx
- ✓ fleet/vehicles/[id]/page.tsx
- ✓ fleet/fuel/page.tsx
- ✓ fleet/maintenance/page.tsx
- ✓ shipping/labels/page.tsx
- ✓ shipping/labels/new/page.tsx
- ✓ shipping/tracking/page.tsx
- ✓ shipping/tracking/[trackingNumber]/page.tsx

### Tracking & Delivery (Agent 6, partial)

- ✓ tracking/page.tsx
- ✓ tracking/live/page.tsx
- ✓ tracking-config/page.tsx
- ✓ delivery/page.tsx
- ✓ delivery/standard/page.tsx
- ✓ map/page.tsx

### Plus ~17 additional pages from earlier styling work

## Pages Remaining (135)

### CRM & Customers (Agent 8) - 8 pages

- [ ] crm/page.tsx
- [ ] crm/connect/page.tsx
- [ ] customers/page.tsx
- [ ] partners/page.tsx
- [ ] partners/[id]/page.tsx
- [ ] partners/compare/page.tsx
- [ ] partners/onboard/page.tsx
- [ ] collaboration/page.tsx

### ELD + Campaigns + Misc (Agent 9) - 12+ pages

- [ ] eld/page.tsx
- [ ] eld/dvir/page.tsx
- [ ] eld/hos/page.tsx
- [ ] campaigns/page.tsx
- [ ] campaigns/[id]/page.tsx
- [ ] calendar/page.tsx
- [ ] events/page.tsx
- [ ] collections/page.tsx
- [ ] saved-views/page.tsx
- [ ] profile/page.tsx
- [ ] support/page.tsx
- [ ] onboarding/page.tsx
- [ ] returns/page.tsx

### Platform + Stores + Misc (Agent 10) - 8+ pages

- [ ] platform/page.tsx
- [ ] stores/page.tsx
- [ ] locations/page.tsx
- [ ] zones/page.tsx
- [ ] time-slots/page.tsx
- [ ] widget-config/page.tsx
- [ ] widgets/page.tsx
- [ ] mobile-config/page.tsx

### Settings & Admin (Additional) - 40+ pages

- [ ] settings/page.tsx (and all subpages)
- [ ] admin/page.tsx (and all subpages)
- [ ] integrations/page.tsx (and all subpages)
- [ ] analytics/page.tsx (and all subpages)

## Implementation Strategy

1. **Copy Template**: Use the page template above as starting point
2. **Apply Colors**: Replace all backgrounds/borders/text colors systematically
3. **Test Layout**: Ensure proper contrast and readability
4. **Component Consistency**: Use Button/Badge/Card components from @/components/ui
5. **Commit Increments**: Commit after every 5-10 pages

## Git Workflow

```bash
# Start work on next agent's pages
git checkout -b sprint-9.7-agent-[N]-[category]

# Make changes to 5-10 pages
# Test locally

# Commit
git add apps/dashboard/src/app/\(dashboard\)/[category]
git commit -m "Sprint 9.7: Agent [N] - Dark theme redesign for [category] pages"

# Push
git push origin sprint-9.7-agent-[N]-[category]
```

## Quality Checklist

- [ ] Page background is `bg-[#0a0a0f]` with `min-h-screen`
- [ ] Cards use `bg-[#12121a] border border-[#1e1e2e]`
- [ ] All inputs use `bg-[#1a1a2e] border border-[#1e1e2e]`
- [ ] Primary text is `text-white`
- [ ] Secondary text is `text-gray-400`
- [ ] No hardcoded colors (use Tailwind/hex only)
- [ ] Headers use Header component with proper styling
- [ ] Tables have alternating row backgrounds
- [ ] Hover states use `hover:bg-[#1a1a2e]`
- [ ] Status colors match the palette
- [ ] Loading states visible and clear
- [ ] Empty states have proper message
- [ ] Pagination/buttons styled correctly

## Notes

- All pages should maintain their original functionality
- Only styling is being changed
- Use `cn()` utility from `@/lib/utils` for conditional classNames
- Import from `@/components/ui` for all standard components
- Test dark mode accessibility (WCAG AA contrast minimum)
