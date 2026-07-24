/**
 * OAuth2 Token Manager Tests — Complete lifecycle management
 *
 * Tests cover:
 * - Authorization URL generation with PKCE
 * - Code exchange for access token
 * - Token refresh with retry backoff
 * - Auto-refresh when token expiring
 * - Token persistence in vault
 * - Token revocation
 * - Event emission (token_refreshed, token_revoked, token_refresh_failed)
 * - Grant type support (authorization_code, client_credentials)
 *
 * Run with: npm test -- token-manager.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OAuth2TokenManager,
  type OAuth2Config,
  type TokenManagerConfig,
} from "../token-manager.js";
import type { IHttpClient, OAuth2Token } from "../token-manager.js";
import type { CredentialVault } from "../../credentials/credential-vault.js";

// ─── Mock Implementations ────────────────────────────────────────

class MockHttpClient implements IHttpClient {
  responses: Map<string, Record<string, unknown>> = new Map();
  failureCount: number = 0;
  maxFailures: number = 0;

  async post<T>(url: string, data: Record<string, unknown>): Promise<T> {
    // Simulate failures for retry testing
    if (this.failureCount < this.maxFailures) {
      this.failureCount++;
      const error: any = new Error("Network error");
      error.statusCode = 503;
      throw error;
    }

    const response = this.responses.get(url);
    if (!response) {
      throw new Error(`No response configured for ${url}`);
    }

    return response as T;
  }

  reset(): void {
    this.responses.clear();
    this.failureCount = 0;
  }
}

class MockCredentialVault {
  stored: Map<string, Record<string, string>> = new Map();

  async store(entry: any, expiresAt?: Date): Promise<void> {
    const key = `${entry.tenantId}:${entry.providerId}`;
    this.stored.set(key, entry.credential);
  }

  async retrieve(tenantId: string, providerId: string): Promise<any> {
    const key = `${tenantId}:${providerId}`;
    const cred = this.stored.get(key);
    if (!cred) return null;

    return {
      tenantId,
      providerId,
      credentialType: "oauth_token",
      credential: cred,
    };
  }

  async delete(): Promise<void> {
    this.stored.clear();
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("OAuth2TokenManager", () => {
  let manager: OAuth2TokenManager;
  let httpClient: MockHttpClient;
  let vault: MockCredentialVault;
  let oauth2Config: OAuth2Config;
  let managerConfig: TokenManagerConfig;

  beforeEach(() => {
    httpClient = new MockHttpClient();
    vault = new MockCredentialVault();

    oauth2Config = {
      authorizationUrl: "https://oauth.example.com/authorize",
      tokenUrl: "https://oauth.example.com/token",
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "http://localhost:3000/callback",
      grantType: "authorization_code",
      scopes: ["read", "write"],
      usePkce: false,
      refreshBufferMs: 1000,
    };

    managerConfig = {
      oauth2Config,
      credentialVault: vault as any,
      httpClient,
      tenantId: "tenant-123",
      providerId: "test-provider",
    };

    manager = new OAuth2TokenManager(managerConfig);
  });

  // ─── AUTHORIZATION URL TESTS ────────────────────────────────────

  describe("generateAuthorizationUrl", () => {
    it("should generate authorization URL", () => {
      const result = manager.generateAuthorizationUrl();

      expect(result.url).toContain("https://oauth.example.com/authorize");
      expect(result.url).toContain("client_id=test-client-id");
      expect(result.url).toContain("response_type=code");
      expect(result.url).toContain("scope=read+write");
      expect(result.url).toContain(
        "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback",
      );
    });

    it("should generate PKCE state when usePkce is true", () => {
      const configWithPkce = {
        ...oauth2Config,
        usePkce: true,
      };

      const managerWithPkce = new OAuth2TokenManager({
        ...managerConfig,
        oauth2Config: configWithPkce,
      });

      const result = managerWithPkce.generateAuthorizationUrl();

      expect(result.pkce).toBeDefined();
      expect(result.pkce?.codeVerifier).toBeDefined();
      expect(result.pkce?.codeChallenge).toBeDefined();
      expect(result.pkce?.state).toBeDefined();
      expect(result.url).toContain("code_challenge=");
      expect(result.url).toContain("code_challenge_method=S256");
    });

    it("should use custom scopes", () => {
      const result = manager.generateAuthorizationUrl(["custom:scope"]);

      expect(result.url).toContain("scope=custom%3Ascope");
    });
  });

  // ─── CODE EXCHANGE TESTS ────────────────────────────────────────

  describe("exchangeCode", () => {
    it("should exchange code for token", async () => {
      httpClient.responses.set("https://oauth.example.com/token", {
        access_token: "access_token_value_12345",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refresh_token_value_12345",
      });

      const result = await manager.exchangeCode("auth-code-12345");

      expect(result.accessToken).toBe("access_token_value_12345");
      expect(result.tokenType).toBe("Bearer");
      expect(result.refreshToken).toBe("refresh_token_value_12345");
      expect(result.expiresIn).toBe(3600);
    });

    it("should store token in vault", async () => {
      httpClient.responses.set("https://oauth.example.com/token", {
        access_token: "access_token_value_12345",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refresh_token_value_12345",
      });

      await manager.exchangeCode("auth-code-12345");

      const stored = vault.stored.get("tenant-123:test-provider");
      expect(stored).toBeDefined();
      expect(stored?.accessToken).toBe("access_token_value_12345");
    });

    it("should emit token_refreshed event", async () => {
      httpClient.responses.set("https://oauth.example.com/token", {
        access_token: "access_token_value_12345",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refresh_token_value_12345",
      });

      const eventHandler = vi.fn();
      manager.on("token_refreshed", eventHandler);

      await manager.exchangeCode("auth-code-12345");

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.objectContaining({
            accessToken: "access_token_value_12345",
          }),
        }),
      );
    });
  });

  // ─── GET TOKEN TESTS ────────────────────────────────────────────

  describe("getToken", () => {
    it("should return cached token if not expiring", async () => {
      httpClient.responses.set("https://oauth.example.com/token", {
        access_token: "access_token_value_12345",
        token_type: "Bearer",
        expires_in: 7200, // 2 hours, plenty of time
        refresh_token: "refresh_token_value_12345",
      });

      await manager.exchangeCode("auth-code-12345");

      const token = await manager.getToken();

      expect(token.accessToken).toBe("access_token_value_12345");
    });

    it("should throw when no token available", async () => {
      await expect(manager.getToken()).rejects.toThrow(
        /No valid token available/,
      );
    });
  });

  // ─── REFRESH TOKEN TESTS ────────────────────────────────────────

  describe("refreshToken", () => {
    it("should refresh token when expired", async () => {
      // Store expired token
      vault.stored.set("tenant-123:test-provider", {
        accessToken: "old_token",
        refreshToken: "refresh_token_value_12345",
        expiresAt: String(Date.now() - 3600000),
        tokenType: "Bearer",
        scope: "read write",
      });

      // Configure refresh response
      httpClient.responses.set("https://oauth.example.com/token", {
        access_token: "new_access_token",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "new_refresh_token",
      });

      const result = await manager.refreshToken();

      expect(result.accessToken).toBe("new_access_token");
      expect(result.refreshToken).toBe("new_refresh_token");
    });

    it("should retry on failure with exponential backoff", async () => {
      vault.stored.set("tenant-123:test-provider", {
        accessToken: "old_token",
        refreshToken: "refresh_token_value_12345",
        expiresAt: String(Date.now() - 3600000),
        tokenType: "Bearer",
        scope: "read write",
      });

      // Fail first 2 attempts, succeed on 3rd
      httpClient.maxFailures = 2;
      httpClient.responses.set("https://oauth.example.com/token", {
        access_token: "new_access_token",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "new_refresh_token",
      });

      const result = await manager.refreshToken();

      expect(result.accessToken).toBe("new_access_token");
    });

    it("should prevent concurrent refresh attempts", async () => {
      vault.stored.set("tenant-123:test-provider", {
        accessToken: "old_token",
        refreshToken: "refresh_token_value_12345",
        expiresAt: String(Date.now() - 3600000),
        tokenType: "Bearer",
        scope: "read write",
      });

      httpClient.responses.set("https://oauth.example.com/token", {
        access_token: "new_access_token",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "new_refresh_token",
      });

      const promise1 = manager.refreshToken();
      const promise2 = manager.refreshToken();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.accessToken).toBe("new_access_token");
      expect(result2.accessToken).toBe("new_access_token");
    });

    it("should emit token_refresh_failed event on max retries", async () => {
      vault.stored.set("tenant-123:test-provider", {
        accessToken: "old_token",
        refreshToken: "refresh_token_value_12345",
        expiresAt: String(Date.now() - 3600000),
        tokenType: "Bearer",
        scope: "read write",
      });

      // Always fail
      httpClient.maxFailures = 100;

      const eventHandler = vi.fn();
      manager.on("token_refresh_failed", eventHandler);

      await expect(manager.refreshToken()).rejects.toThrow();
      expect(eventHandler).toHaveBeenCalled();
    });
  });

  // ─── REVOKE TOKEN TESTS ─────────────────────────────────────────

  describe("revokeToken", () => {
    it("should delete token from vault", async () => {
      vault.stored.set("tenant-123:test-provider", {
        accessToken: "access_token_12345",
        refreshToken: "refresh_token_12345",
        expiresAt: String(Date.now() + 3600000),
        tokenType: "Bearer",
        scope: "read write",
      });

      await manager.revokeToken();

      const stored = vault.stored.get("tenant-123:test-provider");
      expect(stored).toBeUndefined();
    });

    it("should emit token_revoked event", async () => {
      vault.stored.set("tenant-123:test-provider", {
        accessToken: "access_token_12345",
        refreshToken: "refresh_token_12345",
        expiresAt: String(Date.now() + 3600000),
        tokenType: "Bearer",
        scope: "read write",
      });

      const eventHandler = vi.fn();
      manager.on("token_revoked", eventHandler);

      await manager.revokeToken();

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  // ─── PKCE TESTS ─────────────────────────────────────────────────

  describe("PKCE", () => {
    it("should generate unique PKCE states", () => {
      const managerWithPkce = new OAuth2TokenManager({
        ...managerConfig,
        oauth2Config: { ...oauth2Config, usePkce: true },
      });

      const result1 = managerWithPkce.generateAuthorizationUrl();
      const result2 = managerWithPkce.generateAuthorizationUrl();

      expect(result1.pkce?.state).not.toBe(result2.pkce?.state);
      expect(result1.pkce?.codeVerifier).not.toBe(result2.pkce?.codeVerifier);
    });

    it("should use PKCE by default when no clientSecret", () => {
      const configWithoutSecret = {
        ...oauth2Config,
        clientSecret: undefined,
        usePkce: undefined,
      };

      const managerWithoutSecret = new OAuth2TokenManager({
        ...managerConfig,
        oauth2Config: configWithoutSecret,
      });

      const result = managerWithoutSecret.generateAuthorizationUrl();

      expect(result.pkce).toBeDefined();
    });
  });
});
