# Changelog

All notable changes to the Witylogix platform are documented here. This project follows [Keep a Changelog](https://keepachangelog.com) conventions and [Semantic Versioning](https://semver.org).

## [Unreleased]

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
