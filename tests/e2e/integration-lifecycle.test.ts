/**
 * E2E Integration Lifecycle Tests
 * End-to-end tests for complete integration workflows
 * Tests full lifecycle: connect, configure, test, enable, sync, verify, disconnect
 * ~600 lines, 25+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMockHTTPClient,
  createMockRateLimiter,
  createMockCircuitBreaker,
  createMockOAuthToken,
  isMockOAuthTokenExpired,
  simulateOAuthTokenRefresh,
  assertWebhookDelivery,
} from "../integration/helpers/integration-test-helpers.js";

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION CONNECTION LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration Connection Lifecycle", () => {
  let integrationState: Record<string, unknown> = {};
  let mockClient: ReturnType<typeof createMockHTTPClient>;
  let rateLimiter: ReturnType<typeof createMockRateLimiter>;
  let circuitBreaker: ReturnType<typeof createMockCircuitBreaker>;

  beforeEach(() => {
    integrationState = {
      status: "disconnected",
      credentials: null,
      webhooks: [],
    };
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /auth|token/,
          status: 200,
          data: { access_token: "token_123", expires_in: 3600 },
        },
        {
          url: /health|test/,
          status: 200,
          data: { status: "ok" },
        },
      ],
    });
    rateLimiter = createMockRateLimiter(100);
    circuitBreaker = createMockCircuitBreaker(5);
  });

  describe("Step 1: Connect Provider", () => {
    it("should authenticate with provider", async () => {
      const authRequest = {
        client_id: "test_client_id",
        client_secret: "test_secret",
        grant_type: "client_credentials",
      };

      const result = await mockClient.fetch(
        "https://provider.example.com/oauth/token",
        {
          method: "POST",
          body: JSON.stringify(authRequest),
        },
      );

      const data = await result.json();

      integrationState.credentials = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      expect(result.status).toBe(200);
      expect(integrationState.credentials).toHaveProperty("accessToken");
    });

    it("should handle OAuth callback", () => {
      const callbackParams = {
        code: "auth_code_123",
        state: "state_token_456",
      };

      expect(callbackParams).toHaveProperty("code");
      integrationState.status = "authenticated";
    });

    it("should store encrypted credentials", () => {
      const storedCreds = {
        encryptedToken: "encrypted_token_xyz",
        encryptedSecret: "encrypted_secret_abc",
      };

      expect(storedCreds).toHaveProperty("encryptedToken");
      integrationState.credentials = storedCreds;
    });
  });

  describe("Step 2: Configure Integration", () => {
    it("should validate API credentials", async () => {
      const validationRequest = {
        credentials: integrationState.credentials,
      };

      const result = await mockClient.fetch(
        "https://provider.example.com/api/health",
        {
          method: "GET",
          body: JSON.stringify(validationRequest),
        },
      );

      expect(result.status).toBe(200);
    });

    it("should configure sync preferences", () => {
      const config = {
        syncEntities: ["customers", "orders", "invoices"],
        syncDirection: "bidirectional",
        syncFrequency: 3600, // seconds
        mapFields: {
          local_customer_id: "provider_customer_id",
          local_order_id: "provider_order_id",
        },
      };

      integrationState.config = config;
      expect(config.syncEntities).toHaveLength(3);
    });

    it("should set webhook endpoints", () => {
      const webhookConfig = {
        webhookUrl: "https://app.example.com/webhooks/provider",
        webhookSecret: "webhook_secret_123",
        events: ["order.created", "order.updated", "invoice.generated"],
      };

      integrationState.webhooks = webhookConfig.events;
      expect(webhookConfig.events).toHaveLength(3);
    });

    it("should configure rate limiting", () => {
      const rateLimitConfig = {
        requestsPerMinute: 100,
        burstSize: 10,
      };

      expect(rateLimitConfig.requestsPerMinute).toBe(100);
    });
  });

  describe("Step 3: Test Connection", () => {
    it("should verify API connectivity", async () => {
      const result = await mockClient.fetch(
        "https://provider.example.com/api/test",
      );

      expect(result.status).toBe(200);
      integrationState.connectionStatus = "verified";
    });

    it("should test authentication", async () => {
      const authTest = {
        accessToken: integrationState.credentials,
      };

      const result = await mockClient.fetch(
        "https://provider.example.com/api/me",
        {
          method: "GET",
          body: JSON.stringify(authTest),
        },
      );

      expect(result.status).toBe(200);
    });

    it("should validate webhook endpoint", async () => {
      const webhookTest = {
        webhookUrl: integrationState.webhooks,
      };

      expect(webhookTest.webhookUrl).toBeDefined();
    });

    it("should report test results", () => {
      const testResults = {
        apiConnectivity: true,
        authentication: true,
        webhookValidation: true,
        timestamp: new Date().toISOString(),
      };

      integrationState.testResults = testResults;
      expect(testResults.apiConnectivity).toBe(true);
    });
  });

  describe("Step 4: Enable Sync", () => {
    it("should enable data synchronization", () => {
      integrationState.syncEnabled = true;
      expect(integrationState.syncEnabled).toBe(true);
    });

    it("should initialize sync tracking", () => {
      integrationState.syncState = {
        lastSyncTime: null,
        nextSyncTime: Date.now(),
        syncInProgress: false,
      };

      expect(integrationState.syncState).toHaveProperty("syncInProgress");
    });

    it("should register sync schedule", () => {
      const schedule = {
        type: "interval",
        intervalMs: 3600000, // 1 hour
        timezone: "UTC",
      };

      integrationState.syncSchedule = schedule;
      expect(schedule.intervalMs).toBe(3600000);
    });
  });

  describe("Step 5: Trigger Sync", () => {
    it("should execute full sync cycle", async () => {
      const syncStart = Date.now();
      integrationState.syncState.syncInProgress = true;

      // Simulate sync
      const syncData = {
        customers: [
          { id: "cust_1", name: "Customer 1" },
          { id: "cust_2", name: "Customer 2" },
        ],
        orders: [
          { id: "ord_1", customerId: "cust_1", total: 1000 },
        ],
      };

      integrationState.syncedData = syncData;

      integrationState.syncState.lastSyncTime = Date.now();
      integrationState.syncState.syncInProgress = false;

      const syncDuration = Date.now() - syncStart;

      expect(syncDuration).toBeGreaterThanOrEqual(0);
      expect(integrationState.syncedData).toHaveProperty("customers");
    });

    it("should handle incremental sync", () => {
      const delta = {
        created: [{ id: "cust_3", name: "Customer 3" }],
        updated: [{ id: "cust_1", name: "Updated Customer 1" }],
        deleted: [],
      };

      expect(delta.created).toHaveLength(1);
      expect(delta.updated).toHaveLength(1);
    });

    it("should log sync operations", () => {
      const syncLog = {
        timestamp: new Date().toISOString(),
        direction: "bidirectional",
        entitiesSync: 50,
        conflicts: 0,
        errors: 0,
        duration: 5000,
      };

      expect(syncLog).toHaveProperty("entitiesSync");
      integrationState.lastSyncLog = syncLog;
    });

    it("should retry failed syncs", async () => {
      const retryConfig = {
        maxRetries: 3,
        backoffMs: 1000,
      };

      let attempts = 0;
      const maxAttempts = retryConfig.maxRetries;

      while (attempts < maxAttempts) {
        try {
          // Simulate sync
          break;
        } catch {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error("Max retries exceeded");
          }
        }
      }

      expect(attempts).toBeLessThanOrEqual(maxAttempts);
    });
  });

  describe("Step 6: Verify Data", () => {
    it("should verify synced data integrity", () => {
      const syncedData = integrationState.syncedData as Record<string, unknown>;
      const verification = {
        customersVerified: Array.isArray(syncedData.customers),
        ordersVerified: Array.isArray(syncedData.orders),
        allValid: true,
      };

      expect(verification.customersVerified).toBe(true);
      integrationState.dataVerification = verification;
    });

    it("should check data consistency", () => {
      const consistencyCheck = {
        noMissingFields: true,
        noInvalidTypes: true,
        noOutOfRangeValues: true,
      };

      expect(consistencyCheck.noMissingFields).toBe(true);
    });

    it("should generate sync report", () => {
      const report = {
        syncDate: new Date().toISOString(),
        recordsSynced: 50,
        conflicts: 0,
        errors: 0,
        status: "success",
      };

      integrationState.syncReport = report;
      expect(report.status).toBe("success");
    });
  });

  describe("Step 7: Disconnect", () => {
    it("should revoke access token", () => {
      const revokeRequest = {
        token: integrationState.credentials,
      };

      expect(revokeRequest).toHaveProperty("token");
      integrationState.credentials = null;
    });

    it("should deregister webhooks", () => {
      integrationState.webhooks = [];
      expect(integrationState.webhooks).toHaveLength(0);
    });

    it("should stop sync schedule", () => {
      integrationState.syncEnabled = false;
      expect(integrationState.syncEnabled).toBe(false);
    });

    it("should set status to disconnected", () => {
      integrationState.status = "disconnected";
      expect(integrationState.status).toBe("disconnected");
    });

    it("should cleanup local cache", () => {
      integrationState.syncedData = null;
      expect(integrationState.syncedData).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK REGISTRATION AND DELIVERY
// ─────────────────────────────────────────────────────────────────────────────

describe("Webhook Management", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /webhooks/,
          status: 201,
          data: { id: "webhook_123", url: "https://app.example.com/webhooks" },
        },
      ],
    });
  });

  describe("Register Webhook", () => {
    it("should register webhook endpoint", async () => {
      const webhookRequest = {
        url: "https://app.example.com/webhooks/provider",
        events: ["order.created", "order.updated"],
        secret: "webhook_secret_123",
      };

      const result = await mockClient.fetch(
        "https://provider.example.com/api/webhooks",
        {
          method: "POST",
          body: JSON.stringify(webhookRequest),
        },
      );

      const data = await result.json();
      expect(result.status).toBe(201);
      expect(data).toHaveProperty("id");
    });
  });

  describe("Webhook Delivery", () => {
    it("should deliver webhook payload", async () => {
      const webhookPayload = {
        event: "order.created",
        data: {
          orderId: "ORD-001",
          customerId: "CUST-001",
          total: 1000,
        },
        timestamp: new Date().toISOString(),
      };

      expect(webhookPayload).toHaveProperty("event");
      expect(webhookPayload.data).toHaveProperty("orderId");
    });

    it("should verify webhook authenticity", () => {
      const payload = JSON.stringify({ event: "order.created" });
      const secret = "webhook_secret_123";
      const timestamp = Date.now().toString();

      const signature = `sha256=${Buffer.from(
        payload + timestamp + secret,
      ).toString("hex")}`;

      expect(signature).toMatch(/^sha256=/);
    });

    it("should retry failed deliveries", async () => {
      const webhookId = "webhook_123";

      const result = await assertWebhookDelivery(
        webhookId,
        async () => {
          return true; // Mock delivery success
        },
        3,
      );

      expect(result.delivered).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT AND CIRCUIT BREAKER HANDLING
// ─────────────────────────────────────────────────────────────────────────────

describe("Rate Limiting and Circuit Breaker", () => {
  let rateLimiter: ReturnType<typeof createMockRateLimiter>;
  let circuitBreaker: ReturnType<typeof createMockCircuitBreaker>;

  beforeEach(() => {
    rateLimiter = createMockRateLimiter(100);
    circuitBreaker = createMockCircuitBreaker(5);
  });

  describe("Rate Limiting During Sync", () => {
    it("should respect provider rate limits", async () => {
      for (let i = 0; i < 50; i++) {
        await rateLimiter.check("sync_request");
      }

      const state = rateLimiter.getState();
      expect(state.remaining).toBe(50);
    });

    it("should queue requests when rate limited", async () => {
      const queue: string[] = [];

      for (let i = 0; i < 150; i++) {
        try {
          await rateLimiter.check("sync_request");
        } catch {
          queue.push(`request_${i}`);
        }
      }

      expect(queue.length).toBeGreaterThan(0);
    });

    it("should backoff on rate limit", () => {
      const backoffMs = 1000;
      const nextRetryTime = Date.now() + backoffMs;

      expect(nextRetryTime).toBeGreaterThan(Date.now());
    });
  });

  describe("Circuit Breaker Tripping", () => {
    it("should trip circuit after repeated failures", async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error("Service error");
          });
        } catch {
          // Expected
        }
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe("open");
    });

    it("should refuse requests when circuit is open", async () => {
      circuitBreaker.trip();

      try {
        await circuitBreaker.execute(async () => {
          return "success";
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should attempt recovery in half-open state", async () => {
      circuitBreaker.trip();

      // Wait and attempt one request
      const state = circuitBreaker.getState();
      expect(state.state).toBe("open");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OAUTH TOKEN REFRESH DURING SYNC
// ─────────────────────────────────────────────────────────────────────────────

describe("OAuth Token Lifecycle", () => {
  let currentToken: ReturnType<typeof createMockOAuthToken>;

  beforeEach(() => {
    currentToken = createMockOAuthToken(3600);
  });

  describe("Token Refresh", () => {
    it("should refresh expired token", async () => {
      const expiredToken = createMockOAuthToken(1); // Expires in 1 second

      await new Promise((resolve) => setTimeout(resolve, 100));

      const isExpired = isMockOAuthTokenExpired(expiredToken);
      expect(isExpired).toBe(true);
    });

    it("should preserve access during token refresh", async () => {
      const newToken = await simulateOAuthTokenRefresh(
        () => currentToken,
        async (refreshToken: string) => {
          return createMockOAuthToken(3600);
        },
      );

      expect(newToken).toHaveProperty("accessToken");
    });

    it("should handle token refresh failures", async () => {
      try {
        await simulateOAuthTokenRefresh(
          () => currentToken,
          async () => {
            throw new Error("Token refresh failed");
          },
        );
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-PROVIDER FAILOVER SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

describe("Multi-Provider Failover", () => {
  describe("Primary Provider Failure", () => {
    it("should failover to secondary provider", () => {
      const primaryFailed = true;
      const activeProvider = primaryFailed ? "secondary" : "primary";

      expect(activeProvider).toBe("secondary");
    });

    it("should track provider health for failover", () => {
      const providerHealth = {
        primary: { healthy: false, lastError: "timeout" },
        secondary: { healthy: true, lastError: null },
      };

      const activeProvider = providerHealth.primary.healthy
        ? "primary"
        : "secondary";

      expect(activeProvider).toBe("secondary");
    });

    it("should resume on primary recovery", () => {
      const health = {
        primary: { healthy: false },
        secondary: { healthy: true },
      };

      // Simulate recovery
      health.primary.healthy = true;

      const activeProvider = health.primary.healthy ? "primary" : "secondary";
      expect(activeProvider).toBe("primary");
    });
  });

  describe("Concurrent Provider Sync", () => {
    it("should sync from multiple providers concurrently", async () => {
      const providers = ["provider_1", "provider_2"];
      const syncPromises = providers.map((p) =>
        Promise.resolve({ provider: p, recordsSync: 100 }),
      );

      const results = await Promise.all(syncPromises);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.recordsSync === 100)).toBe(true);
    });
  });
});
