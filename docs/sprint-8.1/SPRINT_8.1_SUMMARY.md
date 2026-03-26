# Sprint 8.1 — Routing, Maps & Real-Time Tracking

**Date:** 2026-03-16
**Branch:** `sprint-8.1-routing-maps-tracking`
**Theme:** Multi-provider routing orchestration, live delivery maps, telematics integration, and AI-powered route optimization.

## Objectives

1. Build a routing orchestrator with multi-provider failover (Google, Mapbox, HERE, TomTom)
2. Deliver a live Mapbox GL JS delivery map with driver pins, routes, and clustering
3. Create a 5-step route planning wizard with stop management and optimization
4. Integrate telematics providers (Samsara, Geotab) with vehicle feed normalization
5. Implement AI route optimization with ETA prediction and smart driver assignment

## Agent Contributions

### AR (CTO) — Routing Orchestrator
- `packages/core/src/routing/routing-orchestrator.ts` — Multi-provider failover, health-weighted selection, automatic degradation
- `packages/core/src/routing/geocoding-service.ts` — Multi-provider geocoding with caching and fuzzy matching
- `packages/core/src/routing/route-cache.ts` — TTL-based route caching with LRU eviction
- `packages/core/src/routing/routing-benchmark.ts` — Provider benchmarking suite for latency, accuracy, cost comparison
- Unit tests for orchestrator and geocoding service

### DM (Frontend) — Live Delivery Map
- `apps/dashboard/src/app/(dashboard)/tracking/page.tsx` — Full-page tracking view with map + sidebar
- `apps/dashboard/src/components/maps/delivery-map.tsx` — Mapbox GL JS map with driver markers, route polylines, clustering
- `apps/dashboard/src/components/maps/driver-popover.tsx` — Driver detail popup on marker click
- `apps/dashboard/src/components/maps/map-controls.tsx` — Zoom, center, layer toggle controls
- `apps/dashboard/src/components/maps/map-legend.tsx` — Status color legend
- `apps/dashboard/src/components/maps/delivery-sidebar.tsx` — Delivery list panel with filtering
- `apps/dashboard/src/hooks/use-map-tracking.ts` — Real-time WebSocket tracking hook

### NK (Frontend Lead) — Route Planning Wizard
- `apps/dashboard/src/app/(dashboard)/routes/plan/page.tsx` — 5-step wizard (stops, constraints, optimize, review, dispatch)
- `apps/dashboard/src/app/(dashboard)/routes/page.tsx` — Routes list view with status filters
- `apps/dashboard/src/components/routes/stop-list-editor.tsx` — Drag-and-drop stop management
- `apps/dashboard/src/components/routes/route-summary.tsx` — Route stats and cost breakdown
- `apps/dashboard/src/components/routes/route-optimizer-controls.tsx` — Optimization strategy selector
- `apps/dashboard/src/hooks/use-route-planner.ts` — Route planning state management hook

### RG (Backend Lead) — Routing SDKs
- `packages/core/src/integrations/routing/google-routes-sdk.ts` — Google Routes API v2 client
- `packages/core/src/integrations/routing/mapbox-directions-sdk.ts` — Mapbox Directions API client
- `packages/core/src/integrations/routing/unified-routing-types.ts` — Shared types across providers
- `packages/core/src/integrations/routing/polyline-utils.ts` — Encode/decode polylines (Google, Mapbox formats)
- Unit tests for both SDKs and polyline utils

### SP (Full-stack) — Samsara Telematics
- `packages/core/src/integrations/telematics/samsara-sdk-client.ts` — Full Samsara API client (vehicles, drivers, locations, alerts)
- `packages/core/src/integrations/telematics/vehicle-feed-service.ts` — Real-time vehicle position feed with WebSocket push
- `packages/core/src/integrations/telematics/telematics-types.ts` — Shared telematics types
- `apps/dashboard/src/hooks/use-vehicle-tracking.ts` — React hook for vehicle positions
- Unit tests for Samsara SDK and vehicle feed

### VS (Component Dev) — Map UI Components
- `apps/dashboard/src/components/maps/route-timeline.tsx` — Visual delivery timeline
- `apps/dashboard/src/components/maps/driver-info-card.tsx` — Driver detail card
- `apps/dashboard/src/components/maps/eta-countdown.tsx` — Live ETA countdown timer
- `apps/dashboard/src/components/maps/delivery-status-pill.tsx` — Status indicator pill
- `apps/dashboard/src/components/maps/distance-badge.tsx` — Distance display badge
- `apps/dashboard/src/components/ui/animated-counter.tsx` — Smooth number animation

### PK (Sr. Backend) — Geotab Telematics
- `packages/core/src/integrations/telematics/geotab-sdk-client.ts` — Geotab MyGeotab API client
- `packages/core/src/integrations/telematics/telematics-normalizer-v2.ts` — Unified normalizer for Samsara + Geotab data
- `packages/core/src/integrations/telematics/geofence-manager.ts` — Geofence CRUD + entry/exit detection
- `packages/core/src/integrations/telematics/trip-replay-service.ts` — Historical trip playback with breadcrumbs
- Unit tests for Geotab SDK, normalizer, and geofence manager

### KS (QA Lead) — Integration & E2E Tests
- `tests/integration/routing/routing-accuracy.test.ts` — Cross-provider route comparison
- `tests/integration/routing/geocoding-accuracy.test.ts` — Geocoding precision tests
- `tests/integration/routing/failover-behavior.test.ts` — Provider failover simulation
- `tests/integration/routing/telematics-data-integrity.test.ts` — Data normalization validation
- `tests/e2e/tracking/map-rendering.spec.ts` — Playwright E2E for map rendering

### AM (Integration) — HERE & TomTom SDKs
- `packages/core/src/integrations/routing/here-sdk-client.ts` — HERE Routing API v8 client
- `packages/core/src/integrations/routing/tomtom-sdk-client.ts` — TomTom Routing API v1 client
- `packages/core/src/integrations/routing/provider-comparison.ts` — Multi-provider comparison engine with scoring
- Unit tests for HERE, TomTom, and comparison engine

### ZR (AI Engineer) — AI Route Optimization
- `packages/core/src/ai/route-optimizer.ts` — Nearest-neighbor + 2-opt/3-opt local search
- `packages/core/src/ai/eta-predictor.ts` — ML-based ETA prediction with traffic, weather, driver history
- `packages/core/src/ai/delivery-zone-analyzer.ts` — Zone clustering and workload balancing
- `packages/core/src/ai/smart-driver-assignment.ts` — Skill/proximity/workload-aware driver matching
- `packages/core/src/ai/optimization-api.ts` — Unified optimization API endpoint
- Unit tests for optimizer, predictor, and driver assignment

## Stats

- **Files added/modified:** ~69
- **New source lines:** ~14,000+
- **Test files:** 17 (unit + integration + E2E)
- **Routing providers:** 4 (Google, Mapbox, HERE, TomTom)
- **Telematics providers:** 2 (Samsara, Geotab)
- **AI modules:** 5 (optimizer, ETA, zones, driver assignment, API)

## Key Decisions

1. **Multi-provider routing** — Orchestrator pattern with health-weighted selection, not locked to a single provider
2. **Mapbox GL JS** for maps — better developer experience and customizability vs Google Maps
3. **Telematics normalizer** — Unified data model across Samsara/Geotab, extensible to future providers
4. **Nearest-neighbor + 2-opt** for route optimization — good balance of speed and quality for real-time use
5. **Polyline utilities** — Support both Google Encoded Polyline and Mapbox polyline6 formats

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Mapbox API rate limits on free tier | Route caching with TTL, request deduplication |
| Telematics data staleness | Vehicle feed service with configurable polling intervals |
| Route optimization latency | Background optimization with progress callbacks |
| Provider API changes | Unified types layer isolates consumers from provider SDKs |
