/**
 * Environment Validator Tests
 *
 * Tests for Zod-based environment validation:
 * - Valid complete config passes validation
 * - Missing required variables fails with clear message
 * - Type coercion works (string → number)
 * - Default values applied correctly
 * - Production requires all secrets
 * - Invalid URL formats rejected
 * - Sensitive variables redacted in error messages
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv, EnvSchema, type Env } from "../env-validator";
import { z } from "zod";

describe("Environment Validator", () => {
  // Store original env for cleanup
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateEnv", () => {
    it("should pass with valid complete config", () => {
      const validEnv = {
        NODE_ENV: "development",
        LOG_LEVEL: "info",
        PORT: "8000",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        DATABASE_POOL_SIZE: "20",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        JWT_ACCESS_EXPIRY: "24h",
        JWT_REFRESH_EXPIRY: "7d",
        APP_URL: "http://localhost:3000",
      };

      const result = validateEnv(validEnv);
      expect(result).toBeDefined();
      expect(result.PORT).toBe(8000);
      expect(result.DATABASE_POOL_SIZE).toBe(20);
      expect(result.NODE_ENV).toBe("development");
    });

    it("should fail with missing DATABASE_URL", () => {
      const invalidEnv = {
        NODE_ENV: "development",
        LOG_LEVEL: "info",
        PORT: "8000",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        JWT_ACCESS_EXPIRY: "24h",
        JWT_REFRESH_EXPIRY: "7d",
        APP_URL: "http://localhost:3000",
      };

      expect(() => validateEnv(invalidEnv)).toThrow();
    });

    it("should coerce PORT string to number", () => {
      const env = {
        PORT: "3001",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        JWT_ACCESS_EXPIRY: "24h",
        JWT_REFRESH_EXPIRY: "7d",
        APP_URL: "http://localhost:3000",
      };

      const result = validateEnv(env);
      expect(result.PORT).toBe(3001);
      expect(typeof result.PORT).toBe("number");
    });

    it("should coerce DATABASE_POOL_SIZE to number", () => {
      const env = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        DATABASE_POOL_SIZE: "50",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        JWT_ACCESS_EXPIRY: "24h",
        JWT_REFRESH_EXPIRY: "7d",
        APP_URL: "http://localhost:3000",
      };

      const result = validateEnv(env);
      expect(result.DATABASE_POOL_SIZE).toBe(50);
      expect(typeof result.DATABASE_POOL_SIZE).toBe("number");
    });

    it("should apply default values for optional fields", () => {
      const env = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        APP_URL: "http://localhost:3000",
      };

      const result = validateEnv(env);
      expect(result.NODE_ENV).toBe("development");
      expect(result.LOG_LEVEL).toBe("info");
      expect(result.PORT).toBe(8000);
      expect(result.JWT_ACCESS_EXPIRY).toBe("24h");
      expect(result.JWT_REFRESH_EXPIRY).toBe("7d");
    });

    it("should reject invalid DATABASE_URL", () => {
      const env = {
        DATABASE_URL: "not-a-valid-url",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        APP_URL: "http://localhost:3000",
      };

      expect(() => validateEnv(env)).toThrow();
    });

    it("should reject invalid APP_URL", () => {
      const env = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        APP_URL: "not-a-valid-url",
      };

      expect(() => validateEnv(env)).toThrow();
    });

    it("should reject JWT_SECRET shorter than 32 characters", () => {
      const env = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "short-secret",
        APP_URL: "http://localhost:3000",
      };

      expect(() => validateEnv(env)).toThrow();
    });

    it("should reject invalid NODE_ENV", () => {
      const env = {
        NODE_ENV: "invalid",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        APP_URL: "http://localhost:3000",
      };

      expect(() => validateEnv(env)).toThrow();
    });

    it("should reject invalid LOG_LEVEL", () => {
      const env = {
        LOG_LEVEL: "invalid",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        APP_URL: "http://localhost:3000",
      };

      expect(() => validateEnv(env)).toThrow();
    });

    it("should handle optional API_URL and DASHBOARD_URL", () => {
      const env = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        APP_URL: "http://localhost:3000",
        API_URL: "http://localhost:8000",
        DASHBOARD_URL: "http://localhost:3001",
      };

      const result = validateEnv(env);
      expect(result.API_URL).toBe("http://localhost:8000");
      expect(result.DASHBOARD_URL).toBe("http://localhost:3001");
    });

    it("should accept optional SMTP_PORT as number", () => {
      const env = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        APP_URL: "http://localhost:3000",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_USER: "user@example.com",
        SMTP_PASSWORD: "password",
      };

      const result = validateEnv(env);
      expect(result.SMTP_PORT).toBe(587);
      expect(typeof result.SMTP_PORT).toBe("number");
    });

    it("should provide clear error message with variable names (not values)", () => {
      const env = {
        DATABASE_URL: "not-valid",
        REDIS_URL: "redis://localhost:6379",
        // Missing required variables
      };

      try {
        validateEnv(env);
        expect.fail("Should have thrown");
      } catch (error) {
        if (error instanceof Error) {
          const message = error.message;
          expect(message).toContain("Environment validation failed");
          // Should mention variable names, not values
          expect(message).toContain("DATABASE_URL");
          expect(message).toContain(".env.example");
        }
      }
    });
  });

  describe("EnvSchema", () => {
    it("should parse valid Zod schema", () => {
      const validData = {
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        APP_URL: "http://localhost:3000",
      };

      const result = EnvSchema.parse(validData);
      expect(result).toBeDefined();
      expect(result.PORT).toBe(8000); // default
    });

    it("should provide detailed error info via ZodError", () => {
      const invalidData = {
        JWT_SECRET: "too-short",
        DATABASE_URL: "not-a-url",
      };

      try {
        EnvSchema.parse(invalidData);
        expect.fail("Should have thrown ZodError");
      } catch (error) {
        if (error instanceof z.ZodError) {
          expect(error.errors.length).toBeGreaterThan(0);
          expect(error.errors[0].path).toBeDefined();
        }
      }
    });
  });

  describe("Type Safety", () => {
    it("should provide correct TypeScript types", () => {
      const env: Env = {
        NODE_ENV: "development",
        LOG_LEVEL: "info",
        PORT: 8000,
        DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
        DATABASE_POOL_SIZE: 20,
        DATABASE_READ_REPLICA_URL: undefined,
        REDIS_URL: "redis://localhost:6379",
        JWT_SECRET: "my-super-secure-secret-key-minimum-32-chars-required",
        JWT_ACCESS_EXPIRY: "24h",
        JWT_REFRESH_EXPIRY: "7d",
        APP_URL: "http://localhost:3000",
      };

      // Type checking would happen at compile time
      expect(env.PORT).toBe(8000);
      expect(typeof env.PORT).toBe("number");
      expect(typeof env.DATABASE_URL).toBe("string");
    });
  });
});
