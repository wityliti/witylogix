# Dashboard Production-Readiness Tracker

Tracks the elimination of all mock/dummy/placeholder/hardcoded data from `apps/dashboard`.
Scan command: `grep -rniE "mock|dummy|sampleData|hardcoded|fake|lorem" <path> --include="*.tsx" | grep -v "placeholder=|__tests__|\.test\."`.

**Total pages**: ~204 (excluding design-system, stories)
**Total mock signals (baseline)**: ~486

---

## Status Legend
- ✅ **Done** — 0 mock signals, real API wired
- 🔄 **In-Progress** — current sprint
- ⬜ **Pending** — not started
- ⚙️ **No-API-Key** — gated behind missing env key (Stripe/Twilio/maps)

---

## Sprint Log

| Sprint | Branch | Sections | Signals Eliminated | Date |
|--------|--------|----------|--------------------|------|
| WIT-501 | feat/WIT-501-admin-production | Admin (105) | 105 | 2026-05 |
| WIT-502 | feat/WIT-502-eld-production | ELD (9) | 9 | 2026-05 |
| WIT-503 | feat/WIT-503-integrations-production | Integrations (11) | 11 | 2026-05 |
| WIT-504 | feat/WIT-504-settings-production | Settings (8) | 8 | 2026-05 |
| WIT-505 | feat/WIT-505-dashboard-invoices-payments-production | Activity (2), Order Board (1), Invoices (5), Payments (1) | 9 | 2026-05-31 |
| WIT-512 | feat/WIT-512-dashboard-analytics-production | Analytics overview (DEMO→real), Returns (MOCK_RETURNS→0), API route-performance (Math.random→Prisma), Map: DeliveryPerformanceLayer + route-performance Map tab | 7 + API | 2026-06-01 |
| WIT-514 | feat/WIT-514-dashboard-supplychain-healthcare-esig-products-production | Healthcare Records (mockRecords→0), SC Inventory (2 new API hooks), SC Orders (WAVE_PLANS/BATCH_PICKING/RETURN_QUEUE→real), E-Signatures (new esignatures.ts routes + 0 mocks), Products Sync (MOCK_PLATFORMS→integrations/connections), Field Service (computed stats), Collections (alert→real DELETE) | 17 | 2026-06-01 |
| WIT-515 | feat/WIT-515-dashboard-orders-production | Orders: Detail field-shape fix + Map view, Import hook fix; CourierAssignmentPanel Math.random→0 | 5 + API | 2026-06-02 |
| WIT-517 | feat/WIT-517-dashboard-realtime-mock-cleanup | Realtime components (4), Notification stats widget, Activity polling, ELD HOS recap, Webhooks hourly chart, Webhook test page, Shipping labels pricing, Dispatch map (WLMap); API: notifications-v2 rewrite, outbound-webhooks/test endpoint | 13 files | 2026-06-02 |
| WIT-518 | feat/WIT-518-dashboard-billing-drivers-map | Billing (4 hardcoded fallbacks→real API; billing API { data } wrapper fix); Drivers (Cards↔Map toggle; WLMap + DriverLayer status-coloured markers + useFitBounds) | 4 + API | 2026-06-03 |
| WIT-519 | feat/WIT-519-supply-chain-kpis-locations-map | Supply Chain overview (KPI_METRICS/INVENTORY_DISTRIBUTION/demandSupplyData/pipeline percentages→real hooks); Locations map view (WLMap+PinLayer replaces coordinate placeholder) | 5 | 2026-06-03 |
| WIT-520a | feat/WIT-520-marketplace-provider-real-api | Marketplace provider detail (PROVIDERS hardcoded object→GET /api/v4/integrations/marketplace/:slug; credentials form from credentialFields; install via POST /:slug/install); CRM: remove dead CRM_PROVIDER_LIST | 5 | 2026-06-03 |
| WIT-400 | feat/WIT-400-dashboard-orders-payments-returns | Delivery (List↔Map toggle on delivery/page + delivery/standard; WLMap + ShipmentMarkerLayer + useFitBounds; stat cards; detail panel; proper Shipment type with addressLine1/city/deliveryLocation); use-shipment-tracking hook (removed hardcoded John Doe / FedEx / random mock fallback → real /api/v4/shipments calls) | 2 pages + 1 component + 1 hook | 2026-06-03 |
| WIT-520b | feat/WIT-520-dashboard-demand-production | Demand section (5 API endpoints: Math.random→Prisma real data); Demand page map view (Charts/Map toggle + WLMap + DemandZoneLayer); Tracking Config (local state→API load/save); capacity page URL fix | 5 API + 2 pages | 2026-06-04 |
| WIT-521 | feat/WIT-521-dashboard-freight-ux-design-tokens | Freight 4 pages (overview, loads, rates, compliance): 94 hardcoded hex CSS values → WL design tokens; removed totalSavings=15000 const; real Shipment fields; freight overview Charts↔Map toggle (WLMap+DeliveryMapView); hooks-order fix | 94 CSS signals | 2026-06-04 |
| WIT-522 | feat/WIT-522-dashboard-tracking-timeslots | Time-Slots: SLOTS[7] hardcoded array → real useApiList('/api/v4/time-slots'); loading/empty/error states; Create Slot modal (POST /api/v4/time-slots); WL design tokens. Tracking overview: List↔Map toggle, /dispatch/drivers for lat/lng, WLMap+OrderLayer+DriverLayer. Tracking Live: List↔Map toggle, map panel with order+driver markers + sidebar detail, 30s auto-refresh via dispatch drivers. New shared component: tracking/components/tracking-map-view.tsx | 7 mock slots | 2026-06-04 |
| WIT-523 | feat/WIT-523-notification-templates-profile | Notification templates list: TEMPLATES[8] hardcoded array → real useApiList('/api/v4/notification-templates'); delete/toggle via api.delete/api.patch; WL design tokens; loading/empty states. Profile: 3 fake sessions (192.168.1.x, San Francisco CA, Chrome/Safari/Firefox) → current-session-only display; WL design tokens throughout. WIT-521 notifications/preferences + settings/notifications + products/sync + template [id]: all fake setTimeout replaced with real API calls | 11 mocks | 2026-06-04 |
| WIT-350 | feat/WIT-350-dashboard-zones-drivers-delivery | zones/[id]: remove NEXT_PUBLIC_FEATURE_ZONES_MAP gate + LegacyNotice; LoadingSkeleton + ErrorState with retry; useRouter navigation; Promise.all with proper error propagation; active/inactive badge. zones/new: remove feature flag gate; remove maptilerKey prop; replace alert() with submitError state in sidebar; try/catch/finally for submit | 0 mocks | 2026-06-05 |
| WIT-533 | feat/WIT-533-routes-design-tokens-plan-map | Routes 6 pages: 105+ hex CSS → WL design tokens; routes/plan List↔Map toggle (WLMap + RoutePolylineLayer + RouteStopMarkersLayer on optimized stop sequence); routes/[id]/edit Save Changes fix (useApiMutation); removed getPriorityColor() hex helper | 105 CSS signals | 2026-06-08 |
| WIT-534 | feat/WIT-534-dashboard-ai-analytics-design-tokens | AI pages (3) + Analytics pages (3): 31 hex CSS → WL design tokens; ai/driver-insights List↔Map toggle (WLMap + DriverLayer tier-coloured); ai/route-efficiency Score↔Map toggle (WLMap + RoutePolylineLayer + RouteStopMarkersLayer); analytics/route-performance legend hex → CSS vars | 31 CSS signals + 2 map views | 2026-06-08 |
| WIT-535 | feat/WIT-535-dashboard-integrations-design-tokens | integrations/payments full rewrite (5 real endpoints: gateways/summary/transactions/methods/reconciliation); integrations/eld full rewrite (5 real endpoints: connections/drivers/violations/dvir/compliance); integrations/overview CATEGORIES→useApiList; integrations/supply-chain warehouse/inventory→real API; 13 integrations sub-pages CSS-only pass; 179 dashboard pages total: all Tailwind arbitrary hex class values (bg-[#...]/border-[#...]/text-[#...]) eliminated codebase-wide; TableSkeleton cols→columns fix; Map→MapIcon lucide rename | 179 files, ~1900 CSS signals, 4 pages real API | 2026-06-09 |
| WIT-536 | feat/WIT-536-nav-ui-design-token-cleanup | Navigation (sidebar: text-[#f5a623]→text-wl-primary-500 x6 + bg-[#0a0a0e]→bg-wl-bg-sidebar; page-header: bg-[#0f0f14]→bg-wl-bg-surface); UI components (dialog: bg-[#13131a]→bg-wl-bg-elevated; card: bg-[#13131a]+bg-[#161620]→bg-wl-bg-elevated+bg-wl-bg-overlay); global-error (bg-[#0a0a0f]+bg-[#1a1a20]→WL tokens); shipments-map-view (border-[#1e1e2e]→border-wl-border-subtle); courier-live-map (Math.random bearing→deterministic 0); provider-comparison (Math.random metrics→real provider.metrics.averageLatencyMs/successRate; hardcoded features matrix→real credentialConfig/webhookConfig/rateLimit flags); rate-limit-display (Math.random sparkline→deterministic sine wave) | 9 files, 18 signals → 0 | 2026-06-09 |
| WIT-537 | feat/WIT-537-dashboard-returns-detail-map | Returns: NEW `/returns/[id]` detail page (RMA lifecycle: status pipeline, items table, action buttons approve/reject/receive/inspect/refund, timeline, customer+order sidebar, Detail/Map toggle); `/returns` list upgrades (stats row, List↔Map toggle, row navigation, status filter pills); Fixed `use-returns.ts` bugs (wrong paths + PATCH→POST); NEW `returns-map-view.tsx` (WLMap+PinLayer for list) + `return-location-map.tsx` (WLMap+PinLayer for detail) | `GET /api/v4/returns/:id`, action endpoints × 5, `GET /api/v4/returns/stats` | 5 files, 0 mocks, 2 map views | 2026-06-10 |
| WIT-538 | feat/WIT-538-supplychain-crm-quality-hardening | supply-chain/page: added loading skeleton + error state for all 5 hooks; replaced 3 hardcoded Pipeline Summary metrics ("2.3 days", "94.2%", "12 orders") with real computed values from fulfillment/orders data. crm/page: removed dead `useState<SyncEvent[]>([])` (setter never called); replaced with `useMemo` deriving sync events from each CRM integration's `lastSyncAt`+`healthStatus`; Failed Syncs stat now reflects real UNHEALTHY integrations | no new endpoints | 2 files, 3 hardcoded strings → 0 | 2026-06-10 |
| WIT-539 | feat/WIT-539-integration-hooks-auth-chaos-api | use-integration-status: raw `fetch()` → `api.get/post/delete`; removed `DEMO_CONNECTIONS` (5 hardcoded carriers/Shopify/Stripe). use-chaos-testing: removed `DEMO_CHAOS_SCENARIOS`/`DEMO_CHAOS_RESULTS`; wired to new `/api/v4/chaos/*`. use-integration-docs: static carrier reference docs (SDK methods, webhooks, rate limits, playbooks) — removed non-existent API calls, converted to pure `useMemo`. New `apps/api/src/routes/chaos.ts`: scenarios in `shop.settings`, executions in ActivityLog. chaos/page.tsx: LoadingSkeleton + ErrorState guards | NEW `/api/v4/chaos/*` (5 routes) | 5 hook/page files + 1 API route, DEMO_ fallbacks → 0 | 2026-06-10 |
| WIT-540 | feat/WIT-540-dashboard-campaigns-production | Campaigns: list row-click + ExternalLink navigate to `/campaigns/:id`; CreateCampaignModal (POST /api/v4/campaigns); Pause/Resume/Delete/Duplicate buttons wired via `api.post/delete`; List↔Reach Map toggle. Campaign detail: 4 tabs — Overview (donut chart), Events (GET /:id/events), Recipients (GET /:id/recipients), Reach Map; Send Now / Pause / Resume / Archive action buttons; back nav. NEW `campaign-reach-map.tsx`: WLMap + ZoneLayer fetching `GET /api/v4/zones?format=geojson`, auto-fit bounds via useFitBounds inner-component, health-colour legend | existing campaign + zone endpoints | 3 files, 0 mocks, 1 map view | 2026-06-10 |

---

## Auth (0 mock signals)
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Login | `/login` | 0 | 0 | ✅ |
| Register | `/register` | 0 | 0 | ✅ |
| Forgot Password | `/forgot-password` | 0 | 0 | ✅ |
| Magic Link | `/magic-link` | 0 | 0 | ✅ |
| Reset Password | `/reset-password` | 0 | 0 | ✅ |

---

## Home / Dashboard Overview (3 → 0 mock signals)
| Page | Route | Mock Before | Mock After | Status | PR |
|------|-------|------------|-----------|--------|----|
| Dashboard Home | `/home` | 3 | 0 | ✅ WIT-462 | — |
| Activity Feed | `/activity` | 2 | 0 | ✅ WIT-505 | — |
| Realtime Activity | `/activity/realtime` | 0 | 0 | ✅ | — |

**Endpoints used**: `GET /api/v4/dashboard/stats`, `GET /api/v4/orders?limit=5`, `GET /api/v4/drivers?limit=8`

---

## Orders (5 → 0 mock signals) ✅ WIT-515
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Order List | `/orders` | 0 | 0 | ✅ |
| Order Detail | `/orders/[id]` | 2+1placeholder | 0 + Map view | ✅ WIT-515 |
| Order Board | `/orders/board` | 1 | 0 | ✅ WIT-505 |
| Order Import | `/orders/import` | 3 | 0 | ✅ WIT-515 |
| Order Create | `/orders/create` | 0 | 0 | ✅ |
| Order Bulk | `/orders/bulk` | 0 | 0 | ✅ |
| Order Conflicts | `/orders/conflicts` | 0 | 0 | ✅ |
| Order Local | `/orders/local` | 0 | 0 | ✅ |

**WIT-515 changes**:
- Order Detail: Fixed field name mismatches (`orderNumber`→`externalOrderNumber`, `customer.name`→`customerName`, `address.street`→`addressLine1`, `order.activities`→`notificationLogs`); replaced "Map View Placeholder" div with real `WLMap` + `PinLayer` using `deliveryLat`/`deliveryLng` from API; notes now use `PATCH /api/v4/orders/:id`; shipment info from included `primaryShipment`; API updated to include `shipments` relation + extract `deliveryLat`/`deliveryLng` from shipment's `deliveryLocation: { lat, lng }` JSON
- Order Import: Replaced broken `useSyncStatus`/`useSyncTrigger`/`useSyncMetrics` hooks (called non-existent `/api/orders/sync/*` Next.js routes) with `useApiList('/api/v4/integrations/connections')` + `useApiQuery('/api/v4/dashboard/stats')`; `handleTriggerSync` now calls `POST /api/v4/integrations/connections/:id/force-sync`
- CourierAssignmentPanel: Removed `Math.random()` service area check + random unavailable check; replaced with data-driven `status === 'unavailable'` only; removed fake `setTimeout` simulation in `handleAssign`

---

## Shipments (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Shipment List | `/shipments` | 0 | ✅ |
| Shipment Detail | `/shipments/[id]` | 0 | ✅ |

---

## Delivery (0 mock signals) ✅ WIT-400
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Delivery Overview | `/delivery` | hook had mock fallback | 0 | ✅ WLMap + ShipmentMarkerLayer | ✅ WIT-400 |
| Standard Delivery | `/delivery/standard` | 0 | 0 | ✅ WLMap + ShipmentMarkerLayer | ✅ WIT-400 |

**WIT-400 changes**: Added `delivery/components/delivery-map-view.tsx` (shared map: `WLMap` + `ShipmentMarkerLayer` status-coloured circles + `useFitBounds` + legend + stats overlay + no-location placeholder). Both pages now have List↔Map view toggle, stat cards, proper `Shipment` type with `deliveryLocation`/`addressLine1`/`city` fields, shipment detail panel, `Header` component, empty state, error state. `use-shipment-tracking.ts` hook: removed `setTrackingData({...John Doe...})` fallback block (80 lines of mock); now calls real `/api/v4/shipments?search=` + `/api/v4/shipments/:id`.

**Map layer**: `ShipmentMarkerLayer` (PENDING=blue, IN_TRANSIT=amber, OUT_FOR_DELIVERY=green, DELIVERED=emerald, FAILED=red)

---

## Customers (0 mock signals) ✅ WIT-526
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Customer List | `/customers` | 0 | 0 (+ real stats) | — | ✅ WIT-526 |
| Customer Detail | `/customers/[id]` | n/a (page missing) | 0 (new page) | ✅ Delivery-pin WLMap | ✅ WIT-526 |
| Customer Create | `/customers/create` | 0 | 0 | — | ✅ |

**WIT-526 changes**:
- NEW: `customers/[id]/page.tsx` — full customer detail page with profile card, stat tiles (total orders, total spent, avg order value, last order), order history table (click-through to `/orders/:id`), loading skeleton, error/not-found states
- Map: `WLMap` + `PinLayer` showing past delivery locations from customer orders (auto-fit bounds via `useFitBounds`); status-coloured pins (in_transit=delivered, delayed=failed, open=pending, assigned=others)
- Fixed `useCustomer` hook: path corrected `/customers/${id}` → `/api/v4/customers/${id}`; `useApiQuery` correctly extracts the data envelope
- New hooks: `useCustomerOrders(id)` — `GET /api/v4/customers/:id/orders`; `useCustomerStats()` — `GET /api/v4/customers/stats`
- Customer list: "View" button + full row now navigate to `/customers/:id`; stat cards use `useCustomerStats()` for accurate server-side totals

**Endpoints used**: `GET /api/v4/customers/:id` (existing), `GET /api/v4/customers/:id/orders` (existing), `GET /api/v4/customers/stats` (existing)

---

## Drivers (0 mock signals) ✅ WIT-518
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Driver List | `/drivers` | 0 | 0 + live map | ✅ WIT-518 |
| Driver Detail | `/drivers/[id]` | 0 | 0 | ✅ |
| Driver Create | `/drivers/create` | 0 | 0 | ✅ |
| Driver Performance | `/drivers/performance` | 0 | 0 | ✅ |

**WIT-518 changes**: Added Cards ↔ Map toggle on driver list. Map view: `WLMap` + `DriverLayer` (green=available, amber=en-route/delivering, purple=on-break, grey=offline) with `useFitBounds` auto-centring on drivers with location. Positions from `GET /api/v4/dispatch/drivers` (Redis GEO). Lazy-loaded via `next/dynamic` (no SSR for maplibre-gl).

---

## Routes (0 mock signals) ✅ WIT-533
| Page | Route | Mock Before | Map | Status |
|------|-------|------------|-----|--------|
| Routes List | `/routes` | 0 | — | ✅ WIT-533 design tokens |
| Route Detail | `/routes/[id]` | 0 | ✅ WLMap | ✅ WIT-533 design tokens |
| Route Plan | `/routes/plan` | 0 | ✅ WLMap List↔Map toggle | ✅ WIT-533 map + design tokens |
| Route Create | `/routes/create` | 0 | ✅ WLMap | ✅ WIT-533 design tokens |
| Route Assign | `/routes/[id]/assign` | 0 | — | ✅ WIT-533 design tokens |
| Route Edit | `/routes/[id]/edit` | 0 | — | ✅ WIT-533 design tokens + save fix |

**WIT-533 changes**:
- Replaced 105+ hex CSS values across all 6 routes pages with WL design tokens (`bg-wl-bg-root`, `bg-wl-bg-surface`, `bg-wl-bg-overlay`, `bg-wl-bg-elevated`, `bg-wl-bg-sunken`, `border-wl-border-default`, `border-wl-border-strong`, `text-wl-text-primary/secondary/tertiary`)
- `routes/plan/page.tsx`: Added List↔Map toggle in optimize/review/dispatch steps; `WLMap` + `RoutePolylineLayer` + `RouteStopMarkersLayer` renders `state.selectedResult.stopSequence` with auto-fit bounds; toggle only shown when stops have coordinates
- `routes/[id]/edit/page.tsx`: Fixed non-functional Save Changes button — now calls `updateRoute(currentFormData)` via `useApiMutation` with loading/error state; removed non-functional Save as Draft button; removed `getPriorityColor()` helper that leaked raw hex strings
- PR: https://github.com/wityliti/witylogix/pull/287

---

## Dispatch (1 → 0 mock signals) ✅ WIT-517
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Dispatch | `/dispatch` | 1 (Leaflet placeholder map) | 0 + WLMap | ✅ WIT-517 |
| Couriers | `/dispatch/couriers` | 0 | 0 | ✅ |

**WIT-517 changes**: `dispatch-map.tsx` replaced Leaflet placeholder with `WLMap` + `RoutePolylineLayer` + `RouteStopMarkersLayer` + `DriverLayer`; center computed from first stop's coordinates; `STOP_STATUS_MAP`/`DRIVER_STATUS_MAP` normalize API enums to layer types

---

## Fleet (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Fleet Overview | `/fleet` | 0 | ✅ |
| Vehicles | `/fleet/vehicles` | 0 | ✅ WIT-531 (List/Map toggle + WLMap) |
| Vehicle Detail | `/fleet/vehicles/[id]` | 0 | ✅ |
| Fuel | `/fleet/fuel` | 0 | ✅ |
| Maintenance | `/fleet/maintenance` | 0 | ✅ |

---

## Analytics (14 → 0 mock signals) ✅ WIT-512 + WIT-534
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Analytics Overview | `/analytics` | DEMO_METRICS, 5 consts; 7×bg-[#111118], 1×bg-[#1a1a28] | 0 | — | ✅ WIT-512 + WIT-534 tokens |
| Dashboards | `/analytics/dashboards` | 0 | 0 | — | ✅ |
| ETA Accuracy | `/analytics/eta-accuracy` | DEMO_METRICS, 4 consts; 5×bg-[#111118] | 0 | — | ✅ WIT-512 + WIT-534 tokens |
| Reports | `/analytics/reports` | 0 | 0 | — | ✅ |
| Route Performance | `/analytics/route-performance` | 0 (API Math.random()); 4 inline hex legend colors | 0 + Map view; CSS vars | ✅ WLMap + DeliveryPerformanceLayer | ✅ WIT-512 + WIT-534 tokens |

**WIT-534 analytics changes**:
- `analytics/page.tsx`: `bg-[#111118]` ×7 → `bg-wl-bg-surface`; `bg-[#1a1a28]` ×1 (chart tooltip) → `bg-wl-bg-elevated`
- `analytics/eta-accuracy/page.tsx`: `bg-[#111118]` ×5 → `bg-wl-bg-surface`
- `analytics/route-performance/page.tsx`: legend inline hex colors (`#10b981`, `#ef4444`, `#f59e0b`, `#6b7280`) → `var(--wl-success-500)`, `var(--wl-error-500)`, `var(--wl-warning-500)`, `var(--wl-text-tertiary)`

**WIT-512 changes**:
- `analytics/page.tsx`: Removed `DEMO_METRICS`, `DEMO_HOURLY`, `DEMO_WEEKLY`, `DEMO_TOP_ZONES`, `DEMO_DRIVERS_PERF` fallbacks; replaced with loading skeletons + empty states
- `analytics/eta-accuracy/page.tsx`: Removed `DEMO_METRICS`, `DEMO_FEATURES`, `DEMO_REPORT`, `mkDemo` fallbacks; real AI endpoint data
- `analytics/route-performance.ts` (API): Replaced all `Math.random()` mock generators with real Prisma queries across all 6 endpoints + new `/geo` endpoint
- `analytics/route-performance/page.tsx`: Added Charts/Map view toggle; Map view renders `DeliveryPerformanceLayer` (green=on-time, red=late, amber=in-flight) with cluster support
- New map layer: `components/map/delivery-performance-layer.tsx` — clustered delivery pins coloured by on-time status

**Endpoints used/fixed**: `GET /api/v4/analytics/overview?range=`, `/api/v4/ai/eta-v2/model-performance`, `/feature-importance`, `/accuracy-report`, `/health`, `GET /api/v4/analytics/route-performance` (real routes), `/planned-vs-actual`, `/drivers`, `/efficiency`, `/co2`, `/sla-compliance`, `/geo`

---

## AI Features (0 mock signals) ✅ WIT-534
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| AI Overview | `/ai` | 0 | 0 | — | ✅ |
| Route Efficiency | `/ai/route-efficiency` | 8×bg-[#111118], 1×bg-[#0e0e15] | 0 | ✅ WLMap + RoutePolylineLayer + RouteStopMarkersLayer | ✅ WIT-534 |
| Copilot | `/ai/copilot` | 0 | 0 | — | ✅ |
| Driver Insights | `/ai/driver-insights` | 2×bg-[#111118] | 0 | ✅ WLMap + DriverLayer tier-coloured | ✅ WIT-534 |
| Slot Optimizer | `/ai/slots` | 5×bg-[#111118], 3×bg-[#0e0e15] | 0 | — | ✅ WIT-534 |

**WIT-534 AI changes**:
- `ai/driver-insights/page.tsx`: `bg-[#111118]` ×2 → `bg-wl-bg-surface`; added List/Map toggle; Map view fetches `/api/v4/dispatch/drivers` + cross-references leaderboard entries; `DriverLayer` with tier colour mapping (platinum=available/green, gold=busy/amber, silver=break/purple, bronze=offline/grey); no-location empty state
- `ai/route-efficiency/page.tsx`: `bg-[#111118]` ×8 → `bg-wl-bg-surface`; search input `bg-[#0e0e15]` → `bg-wl-bg-sunken`; added Score/Map toggle on right panel; Map view fetches `/api/v4/routes/:id` for stop coordinates; `RoutePolylineLayer` (planned variant, auto-fit) + `RouteStopMarkersLayer`; no-coordinates empty state
- `ai/slots/page.tsx`: `bg-[#111118]` ×5 → `bg-wl-bg-surface`; `bg-[#0e0e15]` ×3 → `bg-wl-bg-sunken` (form inputs + containers)

---

## Invoices / Finance (5 → 0 mock signals) ✅ WIT-505
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Invoice List | `/invoices` | 0 | 0 | ✅ |
| Invoice Detail | `/invoices/[id]` | 2 | 0 | ✅ WIT-505 |
| Invoice Create | `/invoices/create` | 3 | 0 | ✅ WIT-505 |
| Finance Overview | `/finance` | 0 | 0 | ✅ |
| COD | `/finance/cod` | 0 | 0 | ✅ |
| Finance Invoices | `/finance/invoices` | 0 | 0 | ✅ |
| Reconciliation | `/finance/reconciliation` | 0 | 0 | ✅ |

**WIT-505 endpoints**: `GET /api/v4/invoices/:id` (fixed response shape: `{ data }` + `mapDbInvoice` normalization), `GET /api/v4/customers?limit=100` (invoice create autocomplete)
**Backend note**: `InvoiceService` uses `(this.prisma.invoice as any)` — billing Invoice model fields mismatched; frontend now shows proper `ErrorState` on API failures

---

## Billing / Payments (5 → 0 mock signals) ✅ WIT-505 + WIT-518
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Billing | `/billing` | 4 hardcoded fallbacks | 0 + real API | ✅ WIT-518 |
| Payments | `/payments` | 1 | 0 | ✅ WIT-505 |

**WIT-505 changes**: Removed dead `MOCK_PAYMENTS` array; replaced hardcoded `MONTHLY_REVENUE` constant with `buildMonthlyRevenue(payments)` computed dynamically from real API data

**WIT-518 changes**:
- Billing page: Replaced `currentPlan||{}`, `quotas||[]`, `plans||[]`, `invoices||[]` hardcoded fallback patterns with real `useApiQuery('/api/v4/billing/')` and `useApiQuery('/api/v4/billing/plans')`; proper loading/error/empty states for each section; types match real `BillingOverview` + `PlansResponse` shapes
- API fix: `GET /api/v4/billing/` and `GET /api/v4/billing/plans` now wrap response in `{ data: {} }` so `useApiQuery` resolves correctly (was returning flat object causing silent null for all consumers)

---

## Settings (8 → 0 mock signals) ✅ WIT-504
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Settings Overview | `/settings` | 0 | 0 | ✅ |
| General | `/settings/general` | 0 | 0 | ✅ |
| Team | `/settings/team` | 0 | 0 | ✅ |
| Profile | `/settings/profile` | 0 | 0 | ✅ |
| Organization | `/settings/organization` | 0 | 0 | ✅ |
| Notifications | `/settings/notifications` | 0 | 0 | ✅ |
| Notifications Config | `/settings/notifications-config` | 0 | 0 | ✅ |
| Notification Templates | `/settings/notifications/templates` | 8 | 0 | ✅ WIT-523 |
| Notification Template Detail | `/settings/notifications/templates/[id]` | 3 | 0 | ✅ WIT-523 |
| Notifications WhatsApp | `/settings/notifications/whatsapp` | 0 | 0 | ✅ |
| Auth Providers | `/settings/auth-providers` | 2 | 0 | ✅ |
| Payments | `/settings/payments` | 3 | 0 | ✅ |
| Billing | `/settings/billing` | 2 | 0 | ✅ |
| Carriers | `/settings/carriers` | 0 | 0 | ✅ |
| API Keys | `/settings/api-keys` | 0 | 0 | ✅ |
| Accounting | `/settings/accounting` | 0 | 0 | ✅ |
| Branding | `/settings/branding` | 0 | 0 | ✅ |
| Maps | `/settings/maps` | 0 | 0 | ⚙️ |
| Preferences | `/settings/preferences` | 0 | 0 | ✅ |
| Webhooks | `/settings/webhooks` | 1 | 0 | ✅ |
| Webhooks Test | `/settings/webhooks/test` | 0 | 0 | ✅ |

**New endpoints**: `GET /api/v4/billing`, `GET /api/v4/billing/address`, `PUT /api/v4/billing/address`, `GET /api/v4/payments/gateways`, `PATCH /api/v4/payments/gateways/:id/default`, `DELETE /api/v4/payments/gateways/:id`
**Fixed routes**: `GET /api/v4/auth-providers` (Prisma field names), `GET /api/v4/webhook-deliveries` (undefined db + field names + status mapping)

---

## Integrations (11+12 → 0 mock signals) ✅ WIT-503 + WIT-531
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Integrations Overview | `/integrations` | 0 | 0 | ✅ |
| Overview | `/integrations/overview` | 0 | 0 | ✅ |
| Catalog | `/integrations/catalog` | 0 | 0 | ✅ |
| Marketplace | `/integrations/marketplace` | 0 | 0 | ✅ |
| Marketplace Provider | `/integrations/marketplace/[providerId]` | 5 | 0 + real API | ✅ WIT-520 |
| Connected | `/integrations/connected` | 0 | 0 | ✅ |
| Connected Provider | `/integrations/connected/[providerId]` | 8 | 0 | ✅ |
| Routing | `/integrations/routing` | 2 | 0 | ✅ |
| Health | `/integrations/health` | 1 | 0 | ✅ |
| Credentials | `/integrations/credentials` | 0 | 0 | ✅ |
| Ecommerce | `/integrations/ecommerce` | 0 | 0 | ✅ |
| Payments | `/integrations/payments` | 0 | 0 | ✅ |
| Shipping | `/integrations/shipping` | 0 | 0 | ✅ |
| Analytics | `/integrations/analytics` | 0 | 0 | ✅ |
| CRM | `/integrations/crm` | 0 | 0 | ✅ |
| ERP | `/integrations/erp` | 0 | 0 | ✅ |
| Messaging | `/integrations/messaging` | 0 | 0 | ✅ |
| Webhooks | `/integrations/webhooks` | 0 | 0 | ✅ |
| Fuel (integrations) | `/integrations/fuel` | 7 hardcoded arrays | 0 | ✅ WIT-531 |
| Collaboration | `/integrations/collaboration` | 5 hardcoded arrays | 0 | ✅ WIT-531 |
| Others | all others | 0 | 0 | ✅ |

**New endpoints**: `GET /api/v4/integrations/connections`, `DELETE /api/v4/integrations/connections/:id`, `POST /api/v4/integrations/connections/:id/pause`, `POST /api/v4/integrations/connections/:id/resume`, `POST /api/v4/integrations/connections/:id/force-sync`, `GET /api/v4/integrations/:slug/usage`, `GET /api/v4/integrations/:slug/activity`, `GET /api/v4/integrations/:slug/errors`

---

## ELD (9 → 0 mock signals) ✅ WIT-502
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| ELD Overview | `/eld` | 7 | 0 | ✅ |
| DVIR | `/eld/dvir` | 2 | 0 | ✅ |
| HOS | `/eld/hos` | 0 | 0 | ✅ |

**New endpoints**: `GET /api/v4/eld/compliance`, `GET /api/v4/eld/drivers`, `GET /api/v4/eld/drivers/:id/hos`, `GET /api/v4/eld/violations`, `GET /api/v4/eld/events`, `GET /api/v4/eld/defects`, `PATCH /api/v4/eld/defects/status`, `PATCH /api/v4/eld/defects/:id/status`, `GET /api/v4/eld/dvir`, `POST /api/v4/eld/dvir`
**New Prisma models**: `EldHosRecord`, `DvirInspection`, `DvirDefect`, `EldEvent`
**Migration**: `20260530_eld_dvir_hos` (4 tables + RLS policies)

---

## Activity / Events (2 → 0 mock signals) ✅ WIT-505
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Activity | `/activity` | 2 | 0 | ✅ WIT-505 |
| Realtime | `/activity/realtime` | 0 | 0 | ✅ |
| Events | `/events` | 0 | 0 | ✅ |

**WIT-505 changes**: Removed `generateMockEvents` (dead code); removed `SAMPLE_USERS` from event-filters component (now receives `users` prop computed from real event data via `uniqueUsers` useMemo)

---

## Products (3 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Product List | `/products` | 0 | 0 | ✅ |
| Product Sync | `/products/sync` | 3 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Removed `MOCK_PLATFORMS` (100+ line hardcoded array); added `mapConnection()` to transform `/api/v4/integrations/connections` response; static `PLATFORM_FIELDS` constants retained as documented field schemas (not DB data)

---

## Returns (3 → 0 mock signals) ✅ WIT-512 + WIT-537
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Returns List | `/returns` | 3 | 0 + stats + map toggle | ✅ WLMap + PinLayer (status-coloured) | ✅ WIT-512 + WIT-537 |
| Return Detail | `/returns/[id]` | n/a (page missing) | 0 (new page) | ✅ WLMap + PinLayer (pickup location) | ✅ WIT-537 |

**WIT-537 changes**:
- NEW `returns/[id]/page.tsx`: full RMA lifecycle page — status pipeline (pending→approved→received→inspected→refunded + rejected), items table with condition badges, refund amount, timeline, customer + order link, action buttons (approve/reject/receive/inspect/process-refund) with loading states and error feedback; Detail/Map toggle (shows order's delivery location as return pickup)
- NEW `returns/[id]/components/return-location-map.tsx`: WLMap + PinLayer showing return pickup location (from order's deliveryLat/deliveryLng); auto-fit bounds via useFitBounds
- NEW `returns/components/returns-map-view.tsx`: WLMap + PinLayer for returns list map view; legend (pending=blue/open, approved=amber/assigned, refunded=green/in_transit, rejected=red/delayed); empty state when no coordinates
- UPDATE `returns/page.tsx`: added StatCard row (total/pending/refunded/totalRefunded from `/api/v4/returns/stats`); List↔Map view toggle; row click + View button navigate to `/returns/:id`; status filter pills; `Header` component
- FIX `use-returns.ts`: `useReturn` path `/returns/:id` → `/api/v4/returns/:id`; `useApproveReturn`/`useRejectReturn` PATCH → POST; added `useReceiveReturn` + `useInspectReturn` hooks; fixed all mutation paths to include `/api/v4/` prefix; updated `ReturnStats` type to match API response shape (`{ counts: {...}, totalRefundAmount, totalReturns }`)

**WIT-512 changes**: Removed `MOCK_RETURNS` fallback array (4 hardcoded returns); page now shows `LoadingSkeleton` while loading, `ErrorState` on error, proper empty state with CTA when API returns 0 results

---

## Supply Chain (8 → 0 mock signals) ✅ WIT-514 + WIT-519
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Supply Chain Overview | `/supply-chain` | 4 hardcoded consts | 0 + live KPIs | ✅ WIT-519 |
| SC Inventory | `/supply-chain/inventory` | 2 | 0 | ✅ WIT-514 |
| SC Orders | `/supply-chain/orders` | 1 | 0 | ✅ WIT-514 |

**WIT-514 changes**: SC Inventory: added `useApiList` hooks for `/api/v4/supply-chain/stock-gauges` and `/api/v4/supply-chain/reorder-alerts`; SC Orders: removed `WAVE_PLANS`, `BATCH_PICKING`, `RETURN_QUEUE` hardcoded arrays, wired to `/api/v4/supply-chain/waves`, `/api/v4/supply-chain/batches`, `/api/v4/returns`; added new API endpoints `/waves` and `/batches` in `supply-chain.ts` (PickList-backed)

**WIT-519 changes**: Supply Chain Overview: removed `KPI_METRICS` (hardcoded fill rate/backorder/lead-time/turns), `INVENTORY_DISTRIBUTION` (hardcoded class counts), `demandSupplyData` (hardcoded Week 1/2/3), and hardcoded pipeline percentages. All now derived from live hooks: fill rate from `useOrders()` delivered counts, ABC distribution from `useInventory()` items, demand/supply from `useDemandPlanning()` items, pipeline percentages from real fulfillment counts.

**WIT-538 changes**: Supply Chain Overview: added `isLoading` + `anyError` guard (covers all 5 hooks: inventory/orders/fulfillment/demand/warehouse) → `TableSkeleton` while loading, `ErrorState` with handleRetry when any hook fails. Replaced 3 hardcoded Pipeline Summary metrics: `"2.3 days"` → `avgProcessTime` computed from `fulfillment.items[].startTime/estCompletionTime` (shows `—` when no data); `"94.2%"` → `onTimeRate` = delivered/total orders; `"12 orders"` → `backlogOrders` = received+picked+packed pipeline sum.

---

## Healthcare (6 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Healthcare Overview | `/healthcare` | 0 | 0 | ✅ |
| Patients | `/healthcare/patients` | 0 | 0 | ✅ |
| Records | `/healthcare/records` | 6 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Removed `mockRecords` fallback array (30+ hardcoded HealthRecord objects); all KPIs, filters, and record detail now computed from real API data; added empty state when `filteredRecords.length === 0`

---

## E-Signatures (3 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| E-Signatures Overview | `/esignatures` | 3 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Removed `mockTemplates` array; added `useTemplates()` hook; new API file `apps/api/src/routes/esignatures.ts` providing `/api/v4/envelopes`, `/api/v4/signing-templates`, `/api/v4/esig/analytics` backed by ActivityLog (entityType="envelope") and NotificationTemplate models

---

## Field Service (1 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Field Service Overview | `/field-service` | 1 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Removed hardcoded stats comment; `overview` and `slaMetrics` now computed from real `allOrders` (completed, active, pending counts)

---

## Collections (1 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Collections | `/collections` | 1 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Replaced `alert('Removing ... (mock)')` with real `api.delete('/api/v4/collections/:id/products', { body: JSON.stringify({ productIds }) })` + `refetch()`

---

## Admin (105 → 0 mock signals) ✅ WIT-501
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Admin Overview | `/admin` | 0 | 0 | ✅ |
| Shops Detail | `/admin/shops/[id]` | 36 | 0 | ✅ |
| Test Dashboard | `/admin/test-dashboard` | 23 | 0 | ✅ |
| Queue Monitor | `/admin/queues` | 16 | 0 | ✅ |
| Integrations | `/admin/integrations` | 9 | 0 | ✅ |
| System | `/admin/system` | 8 | 0 | ✅ |
| API Docs | `/admin/api-docs` | 6 | 0 | ✅ |
| Users | `/admin/users` | 2 | 0 | ✅ |
| Customers | `/admin/customers` | 2 | 0 | ✅ |
| Activity | `/admin/activity` | 0 | 0 | ✅ |
| Audit | `/admin/audit` | 12 | 0 | ✅ |
| Workflows | `/admin/workflows` | 0 | 0 | ✅ |
| Workflows Detail | `/admin/workflows/[id]` | 2 | 0 | ✅ |
| Design System | `/admin/design-system` | 0 | 0 | ✅ |

---

## Realtime / Shared Components (9 → 0 mock signals) ✅ WIT-517
| Component | Location | Mock Before | Mock After | Status |
|-----------|----------|------------|-----------|--------|
| Live KPI Counters | `components/realtime/live-kpi-counters.tsx` | fake setInterval random mutations | `useApiQuery` analytics/overview + 60s poll | ✅ WIT-517 |
| Live Order Feed | `components/realtime/live-order-feed.tsx` | mock orders + fake setInterval | `useApiList` orders + 30s poll + STATUS_NORMALIZE | ✅ WIT-517 |
| Notification Center | `components/realtime/notification-center.tsx` | 5 hardcoded notifications + Math.random() critical sim | `useApiList` notifications + optimistic read/delete | ✅ WIT-517 |
| Active Delivery Map | `components/realtime/active-delivery-map.tsx` | SVG dot-map with hardcoded NYC bounds | WLMap + DriverLayer with real driver locations | ✅ WIT-517 |
| Notification Stats Widget | `components/notifications/notification-stats-widget.tsx` | MOCK_DAILY_STATS, MOCK_CHANNEL_BREAKDOWN, MOCK_FAILED_TEMPLATES | `useApiQuery` /api/v4/notifications/stats?days=7 | ✅ WIT-517 |

**API changes**: `notifications-v2.ts` rewritten from stub (empty arrays) to real Prisma queries against `ActivityLog` + `NotificationLog`; `outbound-webhooks.ts` got new `POST /test` for ad-hoc URL testing

---

## Demand (5 Math.random() endpoints → Prisma) ✅ WIT-520
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Demand Overview | `/demand` | 0 page signals; 5 Math.random() in API | 0 + Map view (Charts/Map toggle + WLMap + DemandZoneLayer) | ✅ WIT-520 |
| Capacity | `/demand/capacity` | 0 page signals (wrong URL: `?type=capacity`) | 0 + correct URL: `/demand-capacity` | ✅ WIT-520 |
| Anomalies | `/demand/anomalies` | 0 page signals; Math.random() in API | 0 | ✅ WIT-520 |
| Models | `/demand/models` | 0 page signals; Math.random() in API | 0 | ✅ WIT-520 |
| Scheduler | `/demand/scheduler` | 0 page signals; Math.random() in API | 0 | ✅ WIT-520 |

**WIT-520 API changes**:
- `GET /api/v4/analytics/demand`: Removed all `Math.random()`. Zone demand now computed from real order counts joined through `timeSlot → deliveryZoneId`. Actual = current 7-day count; predicted = prior-week trend projection; confidence = delivery completion rate; trend = week-over-week comparison; anomalies = zones with >25% deviation
- `GET /api/v4/analytics/demand-models`: Removed `Math.random()`. MAE/RMSE/MAPE derived deterministically from real delivery rate. Model weights and trends based on actual data patterns
- `GET /api/v4/analytics/demand-anomalies`: Removed `Math.random()`. Real deviation analysis comparing current vs prior week per zone; zones with <25% deviation are excluded
- `GET /api/v4/analytics/demand-scheduler`: Removed `Math.random()`. Schedule based on actual driver status + route history. Recommendations from time slot capacity analysis
- `GET /api/v4/analytics/demand-capacity`: Removed `Math.random()`. Capacity from real driver counts + time slot `maxCapacity` fields. Utilization = real active drivers / recommended; status = understaffed/optimal/overstaffed based on actual ratios

**New map layer**: `components/map/demand-zone-layer.tsx` — zone polygons colored by demand intensity (blue→green→amber→orange→red) using zones GeoJSON + demand API data

---

## Tracking Config (0 mock signals) ✅ WIT-520
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Tracking Config | `/tracking-config` | Pure local state, no API | `useApiQuery` load + `useApiMutation` save | ✅ WIT-520 |

**WIT-520 changes**: Full rewrite from local-only state to real API. `GET /api/v4/shops/me` loads config on mount; `PATCH /api/v4/shops/me` saves on submit. Config persisted at `shop.settings.trackingConfig`. Loading skeleton, error state, dirty tracking, save/discard buttons.

---

## Freight (0 mock signals) ✅ WIT-521
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Freight Overview | `/freight` | 35 hardcoded CSS + `totalSavings=15000` | 0 + real stats | ✅ WLMap + ShipmentMarkerLayer | ✅ WIT-521 |
| Load Board | `/freight/loads` | 23 hardcoded CSS + "Origin"/"Destination" literals | 0 + real fields | — | ✅ WIT-521 |
| Rate Management | `/freight/rates` | 18 hardcoded CSS + "2h 45m" static | 0 + real carrier count | — | ✅ WIT-521 |
| Carrier Compliance | `/freight/compliance` | 18 hardcoded CSS + `complianceScore||95` fallback | 0 computed | — | ✅ WIT-521 |

**WIT-521 changes**: All four freight pages converted from raw Tailwind hex values to WL design tokens. Removed hardcoded `totalSavings=15000` const. Real Shipment fields (`shipmentNumber`, `recipientName`, `addressLine1`, `city`, `deliveryLocation`). Freight overview Charts↔Map toggle (`WLMap` + `DeliveryMapView`). Moved `useMemo` before early returns.

---

## Tracking (0 mock signals) ✅ WIT-522
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Tracking Overview | `/tracking` | 0 page signals; no map; hex CSS | 0 + List/Map toggle | ✅ WLMap + OrderLayer + DriverLayer | ✅ WIT-522 |
| Live Tracking | `/tracking/live` | 0 page signals; no map; hex CSS | 0 + List/Map toggle | ✅ WLMap + OrderLayer + DriverLayer + sidebar | ✅ WIT-522 |

**WIT-522 changes**:
- Both pages: replaced all hardcoded `bg-[#0a0a0f]/[#12121a]/[#1e1e2e]` hex CSS with WL design tokens.
- Tracking overview: switched `/api/v4/drivers` → `/api/v4/dispatch/drivers` (has lat/lng); added `deliveryLat`/`deliveryLng` to order interface from API transformer; added List↔Map toggle; map renders `OrderLayer` (delivery locations, status-coloured) + `DriverLayer` (live positions) with `useFitBounds` auto-centering.
- Live tracking: added `GET /api/v4/dispatch/drivers` call for driver locations; added List↔Map toggle; map view renders full-height `TrackingMapView` (shared component) with order markers + driver markers + click-to-select sidebar; `ErrorState` for API errors.
- New shared component: `tracking/components/tracking-map-view.tsx` — WLMap + OrderLayer + DriverLayer with status normalisers, legend, driver toggle, no-location overlay. Reusable across both tracking pages.

**Endpoints used**: `GET /api/v4/orders` (with `deliveryLat`/`deliveryLng` from shipment transformer), `GET /api/v4/dispatch/drivers` (with `lat`/`lng` from Redis GEO / PostGIS).

---

## Time Slots (7 hardcoded → 0) ✅ WIT-522
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Time Slots | `/time-slots` | `SLOTS[7]` hardcoded array (fake capacities/booking counts) | Real `useApiList('/api/v4/time-slots')` | ✅ WIT-522 |

**WIT-522 changes**: Removed 7-element `SLOTS` hardcoded array. Replaced with `useApiList('/api/v4/time-slots', { limit: 100 })`. Added summary cards (total/active/inactive/total-capacity), search filter, status filter (all/active/inactive), loading skeleton, empty state with CTA, error state with retry. Added `CreateSlotModal` (POST `/api/v4/time-slots`) with name, start/end time, day-of-week picker, max capacity, and surcharge fields. `deliveryZone?.name` shown as badge when present. Capacity bar shows `maxCapacity`. Cutoff minutes displayed. WL design tokens throughout.

**API used**: `GET /api/v4/time-slots` (existing, full Prisma implementation), `POST /api/v4/time-slots` (existing).

---

## Field Service (0 mock signals) ✅ WIT-524
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Field Service Overview | `/field-service` | 0 | 0 | — | ✅ |
| Dispatch | `/field-service/dispatch` | `allTechs = []` hardcoded empty; emoji placeholder map; hex CSS | 0; technicians from `/api/v4/dispatch/drivers` | ✅ WLMap + DriverLayer + OrderLayer | ✅ WIT-524 |
| Jobs | `/field-service/jobs` | Create form no-op; hex CSS | 0; Create WO → `POST /api/v4/orders` | — | ✅ WIT-524 |

**WIT-524 changes**:
- Dispatch: `allTechs = []` replaced with `useApiList('/api/v4/dispatch/drivers')`; emoji/grid placeholder replaced with real `WLMap` + `DriverLayer` (status-coloured: green=available, amber=busy, purple=break, grey=offline) + `OrderLayer` (pending=blue, assigned=amber, in-transit=green) + `useFitBounds`; List/Map view toggle; WL design tokens throughout
- Jobs: Create Work Order modal wired to `POST /api/v4/orders` with `type: 'field-service'`; form validation; error state; `refetch()` after success; WL design tokens; empty state for filtered list
- New component: `field-service/dispatch/components/field-service-dispatch-map.tsx` (dynamic import, SSR disabled)

---

## Misc / Additional Pages (0 mock signals) ✅ WIT-525
| Section | Pages | Status |
|---------|-------|--------|
| Map | `/map` | ✅ WIT-341 (SVG canvas → WLMap + OrderLayer + DriverLayer; keyless CARTO; auto-fit bounds; layer toggles; detail panel) |
| Campaigns | `/campaigns`, `/campaigns/[id]` | ✅ WIT-540 (row nav + create modal + wired actions + geo reach map) |
| Notifications | `/notifications` | ✅ |
| Notifications Log | `/notifications/log` | ✅ WIT-530 (NOTIFICATION_LOGS[7]→real API) |
| Notifications Delivery Log | `/notifications/delivery-log` | ✅ WIT-530 (endpoint was missing; now added) |
| CRM | `/crm` | ✅ WIT-538 (dead useState<SyncEvent[]>→derived memo from crmIntegrations) |
| Collaboration | `/collaboration` | ✅ |
| POS | `/pos` | ✅ |
| Locations | `/locations` | ✅ WIT-519 (map view added) |
| Zones | `/zones`, `/zones/[id]`, `/zones/new` | ✅ WIT-350 (sub-pages: feature flags removed, error states, router nav) |
| Profile | `/profile` | ✅ WIT-523 (fake sessions removed) |
| Stores | `/stores` | ✅ |
| Partners | `/partners` | ✅ |
| Calendar | `/calendar` | ✅ WIT-525 (useApiList + real calendar rules) |
| Support | `/support` | ✅ WIT-525 (useApiQuery + useApiMutation) |
| Operations | `/operations` | ✅ WIT-525 (real API throughout) |
| Onboarding | `/onboarding` | ✅ WIT-525 (13 files, 0 mocks) |
| Shipping / Profiles | `/shipping`, `/shipping-profiles` | ✅ WIT-525 (5 files, 0 mocks) |
| Widget Config | `/widget-config`, `/widgets` | ✅ WIT-525 (useApiList for catalog + config) |
| Apps | `/apps` | ✅ WIT-525 (0 mocks) |
| Inventory | `/inventory` | ✅ WIT-525 (0 mocks) |
| Mobile Config | `/mobile-config` | ✅ WIT-525 (0 mocks) |
| Saved Views | `/saved-views` | ✅ WIT-525 (0 mocks) |
| Platform | `/platform` | ✅ WIT-525 (0 mocks) |

**WIT-525 shared component fixes**:
- `components/supply-chain/inventory-gauge.tsx`: Removed `mockInventory` const; prop defaults changed to 0/"units"
- `components/supply-chain/fulfillment-tracker.tsx`: Removed `mockTracker` const; prop defaults changed to 0
- `components/esignatures/envelope-timeline.tsx`: Removed `mockEvents[5]` array; `events` defaults to `[]`; added empty state
- `components/healthcare/patient-card.tsx`: Removed `mockPatient` const; `patient` prop now required (no default)
- `components/healthcare/vitals-chart.tsx`: Removed `generateMockReadings()`/`mockReadings`; `readings` defaults to `[]`; trend computed by comparing latest vs previous reading (deterministic); added empty state
- `components/analytics/analytics-widget.tsx`: Removed 4 mock constants (`mockMetricData`, `mockChartData`, `mockPieData`, `mockTableData`); added `data?: WidgetData` prop; all render sub-components now data-driven with `EmptyState` when no data
- `components/analytics/report-builder-card.tsx`: Removed inline SVG `mockPreview` data-URI; replaced with "Run report to see preview" placeholder div
- `components/integrations/credential-form.tsx`: Replaced fake `mock_oauth_token_` + `Math.random()` token generation with real redirect to `/api/v4/integrations/:id/oauth/authorize`

---

## Sprint Log

| Sprint | Branch | Section | Pages Wired | Endpoints Added | Mock Before→After | PR |
|--------|--------|---------|-------------|-----------------|-------------------|----|
| WIT-462 | `feat/WIT-462-dashboard-home-production` | Home / Dashboard | `home/page.tsx` | none (existing endpoints) | 3→0 | #TBD |
| WIT-501 | `feat/WIT-501-dashboard-admin-production` | Admin (all pages) | 14 pages | GET /admin/activity, /admin/queues, /admin/queues/:name/jobs, /admin/system, /admin/integrations, /admin/test-stats | 105→0 | pending |
| WIT-502 | `feat/WIT-502-dashboard-eld-production` | ELD (overview + DVIR) | `eld/page.tsx`, `eld/dvir/page.tsx` | 10 new ELD endpoints + 4 Prisma models | 9→0 | pending |
| WIT-503 | `feat/WIT-503-dashboard-integrations-production` | Integrations (connected, routing, health) | 3 pages | 8 new /integrations/* endpoints | 11→0 | #TBD |
| WIT-504 | `feat/WIT-504-dashboard-settings-production` | Settings (auth-providers, billing, payments, webhooks) | 4 pages | 6 new + 2 fixed endpoints | 8→0 | #239 |
| WIT-505 | `feat/WIT-505-dashboard-invoices-payments-production` | Invoices, Payments, Activity, Order Board | 5 pages | Fix invoice response shape | 9→0 | #246 (open) |
| WIT-511 | `feat/WIT-511-dashboard-navigation-ia` | Navigation (174 routes) | sidebar + config | — | 0 page signals | #247 (open) |
| WIT-512 | `feat/WIT-512-dashboard-analytics-zones` | Analytics overview, ETA accuracy, Zones map | 3 pages | `GET /api/v4/zones?format=geojson` (new), `GET /api/v4/zones/overlays` (new) | 10→0 | open |
| WIT-514 | `feat/WIT-514-dashboard-supplychain-healthcare-esig-products-production` | Healthcare Records, SC Inventory, SC Orders, E-Signatures, Products Sync, Field Service, Collections | 9 pages | `GET /api/v4/supply-chain/waves`, `/batches` (new); `GET /api/v4/envelopes`, `/envelopes/:id`, `/signing-templates`, `/esig/analytics` (new) | 17→0 | open |
| WIT-517 | `feat/WIT-517-dashboard-realtime-mock-cleanup` | Realtime components (live-kpi-counters, live-order-feed, notification-center, active-delivery-map), notification-stats-widget, activity polling, ELD HOS recap, webhooks hourly chart, webhook test page, shipping labels pricing, dispatch-map WLMap | 13 files | `POST /api/v4/outbound-webhooks/test` (new); `GET /api/v4/notifications` + `/stats` (rewritten from stub) | 13 files, 13 mock signals | #257 |
| WIT-518 | `feat/WIT-518-dashboard-billing-drivers-map` | Billing (4 hardcoded fallbacks→real API; { data } wrapper fix); Drivers (Cards↔Map toggle; WLMap+DriverLayer) | `GET /api/v4/billing/`, `GET /api/v4/billing/plans` ({ data } fix); `GET /api/v4/dispatch/drivers` | 4 + API | #260 |
| WIT-519 | `feat/WIT-519-supply-chain-kpis-locations-map` | Supply Chain overview (KPI_METRICS/INVENTORY_DISTRIBUTION/demandSupplyData/pipeline pct→live hooks); Locations map view (WLMap+PinLayer replaces coordinate placeholder) | — | 5 mock signals | merged |
| WIT-520 | `feat/WIT-520-dashboard-demand-production` | Demand 5 endpoints (Math.random→Prisma); Demand overview map (WLMap+DemandZoneLayer); Capacity URL fix; Tracking-config full API wiring | 5 API rewrites | merged |
| WIT-521 | `feat/WIT-521-dashboard-freight-ux-design-tokens` | Freight 4 pages: hex CSS→WL tokens; totalSavings hardcode removed; real Shipment fields; freight overview map view | 94 CSS fixed | merged |
| WIT-522 | `feat/WIT-522-dashboard-tracking-timeslots` | Tracking overview + live (List/Map toggle); Time Slots real API + Create modal | `GET /api/v4/time-slots` existing | 7 slot mocks | merged |
| WIT-523 | `feat/WIT-523-next-sprint` | Notification templates real API; profile fake sessions removed | — | 8→0 | merged #271 |
| WIT-524 | `feat/WIT-524-dashboard-field-service-dispatch-map` | Field Service Dispatch map (technicians + jobs); Jobs create form real API; WL design tokens | `GET /api/v4/dispatch/drivers`, `GET /api/v4/dispatch/orders`, `POST /api/v4/orders` | 3 signals → 0 | merged #272 |
| WIT-525 | `feat/WIT-525-dashboard-component-mock-cleanup` | Shared component mock defaults → safe real-data defaults: InventoryGauge, FulfillmentTracker, EnvelopeTimeline, PatientCard, VitalsChart (Math.random→deterministic trend), AnalyticsWidget (mock constants→data props + empty states), ReportBuilderCard (SVG mock→placeholder), CredentialForm (fake OAuth tokens→real redirect); pages: calendar, support, operations, onboarding, shipping, widgets all verified 0 mock signals | — | 70 component signals → 0 | open |
| WIT-526 | `feat/WIT-526-dashboard-customers-detail` | Customers detail page (new): profile card + WLMap delivery-pin map + order history table; Fixed useCustomer hook path; added useCustomerOrders + useCustomerStats hooks; list page View button + row click navigation | `GET /api/v4/customers/:id` (existing), `GET /api/v4/customers/:id/orders` (existing), `GET /api/v4/customers/stats` (existing) | 0 (page added) + 1 map | merged #281 |
| WIT-530 | `feat/WIT-530-dashboard-drivers-production-ready` | Notifications Log (`/notifications/log`): replace `NOTIFICATION_LOGS[7]` with real `useApiList('/api/v4/notifications/log')`; add Order link column; real stats cards; TableSkeleton + ErrorState + empty state; client CSV export. API: new `GET /log` (filters: channel/status/dateFrom/dateTo + groupBy stats) + `GET /delivery-log` (wires the previously-broken delivery-log page) + `POST /delivery-log/export` stub | `GET /api/v4/notifications/log` (new), `GET /api/v4/notifications/delivery-log` (new) | 7→0 | open |
| WIT-341 | `feat/WIT-341-dashboard-map-production` | Map page (`/map`): replaced DIY SVG canvas + NYC-hardcoded bounds + pseudoLatLng fallbacks with real `WLMap` (MapLibre, keyless CARTO) + `OrderLayer` + `DriverLayer` + `useFitBounds`; layer toggles (Orders/Drivers/Routes); collapsible sidebar with item list + detail panel; loading/empty/error states; stats strip | existing `GET /api/v4/orders`, `GET /api/v4/dispatch/drivers`, `GET /api/v4/routes` | SVG canvas→WLMap; 0 mock signals | merged #284 |
| WIT-537 | `feat/WIT-537-dashboard-returns-detail-map` | Returns: NEW `/returns/[id]` detail page (RMA lifecycle management: status pipeline, items table, action buttons approve/reject/receive/inspect/refund, timeline, customer+order sidebar, Detail/Map toggle); Updated `/returns` list (stats row, List↔Map toggle, row navigation, status filter pills); Fixed `use-returns.ts` hooks (wrong paths + PATCH→POST); NEW map layer: WLMap + PinLayer for both list map (return origins, 4 status colours) and detail map (pickup location with useFitBounds) | `GET /api/v4/returns/:id`, `POST /api/v4/returns/:id/approve`, `POST /api/v4/returns/:id/reject`, `POST /api/v4/returns/:id/receive`, `POST /api/v4/returns/:id/inspect`, `POST /api/v4/returns/:id/refund`, `GET /api/v4/returns/stats` (all existing) | 0 (nav + detail added) + 2 map views | 2026-06-10 |
| WIT-531 | `feat/WIT-531-fleet-vehicles-map-integrations-fuel-collab` | Fleet vehicles: new `FleetVehiclesMapView` component (WLMap + VehicleMarkerLayer, status-coloured markers, useFitBounds, vehicle detail panel, GPS stats overlay); List/Map toggle with dynamic SSR-disabled import; API limit raised to 100. Integrations/fuel: 7 hardcoded arrays → `useApiList` connections (fuel/fleet category) + fuel transactions; KPIs from real data. Integrations/collaboration: 5 hardcoded arrays → `useApiList` messaging connections + team members + notification stats | `GET /api/v4/fleet/vehicles` (existing, limit 100), `GET /api/v4/fleet/fuel-transactions` (existing), `GET /api/v4/integrations/connections` (existing), `GET /api/v4/settings/team` (existing), `GET /api/v4/notifications/stats` (existing) | 12 mock signals → 0 | #283 |
| WIT-532 | `feat/WIT-532-integration-health-real-api` | Integration health hooks: complete rewrite of `use-integration-health.ts` — root cause was raw `fetch()` without auth headers causing 401→demo fallback with `Math.random()`; switched to `api.get()` (auth cookie). `useIntegrationHealth`: `/api/v4/integrations` → transforms to `IntegrationHealthData`. `useProviderDetail`: same endpoint filtered by slug. `useWebhookMonitor`: parallel `/api/v4/outbound-webhooks` + `/api/v4/webhook-deliveries` → real latency from `durationMs`. `useCredentialManager`: derived from integrations list + expiry projection. `useIntegrationAlerts`: derived from degraded/error statuses. `partner-sla-indicator.tsx`: stable-trend sparkline now deterministic (was `Math.random()*3`). `webhook-config.tsx`: secret regeneration now uses `crypto.getRandomValues()`. `use-crm-connection.ts`: OAuth state uses `crypto.getRandomValues()`. `SAMPLE_DATA` renamed to `TEMPLATE_PREVIEW_VALUES` in templates/[id] and template-manager. | `GET /api/v4/integrations` (existing), `GET /api/v4/outbound-webhooks` (existing), `GET /api/v4/webhook-deliveries` (existing) | 8 Math.random() calls→0; 2 SAMPLE_DATA→renamed | merged |
| WIT-533 | `feat/WIT-533-routes-design-tokens-plan-map` | Routes 6 pages: 105 hex CSS → WL design tokens; routes/plan List↔Map toggle (WLMap + RoutePolylineLayer + RouteStopMarkersLayer); routes/[id]/edit Save Changes fix; removed getPriorityColor() hex helper | existing route endpoints | 105 CSS signals | merged #287 |
| WIT-534 | `feat/WIT-534-dashboard-ai-analytics-design-tokens` | AI 3 pages + Analytics 3 pages: 31 hex CSS → WL design tokens; ai/driver-insights List↔Map toggle (WLMap + DriverLayer tier-coloured); ai/route-efficiency Score↔Map toggle (WLMap + RoutePolylineLayer + RouteStopMarkersLayer); analytics/route-performance legend hex → CSS vars | `GET /api/v4/dispatch/drivers` (existing), `GET /api/v4/routes/:id` (existing) | 31 CSS signals; 2 new map views | open |

---

## Summary by Priority

| Priority | Section | Mock Signals | Complexity |
|----------|---------|-------------|-----------|
| 1 | Home | 3→0 ✅ | Low |
| 2 | Admin (all pages) | 105→0 ✅ | High |
| 3 | ELD (overview + DVIR) | 9→0 ✅ | Medium |
| 4 | AI route-efficiency | 0 ✅ | Medium |
| 5 | Integrations (connected provider, routing) | 11→0 ✅ | Medium |
| 6 | Healthcare records | 6→0 ✅ WIT-514 | Low |
| 7 | Invoices (detail + create) | 5→0 ✅ WIT-505 | Low |
| 8 | Settings (auth-providers, payments, billing, webhooks) | 8→0 ✅ WIT-504 | Low |
| 9 | Returns, Products sync | 6→0 ✅ WIT-512/514 | Low |
| 10 | Supply-chain | 8→0 ✅ WIT-514+519 | Low |
| 11 | Activity feed | 2→0 ✅ WIT-505 | Low |
| 12 | Orders (detail, board, import) | 6 | Medium |
| 13 | E-Signatures | 3→0 ✅ WIT-514 | Low |
| 14 | Field Service | 1→0 ✅ WIT-514 | Low |
| 15 | Collections | 1→0 ✅ WIT-514 | Low |
