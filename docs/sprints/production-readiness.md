# Dashboard Production Readiness Tracker

Last updated: 2026-06-05

## Quality Bar
Each section must:
- (a) Fetch **real data** from API — zero mock/dummy/placeholder/hardcoded data
- (b) Production UX — loading skeletons, empty states, error + permission states, responsive layout, accessible
- (c) Geographic pages include a real **map view** (keyless WLMap + CARTO + shared layers)

## Map Foundation
- `apps/dashboard/src/components/map/wl-map.tsx` — keyless Leaflet + CARTO dark tiles
- `apps/dashboard/src/components/map/zone-polygon-layer.tsx` — zone boundary polygons (GeoJSON)
- `apps/dashboard/src/components/map/driver-location-layer.tsx` — driver location markers
- `apps/dashboard/src/components/map/shipment-location-layer.tsx` — shipment delivery dots
- `apps/dashboard/src/components/map/zone-heat-layer.tsx` — zone demand heatmap circles

## Sections

### ✅ WIT-340 — Analytics + Orders Board (merged main, 2026-06-05)
- Pages: `analytics/page.tsx`, `orders/board/page.tsx`
- Map: `zone-analytics-map.tsx` (ZoneHeatLayer with real analytics/overview zone data)
- Mock before: ~40 hardcoded data items → After: 0

### ✅ WIT-341 — Zones + Delivery + Drivers (PR open, 2026-06-05)
- **Zones page** (`/zones`) — was 100% hardcoded ZONES array (5 mock zones)
  - Now: `useApiList('/api/v4/zones')`, zone polygon map with ZonePolygonLayer
  - Map: zone boundary polygons from GeoJSON field, toggle on/off
  - API fix: `zones.ts` POST/PATCH now stores boundary as GeoJSON JSON (not failing PostGIS raw SQL)
- **Delivery page** (`/delivery`) — had real API but wrong field names + no map
  - Now: real fields (recipientName, addressLine1, city, deliveryLocation), stat cards, Header
  - Map: ShipmentLocationLayer plots delivery locations when lat/lng available
- **Drivers page** (`/drivers`) — had real API but no map
  - Now: split view with driver location map + status tabs + stat cards
  - New API endpoint: `GET /api/v4/drivers/locations` (PostGIS with graceful fallback)
  - Map: DriverLocationLayer with status-coloured initials markers
- Mock before: 5 hardcoded zones → After: 0

### ⬜ WIT-342 — Billing (billing page — quotas, plans, invoices via API)
- Has real API calls but `currentPlan` hardcoded, needs endpoint review

### ⬜ WIT-343 — Notifications (notifications/page.tsx — already has real API via use-notifications hook)
- Review hook implementation for completeness

### ⬜ WIT-344 — Campaigns (campaigns/page.tsx — uses useApiList, needs review)

### ⬜ WIT-345 — Customers Map View (customers/page.tsx — has real API, needs geographic cluster map)

### ⬜ WIT-346 — Analytics Route Performance (route-performance page)

### ⬜ WIT-347 — Demand Heatmap (demand page — geographic priority)

### ⬜ WIT-348 — Field Service / Dispatch enhancements

### ⬜ WIT-349 — Finance / Payments pages

### ⬜ WIT-350 — Returns / Inventory pages

### ⬜ WIT-351 — Products / Collections pages

### ⬜ WIT-352 — CRM / Partners pages

### ⬜ WIT-353 — Healthcare / Freight vertical pages

## Completed Summary
| WIT  | Section          | Pages | Maps | Mock→0 |
|------|-----------------|-------|------|--------|
| 340  | Analytics+Orders | 2     | 1    | ~40    |
| 341  | Zones+Delivery+Drivers | 3 | 3  | 5 zones |
