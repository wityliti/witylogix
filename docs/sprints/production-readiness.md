# Dashboard Production Readiness

Source of truth for all production-ready sprints. Pick the next ⬜ section.

## Legend
- ✅ Done — real data, production UX, map (if geographic)
- 🔄 In progress
- ⬜ Not started
- ➖ Not applicable / low priority

## Already completed (on main before this tracker)
- ✅ `auth` — login, register, forgot password
- ✅ `home` — overview dashboard  
- ✅ `admin` — platform admin, users, orgs, system
- ✅ `eld` — hours of service, DVIR
- ✅ `integrations` — catalog, connected providers, health, logs
- ✅ `settings` — profile, org, team
- ✅ `dispatch` — with live WLMap (driver markers, route polylines)
- ✅ `routes` — with WLMap
- ✅ `shipments` — with WLMap
- ✅ `fleet` — with WLMap (vehicle markers)
- ✅ `analytics` — overview + zone analytics map (WLMap + ZoneHeatLayer)
- ✅ `analytics/route-performance` — full metrics, charts, leaderboard
- ✅ `orders` — real API, board + table views
- ✅ `drivers` — real API data (no map — non-geographic list)

## Sprint WIT-350 — Delivery Zones (2026-06-06)
- ✅ `zones` — real API (`/api/v4/zones`), WLMap + ZonePolygonLayer, loading/empty/error states, today's bookings, split/list/map view modes

  **Changes:**
  - `apps/api/src/routes/zones.ts` — added `todayBookings` (delivery slot groupBy aggregation)
  - `apps/dashboard/src/components/map/zone-polygon-layer.tsx` — NEW reusable polygon layer (accepts `{latitude,longitude}[]` boundaries, popups, selected highlight, fallback circles, auto-fit bounds)
  - `apps/dashboard/src/app/(dashboard)/zones/page.tsx` — rewritten: zero hardcoded data, 3 view modes (split/list/map), filter tabs, stat strip, loading skeletons, empty state, error state
  - Mock before: 5 hardcoded `ZONES` objects; Mock after: 0

---

## Remaining (next priority order)

### High Traffic + Geographic

- ⬜ `delivery` — deliveries list/detail, map view with delivery markers
- ⬜ `customers` — currently uses real API but missing map (customer density/clusters); add customer heatmap or cluster layer
- ⬜ `demand` — demand heatmap (geographic, high value)

### Revenue / Business Critical

- ⬜ `billing` — partially real API; has hardcoded `currentPlan` object; fix + add subscription data
- ⬜ `invoices` — list has mock data; invoice detail has mock data
- ⬜ `payments` — has mock data

### Operations

- ⬜ `notifications` — uses real API; verify preferences + settings pages
- ⬜ `campaigns` — uses real API; add analytics + detail page
- ⬜ `returns` — has mock data

### Platform / Admin

- ⬜ `admin/activity` — mock data
- ⬜ `admin/users` — mock data
- ⬜ `admin/queues` — mock data
- ⬜ `admin/system` — mock data
- ⬜ `activity` — mock data

### Secondary

- ⬜ `supply-chain/orders` — mock data
- ⬜ `supply-chain/inventory` — mock data
- ⬜ `field-service` — mock data
- ⬜ `esignatures` — mock data
- ⬜ `products/sync` — mock data
- ⬜ `collections` — mock data
- ⬜ `healthcare/records` — mock data

---

## Map components available in `apps/dashboard/src/components/map/`

| File | What it renders |
|------|----------------|
| `wl-map.tsx` | Base Leaflet map (CARTO dark, keyless) |
| `zone-heat-layer.tsx` | Circular heatmap blobs for zone analytics |
| `zone-polygon-layer.tsx` | Zone polygon/boundary layer with popups (**NEW WIT-350**) |

---

## Notes
- Maps use free CARTO basemaps — no API key needed
- `WLMap` exposes `onReady(mapId)` for child layer hooks
- All layers are dynamic-imported (no SSR) since Leaflet requires browser
- Never hardcode Mapbox/Google/MapTiler keys in source
