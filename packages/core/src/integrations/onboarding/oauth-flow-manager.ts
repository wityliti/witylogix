/**
 * OAuth Flow Manager
 *
 * Manages OAuth 2.0 flows including state management, PKCE,
 * token exchange, refresh, and revocation for all providers.
 */

import crypto from 'crypto';
import { OAuthFlowState, OAuthTokenResponse, OAuthFlowError, ProviderOAuthConfig } from './types';
import { getSetupConfig } from './integration-setup-registry';

// ─── In-Memory State Store ──────────────────────────────────────

interface StoredFlowState {
  state: OAuthFlowState;
  expiresAt: Date;
}

const flowStateStore = new Map<string, StoredFlowState>();

// Auto-cleanup expired states every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [key, stored] of flowStateStore.entries()) {
    if (stored.expiresAt < now) {
      flowStateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Generate a random state string for CSRF protection.
 */
function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a code verifier for PKCE.
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate code challenge from verifier (PKCE).
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Interpolate provider-specific variables in URLs.
 */
function interpolateUrl(url: string, params: Record<string, string>): string {
  let result = url;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
}

// ─── OAuth Flow Manager ────────────────────────────────────────

export class OAuthFlowManager {
  /**
   * Initiate an OAuth 2.0 flow.
   *
   * Generates state, code verifier (if PKCE enabled), and returns
   * the authorization URL for redirecting the user to the provider.
   */
  static initiateOAuthFlow(
    providerId: string,
    redirectUri: string,
    customState?: Record<string, unknown>
  ): {
    authorizationUrl: string;
    state: string;
  } {
    const config = getSetupConfig(providerId);
    if (!config || !config.oauthConfig) {
      throw new OAuthFlowError(`No OAuth config found for provider: ${providerId}`);
    }

    const state = generateState();
    const codeVerifier = config.oauthConfig.pkceRequired ? generateCodeVerifier() : undefined;
    const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : undefined;

    // Store flow state (10 minute expiry)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const flowState: OAuthFlowState = {
      providerId,
      state,
      codeVerifier,
      redirectUri,
      expiresAt,
      customState,
    };

    flowStateStore.set(state, { state: flowState, expiresAt });

    // Build authorization URL
    let authUrl = config.oauthConfig.authorizationUrl;
    const params = new URLSearchParams({
      client_id: '', // Will be populated by caller
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: config.oauthConfig.scopes.join(' '),
    });

    // Add PKCE if required
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    // Add custom parameters
    if (config.oauthConfig.customParams) {
      for (const [key, value] of Object.entries(config.oauthConfig.customParams)) {
        params.append(key, value);
      }
    }

    return {
      authorizationUrl: `${authUrl}?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle OAuth callback and exchange code for tokens.
   *
   * Validates state for CSRF protection and exchanges authorization code
   * for access token using the token endpoint.
   */
  static async handleOAuthCallback(
    providerId: string,
    code: string,
    state: string,
    clientId: string,
    clientSecret: string
  ): Promise<OAuthTokenResponse> {
    // Validate state
    const storedFlow = flowStateStore.get(state);
    if (!storedFlow) {
      throw new OAuthFlowError('Invalid or expired OAuth state', { state });
    }

    if (storedFlow.state.providerId !== providerId) {
      throw new OAuthFlowError('State mismatch - provider ID does not match', {
        providerId,
        expectedProviderId: storedFlow.state.providerId,
      });
    }

    // Remove used state
    flowStateStore.delete(state);

    const config = getSetupConfig(providerId);
    if (!config || !config.oauthConfig) {
      throw new OAuthFlowError(`No OAuth config found for provider: ${providerId}`);
    }

    // Prepare token exchange request
    const body = new URLSearchParams({
      grant_type: config.oauthConfig.grantType,
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: storedFlow.state.redirectUri,
    });

    // Add PKCE code verifier if applicable
    if (storedFlow.state.codeVerifier) {
      body.append('code_verifier', storedFlow.state.codeVerifier);
    }

    // Exchange code for tokens
    try {
      const response = await fetch(config.oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new OAuthFlowError(`Token exchange failed: ${response.statusText}`, {
          statusCode: response.status,
          error: errorData.error,
          errorDescription: errorData.error_description,
        });
      }

      const tokenData = await response.json();

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
      };
    } catch (error) {
      if (error instanceof OAuthFlowError) throw error;
      throw new OAuthFlowError('Token exchange request failed', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Refresh an expired access token.
   *
   * Exchanges a refresh token for a new access token.
   */
  static async refreshOAuthToken(
    providerId: string,
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<OAuthTokenResponse> {
    const config = getSetupConfig(providerId);
    if (!config || !config.oauthConfig) {
      throw new OAuthFlowError(`No OAuth config found for provider: ${providerId}`);
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    try {
      const response = await fetch(config.oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new OAuthFlowError(`Token refresh failed: ${response.statusText}`, {
          statusCode: response.status,
          error: errorData.error,
        });
      }

      const tokenData = await response.json();

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
      };
    } catch (error) {
      if (error instanceof OAuthFlowError) throw error;
      throw new OAuthFlowError('Token refresh request failed', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Revoke an OAuth token.
   *
   * Revokes an access token to prevent further use.
   */
  static async revokeOAuthToken(
    providerId: string,
    accessToken: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<void> {
    const config = getSetupConfig(providerId);
    if (!config || !config.oauthConfig || !config.oauthConfig.revokeUrl) {
      // Provider doesn't support revocation - silently return
      return;
    }

    const body = new URLSearchParams({
      token: accessToken,
    });

    if (clientId) body.append('client_id', clientId);
    if (clientSecret) body.append('client_secret', clientSecret);

    try {
      const response = await fetch(config.oauthConfig.revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new OAuthFlowError(`Token revocation failed: ${response.statusText}`, {
          statusCode: response.status,
        });
      }
    } catch (error) {
      if (error instanceof OAuthFlowError) throw error;
      throw new OAuthFlowError('Token revocation request failed', {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get stored OAuth flow state.
   */
  static getFlowState(state: string): OAuthFlowState | undefined {
    const stored = flowStateStore.get(state);
    return stored?.state;
  }

  /**
   * Clear expired states manually.
   */
  static clearExpiredStates(): void {
    const now = new Date();
    for (const [key, stored] of flowStateStore.entries()) {
      if (stored.expiresAt < now) {
        flowStateStore.delete(key);
      }
    }
  }

  /**
   * Get flow state store size (for testing/monitoring).
   */
  static getStoreSize(): number {
    return flowStateStore.size;
  }
}

// ─── Provider-Specific OAuth Builders ───────────────────────────

/**
 * Build OAuth config for Google products (Maps, Analytics, Drive, etc).
 */
export function buildGoogleOAuthConfig(products: string[]): ProviderOAuthConfig['google'] {
  const scopeMap: Record<string, string[]> = {
    maps: ['https://www.googleapis.com/auth/maps-platform.routes'],
    analytics: ['https://www.googleapis.com/auth/analytics.readonly'],
    drive: ['https://www.googleapis.com/auth/drive.readonly'],
    sheets: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    gmail: ['https://www.googleapis.com/auth/gmail.modify'],
  };

  const allScopes = products
    .flatMap((product) => scopeMap[product] || [])
    .filter((s, i, a) => a.indexOf(s) === i); // Deduplicate

  return {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopesByProduct: Object.fromEntries(
      products.map((p) => [p, scopeMap[p] || []])
    ),
  };
}

/**
 * Build OAuth config for Shopify (with HMAC validation).
 */
export function buildShopifyOAuthConfig(shopDomain: string): ProviderOAuthConfig['shopify'] {
  return {
    authorizationUrl: `https://${shopDomain}/admin/oauth/authorize`,
    accessTokenUrl: `https://${shopDomain}/admin/oauth/access_token`,
    hmacValidation: true,
  };
}

/**
 * Build OAuth config for DocuSign (demo or production).
 */
export function buildDocuSignOAuthConfig(
  environment: 'demo' | 'production' = 'demo'
): ProviderOAuthConfig['docusign'] {
  const baseUrl = environment === 'demo' ? 'https://demo.docusign.net' : 'https://na4.docusign.net';
  return {
    demoBaseUrl: 'https://demo.docusign.net',
    productionBaseUrl: 'https://na4.docusign.net',
  };
}

/**
 * Build OAuth config for Salesforce (login or test).
 */
export function buildSalesforceOAuthConfig(
  isSandbox: boolean = false
): ProviderOAuthConfig['salesforce'] {
  return {
    loginUrl: isSandbox
      ? 'https://test.salesforce.com/services/oauth2/authorize'
      : 'https://login.salesforce.com/services/oauth2/authorize',
    testUrl: 'https://test.salesforce.com/services/oauth2/authorize',
    apiVersion: '58.0',
  };
}
