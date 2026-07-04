/**
 * Integration tests for Witylogix SDK
 * Tests full request/response cycle with mock HTTP server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Witylogix } from "../src/index";
import type {
  Order,
  Driver,
  Zone,
  Shipment,
  PaginatedResponse,
} from "../src/types";

/**
 * Mock HTTP Server Implementation
 * Intercepts fetch calls and returns mock responses
 */
class MockHttpServer {
  private routes: Map<string, (params: any) => Response> = new Map();

  register(pattern: string, handler: (params: any) => Response) {
    this.routes.set(pattern, handler);
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const params = Object.fromEntries(url.searchParams);

    for (const [pattern, handler] of this.routes) {
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(path)) {
        return handler({ ...params, method: request.method });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}

describe("SDK Integration Tests", () => {
  let client: Witylogix;
  let mockServer: MockHttpServer;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    mockServer = new MockHttpServer();
    originalFetch = global.fetch;

    // Replace global fetch with mock
    global.fetch = vi.fn(async (url: string | Request, options?: any) => {
      const request = new Request(url, options);
      return mockServer.handle(request);
    });

    // Initialize client
    client = new Witylogix({
      baseUrl: "http://localhost:3001",
      apiKey: "test-key-123",
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  // =========================================================================
  // Orders Resource Tests
  // =========================================================================

  describe("Orders Resource", () => {
    it("should fetch all orders", async () => {
      const mockOrders: Order[] = [
        {
          id: "order-1",
          reference: "ORD-001",
          status: "pending",
          items: [],
          pickup: { address: "123 Main St", lat: 0, lng: 0 },
          delivery: { address: "456 Oak Ave", lat: 0, lng: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "order-2",
          reference: "ORD-002",
          status: "assigned",
          items: [],
          pickup: { address: "789 Pine Rd", lat: 0, lng: 0 },
          delivery: { address: "321 Elm St", lat: 0, lng: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockServer.register("/v1/orders", () => {
        return new Response(JSON.stringify(mockOrders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.orders.list();
      expect(result).toEqual(mockOrders);
    });

    it("should fetch a single order by ID", async () => {
      const mockOrder: Order = {
        id: "order-1",
        reference: "ORD-001",
        status: "delivered",
        items: [],
        pickup: { address: "123 Main St", lat: 0, lng: 0 },
        delivery: { address: "456 Oak Ave", lat: 0, lng: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockServer.register("/v1/orders/order-1", () => {
        return new Response(JSON.stringify(mockOrder), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.orders.get("order-1");
      expect(result).toEqual(mockOrder);
    });

    it("should create a new order", async () => {
      const createData = {
        reference: "ORD-003",
        pickup: { address: "100 New St", lat: 0, lng: 0 },
        delivery: { address: "200 New Ave", lat: 0, lng: 0 },
      };

      const mockResponse: Order = {
        id: "order-3",
        ...createData,
        status: "pending",
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockServer.register("/v1/orders", () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.orders.create(createData);
      expect(result).toEqual(mockResponse);
      expect(result.id).toBe("order-3");
    });

    it("should handle pagination with cursor", async () => {
      const mockPage1: PaginatedResponse<Order> = {
        data: [
          {
            id: "order-1",
            reference: "ORD-001",
            status: "pending",
            items: [],
            pickup: { address: "123 Main St", lat: 0, lng: 0 },
            delivery: { address: "456 Oak Ave", lat: 0, lng: 0 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        cursor: "next-page-token",
        hasMore: true,
      };

      mockServer.register("/v1/orders", (params: any) => {
        if (params.cursor === "next-page-token") {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "order-2",
                  reference: "ORD-002",
                  status: "assigned",
                  items: [],
                  pickup: { address: "789 Pine Rd", lat: 0, lng: 0 },
                  delivery: { address: "321 Elm St", lat: 0, lng: 0 },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
              cursor: null,
              hasMore: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify(mockPage1), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const page1 = await client.orders.list();
      expect(page1.data).toHaveLength(1);
      expect(page1.hasMore).toBe(true);
      expect(page1.cursor).toBe("next-page-token");

      const page2 = await client.orders.list({ cursor: page1.cursor });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });
  });

  // =========================================================================
  // Drivers Resource Tests
  // =========================================================================

  describe("Drivers Resource", () => {
    it("should fetch all drivers", async () => {
      const mockDrivers: Driver[] = [
        {
          id: "driver-1",
          name: "John Doe",
          status: "available",
          location: { lat: 0, lng: 0, timestamp: new Date().toISOString() },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockServer.register("/v1/drivers", () => {
        return new Response(JSON.stringify(mockDrivers), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.drivers.list();
      expect(result).toEqual(mockDrivers);
    });

    it("should get a single driver", async () => {
      const mockDriver: Driver = {
        id: "driver-1",
        name: "John Doe",
        status: "on-shift",
        location: {
          lat: 40.7128,
          lng: -74.006,
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockServer.register("/v1/drivers/driver-1", () => {
        return new Response(JSON.stringify(mockDriver), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.drivers.get("driver-1");
      expect(result).toEqual(mockDriver);
    });

    it("should update a driver", async () => {
      const updateData = { status: "offline" as const };
      const mockResponse: Driver = {
        id: "driver-1",
        name: "John Doe",
        status: "offline",
        location: { lat: 0, lng: 0, timestamp: new Date().toISOString() },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockServer.register("/v1/drivers/driver-1", () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.drivers.update("driver-1", updateData);
      expect(result.status).toBe("offline");
    });
  });

  // =========================================================================
  // Zones Resource Tests
  // =========================================================================

  describe("Zones Resource", () => {
    it("should fetch all zones", async () => {
      const mockZones: Zone[] = [
        {
          id: "zone-1",
          name: "Downtown",
          status: "active",
          vertices: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 0 },
            { lat: 1, lng: 1 },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockServer.register("/v1/zones", () => {
        return new Response(JSON.stringify(mockZones), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.zones.list();
      expect(result).toEqual(mockZones);
    });

    it("should check if location is in zone", async () => {
      mockServer.register("/v1/zones/check-point", () => {
        return new Response(JSON.stringify({ inside: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.zones.checkPoint(0.5, 0.5);
      expect(result.inside).toBe(true);
    });
  });

  // =========================================================================
  // Shipments Resource Tests
  // =========================================================================

  describe("Shipments Resource", () => {
    it("should fetch all shipments", async () => {
      const mockShipments: Shipment[] = [
        {
          id: "shipment-1",
          orderId: "order-1",
          status: "in-transit",
          driverId: "driver-1",
          tracking: {
            events: [
              {
                status: "picked-up",
                timestamp: new Date().toISOString(),
                location: { lat: 0, lng: 0 },
              },
            ],
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockServer.register("/v1/shipments", () => {
        return new Response(JSON.stringify(mockShipments), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.shipments.list();
      expect(result).toEqual(mockShipments);
    });

    it("should track a shipment", async () => {
      mockServer.register("/v1/shipments/shipment-1/tracking", () => {
        return new Response(
          JSON.stringify({
            status: "in-transit",
            events: [
              {
                status: "picked-up",
                timestamp: new Date().toISOString(),
                location: { lat: 0, lng: 0 },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      });

      const result = await client.shipments.getTracking("shipment-1");
      expect(result.status).toBe("in-transit");
      expect(result.events).toHaveLength(1);
    });
  });

  // =========================================================================
  // Error Handling Tests
  // =========================================================================

  describe("Error Handling", () => {
    it("should handle 400 Bad Request errors", async () => {
      mockServer.register("/v1/orders", () => {
        return new Response(
          JSON.stringify({
            error: "Invalid request",
            message: "Missing required field: reference",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      });

      try {
        await client.orders.list();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.status).toBe(400);
        expect(error.message).toContain("Missing required field");
      }
    });

    it("should handle 500 Server errors", async () => {
      mockServer.register("/v1/drivers", () => {
        return new Response(
          JSON.stringify({
            error: "Internal Server Error",
            message: "Database connection failed",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      });

      try {
        await client.drivers.list();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.status).toBe(500);
        expect(error.message).toContain("Database connection failed");
      }
    });

    it("should handle 429 Rate Limit with retry", async () => {
      let callCount = 0;

      mockServer.register("/v1/zones", () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Too Many Requests" }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "1",
            },
          });
        }
        // Second call succeeds
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      // Create client with retry enabled
      const retryClient = new Witylogix({
        baseUrl: "http://localhost:3001",
        apiKey: "test-key-123",
        retryAttempts: 2,
      });

      const result = await retryClient.zones.list();
      expect(callCount).toBeGreaterThan(1);
      expect(result).toEqual([]);
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn(async () => {
        throw new TypeError("Network request failed");
      });

      try {
        await client.shipments.list();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toContain("Network");
      }
    });
  });

  // =========================================================================
  // Request Options Tests
  // =========================================================================

  describe("Request Options", () => {
    it("should apply custom headers", async () => {
      let receivedHeaders: Record<string, string> = {};

      const mockFetchSpy = vi.fn(async (_url: string, options?: any) => {
        receivedHeaders = options.headers;
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      global.fetch = mockFetchSpy;

      // Use client.get directly since resource methods don't expose headers option
      await client.get("/v1/orders", undefined, {
        headers: { "X-Custom-Header": "custom-value" },
      });

      expect(receivedHeaders["X-Custom-Header"]).toBe("custom-value");
    });

    it("should respect custom timeout", async () => {
      const timeoutClient = new Witylogix({
        baseUrl: "http://localhost:3001",
        apiKey: "test-key-123",
        timeout: 5000,
      });

      mockServer.register("/v1/orders", () => {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await timeoutClient.orders.list();
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // Authentication Tests
  // =========================================================================

  describe("Authentication", () => {
    it("should use API key authentication header", async () => {
      let receivedHeaders: Record<string, string> = {};

      const mockFetchSpy = vi.fn(async (url: string, options?: any) => {
        receivedHeaders = options.headers;
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      global.fetch = mockFetchSpy;

      const apiKeyClient = new Witylogix({
        baseUrl: "http://localhost:3001",
        apiKey: "my-api-key",
      });

      await apiKeyClient.orders.list();
      expect(receivedHeaders["X-API-Key"]).toBe("my-api-key");
    });

    it("should use Bearer token authentication header", async () => {
      let receivedHeaders: Record<string, string> = {};

      const mockFetchSpy = vi.fn(async (url: string, options?: any) => {
        receivedHeaders = options.headers;
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      global.fetch = mockFetchSpy;

      const tokenClient = new Witylogix({
        baseUrl: "http://localhost:3001",
        accessToken: "my-access-token",
      });

      await tokenClient.orders.list();
      expect(receivedHeaders["Authorization"]).toBe("Bearer my-access-token");
    });
  });
});
