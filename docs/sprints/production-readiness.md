# Dashboard Production-Readiness Tracker

Source of truth for dashboard section production-readiness sprints.

## Status Key
- ✅ Done — real API, loading/empty/error states, map view where geographic
- ⬜ Pending
- 🗺️ Geographic page (has or should have map view)

---

## Completed Sections

### Auth / Shell
- ✅ Login / auth flow
- ✅ Dashboard layout, nav

### Home
- ✅ Home page — real stats from `/api/v4/dashboard-stats`

### Admin
- ✅ Admin section (users, activity, queues, system, shops, integrations, api-docs)

### ELD
- ✅ ELD + DVIR pages

### Integrations
- ✅ Integrations section (connected, routing, health)

### Settings
- ✅ Settings section

### Geographic Command Pages (Sprint WIT-340-ish)
- ✅ 🗺️ Dispatch — real API + live driver markers map
- ✅ 🗺️ Routes — route polylines map
- ✅ 🗺️ Shipments — shipment markers map
- ✅ 🗺️ Fleet — vehicle markers map

### Analytics (WIT-340)
- ✅ 🗺️ Analytics overview — real API, zone heat map

### Orders (WIT-340)
- ✅ Orders board — real API, full filtering + pagination

### Drivers
- ✅ Drivers list — real API data

### Customers
- ✅ Customers — real API via `useCustomers` hook

### Notifications
- ✅ Notifications inbox — real API via `useNotifications` hook

### Zones (WIT-341)
- ✅ 🗺️ Zones management — real API from `/api/v4/zones`
  - Added `ordersToday` stat via efficient raw SQL query in zones API
  - New `zone-polygon-layer.tsx` shared map component for rendering zone boundaries
  - Loading skeletons, empty state, error state
  - Map view with polygon boundaries + auto-fit bounds + legend overlay
  - Toggle between grid view and map view
  - Grid view: colour-coded cards, pricing grid, orders-today count

---

## Pending Sections (priority order)

### Billing ⬜
- `/billing` — uses `useApiList` for `/api/v4/billing/*` endpoints; needs verification

### Delivery ⬜
- `/delivery` — real API for shipments; add map view for in-transit shipments 🗺️

### Drivers > Detail ⬜
- `/drivers/[id]` — driver profile with live location map 🗺️

### Demand ⬜
- `/demand` — demand heatmap (geographic) 🗺️

### Campaigns ⬜
- `/campaigns` — check for mock data

### Field Service ⬜
- `/field-service` — has mock data, geographic dispatch map needed 🗺️

### Supply Chain ⬜
- `/supply-chain/orders` — has mock data
- `/supply-chain/inventory` — has mock data

### Invoices ⬜
- `/invoices`, `/invoices/[id]`, `/invoices/create` — some mock data

### Returns ⬜
- `/returns` — mock data

### Activity ⬜
- `/activity` — mock data

### E-signatures ⬜
- `/esignatures` — mock data

---

## Map Component Library (`apps/dashboard/src/components/map/`)
| Component | Purpose |
|-----------|---------|
| `wl-map.tsx` | Base keyless CARTO Leaflet map |
| `zone-heat-layer.tsx` | Circles proportional to order volume (analytics) |
| `zone-polygon-layer.tsx` | Zone boundary polygons from {lat,lng} arrays *(WIT-341)* |
