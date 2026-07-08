# Notification Engine v2

Multi-channel notification system for the Witylogix last-mile delivery platform with support for Email, SMS, WhatsApp, and Push notifications.

## Features

- **Multi-Channel Support**: Email, SMS, WhatsApp, Web Push
- **Template Engine**: Per-channel templates with variable interpolation
- **Rate Limiting**: Prevent notification abuse with configurable limits
- **Customer Preferences**: Control which notifications to receive per channel
- **URL Shortening**: Internal tracking URL shortener for SMS/WhatsApp
- **Outbound Webhooks**: Notify external systems of delivery events
- **In-Memory History**: Track sent notifications per customer
- **Retry Logic**: Exponential backoff for failed sends (future)

## Architecture

```
NotificationService
├── TemplateEngine
│   └── Renders templates for each channel
├── PreferenceManager
│   └── Manages customer notification preferences
├── EmailChannel (Nodemailer/SES)
├── SMSChannel (Twilio)
├── WhatsAppChannel (Meta Business API)
├── PushChannel (Web Push/Firebase)
├── RateLimiter
│   └── Enforces per-customer, per-channel limits
├── UrlShortener
│   └── Generates short tracking URLs
└── WebhookManager
    └── Manages outbound webhooks for events
```

## Usage

### Initialize Service

```typescript
import { NotificationService } from "@witylogix/core/notifications-v2";

const service = new NotificationService({
  rateLimitConfig: {
    maxSmsPerDay: 10,
    maxWhatsAppPerDay: 5,
    windowMs: 24 * 60 * 60 * 1000,
  },
  retryOptions: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  emailFrom: "noreply@witylogix.com",
  smsSender: "+1234567890",
  trackingBaseUrl: "https://track.witylogix.com",
});
```

### Send Single Notification

```typescript
const results = await service.send({
  customerId: "cust_123",
  eventType: "delivery_scheduled",
  // Optional: specify channels (defaults to customer preferences)
  channels: ["email", "sms"],
  data: {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerPhone: "+15551234567",
    deliveryDate: "2026-03-15",
    timeWindow: "2:00pm - 4:00pm",
    trackingUrl: "https://example.com/track/order123",
  },
});

// results[0].success -> true/false
// results[0].notificationId -> unique ID
// results[0].channel -> 'email' | 'sms' | 'whatsapp' | 'push'
```

### Send Bulk Notifications

```typescript
const notifications = [
  { customerId: 'cust_1', eventType: 'order_confirmed', data: {...} },
  { customerId: 'cust_2', eventType: 'delivery_scheduled', data: {...} },
];

const allResults = await service.sendBulk(notifications);
```

### Manage Preferences

```typescript
import { PreferenceManager } from "@witylogix/core/notifications-v2";

// Get customer preferences
const prefs = PreferenceManager.getPreferences("cust_123");

// Disable SMS channel
PreferenceManager.disableChannel("cust_123", "sms");

// Disable specific event type for channel
PreferenceManager.disableEventType("cust_123", "whatsapp", "delivery_arriving");

// Get available channels for event
const channels = PreferenceManager.getAvailableChannels(
  "cust_123",
  "delivery_scheduled",
);
```

### Rate Limiting

```typescript
const limiter = service.getRateLimiter();

// Check if can send
const canSend = limiter.canSend("cust_123", "sms");

// Get status
const status = limiter.getStatus("cust_123", "sms");
console.log(status.sentToday); // 3
console.log(status.limit); // 10
console.log(status.resetAt); // Date

// Reset limits
limiter.reset("cust_123", "sms");
```

### URL Shortening

```typescript
const shortener = service.getUrlShortener();

// Shorten a URL
const result = shortener.shortenUrl(
  "https://example.com/track/verylongid123456",
);
// result.shortUrl -> 'https://track.witylogix.com/abc123'

// Get stats
const stats = shortener.getStats("abc123");
console.log(stats.clicks); // 5
```

### Webhooks

```typescript
import { WebhookManager } from "@witylogix/core/notifications-v2";

// Register webhook
const webhook = WebhookManager.registerWebhook(
  "https://myapp.com/webhooks/deliveries",
  ["delivery.scheduled", "delivery.delivered"],
);

// List webhooks
const webhooks = WebhookManager.listWebhooks();

// Fire webhook
const result = await WebhookManager.fireWebhook(webhook, "delivery.scheduled", {
  customerId: "cust_123",
  deliveryDate: "2026-03-15",
});

// Update webhook
WebhookManager.updateWebhook(webhook.id, {
  active: false,
});

// Delete webhook
WebhookManager.deleteWebhook(webhook.id);
```

## Templates

### Supported Event Types

- `order_confirmed` - Order has been confirmed
- `delivery_scheduled` - Delivery date/time assigned
- `out_for_delivery` - Package is out for delivery
- `delivery_arriving` - Delivery arriving soon
- `delivered` - Package delivered
- `delivery_failed` - Delivery failed
- `rescheduled` - Delivery rescheduled

### Template Variables

Common variables available in templates:

- `{{customerName}}` - Customer's name
- `{{orderId}}` - Order ID
- `{{deliveryDate}}` - Delivery date
- `{{timeWindow}}` - Delivery time window
- `{{deliveryAddress}}` - Delivery address
- `{{driverName}}` - Driver's name
- `{{trackingUrl}}` - Tracking URL
- Custom variables via data object

### Per-Channel Formats

**Email**: HTML + Plain text with subject
**SMS**: Plain text (max 160 chars, auto-split for concatenation)
**WhatsApp**: Meta-approved templates with parameters
**Push**: Title + body with optional actions

## Rate Limits

Default limits per customer per day:

- **SMS**: 10 messages/day
- **WhatsApp**: 5 messages/day
- **Email**: Unlimited
- **Push**: Unlimited

Configure via `NotificationServiceConfig`:

```typescript
const config = {
  rateLimitConfig: {
    maxSmsPerDay: 20, // Custom limit
    maxWhatsAppPerDay: 10,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
  },
};
```

## API Routes

### Send Notification

```
POST /api/notifications/send
Content-Type: application/json

{
  "customerId": "cust_123",
  "eventType": "delivery_scheduled",
  "channels": ["email", "sms"],
  "data": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "+15551234567",
    "deliveryDate": "2026-03-15",
    "timeWindow": "2:00pm - 4:00pm",
    "trackingUrl": "https://example.com/track/123"
  }
}

Response:
{
  "success": true,
  "data": [
    {
      "success": true,
      "notificationId": "notif_xxx",
      "channel": "email",
      "messageId": "email_xxx",
      "timestamp": "2026-03-11T..."
    },
    ...
  ]
}
```

### Get Preferences

```
GET /api/notifications/:customerId/preferences

Response:
{
  "success": true,
  "data": {
    "customerId": "cust_123",
    "channels": {
      "email": {
        "enabled": true,
        "eventTypes": {
          "order_confirmed": true,
          "delivery_scheduled": true,
          ...
        }
      },
      ...
    }
  }
}
```

### Update Preferences

```
PUT /api/notifications/:customerId/preferences
Content-Type: application/json

{
  "channels": {
    "sms": {
      "enabled": false
    },
    "push": {
      "eventTypes": {
        "out_for_delivery": true,
        "delivery_arriving": false
      }
    }
  }
}
```

### Get Notification History

```
GET /api/notifications/:customerId/history?limit=50

Response:
{
  "success": true,
  "data": [
    {
      "id": "notif_xxx",
      "customerId": "cust_123",
      "eventType": "delivery_scheduled",
      "channel": "email",
      "status": "sent",
      "sentAt": "2026-03-11T..."
    },
    ...
  ]
}
```

### Register Webhook

```
POST /api/notifications/webhooks
Content-Type: application/json

{
  "url": "https://myapp.com/webhooks/deliveries",
  "events": ["delivery.scheduled", "delivery.delivered"],
  "secret": "optional_secret"
}

Response:
{
  "success": true,
  "data": {
    "id": "webhook_xxx",
    "url": "https://myapp.com/webhooks/deliveries",
    "events": ["delivery.scheduled", "delivery.delivered"],
    "active": true,
    "createdAt": "2026-03-11T..."
  }
}
```

## Testing

```bash
npm run test -- packages/core/src/notifications-v2/__tests__
```

Tests cover:

- Template rendering for all event types and channels
- Variable interpolation
- Rate limiting enforcement
- Preference management
- Notification sending
- History tracking

## Environment Variables

```env
# Email
NOTIFICATION_EMAIL_FROM=noreply@witylogix.com

# SMS
SMS_SENDER=+1234567890

# Tracking
TRACKING_BASE_URL=https://track.witylogix.com

# Web Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Providers
SENDGRID_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
META_PHONE_NUMBER_ID=...
META_ACCESS_TOKEN=...
```

## Implementation Notes

### Current State (MVP)

- In-memory storage for history, preferences, rate limits, URLs, webhooks
- Mock implementations for actual sending (logs to console)
- No database persistence
- Single instance only

### Production Readiness

To make production-ready:

1. **Database**: Move from in-memory to persistent storage (Prisma)
2. **Actual Sending**: Implement real integrations
   - Email: SendGrid or AWS SES
   - SMS: Twilio integration
   - WhatsApp: Meta Cloud API integration
   - Push: Web-push library with VAPID
3. **Retry Queue**: Redis-based job queue
4. **Monitoring**: Add logging, metrics, error tracking
5. **Authentication**: Protect API endpoints
6. **Rate Limit Storage**: Redis for distributed rate limiting

## Architecture Decisions

### Why Template Engine?

- Single source of truth for all channel messages
- Easy to maintain consistency across channels
- Simple variable interpolation
- Can be extended with more complex logic if needed

### Why Separate Channels?

- Each channel has unique constraints and APIs
- SMS character limits, WhatsApp templates, email HTML
- Easy to swap implementations per provider
- Testable in isolation

### Why Preferences Manager?

- Customer control over notifications
- Regulatory compliance (GDPR, CAN-SPAM)
- Better engagement with targeted notifications

### Why Rate Limiting?

- Prevent SMS/WhatsApp abuse
- Cost control (SMS is per-message)
- Better user experience

## Future Enhancements

- [ ] Database persistence
- [ ] Real provider integrations
- [ ] Scheduled notifications
- [ ] A/B testing for templates
- [ ] Multi-language support
- [ ] Rich media attachments
- [ ] Delivery receipts tracking
- [ ] Customer feedback loops
- [ ] Analytics dashboard
