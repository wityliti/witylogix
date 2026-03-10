# Route Analytics Quick Start Guide

## Project Structure

```
witylogix-platform/
├── docs/adr/
│   └── ADR-025-route-analytics.md          # Architecture decision record
│
├── packages/core/src/analytics/
│   ├── route-analytics.ts                  # Core analytics engine (6 functions)
│   ├── route-analytics-types.ts            # TypeScript type definitions
│   ├── index.ts                            # Public API exports
│   └── __tests__/
│       └── route-analytics.test.ts         # Unit tests (15 test cases)
│
├── apps/api/src/routes/analytics/
│   └── route-performance.ts                # 6 Fastify endpoints
│
├── apps/dashboard/src/app/(dashboard)/analytics/route-performance/
│   ├── page.tsx                            # Main dashboard page
│   └── components/
│       ├── planned-actual-chart.tsx        # Dual-line time-series chart
│       ├── driver-leaderboard.tsx          # Sortable driver table
│       ├── efficiency-heatmap.tsx          # 7×24 efficiency grid
│       ├── co2-tracker.tsx                 # Carbon impact tracker
│       └── sla-compliance.tsx              # SLA metrics dashboard
│
└── SPRINT_4.6_IMPLEMENTATION.md            # Full implementation details
```

## Core Functions

### 1. calculateOnTimePercentage
```typescript
import { calculateOnTimePercentage } from "@witylogix/core/analytics";

const percentage = calculateOnTimePercentage(routes, dateRange);
// Returns: 0-100 (percentage of deliveries within estimated window ± 5 min)
```

### 2. calculatePlannedVsActual
```typescript
import { calculatePlannedVsActual } from "@witylogix/core/analytics";

const comparisons = calculatePlannedVsActual(routes);
// Returns: [{ routeId, plannedDuration, actualDuration, variance, variancePercent, status }]
```

### 3. calculateDriverScorecard
```typescript
import { calculateDriverScorecard } from "@witylogix/core/analytics";

const scorecard = calculateDriverScorecard("driver-1", routes, "30d");
// Returns: { driverId, deliveriesCompleted, onTimePercentage, avgTimePerStop, customerRatingAvg, compositeScore, trend }
```

### 4. calculateCO2Estimates
```typescript
import { calculateCO2Estimates } from "@witylogix/core/analytics";

const co2Data = calculateCO2Estimates(routes);
// Returns: [{ routeId, vehicleType, plannedCO2kg, actualCO2kg, savedCO2kg }]
```

### 5. calculateServiceLevelMetrics
```typescript
import { calculateServiceLevelMetrics } from "@witylogix/core/analytics";

const sla = calculateServiceLevelMetrics("tenant-1", routes, dateRange);
// Returns: { slaCompliance: { premium, standard, economy, overall }, firstAttemptRate, returnRate, failureRate }
```

### 6. calculateRouteEfficiency
```typescript
import { calculateRouteEfficiency } from "@witylogix/core/analytics";

const efficiency = calculateRouteEfficiency(route);
// Returns: { routeId, plannedDistance, actualDistance, routeDeviation, idleTime, idlePercentage, efficiencyRating }
```

## API Endpoints

### GET /route-performance
```bash
curl "http://localhost:3000/api/analytics/route-performance?period=30d"

# Response
{
  "data": {
    "onTimePercentage": 94.3,
    "avgDeliveryTime": 24,
    "co2Savings": 1250,
    "slaCompliance": 92.8,
    "totalDeliveries": 3853,
    "period": "30d"
  },
  "timestamp": "2026-03-11T12:00:00Z",
  "cached": false
}
```

### GET /route-performance/planned-vs-actual
```bash
curl "http://localhost:3000/api/analytics/route-performance/planned-vs-actual?granularity=daily"

# Response
{
  "data": [
    {
      "timestamp": "2026-03-01",
      "plannedDuration": 120,
      "actualDuration": 125,
      "variance": 5,
      "onTimePercentage": 94.3,
      "deliveryCount": 25
    },
    ...
  ],
  "dateRange": { "from": "2026-02-09T00:00:00Z", "to": "2026-03-11T00:00:00Z" },
  "timestamp": "2026-03-11T12:00:00Z"
}
```

### GET /route-performance/drivers
```bash
curl "http://localhost:3000/api/analytics/route-performance/drivers?period=30d&limit=10"

# Response
{
  "data": [
    {
      "rank": 1,
      "driverId": "driver-1",
      "driverName": "Priya Patel",
      "driverAvatarUrl": "https://i.pravatar.cc/150?img=1",
      "deliveriesCompleted": 450,
      "onTimePercentage": 98.2,
      "avgTimePerStop": 19.0,
      "customerRatingAvg": 4.9,
      "firstAttemptRate": 97.5,
      "compositeScore": 95.0,
      "trend": "up",
      "trendValue": 2.3
    },
    ...
  ],
  "totalCount": 10,
  "period": "30d",
  "timestamp": "2026-03-11T12:00:00Z"
}
```

### GET /route-performance/efficiency
```bash
curl "http://localhost:3000/api/analytics/route-performance/efficiency"

# Response
{
  "data": [
    {
      "dayOfWeek": 0,
      "dayName": "Sunday",
      "hour": 0,
      "efficiency": 68,
      "deliveryCount": 12,
      "avgTimeVariance": -3
    },
    ...
  ],
  "dateRange": { "from": "...", "to": "..." },
  "timestamp": "2026-03-11T12:00:00Z"
}
```

### GET /route-performance/co2
```bash
curl "http://localhost:3000/api/analytics/route-performance/co2"

# Response
{
  "data": {
    "plannedTotal": 12450,
    "actualTotal": 12100,
    "savedTotal": 350,
    "targetSavings": 500,
    "trend": [
      { "date": "2026-03-01", "value": 480 },
      ...
    ],
    "vehicleBreakdown": [
      { "type": "Van", "plannedCO2": 7800, "actualCO2": 7450, "savedCO2": 350 },
      ...
    ]
  },
  "dateRange": { "from": "...", "to": "..." },
  "timestamp": "2026-03-11T12:00:00Z"
}
```

### GET /route-performance/sla-compliance
```bash
curl "http://localhost:3000/api/analytics/route-performance/sla-compliance"

# Response
{
  "data": {
    "overall": 92.3,
    "byTier": {
      "premium": { "percentage": 97.8, "count": 1245 },
      "standard": { "percentage": 93.2, "count": 3421 },
      "economy": { "percentage": 88.5, "count": 2187 }
    },
    "trend": [
      { "date": "2026-02-26", "overall": 91.5, "premium": 96.8, "standard": 92.1, "economy": 87.3 },
      ...
    ]
  },
  "dateRange": { "from": "...", "to": "..." },
  "timestamp": "2026-03-11T12:00:00Z"
}
```

## Component Usage

### PlannedActualChart
```typescript
import { PlannedActualChart } from "@/app/(dashboard)/analytics/route-performance/components/planned-actual-chart";

<PlannedActualChart
  data={plannedVsActualData}
  dateRange={{ from: new Date("2026-02-09"), to: new Date("2026-03-11") }}
  isLoading={false}
  onDateRangeChange={(range) => console.log(range)}
/>
```

### DriverLeaderboard
```typescript
import { DriverLeaderboard } from "@/app/(dashboard)/analytics/route-performance/components/driver-leaderboard";

<DriverLeaderboard
  data={drivers}
  dateRange={dateRange}
  period="30d"
  onPeriodChange={(p) => setPeriod(p)}
  onDriverSelect={(id) => console.log(id)}
  isLoading={false}
/>
```

### EfficiencyHeatmap
```typescript
import { EfficiencyHeatmap } from "@/app/(dashboard)/analytics/route-performance/components/efficiency-heatmap";

<EfficiencyHeatmap
  data={heatmapData}
  dateRange={dateRange}
  isLoading={false}
  onCellClick={(cell) => console.log(cell)}
/>
```

### CO2Tracker
```typescript
import { CO2Tracker } from "@/app/(dashboard)/analytics/route-performance/components/co2-tracker";

<CO2Tracker
  data={co2Data}
  dateRange={dateRange}
  isLoading={false}
  onExport={() => console.log("export")}
/>
```

### SLACompliance
```typescript
import { SLACompliance } from "@/app/(dashboard)/analytics/route-performance/components/sla-compliance";

<SLACompliance
  data={slaData}
  dateRange={dateRange}
  isLoading={false}
/>
```

## Data Model Examples

### RouteData (input to analytics functions)
```typescript
interface RouteData {
  id: string;
  driverId: string;
  vehicleType: "motorcycle" | "van" | "truck-small" | "truck-large";
  plannedDistance: number;      // km
  plannedDuration: number;      // minutes
  actualDistance?: number;
  actualDuration?: number;
  stops: DeliveryStop[];
  slaTier?: "premium" | "standard" | "economy";
}

interface DeliveryStop {
  orderId: string;
  estimatedArrival: Date;
  actualArrival?: Date;
  estimatedDuration: number;    // minutes
  actualDuration?: number;
  status: "planned" | "attempted" | "delivered" | "failed" | "returned";
  customerRating?: number;      // 1-5
  firstAttempt?: boolean;
  slaTier?: "premium" | "standard" | "economy";
}
```

## Testing

Run tests with:
```bash
cd /sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform
pnpm test packages/core/src/analytics/__tests__/route-analytics.test.ts
```

Test categories:
- ✅ On-time percentage (100%, 0%, mixed, exclusions)
- ✅ Planned vs actual variance (positive, negative, thresholds)
- ✅ Driver scorecard (composition, trending)
- ✅ CO2 emissions (all vehicle types)
- ✅ SLA compliance (by tier, rates)
- ✅ Route efficiency (deviation, idle time)

## Metric Calculations Quick Reference

| Metric | Formula | Notes |
|--------|---------|-------|
| On-Time % | OnTime / Total × 100 | 5-min buffer, excludes failed/returned |
| Variance | Actual - Planned (mins) | Positive = delayed, Negative = efficient |
| Variance % | Variance / Planned × 100 | Threshold: >15% triggers review |
| Composite Score | 0.4×OnTime + 0.3×Efficiency + 0.2×Rating + 0.1×FirstAttempt | 0-100, driver KPI |
| CO2 Saved | Planned CO2 - Actual CO2 (kg) | Based on distance × emission factor |
| SLA Compliance | OnTime / Total × 100 (per tier) | Tier windows: Premium 2h, Standard 4h, Economy 8h |
| Efficiency Rating | Based on distance deviation + idle % | Excellent, Good, Fair, Poor |

## Common Issues & Solutions

### Issue: Missing imports
**Solution:** Use named imports from @witylogix/core/analytics
```typescript
import { calculateOnTimePercentage } from "@witylogix/core/analytics";
```

### Issue: Type errors in components
**Solution:** Import component types from route-analytics-types.ts
```typescript
import type { PlannedActualChartProps } from "@witylogix/core/analytics";
```

### Issue: Charts not rendering
**Solution:** Ensure Recharts is installed and data structure matches expected format
```bash
pnpm add recharts
```

### Issue: API endpoint 404
**Solution:** Verify route file is imported in API router setup (check apps/api/src/routes/index.ts)

## Performance Optimization

1. **Caching:** API endpoints support 1-hour Redis TTL (ready for production)
2. **Lazy Loading:** Components use React.memo patterns (can be added in Sprint 4.7)
3. **Pagination:** Driver leaderboard supports limit/offset
4. **Date Filtering:** All queries support dateFrom/dateTo parameters
5. **Aggregation:** Functions work with pre-aggregated data (mock in Sprint 4.6)

## Next Steps (Sprint 4.7)

- [ ] Connect to real database (replace mock data generators)
- [ ] Add advanced date picker component
- [ ] Implement multi-select filters (drivers, zones)
- [ ] Add CSV/PDF export functionality
- [ ] Create benchmarking dashboard (Route4Me/Routific comparison)
- [ ] Set up Redis caching layer
- [ ] Add real-time WebSocket updates
- [ ] Implement anomaly detection alerts

## Documentation References

- **ADR-025:** `/docs/adr/ADR-025-route-analytics.md`
- **Implementation:** `SPRINT_4.6_IMPLEMENTATION.md` (this repo root)
- **API Docs:** Inline Fastify route comments in `route-performance.ts`
- **Type Docs:** JSDoc comments in `route-analytics-types.ts`

## Questions?

Refer to:
1. ADR-025 for architecture decisions
2. Test cases for usage examples
3. Component props interfaces for API contract
4. Mock data generators for realistic examples
