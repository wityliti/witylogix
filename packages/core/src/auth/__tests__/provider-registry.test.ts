// @ts-nocheck
/**
 * Auth Provider Registry Tests
 * Tests for provider resolution, caching, validation, health checks, and metering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  authProvider: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  authMeterEvent: {
    create: vi.fn(),
  },
}));

vi.mock("@witylogix/db", () => ({
  db: mockDb,
}));

// Mock all provider constructors to return simple objects with the expected interface
vi.mock("../providers/local.js", () => ({
  LocalAuthProvider: vi.fn().mockImplementation(() => ({
    type: "local",
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    validateConfiguration: vi.fn().mockResolvedValue(undefined),
    getHealthStatus: vi.fn().mockResolvedValue({ healthy: true }),
  })),
}));

vi.mock("../providers/auth0.js", () => ({
  Auth0Provider: vi.fn().mockImplementation(() => ({
    type: "auth0",
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    validateConfiguration: vi.fn().mockResolvedValue(undefined),
    getHealthStatus: vi.fn().mockResolvedValue({ healthy: true }),
  })),
}));

vi.mock("../providers/clerk.js", () => ({
  ClerkProvider: vi.fn().mockImplementation(() => ({
    type: "clerk",
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    validateConfiguration: vi.fn().mockResolvedValue(undefined),
    getHealthStatus: vi.fn().mockResolvedValue({ healthy: true }),
  })),
}));

vi.mock("../providers/cognito.js", () => ({
  CognitoProvider: vi.fn().mockImplementation(() => ({
    type: "cognito",
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    validateConfiguration: vi.fn().mockResolvedValue(undefined),
    getHealthStatus: vi.fn().mockResolvedValue({ healthy: true }),
  })),
}));

vi.mock("../providers/firebase-auth.js", () => ({
  FirebaseAuthProvider: vi.fn().mockImplementation(() => ({
    type: "firebase_auth",
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    validateConfiguration: vi.fn().mockResolvedValue(undefined),
    getHealthStatus: vi.fn().mockResolvedValue({ healthy: true }),
  })),
}));

vi.mock("../providers/generic-oidc.js", () => ({
  GenericOIDCProvider: vi.fn().mockImplementation(() => ({
    type: "generic_oidc",
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    validateConfiguration: vi.fn().mockResolvedValue(undefined),
    getHealthStatus: vi.fn().mockResolvedValue({ healthy: true }),
  })),
}));

vi.mock("../providers/saml.js", () => ({
  SAMLProvider: vi.fn().mockImplementation(() => ({
    type: "saml",
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    validateConfiguration: vi.fn().mockResolvedValue(undefined),
    getHealthStatus: vi.fn().mockResolvedValue({ healthy: true }),
  })),
}));

import {
  AuthProviderRegistry,
  resetAuthProviderRegistry,
} from "../provider-registry";

describe("AuthProviderRegistry", () => {
  let registry: AuthProviderRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthProviderRegistry();
    process.env.AUTH_BYOK = "false";
    process.env.AUTH_PROVIDER = "local";
    registry = new AuthProviderRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTH_BYOK;
    delete process.env.AUTH_PROVIDER;
  });

  describe("Provider Resolution", () => {
    it("should resolve to local provider when AUTH_PROVIDER=local", async () => {
      const provider = await registry.resolveProvider("shop-1");
      expect(provider).toBeDefined();
      expect(provider.type).toBe("local");
    });

    it("should resolve shop-level provider when BYOK enabled", async () => {
      process.env.AUTH_BYOK = "true";
      const byokRegistry = new AuthProviderRegistry();

      mockDb.authProvider.findFirst.mockResolvedValueOnce({
        id: "prov-shop-1",
        provider: "auth0",
        shopId: "shop-1",
        isEnabled: true,
        isDefault: true,
        level: "shop",
        config: { domain: "example.auth0.com" },
      });

      const provider = await byokRegistry.resolveProvider("shop-1");
      expect(provider).toBeDefined();
      expect(provider.type).toBe("auth0");
      expect(mockDb.authProvider.findFirst).toHaveBeenCalledWith({
        where: {
          shopId: "shop-1",
          isEnabled: true,
          isDefault: true,
          level: "shop",
        },
      });
    });

    it("should fall back to deployer provider when no shop override", async () => {
      process.env.AUTH_BYOK = "true";
      const byokRegistry = new AuthProviderRegistry();

      // No shop-level provider
      mockDb.authProvider.findFirst.mockResolvedValueOnce(null);

      const provider = await byokRegistry.resolveProvider("shop-1");
      expect(provider).toBeDefined();
      expect(provider.type).toBe("local");
    });

    it("should fall back to local auth on resolution error", async () => {
      process.env.AUTH_BYOK = "true";
      const byokRegistry = new AuthProviderRegistry();

      mockDb.authProvider.findFirst.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const provider = await byokRegistry.resolveProvider("shop-1");
      expect(provider).toBeDefined();
      expect(provider.type).toBe("local");
    });

    it("should resolve deployer provider from database when not local", async () => {
      process.env.AUTH_PROVIDER = "auth0";
      const auth0Registry = new AuthProviderRegistry();

      mockDb.authProvider.findFirst.mockResolvedValueOnce({
        id: "prov-deployer",
        provider: "auth0",
        isEnabled: true,
        level: "deployer",
        config: { domain: "example.auth0.com" },
      });

      const provider = await auth0Registry.resolveProvider("shop-1");
      expect(provider).toBeDefined();
      expect(provider.type).toBe("auth0");
    });
  });

  describe("Caching", () => {
    it("should cache shop provider after first resolution", async () => {
      process.env.AUTH_BYOK = "true";
      const byokRegistry = new AuthProviderRegistry();

      mockDb.authProvider.findFirst.mockResolvedValueOnce({
        id: "prov-1",
        provider: "auth0",
        shopId: "shop-1",
        isEnabled: true,
        isDefault: true,
        level: "shop",
        config: { domain: "example.auth0.com" },
      });

      await byokRegistry.resolveProvider("shop-1");
      await byokRegistry.resolveProvider("shop-1");

      // findFirst should only be called once for shop lookup
      expect(mockDb.authProvider.findFirst).toHaveBeenCalledTimes(1);
    });

    it("should cache deployer provider", async () => {
      // Local provider doesn't need DB lookup, should be cached
      await registry.resolveProvider("shop-1");
      await registry.resolveProvider("shop-2");

      // No DB calls needed for local provider
      expect(mockDb.authProvider.findFirst).not.toHaveBeenCalled();
    });

    it("should clear cache", () => {
      registry.clearCache();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("Provider Listing", () => {
    it("should list providers for a shop", async () => {
      mockDb.authProvider.findMany.mockResolvedValueOnce([
        {
          id: "prov-1",
          provider: "auth0",
          shopId: "shop-1",
          isEnabled: true,
          level: "shop",
          config: { domain: "example.auth0.com" },
        },
      ]);

      const providers = await registry.listProvidersForShop("shop-1");
      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThanOrEqual(1);
    });

    it("should always include local auth in provider list", async () => {
      mockDb.authProvider.findMany.mockResolvedValueOnce([]);

      const providers = await registry.listProvidersForShop("shop-1");
      expect(providers.some((p) => p.type === "local")).toBe(true);
    });
  });

  describe("Provider Validation", () => {
    it("should validate a provider by ID", async () => {
      mockDb.authProvider.findUnique.mockResolvedValueOnce({
        id: "prov-1",
        provider: "local",
        config: {},
      });
      mockDb.authProvider.update.mockResolvedValueOnce({});

      await registry.validateProvider("prov-1");

      expect(mockDb.authProvider.update).toHaveBeenCalledWith({
        where: { id: "prov-1" },
        data: expect.objectContaining({
          lastValidatedAt: expect.any(Date),
          lastValidationError: null,
        }),
      });
    });

    it("should record validation error when validation fails", async () => {
      mockDb.authProvider.findUnique.mockResolvedValueOnce({
        id: "prov-1",
        provider: "auth0",
        config: {},
      });

      // Auth0Provider.validateConfiguration will throw
      const { Auth0Provider } = await import("../providers/auth0.js");
      (Auth0Provider as any).mockImplementationOnce(() => ({
        type: "auth0",
        validateConfiguration: vi
          .fn()
          .mockRejectedValue(new Error("Invalid config")),
      }));
      mockDb.authProvider.update.mockResolvedValue({});

      await expect(registry.validateProvider("prov-1")).rejects.toThrow();

      expect(mockDb.authProvider.update).toHaveBeenCalledWith({
        where: { id: "prov-1" },
        data: expect.objectContaining({
          lastValidatedAt: expect.any(Date),
          lastValidationError: expect.any(String),
        }),
      });
    });

    it("should throw when provider not found", async () => {
      mockDb.authProvider.findUnique.mockResolvedValueOnce(null);

      await expect(registry.validateProvider("non-existent")).rejects.toThrow();
    });
  });

  describe("Provider Instance Creation", () => {
    it("should create local provider instance", () => {
      const instance = registry.createProviderInstance("local", {});
      expect(instance).toBeDefined();
      expect(instance.type).toBe("local");
    });

    it("should create auth0 provider instance", () => {
      const instance = registry.createProviderInstance("auth0", {
        domain: "example.auth0.com",
        clientId: "client123",
        clientSecret: "secret123",
      });
      expect(instance).toBeDefined();
      expect(instance.type).toBe("auth0");
    });

    it("should throw for unknown provider type", () => {
      expect(() =>
        registry.createProviderInstance("invalid_type" as any, {}),
      ).toThrow("Unknown provider type");
    });
  });

  describe("Health Checks", () => {
    it("should get providers health for a shop", async () => {
      mockDb.authProvider.findMany.mockResolvedValueOnce([]);

      const health = await registry.getProvidersHealth("shop-1");
      expect(health).toBeDefined();
      expect(typeof health).toBe("object");
      // At minimum, local provider should be included
      expect(health["local"]).toBeDefined();
      expect(health["local"].healthy).toBe(true);
    });
  });

  describe("Metering", () => {
    it("should record meter event", async () => {
      mockDb.authMeterEvent.create.mockResolvedValueOnce({
        id: "meter-1",
        shopId: "shop-1",
        provider: "local",
        operation: "login",
      });

      await registry.recordMeterEvent("shop-1", "local", "login");

      expect(mockDb.authMeterEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: "shop-1",
          provider: "local",
          operation: "login",
          usedFallback: true,
        }),
      });
    });

    it("should not throw on metering error", async () => {
      mockDb.authMeterEvent.create.mockRejectedValueOnce(new Error("DB error"));

      // Should not throw
      await registry.recordMeterEvent("shop-1", "local", "login");
    });
  });

  describe("Multi-Tenant", () => {
    it("should support different providers for different shops", async () => {
      process.env.AUTH_BYOK = "true";
      const byokRegistry = new AuthProviderRegistry();

      mockDb.authProvider.findFirst
        .mockResolvedValueOnce({
          id: "prov-1",
          provider: "auth0",
          shopId: "shop-1",
          isEnabled: true,
          isDefault: true,
          level: "shop",
          config: { domain: "shop1.auth0.com" },
        })
        .mockResolvedValueOnce({
          id: "prov-2",
          provider: "clerk",
          shopId: "shop-2",
          isEnabled: true,
          isDefault: true,
          level: "shop",
          config: { publishableKey: "pk_123" },
        });

      const provider1 = await byokRegistry.resolveProvider("shop-1");
      const provider2 = await byokRegistry.resolveProvider("shop-2");

      expect(provider1.type).toBe("auth0");
      expect(provider2.type).toBe("clerk");
    });
  });
});
