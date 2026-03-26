# Sprint 9.2 — Dashboard API Wiring & Design System Upgrade

**Date:** 2026-03-18
**Branch:** `sprint-9.2-dashboard-api-wiring-design`
**Theme:** Connect the dashboard to the backend API, replace mock data with typed hooks, and upgrade core UI infrastructure.

## What Changed

### Before Sprint 9.2
- 250 dashboard pages, 200 with hardcoded mock data (80%)
- Only 12 pages made real API calls (5%)
- No generic data-fetching hooks
- No loading/error/empty state components
- Pages rendered static arrays defined inside the component

### After Sprint 9.2
- Generic API hook infrastructure (`useApiQuery`, `useApiList`, `useApiMutation`)
- 7 typed domain hooks (orders, drivers, zones, customers, returns, dashboard-stats)
- 5 critical pages rewired to real API data with loading/error/empty states
- New UI components: LoadingSkeleton, ErrorState, DataTable, Pagination
- Dashboard layout with collapsible sidebar, breadcrumbs, responsive header
- All remaining pages can incrementally adopt the same hook pattern

## Agent Contributions

### AR (CTO) — API Hook Infrastructure [backend-patterns]
- `apps/dashboard/src/hooks/use-api.ts` (280 lines) — useApiQuery, useApiList, useApiMutation with debounced search, pagination, refetch
- `apps/dashboard/src/lib/swr-config.tsx` — SWR provider configuration
- **Zero external dependencies** — all hooks use React useState/useEffect

### RG (Backend Lead) — Domain Hooks [api-design]
- `use-orders.ts` (135 lines) — useOrders, useOrder, useCreateOrder, useUpdateOrderStatus, useOrderStats
- `use-drivers.ts` (122 lines) — useDrivers, useDriver, useDriverLocations, useUpdateDriverStatus
- `use-zones.ts` (74 lines) — useZones, useZone, useCreateZone, useUpdateZone
- `use-customers.ts` (84 lines) — useCustomers, useCustomer with tier support
- `use-returns.ts` (149 lines) — useReturns, useReturn, mutations for approve/reject/refund
- `use-dashboard-stats.ts` (87 lines) — useDashboardStats, useRecentOrders, useDeliveryHeatmap

### NK (Frontend Lead) — Critical Page Rewiring [frontend-patterns]
- Home dashboard page (620 lines) — stat cards, recent orders, live stats from useOrderStats + useDrivers
- Orders page (282 lines) — paginated table, status filters, search from useOrders hook
- Drivers page (722 lines) — driver grid with status, ratings, deliveries from useDrivers hook

### DM (Frontend) — Customer & Returns Rewiring [frontend-patterns]
- Customers page (705 lines) — tier filtering, pagination, search from useCustomers
- Returns page (1,017 lines) — multi-status workflow, timeline, stats from useReturns + mutations

### VS (Component Dev) — UI Infrastructure [frontend-patterns]
- `loading-skeleton.tsx` (110 lines) — Skeleton, TableSkeleton, CardSkeleton with animated shimmer
- `error-state.tsx` (76 lines) — error display with retry button and custom actions
- `data-table.tsx` (494 lines) — generic typed DataTable with sort, row click, loading mode
- `pagination.tsx` (223 lines) — page navigation with page size selector

### SP (Full-stack) — Layout & Navigation [frontend-patterns]
- Dashboard layout (101 lines) — collapsible sidebar, sticky header, breadcrumbs
- Responsive design with mobile hamburger menu support

## Stats

- **Hook files created:** 8 (931 lines total)
- **Pages rewired to API:** 5 critical pages
- **UI components added:** 4 (903 lines)
- **Layout upgraded:** sidebar nav + responsive header
- **Mock data eliminated:** 5 pages converted from hardcoded → live API

## Migration Path for Remaining 195 Pages

Every remaining page can be converted with this pattern:
```tsx
// Before (mock data):
const orders = [{ id: '1', ... }, { id: '2', ... }];

// After (real API):
import { useOrders } from '@/hooks/use-orders';
const { items: orders, loading, error, refetch, pagination } = useOrders(filters);
```

The hook infrastructure handles loading states, error recovery, pagination, and search automatically.
