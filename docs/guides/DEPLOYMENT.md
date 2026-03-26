# Witylogix Platform Deployment Guide

**Version:** 4.0.0 | **Last Updated:** 2026-03-16

Production deployment guide for Witylogix on Docker Compose (single-server) or Kubernetes (enterprise). This document covers prerequisites, environment configuration, database setup, monitoring, scaling, SSL/TLS, backups, and troubleshooting.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Compose Deployment](#docker-compose-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Monitoring & Observability](#monitoring--observability)
8. [Scaling Guide](#scaling-guide)
9. [Backup & Disaster Recovery](#backup--disaster-recovery)
10. [Health Checks](#health-checks)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements

**Development (Single server)**
- CPU: 4 cores (x86_64 or ARM64)
- Memory: 8 GB RAM
- Disk: 50 GB SSD (20GB OS, 30GB data)
- Network: 1 Gbps connection

**Production (Recommended)**
- API Servers: 2-3 instances (2 vCPU, 4 GB RAM each)
- Database: Dedicated instance (4+ vCPU, 16 GB RAM, 100 GB SSD)
- Cache (Redis): Dedicated instance (2 vCPU, 4 GB RAM)
- Load Balancer: AWS ELB / GCP Cloud Load Balancing
- Total: ~20 GB RAM, 200+ GB disk

### Software Requirements

```
- Docker 20.10+
- Docker Compose 2.0+ (or install standalone Compose v2)
- Node.js 20.0+ (for migrations/seeding)
- pnpm 9.15.0+
- PostgreSQL client tools (psql, pg_dump)
- curl, jq, openssl (for health checks)
```

**Installation:**
```bash
# macOS
brew install docker docker-compose node@20 pnpm postgresql

# Ubuntu/Debian
sudo apt-get install docker.io docker-compose curl jq openssl
sudo usermod -aG docker $USER

# Verify
docker --version      # Docker 20.10+
docker-compose --version  # Docker Compose 2.0+
node --version        # v20.0.0+
pnpm --version        # 9.15.0+
```

### DNS & SSL Prerequisites

**Domain Setup**
- A DNS domain (e.g., `delivery.acme.com`)
- DNS A record pointing to your server/load balancer
- MX records for email (if using SMTP)

**SSL Certificates**
- Let's Encrypt (free, auto-renew with Caddy)
- Self-signed (development only)
- Commercial CA (production recommended)

### Network Requirements

**Ports**
- 80/tcp: HTTP (redirects to HTTPS)
- 443/tcp: HTTPS (API, dashboard, webhooks)
- 5432/tcp: PostgreSQL (only if exposing DB externally, not recommended)
- 6379/tcp: Redis (only for internal cluster, not exposed)

**Firewall Rules (Cloud)**
```bash
# Example: AWS Security Group
Inbound:
  - 80/tcp from 0.0.0.0/0 (HTTP redirect)
  - 443/tcp from 0.0.0.0/0 (HTTPS)
  - 5432/tcp from 10.0.0.0/8 (Database - private only)
  - 6379/tcp from 10.0.0.0/8 (Redis - private only)

Outbound:
  - All (for external API calls)
```

---

## Docker Compose Deployment

### 1. Clone & Configure

```bash
# Clone repository
git clone https://github.com/witylogix/witylogix-platform.git
cd witylogix-platform

# Copy environment template
cp .env.example .env

# Edit configuration (see Environment Configuration section)
nano .env
```

### 2. Create .env File

Minimal production .env:

```bash
# Node environment
NODE_ENV=production

# API Configuration
API_PORT=3000
API_HOST=0.0.0.0
API_LOG_LEVEL=info

# Database
POSTGRES_USER=witylogix
POSTGRES_PASSWORD=$(openssl rand -base64 32)  # Generate secure password
POSTGRES_DB=witylogix
DATABASE_URL=postgresql://witylogix:${POSTGRES_PASSWORD}@postgres:5432/witylogix?schema=public

# Redis
REDIS_URL=redis://redis:6379
REDIS_MAXMEMORY=256mb

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Encryption
ENCRYPTION_KEY=$(openssl rand -base64 32)

# S3 File Storage
S3_BUCKET=witylogix-files-${ENVIRONMENT}
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# OAuth & Integrations
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SENDGRID_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=

# Domain (for CORS, webhooks)
DOMAIN=delivery.acme.com
DASHBOARD_URL=https://delivery.acme.com/admin
API_URL=https://delivery.acme.com/api

# Monitoring
SENTRY_DSN=
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 16)

# Email
SMTP_FROM=noreply@delivery.acme.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=${SENDGRID_API_KEY}
```

### 3. Initialize Docker Services

```bash
# Start all services (Postgres, Redis, API, Dashboard, etc.)
docker-compose -f infra/docker-compose.yml up -d

# Check service status
docker-compose -f infra/docker-compose.yml ps

# Expected output:
# NAME                STATUS                 PORTS
# witylogix-postgres  Up 2 minutes (healthy)  5432/tcp
# witylogix-redis     Up 2 minutes (healthy)  6379/tcp
# witylogix-api       Up 1 minute (healthy)   0.0.0.0:3000->3000/tcp
# witylogix-dashboard Up 1 minute             0.0.0.0:3001->3001/tcp
```

### 4. Run Database Migrations

```bash
# Generate Prisma client
pnpm run db:generate

# Run migrations
pnpm run db:migrate

# (Optional) Seed development data
pnpm run db:seed

# Verify database
docker-compose -f infra/docker-compose.yml exec postgres psql -U witylogix -d witylogix -c "\dt"
```

### 5. Set Up Reverse Proxy (Nginx/Caddy)

**Option A: Caddy (Automatic SSL)**

Create `Caddyfile`:
```caddyfile
delivery.acme.com {
  reverse_proxy localhost:3000 {
    header_uri -Authorization  # Remove auth header downstream
  }

  handle /admin* {
    reverse_proxy localhost:3001
  }

  encode gzip
}
```

Start Caddy:
```bash
docker run -d \
  -p 80:80 -p 443:443 \
  -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  caddy:latest
```

**Option B: Nginx (Manual SSL)**

Create `nginx.conf`:
```nginx
upstream api {
  server localhost:3000;
}

upstream dashboard {
  server localhost:3001;
}

server {
  listen 80;
  server_name delivery.acme.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name delivery.acme.com;

  ssl_certificate /etc/nginx/certs/delivery.acme.com.crt;
  ssl_certificate_key /etc/nginx/certs/delivery.acme.com.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  # API routes
  location /api {
    proxy_pass http://api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # Dashboard
  location /admin {
    proxy_pass http://dashboard;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Compression
  gzip on;
  gzip_types application/json text/css application/javascript;
}
```

```bash
# Run Nginx with config
docker run -d \
  -p 80:80 -p 443:443 \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf \
  -v $(pwd)/certs:/etc/nginx/certs \
  nginx:latest
```

### 6. Health Check

```bash
# API health
curl -s https://delivery.acme.com/api/health | jq .

# Expected:
# {
#   "status": "healthy",
#   "uptime": 12345,
#   "database": "connected",
#   "redis": "connected"
# }

# Dashboard
curl -I https://delivery.acme.com/admin
# HTTP/2 200
```

---

## Kubernetes Deployment

### 1. Install Kubernetes Tools

```bash
# Install kubectl, helm
brew install kubectl helm

# Or from source: https://kubernetes.io/docs/tasks/tools/

# Verify
kubectl version --client
helm version
```

### 2. Helm Chart Setup

Create `helm/values.yaml`:

```yaml
# Witylogix Helm Chart Values

replicaCount: 2

image:
  repository: witylogix/api
  tag: "4.0.0"
  pullPolicy: IfNotPresent

service:
  type: LoadBalancer
  port: 443
  targetPort: 3000

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: delivery.acme.com
      paths:
        - path: /api
          pathType: Prefix
  tls:
    - secretName: delivery-acme-com-tls
      hosts:
        - delivery.acme.com

resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

postgresql:
  enabled: true
  auth:
    username: witylogix
    password: changeme
    database: witylogix
  primary:
    persistence:
      size: 100Gi

redis:
  enabled: true
  auth:
    enabled: false
  master:
    persistence:
      size: 10Gi
```

### 3. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace witylogix

# Install Helm dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Deploy
helm install witylogix ./helm \
  --namespace witylogix \
  -f helm/values.yaml

# Verify
kubectl get pods -n witylogix
kubectl get svc -n witylogix

# Check deployment status
kubectl rollout status deployment/witylogix-api -n witylogix
```

### 4. Scaling

```bash
# Auto-scaling configuration
kubectl autoscale deployment witylogix-api \
  --namespace witylogix \
  --min=2 --max=10 \
  --cpu-percent=70

# Or edit values.yaml and upgrade
helm upgrade witylogix ./helm \
  --namespace witylogix \
  -f helm/values.yaml

# Manual scaling
kubectl scale deployment witylogix-api \
  --namespace witylogix \
  --replicas=5
```

---

## Environment Configuration

### All Environment Variables

```bash
# ─────────────────────────────────────────────────────────
# NODE & SERVER
# ─────────────────────────────────────────────────────────
NODE_ENV=production                    # production | development | test
API_PORT=3000                          # API server port
API_HOST=0.0.0.0                       # API server host
DASHBOARD_PORT=3001                    # Dashboard port
DASHBOARD_HOST=0.0.0.0
API_LOG_LEVEL=info                     # info | warn | error | debug

# ─────────────────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host:5432/dbname
POSTGRES_USER=witylogix
POSTGRES_PASSWORD=<secure_password>
POSTGRES_DB=witylogix
POSTGRES_PORT=5432

# Connection pooling (PgBouncer)
DB_POOL_SIZE=20                        # Connection pool size
DB_POOL_TIMEOUT=30000                  # ms

# ─────────────────────────────────────────────────────────
# REDIS
# ─────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=                        # If AUTH enabled
REDIS_MAXMEMORY=256mb                  # Max memory
REDIS_MAXMEMORY_POLICY=allkeys-lru    # Eviction policy

# ─────────────────────────────────────────────────────────
# SECURITY & SECRETS
# ─────────────────────────────────────────────────────────
JWT_SECRET=<32-byte-base64>            # Must be 32+ bytes
JWT_REFRESH_SECRET=<32-byte-base64>
JWT_EXPIRY=24h                         # JWT expiration
JWT_REFRESH_EXPIRY=7d

ENCRYPTION_KEY=<32-byte-base64>        # AES-256 encryption
ENCRYPTION_ALGORITHM=aes-256-gcm

# ─────────────────────────────────────────────────────────
# DOMAIN & URLS
# ─────────────────────────────────────────────────────────
DOMAIN=delivery.acme.com               # Main domain
API_URL=https://delivery.acme.com/api
DASHBOARD_URL=https://delivery.acme.com/admin
WEBHOOK_URL=https://delivery.acme.com/webhooks
CUSTOMER_TRACKING_URL=https://delivery.acme.com/track

CORS_ORIGINS=https://checkout.acme.com,https://admin.acme.com
CORS_CREDENTIALS=true

# ─────────────────────────────────────────────────────────
# STORAGE (S3)
# ─────────────────────────────────────────────────────────
STORAGE_PROVIDER=s3                    # s3 | local
S3_BUCKET=witylogix-files-prod
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<aws-key>
S3_SECRET_ACCESS_KEY=<aws-secret>
S3_ENDPOINT=                           # For S3-compatible services

# Local storage fallback
LOCAL_STORAGE_PATH=/data/uploads

# ─────────────────────────────────────────────────────────
# INTEGRATIONS & API KEYS
# ─────────────────────────────────────────────────────────

# Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_API_VERSION=2024-01            # Latest stable API version

# Stripe (Billing)
STRIPE_SECRET_KEY=sk_live_
STRIPE_PUBLISHABLE_KEY=pk_live_
STRIPE_WEBHOOK_SECRET=whsec_

# SendGrid (Email)
SENDGRID_API_KEY=

# Mailgun (Email fallback)
MAILGUN_API_KEY=
MAILGUN_DOMAIN=

# Twilio (SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Mapbox (Routing)
MAPBOX_API_TOKEN=

# Google Maps (Routing alternative)
GOOGLE_MAPS_API_KEY=

# Firebase (Push notifications)
FIREBASE_SERVICE_ACCOUNT=<json-key>    # JSON string
FIREBASE_PROJECT_ID=

# Sentry (Error tracking)
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=4.0.0

# ─────────────────────────────────────────────────────────
# EMAIL CONFIGURATION
# ─────────────────────────────────────────────────────────
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=${SENDGRID_API_KEY}
SMTP_FROM=noreply@delivery.acme.com
SMTP_FROM_NAME=Witylogix

# ─────────────────────────────────────────────────────────
# AUTH PROVIDERS
# ─────────────────────────────────────────────────────────

# Auth0
AUTH0_DOMAIN=tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# Clerk
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Google (OAuth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# GitHub (OAuth)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ─────────────────────────────────────────────────────────
# MONITORING & OBSERVABILITY
# ─────────────────────────────────────────────────────────
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<secure-password>

# ELK Stack (logs)
ELASTICSEARCH_URL=http://elasticsearch:9200
KIBANA_URL=http://localhost:5601

# ─────────────────────────────────────────────────────────
# FEATURE FLAGS
# ─────────────────────────────────────────────────────────
FEATURE_CAMPAIGNS=true                 # Campaign engine
FEATURE_BILLING=true                   # Billing & subscriptions
FEATURE_INTEGRATIONS=true              # Integration marketplace
FEATURE_AI_ANALYTICS=true              # AI-powered analytics
FEATURE_WEBHOOKS=true                  # Outbound webhooks
```

---

## Database Setup

### 1. PostgreSQL with PostGIS

**Docker:**
```bash
# Already included in docker-compose.yml
# Image: postgis/postgis:16-3.4-alpine
```

**Manual Installation (Ubuntu/Debian):**
```bash
# Install PostgreSQL 16
sudo apt-get install postgresql-16 postgresql-16-postgis-3

# Create user & database
sudo -u postgres createuser witylogix
sudo -u postgres createdb witylogix -O witylogix

# Enable PostGIS
sudo -u postgres psql -d witylogix -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d witylogix -c "CREATE EXTENSION IF NOT EXISTS uuid-ossp;"
```

### 2. Enable RLS (Row-Level Security)

```bash
# Connect to database
psql postgresql://witylogix:password@localhost:5432/witylogix

# Verify RLS is enabled on tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE rowsecurity = true
ORDER BY tablename;

# If not enabled, migrations will create policies automatically
\q
```

### 3. Run Migrations

```bash
# Using Prisma
pnpm run db:migrate

# Or manually with psql
psql postgresql://witylogix:password@localhost:5432/witylogix < infra/db/migrations/001_initial.sql

# Check migration history
psql postgresql://witylogix:password@localhost:5432/witylogix -c "SELECT * FROM _prisma_migrations;"
```

### 4. Database Backups

**Automated Backup Script:**

```bash
#!/bin/bash
# backup-postgres.sh

DB_USER=${POSTGRES_USER:-witylogix}
DB_HOST=${POSTGRES_HOST:-localhost}
DB_NAME=${POSTGRES_DB:-witylogix}
BACKUP_DIR=${BACKUP_DIR:-/backups/postgres}
RETENTION_DAYS=30

# Create backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/witylogix_${TIMESTAMP}.sql.gz"

mkdir -p ${BACKUP_DIR}

pg_dump \
  -U ${DB_USER} \
  -h ${DB_HOST} \
  --no-password \
  --compress=9 \
  --file=${BACKUP_FILE} \
  ${DB_NAME}

# Verify backup
if [ $? -eq 0 ]; then
  echo "Backup created: ${BACKUP_FILE}"

  # Upload to S3 (optional)
  aws s3 cp ${BACKUP_FILE} s3://witylogix-backups/postgres/

  # Cleanup old backups
  find ${BACKUP_DIR} -name "witylogix_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
else
  echo "Backup failed!"
  exit 1
fi
```

Schedule with cron:
```bash
# Run daily at 2 AM
0 2 * * * /root/backup-postgres.sh >> /var/log/backups.log 2>&1
```

**Restore from Backup:**
```bash
# Decompress and restore
gunzip -c /backups/postgres/witylogix_20260316_020000.sql.gz | \
  psql -U witylogix -h localhost -d witylogix

# Or using Prisma (recommended for schema consistency)
pnpm run db:migrate reset --force  # CAUTION: Destructive!
```

---

## SSL/TLS Setup

### 1. Let's Encrypt with Caddy (Recommended)

Caddy auto-renews HTTPS certificates:

```bash
# Caddyfile
delivery.acme.com {
  reverse_proxy localhost:3000
}

# Run
docker run -d \
  --name caddy \
  -p 80:80 -p 443:443 \
  -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  caddy:latest
```

### 2. Self-Signed Certificate (Development)

```bash
# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate (valid 365 days)
openssl req -new -x509 -key server.key -out server.crt \
  -subj "/C=US/ST=State/L=City/O=Org/CN=delivery.local"

# Create PEM file
cat server.key server.crt > server.pem

# Use in Nginx config
ssl_certificate /etc/nginx/certs/server.crt;
ssl_certificate_key /etc/nginx/certs/server.key;
```

### 3. Commercial Certificate (Production)

```bash
# Copy certificates to /etc/nginx/certs/
cp delivery.acme.com.crt /etc/nginx/certs/
cp delivery.acme.com.key /etc/nginx/certs/
cp delivery.acme.com.chain.crt /etc/nginx/certs/

# Update Nginx config
ssl_certificate /etc/nginx/certs/delivery.acme.com.crt;
ssl_certificate_key /etc/nginx/certs/delivery.acme.com.key;
ssl_trusted_certificate /etc/nginx/certs/delivery.acme.com.chain.crt;
```

### 4. Certificate Verification

```bash
# Check certificate validity
openssl x509 -in server.crt -text -noout | grep -A 2 "Validity"

# Check renewal dates (Let's Encrypt)
docker logs caddy | grep "Renew"

# Test SSL/TLS
curl -v https://delivery.acme.com/api/health
```

---

## Monitoring & Observability

### 1. Prometheus Metrics

Witylogix exposes Prometheus metrics at `/metrics`:

```bash
# Get metrics
curl http://localhost:3000/metrics

# Expected output (Prometheus format):
# # HELP witylogix_http_request_duration_seconds HTTP request duration
# # TYPE witylogix_http_request_duration_seconds histogram
# witylogix_http_request_duration_seconds_bucket{...} 0.015
# witylogix_http_request_duration_seconds_sum{...} 125.45
# witylogix_http_request_duration_seconds_count{...} 8420
```

**Prometheus Configuration:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'witylogix-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  - job_name: 'postgresql'
    static_configs:
      - targets: ['localhost:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']
```

Start Prometheus:
```bash
docker run -d \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus:latest
```

### 2. Grafana Dashboards

```bash
# Start Grafana
docker run -d \
  -p 3002:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD} \
  grafana/grafana:latest

# Access at http://localhost:3002
# Default: admin / admin
```

**Import dashboards:**
1. Add Prometheus data source (http://prometheus:9090)
2. Import dashboard JSONs from `/infra/monitoring/dashboards/`
3. Configure alerts

### 3. Structured Logging (Pino)

Logs are written as JSON to stdout:

```bash
# Follow API logs
docker-compose -f infra/docker-compose.yml logs -f api

# Filter by level
docker-compose -f infra/docker-compose.yml logs api | grep '"level":50' # error level
```

**Log Aggregation (ELK Stack):**

```bash
# Elasticsearch + Kibana + Logstash
docker-compose -f infra/docker-compose.elk.yml up

# Kibana dashboard at http://localhost:5601
```

### 4. Health Check Endpoints

```bash
# Full health check
curl https://delivery.acme.com/api/health

# Expected:
# {
#   "status": "healthy",
#   "uptime": 3600,
#   "timestamp": "2026-03-16T10:30:00Z",
#   "services": {
#     "database": { "status": "connected", "latency": 5 },
#     "redis": { "status": "connected", "latency": 2 },
#     "queue": { "status": "connected", "pending": 12 }
#   }
# }

# Liveness probe (K8s)
curl http://localhost:3000/health/live

# Readiness probe (K8s)
curl http://localhost:3000/health/ready
```

---

## Scaling Guide

### 1. Horizontal Scaling (API Servers)

```bash
# Scale API replicas (Docker Compose)
docker-compose -f infra/docker-compose.yml up -d --scale api=3

# Scale via Kubernetes
kubectl scale deployment witylogix-api --replicas=5 -n witylogix

# Verify
kubectl get pods -n witylogix | grep witylogix-api
```

### 2. Database Read Replicas

**AWS RDS:**
```bash
# Create read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier witylogix-read-1 \
  --source-db-instance-identifier witylogix-primary

# Connection string for read-only queries
export READ_REPLICA_URL="postgresql://user:pass@replica-endpoint:5432/witylogix"
```

**Prisma Configuration:**
```typescript
// For read-only queries, use replica connection
const readOnlyClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.READ_REPLICA_URL,
    },
  },
});

// Write queries still use primary
await prisma.orders.create({ ... });

// Read queries can use replica
const orders = await readOnlyClient.orders.findMany();
```

### 3. Redis Cluster

**Standalone → Cluster Migration:**

```bash
# Current: Single Redis instance
redis://localhost:6379

# Target: Redis Cluster (3 nodes minimum)
redis-cluster://node1:6379,node2:6379,node3:6379

# Update env
REDIS_URL=redis-cluster://redis-1:6379,redis-2:6379,redis-3:6379
```

**Docker Compose for Redis Cluster:**
```yaml
services:
  redis-1:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf

  redis-2:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf

  # Initialize cluster
  redis-init:
    image: redis:7-alpine
    depends_on:
      - redis-1
      - redis-2
      - redis-3
    entrypoint: redis-cli --cluster create redis-1:6379 redis-2:6379 redis-3:6379 --cluster-replicas 1 -a ""
```

### 4. Worker Process Scaling

```bash
# Scale worker processes (BullMQ)
WORKER_CONCURRENCY=10         # Jobs per worker
WORKER_INSTANCES=3            # Number of workers
WORKER_TIMEOUT=30000          # Job timeout (ms)

# Start workers
pnpm run start:workers

# Monitor queue depth
curl http://localhost:3000/admin/queues
```

---

## Backup & Disaster Recovery

### 1. Backup Strategy

**Backup Schedule:**
- **Database:** Daily at 2 AM (via PostgreSQL backup script)
- **Redis:** Hourly (RDB dumps)
- **Files:** Continuous sync to S3

**Retention:**
- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months

### 2. Automated Backup

```bash
#!/bin/bash
# backup-all.sh

set -e

BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p ${BACKUP_DIR}

echo "Starting backups..."

# PostgreSQL
pg_dump -U witylogix --no-password postgresql://witylogix@postgres:5432/witylogix | \
  gzip > ${BACKUP_DIR}/postgres_$(date +%H%M%S).sql.gz

# Redis
redis-cli BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb ${BACKUP_DIR}/redis_$(date +%H%M%S).rdb

# Upload to S3
aws s3 sync ${BACKUP_DIR} s3://witylogix-backups/$(date +%Y%m%d)/

echo "Backups completed at ${BACKUP_DIR}"
```

**Kubernetes CronJob:**
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: witylogix-backup
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: witylogix/backup:latest
            env:
            - name: POSTGRES_URL
              valueFrom:
                secretKeyRef:
                  name: witylogix-db
                  key: url
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: access-key
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: secret-key
          restartPolicy: OnFailure
```

### 3. Disaster Recovery (RTO/RPO)

**RTO: 30 minutes | RPO: 1 hour**

**Failover Procedure:**

```bash
# 1. Verify backup integrity
tar -tzf /backups/$(date +%Y%m%d)/postgres_020000.sql.gz | head

# 2. Restore to new database
gunzip -c /backups/$(date +%Y%m%d)/postgres_020000.sql.gz | \
  psql -U witylogix -h new-host -d witylogix

# 3. Update connection strings
export DATABASE_URL="postgresql://user:pass@new-host:5432/witylogix"
export REDIS_URL="redis://new-redis:6379"

# 4. Restart API servers
kubectl rollout restart deployment/witylogix-api -n witylogix

# 5. Verify health
curl https://delivery.acme.com/api/health
```

---

## Health Checks

### 1. API Health Endpoint

```bash
curl -s https://delivery.acme.com/api/health | jq .

# Response:
{
  "status": "healthy",
  "timestamp": "2026-03-16T10:30:00.000Z",
  "uptime": 3600000,
  "version": "4.0.0",
  "services": {
    "database": {
      "status": "connected",
      "latency_ms": 5,
      "pool_active": 18,
      "pool_idle": 2
    },
    "redis": {
      "status": "connected",
      "latency_ms": 2,
      "memory_mb": 128
    },
    "queue": {
      "status": "connected",
      "pending_jobs": 12
    }
  },
  "checks": {
    "database_connectivity": "pass",
    "redis_connectivity": "pass",
    "disk_space": "pass",
    "memory_usage": "pass"
  }
}
```

### 2. Kubernetes Probes

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
        image: witylogix/api:4.0.0

        # Liveness probe (restart if unhealthy)
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        # Readiness probe (accept traffic if ready)
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
```

---

## Troubleshooting

### Common Issues & Solutions

#### Issue: API Slow (p95 > 1s)

```bash
# Check database slow logs
docker-compose -f infra/docker-compose.yml exec postgres psql -c \
  "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check Redis memory
redis-cli INFO memory | grep used_memory_human

# Check worker queue depth
curl http://localhost:3000/admin/queues | jq '.*.pending'

# Solution
# 1. Add database indexes (see ARCHITECTURE.md)
# 2. Increase Redis memory (REDIS_MAXMEMORY)
# 3. Scale API replicas (kubectl scale deployment)
```

#### Issue: Database Connection Errors

```bash
# Check database connectivity
psql postgresql://witylogix:password@localhost:5432/witylogix -c "SELECT 1;"

# Check connection pool
docker-compose -f infra/docker-compose.yml logs postgres | tail -20

# Increase pool size
export DB_POOL_SIZE=30

# Restart API
kubectl rollout restart deployment/witylogix-api -n witylogix
```

#### Issue: Redis Memory Exhausted

```bash
# Check memory usage
redis-cli INFO memory

# Check top keys by memory
redis-cli --bigkeys

# Reduce TTLs or increase maxmemory
REDIS_MAXMEMORY=512mb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Restart Redis
docker-compose -f infra/docker-compose.yml restart redis
```

#### Issue: Webhook Delivery Failures

```bash
# Check dead-letter queue
redis-cli XLEN events:dead-letter

# Inspect failed webhooks
redis-cli XRANGE events:dead-letter - + | head -20

# Check webhook logs
docker-compose -f infra/docker-compose.yml logs api | grep webhook

# Manual retry
curl -X POST https://delivery.acme.com/api/webhooks/:id/retry
```

#### Issue: High CPU Usage

```bash
# Check running processes
kubectl top pods -n witylogix

# Get detailed logs
kubectl logs deployment/witylogix-api -n witylogix --all-containers=true | head -100

# Reduce worker concurrency
export WORKER_CONCURRENCY=5

# Restart workers
kubectl rollout restart deployment/witylogix-worker -n witylogix
```

---

## Additional Resources

- **ARCHITECTURE.md** — System design, data flows, modules
- **README.md** — Quick start, feature overview
- **Event Bus README** — (`packages/core/src/event-bus/README.md`)
- **Helm Charts** — (`infra/k8s/helm/`)
- **Docker Compose** — (`infra/docker-compose.yml`)
- **Nginx Config** — (`infra/nginx/nginx.conf`)

---

**Document Author:** AR (CTO/Architect)
**Last Updated:** 2026-03-16
**License:** AGPL-3.0
