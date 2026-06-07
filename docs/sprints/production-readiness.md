# Dashboard Production Readiness

Source of truth for the sprint-by-sprint production-readiness campaign.

## Legend
- ✅ Done — real API data, loading/empty/error states, map view (where geographic)
- ⬜ Not started — still has mock/hardcoded data or missing states
- 🗺️ Has map view

---

## Dashboard Sections

### Core / Auth / Layout
| Section | Status | Sprint | Notes |
|---------|--------|--------|-------|
| Auth (login, logout, session) | ✅ | Prior | |
| Home / Dashboard stats | ✅ | Prior | |
| Layout, sidebar, header | ✅ | Prior | |

### Geographic / High-Traffic Pages
| Section | Status | Sprint | Notes |
|---------|--------|--------|-------|
| Dispatch | ✅ 🗺️ | Prior | Live driver map |
| Routes | ✅ 🗺️ | Prior | Route polylines |
| Shipments | ✅ 🗺️ | Prior | Shipment markers |
| Fleet | ✅ 🗺️ | Prior | Vehicle tracking |
| **Zones** | ✅ 🗺️ | WIT-341 | Real API; WLMap + ZonePolygonLayer; list/map toggle; loading/empty/error |
| Orders (board) | ✅ | WIT-340 | Real API |
| Analytics | ✅ | WIT-340 | Real API charts |
| Drivers | ✅ | Prior | Real API |
| Customers | ✅ | Prior | Real API via useCustomers |

### Billing & Finance
| Section | Status | Sprint | Notes |
|---------|--------|--------|-------|
| **Billing** | ✅ | WIT-341 | Real API (subscription, plans, invoices); removed all hardcoded fallbacks; payment method via Shopify |
| Finance | ⬜ | — | |
| Payments | ⬜ | — | |
| Invoices | ⬜ | — | |

### Campaigns & Notifications
| Section | Status | Sprint | Notes |
|---------|--------|--------|-------|
| Campaigns | ✅ | Prior | Real API via useApiList |
| Notifications | ✅ | Prior | Real API via useNotifications hook |
| Notifications / Preferences | ⬜ | — | Some hardcoded dropdowns |

### Admin & Settings
| Section | Status | Sprint | Notes |
|---------|--------|--------|-------|
| Admin | ✅ | Prior | |
| ELD | ✅ | Prior | |
| Integrations | ✅ | Prior | |
| Settings (all sub-pages) | ✅ | Prior | |

### Remaining (not yet started)
| Section | Status | Sprint | Notes |
|---------|--------|--------|-------|
| CRM | ⬜ | — | |
| Inventory / Collections | ⬜ | — | |
| Field Service | ⬜ | — | |
| Returns | ⬜ | — | |
| Time Slots | ⬜ | — | |
| Partners | ⬜ | — | |
| Supply Chain | ⬜ | — | |
| Calendar | ⬜ | — | |
| Demand (geographic — heatmap) | ⬜ | — | Candidate for map view |
| Locations (geographic) | ⬜ | — | Candidate for map view |

---

## Sprint Log

### WIT-341 (2026-06-07)
**Pages:** Zones, Billing  
**Map views added:** Zones (WLMap + ZonePolygonLayer — polygon boundaries from API boundary JSON)  
**New map components:** `zone-polygon-layer.tsx`  
**API changes:**
- `GET /api/v4/billing/plans` → wrapped response in `{ data, meta }` for hook compatibility
- `GET /api/v4/billing/subscription` → wrapped in `{ data }`
- `GET /api/v4/billing/invoices` → wrapped in `{ data, pagination }`

**Mock before → after:**
- Zones: 5 hardcoded zone objects → `useApiList('/api/v4/zones')`, 0 mock remaining
- Billing: hardcoded plan name/price/date + fallback arrays + hardcoded card → all from API, 0 mock remaining

**Build:** ✅ Next.js build passes  
**Lint:** ✅ Passes  

### WIT-340 (prior)
**Pages:** Analytics, Orders board  
**Map views:** Orders map with markers  

---

## Next Priority
1. **Demand / heatmap page** — geographic, likely mock
2. **Locations page** — geographic, likely needs map
3. **Finance / Invoices** — financial pages
4. **Field Service dispatch** — geographic
5. **CRM** — customer-facing
