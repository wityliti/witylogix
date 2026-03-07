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

Witylogix is a full-stack, multi-tenant delivery management platform built for e-commerce. It gives merchants complete control over last-mile delivery — from zone-based rate calculation at checkout to real-time driver tracking and proof of delivery — without per-transaction SaaS fees.

**The problem:** E-commerce merchants using local delivery rely on fragmented tools, pay per-transaction fees that scale linearly with order volume, and have zero control over routing, driver workflows, or customer tracking experiences.

**Our approach:** One open-source platform that handles the entire delivery lifecycle. Self-host it with `docker compose up` or use our managed cloud. Integrates with **Shopify** as a first-class platform (React Router v7, Polaris Web Components, Preact extensions) with support for more e-commerce platforms coming soon.

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
- **Integration Marketplace** — unified catalog of 38 integrations across 6 categories (Communication, Routing, Order Management, Inventory, Payment, Analytics) with per-tenant install/configure, BYOK credentials, health monitoring, and metered fallback billing
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
| Dashboard | [Next.js 15](https://nextjs.org) (App Router, dark theme, CSS custom properties) |
| Routing | [Mapbox](https://www.mapbox.com) (Phase 1) → [OSRM](https://project-osrm.org) (Phase 2) |
| Real-time | [Socket.io](https://socket.io) + [Redis Adapter](https://socket.io/docs/v4/redis-adapter/) |
| Mobile | [React Native](https://reactnative.dev) (Expo) + background geolocation |
| Maps | [Leaflet.js](https://leafletjs.com) + OpenStreetMap tiles |
| Deployment | [Docker Compose](https://docs.docker.com/compose/) / Kubernetes |

---

## Architecture

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
│   ├── db/                  # Prisma 6 schema (25 modules) + RLS policies
│   ├── core/                # Business logic (43 modules — routing, messaging, RBAC, campaigns, etc.)
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

Witylogix uses PostgreSQL with PostGIS for spatial operations and Row-Level Security for tenant isolation. The schema is organized across 25 Prisma modules covering the full delivery lifecycle:

**Core:** organizations · org_members · shops · users · orders · drivers · delivery_zones · time_slots · routes · route_stops · proof_of_delivery

**Shipping:** shipments · shipment_proofs · carrier_services · shipping_profiles · shipping_rates · locations · location_working_hours

**Messaging:** messages · message_templates · whatsapp_configs · notification_logs

**Campaigns:** campaigns · broadcast_groups · broadcast_group_members · campaign_events

**Billing:** payments · payment_methods · billing_plans · billing_subscriptions · invoices

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
| `@witylogix/dashboard` | Next.js 15 merchant dashboard — 50 routes, dark theme, real-time updates |
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
| `@witylogix/core` | Compiled | 43 modules — routing, messaging, RBAC, campaigns, audit, encryption, logging, notifications, analytics, payments |
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
- [x] PostgreSQL schema with PostGIS + RLS (25 Prisma modules)
- [x] Routing provider abstraction (Mapbox, OSRM, Google, HERE, GraphHopper, TomTom)
- [x] Multi-shop organization support with dual-mode RLS
- [x] Fastify API with full CRUD endpoints (44 route files, 33+ registered prefixes)
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
- [x] Next.js 15 merchant dashboard (50 routes, dark theme)
- [x] Socket.io real-time tracking + driver location streaming
- [x] React Native driver app with background GPS
- [x] Customer tracking page with Leaflet map
- [x] Payment processing — gateway abstraction + billing system
- [x] Analytics engine — event tracking, aggregation, dashboards
- [x] Route optimization — nearest-neighbor, 2-opt, Clarke-Wright + ETA calc
- [x] 44 test suites across core modules
- [ ] Docker production deployment
- [ ] MongoDB → PostgreSQL data migration tooling
- [ ] Phase 2: OSRM + OR-Tools advanced route optimization
- [ ] "Built for Shopify" certification
- [ ] Preact checkout UI extension
- [ ] WooCommerce integration plugin

---

## Development progress

Witylogix is being built sprint-by-sprint by a 9-person team. Each sprint delivers working, build-verified code across all 5 apps.

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

**Current stats (Sprint 2.6):** 555 source files, 168,753 lines of code, 25 Prisma modules, 43 core modules, 44 test suites.

See [`gap-analysis.xlsx`](gap-analysis.xlsx) for detailed completion tracking across data models, feature pages, API services, and infrastructure.

---

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
