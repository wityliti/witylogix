# ADR-001: Platform Rewrite — Technology Stack Selection

**Status:** Proposed
**Date:** 2026-03-06
**Deciders:** Witylogix Engineering Team

## Context

The existing Witylogix Last Mile Delivery OMS (lmd-oms-v3) is a monolithic Node.js/Express backend with a Next.js 14 frontend, using MongoDB (Mongoose), Redis, and Shopify REST/GraphQL APIs. The platform has grown organically and faces several pressures:

1. **Shopify ecosystem shift (2025-10):** React Router v7 replaces Remix, Polaris Web Components replace Polaris React, Preact replaces React for UI extensions, and REST client support is removed from the new `@shopify/shopify-app-react-router` package.
2. **Multi-tenancy gaps:** Current tenant isolation relies entirely on application-layer `shop_id` filtering in MongoDB queries — no database-enforced isolation.
3. **Scaling bottleneck:** The monolithic backend runs 8+ separate PM2 processes (API, mapbox, webhooks per entity type) that share no code and are deployed/restarted individually.
4. **Open-source ambition:** The team wants to release an AGPL-3.0 open-core version to compete with proprietary last-mile SaaS platforms and attract community contributors.
5. **Route optimization cost:** Dependence on Google Maps APIs creates per-request charges that scale linearly with order volume, eroding margins for high-volume merchants.

## Decision

Rewrite the platform as a **Turborepo monorepo** with the following technology choices:

| Layer | Current (v3) | New (v4) |
|-------|-------------|----------|
| **Monorepo** | None (2 separate repos) | Turborepo + pnpm workspaces |
| **Backend Framework** | Express 5 | Fastify 5 |
| **Database** | MongoDB (Mongoose) | PostgreSQL 16 + PostGIS + Prisma |
| **Tenant Isolation** | App-layer query filters | PostgreSQL Row-Level Security (RLS) |
| **Cache / Pub-Sub** | Redis 4 | Redis 7 (Streams + GEO + Pub/Sub) |
| **Job Queue** | Bull | BullMQ (with tenant-aware groups) |
| **Shopify App Framework** | Custom Express + App Bridge v3 | React Router v7 + `@shopify/shopify-app-react-router` |
| **UI Components** | Polaris React v12 | Polaris Web Components (`s-*`) |
| **Extensions** | None | Preact checkout/POS extensions |
| **Route Optimization** | Google Maps API | Phase 1: Mapbox → Phase 2: OSRM + OR-Tools (behind provider abstraction) |
| **Real-time Tracking** | Firebase | Socket.io + Redis Adapter |
| **Mobile (Driver)** | React Native (basic) | React Native + background geolocation |
| **Deployment** | PM2 on Azure VM | Docker Compose (self-hosted) / K8s (cloud) |
| **License** | Proprietary | AGPL-3.0 open-core |

## Options Considered

### Option A: Incremental Migration (Evolve v3 in place)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Low initial, high ongoing |
| Scalability | Limited by MongoDB schema |
| Team familiarity | High |
| Time to market | 2-3 months per module |

**Pros:**
- No big-bang rewrite risk
- Existing features stay live during migration
- Team already knows the codebase

**Cons:**
- MongoDB cannot enforce row-level security; tenant isolation remains app-layer only
- Shopify's framework shift (RR v7, Polaris WC, Preact) requires rewriting the frontend anyway
- Two-repo structure prevents code sharing between backend services
- Cannot adopt PostGIS for spatial delivery zone queries without a database migration
- Technical debt compounds — 8 separate PM2 processes with duplicated bootstrap code

### Option B: Full Rewrite with Modern Stack (Selected)

| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Cost | High initial, low ongoing |
| Scalability | Excellent (RLS, horizontal scaling, OSRM) |
| Team familiarity | Medium (Prisma, Fastify, RR v7 are new) |
| Time to market | 4-6 months for MVP |

**Pros:**
- PostgreSQL RLS provides database-enforced tenant isolation — eliminates an entire category of data leakage bugs
- PostGIS enables native spatial queries for delivery zones, driver proximity, and geofencing
- Turborepo monorepo shares types, validators, and business logic across all apps
- Aligns with Shopify's 2025-10 platform direction (React Router v7, Polaris WC, Preact)
- Self-hosted OSRM eliminates per-request routing costs
- Docker Compose deployment makes self-hosting accessible for open-source adopters
- AGPL-3.0 attracts contributors while protecting against SaaS free-riders

**Cons:**
- 4-6 month development investment before feature parity
- Team needs to learn Prisma, Fastify, PostgreSQL RLS, and OR-Tools
- Migration of existing MongoDB data to PostgreSQL requires careful planning
- Temporary feature freeze on v3 during transition

### Option C: Managed Platform (Shopify Flow + third-party logistics)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | High per-transaction fees |
| Scalability | Vendor-dependent |
| Team familiarity | Low |
| Time to market | 1-2 months |

**Pros:**
- Fastest time to market
- No infrastructure to manage

**Cons:**
- Vendor lock-in; no differentiation
- Per-transaction pricing destroys margins at scale
- Cannot customize route optimization or driver workflows
- Cannot open-source; no community building
- Does not leverage the team's existing domain expertise

## Trade-off Analysis

The central trade-off is **development time vs. architectural correctness**. Option B requires 4-6 months but produces a platform that can scale to thousands of tenants with database-enforced isolation, eliminates routing API costs, and aligns with Shopify's latest framework. Option A is faster initially but accumulates technical debt that becomes increasingly expensive — the Shopify framework migration alone would require rewriting the entire frontend.

The PostgreSQL-over-MongoDB decision deserves special attention: MongoDB's flexible schema was valuable during rapid prototyping, but the platform has matured. Delivery logistics is inherently relational (orders belong to routes, routes have stops, stops have proof-of-delivery). PostGIS spatial queries (`ST_Contains` for zone matching, `ST_DWithin` for driver proximity) replace application-level haversine calculations with indexed database operations.

The routing provider strategy uses a **phased approach**: Phase 1 retains Mapbox (familiar from v3, proven in production) behind a `RoutingProvider` abstraction interface. Phase 2 swaps in self-hosted OSRM for zero marginal cost. The abstraction ensures business logic never imports Mapbox or OSRM directly — only the provider interface. This eliminates migration risk while preserving the long-term cost savings of OSRM.

## Consequences

**What becomes easier:**
- Adding new tenant-scoped features (RLS enforces isolation automatically)
- Spatial queries for zones, proximity, and geofencing (PostGIS)
- Sharing code between apps (Turborepo workspaces)
- Self-hosted deployment for open-source users (Docker Compose)
- Meeting Shopify "Built for Shopify" certification requirements
- Scaling horizontally (stateless API + stateless workers)

**What becomes harder:**
- Onboarding new developers (larger technology surface area)
- Debugging cross-package issues in the monorepo
- Managing PostgreSQL migrations vs. MongoDB's schema flexibility
- Running OSRM (memory-intensive for large regions)

**What we'll need to revisit:**
- Data migration strategy from MongoDB to PostgreSQL (separate ADR)
- OSRM region selection and memory requirements per deployment size
- BullMQ Pro licensing if free-tier tenant fairness proves insufficient
- Kubernetes deployment configuration when scaling beyond single-node Docker Compose
- OR-Tools solver tuning as delivery volumes and constraint complexity grow

## Action Items

1. [ ] Create Turborepo monorepo with workspace configuration
2. [ ] Define Prisma schema with RLS policies for all tenant-scoped tables
3. [ ] Set up Docker Compose for local development (PostGIS, Redis, OSRM)
4. [ ] Scaffold Fastify API with tenant middleware and Prisma RLS extension
5. [ ] Initialize React Router v7 Shopify app with Polaris Web Components
6. [ ] Build Preact checkout UI extension within 64KB budget
7. [ ] Implement RoutingProvider abstraction with MapboxProvider (Phase 1)
8. [ ] [Phase 2] Set up OSRM Docker container + OR-Tools solver to replace Mapbox
9. [ ] Design MongoDB-to-PostgreSQL data migration pipeline
10. [ ] Draft CONTRIBUTING.md with DCO sign-off and ADR process
11. [ ] Set up CI/CD pipeline (GitHub Actions) for monorepo builds
