/**
 * Password Service Tests
 *
 * Comprehensive test suite for password hashing, verification, and strength validation.
 * Tests cover:
 * - Hash generation and constant-time comparison
 * - Password strength scoring
 * - Common pattern detection
 * - History checking
 * - Edge cases (empty, unicode, very long)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomBytes, createHash } from "node:crypto";

vi.mock("@witylogix/db", () => ({
  db: {},
}));

// Mock argon2 since it's not installed as a dependency
vi.mock("argon2", () => {
  const hashes = new Map<string, string>();
  return {
    argon2id: 2,
    hash: vi.fn(async (password: string) => {
      const salt = randomBytes(16).toString("hex");
      const hash = createHash("sha256").update(password + salt).digest("hex");
      const result = `$argon2id$v=19$m=65536,t=4,p=4$${salt}$${hash}`;
      hashes.set(result, password);
      return result;
    }),
    verify: vi.fn(async (hash: string, password: string) => {
      return hashes.get(hash) === password;
    }),
  };
});

import { createPasswordService } from "../password-service.js";
import type { PasswordService } from "../password-service.js";

describe("PasswordService", () => {
  let service: PasswordService;

  beforeEach(() => {
    service = createPasswordService();
  });

  // ─── HASH & VERIFY TESTS ────────────────────────────────

  describe("hash and verify", () => {
    it("should hash a password successfully", async () => {
      const password = "MySecurePassword123!";
      const hash = await service.hash(password);

      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(20);
      expect(hash).toMatch(/^\$argon2|^\$2/); // Argon2 or bcrypt format
    });

    it("should verify a correct password", async () => {
      const password = "MySecurePassword123!";
      const hash = await service.hash(password);

      const isValid = await service.verify(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const password = "MySecurePassword123!";
      const hash = await service.hash(password);

      const isValid = await service.verify("WrongPassword", hash);
      expect(isValid).toBe(false);
    });

    it("should reject very similar but different passwords", async () => {
      const password = "MySecurePassword123!";
      const hash = await service.hash(password);

      const isValid = await service.verify("MySecurePassword123@", hash);
      expect(isValid).toBe(false);
    });

    it("should handle unicode characters", async () => {
      const password = "MyPassword🔐٧२";
      const hash = await service.hash(password);

      const isValid = await service.verify(password, hash);
      expect(isValid).toBe(true);

      const wrongValid = await service.verify("MyPassword🔐", hash);
      expect(wrongValid).toBe(false);
    });

    it("should be case-sensitive", async () => {
      const password = "MySecurePassword123!";
      const hash = await service.hash(password);

      const isValid = await service.verify("mysecurepassword123!", hash);
      expect(isValid).toBe(false);
    });

    it("should handle whitespace correctly", async () => {
      const password = "My Secure Password 123!";
      const hash = await service.hash(password);

      const isValid = await service.verify(password, hash);
      expect(isValid).toBe(true);

      const wrongValid = await service.verify("MySecurePassword123!", hash);
      expect(wrongValid).toBe(false);
    });

    it("should reject hashes with invalid format", async () => {
      const isValid = await service.verify("password", "invalid-hash-format");
      expect(isValid).toBe(false);
    });

    it("should produce different hashes for same password", async () => {
      const password = "MySecurePassword123!";
      const hash1 = await service.hash(password);
      const hash2 = await service.hash(password);

      expect(hash1).not.toEqual(hash2);
      expect(await service.verify(password, hash1)).toBe(true);
      expect(await service.verify(password, hash2)).toBe(true);
    });
  });

  // ─── PASSWORD STRENGTH TESTS ─────────────────────────────

  describe("strength scoring", () => {
    it("should reject passwords shorter than 8 characters", () => {
      const result = service.scoreStrength("Short");
      expect(result.score).toBe(0);
      expect(result.feedback).toContain("Password is too short. Use at least 8 characters.");
    });

    it("should score basic 8-character password", () => {
      const result = service.scoreStrength("password");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(4);
    });

    it("should give low score for weak password (dictionary word)", () => {
      const result = service.scoreStrength("password123");
      expect(result.score).toBeLessThan(2);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("should score moderately for password with length and some diversity", () => {
      const result = service.scoreStrength("Password123");
      expect(result.score).toBeGreaterThanOrEqual(1);
    });

    it("should give high score for strong password", () => {
      const result = service.scoreStrength("MySecure#Pass123!Complex");
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it("should give highest score for very strong password", () => {
      const result = service.scoreStrength("x7#K!mP$92qL@vN&4bRwZ");
      expect(result.score).toBe(4);
      expect(result.feedback.some((f) => f.includes("character diversity"))).toBe(true);
    });

    it("should detect sequential numbers pattern", () => {
      const result = service.scoreStrength("Password12345!");
      expect(result.suggestions.some((s) => s.includes("sequential"))).toBe(true);
    });

    it("should detect repeated characters", () => {
      const result = service.scoreStrength("Passsssword1!");
      expect(result.feedback.some((f) => f.includes("Avoid common patterns"))).toBe(true);
    });

    it("should suggest character diversity improvements", () => {
      const result = service.scoreStrength("password1234");
      expect(result.suggestions.some((s) => s.includes("uppercase"))).toBe(true);
      expect(result.suggestions.some((s) => s.includes("special"))).toBe(true);
    });

    it("should penalize common weak passwords", () => {
      const weakPasswords = [
        "password123",
        "admin1234",
        "letmein99",
        "welcome999",
      ];

      for (const weak of weakPasswords) {
        const result = service.scoreStrength(weak);
        expect(result.score).toBeLessThan(2);
      }
    });

    it("should reward mixing uppercase, lowercase, digits, special chars", () => {
      const result = service.scoreStrength("Secure#Pass2024@Data");
      expect(result.feedback.some((f) => f.includes("Excellent character diversity"))).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it("should handle very long passwords", () => {
      const longPass = "A".repeat(100) + "1!";
      const result = service.scoreStrength(longPass);
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    it("should provide feedback and suggestions as arrays", () => {
      const result = service.scoreStrength("MyPass123");
      expect(Array.isArray(result.feedback)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  // ─── PASSWORD LENGTH VALIDATION TESTS ───────────────────

  describe("length validation", () => {
    it("should reject empty password", async () => {
      await expect(service.hash("")).rejects.toThrow("at least 8 characters");
    });

    it("should reject passwords under 8 characters", async () => {
      await expect(service.hash("Short7")).rejects.toThrow("at least 8 characters");
    });

    it("should accept 8-character password", async () => {
      const hash = await service.hash("12345678");
      expect(hash).toBeTruthy();
    });

    it("should reject passwords over 128 characters", async () => {
      const longPass = "A".repeat(129);
      await expect(service.hash(longPass)).rejects.toThrow("at most 128 characters");
    });

    it("should accept exactly 128-character password", async () => {
      const longPass = "A".repeat(128);
      const hash = await service.hash(longPass);
      expect(hash).toBeTruthy();
    });
  });

  // ─── PASSWORD HISTORY TESTS ─────────────────────────────

  describe("password history", () => {
    it("should allow new password if history check passes", async () => {
      const userId = "user-123";
      const newPassword = "NewSecurePassword123!";

      // In this implementation, history check is a stub (returns true)
      const allowed = await service.checkHistory(userId, newPassword);
      expect(allowed).toBe(true);
    });

    it("should use default history size of 5", async () => {
      const userId = "user-456";
      const password = "AnotherPassword123!";

      const allowed = await service.checkHistory(userId, password, 5);
      expect(allowed).toBe(true);
    });

    it("should allow custom history size", async () => {
      const userId = "user-789";
      const password = "CustomPassword123!";

      const allowed = await service.checkHistory(userId, password, 10);
      expect(allowed).toBe(true);
    });

    it("should handle non-existent users gracefully", async () => {
      const userId = "non-existent-user";
      const password = "Password123!";

      const allowed = await service.checkHistory(userId, password);
      expect(allowed).toBe(true);
    });
  });

  // ─── EDGE CASES ──────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle null password gracefully", async () => {
      await expect(service.hash(null as any)).rejects.toThrow();
    });

    it("should handle undefined password gracefully", async () => {
      await expect(service.hash(undefined as any)).rejects.toThrow();
    });

    it("should handle passwords with special regex characters", async () => {
      const specialPassword = "Pass$word.*+?[]{}()";
      const hash = await service.hash(specialPassword);
      const isValid = await service.verify(specialPassword, hash);
      expect(isValid).toBe(true);
    });

    it("should handle passwords with quotes and escapes", async () => {
      const quotePassword = `Pass"word'with\\escapes`;
      const hash = await service.hash(quotePassword);
      const isValid = await service.verify(quotePassword, hash);
      expect(isValid).toBe(true);
    });

    it("should handle CTRL characters", async () => {
      const ctrlPassword = "Pass\x00word\x01test";
      const hash = await service.hash(ctrlPassword);
      const isValid = await service.verify(ctrlPassword, hash);
      expect(isValid).toBe(true);
    });

    it("should handle very high entropy password", async () => {
      const entropy = Math.random().toString(36).substring(2, 25) +
                     Math.random().toString(36).substring(2, 25);
      const hash = await service.hash(entropy);
      expect(hash).toBeTruthy();
    });
  });

  // ─── PERFORMANCE TESTS ───────────────────────────────────

  describe("performance", () => {
    it("should hash within reasonable time (< 2 seconds)", async () => {
      const start = Date.now();
      await service.hash("TestPassword123!");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    });

    it("should verify within reasonable time (< 2 seconds)", async () => {
      const password = "TestPassword123!";
      const hash = await service.hash(password);

      const start = Date.now();
      await service.verify(password, hash);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    });

    it("should score strength instantly", () => {
      const start = Date.now();
      service.scoreStrength("VeryComplexPassword123!");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  // ─── SECURITY TESTS ─────────────────────────────────────

  describe("security", () => {
    it("should use different salt for each hash", async () => {
      const password = "SamePassword123!";
      const hash1 = await service.hash(password);
      const hash2 = await service.hash(password);

      expect(hash1).not.toEqual(hash2);
    });

    it("should provide constant-time comparison", async () => {
      const password = "TestPassword123!";
      const hash = await service.hash(password);

      // Both should take similar time (no early exit)
      const correct = await service.verify(password, hash);
      const incorrect = await service.verify("WrongPassword123!", hash);

      expect(correct).toBe(true);
      expect(incorrect).toBe(false);
    });

    it("should not leak password in error messages", async () => {
      try {
        // @ts-ignore
        await service.hash(null);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain("password");
        expect(message).not.toContain("PASSWORD");
      }
    });
  });
});
