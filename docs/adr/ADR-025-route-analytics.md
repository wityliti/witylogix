# ADR-025: Route Analytics Architecture — Planned vs Actual Reporting

## Status
Accepted

## Date
2026-03-11

## Context
Witylogix requires comprehensive route analytics to benchmark against competing platforms (Route4Me, Routific). The primary driver is comparing **planned delivery estimates vs actual execution metrics** to identify optimization opportunities and service level compliance.

Current gaps:
- No unified metric definitions for on-time performance
- Delivery time variance not tracked systematically
- Driver scorecards lack standardized KPIs
- CO2 impact estimates missing
- SLA compliance not calculated per customer tier
- Route efficiency lacks visibility into planned vs actual distance/time

## Decision
Implement a **layered analytics architecture** with:

1. **Data Collection & Normalization** — Events from route execution captured in standardized format
2. **Metric Engines** — Calculation services for specific KPI families (On-Time %, Efficiency, CO2, SLA)
3. **Aggregation & Caching** — Time-series aggregation with Redis caching for dashboard performance
4. **Dashboard Components** — React components consuming pre-aggregated metrics via API

## Architecture

### 1. Data Collection Approach

**Event Schema (Analytics Events)**
- All route/delivery state changes create analytics events
- Events are immutable and include: type, timestamp, tenantId, metadata, correlationId
- Example events:
  - `DELIVERY_ATTEMPTED` — Driver at delivery location
  - `SHIPMENT_DELIVERED` — Proof of delivery captured
  - `DRIVER_LOCATION` — GPS update with coordinates

**Metadata Fields by Event Type**
```json
{
  "DELIVERY_ATTEMPTED": {
    "routeId": "uuid",
    "driverId": "uuid",
    "orderId": "uuid",
    "estimatedArrival": "2026-03-11T14:30:00Z",
    "actualArrival": "2026-03-11T14:25:00Z",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "SHIPMENT_DELIVERED": {
    "routeId": "uuid",
    "driverId": "uuid",
    "orderId": "uuid",
    "estimatedDelivery": "2026-03-11T14:35:00Z",
    "actualDelivery": "2026-03-11T14:28:00Z",
    "firstAttempt": true,
    "customerRating": 4.8
  },
  "DRIVER_LOCATION": {
    "driverId": "uuid",
    "routeId": "uuid",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 8.5,
    "speed": 32.5
  }
}
```

### 2. Metric Definitions

#### 2.1 On-Time Performance
**On-Time Percentage** = Deliveries within estimated window / Total deliveries × 100

- Window definition: [estimatedArrival - buffer, estimatedArrival + buffer]
- Default buffer: 5 minutes (configurable per tenant)
- Excludes failed, returned, and cancelled deliveries
- Calculated per day, week, month, driver, zone

#### 2.2 Planned vs Actual Duration
**Per Route:**
- `plannedDuration` — Sum of estimated time per stop + travel time (Route4Me/Routific estimates)
- `actualDuration` — Sum of actual time at stop + actual travel time
- `variance` — actualDuration - plannedDuration (minutes)
- `variancePercent` — variance / plannedDuration × 100

**Interpretation:**
- Positive variance: Route took longer than planned (inefficiency)
- Negative variance: Route faster than planned (efficiency)
- >15% variance threshold triggers operational review

#### 2.3 Driver Scorecard
**Per Driver (24-hour, 7-day, 30-day windows):**
- `deliveriesCompleted` — Total deliveries in period
- `onTimePercentage` — On-time % (see 2.1)
- `avgTimePerStop` — Total time / stop count (minutes)
- `customerRatingAvg` — Average delivery-time rating (1-5 scale)
- `firstAttemptRate` — Successful first attempts / total attempts × 100
- `score` — Composite: (onTime×0.4 + efficiency×0.3 + rating×0.2 + firstAttempt×0.1) × 100

#### 2.4 CO2 Estimates
**Per Route:**
- `estimatedCO2kg` = plannedDistance × emissionFactor[vehicleType]
- `actualCO2kg` = actualDistance × emissionFactor[vehicleType]
- `savedCO2kg` = estimatedCO2kg - actualCO2kg

**Emission Factors (kg/km):**
- Motorcycle: 0.089
- Van: 0.156
- Truck (small): 0.198
- Truck (large): 0.286

#### 2.5 Service Level Metrics
**Per Tenant (configurable SLA tiers):**
```
Tier 1 (Premium): Next-day, 2-hour window
Tier 2 (Standard): Next-day, 4-hour window
Tier 3 (Economy): Next-day, 8-hour window
```

- `slaCompliance` — On-time deliveries / total tier deliveries × 100
- `firstAttemptRate` — Successful first attempt / total attempts × 100
- `returnRate` — Returned deliveries / delivered × 100
- `failureRate` — Failed deliveries / assigned × 100

#### 2.6 Route Efficiency
**Per Route:**
- `plannedDistance` — Planned route distance (km)
- `actualDistance` — Actual route distance (km)
- `routeDeviation` — (actualDistance - plannedDistance) / plannedDistance × 100
- `idleTime` — Time stopped between stops (minutes)
- `idlePercentage` — idleTime / routeDuration × 100
- `deviationEvents` — Count of location deviations >100m from planned waypoint

### 3. Aggregation Strategy

**Time-Series Grouping:**
- Query atomic events from analytics event store
- Group by time bucket (hour, day, week, month)
- Aggregate dimensions: driver, zone, route, vehicle type, SLA tier
- Support multi-dimensional queries (e.g., driver × zone for a date range)

**Caching Layer:**
```
Cache Key: analytics:metric:{metricId}:{granularity}:{dateRange}:{filters}
TTL: 1 hour (real-time metrics)
     24 hours (daily snapshots)
     infinite (monthly rollups)
```

**Data Freshness:**
- Real-time dashboard: Query analytics events <5 min old
- Operational metrics: Refresh every 5 minutes
- Historical trends: Refresh daily

### 4. Dashboard Component Design

**Composition Pattern:**
Each dashboard component receives:
```typescript
interface AnalyticsComponentProps {
  dateRange: { from: Date; to: Date };
  filters?: {
    driverId?: string;
    routeId?: string;
    zoneId?: string;
    vehicleType?: string;
  };
  granularity?: "hourly" | "daily" | "weekly" | "monthly";
}
```

**Components:**

1. **PlannedActualChart** — Dual-line time-series with shaded variance area
2. **DriverLeaderboard** — Sortable table with composite score
3. **EfficiencyHeatmap** — Day × Hour grid showing delivery efficiency
4. **CO2Tracker** — Savings vs target with trend sparkline
5. **SLACompliance** — Donut chart by tier with breakdown table

**Data Flow:**
```
API Route (GET /analytics/route-performance)
  ↓
Analytics Service (calculate metrics from events)
  ↓
Redis Cache (1-hour TTL)
  ↓
React Component
  ↓
Chart Library (Recharts)
```

## Implementation Details

### File Structure
```
packages/core/src/analytics/
  route-analytics.ts          # Main analytics engine
  types.ts                    # Route-specific types
  index.ts                    # Exports

apps/dashboard/src/app/(dashboard)/analytics/route-performance/
  page.tsx                    # Full page
  components/
    planned-actual-chart.tsx
    driver-leaderboard.tsx
    efficiency-heatmap.tsx
    co2-tracker.tsx
    sla-compliance.tsx

apps/api/src/routes/analytics/
  route-performance.ts        # Fastify routes
```

### API Endpoints
```
GET /analytics/route-performance
  → Summary metrics (on-time %, avg time, CO2, SLA)

GET /analytics/route-performance/planned-vs-actual
  → Time series: { timestamp, plannedDuration, actualDuration, variance }

GET /analytics/route-performance/drivers
  → Driver scorecards with rankings

GET /analytics/route-performance/efficiency
  → Heatmap: { dayOfWeek, hour, efficiency% }

GET /analytics/route-performance/co2
  → Carbon tracking: { planned, actual, saved }
```

## Testing Strategy

1. **Unit Tests** — Metric calculations with known inputs
2. **Integration Tests** — End-to-end analytics pipeline
3. **Performance Tests** — Cache hit rates, query latency
4. **Data Validation** — Event schema compliance

## Monitoring & Observability

- Track metric calculation latency (target: <500ms)
- Monitor cache hit rate (target: >80%)
- Alert on data quality issues (missing events, outliers)
- Dashboard generation time SLA: <2s

## Rollout Plan

**Phase 1 (Sprint 4.6):**
- ADR-025 + core analytics service
- Planned vs Actual chart
- Driver leaderboard

**Phase 2 (Sprint 4.7):**
- Efficiency heatmap
- CO2 tracker
- SLA compliance breakdown

**Phase 3 (Sprint 4.8):**
- Advanced filtering (date picker, multi-driver, multi-zone)
- Export to CSV/PDF
- Benchmarking reports vs Route4Me/Routific

## Rationale

**Why layered approach?**
- Decouples data collection from presentation
- Allows reuse of metrics across multiple dashboards
- Enables independent scaling of API + frontend

**Why event-driven?**
- Immutable audit trail of all analytics events
- Easier to add new metrics without changing data model
- Supports real-time analytics via event streaming

**Why Redis cache?**
- Aggregations are expensive; caching reduces query load
- 1-hour TTL balances freshness with performance
- Easy to invalidate on new events

## Open Questions

1. Should CO2 estimates use actual vs. route-planned distance?
   - **Decision:** Both tracked separately for benchmarking
2. How to handle multi-stop routes with mixed SLA tiers?
   - **Decision:** Calculate per stop, then aggregate at route level
3. What about driver behavior outliers (e.g., stopped for 2 hours)?
   - **Decision:** Flag as anomaly; manual review required for removal

## Alternatives Considered

1. **Simple aggregation (no caching)** — Too slow for real-time dashboard
2. **Data warehouse (Snowflake/BigQuery)** — Overkill for current scale, adds latency
3. **Event sourcing** — Over-engineered; simple event table sufficient for now

## References

- Route4Me benchmarks: route optimization, on-time %, driver scoring
- Routific case studies: SLA compliance, CO2 tracking
- Witylogix: existing analytics.ts, event-tracker.ts
