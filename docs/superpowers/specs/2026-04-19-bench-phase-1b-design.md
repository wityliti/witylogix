# Witylogix Bench — Phase 1b Design

**Date:** 2026-04-19
**Status:** Design, awaiting implementation
**Scope:** `bench migrate`, `bench new-tenant`, `bench backup`, `bench restore`
**Supersedes:** nothing (first spec in the series)
**Related docs:** [`docs/bench/ARCHITECTURE.md`](../../bench/ARCHITECTURE.md)

---

## 1. Context & Goals

Phase 1a shipped the Witylogix Bench scaffold: `init`, `doctor`, `start`, `stop`, `status`, `deploy`, `logs`, `destroy` backed by a Docker Compose provider. Phase 1b completes the Phase 1 (self-host) command surface by adding the four operational verbs a real deployment needs: database migrations, tenant provisioning, full backups, and restore.

### North Star

Outperform Fleetbase. Fleetbase's CLI (`@fleetbase/cli`) has no documented backup/restore, no multi-tenant provisioning command, and delegates migrations to a bare `php artisan migrate` inside the application container — with no downtime protection, no rollback story, no audit trail. Witylogix Bench should be:

- **Safer by default** — windowed migrate with auto-rollback-backup, constant-time token checks, manifest-verified restores.
- **More portable** — backup archives self-describe enough to restore into a different installation, including optional blob snapshots for cross-storage-backend moves.
- **More observable** — every operation emits a structured audit event; `--json` mode makes CI integration trivial.
- **Provider-agnostic** — everything that Phase 1b ships works identically on Docker Compose today and Railway/Fly/K8s tomorrow, via a two-primitive additions to the `Provider` interface.

### Non-goals

- Cloud control plane (`apps/bench-web`) — Phase 2.
- Billing integration, Stripe, customer self-signup — Phase 4.
- Blue/green migrations with dual-write — Phase 1c at earliest.
- Scheduled backups, cron, off-site sync — Phase 1c.
- Remote backup targets (`--to s3://...`) — Phase 1c. Only local paths in 1b.
- Incremental backups — every backup is a full snapshot.

---

## 2. Architecture & Shared Contract

Four commands share two new seams.

### 2.1 Seam 1 — Bench Admin API (new in `apps/api`)

A narrow, versioned namespace at `/internal/bench/*` in the Fastify API, gated by a shared `BENCH_SERVICE_TOKEN`.

| Verb / Path | Used by | Purpose |
|-------------|---------|---------|
| `GET  /internal/bench/health` | migrate, status | version + migration state |
| `POST /internal/bench/drain` | migrate, restore | puts API into drained/offline mode before shutdown |
| `POST /internal/bench/tenants` | new-tenant | provisions a tenant via `WorkspaceProvisioner` |

All endpoints require `Authorization: Bearer <BENCH_SERVICE_TOKEN>`. The Fastify route group registers only when the env var is present — installations that don't use Bench have zero attack surface.

### 2.2 Seam 2 — `bench-core` ops modules

Four new modules in `packages/bench-core`:

| Module | Responsibility |
|--------|----------------|
| `ops/migrate.ts` | Orchestrates drain → stop → migrate → verify → start |
| `ops/tenants.ts` | Thin HTTP client for the admin endpoint (no business logic) |
| `ops/backup.ts` | Archive writer (DB dump, config snapshot, optional blobs) |
| `ops/restore.ts` | Archive reader, manifest verifier, inverse of backup |

Each module is a pure library function that takes a `Context` and returns a result. The CLI and, in Phase 2, the Cloud control plane both import from `ops/*` directly. No CLI-specific logic in core.

### 2.3 Provider interface extension

Two new primitives on `Provider`:

```ts
interface Provider {
  // ...existing...

  /**
   * Runs a command inside a named service container.
   * For docker-compose: `docker compose exec <service> <cmd...>`.
   * For Railway/Fly/K8s: provider-specific equivalent.
   */
  execInService(
    ctx: Context,
    service: string,
    cmd: string[],
    opts?: { stdin?: Readable; env?: Record<string, string> },
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;

  /**
   * Spawns a short-lived one-shot container from a named service's image.
   * Used for `prisma migrate deploy` against a stopped API.
   */
  runOneShot(
    ctx: Context,
    fromService: string,
    cmd: string[],
    opts?: { env?: Record<string, string> },
  ): Promise<{ exitCode: number; stdout: string }>;
}
```

Providers that cannot `exec` into a running container (hypothetical K8s without `kubectl exec`) can implement both via a sidecar pattern.

---

## 3. Bench Admin API Details

### 3.1 Token lifecycle

- **Generate**: `bench init` creates a 32-byte random base64url token, writes to `secrets/bench-service-token` (gitignored), permissions `0600`.
- **Inject**: At deploy time, the provider mounts the token as `BENCH_SERVICE_TOKEN` env var into the `api` service.
- **Read**: `bench-core/ops/tenants.ts` reads it from the secrets backend at runtime.
- **Rotate**: `bench rotate-secret bench-service-token` generates a new value, writes to backend, triggers a rolling restart of the `api` service. Old token invalidated on restart.

### 3.2 Endpoints

```text
GET /internal/bench/health
  Auth: Bearer <BENCH_SERVICE_TOKEN>
  200: {
    apiVersion: "4.0.0",
    witylogixVersion: "4.0.0",
    prismaMigrations: { applied: 142, pending: 0 },
    drained: false,
    uptimeSec: 12847
  }
  401: invalid token
```

```text
POST /internal/bench/drain
  Auth: Bearer
  Body: { mode: "read-only" | "offline", reason?: string }
  200: { state: "drained", mode, drainedAt }
  Semantics:
    - "read-only" → POST/PUT/DELETE/PATCH return 503 Service Unavailable
      with Retry-After: 60. GET still served.
    - "offline"   → all routes except /internal/bench/health return 503.
  Drain is ephemeral in-memory state; a restart clears it.
```

```text
POST /internal/bench/tenants
  Auth: Bearer
  Body: {
    slug: string,          // /^[a-z0-9][a-z0-9-]{1,62}$/
    ownerEmail: string,
    ownerName: string,
    plan?: "starter" | "pro" | "enterprise",  // default: "starter"
    features?: Record<string, unknown>,
    limits?: Record<string, unknown>
  }
  201: { tenantId, orgId, subdomain }
  400: validation errors (field-level)
  409: slug or email already in use
  500: upstream provisioner failure
  Implementation: zod validate → workspaceProvisioner.provisionWorkspace(...)
```

### 3.3 Security layers

1. **Bearer token**: constant-time compare via `crypto.timingSafeEqual` on a hashed form stored in memory.
2. **Registration gate**: Fastify plugin only registers if `BENCH_SERVICE_TOKEN` env is present.
3. **CIDR allow-list**: optional `BENCH_ALLOWED_CIDRS` env; defaults to Docker bridge range `172.16.0.0/12`, loopback `127.0.0.1/32`, and `::1`.
4. **Audit**: every request writes an `audit_log` row — actor `bench`, SHA-256 of the bearer token, request path, outcome, duration, initiator `X-Bench-Initiator` header (`cli` or `cloud`).
5. **Rate limit**: shared Fastify rate-limit plugin, 60/min per token (defense against accidental loops).

### 3.4 Files touched in `apps/api`

- `apps/api/src/routes/internal/bench.ts` — new, the three routes.
- `apps/api/src/server.ts` — register plugin conditionally.
- `apps/api/src/middleware/bench-auth.ts` — new, shared Bearer verifier + CIDR gate.
- `apps/api/src/__tests__/internal-bench.test.ts` — 12 contract tests.

---

## 4. `bench migrate` — Windowed Strategy

### 4.1 Command

```text
bench migrate [--skip-backup] [--yes] [--timeout <seconds>]
```

Defaults: auto-backup enabled, no `--yes` required unless destructive, 600s timeout.

### 4.2 Sequence (9 steps)

1. **Preflight**: config loaded, API reachable via `/health`, count `pending` migrations. Abort with exit 1 if zero unless `--force`.
2. **Auto-backup** (unless `--skip-backup`): calls `ops/backup.run({ ctx, to: ".bench/backups/pre-migrate-<ts>.wbak", includeBlobs: false })` as a **library call** (never shells out to `bench backup`). Path recorded for step 9 audit.
3. **Drain**: `POST /internal/bench/drain { mode: "offline" }`.
4. **Stop app services**: provider stops `api`, `dashboard`, `customer-portal`, `tracking-page`, `docs`. Postgres and Redis keep running.
5. **Run migrations**: `provider.runOneShot(ctx, "api", ["pnpm", "prisma", "migrate", "deploy"])`. The provider inherits the full env of the `api` service (including `DATABASE_URL`, `BENCH_SERVICE_TOKEN`, etc.), so no explicit env plumbing is needed. Exits 0 on success.
6. **Verify**: short-lived psql exec query against `_prisma_migrations`; assert all pending rows now show `finished_at IS NOT NULL AND rolled_back_at IS NULL`.
7. **Restart app services**: provider brings them back up.
8. **Post-check**: poll `GET /internal/bench/health` up to 30s; require `pending: 0` and `applied` increased by expected count. Waits for container to become healthy.
9. **Audit**: `bench.migrate.completed` event with before/after migration IDs, duration, backup path. Exit 0.

### 4.3 Failure handling

| Failure at | Behavior | Exit |
|-----------|----------|------|
| 1–2 | Abort, no state change. | 1 / 2 |
| 3 | Drain applied but services still up — request cancellation reverts drain. | 2 |
| 4 | Services partly stopped — clear message to run `bench start`. | 5 |
| 5 | Migration script exited non-zero; DB partially migrated; services remain stopped. Message: "rollback via `bench restore <auto-backup-path>` or fix schema and re-run `bench migrate`." | 5 |
| 6 | Verification mismatch; services still stopped. Same rollback guidance as 5. | 5 |
| 7 | Services failed to start; DB migrated; human must intervene. | 5 |
| 8 | Services up but health check fails — loud warning, audit `status: degraded`. | 4 |

### 4.4 CLI UX

```
$ bench migrate
⟳ preflight — 3 pending migrations
✓ auto-backup → .bench/backups/pre-migrate-20260420-143022.wbak (84 MB)
✓ drain
✓ stop api, dashboard, customer-portal, tracking-page, docs
⟳ migrate ... (12s)
✓ 3 migrations applied (20260115_add_pod_timeline … 20260320_carrier_webhooks)
✓ restart services
✓ health check
✓ bench.migrate.completed
```

`--json` emits NDJSON progress on stderr, final summary on stdout.

### 4.5 Tests (unit + contract)

- Happy path with mock provider + mock API.
- Preflight abort when zero pending.
- Step-5 failure: services remain stopped, audit event written with `status: failed`, rollback guidance surfaced.
- `--skip-backup` correctly skips step 2 but still records no-backup in audit.
- Auto-backup file path is always recorded in audit, even on later failure.

---

## 5. `bench new-tenant` — HTTP Client

### 5.1 Command

```text
bench new-tenant <slug>
  --owner-email <email>           # required
  --owner-name <name>              # required
  --plan <starter|pro|enterprise>  # optional, default starter
  --feature <key=value>            # repeatable, optional
  --limit <key=value>              # repeatable, optional
```

### 5.2 Flow

1. **Preflight**: config, token, `GET /health` returns 200.
2. **Client-side validate slug**: `/^[a-z0-9][a-z0-9-]{1,62}$/`. Fail fast.
3. **POST** `/internal/bench/tenants` with validated body.
4. **Handle response**:
   - 201 → green success, print subdomain URL + tenantId, exit 0.
   - 409 → print "slug in use" with suggestion, exit 1.
   - 400 → print field-level errors, exit 1.
   - 5xx → print raw message, exit 3.
5. **Audit**: `bench.tenant.created` with slug, orgId, actor `cli`, initiator.

### 5.3 API endpoint implementation

The route is a thin adapter:
```ts
app.post('/internal/bench/tenants', { preHandler: benchAuth }, async (req, reply) => {
  const input = createTenantSchema.parse(req.body);
  const result = await workspaceProvisioner.provisionWorkspace({
    slug: input.slug,
    ownerEmail: input.ownerEmail,
    ownerName: input.ownerName,
    plan: input.plan ?? 'starter',
    features: input.features ?? {},
    limits: input.limits ?? {},
  });
  return reply.status(201).send(result);
});
```

All business logic remains in `WorkspaceProvisioner`. The endpoint adds no behavior.

### 5.4 Tests

- CLI happy path with stubbed HTTP client.
- Slug validation rejects `Caps`, `under_score`, `-starts-dash`, `too-long-...` (>63 chars).
- API 409 surfaces as actionable CLI error.
- API endpoint contract: zod rejects missing `ownerEmail`, invalid email format.
- API integration test against real Postgres: creates Organization + TenantConfig rows, records audit log.

---

## 6. `bench backup` — Archive Format & Flow

### 6.1 Command

```text
bench backup [--to <path>] [--include-blobs] [--compression gzip|zstd|none]
```

Default `--to`: `./backups/<installationName>-<YYYYMMDD-HHMMSS>.wbak`. Default compression: `gzip`.

### 6.2 Archive layout

```
<name>-20260420-143000.wbak                  # tar.gz by default
├── manifest.json                            # written last, authoritative
├── db.sql.gz                                # pg_dump -Fc, compressed
├── config/
│   ├── bench.config.yaml
│   └── compose.yaml
└── blobs/                                   # only if --include-blobs
    ├── <sha256-hex>                         # content-addressed storage
    └── index.json                           # { "url" → { sha256, size, contentType } }
```

### 6.3 `manifest.json`

```json
{
  "version": 1,
  "benchVersion": "0.0.1",
  "witylogixVersion": "4.0.0",
  "installationName": "acme-prod",
  "createdAt": "2026-04-20T14:30:00Z",
  "includes": { "db": true, "config": true, "blobs": false },
  "counts": { "tenants": 12, "orders": 148203 },
  "checksums": {
    "db.sql.gz": "sha256:abcd...",
    "config/bench.config.yaml": "sha256:ef01..."
  }
}
```

### 6.4 Flow

1. **Preflight**: API `/health`, disk space check (estimated dump × 2 + 10% safety).
2. **Snapshot config**: copy `bench.config.yaml` and `.bench/compose.yaml` to scratch.
3. **Dump DB**: `provider.execInService(ctx, "postgres", ["pg_dump", "-Fc", "-U", dbUser, dbName])`, stream stdout through compression into `scratch/db.sql.gz`.
4. **If `--include-blobs`**:
   - Query DB for all storage URL columns: `proof_of_delivery.photo_urls`, `proof_of_delivery.signature_url`, `pod_timeline.photo_url`, `pod_timeline.signature_url`.
   - Union and dedupe.
   - For each URL: fetch blob via configured storage client, compute sha256, write to `scratch/blobs/<sha256>`, append to `blobs/index.json`.
   - Concurrency: 16 parallel fetches (override: `BACKUP_BLOB_CONCURRENCY` env).
5. **Compute counts**: single SQL query `SELECT (SELECT COUNT(*) FROM organizations), (SELECT COUNT(*) FROM orders)`.
6. **Write manifest.json**: last — a partial archive has no manifest, so restore can refuse cleanly.
7. **Tar + compress**: tar the scratch dir into `--to`, remove scratch.
8. **Audit**: `bench.backup.completed` with path, archive size, blob count, duration.

### 6.5 Progress UX

```
✓ preflight
✓ snapshot config
⟳ dump db    [████████░░] 3.2 GB / 4.1 GB
  blobs       [░░░░░░░░░░] 1,204 / 18,432
```

`--json` emits NDJSON progress events on stderr; final manifest summary on stdout.

### 6.6 Tests

- Archive structure: extract, verify paths and manifest shape.
- Round-trip: `backup → restore` produces identical DB state (verified via row counts and deterministic table hash).
- `--include-blobs` writes content-addressed files; index covers all URLs found in DB.
- pg_dump non-zero exit fails cleanly with exit 3 and cleaned-up scratch dir.
- Deterministic manifest: `counts` + `checksums` reproduce across identical runs (modulo `createdAt`).
- Interruption test: kill mid-backup, resulting partial archive lacks manifest.json.

---

## 7. `bench restore`

### 7.1 Command

```text
bench restore <archive.wbak>
  [--yes]                          # required when target DB is non-empty
  [--skip-blobs]                   # restore DB+config only even if archive has blobs
  [--target-storage <bucket-url>]  # upload blobs to a different bucket
  [--force-version]                # allow cross-major-version restore (dangerous — schema drift likely)
  [--cross-install]                # allow restoring into a differently-named installation
```

### 7.2 Flow

1. **Extract** archive to `.bench/restore-<timestamp>/`. Reject if `manifest.json` missing or `version` unknown.
2. **Compatibility check**:
   - `manifest.witylogixVersion` major must equal current installation's; warn on minor diff; block on major diff unless `--force-version`.
   - `manifest.installationName` compared to `ctx.config.metadata.name`; warn and require `--cross-install` on mismatch.
   - `benchVersion` logged only.
3. **Target safety**: query target DB. If non-empty (`tenants > 0`) and no `--yes`, refuse with a preview of current row counts vs archive row counts.
4. **Drain + stop**: `POST /drain { mode: "offline" }`, stop app services (postgres/redis remain).
5. **Drop + recreate**: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` inside a transaction.
6. **Restore DB**: `provider.execInService(ctx, "postgres", ["pg_restore", "-Fc", "-U", user, "-d", db])`, stream from `db.sql.gz`.
7. **Verify**: row counts match `manifest.counts.tenants` and `manifest.counts.orders` exactly.
8. **Restore blobs** (if present and not `--skip-blobs`):
   - For each `blobs/index.json` entry, upload to source URL or `--target-storage`.
   - If bucket changed, update DB URL references in a single transaction **after** all uploads succeed. **Never** update DB pointers before blob uploads are complete.
9. **Migrate**: `prisma migrate deploy` — archive may be from older Witylogix, bring DB up to code's latest.
10. **Start services + un-drain**.
11. **Audit**: `bench.restore.completed` with archive sha256, manifest summary, URL rewrite count.

### 7.3 Failure handling

| Failure at | Behavior | Exit |
|-----------|----------|------|
| 1–3 | Abort cleanly; no DB writes. | 1 |
| 4 | Drain reverted; services back up. | 2 |
| 5 | Schema dropped but restore not started — DB unusable. Message: "DB empty; re-run `bench restore <archive>`." | 5 |
| 6 | `pg_restore` error — partial rows. Services stay stopped. | 5 |
| 7 | Counts mismatch — data loss detected. Services stay stopped. | 5 |
| 8 | Blob upload failure list written to `.bench/restore-<ts>/missing-blobs.json`; DB unchanged (order guarantee). | 4 |
| 9 | Migration failed; DB in legacy schema. | 5 |
| 10 | Services failed to start; DB is fine — user intervention. | 4 |

### 7.4 Tests

- Manifest-less archive refused cleanly.
- Cross-major-version refused without `--force-version`.
- Cross-installation-name refused without `--cross-install`.
- Non-empty target refused without `--yes`, succeeds with.
- Blob upload partial failure populates `missing-blobs.json` and does NOT update DB URLs.
- Migration-after-restore picks up new migrations from the current code.

---

## 8. Testing Summary

| Layer | Suite | Target test count | Coverage target |
|-------|-------|-------------------|-----------------|
| Unit (bench-core) | `ops/migrate`, `ops/tenants`, `ops/backup`, `ops/restore` | ~25 | 85%+ |
| Unit (docker-compose provider) | compose generator extensions, `execInService`, `runOneShot`, `pg_dump` wiring | ~15 | 80%+ |
| Contract (apps/api) | 3 admin endpoints — token, CIDR, input validation | ~12 | 100% of routes |
| Integration (apps/api) | new-tenant hits real Postgres test DB | ~4 | n/a |
| E2E | Full round-trip `bench init → migrate → new-tenant → backup → restore` on Docker | 1 | n/a |

**Total target**: 60+ tests. Phase 1a ended with 19 tests; Phase 1b triples the suite size.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `BENCH_SERVICE_TOKEN` leak | Never log; constant-time compare; rotate via `bench rotate-secret`; CIDR gate as second line of defense. |
| `pg_dump`/`pg_restore` version mismatch with server | Pin `postgresql-client` version matching `postgres` image; `bench doctor` adds a compatibility check. |
| Interrupted backup = half-tarball | Manifest written last; restore refuses archives without manifest. |
| Restore into wrong installation | `manifest.installationName` compared to `ctx.config.metadata.name`; warn and block unless `--cross-install`. |
| Migrate downtime visible to users | API 503 with `Retry-After`; `customer-portal` and `tracking-page` detect 503 and render a maintenance page (tracked as a follow-up ticket). |
| `--include-blobs` cost at scale | Non-default; documented as portability/archival use. Progress UX gives honest size estimate before starting. |
| Race: two operators run `bench migrate` concurrently | Admin endpoint writes a distributed lock via `SELECT pg_advisory_lock(...)` for the migration window. Second caller gets 423 Locked. |

---

## 10. Storage Backend Configuration (new in Phase 1b)

`bench backup --include-blobs` and `bench restore` need a storage client. Phase 1b adds a required `storage:` block to `bench.config.yaml`:

```yaml
storage:
  backend: s3 | r2 | gcs | local
  # for backend=s3 / r2 / gcs:
  bucket: witylogix-acme-prod
  region: us-east-1
  endpoint: null                 # null = backend default; set for R2/MinIO
  # for backend=local:
  path: /var/lib/witylogix/uploads
  # credentials sourced from the configured secrets backend, never inline:
  credentials_ref: s3-write      # key name in secrets backend
```

**Scope for Phase 1b**:
- Exactly one storage backend per installation.
- S3 and local-volume implementations ship.
- R2 and GCS are interface-compatible (S3-style API) — implemented in same backend module, deferred to Phase 1c.
- `bench restore --target-storage <url>` parses the URL to infer backend type for the destination.

`StorageClient` interface (`packages/bench-core/src/storage.ts`):
```ts
interface StorageClient {
  get(key: string): Promise<Readable>;
  put(key: string, body: Readable | Buffer, meta: { contentType?: string }): Promise<void>;
  list(prefix: string): AsyncIterable<string>;
}
```

Backup iterates storage URLs referenced in the DB, not `list()` — we only pull what the DB references, avoiding orphans.

## 11. Open Decisions

1. **Schema-level audit log vs append-only file** — currently plan to use existing `audit_log` table. Revisit if Cloud needs to tail audit events in near-realtime; may want a Redis stream as well.
2. **Drain detection in frontends** — `customer-portal` and `tracking-page` maintenance UX is not specified here. Tracked as follow-up.
3. **Backup retention on the installation host** — `.bench/backups/` is currently unbounded. Add `backup.retention_days` config + `bench backup --prune` in Phase 1c.
4. **Prisma version pinning for one-shot migrator** — if host code updates Prisma ahead of prod image, `runOneShot` must use the prod image's Prisma. This is already implicit (one-shot pulls from the `api` service image), but documented here for safety.

---

## 12. Roadmap Placement

| Phase | Scope | Where this spec fits |
|-------|-------|---------------------|
| 1a (done) | scaffold + core CLI commands | — |
| **1b (this spec)** | migrate, new-tenant, backup, restore | **you are here** |
| 1c | remote backup targets (S3), scheduled backups, `--no-downtime` migrate, retention, `bench plugin` scaffold | blocked by 1b |
| 2 | `apps/bench-web` Cloud control plane | reuses `bench-core/ops/*` directly |
| 3 | Open-source launch | |
| 4 | Customer signup, billing, multi-provider | |

---

## 13. Implementation Plan Handoff

After approval of this spec, the `superpowers:writing-plans` skill produces a step-by-step implementation plan covering:

1. Add `execInService` / `runOneShot` to `Provider` interface and Docker Compose provider.
2. Build `bench-core/ops/*` modules with unit tests.
3. Add `/internal/bench/*` routes and tests to `apps/api`.
4. Wire CLI commands `migrate`, `new-tenant`, `backup`, `restore`.
5. Add `bench doctor` extensions (pg_dump version, token presence).
6. E2E round-trip test on Docker Compose.

Each step is independently mergeable to `staging`, behind feature parity with the current Phase 1a scaffold.
