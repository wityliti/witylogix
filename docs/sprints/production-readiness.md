# Dashboard Production-Readiness Tracker

Last updated: 2026-06-08

## Legend
- ✅ Done — real API, loading/empty/error states, map where applicable
- 🔄 In PR — open PR, awaiting merge
- ⬜ Todo
- ❌ Skipped / N/A

---

## Completed Sections

| Section | Pages | Map? | PR | Notes |
|---------|-------|------|----|-------|
| Auth | Login, Register, Forgot Password | — | merged | — |
| Home | Dashboard home/overview | — | merged | — |
| Admin | Platform admin panel | — | merged | — |
| ELD | Electronic logging | — | merged | — |
| Integrations | All integration pages | — | merged | — |
| Settings | All settings pages | — | merged | — |
| Dispatch | Dispatch command centre | ✅ | merged | WLMap, driver/order markers |
| Routes | Route management | ✅ | merged | — |
| Shipments | Shipment tracking | ✅ | merged | — |
| Fleet | Fleet management | — | merged | — |
| Analytics | Overview + Zone map | ✅ | merged (WIT-340) | ZoneHeatLayer |
| Orders | Orders board + list | — | merged (WIT-340) | real API |
| **Zones** | Zone management + map | ✅ | WIT-341 | Real API, polygon/circle layer |
| **Drivers** | Driver list + map | ✅ | WIT-341 | Real API, driver pin layer |

---

## Remaining (prioritised)

| Section | Pages | Priority | Geographic? |
|---------|-------|----------|-------------|
| Customers | List, detail, map-by-area | HIGH | ✅ |
| Deliveries | Delivery board + map | HIGH | ✅ |
| Notifications | Inbox (needs API) | HIGH | — |
| Billing | Plans, invoices (needs API) | HIGH | — |
| Campaigns | List, detail | MEDIUM | — |
| Finance | Revenue, expenses | MEDIUM | — |
| CRM | Contacts, pipelines | MEDIUM | — |
| Field Service | Jobs + dispatch map | MEDIUM | ✅ |
| Demand | Heatmap | MEDIUM | ✅ |
| Returns | Return management | LOW | — |
| Inventory | Stock management (API needed) | LOW | — |
| Support | Ticket system (API needed) | LOW | — |

---

## API Endpoints Added This Sprint

| Endpoint | Change |
|----------|--------|
| `GET /api/v4/zones` | Added `centerLat`, `centerLng`, `boundaryGeoJson` via PostGIS raw SQL |
| `GET /api/v4/drivers` | Added `lat`, `lng` from `current_location` via PostGIS raw SQL |

## Map Components Added This Sprint

| Component | Location | Used By |
|-----------|----------|---------|
| `ZonePolygonLayer` | `components/map/zone-polygon-layer.tsx` | Zones page |
| `DriverLiveLayer` | `components/map/driver-live-layer.tsx` | Drivers page |

