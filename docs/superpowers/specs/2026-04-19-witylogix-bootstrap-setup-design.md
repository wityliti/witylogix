# Witylogix — Bootstrap & simplest-deploy design

**Status:** Draft for review  
**Date:** 2026-04-19  
**Related plan:** `.cursor/plans/onboarding_gap_analysis_cd53c8c9.plan.md` (onboarding gaps, Fleetbase comparison, self-hosted tiers, simplest-deploy vision)

## 1. Purpose

Define how operators and customers achieve a **minimal-friction** first run:

- **Self-host:** one command brings core services up; a **first-run setup UI** replaces hand-editing Tier A–B configuration where possible.
- **Witylogix managed:** customers never manage raw infrastructure env vars; **hybrid** model — default **multi-tenant SaaS**, **enterprise** option for **dedicated** stack per tenant.

This document is the **design gate** before application implementation. **Golden-path Docker Compose / Railway templates** remain **DevOps-owned** per `CLAUDE.md` (agents do not modify Docker or deploy to Railway).

## 2. Goals

| ID | Goal |
|----|------|
| G1 | After deploy, an operator reaches a **working dashboard** without reading dozens of env keys. |
| G2 | **Secrets** (JWT, provider keys) are captured **once**, stored safely, and never echoed in full to the browser after save. |
| G3 | **Self-host** and **managed** share the **same application behavior**; differ only in who provisions Postgres/Redis and secrets. |
| G4 | Setup path is **hard to abuse** (no open reinstall on public internet without bootstrap token or equivalent). |

## 3. Non-goals (v1)

- Replacing all `.env` documentation — **operator checklist** remains for advanced cases.
- Full Fleetbase-scale onboarding (billing, 25-screen infra wizard) — out of scope unless product explicitly expands.
- Coding agents modifying **Docker / Paperclip** configs — forbidden; handoff to **DevOps** for compose and Railway templates.

## 4. Actors and scenarios

### 4.1 Self-host on VM + Docker

1. Operator runs blessed **one command** (e.g. `docker compose up -d` — exact command TBD by DevOps).
2. Stack exposes HTTPS (via documented reverse proxy or bundled edge — TBD).
3. Browser hits dashboard URL; app detects **setup incomplete** → redirect to **`/setup`** (or dedicated setup host).
4. Operator completes steps (see §6), clicks **Finish**; API persists config, sets `SETUP_COMPLETE=true` (or equivalent), restarts or reloads as needed.
5. Normal login and onboarding for **tenant users** proceed.

### 4.2 Self-host on Railway

Same as §4.1 except provision uses **Railway template** or documented `railway` workflow; env vars may be partially pre-wired. **Setup UI** is identical.

### 4.3 Witylogix managed (hybrid)

- **Default:** multi-tenant SaaS — shared clusters, tenant isolation in app/DB.
- **Enterprise:** dedicated Postgres/Redis (and optionally isolated deploy) — **sales/ops** provision; customer **never** sees `DATABASE_URL`.

## 5. Configuration tiers (recap)

Aligned with plan appendix **Tier A–D**:

- **Tier A:** `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `NODE_ENV` — must be satisfiable via setup UI **or** pre-injected for managed.
- **Tier B:** `CORS_ORIGINS`, `DASHBOARD_URL`, `TRACKING_PAGE_URL`, dashboard `NEXT_PUBLIC_*` — setup UI must collect **canonical public URLs**; implementation must resolve **build-time vs runtime** API URL (see §7).
- **Tier C/D:** Email, routing, Shopify, observability — **optional** steps in setup wizard with “skip for now” and clear **degraded behavior** copy.

## 6. First-run setup UI — functional requirements

### 6.1 Detection

- **Condition:** setup UI shown when platform is **not** marked complete (e.g. env `SETUP_COMPLETE` / `WITYLOGIX_SETUP_COMPLETE` or missing critical secrets — exact flag TBD in implementation).
- **API behavior:** either a **read-only bootstrap** mode or dedicated **setup** routes that do not require normal JWT until after admin password/bootstrap token is set.

### 6.2 Steps (suggested order)

1. **Welcome** — what will be configured; link to advanced docs.
2. **Public URLs** — dashboard URL, API public URL, tracking URL; validate HTTPS in production.
3. **Secrets** — generate `JWT_SECRET` client-suggested, server-stored; never return full value after save.
4. **Data stores** — if not pre-provisioned: test **Postgres** and **Redis** connectivity (server-side checks only).
5. **Email (optional)** — provider + test send to operator email.
6. **Routing (optional)** — Mapbox token or OSRM URL per `ROUTING_PROVIDER`.
7. **Review & finish** — summary; **Finish** commits and locks setup.

### 6.3 Security

- **Bootstrap token:** single-use token in env or file on first boot, required to open `/setup` from non-loopback — **recommended** for internet-facing installs.
- **Rate limit** setup endpoints aggressively.
- **Idempotency:** finishing twice must be safe (no double admin creation).

## 7. Frontend: public API URL

**Problem:** Next.js often bakes `NEXT_PUBLIC_API_URL` at **build** time.

**Options (pick one in implementation plan):**

- **A.** Document rebuild of dashboard image when API URL changes (simplest, worse UX).
- **B.** **Runtime config:** small `GET /api/v4/bootstrap/public-config` (or static JSON from edge) returns `apiBaseUrl` read by dashboard shell — **preferred** for single-image multi-domain deploys.

Design assumes **B** unless timeline forces **A**.

## 8. Backend: persistence of setup

- **Docker/VM:** written to **env file on volume** or **secrets manager** — implementation choice; must survive restarts.
- **Managed:** Witylogix internal vault; not this UI.

## 9. Observability

- Log setup start/finish (no secrets).
- Metric: time-to-first-successful-setup (product analytics).

## 10. Phased delivery

| Phase | Deliverable | Owner |
|-------|-------------|--------|
| P0 | Operator checklist + CI env validation | Eng + docs |
| P1 | DevOps: golden-path compose +/or Railway template README | DevOps |
| P2 | Setup UI + bootstrap API + security model | Eng |
| P3 | Managed funnel polish (hide complexity) | Product + Eng |

## 11. Dependencies on other work

- **Onboarding:** wire `verify-email` / `resend` / `persistProgress` to real API — otherwise “email step” in product onboarding stays broken even if deploy is easy ([plan todos](file:///Users/youthocrat/.cursor/plans/onboarding_gap_analysis_cd53c8c9.plan.md)).

## 12. Open questions

1. Exact env flag name(s) for `SETUP_COMPLETE` and compatibility with existing deployments.
2. Whether `/setup` lives in **dashboard** app or **minimal separate** setup app (smaller attack surface).
3. Reverse proxy: **required** in v1 docs vs **bundled** in compose (DevOps).

## 13. Approval

- [ ] Product sign-off on scope (P0–P3).
- [ ] Security review on bootstrap token and setup routes.
- [ ] DevOps sign-off on golden-path ownership and template timeline.

---

*Self-review: No “TBD” left without §12; architecture consistent with `apps/api/src/lib/config.ts` and plan appendix.*
