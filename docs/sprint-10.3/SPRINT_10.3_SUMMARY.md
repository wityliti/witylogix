# Sprint 10.3 — Dashboard Integration Fixes

**Date:** 2026-03-23
**Branch:** sprint-10.1-runtime-verification
**Status:** COMPLETE

## Problems Fixed

### 1. Login 422 Errors

- **Root cause:** Browser console showed `422 Unprocessable Entity` on login because the API requires `shopDomain` and password min 8 characters
- **Fix:** Added `NEXT_PUBLIC_SHOP_DOMAIN=demo.witylogix.io` to `.env.local` so the auth-context always sends shopDomain with login requests

### 2. API 404 Errors (drivers, orders/stats, zones, etc.)

- **Root cause:** 6 React hooks (`use-drivers.ts`, `use-orders.ts`, `use-customers.ts`, `use-returns.ts`, `use-zones.ts`, `use-dashboard-stats.ts`) were calling API paths without `/api/v4/` prefix. `API_BASE` is `http://localhost:8000` but routes live at `/api/v4/*`
- **Fix:** Added `/api/v4/` prefix to all 10 affected API paths across 6 hook files

### 3. Unauthenticated Users Not Redirected to Login

- **Root cause:** Middleware's `isDashboardRoute` regex didn't cover `/` (root), `/home`, `/zones`, `/routes`, `/reports`, `/billing`, etc.
- **Fix:** Added `pathname === '/'` check and expanded regex to cover all dashboard routes including `/home`, `/routes`, `/zones`, `/reports`, `/billing`, `/fleet`, `/freight`, `/returns`, `/pos`, `/supply-chain`

### 4. Login Redirect Param Mismatch

- **Root cause:** Middleware sets `?redirect=/orders` but login page read `returnUrl`
- **Fix:** Login page now reads `redirect` param (fallback to `returnUrl` for backward compat)

## Test Results

```
Running 11 tests using 1 worker

  ✓  [chromium] › e2e/auth.spec.ts › login page loads
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

## Files Changed

| File                                              | Change                              |
| ------------------------------------------------- | ----------------------------------- |
| `apps/dashboard/src/hooks/use-drivers.ts`         | Added `/api/v4` prefix to API paths |
| `apps/dashboard/src/hooks/use-orders.ts`          | Added `/api/v4` prefix to API paths |
| `apps/dashboard/src/hooks/use-customers.ts`       | Added `/api/v4` prefix to API paths |
| `apps/dashboard/src/hooks/use-returns.ts`         | Added `/api/v4` prefix to API paths |
| `apps/dashboard/src/hooks/use-zones.ts`           | Added `/api/v4` prefix to API paths |
| `apps/dashboard/src/hooks/use-dashboard-stats.ts` | Added `/api/v4` prefix to API paths |
| `apps/dashboard/src/middleware.ts`                | Expanded protected route matching   |
| `apps/dashboard/src/app/(auth)/login/page.tsx`    | Fixed redirect param reading        |
| `apps/dashboard/.env.local`                       | Added NEXT_PUBLIC_SHOP_DOMAIN       |
| `apps/dashboard/e2e/*.spec.ts`                    | Updated E2E tests for robustness    |
| `apps/dashboard/playwright.config.ts`             | Increased timeout to 45s            |

## Team

- **AM (Integration):** API path prefix fixes across hooks
- **NK (Frontend Lead):** Middleware auth guard expansion
- **DM (Frontend):** Login redirect param fix
- **KS (QA Lead):** E2E test hardening
