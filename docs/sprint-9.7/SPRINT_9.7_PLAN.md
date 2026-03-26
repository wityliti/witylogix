# Sprint 9.7 — Mass Design Polish & DB Helper Expansion

**Branch:** `sprint-9.7-mass-design-polish`
**Date:** 2026-03-21
**Theme:** Redesign 50+ dashboard pages to professional dark theme, expand typed db helpers, complete (prisma as any) sweep

## Team Standup

**AR (CTO):** "18 pages look production-grade, but 162 still have basic styling. Sprint 9.7 is our biggest design sprint — we'll polish the core workflow pages (orders, routes, fleet, shipping, tracking) plus all the standalone pages. Meanwhile PK expands the db helper and RG does a full (prisma as any) sweep."

## Sprint Backlog (10 Agents)

| # | Agent | Owner | Deliverable | ECC Skill |
|---|-------|-------|-------------|-----------|
| 1 | Expand db helpers + full sweep | PK | Add 20+ models to helpers.ts, then sweep ALL remaining (prisma as any) in api/routes | backend-patterns |
| 2 | (prisma as any) sweep — core modules | RG | Replace remaining (prisma as any) across ALL packages/core/src using expanded db | backend-patterns |
| 3 | Orders sub-pages (7 pages) | NK | Redesign orders/[id], board, bulk, conflicts, create, import, local | frontend-patterns |
| 4 | Routes + Dispatch sub-pages (7 pages) | DM | Redesign routes, routes/[id], [id]/assign, [id]/edit, create, plan, dispatch/couriers | frontend-patterns |
| 5 | Fleet + Shipping sub-pages (8 pages) | VS | Redesign fleet/fuel, maintenance, vehicles, vehicles/[id], shipping/labels, labels/new, tracking, tracking/[num] | frontend-patterns |
| 6 | Tracking + Delivery + Map (6 pages) | SP | Redesign tracking, tracking-config, tracking/live, delivery, delivery/standard, map | frontend-patterns |
| 7 | Finance + Payments + Products (8 pages) | AM | Redesign finance, finance/invoices, finance/reconciliation, payments, invoices/*, products, products/*, inventory | frontend-patterns |
| 8 | CRM + Customers + Partners (8 pages) | ZR | Redesign crm, crm/connect, customers, partners, partners/[id], compare, onboard, collaboration | frontend-patterns |
| 9 | ELD + Campaigns + Calendar + Misc (12 pages) | KS | Redesign eld, eld/dvir, eld/hos, campaigns, campaigns/[id], calendar, events, collections, saved-views, profile, support, onboarding | frontend-patterns |
| 10 | Platform + Stores + Misc standalone (8 pages) | AR | Redesign platform, stores, locations, zones, time-slots, widget-config, widgets, mobile-config | frontend-patterns |

## Target: 64 pages redesigned this sprint (18 + 64 = 82 total)

## Acceptance Criteria

- [ ] db helpers expanded to 40+ models
- [ ] (prisma as any) reduced from 418 to <100
- [ ] 64 additional pages redesigned with professional dark theme
- [ ] All pages have: KPI cards, data tables, filters, loading/empty states
- [ ] No secrets, no escaped dir bug, no .bak files
