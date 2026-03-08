# Changelog

All notable changes to the Witylogix platform are documented here. This project follows [Keep a Changelog](https://keepachangelog.com) conventions and [Semantic Versioning](https://semver.org).

## [Unreleased]

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
