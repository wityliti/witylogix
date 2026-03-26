/**
 * Security Headers Tests — HTTP security header middleware.
 *
 * Tests cover:
 * - Header generation (X-Frame-Options, HSTS, etc.)
 * - HSTS configuration and preload
 * - Permissions-Policy directive generation
 * - Route-specific overrides
 * - Express/Fastify middleware
 *
 * Run with: npm test -- security-headers.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SecurityHeadersMiddleware } from "../security-headers";

describe("SecurityHeadersMiddleware", () => {
  let middleware: SecurityHeadersMiddleware;

  beforeEach(() => {
    middleware = new SecurityHeadersMiddleware();
  });

  describe("Header Generation", () => {
    it("should generate X-Content-Type-Options", () => {
      const headers = middleware.getHeaders();
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    });

    it("should generate X-Frame-Options", () => {
      const headers = middleware.getHeaders();
      expect(headers["X-Frame-Options"]).toBe("DENY");
    });

    it("should generate Referrer-Policy", () => {
      const headers = middleware.getHeaders();
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    });

    it("should generate Permissions-Policy", () => {
      const headers = middleware.getHeaders();
      expect(headers["Permissions-Policy"]).toBeDefined();
      expect(headers["Permissions-Policy"]).toContain("camera=()");
    });
  });

  describe("HSTS Header", () => {
    it("should include HSTS header", () => {
      const headers = middleware.getHeaders();
      expect(headers["Strict-Transport-Security"]).toBeDefined();
    });

    it("should use default max-age (1 year)", () => {
      const headers = middleware.getHeaders();
      expect(headers["Strict-Transport-Security"]).toContain("31536000");
    });

    it("should include includeSubDomains", () => {
      const headers = middleware.getHeaders();
      expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
    });

    it("should include preload when enabled", () => {
      const hsts = new SecurityHeadersMiddleware({ hstsPreload: true });
      const headers = hsts.getHeaders();
      expect(headers["Strict-Transport-Security"]).toContain("preload");
    });

    it("should disable HSTS when configured", () => {
      const noHsts = new SecurityHeadersMiddleware({ enableHsts: false });
      const headers = noHsts.getHeaders();
      expect(headers["Strict-Transport-Security"]).toBeUndefined();
    });
  });

  describe("Permissions-Policy", () => {
    it("should disable camera access", () => {
      const headers = middleware.getHeaders();
      expect(headers["Permissions-Policy"]).toContain("camera=()");
    });

    it("should disable microphone access", () => {
      const headers = middleware.getHeaders();
      expect(headers["Permissions-Policy"]).toContain("microphone=()");
    });

    it("should disable geolocation access", () => {
      const headers = middleware.getHeaders();
      expect(headers["Permissions-Policy"]).toContain("geolocation=()");
    });

    it("should use custom permissions list", () => {
      const custom = new SecurityHeadersMiddleware({
        disabledPermissions: ["camera", "microphone"],
      });
      const headers = custom.getHeaders();
      expect(headers["Permissions-Policy"]).not.toContain("geolocation");
    });
  });

  describe("X-XSS-Protection", () => {
    it("should include X-XSS-Protection when enabled", () => {
      const headers = middleware.getHeaders();
      expect(headers["X-XSS-Protection"]).toBe("0");
    });

    it("should disable X-XSS-Protection when configured", () => {
      const noXss = new SecurityHeadersMiddleware({
        enableXXssProtection: false,
      });
      const headers = noXss.getHeaders();
      expect(headers["X-XSS-Protection"]).toBeUndefined();
    });
  });

  describe("Expect-CT Header", () => {
    it("should include Expect-CT when enabled", () => {
      const headers = middleware.getHeaders();
      expect(headers["Expect-CT"]).toBeDefined();
    });

    it("should disable Expect-CT when configured", () => {
      const noCt = new SecurityHeadersMiddleware({ enableExpectCt: false });
      const headers = noCt.getHeaders();
      expect(headers["Expect-CT"]).toBeUndefined();
    });
  });

  describe("Cache-Control", () => {
    it("should include Cache-Control when configured", () => {
      const headers = middleware.getHeaders();
      expect(headers["Cache-Control"]).toBeDefined();
    });

    it("should use custom Cache-Control", () => {
      const custom = new SecurityHeadersMiddleware({
        cacheControl: "no-cache, no-store, must-revalidate",
      });
      const headers = custom.getHeaders();
      expect(headers["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
    });
  });

  describe("Route Overrides", () => {
    it("should apply override to matching route", () => {
      middleware.addOverride({
        pattern: "/api/public/*",
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      });

      const headers = middleware.getHeaders("/api/public/data");
      expect(headers["Cache-Control"]).toBe("public, max-age=3600");
    });

    it("should not apply override to non-matching routes", () => {
      const originalCC = "public, max-age=3600";
      middleware.addOverride({
        pattern: "/api/public/*",
        headers: {
          "Cache-Control": originalCC,
        },
      });

      const headers = middleware.getHeaders("/api/private/data");
      expect(headers["Cache-Control"]).not.toBe(originalCC);
    });

    it("should remove headers in override", () => {
      middleware.addOverride({
        pattern: "/api/public/*",
        headers: {},
        remove: ["X-Frame-Options"],
      });

      const headers = middleware.getHeaders("/api/public/data");
      expect(headers["X-Frame-Options"]).toBeUndefined();
    });

    it("should support regex patterns", () => {
      middleware.addOverride({
        pattern: /^\/static\/.*/,
        headers: {
          "Cache-Control": "public, max-age=31536000",
        },
      });

      const headers = middleware.getHeaders("/static/app.js");
      expect(headers["Cache-Control"]).toBe("public, max-age=31536000");
    });
  });

  describe("Feature Disabling", () => {
    it("should disable HSTS feature", () => {
      middleware.disableFeature("enableHsts");
      const headers = middleware.getHeaders();
      expect(headers["Strict-Transport-Security"]).toBeUndefined();
    });

    it("should disable X-Content-Type-Options feature", () => {
      middleware.disableFeature("enableXContentTypeOptions");
      const headers = middleware.getHeaders();
      expect(headers["X-Content-Type-Options"]).toBeUndefined();
    });
  });

  describe("HSTS Configuration Update", () => {
    it("should update HSTS max-age", () => {
      middleware.updateHstsConfig({ maxAge: 7200 });
      const headers = middleware.getHeaders();
      expect(headers["Strict-Transport-Security"]).toContain("7200");
    });

    it("should toggle includeSubDomains", () => {
      middleware.updateHstsConfig({ includeSubDomains: false });
      const headers = middleware.getHeaders();
      expect(headers["Strict-Transport-Security"]).not.toContain("includeSubDomains");
    });

    it("should enable preload", () => {
      middleware.updateHstsConfig({ preload: true });
      const headers = middleware.getHeaders();
      expect(headers["Strict-Transport-Security"]).toContain("preload");
    });
  });

  describe("Permissions Update", () => {
    it("should update disabled permissions", () => {
      middleware.updateDisabledPermissions(["camera"]);
      const headers = middleware.getHeaders();
      expect(headers["Permissions-Policy"]).not.toContain("microphone");
      expect(headers["Permissions-Policy"]).toContain("camera");
    });
  });

  describe("Configuration Getter", () => {
    it("should return current configuration", () => {
      const config = middleware.getConfig();
      expect(config.enableHsts).toBe(true);
      expect(config.frameOptions).toBe("DENY");
    });

    it("should return configuration copy (not reference)", () => {
      const config1 = middleware.getConfig();
      const config2 = middleware.getConfig();
      expect(config1).not.toBe(config2);
    });
  });

  describe("Frame Options", () => {
    it("should default to DENY", () => {
      const headers = middleware.getHeaders();
      expect(headers["X-Frame-Options"]).toBe("DENY");
    });

    it("should support SAMEORIGIN", () => {
      const sameOrigin = new SecurityHeadersMiddleware({
        frameOptions: "SAMEORIGIN",
      });
      const headers = sameOrigin.getHeaders();
      expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    });
  });

  describe("Custom Referrer Policy", () => {
    it("should support custom referrer policy", () => {
      const custom = new SecurityHeadersMiddleware({
        referrerPolicy: "no-referrer",
      });
      const headers = custom.getHeaders();
      expect(headers["Referrer-Policy"]).toBe("no-referrer");
    });
  });
});
