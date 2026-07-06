/**
 * AWS Cognito Authentication Provider — User Pool OAuth 2.0 + OIDC.
 *
 * Cognito combines user management + identity federation.
 * Uses OAuth 2.0 authorization code flow for SSO.
 *
 * Config:
 *   - userPoolId: us-east-1_xxxxx
 *   - region: us-east-1
 *   - clientId: OAuth 2.0 App Client ID
 *   - clientSecret: OAuth 2.0 App Client Secret (optional)
 *   - groupsClaim: custom claim containing user groups (default: cognito:groups)
 *
 * Flow:
 *   1. App redirects to /oauth2/authorize
 *   2. User authenticates with Cognito
 *   3. Cognito redirects to callback with authorization code
 *   4. App exchanges code for ID + access tokens
 *   5. Decode ID token, extract roles/groups
 *   6. Create ExternalAuthSession, issue Witylogix JWT
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
  CognitoConfig,
  WitylogixRole,
} from "../types.js";
import {
  InvalidCredentialsError,
  TokenExpiredError,
  ProviderUnavailableError,
  ConfigurationError,
} from "../types.js";

export class CognitoProvider implements BaseAuthProvider {
  readonly type = "cognito";
  readonly name = "AWS Cognito";
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

  readonly config: CognitoConfig;

  constructor(config: CognitoConfig) {
    this.config = config;
  }

  /**
   * For OIDC flow, return the authorization URL.
   */
  async authenticate(
    request: AuthenticationRequest,
  ): Promise<AuthResult | AuthorizationUrl> {
    const redirectUri = request.redirectUri;
    if (!redirectUri) {
      throw new ConfigurationError(
        "cognito",
        "redirectUri is required for Cognito OIDC flow",
      );
    }

    return this.getAuthorizationUrl(
      redirectUri,
      request.state || this.generateState(),
    );
  }

  /**
   * Handle Cognito OAuth 2.0 callback with authorization code.
   */
  async handleCallback(callbackData: CallbackData): Promise<AuthResult> {
    if (!callbackData.code) {
      throw new InvalidCredentialsError(
        "cognito",
        callbackData.error || "Authorization code is required",
      );
    }

    if (callbackData.error) {
      throw new InvalidCredentialsError("cognito", callbackData.error);
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(callbackData.code);

      // Decode ID token to extract user claims
      const idTokenPayload = this.decodeJwt(tokenResponse.id_token);
      if (!idTokenPayload) {
        throw new Error("Failed to decode ID token");
      }

      // Extract user attributes and roles
      const groupsClaim = this.config.groupsClaim || "cognito:groups";
      const groups = (idTokenPayload[groupsClaim] as string[]) || [];

      // Map Cognito groups to Witylogix roles
      const roles = this.mapRolesToWitylogix(groups);

      return {
        externalUserId: idTokenPayload.sub as string,
        email: idTokenPayload.email as string,
        name: idTokenPayload.name as string,
        picture: idTokenPayload.picture as string,
        roles,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        metadata: {
          cognito_groups: groups,
          email_verified: idTokenPayload.email_verified,
          phone_number_verified: idTokenPayload.phone_number_verified,
        },
      };
    } catch (error) {
      throw new ProviderUnavailableError(
        "cognito",
        `Token exchange failed: ${String(error)}`,
      );
    }
  }

  /**
   * Validate a Cognito access token.
   */
  async validateToken(accessToken: string): Promise<Record<string, unknown>> {
    const payload = this.decodeJwt(accessToken);

    if (!payload) {
      throw new InvalidCredentialsError("cognito", "Invalid token format");
    }

    // Check expiry
    const exp = (payload.exp as number) || 0;
    if (Date.now() / 1000 > exp) {
      throw new TokenExpiredError("cognito");
    }

    return payload;
  }

  /**
   * Refresh an access token using a refresh token.
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    try {
      const tokenResponse = await this.refreshAccessToken(refreshToken);

      // Decode new ID token
      const idTokenPayload = this.decodeJwt(tokenResponse.id_token);
      if (!idTokenPayload) {
        throw new Error("Failed to decode ID token");
      }

      const groupsClaim = this.config.groupsClaim || "cognito:groups";
      const groups = (idTokenPayload[groupsClaim] as string[]) || [];
      const roles = this.mapRolesToWitylogix(groups);

      return {
        externalUserId: idTokenPayload.sub as string,
        email: idTokenPayload.email as string,
        name: idTokenPayload.name as string,
        picture: idTokenPayload.picture as string,
        roles,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        metadata: {
          cognito_groups: groups,
        },
      };
    } catch (error) {
      throw new ProviderUnavailableError(
        "cognito",
        `Token refresh failed: ${String(error)}`,
      );
    }
  }

  /**
   * Revoke a Cognito access token (logout).
   */
  async revokeSession(
    accessToken: string,
    refreshToken?: string,
  ): Promise<void> {
    try {
      // In production: POST /oauth2/revoke
      // Payload: { token, client_id, client_secret }
      if (accessToken) {
        await this.revokeTokenAtCognito(accessToken);
      }
    } catch (error) {
      console.error("Failed to revoke Cognito token:", error);
    }
  }

  /**
   * Get user information from Cognito.
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const userInfo = await this.fetchCognitoUserInfo(accessToken);
    const groupsClaim = this.config.groupsClaim || "cognito:groups";

    return {
      externalUserId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      roles: (userInfo[groupsClaim] as string[]) || [],
      emailVerified: userInfo.email_verified,
      metadata: {
        phone_number_verified: userInfo.phone_number_verified,
        phone_number: userInfo.phone_number,
      },
    };
  }

  /**
   * Get authorization URL for Cognito SSO.
   */
  async getAuthorizationUrl(
    redirectUri: string,
    state: string,
  ): Promise<AuthorizationUrl> {
    const cognitoDomain = this.extractCognitoDomain();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: "code",
      scope: "openid profile email",
      redirect_uri: redirectUri,
      state,
    });

    const url = `https://${cognitoDomain}/oauth2/authorize?${params.toString()}`;

    return {
      url,
      state,
    };
  }

  /**
   * Validate Cognito configuration.
   */
  async validateConfiguration(): Promise<void> {
    if (
      !this.config.userPoolId ||
      !this.config.region ||
      !this.config.clientId
    ) {
      throw new ConfigurationError(
        "cognito",
        "Cognito userPoolId, region, and clientId are required",
      );
    }

    // Validate that userPoolId format is correct (region_xxxxxxx)
    const match = this.config.userPoolId.match(/^([a-z0-9-]+)_([a-zA-Z0-9]+)$/);
    if (!match) {
      throw new ConfigurationError(
        "cognito",
        `Invalid userPoolId format: ${this.config.userPoolId}`,
      );
    }
  }

  /**
   * Get Cognito health status.
   */
  async getHealthStatus(): Promise<ProviderHealthStatus> {
    try {
      const start = Date.now();
      // In production: ping .well-known/openid-configuration
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
   * Extract the Cognito domain from userPoolId.
   * Format: region_poolId → domain: region.auth.amazonaws.com
   */
  private extractCognitoDomain(): string {
    const region = this.config.userPoolId.split("_")[0];
    return `${region}.auth.amazonaws.com`;
  }

  /**
   * Exchange authorization code for tokens.
   * POST /oauth2/token
   */
  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }> {
    // Mock: would POST to https://{domain}/oauth2/token
    const mockResponse = {
      access_token: `cognito_at_${Date.now()}`,
      id_token: `cognito_idt_${Date.now()}`,
      refresh_token: `cognito_rt_${Date.now()}`,
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
    expires_in: number;
    token_type: string;
  }> {
    // Mock: would POST to /oauth2/token with grant_type=refresh_token
    const mockResponse = {
      access_token: `cognito_at_refreshed_${Date.now()}`,
      id_token: `cognito_idt_refreshed_${Date.now()}`,
      refresh_token: refreshToken, // Cognito sometimes doesn't return new refresh token
      expires_in: 3600,
      token_type: "Bearer",
    };
    return mockResponse;
  }

  /**
   * Revoke a token at Cognito.
   */
  private async revokeTokenAtCognito(token: string): Promise<void> {
    // Mock: would POST to /oauth2/revoke
  }

  /**
   * Fetch user info using access token.
   * GET /oauth2/userinfo
   */
  private async fetchCognitoUserInfo(accessToken: string): Promise<any> {
    // Mock: would GET /oauth2/userinfo
    // Headers: Authorization: Bearer {accessToken}
    const mockUser = {
      sub: `cognito|${Date.now()}`,
      email: "user@example.com",
      email_verified: true,
      name: "Cognito User",
      picture: "https://example.com/avatar.jpg",
      phone_number: "+1234567890",
      phone_number_verified: false,
      "cognito:groups": ["VIEWER"],
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
   * Map Cognito groups to Witylogix roles.
   */
  private mapRolesToWitylogix(cognitoGroups: string[]): WitylogixRole[] {
    const roles: WitylogixRole[] = [];

    const mapping = this.config.roleMapping || {
      admin: "ADMIN",
      dispatcher: "DISPATCHER",
      viewer: "VIEWER",
      driver: "DRIVER",
    };

    for (const group of cognitoGroups) {
      const mappedRole = mapping[group.toLowerCase()] as WitylogixRole;
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
    return Buffer.from(Math.random().toString())
      .toString("base64")
      .substring(0, 32);
  }
}
