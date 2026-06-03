# Dashboard Production-Readiness Tracker

Legend: ✅ Done · ⬜ Pending · 🚧 In-progress

---

## Already Complete (pre-sprint)

| Section | Notes |
|---------|-------|
| ✅ Auth | Login, session, multi-tenant |
| ✅ Home | Real stats, no mocks |
| ✅ Admin | Users, audit, queues, system |
| ✅ ELD | HOS, DVIR — real API |
| ✅ Integrations | List + logs — real API |
| ✅ Settings | All sub-pages — real API |
| ✅ Dispatch | Real API + live SVG map |
| ✅ Routes | Real API + map layers |
| ✅ Shipments | Real API + map layers |
| ✅ Fleet | Real API + live vehicle map |

---

## Sprint Log

### WIT-340 — Zones + Orders Board + Analytics (2026-06-03)

**Pages touched:** 3 pages · **Map views added:** 1 (Zones — WLMap + ZonePolygonLayer) · **Endpoints enhanced:** 1 (zones API — GeoJSON boundary via ST_AsGeoJSON) · **New components:** `components/map/wl-map.tsx`, `components/map/zone-polygon-layer.tsx`, `components/map/use-fit-bounds.ts`

| Page | Before | After |
|------|--------|-------|
| ✅ `/zones` | Hardcoded ZONES array (100% mock) | Real API + WLMap with zone polygon overlays, loading/empty/error states |
| ✅ `/orders/board` | Dead MOCK_ORDERS constant (15 fake orders) | Removed; board already called real API |
| ✅ `/analytics` | DEMO_METRICS/DEMO_HOURLY/DEMO_WEEKLY/DEMO_TOP_ZONES/DEMO_DRIVERS_PERF fallbacks | Real API only; loading skeletons, empty charts, error+retry |

**Mock count:** before = 20+ constants / after = 0

**maplibre-gl installed** — free CARTO basemaps, no API key required.

---

## Pending Sections (prioritised)

| Section | Pages | Mock? | Map Opportunity | Priority |
|---------|-------|-------|-----------------|----------|
| ⬜ Customers | `/customers`, `/customers/[id]` | unknown | By-area heatmap | HIGH |
| ⬜ Drivers (detail) | `/drivers/[id]`, `/drivers/performance` | unknown | Driver routes map | HIGH |
| ⬜ Delivery | `/delivery`, `/delivery/standard` | unknown | Delivery heatmap | HIGH |
| ⬜ Demand | `/demand`, `/demand/anomalies`, `/demand/capacity`, `/demand/models`, `/demand/scheduler` | unknown | Demand heatmap | HIGH |
| ⬜ Analytics sub-pages | `/analytics/route-performance`, `/analytics/eta-accuracy`, `/analytics/reports` | partial | Route map | HIGH |
| ⬜ Notifications | `/notifications` | unknown | — | MED |
| ⬜ Billing | `/billing`, `/settings/billing` | unknown | — | MED |
| ⬜ Campaigns | `/campaigns`, `/campaigns/[id]` | unknown | — | MED |
| ⬜ CRM | `/crm`, `/crm/connect` | unknown | — | MED |
| ⬜ Payments | `/payments` | unknown | — | MED |
| ⬜ Inventory | `/inventory` | unknown | — | MED |
| ⬜ Field Service | `/field-service/dispatch`, `/field-service/jobs` | unknown | Job locations map | HIGH |
| ⬜ Returns | `/returns` | unknown | — | LOW |
| ⬜ Supply Chain | `/supply-chain/*` | unknown | — | LOW |
