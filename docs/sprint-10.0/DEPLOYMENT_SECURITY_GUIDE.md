# Production Deployment Security Guide

## Quick Start: Hardened API Server

This guide covers deploying the Witylogix API server with security hardening enabled.

---

## Environment Variables

### Required for Production

```bash
# Node environment
export NODE_ENV=production
export PORT=8000
export HOST=0.0.0.0
export LOG_LEVEL=info

# CRITICAL: CORS Configuration
# List all domains that should access the API (NO wildcards)
export CORS_ORIGINS="https://app.example.com,https://dashboard.example.com,https://tracking.example.com"

# Rate Limiting (defaults are already strict, but can be tuned)
export RATE_LIMIT_WINDOW_MS=60000           # 1 minute window
export RATE_LIMIT_MAX_REQUESTS=200          # Per IP, unauthenticated
export RATE_LIMIT_AUTHENTICATED_MAX=1000    # Per shopId, authenticated
export RATE_LIMIT_STRICT_MAX=10             # Auth endpoints (login, register)

# Security Headers
export ENABLE_HSTS=true                     # Force HTTPS (Strict-Transport-Security)
export HSTS_MAX_AGE=31536000                # 1 year in seconds
export ENABLE_FRAMEGUARD=true               # X-Frame-Options: SAMEORIGIN
export ENABLE_CSP=false                     # Keep false for Shopify iframe

# Graceful Shutdown
export SHUTDOWN_TIMEOUT_MS=30000            # 30 seconds before force exit

# Database & Cache
export DATABASE_URL="postgresql://user:password@db.internal:5432/witylogix"
export REDIS_URL="redis://:password@redis.internal:6379"

# JWT Secret (MUST be 64+ characters, cryptographically random)
export JWT_SECRET="$(openssl rand -base64 64)"
```

### Generating Secure Secrets

```bash
# 64-character random secret (for JWT_SECRET)
openssl rand -base64 64

# Example output:
# BnL4kZXy2+pMrT9wQv3sJhL5mN8gF1jK0wX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5y/Z6+aB7cD8eF9
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo files
COPY pnpm-lock.yaml .
COPY package.json .
COPY apps ./apps
COPY packages ./packages

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Build API
RUN pnpm build --filter="@witylogix/api"

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy only production dependencies and built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json

# Run as non-root
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })"

# Start server
CMD ["node", "dist/server.js"]
```

### Docker Compose Example

```yaml
version: "3.9"

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      NODE_ENV: production
      CORS_ORIGINS: "https://app.local,https://dashboard.local"
      DATABASE_URL: "postgresql://app:password@postgres:5432/witylogix"
      REDIS_URL: "redis://redis:6379"
      JWT_SECRET: "${JWT_SECRET}"
      RATE_LIMIT_MAX_REQUESTS: "200"
      ENABLE_HSTS: "true"
      ENABLE_FRAMEGUARD: "true"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: witylogix
      POSTGRES_PASSWORD: "${DB_PASSWORD}"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass "${REDIS_PASSWORD}"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## Kubernetes Deployment

### Secrets

```bash
# Create namespace
kubectl create namespace witylogix

# Create secrets
kubectl create secret generic api-secrets \
  --from-literal=jwt-secret="$(openssl rand -base64 64)" \
  --from-literal=db-password="$(openssl rand -base64 32)" \
  --from-literal=redis-password="$(openssl rand -base64 32)" \
  -n witylogix

# Verify
kubectl get secrets -n witylogix
```

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: witylogix-api
  namespace: witylogix
spec:
  replicas: 3
  selector:
    matchLabels:
      app: witylogix-api
  template:
    metadata:
      labels:
        app: witylogix-api
    spec:
      serviceAccountName: witylogix-api
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - name: api
          image: witylogix/api:v4.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8000
          env:
            # App Configuration
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "8000"
            - name: HOST
              value: "0.0.0.0"
            - name: LOG_LEVEL
              value: "info"

            # CORS (MUST configure for your domains)
            - name: CORS_ORIGINS
              value: "https://app.witylogix.com,https://dashboard.witylogix.com"

            # Rate Limiting
            - name: RATE_LIMIT_WINDOW_MS
              value: "60000"
            - name: RATE_LIMIT_MAX_REQUESTS
              value: "200"
            - name: RATE_LIMIT_AUTHENTICATED_MAX
              value: "1000"
            - name: RATE_LIMIT_STRICT_MAX
              value: "10"

            # Security Headers
            - name: ENABLE_HSTS
              value: "true"
            - name: HSTS_MAX_AGE
              value: "31536000"
            - name: ENABLE_FRAMEGUARD
              value: "true"
            - name: ENABLE_CSP
              value: "false"

            # Graceful Shutdown
            - name: SHUTDOWN_TIMEOUT_MS
              value: "30000"

            # Database
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-config
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: api-config
                  key: redis-url

            # JWT Secret
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: jwt-secret

            # Other required env vars
            - name: SHOPIFY_API_KEY
              valueFrom:
                secretKeyRef:
                  name: api-config
                  key: shopify-api-key
            - name: SHOPIFY_API_SECRET
              valueFrom:
                secretKeyRef:
                  name: api-config
                  key: shopify-api-secret
            - name: SHOPIFY_APP_URL
              value: "https://app.witylogix.com"

          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 2

          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi

          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
            readOnlyRootFilesystem: true

          volumeMounts:
            - name: tmp
              mountPath: /tmp

      volumes:
        - name: tmp
          emptyDir: {}

      terminationGracePeriodSeconds: 40  # Allow 30s shutdown + 10s buffer

---
apiVersion: v1
kind: Service
metadata:
  name: witylogix-api
  namespace: witylogix
spec:
  type: ClusterIP
  ports:
    - port: 8000
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: witylogix-api

---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: witylogix-api
  namespace: witylogix
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: witylogix-api

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: witylogix-api
  namespace: witylogix
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: witylogix-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## Load Balancer Configuration

### NGINX (Reverse Proxy)

```nginx
upstream api {
    server api1:8000;
    server api2:8000;
    server api3:8000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.witylogix.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/certs/api.crt;
    ssl_certificate_key /etc/nginx/certs/api.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers (backup to app headers)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Rate limiting at edge (DDoS protection)
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;

    # Proxy to upstream
    location / {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
        proxy_set_header X-Request-ID $request_id;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://api/health;
        access_log off;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.witylogix.com;
    return 301 https://$server_name$request_uri;
}
```

### AWS ALB Configuration

```hcl
resource "aws_lb_target_group" "api" {
  name        = "witylogix-api"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }
}

resource "aws_lb" "api" {
  name               = "witylogix-api"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_listener" "api_https" {
  load_balancer_arn = aws_lb.api.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_lb_listener" "api_http" {
  load_balancer_arn = aws_lb.api.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
```

---

## WAF Rules (AWS WAF Example)

```hcl
resource "aws_wafv2_web_acl" "api" {
  name        = "witylogix-api-waf"
  scope       = "REGIONAL"
  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitRule"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2
    action {
      block {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "witylogix-api-waf"
    sampled_requests_enabled   = true
  }
}
```

---

## Monitoring & Logging

### CloudWatch Logs Configuration

```yaml
# In your API container environment
AWS_REGION: us-east-1
AWS_LOG_GROUP: /witylogix/api
AWS_LOG_STREAM: witylogix-api-${HOSTNAME}

# In CloudWatch, create log insights queries:
fields @timestamp, @message, statusCode, durationMs, tenantId
| filter statusCode >= 500
| stats count() as error_count by statusCode

# Slow request monitoring:
fields @timestamp, @message, durationMs, url
| filter durationMs > 2000
| stats avg(durationMs), max(durationMs) by url
```

### Metrics to Monitor

- **Request Rate:** Requests per second
- **Error Rate:** 5xx errors per minute
- **Latency:** p50, p95, p99 response times
- **Rate Limit Hits:** 429 responses per minute
- **Database Connection Pool:** Active connections
- **Redis Connection Pool:** Connected clients

### Alerting

```yaml
Alerts:
  - name: HighErrorRate
    condition: error_rate > 1%
    duration: 5m
    action: page on-call

  - name: RateLimitExceeded
    condition: rate_limit_hits > 100/min
    duration: 10m
    action: investigate traffic patterns

  - name: SlowRequests
    condition: p95_latency > 1000ms
    duration: 15m
    action: investigate database/upstream issues

  - name: HighCPU
    condition: cpu_usage > 80%
    duration: 5m
    action: auto-scale or investigate

  - name: DatabaseConnectionPoolFull
    condition: active_connections > max_connections * 0.9
    duration: 2m
    action: page on-call
```

---

## Security Checklist Before Going Live

- [ ] CORS_ORIGINS configured with actual domains (no wildcards)
- [ ] JWT_SECRET is 64+ chars, cryptographically random
- [ ] NODE_ENV=production
- [ ] LOG_LEVEL=info (not debug)
- [ ] HTTPS enforced at load balancer
- [ ] Database password is strong
- [ ] Redis password is strong
- [ ] WAF rules enabled
- [ ] DDoS protection enabled (CloudFlare/Shield)
- [ ] Logging aggregation configured
- [ ] Monitoring alerts set up
- [ ] Health checks configured in orchestrator
- [ ] Graceful shutdown tested
- [ ] Rate limits tested under load
- [ ] Security headers validated with curl/securityheaders.com
- [ ] Database backups automated
- [ ] Database replicas configured (for HA)
- [ ] Redis replication/clustering configured
- [ ] SSL certificates auto-renew (certbot/ACM)
- [ ] Emergency incident playbook created
- [ ] On-call rotation established

---

## Troubleshooting

### Check CORS Headers

```bash
curl -X OPTIONS https://api.witylogix.com/api/v4/orders \
  -H "Origin: https://app.witylogix.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should see:
# Access-Control-Allow-Origin: https://app.witylogix.com
# Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

### Check Security Headers

```bash
curl -I https://api.witylogix.com/health

# Should see:
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# Referrer-Policy: strict-no-referrer
# Permissions-Policy: geolocation=(), microphone=(), ...
```

### Check Health Endpoints

```bash
# Liveness
curl https://api.witylogix.com/health

# Readiness (with dependency checks)
curl https://api.witylogix.com/ready
```

### View Logs

```bash
# Docker
docker logs -f api_container

# Kubernetes
kubectl logs -f deployment/witylogix-api -n witylogix

# CloudWatch
aws logs tail /witylogix/api --follow
```

### Rate Limit Testing

```bash
# Send 250 requests in quick succession (should see some 429s)
for i in {1..250}; do
  curl -s -w "%{http_code}\n" https://api.witylogix.com/health -o /dev/null
done | sort | uniq -c

# Expected: ~200 200s, ~50 429s
```

---

## References

- [Fastify in Production](https://www.fastify.io/docs/latest/Deployment/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
