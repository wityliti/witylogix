# Sprint 9.6 — Production Polish & Route Optimization Engine

**Branch:** `sprint-9.6-production-polish-route-optimization`
**Date:** 2026-03-20
**Theme:** Eliminate top tech debt, expose route optimization via API, polish remaining dashboard pages, update all project docs

## Team Standup

**AR (CTO):** "We've wired 96% of dashboard pages and built real-time infrastructure. Sprint 9.6 is about hardening — eliminate the `(prisma as any)` pattern (605 occurrences), expose our route optimization engine via API, polish 8 more dashboard pages to production quality, and bring README/CHANGELOG current."

## Sprint Backlog (10 Agents)

| #   | Agent                                       | Owner | Deliverable                                                                                                          | ECC Skill         |
| --- | ------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Typed Prisma Migration — API routes         | RG    | Replace `(prisma as any)` with typed helpers in all `apps/api/src/routes/*.ts` files                                 | backend-patterns  |
| 2   | Typed Prisma Migration — Core modules (A-M) | PK    | Replace `(prisma as any)` in `packages/core/src/` (a* through m*)                                                    | backend-patterns  |
| 3   | Typed Prisma Migration — Core modules (N-Z) | SP    | Replace `(prisma as any)` in `packages/core/src/` (n* through z*)                                                    | backend-patterns  |
| 4   | Route Optimization API                      | ZR    | New `apps/api/src/routes/route-optimization.ts` exposing optimizer, ETA calc, distance matrix; register in server.ts | api-design        |
| 5   | Live Tracking + POD API                     | AM    | New `apps/api/src/routes/live-tracking.ts` and `proof-of-delivery.ts`; register in server.ts                         | api-design        |
| 6   | Dashboard Polish Batch 1                    | NK    | Redesign: analytics, demand-planning, supply-chain, freight — professional dark theme                                | frontend-patterns |
| 7   | Dashboard Polish Batch 2                    | DM    | Redesign: billing, invoices, field-service, healthcare — professional dark theme                                     | frontend-patterns |
| 8   | Dashboard Polish Batch 3                    | VS    | Redesign: pos, esignatures, notifications, integrations — professional dark theme                                    | frontend-patterns |
| 9   | README + CHANGELOG + package.json           | KS    | Update README (features, architecture, quickstart), CHANGELOG (9.3-9.6), package.json version bump                   | coding-standards  |
| 10  | Test Suite Triage                           | AR    | Fix top 50 test failures, update validators test import, remove broken test fixtures                                 | python-testing    |

## Acceptance Criteria

- [ ] `(prisma as any)` occurrences reduced from 605 to <50
- [ ] Route optimization API: POST /optimize, GET /eta, POST /distance-matrix
- [ ] Live tracking API: GET /tracking/:id/live, POST /tracking/:id/location
- [ ] POD API: POST /pod/upload, GET /pod/:deliveryId
- [ ] 8 dashboard pages redesigned with professional dark theme
- [ ] README reflects current architecture (180 pages, 74+ routes, 20 packages)
- [ ] CHANGELOG updated through Sprint 9.6
- [ ] All new routes registered in server.ts
- [ ] Zero secrets in staged changes
- [ ] No escaped `\(dashboard\)` directory
