# Messaging Integration Guide

Messaging integrations enable multi-channel notifications: SMS, email, push notifications, and chat. Witylogix supports 12 messaging providers for shipment tracking, delivery alerts, and customer communications.

## Supported Messaging Providers

| Provider          | Channels             | Best For              | Cost              |
| ----------------- | -------------------- | --------------------- | ----------------- |
| **Twilio**        | SMS, Voice, WhatsApp | Global scale          | $0.01-0.05/msg    |
| **SendGrid**      | Email                | Transactional email   | $0.10/1000        |
| **Firebase FCM**  | Push, Notification   | Mobile apps           | Free, then $0.50+ |
| **OneSignal**     | Multi-channel        | Push + email          | $99-499/mo        |
| **Vonage**        | SMS, Voice           | Alternative to Twilio | Similar           |
| **Meta WhatsApp** | WhatsApp             | Customer messaging    | $0.01-0.05/msg    |
| **Mailgun**       | Email                | Developer-friendly    | $0.50-1.50/1000   |
| **AWS SNS**       | SMS, Email, Push     | AWS ecosystem         | Variable          |
| **Slack API**     | Chat                 | Team notifications    | Free-$12.50/user  |
| **Telegram**      | Chat                 | Bot notifications     | Free              |
| **Resend**        | Email                | Modern email API      | $0.00-20/1000     |
| **Pushbullet**    | Push                 | Simple notifications  | $0.10/1000        |

## Use Cases

### 1. Shipment Creation

Notify customer when order ships:

```javascript
await client.messaging.send({
  integration: "twilio",
  channel: "sms",
  to: customer.phone,
  template: "shipment_created",
  data: {
    orderId: shipment.orderId,
    trackingUrl: shipment.trackingUrl,
    estimatedDelivery: shipment.estimatedDelivery,
  },
});
```

### 2. Delivery Updates

Real-time delivery status updates:

```javascript
// Driver 5 minutes away
await client.messaging.send({
  integration: "twilio",
  channel: "sms",
  to: customer.phone,
  template: "driver_arriving_soon",
  data: {
    driverName: driver.name,
    eta: "5 minutes",
    driverPhoto: driver.photo,
  },
});
```

### 3. Proof of Delivery

Delivery confirmation with POD:

```javascript
await client.messaging.send({
  integration: "sendgrid",
  channel: "email",
  to: customer.email,
  template: "delivery_confirmed",
  data: {
    signature: shipment.signature,
    photo: shipment.proofOfDelivery,
    timestamp: shipment.completedAt,
    trackingUrl: shipment.trackingUrl,
  },
});
```

### 4. Failed Delivery

Alert customer of delivery issues:

```javascript
await client.messaging.send({
  integration: "twilio",
  channel: "sms",
  to: customer.phone,
  template: "delivery_failed",
  data: {
    reason: shipment.failureReason,
    retryDate: shipment.nextAttemptDate,
    supportUrl: "https://support.company.com",
  },
});
```

## Setup by Provider

### Twilio

**Best for**: SMS, voice, WhatsApp at scale.

#### 1. Get API Credentials

- Twilio Console → Project Info
- Copy Account SID & Auth Token
- Create phone numbers for sending

#### 2. Configure in Witylogix

```javascript
const messaging = await client.integrations.create({
  provider: "twilio",
  credentials: {
    accountSid: "YOUR_ACCOUNT_SID",
    authToken: "YOUR_AUTH_TOKEN",
  },
  config: {
    defaultSender: "+1234567890", // Your Twilio phone
    smsLength: 160,
    channels: {
      sms: true,
      voice: true,
      whatsapp: true,
    },
  },
});
```

#### 3. Send Message

```javascript
const message = await client.messaging.send({
  integration: "twilio",
  channel: "sms",
  to: "+15551234567",
  body: "Your delivery is on its way! Track here: https://track.company.com/123",
});
```

### SendGrid

**Best for**: Transactional and marketing email.

#### 1. Get API Key

- SendGrid Settings → API Keys
- Create new API key with restricted permissions
- Copy the key (shown only once)

#### 2. Configure in Witylogix

```javascript
const messaging = await client.integrations.create({
  provider: "sendgrid",
  credentials: {
    apiKey: "YOUR_SENDGRID_API_KEY",
  },
  config: {
    fromEmail: "noreply@company.com",
    fromName: "Delivery Company",
    trackingEnabled: true,
    unsubscribeGroupId: 12345,
  },
});
```

#### 3. Send Email

```javascript
const email = await client.messaging.send({
  integration: "sendgrid",
  channel: "email",
  to: "customer@example.com",
  subject: "Your delivery has been completed",
  htmlContent: "<h1>Delivery Complete</h1>...",
  templateId: "d-abc123def456", // SendGrid template ID
  dynamicTemplateData: {
    trackingUrl: "https://track.company.com/123",
    signature: "John Doe",
  },
});
```

### Firebase Cloud Messaging

**Best for**: Mobile app push notifications.

#### 1. Setup Firebase Project

- Firebase Console → Create/select project
- Project Settings → Service Accounts
- Generate new private key (JSON)

#### 2. Configure in Witylogix

```javascript
const messaging = await client.integrations.create({
  provider: "firebase",
  credentials: {
    projectId: "YOUR_PROJECT_ID",
    privateKey: "YOUR_PRIVATE_KEY",
    clientEmail: "YOUR_CLIENT_EMAIL",
  },
  config: {
    defaultChannelId: "default",
    senderId: "YOUR_SENDER_ID",
  },
});
```

#### 3. Send Push Notification

```javascript
const notification = await client.messaging.send({
  integration: "firebase",
  channel: "push",
  deviceToken: "customer_device_token",
  title: "Your delivery is arriving",
  body: "Driver is 5 minutes away",
  data: {
    trackingUrl: "https://track.company.com/123",
    orderId: "ORDER-123",
  },
  android: {
    priority: "high",
  },
  apns: {
    headers: {
      "apns-priority": "10",
    },
  },
});
```

### OneSignal

**Best for**: Multi-channel campaigns.

#### 1. Get API Credentials

- OneSignal Dashboard → Settings
- Copy App ID & REST API Key

#### 2. Configure in Witylogix

```javascript
const messaging = await client.integrations.create({
  provider: "onesignal",
  credentials: {
    appId: "YOUR_APP_ID",
    apiKey: "YOUR_REST_API_KEY",
  },
  config: {
    channels: ["email", "push", "sms"],
  },
});
```

### Vonage (formerly Nexmo)

**Similar to Twilio:**

```javascript
const messaging = await client.integrations.create({
  provider: "vonage",
  credentials: {
    apiKey: "YOUR_API_KEY",
    apiSecret: "YOUR_API_SECRET",
  },
  config: {
    defaultSender: "Delivery Co",
  },
});
```

### Slack API

**Best for**: Internal team notifications.

#### 1. Create Slack App

- api.slack.com → Create New App
- Copy Bot Token (starts with xoxb-)

#### 2. Configure in Witylogix

```javascript
const messaging = await client.integrations.create({
  provider: "slack",
  credentials: {
    botToken: "xoxb-YOUR_BOT_TOKEN",
  },
  config: {
    defaultChannel: "#deliveries",
    threadReplies: true,
  },
});
```

#### 3. Send Notification

```javascript
const notification = await client.messaging.send({
  integration: "slack",
  channel: "chat",
  target: "#deliveries",
  text: "Order #123 delivered successfully",
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Delivery Complete*\nOrder: #123\nTime: 2:45 PM",
      },
    },
  ],
});
```

### Telegram Bot API

**Best for**: Lightweight notifications.

#### 1. Create Telegram Bot

- Message @BotFather on Telegram
- Create new bot
- Copy API Token

#### 2. Configure in Witylogix

```javascript
const messaging = await client.integrations.create({
  provider: "telegram",
  credentials: {
    botToken: "123456789:ABCDEFGHIJKLmnopqrstuvwxyz",
  },
  config: {
    parseMode: "HTML",
  },
});
```

#### 3. Send Message

```javascript
const message = await client.messaging.send({
  integration: "telegram",
  channel: "chat",
  chatId: "123456789",
  text: "<b>Delivery Complete</b>\nOrder #123 delivered at 2:45 PM",
});
```

## Message Templates

### Shipment Created

```mustache
Hi {{customerName}},

Your order #{{orderId}} has been dispatched!

📍 Tracking: {{trackingUrl}}
📦 Items: {{itemCount}}
🕐 Estimated Delivery: {{estimatedDelivery}}

Questions? Reply to this message.

{{companyName}}
```

### Driver Arriving Soon

```mustache
{{customerName}}, {{driverName}} is {{eta}} away!

🚗 Driver: {{driverName}}
📍 Location: {{driverLocation}}
📞 Contact: {{driverPhone}}

Open {{trackingUrl}} to see live tracking.
```

### Delivery Confirmed

```html
<h2>Delivery Complete ✓</h2>
<p>
  Your order #{{orderId}} was delivered on {{deliveryDate}} at {{deliveryTime}}.
</p>

<p><strong>Proof of Delivery:</strong></p>
<img src="{{podImage}}" alt="Signature" style="max-width: 300px;" />

<p><a href="{{trackingUrl}}">View Full Details</a></p>
```

### Delivery Failed

```mustache
Hi {{customerName}},

We had trouble delivering order #{{orderId}}.

❌ Reason: {{reason}}
📅 Next Attempt: {{retryDate}}

Need help? Contact support: {{supportUrl}}
```

## Scheduling & Timing

### Optimal Send Times

```javascript
const sendTiming = {
  shipmentCreated: {
    channel: "sms",
    delay: 0, // Immediate
    priority: "high",
  },
  driverArriving: {
    channel: "sms",
    delay: 0, // Immediate (real-time)
    priority: "high",
  },
  deliveryConfirmed: {
    channel: "email",
    delay: 300000, // 5 min (allows POD processing)
    priority: "normal",
  },
  followUp: {
    channel: "email",
    delay: 86400000, // 24 hours
    priority: "low",
  },
};
```

## Frequency Capping

Prevent over-messaging customers:

```javascript
const frequencyCaps = {
  sms: {
    perDay: 3, // Max 3 SMS per day per customer
    perWeek: 10,
  },
  email: {
    perDay: 5, // Max 5 emails per day
    perWeek: 20,
  },
  push: {
    perDay: 10, // Max 10 push notifications
    perHour: 2,
  },
};

// Apply caps
await client.messaging.setSendLimits({
  integration: "firebase",
  limits: frequencyCaps,
});
```

## Opt-in Management

```javascript
// Check if customer opted in
const preference = await client.messaging.getPreference({
  customerId: customer.id,
  channel: "sms",
});

if (preference.optedIn && !preference.unsubscribed) {
  await client.messaging.send({...});
}

// Handle unsubscribe
app.post("/webhooks/unsubscribe", (req, res) => {
  const { customerId, channel } = req.body;

  await client.messaging.setPreference({
    customerId,
    channel,
    optedIn: false,
  });

  res.json({ unsubscribed: true });
});
```

## Error Handling

```javascript
// Catch delivery failures
const result = await client.messaging.send({
  integration: "twilio",
  to: "+15551234567",
  body: "Delivery update",
}).catch(error => {
  if (error.code === "INVALID_NUMBER") {
    // Mark phone invalid in customer record
    await client.customers.update(customerId, {
      phone: null,
      phoneInvalid: true,
    });
  } else if (error.code === "QUOTA_EXCEEDED") {
    // Queue for later retry
    await queueMessage({...});
  } else {
    throw error; // Re-throw unexpected errors
  }
});
```

## Monitoring

```javascript
const stats = await client.messaging.stats({
  integration: "twilio",
  period: "day",
});

// {
//   totalSent: 1245,
//   successful: 1223,
//   failed: 22,
//   bounced: 0,
//   errorRate: 1.8%,
//   avgLatency: 250, // ms
// }
```

## Best Practices

1. **Use appropriate channel for urgency**
   - Critical alerts: SMS
   - Updates: Email or push
   - Follow-up: Email

2. **Include tracking URLs**
   - Every notification should link to tracking
   - Use short URLs to save SMS characters

3. **Personalize messages**
   - Use customer name
   - Reference order number
   - Include driver info when relevant

4. **Respect quiet hours**
   - Don't send SMS after 9 PM
   - Consider customer timezone
   - Allow preferences for timing

5. **Handle bounces**
   - Mark invalid phone/email
   - Remove from lists
   - Request updated contact info

## Troubleshooting

| Issue               | Cause                     | Solution              |
| ------------------- | ------------------------- | --------------------- |
| Messages not sent   | Invalid credentials       | Verify API key/token  |
| High bounce rate    | Bad phone/email data      | Clean customer data   |
| Rate limited        | Too many messages         | Implement queuing     |
| Messages delayed    | Provider overload         | Add retry logic       |
| Opt-out not working | Unsubscribe not processed | Sync unsubscribe list |

## Next Steps

- [Configure integrations](/docs/integrations/OVERVIEW)
- [Setup CRM](/docs/integrations/guides/crm)
- [View all integrations](/docs/integrations/catalog)
