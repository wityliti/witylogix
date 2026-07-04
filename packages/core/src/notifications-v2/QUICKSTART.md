# Notification Engine v2 — Quick Start Guide

## Installation

The notification engine is already integrated into the Witylogix platform. No additional installation needed.

## Basic Setup (5 minutes)

### 1. Import the Service

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

### 2. Send Your First Notification

```typescript
const result = await service.send({
  customerId: "cust_12345",
  eventType: "delivery_scheduled",
  data: {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerPhone: "+15551234567",
    deliveryDate: "2026-03-15",
    timeWindow: "2:00pm - 4:00pm",
    trackingUrl: "https://example.com/track/order123",
  },
});

console.log(result);
// [
//   { success: true, channel: 'email', notificationId: 'notif_xxx' },
//   { success: true, channel: 'sms', notificationId: 'notif_yyy' },
//   ...
// ]
```

## Common Tasks

### Check What Channels a Customer Uses

```typescript
import { PreferenceManager } from "@witylogix/core/notifications-v2";

const channels = PreferenceManager.getAvailableChannels(
  "cust_12345",
  "delivery_scheduled",
);
console.log(channels); // ['email', 'sms', 'whatsapp']
```

### Disable SMS for a Customer

```typescript
PreferenceManager.disableChannel("cust_12345", "sms");
```

### Get Customer Notification History

```typescript
const history = service.getHistory("cust_12345", 50);
history.forEach((record) => {
  console.log(`${record.eventType} via ${record.channel} at ${record.sentAt}`);
});
```

### Check Rate Limit Status

```typescript
const limiter = service.getRateLimiter();
const status = limiter.getStatus("cust_12345", "sms");

console.log(`${status.sentToday}/${status.limit} SMS sent today`);
console.log(`Reset at: ${status.resetAt}`);
```

### Shorten a Tracking URL

```typescript
const shortener = service.getUrlShortener();
const result = shortener.shortenUrl(
  "https://example.com/orders/very_long_tracking_id_123456789",
);

console.log(result.shortUrl); // https://track.witylogix.com/abc123
```

### Register a Webhook

```typescript
import { WebhookManager } from "@witylogix/core/notifications-v2";

const webhook = WebhookManager.registerWebhook(
  "https://myapp.com/webhooks/deliveries",
  ["delivery.scheduled", "delivery.delivered"],
);

console.log(webhook.id); // webhook_xxx
```

## Using the API

### Send Notification via HTTP

```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust_12345",
    "eventType": "delivery_scheduled",
    "data": {
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "customerPhone": "+15551234567",
      "deliveryDate": "2026-03-15",
      "timeWindow": "2:00pm - 4:00pm",
      "trackingUrl": "https://example.com/track/order123"
    }
  }'
```

### Get Preferences via HTTP

```bash
curl http://localhost:3000/api/notifications/cust_12345/preferences
```

### Update Preferences via HTTP

```bash
curl -X PUT http://localhost:3000/api/notifications/cust_12345/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "channels": {
      "sms": {
        "enabled": false
      }
    }
  }'
```

### Register Webhook via HTTP

```bash
curl -X POST http://localhost:3000/api/notifications/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://myapp.com/webhooks/deliveries",
    "events": ["delivery.scheduled", "delivery.delivered"]
  }'
```

## Event Types Cheat Sheet

| Event                | When             | Best Channels        |
| -------------------- | ---------------- | -------------------- |
| `order_confirmed`    | Order placed     | Email, SMS           |
| `delivery_scheduled` | Date assigned    | Email, SMS, WhatsApp |
| `out_for_delivery`   | Left warehouse   | Email, SMS, Push     |
| `delivery_arriving`  | 30 mins away     | SMS, Push            |
| `delivered`          | Dropped off      | Email, Push          |
| `delivery_failed`    | Couldn't deliver | Email, SMS, WhatsApp |
| `rescheduled`        | New date set     | Email, SMS, WhatsApp |

## Template Variables Cheat Sheet

```typescript
{
  {
    customerName;
  }
} // "John Doe"
{
  {
    orderId;
  }
} // "ORD-123456"
{
  {
    deliveryDate;
  }
} // "2026-03-15"
{
  {
    timeWindow;
  }
} // "2:00pm - 4:00pm"
{
  {
    deliveryAddress;
  }
} // "123 Main St, City, ST 12345"
{
  {
    driverName;
  }
} // "Bob Smith"
{
  {
    trackingUrl;
  }
} // "https://track.witylogix.com/abc123"
```

## Default Rate Limits

```
SMS:      10 messages per day per customer
WhatsApp: 5 messages per day per customer
Email:    Unlimited
Push:     Unlimited
```

## Troubleshooting

### Notification Not Sent

Check these in order:

1. **Is the channel enabled for this customer?**

   ```typescript
   PreferenceManager.getPreferences(customerId);
   ```

2. **Is the channel enabled for this event type?**

   ```typescript
   const prefs = PreferenceManager.getPreferences(customerId);
   console.log(prefs.channels.sms.eventTypes.delivery_scheduled); // true/false
   ```

3. **Did we hit the rate limit?**

   ```typescript
   const status = service.getRateLimiter().getStatus(customerId, "sms");
   console.log(status.canSend); // true/false
   ```

4. **Check the history**
   ```typescript
   service.getHistory(customerId, 1);
   // Look for error message
   ```

### SMS Message Too Long

SMS is limited to 160 characters. Use:

```typescript
import { SMSChannel } from "@witylogix/core/notifications-v2";

const message = "Your long message...";
const truncated = SMSChannel.truncateMessage(message, 160);
```

### WhatsApp Template Not Found

Use only approved templates:

- `order_confirmation`
- `delivery_scheduled`
- `out_for_delivery`
- `delivery_arriving`
- `delivered`
- `delivery_failed`
- `rescheduled`

### Phone Number Format Issues

Always use E.164 format: `+[country code][number]`

```typescript
import { SMSChannel } from "@witylogix/core/notifications-v2";

const formatted = SMSChannel.formatPhoneNumber(userPhone);
// "+15551234567"
```

## Performance Tips

1. **Batch sends** - Use `sendBulk()` for multiple notifications
2. **Respect rate limits** - Don't retry rate-limited sends immediately
3. **Cache preferences** - Get preferences once, not per notification
4. **Async webhooks** - Fire webhooks async, don't wait for response
5. **Short URLs** - Pre-generate for bulk sends

## Best Practices

1. **Always validate phone numbers** - Use E.164 format
2. **Use preferences** - Respect customer communication preferences
3. **Handle rate limits gracefully** - Show friendly error messages
4. **Monitor webhooks** - Log webhook deliveries
5. **Test templates** - Preview all channels before going live
6. **Clean up URLs** - Periodically remove expired short URLs
7. **Track results** - Log all notification sends for auditing

## Examples

### Complete Notification Workflow

```typescript
import {
  NotificationService,
  PreferenceManager,
  WebhookManager,
} from "@witylogix/core/notifications-v2";

// 1. Initialize
const service = new NotificationService(config);

// 2. Register webhook to track events
WebhookManager.registerWebhook("https://myapp.com/webhooks", [
  "delivery.scheduled",
  "delivery.delivered",
]);

// 3. Send notification
const results = await service.send({
  customerId: "cust_123",
  eventType: "delivery_scheduled",
  data: {
    customerName: "John",
    customerEmail: "john@example.com",
    customerPhone: "+15551234567",
    deliveryDate: "2026-03-15",
    timeWindow: "2pm-4pm",
    trackingUrl: "https://example.com/track/123",
  },
});

// 4. Check results
results.forEach((r) => {
  if (r.success) {
    console.log(`Sent via ${r.channel}: ${r.messageId}`);
  } else {
    console.log(`Failed via ${r.channel}: ${r.error}`);
  }
});

// 5. Get history
const history = service.getHistory("cust_123", 10);
console.log(`Customer has ${history.length} notifications`);

// 6. Update preferences
PreferenceManager.disableEventType("cust_123", "sms", "delivery_arriving");
```

## Next Steps

1. **Read the README** - Full feature documentation
2. **Check IMPLEMENTATION.md** - Architecture and design decisions
3. **Run tests** - `npm test -- notifications-v2`
4. **Explore API** - Use the REST endpoints
5. **Integrate with events** - Hook into delivery lifecycle events

## Support

- Check README.md for detailed API documentation
- Review **tests** for usage examples
- Check IMPLEMENTATION.md for design decisions
- Look at notification-service.ts for complete API

## Files

- **Core**: `notification-service.ts`
- **Templates**: `template-engine.ts`
- **Preferences**: `preference-manager.ts`
- **Channels**: `channels/*.ts`
- **API**: `/apps/api/src/routes/notifications-v2.ts`
- **Tests**: `__tests__/*.test.ts`
