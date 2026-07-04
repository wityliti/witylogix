/**
 * Collaboration Hub Engine
 * Unified messaging, presence, and notification routing across platforms
 */

import { CollaborationAdapter } from "./collaboration-adapter";
import { SlackClient } from "./slack-client";
import { TeamsClient } from "./teams-client";
import { PusherClient } from "./pusher-client";
import {
  CollaborationAdapterInterface,
  CollaborationAttachment,
  CollaborationChannel,
  CollaborationConfig,
  CollaborationMessage,
  CollaborationPresence,
  CollaborationUser,
  CollaborationWebhookEvent,
  CrossPlatformPresence,
  DeliveryStatus,
  MessageTemplate,
  NotificationRule,
  CollaborationHubConfig,
  WebhookEventType,
  ChannelType,
  MessageType,
  PresenceStatus,
} from "./types";

export class CollaborationHub {
  private config: CollaborationHubConfig;
  private adapters: Map<string, CollaborationAdapterInterface> = new Map();
  private messageTemplates: Map<string, MessageTemplate> = new Map();
  private notificationRules: NotificationRule[] = [];
  private deliveryTracking: Map<string, DeliveryStatus> = new Map();
  private crossPlatformPresence: Map<string, CrossPlatformPresence> = new Map();
  private presenceSyncInterval?: NodeJS.Timeout;
  private operationSemaphore: number = 0;

  constructor(config: CollaborationHubConfig) {
    this.config = config;

    // Initialize adapters
    if (config.adapters.slack) {
      this.adapters.set("slack", new SlackClient(config.adapters.slack));
    }
    if (config.adapters.teams) {
      this.adapters.set("teams", new TeamsClient(config.adapters.teams));
    }
    if (config.adapters.pusher) {
      this.adapters.set("pusher", new PusherClient(config.adapters.pusher));
    }

    // Initialize message templates
    if (config.messageTemplates) {
      for (const template of config.messageTemplates) {
        this.messageTemplates.set(template.id, template);
      }
    }

    // Initialize notification rules
    this.notificationRules = config.notificationRules || [];
  }

  /**
   * Connect all adapters
   */
  async connect(): Promise<void> {
    try {
      const promises = Array.from(this.adapters.values()).map((adapter) =>
        adapter.connect().catch((error) => {
          console.error(`Failed to connect adapter: ${error}`);
        }),
      );

      await Promise.all(promises);

      // Start presence sync
      this.startPresenceSync();
    } catch (error) {
      throw new Error(`Failed to connect collaboration hub: ${error}`);
    }
  }

  /**
   * Disconnect all adapters
   */
  async disconnect(): Promise<void> {
    try {
      if (this.presenceSyncInterval) {
        clearInterval(this.presenceSyncInterval);
      }

      const promises = Array.from(this.adapters.values()).map((adapter) =>
        adapter.disconnect().catch((error) => {
          console.error(`Failed to disconnect adapter: ${error}`);
        }),
      );

      await Promise.all(promises);
    } catch (error) {
      throw new Error(`Failed to disconnect collaboration hub: ${error}`);
    }
  }

  /**
   * Send message to multiple platforms
   */
  async sendCrossplatformMessage(
    targetChannels: {
      platform: "slack" | "teams" | "pusher";
      channelId: string;
    }[],
    content: string,
    options?: {
      type?: MessageType;
      richContent?: Record<string, unknown>;
      attachments?: CollaborationAttachment[];
      templateId?: string;
      formatting?: "rich" | "plain" | "markdown";
      metadata?: Record<string, unknown>;
    },
  ): Promise<
    { platform: string; channelId: string; message: CollaborationMessage }[]
  > {
    try {
      // Apply rate limiting
      await this.applyHubRateLimit();

      // Format message for each platform
      const formattedMessages = await Promise.all(
        targetChannels.map(async (target) => {
          const formatted = await this.formatMessageForPlatform(
            target.platform,
            content,
            options,
          );

          return { ...target, formatted };
        }),
      );

      // Send messages in parallel with semaphore control
      const results: {
        platform: string;
        channelId: string;
        message: CollaborationMessage;
      }[] = [];

      for (const target of formattedMessages) {
        while (
          this.operationSemaphore >= (this.config.maxConcurrentOperations || 5)
        ) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        this.operationSemaphore += 1;

        try {
          const adapter = this.adapters.get(target.platform);
          if (!adapter) {
            throw new Error(`No adapter for platform: ${target.platform}`);
          }

          const message = await adapter.sendMessage(
            target.channelId,
            target.formatted.content,
            {
              type: options?.type,
              richContent: target.formatted.richContent,
              attachments: options?.attachments,
              metadata: options?.metadata,
            },
          );

          // Track delivery
          this.trackDelivery(
            message.id,
            target.channelId,
            target.platform,
            "sent",
          );

          results.push({
            platform: target.platform,
            channelId: target.channelId,
            message,
          });
        } catch (error) {
          console.error(
            `Failed to send message to ${target.platform}/${target.channelId}: ${error}`,
          );

          // Record failure
          const failureId = `${target.platform}:${target.channelId}`;
          this.trackDelivery(
            failureId,
            target.channelId,
            target.platform,
            "failed",
          );
        } finally {
          this.operationSemaphore -= 1;
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to send crossplatform message: ${error}`);
    }
  }

  /**
   * Format message for specific platform
   */
  private async formatMessageForPlatform(
    platform: "slack" | "teams" | "pusher",
    content: string,
    options?: {
      templateId?: string;
      formatting?: "rich" | "plain" | "markdown";
      richContent?: Record<string, unknown>;
    },
  ): Promise<{ content: string; richContent?: Record<string, unknown> }> {
    let formatted = content;
    let richContent = options?.richContent;

    // Apply template if specified
    if (options?.templateId) {
      const template = this.messageTemplates.get(options.templateId);
      if (template) {
        if (template.platform === "all" || template.platform === platform) {
          formatted = template.content;
          richContent = template.richContent;

          // Replace variables
          if (template.variables) {
            for (const variable of template.variables) {
              formatted = formatted.replace(
                new RegExp(`{{${variable}}}`, "g"),
                content,
              );
            }
          }
        }
      }
    }

    // Apply platform-specific formatting
    switch (platform) {
      case "slack":
        return this.formatSlackMessage(formatted, richContent);
      case "teams":
        return this.formatTeamsMessage(formatted, richContent);
      case "pusher":
        return this.formatPusherMessage(formatted, richContent);
      default:
        return { content: formatted, richContent };
    }
  }

  /**
   * Format message for Slack (Block Kit)
   */
  private formatSlackMessage(
    content: string,
    richContent?: Record<string, unknown>,
  ): { content: string; richContent?: Record<string, unknown> } {
    const blocks = richContent?.blocks || [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: content,
        },
      },
    ];

    return {
      content,
      richContent: { blocks },
    };
  }

  /**
   * Format message for Microsoft Teams (Adaptive Cards)
   */
  private formatTeamsMessage(
    content: string,
    richContent?: Record<string, unknown>,
  ): { content: string; richContent?: Record<string, unknown> } {
    const adaptiveCards = richContent?.adaptiveCards || [
      {
        type: "AdaptiveCard",
        body: [
          {
            type: "TextBlock",
            text: content,
            wrap: true,
          },
        ],
      },
    ];

    return {
      content,
      richContent: { adaptiveCards },
    };
  }

  /**
   * Format message for Pusher
   */
  private formatPusherMessage(
    content: string,
    richContent?: Record<string, unknown>,
  ): { content: string; richContent?: Record<string, unknown> } {
    return {
      content,
      richContent,
    };
  }

  /**
   * Get aggregated presence across platforms
   */
  async getCrossPlatformPresence(
    userId: string,
  ): Promise<CrossPlatformPresence | null> {
    try {
      const cached = this.crossPlatformPresence.get(userId);
      if (cached && Date.now() - cached.lastUpdateTime.getTime() < 30000) {
        return cached;
      }

      const platforms: {
        slack?: CollaborationPresence;
        teams?: CollaborationPresence;
        pusher?: CollaborationPresence;
      } = {};

      let aggregatedStatus: PresenceStatus = "offline";

      for (const [name, adapter] of this.adapters) {
        try {
          const presence = await adapter.getUserPresence(userId);
          if (presence) {
            platforms[name as keyof typeof platforms] = presence;

            // Determine aggregated status (prioritize active)
            if (presence.status === "active") {
              aggregatedStatus = "active";
            } else if (
              presence.status === "do_not_disturb" &&
              aggregatedStatus !== "active"
            ) {
              aggregatedStatus = "do_not_disturb";
            } else if (
              presence.status === "away" &&
              aggregatedStatus === "offline"
            ) {
              aggregatedStatus = "away";
            }
          }
        } catch (error) {
          console.error(
            `Failed to get presence from ${name} adapter: ${error}`,
          );
        }
      }

      const result: CrossPlatformPresence = {
        userId,
        platforms,
        aggregatedStatus,
        lastUpdateTime: new Date(),
      };

      this.crossPlatformPresence.set(userId, result);
      return result;
    } catch (error) {
      console.error(`Failed to get cross-platform presence: ${error}`);
      return null;
    }
  }

  /**
   * Route notification based on rules
   */
  async routeNotification(
    message: CollaborationMessage,
    sourceChannelId: string,
  ): Promise<{
    notified: boolean;
    channels: { platform: string; channelId: string }[];
  }> {
    try {
      const channels: { platform: string; channelId: string }[] = [];

      // Find matching rules
      for (const rule of this.notificationRules) {
        if (!rule.enabled) continue;

        // Check conditions
        const matches = this.checkNotificationRuleConditions(rule, message);

        if (matches) {
          // Apply actions
          if (rule.actions.notifyChannels) {
            for (const channelId of rule.actions.notifyChannels) {
              const platform = this.determinePlatformFromChannelId(channelId);
              channels.push({ platform, channelId });
            }
          }

          if (rule.actions.notifyUsers) {
            for (const userId of rule.actions.notifyUsers) {
              // Send direct messages to users
              // Implementation depends on platform
            }
          }

          // Use fallback platform if available
          if (channels.length === 0 && rule.actions.fallbackPlatform) {
            channels.push({
              platform: rule.actions.fallbackPlatform,
              channelId: sourceChannelId,
            });
          }
        }
      }

      const notified = channels.length > 0;

      return { notified, channels };
    } catch (error) {
      console.error(`Failed to route notification: ${error}`);
      return { notified: false, channels: [] };
    }
  }

  /**
   * Check notification rule conditions
   */
  private checkNotificationRuleConditions(
    rule: NotificationRule,
    message: CollaborationMessage,
  ): boolean {
    const { conditions } = rule;

    if (
      conditions.messageType &&
      !conditions.messageType.includes(message.type)
    ) {
      return false;
    }

    if (
      conditions.platforms &&
      !conditions.platforms.includes(message.platform)
    ) {
      return false;
    }

    if (conditions.keywords && conditions.keywords.length > 0) {
      const hasKeyword = conditions.keywords.some((keyword) =>
        message.content.toLowerCase().includes(keyword.toLowerCase()),
      );
      if (!hasKeyword) return false;
    }

    return true;
  }

  /**
   * Track message delivery
   */
  private trackDelivery(
    messageId: string,
    channelId: string,
    platform: "slack" | "teams" | "pusher",
    status: "pending" | "sent" | "delivered" | "failed" | "read",
  ): void {
    if (!this.config.deliveryTrackingEnabled) return;

    const key = `${platform}:${messageId}`;
    const existing = this.deliveryTracking.get(key) || {
      messageId,
      channelId,
      platform,
      status: "pending",
      retryCount: 0,
    };

    const updated: DeliveryStatus = {
      ...existing,
      status,
    };

    if (status === "sent") {
      updated.sentAt = new Date();
    } else if (status === "delivered") {
      updated.deliveredAt = new Date();
    } else if (status === "read") {
      updated.readAt = new Date();
    }

    this.deliveryTracking.set(key, updated);
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(messageId: string): DeliveryStatus | null {
    for (const status of this.deliveryTracking.values()) {
      if (status.messageId === messageId) {
        return status;
      }
    }
    return null;
  }

  /**
   * Start presence sync across platforms
   */
  private startPresenceSync(): void {
    const interval = this.config.presenceSyncInterval || 60000;

    this.presenceSyncInterval = setInterval(async () => {
      try {
        // Sync presence for all tracked users
        for (const userId of this.crossPlatformPresence.keys()) {
          const presence = await this.getCrossPlatformPresence(userId);
          if (presence) {
            // Update all adapters with aggregated status
            for (const [platform, adapter] of this.adapters) {
              try {
                await adapter.setUserPresence(
                  userId,
                  presence.aggregatedStatus,
                  `Synced from ${
                    Object.keys(presence.platforms).find(
                      (p) =>
                        presence.platforms[p as keyof typeof presence.platforms]
                          ?.status === "active",
                    ) || "multiple"
                  }`,
                );
              } catch (error) {
                console.error(
                  `Failed to sync presence to ${platform}: ${error}`,
                );
              }
            }
          }
        }
      } catch (error) {
        console.error(`Presence sync error: ${error}`);
      }
    }, interval);
  }

  /**
   * Apply hub-level rate limiting
   */
  private async applyHubRateLimit(): Promise<void> {
    // Simple rate limiting based on max concurrent operations
    while (
      this.operationSemaphore >= (this.config.maxConcurrentOperations || 5)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Helper to determine platform from channel ID
   */
  private determinePlatformFromChannelId(
    channelId: string,
  ): "slack" | "teams" | "pusher" {
    if (channelId.startsWith("slack-")) return "slack";
    if (channelId.startsWith("teams-")) return "teams";
    if (channelId.startsWith("pusher-")) return "pusher";
    return this.config.primaryPlatform;
  }

  /**
   * Get all adapters
   */
  getAdapters(): Map<string, CollaborationAdapterInterface> {
    return this.adapters;
  }

  /**
   * Get specific adapter
   */
  getAdapter(
    platform: "slack" | "teams" | "pusher",
  ): CollaborationAdapterInterface | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Health check
   */
  async health(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    adapters: Record<string, "healthy" | "degraded" | "unhealthy">;
  }> {
    try {
      const adapterHealth: Record<
        string,
        "healthy" | "degraded" | "unhealthy"
      > = {};

      for (const [name, adapter] of this.adapters) {
        const health = await adapter.health();
        adapterHealth[name] = health.status;
      }

      const allHealthy = Object.values(adapterHealth).every(
        (status) => status === "healthy",
      );
      const anyUnhealthy = Object.values(adapterHealth).some(
        (status) => status === "unhealthy",
      );

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (anyUnhealthy) {
        status = "unhealthy";
      } else if (!allHealthy) {
        status = "degraded";
      }

      return { status, adapters: adapterHealth };
    } catch (error) {
      return {
        status: "unhealthy",
        adapters: {},
      };
    }
  }

  /**
   * Register notification rule
   */
  addNotificationRule(rule: NotificationRule): void {
    this.notificationRules.push(rule);
  }

  /**
   * Remove notification rule
   */
  removeNotificationRule(ruleId: string): void {
    this.notificationRules = this.notificationRules.filter(
      (r) => r.id !== ruleId,
    );
  }

  /**
   * Add message template
   */
  addMessageTemplate(template: MessageTemplate): void {
    this.messageTemplates.set(template.id, template);
  }

  /**
   * Remove message template
   */
  removeMessageTemplate(templateId: string): void {
    this.messageTemplates.delete(templateId);
  }
}
