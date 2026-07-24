# 07 — API Development Guide

## Overview

The API is a Fastify 5 application at `apps/api/`. It serves 61 route files, all registered in `apps/api/src/server.ts` with `/api/v4/` prefix. The API uses Prisma for database access, Zod for validation, and JWT for authentication.

## Route Registration

Every route file MUST be registered in `server.ts`:

```typescript
await app.register(import("./routes/orders.js"), { prefix: "/api/v4/orders" });
```

To check if a route is registered:

```bash
grep 'prefix.*"/api/v4' apps/api/src/server.ts | wc -l  # Should be 61
```

To find unregistered routes:

```bash
for f in apps/api/src/routes/*.ts; do
  base=$(basename "$f" .ts);
  if echo "$base" | grep -q '\.d$'; then continue; fi;
  if ! grep -q "routes/${base}" apps/api/src/server.ts; then
    echo "UNREGISTERED: $base";
  fi;
done
```

## Route File Pattern

```typescript
import { FastifyPluginAsync } from "fastify";

const routes: FastifyPluginAsync = async (app) => {
  // List
  app.get("/", async (request, reply) => {
    const { page = 1, limit = 20, search, status } = request.query as any;
    const items = await (prisma as any).order.findMany({
      where: {
        orgId: request.user.orgId,
        ...(status && { status }),
        ...(search && { name: { contains: search, mode: "insensitive" } }),
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    const total = await (prisma as any).order.count({
      where: { orgId: request.user.orgId },
    });
    return reply.send({ data: items, pagination: { page, limit, total } });
  });

  // Get by ID
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const item = await (prisma as any).order.findFirst({
      where: { id, orgId: request.user.orgId },
    });
    if (!item) return reply.code(404).send({ error: "Not found" });
    return reply.send({ data: item });
  });

  // Create
  app.post("/", async (request, reply) => {
    const data = request.body as any;
    const item = await (prisma as any).order.create({
      data: { ...data, orgId: request.user.orgId },
    });
    return reply.code(201).send({ data: item });
  });

  // Update
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;
    const item = await (prisma as any).order.update({
      where: { id },
      data,
    });
    return reply.send({ data: item });
  });

  // Delete
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as any;
    await (prisma as any).order.delete({ where: { id } });
    return reply.code(204).send();
  });
};

export default routes;
```

## Response Format

All API responses follow this structure:

```json
// Success (single)
{ "data": { "id": "...", ... } }

// Success (list)
{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100 } }

// Error
{ "error": "Human-readable message", "code": "ERROR_CODE" }
```

## Registered Routes (61 total)

**Core:** orders, drivers, zones, routes, carriers, tracking, shipments, locations, products, customers, collections, time-slots, shops, orgs

**Auth:** auth, auth-providers, users, permissions

**Communication:** messages, notifications, notification-templates, notification-preferences, campaigns

**Financial:** payments, payments/v2, payment-methods, billing, billing/subscriptions, invoices

**Integration:** integrations, webhooks, custom-webhooks, outbound-webhooks, webhook-deliveries, ecommerce, pos, couriers

**Platform:** admin, settings, health, views, widgets, activity-logs, audit, support/tickets, support/feature-requests

**Workflow:** workflow/delivery, workflow/drivers, workflow/executions, workflow/orders, returns, driver-scoring, pod

**External:** shopify/webhooks, shopify/workflow-bridge, woocommerce/webhooks, magento-webhooks, calendar-rules, shipping-profiles

## Plugins

Plugins are registered in `server.ts` before routes:

| Plugin                 | Purpose                      |
| ---------------------- | ---------------------------- |
| `rawBodyPlugin`        | HMAC signature verification  |
| `cors`                 | Cross-origin requests        |
| `helmet`               | Security headers             |
| `sensible`             | Error utilities              |
| `jwt`                  | Token authentication         |
| `rateLimit`            | Request throttling           |
| `errorHandlerPlugin`   | Standardized error responses |
| `websocket`            | WebSocket real-time channels |
| `sse`                  | Server-Sent Events fallback  |
| `workflow-integration` | Workflow engine hooks        |
