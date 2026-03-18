# Sprint 9.1 — Returns/RMA, Driver Scoring, Transactional Email & Live Dispatch

**Date:** 2026-03-18
**Branch:** `sprint-9.1-returns-driver-scoring-dispatch`
**Theme:** Ship the four biggest missing features that separate us from production-ready: a full returns/RMA engine, a driver performance scoring system, transactional email templates, and a live dispatch command center.
**Skills Applied:** backend-patterns, api-design, frontend-patterns, coding-standards, tdd-workflow

## Agent Contributions

### AR (CTO) — Returns/RMA Core Service [backend-patterns]
- `packages/core/src/returns/types.ts` — ReturnStatus (8 states), ReturnReason (7 types), ReturnRequest, ReturnItem, ReturnPolicy, input types
- `packages/core/src/returns/status-machine.ts` — State machine with valid transitions map, canTransition(), getNextStatuses()
- `packages/core/src/returns/refund-calculator.ts` — calculateRefund(), adjustForCondition(), calculateRestockingFee()
- `packages/core/src/returns/return-service.ts` — Full CRUD + lifecycle: create, approve, reject, receive, inspect, processRefund, list, get
- **~1,040 lines** across 5 files

### RG (Backend Lead) — Returns API Routes [api-design]
- `apps/api/src/routes/returns.ts` — 9 Fastify endpoints following existing route patterns
- GET /returns, GET /returns/:id, POST /returns, POST /returns/:id/approve|reject|receive|inspect|refund, GET /returns/stats
- Zod validation, tenant isolation, proper error handling
- **~330 lines**

### PK (Sr. Backend) — Driver Performance Scoring Engine [backend-patterns]
- `packages/core/src/driver-scoring/types.ts` — DriverMetrics, DriverScore, ScoringWeights, tiers, periods
- `packages/core/src/driver-scoring/scoring-engine.ts` — Weighted composite scoring (0-100), 5 component calculators, tier determination, trend detection
- `packages/core/src/driver-scoring/metrics-aggregator.ts` — DB queries for driver metrics aggregation, leaderboard generation
- `packages/core/src/driver-scoring/decay.ts` — Exponential decay for inactive drivers (e^(-0.02 × days))
- **~580 lines** across 5 files

### SP (Full-stack) — Driver Scoring API + Leaderboard [api-design]
- `apps/api/src/routes/driver-scoring.ts` — 4 endpoints: leaderboard, single driver score, history, recalculate
- `apps/dashboard/src/app/(dashboard)/drivers/performance/page.tsx` — Full leaderboard with top-3 podium, 15-driver table, tier badges, trend arrows, score breakdown on selection
- **~860 lines** across 2 files

### NK (Frontend Lead) — Live Dispatch Command Center [frontend-patterns]
- Rewrote `apps/dashboard/src/app/(dashboard)/dispatch/page.tsx` — Full-screen 40/60 split layout
- Left panel: unassigned orders queue with urgency filters, sort options, assign driver dropdown
- Right panel: map placeholder + active drivers grid (15 drivers, 3 statuses)
- Top bar: live clock, real-time stats, auto-refresh toggle
- 12 mock orders, 15 mock drivers, interactive selection
- **~500 lines**

### DM (Frontend) — Returns Management Dashboard [frontend-patterns]
- `apps/dashboard/src/app/(dashboard)/returns/page.tsx` — Full returns management UI
- Stats row (4 cards), filter bar (status/date/search), returns table (9 columns)
- Status-based action buttons (approve, reject, receive, inspect, refund)
- Slide-over detail modal with timeline, items list, notes
- 15 mock returns, pagination
- **~1,048 lines**

### VS (Component Dev) — Transactional Email Templates [coding-standards]
- `packages/core/src/email-templates/` — Complete email template system
- Base layout: responsive table-based HTML, inline CSS, mobile media queries
- 6 templates: Order Confirmed, Order Shipped, Out for Delivery, Delivered, Return Initiated, Return Refunded
- Template engine with {{variable}} interpolation, {{#each}} loops, currency/date formatting
- **~1,000 lines** across 10 files

### KS (QA Lead) — Test Suites [tdd-workflow]
- `packages/core/src/returns/__tests__/return-service.test.ts` — Refund calculator, status machine, lifecycle tests
- `packages/core/src/driver-scoring/__tests__/scoring-engine.test.ts` — All 5 score components, tiers, trends, decay
- `packages/core/src/email-templates/__tests__/template-engine.test.ts` — Template rendering, interpolation, currency formatting, HTML validity
- **~1,510 lines** across 3 test files

### AM (Integration) — Returns Event Bus & Workflow [backend-patterns]
- `packages/core/src/returns/events.ts` — 6 domain events (return.requested → return.refunded) with typed payloads
- `packages/core/src/returns/return-workflow.ts` — Workflow handlers for each event: email notifications, audit logging, warehouse alerts, payment refund triggers
- Updated event-bus types.ts with return event definitions
- **~582 lines** across 2 files

### ZR (AI Engineer) — AI Driver Scoring Predictor [backend-patterns]
- `packages/core/src/driver-scoring/ai-predictor.ts` — ML-ready prediction module
- Feature extraction: 7 normalized features from driver metrics
- Predictive scoring: linear regression on score history, confidence interval, trend direction
- Anomaly detection: 2σ deviation flagging with warning/critical severity
- Customer satisfaction predictor: weighted model with risk levels and contributing factors
- **~234 lines**

## Stats

- **Files added/modified:** 35+
- **New source lines:** ~7,700
- **New test lines:** ~1,510
- **New API endpoints:** 13 (9 returns + 4 driver scoring)
- **New dashboard pages:** 3 (returns, driver performance, dispatch rewrite)
- **Email templates:** 6 responsive transactional templates
- **Core modules added:** 3 (returns, driver-scoring, email-templates)

## Key Decisions

1. **Returns as first-class module** — Not an add-on to orders, but a full standalone lifecycle with its own status machine, events, and workflows
2. **Pure-function scoring engine** — Scoring calculations are side-effect-free and testable without DB, aggregation is separate
3. **Exponential decay** — Inactive drivers lose score gradually (e^(-0.02×days)), preventing stale high scores
4. **Table-based email HTML** — Maximum compatibility across email clients (Outlook, Gmail, Apple Mail)
5. **Full dispatch rewrite** — Replaced the 291-line mockup with a production-grade command center layout
