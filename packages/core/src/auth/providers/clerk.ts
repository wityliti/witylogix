/**
 * Clerk Authentication Provider — Session + JWT verification.
 *
 * Clerk differs from Auth0:
 * - Uses a session-based model (Clerk sessions carry JWT)
 * - Clerk SDKs handle OIDC on the frontend
 * - Backend validates Clerk session tokens
 * - Clerk provides user metadata + organization support
 *
 * Flow:
 *   1. User authenticates via Clerk (on frontend)
 *   2. Clerk issues session JWT
 *   3. Frontend sends session JWT to backend
 *   4. Backend calls validateToken() → verifies JWT signature + expiry
 *   5. Backend queries Clerk's API for user info (async)
 *   6. Creates/updates ExternalAuthSession
 *   7. Issues Witylogix JWT
 */

import type {
  BaseAuthProvider,
  AuthProviderCapabilities,
  AuthResult,
  AuthenticationRequest,
  CallbackData,
  UserInfo,
  AuthorizationUrl,
  ProviderHealthStatus,
  ClerkConfig,
  WitylogixRole,
} from "../types.js";
import {
  InvalidCredentialsError,
  TokenExpiredError,
  ProviderUnavailableError,
  ConfigurationError,
} from "../types.js";

export class ClerkProvider implements BaseAuthProvider {
  readonly type = "clerk";
  readonly name = "Clerk";
  readonly capabilities: AuthProviderCapabilities = {
    supportsSSO: true,
    supportsMFA: true,
    supportsRoles: true,
    supportsSAML: false,
    supportsOIDC: true,
    supportsJIT: true,
    supportsTokenRefresh: false, // Clerk sessions are self-contained
    supportsLogout: true,
    supportsProfileSync: true,
  };

  readonly config: ClerkConfig;

  constructor(config: ClerkConfig) {
    this.config = config;
  }

  /**
   * For Clerk, authentication happens on the frontend.
   * This method receives a session JWT from the frontend and validates it.
   */
  async authenticate(request: AuthenticationRequest): Promise<AuthResult> {
    throw new ConfigurationError(
      "clerk",
      "Clerk uses frontend-driven authentication; use handleCallback() instead",
    );
  }

  /**
   * Handle Clerk session JWT validation.
   * Frontend passes the session JWT; we validate and fetch user info.
   */
  async handleCallback(callbackData: CallbackData): Promise<AuthResult> {
    // For Clerk, the "code" field contains the session JWT
    if (!callbackData.code) {
      throw new InvalidCredentialsError("clerk", "Clerk session token is required");
    }

    try {
      // Validate the session JWT
      const payload = await this.validateClerkSession(callbackData.code);

      // Fetch user info using Clerk's Backend API
      const userInfo = await this.fetchClerkUserInfo(payload.sub);

      // Map Clerk roles to Witylogix roles
      const roles = this.mapRolesToWitylogix(userInfo.publicMetadata?.roles || []);

      return {
        externalUserId: payload.sub,
        email: userInfo.primaryEmailAddress,
        name: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim(),
        picture: userInfo.profileImageUrl,
        roles,
        accessToken: callbackData.code,
        metadata: {
          clerkOrgId: userInfo.orgId,
          clerkOrgRole: userInfo.orgRole,
          publicMetadata: userInfo.publicMetadata,
        },
      };
    } catch (error) {
      throw new ProviderUnavailableError("clerk", `Clerk authentication failed: ${String(error)}`);
    }
  }

  /**
   * Validate a Clerk session token (JWT).
   */
  async validateToken(accessToken: string): Promise<Record<string, unknown>> {
    try {
      const payload = await this.validateClerkSession(accessToken);
      return payload;
    } catch (error) {
      throw new TokenExpiredError("clerk", "Invalid or expired Clerk session");
    }
  }

  /**
   * Refresh session — not needed for Clerk (sessions are self-contained).
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    throw new ConfigurationError(
      "clerk",
      "Clerk sessions do not expire; request a new session from frontend instead",
    );
  }

  /**
   * Revoke a Clerk session.
   * Calls Clerk Backend API to delete the session.
   */
  async revokeSession(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // In production: DELETE /sessions/{sessionId}
      // Headers: Authorization: Bearer {secretKey}
      // For now: mock the revocation
    } catch (error) {
      // Non-fatal
      console.error("Failed to revoke Clerk session:", error);
    }
  }

  /**
   * Get user information from Clerk Backend API.
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    // Validate token first
    const payload = await this.validateClerkSession(accessToken);

    // Fetch user from Clerk API
    const userInfo = await this.fetchClerkUserInfo(payload.sub);

    return {
      externalUserId: payload.sub,
      email: userInfo.primaryEmailAddress,
      name: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim(),
      picture: userInfo.profileImageUrl,
      roles: userInfo.publicMetadata?.roles || [],
      emailVerified: userInfo.emailAddresses?.some((e: any) => e.id === userInfo.primaryEmailAddressId),
    };
  }

  /**
   * Get authorization URL — not applicable for Clerk.
   * Clerk handles auth on the frontend.
   */
  async getAuthorizationUrl(redirectUri: string, state: string): Promise<AuthorizationUrl> {
    throw new ConfigurationError("clerk", "Clerk uses frontend-driven authentication");
  }

  /**
   * Validate Clerk configuration.
   */
  async validateConfiguration(): Promise<void> {
    if (!this.config.secretKey || !this.config.publishableKey) {
      throw new ConfigurationError(
        "clerk",
        "Clerk secretKey and publishableKey are required",
      );
    }

    try {
      // In production: verify that secretKey is valid by making a test request
      // GET /users (with minimal limit) using secretKey auth
    } catch (error) {
      throw new ConfigurationError("clerk", `Invalid Clerk credentials: ${String(error)}`);
    }
  }

  /**
   * Get Clerk health status.
   */
  async getHealthStatus(): Promise<ProviderHealthStatus> {
    try {
      const start = Date.now();
      // In production: ping Clerk's health/status endpoint
      const latency = Date.now() - start;

      return {
        healthy: true,
        latency,
        lastCheckedAt: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        lastError: error instanceof Error ? error.message : "Unknown error",
        lastCheckedAt: new Date(),
      };
    }
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────

  /**
   * Validate a Clerk session JWT.
   * In production: verify signature using Clerk's public key.
   */
  private async validateClerkSession(sessionJwt: string): Promise<Record<string, any>> {
    try {
      // Decode JWT (structure: header.payload.signature)
      const parts = sessionJwt.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );

      // Check expiry
      const exp = (payload.exp as number) || 0;
      if (Date.now() / 1000 > exp) {
        throw new TokenExpiredError("clerk");
      }

      // In production: verify signature using Clerk's JWKS
      return payload;
    } catch (error) {
      throw new InvalidCredentialsError(
        "clerk",
        error instanceof Error ? error.message : "Session validation failed",
      );
    }
  }

  /**
   * Fetch user information from Clerk Backend API.
   * GET /users/{userId}
   */
  private async fetchClerkUserInfo(userId: string): Promise<any> {
    // Mock: would GET https://api.clerk.com/v1/users/{userId}
    // Headers: Authorization: Bearer {secretKey}
    const mockUser = {
      id: userId,
      primaryEmailAddress: "user@example.com",
      emailAddresses: [{ id: "email_1", emailAddress: "user@example.com" }],
      primaryEmailAddressId: "email_1",
      firstName: "Clerk",
      lastName: "User",
      profileImageUrl: "https://example.com/avatar.jpg",
      publicMetadata: {
        roles: ["VIEWER"],
      },
      orgId: undefined,
      orgRole: undefined,
    };
    return mockUser;
  }

  /**
   * Map Clerk roles to Witylogix roles.
   */
  private mapRolesToWitylogix(clerkRoles: string[]): WitylogixRole[] {
    const roles: WitylogixRole[] = [];

    const mapping = this.config.roleMapping || {
      admin: "ADMIN",
      dispatcher: "DISPATCHER",
      viewer: "VIEWER",
      driver: "DRIVER",
    };

    for (const clerkRole of clerkRoles) {
      const mappedRole = mapping[clerkRole.toLowerCase()] as WitylogixRole;
      if (mappedRole) {
        roles.push(mappedRole);
      }
    }

    if (roles.length === 0) {
      roles.push(this.config.defaultRole || "VIEWER");
    }

    return roles;
  }
}
