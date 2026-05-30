# Dashboard Production-Readiness Tracker

Tracks the elimination of all mock/dummy/placeholder/hardcoded data from `apps/dashboard`.
Scan command: `grep -rniE "mock|dummy|sampleData|hardcoded|fake|lorem" <path> --include="*.tsx" | grep -v "placeholder=|__tests__|\.test\."`.

**Total pages**: ~204 (excluding design-system, stories)
**Total mock signals (baseline)**: ~486

---

## Status Legend
- ✅ **Done** — 0 mock signals, real API wired
- 🔄 **In-Progress** — current sprint
- ⬜ **Pending** — not started
- ⚙️ **No-API-Key** — gated behind missing env key (Stripe/Twilio/maps)

---

## Auth (0 mock signals)
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Login | `/login` | 0 | 0 | ✅ |
| Register | `/register` | 0 | 0 | ✅ |
| Forgot Password | `/forgot-password` | 0 | 0 | ✅ |
| Magic Link | `/magic-link` | 0 | 0 | ✅ |
| Reset Password | `/reset-password` | 0 | 0 | ✅ |

---

## Home / Dashboard Overview (3 → 0 mock signals)
| Page | Route | Mock Before | Mock After | Status | PR |
|------|-------|------------|-----------|--------|----|
| Dashboard Home | `/home` | 3 | 0 | 🔄 WIT-462 | #TBD |
| Activity Feed | `/activity` | 2 | — | ⬜ | — |
| Realtime Activity | `/activity/realtime` | 0 | — | ⬜ | — |

**Endpoints used**: `GET /api/v4/dashboard/stats`, `GET /api/v4/orders?limit=5`, `GET /api/v4/drivers?limit=8`

---

## Orders (1 mock signal — 8 pages total)
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Order List | `/orders` | 0 | 0 | ✅ |
| Order Detail | `/orders/[id]` | 2 | — | ⬜ |
| Order Board | `/orders/board` | 1 | — | ⬜ |
| Order Import | `/orders/import` | 3 | — | ⬜ |
| Order Create | `/orders/create` | 0 | — | ⬜ |
| Order Bulk | `/orders/bulk` | 0 | — | ⬜ |
| Order Conflicts | `/orders/conflicts` | 0 | — | ⬜ |
| Order Local | `/orders/local` | 0 | — | ⬜ |

---

## Shipments (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Shipment List | `/shipments` | 0 | ✅ |
| Shipment Detail | `/shipments/[id]` | 0 | ✅ |

---

## Delivery (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Delivery Overview | `/delivery` | 0 | ✅ |
| Standard Delivery | `/delivery/standard` | 0 | ✅ |

---

## Customers (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Customer List | `/customers` | 0 | ✅ |
| Customer Create | `/customers/create` | 0 | ✅ |

---

## Drivers (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Driver List | `/drivers` | 0 | ✅ |
| Driver Detail | `/drivers/[id]` | 0 | ✅ |
| Driver Create | `/drivers/create` | 0 | ✅ |
| Driver Performance | `/drivers/performance` | 0 | ✅ |

---

## Routes (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Routes List | `/routes` | 0 | ✅ |
| Route Detail | `/routes/[id]` | 0 | ✅ |
| Route Plan | `/routes/plan` | 0 | ✅ |
| Route Create | `/routes/create` | 0 | ✅ |
| Route Assign | `/routes/[id]/assign` | 0 | ✅ |
| Route Edit | `/routes/[id]/edit` | 0 | ✅ |

---

## Dispatch (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Dispatch | `/dispatch` | 0 | ✅ |
| Couriers | `/dispatch/couriers` | 0 | ✅ |

---

## Fleet (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Fleet Overview | `/fleet` | 0 | ✅ |
| Vehicles | `/fleet/vehicles` | 0 | ✅ |
| Vehicle Detail | `/fleet/vehicles/[id]` | 0 | ✅ |
| Fuel | `/fleet/fuel` | 0 | ✅ |
| Maintenance | `/fleet/maintenance` | 0 | ✅ |

---

## Analytics (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Analytics Overview | `/analytics` | 0 | ✅ |
| Dashboards | `/analytics/dashboards` | 0 | ✅ |
| ETA Accuracy | `/analytics/eta-accuracy` | 0 | ✅ |
| Reports | `/analytics/reports` | 0 | ✅ |
| Route Performance | `/analytics/route-performance` | 0 | ✅ |

---

## AI Features (9 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| AI Overview | `/ai` | 0 | ✅ |
| Route Efficiency | `/ai/route-efficiency` | 9 | ⬜ |
| Copilot | `/ai/copilot` | 0 | ✅ |
| Driver Insights | `/ai/driver-insights` | 0 | ✅ |
| Slot Optimizer | `/ai/slots` | 0 | ✅ |

---

## Invoices / Finance (5 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Invoice List | `/invoices` | 0 | ✅ |
| Invoice Detail | `/invoices/[id]` | 2 | ⬜ |
| Invoice Create | `/invoices/create` | 3 | ⬜ |
| Finance Overview | `/finance` | 0 | ✅ |
| COD | `/finance/cod` | 0 | ✅ |
| Finance Invoices | `/finance/invoices` | 0 | ✅ |
| Reconciliation | `/finance/reconciliation` | 0 | ✅ |

---

## Billing / Payments (1 mock signal)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Billing | `/billing` | 0 | ✅ |
| Payments | `/payments` | 1 | ⬜ |

---

## Settings (8 mock signals — 16 pages total)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Settings Overview | `/settings` | 0 | ✅ |
| General | `/settings/general` | 0 | ✅ |
| Team | `/settings/team` | 0 | ✅ |
| Profile | `/settings/profile` | 0 | ✅ |
| Organization | `/settings/organization` | 0 | ✅ |
| Notifications | `/settings/notifications` | 0 | ✅ |
| Notifications Config | `/settings/notifications-config` | 0 | ✅ |
| Notification Templates | `/settings/notifications/templates` | 0 | ✅ |
| Notification Template Detail | `/settings/notifications/templates/[id]` | 0 | ✅ |
| Notifications WhatsApp | `/settings/notifications/whatsapp` | 0 | ✅ |
| Auth Providers | `/settings/auth-providers` | 2 | ⬜ |
| Payments | `/settings/payments` | 3 | ⬜ |
| Billing | `/settings/billing` | 2 | ⬜ |
| Carriers | `/settings/carriers` | 0 | ✅ |
| API Keys | `/settings/api-keys` | 0 | ✅ |
| Accounting | `/settings/accounting` | 0 | ✅ |
| Branding | `/settings/branding` | 0 | ✅ |
| Maps | `/settings/maps` | 0 | ⚙️ |
| Preferences | `/settings/preferences` | 0 | ✅ |
| Webhooks | `/settings/webhooks` | 1 | ⬜ |
| Webhooks Test | `/settings/webhooks/test` | 0 | ✅ |

---

## Integrations (11 mock signals — 25 pages total)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Integrations Overview | `/integrations` | 0 | ✅ |
| Overview | `/integrations/overview` | 0 | ✅ |
| Catalog | `/integrations/catalog` | 0 | ✅ |
| Marketplace | `/integrations/marketplace` | 0 | ✅ |
| Marketplace Provider | `/integrations/marketplace/[providerId]` | 0 | ✅ |
| Connected | `/integrations/connected` | 0 | ✅ |
| **Connected Provider** | `/integrations/connected/[providerId]` | **8** | ⬜ |
| Routing | `/integrations/routing` | 2 | ⬜ |
| Health | `/integrations/health` | 1 | ⬜ |
| Credentials | `/integrations/credentials` | 0 | ✅ |
| Ecommerce | `/integrations/ecommerce` | 0 | ✅ |
| Payments | `/integrations/payments` | 0 | ✅ |
| Shipping | `/integrations/shipping` | 0 | ✅ |
| Analytics | `/integrations/analytics` | 0 | ✅ |
| CRM | `/integrations/crm` | 0 | ✅ |
| ERP | `/integrations/erp` | 0 | ✅ |
| Messaging | `/integrations/messaging` | 0 | ✅ |
| Webhooks | `/integrations/webhooks` | 0 | ✅ |
| Others | all others | 0 | ✅ |

---

## ELD (9 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| ELD Overview | `/eld` | 7 | ⬜ |
| DVIR | `/eld/dvir` | 2 | ⬜ |
| HOS | `/eld/hos` | 0 | ✅ |

---

## Activity / Events (2 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Activity | `/activity` | 2 | ⬜ |
| Realtime | `/activity/realtime` | 0 | ✅ |
| Events | `/events` | 0 | ✅ |

---

## Products (3 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Product List | `/products` | 0 | ✅ |
| Product Sync | `/products/sync` | 3 | ⬜ |

---

## Returns (3 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Returns | `/returns` | 3 | ⬜ |

---

## Supply Chain (3 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Supply Chain Overview | `/supply-chain` | 0 | ✅ |
| SC Inventory | `/supply-chain/inventory` | 2 | ⬜ |
| SC Orders | `/supply-chain/orders` | 1 | ⬜ |

---

## Healthcare (6 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Healthcare Overview | `/healthcare` | 0 | ✅ |
| Patients | `/healthcare/patients` | 0 | ✅ |
| Records | `/healthcare/records` | 6 | ⬜ |

---

## Admin (105 mock signals — highest priority after home)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Admin Overview | `/admin` | 0 | ✅ |
| **Shops Detail** | `/admin/shops/[id]` | **36** | ⬜ |
| **Test Dashboard** | `/admin/test-dashboard` | **23** | ⬜ |
| **Queue Monitor** | `/admin/queues` | **16** | ⬜ |
| **Integrations** | `/admin/integrations` | **9** | ⬜ |
| System | `/admin/system` | 8 | ⬜ |
| API Docs | `/admin/api-docs` | 6 | ⬜ |
| Users | `/admin/users` | 2 | ⬜ |
| Customers | `/admin/customers` | 2 | ⬜ |
| Activity | `/admin/activity` | 0 | ✅ |
| Audit | `/admin/audit` | 0 | ✅ |
| Workflows | `/admin/workflows` | 0 | ✅ |
| Workflows Detail | `/admin/workflows/[id]` | 2 | ⬜ |
| Design System | `/admin/design-system` | 0 | ✅ |

---

## Misc / No-API-Key Gated
| Section | Pages | Status |
|---------|-------|--------|
| Map | `/map` | ⚙️ (requires maps key) |
| Campaigns | `/campaigns` | ✅ |
| Notifications | `/notifications` | ✅ |
| CRM | `/crm` | ✅ |
| Collaboration | `/collaboration` | ✅ |
| POS | `/pos` | ✅ |
| Locations | `/locations` | ✅ |
| Zones | `/zones` | ✅ |
| Profile | `/profile` | ✅ |
| Stores | `/stores` | ✅ |
| Partners | `/partners` | ✅ |

---

## Sprint Log

| Sprint | Branch | Section | Pages Wired | Endpoints Added | Mock Before→After | PR |
|--------|--------|---------|-------------|-----------------|-------------------|----|
| WIT-462 | `feat/WIT-462-dashboard-home-production` | Home / Dashboard | `home/page.tsx` | none (existing endpoints) | 3→0 | #TBD |

---

## Summary by Priority

| Priority | Section | Mock Signals | Complexity |
|----------|---------|-------------|-----------|
| 1 | **Home (this sprint)** | 3→0 | Low |
| 2 | Admin (shops/[id], test-dashboard, queues) | 105 | High |
| 3 | ELD (overview + DVIR) | 9 | Medium |
| 4 | AI route-efficiency | 9 | Medium |
| 5 | Integrations (connected provider, routing) | 11 | Medium |
| 6 | Healthcare records | 6 | Low |
| 7 | Invoices (detail + create) | 5 | Low |
| 8 | Settings (auth-providers, payments, billing, webhooks) | 8 | Low |
| 9 | Returns, Products sync | 6 | Low |
| 10 | Supply-chain | 3 | Low |
| 11 | Activity feed | 2 | Low |
| 12 | Orders (detail, board, import) | 6 | Medium |
