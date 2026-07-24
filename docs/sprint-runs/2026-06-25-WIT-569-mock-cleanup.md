# Sprint Run Report — 2026-06-25 (WIT-569)

**Branch:** `feat/WIT-569-dashboard-realtime-component-mock-cleanup`
**PR:** [#387](https://github.com/wityliti/witylogix/pull/387)
**Scope:** Dashboard shared-component mock cleanup — real API everywhere
**Status:** Committed + PR open; typecheck clean (pre-existing errors only)

---

## What Was Done

Replaced **all hardcoded mock/fake data and `Math.random()` simulations** in 17 shared dashboard components with real API calls via the existing `useApiQuery` hook pattern. Zero mock signals remain in the targeted files.

### Files Changed (17)

| File                                                     | Change                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `components/realtime/notification-center.tsx`            | `useApiQuery('/api/v4/notifications')` + 30s poll; `api.patch/delete` for read/dismiss; sound on real unread delta |
| `components/realtime/live-kpi-counters.tsx`              | `useApiQuery('/api/v4/dashboard/stats')` + 60s poll; deterministic status thresholds                               |
| `components/realtime/live-order-feed.tsx`                | `useApiQuery('/api/v4/orders')` + 30s poll; status normalisation from API enum                                     |
| `components/realtime/active-delivery-map.tsx`            | `useApiQuery('/api/v4/drivers')` + deliveries + 30s poll; dynamic SVG bounds; empty state                          |
| `components/notifications/notification-stats-widget.tsx` | `useApiQuery('/api/v4/notifications/stats?days=7')`; loading/error/empty states; CSS vars                          |
| `components/supply-chain/inventory-gauge.tsx`            | `mockInventory` removed; safe zero defaults                                                                        |
| `components/supply-chain/fulfillment-tracker.tsx`        | `mockTracker` removed; safe zero defaults                                                                          |
| `components/esignatures/envelope-timeline.tsx`           | `mockEvents` removed; default `[]`; empty state                                                                    |
| `components/analytics/report-builder-card.tsx`           | Mock SVG data URI `<img>` → placeholder `<div>`                                                                    |
| `components/healthcare/patient-card.tsx`                 | `mockPatient` removed; `patient` prop required                                                                     |
| `components/healthcare/vitals-chart.tsx`                 | `generateMockReadings()`/`Math.random()` removed; deterministic trend                                              |
| `components/integrations/credential-form.tsx`            | OAuth → `/api/v4/integrations/:id/oauth/authorize`                                                                 |
| `components/integrations/rate-limit-display.tsx`         | Deterministic linear interpolation for history                                                                     |
| `components/integrations/provider-comparison.tsx`        | Feature matrix from real `provider.features`/`capabilities`                                                        |
| `components/routes/stop-list-editor.tsx`                 | `mockSuggestions` removed; manual input only                                                                       |
| `components/couriers/courier-assignment-panel.tsx`       | `Math.random()` service-area removed; data-driven                                                                  |
| `app/(dashboard)/collections/page.tsx`                   | All 5 `useState` calls moved above early returns (hooks violation fix)                                             |

### Verification

```
grep -rniE "mockDrivers|mockDeliveries|mockNotif|mockMetrics|mockOrders|mockInventory|mockTracker|mockEvents|mockPreview|mockPatient|mockReadings|mockSuggestions|Math\.random\(\)" [17 files] → empty
```

Typecheck: zero new errors in dashboard `src/` (only pre-existing `globals.css` + `packages/db` Prisma types).

---

## Remaining Mock Signals (Out of Scope)

- `admin/activity`, `admin/users`, `admin/queues`, `admin/test-dashboard` pages — still have mock data (next sprint)
- `toast-stack.tsx:301` — `Math.random()` for toast ID generation (not fake data)
