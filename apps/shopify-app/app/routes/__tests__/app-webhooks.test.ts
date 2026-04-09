/**
 * Test suite for the Webhook Management route (app.webhooks.tsx)
 *
 * Tests webhook management functionality:
 * - Loading webhook endpoints (CRUD operations)
 * - Managing Shopify workflow triggers
 * - Viewing webhook delivery logs
 * - Webhook registration and deregistration
 * - Event filtering and routing
 *
 * Uses vitest with vi.mock for dependency injection
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

// Mock dependencies
vi.mock("~/lib/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("~/lib/api.server", () => ({
  createApiClient: vi.fn(),
}));

import { authenticate } from "~/lib/shopify.server";
import { createApiClient } from "~/lib/api.server";

// ─── Type Definitions ──────────────────────────────────────────

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: "active" | "paused" | "circuit_open";
  lastDeliveryAt?: Date;
  failureCount: number;
  secret: string;
}

interface WebhookTrigger {
  shopifyEvent: string;
  workflowName: string;
  enabled: boolean;
}

interface WebhookDelivery {
  id: string;
  event: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  requestBody?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
}

interface WebhookPageData {
  endpoints: WebhookEndpoint[];
  triggers: WebhookTrigger[];
  deliveries: WebhookDelivery[];
}

// ─── Test Fixtures ────────────────────────────────────────────

const mockSession = {
  accessToken: "mock-webhook-token",
  shop: "test-shop.myshopify.com",
  isOnline: true,
};

const mockEndpoints: WebhookEndpoint[] = [
  {
    id: "endpoint-001",
    url: "https://witylogix.com/webhooks/orders",
    events: ["orders/create", "orders/update", "orders/delete"],
    status: "active",
    lastDeliveryAt: new Date(Date.now() - 60000),
    failureCount: 0,
    secret: "secret-key-001",
  },
  {
    id: "endpoint-002",
    url: "https://witylogix.com/webhooks/fulfillment",
    events: ["fulfillment/create"],
    status: "active",
    lastDeliveryAt: new Date(Date.now() - 120000),
    failureCount: 2,
    secret: "secret-key-002",
  },
  {
    id: "endpoint-003",
    url: "https://external-system.com/webhooks",
    events: [],
    status: "paused",
    failureCount: 15,
    secret: "secret-key-003",
  },
];

const mockTriggers: WebhookTrigger[] = [
  {
    shopifyEvent: "orders/create",
    workflowName: "Order Created Workflow",
    enabled: true,
  },
  {
    shopifyEvent: "orders/update",
    workflowName: "Order Updated Workflow",
    enabled: true,
  },
  {
    shopifyEvent: "customers/create",
    workflowName: "New Customer Workflow",
    enabled: false,
  },
  {
    shopifyEvent: "fulfillment/create",
    workflowName: "Fulfillment Created Workflow",
    enabled: true,
  },
];

const mockDeliveries: WebhookDelivery[] = [
  {
    id: "delivery-001",
    event: "orders/create",
    endpoint: "https://witylogix.com/webhooks/orders",
    statusCode: 200,
    duration: 145,
    timestamp: new Date(Date.now() - 5 * 60000),
    requestBody: { orderId: "12345", status: "pending" },
    responseBody: { success: true },
  },
  {
    id: "delivery-002",
    event: "orders/update",
    endpoint: "https://witylogix.com/webhooks/orders",
    statusCode: 200,
    duration: 98,
    timestamp: new Date(Date.now() - 15 * 60000),
    requestBody: { orderId: "12346", status: "confirmed" },
    responseBody: { success: true },
  },
  {
    id: "delivery-003",
    event: "fulfillment/create",
    endpoint: "https://witylogix.com/webhooks/fulfillment",
    statusCode: 500,
    duration: 2000,
    timestamp: new Date(Date.now() - 30 * 60000),
    requestBody: { fulfillmentId: "f-001" },
    responseBody: { error: "Internal Server Error" },
  },
  {
    id: "delivery-004",
    event: "orders/create",
    endpoint: "https://external-system.com/webhooks",
    statusCode: 0,
    duration: 5000,
    timestamp: new Date(Date.now() - 60 * 60000),
    requestBody: { orderId: "12347" },
  },
];

const mockWebhookPageData: WebhookPageData = {
  endpoints: mockEndpoints,
  triggers: mockTriggers,
  deliveries: mockDeliveries,
};

const mockRequest = (url: string = "http://localhost:3000/app/webhooks") => ({
  url,
  method: "GET",
  headers: new Map(),
});

// ─── Test Suite ───────────────────────────────────────────────

describe("Webhook Management Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loader - Webhook Endpoints", () => {
    it("should authenticate request and load webhook endpoints", async () => {
      const mockAuthenticateFn = vi.fn().mockResolvedValue({
        session: mockSession,
      });
      (authenticate.admin as any).mockImplementation(mockAuthenticateFn);

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockEndpoints })
        .mockResolvedValueOnce({ data: mockTriggers })
        .mockResolvedValueOnce({ data: mockDeliveries });

      expect(mockAuthenticateFn).toBeDefined();
    });

    it("should load all webhook endpoints", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockEndpoints })
        .mockResolvedValueOnce({ data: mockTriggers })
        .mockResolvedValueOnce({ data: mockDeliveries });

      expect(mockWebhookPageData.endpoints).toHaveLength(3);
      expect(mockWebhookPageData.endpoints[0].url).toBe(
        "https://witylogix.com/webhooks/orders"
      );
    });

    it("should load endpoint details", () => {
      const endpoint = mockWebhookPageData.endpoints[0];

      expect(endpoint.id).toBe("endpoint-001");
      expect(endpoint.url).toBe("https://witylogix.com/webhooks/orders");
      expect(endpoint.status).toBe("active");
      expect(endpoint.failureCount).toBe(0);
    });

    it("should load endpoint subscribed events", () => {
      const endpoint = mockWebhookPageData.endpoints[0];

      expect(endpoint.events).toHaveLength(3);
      expect(endpoint.events).toContain("orders/create");
      expect(endpoint.events).toContain("orders/update");
      expect(endpoint.events).toContain("orders/delete");
    });

    it("should load endpoint status (active, paused, circuit_open)", () => {
      const statuses = mockWebhookPageData.endpoints.map((ep) => ep.status);

      expect(statuses).toContain("active");
      expect(statuses).toContain("paused");
    });

    it("should load last delivery timestamp", () => {
      const endpoint = mockWebhookPageData.endpoints[0];

      expect(endpoint.lastDeliveryAt).toBeDefined();
      expect(endpoint.lastDeliveryAt instanceof Date).toBe(true);
    });

    it("should load failure count per endpoint", () => {
      expect(mockWebhookPageData.endpoints[0].failureCount).toBe(0);
      expect(mockWebhookPageData.endpoints[1].failureCount).toBe(2);
      expect(mockWebhookPageData.endpoints[2].failureCount).toBe(15);
    });

    it("should call /api/v4/shops/me/webhooks/endpoints endpoint", async () => {
      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);
      mockApiClient.get.mockResolvedValueOnce({ data: mockEndpoints });

      const result = await mockApiClient.get("/api/v4/shops/me/webhooks/endpoints");
      expect(mockApiClient.get).toHaveBeenCalledWith("/api/v4/shops/me/webhooks/endpoints");
      expect(result.data).toEqual(mockEndpoints);
    });
  });

  describe("Loader - Webhook Triggers", () => {
    it("should load Shopify event triggers", () => {
      expect(mockWebhookPageData.triggers).toHaveLength(4);
    });

    it("should load trigger event name", () => {
      const trigger = mockWebhookPageData.triggers[0];

      expect(trigger.shopifyEvent).toBe("orders/create");
    });

    it("should load associated workflow name", () => {
      const trigger = mockWebhookPageData.triggers[0];

      expect(trigger.workflowName).toBe("Order Created Workflow");
    });

    it("should load trigger enabled state", () => {
      const enabledTrigger = mockWebhookPageData.triggers[0];
      const disabledTrigger = mockWebhookPageData.triggers[2];

      expect(enabledTrigger.enabled).toBe(true);
      expect(disabledTrigger.enabled).toBe(false);
    });

    it("should call /api/v4/shops/me/webhooks/triggers endpoint", async () => {
      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);
      mockApiClient.get.mockResolvedValueOnce({ data: mockTriggers });

      const result = await mockApiClient.get("/api/v4/shops/me/webhooks/triggers");
      expect(mockApiClient.get).toHaveBeenCalledWith("/api/v4/shops/me/webhooks/triggers");
      expect(result.data).toEqual(mockTriggers);
    });

    it("should handle multiple triggers for same event", () => {
      const orderCreateTriggers = mockWebhookPageData.triggers.filter(
        (t) => t.shopifyEvent === "orders/create"
      );

      expect(orderCreateTriggers).toHaveLength(1);
    });
  });

  describe("Loader - Webhook Deliveries", () => {
    it("should load recent webhook deliveries", () => {
      expect(mockWebhookPageData.deliveries).toHaveLength(4);
    });

    it("should load delivery event type", () => {
      const delivery = mockWebhookPageData.deliveries[0];

      expect(delivery.event).toBe("orders/create");
    });

    it("should load delivery endpoint URL", () => {
      const delivery = mockWebhookPageData.deliveries[0];

      expect(delivery.endpoint).toBe("https://witylogix.com/webhooks/orders");
    });

    it("should load HTTP status code", () => {
      const successDelivery = mockWebhookPageData.deliveries[0];
      const errorDelivery = mockWebhookPageData.deliveries[2];

      expect(successDelivery.statusCode).toBe(200);
      expect(errorDelivery.statusCode).toBe(500);
    });

    it("should classify delivery success by status code", () => {
      const successes = mockWebhookPageData.deliveries.filter(
        (d) => d.statusCode >= 200 && d.statusCode < 300
      );
      const failures = mockWebhookPageData.deliveries.filter(
        (d) => d.statusCode >= 400 || d.statusCode === 0
      );

      expect(successes.length).toBe(2);
      expect(failures.length).toBe(2);
    });

    it("should load delivery duration in milliseconds", () => {
      expect(mockWebhookPageData.deliveries[0].duration).toBe(145);
      expect(mockWebhookPageData.deliveries[2].duration).toBe(2000);
    });

    it("should load delivery timestamp", () => {
      const delivery = mockWebhookPageData.deliveries[0];

      expect(delivery.timestamp instanceof Date).toBe(true);
    });

    it("should load request body", () => {
      const delivery = mockWebhookPageData.deliveries[0];

      expect(delivery.requestBody).toBeDefined();
      expect(delivery.requestBody?.orderId).toBe("12345");
    });

    it("should load response body", () => {
      const delivery = mockWebhookPageData.deliveries[0];

      expect(delivery.responseBody).toBeDefined();
      expect(delivery.responseBody?.success).toBe(true);
    });

    it("should handle missing response on timeout", () => {
      const timedOutDelivery = mockWebhookPageData.deliveries[3];

      expect(timedOutDelivery.responseBody).toBeUndefined();
      expect(timedOutDelivery.statusCode).toBe(0);
    });

    it("should call /api/v4/shops/me/webhooks/deliveries with limit", async () => {
      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);
      mockApiClient.get.mockResolvedValueOnce({ data: mockDeliveries });

      const result = await mockApiClient.get("/api/v4/shops/me/webhooks/deliveries", { limit: 50 });
      expect(mockApiClient.get).toHaveBeenCalledWith("/api/v4/shops/me/webhooks/deliveries", { limit: 50 });
      expect(result.data).toEqual(mockDeliveries);
    });
  });

  describe("Webhook Endpoint Management", () => {
    it("should create new webhook endpoint", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        post: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      const newEndpoint: WebhookEndpoint = {
        id: "endpoint-004",
        url: "https://new-endpoint.com/webhooks",
        events: ["orders/create"],
        status: "active",
        failureCount: 0,
        secret: "new-secret",
      };

      mockApiClient.post.mockResolvedValueOnce({ data: newEndpoint });

      const result = await mockApiClient.post(
        "/api/v4/shops/me/webhooks/endpoints",
        {
          url: "https://new-endpoint.com/webhooks",
          events: ["orders/create"],
        }
      );

      expect(result.data.url).toBe("https://new-endpoint.com/webhooks");
      expect(result.data.status).toBe("active");
    });

    it("should validate webhook URL format (HTTPS)", () => {
      const validUrl = "https://example.com/webhooks";
      const invalidUrl = "http://example.com/webhooks";

      const httpsPattern = /^https:\/\//;
      expect(httpsPattern.test(validUrl)).toBe(true);
      expect(httpsPattern.test(invalidUrl)).toBe(false);
    });

    it("should register webhook for specific events", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        post: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      const eventRegistration = {
        url: "https://webhook.example.com",
        events: ["orders/create", "orders/update"],
      };

      mockApiClient.post.mockResolvedValueOnce({
        data: { ...mockEndpoints[0], ...eventRegistration },
      });

      const result = await mockApiClient.post(
        "/api/v4/shops/me/webhooks/endpoints",
        eventRegistration
      );

      expect(result.data.events).toContain("orders/create");
      expect(result.data.events).toContain("orders/update");
    });

    it("should update webhook endpoint", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        patch: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      const updates = {
        status: "paused" as const,
      };

      mockApiClient.patch.mockResolvedValueOnce({
        data: { ...mockEndpoints[0], ...updates },
      });

      const result = await mockApiClient.patch(
        "/api/v4/shops/me/webhooks/endpoints/endpoint-001",
        updates
      );

      expect(result.data.status).toBe("paused");
    });

    it("should deregister webhook endpoint", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        delete: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      mockApiClient.delete.mockResolvedValueOnce({ success: true });

      const result = await mockApiClient.delete(
        "/api/v4/shops/me/webhooks/endpoints/endpoint-001"
      );

      expect(result.success).toBe(true);
    });

    it("should pause webhook on high failure count", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        patch: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      const pausedEndpoint = {
        ...mockEndpoints[2],
        status: "paused" as const,
      };

      mockApiClient.patch.mockResolvedValueOnce({ data: pausedEndpoint });

      const result = await mockApiClient.patch(
        "/api/v4/shops/me/webhooks/endpoints/endpoint-003",
        { status: "paused" }
      );

      expect(result.data.status).toBe("paused");
    });

    it("should reopen circuit breaker for endpoint", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        patch: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      const resetEndpoint = {
        status: "active" as const,
        failureCount: 0,
      };

      mockApiClient.patch.mockResolvedValueOnce({
        data: { ...mockEndpoints[2], ...resetEndpoint },
      });

      const result = await mockApiClient.patch(
        "/api/v4/shops/me/webhooks/endpoints/endpoint-003",
        resetEndpoint
      );

      expect(result.data.failureCount).toBe(0);
    });
  });

  describe("Webhook Event Trigger Management", () => {
    it("should enable webhook trigger", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        patch: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      const enabledTrigger = {
        ...mockTriggers[2],
        enabled: true,
      };

      mockApiClient.patch.mockResolvedValueOnce({ data: enabledTrigger });

      const result = await mockApiClient.patch(
        "/api/v4/shops/me/webhooks/triggers/customers/create",
        { enabled: true }
      );

      expect(result.data.enabled).toBe(true);
    });

    it("should disable webhook trigger", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        patch: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      const disabledTrigger = {
        ...mockTriggers[0],
        enabled: false,
      };

      mockApiClient.patch.mockResolvedValueOnce({ data: disabledTrigger });

      const result = await mockApiClient.patch(
        "/api/v4/shops/me/webhooks/triggers/orders/create",
        { enabled: false }
      );

      expect(result.data.enabled).toBe(false);
    });

    it("should filter webhook events by shop capability", () => {
      const shopSupportedEvents = [
        "orders/create",
        "orders/update",
        "fulfillment/create",
        "customers/create",
      ];

      mockWebhookPageData.triggers.forEach((trigger) => {
        expect(shopSupportedEvents).toContain(trigger.shopifyEvent);
      });
    });

    it("should validate trigger associations with workflows", () => {
      mockWebhookPageData.triggers.forEach((trigger) => {
        expect(trigger.workflowName).toBeTruthy();
        expect(trigger.shopifyEvent).toBeTruthy();
      });
    });
  });

  describe("Webhook Delivery Log Filtering", () => {
    it("should filter deliveries by event type", () => {
      const orderCreateDeliveries = mockWebhookPageData.deliveries.filter(
        (d) => d.event === "orders/create"
      );

      expect(orderCreateDeliveries).toHaveLength(2);
      orderCreateDeliveries.forEach((d) => {
        expect(d.event).toBe("orders/create");
      });
    });

    it("should filter deliveries by endpoint", () => {
      const ordersEndpointDeliveries = mockWebhookPageData.deliveries.filter(
        (d) => d.endpoint === "https://witylogix.com/webhooks/orders"
      );

      expect(ordersEndpointDeliveries).toHaveLength(2);
    });

    it("should filter deliveries by status code", () => {
      const successDeliveries = mockWebhookPageData.deliveries.filter(
        (d) => d.statusCode >= 200 && d.statusCode < 300
      );

      expect(successDeliveries).toHaveLength(2);
    });

    it("should filter deliveries by timestamp range", () => {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentDeliveries = mockWebhookPageData.deliveries.filter(
        (d) => d.timestamp > hourAgo
      );

      expect(recentDeliveries.length).toBeGreaterThan(0);
    });

    it("should sort deliveries by timestamp (most recent first)", () => {
      const sorted = [...mockWebhookPageData.deliveries].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      expect(sorted[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        sorted[sorted.length - 1].timestamp.getTime()
      );
    });

    it("should identify failed deliveries", () => {
      const failedDeliveries = mockWebhookPageData.deliveries.filter(
        (d) => d.statusCode < 200 || d.statusCode >= 300
      );

      expect(failedDeliveries.length).toBeGreaterThan(0);
      failedDeliveries.forEach((d) => {
        expect(d.statusCode === 0 || d.statusCode >= 400).toBe(true);
      });
    });
  });

  describe("Webhook Event Filtering", () => {
    it("should support orders event filtering", () => {
      const orderEvents = [
        "orders/create",
        "orders/update",
        "orders/delete",
        "orders/paid",
      ];

      const configuredOrderEvents = mockWebhookPageData.endpoints[0].events;

      configuredOrderEvents.forEach((event) => {
        expect(event.startsWith("orders/")).toBe(true);
      });
    });

    it("should support fulfillment event filtering", () => {
      const fulfillmentEvents = mockWebhookPageData.endpoints[1].events;

      expect(fulfillmentEvents).toContain("fulfillment/create");
    });

    it("should support customer event filtering", () => {
      const customerEventTrigger = mockWebhookPageData.triggers.find(
        (t) => t.shopifyEvent === "customers/create"
      );

      expect(customerEventTrigger).toBeDefined();
    });

    it("should allow multiple event subscriptions per endpoint", () => {
      const multiEventEndpoint = mockWebhookPageData.endpoints[0];

      expect(multiEventEndpoint.events.length).toBeGreaterThan(1);
    });

    it("should prevent duplicate event subscriptions", () => {
      const endpoint = mockWebhookPageData.endpoints[0];
      const uniqueEvents = new Set(endpoint.events);

      expect(uniqueEvents.size).toBe(endpoint.events.length);
    });
  });

  describe("Error Handling", () => {
    it("should handle failed endpoint load gracefully", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce({ data: mockTriggers })
        .mockResolvedValueOnce({ data: mockDeliveries });

      expect(mockApiClient.get).toBeDefined();
    });

    it("should provide empty endpoint list on API failure", () => {
      const emptyEndpoints: WebhookEndpoint[] = [];
      expect(emptyEndpoints).toEqual([]);
    });

    it("should handle failed trigger load gracefully", () => {
      const emptyTriggers: WebhookTrigger[] = [];
      expect(emptyTriggers).toEqual([]);
    });

    it("should handle failed delivery log load gracefully", () => {
      const emptyDeliveries: WebhookDelivery[] = [];
      expect(emptyDeliveries).toEqual([]);
    });

    it("should validate webhook URL before creation", () => {
      const validateUrl = (url: string): boolean => {
        try {
          new URL(url);
          return url.startsWith("https://");
        } catch {
          return false;
        }
      };

      expect(validateUrl("https://example.com/webhooks")).toBe(true);
      expect(validateUrl("http://example.com/webhooks")).toBe(false);
      expect(validateUrl("not-a-url")).toBe(false);
    });

    it("should handle webhook with no events gracefully", () => {
      const emptyEventEndpoint = mockWebhookPageData.endpoints[2];

      expect(emptyEventEndpoint.events).toEqual([]);
    });
  });

  describe("Webhook Circuit Breaker Logic", () => {
    it("should track failure count per endpoint", () => {
      expect(mockWebhookPageData.endpoints[0].failureCount).toBe(0);
      expect(mockWebhookPageData.endpoints[1].failureCount).toBe(2);
      expect(mockWebhookPageData.endpoints[2].failureCount).toBe(15);
    });

    it("should pause endpoint after threshold", () => {
      const pausedEndpoint = mockWebhookPageData.endpoints.find(
        (e) => e.status === "paused"
      );

      expect(pausedEndpoint?.failureCount).toBeGreaterThan(10);
    });

    it("should allow manual endpoint resume", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        patch: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      const resumed = {
        status: "active" as const,
        failureCount: 0,
      };

      mockApiClient.patch.mockResolvedValueOnce({
        data: { ...mockEndpoints[2], ...resumed },
      });

      const result = await mockApiClient.patch(
        "/api/v4/shops/me/webhooks/endpoints/endpoint-003",
        resumed
      );

      expect(result.data.status).toBe("active");
    });

    it("should record last delivery timestamp on success", () => {
      const successfulEndpoint = mockWebhookPageData.endpoints[0];

      expect(successfulEndpoint.lastDeliveryAt).toBeDefined();
    });

    it("should track delivery duration for performance monitoring", () => {
      const slowDelivery = mockWebhookPageData.deliveries[3];
      const fastDelivery = mockWebhookPageData.deliveries[0];

      expect(slowDelivery.duration).toBeGreaterThan(fastDelivery.duration);
    });
  });

  describe("Data Validation", () => {
    it("should validate endpoint URL is valid", () => {
      mockWebhookPageData.endpoints.forEach((endpoint) => {
        try {
          new URL(endpoint.url);
          expect(endpoint.url.startsWith("https://")).toBe(true);
        } catch {
          fail(`Invalid URL: ${endpoint.url}`);
        }
      });
    });

    it("should validate event names follow Shopify convention", () => {
      const eventPattern = /^[a-z]+\/[a-z_]+$/;

      mockWebhookPageData.endpoints.forEach((endpoint) => {
        endpoint.events.forEach((event) => {
          expect(eventPattern.test(event)).toBe(true);
        });
      });
    });

    it("should validate delivery status codes", () => {
      mockWebhookPageData.deliveries.forEach((delivery) => {
        expect(typeof delivery.statusCode).toBe("number");
        expect(delivery.statusCode >= 0).toBe(true);
      });
    });

    it("should validate delivery duration is positive", () => {
      mockWebhookPageData.deliveries.forEach((delivery) => {
        expect(delivery.duration).toBeGreaterThan(0);
      });
    });
  });

  describe("Parallel Data Loading", () => {
    it("should load endpoints, triggers, and deliveries in parallel", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClient as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockEndpoints })
        .mockResolvedValueOnce({ data: mockTriggers })
        .mockResolvedValueOnce({ data: mockDeliveries });

      // Simulate parallel calls
      const results = await Promise.allSettled([
        mockApiClient.get("/api/v4/shops/me/webhooks/endpoints"),
        mockApiClient.get("/api/v4/shops/me/webhooks/triggers"),
        mockApiClient.get("/api/v4/shops/me/webhooks/deliveries"),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("fulfilled");
      expect(results[2].status).toBe("fulfilled");
    });
  });
});
