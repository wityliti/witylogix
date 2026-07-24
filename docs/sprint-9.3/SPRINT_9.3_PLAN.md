# Sprint 9.3 — Tech Debt Blitz: Route Registration, Hook Rewiring & Build Stabilization

**Date:** 2026-03-20
**Branch:** `sprint-9.3-tech-debt-blitz`
**Theme:** Fix the critical infrastructure gaps that prevent the platform from actually working end-to-end. Register all 22 missing API routes, rewrite 12 mock-data hooks to call real API, clean up the build, and stabilize tests.

## Problem Statement

The tech debt audit revealed that the dashboard is 93% mock data, 22 API route files are never registered (including returns and driver-scoring built in Sprint 9.1), and the TypeScript build has 1,030 errors from stale cache. This sprint attacks the foundations so future page-wiring sprints can move fast.

## Deliverables

### 1. Register All 22 Missing API Routes (AR — CTO) [backend-patterns]

- Add all 22 unregistered route files to `apps/api/src/server.ts`
- Endpoints: couriers, custom-webhooks, driver-scoring, ecommerce, health, invoices, magento-webhooks, notification-preferences, notifications-v2, outbound-webhooks, payments-v2, pod, returns, settings, shopify-webhooks, shopify-workflow-bridge, webhook-deliveries, woocommerce-webhooks, workflow-delivery, workflow-drivers, workflow-executions, workflow-orders
- This unblocks ALL dashboard hooks that try to call these endpoints

### 2. Rewrite 6 Critical Mock-Data Hooks (RG — Backend Lead) [api-design]

- Convert using Sprint 9.2 `useApiQuery`/`useApiList`/`useApiMutation` pattern
- Priority hooks: `use-fleet` (698 lines), `use-notifications` (645 lines), `use-field-service` (626 lines), `use-pos` (558 lines), `use-supply-chain` (507 lines), `use-freight` (462 lines)
- Each hook rewrites from hardcoded arrays → real API calls with loading/error/pagination

### 3. Rewrite 6 Remaining Mock-Data Hooks (PK — Sr. Backend) [api-design]

- `use-healthcare` (591 lines), `use-analytics` (456 lines), `use-esignatures` (442 lines), `use-eld` (358 lines), `use-product-sync` (312 lines), `use-financial-data` (303 lines)
- Same pattern as Deliverable 2

### 4. Fix Dashboard Build — Stale .next Cleanup + TS Errors (NK — Frontend Lead) [frontend-patterns]

- Delete stale `.next/types` directory
- Fix genuine TS errors (PageProps type constraints, type-only imports used as values)
- Target: 0 TypeScript errors in dashboard
- Move admin pages from `src/app/admin/` → `src/app/(dashboard)/admin/`

### 5. Consolidate Duplicate UI Components (VS — Component Dev) [frontend-patterns]

- Merge `ui/table.tsx` + `analytics/data-table.tsx` → canonical `ui/data-table.tsx`
- Merge `ui/metric-card.tsx` + `ui/stat-card.tsx` → canonical `ui/card.tsx` with variant prop
- Merge `ui/dialog.tsx` + `ui/modal.tsx` → canonical `ui/dialog.tsx`
- Merge `ui/status-badge.tsx` → extend `ui/badge.tsx` with status variants
- Update all imports across the codebase

### 6. Rewire 30 Critical Dashboard Pages — Batch 1 (DM — Frontend) [frontend-patterns]

- Convert the top 30 most-used pages from mock data to API hooks
- Priority pages: dispatch, billing, payments, invoices, shipments, fleet/_, shipping/_, analytics/_, finance/_, demand/\*
- Each page: replace hardcoded arrays with hook calls, add LoadingSkeleton/ErrorState

### 7. Rewire 30 Dashboard Pages — Batch 2 (SP — Full-stack) [frontend-patterns]

- Convert next 30 pages: locations, routes/_, products, collections, campaigns/_, partners/_, notifications/_, pos/_, tracking/_, eld/\*
- Same pattern as Deliverable 6

### 8. Test Suite Triage & Stabilization (KS — QA Lead) [tdd-workflow]

- Run full vitest suite, document pass/fail baseline
- Fix validators test import path (`../index` not `../schemas`)
- Fix top 50 test failures
- Target: < 100 remaining failures (down from ~762)

### 9. CI/CD Pipeline Setup (AM — Integration) [deployment-patterns]

- Create `.github/workflows/ci.yml`
- Stages: install → typecheck → lint → test → build
- Run on PR to main and push to main
- Cache pnpm store for speed

### 10. README & CHANGELOG Update (ZR — AI Engineer) [coding-standards]

- Update README with Sprint 9.1-9.3 features
- Add returns/RMA, driver scoring, email templates, dispatch, API hook infrastructure
- Update CHANGELOG with all changes since Sprint 9.0

## Success Criteria

- [ ] All 61 API route files registered in server.ts (was 39/61)
- [ ] All 12 mock-data hooks converted to real API calls
- [ ] 0 TypeScript errors in dashboard build
- [ ] 60 additional pages wired to real API (was 11, target 71)
- [ ] < 100 test failures (down from ~762)
- [ ] CI/CD pipeline running on GitHub
- [ ] Zero duplicate UI component patterns
