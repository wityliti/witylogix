# Dashboard Production Readiness

Source of truth for sprint progress. One section per PR, marked ✅ when merged green.

## Legend
- ✅ Done (merged, green CI)
- 🔄 In progress
- ⬜ Pending

---

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

## SPRINT TRACKER

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
