<p align="center">
  <a href="https://witylogix.com">
    <img src="public/logo.svg" width="120" alt="Witylogix" />
  </a>
</p>

<h3 align="center">Witylogix</h3>

<p align="center">
  Open-source delivery logistics for e-commerce
  <br />
  <a href="#getting-started"><strong>Get Started</strong></a> · <a href="https://docs.witylogix.com"><strong>Docs</strong></a> · <a href="https://github.com/witylogix/witylogix-platform/issues"><strong>Issues</strong></a> · <a href="https://discord.gg/witylogix"><strong>Discord</strong></a>
</p>

<p align="center">
  <a href="https://github.com/witylogix/witylogix-platform/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License" />
  </a>
  <a href="https://github.com/witylogix/witylogix-platform/stargazers">
    <img src="https://img.shields.io/github/stars/witylogix/witylogix-platform?style=social" alt="GitHub Stars" />
  </a>
  <a href="https://discord.gg/witylogix">
    <img src="https://img.shields.io/discord/000000000?label=Discord&logo=discord&logoColor=white" alt="Discord" />
  </a>
  <a href="https://github.com/witylogix/witylogix-platform/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/witylogix/witylogix-platform/ci.yml?branch=main" alt="CI" />
  </a>
</p>

<br />

<p align="center">
  <img src="public/logo-banner.svg" width="600" alt="Witylogix — Open-source delivery logistics for e-commerce" />
</p>

---

## What is Witylogix?

Witylogix is an open-source delivery management platform that enables e-commerce merchants to control their entire last-mile logistics operation—from zone-based pricing at checkout to real-time driver tracking and proof of delivery—without paying per-transaction fees. Self-host with `docker compose up` or use our managed cloud.

The platform integrates natively with Shopify (React Router v7, Polaris Web Components, Preact extensions), with support for WooCommerce, Magento, and custom storefronts coming soon. Multi-tenant isolation is enforced at the PostgreSQL Row-Level Security (RLS) layer, ensuring strong data boundaries between merchants.

Built on Fastify 5, Next.js 15, PostgreSQL + PostGIS, Redis Streams, and a production-grade workflow engine with event-driven architecture.

### Key capabilities

- **Dynamic delivery rates** at checkout via platform-native APIs (p95 < 500ms)
- **Zone-based pricing** with PostGIS polygon geometry — draw zones on a map, assign rates
- **Route optimization** with multi-provider routing (Mapbox, OSRM, Google Maps, HERE, GraphHopper, TomTom) — deployers set a default, tenants can BYOK (Bring Your Own Key) with metered fallback billing
- **Real-time driver tracking** over WebSockets with a customer-facing Leaflet map
- **Driver mobile app** (React Native) with background GPS and proof-of-delivery capture
- **Multi-channel notifications** with multi-provider support — Email (SendGrid, Mailgun, SES, Postmark, Resend, SMTP), SMS (Twilio, Vonage, SNS, MessageBird, Plivo), WhatsApp (Meta Cloud, Twilio, 360dialog), Push (Firebase, OneSignal, Expo) — deployers set defaults per channel, tenants can BYOK with metered fallback
- **Multi-tenant isolation** enforced at the database level via PostgreSQL Row-Level Security
- **Multi-shop organizations** — merchants with multiple stores group them under one org with shared drivers, zones, and cross-shop analytics
- **Role-based access control** — hierarchical RBAC with policy engine (14 resource types, 7 action types), permission caching (5-min TTL), wildcard support, and shop/org dual-level roles
- **Audit trail** — batch audit logging (50 events / 5s flush), automatic diff computation, sensitive field masking, full-text search, and CSV export for compliance
- **Campaign engine** — audience segmentation with parameterized SQL, timezone-aware scheduling, state machine lifecycle (draft → scheduled → sending → completed), batch processing with pause/resume
- **Unified messaging** — multi-channel dispatcher (email, SMS, WhatsApp, push) with provider abstraction, retry logic, rate limiting, template rendering, and webhook handling
- **Structured logging** — Pino-compatible JSON logger with request tracing (UUID v4 correlation IDs), slow-request warnings, and sensitive field redaction
- **Field-level encryption** — AES-256-GCM with scrypt key derivation, key rotation support, and Prisma middleware for transparent encrypt/decrypt
- **JWT authentication** with refresh token rotation, scrypt password hashing, and password reset flows
- **Billing & subscriptions** — plan management with trial periods, upgrade/downgrade with proration, quota enforcement with atomic usage tracking, invoice generation with line items and PDF export, and metered fallback billing
- **Process manager** — multi-worker orchestration with auto-restart, exponential backoff, graceful shutdown, and specialized workers for billing, campaigns, notifications, and analytics
- **Saved views & widgets** — customizable dashboard views with filter builder (10 operators, 6 tables), column visibility, sort config, and 8 drag-and-drop widget types on a 4×3 grid
- **Collections** — manual and auto product collections with rule evaluation, Shopify sync, and product reordering
- **Support system** — full ticket lifecycle with threaded messages, assignment, resolution, and feature request voting
- **Integration Marketplace** — unified catalog of 38 integrations across 6 categories (Communication, Routing, Order Management, Inventory, Payment, Analytics) with per-tenant install/configure, BYOK credentials, health monitoring, and metered fallback billing
- **Auth provider abstraction** — BYOK authentication with provider registry (Local, Auth0, Clerk, Cognito, Firebase Auth, Generic OIDC, SAML 2.0), tenant override with deployer fallback, metered usage tracking, and session management across providers
- **POS integration** — point-of-sale checkout with multi-provider support (Shopify POS, Square, Custom), 3 delivery modes (local delivery, in-store pickup, curbside), custom form builder with 8 field types and validation
- **Platform admin panel** — store/user/customer management across the entire platform, suspension/restoration, impersonation, health monitoring, and aggregated dashboard metrics
- **API hardening** — standardized error handling (8 error classes with Prisma/Zod mapping), token-bucket rate limiter (tier-based: FREE 50/min → ENTERPRISE 1000/min), request validation with XSS protection, and OpenAPI 3.0 spec with Swagger UI
- **Workflow engine** — Medusa v2-inspired step-based orchestration with DI container, per-step compensation (reverse-order rollback), retry with exponential backoff, timeout support, lifecycle hooks, and workflow registry (`packages/framework/`)
- **3 core delivery workflows** — `createDeliveryOrder` (9 steps), `assignDriver` (10 steps with scoring algorithm), `completeDelivery` (11 steps with POD verification) — each with automatic compensation chains for safe rollback on failure (`packages/workflows/`)
- **BullMQ durable execution** — workflow queue with retry policies, progress tracking, cron-based scheduling, dead-letter queue, and graceful degradation to in-memory mode
- **Event bus** — TypedEventBus with Redis Streams backend (XADD/XREADGROUP/XACK), InMemory fallback, middleware pipeline, retry with exponential backoff, dead-letter queue, 18 domain events, and per-tenant metrics (`packages/core/src/event-bus/`)
- **Outbound webhooks** — HMAC-SHA256 signed deliveries, exponential retry with circuit breaker, background polling processor, type-safe event emission, 10 API endpoints (`packages/core/src/webhooks/`)
- **Workflow-API integration** — auto-trigger workflows from existing endpoints (order creation, driver assignment, delivery completion) with non-blocking execution via setImmediate (`packages/core/src/workflow-integration/`)
- **Real-time workflow events** — Socket.io room-based emission with rate limiting (10 events/sec/execution), SSE fallback endpoint, discriminated union payloads (`packages/core/src/realtime/`)
- **shadcn/ui-inspired design system** — Tailwind CSS migration preserving Witylogix industrial aesthetic, `cn()` utility, 16 migrated/new components (button, card, badge, input, select, modal, table, tabs, toast, stat-card, empty-state, dropdown-menu, skeleton, tooltip), design token bridge, component gallery page, 44 dashboard pages migrated from inline styles to Tailwind classes
- **Developer documentation** (`apps/docs`) — Fumadocs-powered docs site with 30+ MDX pages, OpenAPI 3.0 spec, AI-powered search via Claude API (RAG), component gallery, platform adapter guides (Shopify, WooCommerce, Magento, Custom), self-hosting guides, and ADR browser
- **TypeScript SDK** (`packages/sdk`) — Zero-dependency HTTP client (`@witylogix/sdk`) with auto-retry on 429, typed resources (orders, drivers, zones, shipments), dual CJS/ESM output, and comprehensive error classes
- **Extension core** — shared Preact extension package (`@witylogix/extension-core`) with theme token bridge (CSS custom property → extension context), App Bridge wrapper, POS postMessage RPC, and 8 Preact hooks
- **Checkout UI extension** — Preact-based Shopify checkout extension (< 64KB) with delivery date calendar picker, time slot selector (morning/afternoon/evening with capacity), App Bridge session token auth
- **File storage** — S3 provider (upload, download, presigned URLs, tenant-scoped keys) + local filesystem fallback for self-hosted deployments, BYOK credential resolution
- **Push notifications** — FCM HTTP v1 provider (single + multicast up to 500) + Expo Push for React Native driver app, topic subscriptions, BYOK credentials
- **Event-webhook bridge** — connects TypedEventBus emissions to outbound webhook deliveries with tenant scoping, event type filtering (exact + wildcard), error isolation
- **Queue consumer DB integration** — product-webhook, order-webhook, driver-tracking, event-scheduler fully wired with Prisma and event bus emission
- **Docker production stack** — multi-stage Dockerfiles, compose with 8 services (Postgres+PostGIS, Redis, API, Dashboard, Shopify, Worker, Nginx), health checks, graceful shutdown, and automated Prisma migrations
- **Shopify integration** — embedded admin app, checkout extensions, Carrier Service API, "Built for Shopify" ready
- **Platform-agnostic core** — decoupled business logic ready for WooCommerce, Magento, and custom storefronts

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Monorepo | [Turborepo](https://turbo.build) + [pnpm](https://pnpm.io) workspaces |
| Backend | [Fastify 5](https://fastify.dev) (TypeScript) |
| Database | [PostgreSQL 16](https://www.postgresql.org) + [PostGIS](https://postgis.net) + [Prisma](https://www.prisma.io) |
| Cache & Pub/Sub | [Redis 7](https://redis.io) (Streams, GEO, Pub/Sub) |
| Job queue | [BullMQ](https://bullmq.io) with tenant-aware groups |
| Shopify app | [React Router v7](https://reactrouter.com) + [Polaris Web Components](https://polaris.shopify.com) |
| Extensions | [Preact](https://preactjs.com) (checkout & POS, < 64KB) |
| Dashboard | [Next.js 15](https://nextjs.org) (App Router, dark theme, Tailwind CSS + shadcn/ui-inspired design system) |
| Routing | [Mapbox](https://www.mapbox.com) (Phase 1) → [OSRM](https://project-osrm.org) (Phase 2) |
| Real-time | [Socket.io](https://socket.io) + [Redis Adapter](https://socket.io/docs/v4/redis-adapter/) |
| Mobile | [React Native](https://reactnative.dev) (Expo) + background geolocation |
| Maps | [Leaflet.js](https://leafletjs.com) + OpenStreetMap tiles |
| Deployment | [Docker Compose](https://docs.docker.com/compose/) / Kubernetes |

---

## Architecture

For a comprehensive deep-dive into system design, data flows, module dependencies, database architecture, event system, multi-tenancy, integration patterns, caching strategy, security, and performance characteristics, see **[ARCHITECTURE.md](./ARCHITECTURE.md)** (400+ lines).

```
witylogix-platform/
├── apps/
│   ├── api/                 # Fastify 5 backend (REST + WebSocket + BullMQ)
│   ├── dashboard/           # Next.js 15 merchant dashboard (App Router)
│   ├── shopify-app/         # Embedded Shopify admin app (React Router v7)
│   ├── driver-app/          # React Native mobile app (Expo)
│   └── tracking-page/       # Customer-facing delivery tracking (Leaflet)
├── extensions/
│   ├── checkout-ui/         # Preact checkout extension (< 64KB)
│   └── pos-ui/              # POS UI extension
├── packages/
│   ├── db/                  # Prisma 6 schema (30 modules) + RLS policies
│   ├── core/                # Business logic (51 modules — routing, messaging, RBAC, campaigns, billing, etc.)
│   ├── framework/           # Workflow engine (DI container, step runner, compensation, registry, BullMQ queue)
│   ├── workflows/           # 3 core delivery workflows (30 steps) + 12 reusable step definitions
│   ├── types/               # Shared TypeScript types (JIT, no build)
│   ├── validators/          # Zod schemas (JIT, no build)
│   └── carrier-service/     # Carrier rate abstraction
├── docs/                    # ADRs, API docs, architecture blueprints
├── infra/                   # Docker, K8s, OSRM, Nginx configs
│   ├── docker/              # Dockerfiles
│   └── docker-compose.yml   # One-command local setup
└── turbo.json               # Task pipeline configuration
```

**Tenant isolation** is enforced at four layers: PostgreSQL RLS (security boundary), Redis key prefixing, BullMQ job groups, and Socket.io rooms. The database is the single source of truth — every other layer is a convenience mechanism.

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 9+
- [Docker](https://www.docker.com) and Docker Compose
- A [Shopify Partner](https://partners.shopify.com) account *(required for Shopify integration)*
- A [Mapbox](https://www.mapbox.com) access token

### Quick start

```bash
# Clone the repository
git clone https://github.com/witylogix/witylogix-platform.git
cd witylogix-platform

# Copy environment variables
cp .env.example .env
# Edit .env with your Shopify API keys, Mapbox token, etc.

# Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# Install dependencies
pnpm install

# Generate Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# Start all apps in development mode
pnpm dev
```

This starts:

| Service | URL |
|---------|-----|
| Fastify API | `http://localhost:8000` |
| Shopify App | `http://localhost:3000` |
| Tracking Page | `http://localhost:3002` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

### Setting up Shopify

1. Create a new app in your [Shopify Partners dashboard](https://partners.shopify.com)
2. Copy the API key and secret into `.env`
3. Run `pnpm --filter @witylogix/shopify-app dev` to start the Shopify CLI tunnel
4. Install the app on a development store

---

## Self-hosting

Deploy the complete stack with a single command:

```bash
docker compose up -d
```

This runs PostgreSQL 16 (with PostGIS), Redis 7, the Fastify API, and all supporting services. For production deployments, see the [self-hosting guide](docs/self-hosting.md).

### Optional services

```bash
# Phase 2: Add OSRM for zero-cost route optimization
docker compose --profile phase2 up -d

# Dev tools: BullMQ dashboard
docker compose --profile tools up -d
```

---

## Database

Witylogix uses PostgreSQL with PostGIS for spatial operations and Row-Level Security for tenant isolation. The schema is organized across 30 Prisma modules covering the full delivery lifecycle:

**Core:** organizations · org_members · shops · users · orders · drivers · delivery_zones · time_slots · routes · route_stops · proof_of_delivery

**Shipping:** shipments · shipment_proofs · carrier_services · shipping_profiles · shipping_rates · locations · location_working_hours

**Messaging:** messages · message_templates · whatsapp_configs · notification_logs

**Campaigns:** campaigns · broadcast_groups · broadcast_group_members · campaign_events

**Billing:** payments · payment_methods · billing_plans · billing_subscriptions · invoices · store_quota_usage

**Support & Views:** saved_views · widgets · support_tickets · support_messages · feature_requests

**Other:** shipment_items · collections · collection_products

**Metering:** routing_meter_events · notification_meter_events · integration_events

Every tenant-scoped table has an RLS policy that automatically filters queries by `shop_id`. The Prisma client provides three scoping modes:

```typescript
import { forTenant, forOrg, forTenantInOrg } from "@witylogix/db";

// Shop-only (standalone shops, Shopify webhooks, carrier service)
const db = forTenant(shopId);
const orders = await db.order.findMany(); // Filtered by shop_id

// Org-wide (org dashboard, cross-shop analytics)
const orgDb = forOrg(orgId);
const drivers = await orgDb.driver.findMany(); // All drivers across org

// Dual-scoped (shop data + org-shared drivers/zones)
const dualDb = forTenantInOrg(shopId, orgId);
const available = await dualDb.driver.findMany(); // Shop drivers + org drivers
```

PostGIS helper functions:

- `find_delivery_zone(shop_id, lng, lat)` — find which zone contains a point (includes org-shared zones)
- `find_nearby_drivers(shop_id, lng, lat, radius)` — find available drivers within radius (includes org-shared drivers)

### Multi-shop organizations

Merchants with multiple Shopify stores can group them under an **Organization**. This is entirely optional — standalone shops work exactly as before with zero behavioral change.

```
Organization (optional)
├── Shop A  (shopify-store-a.myshopify.com)
├── Shop B  (shopify-store-b.myshopify.com)
├── Shared Drivers (org-level)
├── Shared Delivery Zones (org-level)
└── Org Members (OWNER, ADMIN, MEMBER)
```

Key design decisions: Shopify OAuth, webhooks, and carrier service always operate at the **shop level** — they are completely unaware of the org layer. The org layer only affects the dashboard and driver app, where users can manage cross-shop resources.

### Authentication & RBAC

Three authentication flows converge at the same JWT middleware:

1. **Dashboard users**: email + password → JWT with `shopId`, `orgId`, `role`, `orgRole`
2. **Driver app**: phone + password → JWT with `shopId`, `role: DRIVER`
3. **Shopify embedded app**: session token from App Bridge (verified separately)

**Shop-level roles** (enforced on every route via `requireRole()` middleware):

| Role | Capabilities |
|------|-------------|
| SUPER_ADMIN | Full access, manage users, manage settings |
| ADMIN | Manage orders, drivers, zones, routes |
| DISPATCHER | Assign orders, manage routes, update statuses |
| VIEWER | Read-only dashboard access |
| DRIVER | Driver app only — update own status/location |

**Org-level roles** (enforced via `requireOrgRole()` on org routes):

| Role | Capabilities |
|------|-------------|
| OWNER | Full org management, link/unlink shops, manage all members |
| ADMIN | Manage org members, link shops |
| MEMBER | View cross-shop data within permitted shops |

Role hierarchy is enforced — users can only manage others at their level or below. The last SUPER_ADMIN or OWNER cannot be removed.

---

## Routing

The routing system uses a **multi-provider registry** with a clean abstraction layer. Deployers choose a default provider; tenants can pick their own when BYOK mode is enabled.

```typescript
import { createRoutingProvider } from "@witylogix/core/routing";

// Platform mode — uses deployer's configured provider
const { instance: routing } = createRoutingProvider();

// BYOK mode — pass tenant credentials from shop.settings.routing
const { instance: routing } = createRoutingProvider(
  { provider: "mapbox", apiKey: "pk.eyJ1..." },
  shopId,
);

const matrix = await routing.getDistanceMatrix(points);
const route = await routing.getRoute(origin, destination);
const results = await routing.geocode("123 Main St, Brooklyn, NY");
```

### Supported Providers

| Provider | Status | Auth | Capabilities |
|----------|--------|------|-------------|
| **Mapbox** | Available | API Key (Access Token) | Routing, Matrix (25 pts), Geocoding, ETA |
| **OSRM** (self-hosted) | Available | None (base URL) | Routing, Matrix (unlimited), ETA |
| **Google Maps** | Coming Soon | API Key | Routing, Matrix, Geocoding, ETA |
| **HERE** | Coming Soon | API Key | Routing, Matrix, Geocoding, ETA |
| **GraphHopper** | Coming Soon | API Key | Routing, Matrix, Geocoding, ETA |
| **TomTom** | Coming Soon | API Key | Routing, Matrix, Geocoding, ETA |

Switch providers with one env var: `ROUTING_PROVIDER=mapbox` (or `osrm`, `google_maps`, `here`, `graphhopper`, `tomtom`)

### BYOK (Bring Your Own Key) mode

Deployers control how routing credentials are provisioned across tenants via `ROUTING_BYOK`:

| Mode | Env var | Behavior |
|------|---------|----------|
| **Platform-managed** (default) | `ROUTING_BYOK=false` | Deployer provides credentials for one provider. All tenants share it. Simplest setup. |
| **Bring Your Own Key** | `ROUTING_BYOK=true` | Each tenant picks their own provider and enters credentials via Settings → Routing. Fallback to deployer credentials is **metered** for billing. |

When BYOK is enabled, tenants see a "Routing" tab in Settings with a **provider picker** showing all available and coming-soon providers. They select a provider, enter credentials, and save. Credentials are stored in the shop's `settings.routing` JSON object and never exposed in API responses (only masked previews).

If a tenant hasn't configured their own credentials, the platform falls back to the deployer's default provider and credentials. Every API call that uses the fallback is **metered** in the `routing_meter_events` table, giving deployers data for usage-based billing.

### Metering

When BYOK is enabled and a tenant uses the deployer's fallback credentials, every routing operation is recorded:

| Field | Description |
|-------|-------------|
| `shopId` | Which tenant made the call |
| `provider` | Which provider was used |
| `operation` | `route`, `matrix`, `geocode`, `reverse_geocode`, or `eta` |
| `usedFallback` | Always `true` for metered events |
| `timestamp` | When the call was made |

Query the `routing_meter_events` table or call `GET /api/v4/shops/me/routing/meter` for a 30-day summary.

```bash
# Platform-managed (default — one key for everyone)
ROUTING_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoiZGVwbG95ZXIiLCJhIjoiY2xr...

# BYOK mode — tenants pick their own provider + credentials
ROUTING_BYOK=true
ROUTING_PROVIDER=mapbox                  # deployer default (fallback)
MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoi...       # optional fallback key (metered)

# Or if deployer prefers Google Maps as default:
# ROUTING_PROVIDER=google_maps
# GOOGLE_MAPS_API_KEY=AIzaSy...
```

---

## Notifications

The notification system uses the same **multi-provider registry + BYOK** pattern as routing. Each notification channel (Email, SMS, WhatsApp, Push) has its own independent provider registry.

```typescript
import { resolveNotificationProvider } from "@witylogix/core/notifications";

// Resolve provider for a channel (tenant → deployer fallback + metering)
const resolved = resolveNotificationProvider("email", tenantConfig?.email, shopId);

if (resolved.available) {
  // resolved.provider = "sendgrid" | "mailgun" | etc.
  // resolved.credentials = { SENDGRID_API_KEY: "SG.xxx" }
  // resolved.usedFallback = true if using deployer credentials
}
```

### Supported Notification Providers

**Email:**

| Provider | Status | Auth Type |
|----------|--------|-----------|
| **SendGrid** | Available | API Key |
| **Mailgun** | Coming Soon | API Key + Domain |
| **AWS SES** | Coming Soon | Access Key + Secret |
| **Postmark** | Coming Soon | Server Token |
| **Resend** | Coming Soon | API Key |
| **SMTP (Generic)** | Coming Soon | Host + Port + Credentials |

**SMS:**

| Provider | Status | Auth Type |
|----------|--------|-----------|
| **Twilio** | Available | Account SID + Auth Token |
| **Vonage (Nexmo)** | Coming Soon | API Key + Secret |
| **AWS SNS** | Coming Soon | Access Key + Secret |
| **MessageBird** | Coming Soon | API Key |
| **Plivo** | Coming Soon | Auth ID + Auth Token |

**WhatsApp:**

| Provider | Status | Auth Type |
|----------|--------|-----------|
| **Meta Cloud API** | Available | Access Token + Phone Number ID |
| **Twilio WhatsApp** | Coming Soon | Account SID + Auth Token |
| **360dialog** | Coming Soon | API Key |

**Push:**

| Provider | Status | Auth Type |
|----------|--------|-----------|
| **Firebase (FCM)** | Available | Service Account credentials |
| **OneSignal** | Coming Soon | App ID + REST API Key |
| **Expo Push** | Coming Soon | Access Token (optional) |

Switch providers with env vars: `EMAIL_PROVIDER=sendgrid`, `SMS_PROVIDER=twilio`, `WHATSAPP_PROVIDER=meta_cloud`, `PUSH_PROVIDER=firebase`

### Notification BYOK mode

Same pattern as routing — deployers control whether tenants can pick their own notification providers via `NOTIFICATIONS_BYOK`:

| Mode | Env var | Behavior |
|------|---------|----------|
| **Platform-managed** (default) | `NOTIFICATIONS_BYOK=false` | Deployer provides credentials for each channel. All tenants share them. |
| **Bring Your Own Key** | `NOTIFICATIONS_BYOK=true` | Tenants choose per-channel providers via Settings → Notifications. Fallback to deployer credentials is **metered**. |

Tenant notification credentials are stored in `shop.settings.notifications.<channel>` and masked in API responses. Metering events are recorded in `notification_meter_events` for billing.

```bash
# Platform-managed (default)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxx
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx

# BYOK mode — tenants pick per-channel
NOTIFICATIONS_BYOK=true
```

---

## Project structure

### Apps

| Package | Description |
|---------|-------------|
| `@witylogix/api` | Fastify 5 backend — REST API, WebSocket server, BullMQ workers |
| `@witylogix/dashboard` | Next.js 15 merchant dashboard — 64 routes, dark theme, real-time updates |
| `@witylogix/shopify-app` | Embedded Shopify admin app — React Router v7, Polaris Web Components |
| `@witylogix/driver-app` | React Native driver app — GPS tracking, proof of delivery, route navigation |
| `@witylogix/tracking-page` | Customer tracking page — Leaflet map, Socket.io real-time updates |

### Extensions

| Package | Description |
|---------|-------------|
| `@witylogix/checkout-ui` | Preact checkout extension — delivery date/time slot picker (< 64KB) |
| `@witylogix/pos-ui` | POS UI extension — in-store delivery scheduling |

### Shared packages

| Package | Strategy | Description |
|---------|----------|-------------|
| `@witylogix/db` | Compiled | Prisma client, RLS tenant extension, migrations |
| `@witylogix/core` | Compiled | 60 modules — routing, messaging, RBAC, campaigns, audit, encryption, logging, billing, process-manager, saved-views, widgets, collections, support, event-bus, webhooks, workflow-integration, realtime, file-storage, push |
| `@witylogix/extension-core` | Compiled | Shared Preact extension utilities — theme bridge, App Bridge wrapper, POS RPC, hooks |
| `@witylogix/framework` | Compiled | Workflow engine — DI container, step runner, compensation engine, workflow registry, BullMQ queue/worker/scheduler/DLQ |
| `@witylogix/workflows` | Compiled | 3 core delivery workflows (30 steps) + 12 reusable step definitions |
| `@witylogix/types` | JIT | Shared TypeScript types (apps transpile directly) |
| `@witylogix/validators` | JIT | Zod schemas for API validation |
| `@witylogix/carrier-service` | Compiled | Carrier rate calculation abstraction |

---

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

### Development workflow

```bash
# Create a feature branch
git checkout -b feature/my-feature

# Make changes, then run checks
pnpm lint
pnpm typecheck
pnpm test

# Commit using Conventional Commits
git commit -m "feat(api): add batch order assignment endpoint"
```

### Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests
- `chore:` — build process or tooling changes

### Architecture decisions

Significant technical decisions are documented as Architecture Decision Records (ADRs) in [`docs/adr/`](docs/adr/). Please create an ADR for any change that affects the system's architecture.

### Developer Certificate of Origin

By contributing, you agree that your contributions are licensed under the AGPL-3.0 license. We use the [DCO](https://developercertificate.org) sign-off process — add `Signed-off-by: Your Name <your@email.com>` to your commit messages.

---

## Roadmap

- [x] Turborepo monorepo structure
- [x] PostgreSQL schema with PostGIS + RLS (30 Prisma modules)
- [x] Routing provider abstraction (Mapbox, OSRM, Google, HERE, GraphHopper, TomTom)
- [x] Multi-shop organization support with dual-mode RLS
- [x] Fastify API with full CRUD endpoints (51 route files, 39+ registered prefixes)
- [x] JWT authentication with refresh token rotation and password reset
- [x] Role-based access control — hierarchical RBAC with policy engine + permissions API
- [x] Audit trail — batch logging, diff computation, sensitive field masking, CSV export
- [x] BullMQ notification workers — multi-provider, BYOK-aware (email, SMS, WhatsApp, push)
- [x] Unified messaging — multi-channel dispatcher with provider abstraction
- [x] Campaign engine — audience builder, scheduler, executor with state machine
- [x] Structured logging — Pino-compatible with request tracing + correlation IDs
- [x] Field-level encryption — AES-256-GCM with key rotation + Prisma middleware
- [x] Carrier Service API (< 500ms p95)
- [x] Shopify webhook ingestion (orders, app lifecycle, GDPR)
- [x] Organization management (create, link shops, manage members, cross-shop stats)
- [x] Integration Marketplace — 38 integrations across 6 categories
- [x] React Router v7 Shopify embedded app (38 routes)
- [x] Next.js 15 merchant dashboard (64 routes, dark theme)
- [x] Socket.io real-time tracking + driver location streaming
- [x] React Native driver app with background GPS
- [x] Customer tracking page with Leaflet map
- [x] Payment processing — gateway abstraction + billing system
- [x] Analytics engine — event tracking, aggregation, dashboards
- [x] Route optimization — nearest-neighbor, 2-opt, Clarke-Wright + ETA calc
- [x] Billing & subscriptions — plans, trials, proration, quota enforcement, invoicing
- [x] Process manager — multi-worker orchestration with 4 specialized workers
- [x] Saved views engine & dashboard widgets — customizable views, 8 widget types
- [x] Collections — manual/auto product collections with Shopify sync
- [x] Support tickets & feature requests — full lifecycle with threaded messages
- [x] Auth provider abstraction — BYOK auth (Auth0, Clerk, Cognito, Firebase, OIDC, SAML)
- [x] POS integration — multi-provider checkout, custom forms, 3 delivery modes
- [x] Platform admin panel — user/store/customer management, impersonation
- [x] API hardening — rate limiting, error standardization, OpenAPI spec, XSS protection
- [x] Docker production stack — multi-stage builds, compose, nginx, health checks
- [x] 57 test suites across core modules
- [x] Event bus — TypedEventBus with Redis Streams + InMemory adapters, 18 domain events
- [x] Outbound webhooks — HMAC-SHA256, retry, circuit breaker, 10 API endpoints
- [x] Workflow-API integration — auto-trigger from existing endpoints
- [x] Real-time workflow events — Socket.io + SSE fallback
- [x] shadcn/ui-inspired design system — Tailwind CSS migration, 16 components, design tokens
- [x] Shopify webhook management UI — event picker, delivery logs, detail pages
- [x] Extension core package — theme bridge, App Bridge wrapper, Preact hooks
- [x] Checkout UI extension scaffold — Preact delivery date/time slot picker
- [x] File storage — S3 + local providers with BYOK
- [x] Push notifications — FCM + Expo with BYOK
- [x] Event-webhook bridge — connects event bus to outbound webhooks
- [x] Queue consumer DB integration — product, order, driver, scheduler wired with Prisma
- [x] 20 dashboard pages migrated to Tailwind CSS
- [x] Notification providers — real HTTP implementations (SendGrid, Twilio, WhatsApp/Meta Cloud, Firebase Push)
- [x] Carrier adapters — real HTTP APIs (FedEx REST v1, UPS REST)
- [x] Notification orchestrator — template rendering, provider routing, retry, delivery logging
- [x] POS UI extension — Preact order lookup + delivery assignment for Shopify POS
- [x] 44 dashboard pages migrated to Tailwind CSS (Sprint 3.1 + 3.2)
- [x] 81 test suites across core modules
- [x] DHL carrier adapter — real DHL Express API (rates, ship/label, tracking, pickup)
- [x] OSRM Phase 2 routing — real HTTP API (route, distance matrix, TSP, snap-to-road)
- [x] Auth OAuth2 code exchange — Google, Microsoft, Okta, Auth0, OIDC, SAML
- [x] Notification worker → orchestrator delegation (replaced 24 inline stubs)
- [x] BullMQ job wiring — order/shipment/driver notification enqueueing
- [x] 61 dashboard pages migrated to Tailwind CSS
- [x] 85+ test suites across core modules
- [x] Platform source abstraction — `externalOrderId` + `source` enum (SHOPIFY, WOOCOMMERCE, MAGENTO, CUSTOM)
- [x] ADR-014 — Platform source abstraction decision record
- [x] Platform types package — `PlatformSource` enum, `ExternalReference`, helpers
- [x] Collection platform adapter — `CollectionPlatformAdapter` interface + Shopify GraphQL adapter
- [x] Fleetbase competitive analysis — 840-line strategic brief
- [x] 77 dashboard pages migrated to Tailwind CSS
- [x] 89+ test suites across core modules
- [x] ADR-015 — WooCommerce integration architecture decision record
- [x] Platform adapter system — `PlatformAdapter` interface, registry, factory
- [x] WooCommerce adapter — REST API v3 (orders, products, customers, webhook validation)
- [x] Shopify adapter — REST Admin API + HMAC validation (implements PlatformAdapter)
- [x] WooCommerce webhook consumer + Fastify route (order/product lifecycle)
- [x] Platform abstraction Phase 2 — workflow-integration, inventory, migration transformers
- [x] TODO stub cleanup — campaign dispatcher, event-bus DLQ, route optimization queue, integration worker
- [x] 88 dashboard pages migrated to Tailwind CSS (11 more pages)
- [x] 93+ test suites across core modules
- [x] ADR-016 — Magento 2 integration architecture decision record
- [x] Magento 2 adapter — REST API v1, Bearer token auth, HMAC webhooks (implements PlatformAdapter)
- [x] Custom platform adapter — configurable field mapping, multi-auth (API key, HMAC, Bearer)
- [x] Magento + Custom webhook consumers + Fastify routes
- [x] Platform abstraction Phase 3 — final Shopify refs cleaned (payments, product-webhook variants)
- [x] All TODO stubs resolved (0 remaining across entire codebase)
- [x] API route integration tests — orders, drivers, routes, webhooks (213 test cases)
- [x] Platform adapter unit tests — Shopify, WooCommerce, Magento, registry (197 test cases)
- [x] Dashboard auth actions — real login/register/forgot-password with API client (ADR-017)
- [x] Core module test coverage — tracking, labels, monitoring, drivers, orders, routes, zones, shipping-profiles, integrations, events, push, shops, migration, E2E platform flow (14 suites, 900+ cases)
- [x] Shopify app TODO fixes — user ID mapping, shop config pickup, order DB fetch
- [x] 118 dashboard pages migrated to Tailwind CSS (15 more pages)
- [x] 180+ test suites across core, API routes, integration, components
- [x] CONTRIBUTING.md open-source contribution guide
- [x] Docker Compose + Dockerfile for local development
- [x] 23 UI components (Button, Card, Badge, Input, Select, Modal, Table, Tabs, Toast, StatCard, EmptyState, DropdownMenu, Skeleton, Tooltip, DatePicker, Pagination, Breadcrumb, Avatar, Switch, Checkbox, Alert, Progress, ErrorBoundary)
- [x] LICENSE (AGPL-3.0) + CI/CD Docker build step
- [ ] MongoDB → PostgreSQL data migration tooling
- [ ] "Built for Shopify" certification
- [x] WooCommerce integration plugin (Phase 1 — adapter + webhooks)
- [x] Magento integration (Phase 1 — adapter + webhooks)

---

## Documentation

Core documentation for developers and operators:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Comprehensive system design (400+ lines)
  - System overview & ASCII architecture diagram
  - Data flow diagrams (order lifecycle, delivery assignment, auth, webhooks)
  - Module dependency map with 38+ core modules
  - PostgreSQL + PostGIS + RLS database architecture
  - TypedEventBus (Redis Streams) event system with 18 domain events
  - Multi-tenancy architecture (4 isolation layers)
  - Integration architecture (registry → adapter → provider pattern)
  - Caching strategy (3-layer: LRU → Redis → database)
  - Security architecture (auth stack, encryption, audit)
  - Performance characteristics (latency targets, throughput, scaling)

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Production deployment guide (300+ lines)
  - Docker Compose single-server deployment step-by-step
  - Kubernetes + Helm enterprise deployment
  - Complete environment configuration reference (40+ env vars)
  - PostgreSQL setup with PostGIS & RLS
  - SSL/TLS setup (Caddy, Nginx, Let's Encrypt)
  - Prometheus & Grafana observability setup
  - Horizontal scaling guide (API, database, Redis, workers)
  - Backup & disaster recovery with RTO/RPO
  - Health check endpoints
  - Troubleshooting common issues

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Development contribution guide
  - Local development setup
  - Code style & conventions
  - Testing requirements
  - Pull request process

- **[apps/docs](./apps/docs)** — Full developer documentation
  - 30+ MDX pages with OpenAPI 3.0 spec
  - Platform adapter guides (Shopify, WooCommerce, Magento)
  - Self-hosting & deployment guides
  - ADR (Architecture Decision Records) browser

---

## Development progress

Witylogix is being built sprint-by-sprint by a 10-person team. Each sprint delivers working, build-verified code across all 7 apps.

| Sprint | Theme | Key Deliverables |
|--------|-------|-----------------|
| 1.1 | Foundation | Prisma schema, auth system, core API routes, dashboard shell |
| 1.2 | Core CRUD | Orders, drivers, zones, time-slots, Shopify webhooks |
| 2.0 | Multi-tenant | Organizations, multi-shop RLS, role-based access |
| 2.1 | Routing | Multi-provider routing registry, BYOK mode, metering |
| 2.3 | Notifications | Multi-channel notifications, BYOK, integration marketplace |
| 2.4 | Real-time | Socket.io, driver app, tracking page, file storage |
| 2.5 | Shipping | Route optimization, shipping profiles, payments, analytics |
| 2.6 | Campaigns & Admin | RBAC engine, audit trail, messaging, campaigns, logging, encryption |
| 2.7 | Billing & Polish | Billing system, process manager, saved views, widgets, collections, support |
| 2.8 | Auth & Production | Auth providers (BYOK), POS integration, admin panel, API hardening, Docker deploy |
| 2.9 | Workflow Engine | Medusa v2-inspired workflow framework, 3 core delivery workflows, BullMQ durable execution, dashboard workflow viewer |
| 3.0 | Events & Design System | TypedEventBus (Redis Streams), outbound webhooks, workflow-API integration, Socket.io realtime, shadcn/ui-inspired Tailwind migration, Shopify webhook UI |
| 3.1 | Pages, Consumers & Extensions | 20 dashboard pages → Tailwind, queue consumer DB integration, event-webhook bridge, file storage, push notifications, extension-core package, checkout-ui extension |
| 3.2 | Providers, Carriers & POS | Notification providers (SendGrid, Twilio, WhatsApp, Firebase Push) → real HTTP, carrier adapters (FedEx, UPS) → real API, notification orchestrator, POS UI extension, 24 more pages → Tailwind |
| 3.3 | Workers, Auth & Routing | Notification worker → orchestrator, DHL adapter, OSRM Phase 2, Auth OAuth2 (6 providers), BullMQ job wiring, Shopify webhooks, 17 more pages → Tailwind |
| 3.4 | Platform Abstraction & Competitive Intel | Platform source abstraction (ADR-014), `externalOrderId` + `source` enum, collection platform adapter, Shopify GraphQL adapter, Fleetbase competitive analysis, analytics DI, billing routes, 16 more pages → Tailwind |
| 3.5 | WooCommerce, TODO Cleanup & Tailwind | ADR-015 WooCommerce integration, platform adapter system (Shopify + WooCommerce), webhook consumer, TODO cleanup (10→2), platform abstraction Phase 2, 11 more pages → Tailwind |
| 3.6 | Magento, Custom Adapter, Tests & Tailwind Finish | ADR-016 Magento integration, Magento + Custom platform adapters, API route tests (213 cases), platform adapter tests (197 cases), 0 TODOs remaining, 15 more pages → Tailwind |
| 3.7 | Auth Actions, Core Tests & Deep Tailwind | ADR-017 dashboard auth actions, real auth implementation, 14 core module test suites (900+ cases), Shopify app TODO fixes, 15 more pages → Tailwind |
| 3.8 | Security, Error Boundaries, Route Tests & Tailwind Final | ADR-018 error handling, .gitleaks.toml, security key fix, 15 API route test suites (771 cases), Next.js error boundaries + loading states, 14 more pages → Tailwind |
| 3.9 | Route Tests Deep, Docker, CONTRIBUTING & UI Components | CONTRIBUTING.md, Docker Compose + Dockerfile, 25 API route test suites (1,274 cases), DatePicker + Pagination components, 12 more pages → Tailwind |
| 4.0 | Full Coverage, CI Harden, UI Polish & Integration Tests | ADR-019 CI/CD pipeline, LICENSE (AGPL-3.0), CI Docker build step, 4 final route tests (211 cases), 4 integration test suites (87 cases), 4 Shopify app test suites (237 cases), 4 webhook E2E suites (133 cases), 9 component unit tests, 6 new UI components, Tailwind final push |
| 4.1 | Documentation Engine, TypeScript SDK & OpenAPI | ADR-020 documentation engine, Fumadocs app (`apps/docs`) with 30+ MDX pages, OpenAPI 3.0 spec, AI-powered search (Claude API), TypeScript SDK (`packages/sdk`) with zero-dep HTTP client, component gallery, platform adapter guides, self-hosting docs, ADR browser |
| 4.2 | DX Polish, SDK Tests, Seed Data & Driver App | ADR-021 DX & monorepo bootability, turbo.json tuning, workspace validator, database seed (3 orgs, 50 orders, 20 drivers), env validator, SDK test suite (7 files, 141 cases), SDK publish config (tsup), driver app screens (4 enhanced), tracking page polish, settings page (5 tabs), notification prefs, realtime activity feed, webhook delivery dashboard, integration health page, 5 new UI components, smoke test + docs validator scripts, CI updates |
| 4.3 | CLI Deployment Tool & AI Engineer | ADR-022 CLI architecture, `witylogix` CLI entrypoint (15 subcommands), install/deploy/upgrade/backup/restore/ssl/env/status/doctor/logs/scale/destroy/dev/init commands, AI diagnostics (Claude-powered `ai diagnose` + `ai optimize`), Caddy reverse proxy templates, production Docker Compose, Dockerfile.docs, CLI test harness, shared lib, env template |
| 4.4 | E2E Testing, Event Bus, Platform Admin & Gap Closure | ADR-023 E2E testing & event bus, Playwright E2E framework (14 files, 5 spec suites, page objects), Event Bus v2 with Redis Streams (pub/sub, consumer groups, dead letter, event store), Auth provider registry (session manager, token service, provider base), Workflow triggers (auto-fire from API, Socket.io events, Shopify bridge), AI monitoring (anomaly detector, ETA predictor, alert engine), Activity log redesign (timeline, filters), Design tokens page + component gallery, Event log viewer page, 4 Prisma models (AuthProvider, AuthSession, PlatformAdmin, PosConfig), package maturity (tsup + exports for framework/types/validators/workflows), Shopify workflow bridge API |
| 4.5 | Customer Experience & Checkout Enhancement | ADR-024 dispatch dashboard, Competitive Intelligence Report (6 competitors, 48 features), Route Timeline Dispatcher Dashboard (real-time map, route timeline, driver cards, stop detail), Embeddable Checkout Widget (`packages/checkout-widget/`, 5-step flow), Customer Self-Service Portal (`apps/customer-portal/`, Next.js), Slot Engine API (atomic reservation, capacity, zone rates, deadlines, blackouts), POD v2 (photo + signature + QR + barcode + delivery timeline), Notification Engine v2 (email + SMS + WhatsApp + push, 7 templates, preferences, webhooks), 13 new UI components, 73 E2E tests (5 spec suites), Shopify checkout extension, Google Maps + Calendar integration, AI Slot Recommender (demand prediction, 5-factor scoring), ML ETA Engine (4 models + weighted ensemble), 2 Prisma schemas (delivery-slots, pod-timeline) |
| 4.6 | Integrations, Analytics & Platform Maturity | ADR-025 route analytics, Route Analytics Dashboard (planned-vs-actual, driver leaderboard, efficiency heatmap, CO2 tracker, SLA compliance), Customer Portal v2 (real-time WebSocket tracking, live map, ETA countdown, delivery timeline, bottom sheet, delivery history), Google Maps Native Components (address autocomplete, zone editor, route viewer, heatmap, place search), WooCommerce REST API Adapter (OAuth 1.0a, order/product/customer sync, webhooks), Notification Preferences UI + WhatsApp Templates (per-channel config, template editor, notification log), Pure SVG Analytics Charts (14 zero-dep components — line, bar, donut, heatmap, sparkline, KPI, data table), Invoice Engine Foundation (cost calculator, PDF generation, atomic numbering, rate cards), WooCommerce Checkout Block + Platform Bridge (multi-platform normalizer), Route Analytics ML (efficiency scoring, driver scorer, delivery predictor, anomaly detector, CO2 calculator), 182+ integration/unit tests, 2 Prisma schemas (invoices, woocommerce) |
| 4.7 | Telematics, Traffic-Aware ETA & Integration Ecosystem | ADR-026 telematics gateway, Fleet Dashboard (vehicle overview, health gauge, fuel summary, alerts, vehicle list/detail), Fleet Map Components (vehicle tracker map, fuel gauge SVG, diagnostic alerts, driver behavior chart, idle time chart, fleet stats cards), Telematics Adapter Layer (Samsara REST API + Geotab MyGeotab JSONRPC, normalizer, poller with circuit breaker), Courier Partner Directory UI (directory page, partner detail, 3-step onboarding wizard, courier comparison view), Courier Partner Adapters (Onfleet + Stuart + Uber Direct clients, normalizer, multi-courier dispatcher), Invoice Completion (billing rules engine, invoice email with HTML templates, payment reminders), QuickBooks/Xero Accounting Integration (OAuth2 adapters, accounting sync service, settings page), Traffic-Aware ETA v2 (Google Directions + TomTom Traffic clients, traffic normalizer/provider, ETA pipeline), ML ETA Engine v2 (5 models: time-of-day, distance-decay, historical, traffic, weather + ensemble with dynamic weighting, performance tracker), Fleet + Partner UI Components (vehicle status card, fuel consumption chart, maintenance schedule, speed history, fleet health gauge, courier cards, rate comparison, SLA indicator), 250+ integration/unit tests, 2 Prisma schemas (fleet, couriers) |
| 4.8 | Invoicing Completion, Courier Ecosystem & AI Demand Prediction | Invoice PDF generation, payment gateway (Stripe), courier webhooks (Onfleet/Stuart/Uber), partner rating engine, smart multi-courier routing, cost optimizer, SLA enforcer, dispatch console, AI demand prediction pipeline (feature store, data aggregator, time-series extractor, zone profiler, holiday calendar), demand ML models (seasonal decomposition, zone regression, pattern matcher, anomaly detector), demand ensemble predictor, smart scheduler, platform health dashboard | 87 | ~37,900 |
| 4.9 | Demand Completion, Platform Adapters & Deployment | Real-time demand dashboard, auto-rebalancer, capacity alerts with escalation, model retraining pipeline with A/B testing, Magento 2 + BigCommerce V3 e-commerce adapters, PayPal Orders V2 + Square payment adapters, multi-gateway payment router, Salesforce + HubSpot CRM adapters with bidirectional sync, ShipStation + EasyPost multi-carrier shipping adapters, carrier rate comparison engine, demand visualization components (zone heatmap, forecast chart, capacity bar, schedule grid), admin console (system health, integrations, error logs, activity feed, API docs), Docker production config, OpenAPI v3.1 spec generator, Prometheus health checks, E2E test suite (5 specs), k6 load tests (2 scenarios), ADR-028 | 100+ | ~51,500 |
| 5.0 | Mega Integration Sprint I — Routing, Telematics, Messaging, Email, ERP | Routing adapters (Valhalla, VROOM, Routific, OptimoRoute, HERE Routing, Route4Me) with routing engine + maps (HERE Maps), messaging adapters (Vonage, TextMagic, OneSignal, Sendbird) with messaging router, email adapters (Mailgun, Amazon SES, Gmail, Outlook) with email routing engine, ERP adapters (SAP, NetSuite, Dynamics 365, Sage) with sync engine + Prisma schema, telematics adapters (Flespi, Verizon Connect, Trimble, Fleetio) with aggregator + stream, 7 integration dashboard pages (routing, telematics, messaging, ERP, e-commerce, email, overview hub), 10 integration UI components (provider card, credential form, webhook config, health monitor, rate limit display, sync status, connection wizard, API usage chart, provider comparison), integration test suites (185+ tests), E2E integration lifecycle tests | 95 | ~38,000 |
| 5.1 | Mega Integration Sprint II — Collaboration, E-Signatures, CRM, Payments, POS, ELD, Last-Mile, Shipping | Collaboration adapters (Slack, Teams, Pusher, Track-POD, DispatchTrack, Podium, WorkWave) with collaboration hub, e-signature adapters (DocuSign, Adobe Sign, PandaDoc, HelloSign) with envelope engine, CRM adapters (Zoho, Dynamics CRM, Pipedrive) with sync engine v2, payment adapters (Braintree, Authorize.Net, Adyen), POS adapters (Toast, Square for Restaurants), ELD adapters (Motive, Omnitracs, Azuga) with compliance engine, last-mile adapters (DoorDash Drive, Uber Eats, Grubhub) with delivery aggregator, Shippo shipping adapter, 8 integration dashboard pages, 9 new UI components, integration test suites (200+ tests), E2E lifecycle tests II | 100+ | ~53,000 |
| 5.2 | Final Integration Sprint — Analytics, Supply Chain, Healthcare, Freight, Fuel-Fleet, Field-Service, E-Commerce, Telematics, ERP | Analytics adapters (Tableau, Power BI, Looker, Qlik, Google Analytics) with analytics aggregator, supply chain adapters (Manhattan, Blue Yonder, Körber, Deposco, Extensiv, Fishbowl) with orchestrator, healthcare adapters (Cerner, Allscripts, Epic, HL7 FHIR) with normalizer (HIPAA), freight adapters (DAT, Truckstop, 123Loadboard, Direct Freight) with board aggregator, fuel-fleet adapters (WEX, Comdata, Fuelman, EFS) with fuel card manager, field-service adapters (ServiceTitan, Jobber, Housecall Pro, FieldEdge) with dispatcher, e-commerce ext (Amazon SP, eBay, Etsy, Square Online), telematics ext (Powerfleet, Azuga, Omnitracs, Platform Science, ClearPathGPS, One Step GPS, Titan GPS), ERP ext (Infor, Epicor, Sage Intacct, FreshBooks, Wave), Solid Protocol e-signatures, 8 dashboard pages, 10 UI components, integration test suites (235+ tests), E2E lifecycle tests III | 100+ | ~58,000 |
| 6.0 | Onboarding & Auth Hardening | Full Fleetbase-style onboarding wizard (email verify, deployment chooser, company info, industry select, goals picker, 124-provider integration chips, dashboard layout chooser, data import, review summary), auth architecture (Argon2id passwords, JWT access/refresh tokens, MFA TOTP/SMS/Email, backup codes, session manager, RBAC engine with role hierarchy), auth flows (password reset, magic link, Google/Microsoft SSO, CSRF protection), rate limiting (sliding window per-IP/user/endpoint), multi-tenant middleware (subdomain/header/JWT/API-key resolution, LRU cache), API key management (generate/rotate/revoke with SHA-256), usage metering (async batch recording, daily aggregation, plan quotas), workspace provisioning, team invitations, integration onboarding (OAuth flow manager with PKCE, credential validator, health checker, quick-setup templates, batch manager), AI-powered smart defaults (industry profiles, goal-feature mapper, recommendations engine, completion predictor, A/B testing, onboarding analytics), 9 onboarding UI components, overhauled login/register/forgot-password pages + new reset-password and magic-link pages, 3 Prisma schemas, 300+ tests | 100+ | ~40,000 |
| 6.1 | Database & API Production Hardening | Database production config (PgBouncer connection pool tuning, read replica router with lag detection + failover, zero-downtime migration manager, backup service with PITR + retention), API hardening (per-tenant sliding window rate limiter with plan tiers, Zod request validator with common schemas, HMAC-signed cursor pagination, API versioning with deprecation headers, structured request logger with field sanitization, standard response formatter with HATEOAS), security hardening OWASP (CSP nonce generation, CORS whitelist with subdomain wildcards, XSS/SQL injection detection + input sanitization, security headers middleware, request fingerprinting with anomaly scoring, immutable audit logger with hash chain, secret scanner for leaked credentials), form validation library (useForm hook with Zod, useFieldArray, 7 form components — input/select/textarea/checkbox/radio/file-upload/field wrapper, 14+ validation schemas), error pages & loading states (404/500/offline pages, skeleton loaders, toast system, error boundary, loading spinner variants, empty state), responsive audit (breakpoint hooks, touch gesture hooks, responsive nav/sidebar/header/table/grid, responsive CSS utilities), logging & monitoring (structured JSON logger, Sentry integration, Prometheus metrics collector, health endpoints, distributed tracing W3C, alert rules engine), webhook reliability (dispatcher with HMAC signing, exponential backoff retry with circuit breaker, dead letter queue, signature verifier with replay prevention, idempotency manager, delivery log, webhook registry with fan-out), query optimization (N+1 detector, EXPLAIN ANALYZE query analyzer, index advisor, slow query logger with trend detection, LRU query cache with stale-while-revalidate, DataLoader-style batch loader, connection pool monitor with leak detection), test coverage expansion (ERP/telematics/CRM/collaboration adapter tests, API + database load testing utilities, test factories + integration test helpers) | 123 | ~37,500 |
| 6.2 | CI/CD, Deployment & Documentation | CI/CD pipeline (GitHub Actions: lint/typecheck/test/build/security matrix Node 20+22, PR previews, Docker multi-arch build + GHCR push, Trivy scanning, SBOM generation, automated releases from tags, Dependabot weekly updates, branch protection rules, CODEOWNERS, blue-green deploy script), Storybook 8 (13 component story files — Button/Badge/Card/Input/Select/Modal/Table/Toast/Skeleton/Forms/Navigation/EmptyState/LoadingSpinner, dark theme, a11y addon, interaction tests), i18n framework (next-intl setup, 3 locales en/es/fr with 450+ keys each, locale routing middleware, language switcher component, formatting utilities — currency/date/number/distance/weight/duration, RTL preparation, translation key extraction script), API documentation (OpenAPI 3.1 spec with 61+ endpoints, API changelog, auth/rate-limiting/webhooks/errors docs, Postman collection with 35 requests, SDK type regeneration), Docker production hardening (multi-stage Dockerfiles for API/dashboard/worker, production compose with resource limits + 3-tier network isolation, Nginx reverse proxy with TLS/gzip/rate-limiting/security-headers, container entrypoint with dependency waiting + signal handling, Trivy + OPA container policies), accessibility audit (focus manager + keyboard navigation + screen reader announcer + ARIA helpers + color contrast checker + reduced motion, skip links + visually hidden + focus indicator components, axe-core test utilities, WCAG 2.1 AA guide), database migrations (4 SQL migrations for auth/onboarding/tenant/webhook tables with RLS + indexes, comprehensive seed data — 3 orgs + 15 users + 50 orders + 20 drivers, minimal seed for dev, migration integrity tests, rollback + backup-restore scripts), k6 performance testing (5 load test scenarios — auth/onboarding/CRUD/webhook/tenant-isolation, data generators, SLA thresholds, HTML report generator, baselines), environment config (Zod env validator with 30+ vars, config service with hot reload, secrets manager — 4 providers, 8 feature flags with tenant overrides + percentage rollout, deployment checklist, secrets rotation guide), observability (5 Grafana dashboards — API/DB/auth/webhook/business, Prometheus alert rules — API/infra/business, SLO/SLI definitions, 4 runbooks — incident response/scaling/backup-recovery/on-call) | 140+ | ~45,000 |

| 7.0 | Docs, Polish & Onboarding Wiring | ARCHITECTURE.md (system design, data flows, module dependency map, DB architecture, event system, multi-tenancy, integration pattern, caching, security, performance), DEPLOYMENT.md (Docker + K8s, env config, DB setup, SSL/TLS, monitoring, scaling, backups, troubleshooting), README refresh (punchier intro, documentation section, sprint 7.0), onboarding wizard fully wired (removed all "Coming soon" placeholders, connected integrations/dashboard-layout/data-import/review steps with state management + URL sync + transitions), dashboard home page (welcome banner, quick stats, activity feed, getting started checklist, quick actions, schedule), polished sidebar navigation (6 collapsible groups, active states, notification badges, Cmd+B toggle, user avatar), breadcrumb + page header components, API route map (187 routes documented, 83% validated), 25+ Zod validation schemas, 75+ error codes catalog, API health dashboard, E2E smoke tests (critical path + auth + onboarding + health, page objects), interactive design system catalog (11 sections, live previews, code snippets, token reference, form showcase), database schema docs (55 models, 7 ER diagrams, migration guide, data dictionary), test infrastructure (coverage aggregator, badge generator, flaky test detector, vitest workspace, TEST_GUIDE.md, test dashboard), integration catalog page (124 providers grid with search/filter/sort) + setup guides (routing/telematics/ERP/CRM/messaging) + troubleshooting, developer docs (CONTRIBUTING.md, SETUP.md, CODE_STYLE.md, FAQ.md, ADR index, PR + issue templates) | 100+ | ~30,000 |

| 7.1 | Real-Time Dashboard, Search & Final Hardening | Real-time WebSocket infrastructure (Socket.io hub with Redis adapter, 11 event types, room management org/shop/driver, JWT auth, event buffer + replay, connection manager with plan limits, event broadcaster fan-out), live dashboard widgets (order feed, delivery map with driver pins, animated KPI counters with sparklines, notification center with bell/toast/sound), settings pages (profile/MFA, organization/billing, notification matrix, API key management, team invite/roles, preferences), Redis-backed rate limiter (sliding window, plan tiers, burst, graceful fallback), circuit breaker (3-state per-provider), request priority queue, search infrastructure (tsvector + pg_trgm, Cmd+K command palette, filter builder 12 operators, saved searches), enhanced data table (sort/resize/toggle/select/bulk/inline-edit/virtual-scroll/export), background jobs (BullMQ dashboard, 8 scheduled jobs, priority escalation, DLQ, Prometheus metrics, admin page), regression tests (critical paths + auth + API + visual regression, nightly CI 4-shard), webhook debug tools (live stream + test sender + sandbox + signature tester), AI search (semantic pgvector + BM25 hybrid, smart suggestions, NL filter parsing, ML ranking with A/B) | 100+ | ~35,000 |

| 8.0 | Integration Infrastructure & P0 Core | Unified credential vault (AES-256-GCM encryption, per-tenant isolation, key rotation, audit logging), OAuth2 token manager (auto-refresh, PKCE, code exchange, revocation, exponential backoff), webhook signature verification framework (HMAC-SHA256, timestamp validation, replay protection, Stripe/Shopify/EasyPost strategies), integration gateway (unified HTTP client, per-provider rate limiting, circuit breaker, retry, correlation IDs, metrics), Stripe SDK client (payment intents, subscriptions, invoices, checkout, refunds, webhook verification), PayPal SDK client (OAuth2 flow, orders, captures, subscriptions, payouts), payment event normalizer, Shopify Admin API SDK (orders, products, inventory, fulfillment, webhooks, HMAC, cursor pagination), WooCommerce SDK (orders, products, customers, shipping, batch ops, webhooks), order sync engine (bi-directional, conflict resolution, delta sync, dead letter), SendGrid SDK (transactional email, templates, contacts, suppression, webhook verification), Twilio SDK (SMS/MMS, WhatsApp, Verify API, request validation), WhatsApp Business client (template/text/media/interactive messages, webhook verification), integration marketplace UI (catalog grid, category filters, search, sort, connect dialog, detail page), per-tenant integration dashboard (connected status, usage meters, logs, health checks, sync controls), integration UI components (card, OAuth redirect handler, connection badge, credential form, logo, webhook viewer), integration test harness (mock server, auth simulators, webhook simulator, fixtures, test runner), AI smart integration recommender (industry-based, workflow-aware, dependency graph, setup wizard, A/B testing) | 76 | ~31,225 |

| 8.1 | Routing, Maps & Real-Time Tracking | Routing orchestrator (multi-provider failover, health-weighted selection, automatic degradation), geocoding service (multi-provider, caching, fuzzy matching), route cache (TTL-based, LRU eviction), routing benchmark suite, Google Routes API v2 SDK, Mapbox Directions API SDK, HERE Routing API v8 SDK, TomTom Routing API v1 SDK, unified routing types + polyline encode/decode, provider comparison engine with scoring, Samsara telematics SDK (vehicles/drivers/locations/alerts), Geotab MyGeotab SDK, vehicle feed service (real-time WebSocket push), telematics normalizer v2 (Samsara + Geotab unified), geofence manager (CRUD + entry/exit detection), trip replay service, live Mapbox GL JS delivery map (driver markers, route polylines, clustering, driver popover, map controls, legend, delivery sidebar), route planning wizard (5-step: stops → constraints → optimize → review → dispatch), routes list view, stop list editor (drag-and-drop), route summary + cost breakdown, route optimizer controls, AI route optimizer (nearest-neighbor + 2-opt/3-opt), ETA predictor (traffic/weather/driver-history), delivery zone analyzer (clustering + workload balancing), smart driver assignment (skill/proximity/workload-aware), optimization API, map UI components (route timeline, driver info card, ETA countdown, status pill, distance badge, animated counter), 17 test files (unit + integration + E2E) | 69 | ~14,000 |

| 8.2 | Shipping & Last-Mile Carriers | Carrier rate engine (parallel rate fetch, cheapest/fastest/best-value ranking, per-tenant credentials, rate caching), shipping types (Package, ShipmentAddress, ShippingRate, ShipmentLabel, TrackingEvent, ShipmentStatus, CarrierCode), label generator (unified creation, format negotiation PDF/ZPL/PNG, batch generation, address verification), shipment tracker (multi-carrier normalization, ETA with confidence, webhook subscriptions), EasyPost SDK (addresses, parcels, shipments, rates, labels, tracking, insurance, batch 10K, customs, HMAC webhooks), ShipStation SDK (orders, shipments, carriers, warehouses, stores, products, webhooks, batch labels, 40 req/min), Shippo SDK (addresses, parcels, shipments, rates, transactions/labels, tracking, customs, manifests, carrier accounts), AfterShip SDK (trackings CRUD, 1000+ courier auto-detect, notifications, ETA, checkpoints), DHL Express SDK (OAuth2, rating with duty/tax, shipments, pickups, tracking, address validation, invoices), DoorDash Drive SDK (JWT auth, deliveries, quotes, tracking, webhooks), Uber Direct SDK (OAuth2, deliveries, quotes, POD, multi-drop, webhooks), shipping label wizard (4-step: package → carrier → rates → review), labels list with bulk actions, shipment tracking dashboard (search, filters, bulk tracking, CSV export), detailed tracking view (timeline, ETA countdown, POD, auto-refresh), tracking timeline + embed widget, shipping UI components (rate comparison card, carrier logo, package size selector, label preview, status stepper), AI delivery time predictor (carrier + distance + weather + holidays + day-of-week), smart carrier selector (multi-criteria scoring, reliability, cost/speed optimizers, green shipping, A/B testing), shipping analytics (cost analysis, performance, volume heatmaps, anomaly detection, forecasting), shipping AI API, 15+ test files | 50+ | ~20,000 |

| 8.3 | E-Commerce & Order Sync | Order sync engine v2 (SyncOrchestrator, 4 conflict strategies — LWW/external-wins/internal-wins/manual, IdempotencyManager with composite dedup keys, DeltaSyncTracker, RetryQueue with exponential backoff, DeadLetterQueue, BatchProcessor 500 orders, SyncMetrics), field mapper (15+ transformers — currency/date/status/address/JSON, custom JS, reverse mapping, preview), sync scheduler (cron intervals, priority queue webhook>scheduled>manual, max 3 concurrent, stale detection), sync API (11 endpoints), BigCommerce SDK (48 methods — OAuth2 single-click, orders/products/customers/inventory/webhooks/shipping/storefront, SHA256 HMAC, rate limit tracking), Magento 2 SDK (42 methods — OAuth1/Bearer, orders/products/MSI inventory/categories/cart, SearchCriteria builder, async bulk API), Etsy v3 SDK (OAuth2 PKCE, listings/receipts/shops/taxonomy, polling-based webhooks), eBay SDK (OAuth2, Browse/Buy/Sell APIs, multi-marketplace, webhook subscriptions), Square Online SDK (OAuth2, orders/catalog/inventory/customers, HMAC webhooks, idempotency keys), order import dashboard (8-platform selector, sync timeline, error log with retry, bulk import wizard, health indicators), conflict resolution page (side-by-side diff, resolve/bulk-resolve, filter by platform/field), product catalog sync UI (visual field mapping editor with SVG lines, auto-map, 6 transformer types, sync schedule config, preview), e-commerce UI components (unified order card, platform connection badge, sync progress bar, inventory level indicator, platform logo), cross-platform inventory sync engine (StockReconciler, MultiWarehouseManager, InventoryReservation 5-min TTL, LowStockMonitor, OverSellProtection, BulkStockUpdate, InventoryAuditLog, 18 API endpoints), AI intelligent order router (fulfillment scoring — proximity 35%/stock 25%/capacity 20%/cost 10%/SLA 10%, split order detection, routing explanation), AI demand forecaster (time series analysis, seasonal decomposition, trend detection, SKU clustering, reorder suggestions), 12+ test files (90+ cases) | 55+ | ~25,000 |

| 8.4 | CRM, ERP & Accounting | CRM sync engine v3 (FieldMappingDSL fluent builder — map().to().transform().when(), BidirectionalResolver 5 strategies — TIMESTAMP_WINS/SOURCE_OF_TRUTH/FIELD_PRIORITY/MERGE/MANUAL_REVIEW, ChangeDetector, SyncTransaction with rollback, CrmRepository abstraction, 15+ RESTful endpoints, webhook handler with dedup), Salesforce SDK (65+ methods — OAuth2, SOQL builder injection-safe, SObject CRUD, Composite API 25 subrequests, Bulk API 2.0, Streaming PushTopic, Metadata, HMAC webhooks, Sforce-Limit-Info tracking), HubSpot SDK (70+ methods — OAuth2, CRM Objects, Search API filter groups, Associations, Properties, Pipelines, Batch 100, SHA-256 webhooks), Zoho CRM SDK (OAuth2 6 domains, Leads/Contacts/Accounts/Deals, Bulk 100, COQL queries, webhooks, 24K req/day), Pipedrive SDK (OAuth2 + API token, Persons/Orgs/Deals/Activities, Search, Pipelines, HMAC webhooks, 80 req/2s), Dynamics 365 SDK (OAuth2 MSAL, OData v4 builder injection-safe, 7 entity types, ETag concurrency, $batch, multi-org, 6K req/5min), QuickBooks Online SDK (OAuth2 Intuit, invoices/payments/customers/items/bills/estimates/reports, PDF download, HMAC webhooks, 500 req/min), Xero SDK (OAuth2 PKCE, multi-tenant, invoices/contacts/payments/bank-tx/items/POs/quotes/reports, intent-to-receive webhooks, 60 req/min), accounting normalizer (unified types, currency conversion, tax normalization, status mapping), SAP S/4HANA OData SDK (OAuth2 + SAML, OData v4 query builder, BusinessPartner/SalesOrder/PO/Product/Delivery/Invoice, $batch, CSRF tokens), NetSuite TBA/REST SDK (OAuth1 HMAC-SHA256, SuiteQL parameterized, 7 record types, Saved Search, File Cabinet, RESTlets, 10 concurrent 4500 pts/day), ERP normalizer (UOM mapping, currency normalization), CRM connection wizard (5-step compound components, OAuth2 flows for 5 platforms, keyboard nav), CRM dashboard (health, activity feed, stats), financial dashboard (revenue cards, lazy charts, reconciliation), invoice list (virtualized, debounced search, bulk actions), payment reconciliation (two-column matcher, confidence scoring, auto-match), CRM/finance UI components (contact card, deal pipeline kanban, invoice line-item editor, payment matcher, revenue chart), AI customer LTV predictor (RFM features, 7 segments CHAMPION→LOST, cohort analysis, churn prediction), AI CRM intelligence (deal scoring, lead scoring A/B/C/D, activity recommender, relationship strength, sales forecaster), 16+ test files | 60+ | ~28,000 |

| 8.5 | Collaboration, Messaging & Notifications | Notification orchestrator v2 (ChannelRouter priority-based selection, FallbackChainExecutor automatic failover, QuietHoursManager timezone-aware, DigestBatcher configurable intervals, DeliveryTracker receipt confirmation, RetryManager with DLQ, ThrottleManager per-user rate limits, template engine with per-channel rendering and i18n, 12+ REST endpoints), Slack Web API SDK (OAuth2 V2, channels/messages/threads/reactions/users/files/search, Block Kit builder, HMAC-SHA256 webhooks, Tier 1-4 rate limiting), Microsoft Teams Graph API SDK (OAuth2 MSAL, teams/channels/messages/replies/reactions, Adaptive Card builder, subscriptions, proactive messaging), Firebase FCM SDK (service account JWT, send to token/topic/condition, multicast 500, APNS/Android config, topic management), OneSignal SDK (REST API key, segments/filters/player IDs, templates, outcomes tracking, A/B testing, scheduling), Vonage Messages API SDK (JWT + API key, SMS/MMS/WhatsApp/Viber/Facebook Messenger, Verify 2FA, number insight, HMAC webhooks, 1 req/sec), Pusher Channels SDK (HMAC-SHA256, public/private/presence/encrypted channels, batch trigger 10 events, webhooks, 10 msg/sec), WhatsApp Business Cloud API v2 SDK (OAuth2/System User, text/template/media/interactive messages, template management, media upload, webhook verification, read receipts), Mailgun SDK (API key, send text/HTML/template, batch 1000, MIME, domains/routes/events, HMAC webhooks, suppressions, mailing lists), AWS SES SDK (Signature V4, send email/templated/bulk, identities, configuration sets, DKIM/SPF, suppression list, receipt rules), Sendbird Chat SDK (API token, users/group channels/open channels/messages, moderation, metadata, push settings, webhooks), notification center UI (inbox with read/unread/priority/bulk actions, preference matrix per category, delivery audit log, template editor with variable insertion and channel preview), team collaboration panel (messaging hub, rich text composer with mentions/attachments/emoji, virtualized message list with threading/reactions, channel sidebar with categories/search), notification UI components (template editor, channel toggle matrix, delivery timeline, priority selector, toast stack), AI smart notification timer (UserBehaviorAnalyzer, OptimalTimePredictor per-user per-channel, BatchOptimizer, A/B test framework), AI notification fatigue detector (FatigueScoreCalculator, ChannelSaturationDetector, UserToleranceProfiler, ThrottleRecommender), 13+ test files | 52+ | ~22,000 |

| 8.6 | Freight, ELD & Compliance | Freight management engine v2 (LaneManager with pricing tiers/volume commitments, CarrierScorecard 5-factor weighted scoring, RateNegotiationTracker multi-round bidding, CapacityPlanner seasonal demand/surge detection, FreightAuditEngine invoice-vs-contract 3% tolerance/accessorial validation/Levenshtein duplicate detection/3-tier dispute escalation, AuditReporter savings metrics, FMCSA SAFER client DOT/MC lookup/safety ratings/inspections/crash data/insurance/authority/census with 24h cache, 17 REST endpoints), HOS rules engine v2 (US Property FMCSA Part 395 — 11h driving/14h window/30min break/70h-8d cycle/34h restart with 1-5am/sleeper berth 7-3 and 8-2 splits/short-haul 150mi/adverse +2h/16h exception, US Passenger 10h/15h/60-70h, Canadian Federal 13h/14h/70h-7d/24h mandatory, Mexico NOM-087-SCT 14h/24h rest, HOSCalculator pure functional, HOSViolationDetector real-time with FMCSA codes/falsified log heuristics/auto-resolution, DVIREngine 8 component groups/defect categorization/repair workflow/CVSA criteria), Samsara Fleet API SDK (Bearer auth, 25+ methods — drivers/HOS/vehicles/DVIR/safety/routes/assets/documents, cursor pagination, HMAC webhooks, 100 req/sec), KeepTruckin/Motive v2 SDK (OAuth2 + API key, 28+ methods — HOS/DVIR/IFTA/eRODS export, HMAC webhooks, 20 req/sec), FMCSA DataQs SDK (WebKey auth, SMS BASIC 7 scores, inspections/crashes/insurance/authority, DataQs challenges, 24h cache), Trimble/PeopleNet SDK (OAuth2+JWT, DQF, J1939 diagnostics, IFTA, eRODS, 60 req/min), Geotab Drive SDK (session auth, JSONRPC 2.0, GetFeed incremental sync, multi-call batch, 5000 credits/min), Omnitracs XRS v2 SDK (API key+OAuth2, dispatch, performance analytics, 300 req/min), Lytx DriveCam SDK (OAuth2, video telematics/event clips/risk scores/coaching/live camera, 120 req/min), DAT v2 SDK (OAuth2, RateView spot/contract/trends, Load Board, Carrier Search, Market Analytics, 1000 req/hr), Truckstop v2 SDK (API key+OAuth2, Load Posting, Rate Intelligence, QuickPay, RMIS, Book It Now, 500 req/hr), FreightWaves SONAR SDK (Bearer auth, OTVI/OTRI/TLI indices, batch queries 50 metrics, 135 markets, alerts), freight dashboard (overview KPIs, load board with 4-step wizard, rate comparison/RFP wizard, compliance FMCSA lookup), ELD dashboard (fleet HOS compliance, per-driver HOS clocks/daily log graph/8-day recap, DVIR forms with defect/repair workflow), freight UI components (rate comparison card with sparklines, lane heatmap, carrier scorecard radar chart, freight timeline), ELD UI components (HOS gauge with gradient, compliance badge, DVIR checklist 30+ items), AI freight matcher (5-dimension scoring — lane fit 30%/rate 25%/capacity 20%/reliability 15%/compliance 10%, load bundling, deadhead optimization, fallback cascade), AI rate forecaster (seasonal decomposition, supply/demand, regional factors, contract vs spot gap, budget projection, spike detection), AI compliance risk scorer (driver/carrier/fleet risk, fatigue heuristics, predictive violation alerts, audit readiness, CSA prediction), 20+ test files | 40+ | ~28,000 |

**Current stats (Sprint 8.6):** ~3,027 source files, ~1,106,000 lines of code, 186+ dashboard pages, 279+ API routes, 593+ test files, 50 Prisma schemas, 190+ core modules, 6 ELD providers (Samsara, KeepTruckin, Trimble, Geotab, Omnitracs, Lytx), 3 freight platforms (DAT, Truckstop, FreightWaves), 2 FMCSA APIs (SAFER, DataQs), 4 HOS jurisdictions (US Property, US Passenger, Canadian, Mexico), 20 AI modules, 125 integration providers across 21 categories (ALL production).

See [`witylogix-sprint-tracker.xlsx`](witylogix-sprint-tracker.xlsx) for detailed completion tracking across data models, feature pages, API services, and infrastructure.

---



## Integration Ecosystem — 124+ Providers

Witylogix ships a typed integration registry spanning **21 categories** and **124+ providers** with a pluggable adapter architecture. Production adapters are fully implemented and tested; planned adapters have typed schemas ready for community contribution.

| Category | Providers | Production | Examples |
|----------|-----------|------------|----------|
| **Routing & Optimization** | 8 | 3 | Valhalla, VROOM, Google Routes, Mapbox Directions, HERE, Route4Me, OptimoRoute, Routific |
| **Maps & Geocoding** | 5 | 4 | Google Maps, Mapbox, OpenStreetMap, HERE Maps, TomTom |
| **Telematics & Fleet GPS** | 13 | 2 | Samsara, Geotab, Flespi, Verizon Connect, Trimble, Powerfleet, Azuga, Omnitracs, Platform Science, Fleetio, ClearPathGPS, One Step GPS, Titan GPS |
| **SMS / WhatsApp / Push** | 7 | 3 | Twilio, WhatsApp Business, Firebase Cloud Messaging, Vonage, TextMagic, OneSignal, Sendbird |
| **Email** | 5 | 1 | SendGrid, Mailgun, Amazon SES, Outlook, Gmail |
| **Collaboration & Dispatch** | 7 | 0 | Pusher, Slack, Microsoft Teams, Track-POD, DispatchTrack, Podium, WorkWave |
| **Supply Chain & Warehouse** | 6 | 0 | Manhattan Associates, Blue Yonder, Körber, Deposco, Extensiv, Fishbowl |
| **E-Commerce** | 8 | 2 | Shopify, WooCommerce, Magento, BigCommerce, Amazon Seller Central, eBay, Etsy, Square Online |
| **Payments** | 6 | 1 | Stripe, Square, PayPal, Braintree, Authorize.Net, Adyen |
| **ERP & Accounting** | 11 | 2 | QuickBooks, Xero, SAP, Oracle NetSuite, Microsoft Dynamics 365, Sage, Infor, Epicor, Sage Intacct, FreshBooks, Wave |
| **CRM** | 5 | 0 | Salesforce, HubSpot, Zoho CRM, Microsoft Dynamics CRM, Pipedrive |
| **Fuel & Fleet Cards** | 4 | 0 | WEX, Comdata, Fuelman, EFS |
| **ELD (Electronic Logging)** | 5 | 2 | Samsara ELD, Geotab Drive, Motive (Keep Truckin), Omnitracs ELD, Azuga ELD |
| **Freight & Load Boards** | 4 | 0 | DAT Load Board, Truckstop.com, 123Loadboard, Direct Freight |
| **Analytics & BI** | 5 | 0 | Tableau, Power BI, Looker, Qlik, Google Analytics |
| **E-Signatures** | 5 | 0 | DocuSign, Adobe Sign, PandaDoc, HelloSign, Solid Protocol |
| **Shipping Carriers** | 7 | 4 | FedEx, UPS, USPS, DHL, ShipStation, EasyPost, Shippo |
| **Last-Mile Delivery** | 3 | 0 | DoorDash Drive, Uber Eats, Grubhub |
| **POS & Restaurant** | 2 | 0 | Toast POS, Square for Restaurants |
| **Healthcare (FHIR)** | 4 | 0 | Cerner, Allscripts, Epic, HL7 FHIR |
| **Field Service** | 4 | 0 | ServiceTitan, Jobber, Housecall Pro, FieldEdge |
| **Total** | **124** | **23 production** | *21 categories, pluggable adapter architecture* |

> Every provider is defined in `packages/core/src/integrations/registry/integration-registry.ts` with typed schemas, auth methods, API endpoints, and supported operations. Planned adapters accept community PRs.


## License

Witylogix is open-source under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

This means you can freely use, modify, and distribute the software. If you run a modified version as a network service (SaaS), you must make the source code available to your users. This ensures improvements flow back to the community.

**Need a commercial license?** For SaaS providers who need to modify the code without open-sourcing changes, we offer a commercial license. Contact [connect@wityliti.io](mailto:connect@wityliti.io).

---

## Community

- [Discord](https://discord.gg/witylogix) — questions, discussions, support
- [GitHub Issues](https://github.com/witylogix/witylogix-platform/issues) — bug reports, feature requests
- [GitHub Discussions](https://github.com/witylogix/witylogix-platform/discussions) — RFCs, architecture proposals
- [Twitter/X](https://x.com/witylogix) — updates, releases

---

<p align="center">
  <a href="https://witylogix.com">
    <img src="public/logo.svg" width="40" alt="Witylogix" />
  </a>
  <br />
  <sub>Built with care by <a href="https://wityliti.io">Wityliti.io</a></sub>
</p>
