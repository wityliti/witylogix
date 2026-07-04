/**
 * Provider Registry — manages provider instances per tenant with lazy initialization.
 *
 * Responsibilities:
 * - Store provider instances keyed by channel + provider name
 * - Lazy init providers from tenant credentials stored in DB
 * - Track health status per provider instance
 * - Support automatic failover to backup providers
 * - Thread-safe using Map-based storage (no mutexes)
 *
 * Architecture:
 * ```
 * Tenant Config (DB)
 *   └─ shop.settings.notifications.email.provider = "sendgrid"
 *   └─ shop.settings.notifications.email.apiKey = "SG.xxx"
 *
 * Provider Registry
 *   └─ email:
 *      └─ sendgrid: SendGridEmailProvider(config)
 *      └─ mailgun: MailgunEmailProvider(config) [lazy]
 *   └─ sms:
 *      └─ twilio: TwilioSMSProvider(config)
 *
 * Orchestrator
 *   └─ getProvider(channel, providerName) → NotificationProvider
 *   └─ getFallbackChain(channel) → [providerName, providerName, ...]
 * ```
 */

import type {
  NotificationProvider,
  ProviderStatus,
} from "./providers/types.js";

/**
 * Per-provider health tracking.
 */
export interface ProviderHealthRecord {
  provider: string;
  lastChecked: Date;
  healthy: boolean;
  latency?: number;
  quotaRemaining?: number;
  lastError?: string;
}

/**
 * Provider instance with associated config and health data.
 */
interface ProviderInstance {
  provider: NotificationProvider;
  config: Record<string, unknown>;
  health: ProviderHealthRecord;
  lastInitializedAt: Date;
}

/**
 * Tenant-specific provider registry — isolates credentials per tenant.
 * Each tenant gets their own instances so credentials never mix.
 */
export class TenantProviderRegistry {
  private instances: Map<string, ProviderInstance> = new Map(); // key: "channel:providerName"
  private fallbackChains: Map<string, { primary: string; backups: string[] }> =
    new Map(); // key: "channel"

  /**
   * Register a provider instance for a channel.
   * Overwrites any existing provider with the same name.
   */
  registerProvider(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    providerName: string,
    provider: NotificationProvider,
    config: Record<string, unknown> = {},
  ): void {
    const key = this.makeKey(channel, providerName);
    this.instances.set(key, {
      provider,
      config,
      health: {
        provider: providerName,
        lastChecked: new Date(),
        healthy: true,
      },
      lastInitializedAt: new Date(),
    });
  }

  /**
   * Retrieve a provider instance by channel and name.
   */
  getProvider(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    providerName: string,
  ): NotificationProvider | undefined {
    const key = this.makeKey(channel, providerName);
    return this.instances.get(key)?.provider;
  }

  /**
   * Set the fallback chain for a channel.
   * Example: setFallbackChain("EMAIL", "sendgrid", ["mailgun", "aws_ses"])
   * Means: try sendgrid first, then mailgun, then aws_ses
   */
  setFallbackChain(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    primaryProvider: string,
    backupProviders: string[] = [],
  ): void {
    this.fallbackChains.set(channel, {
      primary: primaryProvider,
      backups: backupProviders,
    });
  }

  /**
   * Get the fallback chain for a channel.
   * Returns [primary, ...backups] in order of preference.
   */
  getFallbackChain(channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH"): string[] {
    const chain = this.fallbackChains.get(channel);
    if (!chain) return [];
    return [chain.primary, ...chain.backups];
  }

  /**
   * Update health status for a provider.
   */
  updateHealth(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    providerName: string,
    status: ProviderStatus,
  ): void {
    const key = this.makeKey(channel, providerName);
    const instance = this.instances.get(key);
    if (!instance) return;

    instance.health = {
      provider: providerName,
      lastChecked: new Date(),
      healthy: status.healthy,
      latency: status.latency,
      quotaRemaining: status.quotaRemaining,
      lastError: status.lastError,
    };
  }

  /**
   * Get health status for a provider.
   */
  getHealth(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    providerName: string,
  ): ProviderHealthRecord | undefined {
    const key = this.makeKey(channel, providerName);
    return this.instances.get(key)?.health;
  }

  /**
   * Get all providers for a channel.
   */
  getProvidersForChannel(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
  ): Array<{
    name: string;
    provider: NotificationProvider;
    health: ProviderHealthRecord;
  }> {
    const result: Array<{
      name: string;
      provider: NotificationProvider;
      health: ProviderHealthRecord;
    }> = [];

    const entries = Array.from(this.instances.entries());
    for (let i = 0; i < entries.length; i++) {
      const [key, instance] = entries[i]!;
      const parts = key.split(":");
      const ch = parts[0];
      const providerName = parts[1];
      if (ch === channel) {
        result.push({
          name: providerName,
          provider: instance.provider,
          health: instance.health,
        });
      }
    }

    return result;
  }

  /**
   * Check health of all registered providers for a channel.
   * Returns status map keyed by provider name.
   */
  async checkChannelHealth(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
  ): Promise<Record<string, ProviderHealthRecord>> {
    const result: Record<string, ProviderHealthRecord> = {};
    const providers = this.getProvidersForChannel(channel);

    for (const { name, provider } of providers) {
      try {
        const status = await provider.getStatus();
        this.updateHealth(channel, name, status);
        result[name] = this.getHealth(channel, name)!;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.updateHealth(channel, name, {
          healthy: false,
          lastError: errorMessage,
        });
        result[name] = this.getHealth(channel, name)!;
      }
    }

    return result;
  }

  /**
   * Get a healthy provider from the fallback chain.
   * Returns first provider that is either healthy or uninitialized (we'll check on send).
   * Skips providers with recent errors.
   */
  getHealthyProvider(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
  ): { name: string; provider: NotificationProvider } | undefined {
    const chain = this.getFallbackChain(channel);

    for (const providerName of chain) {
      const provider = this.getProvider(channel, providerName);
      if (!provider) continue;

      const health = this.getHealth(channel, providerName);
      if (!health || health.healthy) {
        return { name: providerName, provider };
      }
    }

    return undefined;
  }

  /**
   * Clear all instances for a channel (e.g., when credentials invalidated).
   */
  clearChannel(channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH"): void {
    const keys = Array.from(this.instances.keys());
    const toDelete: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const ch = key.split(":")[0];
      if (ch === channel) {
        toDelete.push(key);
      }
    }
    for (let i = 0; i < toDelete.length; i++) {
      this.instances.delete(toDelete[i]!);
    }
  }

  /**
   * Clear all instances (hard reset).
   */
  clear(): void {
    this.instances.clear();
    this.fallbackChains.clear();
  }

  /**
   * Get size of registry (for debugging/monitoring).
   */
  size(): number {
    return this.instances.size;
  }

  /**
   * Get all channel chains (for debugging).
   */
  getAllChains(): Record<string, { primary: string; backups: string[] }> {
    const result: Record<string, { primary: string; backups: string[] }> = {};
    const entries = Array.from(this.fallbackChains.entries());
    for (let i = 0; i < entries.length; i++) {
      const [channel, chain] = entries[i]!;
      result[channel] = chain;
    }
    return result;
  }

  private makeKey(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    providerName: string,
  ): string {
    return `${channel}:${providerName}`;
  }
}

/**
 * Global registry cache — maps tenantId → TenantProviderRegistry.
 * In production, this is initialized by the app when tenant is loaded.
 * Lazy initialization prevents loading credentials for unused tenants.
 */
const globalRegistries: Map<string, TenantProviderRegistry> = new Map();

/**
 * Get or create a provider registry for a tenant.
 * Thread-safe via Map atomicity (no race conditions for common paths).
 */
export function getTenantProviderRegistry(
  shopId: string,
): TenantProviderRegistry {
  let registry = globalRegistries.get(shopId);

  if (!registry) {
    registry = new TenantProviderRegistry();
    globalRegistries.set(shopId, registry);
  }

  return registry;
}

/**
 * Clear provider registry for a tenant (e.g., when shop is deleted or credentials rotated).
 */
export function clearTenantRegistry(shopId: string): void {
  globalRegistries.delete(shopId);
}

/**
 * Clear all registries (useful for testing).
 */
export function clearAllRegistries(): void {
  globalRegistries.clear();
}

/**
 * Get registry statistics for monitoring/debugging.
 */
export function getRegistryStats(): {
  tenants: number;
  totalProviders: number;
  providersByChannel: Record<string, number>;
} {
  let totalProviders = 0;
  const providersByChannel: Record<string, number> = {
    EMAIL: 0,
    SMS: 0,
    WHATSAPP: 0,
    PUSH: 0,
  };

  const registryValues = Array.from(globalRegistries.values());
  for (let i = 0; i < registryValues.length; i++) {
    const registry = registryValues[i]!;
    const channels = ["EMAIL", "SMS", "WHATSAPP", "PUSH"] as const;
    for (let j = 0; j < channels.length; j++) {
      const channel = channels[j];
      const count = registry.getProvidersForChannel(channel).length;
      providersByChannel[channel] += count;
      totalProviders += count;
    }
  }

  return {
    tenants: globalRegistries.size,
    totalProviders,
    providersByChannel,
  };
}
