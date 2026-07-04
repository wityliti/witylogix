/**
 * Test suite for integrations API routes
 * Covers: list integrations, connect/disconnect, credential management, sync triggers, status checks
 */

import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Hoist mock factories so they are available before any import
const { mockPrismaHoisted, mockRegistryHoisted } = vi.hoisted(() => {
  const mockPrismaHoisted = {
    integration: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    integrationApp: {
      upsert: vi.fn(),
    },
    integrationEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  };
  const mockRegistryHoisted = {
    INTEGRATION_REGISTRY: [],
    getIntegrationsByCategory: vi.fn(),
    getIntegrationBySlug: vi.fn(),
    getAvailableIntegrations: vi.fn(),
    searchIntegrations: vi.fn(),
    getIntegrationCounts: vi.fn(() => ({
      total: 20,
      installed: 5,
      available: 15,
    })),
    getAllIntegrationSlugs: vi.fn(),
    maskCredentials: vi.fn((creds: Record<string, unknown>) => creds),
    CATEGORY_LABELS: {
      COMMUNICATION: "Communication",
      ROUTING: "Routing",
      ORDER_MANAGEMENT: "Order Management",
      INVENTORY: "Inventory",
      PAYMENT: "Payment",
      ANALYTICS: "Analytics",
    },
  };
  return { mockPrismaHoisted, mockRegistryHoisted };
});

vi.mock("@witylogix/db", () => ({
  prisma: mockPrismaHoisted,
  Prisma: { JsonNull: null, DbNull: null, AnyNull: null },
}));
vi.mock("@witylogix/core/integrations", () => mockRegistryHoisted);
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: vi.fn(() => async () => {}),
  requireRole: vi.fn((...roles: string[]) => async (req: any) => {
    const role = (req.auth && req.auth.role) || req.userRole;
    if (!role || !roles.includes(role)) {
      const err = new Error(
        "Role '" +
          role +
          "' does not have access. Required: " +
          roles.join(", "),
      );
      err.name = "ForbiddenError";
      throw err;
    }
  }),
}));
vi.mock("../../middleware/tenant.js", () => ({
  tenantContext: vi.fn(() => async () => {}),
}));

import integrationRoutes from "../integrations.js";

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
  shopId: string;
  userId: string;
  userRole: string;
  log: any;
}

interface MockReply extends Partial<FastifyReply> {
  status: (code: number) => MockReply;
  send: (data: any) => MockReply;
}

function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    params: {},
    query: {},
    body: {},
    shopId: "shop-123",
    userId: "user-123",
    userRole: "ADMIN",
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

function createMockReply(overrides: Partial<MockReply> = {}): MockReply {
  const reply: MockReply = {
    statusCode: 200,
    status: vi.fn(function (code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn(function (data: any) {
      return data;
    }),
    ...overrides,
  };
  return reply;
}

const handlers: Record<string, Record<string, Function>> = {};

// Aliases to the hoisted mocks for use in tests
const mockPrisma = mockPrismaHoisted;
const mockRegistry = mockRegistryHoisted;

// Wrap handler to invoke preHandlers before the actual handler
function wrapWithPreHandlers(opts: any, handler?: Function): Function {
  const h = handler || opts;
  const rawPreHandlers =
    typeof opts === "object" && opts.preHandler
      ? Array.isArray(opts.preHandler)
        ? opts.preHandler
        : [opts.preHandler]
      : [];
  // Filter to only valid functions (mocks may return undefined after clearAllMocks)
  const preHandlers: Function[] = rawPreHandlers.filter(
    (p: any) => typeof p === "function",
  );
  return async (request: any, reply: any) => {
    for (const pre of preHandlers) {
      await pre(request, reply);
    }
    return h(request, reply);
  };
}

const createMockFastify = (): Partial<FastifyInstance> => ({
  addHook: vi.fn(),
  get: vi.fn((path: string, opts: any, handler?: Function) => {
    if (!handlers["GET"]) handlers["GET"] = {};
    handlers["GET"][path] = wrapWithPreHandlers(opts, handler);
  }),
  post: vi.fn((path: string, opts: any, handler?: Function) => {
    if (!handlers["POST"]) handlers["POST"] = {};
    handlers["POST"][path] = wrapWithPreHandlers(opts, handler);
  }),
  patch: vi.fn((path: string, opts: any, handler?: Function) => {
    if (!handlers["PATCH"]) handlers["PATCH"] = {};
    handlers["PATCH"][path] = wrapWithPreHandlers(opts, handler);
  }),
  delete: vi.fn((path: string, opts: any, handler?: Function) => {
    if (!handlers["DELETE"]) handlers["DELETE"] = {};
    handlers["DELETE"][path] = wrapWithPreHandlers(opts, handler);
  }),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

describe("Integrations Routes", () => {
  let fastify: Partial<FastifyInstance>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = createMockFastify();

    try {
      await integrationRoutes(fastify as FastifyInstance);
    } catch (err) {
      // Handler registration errors are expected in test context
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET / - List installed integrations", () => {
    it("should list all installed integrations for shop", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      const mockIntegrations = [
        {
          id: "int-1",
          shopId: "shop-123",
          appSlug: "shopify",
          isEnabled: true,
          healthStatus: "HEALTHY",
          lastSyncAt: new Date(),
          lastHealthCheckAt: new Date(),
          installedAt: new Date(),
          updatedAt: new Date(),
          credentials: { apiKey: "***" },
          config: {},
          app: {
            name: "Shopify",
            description: "Shopify integration",
            category: "ORDER_MANAGEMENT",
            logoUrl: "https://example.com/shopify.png",
          },
        },
      ];

      mockPrisma.integration.findMany.mockResolvedValue(mockIntegrations);

      const handler = handlers["GET"]["/"];
      const result = await handler(request, reply);

      expect(result.integrations).toHaveLength(1);
      expect(result.integrations[0].slug).toBe("shopify");
      expect(result.counts).toBeDefined();
    });

    it("should mask credentials in response", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockPrisma.integration.findMany.mockResolvedValue([
        {
          id: "int-1",
          shopId: "shop-123",
          appSlug: "stripe",
          isEnabled: true,
          healthStatus: "HEALTHY",
          lastSyncAt: new Date(),
          lastHealthCheckAt: new Date(),
          installedAt: new Date(),
          updatedAt: new Date(),
          credentials: { apiKey: "sk_live_123456" },
          config: {},
          app: {
            name: "Stripe",
            description: "Payment processor",
            category: "PAYMENT",
            logoUrl: "https://example.com/stripe.png",
          },
        },
      ]);

      mockRegistry.maskCredentials.mockReturnValue({ apiKey: "***" });

      const handler = handlers["GET"]["/"];
      const result = await handler(request, reply);

      expect(result.integrations[0].credentials.apiKey).not.toBe(
        "sk_live_123456",
      );
    });

    it("should return integration counts", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockPrisma.integration.findMany.mockResolvedValue([]);

      const handler = handlers["GET"]["/"];
      const result = await handler(request, reply);

      expect(result.counts.total).toBe(20);
      expect(result.counts.installed).toBe(5);
    });

    it("should order by installedAt descending", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockPrisma.integration.findMany.mockResolvedValue([]);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(mockPrisma.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { installedAt: "desc" },
        }),
      );
    });
  });

  describe("GET /marketplace - Browse integration catalog", () => {
    it("should return all available integrations", async () => {
      const request = createMockRequest({
        query: {},
      });
      const reply = createMockReply();

      const mockApps = [
        {
          slug: "shopify",
          name: "Shopify",
          description: "Shopify integration",
          category: "ORDER_MANAGEMENT",
          status: "AVAILABLE",
        },
        {
          slug: "stripe",
          name: "Stripe",
          description: "Payment processor",
          category: "PAYMENT",
          status: "AVAILABLE",
        },
      ];

      mockRegistry.getAvailableIntegrations.mockReturnValue(mockApps);
      mockPrisma.integration.findMany.mockResolvedValue([
        {
          appSlug: "shopify",
          isEnabled: true,
          healthStatus: "HEALTHY",
        },
      ]);

      const handler = handlers["GET"]["/marketplace"];
      const result = await handler(request, reply);

      expect(result.apps).toHaveLength(2);
      expect(result.apps[0].installed).toBe(true);
      expect(result.apps[1].installed).toBe(false);
      expect(result.categories).toBeDefined();
    });

    it("should filter by category", async () => {
      const request = createMockRequest({
        query: { category: "PAYMENT" },
      });
      const reply = createMockReply();

      mockRegistry.getAvailableIntegrations.mockReturnValue([
        {
          slug: "stripe",
          name: "Stripe",
          category: "PAYMENT",
          status: "AVAILABLE",
        },
      ]);
      mockPrisma.integration.findMany.mockResolvedValue([]);

      const handler = handlers["GET"]["/marketplace"];
      const result = await handler(request, reply);

      expect(mockRegistry.getAvailableIntegrations).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "PAYMENT",
        }),
      );
    });

    it("should filter by status", async () => {
      const request = createMockRequest({
        query: { status: "BETA" },
      });
      const reply = createMockReply();

      mockRegistry.getAvailableIntegrations.mockReturnValue([]);
      mockPrisma.integration.findMany.mockResolvedValue([]);

      const handler = handlers["GET"]["/marketplace"];
      await handler(request, reply);

      expect(mockRegistry.getAvailableIntegrations).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "BETA",
        }),
      );
    });

    it("should support search functionality", async () => {
      const request = createMockRequest({
        query: { search: "stripe" },
      });
      const reply = createMockReply();

      mockRegistry.searchIntegrations.mockReturnValue([
        {
          slug: "stripe",
          name: "Stripe",
          category: "PAYMENT",
          status: "AVAILABLE",
        },
      ]);
      mockPrisma.integration.findMany.mockResolvedValue([]);

      const handler = handlers["GET"]["/marketplace"];
      const result = await handler(request, reply);

      expect(mockRegistry.searchIntegrations).toHaveBeenCalledWith("stripe");
      expect(result.apps).toHaveLength(1);
    });

    it("should filter by subcategory", async () => {
      const request = createMockRequest({
        query: { subcategory: "Email" },
      });
      const reply = createMockReply();

      const mockApps = [
        {
          slug: "sendgrid",
          name: "SendGrid",
          category: "COMMUNICATION",
          subcategory: "Email",
          status: "AVAILABLE",
        },
        {
          slug: "twilio",
          name: "Twilio",
          category: "COMMUNICATION",
          subcategory: "SMS",
          status: "AVAILABLE",
        },
      ];

      mockRegistry.getAvailableIntegrations.mockReturnValue(mockApps);
      mockPrisma.integration.findMany.mockResolvedValue([]);

      const handler = handlers["GET"]["/marketplace"];
      const result = await handler(request, reply);

      expect(result.apps).toHaveLength(1);
      expect(result.apps[0].slug).toBe("sendgrid");
    });
  });

  describe("GET /marketplace/:slug - Get integration details", () => {
    it("should return integration details", async () => {
      const request = createMockRequest({
        params: { slug: "shopify" },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "shopify",
        name: "Shopify",
        description: "Shopify integration",
        category: "ORDER_MANAGEMENT",
      };

      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const handler = handlers["GET"]["/marketplace/:slug"];
      const result = await handler(request, reply);

      expect(result.app).toEqual(mockApp);
      expect(result.installed).toBe(false);
    });

    it("should include installation details if installed", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "stripe",
        name: "Stripe",
        category: "PAYMENT",
      };

      const mockInstallation = {
        isEnabled: true,
        healthStatus: "HEALTHY",
        credentials: { apiKey: "***" },
        config: { testMode: false },
        lastSyncAt: new Date(),
        lastHealthCheckAt: new Date(),
        installedAt: new Date(),
      };

      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.findUnique.mockResolvedValue(mockInstallation);
      mockRegistry.maskCredentials.mockReturnValue({
        apiKey: "***",
      });

      const handler = handlers["GET"]["/marketplace/:slug"];
      const result = await handler(request, reply);

      expect(result.installed).toBe(true);
      expect(result.installation).toBeDefined();
      expect(result.installation.isEnabled).toBe(true);
    });

    it("should return 404 for unknown integration", async () => {
      const request = createMockRequest({
        params: { slug: "unknown" },
      });
      const reply = createMockReply();

      mockRegistry.getIntegrationBySlug.mockReturnValue(null);

      const handler = handlers["GET"]["/marketplace/:slug"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe("POST /:slug/install - Install integration", () => {
    it("should install integration with credentials", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: {
          credentials: { apiKey: "sk_live_123456", publishableKey: "pk_123" },
        },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "stripe",
        name: "Stripe",
        status: "AVAILABLE",
        credentialFields: [
          { key: "apiKey", label: "API Key", required: true },
          { key: "publishableKey", label: "Publishable Key", required: false },
        ],
      };

      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.findUnique.mockResolvedValue(null);
      mockPrisma.integrationApp.upsert.mockResolvedValue({});
      mockPrisma.integration.create.mockResolvedValue({
        id: "int-1",
        appSlug: "stripe",
        isEnabled: true,
        healthStatus: "UNKNOWN",
        installedAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});

      const handler = handlers["POST"]["/:slug/install"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(result.message).toContain("installed successfully");
    });

    it("should reject duplicate installations", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "shopify" },
        body: { credentials: {} },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "shopify",
        name: "Shopify",
        status: "AVAILABLE",
        credentialFields: [],
      };

      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        appSlug: "shopify",
      });

      const handler = handlers["POST"]["/:slug/install"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(409);
    });

    it("should validate required credentials", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: {
          credentials: { publishableKey: "pk_123" },
        },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "stripe",
        name: "Stripe",
        status: "AVAILABLE",
        credentialFields: [
          { key: "apiKey", label: "API Key", required: true },
          { key: "publishableKey", label: "Publishable Key", required: false },
        ],
      };

      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const handler = handlers["POST"]["/:slug/install"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(result.missingFields).toContain("API Key");
    });

    it("should reject COMING_SOON status", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "upcoming" },
        body: { credentials: {} },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "upcoming",
        name: "Upcoming App",
        status: "COMING_SOON",
        credentialFields: [],
      };

      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);

      const handler = handlers["POST"]["/:slug/install"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(result.error).toContain("coming soon");
    });

    it("should reject DEPRECATED status", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "deprecated" },
        body: { credentials: {} },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "deprecated",
        name: "Old App",
        status: "DEPRECATED",
        credentialFields: [],
      };

      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);

      const handler = handlers["POST"]["/:slug/install"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(result.error).toContain("deprecated");
    });

    it("should reject unauthorized users", async () => {
      const request = createMockRequest({
        userRole: "VIEWER",
        params: { slug: "stripe" },
        body: { credentials: {} },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/:slug/install"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should return 404 for unknown integration", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "unknown" },
        body: { credentials: {} },
      });
      const reply = createMockReply();

      mockRegistry.getIntegrationBySlug.mockReturnValue(null);

      const handler = handlers["POST"]["/:slug/install"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe("DELETE /:slug - Uninstall integration", () => {
    it("should uninstall integration", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        appSlug: "stripe",
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});
      mockPrisma.integration.delete.mockResolvedValue({});

      const handler = handlers["DELETE"]["/:slug"];
      const result = await handler(request, reply);

      expect(result.message).toContain("uninstalled successfully");
      expect(mockPrisma.integrationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "UNINSTALL",
          }),
        }),
      );
    });

    it("should return 404 for non-installed integration", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const handler = handlers["DELETE"]["/:slug"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("should reject unauthorized users", async () => {
      const request = createMockRequest({
        userRole: "VIEWER",
        params: { slug: "stripe" },
      });
      const reply = createMockReply();

      const handler = handlers["DELETE"]["/:slug"];

      await expect(handler(request, reply)).rejects.toThrow();
    });
  });

  describe("PATCH /:slug - Update credentials or config", () => {
    it("should update credentials", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: {
          credentials: { apiKey: "sk_live_new" },
        },
      });
      const reply = createMockReply();

      const existing = {
        id: "int-1",
        appSlug: "stripe",
        credentials: { apiKey: "sk_live_old", publishableKey: "pk_123" },
        config: {},
      };

      mockPrisma.integration.findUnique.mockResolvedValue(existing);
      mockPrisma.integration.update.mockResolvedValue({
        appSlug: "stripe",
        isEnabled: true,
        healthStatus: "HEALTHY",
        credentials: { apiKey: "sk_live_new", publishableKey: "pk_123" },
        config: {},
        updatedAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});
      mockRegistry.maskCredentials.mockReturnValue({ apiKey: "***" });

      const handler = handlers["PATCH"]["/:slug"];
      const result = await handler(request, reply);

      expect(result.message).toContain("updated successfully");
      expect(result.integration.slug).toBe("stripe");
    });

    it("should update config", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: {
          config: { testMode: true },
        },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        appSlug: "stripe",
        credentials: {},
        config: { testMode: false },
      });
      mockPrisma.integration.update.mockResolvedValue({
        appSlug: "stripe",
        isEnabled: true,
        config: { testMode: true },
        credentials: {},
        updatedAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});
      mockRegistry.maskCredentials.mockReturnValue({});

      const handler = handlers["PATCH"]["/:slug"];
      const result = await handler(request, reply);

      expect(result.integration.config.testMode).toBe(true);
    });

    it("should enable/disable integration", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: {
          isEnabled: false,
        },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        appSlug: "stripe",
        credentials: {},
        config: {},
        isEnabled: true,
      });
      mockPrisma.integration.update.mockResolvedValue({
        appSlug: "stripe",
        isEnabled: false,
        healthStatus: "HEALTHY",
        credentials: {},
        config: {},
        updatedAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});
      mockRegistry.maskCredentials.mockReturnValue({});

      const handler = handlers["PATCH"]["/:slug"];
      const result = await handler(request, reply);

      expect(result.integration.isEnabled).toBe(false);
    });

    it("should merge credentials on partial update", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: {
          credentials: { publishableKey: "pk_new" },
        },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        credentials: { apiKey: "sk_live_123", publishableKey: "pk_old" },
        config: {},
      });
      mockPrisma.integration.update.mockResolvedValue({
        appSlug: "stripe",
        isEnabled: true,
        credentials: { apiKey: "sk_live_123", publishableKey: "pk_new" },
        config: {},
        updatedAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});
      mockRegistry.maskCredentials.mockReturnValue({ apiKey: "***" });

      const handler = handlers["PATCH"]["/:slug"];
      const result = await handler(request, reply);

      expect(mockPrisma.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            credentials: expect.objectContaining({
              apiKey: "sk_live_123",
              publishableKey: "pk_new",
            }),
          }),
        }),
      );
    });

    it("should return 404 for non-installed integration", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: { credentials: {} },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const handler = handlers["PATCH"]["/:slug"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe("POST /:slug/test - Test connection / health check", () => {
    it("should return healthy status when credentials valid", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "stripe",
        credentialFields: [{ key: "apiKey", required: true }],
      };

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        appSlug: "stripe",
        credentials: { apiKey: "sk_live_123" },
      });
      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.update.mockResolvedValue({
        healthStatus: "HEALTHY",
        lastHealthCheckAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});

      const handler = handlers["POST"]["/:slug/test"];
      const result = await handler(request, reply);

      expect(result.healthy).toBe(true);
      expect(result.healthStatus).toBe("HEALTHY");
    });

    it("should return error status when credentials missing", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "stripe",
        credentialFields: [{ key: "apiKey", required: true }],
      };

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        appSlug: "stripe",
        credentials: {},
      });
      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.update.mockResolvedValue({
        healthStatus: "ERROR",
        lastHealthCheckAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});

      const handler = handlers["POST"]["/:slug/test"];
      const result = await handler(request, reply);

      expect(result.healthy).toBe(false);
      expect(result.healthStatus).toBe("ERROR");
      expect(result.missingRequired).toContain("apiKey");
    });

    it("should update lastHealthCheckAt", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "stripe",
        credentialFields: [],
      };

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        appSlug: "stripe",
        credentials: {},
      });
      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.update.mockResolvedValue({
        healthStatus: "HEALTHY",
        lastHealthCheckAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});

      const handler = handlers["POST"]["/:slug/test"];
      await handler(request, reply);

      expect(mockPrisma.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastHealthCheckAt: expect.any(Date),
          }),
        }),
      );
    });

    it("should return 404 for non-installed integration", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const handler = handlers["POST"]["/:slug/test"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });

    it("should return 404 for unknown integration", async () => {
      const request = createMockRequest({
        params: { slug: "unknown" },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
      });
      mockRegistry.getIntegrationBySlug.mockReturnValue(null);

      const handler = handlers["POST"]["/:slug/test"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  describe("GET /:slug/events - Get integration event log", () => {
    it("should return event log for integration", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
        query: { limit: 50, offset: 0 },
      });
      const reply = createMockReply();

      const mockEvents = [
        {
          id: "evt-1",
          eventType: "INSTALL",
          timestamp: new Date(),
          metadata: {},
        },
        {
          id: "evt-2",
          eventType: "HEALTH_CHECK",
          timestamp: new Date(),
          metadata: { healthy: true },
        },
      ];

      mockPrisma.integrationEvent.findMany.mockResolvedValue(mockEvents);
      mockPrisma.integrationEvent.count.mockResolvedValue(2);

      const handler = handlers["GET"]["/:slug/events"];
      const result = await handler(request, reply);

      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(50);
    });

    it("should filter events by type", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
        query: { limit: 50, offset: 0, eventType: "HEALTH_CHECK" },
      });
      const reply = createMockReply();

      mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
      mockPrisma.integrationEvent.count.mockResolvedValue(0);

      const handler = handlers["GET"]["/:slug/events"];
      await handler(request, reply);

      const callArgs = mockPrisma.integrationEvent.findMany.mock.calls[0][0];
      expect(callArgs.where.eventType).toBe("HEALTH_CHECK");
    });

    it("should support pagination with offset", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
        query: { limit: 25, offset: 50 },
      });
      const reply = createMockReply();

      mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
      mockPrisma.integrationEvent.count.mockResolvedValue(100);

      const handler = handlers["GET"]["/:slug/events"];
      const result = await handler(request, reply);

      expect(mockPrisma.integrationEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 50,
        }),
      );
      expect(result.offset).toBe(50);
    });

    it("should order events by timestamp descending", async () => {
      const request = createMockRequest({
        params: { slug: "stripe" },
        query: { limit: 50, offset: 0 },
      });
      const reply = createMockReply();

      mockPrisma.integrationEvent.findMany.mockResolvedValue([]);
      mockPrisma.integrationEvent.count.mockResolvedValue(0);

      const handler = handlers["GET"]["/:slug/events"];
      await handler(request, reply);

      expect(mockPrisma.integrationEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: "desc" },
        }),
      );
    });
  });

  describe("GET /meter - Unified metering stats", () => {
    it("should return meter statistics", async () => {
      const request = createMockRequest({
        query: {},
      });
      const reply = createMockReply();

      const mockEvents = [
        {
          appSlug: "stripe",
          eventType: "METER",
        },
        {
          appSlug: "shopify",
          eventType: "METER",
        },
        {
          appSlug: "stripe",
          eventType: "METER",
        },
      ];

      mockPrisma.integrationEvent.findMany.mockResolvedValue(mockEvents);

      const handler = handlers["GET"]["/meter"];
      const result = await handler(request, reply);

      expect(result.total).toBe(3);
      expect(result.bySlug.stripe).toBe(2);
      expect(result.bySlug.shopify).toBe(1);
    });

    it("should filter by appSlug", async () => {
      const request = createMockRequest({
        query: { appSlug: "stripe" },
      });
      const reply = createMockReply();

      mockPrisma.integrationEvent.findMany.mockResolvedValue([]);

      const handler = handlers["GET"]["/meter"];
      await handler(request, reply);

      const callArgs = mockPrisma.integrationEvent.findMany.mock.calls[0][0];
      expect(callArgs.where.appSlug).toBe("stripe");
    });

    it("should filter by since timestamp", async () => {
      const request = createMockRequest({
        query: { since: "2026-03-01T00:00:00Z" },
      });
      const reply = createMockReply();

      mockPrisma.integrationEvent.findMany.mockResolvedValue([]);

      const handler = handlers["GET"]["/meter"];
      await handler(request, reply);

      const callArgs = mockPrisma.integrationEvent.findMany.mock.calls[0][0];
      expect(callArgs.where.timestamp).toBeDefined();
      expect(callArgs.where.timestamp.gte).toEqual(
        new Date("2026-03-01T00:00:00Z"),
      );
    });

    it("should return limited events (first 100)", async () => {
      const request = createMockRequest({
        query: {},
      });
      const reply = createMockReply();

      const mockEvents = Array.from({ length: 150 }, (_, i) => ({
        appSlug: "stripe",
        eventType: "METER",
      }));

      mockPrisma.integrationEvent.findMany.mockResolvedValue(mockEvents);

      const handler = handlers["GET"]["/meter"];
      const result = await handler(request, reply);

      expect(result.events).toHaveLength(100);
    });
  });

  describe("Error handling", () => {
    it("should handle database errors", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockPrisma.integration.findMany.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const handler = handlers["GET"]["/"];

      await expect(handler(request, reply)).rejects.toThrow("Database");
    });

    it("should handle invalid JSON in credentials", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: {
          credentials: { apiKey: "".padEnd(5001, "x") },
        },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/:slug/install"];

      // Handler catches ZodError and returns 422 response rather than throwing
      const result = await handler(request, reply);
      expect(reply.status).toHaveBeenCalledWith(422);
    });
  });

  describe("Credential management", () => {
    it("should mask sensitive credentials in list response", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      mockPrisma.integration.findMany.mockResolvedValue([
        {
          id: "int-1",
          appSlug: "stripe",
          credentials: { apiKey: "sk_live_123456789" },
          config: {},
          isEnabled: true,
          healthStatus: "HEALTHY",
          lastSyncAt: new Date(),
          lastHealthCheckAt: new Date(),
          installedAt: new Date(),
          updatedAt: new Date(),
          app: {
            name: "Stripe",
            description: "Payment",
            category: "PAYMENT",
            logoUrl: "https://example.com/stripe.png",
          },
        },
      ]);

      mockRegistry.maskCredentials.mockReturnValue({ apiKey: "***" });

      const handler = handlers["GET"]["/"];
      const result = await handler(request, reply);

      expect(result.integrations[0].credentials.apiKey).toBe("***");
      expect(mockRegistry.maskCredentials).toHaveBeenCalled();
    });

    it("should allow partial credential updates", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: {
          credentials: { apiKey: "sk_live_new" },
        },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        credentials: { apiKey: "sk_live_old", webhookSecret: "ws_123" },
        config: {},
      });
      mockPrisma.integration.update.mockResolvedValue({
        appSlug: "stripe",
        credentials: { apiKey: "sk_live_new", webhookSecret: "ws_123" },
        config: {},
        isEnabled: true,
        healthStatus: "HEALTHY",
        updatedAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});
      mockRegistry.maskCredentials.mockReturnValue({ apiKey: "***" });

      const handler = handlers["PATCH"]["/:slug"];
      const result = await handler(request, reply);

      expect(result.integration.credentials).toBeDefined();
    });
  });

  describe("Sync triggers and status checks", () => {
    it("should record sync events", async () => {
      const request = createMockRequest({
        params: { slug: "shopify" },
      });
      const reply = createMockReply();

      const mockApp = {
        slug: "shopify",
        credentialFields: [],
      };

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        appSlug: "shopify",
        credentials: {},
      });
      mockRegistry.getIntegrationBySlug.mockReturnValue(mockApp);
      mockPrisma.integration.update.mockResolvedValue({
        healthStatus: "HEALTHY",
        lastHealthCheckAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});

      const handler = handlers["POST"]["/:slug/test"];
      await handler(request, reply);

      expect(mockPrisma.integrationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "HEALTH_CHECK",
          }),
        }),
      );
    });

    it("should track integration config updates", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { slug: "stripe" },
        body: { config: { testMode: true } },
      });
      const reply = createMockReply();

      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "int-1",
        credentials: {},
        config: {},
      });
      mockPrisma.integration.update.mockResolvedValue({
        appSlug: "stripe",
        isEnabled: true,
        config: { testMode: true },
        credentials: {},
        updatedAt: new Date(),
      });
      mockPrisma.integrationEvent.create.mockResolvedValue({});
      mockRegistry.maskCredentials.mockReturnValue({});

      const handler = handlers["PATCH"]["/:slug"];
      await handler(request, reply);

      expect(mockPrisma.integrationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "CONFIG_UPDATE",
          }),
        }),
      );
    });
  });
});
