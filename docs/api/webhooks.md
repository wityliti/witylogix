# Webhooks Guide

Webhooks enable real-time event-driven integration with the Witylogix API. Instead of polling for updates, your application receives instant notifications when important events occur.

## Getting Started

### 1. Create a Webhook Endpoint

Register an HTTPS endpoint to receive webhook events:

```bash
curl -X POST https://api.witylogix.com/api/v4/webhooks \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourapp.com/webhooks/witylogix",
    "events": [
      "order.created",
      "order.status_changed",
      "delivery.completed"
    ],
    "isActive": true
  }'
```

**Response:**
```json
{
  "data": {
    "id": "webhook_550e8400e29b41d4a716446655440000",
    "url": "https://yourapp.com/webhooks/witylogix",
    "events": ["order.created", "order.status_changed", "delivery.completed"],
    "secret": "whsec_1234567890abcdef1234567890abcdef",
    "isActive": true,
    "failureCount": 0,
    "createdAt": "2025-03-16T10:30:00Z"
  }
}
```

### 2. Verify Webhook Signature

Every webhook includes an HMAC-SHA256 signature. Verify it to ensure authenticity:

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your Express webhook handler
app.post('/webhooks/witylogix', (req, res) => {
  const payload = req.rawBody; // Raw body (string)
  const signature = req.headers['x-witylogix-signature'] as string;
  const secret = process.env.WITYLOGIX_WEBHOOK_SECRET;

  if (!verifyWebhookSignature(payload, signature, secret)) {
    return res.status(401).send('Unauthorized');
  }

  const event = JSON.parse(payload);
  // Process event
  res.status(200).send('OK');
});
```

### 3. Handle Webhook Events

Process incoming webhook events:

```typescript
app.post('/webhooks/witylogix', async (req, res) => {
  const event = req.body;

  try {
    switch (event.type) {
      case 'order.created':
        await handleOrderCreated(event.data);
        break;
      case 'order.status_changed':
        await handleOrderStatusChanged(event.data);
        break;
      case 'delivery.completed':
        await handleDeliveryCompleted(event.data);
        break;
      default:
        console.warn(`Unknown event type: ${event.type}`);
    }

    // Always return 200 OK quickly
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 5xx to trigger retry
    res.status(500).send('Error');
  }
});
```

## Available Events

### Order Events

#### `order.created`
Triggered when a new order is created.

```json
{
  "id": "evt_550e8400e29b41d4a716446655440000",
  "type": "order.created",
  "createdAt": "2025-03-16T10:30:00Z",
  "data": {
    "id": "order_550e8400e29b41d4a716446655440000",
    "shopId": "shop_550e8400e29b41d4a716446655440000",
    "shopifyOrderId": "4894123456789",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "+14155552671",
    "addressLine1": "123 Main St",
    "city": "San Francisco",
    "postalCode": "94102",
    "country": "US",
    "totalPrice": 99.99,
    "itemCount": 2,
    "status": "PENDING",
    "createdAt": "2025-03-16T10:30:00Z"
  }
}
```

#### `order.status_changed`
Triggered when order status transitions.

```json
{
  "id": "evt_550e8400e29b41d4a716446655440001",
  "type": "order.status_changed",
  "createdAt": "2025-03-16T10:35:00Z",
  "data": {
    "id": "order_550e8400e29b41d4a716446655440000",
    "oldStatus": "PENDING",
    "newStatus": "ACCEPTED",
    "reason": "Order accepted by dispatcher",
    "timestamp": "2025-03-16T10:35:00Z"
  }
}
```

#### `order.assigned`
Triggered when order is assigned to a driver.

```json
{
  "type": "order.assigned",
  "data": {
    "orderId": "order_550e8400e29b41d4a716446655440000",
    "driverId": "driver_550e8400e29b41d4a716446655440000",
    "driverName": "John Smith",
    "assignedAt": "2025-03-16T10:40:00Z"
  }
}
```

### Delivery Events

#### `delivery.completed`
Triggered when delivery is successfully completed.

```json
{
  "type": "delivery.completed",
  "data": {
    "orderId": "order_550e8400e29b41d4a716446655440000",
    "driverId": "driver_550e8400e29b41d4a716446655440000",
    "completedAt": "2025-03-16T11:45:00Z",
    "proofOfDelivery": {
      "signatureUrl": "https://storage.witylogix.com/signatures/sig_123.png",
      "photoUrls": [
        "https://storage.witylogix.com/photos/photo_123.jpg"
      ]
    }
  }
}
```

#### `delivery.failed`
Triggered when delivery attempt fails.

```json
{
  "type": "delivery.failed",
  "data": {
    "orderId": "order_550e8400e29b41d4a716446655440000",
    "driverId": "driver_550e8400e29b41d4a716446655440000",
    "failureReason": "Address not found",
    "failedAt": "2025-03-16T11:45:00Z",
    "retryScheduled": true,
    "nextRetryAt": "2025-03-17T09:00:00Z"
  }
}
```

### Driver Events

#### `driver.location_updated`
Triggered when driver location is updated (real-time tracking).

```json
{
  "type": "driver.location_updated",
  "data": {
    "driverId": "driver_550e8400e29b41d4a716446655440000",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 5.0,
    "timestamp": "2025-03-16T10:35:00Z"
  }
}
```

### Route Events

#### `route.optimized`
Triggered when route optimization completes.

```json
{
  "type": "route.optimized",
  "data": {
    "routeId": "route_550e8400e29b41d4a716446655440000",
    "totalDistance": 42.5,
    "estimatedDuration": 120,
    "stops": [
      {
        "sequence": 1,
        "orderId": "order_550e8400e29b41d4a716446655440000",
        "estimatedArrival": "2025-03-16T11:00:00Z"
      },
      {
        "sequence": 2,
        "orderId": "order_550e8400e29b41d4a716446655440001",
        "estimatedArrival": "2025-03-16T11:25:00Z"
      }
    ]
  }
}
```

### Integration Events

#### `integration.error`
Triggered when integration encounters an error.

```json
{
  "type": "integration.error",
  "data": {
    "integrationId": "integration_550e8400e29b41d4a716446655440000",
    "integrationType": "SHOPIFY",
    "errorCode": "WEBHOOK_SIGNATURE_INVALID",
    "errorMessage": "Webhook signature verification failed",
    "occurredAt": "2025-03-16T10:35:00Z",
    "retryScheduled": true,
    "nextRetryAt": "2025-03-16T10:45:00Z"
  }
}
```

## Webhook Payload Format

All webhooks follow this format:

```typescript
interface WebhookEvent {
  id: string;           // Unique event ID
  type: string;         // Event type (e.g., "order.created")
  createdAt: string;    // ISO 8601 timestamp
  data: Record<string, any>; // Event-specific data
  attempt: number;      // Delivery attempt (1 for first)
}
```

## Retry Policy

Failed deliveries are automatically retried with exponential backoff:

| Attempt | Delay | Total Wait |
|---------|-------|-----------|
| 1 | Immediate | - |
| 2 | 5 minutes | 5m |
| 3 | 25 minutes | 30m |
| 4 | 2 hours | 2.5h |
| 5 | 8 hours | 10.5h |
| 6 | 24 hours | 34.5h |

### Retry Conditions

Webhooks are retried for:
- Network timeouts
- HTTP 5xx responses
- Request takes > 30 seconds

Webhooks are NOT retried for:
- HTTP 2xx responses (success)
- HTTP 4xx responses (client error)
- Invalid endpoint URL

### Manual Retry

Retry a failed delivery:

```bash
curl -X POST https://api.witylogix.com/api/v4/webhooks/deliveries/{deliveryId}/retry \
  -H "Authorization: Bearer {token}"
```

## Idempotency

Webhook events are delivered at least once. Handle duplicate events by checking the event ID:

```typescript
const processedEvents = new Set<string>();

app.post('/webhooks/witylogix', async (req, res) => {
  const event = req.body;

  // Skip if already processed
  if (processedEvents.has(event.id)) {
    return res.status(200).send('OK');
  }

  // Process event
  await handleEvent(event);

  // Mark as processed
  processedEvents.add(event.id);

  res.status(200).send('OK');
});
```

Or use a database:

```typescript
app.post('/webhooks/witylogix', async (req, res) => {
  const event = req.body;

  // Check if already processed
  const existing = await db.webhookEvents.findUnique({
    where: { id: event.id }
  });

  if (existing) {
    return res.status(200).send('OK');
  }

  // Process and record
  try {
    await handleEvent(event);
    await db.webhookEvents.create({ data: event });
    res.status(200).send('OK');
  } catch (error) {
    // Return 5xx to trigger retry (won't create record)
    res.status(500).send('Error');
  }
});
```

## Dead Letter Queue (DLQ)

Webhooks that fail all retry attempts are moved to the Dead Letter Queue:

```bash
# List DLQ events
curl https://api.witylogix.com/api/v4/webhooks/dlq \
  -H "Authorization: Bearer {token}"
```

**Response:**
```json
{
  "data": [
    {
      "id": "dlq_event_123",
      "webhookId": "webhook_550e8400e29b41d4a716446655440000",
      "event": { ... },
      "lastError": "Connection timeout after 30 seconds",
      "failureCount": 6,
      "movedAt": "2025-03-17T10:35:00Z"
    }
  ]
}
```

### Handle DLQ Events

Investigate and manually retry DLQ events:

```bash
# Retry a DLQ event
curl -X POST https://api.witylogix.com/api/v4/webhooks/dlq/{dlqEventId}/retry \
  -H "Authorization: Bearer {token}"
```

## Testing Webhooks

### Local Testing with ngrok

Test webhooks locally by exposing your server:

```bash
# Install ngrok
npm install -g ngrok

# Start your server
npm run dev

# In another terminal, expose port 3000
ngrok http 3000

# Register webhook with ngrok URL
curl -X POST https://api.witylogix.com/api/v4/webhooks \
  -H "Authorization: Bearer {token}" \
  -d '{
    "url": "https://abc123.ngrok.io/webhooks/witylogix",
    "events": ["order.created"]
  }'
```

### Test Events

Use the test endpoint to send sample events:

```bash
curl -X POST https://api.witylogix.com/api/v4/webhooks/test \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "order.created",
    "webhookIds": ["webhook_550e8400e29b41d4a716446655440000"]
  }'
```

### Webhook Delivery Logs

Monitor webhook deliveries in the dashboard:

```bash
# List recent deliveries for endpoint
curl https://api.witylogix.com/api/v4/webhooks/{endpointId}/deliveries \
  -H "Authorization: Bearer {token}"
```

## Webhook Security

### Signature Verification

Always verify webhook signatures:

```typescript
import crypto from 'crypto';

function isValidWebhook(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}
```

### Best Practices

1. **Use HTTPS only** — Webhooks are only sent to HTTPS endpoints
2. **Verify signatures** — Always verify HMAC-SHA256 signatures
3. **Short timeouts** — Respond within 30 seconds
4. **Idempotent handlers** — Handle duplicate deliveries gracefully
5. **Log everything** — Record received events for debugging
6. **Process asynchronously** — Don't block the webhook response
7. **Monitor DLQ** — Alert on DLQ events

## Example Implementation

Complete Node.js webhook handler:

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();

// Middleware to capture raw body
app.use(express.raw({ type: 'application/json' }));

// Store for processed event IDs
const processedIds = new Set<string>();

app.post('/webhooks/witylogix', async (req, res) => {
  const signature = req.headers['x-witylogix-signature'] as string;
  const rawBody = req.body.toString();
  const secret = process.env.WITYLOGIX_SECRET!;

  // 1. Verify signature
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Parse event
  const event = JSON.parse(rawBody);

  // 3. Prevent duplicate processing
  if (processedIds.has(event.id)) {
    return res.status(200).json({ status: 'ok' });
  }

  try {
    // 4. Process event asynchronously
    setImmediate(() => handleEvent(event).catch(console.error));

    // 5. Return immediately
    res.status(200).json({ status: 'ok' });

    // 6. Mark as processed
    processedIds.add(event.id);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

async function handleEvent(event: any) {
  switch (event.type) {
    case 'order.created':
      await handleOrderCreated(event.data);
      break;
    case 'order.status_changed':
      await handleOrderStatusChanged(event.data);
      break;
    case 'delivery.completed':
      await handleDeliveryCompleted(event.data);
      break;
    // ... other event types
  }
}

async function handleOrderCreated(data: any) {
  console.log('New order:', data);
  // Update your database, send notification, etc.
}

async function handleOrderStatusChanged(data: any) {
  console.log('Order status updated:', data);
}

async function handleDeliveryCompleted(data: any) {
  console.log('Delivery completed:', data);
}

app.listen(3000, () => {
  console.log('Webhook server running on :3000');
});
```

## Troubleshooting

**Q: My webhook endpoint keeps getting 5xx errors?**
A: Ensure your endpoint is HTTPS, responds quickly (< 30 seconds), and returns 2xx status codes.

**Q: How do I retry events in the DLQ?**
A: Use `POST /api/v4/webhooks/dlq/{dlqEventId}/retry` endpoint.

**Q: Why am I receiving duplicate events?**
A: Webhooks are at-least-once delivery. Implement idempotency checking in your handler.

**Q: Can I rotate the webhook secret?**
A: Yes, request a secret rotation in account settings. New events use the new secret; old events are re-signed and delivered.

**Q: How do I test webhooks locally?**
A: Use ngrok to expose your localhost and register the ngrok URL as your webhook endpoint.
