# Notification Engine v2 — Implementation Guide

## Overview

This document provides comprehensive implementation details for the Customer Notification Engine v2, including architecture, design patterns, and production considerations.

## Module Structure

```
packages/core/src/notifications-v2/
├── types.ts                        # Type definitions
├── template-engine.ts              # Template rendering
├── preference-manager.ts           # Customer preferences
├── rate-limiter.ts                 # Rate limiting
├── url-shortener.ts                # URL shortening
├── webhook-delivery.ts             # Outbound webhooks
├── notification-service.ts         # Main orchestration
├── channels/
│   ├── index.ts
│   ├── email-channel.ts            # Email sending
│   ├── sms-channel.ts              # SMS sending (Twilio)
│   ├── whatsapp-channel.ts         # WhatsApp (Meta API)
│   └── push-channel.ts             # Web Push
├── __tests__/
│   ├── notification-service.test.ts
│   └── template-engine.test.ts
├── index.ts                        # Exports
├── README.md
└── IMPLEMENTATION.md

apps/api/src/routes/
└── notifications-v2.ts             # API endpoints
```

## Core Components

### 1. NotificationService

**Responsibility**: Main orchestration service that coordinates all components.

**Key Methods**:

- `send(request)` - Send single notification
- `sendBulk(requests)` - Send multiple notifications
- `getHistory(customerId, limit)` - Retrieve notification history
- `getDeliveryStatus(notificationId)` - Get delivery status

**Flow**:

```
send() {
  1. Validate request
  2. Determine channels (explicit or from preferences)
  3. Shorten tracking URLs
  4. For each channel:
    a. Check rate limits
    b. Check preferences
    c. Render template
    d. Send via channel
    e. Record in history
    f. Fire webhooks
  5. Return results
}
```

### 2. TemplateEngine

**Responsibility**: Render channel-specific templates with variable interpolation.

**Design**:

- Static template definitions per event type
- Per-channel variants (HTML for email, text for SMS, etc.)
- Simple variable interpolation with `{{variable}}` syntax
- Graceful handling of missing variables

**Template Structure**:

```typescript
TEMPLATES: {
  event_type: {
    email: { subject, html, text },
    sms: { text },
    whatsapp: { templateId, templateName },
    push: { title, body }
  }
}
```

**Variable Interpolation**:

- Email: Full HTML + plain text
- SMS: Plain text with length limit
- WhatsApp: Template parameters array
- Push: Title and body text

### 3. PreferenceManager

**Responsibility**: Manage customer notification preferences.

**Design**:

- Per-customer preferences storage
- Per-channel enable/disable
- Per-event-type granular control
- Default preferences for new customers

**Default Preferences**:

```
Email:    All events enabled
SMS:      All except delivery_arriving, delivered
WhatsApp: Key events only
Push:     Real-time events (out for delivery, arriving, etc.)
```

**Storage**: In-memory Map (production: Prisma)

### 4. RateLimiter

**Responsibility**: Prevent notification abuse.

**Design**:

- Per-customer, per-channel rate limits
- 24-hour rolling window
- Configurable limits
- Automatic window reset

**Default Limits**:

```
SMS:      10 messages/day
WhatsApp: 5 messages/day
Email:    Unlimited
Push:     Unlimited
```

**Storage**: In-memory Map with expiry (production: Redis)

### 5. UrlShortener

**Responsibility**: Generate tracking short URLs.

**Design**:

- In-memory URL mapping
- 90-day expiration
- Click tracking
- Deduplication (reuse if URL already shortened)

**Flow**:

```
shortenUrl(originalUrl) {
  1. Validate URL format
  2. Check if already shortened (within expiration)
  3. Generate unique short code
  4. Create mapping
  5. Return shortUrl
}
```

### 6. WebhookManager

**Responsibility**: Manage outbound webhooks for delivery events.

**Design**:

- Register/unregister webhooks
- Event filtering per webhook
- HMAC signature generation
- Retry handling (future)

**Webhook Events**:

- `delivery.scheduled`
- `delivery.out_for_delivery`
- `delivery.delivered`
- `delivery.failed`

**Signature Verification**:

```typescript
header: X-Webhook-Signature: sha256=<hmac>

verifySignature(payload, signature, secret) {
  return timingSafeEqual(
    signature,
    sha256(secret, payload)
  )
}
```

### 7. Channels

#### EmailChannel

- Nodemailer/SES integration
- HTML + plain text
- Branded templates with Witylogix logo
- Attachment support

#### SMSChannel

- Twilio integration
- 160 character limit (auto-split)
- E.164 phone formatting
- Routific-pattern messages

#### WhatsAppChannel

- Meta Business Cloud API
- Approved templates only
- Template parameters
- Media support (map, driver photo)

#### PushChannel

- Web Push protocol
- VAPID key management
- Interactive actions
- Browser subscription handling

## Data Models

### NotificationRequest

```typescript
{
  customerId: string;
  eventType: NotificationEventType;
  channels?: NotificationChannel[];
  data: {
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    deliveryDate?: string;
    timeWindow?: string;
    trackingUrl?: string;
    driverName?: string;
    deliveryAddress?: string;
    [key: string]: string | undefined;
  };
}
```

### SendResult

```typescript
{
  success: boolean;
  notificationId: string;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
  timestamp: Date;
}
```

### NotificationRecord (History)

```typescript
{
  id: string;
  customerId: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  messageId?: string;
  status: 'sent' | 'failed' | 'pending';
  error?: string;
  sentAt: Date;
}
```

## API Design

### RESTful Endpoints

```
POST   /api/notifications/send
POST   /api/notifications/send-bulk
GET    /api/notifications/:customerId/history
GET    /api/notifications/:customerId/preferences
PUT    /api/notifications/:customerId/preferences
GET    /api/notifications/:customerId/rate-limit/:channel
POST   /api/notifications/webhooks
GET    /api/notifications/webhooks
GET    /api/notifications/webhooks/:id
PUT    /api/notifications/webhooks/:id
DELETE /api/notifications/webhooks/:id
POST   /api/notifications/shorten-url
GET    /api/notifications/url-stats/:code
GET    /api/notifications/templates
GET    /api/notifications/templates/:eventType
```

### Response Format

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  details?: any[];
  timestamp: ISO8601;
}
```

## Error Handling

### Validation Errors

- 400 Bad Request
- Zod validation errors returned

### Not Found Errors

- 404 Not Found
- Resource not found

### Server Errors

- 500 Internal Server Error
- Error message returned

### Channel-Level Errors

- Returned in SendResult
- Not thrown (graceful degradation)
- Multiple channels can fail independently

## Rate Limiting Strategy

### Implementation

```typescript
Key: `${customerId}:${channel}`
Entry: {
  customerId,
  channel,
  count: number,
  resetAt: Date
}

canSend() {
  - Check if window expired
  - Reset if needed
  - Check count < limit
  - Return boolean
}

recordSend() {
  - Increment count
  - Keep track of resetAt
}
```

### Configuration

```typescript
{
  maxSmsPerDay: 10,
  maxWhatsAppPerDay: 5,
  windowMs: 86400000 // 24 hours
}
```

## Webhook Flow

### Outbound Webhook

```
Event Occurs (delivery scheduled)
    ↓
WebhookManager.fireWebhooks()
    ↓
For each registered webhook:
  - Check if subscribed to event
  - Build payload
  - Generate HMAC signature
  - POST to webhook URL
  - Handle response
```

### Webhook Payload

```typescript
{
  event: WebhookEventType,
  timestamp: ISO8601,
  data: {
    customerId: string,
    eventType: NotificationEventType,
    channel: NotificationChannel,
    notificationId: string,
    [additional data]
  }
}
```

### Signature Header

```
X-Webhook-Signature: sha256=<hmac-hex>
X-Webhook-Event: delivery.scheduled
X-Webhook-ID: webhook_123
```

## URL Shortening Logic

### Code Generation

```typescript
- Length: 8 characters
- Charset: hex (0-9, a-f)
- Uniqueness: Checked against existing
- Max attempts: 10
```

### Storage

```typescript
code -> {
  code,
  originalUrl,
  shortUrl,
  createdAt,
  expiresAt,
  clicks
}
```

### Expiration

- Default: 90 days
- Automatic cleanup on access
- Periodic cleanup task (future)

## Testing Strategy

### Unit Tests

- Template engine rendering
- Variable interpolation
- Rate limiting logic
- Preference management
- URL shortening

### Integration Tests

- Complete notification workflow
- Multi-channel sending
- Preference respect
- Rate limit enforcement
- History tracking

### Test Coverage

- Happy path scenarios
- Error cases
- Edge cases (missing variables, invalid inputs)
- Concurrent operations

## Production Deployment

### Database Migration

```typescript
// Replace in-memory Maps with Prisma

// NotificationRecord
model NotificationRecord {
  id String @id
  customerId String
  eventType String
  channel String
  messageId String?
  status String
  error String?
  sentAt DateTime
  createdAt DateTime @default(now())
}

// NotificationPreference
model NotificationPreference {
  id String @id
  customerId String
  channels Json // {email: {...}, sms: {...}, ...}
  updatedAt DateTime
}

// ShortenedUrl
model ShortenedUrl {
  code String @id
  originalUrl String
  shortUrl String
  createdAt DateTime
  expiresAt DateTime
  clicks Int @default(0)
}

// Webhook
model Webhook {
  id String @id
  url String
  events String[] // array of event types
  secret String
  active Boolean
  createdAt DateTime
  updatedAt DateTime
}
```

### Provider Integration

```typescript
// Email: SendGrid
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
await sgMail.send(emailContent);

// SMS: Twilio
const twilio = require("twilio");
const client = twilio(accountSid, authToken);
await client.messages.create({
  body,
  from: process.env.SMS_FROM,
  to,
});

// WhatsApp: Meta
const response = await fetch(
  `https://graph.instagram.com/v18.0/${phoneNumberId}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  },
);

// Push: web-push
import webpush from "web-push";
webpush.setVapidDetails(subject, publicKey, privateKey);
await webpush.sendNotification(subscription, payload);
```

### Distributed Rate Limiting

```typescript
// Redis backend
import Redis from "ioredis";

class RedisRateLimiter {
  async canSend(customerId, channel) {
    const key = `ratelimit:${customerId}:${channel}`;
    const count = await redis.get(key);
    return parseInt(count || 0) < limit;
  }

  async recordSend(customerId, channel) {
    const key = `ratelimit:${customerId}:${channel}`;
    await redis.incr(key);
    await redis.expire(key, 86400); // 24 hours
  }
}
```

### Message Queue

```typescript
// Redis-based job queue
import Bull from "bull";

const notificationQueue = new Bull("notifications");

notificationQueue.process(async (job) => {
  const result = await service.send(job.data);
  return result;
});

// Enqueue
notificationQueue.add(notificationRequest, {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
});
```

### Monitoring

```typescript
// Prometheus metrics
-notifications_sent_total -
  notifications_failed_total -
  notifications_by_channel -
  rate_limit_exceeded_total -
  webhook_deliveries_total -
  webhook_delivery_failures_total -
  url_shortener_clicks_total;
```

## Performance Considerations

### Optimization Strategies

1. **Caching**: Cache customer preferences (5-min TTL)
2. **Batching**: Send SMS/WhatsApp in batches
3. **Async**: Non-blocking webhook firing
4. **Pagination**: History queries
5. **Indexing**: Database indexes on customerId, sentAt

### Scalability

- **Horizontal**: Stateless service, load balanced
- **Database**: Connection pooling
- **Queue**: Distributed job queue for sending
- **Rate Limits**: Redis for distributed state
- **Storage**: CloudFront for short URL resolution

## Security Considerations

1. **Input Validation**: Zod for all API inputs
2. **Signature Verification**: HMAC for webhooks
3. **Phone Number Validation**: E.164 format
4. **URL Validation**: Whitelist domains
5. **API Authentication**: JWT or API keys (future)
6. **Encryption**: TLS for all external APIs
7. **Secrets Management**: Environment variables
8. **Rate Limiting**: HTTP rate limits on API

## Compliance

1. **GDPR**: Preference system, history retention
2. **CAN-SPAM**: Unsubscribe links, proper headers
3. **TCPA**: SMS opt-in verification
4. **GDPR**: Data retention policies
5. **Audit Logging**: Track all sends (future)

## Maintenance

### Monitoring Checklist

- [ ] Webhook delivery success rate
- [ ] Average send latency
- [ ] Rate limit hit frequency
- [ ] Database storage growth
- [ ] URL shortener performance

### Regular Tasks

- [ ] Clean up expired shortened URLs
- [ ] Archive old notification history
- [ ] Review webhook failure logs
- [ ] Update templates
- [ ] Monitor provider API changes

## Migration Path

### Phase 1: MVP (Current)

- In-memory storage
- Mock implementations
- API ready for testing

### Phase 2: Production

- Database persistence
- Real provider integrations
- Distributed rate limiting

### Phase 3: Advanced

- Message queue
- Analytics
- A/B testing
- Multi-language

### Phase 4: Scale

- Global provider coverage
- Advanced analytics
- Customer segmentation
- ML-driven optimization
