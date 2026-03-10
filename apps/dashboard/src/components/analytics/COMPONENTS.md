# Analytics Components Library

Complete analytics visualization library for the Witylogix Dashboard (Sprint 4.6). All components are built with **pure SVG + React** with **zero external charting dependencies**.

## Project Overview

- **Zero Dependencies**: No recharts, chart.js, d3, or similar libraries
- **Pure SVG**: Hand-crafted SVG rendering for maximum control and customization
- **Dark Theme Ready**: Full support for --wl-* CSS variables and dark mode
- **Responsive**: ResizeObserver-based responsive behavior
- **Animated**: Smooth entrance animations on all charts
- **Accessible**: Proper ARIA labels and keyboard navigation
- **Tailwind v3.4**: Styled with Tailwind CSS and custom CSS variables

## Components

### 1. Line Chart (`line-chart.tsx`)

SVG-based multi-series line chart with advanced features.

**Features:**
- Multiple series support with legend
- Smooth curve interpolation (cubic bezier)
- Grid lines and axis labels
- Hover tooltips with crosshair
- Area fill (gradient under line)
- Responsive with ResizeObserver
- Entrance animations

**Props:**
```typescript
interface LineChartProps {
  data: { label: string }[];
  series: {
    name: string;
    data: number[];
    color?: string;
  }[];
  xLabel?: string;
  yLabel?: string;
  height?: number; // default: 300
  showGrid?: boolean; // default: true
  showLegend?: boolean; // default: true
  animate?: boolean; // default: true
  smooth?: boolean; // default: true
  showArea?: boolean; // default: false
}
```

**Usage:**
```typescript
<LineChart
  data={[
    { label: "Mon" },
    { label: "Tue" },
    { label: "Wed" },
  ]}
  series={[
    {
      name: "Revenue",
      data: [2400, 2210, 2290],
      color: "#3b82f6",
    },
  ]}
  height={350}
  showGrid
  showLegend
  animate
  smooth
  showArea
/>
```

---

### 2. Bar Chart (`bar-chart.tsx`)

SVG-based vertical/horizontal bar chart with grouped and stacked modes.

**Features:**
- Grouped and stacked modes
- Vertical and horizontal orientations
- Animated entrance (bars grow from bottom)
- Hover highlight with tooltips
- Responsive
- Color-coded series

**Props:**
```typescript
interface BarChartProps {
  data: { label: string }[];
  series: {
    name: string;
    data: number[];
    color?: string;
  }[];
  mode?: "grouped" | "stacked"; // default: "grouped"
  orientation?: "vertical" | "horizontal"; // default: "vertical"
  height?: number; // default: 300
  showLegend?: boolean; // default: true
  animate?: boolean; // default: true
}
```

**Usage:**
```typescript
<BarChart
  data={[{ label: "Q1" }, { label: "Q2" }]}
  series={[
    { name: "Sales", data: [65000, 59000] },
    { name: "Cost", data: [28000, 29000] },
  ]}
  mode="grouped"
  orientation="vertical"
  animate
/>
```

---

### 3. Donut Chart (`donut-chart.tsx`)

SVG donut/pie chart with configurable inner radius.

**Features:**
- Animated segment entrance (sweep animation)
- Center label (total, percentage, or custom text)
- Legend with values and percentages
- Hover to highlight segment + tooltip
- Configurable inner radius for donut effect

**Props:**
```typescript
interface DonutChartProps {
  data: {
    label: string;
    value: number;
    color?: string;
  }[];
  innerRadius?: number; // default: 60
  outerRadius?: number; // default: 100
  showLegend?: boolean; // default: true
  centerLabel?: string;
  animate?: boolean; // default: true
  height?: number; // default: 400
}
```

**Usage:**
```typescript
<DonutChart
  data={[
    { label: "Desktop", value: 45, color: "#3b82f6" },
    { label: "Mobile", value: 35, color: "#10b981" },
    { label: "Tablet", value: 20, color: "#f59e0b" },
  ]}
  innerRadius={60}
  outerRadius={100}
  showLegend
  centerLabel="Total: 100"
/>
```

---

### 4. Heatmap (`heatmap.tsx`)

Grid-based heatmap for visualizing 2D data patterns (e.g., day × hour).

**Features:**
- Configurable cell size and color palette
- Row and column labels
- Cell hover with exact value
- Gradient color scale (low → high)
- Legend showing value range

**Props:**
```typescript
interface HeatmapProps {
  data: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  cellSize?: number; // default: 30
  colorPalette?: string[]; // default: gradient from dark to light
  showLegend?: boolean; // default: true
}
```

**Usage:**
```typescript
<Heatmap
  data={[
    [10, 12, 14, 16],
    [12, 14, 16, 18],
    [14, 16, 18, 20],
  ]}
  rowLabels={["Mon", "Tue", "Wed"]}
  colLabels={["00", "04", "08", "12"]}
  cellSize={35}
  showLegend
/>
```

---

### 5. Sparkline (`sparkline.tsx`)

Tiny inline SVG line chart for tables and cards (no axes, no labels).

**Features:**
- Minimal inline design
- Optional area fill
- Trend-based coloring (green for up, red for down)
- Last point dot indicator
- Configurable width/height

**Props:**
```typescript
interface SparklineProps {
  data: number[];
  width?: number; // default: 80
  height?: number; // default: 32
  color?: string;
  showArea?: boolean; // default: false
  showDot?: boolean; // default: true
  trendColor?: boolean; // default: false
}
```

**Usage:**
```typescript
<Sparkline
  data={[20, 22, 19, 24, 25, 23, 26, 28]}
  width={100}
  height={40}
  showArea
  showDot
  trendColor
/>
```

---

### 6. KPI Card (`kpi-card.tsx`)

Large value display with change indicator and optional sparkline.

**Features:**
- Large, readable value display
- Change indicator (↑ +12% or ↓ -5% with color)
- Sparkline integration
- Icon slot
- Comparison period label
- Multiple format options

**Props:**
```typescript
interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  sparklineData?: number[];
  format?: "number" | "percent" | "currency" | "duration";
  trend?: "up" | "down" | "flat";
  compareLabel?: string;
}
```

**Usage:**
```typescript
<KPICard
  title="Total Revenue"
  value="$124,580"
  change={12.5}
  changeLabel="vs last week"
  sparklineData={[20, 22, 19, 24, 25, 23, 26, 28]}
  compareLabel="This month"
/>
```

---

### 7. Comparison Card (`comparison-card.tsx`)

Side-by-side metric comparison (Planned vs Actual, This Week vs Last Week).

**Features:**
- Side-by-side value comparison
- Progress bar showing ratio
- Delta badge showing difference and trend
- Multiple format options
- Percentage breakdowns

**Props:**
```typescript
interface ComparisonCardProps {
  label: string;
  leftValue: number;
  leftLabel: string;
  rightValue: number;
  rightLabel: string;
  format?: "number" | "percent" | "currency";
  showRatio?: boolean; // default: true
}
```

**Usage:**
```typescript
<ComparisonCard
  label="Sales Performance"
  leftValue={45000}
  leftLabel="Planned"
  rightValue={48500}
  rightLabel="Actual"
  format="currency"
/>
```

---

### 8. Data Table (`data-table.tsx`)

Sortable data table with pagination, row hover, and custom formatters.

**Features:**
- Click header to sort (asc/desc)
- Row hover highlight
- Optional row click handler
- Pagination controls
- Custom column formatters
- Loading skeleton
- Empty state
- Configurable page size

**Props:**
```typescript
interface DataTableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  pageSize?: number; // default: 10
  onRowClick?: (row: T) => void;
  loading?: boolean; // default: false
  emptyText?: string;
}

interface ColumnDefinition<T> {
  key: keyof T;
  label: string;
  width?: string | number;
  align?: "left" | "center" | "right";
  formatter?: (value: any) => string | React.ReactNode;
  sortable?: boolean; // default: true
}
```

**Usage:**
```typescript
<DataTable
  columns={[
    { key: "name", label: "Product", sortable: true },
    {
      key: "revenue",
      label: "Revenue",
      align: "right",
      formatter: (value) => `$${(value / 1000).toFixed(1)}K`,
    },
  ]}
  data={tableData}
  pageSize={10}
  onRowClick={(row) => console.log(row)}
/>
```

---

### 9. Date Range Picker (`date-range-picker.tsx`)

Interactive date range selector with presets.

**Features:**
- Preset ranges: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month
- Custom range input with two calendars
- Display selected range as badge
- Min/max date constraints
- Customizable presets

**Props:**
```typescript
interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: DateRangePreset[];
  minDate?: Date;
  maxDate?: Date;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}
```

**Usage:**
```typescript
const [range, setRange] = useState<DateRange>({
  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  end: new Date(),
});

<DateRangePicker
  value={range}
  onChange={setRange}
/>
```

---

### 10. Chart Tooltip (`chart-tooltip.tsx`)

Reusable tooltip component for all charts.

**Features:**
- Positioned relative to cursor
- Auto-flip when near edges
- Customizable content via render prop
- Fade in/out animation
- Fixed positioning

**Props:**
```typescript
interface ChartTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  data: any;
  renderContent: (data: any) => React.ReactNode;
  offset?: number; // default: 12
}
```

**Usage:**
```typescript
<ChartTooltip
  visible={tooltipVisible}
  x={mouseX}
  y={mouseY}
  data={tooltipData}
  renderContent={(data) => (
    <div className="space-y-1">
      <p className="font-semibold">{data.label}</p>
      <p className="text-xs">{data.value}</p>
    </div>
  )}
/>
```

---

## Types

All shared types are exported from `types.ts`:

```typescript
interface DataPoint {
  label: string;
  value: number;
}

interface Series extends DataPoint {
  color?: string;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}

interface ColumnDefinition<T> {
  key: keyof T;
  label: string;
  width?: string | number;
  align?: "left" | "center" | "right";
  formatter?: (value: any) => string | React.ReactNode;
  sortable?: boolean;
}

// ... and more
```

---

## Styling

All components use:

- **Tailwind CSS v3.4**: For layout and responsive design
- **CSS Variables**: All colors use `--wl-*` custom properties
- **Dark Theme**: Built-in dark mode support
- **Animations**: SVG-based animations with no external libraries

### Color System

Colors are derived from the design system:

- Primary: `var(--wl-primary-500)`, `var(--wl-primary-600)`, etc.
- Success: `var(--wl-success-400)`, `var(--wl-success-500)`, `var(--wl-success-600)`
- Warning: `var(--wl-warning-400)`, `var(--wl-warning-500)`
- Danger: `var(--wl-danger-400)`, `var(--wl-danger-500)`, `var(--wl-danger-600)`
- Info: `var(--wl-info-400)`, `var(--wl-info-500)`
- Neutral: `var(--wl-neutral-50)` through `var(--wl-neutral-900)`
- Text: `var(--wl-text-primary)`, `var(--wl-text-secondary)`, `var(--wl-text-tertiary)`
- Borders: `var(--wl-border-subtle)`, `var(--wl-border-default)`, `var(--wl-border-strong)`

---

## Demo

Use the `AnalyticsDemoDashboard` component in `demo.tsx` to see all components in action:

```typescript
import { AnalyticsDemoDashboard } from "@/components/analytics/demo";

export default function Page() {
  return <AnalyticsDemoDashboard />;
}
```

---

## Performance

- **Zero Dependencies**: No bundle bloat from chart libraries
- **SVG-Based**: Lightweight, scalable graphics
- **ResizeObserver**: Responsive without JavaScript polling
- **Memoization**: Optimized with useMemo for expensive calculations
- **Lazy Rendering**: Only visible data is rendered

---

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast colors for readability
- Focus indicators on interactive components

---

## Future Enhancements

- [ ] Export chart as PNG/SVG
- [ ] Real-time data updates with WebSocket
- [ ] Advanced filtering options
- [ ] Custom color palettes
- [ ] Multi-axis support for line charts
- [ ] Candlestick charts for financial data
- [ ] Gauge/progress charts
- [ ] Scatter plot support
- [ ] 3D chart options

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Notes

- All charts are fully responsive via ResizeObserver
- Colors are customizable via props
- All animations can be disabled with `animate={false}`
- Charts degrade gracefully if data is missing or empty
- No external network requests required

---

## File Structure

```
/components/analytics/
├── index.ts                 # Barrel exports
├── types.ts                 # Shared TypeScript interfaces
├── chart-tooltip.tsx        # Reusable tooltip component
├── line-chart.tsx           # Multi-series line chart
├── bar-chart.tsx            # Grouped/stacked bar chart
├── donut-chart.tsx          # Donut/pie chart
├── heatmap.tsx              # Grid-based heatmap
├── sparkline.tsx            # Tiny inline sparkline
├── kpi-card.tsx             # KPI display card
├── comparison-card.tsx      # Side-by-side comparison
├── data-table.tsx           # Sortable data table
├── date-range-picker.tsx    # Date range selector
├── demo.tsx                 # Component showcase
└── COMPONENTS.md            # This file
```

---

## Development

All components use NAMED imports. Example:

```typescript
import { LineChart } from "@/components/analytics";
import { cn } from "@/lib/utils";
```

Not default imports:

```typescript
// ❌ Don't do this
import LineChart from "@/components/analytics/line-chart";
```

---

**Created for Sprint 4.6 - Analytics Dashboard Implementation**
