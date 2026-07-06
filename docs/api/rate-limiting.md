# Rate Limiting Guide

The Witylogix API implements rate limiting to ensure fair usage and system stability. Rate limits are applied per tenant (organization/shop) and vary by subscription plan.

## Rate Limit Tiers

### Plan Limits (Requests per Minute)

| Plan           | Standard Endpoints | Webhook Events | Route Optimization | Total Burst |
| -------------- | ------------------ | -------------- | ------------------ | ----------- |
| **FREE**       | 100                | 50             | 5                  | 150         |
| **PRO**        | 1,000              | 500            | 50                 | 1,500       |
| **ENTERPRISE** | 10,000             | 5,000          | 500                | 15,000      |

### By Authentication Method

Even within a plan, rate limits vary by authentication method:

```
API Key (server-to-server): 100% of plan limit
JWT (user dashboard): 100% of plan limit
JWT (driver app): 50% of plan limit (to protect mobile bandwidth)
Anonymous (webhooks): 10 requests/minute
```

## Rate Limit Headers

Every API response includes rate limit information in headers:

```
X-RateLimit-Limit: 1000          # Requests allowed per minute
X-RateLimit-Remaining: 943        # Requests remaining this minute
X-RateLimit-Reset: 1647514260     # Unix timestamp when limit resets
X-RateLimit-Retry-After: 18       # Seconds to wait (if rate limited)
```

### Example Response Headers

```bash
$ curl -i https://api.witylogix.com/api/v4/orders \
  -H "Authorization: Bearer {token}"

HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 942
X-RateLimit-Reset: 1647514260
X-RateLimit-Retry-After: 0
...
```

## Rate Limit Behavior

### Window Sliding

Rate limits use a **sliding window** algorithm:

- Limits reset every 60 seconds
- Requests are counted across the entire window
- As old requests fall outside the window, new requests become available

Example:

```
Minute 00:00 - 00:60: 100 requests allowed
Minute 00:30 - 01:30: After 30 seconds, first 50 requests have "expired"
                       You can make ~50 more requests (depending on timing)
```

### Burst Allowance

Short-term traffic spikes are permitted within generous burst limits:

- **Burst Size**: Up to 2x the per-minute limit for up to 10 seconds
- **Automatic Backoff**: Burst quota regenerates at per-minute rate

Example (PRO plan, 1000/min limit):

```
Normal traffic: 1000 requests/minute spread evenly (~16/second)
Burst allowed: Up to 2000 requests for 10 seconds (~200/second)
```

## Handling Rate Limiting

### 429 Response

When rate limited, the API returns HTTP `429 Too Many Requests`:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 18 seconds.",
    "details": {
      "limit": 1000,
      "window": "1m",
      "retryAfter": 18
    }
  }
}
```

### Exponential Backoff Strategy

Implement exponential backoff when receiving 429 responses:

```typescript
async function callApiWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    const retryAfter = parseInt(
      response.headers.get("X-RateLimit-Retry-After") || "1",
    );

    // Exponential backoff: 2^attempt * retryAfter seconds
    const delaySeconds = Math.pow(2, attempt) * retryAfter;
    console.log(`Rate limited. Retrying after ${delaySeconds}s...`);

    await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
  }

  throw new Error(`Failed after ${maxRetries} attempts`);
}

// Usage
const response = await callApiWithRetry(
  "https://api.witylogix.com/api/v4/orders",
  { headers: { Authorization: `Bearer ${token}` } },
);
```

### JavaScript/TypeScript SDK

The official SDK handles rate limiting automatically:

```typescript
import { WitylogixClient } from "@witylogix/sdk";

const client = new WitylogixClient({
  apiKey: "wl_live_sk_...",
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 10000,
  },
});

// Automatically retries on 429 with exponential backoff
const orders = await client.orders.list();
```

### cURL with Retry

```bash
#!/bin/bash

retry_request() {
  local url=$1
  local token=$2
  local max_attempts=3
  local attempt=1
  local delay=1

  while [ $attempt -le $max_attempts ]; do
    response=$(curl -i -X GET "$url" \
      -H "Authorization: Bearer $token" 2>&1)

    status=$(echo "$response" | head -n 1 | awk '{print $2}')

    if [ "$status" != "429" ]; then
      echo "$response"
      return 0
    fi

    if [ $attempt -lt $max_attempts ]; then
      echo "Rate limited. Retrying in ${delay}s..." >&2
      sleep $delay
      delay=$((delay * 2))
    fi

    attempt=$((attempt + 1))
  done

  return 1
}

retry_request "https://api.witylogix.com/api/v4/orders" "$TOKEN"
```

## Per-Endpoint Rate Limits

Most endpoints share the plan-wide limit, but some intensive operations have separate limits:

| Endpoint                                 | Limit      | Notes                                           |
| ---------------------------------------- | ---------- | ----------------------------------------------- |
| `POST /api/v4/routes/{id}/optimize`      | 50/min     | Route optimization is computationally expensive |
| `POST /api/v4/webhooks/deliveries/retry` | 200/min    | Webhook retries                                 |
| `GET /api/v4/admin/metrics`              | 10/min     | Expensive aggregation query                     |
| All others                               | Plan limit | Standard rate limit                             |

### Example: Route Optimization

Route optimization is expensive and limited to 50 requests/minute (even on ENTERPRISE plan):

```bash
# This works (within 50/min limit)
curl -X POST https://api.witylogix.com/api/v4/routes/route-1/optimize \
  -H "Authorization: Bearer {token}"

# After 50 calls in one minute, subsequent calls get 429
curl -X POST https://api.witylogix.com/api/v4/routes/route-2/optimize \
  -H "Authorization: Bearer {token}"
# HTTP/1.1 429 Too Many Requests
```

## Quota Management

### Monitoring Usage

Check your current usage with the tenant API:

```bash
curl https://api.witylogix.com/api/v4/tenants/usage \
  -H "Authorization: Bearer {token}"
```

**Response:**

```json
{
  "data": {
    "plan": "PRO",
    "limits": {
      "ordersPerMinute": 1000,
      "webhookEventsPerMinute": 500,
      "routeOptimizationsPerMinute": 50
    },
    "currentUsage": {
      "ordersThisMinute": 342,
      "webhookEventsThisMinute": 128,
      "routeOptimizationsThisMinute": 12
    },
    "resetAt": "2025-03-16T10:35:00Z"
  }
}
```

### Usage Alerts

Configure email alerts when approaching limits:

```bash
curl -X PATCH https://api.witylogix.com/api/v4/tenants/config \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "alerting": {
      "enableRateLimitAlerts": true,
      "alertThreshold": 0.8,
      "alertEmails": ["ops@company.com"]
    }
  }'
```

## Optimizing API Usage

### Batch Operations

Combine multiple operations to reduce request count:

```bash
# Bad: 3 separate requests
curl -X POST https://api.witylogix.com/api/v4/orders/order-1/status
curl -X POST https://api.witylogix.com/api/v4/orders/order-2/status
curl -X POST https://api.witylogix.com/api/v4/orders/order-3/status

# Good: Single batch request (1 count)
curl -X POST https://api.witylogix.com/api/v4/orders/batch-status-update \
  -d '{
    "updates": [
      { "id": "order-1", "status": "DELIVERED" },
      { "id": "order-2", "status": "DELIVERED" },
      { "id": "order-3", "status": "DELIVERED" }
    ]
  }'
```

### Caching

Cache API responses locally to reduce requests:

```typescript
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 300 }); // 5-minute TTL

async function getDriver(driverId: string) {
  const cached = cache.get(`driver:${driverId}`);
  if (cached) return cached;

  const response = await fetch(
    `https://api.witylogix.com/api/v4/drivers/${driverId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const driver = await response.json();

  cache.set(`driver:${driverId}`, driver);
  return driver;
}
```

### Pagination

Use pagination to fetch only needed data:

```bash
# Request only 20 items (default) instead of all 1000
curl "https://api.witylogix.com/api/v4/orders?page=1&limit=20" \
  -H "Authorization: Bearer {token}"

# Avoid requesting all pages if you only need first 100 items
for page in {1..5}; do
  curl "https://api.witylogix.com/api/v4/orders?page=$page&limit=20"
done
```

### Webhook Efficiency

Instead of polling, use webhooks for event-driven updates:

```bash
# Bad: Poll every minute (1440 requests/day)
while true; do
  curl https://api.witylogix.com/api/v4/orders?status=DELIVERED
  sleep 60
done

# Good: Receive instant notifications (uses webhook quota instead)
# Register webhook endpoint and receive events in real-time
```

## Quota Upgrades

### Upgrading Plans

To increase rate limits, upgrade your plan:

```bash
curl -X PATCH https://api.witylogix.com/api/v4/tenants/plan \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "ENTERPRISE"
  }'
```

### Temporary Quota Increase

Contact support for temporary quota increases during peak periods:

```bash
curl -X POST https://api.witylogix.com/api/v4/support/quota-request \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Black Friday promotion - expecting 3x normal traffic",
    "startAt": "2025-11-29T00:00:00Z",
    "endAt": "2025-12-02T23:59:59Z",
    "requestedLimit": 30000
  }'
```

## Troubleshooting

**Q: Why am I getting rate limited even though I'm under my plan limit?**
A: Check if you're hitting a per-endpoint limit (e.g., route optimization). Use the usage endpoint to see current usage.

**Q: How is my driver app consuming so much quota?**
A: Driver apps have a 50% rate limit. Consider enabling client-side caching or longer polling intervals.

**Q: Can I get unlimited API access?**
A: ENTERPRISE customers can request unlimited quota for specific endpoints. Contact your account manager.

**Q: What happens after rate limit is exceeded?**
A: Requests return HTTP 429 with `Retry-After` header. Retry after the specified delay.

**Q: Do rate limits reset at a specific time?**
A: No, they use a sliding window. Limits reset continuously as seconds elapse.

## Monitoring & Alerting

### Set Up Monitoring

Monitor rate limit consumption with Prometheus/Grafana:

```python
from prometheus_client import Counter, Histogram
import time

api_requests = Counter(
    'witylogix_api_requests_total',
    'Total API requests',
    ['endpoint', 'status']
)

api_request_duration = Histogram(
    'witylogix_api_request_duration_seconds',
    'API request duration'
)

rate_limit_remaining = Gauge(
    'witylogix_rate_limit_remaining',
    'Remaining API calls this minute'
)

# Record metrics
start = time.time()
response = requests.get(
    'https://api.witylogix.com/api/v4/orders',
    headers={'Authorization': f'Bearer {token}'}
)
duration = time.time() - start

api_requests.labels(
    endpoint='/api/v4/orders',
    status=response.status_code
).inc()

api_request_duration.observe(duration)

remaining = int(response.headers.get('X-RateLimit-Remaining', 0))
rate_limit_remaining.set(remaining)
```

### Create Alerts

Alert when approaching limits:

```yaml
# Prometheus alert rule
- alert: RateLimitApproaching
  expr: witylogix_rate_limit_remaining < 100
  for: 2m
  annotations:
    summary: "API rate limit approaching ({{ $value }} remaining)"
    action: "Consider optimizing API usage or upgrading plan"
```
