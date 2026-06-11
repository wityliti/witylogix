# Dashboard Production Readiness Tracker

Source of truth for production-readiness sprints. Each row tracks one page cluster.
Legend: ✅ done · 🔄 in-progress · ⬜ not started

## Completed Sprints

| WIT | Section | Pages | Map Views | Endpoints Wired/Added | Mock Before→After | Notes |
|-----|---------|-------|-----------|-----------------------|-------------------|-------|
| WIT-340 | Analytics + Orders | analytics/, analytics/eta-accuracy, orders/board | ZoneAnalyticsMap (zone-heat-layer + WLMap) | /api/v4/analytics/*, /api/v4/orders | many → 0 | Introduced WLMap (keyless CARTO/Leaflet) |
| WIT-341 | Zones + Payments + Billing | zones/, payments/, billing/ | ZonePolygonLayer on zones page (polygon + circle fallback, auto-fit) | /api/v4/zones (existing), /api/v4/payments (normalized), /api/v4/billing/quotas (new), /api/v4/billing/plans (shape fix), /api/v4/billing/invoices (shape fix), /api/v4/billing/subscription (wired), /api/v4/payment-methods/payment-methods (wired) | ZONES const + MOCK_PAYMENTS + MONTHLY_REVENUE + mock plan/quota/invoice fallbacks → 0 | |
| WIT-342 | Drivers + Delivery | drivers/, drivers/[id], drivers/performance, delivery/ | DriverLocationLayer (status-coloured circle markers, popup, auto-fit, map/grid toggle), DeliveryMarkerLayer (delivery-point circles, status colors) | /api/v4/drivers/locations (new PostGIS + JSON fallback), /api/v4/driver-scoring/leaderboard (fixed URL), /api/v4/driver-scoring/:id (shape fixed), /api/v4/drivers/:id (profile wired), /api/v4/shipments (existing) | DEMO_SCORE_RESPONSE + DEMO_HISTORY → 0 | drivers/page: grid/map toggle; drivers/[id]: real scoring + history + profile; performance: leaderboard fixed; delivery: two-panel + DeliveryMarkerLayer |

## Remaining ⬜

### High-Traffic + Geographic (priority order)

| Section | Pages | Geographic? | Notes |
|---------|-------|-------------|-------|
| ✅ Drivers | drivers/, drivers/[id], drivers/performance | ✅ Yes | WIT-342 — DriverLocationLayer + map toggle, DEMO data removed |
| ✅ Delivery | delivery/ | ✅ Yes | Two-panel: list + DeliveryMarkerLayer map; uses deliveryLocation from shipments API |
| ⬜ Customers | customers/, customers/[id], customers/segments | ✅ Yes | Customer density map |
| ⬜ Returns | returns/, returns/[id] | No | Return status workflows |
| ⬜ Notifications | notifications/, notifications/templates | No | Real-time notification feed |
| ⬜ Campaigns | campaigns/, campaigns/[id] | ✅ Yes (geo targeting) | Campaign reach map |
| ⬜ Finance / Invoices | finance/, invoices/, invoices/[id] | No | Revenue charts |
| ⬜ CRM | crm/ | No | Integration sync status |
| ⬜ Products | products/, products/[id] | No | Inventory management |
| ⬜ Field Service | field-service/, field-service/dispatch | ✅ Yes | Dispatch map |
| ⬜ Demand | demand/, demand/heatmap | ✅ Yes | Demand heatmap |
| ⬜ Partners | partners/ | No | |
| ⬜ Supply Chain | supply-chain/ | No | |
| ⬜ Healthcare | healthcare/ | No | |
| ⬜ Freight | freight/ | No | |
| ⬜ POS | pos/ | No | |
| ⬜ AI | ai/ | No | |
| ⬜ Admin (activity, users, queues, workflows) | admin/* | No | All mock — lower priority |

## Map Foundation

- `apps/dashboard/src/components/map/wl-map.tsx` — keyless Leaflet + CARTO dark basemap, no API key
- `apps/dashboard/src/components/map/zone-heat-layer.tsx` — circle heatmap for zone analytics
- `apps/dashboard/src/components/map/zone-polygon-layer.tsx` — polygon/circle rendering for zone management
- `apps/dashboard/src/components/map/driver-location-layer.tsx` — status-coloured driver markers, popup with last-seen/heading, auto-fit bounds
- `apps/dashboard/src/components/map/delivery-marker-layer.tsx` — delivery point dot markers with status colors
- `apps/dashboard/src/components/analytics/components/zone-analytics-map.tsx` — analytics map

## Build / CI Status

| Check | Status |
|-------|--------|
| `pnpm --filter @witylogix/dashboard build` | ✅ |
| `pnpm --filter @witylogix/dashboard typecheck` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test:run` | ✅ (2 pre-existing failures: ai-copilot, finance-cod — Prisma generated client missing, unrelated) |
