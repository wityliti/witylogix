/**
 * Authentication Provider Types — Unified interfaces for multi-provider SSO.
 *
 * This module defines the contract for all authentication providers (Auth0, Cognito, Clerk, etc.)
 * and the types for authentication results, provider capabilities, and configuration.
 *
 * Key principles:
 * - Providers normalize external identities to Witylogix roles (SUPER_ADMIN, ADMIN, DISPATCHER, VIEWER, DRIVER)
 * - Tokens (access + refresh) are always encrypted in storage
 * - Provider config is stored encrypted in AuthProvider.config (JSON)
 * - Each provider reports capabilities (SAML vs OIDC, MFA support, etc.)
 * - JIT (Just-In-Time) provisioning auto-creates users on first external auth
 */

// ─── PROVIDER TYPE ENUM ──────────────────────────────────────

/** Supported authentication provider types. */
export type AuthProviderType =
  | "auth0"
  | "clerk"
  | "cognito"
  | "firebase_auth"
  | "okta"
  | "generic_oidc"
  | "saml"
  | "local";

// ─── WITYLOGIX ROLES ────────────────────────────────────────

/** Witylogix role hierarchy — all providers map to these. */
export type WitylogixRole =
  | "SUPER_ADMIN" // Platform-level admin (deployer)
  | "ADMIN" // Shop/org admin (can manage all users, settings)
  | "DISPATCHER" // Can assign routes, manage drivers, view analytics
  | "VIEWER" // Read-only access (dashboards, reports)
  | "DRIVER"; // Driver app user (limited permissions, location sharing)

// ─── AUTHENTICATION RESULT ──────────────────────────────────

/**
 * Result of successful authentication with an external provider.
 * Returned from provider's authenticate() or handleCallback() methods.
 */
export interface AuthResult {
  /** External provider's user ID (e.g., "auth0|123456", "cognito|user-123"). */
  externalUserId: string;

  /** User's email address (primary identifier for user linking). */
  email: string;

  /** User's display name from provider. */
  name?: string;

  /** Avatar/profile picture URL from provider. */
  picture?: string;

  /** Witylogix roles mapped from provider roles (via role_mapping config). */
  roles: WitylogixRole[];

  /** Access token (JWT or bearer) — will be stored encrypted. */
  accessToken: string;

  /** Refresh token (if provider supports token refresh). */
  refreshToken?: string;

  /** When access token expires (ISO 8601 or Unix timestamp). */
  expiresAt?: Date | number;

  /** Provider-specific metadata (Auth0 identities, Cognito groups, etc.). */
  metadata?: Record<string, unknown>;

  /** Whether MFA was satisfied in this login. */
  mfaVerified?: boolean;

  /** MFA requirement status. */
  mfaRequired?: boolean;
}

// ─── PROVIDER CAPABILITIES ──────────────────────────────────

/**
 * Declares what features a provider supports.
 * Used by Settings UI to warn about limitations and by auth logic to enforce policies.
 */
export interface AuthProviderCapabilities {
  /** Provider supports SSO flow (OIDC, SAML, etc.). */
  supportsSSO: boolean;

  /** Provider enforces Multi-Factor Authentication. */
  supportsMFA: boolean;

  /** Provider can provide user roles/groups. */
  supportsRoles: boolean;

  /** Provider supports SAML 2.0 (vs OIDC). */
  supportsSAML: boolean;

  /** Provider supports OpenID Connect (vs SAML). */
  supportsOIDC: boolean;

  /** Provider supports Just-In-Time user provisioning. */
  supportsJIT: boolean;

  /** Provider supports token refresh without user interaction. */
  supportsTokenRefresh: boolean;

  /** Provider supports logout/session revocation. */
  supportsLogout: boolean;

  /** Provider can sync user profile (name, picture, etc.). */
  supportsProfileSync: boolean;
}

// ─── PROVIDER CONFIGURATION ────────────────────────────────

/**
 * Base configuration shape — every provider's config includes these.
 */
export interface BaseAuthProviderConfig {
  /** Role mapping from provider's role format to Witylogix roles. */
  roleMapping?: Record<string, WitylogixRole>;

  /** Default role for JIT-provisioned users if no mapping matches. */
  defaultRole?: WitylogixRole;

  /** Whether to auto-create users on first SSO login (JIT). */
  autoProvisionUsers?: boolean;

  /** Whether to update user profile on each login. */
  syncProfileOnLogin?: boolean;
}

/** Auth0-specific configuration. */
export interface Auth0Config extends BaseAuthProviderConfig {
  /** Auth0 tenant domain (e.g., "company.auth0.com"). */
  domain: string;

  /** OAuth 2.0 Client ID. */
  clientId: string;

  /** OAuth 2.0 Client Secret. */
  clientSecret: string;

  /** Optional: API audience for access token (e.g., "https://api.witylogix.com"). */
  audience?: string;

  /** Claim in Auth0 ID token that contains roles (default: "roles"). */
  rolesClaim?: string;

  /** Whether to use the "https://domain/authorize" endpoint. */
  useCustomDomain?: boolean;
}

/** Clerk-specific configuration. */
export interface ClerkConfig extends BaseAuthProviderConfig {
  /** Clerk Secret Key (begins with "sk_"). */
  secretKey: string;

  /** Clerk Publishable Key (begins with "pk_"). */
  publishableKey: string;

  /** Optional: Clerk's frontend API URL for custom domains. */
  frontendApi?: string;
}

/** AWS Cognito configuration. */
export interface CognitoConfig extends BaseAuthProviderConfig {
  /** AWS Cognito User Pool ID (e.g., "us-east-1_xxxxx"). */
  userPoolId: string;

  /** AWS region (e.g., "us-east-1"). */
  region: string;

  /** OAuth 2.0 Client ID (from App Client settings). */
  clientId: string;

  /** OAuth 2.0 Client Secret (if enabled). */
  clientSecret?: string;

  /** Claim that contains user groups (default: "cognito:groups"). */
  groupsClaim?: string;
}

/** Firebase Authentication configuration. */
export interface FirebaseAuthConfig extends BaseAuthProviderConfig {
  /** Firebase project ID. */
  projectId: string;

  /** Firebase API Key (Web SDK key). */
  apiKey: string;

  /** Firebase Auth domain. */
  authDomain: string;

  /** Whether to use Firestore for custom claims (used for roles). */
  useCustomClaims?: boolean;
}

/** Okta-specific configuration. */
export interface OktaConfig extends BaseAuthProviderConfig {
  /** Okta org domain (e.g., "company.okta.com"). */
  domain: string;

  /** OAuth 2.0 Client ID. */
  clientId: string;

  /** OAuth 2.0 Client Secret. */
  clientSecret: string;

  /** Optional: Custom authorization server ID. */
  authorizationServerId?: string;

  /** Claim in access token that contains roles (default: "groups"). */
  rolesClaim?: string;
}

/** Generic OpenID Connect configuration. */
export interface GenericOIDCConfig extends BaseAuthProviderConfig {
  /** OIDC issuer URL (e.g., "https://keycloak.example.com/auth/realms/myrealm"). */
  issuer: string;

  /** OAuth 2.0 Client ID. */
  clientId: string;

  /** OAuth 2.0 Client Secret. */
  clientSecret: string;

  /** Optional: .well-known/openid-configuration discovery URL (auto-discovered if not provided). */
  discoveryUrl?: string;

  /** OAuth 2.0 scopes (default: "openid profile email"). */
  scope?: string;

  /** Claim that contains roles (default: "roles"). */
  rolesClaim?: string;
}

/** SAML 2.0 Service Provider configuration. */
export interface SAMLConfig extends BaseAuthProviderConfig {
  /** Identity Provider's single sign-on entry point URL. */
  entryPoint: string;

  /** Service Provider identifier (usually the app's URL). */
  issuer: string;

  /** Certificate for validating IdP assertions (PEM format). */
  cert: string;

  /** Optional: Service Provider's private key for signing (PEM format). */
  privateKey?: string;

  /** Optional: Assertion callback URL (relative to app origin). */
  callbackUrl?: string;

  /** Claim in SAML assertion that contains user roles (default: "Role"). */
  roleAttribute?: string;

  /** Whether to require signed assertions (default: true). */
  wantAssertionSigned?: boolean;
}

/** Local authentication configuration (email + password). */
export interface LocalConfig extends BaseAuthProviderConfig {
  // No credentials needed for local auth
}

/** Union type of all provider configs. */
export type AuthProviderConfig =
  | Auth0Config
  | ClerkConfig
  | CognitoConfig
  | FirebaseAuthConfig
  | OktaConfig
  | GenericOIDCConfig
  | SAMLConfig
  | LocalConfig;

// ─── BASE PROVIDER INTERFACE ────────────────────────────────

/**
 * Abstract interface that all authentication providers must implement.
 * Each provider (Auth0Provider, ClerkProvider, etc.) extends this.
 */
export interface BaseAuthProvider {
  /** Provider type identifier (e.g., "auth0"). */
  readonly type: AuthProviderType;

  /** Human-readable provider name (e.g., "Auth0"). */
  readonly name: string;

  /** Provider capabilities (SSO, MFA, SAML, etc.). */
  readonly capabilities: AuthProviderCapabilities;

  /** Configuration object for this provider. */
  readonly config: AuthProviderConfig;

  /**
   * Authenticate a user with username/password or return authorization URL for SSO.
   *
   * For local auth: verifies password, returns AuthResult.
   * For OIDC/SAML: returns authorization URL + state token; client redirects to IdP.
   *
   * @param request Authentication request (varies by provider type)
   * @returns AuthResult for local; AuthorizationUrl for OIDC/SAML
   */
  authenticate(request: AuthenticationRequest): Promise<AuthResult | AuthorizationUrl>;

  /**
   * Handle OAuth 2.0/SAML callback after user authenticates with IdP.
   *
   * Validates callback code/assertion, exchanges for tokens, fetches user info.
   *
   * @param callbackData Code, state, assertion, or other IdP callback data
   * @returns Normalized AuthResult
   */
  handleCallback(callbackData: CallbackData): Promise<AuthResult>;

  /**
   * Validate an access token without refreshing it.
   *
   * Used to check if a stored access token is still valid.
   * Returns decoded token payload or throws UnauthorizedError.
   *
   * @param accessToken Token to validate
   * @returns Decoded token payload
   */
  validateToken(accessToken: string): Promise<Record<string, unknown>>;

  /**
   * Refresh an access token using a refresh token.
   *
   * Not all providers support refresh tokens (e.g., SAML).
   * Throws UnauthorizedError if refresh fails.
   *
   * @param refreshToken Refresh token (encrypted in database)
   * @returns New AuthResult with refreshed access token
   */
  refreshSession(refreshToken: string): Promise<AuthResult>;

  /**
   * Revoke an access/refresh token (logout).
   *
   * Some providers don't support revocation (idempotent — no error thrown).
   * Fires revocation requests to provider's revocation endpoint.
   *
   * @param accessToken Token to revoke
   * @param refreshToken Optional refresh token to revoke
   */
  revokeSession(accessToken: string, refreshToken?: string): Promise<void>;

  /**
   * Fetch fresh user information from the provider.
   *
   * Used for profile sync on each login or periodic refresh.
   * Returns user's email, name, picture, and roles from provider.
   *
   * @param accessToken Access token to authorize the request
   * @returns User information
   */
  getUserInfo(accessToken: string): Promise<UserInfo>;

  /**
   * Get authorization URL for OIDC/SAML SSO flow (idempotent).
   *
   * Generates login URL + state token. Client redirects to IdP.
   * For local auth, this throws NotImplementedError.
   *
   * @param redirectUri Callback URL after IdP login
   * @param state Random state token (for CSRF protection)
   * @returns Authorization URL + state
   */
  getAuthorizationUrl(redirectUri: string, state: string): Promise<AuthorizationUrl>;

  /**
   * Validate provider configuration (credentials, connectivity, etc.).
   *
   * Called when provider is configured in Settings.
   * Makes a test API call or checks configuration format.
   * Throws error with details if validation fails.
   *
   * @throws ProviderError with validation details
   */
  validateConfiguration(): Promise<void>;

  /**
   * Get provider health status (connectivity, quota, errors).
   *
   * Used for health dashboards and fallback logic.
   *
   * @returns Health status
   */
  getHealthStatus(): Promise<ProviderHealthStatus>;
}

// ─── REQUEST/RESPONSE TYPES ────────────────────────────────

/**
 * Authentication request — varies by provider type.
 */
export interface AuthenticationRequest {
  /** For local: email address. For OIDC/SAML: omitted or used for pre-fill. */
  email?: string;

  /** For local: password. For OIDC/SAML: omitted. */
  password?: string;

  /** For OIDC/SAML: redirect URI after login. */
  redirectUri?: string;

  /** For OIDC/SAML: random state token (CSRF protection). */
  state?: string;
}

/**
 * Result of calling getAuthorizationUrl().
 * Sent to client; client redirects to authorizationUrl.
 */
export interface AuthorizationUrl {
  /** URL to redirect user to (IdP login page). */
  url: string;

  /** State token for CSRF protection (must match callback). */
  state: string;

  /** PKCE code verifier for additional security (optional). */
  codeVerifier?: string;
}

/**
 * IdP callback data — varies by provider type.
 */
export interface CallbackData {
  /** Authorization code (OIDC, OAuth 2.0). */
  code?: string;

  /** State token from authorization request (CSRF check). */
  state?: string;

  /** SAML 2.0 Assertion (XML string). */
  assertion?: string;

  /** SAML 2.0 RelayState parameter. */
  relayState?: string;

  /** PKCE code verifier (if used). */
  codeVerifier?: string;

  /** OIDC/OAuth error (if user denies consent). */
  error?: string;

  /** Error description. */
  errorDescription?: string;
}

/**
 * User information fetched from provider.
 */
export interface UserInfo {
  /** External user ID from provider. */
  externalUserId: string;

  /** Email address. */
  email: string;

  /** Display name. */
  name?: string;

  /** Avatar URL. */
  picture?: string;

  /** User roles/groups from provider. */
  roles: string[];

  /** Email verified status. */
  emailVerified?: boolean;

  /** Metadata from provider (groups, custom claims, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Provider health status for monitoring dashboards.
 */
export interface ProviderHealthStatus {
  /** Provider is operational. */
  healthy: boolean;

  /** API response latency in milliseconds. */
  latency?: number;

  /** Remaining quota (e.g., API calls per month). */
  quotaRemaining?: number;

  /** Last error from health check. */
  lastError?: string;

  /** Timestamp of last successful health check. */
  lastCheckedAt?: Date;
}

// ─── ERROR TYPES ────────────────────────────────────────────

/**
 * Base error class for authentication failures.
 */
export class AuthProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public provider: AuthProviderType,
    public statusCode: number = 500,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "AuthProviderError";
  }
}

/**
 * Invalid credentials (email + password mismatch).
 */
export class InvalidCredentialsError extends AuthProviderError {
  constructor(provider: AuthProviderType, message = "Invalid email or password") {
    super("INVALID_CREDENTIALS", message, provider, 401, false);
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Token expired or invalid.
 */
export class TokenExpiredError extends AuthProviderError {
  constructor(provider: AuthProviderType, message = "Token has expired") {
    super("TOKEN_EXPIRED", message, provider, 401, false);
    this.name = "TokenExpiredError";
  }
}

/**
 * Provider credentials not configured.
 */
export class ProviderNotConfiguredError extends AuthProviderError {
  constructor(provider: AuthProviderType) {
    super(
      "PROVIDER_NOT_CONFIGURED",
      `Provider ${provider} is not configured`,
      provider,
      503,
      false,
    );
    this.name = "ProviderNotConfiguredError";
  }
}

/**
 * Provider API is unavailable.
 */
export class ProviderUnavailableError extends AuthProviderError {
  constructor(provider: AuthProviderType, message: string) {
    super("PROVIDER_UNAVAILABLE", message, provider, 503, true);
    this.name = "ProviderUnavailableError";
  }
}

/**
 * Configuration validation failed.
 */
export class ConfigurationError extends AuthProviderError {
  constructor(provider: AuthProviderType, message: string) {
    super("CONFIGURATION_ERROR", message, provider, 400, false);
    this.name = "ConfigurationError";
  }
}

// ─── SPRINT 6.0: AUTH ARCHITECTURE TYPES ────────────────────

/**
 * JWT Access Token Payload.
 * Embedded in access tokens with 15-minute expiry.
 */
export interface AccessTokenPayload {
  /** User ID from database */
  userId: string;
  /** Organization ID (multi-tenant context) */
  orgId: string;
  /** Shop ID (primary shop context) */
  shopId: string;
  /** User's role in the org (OWNER, ADMIN, MEMBER, VIEWER) */
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  /** Granted permissions as array (e.g., ["shipments:read", "routes:write"]) */
  permissions: string[];
  /** Whether MFA was verified in this session */
  mfaVerified: boolean;
  /** Standard JWT claims */
  iat: number; // Issued at
  exp: number; // Expiration (15 minutes from iat)
  sub: string; // Subject (same as userId)
  aud: string; // Audience ("witylogix-api")
  iss: string; // Issuer ("witylogix")
}

/**
 * JWT Refresh Token Payload.
 * Embedded in refresh tokens with 7-day expiry.
 * Used to obtain new access tokens without user interaction.
 */
export interface RefreshTokenPayload {
  /** User ID */
  userId: string;
  /** Organization ID */
  orgId: string;
  /** Session ID (for revocation tracking) */
  sessionId: string;
  /** Refresh token version (for rotation) */
  version: number;
  /** Standard JWT claims */
  iat: number;
  exp: number; // Expiration (7 days from iat)
  sub: string;
  aud: string;
  iss: string;
}

/**
 * Result of JWT token verification.
 */
export interface TokenVerificationResult {
  valid: boolean;
  payload?: AccessTokenPayload | RefreshTokenPayload;
  error?: string;
}

/**
 * MFA Challenge initiated by server.
 * Client must respond with OTP/TOTP code.
 */
export interface MfaChallenge {
  challengeId: string;
  userId: string;
  type: MfaType;
  expiresAt: Date;
  method: "TOTP" | "SMS" | "EMAIL"; // Delivery method
  maskedPhone?: string; // e.g., "+1****5678" for SMS
  maskedEmail?: string; // e.g., "u***@example.com" for EMAIL
}

/**
 * MFA verification request (client sends OTP/TOTP).
 */
export interface MfaVerificationRequest {
  challengeId: string;
  code: string; // 6-digit OTP or 6-digit TOTP
  deviceId?: string; // Optional device fingerprint
  rememberDevice?: boolean; // Trust this device for 30 days
}

/**
 * Result of MFA verification.
 */
export interface MfaVerificationResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

/**
 * Complete authenticated user with session info.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  shopId: string;
  orgId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "SUPER_ADMIN";
  permissions: string[];
  mfaEnabled: boolean;
  mfaVerified: boolean;
  lastLogin?: Date;
}

/**
 * Session information returned to client.
 */
export interface AuthSession {
  sessionId: string;
  userId: string;
  orgId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  mfaVerified: boolean;
  mfaRequired?: boolean;
  user: AuthUser;
}

/**
 * MFA Type enumeration.
 */
export enum MfaType {
  TOTP = "TOTP",
  SMS = "SMS",
  EMAIL = "EMAIL",
}

/**
 * Session status enumeration.
 */
export enum SessionStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED",
  MFA_PENDING = "MFA_PENDING",
}

/**
 * Login attempt result enumeration.
 */
export enum LoginAttemptResult {
  SUCCESS = "SUCCESS",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  USER_INACTIVE = "USER_INACTIVE",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  MFA_REQUIRED = "MFA_REQUIRED",
  TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS",
}

/**
 * Authentication provider enumeration.
 */
export enum AuthProvider {
  CREDENTIALS = "CREDENTIALS",
  GOOGLE = "GOOGLE",
  MICROSOFT = "MICROSOFT",
  MAGIC_LINK = "MAGIC_LINK",
}

/**
 * Permission interface for RBAC.
 */
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
}

/**
 * Role definition for RBAC.
 */
export interface Role {
  id: string;
  name: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  description?: string;
  permissions: Permission[];
}

/**
 * RBAC Policy definition.
 */
export interface RBACPolicy {
  userId: string;
  orgId: string;
  role: string;
  permissions: string[];
  resourceOwner?: boolean;
}

/**
 * Password strength scoring result.
 */
export interface PasswordStrengthResult {
  score: number; // 0-4 (0=very weak, 4=very strong)
  feedback: string[];
  suggestions: string[];
}

/**
 * MFA backup codes result.
 */
export interface BackupCodesResult {
  codes: string[];
  used: number[];
}

/**
 * Error class for authentication failures.
 */
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Invalid credentials error.
 */
export class InvalidCredentialsError extends AuthError {
  constructor(message = "Invalid email or password") {
    super("INVALID_CREDENTIALS", message, 401);
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Token expired error.
 */
export class TokenExpiredError extends AuthError {
  constructor(message = "Token has expired") {
    super("TOKEN_EXPIRED", message, 401);
    this.name = "TokenExpiredError";
  }
}

/**
 * MFA required error.
 */
export class MfaRequiredError extends AuthError {
  constructor(public challengeId: string, message = "MFA verification required") {
    super("MFA_REQUIRED", message, 403);
    this.name = "MfaRequiredError";
  }
}

/**
 * Permission denied error.
 */
export class PermissionDeniedError extends AuthError {
  constructor(public resource: string, public action: string) {
    super("PERMISSION_DENIED", `Not permitted to ${action} ${resource}`, 403);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Session invalid error.
 */
export class SessionInvalidError extends AuthError {
  constructor(message = "Session is invalid or expired") {
    super("SESSION_INVALID", message, 401);
    this.name = "SessionInvalidError";
  }
}

/**
 * Rate limit exceeded error.
 */
export class RateLimitError extends AuthError {
  constructor(
    public retryAfterSeconds: number,
    message = `Too many attempts. Try again in ${retryAfterSeconds} seconds`,
  ) {
    super("RATE_LIMIT_EXCEEDED", message, 429);
    this.name = "RateLimitError";
  }
}
