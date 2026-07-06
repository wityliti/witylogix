# Sprint 8.7 — Fuel, Fleet & Field Service

**Date:** 2026-03-17
**Branch:** `sprint-8.7-fuel-fleet-field-service`
**Theme:** Fleet management engine, fuel optimization, field service scheduling, fuel card SDKs, field service SDKs, POS SDKs, and AI-powered fleet intelligence.
**Skills Applied:** backend-patterns, energy-procurement, inventory-demand-planning, frontend-patterns, api-design, security-review, e2e-testing, tdd-workflow

## Objectives

1. Build fleet management engine with vehicle lifecycle, maintenance scheduling, and fuel optimization
2. Build field service scheduling engine with constraint-based dispatch and work order lifecycle
3. Expand fuel fleet SDK coverage: WEX v2, Comdata v2, Fleetcor v2, EFS/TChek v2
4. Expand field service SDK coverage: ServiceTitan v2, Jobber v2 (GraphQL)
5. Expand POS SDK coverage: Toast v2, Square POS v2, Clover, Lightspeed
6. Build fleet management and field service dashboards
7. Build AI predictive maintenance, fuel efficiency, fleet utilization, and technician scheduling

## Agent Contributions

### AR (CTO) — Fleet Management Engine [backend-patterns, energy-procurement]

- `packages/core/src/fleet/fleet-types.ts` — Vehicle, MaintenanceRecord, FuelTransaction, FleetCost, VehicleAssignment, MaintenanceSchedule, FuelCard, FleetHealthScore, VehicleInspection, 50+ type definitions
- `packages/core/src/fleet/fleet-management-engine.ts` — VehicleManager (CRUD, VIN decoder, registration/insurance tracking), VehicleAssigner (assignment rules, conflict detection, swap), FleetHealthCalculator (5-factor scoring 0-100), VehicleLifecycleManager (acquisition→disposition, depreciation straight-line/declining-balance, TCO, replacement forecast), FleetDashboardAggregator
- `packages/core/src/fleet/maintenance-scheduler.ts` — PreventiveScheduler (mileage/time/hours intervals, templates), ReactiveHandler (priority triage, vendor dispatch), PredictiveEngine (failure probability), MaintenanceOptimizer (batch combine, cost estimation), RecallManager, MaintenanceCostTracker
- `packages/core/src/fleet/fuel-optimizer.ts` — FuelAnalyzer (MPG/L-per-100km tracking), IdleReductionMonitor, RouteFuelCorrelator, FuelCardReconciler (anomaly/fraud detection), FuelBudgetForecaster, FuelPriceTracker
- `packages/core/src/fleet/fleet-cost-analyzer.ts` — TCOCalculator, CostPerMileTracker, BudgetManager, LeaseVsBuyAnalyzer (NPV, break-even), FleetRightSizing
- `packages/core/src/fleet/fleet-api.ts` — 15+ REST endpoints with Zod validation

### DM (Frontend) — Fleet Management Dashboard [frontend-patterns]

- `apps/dashboard/src/app/(dashboard)/fleet/page.tsx` — Fleet overview (KPI cards, fuel trend, vehicle status, health heatmap, activity feed, overdue alerts)
- `apps/dashboard/src/app/(dashboard)/fleet/vehicles/page.tsx` — Vehicle inventory (table, filters, detail drawer with tabs, 4-step add wizard)
- `apps/dashboard/src/app/(dashboard)/fleet/maintenance/page.tsx` — Maintenance calendar/list views, overdue alerts, schedule form, history
- `apps/dashboard/src/app/(dashboard)/fleet/fuel/page.tsx` — Fuel analytics (spend, MPG, idle, anomalies, fuel cards, transaction log)
- `apps/dashboard/src/hooks/use-fleet.ts` — 10 custom hooks for fleet data

### NK (Frontend Lead) — Field Service & POS Dashboard [frontend-patterns]

- `apps/dashboard/src/app/(dashboard)/field-service/page.tsx` — Overview (KPIs, timeline schedule, SLA tracker, job queue, completions)
- `apps/dashboard/src/app/(dashboard)/field-service/jobs/page.tsx` — Work order management (table, filters, create form, detail drawer)
- `apps/dashboard/src/app/(dashboard)/field-service/dispatch/page.tsx` — Dispatch map (tech/job markers, auto-assign, route optimization, status updates)
- `apps/dashboard/src/app/(dashboard)/pos/page.tsx` — POS overview (sales KPIs, payment breakdown, live feed, top items, terminals)
- `apps/dashboard/src/app/(dashboard)/pos/transactions/page.tsx` — Transaction search, detail modal, refund/void, CSV/PDF export
- `apps/dashboard/src/hooks/use-field-service.ts` + `use-pos.ts` — 16 custom hooks

### RG (Backend Lead) — Fuel Fleet v2 SDKs [api-design, security-review]

- `packages/core/src/integrations/fuel-fleet/wex-v2-sdk-client.ts` — OAuth2, card lifecycle, spending limits, product/time/merchant restrictions, Level 3 transaction data, IFTA reporting, HMAC webhooks, 1000 req/hr
- `packages/core/src/integrations/fuel-fleet/comdata-v2-sdk-client.ts` — API key + HMAC-SHA256, virtual MasterCard issuance, iConnectData streaming, SmartBuy bulk purchasing, DOT validation, 500 req/min
- `packages/core/src/integrations/fuel-fleet/fleetcor-v2-sdk-client.ts` — OAuth2 + API key, universal card (Fuelman/Fleet One/Comdata network), SmartHub reporting, tax exemption, 600 req/min
- `packages/core/src/integrations/fuel-fleet/efs-tchek-v2-client.ts` — API key + merchant ID, TChek settlement, money codes, fuel pre-auth, driver settlement/escrow, IFTA, 300 req/min

### SP (Full-stack) — Field Service v2 SDKs [backend-patterns, security-review]

- `packages/core/src/integrations/field-service/servicetitan-v2-sdk-client.ts` — OAuth2 + tenant auth, jobs/customers/technicians/estimates/invoices/pricebook/memberships/dispatch/reporting, HMAC webhooks, 100 req/min
- `packages/core/src/integrations/field-service/jobber-v2-sdk-client.ts` — OAuth2 + GraphQL, jobs/quotes/clients/team/invoices/scheduling/payments, cursor pagination, cost-based rate limiting (1000 pts/min)
- `packages/core/src/integrations/field-service/field-service-sdk-types.ts` — Unified types across ServiceTitan/Jobber

### VS (Component Dev) — Fleet/FS/POS UI Components [frontend-patterns]

- `apps/dashboard/src/components/fleet/vehicle-health-card.tsx` — Health gauge (0-100), expandable maintenance timeline + fuel sparkline
- `apps/dashboard/src/components/fleet/maintenance-timeline.tsx` — SVG horizontal timeline, color-coded by type, hover tooltips
- `apps/dashboard/src/components/fleet/fuel-gauge-chart.tsx` — Bar+line combo (spend vs MPG), period selector, fleet comparison
- `apps/dashboard/src/components/field-service/job-calendar.tsx` — Week view, technician-colored blocks, drag-and-drop
- `apps/dashboard/src/components/field-service/technician-marker.tsx` — Map marker with status ring, pulsing en-route animation
- `apps/dashboard/src/components/field-service/work-order-card.tsx` — Progress bar (5 stages), expandable parts/time/photos
- `apps/dashboard/src/components/pos/pos-receipt.tsx` — Receipt card, print-friendly, refund/void overlay
- `apps/dashboard/src/components/pos/transaction-list.tsx` — Virtualized list, date grouping, inline refund

### PK (Sr. Backend) — Field Service Scheduling Engine [backend-patterns, inventory-demand-planning]

- `packages/core/src/field-service/field-service-types.ts` — WorkOrder, Technician, JobSchedule, DispatchResult, RecurringPlan, ServiceZone, SkillMatrix, SLARule
- `packages/core/src/field-service/scheduling-engine.ts` — ConstraintSolver (skill/zone/availability/travel/SLA/workload), TimeSlotFinder, BatchScheduler, RecurringScheduler, ConflictDetector, RescheduleEngine
- `packages/core/src/field-service/dispatch-optimizer.ts` — NearestAvailableDispatcher, WorkloadBalancer (80% target), PriorityDispatcher (preemption), RouteOptimizer (nearest-neighbor + 2-opt), ETACalculator (haversine + 1.3x), AutoDispatcher
- `packages/core/src/field-service/work-order-engine.ts` — WorkOrderLifecycle (7-state machine), PartsTracker, TimeTracker, SignatureCapture, InvoiceGenerator, SLAMonitor
- `packages/core/src/field-service/field-service-api.ts` — 14+ REST endpoints with Zod validation

### KS (QA Lead) — Test Suites [e2e-testing, tdd-workflow]

- 3 fleet integration tests: vehicle lifecycle, maintenance scheduling, fuel analytics
- 3 field service integration tests: scheduling constraints, dispatch workflow, work order lifecycle
- 2 E2E tests: fleet management, field service dispatch (Playwright)
- 2 fixture files: fleet + field service factory functions

### AM (Integration) — POS v2 SDKs [api-design, security-review]

- `packages/core/src/integrations/pos/toast-v2-sdk-client.ts` — OAuth2 + GUID, orders/menus/payments/labor/reporting/kitchen/tables, HMAC webhooks, 500 req/min
- `packages/core/src/integrations/pos/square-pos-v2-sdk-client.ts` — OAuth2, payments/orders/catalog/inventory/customers/loyalty/team/devices, idempotency keys, 1000 req/min
- `packages/core/src/integrations/pos/clover-pos-sdk-client.ts` — OAuth2 + merchant ID, orders/inventory/employees/payments/customers, 16 req/sec
- `packages/core/src/integrations/pos/lightspeed-pos-sdk-client.ts` — OAuth2, sales/products/inventory/customers/employees/reporting, bucket leak 60 req/min

### ZR (AI Engineer) — AI Fleet Intelligence [backend-patterns]

- `packages/core/src/ai/predictive-maintenance.ts` — ComponentHealthModel (7 components), FailureProbabilityCalculator (mileage/age/history/climate/anomalies), RemainingUsefulLife, MaintenancePrioritizer, CostProjector, AlertGenerator
- `packages/core/src/ai/fuel-efficiency-optimizer.ts` — DriverBehaviorScorer (6 dimensions), VehicleFuelProfile (MPG degradation), RouteFuelOptimizer, FuelStopPlanner, FleetFuelBenchmark, SavingsCalculator
- `packages/core/src/ai/fleet-utilization-predictor.ts` — UtilizationAnalyzer, DemandForecaster (seasonal), RightSizingRecommender, VehicleRotationPlanner, ReplacementForecaster, CapacityPlanner
- `packages/core/src/ai/technician-scheduling-ai.ts` — SkillMatchScorer (8-factor), TravelTimeEstimator (rush hour 1.4-1.5x), WorkloadOptimizer, LearningScheduler, PerformancePredictor, CustomerPreferenceManager
- `packages/core/src/ai/fleet-intelligence-api.ts` — 12+ REST endpoints

## Stats

- **Files added/modified:** ~60
- **New source lines:** ~30,000+
- **Test files:** 20+ (unit + integration + E2E + fixtures)
- **Fuel fleet SDKs:** 4 (WEX v2, Comdata v2, Fleetcor v2, EFS/TChek v2)
- **Field service SDKs:** 2 (ServiceTitan v2, Jobber v2 GraphQL)
- **POS SDKs:** 4 (Toast v2, Square v2, Clover, Lightspeed)
- **AI modules:** 4 new (predictive maintenance, fuel efficiency, fleet utilization, technician scheduling)

## Key Decisions

1. **Pure functional HOS/maintenance calculations** — Maintenance scheduler uses pure functions for testability and composability
2. **Constraint-based scheduling** — Multi-constraint solver validates skill/zone/availability/travel/SLA before assignment
3. **Nearest-neighbor + 2-opt for route optimization** — Same proven pattern as delivery routing, adapted for field service
4. **GraphQL for Jobber** — Cost-based rate limiting (1000 points/min) instead of request-based
5. **Fleet health scoring** — 5-factor weighted score (maintenance compliance, vehicle age, mileage, incident history, fuel efficiency)
6. **Predictive maintenance** — Weibull-like failure probability with climate/terrain adjustment factors
