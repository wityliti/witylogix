# Railway On-Call Runbook

Common failure modes and remediation steps for Railway-deployed Witylogix services.

For incident severity levels, escalation paths, and communication templates see
[incident-response.md](./incident-response.md).

## Services & Health Endpoints

| Service         | Health URL pattern        | Notes                     |
| --------------- | ------------------------- | ------------------------- |
| api             | `$API_URL/health`         | Returns `{"status":"ok"}` |
| dashboard       | `$DASHBOARD_URL/`         | Next.js — 200 + HTML      |
| customer-portal | `$CUSTOMER_PORTAL_URL/`   | Next.js — 200 + HTML      |
| shopify-app     | `$SHOPIFY_APP_URL/health` | Returns `{"status":"ok"}` |
| tracking-page   | `$TRACKING_PAGE_URL/`     | Vite SPA — 200 + HTML     |
| docs            | `$DOCS_URL/`              | Next.js — 200 + HTML      |

Run all smoke tests at once:

```bash
API_BASE_URL=https://api.witylogix.io \
DASHBOARD_BASE_URL=https://dashboard.witylogix.io \
CUSTOMER_PORTAL_BASE_URL=https://portal.witylogix.io \
SHOPIFY_APP_BASE_URL=https://shopify.witylogix.io \
TRACKING_PAGE_BASE_URL=https://track.witylogix.io \
DOCS_BASE_URL=https://docs.witylogix.io \
./tests/smoke/run-all.sh
```

---

## Scenario 1 — Service down (RailwayServiceDown alert)

**Symptoms**: `probe_success == 0` for a service; health endpoint returning non-200.

**Steps**:

1. Check Railway dashboard for the affected service — look for crash loop or OOM.
2. Tail recent logs:
   ```bash
   railway logs --service <service-name> --tail 200
   ```
3. Check for a failed deploy:
   ```bash
   railway status --service <service-name>
   ```
4. If a bad deploy caused the outage, roll back:
   ```bash
   railway rollback --service <service-name>
   ```
5. If the service is healthy but the probe still fails, verify the Railway public URL
   hasn't changed (check `railway domain` output).
6. Confirm recovery by re-running the service smoke test.

---

## Scenario 2 — API high error rate (APICriticalErrorRate / APIHighErrorRate alerts)

**Symptoms**: 5xx rate >1% (warning) or >5% (critical) sustained.

**Steps**:

1. Check API logs for error patterns:
   ```bash
   railway logs --service api --tail 500
   ```
2. Look for database connectivity issues — check `DATABASE_URL` secret is set:
   ```bash
   railway variables --service api | grep DATABASE
   ```
3. If DB connection pool is exhausted, restart the API service:
   ```bash
   railway restart --service api
   ```
4. If the errors are from a specific route, check Sentry for the full stack trace.
5. If a recent deploy introduced the regression, roll back:
   ```bash
   railway rollback --service api
   ```

---

## Scenario 3 — API high latency (APICriticalLatency / APIHighLatency alerts)

**Symptoms**: P95 latency >2s (warning) or >5s (critical).

**Steps**:

1. Check Sentry performance traces for slow transactions.
2. Inspect DB query time — look for missing indexes or N+1 queries in logs.
3. Check Railway metrics CPU/memory for the API service — resource pressure causes
   latency spikes.
4. If memory is near limit, scale up via Railway dashboard (increase memory limit) or
   restart to recover from a leak:
   ```bash
   railway restart --service api
   ```

---

## Scenario 4 — Shopify webhook delivery failures

**Symptoms**: Shopify partner dashboard shows failed webhook deliveries; errors in
shopify-app logs about signature validation or 500 responses.

**Steps**:

1. Check shopify-app health:
   ```bash
   railway logs --service shopify-app --tail 200
   ```
2. Verify `SHOPIFY_API_SECRET` is set correctly:
   ```bash
   railway variables --service shopify-app | grep SHOPIFY
   ```
3. If the secret was rotated in Shopify, update the Railway variable:
   ```bash
   railway variables set SHOPIFY_API_SECRET=<new-secret> --service shopify-app
   railway restart --service shopify-app
   ```
4. Replay failed webhooks from the Shopify partner dashboard after the service is
   confirmed healthy.

---

## Scenario 5 — Tracking pixel event ingestion failures

**Symptoms**: Pixel events not appearing in the dashboard; tracking-page or API logs
show ingestion errors.

**Steps**:

1. Confirm the tracking-page loads correctly (smoke test):
   ```bash
   BASE_URL=https://track.witylogix.io ./tests/smoke/tracking-page.sh
   ```
2. Check the API `/events` or `/track` endpoint logs for rejection reasons.
3. Look for CORS misconfigurations — verify `CORS_ORIGINS` env var includes the
   merchant domains.
4. If the issue is DB write latency, check DB metrics and consider read-replica
   offloading.

---

## Scenario 6 — Service slow (RailwayServiceSlow alert)

**Symptoms**: Health probe duration >5s; users report slow page loads.

**Steps**:

1. Check Railway metrics for CPU/memory pressure on the affected service.
2. Check if a cold-start is causing the slowness (Railway scales to zero for idle
   services) — if so, enable always-on or increase minimum instances in Railway
   dashboard.
3. For Next.js services (dashboard, customer-portal, docs), a slow cold-start is
   normal after a deploy — monitor for 2–3 minutes before escalating.
4. If the service remains slow, check for slow downstream dependencies (DB, external
   APIs) in Sentry traces.

---

## Scenario 7 — SSL certificate expiring (RailwaySSLCertExpiringSoon alert)

**Symptoms**: `probe_ssl_earliest_cert_expiry` < 14 days.

**Steps**:

1. Railway manages SSL certificates automatically for `*.railway.app` domains — no
   manual action needed for those.
2. For custom domains (`*.witylogix.io`), verify the domain DNS is still pointing to
   Railway:
   ```bash
   dig CNAME <custom-domain>
   ```
3. If DNS is correct, Railway should auto-renew. Check Railway dashboard for cert
   status under the service's domain settings.
4. If auto-renewal failed, remove and re-add the custom domain in Railway dashboard
   to trigger a new certificate issuance.

---

## Useful Railway CLI Commands

```bash
# List all services
railway service list

# Tail logs for a service
railway logs --service <name> --tail 200

# View environment variables
railway variables --service <name>

# Set an environment variable
railway variables set KEY=value --service <name>

# Restart a service
railway restart --service <name>

# Roll back to the previous deploy
railway rollback --service <name>

# Check service status / recent deploys
railway status --service <name>
```

---

## Escalation

If the above steps do not resolve the incident within the SLA, escalate to
**Arjun Rao (CTO)** via the chain of command defined in
[incident-response.md](./incident-response.md).
