# Witylogix Railway CLI

Deploy and manage the Witylogix platform on Railway. Full-stack setup in one project: Postgres, Redis, API.

## Prerequisites

```bash
pnpm add -g @railway/cli
railway login
```

## Quick Start

```bash
# From repo root
pnpm deploy:link    # Link to existing project (or create one in dashboard first)
pnpm deploy:setup   # Prompts: Add Postgres? Add Redis? Then deploys API
pnpm deploy         # Deploy API only (after setup)
```

Use `-y` or `--yes` to skip prompts and add both Postgres and Redis: `railway.sh setup -y`

## Commands

| Command | Description |
|---------|-------------|
| `railway.sh setup` | Provision Postgres + Redis + deploy API |
| `railway.sh init` | Create new Railway project and link |
| `railway.sh link` | Link to existing Railway project |
| `railway.sh deploy` | Deploy the API (default) |
| `railway.sh logs` | Stream deployment logs |
| `railway.sh status` | Show deployment status |
| `railway.sh redeploy` | Redeploy without uploading new code |
| `railway.sh vars list` | List environment variables |
| `railway.sh vars set KEY=val` | Set a variable |
| `railway.sh open` | Open project in Railway dashboard |
| `railway.sh domain` | Generate public domain for API |

## Options

- `-s, --service NAME` — Target service (default: witylogix)
- `-e, --environment ENV` — Environment (default: production)
- `-d, --detach` — Deploy in background
- `-c, --ci` — CI mode: build logs only
- `-y, --yes` — Non-interactive: add Postgres and Redis without prompting (setup)

## pnpm Scripts

```bash
pnpm deploy          # Deploy API
pnpm deploy:setup    # Full stack setup
pnpm deploy:link     # Link project
pnpm deploy:logs     # Stream logs
pnpm deploy:status   # Show status
pnpm deploy:redeploy # Redeploy
pnpm deploy:open     # Open dashboard
pnpm deploy:domain   # Generate domain
```

## After Setup

In Railway dashboard → API service → Variables, set:

- `DATABASE_URL` = `${{Postgres.DATABASE_PRIVATE_URL}}`
- `REDIS_URL` = `${{Redis.REDIS_URL}}`
- `JWT_SECRET` = (generate secure random string)

See `.env.example` at repo root for full list.
