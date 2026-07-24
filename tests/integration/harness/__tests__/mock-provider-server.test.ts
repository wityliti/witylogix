/**
 * Mock Provider Server Tests
 * Tests for the mock HTTP server, auth, rate limiting, errors
 * ~150 lines
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockProviderServer } from "../mock-provider-server";
import http from "http";

// ───────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ───────────────────────────────────────────────────────────────────────────

function makeRequest(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<{
  status: number;
  body: string;
  headers: Record<string, string | string[]>;
}> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 500,
            body,
            headers: res.headers,
          });
        });
      },
    );

    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ───────────────────────────────────────────────────────────────────────────
// TESTS
// ───────────────────────────────────────────────────────────────────────────

describe("MockProviderServer", () => {
  let server: MockProviderServer;

  beforeEach(async () => {
    server = new MockProviderServer({ port: 12001 });
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
  });

  describe("Basic Server Operations", () => {
    it("should start and stop correctly", async () => {
      expect(server.isRunning()).toBe(false);
      await server.start();
      expect(server.isRunning()).toBe(true);
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it("should provide correct base URL", async () => {
      await server.start();
      expect(server.getBaseUrl()).toBe("http://localhost:12001");
      await server.stop();
    });

    it("should handle GET requests", async () => {
      server.addFixtures({
        "/api/v1/test": { message: "success" },
      });

      await server.start();
      const response = await makeRequest(server.getBaseUrl(), "/api/v1/test");
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: "success" });
      await server.stop();
    });

    it("should return 404 for missing endpoints", async () => {
      await server.start();
      const response = await makeRequest(
        server.getBaseUrl(),
        "/api/v1/missing",
      );
      expect(response.status).toBe(404);
      await server.stop();
    });
  });

  describe("Request Recording", () => {
    it("should record incoming requests", async () => {
      server.addFixtures({
        "/api/v1/test": { message: "success" },
      });

      await server.start();
      await makeRequest(server.getBaseUrl(), "/api/v1/test");
      const recorded = server.getRecordedRequests();
      expect(recorded).toHaveLength(1);
      expect(recorded[0].path).toBe("/api/v1/test");
      expect(recorded[0].method).toBe("GET");
      await server.stop();
    });

    it("should filter recorded requests by path", async () => {
      server.addFixtures({
        "/api/v1/test1": { id: 1 },
        "/api/v1/test2": { id: 2 },
      });

      await server.start();
      await makeRequest(server.getBaseUrl(), "/api/v1/test1");
      await makeRequest(server.getBaseUrl(), "/api/v1/test2");
      await makeRequest(server.getBaseUrl(), "/api/v1/test1");

      const test1Requests = server.getRecordedRequestsForPath("/api/v1/test1");
      expect(test1Requests).toHaveLength(2);
      await server.stop();
    });

    it("should clear recorded requests", async () => {
      server.addFixtures({
        "/api/v1/test": { message: "success" },
      });

      await server.start();
      await makeRequest(server.getBaseUrl(), "/api/v1/test");
      expect(server.getRecordedRequests()).toHaveLength(1);

      server.clearRecordedRequests();
      expect(server.getRecordedRequests()).toHaveLength(0);
      await server.stop();
    });
  });

  describe("API Key Authentication", () => {
    it("should validate API keys from headers", async () => {
      server.setAPIKeyAuth(["sk_test_123"]);
      server.addFixtures({
        "/api/v1/protected": { message: "secret" },
      });

      await server.start();

      const noAuth = await makeRequest(
        server.getBaseUrl(),
        "/api/v1/protected",
      );
      expect(noAuth.status).toBe(401);

      const withAuth = await makeRequest(
        server.getBaseUrl(),
        "/api/v1/protected",
        {
          headers: { "x-api-key": "sk_test_123" },
        },
      );
      expect(withAuth.status).toBe(200);

      const wrongKey = await makeRequest(
        server.getBaseUrl(),
        "/api/v1/protected",
        {
          headers: { "x-api-key": "wrong_key" },
        },
      );
      expect(wrongKey.status).toBe(401);

      await server.stop();
    });
  });

  describe("Error Rate Simulation", () => {
    it("should simulate errors at configured rate", async () => {
      server = new MockProviderServer({
        port: 12002,
        errorRate: 1.0, // 100% error rate
      });

      server.addFixtures({
        "/api/v1/test": { message: "success" },
      });

      await server.start();
      const response = await makeRequest(server.getBaseUrl(), "/api/v1/test");
      expect(response.status).toBe(500);
      await server.stop();
    });
  });

  describe("Response Delay Simulation", () => {
    it("should apply configured delay to responses", async () => {
      server = new MockProviderServer({
        port: 12003,
        responseDelay: 100,
      });

      server.addFixtures({
        "/api/v1/test": { message: "success" },
      });

      await server.start();
      const startTime = Date.now();
      await makeRequest(server.getBaseUrl(), "/api/v1/test");
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
      await server.stop();
    });
  });

  describe("Fixture Management", () => {
    it("should add and retrieve fixtures", async () => {
      server.addFixtures({
        "/api/v1/products": [{ id: 1, name: "Product 1" }],
        "/api/v1/users/123": { id: 123, name: "User" },
      });

      await server.start();

      const products = await makeRequest(
        server.getBaseUrl(),
        "/api/v1/products",
      );
      expect(products.status).toBe(200);
      expect(JSON.parse(products.body)).toEqual([{ id: 1, name: "Product 1" }]);

      const user = await makeRequest(server.getBaseUrl(), "/api/v1/users/123");
      expect(user.status).toBe(200);
      expect(JSON.parse(user.body)).toEqual({ id: 123, name: "User" });

      await server.stop();
    });
  });

  describe("Query Parameter Handling", () => {
    it("should record query parameters", async () => {
      server.addFixtures({
        "/api/v1/search": { results: [] },
      });

      await server.start();
      await makeRequest(server.getBaseUrl(), "/api/v1/search?q=test&limit=10");

      const recorded = server.getRecordedRequests()[0];
      expect(recorded.query).toEqual({ q: "test", limit: "10" });
      await server.stop();
    });
  });

  describe("POST Request Handling", () => {
    it("should record request body", async () => {
      server.addFixtures({
        "/api/v1/orders": { id: "order_123" },
      });

      await server.start();
      const body = JSON.stringify({ customerId: "cust_123", total: 99.99 });
      await makeRequest(server.getBaseUrl(), "/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const recorded = server.getRecordedRequests()[0];
      expect(recorded.method).toBe("POST");
      expect(recorded.body).toBe(body);
      await server.stop();
    });
  });
});
