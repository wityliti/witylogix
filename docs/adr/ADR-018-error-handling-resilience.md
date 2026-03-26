# ADR-018: Error Handling & Resilience Patterns

**Status:** Accepted
**Date:** 2026-03-09
**Deciders:** Witylogix Engineering Team (Arjun — CTO)

## Context

Witylogix platform integrates with multiple external carriers (FedEx, UPS, DHL), ecommerce platforms (Shopify, WooCommerce), and location services (Mapbox, OpenStreetMap). These integrations introduce unpredictable failure modes:

1. **Carrier API timeouts** — Rate limits, network latency, provider outages
2. **Partial failures** — Some orders sync successfully, others fail silently
3. **Inconsistent error formats** — Each carrier uses different error response schemas
4. **Stale data exposure** — Transient failures that are retried expose old order states
5. **Cascading failures** — One failed carrier connection blocks the entire worker queue
6. **No unified error tracking** — Errors buried in logs with no structured reporting

Currently, the platform handles errors reactively:
- Express error middleware catches exceptions and returns generic 500 responses
- Workers restart on uncaught errors, losing context about what failed
- No standardized way to classify errors (validation vs. transient vs. permanent)
- Client receives cryptic error messages ("Something went wrong")
- No automated alerting on repeated failures

## Decision

Implement a **standardized error handling and resilience framework** with:

1. **Error classification system** — Map all errors to a standard taxonomy
2. **Structured API error responses** — RFC 7807 Problem Details JSON
3. **Error boundaries in Next.js** — Graceful degradation at route and page level
4. **Retry/circuit-breaker patterns** — For external API calls and carrier integrations
5. **Dead letter queue (DLQ) handling** — Capture failed jobs for manual inspection
6. **Client-side error reporting** — Track user-facing errors with context
7. **Monitoring & alerting** — Prometheus metrics + Grafana dashboards + PagerDuty

### 1. Error Classification

All errors in the platform map to one of five categories:

```
ErrorType
├── ValidationError (400 Bad Request)
│   └── User input doesn't match schema (email format, required fields)
├── NotFoundError (404 Not Found)
│   └── Resource doesn't exist (order ID, shipment, user)
├── AuthError (401/403 Unauthorized/Forbidden)
│   └── Missing/invalid auth token or insufficient permissions
├── PlatformError (5xx Server Error)
│   ├── TransientError (Retry-safe)
│   │   ├── TimeoutError — Network call took too long
│   │   ├── RateLimitError — Carrier rate limit exceeded
│   │   └── TemporarilyUnavailableError — Service down (502/503)
│   └── PermanentError (Don't retry)
│       ├── ConfigurationError — Missing API key or bad provider config
│       ├── IncompatibilityError — Carrier doesn't support operation
│       └── DataIntegrityError — Database constraint violation
└── ExternalError (Depends on carrier)
    └── Wraps third-party error with retry/circuit-breaker logic
```

#### TypeScript Error Classes

```typescript
// Base error class
export abstract class WitylogixError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly timestamp = new Date();
  readonly id = crypto.randomUUID();

  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ValidationError (400)
export class ValidationError extends WitylogixError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public fieldErrors?: Record<string, string>
  ) {
    super(message);
  }
}

// NotFoundError (404)
export class NotFoundError extends WitylogixError {
  statusCode = 404;
  code = 'NOT_FOUND';

  constructor(resourceType: string, id: string) {
    super(`${resourceType} not found: ${id}`, { resourceType, id });
  }
}

// AuthError (401/403)
export class AuthError extends WitylogixError {
  statusCode: 401 | 403;
  code = 'AUTH_ERROR';

  constructor(
    message: string,
    statusCode: 401 | 403 = 401,
    context?: Record<string, any>
  ) {
    super(message, context);
    this.statusCode = statusCode;
  }
}

// TransientError (Retry-safe)
export class TransientError extends WitylogixError {
  statusCode = 503;
  code: string;

  constructor(code: 'TIMEOUT' | 'RATE_LIMIT' | 'TEMPORARILY_UNAVAILABLE', message: string) {
    super(message);
    this.code = code;
  }
}

// PermanentError (Don't retry)
export class PermanentError extends WitylogixError {
  statusCode = 500;
  code: string;

  constructor(
    code: 'CONFIGURATION' | 'INCOMPATIBILITY' | 'DATA_INTEGRITY',
    message: string
  ) {
    super(message);
    this.code = code;
  }
}
```

### 2. API Error Response Format (RFC 7807)

All API errors follow **RFC 7807 Problem Details for HTTP APIs**:

```json
{
  "type": "https://api.witylogix.com/docs/errors#RATE_LIMIT_ERROR",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Rate limit exceeded: 100 requests per minute",
  "instance": "https://api.witylogix.com/shipments/ship_123",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-09T10:30:00Z",
  "retryAfter": 60,
  "errors": {
    "carrier_api": {
      "message": "FedEx rate limit",
      "code": "RATE_LIMIT_ERROR",
      "retryable": true
    }
  }
}
```

#### Fastify Plugin: Error Response Formatter

```typescript
export const errorResponsePlugin = fp(async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const traceId = request.id;

    if (error instanceof WitylogixError) {
      const problemDetails = {
        type: `https://api.witylogix.com/docs/errors#${error.code}`,
        title: error.name,
        status: error.statusCode,
        detail: error.message,
        instance: request.url,
        traceId,
        timestamp: error.timestamp,
        ...(error instanceof ValidationError && {
          errors: error.fieldErrors
        }),
      };

      return reply
        .status(error.statusCode)
        .send(problemDetails);
    }

    // Unknown error — log and return generic response
    fastify.log.error({
      err: error,
      traceId,
      method: request.method,
      path: request.url,
    });

    return reply.status(500).send({
      type: 'https://api.witylogix.com/docs/errors#INTERNAL_SERVER_ERROR',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      traceId,
      timestamp: new Date(),
    });
  });
});
```

### 3. Next.js App Router Error Boundaries

Error boundaries capture errors at three levels:

#### Level 1: Root Error Boundary (Global)

File: `apps/dashboard/src/app/error.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    reportError({
      type: 'GLOBAL_ERROR',
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date(),
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50">
      <div className="text-center max-w-md">
        <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-6">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### Level 2: Route Group Error Boundary

File: `apps/dashboard/src/app/(app)/error.tsx`

Handles errors in authenticated routes (dashboard, settings, etc.):

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // If 401, redirect to login
  if (error.message.includes('Unauthorized')) {
    return (
      <div className="p-8">
        <h2>Session Expired</h2>
        <p>Please log in again</p>
        <Button onClick={() => router.push('/login')}>Login</Button>
      </div>
    );
  }

  return (
    <div className="p-8 border-l-4 border-red-500 bg-red-50">
      <div className="flex gap-4">
        <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <h2 className="font-bold text-gray-900 mb-1">Error</h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <Button onClick={reset} size="sm">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### Level 3: Per-Page Error Boundary (Optional)

File: `apps/dashboard/src/app/shipments/error.tsx`

For specific features that should degrade gracefully:

```typescript
'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export default function ShipmentsError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <EmptyState
      icon="AlertCircle"
      title="Failed to load shipments"
      description={error.message}
      action={
        <Button onClick={reset} variant="primary">
          Retry
        </Button>
      }
    />
  );
}
```

### 4. Retry & Circuit-Breaker Patterns

#### 4.1 Retry Helper

```typescript
interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 10000,
    backoffFactor = 2,
    jitter = true,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-transient errors
      if (error instanceof PermanentError || error instanceof ValidationError) {
        throw error;
      }

      // Last attempt — don't wait
      if (attempt === maxAttempts) {
        throw error;
      }

      // Calculate exponential backoff
      let delayMs = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      delayMs = Math.min(delayMs, maxDelayMs);

      // Add jitter to prevent thundering herd
      if (jitter) {
        delayMs *= Math.random();
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error('Retry failed');
}
```

#### 4.2 Circuit Breaker Pattern

```typescript
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;

  constructor(
    private name: string,
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < (this.nextAttemptTime || 0)) {
        throw new PermanentError(
          'CONFIGURATION',
          `Circuit breaker "${this.name}" is OPEN`
        );
      }
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();

      if (this.state === CircuitState.HALF_OPEN) {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();

      if (this.failureCount >= this.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
      }

      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

#### 4.3 Platform Adapter with Retry & Circuit-Breaker

```typescript
export class FedexCarrier {
  private circuitBreaker: CircuitBreaker;
  private logger: Logger;

  constructor(apiKey: string) {
    this.circuitBreaker = new CircuitBreaker('fedex', 5, 60000);
    this.logger = getLogger('fedex-carrier');
  }

  async createShipment(shipment: Shipment): Promise<FedexLabel> {
    return this.circuitBreaker.execute(async () => {
      return retryWithBackoff(
        async () => {
          const response = await fetch('https://apis.fedex.com/shipping/v1/shipments', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.apiKey}` },
            body: JSON.stringify(shipment),
            signal: AbortSignal.timeout(10000), // 10s timeout
          });

          if (response.status === 429) {
            throw new TransientError(
              'RATE_LIMIT',
              'FedEx rate limit exceeded'
            );
          }

          if (response.status === 502 || response.status === 503) {
            throw new TransientError(
              'TEMPORARILY_UNAVAILABLE',
              'FedEx API temporarily unavailable'
            );
          }

          if (!response.ok) {
            throw new PermanentError(
              'INCOMPATIBILITY',
              `FedEx API error: ${response.statusText}`
            );
          }

          return response.json();
        },
        { maxAttempts: 3, initialDelayMs: 100 }
      );
    });
  }
}
```

### 5. Dead Letter Queue (DLQ) Handling

For BullMQ workers, failed jobs are moved to a DLQ for manual inspection and replay:

```typescript
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const redis = new Redis();
const shipmentQueue = new Queue('shipments', { connection: redis });
const dlq = new Queue('shipments-dlq', { connection: redis });

export const shipmentWorker = new Worker(
  'shipments',
  async (job) => {
    try {
      await createShipmentLabel(job.data);
    } catch (error) {
      // Move to DLQ after max retries
      if (job.attemptsMade >= job.opts.attempts!) {
        await dlq.add(
          'failed-shipment',
          {
            originalJobId: job.id,
            originalData: job.data,
            error: error instanceof Error ? error.message : String(error),
            failedAt: new Date(),
          },
          { removeOnComplete: false }
        );
      }
      throw error;
    }
  },
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  }
);

// DLQ worker monitors for failed jobs
export const dlqWorker = new Worker(
  'shipments-dlq',
  async (job) => {
    // Alert team that manual intervention is needed
    await notificationService.alertEngineering({
      channel: 'slack',
      message: `Failed shipment job: ${job.data.originalJobId}`,
      context: job.data,
    });
  },
  { connection: redis }
);
```

### 6. Client-Side Error Reporting

```typescript
// lib/error-reporting.ts
export interface ErrorEvent {
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
}

export async function reportError(event: ErrorEvent): Promise<void> {
  try {
    await fetch('/api/v4/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        timestamp: event.timestamp.toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    });
  } catch {
    // Fail silently — don't create infinite error loop
    console.error('Failed to report error:', event);
  }
}

// Usage in client components
'use client';

export default function UserProfile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUserProfile()
      .catch((error) => {
        reportError({
          type: 'USER_PROFILE_LOAD_FAILED',
          message: error.message,
          stack: error.stack,
          context: { userId: currentUserId },
        });
      });
  }, []);

  // ...
}
```

### 7. Monitoring & Alerting Integration

#### Prometheus Metrics

```typescript
// lib/metrics.ts
export const errorMetrics = {
  totalErrors: new Counter({
    name: 'errors_total',
    help: 'Total errors by code',
    labelNames: ['code', 'source'],
  }),

  retryAttempts: new Histogram({
    name: 'retry_attempts',
    help: 'Number of retry attempts',
    labelNames: ['operation'],
    buckets: [1, 2, 3, 5, 10],
  }),

  circuitBreakerState: new Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
    labelNames: ['breaker_name'],
  }),

  dlqSize: new Gauge({
    name: 'dlq_size',
    help: 'Number of jobs in dead letter queue',
    labelNames: ['queue_name'],
  }),
};

// Usage
errorMetrics.totalErrors.inc({
  code: error.code,
  source: 'carrier_api',
});
```

#### Grafana Dashboard Queries

```
- Error rate by code: rate(errors_total[5m])
- Retry distribution: histogram_quantile(0.95, retry_attempts)
- Circuit breaker status: circuit_breaker_state > 0
- DLQ backlog: dlq_size
```

#### PagerDuty Integration

```typescript
export async function createPagerDutyAlert(error: WitylogixError): Promise<void> {
  // Alert on transient errors that exceed retry threshold
  if (error instanceof TransientError) {
    const errorCount = await redis.incr(`error:${error.code}`);

    if (errorCount > 100) { // 100 rate limit errors in 5 minutes
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        body: JSON.stringify({
          routing_key: process.env.PAGERDUTY_ROUTING_KEY,
          event_action: 'trigger',
          payload: {
            summary: `${error.code}: ${error.message}`,
            severity: 'critical',
            source: 'witylogix-api',
            custom_details: {
              errorId: error.id,
              timestamp: error.timestamp,
              code: error.code,
              count: errorCount,
            },
          },
        }),
      });
    }
  }
}
```

## Consequences

### Positive

1. **Standardized error handling** — All errors follow same schema; easier to debug and monitor
2. **Graceful degradation** — Transient failures don't crash the app; users see "retry" button instead of 500
3. **Circuit breakers prevent cascades** — One failing carrier doesn't block others
4. **DLQ provides visibility** — Failed jobs captured for manual inspection and replay
5. **RFC 7807 compliance** — Standard format compatible with error aggregation tools (Sentry, etc.)
6. **Testable error paths** — Error classes are mockable; easy to test retry/CB logic
7. **Structured client reporting** — Errors tracked with full context (user, session, URL)

### Negative

1. **More boilerplate** — Error classes, retry/CB wrappers add code
   - Mitigation: Utilities provided as shared lib; minimal per-feature overhead
2. **Circuit breaker latency** — Checking breaker state adds ~1ms per call
   - Mitigation: In-memory state; negligible compared to I/O operations
3. **DLQ requires manual monitoring** — Failed jobs don't auto-fix
   - Mitigation: Add cron job to replay DLQ jobs after cooldown period

## Implementation Details

### Error Handling Flowchart

```
Request arrives
    ↓
Try-catch block
    ├─→ Input validation → ValidationError (400)
    ├─→ Resource lookup → NotFoundError (404)
    ├─→ Auth check → AuthError (401/403)
    └─→ Business logic → TransientError or PermanentError
        ├─→ TransientError: Retry with backoff
        │   ├─→ Success → Return result
        │   └─→ Max retries exceeded → Error response
        └─→ PermanentError: Fail immediately

Finally: Log to Prometheus + PagerDuty if critical
```

### Test Examples

```typescript
describe('FedexCarrier', () => {
  it('retries on 429 (rate limit)', async () => {
    let attempts = 0;
    jest.spyOn(global, 'fetch').mockImplementation(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve({ status: 429 });
      }
      return Promise.resolve({ status: 200, json: async () => ({}) });
    });

    const carrier = new FedexCarrier('test-key');
    await carrier.createShipment(mockShipment);

    expect(attempts).toBe(2); // Retried once
  });

  it('does not retry on 400 (validation error)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      status: 400,
      statusText: 'Bad Request',
    });

    const carrier = new FedexCarrier('test-key');
    await expect(() =>
      carrier.createShipment(mockShipment)
    ).rejects.toThrow(PermanentError);
  });
});
```

## Related Decisions

- **ADR-017:** Dashboard authentication actions — error handling in server actions
- **ADR-001:** Platform rewrite with Fastify — error handler plugin integrated in API setup
- **ADR-010:** Event bus architecture — DLQ jobs as events for replay

## Migration Path

### Phase 1 (Now — Sprint 3.9)
- Define error classes + RFC 7807 formatter
- Add to Fastify API error handler
- Document in API docs

### Phase 2 (Sprint 3.10)
- Implement retry/circuit-breaker utilities
- Refactor carrier adapters to use them
- Add Prometheus metrics

### Phase 3 (Sprint 4.0)
- Add error boundaries to Next.js dashboard
- Client-side error reporting SDK
- DLQ worker + manual replay UI

### Phase 4 (Sprint 4.1+)
- Grafana dashboards + PagerDuty integration
- Error rate SLOs and alerting

## Questions & Answers

### Q: Why RFC 7807 and not GraphQL errors?

**A:** Platform uses REST API (Fastify). RFC 7807 is the standard for error responses in REST; widely supported by API clients and error aggregation tools (Sentry, Rollbar). GraphQL errors are orthogonal (used in driver app which uses GraphQL).

### Q: What happens if the retry service itself crashes?

**A:** Exceptions thrown during retry logic are caught by Fastify's error handler and returned as 500 responses. No infinite loops.

### Q: How long should circuit breakers stay open?

**A:** Default 60 seconds (configurable per breaker). For critical integrations (payment, shipping), consider 30s to recover faster. For non-critical (analytics), 2+ minutes to prevent flapping.

### Q: Should users see "transient error" vs. specific error messages?

**A:** Show specific messages (e.g., "Rate limit exceeded") so users know to retry later, not immediately. But hide internal error codes from UI.

### Q: How do we replay DLQ jobs?

**A:** Manual process (for now):
1. Admin reviews failed job in DLQ dashboard
2. Clicks "Replay" button
3. Job moved back to main queue with reset attempt count
4. Worker processes normally

Future: Automated replay after 1 hour cooldown.
