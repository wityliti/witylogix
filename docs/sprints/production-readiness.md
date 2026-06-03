# Dashboard Production Readiness

_Source of truth for sprint progress. Updated each run._

**Quality bar**: (a) zero mock/dummy/fake data — real API calls only; (b) loading skeletons, empty states, error states, responsive; (c) map view where geographic data exists; (d) build + typecheck + lint passing.

**Map foundation**: `WLMap` component at `apps/dashboard/src/components/map/wl-map.tsx` — keyless CARTO dark basemap tiles (free, no API key needed). Supports markers, polygons, zoom/pan, fullscreen, tooltips, auto-fit bounds.

---

## Sections

### Already done (pre-sprint)
- ✅ Auth pages (login, register, forgot-password)
- ✅ Home / overview page
- ✅ Admin panel (users, shops, queues partially)
- ✅ ELD (base)
- ✅ Integrations (base)
- ✅ Settings (base)
- ✅ Dispatch (geographic — map placeholder)
- ✅ Routes (real data)
- ✅ Shipments (real data)
- ✅ Fleet (real data)
- ✅ Drivers list (real data)

### Sprint WIT-340 — Analytics + Payments + Orders Board
_Date: 2026-06-03_

| Page | Mock before | Mock after | Map added | State |
|------|-------------|------------|-----------|-------|
| `analytics/page.tsx` | 5 DEMO_ constants (DEMO_METRICS, DEMO_HOURLY, DEMO_WEEKLY, DEMO_TOP_ZONES, DEMO_DRIVERS_PERF) | 0 | ✅ Zone delivery map (WLMap, auto-fit bubbles) | ✅ Done |
| `payments/page.tsx` | MOCK_PAYMENTS (14 items) + MONTHLY_REVENUE (hardcoded) | 0 | — | ✅ Done |
| `orders/board/page.tsx` | MOCK_ORDERS (15 items, dead code) | 0 | — | ✅ Done |
| `components/map/wl-map.tsx` | — NEW — | — | Canvas tile map component created | ✅ Done |

**Endpoints used**:
- `GET /api/v4/analytics/overview?range=<period>` — metrics, hourly, weekly, zones, drivers
- `GET /api/v4/payments` — payment transactions (real PaymentTransaction schema)
- `GET /api/v4/orders` (board view) — already wired

**Counts**: 3 pages fixed, 0 mock constants remaining in those pages, 1 new map component.

---

### Remaining (⬜ = todo)

#### High-traffic / geographic (prioritise next)
- ⬜ `orders/page.tsx` — already real API; add map view (order pin markers)
- ⬜ `drivers/[id]/page.tsx` — DEMO_SCORE_RESPONSE, DEMO_HISTORY fallbacks → real API
- ⬜ `analytics/route-performance/` — already real API; check all sub-components
- ⬜ `analytics/eta-accuracy/` — DEMO_ fallbacks → validate endpoints exist
- ⬜ `zones/page.tsx` — zone polygon map with WLMap
- ⬜ `customers/page.tsx` — real data, geography map
- ⬜ `delivery/page.tsx` — real data, map pins
- ⬜ `notifications/page.tsx` — real data
- ⬜ `billing/page.tsx` — real data (settings/billing has DEMO_)
- ⬜ `campaigns/page.tsx` — real data

#### Medium-traffic
- ⬜ `activity/page.tsx` — DEMO_ fallbacks
- ⬜ `ai/driver-insights/page.tsx` — DEMO_ fallbacks
- ⬜ `ai/route-efficiency/page.tsx` — DEMO_ fallbacks
- ⬜ `ai/slots/page.tsx` — DEMO_ fallbacks
- ⬜ `invoices/[id]/page.tsx` — mock fallbacks
- ⬜ `invoices/create/page.tsx` — mock fallbacks
- ⬜ `returns/page.tsx` — mock data
- ⬜ `products/sync/page.tsx` — mock data

#### Admin sub-pages (lower priority)
- ⬜ `admin/queues/page.tsx` — all mock
- ⬜ `admin/activity/page.tsx` — mock
- ⬜ `admin/test-dashboard/page.tsx` — mock (internal tool)
- ⬜ `admin/shops/[id]/page.tsx` — mock

#### Settings
- ⬜ `settings/billing/page.tsx` — DEMO_ data
- ⬜ `settings/payments/page.tsx` — DEMO_ data
- ⬜ `settings/auth-providers/page.tsx` — DEMO_ data
