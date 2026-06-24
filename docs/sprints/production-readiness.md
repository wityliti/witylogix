# Dashboard Production Readiness

Source of truth for sprint progress. One section per PR, marked ✅ when merged green.

## Legend
- ✅ Done (merged, green CI)
- 🔄 In progress
- ⬜ Pending

| WIT | Section | Pages | Map Views | Endpoints Wired/Added | Mock Before→After | Notes |
|-----|---------|-------|-----------|-----------------------|-------------------|-------|
| WIT-355 | Tracking Live + Admin System + ELD DVIR + Activity Feed | tracking/live, admin/system, eld/dvir, activity/ | WLMap + DeliveryMarkerLayer on tracking/live (city-geocoded order markers, list/map toggle, status colours, auto-fit) | /api/v4/eld (new file: compliance, violations, events, drivers/:id/hos, dvir, dvir POST, dvir/history), /api/v4/admin/system-health (new — real process metrics + DB/Redis latency) | mockServices (6 hardcoded services) + mockMetrics (cpuUsage:42, memoryUsage:68, activeConnections:3542) + MOCK_INSPECTION_HISTORY (2 hardcoded inspections) + generateMockEvents (dead fn returning []) + fake live-event generator → 0 | Introduced WLMap (keyless CARTO Leaflet) + DeliveryMarkerLayer in components/map/; fixed hooks-after-return violation in activity/page; activity live mode now calls real refetch every 30s |

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

Sections not yet in tracker (activity, collaboration done in WIT-354). Remaining uncovered sections (no mock data found in survey): collections/, events/, inventory/, esignatures/, support/ (FAQs are static documentation content, tickets on real API). No mock data blocking production.

| Section | Pages | Geographic? | Notes |
|---------|-------|-------------|-------|
| ⬜ Admin Shops Detail | admin/shops/[id] | No | 36 mock refs — mockShopDetail, mockBillingHistory, mockActivityLog |
| ⬜ Admin System (done WIT-355) | admin/system | No | ✅ Done |
| ⬜ Integrations Connected | integrations/connected/[providerId] | No | 7 mock vars — mockUsageMetrics, mockActivityLog, mockErrors |
| ⬜ ELD HOS | eld/hos | No | Uses real API already; may need shape normalization |
| ⬜ Finance Invoices List | finance/invoices | No | Check for any remaining mock/hardcoded data |
| ⬜ Analytics Route Performance | analytics/route-performance | ✅ Yes | Already on real API; add route map layer |
| ⬜ Analytics Reports | analytics/reports | No | Already on real API; verify shapes |
| ⬜ Analytics Dashboards | analytics/dashboards | No | Already on real API |
| ⬜ Settings Auth Providers | settings/auth-providers | No | mockProviders (2 refs) |
| ⬜ Settings Billing | settings/billing | No | mockInvoices fallback |
| ⬜ Settings Payments | settings/payments | No | mockGatewayConfigs fallback |
| ⬜ Admin Workflows Detail | admin/workflows/[id] | No | MOCK_EXECUTION |
| ⬜ Tracking (main page) | tracking/ | No | Check for mocks |
| ⬜ Collections | collections/ | No | 1 mock ref |
| ⬜ Notifications Stats Widget | components/notifications | No | MOCK_DAILY_STATS, MOCK_CHANNEL_BREAKDOWN, MOCK_FAILED_TEMPLATES |
| ⬜ Realtime Components | components/realtime/ | No | mockDrivers, mockDeliveries, mockOrders, mockNotifications, mockMetrics (active-delivery-map, live-order-feed, notification-center, live-kpi-counters) |
| ⬜ Analytics Widget | components/analytics/analytics-widget | No | mockMetricData, mockChartData, mockPieData, mockTableData |

### WIT-400 · Orders cluster — `feat/WIT-400-dashboard-orders-map`
**Status:** 🔄 In progress  
**Branch:** `feat/WIT-400-dashboard-orders-map`

- `apps/dashboard/src/components/map/wl-map.tsx` — keyless Leaflet + CARTO dark basemap, no API key (WIT-355)
- `apps/dashboard/src/components/map/delivery-marker-layer.tsx` — status-coloured delivery dot markers, popup, auto-fit bounds (WIT-355)

**Infrastructure added:**
- `apps/dashboard/src/components/map/wl-map.tsx` — keyless CARTO map foundation using Leaflet
- `apps/dashboard/src/components/map/use-fit-bounds.ts` — auto-fit bounds hook
- `apps/dashboard/src/components/map/use-geocoder.ts` — Nominatim geocoder with in-memory cache
- `apps/dashboard/src/components/map/order-layer.tsx` — status-coloured order markers on map

| Check | Status |
|-------|--------|
| `pnpm --filter @witylogix/dashboard build` | ✅ |
| `pnpm --filter @witylogix/dashboard typecheck` | ✅ |
| `pnpm lint` | ✅ |
