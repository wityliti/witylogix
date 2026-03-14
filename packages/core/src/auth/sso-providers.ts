/**
 * SSO Providers
 *
 * Abstract base class and implementations for OAuth2/OIDC providers.
 * Supports Google, Microsoft, and custom OIDC providers.
 */

import { randomBytes } from 'crypto';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizationUrlOptions {
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}

export interface CallbackResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

/**
 * Abstract SSO Provider base class
 */
abstract class SSOProvider {
  protected config: OAuthConfig;
  protected provider: string;

  constructor(config: OAuthConfig, provider: string) {
    this.config = config;
    this.provider = provider;
    this.validate();
  }

  /**
   * Validate configuration
   */
  protected validate(): void {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.redirectUri) {
      throw new Error(`Invalid ${this.provider} configuration`);
    }
  }

  /**
   * Generate PKCE code challenge
   */
  protected generatePKCE(): {
    codeVerifier: string;
    codeChallenge: string;
  } {
    const codeVerifier = randomBytes(32).toString('base64url');

    // Create S256 challenge (SHA256 hash of verifier)
    const crypto = require('crypto');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate random state parameter
   */
  protected generateState(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Get authorization URL
   */
  abstract getAuthorizationUrl(options?: AuthorizationUrlOptions): string;

  /**
   * Exchange authorization code for access token
   */
  abstract exchangeCodeForToken(code: string, codeVerifier?: string): Promise<string>;

  /**
   * Get user profile from provider
   */
  abstract getUserProfile(accessToken: string): Promise<UserProfile>;

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string, codeVerifier?: string): Promise<CallbackResult> {
    try {
      const accessToken = await this.exchangeCodeForToken(code, codeVerifier);
      const user = await this.getUserProfile(accessToken);
      return { success: true, user };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'OAuth callback failed';
      return { success: false, error: errorMessage };
    }
  }
}

/**
 * Google OAuth2 Provider
 */
export class GoogleSSOProvider extends SSOProvider {
  private authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  private tokenEndpoint = 'https://oauth2.googleapis.com/token';
  private userInfoEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';

  constructor(config: OAuthConfig) {
    const defaultScope = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    super(
      {
        ...config,
        scope: config.scope || defaultScope,
      },
      'Google'
    );
  }

  getAuthorizationUrl(options?: AuthorizationUrlOptions): string {
    const state = options?.state || this.generateState();
    const { codeChallenge, codeChallengeMethod } = options || {};

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope?.join(' ') || '',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    // Add PKCE if provided
    if (codeChallenge && codeChallengeMethod) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', codeChallengeMethod);
    }

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, codeVerifier?: string): Promise<string> {
    const params = new URLSearchParams({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    return data.access_token;
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(`${this.userInfoEndpoint}?access_token=${accessToken}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.email) {
      throw new Error('No email in user profile');
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      avatar: data.picture,
      provider: 'google',
      metadata: {
        verified_email: data.verified_email,
        locale: data.locale,
      },
    };
  }
}

/**
 * Microsoft OAuth2 Provider
 */
export class MicrosoftSSOProvider extends SSOProvider {
  private authorizationEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  private tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  private userInfoEndpoint = 'https://graph.microsoft.com/v1.0/me';

  constructor(config: OAuthConfig) {
    const defaultScope = [
      'User.Read',
      'email',
      'profile',
      'openid',
    ];

    super(
      {
        ...config,
        scope: config.scope || defaultScope,
      },
      'Microsoft'
    );
  }

  getAuthorizationUrl(options?: AuthorizationUrlOptions): string {
    const state = options?.state || this.generateState();
    const { codeChallenge, codeChallengeMethod } = options || {};

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope?.join(' ') || '',
      state,
      response_mode: 'query',
    });

    // Add PKCE if provided
    if (codeChallenge && codeChallengeMethod) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', codeChallengeMethod);
    }

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, codeVerifier?: string): Promise<string> {
    const params = new URLSearchParams({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    return data.access_token;
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(this.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.userPrincipalName && !data.mail) {
      throw new Error('No email in user profile');
    }

    const email = data.mail || data.userPrincipalName;

    return {
      id: data.id,
      email,
      name: data.displayName || email.split('@')[0],
      avatar: undefined, // Microsoft Graph doesn't provide avatar URL directly
      provider: 'microsoft',
      metadata: {
        jobTitle: data.jobTitle,
        officeLocation: data.officeLocation,
        mobilePhone: data.mobilePhone,
      },
    };
  }
}

/**
 * Generic OIDC Provider
 */
export class GenericOIDCProvider extends SSOProvider {
  private authorizationEndpoint: string;
  private tokenEndpoint: string;
  private userInfoEndpoint: string;

  constructor(
    config: OAuthConfig & {
      authorizationEndpoint: string;
      tokenEndpoint: string;
      userInfoEndpoint: string;
    },
    providerName: string = 'OIDC'
  ) {
    super(config, providerName);
    this.authorizationEndpoint = config.authorizationEndpoint;
    this.tokenEndpoint = config.tokenEndpoint;
    this.userInfoEndpoint = config.userInfoEndpoint;
  }

  getAuthorizationUrl(options?: AuthorizationUrlOptions): string {
    const state = options?.state || this.generateState();
    const { codeChallenge, codeChallengeMethod } = options || {};

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope?.join(' ') || 'openid profile email',
      state,
    });

    if (codeChallenge && codeChallengeMethod) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', codeChallengeMethod);
    }

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, codeVerifier?: string): Promise<string> {
    const params = new URLSearchParams({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    return data.access_token;
  }

  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(this.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.email && !data.preferred_username) {
      throw new Error('No email in user profile');
    }

    const email = data.email || data.preferred_username;

    return {
      id: data.sub || data.id,
      email,
      name: data.name || email.split('@')[0],
      avatar: data.picture,
      provider: this.provider,
      metadata: data,
    };
  }
}

/**
 * SSO Provider Factory
 */
export class SSOProviderFactory {
  private providers: Map<string, SSOProvider> = new Map();

  /**
   * Register a provider
   */
  registerProvider(name: string, provider: SSOProvider): void {
    this.providers.set(name.toLowerCase(), provider);
  }

  /**
   * Get a registered provider
   */
  getProvider(name: string): SSOProvider | null {
    return this.providers.get(name.toLowerCase()) || null;
  }

  /**
   * Create and register Google provider
   */
  createGoogleProvider(config: OAuthConfig): GoogleSSOProvider {
    const provider = new GoogleSSOProvider(config);
    this.registerProvider('google', provider);
    return provider;
  }

  /**
   * Create and register Microsoft provider
   */
  createMicrosoftProvider(config: OAuthConfig): MicrosoftSSOProvider {
    const provider = new MicrosoftSSOProvider(config);
    this.registerProvider('microsoft', provider);
    return provider;
  }

  /**
   * Create and register generic OIDC provider
   */
  createOIDCProvider(
    name: string,
    config: OAuthConfig & {
      authorizationEndpoint: string;
      tokenEndpoint: string;
      userInfoEndpoint: string;
    }
  ): GenericOIDCProvider {
    const provider = new GenericOIDCProvider(config, name);
    this.registerProvider(name, provider);
    return provider;
  }

  /**
   * List all registered providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear();
  }
}

// Singleton instance
let factoryInstance: SSOProviderFactory | null = null;

/**
 * Get or create SSO provider factory
 */
export function getSSOProviderFactory(): SSOProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new SSOProviderFactory();
  }
  return factoryInstance;
}

/**
 * Reset factory instance (for testing)
 */
export function resetSSOProviderFactory(): void {
  factoryInstance = null;
}
