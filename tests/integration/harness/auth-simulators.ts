/**
 * Authentication Simulators for Integration Tests
 * Provides: API Key validation, OAuth2 server, Basic auth, Bearer tokens, JWT, HMAC
 * ~300 lines
 */

import { createHmac, randomBytes, createHash } from "crypto";

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface APIKeyValidatorConfig {
  headerName?: string;
  queryParamName?: string;
  validKeys: string[];
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenExpirySeconds?: number;
  refreshTokenExpirySeconds?: number;
}

export interface OAuth2Token {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface JWTConfig {
  algorithm: "RS256" | "HS256";
  expirySeconds?: number;
  secret?: string;
  privateKey?: string;
  publicKey?: string;
}

export interface JWTPayload {
  [key: string]: any;
  iat?: number;
  exp?: number;
}

// ───────────────────────────────────────────────────────────────────────────
// API KEY VALIDATOR
// ───────────────────────────────────────────────────────────────────────────

export class APIKeyValidator {
  private config: Required<APIKeyValidatorConfig>;

  constructor(config: APIKeyValidatorConfig) {
    this.config = {
      headerName: "x-api-key",
      queryParamName: "api_key",
      ...config,
    };
  }

  validateFromHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const value = headers[this.config.headerName.toLowerCase()];
    const key =
      typeof value === "string"
        ? value
        : Array.isArray(value)
          ? value[0]
          : undefined;
    return !!key && this.config.validKeys.includes(key);
  }

  validateFromQuery(query: Record<string, string | string[]>): boolean {
    const value = query[this.config.queryParamName];
    const key =
      typeof value === "string"
        ? value
        : Array.isArray(value)
          ? value[0]
          : undefined;
    return !!key && this.config.validKeys.includes(key);
  }

  validate(
    headers: Record<string, string | string[] | undefined>,
    query?: Record<string, string | string[]>,
  ): boolean {
    return (
      this.validateFromHeaders(headers) ||
      (query ? this.validateFromQuery(query) : false)
    );
  }

  addKey(key: string): void {
    if (!this.config.validKeys.includes(key)) {
      this.config.validKeys.push(key);
    }
  }

  removeKey(key: string): void {
    const idx = this.config.validKeys.indexOf(key);
    if (idx !== -1) {
      this.config.validKeys.splice(idx, 1);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// OAUTH2 SERVER
// ───────────────────────────────────────────────────────────────────────────

interface StoredAuthCode {
  code: string;
  clientId: string;
  expiresAt: number;
  redirectUri: string;
  scope?: string;
}

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  expiresAt: number;
  scope?: string;
}

export class OAuth2Server {
  private config: OAuth2Config;
  private authCodes: Map<string, StoredAuthCode> = new Map();
  private tokens: Map<string, StoredToken> = new Map();
  private refreshTokens: Map<string, string> = new Map();

  constructor(config: OAuth2Config) {
    this.config = {
      tokenExpirySeconds: 3600,
      refreshTokenExpirySeconds: 7 * 24 * 3600,
      ...config,
    };
  }

  /**
   * Generate authorization code for /authorize endpoint
   */
  generateAuthCode(redirectUri: string, scope?: string): string {
    const code = `code_${randomBytes(16).toString("hex")}`;
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.authCodes.set(code, {
      code,
      clientId: this.config.clientId,
      expiresAt,
      redirectUri,
      scope,
    });

    // Cleanup expired codes after 1 hour
    setTimeout(() => this.authCodes.delete(code), 60 * 60 * 1000);

    return code;
  }

  /**
   * Exchange authorization code for tokens (called at /token endpoint)
   */
  exchangeAuthCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): OAuth2Token | null {
    const stored = this.authCodes.get(code);

    if (
      !stored ||
      stored.clientId !== clientId ||
      stored.redirectUri !== redirectUri
    ) {
      return null;
    }

    if (stored.expiresAt < Date.now()) {
      this.authCodes.delete(code);
      return null;
    }

    if (clientSecret !== this.config.clientSecret) {
      return null;
    }

    // Generate tokens
    const accessToken = `access_${randomBytes(32).toString("hex")}`;
    const refreshToken = `refresh_${randomBytes(32).toString("hex")}`;
    const expiresAt = Date.now() + this.config.tokenExpirySeconds! * 1000;

    this.tokens.set(accessToken, {
      accessToken,
      refreshToken,
      clientId,
      expiresAt,
      scope: stored.scope,
    });

    this.refreshTokens.set(refreshToken, accessToken);

    // Cleanup code after use
    this.authCodes.delete(code);

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: this.config.tokenExpirySeconds!,
      refresh_token: refreshToken,
      scope: stored.scope,
    };
  }

  /**
   * Refresh an access token
   */
  refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): OAuth2Token | null {
    if (clientSecret !== this.config.clientSecret) {
      return null;
    }

    const oldAccessToken = this.refreshTokens.get(refreshToken);
    if (!oldAccessToken) {
      return null;
    }

    const stored = this.tokens.get(oldAccessToken);
    if (!stored || stored.clientId !== clientId) {
      return null;
    }

    // Generate new access token
    const newAccessToken = `access_${randomBytes(32).toString("hex")}`;
    const newRefreshToken = `refresh_${randomBytes(32).toString("hex")}`;
    const expiresAt = Date.now() + this.config.tokenExpirySeconds! * 1000;

    // Update mappings
    this.tokens.set(newAccessToken, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      clientId,
      expiresAt,
      scope: stored.scope,
    });

    this.refreshTokens.delete(refreshToken);
    this.refreshTokens.set(newRefreshToken, newAccessToken);
    this.tokens.delete(oldAccessToken);

    return {
      access_token: newAccessToken,
      token_type: "Bearer",
      expires_in: this.config.tokenExpirySeconds!,
      refresh_token: newRefreshToken,
      scope: stored.scope,
    };
  }

  /**
   * Revoke a token
   */
  revokeToken(token: string): boolean {
    if (this.tokens.has(token)) {
      const stored = this.tokens.get(token)!;
      if (stored.refreshToken) {
        this.refreshTokens.delete(stored.refreshToken);
      }
      this.tokens.delete(token);
      return true;
    }
    return false;
  }

  /**
   * Validate an access token
   */
  validateAccessToken(token: string): boolean {
    const stored = this.tokens.get(token);
    if (!stored) return false;
    if (stored.expiresAt < Date.now()) {
      this.tokens.delete(token);
      return false;
    }
    return true;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// BASIC AUTH VALIDATOR
// ───────────────────────────────────────────────────────────────────────────

export class BasicAuthValidator {
  private validCredentials: Map<string, string> = new Map();

  addCredential(username: string, password: string): void {
    this.validCredentials.set(username, password);
  }

  removeCredential(username: string): void {
    this.validCredentials.delete(username);
  }

  validateFromHeader(authHeader: string | undefined): boolean {
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return false;
    }

    try {
      const credentials = Buffer.from(authHeader.slice(6), "base64").toString(
        "utf-8",
      );
      const [username, password] = credentials.split(":");
      return this.validCredentials.get(username) === password;
    } catch {
      return false;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// BEARER TOKEN VALIDATOR
// ───────────────────────────────────────────────────────────────────────────

export class BearerTokenValidator {
  private validTokens: Set<string> = new Set();

  addToken(token: string): void {
    this.validTokens.add(token);
  }

  removeToken(token: string): void {
    this.validTokens.delete(token);
  }

  validateFromHeader(authHeader: string | undefined): boolean {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return false;
    }
    const token = authHeader.slice(7);
    return this.validTokens.has(token);
  }

  validate(token: string): boolean {
    return this.validTokens.has(token);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// JWT HANDLER
// ───────────────────────────────────────────────────────────────────────────

export class JWTHandler {
  private config: Required<JWTConfig>;

  constructor(config: JWTConfig) {
    this.config = {
      expirySeconds: 3600,
      ...config,
    };
  }

  /**
   * Sign a JWT token using HS256 only (simplified, no RS256 support)
   */
  sign(payload: JWTPayload): string {
    if (this.config.algorithm !== "HS256" || !this.config.secret) {
      throw new Error("Only HS256 with secret is supported");
    }

    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.config.expirySeconds,
      }),
    ).toString("base64url");

    const signature = createHmac("sha256", this.config.secret)
      .update(`${header}.${body}`)
      .digest("base64url");

    return `${header}.${body}.${signature}`;
  }

  /**
   * Verify a JWT token
   */
  verify(token: string): JWTPayload | null {
    if (this.config.algorithm !== "HS256" || !this.config.secret) {
      return null;
    }

    try {
      const [headerB64, bodyB64, signatureB64] = token.split(".");
      if (!headerB64 || !bodyB64 || !signatureB64) {
        return null;
      }

      // Verify signature
      const expectedSignature = createHmac("sha256", this.config.secret)
        .update(`${headerB64}.${bodyB64}`)
        .digest("base64url");

      if (signatureB64 !== expectedSignature) {
        return null;
      }

      // Parse payload
      const payload = JSON.parse(
        Buffer.from(bodyB64, "base64url").toString("utf-8"),
      );

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// HMAC SIGNATURE GENERATOR (for webhooks)
// ───────────────────────────────────────────────────────────────────────────

export class HMACSignatureGenerator {
  /**
   * Generate HMAC-SHA256 signature (used by Stripe, Shopify, etc.)
   */
  static generateStripeSignature(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  /**
   * Generate HMAC-SHA256 signature with timestamp (Shopify style)
   */
  static generateShopifySignature(payload: string, secret: string): string {
    return Buffer.from(
      createHmac("sha256", secret).update(payload, "utf8").digest("base64"),
    ).toString("base64");
  }

  /**
   * Generate HMAC-SHA1 signature (older providers)
   */
  static generateHMACSHA1(payload: string, secret: string): string {
    return createHmac("sha1", secret).update(payload).digest("hex");
  }

  /**
   * Verify HMAC-SHA256 signature
   */
  static verifyHMACSHA256(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return signature === expectedSignature;
  }
}
