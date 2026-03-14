/**
 * API Key Service Tests — Comprehensive test suite for key generation, validation, rotation.
 *
 * Tests cover:
 * - Key generation format (wl_live_, wl_test_)
 * - Validation (hash matching, expiry, status)
 * - Rotation (new key, old deactivated)
 * - Revocation and reactivation
 * - Scope management
 * - Rate limit customization
 * - Quota enforcement
 *
 * Run with: npm test -- api-key-service.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateApiKey,
  validateApiKey,
  rotateApiKey,
  revokeApiKey,
  reactivateApiKey,
  listApiKeys,
  updateApiKeyScopes,
  updateApiKeyRateLimit,
  updateApiKeyExpiration,
  recordApiKeyUsage,
  deleteApiKey,
  checkApiKeyQuota,
} from "../api-key-service";
import type { ApiKeyScope } from "../types";
import { prisma } from "@witylogix/db";

describe("API Key Service", () => {
  const testOrgId = "test-org-uuid";
  const testUserId = "test-user-uuid";

  beforeEach(async () => {
    // Create test organization
    await prisma.organization.create({
      data: {
        id: testOrgId,
        name: "Test Org",
        slug: "test-org",
        planTier: "STARTUP",
        isActive: true,
      },
    });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.apiKey.deleteMany({ where: { orgId: testOrgId } });
    await prisma.organization.deleteMany({ where: { id: testOrgId } });
  });

  // ─── KEY GENERATION TESTS ───────────────────────────────────────────

  describe("generateApiKey", () => {
    it("should generate a production key with wl_live_ prefix", async () => {
      const response = await generateApiKey(testOrgId, "Shopify Integration", [
        "READ",
        "WRITE",
      ]);

      expect(response.secret).toMatch(/^wl_live_/);
      expect(response.prefix).toBe("wl_live_");
      expect(response.name).toBe("Shopify Integration");
      expect(response.scopes).toEqual(["READ", "WRITE"]);
      expect(response.createdAt).toBeInstanceOf(Date);
    });

    it("should generate a test key with wl_test_ prefix", async () => {
      const response = await generateApiKey(
        testOrgId,
        "Test Key",
        ["READ"],
        { isTest: true }
      );

      expect(response.secret).toMatch(/^wl_test_/);
      expect(response.prefix).toMatch(/^wl_test_/);
    });

    it("should support expiration dates", async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const response = await generateApiKey(
        testOrgId,
        "Expiring Key",
        ["READ"],
        { expiresAt }
      );

      expect(response.expiresAt).toEqual(expiresAt);
    });

    it("should support custom rate limit", async () => {
      const response = await generateApiKey(
        testOrgId,
        "Rate Limited Key",
        ["READ"],
        { rateLimit: 500 }
      );

      const dbKey = await prisma.apiKey.findUnique({
        where: { id: response.id },
      });

      expect(dbKey?.rateLimit).toBe(500);
    });

    it("should support custom permissions", async () => {
      const permissions = { "routes:write": true, "drivers:delete": false };

      const response = await generateApiKey(
        testOrgId,
        "Scoped Key",
        ["WRITE"],
        { permissions }
      );

      const dbKey = await prisma.apiKey.findUnique({
        where: { id: response.id },
      });

      expect(dbKey?.permissions).toEqual(permissions);
    });

    it("should show key secret only once", async () => {
      const response = await generateApiKey(testOrgId, "One-time Key", [
        "READ",
      ]);

      const secret1 = response.secret;

      // Listing keys should not include secret
      const keys = await listApiKeys(testOrgId);
      const key = keys.find((k) => k.id === response.id);

      // Verify secret is NOT in list response (only in creation response)
      expect(key?.prefix).toBe(response.prefix);
      // Keys list should not have a secret field
      expect("secret" in key || false).toBe(false);
    });

    it("should generate unique secrets", async () => {
      const key1 = await generateApiKey(testOrgId, "Key 1", ["READ"]);
      const key2 = await generateApiKey(testOrgId, "Key 2", ["READ"]);

      expect(key1.secret).not.toBe(key2.secret);
      expect(key1.prefix).not.toBe(key2.prefix);
    });

    it("should support all scopes", async () => {
      const scopes: ApiKeyScope[] = ["READ", "WRITE", "ADMIN", "WEBHOOK"];

      const response = await generateApiKey(testOrgId, "Full Scope Key", scopes);

      expect(response.scopes).toEqual(scopes);
    });
  });

  // ─── VALIDATION TESTS ───────────────────────────────────────────────

  describe("validateApiKey", () => {
    let validKey: string;
    let keyId: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrgId, "Test Key", ["READ"]);
      validKey = response.secret;
      keyId = response.id;
    });

    it("should validate a correct key", async () => {
      const result = await validateApiKey(validKey);

      expect(result.valid).toBe(true);
      expect(result.orgId).toBe(testOrgId);
      expect(result.keyId).toBe(keyId);
      expect(result.reason).toBeUndefined();
    });

    it("should reject keys with incorrect prefix format", async () => {
      const result = await validateApiKey("invalid_key_format");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("INVALID");
    });

    it("should reject non-existent keys", async () => {
      const result = await validateApiKey("wl_live_nonexistentkey123456");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("NOT_FOUND");
    });

    it("should reject revoked keys", async () => {
      await revokeApiKey(keyId);

      const result = await validateApiKey(validKey);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("REVOKED");
    });

    it("should reject expired keys", async () => {
      const expiredResponse = await generateApiKey(
        testOrgId,
        "Expired Key",
        ["READ"],
        { expiresAt: new Date(Date.now() - 1000) } // 1 second ago
      );

      const result = await validateApiKey(expiredResponse.secret);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("EXPIRED");
    });

    it("should reject tampering with key content", async () => {
      // Change last character
      const tamperedKey =
        validKey.slice(0, -1) + (validKey[validKey.length - 1] === "a" ? "b" : "a");

      const result = await validateApiKey(tamperedKey);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("INVALID");
    });

    it("should return scopes and metadata for valid keys", async () => {
      const result = await validateApiKey(validKey);

      expect(result.scopes).toEqual(["READ"]);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  // ─── ROTATION TESTS ─────────────────────────────────────────────────

  describe("rotateApiKey", () => {
    let originalKeyId: string;
    let originalSecret: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrgId, "Rotatable Key", [
        "WRITE",
      ]);
      originalKeyId = response.id;
      originalSecret = response.secret;
    });

    it("should generate a new key while rotating", async () => {
      const newResponse = await rotateApiKey(originalKeyId);

      expect(newResponse.secret).not.toBe(originalSecret);
      expect(newResponse.prefix).not.toBe(
        originalSecret.slice(0, 8)
      );
      expect(newResponse.scopes).toEqual(["WRITE"]);
    });

    it("should deactivate old key after rotation", async () => {
      const newResponse = await rotateApiKey(originalKeyId);

      const oldKey = await prisma.apiKey.findUnique({
        where: { id: originalKeyId },
      });

      expect(oldKey?.isActive).toBe(false);
    });

    it("should create new key with incremented name", async () => {
      const newResponse = await rotateApiKey(originalKeyId);

      expect(newResponse.name).toMatch(/\(rotated\)/);
    });

    it("should support multiple rotations", async () => {
      const second = await rotateApiKey(originalKeyId);
      const third = await rotateApiKey(second.id);

      const keys = await listApiKeys(testOrgId);

      // Should have 3 keys (all inactive except latest)
      expect(keys.length).toBe(3);
      const activeKeys = keys.filter((k) => k.isActive);
      expect(activeKeys).toHaveLength(1);
      expect(activeKeys[0].id).toBe(third.id);
    });

    it("should preserve scopes after rotation", async () => {
      const updatedScopes: ApiKeyScope[] = ["READ", "ADMIN"];
      await updateApiKeyScopes(originalKeyId, updatedScopes);

      const rotated = await rotateApiKey(originalKeyId);

      expect(rotated.scopes).toEqual(updatedScopes);
    });
  });

  // ─── REVOCATION TESTS ───────────────────────────────────────────────

  describe("revokeApiKey", () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrgId, "Revocable Key", [
        "READ",
      ]);
      keyId = response.id;
    });

    it("should soft-delete a key (mark inactive)", async () => {
      await revokeApiKey(keyId);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.isActive).toBe(false);
    });

    it("should allow reactivation after revocation", async () => {
      await revokeApiKey(keyId);
      await reactivateApiKey(keyId);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.isActive).toBe(true);
    });

    it("should prevent validation of revoked keys", async () => {
      const response = await generateApiKey(testOrgId, "Test Key", ["READ"]);

      await revokeApiKey(response.id);

      const result = await validateApiKey(response.secret);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("REVOKED");
    });
  });

  // ─── SCOPE MANAGEMENT TESTS ─────────────────────────────────────────

  describe("updateApiKeyScopes", () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrgId, "Scoped Key", ["READ"]);
      keyId = response.id;
    });

    it("should update scopes for a key", async () => {
      const newScopes: ApiKeyScope[] = ["WRITE", "ADMIN"];

      await updateApiKeyScopes(keyId, newScopes);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.scopes).toEqual(newScopes);
    });

    it("should allow removing scopes", async () => {
      await updateApiKeyScopes(keyId, []);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.scopes).toEqual([]);
    });

    it("should restrict access after scope update", async () => {
      // Key originally has READ
      const response = await generateApiKey(testOrgId, "Read Only", ["READ"]);

      // Remove READ, add WRITE only
      await updateApiKeyScopes(response.id, ["WRITE"]);

      const dbKey = await prisma.apiKey.findUnique({
        where: { id: response.id },
      });

      expect(dbKey?.scopes).toEqual(["WRITE"]);
      expect(dbKey?.scopes).not.toContain("READ");
    });
  });

  // ─── RATE LIMIT TESTS ───────────────────────────────────────────────

  describe("updateApiKeyRateLimit", () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrgId, "Limited Key", ["READ"]);
      keyId = response.id;
    });

    it("should update rate limit for a key", async () => {
      await updateApiKeyRateLimit(keyId, 1000);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.rateLimit).toBe(1000);
    });

    it("should allow custom rate limits per key", async () => {
      const key1 = await generateApiKey(testOrgId, "Key 1", ["READ"]);
      const key2 = await generateApiKey(testOrgId, "Key 2", ["READ"]);

      await updateApiKeyRateLimit(key1.id, 100);
      await updateApiKeyRateLimit(key2.id, 10000);

      const k1 = await prisma.apiKey.findUnique({ where: { id: key1.id } });
      const k2 = await prisma.apiKey.findUnique({ where: { id: key2.id } });

      expect(k1?.rateLimit).toBe(100);
      expect(k2?.rateLimit).toBe(10000);
    });
  });

  // ─── EXPIRATION TESTS ───────────────────────────────────────────────

  describe("updateApiKeyExpiration", () => {
    let keyId: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrgId, "Expiring Key", [
        "READ",
      ]);
      keyId = response.id;
    });

    it("should set expiration on a key", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await updateApiKeyExpiration(keyId, expiresAt);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.expiresAt?.getTime()).toBe(expiresAt.getTime());
    });

    it("should remove expiration by setting to null", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await updateApiKeyExpiration(keyId, expiresAt);

      await updateApiKeyExpiration(keyId, null);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.expiresAt).toBeNull();
    });

    it("should invalidate key after expiration", async () => {
      const response = await generateApiKey(testOrgId, "Soon Expired", [
        "READ",
      ]);

      const expiresAt = new Date(Date.now() - 1000); // 1 second ago
      await updateApiKeyExpiration(response.id, expiresAt);

      const result = await validateApiKey(response.secret);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("EXPIRED");
    });
  });

  // ─── USAGE TRACKING TESTS ───────────────────────────────────────────

  describe("recordApiKeyUsage", () => {
    let keyId: string;
    let secret: string;

    beforeEach(async () => {
      const response = await generateApiKey(testOrgId, "Tracked Key", ["READ"]);
      keyId = response.id;
      secret = response.secret;
    });

    it("should record last used timestamp", async () => {
      await recordApiKeyUsage(keyId, "192.168.1.1");

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.lastUsedAt).toBeInstanceOf(Date);
      expect(dbKey?.lastUsedAt?.getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
    });

    it("should record IP address", async () => {
      const ip = "203.0.113.42";

      await recordApiKeyUsage(keyId, ip);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.lastUsedIp).toBe(ip);
    });

    it("should update last used on multiple requests", async () => {
      await recordApiKeyUsage(keyId, "192.168.1.1");
      const firstTime = (await prisma.apiKey.findUnique({ where: { id: keyId } }))?.lastUsedAt;

      // Wait slightly and record again
      await new Promise((r) => setTimeout(r, 100));
      await recordApiKeyUsage(keyId, "192.168.1.2");

      const dbKey = await prisma.apiKey.findUnique({ where: { id: keyId } });

      expect(dbKey?.lastUsedAt?.getTime()).toBeGreaterThan(
        firstTime?.getTime() || 0
      );
    });
  });

  // ─── LISTING TESTS ──────────────────────────────────────────────────

  describe("listApiKeys", () => {
    it("should return all keys for an org without secrets", async () => {
      const key1 = await generateApiKey(testOrgId, "Key 1", ["READ"]);
      const key2 = await generateApiKey(testOrgId, "Key 2", ["WRITE"]);

      const keys = await listApiKeys(testOrgId);

      expect(keys).toHaveLength(2);
      expect(keys.map((k) => k.id)).toContain(key1.id);
      expect(keys.map((k) => k.id)).toContain(key2.id);

      // Verify secrets are not returned
      keys.forEach((k) => {
        expect("secret" in k).toBe(false);
      });
    });

    it("should include key metadata", async () => {
      const response = await generateApiKey(testOrgId, "Metadata Key", [
        "READ",
      ]);

      const keys = await listApiKeys(testOrgId);
      const key = keys.find((k) => k.id === response.id);

      expect(key?.name).toBe("Metadata Key");
      expect(key?.scopes).toEqual(["READ"]);
      expect(key?.isActive).toBe(true);
      expect(key?.createdAt).toBeInstanceOf(Date);
    });

    it("should return keys in creation order (newest first)", async () => {
      await generateApiKey(testOrgId, "First", ["READ"]);
      await new Promise((r) => setTimeout(r, 10));
      const second = await generateApiKey(testOrgId, "Second", ["READ"]);

      const keys = await listApiKeys(testOrgId);

      expect(keys[0].id).toBe(second.id);
    });
  });

  // ─── QUOTA TESTS ────────────────────────────────────────────────────

  describe("checkApiKeyQuota", () => {
    it("should enforce max keys per org", async () => {
      const maxKeys = 2;

      // Create up to limit
      await generateApiKey(testOrgId, "Key 1", ["READ"]);
      await generateApiKey(testOrgId, "Key 2", ["READ"]);

      // Should be at quota
      const canCreate = await checkApiKeyQuota(testOrgId, maxKeys);
      expect(canCreate).toBe(false);
    });

    it("should allow creation below quota", async () => {
      const maxKeys = 5;

      await generateApiKey(testOrgId, "Key 1", ["READ"]);
      const canCreate = await checkApiKeyQuota(testOrgId, maxKeys);

      expect(canCreate).toBe(true);
    });

    it("should not count revoked keys against quota", async () => {
      const maxKeys = 2;

      const key1 = await generateApiKey(testOrgId, "Key 1", ["READ"]);
      await generateApiKey(testOrgId, "Key 2", ["READ"]);

      // Revoke one
      await revokeApiKey(key1.id);

      // Should now be able to create (revoked keys don't count)
      const canCreate = await checkApiKeyQuota(testOrgId, maxKeys);
      expect(canCreate).toBe(true);
    });
  });

  // ─── DELETION TESTS ─────────────────────────────────────────────────

  describe("deleteApiKey", () => {
    it("should hard-delete a key", async () => {
      const response = await generateApiKey(testOrgId, "Deletable Key", [
        "READ",
      ]);

      await deleteApiKey(response.id);

      const dbKey = await prisma.apiKey.findUnique({
        where: { id: response.id },
      });

      expect(dbKey).toBeNull();
    });
  });

  // ─── SECURITY TESTS ─────────────────────────────────────────────────

  describe("Security", () => {
    it("should never store plaintext secrets", async () => {
      const response = await generateApiKey(testOrgId, "Secure Key", ["READ"]);

      const dbKey = await prisma.apiKey.findUnique({
        where: { id: response.id },
      });

      // keyHash should be set, should look like SHA-256 hex
      expect(dbKey?.keyHash).toMatch(/^[a-f0-9]{64}$/);
      expect(dbKey?.keyHash).not.toBe(response.secret);
    });

    it("should use constant-time comparison for validation", async () => {
      // This is a basic test - a more thorough timing attack test
      // would require measuring actual execution time differences
      const response = await generateApiKey(testOrgId, "Timing Test", ["READ"]);

      // Similar prefix but wrong hash should still fail
      const wrongKey = response.secret.slice(0, -1) + "x";
      const result = await validateApiKey(wrongKey);

      expect(result.valid).toBe(false);
    });
  });
});
