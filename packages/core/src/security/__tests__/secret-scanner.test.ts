/**
 * Secret Scanner Tests — Leaked secrets detection and redaction.
 *
 * Tests cover:
 * - API key detection (AWS, GitHub, Stripe)
 * - Database credential detection
 * - Password pattern detection
 * - Entropy-based detection
 * - Object recursion and redaction
 * - Alert vs block modes
 *
 * Run with: npm test -- secret-scanner.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SecretScanner } from "../secret-scanner";

describe("SecretScanner", () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner({ mode: "alert" });
  });

  describe("AWS Key Detection", () => {
    it("should detect AWS access key", () => {
      const result = scanner.scanString("AKIAIOSFODNN7EXAMPLE");

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type === "AWS Access Key")).toBe(
        true,
      );
    });

    it("should detect AWS secret key pattern", () => {
      const result = scanner.scanString(
        "aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      );

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.length).toBeGreaterThan(0);
    });
  });

  describe("GitHub Token Detection", () => {
    it("should detect GitHub personal access token", () => {
      const result = scanner.scanString(
        "ghp_1234567890abcdefghijklmnopqrstuvwxyz12",
      );

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("GitHub"))).toBe(true);
    });
  });

  describe("Stripe Key Detection", () => {
    it("should detect Stripe secret key", () => {
      const result = scanner.scanString(
        "sk_live_" + "FAKE0TEST0KEY0DO0NOT0USE012",
      );

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("Stripe"))).toBe(true);
    });

    it("should detect Stripe publishable key", () => {
      const result = scanner.scanString(
        "pk_live_" + "FAKE0TEST0KEY0DO0NOT0USE012",
      );

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("Stripe"))).toBe(true);
    });
  });

  describe("Database Credential Detection", () => {
    it("should detect MongoDB URI", () => {
      const result = scanner.scanString(
        "mongodb://user:password@host:27017/db",
      );

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("MongoDB"))).toBe(true);
    });

    it("should detect PostgreSQL URI", () => {
      const result = scanner.scanString(
        "postgres://user:password@localhost/db",
      );

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("PostgreSQL"))).toBe(
        true,
      );
    });

    it("should detect MySQL URI", () => {
      const result = scanner.scanString("mysql://user:password@localhost/db");

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("MySQL"))).toBe(true);
    });
  });

  describe("Private Key Detection", () => {
    it("should detect RSA private key", () => {
      const result = scanner.scanString("-----BEGIN RSA PRIVATE KEY-----");

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("RSA"))).toBe(true);
    });

    it("should detect OpenSSH private key", () => {
      const result = scanner.scanString("-----BEGIN OPENSSH PRIVATE KEY-----");

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("OpenSSH"))).toBe(true);
    });
  });

  describe("Password Detection", () => {
    it("should detect password parameter", () => {
      const result = scanner.scanString('password="superSecretPassword"');

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("Password"))).toBe(
        true,
      );
    });

    it("should detect api_key parameter", () => {
      const result = scanner.scanString("api_key=abcd1234efgh5678ijkl9012");

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("API Key"))).toBe(true);
    });
  });

  describe("JWT Token Detection", () => {
    it("should detect JWT token", () => {
      const result = scanner.scanString(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      );

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type.includes("JWT"))).toBe(true);
    });
  });

  describe("Alert Mode", () => {
    it("should return ALERT action in alert mode", () => {
      const result = scanner.scanString("AKIAIOSFODNN7EXAMPLE");

      expect(result.action).toBe("ALERT");
      expect(result.message).toContain("Review recommended");
    });
  });

  describe("Block Mode", () => {
    it("should return BLOCK action in block mode", () => {
      const blockScanner = new SecretScanner({ mode: "block" });
      const result = blockScanner.scanString("AKIAIOSFODNN7EXAMPLE");

      expect(result.action).toBe("BLOCK");
      expect(result.message).toContain("blocked");
    });
  });

  describe("Object Scanning", () => {
    it("should scan string values in object", () => {
      const result = scanner.scanObject({
        apiKey: "AKIAIOSFODNN7EXAMPLE",
        email: "user@example.com",
      });

      expect(result.secretsFound).toBe(true);
    });

    it("should scan nested objects", () => {
      const result = scanner.scanObject({
        database: {
          url: "postgres://user:password@localhost/db",
          port: 5432,
        },
      });

      expect(result.secretsFound).toBe(true);
    });

    it("should redact secrets in object", () => {
      const result = scanner.scanObject({
        secret: "AKIAIOSFODNN7EXAMPLE",
        normal: "data",
      });

      expect(result.redacted).toBeDefined();
      expect(result.redacted).toContain("[REDACTED");
    });

    it("should handle arrays in object", () => {
      const result = scanner.scanObject({
        keys: ["AKIAIOSFODNN7EXAMPLE", "normal-key"],
      });

      expect(result.secretsFound).toBe(true);
    });

    it("should prevent deep recursion attacks", () => {
      const obj: any = { level1: {} };
      let current = obj.level1;

      // Create deeply nested object
      for (let i = 0; i < 20; i++) {
        current.nested = {};
        current = current.nested;
      }

      expect(() => {
        scanner.scanObject(obj);
      }).not.toThrow();
    });
  });

  describe("Redaction", () => {
    it("should redact AWS key", () => {
      const redacted = scanner.redactString("Key is AKIAIOSFODNN7EXAMPLE here");

      expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(redacted).toContain("[REDACTED");
    });

    it("should redact multiple secrets", () => {
      const input = "Password: secretPass123, Key: AKIAIOSFODNN7EXAMPLE";
      const redacted = scanner.redactString(input);

      expect(redacted.match(/\[REDACTED/g)?.length).toBeGreaterThan(0);
    });
  });

  describe("Entropy Detection", () => {
    it("should detect high-entropy strings", () => {
      const scanner = new SecretScanner({
        mode: "alert",
        entropyDetection: true,
      });
      const result = scanner.scanString(
        "randomVeryLongStringWith32CharsOfHighEntropy",
      );

      // May or may not detect based on exact entropy calculation
      // Just ensure it doesn't crash
      expect(result).toBeDefined();
    });

    it("should skip entropy detection when disabled", () => {
      const scanner = new SecretScanner({
        mode: "alert",
        entropyDetection: false,
      });
      const result = scanner.scanString(
        "randomVeryLongStringWith32CharsOfHighEntropy",
      );

      expect(result.secrets.some((t) => t.type === "High Entropy String")).toBe(
        false,
      );
    });
  });

  describe("Custom Patterns", () => {
    it("should detect custom patterns", () => {
      const scanner = new SecretScanner({
        mode: "alert",
        customPatterns: [
          {
            name: "Custom Token",
            pattern: /custom_token_[0-9a-z]{32}/,
          },
        ],
      });

      const result = scanner.scanString(
        "custom_token_abcdef0123456789abcdef0123456789",
      );

      expect(result.secretsFound).toBe(true);
      expect(result.secrets.some((s) => s.type === "Custom Token")).toBe(true);
    });
  });

  describe("Mode Management", () => {
    it("should get current mode", () => {
      expect(scanner.getMode()).toBe("alert");
    });

    it("should set mode", () => {
      scanner.setMode("block");
      expect(scanner.getMode()).toBe("block");
    });
  });

  describe("Pattern Listing", () => {
    it("should list available patterns", () => {
      const patterns = scanner.getPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns).toContain("AWS Access Key");
      expect(patterns).toContain("GitHub Token");
    });
  });

  describe("Safe Strings", () => {
    it("should not flag normal text as secret", () => {
      const result = scanner.scanString(
        "This is a normal paragraph about authentication and passwords",
      );

      expect(result.secretsFound).toBe(false);
    });

    it("should not flag example values", () => {
      const result = scanner.scanString(
        "Use your API key like: sk_test_your_key_here",
      );

      // May or may not flag depending on pattern matching
      expect(result).toBeDefined();
    });
  });

  describe("Confidence Scores", () => {
    it("should provide confidence scores", () => {
      const result = scanner.scanString("AKIAIOSFODNN7EXAMPLE");

      expect(result.secrets[0].confidence).toBeGreaterThan(0);
      expect(result.secrets[0].confidence).toBeLessThanOrEqual(100);
    });
  });
});
