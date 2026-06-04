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

## Customers (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Customer List | `/customers` | 0 | ✅ |
| Customer Create | `/customers/create` | 0 | ✅ |

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

## Routes (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Routes List | `/routes` | 0 | ✅ |
| Route Detail | `/routes/[id]` | 0 | ✅ |
| Route Plan | `/routes/plan` | 0 | ✅ |
| Route Create | `/routes/create` | 0 | ✅ |
| Route Assign | `/routes/[id]/assign` | 0 | ✅ |
| Route Edit | `/routes/[id]/edit` | 0 | ✅ |

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
| Vehicles | `/fleet/vehicles` | 0 | ✅ |
| Vehicle Detail | `/fleet/vehicles/[id]` | 0 | ✅ |
| Fuel | `/fleet/fuel` | 0 | ✅ |
| Maintenance | `/fleet/maintenance` | 0 | ✅ |

---

## Analytics (14 → 0 mock signals) ✅ WIT-512
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Analytics Overview | `/analytics` | DEMO_METRICS, DEMO_HOURLY, DEMO_WEEKLY, DEMO_TOP_ZONES, DEMO_DRIVERS_PERF (5 consts) | 0 | ✅ WIT-512 |
| Dashboards | `/analytics/dashboards` | 0 | 0 | ✅ |
| ETA Accuracy | `/analytics/eta-accuracy` | DEMO_METRICS, DEMO_FEATURES, DEMO_REPORT, mkDemo (4 consts) | 0 | ✅ WIT-512 |
| Reports | `/analytics/reports` | 0 | 0 | ✅ |
| Route Performance | `/analytics/route-performance` | 0 (API all Math.random()) | 0 + Map view | ✅ WIT-512 |

**WIT-512 changes**:
- `analytics/page.tsx`: Removed `DEMO_METRICS`, `DEMO_HOURLY`, `DEMO_WEEKLY`, `DEMO_TOP_ZONES`, `DEMO_DRIVERS_PERF` fallbacks; replaced with loading skeletons + empty states
- `analytics/eta-accuracy/page.tsx`: Removed `DEMO_METRICS`, `DEMO_FEATURES`, `DEMO_REPORT`, `mkDemo` fallbacks; real AI endpoint data
- `analytics/route-performance.ts` (API): Replaced all `Math.random()` mock generators with real Prisma queries across all 6 endpoints + new `/geo` endpoint
- `analytics/route-performance/page.tsx`: Added Charts/Map view toggle; Map view renders `DeliveryPerformanceLayer` (green=on-time, red=late, amber=in-flight) with cluster support
- New map layer: `components/map/delivery-performance-layer.tsx` — clustered delivery pins coloured by on-time status

**Endpoints used/fixed**: `GET /api/v4/analytics/overview?range=`, `/api/v4/ai/eta-v2/model-performance`, `/feature-importance`, `/accuracy-report`, `/health`, `GET /api/v4/analytics/route-performance` (real routes), `/planned-vs-actual`, `/drivers`, `/efficiency`, `/co2`, `/sla-compliance`, `/geo`

---

## AI Features (0 mock signals) ✅
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| AI Overview | `/ai` | 0 | ✅ |
| Route Efficiency | `/ai/route-efficiency` | 0 | ✅ |
| Copilot | `/ai/copilot` | 0 | ✅ |
| Driver Insights | `/ai/driver-insights` | 0 | ✅ |
| Slot Optimizer | `/ai/slots` | 0 | ✅ |

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

## Integrations (11 → 0 mock signals) ✅ WIT-503
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

## Returns (3 → 0 mock signals) ✅ WIT-512
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Returns | `/returns` | 3 | 0 | ✅ WIT-512 |

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
| Map | `/map` | ⚙️ (requires maps key) |
| Campaigns | `/campaigns` | ✅ |
| Notifications | `/notifications` | ✅ |
| CRM | `/crm` | ✅ |
| Collaboration | `/collaboration` | ✅ |
| POS | `/pos` | ✅ |
| Locations | `/locations` | ✅ WIT-519 (map view added) |
| Zones | `/zones` | ✅ (WIT-512: feature-flag removed, map always shown) |
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
