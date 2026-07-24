/**
 * WooCommerce Client Tests
 * Tests OAuth 1.0a signature generation, HTTP methods, rate limiting, retries, and timeout handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import type { WCClientConfig } from "../../../packages/core/src/integrations/woocommerce/types.js";
import {
  WooCommerceClient,
  createWooCommerceClient,
} from "../../../packages/core/src/integrations/woocommerce/wc-client.js";

// Mock global fetch
global.fetch = vi.fn();

describe("WooCommerceClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: WooCommerceClient;

  const mockConfig: WCClientConfig = {
    storeUrl: "https://example.com",
    consumerKey: "ck_test123",
    consumerSecret: "cs_test456",
    version: "wc/v3",
    timeout: 5000,
    rateLimit: 10,
    retries: 3,
  };

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
    client = createWooCommerceClient(mockConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("OAuth 1.0a Signature Generation", () => {
    it("should generate valid OAuth 1.0a header with required parameters", async () => {
      const mockResponse = new Response(
        JSON.stringify({ id: 1, status: "processing" }),
        {
          status: 200,
        },
      );
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/1");

      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      const headers = call[1]?.headers as Record<string, string>;

      expect(headers.Authorization).toMatch(/^OAuth /);
      expect(headers.Authorization).toContain("oauth_consumer_key");
      expect(headers.Authorization).toContain("oauth_nonce");
      expect(headers.Authorization).toContain("oauth_signature_method");
      expect(headers.Authorization).toContain("oauth_timestamp");
      expect(headers.Authorization).toContain("oauth_version");
      expect(headers.Authorization).toContain("oauth_signature");
    });

    it("should use HMAC-SHA256 signature method", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/1");

      const headers = mockFetch.mock.calls[0][1]?.headers as Record<
        string,
        string
      >;
      expect(headers.Authorization).toContain(
        'oauth_signature_method="HMAC-SHA256"',
      );
    });

    it("should generate unique nonce for each request", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/1");
      const firstNonce = extractOAuthParam(
        (mockFetch.mock.calls[0][1]?.headers as Record<string, string>)
          .Authorization,
        "oauth_nonce",
      );

      mockFetch.mockClear();
      await client.get("/orders/2");
      const secondNonce = extractOAuthParam(
        (mockFetch.mock.calls[0][1]?.headers as Record<string, string>)
          .Authorization,
        "oauth_nonce",
      );

      expect(firstNonce).not.toBe(secondNonce);
    });

    it("should generate incremental timestamps", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/1");
      const firstTimestamp = extractOAuthParam(
        (mockFetch.mock.calls[0][1]?.headers as Record<string, string>)
          .Authorization,
        "oauth_timestamp",
      );

      mockFetch.mockClear();
      vi.advanceTimersByTime(1000);

      await client.get("/orders/2");
      const secondTimestamp = extractOAuthParam(
        (mockFetch.mock.calls[0][1]?.headers as Record<string, string>)
          .Authorization,
        "oauth_timestamp",
      );

      expect(parseInt(secondTimestamp)).toBeGreaterThan(
        parseInt(firstTimestamp),
      );
    });

    it("should include consumer key in signature", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/1");

      const auth = (
        mockFetch.mock.calls[0][1]?.headers as Record<string, string>
      ).Authorization;
      expect(auth).toContain(`oauth_consumer_key="${mockConfig.consumerKey}"`);
    });

    it("should use OAuth 1.0 version", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/1");

      const auth = (
        mockFetch.mock.calls[0][1]?.headers as Record<string, string>
      ).Authorization;
      expect(auth).toContain('oauth_version="1.0"');
    });
  });

  describe("HTTP Methods", () => {
    it("should send GET request with correct method and headers", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/1");

      const [url, options] = mockFetch.mock.calls[0];
      expect(options?.method).toBe("GET");
      expect(options?.headers?.["Content-Type"]).toBe("application/json");
      expect((options?.headers as Record<string, string>)["User-Agent"]).toBe(
        "Witylogix/1.0",
      );
    });

    it("should send POST request with body", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const orderData = {
        status: "processing",
        customer_note: "Test order",
      };

      await client.post("/orders", orderData);

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.method).toBe("POST");
      expect(options?.body).toBe(JSON.stringify(orderData));
      expect(options?.headers?.["Content-Type"]).toBe("application/json");
    });

    it("should send PUT request with body", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const updateData = { status: "completed" };

      await client.put("/orders/1", updateData);

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.method).toBe("PUT");
      expect(options?.body).toBe(JSON.stringify(updateData));
    });

    it("should send DELETE request", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.delete("/orders/1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.method).toBe("DELETE");
    });

    it("should set correct URL with endpoint", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/123");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/wp-json/wc/v3/orders/123");
    });

    it("should build URL with query parameters", async () => {
      const mockResponse = new Response(JSON.stringify([]), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders", {
        page: 2,
        perPage: 50,
        orderby: "date",
        order: "desc",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("page=2");
      expect(url).toContain("per_page=50");
      expect(url).toContain("orderby=date");
      expect(url).toContain("order=desc");
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limit between requests", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const rateLimitedClient = createWooCommerceClient({
        ...mockConfig,
        rateLimit: 2, // 2 requests per second
      });

      const startTime = Date.now();
      await rateLimitedClient.get("/orders/1");
      await rateLimitedClient.get("/orders/2");
      await rateLimitedClient.get("/orders/3");

      const elapsed = Date.now() - startTime;
      // With rate limit of 2/sec, 3 requests should take at least 500ms
      expect(elapsed).toBeGreaterThanOrEqual(400);
    });

    it("should delay requests when hitting rate limit", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const rateLimitedClient = createWooCommerceClient({
        ...mockConfig,
        rateLimit: 1, // 1 request per second
      });

      const startTime = Date.now();
      await rateLimitedClient.get("/orders/1");
      await rateLimitedClient.get("/orders/2");

      const elapsed = Date.now() - startTime;
      // With rate limit of 1/sec, 2 requests should take at least ~1000ms
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });

    it("should include verify User-Agent header", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders/1");

      const headers = mockFetch.mock.calls[0][1]?.headers as Record<
        string,
        string
      >;
      expect(headers["User-Agent"]).toBe("Witylogix/1.0");
    });
  });

  describe("Retry Logic", () => {
    it("should retry on 429 (rate limited) status with exponential backoff", async () => {
      const mockResponse429 = new Response(
        JSON.stringify({ code: "woocommerce_rest_rate_limit" }),
        { status: 429 },
      );
      const mockResponseOK = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });

      mockFetch
        .mockResolvedValueOnce(mockResponse429)
        .mockResolvedValueOnce(mockResponseOK);

      const result = await client.get("/orders/1");

      expect(result).toEqual({ id: 1 });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on 500 (server error) status", async () => {
      const mockResponse500 = new Response(
        JSON.stringify({ code: "woocommerce_rest_invalid_param" }),
        { status: 500 },
      );
      const mockResponseOK = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });

      mockFetch
        .mockResolvedValueOnce(mockResponse500)
        .mockResolvedValueOnce(mockResponseOK);

      const result = await client.get("/orders/1");

      expect(result).toEqual({ id: 1 });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should use exponential backoff for retries", async () => {
      const mockResponse500 = new Response(JSON.stringify({ code: "error" }), {
        status: 500,
      });
      const mockResponseOK = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });

      mockFetch
        .mockResolvedValueOnce(mockResponse500)
        .mockResolvedValueOnce(mockResponse500)
        .mockResolvedValueOnce(mockResponseOK);

      const startTime = Date.now();
      await client.get("/orders/1");
      const elapsed = Date.now() - startTime;

      // Backoff: 1st retry 1000ms, 2nd retry 2000ms = 3000ms
      expect(elapsed).toBeGreaterThanOrEqual(2900);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should throw error after max retries exceeded", async () => {
      const mockResponse500 = new Response(JSON.stringify({ code: "error" }), {
        status: 500,
      });

      mockFetch.mockResolvedValue(mockResponse500);

      await expect(client.get("/orders/1")).rejects.toThrow();
      // Initial + 3 retries
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("should not retry on 4xx errors except 429", async () => {
      const mockResponse400 = new Response(
        JSON.stringify({
          code: "woocommerce_rest_invalid_param",
          message: "Bad request",
        }),
        { status: 400 },
      );

      mockFetch.mockResolvedValue(mockResponse400);

      await expect(client.get("/orders/invalid")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on network errors", async () => {
      const networkError = new Error("Network timeout");

      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1 }), { status: 200 }),
        );

      const result = await client.get("/orders/1");

      expect(result).toEqual({ id: 1 });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Timeout Handling", () => {
    it("should pass timeout configuration to fetch", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const timeoutClient = createWooCommerceClient({
        ...mockConfig,
        timeout: 15000,
      });

      await timeoutClient.get("/orders/1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.timeout).toBe(15000);
    });

    it("should use default timeout of 30 seconds", async () => {
      const mockResponse = new Response(JSON.stringify({ id: 1 }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const defaultClient = createWooCommerceClient({
        storeUrl: "https://example.com",
        consumerKey: "key",
        consumerSecret: "secret",
      });

      await defaultClient.get("/orders/1");

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.timeout).toBe(30000);
    });
  });

  describe("Pagination Helpers", () => {
    it("should build pagination query with page and perPage", async () => {
      const mockResponse = new Response(JSON.stringify([]), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders", { page: 3, perPage: 25 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("page=3");
      expect(url).toContain("per_page=25");
    });

    it("should support offset-based pagination", async () => {
      const mockResponse = new Response(JSON.stringify([]), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders", { offset: 100, perPage: 50 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("offset=100");
      expect(url).toContain("per_page=50");
    });

    it("should support sorting parameters", async () => {
      const mockResponse = new Response(JSON.stringify([]), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders", {
        page: 1,
        perPage: 10,
        orderby: "date_created",
        order: "asc",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("orderby=date_created");
      expect(url).toContain("order=asc");
    });

    it("should handle pagination without params", async () => {
      const mockResponse = new Response(JSON.stringify([]), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/wp-json/wc/v3/orders");
      expect(url).not.toContain("?");
    });

    it("should handle empty pagination params", async () => {
      const mockResponse = new Response(JSON.stringify([]), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await client.get("/orders", {});

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/wp-json/wc/v3/orders");
    });
  });

  describe("Specialized API Methods", () => {
    it("should get single order", async () => {
      const mockOrder = { id: 123, status: "processing", total: "99.99" };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(mockOrder), { status: 200 }),
      );

      const result = await client.getOrder(123);

      expect(result).toEqual(mockOrder);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/orders/123");
    });

    it("should get list of orders", async () => {
      const mockOrders = [
        { id: 1, status: "pending" },
        { id: 2, status: "processing" },
      ];
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(mockOrders), { status: 200 }),
      );

      const result = await client.getOrders({ page: 1, perPage: 10 });

      expect(result.data).toEqual(mockOrders);
    });

    it("should create order", async () => {
      const newOrder = {
        status: "pending",
        customer_note: "New order",
      };
      const createdOrder = { id: 999, ...newOrder };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(createdOrder), { status: 201 }),
      );

      const result = await client.createOrder(newOrder);

      expect(result.id).toBe(999);
      const [, options] = mockFetch.mock.calls[0];
      expect(options?.method).toBe("POST");
    });

    it("should update order", async () => {
      const updateData = { status: "completed" };
      const updatedOrder = { id: 123, ...updateData };
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(updatedOrder), { status: 200 }),
      );

      const result = await client.updateOrder(123, updateData);

      expect(result.status).toBe("completed");
      const [, options] = mockFetch.mock.calls[0];
      expect(options?.method).toBe("PUT");
    });

    it("should delete order", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ id: 123, status: "trash" }), {
          status: 200,
        }),
      );

      await client.deleteOrder(123);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/orders/123");
      expect(options?.method).toBe("DELETE");
    });

    it("should handle force delete parameter", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ id: 123 }), { status: 200 }),
      );

      await client.deleteOrder(123, true);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("force=true");
    });
  });

  describe("Error Handling", () => {
    it("should throw error with status code and message", async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "woocommerce_rest_invalid_param",
            message: "Invalid order ID",
          }),
          { status: 400 },
        ),
      );

      await expect(client.get("/orders/invalid")).rejects.toThrow(
        /WooCommerce API Error \[400\]/,
      );
    });

    it("should handle error response without message", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({}), { status: 404 }),
      );

      await expect(client.get("/orders/999")).rejects.toThrow();
    });

    it("should handle non-JSON error response", async () => {
      mockFetch.mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );

      await expect(client.get("/orders/1")).rejects.toThrow();
    });
  });
});

// Helper function to extract OAuth parameter from header
function extractOAuthParam(authHeader: string, paramName: string): string {
  const match = new RegExp(`${paramName}="([^"]+)"`).exec(authHeader);
  return match ? decodeURIComponent(match[1]) : "";
}
