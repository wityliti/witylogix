# ADR-030: Operations Module — Tenant-Defined Activity Flows

**Status:** Proposed
**Date:** 2026-04-19
**Deciders:** Arjun (CTO), Rahul (Platform), Nisha (Dashboard)
**Supersedes:** None
**Relates to:** ADR-029 (OAuth2 App Platform), ADR-010 (Event Bus Architecture), ADR-013 (BullMQ Worker Integration), ADR-009 (Medusa-inspired Architecture Evolution)

---

## Executive Summary

Witylogix ships a first-party **Operations module** that lets a tenant define their own **activity flow** — a directed graph of stages (e.g. `PENDING → PROCESSING → READY_FOR_PICKUP → …`) — and attaches that flow to Orders and Shipments. This replaces today's hard-coded `STATUS_TRANSITIONS` tables in `apps/api/src/routes/shipments.ts` and `apps/api/src/routes/orders.ts` with a configurable, per-tenant state machine, and emits stage-change events that third-party OAuth apps (ADR-029) can subscribe to.

This is inspired by Fleetbase's FleetOps "activity flow" concept but keeps Witylogix's existing BullMQ workflow engine untouched — the two layers handle different concerns (state transitions vs multi-step jobs).

---

## Context

### What we have today

- **Hard-coded status transitions.**
  - `apps/api/src/routes/shipments.ts` lines 35–62 define a single `STATUS_TRANSITIONS` record mapping `ShipmentStatus → ShipmentStatus[]`.
  - `apps/api/src/routes/orders.ts` has the same pattern for `OrderStatus`.
  - These are shared across all tenants and enforced by `PATCH /shipments/:id/status` and the equivalent orders route.
- **BullMQ-based multi-step workflows** in `packages/workflows/*`:
  - Reusable steps: `validateOrderStep`, `geocodeAddressStep`, `calculateRateStep`, `assignDriverRecordStep`, etc.
  - Workflow definitions: `create-delivery-order`, `assign-driver`, `complete-delivery`.
  - These execute **job sequences** (run a step, wait, run next). They do not model the canonical state of an order; they _drive transitions_ as side effects.
- **Socket event emission** via `apps/api/src/lib/events.ts` (e.g. `emitShipmentStatusChanged`). This is an in-app real-time channel, not a tenant-configurable business process.

### The gap

A tenant today cannot:

1. Add a new stage ("Awaiting Customs Clearance") between existing ones.
2. Rename, hide, or re-order stages in the dashboard.
3. Subscribe a third-party app to a _custom stage_.
4. Drive different order types through different flows (e.g. standard delivery vs return).

Every such change requires a platform deploy. Fleetbase's FleetOps demonstrated that a JSON-configurable activity flow covers 90% of these requests without a code change, and the remaining 10% (true side-effect orchestration) is exactly what BullMQ workflows already do.

### Non-goals

- Replacing BullMQ workflows. Workflows remain for **side-effect orchestration** (geocode, rate, assign, notify).
- A full BPMN engine. We model a directed graph with guards, not full business-process modeling.
- Visual workflow DSL for non-operators. The dashboard editor targets ops admins, not end customers.

---

## Decision

### 1. First-class `ActivityFlow` per tenant

A new Prisma model stored in `packages/db/prisma/schema/69-operations.prisma`:

- `ActivityFlow` — `id`, `orgId`, `key` (e.g. `default-shipment`), `entity` (enum `SHIPMENT | ORDER`), `version`, `isDefault`, `graph` (JSON), `createdAt`, `updatedAt`.
- `graph` is a compact JSON shape:

```json
{
  "stages": [
    {
      "key": "PENDING",
      "label": "Pending",
      "terminal": false,
      "kind": "start"
    },
    { "key": "PROCESSING", "label": "Processing", "terminal": false },
    {
      "key": "DELIVERED",
      "label": "Delivered",
      "terminal": true,
      "kind": "success"
    }
  ],
  "transitions": [
    { "from": "PENDING", "to": "PROCESSING", "requires": "operations:write" },
    { "from": "PROCESSING", "to": "DELIVERED", "requires": "operations:write" }
  ]
}
```

- `Shipment` and `Order` gain an optional `currentStageKey String?` column alongside the existing `status` enum. The enum stays as a coarse bucket for reporting; `currentStageKey` is the authoritative runtime state when a flow is attached.

### 2. Engine in `packages/core/src/operations/`

A small, pure module:

- `loadFlow(orgId, entity): Promise<ActivityFlow>` — picks the default flow for the tenant+entity (falls back to a built-in flow that mirrors today's `STATUS_TRANSITIONS`).
- `listAllowedTransitions(flow, fromKey): string[]`.
- `validateTransition(flow, fromKey, toKey): { ok: true } | { ok: false, reason: string }`.
- `transition(entity, toKey, actor): Promise<TransitionResult>` — atomic Prisma update + domain event emit. Runs inside a transaction.

The engine is **stateless and synchronous** per call. Long-running side effects remain in BullMQ workflows, triggered by the event emitted from `transition`.

### 3. Domain events (single contract)

On every successful transition the engine emits:

- `shipment.stage_changed` (or `order.stage_changed`) on the in-process event bus + Redis Streams (ADR-010), with payload:

```ts
{
  id: string                  // shipment / order id
  orgId: string
  entity: "SHIPMENT" | "ORDER"
  flowKey: string
  from: string | null
  to: string
  terminal: boolean
  actor: { kind: "USER" | "APP" | "SYSTEM"; id?: string; installationId?: string }
  occurredAt: string          // ISO timestamp
}
```

- The existing socket emitter (`emitShipmentStatusChanged`) is called for dashboard/driver live updates.
- The existing webhook delivery service picks the event up and fans out to `WebhookEndpoint`s subscribed to `shipment.stage_changed` (including those owned by an `AppInstallation` — see ADR-029 §6).

### 4. API surface

Under `/api/v4/operations`:

- `GET    /flows` / `POST /flows` / `GET /flows/:id` / `PATCH /flows/:id` / `DELETE /flows/:id` — CRUD, scoped to `orgId`, guarded by `operations:read` / `operations:write`.
- `GET    /shipments/:id/allowed-transitions` → `string[]`.
- `POST   /shipments/:id/transition` body `{ to: string, reason?: string }` — returns updated shipment. Requires `shipments:transition` (a new scope that apps must request explicitly; the dashboard user role is also honored).
- Same pair for orders.

The existing `PATCH /shipments/:id/status` stays for backward compatibility and internally delegates to the engine when a flow is attached.

### 5. Dashboard: simple Activity Flow editor

A new page in `apps/dashboard/src/app/settings/operations/` using React Flow:

- List of flows with version + default toggle.
- Canvas editor (nodes = stages, edges = transitions), with a right-rail property panel for stage label/terminal/required scope.
- JSON view + import/export so developers can round-trip flows.
- MVP scope: no per-role guards, no timer-based auto-advance, no branching conditions beyond `from → to`. Those are fast-follow once the editor is in.

### 6. Relationship to BullMQ workflows

Unchanged. Workflows in `packages/workflows` continue to drive multi-step jobs. They become _consumers_ of stage-change events when needed (e.g. `create-delivery-order` workflow reacts to `shipment.stage_changed → PROCESSING` to kick off geocoding). There is no merge, no migration, and no breaking change to existing workflow code.

---

## Consequences

### Positive

- Tenants can add/rename stages without a deploy.
- Third-party OAuth apps (ADR-029) get a stable event contract (`shipment.stage_changed`) that survives tenant-side flow edits — they subscribe to events, not to stage strings.
- Replaces two duplicated `STATUS_TRANSITIONS` tables (shipments + orders) with one engine.
- Clear layering: flow = state machine, workflow = side-effect job chain, event bus = glue.

### Negative / risks

- Migration complexity: existing shipments have `status` but no `currentStageKey`. Mitigation: on first load of a tenant's default flow, backfill `currentStageKey` from `status` in-place (one-time idempotent migration script).
- Tenants can break themselves (e.g. remove `DELIVERED` terminal). Mitigation: flow validator rejects graphs without at least one terminal success state; dashboard editor shows the same validator inline.
- Coupling to React Flow in the dashboard. Mitigation: the editor is a plain React component, the engine + API are independent; if we swap the editor later the data model is untouched.

### Neutral

- Two ways to drive a shipment forward exist during the transition period (`PATCH /status` and `POST /transition`). Acceptable for one or two releases; `/status` becomes a thin wrapper and is deprecated in docs.

---

## Alternatives considered

1. **Keep hard-coded `STATUS_TRANSITIONS`, expose them via config flags.** Rejected: doesn't solve custom stages, still requires a deploy for every tenant-specific change.
2. **Model everything as BullMQ workflows.** Rejected: workflows are good at _doing_ things (jobs), bad at _being_ things (state). Editing a workflow to add an intermediate visible state is clunky and not safe to do per-tenant.
3. **Port Fleetbase FleetOps directly.** Rejected: different stack (Laravel + Ember), different data model, AGPL ↔ AGPL is fine but we get zero reuse and inherit their assumptions.

---

## Implementation order

1. This ADR accepted.
2. Prisma schema + migration (`69-operations.prisma`), add `currentStageKey` to Shipment/Order.
3. Engine in `packages/core/src/operations/` + unit tests that replay the existing `STATUS_TRANSITIONS` tests.
4. REST routes under `/api/v4/operations/…`.
5. Swap `PATCH /shipments/:id/status` internals to call the engine when a flow exists.
6. Event emission → existing socket + Redis Streams + webhook fanout.
7. Dashboard editor + `Installed applications` page (ADR-029) share the settings shell.
8. Docs + an example OAuth app that subscribes to `shipment.stage_changed`.

---

## References

- Fleetbase FleetOps (`https://github.com/fleetbase/fleetops`) — inspiration only, not a code port.
- Existing code: `apps/api/src/routes/shipments.ts` (`STATUS_TRANSITIONS`), `apps/api/src/routes/orders.ts`, `packages/workflows/src/definitions/*`, `apps/api/src/lib/events.ts`.
- ADR-010 for the event bus contract; ADR-029 for the consuming app platform.
