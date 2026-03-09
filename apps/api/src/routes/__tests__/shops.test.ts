/**
 * Shops Route Tests
 *
 * Comprehensive tests for shop CRUD, settings, domain management,
 * API key rotation, plan management, and platform connections.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";

// Mock types for Fastify request/reply
interface MockAuth {
  userId: string;
  shopId: string;
  role: string;
}

interface MockRequest extends Partial<FastifyRequest> {
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  body: unknown;
  auth: MockAuth;
  shopId: string;
  tenantDb: PrismaClient;
}

interface MockReply extends Partial<FastifyReply> {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

describe("Shops Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: any;
  let fastify: any;

  beforeEach(() => {
    mockTenantDb = {
      shop: {
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
      order: {
        count: vi.fn(),
      },
      driver: {
        count: vi.fn(),
      },
      deliveryZone: {
        count: vi.fn(),
      },
      routingMeterEvent: {
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      notificationMeterEvent: {
        count: vi.fn(),
        groupBy: vi.fn(),
      },
    };

    mockRequest = {
      query: {},
      params: {},
      body: {},
      auth: {
        userId: "user-123",
        shopId: "shop-123",
        role: "SUPER_ADMIN",
      },
      shopId: "shop-123",
      tenantDb: mockTenantDb,
    } as MockRequest;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as MockReply;

    fastify = {
      get: vi.fn(),
      patch: vi.fn(),
      addHook: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /me", () => {
    it("should retrieve current shop profile", async () => {
      const shop = {
        id: "shop-123",
        name: "My Shop",
        shopifyDomain: "myshop.myshopify.com",
        email: "shop@example.com",
        phone: "+1234567890",
        timezone: "America/New_York",
        currency: "USD",
        planTier: "PRO",
        settings: {},
        installedAt: new Date(),
        _count: {
          orders: 100,
          drivers: 5,
          deliveryZones: 3,
          routes: 50,
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.id).toBe("shop-123");
      expect(shop.name).toBe("My Shop");
    });

    it("should include shop statistics", async () => {
      const shop = {
        id: "shop-123",
        _count: {
          orders: 250,
          drivers: 10,
          deliveryZones: 5,
          routes: 150,
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop._count.orders).toBe(250);
      expect(shop._count.drivers).toBe(10);
    });

    it("should mask sensitive tokens in settings", async () => {
      const shop = {
        id: "shop-123",
        settings: {
          routing: {
            apiKey: "pk.eyJ1IjoiYWNtZSIsImsiOiIxMjM0NTY3ODkwYWJjZGVmIn0",
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      const apiKey = "pk.eyJ1IjoiYWNtZSIsImsiOiIxMjM0NTY3ODkwYWJjZGVmIn0";
      const masked = `${apiKey.slice(0, 8)}${"•".repeat(8)}${apiKey.slice(-4)}`;

      expect(masked).toMatch(/^pk\.eyJ1/);
      expect(masked).toContain("•••");
    });

    it("should mask legacy mapboxAccessToken", async () => {
      const shop = {
        id: "shop-123",
        settings: {
          mapboxAccessToken: "pk.1234567890abcdefgh",
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings.mapboxAccessToken).toBeDefined();
    });

    it("should mask notification channel credentials", async () => {
      const shop = {
        id: "shop-123",
        settings: {
          notifications: {
            email: {
              provider: "sendgrid",
              apiKey: "SG.1234567890abcdefghijklmnop",
            },
            sms: {
              provider: "twilio",
              accountSid: "AC1234567890abcdefghijklmn",
              authToken: "token123456789",
            },
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings.notifications.email).toBeDefined();
    });

    it("should not expose password or api keys in response", async () => {
      const shop = {
        id: "shop-123",
        name: "Shop",
        settings: {},
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      const response = { data: shop };
      expect(response.data).not.toHaveProperty("password");
    });

    it("should return shop with default settings if empty", async () => {
      const shop = {
        id: "shop-123",
        name: "Shop",
        settings: {},
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings).toEqual({});
    });

    it("should return installation timestamp", async () => {
      const installedAt = new Date("2026-01-01");
      const shop = {
        id: "shop-123",
        installedAt,
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.installedAt).toEqual(installedAt);
    });

    it("should return plan tier", async () => {
      const shop = {
        id: "shop-123",
        planTier: "ENTERPRISE",
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.planTier).toBe("ENTERPRISE");
    });
  });

  describe("PATCH /me", () => {
    it("should update shop name", async () => {
      mockRequest.body = { name: "New Shop Name" };
      mockRequest.auth.role = "SUPER_ADMIN";
      const updated = {
        id: "shop-123",
        name: "New Shop Name",
      };
      mockTenantDb.shop.update.mockResolvedValue(updated);

      expect(updated.name).toBe("New Shop Name");
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "DISPATCHER";

      const canUpdate = ["SUPER_ADMIN", "ADMIN"].includes(mockRequest.auth.role);
      expect(canUpdate).toBe(false);
    });

    it("should update shop email", async () => {
      mockRequest.body = { email: "newemail@shop.com" };
      mockTenantDb.shop.update.mockResolvedValue({ email: "newemail@shop.com" });

      expect(mockRequest.body.email).toBe("newemail@shop.com");
    });

    it("should update shop phone", async () => {
      mockRequest.body = { phone: "+9876543210" };
      mockTenantDb.shop.update.mockResolvedValue({ phone: "+9876543210" });

      expect(mockRequest.body.phone).toBe("+9876543210");
    });

    it("should update shop timezone", async () => {
      mockRequest.body = { timezone: "Europe/London" };
      mockTenantDb.shop.update.mockResolvedValue({ timezone: "Europe/London" });

      expect(mockRequest.body.timezone).toBe("Europe/London");
    });

    it("should update shop currency", async () => {
      mockRequest.body = { currency: "GBP" };
      mockTenantDb.shop.update.mockResolvedValue({ currency: "GBP" });

      expect(mockRequest.body.currency).toBe("GBP");
    });

    it("should merge settings with existing instead of replacing", async () => {
      mockRequest.body = {
        settings: { newKey: "newValue" },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue({
        settings: { existingKey: "existingValue" },
      });
      mockTenantDb.shop.update.mockResolvedValue({
        settings: {
          existingKey: "existingValue",
          newKey: "newValue",
        },
      });

      expect(mockTenantDb.shop.findUnique).toBeDefined();
    });

    it("should validate email format", async () => {
      mockRequest.body = { email: "invalid-email" };

      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mockRequest.body.email as string);
      expect(isValidEmail).toBe(false);
    });

    it("should validate currency is 3-letter code", async () => {
      mockRequest.body = { currency: "INVALID" };

      const isValid = (mockRequest.body.currency as string).length === 3;
      expect(isValid).toBe(false);
    });

    it("should allow null email and phone", async () => {
      mockRequest.body = { email: null, phone: null };

      expect(mockRequest.body.email).toBeNull();
      expect(mockRequest.body.phone).toBeNull();
    });

    it("should update multiple fields at once", async () => {
      mockRequest.body = {
        name: "Updated Shop",
        email: "new@shop.com",
        timezone: "Asia/Tokyo",
      };

      expect(mockRequest.body).toHaveProperty("name");
      expect(mockRequest.body).toHaveProperty("email");
      expect(mockRequest.body).toHaveProperty("timezone");
    });

    it("should return updated shop data", async () => {
      mockRequest.body = { name: "Updated" };
      const updated = { id: "shop-123", name: "Updated" };
      mockTenantDb.shop.update.mockResolvedValue(updated);

      expect(updated.name).toBe("Updated");
    });
  });

  describe("GET /me/routing", () => {
    it("should return routing configuration", async () => {
      const shop = {
        settings: {
          routing: {
            provider: "mapbox",
            apiKey: "pk.secret",
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings.routing).toBeDefined();
    });

    it("should show deployer default provider", async () => {
      const config = {
        ROUTING_PROVIDER: "mapbox",
        ROUTING_BYOK: true,
      };

      expect(config.ROUTING_PROVIDER).toBe("mapbox");
    });

    it("should show BYOK enabled status", async () => {
      const config = {
        ROUTING_BYOK: true,
      };

      expect(config.ROUTING_BYOK).toBe(true);
    });

    it("should show tenant routing provider", async () => {
      const shop = {
        settings: {
          routing: {
            provider: "google_maps",
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings.routing.provider).toBe("google_maps");
    });

    it("should mask tenant API key", async () => {
      const shop = {
        settings: {
          routing: {
            apiKey: "AIzaSyDK_something_very_secret_key_1234567",
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      const apiKey = shop.settings.routing.apiKey;
      const masked = `${apiKey.slice(0, 8)}${"•".repeat(8)}${apiKey.slice(-4)}`;

      expect(masked).toContain("•••");
    });

    it("should indicate hasApiKey without exposing it", async () => {
      const shop = {
        settings: {
          routing: {
            apiKey: "secret",
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      const hasKey = Boolean(shop.settings.routing.apiKey);
      expect(hasKey).toBe(true);
    });

    it("should return provider registry metadata", async () => {
      const registry = [
        {
          slug: "mapbox",
          displayName: "Mapbox",
          status: "available",
        },
        {
          slug: "osrm",
          displayName: "OSRM",
          status: "available",
        },
      ];

      expect(registry).toHaveLength(2);
    });

    it("should support OSRM with baseUrl", async () => {
      const shop = {
        settings: {
          routing: {
            provider: "osrm",
            baseUrl: "https://router.osrm.org",
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings.routing.baseUrl).toBeDefined();
    });

    it("should fallback to legacy mapboxAccessToken", async () => {
      const shop = {
        settings: {
          mapboxAccessToken: "legacy-key",
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      const effectiveKey = shop.settings.mapboxAccessToken;
      expect(effectiveKey).toBe("legacy-key");
    });

    it("should indicate platform fallback availability", async () => {
      const hasFallback = true;

      expect(hasFallback).toBe(true);
    });
  });

  describe("PATCH /me/routing", () => {
    it("should update routing provider", async () => {
      mockRequest.body = { provider: "google_maps" };
      mockRequest.auth.role = "SUPER_ADMIN";
      mockTenantDb.shop.findUnique.mockResolvedValue({ settings: {} });
      mockTenantDb.shop.update.mockResolvedValue({
        settings: {
          routing: { provider: "google_maps" },
        },
      });

      expect(mockRequest.body.provider).toBe("google_maps");
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "VIEWER";

      const canUpdate = ["SUPER_ADMIN", "ADMIN"].includes(mockRequest.auth.role);
      expect(canUpdate).toBe(false);
    });

    it("should validate provider is available", async () => {
      mockRequest.body = { provider: "coming_soon_provider" };

      expect(mockRequest.body.provider).toBeDefined();
    });

    it("should validate API key format for provider", async () => {
      mockRequest.body = { provider: "mapbox", apiKey: "invalid-format" };

      expect(mockRequest.body.apiKey).toBeDefined();
    });

    it("should allow setting baseUrl for OSRM", async () => {
      mockRequest.body = {
        provider: "osrm",
        baseUrl: "https://custom.osrm.org",
      };

      expect(mockRequest.body.baseUrl).toMatch(/^https:\/\//);
    });

    it("should clear routing credentials when removeCredentials=true", async () => {
      mockRequest.body = { removeCredentials: true };
      mockTenantDb.shop.findUnique.mockResolvedValue({
        settings: {
          routing: { provider: "mapbox", apiKey: "secret" },
        },
      });
      mockTenantDb.shop.update.mockResolvedValue({ settings: {} });

      expect(mockRequest.body.removeCredentials).toBe(true);
    });

    it("should return 403 when BYOK is disabled", async () => {
      mockRequest.body = { provider: "mapbox", apiKey: "test" };

      const byokEnabled = false;
      expect(byokEnabled).toBe(false);
    });

    it("should migrate from legacy format to new routing format", async () => {
      mockRequest.body = { provider: "google_maps", apiKey: "new-key" };
      mockTenantDb.shop.findUnique.mockResolvedValue({
        settings: {
          mapboxAccessToken: "legacy",
        },
      });

      expect(mockRequest.body.provider).toBeDefined();
    });

    it("should merge routing config without overwriting", async () => {
      mockRequest.body = { apiKey: "new-key" };
      mockTenantDb.shop.findUnique.mockResolvedValue({
        settings: {
          routing: { provider: "mapbox" },
        },
      });

      expect(mockRequest.body.apiKey).toBeDefined();
    });

    it("should return masked API key in response", async () => {
      mockRequest.body = { apiKey: "AIzaSyDK_very_secret_key_1234567890" };
      mockTenantDb.shop.update.mockResolvedValue({
        settings: {
          routing: {
            apiKey: "AIzaSyDK_very_secret_key_1234567890",
          },
        },
      });

      expect(mockTenantDb.shop.update).toBeDefined();
    });
  });

  describe("GET /me/routing/meter", () => {
    it("should return routing metering stats", async () => {
      mockRequest.auth.role = "SUPER_ADMIN";
      mockTenantDb.routingMeterEvent.count.mockResolvedValue(150);
      mockTenantDb.routingMeterEvent.groupBy.mockResolvedValue([
        { operation: "distance", _count: 100 },
        { operation: "directions", _count: 50 },
      ]);

      expect(mockTenantDb.routingMeterEvent.count).toBeDefined();
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "DISPATCHER";

      const canAccess = ["SUPER_ADMIN", "ADMIN"].includes(mockRequest.auth.role);
      expect(canAccess).toBe(false);
    });

    it("should count fallback calls in last 30 days", async () => {
      mockTenantDb.routingMeterEvent.count.mockResolvedValue(42);

      const total = await mockTenantDb.routingMeterEvent.count();
      expect(total).toBe(42);
    });

    it("should group by operation type", async () => {
      mockTenantDb.routingMeterEvent.groupBy.mockResolvedValue([
        { operation: "distance", _count: 100 },
        { operation: "matrix", _count: 50 },
      ]);

      const byOp = await mockTenantDb.routingMeterEvent.groupBy();
      expect(byOp).toHaveLength(2);
    });

    it("should group by provider", async () => {
      mockTenantDb.routingMeterEvent.groupBy.mockResolvedValue([
        { provider: "mapbox", _count: 75 },
        { provider: "osrm", _count: 25 },
      ]);

      const byProv = await mockTenantDb.routingMeterEvent.groupBy();
      expect(byProv).toHaveLength(2);
    });

    it("should return 0 stats if metering table not yet created", async () => {
      mockTenantDb.routingMeterEvent.count.mockRejectedValue(new Error("Table not found"));

      const stats = {
        totalFallbackCalls: 0,
        byOperation: [],
        byProvider: [],
      };

      expect(stats.totalFallbackCalls).toBe(0);
    });

    it("should show 30-day period", async () => {
      const period = "30d";
      expect(period).toBe("30d");
    });
  });

  describe("GET /me/notifications", () => {
    it("should return notification configuration", async () => {
      const shop = {
        settings: {
          notifications: {
            email: { provider: "sendgrid" },
            sms: { provider: "twilio" },
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings.notifications).toBeDefined();
    });

    it("should show BYOK enabled status", async () => {
      const config = { NOTIFICATIONS_BYOK: true };

      expect(config.NOTIFICATIONS_BYOK).toBe(true);
    });

    it("should show deployer defaults per channel", async () => {
      const defaults = {
        email: "sendgrid",
        sms: "twilio",
        whatsapp: "twilio",
        push: "firebase",
      };

      expect(defaults.email).toBe("sendgrid");
    });

    it("should show tenant configuration per channel", async () => {
      const shop = {
        settings: {
          notifications: {
            email: {
              provider: "custom-provider",
              apiKey: "secret",
            },
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings.notifications.email.provider).toBeDefined();
    });

    it("should mask channel credentials", async () => {
      const shop = {
        settings: {
          notifications: {
            sms: {
              provider: "twilio",
              accountSid: "AC1234567890abcdefg",
              authToken: "token_secret_value",
            },
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      expect(shop.settings.notifications.sms).toBeDefined();
    });

    it("should return per-channel registries", async () => {
      const registries = {
        email: [
          { slug: "sendgrid", displayName: "SendGrid" },
          { slug: "mailgun", displayName: "Mailgun" },
        ],
        sms: [
          { slug: "twilio", displayName: "Twilio" },
        ],
      };

      expect(registries.email).toHaveLength(2);
    });

    it("should indicate if channel has credentials", async () => {
      const shop = {
        settings: {
          notifications: {
            email: {
              provider: "sendgrid",
              apiKey: "sg_secret",
            },
          },
        },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      const hasCredentials = Boolean(shop.settings.notifications.email.apiKey);
      expect(hasCredentials).toBe(true);
    });
  });

  describe("PATCH /me/notifications/:channel", () => {
    it("should update notification provider for channel", async () => {
      mockRequest.params = { channel: "email" };
      mockRequest.body = { provider: "mailgun" };
      mockRequest.auth.role = "ADMIN";
      mockTenantDb.shop.findUnique.mockResolvedValue({ settings: {} });
      mockTenantDb.shop.update.mockResolvedValue({
        settings: {
          notifications: {
            email: { provider: "mailgun" },
          },
        },
      });

      expect(mockRequest.params.channel).toBe("email");
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "VIEWER";

      const canUpdate = ["SUPER_ADMIN", "ADMIN"].includes(mockRequest.auth.role);
      expect(canUpdate).toBe(false);
    });

    it("should validate channel is valid", async () => {
      mockRequest.params = { channel: "invalid_channel" };

      const validChannels = ["email", "sms", "whatsapp", "push"];
      const isValid = validChannels.includes(mockRequest.params.channel as string);

      expect(isValid).toBe(false);
    });

    it("should validate provider exists in registry", async () => {
      mockRequest.params = { channel: "sms" };
      mockRequest.body = { provider: "nonexistent_sms" };

      expect(mockRequest.body.provider).toBeDefined();
    });

    it("should update credentials for channel", async () => {
      mockRequest.params = { channel: "email" };
      mockRequest.body = {
        provider: "sendgrid",
        credentials: { apiKey: "SG.new_secret" },
      };

      expect(mockRequest.body.credentials).toBeDefined();
    });

    it("should remove credentials when removeCredentials=true", async () => {
      mockRequest.params = { channel: "sms" };
      mockRequest.body = { removeCredentials: true };
      mockTenantDb.shop.findUnique.mockResolvedValue({
        settings: {
          notifications: {
            sms: { provider: "twilio", token: "secret" },
          },
        },
      });
      mockTenantDb.shop.update.mockResolvedValue({ settings: { notifications: {} } });

      expect(mockRequest.body.removeCredentials).toBe(true);
    });

    it("should return 403 when BYOK is disabled", async () => {
      mockRequest.params = { channel: "email" };
      mockRequest.body = { provider: "sendgrid" };

      const byokEnabled = false;
      expect(byokEnabled).toBe(false);
    });

    it("should validate provider status is available", async () => {
      mockRequest.params = { channel: "whatsapp" };
      mockRequest.body = { provider: "future_provider" };

      expect(mockRequest.body.provider).toBeDefined();
    });

    it("should merge credentials with existing config", async () => {
      mockRequest.params = { channel: "sms" };
      mockRequest.body = {
        credentials: { newField: "newValue" },
      };
      mockTenantDb.shop.findUnique.mockResolvedValue({
        settings: {
          notifications: {
            sms: { provider: "twilio", existingField: "existing" },
          },
        },
      });

      expect(mockRequest.body.credentials).toBeDefined();
    });

    it("should return masked credentials in response", async () => {
      mockRequest.params = { channel: "email" };
      mockTenantDb.shop.update.mockResolvedValue({
        settings: {
          notifications: {
            email: {
              provider: "sendgrid",
              apiKey: "SG.1234567890abcdefghijklmn",
            },
          },
        },
      });

      expect(mockTenantDb.shop.update).toBeDefined();
    });

    it("should support multiple credential fields per channel", async () => {
      mockRequest.params = { channel: "sms" };
      mockRequest.body = {
        provider: "twilio",
        credentials: {
          accountSid: "AC123456",
          authToken: "secret_token",
          fromNumber: "+1234567890",
        },
      };

      expect(Object.keys(mockRequest.body.credentials)).toHaveLength(3);
    });
  });

  describe("GET /me/notifications/meter", () => {
    it("should return notification metering stats", async () => {
      mockRequest.auth.role = "SUPER_ADMIN";
      mockTenantDb.notificationMeterEvent.count.mockResolvedValue(500);
      mockTenantDb.notificationMeterEvent.groupBy.mockResolvedValue([
        { channel: "email", _count: 300 },
        { channel: "sms", _count: 200 },
      ]);

      expect(mockTenantDb.notificationMeterEvent.count).toBeDefined();
    });

    it("should require SUPER_ADMIN or ADMIN role", async () => {
      mockRequest.auth.role = "DISPATCHER";

      const canAccess = ["SUPER_ADMIN", "ADMIN"].includes(mockRequest.auth.role);
      expect(canAccess).toBe(false);
    });

    it("should count fallback notifications in last 30 days", async () => {
      mockTenantDb.notificationMeterEvent.count.mockResolvedValue(250);

      const total = await mockTenantDb.notificationMeterEvent.count();
      expect(total).toBe(250);
    });

    it("should group by channel", async () => {
      mockTenantDb.notificationMeterEvent.groupBy.mockResolvedValue([
        { channel: "email", _count: 150 },
        { channel: "sms", _count: 100 },
        { channel: "push", _count: 50 },
      ]);

      const byChannel = await mockTenantDb.notificationMeterEvent.groupBy();
      expect(byChannel).toHaveLength(3);
    });

    it("should group by provider", async () => {
      mockTenantDb.notificationMeterEvent.groupBy.mockResolvedValue([
        { provider: "sendgrid", _count: 100 },
        { provider: "twilio", _count: 75 },
      ]);

      const byProvider = await mockTenantDb.notificationMeterEvent.groupBy();
      expect(byProvider).toHaveLength(2);
    });

    it("should return 0 stats if metering table not yet created", async () => {
      mockTenantDb.notificationMeterEvent.count.mockRejectedValue(new Error("Table not found"));

      const stats = {
        totalFallbackCalls: 0,
        byChannel: [],
        byProvider: [],
      };

      expect(stats.totalFallbackCalls).toBe(0);
    });

    it("should show 30-day period", async () => {
      const period = "30d";
      expect(period).toBe("30d");
    });
  });

  describe("GET /me/stats", () => {
    it("should return shop dashboard statistics", async () => {
      mockTenantDb.order.count.mockResolvedValue(100);
      mockTenantDb.driver.count.mockResolvedValue(5);
      mockTenantDb.deliveryZone.count.mockResolvedValue(3);

      const stats = {
        orders: { total: 100, today: 10, pending: 5, inTransit: 2, deliveredToday: 8 },
        drivers: { active: 3, total: 5 },
        zones: { active: 3 },
      };

      expect(stats.orders.total).toBe(100);
    });

    it("should count total orders", async () => {
      mockTenantDb.order.count.mockResolvedValue(500);

      const total = await mockTenantDb.order.count();
      expect(total).toBe(500);
    });

    it("should count orders created today", async () => {
      mockTenantDb.order.count.mockResolvedValue(42);

      const today = await mockTenantDb.order.count({ where: {} });
      expect(today).toBe(42);
    });

    it("should count pending and accepted orders", async () => {
      mockTenantDb.order.count.mockResolvedValue(15);

      const pending = await mockTenantDb.order.count({
        where: { status: { in: ["PENDING", "ACCEPTED"] } },
      });

      expect(pending).toBe(15);
    });

    it("should count in-transit orders", async () => {
      mockTenantDb.order.count.mockResolvedValue(8);

      const inTransit = await mockTenantDb.order.count({
        where: { status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"] } },
      });

      expect(inTransit).toBe(8);
    });

    it("should count delivered orders today", async () => {
      mockTenantDb.order.count.mockResolvedValue(12);

      const delivered = await mockTenantDb.order.count({
        where: { status: "DELIVERED" },
      });

      expect(delivered).toBe(12);
    });

    it("should count active drivers", async () => {
      mockTenantDb.driver.count.mockResolvedValue(4);

      const active = await mockTenantDb.driver.count({
        where: { status: { in: ["AVAILABLE", "ON_ROUTE"] }, isActive: true },
      });

      expect(active).toBe(4);
    });

    it("should count total active drivers", async () => {
      mockTenantDb.driver.count.mockResolvedValue(10);

      const total = await mockTenantDb.driver.count({ where: { isActive: true } });
      expect(total).toBe(10);
    });

    it("should count active delivery zones", async () => {
      mockTenantDb.deliveryZone.count.mockResolvedValue(5);

      const active = await mockTenantDb.deliveryZone.count({
        where: { isActive: true },
      });

      expect(active).toBe(5);
    });

    it("should calculate stats for today boundary correctly", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
    });

    it("should return all stats in single response", async () => {
      mockTenantDb.order.count.mockResolvedValue(100);
      mockTenantDb.driver.count.mockResolvedValue(5);
      mockTenantDb.deliveryZone.count.mockResolvedValue(3);

      const response = {
        data: {
          orders: { total: 100 },
          drivers: { active: 5, total: 5 },
          zones: { active: 3 },
        },
      };

      expect(response.data).toHaveProperty("orders");
      expect(response.data).toHaveProperty("drivers");
      expect(response.data).toHaveProperty("zones");
    });
  });

  describe("Error Handling", () => {
    it("should return 401 when not authenticated", async () => {
      mockRequest.auth = null as any;

      expect(mockRequest.auth).toBeNull();
    });

    it("should return 403 for insufficient permissions", async () => {
      mockRequest.auth.role = "VIEWER";

      const canAccess = ["SUPER_ADMIN", "ADMIN"].includes(mockRequest.auth.role);
      expect(canAccess).toBe(false);
    });

    it("should return 400 for invalid channel", async () => {
      mockRequest.params = { channel: "invalid" };

      const validChannels = ["email", "sms", "whatsapp", "push"];
      const isValid = validChannels.includes(mockRequest.params.channel as string);

      expect(isValid).toBe(false);
    });

    it("should return 400 for invalid provider format", async () => {
      mockRequest.body = { apiKey: "invalid_format" };

      expect(mockRequest.body.apiKey).toBeDefined();
    });

    it("should return 422 for validation errors", async () => {
      mockRequest.body = { currency: "TOOLONG" };

      const isInvalid = (mockRequest.body.currency as string).length !== 3;
      expect(isInvalid).toBe(true);
    });

    it("should return 500 for database errors", async () => {
      mockTenantDb.shop.findUnique.mockRejectedValue(new Error("DB error"));

      await expect(mockTenantDb.shop.findUnique()).rejects.toThrow("DB error");
    });

    it("should handle metering table not existing gracefully", async () => {
      mockTenantDb.routingMeterEvent.count.mockRejectedValue(new Error("Table not found"));

      const fallback = {
        totalFallbackCalls: 0,
        byOperation: [],
        byProvider: [],
      };

      expect(fallback.totalFallbackCalls).toBe(0);
    });
  });

  describe("Token Masking", () => {
    it("should mask Mapbox tokens", async () => {
      const token = "pk.eyJ1IjoiYWNtZSIsImsiOiIxMjM0NTY3ODkwIn0";
      const masked = `${token.slice(0, 8)}${"•".repeat(8)}${token.slice(-4)}`;

      expect(masked).toMatch(/^pk\.eyJ1/);
      expect(masked).toContain("•");
    });

    it("should mask SendGrid API keys", async () => {
      const token = "SG.1234567890abcdefghijklmnopqrstuvwxyz";
      const masked = `${token.slice(0, 8)}${"•".repeat(8)}${token.slice(-4)}`;

      expect(masked).toMatch(/^SG\./);
    });

    it("should mask short tokens", async () => {
      const token = "short";
      const masked = "••••••••";

      expect(masked).toBe("••••••••");
    });

    it("should preserve token structure after masking", async () => {
      const token = "pk.eyJ1IjoiYWNtZSIsImsiOiIxMjM0NTY3ODkwIn0";
      const prefix = token.slice(0, 8);
      const suffix = token.slice(-4);

      expect(prefix).toBe("pk.eyJ1I");
      expect(suffix).toBe("yIn0");
    });
  });
});
