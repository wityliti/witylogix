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
- **Route optimization** with distance matrix routing (Mapbox today, OSRM in Phase 2)
- **Real-time driver tracking** over WebSockets with a customer-facing Leaflet map
- **Driver mobile app** (React Native) with background GPS and proof-of-delivery capture
- **Multi-channel notifications** — email (SendGrid), SMS (Twilio), WhatsApp (Meta Cloud API)
- **Multi-tenant isolation** enforced at the database level via PostgreSQL Row-Level Security
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
│   ├── shopify-app/         # Embedded Shopify admin app (React Router v7)
│   ├── api/                 # Fastify backend (REST + WebSocket)
│   ├── driver-app/          # React Native mobile app
│   └── tracking-page/       # Customer-facing delivery tracking (Leaflet)
├── extensions/
│   ├── checkout-ui/         # Preact checkout extension (< 64KB)
│   └── pos-ui/              # POS UI extension
├── packages/
│   ├── db/                  # Prisma schema + RLS policies + migrations
│   ├── core/                # Business logic (orders, drivers, routing, zones)
│   ├── types/               # Shared TypeScript types (JIT, no build)
│   ├── validators/          # Zod schemas (JIT, no build)
│   └── carrier-service/     # Carrier rate abstraction
├── infra/                   # Docker, K8s, OSRM, Nginx configs
├── docs/                    # Architecture Decision Records
├── docker-compose.yml       # One-command local setup
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

Witylogix uses PostgreSQL with PostGIS for spatial operations and Row-Level Security for tenant isolation. The schema includes 11 models:

**shops** · **users** · **orders** · **drivers** · **delivery_zones** · **time_slots** · **routes** · **route_stops** · **proof_of_delivery** · **notification_logs** · **carrier_services**

Every tenant-scoped table has an RLS policy that automatically filters queries by `shop_id`. The Prisma client includes a `forTenant()` extension that sets the RLS context per transaction:

```typescript
import { forTenant } from "@witylogix/db";

const db = forTenant(shopId);
const orders = await db.order.findMany(); // Automatically filtered by RLS
```

PostGIS helper functions:

- `find_delivery_zone(shop_id, lng, lat)` — find which zone contains a point
- `find_nearby_drivers(shop_id, lng, lat, radius)` — find available drivers within radius

---

## Routing

The routing system uses a **provider abstraction** so you can swap backends without changing business logic:

```typescript
import { createRoutingProvider } from "@witylogix/core/routing";

const routing = createRoutingProvider(); // Reads ROUTING_PROVIDER env var
const matrix = await routing.getDistanceMatrix(points);
const route = await routing.getRoute(origin, destination);
const results = await routing.geocode("123 Main St, Brooklyn, NY");
```

| Phase | Provider | Pros | Limitations |
|-------|----------|------|-------------|
| **Phase 1** (current) | Mapbox | Production-ready, familiar API | 25-point matrix limit, per-request cost |
| **Phase 2** (planned) | OSRM | Zero cost, unlimited matrix size | Requires self-hosting, memory-intensive |

Switch providers with one env var: `ROUTING_PROVIDER=mapbox` or `ROUTING_PROVIDER=osrm`

---

## Project structure

### Apps

| Package | Description |
|---------|-------------|
| `@witylogix/api` | Fastify 5 backend — REST API, WebSocket server, BullMQ workers |
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
| `@witylogix/core` | Compiled | Business logic — orders, drivers, routing, zones, notifications |
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
- [x] PostgreSQL schema with PostGIS + RLS
- [x] Routing provider abstraction (Mapbox Phase 1)
- [ ] Fastify API with full CRUD endpoints
- [ ] React Router v7 Shopify embedded app
- [ ] Preact checkout UI extension
- [ ] Socket.io real-time tracking
- [ ] React Native driver app with background GPS
- [ ] BullMQ notification workers (email, SMS, WhatsApp)
- [ ] Carrier Service API (< 500ms p95)
- [ ] Docker production deployment
- [ ] MongoDB → PostgreSQL data migration tooling
- [ ] Phase 2: OSRM + OR-Tools route optimization
- [ ] "Built for Shopify" certification
- [ ] WooCommerce integration plugin
- [ ] Standalone dashboard (platform-independent)

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
