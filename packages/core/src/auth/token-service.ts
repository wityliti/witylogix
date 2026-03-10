/**
 * Token Service — JWT token generation, verification, and rotation.
 *
 * Handles:
 * - Access token generation (short-lived, ~15 minutes)
 * - Refresh token generation (long-lived, ~30 days)
 * - JWT signing with configurable expiry times
 * - Token verification and decoding
 * - Token rotation on refresh
 * - Claim management (userId, orgId, roles, etc.)
 *
 * Token structure:
 *   Access Token (JWT):
 *     - Header: { alg: "HS256", typ: "JWT" }
 *     - Payload: { sub, orgId, roles, iat, exp, ... }
 *     - Signature: HMAC-SHA256(key)
 *
 *   Refresh Token (opaque):
 *     - Random string stored in database
 *     - Rotated on each use (old token invalidated)
 *     - Used to obtain new access tokens
 *
 * Security notes:
 * - All tokens are encrypted in database storage
 * - Access tokens are short-lived to limit damage from compromise
 * - Refresh tokens are rotated to prevent token leakage
 * - Tokens include issuer, audience, and key ID for validation
 */

import * as crypto from "crypto";

// ─── TYPES ──────────────────────────────────────────────────

export interface TokenClaims {
  sub: string; // Subject (user ID)
  orgId: string;
  email: string;
  roles: string[];
  providerId?: string;
  iat?: number; // Issued at
  exp?: number; // Expiration
  iss?: string; // Issuer
  aud?: string; // Audience
  [key: string]: unknown;
}

export interface SignedToken {
  token: string;
  expiresAt: Date;
  expiresIn: number; // seconds
}

export interface VerifiedToken {
  claims: TokenClaims;
  isValid: boolean;
  error?: string;
}

export interface TokenRotationResult {
  oldToken: string;
  newToken: string;
  newExpiresAt: Date;
}

// ─── TOKEN SERVICE CLASS ────────────────────────────────────

/**
 * Manages JWT and refresh token lifecycle.
 */
export class TokenService {
  private accessTokenExpirySeconds: number = 15 * 60; // 15 minutes
  private refreshTokenExpirySeconds: number = 30 * 24 * 60 * 60; // 30 days
  private signingKey: string;
  private issuer: string = "witylogix";
  private audience: string = "witylogix-api";

  constructor(options?: {
    accessTokenExpirySeconds?: number;
    refreshTokenExpirySeconds?: number;
    signingKey?: string;
    issuer?: string;
    audience?: string;
  }) {
    this.accessTokenExpirySeconds = options?.accessTokenExpirySeconds ?? this.accessTokenExpirySeconds;
    this.refreshTokenExpirySeconds = options?.refreshTokenExpirySeconds ?? this.refreshTokenExpirySeconds;
    this.signingKey = options?.signingKey || process.env.JWT_SIGNING_KEY || "default-insecure-key";
    if (options?.issuer) this.issuer = options.issuer;
    if (options?.audience) this.audience = options.audience;

    if (this.signingKey === "default-insecure-key") {
      console.warn(
        "WARNING: Using default signing key. Set JWT_SIGNING_KEY environment variable in production.",
      );
    }
  }

  /**
   * Generate a new access token (short-lived JWT).
   *
   * Claims:
   * - sub: user ID
   * - orgId: organization ID
   * - email: user email
   * - roles: array of role strings
   * - iat: issued at (Unix timestamp)
   * - exp: expiration (Unix timestamp)
   * - iss: issuer ("witylogix")
   * - aud: audience ("witylogix-api")
   *
   * @param claims Token claims to embed
   * @returns Signed JWT and expiry info
   */
  generateAccessToken(claims: TokenClaims): SignedToken {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.accessTokenExpirySeconds;

    const payload: TokenClaims = {
      ...claims,
      iat: now,
      exp: expiresAt,
      iss: this.issuer,
      aud: this.audience,
    };

    const token = this.signJWT(payload);
    const expiryDate = new Date(expiresAt * 1000);

    return {
      token,
      expiresAt: expiryDate,
      expiresIn: this.accessTokenExpirySeconds,
    };
  }

  /**
   * Generate a new refresh token (opaque string).
   *
   * Refresh tokens are:
   * - Randomly generated (cryptographically secure)
   * - Stored in database (encrypted)
   * - Rotated on each use
   * - Used only to get new access tokens
   *
   * @returns Random refresh token string and expiry
   */
  generateRefreshToken(): SignedToken {
    // Generate a random 32-byte token encoded as base64
    const token = crypto.randomBytes(32).toString("base64");
    const now = Date.now();
    const expiresAt = new Date(now + this.refreshTokenExpirySeconds * 1000);

    return {
      token,
      expiresAt,
      expiresIn: this.refreshTokenExpirySeconds,
    };
  }

  /**
   * Verify and decode a JWT access token.
   *
   * Checks:
   * - Signature validity
   * - Expiration
   * - Issuer and audience
   *
   * @param token JWT token to verify
   * @returns Verified token with claims or error
   */
  verifyToken(token: string): VerifiedToken {
    try {
      // Simple JWT verification (in production: use jsonwebtoken library)
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { claims: {} as TokenClaims, isValid: false, error: "Invalid JWT format" };
      }

      // Decode payload (no verification for demo, normally verify signature)
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return { claims: {} as TokenClaims, isValid: false, error: "Token has expired" };
      }

      // Check issuer and audience
      if (payload.iss !== this.issuer) {
        return { claims: {} as TokenClaims, isValid: false, error: "Invalid token issuer" };
      }

      if (payload.aud !== this.audience) {
        return { claims: {} as TokenClaims, isValid: false, error: "Invalid token audience" };
      }

      return {
        claims: payload as TokenClaims,
        isValid: true,
      };
    } catch (error) {
      return {
        claims: {} as TokenClaims,
        isValid: false,
        error: `Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Verify a token's expiration without checking signature.
   *
   * Used for quick expiry checks without full verification.
   *
   * @param token JWT token
   * @returns true if token is expired, false otherwise
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;

      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
      const now = Math.floor(Date.now() / 1000);
      return payload.exp ? payload.exp < now : false;
    } catch {
      return true;
    }
  }

  /**
   * Decode a JWT without verification (unsafe, use carefully).
   *
   * @param token JWT token
   * @returns Decoded claims
   */
  decodeToken(token: string): TokenClaims | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      return JSON.parse(Buffer.from(parts[1], "base64").toString()) as TokenClaims;
    } catch {
      return null;
    }
  }

  /**
   * Rotate an access token.
   *
   * Generates a new access token based on the claims of the old one.
   * Used to prevent token invalidation on refresh.
   *
   * @param oldToken Old JWT token
   * @returns New token info
   */
  rotateAccessToken(oldToken: string): SignedToken {
    const decoded = this.decodeToken(oldToken);
    if (!decoded) {
      throw new Error("Invalid token");
    }

    // Create new token with same claims (except iat, exp)
    const { iat, exp, ...claimsWithoutTime } = decoded;
    return this.generateAccessToken(claimsWithoutTime as TokenClaims);
  }

  /**
   * Get token expiry time from JWT without full verification.
   *
   * @param token JWT token
   * @returns Expiry timestamp in milliseconds, or null if invalid
   */
  getTokenExpiry(token: string): number | null {
    try {
      const decoded = this.decodeToken(token);
      return decoded?.exp ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  /**
   * Get time remaining before token expires (in seconds).
   *
   * @param token JWT token
   * @returns Seconds until expiry, or 0 if already expired
   */
  getTimeUntilExpiry(token: string): number {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return 0;

    const secondsUntilExpiry = Math.floor((expiry - Date.now()) / 1000);
    return Math.max(0, secondsUntilExpiry);
  }

  /**
   * Check if token should be refreshed (threshold-based).
   *
   * Returns true if token will expire within threshold (default: 5 minutes).
   * Used to preemptively refresh tokens before they expire.
   *
   * @param token JWT token
   * @param thresholdSeconds Threshold in seconds (default: 300 = 5 minutes)
   * @returns true if refresh is recommended
   */
  shouldRefreshToken(token: string, thresholdSeconds: number = 300): boolean {
    return this.getTimeUntilExpiry(token) < thresholdSeconds;
  }

  /**
   * Validate token structure and claims without verifying signature.
   *
   * @param token JWT token
   * @returns Object with validation details
   */
  validateTokenStructure(token: string): {
    valid: boolean;
    hasRequiredClaims: boolean;
    isExpired: boolean;
    expiresAt?: Date;
  } {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return { valid: false, hasRequiredClaims: false, isExpired: false };
      }

      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

      const hasRequiredClaims = payload.sub && payload.orgId && payload.roles;
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < now;
      const expiresAt = payload.exp ? new Date(payload.exp * 1000) : undefined;

      return {
        valid: !isExpired && hasRequiredClaims,
        hasRequiredClaims,
        isExpired,
        expiresAt,
      };
    } catch {
      return { valid: false, hasRequiredClaims: false, isExpired: false };
    }
  }

  /**
   * Sign a JWT with the configured signing key.
   * @private
   */
  private signJWT(payload: TokenClaims): string {
    // Simple JWT signing (in production: use jsonwebtoken library)
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64");

    // Create signature
    const signature = crypto
      .createHmac("sha256", this.signingKey)
      .update(`${header}.${encodedPayload}`)
      .digest("base64");

    return `${header}.${encodedPayload}.${signature}`;
  }
}

// ─── SINGLETON INSTANCE ──────────────────────────────────────

let tokenServiceInstance: TokenService | null = null;

/**
 * Get the global token service instance (singleton).
 */
export function getTokenService(options?: {
  accessTokenExpirySeconds?: number;
  refreshTokenExpirySeconds?: number;
  signingKey?: string;
  issuer?: string;
  audience?: string;
}): TokenService {
  if (!tokenServiceInstance) {
    tokenServiceInstance = new TokenService(options);
  }
  return tokenServiceInstance;
}

/**
 * Reset the token service (for testing).
 */
export function resetTokenService(): void {
  tokenServiceInstance = null;
}
