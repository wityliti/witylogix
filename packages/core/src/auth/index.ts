/**
 * Authentication Module — Barrel exports for types, registry, and providers.
 *
 * This module provides:
 * - BaseAuthProvider interface (all providers implement this)
 * - AuthProviderRegistry (discovers and instantiates providers)
 * - Provider implementations (Auth0, Clerk, Cognito, Firebase, OIDC, SAML, Local)
 * - Types (AuthProviderType, AuthResult, WitylogixRole, etc.)
 *
 * Usage:
 *   import { getAuthProviderRegistry, Auth0Provider } from "@witylogix/core/auth";
 *   const registry = getAuthProviderRegistry();
 *   const provider = await registry.resolveProvider(shopId);
 *   const result = await provider.authenticate({ email, password });
 */

// ─── TYPES ──────────────────────────────────────────────────

export type {
  AuthProviderType,
  WitylogixRole,
  AuthResult,
  AuthProviderCapabilities,
  BaseAuthProviderConfig,
  Auth0Config,
  ClerkConfig,
  CognitoConfig,
  FirebaseAuthConfig,
  OktaConfig,
  GenericOIDCConfig,
  SAMLConfig,
  LocalConfig,
  AuthProviderConfig,
  BaseAuthProvider,
  AuthenticationRequest,
  AuthorizationUrl,
  CallbackData,
  UserInfo,
  ProviderHealthStatus,
} from "./types.js";

export {
  AuthProviderError,
  InvalidCredentialsError,
  TokenExpiredError,
  ProviderNotConfiguredError,
  ProviderUnavailableError,
  ConfigurationError,
} from "./types.js";

// ─── REGISTRY ───────────────────────────────────────────────

export { AuthProviderRegistry, getAuthProviderRegistry, resetAuthProviderRegistry } from "./provider-registry.js";

// ─── SESSION MANAGER ────────────────────────────────────────

export {
  SessionManager,
  getSessionManager,
  resetSessionManager,
  type CreateSessionInput,
  type SessionInfo,
  type SessionValidationResult,
} from "./session-manager.js";

// ─── TOKEN SERVICE ──────────────────────────────────────────

export {
  TokenService,
  getTokenService,
  resetTokenService,
  type TokenClaims,
  type SignedToken,
  type VerifiedToken,
  type TokenRotationResult,
} from "./token-service.js";

// ─── BASE PROVIDER ──────────────────────────────────────────

export {
  AuthProviderBase,
  parseProviderError,
  mergeUserInfo,
} from "./providers/base.js";

// ─── PROVIDERS ───────────────────────────────────────────────

export { LocalAuthProvider } from "./providers/local.js";
export { Auth0Provider } from "./providers/auth0.js";
export { ClerkProvider } from "./providers/clerk.js";
export { CognitoProvider } from "./providers/cognito.js";
export { FirebaseAuthProvider } from "./providers/firebase-auth.js";
export { GenericOIDCProvider } from "./providers/generic-oidc.js";
export { SAMLProvider } from "./providers/saml.js";
