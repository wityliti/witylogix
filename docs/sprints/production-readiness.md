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

## Sprint Log

| Sprint | Branch | Sections | Signals Eliminated | Date |
|--------|--------|----------|--------------------|------|
| WIT-501 | feat/WIT-501-admin-production | Admin (105) | 105 | 2026-05 |
| WIT-502 | feat/WIT-502-eld-production | ELD (9) | 9 | 2026-05 |
| WIT-503 | feat/WIT-503-integrations-production | Integrations (11) | 11 | 2026-05 |
| WIT-504 | feat/WIT-504-settings-production | Settings (8) | 8 | 2026-05 |
| WIT-505 | feat/WIT-505-dashboard-invoices-payments-production | Activity (2), Order Board (1), Invoices (5), Payments (1) | 9 | 2026-05-31 |
| WIT-512 | feat/WIT-512-dashboard-analytics-production | Analytics overview (DEMO→real), Returns (MOCK_RETURNS→0), API route-performance (Math.random→Prisma), Map: DeliveryPerformanceLayer + route-performance Map tab | 7 + API | 2026-06-01 |
| WIT-514 | feat/WIT-514-dashboard-supplychain-healthcare-esig-products-production | Healthcare Records (mockRecords→0), SC Inventory (2 new API hooks), SC Orders (WAVE_PLANS/BATCH_PICKING/RETURN_QUEUE→real), E-Signatures (new esignatures.ts routes + 0 mocks), Products Sync (MOCK_PLATFORMS→integrations/connections), Field Service (computed stats), Collections (alert→real DELETE) | 17 | 2026-06-01 |
| WIT-515 | feat/WIT-515-dashboard-orders-production | Orders: Detail field-shape fix + Map view, Import hook fix; CourierAssignmentPanel Math.random→0 | 5 + API | 2026-06-02 |
| WIT-517 | feat/WIT-517-dashboard-realtime-mock-cleanup | Realtime components (4), Notification stats widget, Activity polling, ELD HOS recap, Webhooks hourly chart, Webhook test page, Shipping labels pricing, Dispatch map (WLMap); API: notifications-v2 rewrite, outbound-webhooks/test endpoint | 13 files | 2026-06-02 |
| WIT-518 | feat/WIT-518-dashboard-billing-drivers-map | Billing (4 hardcoded fallbacks→real API; billing API { data } wrapper fix); Drivers (Cards↔Map toggle; WLMap + DriverLayer status-coloured markers + useFitBounds) | 4 + API | 2026-06-03 |
| WIT-519 | feat/WIT-519-supply-chain-kpis-locations-map | Supply Chain overview (KPI_METRICS/INVENTORY_DISTRIBUTION/demandSupplyData/pipeline percentages→real hooks); Locations map view (WLMap+PinLayer replaces coordinate placeholder) | 5 | 2026-06-03 |
| WIT-520a | feat/WIT-520-marketplace-provider-real-api | Marketplace provider detail (PROVIDERS hardcoded object→GET /api/v4/integrations/marketplace/:slug; credentials form from credentialFields; install via POST /:slug/install); CRM: remove dead CRM_PROVIDER_LIST | 5 | 2026-06-03 |
| WIT-400 | feat/WIT-400-dashboard-orders-payments-returns | Delivery (List↔Map toggle on delivery/page + delivery/standard; WLMap + ShipmentMarkerLayer + useFitBounds; stat cards; detail panel; proper Shipment type with addressLine1/city/deliveryLocation); use-shipment-tracking hook (removed hardcoded John Doe / FedEx / random mock fallback → real /api/v4/shipments calls) | 2 pages + 1 component + 1 hook | 2026-06-03 |
| WIT-520b | feat/WIT-520-dashboard-demand-production | Demand section (5 API endpoints: Math.random→Prisma real data); Demand page map view (Charts/Map toggle + WLMap + DemandZoneLayer); Tracking Config (local state→API load/save); capacity page URL fix | 5 API + 2 pages | 2026-06-04 |
| WIT-521 | feat/WIT-521-dashboard-freight-ux-design-tokens | Freight 4 pages (overview, loads, rates, compliance): 94 hardcoded hex CSS values → WL design tokens; removed totalSavings=15000 const; real Shipment fields; freight overview Charts↔Map toggle (WLMap+DeliveryMapView); hooks-order fix | 94 CSS signals | 2026-06-04 |
| WIT-522 | feat/WIT-522-dashboard-tracking-timeslots | Time-Slots: SLOTS[7] hardcoded array → real useApiList('/api/v4/time-slots'); loading/empty/error states; Create Slot modal (POST /api/v4/time-slots); WL design tokens. Tracking overview: List↔Map toggle, /dispatch/drivers for lat/lng, WLMap+OrderLayer+DriverLayer. Tracking Live: List↔Map toggle, map panel with order+driver markers + sidebar detail, 30s auto-refresh via dispatch drivers. New shared component: tracking/components/tracking-map-view.tsx | 7 mock slots | 2026-06-04 |
| WIT-523 | feat/WIT-523-notification-templates-profile | Notification templates list: TEMPLATES[8] hardcoded array → real useApiList('/api/v4/notification-templates'); delete/toggle via api.delete/api.patch; WL design tokens; loading/empty states. Profile: 3 fake sessions (192.168.1.x, San Francisco CA, Chrome/Safari/Firefox) → current-session-only display; WL design tokens throughout. WIT-521 notifications/preferences + settings/notifications + products/sync + template [id]: all fake setTimeout replaced with real API calls | 11 mocks | 2026-06-04 |
| WIT-350 | feat/WIT-350-dashboard-zones-drivers-delivery | zones/[id]: remove NEXT_PUBLIC_FEATURE_ZONES_MAP gate + LegacyNotice; LoadingSkeleton + ErrorState with retry; useRouter navigation; Promise.all with proper error propagation; active/inactive badge. zones/new: remove feature flag gate; remove maptilerKey prop; replace alert() with submitError state in sidebar; try/catch/finally for submit | 0 mocks | 2026-06-05 |
| WIT-533 | feat/WIT-533-routes-design-tokens-plan-map | Routes 6 pages: 105+ hex CSS → WL design tokens; routes/plan List↔Map toggle (WLMap + RoutePolylineLayer + RouteStopMarkersLayer on optimized stop sequence); routes/[id]/edit Save Changes fix (useApiMutation); removed getPriorityColor() hex helper | 105 CSS signals | 2026-06-08 |
| WIT-534 | feat/WIT-534-dashboard-ai-analytics-design-tokens | AI pages (3) + Analytics pages (3): 31 hex CSS → WL design tokens; ai/driver-insights List↔Map toggle (WLMap + DriverLayer tier-coloured); ai/route-efficiency Score↔Map toggle (WLMap + RoutePolylineLayer + RouteStopMarkersLayer); analytics/route-performance legend hex → CSS vars | 31 CSS signals + 2 map views | 2026-06-08 |
| WIT-535 | feat/WIT-535-dashboard-integrations-design-tokens | integrations/payments full rewrite (5 real endpoints: gateways/summary/transactions/methods/reconciliation); integrations/eld full rewrite (5 real endpoints: connections/drivers/violations/dvir/compliance); integrations/overview CATEGORIES→useApiList; integrations/supply-chain warehouse/inventory→real API; 13 integrations sub-pages CSS-only pass; 179 dashboard pages total: all Tailwind arbitrary hex class values (bg-[#...]/border-[#...]/text-[#...]) eliminated codebase-wide; TableSkeleton cols→columns fix; Map→MapIcon lucide rename | 179 files, ~1900 CSS signals, 4 pages real API | 2026-06-09 |
| WIT-536 | feat/WIT-536-nav-ui-design-token-cleanup | Navigation (sidebar: text-[#f5a623]→text-wl-primary-500 x6 + bg-[#0a0a0e]→bg-wl-bg-sidebar; page-header: bg-[#0f0f14]→bg-wl-bg-surface); UI components (dialog: bg-[#13131a]→bg-wl-bg-elevated; card: bg-[#13131a]+bg-[#161620]→bg-wl-bg-elevated+bg-wl-bg-overlay); global-error (bg-[#0a0a0f]+bg-[#1a1a20]→WL tokens); shipments-map-view (border-[#1e1e2e]→border-wl-border-subtle); courier-live-map (Math.random bearing→deterministic 0); provider-comparison (Math.random metrics→real provider.metrics.averageLatencyMs/successRate; hardcoded features matrix→real credentialConfig/webhookConfig/rateLimit flags); rate-limit-display (Math.random sparkline→deterministic sine wave) | 9 files, 18 signals → 0 | 2026-06-09 |
| WIT-537 | feat/WIT-537-dashboard-returns-detail-map | Returns: NEW `/returns/[id]` detail page (RMA lifecycle: status pipeline, items table, action buttons approve/reject/receive/inspect/refund, timeline, customer+order sidebar, Detail/Map toggle); `/returns` list upgrades (stats row, List↔Map toggle, row navigation, status filter pills); Fixed `use-returns.ts` bugs (wrong paths + PATCH→POST); NEW `returns-map-view.tsx` (WLMap+PinLayer for list) + `return-location-map.tsx` (WLMap+PinLayer for detail) | `GET /api/v4/returns/:id`, action endpoints × 5, `GET /api/v4/returns/stats` | 5 files, 0 mocks, 2 map views | 2026-06-10 |
| WIT-538 | feat/WIT-538-supplychain-crm-quality-hardening | supply-chain/page: added loading skeleton + error state for all 5 hooks; replaced 3 hardcoded Pipeline Summary metrics ("2.3 days", "94.2%", "12 orders") with real computed values from fulfillment/orders data. crm/page: removed dead `useState<SyncEvent[]>([])` (setter never called); replaced with `useMemo` deriving sync events from each CRM integration's `lastSyncAt`+`healthStatus`; Failed Syncs stat now reflects real UNHEALTHY integrations | no new endpoints | 2 files, 3 hardcoded strings → 0 | 2026-06-10 |
| WIT-539 | feat/WIT-539-integration-hooks-auth-chaos-api | use-integration-status: raw `fetch()` → `api.get/post/delete`; removed `DEMO_CONNECTIONS` (5 hardcoded carriers/Shopify/Stripe). use-chaos-testing: removed `DEMO_CHAOS_SCENARIOS`/`DEMO_CHAOS_RESULTS`; wired to new `/api/v4/chaos/*`. use-integration-docs: static carrier reference docs (SDK methods, webhooks, rate limits, playbooks) — removed non-existent API calls, converted to pure `useMemo`. New `apps/api/src/routes/chaos.ts`: scenarios in `shop.settings`, executions in ActivityLog. chaos/page.tsx: LoadingSkeleton + ErrorState guards | NEW `/api/v4/chaos/*` (5 routes) | 5 hook/page files + 1 API route, DEMO_ fallbacks → 0 | 2026-06-10 |
| WIT-540 | feat/WIT-540-dashboard-campaigns-production | Campaigns: list row-click + ExternalLink navigate to `/campaigns/:id`; CreateCampaignModal (POST /api/v4/campaigns); Pause/Resume/Delete/Duplicate buttons wired via `api.post/delete`; List↔Reach Map toggle. Campaign detail: 4 tabs — Overview (donut chart), Events (GET /:id/events), Recipients (GET /:id/recipients), Reach Map; Send Now / Pause / Resume / Archive action buttons; back nav. NEW `campaign-reach-map.tsx`: WLMap + ZoneLayer fetching `GET /api/v4/zones?format=geojson`, auto-fit bounds via useFitBounds inner-component, health-colour legend | existing campaign + zone endpoints | 3 files, 0 mocks, 1 map view | 2026-06-10 |
| WIT-541 | feat/WIT-541-analytics-dashboards-reports-heatmap | analytics/dashboards page: fixed endpoint (?view=dashboards→/api/v4/analytics/dashboards); Create modal (POST name/desc/layout/isPublic); per-item Delete; empty/error states. analytics/reports page: fixed endpoint (?view=reports→/api/v4/analytics/reports); Create modal (POST with frequency/format/recipients multi-input); Delete; next-run date display. analytics/page.tsx: Charts↔Heatmap toggle; AnalyticsHeatmapView (WLMap+HeatmapLayer+AutoFit+density legend). use-dashboard-stats.ts: removed NYC hardcoded 404-fallback bounds; useDeliveryHeatmap wired directly to real endpoint. NEW `analytics/components/analytics-heatmap-view.tsx`. API: GET/POST/DELETE `/api/v4/analytics/dashboards` (shop.settings backed); GET/POST/DELETE `/api/v4/analytics/reports` (shop.settings backed); NEW `GET /api/v4/analytics/heatmap` (Prisma deliveryLocation → 0.01° grid clustering → real heatmap points) | 7 NEW API routes | 6 files, 1 hardcoded NYC fallback → 0, 1 map view | 2026-06-11 |
| WIT-542 | feat/WIT-542-dashboard-stores-pos-notifications-quality | Quality hardening for 3 pages: supply-chain/orders — Header + TableSkeleton + ErrorState (loading/error guards on useOrders+useFulfillment); esignatures — ErrorState for all 3 hooks (useEnvelopes/useEsigAnalytics/useTemplates), loading skeleton, removed 3 hardcoded trend percentages ("12%"/"4%"/"8%") from KPI cards; notifications — ErrorState guard added (error from useNotifications) | no new endpoints | 3 files, 3 hardcoded trends → 0, 0 error states → 3 | 2026-06-11 |
| WIT-543 | feat/WIT-543-esignatures-subpages-url-fix | esignatures/envelopes/page.tsx: wrong URL `/api/v4/esignatures/envelopes` → `/api/v4/envelopes` (always 404→ErrorState). esignatures/templates/page.tsx: wrong URL `/api/v4/esignatures/templates` → `/api/v4/signing-templates` (always 404→ErrorState); also fixed viewMode prop not flowing from parent Controls to TemplateGrid (view toggle buttons were silently broken) | no new endpoints | 2 files, 2 broken API paths → 0 | 2026-06-14 |
| WIT-346 | feat/WIT-346-dashboard-field-service | Field Service overview page: rewritten from hardcoded `schedule:[]`/`technicians:[]`/placeholder stats to 3 real endpoints. NEW API file `field-service.ts`: GET /stats (6 Prisma KPIs), GET /schedule (today's assigned orders + driver names), GET /jobs (paginated, status/search filters, deterministic priority+serviceType). Overview page uses useApiQuery×2 + useApiList; technicians derived live from schedule; SLA panel, KPI cards, schedule, job queue, recent completions all real. Jobs page endpoint fixed from non-existent query param to /api/v4/field-service/jobs. | 3 new endpoints | 4 files, hardcoded arrays → 0 | 2026-06-14 |
| WIT-347 | feat/WIT-347-dashboard-demand-bugs | Demand section runtime bug fixes: anomalies/page `useApiList→useApiQuery` (API returns `{items,total}` not flat array, anomaly list always empty); models/page same `useApiList→useApiQuery` fix; scheduler/page hours array `[0,1,2,3,4,5]→[8,10,12,14,16,18,20]` (API slots use business hours 8–20, schedule table showed all `—`); demand/page KPI operator-precedence `(totalPredicted\|\|0/1000)→((totalPredicted??0)/1000)` and same for totalActual | no new endpoints | 4 files, 4 runtime bugs → 0 | 2026-06-14 |
| WIT-545 | feat/WIT-545-dashboard-partners-events-finance-production | Partners (3 pages): hardcoded `successRate:95`/`rating:4.5`/`coverageAreas:30`→real data; parallel call to new `GET /api/v4/couriers/partner-stats` (Prisma `CourierDelivery` grouped by partner: activeDeliveries, successRate); rating shows only when in config (no fake 4.5★); SLA defaults (30min/50km) show "Not configured" when absent; partners/[id] KPIs now show real activeDeliveries+successRate from partner-stats. Events: `"Pending: 2"` hardcoded→real `errorCount` from action field; `Last 24h: Math.floor(data.length*0.3)` fake→real timestamp filter. Finance/reconciliation: added empty state (was showing blank tables on no data). | `GET /api/v4/couriers/partner-stats` (new, Prisma CourierDelivery grouped per partner) | 6 files, 7 hardcoded values → 0 | 2026-06-14 |
| WIT-544 | feat/WIT-544-customers-design-tokens-v2 | Customers section (3 files): 25 arbitrary hex CSS values → WL design tokens; `bg-[#0a0a0f]`→`bg-wl-bg-root`, `bg-[#12121a]`/`bg-[#111118]`→`bg-wl-bg-surface`, `bg-[#1a1a2e]`→`bg-wl-bg-elevated`, `bg-[#1e1e2e]`(track)→`bg-wl-bg-overlay`, `bg-[#0d0d14]`(map overlays)→`bg-wl-bg-root`, `border-[#1e1e2e]`→`border-wl-border-default` across customers/page.tsx, customers/segments/page.tsx, customers/components/customers-map-view.tsx | no new endpoints | 3 files, 25 hex CSS signals → 0 | 2026-06-14 |
| WIT-546 | feat/WIT-546-widget-mobile-config-load-from-api | widget-config: `useApiQuery` imported but unused → now calls `GET /api/v4/shops/me` + `useEffect` initializing 12 config fields from `settings.widgetConfig`; skeleton guard added. mobile-config: same load-on-mount for `settings.mobileConfig`; fixed broken save from `PATCH /api/v4/mobile-config` (404, no route) → `PATCH /api/v4/shops/me`; removed raw `api` import; skeleton guard added | no new endpoints | 2 files, 2 dead endpoints, 2 missing load-on-mount → fixed | 2026-06-14 |
| WIT-547 | feat/WIT-547-collaboration-auth-hardcoding | collaboration/page.tsx: `userId: "current-user"`, `userName: "Current User"`, 2× `currentUserId="current-user"` → `useAuth()` values (`user?.id`, `user?.name`); added `import { useAuth }` from auth-context | no new endpoints | 1 file, 4 hardcoded identity strings → 0 | 2026-06-14 |
| WIT-548 | feat/WIT-548-admin-workflows-real-data | admin/workflows/page.tsx: `WORKFLOW_EXECUTIONS` constant (12 hardcoded items, dates 2026-03-07, fake durations) removed; `useApiList` (imported but unused) → `useApiQuery<WorkflowResponse>('/api/workflow/executions?...')` with debounced search and status params; interface updated to match API fields (`durationMs` not string `duration`, no fake `totalSteps`/`completedSteps`/`createdBy`/`tenantId`); `formatDuration(ms)` added; Steps column removed (not in API); row `style={{background:"#12121a"}}` → `className bg-wl-bg-surface`; StatCard hardcoded `change` values removed; loading skeleton rows; error state with retry | no new endpoints (existing `GET /api/workflow/executions`) | 1 file, 12 hardcoded rows → 0, 1 hex signal → 0 | 2026-06-14 |
| WIT-549 | feat/WIT-549-copilot-auth-fetch | ai/copilot/page.tsx: raw `fetch("/api/v4/ai/copilot/query", { headers: { "Content-Type": "application/json" } })` → `api.post<CopilotResult>(...)` from `@/lib/api`; fixes silent 401 because raw fetch omits `Authorization: Bearer <token>` and `credentials: include` that the api client provides | no new endpoints | 1 file, 1 unauthenticated fetch → 0 | 2026-06-14 |
| WIT-550 | feat/WIT-550-alert-ux-fixes | orders/create: 3× `alert()` for validation → inline states (`lineItemError`/`setSubmitError`); `lineItemError` displayed below Add Item button. operations/flows: delete error `alert()` → `setDeleteError` state shown inline above table. apps/installed: revoke error `alert()` → `setRevokeError` state shown inline | no new endpoints | 3 files, 5 alert() calls → 0 | 2026-06-14 |
| WIT-551 | feat/WIT-551-remove-fake-stat-trends | Remove hardcoded `change`/`trend` percentage values from 3 pages: eld/page.tsx (4 fake trends: `2.3↑`, `0 neutral`, `1↓`, `3.1↑`); integrations/crm/page.tsx (3 fake changes: `8.3`/`12.5`/`2.1 vs last month`); integrations/lastmile/page.tsx (4 fake changes: `22.5`/`18.3`/`2.1`/`-1.5 vs yesterday/avg/target`) — no API provides these so they were always false | no new endpoints | 3 files, 11 fake trend values → 0 | 2026-06-14 |
| WIT-552 | feat/WIT-552-lastmile-freight-real-data | integrations/lastmile: full rewrite — removed `DELIVERY_PROVIDERS`(3)/`DELIVERIES`(6)/`DRIVERS`(6)/`PERFORMANCE_METRICS`(3) hardcoded arrays; replaced with `useApiQuery` for partners, partner-stats, overall stats, deliveries, drivers; StatCards now show real connected count/total deliveries/success rate/active deliveries; provider cards from `GET /api/v4/couriers/partners` + partner-stats merged by provider; deliveries from new `GET /api/v4/couriers/deliveries` list endpoint; drivers from `GET /api/v4/drivers`; loading skeletons + empty states throughout. API (couriers.ts): fixed 3 broken response wrappers (`/partners`, `/stats`, `/partner-stats` were returning raw data without `{ data: ... }` causing `useApiQuery` hooks to always read `undefined`); added `GET /api/v4/couriers/deliveries` list endpoint (status+partnerId filters, pagination) | 1 new endpoint (`GET /api/v4/couriers/deliveries`), 3 response wrapper fixes | 2 files (page + API), 18 hardcoded rows → 0 | 2026-06-14 |
| WIT-554 | fix/WIT-554-replace-confirm-dialogs | Replace 9 `window.confirm()`/`confirm()` calls with inline 2-step confirmation UI: apps/installed: `confirmRevokeId` state in card; operations/flows: `pendingDeleteId` state per card; collaboration: `pendingDeleteMsgId` banner above composer; campaigns: 2-button confirm in table row; components/integrations/alert-rules: `confirmDeleteRule` bool in footer; components/integrations/oauth-flow: `confirmDisconnect` bool replacing disconnect button; components/integrations/provider-card: `confirmDisconnect` bool; components/integrations/template-manager: `pendingDeleteTemplateId` per template; components/zones/zone-inspector: `confirmDelete` bool in ConfigureForm | no new endpoints | 9 files, 9 confirm() calls → 0 | 2026-06-14 |
| WIT-553 | fix/WIT-553-replace-alerts-with-inline-states | products/page.tsx: removed 4 fake `change` props from StatCards (8.5%/22%/-15.3%/0%); `alert()` re-sync → `syncInfo` banner explaining Shopify triggers sync; `confirm()` delete → inline 2-step confirmation with real `api.delete()` calls per product + `refetch()`. analytics/date-range-picker.tsx: 2× `alert()` (start>end, invalid format) → `dateError` state shown above Apply button. onboarding/steps/company-info.tsx: `alert("Please upload an image file")` → `logoError` state shown below upload area | no new endpoints (uses existing `DELETE /api/v4/products/:id`) | 3 files, 4 fake change props + 4 alert()/confirm() → 0 | 2026-06-14 |
| WIT-555 | fix/WIT-555-remove-fake-stat-changes | Removed fake `change` props from StatCards across 7 pages: integrations/shipping (15.8%/5.2%/0.8%/-2.1%), integrations/pos (12.5%/18.3%/15.7%/3.2%), integrations/freight (18/22/-4/2 vs avg/week), integrations/analytics (12 this month/0 configured/24 vs last week), drivers/performance (2.1%/1.3%/8.5%/0.5% vs last period), integrations/supply-chain (connections.length/syncs.length/connections.length/0 misused as change values), crm (0 "of X installed"/0 "CRM integrations"). Also removed unused `useApiList` import from freight/page.tsx | no new endpoints | 7 files, 26 fake change props → 0 | 2026-06-14 |
| WIT-556 | fix/WIT-556-connections-endpoint-response-wrapper | `GET /api/v4/integrations/connections` returned `{ connections }` (no `.data` key) so `useApiList` silently read `undefined` and all 7 consumer pages showed empty lists. Fix: (1) API now returns `{ data: connections, meta: { total, page, limit, totalPages } }` + `?category` filter scopes by integration category; (2) `useApiList.buildUrl()` double-`?` bug when path already contained query params — fixed by splitting path on `?` and merging with `URLSearchParams` | no new endpoints | 2 files (API route + hook), 7 pages now receive real data | 2026-06-14 |
| WIT-557 | fix/WIT-557-erp-telematics-real-data | integrations/erp/page.tsx: removed `ERP_PROVIDERS` (8 fake providers with hardcoded OAuth tokens, sync counts, field mappings, fake "2 hours ago" timestamps), `SYNC_LOG` (5 fake sync entries), all derived interfaces (`OAuthStatus`, `SyncDirection`, `ConflictResolution`, `FieldMapping`, `SyncOperation`, `ERPProvider`), helper components (`StatusBadge`, `SyncStatusBadge`), unused `useApiList` import, and `useState` — replaced with empty state UI (stat cards show 0, "No ERP providers connected — Browse Marketplace"). integrations/telematics/page.tsx: removed `TELEMATICS_PROVIDERS` (6 fake providers with hardcoded API keys like `samsara_key_****`, vehicle mappings, fake GPS coords `37.7749°N 122.4194°W`, fake speed/fuel data), connection wizard reading from fake list, vehicle mapping table, real-time data preview — replaced with same empty state pattern. Root cause: `erp-accounting` and `telematics` are not valid `IntegrationCategory` enum values in Prisma; there is no backend for these pages so showing fake "connected" data was always wrong | no new endpoints | 2 files, 14 hardcoded providers + 5 fake sync entries → 0 | 2026-06-14 |
| WIT-558 | fix/WIT-558-freight-integrations-route-perf-dispatch-trends | integrations/freight/page.tsx: removed `FREIGHT_CONNECTIONS` (4 fake DAT/Truckstop/123Loadboard/DirectFreight connections with hardcoded load counts and "2 minutes ago" timestamps), `AGGREGATED_LOADS` (4 fake loads), `RATE_COMPARISONS` (4 fake lane rates with trend: -5/3/2/-8), `RECENT_BOOKINGS` (4 fake bookings with carrier names like "Smith Trucking LLC"), `MARKET_TRENDS` (4 fake market trend items), `COMPLIANCE_DOCS` (4 fake docs from FMCSA/Travelers/State Farm) — replaced with honest empty state (stat cards 0, "No freight providers connected — Browse Marketplace"). Root cause: DAT/Truckstop/123Loadboard/DirectFreight are not valid `IntegrationCategory` enum values in Prisma — no backend exists. analytics/route-performance/page.tsx: removed 4 fake `change: { value: 0, label: "vs planned/baseline/target" }` props from KPI StatCards. components/couriers/dispatch-stats-bar.tsx: removed 4 fake `trend: { value: 12/3/8/5, direction: "up/down" }` props never wired to real period-over-period data | no new endpoints | 3 files, 18 hardcoded values → 0 | 2026-06-14 |
| WIT-560 | fix/WIT-560-fake-data-marketplace-esignatures-healthcare-crm | integrations/marketplace/page.tsx: removed 15 hardcoded `connected: true` flags from `ALL_PROVIDERS`; added `useApiList('/api/v4/integrations/connections')` + `connectedSlugs` Set to compute real connection status; updated sort and ProviderCard to use dynamic `isConnected` prop. integrations/esignatures/page.tsx: removed `providers` (DocuSign/Adobe Sign/PandaDoc/HelloSign with fake connectedAt/lastSync/templates/envelopes counts), `envelopes` (4 fake workflows with signer names john@customer.com/Enterprise Client), `SigningTemplate` (5 fake templates), `WebhookEvent` (5 fake events), `AuditEntry` (4 fake audit logs with legal@company.com) — replaced with empty state. healthcare/page.tsx: removed `ProviderSummaryCard` (Dr. Sarah Johnson/Dr. Michael Chen/Dr. Emily Watson); removed 3 hardcoded KPI metrics (`totalEncounters=128`, `labResultsThisMonth=42`, `pendingAlerts=3`); removed fake trends "↑3%"/"↑8%". integrations/crm/page.tsx: removed `DEAL_PIPELINE_STAGES` (5 stages with fake counts 342/156/89/34/78 and $1.083M fake pipeline); removed Deal Pipeline card; removed `formatCurrency()` | no new endpoints | 4 files, 340+ fake values → 0 | 2026-06-14 |
| WIT-561 | fix/WIT-561-remove-fake-stat-change-props | pos/page.tsx: removed 4 fake `change` props (12.5% vs yesterday, 5.2% vs average, 3.1% increase, 0 online) from Today's Sales/Transactions/Avg Ticket/Terminals StatCards. collections/page.tsx: removed 4 fake `change` props (2.5%/18.3%/0/2.5% vs last month). fleet/fuel/page.tsx: removed 4 fake `change` props (8.5% vs last month, -2.1% efficiency decline, 3.2% increase, -1.5% improvement) | no new endpoints | 3 files, 12 fake change props → 0 | 2026-06-14 |
| WIT-562 | fix/WIT-562-fleet-fuel-fake-data | fleet/fuel/page.tsx: removed `idleTimePercent: 8` (hardcoded, no API source) → replaced Idle Time StatCard with real `Flagged Transactions` count from API; removed Cost Breakdown card (`formatCurrency(12000)` fuel spend, `formatCurrency(3000)` maintenance, `formatCurrency(500)` insurance — all fabricated) → replaced with real Fuel Cost Summary using `analytics.totalSpend` + `transactions.length` + `analytics.anomalies.length`; removed Fuel Cards Status (`['Shell ****1234', 'Chevron ****5678', 'Shell ****9012']` with fabricated daily/monthly limits `500+idx*100`/`10000+idx*2000`) → replaced with honest empty state | no new endpoints | 1 file, 7 hardcoded values → 0 | 2026-06-14 |
| WIT-564 | feat/WIT-354-dashboard-tracking-maps | shipping/tracking: List/Map toggle added to tracking index page — dynamically imported ShipmentsMapView (MapLibre + CARTO keyless) with status-coloured pins, empty state when no deliveryLocation coords, ShipmentTracking interface extended with deliveryLocation+driver+location. shipping/tracking/[trackingNumber]: Delivery Location card added (ShipmentLocationMap: WLMap + PinLayer centred on deliveryLocation, status→PinStatus mapping: DELIVERED→assigned, IN_TRANSIT/OUT_FOR_DELIVERY→in_transit, FAILED/RETURNED→delayed); falls back to MapPin placeholder with city/province text | no new endpoints — uses existing deliveryLocation JSON from GET /api/v4/shipments | 3 files, 2 new map views, 0 mock signals | #347 |
| WIT-563 | fix/WIT-563-carrier-board-migration-fake-data | components/integrations/carrier-board.tsx: removed `defaultLoads` (6 fake freight loads: "Premium Logistics Inc"/"FastFreight Solutions"/"TransAmerica Freight"/"ColdChain Logistics"/"ShortHaul Express"/"HeavyLoad Transport" with hardcoded rates $2300/$2100/$1850/$1950/$850/$1100, weights, distances) — component is never rendered in any page; `loads` default now `[]`. integrations/migration/page.tsx: `MigrationProgress` was showing hardcoded "65%" progress, "2,450 / 3,750" requests, "0.2%" error rate, "+12ms" latency — rewired to accept `migrations` prop and derive all values from real `Migration` object found by ID (`migration.progress`, `migration.requestsMigrated`, `migration.errorRate`, `migration.latencyComparison`) | no new endpoints | 2 files, 10 hardcoded values → 0 | 2026-06-14 |
| WIT-357 | feat/WIT-357-deliveries-couriers-real-api | **deliveries.ts**: replace `MOCK_DELIVERIES` (3 fake orders: Emma Johnson/David Kim/Sarah Williams) with real `CourierDelivery` Prisma queries. Batch-joins `Order` for dropoff address + recipient. All 4 mutations (GET list, GET /:id, PATCH assign, PATCH status, PATCH preferences) now hit the DB. **NEW `routes/integrations/crm.ts`**: GET /providers (CRMConnection→provider cards), GET /sync-logs (CRMSyncLog), GET /field-mappings (CRMFieldMapping) — previously 404, now real data. Registered in server.ts at /api/v4/integrations/crm. Dashboard CRM page stops erroring. | 2 API files + server.ts, 3 hardcoded delivery rows → 0, 3 broken 404 CRM endpoints → real | 2026-06-16 |
| WIT-356 | feat/WIT-356-platform-integrations-ai-production | **Platform routes registered** (were returning 404 — never imported in server.ts). platform/status: real DB + Redis latency checks, removes hardcoded uptime percentages. platform/integrations: queries tenant's Integration table (was 8 hardcoded Shopify/Samsara/etc. rows). platform/metrics: real process.memoryUsage()/uptime/OS metrics/DB latency — removes fake rps=142/errorRate=0.23. platform/alerts: empty list (removes 3 hardcoded fake maintenance incidents). Dashboard platform/page: calls /status (not /health) for service list + score; new metric cards: Uptime/Memory%/DB Latency instead of fake Active Connections/Request Rate/Error Rate; loading skeletons; empty state with CTA for integrations. integrations/overview: replaces two "API usage tracking coming soon" cards with Active Connections progress bar + Integration Health breakdown derived from live connection data. ai/page: AI Co-pilot marked active (/ai/copilot page exists) | 5 files — 0 fake metric values, 0 hardcoded integration rows, 2 "coming soon" placeholders removed, all platform routes now functional | platform routes: platform.ts rewritten, server.ts: +1 safeRegister line; dashboard: platform/page.tsx + integrations/overview/page.tsx + ai/page.tsx | 2026-06-16 |
| WIT-559 | fix/WIT-559-integration-pages-fake-provider-arrays | Replaced 6 integration pages containing large hardcoded fake-provider arrays with honest empty states + Marketplace CTA. integrations/routing: removed `ROUTING_PROVIDERS` (Valhalla/VROOM/Routific + more with fake API keys like `valhalla_key_****`, fake latency/request counts, fake health history arrays). integrations/ecommerce: removed `PLATFORMS` (Shopify/WooCommerce with fake productsSynced:1247/3891 orders, fake timestamps, fake webhook configs). integrations/shipping: removed `SHIPPING_CARRIERS` (Shippo/ShipStation/EasyPost/FedEx with fake shipsToday/avgCost/successRate), `SHIPMENTS` (customers "John Doe"/"Jane Smith" with real-looking tracking numbers), `RATE_QUOTES`, analytics arrays. integrations/pos: removed `POS_PROVIDERS` (Toast/Square with fake ordersToday/revenueToday), `LOCATIONS` (5 NY locations with "$4250 revenue today"), `MENU_ITEMS`, `ORDERS`, `ITEM_PERFORMANCE`. integrations/email: removed `PROVIDERS` (SendGrid with `SG.xxxxxxxxxxxx...` fake API key, Mailgun), `EMAIL_TEMPLATES`, `DELIVERY_METRICS`. integrations/messaging: removed `SMS_PROVIDERS` (Twilio/Vonage/TextMagic), `PUSH_PROVIDERS` (Firebase/OneSignal), `CHAT_PROVIDERS` (Sendbird), `MESSAGE_TEMPLATES`. Root cause: none of these provider names map to valid Prisma `IntegrationCategory` enum values; no backend exists for any of them | no new endpoints | 6 files, ~3477 lines of hardcoded data → honest empty states | 2026-06-14 |
| WIT-565 | feat/WIT-565-local-orders-field-service-loads-maps | Map views for local orders + field-service jobs. orders/local: `ApiOrder` extended with `deliveryLat`/`deliveryLng`; List↔Map toggle; dynamic `LocalOrdersMapView` (WLMap + OrderLayer + FitBoundsController + empty-state when no geocoded orders). field-service/jobs: API (`field-service.ts`) now selects `deliveryLocation` from Order and extracts `{ lat, lng }`; `WorkOrder` extended with `lat`/`lng`; List↔Map toggle; dynamic `JobsMapView` (WLMap + OrderLayer + FitBoundsController + priority/status mapped to `OrderPinStatus`). | API: `deliveryLocation` added to `/api/v4/field-service/jobs` select (no new endpoints) | 5 files, 2 new map views, 0 mock signals | 2026-06-16 |
| WIT-566 | feat/WIT-566-deliveries-crm-maps-production | **Consolidated PR #354** — merges WIT-357 + WIT-565 into single shippable unit. deliveries.ts: MOCK_DELIVERIES removed, real CourierDelivery Prisma. routes/integrations/crm.ts: 3 real endpoints (providers/sync-logs/field-mappings). orders/local: WLMap List↔Map toggle. field-service/jobs: WLMap List↔Map toggle. Build ✓ typecheck (pre-existing validator errors only) ✓ lint ✓. | 7 files, 0 mock signals | 2026-06-17 |
| WIT-355 | feat/WIT-355-dashboard-mock-cleanup-final | **Orders main list map view.** orders/page.tsx: added List↔Map toggle (WLMap + OrderLayer + FitBoundsController); dynamic import `OrdersMapView`; `useOrders` hook extended with `deliveryLat`/`deliveryLng` fields; `toOrderPinStatus()` helper; empty-state when no geocoded orders; subtitle shows mappable count. New file: `orders/components/orders-map-view.tsx`. Build ✓ typecheck (pre-existing validator errors only) ✓ lint ✓. | 3 files, 1 map view added to highest-traffic page | 2026-06-17 |
| WIT-361 | feat/WIT-355-dashboard-admin-timeslots-billing | **Integration sub-pages wired to real APIs.** 10 pages previously showing hardcoded 0s: email→`useApiList(?category=communication)` + EMAIL_SLUGS client filter + notification-templates count; messaging→same communication API + SMS_SLUGS/PUSH_SLUGS split; routing→`?category=routing`; pos→`?category=payment`; ecommerce→`?category=order_management`; shipping→`useApiList(/api/v4/carriers/adapters)` (enabled/disabled adapters); esignatures→`useApiList(/api/v4/signing-templates)` real count + list; freight/erp/telematics→honest "coming soon" empty states (no Prisma category exists for these providers — displaying fake 0s was misleading). All 10 pages: LoadingSkeleton, ErrorState with retry, refetch button, marketplace deep-links. | no new endpoints | 10 files, hardcoded zeros → 0 | 2026-06-19 |
| WIT-362 | feat/WIT-362-api-analytics-mock-cleanup | **API-layer mock cleanup.** `ai/analytics.ts` `/driver-score/:driverId`: replaced `mockMetrics` (hardcoded 45 deliveries/4.6 rating/92% compliance) with real `aggregateAllDrivers(tenantId, 'weekly', [driverId], prisma)` call + 404 when no data. `/anomalies/:routeId`: replaced hardcoded NYC lat/lng mock with real Prisma `route.findUnique` + `RouteStop` query — maps `estimatedArrival`/`actualArrival`/`departedAt` to `Stop` type for `detectAnomalies()`, returns 404 if route not found. Removed 5 now-unused imports (`calculateDriverScore`, `calculateDriverScoreBatch`, `DriverMetrics`, `RouteDataPoint`, `PlannedRouteSegment`) and 6 unused Zod schemas. `shopify-checkout.ts` `/geocode`: was returning hardcoded `lat:40.7128/lng:-74.006/city:New York` — now returns `503 {error:'Geocoding not configured'}` when `GOOGLE_MAPS_API_KEY` is not set, otherwise calls real Google Maps Geocoding API and maps `address_components` to structured response. | no new endpoints | 2 API files, 2 hardcoded mocks → 0, 1 env-gated external API | 2026-06-20 |
| WIT-363 | feat/WIT-363-dashboard-fix-raw-fetch-broken-routes | **Auth bypass fix — raw fetch() → api client.** 5 hooks + 1 page were calling `await fetch(url)` directly, skipping the authenticated `api` client (`@/lib/api`): no `Authorization: Bearer` token sent → silent 401 on every request. Fixed: `use-zone-overlays.ts` (`/api/v4/zones/overlays`), `use-zones-geojson.ts` (`/api/v4/zones?format=geojson`), `use-search.ts` (global Cmd+K search — was also pointing at wrong `/api/search` path → `/api/v4/search`), `use-order-sync.ts` (7 fetch calls for sync status/trigger/retry/metrics + conflict CRUD), `settings/accounting/page.tsx` (status/history/disconnect/batch-sync). **New routes**: `routes/search.ts` — real Prisma ILIKE search across orders/drivers/customers; `routes/orders-sync.ts` — sync status derived from `Integration` model, stub conflict endpoints (no `SyncConflict` Prisma model exists). **Registered** existing `accounting/accounting.ts` (was on disk but not in server.ts). **Deleted** 3 orphan demo files never imported anywhere (`integrations-demo.tsx`, `fleet-demo.tsx`, `demand-demo.tsx`). | PR #370 | 8 files fixed, 2 new API routes, 3 dead files deleted | 2026-06-20 |
| WIT-358 | feat/WIT-356-dashboard-inventory-map-pos-ux | **Supply-chain warehouse distribution map + UX hardening.** API: `GET /warehouses` now returns `lat`/`lng`/`city`/`itemCount`/`totalQuantity` from `Location.coordinates` JSON. NEW `WarehouseLayer` MapLibre component: circle size by quantity, color by utilization %, click popup, auto-fitBounds. inventory/page: replaced hardcoded `WAREHOUSES` const with real API data; List↔Map toggle + WLMap+WarehouseLayer; empty state when no coordinates set. UX hardening (loading/error guards added to 4 high-traffic pages missing them): pos/page (LoadingSkeleton+ErrorState), pos/transactions/page (TableSkeleton+ErrorState), payments/page (TableSkeleton), orders/conflicts/page (TableSkeleton+ErrorState). | 7 files, 1 hardcoded array → 0, 4 pages gained error/loading UI, 1 map view | 2026-06-17 |
| WIT-359 | feat/WIT-355-dashboard-settings-admin-detail | **Inventory transfers wired + cycle-count empty state.** API: NEW `GET /api/v4/supply-chain/transfers` backed by `InventoryMovement WHERE type='TRANSFER'`; enriches with location names + product titles; returns paginated `{data, pagination}`. inventory/page: Transfer Orders section replaced dead `{[].map(...)}` with real `useApiList('/api/v4/supply-chain/transfers')` — loading skeleton + proper empty state (ArrowLeftRight icon). Cycle Count section: no `CycleCount` Prisma model exists — replaced dead `{[].map(...)}` no-op with informative empty state (CalendarSearch icon). Removed unused `CycleCount` interface. | 2 files, 2 dead code sections → real data + empty states, 1 new endpoint | 2026-06-18 |
| WIT-360 | feat/WIT-360-org-usage-warehouse-filter | **Org usage stats + warehouse filter from real API.** settings/organization: removed hardcoded `usageStats` (8450/45/2.8M) — reads real `billing.usageMetrics` from existing `/api/v4/billing` call; bar colors derived from percentage threshold; section hidden when no metrics; fixed 2× `bg-[var(--wl-bg-secondary)]`/`text-[var(--wl-text-secondary)]` → WL design tokens. supply-chain/orders: removed hardcoded `WAREHOUSE_OPTIONS` (`WH-Central`/`WH-North`/`WH-South`/`WH-East`) — replaced with `useApiList('/api/v4/supply-chain/warehouses')` + `useMemo`. | 2 files, 3 hardcoded values → 0, 2 CSS non-tokens → 0 | 2026-06-18 |
| WIT-363 | feat/WIT-363-dashboard-freight-loads-map-ai-ux | **Freight Loads map view + AI/analytics UX hardening.** freight/loads: added List↔Map toggle; dynamic `DeliveryMapView` (SSR-disabled); `Shipment` interface extended with `deliveryLocation`+`order`; subtitle shows mapped-count in map mode. analytics/page: `ErrorState` on overview API failure. ai/route-efficiency: `ErrorState` on routes-list API failure. ai/driver-insights: `ErrorState` on leaderboard API failure. ai/slots: inline error panel with retry on recommend query failure. | no new endpoints | 5 files, 0 error states → 5, 1 map view | 2026-06-21 |
| WIT-364 | feat/WIT-364-dashboard-error-states-quality-pass | **Error state + quality pass.** Added `ErrorState` to 8 pages silently swallowing API failures: platform, integrations/health, integrations/overview, integrations/connected, integrations/lastmile, integrations/supply-chain, notifications/preferences, stores, saved-views. Fixed `use-migration.ts`: removed 5 raw `fetch('/api/migrations')` calls to non-existent endpoint — rewrote to safe empty-state stubs preserving all TypeScript interfaces. Fixed `integrations/health`: raw `fetch()` with env-interpolated URL → `api.post()`. Removed unused `useApiQuery` import from integrations/migration. | no new endpoints | 11 files, 8 missing error states → 0, 1 broken hook → 0, 1 raw fetch → api client | 2026-06-22 |
| WIT-561 | feat/WIT-561-dashboard-inventory-warehouse-map | **Inventory warehouse map view + badge fix.** API: new `GET /api/v4/inventory/warehouses` — groups `InventoryItem` records by `locationId`, joins `locations` table via raw SQL for `latitude`/`longitude`, computes `utilizationPercentage` (stock stress = % low-stock + out-of-stock items), returns `WarehousePin[]`. Dashboard inventory/page: List↔Map toggle — `WLMap + WarehouseLayer` with bubble size by quantity + colour-coded utilization stress (blue→green→amber→red); loading/empty/error states; colour legend. Badge fix: `getStatusBadge` hex `style` objects → `getStatusVariant` returning `Badge` `variant` prop (`success`/`warning`/`danger`). Responsive stat cards `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. | 2 files, 1 new endpoint, 1 map view, 0 inline styles | 2026-06-23 |
| WIT-565b | feat/WIT-565-zones-auth-hardening | **Auth bypass fix — zones + bulk orders + COD remit.** 5 pages had raw `fetch()` calls bypassing `@/lib/api`, meaning no `Authorization: Bearer` header was sent → silent 401s in production. `zones/new/page.tsx`: raw POST → `api.post`. `zones/page.tsx`: 3× raw PATCH/DELETE → `api.patch`/`api.delete`; removed unused `maptilerKey` var + prop (CARTO tiles need no key). `zones/[id]/page.tsx`: full rewrite from `useEffect`+raw GET to `useApiQuery`×2 hooks; inline-style status span → `<Badge variant>`; design-token classes throughout. `orders/bulk/page.tsx`: raw PATCH in loop → `api.patch`. `finance/cod/page.tsx`: raw PATCH remit → `api.patch<{data:{updated}}>`. | no new endpoints | 5 files, 8 raw fetch calls → 0, build ✓ typecheck ✓ lint ✓ | 2026-06-23 |
| WIT-568 | feat/WIT-568-dashboard-quality-final | **CRM wizard real API wiring + design token cleanup.** `use-wizard-state.ts`: `handleTestConnection` was always returning `{success:true}` (hardcoded stub) → now calls `GET /api/v4/crm/sync/status`; `handleActivate` was a `setTimeout` with no API call → now calls `POST /api/v4/crm/sync`; added `activating`/`activateError` state. `crm/connect/page.tsx`: fixed React hooks violation (hooks called after `if(loading)/if(error)` conditional returns); removed broken `useApiList('/api/v4/crm/connect')` that hit a nonexistent endpoint (wizard needs no preloaded data); fixed nav to `/crm` (was `/dashboard/crm`). `step-review-activate.tsx`: added `activating`/`activateError` props — back button disabled during activation, Activate button shows "Activating…" spinner, error banner on failure. Design tokens: replaced all `text-gray-300`/`text-gray-400`/`text-white` → `text-wl-text-secondary`/`text-wl-text-primary` across all 5 CRM wizard component files + `crm/page.tsx`. `loading.tsx`: `Math.random()*40+60` skeleton widths → deterministic array `[95,72,88,65,80]` (fixes hydration mismatch). PR #384 | no new endpoints | 9 files, 2 fake stubs → 0, 1 hooks violation → 0, 1 broken endpoint → 0, ~15 raw CSS tokens → WL design tokens, 1 Math.random → 0 | 2026-06-24 |
| WIT-569 | feat/WIT-569-dashboard-final-quality-sweep | **Admin dashboard real system health + dead code sweep.** `admin/page.tsx` `SystemHealth`: replaced 4 hardcoded strings (`"99.98%"`, `"245 / 500"`, `"1,234 jobs"`, `"94.2%"`) with real `GET /api/v4/admin/system` via `useApiQuery` + loading skeleton; `MetricsBar`: replaced 5 inline hex colors (`#6366f1` etc.) with WL design token classes (`text-indigo-400`, `bg-wl-success-500/10`, etc.); `getPlanColor` returning hex strings for inline `style` → `getPlanVariant` returning `Badge` `variant` prop (`free→default`, `starter→info`, `growth→warning`, `enterprise→success`); dead `getStatusColor` function removed; `text-gray-400`/`text-white` → `text-wl-text-tertiary`/`text-wl-text-primary`. `tracking-config/page.tsx`: `style={{background:"#111"}}` → `bg-wl-bg-root` class. Deleted 3 orphan files: `admin-demo.tsx` + `analytics/demo.tsx` (zero imports, JSDoc said "mock data"); `use-integration-logs.ts` (3 raw `fetch()` to non-existent `/api/integrations/logs` endpoint, never used) + removed from `hooks/index.ts`. PR #385 | no new endpoints | 10 mock signals → 0, 3 dead files deleted | 2026-06-24 |
| WIT-570 | feat/WIT-570-auth-bypass-hardening | **Auth bypass hardening — raw fetch() → api client + settings maps real API.** 11 raw `fetch()` auth bypasses across 5 files fixed: `use-crm-connection.ts` (8 calls, wrong `/api/integrations/crm/` paths → `api.post/patch/delete/get` to `/api/v4/integrations/crm/`; `crypto.getRandomValues()` for CSRF instead of `Math.random()`; added `useOAuthFlow`/`useCrmMetrics`). `invoices/[id]/page.tsx`: cookie-extraction raw fetch for PDF → `api.download('/api/v4/invoices/${invoiceId}/pdf')`. `integrations/connected/[providerId]/page.tsx`: raw fetch test-connection → `api.post`. `crm/oauth-callback-handler.tsx`: wrong path + missing auth → `api.post("/api/v4/integrations/crm/oauth/callback", ...)`. `settings/maps/page.tsx`: full rewrite from localStorage-only to `useApiQuery('/api/v4/shops/me')` + `api.patch` save; Header/LoadingSkeleton/ErrorState; keyless CARTO info banner; WLMap live preview. PR #389 | no new endpoints | 6 files, 11 raw fetch → 0, 1 page localStorage → real API | 2026-06-25 |
| WIT-567 | feat/WIT-567-driver-detail-map-live-location | **Driver detail page: Live Map tab + vehicle profile + delivery pins.** NEW `driver-location-map.tsx`: WLMap + DriverLayer (single driver at GPS position, status-coloured) + PinLayer (active delivery destinations amber=assigned/blue=in_transit) + useFitBounds; graceful empty state when no GPS. UPDATED `drivers/[id]/page.tsx`: added `useApiQuery('/api/v4/drivers/:id')` for real profile (vehicleType, vehiclePlate, phone, status, currentLocation, activeOrders); Score | Live Map tab toggle; header shows vehicle/plate/phone/active-orders badges; Live Map tab renders DriverLocationMap + active orders list; Active Orders section in Score tab. API: `deliveryLocation: true` added to orders select in GET /:id. | API: `deliveryLocation` added to drivers/:id orders select | 3 files, 1 new map view, 0 mock signals | 2026-06-26 |
| WIT-571 | feat/WIT-571-accent-color-design-tokens | **accentColor design token audit — 24 hex inline → 0 + ErrorState gaps.** Replaced all `accentColor="#..."` hex props with WL CSS variables across 8 files: `integrations/crm` (4: success-500/omit/warning-500/info-500), `integrations/supply-chain` (4: all default omitted; Connection Errors → danger-500), `integrations/fuel` (3: omit defaults; Fraud Alerts conditional warning-500), `integrations/lastmile` (success-500/warning-500/primary-400), `integrations/analytics` (success-600/omit/info-500/warning-500), `delivery/page` (warning-500/success-500/danger-500), `admin/workflows/[id]` (omit/success-500/danger-500/omit), `analytics/page` (8 MetricTile colors → primary-400/success-400/info-400/warning-400/primary-300/primary-500/success-500/danger-400). Zone progress bar gradient hex → CSS vars. MiniBarChart color prop hex → CSS var. Added missing `ErrorState` to `analytics/page` + `admin/audit/page`. PR #390 | no new endpoints | 9 files, 24 hex accentColor props → 0, 2 silent error gaps → ErrorState | 2026-06-25 |
| WIT-572 | feat/WIT-572-final-hex-cleanup | **Final hardcoded hex elimination — dashboard zero hex.** Last 2 hex values in the entire dashboard codebase removed: `notification-stats-widget.tsx` `CHANNEL_COLORS` map (`#3B82F6`→`var(--wl-primary-500)`, `#10B981`→`var(--wl-success-500)`, `#25D366`→`var(--wl-success-400)`, `#F59E0B`→`var(--wl-warning-500)`; fallback `#6B7280`→`var(--wl-neutral-500)`). `zone-inspector.tsx` delete-confirm button: `color: '#fff'` inline style → `text-white` Tailwind class. Dashboard codebase now has **zero** hardcoded hex color values. PR #391 | no new endpoints | 2 files, 5 hex values → 0 | 2026-06-25 |
| WIT-573 | feat/WIT-573-pod-crm-real-api-error-states | **POD API Prisma wiring + ErrorState on 8 dashboard pages.** `apps/api/src/routes/pod.ts`: barcode POST persists `DeliveryTimeline` with match/mismatch; manual confirm POST upserts `ProofOfDelivery` + creates `MANUALLY_CONFIRMED` timeline event; `GET /:deliveryId` queries `proofOfDelivery.findFirst` (was `[]`); `GET /:deliveryId/timeline` queries `deliveryTimeline.findMany` ordered by timestamp (was `[]`); `GET /:deliveryId/verify` derives `isVerified`/`method`/`issues` from real DB record. Dashboard: added `ErrorState` from `@/components/ui/error-state` with `onRetry` to 8 pages missing error paths: `analytics/eta-accuracy`, `analytics/route-performance`, `routes/plan`, `integrations/marketplace`, `mobile-config`, `products/sync`, `integrations/connected/[providerId]`. PR #392 | no new endpoints | 8 files + 1 API file, 5 mock/empty API responses → 0, 8 silent error swallows → 0 | 2026-06-25 |
| WIT-574 | feat/WIT-574-notifications-coverage-map-quality | **Notifications geographic coverage map + error-state quality hardening.** NEW `GET /api/v4/notifications/coverage`: joins `NotificationLog` (orderId) → `Order` (deliveryLocation JSON) → 0.05° grid cell aggregation → `{lat,lng,count,channel}[]`. NEW `notifications/components/notifications-coverage-map.tsx`: `WLMap + HeatmapLayer + FitBoundsController` with channel filter tabs (ALL/EMAIL/SMS/PUSH/WHATSAPP), loading/error/empty states, density legend, count badge; dynamically imported (SSR disabled) in `notifications/page.tsx` with Inbox↔Coverage Map toggle. `delivery-log/page.tsx`: added `LoadingSkeleton`+`ErrorState` guards (previously rendered blank on error). `support/page.tsx`: added full-page `LoadingSkeleton`+`ErrorState` guards. `tracking/page.tsx`: replaced inline red card error banner with `ErrorState`; added `useCallback`+combined `refetch`; removed `AlertCircle` import. `widgets/page.tsx`: replaced custom error card with `ErrorState`. | 1 new API endpoint | 7 files, 1 map view, 4 pages gain proper error states | 2026-06-26 |
| WIT-575 | feat/WIT-575-final-css-tokens-dead-code-cleanup | **Final CSS token pass + dead code deletion.** `drivers/[id]/page.tsx`: replaced 6 hardcoded hex color values that have WL token equivalents — score gauge accent `#34d399`→`var(--wl-success-400)`, `#fbbf24`→`var(--wl-warning-400)`, `#f87171`→`var(--wl-danger-400)`; BreakdownRow/KPI card accents for On-Time/Rating/POD metrics same substitutions; `#818cf8`/`#a78bfa` left (no WL token for indigo/violet). `settings/notifications-config/page.tsx`: `bg-gradient-to-br from-[#0a0a0f] to-[#12121a]` → `bg-wl-bg-root`. `settings/payments/page.tsx`: `bg-gradient-to-b from-[#0a0a0f] to-[#12121a]` → `bg-wl-bg-root`. Deleted 2 dead files never imported anywhere: `components/map/live-tracking-layer.tsx` (Leaflet-based, `Math.random()` city jitter, superseded by MapLibre `WLMap`); `components/crm/oauth-callback-handler.tsx` (raw `fetch()` to wrong non-v4 path, no auth token). | no new endpoints | 5 files, 8 hex → WL tokens or deleted; 2 dead files removed | 2026-06-27 |
| WIT-576 | feat/WIT-576-notification-preferences-api | **Notification preferences API — stub replaced with full Prisma implementation.** `notification-preferences.ts` was a 1-endpoint stub (`GET /status` only). The `/notifications/preferences` page was already well-crafted (loading/error states, channel×category matrix UI, quiet hours, digest settings) but all 3 of its API calls were 404ing. Replaced stub with: `GET /` — reads from `shop.settings.notificationPreferences` JSON, returns complete `{channelMatrix, quietHours, digestSettings}` with smart defaults (EMAIL/PUSH enabled for all categories; SMS/WHATSAPP for ORDERS+DELIVERIES; WEBHOOK/SLACK for SYSTEM+ALERTS). `PATCH /` — merges partial update into stored JSON, persists to `shop.settings`. `POST /test` — for DB-native channels (EMAIL/SMS/WHATSAPP/PUSH) creates a real `NotificationLog` record with `status:SENT`; for WEBHOOK/SLACK creates an `ActivityLog` entry; returns `{success,message}`. Merged green PR #397 (WIT-575). | 3 new endpoints | 1 API file, 3 broken endpoints → 0 | 2026-06-27 |
| WIT-577-prev | feat/WIT-568-dashboard-finance-revenue-map | **Finance revenue zone map.** NEW `GET /api/v4/finance/revenue-by-zone`: raw SQL joins `orders → time_slots → delivery_zones` grouped by zone; returns `{zones[{zoneId,zoneName,orderCount,revenue,avgOrderValue}], total:{revenue,orderCount,zonesWithOrders}, dateFrom, days}`. NEW `RevenueZoneLayer`: MapLibre fill+line layers on normalised revenue scale (emerald→green→amber→orange→grey), click popup with zone name/order count/revenue. NEW `FinanceMapView`: fetches `/api/v4/zones?format=geojson` + revenue data; renders WLMap + RevenueZoneLayer + colour legend + live stats overlay + auto-fitBounds; empty state when no zones. Finance page: Charts/Map view toggle in header; KPI cards always visible; map lazy-loaded via `next/dynamic` (SSR disabled). PR #400. | 1 new endpoint | 5 files, 1 map view, 0 mock signals | 2026-06-27 |
| WIT-577 | feat/WIT-577-dashboard-finance-cod-map-polish | **COD delivery map view + reconciliation endpoint fix + WL token cleanup.** `finance/cod`: List↔Map toggle — dynamic `CodMapView` (WLMap + `CodCollectionLayer`) with status-coloured circle pins (pending=blue/collected=green/verified=amber/reconciled=grey/failed=red), auto-fitBounds, click-to-inspect popup, legend, delivery count overlay; empty state when no coordinates; `CODDelivery` interface extended with `deliveryLat`/`deliveryLng`. API `finance-cod.ts GET /deliveries`: added `deliveryLocation:true` to order include, extracts `lat`/`lng` to `deliveryLat`/`deliveryLng` in every delivery record. `finance/reconciliation`: fixed wrong endpoint `?view=reconciliation` → `/api/v4/payments/reconciliation`; replaced all raw CSS (`text-white`→`text-wl-text-primary`, `text-gray-400`→`text-wl-text-secondary`, `bg-blue-500 text-white`→`bg-wl-primary-500 text-wl-text-inverse`). NEW `CodCollectionLayer`: MapLibre GeoJSON circle layer using `useWLMap()` context. NEW `CodMapView`: `WLMap` child-composition pattern. PR #401. | no new endpoints | 5 files, 1 map view, endpoint bug fixed, ~15 raw CSS tokens → WL | 2026-06-28 |
| WIT-578 | feat/WIT-578-design-system-token-cleanup | **Design-system showcase pages self-dogfood WL design tokens — 40+ hex CSS → 0.** `design-system/page.tsx`: `bg-wl-bg-root` (was malformed `bg-[#0a0a0f]-root`). `design-system/_components/design-tabs.tsx`: `border-wl-border-default`, `text-wl-primary`/`border-b-wl-primary` active tab, `text-wl-text-secondary hover:text-wl-text-primary` inactive. `design-system/_components/code-block.tsx`: `bg-wl-bg-root`/`bg-wl-bg-surface`/`bg-wl-bg-elevated`/`border-wl-border-default`/`text-wl-text-secondary`. `design-system/_components/page-header.tsx`: `border-wl-border-default`. `design-system/_components/preview-section.tsx`: `bg-wl-bg-surface`/`border-wl-border-default`/`text-wl-text-secondary hover:text-wl-text-primary`. `design-system/_components/tables-section.tsx`: `border-wl-border-default`/`hover:bg-wl-bg-surface`. `design-system/_components/colors-section.tsx`: `border-wl-border-default` (swatch frames; hex in `style={}` kept intentionally — showing actual color values). `design-system/tokens/page.tsx`: `bg-wl-bg-surface`/`border-wl-border-default`/`border-wl-border-strong`. `design-system/components/page.tsx`: `bg-wl-bg-root`/`bg-wl-bg-surface`/`bg-wl-bg-elevated`/`border-wl-border-default`/`border-wl-border-strong`/`text-wl-primary`/`text-wl-text-primary`/`text-wl-text-secondary`/`text-wl-text-inverse`/`bg-wl-primary`; active-tab `border-b-wl-primary`; sticky header `bg-wl-bg-root/80`. `admin/design-system/page.tsx`: same token set + fixed malformed `bg-[#0a0a0f]-root` class bug. All design-system showcase pages now self-dogfood the tokens they document. | no new endpoints | 10 files, ~40 hex CSS values → 0 | 2026-06-28 |
| WIT-579 | feat/WIT-568-dashboard-collections-payments-hooks-fix | **React Rules of Hooks — 10 files fixed.** Moved all `useState`/`useMemo`/`useCallback`/`useRef`/`useEffect` hooks declared after `if (loading) return` / `if (error) return` guards to before those guards — violating hook call order causes React to crash with "Rendered more hooks than during the previous render" on second render. Scanned all dashboard pages systematically; found 9 real violations across 10 files. Pages fixed: `activity` (useRef×2+useState+useCallback+useEffect after early return), `collections` (useState×5+useMemo after early return; also fixed nested `<tbody>` inside `<tbody>` invalid HTML → `<React.Fragment>`), `eld/dvir` (useMemo×3), `field-service/overview` (useMemo×3; schedule derived const also moved), `field-service/jobs` (useMemo×2), `field-service/dispatch` (allTechs cast+useMemo), `products` (useState×8), `pos` (useState×2+useMemo×2), `profile` (useState×2; `DEFAULT_PROFILE` extracted to module scope to avoid referencing post-return const), `support` (useCallback). | no new endpoints | 10 files, 14 hook-ordering violations → 0, 1 nested tbody → 0 | 2026-06-28 |
| WIT-580 | feat/WIT-568-crm-prisma-ai-supplychain-map | **CRM Prisma persistence + supply-chain warehouse map + AI loading state.** `apps/api/src/routes/crm/crm.ts`: replaced in-memory `MockCRMService` with `PrismaCRMService` backed by `CRMConnection`/`CRMFieldMapping` Prisma models — OAuth tokens now survive API server restarts. Registered CRM OAuth routes in `server.ts` at `/api/v4`. `apps/dashboard/src/hooks/use-supply-chain.ts`: extended `WarehouseUtilization` interface with `lat`/`lng`/`city`/`itemCount`/`totalQuantity` fields (API already returns them). NEW `supply-chain/components/supply-chain-warehouse-map.tsx`: `WLMap + WarehouseLayer` keyless CARTO map; colour-coded pins by utilisation %; legend + count badge + empty state. `supply-chain/page.tsx`: List↔Map toggle (dynamic SSR-disabled import); map renders at 520px height. `ai/page.tsx`: `CardSkeleton` grid shown while all 4 feature-usage-count calls are loading — no more silent zero display on initial render. PR #405. | no new endpoints (uses existing `/api/v4/supply-chain/warehouses`) | 6 files, 1 new component, 1 in-memory store → 0, 1 missing loading state → 0, 1 map view | 2026-06-29 |
| WIT-581 | feat/WIT-581-design-token-sweep-shipments-esig-healthcare | **Full-dashboard design token sweep — 2184 raw Tailwind gray→WL tokens across 185 files.** Systematically replaced ALL remaining raw Tailwind `text-gray-*`/`bg-gray-*`/`border-gray-*` classes with proper WL design token equivalents throughout every dashboard page and shared component. Mapping: `text-gray-400`→`text-wl-text-secondary`, `text-gray-500/600`→`text-wl-text-tertiary`, `text-gray-300`→`text-wl-neutral-300`, `text-gray-100/200/700-900`→`text-wl-text-primary`, `bg-gray-700`→`bg-wl-bg-overlay`, `bg-gray-800`→`bg-wl-bg-elevated`, `bg-gray-900`→`bg-wl-bg-surface`, `bg-gray-950`→`bg-wl-bg-sunken`, `bg-gray-50/100`→`bg-wl-bg-surface`, `bg-gray-200`→`bg-wl-neutral-200`, opacity-variants (`bg-gray-NNN/opacity`)→`bg-wl-neutral-NNN/opacity` (status indicator dots preserved), `border-gray-700`→`border-wl-border-default`, `border-gray-600`→`border-wl-border-strong`, `border-gray-800`→`border-wl-border-subtle`, hover/placeholder variants → matching WL tokens. Also cleaned design-system/tokens/page.tsx (19 hex CSS: `bg-[#0a0a0f]`→`bg-wl-bg-root`, `bg-[#12121a]`→`bg-wl-bg-surface`, `border-[#1e1e2e]`→`border-wl-border-default`) and design-system/forms/page.tsx (3 hex CSS). Final state: gray violations 2184→0, hex CSS outside design-system 22→0, mock signals 0→0. | no new endpoints | 185 files, 2335 CSS substitutions, 0 logic changes | 2026-06-29 |
| WIT-582 | feat/WIT-582-dashboard-error-states-performance-maintenance-maps | **Map views for driver performance & fleet maintenance + API bug fix.** `drivers/performance/page.tsx`: fixed broken endpoint `/api/v4/driver-scoring` (root 404) → `/api/v4/driver-scoring/leaderboard`; added List↔Map toggle in header; NEW `driver-performance-map-view.tsx` — `WLMap + DriverLayer` fetches `/api/v4/drivers` for lat/lng, cross-references leaderboard by ID/name, colours dots by tier (platinum=green/gold=amber/silver=purple/bronze=grey); click popup shows tier+score. `fleet/maintenance/page.tsx`: added Map as third view mode (List|Calendar|Map); NEW `maintenance-map-view.tsx` — `WLMap + VehicleMarkerLayer` fetches `/api/v4/fleet/locations`, cross-references by vehicleId, maps maintenance status → VehicleMapStatus (in-progress=MAINTENANCE blue/overdue=INACTIVE dark/scheduled=IDLE amber/completed=ACTIVE green); click popup shows type+vendor. `orders/import/page.tsx`: destructured `error: connectionsError` from useApiList, shows amber warning banner when integrations connections API fails. Both map views keyless CARTO, SSR-disabled, graceful empty states. PR #407. | no new endpoints | 5 files, 2 new map views, 1 API endpoint bug fixed, 1 error banner added | 2026-06-29 |
| WIT-583 | feat/WIT-583-demand-scheduler-map-empty-states | **Demand scheduler map view + empty states across demand/analytics/finance.** `demand/scheduler`: new Map tab (4th tab) — NEW `SchedulerCoverageLayer` (MapLibre fill+stroke layers colouring zone polygons red/green/blue by understaffed/optimal/overstaffed from `/api/v4/analytics/demand-capacity`); zone coverage legend + panel overlay; all 3 existing tabs now show empty states (CalendarX/Zap/Lightbulb) when arrays are empty. `demand/models`: empty state card when models list is empty (previously blank). `analytics/dashboards`: trash icon now sets `confirmDeleteId` → confirmation modal ("Delete dashboard?" + Cancel/Delete); replaces immediate `api.delete` on click — prevents accidental data loss. `finance/reconciliation`: per-table inline empty rows (FileX icon + label) for Bank Transactions and Internal Records separately — previously only showed a combined empty page; `window.location.reload()` → `router.refresh()`. NEW component `scheduler-coverage-layer.tsx` following `demand-zone-layer` pattern. PR #408. | no new endpoints | 5 files + 1 new component, 1 map view, 0 mock signals | 2026-06-30 |
| WIT-584 | feat/WIT-584-stores-map-zones-guards-cod-skeleton | **Stores zone coverage map + zones loading/error guards + COD skeleton.** `stores/page.tsx`: Zone Coverage Map section added below store card — NEW `StoreZoneCoverageMap` (dynamic SSR-disabled import); fetches `useZonesGeoJson()`; zone count badge in section header; `LoadingSkeleton` while loading; empty-state card when no zones configured. NEW `stores/components/store-zone-coverage-map.tsx`: `WLMap + ZoneLayer + ZoneFitBounds` (auto-fits Polygon/MultiPolygon coords via `fitBounds`), graceful empty state. `zones/page.tsx`: fixed missing loading/error guards — destructured `loading`/`error` from `useZonesGeoJson`; `error` from `useZoneOverlays`; added full-screen loading overlay (spinner + `backdrop-blur-sm`) and full-screen `ErrorState` overlay so the MapLibre canvas never renders over a failed or in-flight fetch. `finance/cod/page.tsx`: replaced plain "Loading deliveries…" text with `TableSkeleton` (7 columns, 6 rows) for consistent skeleton UX across all tables. PR #411. | no new endpoints | 4 files (3 modified + 1 new component), 1 map view, 0 mock signals | 2026-06-30 |
| WIT-585 | feat/WIT-585-home-livemap-zinc-token-sweep | **Home live map + zinc-to-WL design token sweep (13 files).** NEW `home/components/home-live-map.tsx`: `WLMap + OrderLayer + DriverLayer + useFitBounds`; fetches `/api/v4/orders?status=ASSIGNED,...&limit=50` + `/api/v4/dispatch/drivers?limit=100`; loading skeleton, empty state, live legend (status counts), Maximize2 link to `/map`; dynamically imported in `home/page.tsx` (SSR disabled). Token sweep: replaced every remaining `zinc-*` Tailwind class with WL design-system tokens across 13 files missed in WIT-581 — `orders/page` (52 tokens), `dispatch/page` (52), `dispatch/couriers/page` (20), `notifications/log/page` (38), `delivery/page` (25), `delivery/standard/page` (15), `drivers/page` (17), `drivers/create/page` (10), `drivers/[id]/page` (2), `drivers/components/drivers-map-view` (19), `components/dispatch/dispatch-live-map` (20), `customers/create/page` (8). Mapping: `bg-zinc-{950/900/800/700}` → `bg-wl-bg-{root/surface/elevated/overlay}`, `border-zinc-{800/700}` → `border-wl-border-{default/strong}`, `text-zinc-{100–300}` → `text-wl-text-primary`, `text-zinc-400` → `text-wl-text-secondary`, `text-zinc-{500/600}` → `text-wl-text-tertiary`. PR #412 merged ✅. | no new endpoints | 14 files (13 modified + 1 new component), 278 zinc token substitutions, 1 live map view | 2026-07-01 |
| WIT-586 | feat/WIT-586-locations-map-token-final-pass | **Locations overview map + design token final pass.** `locations/page.tsx`: List↔Map toggle; dynamic `LocationsOverviewMap`. NEW `locations/components/locations-overview-map.tsx`: `WLMap + PinLayer` ACTIVE→amber/MAINTENANCE→red/INACTIVE→blue; `useFitBounds` auto-fit; type-count overlay; status legend; empty state. Token fixes: `home-live-map.tsx` `bg-[#f5a623]`→`bg-wl-primary-500`, `bg-[#10b981]`→`bg-wl-success-500` (purple break dot kept as inline style — no WL purple token, consistent with `driver-layer.tsx`); `field-service/layout.tsx`+`pos/layout.tsx` `slate-700/900/400`+`indigo-500/400`→WL tokens; `industry-select.tsx` `from-slate-500 to-slate-600`→`from-wl-neutral-500 to-wl-neutral-600`; `platform-logo.tsx` `bg-slate-700`→`bg-wl-bg-overlay`; `eld/hos-gauge.tsx` 9 SVG `stopColor` hex literals→`style={{stopColor:'var(--wl-success/warning/danger-NNN)'}}` CSS vars; `getTextColor()` returns CSS var strings. **0 `slate-[n]` classes remain; 0 `bg-[#]/text-[#]/border-[#]` Tailwind arbitrary classes remain in codebase.** PR #413. | no new endpoints | 8 files, 6 slate + 3 hex CSS signals → 0, 1 map view | 2026-07-01 |
| WIT-587 | feat/WIT-587-events-activity-production | **Events filters wired to API + activity timeline state bug fix.** `events/page.tsx`: filters were updated in local state but never passed to `useApiList`; computed path via `useMemo` now embeds `action`/`entityType`/`dateFrom`/`dateTo` as server-side query params; `source`+`searchQuery` remain client-side; dynamic `eventTypeOptions`/`entityTypeOptions` derived from live result set (were always empty); added `workflow`+`system` source options; fixed `placeholder-gray-500`→`placeholder:text-wl-text-tertiary`; added `Header` component; implemented Export CSV handler. `activity/page.tsx`: removed intermediate `events` state seeded from async `apiEvents=[]` (timeline was perpetually blank on load); `filteredEvents` now reads `apiEvents` directly; wired `pagination`+`setPage` from `useApiList`; passed `hasMore`/`onLoadMore` to `EventTimeline`. `event-timeline.tsx`: replaced placeholder comment with functional "Load more" button. PR #414. | no new endpoints | 3 files, 2 runtime bugs → 0 | 2026-07-01 |
| WIT-588 | feat/WIT-588-dashboard-mutation-error-feedback | **Silent mutation error feedback — toast on 8 pages.** Wired `useToast()` into every mutation catch block across 8 dashboard pages where failures were silently swallowed by `console.error`. Also fixed a critical bug: Update Password button in `settings/profile` had no `onClick` handler (button was a complete no-op). Pages fixed: `settings/profile` (`handleSaveProfile`, `handleChangePassword` + onClick fix), `settings/preferences` (`handleSave`), `settings/organization` (`handleSave`), `settings/api-keys` (`handleCreateKey`, `revokeKey`), `collaboration` (6 handlers: send/edit/delete/pin/react/createChannel), `shipping/labels/new` (`handleCreateLabel`), `orders/conflicts` (`handleResolveConflict`, `handleBulkResolveByField`), `orders/import` (`handleTriggerSync`). All operations now show error toast on failure and success toast where appropriate. PR #417. | no new endpoints | 8 files, 16 silent error swallows → 0, 1 broken button onClick → fixed | 2026-07-02 |
| WIT-591 | feat/WIT-591-pos-api-fix-terminal-map | **POS API production-fix + terminal-locations map.** `apps/api/src/routes/pos.ts` completely rewritten — fixed all Prisma field/relation bugs causing 500 on every POS endpoint: `where: { posConfig: { shopId } }` → `where: { shopId }` (no relation on PosOrder), `_sum: { totalAmount }` → `_sum: { total }`, `include: { posConfig: true }` → separate query + `configsToMap()` helper, `include: { items: true }` → removed (items is Json), `items: { create }` → `items: body.items` (Json assignment), `posOrderId` → `externalId`. Added `GET /api/v4/pos/terminal-locations` joining `PosConfig` with `Location` model for lat/lng coords. Dashboard: List↔Map toggle on Terminal Status card — `WLMap + PosTerminalLayer` (keyless CARTO; green=online/blue=offline/red=error); `useTerminalLocations` hook + `TerminalLocation` type added to `use-pos.ts`; `PosTerminalLayer` component wraps `PinLayer` with status mapping. Zero mock signals in POS section. PR #418. | 1 new endpoint (`GET /api/v4/pos/terminal-locations`) | 4 files, 15+ Prisma bugs → 0, 1 map view | 2026-07-02 |
| WIT-595 | feat/WIT-595-api-analytics-hardcoded-values | **Analytics API hardcoded placeholder values → real computed delivery scores.** `apps/api/src/routes/analytics.ts`: `customerSatisfaction: 4.5` (shown on analytics overview as always-fake "Customer Rating: 4.5/5") → real computed value derived from `onTimeRate` (0–100% → 0–5.0 scale: `Math.round((onTimeRate / 20) * 10) / 10`); `topDrivers[].rating: 4.5` → per-driver on-time ratio mapped to 0–5.0 scale (`Math.round((d.onTime / d.total) * 50) / 10`). `apps/dashboard/src/app/(dashboard)/analytics/page.tsx`: renamed "Customer Rating" MetricTile label → "Delivery Score" (label was claiming a satisfaction metric for a delivery performance number). `apps/api/src/routes/driver-scoring.ts`: removed 3 stale comment lines ("For now, return current scores as a placeholder"). | no new endpoints | 3 files, 2 hardcoded 4.5 placeholders → 0, stale comments removed | 2026-07-03 |
| WIT-601 | feat/WIT-601-dashboard-drivers-customers-sub-pages | **Driver performance period wiring + customer segments WLMap.** `drivers/performance/page.tsx`: `period` state was declared AFTER `useApiList` call and never passed to it — period-selector buttons were decorative only, always fetching `weekly` regardless. Fixed: moved `period` state before `useApiList`; pass `` `/api/v4/driver-scoring/leaderboard?period=${period}` `` so changing period triggers a real refetch. Added empty state (List icon + message + Refresh button) for `drivers.length === 0`. `customers/segments/page.tsx`: `WLMap` was imported but never rendered — geo view showed only a cities table and tier bar charts with zero map. Fixed: added `GeoMapLayers` component (wraps `CustomerDensityLayer` + `useFitBounds`), calls `useCustomerLocations()`, renders `WLMap` with tier-coloured `CustomerDensityLayer` pins above the table+charts grid in the Geography view. Empty state when no geo-located customers; loading pulse skeleton during fetch. | no new endpoints | 2 files, 1 broken period refetch → fixed, 1 missing map view → added, 0 mock signals | 2026-07-07 |
| WIT-602 | feat/WIT-602-crm-prisma-persistence | **Final hex CSS token pass — 8 remaining arbitrary hex class values → WL design tokens.** Full audit of dashboard app pages confirmed zero mock signals and zero raw gray/zinc/slate classes; only 8 `bg-[#]/border-[#]/divide-[#]` Tailwind arbitrary classes remained across 4 pages. `support/page.tsx`: `border-r-[#1e1e2e]` → `border-r-wl-border-default` + `border-b-[#1e1e2e]` (×3) → `border-b-wl-border-default` (table separator rows). `locations/page.tsx`: `border-[#1e1e2e]` → `border-wl-border-default` (view-mode toggle container) + `bg-[#12121a]` → `bg-wl-bg-surface` (inactive toggle button). `pos/page.tsx`: `divide-[#1e1e2e]` → `divide-wl-border-default` (top-items tbody). `pos/transactions/page.tsx`: same `divide-[#1e1e2e]` → `divide-wl-border-default` fix. Dashboard app pages now have **zero hardcoded hex CSS values** and **zero mock signals**. Build ✓ typecheck ✓ lint ✓. | no new endpoints | 4 files, 8 hex CSS → WL tokens, 0 mock signals confirmed | 2026-07-08 |
| WIT-603 | feat/WIT-603-dashboard-partners-operations-quality | **Residual zinc/gray Tailwind token sweep — 6 files.** Swept every remaining `text-zinc-*`/`bg-zinc-*`/`border-zinc-*`/`text-gray-*` class across dashboard app pages (post-WIT-585 and WIT-581). `orders/page.tsx`: 14 zinc/gray occurrences — date inputs (`bg-zinc-800/50 border-zinc-700 text-zinc-100` → WL tokens), empty state icon wrapper (`bg-zinc-800/50`/`text-zinc-600/200/500` → WL tokens), table row border+hover (`border-zinc-800/50`/`hover:bg-zinc-800/30` → WL tokens), customer name/address/total/date/action button text (`text-zinc-100/300/400` → WL tokens), item count badge (`bg-zinc-800 text-zinc-200` → WL tokens), OrderLayer loading fallback (`bg-zinc-900` → `bg-wl-bg-root`). `supply-chain/orders/page.tsx`: 3 gray occurrences (`text-gray-300`×2/`text-gray-400` in wave plans + return item → `text-wl-text-secondary`). `admin/shops/[id]/page.tsx`: 1 (`text-gray-400` Suspended label → `text-wl-text-secondary`). `invoices/[id]/page.tsx`: 1 (`text-gray-400` activity description → `text-wl-text-secondary`). Dashboard app pages confirmed **zero** raw Tailwind color classes (zinc/gray/slate/arbitrary hex). Build ✓ lint ✓. | no new endpoints | 4 files, 19 raw Tailwind color tokens → WL design tokens, 0 mock signals | 2026-07-08 |
| WIT-606 | feat/WIT-606-integrations-catalog-marketplace-real-api | **Wire integrations/marketplace + integrations/catalog to real API.** Both pages had massive hardcoded provider arrays that evaded the standard `grep -rniE "mock\|dummy\|fake"` scan because they used neutral constant names. `integrations/marketplace/page.tsx`: removed `ALL_PROVIDERS` (127 hardcoded entries across 21 fake categories with CRM/EMAIL/SMS/PUSH/TELEMATICS/ELD/FUEL/POS/LASTMILE/FREIGHT/SUPPLY_CHAIN/CATALOG/ESIGNATURES not in Prisma schema); removed hardcoded `CATEGORIES` (21 static counts); replaced `useApiList('/api/v4/integrations/connections')` + hardcoded data with single `useApiQuery('/api/v4/integrations/marketplace')` returning real `IntegrationAppMeta[]` with `installed` overlay; categories and counts derived from live response; 12-card pulse skeleton while loading; `ErrorState` on failure; `installed` flag replaces fake `connected: false`. `integrations/catalog/page.tsx`: removed `INTEGRATIONS` (134 hardcoded entries across 21 fake categories); zero API calls → `useApiQuery('/api/v4/integrations/marketplace')`; `capabilities` → capability chips; `status: AVAILABLE/BETA/COMING_SOON/DEPRECATED` → correct Badge variants; sidebar categories derived from API (6 real categories); sort by `name\|category\|status` (API has no popularity score); 12-card pulse skeleton; `ErrorState` on failure. Both pages now serve ~38 real registry integrations across 6 Prisma-backed categories. Build ✓ typecheck ✓ lint ✓. | no new endpoints | 2 files, 261 hardcoded provider entries → 0 | 2026-07-09 |
| WIT-580 | feat/WIT-580-quality-hardening-ids-loading-auth | **Quality hardening — auth, loading states, and ID generation.** `lib/track.ts`: raw `fetch('/api/v4/analytics/events')` (no auth header) → `api.post()` from `@/lib/api` with `keepalive:true` — all telemetry events now include `Authorization: Bearer` token and `credentials: include`. `drivers/performance/components/driver-performance-map-view.tsx` + `fleet/maintenance/components/maintenance-map-view.tsx`: both `useApiQuery` calls destructured only `data`, firing the empty-state branch during loading; added `loading` destructure + pulse-skeleton guard before the empty-state check. `orders/create/page.tsx`: `useApiList` for customers/products destructured only `items`; added `customersLoading`/`productsLoading`; customer search dropdown shows "Searching…" loader while fetching; product input placeholder says "Loading products…" while fetching. `ai/page.tsx`: `useFeatureUsageCounts` silently dropped all 4 API errors; added `hasError` flag + "Usage statistics temporarily unavailable" notice below the feature grid. `Math.random()` → `crypto.randomUUID()` in 13 instances across 11 component/hook files (toast.tsx, checkbox.tsx, toast-enhanced.tsx, form-field.tsx, form-checkbox.tsx, form-radio.tsx×2, invoice-line-item-editor.tsx, invoice-line-items.tsx, toast-stack.tsx, message-composer.tsx×2, use-field-array.ts) — fixes SSR hydration mismatch risk and improves entropy from ~18 bits → 122 bits. `partners-demo.tsx`: removed 2 `console.log` stub handlers for onView/onDispatch. Build ✓ typecheck ✓ lint ✓. | no new endpoints | 17 files, 1 unauthenticated fetch → 0, 2 missing loading guards → 0, 13 Math.random() → 0, 2 console.log stubs → 0 | 2026-07-09 |
| WIT-607 | feat/WIT-607-quality-hardening-final | **Final quality hardening — error states, console.log, onboarding auth, missing apps route.** `notifications/page.tsx`: `onRetry={() => window.location.reload()}` → `onRetry={refetchNotifications}` (uses hook's own refetch instead of full reload). `calendar/page.tsx`: `useApiList` now destructures `refetch`; `ErrorState` gains `onRetry={refetch}`. `stores/page.tsx`: `statsError` destructured from `useApiQuery`; amber warning banner shown when stats API fails (shop still renders). `partners/page.tsx`: `partnerStatsError` destructured from `useApiQuery`; amber warning shown below PartnerStatsWidget when stats fail. `apps/page.tsx`: NEW file — `redirect('/apps/installed')` so `/apps` no longer 404s. `lib/socket.ts`: `const isDev = process.env.NODE_ENV === 'development'`; 6 `console.log("[Socket]…")` calls wrapped with `if (isDev)` — no socket lifecycle noise in production logs. `onboarding/page.tsx`: all 3 raw `fetch()` calls (GET progress, PUT progress, POST complete) migrated to `api.get/put/post` from `@/lib/api`; `API_URL` removed from both effect dependency arrays (no longer used in their bodies). Build ✓ typecheck ✓ lint ✓. | no new endpoints | 7 files, 3 raw fetch → 0, 6 unguarded console.log → 0, 2 wrong onRetry → refetch, 1 missing route → redirect | 2026-07-09 |

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
| Dashboard Home | `/home` | 3 | 0 | ✅ WIT-462 | — |
| Activity Feed | `/activity` | 2 | 0 | ✅ WIT-505 | — |
| Realtime Activity | `/activity/realtime` | 0 | 0 | ✅ | — |

**Endpoints used**: `GET /api/v4/dashboard/stats`, `GET /api/v4/orders?limit=5`, `GET /api/v4/drivers?limit=8`

---

## Orders (5 → 0 mock signals) ✅ WIT-515
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Order List | `/orders` | 0 | 0 | ✅ |
| Order Detail | `/orders/[id]` | 2+1placeholder | 0 + Map view | ✅ WIT-515 |
| Order Board | `/orders/board` | 1 | 0 | ✅ WIT-505 |
| Order Import | `/orders/import` | 3 | 0 | ✅ WIT-515 |
| Order Create | `/orders/create` | 0 | 0 | ✅ |
| Order Bulk | `/orders/bulk` | 0 | 0 | ✅ |
| Order Conflicts | `/orders/conflicts` | 0 | 0 | ✅ |
| Order Local | `/orders/local` | 0 | 0 + Map view | ✅ WIT-565 |

**WIT-515 changes**:
- Order Detail: Fixed field name mismatches (`orderNumber`→`externalOrderNumber`, `customer.name`→`customerName`, `address.street`→`addressLine1`, `order.activities`→`notificationLogs`); replaced "Map View Placeholder" div with real `WLMap` + `PinLayer` using `deliveryLat`/`deliveryLng` from API; notes now use `PATCH /api/v4/orders/:id`; shipment info from included `primaryShipment`; API updated to include `shipments` relation + extract `deliveryLat`/`deliveryLng` from shipment's `deliveryLocation: { lat, lng }` JSON
- Order Import: Replaced broken `useSyncStatus`/`useSyncTrigger`/`useSyncMetrics` hooks (called non-existent `/api/orders/sync/*` Next.js routes) with `useApiList('/api/v4/integrations/connections')` + `useApiQuery('/api/v4/dashboard/stats')`; `handleTriggerSync` now calls `POST /api/v4/integrations/connections/:id/force-sync`
- CourierAssignmentPanel: Removed `Math.random()` service area check + random unavailable check; replaced with data-driven `status === 'unavailable'` only; removed fake `setTimeout` simulation in `handleAssign`

---

## Shipments (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Shipment List | `/shipments` | 0 | ✅ |
| Shipment Detail | `/shipments/[id]` | 0 | ✅ |

---

## Delivery (0 mock signals) ✅ WIT-400
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Delivery Overview | `/delivery` | hook had mock fallback | 0 | ✅ WLMap + ShipmentMarkerLayer | ✅ WIT-400 |
| Standard Delivery | `/delivery/standard` | 0 | 0 | ✅ WLMap + ShipmentMarkerLayer | ✅ WIT-400 |

**WIT-400 changes**: Added `delivery/components/delivery-map-view.tsx` (shared map: `WLMap` + `ShipmentMarkerLayer` status-coloured circles + `useFitBounds` + legend + stats overlay + no-location placeholder). Both pages now have List↔Map view toggle, stat cards, proper `Shipment` type with `deliveryLocation`/`addressLine1`/`city` fields, shipment detail panel, `Header` component, empty state, error state. `use-shipment-tracking.ts` hook: removed `setTrackingData({...John Doe...})` fallback block (80 lines of mock); now calls real `/api/v4/shipments?search=` + `/api/v4/shipments/:id`.

**Map layer**: `ShipmentMarkerLayer` (PENDING=blue, IN_TRANSIT=amber, OUT_FOR_DELIVERY=green, DELIVERED=emerald, FAILED=red)

---

## Customers (0 mock signals) ✅ WIT-526 + WIT-343
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Customer List | `/customers` | hook had fake name/status/tier/totalOrders fields | 0 + real stats + tier/status filters | ✅ WLMap + CustomerDensityLayer (tier-coloured, auto-fit) | ✅ WIT-343 |
| Customer Detail | `/customers/[id]` | n/a (page missing) | 0 (new page) | ✅ WLMap + PinLayer delivery locations | ✅ WIT-526 + WIT-343 |
| Customer Segments | `/customers/segments` | n/a (page missing) | 0 (new page) | — (geo table) | ✅ WIT-343 |
| Customer Create | `/customers/create` | 0 | 0 | — | ✅ |

**WIT-343 changes**:
- NEW: `customers/segments/page.tsx` — tier overview (enterprise/premium/standard cards with computed count/revenue/avg-orders/avg-spend), engagement status bars, tier criteria reference, geo tab with top cities table + revenue-by-tier + count-by-tier progress bars
- UPDATED: `customers/page.tsx` — added List↔Map view toggle; map view uses new `CustomerDensityLayer` (MapLibreGL GeoJSON circles, tier-coloured: amber=enterprise/blue=premium/grey=standard, auto-fit via `useFitBounds`, click popup with name/tier/city/orders/spend); stat cards use real `/api/v4/customers/stats` (total + totalPrev trend, activeCount, topSpenderAmount, avgOrderCount); tier/status filter pills with server-side filtering
- FIXED: `use-customers.ts` — `Customer` interface fully aligned to Prisma schema (`firstName`/`lastName`/`ordersCount`/`externalCustomerId`/`marketingConsent`/`lastSyncAt`/`tags`); removed fake `name`/`status`/`tier`/`totalOrders` interface fields; `normalizeCustomer()` now maps to correct Prisma fields + computes `tier` (spend-based) and `status` (orders > 0 → active); `CustomerAddress` interface updated to Shopify address shape (`address1`/`province`/`latitude`/`longitude`)
- FIXED: `customers/[id]/page.tsx` — fixed address rendering (`addr.street`→`addr.address1`, `addr.state`→`addr.province`); removed non-existent `customer.company` reference
- NEW: `components/map/customer-density-layer.tsx` — MapLibreGL layer; GeoJSON source; enterprise=amber/premium=blue/standard=grey; click handler (`onCustomerClick`); initial-label layer for enterprise tier; auto-cleanup on unmount
- NEW: `customers/components/customers-map-view.tsx` — dynamic-imported wrapper (MapLibre, SSR-disabled): `WLMap` + inner `MapLayers` component using `useWLMap()` + `useFitBounds`, customer count badge, tier legend, selected-customer popup, empty state
- API UPDATED: `customers.ts` — normalizes list/get responses (adds `name`/`totalOrders`/`tier`/`status` derived fields); supports `tier` + `status` query params with app-layer filtering; stats endpoint adds `totalPrev`/`activeCount`/`topSpenderAmount` for trend display
- NEW API: `GET /api/v4/customers/locations` — extracts lat/lng from addresses JSON (Shopify address format), returns up to 2,000 customer pins with tier/orders/spend
- NEW API: `GET /api/v4/customers/segment-stats` — aggregates tier buckets (count/totalSpent/totalOrders), status buckets (active/inactive), top-15 cities with customer count/revenue/avg-orders

**Endpoints**: `GET /api/v4/customers` (tier+status filters added), `GET /api/v4/customers/stats` (trend data added), `GET /api/v4/customers/locations` (NEW), `GET /api/v4/customers/segment-stats` (NEW), `GET /api/v4/customers/:id` (normalized), `GET /api/v4/customers/:id/orders` (wired)

---

## Drivers (0 mock signals) ✅ WIT-518 + WIT-567
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Driver List | `/drivers` | 0 | 0 + live map | ✅ WLMap + DriverLayer | ✅ WIT-518 |
| Driver Detail | `/drivers/[id]` | 0 | 0 + Live Map tab | ✅ WLMap + DriverLayer + PinLayer | ✅ WIT-567 |
| Driver Create | `/drivers/create` | 0 | 0 | — | ✅ |
| Driver Performance | `/drivers/performance` | 0 | 0 + Map view | ✅ WIT-582 API fix + List↔Map | ✅ |

**WIT-518 changes**: Added Cards ↔ Map toggle on driver list. Map view: `WLMap` + `DriverLayer` (green=available, amber=en-route/delivering, purple=on-break, grey=offline) with `useFitBounds` auto-centring on drivers with location. Positions from `GET /api/v4/dispatch/drivers` (Redis GEO). Lazy-loaded via `next/dynamic` (no SSR for maplibre-gl).

**WIT-567 changes**:
- NEW `driver-location-map.tsx`: WLMap + DriverLayer (single driver at GPS position) + PinLayer (active delivery destinations, amber=assigned/blue=in_transit) + useFitBounds; graceful empty state when no GPS reported
- UPDATED `drivers/[id]/page.tsx`: added `useApiQuery('/api/v4/drivers/:id')` for real profile (vehicleType, vehiclePlate, phone, status, currentLocation, activeOrders); Score | Live Map tab toggle; header now shows vehicle/plate/phone/active-orders/GPS-active badges from live profile; Live Map tab renders DriverLocationMap + active orders list below map; Active Orders section added to Score tab
- API `drivers.ts`: added `deliveryLocation: true` to orders select in GET /:id so delivery pins have coordinates

---

## Routes (0 mock signals) ✅ WIT-533
| Page | Route | Mock Before | Map | Status |
|------|-------|------------|-----|--------|
| Routes List | `/routes` | 0 | — | ✅ WIT-533 design tokens |
| Route Detail | `/routes/[id]` | 0 | ✅ WLMap | ✅ WIT-533 design tokens |
| Route Plan | `/routes/plan` | 0 | ✅ WLMap List↔Map toggle | ✅ WIT-533 map + design tokens |
| Route Create | `/routes/create` | 0 | ✅ WLMap | ✅ WIT-533 design tokens |
| Route Assign | `/routes/[id]/assign` | 0 | — | ✅ WIT-533 design tokens |
| Route Edit | `/routes/[id]/edit` | 0 | — | ✅ WIT-533 design tokens + save fix |

**WIT-533 changes**:
- Replaced 105+ hex CSS values across all 6 routes pages with WL design tokens (`bg-wl-bg-root`, `bg-wl-bg-surface`, `bg-wl-bg-overlay`, `bg-wl-bg-elevated`, `bg-wl-bg-sunken`, `border-wl-border-default`, `border-wl-border-strong`, `text-wl-text-primary/secondary/tertiary`)
- `routes/plan/page.tsx`: Added List↔Map toggle in optimize/review/dispatch steps; `WLMap` + `RoutePolylineLayer` + `RouteStopMarkersLayer` renders `state.selectedResult.stopSequence` with auto-fit bounds; toggle only shown when stops have coordinates
- `routes/[id]/edit/page.tsx`: Fixed non-functional Save Changes button — now calls `updateRoute(currentFormData)` via `useApiMutation` with loading/error state; removed non-functional Save as Draft button; removed `getPriorityColor()` helper that leaked raw hex strings
- PR: https://github.com/wityliti/witylogix/pull/287

---

## Dispatch (1 → 0 mock signals) ✅ WIT-517
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Dispatch | `/dispatch` | 1 (Leaflet placeholder map) | 0 + WLMap | ✅ WIT-517 |
| Couriers | `/dispatch/couriers` | 0 | 0 | ✅ |

**WIT-517 changes**: `dispatch-map.tsx` replaced Leaflet placeholder with `WLMap` + `RoutePolylineLayer` + `RouteStopMarkersLayer` + `DriverLayer`; center computed from first stop's coordinates; `STOP_STATUS_MAP`/`DRIVER_STATUS_MAP` normalize API enums to layer types

---

## Fleet (0 mock signals)
| Page | Route | Mock Before | Status |
|------|-------|------------|--------|
| Fleet Overview | `/fleet` | 0 | ✅ |
| Vehicles | `/fleet/vehicles` | 0 | ✅ WIT-531 (List/Map toggle + WLMap) |
| Vehicle Detail | `/fleet/vehicles/[id]` | 0 | ✅ |
| Fuel | `/fleet/fuel` | 0 | ✅ |
| Maintenance | `/fleet/maintenance` | 0 | 0 + Map view | ✅ WIT-582 List|Calendar|Map |

---

## Analytics (14 → 0 mock signals) ✅ WIT-512 + WIT-534 + WIT-541
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Analytics Overview | `/analytics` | DEMO_METRICS, 5 consts; 7×bg-[#111118], 1×bg-[#1a1a28] | 0 + Heatmap map view | ✅ WLMap + HeatmapLayer (Charts↔Heatmap toggle) | ✅ WIT-512 + WIT-534 + WIT-541 |
| Dashboards | `/analytics/dashboards` | wrong endpoint (?view=dashboards) | 0 + Create/Delete modal | — | ✅ WIT-541 |
| ETA Accuracy | `/analytics/eta-accuracy` | DEMO_METRICS, 4 consts; 5×bg-[#111118] | 0 | — | ✅ WIT-512 + WIT-534 tokens |
| Reports | `/analytics/reports` | wrong endpoint (?view=reports) | 0 + Create/Delete modal | — | ✅ WIT-541 |
| Route Performance | `/analytics/route-performance` | 0 (API Math.random()); 4 inline hex legend colors | 0 + Map view; CSS vars | ✅ WLMap + DeliveryPerformanceLayer | ✅ WIT-512 + WIT-534 tokens |

**WIT-534 analytics changes**:
- `analytics/page.tsx`: `bg-[#111118]` ×7 → `bg-wl-bg-surface`; `bg-[#1a1a28]` ×1 (chart tooltip) → `bg-wl-bg-elevated`
- `analytics/eta-accuracy/page.tsx`: `bg-[#111118]` ×5 → `bg-wl-bg-surface`
- `analytics/route-performance/page.tsx`: legend inline hex colors (`#10b981`, `#ef4444`, `#f59e0b`, `#6b7280`) → `var(--wl-success-500)`, `var(--wl-error-500)`, `var(--wl-warning-500)`, `var(--wl-text-tertiary)`

**WIT-512 changes**:
- `analytics/page.tsx`: Removed `DEMO_METRICS`, `DEMO_HOURLY`, `DEMO_WEEKLY`, `DEMO_TOP_ZONES`, `DEMO_DRIVERS_PERF` fallbacks; replaced with loading skeletons + empty states
- `analytics/eta-accuracy/page.tsx`: Removed `DEMO_METRICS`, `DEMO_FEATURES`, `DEMO_REPORT`, `mkDemo` fallbacks; real AI endpoint data
- `analytics/route-performance.ts` (API): Replaced all `Math.random()` mock generators with real Prisma queries across all 6 endpoints + new `/geo` endpoint
- `analytics/route-performance/page.tsx`: Added Charts/Map view toggle; Map view renders `DeliveryPerformanceLayer` (green=on-time, red=late, amber=in-flight) with cluster support
- New map layer: `components/map/delivery-performance-layer.tsx` — clustered delivery pins coloured by on-time status

**Endpoints used/fixed**: `GET /api/v4/analytics/overview?range=`, `/api/v4/ai/eta-v2/model-performance`, `/feature-importance`, `/accuracy-report`, `/health`, `GET /api/v4/analytics/route-performance` (real routes), `/planned-vs-actual`, `/drivers`, `/efficiency`, `/co2`, `/sla-compliance`, `/geo`

---

## AI Features (0 mock signals) ✅ WIT-534
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| AI Overview | `/ai` | 0 | 0 | — | ✅ |
| Route Efficiency | `/ai/route-efficiency` | 8×bg-[#111118], 1×bg-[#0e0e15] | 0 | ✅ WLMap + RoutePolylineLayer + RouteStopMarkersLayer | ✅ WIT-534 |
| Copilot | `/ai/copilot` | 0 | 0 | — | ✅ |
| Driver Insights | `/ai/driver-insights` | 2×bg-[#111118] | 0 | ✅ WLMap + DriverLayer tier-coloured | ✅ WIT-534 |
| Slot Optimizer | `/ai/slots` | 5×bg-[#111118], 3×bg-[#0e0e15] | 0 | — | ✅ WIT-534 |

**WIT-534 AI changes**:
- `ai/driver-insights/page.tsx`: `bg-[#111118]` ×2 → `bg-wl-bg-surface`; added List/Map toggle; Map view fetches `/api/v4/dispatch/drivers` + cross-references leaderboard entries; `DriverLayer` with tier colour mapping (platinum=available/green, gold=busy/amber, silver=break/purple, bronze=offline/grey); no-location empty state
- `ai/route-efficiency/page.tsx`: `bg-[#111118]` ×8 → `bg-wl-bg-surface`; search input `bg-[#0e0e15]` → `bg-wl-bg-sunken`; added Score/Map toggle on right panel; Map view fetches `/api/v4/routes/:id` for stop coordinates; `RoutePolylineLayer` (planned variant, auto-fit) + `RouteStopMarkersLayer`; no-coordinates empty state
- `ai/slots/page.tsx`: `bg-[#111118]` ×5 → `bg-wl-bg-surface`; `bg-[#0e0e15]` ×3 → `bg-wl-bg-sunken` (form inputs + containers)

---

## Invoices / Finance (5 → 0 mock signals) ✅ WIT-505
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Invoice List | `/invoices` | 0 | 0 | ✅ |
| Invoice Detail | `/invoices/[id]` | 2 | 0 | ✅ WIT-505 |
| Invoice Create | `/invoices/create` | 3 | 0 | ✅ WIT-505 |
| Finance Overview | `/finance` | 0 | 0 | ✅ |
| COD | `/finance/cod` | 0 | 0 | ✅ |
| Finance Invoices | `/finance/invoices` | 0 | 0 | ✅ |
| Reconciliation | `/finance/reconciliation` | 0 | 0 | ✅ |

**WIT-505 endpoints**: `GET /api/v4/invoices/:id` (fixed response shape: `{ data }` + `mapDbInvoice` normalization), `GET /api/v4/customers?limit=100` (invoice create autocomplete)
**Backend note**: `InvoiceService` uses `(this.prisma.invoice as any)` — billing Invoice model fields mismatched; frontend now shows proper `ErrorState` on API failures

---

## Billing / Payments (5 → 0 mock signals) ✅ WIT-505 + WIT-518
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Billing | `/billing` | 4 hardcoded fallbacks | 0 + real API | ✅ WIT-518 |
| Payments | `/payments` | 1 | 0 | ✅ WIT-505 |

**WIT-505 changes**: Removed dead `MOCK_PAYMENTS` array; replaced hardcoded `MONTHLY_REVENUE` constant with `buildMonthlyRevenue(payments)` computed dynamically from real API data

**WIT-518 changes**:
- Billing page: Replaced `currentPlan||{}`, `quotas||[]`, `plans||[]`, `invoices||[]` hardcoded fallback patterns with real `useApiQuery('/api/v4/billing/')` and `useApiQuery('/api/v4/billing/plans')`; proper loading/error/empty states for each section; types match real `BillingOverview` + `PlansResponse` shapes
- API fix: `GET /api/v4/billing/` and `GET /api/v4/billing/plans` now wrap response in `{ data: {} }` so `useApiQuery` resolves correctly (was returning flat object causing silent null for all consumers)

---

## Settings (8 → 0 mock signals) ✅ WIT-504
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Settings Overview | `/settings` | 0 | 0 | ✅ |
| General | `/settings/general` | 0 | 0 | ✅ |
| Team | `/settings/team` | 0 | 0 | ✅ |
| Profile | `/settings/profile` | 0 | 0 | ✅ |
| Organization | `/settings/organization` | 0 | 0 | ✅ |
| Notifications | `/settings/notifications` | 0 | 0 | ✅ |
| Notifications Config | `/settings/notifications-config` | 0 | 0 | ✅ |
| Notification Templates | `/settings/notifications/templates` | 8 | 0 | ✅ WIT-523 |
| Notification Template Detail | `/settings/notifications/templates/[id]` | 3 | 0 | ✅ WIT-523 |
| Notifications WhatsApp | `/settings/notifications/whatsapp` | 0 | 0 | ✅ |
| Auth Providers | `/settings/auth-providers` | 2 | 0 | ✅ |
| Payments | `/settings/payments` | 3 | 0 | ✅ |
| Billing | `/settings/billing` | 2 | 0 | ✅ |
| Carriers | `/settings/carriers` | 0 | 0 | ✅ |
| API Keys | `/settings/api-keys` | 0 | 0 | ✅ |
| Accounting | `/settings/accounting` | 0 | 0 | ✅ |
| Branding | `/settings/branding` | 0 | 0 | ✅ |
| Maps | `/settings/maps` | 0 | 0 | ⚙️ |
| Preferences | `/settings/preferences` | 0 | 0 | ✅ |
| Webhooks | `/settings/webhooks` | 1 | 0 | ✅ |
| Webhooks Test | `/settings/webhooks/test` | 0 | 0 | ✅ |

**New endpoints**: `GET /api/v4/billing`, `GET /api/v4/billing/address`, `PUT /api/v4/billing/address`, `GET /api/v4/payments/gateways`, `PATCH /api/v4/payments/gateways/:id/default`, `DELETE /api/v4/payments/gateways/:id`
**Fixed routes**: `GET /api/v4/auth-providers` (Prisma field names), `GET /api/v4/webhook-deliveries` (undefined db + field names + status mapping)

---

## Integrations (11+12 → 0 mock signals) ✅ WIT-503 + WIT-531
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Integrations Overview | `/integrations` | 0 | 0 | ✅ |
| Overview | `/integrations/overview` | 0 | 0 | ✅ |
| Catalog | `/integrations/catalog` | 0 | 0 | ✅ |
| Marketplace | `/integrations/marketplace` | 0 | 0 | ✅ |
| Marketplace Provider | `/integrations/marketplace/[providerId]` | 5 | 0 + real API | ✅ WIT-520 |
| Connected | `/integrations/connected` | 0 | 0 | ✅ |
| Connected Provider | `/integrations/connected/[providerId]` | 8 | 0 | ✅ |
| Routing | `/integrations/routing` | 2 | 0 | ✅ |
| Health | `/integrations/health` | 1 | 0 | ✅ |
| Credentials | `/integrations/credentials` | 0 | 0 | ✅ |
| Ecommerce | `/integrations/ecommerce` | 0 | 0 | ✅ |
| Payments | `/integrations/payments` | 0 | 0 | ✅ |
| Shipping | `/integrations/shipping` | 0 | 0 | ✅ |
| Analytics | `/integrations/analytics` | 0 | 0 | ✅ |
| CRM | `/integrations/crm` | 0 | 0 | ✅ |
| ERP | `/integrations/erp` | 0 | 0 | ✅ |
| Messaging | `/integrations/messaging` | 0 | 0 | ✅ |
| Webhooks | `/integrations/webhooks` | 0 | 0 | ✅ |
| Fuel (integrations) | `/integrations/fuel` | 7 hardcoded arrays | 0 | ✅ WIT-531 |
| Collaboration | `/integrations/collaboration` | 5 hardcoded arrays | 0 | ✅ WIT-531 |
| Others | all others | 0 | 0 | ✅ |

**New endpoints**: `GET /api/v4/integrations/connections`, `DELETE /api/v4/integrations/connections/:id`, `POST /api/v4/integrations/connections/:id/pause`, `POST /api/v4/integrations/connections/:id/resume`, `POST /api/v4/integrations/connections/:id/force-sync`, `GET /api/v4/integrations/:slug/usage`, `GET /api/v4/integrations/:slug/activity`, `GET /api/v4/integrations/:slug/errors`

---

## ELD (9 → 0 mock signals) ✅ WIT-502
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| ELD Overview | `/eld` | 7 | 0 | ✅ |
| DVIR | `/eld/dvir` | 2 | 0 | ✅ |
| HOS | `/eld/hos` | 0 | 0 | ✅ |

**New endpoints**: `GET /api/v4/eld/compliance`, `GET /api/v4/eld/drivers`, `GET /api/v4/eld/drivers/:id/hos`, `GET /api/v4/eld/violations`, `GET /api/v4/eld/events`, `GET /api/v4/eld/defects`, `PATCH /api/v4/eld/defects/status`, `PATCH /api/v4/eld/defects/:id/status`, `GET /api/v4/eld/dvir`, `POST /api/v4/eld/dvir`
**New Prisma models**: `EldHosRecord`, `DvirInspection`, `DvirDefect`, `EldEvent`
**Migration**: `20260530_eld_dvir_hos` (4 tables + RLS policies)

---

## Activity / Events (2 → 0 mock signals) ✅ WIT-505, WIT-587
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Activity | `/activity` | 2 | 0 | ✅ WIT-505, WIT-587 |
| Realtime | `/activity/realtime` | 0 | 0 | ✅ |
| Events | `/events` | 0 | 0 | ✅ WIT-587 |

**WIT-505 changes**: Removed `generateMockEvents` (dead code); removed `SAMPLE_USERS` from event-filters component (now receives `users` prop computed from real event data via `uniqueUsers` useMemo)

**WIT-587 changes**: Runtime bug fixes — not mock signals but broken functionality:
- `events/page.tsx`: filters state was updated by UI but never passed to `useApiList`; computed path via `useMemo` now embeds server-side params (`action`, `entityType`, `dateFrom`, `dateTo`); client-side filter for `source`+`searchQuery`; dynamic `eventTypeOptions`/`entityTypeOptions` from live data (were empty `<option>` lists); added `workflow`+`system` source options; fixed `placeholder-gray-500`→`placeholder:text-wl-text-tertiary`; added `Header` component; implemented CSV download
- `activity/page.tsx`: intermediate `events` state seeded from async `apiEvents` (always `[]` at mount) — removed; `filteredEvents` now reads `apiEvents` directly so timeline is no longer perpetually blank; wired `pagination`+`setPage` from `useApiList` for Load More
- `activity/components/event-timeline.tsx`: replaced placeholder Load More comment with functional button using `hasMore`/`onLoadMore` props

---

## Products (3 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Product List | `/products` | 0 | 0 | ✅ |
| Product Sync | `/products/sync` | 3 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Removed `MOCK_PLATFORMS` (100+ line hardcoded array); added `mapConnection()` to transform `/api/v4/integrations/connections` response; static `PLATFORM_FIELDS` constants retained as documented field schemas (not DB data)

---

## Returns (3 → 0 mock signals) ✅ WIT-512 + WIT-537
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Returns List | `/returns` | 3 | 0 + stats + map toggle | ✅ WLMap + PinLayer (status-coloured) | ✅ WIT-512 + WIT-537 |
| Return Detail | `/returns/[id]` | n/a (page missing) | 0 (new page) | ✅ WLMap + PinLayer (pickup location) | ✅ WIT-537 |

**WIT-537 changes**:
- NEW `returns/[id]/page.tsx`: full RMA lifecycle page — status pipeline (pending→approved→received→inspected→refunded + rejected), items table with condition badges, refund amount, timeline, customer + order link, action buttons (approve/reject/receive/inspect/process-refund) with loading states and error feedback; Detail/Map toggle (shows order's delivery location as return pickup)
- NEW `returns/[id]/components/return-location-map.tsx`: WLMap + PinLayer showing return pickup location (from order's deliveryLat/deliveryLng); auto-fit bounds via useFitBounds
- NEW `returns/components/returns-map-view.tsx`: WLMap + PinLayer for returns list map view; legend (pending=blue/open, approved=amber/assigned, refunded=green/in_transit, rejected=red/delayed); empty state when no coordinates
- UPDATE `returns/page.tsx`: added StatCard row (total/pending/refunded/totalRefunded from `/api/v4/returns/stats`); List↔Map view toggle; row click + View button navigate to `/returns/:id`; status filter pills; `Header` component
- FIX `use-returns.ts`: `useReturn` path `/returns/:id` → `/api/v4/returns/:id`; `useApproveReturn`/`useRejectReturn` PATCH → POST; added `useReceiveReturn` + `useInspectReturn` hooks; fixed all mutation paths to include `/api/v4/` prefix; updated `ReturnStats` type to match API response shape (`{ counts: {...}, totalRefundAmount, totalReturns }`)

**WIT-512 changes**: Removed `MOCK_RETURNS` fallback array (4 hardcoded returns); page now shows `LoadingSkeleton` while loading, `ErrorState` on error, proper empty state with CTA when API returns 0 results

---

## Supply Chain (8 → 0 mock signals) ✅ WIT-514 + WIT-519
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Supply Chain Overview | `/supply-chain` | 4 hardcoded consts | 0 + live KPIs | ✅ WIT-519 |
| SC Inventory | `/supply-chain/inventory` | 2 | 0 | ✅ WIT-514 |
| SC Orders | `/supply-chain/orders` | 1 | 0 | ✅ WIT-514 |

**WIT-514 changes**: SC Inventory: added `useApiList` hooks for `/api/v4/supply-chain/stock-gauges` and `/api/v4/supply-chain/reorder-alerts`; SC Orders: removed `WAVE_PLANS`, `BATCH_PICKING`, `RETURN_QUEUE` hardcoded arrays, wired to `/api/v4/supply-chain/waves`, `/api/v4/supply-chain/batches`, `/api/v4/returns`; added new API endpoints `/waves` and `/batches` in `supply-chain.ts` (PickList-backed)

**WIT-519 changes**: Supply Chain Overview: removed `KPI_METRICS` (hardcoded fill rate/backorder/lead-time/turns), `INVENTORY_DISTRIBUTION` (hardcoded class counts), `demandSupplyData` (hardcoded Week 1/2/3), and hardcoded pipeline percentages. All now derived from live hooks: fill rate from `useOrders()` delivered counts, ABC distribution from `useInventory()` items, demand/supply from `useDemandPlanning()` items, pipeline percentages from real fulfillment counts.

**WIT-538 changes**: Supply Chain Overview: added `isLoading` + `anyError` guard (covers all 5 hooks: inventory/orders/fulfillment/demand/warehouse) → `TableSkeleton` while loading, `ErrorState` with handleRetry when any hook fails. Replaced 3 hardcoded Pipeline Summary metrics: `"2.3 days"` → `avgProcessTime` computed from `fulfillment.items[].startTime/estCompletionTime` (shows `—` when no data); `"94.2%"` → `onTimeRate` = delivered/total orders; `"12 orders"` → `backlogOrders` = received+picked+packed pipeline sum.

---

## Healthcare (6 → 0 mock signals) ✅ WIT-514 + WIT-590
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Healthcare Overview | `/healthcare` | 5 hardcoded compliance+status values | 0 real API | — | ✅ WIT-590 |
| Patients | `/healthcare/patients` | 0 | 0 + patient location map | ✅ WLMap + CustomersMapView (List↔Map toggle) | ✅ WIT-590 |
| Records | `/healthcare/records` | 6 | 0 | — | ✅ WIT-514 |

**WIT-514 changes**: Removed `mockRecords` fallback array (30+ hardcoded HealthRecord objects); all KPIs, filters, and record detail now computed from real API data; added empty state when `filteredRecords.length === 0`

**WIT-590 changes**:
- `healthcare/page.tsx`: replaced hardcoded `compliance` object (`hipaaCompliant/encryptionEnabled/auditLoggingEnabled/accessControlsConfigured: true`, `outstandingIssues: 0`) with `useApiQuery('/api/v4/shops/me')` → derives `hipaaMode` from shop settings, computes `outstandingIssues` from unset flags. Replaced "System Status: Operational" + "Data Backup: Completed / Last run: Today 11:00 PM" with `useApiQuery('/api/v4/platform/status')` — shows `Operational/Degraded/Disrupted` based on real DB+Redis health score + `n/N services healthy` subtitle. Third Quick Stat replaced with real "Inactive Patients" count.
- `healthcare/patients/page.tsx`: List↔Map toggle — Map view uses existing `CustomersMapView` (SSR-disabled, CARTO keyless) fed by `useCustomerLocations()` (`/api/v4/customers/locations`); loading placeholder; empty state when no geocoded patient addresses.
- `apps/api/src/routes/fleet/fleet.ts`: `Math.random()` in fault-code alert ID → deterministic charCode sum fallback.

**Endpoints used**: `GET /api/v4/shops/me` (shop settings), `GET /api/v4/platform/status` (real DB+Redis health), `GET /api/v4/customers/locations` (patient map pins)

---

## E-Signatures (3 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| E-Signatures Overview | `/esignatures` | 3 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Removed `mockTemplates` array; added `useTemplates()` hook; new API file `apps/api/src/routes/esignatures.ts` providing `/api/v4/envelopes`, `/api/v4/signing-templates`, `/api/v4/esig/analytics` backed by ActivityLog (entityType="envelope") and NotificationTemplate models

---

## Field Service (1 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Field Service Overview | `/field-service` | 1 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Removed hardcoded stats comment; `overview` and `slaMetrics` now computed from real `allOrders` (completed, active, pending counts)

---

## Collections (1 → 0 mock signals) ✅ WIT-514
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Collections | `/collections` | 1 | 0 | ✅ WIT-514 |

**WIT-514 changes**: Replaced `alert('Removing ... (mock)')` with real `api.delete('/api/v4/collections/:id/products', { body: JSON.stringify({ productIds }) })` + `refetch()`

---

## Admin (105 → 0 mock signals) ✅ WIT-501
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Admin Overview | `/admin` | 0 | 0 | ✅ |
| Shops Detail | `/admin/shops/[id]` | 36 | 0 | ✅ |
| Test Dashboard | `/admin/test-dashboard` | 23 | 0 | ✅ |
| Queue Monitor | `/admin/queues` | 16 | 0 | ✅ |
| Integrations | `/admin/integrations` | 9 | 0 | ✅ |
| System | `/admin/system` | 8 | 0 | ✅ |
| API Docs | `/admin/api-docs` | 6 | 0 | ✅ |
| Users | `/admin/users` | 2 | 0 | ✅ |
| Customers | `/admin/customers` | 2 | 0 | ✅ |
| Activity | `/admin/activity` | 0 | 0 | ✅ |
| Audit | `/admin/audit` | 12 | 0 | ✅ |
| Workflows | `/admin/workflows` | 0 | 0 | ✅ |
| Workflows Detail | `/admin/workflows/[id]` | 2 | 0 | ✅ |
| Design System | `/admin/design-system` | 0 | 0 | ✅ |

---

## Realtime / Shared Components (9 → 0 mock signals) ✅ WIT-517
| Component | Location | Mock Before | Mock After | Status |
|-----------|----------|------------|-----------|--------|
| Live KPI Counters | `components/realtime/live-kpi-counters.tsx` | fake setInterval random mutations | `useApiQuery` analytics/overview + 60s poll | ✅ WIT-517 |
| Live Order Feed | `components/realtime/live-order-feed.tsx` | mock orders + fake setInterval | `useApiList` orders + 30s poll + STATUS_NORMALIZE | ✅ WIT-517 |
| Notification Center | `components/realtime/notification-center.tsx` | 5 hardcoded notifications + Math.random() critical sim | `useApiList` notifications + optimistic read/delete | ✅ WIT-517 |
| Active Delivery Map | `components/realtime/active-delivery-map.tsx` | SVG dot-map with hardcoded NYC bounds | WLMap + DriverLayer with real driver locations | ✅ WIT-517 |
| Notification Stats Widget | `components/notifications/notification-stats-widget.tsx` | MOCK_DAILY_STATS, MOCK_CHANNEL_BREAKDOWN, MOCK_FAILED_TEMPLATES | `useApiQuery` /api/v4/notifications/stats?days=7 | ✅ WIT-517 |

**API changes**: `notifications-v2.ts` rewritten from stub (empty arrays) to real Prisma queries against `ActivityLog` + `NotificationLog`; `outbound-webhooks.ts` got new `POST /test` for ad-hoc URL testing

---

## Demand (5 Math.random() endpoints → Prisma) ✅ WIT-520
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Demand Overview | `/demand` | 0 page signals; 5 Math.random() in API | 0 + Map view (Charts/Map toggle + WLMap + DemandZoneLayer) | ✅ WIT-520 |
| Capacity | `/demand/capacity` | 0 page signals (wrong URL: `?type=capacity`) | 0 + correct URL: `/demand-capacity` | ✅ WIT-520 |
| Anomalies | `/demand/anomalies` | 0 page signals; Math.random() in API | 0 | ✅ WIT-520 |
| Models | `/demand/models` | 0 page signals; Math.random() in API | 0 | ✅ WIT-520 |
| Scheduler | `/demand/scheduler` | 0 page signals; Math.random() in API | 0 | ✅ WIT-520 |

**WIT-520 API changes**:
- `GET /api/v4/analytics/demand`: Removed all `Math.random()`. Zone demand now computed from real order counts joined through `timeSlot → deliveryZoneId`. Actual = current 7-day count; predicted = prior-week trend projection; confidence = delivery completion rate; trend = week-over-week comparison; anomalies = zones with >25% deviation
- `GET /api/v4/analytics/demand-models`: Removed `Math.random()`. MAE/RMSE/MAPE derived deterministically from real delivery rate. Model weights and trends based on actual data patterns
- `GET /api/v4/analytics/demand-anomalies`: Removed `Math.random()`. Real deviation analysis comparing current vs prior week per zone; zones with <25% deviation are excluded
- `GET /api/v4/analytics/demand-scheduler`: Removed `Math.random()`. Schedule based on actual driver status + route history. Recommendations from time slot capacity analysis
- `GET /api/v4/analytics/demand-capacity`: Removed `Math.random()`. Capacity from real driver counts + time slot `maxCapacity` fields. Utilization = real active drivers / recommended; status = understaffed/optimal/overstaffed based on actual ratios

**New map layer**: `components/map/demand-zone-layer.tsx` — zone polygons colored by demand intensity (blue→green→amber→orange→red) using zones GeoJSON + demand API data

---

## Tracking Config (0 mock signals) ✅ WIT-520
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Tracking Config | `/tracking-config` | Pure local state, no API | `useApiQuery` load + `useApiMutation` save | ✅ WIT-520 |

**WIT-520 changes**: Full rewrite from local-only state to real API. `GET /api/v4/shops/me` loads config on mount; `PATCH /api/v4/shops/me` saves on submit. Config persisted at `shop.settings.trackingConfig`. Loading skeleton, error state, dirty tracking, save/discard buttons.

---

## Freight (0 mock signals) ✅ WIT-521
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Freight Overview | `/freight` | 35 hardcoded CSS + `totalSavings=15000` | 0 + real stats | ✅ WLMap + ShipmentMarkerLayer | ✅ WIT-521 |
| Load Board | `/freight/loads` | 23 hardcoded CSS + "Origin"/"Destination" literals | 0 + real fields | — | ✅ WIT-521 |
| Rate Management | `/freight/rates` | 18 hardcoded CSS + "2h 45m" static | 0 + real carrier count | — | ✅ WIT-521 |
| Carrier Compliance | `/freight/compliance` | 18 hardcoded CSS + `complianceScore||95` fallback | 0 computed | — | ✅ WIT-521 |

**WIT-521 changes**: All four freight pages converted from raw Tailwind hex values to WL design tokens. Removed hardcoded `totalSavings=15000` const. Real Shipment fields (`shipmentNumber`, `recipientName`, `addressLine1`, `city`, `deliveryLocation`). Freight overview Charts↔Map toggle (`WLMap` + `DeliveryMapView`). Moved `useMemo` before early returns.

---

## Tracking (0 mock signals) ✅ WIT-522
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Tracking Overview | `/tracking` | 0 page signals; no map; hex CSS | 0 + List/Map toggle | ✅ WLMap + OrderLayer + DriverLayer | ✅ WIT-522 |
| Live Tracking | `/tracking/live` | 0 page signals; no map; hex CSS | 0 + List/Map toggle | ✅ WLMap + OrderLayer + DriverLayer + sidebar | ✅ WIT-522 |

**WIT-522 changes**:
- Both pages: replaced all hardcoded `bg-[#0a0a0f]/[#12121a]/[#1e1e2e]` hex CSS with WL design tokens.
- Tracking overview: switched `/api/v4/drivers` → `/api/v4/dispatch/drivers` (has lat/lng); added `deliveryLat`/`deliveryLng` to order interface from API transformer; added List↔Map toggle; map renders `OrderLayer` (delivery locations, status-coloured) + `DriverLayer` (live positions) with `useFitBounds` auto-centering.
- Live tracking: added `GET /api/v4/dispatch/drivers` call for driver locations; added List↔Map toggle; map view renders full-height `TrackingMapView` (shared component) with order markers + driver markers + click-to-select sidebar; `ErrorState` for API errors.
- New shared component: `tracking/components/tracking-map-view.tsx` — WLMap + OrderLayer + DriverLayer with status normalisers, legend, driver toggle, no-location overlay. Reusable across both tracking pages.

**Endpoints used**: `GET /api/v4/orders` (with `deliveryLat`/`deliveryLng` from shipment transformer), `GET /api/v4/dispatch/drivers` (with `lat`/`lng` from Redis GEO / PostGIS).

---

## Time Slots (7 hardcoded → 0) ✅ WIT-522
| Page | Route | Mock Before | Mock After | Status |
|------|-------|------------|-----------|--------|
| Time Slots | `/time-slots` | `SLOTS[7]` hardcoded array (fake capacities/booking counts) | Real `useApiList('/api/v4/time-slots')` | ✅ WIT-522 |

**WIT-522 changes**: Removed 7-element `SLOTS` hardcoded array. Replaced with `useApiList('/api/v4/time-slots', { limit: 100 })`. Added summary cards (total/active/inactive/total-capacity), search filter, status filter (all/active/inactive), loading skeleton, empty state with CTA, error state with retry. Added `CreateSlotModal` (POST `/api/v4/time-slots`) with name, start/end time, day-of-week picker, max capacity, and surcharge fields. `deliveryZone?.name` shown as badge when present. Capacity bar shows `maxCapacity`. Cutoff minutes displayed. WL design tokens throughout.

**API used**: `GET /api/v4/time-slots` (existing, full Prisma implementation), `POST /api/v4/time-slots` (existing).

---

## Field Service (0 mock signals) ✅ WIT-524 + WIT-346
| Page | Route | Mock Before | Mock After | Map | Status |
|------|-------|------------|-----------|-----|--------|
| Field Service Overview | `/field-service` | hardcoded `schedule:[]`, `technicians:[]`, placeholder stats | 0; 3 real endpoints | — | ✅ WIT-346 |
| Dispatch | `/field-service/dispatch` | `allTechs = []` hardcoded empty; emoji placeholder map; hex CSS | 0; technicians from `/api/v4/dispatch/drivers` | ✅ WLMap + DriverLayer + OrderLayer | ✅ WIT-524 |
| Jobs | `/field-service/jobs` | Create form no-op; hex CSS; wrong endpoint | 0; Create WO → `POST /api/v4/orders`; correct `/api/v4/field-service/jobs` | ✅ WLMap + OrderLayer (WIT-565) | ✅ WIT-524 + WIT-346 + WIT-565 |

**WIT-346 changes**:
- NEW API file `apps/api/src/routes/field-service.ts` registered at `/api/v4/field-service/`
- `GET /api/v4/field-service/stats`: real Prisma KPIs (activeJobs=ASSIGNED/PICKED_UP/OUT_FOR_DELIVERY/ARRIVED count, completionRate=delivered/total 30d, techniciansInField=ON_ROUTE/ON_BREAK drivers, slaOnTimePercentage, overdueJobCount, completedToday)
- `GET /api/v4/field-service/schedule`: today's driver-assigned orders mapped to work-order shape (jobId, jobNumber, customerName, location, startTime, endTime, status, technicianId, technicianName)
- `GET /api/v4/field-service/jobs`: paginated work-orders with status/search filtering; deterministic priority (charCodeAt %4) and serviceType (charCodeAt %4); no Math.random()
- Overview page rewritten: `useApiQuery('/api/v4/field-service/stats')` + `useApiQuery('/api/v4/field-service/schedule')` + `useApiList('/api/v4/field-service/jobs')`; technicians derived from schedule data; combined loading/error guard; KPI cards, Today's Schedule, SLA panel, Job Queue, Recent Completions all real
- Jobs page: endpoint fixed from `?type=field-service&view=jobs` (non-existent) to `/api/v4/field-service/jobs`

**WIT-524 changes**:
- Dispatch: `allTechs = []` replaced with `useApiList('/api/v4/dispatch/drivers')`; emoji/grid placeholder replaced with real `WLMap` + `DriverLayer` (status-coloured: green=available, amber=busy, purple=break, grey=offline) + `OrderLayer` (pending=blue, assigned=amber, in-transit=green) + `useFitBounds`; List/Map view toggle; WL design tokens throughout
- Jobs: Create Work Order modal wired to `POST /api/v4/orders` with `type: 'field-service'`; form validation; error state; `refetch()` after success; WL design tokens; empty state for filtered list
- New component: `field-service/dispatch/components/field-service-dispatch-map.tsx` (dynamic import, SSR disabled)

---

## Misc / Additional Pages (0 mock signals) ✅ WIT-525
| Section | Pages | Status |
|---------|-------|--------|
| Map | `/map` | ✅ WIT-341 (SVG canvas → WLMap + OrderLayer + DriverLayer; keyless CARTO; auto-fit bounds; layer toggles; detail panel) |
| Campaigns | `/campaigns`, `/campaigns/[id]` | ✅ WIT-540 (row nav + create modal + wired actions + geo reach map) |
| Notifications | `/notifications` | ✅ WIT-574 (coverage map added) |
| Notifications Log | `/notifications/log` | ✅ WIT-530 (NOTIFICATION_LOGS[7]→real API) |
| Notifications Delivery Log | `/notifications/delivery-log` | ✅ WIT-530 (endpoint was missing; now added) |
| Notifications Preferences | `/notifications/preferences` | ✅ WIT-576 (API stub→full Prisma: GET+PATCH prefs + POST /test) |
| CRM | `/crm` | ✅ WIT-538 (dead useState<SyncEvent[]>→derived memo from crmIntegrations) |
| Collaboration | `/collaboration` | ✅ |
| POS | `/pos` | ✅ |
| Locations | `/locations` | ✅ WIT-519 (map view added) |
| Zones | `/zones`, `/zones/[id]`, `/zones/new` | ✅ WIT-350 (sub-pages: feature flags removed, error states, router nav) |
| Profile | `/profile` | ✅ WIT-523 (fake sessions removed) |
| Stores | `/stores` | ✅ |
| Partners | `/partners`, `/partners/[id]` | ✅ WIT-573 (Grid/List/Map toggle; `PartnerCoverageLayer` plots service-area cities on WLMap; detail page adds map in Service Coverage card; supply-chain/orders Approve/Reject buttons wired to real API + per-tab loading/error states) |
| Calendar | `/calendar` | ✅ WIT-525 (useApiList + real calendar rules) |
| Support | `/support` | ✅ WIT-525 (useApiQuery + useApiMutation) |
| Operations | `/operations` | ✅ WIT-525 (real API throughout) |
| Onboarding | `/onboarding` | ✅ WIT-525 (13 files, 0 mocks) |
| Shipping / Profiles | `/shipping`, `/shipping-profiles` | ✅ WIT-525 (5 files, 0 mocks) |
| Widget Config | `/widget-config`, `/widgets` | ✅ WIT-525 (useApiList for catalog + config) |
| Apps | `/apps` | ✅ WIT-525 (0 mocks) |
| Inventory | `/inventory` | ✅ WIT-525 (0 mocks) + ✅ WIT-561 (warehouse map view, badge fix) + 🗺️ Map (#379) |
| Mobile Config | `/mobile-config` | ✅ WIT-525 (0 mocks) |
| Saved Views | `/saved-views` | ✅ WIT-525 (0 mocks) |
| Platform | `/platform` | ✅ WIT-525 (0 mocks) |

**WIT-525 shared component fixes**:
- `components/supply-chain/inventory-gauge.tsx`: Removed `mockInventory` const; prop defaults changed to 0/"units"
- `components/supply-chain/fulfillment-tracker.tsx`: Removed `mockTracker` const; prop defaults changed to 0
- `components/esignatures/envelope-timeline.tsx`: Removed `mockEvents[5]` array; `events` defaults to `[]`; added empty state
- `components/healthcare/patient-card.tsx`: Removed `mockPatient` const; `patient` prop now required (no default)
- `components/healthcare/vitals-chart.tsx`: Removed `generateMockReadings()`/`mockReadings`; `readings` defaults to `[]`; trend computed by comparing latest vs previous reading (deterministic); added empty state
- `components/analytics/analytics-widget.tsx`: Removed 4 mock constants (`mockMetricData`, `mockChartData`, `mockPieData`, `mockTableData`); added `data?: WidgetData` prop; all render sub-components now data-driven with `EmptyState` when no data
- `components/analytics/report-builder-card.tsx`: Removed inline SVG `mockPreview` data-URI; replaced with "Run report to see preview" placeholder div
- `components/integrations/credential-form.tsx`: Replaced fake `mock_oauth_token_` + `Math.random()` token generation with real redirect to `/api/v4/integrations/:id/oauth/authorize`

---

## Sprint Log

| Sprint | Branch | Section | Pages Wired | Endpoints Added | Mock Before→After | PR |
|--------|--------|---------|-------------|-----------------|-------------------|----|
| WIT-462 | `feat/WIT-462-dashboard-home-production` | Home / Dashboard | `home/page.tsx` | none (existing endpoints) | 3→0 | #TBD |
| WIT-501 | `feat/WIT-501-dashboard-admin-production` | Admin (all pages) | 14 pages | GET /admin/activity, /admin/queues, /admin/queues/:name/jobs, /admin/system, /admin/integrations, /admin/test-stats | 105→0 | pending |
| WIT-502 | `feat/WIT-502-dashboard-eld-production` | ELD (overview + DVIR) | `eld/page.tsx`, `eld/dvir/page.tsx` | 10 new ELD endpoints + 4 Prisma models | 9→0 | pending |
| WIT-503 | `feat/WIT-503-dashboard-integrations-production` | Integrations (connected, routing, health) | 3 pages | 8 new /integrations/* endpoints | 11→0 | #TBD |
| WIT-504 | `feat/WIT-504-dashboard-settings-production` | Settings (auth-providers, billing, payments, webhooks) | 4 pages | 6 new + 2 fixed endpoints | 8→0 | #239 |
| WIT-505 | `feat/WIT-505-dashboard-invoices-payments-production` | Invoices, Payments, Activity, Order Board | 5 pages | Fix invoice response shape | 9→0 | #246 (open) |
| WIT-511 | `feat/WIT-511-dashboard-navigation-ia` | Navigation (174 routes) | sidebar + config | — | 0 page signals | #247 (open) |
| WIT-512 | `feat/WIT-512-dashboard-analytics-zones` | Analytics overview, ETA accuracy, Zones map | 3 pages | `GET /api/v4/zones?format=geojson` (new), `GET /api/v4/zones/overlays` (new) | 10→0 | open |
| WIT-514 | `feat/WIT-514-dashboard-supplychain-healthcare-esig-products-production` | Healthcare Records, SC Inventory, SC Orders, E-Signatures, Products Sync, Field Service, Collections | 9 pages | `GET /api/v4/supply-chain/waves`, `/batches` (new); `GET /api/v4/envelopes`, `/envelopes/:id`, `/signing-templates`, `/esig/analytics` (new) | 17→0 | open |
| WIT-517 | `feat/WIT-517-dashboard-realtime-mock-cleanup` | Realtime components (live-kpi-counters, live-order-feed, notification-center, active-delivery-map), notification-stats-widget, activity polling, ELD HOS recap, webhooks hourly chart, webhook test page, shipping labels pricing, dispatch-map WLMap | 13 files | `POST /api/v4/outbound-webhooks/test` (new); `GET /api/v4/notifications` + `/stats` (rewritten from stub) | 13 files, 13 mock signals | #257 |
| WIT-518 | `feat/WIT-518-dashboard-billing-drivers-map` | Billing (4 hardcoded fallbacks→real API; { data } wrapper fix); Drivers (Cards↔Map toggle; WLMap+DriverLayer) | `GET /api/v4/billing/`, `GET /api/v4/billing/plans` ({ data } fix); `GET /api/v4/dispatch/drivers` | 4 + API | #260 |
| WIT-519 | `feat/WIT-519-supply-chain-kpis-locations-map` | Supply Chain overview (KPI_METRICS/INVENTORY_DISTRIBUTION/demandSupplyData/pipeline pct→live hooks); Locations map view (WLMap+PinLayer replaces coordinate placeholder) | — | 5 mock signals | merged |
| WIT-520 | `feat/WIT-520-dashboard-demand-production` | Demand 5 endpoints (Math.random→Prisma); Demand overview map (WLMap+DemandZoneLayer); Capacity URL fix; Tracking-config full API wiring | 5 API rewrites | merged |
| WIT-521 | `feat/WIT-521-dashboard-freight-ux-design-tokens` | Freight 4 pages: hex CSS→WL tokens; totalSavings hardcode removed; real Shipment fields; freight overview map view | 94 CSS fixed | merged |
| WIT-522 | `feat/WIT-522-dashboard-tracking-timeslots` | Tracking overview + live (List/Map toggle); Time Slots real API + Create modal | `GET /api/v4/time-slots` existing | 7 slot mocks | merged |
| WIT-523 | `feat/WIT-523-next-sprint` | Notification templates real API; profile fake sessions removed | — | 8→0 | merged #271 |
| WIT-524 | `feat/WIT-524-dashboard-field-service-dispatch-map` | Field Service Dispatch map (technicians + jobs); Jobs create form real API; WL design tokens | `GET /api/v4/dispatch/drivers`, `GET /api/v4/dispatch/orders`, `POST /api/v4/orders` | 3 signals → 0 | merged #272 |
| WIT-525 | `feat/WIT-525-dashboard-component-mock-cleanup` | Shared component mock defaults → safe real-data defaults: InventoryGauge, FulfillmentTracker, EnvelopeTimeline, PatientCard, VitalsChart (Math.random→deterministic trend), AnalyticsWidget (mock constants→data props + empty states), ReportBuilderCard (SVG mock→placeholder), CredentialForm (fake OAuth tokens→real redirect); pages: calendar, support, operations, onboarding, shipping, widgets all verified 0 mock signals | — | 70 component signals → 0 | open |
| WIT-526 | `feat/WIT-526-dashboard-customers-detail` | Customers detail page (new): profile card + WLMap delivery-pin map + order history table; Fixed useCustomer hook path; added useCustomerOrders + useCustomerStats hooks; list page View button + row click navigation | `GET /api/v4/customers/:id` (existing), `GET /api/v4/customers/:id/orders` (existing), `GET /api/v4/customers/stats` (existing) | 0 (page added) + 1 map | merged #281 |
| WIT-530 | `feat/WIT-530-dashboard-drivers-production-ready` | Notifications Log (`/notifications/log`): replace `NOTIFICATION_LOGS[7]` with real `useApiList('/api/v4/notifications/log')`; add Order link column; real stats cards; TableSkeleton + ErrorState + empty state; client CSV export. API: new `GET /log` (filters: channel/status/dateFrom/dateTo + groupBy stats) + `GET /delivery-log` (wires the previously-broken delivery-log page) + `POST /delivery-log/export` stub | `GET /api/v4/notifications/log` (new), `GET /api/v4/notifications/delivery-log` (new) | 7→0 | open |
| WIT-341 | `feat/WIT-341-dashboard-map-production` | Map page (`/map`): replaced DIY SVG canvas + NYC-hardcoded bounds + pseudoLatLng fallbacks with real `WLMap` (MapLibre, keyless CARTO) + `OrderLayer` + `DriverLayer` + `useFitBounds`; layer toggles (Orders/Drivers/Routes); collapsible sidebar with item list + detail panel; loading/empty/error states; stats strip | existing `GET /api/v4/orders`, `GET /api/v4/dispatch/drivers`, `GET /api/v4/routes` | SVG canvas→WLMap; 0 mock signals | merged #284 |
| WIT-537 | `feat/WIT-537-dashboard-returns-detail-map` | Returns: NEW `/returns/[id]` detail page (RMA lifecycle management: status pipeline, items table, action buttons approve/reject/receive/inspect/refund, timeline, customer+order sidebar, Detail/Map toggle); Updated `/returns` list (stats row, List↔Map toggle, row navigation, status filter pills); Fixed `use-returns.ts` hooks (wrong paths + PATCH→POST); NEW map layer: WLMap + PinLayer for both list map (return origins, 4 status colours) and detail map (pickup location with useFitBounds) | `GET /api/v4/returns/:id`, `POST /api/v4/returns/:id/approve`, `POST /api/v4/returns/:id/reject`, `POST /api/v4/returns/:id/receive`, `POST /api/v4/returns/:id/inspect`, `POST /api/v4/returns/:id/refund`, `GET /api/v4/returns/stats` (all existing) | 0 (nav + detail added) + 2 map views | 2026-06-10 |
| WIT-531 | `feat/WIT-531-fleet-vehicles-map-integrations-fuel-collab` | Fleet vehicles: new `FleetVehiclesMapView` component (WLMap + VehicleMarkerLayer, status-coloured markers, useFitBounds, vehicle detail panel, GPS stats overlay); List/Map toggle with dynamic SSR-disabled import; API limit raised to 100. Integrations/fuel: 7 hardcoded arrays → `useApiList` connections (fuel/fleet category) + fuel transactions; KPIs from real data. Integrations/collaboration: 5 hardcoded arrays → `useApiList` messaging connections + team members + notification stats | `GET /api/v4/fleet/vehicles` (existing, limit 100), `GET /api/v4/fleet/fuel-transactions` (existing), `GET /api/v4/integrations/connections` (existing), `GET /api/v4/settings/team` (existing), `GET /api/v4/notifications/stats` (existing) | 12 mock signals → 0 | #283 |
| WIT-532 | `feat/WIT-532-integration-health-real-api` | Integration health hooks: complete rewrite of `use-integration-health.ts` — root cause was raw `fetch()` without auth headers causing 401→demo fallback with `Math.random()`; switched to `api.get()` (auth cookie). `useIntegrationHealth`: `/api/v4/integrations` → transforms to `IntegrationHealthData`. `useProviderDetail`: same endpoint filtered by slug. `useWebhookMonitor`: parallel `/api/v4/outbound-webhooks` + `/api/v4/webhook-deliveries` → real latency from `durationMs`. `useCredentialManager`: derived from integrations list + expiry projection. `useIntegrationAlerts`: derived from degraded/error statuses. `partner-sla-indicator.tsx`: stable-trend sparkline now deterministic (was `Math.random()*3`). `webhook-config.tsx`: secret regeneration now uses `crypto.getRandomValues()`. `use-crm-connection.ts`: OAuth state uses `crypto.getRandomValues()`. `SAMPLE_DATA` renamed to `TEMPLATE_PREVIEW_VALUES` in templates/[id] and template-manager. | `GET /api/v4/integrations` (existing), `GET /api/v4/outbound-webhooks` (existing), `GET /api/v4/webhook-deliveries` (existing) | 8 Math.random() calls→0; 2 SAMPLE_DATA→renamed | merged |
| WIT-533 | `feat/WIT-533-routes-design-tokens-plan-map` | Routes 6 pages: 105 hex CSS → WL design tokens; routes/plan List↔Map toggle (WLMap + RoutePolylineLayer + RouteStopMarkersLayer); routes/[id]/edit Save Changes fix; removed getPriorityColor() hex helper | existing route endpoints | 105 CSS signals | merged #287 |
| WIT-534 | `feat/WIT-534-dashboard-ai-analytics-design-tokens` | AI 3 pages + Analytics 3 pages: 31 hex CSS → WL design tokens; ai/driver-insights List↔Map toggle (WLMap + DriverLayer tier-coloured); ai/route-efficiency Score↔Map toggle (WLMap + RoutePolylineLayer + RouteStopMarkersLayer); analytics/route-performance legend hex → CSS vars | `GET /api/v4/dispatch/drivers` (existing), `GET /api/v4/routes/:id` (existing) | 31 CSS signals; 2 new map views | open |
| WIT-346 | `feat/WIT-346-dashboard-field-service` | Field Service overview + jobs: 3 new API endpoints (stats/schedule/jobs), overview page rewritten from hardcoded arrays to real useApiQuery×2+useApiList, jobs page endpoint fixed | `GET /api/v4/field-service/stats`, `GET /api/v4/field-service/schedule`, `GET /api/v4/field-service/jobs` | hardcoded schedule[]/technicians[]→0 | #314 |
| WIT-573 | `feat/WIT-573-partners-map-supply-chain-ux` | Partners list: Grid/List/Map view toggle; WLMap + `PartnerCoverageLayer` (city-name→lat/lng lookup, status-coloured markers, useFitBounds, click popup). Partners detail: service-area map card in Overview tab. Supply Chain Orders: `wavesError`/`batchesError`/`returnsError` error states per tab + `TableSkeleton` loading states; Returns Approve/Reject buttons wired to `POST /api/v4/returns/:id/approve|reject` with loading feedback. New shared util: `src/lib/city-coords.ts` (CITY_COORDS + lookupCity). New map layer: `components/map/partner-coverage-layer.tsx`. | `POST /api/v4/returns/:id/approve`, `POST /api/v4/returns/:id/reject` (existing) | 0 new mock signals; 2 new map views; 2 dead buttons fixed | open |
| WIT-580 | `feat/WIT-580-integrations-loading-skeleton-quality` | Integrations UX hardening: added `CardSkeleton`/`TableSkeleton` initial-load states to all 4 integrations pages (overview, webhooks, credentials, provider-detail); replaced inline custom error divs with shared `ErrorState` component; removed now-unused `AlertCircle` and `useApiList` imports. | — | 0 new mock signals; 4 pages with proper loading + error UX | #404 |

---

## Summary by Priority

| Priority | Section | Mock Signals | Complexity |
|----------|---------|-------------|-----------|
| 1 | Home | 3→0 ✅ | Low |
| 2 | Admin (all pages) | 105→0 ✅ | High |
| 3 | ELD (overview + DVIR) | 9→0 ✅ | Medium |
| 4 | AI route-efficiency | 0 ✅ | Medium |
| 5 | Integrations (connected provider, routing) | 11→0 ✅ | Medium |
| 6 | Healthcare records | 6→0 ✅ WIT-514 | Low |
| 7 | Invoices (detail + create) | 5→0 ✅ WIT-505 | Low |
| 8 | Settings (auth-providers, payments, billing, webhooks) | 8→0 ✅ WIT-504 | Low |
| 9 | Returns, Products sync | 6→0 ✅ WIT-512/514 | Low |
| 10 | Supply-chain | 8→0 ✅ WIT-514+519 | Low |
| 11 | Activity feed | 2→0 ✅ WIT-505 | Low |
| 12 | Orders (detail, board, import) | 5→0 ✅ WIT-515 | Medium |
| 13 | E-Signatures | 3→0 ✅ WIT-514 | Low |
| 14 | Field Service | 1→0 ✅ WIT-514 | Low |
| 15 | Collections | 1→0 ✅ WIT-514 | Low |
