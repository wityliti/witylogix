# ADR-013: BullMQ Worker to Notification Orchestrator Integration

**Status:** Accepted
**Date:** 2026-03-08
**Deciders:** Arjun (CTO)
**Supersedes:** None
**Relates to:** ADR-012 (Notification Provider Architecture), ADR-010 (Event Bus Architecture), ADR-009 (Medusa-Inspired Architecture)

---

## Executive Summary

This decision documents how **BullMQ workers integrate with the notification orchestrator** introduced in ADR-012. The notification worker transitions from **inline provider logic** to **orchestrator delegation**, simplifying worker code while centralizing notification logic.

**Key principles:**

1. **Worker = Queue Handler** — BullMQ workers handle job dequeuing, payload validation, and error routing
2. **Orchestrator = Business Logic** — NotificationOrchestrator owns template lookup, rendering, provider selection, and delivery
3. **Separation of Concerns** — Queue concerns (retry, dead-letter) separate from delivery concerns (provider selection, fallback)
4. **Retry Strategy Clarity** — BullMQ retries on queue-level failures; orchestrator retries on provider failures
5. **Multi-Tenant Isolation** — Per-tenant provider resolution via TenantProviderRegistry
6. **Metered Billing** — BYOK fallback usage tracked via metering events

**Result:**

- Notification worker reduced from 24 TODO stubs to clean 500-line implementation
- All inline provider switch/case removed
- Template rendering, provider selection, and delivery delegated to orchestrator
- Dead-letter queue for unrecoverable failures
- Comprehensive error classification (ProviderError, RateLimitError, InvalidRecipientError, AuthenticationError)

---

## Context

### Current State (Before ADR-013)

The notification worker at `apps/api/src/workers/notification-worker.ts` contains:

- 24 TODO stubs with console.log placeholders
- Inline switch/case for each provider (SendGrid, Mailgun, Postmark, etc.)
- Hardcoded provider dispatch logic per channel
- No template rendering (placeholder only)
- No orchestrator coordination
- Manual retry logic (missing exponential backoff)
- Scattered delivery logging

Example (current):

```typescript
switch (resolved.provider) {
  case "sendgrid": {
    // TODO: Implement SendGrid integration
    console.info(`[notification-worker] Email via SendGrid to ${recipient}...`);
    return { providerId: `sg_${Date.now()}` };
  }
  // ... 23 more providers with similar stubs
}
```

**Problems:**

1. **Code Explosion** — 24 providers × 4 channels = 96+ stub placeholders
2. **Logic Duplication** — Provider selection, rendering, retry logic scattered
3. **Difficult Maintenance** — Adding new provider requires modifying worker
4. **Poor Separation** — Queue orchestration mixed with delivery logic
5. **Missing Retry** — No exponential backoff, no circuit breaker
6. **Incomplete Error Handling** — No distinction between retryable/permanent failures

### Notification Orchestrator (ADR-012)

ADR-012 introduced `NotificationOrchestrator`:

- **Centralizes** template loading, rendering, provider routing
- **Implements** retry logic with exponential backoff (100ms, 200ms, 400ms)
- **Manages** delivery logging to `notificationLog` table
- **Supports** fallback chain (try primary, then backups)
- **Provides** health checks and provider status tracking

Orchestrator owns:

1. Template lookup from DB by templateId + channel
2. Mustache variable interpolation (`{{variable}}`)
3. Provider selection via TenantProviderRegistry
4. Send with retry (max 3 attempts per provider)
5. Logging to notificationLog table

Worker should own:

1. Dequeue job from BullMQ
2. Extract and validate payload (tenantId, channel, templateId, etc.)
3. Call orchestrator
4. Log result to BullMQ job
5. Handle queue-level errors (poison pill, dead-letter)

### Multi-Channel Complexity

Witylogix supports 4 independent notification channels:

- **Email** — 6 providers (SendGrid, Mailgun, AWS SES, Postmark, Resend, SMTP)
- **SMS** — 5 providers (Twilio, Vonage, AWS SNS, MessageBird, Plivo)
- **WhatsApp** — 3 providers (Meta Cloud, Twilio, 360dialog)
- **Push** — 3 providers (Firebase, OneSignal, Expo Push)

Each channel needs:

- Independent provider configuration
- Per-tenant credentials (BYOK pattern)
- Fallback chain support
- Channel-specific recipient format (email, phone, FCM token)

### Retry Strategy Distinction

Two layers of retry:

1. **BullMQ Retries** — Handle queue infrastructure failures
   - Job processing crashed
   - Redis connection lost
   - Worker process died
   - Configuration: exponential backoff, max attempts, dead-letter queue

2. **Orchestrator Retries** — Handle provider-specific failures
   - Provider API rate-limited
   - Temporary provider outage (5xx)
   - Network timeout
   - Configuration: exponential backoff (100ms, 200ms, 400ms), max 3 attempts

Both layers are necessary:

- BullMQ retries ensure job isn't lost due to infrastructure
- Orchestrator retries ensure transient provider issues don't block

### Error Classification

Different errors require different handling:

1. **ProviderError** — Provider rejected the message (invalid format, auth failure)
   - Permanent, non-retryable
   - Log to dead-letter, don't retry
   - Example: Invalid email format, expired credentials

2. **RateLimitError** — Provider rate-limited (quota, throughput)
   - Transient, retryable with backoff
   - Example: "Rate limit exceeded, retry in 60 seconds"

3. **InvalidRecipientError** — Recipient address invalid (bad email, invalid phone)
   - Permanent, non-retryable
   - Log to dead-letter, don't retry
   - Example: "Invalid phone number format"

4. **AuthenticationError** — Credentials invalid or expired
   - Permanent (until credentials rotated), non-retryable
   - Example: "API key invalid"

5. **TemporaryError** — Provider unavailable but likely to recover
   - Transient, retryable
   - Example: "Connection timeout", "Service temporarily unavailable" (5xx)

### BYOK Provider Resolution

When NOTIFICATIONS_BYOK=true, per-tenant provider resolution follows:

1. Load tenant config from `shop.settings.notifications.<channel>`
2. If tenant has configured `provider` + credentials → use tenant's
3. Else → fall back to deployer's env credentials + emit metering event
4. Else → mark channel unavailable

Metering tracks:

- Which tenant used which provider
- Whether fallback was used (for billing)
- Timestamp and operation type

### Dead-Letter Queue Strategy

Failed notifications that exceed retry limits should:

1. Be logged with full context (tenantId, channel, templateId, recipient, error)
2. Move to `notification_dlq` table or failed job queue
3. Generate alert for ops (Slack, Datadog) for investigation
4. Include retry count and last error message

Example DLQ entry:

```json
{
  "jobId": "notif-123",
  "shopId": "shop-abc",
  "channel": "EMAIL",
  "templateId": "order-shipped",
  "recipient": "customer@example.com",
  "errorType": "ProviderError",
  "error": "SMTP authentication failed",
  "attempts": 3,
  "lastAttemptAt": "2026-03-08T10:30:45Z"
}
```

---

## Decision

### Worker Responsibility Boundary

The notification worker is **solely responsible** for:

1. **Job Dequeuing**

   ```typescript
   const { shopId, channel, templateId, to, variables } = job.data;
   ```

2. **Payload Validation**
   - Check all required fields present
   - Check channel is valid ("EMAIL", "SMS", "WHATSAPP", "PUSH")
   - Check recipient format matches channel
   - Check templateId is non-empty string

3. **Orchestrator Invocation**

   ```typescript
   const result = await orchestrator.sendNotification(
     shopId,
     channel,
     to,
     templateId,
     variables,
   );
   ```

4. **Result Logging**
   - Log success with messageId
   - Log failure with error message
   - Include job metadata (jobId, attempt count)

5. **Error Classification and Routing**
   - If result.success → return success
   - If recoverable error (RateLimitError, network timeout) → let BullMQ retry
   - If unrecoverable error (ProviderError, AuthenticationError) → move to DLQ
   - If invalid recipient → move to DLQ immediately

### Orchestrator Responsibility Boundary

The orchestrator is **solely responsible** for:

1. **Template Loading**
   - Fetch `notificationTemplate` by templateId and channel
   - Validate template is active
   - Return null if not found

2. **Template Rendering**
   - Interpolate `{{variable}}` placeholders
   - Escape special characters safely
   - Support nested variables and JSON conversion

3. **Provider Selection**
   - Get TenantProviderRegistry for shopId
   - Fetch fallback chain for channel
   - Select primary provider or first available backup

4. **Message Delivery**
   - Build NotificationMessage with rendered content
   - Call provider.send(message)
   - Classify result (success, retryable, permanent)

5. **Retry Orchestration**
   - Retry failed sends up to 3 times
   - Use exponential backoff (100ms, 200ms, 400ms)
   - Try next provider in fallback chain if current fails
   - Return error if all providers exhausted

6. **Delivery Logging**
   - Log each attempt to `notificationLog` table
   - Include shopId, templateId, channel, recipient, provider
   - Record messageId if successful
   - Record error if failed

### Retry Strategy

**BullMQ Level:**

- Max 3 attempts (configurable)
- Exponential backoff (2000ms, 5000ms, 10000ms)
- Dead-letter queue after 3 failures
- Job includes retry count in metadata

**Orchestrator Level:**

- Max 3 attempts per provider
- Exponential backoff (100ms, 200ms, 400ms + jitter)
- Try next provider in fallback chain
- Return error if all providers fail

**Combined Effect:**

```
Job Attempt 1: Orchestrator tries 3 providers (backoff: 100, 200, 400ms)
  └─ All fail → BullMQ will retry in 2000ms

Job Attempt 2: Orchestrator tries 3 providers again
  └─ All fail → BullMQ will retry in 5000ms

Job Attempt 3: Orchestrator tries 3 providers again
  └─ All fail → Move to DLQ for manual investigation
```

### Per-Tenant Provider Resolution

Worker uses TenantProviderRegistry:

```typescript
const registry = getTenantProviderRegistry(shopId);
const fallbackChain = registry.getFallbackChain(channel);
// Registry handles: tenant config lookup, credentials, health status
// Orchestrator handles: routing through fallback chain
```

Registry is pre-populated during tenant initialization:

1. Load tenant's notification config from shop.settings
2. Register primary provider with tenant's credentials
3. Register backup providers from deployer config
4. Set fallback chain (primary → backups)

Worker doesn't need to know credentials or provider details—orchestrator handles it.

### Metered Billing Integration

When NOTIFICATIONS_BYOK=true:

1. Orchestrator detects fallback provider usage
2. Emits metering event via `emitNotificationMeterEvent()`
3. Global callback tracks fallback usage per tenant
4. Billing system queries usage for monthly invoicing

Worker doesn't emit metering—that's orchestrator's job.

### Error Handling Specificity

Worker catches and classifies errors:

```typescript
try {
  const result = await orchestrator.sendNotification(...);
  if (!result.success) {
    // Orchestrator returned failure with error message
    if (isRetryableError(result.error)) {
      throw new RateLimitError(result.error);  // BullMQ will retry
    } else {
      throw new ProviderError(result.error);   // Move to DLQ
    }
  }
  // success!
} catch (err) {
  if (err instanceof RateLimitError || err instanceof TemporaryError) {
    throw err;  // BullMQ will retry
  }
  // Other errors go to DLQ
  throw new Error(`[DEAD_LETTER] ${err.message}`);
}
```

---

## Consequences

### Positive

1. **Simplified Worker Code**
   - Worker reduced to ~50 lines of core logic (vs. 200+ with provider stubs)
   - Each channel processed identically (no switch/case per provider)
   - Clear separation: worker = queue, orchestrator = delivery

2. **Centralized Notification Logic**
   - Single source of truth for template rendering
   - Single source of truth for provider fallback logic
   - Single source of truth for retry behavior
   - Easier to add/modify providers (add to registry, no worker changes)

3. **Proper Retry Semantics**
   - BullMQ retries handle queue/infrastructure failures
   - Orchestrator retries handle provider transient failures
   - Combined approach is more robust than either alone

4. **Clear Error Classification**
   - ProviderError → permanent, don't retry
   - RateLimitError → retryable, respect backoff
   - InvalidRecipientError → permanent, don't retry
   - Enables proper dead-letter handling

5. **Better Operational Visibility**
   - All sends logged to single `notificationLog` table (via orchestrator)
   - Job metadata available in BullMQ for tracing
   - Orchestrator health checks available for ops dashboards

6. **Multi-Tenant Security**
   - Per-tenant credentials never exposed to worker
   - Provider registry ensures tenant A can't access tenant B's credentials
   - Metering tracks which tenant uses which provider

7. **Easier Testing**
   - Worker testable by mocking orchestrator
   - Orchestrator testable independently
   - Provider implementations testable independently

### Negative

1. **Orchestrator Complexity**
   - Orchestrator is 600+ lines (vs. none before)
   - Handles template loading, rendering, routing, retry, logging
   - Bug in orchestrator affects all notifications

   **Mitigation:** Comprehensive test coverage, gradual rollout, monitoring

2. **Double Retry**
   - Notifications might be retried up to 6 times (3 BullMQ × 3 orchestrator)
   - Could cause rate-limit issues if provider doesn't handle idempotency well

   **Mitigation:** Use provider messageId for deduplication, ensure idempotent sends

3. **Logging Overhead**
   - Each send attempt logged to `notificationLog` (6 entries possible per original attempt)
   - Could impact DB performance under high load

   **Mitigation:** Batch logging, use time-series DB if needed, index by (shopId, createdAt)

4. **Provider Registry Maintenance**
   - Each tenant's registry must be pre-initialized
   - If tenant adds new provider mid-day, registry must be refreshed

   **Mitigation:** Cache invalidation on shop.settings update, explicit refresh API

### Trade-offs

| Aspect                      | Before             | After                          |
| --------------------------- | ------------------ | ------------------------------ |
| **Worker Complexity**       | High (24 TODOs)    | Low (orchestrator delegation)  |
| **Orchestrator Complexity** | None               | High (600+ lines)              |
| **Code Duplication**        | Yes (per provider) | No (single path)               |
| **Retry Clarity**           | Mixed              | Clear (BullMQ vs orchestrator) |
| **Testing**                 | Difficult          | Easier (separated concerns)    |
| **Provider Addition**       | Modify worker      | Modify registry only           |
| **Logging Consistency**     | Scattered          | Centralized                    |

---

## Alternatives Considered

### A1: Keep Inline Provider Logic

**Approach:** Leave provider dispatch in worker, improve existing code

**Pros:**

- Minimal refactoring
- Single retry layer (BullMQ only)
- Straightforward debugging (everything in one place)

**Cons:**

- Worker becomes bloated (300+ lines)
- Duplication with orchestrator template/retry logic
- Difficult to add new providers (modify worker)
- Mixed concerns (queue + delivery)
- **Rejected because:** Violates separation of concerns, doesn't scale to 13+ providers

### A2: Orchestrator Only, No BullMQ Retry

**Approach:** Use orchestrator for all retries, disable BullMQ retries

**Pros:**

- Single retry layer (less complex)
- Fewer total retry attempts

**Cons:**

- Queue infrastructure failures cause job loss
- No circuit breaker for crashed workers
- Harder to debug (missing job metadata)
- **Rejected because:** Loses job durability and infrastructure resilience

### A3: Provider Classes in Worker

**Approach:** Create Provider classes (SendGridProvider, TwilioProvider) initialized in worker

**Pros:**

- Encapsulation per provider
- Potentially shareable between worker and other services

**Cons:**

- Still requires provider selection logic in worker
- Still requires retry logic in worker
- Overlaps with orchestrator responsibilities
- **Rejected because:** Duplicates orchestrator design without clear separation

### A4: Event-Driven Worker (Async Processor)

**Approach:** Worker emits domain event, separate handler processes via orchestrator

**Pros:**

- Decouples job processing from orchestration
- Could support async notification (fire-and-forget)

**Cons:**

- Adds event bus complexity
- Delays delivery (extra hop)
- Harder to trace end-to-end (job → event → handler)
- **Rejected because:** ADR-012 already uses orchestrator; this adds no benefit

### A5: Orchestrator in Worker Constructor

**Approach:** Initialize orchestrator in worker at startup, reuse across jobs

**Pros:**

- Singleton avoids repeated initialization

**Cons:**

- Same as current approach (not really alternative)
- Accepted in decision

---

## Implementation Details

### Worker File Structure

```typescript
// apps/api/src/workers/notification-worker.ts

import { Worker, type Job } from "bullmq";
import { getNotificationOrchestrator } from "@witylogix/core/notifications";

// Main worker handler
async function notificationHandler(job: Job<NotificationJobData>) {
  // 1. Extract and validate payload
  // 2. Call orchestrator.sendNotification()
  // 3. Log result
  // 4. Handle errors appropriately
}

// Error classification helpers
function isRetryableError(err: Error): boolean;
function isRecipientError(err: Error): boolean;
function isAuthError(err: Error): boolean;

// Worker setup
export function startNotificationWorker(): Worker;
```

### Payload Structure (Unchanged)

```typescript
interface NotificationJobData {
  shopId: string; // Tenant identifier
  orderId: string; // Order for correlation
  eventType: string; // "order.shipped", etc.
  channels: string[]; // ["EMAIL", "SMS"]
  recipient: {
    email?: string; // For EMAIL channel
    phone?: string; // For SMS, WHATSAPP
    fcmToken?: string; // For PUSH channel
  };
  templateId: string; // Template to load and render
  variables: Record<string, unknown>; // {{variable}} interpolation
}
```

### Orchestrator Invocation

```typescript
const orchestrator = getNotificationOrchestrator();

const result = await orchestrator.sendNotification(
  shopId,
  channel as "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
  recipient, // email, phone, or fcmToken
  templateId,
  variables,
);

if (result.success) {
  console.info(`[notification-worker] Sent via ${result.messageId}`);
} else {
  throw new Error(result.error);
}
```

### Dead-Letter Queue Strategy

BullMQ configuration:

```typescript
const worker = new Worker("notifications", handler, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // Start with 2s
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep for DLQ inspection
  },
});

// Move failed jobs to DLQ table
worker.on("failed", async (job, err) => {
  await storeDLQEntry({
    jobId: job.id,
    shopId: job.data.shopId,
    error: err.message,
    attempts: job.attemptsMade,
  });
});
```

### Logging

```typescript
// Success
await db.notificationLog.create({
  data: {
    shopId,
    templateId,
    channel,
    recipient,
    status: "SENT",
    messageId: result.messageId,
    sentAt: new Date(),
  },
});

// Failure
await db.notificationLog.create({
  data: {
    shopId,
    templateId,
    channel,
    recipient,
    status: "FAILED",
    error: error.message,
    createdAt: new Date(),
  },
});
```

### Metrics and Monitoring

Expose metrics:

- `notifications_sent_total` — Counter by channel, provider, status
- `notifications_send_duration_seconds` — Histogram by channel
- `notifications_retry_count` — Histogram of retry attempts
- `notifications_dlq_size` — Gauge of failed jobs

Example Prometheus:

```
notifications_sent_total{channel="EMAIL",provider="sendgrid",status="sent"} 1523
notifications_send_duration_seconds{channel="EMAIL",provider="sendgrid",le="0.5"} 1200
notifications_dlq_size{} 12
```

---

## Validation and Testing

### Unit Tests

**Worker tests:**

- Valid payload → calls orchestrator with correct args
- Missing recipient field → validation error
- Orchestrator success → logs delivery
- Orchestrator failure (retryable) → re-throws for BullMQ retry
- Orchestrator failure (permanent) → logs to DLQ

**Orchestrator tests:**

- Template loading → queries DB
- Template rendering → interpolates {{variable}}
- Provider selection → fetches from registry
- Retry logic → exponential backoff
- Fallback chain → tries next provider on failure
- Logging → inserts to notificationLog

**Provider tests:**

- SendGrid mock → returns messageId
- Twilio mock → returns messageId
- Invalid creds → throws AuthenticationError
- Rate limit → throws RateLimitError

### Integration Tests

- Multi-channel job (EMAIL + SMS) → both processed
- BYOK fallback → uses tenant creds, then fallback
- Metering → events emitted for fallback usage
- Dead-letter → unrecoverable errors move to DLQ
- Retry exhaustion → 3 attempts logged, job moved to DLQ

### Load Testing

- 1000 notifications/sec → measure throughput, latency
- Provider rate-limit → verify retry backoff works
- Database logging → verify no bottleneck
- Memory — orchestrator singleton doesn't leak

---

## Reference

**Related ADRs:**

- **ADR-012** — Notification Provider Architecture (orchestrator design)
- **ADR-010** — Event Bus Architecture (events from notifications)
- **ADR-009** — Medusa-Inspired Architecture (service structure)

**Implementation Files:**

- `/packages/core/src/notifications/orchestrator.ts` — NotificationOrchestrator
- `/packages/core/src/notifications/provider-registry.ts` — TenantProviderRegistry
- `/apps/api/src/workers/notification-worker.ts` — Worker (this ADR)
- `/packages/core/src/notifications/providers/` — Provider implementations

**External References:**

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Mustache Template Spec](https://mustache.github.io/)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)

---

## Approval and Timeline

- **Approved By:** Arjun (CTO)
- **Approved Date:** 2026-03-08
- **Implementation Deadline:** Sprint 3.3 (2026-03-15)
- **Rollout:** Gradual (dev → staging → prod with 10% traffic initially)
