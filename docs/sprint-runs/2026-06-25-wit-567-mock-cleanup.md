# Sprint Run Report — 2026-06-25 (WIT-567)

**Sprint:** WIT-567 — Realtime Components + Shared Component Mock Cleanup  
**Branch:** `feat/WIT-567-realtime-components-shared-mock-cleanup`  
**PR:** [#388](https://github.com/wityliti/witylogix/pull/388)  
**Status:** COMPLETE — 20 files changed, 1507 deletions (mock removed), 689 insertions (real API calls)

---

## Goal

Replace ALL mock/dummy/placeholder/hardcoded data in realtime and shared dashboard components
with real API calls. Zero `Math.random()`, zero hardcoded constant arrays, zero `setInterval`
fake-data loops.

---

## Files Changed

### API

| File                                      | Change                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/notifications-v2.ts` | Rewrote stub to full Prisma implementation. Added paginated `GET /`, `GET /stats?days=N` (daily + channel breakdown + failed templates), `GET /status` health check |

### Realtime Components

| File                               | Removed                                                                                    | Added                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `realtime/live-kpi-counters.tsx`   | `mockMetrics` (4 KPIs), `setInterval(5000)` with random deltas                             | `useDashboardStats()` hook                                    |
| `realtime/live-order-feed.tsx`     | `mockOrders` (4 people), `setInterval(8000)` fake injection                                | `useApiList('/api/v4/orders')` + 30s polling                  |
| `realtime/notification-center.tsx` | 5 `mockNotifications`, `setInterval(15000)` random critical alerts                         | `useApiList('/api/v4/notifications')` + 60s polling when open |
| `realtime/active-delivery-map.tsx` | 5 mock drivers (NYC coords), `setTimeout(800ms)` init, `setInterval(3000)` random movement | `useApiList('/api/v4/dispatch/drivers')` + dynamic SVG bounds |

### Pages

| File                            | Removed                                                                          | Added                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `app/(dashboard)/home/page.tsx` | `recentOrders[5]`, `mockDrivers[8]`, hardcoded `'$4,250.00'` + percentage trends | `useDashboardStats`, `useOrders`, `useDrivers`                           |
| `app/(dashboard)/eld/page.tsx`  | `MOCK_DRIVERS[6]`                                                                | `useApiList('/api/v4/drivers')` + `deriveDriverStatus()` from violations |

### Shared Components

| File                                          | Change                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `notifications/notification-stats-widget.tsx` | Removed `MOCK_DAILY_STATS`, `MOCK_CHANNEL_BREAKDOWN`, `MOCK_FAILED_TEMPLATES`; wired to `/api/v4/notifications/stats` |
| `analytics/analytics-widget.tsx`              | Removed `mockMetricData`, `mockChartData`, `mockPieData`, `mockTableData`; all modes show proper empty states         |
| `analytics/report-builder-card.tsx`           | Removed `mockPreview` SVG data-URI; replaced with "Run report to see preview" placeholder                             |
| `integrations/provider-comparison.tsx`        | Removed `getMetricValue()` with `Math.random()` and hardcoded features matrix                                         |
| `integrations/credential-form.tsx`            | Removed `mock_oauth_token_` + `Math.random()` token generation                                                        |
| `integrations/rate-limit-display.tsx`         | Removed `Math.random()` in `generateHistoricalChart`; uses only real `rateLimit.current`                              |
| `healthcare/vitals-chart.tsx`                 | Removed `generateMockReadings()` / `mockReadings` with `Math.random()` vitals                                         |
| `healthcare/patient-card.tsx`                 | Removed `mockPatient` default; `patient` prop now required                                                            |
| `esignatures/envelope-timeline.tsx`           | Removed `mockEvents` (5 fake events); `events` defaults to `[]`                                                       |
| `supply-chain/fulfillment-tracker.tsx`        | Removed `mockTracker` defaults                                                                                        |
| `supply-chain/inventory-gauge.tsx`            | Removed `mockInventory` constant; all props now required                                                              |
| `routes/stop-list-editor.tsx`                 | Removed `mockSuggestions` (5 NYC addresses) and filter logic                                                          |

### Hooks

| File                             | Change                                                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/use-shipment-tracking.ts` | Removed mock data fallback in catch block (random orderId, carrier, fake events); fixed env var `REACT_APP_WS_URL` → `NEXT_PUBLIC_WS_URL` |

---

## Verification

- `pnpm --filter @witylogix/dashboard typecheck` — zero errors in sprint files (pre-existing Prisma/CSS errors unrelated to sprint)
- `grep -rn "Math\.random()" apps/dashboard/src/components/{realtime,analytics,integrations,healthcare,routes,supply-chain,notifications,esignatures}/ apps/dashboard/src/hooks/use-shipment-tracking.ts` — **empty output**
- All 20 files committed on branch, pushed, PR #388 open against `main`
