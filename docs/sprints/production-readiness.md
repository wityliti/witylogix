# Dashboard Production Readiness

Source of truth for sprint progress. One section per PR, marked ✅ when merged green.

## Legend
- ✅ Done (merged, green CI)
- 🔄 In progress
- ⬜ Pending

| WIT | Section | Pages | Map Views | Endpoints Wired/Added | Mock Before→After | Notes |
|-----|---------|-------|-----------|-----------------------|-------------------|-------|
| WIT-340 | Analytics + Orders | analytics/, analytics/eta-accuracy, orders/board | ZoneAnalyticsMap (zone-heat-layer + WLMap) | /api/v4/analytics/*, /api/v4/orders | many → 0 | Introduced WLMap (keyless CARTO/Leaflet) |
| WIT-341 | Zones + Payments + Billing | zones/, payments/, billing/ | ZonePolygonLayer on zones page (polygon + circle fallback, auto-fit) | /api/v4/zones (existing), /api/v4/payments (normalized), /api/v4/billing/quotas (new), /api/v4/billing/plans (shape fix), /api/v4/billing/invoices (shape fix), /api/v4/billing/subscription (wired), /api/v4/payment-methods/payment-methods (wired) | ZONES const + MOCK_PAYMENTS + MONTHLY_REVENUE + mock plan/quota/invoice fallbacks → 0 | |
| WIT-342 | Drivers + Delivery | drivers/, drivers/[id], drivers/performance, delivery/ | DriverLocationLayer (status-coloured circle markers, popup, auto-fit, map/grid toggle), DeliveryMarkerLayer (delivery-point circles, status colors) | /api/v4/drivers/locations (new PostGIS + JSON fallback), /api/v4/driver-scoring/leaderboard (fixed URL), /api/v4/driver-scoring/:id (shape fixed), /api/v4/drivers/:id (profile wired), /api/v4/shipments (existing) | DEMO_SCORE_RESPONSE + DEMO_HISTORY → 0 | drivers/page: grid/map toggle; drivers/[id]: real scoring + history + profile; performance: leaderboard fixed; delivery: two-panel + DeliveryMarkerLayer |
| WIT-343 | Customers | customers/, customers/[id], customers/segments | CustomerDensityLayer (log-scaled bubbles by city, 60+ city lookup, auto-fit, popup, map/grid toggle on list page) | /api/v4/customers (shape fixed, shopifyCustomerId→externalCustomerId bug fixed), /api/v4/customers/stats (new), /api/v4/customers/density (new, groups orders by city), /api/v4/customers/:id (normalized + order history), /api/v4/customers/:id/orders (wired) | hardcoded StatCard changes (5.2%/12.8%/2.3%/15.1%), wrong field names (totalOrders vs ordersCount, status/tier not in schema) → 0 | customers/: grid+map toggle, real stats, loading skeletons, error/empty states; customers/[id]: profile + order history + addresses; customers/segments: tier cards + progress bars + top spenders + density map |
| WIT-344 | Returns + Finance/Invoices | returns/, invoices/[id], invoices/create | None (no geographic data) | /api/v4/returns (rewritten, real Prisma), /api/v4/returns/stats (real Prisma), /api/v4/returns/:id (wired), /api/v4/invoices/:id (wired via useApiQuery), /api/v4/customers (reused for customer picker) | MOCK_RETURNS (4 items) + MOCK_INVOICE + MOCK_CUSTOMERS (5) → 0 | ReturnRequest+ReturnRequestItem Prisma models added (schema + migration + RLS); returns page: status pipeline + filter tabs driven by real /stats; invoices/[id]: normalizeApiInvoice() + loading skeleton + error state; invoices/create: real customer picker with loading skeleton |
| WIT-345 | Campaigns | campaigns/, campaigns/[id] | CampaignReachLayer (orange log-scaled bubbles by city, map/grid toggle on list page, audience reach panel on detail page) | /api/v4/campaigns (rewritten with Prisma, fixed snake_case→camelCase bug), /api/v4/campaigns/stats (new, groupBy status + aggregate counts), /api/v4/campaigns/:id/geo (new, customer city distribution for reach map) | raw SQL snake_case field mismatch (recipient_count/delivered_count vs Prisma camelCase) → 0; wrong column names → fixed | campaigns/: map/grid toggle + filter by type+status + real stats + links to detail; campaigns/[id]: engagement funnel + reach map; PAUSED/FAILED/CANCELLED statuses added |
| WIT-346 | Field Service | field-service/, field-service/dispatch, field-service/jobs | DriverLocationLayer on dispatch page (live driver GPS, status-coloured markers, click-to-select, empty/loading/error states) | /api/v4/drivers (technician list + status counts), /api/v4/drivers/locations (GPS for map), /api/v4/orders (job queue + schedule + completions, normalizeOrder()) | const schedule=[] + const technicians=[] + const allTechs=[] + hardcoded slaMetrics (92%/85%/12/8/2/45) → 0; ?type=field-service&view=* params removed | field-service/page: real KPIs (activeJobs/completionRate/overdue/onTime) from live data; dispatch: split-pane WLMap + driver list + status filter + active/pending jobs; jobs: normalizeOrder() maps PENDING→created etc., priority from deliveryDate proximity |
| WIT-347 | Demand | demand/, demand/anomalies, demand/scheduler, demand/models, demand/capacity | ZoneHeatLayer on demand page (city-level order intensity bubbles, data/map toggle) | /api/v4/analytics/demand (existing), /api/v4/analytics/demand-anomalies (existing), /api/v4/analytics/demand-scheduler (existing), /api/v4/analytics/demand-models (existing), /api/v4/analytics/demand-capacity (existing), /api/v4/analytics/demand-heatmap (new, orders by city with coord lookup) | capacity page wrong URL (/analytics?type=capacity→/analytics/demand-capacity), models/anomalies useApiList→useApiQuery (API returns {items,total} not array), scheduler table hours 0-5→8-20, KPI display operator precedence fix | demand/: data/map toggle + ZoneHeatLayer (city demand bubbles, empty state); demand/capacity: URL fixed; demand/models: hook fixed; demand/anomalies: hook fixed; demand/scheduler: hours fixed |
| WIT-348 | Notifications | notifications/, notifications/log/, notifications/delivery-log/, notifications/preferences/ | None (no geographic data) | /api/v4/notifications (rewritten — inbox from NotificationLog, read/delete state in Shop.settings.notificationInbox), /api/v4/notifications/:id/read (new), /api/v4/notifications/:id/unread (new), /api/v4/notifications/mark-all-read (new), /api/v4/notifications/delete-bulk (new), /api/v4/notifications/delivery-log (new, real NotificationLog Prisma), /api/v4/notifications/delivery-log/export (stub returns URL), /api/v4/notifications/test (new), /api/v4/notification-preferences (rewritten — GET+PATCH from Shop.settings.notificationPreferences) | NOTIFICATION_LOGS (7 hardcoded items in log/page.tsx) + fake setTimeout in test notification → 0 | notifications/: error state + Mark All Read button wired; log/: full rewrite using useDeliveryLog hook (loading/empty/error/detail modal); delivery-log/: already used hook (endpoint now real); preferences/: loading skeleton (was "Coming soon…"), test notification wired to real endpoint, useSendTestNotification hook added; useNotifications: fixed :id URL-interpolation bug |
| WIT-349 | Products + Healthcare | products/sync, healthcare/records | None (no geographic data) | /api/v4/integrations (real e-commerce platform connections for sync config), /api/v4/healthcare/records (new, derives from orders with healthcare metadata) | MOCK_PLATFORMS (3 hardcoded e-commerce platforms with fake latency/productCount) + mockRecords (3 hardcoded clinical records as fallback) → 0 | products/sync: loads real connected ECOMMERCE integrations, loading skeleton, error state, empty state with link to /integrations; static PLATFORM_FIELDS map per slug; healthcare/records: removes mock fallback, adds empty state row |
| WIT-350 | AI | ai/driver-insights, ai/route-efficiency, ai/slots | None (no geographic data) | /api/v4/ai/analytics/leaderboard (existing, now registered), /api/v4/ai/analytics/route-efficiency/:id (existing, now registered), /api/v4/ai/slots/recommend (existing, now registered), /api/v4/routes (existing, used for completed route list), /api/v4/zones (existing, used for zone select) | DEMO_ENTRIES (8 drivers) + DEMO_ROUTES (5 routes) + DEMO_SCORE + DEMO_ZONES (5 zones) + DEMO_SLOTS (5 slots) → 0; server.ts missing registrations for ai/analytics + ai/slots routes fixed | driver-insights: leaderboard on real API with period switcher; route-efficiency: route list from /api/v4/routes, score panel null-guarded with empty state; slots: zone select from real /api/v4/zones, always calls recommend API, empty state when no slots |
| WIT-351 | Supply Chain + Admin Audit | supply-chain/orders, admin/audit | None (no geographic data) | /api/v4/supply-chain/waves (new, groups orders by day → wave summaries), /api/v4/supply-chain/batches (new, active orders as batch picking tasks), /api/v4/returns (existing, reused for returns queue tab) | WAVE_PLANS (3 items) + BATCH_PICKING (4 items) + RETURN_QUEUE (3 items) + DEMO_DATA (12 audit entries) + makeDemo() factory → 0 | supply-chain/orders: waves/batches/returns tabs all on real API with loading skeletons + empty states; admin/audit: DEMO_DATA removed, shows empty state when no audit entries returned |
| WIT-352 | Admin + Supply Chain dashboard + Freight | admin/activity, admin/users, admin/workflows, admin/queues, admin/integrations, freight/, supply-chain/ | None (no geographic data) | /api/v4/admin/queues (new, BullMQ stats for all 8 queues), /api/v4/admin/queues/jobs (new, recent active/waiting/failed jobs), /api/v4/admin/queues/scheduled (new, repeatable jobs), /api/v4/admin/queues/dlq (new, DLQ items from failed-delivery/wc-webhooks/notifications) | mockActivities (9 items, dead code) + mockUsers (8 items, dead code) + WORKFLOW_EXECUTIONS (12 items) + mockQueues/mockJobs/mockScheduledJobs/mockDLQ (4 constants) + mockIntegrations (5 items) + const totalSavings=15000 + KPI_METRICS (4 items) + INVENTORY_DISTRIBUTION (3 items) + demandSupplyData (3 hardcoded weeks) → 0 | admin/activity: dead mockActivities removed (real hook already present); admin/users: dead mockUsers removed (real hook already present); admin/workflows: WORKFLOW_EXECUTIONS → useApiQuery(/api/v4/workflow/executions), non-standard {executions,[]} shape; admin/queues: full rewrite → 4 new BullMQ admin endpoints, 4 useApiList hooks, loading/empty states; admin/integrations: mockIntegrations → useApiQuery(/api/v4/integrations) + mapIntegration(); freight: totalSavings → computed totalSpend from shipment rates; supply-chain/page: KPI_METRICS/INVENTORY_DISTRIBUTION → useMemo from real inventory.items, demandSupplyData → demand.items.map() |
| WIT-353 | CRM + Partners + POS (tracker audit) | crm/, partners/, pos/ | None | None new — all three sections already wired to real API hooks before this sprint | None — no MOCK_/DEMO_ constants found; CRM/Partners use useApiQuery(/api/v4/integrations), POS uses custom use-pos hooks | Tracker updated to reflect reality: ⬜ CRM/Partners/POS → ✅; all dashboard pages now production-ready |
| WIT-354 | Activity + Collaboration | activity/, activity/realtime/, collaboration/ | None (no geographic data) | /api/v4/activity-logs (existing, used for live polling), /api/v4/users (existing, used for user filter dropdown) | SAMPLE_USERS (4 hardcoded users in event-filters.tsx) + generateMockEvents() stub + fake random event injection via setInterval → 0; collaboration: token/"current-user"/"Current User" hardcoded auth placeholders → real useAuth() | activity/page: removed dead generateMockEvents, fixed hooks-after-early-returns bug, replaced 30s fake event injection with real refetch() polling; event-filters: SAMPLE_USERS → useApiList(/api/v4/users) with loading state; collaboration: all 3 hardcoded auth fields + autoConnect:false → real useAuth() session; currentUserId="current-user" × 2 → user?.id |

## ALREADY DONE (pre-sprint, on main)
- ✅ customer-portal — full app
- ✅ tracking-page — full app
- ✅ dashboard auth (login, register, forgot-password)
- ✅ dashboard home
- ✅ dashboard admin (system, users, shops, queues, activity, api-docs, integrations, workflows)
- ✅ dashboard ELD (trips, dvir, driver-scoring)
- ✅ dashboard integrations (connected, health, routing)
- ✅ dashboard settings (general, billing, payments, webhooks, auth-providers)
- ✅ dispatch (with placeholder map container)
- ✅ routes (list, detail, plan, create, edit, assign)
- ✅ shipments
- ✅ fleet (vehicles, fuel, maintenance)

---

Sections not yet in tracker (activity, collaboration done in WIT-354). Remaining uncovered sections (no mock data found in survey): collections/, events/, inventory/, esignatures/, support/ (FAQs are static documentation content, tickets on real API). No mock data blocking production.

| Section | Pages | Geographic? | Notes |
|---------|-------|-------------|-------|
| ✅ Drivers | drivers/, drivers/[id], drivers/performance | ✅ Yes | WIT-342 — DriverLocationLayer + map toggle, DEMO data removed |
| ✅ Delivery | delivery/ | ✅ Yes | Two-panel: list + DeliveryMarkerLayer map; uses deliveryLocation from shipments API |
| ✅ Customers | customers/, customers/[id], customers/segments | ✅ Yes | WIT-343 — CustomerDensityLayer + map/grid toggle, shopifyCustomerId bug fixed, /stats + /density endpoints |
| ✅ Returns | returns/ | No | WIT-344 — MOCK_RETURNS removed, real API + loading/empty/error states, status pipeline |
| ✅ Notifications | notifications/, notifications/log/, notifications/delivery-log/, notifications/preferences/ | No | WIT-348 — NOTIFICATION_LOGS mock removed, all 4 pages on real API, /api/v4/notifications fully rewritten |
| ✅ Campaigns | campaigns/, campaigns/[id] | ✅ Yes | WIT-345 — CampaignReachLayer + map/grid toggle, Prisma rewrite, /stats + /geo endpoints |
| ✅ Finance / Invoices (partial) | invoices/[id], invoices/create | No | WIT-344 — MOCK_INVOICE + MOCK_CUSTOMERS removed; useApiQuery wired; customer picker uses real /api/v4/customers |
| ✅ CRM | crm/ | No | WIT-353 audit — already wired to useApiQuery(/api/v4/integrations); CRM_SLUGS filter const (not mock data); syncEvents initialized as [] not hardcoded |
| ✅ Products | products/sync | No | WIT-349 — MOCK_PLATFORMS removed, real /api/v4/integrations?category=ECOMMERCE, loading/error/empty states |
| ✅ Field Service | field-service/, field-service/dispatch, field-service/jobs | ✅ Yes | WIT-346 — DriverLocationLayer dispatch map, real drivers/orders API, mock empty arrays removed |
| ✅ Demand | demand/, demand/anomalies, demand/scheduler, demand/models, demand/capacity | ✅ Yes | WIT-347 — ZoneHeatLayer demand map, demand-heatmap endpoint, capacity URL bug fixed, hook type bugs fixed, scheduler hours fixed |
| ✅ Partners | partners/, partners/[id], partners/compare, partners/onboard | No | WIT-353 audit — already wired: list/detail/compare use useApiQuery(/api/v4/integrations) + transform; onboard uses useApiMutation(POST /api/v4/couriers/partners); ROUTING_SLUGS/PARTNER_TABS are config constants, not mock data |
| ✅ Supply Chain | supply-chain/, supply-chain/orders | No | WIT-351 (orders: WAVE_PLANS/BATCH_PICKING/RETURN_QUEUE removed) + WIT-352 (page: KPI_METRICS/INVENTORY_DISTRIBUTION/demandSupplyData → real data from hooks) |
| ✅ Healthcare | healthcare/records | No | WIT-349 — mockRecords fallback removed, real /api/v4/healthcare/records endpoint, empty state |
| ✅ Freight | freight/ | No | WIT-352 — const totalSavings=15000 removed, computed totalSpend from shipment rates |
| ✅ POS | pos/, pos/transactions | No | WIT-353 audit — already wired: usePOSOverview/useTransactions/useTerminals/useTopSellingItems from use-pos hooks; useRefundTransaction/useExportTransactions for mutations; DEFAULT_OVERVIEW is an empty-values fallback struct, not hardcoded mock items |
| ✅ AI | ai/driver-insights, ai/route-efficiency, ai/slots | No | WIT-350 — DEMO_ arrays removed, missing route registrations fixed, zones from real API |
| ✅ Admin | admin/activity, admin/users, admin/workflows, admin/queues, admin/integrations, admin/audit | No | WIT-351 (audit: DEMO_DATA removed) + WIT-352 (all remaining mock constants removed, 4 new BullMQ queue endpoints) |
| ✅ Locations | locations/ | ✅ Yes | WIT-355 — LocationMarkerLayer (type+status coloured), grid/map toggle, detail panel mini-map replaces coordinate-text placeholder |
| ✅ Tracking | tracking/, tracking/live | ✅ Yes | WIT-355 — live map toggle with DriverLocationLayer (real GPS), driver sidebar with GPS indicator; list view preserved |

### WIT-400 · Orders cluster — `feat/WIT-400-dashboard-orders-map`
**Status:** 🔄 In progress  
**Branch:** `feat/WIT-400-dashboard-orders-map`

**Pages:**
- ✅ `/orders` — list with List/Map toggle; real API data via `useOrders`; map view via `OrderLayer` + Nominatim geocoding
- ✅ `/orders/board` — Kanban; removed 170-line dead `MOCK_ORDERS` block; real API with field normalization
- ⬜ `/orders/[id]` — detail page (uses real API, field names need review)
- ⬜ `/orders/create` — create form
- ⬜ `/orders/import` — import flow
- ⬜ `/orders/local` — local delivery list
- ⬜ `/orders/conflicts` — conflict resolution
- ⬜ `/orders/bulk` — bulk actions

**Infrastructure added:**
- `apps/dashboard/src/components/map/wl-map.tsx` — keyless CARTO map foundation using Leaflet
- `apps/dashboard/src/components/map/use-fit-bounds.ts` — auto-fit bounds hook
- `apps/dashboard/src/components/map/use-geocoder.ts` — Nominatim geocoder with in-memory cache
- `apps/dashboard/src/components/map/order-layer.tsx` — status-coloured order markers on map

**API fixes:**
- `apps/api/src/routes/orders.ts` — added `transformOrder()` to normalize Prisma fields → frontend contract:
  - `addressLine1/city/province/postalCode/country` → `deliveryAddress.{street,city,state,zipCode,country}` + top-level `city`/`country` for geocoding
  - `totalPrice` → `totalAmount`
  - `lineItems` → `items`

**Mock before/after:**
- Before: `MOCK_ORDERS` (170 lines, 15 fake orders) in `orders/board/page.tsx` — array declared but unused
- After: 0 mock references in orders section

---

### ⬜ WIT-401 · Drivers cluster
**Planned pages:** `/drivers`, `/drivers/[id]`, `/drivers/performance`
**Map:** driver location pins, status-coloured markers, real-time position

### ⬜ WIT-402 · Zones
**Planned pages:** `/zones`
**Map:** zone polygon editor (WLMap + zone polygons)

### ⬜ WIT-403 · Analytics
**Planned pages:** `/analytics`, route performance, heatmaps
**Map:** demand heatmap, route performance overlay

### ⬜ WIT-404 · Notifications + Campaigns
**Planned pages:** `/notifications`, `/campaigns`

### ⬜ WIT-405 · Billing + Payments
**Planned pages:** `/billing`, `/payments`, `/invoices`

### ⬜ WIT-406 · Returns + Products
**Planned pages:** `/returns`, `/products`, `/collections`

### ⬜ WIT-407 · Supply-chain + Inventory
**Planned pages:** `/supply-chain/orders`, `/supply-chain/inventory`, `/inventory`

### ⬜ WIT-408 · Activity + Admin cleanup
**Planned pages:** `/activity`, admin sub-pages that still have mock
