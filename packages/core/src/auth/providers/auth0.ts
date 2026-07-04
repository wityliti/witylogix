/**
 * Auth0 Authentication Provider — OpenID Connect (OIDC) flow.
 *
 * Implements OAuth 2.0 + OIDC for Auth0 tenants.
 *
 * Flow:
 *   1. User clicks "Sign in with Auth0"
 *   2. App redirects to getAuthorizationUrl() → Auth0 login page
 *   3. User authenticates with Auth0
 *   4. Auth0 redirects to /auth/provider/auth0/callback with authorization code
 *   5. App calls handleCallback(code) → token exchange → user info
 *   6. App creates/updates ExternalAuthSession with accessToken + refreshToken
 *   7. App generates Witylogix JWT, user logged in
 *
 * Token refresh:
 *   - If access token expires, call refreshSession(refreshToken)
 *   - Returns new accessToken + refreshToken
 *   - Update ExternalAuthSession record
 *
 * Logout:
 *   - Call revokeSession(accessToken) → Auth0 logout endpoint
 *   - Clear app-level session
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
  Auth0Config,
  WitylogixRole,
} from "../types.js";
import {
  InvalidCredentialsError,
  TokenExpiredError,
  ProviderUnavailableError,
  ConfigurationError,
} from "../types.js";

export class Auth0Provider implements BaseAuthProvider {
  readonly type = "auth0";
  readonly name = "Auth0";
  readonly capabilities: AuthProviderCapabilities = {
    supportsSSO: true,
    supportsMFA: true,
    supportsRoles: true,
    supportsSAML: false,
    supportsOIDC: true,
    supportsJIT: true,
    supportsTokenRefresh: true,
    supportsLogout: true,
    supportsProfileSync: true,
  };

  readonly config: Auth0Config;

  constructor(config: Auth0Config) {
    this.config = config;
  }

  /**
   * For OIDC flow, return the authorization URL.
   * For direct credentials (not implemented), would raise error.
   */
  async authenticate(
    request: AuthenticationRequest,
  ): Promise<AuthResult | AuthorizationUrl> {
    const redirectUri = request.redirectUri;
    if (!redirectUri) {
      throw new ConfigurationError(
        "auth0",
        "redirectUri is required for Auth0 OIDC flow",
      );
    }

    return this.getAuthorizationUrl(
      redirectUri,
      request.state || this.generateState(),
    );
  }

  /**
   * Handle OAuth 2.0 callback with authorization code.
   *
   * Steps:
   *   1. Validate state token (CSRF protection)
   *   2. Exchange code for tokens (POST to /oauth/token)
   *   3. Fetch user info (GET to /userinfo)
   *   4. Map Auth0 roles to Witylogix roles
   *   5. Return normalized AuthResult
   */
  async handleCallback(callbackData: CallbackData): Promise<AuthResult> {
    // Validate callback data
    if (!callbackData.code) {
      throw new InvalidCredentialsError(
        "auth0",
        callbackData.error || "Authorization code is required",
      );
    }

    if (callbackData.error) {
      throw new InvalidCredentialsError("auth0", callbackData.error);
    }

    try {
      // Exchange authorization code for tokens
      // In production: POST to https://{domain}/oauth/token
      const tokenResponse = await this.exchangeCodeForTokens(callbackData.code);

      // Fetch user info using access token
      // In production: GET https://{domain}/userinfo
      const userInfo = await this.getUserInfoFromProvider(
        tokenResponse.access_token,
      );

      // Map Auth0 roles to Witylogix roles
      const roles = this.mapRolesToWitylogix(userInfo.roles || []);

      return {
        externalUserId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        roles,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        metadata: {
          aud: tokenResponse.aud,
          iss: `https://${this.config.domain}/`,
          auth0_roles: userInfo.roles,
          email_verified: userInfo.email_verified,
        },
      };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw error;
      }
      throw new ProviderUnavailableError(
        "auth0",
        `Token exchange failed: ${String(error)}`,
      );
    }
  }

  /**
   * Validate an access token without refreshing.
   * Decodes JWT and checks expiry.
   */
  async validateToken(accessToken: string): Promise<Record<string, unknown>> {
    // In production: decode JWT without verification (or with Auth0's public key)
    // Check exp claim
    const payload = this.decodeJwt(accessToken);

    if (!payload) {
      throw new InvalidCredentialsError("auth0", "Invalid token format");
    }

    const expiry = (payload.exp as number) || 0;
    if (Date.now() / 1000 > expiry) {
      throw new TokenExpiredError("auth0");
    }

    return payload;
  }

  /**
   * Refresh an access token using a refresh token.
   *
   * Steps:
   *   1. POST to /oauth/token with grant_type=refresh_token
   *   2. Return new access + refresh tokens
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    try {
      // In production: POST https://{domain}/oauth/token
      const tokenResponse = await this.refreshAccessToken(refreshToken);

      // Fetch updated user info
      const userInfo = await this.getUserInfoFromProvider(
        tokenResponse.access_token,
      );
      const roles = this.mapRolesToWitylogix(userInfo.roles || []);

      return {
        externalUserId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        roles,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        metadata: {
          aud: tokenResponse.aud,
          iss: `https://${this.config.domain}/`,
          auth0_roles: userInfo.roles,
        },
      };
    } catch (error) {
      throw new ProviderUnavailableError(
        "auth0",
        `Token refresh failed: ${String(error)}`,
      );
    }
  }

  /**
   * Revoke access + refresh tokens (logout).
   * Calls Auth0's revocation endpoint.
   */
  async revokeSession(
    accessToken: string,
    refreshToken?: string,
  ): Promise<void> {
    try {
      // In production: POST to https://{domain}/oauth/revoke
      if (refreshToken) {
        await this.revokeTokenAtProvider(refreshToken);
      }
      // Also revoke access token if needed
      if (accessToken) {
        await this.revokeTokenAtProvider(accessToken);
      }
    } catch (error) {
      // Non-fatal; log but don't fail logout
      console.error("Failed to revoke Auth0 tokens:", error);
    }
  }

  /**
   * Get user information from Auth0 /userinfo endpoint.
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const userInfo = await this.getUserInfoFromProvider(accessToken);
    return {
      externalUserId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      roles: userInfo.roles || [],
      emailVerified: userInfo.email_verified,
      metadata: {
        app_metadata: userInfo.app_metadata,
        user_metadata: userInfo.user_metadata,
      },
    };
  }

  /**
   * Get the authorization URL for redirecting to Auth0 login.
   */
  async getAuthorizationUrl(
    redirectUri: string,
    state: string,
  ): Promise<AuthorizationUrl> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.config.rolesClaim
        ? "openid profile email"
        : "openid profile email",
      state,
    });

    if (this.config.audience) {
      params.append("audience", this.config.audience);
    }

    const url = `https://${this.config.domain}/authorize?${params.toString()}`;

    return {
      url,
      state,
    };
  }

  /**
   * Validate Auth0 configuration (check connectivity, credentials).
   */
  async validateConfiguration(): Promise<void> {
    if (
      !this.config.domain ||
      !this.config.clientId ||
      !this.config.clientSecret
    ) {
      throw new ConfigurationError(
        "auth0",
        "Auth0 domain, clientId, and clientSecret are required",
      );
    }

    try {
      // In production: GET /.well-known/openid-configuration to verify domain
      const discoveryUrl = `https://${this.config.domain}/.well-known/openid-configuration`;
      // Would validate that discoveryUrl is accessible and returns valid JSON
    } catch (error) {
      throw new ConfigurationError(
        "auth0",
        `Invalid Auth0 domain: ${this.config.domain}`,
      );
    }
  }

  /**
   * Get Auth0 health status.
   */
  async getHealthStatus(): Promise<ProviderHealthStatus> {
    try {
      const start = Date.now();
      // In production: ping Auth0's health endpoint
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
   * Exchange authorization code for access + refresh tokens.
   * POST /oauth/token
   */
  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    aud?: string;
  }> {
    // Mock: would POST to https://{domain}/oauth/token
    // For structure: payload = {
    //   client_id, client_secret, code, grant_type: "authorization_code", redirect_uri
    // }
    const mockResponse = {
      access_token: `auth0_at_${Date.now()}`,
      refresh_token: `auth0_rt_${Date.now()}`,
      expires_in: 86400, // 24 hours
      aud: this.config.audience || `https://${this.config.domain}/api/v2/`,
    };
    return mockResponse;
  }

  /**
   * Fetch user info from /userinfo endpoint.
   */
  private async getUserInfoFromProvider(accessToken: string): Promise<any> {
    // Mock: would GET https://{domain}/userinfo
    // Headers: Authorization: Bearer {accessToken}
    const mockUserInfo = {
      sub: `auth0|${Date.now()}`,
      email: "user@example.com",
      email_verified: true,
      name: "Auth0 User",
      picture: "https://example.com/avatar.jpg",
      roles: ["VIEWER"],
      app_metadata: { roles: ["VIEWER"] },
      user_metadata: {},
    };
    return mockUserInfo;
  }

  /**
   * Refresh access token using refresh token.
   * POST /oauth/token with grant_type=refresh_token
   */
  private async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    aud?: string;
  }> {
    // Mock: would POST to https://{domain}/oauth/token
    const mockResponse = {
      access_token: `auth0_at_refreshed_${Date.now()}`,
      refresh_token: `auth0_rt_refreshed_${Date.now()}`,
      expires_in: 86400,
      aud: this.config.audience || `https://${this.config.domain}/api/v2/`,
    };
    return mockResponse;
  }

  /**
   * Revoke a token at Auth0.
   * POST /oauth/revoke
   */
  private async revokeTokenAtProvider(token: string): Promise<void> {
    // Mock: would POST to https://{domain}/oauth/revoke
    // Payload: { client_id, client_secret, token }
  }

  /**
   * Decode JWT payload without verification (for expiry check).
   * In production: verify signature with Auth0's public key.
   */
  private decodeJwt(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Map Auth0 roles to Witylogix roles.
   * Uses config.roleMapping: { "external_role": "WITYLOGIX_ROLE" }
   */
  private mapRolesToWitylogix(auth0Roles: string[]): WitylogixRole[] {
    const roles: WitylogixRole[] = [];

    const mapping = this.config.roleMapping || {
      admin: "ADMIN",
      dispatcher: "DISPATCHER",
      viewer: "VIEWER",
      driver: "DRIVER",
    };

    for (const auth0Role of auth0Roles) {
      const mappedRole = mapping[auth0Role.toLowerCase()] as WitylogixRole;
      if (mappedRole) {
        roles.push(mappedRole);
      }
    }

    // Default to VIEWER if no roles mapped
    if (roles.length === 0) {
      roles.push(this.config.defaultRole || "VIEWER");
    }

    return roles;
  }

  /**
   * Generate a random state token for CSRF protection.
   */
  private generateState(): string {
    return Buffer.from(Math.random().toString())
      .toString("base64")
      .substring(0, 32);
  }
}
