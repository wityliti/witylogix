# @witylogix/bench

Witylogix Bench — provision and operate Witylogix installations on any infrastructure.

> **Status:** `0.0.1` — scaffold only. Command surface is wired; `init` and `doctor` are functional. All other commands return a clear "not yet implemented" message. See `docs/bench/ARCHITECTURE.md` for the full plan and phasing.

## Install

```bash
# one-shot
npx @witylogix/bench init my-company

# or global
pnpm add -g @witylogix/bench
```

## Commands

| Command | Status | Description |
|---------|--------|-------------|
| `bench init <name>` | working | Scaffold a new installation directory |
| `bench doctor` | working | Check prerequisites (Node, Docker, Docker Compose) |
| `bench start [service]` | working | `docker compose up -d [service]` |
| `bench stop [service]` | working | `docker compose stop [service]` |
| `bench status` | working | Service state / health matrix via `docker compose ps` |
| `bench deploy` | working | Generate compose file + `docker compose up -d --remove-orphans` |
| `bench logs <service>` | working | Tail service logs (`-f` to follow) |
| `bench destroy --confirm <name>` | working | `docker compose down -v` |
| `bench migrate` | Phase 1b | Run Prisma migrations |
| `bench new-tenant <slug>` | Phase 1b | Provision a tenant (Managed plan) |
| `bench backup` | Phase 1b | Back up DB + uploads + config |
| `bench restore <archive>` | Phase 1b | Restore from a backup |

Global flags: `--json`, `--dry-run`.

## Development

```bash
pnpm --filter @witylogix/bench dev -- doctor
pnpm --filter @witylogix/bench build
```

## License

AGPL-3.0-only (matches the monorepo). A future relicense to MIT for the CLI and
core packages is a tracked open decision in `docs/bench/ARCHITECTURE.md`.
