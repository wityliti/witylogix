# Dashboard Production Readiness Tracker

> Source of truth for dashboard sprint progress.
> Each ✅ section: real API data, loading/empty/error states, map view (if geographic), zero mock.

## Legend
- ✅ Done — real data, production UX, map if geographic
- 🔄 Partial — real API but missing map or UX polish
- ⬜ Not started

---

## Section Status

| Section | Pages | Status | Map View | PR | Notes |
|---------|-------|--------|----------|----|-------|
| Auth | login, register | ✅ | — | merged | |
| Home | dashboard home | ✅ | — | merged | |
| Admin | shops, users, system, etc. | 🔄 | — | — | Some mock remains (admin/users, admin/queues) |
| ELD | compliance, DVIR | 🔄 | — | — | Some mock remains |
| Integrations | connected, routing, health | 🔄 | — | — | Some mock remains |
| Settings | notifications, billing, webhooks | 🔄 | — | — | Some mock remains |
| Dispatch | order queue, driver assign | ✅ | ✅ | merged | Live map with driver/order layers |
| Routes | route planning | ✅ | ✅ | merged | Polyline + stop markers |
| Shipments | shipment tracking | ✅ | ✅ | merged | Marker layer |
| Fleet | vehicle management | ✅ | ✅ | merged | Vehicle markers |
| Orders | order management | ✅ | — | merged | Table + board views; WIT-340 |
| Analytics | overview, route-performance, ETA | ✅ | ✅ | merged | Zone heat map; WIT-340 |
| **Zones** | delivery zone management | **✅** | **✅** | **WIT-341** | **Polygon layer + heat overlay; zero mock** |
| **Payments** | payment transactions | **✅** | — | **WIT-341** | **Real API, monthly chart from live data, BigInt fix** |
| Delivery | shipment list | 🔄 | ⬜ | — | Real API, no map view yet |
| Drivers | driver management | 🔄 | ⬜ | — | Real API, no location map yet |
| Customers | customer management | 🔄 | ⬜ | — | Real API, no geographic view |
| Notifications | inbox, preferences | 🔄 | — | — | useNotifications hook |
| Billing (settings) | subscription, plan | ⬜ | — | — | Mock data remains |
| Activity | activity feed | ⬜ | — | — | Mock data |
| Collections | product collections | ⬜ | — | — | Mock data |
| Field Service | job dispatch | 🔄 | ⬜ | — | Mixed real/mock (schedule hardcoded) |
| Returns | return management | ⬜ | — | — | Mock data |
| Supply Chain | orders, inventory | ⬜ | — | — | Mock data |

---

## WIT-341 Sprint Summary (2026-06-09)

**Section:** Zones + Payments
**Branch:** `feat/WIT-341-dashboard-zones`

### Changes Made

#### Zones Page (`apps/dashboard/src/app/(dashboard)/zones/page.tsx`)
- **Before:** 100% hardcoded `const ZONES = [...]` array with 5 fake zones
- **After:** Real API via `useApiList('/api/v4/zones', { limit: 100 })`
- Two-panel layout: zone cards (left) + WLMap (right)
- Zone cards show: name, active/inactive badge, base rate, per-km rate, min order, free-above threshold, time-slot count, priority
- Click card → selected state highlights zone on map
- Map: `ZonePolygonLayer` renders GeoJSON polygon boundaries (when `boundary` JSON field is set)
- Fallback notice: "No polygon boundaries configured — edit zones to draw coverage areas"
- Map legend overlay, stats bar (active count, boundary count)
- Show/hide inactive toggle
- Loading skeletons, empty state, error state with retry

#### New Map Component (`apps/dashboard/src/components/map/zone-polygon-layer.tsx`)
- Renders GeoJSON polygon/multipolygon boundaries with per-zone colour
- Selected zone highlighted (thicker border, higher opacity)
- Auto-fits map bounds to visible polygons
- Inactive zones shown with dashed border + reduced opacity
- Reusable by other geographic pages (time-slot coverage, etc.)

#### Payments Page (`apps/dashboard/src/app/(dashboard)/payments/page.tsx`)
- **Before:** `MOCK_PAYMENTS` constant (10 fake entries) + `MONTHLY_REVENUE` static data driving the chart
- **After:** All data from `useApiList('/api/v4/payments')` — zero mock
- Updated `Payment` interface → correct `PaymentTransaction` type matching actual API schema
- Monthly revenue chart computed via `useMemo` from real `createdAt` grouped by month (rolling 6 months)
- Table columns updated to real fields: `type`, `amount`, `status`, `providerName`, `providerRef`, `createdAt`
- Stats (collected, pending, refunded, failed count) derived from live data
- Loading skeletons, empty state, CSV export

#### API Fix (`apps/api/src/routes/payments.ts`)
- `amount` field is `BigInt` (cents) in the Prisma model — JSON serialization would throw
- Fixed list + get endpoints: `amount: Number(p.amount) / 100` → returns dollars as `number`

### Mock before → after
| File | Before | After |
|------|--------|-------|
| zones/page.tsx | `const ZONES = [5 hardcoded zones]` | `useApiList('/api/v4/zones')` |
| payments/page.tsx | `MOCK_PAYMENTS` (10 entries) + `MONTHLY_REVENUE` (3 months) | real API + computed monthly revenue |

### Verification
- `pnpm --filter @witylogix/dashboard build` ✅
- `pnpm --filter @witylogix/dashboard typecheck` ✅
- `pnpm lint` ✅
- `grep mock zones/ payments/` → 0 matches ✅

---

## Next Priority Sections (remaining ⬜ / 🔄)

1. **Drivers** — add live location map (driver-location-layer already exists in components/map)
2. **Delivery** — add delivery-point map view  
3. **Activity feed** — replace mock with real API (`/api/v4/activity` or audit-log endpoint)
4. **Field Service** — wire schedule endpoint, remove hardcoded SLA/completion metrics
5. **Billing settings** — wire subscription/plan API
6. **Admin pages** — users, queues, system — replace mock data
