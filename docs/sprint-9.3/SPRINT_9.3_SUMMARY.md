# Sprint 9.3 — Tech Debt Blitz: Route Registration, Hook Rewiring & Build Stabilization

**Date:** 2026-03-20
**Branch:** `sprint-9.3-tech-debt-blitz`
**Theme:** Fix critical infrastructure gaps — register all missing API routes, rewrite mock-data hooks, clean up the build, and stabilize the platform for production.

## What Changed

### Before Sprint 9.3

- 22 API route files existed but were NEVER registered in server.ts (including returns, driver-scoring, invoices)
- 12 hooks (5,958 lines) contained embedded mock data instead of calling the API
- 156 of 167 dashboard pages used hardcoded mock data (93% mock)
- 1,030 TypeScript errors from stale `.next/types` cache
- Duplicate UI components: 3 tables, 3 cards, 2 modals, 2 badges
- Admin pages stranded outside `(dashboard)` route group
- No CI/CD pipeline

### After Sprint 9.3

- ALL 61 API route files registered in server.ts (was 39/61 → now 61/61)
- All 12 mock-data hooks rewritten to real API calls (5,958 → ~1,400 lines, 76% reduction)
- ~27 additional pages rewired to real API (was 11 → ~38 API-connected pages)
- Stale `.next` cache cleaned, admin pages migrated to `(dashboard)` route group
- UI components consolidated: metric-card + stat-card → card, dialog + modal → dialog, status-badge → badge
- CI/CD pipeline created (`.github/workflows/ci.yml`)
- Validators test import path confirmed correct

## Agent Contributions

### AR (CTO) — Register 22 Missing API Routes [backend-patterns]

- Updated `apps/api/src/server.ts` to register all 22 unregistered routes
- Critical: Returns (`/api/v4/returns`), driver-scoring (`/api/v4/driver-scoring`), invoices (`/api/v4/invoices`) are now live
- Also registered: couriers, ecommerce, health, pod, settings, notifications-v2, payments-v2, webhook routes, workflow routes
- **Now 61/61 route files registered** (was 39/61)

### RG (Backend Lead) — Rewrite 6 Mock-Data Hooks Batch 1 [api-design]

- `use-fleet.ts` (698 → 138 lines) — 8 hooks: useVehicles, useMaintenanceEvents, useFuelTransactions, useFleetOverview
- `use-notifications.ts` (645 → 114 lines) — 7 hooks with CRUD mutations
- `use-field-service.ts` (626 → 138 lines) — 8 hooks: useWorkOrders, useTechnicians, useDispatchMap
- `use-pos.ts` (558 → 128 lines) — 6 hooks: useTransactions, useTerminals, useSalesTrends
- `use-supply-chain.ts` (507 → 123 lines) — 9 hooks: useInventory, useFulfillment, useReorderAlerts
- `use-freight.ts` (462 → 108 lines) — 7 hooks: useFreightLoads, useLaneAnalytics, useCarrierScorecard

### PK (Sr. Backend) — Rewrite 6 Mock-Data Hooks Batch 2 [api-design]

- `use-healthcare.ts` (591 → 167 lines) — usePatients, useMedications, useEncounters, useFHIRResources
- `use-analytics.ts` (456 → 124 lines) — CRUD dashboard/report hooks with mutations
- `use-esignatures.ts` (442 → 123 lines) — useSigningSession, envelope/template mutations
- `use-eld.ts` (358 → 129 lines) — useDriverHOS, useViolations, useDVIRDefects
- `use-product-sync.ts` (312 → 76 lines) — useSyncJobs, mapping CRUD, schedule hooks
- `use-financial-data.ts` (303 → 89 lines) — useInvoices, usePayments, useAutoReconcile

### NK (Frontend Lead) — Fix Dashboard Build [frontend-patterns]

- Deleted stale `.next/types` directory (eliminated ~1,000 false TS errors)
- Migrated all admin pages from `src/app/admin/` → `src/app/(dashboard)/admin/`
- Fixed TS errors: button/badge variants, StatCard props, Modal props, type annotations
- Fixed import paths for relocated admin pages

### DM (Frontend) — Rewire 30 Pages Batch 1 [frontend-patterns]

- Fully rewired: dispatch, payments, billing, shipments pages
- Added API hook imports to fleet, analytics, finance, demand, delivery, freight, locations, activity, calendar pages
- Pattern: removed MOCK\_\* arrays → useApiList + LoadingSkeleton + ErrorState

### SP (Full-stack) — Rewire 30 Pages Batch 2 [frontend-patterns]

- Rewired 24 pages: products, collections, campaigns, partners, notifications, pos, tracking, eld/_, esignatures/_, events, crm/\*, collaboration, zones, map, support, inventory
- Each page: removed mock data → useApiList → TableSkeleton + ErrorState
- 6 requested pages didn't exist (skipped): partners/courier-rates, partners/courier-tracking, partners/performance, notifications/templates, notifications/logs, pos/terminals

### VS (Component Dev) — Consolidate Duplicate UI Components [frontend-patterns]

- Merged metric-card + stat-card → card.tsx (with re-exports for compatibility)
- Merged dialog + modal → dialog.tsx (Modal re-exported as alias)
- Merged status-badge → badge.tsx (with status variant support)
- analytics/data-table → re-exports from ui/data-table.tsx

### AM (Integration) — CI/CD Pipeline [deployment-patterns]

- Created `.github/workflows/ci.yml`
- Pipeline: pnpm 9.15.0 + Node.js 20 → install → build shared → typecheck → test → build API
- Runs on push/PR to main

### KS (QA Lead) — Test Verification [tdd-workflow]

- Confirmed validators test import path correct (`../index`)
- Confirmed test script present in package.json

## Stats

- **API routes registered:** 22 new (39 → 61 total, 100% coverage)
- **Mock hooks rewritten:** 12 hooks (5,958 → ~1,400 lines, 76% reduction)
- **Dashboard pages rewired:** ~27 additional pages (11 → ~38 API-connected)
- **TS errors eliminated:** ~1,000 from stale cache + admin page fixes
- **UI components consolidated:** 4 merges (table, card, modal, badge)
- **CI/CD:** Pipeline created
- **Admin pages migrated:** 13 files moved to (dashboard) route group

## Remaining Tech Debt

- ~129 dashboard pages still on mock data (target for Sprint 9.4+)
- Prisma schema still has 0 models (all `(prisma as any)`)
- Full test suite triage still needed (~762 baseline failures)
- Type consolidation needed (dashboard types vs @witylogix/types)
- Environment configuration documentation
