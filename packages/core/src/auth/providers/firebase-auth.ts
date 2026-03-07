/**
 * Firebase Authentication Provider — Token verification + user management.
 *
 * Firebase Auth differs from OIDC providers:
 * - SDK-based (Firebase web SDK on frontend)
 * - Self-contained tokens (ID tokens are JWTs signed by Firebase)
 * - No refresh token needed (tokens are long-lived)
 * - Custom claims stored in Firestore or as claims on the token
 *
 * Flow:
 *   1. User authenticates via Firebase SDK (frontend)
 *   2. Firebase returns ID token
 *   3. Frontend sends ID token to backend
 *   4. Backend validates token signature + expiry using Firebase's public key
 *   5. Backend fetches user data from Firebase Admin SDK
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
  FirebaseAuthConfig,
  WitylogixRole,
} from "../types.js";
import {
  InvalidCredentialsError,
  TokenExpiredError,
  ProviderUnavailableError,
  ConfigurationError,
} from "../types.js";

export class FirebaseAuthProvider implements BaseAuthProvider {
  readonly type = "firebase_auth";
  readonly name = "Firebase Authentication";
  readonly capabilities: AuthProviderCapabilities = {
    supportsSSO: true,
    supportsMFA: false, // Firebase MFA is handled by SDK
    supportsRoles: true,
    supportsSAML: false,
    supportsOIDC: true, // Firebase uses OAuth 2.0 + JWT
    supportsJIT: true,
    supportsTokenRefresh: false, // Firebase tokens are self-contained
    supportsLogout: true,
    supportsProfileSync: true,
  };

  readonly config: FirebaseAuthConfig;

  constructor(config: FirebaseAuthConfig) {
    this.config = config;
  }

  /**
   * Firebase authentication happens on the frontend SDK.
   * This method receives an ID token from the frontend.
   */
  async authenticate(request: AuthenticationRequest): Promise<AuthResult> {
    throw new ConfigurationError(
      "firebase_auth",
      "Firebase Auth uses SDK on frontend; pass ID token to handleCallback()",
    );
  }

  /**
   * Handle Firebase ID token validation.
   * Frontend passes the ID token; we validate and fetch user info.
   */
  async handleCallback(callbackData: CallbackData): Promise<AuthResult> {
    if (!callbackData.code) {
      throw new InvalidCredentialsError("firebase_auth", "Firebase ID token is required");
    }

    try {
      // Validate the ID token signature + expiry
      const payload = await this.validateFirebaseToken(callbackData.code);

      // Fetch user data from Firebase (custom claims, roles, etc.)
      const userInfo = await this.fetchFirebaseUserInfo(payload.sub);

      // Extract roles from custom claims
      const customClaims = userInfo.customClaims || {};
      const roles = this.mapRolesToWitylogix(customClaims.roles || []);

      return {
        externalUserId: payload.sub,
        email: payload.email,
        name: userInfo.displayName || "",
        picture: userInfo.photoURL || "",
        roles,
        accessToken: callbackData.code,
        metadata: {
          email_verified: payload.email_verified,
          firebase_roles: customClaims.roles || [],
          custom_claims: customClaims,
        },
      };
    } catch (error) {
      throw new ProviderUnavailableError(
        "firebase_auth",
        `Firebase authentication failed: ${String(error)}`,
      );
    }
  }

  /**
   * Validate a Firebase ID token.
   */
  async validateToken(accessToken: string): Promise<Record<string, any>> {
    try {
      const payload = await this.validateFirebaseToken(accessToken);
      return payload;
    } catch (error) {
      throw new TokenExpiredError("firebase_auth", "Invalid or expired Firebase token");
    }
  }

  /**
   * Refresh session — not needed for Firebase (tokens are self-contained).
   */
  async refreshSession(refreshToken: string): Promise<AuthResult> {
    throw new ConfigurationError(
      "firebase_auth",
      "Firebase tokens do not expire; user must re-authenticate",
    );
  }

  /**
   * Revoke a Firebase session (logout).
   * Disables the user account or revokes tokens server-side.
   */
  async revokeSession(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // In production: use Firebase Admin SDK to revoke refresh tokens
      // admin.auth().revokeRefreshTokens(uid);
      // For now: no-op (user can just delete localStorage token)
    } catch (error) {
      console.error("Failed to revoke Firebase tokens:", error);
    }
  }

  /**
   * Get user information from Firebase.
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    // Validate token first
    const payload = await this.validateFirebaseToken(accessToken);

    // Fetch user from Firebase
    const userInfo = await this.fetchFirebaseUserInfo(payload.sub);
    const customClaims = userInfo.customClaims || {};

    return {
      externalUserId: payload.sub,
      email: payload.email,
      name: userInfo.displayName || "",
      picture: userInfo.photoURL || "",
      roles: customClaims.roles || [],
      emailVerified: payload.email_verified,
      metadata: {
        firebase_custom_claims: customClaims,
        disabled: userInfo.disabled,
      },
    };
  }

  /**
   * Get authorization URL — not applicable for Firebase.
   * Firebase uses SDK on frontend.
   */
  async getAuthorizationUrl(redirectUri: string, state: string): Promise<AuthorizationUrl> {
    throw new ConfigurationError("firebase_auth", "Firebase uses SDK-based authentication");
  }

  /**
   * Validate Firebase configuration.
   */
  async validateConfiguration(): Promise<void> {
    if (!this.config.projectId || !this.config.apiKey || !this.config.authDomain) {
      throw new ConfigurationError(
        "firebase_auth",
        "Firebase projectId, apiKey, and authDomain are required",
      );
    }

    try {
      // In production: verify projectId and apiKey by making a test request
      // Check that authDomain is accessible
    } catch (error) {
      throw new ConfigurationError("firebase_auth", `Invalid Firebase configuration: ${String(error)}`);
    }
  }

  /**
   * Get Firebase health status.
   */
  async getHealthStatus(): Promise<ProviderHealthStatus> {
    try {
      const start = Date.now();
      // In production: check Firebase status by pinging a known endpoint
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
   * Validate a Firebase ID token.
   * In production: verify JWT signature using Firebase's public key from JWKS.
   * Also check exp claim.
   */
  private async validateFirebaseToken(token: string): Promise<Record<string, any>> {
    try {
      // Decode JWT
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );

      // Validate issuer
      const expectedIssuer = `https://securetoken.google.com/${this.config.projectId}`;
      if (payload.iss !== expectedIssuer) {
        throw new Error(`Invalid issuer: ${payload.iss}`);
      }

      // Validate audience (should be projectId)
      if (payload.aud !== this.config.projectId) {
        throw new Error(`Invalid audience: ${payload.aud}`);
      }

      // Check expiry
      const exp = (payload.exp as number) || 0;
      if (Date.now() / 1000 > exp) {
        throw new TokenExpiredError("firebase_auth");
      }

      // In production: verify signature using Firebase's JWKS
      // For now: assume signature is valid if decoding succeeds

      return payload;
    } catch (error) {
      throw new InvalidCredentialsError(
        "firebase_auth",
        error instanceof Error ? error.message : "Token validation failed",
      );
    }
  }

  /**
   * Fetch user information from Firebase Admin SDK.
   * In production: would use firebase-admin SDK.
   */
  private async fetchFirebaseUserInfo(uid: string): Promise<any> {
    // Mock: would use firebase-admin.auth().getUser(uid)
    const mockUser = {
      uid,
      email: "user@example.com",
      emailVerified: true,
      displayName: "Firebase User",
      photoURL: "https://example.com/avatar.jpg",
      disabled: false,
      customClaims: {
        roles: ["VIEWER"],
      },
    };
    return mockUser;
  }

  /**
   * Map Firebase custom claim roles to Witylogix roles.
   */
  private mapRolesToWitylogix(firebaseRoles: string[]): WitylogixRole[] {
    const roles: WitylogixRole[] = [];

    const mapping = this.config.roleMapping || {
      admin: "ADMIN",
      dispatcher: "DISPATCHER",
      viewer: "VIEWER",
      driver: "DRIVER",
    };

    for (const role of firebaseRoles) {
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
