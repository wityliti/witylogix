# 03 — Architecture & Stack

## Monorepo Structure

```
witylogix-platform/
├── apps/
│   ├── api/              # Fastify 5 REST API (Node.js, TypeScript)
│   ├── dashboard/        # Next.js 15 admin dashboard
│   ├── shopify-app/      # Shopify embedded app (React Router v7)
│   ├── driver-app/       # React Native driver mobile app
│   ├── tracking-page/    # Public customer tracking page
│   ├── customer-portal/  # Customer self-service portal
│   └── docs/             # Documentation site
├── packages/
│   ├── core/             # Business logic (80+ modules)
│   ├── db/               # Prisma client + schema (44 schema files)
│   ├── types/            # Shared TypeScript types
│   ├── validators/       # Zod validation schemas
│   ├── framework/        # Workflow engine (Medusa-inspired)
│   ├── carrier-service/  # Carrier abstraction layer
│   ├── sdk/              # TypeScript SDK for API
│   ├── workflows/        # Delivery workflow definitions
│   ├── checkout-widget/  # Embeddable checkout widget
│   └── extension-core/   # Extension system base
├── extensions/
│   ├── checkout-ui/      # Shopify checkout extension
│   └── pos-ui/           # POS extension
├── docs/                 # Sprint docs, ADRs, guides
└── witylogix-sprint-tracker.xlsx
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 20 LTS |
| **Package Manager** | pnpm | 9.15.0 |
| **Monorepo** | Turborepo | latest |
| **API** | Fastify | 5.x |
| **Dashboard** | Next.js | 15.x |
| **Database** | PostgreSQL + PostGIS | 16 |
| **ORM** | Prisma | 6.19.2 (local binary) |
| **Cache** | Redis | 7.x |
| **Queue** | BullMQ | latest |
| **Validation** | Zod | 3.x |
| **CSS** | Tailwind CSS | 3.4 (NOT v4) |
| **Testing** | Vitest | 1.6.1 |
| **Auth** | JWT + refresh tokens | — |

## Critical Path Dependencies

```
pnpm installed at: /sessions/wizardly-great-planck/.npm-global/bin
PATH must include: /sessions/wizardly-great-planck/.npm-global/bin

Prisma binary: ./node_modules/.pnpm/node_modules/.bin/prisma (v6.19.2)
DO NOT use: npx prisma (resolves to v7.5.0 and breaks)

Vitest binary: ./node_modules/.pnpm/node_modules/.bin/vitest (v1.6.1)
```

## Core Package Modules (80+)

The `packages/core/src/` directory contains all business logic organized by domain:

**Delivery & Logistics:** orders, drivers, routes, dispatch, zones, tracking, carriers, shipping, shipping-profiles, delivery-rules, route-optimizer, fleet, freight, field-service, supply-chain, inventory, returns

**Integrations & Platforms:** integrations, platforms, crm, esignatures, eld, pos, healthcare, webhooks

**Communication:** email, email-templates, sms, whatsapp, push, notifications, notifications-v2, messaging, campaigns

**Infrastructure:** auth, rbac, tenant, billing, payments, invoicing, audit, events, event-bus, queue, cache, scheduler, process-manager, logging, monitoring, encryption, security

**AI/ML:** ai, ai-analytics, ai-eta, ai-eta-v2, ai-monitoring, ai-slots, demand-prediction, driver-scoring

## Database Schema

44 Prisma schema files in `packages/db/prisma/schema/`:
- 00-config.prisma through 62-tenant.prisma
- Total: 4,472 lines of schema definitions
- Root `schema.prisma` configured with `prismaSchemaFolder` preview feature
- All DB access currently uses `(prisma as any).modelName` — typed helpers in `packages/db/src/helpers.ts`
