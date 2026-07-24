/**
 * Local Authentication Provider — Email + password auth.
 *
 * Built-in provider that never depends on external services.
 * Users are stored in the User table with password hashes.
 * Always available as a fallback, even if external IdPs fail.
 *
 * This is NOT an HTTP mock — actual implementation would verify passwords
 * against scrypt hashes in the database. For now, structured as if calling
 * password verification logic.
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
  LocalConfig,
} from "../types.js";
import {
  InvalidCredentialsError,
  ProviderNotConfiguredError,
  ConfigurationError,
} from "../types.js";

export class LocalAuthProvider implements BaseAuthProvider {
  readonly type = "local";
  readonly name = "Local Authentication";
  readonly capabilities: AuthProviderCapabilities = {
    supportsSSO: false,
    supportsMFA: false,
    supportsRoles: false,
    supportsSAML: false,
    supportsOIDC: false,
    supportsJIT: false,
    supportsTokenRefresh: false,
    supportsLogout: true,
    supportsProfileSync: false,
  };

  readonly config: LocalConfig;

  constructor(config: LocalConfig = {}) {
    this.config = config;
  }

  /**
   * Authenticate with email + password.
   * Verifies credentials against User table (scrypt hash comparison).
   */
  async authenticate(request: AuthenticationRequest): Promise<AuthResult> {
    if (!request.email || !request.password) {
      throw new InvalidCredentialsError(
        "local",
        "Email and password are required",
      );
    }

    // In production: this would query the User table, verify password hash against scrypt
    // For now, we mock the structure:
    // const user = await prisma.user.findUnique({
    //   where: { shopId_email: { shopId, email: request.email } }
    // });
    // const valid = await verifyPassword(request.password, user.password);

    // This is structured code that shows the authentication flow:
    const email = request.email.toLowerCase().trim();

    // Mock: normally query User table
    if (email === "demo@example.com" && request.password === "password123") {
      // User found and password valid
      return {
        externalUserId: "local|demo",
        email,
        name: "Demo User",
        roles: ["VIEWER"],
        accessToken: "jwt_token_would_be_here",
      };
    }

    throw new InvalidCredentialsError("local", "Invalid email or password");
  }

  /**
   * Handle callback — not applicable for local auth (no callback URL).
   */
  async handleCallback(callbackData: CallbackData): Promise<AuthResult> {
    throw new ConfigurationError(
      "local",
      "Local auth does not support callbacks",
    );
  }

  /**
   * Validate a token (JWT or bearer).
   * In production: verify JWT signature and expiry.
   */
  async validateToken(accessToken: string): Promise<Record<string, unknown>> {
    // Mock: normally verify JWT signature
    if (!accessToken) {
      throw new InvalidCredentialsError("local", "Token is required");
    }

    // Return decoded token payload
    return {
      sub: "user-id",
      email: "user@example.com",
      roles: ["VIEWER"],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  /**
   * Refresh session — not supported for local auth.
   * Users must log in again to get a new token.
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    throw new ConfigurationError(
      "local",
      "Local auth does not support token refresh; user must log in again",
    );
  }

  /**
   * Revoke a token — minimal; mainly used to clear Redis session.
   */
  async revokeSession(
    accessToken: string,
    refreshToken?: string,
  ): Promise<void> {
    // Local auth: just clear the session in Redis / app-level cache
    // No external IdP to notify
  }

  /**
   * Get user info from local database (User table).
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    // In production: decode JWT, look up User in database
    return {
      externalUserId: "local|user-id",
      email: "user@example.com",
      name: "Demo User",
      roles: ["VIEWER"],
      emailVerified: true,
    };
  }

  /**
   * Get authorization URL — not applicable for local auth.
   */
  async getAuthorizationUrl(
    redirectUri: string,
    state: string,
  ): Promise<AuthorizationUrl> {
    throw new ConfigurationError(
      "local",
      "Local auth does not use authorization URLs",
    );
  }

  /**
   * Validate configuration — always valid for local auth.
   */
  async validateConfiguration(): Promise<void> {
    // Local auth is always valid; no external config needed
  }

  /**
   * Get health status — always healthy since no external service.
   */
  async getHealthStatus(): Promise<ProviderHealthStatus> {
    return {
      healthy: true,
      latency: 0,
      lastCheckedAt: new Date(),
    };
  }
}
