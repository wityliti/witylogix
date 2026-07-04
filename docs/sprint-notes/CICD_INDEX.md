# CI/CD Configuration Index

**Sprint:** 2.3  
**Created:** March 6, 2026  
**Lead:** Rohan Gupta (Backend Lead)

Quick navigation for all CI/CD related files and documentation.

---

## File Locations

### Docker Configuration

- **Dockerfile.api** - Fastify backend multi-stage build
- **Dockerfile.dashboard** - Next.js dashboard multi-stage build
- **Dockerfile.shopify-app** - Shopify app (React Router + Vite) build
- **.dockerignore** - Build context optimization

### Docker Compose

- **docker-compose.yml** - Production services (postgres, redis, api, dashboard, shopify-app)
- **docker-compose.dev.yml** - Development overrides (hot-reload, debugging)

### GitHub Actions Workflows

- **.github/workflows/ci.yml** - Continuous Integration (Lint, Type, Test, Build)
- **.github/workflows/deploy.yml** - Continuous Deployment (Build, Push, Deploy)

### API Routes

- **apps/api/src/routes/health.ts** - Health check endpoints (/health, /health/ready, /health/deep)

### Documentation

- **CICD.md** - Comprehensive guide (architecture, setup, deployment)
- **CICD_QUICK_REFERENCE.md** - Quick lookup guide (commands, troubleshooting)
- **INTEGRATION_GUIDE.md** - Step-by-step integration (10 steps)
- **SPRINT_2.3_SUMMARY.md** - Complete project summary
- **CICD_INDEX.md** - This file (navigation guide)

---

## Quick Start

### First Time Setup

1. Read: **INTEGRATION_GUIDE.md** (Step 1-3)
2. Run: `docker compose build`
3. Test: `docker compose up`
4. Verify: `curl http://localhost:3001/health`

### Running CI/CD Locally

1. Push branch: `git push origin branch-name`
2. Create PR on GitHub
3. Watch: GitHub Actions > CI workflow
4. Merge when all checks pass

### Common Commands

See **CICD_QUICK_REFERENCE.md** for:

- Docker commands
- Docker Compose commands
- Testing and building
- Troubleshooting

---

## Documentation Map

### For Different Needs

**I need a quick command reference**
→ **CICD_QUICK_REFERENCE.md**

**I want to understand the architecture**
→ **CICD.md** (see "Architecture" section)

**I need to integrate this into the project**
→ **INTEGRATION_GUIDE.md** (10 step-by-step instructions)

**I need to troubleshoot an issue**
→ **CICD_QUICK_REFERENCE.md** (Troubleshooting section)

**I want complete details on everything**
→ **CICD.md** (comprehensive reference)

**I need to know what was delivered**
→ **SPRINT_2.3_SUMMARY.md** (project completion summary)

---

## Service Architecture

```
Development (Local)
  ├─ postgres (5432) - Local database
  ├─ redis (6379) - Local cache
  ├─ api (3001) - tsx watch (hot-reload)
  ├─ dashboard (3000) - next dev (hot-reload)
  └─ shopify-app (3002) - vite dev (hot-reload)

Production (CI/CD Pipeline)
  ├─ Build → push to ghcr.io
  ├─ Tag: sha-xxx, main, latest
  └─ Deploy to: K8s, Fly.io, Railway, or Custom

Health Endpoints
  ├─ /health (liveness) - ~1ms
  ├─ /health/ready (readiness) - ~10-50ms
  └─ /health/deep (monitoring) - ~20-100ms
```

---

## CI/CD Pipeline Flow

```
Developer Push
     ↓
GitHub Actions CI
  ├─ Lint (2-3 min)
  ├─ Type Check (3-4 min)
  ├─ Test (4-6 min with services)
  └─ Build (5-8 min)
     ↓ (all pass)
GitHub Actions Deploy
  ├─ Build 3 Docker images
  ├─ Push to ghcr.io
  └─ Deploy to target environment
```

---

## Key Decisions

1. **Multi-stage Docker builds** - Reduces image size by ~70%
2. **Health checks** - 3 endpoints for different use cases
3. **GitHub Container Registry** - Free, integrated with GitHub
4. **pnpm workspaces** - Monorepo support
5. **Turbo** - Smart caching across packages

---

## Next Steps

1. **Immediate:** Follow INTEGRATION_GUIDE.md steps 1-3
2. **Before CI:** Configure GitHub Actions secrets (step 5)
3. **Before Deployment:** Choose deployment target (step 8)
4. **Production:** Setup monitoring and alerts

---

## Environment Variables

**Required:**

- DATABASE_URL
- REDIS_URL
- JWT_SECRET

**Optional:**

- MAPBOX_ACCESS_TOKEN
- STRIPE_SECRET_KEY
- SHOPIFY_API_KEY
- SHOPIFY_API_SECRET

See CICD.md "Environment Configuration" section for full list.

---

## Troubleshooting

**Docker build fails?**
→ CICD_QUICK_REFERENCE.md: "Images won't build"

**Health check failing?**
→ CICD_QUICK_REFERENCE.md: "Health check failing"

**Port already in use?**
→ CICD_QUICK_REFERENCE.md: "Port already in use"

**Need help with something else?**
→ Search CICD.md or INTEGRATION_GUIDE.md

---

## Performance Expectations

| Task                  | Time      |
| --------------------- | --------- |
| Docker build (first)  | 5-10 min  |
| Docker build (cached) | 1-2 min   |
| CI pipeline (first)   | 15-20 min |
| CI pipeline (cached)  | 8-10 min  |
| Deploy to platform    | 2-5 min   |
| Health check response | 1-100 ms  |

---

## Security Checklist

- [x] No secrets in Docker images
- [x] .dockerignore excludes .env files
- [x] GitHub Actions secrets configured
- [x] Health checks bypass logging
- [ ] Image scanning (recommended: Trivy)
- [ ] Dependency updates (recommended: Dependabot)
- [ ] Non-root user in Dockerfile (optional)
- [ ] Network policies in K8s (optional)

---

## Support

**Questions?**

- Start with CICD_QUICK_REFERENCE.md
- Check INTEGRATION_GUIDE.md for setup steps
- Read CICD.md for detailed information

**Issues?**

- See troubleshooting sections
- Check GitHub Actions logs
- Review error messages carefully

---

Created: March 6, 2026  
Sprint: 2.3  
Lead: Rohan Gupta
