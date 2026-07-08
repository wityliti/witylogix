/**
 * SSO Providers Tests
 *
 * Comprehensive test suite for OAuth2 and OIDC providers.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  GoogleSSOProvider,
  MicrosoftSSOProvider,
  GenericOIDCProvider,
  SSOProviderFactory,
  getSSOProviderFactory,
  resetSSOProviderFactory,
  type OAuthConfig,
  type UserProfile,
} from "../sso-providers";

describe("GoogleSSOProvider", () => {
  let provider: GoogleSSOProvider;
  const config: OAuthConfig = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/auth/google/callback",
  };

  beforeEach(() => {
    provider = new GoogleSSOProvider(config);
  });

  it("should create instance with valid config", () => {
    expect(provider).toBeDefined();
  });

  it("should throw on invalid config", () => {
    expect(() => {
      new GoogleSSOProvider({
        clientId: "",
        clientSecret: "secret",
        redirectUri: "http://localhost",
      });
    }).toThrow();
  });

  it("should generate authorization URL", () => {
    const url = provider.getAuthorizationUrl();

    expect(url).toContain("accounts.google.com");
    expect(url).toContain(config.clientId);
    expect(url).toContain(
      "redirect_uri=" + encodeURIComponent(config.redirectUri),
    );
    expect(url).toContain("response_type=code");
  });

  it("should include state parameter in authorization URL", () => {
    const url = provider.getAuthorizationUrl();

    expect(url).toContain("state=");
  });

  it("should support custom state", () => {
    const customState = "custom-state-123";
    const url = provider.getAuthorizationUrl({ state: customState });

    expect(url).toContain(`state=${customState}`);
  });

  it("should include PKCE parameters when provided", () => {
    const url = provider.getAuthorizationUrl({
      codeChallenge: "test-challenge",
      codeChallengeMethod: "S256",
    });

    expect(url).toContain("code_challenge=test-challenge");
    expect(url).toContain("code_challenge_method=S256");
  });

  it("should include default scopes", () => {
    const url = provider.getAuthorizationUrl();

    expect(url).toContain("scope=");
    expect(url).toContain("userinfo.email");
    expect(url).toContain("userinfo.profile");
  });
});

describe("MicrosoftSSOProvider", () => {
  let provider: MicrosoftSSOProvider;
  const config: OAuthConfig = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/auth/microsoft/callback",
  };

  beforeEach(() => {
    provider = new MicrosoftSSOProvider(config);
  });

  it("should create instance with valid config", () => {
    expect(provider).toBeDefined();
  });

  it("should generate authorization URL", () => {
    const url = provider.getAuthorizationUrl();

    expect(url).toContain("login.microsoftonline.com");
    expect(url).toContain(config.clientId);
    expect(url).toContain(
      "redirect_uri=" + encodeURIComponent(config.redirectUri),
    );
  });

  it("should include Microsoft scopes", () => {
    const url = provider.getAuthorizationUrl();

    expect(url).toContain("scope=");
    expect(url).toContain("User.Read");
  });

  it("should include PKCE parameters when provided", () => {
    const url = provider.getAuthorizationUrl({
      codeChallenge: "test-challenge",
      codeChallengeMethod: "S256",
    });

    expect(url).toContain("code_challenge=test-challenge");
    expect(url).toContain("code_challenge_method=S256");
  });
});

describe("GenericOIDCProvider", () => {
  let provider: GenericOIDCProvider;
  const config: OAuthConfig & {
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userInfoEndpoint: string;
  } = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/auth/oidc/callback",
    authorizationEndpoint: "https://auth.example.com/authorize",
    tokenEndpoint: "https://auth.example.com/token",
    userInfoEndpoint: "https://auth.example.com/userinfo",
  };

  beforeEach(() => {
    provider = new GenericOIDCProvider(config, "CustomOIDC");
  });

  it("should create instance with valid config", () => {
    expect(provider).toBeDefined();
  });

  it("should use custom endpoints", () => {
    const url = provider.getAuthorizationUrl();

    expect(url).toContain("auth.example.com");
    expect(url).toContain("/authorize");
  });

  it("should include default OIDC scopes", () => {
    const url = provider.getAuthorizationUrl();

    expect(url).toContain("openid");
    expect(url).toContain("profile");
    expect(url).toContain("email");
  });
});

describe("SSOProviderFactory", () => {
  let factory: SSOProviderFactory;
  const googleConfig: OAuthConfig = {
    clientId: "google-client-id",
    clientSecret: "google-client-secret",
    redirectUri: "http://localhost:3000/auth/google/callback",
  };

  const microsoftConfig: OAuthConfig = {
    clientId: "microsoft-client-id",
    clientSecret: "microsoft-client-secret",
    redirectUri: "http://localhost:3000/auth/microsoft/callback",
  };

  beforeEach(() => {
    factory = new SSOProviderFactory();
  });

  it("should register Google provider", () => {
    factory.createGoogleProvider(googleConfig);

    const provider = factory.getProvider("google");

    expect(provider).toBeDefined();
    expect(provider).toBeInstanceOf(GoogleSSOProvider);
  });

  it("should register Microsoft provider", () => {
    factory.createMicrosoftProvider(microsoftConfig);

    const provider = factory.getProvider("microsoft");

    expect(provider).toBeDefined();
    expect(provider).toBeInstanceOf(MicrosoftSSOProvider);
  });

  it("should return null for unknown provider", () => {
    const provider = factory.getProvider("unknown");

    expect(provider).toBeNull();
  });

  it("should be case-insensitive", () => {
    factory.createGoogleProvider(googleConfig);

    const provider1 = factory.getProvider("Google");
    const provider2 = factory.getProvider("GOOGLE");

    expect(provider1).toBeDefined();
    expect(provider2).toBeDefined();
    expect(provider1).toBe(provider2);
  });

  it("should list registered providers", () => {
    factory.createGoogleProvider(googleConfig);
    factory.createMicrosoftProvider(microsoftConfig);

    const providers = factory.listProviders();

    expect(providers).toContain("google");
    expect(providers).toContain("microsoft");
    expect(providers.length).toBe(2);
  });

  it("should clear all providers", () => {
    factory.createGoogleProvider(googleConfig);
    factory.createMicrosoftProvider(microsoftConfig);

    expect(factory.listProviders().length).toBe(2);

    factory.clear();

    expect(factory.listProviders().length).toBe(0);
  });

  it("should register custom provider", () => {
    const googleProvider = factory.createGoogleProvider(googleConfig);

    factory.registerProvider("custom", googleProvider);

    const provider = factory.getProvider("custom");

    expect(provider).toBe(googleProvider);
  });

  it("should create generic OIDC provider", () => {
    const oidcConfig: OAuthConfig & {
      authorizationEndpoint: string;
      tokenEndpoint: string;
      userInfoEndpoint: string;
    } = {
      ...googleConfig,
      authorizationEndpoint: "https://auth.example.com/authorize",
      tokenEndpoint: "https://auth.example.com/token",
      userInfoEndpoint: "https://auth.example.com/userinfo",
    };

    factory.createOIDCProvider("custom-oidc", oidcConfig);

    const provider = factory.getProvider("custom-oidc");

    expect(provider).toBeDefined();
    expect(provider).toBeInstanceOf(GenericOIDCProvider);
  });
});

describe("Singleton Factory", () => {
  afterEach(() => {
    resetSSOProviderFactory();
  });

  it("should return same factory instance", () => {
    const factory1 = getSSOProviderFactory();
    const factory2 = getSSOProviderFactory();

    expect(factory1).toBe(factory2);
  });

  it("should reset factory", () => {
    const factory1 = getSSOProviderFactory();
    const googleConfig: OAuthConfig = {
      clientId: "test",
      clientSecret: "test",
      redirectUri: "http://localhost",
    };
    factory1.createGoogleProvider(googleConfig);

    expect(factory1.listProviders().length).toBeGreaterThan(0);

    resetSSOProviderFactory();

    const factory2 = getSSOProviderFactory();

    expect(factory2.listProviders().length).toBe(0);
  });
});

describe("Authorization Flow", () => {
  it("should generate valid authorization URL with state", () => {
    const config: OAuthConfig = {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "http://localhost:3000/auth/callback",
    };

    const provider = new GoogleSSOProvider(config);
    const url = provider.getAuthorizationUrl();

    // Verify URL is properly formed
    expect(url).toContain("?");
    expect(url).toContain("&");
    expect(url).toContain("state=");

    // Verify no encoding issues
    const urlObj = new URL(url);
    expect(urlObj.searchParams.get("client_id")).toBe(config.clientId);
    expect(urlObj.searchParams.get("redirect_uri")).toBe(config.redirectUri);
  });

  it("should support PKCE flow", () => {
    const config: OAuthConfig = {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "http://localhost:3000/auth/callback",
    };

    const provider = new GoogleSSOProvider(config);
    const url = provider.getAuthorizationUrl({
      codeChallenge: "E9Mrozoa2owUednMQBAAUAqWgaH9Ct3f7IjUgsxupQ",
      codeChallengeMethod: "S256",
    });

    const urlObj = new URL(url);
    expect(urlObj.searchParams.get("code_challenge")).toBe(
      "E9Mrozoa2owUednMQBAAUAqWgaH9Ct3f7IjUgsxupQ",
    );
    expect(urlObj.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("OAuth Callback Handling", () => {
  it("should have handleCallback method", async () => {
    const config: OAuthConfig = {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "http://localhost:3000/auth/callback",
    };

    const provider = new GoogleSSOProvider(config);

    expect(typeof provider.handleCallback).toBe("function");
  });

  it("should return error on invalid authorization code", async () => {
    const config: OAuthConfig = {
      clientId: "invalid-client",
      clientSecret: "invalid-secret",
      redirectUri: "http://localhost:3000/auth/callback",
    };

    const provider = new GoogleSSOProvider(config);
    const result = await provider.handleCallback("invalid-code");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("Custom Configuration", () => {
  it("should accept custom scopes", () => {
    const customScopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/calendar",
    ];

    const config: OAuthConfig = {
      clientId: "test",
      clientSecret: "test",
      redirectUri: "http://localhost",
      scope: customScopes,
    };

    const provider = new GoogleSSOProvider(config);
    const url = provider.getAuthorizationUrl();

    customScopes.forEach((scope) => {
      expect(url).toContain(encodeURIComponent(scope));
    });
  });
});
