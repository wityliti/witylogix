/**
 * CSP Headers Tests — Content Security Policy generation and validation.
 *
 * Tests cover:
 * - Nonce generation and validation
 * - Environment-specific policies (dev, staging, prod)
 * - Header serialization
 * - Violation report parsing
 * - Report-only mode
 *
 * Run with: npm test -- csp-headers.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CspManager, CspEnvironment } from "../csp-headers";

describe("CspManager", () => {
  let cspManager: CspManager;

  beforeEach(() => {
    cspManager = new CspManager(CspEnvironment.PRODUCTION);
  });

  describe("Nonce Generation", () => {
    it("should generate valid nonce", () => {
      const nonce = cspManager.generateNonce();
      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe("string");
      expect(nonce.length).toBeGreaterThan(0);
    });

    it("should generate unique nonces", () => {
      const nonce1 = cspManager.generateNonce();
      const nonce2 = cspManager.generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it("should validate correct nonce", () => {
      const nonce = cspManager.generateNonce();
      const isValid = cspManager.validateNonce(nonce);
      expect(isValid).toBe(true);
    });

    it("should invalidate nonce after one-time use", () => {
      const nonce = cspManager.generateNonce();
      cspManager.validateNonce(nonce);
      const isValid = cspManager.validateNonce(nonce);
      expect(isValid).toBe(false);
    });

    it("should reject unknown nonce", () => {
      const isValid = cspManager.validateNonce("unknown-nonce");
      expect(isValid).toBe(false);
    });
  });

  describe("Environment Policies", () => {
    it("should create development policy", () => {
      const devManager = new CspManager(CspEnvironment.DEVELOPMENT);
      const headers = devManager.getHeaders();
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).toContain("'unsafe-inline'");
      expect(headerValue).toContain("localhost");
    });

    it("should create production policy", () => {
      const headers = cspManager.getHeaders();
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).not.toContain("'unsafe-inline'");
      expect(headerValue).toContain("upgrade-insecure-requests");
      expect(headerValue).toContain("block-all-mixed-content");
    });

    it("should create staging policy", () => {
      const stagingManager = new CspManager(CspEnvironment.STAGING);
      const headers = stagingManager.getHeaders();
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).toContain("cdn.staging.witylogix.com");
    });
  });

  describe("Nonce Inclusion", () => {
    it("should include nonce in script-src", () => {
      const nonce = cspManager.generateNonce();
      const headers = cspManager.getHeaders(nonce);
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).toContain(`'nonce-${nonce}'`);
    });

    it("should include nonce in style-src", () => {
      const nonce = cspManager.generateNonce();
      const headers = cspManager.getHeaders(nonce);
      const headerValue = headers["Content-Security-Policy"];

      const styleMatch = headerValue.match(/style-src[^;]+/);
      expect(styleMatch?.[0]).toContain(`'nonce-${nonce}'`);
    });
  });

  describe("Header Serialization", () => {
    it("should serialize directives to valid CSP header", () => {
      const headers = cspManager.getHeaders();
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).toBeDefined();
      expect(headerValue).toContain("default-src");
      expect(headerValue).toContain("script-src");
      expect(headerValue).toContain("style-src");
    });

    it("should include report-uri", () => {
      const headers = cspManager.getHeaders();
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).toContain("report-uri");
    });

    it("should use custom report-uri", () => {
      const customUri = "/custom-csp-report";
      const manager = new CspManager(CspEnvironment.PRODUCTION, customUri);
      const headers = manager.getHeaders();
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).toContain(customUri);
    });
  });

  describe("Report-Only Mode", () => {
    it("should use Content-Security-Policy header in enforcement mode", () => {
      cspManager.setReportOnly(false);
      const headers = cspManager.getHeaders();

      expect(headers).toHaveProperty("Content-Security-Policy");
      expect(headers).not.toHaveProperty("Content-Security-Policy-Report-Only");
    });

    it("should use Content-Security-Policy-Report-Only header in report-only mode", () => {
      cspManager.setReportOnly(true);
      const headers = cspManager.getHeaders();

      expect(headers).not.toHaveProperty("Content-Security-Policy");
      expect(headers).toHaveProperty("Content-Security-Policy-Report-Only");
    });
  });

  describe("Violation Report Parsing", () => {
    it("should parse valid violation report", () => {
      const report = {
        "document-uri": "https://example.com/page",
        "violated-directive": "script-src",
        "effective-directive": "script-src",
        "original-policy": "script-src 'self'",
        "blocked-uri": "https://malicious.com/script.js",
        "source-file": "https://example.com/page",
        "line-number": 10,
        "column-number": 5,
        "status-code": 200,
      };

      const parsed = cspManager.parseViolationReport(report);

      expect(parsed["document-uri"]).toBe("https://example.com/page");
      expect(parsed["violated-directive"]).toBe("script-src");
      expect(parsed["line-number"]).toBe(10);
    });

    it("should reject invalid report", () => {
      const invalidReport = {
        "document-uri": "https://example.com/page",
        // Missing required fields
      };

      expect(() => {
        cspManager.parseViolationReport(invalidReport);
      }).toThrow();
    });

    it("should handle missing optional fields", () => {
      const report = {
        "document-uri": "https://example.com/page",
        "violated-directive": "script-src",
        "effective-directive": "script-src",
        "original-policy": "script-src 'self'",
        "source-file": "https://example.com/page",
        "line-number": 10,
        "column-number": 5,
        "status-code": 200,
      };

      const parsed = cspManager.parseViolationReport(report);
      expect(parsed["blocked-uri"]).toBeUndefined();
    });
  });

  describe("Environment Getter", () => {
    it("should return current environment", () => {
      expect(cspManager.getEnvironment()).toBe(CspEnvironment.PRODUCTION);
    });
  });

  describe("Security Directives", () => {
    it("should set frame-ancestors to deny", () => {
      const headers = cspManager.getHeaders();
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).toContain("frame-ancestors 'none'");
    });

    it("should set object-src to none", () => {
      const headers = cspManager.getHeaders();
      const headerValue = headers["Content-Security-Policy"];

      expect(headerValue).toContain("object-src 'none'");
    });
  });
});
