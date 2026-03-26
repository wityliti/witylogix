# Sprint 10.4 — Production Readiness & API Route Hardening

**Date:** 2026-03-24
**Branch:** sprint-10.1-runtime-verification
**Status:** COMPLETE

## Sprint Retrospective

### What Went Wrong

The platform was far from production-ready despite multiple sprints. The CLI tool failed to start the API, 5 API routes were returning 500 errors (silently swallowed by `safeRegister`), 3 routes were 404, and the dashboard was making calls to nonexistent endpoints. The root causes fell into three categories:

1. **Schema drift** — Route code referenced Prisma model fields that don't exist (`metadata` vs `settings`, `syncedAt` vs `lastSyncAt`, `Payment` vs `PaymentTransaction`)
2. **Silent failures** — `safeRegister` catches import errors without surfacing them, so broken routes appear as 404 instead of startup failures
3. **Missing routes** — Dashboard hooks call `/api/v4/dashboard/stats` and `/api/v4/notifications` but no handlers existed

### What Was Fixed

| # | Issue | Route | Root Cause | Fix | Owner |
|---|-------|-------|------------|-----|-------|
| 1 | 500 on zones list | `/api/v4/zones` | Prisma `findMany` had both `include` AND `select` (mutually exclusive) | Removed duplicate `include` block | AM |
| 2 | 500 on analytics | `/api/v4/analytics/overview` | Referenced `tenantDb.payment` — no `Payment` model exists | Changed to `tenantDb.paymentTransaction` | PK |
| 3 | 500 on customers sort | `/api/v4/customers` | Sort field `syncedAt` doesn't exist on Customer model | Changed to `lastSyncAt` | AM |
| 4 | 500 on settings | `/api/v4/settings` | Referenced `metadata` field — Shop has `settings` | Replaced all `metadata` → `settings` | RG |
| 5 | Missing /orders/stats | `/api/v4/orders/stats` | No `/stats` route; `/:id` caught "stats" as ID param | Added GET `/stats` before `/:id` | RG |
| 6 | Silent billing failure | `/api/v4/billing` | `PlanTier` type not exported from `@witylogix/db` | Added `export type { PlanTier }` | PK |
| 7 | 404 dashboard stats | `/api/v4/dashboard/stats` | No route file existed | Created `dashboard-stats.ts` with aggregated queries | SP |
| 8 | 404 notifications | `/api/v4/notifications` | `notifications-v2.ts` only had `/status`, not `/` | Added GET `/` returning empty list | NK |
| 9 | CLI tsx resolution | `cli.sh` | Hardcoded tsx path breaks across platforms | Added `resolve_tsx()` with multi-strategy fallback | DM |
| 10 | E2E cold start timeout | `auth.spec.ts` | First test hits cold Next.js compilation (>15s) | Increased timeout to 60s for first test | KS |

### Action Items Per Team Member

**AR (CTO):**
- Mandate that every new API route has a corresponding integration test before merge
- Set up a CI pipeline to run `safeRegister` audit — any silently failed route must block PR

**RG (Backend Lead):**
- Audit ALL routes for schema field mismatches using a script that cross-references Prisma schema with route code
- Replace `safeRegister` with a strict mode for production that throws on import failure

**PK (Sr. Backend):**
- Ensure ALL Prisma types used across the codebase are exported from `@witylogix/db`
- Create a shared `model-fields.ts` reference file generated from Prisma schema

**AM (Integration):**
- Write integration tests for every API route that verify 200 status with valid auth
- Create a route health-check script that tests all registered routes

**SP (Full-stack):**
- Ensure every dashboard hook has a corresponding API route
- Create stub routes for all hooks that currently 404 (field-service, freight, pos, supply-chain, etc.)

**NK (Frontend Lead):**
- Audit all hooks to ensure they gracefully handle 404/500 responses without crashing the UI
- Add error boundaries around every page that makes API calls

**DM (Frontend):**
- Test CLI tool on macOS, Linux, and CI environments
- Add platform detection and dependency checks to `cli.sh`

**VS (Component Dev):**
- Add loading and error states to all data-fetching components
- Ensure skeleton screens don't block indefinitely

**KS (QA Lead):**
- Add API smoke tests to CI (hit every registered route with auth and expect 200)
- Maintain E2E test suite — add tests for new pages as they're built

**ZR (AI Engineer):**
- Build a `safeRegister` audit tool that lists all routes, their registration status, and any import errors
- Create automated schema-drift detection for route files

## Test Results

```
Running 11 tests using 1 worker

  ✓  [chromium] › e2e/auth.spec.ts › login page loads (11.1s)
  ✓  [chromium] › e2e/auth.spec.ts › login with valid credentials
  ✓  [chromium] › e2e/auth.spec.ts › login with invalid credentials shows error
  ✓  [chromium] › e2e/dashboard.spec.ts › dashboard home loads with data
  ✓  [chromium] › e2e/dashboard.spec.ts › orders page loads
  ✓  [chromium] › e2e/dashboard.spec.ts › drivers page loads
  ✓  [chromium] › e2e/dashboard.spec.ts › routes page loads
  ✓  [chromium] › e2e/dashboard.spec.ts › settings page loads
  ✓  [chromium] › e2e/dashboard.spec.ts › zones page loads
  ✓  [chromium] › e2e/dashboard.spec.ts › analytics page loads
  ✓  [chromium] › e2e/dashboard.spec.ts › customers page loads

  11 passed (1.1m)
```

## API Route Verification (All Authenticated)

```
✅ 200  /api/v4/customers
✅ 200  /api/v4/zones
✅ 200  /api/v4/orders
✅ 200  /api/v4/orders/stats
✅ 200  /api/v4/settings
✅ 200  /api/v4/drivers
✅ 200  /api/v4/billing/plans
✅ 200  /api/v4/analytics/overview
✅ 200  /api/v4/dashboard/stats
✅ 200  /api/v4/returns
✅ 200  /api/v4/notifications
```

## Files Changed

| File | Change |
|------|--------|
| `apps/api/src/routes/zones.ts` | Removed duplicate `include` block (Prisma select/include conflict) |
| `apps/api/src/routes/analytics.ts` | `payment` → `paymentTransaction`, fixed status enum case |
| `apps/api/src/routes/customers.ts` | `syncedAt` → `lastSyncAt` sort field |
| `apps/api/src/routes/settings.ts` | `metadata` → `settings` on Shop model |
| `apps/api/src/routes/orders.ts` | Added GET `/stats` route before `/:id` |
| `apps/api/src/routes/dashboard-stats.ts` | **NEW** — Dashboard stats aggregation endpoint |
| `apps/api/src/routes/notifications-v2.ts` | Added GET `/` returning empty paginated list |
| `apps/api/src/server.ts` | Registered dashboard-stats route |
| `packages/db/src/index.ts` | Added `export type { PlanTier }` |
| `apps/dashboard/src/hooks/use-dashboard-stats.ts` | Graceful 404 handling for heatmap |
| `apps/dashboard/e2e/auth.spec.ts` | Increased cold-start timeout to 60s |
| `cli.sh` | Portable `resolve_tsx()`, increased API timeout to 25s |

## Team

- **AR (CTO):** Sprint oversight, process improvements
- **RG (Backend Lead):** Settings metadata→settings fix, orders/stats route
- **PK (Sr. Backend):** PlanTier export, analytics payment model fix
- **AM (Integration):** Customers sortBy fix, zones Prisma conflict fix
- **SP (Full-stack):** Dashboard stats route creation
- **NK (Frontend Lead):** Notifications stub route, heatmap graceful degradation
- **DM (Frontend):** CLI tool tsx resolution fix
- **VS (Component Dev):** Loading state improvements
- **KS (QA Lead):** E2E test timeout hardening
- **ZR (AI Engineer):** safeRegister audit tooling
