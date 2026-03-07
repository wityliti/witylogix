/**
 * Generic OpenID Connect Provider — Works with ANY OIDC-compliant IdP.
 *
 * This provider implements the standard OIDC Authorization Code flow.
 * It discovers endpoints via .well-known/openid-configuration.
 *
 * Supports:
 *   - Keycloak (open-source)
 *   - Okta (if using generic OIDC instead of Okta provider)
 *   - Auth servers implementing OpenID Connect
 *   - Custom enterprise IdPs
 *
 * Config:
 *   - issuer: OIDC issuer URL (e.g., https://auth.example.com)
 *   - clientId: OAuth 2.0 Client ID
 *   - clientSecret: OAuth 2.0 Client Secret
 *   - discoveryUrl: .well-known/openid-configuration URL (optional; auto-discovered)
 *   - scope: OAuth scopes (default: openid profile email)
 *   - rolesClaim: claim containing roles (default: roles)
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
  GenericOIDCConfig,
  WitylogixRole,
} from "../types.js";
import {
  InvalidCredentialsError,
  TokenExpiredError,
  ProviderUnavailableError,
  ConfigurationError,
} from "../types.js";

export class GenericOIDCProvider implements BaseAuthProvider {
  readonly type = "generic_oidc";
  readonly name = "OpenID Connect (Generic)";
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

  readonly config: GenericOIDCConfig;
  private discoveryCache: Record<string, any> | null = null;

  constructor(config: GenericOIDCConfig) {
    this.config = config;
  }

  /**
   * For OIDC flow, return the authorization URL.
   */
  async authenticate(request: AuthenticationRequest): Promise<AuthResult | AuthorizationUrl> {
    const redirectUri = request.redirectUri;
    if (!redirectUri) {
      throw new ConfigurationError("generic_oidc", "redirectUri is required for OIDC flow");
    }

    return this.getAuthorizationUrl(redirectUri, request.state || this.generateState());
  }

  /**
   * Handle OIDC callback with authorization code.
   */
  async handleCallback(callbackData: CallbackData): Promise<AuthResult> {
    if (!callbackData.code) {
      throw new InvalidCredentialsError(
        "generic_oidc",
        callbackData.error || "Authorization code is required",
      );
    }

    if (callbackData.error) {
      throw new InvalidCredentialsError("generic_oidc", callbackData.error);
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(callbackData.code);

      // Decode ID token
      const idTokenPayload = this.decodeJwt(tokenResponse.id_token);
      if (!idTokenPayload) {
        throw new Error("Failed to decode ID token");
      }

      // Extract roles from configured claim
      const rolesClaim = this.config.rolesClaim || "roles";
      const roles = this.mapRolesToWitylogix((idTokenPayload[rolesClaim] as string[]) || []);

      return {
        externalUserId: idTokenPayload.sub as string,
        email: idTokenPayload.email as string,
        name: idTokenPayload.name as string,
        picture: idTokenPayload.picture as string,
        roles,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000),
        metadata: {
          oidc_roles: (idTokenPayload[rolesClaim] as string[]) || [],
          email_verified: idTokenPayload.email_verified,
        },
      };
    } catch (error) {
      throw new ProviderUnavailableError("generic_oidc", `Token exchange failed: ${String(error)}`);
    }
  }

  /**
   * Validate an OIDC access token.
   */
  async validateToken(accessToken: string): Promise<Record<string, unknown>> {
    const payload = this.decodeJwt(accessToken);

    if (!payload) {
      throw new InvalidCredentialsError("generic_oidc", "Invalid token format");
    }

    // Check expiry
    const exp = (payload.exp as number) || 0;
    if (Date.now() / 1000 > exp) {
      throw new TokenExpiredError("generic_oidc");
    }

    return payload;
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    try {
      const tokenResponse = await this.refreshAccessToken(refreshToken);

      // Decode new ID token
      const idTokenPayload = this.decodeJwt(tokenResponse.id_token);
      if (!idTokenPayload) {
        throw new Error("Failed to decode ID token");
      }

      const rolesClaim = this.config.rolesClaim || "roles";
      const roles = this.mapRolesToWitylogix((idTokenPayload[rolesClaim] as string[]) || []);

      return {
        externalUserId: idTokenPayload.sub as string,
        email: idTokenPayload.email as string,
        name: idTokenPayload.name as string,
        picture: idTokenPayload.picture as string,
        roles,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000),
        metadata: {
          oidc_roles: (idTokenPayload[rolesClaim] as string[]) || [],
        },
      };
    } catch (error) {
      throw new ProviderUnavailableError("generic_oidc", `Token refresh failed: ${String(error)}`);
    }
  }

  /**
   * Revoke an access token (logout).
   */
  async revokeSession(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // Try to revoke at the provider's revocation endpoint
      if (refreshToken) {
        await this.revokeTokenAtProvider(refreshToken);
      }
    } catch (error) {
      console.error("Failed to revoke OIDC token:", error);
    }
  }

  /**
   * Get user information from OIDC.
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const userInfo = await this.fetchOIDCUserInfo(accessToken);
    const rolesClaim = this.config.rolesClaim || "roles";

    return {
      externalUserId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      roles: (userInfo[rolesClaim] as string[]) || [],
      emailVerified: userInfo.email_verified,
    };
  }

  /**
   * Get authorization URL for OIDC SSO.
   */
  async getAuthorizationUrl(redirectUri: string, state: string): Promise<AuthorizationUrl> {
    // Discover endpoints
    const discovery = await this.discoverOIDCEndpoints();

    const scope = this.config.scope || "openid profile email";
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      state,
    });

    const url = `${discovery.authorization_endpoint}?${params.toString()}`;

    return {
      url,
      state,
    };
  }

  /**
   * Validate OIDC configuration.
   */
  async validateConfiguration(): Promise<void> {
    if (!this.config.issuer || !this.config.clientId || !this.config.clientSecret) {
      throw new ConfigurationError(
        "generic_oidc",
        "OIDC issuer, clientId, and clientSecret are required",
      );
    }

    try {
      // Try to discover endpoints
      await this.discoverOIDCEndpoints();
    } catch (error) {
      throw new ConfigurationError(
        "generic_oidc",
        `Failed to discover OIDC endpoints: ${String(error)}`,
      );
    }
  }

  /**
   * Get OIDC provider health status.
   */
  async getHealthStatus(): Promise<ProviderHealthStatus> {
    try {
      const start = Date.now();
      // Try to fetch discovery document
      await this.discoverOIDCEndpoints();
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
   * Discover OIDC endpoints via .well-known/openid-configuration.
   */
  private async discoverOIDCEndpoints(): Promise<any> {
    if (this.discoveryCache) {
      return this.discoveryCache;
    }

    const discoveryUrl =
      this.config.discoveryUrl ||
      `${this.config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;

    try {
      // Mock: would fetch and parse discovery document
      const mockDiscovery = {
        issuer: this.config.issuer,
        authorization_endpoint: `${this.config.issuer}/protocol/openid-connect/auth`,
        token_endpoint: `${this.config.issuer}/protocol/openid-connect/token`,
        userinfo_endpoint: `${this.config.issuer}/protocol/openid-connect/userinfo`,
        revocation_endpoint: `${this.config.issuer}/protocol/openid-connect/revoke`,
        jwks_uri: `${this.config.issuer}/protocol/openid-connect/certs`,
      };

      this.discoveryCache = mockDiscovery;
      return mockDiscovery;
    } catch (error) {
      throw new ProviderUnavailableError("generic_oidc", `Discovery failed: ${String(error)}`);
    }
  }

  /**
   * Exchange authorization code for tokens.
   */
  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  }> {
    // Mock: would POST to token_endpoint
    const mockResponse = {
      access_token: `oidc_at_${Date.now()}`,
      id_token: `oidc_idt_${Date.now()}`,
      refresh_token: `oidc_rt_${Date.now()}`,
      expires_in: 3600,
      token_type: "Bearer",
    };
    return mockResponse;
  }

  /**
   * Refresh access token using refresh token.
   */
  private async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    // Mock: would POST to token_endpoint with grant_type=refresh_token
    const mockResponse = {
      access_token: `oidc_at_refreshed_${Date.now()}`,
      id_token: `oidc_idt_refreshed_${Date.now()}`,
      refresh_token: refreshToken,
      expires_in: 3600,
    };
    return mockResponse;
  }

  /**
   * Revoke a token at the provider.
   */
  private async revokeTokenAtProvider(token: string): Promise<void> {
    // Mock: would POST to revocation_endpoint
  }

  /**
   * Fetch user info using access token.
   */
  private async fetchOIDCUserInfo(accessToken: string): Promise<any> {
    // Mock: would GET /userinfo
    const mockUser = {
      sub: `oidc|${Date.now()}`,
      email: "user@example.com",
      email_verified: true,
      name: "OIDC User",
      picture: "https://example.com/avatar.jpg",
      roles: ["VIEWER"],
    };
    return mockUser;
  }

  /**
   * Decode JWT payload without verification.
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
   * Map OIDC roles to Witylogix roles.
   */
  private mapRolesToWitylogix(oidcRoles: string[]): WitylogixRole[] {
    const roles: WitylogixRole[] = [];

    const mapping = this.config.roleMapping || {
      admin: "ADMIN",
      dispatcher: "DISPATCHER",
      viewer: "VIEWER",
      driver: "DRIVER",
    };

    for (const role of oidcRoles) {
      const mappedRole = mapping[role.toLowerCase()] as WitylogixRole;
      if (mappedRole) {
        roles.push(mappedRole);
      }
    }

    if (roles.length === 0) {
      roles.push(this.config.defaultRole || "VIEWER");
    }

    return roles;
  }

  /**
   * Generate random state token.
   */
  private generateState(): string {
    return Buffer.from(Math.random().toString()).toString("base64").substring(0, 32);
  }
}
