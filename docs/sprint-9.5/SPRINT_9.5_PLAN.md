# Sprint 9.5 — Prisma Type Safety, Design Polish & Big Features

**Date:** 2026-03-20
**Branch:** `sprint-9.5-prisma-types-design-polish`
**Theme:** Fix the Prisma schema root file so `prisma generate` works, add typed DB client exports, redesign the top 10 dashboard pages with the frontend-design skill, build real-time tracking map, and add WebSocket support.

## Current State
- 173/180 pages API-wired (96%)
- 4,472 lines of Prisma schema across 44 files in `schema/` dir — but root `schema.prisma` is empty
- 520 `(prisma as any)` references — no type safety on DB queries
- Dashboard pages functional but visually inconsistent — user wants "best designed"
- No real-time updates (WebSocket/SSE) — all data is request/response

## Deliverables

### 1. Fix Prisma Schema Root & Generate Types (AR — CTO) [postgres-patterns]
- Update `schema.prisma` with proper `generator` and `datasource` blocks pointing to `schema/` dir via `prismaSchemaFolder` preview feature
- Export typed Prisma client from `packages/db/src/index.ts`
- Add type-safe model helpers so services can drop `(prisma as any)` gradually

### 2. Redesign Home Dashboard (NK — Frontend Lead) [frontend-design]
- Complete redesign of `(dashboard)/home/page.tsx` using frontend-design skill
- Real KPI cards with sparkline trends, live order feed, driver status grid
- Professional dark theme, proper spacing, animations

### 3. Redesign Orders Page (DM — Frontend) [frontend-design]
- Complete redesign of `(dashboard)/orders/page.tsx`
- Advanced data table with column sorting, multi-filter, bulk actions
- Order detail slide-over panel, status timeline

### 4. Redesign Drivers Page (SP — Full-stack) [frontend-design]
- Redesign `(dashboard)/drivers/page.tsx` and `drivers/performance/page.tsx`
- Driver card grid with photo, status, rating, current delivery
- Performance dashboard with scoring charts

### 5. Redesign Dispatch Command Center (VS — Component Dev) [frontend-design]
- Redesign `(dashboard)/dispatch/page.tsx`
- Split-panel: order queue (left) + driver grid (right) + map placeholder (center)
- Drag-and-drop order assignment UI, priority indicators

### 6. Build Real-Time Tracking Map Component (RG — Backend Lead) [frontend-patterns]
- Create `components/maps/tracking-map.tsx` — placeholder map component using CSS grid/SVG
- WebSocket-ready data layer with `use-realtime.ts` hook
- Driver location pins, delivery route visualization, ETA indicators
- Integrate into dispatch and tracking pages

### 7. Add WebSocket/SSE Infrastructure (PK — Sr. Backend) [backend-patterns]
- Create `apps/api/src/plugins/websocket.ts` — Fastify WebSocket plugin
- Event channels: `orders:updated`, `drivers:location`, `dispatch:assigned`, `notifications:new`
- Client-side: update `use-realtime.ts` hook with WebSocket connection
- Fallback to polling when WebSocket unavailable

### 8. Redesign Returns & Fleet Pages (AM — Integration) [frontend-design]
- Redesign `(dashboard)/returns/page.tsx` — visual status pipeline, refund tracker
- Redesign `(dashboard)/fleet/page.tsx` — vehicle cards with health indicators

### 9. Test Suite Stabilization — Fix Top 50 Failures (KS — QA Lead) [tdd-workflow]
- Run `vitest --reporter=verbose` and capture baseline
- Fix top 50 test failures across the monorepo
- Ensure validators test import path is correct (`../index`)
- Target: <200 test failures

### 10. Update README, CHANGELOG, Sprint Docs (ZR — AI Engineer) [coding-standards]
- Major README rewrite reflecting Sprints 9.0-9.5
- CHANGELOG update
- Architecture diagram in docs/

## Success Criteria
- [ ] `prisma generate` runs without errors
- [ ] Typed Prisma client exported from @witylogix/db
- [ ] 6 pages redesigned with professional UI
- [ ] Real-time tracking map component built
- [ ] WebSocket infrastructure in place
- [ ] < 200 test failures (from ~762 baseline)
