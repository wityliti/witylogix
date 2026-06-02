# Dashboard Production-Readiness Tracker

> One section per sprint. Each section must: real API data (zero mock), loading/empty/error states, map where geographic.

## Legend
- ✅ Done — real data, full UX states, map if geographic
- ⬜ Pending
- 🗺️ Has map view

---

## Completed Sections

### ✅ Auth (dashboard auth flow)
Pages: `/auth/login`, `/auth/register`, `/auth/forgot-password`
Map: N/A

### ✅ Home (dashboard home page)
Pages: `/home`
Map: N/A

### ✅ Admin
Pages: `/admin`, `/admin/users`, `/admin/test-dashboard`
Map: N/A

### ✅ ELD
Pages: `/eld`, `/eld/*`
Map: N/A

### ✅ Integrations
Pages: `/integrations`, `/integrations/*`
Map: N/A

### ✅ Settings
Pages: `/settings/*`
Map: N/A

### ✅ Dispatch 🗺️
Pages: `/dispatch`, `/dispatch/board`
Map: Live driver + order map

### ✅ Routes 🗺️
Pages: `/routes`, `/routes/*`
Map: Route polylines + stop markers

### ✅ Shipments 🗺️
Pages: `/shipments`, `/shipments/*`
Map: Shipment location markers

### ✅ Fleet 🗺️
Pages: `/fleet`, `/fleet/*`
Map: Vehicle tracking markers

### ✅ Notifications + Realtime Components (WIT-350)
**Sprint date:** 2026-06-02
**Branch:** `feat/WIT-350-dashboard-notifications-production-ready`

#### Pages fixed:
- `/notifications` — inbox (was: stub API → empty; now: ActivityLog-derived real data)
- `/notifications/log` — delivery log (was: 7 hardcoded NOTIFICATION_LOGS; now: real `NotificationLog` DB data via `useDeliveryLog`)
- `/notifications/delivery-log` — delivery log v2 (was: stub API; now: real `NotificationLog` paginated data)
- `/notifications/preferences` — preferences (was: stub; now: reads/writes `Shop.settings.notificationPreferences`)

#### Components fixed:
- `realtime/notification-center.tsx` — was: 5 hardcoded mock notifications; now: real `useNotifications` hook with client-side read state
- `realtime/live-kpi-counters.tsx` — was: 4 hardcoded metric objects with simulated random updates; now: real `GET /api/v4/analytics/overview?range=today`
- `realtime/live-order-feed.tsx` — was: 4 hardcoded orders + simulated new arrivals; now: real `GET /api/v4/orders` with sort=createdAt:desc
- `realtime/active-delivery-map.tsx` — was: 5 hardcoded driver positions + simulated movement; now: real `GET /api/v4/drivers` with `currentLocation` coordinates
- `notifications/notification-stats-widget.tsx` — was: MOCK_DAILY_STATS, MOCK_CHANNEL_BREAKDOWN, MOCK_FAILED_TEMPLATES; now: real `GET /api/v4/notifications/stats`

#### API implemented:
- `GET /api/v4/notifications` — inbox from `ActivityLog` (paginated, category-filterable)
- `GET /api/v4/notifications/stats` — aggregate from `NotificationLog`: daily counts, channel breakdown, failed templates
- `GET /api/v4/notifications/delivery-log` — paginated `NotificationLog` with search + filters
- `POST /api/v4/notifications/delivery-log/export` — CSV export
- `PATCH /api/v4/notifications/:id/read` — stateless OK (client manages read state; persistent model deferred)
- `PATCH /api/v4/notifications/:id/unread` — stateless OK
- `DELETE /api/v4/notifications/:id` — stateless OK
- `POST /api/v4/notifications/mark-all-read` — stateless OK
- `POST /api/v4/notifications/delete-bulk` — stateless OK
- `GET /api/v4/notification-preferences` — reads `Shop.settings.notificationPreferences`
- `PATCH /api/v4/notification-preferences` — writes `Shop.settings.notificationPreferences`
- `POST /api/v4/notification-preferences/test` — queues test notification

#### Map foundation:
- Created `@/components/map/wl-map.tsx` — keyless CARTO Dark Matter basemap using `leaflet` + dynamic import (no API key, no SSR issues)
- `active-delivery-map` uses SVG coordinate-space rendering from real `currentLocation` JSON values

#### Mock before → after:
- Before: 5 components + 1 page + 1 widget with explicit mock/hardcoded data
- After: 0 mock data in notifications section or realtime components

#### Known deferred items:
- Persistent read/unread state for notification inbox requires a `UserNotification` DB model + migration
- WLMap not yet wired to active-delivery-map (uses SVG dot-map with real coordinates); WLMap available for future sprints
- Map view: notifications section is not geographic; no map added per sprint rules

---

## Pending Sections (priority order)

### ⬜ Orders 🗺️
Pages: `/orders`, `/orders/[id]`, `/orders/create`, `/orders/bulk`, `/orders/board`
Priority: HIGH — geographic (map: delivery address markers)
Mock check: clean (uses real hook) — verify API returns full data

### ⬜ Deliveries 🗺️
Pages: `/delivery`, `/delivery/*`
Priority: HIGH — geographic
Map: delivery address heatmap + route visualization

### ⬜ Customers 🗺️
Pages: `/customers`, `/customers/[id]`
Priority: HIGH — geographic (customer address map)

### ⬜ Drivers 🗺️
Pages: `/drivers`, `/drivers/[id]`, `/drivers/performance`
Priority: HIGH — geographic (driver location map + route history)

### ⬜ Zones 🗺️
Pages: `/zones`, `/zones/*`
Priority: HIGH — geographic (zone polygon editor)

### ⬜ Analytics 🗺️
Pages: `/analytics`, `/analytics/route-performance`, `/analytics/eta-accuracy`
Priority: HIGH — has DEMO_* fallback data; route-performance is geographic

### ⬜ Notifications (remaining)
- Persistent read state (needs `UserNotification` model migration)
- Real-time via WebSocket / SSE subscription

### ⬜ Billing
Pages: `/billing`, `/billing/*`

### ⬜ Campaigns
Pages: `/campaigns`, `/campaigns/*`

### ⬜ CRM
Pages: `/crm`, `/crm/*`

### ⬜ Supply Chain
Pages: `/supply-chain`, `/supply-chain/*`

### ⬜ Field Service 🗺️
Pages: `/field-service`, `/field-service/*`

### ⬜ Demand 🗺️
Pages: `/demand`, `/demand/*`

### ⬜ Finance
Pages: `/finance`, `/finance/*`
