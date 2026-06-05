# Dashboard Production-Readiness Sprint

Tracking doc for the ongoing sprint to replace all mock/dummy/placeholder/hardcoded data
in `apps/dashboard` with real API calls, add loading/empty/error states, and add map views
for geographic pages.

## Status Legend

- ✅ Done — PR merged, real API, full UX
- 🚧 In progress — PR open
- ⬜ Pending

## Sections

### Already done before sprint (on staging/main)

- ✅ Customer portal
- ✅ Tracking page
- ✅ Dashboard auth (login, register, forgot-password)
- ✅ Dashboard home/overview
- ✅ Admin section (settings, integrations)
- ✅ ELD module
- ✅ Dispatch (live map, route assignment)
- ✅ Routes (map + polylines)
- ✅ Shipments (map + markers)
- ✅ Fleet (vehicle markers, live tracking)

---

### Sprint PRs

#### PR #274 — Analytics + Orders Board (feat/WIT-340) ✅
**Merged:** Pending CI (Build, Test, Typecheck, Lint)

Files changed:
- `analytics/page.tsx` — Removed 5 DEMO_* constants; real API via `/api/v4/analytics/overview?range=X`; loading skeletons; error+retry; Zone Map toggle (Leaflet + CARTO)
- `analytics/eta-accuracy/page.tsx` — Removed mkDemo() + 3 DEMO_* objects; null-safe API
- `orders/board/page.tsx` — Removed dead MOCK_ORDERS; added ApiOrder→BoardOrder mapping
- `components/map/wl-map.tsx` — NEW: WLMap foundation (global registry, CARTO dark basemaps)
- `components/map/zone-heat-layer.tsx` — NEW: reusable zone bubble layer
- `analytics/components/zone-analytics-map.tsx` — NEW: self-contained zone map w/ 50+ city coords

Mock data eliminated: 5+3+15 = 23 items

---

#### PR #? — Zones + Drivers Detail (feat/WIT-341) 🚧

Files changed:
- `zones/page.tsx` — Removed ZONES const (5 hardcoded items); real API via `/api/v4/zones`; loading/error/empty states; **Zone Boundaries Map** toggle (Leaflet + GeoJSON polygon rendering)
- `zones/components/zones-map.tsx` — NEW: zone polygon map with GeoJSON boundary rendering
- `drivers/[id]/page.tsx` — Removed DEMO_SCORE_RESPONSE + DEMO_HISTORY (12 items); proper loading skeleton + null state instead of fake fallback data
- `apps/api/src/routes/zones.ts` — Added `ordersToday` count via Prisma (TimeSlot→Order aggregation)

Mock data eliminated: 5+12 = 17 items

---

### Remaining (⬜ Pending)

High priority (geographic or high-traffic):

- ⬜ `customers/page.tsx` — Already uses `useCustomers` hook; hardcoded StatCard `change` values need removal or real data
- ⬜ `drivers/performance/page.tsx` — Already uses `useApiList`; hardcoded `change` values on StatCards
- ⬜ `notifications/page.tsx` — Check for mock data
- ⬜ `settings/billing/page.tsx` — Check for mock data
- ⬜ `payments/page.tsx` — Check for mock data
- ⬜ `field-service/page.tsx` — Check for mock data; geographic (dispatch map)
- ⬜ `supply-chain/orders/page.tsx` + `supply-chain/inventory/page.tsx`
- ⬜ `admin/activity/page.tsx`, `admin/users/page.tsx`, `admin/queues/page.tsx`
- ⬜ `invoices/[id]/page.tsx`, `invoices/create/page.tsx`
- ⬜ `collections/page.tsx`
- ⬜ `products/sync/page.tsx`
- ⬜ `returns/page.tsx`
- ⬜ `esignatures/page.tsx`
- ⬜ `healthcare/records/page.tsx`
- ⬜ `home/page.tsx` — Dashboard home/overview stats

---

## Map Foundation

All maps use keyless CARTO dark matter tiles — no API key needed.

```
https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
```

Shared components in `apps/dashboard/src/components/map/`:
- `wl-map.tsx` — WLMap base (global registry, CARTO tiles, `onReady` callback)
- `zone-heat-layer.tsx` — Zone activity bubble layer (orders-weighted circles)

Page-local map components:
- `analytics/components/zone-analytics-map.tsx` — Zone delivery activity bubbles
- `zones/components/zones-map.tsx` — Zone polygon boundary map

## Quality Bar

Each page must pass:
1. `grep -rniE "mock|dummy|sampleData|hardcoded|fake|lorem|DEMO_|const.*ZONES\b|MOCK_" <files> | grep -vi "placeholder=|__tests__|\.test\."` → empty
2. `pnpm --filter @witylogix/dashboard build` → 0 errors
3. `pnpm --filter @witylogix/dashboard typecheck` → 0 errors
4. `pnpm --filter @witylogix/dashboard lint` → 0 errors
