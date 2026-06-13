# Dashboard Production Readiness Tracker

Source of truth for production-readiness sprints. Each row tracks one page cluster.
Legend: ✅ done · 🔄 in-progress · ⬜ not started

## Completed Sprints

| WIT | Section | Pages | Map Views | Endpoints Wired/Added | Mock Before→After | Notes |
|-----|---------|-------|-----------|-----------------------|-------------------|-------|
| WIT-340 | Analytics + Orders | analytics/, analytics/eta-accuracy, orders/board | ZoneAnalyticsMap (zone-heat-layer + WLMap) | /api/v4/analytics/*, /api/v4/orders | many → 0 | Introduced WLMap (keyless CARTO/Leaflet) |
| WIT-341 | Zones + Payments + Billing | zones/, payments/, billing/ | ZonePolygonLayer on zones page (polygon + circle fallback, auto-fit) | /api/v4/zones (existing), /api/v4/payments (normalized), /api/v4/billing/quotas (new), /api/v4/billing/plans (shape fix), /api/v4/billing/invoices (shape fix), /api/v4/billing/subscription (wired), /api/v4/payment-methods/payment-methods (wired) | ZONES const + MOCK_PAYMENTS + MONTHLY_REVENUE + mock plan/quota/invoice fallbacks → 0 | |
| WIT-342 | Drivers + Delivery | drivers/, drivers/[id], drivers/performance, delivery/ | DriverLocationLayer (status-coloured circle markers, popup, auto-fit, map/grid toggle), DeliveryMarkerLayer (delivery-point circles, status colors) | /api/v4/drivers/locations (new PostGIS + JSON fallback), /api/v4/driver-scoring/leaderboard (fixed URL), /api/v4/driver-scoring/:id (shape fixed), /api/v4/drivers/:id (profile wired), /api/v4/shipments (existing) | DEMO_SCORE_RESPONSE + DEMO_HISTORY → 0 | drivers/page: grid/map toggle; drivers/[id]: real scoring + history + profile; performance: leaderboard fixed; delivery: two-panel + DeliveryMarkerLayer |
| WIT-343 | Customers | customers/, customers/[id], customers/segments | CustomerDensityLayer (log-scaled bubbles by city, 60+ city lookup, auto-fit, popup, map/grid toggle on list page) | /api/v4/customers (shape fixed, shopifyCustomerId→externalCustomerId bug fixed), /api/v4/customers/stats (new), /api/v4/customers/density (new, groups orders by city), /api/v4/customers/:id (normalized + order history), /api/v4/customers/:id/orders (wired) | hardcoded StatCard changes (5.2%/12.8%/2.3%/15.1%), wrong field names (totalOrders vs ordersCount, status/tier not in schema) → 0 | customers/: grid+map toggle, real stats, loading skeletons, error/empty states; customers/[id]: profile + order history + addresses; customers/segments: tier cards + progress bars + top spenders + density map |
| WIT-344 | Returns + Finance/Invoices | returns/, invoices/[id], invoices/create | None (no geographic data) | /api/v4/returns (rewritten, real Prisma), /api/v4/returns/stats (real Prisma), /api/v4/returns/:id (wired), /api/v4/invoices/:id (wired via useApiQuery), /api/v4/customers (reused for customer picker) | MOCK_RETURNS (4 items) + MOCK_INVOICE + MOCK_CUSTOMERS (5) → 0 | ReturnRequest+ReturnRequestItem Prisma models added (schema + migration + RLS); returns page: status pipeline + filter tabs driven by real /stats; invoices/[id]: normalizeApiInvoice() + loading skeleton + error state; invoices/create: real customer picker with loading skeleton |
| WIT-345 | Campaigns | campaigns/, campaigns/[id] | CampaignReachLayer (orange log-scaled bubbles by city, map/grid toggle on list page, audience reach panel on detail page) | /api/v4/campaigns (rewritten with Prisma, fixed snake_case→camelCase bug), /api/v4/campaigns/stats (new, groupBy status + aggregate counts), /api/v4/campaigns/:id/geo (new, customer city distribution for reach map) | raw SQL snake_case field mismatch (recipient_count/delivered_count vs Prisma camelCase) → 0; wrong column names → fixed | campaigns/: map/grid toggle + filter by type+status + real stats + links to detail; campaigns/[id]: engagement funnel + reach map; PAUSED/FAILED/CANCELLED statuses added |
| WIT-346 | Field Service + Demand | field-service/, field-service/dispatch, demand/ | DispatchMap (WLMap + DriverLocationLayer for technicians, click-to-select), DemandHeatmapLayer (log-scaled circles coloured by demand intensity, predicted/actual toggle, auto-fit, empty state) | /api/v4/field-service/stats (new, real Prisma: activeJobs, completionRate, avgResponseMinutes, slaOnTimePercentage, overdueJobCount, completedDelta), /api/v4/field-service/schedule (new, today's orders+driver names), /api/v4/drivers/locations (reused), /api/v4/field-service/jobs (new) | completionRate:85 + techniciansInField:12 + avgResponseMinutes:8 + onTimePercentage:92 + overdueCount:2 (hardcoded stats) + Math.random() in 4 analytics endpoints (demand, demand-models, demand-anomalies, demand-scheduler) → 0 | Dispatch: emoji placeholder → live WLMap with DriverLocationLayer; field-service/page: real schedule timeline with tech filter + SLA panel; demand: centroid-from-boundary in API + DemandHeatmapLayer map section |

## Remaining ⬜

### High-Traffic + Geographic (priority order)

| Section | Pages | Geographic? | Notes |
|---------|-------|-------------|-------|
| ✅ Drivers | drivers/, drivers/[id], drivers/performance | ✅ Yes | WIT-342 — DriverLocationLayer + map toggle, DEMO data removed |
| ✅ Delivery | delivery/ | ✅ Yes | Two-panel: list + DeliveryMarkerLayer map; uses deliveryLocation from shipments API |
| ✅ Customers | customers/, customers/[id], customers/segments | ✅ Yes | WIT-343 — CustomerDensityLayer + map/grid toggle, shopifyCustomerId bug fixed, /stats + /density endpoints |
| ✅ Returns | returns/ | No | WIT-344 — MOCK_RETURNS removed, real API + loading/empty/error states, status pipeline |
| ⬜ Notifications | notifications/, notifications/templates | No | Real-time notification feed |
| ✅ Campaigns | campaigns/, campaigns/[id] | ✅ Yes | WIT-345 — CampaignReachLayer + map/grid toggle, Prisma rewrite, /stats + /geo endpoints |
| ✅ Finance / Invoices (partial) | invoices/[id], invoices/create | No | WIT-344 — MOCK_INVOICE + MOCK_CUSTOMERS removed; useApiQuery wired; customer picker uses real /api/v4/customers |
| ⬜ CRM | crm/ | No | Integration sync status |
| ⬜ Products | products/, products/[id] | No | Inventory management |
| ✅ Field Service | field-service/, field-service/dispatch | ✅ Yes | WIT-346 — DispatchMap (WLMap + DriverLocationLayer), /stats + /schedule + /jobs endpoints, hardcoded stats removed |
| ✅ Demand | demand/ | ✅ Yes | WIT-346 — DemandHeatmapLayer (centroid from boundary, predicted/actual toggle), Math.random() removed from 4 analytics endpoints |
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
- `apps/dashboard/src/components/map/customer-density-layer.tsx` — log-scaled bubble markers by city, tier colors, popup with customer/order count, auto-fit bounds
- `apps/dashboard/src/components/map/campaign-reach-layer.tsx` — orange log-scaled bubble markers by city, audience count popup, auto-fit bounds
- `apps/dashboard/src/components/map/job-location-layer.tsx` — rounded-square job markers, status fill + priority border colors, popup, onJobClick handler, auto-fit bounds
- `apps/dashboard/src/components/map/demand-zone-layer.tsx` — log-scaled circle markers coloured by demand intensity (green→red), popup with predicted/actual/confidence/trend, auto-fit bounds
- `apps/dashboard/src/components/map/demand-heatmap-layer.tsx` — log-scaled circle markers coloured by demand intensity (indigo→red), popup with predicted/actual/accuracy%/confidence/trend, auto-fit bounds (used by demand page)
- `apps/dashboard/src/components/analytics/components/zone-analytics-map.tsx` — analytics map

## Build / CI Status

| Check | Status |
|-------|--------|
| `pnpm --filter @witylogix/dashboard build` | ✅ |
| `pnpm --filter @witylogix/dashboard typecheck` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test:run` | ✅ (2 pre-existing failures: ai-copilot, finance-cod — Prisma generated client missing, unrelated) |
