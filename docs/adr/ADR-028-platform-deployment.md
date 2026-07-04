# ADR-028: Platform Deployment Architecture & OpenAPI Spec Generator

**Date:** 2026-03-12
**Status:** Accepted
**Author:** Arjun (CTO)
**Reviewers:** Platform Engineering Team

## Title

Production Deployment Architecture with Service Mesh, Health Checks, and OpenAPI Auto-Generation

## Context

Witylogix platform needs a standardized, production-grade deployment architecture that:

1. **Scales horizontally** — multiple API instances, load balancing
2. **Provides observability** — Prometheus metrics, structured logging, health checks
3. **Ensures reliability** — graceful shutdown, zero-downtime deploys, circuit breakers
4. **Simplifies deployment** — Docker Compose for local dev, Kubernetes-ready manifests for production
5. **Auto-generates API docs** — OpenAPI 3.1 spec from route definitions
6. **Monitors service health** — proactive alerting, dependency checks

Current deployment is ad-hoc and lacks:

- Standardized health check strategy
- Metrics collection and correlation
- Graceful shutdown procedures
- Environment variable management best practices
- OpenAPI specification generation
- Service mesh configuration

## Problem Statement

**Current Pain Points:**

- No standardized health check endpoint (load balancers rely on HTTP 200 response)
- Missing Prometheus metrics for alerting and dashboards
- Deployment strategy unclear: how to handle DB migrations, worker startup, zero-downtime deploys?
- OpenAPI documentation generated manually or missing entirely
- No centralized logging with structured output
- Environment variable management inconsistent across services
- Secrets handling not standardized (hardcoded, missing VAULT integration)

**Target Goals:**

1. **Health Check Strategy**: simple `/health` for LB, `/health/detailed` for monitoring
2. **Graceful Shutdown**: 30s grace period for in-flight requests
3. **Zero-Downtime Deploys**: rolling restart via orchestrator
4. **OpenAPI Auto-Gen**: introspect routes, generate spec, serve Swagger UI
5. **Metrics**: Prometheus-compatible endpoint at `/metrics`
6. **Structured Logging**: JSON output with request IDs, tenant context

## Decision

We will implement a **production-ready deployment architecture** with:

### 1. Docker Compose Service Mesh

- **API** (port 3000): Express/Fastify app + health checks
- **Dashboard** (port 3001): Next.js frontend
- **Worker** (port none): BullMQ background jobs
- **PostgreSQL** (port 5432): Main data store + health checks
- **Redis** (port 6379): Cache + job queue + health checks
- **Nginx** (port 80/443): Reverse proxy, rate limiting, SSL termination

### 2. Health Check Architecture

- **Simple** (`GET /health`): 200 OK for load balancers (basic ping)
- **Detailed** (`GET /health/detailed`): Full report with dependency checks
- **Metrics** (`GET /metrics`): Prometheus-compatible output
- **Checks**: PostgreSQL latency, Redis connectivity, external service availability

### 3. Graceful Shutdown

- 30-second grace period for inflight requests
- Drain job queues before shutdown
- Close database/Redis connections cleanly
- Notify orchestrator via SIGTERM

### 4. Zero-Downtime Deploys

- Health checks verify service readiness
- Rolling restart: stop one instance, start new, repeat
- Database migrations run before app startup
- Feature flags enable/disable new code paths

### 5. OpenAPI 3.1 Specification

- Introspect Fastify routes at startup
- Convert Zod schemas to JSON Schema
- Group routes by prefix (tags)
- Support path params, query, request body, response schemas
- Serve Swagger UI at `/api/docs`

### 6. Environment Management

- `.env.example` → documentation of all variables
- `.env.production` → sensitive production values (Vault/Secrets Manager)
- Validation at startup: missing required variables = fail fast
- Precedence: ENV variables > .env file > defaults

### 7. Logging Strategy

- Structured JSON output (pino + pino-pretty in dev)
- Fields: timestamp, level, message, requestId, tenantId, duration, error
- Request tracing via X-Request-ID header
- Correlation ID propagation across services

## Implementation

### Docker Compose Production Architecture

```yaml
version: "3.9"
services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      api:
        condition: service_healthy
      dashboard:
        condition: service_healthy
    restart: unless-stopped

  api:
    build: .
    ports:
      - "3000"
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    volumes:
      - ./logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
    restart: unless-stopped

  dashboard:
    build: ./apps/dashboard
    ports:
      - "3001"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3000
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

  worker:
    build: .
    command: node dist/apps/api/src/workers/queue-worker.js
    environment:
      - NODE_ENV=production
      - REDIS_URL=${REDIS_URL}
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432"
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Health Check Service

```typescript
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    database: { status: string; latency: number; error?: string };
    redis: { status: string; memory: number; error?: string };
    services: Record<string, { status: string; error?: string }>;
  };
  uptime: number;
  version: string;
  timestamp: string;
}
```

### Graceful Shutdown Flow

1. Receive SIGTERM signal
2. Stop accepting new requests (health check returns 503)
3. Wait up to 30s for in-flight requests to complete
4. Drain job queue (finish processing jobs)
5. Close database connection
6. Close Redis connection
7. Exit with code 0

### OpenAPI Generation

- Fastify plugin introspects routes via `fastify.routes()`
- Zod-to-JSON-Schema converter: `z.object({...})` → JSON Schema
- Routes grouped by prefix: `/orders/*` → tag: "Orders"
- Response schemas inferred from handler or explicit decorator

### Environment Variables

**Required (fail on missing):**

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` — JWT signing key (32+ chars)

**Optional (with defaults):**

- `NODE_ENV` — development | staging | production (default: development)
- `LOG_LEVEL` — debug | info | warn | error (default: info)
- `PORT` — server port (default: 3000)
- `CORS_ORIGIN` — comma-separated allowed origins

**Secrets (Vault/Secrets Manager):**

- `API_KEY_*` — external API keys
- `WEBHOOK_SECRET_*` — Shopify/third-party secrets
- `SENDGRID_API_KEY` — email service

### Monitoring Strategy

**Prometheus Metrics:**

- `http_requests_total` — total requests by method, path, status
- `http_request_duration_ms` — request latency histogram
- `database_query_duration_ms` — query latency
- `redis_command_duration_ms` — cache latency
- `job_queue_size` — pending jobs

**Log Aggregation:**

- Structured JSON output to stdout
- Splunk/Datadog ingest via file/pipe
- Request ID for request → log correlation

**Alerting Rules:**

- Health check fails 3x → page on-call
- Error rate > 5% for 5 min → warning
- Response time > 500ms (p99) → performance alert

## Rationale

### Why Docker Compose + Kubernetes?

- **Dev Experience**: Docker Compose is easy to understand and modify
- **Production**: Kubernetes manifests generated from Compose spec
- **Local Testing**: Full service mesh on laptop with `docker-compose up`

### Why OpenAPI Auto-Generation?

- **Single Source of Truth**: routes define schema, no manual updates
- **API Consumer Ready**: Swagger UI, client SDKs, interactive testing
- **Consistency**: all endpoints follow spec, validation rules enforced

### Why Structured Logging?

- **Searchability**: filter by requestId, tenantId, error type
- **Performance Analysis**: measure latency across service boundaries
- **Debugging**: correlate logs with metrics/traces

### Why Graceful Shutdown?

- **Data Integrity**: finish in-flight requests before stopping
- **Zero Data Loss**: drain job queue, no orphaned tasks
- **Orchestrator Friendly**: respects SIGTERM, fails fast on timeout

## Risks & Mitigations

| Risk                                     | Mitigation                                                         |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Health check false positives (Redis lag) | Configurable timeout; separate "critical" vs "non-critical" checks |
| Secrets exposed in logs                  | Filter sensitive keys (passwords, tokens) before logging           |
| OpenAPI spec drift from code             | Auto-gen on startup; validation in CI                              |
| Deployment coordination (DB migrations)  | Run migrations before API startup; rollback on failure             |

## Future Enhancements

1. **Vault Integration** — inject secrets at runtime, auto-rotate
2. **Horizontal Scaling** — service discovery, load balancing
3. **Observability** — OpenTelemetry traces, Jaeger integration
4. **Canary Deployments** — gradual rollout with metrics comparison
5. **Feature Flags** — enable/disable features per tenant
6. **Rate Limiting** — per-tenant, per-IP, per-endpoint

## Examples

### Deploying to Production

```bash
# 1. Build images
docker build -t witylogix-api:latest -f Dockerfile .

# 2. Deploy via docker-compose
docker-compose -f docker-compose.yml up -d

# 3. Run migrations
docker-compose exec api npm run db:migrate

# 4. Verify health
curl http://localhost/health

# 5. Check detailed status
curl http://localhost/health/detailed
```

### Rolling Restart (Zero-Downtime)

```bash
# Scale to 2 instances
docker-compose up -d --scale api=2

# Stop one instance (inflight requests finish)
docker-compose stop api_1

# Stop other instance (new one already running)
docker-compose stop api_2

# Or via Kubernetes: kubectl set image deployment/api api=witylogix-api:v2
```

### Health Check Flow

```
GET /health (2ms)
  └─ Ping app → OK
  └─ Return 200 (load balancer happy)

GET /health/detailed (50ms)
  ├─ SELECT 1 from pg → OK (latency: 5ms)
  ├─ PING redis → OK (memory: 12MB)
  ├─ HEAD https://shopify.com → OK
  └─ Return 200 with all checks
```

## References

- [Kubernetes Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/data_model/)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [12-Factor App: Logs](https://12factor.net/logs)
- [Graceful Shutdown Pattern](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/#handling-signals-properly)
