# Integration Guide - CI/CD Setup

## Step 1: Register Health Routes in API

Edit `apps/api/src/server.ts` and add the health routes import after other routes:

```typescript
// In the buildServer() function, after all other route registrations:

import healthRoutes from "./routes/health.js";

// Then register:
await app.register(healthRoutes);
```

Example location (around line 100+ in server.ts):
```typescript
// API Routes

// Core routes
await app.register(requestLogsRoutes);

// ... other routes ...

// Health check routes (for monitoring & orchestration)
await app.register(healthRoutes);
```

## Step 2: Configure Next.js Standalone Output

Edit `apps/dashboard/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ... rest of config
};

export default nextConfig;
```

## Step 3: Test Docker Build Locally

```bash
# Build API image
docker build -f Dockerfile.api -t witylogix-api:test .

# Build Dashboard image
docker build -f Dockerfile.dashboard -t witylogix-dashboard:test .

# Build Shopify App image
docker build -f Dockerfile.shopify-app -t witylogix-shopify:test .

# Test API image
docker run -d --name test-api \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://user:pass@host/db \
  -e REDIS_URL=redis://host:6379 \
  witylogix-api:test

# Check if it starts
docker logs test-api
curl http://localhost:3001/health

# Cleanup
docker stop test-api
docker rm test-api
```

## Step 4: Test Docker Compose Locally

```bash
# Start all services
docker compose up -d

# Wait for startup (about 30 seconds)
sleep 30

# Test API
curl http://localhost:3001/health

# Test Dashboard
curl http://localhost:3000/

# Check logs
docker compose logs -f api

# Stop
docker compose down
```

## Step 5: Configure GitHub Actions Secrets

Navigate to repository settings:

Settings > Secrets and variables > Actions > New repository secret

Add the following secrets:

1. POSTGRES_PASSWORD - Your database password
2. JWT_SECRET - Your JWT signing key
3. MAPBOX_ACCESS_TOKEN - From Mapbox dashboard
4. STRIPE_SECRET_KEY - From Stripe dashboard
5. SHOPIFY_API_KEY - From Shopify app settings
6. SHOPIFY_API_SECRET - From Shopify app settings

For deployment (optional, based on choice):
- Kubernetes: KUBE_CONFIG (base64 encoded)
- Fly.io: FLY_API_TOKEN
- Railway: RAILWAY_TOKEN
- Custom: DEPLOY_KEY, DEPLOY_HOST, etc.

## Step 6: Test CI Pipeline

1. Create a test branch:
```bash
git checkout -b test/ci-pipeline
```

2. Make a small change:
```bash
echo "# CI/CD test" >> CICD.md
git add CICD.md
git commit -m "test: trigger CI pipeline"
git push origin test/ci-pipeline
```

3. Create a Pull Request on GitHub

4. Monitor the CI workflow:
   - GitHub > Actions tab > Select CI workflow
   - Watch: Lint > Type Check > Test > Build
   - All should pass (green checkmarks)

5. Expected timing:
   - Lint: 2-3 minutes
   - Type Check: 3-4 minutes
   - Test: 4-6 minutes (includes Postgres/Redis startup)
   - Build: 5-8 minutes
   - Total: ~15-20 minutes

## Step 7: Test Deployment Pipeline

1. Ensure CI passed in step 6

2. Push to main:
```bash
git checkout main
git pull origin main
git merge test/ci-pipeline
git push origin main
```

3. Monitor Deploy workflow:
   - GitHub > Actions tab > Select Deploy workflow
   - Should build 3 images: api, dashboard, shopify-app
   - Push to ghcr.io with tags: sha-xxx, main, latest

4. Verify images in GitHub Container Registry:
   - GitHub > Packages > Select package
   - Should see ghcr.io/owner/witylogix/api:latest, etc.

## Step 8: Setup Deployment Target

### Option A: Kubernetes (Recommended for Production)

1. Create `infra/k8s/deployment.yaml`

2. Uncomment Kubernetes deployment in `.github/workflows/deploy.yml`

3. Add KUBE_CONFIG secret (base64 encoded kubeconfig)

### Option B: Fly.io (Quick Setup)

1. Install flyctl: https://fly.io/docs/getting-started/installing-flyctl/

2. Create app:
```bash
flyctl auth login
flyctl apps create witylogix-api
flyctl apps create witylogix-dashboard
```

3. Uncomment Fly.io deployment in `.github/workflows/deploy.yml`

4. Add FLY_API_TOKEN secret

### Option C: Railway (Easiest)

1. Connect GitHub repo to Railway.app

2. Create projects for api and dashboard

3. Railway auto-detects docker-compose.yml

4. Automatic deployments on push to main

### Option D: Custom Script

1. Create `scripts/deploy.sh` with your custom deployment logic

2. Add secrets: DEPLOY_KEY, DEPLOY_HOST

3. Uncomment custom script in `.github/workflows/deploy.yml`

## Step 9: Test Hot-Reload Development

```bash
# Start with dev overrides
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Wait for startup
sleep 10

# Make a code change
echo "// test comment" >> apps/api/src/server.ts

# Watch logs for hot-reload
docker compose logs -f api

# Cleanup
docker compose down
```

## Step 10: Production Checklist

Before going live:

- All CI tests passing consistently
- Health endpoints responding correctly
- Database migrations tested
- Secrets configured in GitHub Actions
- Deployment platform chosen and configured
- Load testing done
- Monitoring/alerts setup
- Rollback plan documented
- Team trained on deployment process

## Troubleshooting

### CI Pipeline Fails

Run locally to debug:
```bash
pnpm lint
pnpm typecheck
pnpm test --run
```

### Docker Build Fails

Clear cache and rebuild:
```bash
docker system prune -a
docker compose build --no-cache
```

### Health Check Fails

Check if API is running:
```bash
docker compose ps api
docker compose logs api
docker compose logs postgres
```

### Port Already in Use

Find and kill the process:
```bash
docker ps -a | grep witylogix
docker kill <container-id>
docker compose up -d
```

## Monitoring After Deployment

### Health Checks
```bash
curl https://api.witylogix.example.com/health
curl https://api.witylogix.example.com/health/ready
curl https://api.witylogix.example.com/health/deep
```

### Logs
```bash
kubectl logs -f deployment/witylogix-api -n production
```

### Metrics
- CPU/Memory usage
- Database connection pool
- Redis cache hit rate
- Request latency
- Error rates

## Rollback Procedures

### Kubernetes
```bash
kubectl rollout history deployment/witylogix-api -n production
kubectl rollout undo deployment/witylogix-api -n production --to-revision=1
```

### Fly.io
```bash
flyctl releases -a witylogix-api
flyctl releases rollback <release-number> -a witylogix-api
```

---

For detailed information, refer to CICD.md

Created: Sprint 2.3 | By: Rohan Gupta (Backend Lead)
