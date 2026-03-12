# Changelog

All notable changes to the Witylogix platform are documented here. This project follows [Keep a Changelog](https://keepachangelog.com) conventions and [Semantic Versioning](https://semver.org).

## [Unreleased]

## [Sprint 5.0] - 2026-03-12 — Mega Integration Sprint I — Routing, Telematics, Messaging, Email, ERP

### Added
- Routing adapters: Valhalla (turn-by-turn, isochrone, matrix, map-matching), VROOM (CVRP, VRPTW, pickup-delivery), Routific (async VRP, dispatch), OptimoRoute (plan routes, completion events)
- HERE Routing V8 adapter (car/truck/EV routing, matrix, isoline) and Route4Me adapter (multi-stop optimization, tracking, territories)
- HERE Maps adapter (geocoding, autosuggest, discover, map tiles) with LRU cache
- Routing engine with provider registry, fallback chains, result caching, and route comparison
- Maps abstract adapter with LRU cache, rate limiter, and circuit breaker
- Messaging adapters: Vonage (SMS/MMS/WhatsApp, 2FA, HMAC-SHA256), TextMagic (bulk SMS, contacts, templates), OneSignal (push/in-app, A/B testing, segments), Sendbird (channels, messages, moderation)
- Messaging router with channel-based selection, fallback chains, cost optimization, and deduplication
- Email adapters: Mailgun (REST v3, batch send, validation, domain management), Amazon SES (AWS Sig V4, configuration sets, dedicated IPs), Gmail (OAuth2, RFC 2822 MIME, Pub/Sub), Outlook (MS Graph, folders, rules, change notifications)
- Email routing engine with domain-based routing, load balancing, and IP warmup management
- ERP adapters: SAP (OAuth2/Passport, batch $batch, G/L journal entries), Oracle NetSuite (OAuth 1.0 TBA, SuiteQL, saved searches), MS Dynamics 365 (Azure AD MSAL, OData v4, dimensions), Sage (OAuth2, bank transactions, tax, financial reports)
- ERP sync engine with bidirectional delta sync, entity dependency resolution, and conflict handling
- ERP Prisma schema (ERPConnection, ERPFieldMapping, ERPSyncLog, ERPSyncRecord, ERPConflictRecord, ERPWebhookRegistration)
- Telematics adapters: Flespi (2500+ protocols, MQTT, geofences, calculators), Verizon Connect (OAuth2, trips, behavior events, safety scoring), Trimble (ELD, HOS, IFTA, inspections, dispatch), Fleetio (maintenance, fuel, inspections, parts, work orders)
- Telematics aggregator with multi-provider unification, deduplication, and health scoring
- Telematics stream with real-time streaming, interpolation, and geofence detection
- Integration dashboard pages: routing config, telematics config, messaging config, ERP config, e-commerce config, email config, integration overview hub
- 10 integration UI components: ProviderCard, CredentialForm, WebhookConfig, HealthMonitor, RateLimitDisplay, SyncStatusCard, ConnectionWizard, ApiUsageChart, ProviderComparison
- Integration test suites: routing adapters (35+ tests), messaging adapters (35+ tests), email adapters (30+ tests), ERP adapters (35+ tests), maps adapters (25+ tests), E2E integration lifecycle (25+ tests)
- Integration test fixtures and helper utilities
- Updated integration registry: 54 production adapters, 70 planned (124 total across 21 categories)

## [Sprint 4.9] - 2026-03-12 — Demand Completion, Platform Adapters & Deployment

### Added
- Real-time demand dashboard service with live snapshots, zone summaries, and EventEmitter streaming
- Auto-rebalancer with imbalance detection, greedy redistribution algorithm, and zone capacity scoring
- Capacity alert engine with 4 built-in rules, multi-level escalation, and multi-channel notifications (email, SMS, webhook, Slack)
- Model retraining pipeline with A/B testing, champion/challenger evaluation, and auto-promotion
- Magento 2 REST V1 e-commerce adapter (products, orders, customers, inventory) with rate limiter and circuit breaker
- BigCommerce V3 e-commerce adapter (products, orders, customers, inventory) with webhook management
- E-commerce sync engine with multi-platform support, conflict resolution, and batch processing
- PayPal Orders API v2 payment adapter (create, capture, refund, webhooks with HMAC verification)
- Square Payments API adapter (create, complete, refund, webhooks with signature verification)
- Multi-gateway payment router with optimal gateway selection (method, currency, amount, region), fallback chains, and health tracking
- Salesforce REST API CRM adapter (OAuth2, SOQL queries, Bulk API 2.0, record CRUD)
- HubSpot CRM API v3 adapter (OAuth2, contacts, companies, deals, search API, associations)
- CRM sync engine with bidirectional sync, field mapping, conflict resolution, and webhook processing
- ShipStation API adapter (Basic auth, orders, shipments, labels, carriers, tracking)
- EasyPost API adapter (Bearer + HMAC-SHA256, shipments, rates, labels, tracking, insurance)
- Carrier rate comparison engine with multi-carrier quoting, markup rules, and rate caching
- Demand visualization components: zone heatmap (pure SVG), forecast dual-line chart, capacity stacked bar, schedule grid
- Admin UI components: service health card with sparkline, integration status row, activity timeline
- Demand prediction dashboard (5 pages: forecast overview, capacity planning, scheduler, anomalies, model performance)
- Admin console (5 pages: system health, integration monitoring, error logs, activity feed, API docs browser)
- Payment settings page with multi-gateway configuration
- Docker Compose production config generator with Nginx, health checks, graceful shutdown
- OpenAPI v3.1 specification generator (Zod-to-OpenAPI converter) with Swagger UI and ReDoc
- Health check service with database, Redis, and external dependency checks, Prometheus metrics export
- ADR-028: Platform deployment architecture
- 49-crm.prisma: CRMConnection, CRMFieldMapping, CRMSyncLog, CRMWebhookRegistration models
- 13 demand API endpoints (dashboard snapshot, zone summary, capacity, alerts, rebalance, retrain)
- 8 CRM API endpoints (connections, sync, field mappings, contacts, webhooks)
- E-commerce API routes (Magento/BigCommerce CRUD, sync trigger, webhook handlers)
- Payment v2 API routes (multi-gateway create/capture/refund, webhook processing)
- Shipping API routes (rate comparison, label generation, tracking, carrier management)
- Platform health API routes (/health, /metrics, /api/docs)
- E2E test suite: order lifecycle (30+ tests), checkout-to-delivery (25+), payment flow (25+), e-commerce sync (20+), demand prediction (15+)
- k6 load test suite: API load (100 VU, 7 scenarios), webhook processing (1000/min)
- E2E test fixtures and helper utilities
- 200+ unit tests for platform, payments, CRM, e-commerce, shipping, and demand prediction modules

### Changed
- Extended demand-prediction/index.ts with realtime dashboard, auto-rebalancer, capacity alerts, model retrainer exports
- Extended payments/index.ts with PayPal, Square, multi-gateway router exports

## [Sprint 4.8] - 2026-03-11 — Invoicing Completion, Courier Ecosystem & AI Demand Prediction

### Added
- Invoice generation engine with 6 billing models (per-delivery, per-mile, per-hour, flat-rate, tiered, subscription)
- Invoice PDF renderer with professional HTML templates, multi-currency, QR codes
- Payment gateway integration (Stripe payment links, checkout sessions, refunds)
- Manual payment recording (bank transfer, cash, check) with reconciliation
- Payment reminder service with 6-level escalation schedule
- Courier webhook processors for Onfleet (HMAC-SHA512), Stuart, Uber Direct (HMAC-SHA256)
- Partner rating engine with 6-metric composite scoring and auto-tiering (Gold/Silver/Bronze/Review)
- Smart multi-courier routing engine with performance-based selection and batch optimization
- Cost optimizer with volume discounts, surge detection, ROI analysis
- SLA enforcer with graduated escalation (warning → review → suspension)
- Courier dispatch console with live tracking map and assignment panel
- Invoice management dashboard with list, detail, creation, and payment tracking pages
- AI demand prediction data pipeline: feature store, data aggregator, time-series extractor, zone profiler
- Holiday calendar with 50+ holidays (US, UK, CA, AU, IN) and custom events
- Demand prediction ML models: seasonal decomposition, zone regression, pattern matcher, anomaly detector
- Demand ensemble predictor with dynamic model weighting
- Smart scheduling engine: capacity recommendations, driver allocation, what-if analysis
- ADR-027: AI demand prediction architecture
- Platform health dashboard with service status and integration monitoring
- 48-invoicing.prisma: Invoice, InvoiceLineItem, Payment, PaymentReminder models
- 200+ integration tests for invoicing, payments, courier webhooks, smart routing, SLA compliance

### Changed
- Extended courier index.ts with partner performance, smart router, cost optimizer, SLA enforcer exports
- Extended invoicing index.ts with invoice generator, PDF renderer, payment gateway, reminder exports



### Sprint 4.7 — Telematics, Traffic-Aware ETA & Integration Ecosystem (2026-03-11)

#### Added

- **ADR-026** — Telematics gateway architecture (`docs/adr/ADR-026-telematics-gateway.md`) — adapter pattern for Samsara/Geotab/Verizon/Motive, polling vs webhook strategies, data normalization, Redis caching, fleet event types
- **Fleet Dashboard** (`apps/dashboard/src/app/(dashboard)/fleet/`, 3 pages) — Fleet overview with health gauge, vehicle list with status badges and fuel bars, vehicle detail with diagnostics/behavior/maintenance tabs
- **Fleet Map Components** (`apps/dashboard/src/components/fleet/`, 11 files) — Vehicle tracker map (canvas-based, color-coded markers), fuel gauge SVG, diagnostic alerts panel, driver behavior stacked bar chart, idle time chart, fleet stats cards, vehicle status badge, vehicle status card, fuel consumption area chart, maintenance schedule, speed history chart, fleet health radial gauge
- **Telematics Adapter Layer** (`packages/core/src/integrations/telematics/`, 10 files, 3,800+ lines) — Abstract TelematicsAdapter with rate limiter + circuit breaker, Samsara REST API v1 client (vehicles, positions, diagnostics, fuel, behavior, webhooks), Geotab MyGeotab JSONRPC client (session management, devices, fault data, exception events), data normalizer (unit conversions: miles↔km, gallons↔liters, F↔C), polling service (configurable intervals, change detection), 75+ tests
- **Fleet Service** (`packages/core/src/fleet/`, 4 files) — Vehicle lifecycle management, fleet overview/health scoring, diagnostics, driver behavior analytics, maintenance alerts, 8 API endpoints
- **Courier Partner Directory UI** (`apps/dashboard/src/app/(dashboard)/partners/`, 4 pages, 2,500+ lines) — Directory with grid/list toggle and search/filter, partner detail with 4 tabs (Overview/Deliveries/Settings/SLA), 3-step onboarding wizard (select provider → credentials → configure), courier comparison view (up to 4 side-by-side)
- **Courier Partner Adapters** (`packages/core/src/integrations/couriers/`, 11 files, 4,800+ lines) — Abstract CourierAdapter interface, Onfleet REST client (Basic auth, task management), Stuart REST client (OAuth2, transport types), Uber Direct client (OAuth2, manifest items), courier normalizer (unified quotes/status), CourierDispatcher (multi-courier comparison, 4 strategies: cheapest/fastest/preferred/auto), 12 API endpoints, 60+ tests
- **Invoice Engine Completion** (`packages/core/src/invoicing/billing-rules.ts`, `invoice-email.ts`) — BillingRuleEngine with 6 models (per-delivery/mile/hour/kg/subscription/flat-rate), tiered pricing, surcharges, discount/tax calculation, HTML invoice email templates with branding, payment reminder emails (7/14/30 day), receipt emails
- **QuickBooks/Xero Accounting Integration** (`packages/core/src/integrations/accounting/`, 7 files) — QuickBooks Online OAuth2 adapter (invoice creation, payment sync, customer lookup), Xero OAuth2 adapter (invoice creation, contact management, tax rates), AccountingSyncService (idempotent sync, retry, reconciliation, provider registry), 8 API endpoints, accounting settings page
- **Traffic-Aware ETA v2 Infrastructure** (`packages/core/src/integrations/traffic/`, 6 files, 2,000+ lines) — Google Directions API client (routes, distance matrix, traffic duration), TomTom Traffic API client (routes, traffic flow, incidents), traffic normalizer, TrafficProvider service (primary + fallback, optimal departure time), 6 API endpoints, 70+ tests
- **ML ETA Engine v2** (`packages/core/src/ai-eta-v2/`, 14 files, 6,800+ lines) — 5 ML models (time-of-day with Gaussian kernel, distance-decay piecewise regression, historical KNN, traffic-aware zone delay, weather impact), ensemble predictor (dynamic weighting, outlier detection, auto-calibration), ETA pipeline (5 adjustment stages), traffic zone classifier, weather impact calculator, feature extractor, model performance tracker, 8 API endpoints, 100+ tests
- **Partner UI Components** (`apps/dashboard/src/components/partners/`, 8 files) — Courier partner card, rate comparison table, partner SLA indicator, onboarding steps, partner stats widget
- **250+ integration/unit tests** (`tests/integration/telematics/`, `tests/integration/couriers/`, `tests/integration/invoicing/`, `tests/integration/accounting/`) — Samsara (40+), Geotab (35+), normalizer (20+), Onfleet/Stuart/Uber Direct (25+ each), dispatcher (20+), billing rules (30+), QuickBooks (20+), Xero (20+)
- **2 Prisma schemas** — `46-fleet.prisma` (FleetVehicle, TelematicsConnection, VehicleTelemetryLog, DriverBehaviorEvent), `46-couriers.prisma` (CourierPartner, CourierDelivery, CourierWebhookLog)

#### Changed

- **packages/core/src/invoicing/index.ts** — Added billing rules engine and invoice email exports

### Sprint 4.6 — Integrations, Analytics & Platform Maturity (2026-03-11)

#### Added

- **ADR-025** — Route analytics architecture (`docs/adr/ADR-025-route-analytics.md`)
- **Route Analytics Dashboard** (`apps/dashboard/src/app/(dashboard)/analytics/route-performance/`, 6 components) — Planned-vs-actual chart, driver leaderboard, efficiency heatmap, CO2 tracker, SLA compliance panel, route performance API (6 endpoints)
- **Customer Portal v2** — Real-time delivery tracking via WebSocket/Socket.io (`apps/customer-portal/src/app/track/[id]/`), canvas-based live map, ETA countdown, 6-step delivery timeline, driver info card, mobile bottom sheet (3 snap points), delivery history page, enhanced rating flow
- **Google Maps Native Components** (`apps/dashboard/src/components/maps/`, 8 files, 3,230+ lines) — GoogleMapsProvider with lazy API loading, address autocomplete with keyboard nav, zone polygon editor (GeoJSON import/export), route polyline viewer, delivery heatmap layer, place search, maps settings page, 23+ tests
- **WooCommerce REST API Adapter** (`packages/core/src/integrations/woocommerce/`, 8 files, 2,897 lines) — OAuth 1.0a client with HMAC-SHA256, rate limiting, retry, order sync (14 status mappings), product + variation sync, customer sync (guest merge), webhook consumer (HMAC verification, idempotency), 7 API endpoints, 90+ tests
- **Notification Preferences UI + WhatsApp Templates** (`apps/dashboard/src/app/(dashboard)/settings/notifications/`, 4,900+ lines) — Per-channel notification config, template listing + editor with live preview, WhatsApp template CRUD (Meta Business API), notification log table, stats widget, 7 preference API endpoints, 59 tests
- **Pure SVG Analytics Charts** (`apps/dashboard/src/components/analytics/`, 14 components, ~2,967 lines) — Zero-dependency chart library: line chart (multi-series, bezier curves), bar chart (grouped/stacked/horizontal), donut/pie (sweep animation), heatmap, sparkline, KPI card, comparison card, sortable data table, chart tooltip, date range picker, demo page
- **Invoice Engine Foundation** (`packages/core/src/invoicing/`, 3,200+ lines) — Invoice service (create/finalize/void/payment), cost calculator (multi-tier distance/weight pricing, surcharges), pdfkit A4 PDF generator, atomic invoice numbering (INV-YYYY-NNNNN), 20+ interfaces, 7 Prisma models (Invoice, InvoiceLineItem, InvoiceDiscount, InvoiceTax, InvoicePayment, RateCard), 12 API endpoints with Zod validation, 70+ tests
- **WooCommerce Checkout Block** (`extensions/woocommerce-block/`, ~7,000 lines) — React-based WC Checkout Block (date picker, time slots, rate display, delivery notes), WC-native CSS (582 lines), WordPress plugin scaffold (PHP), webpack build config
- **Platform Bridge** (`packages/core/src/integrations/platform-bridge/`) — Multi-platform data normalizer (Shopify + WooCommerce + Magento + Custom), webhook normalizer (unified event types), UnifiedOrder/UnifiedProduct/UnifiedCustomer types
- **Route Analytics ML** (`packages/core/src/ai-analytics/`, 5,458 lines) — Route efficiency scorer (5-component score 0-100), driver scorer (weighted composite with trend analysis), delivery predictor (3-model ensemble with auto-calibration), anomaly detector (5 types with severity), CO2 calculator (4 vehicle profiles with terrain), 7 API endpoints, 240+ tests
- **182+ integration/unit tests** (`tests/integration/`, `tests/unit/`) — WooCommerce client (46), order sync (21), webhook consumer (22), route performance (24), invoice service (18), notification preferences (20), POD service (31)
- **2 Prisma schemas** — `45-invoices.prisma` (7 models), `45-woocommerce.prisma` (4 models: WooCommerceConnection, SyncRecord, RegisteredWebhook, WebhookLog)

#### Changed

- **apps/customer-portal/src/types/index.ts** — Added 6 real-time tracking types (DeliveryStep, DriverLocation, DeliveryTracking)
- **apps/customer-portal/src/app/orders/[id]/rate/page.tsx** — Enhanced 4-step rating flow
- **apps/dashboard/src/app/(dashboard)/settings/notifications/page.tsx** — Expanded with per-channel configuration
- **packages/core/src/analytics/index.ts** — Added route analytics exports (6 functions, 15+ types)

### Sprint 4.5 — Customer Experience & Checkout Enhancement (2026-03-11)

#### Added

- **ADR-024** — Dispatch dashboard architecture (`docs/adr/ADR-024-dispatch-dashboard.md`)
- **Competitive Intelligence Report** — Deep-dive analysis of 6 competitors (Fleetbase, ScrollEngine, Zapiet, Route4Me, Routific, Pickeasy) across 48 features in 7 categories (`docs/competitive-intelligence-report.docx`)
- **Route Timeline Dispatcher Dashboard** (`apps/dashboard/src/app/(dashboard)/dispatch/`, 15 files, 3,802 lines) — Real-time map view, color-coded route timeline bar, driver cards with status, stop detail panel, stats bar, dispatch service with batch operations
- **Embeddable Checkout Widget** (`packages/checkout-widget/`, 27 files, 3,307 lines) — 5-step checkout flow (address → date → time → options → confirm), date picker, time slot grid, zone rate display, address input with validation, delivery options, hooks for slot availability/zone rates/address validation, tsup build config
- **Customer Self-Service Portal** (`apps/customer-portal/`, 27 files) — Next.js app with order list/detail, delivery tracking with mini-map, reschedule flow, delivery rating, notification preferences, sidebar nav, responsive layout
- **Slot Engine API** (`packages/core/src/slots/`, 16 files, 4,500+ lines) — Atomic slot reservation with double-booking prevention, real-time capacity manager with AI hook, zone rate calculator (5 methods: flat, per-km, per-mile, weight, cart-value), order deadline engine, blackout manager (one-time + recurring), 8 Prisma models (`packages/db/prisma/schema/43-delivery-slots.prisma`), checkout API routes
- **POD v2** (`packages/core/src/pod/`, 14 files, 3,514+ lines) — Photo capture with EXIF/geolocation/thumbnail, signature capture (SVG paths, PNG rendering), QR + 6 barcode format scanner, delivery timeline (9 events, status transitions), storage adapter (S3, R2, local), 7 API endpoints with multipart upload, Prisma schema (`packages/db/prisma/schema/44-pod-timeline.prisma`)
- **Notification Engine v2** (`packages/core/src/notifications-v2/`, 20 files, 5,798 lines) — Multi-channel dispatcher (email, SMS, WhatsApp, push), 7 event templates × 4 channels, customer preference manager, per-channel rate limiter, URL shortener, webhook delivery, 15 API endpoints
- **13 new UI components** (`apps/dashboard/src/components/`) — Dispatch: route-timeline-bar, driver-avatar, stop-marker, route-stats-badge, dispatch-filter-bar; Checkout: calendar-day, time-slot-card, delivery-method-card, zone-map-mini, address-suggestion-item; Shared: status-timeline, metric-card, color-legend
- **73 E2E tests** (`tests/e2e/`, 12 files, 5,087 lines) — 5 spec suites (dispatch dashboard 14 tests, checkout widget 18, customer portal 18, POD capture 12, notification delivery 11), page objects, fixtures, mock API helpers
- **Shopify checkout extension** (`extensions/checkout-ui/src/DeliveryDatePicker.tsx`) — Date/time picker for Shopify checkout, Witylogix API client
- **Google Maps + Calendar integration** (`packages/core/src/integrations/google/`, 15 files, ~3,200 lines) — Geocoding, distance matrix, zone detection, Calendar OAuth2 (event CRUD, sync), zone visualizer (GeoJSON, KML, static maps), Shopify checkout + Google API routes
- **AI Slot Recommender** (`packages/core/src/ai-slots/`, 22 files, 4,180+ lines) — 5-factor scoring (demand, availability, preferences, efficiency, urgency), demand predictor, driver availability analyzer
- **ML ETA Engine** (`packages/core/src/ai-eta/`) — 4 prediction models (time-of-day, distance, historical, traffic), weighted model ensemble with dynamic confidence, API endpoints for slot recommendations and ETA predictions

#### Changed

- **packages/core/package.json** — Added exports for dispatch, ai-slots, ai-eta modules
- **packages/core/src/dispatch/index.ts** — Added route dispatch exports (DispatchService, route colors, types)
- **apps/dashboard/src/components/ui/index.ts** — Added StatusTimeline, MetricCard, ColorLegend exports
- **extensions/checkout-ui/package.json** — Added zod dependency for checkout validation
- **Competitive Gap Tracker** — Added to sprint tracker with 15 gaps (G-01 through G-15, P0-P3)
- **Priority Roadmap** — Extended with 18 entries for Sprint 4.5-5.0

### Sprint 4.4 — E2E Testing, Event Bus, Platform Admin & Gap Closure (2026-03-10)

#### Added

- **ADR-023** — E2E testing strategy & event bus architecture (1,668 lines) covering Playwright selection, page object model, test data management, Redis Streams event bus, schema versioning, DLQ design, AI monitoring integration (`docs/adr/ADR-023-e2e-testing-event-bus.md`)
- **Playwright E2E framework** (`tests/e2e/`, 14 files) — Config, global setup/teardown, 4 page objects (login, dashboard, orders, drivers), auth fixtures (admin/dispatcher/driver roles), 5 spec suites (auth, order lifecycle, driver management, tracking, webhooks), 41 critical flow tests, helper utilities
- **Event Bus v2 with Redis Streams** (`packages/core/src/events/`, 10 files, ~5,200 lines) — Typed domain events, EventBus class (publish/subscribe/wildcard), RedisStreamAdapter (consumer groups, XADD/XREADGROUP/XACK), EventStore (persistence, replay, versioning), DeadLetterQueue (retry, replay, alerts), 4 comprehensive test suites
- **Auth provider registry** (`packages/core/src/auth/`, 5 new/updated files, ~1,800 lines) — SessionManager (create/validate/refresh/revoke, max concurrent sessions, IP tracking), TokenService (JWT signing, refresh rotation, expiry), AuthProviderBase abstract class (OAuth2, PKCE, CSRF), session manager tests
- **Workflow integration triggers** (`packages/core/src/workflow-triggers/`, 8 files, ~2,600 lines) — TriggerRegistry (conditions, priority, debounce/throttle), API hooks (Fastify auto-trigger on order/shipment/driver events), Socket.io workflow events (room-based scoping), ShopifyWorkflowBridge (webhook→workflow, HMAC verification), tests + docs
- **AI monitoring module** (`packages/core/src/ai-monitoring/`, 7 files, ~2,850 lines) — AnomalyDetector (z-score, IQR, moving average, deduplication, severity classification), ETAPredictor (regression model, feature extraction, confidence intervals, zone-aware), AlertEngine (rule-based + anomaly-based, routing, escalation chains, maintenance windows, daily digest), 2 test suites
- **Activity log redesign** (`apps/dashboard/src/app/(dashboard)/activity/`, 4 files, ~1,327 lines) — Real-time event stream with live indicator, timeline view with date grouping, event type icons + severity badges, search + multi-filter (type, severity, date, user), event detail panel, CSV export
- **Design tokens page** (`apps/dashboard/src/app/(dashboard)/design-system/tokens/`, 674 lines) — Interactive token browser (colors, typography, spacing, shadows, radius, breakpoints), copy-to-clipboard, search/filter, --wl-* CSS var swatches
- **Component gallery** (`apps/dashboard/src/app/(dashboard)/design-system/components/`, 821 lines) — Interactive previews of 29+ UI components with prop controls and code snippets
- **Event log viewer** (`apps/dashboard/src/app/(dashboard)/events/`, 3 files, ~830 lines) — Filterable event browser with JSON payload viewer, stats bar, infinite scroll, export
- **Shopify workflow bridge API** (`apps/api/src/routes/shopify-workflow-bridge.ts`, 630 lines) — Order webhook→createDeliveryOrder workflow, fulfillment→shipment status, HMAC-SHA256 verification, idempotency, test suite (549 lines)
- **4 Prisma models** — AuthProvider (org-level SSO), AuthSession (user sessions with token storage), PlatformAdmin (super_admin/admin/support roles), PosConfig (Shopify POS/Square/Clover)
- **Package build maturity** — tsup.config.ts + proper exports for framework, types, validators, workflows packages; test scripts for carrier-service, extension-core
- **Package verifier** (`scripts/verify-packages.ts`, ~200 lines) — Build/test script checker, exports validator, circular dependency detector

#### Changed

- **packages/core/src/events/index.ts** — Added Event Bus v2 re-exports (namespaced as EventBusV2)
- **packages/core/src/auth/index.ts** — Added SessionManager, TokenService, AuthProviderBase exports
- **packages/db/prisma/schema/** — Added relations on User (authSessions, platformAdmin) and Organization (authProviders, posConfigs)
- **6 package.json files** — Added build/test scripts and proper exports fields
- **package.json** (root) — Added Playwright devDependency and e2e test scripts

### Sprint 4.3 — CLI Deployment Tool, AI Diagnostics & Production Docker Compose (2026-03-10)

#### Added

- **ADR-022** — CLI deployment tool architecture (670 lines) covering bash-only design, Caddy selection, subcommand structure, AI diagnostics rationale (`docs/adr/ADR-022-cli-deployment-tool.md`)
- **`witylogix` CLI entrypoint** (`infra/cli/witylogix`, 355 lines) — Main CLI with subcommand routing, ASCII banner, color logging, `--yes`/`--verbose`/`--quiet` global flags, version/help, 15 subcommands
- **Shared CLI library** (`infra/cli/lib/common.sh`, 423 lines) — require_root, require_docker, wait_for_healthy, spinner, table output, config read/write, detect_os/arch
- **install command** (376 lines) — Docker bootstrap, directory creation, image pull, secret generation
- **deploy command** (310 lines) — Fresh install vs update detection, rolling restart, health wait
- **upgrade command** (394 lines) — Version check, auto-backup before upgrade, rolling restart with rollback
- **backup command** (286 lines) — pg_dump + compression + S3 upload + rotation
- **restore command** (369 lines) — Backup validation, service stop, pg_restore, restart
- **ssl command** (395 lines) — Caddy config generation, DNS validation, cert status/renewal
- **env command** (532 lines) — Interactive .env configurator with show/set/validate/export subcommands
- **status command** (370 lines) — HTTP probes, Docker stats table, `--json` and `--watch` flags
- **doctor command** (531 lines) — System/network/Docker/app checks, aggregate health score, `--fix` flag
- **dev command** (491 lines) — Local dev orchestrator with pre-flight checks, infra boot, turbo start, graceful shutdown
- **init command** (463 lines) — Contributor setup: deps, env, prisma, seed, smoke test
- **logs command** (284 lines) — Color-coded multi-service log tailing with `--since`, `--search`, `--export`
- **scale command** (320 lines) — Docker Compose scale wrapper with recommended limits
- **destroy command** (400 lines) — Requires "type DESTROY to confirm", `--keep-data`/`--volumes`/`--images`/`--all`/`--force` flags
- **ai command** (657 lines) — `ai setup` (API key config), `ai diagnose` (Claude-powered log analysis), `ai optimize` (performance recommendations via Claude claude-sonnet-4-5-20250929)
- **Caddy templates** — Production Caddyfile (163 lines) with security headers, gzip, rate limiting + Caddyfile.template (146 lines) with `{{DOMAIN}}`/`{{ACME_EMAIL}}` placeholders
- **Production env template** (`infra/cli/templates/env.template`, 219 lines) — 16 sections covering all platform vars
- **AI prompt templates** — `ai-diagnose-prompt.txt` (48 lines, DevOps expert system prompt) + `ai-optimize-prompt.txt` (65 lines, performance expert system prompt)
- **CLI test harness** (`infra/cli/__tests__/test-cli.sh`, 486 lines) — Comprehensive tests for all subcommands
- **Production Docker Compose** (`infra/docker-compose.prod.yml`, 374 lines) — 6 services + worker, resource limits, healthchecks, restart policies, Caddy reverse proxy
- **Dockerfile.docs** (`infra/docker/Dockerfile.docs`, 68 lines) — Multi-stage Next.js docs build
- **Docker Compose dev override** (`infra/docker-compose.override.example.yml`, 157 lines) — pgAdmin, Mailhog, Redis Commander

#### Changed

- **CI workflow** — Added CLI tests step with ShellCheck linting and test harness execution

### Sprint 4.2 — DX Polish, SDK Tests, Seed Data & Driver App Build-Out (2026-03-10)

#### Added

- **ADR-021** — Developer experience & monorepo bootability (555 lines) with turbo pipeline design, workspace conventions, port assignments, env management (`docs/adr/ADR-021-developer-experience-monorepo.md`)
- **Database seed script** (`packages/db/src/seed.ts`, 1,063 lines) — Idempotent demo data: 3 orgs, 10 users, 5 zones, 20 drivers, 50 orders, 30 shipments, notification templates, webhook configs, 3 billing plans
- **Environment validator** (`packages/db/src/validate-env.ts`, 211 lines) — Validates required/optional env vars against .env.example
- **SDK test suite** (7 test files, 3,381 lines, 141 test cases) — client, orders, drivers, zones, shipments, errors, integration tests with mock HTTP server
- **SDK publish config** — tsup.config.ts for dual CJS/ESM build, package.json exports field, proper main/module/types
- **5 new UI components** (963 lines) — FileUpload (drag & drop), Combobox (searchable select), Timeline (vertical event timeline), StatusBadge (delivery-specific with 9 statuses), CommandPalette (CMD+K overlay)
- **Settings page** (642 lines) — 5 tabs: Profile, Organization, Billing, Integrations, API Keys
- **Notification preferences page** (393 lines) — 4 channels (email, SMS, WhatsApp, push) with per-type toggles and quiet hours
- **Real-time activity feed** (487 lines) — Live event stream with filtering, auto-scroll, pulsing live indicator
- **Webhook delivery dashboard** (710 lines) — Delivery log table with filters, retry, payload viewer, stats
- **Integration health page** (383 lines) — 8 integration cards with status, uptime, response time, check-now
- **Webhook deliveries API** (327 lines) — List, detail, retry, health stats endpoints with Zod validation
- **Webhook deliveries tests** (477 lines) — Full route test coverage
- **Docs config tests** (450 lines) — MDX validation, meta.json checks, link verification
- **Smoke test script** (`scripts/smoke-test.sh`, 256 lines) — Platform validation (tools, env, workspaces, TypeScript)
- **Docs validator** (`scripts/validate-docs.ts`, 332 lines) — MDX content and meta.json validation
- **Workspace validator** (`scripts/validate-workspace.ts`, 252 lines) — Package script and dependency checks
- **5 component gallery MDX pages** (545 lines) — Documentation for all new UI components

#### Changed

- **turbo.json** — Enhanced pipeline with proper inputs/outputs/env, added db:generate, db:push, globalPassThroughEnv for CI
- **Driver app screens** — HomeScreen (stats dashboard), ShipmentListScreen (filterable list), RouteDetailScreen (stop list + navigation), DeliveryProofScreen (photo + signature + validation)
- **Tracking page** — TrackingLandingPage (animations, loading state), ShipmentTracker (live tracking indicator, map placeholder), DriverCard (avatar, rating, ETA countdown)
- **CI workflow** — Added smoke test, docs validation, and SDK test steps
- **.env.example** — Comprehensive audit with all platform vars documented

### Sprint 4.1 — Documentation Engine, TypeScript SDK & OpenAPI (2026-03-10)

#### Added

- **ADR-020** — Documentation engine architecture decision record (413 lines) covering Fumadocs selection rationale, AI search design, MDX content strategy (`docs/adr/ADR-020-documentation-engine.md`)
- **Fumadocs documentation app** (`apps/docs`) — Complete Next.js 15 docs site with Fumadocs 14, dark theme with `--wl-*` CSS variables, 69 files totaling ~19,000 lines
  - **AI-powered search** — Claude API RAG search endpoint (`/api/search`) with `CMD+K` dialog
  - **30+ MDX documentation pages** covering: getting started, environment setup, architecture overview, API reference (auth, errors, webhooks), self-hosting (Docker, Kubernetes, SSL, backups), platform adapter guides (Shopify, WooCommerce, Magento, Custom), system guides (workflows, notifications, billing, RBAC, events), component gallery (11 component docs), contributing guide, testing guide, ADR browser
  - **OpenAPI 3.0 specification** (`content/api/openapi.json`) with endpoint schemas
  - **Landing page** with animated terminal hero, feature highlights, and platform stats
  - **Navigation** with search integration, theme toggle, and sidebar config via `meta.json`
- **TypeScript SDK** (`packages/sdk`) — `@witylogix/sdk` zero-dependency HTTP client (12 files, ~1,475 lines)
  - Auto-retry on 429 rate limits with exponential backoff
  - Typed resource classes: Orders (10 methods), Drivers (10 methods), Zones (10+ methods), Shipments (11 methods)
  - 8 custom error classes (ApiError, NetworkError, ConfigError, RateLimitError, etc.)
  - Dual CJS/ESM output via tsup
- **Platform adapter guides** — Detailed integration docs for Shopify (432 lines), WooCommerce (506 lines), Magento (576 lines), Custom Platform (603 lines), and Platform Adapters overview (354 lines)
- **Component gallery** — 11 MDX pages documenting all UI components with props, variants, usage examples
- **ADR browser** — Navigable index of all 20 architecture decision records

### Sprint 4.0 — Full Coverage, CI Harden, UI Polish & Integration Tests (2026-03-10)

#### Added

- **ADR-019** — CI/CD pipeline & release strategy (391 lines) with pipeline stages, Docker build, coverage thresholds, deploy preview, ASCII diagrams (`docs/adr/ADR-019-cicd-pipeline-release.md`)
- **LICENSE** — AGPL-3.0 license file with commercial licensing clause
- **CI hardening** — Docker build step, Prisma generate caching, test coverage output in GitHub Actions CI workflow
- **4 final API route test suites** — auth-providers (55), billing-subscriptions (52), feature-requests (48), payment-methods (56) — 211 test cases, 100% API route coverage
- **4 integration test suites** — order-lifecycle (20 cases), auth-flow (25 cases), billing-flow (20 cases), webhook-chain (22 cases) — 87 multi-step E2E flow tests
- **4 Shopify app route test suites** — app-index (29), app-settings (64), app-webhooks (62), app-orders (82) — 237 test cases for React Router v7 loaders/actions
- **4 platform webhook E2E test suites** — Shopify (36), WooCommerce (35), Magento (40), cross-platform (22) — 133 full webhook chain tests
- **9 dashboard component unit test suites** — button, card, badge, input, modal, table, date-picker, pagination, error-boundary — 200+ test cases with @testing-library/react
- **6 new UI components** — Breadcrumb (nav trail), Avatar (initials fallback), Switch (toggle), Checkbox (indeterminate), Alert (4 variants with auto-icons), Progress (bar with label) — all dark theme, Tailwind, `cn()`

#### Changed

- **Tailwind final push** (Batches 26-27) — drivers, widgets, campaigns/[id], design-system, register, routes, locations, delivery, calendar, login, orders/local, routes/[id], routes/create — remaining static inline styles converted

### Sprint 3.9 — Route Tests Deep, Docker, CONTRIBUTING & UI Components (2026-03-09)

#### Added

- **CONTRIBUTING.md** — Comprehensive open-source contribution guide (536 lines) with getting started, project structure, development workflow, code style, testing, commit conventions, PR guidelines, and architecture notes
- **Docker Compose setup** — `docker-compose.yml` with PostgreSQL 16, Redis 7, API, and Dashboard services; multi-stage `Dockerfile` (node:20-alpine, turbo build, minimal runner); `.dockerignore` for build optimization
- **25 API route test suites** — activity-logs (43), analytics-events (52), audit (42), carriers (54), tracking (50), orgs (53), routes-api (57), permissions (53), time-slots (48), zones (49), shipping-profiles (40), calendar-rules (37), notification-templates (42), messages (38), saved-views (54), woocommerce-webhooks (48), magento-webhooks (40), custom-webhooks (43), outbound-webhooks (43), workflow-orders (53), workflow-delivery (60), workflow-drivers (63), workflow-executions (64), pos (74), widget-config (74) — 1,274 test cases total, 155+ suites
- **DatePicker component** — Calendar dropdown with month/year navigation, day grid, today/selected highlighting, min/max date range, click-outside close, keyboard support, dark theme (`apps/dashboard/src/components/ui/date-picker.tsx`)
- **Pagination component** — Previous/Next/First/Last navigation, smart page number display with ellipsis, "Showing X-Y of Z" text, optional page size selector, dark theme (`apps/dashboard/src/components/ui/pagination.tsx`)

#### Changed

- **12 dashboard pages migrated to Tailwind CSS** (144 total) — widgets, admin, activity, widget-config, integrations, admin/users, admin/customers, admin/design-system, campaigns/[id], analytics + more

### Sprint 3.8 — Security, Error Boundaries, Route Tests & Tailwind Final (2026-03-09)

#### Added

- **ADR-018** — Error handling & resilience patterns (869 lines) with RFC 7807, circuit breakers, retry/backoff, DLQ handling, client-side error reporting, Prometheus metrics (`docs/adr/ADR-018-error-handling-resilience.md`)
- **`.gitleaks.toml`** — Secret scanner configuration with `sk_example_*` allowlist, detection rules for Stripe/AWS/DB/OAuth/JWT/PEM keys
- **Next.js error boundaries** — Root `error.tsx`, `not-found.tsx`, `loading.tsx`, auth-specific `error.tsx`/`loading.tsx`, reusable `ErrorBoundary` class component with `componentDidCatch` and monitoring hooks
- **15 API route test suites** — auth (51), billing (61), campaigns (87), shipments (47), collections (49), integrations (46), customers (48), payments (51), locations (55), products (62), users (76), shops (95), analytics (42), admin (43), support-tickets (53) — 771 test cases total, 130+ suites

#### Changed

- **Security: demo API key fix** — Replaced all `sk_live_*`/`sk_test_*` with `sk_example_*` prefix in settings/api-keys and stores pages to prevent GitHub secret scanner false positives
- **14 dashboard pages migrated to Tailwind CSS** (132 total) — settings, routes, routes/create, locations, delivery, calendar, (auth)/login, zones, time-slots, shipping-profiles, orders, notifications, collections, billing

### Sprint 3.7 — Auth Actions, Core Module Tests & Deep Tailwind (2026-03-08)

#### Added

- **ADR-017** — Dashboard authentication actions architecture (454 lines) with sequence diagrams, token management, and BYOK compatibility (`docs/adr/ADR-017-dashboard-auth-actions.md`)
- **Dashboard auth actions** — Real login/register/forgot-password implementation with zod validation, API client, httpOnly cookies, structured error responses (`apps/dashboard/src/lib/auth-actions.ts`)
- **14 core module test suites** — tracking (81 tests), labels (99 tests), monitoring (75 tests), drivers (58 tests), orders (55 tests), routes (53 tests), zones (55 tests), shipping-profiles (55 tests), integrations (81 tests), events (65 tests), push (65 tests), shops (38 tests), migration (79 tests), E2E platform flow (60 tests) — 919 test cases total, 115+ suites
- **E2E platform adapter flow test** — Full lifecycle validation across all 4 platforms (Shopify→WooCommerce→Magento→Custom) with cross-platform consistency checks and stress tests

#### Changed

- **Shopify app TODO fixes (4→0)** — WebhookEventPicker integration, user ID resolution via shop owner query, pickup location from shop config, order context fetch from database
- **Dashboard auth TODO fixes (3→0)** — Replaced login/register/forgot-password stubs with real API client implementations
- **Zero TODOs remaining** across entire non-dist codebase (was 7, now 0)
- **15 dashboard pages migrated to Tailwind CSS** (118 total) — admin/design-system, widgets, home, drivers, campaigns/[id], (auth)/layout, shipments, (auth)/register, admin/shops/[id], admin, activity, widget-config, routes, routes/[id], orders/local

### Sprint 3.6 — Magento, Custom Adapter, Tests & Tailwind Finish (2026-03-08)

#### Added

- **ADR-016** — Magento 2 integration architecture (671 lines) with data mapping tables, sequence diagrams, and 3-phase plan (`docs/adr/ADR-016-magento-integration.md`)
- **Magento adapter** — Magento 2 REST API v1: Bearer token auth, HMAC-SHA256 webhook validation, order/product/customer mapping, configurable product support, EAV attributes (`packages/core/src/platforms/adapters/magento.ts`)
- **Custom platform adapter** — configurable field mapping (dot notation), multi-auth (API key, HMAC, Bearer), merchant-defined JSON schema mapping (`packages/core/src/platforms/adapters/custom.ts`)
- **Magento webhook consumer** — BullMQ consumer for Magento order/product lifecycle events (`packages/core/src/queue/consumers/magento-webhook.ts`)
- **Custom webhook consumer** — BullMQ consumer for custom platform events (`packages/core/src/queue/consumers/custom-webhook.ts`)
- **Magento webhook route** — POST `/api/v4/webhooks/magento` with HMAC validation, topic routing (`apps/api/src/routes/magento-webhooks.ts`)
- **Custom webhook route** — POST `/api/v4/webhooks/custom/:shopId` with multi-auth validation (`apps/api/src/routes/custom-webhooks.ts`)
- **4 API route test suites** — orders (61 tests), drivers (61 tests), routes-optimization (52 tests), webhooks (39 tests) — 213 test cases total
- **4 platform adapter test suites** — shopify-adapter (46 tests), woocommerce-adapter (47 tests), magento-adapter (37 tests), registry (36 tests) — 197 test cases, 101+ total suites

#### Changed

- **Platform abstraction Phase 3 (final)** — `shopify_payment` → `platform_payment` in payments types, `shopifyVariantId` → `externalVariantId` in product-webhook consumer — zero Shopify-specific refs remaining
- **TODO stub cleanup (2→0)** — removed stale TODO comments in SendGrid and Twilio providers where real implementation already existed
- **15 dashboard pages migrated to Tailwind CSS** (103 total) — admin, widgets, delivery/standard, campaigns/[id], admin/design-system, register, shipping-profiles/[id], shipments, home, (auth)/layout, integrations, stores, payments, admin/shops/[id], activity

### Sprint 3.5 — WooCommerce Integration, TODO Cleanup & Final Tailwind Push (2026-03-08)

#### Added

- **ADR-015** — WooCommerce integration architecture (1,761 lines) with data mapping tables, sequence diagrams, and 4-phase implementation plan (`docs/adr/ADR-015-woocommerce-integration.md`)
- **Platform adapter system** — `PlatformAdapter` interface (713 lines), adapter registry with factory pattern, lazy loading, singleton caching (`packages/core/src/platforms/`)
- **WooCommerce adapter** — REST API v3 integration: HMAC-SHA256 webhook validation, order/product/customer mapping, paginated fetch (`packages/core/src/platforms/adapters/woocommerce.ts`)
- **Shopify adapter** — REST Admin API adapter implementing same PlatformAdapter interface (`packages/core/src/platforms/adapters/shopify.ts`)
- **WooCommerce webhook consumer** — BullMQ consumer for order/product lifecycle events with source='WOOCOMMERCE' (`packages/core/src/queue/consumers/woocommerce-webhook.ts`)
- **WooCommerce webhook route** — POST `/api/v4/webhooks/woocommerce` with HMAC validation, topic routing, async processing (`apps/api/src/routes/woocommerce-webhooks.ts`)
- **4 test suites** — platform-adapter (932 lines), workflow platform abstraction (997 lines), campaign channel dispatch (812 lines), event-bus DLQ (881 lines) — 93+ total

#### Changed

- **Platform abstraction Phase 2** — `shopifyOrderId` → `externalOrderId` in workflow-integration types/index/hooks, `shopifyId` → `externalId` in inventory types, backward-compatible migration transformers
- **TODO stub cleanup (10→2)** — route optimization BullMQ dispatch, collections Shopify GraphQL sync, integration-worker sync/webhook logic, campaign dispatcher → orchestrator integration, event-bus DLQ tracking, notification orchestrator/worker provider name tracking, campaign scheduler channel-based rate limits
- **11 dashboard pages migrated to Tailwind CSS** (88 total) — drivers (76→8), onboarding (73→1), shipping-profiles (24→3), locations (17→4), admin (16→14), register (15→9), inventory (13→1), login (12→4), admin/customers (11→3), delivery (10→4), forgot-password (10→1)

### Sprint 3.4 — Platform Source Abstraction & Competitive Intelligence (2026-03-08)

#### Added

- **ADR-014** — Platform source abstraction decision record (`docs/adr/ADR-014-platform-source-abstraction.md`)
- **Platform types** — `PlatformSource` enum (SHOPIFY, WOOCOMMERCE, MAGENTO, CUSTOM), `ExternalReference` interface, `isPlatformSource()` helper (`packages/types/src/platform.ts`)
- **Collection platform adapter** — `CollectionPlatformAdapter` interface with Shopify GraphQL adapter for multi-platform collection sync (`packages/core/src/collections/adapters/`)
- **Fleetbase competitive analysis** — 840-line strategic brief covering positioning, features, architecture, go-to-market, and differentiation (`docs/competitive/fleetbase-analysis.md`)
- **Analytics DI routes** — 5 analytics event route handlers with DI container injection (`apps/api/src/routes/analytics-events.ts`)
- **Billing routes** — subscription status, recurring charges, cancellation endpoints (`apps/api/src/routes/billing.ts`)
- **4 test suites** — platform-abstraction (queue, workflows, types, collections) — 89+ total

#### Changed

- **Prisma schema** — `shopifyOrderId` → `externalOrderId`, `shopifyProductId` → `externalProductId`, `shopifyCustomerId` → `externalCustomerId`, added `source String @default("SHOPIFY")` field, updated unique constraints to `@@unique([shopId, externalOrderId, source])`
- **Queue types & consumers** — generic `externalOrderId`/`externalProductId` + `source` field replacing Shopify-specific identifiers
- **Workflow steps & definitions** — `shopifyOrderId` → `externalOrderId` throughout delivery order workflows
- **Collection manager** — refactored to generic `externalCollectionId` + `source` with adapter pattern
- **16 dashboard pages migrated to Tailwind CSS** (77 total migrated) — stores, tracking-config, admin/shops/[id], profile, activity, calendar, notifications, admin/customers, shipments, drivers, admin/workflows/[id], widget-config, shipping-profiles, admin/workflows, locations, admin/users

### Sprint 3.3 — Worker Wiring, Auth OAuth2, OSRM Routing & Final Page Migration (2026-03-08)

#### Added

- **ADR-013** — Worker-orchestrator integration architecture (`docs/adr/ADR-013-worker-orchestrator-integration.md`)
- **DHL carrier adapter** — real DHL Express API (Basic Auth, rates, ship/label, tracking, pickup, address validation)
- **OSRM Phase 2 routing** — real OSRM HTTP API (route, distance matrix, TSP trip, nearest snap-to-road)
- **Auth OAuth2 code exchange** — Google, Microsoft, Okta, Auth0, custom OIDC, SAML
- **Shopify webhook handler** — HMAC validation, 7 topic handlers, async processing
- **Webhook persistence** — Redis idempotency, DB audit trail, customer/location mapping
- **8 test suites** — orchestrator, provider-registry, worker-integration, DHL, OSRM, validators (85+ total)

#### Changed

- **Notification worker** — rewritten to delegate to orchestrator (24 TODO stubs → single orchestrator call)
- **Order/shipment/driver routes** — wired BullMQ notification enqueueing
- **Auth route** — wired password reset email via BullMQ
- **Checkout date picker** — blackout dates, lead time, capacity indicators, keyboard nav
- **17 dashboard pages migrated to Tailwind CSS** (61 total migrated)

### Sprint 3.2 — Notification Providers, Carrier APIs & POS Extension (2026-03-08)

#### Added

- **ADR-012** — Notification provider architecture decision record (`docs/adr/ADR-012-notification-provider-architecture.md`)
- **Notification orchestrator** — template rendering with Mustache interpolation, provider routing, retry with exponential backoff, delivery logging (`packages/core/src/notifications/orchestrator.ts`)
- **Provider registry** — per-tenant lazy provider initialization, health monitoring, automatic failover (`packages/core/src/notifications/provider-registry.ts`)
- **POS UI extension** — Preact order lookup + delivery assignment for Shopify POS with driver selection, time slot picker, and label printing via postMessage RPC (`extensions/pos-ui/`)
- **6 test suites** — SendGrid, Twilio, WhatsApp, Firebase Push provider tests + FedEx, UPS adapter tests (81 total)

#### Changed

- **SendGrid email provider** — replaced TODO stubs with real HTTP POST to `api.sendgrid.com/v3/mail/send`, CC/BCC/template ID support, rate limit handling
- **Twilio SMS provider** — replaced stubs with real HTTP POST to Twilio Messages API, URL-encoded form data, Twilio error code mapping
- **WhatsApp provider** — replaced stubs with real Meta Cloud API v19.0 integration, template messages with parameter interpolation, quality rating health checks
- **Firebase Push provider** — replaced stubs with real FCM HTTP v1 API, JWT-based OAuth2 with RSA-SHA256 signing, token caching with auto-refresh
- **FedEx carrier adapter** — replaced stubs with real FedEx REST API v1 (OAuth2, rate quotes, shipment/label, void, tracking, pickup, address validation)
- **UPS carrier adapter** — replaced stubs with real UPS REST API (OAuth2, rating, ship/label, void, tracking, pickup, address validation)
- **24 dashboard pages migrated to Tailwind CSS** — orders/*, routes/*, delivery/*, shipping-profiles/*, collections, integrations, inventory, locations, analytics, billing, support, profile, notifications, stores (44 total migrated)

### Sprint 3.1 — Page Migration, Queue Consumers & Extensions (2026-03-08)

#### Added

- **Extension-core package** — `@witylogix/extension-core` with theme token bridge, App Bridge wrapper, POS postMessage RPC, and 8 Preact hooks (`packages/extension-core/`)
- **ADR-011** — Extension architecture decision record (`docs/adr/ADR-011-extension-architecture.md`)
- **Checkout UI extension** — Preact delivery date picker + time slot selector for Shopify checkout (`extensions/checkout-ui/`)
- **Event-webhook bridge** — connects TypedEventBus to outbound webhook delivery with tenant scoping and wildcard filtering (`packages/core/src/webhooks/event-bridge.ts`)
- **S3 file storage** — real AWS S3 provider with presigned URLs, tenant-scoped keys, MIME detection (`packages/core/src/file-storage/s3-provider.ts`)
- **Local file storage** — filesystem fallback for dev/self-hosted (`packages/core/src/file-storage/local-provider.ts`)
- **FCM push provider** — Firebase Cloud Messaging HTTP v1 with multicast batching (`packages/core/src/push/fcm-provider.ts`)
- **Expo push provider** — Expo Push Notifications for React Native driver app (`packages/core/src/push/expo-provider.ts`)
- **6 test suites** — pipeline integration, consumer, file-storage, push (75 total)

#### Changed

- **20 dashboard pages migrated to Tailwind CSS** — customers, drivers, products, zones, calendar, activity, payments, shipments, shipments/[id], settings, settings/auth-providers, settings/billing, saved-views, mobile-config, admin, admin/users, admin/customers, admin/shops/[id], admin/workflows, admin/workflows/[id]
- **Queue consumer DB integration** — product-webhook, order-webhook, driver-tracking, event-scheduler wired with Prisma + event bus emission
- **File storage index** — replaced stub with provider factory pattern

### Sprint 3.0 — Event System, Webhooks & Design System (2026-03-07)

#### Added

- **TypedEventBus** — Event bus with Redis Streams backend (XADD/XREADGROUP/XACK), InMemory fallback adapter, middleware pipeline (beforePublish/afterPublish), retry with exponential backoff, dead-letter queue, per-tenant metrics, and 18 typed domain events (`packages/core/src/event-bus/`)
- **ADR-010** — Event bus architecture decision record with Redis Streams vs Kafka analysis, consumer group design, and scaling strategy (`docs/adr/ADR-010-event-bus-architecture.md`)
- **Outbound webhook system** — WebhookManager with full lifecycle (register, update, delete, deliver, retry), HMAC-SHA256 payload signing, exponential retry with circuit breaker (5 failures → open), background polling processor, type-safe EventEmitter (`packages/core/src/webhooks/`)
- **Webhook API routes** — 10 Fastify endpoints for webhook CRUD, test delivery, delivery logs, and retry (`apps/api/src/routes/outbound-webhooks.ts`)
- **Webhook Prisma schema** — WebhookEndpoint, WebhookDelivery, WebhookEventLog models (`packages/db/prisma/schema/30-outbound-webhooks.prisma`)
- **Workflow-API integration** — WorkflowIntegrationService with auto-trigger on order creation, driver assignment, and delivery completion; Fastify lifecycle hooks with non-blocking execution via setImmediate; trigger mode config (auto/manual/disabled) (`packages/core/src/workflow-integration/`)
- **Workflow integration plugin** — Fastify plugin with `fastify.workflows` decorator (`apps/api/src/plugins/workflow-integration.ts`)
- **Real-time workflow events** — WorkflowRealtimeService with Socket.io room-based emission, rate limiting (10 events/sec/execution), tenant-scoped rooms, graceful fallback, discriminated union payloads with 8 event types (`packages/core/src/realtime/workflow-events.ts`)
- **SSE fallback endpoint** — Server-Sent Events endpoint for workflow execution streaming when Socket.io unavailable (`apps/api/src/routes/workflow-executions.ts`)
- **Workflow realtime plugin** — Fastify plugin for Socket.io workflow event integration (`apps/api/src/plugins/workflow-realtime.ts`)
- **shadcn/ui-inspired design system (Phase 1)** — Tailwind CSS migration with `cn()` utility, design token bridge mapping `--wl-*` CSS vars to Tailwind theme, migrated 6 components: button, card, badge, input, select, modal — all preserving exact same component API for backward compatibility (`apps/dashboard/`)
- **shadcn/ui-inspired design system (Phase 2)** — Migrated 5 more components: table, tabs, toast, stat-card, empty-state; 3 new components: dropdown-menu (position-aware, keyboard nav), skeleton (6 variants), tooltip (hover trigger, positioning, arrow) (`apps/dashboard/src/components/ui/`)
- **Design system foundation** — Tailwind token CSS layer with animations/keyframes, migrated header and sidebar layouts to Tailwind, barrel export (`ui/index.ts`), interactive component gallery page (`/admin/design-system`)
- **Shopify webhook management** — Webhook config page with event picker multi-select, delivery log table, detail/edit page with Polaris v13 (`apps/shopify-app/`)
- **Shopify webhook API handler** — HMAC-validated webhook receiver with Shopify order → workflow mapping (`apps/shopify-app/app/routes/api.webhooks.workflow.tsx`)
- **6 test suites** — event-bus, webhook-manager, workflow-integration, realtime-workflows, ui-components, webhook-routes (69 total test files)

### Sprint 2.9 — Workflow Engine Framework (Medusa v2-Inspired) (2026-03-07)

#### Added

- **Workflow engine framework** — Medusa v2-inspired step-based orchestration engine with DI container, step runner with retry/timeout, compensation engine (reverse-order rollback), workflow registry, and lifecycle hooks (`packages/framework/`)
- **3 core delivery workflows** — `createDeliveryOrderWorkflow` (9 steps: validate → geocode → rate → create → zone → inventory → reserve → notify → emit), `assignDriverWorkflow` (10 steps: validate → find → score → select → assign → optimize → ETA → notify driver → notify customer → emit), `completeDeliveryWorkflow` (11 steps: validate → POD → status → driver → metrics → billing → inventory → notify customer → notify merchant → archive → emit) — all with per-step compensation (`packages/workflows/`)
- **12 reusable workflow steps** — validation, geocoding (Haversine), rate calculation (zone-based tiered pricing), driver scoring (proximity 40%, rating 25%, load 20%, completion 15%), POD verification (photo/signature/code), billing, notifications, zone assignment, inventory management (`packages/workflows/src/steps/`)
- **BullMQ durable execution** — workflow queue with retry policies (3 attempts, exponential backoff), worker with progress tracking, scheduler with cron expressions, dead-letter queue handler with alert hooks (`packages/framework/src/queue/`)
- **Workflow API routes** — `POST /api/workflow/orders`, `POST /api/workflow/drivers/assign`, `POST /api/workflow/delivery/complete` with execution tracking, retry, and cancellation endpoints (4 new route files, 12+ endpoints)
- **Dashboard workflow viewer** — execution list page with status filters + step timeline detail page with collapsible JSON data, compensation indicators, and retry actions (2 new pages, 66 total)
- **6 test suites** — workflow engine, DI container, step runner, and all 3 delivery workflow tests (240+ test cases, 63 total test files)
- **ADR-009** — Medusa v2-inspired architecture evolution with deep technical comparison, 10 workflow definitions, target file structure, billing module migration strategy, 5 conscious differences from Medusa, and 4-phase 18-month roadmap
- **Architecture debate** — Blue team / Red team standup debate stored in `docs/sprint-notes/STANDUP-2026-03-07-architecture-debate.md`
- **Sprint tracker renamed** — `gap-analysis.xlsx` → `witylogix-sprint-tracker.xlsx` with new "Standup Notes & Actions" sheet

### Sprint 2.8 — Auth Providers, Admin Panel & Production Deploy (2026-03-07)

#### Added

- **Auth provider abstraction** — BYOK auth system with provider registry, 7 providers (Local, Auth0, Clerk, Cognito, Firebase Auth, Generic OIDC, SAML 2.0), tenant override with deployer fallback, metered usage tracking (`packages/core/src/auth/`)
- **ADR-008** — Architecture Decision Record for auth provider abstraction with options analysis, 4-phase implementation roadmap, and 7 monitoring KPIs (`docs/adr/ADR-008-auth-provider-abstraction.md`)
- **POS integration** — Point-of-sale checkout with multi-provider support (Shopify POS, Square, Custom), 3 delivery modes (local, in-store pickup, curbside), custom form builder with 8 field types (`packages/core/src/pos/`)
- **API hardening** — Standardized error handler (8 error classes, Prisma/Zod mapping), token-bucket rate limiter (tier-based: FREE→ENTERPRISE), request validator with XSS protection, OpenAPI 3.0 spec generator with Swagger UI (`packages/core/src/api-hardening/`)
- **Platform admin panel** — Admin dashboard overview, user management (suspend/restore/impersonate), customer management across stores, store health monitoring (4 new dashboard pages)
- **Activity log redesign** — Timeline/table dual views, advanced filters, expandable diff viewer, CSV export, real-time indicator
- **Settings hub redesign** — 7-section settings with left sidebar navigation, auth provider config UI, security checklist
- **Standard delivery workflow** — Orders/Shipments/Carriers management with batch actions
- **Dashboard pages:** admin overview, admin users, admin customers, activity log (redesigned), settings hub (redesigned), settings/auth-providers, delivery/standard (7 new/redesigned pages, 64 total)
- **API routes:** auth providers (10 endpoints), POS (10), admin platform (13), API hardening middleware — 33 new endpoints (total 75+)
- **Shopify routes:** auth-providers config, POS index, POS detail (Polaris v13)
- **Prisma modules:** 39-auth-providers (AuthProvider, ExternalAuthSession, AuthMeterEvent), 40-pos-integration (PosConfig, PosOrder, PosCustomForm) — 30 total schemas
- **Docker production stack** — Multi-stage Dockerfiles (API, Dashboard, Shopify), compose.prod.yml with 8 services (Postgres+PostGIS, Redis, API, Dashboard, Shopify, Worker, Nginx), nginx reverse proxy with WebSocket support, docker-entrypoint with migrations
- **6 new test suites:** auth provider registry, POS manager, error handler, rate limiter, request validator, admin API (57 total)

### Sprint 2.7 — Billing, Delivery Workflow & Polish (2026-03-07)

#### Added

- **Billing system** — Subscription manager with trial support, upgrade/downgrade, prorated billing; quota enforcer with atomic usage tracking, warning thresholds, and Fastify middleware; invoice generator with line items, discounts, and PDF export (`packages/core/src/billing/`)
- **Process manager** — Multi-worker orchestration with auto-restart, exponential backoff (1s→30s), graceful shutdown, and 4 specialized workers: billing, campaign, notification, analytics (`packages/core/src/process-manager/`)
- **Saved views engine** — Dynamic filter builder (10 operators, 6 tables), column visibility, sort config, share/unshare, duplicate, and default views (`packages/core/src/saved-views/`)
- **Widget manager** — 8 widget types, auto-positioning on 4×3 grid, soft delete, drag-to-reorder, catalog browser (`packages/core/src/widgets/`)
- **Collections manager** — Manual and auto collections, rule evaluation, Shopify sync, product ordering (`packages/core/src/collections/`)
- **Support ticket system** — Full ticket lifecycle (open→assigned→resolved→closed), threaded messages, feature request voting (`packages/core/src/support/`)
- **Dashboard pages:** delivery workflow hub, mobile config, billing & plans, saved views, widgets, collections (6 new pages)
- **API routes:** billing subscriptions (10 endpoints), support tickets (8), feature requests (6), saved views (9), widget config (8), collections (8) — 49 new endpoints
- **Shopify routes:** billing & invoices, support center & ticket detail, collections management (Polaris v13)
- **Prisma modules:** 35-billing-subscriptions (BillingPlan, BillingSubscription, Invoice, StoreQuotaUsage), 36-shipment-items, 38-saved-views (SavedView, Widget, SupportTicket, SupportMessage, FeatureRequest)
- **7 new test suites:** subscription manager, quota enforcer, collection manager, ticket manager, view engine, widget manager, process manager

### Sprint 2.6 — Campaigns, Messaging & Admin (2026-03-07)

#### Added

- **RBAC policy engine** with 14 resource types, 7 action types, wildcard permissions, role hierarchy enforcement, and permission caching (5-min TTL) (`packages/core/src/rbac/`)
- **Audit trail system** with batch logging (50 events / 5s), automatic diff computation, sensitive field masking, full-text search, and CSV export (`packages/core/src/audit/`)
- **Unified messaging dispatcher** supporting email (SendGrid-compatible), SMS (Twilio-compatible), WhatsApp (Meta Cloud API), and push notifications (FCM) with retry logic, rate limiting, and provider abstraction (`packages/core/src/messaging/`)
- **Campaign engine** with audience segmentation (parameterized SQL), timezone-aware scheduling, state machine lifecycle (draft → scheduled → sending → completed), and batch processing with pause/resume (`packages/core/src/campaigns/`)
- **Structured logging** — Pino-compatible JSON logger with request tracing (UUID v4 correlation IDs), slow-request warnings, and sensitive field redaction (`packages/core/src/logging/`)
- **Field-level encryption** — AES-256-GCM with scrypt key derivation, key rotation support, and Prisma middleware for transparent encrypt/decrypt (`packages/core/src/encryption/`)
- **Dashboard pages:** admin super panel, store detail admin, support center, tracking config, campaign dashboard, campaign detail
- **API routes:** campaigns (10 endpoints), messages (9 endpoints), audit (4 endpoints with CSV export), permissions (8 endpoints with RBAC management)
- **Shopify routes:** campaigns list/detail, template editor, audit log viewer (Polaris v13)
- **Prisma modules:** 33-messaging (Message, MessageTemplate, WhatsAppConfig), 34-campaigns (Campaign, BroadcastGroup, CampaignEvent)
- **7 new test suites:** RBAC policy engine, audit logger, message dispatcher, campaign executor, audience builder, crypto service, structured logger

### Sprint 2.5 — Shipping Core & Public APIs (2026-03-06)

#### Added

- **Route optimization engine** with nearest-neighbor, 2-opt, and Clarke-Wright algorithms plus ETA calculation
- **Shipping profiles** with rate calculation, calendar management, and validation
- **Payment processing** with gateway abstraction and billing system
- **Analytics engine** with event tracking, aggregation, and dashboard queries
- **Queue consumers** (4 types) and spatial queries module
- **Cart plugin components** for checkout (date picker, time slots, rates)
- **Migration framework** with location management API
- 8 test suites covering optimizer, payments, analytics, queues, and more

### Sprint 2.4 — Real-time & Mobile (2026-03-05)

#### Added

- Socket.io real-time layer with Redis adapter
- React Native driver app with background GPS
- Customer tracking page with Leaflet maps
- File storage (local + S3)
- BullMQ integration worker

### Sprint 2.3 — Notifications & Integrations (2026-03-04)

#### Added

- Multi-channel notification system (email, SMS, WhatsApp, push)
- BYOK (Bring Your Own Key) notification providers
- Integration Marketplace with 38 integrations across 6 categories
- Notification metering for fallback billing

### Sprint 2.1 — Routing & BYOK (2026-03-03)

#### Added

- Multi-provider routing registry (Mapbox, OSRM, Google, HERE, GraphHopper, TomTom)
- BYOK mode for routing — tenants bring their own API keys
- Routing metering for fallback usage billing

### Sprint 2.0 — Multi-tenant (2026-03-02)

#### Added

- Organization support with multi-shop grouping
- Dual-mode RLS for shop + org isolation
- Org-level roles (OWNER, ADMIN, MEMBER)

### Sprint 1.2 — Core CRUD (2026-03-01)

#### Added

- Full CRUD API routes for orders, drivers, zones, time-slots, shops
- Shopify webhook ingestion (orders, app lifecycle, GDPR)
- Dashboard pages for order management, driver management, zone editing

### Sprint 1.1 — Foundation (2026-02-28)

#### Added

- Turborepo monorepo with pnpm workspaces
- PostgreSQL + PostGIS + Prisma 6 schema
- JWT authentication with refresh tokens
- Fastify 5 API server skeleton
- Dashboard shell with dark theme
