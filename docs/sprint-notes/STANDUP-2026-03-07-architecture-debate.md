# Witylogix Team Standup — Architecture Pivot Debate

**Date:** 2026-03-07
**Type:** All-Hands Standup + Blue Team / Red Team Architectural Debate
**Facilitator:** Founder (youthocrat)
**Attendees:** Full 9-person team

---

## Sprint 2.8 Completion Report

**AR (CTO):** Sprint 2.8 shipped. Here's the rundown:

- Auth provider abstraction: 7 providers (Local, Auth0, Clerk, Cognito, Firebase Auth, OIDC, SAML), BYOK registry with metered fallback
- POS integration: multi-provider checkout, custom form builder
- Platform admin panel: user/store/customer management
- API hardening: rate limiter, error standardization, OpenAPI spec
- Docker production stack: multi-stage builds, compose with 8 services
- 6 new test suites

Stats: **64 dashboard pages, 75+ API endpoints, 30 Prisma schemas, 51 core modules, 57 test suites, 201K+ LOC**

Commit `08cda0f` on `sprint-2.8-auth-admin-production`, 54 files changed, +19,476 lines.

All builds verified green.

---

## Agenda: Medusa v2-Inspired Architecture Evolution

**Founder:** I've been reading Medusa v2's architecture docs deeply — their 4-layer stack, workflow engine, module links, event bus, plugin system. AR wrote ADR-009 analyzing what we should adopt. This is the most important architectural decision since we started. I want a real debate. Blue team argues FOR adoption, Red team argues AGAINST. Let's go.

---

## Team Assignments

| Blue Team (Pro-Adoption) | Red Team (Anti/Cautious) |
|--------------------------|--------------------------|
| AR — CTO | RG — Backend Lead |
| DM — Frontend Dev | SP — Full-stack |
| KS — QA Lead | PK — Sr. Backend |
| NK — Frontend Lead | VS — Component Dev |
| | AM — Integration |

---

## Round 1: The Workflow Engine Layer

### Blue Team — AR (CTO)

Our biggest architectural problem right now is that business logic orchestration is scattered. When a delivery order is created, this is what happens today:

```
API route (billing-subscriptions.ts)
  → calls OrderManager.createOrder()
    → calls ZoneService.findZone() directly
    → calls RateCalculator.calculateRate() directly
    → calls NotificationService.send() directly
    → logs to audit trail manually
```

Every route is a custom orchestration. There's no rollback. If the notification fails after the order is created, the order exists but the customer never gets notified. There's no way to retry just the notification step. There's no audit of which step failed.

**Medusa's workflow pattern solves this cleanly:**

```
API route → createDeliveryOrderWorkflow.run()
  Step 1: validateDeliveryData (compensation: none)
  Step 2: checkInventory (compensation: release reservation)
  Step 3: assignZone (compensation: unassign)
  Step 4: calculateRate (compensation: none, pure function)
  Step 5: createOrder (compensation: delete order)
  Step 6: emitOrderCreated (compensation: none)
```

Each step is independently testable. Each has a compensation function that runs if a later step fails. The workflow is observable — you can see exactly where it failed in the admin panel.

We already have a process manager with BullMQ workers. The workflow engine is the natural evolution — it makes the process manager a first-class citizen instead of a bolt-on.

I've defined 10 concrete workflows in ADR-009 that would cover 80% of our business logic: createDeliveryOrder, assignDriver, completeDelivery, processSubscription, optimizeRoutes, handleWebhook, sendNotification, runCampaign, syncShopifyOrder, generateInvoice.

**Bottom line: Without workflows, our complexity will keep growing linearly with features. With workflows, new features compose from existing steps.**

### Red Team — RG (Backend Lead)

I hear you, AR, but let me push back on the urgency and scope.

**First, we're not Medusa.** Medusa is an e-commerce framework designed to be extended by thousands of different merchants with wildly different needs. That's WHY they need workflow orchestration — they can't predict what merchants will customize.

We're a delivery logistics platform. Our order lifecycle is well-defined: order → assign → pickup → deliver → POD. It doesn't change between tenants. The "customization" is in which routing provider they use, which notification provider they use — and we ALREADY solved that with the BYOK provider registry.

**Second, the cost is real.** Adding a workflow layer means:
- Every existing route must be refactored
- Every developer must learn a new abstraction
- Debugging gets harder — stack traces go through workflow engine instead of direct function calls
- Performance overhead — each step is a separate async operation with potential Redis round-trips
- We have 75+ API endpoints. Refactoring them all is a 3-month project minimum.

**Third, our current approach works.** We've shipped 8 sprints with direct function calls. Our code is readable. New team members can follow a route file from HTTP to database in 30 seconds. With workflows, they'd need to understand the workflow engine, step resolution, compensation semantics, container DI...

I'm not saying never. I'm saying NOT NOW. We should ship the product, get real customers, and adopt workflows when we actually hit the orchestration problems you're describing.

### Blue Team — KS (QA Lead)

I'll add the testing perspective. Right now, testing our API routes requires mocking the entire Prisma client, every service dependency, every integration. It's brittle. When DM changed the order creation logic last sprint, 4 test suites broke because they were tightly coupled to the implementation.

With workflows, each step is a pure-ish function: input → output (+ compensation). I can test `validateDeliveryDataStep` without knowing anything about Prisma, zones, or rates. I can test `assignZoneStep` with mock zone data without touching the database.

Our test count went from 0 to 57 suites in 8 sprints. But test QUALITY is my concern. Most of our tests mock so much infrastructure that they're testing mocks, not code. Workflows would let us write meaningful unit tests at the step level and meaningful integration tests at the workflow level.

### Red Team — PK (Sr. Backend)

KS, I respect the testing argument, but you can get the same benefit by just extracting functions. You don't need a workflow engine to write `validateDeliveryData(input): ValidatedInput`. That's just... a function.

The workflow engine adds value when you need:
1. Durable execution (resume after crash)
2. Long-running processes (multi-day)
3. Complex compensation (saga pattern)

Do we have ANY of these needs today? Our order lifecycle is synchronous. Driver assignment is synchronous. The only long-running thing is campaign batch sends, and BullMQ already handles that.

The saga/compensation argument sounds good in theory, but in practice: if order creation fails at the notification step, we just retry the notification. We don't need to roll back the order. The order is valid; the notification is a side effect.

---

## Round 2: Module Links vs. Prisma Relations

### Blue Team — DM (Frontend Dev)

Here's a real problem I hit building the admin panel. I needed to show customers with their order counts, delivery zones, subscription status, and support tickets — all on one page. In our current architecture, that meant:

```typescript
const customer = await prisma.customer.findUnique({
  where: { id },
  include: {
    orders: { select: { id: true, status: true } },
    // But wait — subscription is in billing schema...
    // And zone is determined by address + zone geometry...
    // And support tickets need a separate query...
  },
});
```

I ended up with 4 separate Prisma queries because our "modules" aren't really isolated — they just happen to be in separate files but share the same Prisma client with cross-module relations.

Module links would formalize this. If `customer ↔ subscription` is a link, not a foreign key, then the billing module can evolve independently. The admin panel would use the link manager to resolve relationships, and plugins could add NEW relationships without touching core schemas.

### Red Team — SP (Full-stack)

DM, your example actually proves the OPPOSITE point. You needed 4 queries because our modules are already somewhat isolated. With Prisma relations (foreign keys), you could get it in ONE query with nested includes. Module links would make it WORSE — you'd need the link manager to resolve every cross-module relationship, which means MORE queries, not fewer.

Medusa uses links because their modules literally run on separate databases. Their modules CAN'T use foreign keys. But our modules share one Prisma client with one PostgreSQL database. We have real foreign keys. We have real transactions. Links would throw away one of our biggest advantages: referential integrity.

Also — who's going to maintain the link tables? That's a whole new layer of data to manage, migrate, and test. If I add a new module that relates to orders, I now need to:
1. Create the module
2. Create a link definition
3. Run `db:sync-links`
4. Update any queries that need the link
5. Add compensation logic for link cleanup

With Prisma, I just add a relation in the schema and I'm done.

### Blue Team — AR (CTO)

SP makes a fair point about foreign keys. Here's my counter: the real value of links isn't technical purity — it's **plugin extensibility**.

Right now, if a deployer wants to add a "loyalty points" module that tracks points per customer per order, they'd need to:
1. Fork our Prisma schema
2. Add foreign keys from loyalty_points to orders and customers
3. Run migrations on their database
4. Hope their schema changes don't conflict with our next upgrade

With links, they'd:
1. Create `@witylogix/plugin-loyalty` as an npm package
2. Define `defineLink(LoyaltyModule.linkable.points, OrderModule.linkable.order)`
3. Install the plugin — link table is auto-created
4. Uninstall cleanly — link table is dropped, no schema changes to core

This is the difference between "customizable" and "extensible." We want deployers to build on Witylogix without forking. Links make that possible.

### Red Team — VS (Component Dev)

AR, that plugin scenario is compelling — for when we have plugins. Right now we have zero plugins. We have zero deployers building custom modules. We're building for a hypothetical future while our current codebase works fine with Prisma relations.

I'd support links when we have our first real plugin use case. Building the infrastructure before the need is premature optimization at the architecture level.

---

## Round 3: Event Bus

### Blue Team — NK (Frontend Lead)

I'll argue for the event bus from a frontend perspective. Right now, when something happens on the backend, the dashboard has no idea unless it polls. We have Socket.io for real-time tracking, but that's only for driver GPS coordinates.

With a proper event bus, the dashboard could subscribe to `order.created`, `driver.assigned`, `delivery.completed` events and update in real-time. The activity log page I built in Sprint 2.8 is currently mock data — with an event bus feeding into it, it becomes a live audit trail.

Also, our notification system is a mess of direct function calls. When an order is created, the route manually calls `notificationService.send()`. When a driver is assigned, a different route calls `notificationService.send()` again. With events, we'd have ONE subscriber that listens to `order.*` events and handles notifications. The route doesn't need to know about notifications at all.

### Red Team — AM (Integration)

NK, I like the idea of events, but let me be specific about the operational cost.

A Redis-backed event bus means:
- Redis becomes a critical dependency (it's currently optional for caching)
- We need consumer groups, dead-letter queues, retry logic
- Event schema versioning (what happens when event V2 has different fields than V1?)
- Event ordering guarantees (or lack thereof)
- Monitoring: are events being consumed? How far behind are consumers?

We already have BullMQ for job queues. We already have Redis for caching. Adding a THIRD Redis usage pattern (streams for events) increases operational complexity.

And the notification problem NK described? That's solvable without an event bus. Just extract a `handleOrderCreated()` function that routes call. Done. No Redis streams needed.

### Blue Team — KS (QA)

AM, the `handleOrderCreated()` approach is exactly the problem. It's a direct coupling. The route KNOWS it needs to call notifications. What about analytics? What about campaign triggers? What about webhook delivery? Each new side effect means modifying the route or adding another direct call.

Events decouple this. The route emits `order.created`. The notification subscriber picks it up. The analytics subscriber picks it up. The webhook subscriber picks it up. When we add loyalty points later, the loyalty subscriber picks it up — and no existing code changes.

This is the Open-Closed Principle at the architecture level. Open for extension, closed for modification.

---

## Round 4: Plugin System

### Blue Team — AR (CTO)

This is the long game. Witylogix is open-source. Our success depends on an ecosystem of deployers and contributors. Right now, contributing to Witylogix means:

1. Fork the repo
2. Understand the entire monorepo
3. Add your feature inline
4. Submit a PR
5. Hope it doesn't conflict with our roadmap

A plugin system would mean:

1. `npx create-witylogix-plugin my-loyalty`
2. Write your module, workflows, subscribers
3. `npm publish @company/witylogix-loyalty`
4. Users: `pnpm add @company/witylogix-loyalty` + one line in config

This is how Shopify themes, WordPress plugins, Medusa modules, and every successful platform works. We need this to scale beyond our 9-person team.

### Red Team — RG (Backend Lead)

AR, I fully agree we need a plugin system — eventually. But the ADR proposes Phase 3 (Q4 2026) for this. That's 9 months away. Building workflow engine + event bus + module links + plugin system in 18 months is incredibly ambitious for a 9-person team that's also building the actual product.

My concern is focus. Every sprint we've shipped has been building features that customers will use. Workflow engines and event buses are infrastructure that developers will use. We need customers before we need developers building plugins.

I'd counter-propose: ship the product as-is in Q2 2026. Get 10 paying customers. THEN invest in architecture. The best architecture is the one informed by real usage patterns, not theoretical ones.

### Red Team — PK (Sr. Backend)

Adding to RG's point: look at Medusa's timeline. They spent YEARS on v1 before building v2's architecture. They had thousands of merchants, hundreds of plugins, and a deep understanding of what needed to change before they rebuilt. We have zero customers. We're optimizing for a future we haven't earned yet.

### Blue Team — DM (Frontend Dev)

PK, I hear you, but there's a counter-argument: technical debt is cheaper to avoid than to fix. Every sprint we ship with direct function calls and Prisma cross-module relations is debt that gets harder to unwind later.

Medusa v1 → v2 was a MASSIVE migration. Their from-v1-to-v2 docs are enormous because everything changed: TypeORM → MikroORM, services → modules, direct calls → workflows. They literally broke every plugin and custom integration.

If we adopt the right architecture NOW, before we have customers and plugins, the migration cost is zero. We're choosing between "pay a little now" and "pay a lot later."

---

## Round 5: What Do We All Agree On?

**Founder:** Let me synthesize. Where's the common ground?

### Unanimous Agreement

1. **BYOK provider pattern is working.** Both teams agree our routing, notification, and auth provider registries are solid. They're already similar to Medusa's module providers.

2. **Prisma stays.** Nobody wants to switch to MikroORM or a custom DML. Prisma's ecosystem and type safety are genuine advantages.

3. **Fastify stays.** No reason to switch to Express. Fastify's performance and TypeScript support are better.

4. **RLS multi-tenancy stays.** Our row-level security approach is better than Medusa's approach for multi-tenant SaaS.

5. **Plugin system is needed — eventually.** Timeline is the debate, not the direction.

6. **Next.js dashboard stays.** Delivery logistics needs a custom UI, not Medusa Admin.

### Debated

1. **Workflow engine** — Blue says now (Phase 1, Q2). Red says later (after 10 customers).
2. **Module links** — Blue says Phase 2. Red says premature, Prisma relations work fine.
3. **Event bus** — Blue says Phase 1. Red says BullMQ + direct calls are sufficient.
4. **Full refactor scope** — Blue wants 18-month roadmap. Red wants incremental adoption driven by real pain.

---

## Founder's Decision

After hearing both sides, here's what I'm deciding:

### Adopt — But Phased and Pragmatic

**Phase 1 (Sprint 2.9-3.0): Workflow Engine ONLY**
- Build the workflow engine as `packages/framework/`
- Convert the TOP 3 most complex flows to workflows:
  - `createDeliveryOrderWorkflow`
  - `assignDriverWorkflow`
  - `completeDeliveryWorkflow`
- Keep everything else as-is. Don't refactor existing routes yet.
- Use BullMQ as the backing store (we already have it)

**Why now:** RG is right that we need customers. But AR is right that our orchestration is getting messy. The compromise: build the engine, prove it on 3 workflows, ship the product with a hybrid architecture. Old routes still work. New features use workflows.

**Phase 2 (After 10 customers): Event Bus**
- Add Redis-backed event bus
- Convert notification, analytics, webhook side effects to event subscribers
- But ONLY after we see real usage patterns

**Phase 3 (After 50 customers): Module Links + Plugin System**
- RG is absolutely right: we shouldn't build plugin infrastructure before we have plugin demand
- When customers start asking "can I add X to Witylogix?" — that's when we build links and plugins

### What Red Team Changed

- Pushed back the event bus from Phase 1 to Phase 2
- Pushed back links and plugins from Phase 2/3 to Phase 3 (customer-driven)
- Removed the 18-month timeline commitment — we'll re-evaluate after each phase

### What Blue Team Won

- Workflow engine starts NOW (Sprint 2.9)
- The direction is clear: composable, workflow-driven, event-oriented, plugin-ready
- ADR-009 stands as the north star, even if the timeline is flexible

---

## Action Items

| ID | Owner | Action | Sprint |
|----|-------|--------|--------|
| 1 | AR | Design `packages/framework/` with workflow engine, container DI, step runner | 2.9 |
| 2 | RG | Define interfaces for WorkflowStep, WorkflowContext, StepCompensation | 2.9 |
| 3 | PK | Implement `createDeliveryOrderWorkflow` as proof-of-concept | 2.9 |
| 4 | SP | Implement `assignDriverWorkflow` using the framework | 2.9 |
| 5 | NK | Implement `completeDeliveryWorkflow` | 2.9 |
| 6 | KS | Write test suites for all 3 workflows (step-level + workflow-level) | 2.9 |
| 7 | DM | Dashboard page: workflow execution viewer (admin can see step-by-step audit) | 2.9 |
| 8 | VS | Refactor 3 existing API routes to call workflows instead of direct services | 2.9 |
| 9 | AM | BullMQ integration for durable workflow execution | 2.9 |
| ALL | ALL | After Sprint 2.9: review, retrospective, decide Phase 2 scope | 3.0 |

---

## Red Team Final Comments

**RG:** I'm on board with this compromise. Building the workflow engine as an additive layer — not replacing everything — is the right call. If Sprint 2.9's 3 workflows prove the pattern, I'll champion the full migration myself.

**PK:** The proof is in the pudding. If workflows actually simplify our order lifecycle code and make it more testable, I'll be the first to admit I was wrong about timing. My concern was scope creep, and the founder's phased approach addresses that.

**SP:** I still think links are premature, but I'm glad we deferred that. Let's get customers first.

**AM:** Agreed. Docker production stack is ready. Let's focus on shipping the product with a clean architecture, not a perfect one.

## Blue Team Final Comments

**AR:** This is the right compromise. The workflow engine is the keystone — everything else (events, links, plugins) can layer on top later. If we get the workflow abstraction right in Sprint 2.9, the rest follows naturally.

**DM:** Excited to build the workflow viewer. Real-time visibility into business process execution is going to be a huge selling point for enterprise customers.

**NK:** The settings and activity log redesigns from Sprint 2.8 will integrate perfectly with workflow events when we get to Phase 2.

**KS:** From a testing perspective, even 3 workflows will dramatically improve our test quality. I'll design the test framework to scale to 10+ workflows without rework.

---

## Closing — Founder

Good debate, team. The direction is clear:

1. **We are NOT becoming Medusa.** We're a delivery logistics platform that learns from Medusa's architecture.
2. **Workflows start now.** Sprint 2.9 builds the framework and proves it on 3 core delivery flows.
3. **Everything else waits.** Events, links, plugins come when customers demand them.
4. **ADR-009 is our north star.** The architectural vision is right. The timeline is flexible.

Let's ship Sprint 2.9 and show the world what composable delivery logistics looks like.

---

*Document generated: 2026-03-07*
*Next standup: Sprint 2.9 kickoff*
