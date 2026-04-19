# ADR-029: OAuth2 App Platform (Third-Party App Installs)

**Status:** Proposed
**Date:** 2026-04-19
**Deciders:** Arjun (CTO), Rahul (Platform)
**Supersedes:** None
**Relates to:** ADR-011 (Extension Architecture — Shopify UI), ADR-008 (Auth Provider Abstraction), ADR-010 (Event Bus Architecture)

---

## Executive Summary

Witylogix ships a first-party **OAuth2 authorization server** so third-party applications can be **installed by tenants** and call the public API with **scoped access tokens** — without sharing the tenant's master API key.

Today `ApiKey` (`packages/db/prisma/schema/60-auth.prisma`) is suitable for **tenant-issued integration keys** (script, CI, internal integration). It is not suitable for a **developer-registered application** that multiple tenants install, because:

- Keys belong to one org and are created by that org's admin.
- Keys have no concept of "installation" (developer app ↔ tenant ↔ consent).
- Revoking a developer-controlled integration requires per-tenant action on that tenant's keys.
- There is no authorization-code / consent flow for a SaaS developer hosting a hosted UI.

This ADR adds OAuth2 on top of the existing permission model and reuses existing scope helpers in `apps/api/src/middleware/auth.ts` and `packages/core/src/tenant/api-key-service.ts` wherever possible.

---

## Context

### What we already have

- **Tenant API keys** — `ApiKey` with `scopes[]` (`READ`, `WRITE`, `ADMIN`, `WEBHOOK`, `INTEGRATION`) plus fine-grained `permissions` JSON. Validation in `packages/core/src/tenant/api-key-service.ts::validateApiKey`.
- **JWT auth** — `requireAuth` in `apps/api/src/middleware/auth.ts` verifies dashboard/driver JWTs and Shopify App Bridge session tokens. It sets `request.auth.{ shopId, orgId, userId, role, orgRole }`.
- **Outbound webhooks** — DB-backed `WebhookEndpoint` in `packages/db/prisma/schema/30-outbound-webhooks.prisma` with full delivery/retry/circuit-breaker infrastructure (`packages/core/src/webhooks/*`).
- **SDK** — `@witylogix/sdk` for third-party code calling the API.

### What we do not have (gap)

A **marketplace-style app** needs:

1. A **developer-registered OAuth client** (independent of any one tenant).
2. A **consent screen** where a tenant admin authorizes that app with specific scopes.
3. **Per-install tokens** scoped to `(app, org)` (optionally `(app, org, shopId)`).
4. A consistent way for a tenant to **list and revoke** installations without touching their own API keys.

Without this, any attempt to let outside developers build on Witylogix forces them to ask each tenant to paste a master API key, which is unsafe and unmanageable.

### Non-goals (explicitly deferred)

- **In-process plugins / hot-loaded code** — `docs/bench/ARCHITECTURE.md` keeps the full plugin system deferred. Apps stay out-of-process and speak HTTP + webhooks.
- **Paid marketplace** with payouts.
- **Embedded iframes** inside the Witylogix dashboard for third parties (separate initiative).

---

## Decision

### 1. Introduce OAuth2 Authorization Code grant with PKCE

- New endpoints under `/api/v4/oauth`:
  - `GET  /oauth/authorize` — renders / completes consent for a logged-in tenant admin.
  - `POST /oauth/token` — exchanges `authorization_code` for access + refresh tokens; also refresh rotation.
- **PKCE is required** (`code_challenge_method=S256`). SPA/mobile public clients are supported without a client secret; confidential clients additionally present `client_secret`.
- **Grant types supported in v1:** `authorization_code`, `refresh_token`. We explicitly exclude `password`, `implicit`, and `client_credentials` in v1 (client_credentials can be added later for app-to-platform jobs).

### 2. Data model (new Prisma models in a new schema file)

- `OAuthClient` — developer-registered app (name, redirect URIs, `allowedScopes`, hashed `clientSecret`, owner user).
- `AppInstallation` — one row per (`oauthClientId`, `orgId`). Stores granted `scopes`, `status`, optional `shopId`, optional `webhookUrl`.
- `OAuthAuthorizationCode` — short-lived (≤10 min) single-use code bound to the installation and PKCE verifier.
- `OAuthAccessToken` — opaque token hash, `installationId`, `scopes`, `expiresAt`.
- `OAuthRefreshToken` — opaque token hash, `installationId`, optional rotation chain, `revokedAt`.

Rationale for separate models (rather than extending `ApiKey`):

- Different lifecycle (issued by a flow, not a user action).
- Different revocation semantics (revoke the **installation**, not an individual token).
- Different scope source (app-declared `allowedScopes` ∩ user-granted `scopes`).
- Clear audit trail: which app + which tenant, not "an integration key".

### 3. Scope catalog (single source of truth)

- Define scopes as a TypeScript constant in `packages/core/src/oauth/scopes.ts`, mirroring the existing coarse scopes but prefixed for clarity:
  - `shipments:read`, `shipments:write`
  - `orders:read`, `orders:write`
  - `operations:read`, `operations:write`, `shipments:transition`
  - `webhooks:manage`
- `ApiKey.scopes` continues to accept coarse `READ/WRITE/ADMIN`; the middleware maps `READ → *:read` etc. when enforcing.
- `OAuthClient.allowedScopes` and `AppInstallation.scopes` store the fine-grained strings.

### 4. Tokens: opaque, hashed at rest

Tokens are **opaque random strings** (`wit_oat_…` / `wit_ort_…`), hashed with SHA-256 at rest, looked up by an 8-byte prefix column — same shape as `ApiKey`.

We **do not** use JWT access tokens in v1 because:

- Revocation needs to be instant (install revoke, scope reduction, secret rotation).
- The lookup cost is a single prefix index + hash compare, which is already proven in `api-key-service.ts`.
- Payload obfuscation (what the app can infer about the tenant) is simpler with opaque tokens.

If a future requirement needs stateless verification in far-edge proxies, we can revisit and issue short-lived signed JWTs *in addition*, but the canonical storage stays opaque.

### 5. Middleware integration

`requireAuth` in `apps/api/src/middleware/auth.ts` gains a new branch: if the bearer token starts with `wit_oat_`, validate against `OAuthAccessToken`, set `request.auth` with:

- `orgId`, optional `shopId` (if the install was scoped to one shop).
- No `userId` / `driverId`.
- New `role = "APP"` (augment `AuthContext["role"]`).
- `installationId` and `scopes` (new optional fields).

A new `requireScope(...scope: string[])` helper sits alongside `requireRole` and enforces scope intersection on app tokens; for JWT/API-key requests it passes through with a mapping from coarse scopes.

### 6. Webhooks for installs

`WebhookEndpoint` gains an optional `installationId`. At install time the app may provide `webhookUrl`, which creates a `WebhookEndpoint` owned by that installation. Revoking the installation:

- Marks `AppInstallation.status = REVOKED`.
- Revokes all access & refresh tokens for that install.
- Disables (but does not delete) the linked `WebhookEndpoint` rows, preserving delivery history for audit.

### 7. Developer lifecycle

- Platform-level role (reuse existing `SUPER_ADMIN` for bootstrap; add `DEVELOPER` later) can register/rotate `OAuthClient` via `/api/v4/developer/oauth-clients`.
- Tenant admins see `Installed applications` in dashboard settings, with revoke + "connect" deep link.

---

## Consequences

### Positive

- Unlocks a real app ecosystem without requiring tenants to hand out master API keys.
- Cleaner audit trail (`installationId` on webhook deliveries and API calls) than current `ApiKey` usage.
- Opaque-token model reuses the hashing/prefix-lookup pattern already validated for API keys.
- Operations module (ADR-030) becomes the first vertical that exercises fine-grained scopes end-to-end.

### Negative / risks

- New surface area to secure — consent page, PKCE verification, token rotation. Mitigation: follow RFC 6749 + RFC 7636 exactly; write integration tests covering the classic attack shapes (auth code replay, redirect-uri mismatch, PKCE downgrade).
- Two permission vocabularies (`ApiKey` coarse scopes vs OAuth fine-grained scopes). Mitigation: single `scopes.ts` map translates between them inside middleware; docs call this out explicitly.
- Latency: one extra DB round-trip per app-authenticated request. Mitigation: token prefix index + Redis cache of `(prefix → installationId, scopes, expiresAt)` for hot tokens.

### Neutral

- AGPL-3.0 license: third-party apps *calling* the API are not derivatives. We will add a short note to the developer docs and keep legal review out of this ADR.

---

## Alternatives considered

1. **Reuse `ApiKey` directly.** Rejected: wrong ownership model (tenant-owned vs app-owned), no consent, weak revocation.
2. **JWT access tokens.** Rejected for v1 (see §4). Kept as a future add-on for edge-verification cases.
3. **Let apps register webhooks via the existing `/api/v4/outbound-webhooks` using an API key.** Possible today, but gives every app the tenant's master key and no scope intersection. Not a viable app platform.

---

## Implementation order

1. This ADR + ADR-030 accepted.
2. Prisma models + migration (`packages/db/prisma/schema/68-oauth.prisma`).
3. Token + PKCE helpers in `packages/core/src/oauth/`.
4. `/oauth/authorize` + `/oauth/token` routes in `apps/api/src/routes/oauth.ts`.
5. `requireAuth` branch for `wit_oat_` tokens; `requireScope` helper.
6. `/api/v4/developer/oauth-clients` CRUD.
7. Dashboard settings page: `Installed applications`.
8. Webhooks: attach `installationId`, document app-subscribable events.
9. Developer docs + example Node app.

---

## References

- RFC 6749 — The OAuth 2.0 Authorization Framework.
- RFC 7636 — PKCE.
- Existing code: `packages/core/src/tenant/api-key-service.ts`, `apps/api/src/middleware/auth.ts`, `packages/core/src/webhooks/webhook-manager.ts`.
- ADR-011 for the separate Shopify UI extension system (intentionally not reused here).
