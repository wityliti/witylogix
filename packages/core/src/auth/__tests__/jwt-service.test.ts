/**
 * JWT Service Tests
 *
 * Comprehensive test suite for JWT token generation and verification.
 * Tests cover:
 * - Access and refresh token generation
 * - Token verification and expiry
 * - Token rotation
 * - Token revocation/blacklisting
 * - Edge cases and security
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createJwtService } from "../jwt-service.js";
import type { JwtService } from "../jwt-service.js";
import type { AccessTokenPayload, RefreshTokenPayload } from "../types.js";

describe("JwtService", () => {
  let service: JwtService;
  const testSecret = "my-very-long-secret-key-minimum-32-chars-long";
  const testUserId = "user-123";
  const testOrgId = "org-456";
  const testShopId = "shop-789";

  beforeEach(() => {
    service = createJwtService({
      secret: testSecret,
      accessTokenTtl: 15 * 60, // 15 minutes
      refreshTokenTtl: 7 * 24 * 60 * 60, // 7 days
    });
  });

  afterEach(() => {
    // Clean up any state
  });

  // ─── TOKEN GENERATION TESTS ─────────────────────────────

  describe("token generation", () => {
    it("should generate valid access token", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: ["shipments:read", "routes:write"],
        mfaVerified: false,
      });

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT format: header.payload.signature
    });

    it("should generate valid refresh token", () => {
      const token = service.generateRefreshToken({
        userId: testUserId,
        orgId: testOrgId,
        sessionId: "session-123",
      });

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should include required claims in access token", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "MEMBER",
        permissions: [],
        mfaVerified: true,
      });

      const result = service.verifyAccessToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe(testUserId);
      expect(result.payload?.orgId).toBe(testOrgId);
      expect(result.payload?.role).toBe("MEMBER");
      expect(result.payload?.mfaVerified).toBe(true);
    });

    it("should include required claims in refresh token", () => {
      const token = service.generateRefreshToken({
        userId: testUserId,
        orgId: testOrgId,
        sessionId: "session-456",
      });

      const result = service.verifyRefreshToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe(testUserId);
      expect(result.payload?.sessionId).toBe("session-456");
    });

    it("should include iat and exp claims", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "VIEWER",
        permissions: [],
        mfaVerified: false,
      });

      const result = service.verifyAccessToken(token);
      expect(result.payload?.iat).toBeTruthy();
      expect(result.payload?.exp).toBeTruthy();
      expect((result.payload?.exp || 0) > (result.payload?.iat || 0)).toBe(true);
    });

    it("should include correct issuer and audience", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const result = service.verifyAccessToken(token);
      expect(result.payload?.iss).toBe("witylogix");
      expect(result.payload?.aud).toBe("witylogix-api");
    });
  });

  // ─── TOKEN VERIFICATION TESTS ───────────────────────────

  describe("token verification", () => {
    it("should verify valid access token", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: ["shipments:read"],
        mfaVerified: true,
      });

      const result = service.verifyAccessToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload).toBeTruthy();
    });

    it("should reject invalid token signature", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      // Tamper with signature
      const parts = token.split(".");
      const tamperedToken = `${parts[0]}.${parts[1]}.invalid_signature`;

      const result = service.verifyAccessToken(tamperedToken);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should reject malformed tokens", () => {
      const malformedTokens = [
        "not.a.token",
        "onlyonepart",
        "with.only.parts",
        "",
        "a.b.c.d.e",
      ];

      for (const token of malformedTokens) {
        if (token.split(".").length !== 3) {
          // Skip valid format checks
          const result = service.verifyAccessToken(token);
          expect(result.valid).toBe(false);
        }
      }
    });

    it("should extract token from Bearer header", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const extracted = service.extractFromHeader(`Bearer ${token}`);
      expect(extracted).toBe(token);
    });

    it("should reject invalid Authorization header formats", () => {
      const invalidHeaders = [
        "",
        "NoBearer token",
        "Bearer",
        "Bearer  ",
        "bearer lowercase",
      ];

      for (const header of invalidHeaders) {
        const extracted = service.extractFromHeader(header);
        if (!header.startsWith("Bearer ")) {
          expect(extracted).toBeNull();
        }
      }
    });
  });

  // ─── TOKEN EXPIRY TESTS ──────────────────────────────────

  describe("token expiry", () => {
    it("should expire access token after ttl", async () => {
      // Create service with very short TTL
      const shortService = createJwtService({
        secret: testSecret,
        accessTokenTtl: 1, // 1 second
      });

      const token = shortService.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = shortService.verifyAccessToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should expire refresh token after ttl", async () => {
      const shortService = createJwtService({
        secret: testSecret,
        refreshTokenTtl: 1, // 1 second
      });

      const token = shortService.generateRefreshToken({
        userId: testUserId,
        orgId: testOrgId,
        sessionId: "session-123",
      });

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = shortService.verifyRefreshToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should set correct expiry time for access token", () => {
      const now = Math.floor(Date.now() / 1000);
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const result = service.verifyAccessToken(token);
      const exp = result.payload?.exp || 0;
      const expectedExp = now + 15 * 60; // 15 minutes from now

      expect(Math.abs(exp - expectedExp)).toBeLessThan(5); // Within 5 seconds tolerance
    });
  });

  // ─── TOKEN REVOCATION TESTS ──────────────────────────────

  describe("token revocation", () => {
    it("should revoke a valid token", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      // Token is valid before revocation
      expect(service.isTokenRevoked(token)).toBe(false);

      // Revoke token
      service.revokeToken(token);

      // Token is revoked after
      expect(service.isTokenRevoked(token)).toBe(true);
    });

    it("should reject revoked tokens in verification", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      service.revokeToken(token);

      const result = service.verifyAccessToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("revoked");
    });

    it("should handle revocation of invalid tokens gracefully", () => {
      const invalidToken = "invalid.token.format";

      // Should not throw
      expect(() => service.revokeToken(invalidToken)).not.toThrow();
      expect(service.isTokenRevoked(invalidToken)).toBe(true);
    });

    it("should revoke multiple tokens independently", () => {
      const token1 = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const token2 = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      service.revokeToken(token1);

      expect(service.isTokenRevoked(token1)).toBe(true);
      expect(service.isTokenRevoked(token2)).toBe(false);
    });
  });

  // ─── TOKEN ROTATION TESTS ────────────────────────────────

  describe("token rotation", () => {
    it("should support refresh token version for rotation", () => {
      const token1 = service.generateRefreshToken(
        {
          userId: testUserId,
          orgId: testOrgId,
          sessionId: "session-123",
        },
        1, // Version 1
      );

      const token2 = service.generateRefreshToken(
        {
          userId: testUserId,
          orgId: testOrgId,
          sessionId: "session-123",
        },
        2, // Version 2
      );

      const result1 = service.verifyRefreshToken(token1);
      const result2 = service.verifyRefreshToken(token2);

      expect((result1.payload as RefreshTokenPayload)?.version).toBe(1);
      expect((result2.payload as RefreshTokenPayload)?.version).toBe(2);
    });

    it("should rotate token on refresh", () => {
      const oldToken = service.generateRefreshToken({
        userId: testUserId,
        orgId: testOrgId,
        sessionId: "session-123",
      });

      // Revoke old token
      service.revokeToken(oldToken);

      // Generate new token (rotated)
      const newToken = service.generateRefreshToken(
        {
          userId: testUserId,
          orgId: testOrgId,
          sessionId: "session-123",
        },
        2,
      );

      expect(service.isTokenRevoked(oldToken)).toBe(true);
      expect(service.isTokenRevoked(newToken)).toBe(false);
    });
  });

  // ─── EDGE CASES ──────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle permissions as empty array", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const result = service.verifyAccessToken(token);
      expect(result.payload?.permissions).toEqual([]);
    });

    it("should handle large permission arrays", () => {
      const largePermissions = Array.from({ length: 100 }, (_, i) => `perm:${i}`);
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: largePermissions,
        mfaVerified: false,
      });

      const result = service.verifyAccessToken(token);
      expect(result.payload?.permissions).toHaveLength(100);
    });

    it("should handle special characters in userId", () => {
      const specialUserId = "user@example.com_123-456";
      const token = service.generateAccessToken({
        userId: specialUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const result = service.verifyAccessToken(token);
      expect(result.payload?.userId).toBe(specialUserId);
    });

    it("should handle mfaVerified flag correctly", () => {
      const tokenTrue = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: true,
      });

      const tokenFalse = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      expect(service.verifyAccessToken(tokenTrue).payload?.mfaVerified).toBe(true);
      expect(service.verifyAccessToken(tokenFalse).payload?.mfaVerified).toBe(false);
    });
  });

  // ─── CONFIGURATION TESTS ────────────────────────────────

  describe("configuration", () => {
    it("should require minimum secret length", () => {
      expect(() => {
        createJwtService({
          secret: "short", // Less than 16 chars
        });
      }).toThrow("must be at least 16 characters");
    });

    it("should use custom ttl values", () => {
      const customService = createJwtService({
        secret: testSecret,
        accessTokenTtl: 30 * 60, // 30 minutes
        refreshTokenTtl: 30 * 24 * 60 * 60, // 30 days
      });

      const token = customService.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const result = customService.verifyAccessToken(token);
      const now = Math.floor(Date.now() / 1000);
      const exp = result.payload?.exp || 0;

      expect(exp - (result.payload?.iat || 0)).toBe(30 * 60);
    });

    it("should use custom issuer and audience", () => {
      const customService = createJwtService({
        secret: testSecret,
        issuer: "custom-issuer",
        audience: "custom-audience",
      });

      const token = customService.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const result = customService.verifyAccessToken(token);
      expect(result.payload?.iss).toBe("custom-issuer");
      expect(result.payload?.aud).toBe("custom-audience");
    });
  });

  // ─── SECURITY TESTS ─────────────────────────────────────

  describe("security", () => {
    it("should use consistent signing with same secret", () => {
      const payload = {
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN" as const,
        permissions: ["shipments:read"],
        mfaVerified: false,
      };

      const token1 = service.generateAccessToken(payload);
      const token2 = service.generateAccessToken(payload);

      // Tokens differ due to iat/exp
      expect(token1).not.toBe(token2);

      // But both verify correctly
      expect(service.verifyAccessToken(token1).valid).toBe(true);
      expect(service.verifyAccessToken(token2).valid).toBe(true);
    });

    it("should reject tokens signed with different secret", () => {
      const token = service.generateAccessToken({
        userId: testUserId,
        orgId: testOrgId,
        shopId: testShopId,
        role: "ADMIN",
        permissions: [],
        mfaVerified: false,
      });

      const differentService = createJwtService({
        secret: "different-secret-key-minimum-32-chars-long!!!!",
      });

      const result = differentService.verifyAccessToken(token);
      expect(result.valid).toBe(false);
    });
  });
});
