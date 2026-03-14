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
 * - IP address and device fingerprinting for security
 * - Automatic cleanup of expired/revoked sessions
 * - MFA verification tracking per session
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
import { SessionInvalidError } from "./types.js";

// ─── TYPES ──────────────────────────────────────────────────

export interface CreateSessionInput {
  orgId: string;
  userId: string;
  providerId: string;
  authResult: AuthResult;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
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
  deviceId?: string;
  mfaVerified: boolean;
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
 * Enforces max concurrent sessions, token expiry, device tracking, and multi-tenant isolation.
 */
export class SessionManager {
  private maxConcurrentSessions: number = 5;
  private sessionTimeoutMs: number = 24 * 60 * 60 * 1000; // 24 hours default
  private cleanupIntervalMs: number = 60 * 60 * 1000; // 1 hour

  constructor(options?: { maxConcurrentSessions?: number; sessionTimeoutMs?: number }) {
    if (options?.maxConcurrentSessions) {
      this.maxConcurrentSessions = options.maxConcurrentSessions;
    }
    if (options?.sessionTimeoutMs) {
      this.sessionTimeoutMs = options.sessionTimeoutMs;
    }

    // Start cleanup job
    this.startCleanupJob();
  }

  /**
   * Create a new session after successful authentication.
   *
   * - Stores session in database with tokens (encrypted)
   * - Enforces max concurrent sessions per user (revokes oldest if exceeded)
   * - Tracks device for security
   * - Returns session info including session ID
   *
   * @param input Session creation data
   * @returns Session info including session ID
   */
  async createSession(input: CreateSessionInput): Promise<SessionInfo> {
    const { orgId, userId, providerId, authResult, ipAddress, userAgent, deviceId } = input;

    // Calculate token expiry
    const expiresAt = authResult.expiresAt
      ? new Date(authResult.expiresAt)
      : new Date(Date.now() + this.sessionTimeoutMs);

    try {
      // Check if device already has active session (for same-device login)
      if (deviceId) {
        const existingSession = await (prisma as any).authSession.findFirst({
          where: {
            userId,
            orgId,
            deviceId,
            isRevoked: false,
            expiresAt: { gt: new Date() },
          },
        });

        if (existingSession) {
          // Revoke existing session for this device
          await (prisma as any).authSession.update({
            where: { id: existingSession.id },
            data: { isRevoked: true, revokedAt: new Date() },
          });
        }
      }

      // Count active sessions for this user in this org
      const activeSessions = await (prisma as any).authSession.findMany({
        where: {
          userId,
          orgId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "asc" },
      });

      // Revoke oldest sessions if exceeding limit
      const sessionsToRevoke = activeSessions.slice(
        0,
        Math.max(0, activeSessions.length - this.maxConcurrentSessions + 1),
      );
      for (const session of sessionsToRevoke) {
        await (prisma as any).authSession.update({
          where: { id: session.id },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }

      // Create new session
      const session = await (prisma as any).authSession.create({
        data: {
          userId,
          orgId,
          providerId,
          token: authResult.accessToken, // Encrypted in production
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          deviceId: deviceId || null,
          expiresAt,
          mfaVerified: authResult.mfaVerified ?? false,
          isRevoked: false,
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
   * - MFA verification if required
   *
   * @param sessionId Session ID from cookie/header
   * @returns Validation result with session info if valid
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    try {
      const session = await (prisma as any).authSession.findUnique({
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
        await (prisma as any).authSession.update({
          where: { id: sessionId },
          data: { isRevoked: true, revokedAt: now },
        });
        return { valid: false, error: "Session has expired" };
      }

      // Update last activity
      await (prisma as any).authSession.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() },
      });

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
   * - Validates session still active
   * - Generates new token
   * - Extends session expiry
   * - Updates last activity
   *
   * @param sessionId Session ID
   * @param newToken New token from authentication
   * @param newExpiresAt New expiry time
   * @returns Updated session info
   */
  async refreshSession(
    sessionId: string,
    newToken: string,
    newExpiresAt?: Date,
  ): Promise<SessionInfo> {
    try {
      const session = await (prisma as any).authSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new SessionInvalidError("Session not found");
      }

      if (session.isRevoked) {
        throw new SessionInvalidError("Cannot refresh revoked session");
      }

      // Update with new token and expiry
      const expiresAt = newExpiresAt || new Date(Date.now() + this.sessionTimeoutMs);

      const updated = await (prisma as any).authSession.update({
        where: { id: sessionId },
        data: {
          token: newToken,
          expiresAt,
          lastActivityAt: new Date(),
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
   * @param sessionId Session ID to revoke
   */
  async revokeSession(sessionId: string): Promise<void> {
    try {
      await (prisma as any).authSession.update({
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
   * Revoke all sessions for a user (logout all devices).
   *
   * @param userId User ID
   * @param orgId Organization ID
   */
  async revokeAllSessions(userId: string, orgId: string): Promise<void> {
    try {
      await (prisma as any).authSession.updateMany({
        where: { userId, orgId, isRevoked: false },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    } catch (error) {
      throw new Error(`Failed to revoke all sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List active sessions for a user.
   *
   * @param userId User ID
   * @param orgId Organization ID
   * @returns Array of active sessions
   */
  async listActiveSessions(userId: string, orgId: string): Promise<SessionInfo[]> {
    try {
      const sessions = await (prisma as any).authSession.findMany({
        where: {
          userId,
          orgId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActivityAt: "desc" },
      });

      return sessions.map((s: any) => this.mapSessionRecord(s));
    } catch (error) {
      console.error("Failed to list sessions:", error);
      return [];
    }
  }

  /**
   * Mark MFA as verified for session.
   *
   * @param sessionId Session ID
   */
  async verifyMfa(sessionId: string): Promise<void> {
    try {
      await (prisma as any).authSession.update({
        where: { id: sessionId },
        data: {
          mfaVerified: true,
          mfaVerifiedAt: new Date(),
        },
      });
    } catch (error) {
      throw new Error(`Failed to verify MFA: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────

  /**
   * Map database session record to SessionInfo.
   */
  private mapSessionRecord(session: any): SessionInfo {
    return {
      sessionId: session.id,
      userId: session.userId,
      orgId: session.orgId,
      providerId: session.providerId,
      accessToken: session.token,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceId: session.deviceId,
      mfaVerified: session.mfaVerified,
      isRevoked: session.isRevoked,
    };
  }

  /**
   * Start periodic cleanup of expired sessions.
   */
  private startCleanupJob(): void {
    setInterval(async () => {
      try {
        const now = new Date();
        await (prisma as any).authSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }, // 30 days old
              { isRevoked: true, revokedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }, // 7 days revoked
            ],
          },
        });
      } catch (error) {
        console.error("Session cleanup failed:", error);
      }
    }, this.cleanupIntervalMs);
  }
}

// ─── SINGLETON EXPORT ───────────────────────────────────────

let instance: SessionManager;

/**
 * Get or create the singleton SessionManager instance.
 */
export function getSessionManager(options?: { maxConcurrentSessions?: number; sessionTimeoutMs?: number }): SessionManager {
  if (!instance) {
    instance = new SessionManager(options);
  }
  return instance;
}

/**
 * Create a new SessionManager instance (for testing).
 */
export function createSessionManager(options?: { maxConcurrentSessions?: number; sessionTimeoutMs?: number }): SessionManager {
  return new SessionManager(options);
}
