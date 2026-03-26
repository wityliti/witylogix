# 04 — Coding Standards

These rules are non-negotiable. Every agent prompt must include the relevant rules. Violations cause rework.

## Universal Rules

1. **TypeScript everywhere** — No plain JavaScript files
2. **NAMED imports only** — No default imports from internal modules
3. **`cn()` from `@/lib/utils`** — For conditional classnames, always
4. **No test secret keys** — Use string concatenation: `"sk_live_" + "FAKE0TEST..."`, never a full key literal

## Frontend (Dashboard)

### Tailwind CSS
- **Version 3.4** — NOT v4. We pin to v3.4.
- **Dark theme** — `bg-zinc-950` for page, `bg-zinc-900` for cards, `bg-zinc-800` for inner elements
- **CSS variables** — Use `var(--wl-primary)`, `var(--wl-success)`, etc. for brand colors
- **Spacing** — `gap-6` between sections, `p-6` inside cards
- **Transitions** — `transition-all duration-200` for hover effects

### Component Variants (STRICT)

**Button variants:**
```typescript
"primary" | "secondary" | "ghost" | "danger"
```
There is NO "outline" variant. Never use it.

**Badge variants:**
```typescript
"default" | "success" | "warning" | "danger" | "info" | "primary"
```
There is NO "destructive" or "secondary" badge variant.

### Page Structure

Every dashboard page must follow this pattern:
```tsx
'use client';

import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface ItemType {
  id: string;
  // ...fields
}

export default function PageName() {
  const { items, loading, error, refetch } = useApiList<ItemType>('/api/v4/endpoint');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Page content */}
    </div>
  );
}
```

### Hooks

| Hook | Use For |
|------|---------|
| `useApiQuery<T>(url)` | Single entity fetch (detail pages) |
| `useApiList<T>(url)` | Paginated list fetch |
| `useApiMutation(url, method)` | POST/PATCH/DELETE operations |
| `useOrders()` | Order-specific hooks |
| `useDrivers()` | Driver-specific hooks |
| `useCustomers()` | Customer-specific hooks |
| `useReturns()` | Returns/RMA hooks |
| `useZones()` | Zone management hooks |
| `useDashboardStats()` | Dashboard KPI data |

### Route Groups

All dashboard pages live under `apps/dashboard/src/app/(dashboard)/`. The parentheses create a Next.js route group. Auth pages live under `(auth)/`.

## Backend (API)

### Fastify Route Pattern
```typescript
import { FastifyPluginAsync } from "fastify";

const routes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const items = await (prisma as any).modelName.findMany({
      where: { orgId: request.user.orgId },
    });
    return reply.send({ data: items });
  });
};

export default routes;
```

### Prisma Access
```typescript
// Current pattern (all codebase):
const result = await (prisma as any).order.findMany({ ... });

// Preferred pattern (use typed helpers when possible):
import { db } from "@witylogix/db/helpers";
const result = await db.order.findMany({ ... });
```

### API Versioning
All routes are prefixed with `/api/v4/`. Routes are registered in `apps/api/src/server.ts`.

## File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Pages | `page.tsx` | `orders/page.tsx` |
| Components | `kebab-case.tsx` | `loading-skeleton.tsx` |
| Hooks | `use-kebab-case.ts` | `use-orders.ts` |
| Utils | `kebab-case.ts` | `api.ts` |
| Types | `types.ts` or `index.ts` | `packages/types/src/index.ts` |
| Tests | `*.test.ts` / `*.test.tsx` | `schemas.test.ts` |
| Core modules | `kebab-case.ts` | `refund-calculator.ts` |
