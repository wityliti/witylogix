# ADR-012: Notification Provider Architecture

**Status:** Proposed
**Date:** 2026-03-08
**Deciders:** Arjun (CTO)
**Supersedes:** None
**Relates to:** ADR-010 (Event Bus Architecture), ADR-009 (Medusa-Inspired Architecture), ADR-001 (Platform Rewrite Stack)

---

## Executive Summary

Witylogix is implementing a **multi-provider notification system** with **Bring Your Own Keys (BYOK)** pattern for multi-tenant isolation. This decision enables:

1. **Provider Agnosticism** — Swap SendGrid for Mailgun without code changes; support 13+ providers across 4 channels
2. **Tenant Credential Isolation** — Each tenant stores their own API keys; fallback to deployer defaults if not configured
3. **Channel Independence** — Email, SMS, WhatsApp, and Push are completely independent registries with pluggable providers
4. **Reliable Delivery** — Exponential backoff retry strategy, dead-letter queue for failed notifications, webhook-based tracking
5. **Operational Visibility** — Provider health checks, SLA tracking, delivery status monitoring, rate limit handling
6. **Template Rendering Pipeline** — Mustache-based variable interpolation with channel-specific formatting (HTML for email, plain text for SMS/WhatsApp)
7. **Rate Limiting & Metering** — Per-provider per-tenant token bucket, fallback usage tracking for BYOK accounting

**Architecture:**

- **Orchestrator** — Entry point for sending notifications; coordinates template loading, rendering, routing
- **Channel Router** — Directs to correct provider based on channel + tenant credentials
- **Provider Registry** — Maps provider slug → implementation with lazy initialization
- **Provider Instance** — Concrete SendGrid, Twilio, Firebase, etc. with credentials baked in
- **Retry Engine** — Exponential backoff (100ms, 200ms, 400ms) with jitter and dead-letter fallback
- **Metering** — Emits events when tenant uses deployer's fallback credentials (for accounting)

---

## Context

### Multi-Tenant Notification Challenge

Witylogix supports SaaS tenants (shops) that manage their own deliveries. Each tenant may want to:

- Use their own SendGrid/Mailgun/AWS SES account for branding and quota independence
- Fall back to shared deployer credentials if not configured
- Track which provider was used and whether fallback occurred

Current state:

- Single hardcoded email provider (SendGrid)
- No SMS, WhatsApp, or Push support
- No tenant-specific credentials
- No retry strategy or dead-letter handling

### The BYOK (Bring Your Own Keys) Pattern

SaaS platforms often face this choice:

| Approach            | Pros                                                     | Cons                                                                  |
| ------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| **Unified Service** | Simpler ops, single provider, easier UX                  | Vendor lock-in, billing opacity, quota contention between tenants     |
| **BYOK**            | Tenant autonomy, transparent costs, credential ownership | Credential management complexity, provider sprawl, need for fallbacks |

**Decision: BYOK** — Witylogix tenants are sophisticated logistics operators who want:

- Independent API credentials (for cost tracking, custom whitelabeling)
- Fallback to deployer defaults only if they haven't configured
- Clear visibility into which provider serves each notification

### Multi-Channel Reality

Witylogix notifications span four independent channels:

1. **Email** — Order confirmations, shipping updates, invoices
   - Providers: SendGrid, Mailgun, AWS SES, Postmark, Resend, SMTP
   - Features: Template IDs, HTML/text, attachments, scheduling

2. **SMS** — Delivery status (ETA, driver location), OTP codes
   - Providers: Twilio, Vonage, AWS SNS, MessageBird, Plivo
   - Features: Shortcodes, throughput guarantees, delivery receipts

3. **WhatsApp** — Rich delivery updates, interactive menus, order placement
   - Providers: Meta Cloud API (Whatsapp Business), Twilio WhatsApp, 360dialog
   - Features: Template-based messages, media, interactive buttons

4. **Push Notifications** — Real-time alerts (delivery arrived, order ready), in-app messaging
   - Providers: Firebase (FCM), OneSignal, Expo Push
   - Features: Batching, data payloads, segmentation, scheduling

Each channel must be independently configurable because:

- Tenant may use Twilio for SMS but SendGrid for email
- Different providers have different costs (Twilio SMS ≠ Vonage SMS)
- Different regulatory requirements (WhatsApp template review, SMS throughput)

### Template System Design

Notifications combine:

- Static template (subject, body) stored in database
- Dynamic variables (customer name, order ID, delivery ETA)
- Channel-specific rendering (HTML for email, plain text for SMS)

Example template:

```
Name: "order_shipped"
Channel: EMAIL
Subject: "Order {{orderId}} shipped with {{carrierName}}"
Body: "<p>Hi {{customerName}},</p>
       <p>Your order {{orderId}} has shipped...</p>"
TextBody: "Hi {{customerName}}, Your order {{orderId}} has shipped..."
```

Rendering pipeline:

1. Load template from DB by (templateId, channel)
2. Interpolate {{variable}} with values from context
3. Pass to provider (provider handles provider-specific templating if used)
4. Return message ID

### Retry & Reliability

Network failures happen. Notification delivery must be robust:

- **Transient failures** (HTTP 429, 5xx timeouts) → retry with exponential backoff
- **Permanent failures** (400 bad request, 401 unauthorized) → fail fast, log to dead-letter queue
- **Provider overload** → rate limiting, backpressure via token bucket

Example retry sequence:

```
Attempt 1: t=0ms (immediate)
  → SendGrid rate limit (429), retry after 60s
Attempt 2: t=100ms + jitter (exponential backoff)
  → Network timeout
Attempt 3: t=300ms + jitter
  → Success
```

If all attempts fail:

- Log to `notificationLog` table with status FAILED
- Emit to dead-letter queue for manual intervention
- Alert ops if SLA violated (e.g., shipping notification not sent within 5 min)

### Rate Limiting Strategy

Each provider has rate limits:

- SendGrid: 100 req/sec
- Twilio: 1000 req/sec per credential
- Firebase: 10k msgs/sec
- Meta WhatsApp: Depends on tier (100–10k msgs/sec)

Solution: **Per-provider per-tenant token bucket**

- Each tenant → each provider → sliding window token bucket
- Tokens refill at provider's configured rate
- Block if tenant exceeds their quota; emit metering event

Example: tenant with SendGrid reaches daily cap → fallback to deployer's SendGrid account (if available)

### Health Checks & Monitoring

Operational visibility requires:

- **Periodic health checks** — Every 60s, test connectivity to each enabled provider
- **Delivery status webhooks** — Provider calls back when message bounces/opens/clicks
- **SLA tracking** — Alert if >5% of notifications fail in 24h window
- **Cost attribution** — Log usage per tenant per provider for billing

---

## Architecture Decision

### Why Per-Provider Instances with Tenant Credentials?

Alternative architectures:

| Architecture                   | Approach                                              | Pros                                               | Cons                                                                  |
| ------------------------------ | ----------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| **Unified Adapter**            | Single SendGrid adapter, swap at config time          | Simple                                             | Vendor lock-in, one credentials object per tenant, no provider choice |
| **Provider Registry** (chosen) | Multiple provider instances, each with own config     | Provider agnostic, granular creds, fallback chains | Registry complexity, lazy init overhead                               |
| **Smart Router**               | Router picks provider at send-time from tenant config | Maximum flexibility                                | Routing logic scattered, hard to test, credential leaks risk          |

**Decision: Provider Registry Pattern**

Each channel maintains a registry of provider instances:

```typescript
interface NotificationRegistry {
  email: {
    sendgrid: SendGridEmailProvider;
    mailgun: MailgunEmailProvider;
    // ... more providers
  };
  sms: {
    twilio: TwilioSMSProvider;
    vonage: VonageSMSProvider;
    // ... more providers
  };
}
```

Benefits:

- **Swappable** — Replace SendGrid with Mailgun in shop.settings.notifications.email.provider, code unchanged
- **Fallback chains** — Try SendGrid first, fall back to Mailgun if over quota
- **Per-tenant isolation** — Each tenant's SendGrid creds stay isolated; can't see other tenants' credentials
- **Lazy init** — Only instantiate providers that are actually configured
- **Health tracking** — Per-provider health status, latency, quota remaining

### Why Mustache-Style Templates?

Template rendering options:

| Format                | Library                    | Pros                                     | Cons                                      |
| --------------------- | -------------------------- | ---------------------------------------- | ----------------------------------------- |
| **Mustache** (chosen) | handlebars, micro-mustache | Simple, widely adopted, logic-less, safe | Limited features                          |
| **Handlebars**        | @handlebars/handlebars     | Helpers, partials, if/loop               | Larger bundle, overkill for notifications |
| **EJS**               | ejs                        | Full JS expressions                      | Injection risk, hard to audit             |
| **Nunjucks**          | nunjucks                   | Filters, inheritance                     | Heavy, overkill for short notifications   |

**Decision: Mustache with Simple Interpolation**

Implementation:

```typescript
function renderTemplate(
  template: string,
  variables: Record<string, unknown>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(
      new RegExp(`{{\\s*${key}\\s*}}`, "g"),
      String(value),
    );
  }
  return result;
}
```

Why:

- Safe — No arbitrary JS execution
- Auditable — Easy to review templates
- Fast — O(n) regex replacement
- Sufficient — Notifications don't need conditionals or loops
- Compatible — Works with handlebars syntax for future migration

Channel-specific formatting:

- **Email** — Keep HTML, link previews via `<a>` tags
- **SMS/WhatsApp** — Strip HTML, break lines at 160 chars for SMS segmentation
- **Push** — Truncate to 240 chars, emoji-safe

### Orchestrator Flow

```
┌────────────────────────────────────────┐
│ send(shopId, channel, to, templateId)  │
└──────────────┬─────────────────────────┘
               │
               ▼
        ┌──────────────────┐
        │ Load Template    │
        │ (DB query)       │
        └──────────┬───────┘
                   │
                   ▼
        ┌──────────────────┐
        │ Render Variables │
        │ (Mustache)       │
        └──────────┬───────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ Route by Channel +        │
        │ Tenant Credentials        │
        │ (Registry lookup)         │
        └──────────┬────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │ Send with Retry  │
        │ (Exp backoff)    │
        └──────────┬───────┘
                   │
              ┌────┴────┐
              ▼         ▼
          Success    Failure
            │          │
            │          ▼
            │     ┌─────────────────┐
            │     │ Dead Letter Log  │
            │     │ (Manual review)  │
            │     └─────────────────┘
            │
            ▼
        ┌──────────────────┐
        │ Log to Database  │
        │ (notificationLog)│
        └──────────────────┘
```

### Provider Interface

```typescript
interface NotificationProvider {
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
  name: string;
  send(message: NotificationMessage): Promise<NotificationResult>;
  validateConfig(config: Record<string, string>): Promise<boolean>;
  getStatus(): Promise<ProviderStatus>;
}
```

Each provider (SendGrid, Twilio, Firebase) implements this interface:

- `send()` — Adapts unified message to provider API, calls SDK
- `validateConfig()` — Tests credentials (e.g., SendGrid API key syntax + connectivity test)
- `getStatus()` — Calls provider's health endpoint, returns latency + quota info

### Rate Limiting: Token Bucket per Tenant per Provider

```typescript
interface TenantProviderBucket {
  shopId: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
  provider: string;
  tokens: number; // Current token count
  capacity: number; // Bucket capacity (e.g., 100)
  refillRate: number; // Tokens per second
  lastRefillAt: number; // Last refill timestamp (ms)
}
```

Algorithm:

1. When send requested, calculate refill: `tokens += (now - lastRefillAt) * refillRate`
2. Clamp to capacity
3. If tokens >= cost (1), decrement and allow
4. Else block and return `RateLimitError`

Benefits:

- **Smooth fairness** — All tenants get fair share
- **Burst capable** — Accumulate tokens, then burst send
- **Per-provider** — Different providers have different limits
- **Distributed** — No central bottleneck (each process maintains own buckets)

### Retry Strategy: Exponential Backoff + Jitter

```typescript
const maxAttempts = 3;
const baseBackoff = 100; // ms
const jitter = Math.random() * 0.1 * baseBackoff; // 0-10% jitter

for (let attempt = 0; attempt < maxAttempts; attempt++) {
  try {
    return await provider.send(message);
  } catch (error) {
    if (attempt === maxAttempts - 1) {
      // Last attempt failed, go to dead-letter queue
      await logToDLQ(message, error);
      break;
    }

    // Exponential backoff: 100ms, 200ms, 400ms
    const delay = baseBackoff * Math.pow(2, attempt) + jitter;
    await sleep(delay);
  }
}
```

Why:

- **Transient resilience** — Network glitches recover within 100-400ms
- **Jitter** — Prevents thundering herd (all clients retrying simultaneously)
- **3 attempts max** — Balance retry cost vs. delivery success (3 attempts ≈ 99.9% success for 10% transient error rate)
- **Fast failure** — If permanent error (401, 400), fail on first attempt without retry

### Metering & Fallback Usage Tracking

When BYOK enabled and tenant hasn't configured a channel:

1. Fallback to deployer's credentials
2. Emit `NotificationMeterEvent`:
   ```typescript
   {
     shopId: "shop_123",
     channel: "email",
     provider: "sendgrid",
     operation: "send",
     usedFallback: true,
     timestamp: new Date()
   }
   ```
3. Accounting system receives event, logs usage for billing (e.g., $0.001 per email)

This allows:

- Transparent cost pass-through to tenant
- Detection of misconfigured tenants
- Fallback capacity planning

---

## Proposed Implementation

### 1. Provider Registry (`provider-registry.ts`)

Manages provider instances per tenant, supports lazy initialization, health monitoring, and automatic failover.

**Key responsibilities:**

- Store provider instances by channel + provider name
- Lazy init from tenant credentials
- Track health status
- Support failover chains
- Thread-safe (no mutex, using Maps for atomic updates)

### 2. Notification Orchestrator (`orchestrator.ts`)

Main entry point for sending notifications. Coordinates:

- Template loading from DB
- Variable interpolation
- Provider routing
- Retry logic with exponential backoff
- Delivery logging

**Key responsibilities:**

- Load template by templateId + channel
- Render with variables
- Route to provider via registry
- Send with retry
- Log delivery attempts
- Support batch sending

### 3. Architecture Document (`ADR-012-notification-provider-architecture.md`)

Comprehensive design document covering:

- Context (multi-tenant, BYOK, multi-channel)
- Decision rationale
- Architecture diagram
- Trade-offs and alternatives
- Consequences and migration path

---

## Trade-Offs

### Trade-Off 1: Per-Tenant Credentials vs. Unified Service

**Decision: Per-Tenant Credentials (BYOK)**

- **Chosen** — Tenant autonomy, transparent costs, no quota contention
- **Alternative** — Unified service: simpler ops, but vendor lock-in, multi-tenant quota issues
- **Consequence** — Ops must support credential rotation, backup providers, per-tenant fallback chains

### Trade-Off 2: Mustache Templates vs. Full Templating Language

**Decision: Simple Mustache Interpolation**

- **Chosen** — Safe, auditable, sufficient for notifications
- **Alternative** — Full templating (Handlebars/Nunjucks): more features, but heavier, overkill
- **Consequence** — Complex logic (if/loops) must happen in code before rendering; templates stay simple

### Trade-Off 3: Synchronous Retry vs. Async Backoff

**Decision: Synchronous Exponential Backoff (100-400ms total)**

- **Chosen** — Simpler implementation, acceptable latency for most use cases
- **Alternative** — Async backoff (queue-based): decouples caller, but adds queue infrastructure
- **Consequence** — Send endpoint blocks for 0-400ms; large batch sends might timeout

### Trade-Off 4: In-Process Rate Limiting vs. Distributed Quota Service

**Decision: In-Process Token Bucket**

- **Chosen** — No external service, low latency, per-process fairness
- **Alternative** — Centralized quota service (Redis): true global fairness, but adds latency + dependency
- **Consequence** — Multi-process deployments have independent buckets; fairness is eventual, not strict

### Trade-Off 5: Webhook-Based Delivery Tracking vs. Polling

**Decision: Webhook-Based (from provider)**

- **Chosen** — Real-time, provider-native, low ops cost
- **Alternative** — Periodic polling: simpler, but delays feedback, wastes API quota
- **Consequence** — Requires public webhooks endpoint; need HMAC signature verification for security

---

## Consequences

### Positive

1. **Provider Agnostic** — Swap providers without code changes; support 13+ today, add more tomorrow
2. **Multi-Tenant Safe** — Each tenant's credentials isolated; no cross-tenant leaks
3. **Reliable Delivery** — Retry strategy ensures 99%+ delivery for transient failures
4. **Operational Visibility** — Health checks, SLA tracking, metering for billing
5. **Cost Transparency** — Tenants see exactly which provider served their notification
6. **Gradual Migration** — Existing single-provider system can migrate tenant-by-tenant to BYOK

### Negative

1. **Registry Complexity** — Orchestrator must understand provider fallback chains
2. **Credentials Management** — Ops must securely store/rotate per-tenant credentials
3. **Async Pitfall** — Retry logic is synchronous; blocks caller; not suitable for 100k+ qps
4. **Testing Burden** — Need to mock/stub 13+ providers for comprehensive test coverage
5. **Billing Opacity** — If metering system fails, fallback usage isn't tracked → revenue leakage

### Future Evolution

1. **Async Queue** — Replace synchronous retry with job queue (Bull, RabbitMQ) for high throughput
2. **Template Versioning** — Support A/B testing via template variants + tenant cohorts
3. **Delivery Optimization** — ML-based send time optimization (SendGrid, Mailgun APIs support this)
4. **Unified Analytics** — Aggregate metrics across all providers (open rates, bounces, etc.)
5. **Provider Connector SDK** — Community-built providers via plugin API

---

## Implementation Timeline

| Phase       | Timeline   | Deliverables                                                      |
| ----------- | ---------- | ----------------------------------------------------------------- |
| **Phase 1** | Sprint 3.2 | ADR, Orchestrator v1, Provider Registry, Email/SMS/Push providers |
| **Phase 2** | Sprint 3.3 | WhatsApp provider, dead-letter queue, webhook verification        |
| **Phase 3** | Sprint 3.4 | Health checks, metering events, SLA alerting                      |
| **Phase 4** | Sprint 4.1 | Tenant UI for credential management, async queue migration        |

---

## Glossary

- **BYOK** — Bring Your Own Keys; tenant provides their own API credentials
- **Dead-Letter Queue** — Storage for messages that failed all retries; requires manual intervention
- **Provider** — Concrete implementation (SendGrid, Twilio, Firebase, etc.)
- **Registry** — Map of available providers, keyed by channel + provider name
- **SLA** — Service Level Agreement; e.g., "95% of notifications delivered within 5 minutes"
- **Token Bucket** — Rate limiting algorithm using "tokens" that refill at configured rate
- **Webhook** — Provider's HTTP callback when delivery status changes (bounce, open, click)

---

## References

- [SendGrid API Documentation](https://docs.sendgrid.com/)
- [Twilio SMS Documentation](https://www.twilio.com/docs/sms)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Token Bucket Rate Limiting](https://en.wikipedia.org/wiki/Token_bucket)
