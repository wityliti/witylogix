# API Security Quick Reference

## Critical Environment Variables for Production

```bash
# Required
CORS_ORIGINS="https://app.witylogix.com,https://dashboard.witylogix.com"
NODE_ENV=production
JWT_SECRET=$(openssl rand -base64 64)

# Recommended
ENABLE_HSTS=true
ENABLE_FRAMEGUARD=true
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_AUTHENTICATED_MAX=1000
SHUTDOWN_TIMEOUT_MS=30000
```

## Security Headers Applied

| Header                      | Value                | What It Does           |
| --------------------------- | -------------------- | ---------------------- |
| `X-Content-Type-Options`    | `nosniff`            | Prevents MIME sniffing |
| `X-Frame-Options`           | `SAMEORIGIN`         | Prevents clickjacking  |
| `X-XSS-Protection`          | `1; mode=block`      | Legacy XSS protection  |
| `Strict-Transport-Security` | `max-age=31536000`   | Forces HTTPS           |
| `Referrer-Policy`           | `strict-no-referrer` | Hides referrer         |
| `Permissions-Policy`        | `geolocation=(),...` | Disables features      |

## Rate Limits

| Endpoint Type   | Limit      | Per     |
| --------------- | ---------- | ------- |
| Unauthenticated | 200/min    | IP      |
| Authenticated   | 1000/min   | shopId  |
| Auth (login)    | 10/min     | IP      |
| API Key         | 10,000/min | API Key |

## Health Checks

```bash
# Liveness (is server up?)
curl https://api.witylogix.com/health
# Response: { status: "ok", timestamp: "..." }

# Readiness (are dependencies up?)
curl https://api.witylogix.com/ready
# Response: { status: "ready", checks: { database: "ok", redis: "ok" } }
```

## Monitoring & Testing

### Load test (should see rate limiting)

```bash
ab -n 300 -c 10 https://api.witylogix.com/api/v4/health
# Expected: ~200 succeed (200), ~100 fail (429)
```

### Verify security headers

```bash
curl -I https://api.witylogix.com/health
# Should show X-Content-Type-Options, X-Frame-Options, HSTS header
```

### Check CORS

```bash
curl -X OPTIONS https://api.witylogix.com/api/v4/orders \
  -H "Origin: https://app.witylogix.com"
# Should see: Access-Control-Allow-Origin: https://app.witylogix.com
```

## Middleware Execution Order

1. Security Headers (all responses)
2. Raw Body (webhook HMAC)
3. CORS (preflight)
4. Helmet (standard headers)
5. Rate Limiting (per IP/shopId)
6. JWT Auth
7. Routes
8. Error Handler

## Graceful Shutdown Sequence

1. Stop accepting new connections (HTTP server closes)
2. Shutdown Socket.io WebSocket server
3. Drain BullMQ workers
4. Disconnect Redis
5. Disconnect database
6. Exit process (timeout: 30s max)

## Key Files

- `apps/api/src/server.ts` - Main server with middleware registration
- `apps/api/src/middleware/security-headers.ts` - Security header middleware
- `apps/api/src/middleware/rate-limit-routes.ts` - Per-route rate limiting
- `apps/api/src/lib/config.ts` - Configuration with env validation

## Production Checklist

- [ ] CORS_ORIGINS configured (no wildcards)
- [ ] JWT_SECRET generated (64+ chars)
- [ ] NODE_ENV=production
- [ ] HTTPS at load balancer
- [ ] Logging aggregation configured
- [ ] Health checks in orchestrator
- [ ] Rate limits tested
- [ ] Security headers verified
- [ ] Graceful shutdown tested
- [ ] Monitoring/alerts set up

## Troubleshooting

**Q: Getting 429 errors in production?**
A: Check RATE_LIMIT_MAX_REQUESTS setting. May need to increase for your traffic volume.

**Q: CORS errors from frontend?**
A: Verify CORS_ORIGINS includes your frontend domain and origin header matches exactly.

**Q: Server not shutting down gracefully?**
A: Check SHUTDOWN_TIMEOUT_MS and ensure background jobs are completing.

**Q: Missing security headers?**
A: Verify ENABLE_HSTS, ENABLE_FRAMEGUARD are set to "true" in production.

## Key Metrics to Monitor

- Request rate (req/s)
- Error rate (5xx %)
- Latency (p50, p95, p99)
- Rate limit hits (429/min)
- Database connections
- Redis connections
- Graceful shutdown time

## Alerts to Set Up

- Error rate > 1% for 5 minutes
- Rate limit hits > 100/min
- Response time p95 > 1s
- CPU usage > 80%
- Memory > 80%
- Database connection pool > 90%
- Health check failures > 2x in a row
