/**
 * Error Mapper Tests
 *
 * Tests cover:
 * - HTTP status code mapping
 * - Provider-specific error parsing (Stripe, Shopify, etc.)
 * - Retryable vs non-retryable classification
 * - Error sanitization and redaction
 * - Enriched error context
 * - Custom error parser registration
 *
 * Run with: npm test -- error-mapper.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ErrorMapper } from "../error-mapper";

describe("ErrorMapper", () => {
  let mapper: ErrorMapper;

  beforeEach(() => {
    mapper = new ErrorMapper();
  });

  describe("HTTP status code mapping", () => {
    it("should map 401 to INTEGRATION_AUTH_FAILED", () => {
      const error = {
        statusCode: 401,
        message: "Unauthorized",
      };

      const mapped = mapper.mapError(error, "test-provider");
      expect(mapped.code).toBe("INTEGRATION_AUTH_FAILED");
    });

    it("should map 403 to INTEGRATION_AUTH_FAILED", () => {
      const error = {
        statusCode: 403,
        message: "Forbidden",
      };

      const mapped = mapper.mapError(error, "test-provider");
      expect(mapped.code).toBe("INTEGRATION_AUTH_FAILED");
    });

    it("should map 404 to INTEGRATION_NOT_FOUND", () => {
      const error = {
        statusCode: 404,
        message: "Not found",
      };

      const mapped = mapper.mapError(error, "test-provider");
      expect(mapped.code).toBe("INTEGRATION_NOT_FOUND");
    });

    it("should map 429 to INTEGRATION_RATE_LIMITED", () => {
      const error = {
        statusCode: 429,
        message: "Too many requests",
      };

      const mapped = mapper.mapError(error, "test-provider");
      expect(mapped.code).toBe("INTEGRATION_RATE_LIMITED");
    });

    it("should map 5xx to INTEGRATION_PROVIDER_ERROR", () => {
      [500, 502, 503, 504].forEach((statusCode) => {
        const error = { statusCode, message: "Server error" };
        const mapped = mapper.mapError(error, "test-provider");
        expect(mapped.code).toBe("INTEGRATION_PROVIDER_ERROR");
      });
    });
  });

  describe("Stripe error parsing", () => {
    it("should parse Stripe error format", () => {
      const stripeError = {
        error: {
          message: "Your card was declined",
          code: "card_declined",
          type: "card_error",
        },
        statusCode: 402,
      };

      const mapped = mapper.mapError(stripeError, "stripe", "createPayment");
      expect(mapped.message).toBe("Your card was declined");
      expect(mapped.provider).toBe("stripe");
      expect(mapped.operation).toBe("createPayment");
    });
  });

  describe("Shopify error parsing", () => {
    it("should parse Shopify error array format", () => {
      const shopifyError = {
        errors: [
          {
            message: "Invalid request",
          },
        ],
        statusCode: 422,
      };

      const mapped = mapper.mapError(shopifyError, "shopify");
      expect(mapped.message).toContain("Invalid request");
    });

    it("should parse Shopify error object format", () => {
      const shopifyError = {
        errors: {
          title: "Title is required",
        },
        statusCode: 422,
      };

      const mapped = mapper.mapError(shopifyError, "shopify");
      expect(mapped.message).toContain("title");
    });
  });

  describe("Generic error parsing", () => {
    it("should handle Error objects", () => {
      const error = new Error("Something went wrong");
      const mapped = mapper.mapError(error, "test-provider");

      expect(mapped.message).toBe("Something went wrong");
      expect(mapped.code).toBe("INTEGRATION_ERROR");
    });

    it("should handle plain objects", () => {
      const error = {
        message: "Custom error",
        code: "CUSTOM_CODE",
      };

      const mapped = mapper.mapError(error, "test-provider");
      expect(mapped.message).toBe("Custom error");
    });

    it("should handle strings", () => {
      const mapped = mapper.mapError("Simple error message", "test-provider");
      expect(mapped.message).toBe("Simple error message");
    });
  });

  describe("Retryability", () => {
    it("should mark rate limit errors as retryable", () => {
      const error = { statusCode: 429, message: "Too many requests" };
      const mapped = mapper.mapError(error, "test-provider");

      expect(mapped.retryable).toBe(true);
      expect(mapped.retryDelay).toBe(60000); // 1 minute
    });

    it("should mark timeout errors as retryable", () => {
      const error = new Error("Request timeout");
      (error as any).code = "TIMEOUT";
      const mapped = mapper.mapError(error, "test-provider");

      expect(mapped.retryable).toBe(true);
    });

    it("should mark 5xx errors as retryable", () => {
      const error = { statusCode: 500, message: "Server error" };
      const mapped = mapper.mapError(error, "test-provider");

      expect(mapped.retryable).toBe(true);
    });

    it("should not mark 4xx errors (except 429) as retryable", () => {
      [400, 401, 403, 404].forEach((statusCode) => {
        const error = { statusCode, message: "Client error" };
        const mapped = mapper.mapError(error, "test-provider");

        expect(mapped.retryable).toBe(false);
      });
    });
  });

  describe("Error context enrichment", () => {
    it("should include correlation ID", () => {
      const error = { message: "Error" };
      const mapped = mapper.mapError(error, "stripe", "charge", "corr-123");

      expect(mapped.correlationId).toBe("corr-123");
    });

    it("should generate correlation ID if not provided", () => {
      const error = { message: "Error" };
      const mapped = mapper.mapError(error, "stripe");

      expect(mapped.correlationId).toBeDefined();
      expect(mapped.correlationId.length).toBeGreaterThan(0);
    });

    it("should include provider and operation", () => {
      const error = { message: "Error" };
      const mapped = mapper.mapError(error, "stripe", "createPayment");

      expect(mapped.provider).toBe("stripe");
      expect(mapped.operation).toBe("createPayment");
    });

    it("should include timestamp", () => {
      const error = { message: "Error" };
      const mapped = mapper.mapError(error, "stripe");

      expect(mapped.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Error sanitization", () => {
    it("should redact sensitive error details", () => {
      const error = {
        message: "Auth failed",
        api_key: "sk_live_secret123",
        token: "bearer_xyz",
      };

      const mapped = mapper.mapError(error, "test-provider");
      expect(mapped.details).toBeDefined();
      expect(mapped.details?.api_key).toBe("[REDACTED]");
      expect(mapped.details?.token).toBe("[REDACTED]");
    });

    it("should not include original error in safe mode", () => {
      const error = {
        message: "Error",
        secret: "hidden_value",
      };

      const mapped = mapper.mapError(error, "test-provider");
      // Details should be sanitized
      expect(mapped.details?.secret).toBe("[REDACTED]");
    });
  });

  describe("Custom parsers", () => {
    it("should register custom error parser", () => {
      mapper.registerParser("custom-provider", (error) => ({
        message: "Custom parsed: " + String(error),
        statusCode: 418,
      }));

      const error = { message: "test" };
      const mapped = mapper.mapError(error, "custom-provider");

      expect(mapped.message).toContain("Custom parsed");
      expect(mapped.statusCode).toBe(418);
    });

    it("should override default parser", () => {
      mapper.registerParser("stripe", (error) => ({
        message: "Stripe custom parser",
        statusCode: 999,
      }));

      const error = { message: "test" };
      const mapped = mapper.mapError(error, "stripe");

      expect(mapped.message).toBe("Stripe custom parser");
    });
  });

  describe("AWS error parsing", () => {
    it("should parse AWS error format", () => {
      const awsError = {
        code: "ServiceUnavailable",
        message: "Service temporarily unavailable",
        name: "ServiceUnavailableException",
      };

      const mapped = mapper.mapError(awsError, "aws");
      expect(mapped.message).toContain("Service temporarily unavailable");
    });

    it("should mark AWS retryable errors as retryable", () => {
      const error = { code: "Throttling", message: "Rate exceeded" };
      const mapped = mapper.mapError(error, "aws");

      expect(mapped.retryable).toBe(true);
    });
  });

  describe("Google error parsing", () => {
    it("should parse Google error format", () => {
      const googleError = {
        error: {
          message: "Invalid API key",
          code: 400,
        },
      };

      const mapped = mapper.mapError(googleError, "google");
      expect(mapped.message).toContain("Invalid API key");
    });
  });
});
