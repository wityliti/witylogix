/**
 * Integrations Module Test Suite
 *
 * Tests for:
 * - Integration registry: register, unregister, lookup
 * - Resolver: resolve integration by type/source
 * - Metering: usage tracking, quota checks
 * - Compatibility: version checks, feature flags
 * - Categories: integration categorization
 */

import {
  INTEGRATION_REGISTRY,
  getIntegrationsByCategory,
  getIntegrationBySlug,
  getAvailableIntegrations,
  searchIntegrations,
  getIntegrationCounts,
  getAllIntegrationSlugs,
  resolveIntegration,
  resolveByCategory,
  maskCredentials,
  onIntegrationMeter,
  emitIntegrationEvent,
  CATEGORY_LABELS,
  type IntegrationAppMeta,
  type IntegrationCategory,
  type IntegrationEvent,
} from "../index";

describe("Integration Registry", () => {
  describe("getIntegrationsByCategory", () => {
    it("should return all integrations for COMMUNICATION category", () => {
      const comms = getIntegrationsByCategory("COMMUNICATION");
      expect(comms.length).toBeGreaterThan(0);
      expect(comms.every((app) => app.category === "COMMUNICATION")).toBe(true);
    });

    it("should return integrations for ROUTING category", () => {
      const routing = getIntegrationsByCategory("ROUTING");
      expect(routing.length).toBeGreaterThan(0);
      expect(routing.every((app) => app.category === "ROUTING")).toBe(true);
    });

    it("should return integrations for ORDER_MANAGEMENT category", () => {
      const orders = getIntegrationsByCategory("ORDER_MANAGEMENT");
      expect(orders.length).toBeGreaterThan(0);
      expect(orders.every((app) => app.category === "ORDER_MANAGEMENT")).toBe(true);
    });

    it("should return integrations for INVENTORY category", () => {
      const inventory = getIntegrationsByCategory("INVENTORY");
      expect(inventory.length).toBeGreaterThan(0);
      expect(inventory.every((app) => app.category === "INVENTORY")).toBe(true);
    });

    it("should return integrations for PAYMENT category", () => {
      const payment = getIntegrationsByCategory("PAYMENT");
      expect(payment.length).toBeGreaterThan(0);
      expect(payment.every((app) => app.category === "PAYMENT")).toBe(true);
    });

    it("should return integrations for ANALYTICS category", () => {
      const analytics = getIntegrationsByCategory("ANALYTICS");
      expect(analytics.length).toBeGreaterThan(0);
      expect(analytics.every((app) => app.category === "ANALYTICS")).toBe(true);
    });

    it("should filter by subcategory when provided", () => {
      const emailIntegrations = getIntegrationsByCategory("COMMUNICATION", "email");
      const allComms = getIntegrationsByCategory("COMMUNICATION");

      expect(emailIntegrations.length).toBeGreaterThan(0);
      expect(emailIntegrations.length).toBeLessThanOrEqual(allComms.length);
      expect(emailIntegrations.every((app) => app.subcategory === "email")).toBe(true);
    });

    it("should return empty array for invalid subcategory", () => {
      const invalid = getIntegrationsByCategory("COMMUNICATION", "invalid_subcategory");
      expect(invalid).toEqual([]);
    });
  });

  describe("getIntegrationBySlug", () => {
    it("should return integration metadata by slug", () => {
      const sendgrid = getIntegrationBySlug("sendgrid");
      expect(sendgrid).toBeDefined();
      expect(sendgrid?.slug).toBe("sendgrid");
      expect(sendgrid?.category).toBe("COMMUNICATION");
    });

    it("should return undefined for unknown slug", () => {
      const unknown = getIntegrationBySlug("unknown_integration");
      expect(unknown).toBeUndefined();
    });

    it("should return all required fields", () => {
      const app = getIntegrationBySlug("sendgrid");
      expect(app).toHaveProperty("slug");
      expect(app).toHaveProperty("name");
      expect(app).toHaveProperty("description");
      expect(app).toHaveProperty("category");
      expect(app).toHaveProperty("authType");
      expect(app).toHaveProperty("credentialFields");
      expect(app).toHaveProperty("capabilities");
      expect(app).toHaveProperty("status");
      expect(app).toHaveProperty("version");
    });
  });

  describe("getAvailableIntegrations", () => {
    it("should return only non-deprecated integrations by default", () => {
      const available = getAvailableIntegrations();
      expect(available.every((app) => app.status !== "DEPRECATED")).toBe(true);
    });

    it("should filter by status when provided", () => {
      const betaApps = getAvailableIntegrations({ status: "BETA" });
      expect(betaApps.every((app) => app.status === "BETA")).toBe(true);
    });

    it("should filter by category when provided", () => {
      const availableComms = getAvailableIntegrations({ category: "COMMUNICATION" });
      expect(availableComms.every((app) => app.category === "COMMUNICATION")).toBe(true);
      expect(availableComms.every((app) => app.status !== "DEPRECATED")).toBe(true);
    });

    it("should combine status and category filters", () => {
      const filtered = getAvailableIntegrations({
        status: "AVAILABLE",
        category: "COMMUNICATION",
      });
      expect(filtered.every((app) => app.status === "AVAILABLE")).toBe(true);
      expect(filtered.every((app) => app.category === "COMMUNICATION")).toBe(true);
    });
  });

  describe("searchIntegrations", () => {
    it("should return all integrations for empty query", () => {
      const allApps = searchIntegrations("");
      expect(allApps.length).toBeGreaterThan(0);
    });

    it("should search by slug", () => {
      const results = searchIntegrations("sendgrid");
      expect(results.some((app) => app.slug === "sendgrid")).toBe(true);
    });

    it("should search by name case-insensitively", () => {
      const results = searchIntegrations("firebase");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((app) => app.name.toLowerCase().includes("firebase"))).toBe(true);
    });

    it("should search by description", () => {
      const results = searchIntegrations("delivery");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should search by capability", () => {
      const results = searchIntegrations("sms");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should search by subcategory", () => {
      const results = searchIntegrations("email");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should be case-insensitive", () => {
      const lowerResults = searchIntegrations("sendgrid");
      const upperResults = searchIntegrations("SENDGRID");
      expect(lowerResults.length).toBe(upperResults.length);
    });
  });

  describe("getIntegrationCounts", () => {
    it("should return counts for all categories", () => {
      const counts = getIntegrationCounts();
      expect(counts).toHaveProperty("COMMUNICATION");
      expect(counts).toHaveProperty("ROUTING");
      expect(counts).toHaveProperty("ORDER_MANAGEMENT");
      expect(counts).toHaveProperty("INVENTORY");
      expect(counts).toHaveProperty("PAYMENT");
      expect(counts).toHaveProperty("ANALYTICS");
    });

    it("should return total and available counts", () => {
      const counts = getIntegrationCounts();
      for (const category of Object.keys(counts) as IntegrationCategory[]) {
        expect(counts[category]).toHaveProperty("total");
        expect(counts[category]).toHaveProperty("available");
        expect(counts[category].total).toBeGreaterThan(0);
        expect(counts[category].available).toBeLessThanOrEqual(counts[category].total);
      }
    });

    it("should track available integrations correctly", () => {
      const counts = getIntegrationCounts();
      const available = getAvailableIntegrations();
      const totalAvailable = Object.values(counts).reduce((sum, cat) => sum + cat.available, 0);
      expect(totalAvailable).toBe(available.length);
    });
  });

  describe("getAllIntegrationSlugs", () => {
    it("should return array of all integration slugs", () => {
      const slugs = getAllIntegrationSlugs();
      expect(Array.isArray(slugs)).toBe(true);
      expect(slugs.length).toBeGreaterThan(0);
    });

    it("should include known integrations", () => {
      const slugs = getAllIntegrationSlugs();
      expect(slugs).toContain("sendgrid");
      expect(slugs).toContain("mapbox");
      expect(slugs).toContain("firebase");
    });

    it("should not include duplicates", () => {
      const slugs = getAllIntegrationSlugs();
      const uniqueSlugs = new Set(slugs);
      expect(uniqueSlugs.size).toBe(slugs.length);
    });

    it("should match registry size", () => {
      const slugs = getAllIntegrationSlugs();
      expect(slugs.length).toBe(INTEGRATION_REGISTRY.size);
    });
  });

  describe("INTEGRATION_REGISTRY", () => {
    it("should be a ReadonlyMap", () => {
      expect(INTEGRATION_REGISTRY instanceof Map).toBe(true);
    });

    it("should contain valid integration entries", () => {
      for (const [slug, app] of INTEGRATION_REGISTRY) {
        expect(slug).toBe(app.slug);
        expect(app.name).toBeDefined();
        expect(app.category).toBeDefined();
        expect(Array.isArray(app.credentialFields)).toBe(true);
      }
    });

    it("should be keyed by slug", () => {
      const sendgrid = INTEGRATION_REGISTRY.get("sendgrid");
      expect(sendgrid?.slug).toBe("sendgrid");
    });
  });

  describe("CATEGORY_LABELS", () => {
    it("should have labels for all categories", () => {
      expect(CATEGORY_LABELS.COMMUNICATION).toBe("Communication");
      expect(CATEGORY_LABELS.ROUTING).toBe("Routing");
      expect(CATEGORY_LABELS.ORDER_MANAGEMENT).toBe("Order Management");
      expect(CATEGORY_LABELS.INVENTORY).toBe("Inventory Management");
      expect(CATEGORY_LABELS.PAYMENT).toBe("Payment");
      expect(CATEGORY_LABELS.ANALYTICS).toBe("Analytics");
    });

    it("should return non-empty strings", () => {
      for (const label of Object.values(CATEGORY_LABELS)) {
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("Integration Resolver", () => {
  describe("resolveIntegration", () => {
    it("should return unavailable for unknown slug", () => {
      const result = resolveIntegration("unknown_slug");
      expect(result.available).toBe(false);
      expect(result.credentials).toEqual({});
    });

    it("should return available=true for native integrations", () => {
      const result = resolveIntegration("shopify_payments");
      expect(result.available).toBe(true);
      expect(result.credentials).toEqual({});
      expect(result.usedFallback).toBe(false);
    });

    it("should return tenant credentials when available", () => {
      const tenantConfig = {
        credentials: { apiKey: "test-key", domain: "test.com" },
        config: { customField: "value" },
        isEnabled: true,
      };

      const result = resolveIntegration("sendgrid", tenantConfig);
      expect(result.available).toBe(true);
      expect(result.credentials).toEqual(tenantConfig.credentials);
      expect(result.config).toEqual(tenantConfig.config);
      expect(result.usedFallback).toBe(false);
    });

    it("should ignore disabled integrations", () => {
      const tenantConfig = {
        credentials: { apiKey: "test-key" },
        config: {},
        isEnabled: false,
      };

      const result = resolveIntegration("sendgrid", tenantConfig);
      expect(result.usedFallback).toBe(true);
    });

    it("should ignore empty credentials", () => {
      const tenantConfig = {
        credentials: {},
        config: {},
        isEnabled: true,
      };

      const result = resolveIntegration("sendgrid", tenantConfig);
      expect(result.usedFallback).toBe(true);
    });

    it("should use deployer fallback when available", () => {
      process.env.SENDGRID_API_KEY = "deployer-key";
      process.env.NOTIFICATIONS_BYOK = "false";

      const result = resolveIntegration("sendgrid");
      expect(result.available).toBe(true);
      expect(result.usedFallback).toBe(true);

      delete process.env.SENDGRID_API_KEY;
      delete process.env.NOTIFICATIONS_BYOK;
    });

    it("should prefer tenant credentials over deployer fallback", () => {
      process.env.SENDGRID_API_KEY = "deployer-key";

      const tenantConfig = {
        credentials: { SENDGRID_API_KEY: "tenant-key" },
        config: {},
        isEnabled: true,
      };

      const result = resolveIntegration("sendgrid", tenantConfig);
      expect(result.credentials.SENDGRID_API_KEY).toBe("tenant-key");
      expect(result.usedFallback).toBe(false);

      delete process.env.SENDGRID_API_KEY;
    });

    it("should set slug correctly", () => {
      const result = resolveIntegration("mapbox");
      expect(result.slug).toBe("mapbox");
    });
  });

  describe("resolveByCategory", () => {
    it("should return first available integration for category", () => {
      const result = resolveByCategory("COMMUNICATION");
      expect(result).not.toBeNull();
      if (result) {
        expect(result.slug).toBeDefined();
        expect(result.available).toBe(true);
      }
    });

    it("should filter by subcategory when provided", () => {
      const result = resolveByCategory("COMMUNICATION", "email");
      expect(result).not.toBeNull();
      if (result) {
        const app = getIntegrationBySlug(result.slug);
        expect(app?.subcategory).toBe("email");
      }
    });

    it("should return null when no available integrations", () => {
      const result = resolveByCategory("COMMUNICATION", "invalid_subcategory");
      expect(result).toBeNull();
    });

    it("should consider tenant integrations", () => {
      const tenantConfigs = new Map([
        [
          "sendgrid",
          {
            credentials: { apiKey: "test-key" },
            config: {},
            isEnabled: true,
          },
        ],
      ]);

      const result = resolveByCategory("COMMUNICATION", "email", tenantConfigs);
      expect(result).not.toBeNull();
    });

    it("should skip inactive integrations", () => {
      const tenantConfigs = new Map([
        [
          "sendgrid",
          {
            credentials: { apiKey: "test-key" },
            config: {},
            isEnabled: false,
          },
        ],
      ]);

      const result = resolveByCategory("COMMUNICATION", "email", tenantConfigs);
      // Should still return an integration (from deployer fallback or other providers)
      expect(result).not.toBeNull();
    });

    it("should emit metering event for fallback usage in BYOK mode", () => {
      process.env.NOTIFICATIONS_BYOK = "true";
      let eventEmitted = false;

      onIntegrationMeter((event) => {
        if (event.eventType === "METER") {
          eventEmitted = true;
        }
      });

      process.env.SENDGRID_API_KEY = "deployer-key";
      resolveByCategory("COMMUNICATION", "email", undefined, "shop_123");

      expect(eventEmitted).toBe(true);

      delete process.env.SENDGRID_API_KEY;
      delete process.env.NOTIFICATIONS_BYOK;
    });
  });

  describe("maskCredentials", () => {
    it("should mask long API keys", () => {
      const credentials = {
        SENDGRID_API_KEY: "SG.1234567890123456789012345",
      };

      const masked = maskCredentials(credentials);
      expect(masked.SENDGRID_API_KEY).toMatch(/^....\•{8}..../);
    });

    it("should mask short credentials", () => {
      const credentials = {
        SHORT_KEY: "abc",
      };

      const masked = maskCredentials(credentials);
      expect(masked.SHORT_KEY).toBe("••••••••");
    });

    it("should handle non-string values", () => {
      const credentials = {
        PORT: 8080 as any,
        ENABLED: true as any,
      };

      const masked = maskCredentials(credentials);
      expect(masked.PORT).toBe("••••••••");
      expect(masked.ENABLED).toBe("••••••••");
    });

    it("should preserve credential keys", () => {
      const credentials = {
        SENDGRID_API_KEY: "SG.1234567890123456789012345",
        EMAIL_FROM: "noreply@example.com",
      };

      const masked = maskCredentials(credentials);
      expect(Object.keys(masked)).toEqual(Object.keys(credentials));
    });

    it("should handle empty credentials", () => {
      const credentials: Record<string, unknown> = {};
      const masked = maskCredentials(credentials);
      expect(masked).toEqual({});
    });
  });
});

describe("Integration Metering", () => {
  describe("onIntegrationMeter", () => {
    it("should register metering callback", () => {
      let callbackCalled = false;

      onIntegrationMeter(() => {
        callbackCalled = true;
      });

      emitIntegrationEvent({
        shopId: "shop_123",
        appSlug: "sendgrid",
        eventType: "METER",
        usedFallback: true,
        timestamp: new Date(),
      });

      expect(callbackCalled).toBe(true);
    });

    it("should handle async callbacks", async () => {
      let asyncCallbackCalled = false;

      onIntegrationMeter(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        asyncCallbackCalled = true;
      });

      emitIntegrationEvent({
        shopId: "shop_123",
        appSlug: "sendgrid",
        eventType: "INSTALL",
        usedFallback: false,
        timestamp: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(asyncCallbackCalled).toBe(true);
    });

    it("should override previous callback", () => {
      let firstCalled = false;
      let secondCalled = false;

      onIntegrationMeter(() => {
        firstCalled = true;
      });

      onIntegrationMeter(() => {
        secondCalled = true;
      });

      emitIntegrationEvent({
        shopId: "shop_123",
        appSlug: "sendgrid",
        eventType: "METER",
        usedFallback: true,
        timestamp: new Date(),
      });

      expect(firstCalled).toBe(false);
      expect(secondCalled).toBe(true);
    });
  });

  describe("emitIntegrationEvent", () => {
    it("should emit INSTALL events", () => {
      let emittedEvent: IntegrationEvent | null = null;

      onIntegrationMeter((event) => {
        emittedEvent = event;
      });

      const event: IntegrationEvent = {
        shopId: "shop_123",
        appSlug: "sendgrid",
        eventType: "INSTALL",
        usedFallback: false,
        timestamp: new Date(),
      };

      emitIntegrationEvent(event);
      expect(emittedEvent?.eventType).toBe("INSTALL");
    });

    it("should emit UNINSTALL events", () => {
      let emittedEvent: IntegrationEvent | null = null;

      onIntegrationMeter((event) => {
        emittedEvent = event;
      });

      const event: IntegrationEvent = {
        shopId: "shop_123",
        appSlug: "sendgrid",
        integrationId: "int_123",
        eventType: "UNINSTALL",
        usedFallback: false,
        timestamp: new Date(),
      };

      emitIntegrationEvent(event);
      expect(emittedEvent?.eventType).toBe("UNINSTALL");
    });

    it("should emit METER events", () => {
      let emittedEvent: IntegrationEvent | null = null;

      onIntegrationMeter((event) => {
        emittedEvent = event;
      });

      const event: IntegrationEvent = {
        shopId: "shop_123",
        appSlug: "sendgrid",
        eventType: "METER",
        operation: "fallback_usage",
        usedFallback: true,
        timestamp: new Date(),
      };

      emitIntegrationEvent(event);
      expect(emittedEvent?.operation).toBe("fallback_usage");
    });

    it("should emit SYNC events with metadata", () => {
      let emittedEvent: IntegrationEvent | null = null;

      onIntegrationMeter((event) => {
        emittedEvent = event;
      });

      const event: IntegrationEvent = {
        shopId: "shop_123",
        appSlug: "shopify_inventory",
        eventType: "SYNC",
        usedFallback: false,
        metadata: { synced: 150, errors: 2 },
        timestamp: new Date(),
      };

      emitIntegrationEvent(event);
      expect(emittedEvent?.metadata?.synced).toBe(150);
      expect(emittedEvent?.metadata?.errors).toBe(2);
    });

    it("should emit HEALTH_CHECK events", () => {
      let emittedEvent: IntegrationEvent | null = null;

      onIntegrationMeter((event) => {
        emittedEvent = event;
      });

      const event: IntegrationEvent = {
        shopId: "shop_123",
        appSlug: "stripe",
        eventType: "HEALTH_CHECK",
        usedFallback: false,
        timestamp: new Date(),
      };

      emitIntegrationEvent(event);
      expect(emittedEvent?.eventType).toBe("HEALTH_CHECK");
    });

    it("should include timestamp", () => {
      let emittedEvent: IntegrationEvent | null = null;

      onIntegrationMeter((event) => {
        emittedEvent = event;
      });

      const beforeTime = new Date();
      emitIntegrationEvent({
        shopId: "shop_123",
        appSlug: "sendgrid",
        eventType: "METER",
        usedFallback: true,
        timestamp: new Date(),
      });
      const afterTime = new Date();

      expect(emittedEvent?.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(emittedEvent?.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it("should not block on callback errors", () => {
      let errorThrown = false;

      onIntegrationMeter(() => {
        throw new Error("Callback error");
      });

      expect(() => {
        emitIntegrationEvent({
          shopId: "shop_123",
          appSlug: "sendgrid",
          eventType: "METER",
          usedFallback: true,
          timestamp: new Date(),
        });
      }).not.toThrow();
    });

    it("should handle null callback gracefully", () => {
      onIntegrationMeter(() => {});
      // Reset to null by not registering anything
      expect(() => {
        emitIntegrationEvent({
          shopId: "shop_123",
          appSlug: "sendgrid",
          eventType: "METER",
          usedFallback: true,
          timestamp: new Date(),
        });
      }).not.toThrow();
    });
  });
});

describe("Integration Categories", () => {
  it("should have all category types", () => {
    const categories: IntegrationCategory[] = [
      "COMMUNICATION",
      "ROUTING",
      "ORDER_MANAGEMENT",
      "INVENTORY",
      "PAYMENT",
      "ANALYTICS",
    ];

    for (const category of categories) {
      const apps = getIntegrationsByCategory(category);
      expect(apps.length).toBeGreaterThan(0);
    }
  });

  it("should have unique slugs across all categories", () => {
    const allApps = getAllIntegrationSlugs();
    const uniqueSlugs = new Set(allApps);
    expect(uniqueSlugs.size).toBe(allApps.length);
  });

  it("should have proper subcategories in COMMUNICATION", () => {
    const comms = getIntegrationsByCategory("COMMUNICATION");
    const subcategories = new Set(comms.map((app) => app.subcategory).filter(Boolean));
    expect(subcategories.size).toBeGreaterThan(0);
  });

  it("should have valid credential fields", () => {
    for (const [slug, app] of INTEGRATION_REGISTRY) {
      for (const field of app.credentialFields) {
        expect(field.key).toBeDefined();
        expect(field.label).toBeDefined();
        expect(field.type).toMatch(/^(text|password|url|textarea)$/);
        expect(field.required).toBeDefined();
      }
    }
  });

  it("should have valid status values", () => {
    for (const app of getAllIntegrationSlugs()) {
      const integration = getIntegrationBySlug(app);
      expect(integration?.status).toMatch(/^(AVAILABLE|COMING_SOON|BETA|DEPRECATED)$/);
    }
  });

  it("should have valid auth types", () => {
    for (const app of getAllIntegrationSlugs()) {
      const integration = getIntegrationBySlug(app);
      expect(integration?.authType).toMatch(/^(API_KEY|OAUTH|NONE|MULTI_CREDENTIAL)$/);
    }
  });

  it("should have at least one capability per integration", () => {
    for (const app of getAllIntegrationSlugs()) {
      const integration = getIntegrationBySlug(app);
      expect(integration?.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("should have valid version strings", () => {
    for (const app of getAllIntegrationSlugs()) {
      const integration = getIntegrationBySlug(app);
      expect(integration?.version).toMatch(/^\d+\.\d+\.\d+/);
    }
  });
});

describe("Integration Compatibility", () => {
  it("should validate deprecated integrations", () => {
    const all = getAllIntegrationSlugs();
    const deprecated = all.filter((slug) => {
      const app = getIntegrationBySlug(slug);
      return app?.status === "DEPRECATED";
    });

    // Deprecated integrations should not be returned by getAvailableIntegrations
    const available = getAvailableIntegrations();
    for (const deprecatedSlug of deprecated) {
      expect(available.some((app) => app.slug === deprecatedSlug)).toBe(false);
    }
  });

  it("should handle version comparison logic", () => {
    const integrations = getAvailableIntegrations();
    for (const app of integrations) {
      const parts = app.version.split(".");
      expect(parts.length).toBeGreaterThanOrEqual(3);
      for (const part of parts.slice(0, 3)) {
        expect(/^\d+$/.test(part)).toBe(true);
      }
    }
  });

  it("should maintain backward compatibility with compat layer", () => {
    // Test that compat functions work
    const result = resolveIntegration("sendgrid");
    expect(result).toHaveProperty("slug");
    expect(result).toHaveProperty("credentials");
    expect(result).toHaveProperty("available");
    expect(result).toHaveProperty("usedFallback");
    expect(result).toHaveProperty("config");
  });
});

describe("Integration Edge Cases", () => {
  it("should handle empty search query", () => {
    const results = searchIntegrations("   ");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should handle null/undefined in resolveIntegration", () => {
    const result = resolveIntegration("sendgrid", null);
    expect(result.available).toBeDefined();
  });

  it("should handle empty tenant config", () => {
    const result = resolveIntegration("sendgrid", {
      credentials: {},
      config: {},
      isEnabled: true,
    });
    expect(result).toHaveProperty("available");
  });

  it("should handle special characters in search", () => {
    const results = searchIntegrations("@#$%");
    expect(Array.isArray(results)).toBe(true);
  });

  it("should maintain registry immutability", () => {
    const size = INTEGRATION_REGISTRY.size;
    expect(() => {
      // Try to modify (TypeScript prevents this, but test at runtime)
      (INTEGRATION_REGISTRY as any).set("new_app", {});
    }).toThrow();
  });
});
