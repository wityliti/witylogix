# CI/CD Pipeline & Docker Configuration

## Overview

This document describes the complete CI/CD pipeline and Docker configuration for the Witylogix platform. The setup uses GitHub Actions for CI/CD, Docker for containerization, and supports multiple deployment targets (Kubernetes, Fly.io, Railway, custom).

**Created by:** Rohan Gupta (Backend Lead)  
**Sprint:** 2.3  
**Date:** March 6, 2026

---

## Architecture

```
┌─────────────────┐
│  Git Push       │
│  (to main)      │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────────────────────┐
│         GitHub Actions CI Pipeline (ci.yml)            │
├─────────────────────────────────────────────────────────┤
│ ✓ Lint (ESLint)                                         │
│ ✓ Type Check (TypeScript --noEmit)                      │
│ ✓ Test (Vitest + Services: Postgres, Redis)            │
│ ✓ Build (Turbo build for API & Dashboard)              │
└────────┬────────────────────────────────────────────────┘
         │ (all jobs pass)
         v
┌─────────────────────────────────────────────────────────┐
│      GitHub Actions Deploy Pipeline (deploy.yml)       │
├─────────────────────────────────────────────────────────┤
│ 1. Build Docker Images (API, Dashboard, Shopify App)   │
│ 2. Tag: sha + latest                                    │
│ 3. Push to ghcr.io (GitHub Container Registry)         │
│ 4. Deploy (K8s / Fly.io / Railway / Custom)            │
└─────────────────────────────────────────────────────────┘
         │
         v
    ┌─────────────────────┐
    │  Production         │
    │  (witylogix-api,    │
    │   dashboard, etc.)  │
    └─────────────────────┘
```

---

## Files Created

### Docker Files

#### 1. `Dockerfile.api` (70 lines)
**Multi-stage build for Fastify 5 backend**

- **Stage 1 (base):** Node 20 Alpine + pnpm 9.15.0
- **Stage 2 (deps):** Install all workspace dependencies
- **Stage 3 (build):** 
  - Generate Prisma Client
  - Build shared packages (db, types, validators, core)
  - Build API with TypeScript
- **Stage 4 (production):**
  - Copy only production files
  - Expose port 3001
  - Health check: `GET /health`
  - Command: `node apps/api/dist/server.js`

**Key Features:**
- Prisma client generation before compilation
- Only copies relevant workspace packages
- Includes health check for Kubernetes integration
- Optimized layer caching

#### 2. `Dockerfile.dashboard` (63 lines)
**Multi-stage build for Next.js 15 dashboard**

- **Stage 1 (deps):** Dependencies installation
- **Stage 2 (build):** Build packages + Next.js standalone output
- **Stage 3 (production):**
  - Copy `.next/standalone` (self-contained runtime)
  - Copy `.next/static` (pre-built assets)
  - Copy `public` directory
  - Expose port 3000
  - Command: `node server.js`

**Key Features:**
- Standalone output mode (minimal image size)
- Health check integrated
- No additional runtime dependencies needed

#### 3. `Dockerfile.shopify-app` (63 lines)
**Multi-stage build for Shopify integration (React Router + Vite)**

- **Stage 1 (deps):** Dependencies installation
- **Stage 2 (build):** Build packages + Vite bundle
- **Stage 3 (production):**
  - Uses `serve` package to serve static files
  - Copy built Vite output to `public`
  - Expose port 5173
  - Health check for availability

**Key Features:**
- Optimized for static site serving
- Lightweight footprint
- Ready for Shopify API integration

#### 4. `.dockerignore` (21 lines)
**Excludes unnecessary files from Docker build context**

Excludes:
- `node_modules`, `pnpm-lock.yaml`
- Build outputs: `dist`, `.next`, `.turbo`
- Version control: `.git`, `.gitignore`
- Documentation: `*.md`
- Environment files: `.env*` (CRITICAL: never bake secrets)
- IDE/OS files, test coverage, logs

---

### Docker Compose Files

#### 5. `docker-compose.yml` (215 lines)
**Production-ready orchestration for all services**

**Services:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | postgis:16-3.4-alpine | 5432 | Database with geospatial support |
| `redis` | redis:7-alpine | 6379 | Cache, sessions, job queue |
| `api` | Built from Dockerfile.api | 3001 | Fastify backend |
| `dashboard` | Built from Dockerfile.dashboard | 3000 | Next.js admin UI |
| `shopify-app` | Built from Dockerfile.shopify-app | 3002 | Shopify integration |
| `bull-board` | deadly0/bull-board:latest | 3100 | Job queue dashboard (optional) |
| `osrm` | osrm/osrm-backend:latest | 5000 | Route optimization (Phase 2) |

**Features:**

- **Health checks:** All critical services (postgres, redis) have health checks
- **Persistent volumes:** `postgres_data`, `redis_data`
- **Networking:** `witylogix-network` bridge for service discovery
- **Environment variables:** Sensible defaults, configurable via `.env`
- **Profiles:** Conditional services (tools, phase2)
- **Dependencies:** Services wait for healthy dependencies before starting

**Configuration via Environment Variables:**

```bash
# Database
POSTGRES_USER=witylogix
POSTGRES_PASSWORD=witylogix_dev
POSTGRES_DB=witylogix
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379
REDIS_MAXMEMORY=256mb

# API
NODE_ENV=production
LOG_LEVEL=info
API_PORT=3001
JWT_SECRET=your-secret-key
MAPBOX_ACCESS_TOKEN=...
STRIPE_SECRET_KEY=...

# Dashboard
DASHBOARD_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3001

# Shopify
SHOPIFY_APP_PORT=3002
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
```

#### 6. `docker-compose.dev.yml` (72 lines)
**Development overrides for hot-reload and debugging**

**Usage:**
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Changes:**

- **API:**
  - Command: `pnpm --filter @witylogix/api dev` (tsx watch)
  - Volume mounts for source code hot-reload
  - Exposes debug port: 9229
  - Environment: `NODE_ENV=development`, `LOG_LEVEL=debug`

- **Dashboard:**
  - Command: `pnpm --filter @witylogix/dashboard dev` (next dev)
  - Volume mounts for hot-reload
  - Cached Next.js build artifacts

- **PostgreSQL:**
  - Extra logging: `log_statement=all`

---

### GitHub Actions Workflows

#### 7. `.github/workflows/ci.yml` (248 lines)
**Continuous Integration Pipeline**

**Triggers:**
- Push to `main` branch
- All pull requests
- Concurrency: Cancels in-progress workflows for same PR

**Jobs:**

1. **Lint (ESLint)**
   - Runs: `pnpm lint`
   - Matrix: Node 20
   - Caching: pnpm store
   - ~2-3 minutes

2. **Type Check (TypeScript)**
   - API: `pnpm --filter @witylogix/api typecheck`
   - Dashboard: `pnpm --filter @witylogix/dashboard typecheck`
   - Matrix: Node 20
   - ~3-4 minutes

3. **Test (Vitest)**
   - Services: Postgres 16, Redis 7 (with health checks)
   - Commands:
     - `pnpm --filter @witylogix/db db:generate`
     - `pnpm test --run`
   - Environment: Database & Redis URLs set
   - ~4-6 minutes

4. **Build (Turbo)**
   - `pnpm build` (builds all packages & apps)
   - Caching: Turbo cache, Next.js cache
   - Matrix: Node 20
   - ~5-8 minutes

**Total CI Runtime:** ~15-20 minutes

**Caching Strategy:**
- pnpm store (dependencies)
- Turbo build artifacts
- Next.js build cache

---

#### 8. `.github/workflows/deploy.yml` (195 lines)
**Continuous Deployment Pipeline**

**Triggers:**
- Push to `main` (after CI passes)
- Can also trigger via `workflow_run` for workflow dependencies

**Concurrency:** No cancellation (prevents interrupted deployments)

**Jobs:**

1. **Build and Push Images**
   - Builds three images:
     - `ghcr.io/.../api:latest`
     - `ghcr.io/.../dashboard:latest`
     - `ghcr.io/.../shopify-app:latest`
   - Tags:
     - `sha-<7-char-hash>` (for rollback)
     - `main` (branch name)
     - `latest` (only for main branch)
   - Registry: GitHub Container Registry (ghcr.io)
   - Docker BuildX: Uses GitHub Actions cache layer

2. **Deploy to Environment** (Commented options)
   
   **Option 1: Kubernetes**
   ```bash
   kubectl set image deployment/witylogix-api \
     api=ghcr.io/.../api:latest \
     --namespace=production --record
   ```
   
   **Option 2: Fly.io**
   ```bash
   flyctl deploy
   ```
   
   **Option 3: Railway**
   ```bash
   railway deploy --force
   ```
   
   **Option 4: Custom Script**
   ```bash
   bash scripts/deploy.sh
   ```

**Permissions:**
- `contents: read` (checkout)
- `packages: write` (push to ghcr.io)

---

### API Health Routes

#### 9. `apps/api/src/routes/health.ts` (217 lines)
**Production-grade health check endpoints**

**Endpoints:**

1. **`GET /health` (Liveness Probe)**
   - Response time: ~1ms (no external calls)
   - Status: 200 OK always (if process is running)
   - Use case: Kubernetes livenessProbe
   
   ```json
   {
     "status": "ok",
     "timestamp": "2026-03-06T10:30:45.123Z",
     "version": "1.0.0",
     "uptime": 3600
   }
   ```

2. **`GET /health/ready` (Readiness Probe)**
   - Checks: Database, Redis connectivity
   - Status: 200 OK (ready) or 503 Service Unavailable
   - Use case: Kubernetes readinessProbe, load balancer decisions
   
   ```json
   {
     "ready": true,
     "dependencies": {
       "database": "connected",
       "redis": "connected"
     },
     "timestamp": "2026-03-06T10:30:45.123Z"
   }
   ```

3. **`GET /health/deep` (Deep Health Check)**
   - Includes: Memory stats, dependency latency
   - Status: 200 (healthy), 503 (degraded)
   - Use case: Monitoring dashboards, alerting
   
   ```json
   {
     "status": "ok" | "degraded",
     "timestamp": "2026-03-06T10:30:45.123Z",
     "uptime": 3600,
     "memory": {
       "heapUsed": 45.5,
       "heapTotal": 100.0,
       "external": 2.3
     },
     "dependencies": {
       "database": { "status": "connected", "latency_ms": 12 },
       "redis": { "status": "connected", "latency_ms": 3 }
     }
   }
   ```

**Kubernetes Integration:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: witylogix-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: ghcr.io/witylogix/api:latest
        ports:
        - containerPort: 3001
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
            scheme: HTTP
          initialDelaySeconds: 40
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
            scheme: HTTP
          initialDelaySeconds: 30
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
```

---

## Quick Start

### Development (with hot-reload)

```bash
# Start entire stack with hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Or individually:
docker compose up postgres redis  # Services
docker compose exec api pnpm dev   # In separate terminal
docker compose exec dashboard pnpm dev
```

### Production Build & Run

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# View logs
docker compose logs -f api dashboard

# Health check
curl http://localhost:3001/health
curl http://localhost:3000/

# Stop
docker compose down
```

### Optional Services

```bash
# Start with tools (BullMQ Board)
docker compose --profile tools up

# Start with Phase 2 services (OSRM)
docker compose --profile phase2 up
```

---

## Environment Configuration

### Local Development (`.env`)

```bash
NODE_ENV=development
LOG_LEVEL=debug

# Database
POSTGRES_USER=witylogix
POSTGRES_PASSWORD=witylogix_dev
POSTGRES_DB=witylogix
DATABASE_URL=postgresql://witylogix:witylogix_dev@localhost:5432/witylogix

# Redis
REDIS_URL=redis://localhost:6379

# API
JWT_SECRET=dev-secret-change-in-production
API_PORT=3001

# Dashboard
NEXT_PUBLIC_API_URL=http://localhost:3001
DASHBOARD_PORT=3000

# External APIs (get from team)
MAPBOX_ACCESS_TOKEN=pk_...
STRIPE_SECRET_KEY=sk_...
```

### Production (GitHub Secrets)

Set in repository settings:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `MAPBOX_ACCESS_TOKEN`
- `STRIPE_SECRET_KEY`
- Deployment credentials (if using K8s/Fly.io/Railway)

---

## Deployment Guide

### Option 1: Kubernetes

```bash
# Apply manifests
kubectl apply -f infra/k8s/

# Check deployment
kubectl rollout status deployment/witylogix-api -n production

# View logs
kubectl logs -f deployment/witylogix-api -n production
```

### Option 2: Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Create app
flyctl apps create witylogix-api
flyctl apps create witylogix-dashboard

# Deploy (automatic via GitHub Actions)
# Or manual:
flyctl deploy --image ghcr.io/witylogix/api:latest
```

### Option 3: Railway

```bash
# Railway auto-detects docker-compose.yml
# Just connect GitHub repo and branch
# Automatic deployments on push to main
```

---

## Monitoring & Troubleshooting

### Health Checks

```bash
# Liveness
curl http://localhost:3001/health

# Readiness
curl http://localhost:3001/health/ready

# Deep health
curl http://localhost:3001/health/deep
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f postgres

# From Kubernetes
kubectl logs -f deployment/witylogix-api -n production
```

### Database Migrations

```bash
# During deployment, run migrations:
docker compose exec api pnpm --filter @witylogix/db db:migrate

# Or in Kubernetes:
kubectl exec deployment/witylogix-api -- pnpm --filter @witylogix/db db:migrate
```

### Scaling

```bash
# Docker Compose (not recommended for production)
docker compose up -d --scale api=3

# Kubernetes (recommended)
kubectl scale deployment witylogix-api --replicas=3 -n production
```

---

## Performance & Security

### Performance Optimizations

1. **Multi-stage Docker builds:** Reduces image size by ~70%
2. **Layer caching:** Dependencies cached separately
3. **Turbo caching:** Skips unchanged packages
4. **Next.js standalone:** No Node.js dependencies in dashboard
5. **Health check isolation:** Logging disabled (`logLevel: 'silent'`)

### Security Best Practices

1. **No secrets in images:** `.dockerignore` excludes `.env*`
2. **Read-only filesystem:** Can be enforced in Kubernetes
3. **Non-root user:** Consider adding in production Dockerfiles
4. **Image scanning:** Run `trivy scan ghcr.io/.../api:latest`
5. **Dependency updates:** `pnpm audit`, dependabot
6. **JWT secrets:** Rotate regularly

---

## Next Steps

1. **Register Dockerfile.shopify-app:** Update api dependency in shopify-app/package.json
2. **Add next.config.ts:** Ensure Next.js has `output: 'standalone'`
3. **Configure deployment:** Choose and implement deploy.yml option
4. **Set GitHub secrets:** Add sensitive vars to Actions secrets
5. **Test locally:** Run `docker compose up` and test endpoints
6. **CI/CD testing:** Push to main and monitor workflow
7. **Production launch:** Deploy to chosen platform

---

## References

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Fastify Health Checks](https://www.fastify.io/docs/latest/Guides/Testing/)
- [Next.js Standalone Output](https://nextjs.org/docs/app/deployment)
- [Kubernetes Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [GitHub Actions Caching](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)

