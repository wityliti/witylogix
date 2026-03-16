# Sprint 8.3 — E-Commerce & Order Sync

**Date:** 2026-03-16
**Branch:** `sprint-8.3-ecommerce-order-sync`
**Theme:** Bi-directional order sync with e-commerce platforms, cross-platform inventory synchronization, field mapping, and intelligent order routing.

## Objectives

1. Build Order Sync Engine v2 with conflict resolution and retry queue
2. Integrate e-commerce platforms: BigCommerce, Magento 2, Etsy, eBay, Square Online
3. Create order import dashboard and conflict resolution UI
4. Build product catalog sync UI with visual field mapping editor
5. Implement cross-platform inventory sync with oversell protection
6. Build AI intelligent order routing and demand forecasting

## Agent Contributions

### AR (CTO) — Order Sync Engine v2
- `packages/core/src/sync/order-sync-engine-v2.ts` — SyncOrchestrator, ConflictResolver (4 strategies), IdempotencyManager, DeltaSyncTracker, RetryQueue (exponential backoff), DeadLetterQueue, BatchProcessor (500 orders), SyncMetrics
- `packages/core/src/sync/sync-types.ts` — PlatformOrder unified model, FieldMapping, SyncConfig, SyncDirection, SyncStatus, ConflictStrategy enums
- `packages/core/src/sync/field-mapper.ts` — 15+ built-in transformers, custom JS support, reverse mapping, validation, preview
- `packages/core/src/sync/sync-scheduler.ts` — Cron scheduling, priority queue, concurrency control (max 3), health checks
- `packages/core/src/sync/sync-api.ts` — 11 REST endpoints for sync management

### DM (Frontend) — Order Import Dashboard
- `apps/dashboard/src/app/(dashboard)/orders/import/page.tsx` — 8-platform selector, sync timeline, error log with retry, bulk import wizard, health indicators, auto-refresh
- `apps/dashboard/src/app/(dashboard)/orders/conflicts/page.tsx` — Side-by-side diff, resolve actions, bulk resolve, filter by platform/field/date
- `apps/dashboard/src/hooks/use-order-sync.ts` — useSyncStatus, useSyncTrigger, useConflicts, useSyncMetrics hooks

### NK (Frontend Lead) — Product Catalog Sync UI
- `apps/dashboard/src/app/(dashboard)/products/sync/page.tsx` — Connected platforms, field mapping tab, sync schedule tab, preview tab, test sync
- `apps/dashboard/src/components/sync/field-mapping-editor.tsx` — Visual two-column editor with SVG connection lines, auto-map, 6 transformer types
- `apps/dashboard/src/components/sync/sync-schedule-config.tsx` — Interval radio cards, direction toggle, concurrency slider, countdown timer
- `apps/dashboard/src/hooks/use-product-sync.ts` — useFieldMappings, useSyncSchedule, useProductPreview hooks

### RG (Backend Lead) — BigCommerce SDK
- `packages/core/src/integrations/ecommerce/bigcommerce-sdk-client.ts` — 48 methods: OAuth2 install flow, orders, products, customers, inventory, webhooks (SHA256 HMAC), shipping, storefront, rate limiting
- `packages/core/src/integrations/ecommerce/bigcommerce-types.ts` — 30+ types

### SP (Full-stack) — Magento 2 SDK
- `packages/core/src/integrations/ecommerce/magento-sdk-client.ts` — 42 methods: OAuth1/Bearer auth, orders, products (configurable/simple/virtual), MSI inventory, categories, cart/quote, async bulk API, SearchCriteria builder
- `packages/core/src/integrations/ecommerce/magento-types.ts` — 50+ interfaces

### VS (Component Dev) — E-Commerce UI Components
- `apps/dashboard/src/components/ecommerce/unified-order-card.tsx` — Cross-platform order card with expand, sync indicator, quick actions
- `apps/dashboard/src/components/ecommerce/platform-connection-badge.tsx` — Connected/disconnected/error states
- `apps/dashboard/src/components/ecommerce/sync-progress-bar.tsx` — Animated progress with ETA and cancel
- `apps/dashboard/src/components/ecommerce/inventory-level-indicator.tsx` — Multi-warehouse stock with alerts
- `apps/dashboard/src/components/ecommerce/platform-logo.tsx` — 8 platform SVG logos with fallback

### PK (Sr. Backend) — Etsy + eBay + Square SDKs
- `packages/core/src/integrations/ecommerce/etsy-sdk-client.ts` — OAuth2 PKCE, listings, receipts, shops, taxonomy, polling-based webhooks
- `packages/core/src/integrations/ecommerce/ebay-sdk-client.ts` — OAuth2, Browse/Buy/Sell APIs, multi-marketplace, webhook subscriptions
- `packages/core/src/integrations/ecommerce/square-online-sdk-client.ts` — OAuth2, orders, catalog, inventory, customers, HMAC webhooks, idempotency keys

### KS (QA Lead) — Test Suites
- 5 integration test files: order sync idempotency, webhook reliability, conflict resolution, inventory reconciliation
- 1 E2E test: platform connect flow (Playwright)
- Sync fixtures file with factory functions for 6 platforms
- 90+ test cases total

### AM (Integration) — Cross-Platform Inventory Sync
- `packages/core/src/sync/inventory-sync-engine.ts` — StockReconciler, MultiWarehouseManager, InventoryReservation (5-min TTL), LowStockMonitor, OverSellProtection, BulkStockUpdate, InventoryAuditLog
- `packages/core/src/sync/inventory-types.ts` — StockLevel, WarehouseMapping, StockAdjustmentReason, InventoryAlert, ReservationRecord
- `packages/core/src/sync/inventory-api.ts` — 18 REST endpoints for inventory operations

### ZR (AI Engineer) — Intelligent Order Routing & Demand Forecasting
- `packages/core/src/ai/intelligent-order-router.ts` — FulfillmentScorer (proximity 35%, stock 25%, capacity 20%, cost 10%, SLA 10%), SplitOrderDetector, RoutingExplainer
- `packages/core/src/ai/demand-forecaster.ts` — TimeSeriesAnalyzer, SeasonalDecomposer, TrendDetector, DemandPredictor, ReorderSuggester, SKUClusterer
- `packages/core/src/ai/order-routing-api.ts` — 7 REST endpoints for routing and forecasting

## Stats

- **Files added/modified:** ~55+
- **New source lines:** ~25,000+
- **Test files:** 12+ (unit + integration + E2E + fixtures)
- **E-commerce SDKs:** 3 new (BigCommerce, Magento 2, Etsy) + 2 enhanced (eBay, Square Online)
- **Sync engine modules:** 10 (orchestrator, conflict resolver, idempotency, delta, retry, DLQ, batch, scheduler, field mapper, metrics)
- **Inventory modules:** 8 (reconciler, multi-warehouse, reservation, low-stock, oversell, bulk update, audit, conflict handler)
- **AI modules:** 2 new (order router, demand forecaster)

## Key Decisions

1. **4 conflict strategies** — LWW for speed, EXTERNAL_WINS for platform authority, INTERNAL_WINS for internal authority, MANUAL for critical fields
2. **5-minute reservation TTL** — prevents permanent stock locks from abandoned carts
3. **Haversine distance** for proximity — accurate enough for fulfillment center selection
4. **SearchCriteria builder** for Magento — fluent API mirrors Magento's native filter syntax
5. **Polling for Etsy** — Etsy v3 lacks native webhooks, so we poll with last-modified tracking
