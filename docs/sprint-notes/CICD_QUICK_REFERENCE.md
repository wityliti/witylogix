# CI/CD Quick Reference

## Files Created

```
witylogix-platform/
├── Dockerfile.api              ✓ (70 lines)   - Fastify backend multi-stage build
├── Dockerfile.dashboard        ✓ (63 lines)   - Next.js 15 standalone output
├── Dockerfile.shopify-app      ✓ (63 lines)   - React Router + Vite static serve
├── .dockerignore               ✓ (21 lines)   - Excludes secrets, node_modules
├── docker-compose.yml          ✓ (215 lines)  - Production services orchestration
├── docker-compose.dev.yml      ✓ (72 lines)   - Hot-reload overrides
├── .github/workflows/
│   ├── ci.yml                  ✓ (248 lines)  - Lint, Type, Test, Build
│   └── deploy.yml              ✓ (195 lines)  - Build images, push, deploy
├── apps/api/src/routes/
│   └── health.ts               ✓ (217 lines)  - /health, /health/ready, /health/deep
└── CICD.md                     ✓ (full docs)  - Complete documentation
```

## Services in docker-compose.yml

| Service     | Port | Purpose             | Health Check   |
| ----------- | ---- | ------------------- | -------------- |
| postgres    | 5432 | Database (PostGIS)  | pg_isready     |
| redis       | 6379 | Cache & queue       | redis-cli ping |
| api         | 3001 | Fastify backend     | /health        |
| dashboard   | 3000 | Next.js admin       | GET /          |
| shopify-app | 3002 | Shopify integration | GET /          |
| bull-board  | 3100 | Queue dashboard     | (optional)     |
| osrm        | 5000 | Route engine        | (phase2 only)  |

## CI Workflow (ci.yml)

**Runs on:** push to main, all PRs

1. **Lint** - ESLint validation (~2-3 min)
2. **Type Check** - TypeScript compilation (~3-4 min)
3. **Test** - Vitest with Postgres & Redis (~4-6 min)
4. **Build** - Turbo build all (~5-8 min)

**Total:** ~15-20 minutes

## Deploy Workflow (deploy.yml)

**Runs on:** push to main (after CI passes)

1. Build 3 Docker images (api, dashboard, shopify-app)
2. Tag: `sha-xxx` + `main` + `latest`
3. Push to ghcr.io
4. Deploy (Kubernetes / Fly.io / Railway / custom)

## Health Endpoints

```bash
# Liveness (fast, always 200)
GET /health
Response: { status: "ok", timestamp, version, uptime }

# Readiness (checks DB/Redis)
GET /health/ready
Response: { ready: true/false, dependencies, timestamp }

# Deep health (memory + latency)
GET /health/deep
Response: { status, memory, dependencies, timestamp }
```

## Quick Commands

### Development (hot-reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Production Build & Run

```bash
docker compose build
docker compose up -d
curl http://localhost:3001/health
docker compose logs -f api
docker compose down
```

### Optional Services

```bash
docker compose --profile tools up        # BullMQ Board
docker compose --profile phase2 up       # OSRM route engine
```

### Database & Cache

```bash
docker compose exec postgres psql -U witylogix witylogix
docker compose exec redis redis-cli
```

## Environment Variables

### Required for API

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret-key
```

### Optional External APIs

```bash
MAPBOX_ACCESS_TOKEN=pk_...
STRIPE_SECRET_KEY=sk_...
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
```

## Common Tasks

### Monitor CI/CD

- Push to main → CI runs automatically
- Check: GitHub Actions tab → ci.yml
- Deploy automatically after CI passes

### Run Tests Locally

```bash
docker compose exec api pnpm test --run
```

### Database Migrations

```bash
docker compose exec api pnpm --filter @witylogix/db db:migrate
```

### View Live Logs

```bash
docker compose logs -f api dashboard
docker compose logs -f postgres
```

### Reset Everything

```bash
docker compose down -v  # Removes volumes
docker compose build --no-cache
docker compose up -d
```

## Key Design Decisions

1. **Multi-stage Docker builds**
   - Separate dependency & build layers for caching
   - Production images don't include node_modules or build tools

2. **Health checks**
   - `/health`: Liveness (is process alive?)
   - `/health/ready`: Readiness (can handle traffic?)
   - `/health/deep`: Monitoring (memory, latency)

3. **CI/CD pipeline**
   - Lint → Type Check → Test → Build (parallel jobs where possible)
   - Deploy only after CI passes
   - Uses GitHub Container Registry (ghcr.io)

4. **Docker Compose**
   - Production config in docker-compose.yml
   - Development overrides in docker-compose.dev.yml
   - Services discover each other via DNS names

5. **Hot-reload Development**
   - Volume mounts source code
   - API: tsx watch (TypeScript + hot-reload)
   - Dashboard: Next.js dev server with Turbopack
   - Node modules excluded from mounts (use container's)

## Troubleshooting

**Images won't build**

```bash
docker system prune -a  # Clear cache
pnpm install --frozen-lockfile
docker compose build --no-cache
```

**Health check failing**

```bash
curl http://localhost:3001/health/ready
docker compose logs api
```

**Database connection refused**

```bash
docker compose ps  # Check if postgres is running
docker compose logs postgres
```

**Port already in use**

```bash
docker compose down -v
docker ps -a | grep witylogix  # Check for lingering containers
docker kill <container-id>
```

## Next Steps for Team

1. Ensure `next.config.ts` has `output: 'standalone'`
2. Register health routes in `apps/api/src/server.ts`
3. Set GitHub Actions secrets (JWT_SECRET, etc.)
4. Test locally: `docker compose up`
5. Push to main and monitor ci.yml workflow
6. Choose deployment option (K8s/Fly.io/Railway)
7. Implement chosen deploy.yml option

---

Created: Sprint 2.3 | By: Rohan Gupta (Backend Lead)
