# Dashboard Production Readiness

**Last updated:** 2026-06-05  
**Branch convention:** `feat/WIT-<id>-dashboard-<section>` → PR to `main`

---

## Completed Sprints

### WIT-340 — Analytics + Orders Board ✅
- `analytics/page.tsx` — real API, ZoneAnalyticsMap (WLMap + ZoneHeatLayer), loading/error/empty states
- `orders/board/page.tsx` — real API kanban, no mock
- Map layers added: `wl-map.tsx`, `zone-heat-layer.tsx`, `analytics/components/zone-analytics-map.tsx`

### WIT-341 — Zones + Delivery Map + Drivers [id] ✅
**Pages made production-ready:**

| Page | Mock Before | Mock After | Map Added |
|------|------------|------------|-----------|
| `zones/page.tsx` | 5 hardcoded zones (ZONES array) | 0 — real `GET /api/v4/zones` | ✅ ZonePolygonLayer |
| `delivery/page.tsx` | 0 mock, no map | 0 — real API, List/Map toggle | ✅ ShipmentMarkerLayer |
| `drivers/[id]/page.tsx` | DEMO_SCORE_RESPONSE + DEMO_HISTORY fallback | 0 — real API, proper loading/error states | — |

**New shared map layers:**
- `components/map/zone-polygon-layer.tsx` — renders zone polygon boundaries (parses WKT / GeoJSON / `{latitude,longitude}[]`) + centroid labels
- `components/map/shipment-marker-layer.tsx` — status-coloured shipment markers with city-coordinate fallback

**Build / Typecheck / Lint:** ✅ all pass

---

## Remaining Sections (⬜ = todo)

### High Priority (geographic / high-traffic)
- ⬜ `drivers/page.tsx` — add map toggle (driver locations)
- ⬜ `orders/[id]/page.tsx` — order detail with delivery map
- ⬜ `customers/page.tsx` — customer map (by city)  
- ⬜ `routes/page.tsx` — already geographic? verify no mock
- ⬜ `dispatch/page.tsx` — verify map is real data
- ⬜ `fleet/page.tsx` — verify no mock

### Medium Priority
- ⬜ `notifications/page.tsx` — verify hook is real (looks OK)
- ⬜ `billing/page.tsx` — hardcoded `currentPlan` subscription object
- ⬜ `campaigns/page.tsx` — uses `useApiList`, verify endpoint exists
- ⬜ `payments/page.tsx` — check for mock

### Lower Priority (admin / settings)
- ⬜ `admin/activity/page.tsx` — has mock
- ⬜ `admin/users/page.tsx` — has mock  
- ⬜ `admin/queues/page.tsx` — has mock
- ⬜ `integrations/routing/page.tsx` — has mock
- ⬜ `integrations/health/page.tsx` — has mock
- ⬜ `settings/billing/page.tsx` — has mock
- ⬜ `settings/payments/page.tsx` — has mock
- ⬜ `settings/webhooks/page.tsx` — has mock
- ⬜ `returns/page.tsx` — has mock
- ⬜ `payments/page.tsx` — has mock
- ⬜ `invoices/[id]/page.tsx` — has mock
- ⬜ `invoices/create/page.tsx` — has mock
- ⬜ `field-service/page.tsx` — has mock
- ⬜ `supply-chain/orders/page.tsx` — has mock
- ⬜ `supply-chain/inventory/page.tsx` — has mock
- ⬜ `esignatures/page.tsx` — has mock
- ⬜ `healthcare/records/page.tsx` — has mock
- ⬜ `products/sync/page.tsx` — has mock
- ⬜ `collections/page.tsx` — has mock
- ⬜ `home/page.tsx` — has mock (verify)
- ⬜ `eld/page.tsx` — has mock (verify)
- ⬜ `activity/page.tsx` — has mock
