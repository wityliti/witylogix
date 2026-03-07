# Witylogix Platform — System Design Document

**Version:** 1.0
**Date:** 2026-03-06
**Status:** Draft
**Authors:** Witylogix Engineering Team
**Related:** [ADR-001: Platform Rewrite — Stack Selection](../adr/ADR-001-platform-rewrite-stack-selection.md)

---

## 1. Requirements

### 1.1 Functional Requirements

The platform manages the full lifecycle of last-mile delivery for Shopify merchants, from checkout rate calculation through proof of delivery.

**Order Ingestion**

- Receive orders via Shopify webhooks (orders/create, orders/update, orders/cancelled, orders/fulfilled)
- Support manual order creation through the dashboard
- Support bulk CSV import (Shopify export format, Amazon Seller Central format)
- Deduplicate orders by `(shop_id, shopify_order_id)` composite key
- Snapshot delivery address at ingestion time to avoid Shopify API dependency downstream

**Delivery Zone Management**

- Define polygon-based delivery zones on a map (PostGIS geometry)
- Assign base rates, per-km rates, minimum order values, and free-delivery thresholds per zone
- Support overlapping zones with priority ordering
- Look up which zone contains a given coordinate (`ST_Contains`)

**Carrier Service (Checkout Rates)**

- Register as a Shopify Carrier Service via GraphQL `carrierServiceCreate`
- Respond to rate requests within 500ms at p95 (Shopify BFS requirement)
- Calculate rates based on: delivery zone match, total weight, item count, time slot surcharge, customer tags
- Return multiple rate options (standard, express, scheduled) with delivery date ranges
- Fall back to pre-computed backup rates if calculation exceeds internal timeout

**Shipment & Route Management**

- Create shipments from orders (one-to-one or batch)
- Assign shipments to delivery zones, locations (warehouses), and drivers
- Create optimized multi-stop routes from unassigned shipments
- Support route statuses: DRAFT → OPTIMIZED → ASSIGNED → IN_PROGRESS → COMPLETED
- Track per-stop status progression: PENDING → EN_ROUTE → ARRIVED → COMPLETED
- Allow drivers to claim unassigned routes (claimable shipment pool)

**Route Optimization**

- Generate distance/duration matrices via multi-provider routing registry (Mapbox, OSRM, Google Maps, HERE, GraphHopper, TomTom)
- Solve Vehicle Routing Problem with constraints: vehicle capacity, time windows, service duration per stop
- Support multiple vehicles per optimization run
- Return optimized stop sequences with ETAs
- Handle unassignable stops (beyond capacity or time window) gracefully
- Multi-provider BYOK: deployer sets default provider, tenants can choose their own provider + credentials via `ROUTING_BYOK` flag
- Metered fallback: when tenant uses deployer's credentials, every API call is recorded in `routing_meter_events` for usage-based billing

**Real-time Driver Tracking**

- Collect GPS coordinates from driver mobile app via background geolocation
- Broadcast driver location updates to tenant-scoped Socket.io rooms
- Maintain spatial index of active drivers in Redis GEO for nearest-driver queries
- Store location history in Redis Streams for analytics and replay
- Calculate and broadcast updated ETAs as drivers progress through routes

**Customer Tracking Page**

- Public page at `/d/{trackingToken}` requiring no authentication
- Display: driver marker with heading, route polyline, destination pin, ETA countdown, status badges
- Real-time updates via Socket.io connection to delivery-specific room
- Automatic reconnection for unreliable mobile networks

**Proof of Delivery**

- Capture: photos (multiple), signature (drawn on device), recipient name, GPS coordinates, timestamp
- Upload photos to S3-compatible storage
- Associate POD with order; trigger fulfillment update in Shopify

**Notifications (Multi-Provider, BYOK-Aware)**

- Multi-channel with independent provider registries per channel:
  - Email: SendGrid (available), Mailgun, AWS SES, Postmark, Resend, SMTP (coming soon)
  - SMS: Twilio (available), Vonage, AWS SNS, MessageBird, Plivo (coming soon)
  - WhatsApp: Meta Cloud API (available), Twilio WhatsApp, 360dialog (coming soon)
  - Push: Firebase FCM (available), OneSignal, Expo Push (coming soon)
- Same BYOK pattern as routing: deployer sets defaults per channel, tenants can override
- Metered fallback: when BYOK enabled and tenant hasn't configured own credentials, every send through deployer credentials is recorded in `notification_meter_events`
- Event-driven triggers: order.assigned, order.out_for_delivery, order.arrived, order.delivered, order.failed
- Merchant-customizable Handlebars templates with branding variables (logo, colors, company name)
- Fallback escalation: primary channel fails → try alternative after 3 attempts
- Log all send attempts with provider message IDs for delivery tracking
- Tenant notification config stored in `shop.settings.notifications.<channel>` (JSONB)

**Dashboard**

- Embedded Shopify admin app (React Router v7 + Polaris Web Components)
- Screens: orders list, shipment management, route builder, driver management, zone editor, settings, analytics
- Dynamic column selection and saved filter presets per user
- Map views for orders, shipments, routes, and driver locations
- Onboarding flow for new merchant installs
- Role-based access: SUPER_ADMIN, ADMIN, DISPATCHER, VIEWER

**Multi-tenancy**

- Database-enforced isolation via PostgreSQL Row-Level Security (dual-mode: shop-scoped and org-scoped)
- Redis key-prefixed isolation for cache and sessions
- BullMQ job-group isolation for per-tenant rate limiting
- Socket.io room-based isolation for real-time events
- Optional org layer groups multiple shops with shared drivers, zones, and cross-shop analytics

**Authentication & Authorization**

- JWT-based auth for dashboard users (email + password) and drivers (phone + password)
- Shopify session token verification for embedded app (via App Bridge)
- Refresh token rotation with Redis-backed storage and configurable TTLs
- Shop-level RBAC: SUPER_ADMIN, ADMIN, DISPATCHER, VIEWER, DRIVER
- Org-level RBAC: OWNER, ADMIN, MEMBER with per-shop access control
- Role hierarchy enforcement — users can only manage equal or lower roles
- User management: invite, update role, change password, deactivate (soft delete)
- Per-tenant Shopify credentials, branding, notification templates, and plan tiers

**Shopify Integration**

- OAuth installation flow with token exchange (managed install)
- Webhook subscription management for orders, products, customers, inventory, fulfillments
- Fulfillment creation and status updates via Shopify GraphQL Admin API
- Shopify Functions support: delivery customization, cart validation, payment customization, fulfillment routing
- App proxy for storefront-embedded content
- Clean uninstall: remove webhooks, carrier services, and theme assets

**Integration Marketplace**

- Unified catalog of 38 integrations across 6 categories:
  - Communication (17): Email (SendGrid, Mailgun, AWS SES, Postmark, Resend, SMTP), SMS (Twilio, Vonage, AWS SNS, MessageBird, Plivo), WhatsApp (Meta Cloud, Twilio WhatsApp, 360dialog), Push (Firebase, OneSignal, Expo Push)
  - Routing (6): Mapbox, OSRM, Google Maps, HERE, GraphHopper, TomTom
  - Order Management (4): Shopify Orders, WooCommerce, Magento, Custom API
  - Inventory (4): Shopify Inventory, Skubana, Cin7, Stocky
  - Payment (3): Shopify Payments, Stripe, Square
  - Analytics (4): Built-in Analytics, Segment, Google Analytics, Mixpanel
- Static registry (`packages/core/src/integrations/`) with `IntegrationAppMeta` metadata driving UI form generation, credential validation, and capability display
- Per-tenant install/uninstall/configure flows stored in `integrations` table with encrypted credentials (JSONB)
- Unified `integration_events` audit table for metering, billing, and health tracking
- Plugin-ready `IntegrationProvider` interface with lifecycle hooks (`onInstall`, `onUninstall`, `onSync`, `onWebhook`, `onHealthCheck`) — internal for now, public SDK later
- BYOK pattern per category: `ROUTING_BYOK`, `NOTIFICATIONS_BYOK`, `INTEGRATIONS_BYOK` env flags
- Backward-compatible with existing routing/notification systems via compatibility shim (`compat.ts`)
- BullMQ integration worker for async jobs: sync, health checks, webhook processing
- Marketplace UI in Shopify app: category tabs, search, provider cards, install flow, credential management

### 1.2 Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Carrier Service p95 latency | ≤ 500ms | Shopify BFS certification |
| Carrier Service availability | ≥ 99.9% over 28 days | Shopify BFS certification |
| Admin LCP (p75) | ≤ 2.5s | Shopify BFS web vitals |
| Admin CLS (p75) | ≤ 0.1 | Shopify BFS web vitals |
| Admin INP (p75) | ≤ 200ms | Shopify BFS web vitals |
| Checkout extension bundle | < 64KB | Shopify Preact hard limit (API 2025-10+) |
| Storefront Lighthouse impact | < 10 points degradation | Shopify BFS requirement |
| GPS update latency | < 2s from driver to customer map | Real-time tracking UX |
| Distance matrix (25 pts) | < 3s via Mapbox | Route optimization feasibility |
| Distance matrix (1000 pts) | < 5s via OSRM (Phase 2) | Large-fleet optimization |
| Concurrent tenants | 1,000+ on shared infrastructure | Multi-tenant SaaS target |
| Order throughput | 10,000 orders/day per tenant | High-volume merchant support |
| Driver GPS updates | 10m distance filter, adaptive accuracy | Battery/bandwidth balance |
| RLS overhead | < 5% query time increase | Benchmarked ~3.5ms vs ~3.2ms on 100K rows |

### 1.3 Constraints

- Team of 3-5 engineers with strong Node.js/Express background, moderate TypeScript/PostgreSQL experience
- Existing v3 in production — must run in parallel during transition, no flag day migration
- Shopify Partner account with existing merchant relationships (50+ installs)
- Budget constraint: prefer self-hostable infrastructure over managed services
- Target 4-6 months for MVP feature parity with v3 core features

---

## 2. High-Level Architecture

### 2.1 System Context

```
                                    ┌──────────────────┐
                                    │   Shopify Admin   │
                                    │  (Merchant Uses)  │
                                    └────────┬─────────┘
                                             │ App Bridge CDN
                                             ▼
┌──────────────┐    ┌─────────────────────────────────────────────────┐
│   Shopify    │    │              Witylogix Platform                 │
│   Platform   │◄──►│                                                 │
│              │    │  ┌─────────────┐  ┌───────────┐  ┌──────────┐  │
│ • Webhooks   │───►│  │ Fastify API │  │  Shopify   │  │ Tracking │  │
│ • Carrier    │◄──►│  │  (REST +    │  │   App      │  │  Page    │  │
│   Service    │    │  │  WebSocket) │  │ (RR v7)    │  │(Leaflet) │  │
│ • Admin API  │    │  └──────┬──────┘  └───────────┘  └────┬─────┘  │
│ • Functions  │    │         │                              │        │
└──────────────┘    │    ┌────┴────────────┐          Socket.io       │
                    │    │                 │                │        │
                    │    ▼                 ▼                │        │
                    │  ┌──────┐    ┌────────────┐          │        │
                    │  │Redis │    │ PostgreSQL │          │        │
                    │  │  7   │    │ 16+PostGIS │          │        │
                    │  └──┬───┘    └────────────┘          │        │
                    │     │                                 │        │
                    │     │  ┌──────────────┐              │        │
                    │     └──│  BullMQ      │              │        │
                    │        │  Workers     │              │        │
                    │        └──────────────┘              │        │
                    └─────────────────────────────────────────────────┘
                                             ▲
                    ┌──────────────┐          │
                    │  Driver App  │──────────┘
                    │(React Native)│   GPS + Socket.io
                    └──────────────┘

                    ┌──────────────┐
                    │   Customer   │──── Views tracking page
                    │   Browser    │     in browser/webview
                    └──────────────┘
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        apps/ (Deployable Units)                     │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │   shopify-app     │  │       api        │  │  tracking-page  │   │
│  │                   │  │                  │  │                 │   │
│  │ React Router v7   │  │ Fastify 5        │  │ Vite + Leaflet  │   │
│  │ Polaris WC (s-*)  │  │ Socket.io        │  │ Socket.io client│   │
│  │ Shopify App Bridge│  │ BullMQ workers   │  │ No auth needed  │   │
│  │ Session storage   │  │ Prisma + RLS     │  │                 │   │
│  └────────┬──────────┘  └────────┬─────────┘  └────────┬────────┘   │
│           │ HTTP                 │ HTTP + WS            │ WS        │
│  ┌────────┴──────────┐          │              ┌───────┴────────┐   │
│  │    driver-app     │          │              │  checkout-ui   │   │
│  │                   │          │              │                │   │
│  │ React Native/Expo │          │              │ Preact < 64KB  │   │
│  │ BG Geolocation    │          │              │ Time slot pick │   │
│  │ Socket.io client  │          │              │ Delivery date  │   │
│  └───────────────────┘          │              └────────────────┘   │
│                                 │                                   │
├─────────────────────────────────┼───────────────────────────────────┤
│                     packages/ (Shared Libraries)                    │
│                                 │                                   │
│  ┌───────────┐  ┌──────────┐  ┌┴──────────┐  ┌──────────────────┐  │
│  │    db     │  │   core   │  │   types   │  │   validators    │  │
│  │          │  │          │  │           │  │                  │  │
│  │ Prisma   │  │ Business │  │ TS types  │  │ Zod schemas     │  │
│  │ RLS ext  │  │ logic    │  │ (JIT)     │  │ (JIT)           │  │
│  │ Compiled │  │ Routing  │  │           │  │                  │  │
│  │          │  │ Compiled │  │           │  │                  │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────────┘  │
│                                                                     │
│  ┌──────────────────┐                                               │
│  │ carrier-service  │                                               │
│  │                  │                                               │
│  │ Rate calculator  │                                               │
│  │ Compiled         │                                               │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow — Order Lifecycle

```
Shopify Checkout                 Witylogix API              Dashboard/Driver App
     │                               │                           │
     │  1. Rate Request (POST)        │                           │
     │  ──────────────────────►       │                           │
     │  (origin, dest, items)         │                           │
     │                                │                           │
     │  2. Rates Response (< 500ms)   │                           │
     │  ◄──────────────────────       │                           │
     │  [{name, price, dates}]        │                           │
     │                                │                           │
     │  3. Order Created Webhook      │                           │
     │  ──────────────────────►       │                           │
     │  (order data payload)          │                           │
     │                                ├── 4. Persist order ──────►│ DB
     │                                ├── 5. Match zone ─────────►│ PostGIS
     │                                ├── 6. Queue notification ─►│ BullMQ
     │                                │                           │
     │                                │  7. Dispatcher assigns    │
     │                                │◄──────────────────────────┤
     │                                │  (assign driver + route)  │
     │                                │                           │
     │                                │  8. Optimize route        │
     │                                ├── RoutingProvider ────────►│ Mapbox/OSRM
     │                                │◄─ distance matrix ────────┤
     │                                ├── VRP solver ─────────────►│ (future)
     │                                │◄─ optimized sequence ─────┤
     │                                │                           │
     │                                │  9. Driver starts route   │
     │                                │◄─ GPS updates ────────────┤ Driver App
     │                                ├── Redis GEO update ──────►│
     │                                ├── Socket.io broadcast ───►│ Tracking Page
     │                                │                           │
     │                                │  10. Driver delivers      │
     │                                │◄─ POD (photos, sig) ──────┤ Driver App
     │                                ├── S3 upload ─────────────►│
     │                                ├── Update order status ───►│ DB
     │                                │                           │
     │  11. Fulfillment Update        │                           │
     │  ◄──────────────────────       │                           │
     │  (GraphQL mutation)            │                           │
     │                                ├── 12. Notification ──────►│ BullMQ → Email/SMS/WA
     │                                │                           │
```

---

## 3. Deep Dive

### 3.1 Data Model

The v3 system has 77 MongoDB models. The v4 system consolidates these into 13 core PostgreSQL tables that cover the same domain with stronger relational integrity. Two tables (`organizations`, `org_members`) were added to support multi-shop tenancy without breaking the Shopify integration.

**Model Consolidation Map (v3 → v4):**

| v3 MongoDB Models | v4 PostgreSQL Table | Notes |
|---|---|---|
| storeDetails, storeSettings | `shops` | Merge settings into JSONB column |
| users, userRoles, userPermission | `users` | Flatten role enum, move permissions to JSONB |
| shopifyOrders | `orders` | Denormalize address, add PostGIS point |
| shipment, shipmentLocation, shipmentPaymentTransactions | `orders` (extended) | Shipment concept merged into order workflow |
| shipmentRoutes, shipmentDeliveryActivity | `routes`, `route_stops` | Separate route from stops |
| shipmentRules, shipmentZones | `delivery_zones`, `time_slots` | Zone polygons + scheduling |
| vehicle, vehicleLocation | `drivers` | Vehicle is a driver attribute |
| shipmentDocuments, shipmentFeedbacks | `proof_of_delivery` | POD is the delivery evidence record |
| notification (templates, logs) | `notification_logs` | Templates stored in shop settings JSONB |
| codPaymentGateway, paymentGateways | Removed (Phase 1) | Simplify — payment tracking is secondary |
| shopifyProducts, shopifyCustomer, shopifyInventory | Not stored locally | Query Shopify GraphQL on demand; don't cache |
| analytics models | Not stored locally (Phase 1) | Use Redis Streams + external analytics |
| calenderRules | `time_slots` | Calendar rules become time slot constraints |
| billingPlan | `shops.plan_tier` | Plan tier is a shop attribute |
| campaigns, featureRequests, contactUs | Removed (open-source) | Community features via GitHub |
| — (new) | `organizations` | Multi-shop grouping layer above shops |
| — (new) | `org_members` | Junction table for org membership with shop-scoped access |

**Key Schema Design Decisions:**

**Orders absorb the shipment concept.** In v3, an order creates a shipment which then goes through a lifecycle. In v4, the order itself carries the delivery status, driver assignment, and route association. This eliminates a join and simplifies the mental model. The order table has 30+ columns but most are nullable — an order starts with just Shopify data and accumulates delivery fields as it progresses.

**Delivery zones use PostGIS polygons instead of rule-based matching.** V3 uses shipmentRules with zip code lists, radius calculations, and tag-based matching — all implemented in application JavaScript. V4 stores zone boundaries as `geometry(Polygon, 4326)` and uses `ST_Contains` for point-in-polygon tests. This is faster, more accurate, and enables the visual zone editor in the dashboard.

**Driver location is a PostGIS point with GiST index.** V3 stores vehicle locations in a separate collection and computes distances in application code. V4 uses `ST_DWithin` with KNN ordering (`<->` operator) for nearest-driver queries directly in PostgreSQL — a single indexed query replaces the v3 pattern of fetching all drivers and sorting in memory.

**Shop settings are JSONB, not separate tables.** V3 has a 35KB storeSettings model with dozens of typed fields. V4 stores merchant-specific settings (branding, notification preferences, POD requirements, feature flags, timezone, currency) as a JSONB column on the shops table. This keeps the schema clean while allowing per-merchant customization without migrations.

**Multi-shop organizations are an optional layer above shops.** The `Organization` model groups multiple Shopify stores under one tenant. `Shop.orgId` is nullable — standalone shops (the majority) have no org and work exactly as before. Shared resources (drivers, delivery zones) have both `shopId` and `orgId` — when `orgId` is set and `shopId` is null, the resource is org-wide. Dual-mode RLS policies use OR logic: a driver is visible if it belongs to the requesting shop OR to the shop's organization.

```
Organization (optional)
├── Shop A  ← Shopify OAuth, webhooks, carrier service (shop-scoped, org-unaware)
├── Shop B  ← Same — Shopify never sees the org layer
├── Org Drivers (orgId set, shopId null) ← assignable to any shop's orders
├── Org Zones (orgId set, shopId null) ← shared delivery coverage
└── OrgMembers
    ├── User X: OWNER (shopIds: [] = all shops)
    ├── User Y: ADMIN (shopIds: [Shop A, Shop B])
    └── User Z: MEMBER (shopIds: [Shop A])
```

**Prisma client scoping:** Three functions create RLS-aware clients:

| Function | RLS Setting | Use Case |
|----------|------------|----------|
| `forTenant(shopId)` | `app.current_shop_id` | Shopify webhooks, carrier service, standalone shops |
| `forOrg(orgId)` | `app.current_org_id` | Org dashboard, cross-shop analytics |
| `forTenantInOrg(shopId, orgId)` | Both settings | Dashboard with org-shared drivers/zones visible |

**Backward compatibility guarantee:** Shops without an org set `orgId = null`. The `forTenant(shopId)` function only sets `app.current_shop_id`. RLS policies check `current_setting('app.current_shop_id', TRUE)` with the `TRUE` flag (returns empty string instead of error when unset), so org-unaware code paths see only shop-level data.

### 3.2 API Design

The API consolidates v3's fragmented route structure (spread across 12+ route files and 22 controller directories) into a clean RESTful surface under `/api/v4/`.

**Endpoint Map:**

```
# ─── Orders ──────────────────────────────────────────────
GET    /api/v4/orders                    # List orders (paginated, filtered)
GET    /api/v4/orders/:id                # Get order detail
POST   /api/v4/orders                    # Create manual order
POST   /api/v4/orders/import             # Bulk CSV import
PATCH  /api/v4/orders/:id                # Update order
PATCH  /api/v4/orders/:id/status         # Update order status
PATCH  /api/v4/orders/:id/assign         # Assign driver to order
POST   /api/v4/orders/:id/pod            # Submit proof of delivery
DELETE /api/v4/orders/:id                # Cancel order

# ─── Drivers ─────────────────────────────────────────────
GET    /api/v4/drivers                   # List drivers
GET    /api/v4/drivers/:id               # Get driver detail
POST   /api/v4/drivers                   # Create driver
PATCH  /api/v4/drivers/:id               # Update driver
PATCH  /api/v4/drivers/:id/status        # Update driver availability
POST   /api/v4/drivers/:id/location      # Update driver GPS location
GET    /api/v4/drivers/nearby            # Find nearby available drivers

# ─── Routes ──────────────────────────────────────────────
GET    /api/v4/routes                    # List routes
GET    /api/v4/routes/:id                # Get route with stops
POST   /api/v4/routes                    # Create route (manual)
POST   /api/v4/routes/optimize           # Create optimized route
PATCH  /api/v4/routes/:id                # Update route
PATCH  /api/v4/routes/:id/status         # Update route status
PATCH  /api/v4/routes/:id/stops/:stopId  # Update stop status

# ─── Delivery Zones ─────────────────────────────────────
GET    /api/v4/zones                     # List zones
GET    /api/v4/zones/:id                 # Get zone detail
POST   /api/v4/zones                     # Create zone
PATCH  /api/v4/zones/:id                 # Update zone
DELETE /api/v4/zones/:id                 # Delete zone
POST   /api/v4/zones/lookup              # Find zone for coordinates

# ─── Time Slots ─────────────────────────────────────────
GET    /api/v4/time-slots                # List time slots
POST   /api/v4/time-slots               # Create time slot
PATCH  /api/v4/time-slots/:id           # Update time slot
DELETE /api/v4/time-slots/:id           # Delete time slot
GET    /api/v4/time-slots/availability   # Check slot availability for date

# ─── Carrier Service (Shopify) ──────────────────────────
POST   /api/v4/carriers/rates           # Shopify rate callback (< 500ms)
POST   /api/v4/carriers/register        # Register carrier with Shopify

# ─── Webhooks (Shopify → Witylogix) ────────────────────
POST   /api/v4/webhooks/orders          # Order webhooks
POST   /api/v4/webhooks/products        # Product webhooks
POST   /api/v4/webhooks/customers       # Customer webhooks
POST   /api/v4/webhooks/inventory       # Inventory webhooks
POST   /api/v4/webhooks/app             # App lifecycle webhooks

# ─── Tracking (Public) ─────────────────────────────────
GET    /api/v4/tracking/:token          # Get tracking state (no auth)

# ─── Shop Profile & Settings ────────────────────────────
GET    /api/v4/shops/me                  # Get current shop profile
PATCH  /api/v4/shops/me                  # Update shop settings
GET    /api/v4/shops/me/stats            # Dashboard stats (orders, drivers, zones)
GET    /api/v4/shops/me/routing          # Routing config (registry + tenant state + BYOK)
PATCH  /api/v4/shops/me/routing          # Update tenant provider + credentials (BYOK only)
GET    /api/v4/shops/me/routing/meter    # Routing metering stats (30d fallback usage)

# ─── Settings ────────────────────────────────────────────
GET    /api/v4/settings                  # Get shop settings
PATCH  /api/v4/settings                  # Update shop settings
GET    /api/v4/shops/me/notifications            # Get notification config (per-channel registries + tenant state)
PATCH  /api/v4/shops/me/notifications/:channel  # Update tenant notification credentials per channel (BYOK only)
GET    /api/v4/shops/me/notifications/meter     # Get notification metering stats (deployer fallback usage)

# ─── Auth ────────────────────────────────────────────────
POST   /api/v4/auth/login               # Dashboard user login (email + password → JWT)
POST   /api/v4/auth/driver/login        # Driver app login (phone + password → JWT)
POST   /api/v4/auth/refresh             # Refresh JWT (rotates refresh token)
POST   /api/v4/auth/logout              # Invalidate refresh token
POST   /api/v4/auth/forgot-password     # Request password reset email
POST   /api/v4/auth/reset-password      # Reset password with token

# ─── Users ──────────────────────────────────────────────
GET    /api/v4/users                     # List dashboard users (paginated)
GET    /api/v4/users/me                  # Current user profile + org membership
GET    /api/v4/users/:id                 # Get user detail
POST   /api/v4/users                     # Invite (create) user with role
PATCH  /api/v4/users/:id                 # Update user (name, role, active)
PATCH  /api/v4/users/:id/password        # Change password (admin or self)
DELETE /api/v4/users/:id                 # Deactivate user (soft delete)

# ─── Organizations ──────────────────────────────────────
POST   /api/v4/orgs                      # Create organization
GET    /api/v4/orgs/me                   # Get current org
PATCH  /api/v4/orgs/me                   # Update org settings
GET    /api/v4/orgs/me/shops             # List shops in org
POST   /api/v4/orgs/me/shops             # Link shop to org
DELETE /api/v4/orgs/me/shops/:shopId     # Unlink shop from org
GET    /api/v4/orgs/me/members           # List org members
POST   /api/v4/orgs/me/members           # Invite user to org
PATCH  /api/v4/orgs/me/members/:id       # Update member role/shop access
DELETE /api/v4/orgs/me/members/:id       # Remove member from org
GET    /api/v4/orgs/me/stats             # Cross-shop aggregate stats

# ─── Health ──────────────────────────────────────────────
GET    /health                           # Liveness probe (DB + Redis)
GET    /ready                            # Readiness probe
```

**Key differences from v3:**

V3 has separate webhook server processes per entity type (order-webhook-server, product-webhook-server, customer-webhook-server, inventory-webhook-server), each running on its own port with its own PM2 process. V4 consolidates all webhook handlers into a single Fastify app with route-level separation. The webhook payload is verified by Shopify HMAC middleware and then dispatched to the appropriate BullMQ queue for async processing — the webhook endpoint returns 200 immediately and processing happens in workers.

V3 has `/api/v3/shipment` as the primary delivery management endpoint (distinct from orders). V4 eliminates the shipment abstraction — orders carry delivery status directly. This removes the conceptual overhead of "order → creates shipment → shipment has route" and replaces it with "order → assigned to route → driver delivers."

V3 has `/api/v3/service` as a catch-all for public APIs (mobile app, tracking, plugins). V4 splits these into purpose-specific routes: `/api/v4/auth/driver/*` for driver app auth, `/api/v4/tracking/:token` for public tracking, and the driver location update goes through Socket.io rather than REST.

**Authentication Model:**

```
┌──────────────────┐     ┌───────────────────┐     ┌────────────────┐
│  Shopify Admin   │     │  Dashboard User   │     │  Driver App    │
│  (Embedded App)  │     │  (Direct Login)   │     │  (Mobile)      │
└────────┬─────────┘     └────────┬──────────┘     └───────┬────────┘
         │                        │                        │
    Token Exchange           JWT (email +              JWT (phone +
    (Shopify managed)        password)                 password)
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Fastify Auth Middleware                         │
│                                                                     │
│  1. Extract token from Authorization header                        │
│  2. Verify JWT or Shopify session token                            │
│  3. Extract claims: shopId, orgId?, role, orgRole?, type           │
│  4. Set RLS context based on scope:                                │
│     • Shop-only:  SET LOCAL app.current_shop_id = shopId           │
│     • Shop-in-org: SET BOTH shop_id AND org_id (dual visibility)   │
│     • Org-wide:   SET LOCAL app.current_org_id = orgId             │
│  5. Attach auth context to request (shopId, orgId, role, orgRole)  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Role Enforcement Middleware                      │
│                                                                     │
│  Shop-level: requireRole("SUPER_ADMIN", "ADMIN", ...)              │
│  Org-level:  requireOrgRole("OWNER", "ADMIN", ...)                 │
│                                                                     │
│  Hierarchy: SUPER_ADMIN > ADMIN > DISPATCHER > VIEWER > DRIVER     │
│  Org:       OWNER > ADMIN > MEMBER                                 │
└─────────────────────────────────────────────────────────────────────┘
```

Three auth flows converge at the same middleware. The critical step is #4: setting the RLS context so all downstream database queries are automatically tenant-scoped. When the user belongs to an org, both `app.current_shop_id` and `app.current_org_id` are set so that org-shared resources (drivers, zones) are visible alongside shop-specific data. This replaces the v3 pattern of manually adding `tenant_id` to every Mongoose query.

**JWT Token Claims:**

```json
{
  "sub": "user-uuid",
  "shopId": "shop-uuid",
  "orgId": "org-uuid-or-undefined",
  "role": "ADMIN",
  "orgRole": "MEMBER-or-undefined",
  "type": "user|driver",
  "shopDomain": "store.myshopify.com",
  "exp": 1709740800
}
```

**Refresh Token Flow:** Refresh tokens are stored as SHA-256 hashes in Redis with TTLs (30 days for users, 90 days for drivers). On refresh, the old token is deleted and a new one is issued (rotation). This limits the window of a stolen refresh token.

**Request-Response Contract (example):**

```
POST /api/v4/carriers/rates
Content-Type: application/json
X-Shopify-Hmac-SHA256: {hmac}

Request:
{
  "rate": {
    "origin": { "country": "US", "postal_code": "11201", "city": "Brooklyn" },
    "destination": { "country": "US", "postal_code": "11215", "city": "Brooklyn" },
    "items": [{ "name": "Widget", "quantity": 2, "grams": 500, "price": 2500 }],
    "currency": "USD"
  }
}

Response (< 500ms):
{
  "rates": [
    {
      "service_name": "Standard Delivery",
      "service_code": "STANDARD",
      "total_price": "995",
      "currency": "USD",
      "min_delivery_date": "2026-03-07",
      "max_delivery_date": "2026-03-07"
    },
    {
      "service_name": "Express (2-hour window)",
      "service_code": "EXPRESS_2H",
      "total_price": "1495",
      "currency": "USD",
      "min_delivery_date": "2026-03-06",
      "max_delivery_date": "2026-03-06"
    }
  ]
}
```

### 3.3 Caching Strategy

**V3 approach:** SpeedGoose (Mongoose query cache) + Redis for sessions. Cache invalidation is ad-hoc — some queries are cached, most aren't.

**V4 approach:** Structured, purpose-specific Redis usage with explicit TTLs and invalidation patterns.

```
Redis Key Structure:

tenant:{shopId}:cache:zones              # Delivery zones (TTL: 5min)
tenant:{shopId}:cache:rates:{hash}       # Carrier rate results (TTL: 15min, matches Shopify cache)
tenant:{shopId}:cache:settings           # Shop settings (TTL: 10min)
tenant:{shopId}:cache:slots:{date}       # Time slot availability (TTL: 1min)
tenant:{shopId}:session:{sessionId}      # Shopify session tokens (TTL: 24h)
tenant:{shopId}:driver:{driverId}:token  # Driver refresh tokens (TTL: 7d)

tracking:{trackingToken}                 # Tracking page state (TTL: 2h)
driver:location                          # Redis GEO sorted set (no TTL, updated on each GPS ping)

bull:notifications:{jobId}               # BullMQ notification jobs
bull:webhooks:{jobId}                    # BullMQ webhook processing jobs
```

**Version-based invalidation:** Instead of `SCAN` + `DEL` (expensive on large keyspaces), increment a version counter. Cache keys include the version: `tenant:{shopId}:cache:v{version}:zones`. When zones change, increment the version. Old keys expire naturally via TTL.

**Carrier rate caching is critical for the 500ms target.** The carrier rate endpoint receives origin/destination/items from Shopify. We hash the request into a cache key: `{shop_id}:{origin_zip}_{dest_zip}_{weight_bucket}`. Cache hits return in < 5ms. Cache misses compute the rate (zone lookup + rate calculation) and store for 15 minutes (matching Shopify's own cache TTL).

### 3.4 Queue & Worker Architecture

**V3 approach:** Azure Service Bus with dedicated PM2 processes per webhook entity type (8 separate processes). Each process has its own Express server, its own port, and duplicated bootstrap code.

**V4 approach:** BullMQ with named queues, tenant-aware groups, and a unified worker process.

```
Queues:

webhooks         # Shopify webhook processing
  ├── Group: tenantId (fair round-robin across tenants)
  ├── Jobs: { type: "orders/create", payload: {...}, shopId: "..." }
  ├── Retry: 3 attempts, exponential backoff (1s, 4s, 16s)
  └── Concurrency: 10 per worker

notifications    # Multi-channel notification delivery
  ├── Group: tenantId
  ├── Jobs: { channel: "EMAIL|SMS|WHATSAPP|PUSH", template: "...", data: {...} }
  ├── Rate limit: 100/s email, 10/s SMS, 30/s WhatsApp
  ├── Retry: 3 attempts, then escalate to fallback channel
  └── Concurrency: 5 per worker

optimization     # Route optimization requests
  ├── Jobs: { shopId: "...", orderIds: [...], vehicleIds: [...] }
  ├── Timeout: 60s (solver time limit)
  ├── No retry (optimization is idempotent, user re-triggers)
  └── Concurrency: 2 per worker (CPU-intensive)

sync             # Shopify data sync (bulk operations)
  ├── Jobs: { type: "orders|products|inventory", shopId: "...", cursor: "..." }
  ├── Rate limit: 2/s per shop (Shopify API throttle)
  └── Concurrency: 3 per worker
```

**Worker deployment:** A single worker process (`apps/api/src/workers.ts`) registers handlers for all queues. Scale workers horizontally by running multiple instances — BullMQ handles job distribution via Redis. This replaces v3's 8 separate PM2 processes with one deployable unit that scales to N instances.

**Webhook processing flow:**

```
Shopify ──POST──► /api/v4/webhooks/orders
                       │
                  Verify HMAC signature
                       │
                  Return 200 immediately
                       │
                  Add job to "webhooks" queue
                       │
                       ▼
              BullMQ Worker picks up job
                       │
                  Set RLS context for shop_id
                       │
                  Process based on topic:
                  ├── orders/create → Persist order, match zone, queue notification
                  ├── orders/update → Update order fields
                  ├── orders/cancelled → Cancel order, release route slot
                  └── orders/fulfilled → (external fulfillment, update status)
```

This is the critical architectural difference from v3: **webhook endpoints are thin dispatchers, not processors.** V3's webhook servers do synchronous processing inline, which means slow webhooks block subsequent ones and a crash loses in-flight data. V4's workers process from a durable Redis-backed queue with automatic retries.

### 3.5 Real-time Architecture

```
┌──────────────┐         ┌───────────────┐         ┌──────────────┐
│  Driver App  │         │   Fastify +   │         │  Tracking    │
│  (RN + BG    │         │   Socket.io   │         │  Page        │
│  Geolocation)│         │   Server      │         │  (Customer)  │
└──────┬───────┘         └───────┬───────┘         └──────┬───────┘
       │                         │                        │
       │  1. Connect (JWT auth)  │                        │
       │ ───────────────────────►│                        │
       │                         │                        │
       │  2. Join room:          │                        │
       │  tenant:{shopId}:driver │  3. Connect (token)    │
       │ ───────────────────────►│◄────────────────────── │
       │                         │                        │
       │                         │  4. Join room:         │
       │                         │  delivery:{trackToken} │
       │                         │◄────────────────────── │
       │                         │                        │
       │  5. location:update     │                        │
       │  {lat, lng, heading,    │                        │
       │   speed, accuracy, ts}  │                        │
       │ ───────────────────────►│                        │
       │                         │                        │
       │                  ┌──────┴──────┐                 │
       │                  │  Process:   │                 │
       │                  │             │                 │
       │                  │  a. Redis   │                 │
       │                  │   GEO update│                 │
       │                  │  b. Redis   │                 │
       │                  │   Stream    │                 │
       │                  │   append    │                 │
       │                  │  c. ETA     │                 │
       │                  │   recalc    │                 │
       │                  └──────┬──────┘                 │
       │                         │                        │
       │                         │  6. delivery:update    │
       │                         │  {driverLoc, eta,      │
       │                         │   routeGeometry}       │
       │                         │ ──────────────────────►│
       │                         │                        │
```

**Socket.io Namespace & Room Design:**

```
Namespace: /admin
  Room: tenant:{shopId}           # Dashboard real-time updates
    Events: order:created, order:status, driver:location, route:status

Namespace: /driver
  Room: tenant:{shopId}:driver    # Driver-to-server communication
    Events: location:update, route:update, stop:status

Namespace: /tracking
  Room: delivery:{trackingToken}  # Customer tracking page
    Events: delivery:update, delivery:status
```

**Redis Adapter** (`@socket.io/redis-adapter`) enables broadcasting across multiple Socket.io server instances. When the API runs behind a load balancer (horizontal scaling), the Redis adapter ensures a delivery update published on server A reaches customers connected to server B.

**V3 used Firebase Realtime Database for push updates.** V4 replaces this with Socket.io over WebSockets, which eliminates the Firebase dependency, gives full control over the message format, and allows the tracking page to work without any Firebase SDK (smaller bundle, faster load).

### 3.6 Error Handling and Retry Logic

**API error responses** follow a consistent envelope:

```json
{
  "statusCode": 422,
  "error": "Validation Error",
  "message": "Invalid delivery zone coordinates",
  "details": [
    { "field": "boundary[2].latitude", "message": "Must be between -90 and 90" }
  ]
}
```

**Webhook retry policy:** Shopify retries failed webhooks up to 19 times over 48 hours. Our webhook endpoint must return 2xx quickly (within 5 seconds) even if processing will take longer. The BullMQ queue handles the actual processing with its own retry policy (3 attempts, exponential backoff). If a webhook endpoint returns 5xx, Shopify will retry — but since we enqueue before responding, this creates duplicate jobs. The worker deduplicates by `(shop_id, shopify_order_id, webhook_topic, shopify_webhook_id)`.

**Notification fallback chain:**

```
Primary channel attempt (3 tries with backoff)
         │
    Failed after 3?
         │
         ▼
Escalate to fallback channel:
  EMAIL fails → try SMS
  SMS fails   → try WHATSAPP
  WHATSAPP fails → try EMAIL
  All fail    → log as FAILED, alert merchant in dashboard
```

**Circuit breaker for carrier service:** If the rate calculation depends on an external service (Mapbox geocoding for zone matching), a circuit breaker trips after 5 consecutive failures. While open, the carrier endpoint returns pre-computed fallback rates from Redis cache rather than returning an error to Shopify (which would show "shipping unavailable" at checkout).

---

## 4. Scale and Reliability

### 4.1 Load Estimation

**Target: 1,000 tenants, top-10 processing 10K orders/day each**

| Metric | Estimate | Source |
|--------|----------|--------|
| Webhook events/day | ~200K (orders, products, inventory) | 1000 tenants × 200 avg events |
| Carrier rate requests/day | ~50K | 10% of checkouts request rates |
| Carrier rate p95 target | < 500ms | Shopify BFS requirement |
| GPS updates/second (peak) | ~500 | 100 active drivers × 5 updates/s |
| Socket.io connections (peak) | ~2,000 | Drivers + tracking pages + dashboards |
| Database queries/second | ~1,000 | CRUD + spatial queries |
| BullMQ jobs/day | ~300K | Webhooks + notifications + sync |

### 4.2 Scaling Strategy

```
                    ┌─────────────────────────────┐
                    │        Load Balancer         │
                    │  (sticky sessions for WS)    │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │  API #1  │    │  API #2  │    │  API #3  │
        │(stateless│    │(stateless│    │(stateless│
        │ Fastify) │    │ Fastify) │    │ Fastify) │
        └────┬─────┘    └────┬─────┘    └────┬─────┘
             │               │               │
             └───────────────┼───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │ Worker #1│        │ Worker #2│        │ Worker #3│
  │(webhooks │        │(webhooks │        │(notifs   │
  │ + notifs)│        │ + notifs)│        │ + sync)  │
  └────┬─────┘        └────┬─────┘        └────┬─────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
              ┌────────────┼────────────────┐
              ▼            ▼                ▼
        ┌──────────┐ ┌──────────┐    ┌──────────┐
        │PostgreSQL│ │  Redis   │    │  Mapbox   │
        │ Primary  │ │  (single │    │   API     │
        │ + Read   │ │  or      │    │(Phase 1)  │
        │ Replicas │ │  Cluster)│    └──────────┘
        └──────────┘ └──────────┘
```

**Stateless API servers** scale horizontally behind a load balancer. Sticky sessions (IP hash or cookie) are needed for Socket.io WebSocket connections. The Redis adapter handles cross-server broadcasting.

**Stateless workers** scale independently based on queue depth. Monitor `bullmq:queue:waiting` gauge — auto-scale workers when waiting jobs exceed threshold. Workers are identical; each processes jobs from all queues.

**PostgreSQL scaling path:**

1. **Single instance** (MVP, < 100 tenants): Adequate for early growth
2. **Read replicas** (100-1000 tenants): Route read-heavy queries (order lists, analytics) to replicas
3. **Connection pooling** (PgBouncer): Share connections across API instances, use `SET LOCAL` for RLS context (transaction-mode pooling)

**Redis scaling path:**

1. **Single instance** (MVP): 256MB is sufficient for cache + pub/sub + GEO
2. **Redis Cluster** (1000+ tenants): Shard by key prefix, ensures tenant data locality

### 4.3 Failover and Redundancy

**Database:** PostgreSQL streaming replication with automatic failover via Patroni (self-hosted) or managed HA (AWS RDS, Azure Flexible Server). WAL archiving to S3 for point-in-time recovery.

**Redis:** Redis Sentinel for HA with automatic failover. BullMQ is resilient to Redis restarts — jobs are persisted and resumed. Socket.io connections reconnect automatically.

**API servers:** Health check endpoint `/health` verifies PostgreSQL (`SELECT 1`) and Redis (`PING`). Kubernetes liveness probe restarts unhealthy pods. Readiness probe returns 503 on SIGTERM to drain connections during graceful shutdown.

**Carrier service resilience:** The carrier rate endpoint is the most availability-critical path (99.9% over 28 days = ~43 minutes downtime/month). Strategies:

- Pre-compute and cache rates for common origin-destination pairs
- Circuit breaker on external dependencies (routing provider)
- Fallback to flat-rate backup rates if zone lookup or calculation fails
- Deploy in the same region as Shopify infrastructure (us-east-1) to minimize network latency

### 4.4 Monitoring and Alerting

```
Application Metrics (Pino + Prometheus):
  ├── http_request_duration_seconds{route, method, status}
  ├── carrier_rate_duration_seconds{shop_id}     # p95 target: < 500ms
  ├── websocket_connections_total{namespace}
  ├── bullmq_jobs_waiting{queue}
  ├── bullmq_jobs_failed{queue}
  ├── database_query_duration_seconds{operation}
  └── routing_provider_duration_seconds{provider}

Infrastructure Metrics:
  ├── PostgreSQL: connections, query time, replication lag, disk usage
  ├── Redis: memory usage, connected clients, pub/sub channels
  └── OSRM: memory usage, request latency (Phase 2)

Alerts:
  ├── carrier_rate_p95 > 400ms           → Warning (approaching 500ms limit)
  ├── carrier_rate_p95 > 500ms           → Critical (BFS violation)
  ├── carrier_rate_error_rate > 0.1%     → Critical (approaching 99.9% target)
  ├── bullmq_jobs_waiting > 10000        → Warning (worker capacity)
  ├── bullmq_jobs_failed_rate > 5%       → Critical (processing errors)
  ├── postgres_replication_lag > 10s     → Warning (read replica stale)
  └── redis_memory_usage > 80%          → Warning (approaching eviction)
```

---

## 5. Trade-off Analysis

### 5.1 Decisions and Their Costs

| Decision | Benefit | Cost | Revisit When |
|----------|---------|------|-------------|
| **PostgreSQL RLS over app-layer filtering** | Database-enforced tenant isolation; eliminates data leakage bugs | ~5% query overhead; more complex local development setup | Never — this is the security foundation |
| **Orders absorb shipments** | Simpler data model; fewer joins; clearer mental model | Less flexible for multi-shipment-per-order scenarios | If merchants need split shipments from a single order |
| **Multi-provider routing registry** | Tenants and deployers choose from Mapbox, OSRM, Google Maps, HERE, GraphHopper, TomTom; no vendor lock-in | Must maintain provider implementations one-by-one; more testing surface | If a single provider covers 100% of use cases — simplify to one |
| **BYOK with metered fallback (routing)** | Deployer sets default; tenants bring their own routing provider + credentials; fallback usage is metered for billing | Tenants must manage their own accounts; metering table grows with usage | If all tenants are internal (single-deployer) — just use platform-managed mode |
| **Multi-provider notification registry** | 4 independent channel registries (17 providers total); tenants choose per-channel providers | More testing surface; each provider SDK added one-by-one | If one provider per channel covers 100% of use cases |
| **BYOK with metered fallback (notifications)** | Same pattern as routing: deployer defaults + tenant overrides + metering; per-channel independence | Complexity of per-channel config; credential management UX | If notifications are always deployer-managed |
| **BullMQ over Azure Service Bus** | Open-source; Redis-native; no Azure dependency for self-hosters | Less mature than Service Bus; no built-in DLQ viewer (need Bull Board) | If message durability becomes critical (financial transactions) |
| **Socket.io over Firebase Realtime DB** | No Firebase dependency; smaller tracking page bundle; full control | Must manage WebSocket infrastructure; needs Redis Adapter for multi-server | If connection count exceeds 10K and managed WebSocket becomes attractive |
| **Single API process over separate webhook processes** | Shared code; simpler deployment; one Dockerfile | Single point of failure; one bad handler can affect others | If webhook processing becomes CPU-intensive enough to warrant isolation |
| **JSONB settings over normalized tables** | Schema flexibility; no migration needed for new merchant settings | Harder to query across tenants; no foreign key constraints on nested data | If cross-tenant analytics on settings become important |
| **Not storing Shopify products/customers locally** | No sync complexity; always-fresh data; less storage | Requires Shopify API calls for product/customer data; rate limit risk | If dashboard needs fast product/customer search or if API rate limits hit |

### 5.2 What We Explicitly Chose NOT to Build (Phase 1)

- **Payment/COD tracking** — v3 has codPaymentGateway, paymentGateways, shipmentPaymentTransactions. Removed for Phase 1 to simplify. Add when merchants request it.
- **Analytics pipeline** — v3 has a dedicated analytics queue server. Phase 1 logs events to Redis Streams; a proper analytics stack (ClickHouse, Cube.js) is Phase 2.
- **Campaign management** — v3 has campaign models. Not relevant for open-source MVP.
- **Super admin panel** — v3 has `/api/v3/super-admin` for multi-tenant administration. Phase 1 manages tenants via direct database access; admin UI is Phase 2.
- **Shopify Functions** — v3 supports delivery customization, cart validation, payment customization, fulfillment routing functions. Complex to build and test. Phase 2.
- **14-language i18n** — v3 supports 14 languages. Phase 1 ships English-only; i18n infrastructure (i18next or Shopify's built-in localization) is Phase 2.
- **Theme script injection** — v3 injects storefront scripts for zoom/widgets. Replaced by Theme App Extensions in the new Shopify ecosystem.

---

## 6. Migration Strategy (v3 → v4)

### 6.1 Parallel Operation

V3 and v4 run simultaneously. A shop can be on v3 or v4, not both. Migration is per-tenant:

```
1. Deploy v4 alongside v3 (separate infrastructure)
2. Create tenant in v4 PostgreSQL
3. Run data migration script: MongoDB → PostgreSQL for that tenant
4. Verify data integrity (order counts, zone shapes, driver records)
5. Update Shopify app to point webhooks to v4 endpoints
6. Switch carrier service callback URL to v4
7. Monitor for 48 hours
8. Decommission v3 for that tenant
```

### 6.2 Data Migration Approach

A dedicated migration script reads from MongoDB and writes to PostgreSQL via Prisma, handling:

- **Schema transformation:** Flatten nested Mongoose documents into relational columns
- **Coordinate conversion:** Extract lat/lng from MongoDB and create PostGIS points
- **Zone polygon conversion:** Convert v3 rule-based zones (zip code lists, radius) to PostGIS polygons where possible; flag complex rules for manual review
- **ID mapping:** Generate new UUIDs for PostgreSQL; maintain a mapping table for cross-reference during transition
- **Incremental sync:** After initial migration, a change stream on MongoDB pushes deltas to PostgreSQL until cutover

---

## 7. Development Phases

### Phase 1 — MVP (Months 1-4)

Core delivery management with Shopify integration:

- Fastify API with Prisma + RLS
- Shopify embedded app (React Router v7 + Polaris WC)
- Order management (webhook ingestion, CRUD, status workflow)
- Delivery zones (PostGIS polygon editor)
- Driver management (CRUD, assignment)
- Route creation (manual + basic optimization via Mapbox)
- Carrier Service API (zone-based rate calculation)
- Real-time tracking (Socket.io + Leaflet)
- Driver app (GPS tracking, stop workflow, POD capture)
- Email notifications (SendGrid SDK integration)
- Docker Compose deployment
- BFS certification submission

### Phase 2 — Scale (Months 5-7)

Advanced optimization and multi-channel:

- OSRM self-hosted routing (swap provider)
- Route optimization (VRP solver — evaluate JS-native solvers before Python)
- SMS and WhatsApp provider implementations (Twilio, Meta Cloud API SDKs)
- Time slot management with capacity
- Preact checkout extension (date/time picker)
- Analytics dashboard
- Bulk operations (batch assign, batch optimize)
- Super admin panel

### Phase 3 — Enterprise (Months 8+)

Enterprise features for commercial tier:

- SSO/SAML authentication
- Audit logging
- White-label branding
- Advanced analytics (ClickHouse + Cube.js)
- Shopify Functions integration
- Internationalization (i18n)
- Kubernetes deployment manifests
- API rate limiting per plan tier
- Webhook management UI
