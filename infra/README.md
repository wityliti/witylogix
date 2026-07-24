# Witylogix Infrastructure

Docker and deployment configuration for the Witylogix platform.

## Structure

```
infra/
├── deploy-scripts/
│   └── railway.sh              # Railway deployment script
├── docker/
│   ├── Dockerfile.api          # Fastify API backend
│   ├── Dockerfile.dashboard    # Next.js admin dashboard
│   ├── Dockerfile.shopify-app  # Shopify integration app
│   └── init-db.sql             # PostgreSQL initialization
├── osrm/                       # OSRM routing data (phase 2)
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Development overrides
└── README.md
```

## Quick Start

From the repository root:

```bash
# Start all services (Postgres, Redis, API, Dashboard, Shopify App)
pnpm docker:up

# Start with development hot-reload
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up

# Stop services
pnpm docker:down

# Rebuild images
pnpm docker:build
```

## Services

| Service     | Port | Description             |
| ----------- | ---- | ----------------------- |
| postgres    | 5432 | PostgreSQL 16 + PostGIS |
| redis       | 6379 | Redis 7 (cache, jobs)   |
| api         | 3001 | Fastify backend API     |
| dashboard   | 3000 | Next.js admin UI        |
| shopify-app | 3002 | Shopify embedded app    |

## Optional Profiles

```bash
# BullMQ job queue dashboard (port 3100)
docker compose -f infra/docker-compose.yml --profile tools up

# OSRM routing engine (port 5000) - requires preprocessed OSM data
docker compose -f infra/docker-compose.yml --profile phase2 up
```

## Railway Deployment

CLI tool to deploy and manage Railway. Full-stack in one project: Postgres, Redis, API.

### Prerequisites

```bash
pnpm add -g @railway/cli
railway login
```

### Quick Start

```bash
pnpm deploy:link    # Link to existing project
pnpm deploy:setup   # Add Postgres, Redis, deploy API
pnpm deploy         # Deploy API only
```

### Commands

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `railway.sh setup`     | Provision Postgres + Redis + deploy API |
| `railway.sh init`      | Create new Railway project              |
| `railway.sh link`      | Link to existing project                |
| `railway.sh deploy`    | Deploy the API                          |
| `railway.sh logs`      | Stream deployment logs                  |
| `railway.sh status`    | Show deployment status                  |
| `railway.sh redeploy`  | Redeploy without new code               |
| `railway.sh vars list` | List variables                          |
| `railway.sh open`      | Open Railway dashboard                  |
| `railway.sh domain`    | Generate public domain                  |

Options: `-s, --service`, `-e, --environment`, `-d, --detach`, `-c, --ci`

See [infra/deploy-scripts/README.md](deploy-scripts/README.md) for details.

## Environment

Create `.env` in the repo root (see `.env.example`). Key variables:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `REDIS_URL` (default: redis://redis:6379)
- `DATABASE_URL` (auto-set for API in compose)
- `JWT_SECRET`, `MAPBOX_ACCESS_TOKEN`, etc.
