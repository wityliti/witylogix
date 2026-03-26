/**
 * Notification Service — Main service for sending multi-channel notifications
 */

import {
  NotificationRequest,
  SendResult,
  NotificationRecord,
  DeliveryStatus,
  NotificationServiceConfig,
  NotificationChannel,
} from "./types.js";
import { TemplateEngine } from "./template-engine.js";
import { PreferenceManager } from "./preference-manager.js";
import { EmailChannel } from "./channels/email-channel.js";
import { SMSChannel } from "./channels/sms-channel.js";
import { WhatsAppChannel } from "./channels/whatsapp-channel.js";
import { PushChannel } from "./channels/push-channel.js";
import { RateLimiter } from "./rate-limiter.js";
import { UrlShortener } from "./url-shortener.js";
import { WebhookManager } from "./webhook-delivery.js";

/**
 * In-memory notification history store
 */
const notificationHistory = new Map<string, NotificationRecord[]>();

/**
 * Notification Service
 */
export class NotificationService {
  private config: NotificationServiceConfig;
  private emailChannel: EmailChannel;
  private smsChannel: SMSChannel;
  private whatsappChannel: WhatsAppChannel;
  private pushChannel: PushChannel;
  private rateLimiter: RateLimiter;
  private urlShortener: UrlShortener;

  constructor(config: NotificationServiceConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimitConfig);
    this.urlShortener = new UrlShortener(config.trackingBaseUrl);

    // Initialize channels
    this.emailChannel = new EmailChannel(config.emailFrom || "noreply@witylogix.com");
    this.smsChannel = new SMSChannel(config.smsSender || "+1234567890");
    this.whatsappChannel = new WhatsAppChannel("", ""); // Would be initialized with real credentials
    this.pushChannel = new PushChannel(
      config.vapidPublicKey || "",
      config.vapidPrivateKey || ""
    );
  }

  /**
   * Send a single notification
   */
  async send(request: NotificationRequest): Promise<SendResult[]> {
    const results: SendResult[] = [];

    try {
      // Validate request
      if (!request.customerId) {
        return [
          {
            success: false,
            notificationId: "",
            channel: "email",
            error: "Customer ID is required",
            timestamp: new Date(),
          },
        ];
      }

      // Determine channels to use
      let channels = request.channels || [];
      if (channels.length === 0) {
        // Use available channels for this customer and event
        channels = PreferenceManager.getAvailableChannels(
          request.customerId,
          request.eventType
        );
      }

      // Generate tracking URL if available
      let trackingUrl = request.data.trackingUrl;
      if (trackingUrl) {
        try {
          const shortened = this.urlShortener.shortenUrl(trackingUrl);
          trackingUrl = shortened.shortUrl;
          request.data.trackingUrl = trackingUrl;
        } catch (error) {
          console.error("Failed to shorten tracking URL:", error);
        }
      }

      // Send through each channel
      for (const channel of channels) {
        // Check rate limiting
        if (!this.rateLimiter.canSend(request.customerId, channel)) {
          const status = this.rateLimiter.getStatus(request.customerId, channel);
          const result: SendResult = {
            success: false,
            notificationId: this.generateNotificationId(),
            channel,
            error: `Rate limit exceeded (${status.sentToday}/${status.limit})`,
            timestamp: new Date(),
          };
          results.push(result);
          continue;
        }

        // Send notification
        const result = await this.sendToChannel(channel, request);
        results.push(result);

        // Record send
        if (result.success) {
          this.rateLimiter.recordSend(request.customerId, channel);
          this.recordNotification(request.customerId, result);
        }

        // Fire webhooks
        if (result.success) {
          await WebhookManager.fireWebhooks("delivery.scheduled", {
            customerId: request.customerId,
            eventType: request.eventType,
            channel,
            notificationId: result.notificationId,
          });
        }
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [
        {
          success: false,
          notificationId: "",
          channel: "email",
          error: errorMessage,
          timestamp: new Date(),
        },
      ];
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(requests: NotificationRequest[]): Promise<SendResult[][]> {
    const allResults: SendResult[][] = [];

    for (const request of requests) {
      const results = await this.send(request);
      allResults.push(results);

      // Add small delay between sends
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return allResults;
  }

  /**
   * Send to a specific channel
   */
  private async sendToChannel(
    channel: NotificationChannel,
    request: NotificationRequest
  ): Promise<SendResult> {
    const notificationId = this.generateNotificationId();

    try {
      // Render template
      const template = TemplateEngine.renderTemplate(
        request.eventType,
        request.data,
        channel
      );

      switch (channel) {
        case "email": {
          const result = await this.emailChannel.sendEmail({
            to: request.data.customerEmail || "",
            subject: template.subject || "",
            html: template.html || "",
            text: template.text || "",
          });

          return {
            success: result.accepted,
            notificationId,
            channel,
            messageId: result.messageId,
            error: result.error,
            timestamp: new Date(),
          };
        }

        case "sms": {
          const result = await this.smsChannel.sendSMS({
            to: request.data.customerPhone || "",
            message: template.text || "",
          });

          return {
            success: result.accepted,
            notificationId,
            channel,
            messageId: result.messageId,
            error: result.error,
            timestamp: new Date(),
          };
        }

        case "whatsapp": {
          const result = await this.whatsappChannel.sendWhatsApp({
            to: request.data.customerPhone || "",
            templateName: request.eventType,
            templateParams: template.templateParams || [],
          });

          return {
            success: result.accepted,
            notificationId,
            channel,
            messageId: result.messageId,
            error: result.error,
            timestamp: new Date(),
          };
        }

        case "push": {
          // For push, we'd need subscription details from the customer
          // For now, skip if not provided
          const pushSubscription = request.data.pushSubscription;
          if (!pushSubscription) {
            return {
              success: false,
              notificationId,
              channel,
              error: "Push subscription not provided",
              timestamp: new Date(),
            };
          }

          const result = await this.pushChannel.sendPush({
            subscription: JSON.parse(pushSubscription),
            title: template.title || "",
            body: template.body || "",
            icon: "/icon-192.png",
          });

          return {
            success: result.accepted,
            notificationId,
            channel,
            messageId: result.messageId,
            error: result.error,
            timestamp: new Date(),
          };
        }

        default:
          throw new Error(`Unknown channel: ${channel}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        notificationId,
        channel,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get notification history
   */
  getHistory(customerId: string, limit: number = 50): NotificationRecord[] {
    const history = notificationHistory.get(customerId) || [];
    return history.slice(-limit);
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(notificationId: string): DeliveryStatus | null {
    // Search through all customer histories
    for (const [, records] of notificationHistory) {
      // In a real implementation, we'd have a separate index
      // For now, we'll just return a mock status
    }

    return null;
  }

  /**
   * Record notification in history
   */
  private recordNotification(customerId: string, result: SendResult): void {
    let history = notificationHistory.get(customerId) || [];

    const record: NotificationRecord = {
      id: result.notificationId,
      customerId,
      eventType: "order_confirmed", // Would come from request
      channel: result.channel,
      messageId: result.messageId,
      status: result.success ? "sent" : "failed",
      error: result.error,
      sentAt: result.timestamp,
    };

    history.push(record);

    // Keep only last 1000 records per customer
    if (history.length > 1000) {
      history = history.slice(-1000);
    }

    notificationHistory.set(customerId, history);
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get rate limiter instance
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Get URL shortener instance
   */
  getUrlShortener(): UrlShortener {
    return this.urlShortener;
  }

  /**
   * Clear history (for testing)
   */
  clearHistory(): void {
    notificationHistory.clear();
  }
}
