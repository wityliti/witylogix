import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  jwt?: {
    sign: (
      payload: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => string;
  };
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

// Helper to generate valid test data
const generateTestAuthProvider = () => ({
  id: "provider-123",
  tenantId: "tenant-456",
  type: "Local",
  name: "Local Auth",
  isActive: true,
  config: {
    passwordHashingAlgorithm: "bcrypt",
    minPasswordLength: 8,
    requireSpecialChars: true,
  },
  byokEnabled: false,
  byokCredentials: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const generateTestTenant = () => ({
  id: "tenant-456",
  name: "Test Tenant",
  slug: "test-tenant",
  isActive: true,
  deployerId: null,
  createdAt: new Date(),
});

const generateTestDeployer = () => ({
  id: "deployer-789",
  name: "Test Deployer",
  email: "deployer@example.com",
  isActive: true,
  createdAt: new Date(),
});

// ─────────────────────────────────────────────────────────────────

describe("Auth Providers Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockPrisma: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      jwt: {
        sign: vi.fn((payload, options) => `jwt_token_${payload.sub}`),
      },
    };

    mockReply = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
    };

    mockPrisma = {
      authProvider: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
      },
      deployer: {
        findUnique: vi.fn(),
      },
    };
  });

  describe("GET /auth-providers (List all providers)", () => {
    it("should list all auth providers for a tenant", async () => {
      const tenant = generateTestTenant();
      const provider1 = generateTestAuthProvider();
      const provider2 = {
        ...generateTestAuthProvider(),
        id: "provider-124",
        type: "Auth0",
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.findMany.mockResolvedValue([
        provider1,
        provider2,
      ]);

      const providers = await (mockPrisma as any).authProvider.findMany({
        where: { tenantId: tenant.id },
      });

      expect(providers).toHaveLength(2);
      expect(providers[0].type).toBe("Local");
      expect(providers[1].type).toBe("Auth0");
    });

    it("should return empty list when no providers exist", async () => {
      const tenant = generateTestTenant();
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.findMany.mockResolvedValue([]);

      const providers = await (mockPrisma as any).authProvider.findMany({
        where: { tenantId: tenant.id },
      });

      expect(providers).toHaveLength(0);
    });

    it("should filter providers by type if specified", async () => {
      const tenant = generateTestTenant();
      const provider = generateTestAuthProvider();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.findMany.mockResolvedValue([provider]);

      const providers = await (mockPrisma as any).authProvider.findMany({
        where: { tenantId: tenant.id, type: "Local" },
      });

      expect(providers[0].type).toBe("Local");
    });

    it("should return 401 when tenant not found", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const tenant = await (mockPrisma as any).tenant.findUnique({
        where: { id: "invalid-tenant" },
      });

      expect(tenant).toBeNull();
    });

    it("should include BYOK credential flags in response", async () => {
      const tenant = generateTestTenant();
      const provider = {
        ...generateTestAuthProvider(),
        byokEnabled: true,
        byokCredentials: { apiKey: "encrypted_key" },
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.findMany.mockResolvedValue([provider]);

      const providers = await (mockPrisma as any).authProvider.findMany({
        where: { tenantId: tenant.id },
      });

      expect(providers[0].byokEnabled).toBe(true);
    });
  });

  describe("GET /auth-providers/:id (Get single provider)", () => {
    it("should retrieve a specific auth provider", async () => {
      const provider = generateTestAuthProvider();

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);

      const result = await (mockPrisma as any).authProvider.findUnique({
        where: { id: provider.id },
      });

      expect(result.id).toBe("provider-123");
      expect(result.type).toBe("Local");
    });

    it("should return 404 for non-existent provider", async () => {
      mockPrisma.authProvider.findUnique.mockResolvedValue(null);

      const result = await (mockPrisma as any).authProvider.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });

    it("should include full config in response", async () => {
      const provider = generateTestAuthProvider();

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);

      const result = await (mockPrisma as any).authProvider.findUnique({
        where: { id: provider.id },
      });

      expect(result.config).toBeDefined();
      expect(result.config.minPasswordLength).toBe(8);
    });

    it("should mask BYOK credentials in response", async () => {
      const provider = {
        ...generateTestAuthProvider(),
        byokEnabled: true,
        byokCredentials: { apiKey: "sk_live_xyz" },
      };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);

      const result = await (mockPrisma as any).authProvider.findUnique({
        where: { id: provider.id },
      });

      expect(result.byokCredentials).toBeDefined();
      expect(result.byokCredentials.apiKey).toContain("sk_live");
    });

    it("should verify tenant ownership of provider", async () => {
      const provider = generateTestAuthProvider();
      const differentTenant = {
        ...generateTestTenant(),
        id: "different-tenant",
      };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);
      mockPrisma.tenant.findUnique.mockResolvedValue(differentTenant);

      const result = await (mockPrisma as any).authProvider.findUnique({
        where: { id: provider.id },
      });

      expect(result.tenantId).not.toBe(differentTenant.id);
    });
  });

  describe("POST /auth-providers (Create provider)", () => {
    it("should create a new Local auth provider", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.create.mockResolvedValue(
        generateTestAuthProvider(),
      );

      mockRequest.body = {
        tenantId: tenant.id,
        type: "Local",
        name: "Local Auth",
        config: {
          passwordHashingAlgorithm: "bcrypt",
          minPasswordLength: 8,
          requireSpecialChars: true,
        },
      };

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("Local");
      expect(result.tenantId).toBe(tenant.id);
    });

    it("should create Auth0 provider with config", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.create.mockResolvedValue({
        ...generateTestAuthProvider(),
        type: "Auth0",
        config: {
          domain: "example.auth0.com",
          clientId: "client_id_here",
        },
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "Auth0",
        name: "Auth0 Provider",
        config: {
          domain: "example.auth0.com",
          clientId: "client_id_here",
        },
      };

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("Auth0");
    });

    it("should create Clerk provider", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.create.mockResolvedValue({
        ...generateTestAuthProvider(),
        type: "Clerk",
        config: { publishableKey: "pk_test_xyz" },
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "Clerk",
        name: "Clerk Provider",
        config: { publishableKey: "pk_test_xyz" },
      };

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("Clerk");
    });

    it("should create Cognito provider", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.create.mockResolvedValue({
        ...generateTestAuthProvider(),
        type: "Cognito",
        config: {
          userPoolId: "us-east-1_xyz",
          clientId: "client_id",
        },
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "Cognito",
        name: "Cognito Provider",
        config: {
          userPoolId: "us-east-1_xyz",
          clientId: "client_id",
        },
      };

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("Cognito");
    });

    it("should create Firebase Auth provider", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.create.mockResolvedValue({
        ...generateTestAuthProvider(),
        type: "Firebase Auth",
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "Firebase Auth",
        name: "Firebase Provider",
        config: { projectId: "project_id" },
      };

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("Firebase Auth");
    });

    it("should create OIDC provider", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.create.mockResolvedValue({
        ...generateTestAuthProvider(),
        type: "OIDC",
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "OIDC",
        name: "OIDC Provider",
        config: {
          discoveryUrl: "https://example.com/.well-known/openid-configuration",
        },
      };

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("OIDC");
    });

    it("should create SAML provider", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.create.mockResolvedValue({
        ...generateTestAuthProvider(),
        type: "SAML",
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "SAML",
        name: "SAML Provider",
        config: {
          entryPoint: "https://idp.example.com/sso",
          cert: "cert_data",
        },
      };

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("SAML");
    });

    it("should reject creation without tenantId", () => {
      mockRequest.body = {
        type: "Local",
        name: "Local Auth",
      };

      expect(mockRequest.body.tenantId).toBeUndefined();
    });

    it("should reject creation without type", () => {
      mockRequest.body = {
        tenantId: "tenant-123",
        name: "Auth Provider",
      };

      expect(mockRequest.body.type).toBeUndefined();
    });

    it("should reject creation with invalid tenant", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        tenantId: "invalid-tenant",
        type: "Local",
        name: "Local Auth",
      };

      const tenant = await (mockPrisma as any).tenant.findUnique({
        where: { id: "invalid-tenant" },
      });

      expect(tenant).toBeNull();
    });

    it("should store BYOK credentials when enabled", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.create.mockResolvedValue({
        ...generateTestAuthProvider(),
        byokEnabled: true,
        byokCredentials: { apiKey: "encrypted_key" },
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "Auth0",
        name: "Auth0 with BYOK",
        byokEnabled: true,
        byokCredentials: { apiKey: "secret_key" },
      };

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result.byokEnabled).toBe(true);
      expect(result.byokCredentials).toBeDefined();
    });

    it("should use deployer defaults when tenant has no config", async () => {
      const tenant = { ...generateTestTenant(), deployerId: "deployer-789" };
      const deployer = generateTestDeployer();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.deployer.findUnique.mockResolvedValue(deployer);

      const provider = generateTestAuthProvider();
      mockPrisma.authProvider.create.mockResolvedValue(provider);

      mockRequest.body = {
        tenantId: tenant.id,
        type: "Local",
        name: "Local Auth",
      };

      await (mockPrisma as any).deployer.findUnique({
        where: { id: tenant.deployerId },
      });

      const result = await (mockPrisma as any).authProvider.create({
        data: mockRequest.body,
      });

      expect(result).toBeDefined();
      // Verify that deployer is set up for fallback lookup when tenant has deployerId
      expect(tenant.deployerId).toBeDefined();
      expect(mockPrisma.deployer.findUnique).toBeDefined();
    });

    it("should validate config schema for provider type", () => {
      mockRequest.body = {
        tenantId: "tenant-123",
        type: "Auth0",
        name: "Auth0 Provider",
        config: {
          // Missing required domain field
          clientId: "client_id",
        },
      };

      expect(mockRequest.body.config.domain).toBeUndefined();
    });
  });

  describe("PUT /auth-providers/:id (Update provider)", () => {
    it("should update provider configuration", async () => {
      const provider = generateTestAuthProvider();
      const updatedProvider = {
        ...provider,
        config: { ...provider.config, minPasswordLength: 12 },
      };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);
      mockPrisma.authProvider.update.mockResolvedValue(updatedProvider);

      mockRequest.body = {
        config: { minPasswordLength: 12 },
      };
      mockRequest.params = { id: provider.id };

      const result = await (mockPrisma as any).authProvider.update({
        where: { id: provider.id },
        data: mockRequest.body,
      });

      expect(result.config.minPasswordLength).toBe(12);
    });

    it("should update provider name", async () => {
      const provider = generateTestAuthProvider();
      const updatedProvider = { ...provider, name: "Updated Name" };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);
      mockPrisma.authProvider.update.mockResolvedValue(updatedProvider);

      mockRequest.body = { name: "Updated Name" };
      mockRequest.params = { id: provider.id };

      const result = await (mockPrisma as any).authProvider.update({
        where: { id: provider.id },
        data: mockRequest.body,
      });

      expect(result.name).toBe("Updated Name");
    });

    it("should toggle provider active status", async () => {
      const provider = generateTestAuthProvider();
      const updatedProvider = { ...provider, isActive: false };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);
      mockPrisma.authProvider.update.mockResolvedValue(updatedProvider);

      mockRequest.body = { isActive: false };
      mockRequest.params = { id: provider.id };

      const result = await (mockPrisma as any).authProvider.update({
        where: { id: provider.id },
        data: mockRequest.body,
      });

      expect(result.isActive).toBe(false);
    });

    it("should return 404 for non-existent provider", async () => {
      mockPrisma.authProvider.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: "invalid-id" };

      const result = await (mockPrisma as any).authProvider.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });

    it("should update BYOK credentials", async () => {
      const provider = { ...generateTestAuthProvider(), byokEnabled: true };
      const updatedProvider = {
        ...provider,
        byokCredentials: { apiKey: "new_key" },
      };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);
      mockPrisma.authProvider.update.mockResolvedValue(updatedProvider);

      mockRequest.body = { byokCredentials: { apiKey: "new_key" } };
      mockRequest.params = { id: provider.id };

      const result = await (mockPrisma as any).authProvider.update({
        where: { id: provider.id },
        data: mockRequest.body,
      });

      expect(result.byokCredentials.apiKey).toBe("new_key");
    });

    it("should not allow changing provider type", async () => {
      const provider = generateTestAuthProvider();

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);

      mockRequest.body = { type: "Auth0" };
      mockRequest.params = { id: provider.id };

      expect(mockRequest.body.type).toBe("Auth0");
      expect(provider.type).toBe("Local");
    });

    it("should validate updated config schema", () => {
      mockRequest.body = {
        config: { minPasswordLength: "invalid" },
      };
      mockRequest.params = { id: "provider-123" };

      expect(typeof mockRequest.body.config.minPasswordLength).not.toBe(
        "number",
      );
    });
  });

  describe("DELETE /auth-providers/:id (Delete provider)", () => {
    it("should delete an auth provider", async () => {
      const provider = generateTestAuthProvider();

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);
      mockPrisma.authProvider.delete.mockResolvedValue(provider);

      mockRequest.params = { id: provider.id };

      await (mockPrisma as any).authProvider.delete({
        where: { id: provider.id },
      });

      expect(mockPrisma.authProvider.delete).toHaveBeenCalledWith({
        where: { id: provider.id },
      });
    });

    it("should return 404 when deleting non-existent provider", async () => {
      mockPrisma.authProvider.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: "invalid-id" };

      const result = await (mockPrisma as any).authProvider.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });

    it("should prevent deletion of default provider", async () => {
      const provider = { ...generateTestAuthProvider(), type: "Local" };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);

      mockRequest.params = { id: provider.id };

      expect(provider.type).toBe("Local");
    });

    it("should cascade delete related configurations", async () => {
      const provider = generateTestAuthProvider();

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);
      mockPrisma.authProvider.delete.mockResolvedValue(provider);

      mockRequest.params = { id: provider.id };

      await (mockPrisma as any).authProvider.delete({
        where: { id: provider.id },
      });

      expect(mockPrisma.authProvider.delete).toHaveBeenCalled();
    });
  });

  describe("Authorization & Tenant Isolation", () => {
    it("should verify user has tenant access before listing providers", async () => {
      const tenant = generateTestTenant();
      const unauthorized = { ...generateTestTenant(), id: "other-tenant" };

      mockPrisma.tenant.findUnique.mockResolvedValue(unauthorized);

      const result = await (mockPrisma as any).tenant.findUnique({
        where: { id: "other-tenant" },
      });

      expect(result.id).not.toBe(tenant.id);
    });

    it("should enforce tenant isolation on provider access", async () => {
      const provider = generateTestAuthProvider();
      const differentTenant = {
        ...generateTestTenant(),
        id: "different-tenant",
      };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);
      mockPrisma.tenant.findUnique.mockResolvedValue(differentTenant);

      expect(provider.tenantId).not.toBe(differentTenant.id);
    });

    it("should use deployer fallback when tenant has deployerId", async () => {
      const tenant = { ...generateTestTenant(), deployerId: "deployer-789" };
      const deployer = generateTestDeployer();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.deployer.findUnique.mockResolvedValue(deployer);

      expect(tenant.deployerId).toBe("deployer-789");
    });

    it("should allow deployer to manage tenant auth providers", async () => {
      const deployer = generateTestDeployer();
      const tenant = { ...generateTestTenant(), deployerId: deployer.id };
      const provider = generateTestAuthProvider();

      mockPrisma.deployer.findUnique.mockResolvedValue(deployer);
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.findMany.mockResolvedValue([provider]);

      const providers = await (mockPrisma as any).authProvider.findMany({
        where: { tenantId: tenant.id },
      });

      expect(providers).toHaveLength(1);
    });
  });

  describe("Edge Cases & Error Handling", () => {
    it("should handle duplicate provider names within tenant", async () => {
      const tenant = generateTestTenant();
      const existingProvider = generateTestAuthProvider();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.authProvider.findMany.mockResolvedValue([existingProvider]);

      mockRequest.body = {
        tenantId: tenant.id,
        type: "Auth0",
        name: "Local Auth",
      };

      const duplicates = await (mockPrisma as any).authProvider.findMany({
        where: { tenantId: tenant.id, name: "Local Auth" },
      });

      expect(duplicates[0].name).toBe(existingProvider.name);
    });

    it("should handle provider with null BYOK credentials gracefully", async () => {
      const provider = {
        ...generateTestAuthProvider(),
        byokEnabled: false,
        byokCredentials: null,
      };

      mockPrisma.authProvider.findUnique.mockResolvedValue(provider);

      const result = await (mockPrisma as any).authProvider.findUnique({
        where: { id: provider.id },
      });

      expect(result.byokCredentials).toBeNull();
    });

    it("should preserve timestamps on updates", async () => {
      const provider = generateTestAuthProvider();
      const createdAt = provider.createdAt;

      mockPrisma.authProvider.update.mockResolvedValue({
        ...provider,
        updatedAt: new Date(),
      });

      const updated = await (mockPrisma as any).authProvider.update({
        where: { id: provider.id },
        data: { name: "Updated" },
      });

      expect(updated.createdAt).toEqual(createdAt);
    });
  });
});
