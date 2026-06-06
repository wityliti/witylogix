# Dashboard Production-Readiness Tracker

Source of truth for the dashboard production-readiness sprint.
Each section = one PR. Quality bar: real API data, loading/empty/error states, responsive, accessible, maps on geographic pages.

## Legend
- ✅ Done — real data, full UX, maps where geographic
- ⬜ Next
- 🔲 Not started

---

## Completed (on staging before this tracker)

| Section | Pages | Notes |
|---------|-------|-------|
| ✅ Auth | login, register, forgot-password | — |
| ✅ Home / Dashboard | home, overview | — |
| ✅ Admin | admin, admin/users, admin/shops, admin/audit | — |
| ✅ ELD | eld, eld/logs, eld/violations | — |
| ✅ Integrations | integrations, integrations/connect, crm/connect | — |
| ✅ Settings | settings/* (profile, team, org, billing config, webhooks, notif, etc.) | — |
| ✅ Dispatch | dispatch | Live map, driver markers, order markers |
| ✅ Routes | routes, routes/[id] | Route polylines + stop markers |
| ✅ Shipments | shipments, shipments/[id] | Shipment markers on map |
| ✅ Fleet | fleet, fleet/[id] | Vehicle markers on map |
| ✅ Analytics (overview) | analytics/ | Zone heat map, real metrics |
| ✅ Orders | orders/, orders/[id], orders/board | Real API, no mock |
| ✅ Drivers | drivers/, drivers/[id], drivers/performance | Real API |
| ✅ Delivery | delivery/, delivery/standard | Real API |
| ✅ Customers | customers/ | Real API |
| ✅ Notifications | notifications/, notifications/log, notifications/delivery-log, notifications/preferences | Real API |
| ✅ Campaigns | campaigns/, campaigns/[id] | Real API |

---

## WIT-341 — Zones (this sprint) ✅

**PR**: feat/WIT-341-dashboard-zones  
**Date**: 2026-06-06

### Pages
| Page | Mock Before | Mock After | Map View |
|------|------------|------------|----------|
| `/zones` | 5 hardcoded zone objects (const ZONES = [...]) | 0 — real `/api/v4/zones` | ✅ Zone polygons via `ZonePolygonLayer` |

### New Components
- `apps/dashboard/src/components/map/zone-polygon-layer.tsx` — Renders GeoJSON polygon boundaries per zone with colour-coded fills, labels, popups, auto-fit bounds
- Updated `apps/dashboard/src/hooks/use-zones.ts` — Types now match real API response (`DeliveryZone`, `ZoneBoundary`, `ZoneTimeSlot`)

### API Used
- `GET /api/v4/zones` — full zone list with boundaries, rates, time slot counts
- `DELETE /api/v4/zones/:id` — deactivate zone
- `PATCH /api/v4/zones/:id` — update zone (for re-activate)

### UX
- Split view (list + map) togglable to list-only table
- Loading skeletons (per-card + map placeholder)
- Empty state with CTA
- Error state with retry
- Toggle activate/deactivate per zone (with optimistic lock)
- Zone map: GeoJSON polygons, coloured fills, popup with rates, auto-fit bounds, label markers
- "No boundaries" notice when no zones have PostGIS polygons set

### Verification
- `pnpm --filter @witylogix/dashboard typecheck` ✅
- `pnpm --filter @witylogix/dashboard build` ✅ (`/zones` 11.3 kB)
- `pnpm lint` ✅

---

## Remaining Sections ⬜

| # | Section | Pages | Priority | Geographic? |
|---|---------|-------|----------|-------------|
| ⬜ | Billing | billing/ | High | No |
| ⬜ | Analytics deep-dives | analytics/route-performance, analytics/eta-accuracy, analytics/reports | High | Yes (route perf map) |
| ⬜ | Time Slots | time-slots/ | Medium | No |
| ⬜ | Inventory | supply-chain/inventory | Medium | No |
| ⬜ | Finance | finance/ | Medium | No |
| ⬜ | Invoices | invoices/, invoices/[id] | Medium | No |
| ⬜ | Partners / Carriers | partners/ | Medium | No |
| ⬜ | Locations | locations/ | High | Yes (markers on map) |
| ⬜ | Field Service | field-service/ | High | Yes (technician map) |
| ⬜ | Demand | demand/ | High | Yes (heatmap) |
| ⬜ | Freight | freight/ | Low | No |
| ⬜ | Healthcare | healthcare/ | Low | No |
| ⬜ | Saved Views | saved-views/ | Low | No |
| ⬜ | Products | products/ | Medium | No |
| ⬜ | Returns | returns/ | Medium | No |
| ⬜ | POS | pos/ | Low | No |
| ⬜ | eCommerce | ecommerce/ | Low | No |
