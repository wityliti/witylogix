/**
 * Notification dispatcher - unified multi-channel notification system
 * Supports email, SMS, and push notifications with fallback chain
 */

import type { EmailConfig, EmailMessage, EmailResult } from '../email/types.js';
import type { SmsConfig, SmsMessage, SmsResult } from '../sms/types.js';
import { EmailService } from '../email/index.js';
import { SmsService } from '../sms/index.js';

/**
 * Notification channel type
 */
export type NotificationChannel = 'email' | 'sms' | 'push';

/**
 * Base notification interface
 */
export interface BaseNotification {
  type: NotificationChannel;
  recipient: string;
  metadata?: Record<string, any>;
}

/**
 * Email notification
 */
export interface EmailNotification extends BaseNotification {
  type: 'email';
  templateId?: string;
  subject?: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

/**
 * SMS notification
 */
export interface SmsNotification extends BaseNotification {
  type: 'sms';
  body: string;
}

/**
 * Push notification (stub for future implementation)
 */
export interface PushNotification extends BaseNotification {
  type: 'push';
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Union type for notifications
 */
export type Notification = EmailNotification | SmsNotification | PushNotification;

/**
 * Dispatch result combining all channel results
 */
export interface DispatchResult {
  primaryResult?: EmailResult | SmsResult | null;
  fallbackResults?: Array<EmailResult | SmsResult | null>;
  channelAttempts: {
    channel: NotificationChannel;
    success: boolean;
    error?: string;
  }[];
  totalAttempts: number;
  successfulChannel?: NotificationChannel;
}

/**
 * Multi-channel notification dispatcher
 * Handles email, SMS, and push notifications with automatic fallback
 */
export class NotificationDispatcher {
  private emailService: EmailService;
  private smsService: SmsService;
  private emailTemplates: Map<string, string> = new Map();
  private fallbackChain: NotificationChannel[] = [];

  constructor(emailConfig: EmailConfig, smsConfig: SmsConfig) {
    this.emailService = new EmailService(emailConfig);
    this.smsService = new SmsService(smsConfig);
    this.fallbackChain = ['email', 'sms'];
  }

  /**
   * Register an email template for use in notifications
   */
  registerEmailTemplate(templateId: string, subject: string, html: string, text?: string): void {
    const templateKey = `${templateId}:subject`;
    this.emailTemplates.set(templateKey, subject);
    this.emailTemplates.set(`${templateId}:html`, html);
    if (text) {
      this.emailTemplates.set(`${templateId}:text`, text);
    }
  }

  /**
   * Dispatch a notification to a single channel
   */
  async dispatch(notification: Notification): Promise<DispatchResult> {
    const result: DispatchResult = {
      channelAttempts: [],
      totalAttempts: 0,
      primaryResult: null,
    };

    try {
      const sendResult = await this.sendToChannel(notification);
      result.primaryResult = sendResult;
      result.channelAttempts.push({
        channel: notification.type,
        success: true,
      });
      result.successfulChannel = notification.type;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.channelAttempts.push({
        channel: notification.type,
        success: false,
        error: errorMessage,
      });

      // Try fallback channels
      result.fallbackResults = [];
      for (const fallbackChannel of this.fallbackChain) {
        if (fallbackChannel === notification.type) continue;

        try {
          const fallbackNotification: Notification = {
            ...notification,
            type: fallbackChannel,
          };
          const fallbackResult = await this.sendToChannel(fallbackNotification);
          result.fallbackResults.push(fallbackResult);
          result.channelAttempts.push({
            channel: fallbackChannel,
            success: true,
          });
          result.successfulChannel = fallbackChannel;
          break;
        } catch (fallbackError) {
          const fallbackErrorMessage = fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
          result.fallbackResults.push(null);
          result.channelAttempts.push({
            channel: fallbackChannel,
            success: false,
            error: fallbackErrorMessage,
          });
        }
      }
    }

    result.totalAttempts = result.channelAttempts.length;
    return result;
  }

  /**
   * Dispatch to multiple channels simultaneously
   */
  async dispatchMultiChannel(
    channels: NotificationChannel[],
    recipient: string,
    template: { id: string; subject?: string; body?: string },
    variables?: Record<string, any>,
  ): Promise<Map<NotificationChannel, DispatchResult>> {
    const results = new Map<NotificationChannel, DispatchResult>();

    const promises = channels.map(async (channel) => {
      let notification: Notification;

      if (channel === 'email') {
        const subject = template.subject || this.emailTemplates.get(`${template.id}:subject`) || '';
        const html = this.emailTemplates.get(`${template.id}:html`) || '';
        notification = {
          type: 'email',
          recipient,
          subject,
          html,
          templateId: template.id,
        };
      } else if (channel === 'sms') {
        notification = {
          type: 'sms',
          recipient,
          body: template.body || '',
        };
      } else {
        notification = {
          type: 'push',
          recipient,
          title: template.subject || '',
          body: template.body || '',
        };
      }

      const result = await this.dispatch(notification);
      results.set(channel, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Set the fallback channel chain
   */
  setFallbackChain(channels: NotificationChannel[]): void {
    this.fallbackChain = channels.filter((c) => c !== 'push');
  }

  /**
   * Send notification to a specific channel
   */
  private async sendToChannel(
    notification: Notification,
  ): Promise<EmailResult | SmsResult> {
    switch (notification.type) {
      case 'email': {
        const emailNotif = notification as EmailNotification;
        const emailMessage: EmailMessage = {
          to: emailNotif.recipient,
          from: '',
          subject: emailNotif.subject || '',
          html: emailNotif.html,
          text: emailNotif.text,
          cc: emailNotif.cc,
          bcc: emailNotif.bcc,
          replyTo: emailNotif.replyTo,
          metadata: emailNotif.metadata,
        };
        return this.emailService.send(emailMessage);
      }

      case 'sms': {
        const smsNotif = notification as SmsNotification;
        const smsMessage: SmsMessage = {
          to: smsNotif.recipient,
          body: smsNotif.body,
          metadata: smsNotif.metadata,
        };
        return this.smsService.send(smsMessage);
      }

      case 'push':
        throw new Error('Push notifications not yet implemented');

      default:
        throw new Error(`Unknown notification type: ${(notification as any).type}`);
    }
  }

  /**
   * Clean up resources
   */
  async disconnect(): Promise<void> {
    await Promise.all([this.emailService.disconnect(), this.smsService.disconnect()]);
  }
}

// Export types
export type {
  EmailConfig,
  EmailMessage,
  EmailResult,
  SmsConfig,
  SmsMessage,
  SmsResult,
};

// ─── ROUTE DISPATCH EXPORTS ─────────────────────────────────────────
// Route dispatch service for the Route Timeline Dispatcher Dashboard
export { DispatchService, createDispatchService } from "./dispatch-service.js";
export type {
  Route,
  Stop,
  Driver,
  DispatchStats,
  OptimizeRoutesRequest,
  OptimizeRoutesResult,
  ReassignStopRequest,
  ReassignStopResult,
  RouteUpdate,
  StopUpdate,
  DriverLocationUpdate,
  BatchRouteOperation,
  BatchOperationResult,
  RouteFilterOptions,
  PaginatedRoutes,
  RouteStatus,
  StopStatus,
  StopType,
  DriverStatus,
  VehicleType,
} from "./types.js";

export {
  ROUTE_COLORS,
  getRouteColor,
  getAllRouteColors,
  getColorIndexForIdentifier,
  getRouteColorForIdentifier,
  lightenColor,
  darkenColor,
  hexToRgb,
  hexToRgbString,
} from "./route-colors.js";
export type { RouteColorIndex } from "./route-colors.js";
