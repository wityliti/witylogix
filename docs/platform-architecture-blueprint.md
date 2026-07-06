# Building an open-source Shopify delivery logistics platform

**A full-stack, multi-tenant delivery management system built on the 2025–2026 Shopify ecosystem can be architected using PostgreSQL row-level security, a Turborepo monorepo, real-time WebSocket tracking, and AI-powered route optimization—all under an AGPL-3.0 open-core model.** This report synthesizes current best practices across eleven architectural domains, from Shopify's latest framework shifts to containerized deployment patterns, providing the technical blueprint for a production-grade platform comparable to Scrollengine.com.

---

## The 2025–2026 Shopify stack has fundamentally shifted

Shopify's developer platform underwent three major breaking changes in late 2025 that reshape how apps are built. Understanding these shifts is non-negotiable for any new Shopify app.

**React Router v7 replaces Remix.** As of the 2025-10 API release, Shopify's CLI template uses React Router v7 via `@shopify/shopify-app-react-router`. Remix and React Router merged—RR v7 is effectively Remix v3. The new package drops REST client support entirely (GraphQL-only), removes non-embedded app support, and defaults to Shopify managed install via token exchange. Initialize with `shopify app init --template=https://github.com/Shopify/shopify-app-template-react-router`.

**Polaris Web Components replace Polaris React.** The `polaris-react` GitHub repo is archived. New framework-agnostic web components use an `s-` prefix (`s-page`, `s-button`, `s-modal`) and load from Shopify's CDN. They work across admin apps, checkout, customer accounts, and POS—unifying the component surface. Implementation requires two CDN scripts:

```html
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
```

**Preact replaces React for UI extensions.** Starting with API version 2025-10, a hard **64KB bundle size limit** makes React incompatible (~73KB baseline). Preact's ~3KB runtime fits comfortably. All checkout, admin, and customer account UI extensions must migrate to Preact to target API versions beyond 2025-07.

App Bridge is now delivered as an **unversioned CDN-hosted script**—no npm package, no version pinning. Shopify manages updates automatically. The `@shopify/app-bridge` npm package (v3.x) is in maintenance mode. A `shopify` global exposes toast notifications, GraphQL via `fetch('shopify:admin/api/...')`, and modal controls.

---

## "Built for Shopify" certification demands rigorous performance

Achieving the BFS badge drives a **49% average increase in new installs within 14 days**. The requirements span four categories with specific, measurable thresholds.

**Performance gates are strict.** Admin web vitals at the 75th percentile require LCP ≤ 2.5s, CLS ≤ 0.1, and INP ≤ 200ms (minimum 100 calls over 28 days). Storefront impact must stay under **10 Lighthouse points degradation**. For carrier service apps specifically: **p95 response time ≤ 500ms** and **≥ 99.9% success rate** over the last 28 days, with a minimum of 1,000 requests.

**Design compliance is enforced visually.** Apps must use `s-app-nav` for navigation, the Contextual Save Bar for forms, and `s-modal` with proper heading/action slots. Rejection triggers include non-Polaris button colors, serif fonts, mismatched backgrounds, and WCAG 2.1 AA contrast failures. The homepage must display app status and actionable metrics.

**Integration standards mandate embedding.** Apps must be fully embedded using the latest App Bridge CDN script, use seamless Shopify-credential sign-up (no separate login), perform clean uninstalls via theme app extensions (no Asset API code injection), and expose primary workflows within Shopify admin. Prerequisites include **50 net installs** from paid-plan shops and **5 reviews**.

---

## Multi-tenant isolation across four infrastructure layers

The shared-database, shared-schema model with defense-in-depth isolation at every layer—PostgreSQL, Redis, BullMQ, and WebSockets—provides the strongest balance of security and operational simplicity.

### PostgreSQL row-level security as the foundation

RLS policies act as automatic `WHERE` clauses enforced by the database engine, eliminating reliance on application code for tenant filtering. The critical pattern uses `SET LOCAL` to scope tenant context to a single transaction, preventing context leakage with connection poolers like PgBouncer:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);
```

Prisma integration requires a client extension that wraps every operation in a transaction with `SET LOCAL`:

```typescript
function forTenant(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_shop_id', ${tenantId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}
```

Performance impact is **negligible with proper indexing**—benchmarks show ~3.5ms average with RLS versus ~3.2ms without on 100K rows across 1,000 tenants. Every tenant-scoped table must have an index on `shop_id`.

### Redis, BullMQ, and WebSocket tenant boundaries

**Redis** uses key prefixing (`tenant:{shopId}:cache:*`, `tenant:{shopId}:session:*`) with a `TenantRedis` wrapper class that automatically prepends the tenant prefix. Version-based cache invalidation avoids expensive `SCAN` operations—increment a version counter to logically invalidate all keys for a resource type, letting old keys expire via TTL.

**BullMQ** on the free tier uses `groupKey: 'tenantId'` in the limiter configuration for per-tenant rate limiting. BullMQ Pro offers Groups with true round-robin fairness across tenants, per-group concurrency limits, and dynamic rate limits by plan tier. The shared-queue-with-metadata approach scales far better than queue-per-tenant.

**Socket.io** uses rooms for tenant isolation (`tenant:{tenantId}`) with JWT authentication middleware that validates the tenant on every connection. The Redis adapter (`@socket.io/redis-adapter`) enables room-based broadcasting across multiple Socket.io server instances. Namespaces separate feature areas (`/admin`, `/storefront`), while rooms within namespaces isolate tenants.

---

## Turborepo monorepo organizes eight workspaces

The monorepo separates applications, Shopify extensions, and shared packages into three top-level directories with clear dependency boundaries:

```
scrollengine/
├── apps/
│   ├── shopify-app/        # Embedded app (React Router v7 + Polaris Web Components)
│   ├── api/                # Standalone Fastify backend
│   ├── driver-app/         # React Native mobile app
│   └── tracking-page/      # Customer-facing Leaflet tracking page
├── extensions/
│   ├── checkout-ui/        # Preact checkout extension (<64KB)
│   └── pos-ui/             # POS UI extension
├── packages/
│   ├── types/              # Shared TypeScript types (JIT, no build)
│   ├── validators/         # Zod schemas (JIT, no build)
│   ├── db/                 # Prisma client + schema (compiled)
│   ├── core/               # Business logic (compiled)
│   └── carrier-service/    # Carrier abstraction layer (compiled)
├── turbo.json
├── docker-compose.yml
└── pnpm-workspace.yaml
```

The `turbo.json` task graph uses **topological dependencies** (`"dependsOn": ["^build"]`) to ensure packages build before apps that consume them. The `dev` task runs with `"persistent": true` and `"cache": false` for long-running dev servers. Internal packages follow two strategies: **Just-in-Time (JIT)** for types and validators (consuming apps transpile directly from `src/index.ts`—no build step), and **compiled packages** for db, core, and carrier-service (own `tsc` build producing `dist/`). All packages use workspace protocol references: `"@repo/db": "workspace:*"`.

---

## Route optimization chains OSRM distance matrices into OR-Tools VRP

The optimization pipeline has three stages: OSRM generates real-world distance/time matrices, OR-Tools solves the Vehicle Routing Problem with constraints, and an ML model refines ETA predictions.

**OSRM's Table API** is the critical bridge. A self-hosted OSRM instance (Docker, MLD algorithm) computes an **N×N distance/time matrix in ~3 seconds for 1,000 locations**—with no per-request charges and no element caps (unlike Google's 625 limit). The endpoint `GET /table/v1/driving/{coords}?annotations=duration,distance` returns the matrices that feed directly into OR-Tools.

**Google OR-Tools solves CVRPTW** (Capacitated VRP with Time Windows) as a Python microservice called via HTTP from the Node.js backend. The solver handles capacity constraints per vehicle, hard and soft time windows, multiple depots, optional stops with penalties (`AddDisjunction`), and pickup-and-delivery pairs. Key tuning parameters: `GUIDED_LOCAL_SEARCH` metaheuristic, `PATH_CHEAPEST_ARC` initial strategy, and a **30-second time limit** that balances solution quality against response latency.

**ML-based ETA prediction** follows Uber's DeepETA pattern: a routing engine produces a base ETA, then an ML model predicts the residual (difference between predicted and actual). For an MVP, **LightGBM on tabular features** (distance, time of day, day of week, historical average speeds, weather) delivers strong accuracy with fast training. Key features include geohash encodings for spatial context, is_rush_hour flags, and rolling averages of recent delivery speeds. The model serves predictions via a lightweight inference endpoint behind Redis feature caching.

---

## Real-time tracking from driver GPS to customer map

The tracking architecture spans four layers: background GPS collection, server-side event distribution, WebSocket delivery, and a customer-facing map interface.

**`react-native-background-geolocation`** (Transistor Software) handles GPS collection with motion-aware power management. It uses accelerometer-based motion detection to power down GPS when stationary, persists locations to native SQLite, and batch-syncs to the server. Configuration targets **10-meter distance filter** with adaptive accuracy—high during active delivery, low when idle. The library handles Android foreground service requirements and iOS background location permissions.

**Redis serves dual roles** in the tracking pipeline. **Pub/Sub** broadcasts ephemeral location updates to Socket.io for instant customer-facing delivery. **Redis GEO** (`GEOADD`, `GEOSEARCH`) maintains a spatial index of all active drivers for nearest-driver queries and dispatch optimization. A hybrid approach publishes each update to both a Pub/Sub channel (instant broadcast) and a Redis Stream (durable history for analytics and replay).

**The customer tracking page** is a standalone HTML page at `https://track.example.com/d/{trackingToken}` requiring no authentication. It connects to Socket.io, joins a delivery-specific room, and renders a **Leaflet.js map with OpenStreetMap tiles** (free, no API key). The page shows a driver marker with heading rotation, a route polyline from OSRM geometry, a destination pin, an ETA countdown, and delivery status badges. Socket.io handles reconnection automatically for unreliable mobile networks.

---

## The Carrier Service API bridges Shopify checkout to dynamic rates

When a customer reaches checkout, Shopify POSTs order details (origin, destination, items with weights, currency, customer tags) to the app's registered callback URL. The app returns an array of rate objects with `service_name`, `service_code`, `total_price` (in subunits—1295 = $12.95), `currency`, and optional delivery date ranges.

**Response timeouts are dynamic** based on request volume per shop-app pair: 10 seconds under 1,500 RPM, 5 seconds at 1,500–3,000 RPM, and **3 seconds above 3,000 RPM**. Shopify caches successful responses for 15 minutes. The `service_code` must be stable and consistent—no timestamps or session IDs.

Registration uses the GraphQL `carrierServiceCreate` mutation (REST is deprecated for new apps as of April 2025):

```graphql
mutation {
  carrierServiceCreate(
    input: {
      name: "ScrollEngine Delivery"
      callbackUrl: "https://api.example.com/shopify/rates"
      active: true
      supportsServiceDiscovery: true
    }
  ) {
    carrierService {
      id
      name
    }
    userErrors {
      field
      message
    }
  }
}
```

Best practices for meeting the **500ms p95 target**: store carrier retail rates internally to avoid external calls, build a Redis caching layer keyed on `{origin_zip}_{dest_zip}_{weight}`, parallelize any external carrier API calls, set internal timeouts below 500ms with fallback to pre-computed backup rates, and host in Google Cloud regions near Shopify's infrastructure.

---

## Event-driven notifications across email, SMS, and WhatsApp

The notification system uses BullMQ queues per channel with exponential backoff retries, a Handlebars template engine with merchant branding, and webhook endpoints for delivery receipt tracking.

Each notification event dispatches to the appropriate channel queue. Workers process jobs with per-channel rate limiting (BullMQ `limiter` option: e.g., 100 emails/second, 10 SMS/second). **SendGrid** handles transactional email with open/click tracking. **Twilio** handles SMS with status callback webhooks. **WhatsApp Cloud API** (Meta's official Node.js SDK `whatsapp`) sends template messages for conversation initiation and free-form messages within the 24-hour reply window.

The template engine compiles Handlebars templates with merchant branding variables (logo URL, primary color, company name, support email) injected at render time. Templates are stored per-merchant in the database, with system defaults as fallbacks. Event triggers fire from business logic: `order.assigned` → driver assignment SMS, `order.out_for_delivery` → customer tracking link via WhatsApp, `order.delivered` → delivery confirmation email with POD photos.

Fallback strategy: if the primary channel fails after 3 attempts, escalate to an alternative channel (email fails → SMS, SMS fails → WhatsApp). All send attempts are logged to `notification_log` with provider message IDs for delivery tracking.

---

## The database schema spans eleven PostGIS-enabled models

All tables carry a `shop_id` foreign key with RLS policies enforcing tenant isolation at the database level. PostGIS geometry columns enable spatial queries for delivery zones, driver proximity, and proof-of-delivery coordinates.

**Core tables and their key design decisions:**

The **shops** table stores encrypted Shopify access tokens, plan tiers, and JSONB settings (timezone, currency, branding, notification preferences, POD requirements). **Orders** denormalize the delivery address as a snapshot at creation time to avoid Shopify API dependency, with a PostGIS point for spatial operations and a composite unique constraint on `(shop_id, shopify_order_id)`.

**Delivery zones** use PostGIS Polygon geometry with a `find_delivery_zone(shop_id, lng, lat)` helper function using `ST_Contains`. **Drivers** maintain a PostGIS point for `current_location` with a GiST spatial index, enabling `find_nearby_drivers` queries via `ST_DWithin` with KNN ordering (`<->` operator). **Routes** store optimized waypoints as a JSONB array of `{sequence, orderId, lat, lng, estimatedArrival, type}` objects, with child **route_stops** tracking per-stop status progression.

**Proof of delivery** captures photo URLs (PostgreSQL native string array), signature URL, recipient name, GPS coordinates, and timestamp—meeting legal evidence standards. **Time slots** link to delivery zones with capacity limits and cutoff windows for order acceptance.

Performance indexes include partial indexes for active records (`WHERE status IN ('AVAILABLE') AND is_active = true` on drivers, non-terminal statuses on orders), composite indexes for dashboard queries (`shop_id, status, created_at DESC`), and GiST indexes on all geometry columns.

---

## AGPL-3.0 licensing with an open-core revenue model

**AGPL-3.0** closes the SaaS loophole in standard GPL: Section 13 requires that anyone who modifies the code and makes it available over a network must release their source code. This prevents competitors from forking, modifying, and running a competing SaaS without contributing back. Unmodified use does not trigger copyleft. Companies using this approach include Lago (billing), Cal.com, and Plausible Analytics.

The open-core split follows the **Buyer-Based Open Core** framework. The open-source tier includes core delivery management, single-tenant Docker deployment, basic notifications, driver app, tracking page, Shopify integration, OSRM routing, and basic route optimization. The commercial tier adds multi-tenant SaaS hosting, advanced optimization algorithms, white-label branding, SSO/SAML, audit logs, priority support with SLA, and advanced analytics. The key principle: **never move free features to paid**; paid-to-free movement is acceptable.

A dual-licensing model offers a commercial license alternative for SaaS providers who need to modify the code without open-sourcing their changes. The `CONTRIBUTING.md` should specify Conventional Commits, fork-branch-PR workflow, DCO sign-off (contributions licensed under AGPL-3.0), and architecture decision records.

---

## Containerized deployment with horizontal scaling paths

A single `docker compose up` deploys the complete stack for self-hosted users: **PostGIS 16** (with `postgis` and `pgcrypto` extensions), **Redis 7** (with AOF persistence and LRU eviction), **OSRM** (MLD algorithm, pre-processed regional OSM data), the **Fastify API** server, and a **BullMQ worker** process.

The Fastify API uses a multi-stage Dockerfile: build stage runs `pnpm turbo run build --filter=@repo/api...` to compile the app and all its package dependencies, then copies only production artifacts to a slim `node:20-alpine` production image. Health checks query both PostgreSQL (`SELECT 1`) and Redis (`PING`). Graceful shutdown listens for SIGTERM, closes the Fastify server, disconnects Prisma, quits Redis, and shuts down BullMQ workers before exiting.

For horizontal scaling, the architecture separates into **stateless API servers** (scaled behind a load balancer with sticky sessions for Socket.io), **stateless workers** (scaled independently based on queue depth), and **stateful services** (PostgreSQL with read replicas, Redis Cluster for sharding). OSRM is memory-intensive—a single instance serving a country-sized dataset needs **64GB+ RAM** for world data, but regional extracts (e.g., California) fit in 4–8GB. Kubernetes deployment uses `RollingUpdate` strategy with separate liveness and readiness probes, 30-second `terminationGracePeriodSeconds`, and the health endpoint returning 503 on SIGTERM to drain connections before shutdown.

---

## Conclusion

This architecture achieves three critical goals simultaneously. First, it meets Shopify's rapidly evolving platform requirements—React Router v7, Polaris Web Components, Preact extensions, and the 500ms carrier service p95 target are all first-class concerns, not afterthoughts. Second, the multi-tenant isolation model (RLS + key-prefixed Redis + BullMQ groups + Socket.io rooms) provides defense-in-depth security without sacrificing the operational simplicity of a shared infrastructure. Third, the OSRM-to-OR-Tools optimization pipeline eliminates dependency on paid routing APIs while matching their quality for regional deployments.

The most consequential architectural choice is **PostgreSQL RLS as the single source of truth for tenant boundaries**. Every other isolation mechanism (Redis prefixing, BullMQ grouping, Socket.io rooms) is a convenience layer—RLS is the security guarantee. This inversion, where the database enforces what application code used to own, eliminates an entire category of multi-tenant data leakage bugs.

The open-core model positions the platform to sustain development: the AGPL-3.0 core attracts contributors and self-hosted users, while the commercial tier funds ongoing development of advanced features that enterprise buyers require. Docker-first deployment makes self-hosting genuinely accessible, which is the prerequisite for an open-source community to form around the project.
