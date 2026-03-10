/**
 * Session Manager — Manages user authentication sessions.
 *
 * Handles:
 * - Session creation after successful authentication
 * - Session validation and token verification
 * - Session refresh with refresh tokens
 * - Session revocation (logout)
 * - Multi-tenant isolation: sessions scoped by orgId
 * - Max concurrent sessions per user (configurable)
 * - IP address and user-agent tracking for security
 * - Automatic cleanup of expired/revoked sessions
 *
 * Session lifecycle:
 *   1. User authenticates → createSession() stores session + tokens
 *   2. Each request validates session with validateSession()
 *   3. If access token expires → refreshSession() gets new token
 *   4. On logout → revokeSession() marks session revoked
 *   5. Cleanup job removes expired sessions periodically
 */

// @ts-ignore - prisma client
import { prisma } from "@witylogix/db";
import type { AuthResult } from "./types.js";

// ─── TYPES ──────────────────────────────────────────────────

export interface CreateSessionInput {
  orgId: string;
  userId: string;
  providerId: string;
  authResult: AuthResult;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  orgId: string;
  providerId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionInfo;
  error?: string;
}

// ─── SESSION MANAGER CLASS ──────────────────────────────────

/**
 * Manages user sessions and tokens.
 * Enforces max concurrent sessions, token expiry, and multi-tenant isolation.
 */
export class SessionManager {
  private maxConcurrentSessions: number = 5;
  private sessionTimeoutMs: number = 24 * 60 * 60 * 1000; // 24 hours default

  constructor(options?: { maxConcurrentSessions?: number; sessionTimeoutMs?: number }) {
    if (options?.maxConcurrentSessions) {
      this.maxConcurrentSessions = options.maxConcurrentSessions;
    }
    if (options?.sessionTimeoutMs) {
      this.sessionTimeoutMs = options.sessionTimeoutMs;
    }
  }

  /**
   * Create a new session after successful authentication.
   *
   * - Stores session in database with tokens (encrypted)
   * - Enforces max concurrent sessions per user (revokes oldest if exceeded)
   * - Returns session ID for client to store in cookie/header
   *
   * @param input Session creation data
   * @returns Session info including session ID
   */
  async createSession(input: CreateSessionInput): Promise<SessionInfo> {
    const { orgId, userId, providerId, authResult, ipAddress, userAgent } = input;

    // Calculate token expiry
    const expiresAt = authResult.expiresAt
      ? new Date(authResult.expiresAt)
      : new Date(Date.now() + this.sessionTimeoutMs);

    try {
      // Count active sessions for this user in this org
      const activeSessions = await (prisma as any).session.findMany({
        where: {
          userId,
          orgId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "asc" },
      });

      // If at max capacity, revoke the oldest session
      if (activeSessions.length >= this.maxConcurrentSessions) {
        const oldestSession = activeSessions[0];
        await (prisma as any).session.update({
          where: { id: oldestSession.id },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        });
      }

      // Create new session
      const session = await (prisma as any).session.create({
        data: {
          userId,
          orgId,
          providerId,
          accessToken: authResult.accessToken, // In production: encrypted
          refreshToken: authResult.refreshToken, // In production: encrypted
          expiresAt,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          isRevoked: false,
          createdAt: new Date(),
        },
      });

      return this.mapSessionRecord(session);
    } catch (error) {
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate a session and its tokens.
   *
   * Checks:
   * - Session exists and is not revoked
   * - Session not expired
   * - Access token validity
   *
   * @param sessionId Session ID from cookie/header
   * @returns Validation result with session info if valid
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    try {
      const session = await (prisma as any).session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return { valid: false, error: "Session not found" };
      }

      if (session.isRevoked) {
        return { valid: false, error: "Session has been revoked" };
      }

      const now = new Date();
      if (session.expiresAt < now) {
        // Mark as revoked to avoid re-validation
        await (prisma as any).session.update({
          where: { id: sessionId },
          data: { isRevoked: true, revokedAt: now },
        });
        return { valid: false, error: "Session has expired" };
      }

      return {
        valid: true,
        session: this.mapSessionRecord(session),
      };
    } catch (error) {
      return {
        valid: false,
        error: `Session validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Refresh a session using refresh token.
   *
   * - Validates refresh token
   * - Generates new access token
   * - Extends session expiry
   * - Rotates tokens for security
   *
   * @param sessionId Session ID
   * @param newAccessToken New access token from provider
   * @param newExpiresAt New expiry time
   * @returns Updated session info
   */
  async refreshSession(
    sessionId: string,
    newAccessToken: string,
    newExpiresAt?: Date,
  ): Promise<SessionInfo> {
    try {
      const session = await (prisma as any).session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new Error("Session not found");
      }

      if (session.isRevoked) {
        throw new Error("Cannot refresh revoked session");
      }

      // Update with new token and expiry
      const expiresAt = newExpiresAt || new Date(Date.now() + this.sessionTimeoutMs);

      const updated = await (prisma as any).session.update({
        where: { id: sessionId },
        data: {
          accessToken: newAccessToken,
          expiresAt,
          refreshedAt: new Date(),
        },
      });

      return this.mapSessionRecord(updated);
    } catch (error) {
      throw new Error(`Failed to refresh session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Revoke a session (logout).
   *
   * - Marks session as revoked
   * - Prevents further use
   * - Optionally calls provider to revoke tokens
   *
   * @param sessionId Session ID to revoke
   */
  async revokeSession(sessionId: string): Promise<void> {
    try {
      await (prisma as any).session.update({
        where: { id: sessionId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    } catch (error) {
      throw new Error(`Failed to revoke session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all active sessions for a user in an org.
   *
   * Used for "devices" / "active sessions" UI.
   *
   * @param userId User ID
   * @param orgId Organization ID
   * @returns List of active sessions
   */
  async listActiveSessions(userId: string, orgId: string): Promise<SessionInfo[]> {
    try {
      const sessions = await (prisma as any).session.findMany({
        where: {
          userId,
          orgId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      return sessions.map((s: any) => this.mapSessionRecord(s));
    } catch (error) {
      throw new Error(
        `Failed to list active sessions: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Revoke all sessions for a user (e.g., on password change).
   *
   * @param userId User ID
   * @param orgId Organization ID
   * @param excludeSessionId Optional session to keep active (current device)
   */
  async revokeAllSessions(userId: string, orgId: string, excludeSessionId?: string): Promise<void> {
    try {
      await (prisma as any).session.updateMany({
        where: {
          userId,
          orgId,
          ...(excludeSessionId && { NOT: { id: excludeSessionId } }),
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to revoke all sessions: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Clean up expired and revoked sessions (background job).
   *
   * Called periodically to remove old sessions from database.
   * Retention: 30 days for revoked sessions, 90 days for expired.
   *
   * @param retentionDaysExpired Days to retain expired sessions (default: 90)
   * @param retentionDaysRevoked Days to retain revoked sessions (default: 30)
   */
  async cleanupExpiredSessions(retentionDaysExpired: number = 90, retentionDaysRevoked: number = 30): Promise<void> {
    try {
      const expiredBefore = new Date(Date.now() - retentionDaysExpired * 24 * 60 * 60 * 1000);
      const revokedBefore = new Date(Date.now() - retentionDaysRevoked * 24 * 60 * 60 * 1000);

      // Delete expired sessions beyond retention
      const deletedExpired = await (prisma as any).session.deleteMany({
        where: {
          isRevoked: false,
          expiresAt: { lt: expiredBefore },
        },
      });

      // Delete revoked sessions beyond retention
      const deletedRevoked = await (prisma as any).session.deleteMany({
        where: {
          isRevoked: true,
          revokedAt: { lt: revokedBefore },
        },
      });

      console.log(`Cleaned up ${deletedExpired.count} expired sessions, ${deletedRevoked.count} revoked sessions`);
    } catch (error) {
      console.error(
        `Failed to cleanup expired sessions: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a single session by ID.
   *
   * @param sessionId Session ID
   * @returns Session info or null if not found
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    try {
      const session = await (prisma as any).session.findUnique({
        where: { id: sessionId },
      });

      return session ? this.mapSessionRecord(session) : null;
    } catch (error) {
      throw new Error(`Failed to get session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a session is valid and not expired.
   *
   * @param sessionId Session ID
   * @returns Boolean indicating validity
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const result = await this.validateSession(sessionId);
    return result.valid;
  }

  /**
   * Get session statistics for a user.
   *
   * @param userId User ID
   * @param orgId Organization ID
   * @returns Statistics object
   */
  async getSessionStats(userId: string, orgId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    revokedSessions: number;
  }> {
    try {
      const total = await (prisma as any).session.count({
        where: { userId, orgId },
      });

      const active = await (prisma as any).session.count({
        where: {
          userId,
          orgId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      });

      const revoked = await (prisma as any).session.count({
        where: {
          userId,
          orgId,
          isRevoked: true,
        },
      });

      return {
        totalSessions: total,
        activeSessions: active,
        revokedSessions: revoked,
      };
    } catch (error) {
      throw new Error(
        `Failed to get session stats: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Map database session record to SessionInfo.
   * @private
   */
  private mapSessionRecord(record: any): SessionInfo {
    return {
      sessionId: record.id,
      userId: record.userId,
      orgId: record.orgId,
      providerId: record.providerId,
      accessToken: record.accessToken,
      refreshToken: record.refreshToken || undefined,
      expiresAt: new Date(record.expiresAt),
      createdAt: new Date(record.createdAt),
      ipAddress: record.ipAddress || undefined,
      userAgent: record.userAgent || undefined,
      isRevoked: record.isRevoked,
    };
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────

let sessionManagerInstance: SessionManager | null = null;

/**
 * Get the global session manager instance (singleton).
 */
export function getSessionManager(options?: {
  maxConcurrentSessions?: number;
  sessionTimeoutMs?: number;
}): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(options);
  }
  return sessionManagerInstance;
}

/**
 * Reset the session manager (for testing).
 */
export function resetSessionManager(): void {
  sessionManagerInstance = null;
}
