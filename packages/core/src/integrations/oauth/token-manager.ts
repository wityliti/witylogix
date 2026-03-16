/**
 * OAuth2 Token Manager — Complete token lifecycle management
 *
 * Features:
 * - OAuth2 authorization URL generation with PKCE support
 * - Code exchange for access/refresh tokens
 * - Automatic token refresh with configurable buffer
 * - Retry with exponential backoff on refresh failures
 * - Token persistence via credential vault
 * - Grant types: authorization_code, client_credentials, refresh_token
 * - Token revocation and event emission
 * - Event emitter for token lifecycle events
 *
 * Grant Type Support:
 * - authorization_code: Standard OAuth2 flow with PKCE
 * - client_credentials: Service-to-service authentication
 * - refresh_token: Token refresh flow
 */

import { randomBytes, createHash } from 'crypto';
import { EventEmitter } from 'events';
import type { CredentialVault, CredentialEntry } from '../credentials/credential-vault.js';

// ─── Types ──────────────────────────────────────────────────────────

/**
 * OAuth2 token response from authorization server
 */
export interface OAuth2Token {
  /** Access token for API calls */
  accessToken: string;
  /** Token type (usually 'Bearer') */
  tokenType?: string;
  /** Refresh token (if applicable) */
  refreshToken?: string;
  /** Expiration in seconds from now */
  expiresIn: number;
  /** Additional scopes granted */
  scope?: string;
  /** Raw response from auth server (for custom fields) */
  rawResponse?: Record<string, unknown>;
}

/**
 * PKCE state for authorization code flow
 */
export interface PKCEState {
  /** Code verifier (43-128 chars, unreserved chars only) */
  codeVerifier: string;
  /** Code challenge (SHA256 hash of verifier, base64url encoded) */
  codeChallenge: string;
  /** Code challenge method (always S256) */
  codeChallengeMethod: 'S256';
  /** State parameter for CSRF protection */
  state: string;
}

/**
 * OAuth2 configuration for a provider
 */
export interface OAuth2Config {
  /** Authorization endpoint URL */
  authorizationUrl: string;
  /** Token endpoint URL */
  tokenUrl: string;
  /** Client ID */
  clientId: string;
  /** Client secret (required for confidential clients) */
  clientSecret?: string;
  /** Redirect URI after authorization */
  redirectUri?: string;
  /** OAuth2 grant type */
  grantType: 'authorization_code' | 'client_credentials' | 'refresh_token';
  /** Requested scopes */
  scopes?: string[];
  /** Use PKCE for public clients (default: true if no clientSecret) */
  usePkce?: boolean;
  /** Buffer time before token expiry to refresh (default: 5 minutes) */
  refreshBufferMs?: number;
  /** Max retries on refresh failure (default: 3) */
  maxRefreshRetries?: number;
  /** Backoff multiplier for retries (default: 2) */
  backoffMultiplier?: number;
}

/**
 * Configuration for token manager
 */
export interface TokenManagerConfig {
  /** OAuth2 config for the provider */
  oauth2Config: OAuth2Config;
  /** Credential vault for persistence */
  credentialVault: CredentialVault;
  /** HTTP client for token exchanges */
  httpClient: IHttpClient;
  /** Tenant ID for credential isolation */
  tenantId: string;
  /** Provider ID (slug) */
  providerId: string;
}

/**
 * HTTP client interface for token exchange
 */
export interface IHttpClient {
  post<T>(
    url: string,
    data: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T>;
}

/**
 * Stored token credential structure
 */
export interface StoredToken {
  accessToken: string;
  tokenType: string;
  refreshToken?: string;
  expiresAt: number; // Timestamp in milliseconds
  scope?: string;
  grantType: 'authorization_code' | 'client_credentials' | 'refresh_token';
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_REFRESH_RETRIES = 3;
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const PKCE_CODE_VERIFIER_LENGTH = 128; // Maximum length for safety
const PKCE_ALLOWED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

// ─── Token Manager ──────────────────────────────────────────────────

export class OAuth2TokenManager extends EventEmitter {
  private oauth2Config: OAuth2Config;
  private credentialVault: CredentialVault;
  private httpClient: IHttpClient;
  private tenantId: string;
  private providerId: string;
  private currentToken: OAuth2Token | null = null;
  private refreshPromise: Promise<OAuth2Token> | null = null;
  private refreshBufferMs: number;
  private maxRefreshRetries: number;
  private backoffMultiplier: number;

  constructor(config: TokenManagerConfig) {
    super();
    this.oauth2Config = config.oauth2Config;
    this.credentialVault = config.credentialVault;
    this.httpClient = config.httpClient;
    this.tenantId = config.tenantId;
    this.providerId = config.providerId;
    this.refreshBufferMs = config.oauth2Config.refreshBufferMs ?? DEFAULT_REFRESH_BUFFER_MS;
    this.maxRefreshRetries = config.oauth2Config.maxRefreshRetries ?? DEFAULT_MAX_REFRESH_RETRIES;
    this.backoffMultiplier = config.oauth2Config.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;
  }

  /**
   * Generate authorization URL for OAuth2 flow
   */
  generateAuthorizationUrl(scope?: string[]): { url: string; pkce?: PKCEState } {
    const scopes = scope ?? this.oauth2Config.scopes ?? [];
    const params = new URLSearchParams({
      client_id: this.oauth2Config.clientId,
      response_type: 'code',
      scope: scopes.join(' '),
    });

    if (this.oauth2Config.redirectUri) {
      params.append('redirect_uri', this.oauth2Config.redirectUri);
    }

    // Add PKCE if configured
    let pkce: PKCEState | undefined;
    const shouldUsePkce = this.oauth2Config.usePkce ?? !this.oauth2Config.clientSecret;
    if (shouldUsePkce) {
      pkce = this.generatePKCE();
      params.append('code_challenge', pkce.codeChallenge);
      params.append('code_challenge_method', pkce.codeChallengeMethod);
      params.append('state', pkce.state);
    }

    const url = `${this.oauth2Config.authorizationUrl}?${params.toString()}`;

    return { url, pkce };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCode(
    code: string,
    pkceState?: PKCEState,
  ): Promise<OAuth2Token> {
    const body: Record<string, unknown> = {
      grant_type: 'authorization_code',
      client_id: this.oauth2Config.clientId,
      code,
    };

    if (this.oauth2Config.clientSecret) {
      body.client_secret = this.oauth2Config.clientSecret;
    }

    if (this.oauth2Config.redirectUri) {
      body.redirect_uri = this.oauth2Config.redirectUri;
    }

    if (pkceState) {
      body.code_verifier = pkceState.codeVerifier;
    }

    const response = await this.httpClient.post<Record<string, unknown>>(
      this.oauth2Config.tokenUrl,
      body,
    );

    const token = this.parseTokenResponse(response);

    // Store token in vault
    await this.storeToken(token);

    this.currentToken = token;
    this.emit('token_refreshed', { token });

    return token;
  }

  /**
   * Get current token, refreshing if necessary
   */
  async getToken(): Promise<OAuth2Token> {
    // If we have a current token and it's not near expiry, return it
    if (this.currentToken && !this.isTokenExpiring(this.currentToken)) {
      return this.currentToken;
    }

    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Try to load from vault
    const storedToken = await this.loadToken();
    if (storedToken && !this.isTokenExpiring(storedToken)) {
      this.currentToken = storedToken;
      return storedToken;
    }

    // Need to refresh or get new token
    if (storedToken?.refreshToken) {
      return this.refreshToken();
    }

    throw new Error(
      `No valid token available for provider "${this.providerId}". ` +
      'Please authorize first.',
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<OAuth2Token> {
    // Prevent multiple concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Revoke the current token
   */
  async revokeToken(): Promise<void> {
    const token = this.currentToken ?? (await this.loadToken());
    if (!token) {
      return;
    }

    // Some providers have a revocation endpoint
    try {
      const revokeUrl = this.getRevokeUrl();
      if (revokeUrl) {
        await this.httpClient.post(revokeUrl, {
          token: token.accessToken,
          client_id: this.oauth2Config.clientId,
          client_secret: this.oauth2Config.clientSecret,
        });
      }
    } catch (error) {
      // Log but don't fail if revocation endpoint doesn't exist
      console.warn(`Failed to revoke token for ${this.providerId}:`, error);
    }

    // Clear stored token
    await this.credentialVault.delete(this.tenantId, this.providerId);
    this.currentToken = null;

    this.emit('token_revoked', { providerId: this.providerId });
  }

  /**
   * Check if token is expiring soon
   */
  private isTokenExpiring(token: OAuth2Token): boolean {
    const expiresAt = Date.now() + token.expiresIn * 1000;
    return expiresAt - Date.now() < this.refreshBufferMs;
  }

  /**
   * Parse OAuth2 token response
   */
  private parseTokenResponse(response: Record<string, unknown>): OAuth2Token {
    const accessToken = response.access_token as string;
    if (!accessToken) {
      throw new Error('No access_token in response');
    }

    return {
      accessToken,
      tokenType: (response.token_type as string) ?? 'Bearer',
      refreshToken: response.refresh_token as string | undefined,
      expiresIn: (response.expires_in as number) ?? 3600,
      scope: response.scope as string | undefined,
      rawResponse: response,
    };
  }

  /**
   * Perform actual token refresh with retries
   */
  private async performRefresh(): Promise<OAuth2Token> {
    let lastError: Error | null = null;
    let backoffMs = 1000;

    for (let attempt = 0; attempt < this.maxRefreshRetries; attempt++) {
      try {
        const storedToken = await this.loadToken();
        if (!storedToken?.refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await this.httpClient.post<Record<string, unknown>>(
          this.oauth2Config.tokenUrl,
          {
            grant_type: 'refresh_token',
            refresh_token: storedToken.refreshToken,
            client_id: this.oauth2Config.clientId,
            client_secret: this.oauth2Config.clientSecret,
          },
        );

        const token = this.parseTokenResponse(response);
        await this.storeToken(token);
        this.currentToken = token;

        this.emit('token_refreshed', { token, attempt });
        return token;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRefreshRetries - 1) {
          await this.delay(backoffMs);
          backoffMs *= this.backoffMultiplier;
        }
      }
    }

    this.emit('token_refresh_failed', {
      providerId: this.providerId,
      error: lastError?.message,
      attempts: this.maxRefreshRetries,
    });

    throw new Error(
      `Failed to refresh token for ${this.providerId} after ${this.maxRefreshRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Store token in credential vault
   */
  private async storeToken(token: OAuth2Token): Promise<void> {
    const stored: StoredToken = {
      accessToken: token.accessToken,
      tokenType: token.tokenType ?? 'Bearer',
      refreshToken: token.refreshToken,
      expiresAt: Date.now() + token.expiresIn * 1000,
      scope: token.scope,
      grantType: this.oauth2Config.grantType,
    };

    const entry: CredentialEntry = {
      tenantId: this.tenantId,
      providerId: this.providerId,
      credentialType: 'oauth_token',
      credential: {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken ?? '',
        expiresAt: String(stored.expiresAt),
        tokenType: stored.tokenType,
        scope: stored.scope ?? '',
      },
      metadata: { grantType: this.oauth2Config.grantType },
    };

    const expiresAt = new Date(stored.expiresAt);
    await this.credentialVault.store(entry, expiresAt);
  }

  /**
   * Load token from credential vault
   */
  private async loadToken(): Promise<OAuth2Token | null> {
    const entry = await this.credentialVault.retrieve(this.tenantId, this.providerId);
    if (!entry || entry.credentialType !== 'oauth_token') {
      return null;
    }

    const cred = entry.credential;
    return {
      accessToken: cred.accessToken,
      tokenType: cred.tokenType ?? 'Bearer',
      refreshToken: cred.refreshToken || undefined,
      expiresIn: Math.floor((parseInt(cred.expiresAt, 10) - Date.now()) / 1000),
      scope: cred.scope || undefined,
    };
  }

  /**
   * Generate PKCE state
   */
  private generatePKCE(): PKCEState {
    // Generate code verifier (128 characters of allowed chars)
    const codeVerifier = this.generateRandomString(PKCE_CODE_VERIFIER_LENGTH);

    // Generate code challenge (SHA256 of verifier, base64url encoded)
    const hash = createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = this.base64urlEncode(hash);

    // Generate state for CSRF protection
    const state = this.generateRandomString(32);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
      state,
    };
  }

  /**
   * Generate random string from PKCE allowed characters
   */
  private generateRandomString(length: number): string {
    let result = '';
    const randomBytes_ = randomBytes(length);

    for (let i = 0; i < length; i++) {
      const index = randomBytes_[i] % PKCE_ALLOWED_CHARS.length;
      result += PKCE_ALLOWED_CHARS[index];
    }

    return result;
  }

  /**
   * Base64url encode (no padding, url-safe)
   */
  private base64urlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Get token revocation URL (provider-specific)
   */
  private getRevokeUrl(): string | null {
    // This would be overridden by provider-specific implementations
    return null;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Token manager event types
 */
export type TokenManagerEvent =
  | 'token_refreshed'
  | 'token_revoked'
  | 'token_refresh_failed';
