# 06 — Dashboard Development Guide

## Overview

The dashboard is a Next.js 15 app at `apps/dashboard/`. It has 180 pages across every domain of the logistics platform. As of Sprint 9.5, 173/180 pages (96%) are wired to the real API. 7 pages are intentionally static (design-system docs, settings hub, integrations docs).

## Route Structure

```
apps/dashboard/src/app/
├── (auth)/           # Login, register, forgot-password
├── (dashboard)/      # All authenticated pages (180 pages)
│   ├── home/         # Dashboard home
│   ├── orders/       # Order management (8 pages)
│   ├── drivers/      # Driver management (2 pages)
│   ├── dispatch/     # Dispatch center (2 pages)
│   ├── returns/      # Returns/RMA
│   ├── fleet/        # Fleet management (5 pages)
│   ├── integrations/ # 31 integration pages
│   ├── settings/     # 18 settings pages
│   ├── admin/        # 13 admin pages
│   └── ...           # 100+ more domain pages
├── layout.tsx        # Root layout
├── page.tsx          # Landing/redirect
└── error.tsx         # Error boundary
```

**CRITICAL:** All pages MUST be inside `(dashboard)/`. Pages outside this route group don't get the sidebar, header, or auth protection. Always verify after each sprint:

```bash
ls apps/dashboard/src/app/ | grep -v '(auth)\|(dashboard)\|layout\|page\|error\|loading\|not-found\|offline'
```

## API Hook Infrastructure

Built in Sprint 9.2, the hook system provides a clean abstraction over the API:

### Base Hooks (`hooks/use-api.ts`)

```typescript
// Fetch a single entity
const { data, loading, error, refetch } = useApiQuery<T>(url);

// Fetch a paginated list
const { items, loading, error, refetch, pagination } = useApiList<T>(url);

// Create/update/delete
const { mutate, loading, error } = useApiMutation(url, "POST");
```

### Domain Hooks

| File                     | Hooks Exported                                            |
| ------------------------ | --------------------------------------------------------- |
| `use-orders.ts`          | useOrders, useOrder, useCreateOrder, useUpdateOrderStatus |
| `use-drivers.ts`         | useDrivers, useDriver, useDriverLocations                 |
| `use-customers.ts`       | useCustomers (with tier support)                          |
| `use-returns.ts`         | useReturns + mutations for lifecycle transitions          |
| `use-zones.ts`           | useZones, useZone, useCreateZone                          |
| `use-dashboard-stats.ts` | useDashboardStats, useRecentOrders                        |
| `use-fleet.ts`           | useVehicles, useMaintenanceEvents, useFuelTransactions    |
| `use-notifications.ts`   | useNotifications + CRUD mutations                         |
| `use-supply-chain.ts`    | useInventory, useFulfillment, useReorderAlerts            |
| `use-realtime.ts`        | WebSocket client, useOrderUpdates, useDriverLocations     |

### API Client (`lib/api.ts`)

Low-level fetch wrapper used by all hooks:

```typescript
import { api } from "@/lib/api";

const orders = await api.get("/api/v4/orders");
const created = await api.post("/api/v4/orders", { data: orderData });
```

## UI Components

### Core Components (`components/ui/`)

| Component       | File                   | Purpose                                                |
| --------------- | ---------------------- | ------------------------------------------------------ |
| Button          | `button.tsx`           | Primary/secondary/ghost/danger buttons                 |
| Badge           | `badge.tsx`            | Status badges with 6 variants + status variant support |
| Card            | `card.tsx`             | Card container with CardHeader/CardTitle/CardContent   |
| DataTable       | `data-table.tsx`       | Full-featured data table with sort/filter/pagination   |
| Dialog          | `dialog.tsx`           | Modal dialogs (also aliased as Modal)                  |
| Input           | `input.tsx`            | Form inputs                                            |
| LoadingSkeleton | `loading-skeleton.tsx` | Skeleton loader for loading states                     |
| ErrorState      | `error-state.tsx`      | Error display with retry button                        |
| EmptyState      | `empty-state.tsx`      | Empty data state with action button                    |
| Pagination      | `pagination.tsx`       | Page navigation component                              |

### Layout Components (`components/layout/`)

| Component                | Purpose                        |
| ------------------------ | ------------------------------ |
| `header.tsx`             | Top navigation bar             |
| `responsive-sidebar.tsx` | Collapsible sidebar navigation |
| `responsive-nav.tsx`     | Mobile navigation              |
| `responsive-table.tsx`   | Mobile-friendly tables         |

## Design Standards

### Color System

```
Page background:   bg-zinc-950
Card background:   bg-zinc-900
Inner elements:    bg-zinc-800
Borders:           border-zinc-800 or border-white/[0.08]
Primary accent:    var(--wl-primary)
Success:           var(--wl-success)
Text primary:      text-white
Text secondary:    text-zinc-400
```

### Spacing

```
Page padding:       p-6
Card padding:       p-6
Section gap:        gap-6
Inner element gap:  gap-4
Compact gap:        gap-2
```

### Responsive Breakpoints

```
Mobile:   default (< 768px)
Tablet:   md: (768px+)
Desktop:  lg: (1024px+)
Wide:     xl: (1280px+)
```

## Converting a Mock Page to API

The standard conversion pattern used across 134+ pages in Sprint 9.4:

1. Add `'use client';` at top
2. Import: `useApiList` or `useApiQuery` from `@/hooks/use-api`
3. Import: `LoadingSkeleton` from `@/components/ui/loading-skeleton`
4. Import: `ErrorState` from `@/components/ui/error-state`
5. Remove all `const MOCK_*` or `const data = [...]` arrays
6. Add hook call with the correct API endpoint
7. Add `if (loading)` and `if (error)` guards
8. Wire the hook's returned data into the existing UI
