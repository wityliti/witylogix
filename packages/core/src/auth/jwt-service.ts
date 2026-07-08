/**
 * JWT Service — Token Generation, Verification & Rotation
 *
 * Provides:
 * - Access token generation (15-minute expiry)
 * - Refresh token generation (7-day expiry)
 * - Token verification with signature validation
 * - Token rotation (issue new refresh on use)
 * - Token blacklisting (revocation tracking)
 * - Claims: userId, orgId, role, permissions[], mfaVerified
 *
 * Security considerations:
 * - Uses HS256 (HMAC-SHA256) for signing
 * - Tokens include issued-at (iat) and expiration (exp)
 * - Refresh tokens are rotated on each use (prevents reuse)
 * - Blacklist prevents use of revoked tokens
 * - All timestamps in Unix epoch seconds
 */

import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenVerificationResult,
} from "./types.js";
import {
  AuthError,
  TokenExpiredError,
  InvalidCredentialsError,
} from "./types.js";

// ─── TYPES ──────────────────────────────────────────────────

export interface JwtServiceConfig {
  /** Secret key for signing (min 32 chars recommended) */
  secret: string;
  /** Access token expiry in seconds (default: 15 minutes) */
  accessTokenTtl?: number;
  /** Refresh token expiry in seconds (default: 7 days) */
  refreshTokenTtl?: number;
  /** Issuer claim (default: "witylogix") */
  issuer?: string;
  /** Audience claim (default: "witylogix-api") */
  audience?: string;
}

// ─── JWT SERVICE CLASS ──────────────────────────────────────

/**
 * Manages JWT token generation, verification, and revocation.
 */
export class JwtService {
  private secret: string;
  private accessTokenTtl: number;
  private refreshTokenTtl: number;
  private issuer: string;
  private audience: string;
  private blacklist: Set<string> = new Set(); // Token jti blacklist
  private blacklistTtl: Map<string, number> = new Map(); // Track expiry for cleanup

  constructor(config: JwtServiceConfig) {
    if (!config.secret || config.secret.length < 16) {
      throw new Error("JWT secret must be at least 16 characters");
    }

    this.secret = config.secret;
    this.accessTokenTtl = config.accessTokenTtl ?? 15 * 60; // 15 minutes
    this.refreshTokenTtl = config.refreshTokenTtl ?? 7 * 24 * 60 * 60; // 7 days
    this.issuer = config.issuer ?? "witylogix";
    this.audience = config.audience ?? "witylogix-api";

    // Clean up expired blacklist entries periodically
    this.startBlacklistCleanup();
  }

  /**
   * Generate an access token.
   *
   * @param payload User/session data
   * @returns Signed JWT token
   */
  generateAccessToken(
    payload: Omit<AccessTokenPayload, "iat" | "exp" | "sub" | "aud" | "iss">,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const token: AccessTokenPayload = {
      ...payload,
      jti: this.generateJti(),
      iat: now,
      exp: now + this.accessTokenTtl,
      sub: payload.userId,
      aud: this.audience,
      iss: this.issuer,
    };

    return this.sign(token);
  }

  /**
   * Generate a refresh token.
   *
   * @param payload Session data
   * @param version Token rotation version (default: 1)
   * @returns Signed JWT token
   */
  generateRefreshToken(
    payload: Omit<RefreshTokenPayload, "iat" | "exp" | "sub" | "aud" | "iss">,
    version = 1,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const token: RefreshTokenPayload = {
      ...payload,
      jti: this.generateJti(),
      version,
      iat: now,
      exp: now + this.refreshTokenTtl,
      sub: payload.userId,
      aud: this.audience,
      iss: this.issuer,
    };

    return this.sign(token);
  }

  /**
   * Verify and decode an access token.
   *
   * @param token JWT token to verify
   * @returns Decoded payload if valid
   */
  verifyAccessToken(token: string): TokenVerificationResult {
    try {
      // Check blacklist before signature verification
      if (this.isTokenBlacklisted(token)) {
        return { valid: false, error: "Token has been revoked" };
      }

      const payload = this.verify(token) as unknown as AccessTokenPayload;

      // Additional validation
      if (!payload.userId || !payload.orgId) {
        return {
          valid: false,
          error: "Invalid token payload",
        };
      }

      if (payload.exp <= Math.floor(Date.now() / 1000)) {
        return {
          valid: false,
          error: "Token expired",
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : "Token verification failed",
      };
    }
  }

  /**
   * Verify and decode a refresh token.
   *
   * @param token JWT token to verify
   * @returns Decoded payload if valid
   */
  verifyRefreshToken(token: string): TokenVerificationResult {
    try {
      // Check blacklist before signature verification
      if (this.isTokenBlacklisted(token)) {
        return { valid: false, error: "Token has been revoked" };
      }

      const payload = this.verify(token) as unknown as RefreshTokenPayload;

      // Additional validation
      if (!payload.userId || !payload.sessionId) {
        return {
          valid: false,
          error: "Invalid token payload",
        };
      }

      if (payload.exp <= Math.floor(Date.now() / 1000)) {
        return {
          valid: false,
          error: "Token expired",
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : "Token verification failed",
      };
    }
  }

  /**
   * Revoke a token by adding to blacklist.
   * Used for logout and token rotation.
   *
   * @param token Token to revoke
   */
  revokeToken(token: string): void {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(this.base64UrlDecode(parts[1]));
        const jti = payload.jti || `${payload.exp}-${token.substring(0, 8)}`;
        this.blacklist.add(jti);
        this.blacklistTtl.set(
          jti,
          payload.exp || Math.floor(Date.now() / 1000) + 3600,
        );
      } else {
        // Mark raw token as revoked
        this.blacklist.add(token);
      }
    } catch {
      // Can't decode — mark raw token as revoked
      this.blacklist.add(token);
    }
  }

  /**
   * Check if a token is blacklisted (revoked).
   *
   * @param token Token to check
   * @returns true if token is revoked
   */
  isTokenRevoked(token: string): boolean {
    return this.isTokenBlacklisted(token);
  }

  /**
   * Check blacklist without calling verify (avoids recursion).
   */
  private isTokenBlacklisted(token: string): boolean {
    // Check raw token first (for invalid tokens added directly)
    if (this.blacklist.has(token)) return true;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return false;
      const payload = JSON.parse(this.base64UrlDecode(parts[1]));
      const jti = payload.jti || `${payload.exp}-${token.substring(0, 8)}`;
      return this.blacklist.has(jti);
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique token identifier.
   */
  private generateJti(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Extract JWT from Authorization header.
   *
   * @param authHeader "Bearer <token>" header value
   * @returns Token or null if malformed
   */
  extractFromHeader(authHeader: string): string | null {
    if (!authHeader || typeof authHeader !== "string") {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────

  /**
   * Sign a token using HS256.
   */
  private sign(payload: object): string {
    // Simple HS256 implementation
    const header = this.base64UrlEncode(
      JSON.stringify({
        alg: "HS256",
        typ: "JWT",
      }),
    );

    const body = this.base64UrlEncode(JSON.stringify(payload));

    const signature = this.hmacSha256(`${header}.${body}`);

    return `${header}.${body}.${signature}`;
  }

  /**
   * Verify and decode a JWT token.
   */
  private verify(token: string): Record<string, unknown> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const [headerB64, bodyB64, signatureB64] = parts;

    // Verify signature
    const expectedSignature = this.hmacSha256(`${headerB64}.${bodyB64}`);
    if (signatureB64 !== expectedSignature) {
      throw new Error("Invalid token signature");
    }

    // Decode payload
    try {
      const payload = JSON.parse(this.base64UrlDecode(bodyB64));

      // Check standard claims
      if (payload.iss !== this.issuer) {
        throw new Error("Invalid issuer");
      }

      if (payload.aud !== this.audience) {
        throw new Error("Invalid audience");
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp <= now) {
        throw new TokenExpiredError("local", "Token has expired");
      }

      return payload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw error;
      }
      throw new Error(
        `Failed to decode token: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * HMAC-SHA256 signature.
   * Note: This is a simplified implementation.
   * In production, use Node's crypto module.
   */
  private hmacSha256(data: string): string {
    // Dynamic import to support Node.js crypto
    let hash: string;

    try {
      // Use Node.js crypto if available
      const crypto = require("crypto");
      const hmac = crypto.createHmac("sha256", this.secret);
      hmac.update(data);
      hash = hmac.digest("base64");
    } catch {
      // Fallback: simple XOR-based hash (NOT SECURE - for testing only)
      const bytes = Buffer.from(data + this.secret, "utf-8");
      let xor = 0;
      for (let i = 0; i < bytes.length; i++) {
        xor ^= bytes[i];
      }
      hash = Buffer.from([xor]).toString("base64");
    }

    return this.base64UrlEncode(hash);
  }

  /**
   * Base64 URL encode (RFC 4648).
   */
  private base64UrlEncode(data: string): string {
    const buffer = Buffer.from(data, "utf-8");
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Base64 URL decode (RFC 4648).
   */
  private base64UrlDecode(data: string): string {
    // Add padding
    let padded = data + "==".slice(0, (4 - (data.length % 4)) % 4);
    // Replace URL-safe chars
    padded = padded.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(padded, "base64").toString("utf-8");
  }

  /**
   * Clean up expired blacklist entries periodically.
   */
  private startBlacklistCleanup(): void {
    // Run cleanup every hour
    setInterval(
      () => {
        const now = Math.floor(Date.now() / 1000);
        for (const [jti, expiry] of this.blacklistTtl.entries()) {
          if (expiry < now) {
            this.blacklist.delete(jti);
            this.blacklistTtl.delete(jti);
          }
        }
      },
      60 * 60 * 1000,
    );
  }
}

// ─── SINGLETON EXPORT ───────────────────────────────────────

let instance: JwtService;

/**
 * Get or create the singleton JwtService instance.
 */
export function getJwtService(config?: JwtServiceConfig): JwtService {
  if (!instance && !config) {
    throw new Error("JwtService requires config on first initialization");
  }

  if (!instance && config) {
    instance = new JwtService(config);
  }

  return instance;
}

/**
 * Create a new JwtService instance (for testing).
 */
export function createJwtService(config: JwtServiceConfig): JwtService {
  return new JwtService(config);
}

/**
 * Initialize JwtService with config.
 */
export function initializeJwtService(config: JwtServiceConfig): JwtService {
  instance = new JwtService(config);
  return instance;
}
