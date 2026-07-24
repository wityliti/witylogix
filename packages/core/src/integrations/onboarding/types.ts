/**
 * Integration Onboarding Wizard — Core Type Definitions
 *
 * Comprehensive types for OAuth flows, credential validation, and health checks
 * supporting 124 integration providers across 21 categories.
 */

// ─── Authentication Types ────────────────────────────────────────

/** Supported authentication methods for integrations. */
export enum IntegrationAuthType {
  API_KEY = "API_KEY",
  OAUTH2 = "OAUTH2",
  OAUTH1 = "OAUTH1",
  BASIC_AUTH = "BASIC_AUTH",
  BEARER_TOKEN = "BEARER_TOKEN",
  WEBHOOK_SECRET = "WEBHOOK_SECRET",
  CUSTOM = "CUSTOM",
}

// ─── Setup Configuration ────────────────────────────────────────

/** Credential field required or optional for integration setup. */
export interface CredentialField {
  key: string;
  label: string;
  placeholder?: string;
  type: "text" | "password" | "url" | "textarea" | "select";
  required: boolean;
  helpUrl?: string;
  helpText?: string;
  pattern?: string;
  options?: Array<{ label: string; value: string }>;
  sensitive?: boolean; // Whether value should be encrypted
}

/** OAuth-specific configuration. */
export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  grantType: "authorization_code" | "client_credentials" | "password";
  pkceRequired?: boolean;
  customParams?: Record<string, string>;
}

/** Setup configuration for a specific integration provider. */
export interface IntegrationSetupConfig {
  providerId: string;
  name: string;
  category: string;
  authType: IntegrationAuthType;
  requiredFields: CredentialField[];
  optionalFields: CredentialField[];
  oauthConfig?: OAuthConfig;
  webhookUrl?: string;
  testEndpoint?: string; // Endpoint to validate credentials
  setupInstructions: string; // Markdown-formatted instructions
  estimatedSetupTime?: number; // Minutes
}

// ─── Connection Testing ────────────────────────────────────────

/** Result of testing a connection with provided credentials. */
export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
  errorCode?: string;
}

/** Result of credential validation. */
export interface CredentialValidationResult {
  valid: boolean;
  providerId: string;
  timestamp: Date;
  errors?: string[];
  latencyMs?: number;
}

// ─── OAuth Flow State ────────────────────────────────────────

/** State object stored during OAuth flow. */
export interface OAuthFlowState {
  providerId: string;
  state: string; // CSRF protection
  codeVerifier?: string; // PKCE
  redirectUri: string;
  expiresAt: Date;
  customState?: Record<string, unknown>; // Provider-specific data
}

/** Result of OAuth token exchange. */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

// ─── Health Check ────────────────────────────────────────

/** Health status of an integration. */
export enum HealthStatus {
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  DOWN = "DOWN",
  UNAUTHORIZED = "UNAUTHORIZED",
  RATE_LIMITED = "RATE_LIMITED",
}

/** Comprehensive health check result. */
export interface HealthCheckResult {
  providerId: string;
  status: HealthStatus;
  timestamp: Date;
  checks: {
    authentication: boolean;
    apiAvailability: boolean;
    rateLimit?: {
      remaining: number;
      limit: number;
      resetAt: Date;
    };
    webhookConnectivity?: boolean;
  };
  details?: Record<string, unknown>;
  nextCheckAt?: Date;
  cachedUntil?: Date;
}

// ─── Quick Setup Templates ────────────────────────────────────────

/** Pre-filled configuration template for quick setup. */
export interface IntegrationQuickSetup {
  providerId: string;
  prefilledConfig: Record<string, unknown>;
  setupInstructions: string;
  estimatedTime: number; // Minutes
  commonMistakes?: string[];
}

/** Industry-specific integration template set. */
export interface IndustryTemplate {
  industry: string;
  description: string;
  integrations: string[]; // Provider IDs
  suggestedWebhooks?: Record<string, string>;
  defaultConfig?: Record<string, Record<string, unknown>>;
}

// ─── Batch Operations ────────────────────────────────────────

/** Result of enabling multiple integrations. */
export interface BatchEnableResult {
  orgId: string;
  enabledCount: number;
  failedCount: number;
  results: Array<{
    providerId: string;
    success: boolean;
    error?: string;
  }>;
}

/** Integration connection record. */
export interface IntegrationConnection {
  orgId: string;
  providerId: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  credentialsEncrypted: string; // Encrypted JSON
  lastTestedAt?: Date;
  lastHealthCheckAt?: Date;
  healthStatus: HealthStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Validation Endpoints ────────────────────────────────────────

/** Mapping of provider ID to validation endpoint. */
export interface ValidationEndpoint {
  providerId: string;
  endpoint: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  successStatusCodes: number[];
}

// ─── Provider-Specific Configurations ────────────────────────────

/** OAuth provider-specific configuration. */
export interface ProviderOAuthConfig {
  google: {
    authorizationUrl: string;
    tokenUrl: string;
    scopesByProduct: Record<string, string[]>;
  };
  microsoft: {
    authorizationUrl: string;
    tokenUrl: string;
    resourceId?: string;
  };
  shopify: {
    authorizationUrl: string;
    accessTokenUrl: string;
    hmacValidation: boolean;
  };
  docusign: {
    demoBaseUrl: string;
    productionBaseUrl: string;
  };
  salesforce: {
    loginUrl: string;
    testUrl: string;
    apiVersion: string;
  };
}

// ─── Error Types ────────────────────────────────────────

export class IntegrationOnboardingError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "IntegrationOnboardingError";
  }
}

export class OAuthFlowError extends IntegrationOnboardingError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("OAUTH_FLOW_ERROR", message, details);
    this.name = "OAuthFlowError";
  }
}

export class CredentialValidationError extends IntegrationOnboardingError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CREDENTIAL_VALIDATION_ERROR", message, details);
    this.name = "CredentialValidationError";
  }
}

export class HealthCheckError extends IntegrationOnboardingError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("HEALTH_CHECK_ERROR", message, details);
    this.name = "HealthCheckError";
  }
}
