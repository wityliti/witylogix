/**
 * Messaging Router — intelligent channel-based provider selection.
 *
 * Routes messages to optimal providers based on:
 * - Channel type (SMS, Push, InApp, Chat)
 * - Destination/recipient
 * - Provider priority
 * - Cost optimization
 * - Delivery guarantees (fallback)
 * - Rate limiting aggregation
 * - Message deduplication
 */

import type {
  SMSMessage,
  PushNotification,
  InAppMessage,
  BulkMessage,
  SendResult,
  BatchSendResult,
  ChannelConfig,
  RateLimitConfig,
} from "./types.js";
import { MessagingAdapter } from "./messaging-adapter.js";

/**
 * Channel routing configuration.
 */
export interface ChannelRoutingConfig {
  /** Channel name (sms, push, inapp, chat) */
  channel: "sms" | "push" | "inapp" | "chat";

  /** Primary provider(s) in order of preference */
  primary: string[];

  /** Fallback provider(s) if primary fails */
  fallback?: string[];

  /** Cost per message for each provider (USD) */
  costPerMessage?: Record<string, number>;

  /** Rate limit for this channel */
  rateLimit?: RateLimitConfig;

  /** Whether to deduplicate messages */
  deduplicateMessages?: boolean;

  /** Deduplication window (ms) */
  deduplicationWindow?: number;
}

/**
 * Messaging router for intelligent provider selection and fallback.
 */
export class MessagingRouter {
  /** Registered adapter providers */
  private providers: Map<string, MessagingAdapter> = new Map();

  /** Channel routing configurations */
  private routingConfig: Map<string, ChannelRoutingConfig> = new Map();

  /** Message deduplication tracking */
  private sentMessages: Map<string, { timestamp: number; hash: string }> = new Map();

  constructor() {
    // Initialize default routing configurations
    this.setChannelConfig("sms", {
      channel: "sms",
      primary: ["vonage", "textmagic"],
      fallback: ["vonage"],
      deduplicateMessages: true,
      deduplicationWindow: 30000, // 30 seconds
    });

    this.setChannelConfig("push", {
      channel: "push",
      primary: ["onesignal"],
      fallback: ["sendbird"],
      deduplicateMessages: true,
      deduplicationWindow: 30000,
    });

    this.setChannelConfig("inapp", {
      channel: "inapp",
      primary: ["onesignal", "sendbird"],
      fallback: [],
      deduplicateMessages: false,
    });

    this.setChannelConfig("chat", {
      channel: "chat",
      primary: ["sendbird"],
      fallback: [],
      deduplicateMessages: false,
    });
  }

  /**
   * Register a messaging provider adapter.
   */
  registerProvider(name: string, adapter: MessagingAdapter): void {
    this.providers.set(name, adapter);
  }

  /**
   * Get a registered provider adapter.
   */
  getProvider(name: string): MessagingAdapter | undefined {
    return this.providers.get(name);
  }

  /**
   * Set channel routing configuration.
   */
  setChannelConfig(channel: string, config: ChannelRoutingConfig): void {
    this.routingConfig.set(channel, config);
  }

  /**
   * Get channel routing configuration.
   */
  getChannelConfig(channel: string): ChannelRoutingConfig | undefined {
    return this.routingConfig.get(channel);
  }

  /**
   * Send SMS with intelligent provider selection and fallback.
   */
  async sendSMS(message: SMSMessage): Promise<SendResult> {
    const config = this.routingConfig.get("sms");
    if (!config) {
      throw new Error("SMS channel not configured");
    }

    // Check for duplicates
    if (config.deduplicateMessages && this.isDuplicate("sms", message.to, message.body)) {
      return {
        success: false,
        error: "Duplicate message detected",
        timestamp: new Date(),
      };
    }

    // Try primary providers
    for (const providerName of config.primary) {
      try {
        const adapter = this.providers.get(providerName);
        if (!adapter) {
          console.warn(`Provider ${providerName} not registered`);
          continue;
        }

        const result = await adapter.sendSMS(message);
        if (result.success) {
          this.trackSentMessage("sms", message.to, message.body);
          return result;
        }
      } catch (error) {
        console.error(`SMS send failed with ${providerName}:`, error);
        // Continue to next provider
      }
    }

    // Try fallback providers
    if (config.fallback) {
      for (const providerName of config.fallback) {
        try {
          const adapter = this.providers.get(providerName);
          if (!adapter) continue;

          const result = await adapter.sendSMS(message);
          if (result.success) {
            this.trackSentMessage("sms", message.to, message.body);
            return {
              ...result,
              metadata: {
                ...result.metadata,
                usedFallback: true,
              },
            };
          }
        } catch (error) {
          console.error(`SMS fallback failed with ${providerName}:`, error);
        }
      }
    }

    return {
      success: false,
      error: "All SMS providers failed",
      timestamp: new Date(),
    };
  }

  /**
   * Send push notification with intelligent provider selection.
   */
  async sendPush(notification: PushNotification): Promise<SendResult> {
    const config = this.routingConfig.get("push");
    if (!config) {
      throw new Error("Push channel not configured");
    }

    // Check for duplicates
    const recipient = Array.isArray(notification.to) ? notification.to[0] : notification.to;
    if (config.deduplicateMessages && this.isDuplicate("push", recipient, notification.body)) {
      return {
        success: false,
        error: "Duplicate message detected",
        timestamp: new Date(),
      };
    }

    // Try primary providers
    for (const providerName of config.primary) {
      try {
        const adapter = this.providers.get(providerName);
        if (!adapter) {
          console.warn(`Provider ${providerName} not registered`);
          continue;
        }

        const result = await adapter.sendPush(notification);
        if (result.success) {
          this.trackSentMessage("push", recipient, notification.body);
          return result;
        }
      } catch (error) {
        console.error(`Push send failed with ${providerName}:`, error);
      }
    }

    // Try fallback providers
    if (config.fallback) {
      for (const providerName of config.fallback) {
        try {
          const adapter = this.providers.get(providerName);
          if (!adapter) continue;

          const result = await adapter.sendPush(notification);
          if (result.success) {
            this.trackSentMessage("push", recipient, notification.body);
            return {
              ...result,
              metadata: {
                ...result.metadata,
                usedFallback: true,
              },
            };
          }
        } catch (error) {
          console.error(`Push fallback failed with ${providerName}:`, error);
        }
      }
    }

    return {
      success: false,
      error: "All push providers failed",
      timestamp: new Date(),
    };
  }

  /**
   * Send in-app message.
   */
  async sendInApp(message: InAppMessage): Promise<SendResult> {
    const config = this.routingConfig.get("inapp");
    if (!config) {
      throw new Error("In-app channel not configured");
    }

    const userId = message.targetUserId || message.segment || "";

    // Try primary providers
    for (const providerName of config.primary) {
      try {
        const adapter = this.providers.get(providerName);
        if (!adapter) {
          console.warn(`Provider ${providerName} not registered`);
          continue;
        }

        const result = await adapter.sendInApp(message);
        if (result.success) {
          return result;
        }
      } catch (error) {
        console.error(`In-app send failed with ${providerName}:`, error);
      }
    }

    return {
      success: false,
      error: "All in-app providers failed",
      timestamp: new Date(),
    };
  }

  /**
   * Send bulk messages across providers with cost optimization.
   */
  async sendBulk(bulk: BulkMessage): Promise<BatchSendResult> {
    const config = this.routingConfig.get(bulk.type);
    if (!config) {
      throw new Error(`${bulk.type} channel not configured`);
    }

    const batchId = bulk.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Select best provider(s) based on cost
    const selectedProviders = this.selectOptimalProviders(
      config.primary,
      config.costPerMessage || {}
    );

    const results = new Map<string, SendResult>();
    let sent = 0;
    let failed = 0;

    // Distribute recipients across selected providers
    const recipientsPerProvider = Math.ceil(bulk.recipients.length / selectedProviders.length);

    for (let i = 0; i < selectedProviders.length; i++) {
      const providerName = selectedProviders[i];
      const adapter = this.providers.get(providerName);
      if (!adapter) continue;

      const start = i * recipientsPerProvider;
      const end = Math.min(start + recipientsPerProvider, bulk.recipients.length);
      const recipientBatch = bulk.recipients.slice(start, end);

      try {
        const bulkRequest: BulkMessage = {
          ...bulk,
          batchId,
          recipients: recipientBatch,
        };

        const batchResult = await adapter.sendBulk(bulkRequest);

        sent += batchResult.sent;
        failed += batchResult.failed;

        // Merge results
        for (const [recipient, result] of batchResult.results.entries()) {
          results.set(recipient, result);
        }
      } catch (error) {
        console.error(`Bulk send failed with ${providerName}:`, error);
        failed += recipientBatch.length;
      }
    }

    return {
      batchId,
      total: bulk.recipients.length,
      sent,
      failed,
      results,
      timestamp: new Date(),
    };
  }

  /**
   * Get aggregated rate limit information across all providers.
   */
  getAggregatedRateLimit(): Record<string, unknown> {
    const limits: Record<string, unknown> = {};

    for (const [channel, config] of this.routingConfig.entries()) {
      limits[channel] = {
        available: 0,
        limit: config.rateLimit?.concurrency || 100,
        providers: {},
      };

      for (const providerName of config.primary) {
        const adapter = this.providers.get(providerName);
        if (adapter) {
          (limits[channel] as Record<string, unknown>).providers ??= {};
          ((limits[channel] as Record<string, unknown>).providers as Record<string, unknown>)[
            providerName
          ] = adapter.getRateLimitState();
        }
      }
    }

    return limits;
  }

  /**
   * Get health status of all providers.
   */
  async getProvidersHealth(): Promise<Record<string, unknown>> {
    const health: Record<string, unknown> = {};

    for (const [name, adapter] of this.providers.entries()) {
      health[name] = adapter.getHealth();
    }

    return health;
  }

  /**
   * Clear message deduplication tracking.
   */
  clearDeduplicationTracking(): void {
    this.sentMessages.clear();
  }

  /**
   * Select optimal providers based on cost.
   * Returns providers in order of cost (cheapest first).
   */
  private selectOptimalProviders(
    providers: string[],
    costPerMessage: Record<string, number>
  ): string[] {
    const costsArray = providers.map((p) => ({
      provider: p,
      cost: costPerMessage[p] || 0.01, // Default cost
    }));

    return costsArray.sort((a, b) => a.cost - b.cost).map((c) => c.provider);
  }

  /**
   * Check if message is a duplicate.
   */
  private isDuplicate(channel: string, recipient: string, content: string): boolean {
    const key = `${channel}:${recipient}`;
    const hash = this.hashContent(content);
    const existing = this.sentMessages.get(key);

    if (!existing) {
      return false;
    }

    const timeSinceLastSend = Date.now() - existing.timestamp;
    const config = this.routingConfig.get(channel);
    const deduplicationWindow = config?.deduplicationWindow || 30000;

    return existing.hash === hash && timeSinceLastSend < deduplicationWindow;
  }

  /**
   * Track a sent message for deduplication.
   */
  private trackSentMessage(channel: string, recipient: string, content: string): void {
    const key = `${channel}:${recipient}`;
    const hash = this.hashContent(content);
    this.sentMessages.set(key, { timestamp: Date.now(), hash });

    // Clean up old entries periodically
    if (this.sentMessages.size > 10000) {
      this.cleanupOldDuplicates();
    }
  }

  /**
   * Simple hash function for content.
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clean up old deduplication entries.
   */
  private cleanupOldDuplicates(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minute

    for (const [key, value] of this.sentMessages.entries()) {
      if (now - value.timestamp > maxAge) {
        this.sentMessages.delete(key);
      }
    }
  }
}
