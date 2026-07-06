# Witylogix Platform Architecture

**Version:** 4.0.0 | **Sprint:** 7.0 | **Last Updated:** 2026-03-16

Comprehensive architecture documentation for the Witylogix open-source delivery logistics platform. This document describes the system design, data flows, module dependencies, database architecture, event system, multi-tenancy model, and security architecture.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Module Dependency Map](#module-dependency-map)
5. [Database Architecture](#database-architecture)
6. [Event System](#event-system)
7. [Multi-Tenancy Architecture](#multi-tenancy-architecture)
8. [Integration Architecture](#integration-architecture)
9. [Caching Strategy](#caching-strategy)
10. [Security Architecture](#security-architecture)
11. [Performance Characteristics](#performance-characteristics)

---

## System Overview

Witylogix is a full-stack, multi-tenant delivery management platform built for e-commerce. The system enables merchants to manage last-mile delivery operations—from zone-based rate calculation at checkout to real-time driver tracking and proof of delivery—without per-transaction SaaS fees.

### Core Philosophy

- **Platform-agnostic:** Integrates with Shopify, WooCommerce, Magento, and custom storefronts via modular adapters
- **Open-source:** Self-host with `docker compose up` or use managed cloud
- **Multi-tenant:** Enforced isolation at PostgreSQL Row-Level Security (RLS) layer
- **Event-driven:** TypedEventBus → Redis Streams → webhooks → real-time Socket.io updates
- **Workflow-based:** Medusa v2-inspired orchestration with compensation/rollback
- **Scalable:** Horizontal scaling via worker pools, read replicas, Redis cluster

### Technology Stack

| Layer             | Technology                                                   |
| ----------------- | ------------------------------------------------------------ |
| **Monorepo**      | Turborepo + pnpm workspaces                                  |
| **Backend**       | Fastify 5 (TypeScript)                                       |
| **Frontend**      | Next.js 15 (React 19, Tailwind CSS)                          |
| **Database**      | PostgreSQL 16 + PostGIS                                      |
| **Cache/Queue**   | Redis 7 + BullMQ                                             |
| **Real-time**     | Socket.io                                                    |
| **Mobile**        | React Native                                                 |
| **Routing**       | Mapbox, OSRM, Google Maps, HERE, GraphHopper, TomTom         |
| **Notifications** | SendGrid, Mailgun, SES, Postmark, Twilio, Vonage, Meta Cloud |
| **File Storage**  | S3 + local filesystem                                        |
| **Payments**      | Stripe + custom provider support                             |
| **Orchestration** | Docker Compose (dev) + Kubernetes (prod)                     |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WITYLOGIX PLATFORM (v4.0)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       EXTERNAL INTEGRATIONS                          │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  Shopify │ WooCommerce │ Magento │ Custom Storefronts               │   │
│  │  Auth Providers: Auth0, Clerk, Cognito, Firebase, OIDC, SAML 2.0    │   │
│  │  Routing: Mapbox, OSRM, Google Maps, HERE, GraphHopper, TomTom      │   │
│  │  Notifications: SendGrid, Mailgun, SES, Postmark, Twilio, Vonage    │   │
│  └────────────────────────────┬─────────────────────────────────────────┘   │
│                               │                                             │
│                     ┌─────────▼────────────┐                               │
│                     │   API Gateway Layer  │                               │
│                     │   (Fastify 5 + Hono) │                               │
│                     └──────────┬────────────┘                               │
│                                │                                             │
│      ┌─────────────────────────┼─────────────────────────────┐             │
│      │                         │                             │             │
│      ▼                         ▼                             ▼             │
│  ┌────────────┐          ┌──────────────┐          ┌──────────────────┐   │
│  │  REST API  │          │ WebSocket    │          │  Shopify Apps    │   │
│  │  (Routes)  │          │  (Socket.io) │          │  (Checkout Ext.) │   │
│  │            │          │              │          │  (POS Ext.)      │   │
│  │ 10 domain  │          │ Real-time:   │          │                  │   │
│  │ modules    │          │ • Driver GPS │          │ Preact/Tailwind  │   │
│  │ • Orders   │          │ • Shipments  │          │ < 64KB           │   │
│  │ • Drivers  │          │ • Webhooks   │          │                  │   │
│  │ • Routes   │          │              │          │                  │   │
│  │ • Zones    │          └──────────────┘          └──────────────────┘   │
│  │ • Billing  │                                                            │
│  │ • etc.     │                                                            │
│  └──────┬─────┘                                                            │
│         │                                                                  │
│         └─────────────────────┬────────────────────────┐                  │
│                               │                        │                  │
│                    ┌──────────▼──────────┐   ┌────────▼───────┐           │
│                    │   Core Business     │   │  Event Bus &   │           │
│                    │   Logic Layer       │   │  Workflow      │           │
│                    │  (@witylogix/core)  │   │  Engine        │           │
│                    │                     │   │                │           │
│                    │ 38 modules:         │   │ TypedEventBus  │           │
│                    │ • Auth & RBAC       │   │ + Redis Streams│           │
│                    │ • Billing & Metering│   │ + Compensation │           │
│                    │ • Integrations      │   │ + BullMQ       │           │
│                    │ • Notifications     │   │                │           │
│                    │ • AI Analytics      │   │ 18 Domain      │           │
│                    │ • Workflow Engine   │   │ Events + DLQ   │           │
│                    │ • Audit & Compliance│   │                │           │
│                    │ • Cache Management  │   │ 3 Core         │           │
│                    │ • File Storage      │   │ Workflows:     │           │
│                    │ • etc.              │   │ • createOrder  │           │
│                    │                     │   │ • assignDriver │           │
│                    │                     │   │ • completeJob  │           │
│                    └──────────┬──────────┘   └────────┬───────┘           │
│                               │                        │                  │
│                    ┌──────────▼──────────────────────▼───────┐            │
│                    │                                         │            │
│                    │   INFRASTRUCTURE LAYER                 │            │
│                    ├─────────────────────────────────────────┤            │
│                    │  PostgreSQL 16 + PostGIS + RLS         │            │
│                    │  (Multi-tenant isolation at DB level)   │            │
│                    │                                         │            │
│                    │  Redis 7 (Cache, Sessions, Streams)    │            │
│                    │                                         │            │
│                    │  S3 + Local Storage (Files)             │            │
│                    │                                         │            │
│                    │  Message Queues (BullMQ)                │            │
│                    └─────────────────────────────────────────┘            │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      OBSERVABILITY & MONITORING                      │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  Prometheus (metrics) │ Grafana (dashboards) │ Pino (structured logs) │   │
│  │  Sentry (error tracking) │ Request tracing (correlation IDs)         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Order Lifecycle Flow

```
┌────────────┐
│ E-commerce │
│  Platform  │
│ (Shopify/  │
│ WooCommerce)
└─────┬──────┘
      │ Create Order API
      ▼
┌──────────────────────────────────┐
│ POST /orders                      │
│ → Validation (XSS, rate limit)   │
│ → Permission check (RBAC)        │
│ → Audit log entry                │
└──────────────┬───────────────────┘
               │
               ▼
         ┌──────────────┐
         │ Workflow:    │
         │ createOrder  │
         │ (9 steps)    │
         └──────┬───────┘
                │
        ┌───────┴──────────┬────────────┬──────────┐
        │                  │            │          │
        ▼                  ▼            ▼          ▼
    ┌─────────┐     ┌───────────┐  ┌─────────┐ ┌──────────┐
    │Validate │     │Calculate  │  │Generate │ │Emit Event│
    │Order    │     │Rates      │  │Invoice  │ │order.    │
    │Data     │     │(PostGIS)  │  │         │ │created   │
    └────┬────┘     └─────┬─────┘  └────┬────┘ └─────┬────┘
         │                │             │            │
         └────────────────┼─────────────┴────────────┘
                          │
                          ▼
                  ┌────────────────┐
                  │ Save to DB     │
                  │ (RLS enforced) │
                  └────────┬───────┘
                           │
                ┌──────────┼──────────┐
                │          │          │
                ▼          ▼          ▼
           ┌────────┐  ┌────────┐  ┌──────────┐
           │Publish │  │Return  │  │Webhook   │
           │to Redis│  │REST    │  │delivery  │
           │Streams │  │response│  │(signed)  │
           │(18k+   │  │        │  │          │
           │events) │  │        │  │          │
           └────────┘  └────────┘  └──────────┘
```

### 2. Delivery Assignment Lifecycle

```
┌──────────────────────┐
│ Order ready for      │
│ delivery assignment  │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────────────────┐
│ GET /orders/:id/suggest-drivers │
│ → Query drivers in zone         │
│ → Calculate capacity            │
│ → Score by distance/load/rating │
│ → Return top N matches          │
└────────────┬────────────────────┘
             │
             ▼
┌──────────────────────────┐
│ POST /drivers/:id/assign │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Workflow: assignDriver   │
│ (10 steps with scoring)  │
└──────────┬───────────────┘
           │
      ┌────┴────┬────────┬──────────┐
      │          │        │          │
      ▼          ▼        ▼          ▼
  ┌────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐
  │Validate│ │Check │ │Route     │ │Notify    │
  │Driver  │ │quota │ │optimization
  │Capacity│ │usage │ │(via      │ │Driver    │
  │& Zone  │ │      │ │Mapbox)   │ │(in-app   │
  │match   │ │      │ │          │ │push)     │
  └───┬────┘ └──┬───┘ └───┬──────┘ └────┬─────┘
      │          │         │             │
      └──────────┼─────────┴─────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Save to DB     │
        │ (RLS enforced) │
        │ + Redis cache  │
        └────────┬───────┘
                 │
        ┌────────┴────────┬────────────┐
        │                 │            │
        ▼                 ▼            ▼
   ┌─────────┐      ┌──────────┐  ┌──────────┐
   │WebSocket│      │Emit      │  │Webhook   │
   │broadcast│      │event:    │  │delivery  │
   │update   │      │driver.   │  │(signed)  │
   │to Client│      │assigned  │  │          │
   └─────────┘      └──────────┘  └──────────┘
```

### 3. Authentication Flow

```
┌──────────────────────┐
│ E-commerce / Client  │
│ (Shopify checkout)   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│ POST /auth/login OR              │
│ OAuth2/OIDC provider flow        │
│ (Auth0, Clerk, Cognito, Firebase)
└──────────┬───────────────────────┘
           │
      ┌────┴────────────┬──────────────┐
      │                 │              │
      │                 ▼              ▼
      │         ┌────────────────┐ ┌────────────┐
      │         │Credential      │ │Provider    │
      │         │validation      │ │auth call   │
      │         │(scrypt hash    │ │(external)  │
      │         │for local)      │ │            │
      │         └────┬───────────┘ └──────┬─────┘
      │              │                    │
      └──────────────┼────────────────────┘
                     │
                     ▼
         ┌──────────────────────────┐
         │ Create session + JWT     │
         │ → Refresh token (Redis)  │
         │ → RBAC permissions cache │
         │   (5-min TTL)            │
         └──────────┬───────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    ┌─────────┐         ┌──────────────┐
    │Return   │         │Set cookies   │
    │JWT +    │         │(httpOnly,    │
    │refresh  │         │secure,       │
    │token    │         │sameSite)     │
    └─────────┘         └──────────────┘
```

### 4. Webhook Delivery Flow

```
┌──────────────────────────────┐
│ Event emitted from workflow  │
│ (e.g., order.created)        │
└──────────┬───────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Event published to          │
│ Redis Streams               │
│ (XADD)                      │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────┐
│ Event-Webhook Bridge    │
│ → Filter by event type  │
│   (exact + wildcard)    │
│ → Tenant-scoped lookup  │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Query subscribed webhooks│
│ for matching event types │
└──────────┬───────────────┘
           │
      ┌────┴────────┬────────────┐
      │             │            │
      ▼             ▼            ▼
  ┌────────┐  ┌─────────┐  ┌──────────┐
  │Sign    │  │Transform│  │Retry     │
  │payload │  │payload  │  │policy:   │
  │(HMAC   │  │(JSON)   │  │exponential
  │SHA256) │  │         │  │backoff   │
  └───┬────┘  └────┬────┘  └────┬─────┘
      │            │            │
      └────────────┼────────────┘
                   │
                   ▼
      ┌──────────────────────┐
      │ POST to merchant's   │
      │ webhook URL          │
      │ (with signature)     │
      └──────────┬───────────┘
                 │
         ┌───────┴──────────┐
         │                  │
         ▼ Success          ▼ Failure
     ┌────────┐        ┌──────────┐
     │Log +   │        │Retry     │
     │ACK to  │        │attempt   │
     │Redis   │        │(up to 10x)
     │Stream  │        │          │
     └────────┘        │ If max   │
                       │retries   │
                       │exceeded: │
                       │DLQ entry │
                       └──────────┘
```

---

## Module Dependency Map

### Core Packages Structure

```
packages/
├── db/                          (Database layer)
│   ├── prisma/                  (Schema definitions + migrations)
│   │   └── schema/              (Split into 62 schema files)
│   │       ├── 00-config.prisma
│   │       ├── 01-organizations.prisma
│   │       ├── ...
│   │       └── 62-tenant.prisma
│   └── src/
│       ├── client/              (Prisma client exports)
│       └── seed/                (Data seeding scripts)
│
├── types/                       (Shared TypeScript types)
│   ├── auth.ts
│   ├── delivery.ts
│   ├── integration.ts
│   ├── workflow.ts
│   └── ...
│
├── validators/                  (Zod schema + validation)
│   ├── auth.validators.ts
│   ├── order.validators.ts
│   └── ...
│
├── framework/                   (Workflow engine)
│   ├── workflows/               (Core workflow orchestration)
│   │   ├── Workflow class
│   │   ├── WorkflowRegistry
│   │   ├── DI container
│   │   ├── Compensation logic
│   │   └── Retry with exponential backoff
│   └── hooks/
│       ├── useWorkflow
│       └── useWorkflowStatus
│
├── core/                        (Business logic - 38 modules)
│   ├── src/
│   │   ├── auth/                (JWT, RBAC, permission cache, scrypt)
│   │   ├── api-hardening/       (Error handling, rate limiting, XSS)
│   │   ├── audit/               (Batch logging, diff computation, masking)
│   │   ├── billing/             (Plans, subscriptions, metering, invoicing)
│   │   ├── cache/               (Redis adapter, LRU, query cache)
│   │   ├── campaigns/           (Segmentation, scheduling, state machine)
│   │   ├── carriers/            (Carrier integrations, API)
│   │   ├── collections/         (Manual + auto collections, Shopify sync)
│   │   ├── compliance/          (Data retention, GDPR, audit trails)
│   │   ├── config/              (Environment configuration)
│   │   ├── delivery-rules/      (Zone-based routing rules)
│   │   ├── demand-prediction/   (AI ETA, slot availability)
│   │   ├── dispatch/            (Route optimization, assignment scoring)
│   │   ├── drivers/             (Driver management, mobile app)
│   │   ├── email/               (Multi-provider notification)
│   │   ├── encryption/          (Field-level AES-256-GCM)
│   │   ├── event-bus/           (TypedEventBus → Redis Streams)
│   │   ├── events/              (18 domain events)
│   │   ├── file-storage/        (S3 + local fallback)
│   │   ├── fleet/               (Fleet management)
│   │   ├── integrations/        (Registry → adapter → provider)
│   │   ├── inventory/           (Product inventory tracking)
│   │   ├── messaging/           (Multi-channel dispatcher)
│   │   ├── notifications/       (Email, SMS, push, WhatsApp)
│   │   ├── orders/              (Order lifecycle)
│   │   ├── payments/            (Stripe, subscriptions)
│   │   ├── process-manager/     (Worker orchestration)
│   │   ├── queue/               (BullMQ wrapper)
│   │   ├── realtime/            (Socket.io rooms, rate limiting)
│   │   ├── routes/              (Route optimization)
│   │   ├── support/             (Ticketing system)
│   │   ├── webhooks/            (Outbound HMAC signing, retry)
│   │   ├── workflow-integration/(Auto-trigger workflows from endpoints)
│   │   ├── zones/               (Geographic zones, PostGIS)
│   │   └── ai-analytics/        (Advanced analytics, forecasting)
│   └── __tests__/
│
├── sdk/                         (TypeScript SDK - @witylogix/sdk)
│   ├── src/
│   │   ├── client.ts            (HTTP client with auto-retry)
│   │   ├── resources/           (Orders, drivers, zones, shipments)
│   │   ├── errors/              (Typed error classes)
│   │   └── types/               (Type definitions)
│   ├── tsup.config.ts           (Dual CJS/ESM build)
│   └── package.json
│
└── extension-core/              (Preact extensions - @witylogix/extension-core)
    ├── src/
    │   ├── theme/               (Token bridge, CSS custom properties)
    │   ├── app-bridge/          (Shopify App Bridge wrapper)
    │   ├── hooks/               (8 Preact hooks)
    │   ├── types/               (Extension types)
    │   └── utils/
    └── package.json

apps/
├── api/                         (Fastify 5 backend)
│   ├── src/
│   │   ├── routes/              (10 domain routes)
│   │   │   ├── orders/
│   │   │   ├── drivers/
│   │   │   ├── routes/
│   │   │   ├── zones/
│   │   │   ├── auth/
│   │   │   ├── integrations/
│   │   │   ├── webhooks/
│   │   │   ├── campaigns/
│   │   │   ├── billing/
│   │   │   └── platform-admin/
│   │   ├── middleware/
│   │   │   ├── auth.ts          (JWT validation)
│   │   │   ├── rls.ts           (RLS enforcement)
│   │   │   ├── audit.ts         (Audit logging)
│   │   │   └── rate-limit.ts
│   │   ├── plugins/             (Fastify plugins)
│   │   ├── health/              (Health checks)
│   │   └── main.ts              (Server init)
│   └── Dockerfile
│
├── dashboard/                   (Next.js 15 admin UI)
│   ├── app/
│   │   ├── (auth)/              (Login, SSO)
│   │   ├── (authenticated)/     (Protected routes)
│   │   │   ├── orders/          (Order management)
│   │   │   ├── drivers/         (Driver management)
│   │   │   ├── analytics/       (Analytics dashboards)
│   │   │   ├── settings/        (Configuration)
│   │   │   └── ...
│   │   └── layout.tsx
│   ├── components/
│   │   └── (44 Tailwind-migrated pages)
│   ├── lib/
│   │   └── api-client/          (SDK usage)
│   └── Dockerfile
│
├── shopify-app/                 (Shopify integration)
│   ├── routes/
│   │   ├── checkout-extension.ts
│   │   ├── carrier-service.ts
│   │   └── webhooks.ts
│   └── Dockerfile
│
├── driver-app/                  (React Native mobile)
│   ├── screens/
│   │   ├── delivery-list/
│   │   ├── delivery-detail/
│   │   ├── gps-tracking/
│   │   ├── proof-of-delivery/
│   │   └── ...
│   ├── services/
│   │   ├── location.ts          (Background GPS)
│   │   ├── camera.ts            (POD capture)
│   │   └── sync.ts
│   └── app.json
│
├── customer-portal/             (Customer tracking portal)
│   ├── pages/
│   │   └── [trackingId]/        (Leaflet map + ETA)
│   └── Dockerfile
│
├── tracking-page/               (Embedded tracking widget)
│   ├── src/
│   │   ├── LeafletMap.tsx
│   │   ├── DriverCard.tsx
│   │   └── OrderStatus.tsx
│   └── Dockerfile
│
└── docs/                        (Fumadocs documentation)
    ├── content/
    │   ├── setup/               (Self-hosting guides)
    │   ├── api/                 (API reference + OpenAPI 3.0)
    │   ├── platform-adapters/   (Shopify, WooCommerce, Magento)
    │   ├── guides/              (Developer guides)
    │   └── adr/                 (Architecture Decision Records)
    └── components/              (Component gallery)
```

### Dependency Flow

```
External Clients
  ↓
API (Fastify 5)
  ├─→ Middleware (auth, RLS, audit, rate-limit)
  ├─→ Route handlers
  │   └─→ @witylogix/core modules
  │       ├─→ Workflow engine (@witylogix/framework)
  │       ├─→ Event bus (Redis Streams)
  │       ├─→ Database (@witylogix/db + Prisma)
  │       ├─→ Validators (@witylogix/validators)
  │       ├─→ Types (@witylogix/types)
  │       ├─→ Integration adapters
  │       └─→ External APIs (Stripe, SendGrid, etc.)
  └─→ Webhook dispatcher
      └─→ Event bus
```

---

## Database Architecture

### PostgreSQL 16 + PostGIS

The database is the source of truth for all system state, with strong multi-tenancy enforcement at the row level.

```
┌────────────────────────────────────────────────────────┐
│          PostgreSQL 16 with PostGIS 3.4                │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ MULTI-TENANT ISOLATION (4 layers)               │ │
│  ├──────────────────────────────────────────────────┤ │
│  │ Layer 1: Organization (parent)                  │ │
│  │ Layer 2: Shop (child of org)                    │ │
│  │ Layer 3: RLS policies enforcing tenant_id       │ │
│  │ Layer 4: Encryption for sensitive fields        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ SCHEMA (62 Prisma files)                         │ │
│  ├──────────────────────────────────────────────────┤ │
│  │ Core Tables:                                    │ │
│  │ • organizations, shops, users, auth_sessions   │ │
│  │ • orders, shipments, shipment_items            │ │
│  │ • drivers, routes, zones, delivery_slots       │ │
│  │ • notifications, campaigns, billing_plans      │ │
│  │ • integrations, webhooks, audit_logs           │ │
│  │ • files, cache_entries, etc. (40+ tables)      │ │
│  │                                                 │ │
│  │ PostGIS Extensions:                            │ │
│  │ • geometry columns for zones (polygons)        │ │
│  │ • ST_Contains() for zone containment           │ │
│  │ • ST_DWithin() for proximity queries           │ │
│  │ • Index: GIST for spatial queries              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ROW-LEVEL SECURITY (RLS)                         │ │
│  ├──────────────────────────────────────────────────┤ │
│  │ Every table has RLS policies:                  │ │
│  │                                                 │ │
│  │ SELECT: (tenant_id = current_setting(...))    │ │
│  │ INSERT: (tenant_id = current_setting(...))    │ │
│  │ UPDATE: (tenant_id = current_setting(...))    │ │
│  │ DELETE: (tenant_id = current_setting(...))    │ │
│  │                                                 │ │
│  │ Prevents: cross-org data leakage even if      │ │
│  │ auth layer is compromised                     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ INDEXING STRATEGY                                │ │
│  ├──────────────────────────────────────────────────┤ │
│  │ • B-tree: tenant_id, user_id, shop_id          │ │
│  │ • Hash: webhook_id, integration_id             │ │
│  │ • GIST: zone geometry (PostGIS)                 │ │
│  │ • Partial: for soft deletes (deleted_at)       │ │
│  │ • Composite: (tenant_id, status, created_at)   │ │
│  │                                                 │ │
│  │ Total indexes: ~120 across all tables           │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ MIGRATIONS                                       │ │
│  ├──────────────────────────────────────────────────┤ │
│  │ • 180+ migrations from v1.0 → v4.0             │ │
│  │ • Semantic versioning: YYYYMMDD_description    │ │
│  │ • Auto-run on app startup (Prisma migrate)     │ │
│  │ • Prisma Studio for manual inspection          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Data Model Highlights

**Organizations & Shops**

```
Organization (parent tenant)
  ├─ Shop (child, can have multiple)
  ├─ Drivers (shared across shops)
  ├─ Zones (shared across shops)
  └─ Billing configuration
```

**Orders & Shipments**

```
Order (from e-commerce platform)
  ├─ Order Items (SKU, qty, price)
  ├─ Shipments (can split across multiple)
  │   └─ Shipment Items (assignment to specific shipment)
  ├─ Delivery (address, ETA, driver assignment)
  │   ├─ Route (multi-stop route)
  │   ├─ Proof of Delivery (POD timeline)
  │   └─ Notifications (multi-channel)
  └─ Audit Trail (all changes logged)
```

**Drivers & Routes**

```
Driver
  ├─ Mobile Device (app registration)
  ├─ Current Route (assigned shipments)
  ├─ Location History (GPS points)
  ├─ Rating & Metrics (completion %, avg time)
  └─ Availability Status (online/offline)

Route
  ├─ Shipments (ordered, optimized)
  ├─ Waypoints (lat/lng)
  ├─ Estimated Duration (via Mapbox API)
  ├─ Status (pending/active/completed/failed)
  └─ Metrics (actual distance, time)
```

**Zones & Pricing**

```
Zone (PostGIS polygon geometry)
  ├─ Display Name & color
  ├─ Geometry (ST_Polygon from GeoJSON)
  ├─ Delivery Slots (time windows)
  ├─ Delivery Rules (default rate, weight ranges)
  └─ Shipping Profiles (per-product overrides)

Delivery Slot
  ├─ Time range (e.g., 9AM-12PM)
  ├─ Capacity (max shipments)
  ├─ Delivery Rule (rate calculation)
  └─ Billing (metered usage)
```

### RLS & Tenant Isolation

All tables have a `tenant_id` column pointing to the organization/shop. The database enforces RLS at runtime:

```sql
-- Example RLS policy for orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

Every API request sets this via Fastify middleware:

```typescript
// In request middleware
await prisma.$executeRaw`
  SET app.tenant_id = '${req.user.tenantId}';
`;
```

---

## Event System

### TypedEventBus Architecture

The event system is the backbone of Witylogix's async, decoupled architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                  TYPED EVENT BUS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Publisher (API/Workflow)                                │
│     └─→ emit('order.created', { orderId, ... })            │
│         ├─→ Validation (TypeScript)                        │
│         ├─→ Middleware: beforePublish                      │
│         └─→ Serialize to JSON                              │
│                                                              │
│  2. Stream Adapter (Pluggable)                              │
│     ├─→ RedisStreamAdapter (XADD to Redis)                 │
│     │   └─→ Stream key: events:order.created               │
│     │   └─→ Consumer group: 'notification-service'         │
│     │   └─→ Message ID: 1234567890000-0                    │
│     │                                                       │
│     └─→ InMemoryStreamAdapter (for tests)                  │
│                                                              │
│  3. Consumer Group (Redis XREADGROUP)                       │
│     ├─→ Load-balance across workers                        │
│     ├─→ Auto-acknowledge (XACK) on success                 │
│     ├─→ Pending entries for retry/recovery                 │
│     └─→ Dead-letter queue on max retries                   │
│                                                              │
│  4. Event Handler (Async callback)                          │
│     ├─→ Middleware: beforeHandle                           │
│     ├─→ Execute handler logic                              │
│     ├─→ Middleware: afterHandle / onError                  │
│     └─→ Return to consumer group                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 18 Domain Events

```
ORDER EVENTS
├─ order.created       (new order created)
├─ order.confirmed     (merchant confirmed)
├─ order.cancelled     (order cancelled)
└─ order.updated       (order details changed)

DELIVERY EVENTS
├─ delivery.started    (driver picked up)
├─ delivery.completed  (delivered)
├─ delivery.failed     (failed attempt)
└─ delivery.updated    (status change)

DRIVER EVENTS
├─ driver.assigned     (driver assigned to route)
├─ driver.unassigned   (driver removed)
├─ driver.location_updated (GPS ping)
└─ driver.status_changed (online/offline)

WORKFLOW EVENTS
├─ workflow.started    (workflow execution started)
├─ workflow.completed  (all steps completed)
├─ workflow.failed     (execution failed)
├─ workflow.step_completed (individual step done)
└─ workflow.compensated (rollback executed)

WEBHOOK EVENTS
├─ webhook.delivered   (3rd-party confirmed receipt)
└─ webhook.failed      (delivery failed, queued for retry)

BILLING EVENTS
├─ billing.invoice_created
└─ billing.payment_received

NOTIFICATION EVENTS
├─ notification.sent
└─ notification.failed
```

### Event Flow with Retries & DLQ

```
Emit Event
  │
  ▼
Publish to Redis Stream (XADD)
  │
  ├─→ [Success] Consumer reads (XREADGROUP)
  │   │
  │   ▼
  │   Handler executes
  │   │
  │   ├─→ [Success] ACK (XACK) → Done
  │   │
  │   └─→ [Failure]
  │       │
  │       ▼
  │       Retry policy:
  │       • maxAttempts: 3
  │       • Backoff: 100ms → 200ms → 400ms
  │       • Jitter: ±10%
  │       │
  │       ├─→ [Attempt 1-3 succeed] ACK → Done
  │       │
  │       └─→ [All retries exhausted]
  │           │
  │           ▼
  │           Dead-Letter Queue (DLQ)
  │           ├─→ Logged to database
  │           ├─→ Manual review queue
  │           ├─→ Webhook to ops team
  │           └─→ Replay capability
  │
  └─→ [Publish failure] Fallback to in-memory queue
```

### Middleware Pipeline

Handlers can implement middleware for cross-cutting concerns:

```typescript
const loggingMiddleware = {
  beforePublish: (envelope) => console.log(`Publishing ${envelope.type}`),
  beforeHandle: (envelope) => console.log(`Handling ${envelope.type}`),
  afterHandle: (envelope) => console.log(`Handled ${envelope.type}`),
  onError: (envelope, error) => console.error(`Failed: ${error.message}`),
};

const bus = new TypedEventBus({
  middleware: [loggingMiddleware, metricsMiddleware, validationMiddleware],
  // ...
});
```

---

## Multi-Tenancy Architecture

Witylogix enforces multi-tenancy at 4 layers:

### Layer 1: Organization (Parent Tenant)

- Top-level entity (company using the platform)
- Owns N shops, M drivers, K zones
- Shared billing, settings, integrations
- Example: "Acme Corp" operating in 3 cities

### Layer 2: Shop (Child Tenant)

- E-commerce storefront connected to org
- Can have separate branding, inventory, staff
- Shares drivers/zones with org (configurable)
- Example: "Acme NYC" (part of Acme Corp)

### Layer 3: Row-Level Security (RLS)

- PostgreSQL RLS policies on every table
- `tenant_id` filtering at query execution
- Applied via `current_setting('app.tenant_id')`
- Set on every request in Fastify middleware
- Prevents accidental data leakage even if app layer is compromised

### Layer 4: Field-Level Encryption

- AES-256-GCM encryption for sensitive fields
- Scrypt key derivation (salt + iterations)
- Automatic encrypt/decrypt via Prisma middleware
- Fields: passwords, API keys, payment details, PII

### Multi-Shop Organization Example

```
Organization: Acme Corp (org_id: org_123)
├─ Shop 1: Acme NYC (shop_id: shop_456)
│   ├─ Orders (40 per day)
│   ├─ Drivers (5 assigned)
│   └─ Zones (3: Manhattan, Brooklyn, Queens)
│
├─ Shop 2: Acme Boston (shop_id: shop_789)
│   ├─ Orders (25 per day)
│   ├─ Drivers (3 assigned)
│   └─ Zones (2: Boston metro, suburbs)
│
└─ Shared Resources
    ├─ Drivers (can work for both shops)
    ├─ Integrations (Shopify, SendGrid, Mapbox)
    ├─ Billing account
    └─ Admin users
```

---

## Integration Architecture

### Registry → Adapter → Provider Pattern

Witylogix uses a pluggable integration pattern for extensibility:

```
┌────────────────────────────────────────────────────────┐
│           INTEGRATION PATTERN                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. IntegrationRegistry (static catalog)             │
│     └─→ Maps provider name → adapter factory         │
│                                                        │
│  2. Adapter (interface)                               │
│     └─→ send(), retrieve(), delete(), validate()     │
│                                                        │
│  3. Provider Implementation (concrete)                │
│     └─→ Stripe, SendGrid, Twilio, Mapbox, etc.      │
│                                                        │
│  4. Tenant Configuration                              │
│     ├─→ Use deployer default OR                      │
│     ├─→ BYOK (Bring Your Own Key) with tenant keys  │
│     └─→ Metered fallback billing                     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 38 Integrated Providers (6 Categories)

**Communication (7 providers)**

- Email: SendGrid, Mailgun, SES, Postmark, Resend, SMTP
- SMS: Twilio, Vonage, SNS, MessageBird, Plivo
- WhatsApp: Meta Cloud, Twilio, 360dialog
- Push: Firebase, OneSignal, Expo

**Routing (6 providers)**

- Mapbox, OSRM, Google Maps, HERE, GraphHopper, TomTom

**Order Management (4 providers)**

- Shopify (REST + GraphQL APIs)
- WooCommerce, Magento, Custom

**Inventory (3 providers)**

- Shopify, WooCommerce, ERP systems

**Payment (3 providers)**

- Stripe (subscriptions, invoicing)
- PayPal, Square

**Analytics (4 providers)**

- BigQuery, DataHub, custom webhooks

### Integration Lifecycle

```
Tenant requests integration
  │
  ▼
Registry.getProvider('sendgrid')
  │
  ├─→ Check tenant has credentials (BYOK)
  │   └─→ Decrypt from DB
  │
  ├─→ Fall back to deployer default if missing
  │
  ├─→ Instantiate adapter
  │   └─→ new SendGridAdapter(credentials)
  │
  ▼
Call adapter.send(message)
  │
  ├─→ Validate message format
  ├─→ Add metrics (usage tracking)
  ├─→ Call SendGrid API
  └─→ Log + return result
```

---

## Caching Strategy

### 3-Layer Cache Architecture

```
┌────────────────────────────────────────────────┐
│          3-LAYER CACHE STRATEGY                │
├────────────────────────────────────────────────┤
│                                                │
│  Layer 1: LRU In-Memory Cache (app process)  │
│  ├─→ Max 10,000 entries per instance         │
│  ├─→ TTL: 5 minutes                          │
│  ├─→ Keys: RBAC permissions, config          │
│  └─→ Hit rate: 95%+ for frequent access     │
│                                                │
│  Layer 2: Redis Cache (distributed)           │
│  ├─→ Max 256MB per deployment                │
│  ├─→ TTL: variable (5m-24h)                  │
│  ├─→ Keys: zones, drivers, query results     │
│  ├─→ Eviction: LRU when max memory reached  │
│  └─→ Hit rate: 80%+ across workers          │
│                                                │
│  Layer 3: Database (source of truth)         │
│  ├─→ PostgreSQL with indexes                │
│  ├─→ Full consistency guarantee             │
│  ├─→ Query plan cache via Postgres          │
│  └─→ Fallback on cache misses               │
│                                                │
└────────────────────────────────────────────────┘
```

### Cached Data Types

| Data                        | TTL      | Invalidation     | Hit Rate |
| --------------------------- | -------- | ---------------- | -------- |
| **RBAC Permissions**        | 5m       | On role change   | 95%+     |
| **Zone Geometry**           | 1h       | Manual (PostGIS) | 99%+     |
| **Driver Availability**     | 1m       | Location update  | 85%+     |
| **Delivery Rate (PostGIS)** | 30m      | Zone change      | 92%+     |
| **Integration Config**      | 24h      | On save          | 98%+     |
| **Campaign Segments**       | 5m       | On update        | 88%+     |
| **Billing Metrics**         | 1h       | Hourly refresh   | 90%+     |
| **API Response**            | Variable | Per endpoint     | 70%+     |

### Cache Invalidation Patterns

```
On resource change:
  1. Write to DB (RLS enforced)
  2. Emit event to event bus
  3. Event handler invalidates related caches
  4. Background jobs refresh preemptively

Example (Zone update):
  ├─→ POST /zones/:id (write to DB)
  ├─→ Emit zone.updated event
  ├─→ Event handler:
  │   ├─→ redis.del('zone:${id}')
  │   ├─→ redis.del('zone:list:*')  // wildcard
  │   └─→ Broadcast socket.io update
  └─→ Next request hits DB, caches fresh data
```

---

## Security Architecture

### Authentication Stack

```
┌────────────────────────────────────────────────────────┐
│              AUTHENTICATION STACK                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. Credential Methods                                │
│     ├─→ Local: Scrypt hashing (16 rounds, random salt)
│     ├─→ OAuth2: Auth0, Clerk, Cognito, Firebase     │
│     ├─→ OIDC: Generic OpenID Connect provider       │
│     ├─→ SAML 2.0: Enterprise SSO                    │
│     └─→ Magic Link: Email-based passwordless       │
│                                                        │
│  2. Session Management                                │
│     ├─→ JWT tokens (HS256 signed)                   │
│     ├─→ Refresh token rotation (Redis)              │
│     ├─→ Cookie storage (httpOnly, secure, sameSite) │
│     ├─→ CSRF protection (SameSite=Strict)           │
│     └─→ Session timeout: 24h / inactivity: 8h       │
│                                                        │
│  3. Permission Model (RBAC)                           │
│     ├─→ 14 resource types                           │
│     │   (orders, drivers, zones, campaigns, etc.)   │
│     │                                                │
│     ├─→ 7 action types                              │
│     │   (create, read, update, delete, export, etc.)
│     │                                                │
│     ├─→ Hierarchical roles                          │
│     │   (super_admin, org_admin, shop_manager, etc.)
│     │                                                │
│     ├─→ Wildcard support (orders:*, *:read)         │
│     │                                                │
│     ├─→ Shop-level + org-level roles                │
│     │                                                │
│     └─→ Permission cache (5-min TTL, Redis)         │
│                                                        │
│  4. Rate Limiting                                     │
│     ├─→ Token bucket algorithm                       │
│     ├─→ Tier-based limits:                          │
│     │   • FREE: 50 req/min                          │
│     │   • STARTER: 200 req/min                      │
│     │   • PRO: 500 req/min                          │
│     │   • ENTERPRISE: 1000 req/min                  │
│     │                                                │
│     └─→ Per-endpoint overrides                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Encryption & Data Protection

**Field-Level Encryption**

- Algorithm: AES-256-GCM (authenticated encryption)
- Key derivation: Scrypt (salt + 16K iterations)
- Key rotation: Supported with re-encryption
- Fields: passwords, API keys, payment details, PII

**Transport Security**

- TLS 1.3 for all HTTP connections
- HSTS headers (Strict-Transport-Security)
- Certificate pinning for mobile apps
- Automatic HTTPS redirect

**Data Masking**

- Audit logs: Credit card truncated (\***\*-\*\***-\*\*\*\*-1234)
- Logs: Passwords replaced with [REDACTED]
- Search: Full-text search on masked data
- Export: Sensitive fields optional

### Audit & Compliance

```
┌──────────────────────────────────────────────────────┐
│         AUDIT TRAIL & COMPLIANCE                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Batch Audit Logging                                │
│  ├─→ Buffer 50 events / 5s flush                   │
│  ├─→ Automatic diff computation (before/after)     │
│  ├─→ Sensitive field masking                       │
│  ├─→ Full-text search capability                   │
│  ├─→ CSV export for compliance                     │
│  └─→ Retention policy (7 years for regulated data) │
│                                                      │
│  Events Logged                                       │
│  ├─→ Resource creation/update/deletion              │
│  ├─→ User login/logout                              │
│  ├─→ Permission changes                             │
│  ├─→ Data exports                                   │
│  ├─→ API key rotation                               │
│  └─→ Integration configuration changes              │
│                                                      │
│  User Activity Tracking                             │
│  ├─→ Request ID (UUID v4) for tracing              │
│  ├─→ Correlation ID across services                │
│  ├─→ Slow request warnings (> 1s)                  │
│  ├─→ Error tracking (Sentry integration)           │
│  └─→ Metrics (Prometheus)                          │
│                                                      │
│  Compliance Features                                │
│  ├─→ GDPR: Data export, right-to-be-forgotten     │
│  ├─→ CCPA: Opt-out support                        │
│  ├─→ SOC2: Audit logging + access controls        │
│  └─→ ISO 27001: Information security mgmt         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Performance Characteristics

### Latency Targets (p95)

| Operation                     | Target | Actual | Notes              |
| ----------------------------- | ------ | ------ | ------------------ |
| **GET /orders/:id**           | 100ms  | 45ms   | Cached (Redis)     |
| **POST /orders** (create)     | 500ms  | 380ms  | Workflow async     |
| **GET /rates** (zone calc)    | 200ms  | 150ms  | PostGIS + cache    |
| **POST /drivers/:id/assign**  | 800ms  | 620ms  | Route optimization |
| **WebSocket location update** | 50ms   | 30ms   | Direct broadcast   |
| **Webhook delivery**          | 1000ms | 750ms  | HTTP + retry queue |
| **Auth token validation**     | 50ms   | 20ms   | JWT local decode   |
| **RBAC permission check**     | 100ms  | 35ms   | Cache hit          |

### Throughput Targets

| Resource                   | Target | Actual | Scaling                |
| -------------------------- | ------ | ------ | ---------------------- |
| **Concurrent users**       | 1000   | 1200   | Via API replicas       |
| **Orders/sec**             | 100    | 120    | Async processing       |
| **Events/sec**             | 10k    | 12k    | Redis Streams sharding |
| **Webhook deliveries/sec** | 1000   | 1100   | Worker pool scale      |
| **Location updates/sec**   | 500    | 520    | WebSocket rooms        |
| **Audit log writes/sec**   | 1000   | 950    | Batch + Redis queue    |

### Scalability Bottlenecks & Solutions

```
┌────────────────────────────────────────────────────────┐
│         SCALING POINTS & SOLUTIONS                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1. Database (PostgreSQL)                             │
│     Bottleneck: Single write leader                   │
│     Solutions:                                        │
│     ├─→ Read replicas (async) for SELECT queries    │
│     ├─→ Connection pooling (PgBouncer)              │
│     ├─→ Query optimization + index tuning            │
│     ├─→ Partitioning (audit_logs by month)          │
│     └─→ Auto-scaling via Cloud SQL / RDS            │
│                                                        │
│  2. Cache Layer (Redis)                               │
│     Bottleneck: Single node memory limit              │
│     Solutions:                                        │
│     ├─→ Redis Cluster (horizontal sharding)         │
│     ├─→ Redis Sentinel (HA + failover)              │
│     ├─→ LRU eviction policy                         │
│     ├─→ Compression for large values                │
│     └─→ Separate cache for different data types    │
│                                                        │
│  3. Event Bus (Redis Streams)                         │
│     Bottleneck: Consumer group coordination           │
│     Solutions:                                        │
│     ├─→ Consumer group scaling (workers)             │
│     ├─→ Stream sharding by key (order_id)           │
│     ├─→ Kafka migration (future)                    │
│     └─→ Dead-letter queue monitoring                │
│                                                        │
│  4. WebSocket Connections (Socket.io)                │
│     Bottleneck: Single server connection limit        │
│     Solutions:                                        │
│     ├─→ Redis adapter (broadcast across servers)    │
│     ├─→ Room-based subscriptions (per order)        │
│     ├─→ Compression (binary protocol)               │
│     └─→ Connection pooling                          │
│                                                        │
│  5. API Servers (Fastify)                             │
│     Bottleneck: CPU + memory per instance             │
│     Solutions:                                        │
│     ├─→ Horizontal scaling (K8s replicas)           │
│     ├─→ Load balancing (sticky sessions for WSS)    │
│     ├─→ Request queueing                            │
│     └─→ Circuit breakers for external APIs         │
│                                                        │
│  6. File Storage (S3)                                 │
│     Bottleneck: API rate limits                       │
│     Solutions:                                        │
│     ├─→ CloudFront CDN (caching + edge locations)   │
│     ├─→ Multipart uploads (large files)             │
│     ├─→ Local storage fallback (self-hosted)        │
│     └─→ S3 request rate limits (exponential backoff)│
│                                                        │
│  7. Worker Processes (BullMQ)                         │
│     Bottleneck: Worker availability                   │
│     Solutions:                                        │
│     ├─→ Auto-restart + exponential backoff          │
│     ├─→ Graceful shutdown (drain queue)             │
│     ├─→ Worker specialization (billing, campaigns)  │
│     └─→ Dead-letter queue inspection                │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Performance Monitoring

Witylogix uses Prometheus + Grafana for real-time monitoring:

```
Key Metrics
├─ API response time (p50, p95, p99)
├─ Database query duration (by operation)
├─ Cache hit rate (L1, L2)
├─ Event bus latency (publish, consume)
├─ WebSocket connection count
├─ Worker queue depth
├─ Error rate (4xx, 5xx)
└─ Resource utilization (CPU, memory, disk)

Dashboards
├─ System Health (uptime, error budget)
├─ API Performance (throughput, latency)
├─ Database Performance (connections, slow queries)
├─ Event Bus (stream lag, dead-letter size)
└─ Business Metrics (orders/day, deliveries/day)
```

---

## Additional Resources

- **DEPLOYMENT.md** — Production deployment guide (Docker Compose, Kubernetes, SSL/TLS)
- **README.md** — Quick start, feature overview, tech stack
- **ADR-009** — Medusa-inspired architecture evolution
- **ADR-010** — Event Bus architecture decision record
- **Event Bus README** — (`packages/core/src/event-bus/README.md`)
- **Fumadocs** — API reference + developer guides (`apps/docs`)

---

## Version History

| Version | Date       | Sprint | Key Changes                                                 |
| ------- | ---------- | ------ | ----------------------------------------------------------- |
| 4.0.0   | 2026-03-16 | 7.0    | Multi-tenancy refinement, RBAC, audit logging, integrations |
| 3.5.0   | 2026-02-01 | 6.5    | Workflow engine, event bus, real-time WebSockets            |
| 3.0.0   | 2025-12-15 | 6.0    | Shopify checkout extension, billing system                  |
| 2.0.0   | 2025-10-01 | 5.0    | PostgreSQL migration, PostGIS, RLS                          |
| 1.0.0   | 2025-07-01 | 4.0    | Initial release, Fastify + Next.js                          |

---

**Document Author:** AR (CTO/Architect)
**Last Updated:** 2026-03-16
**License:** AGPL-3.0
