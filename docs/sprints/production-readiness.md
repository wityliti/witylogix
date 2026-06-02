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
| WIT-516 | feat/WIT-516-dashboard-activity-eld-webhooks-dispatch-production | Activity (Math.random live-mode→refetch), ELD HOS (DRIVER_OPTIONS→useELDDriverStatus, random 8-day recap→derived from real hos, broken /eld/hos→removed), Webhooks chart (Math.random→real hourly buckets), Webhook Test (fake setTimeout→real API + new POST /outbound-webhooks/test), Shipping Labels (Math.random price→deterministic), DispatchMap (Leaflet placeholder→WLMap+RoutePolylineLayer+RouteStopMarkersLayer+DriverLayer) | 7 + API | 2026-06-02 |

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

## Orders (1 mock signal — 8 pages total)
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Order List | `/orders` | 0 | 0 | ✅ |
| Order Detail | `/orders/[id]` | 2 | — | ⬜ |
| Order Board | `/orders/board` | 1 | 0 | ✅ WIT-505 |
| Order Import | `/orders/import` | 3 | — | ⬜ |
| Order Create | `/orders/create` | 0 | — | ⬜ |
| Order Bulk | `/orders/bulk` | 0 | — | ⬜ |
| Order Conflicts | `/orders/conflicts` | 0 | — | ⬜ |
| Order Local | `/orders/local` | 0 | — | ⬜ |

---

## Shipments (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Shipment List | `/shipments` | 0 | ✅ |
| Shipment Detail | `/shipments/[id]` | 0 | ✅ |

---

## Delivery (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Delivery Overview | `/delivery` | 0 | ✅ |
| Standard Delivery | `/delivery/standard` | 0 | ✅ |

---

## Customers (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Customer List | `/customers` | 0 | ✅ |
| Customer Create | `/customers/create` | 0 | ✅ |

---

## Drivers (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Driver List | `/drivers` | 0 | ✅ |
| Driver Detail | `/drivers/[id]` | 0 | ✅ |
| Driver Create | `/drivers/create` | 0 | ✅ |
| Driver Performance | `/drivers/performance` | 0 | ✅ |

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

## Dispatch (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Dispatch | `/dispatch` | 0 | ✅ |
| Couriers | `/dispatch/couriers` | 0 | ✅ |

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

## Billing / Payments (1 → 0 mock signals) ✅ WIT-505
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Billing | `/billing` | 0 | 0 | ✅ |
| Payments | `/payments` | 1 | 0 | ✅ WIT-505 |

**WIT-505 changes**: Removed dead `MOCK_PAYMENTS` array; replaced hardcoded `MONTHLY_REVENUE` constant with `buildMonthlyRevenue(payments)` computed dynamically from real API data

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
| Notification Templates | `/settings/notifications/templates` | 0 | 0 | ✅ |
| Notification Template Detail | `/settings/notifications/templates/[id]` | 0 | 0 | ✅ |
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
| Marketplace Provider | `/integrations/marketplace/[providerId]` | 0 | 0 | ✅ |
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

## Supply Chain (3 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Supply Chain Overview | `/supply-chain` | 0 | 0 | ✅ |
| SC Inventory | `/supply-chain/inventory` | 2 | 0 | ✅ WIT-514 |
| SC Orders | `/supply-chain/orders` | 1 | 0 | ✅ WIT-514 |

**WIT-514 changes**: SC Inventory: added `useApiList` hooks for `/api/v4/supply-chain/stock-gauges` and `/api/v4/supply-chain/reorder-alerts`; SC Orders: removed `WAVE_PLANS`, `BATCH_PICKING`, `RETURN_QUEUE` hardcoded arrays, wired to `/api/v4/supply-chain/waves`, `/api/v4/supply-chain/batches`, `/api/v4/returns`; added new API endpoints `/waves` and `/batches` in `supply-chain.ts` (PickList-backed)

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

## Misc / No-API-Key Gated
| Section | Pages | Status |
|---------|-------|--------|
| Map | `/map` | ⚙️ (requires maps key) |
| Campaigns | `/campaigns` | ✅ |
| Notifications | `/notifications` | ✅ |
| CRM | `/crm` | ✅ |
| Collaboration | `/collaboration` | ✅ |
| POS | `/pos` | ✅ |
| Locations | `/locations` | ✅ |
| Zones | `/zones` | ✅ (WIT-512: feature-flag removed, map always shown) |
| Profile | `/profile` | ✅ |
| Stores | `/stores` | ✅ |
| Partners | `/partners` | ✅ |

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
| 10 | Supply-chain | 3→0 ✅ WIT-514 | Low |
| 11 | Activity feed | 2→0 ✅ WIT-505 | Low |
| 12 | Orders (detail, board, import) | 6 | Medium |
| 13 | E-Signatures | 3→0 ✅ WIT-514 | Low |
| 14 | Field Service | 1→0 ✅ WIT-514 | Low |
| 15 | Collections | 1→0 ✅ WIT-514 | Low |
