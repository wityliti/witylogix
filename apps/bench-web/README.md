# @witylogix/bench-web

Witylogix Cloud control plane — admin UI over the Bench admin API (`/internal/bench/*`).

> **Status:** 0.0.1 scaffold. Overview page calls a real `/health` endpoint; Tenants, Installations, and Audit pages are placeholders; Provision page has a working form that calls `POST /internal/bench/tenants` via a server action.

## Run locally

```bash
BENCH_API_BASE_URL=http://localhost:8000 \
BENCH_SERVICE_TOKEN=<paste-from-secrets/bench-service-token> \
pnpm --filter @witylogix/bench-web dev
```

Opens on **http://localhost:3010**.

## Architecture

Server-side only API calls — the `BENCH_SERVICE_TOKEN` never reaches the browser. All admin API calls go through `src/lib/bench-api.ts` from Server Components or Server Actions.

## Scope split vs Phase 1 Bench CLI

| | Bench CLI (`@witylogix/bench`) | Cloud control plane (`@witylogix/bench-web`) |
|---|---|---|
| Audience | Self-hosters, Witylogix DevOps | Witylogix team (Phase 1) → customers (Phase 2) |
| Runs on | Operator laptop or CI | Our private deploy only |
| Data | Single installation | Many installations |
| Deploy | `npx @witylogix/bench init` | `pnpm --filter @witylogix/bench-web build` |
| License | MIT (planned) / AGPL-3.0 (current) | Source-available / private |

## Roadmap

- **Phase 1 (this scaffold)** — skeleton + live `/health`, working `POST /tenants` form.
- **Phase 2** — installations registry, audit-log tailing, WebAuthn-gated auth, multi-installation fan-out.
- **Phase 3** — public customer sign-up.
