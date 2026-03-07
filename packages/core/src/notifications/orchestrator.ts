/**
 * Notification Orchestrator
 * Coordinates template rendering, provider routing, and delivery.
 *
 * Flow:
 *   1. Load template from DB (by templateId)
 *   2. Render template with variables
 *   3. Route to provider (channel + credentials)
 *   4. Send notification
 *   5. Log delivery attempt
 */

import type {
  NotificationProvider,
  NotificationMessage,
  NotificationResult,
} from "./providers/types.js";

import { SendGridEmailProvider } from "./providers/sendgrid.js";
import { TwilioSMSProvider } from "./providers/twilio.js";
import { FirebasePushProvider } from "./providers/firebase-push.js";
import { WhatsAppProvider } from "./providers/whatsapp.js";

/**
 * Provider registry — maps channel + provider name to instance.
 */
interface ProviderRegistry {
  [channel: string]: {
    [providerName: string]: NotificationProvider;
  };
}

/**
 * Template from database.
 */
export interface NotificationTemplate {
  id: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
  name: string;
  subject?: string;
  body: string;
  textBody?: string;
}

/**
 * Notification orchestrator — main coordinator for multi-channel notifications.
 */
export class NotificationOrchestrator {
  private providers: ProviderRegistry = {
    EMAIL: {},
    SMS: {},
    WHATSAPP: {},
    PUSH: {},
  };

  private fallbackChain: Map<string, string[]> = new Map([
    ["EMAIL", ["sendgrid", "mailgun", "aws_ses"]],
    ["SMS", ["twilio", "vonage", "aws_sns"]],
    ["WHATSAPP", ["meta_cloud", "twilio_whatsapp", "360dialog"]],
    ["PUSH", ["firebase", "onesignal", "expo_push"]],
  ]);

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize default providers.
   * In production, providers are registered based on shop credentials.
   */
  private initializeProviders(): void {
    // TODO: Load from shop.settings.notifications and deployer env vars
    // For now, register mock providers
  }

  /**
   * Register a provider instance for a channel.
   */
  registerProvider(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    providerName: string,
    provider: NotificationProvider,
  ): void {
    if (!this.providers[channel]) {
      this.providers[channel] = {};
    }
    this.providers[channel][providerName] = provider;
  }

  /**
   * Get a provider instance for a channel.
   */
  getProvider(
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    providerName: string,
  ): NotificationProvider | undefined {
    return this.providers[channel]?.[providerName];
  }

  /**
   * Send a notification through the configured provider.
   *
   * @param shopId Shop/tenant identifier for multi-tenancy
   * @param channel Notification channel (EMAIL, SMS, WHATSAPP, PUSH)
   * @param to Recipient (email, phone, device token)
   * @param templateId Template identifier from database
   * @param variables Template variables for interpolation
   * @returns Send result with status and message ID
   */
  async sendNotification(
    shopId: string,
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    to: string,
    templateId: string,
    variables: Record<string, unknown> = {},
  ): Promise<NotificationResult> {
    try {
      // Step 1: Load template from database
      // TODO: Fetch from prisma client
      // const template = await db.notificationTemplate.findUniqueOrThrow({
      //   where: { id_channel: { id: templateId, channel } },
      // });

      const template: NotificationTemplate = {
        id: templateId,
        channel,
        name: "mock-template",
        subject: "Test Subject",
        body: "Test body with {{name}}",
      };

      // Step 2: Render template with variables
      // TODO: Use @witylogix/core/templates renderTemplate
      // const rendered = await renderTemplate(template.body, variables);
      const rendered = this.renderTemplate(template.body, variables);

      // Step 3: Build message object
      const message: NotificationMessage = {
        to,
        subject: template.subject
          ? this.renderTemplate(template.subject, variables)
          : undefined,
        body: rendered,
        textBody: template.textBody
          ? this.renderTemplate(template.textBody, variables)
          : undefined,
        templateId,
        variables,
        metadata: {
          shopId,
          templateId,
          channel,
        },
      };

      // Step 4: Attempt send with fallback chain
      const result = await this.sendWithFallback(shopId, channel, message);

      // Step 5: Log delivery attempt
      // TODO: Log to database
      console.log(`[notifications:${channel}] Sent to ${to}:`, {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failed attempt
      console.error(`[notifications:${channel}] Failed to send to ${to}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        providerResponse: error,
      };
    }
  }

  /**
   * Send a notification with fallback chain.
   * Tries primary provider, then secondary, etc. until one succeeds.
   */
  private async sendWithFallback(
    shopId: string,
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
    message: NotificationMessage,
  ): Promise<NotificationResult> {
    const fallbackProviders = this.fallbackChain.get(channel) || [];

    // Try each provider in fallback chain
    for (const providerName of fallbackProviders) {
      const provider = this.getProvider(channel, providerName);

      if (!provider) {
        console.warn(`[notifications:${channel}] Provider ${providerName} not registered, skipping`);
        continue;
      }

      try {
        const result = await provider.send(message);

        if (result.success) {
          // Success — log which provider was used
          console.log(
            `[notifications:${channel}] Successfully sent via ${providerName} (msgId: ${result.messageId})`,
          );
          return result;
        }

        // Provider returned failure, continue to next
        console.warn(
          `[notifications:${channel}] ${providerName} failed: ${result.error}, trying next...`,
        );
      } catch (error) {
        // Provider threw exception, continue to next
        console.error(
          `[notifications:${channel}] ${providerName} threw error: ${error instanceof Error ? error.message : String(error)}, trying next...`,
        );
      }
    }

    // All providers failed
    return {
      success: false,
      error: `All providers in fallback chain failed for channel ${channel}`,
    };
  }

  /**
   * Simple template rendering — replaces {{variable}} with values.
   * TODO: Use renderTemplate from @witylogix/core/templates for full support.
   */
  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      rendered = rendered.replace(placeholder, String(value));
    }

    return rendered;
  }

  /**
   * Get the status of all registered providers.
   */
  async getProviderStatuses(): Promise<
    Record<string, Record<string, Awaited<ReturnType<NotificationProvider["getStatus"]>>>>
  > {
    const statuses: Record<
      string,
      Record<string, Awaited<ReturnType<NotificationProvider["getStatus"]>>>
    > = {};

    for (const [channel, providers] of Object.entries(this.providers)) {
      statuses[channel] = {};

      for (const [providerName, provider] of Object.entries(providers)) {
        try {
          statuses[channel][providerName] = await provider.getStatus();
        } catch (error) {
          statuses[channel][providerName] = {
            healthy: false,
            lastError: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    return statuses;
  }
}

/**
 * Global singleton orchestrator instance.
 */
let orchestratorInstance: NotificationOrchestrator | null = null;

/**
 * Get the global notification orchestrator instance.
 */
export function getNotificationOrchestrator(): NotificationOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new NotificationOrchestrator();
  }
  return orchestratorInstance;
}
