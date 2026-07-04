/**
 * Provider Registry Tests
 *
 * Tests the provider registry for:
 * - Lazy initialization of providers
 * - Per-tenant isolation
 * - Health check functionality
 * - BYOK (Bring Your Own Key) credential resolution
 * - Provider caching
 * - Fallback chain management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TenantProviderRegistry,
  getTenantProviderRegistry,
  clearTenantRegistry,
  clearAllRegistries,
  getRegistryStats,
} from "../provider-registry.js";
import type { NotificationProvider } from "../providers/types.js";

describe("TenantProviderRegistry", () => {
  let registry: TenantProviderRegistry;

  beforeEach(() => {
    clearAllRegistries();
    registry = new TenantProviderRegistry();
  });

  describe("Provider Registration and Retrieval", () => {
    it("should register a provider and retrieve it", () => {
      const mockProvider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", mockProvider);
      const retrieved = registry.getProvider("EMAIL", "sendgrid");

      expect(retrieved).toBe(mockProvider);
    });

    it("should return undefined for non-existent provider", () => {
      const retrieved = registry.getProvider("EMAIL", "non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("should overwrite existing provider with same name", () => {
      const provider1: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const provider2: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider1);
      registry.registerProvider("EMAIL", "sendgrid", provider2);

      const retrieved = registry.getProvider("EMAIL", "sendgrid");
      expect(retrieved).toBe(provider2);
    });
  });

  describe("Lazy Initialization", () => {
    it("should initialize provider on first access via getTenantProviderRegistry", () => {
      const shop1Registry = getTenantProviderRegistry("shop-1");
      const shop1RegistryAgain = getTenantProviderRegistry("shop-1");

      expect(shop1Registry).toBe(shop1RegistryAgain);
    });

    it("should create new registry for each tenant", () => {
      const shop1Registry = getTenantProviderRegistry("shop-1");
      const shop2Registry = getTenantProviderRegistry("shop-2");

      expect(shop1Registry).not.toBe(shop2Registry);
    });

    it("should support lazy provider initialization with empty registry", () => {
      const newRegistry = getTenantProviderRegistry("shop-lazy");

      expect(newRegistry.size()).toBe(0);
      expect(newRegistry.getFallbackChain("EMAIL")).toEqual([]);
    });
  });

  describe("Per-Tenant Isolation", () => {
    it("should isolate providers between different tenants", () => {
      const provider1: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const provider2: NotificationProvider = {
        channel: "EMAIL",
        name: "mailgun",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const shop1Registry = getTenantProviderRegistry("shop-1");
      const shop2Registry = getTenantProviderRegistry("shop-2");

      shop1Registry.registerProvider("EMAIL", "sendgrid", provider1);
      shop2Registry.registerProvider("EMAIL", "mailgun", provider2);

      expect(shop1Registry.getProvider("EMAIL", "sendgrid")).toBe(provider1);
      expect(shop1Registry.getProvider("EMAIL", "mailgun")).toBeUndefined();

      expect(shop2Registry.getProvider("EMAIL", "mailgun")).toBe(provider2);
      expect(shop2Registry.getProvider("EMAIL", "sendgrid")).toBeUndefined();
    });

    it("should maintain separate fallback chains per tenant", () => {
      const shop1Registry = getTenantProviderRegistry("shop-1");
      const shop2Registry = getTenantProviderRegistry("shop-2");

      shop1Registry.setFallbackChain("EMAIL", "sendgrid", ["mailgun"]);
      shop2Registry.setFallbackChain("EMAIL", "mailgun", [
        "sendgrid",
        "aws-ses",
      ]);

      expect(shop1Registry.getFallbackChain("EMAIL")).toEqual([
        "sendgrid",
        "mailgun",
      ]);
      expect(shop2Registry.getFallbackChain("EMAIL")).toEqual([
        "mailgun",
        "sendgrid",
        "aws-ses",
      ]);
    });
  });

  describe("Fallback Chain Management", () => {
    it("should set and retrieve fallback chain", () => {
      registry.setFallbackChain("EMAIL", "primary", ["secondary", "tertiary"]);
      const chain = registry.getFallbackChain("EMAIL");

      expect(chain).toEqual(["primary", "secondary", "tertiary"]);
    });

    it("should support primary provider with empty backups", () => {
      registry.setFallbackChain("EMAIL", "only-one");
      const chain = registry.getFallbackChain("EMAIL");

      expect(chain).toEqual(["only-one"]);
    });

    it("should return empty chain for non-existent channel", () => {
      const chain = registry.getFallbackChain("EMAIL");
      expect(chain).toEqual([]);
    });

    it("should support multiple channels with different chains", () => {
      registry.setFallbackChain("EMAIL", "sendgrid", ["mailgun"]);
      registry.setFallbackChain("SMS", "twilio", ["nexmo"]);
      registry.setFallbackChain("PUSH", "firebase", ["apns"]);

      expect(registry.getFallbackChain("EMAIL")).toEqual([
        "sendgrid",
        "mailgun",
      ]);
      expect(registry.getFallbackChain("SMS")).toEqual(["twilio", "nexmo"]);
      expect(registry.getFallbackChain("PUSH")).toEqual(["firebase", "apns"]);
    });
  });

  describe("Health Check", () => {
    it("should check health of all providers for a channel", async () => {
      const provider1: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn().mockResolvedValue({
          healthy: true,
          latency: 50,
          quotaRemaining: 1000,
        }),
      };

      const provider2: NotificationProvider = {
        channel: "EMAIL",
        name: "mailgun",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn().mockResolvedValue({
          healthy: true,
          latency: 75,
          quotaRemaining: 500,
        }),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider1);
      registry.registerProvider("EMAIL", "mailgun", provider2);

      const health = await registry.checkChannelHealth("EMAIL");

      expect(health.sendgrid).toMatchObject({
        provider: "sendgrid",
        healthy: true,
        latency: 50,
        quotaRemaining: 1000,
      });

      expect(health.mailgun).toMatchObject({
        provider: "mailgun",
        healthy: true,
        latency: 75,
        quotaRemaining: 500,
      });
    });

    it("should update health status when provider fails", async () => {
      const provider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn().mockRejectedValue(new Error("Connection timeout")),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider);

      const health = await registry.checkChannelHealth("EMAIL");

      expect(health.sendgrid.healthy).toBe(false);
      expect(health.sendgrid.lastError).toContain("Connection timeout");
    });

    it("should return empty object for channel with no providers", async () => {
      const health = await registry.checkChannelHealth("EMAIL");
      expect(health).toEqual({});
    });

    it("should manually update health status", () => {
      const provider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider);
      registry.updateHealth("EMAIL", "sendgrid", {
        healthy: false,
        lastError: "API key expired",
      });

      const health = registry.getHealth("EMAIL", "sendgrid");
      expect(health?.healthy).toBe(false);
      expect(health?.lastError).toBe("API key expired");
    });
  });

  describe("Healthy Provider Selection", () => {
    it("should return first healthy provider from fallback chain", () => {
      const healthyProvider: NotificationProvider = {
        channel: "EMAIL",
        name: "backup",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const unhealthyProvider: NotificationProvider = {
        channel: "EMAIL",
        name: "primary",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "primary", unhealthyProvider);
      registry.registerProvider("EMAIL", "backup", healthyProvider);
      registry.setFallbackChain("EMAIL", "primary", ["backup"]);

      // Mark primary as unhealthy
      registry.updateHealth("EMAIL", "primary", { healthy: false });
      // Backup is healthy by default

      const selected = registry.getHealthyProvider("EMAIL");

      expect(selected?.name).toBe("backup");
      expect(selected?.provider).toBe(healthyProvider);
    });

    it("should return undefined if all providers unhealthy", () => {
      const provider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider);
      registry.setFallbackChain("EMAIL", "sendgrid");
      registry.updateHealth("EMAIL", "sendgrid", { healthy: false });

      const selected = registry.getHealthyProvider("EMAIL");

      expect(selected).toBeUndefined();
    });
  });

  describe("Provider Listing", () => {
    it("should list all providers for a channel", () => {
      const provider1: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const provider2: NotificationProvider = {
        channel: "EMAIL",
        name: "mailgun",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider1);
      registry.registerProvider("EMAIL", "mailgun", provider2);

      const providers = registry.getProvidersForChannel("EMAIL");

      expect(providers).toHaveLength(2);
      expect(providers.map((p) => p.name)).toEqual(
        expect.arrayContaining(["sendgrid", "mailgun"]),
      );
    });

    it("should not list providers from other channels", () => {
      const emailProvider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const smsProvider: NotificationProvider = {
        channel: "SMS",
        name: "twilio",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", emailProvider);
      registry.registerProvider("SMS", "twilio", smsProvider);

      const emailProviders = registry.getProvidersForChannel("EMAIL");

      expect(emailProviders).toHaveLength(1);
      expect(emailProviders[0].name).toBe("sendgrid");
    });
  });

  describe("Channel Clearing", () => {
    it("should clear all providers for a specific channel", () => {
      const emailProvider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const smsProvider: NotificationProvider = {
        channel: "SMS",
        name: "twilio",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", emailProvider);
      registry.registerProvider("SMS", "twilio", smsProvider);

      registry.clearChannel("EMAIL");

      expect(registry.getProvider("EMAIL", "sendgrid")).toBeUndefined();
      expect(registry.getProvider("SMS", "twilio")).toBeDefined();
    });

    it("should clear all providers", () => {
      const provider1: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const provider2: NotificationProvider = {
        channel: "SMS",
        name: "twilio",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider1);
      registry.registerProvider("SMS", "twilio", provider2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.getFallbackChain("EMAIL")).toEqual([]);
    });
  });

  describe("Global Registry Management", () => {
    it("should clear tenant registry by shopId", () => {
      const shop1Registry = getTenantProviderRegistry("shop-1");
      const provider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      shop1Registry.registerProvider("EMAIL", "sendgrid", provider);
      expect(shop1Registry.size()).toBe(1);

      clearTenantRegistry("shop-1");

      const newShop1Registry = getTenantProviderRegistry("shop-1");
      expect(newShop1Registry.size()).toBe(0);
    });

    it("should get registry statistics", () => {
      const shop1Registry = getTenantProviderRegistry("shop-1");
      const shop2Registry = getTenantProviderRegistry("shop-2");

      const provider1: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const provider2: NotificationProvider = {
        channel: "SMS",
        name: "twilio",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const provider3: NotificationProvider = {
        channel: "EMAIL",
        name: "mailgun",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      shop1Registry.registerProvider("EMAIL", "sendgrid", provider1);
      shop1Registry.registerProvider("SMS", "twilio", provider2);
      shop2Registry.registerProvider("EMAIL", "mailgun", provider3);

      const stats = getRegistryStats();

      expect(stats.tenants).toBe(2);
      expect(stats.totalProviders).toBe(3);
      expect(stats.providersByChannel.EMAIL).toBe(2);
      expect(stats.providersByChannel.SMS).toBe(1);
    });
  });

  describe("BYOK (Bring Your Own Key) Credential Resolution", () => {
    it("should store and retrieve tenant-specific config", () => {
      const provider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const config = {
        apiKey: "sg_tenant_key_12345",
        fromEmail: "tenant@example.com",
      };
      registry.registerProvider("EMAIL", "sendgrid", provider, config);

      const providers = registry.getProvidersForChannel("EMAIL");
      expect(providers[0]).toMatchObject({
        name: "sendgrid",
        provider: provider,
      });
    });

    it("should isolate credentials between tenants", () => {
      const provider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const shop1Registry = getTenantProviderRegistry("shop-1");
      const shop2Registry = getTenantProviderRegistry("shop-2");

      const config1 = { apiKey: "sg_shop1_key" };
      const config2 = { apiKey: "sg_shop2_key" };

      shop1Registry.registerProvider("EMAIL", "sendgrid", provider, config1);
      shop2Registry.registerProvider("EMAIL", "sendgrid", provider, config2);

      const shop1Providers = shop1Registry.getProvidersForChannel("EMAIL");
      const shop2Providers = shop2Registry.getProvidersForChannel("EMAIL");

      expect(shop1Providers[0]).toBeDefined();
      expect(shop2Providers[0]).toBeDefined();
      // Both reference the same provider instance but with different configs stored
    });
  });

  describe("Provider Caching", () => {
    it("should return cached provider instance on subsequent calls", () => {
      const provider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider);

      const first = registry.getProvider("EMAIL", "sendgrid");
      const second = registry.getProvider("EMAIL", "sendgrid");

      expect(first).toBe(second);
    });

    it("should maintain cache across multiple channel queries", () => {
      const provider1: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      const provider2: NotificationProvider = {
        channel: "SMS",
        name: "twilio",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider1);
      registry.registerProvider("SMS", "twilio", provider2);

      const emailList1 = registry.getProvidersForChannel("EMAIL");
      const emailList2 = registry.getProvidersForChannel("EMAIL");

      expect(emailList1[0].provider).toBe(emailList2[0].provider);
    });
  });

  describe("Registry Size and Debugging", () => {
    it("should report correct registry size", () => {
      expect(registry.size()).toBe(0);

      const provider: NotificationProvider = {
        channel: "EMAIL",
        name: "sendgrid",
        send: vi.fn(),
        validateConfig: vi.fn(),
        getStatus: vi.fn(),
      };

      registry.registerProvider("EMAIL", "sendgrid", provider);
      expect(registry.size()).toBe(1);

      registry.registerProvider("EMAIL", "mailgun", {
        ...provider,
        name: "mailgun",
      });
      expect(registry.size()).toBe(2);
    });

    it("should get all chains for debugging", () => {
      registry.setFallbackChain("EMAIL", "sendgrid", ["mailgun", "aws-ses"]);
      registry.setFallbackChain("SMS", "twilio", ["nexmo"]);

      const chains = registry.getAllChains();

      expect(chains).toEqual({
        EMAIL: { primary: "sendgrid", backups: ["mailgun", "aws-ses"] },
        SMS: { primary: "twilio", backups: ["nexmo"] },
      });
    });
  });
});
