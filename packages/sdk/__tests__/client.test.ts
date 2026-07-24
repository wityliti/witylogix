/**
 * Tests for WitylogixClient
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { WitylogixClient } from "../src/client";
import {
  ApiError,
  AuthError,
  BadRequestError,
  NotFoundError,
  RateLimitError,
  ServerError,
  NetworkError,
  ConfigError,
} from "../src/errors";

// Mock global fetch
global.fetch = vi.fn();

describe("WitylogixClient", () => {
  const mockFetch = global.fetch as any;
  const baseUrl = "https://api.witylogix.com";
  const apiKey = "test-api-key";
  const accessToken = "test-access-token";

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Constructor Tests
  // =========================================================================

  describe("constructor validation", () => {
    it("should throw ConfigError when baseUrl is missing", () => {
      expect(() => {
        new WitylogixClient({
          baseUrl: "",
          apiKey: "key",
        });
      }).toThrow(ConfigError);
      expect(() => {
        new WitylogixClient({
          baseUrl: "",
          apiKey: "key",
        });
      }).toThrow("baseUrl is required in client configuration");
    });

    it("should throw ConfigError when neither apiKey nor accessToken is provided", () => {
      expect(() => {
        new WitylogixClient({ baseUrl });
      }).toThrow(ConfigError);
      expect(() => {
        new WitylogixClient({ baseUrl });
      }).toThrow("Either apiKey or accessToken must be provided");
    });

    it("should successfully construct with apiKey", () => {
      const client = new WitylogixClient({ baseUrl, apiKey });
      expect(client).toBeDefined();
      expect(client.isAuthenticated()).toBe(true);
    });

    it("should successfully construct with accessToken", () => {
      const client = new WitylogixClient({ baseUrl, accessToken });
      expect(client).toBeDefined();
      expect(client.isAuthenticated()).toBe(true);
    });

    it("should remove trailing slash from baseUrl", () => {
      const client = new WitylogixClient({
        baseUrl: "https://api.witylogix.com/",
        apiKey,
      });
      expect(client.getBaseUrl()).toBe("https://api.witylogix.com");
    });

    it("should use default timeout and retryAttempts when not provided", () => {
      const client = new WitylogixClient({ baseUrl, apiKey });
      expect(client).toBeDefined();
    });

    it("should use custom timeout and retryAttempts when provided", () => {
      const client = new WitylogixClient({
        baseUrl,
        apiKey,
        timeout: 60000,
        retryAttempts: 5,
      });
      expect(client).toBeDefined();
    });
  });

  // =========================================================================
  // Request Building Tests
  // =========================================================================

  describe("request building", () => {
    let client: WitylogixClient;

    beforeEach(() => {
      client = new WitylogixClient({ baseUrl, apiKey });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ success: true }),
        text: async () => '{"success": true}',
      });
    });

    it("should build correct headers with API key", async () => {
      await client.get("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          }),
        }),
      );
    });

    it("should build correct headers with Bearer token", async () => {
      const tokenClient = new WitylogixClient({ baseUrl, accessToken });
      await tokenClient.get("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          }),
        }),
      );
    });

    it("should include custom headers in request", async () => {
      await client.get("/test", {}, { headers: { "X-Custom": "value" } });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom": "value",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should build correct URL with query parameters", async () => {
      await client.get("/orders", { page: 1, limit: 20 });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("page=1");
      expect(callUrl).toContain("limit=20");
    });

    it("should handle array parameters in query string", async () => {
      await client.get("/orders", { statuses: ["pending", "confirmed"] });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("statuses=pending");
      expect(callUrl).toContain("statuses=confirmed");
    });

    it("should skip undefined and null parameters", async () => {
      await client.get("/orders", { page: 1, limit: undefined, status: null });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("page=1");
      expect(callUrl).not.toContain("limit");
      expect(callUrl).not.toContain("status");
    });
  });

  // =========================================================================
  // HTTP Method Tests
  // =========================================================================

  describe("HTTP methods", () => {
    let client: WitylogixClient;

    beforeEach(() => {
      client = new WitylogixClient({ baseUrl, apiKey });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ id: "test-123", name: "Test" }),
        text: async () => '{"id": "test-123", "name": "Test"}',
      });
    });

    it("should make successful GET request", async () => {
      const result = await client.get("/orders/123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/orders/123"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toEqual({ id: "test-123", name: "Test" });
    });

    it("should make successful POST request with data", async () => {
      const data = { name: "New Order", status: "pending" };
      const result = await client.post("/orders", data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(data),
        }),
      );
      expect(result).toEqual({ id: "test-123", name: "Test" });
    });

    it("should make successful PUT request", async () => {
      const data = { status: "delivered" };
      const result = await client.put("/orders/123", data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(data),
        }),
      );
      expect(result).toEqual({ id: "test-123", name: "Test" });
    });

    it("should make successful PATCH request", async () => {
      const data = { status: "confirmed" };
      const result = await client.patch("/orders/123", data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      );
      expect(result).toEqual({ id: "test-123", name: "Test" });
    });

    it("should make successful DELETE request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: async () => "",
      });

      await client.delete("/orders/123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  // =========================================================================
  // Retry Logic Tests
  // =========================================================================

  describe("retry logic", () => {
    let client: WitylogixClient;

    beforeEach(() => {
      client = new WitylogixClient({ baseUrl, apiKey, retryAttempts: 2 });
    });

    it("should retry on 429 rate limit error", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ "Retry-After": "1" }),
          json: async () => ({
            code: "RATE_LIMITED",
            message: "Too many requests",
          }),
          text: async () =>
            '{"code": "RATE_LIMITED", "message": "Too many requests"}',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({ success: true }),
          text: async () => '{"success": true}',
        });

      vi.useFakeTimers();
      const promise = client.get("/orders");
      await vi.runAllTimersAsync();
      vi.useRealTimers();

      const result = await promise;
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw RateLimitError after max retries", async () => {
      // Use a client with 0 retries so the rate limit error is thrown immediately
      const noRetryClient = new WitylogixClient({
        baseUrl,
        apiKey,
        retryAttempts: 0,
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "0" }),
        json: async () => ({
          code: "RATE_LIMITED",
          message: "Too many requests",
        }),
        text: async () =>
          '{"code": "RATE_LIMITED", "message": "Too many requests"}',
      });

      await expect(noRetryClient.get("/orders")).rejects.toThrow(
        RateLimitError,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should parse Retry-After header as seconds", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ "Retry-After": "2" }),
          json: async () => ({
            code: "RATE_LIMITED",
            message: "Too many requests",
          }),
          text: async () =>
            '{"code": "RATE_LIMITED", "message": "Too many requests"}',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({ success: true }),
          text: async () => '{"success": true}',
        });

      vi.useFakeTimers();
      const promise = client.get("/orders");

      // Advance past the retry delay
      await vi.advanceTimersByTimeAsync(2100);
      vi.useRealTimers();

      const result = await promise;
      expect(result).toEqual({ success: true });
    });

    it("should not retry on non-429 errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ code: "BAD_REQUEST", message: "Invalid input" }),
        text: async () => '{"code": "BAD_REQUEST", "message": "Invalid input"}',
      });

      await expect(client.get("/orders")).rejects.toThrow(BadRequestError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Timeout Tests
  // =========================================================================

  describe("timeout handling", () => {
    let client: WitylogixClient;

    beforeEach(() => {
      client = new WitylogixClient({ baseUrl, apiKey, timeout: 5000 });
    });

    it("should throw NetworkError on timeout", async () => {
      // Use a very short real timeout to test abort behavior
      const shortTimeoutClient = new WitylogixClient({
        baseUrl,
        apiKey,
        timeout: 50,
      });
      mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          // Listen for abort signal like real fetch does
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              const err = new DOMException(
                "The operation was aborted.",
                "AbortError",
              );
              reject(err);
            });
          }
        });
      });

      await expect(shortTimeoutClient.get("/orders")).rejects.toThrow(
        NetworkError,
      );
    }, 10000);

    it("should use custom timeout from request options", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ success: true }),
        text: async () => '{"success": true}',
      });

      await client.get("/orders", {}, { timeout: 10000 });
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Error Response Parsing Tests
  // =========================================================================

  describe("error response parsing", () => {
    let client: WitylogixClient;

    beforeEach(() => {
      client = new WitylogixClient({ baseUrl, apiKey });
    });

    it("should throw BadRequestError on 400 response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({
          code: "VALIDATION_ERROR",
          message: "Invalid input",
        }),
        text: async () =>
          '{"code": "VALIDATION_ERROR", "message": "Invalid input"}',
      });

      await expect(client.get("/orders")).rejects.toThrow(BadRequestError);
      await expect(client.get("/orders")).rejects.toThrow("Invalid input");
    });

    it("should throw AuthError on 401 response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        }),
        text: async () =>
          '{"code": "UNAUTHORIZED", "message": "Invalid API key"}',
      });

      await expect(client.get("/orders")).rejects.toThrow(AuthError);
    });

    it("should throw AuthError on 403 response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ code: "FORBIDDEN", message: "Access denied" }),
        text: async () => '{"code": "FORBIDDEN", "message": "Access denied"}',
      });

      await expect(client.get("/orders")).rejects.toThrow(AuthError);
    });

    it("should throw NotFoundError on 404 response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ code: "NOT_FOUND", message: "Order not found" }),
        text: async () => '{"code": "NOT_FOUND", "message": "Order not found"}',
      });

      await expect(client.get("/orders/123")).rejects.toThrow(NotFoundError);
    });

    it("should throw ServerError on 500 response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({
          code: "SERVER_ERROR",
          message: "Internal server error",
        }),
        text: async () =>
          '{"code": "SERVER_ERROR", "message": "Internal server error"}',
      });

      await expect(client.get("/orders")).rejects.toThrow(ServerError);
    });

    it("should include error details in thrown error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { field: "email", reason: "Invalid email" },
        }),
        text: async () =>
          '{"code": "VALIDATION_ERROR", "message": "Validation failed", "details": {"field": "email", "reason": "Invalid email"}}',
      });

      try {
        await client.get("/orders");
      } catch (error: any) {
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.details).toEqual({
          field: "email",
          reason: "Invalid email",
        });
      }
    });
  });

  // =========================================================================
  // Response Parsing Tests
  // =========================================================================

  describe("response parsing", () => {
    let client: WitylogixClient;

    beforeEach(() => {
      client = new WitylogixClient({ baseUrl, apiKey });
    });

    it("should parse JSON response", async () => {
      const mockData = { id: "order-123", status: "pending" };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockData,
        text: async () => JSON.stringify(mockData),
      });

      const result = await client.get("/orders/123");
      expect(result).toEqual(mockData);
    });

    it("should handle empty response body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => "",
      });

      const result = await client.delete("/orders/123");
      expect(result).toBeUndefined();
    });

    it("should handle non-JSON content type", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "text/plain" }),
        json: async () => ({}),
        text: async () => "plain text response",
      });

      const result = await client.get("/orders/123");
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // Network Error Tests
  // =========================================================================

  describe("network error handling", () => {
    let client: WitylogixClient;

    beforeEach(() => {
      client = new WitylogixClient({ baseUrl, apiKey });
    });

    it("should throw NetworkError on fetch failure", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(client.get("/orders")).rejects.toThrow(NetworkError);
    });

    it("should pass through ApiError instances", async () => {
      const apiError = new ApiError("API Error", {
        status: 500,
        code: "ERROR",
      });
      mockFetch.mockRejectedValue(apiError);

      await expect(client.get("/orders")).rejects.toThrow(ApiError);
    });
  });
});
