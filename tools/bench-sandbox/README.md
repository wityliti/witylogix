# Witylogix Bench — Hetzner Sandbox

Fast improve → execute → revert → improve loop for iterating on the bench CLI against a real Docker host.

## The cycle

```
┌─────────┐   ┌────────────┐   ┌────────┐
│ IMPROVE │ → │  EXECUTE   │ → │ REVERT │ ─┐
│ (local) │   │ (Hetzner)  │   │(Hetzner)│ │
└─────────┘   └────────────┘   └────────┘ │
     ▲                                     │
     └─────────────────────────────────────┘
```

## One-line magic

```bash
./tools/bench-sandbox/cycle.sh
```

That's it. The script:

1. Packs the current working tree's bench packages + workspace config.
2. Resets sandbox state on `Hetzner_Server` (destroys prior `demo` installation, containers, volumes, networks, directory).
3. Uploads the tarball.
4. Extracts into `/opt/bench-sandbox/workspace/`.
5. `pnpm install` (incremental — cached across cycles).
6. Runs the CLI through a smoke script: `init` → `doctor` → `deploy --dry-run` → `status` → logs dump on failure.
7. Reports pass/fail per step, exit code reflects overall outcome.

## Subcommands

| Command | What it does |
|---------|--------------|
| `./cycle.sh` (no args) | `reset` + `execute` (default) |
| `./cycle.sh reset` | Only tear down remote state |
| `./cycle.sh execute` | Only push + run (no reset) — useful for layered testing |
| `./cycle.sh shell` | Interactive SSH into the sandbox directory |
| `./cycle.sh logs <service>` | Tail logs from a service in the current sandbox |

## Requirements on the local machine

- SSH config entry named `Hetzner_Server` (already present)
- tar, ssh, scp

## Requirements on the Hetzner VM (one-time setup)

The script checks these and aborts with clear errors if missing:

- Docker + Docker Compose v2
- Node 22+
- pnpm 10+
- 5 GB free in `/opt`

These are already present on `Hetzner_Server`.

## Why this shape?

Single command. Fast feedback (~15–30s per cycle once `node_modules` is cached). Destructive operations scoped to `/opt/bench-sandbox/`. VM survives between cycles. No Hetzner Cloud API token needed.

When we need true per-cycle VM isolation later (e.g. for testing `bench destroy`), we can add an `hcloud`-backed reset mode; for now the scoped reset is equivalent from bench's perspective.

## What each cycle exercises today

- **Working**: `init`, `doctor`, `deploy --dry-run`, `status` (dry-run)
- **Blocked on image publish**: real `deploy` (needs Witylogix images on ghcr.io)
- **Not yet implemented**: `migrate`, `new-tenant`, `backup`, `restore` (Phase 1b tasks)

As each Phase 1b task lands, extend `dogfood.sh` to exercise it.
