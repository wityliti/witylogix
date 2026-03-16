/**
 * CORS Configuration Tests — Cross-origin resource sharing validation.
 *
 * Tests cover:
 * - Origin whitelist validation
 * - Wildcard subdomain matching
 * - Preflight request handling
 * - Per-route overrides
 * - Credentials handling
 *
 * Run with: npm test -- cors-config.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CorsManager } from "../cors-config";

describe("CorsManager", () => {
  let corsManager: CorsManager;

  beforeEach(() => {
    corsManager = new CorsManager([
      "https://app.witylogix.com",
      "https://dashboard.witylogix.com",
      "https://*.witylogix.com",
    ]);
  });

  describe("Origin Validation", () => {
    it("should allow exact origin match", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.allowed).toBe(true);
    });

    it("should reject unauthorized origin", () => {
      const result = corsManager.validateRequest({
        origin: "https://evil.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.allowed).toBe(false);
    });

    it("should allow wildcard subdomain match", () => {
      const result = corsManager.validateRequest({
        origin: "https://custom.witylogix.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.allowed).toBe(true);
    });

    it("should not allow base domain in wildcard", () => {
      const result = corsManager.validateRequest({
        origin: "https://witylogix.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe("Method Validation", () => {
    it("should allow GET requests", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.allowed).toBe(true);
    });

    it("should allow POST requests", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "POST",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.allowed).toBe(true);
    });

    it("should reject disallowed method", () => {
      corsManager = new CorsManager(["https://app.witylogix.com"], {
        methods: ["GET", "POST"],
      });

      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "DELETE",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe("Header Handling", () => {
    it("should allow standard headers", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "POST",
        requestHeaders: ["Content-Type", "Authorization"],
        isPreflight: true,
        path: "/api/data",
      });

      expect(result.allowed).toBe(true);
    });

    it("should include request headers in response", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "OPTIONS",
        requestHeaders: ["Content-Type"],
        isPreflight: true,
        path: "/api/data",
      });

      expect(result.headers["Access-Control-Allow-Headers"]).toBeDefined();
    });
  });

  describe("Preflight Caching", () => {
    it("should include Access-Control-Max-Age header", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "OPTIONS",
        requestHeaders: [],
        isPreflight: true,
        path: "/api/data",
      });

      expect(result.headers["Access-Control-Max-Age"]).toBeDefined();
    });

    it("should use custom max age", () => {
      const customCors = new CorsManager(["https://app.witylogix.com"], {
        maxAge: 7200,
      });

      const result = customCors.validateRequest({
        origin: "https://app.witylogix.com",
        method: "OPTIONS",
        requestHeaders: [],
        isPreflight: true,
        path: "/api/data",
      });

      expect(result.headers["Access-Control-Max-Age"]).toBe("7200");
    });
  });

  describe("Credentials Support", () => {
    it("should include credentials header when enabled", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.headers["Access-Control-Allow-Credentials"]).toBe("true");
    });

    it("should omit credentials when disabled", () => {
      const noCreds = new CorsManager(["https://app.witylogix.com"], {
        credentials: false,
      });

      const result = noCreds.validateRequest({
        origin: "https://app.witylogix.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.headers["Access-Control-Allow-Credentials"]).toBeUndefined();
    });
  });

  describe("Route Overrides", () => {
    it("should apply route-specific override", () => {
      corsManager.addOverride({
        pattern: "/api/public/*",
        origins: ["*"],
        credentials: false,
        maxAge: 600,
        methods: ["GET"],
        allowedHeaders: ["Content-Type"],
        exposedHeaders: [],
      });

      const result = corsManager.validateRequest({
        origin: "https://evil.com",
        method: "GET",
        requestHeaders: ["Content-Type"],
        isPreflight: false,
        path: "/api/public/data",
      });

      expect(result.allowed).toBe(true);
    });

    it("should not apply override to non-matching routes", () => {
      corsManager.addOverride({
        pattern: "/api/public/*",
        origins: ["*"],
        credentials: false,
        maxAge: 600,
        methods: ["GET"],
        allowedHeaders: ["Content-Type"],
        exposedHeaders: [],
      });

      const result = corsManager.validateRequest({
        origin: "https://evil.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/private/data",
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe("Whitelist Management", () => {
    it("should add origin to whitelist", () => {
      corsManager.addOrigin("https://new.witylogix.com");

      expect(corsManager.isWhitelisted("https://new.witylogix.com")).toBe(true);
    });

    it("should remove origin from whitelist", () => {
      corsManager.removeOrigin("https://app.witylogix.com");

      expect(corsManager.isWhitelisted("https://app.witylogix.com")).toBe(false);
    });

    it("should get current whitelist", () => {
      const whitelist = corsManager.getWhitelist();

      expect(whitelist).toContain("https://app.witylogix.com");
      expect(whitelist.length).toBeGreaterThan(0);
    });
  });

  describe("Response Headers", () => {
    it("should include origin in response", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.headers["Access-Control-Allow-Origin"]).toBe(
        "https://app.witylogix.com"
      );
    });

    it("should include allowed methods", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "OPTIONS",
        requestHeaders: [],
        isPreflight: true,
        path: "/api/data",
      });

      expect(result.headers["Access-Control-Allow-Methods"]).toBeDefined();
    });

    it("should include exposed headers", () => {
      const result = corsManager.validateRequest({
        origin: "https://app.witylogix.com",
        method: "GET",
        requestHeaders: [],
        isPreflight: false,
        path: "/api/data",
      });

      expect(result.headers["Access-Control-Expose-Headers"]).toBeDefined();
    });
  });

  describe("getHeaders Shorthand", () => {
    it("should return CORS headers for request", () => {
      const headers = corsManager.getHeaders(
        "https://app.witylogix.com",
        "GET"
      );

      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://app.witylogix.com"
      );
    });
  });
});
