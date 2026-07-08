/**
 * Session Manager Tests
 *
 * Comprehensive test suite for:
 * - Session creation and lifecycle (CRUD)
 * - Token validation and expiry handling
 * - Max concurrent sessions enforcement
 * - Multi-tenant isolation
 * - Session cleanup and revocation
 * - Refresh token handling
 * - IP/user-agent tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── MOCK PRISMA ─────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  session: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@witylogix/db", () => ({
  prisma: mockPrisma,
  db: { authSession: mockPrisma.session },
}));

import {
  SessionManager,
  getSessionManager,
  resetSessionManager,
  type CreateSessionInput,
} from "../session-manager";
import type { AuthResult } from "../types";

// ─── TEST SUITE ─────────────────────────────────────────────

describe("SessionManager", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionManager();
    sessionManager = new SessionManager({
      maxConcurrentSessions: 3,
      sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── SESSION CREATION ────────────────────────────────────

  describe("createSession()", () => {
    it("should create a new session with valid auth result", async () => {
      const input: CreateSessionInput = {
        orgId: "org-123",
        userId: "user-456",
        providerId: "provider-local",
        authResult: {
          externalUserId: "local|user-456",
          email: "user@example.com",
          name: "John Doe",
          roles: ["DISPATCHER"],
          accessToken: "access_token_123",
          refreshToken: "refresh_token_456",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
      };

      const mockSession = {
        id: "session-789",
        userId: "user-456",
        orgId: "org-123",
        providerId: "provider-local",
        token: "access_token_123",
        expiresAt: input.authResult.expiresAt,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
        deviceId: null,
        mfaVerified: false,
        isRevoked: false,
        createdAt: new Date(),
      };

      mockPrisma.session.findMany.mockResolvedValue([]); // No existing sessions
      mockPrisma.session.create.mockResolvedValue(mockSession);

      const session = await sessionManager.createSession(input);

      expect(session).toEqual({
        sessionId: "session-789",
        userId: "user-456",
        orgId: "org-123",
        providerId: "provider-local",
        accessToken: "access_token_123",
        expiresAt: expect.any(Date),
        createdAt: expect.any(Date),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
        deviceId: null,
        mfaVerified: false,
        isRevoked: false,
      });

      expect(mockPrisma.session.create).toHaveBeenCalled();
    });

    it("should enforce max concurrent sessions limit", async () => {
      const input: CreateSessionInput = {
        orgId: "org-123",
        userId: "user-456",
        providerId: "provider-local",
        authResult: {
          externalUserId: "local|user-456",
          email: "user@example.com",
          roles: ["DISPATCHER"],
          accessToken: "new_token",
        },
      };

      // Simulate 3 existing sessions (at max)
      const existingSessions = [
        {
          id: "session-1",
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
        {
          id: "session-2",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          id: "session-3",
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      ];

      mockPrisma.session.findMany.mockResolvedValue(existingSessions);
      mockPrisma.session.create.mockResolvedValue({
        id: "session-4",
        userId: "user-456",
        orgId: "org-123",
        providerId: "provider-local",
        accessToken: "new_token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRevoked: false,
        createdAt: new Date(),
      });
      mockPrisma.session.update.mockResolvedValue({
        id: "session-1",
        isRevoked: true,
      });

      const session = await sessionManager.createSession(input);

      // Should revoke oldest session
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: "session-1" },
        data: {
          isRevoked: true,
          revokedAt: expect.any(Date),
        },
      });

      expect(session.sessionId).toBe("session-4");
    });

    it("should use provided auth result expiry or default timeout", async () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      const input: CreateSessionInput = {
        orgId: "org-123",
        userId: "user-456",
        providerId: "provider-oauth",
        authResult: {
          externalUserId: "auth0|xyz",
          email: "user@example.com",
          roles: ["DISPATCHER"],
          accessToken: "token123",
          expiresAt: futureDate,
        },
      };

      mockPrisma.session.findMany.mockResolvedValue([]);
      mockPrisma.session.create.mockResolvedValue({
        id: "session-789",
        userId: "user-456",
        orgId: "org-123",
        providerId: "provider-oauth",
        accessToken: "token123",
        expiresAt: futureDate,
        isRevoked: false,
        createdAt: new Date(),
      });

      await sessionManager.createSession(input);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: futureDate,
        }),
      });
    });
  });

  // ─── SESSION VALIDATION ──────────────────────────────────

  describe("validateSession()", () => {
    it("should validate active session", async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour future

      mockPrisma.session.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-456",
        orgId: "org-123",
        providerId: "provider-local",
        accessToken: "token123",
        expiresAt,
        isRevoked: false,
        createdAt: new Date(),
      });

      const result = await sessionManager.validateSession("session-123");

      expect(result.valid).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.sessionId).toBe("session-123");
      expect(result.error).toBeUndefined();
    });

    it("should reject revoked session", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: "session-123",
        isRevoked: true,
        createdAt: new Date(),
      });

      const result = await sessionManager.validateSession("session-123");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Session has been revoked");
    });

    it("should reject expired session", async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      mockPrisma.session.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-456",
        orgId: "org-123",
        expiresAt: pastDate,
        isRevoked: false,
        createdAt: new Date(),
      });

      mockPrisma.session.update.mockResolvedValue({
        id: "session-123",
        isRevoked: true,
      });

      const result = await sessionManager.validateSession("session-123");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Session has expired");

      // Should mark as revoked
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: "session-123" },
        data: {
          isRevoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });

    it("should return error for non-existent session", async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const result = await sessionManager.validateSession("non-existent");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Session not found");
    });
  });

  // ─── TOKEN REFRESH ──────────────────────────────────────

  describe("refreshSession()", () => {
    it("should refresh an active session with new token", async () => {
      const oldToken = "old_access_token";
      const newToken = "new_access_token";
      const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      mockPrisma.session.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-456",
        orgId: "org-123",
        providerId: "provider-oauth",
        token: oldToken,
        isRevoked: false,
        createdAt: new Date(),
      });

      mockPrisma.session.update.mockResolvedValue({
        id: "session-123",
        userId: "user-456",
        orgId: "org-123",
        providerId: "provider-oauth",
        token: newToken,
        expiresAt: newExpiresAt,
        mfaVerified: false,
        isRevoked: false,
        createdAt: new Date(),
      });

      const result = await sessionManager.refreshSession(
        "session-123",
        newToken,
        newExpiresAt,
      );

      expect(result.accessToken).toBe(newToken);
      expect(result.expiresAt).toEqual(newExpiresAt);
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: "session-123" },
        data: {
          token: newToken,
          expiresAt: newExpiresAt,
          lastActivityAt: expect.any(Date),
        },
      });
    });

    it("should reject refresh of revoked session", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: "session-123",
        isRevoked: true,
      });

      await expect(
        sessionManager.refreshSession("session-123", "new_token"),
      ).rejects.toThrow("Cannot refresh revoked session");
    });

    it("should use default expiry if not provided", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-456",
        orgId: "org-123",
        isRevoked: false,
      });

      mockPrisma.session.update.mockResolvedValue({
        id: "session-123",
        token: "new_token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        mfaVerified: false,
        isRevoked: false,
        createdAt: new Date(),
      });

      await sessionManager.refreshSession("session-123", "new_token");

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: "session-123" },
        data: expect.objectContaining({
          token: "new_token",
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  // ─── SESSION REVOCATION ──────────────────────────────────

  describe("revokeSession()", () => {
    it("should revoke a session", async () => {
      mockPrisma.session.update.mockResolvedValue({
        id: "session-123",
        isRevoked: true,
      });

      await sessionManager.revokeSession("session-123");

      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: "session-123" },
        data: {
          isRevoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  // ─── LIST ACTIVE SESSIONS ───────────────────────────────

  describe("listActiveSessions()", () => {
    it("should list active sessions for user in org", async () => {
      const sessions = [
        {
          id: "session-1",
          userId: "user-456",
          orgId: "org-123",
          providerId: "provider-local",
          token: "token1",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000),
          isRevoked: false,
          mfaVerified: false,
        },
        {
          id: "session-2",
          userId: "user-456",
          orgId: "org-123",
          providerId: "provider-local",
          token: "token2",
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000),
          isRevoked: false,
          mfaVerified: false,
        },
      ];

      mockPrisma.session.findMany.mockResolvedValue(sessions);

      const result = await sessionManager.listActiveSessions(
        "user-456",
        "org-123",
      );

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe("session-1");
      expect(result[1].sessionId).toBe("session-2");
      expect(mockPrisma.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-456",
          orgId: "org-123",
          isRevoked: false,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { lastActivityAt: "desc" },
      });
    });

    it("should return empty list if no active sessions", async () => {
      mockPrisma.session.findMany.mockResolvedValue([]);

      const result = await sessionManager.listActiveSessions(
        "user-456",
        "org-123",
      );

      expect(result).toEqual([]);
    });
  });

  // ─── REVOKE ALL SESSIONS ────────────────────────────────

  describe("revokeAllSessions()", () => {
    it("should revoke all sessions for user in org", async () => {
      mockPrisma.session.updateMany.mockResolvedValue({
        count: 3,
      });

      await sessionManager.revokeAllSessions("user-456", "org-123");

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user-456",
          orgId: "org-123",
          isRevoked: false,
        },
        data: {
          isRevoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });

    it("should exclude current session when provided", async () => {
      mockPrisma.session.updateMany.mockResolvedValue({
        count: 2,
      });

      await sessionManager.revokeAllSessions(
        "user-456",
        "org-123",
        "session-999",
      );

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user-456",
          orgId: "org-123",
          isRevoked: false,
          NOT: { id: "session-999" },
        },
        data: {
          isRevoked: true,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  // ─── CLEANUP ─────────────────────────────────────────────

  describe("cleanupExpiredSessions()", () => {
    it("should delete expired and revoked sessions beyond retention", async () => {
      mockPrisma.session.deleteMany.mockResolvedValueOnce({ count: 10 }); // Expired
      mockPrisma.session.deleteMany.mockResolvedValueOnce({ count: 5 }); // Revoked

      await sessionManager.cleanupExpiredSessions(90, 30);

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledTimes(2);
      // First call: expired sessions
      expect(mockPrisma.session.deleteMany).toHaveBeenNthCalledWith(1, {
        where: {
          isRevoked: false,
          expiresAt: { lt: expect.any(Date) },
        },
      });
      // Second call: revoked sessions
      expect(mockPrisma.session.deleteMany).toHaveBeenNthCalledWith(2, {
        where: {
          isRevoked: true,
          revokedAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  // ─── SESSION STATS ──────────────────────────────────────

  describe("getSessionStats()", () => {
    it("should return session statistics for user", async () => {
      mockPrisma.session.count.mockResolvedValueOnce(10); // Total
      mockPrisma.session.count.mockResolvedValueOnce(3); // Active
      mockPrisma.session.count.mockResolvedValueOnce(7); // Revoked

      const stats = await sessionManager.getSessionStats("user-456", "org-123");

      expect(stats).toEqual({
        totalSessions: 10,
        activeSessions: 3,
        revokedSessions: 7,
      });
    });
  });

  // ─── MULTI-TENANT ISOLATION ─────────────────────────────

  describe("Multi-tenant isolation", () => {
    it("should isolate sessions by organization", async () => {
      const user = "user-456";

      mockPrisma.session.findMany
        .mockResolvedValueOnce([]) // org-1 sessions
        .mockResolvedValueOnce([
          {
            id: "session-org2",
            userId: user,
            orgId: "org-2",
            providerId: "provider-local",
            token: "token-org2",
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            isRevoked: false,
            mfaVerified: false,
          },
        ]); // org-2 sessions

      const org1Sessions = await sessionManager.listActiveSessions(
        user,
        "org-1",
      );
      const org2Sessions = await sessionManager.listActiveSessions(
        user,
        "org-2",
      );

      expect(org1Sessions).toHaveLength(0);
      expect(org2Sessions).toHaveLength(1);

      // Verify each query included correct orgId
      expect(mockPrisma.session.findMany).toHaveBeenNthCalledWith(1, {
        where: expect.objectContaining({ orgId: "org-1" }),
        orderBy: { lastActivityAt: "desc" },
      });
      expect(mockPrisma.session.findMany).toHaveBeenNthCalledWith(2, {
        where: expect.objectContaining({ orgId: "org-2" }),
        orderBy: { lastActivityAt: "desc" },
      });
    });
  });

  // ─── SINGLETON PATTERN ──────────────────────────────────

  describe("Singleton pattern", () => {
    it("should return same instance from getSessionManager()", () => {
      resetSessionManager();

      const manager1 = getSessionManager();
      const manager2 = getSessionManager();

      expect(manager1).toBe(manager2);
    });

    it("should pass options to first instantiation", () => {
      resetSessionManager();

      const manager = getSessionManager({
        maxConcurrentSessions: 5,
        sessionTimeoutMs: 12 * 60 * 60 * 1000,
      });

      // Create session and verify max concurrent is enforced
      const input: CreateSessionInput = {
        orgId: "org-123",
        userId: "user-456",
        providerId: "provider-local",
        authResult: {
          externalUserId: "local|user-456",
          email: "user@example.com",
          roles: ["DISPATCHER"],
          accessToken: "token",
        },
      };

      // Simulate 5 existing sessions
      mockPrisma.session.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          id: `session-${i}`,
          createdAt: new Date(),
        })),
      );
      mockPrisma.session.create.mockResolvedValue({
        id: "session-new",
        userId: "user-456",
        orgId: "org-123",
        providerId: "provider-local",
        accessToken: "token",
        expiresAt: new Date(),
        isRevoked: false,
        createdAt: new Date(),
      });

      return manager.createSession(input).then(() => {
        // Should revoke oldest when at max
        expect(mockPrisma.session.update).toHaveBeenCalled();
      });
    });
  });
});
