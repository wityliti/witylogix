# Sprint 9.1 — Returns/RMA, Driver Scoring, Transactional Email & Live Dispatch

**Date:** 2026-03-18
**Branch:** `sprint-9.1-returns-driver-scoring-dispatch`
**Theme:** Ship the four biggest missing features that separate us from production-ready: a full returns/RMA engine, a driver performance scoring system, transactional email templates, and a live dispatch command center.

## Why These Features

After a comprehensive gap analysis comparing the platform to Fleetbase and production logistics SaaS competitors, these four areas emerged as the most critical missing pillars:

1. **Returns/RMA** — Every e-commerce logistics platform needs reverse logistics. We have zero returns infrastructure.
2. **Driver Performance Scoring** — Our `assignDriver` workflow uses a scoring algorithm but has no persistent driver scoring/rating model. Needed for intelligent dispatch.
3. **Transactional Email Templates** — We have multi-provider email infrastructure (SendGrid, Mailgun, SES, etc.) but no actual email templates for order confirmation, shipping, delivery, etc.
4. **Live Dispatch Command Center** — Current dispatch page is 291 lines of mockup. A real logistics platform needs a full-screen command center with live map, unassigned queue, and one-click assignment.

## Agent Assignments

| #   | Agent | Role          | Task                                                                                  | ECC Skill         |
| --- | ----- | ------------- | ------------------------------------------------------------------------------------- | ----------------- |
| 1   | AR    | CTO           | Returns/RMA core service — types, status machine, refund calculation                  | backend-patterns  |
| 2   | RG    | Backend Lead  | Returns API routes — create, approve, reject, receive, refund endpoints               | api-design        |
| 3   | PK    | Sr. Backend   | Driver performance scoring engine — rating model, metrics aggregation, decay          | backend-patterns  |
| 4   | SP    | Full-stack    | Driver scoring API routes + leaderboard dashboard page                                | api-design        |
| 5   | NK    | Frontend Lead | Live Dispatch Command Center — full-screen split layout with map + queue              | frontend-patterns |
| 6   | DM    | Frontend      | Returns Management dashboard page — list, detail, action buttons                      | frontend-patterns |
| 7   | VS    | Component Dev | Transactional email templates — order confirmed, shipped, delivered, return initiated | coding-standards  |
| 8   | KS    | QA Lead       | Tests for returns service, driver scoring, and email templates                        | tdd-workflow      |
| 9   | AM    | Integration   | Wire returns into order lifecycle workflow + event bus emissions                      | backend-patterns  |
| 10  | ZR    | AI Engineer   | AI-powered driver scoring — predictive delivery time, customer satisfaction model     | backend-patterns  |

## Deliverables

### 1. Returns/RMA Engine (AR + RG + DM + AM)

- `packages/core/src/returns/` — types, status machine (REQUESTED → APPROVED → RECEIVED → REFUNDED/REJECTED), refund calculator, restocking fee logic
- `apps/api/src/routes/returns.ts` — CRUD + lifecycle endpoints (approve, reject, receive, process-refund)
- `apps/dashboard/src/app/(dashboard)/returns/page.tsx` — Returns list with status filters, action buttons
- Event bus integration: `return.requested`, `return.approved`, `return.received`, `return.refunded`

### 2. Driver Performance Scoring (PK + SP + ZR)

- `packages/core/src/driver-scoring/` — scoring engine with weighted metrics (on-time %, customer rating, POD compliance, route efficiency)
- `packages/core/src/driver-scoring/ai-predictor.ts` — ML-ready scoring model with feature extraction
- `apps/api/src/routes/driver-scoring.ts` — score queries, leaderboard, trend endpoints
- `apps/dashboard/src/app/(dashboard)/drivers/performance/page.tsx` — Driver leaderboard with sparklines and trend badges

### 3. Transactional Email Templates (VS)

- `packages/core/src/email-templates/` — 6 responsive HTML email templates:
  - Order Confirmed, Order Shipped, Out for Delivery, Delivered, Return Initiated, Return Refunded
- Template engine with variable interpolation (order #, ETA, tracking URL, customer name)
- Mobile-responsive, dark-mode-aware, brand-customizable

### 4. Live Dispatch Command Center (NK)

- Full-screen split layout: left panel (unassigned orders queue) + right panel (map with driver positions)
- One-click driver assignment from queue
- Real-time order/driver counts, ETA overlays
- Filter by zone, priority, time window

## Success Criteria

- Returns lifecycle: full REQUESTED → APPROVED → RECEIVED → REFUNDED flow works
- Driver scoring: weighted composite score calculated from 5+ metrics
- Email templates: all 6 render correctly with sample data
- Dispatch command center: split layout with queue + map interaction
- All new code has companion tests
- Zero `\(dashboard\)` escaped directory bugs
- Zero secrets in committed code
