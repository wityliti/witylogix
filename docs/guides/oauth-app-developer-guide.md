# Building an OAuth App for Witylogix

Witylogix exposes a first-party OAuth2 authorization server so third-party
applications can be **installed by tenants** and call the public API with
**scoped access tokens**, without ever handling a tenant's master API key.

This guide walks through the full developer workflow: registering a client,
running the authorization flow, calling the API, subscribing to webhooks,
and using the Operations module to drive activity-flow transitions.

See [ADR-029 — OAuth2 App Platform](../adr/ADR-029-oauth-app-platform.md) and
[ADR-030 — Operations Activity Flow](../adr/ADR-030-operations-activity-flow.md)
for the architectural background.

A runnable, minimal implementation of everything below lives in
[`examples/oauth-app-demo`](../../examples/oauth-app-demo).

---

## 1. How apps authenticate

Witylogix supports the OAuth2 **Authorization Code grant with PKCE** as the
only install-time flow in v1. PKCE is required for all clients, confidential
or public; `code_challenge_method=S256`.

A successful install produces an `AppInstallation` row that represents the
relationship `(client, org)`. Access tokens are issued against that
installation, and revoking the installation invalidates every token and
webhook owned by the app in one step.

The endpoints live under `/api/v4/oauth`:

| Endpoint                       | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `GET  /api/v4/oauth/authorize` | Validate params and redirect to the tenant consent screen          |
| `POST /api/v4/oauth/consent`   | Dashboard posts the approved scopes and receives a one-time `code` |
| `POST /api/v4/oauth/token`     | Exchange `code` (or `refresh_token`) for an access token           |
| `POST /api/v4/oauth/revoke`    | RFC 7009 token revocation                                          |
| `GET  /api/v4/oauth/scopes`    | Public list of every scope the platform knows about                |

Token responses look like this:

```json
{
  "access_token": "wl_at_2f...",
  "refresh_token": "wl_rt_9a...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "shipments:read operations:read shipments:transition",
  "installation_id": "b03f6b5e-..."
}
```

Access tokens are opaque strings prefixed with `wl_at_` and hashed at rest.
Present them as `Authorization: Bearer <access_token>` on every API call.

---

## 2. Register a developer client

Clients are registered by a dashboard admin. The registering user becomes
the client owner; only the owner (or a platform super-admin) can update,
rotate, or suspend it.

```bash
curl -X POST https://api.witylogix.com/api/v4/oauth/clients \
  -H "Authorization: Bearer $DASHBOARD_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Dispatch",
    "description": "Auto-advances shipments through delivery stages",
    "homepageUrl": "https://acme.example.com",
    "logoUrl": "https://acme.example.com/logo.png",
    "redirectUris": ["https://acme.example.com/oauth/callback"],
    "allowedScopes": [
      "shipments:read",
      "operations:read",
      "shipments:transition",
      "webhooks:manage"
    ],
    "clientType": "CONFIDENTIAL"
  }'
```

The response contains the `clientSecret` **exactly once** — store it somewhere
the tenant's admin can't see it. It is hashed in the database immediately
after this response is returned; there is no "show me the secret again"
endpoint. If you lose it, call `POST /clients/:id/rotate-secret` to mint a
new one (every active installation keeps working).

| Client management endpoint                     | Use                                                    |
| ---------------------------------------------- | ------------------------------------------------------ |
| `GET /api/v4/oauth/clients`                    | List clients you own                                   |
| `GET /api/v4/oauth/clients/:id`                | Fetch client metadata                                  |
| `PATCH /api/v4/oauth/clients/:id`              | Update name, logo, redirect URIs, or `allowedScopes`   |
| `DELETE /api/v4/oauth/clients/:id`             | Suspend the client and revoke all active installations |
| `POST /api/v4/oauth/clients/:id/rotate-secret` | Mint a new `clientSecret`                              |

`PUBLIC` clients (SPA or mobile) skip the secret and rely on PKCE alone.
`CONFIDENTIAL` clients (server-to-server) must present `client_secret` on
every token exchange.

---

## 3. Scope catalog

Scopes are the single source of truth for what an installed app is allowed
to do. They are declared in
[`packages/core/src/oauth/scopes.ts`](../../packages/core/src/oauth/scopes.ts)
and enforced by the `requireScopes(...)` middleware on every route that
accepts app tokens.

Scopes are additive and **never wildcarded** — tenants see the exact list
they are approving on the consent screen. An app can only request scopes
from its own `allowedScopes`; a tenant can grant any subset of those.

### Reading data

| Scope             | What it unlocks                                         |
| ----------------- | ------------------------------------------------------- |
| `shipments:read`  | Read shipments, status, and current activity-flow stage |
| `orders:read`     | Read orders, line items, fulfillment state              |
| `drivers:read`    | Read driver profiles and availability                   |
| `routes:read`     | Read planned and active delivery routes                 |
| `customers:read`  | Read customer contact and address information           |
| `operations:read` | Read activity-flow configurations                       |

### Writing data

| Scope              | What it unlocks                                |
| ------------------ | ---------------------------------------------- |
| `shipments:write`  | Create and update shipments                    |
| `orders:write`     | Create and update orders                       |
| `drivers:write`    | Create and update drivers                      |
| `routes:write`     | Create and update delivery routes              |
| `operations:write` | Create and update activity-flow configurations |

### Operations state transitions

These are intentionally split from `:write` so a tenant can install a
dispatch app that advances stages without letting it edit arbitrary entity
fields.

| Scope                  | What it unlocks                                    |
| ---------------------- | -------------------------------------------------- |
| `shipments:transition` | `POST /api/v4/operations/shipments/:id/transition` |
| `orders:transition`    | `POST /api/v4/operations/orders/:id/transition`    |

### Platform

| Scope             | What it unlocks                                    |
| ----------------- | -------------------------------------------------- |
| `webhooks:manage` | Register, update, and remove webhook subscriptions |

A flow definition may also set `requiredScope` on a specific transition in
its graph. The Operations engine rejects the transition unless the caller's
scope list contains that value — this is how a tenant can allow an app to
`mark_delivered` but not `cancel_shipment`, for example.

---

## 4. Run the authorization flow

### 4.1 Generate a PKCE pair

```ts
import { createHash, randomBytes } from "node:crypto";

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
```

Store `verifier` in a server-side session keyed by `state`; you will need it
during the token exchange.

### 4.2 Redirect the tenant admin to authorize

```
https://api.witylogix.com/api/v4/oauth/authorize
  ?response_type=code
  &client_id=<your-client-id>
  &redirect_uri=https://acme.example.com/oauth/callback
  &scope=shipments:read operations:read shipments:transition
  &state=<random-state>
  &code_challenge=<challenge>
  &code_challenge_method=S256
```

Witylogix validates the client, the redirect URI, and the requested scope
subset, then forwards the admin to the dashboard consent screen. Approval
posts to `POST /api/v4/oauth/consent`, which issues a one-time `code`
and redirects back to `redirect_uri` with `?code=...&state=...`.

### 4.3 Exchange the code for tokens

```bash
curl -X POST https://api.witylogix.com/api/v4/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "...",
    "redirect_uri": "https://acme.example.com/oauth/callback",
    "client_id": "<your-client-id>",
    "client_secret": "<only-for-confidential-clients>",
    "code_verifier": "<the-verifier-you-stashed>"
  }'
```

Persist the returned `refresh_token` alongside the `installation_id`. The
access token is short-lived (1 hour); refresh tokens rotate on use, so
always store the newest value.

### 4.4 Refresh

```bash
curl -X POST https://api.witylogix.com/api/v4/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "...",
    "client_id": "<your-client-id>",
    "client_secret": "<confidential clients only>"
  }'
```

If the tenant has revoked the installation, the refresh call returns
`400 invalid_grant`. Treat that as "the tenant uninstalled us" and purge
local state.

---

## 5. Call the API

Every request carries the bearer token:

```bash
curl https://api.witylogix.com/api/v4/shipments \
  -H "Authorization: Bearer wl_at_..."
```

Witylogix resolves the token to the installation, sets `role=APP`, and
enforces scopes on every route. A call without the scope a route requires
returns `403 insufficient_scope` with the missing scope listed in the
response body.

The authenticated request context an app sees is always scoped to the
installing org's tenant; there is no way for an app to cross tenant
boundaries even by accident.

---

## 6. Wire up webhooks

Apps subscribe to events by registering a webhook endpoint with the
`webhooks:manage` scope. The endpoint is automatically bound to your
installation, so:

- Delivery is gated in real time by the installation's current scopes.
  If a tenant downgrades your grant from `shipments:read` to nothing,
  `shipment.*` events stop flowing without you doing anything.
- Revoking the installation deactivates every webhook you registered.

```bash
curl -X POST https://api.witylogix.com/api/webhooks \
  -H "Authorization: Bearer wl_at_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://acme.example.com/hooks/witylogix",
    "events": ["shipment.stage_changed", "order.stage_changed"]
  }'
```

The response includes a `secret` — verify every incoming payload with it
using the scheme described in [docs/api/webhooks.md](../api/webhooks.md).

Useful events for Operations-aware apps:

| Event                                  | Fires when                                    | Required scope   |
| -------------------------------------- | --------------------------------------------- | ---------------- |
| `shipment.stage_changed`               | A shipment advances through its activity flow | `shipments:read` |
| `order.stage_changed`                  | An order advances through its activity flow   | `orders:read`    |
| `shipment.created`, `shipment.updated` | Standard CRUD lifecycle                       | `shipments:read` |
| `order.created`, `order.updated`       | Standard CRUD lifecycle                       | `orders:read`    |

The stage-change payload looks like:

```json
{
  "entityId": "sh_01HW...",
  "entityType": "SHIPMENT",
  "flowId": "fl_01HW...",
  "flowKey": "last_mile_default",
  "fromStage": "out_for_delivery",
  "toStage": "delivered",
  "reason": "POD captured",
  "actor": { "type": "app", "id": "ai_01HW..." },
  "occurredAt": "2026-04-19T12:34:56.789Z"
}
```

---

## 7. Drive Operations transitions

Every tenant can define one or more **activity flows** per entity type —
directed graphs of stages that replace Witylogix's old hard-coded status
enum. Apps read flows with `operations:read`, and advance entities with
`shipments:transition` or `orders:transition`.

### 7.1 Discover the current flow and next stages

```bash
curl https://api.witylogix.com/api/v4/operations/shipments/sh_01HW.../next \
  -H "Authorization: Bearer wl_at_..."
```

Response:

```json
{
  "data": {
    "flowId": "fl_01HW...",
    "flowKey": "last_mile_default",
    "currentStage": "out_for_delivery",
    "next": [
      { "to": "delivered", "label": "Delivered" },
      {
        "to": "delivery_failed",
        "label": "Delivery failed",
        "requiredScope": "shipments:transition"
      }
    ]
  }
}
```

### 7.2 Advance the entity

```bash
curl -X POST \
  https://api.witylogix.com/api/v4/operations/shipments/sh_01HW.../transition \
  -H "Authorization: Bearer wl_at_..." \
  -H "Content-Type: application/json" \
  -d '{ "toStage": "delivered", "reason": "POD captured" }'
```

The engine validates that `out_for_delivery → delivered` exists in the
flow, checks any per-transition `requiredScope`, persists the new stage,
and emits `shipment.stage_changed` to every subscribed webhook. If the
transition is illegal you get `400` with a human-readable message such as
`Transition out_for_delivery → cancelled is not allowed`.

---

## 8. Uninstall and revocation

Tenants uninstall from the dashboard (`Installed apps` → `Revoke`), which
calls `DELETE /api/v4/oauth/installations/:id`. That single action:

1. Marks the `AppInstallation` as revoked.
2. Revokes every access and refresh token tied to it.
3. Deactivates every webhook endpoint the app registered for that tenant.

Apps can also revoke their own tokens at any time with
[RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009) `POST /api/v4/oauth/revoke`.
This is the recommended path when your users sign out of your app.

---

## 9. Security checklist

- PKCE is mandatory. Do not cache or log the verifier.
- `state` must be a cryptographically random, single-use value — match it
  on the callback or reject the request.
- Store `clientSecret`, `refresh_token`, and webhook signing secrets in an
  encrypted secret store, never in a repo or in logs.
- Honour the scope list on the token response; it may be a subset of what
  you requested if the tenant deselected optional scopes on the consent
  screen.
- Always verify webhook signatures before trusting payloads.
- On a `401` response with `error=invalid_token`, do not retry with the
  same token; refresh it first. On a `401` with `error=revoked` or a
  `400 invalid_grant` during refresh, purge all state for that installation.

---

## 10. Reference implementation

The [`examples/oauth-app-demo`](../../examples/oauth-app-demo) directory
contains a small Node server that implements the full flow end to end:
PKCE generation, consent redirect, token exchange, refresh, an
authenticated API call, webhook registration, and a scripted Operations
transition. Copy it, point it at your local Witylogix instance, and use it
as the starting point for a real app.
