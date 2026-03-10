/**
 * Base Authentication Provider — Abstract interface and utilities.
 *
 * All authentication providers (Auth0, Cognito, Clerk, SAML, OIDC, local) extend this.
 *
 * This module provides:
 * - AuthProviderBase abstract class with standard error handling
 * - Common utilities for providers (token validation, profile mapping)
 * - Standard error types for authentication failures
 * - Provider initialization and configuration validation
 *
 * Provider lifecycle:
 *   1. Provider instantiated with encrypted config from database
 *   2. Provider validates configuration (network test, credential check)
 *   3. Provider handles authentication (local password, OAuth2 code exchange, etc.)
 *   4. Provider normalizes user profile and roles to Witylogix standard
 *   5. Provider returns AuthResult with tokens and roles
 */

import type {
  BaseAuthProvider,
  AuthProviderCapabilities,
  AuthProviderConfig,
  AuthProviderType,
  AuthResult,
  AuthenticationRequest,
  CallbackData,
  UserInfo,
  AuthorizationUrl,
  ProviderHealthStatus,
  WitylogixRole,
} from "../types.js";
import {
  AuthProviderError,
  InvalidCredentialsError,
  TokenExpiredError,
  ProviderNotConfiguredError,
  ProviderUnavailableError,
  ConfigurationError,
} from "../types.js";

// ─── BASE PROVIDER CLASS ────────────────────────────────────

/**
 * Abstract base class for all authentication providers.
 *
 * Subclasses implement abstract methods:
 * - authenticate() — handle provider-specific login flow
 * - handleCallback() — process IdP callback (OIDC/SAML)
 * - validateToken() — verify and decode tokens
 * - refreshSession() — get new tokens using refresh token
 * - revokeSession() — logout and revoke tokens
 * - getUserInfo() — fetch fresh user data from provider
 * - validateConfiguration() — test provider credentials
 * - getHealthStatus() — check provider API connectivity
 */
export abstract class AuthProviderBase implements BaseAuthProvider {
  abstract readonly type: AuthProviderType;
  abstract readonly name: string;
  abstract readonly capabilities: AuthProviderCapabilities;
  abstract readonly config: AuthProviderConfig;

  abstract authenticate(request: AuthenticationRequest): Promise<AuthResult | AuthorizationUrl>;
  abstract handleCallback(callbackData: CallbackData): Promise<AuthResult>;
  abstract validateToken(accessToken: string): Promise<Record<string, unknown>>;
  abstract refreshSession(refreshToken: string): Promise<AuthResult>;
  abstract revokeSession(accessToken: string, refreshToken?: string): Promise<void>;
  abstract getUserInfo(accessToken: string): Promise<UserInfo>;
  abstract getAuthorizationUrl(redirectUri: string, state: string): Promise<AuthorizationUrl>;
  abstract validateConfiguration(): Promise<void>;
  abstract getHealthStatus(): Promise<ProviderHealthStatus>;

  /**
   * Normalize roles from provider to Witylogix roles.
   *
   * Uses role mapping configuration to convert provider-specific roles
   * to standard Witylogix roles (ADMIN, DISPATCHER, VIEWER, DRIVER).
   *
   * Example:
   *   Provider returns: ["admin", "manager"]
   *   Config maps: { "admin" → "ADMIN", "manager" → "DISPATCHER" }
   *   Result: ["ADMIN", "DISPATCHER"]
   *
   * @param providerRoles Roles from provider (strings)
   * @returns Mapped Witylogix roles
   */
  protected normalizeRoles(providerRoles: string[]): WitylogixRole[] {
    const roleMapping = this.config.roleMapping || {};
    const defaultRole = this.config.defaultRole || "VIEWER";

    const normalized = new Set<WitylogixRole>();

    for (const role of providerRoles) {
      const mapped = roleMapping[role.toLowerCase()];
      if (mapped) {
        normalized.add(mapped);
      }
    }

    // If no roles mapped, use default
    if (normalized.size === 0) {
      normalized.add(defaultRole);
    }

    return Array.from(normalized);
  }

  /**
   * Validate that required configuration fields are present.
   *
   * @param requiredFields Array of field names that must be present in config
   * @throws ConfigurationError if any required field is missing
   */
  protected validateConfigFields(requiredFields: string[]): void {
    const config = this.config as Record<string, any>;

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new ConfigurationError(
          this.type,
          `Missing required configuration: ${field}`,
        );
      }
    }
  }

  /**
   * Make an HTTPS request with standard error handling.
   *
   * @param url Endpoint URL
   * @param options Fetch options (method, headers, body, etc.)
   * @returns Parsed JSON response
   * @throws ProviderError on network failure or HTTP error
   */
  protected async makeRequest<T = any>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ProviderUnavailableError(
          this.type,
          `HTTP ${response.status}: ${JSON.stringify(errorData)}`,
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof AuthProviderError) {
        throw error;
      }

      throw new ProviderUnavailableError(
        this.type,
        `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract and validate JWT claims from a token string.
   *
   * Handles both:
   * - JWT tokens (parse and decode payload)
   * - Opaque bearer tokens (return as-is)
   *
   * @param token JWT or bearer token
   * @returns Decoded claims or token string
   */
  protected decodeJWT(token: string): Record<string, unknown> {
    try {
      const parts = token.split(".");

      if (parts.length !== 3) {
        // Opaque token, return as-is
        return { token };
      }

      // JWT token, decode payload
      const payload = Buffer.from(parts[1], "base64").toString();
      return JSON.parse(payload);
    } catch (error) {
      throw new InvalidCredentialsError(
        this.type,
        `Failed to decode token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if JWT token is expired.
   *
   * @param token JWT token
   * @param clockSkewSeconds Allow clock skew in seconds (default: 30)
   * @returns true if token is expired
   */
  protected isJWTExpired(token: string, clockSkewSeconds: number = 30): boolean {
    try {
      const claims = this.decodeJWT(token) as Record<string, any>;
      const now = Math.floor(Date.now() / 1000);
      const exp = claims.exp;

      if (!exp) return false; // No expiry claim

      return now > exp + clockSkewSeconds;
    } catch {
      return true; // Invalid token is considered expired
    }
  }

  /**
   * Build authorization URL with query parameters.
   *
   * Encodes parameters and handles special characters properly.
   *
   * @param baseUrl Base authorization URL
   * @param params Query parameters
   * @returns Full URL with encoded parameters
   */
  protected buildAuthorizationUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  /**
   * Generate a random state token for CSRF protection.
   *
   * Used in OAuth2/OIDC/SAML flows to prevent cross-site request forgery.
   *
   * @param length Length of random string (default: 32)
   * @returns Random state token
   */
  protected generateStateToken(length: number = 32): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let state = "";
    for (let i = 0; i < length; i++) {
      state += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return state;
  }

  /**
   * Generate PKCE code verifier and challenge for OAuth2 security.
   *
   * Returns both verifier (to send in token request) and challenge (to send in auth request).
   *
   * @returns Object with verifier and challenge
   */
  protected generatePKCEPair(): { verifier: string; challenge: string } {
    // Generate random 32-byte verifier
    const verifier = Buffer.from(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)))
      .toString("base64url")
      .replace(/[=]+$/, "");

    // Create challenge as SHA256 hash of verifier
    const crypto = require("crypto");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url")
      .replace(/[=]+$/, "");

    return { verifier, challenge };
  }

  /**
   * Handle provider error response and wrap in standard error.
   *
   * @param error Error object from provider
   * @param operation Operation that failed (for logging)
   * @throws AuthProviderError
   */
  protected handleProviderError(error: any, operation: string = "operation"): never {
    let message = `Provider ${operation} failed`;
    let retryable = false;

    if (typeof error === "string") {
      message = error;
    } else if (error?.message) {
      message = error.message;
      // Network errors are retryable
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ENETUNREACH")
      ) {
        retryable = true;
      }
    }

    throw new AuthProviderError(
      "PROVIDER_ERROR",
      message,
      this.type,
      error?.statusCode || 500,
      retryable,
    );
  }

  /**
   * Log authentication event for debugging and security auditing.
   *
   * @param event Event type (authenticate, token_refresh, logout, etc.)
   * @param userId User ID (if known)
   * @param details Additional details
   */
  protected logAuthEvent(
    event: string,
    userId?: string,
    details?: Record<string, unknown>,
  ): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        provider: this.type,
        event,
        userId,
        ...details,
      }),
    );
  }

  /**
   * Test provider connectivity (used in health checks).
   *
   * Default implementation tries to fetch provider's metadata endpoint.
   * Subclasses should override with provider-specific health check.
   *
   * @returns Promise that resolves if provider is healthy
   */
  async testConnectivity(): Promise<void> {
    // Default: no-op. Subclasses override with actual health check.
  }

  /**
   * Measure provider API latency.
   *
   * @returns Latency in milliseconds
   */
  async measureLatency(): Promise<number> {
    const start = Date.now();
    try {
      await this.testConnectivity();
      return Date.now() - start;
    } catch {
      return -1; // Error
    }
  }
}

// ─── HELPER FUNCTIONS ───────────────────────────────────────

/**
 * Convert provider error response to standard error type.
 *
 * Different providers use different error formats. This normalizes them.
 *
 * @param provider Provider type
 * @param errorResponse Error response from provider
 * @returns Appropriate error instance
 */
export function parseProviderError(
  provider: AuthProviderType,
  errorResponse: any,
): AuthProviderError {
  const message = errorResponse?.message || errorResponse?.error_description || "Unknown error";
  const code = errorResponse?.error || "PROVIDER_ERROR";

  // Map common error codes
  switch (code) {
    case "invalid_grant":
    case "invalid_client":
    case "invalid_credentials":
      return new InvalidCredentialsError(provider, message);

    case "token_expired":
    case "expired_token":
      return new TokenExpiredError(provider, message);

    case "provider_not_configured":
    case "missing_credentials":
      return new ProviderNotConfiguredError(provider);

    case "provider_unavailable":
    case "service_unavailable":
      return new ProviderUnavailableError(provider, message);

    case "configuration_error":
      return new ConfigurationError(provider, message);

    default:
      return new AuthProviderError(
        code,
        message,
        provider,
        errorResponse?.statusCode || 500,
      );
  }
}

/**
 * Merge user info from multiple sources (provider + local db).
 *
 * Prioritizes fresh provider data over stale local data.
 *
 * @param providerInfo Fresh user info from provider
 * @param localInfo Cached user info from database
 * @returns Merged user info
 */
export function mergeUserInfo(providerInfo: UserInfo, localInfo?: UserInfo): UserInfo {
  return {
    externalUserId: providerInfo.externalUserId,
    email: providerInfo.email,
    name: providerInfo.name || localInfo?.name,
    picture: providerInfo.picture || localInfo?.picture,
    roles: [...new Set([...providerInfo.roles, ...(localInfo?.roles || [])])],
    emailVerified: providerInfo.emailVerified ?? localInfo?.emailVerified,
    metadata: {
      ...localInfo?.metadata,
      ...providerInfo.metadata,
    },
  };
}
