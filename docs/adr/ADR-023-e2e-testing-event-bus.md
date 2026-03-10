# ADR-023: E2E Testing Strategy & Event Bus Architecture

**Date:** 2026-03-10
**Status:** Accepted
**Author:** Arjun (CTO)
**Reviewers:** Platform Engineering Team
**Relates to:** ADR-010 (Event Bus Architecture), ADR-021 (Developer Experience)

---

## Executive Summary

Witylogix is adopting **Playwright for E2E testing** with a **Page Object Model (POM)** pattern combined with an enhanced **event bus architecture featuring Redis Streams, event schema versioning, and dead-letter queue design**. This ADR addresses:

1. **E2E Testing Framework** — Why Playwright over Cypress
2. **Test Architecture** — Page Object Model (POM) pattern for maintainability
3. **Test Data Management** — Seed scripts, fixtures, and isolation strategies
4. **Event Bus Enhancements** — Redis Streams implementation with schema versioning
5. **Dead-Letter Queue (DLQ) Strategy** — Handling failed events reliably
6. **Pub/Sub Patterns** — Fan-out and point-to-point message distribution
7. **AI Monitoring Integration** — Observability and debugging during test execution
8. **Trade-off Analysis** — Decisions made and alternatives considered

This architecture ensures **reliable, maintainable E2E tests** while providing a **robust event bus** that scales horizontally and handles failure scenarios gracefully.

---

## Part 1: E2E Testing Strategy

### Context: Why E2E Testing Matters

Witylogix is a complex multi-tenant platform with:
- **Multi-shop orchestration** (Shopify, WooCommerce, Magento integrations)
- **Real-time dashboards** (WebSocket subscriptions, live updates)
- **Workflow engines** (order creation, fulfillment, shipping routing)
- **Event-driven architecture** (Redis Streams, consumer groups)
- **Third-party integrations** (payment providers, shipping APIs, auth providers)

Manual testing is insufficient because:
1. **Coverage gaps** — Hard to test all integration paths (shop + carrier + auth provider combos)
2. **Regression risks** — Changes to core workflows break downstream features
3. **Multi-environment complexity** — Staging ≠ production due to service variations
4. **Release confidence** — Need automated signal that core user journeys work

### Decision: Adopt Playwright for E2E Testing

**Selected Tool:** [Playwright](https://playwright.dev) v1.45+
**Language:** TypeScript (matches codebase)
**Test Organization:** Monorepo at `apps/e2e-tests/`

### Why Playwright Over Cypress?

| Criterion | Playwright | Cypress | Selenium | Nightwatch |
|-----------|-----------|---------|----------|-----------|
| **Multi-browser** | ✓ Chrome, Firefox, Safari, Chromium Edge | ✗ Chrome-only | ✓ All browsers | ✓ Most browsers |
| **Multi-tab/window** | ✓ Native support | ✗ Fundamentally limited | ✓ Yes | ✓ Yes |
| **Mobile testing** | ✓ Device emulation | Partial | ✓ Via Appium | Limited |
| **API testing** | ✓ Built-in via context | ✗ Community plugins | Partial | Limited |
| **Performance metrics** | ✓ Chrome DevTools Protocol | Limited | Limited | Limited |
| **WebSocket support** | ✓ Native listener | Partial | ✓ Yes | Limited |
| **Test execution speed** | Fast (headless) | Fast | Slower | Slower |
| **Debugging UX** | ✓ Inspector tool | ✓ Time travel | Basic | Basic |
| **Documentation** | Excellent | Good | Decent | Decent |
| **Enterprise support** | ✓ Microsoft-backed | ✓ Strong | ✓ Strong | Limited |
| **Learning curve** | Medium | Low | High | Medium |
| **Flakiness handling** | ✓ Auto-retry, expect() API | Good retry logic | Good | Good |
| **Cost** | Free (open-source) | Free / Paid (Dashboard) | Free | Free |

**Key Reasons for Playwright:**
1. **Multi-browser testing** — Test Safari and Firefox without sacrificing developer speed
2. **API + UI in one tool** — Test webhooks, GraphQL subscriptions alongside UI flows
3. **Mobile emulation** — Validate responsive designs without physical devices
4. **DevTools integration** — Network throttling, performance metrics for monitoring integration
5. **Expect API** — Stronger test assertions than Cypress chains
6. **WebSocket listeners** — Critical for real-time dashboard testing
7. **Microsoft backing** — Long-term support and rapid feature development

**Trade-offs:**
- Learning curve steeper than Cypress (but TypeScript familiarity helps)
- Community smaller than Cypress (mitigated by Microsoft support)
- Visual regression testing requires plugin (Percy, Argos, or manual snapshots)

---

## Part 2: Test Architecture — Page Object Model (POM)

### Overview

The **Page Object Model** is a design pattern that:
- Encapsulates page interactions in reusable "page" classes
- Abstracts DOM selectors and UI logic from test scenarios
- Improves maintainability (UI changes = fix one place, not 50 tests)
- Enables non-technical test case writing

### Directory Structure

```
apps/e2e-tests/
├── playwright.config.ts          # Global config (browsers, timeouts, reporters)
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts         # Login flow tests
│   │   ├── mfa.spec.ts           # Multi-factor auth
│   │   └── sso.spec.ts           # SSO (Auth0, Okta, etc.)
│   ├── dashboard/
│   │   ├── orders.spec.ts        # Order dashboard tests
│   │   ├── realtime.spec.ts      # WebSocket subscription tests
│   │   └── filters.spec.ts       # Dashboard filtering/sorting
│   ├── workflows/
│   │   ├── order-creation.spec.ts
│   │   ├── fulfillment.spec.ts
│   │   └── shipping-routing.spec.ts
│   ├── integrations/
│   │   ├── shopify-sync.spec.ts
│   │   ├── carrier-webhook.spec.ts
│   │   └── payment-provider.spec.ts
│   └── api/
│       ├── graphql-mutations.spec.ts  # Test API layer alongside UI
│       └── webhook-handling.spec.ts
├── pages/
│   ├── basePage.ts               # BasePageObject (shared methods)
│   ├── authPage.ts               # Login, signup, password reset
│   ├── dashboardPage.ts          # Main dashboard
│   ├── orderDetailPage.ts        # Order details modal/page
│   ├── settingsPage.ts           # Admin settings
│   └── components/
│       ├── orderTable.ts         # Reusable table component
│       ├── notificationBanner.ts
│       └── modal.ts              # Generic modal interactions
├── fixtures/
│   ├── auth.fixture.ts           # Pre-authenticated browser context
│   ├── testData.fixture.ts       # Seed data (orgs, shops, users)
│   └── database.fixture.ts       # DB cleanup/teardown
├── utils/
│   ├── apiHelpers.ts             # GraphQL client, REST helpers
│   ├── dbHelpers.ts              # Direct DB queries (seed, verify)
│   ├── eventBusHelpers.ts        # Redis Stream consumer for event verification
│   └── waitHelpers.ts            # Custom wait conditions
├── support/
│   ├── hooks.ts                  # Global setup/teardown
│   ├── reporters/
│   │   ├── customReporter.ts     # JUnit/HTML/JSON output
│   │   └── aiReporter.ts         # AI monitoring integration
│   └── mock-servers/
│       ├── shopifyMockServer.ts  # Mock Shopify API
│       └── carrierMockServer.ts  # Mock carrier webhooks
└── README.md
```

### Base Page Object Implementation

```typescript
// pages/basePage.ts
import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected page: Page;
  protected readonly baseUrl: string;

  constructor(page: Page) {
    this.page = page;
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  }

  // Generic locator methods
  protected getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  protected getByRole(role: string, options?: any): Locator {
    return this.page.getByRole(role, options);
  }

  // Wait helpers
  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForElement(locator: Locator, timeout = 5000) {
    await locator.waitFor({ timeout });
  }

  async click(locator: Locator) {
    await this.waitForElement(locator);
    await locator.click();
    await this.page.waitForLoadState('networkidle');
  }

  // Error handling
  async expectToHaveError(message: string) {
    await expect(this.page.locator('[role="alert"]')).toContainText(message);
  }

  // Network verification
  async expectApiCall(urlPattern: string | RegExp) {
    const response = await this.page.waitForResponse(urlPattern);
    expect(response.ok()).toBeTruthy();
    return response;
  }
}
```

### Example Page Object

```typescript
// pages/authPage.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './basePage';

export class AuthPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: /sign in/i });
    this.errorAlert = page.locator('[role="alert"]');
  }

  async goto() {
    await this.page.goto(`${this.baseUrl}/auth/login`);
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.click(this.loginButton);
    // Wait for redirect to dashboard
    await this.page.waitForURL(/\/dashboard/);
  }

  async expectLoginError(message: string) {
    await this.expectToHaveError(message);
  }

  async loginWithMFA(email: string, password: string, mfaCode: string) {
    await this.login(email, password);
    const mfaInput = this.page.getByLabel('2FA Code');
    await mfaInput.fill(mfaCode);
    await this.click(this.page.getByRole('button', { name: /verify/i }));
    await this.page.waitForURL(/\/dashboard/);
  }
}
```

### Test Example Using POM

```typescript
// tests/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { AuthPage } from '../../pages/authPage';

test.describe('Authentication', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('should login with valid credentials', async () => {
    await authPage.login('user@example.com', 'password123');
    // Implicit: page navigated to /dashboard (verified in POM)
  });

  test('should show error for invalid credentials', async () => {
    await authPage.login('user@example.com', 'wrong-password');
    await authPage.expectLoginError('Invalid email or password');
  });

  test('should support multi-factor authentication', async () => {
    await authPage.loginWithMFA('user@example.com', 'password123', '123456');
    // Dashboard loads after MFA verification
  });
});
```

---

## Part 3: Test Data Management

### Challenge: Multi-Tenant, Multi-Integration Scenarios

Tests need:
1. **Isolated data** — Each test runs with fresh org, shop, users
2. **Deterministic state** — Same seed always produces same data
3. **Quick setup** — Minimize database population time
4. **Easy teardown** — Clean up after each test without manual intervention
5. **Integration readiness** — Test data must work with real integrations (Shopify, Auth0, etc.)

### Strategy: Layered Approach

#### Layer 1: Database Seed Scripts

```bash
# packages/db/scripts/seed-e2e.ts
# Run before test suite starts

import { PrismaClient } from '@prisma/client';

export async function seedE2EDatabase() {
  const db = new PrismaClient();

  // 1. Create test organizations
  const org = await db.organization.create({
    data: {
      name: 'E2E Test Org',
      slug: `e2e-org-${Date.now()}`,
      planTier: 'PROFESSIONAL',
      shops: {
        create: [
          {
            name: 'E2E Shopify Store',
            source: 'shopify',
            sourceShopId: 'test-shopify-store.myshopify.com',
            // ... integration details
          },
          {
            name: 'E2E WooCommerce Store',
            source: 'woocommerce',
            sourceShopId: 'example.com',
            // ... integration details
          },
        ],
      },
    },
    include: { shops: true },
  });

  // 2. Create test users
  const adminUser = await db.user.create({
    data: {
      shopId: org.shops[0].id,
      email: 'admin@e2etest.com',
      name: 'Admin User',
      role: 'ADMIN',
      password: hashPassword('Test@1234'), // Deterministic
    },
  });

  const viewerUser = await db.user.create({
    data: {
      shopId: org.shops[0].id,
      email: 'viewer@e2etest.com',
      name: 'Viewer User',
      role: 'VIEWER',
      password: hashPassword('Test@1234'),
    },
  });

  // 3. Create auth providers (for SSO testing)
  const authProvider = await db.authProvider.create({
    data: {
      orgId: org.id,
      name: 'Test Auth0',
      type: 'oidc',
      clientId: process.env.AUTH0_CLIENT_ID_TEST!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET_TEST!,
      issuerUrl: process.env.AUTH0_ISSUER_URL_TEST!,
      isActive: true,
    },
  });

  // 4. Create test orders
  const order = await db.order.create({
    data: {
      shopId: org.shops[0].id,
      externalOrderId: `test-order-${Date.now()}`,
      status: 'pending_fulfillment',
      totalPrice: 99.99,
      // ... order details
    },
  });

  // 5. Return seed data for test access
  return {
    org,
    shops: org.shops,
    users: { adminUser, viewerUser },
    authProvider,
    orders: [order],
  };
}
```

#### Layer 2: Playwright Fixtures

```typescript
// fixtures/testData.fixture.ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  // Authenticated browser context
  authenticatedPage: async ({ page }, use) => {
    // Login using API calls (faster than UI)
    const response = await page.request.post(
      'http://localhost:3000/api/auth/login',
      {
        data: {
          email: 'admin@e2etest.com',
          password: 'Test@1234',
        },
      }
    );

    const { accessToken } = await response.json();

    // Set auth cookie
    await page.context().addCookies([
      {
        name: 'authToken',
        value: accessToken,
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
        secure: false,
      },
    ]);

    await use(page);
  },

  // Test data helpers
  testData: async ({ request }, use) => {
    const helpers = {
      async createOrder(shopId: string, data: any) {
        const response = await request.post(
          `http://localhost:3000/api/graphql`,
          {
            data: {
              query: `
                mutation CreateOrder($input: OrderInput!) {
                  createOrder(input: $input) {
                    id
                    externalOrderId
                  }
                }
              `,
              variables: { input: { shopId, ...data } },
            },
          }
        );
        return response.json();
      },

      async deleteAllOrders(shopId: string) {
        // Direct DB cleanup for test isolation
        await request.post(
          `http://localhost:3000/api/test/cleanup`,
          {
            data: { shopId, entityType: 'orders' },
          }
        );
      },
    };

    await use(helpers);
  },
});

export { expect };
```

#### Layer 3: Test Hooks for Isolation

```typescript
// tests/orders/orders.spec.ts
import { test } from '../../fixtures/testData.fixture';

test.describe('Orders Dashboard', () => {
  let shopId: string;

  test.beforeAll(async () => {
    // Get shop ID from seed data
    shopId = process.env.E2E_SHOP_ID || '';
  });

  test.beforeEach(async ({ testData }) => {
    // Clean up before each test
    await testData.deleteAllOrders(shopId);
  });

  test.afterEach(async ({ testData }) => {
    // Cleanup after each test
    await testData.deleteAllOrders(shopId);
  });

  test('should display orders on dashboard', async ({
    authenticatedPage,
    testData,
  }) => {
    // Create test order
    const { data } = await testData.createOrder(shopId, {
      externalOrderId: 'test-order-123',
      totalPrice: 99.99,
    });

    await authenticatedPage.goto('http://localhost:3000/dashboard/orders');
    // Assertions...
  });
});
```

### Test Data Isolation Strategy

**Problem:** Multi-tenant tests interfere with each other if not careful.

**Solution:** Scoped test data with cleanup

```typescript
// utils/dbHelpers.ts
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

export async function isolateTestData(testId: string) {
  const org = await db.organization.create({
    data: {
      name: `E2E Test (${testId})`,
      slug: `e2e-test-${testId}-${Date.now()}`,
      planTier: 'PROFESSIONAL',
    },
  });

  return org;
}

export async function cleanupTestOrg(orgId: string) {
  // Cascade delete: shops → orders → shipments → etc.
  await db.organization.delete({
    where: { id: orgId },
  });
}
```

**Usage in tests:**
```typescript
test.describe('Multi-org isolation', () => {
  let testOrg1: Organization;
  let testOrg2: Organization;

  test.beforeAll(async () => {
    testOrg1 = await isolateTestData('org1');
    testOrg2 = await isolateTestData('org2');
  });

  test.afterAll(async () => {
    await cleanupTestOrg(testOrg1.id);
    await cleanupTestOrg(testOrg2.id);
  });

  test('org1 orders should not leak to org2', async ({
    authenticatedPage,
  }) => {
    // Login as org2 user
    // Verify org1 orders are not visible
  });
});
```

---

## Part 4: Event Bus Architecture — Enhanced Design

### Building on ADR-010

ADR-010 established the **event bus with Redis Streams**. This ADR extends it with:

1. **Event schema versioning** — Handle API evolution gracefully
2. **Dead-letter queue (DLQ)** — Retry failed events with visibility
3. **Pub/Sub patterns** — Fan-out (broadcast) vs point-to-point (directed)
4. **Consumer group scaling** — Horizontal scaling with Redis consumer groups
5. **Monitoring integration** — Observability for event flow

### Event Schema Versioning Strategy

**Problem:** Schemas evolve; old subscribers must handle new event formats.

**Solution:** Explicit versioning in event envelope

```typescript
// packages/events/src/envelope.ts

export interface EventEnvelope<T = unknown> {
  // Event identity
  id: string; // UUID for idempotency
  type: string; // e.g., 'order.created'
  version: number; // Schema version (v1, v2, v3, ...)
  timestamp: number; // Unix milliseconds

  // Tenant isolation
  tenantId: string; // orgId or shopId
  sourceSystem: string; // 'api' | 'webhook' | 'workflow' | 'import'

  // Correlation
  correlationId?: string; // Trace related events
  causationId?: string; // Root event that caused this one

  // Payload
  data: T;

  // Metadata
  schema?: {
    // Allow subscribers to adapt
    breaking: boolean; // true if subscribers must upgrade
    migration?: (oldData: any) => T; // Auto-convert if possible
  };

  // Retry state
  retryCount: number;
  lastError?: string;
  dlqReason?: string; // Why it landed in DLQ
}
```

**Version Migration Example:**

```typescript
// packages/events/src/schemas/orderCreated.ts

// V1 (original schema)
interface OrderCreatedV1 {
  orderId: string;
  customerId: string;
  totalAmount: number;
}

// V2 (added currency, breaking change)
interface OrderCreatedV2 {
  orderId: string;
  customerId: string;
  totalAmount: number;
  currency: string; // NEW
}

// Migration function
export function migrateOrderCreatedV1toV2(v1: OrderCreatedV1): OrderCreatedV2 {
  return {
    ...v1,
    currency: 'USD', // Default to USD for legacy events
  };
}

// Subscriber handles versioning
export const subscribeToOrderCreated = (
  bus: TypedEventBus
) => {
  bus.subscribe('order.created', async (envelope) => {
    let data: OrderCreatedV2;

    if (envelope.version === 1) {
      // Migrate V1 to V2
      data = migrateOrderCreatedV1toV2(envelope.data as OrderCreatedV1);
    } else if (envelope.version === 2) {
      data = envelope.data as OrderCreatedV2;
    } else {
      // V3+ — reject or handle unknown
      throw new Error(`Unsupported order.created schema version: ${envelope.version}`);
    }

    // Process normalized data
    await sendOrderConfirmationEmail(data);
  });
};
```

**Registry Pattern:**

```typescript
// packages/events/src/schemaRegistry.ts

export class EventSchemaRegistry {
  private schemas = new Map<string, EventSchema>();
  private migrations = new Map<string, MigrationMap>();

  registerSchema(
    eventType: string,
    version: number,
    schema: EventSchema,
    migrations?: { [fromVersion: number]: (data: any) => any }
  ) {
    const key = `${eventType}@v${version}`;
    this.schemas.set(key, schema);

    if (migrations) {
      const migMap = this.migrations.get(eventType) || {};
      this.migrations.set(eventType, { ...migMap, ...migrations });
    }
  }

  async normalizeEvent<T>(
    envelope: EventEnvelope<unknown>
  ): Promise<EventEnvelope<T>> {
    const targetVersion = this.schemas.has(`${envelope.type}@v${envelope.version + 1}`)
      ? envelope.version + 1
      : envelope.version;

    if (targetVersion === envelope.version) {
      // Already at latest
      return envelope as EventEnvelope<T>;
    }

    // Apply migration chain
    let data = envelope.data;
    for (let v = envelope.version; v < targetVersion; v++) {
      const migrator = this.migrations.get(envelope.type)?.[v];
      if (!migrator) throw new Error(`No migration from v${v} to v${v + 1}`);
      data = migrator(data);
    }

    return {
      ...envelope,
      version: targetVersion,
      data: data as T,
    };
  }
}
```

### Dead-Letter Queue (DLQ) Design

**Problem:** Subscriber crashes or validation errors lose events; no visibility into failures.

**Solution:** Dedicated Redis Streams DLQ with retry policy

```typescript
// packages/event-bus/src/deadLetterQueue.ts

export interface DLQEntry {
  envelope: EventEnvelope;
  failureReason: string;
  failedAt: Date;
  failureCount: number;
  nextRetryAt?: Date;
  subscriber: string; // Which subscriber failed
}

export class DeadLetterQueue {
  private streamKey = 'event-bus:dlq';
  private readonly redis: Redis;
  private readonly maxRetries = 3;
  private readonly baseBackoffMs = 60_000; // 1 minute

  async enqueue(
    envelope: EventEnvelope,
    failureReason: string,
    subscriberName: string
  ): Promise<void> {
    const dlqEntry: DLQEntry = {
      envelope,
      failureReason,
      failedAt: new Date(),
      failureCount: (envelope.retryCount || 0) + 1,
      subscriber: subscriberName,
    };

    // Exponential backoff with jitter
    if (dlqEntry.failureCount <= this.maxRetries) {
      const backoff =
        this.baseBackoffMs * Math.pow(2, dlqEntry.failureCount - 1) +
        Math.random() * 10_000;
      dlqEntry.nextRetryAt = new Date(Date.now() + backoff);
    }

    // Store in Redis Stream
    await this.redis.xadd(
      this.streamKey,
      '*', // Auto-generate ID
      'envelope',
      JSON.stringify(dlqEntry.envelope),
      'failureReason',
      dlqEntry.failureReason,
      'subscriber',
      dlqEntry.subscriber,
      'nextRetryAt',
      dlqEntry.nextRetryAt?.toISOString() || 'null',
      'failureCount',
      dlqEntry.failureCount.toString()
    );

    // Emit DLQ alert for monitoring
    await this.emit(`dlq.event.failed`, dlqEntry);
  }

  async reprocessPending(): Promise<void> {
    // Run periodically (e.g., every 5 minutes)
    const now = Date.now();

    // Get pending DLQ entries ready for retry
    const entries = await this.redis.xrange(this.streamKey, '-', '+');

    for (const [id, fields] of entries) {
      const nextRetryAt = new Date(
        fields['nextRetryAt'] || 'null'
      ).getTime();
      if (nextRetryAt > now) continue; // Not ready yet

      const envelope = JSON.parse(fields['envelope']);

      // Attempt reprocessing
      try {
        await this.reprocessEvent(envelope);
        // Remove from DLQ on success
        await this.redis.xdel(this.streamKey, id);
      } catch (error) {
        // Increment retry count, update nextRetryAt
        const failureCount = parseInt(fields['failureCount']) + 1;
        if (failureCount > this.maxRetries) {
          // Permanently fail after maxRetries
          await this.markPermanentlyFailed(id, envelope);
          await this.redis.xdel(this.streamKey, id);
        }
      }
    }
  }

  async markPermanentlyFailed(
    dlqId: string,
    envelope: EventEnvelope
  ): Promise<void> {
    // Store in permanent failure archive
    const archiveKey = `event-bus:dlq:archive:${envelope.type}`;
    await this.redis.xadd(
      archiveKey,
      '*',
      'envelope',
      JSON.stringify(envelope),
      'archived_at',
      new Date().toISOString()
    );

    // Alert ops team
    await this.emit(`dlq.event.permanently_failed`, {
      eventType: envelope.type,
      eventId: envelope.id,
      reason: 'Max retries exceeded',
    });
  }
}
```

**Monitoring & Alerting:**

```typescript
// apps/api/src/modules/monitoring/dlqMonitor.ts

export class DLQMonitor {
  async startDLQReprocessing() {
    // Run reprocessing loop every 5 minutes
    setInterval(async () => {
      const dlq = container.resolve(DeadLetterQueue);
      try {
        await dlq.reprocessPending();
      } catch (error) {
        logger.error('DLQ reprocessing failed', { error });
      }
    }, 5 * 60 * 1000);
  }

  async setupDLQAlerts() {
    const dlq = container.resolve(DeadLetterQueue);

    // Alert on critical failures
    dlq.on('dlq.event.permanently_failed', async (event) => {
      await this.sendAlert({
        severity: 'high',
        title: `Event ${event.eventId} permanently failed`,
        body: `Event type ${event.eventType} exceeded max retries`,
      });
    });

    // Track DLQ depth
    setInterval(async () => {
      const depth = await dlq.getDepth();
      if (depth > 100) {
        await this.sendAlert({
          severity: 'medium',
          title: 'DLQ accumulating events',
          body: `Current DLQ depth: ${depth}`,
        });
      }
    }, 1 * 60 * 1000);
  }
}
```

### Pub/Sub Patterns

#### Pattern 1: Fan-Out (Broadcast)

**Use Case:** Order created → notify customers, update inventory, trigger workflow

```typescript
// packages/event-bus/src/patterns/fanOut.ts

export async function fanOutOrderCreated(
  bus: TypedEventBus,
  envelope: EventEnvelope<OrderCreated>
) {
  // All subscribers get the same event
  const subscribers = [
    'notification-service', // Email order confirmation
    'inventory-service', // Decrement stock
    'analytics-service', // Track order metrics
    'workflow-service', // Trigger fulfillment workflow
  ];

  for (const subscriber of subscribers) {
    bus.subscribe(`order.created`, async (evt) => {
      // Each subscriber processes independently
      // Failure in one doesn't block others
    });
  }
}
```

**ASCII Diagram:**

```
Event: order.created
         │
         ├─→ [Notification Service] (send email)
         ├─→ [Inventory Service] (decrement stock)
         ├─→ [Analytics Service] (log metrics)
         └─→ [Workflow Service] (fulfill order)

All subscribers process in parallel (async/await)
Failure in Notification doesn't block Inventory
```

#### Pattern 2: Point-to-Point (Directed)

**Use Case:** Webhook delivery to specific customer integration

```typescript
// packages/event-bus/src/patterns/pointToPoint.ts

export async function routeWebhookToPartner(
  bus: TypedEventBus,
  envelope: EventEnvelope<OrderCreated>
) {
  const partnerId = envelope.data.partnerId; // Specific target

  // Only the intended subscriber processes
  bus.subscribe(`order.created:${partnerId}`, async (evt) => {
    await webhookService.send(partnerId, evt.data);
  });
}
```

**Message Format:**

```typescript
// Point-to-point: include routing key
const envelope = {
  type: 'order.created',
  tenantId: org.id,
  routingKey: `webhook:partner-123`, // Directed to partner
  data: orderData,
};

// Fan-out: broadcast to all
const envelope2 = {
  type: 'order.created',
  tenantId: org.id,
  // No routingKey = broadcast
  data: orderData,
};
```

#### Pattern 3: Priority Queues

**Use Case:** High-priority notifications jump the queue

```typescript
// packages/event-bus/src/patterns/priorityQueue.ts

export interface PriorityEventEnvelope extends EventEnvelope {
  priority: 'critical' | 'high' | 'normal' | 'low'; // Default: normal
}

// Redis Stream key by priority
const streamKeys = {
  critical: 'event-bus:critical',
  high: 'event-bus:high',
  normal: 'event-bus:default',
  low: 'event-bus:low',
};

export async function publishWithPriority(
  envelope: PriorityEventEnvelope
): Promise<void> {
  const streamKey = streamKeys[envelope.priority] || streamKeys.normal;
  await redis.xadd(streamKey, '*', 'envelope', JSON.stringify(envelope));
}

// Consumer groups process by priority
export async function consumeByPriority(): Promise<void> {
  const queues = ['critical', 'high', 'normal', 'low'];

  for (const priority of queues) {
    const messages = await redis.xread(
      'COUNT',
      10, // Read 10 messages at a time
      'STREAMS',
      streamKeys[priority],
      '>'
    );

    for (const message of messages || []) {
      await processEvent(message);
    }
  }
}
```

---

## Part 5: AI Monitoring Integration Points

### Challenge: Observability in E2E Tests

Tests run in CI/CD; when they fail, debugging is hard:
- No interactive browser to inspect state
- Logs are massive; hard to correlate
- Flakiness hard to diagnose (race conditions? API timeouts?)

### Solution: AI-Assisted Diagnostics

#### Integration Point 1: Test Failure Analysis

```typescript
// support/reporters/aiReporter.ts
import { Reporter, TestCase, TestError, FullResult } from '@playwright/test/reporter';

export class AIReporter implements Reporter {
  onTestFailure(test: TestCase, error: TestError) {
    // Collect context
    const context = {
      testName: test.title,
      errorMessage: error.message,
      stack: error.stack,
      screenshot: test.attachments.find((a) => a.name === 'screenshot')?.path,
      logs: test.attachments.find((a) => a.name === 'logs')?.path,
      duration: test.duration,
      retries: test.retries,
    };

    // Send to Claude API for analysis
    this.analyzeFailureWithAI(context);
  }

  private async analyzeFailureWithAI(context: any) {
    const prompt = `
Test "${context.testName}" failed with error:
${context.errorMessage}

Error stack:
${context.stack}

Test duration: ${context.duration}ms
Retries: ${context.retries}

Possible causes (from most to least likely):
- Race condition (async timing)
- Flaky selector (DOM changed)
- API timeout
- Resource exhaustion
- Third-party service failure
- Test data issue

Suggest: (1) root cause, (2) fix, (3) how to prevent
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const { content } = await response.json();
    console.log('AI Analysis:', content[0].text);
  }
}
```

#### Integration Point 2: Event Bus Monitoring

```typescript
// apps/api/src/modules/monitoring/eventBusMonitor.ts

export class EventBusMonitor {
  async monitorEventFlow(envelope: EventEnvelope) {
    const metrics = {
      eventType: envelope.type,
      tenantId: envelope.tenantId,
      subscriberCount: this.getSubscriberCount(envelope.type),
      averageLatency: await this.getAverageLatency(envelope.type),
      errorRate: await this.getErrorRate(envelope.type),
      dlqDepth: await this.dlq.getDepth(),
    };

    // Alert if anomalies detected
    if (metrics.errorRate > 0.1) {
      // > 10% failure rate
      await this.sendAlert({
        severity: 'high',
        title: `High error rate for ${envelope.type}`,
        metrics,
        suggestion: 'Review recent deployments; check subscriber logs',
      });
    }

    if (metrics.averageLatency > 5000) {
      // > 5 seconds
      await this.sendAIAnalysis({
        type: 'performance',
        issue: `${envelope.type} processing slow (${metrics.averageLatency}ms avg)`,
        context: metrics,
      });
    }
  }

  private async sendAIAnalysis(issue: any) {
    // Use Claude to diagnose performance issues
    const prompt = `
Event bus performance issue:
- Event type: ${issue.issue}
- Current metrics: ${JSON.stringify(issue.context, null, 2)}

Suggest: (1) root cause, (2) optimization, (3) monitoring strategy
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const result = await response.json();
    console.log('Performance Analysis:', result.content[0].text);
  }
}
```

#### Integration Point 3: Test Flakiness Detector

```typescript
// apps/e2e-tests/utils/flakinessDetector.ts

export class FlakinessDetector {
  private history = new Map<string, TestResult[]>();

  async recordTestRun(testName: string, passed: boolean, duration: number) {
    if (!this.history.has(testName)) {
      this.history.set(testName, []);
    }

    this.history.get(testName)!.push({ passed, duration, timestamp: Date.now() });
  }

  async detectFlakiness(window = 50) {
    // Analyze last 50 runs
    for (const [testName, results] of this.history) {
      const recent = results.slice(-window);
      const passRate = recent.filter((r) => r.passed).length / recent.length;

      // 60-90% pass rate = flaky
      if (passRate > 0.6 && passRate < 0.9) {
        await this.reportFlakiness(testName, passRate, recent);
      }
    }
  }

  private async reportFlakiness(
    testName: string,
    passRate: number,
    results: TestResult[]
  ) {
    const prompt = `
Test "${testName}" is flaky:
- Pass rate: ${(passRate * 100).toFixed(1)}% (over last 50 runs)
- Duration variance: min=${Math.min(...results.map((r) => r.duration))}ms, max=${Math.max(...results.map((r) => r.duration))}ms

Likely causes: race condition, timing-dependent assertions, external service unavailability

Suggest: (1) root cause, (2) fix, (3) assertion improvements
`;

    // Send to Claude for analysis
    const analysis = await this.askClaude(prompt);
    console.log(`Flakiness Report for "${testName}":\n${analysis}`);
  }

  private async askClaude(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const result = await response.json();
    return result.content[0].text;
  }
}
```

---

## Part 6: Trade-off Analysis

### Trade-off 1: Playwright vs Cypress for Multi-Browser Testing

| Factor | Playwright | Cypress |
|--------|-----------|---------|
| **Safari testing** | ✓ Native (webkit) | ✗ Not supported |
| **Dev experience** | Good (inspector) | Excellent (time travel debug) |
| **Stability** | Very stable | Very stable |
| **Learning curve** | Medium | Low |
| **Team proficiency** | Increasing | High |

**Decision:** Playwright for cross-browser coverage (Safari for iPad/iPhone testing).

**Mitigations:**
- Invest in documentation
- Pair-program setup with team
- Create reusable fixtures to hide complexity

### Trade-off 2: Seed Scripts vs Factories

| Approach | Seed Script | Factory Pattern |
|----------|------------|-----------------|
| **Speed** | Fast (bulk insert) | Slower (per-entity overhead) |
| **Flexibility** | Less (fixed data) | More (per-test customization) |
| **Determinism** | High (same seed = same data) | Medium (random defaults) |
| **Maintenance** | Database schema changes break it | More robust |

**Decision:** Hybrid approach
- Use seed scripts for static test orgs, users (run once before suite)
- Use factories for dynamic test data (create order with custom amounts, dates)

```typescript
// Best of both worlds
const org = await getOrCreateSeedOrg('e2e-test');
const order = await orderFactory.create({
  shopId: org.shops[0].id,
  totalPrice: 199.99, // Custom value
  // Other fields use defaults
});
```

### Trade-off 3: API vs UI Test Data Setup

| Setup Method | API Calls | UI Automation |
|---------|-----------|--------------|
| **Speed** | ~100ms per entity | ~2-5s per action |
| **Realism** | Less (bypasses validation) | More (full flow) |
| **Debugging** | Easier (inspect requests) | Harder (what did UI change?) |
| **Resilience to refactors** | Breaks if API changes | More brittle with UI changes |

**Decision:** API-first for setup, UI for critical flows
- Setup test data via API (fast)
- Test critical user flows via UI (realistic)
- Verify state via API (fast + reliable)

```typescript
test('user can create order via dashboard', async ({ page, request }) => {
  // Setup: Create shop via API (fast)
  const shop = await apiHelper.createShop();

  // UI: User creates order via dashboard
  await page.goto(`/dashboard/orders/new`);
  await page.fill('[name="customerId"]', 'cust-123');
  await page.fill('[name="totalPrice"]', '99.99');
  await page.click('button[type="submit"]');

  // Verify: Check order created via API (fast + reliable)
  const orders = await apiHelper.getOrders(shop.id);
  expect(orders).toHaveLength(1);
});
```

### Trade-off 4: Event Schema Versioning Strategy

**Options:**
1. **No versioning** — Subscribers always expect latest schema
2. **Implicit versioning** — Detect schema via trial (try parse, fall back)
3. **Explicit versioning** — Include version in envelope (chosen)

**Decision:** Explicit versioning

**Why:**
- Clear contract between publishers and subscribers
- Prevents silent failures (unknown version caught immediately)
- Easy to track migration progress

**Cost:** Extra bytes per event (negligible with compression)

### Trade-off 5: DLQ Retry Strategy

**Options:**
1. **Fire-and-forget** — No retries, lose events
2. **Immediate retries** — Retry 3x then fail (risk: thundering herd)
3. **Exponential backoff** — Delay retries, backoff (chosen)
4. **Infinite retries** — Eventually will work (risk: unbounded growth)

**Decision:** Exponential backoff with max retries (3)

**Rationale:**
- Handles transient failures (API rate limits, brief outages)
- Fails fast on permanent errors (invalid data, auth failure)
- Prevents retry storms

**Fallback:** Archive to DLQ after max retries; manual review later

---

## Architecture ASCII Diagrams

### E2E Test Execution Flow

```
┌──────────────────────────────────────────────────────┐
│  CI/CD Pipeline: npm run test:e2e                    │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
         ┌─────────────────────────┐
         │  Seed E2E Database      │
         │  - Create test org      │
         │  - Create test users    │
         │  - Create test orders   │
         │  - Create auth provider │
         └────────┬────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │  Initialize Playwright              │
    │  - Launch browsers (Chrome, FF, Safari)
    │  - Setup context (auth, cookies)    │
    │  - Register reporters               │
    └────────┬────────────────────────────┘
             │
             ▼
  ┌────────────────────────────────────┐
  │  Load Test Suite                   │
  │  ├─ auth/login.spec.ts             │
  │  ├─ dashboard/orders.spec.ts       │
  │  ├─ workflows/order-creation.spec.ts
  │  └─ api/graphql-mutations.spec.ts  │
  └────────┬─────────────────────────┘
           │
           ▼
  ┌──────────────────────────────────┐
  │  Execute Tests in Parallel       │
  │  (worker_threads, 4 workers)     │
  │                                  │
  │  Test 1: login.spec.ts           │
  │  ├─ AuthPage instance created    │
  │  ├─ Navigate to /auth/login      │
  │  ├─ Fill credentials             │
  │  ├─ Click login button           │
  │  ├─ Wait for redirect            │
  │  └─ Assert success               │
  │                                  │
  │  Test 2: orders.spec.ts (parallel)
  │  ├─ DashboardPage instance       │
  │  ├─ Create order via API         │
  │  ├─ Navigate to /dashboard       │
  │  ├─ Assert order visible         │
  │  └─ Verify via API               │
  │                                  │
  │  ... (more tests)                │
  └────────┬─────────────────────────┘
           │
           ▼
  ┌──────────────────────────────────┐
  │  Test Completion                 │
  │  ├─ Collect results              │
  │  ├─ Generate reports             │
  │  ├─ Detect flakiness             │
  │  ├─ AI analysis of failures      │
  │  └─ Cleanup test data            │
  └────────┬─────────────────────────┘
           │
           ▼
    ┌─────────────┐
    │  Exit (0/1) │
    └─────────────┘
```

### Event Bus & DLQ Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Application Layer: Workflow Engine                        │
│  ─────────────────────────────────────────────────────────  │
│  OrderCreationWorkflow                                     │
│    ├─ Step 1: Create order in DB                          │
│    ├─ Step 2: Emit event: order.created (v2)              │
│    └─ Step 3: Workflow completes                          │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
    ┌─────────────────────────────┐
    │  Event Envelope             │
    │  ─────────────────────────  │
    │  type: "order.created"      │
    │  version: 2                 │
    │  tenantId: org-123          │
    │  correlationId: corr-456    │
    │  data: {...}                │
    │  priority: "normal"         │
    └──────────┬──────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────────┐
    │  TypedEventBus.publish()                     │
    │  - Validate schema                           │
    │  - Add event ID & timestamp                  │
    │  - Route by priority                         │
    └──────────┬───────────────────────────────────┘
               │
               ▼
    ┌─────────────────────────────────────────────┐
    │  Redis Streams (by priority)                │
    │  ┌─────────────────────────────────────┐   │
    │  │ event-bus:critical                  │   │
    │  │ ID: 1234567890-0                    │   │
    │  │ envelope: {order.created...}        │   │
    │  └─────────────────────────────────────┘   │
    │                                             │
    │  ┌─────────────────────────────────────┐   │
    │  │ event-bus:default (normal priority) │   │
    │  │ ID: 1234567890-1 (order.created)    │   │
    │  │ ID: 1234567891-2 (order.shipped)    │   │
    │  │ ID: 1234567892-3 (inventory.updated)
    │  └─────────────────────────────────────┘   │
    └──────────┬───────────────────────────────┬──┘
               │                               │
      ┌────────▼────────┐          ┌──────────▼─────────┐
      │ Consumer Group  │          │ Consumer Group     │
      │ notification-svc           │ inventory-svc      │
      │                 │          │                    │
      │ subscribe:      │          │ subscribe:         │
      │ order.created   │          │ order.created,     │
      │ order.shipped   │          │ inventory.updated  │
      └────────┬────────┘          └──────────┬─────────┘
               │                              │
      ┌────────▼───────────────────────────────▼──┐
      │  Event Processing                        │
      │  ┌─────────────────────────────────────┐ │
      │  │ Try: Process event                  │ │
      │  │   - Normalize schema version        │ │
      │  │   - Execute subscriber handler      │ │
      │  │   - Acknowledge in consumer group   │ │
      │  └─────────────────────────────────────┘ │
      │                                           │
      │  ┌─────────────────────────────────────┐ │
      │  │ Catch: Error occurred               │ │
      │  │   - Log error                       │ │
      │  │   - Increment retry count           │ │
      │  │   - Send to DLQ                     │ │
      │  └─────────────────────────────────────┘ │
      └────────┬───────────────────────────────────┘
               │
               ├─── Success: Event processed ─┐
               │                              │
               └─── Error: Retry needed ──┐
                                           │
                    ┌──────────────────────▼──────┐
                    │  Dead-Letter Queue (DLQ)    │
                    │  ──────────────────────────  │
                    │  event-bus:dlq              │
                    │  ID: dlq-1                  │
                    │  envelope: {...}            │
                    │  failureReason: "timeout"   │
                    │  retryCount: 1              │
                    │  nextRetryAt: 2026-03-10... │
                    │                             │
                    │  ID: dlq-2                  │
                    │  envelope: {...}            │
                    │  failureReason: "validation"
                    │  retryCount: 3              │
                    │  [Permanently archived]     │
                    └──────────┬───────────────────┘
                               │
                ┌──────────────▼────────────────┐
                │  DLQ Reprocessing            │
                │  (Every 5 minutes)           │
                │  ─────────────────────────   │
                │  - Check nextRetryAt         │
                │  - Retry failed events       │
                │  - Success? Remove from DLQ  │
                │  - Max retries exceeded?     │
                │    → Archive to history      │
                │    → Alert ops team          │
                └──────────────────────────────┘
```

### Test Data Isolation Strategy

```
Test Suite Start
  │
  ├─ Seed Database
  │  ├─ Org 1 (e2e-org-1)
  │  │  ├─ Shop A (Shopify)
  │  │  ├─ Shop B (WooCommerce)
  │  │  ├─ User admin-1
  │  │  └─ User viewer-1
  │  │
  │  ├─ Org 2 (e2e-org-2)
  │  │  ├─ Shop C (Magento)
  │  │  ├─ User admin-2
  │  │  └─ User viewer-2
  │  │
  │  └─ Org 3 (e2e-org-3)
  │     └─ Shop D (Shopify)
  │
  ├─ Test Suite: Multi-Org Isolation
  │  │
  │  ├─ Test 1: Org 1 Admin sees Shop A only
  │  │  │
  │  │  ├─ BeforeEach: Login as admin-1
  │  │  ├─ Test: Navigate to /dashboard
  │  │  ├─ Assert: Only Shop A visible (Shop B hidden)
  │  │  └─ AfterEach: Cleanup (delete orders created in Shop A)
  │  │
  │  ├─ Test 2: Org 2 Admin sees Shop C only (in parallel)
  │  │  │
  │  │  ├─ BeforeEach: Login as admin-2
  │  │  ├─ Test: Navigate to /dashboard
  │  │  ├─ Assert: Only Shop C visible
  │  │  └─ AfterEach: Cleanup
  │  │
  │  ├─ Test 3: Viewer-1 sees read-only (in parallel)
  │  │  │
  │  │  ├─ BeforeEach: Login as viewer-1
  │  │  ├─ Test: Try to edit order
  │  │  ├─ Assert: Button disabled or permission denied
  │  │  └─ AfterEach: Cleanup
  │  │
  │  └─ ... (more tests)
  │
  └─ AfterAll: Cleanup
     ├─ Delete Org 1 (cascade → shops, users, orders)
     ├─ Delete Org 2
     └─ Delete Org 3
```

---

## Implementation Roadmap

### Phase 1 (Sprint 5.1): E2E Foundation
- [ ] Set up Playwright config (`playwright.config.ts`)
- [ ] Create base page object (`pages/basePage.ts`)
- [ ] Create fixtures (`fixtures/auth.fixture.ts`, `fixtures/testData.fixture.ts`)
- [ ] Write 3 auth tests (login, logout, MFA)
- [ ] Set up CI/CD workflow for E2E tests

### Phase 2 (Sprint 5.2): Page Objects & Test Cases
- [ ] Implement all page objects (dashboard, orders, settings, etc.)
- [ ] Write 20+ UI tests (orders, workflows, integrations)
- [ ] Add API test layer (GraphQL mutations)
- [ ] Setup data isolation strategy
- [ ] Add flakiness detection

### Phase 3 (Sprint 5.3): Event Bus Enhancements
- [ ] Implement event schema versioning
- [ ] Implement dead-letter queue (DLQ)
- [ ] Add DLQ reprocessing loop
- [ ] Create event monitoring dashboard
- [ ] Write consumer group tests

### Phase 4 (Sprint 5.4): AI Integration & Monitoring
- [ ] Implement AI failure analysis reporter
- [ ] Setup flakiness analyzer
- [ ] Add event bus performance monitoring
- [ ] Create Slack alerts for test failures
- [ ] Document debugging guide

### Phase 5 (Sprint 5.5): Production Hardening
- [ ] Performance optimization (reduce test suite duration)
- [ ] Visual regression testing (Percy integration)
- [ ] Cross-browser testing setup (Safari, Firefox)
- [ ] Load testing for event bus
- [ ] Documentation & runbooks

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Flaky tests** | High | High | Use `expect()` API, auto-retry, flakiness detector |
| **Test data pollution** | Medium | Medium | Strict isolation per test, cleanup hooks |
| **DLQ growth unbounded** | Low | Medium | Max retries, archive strategy, monitoring |
| **Event schema incompatibility** | Medium | High | Explicit versioning, migration tests |
| **Playwright adoption learning curve** | Medium | Low | Pair programming, documentation, training |
| **CI/CD timeout (test suite too slow)** | Medium | Medium | Parallel execution, selective test runs, caching |
| **Redis Streams scalability** | Low | High | Benchmark under load, consider clustering |

---

## Metrics & KPIs

### E2E Testing Metrics

- **Test Success Rate** — Target: > 95% (catch flakiness early)
- **Test Execution Time** — Target: < 15 min (full suite)
- **Code Coverage** — Target: > 80% (critical paths)
- **Bug Detection Rate** — Count bugs caught by E2E vs production

### Event Bus Metrics

- **Event Throughput** — Events/second processed
- **Event Latency (p50, p95, p99)** — Time from publish to subscriber processing
- **DLQ Depth** — Number of events in retry queue (target: < 100)
- **Error Rate** — Subscriber failures per 1000 events (target: < 1%)
- **DLQ Reprocessing Success Rate** — (Events reprocessed successfully / total retried)

---

## Conclusion

This ADR establishes **Playwright + Page Object Model** as the E2E testing standard, combined with an **enhanced event bus architecture** featuring:

1. **Reliable testing** via test data isolation and fixtures
2. **Robust events** via schema versioning and dead-letter queues
3. **Scalable pub/sub** with consumer groups and priority queues
4. **AI-assisted diagnostics** for failure analysis and flakiness detection
5. **Production-grade monitoring** for event flow and performance

The combination ensures:
- **Developer confidence** — Automated testing of critical flows
- **Operational visibility** — Events monitored end-to-end
- **Maintainability** — Page objects and schema versioning reduce brittleness
- **Scaling readiness** — Redis consumer groups, DLQ, and monitoring handle growth

---

## Approval Sign-off

- **CTO (Arjun):** Approved
- **Date:** 2026-03-10
- **Version:** 1.0
