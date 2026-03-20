# Witylogix Platform — Technical Debt Audit

**Date:** 2026-03-20
**Auditor:** AR (CTO)
**Methodology:** engineering:tech-debt skill — Impact (1-5) × Risk (1-5) × (6 - Effort) scoring

## Executive Summary

The platform has accumulated significant technical debt across 9+ sprints. The most critical issues are:

1. **156 of 167 dashboard pages still use hardcoded mock data** (93% mock)
2. **22 API route files exist but are never registered in `server.ts`** — including `returns`, `driver-scoring`, `invoices`, `couriers`
3. **12 hooks (5,958 lines) contain embedded mock data** instead of calling the API
4. **1,030 TypeScript errors** in the dashboard, mostly from stale `.next/types` cache after page migration
5. **Duplicate UI components** — 3 table variants, 3 card variants, 2 modal variants, 2+ badge variants
6. **No Prisma schema** — `schema.prisma` has 0 models; all DB access uses `(prisma as any)`
7. **Admin pages still outside `(dashboard)` route group** — missed during Sprint 9.2 migration
8. **666 test files** but unknown pass rate; validators test import path keeps reverting

---

## Category 1: Code Debt

### CD-1: 12 Hooks with Embedded Mock Data (5,958 lines)
- **Impact:** 5 | **Risk:** 5 | **Effort:** 3 | **Priority:** 30
- **Hooks:** use-analytics (456), use-eld (358), use-esignatures (442), use-field-service (626), use-financial-data (303), use-fleet (698), use-freight (462), use-healthcare (591), use-notifications (645), use-pos (558), use-product-sync (312), use-supply-chain (507)
- **Fix:** Rewrite each hook to use `useApiQuery`/`useApiList`/`useApiMutation` from Sprint 9.2 infrastructure
- **Estimated effort:** 2-3 sprints to convert all 12

### CD-2: 156 Dashboard Pages with Hardcoded Mock Data
- **Impact:** 5 | **Risk:** 5 | **Effort:** 2 | **Priority:** 40
- **Categories:** integrations (32), settings (20), orders (8), routes (6), fleet (5), demand (5), shipping (4), partners (4), notifications (4), freight (4), design-system (4), analytics (4), + 56 more
- **Fix:** Each page follows the same conversion pattern from Sprint 9.2
- **Estimated effort:** 5-8 sprints at 20-30 pages per sprint

### CD-3: Duplicate UI Components
- **Impact:** 3 | **Risk:** 3 | **Effort:** 3 | **Priority:** 18
- **Tables:** `ui/data-table.tsx`, `ui/table.tsx`, `analytics/data-table.tsx` — three separate table implementations
- **Cards:** `ui/card.tsx`, `ui/metric-card.tsx`, `ui/stat-card.tsx` — three card variants with overlapping APIs
- **Modals:** `ui/dialog.tsx` and `ui/modal.tsx` — two dialog implementations
- **Badges:** `ui/badge.tsx`, `ui/status-badge.tsx` + domain-specific badges that should extend the base
- **Fix:** Consolidate to one canonical component per type; deprecate duplicates

### CD-4: Admin Pages Outside (dashboard) Route Group
- **Impact:** 2 | **Risk:** 3 | **Effort:** 5 | **Priority:** 10
- `apps/dashboard/src/app/admin/` has 7+ pages (activity, api-docs, customers, design-system, integrations, logs, page.tsx) that were missed during Sprint 9.2 migration
- **Fix:** Move to `(dashboard)/admin/` and update imports

---

## Category 2: Architecture Debt

### AD-1: 22 Unregistered API Route Files
- **Impact:** 5 | **Risk:** 5 | **Effort:** 5 | **Priority:** 20
- **Unregistered routes:** couriers, custom-webhooks, driver-scoring, ecommerce, health, invoices, magento-webhooks, notification-preferences, notifications-v2, outbound-webhooks, payments-v2, pod, returns, settings, shopify-webhooks, shopify-workflow-bridge, webhook-deliveries, woocommerce-webhooks, workflow-delivery, workflow-drivers, workflow-executions, workflow-orders
- Only 39 of 61 route files (.ts, excluding .d.ts) are registered in `server.ts`
- **Critical:** Sprint 9.1 built `returns` and `driver-scoring` route files but they were never registered — the dashboard hooks call endpoints that don't exist
- **Fix:** Register all 22 routes in `server.ts` with proper prefixes

### AD-2: No Prisma Schema Models
- **Impact:** 4 | **Risk:** 4 | **Effort:** 2 | **Priority:** 32
- `schema.prisma` has 0 models. All code uses `(prisma as any).modelName`
- The platform has 80+ "models" referenced in code but no schema validation
- **Fix:** Define proper Prisma models, run migrations, remove `(prisma as any)` casts

### AD-3: Dashboard ↔ API Type Mismatch
- **Impact:** 4 | **Risk:** 4 | **Effort:** 3 | **Priority:** 24
- Dashboard hooks define their own TypeScript types for Order, Driver, Customer, etc.
- API routes define separate Zod schemas for the same entities
- `@witylogix/types` package exists but many hooks/pages don't import from it
- **Fix:** Consolidate all entity types into `@witylogix/types`, import everywhere

---

## Category 3: Test Debt

### TD-1: Unknown Test Suite Health
- **Impact:** 4 | **Risk:** 5 | **Effort:** 3 | **Priority:** 30
- 666 test files exist across the monorepo
- Previous sessions reported ~762 failures baseline
- `validators/src/__tests__/schemas.test.ts` import path keeps reverting to `'../schemas'` instead of `'../index'`
- **Fix:** Run full test suite, triage failures, fix critical tests, establish CI baseline

### TD-2: No Dashboard Component Tests for New Components
- **Impact:** 3 | **Risk:** 3 | **Effort:** 3 | **Priority:** 18
- Sprint 9.2 added `loading-skeleton.tsx`, `error-state.tsx`, `empty-state.tsx`, `data-table.tsx` (new), `pagination.tsx` — none have tests
- Sprint 9.1 pages (dispatch, returns, driver performance) have no tests
- **Fix:** Write unit tests for all new UI components

---

## Category 4: Infrastructure Debt

### ID-1: Stale `.next/types` Causing 1,030 TypeScript Errors
- **Impact:** 4 | **Risk:** 3 | **Effort:** 5 | **Priority:** 16
- After migrating pages from root to `(dashboard)`, the `.next/types/` directory still references old paths
- Errors like: `Cannot find module '../../../../src/app/activity/page.js'`
- **Fix:** Delete `.next` directory, add to `.gitignore` if not already, rebuild

### ID-2: No CI/CD Pipeline
- **Impact:** 4 | **Risk:** 5 | **Effort:** 2 | **Priority:** 36
- No GitHub Actions, no automated tests, no lint checks on PR
- All quality checks are manual
- **Fix:** Create `.github/workflows/ci.yml` with typecheck, lint, test, build stages

### ID-3: Missing Environment Configuration
- **Impact:** 3 | **Risk:** 4 | **Effort:** 4 | **Priority:** 14
- `.env.example` exists but no documentation on required variables
- API client uses empty string as default `API_BASE` — works in dev proxy but not production
- **Fix:** Document all env vars, add validation on startup

---

## Category 5: Documentation Debt

### DD-1: Outdated README
- **Impact:** 2 | **Risk:** 2 | **Effort:** 4 | **Priority:** 8
- README was updated in Sprint 8.x but doesn't reflect Sprints 9.0-9.2 changes
- Missing: returns/RMA system, driver scoring, email templates, dispatch command center
- **Fix:** Update README with current feature set

---

## Prioritized Remediation Plan

| Rank | Item | Priority Score | Sprint |
|------|------|---------------|--------|
| 1 | CD-2: Mock data pages (batch 1 — 30 critical pages) | 40 | 9.3 |
| 2 | ID-2: CI/CD pipeline | 36 | 9.3 |
| 3 | AD-2: Prisma schema models | 32 | 9.3 |
| 4 | CD-1: Mock data hooks (batch 1 — 6 critical hooks) | 30 | 9.3 |
| 5 | TD-1: Test suite triage | 30 | 9.3 |
| 6 | AD-3: Type consolidation | 24 | 9.4 |
| 7 | AD-1: Register 22 API routes | 20 | 9.3 |
| 8 | CD-3: Component deduplication | 18 | 9.4 |
| 9 | TD-2: New component tests | 18 | 9.4 |
| 10 | ID-1: Stale .next cleanup | 16 | 9.3 |
| 11 | ID-3: Environment config | 14 | 9.4 |
| 12 | CD-4: Admin page migration | 10 | 9.3 |
| 13 | DD-1: README update | 8 | 9.3 |
