# Integration System Overview

Witylogix provides a comprehensive integration platform connecting your existing business systems with our delivery management solution. Our architecture supports 124+ pre-built provider integrations and unlimited custom integrations through APIs and webhooks.

## How Integrations Work

### Architecture: Registry → Adapter → Provider

The integration system follows a three-layer architecture:

1. **Registry** — Central catalog of available integrations and configurations
2. **Adapter** — Translation layer that normalizes external API responses to Witylogix schema
3. **Provider** — Direct connection to third-party APIs with authentication

### Integration Lifecycle

#### 1. Install
Select and install an integration from the Integration Catalog. The system validates your API credentials and permissions.

```
Install → Validate Credentials → Store Configuration → Health Check
```

#### 2. Configure
Set up provider-specific options: data sync frequency, field mapping, event subscriptions, webhook endpoints.

#### 3. Health Check
Automatic periodic verification that the connection is active and responsive:
- Ping provider API endpoints
- Validate credentials haven't expired
- Monitor sync queue depth
- Alert on failures

#### 4. Use
Access integrated data through:
- **REST API** — Query and mutate integrated data
- **Webhooks** — Listen for provider events in real-time
- **Automated Syncs** — Background jobs sync data on schedule

## BYOK: Bring Your Own Key

Witylogix uses a BYOK (Bring Your Own Key) model for all integrations:

- **You own your credentials** — API keys, OAuth tokens, and authentication data are encrypted and stored in your isolated tenant
- **Direct connections** — Witylogix connects directly to your provider accounts, not ours
- **No data sharing** — We never log into your business systems on your behalf
- **Full transparency** — Audit logs show all integration activity

### Credential Management

```yaml
# Credentials are stored encrypted at rest
Integration Config:
  id: "shopify-prod"
  provider: "shopify"
  credentials:
    apiKey: "pk_***encrypted***"
    password: "***encrypted***"
    shop: "myshop.myshopify.com"
  createdAt: "2024-01-15T10:30:00Z"
  lastRotated: "2024-03-01T08:15:00Z"
  rotationRequired: false
```

## Metered Fallback Billing

When your provider account has insufficient quota or credits, Witylogix can optionally fall back to our metered billing:

- **Primary**: Route requests to your provider account
- **Fallback**: If quota exhausted, use Witylogix credit (paid per request)
- **Resumption**: When provider quota resets, automatically resume using your account

Example: Routing quota exceeded
```
Request → Provider API (quota full)
         → Fallback to Witylogix Metered Routing
         → Charge $0.005/request to your account
```

### Configuring Fallback

```javascript
const integration = await client.integrations.create({
  provider: "mapbox",
  credentials: { apiKey: "..." },
  fallback: {
    enabled: true,
    maxCost: 500, // dollars/month
    autoResumeAtQuotaReset: true,
  },
});
```

## OAuth Flow for Supported Providers

For OAuth-enabled integrations (Shopify, Slack, Google, etc.), the flow is seamless:

```
1. Click "Connect [Provider]" in dashboard
2. Redirect to provider's OAuth authorization page
3. You approve scope permissions
4. Provider redirects back with auth code
5. Witylogix exchanges code for access token
6. Token stored encrypted in your tenant
```

### Scope Management

Each provider defines required scopes. You can revoke integrations anytime from the dashboard—Witylogix automatically revokes the OAuth app token.

```yaml
Shopify OAuth:
  scopes:
    - "write_orders"      # Create/update orders
    - "read_orders"       # Read order data
    - "write_inventory"   # Sync inventory
  permissions:
    - admin/orders       # Order management
    - admin/inventory    # Inventory management
```

## Webhook Delivery for Integration Events

Integrations emit events as data changes. Webhooks deliver these events to your systems in real-time.

### Event Types

```
shipment.created          → Witylogix creates shipment
shipment.updated          → Shipment status changes
shipment.completed        → Delivery confirmed
delivery.proof.uploaded   → POD image received
driver.location.changed   → Real-time GPS update
```

### Webhook Configuration

```javascript
// Configure webhook endpoints
const webhook = await client.webhooks.create({
  integration: "shopify",
  url: "https://your-api.com/webhooks/shopify",
  events: [
    "shipment.created",
    "shipment.completed",
  ],
  retryPolicy: {
    maxRetries: 3,
    initialDelay: 5000, // 5 seconds
    maxDelay: 300000,   // 5 minutes
  },
});
```

### Guaranteed Delivery

- **At-least-once** semantics — Events delivered at least once, possibly more
- **Automatic retries** — Failed webhooks retry with exponential backoff
- **Event deduplication** — Your system should handle duplicate events using `idempotencyKey`
- **Webhook verification** — All webhooks signed with HMAC-SHA256

```javascript
// Verify webhook signature
import crypto from "crypto";

function verifyWebhookSignature(payload, signature, secret) {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
  return hash === signature;
}
```

## Data Sync Patterns

### Real-time Sync
For critical data (orders, shipments, locations), sync occurs immediately:

```
Event triggered → Webhook fired → Your system updated (< 1 second)
```

### Scheduled Sync
For background data (inventory, catalog, pricing), sync runs on schedule:

```
Every 30 minutes → Query provider API
                → Compare with local cache
                → Update changed records only
                → Log sync result
```

### On-demand Sync
Manually trigger sync for specific resources:

```javascript
const sync = await client.integrations.sync({
  id: "shopify-prod",
  resources: ["products", "inventory"],
  force: true, // ignore cache
});
```

## Provider Categories

### Routing & Optimization
Navigate and optimize delivery routes with map providers:
- Mapbox, OSRM, HERE Maps, Valhalla, Google Maps

### Telematics & GPS
Track vehicle and driver location:
- Samsara, Geotab, Motive, Verizon Connect, Flespi

### ERP Systems
Sync orders and inventory with business systems:
- SAP, NetSuite, Dynamics 365, Sage, Odoo

### CRM Platforms
Integrate customer and prospect data:
- Salesforce, HubSpot, Dynamics, Zoho

### Messaging & Communications
Send notifications via SMS, email, push:
- Twilio, SendGrid, Firebase, OneSignal

### And 15+ more categories...

## Monitoring & Debugging

### Health Dashboard
Monitor integration status in real-time:

```
Integration Name     Status        Last Sync     Error Rate
─────────────────────────────────────────────────────────
Shopify (prod)       ✅ Connected   2m ago        0%
Mapbox Routing       ⚠️ Degraded    30s ago       2.3%
Slack Notifications  ❌ Failed      1h ago        100%
```

### Logs & Audit Trail
View detailed logs of all integration activity:

```
Timestamp           Event               Details
────────────────────────────────────────────────────
2024-03-16 14:23:01 webhook.delivered  Shipment #12345 created
2024-03-16 14:22:56 api.call           GET /orders → 200 OK
2024-03-16 14:22:45 auth.refresh       OAuth token refreshed
2024-03-16 14:22:30 sync.error         Connection timeout (retry #2)
```

### Error Handling

| Error Type | Cause | Action |
|-----------|-------|--------|
| Authentication Failed | Invalid credentials | Revalidate API keys, rotate if exposed |
| Rate Limited | Quota exceeded | Wait for quota reset or enable fallback |
| Schema Mismatch | Data incompatible | Review field mapping configuration |
| Network Timeout | Provider unreachable | Check provider status page, retry |

## Security & Compliance

- **Encryption at rest** — All credentials encrypted with AES-256
- **Encryption in transit** — All API calls use HTTPS TLS 1.3
- **Credential rotation** — Automatic rotation for expiring tokens
- **Least privilege** — Request only required OAuth scopes
- **Audit logging** — All integration activity logged for compliance
- **SOC 2 compliance** — Third-party audited security controls

## Next Steps

- **Install integrations** — Browse the [Integration Catalog](/docs/integrations/catalog)
- **Setup guides** — Follow provider-specific [setup guides](/docs/integrations/guides)
- **Build custom integrations** — Use the [API](/docs/api) and [webhooks](/docs/guides/webhooks)
- **Troubleshoot issues** — Check [troubleshooting guide](/docs/integrations/TROUBLESHOOTING)
