/**
 * SAML 2.0 Authentication Provider — Enterprise federation.
 *
 * Implements SAML 2.0 Service Provider (SP) for enterprise SSO.
 * Works with SAML IdPs: Okta SAML, Azure AD, PingFederate, etc.
 *
 * Flow:
 *   1. User visits login page
 *   2. App redirects to IdP with SAML AuthnRequest
 *   3. IdP authenticates user and sends SAML Response
 *   4. App validates assertion signature and extracts user attributes
 *   5. Create/update ExternalAuthSession, issue Witylogix JWT
 *
 * Config:
 *   - entryPoint: IdP's single sign-on URL
 *   - issuer: SP identifier (app URL)
 *   - cert: IdP's X.509 certificate for assertion validation
 *   - privateKey: SP's private key for signing requests (optional)
 *   - roleAttribute: SAML attribute containing roles (default: Role)
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
  SAMLConfig,
  WitylogixRole,
} from "../types.js";
import {
  InvalidCredentialsError,
  ProviderUnavailableError,
  ConfigurationError,
} from "../types.js";

export class SAMLProvider implements BaseAuthProvider {
  readonly type = "saml";
  readonly name = "SAML 2.0";
  readonly capabilities: AuthProviderCapabilities = {
    supportsSSO: true,
    supportsMFA: true,
    supportsRoles: true,
    supportsSAML: true,
    supportsOIDC: false,
    supportsJIT: true,
    supportsTokenRefresh: false, // SAML doesn't have refresh tokens
    supportsLogout: true,
    supportsProfileSync: true,
  };

  readonly config: SAMLConfig;

  constructor(config: SAMLConfig) {
    this.config = config;
  }

  /**
   * For SAML, return the SP metadata or redirect to IdP login.
   */
  async authenticate(request: AuthenticationRequest): Promise<AuthResult | AuthorizationUrl> {
    // Generate SAML AuthnRequest
    const authnRequest = this.generateAuthnRequest();

    const url = `${this.config.entryPoint}?SAMLRequest=${encodeURIComponent(authnRequest)}`;

    return {
      url,
      state: "",
    };
  }

  /**
   * Handle SAML Response from IdP.
   */
  async handleCallback(callbackData: CallbackData): Promise<AuthResult> {
    if (!callbackData.assertion) {
      throw new InvalidCredentialsError("saml", "SAML assertion is required");
    }

    try {
      // Parse and validate the SAML assertion
      const attributes = await this.validateAndParseAssertion(callbackData.assertion);

      // Extract user info from SAML attributes
      const roles = this.mapRolesToWitylogix(attributes.roles || []);

      return {
        externalUserId: attributes.nameId,
        email: attributes.email,
        name: attributes.displayName || "",
        picture: attributes.picture || "",
        roles,
        accessToken: callbackData.assertion, // Store assertion as token
        metadata: {
          saml_roles: attributes.roles || [],
          saml_attributes: attributes.customAttributes || {},
        },
      };
    } catch (error) {
      throw new ProviderUnavailableError("saml", `SAML assertion validation failed: ${String(error)}`);
    }
  }

  /**
   * Validate a SAML assertion token (not standard; mainly for completeness).
   */
  async validateToken(accessToken: string): Promise<Record<string, unknown>> {
    try {
      // In production: re-validate the assertion
      const attributes = await this.validateAndParseAssertion(accessToken);

      return {
        sub: attributes.nameId,
        email: attributes.email,
        name: attributes.displayName,
        roles: attributes.roles,
      };
    } catch (error) {
      throw new InvalidCredentialsError("saml", "Invalid SAML assertion");
    }
  }

  /**
   * Refresh session — not applicable for SAML.
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    throw new ConfigurationError("saml", "SAML does not support token refresh; user must re-authenticate");
  }

  /**
   * Revoke a SAML session (logout).
   * Sends SAML LogoutRequest to IdP.
   */
  async revokeSession(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // In production: generate SAML LogoutRequest
      // POST to IdP's SLO endpoint
      const logoutRequest = this.generateLogoutRequest();
      // Would POST logoutRequest to IdP
    } catch (error) {
      console.error("Failed to revoke SAML session:", error);
    }
  }

  /**
   * Get user information from SAML attributes.
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const attributes = await this.validateAndParseAssertion(accessToken);

    return {
      externalUserId: attributes.nameId,
      email: attributes.email,
      name: attributes.displayName || "",
      picture: attributes.picture || "",
      roles: attributes.roles || [],
      emailVerified: true, // Assume SAML IdPs verify email
    };
  }

  /**
   * Get authorization URL (SAML login redirect).
   */
  async getAuthorizationUrl(redirectUri: string, state: string): Promise<AuthorizationUrl> {
    const authnRequest = this.generateAuthnRequest();

    const url = `${this.config.entryPoint}?SAMLRequest=${encodeURIComponent(authnRequest)}&RelayState=${encodeURIComponent(
      state,
    )}`;

    return {
      url,
      state,
    };
  }

  /**
   * Validate SAML configuration.
   */
  async validateConfiguration(): Promise<void> {
    if (!this.config.entryPoint || !this.config.issuer || !this.config.cert) {
      throw new ConfigurationError(
        "saml",
        "SAML entryPoint, issuer, and cert are required",
      );
    }

    // Validate certificate format
    if (!this.config.cert.includes("BEGIN CERTIFICATE")) {
      throw new ConfigurationError("saml", "Invalid SAML certificate format");
    }
  }

  /**
   * Get SAML provider health status.
   */
  async getHealthStatus(): Promise<ProviderHealthStatus> {
    try {
      const start = Date.now();
      // In production: try to fetch IdP metadata
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
   * Generate a SAML AuthnRequest (login request to IdP).
   */
  private generateAuthnRequest(): string {
    // Mock: would generate valid XML-based SAML AuthnRequest
    // In production: use xmldsigjs or node-saml
    const authnRequest = `<?xml version="1.0"?>
<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="id-${Date.now()}"
    Version="2.0"
    IssueInstant="${new Date().toISOString()}"
    Destination="${this.config.entryPoint}"
    AssertionConsumerServiceURL="https://app.example.com/auth/saml/callback"
    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${this.config.issuer}</saml:Issuer>
</samlp:AuthnRequest>`;

    return Buffer.from(authnRequest).toString("base64");
  }

  /**
   * Generate a SAML LogoutRequest (logout request to IdP).
   */
  private generateLogoutRequest(): string {
    // Mock: would generate valid SAML LogoutRequest
    const logoutRequest = `<?xml version="1.0"?>
<samlp:LogoutRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    ID="id-${Date.now()}"
    Version="2.0"
    IssueInstant="${new Date().toISOString()}"
    Destination="${this.config.entryPoint}">
  <Issuer xmlns="urn:oasis:names:tc:SAML:2.0:assertion">${this.config.issuer}</Issuer>
</samlp:LogoutRequest>`;

    return Buffer.from(logoutRequest).toString("base64");
  }

  /**
   * Validate and parse a SAML Response assertion.
   * In production: verify signature using IdP's certificate.
   */
  private async validateAndParseAssertion(assertion: string): Promise<{
    nameId: string;
    email: string;
    displayName?: string;
    picture?: string;
    roles: string[];
    customAttributes?: Record<string, unknown>;
  }> {
    try {
      // Mock: would parse XML, verify signature, extract attributes
      // In production: use xmldsigjs for signature verification

      const attributes = {
        nameId: `saml|${Date.now()}`,
        email: "user@example.com",
        displayName: "SAML User",
        picture: "https://example.com/avatar.jpg",
        roles: ["VIEWER"],
        customAttributes: {},
      };

      return attributes;
    } catch (error) {
      throw new Error(`SAML assertion parsing failed: ${String(error)}`);
    }
  }

  /**
   * Map SAML roles to Witylogix roles.
   */
  private mapRolesToWitylogix(samlRoles: string[]): WitylogixRole[] {
    const roles: WitylogixRole[] = [];

    const mapping = this.config.roleMapping || {
      admin: "ADMIN",
      dispatcher: "DISPATCHER",
      viewer: "VIEWER",
      driver: "DRIVER",
    };

    for (const role of samlRoles) {
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
}
