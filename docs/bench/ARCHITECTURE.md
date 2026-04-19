# Witylogix Bench — Architecture

**Version:** 0.1.0-draft | **Status:** Design | **Last Updated:** 2026-04-19

Witylogix Bench is the provisioning and operations layer for the Witylogix platform. It is modeled on the Frappe Bench + Frappe Cloud split: an **open-source CLI** that anyone can use to self-host Witylogix on any infrastructure, and a **managed cloud control plane** that uses the same engine to run Witylogix-as-a-Service.

---

## Table of Contents

1. [Goals & Non-Goals](#goals--non-goals)
2. [Two-Artifact Split](#two-artifact-split)
3. [Repo Layout](#repo-layout)
4. [CLI UX](#cli-ux)
5. [Configuration Model](#configuration-model)
6. [Provider Adapter Interface](#provider-adapter-interface)
7. [Tenant Isolation Model](#tenant-isolation-model)
8. [Versioning & Upgrade Flow](#versioning--upgrade-flow)
9. [Secrets Management](#secrets-management)
10. [Cloud Control Plane](#cloud-control-plane)
11. [Security Model](#security-model)
12. [Observability](#observability)
13. [Licensing](#licensing)
14. [Phasing / Roadmap](#phasing--roadmap)
15. [Open Decisions](#open-decisions)

---

## Goals & Non-Goals

### Goals

- **One-command self-host.** `npx @witylogix/bench init my-company` produces a running Witylogix stack in <10 minutes on a fresh machine.
- **Provider-agnostic.** Same `bench.config.yaml` targets Docker Compose, Railway, Fly.io, Kubernetes, or bare Systemd.
- **Repeatable operations.** `backup`, `restore`, `update`, `rotate-secret`, `doctor` are deterministic and idempotent.
- **Shared engine between Self-Host and Cloud.** The managed cloud offering is "just another deployment" driven by the same core — no forked logic.
- **Observability-first.** Every bench command emits structured events and optional OpenTelemetry traces.
- **Safe by default.** No destructive operation runs without confirmation or a `--yes` flag; all mutations are audit-logged.

### Non-Goals

- **Not a general PaaS.** Bench provisions Witylogix and its direct dependencies (Postgres, Redis, object storage, reverse proxy). It does not deploy arbitrary apps.
- **Not a replacement for Prisma/Turbo.** Bench orchestrates them; it does not reimplement them.
- **Not a secret manager.** Bench integrates with Doppler, SOPS, Railway Variables, Fly Secrets — it does not store plaintext secrets itself.
- **Not responsible for DNS or SSL provisioning details.** Bench drives provider APIs (Cloudflare, Let's Encrypt via Caddy, provider-native TLS) but does not implement ACME.

---

## Two-Artifact Split

| Artifact | Purpose | Audience | License | Distribution |
|----------|---------|----------|---------|--------------|
| **`@witylogix/bench` (CLI)** | Provision, operate, upgrade a Witylogix installation. | Self-hosters, contributors, Witylogix DevOps. | MIT | npm, `npx`, eventually `pkg`-bundled binary |
| **Witylogix Cloud (`apps/bench-web`)** | SaaS control plane that uses the CLI's core as a library to run our managed offering. Billing, tenant lifecycle, audit log, SUPERADMIN console. | Witylogix internal operators (for v1); customer self-service signup (v2). | Source-available (BSL) or private | Deployed internally only |

Key invariant: **everything the Cloud control plane does is expressible as CLI commands.** If we can't drive it from the CLI, we don't add it to the Cloud.

---

## Repo Layout

```
witylogix-platform/
├── apps/
│   ├── api/                    # existing
│   ├── dashboard/              # existing — tenant users
│   ├── customer-portal/        # existing — end customers
│   ├── ...
│   └── bench-web/              # NEW — Witylogix Cloud control plane (private)
├── packages/
│   ├── bench-cli/              # NEW — @witylogix/bench (MIT, published to npm)
│   ├── bench-core/             # NEW — provisioning engine, config loader, orchestration (MIT)
│   └── bench-providers/
│       ├── docker-compose/     # NEW — default provider (MIT)
│       ├── railway/            # NEW — Witylogix Cloud production provider (MIT)
│       ├── fly/                # later
│       ├── k8s/                # later
│       └── systemd/            # later
└── docs/
    └── bench/
        ├── ARCHITECTURE.md     # this doc
        ├── GETTING_STARTED.md
        ├── CONFIG_REFERENCE.md
        └── PROVIDERS.md
```

**Why separate `bench-cli` and `bench-core`:** the Cloud control plane imports `bench-core` directly as a library (no shell-out to the CLI). The CLI is a thin argument-parsing layer over the core.

---

## CLI UX

### Install

```bash
# one-shot, no install
npx @witylogix/bench init my-company

# or global
pnpm add -g @witylogix/bench
witylogix init my-company
```

### Command Surface (v0.1)

| Command | Purpose |
|---------|---------|
| `bench init <name>` | Scaffold a new installation directory with `bench.config.yaml`, secrets template, provider defaults. |
| `bench doctor` | Check preconditions: Docker, Node, Postgres reachability, disk space, ports. |
| `bench start [service]` | Bring services up. `start` alone starts everything; `bench start api` starts one. |
| `bench stop [service]` | Graceful shutdown. |
| `bench restart [service]` | Rolling restart. |
| `bench logs <service> [--follow]` | Tail logs from the provider. |
| `bench status` | Health matrix: service, state, version, health check, last deploy. |
| `bench migrate` | Run Prisma migrations on the current database. Safe to run repeatedly. |
| `bench new-tenant <slug>` | Create a tenant row + default seed data in the running platform. Used for Managed plan. |
| `bench backup [--to <path>]` | DB dump + uploads archive + config snapshot. |
| `bench restore <archive>` | Inverse of `backup`. Requires `--yes` if target DB is non-empty. |
| `bench update [--to <version>]` | Pull new Witylogix version, run migrations, blue/green swap if provider supports. |
| `bench rotate-secret <key>` | Rotate a managed secret through the configured secret backend. |
| `bench deploy <provider>` | Apply `bench.config.yaml` to the provider (creates/updates all services). |
| `bench destroy` | Tear down the installation. Requires `--yes` and name confirmation. |

### Command Surface (v0.2+)

- `bench use <version>` — switch active Witylogix version (for multi-version test hosts)
- `bench branch <name>` — blue/green clone of a running environment for a staging copy
- `bench console` — attach a REPL to the API server for emergency ops
- `bench export-tenant <slug>` / `bench import-tenant <archive>` — move a tenant between installations
- `bench plugin <add|remove|list>` — install optional Witylogix addons (integrations, custom workflows)

### UX principles

- **Progress visible, not silent.** Every long-running command prints a live task tree.
- **Dry-run everywhere.** `--dry-run` prints what would change; works on every mutating command.
- **JSON mode.** `--json` on any command emits machine-readable output for the Cloud control plane and CI.
- **Exit codes are contracts.** `0` success, `1` user error, `2` preflight failure, `3` provider error, `4` partial failure (rolled back), `5` partial failure (NOT rolled back — human needed).

---

## Configuration Model

A single file, `bench.config.yaml`, checked into the customer's own repo (or managed by the Cloud):

```yaml
# bench.config.yaml
apiVersion: bench.witylogix.io/v1
kind: Installation
metadata:
  name: acme-prod
  owner: acme-corp
  contact: ops@acme.example

witylogix:
  version: 4.0.0           # semver, null = "latest stable"
  channel: stable          # stable | beta | canary

provider:
  type: docker-compose     # docker-compose | railway | fly | k8s | systemd
  config:
    project: acme-prod
    region: iad             # provider-specific

services:
  api:
    replicas: 2
    resources: { cpu: "1", memory: "1Gi" }
  dashboard:
    replicas: 1
    domain: dash.acme.example
  customer-portal:
    replicas: 1
    domain: track.acme.example
  tracking-page:
    replicas: 1

database:
  provider: postgres-managed   # or postgres-external | postgres-self-hosted
  version: "16"
  isolation: rls               # rls (default) | dedicated
  backup:
    schedule: "0 3 * * *"
    retention_days: 30

redis:
  provider: redis-managed       # or redis-external | redis-self-hosted
  version: "7"

secrets:
  backend: file                 # file | doppler | sops | railway | fly
  path: ./secrets/              # for backend=file
  # for backend=doppler:
  # project: acme-prod
  # config: prd

observability:
  traces: { enabled: true, otlp_endpoint: "..." }
  logs: { sink: loki, endpoint: "..." }
  metrics: { prometheus_scrape: true }

cloud:                          # only present if managed by Witylogix Cloud
  plan: managed                 # managed | dedicated
  tenant_slug: acme
  billing_id: sub_123
```

Core invariants:
- Everything in this file is declarative. Bench reconciles reality to match it.
- Unset fields inherit provider defaults; no mandatory fields beyond `metadata.name` and `provider.type`.
- Secrets are NEVER stored in `bench.config.yaml` — only references to the secret backend.

---

## Provider Adapter Interface

Every provider implements a common TypeScript interface:

```ts
// packages/bench-core/src/provider/types.ts
export interface Provider {
  readonly id: string;

  preflight(ctx: Context): Promise<PreflightResult>;
  provision(ctx: Context, plan: Plan): Promise<ProvisionResult>;
  deploy(ctx: Context, plan: Plan): Promise<DeployResult>;
  logs(ctx: Context, service: string, opts: LogOptions): AsyncIterable<LogLine>;
  status(ctx: Context): Promise<StatusReport>;
  backup(ctx: Context, target: BackupTarget): Promise<BackupResult>;
  restore(ctx: Context, archive: BackupArchive): Promise<RestoreResult>;
  rotateSecret(ctx: Context, key: string): Promise<void>;
  destroy(ctx: Context, confirm: DestroyConfirmation): Promise<void>;
}
```

A `Plan` is the diff between the desired `bench.config.yaml` and the current live state. Providers are pure functions of `(currentState, desiredState) -> operations[]`; the core executes operations and collects results.

### Provider Matrix (v0.1 → v1.0)

| Provider | v0.1 | v0.5 | v1.0 |
|----------|:----:|:----:|:----:|
| docker-compose | ✅ full | ✅ full | ✅ full |
| railway | ✅ deploy, logs, status | ✅ backup, restore, rotate | ✅ full |
| fly | — | ⏳ deploy, logs | ✅ full |
| k8s (helm) | — | — | ⏳ deploy, logs |
| systemd | — | — | ⏳ deploy, logs |

---

## Tenant Isolation Model

Witylogix already has a single-database, RLS-enforced multi-tenancy model (see `docs/architecture/ARCHITECTURE.md` §7). Bench does **not** introduce schema-per-tenant or DB-per-tenant inside a single installation. Instead, Bench distinguishes between **plans**:

### Managed plan (shared installation)

One Witylogix installation hosts many customers. Bench's `new-tenant` command creates a tenant row and seeds default data. RLS isolates them. This is the cheapest plan; operations (upgrade, backup, monitoring) happen once for all tenants.

### Dedicated plan (isolated installation)

Bench provisions a **whole new installation** per customer — own Postgres, own Redis, own services, own domain. Same CLI, different `bench.config.yaml`. Used for enterprise customers with compliance requirements.

### Hybrid (v1.0+)

Customer-specific services (e.g. custom integrations) run in a dedicated sidecar that connects to a shared core. Deferred until managed + dedicated are proven.

---

## Versioning & Upgrade Flow

### Versions

- **Witylogix versions** follow semver, cut from the `main` branch after `staging` passes.
- **Bench versions** are independent and follow semver; a Bench `0.x` can target multiple Witylogix `4.x.y`.
- `bench.config.yaml` pins `witylogix.version` exactly; `channel` controls auto-bump behavior.

### Upgrade Path

```
bench update --to 4.1.0
  → preflight checks (disk, DB version, breaking changes)
  → backup current state
  → pull new images / run new build
  → for providers with blue/green: spin up new stack, smoke test, swap traffic
  → for providers without: rolling restart with DB migrations between old/new
  → run post-deploy hooks
  → emit audit event with before/after hash
```

Rollback is `bench update --to <previous>` or `bench restore <pre-upgrade-backup>`.

---

## Secrets Management

Bench does not store plaintext secrets. It speaks to a pluggable backend:

| Backend | Use Case |
|---------|----------|
| `file` | Local dev, simple self-host (gitignored `.env`-style files) |
| `doppler` | Team self-host, centralized rotation |
| `sops` | Git-stored encrypted secrets with KMS |
| `railway` | Witylogix Cloud production (Railway Variables) |
| `fly` | Fly.io installations |

The backend is declared in `bench.config.yaml` → `secrets.backend`. The CLI fetches secrets at runtime and injects them into provider deployments. Bench never writes plaintext secrets to disk except under `secrets.backend: file`.

`bench rotate-secret <key>` generates a new value, updates the backend, redeploys affected services, and records the rotation in the audit log.

---

## Cloud Control Plane

`apps/bench-web` is a Next.js admin application used by Witylogix's DevOps team to operate the managed and dedicated offerings. **It is not user-facing in v1** — customer signup for managed cloud comes in v2.

### Core screens (v1)

- **Tenants** — list of all tenants across all installations, with plan, installation, owner, health.
- **Installations** — list of managed+dedicated installations. Click through → live status, recent deploys, logs, backups.
- **Provision** — wizard to create a new installation (wraps `bench init` + `bench deploy`).
- **Upgrades** — fleet view of Witylogix versions, scheduled upgrade windows, dry-run results.
- **Audit log** — every bench action with actor, IP, diff.
- **Secrets** — read-only view (values redacted) + rotation buttons.
- **Billing** — Stripe subscription state per tenant (v2).

### Backend

The control plane calls `bench-core` as a library (no shelling out). Long-running operations go onto a job queue (BullMQ on Redis) with progress streamed to the browser via Socket.io.

### Customer signup (v2)

Public `cloud.witylogix.io` → plan selection → Stripe checkout → webhook triggers `bench-core.provisionTenant(...)` → email delivered with dashboard URL. Same engine, automated.

---

## Security Model

### CLI

- No privileged operations without explicit `--yes` or interactive confirmation.
- Every destructive command requires typing the installation name.
- Provider credentials stored only in the configured secret backend.
- Audit log written locally to `./bench.audit.log` and, if configured, streamed to the Cloud.

### Cloud control plane

Separate concerns from the tenant-facing dashboard:

| Control | Requirement |
|---------|-------------|
| Network | Private deploy (separate Railway project), no public ingress except auth endpoint. |
| Auth | WebAuthn/hardware-key MFA mandatory. Password auth disabled. |
| Session | 1-hour idle timeout, 8-hour max session, per-tab session binding. |
| Authorization | Single role: `BENCH_ADMIN`. All actions role-gated at route, API, and UI layers. |
| Audit | Every mutation logged with actor, IP, request hash, before/after diff. |
| Break-glass | Time-limited signed token for emergency access, requires two approvers, auto-expires, auto-alerts. |
| Provider credentials | Stored in Railway Variables, mounted read-only, never returned to the browser. |

Threat model focuses on:
1. Compromised Bench operator credentials (mitigated: WebAuthn + audit + break-glass review).
2. Compromised provider API token (mitigated: scoped tokens per installation, rotation via `rotate-secret`).
3. Tenant data leak via provisioning misconfiguration (mitigated: policy tests on every generated plan before apply).

---

## Observability

### CLI

- Structured JSON logs to stderr with `--json`.
- OpenTelemetry traces exported if `observability.traces.enabled=true`.
- Progress events emitted on stdout for interactive use.

### Cloud

- Every installation optionally forwards its logs/traces/metrics to a central stack (Loki + Tempo + Prometheus or Grafana Cloud).
- Bench emits its own audit metrics: `bench_deploy_duration_seconds`, `bench_upgrade_total{result=...}`, `bench_backup_last_success_timestamp`.

---

## Licensing

| Component | License | Rationale |
|-----------|---------|-----------|
| `@witylogix/bench` (CLI) | MIT | Encourages adoption, no friction for self-hosters. |
| `@witylogix/bench-core` | MIT | Same engine drives open-source and Cloud — must be MIT for Cloud to use it without copyleft complications. |
| `@witylogix/bench-providers/*` | MIT | Community contributions welcome. |
| `apps/bench-web` (Cloud) | Source-available (BSL 1.1 with 2-year convert-to-Apache-2.0) OR private | Protects the managed offering while still signaling openness. Decision deferred to launch. |

Trademark policy: "Witylogix" is a protected mark; forks/self-hosts must not use the name for competing managed offerings. Rebrandable via a future `bench.config.yaml` → `branding` block.

---

## Phasing / Roadmap

### Phase 0 — Spec & scaffold (this doc, 1 week)

- Approve this doc
- Create `packages/bench-cli`, `packages/bench-core`, `packages/bench-providers/docker-compose`
- Stub commands: `init`, `doctor`, `start`, `stop`, `status`
- CI: lint, typecheck, unit tests

### Phase 1 — Self-host complete on Docker Compose (2–3 weeks)

- Full command surface from §CLI UX v0.1
- `bench init` generates a working Docker Compose stack
- `bench migrate`, `backup`, `restore`, `update` all work on a single machine
- `docs/bench/GETTING_STARTED.md` written and tested on a fresh VM
- **Exit criteria:** a new engineer runs `npx @witylogix/bench init demo && cd demo && bench start` on a clean laptop and has a working Witylogix in under 15 minutes

### Phase 2 — Railway provider + Cloud control plane v1 (3–4 weeks)

- `packages/bench-providers/railway` with `deploy`, `logs`, `status`
- `apps/bench-web` skeleton with Tenants, Installations, Provision screens
- Audit log end-to-end
- Migrate Witylogix's own production to be managed by Bench
- **Exit criteria:** Witylogix production is provisioned and upgraded through Bench

### Phase 3 — Open source release (1–2 weeks)

- Publish `@witylogix/bench` 0.1.0 to npm
- Getting-started docs, video walkthrough, contribution guide
- `bench.witylogix.io` landing page

### Phase 4 — Multi-provider + customer signup (4+ weeks)

- Fly, K8s providers
- Public `cloud.witylogix.io` signup flow
- Stripe billing integration
- Blue/green upgrade flow

---

## Open Decisions

These are deliberately left unresolved in this draft; each one blocks its respective phase:

1. **BSL vs private for `apps/bench-web`** — deferred to Phase 3.
2. **Docker Compose vs Podman default** — leaning Docker Compose for adoption; Podman flag for enterprise/security-conscious users.
3. **Config file name** — `bench.config.yaml` vs `witylogix.yaml` vs `Benchfile`. Current pick: `bench.config.yaml`.
4. **Scoped vs unscoped npm package** — `@witylogix/bench` (scoped) vs `witylogix-bench` (unscoped). Scoped preferred for namespace hygiene.
5. **Plugin model for v1** — full plugin system is deferred; v0.1 has no plugins, all functionality in-tree.
6. **Bench web auth provider** — Clerk vs WorkOS vs self-built WebAuthn. Decision at Phase 2 start.
7. **Tenant export/import format** — Phase 4 feature, format TBD.

---

## Appendix: Inspirations and Differentiators

| Tool | What we borrow | What we differ on |
|------|----------------|-------------------|
| Frappe Bench | CLI-first, self-host-first, one command to stand up a full stack. | TypeScript/Node instead of Python; provider-agnostic instead of Nginx+supervisord-only. |
| Frappe Cloud | SaaS control plane driving the same CLI/engine; plan tiers (managed vs dedicated). | Cloud dashboard is BSL/private, not open-core-competitive. |
| Vercel CLI | Smooth `deploy` UX, progress reporting, dry-run semantics. | Own your own infrastructure; not tied to one provider. |
| Railway CLI | Simple env/service model, pragmatic provider-first. | Declarative config file, not imperative-only. |
| Supabase CLI | `supabase start` → full local stack via Docker Compose. | Bench also targets prod, not just local dev. |
| Kubernetes Helm | Declarative, versioned releases, rollback. | No Kubernetes required for 80% of users. |

---

**Next step after approval:** create `feat/WIT-bench-scaffold` branch off `staging`, scaffold `packages/bench-cli`, `packages/bench-core`, `packages/bench-providers/docker-compose`, implement `init` + `doctor` + `start`/`stop` against Docker Compose.
