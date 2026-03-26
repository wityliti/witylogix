# Sprint 8.2 — Shipping & Last-Mile Carriers

**Date:** 2026-03-16
**Branch:** `sprint-8.2-shipping-last-mile`
**Theme:** Multi-carrier shipping SDKs, rate shopping, label generation, shipment tracking, last-mile delivery APIs, and AI-powered carrier intelligence.

## Objectives

1. Build a carrier rate engine with parallel rate fetching and intelligent ranking
2. Integrate shipping carriers: EasyPost, ShipStation, Shippo, AfterShip, DHL Express
3. Integrate last-mile delivery: DoorDash Drive, Uber Direct
4. Create shipping label wizard and shipment tracking UI
5. Build AI delivery time prediction and smart carrier recommendation

## Agent Contributions

### AR (CTO) — Carrier Rate Engine
- `packages/core/src/shipping/carrier-rate-engine.ts` — Parallel rate fetching (Promise.allSettled), multi-strategy ranking (cheapest/fastest/best-value), per-tenant credential management, rate caching with TTL
- `packages/core/src/shipping/shipping-types.ts` — Core types: Package, ShipmentAddress, ShippingRate, ShipmentLabel, TrackingEvent, ShipmentStatus, CarrierCode enums
- `packages/core/src/shipping/label-generator.ts` — Unified label creation, format negotiation (PDF/ZPL/PNG), batch generation, address verification
- `packages/core/src/shipping/shipment-tracker.ts` — Multi-carrier tracking, status normalization, ETA calculation with confidence scoring, webhook subscriptions
- Unit tests for rate engine with 110+ test cases

### DM (Frontend) — Shipping Label Wizard
- `apps/dashboard/src/app/(dashboard)/shipping/labels/new/page.tsx` — 4-step wizard (Package → Carrier → Rates → Review), predefined package sizes, rate comparison table, label format selector
- `apps/dashboard/src/app/(dashboard)/shipping/labels/page.tsx` — Labels list with filters, bulk actions, quick row actions
- `apps/dashboard/src/app/(dashboard)/shipping/layout.tsx` — Shipping section layout with tab navigation

### NK (Frontend Lead) — Shipment Tracking
- `apps/dashboard/src/app/(dashboard)/shipping/tracking/page.tsx` — Tracking dashboard with search, status filters, bulk tracking, CSV export
- `apps/dashboard/src/app/(dashboard)/shipping/tracking/[trackingNumber]/page.tsx` — Detailed view with timeline, ETA countdown, POD viewer, auto-refresh
- `apps/dashboard/src/components/shipping/tracking-timeline.tsx` — Vertical timeline with pulse animation, collapsible events
- `apps/dashboard/src/components/shipping/tracking-embed.tsx` — Customer-facing embeddable tracking widget
- `apps/dashboard/src/hooks/use-shipment-tracking.ts` — Real-time tracking hook with WebSocket

### RG (Backend Lead) — EasyPost SDK
- `packages/core/src/integrations/shipping/easypost-sdk-client.ts` — Full EasyPost API: addresses, parcels, shipments, rates, labels, tracking, insurance, batch (10K), customs, webhooks
- `packages/core/src/integrations/shipping/easypost-types.ts` — 15 comprehensive TypeScript interfaces
- Unit tests with 32 test cases

### SP (Full-stack) — ShipStation SDK
- `packages/core/src/integrations/shipping/shipstation-sdk-client.ts` — Orders, shipments, carriers, warehouses, stores, products, webhooks, batch labels, rate limit tracking (40 req/min)
- `packages/core/src/integrations/shipping/shipstation-sdk-types.ts` — 35+ interfaces
- Unit tests with 25+ test cases

### VS (Component Dev) — Shipping UI Components
- `apps/dashboard/src/components/shipping/rate-comparison-card.tsx` — Rate display with Cheapest/Fastest/Best Value badges
- `apps/dashboard/src/components/shipping/carrier-logo.tsx` — 9 carrier logos with fallback initials
- `apps/dashboard/src/components/shipping/package-size-selector.tsx` — Visual presets + custom dimensions with unit toggle
- `apps/dashboard/src/components/shipping/label-preview.tsx` — Label preview with download/print/void actions
- `apps/dashboard/src/components/shipping/status-stepper.tsx` — Shipment lifecycle stepper with exception states

### PK (Sr. Backend) — DoorDash Drive + Uber Direct
- `packages/core/src/integrations/lastmile/doordash-drive-client.ts` — JWT auth, delivery CRUD, quotes, tracking, webhooks
- `packages/core/src/integrations/lastmile/uber-direct-client.ts` — OAuth2 flow, delivery CRUD, quotes, POD retrieval, multi-drop, webhooks
- `packages/core/src/integrations/lastmile/last-mile-types.ts` — Shared types
- Unit tests: 53+ test cases across both SDKs

### KS (QA Lead) — Test Suites
- `tests/integration/shipping/rate-accuracy.test.ts` — Parallel fetching, ranking, caching, degradation, currency normalization
- `tests/integration/shipping/label-generation.test.ts` — Full label lifecycle, format conversion, batch, international
- `tests/integration/shipping/tracking-webhook.test.ts` — Signature verification across 4 carriers, idempotent processing
- `tests/integration/shipping/carrier-failover.test.ts` — Primary/secondary failover, circuit breaker, timeout handling
- `tests/e2e/shipping/label-wizard.spec.ts` — Playwright E2E for complete label creation flow
- Shipping fixtures file for test data

### AM (Integration) — Shippo + AfterShip + DHL Express
- `packages/core/src/integrations/shipping/shippo-sdk-client.ts` — Addresses, parcels, shipments, rates, transactions (labels), tracking, customs, manifests, carrier accounts
- `packages/core/src/integrations/shipping/aftership-sdk-client.ts` — Trackings CRUD, courier detection (1000+ carriers), notifications, ETA, checkpoints
- `packages/core/src/integrations/shipping/dhl-express-sdk-client.ts` — OAuth2 auth, rating with duty/tax, shipments, pickups, tracking, address validation, invoices
- Unit tests for all three SDKs (145+ test cases)

### ZR (AI Engineer) — Delivery Time Prediction & Carrier Intelligence
- `packages/core/src/ai/delivery-time-predictor.ts` — Multi-factor prediction (carrier, distance, weather, holidays, day-of-week), confidence intervals
- `packages/core/src/ai/smart-carrier-selector.ts` — Multi-criteria scoring, reliability tracking, cost/speed optimizers, green shipping, A/B testing
- `packages/core/src/ai/shipping-analytics.ts` — Cost analysis, performance metrics, volume heatmaps, anomaly detection, forecasting
- `packages/core/src/ai/shipping-api.ts` — REST API for prediction, recommendation, analytics, feedback
- Unit tests: 55+ test cases

## Stats

- **Files added/modified:** ~50+
- **New source lines:** ~20,000+
- **Test files:** 15+ (unit + integration + E2E + fixtures)
- **Shipping carriers:** 5 SDKs (EasyPost, ShipStation, Shippo, AfterShip, DHL Express)
- **Last-mile providers:** 2 SDKs (DoorDash Drive, Uber Direct)
- **AI modules:** 4 (predictor, carrier selector, analytics, API)

## Key Decisions

1. **EasyPost as primary** — best multi-carrier aggregator with batch support (10K shipments)
2. **AfterShip for tracking** — 1000+ courier auto-detection for universal tracking
3. **Parallel rate fetching** — Promise.allSettled for partial results when some carriers fail
4. **Weighted scoring** — Cost 30%, Speed 25%, Reliability 25%, Tracking 10%, Rating 10%
5. **Confidence intervals** — Predictions include optimistic/realistic/pessimistic estimates
