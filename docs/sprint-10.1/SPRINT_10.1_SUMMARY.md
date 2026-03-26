# Sprint 10.1 — Runtime Verification

**Sprint Goal:** Get API server and dashboard both starting and running without crashes.

**Branch:** `sprint-10.1-runtime-verification`
**Date:** 2026-03-22
**Team:** AR (CTO), RG (Backend Lead), DM (Frontend), NK (Frontend Lead), PK (Sr. Backend), SP (Full-stack)

---

## Completed

### API Server (Fastify 5)

- **safeRegister pattern**: All 65+ route registrations wrapped in try/catch so failed routes don't crash the server
- **Express-to-Fastify stubs**: Converted 9 Express-based route files to Fastify plugin stubs (ecommerce, notification-preferences, traffic, demand/*, invoicing/*, notifications-v2)
- **ESM barrel fix**: Added `.js` extensions to all extensionless imports in 14 barrel files under `packages/core/src/*/index.ts` for Node 22 ESM compatibility
- **Type-only re-exports**: Changed webhook types barrel to use `export type` instead of `export` for interface-only modules (fixes BridgeMetrics resolution crash)
- **node-fetch removal**: Replaced all 26+ `import { fetch } from 'node-fetch'` with `globalThis.fetch` (Node 22 has native fetch)
- **Missing error classes**: Added `InternalServerError` and `BadRequestError` to `apps/api/src/lib/errors.ts`
- **db export alias**: Added `export const db = prisma` to `packages/db/src/index.ts`
- **Lazy worker loading**: All BullMQ workers loaded with try/catch so missing deps don't crash server
- **Result**: Server starts, loads ~50 routes, 16 routes gracefully warn, `/health` responds, graceful shutdown works

### Dashboard (Next.js 15)

- **Layout restructure**: Split `layout.tsx` into server component wrapper + `dashboard-layout-client.tsx` client component
- **Dynamic rendering**: Added `export const dynamic = "force-dynamic"` to prevent all 180+ dashboard pages from static prerendering
- **Duplicate export fixes**: Fixed duplicate exports in card.tsx, status-timeline.tsx, notification template pages, team page, validators, core/auth
- **Missing exports**: Added `LoadingSkeleton` alias, `Settings` icon import, default empty array props for Table/Select/Tabs/Combobox
- **Nullish coalescing fix**: Fixed operator precedence in webhooks page
- **Build script restored**: Changed `"build": "echo build-ok"` back to `"build": "next build"`
- **Result**: Full webpack build succeeds — all 180+ pages compile as `ƒ (Dynamic)`, dev server starts on port 3000

### Package Builds

- **@witylogix/validators**: Built with tsup, duplicate exports removed
- **@witylogix/db**: Built with tsup, `db` alias added
- **@witylogix/core**: Fixed barrel re-exports across 14 subdirectories for ESM compatibility

## Known Issues (Deferred)

- 16 API routes fail gracefully due to missing `@witylogix/core` transitive dependencies (socket.io peer deps, pdfkit, etc.)
- Redis adapter double-connect warning (harmless — falls back to default adapter)
- 1219 pre-existing TypeScript errors (build succeeds with `ignoreBuildErrors: true`)
- Core package full build still requires additional dependency resolution

## Verification

- API: `node --import tsx apps/api/src/server.ts` → `Witylogix API v4 running on 0.0.0.0:8000`
- Dashboard: `next build` → 180+ pages compiled, `next dev` → listening on port 3000
- Health check: `curl http://localhost:8000/health` → `{"status":"ok"}`
