# Dashboard Components Index

This document maps extracted components to their locations and provides integration guidance.

## CRM Connect (`crm/connect/_components/`)

### wizard.tsx (160 LOC)

**Exports:**

- `Wizard` - Main compound component container with flex layout
- `WizardNav` - Step navigation sidebar with progress indicators
- `WizardContent` - Content area wrapper
- `WizardStep` - Individual step display with header
- `WizardStep` interface - Step data structure
- `WizardProps`, `WizardNavProps`, `WizardContentProps`, `WizardStepProps` - PropTypes

**Usage:**

```tsx
import { Wizard, WizardNav, WizardContent, WizardStep } from './_components/wizard';
import { WizardStep as WizardStepType } from './_components/wizard';

const steps: WizardStepType[] = [...];
<Wizard activeStep={active} onStepChange={setActive}>
  <WizardNav steps={steps} activeStep={active} onStepClick={setActive} />
  <WizardContent>
    <WizardStep stepId={1} title="Step 1">{/* content */}</WizardStep>
  </WizardContent>
</Wizard>
```

### types.ts (10 LOC)

**Exports:**

- `SyncConfig` - Sync direction and object types configuration
- `CRMPlatform` - Platform information structure

---

## Design System (`design-system/_components/`)

### code-block.tsx (45 LOC)

**Exports:**

- `CodeBlock` - Code display with copy-to-clipboard
- Props: `{ code: string }`

**Features:**

- Syntax highlighting with monospace font
- Copy button with 2-second confirmation
- Horizontal scroll for long lines

### preview-section.tsx (60 LOC)

**Exports:**

- `PreviewSection` - Component preview with code toggle
- Props: `{ title, description, preview, code }`

**Features:**

- Show/hide code toggle button
- Component preview area with centered content
- Integrated CodeBlock for code display

### design-tabs.tsx (55 LOC)

**Exports:**

- `DesignTabs` - Tab navigation for design sections
- Props: `{ activeTab, onTabChange }`

**Features:**

- 11 design categories (buttons, badges, colors, etc.)
- Active tab highlighting with blue border
- Sticky positioning with backdrop blur
- Responsive horizontal scroll

---

## Payments (`integrations/payments/_components/`)

### payment-provider-card.tsx (105 LOC)

**Exports:**

- `PaymentProviderCard` - Provider card display
- `PaymentProvider` interface - Provider data structure
- Props: `{ provider, onConnect?, onDisconnect? }`

**Features:**

- Status badges (connected, disconnected, error)
- Transaction and volume metrics
- Connect/disconnect buttons
- Hover effects

### payment-summary-cards.tsx (70 LOC)

**Exports:**

- `PaymentSummaryCards` - 3-column KPI display
- Props: `{ totalVolume, totalFees, connectedProviders }`

**Features:**

- Responsive grid (1 col mobile, 3 col desktop)
- Gradient backgrounds by category
- Fee percentage calculation
- Currency formatting

---

## Fuel (`integrations/fuel/_components/`)

### fuel-card-item.tsx (105 LOC)

**Exports:**

- `FuelCardItem` - Individual fuel card display
- `FuelCard` interface - Card data structure
- `CardStatus` type - ACTIVE | INACTIVE | SUSPENDED | PENDING
- `AssignmentType` type - DRIVER | VEHICLE | BOTH
- Props: `{ card, onView?, onDelete?, onSettings? }`

**Features:**

- Status color coding
- Monthly spend progress bar (color-coded by percentage)
- Transaction count display
- Action buttons (View, Edit, Delete)

### fuel-stats-summary.tsx (40 LOC)

**Exports:**

- `FuelStatsSummary` - 5-stat dashboard
- Props: `{ activeCards, suspendedCards, monthlySpend, avgPricePerGallon, fraudAlerts }`

**Features:**

- StatCard integration
- Responsive grid layout
- Icon + metric display
- Variant coloring (info, warning, primary, danger)

---

## Freight (`integrations/freight/_components/`)

### freight-provider-status.tsx (95 LOC)

**Exports:**

- `FreightProviderStatusCard` - Provider status display
- `FreightProvider` interface - Provider data structure
- `FreightProviderStatus` type - CONNECTED | ERROR | DISCONNECTED
- Props: `{ provider, onSync?, onSettings? }`

**Features:**

- Status badge display
- Load metrics (Available, Booked, Avg Rate)
- Last sync timestamp
- Sync and settings action buttons

### load-card.tsx (120 LOC)

**Exports:**

- `LoadCard` - Load/shipment card display
- `AggregatedLoad` interface - Load data structure
- Props: `{ load, onBook?, onDetails? }`

**Features:**

- Origin → destination display with map icon
- Best rate highlighting in green
- Load specifications grid (distance, weight, equipment, carriers)
- Source badges (multi-provider aggregation)
- Booking and details action buttons
- Responsive 2-column metrics layout

---

## Integration Checklist

For each page, follow these steps:

### Step 1: Identify sections to extract

- [ ] Review existing page.tsx structure
- [ ] Identify logical UI sections (cards, tables, summary areas)
- [ ] Check for repeated patterns

### Step 2: Create component files

- [ ] Create file in `_components/` directory
- [ ] Add 'use client' directive
- [ ] Export interfaces and components
- [ ] Use design token colors
- [ ] Apply proper TypeScript types

### Step 3: Update page.tsx

- [ ] Import components from `'./_components/*'`
- [ ] Replace inline component code with imported component
- [ ] Pass data via props
- [ ] Handle callbacks with onAction props

### Step 4: Test integration

- [ ] Verify page renders without errors
- [ ] Check responsive layout
- [ ] Test interactive elements
- [ ] Validate styling and colors

### Step 5: Cleanup

- [ ] Remove duplicate code from page.tsx
- [ ] Verify page.tsx is under 200 LOC target
- [ ] Run build to catch type issues

---

## Design Token Reference

### Colors

- **Background Root**: `bg-[#0a0a0f]`
- **Background Surface**: `bg-[#12121a]`
- **Background Elevated**: `bg-[#16161e]`
- **Border Primary**: `border-[#1e1e2e]`
- **Text Primary**: `text-white`
- **Text Secondary**: `text-gray-300`
- **Text Tertiary**: `text-gray-400`

### Button Variants

- `variant="primary"` - Main action (blue gradient)
- `variant="secondary"` - Secondary action (bordered)
- `variant="ghost"` - Minimal action (transparent)
- `variant="danger"` - Destructive action (red)

### Badge Variants

- `variant="default"` - Standard gray
- `variant="success"` - Green (emerald-500)
- `variant="warning"` - Yellow (amber-500)
- `variant="danger"` - Red
- `variant="info"` - Blue
- `variant="primary"` - Primary color

---

## Future Reuse Opportunities

These components can be reused across other dashboard pages:

1. **Wizard** - Any multi-step setup flow (OAuth, integrations, forms)
2. **Card Components** - Any list of items with status and actions
3. **Summary Cards** - Any KPI or metrics dashboard
4. **Tab Navigation** - Any tabbed interface
5. **Status Variants** - Consistent status coloring across all pages

Consider moving frequently reused patterns to `@/components/dashboard/` for app-wide availability.
