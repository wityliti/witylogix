/**
 * Push Channel — Send web push notifications
 */

import { PushResult, PushAction } from "../types.js";

/**
 * Push subscription object
 */
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Push notification parameters
 */
export interface PushParams {
  subscription: PushSubscription;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  actions?: PushAction[];
  data?: Record<string, string>;
}

/**
 * Push Channel — handles web push notifications
 */
export class PushChannel {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private vapidSubject: string;

  constructor(
    vapidPublicKey: string,
    vapidPrivateKey: string,
    vapidSubject: string = "mailto:support@witylogix.com"
  ) {
    this.vapidPublicKey = vapidPublicKey;
    this.vapidPrivateKey = vapidPrivateKey;
    this.vapidSubject = vapidSubject;
  }

  /**
   * Send a push notification
   */
  async sendPush(params: PushParams): Promise<PushResult> {
    try {
      // Validate input
      if (!params.subscription) {
        return {
          accepted: false,
          error: "Subscription is required",
        };
      }

      if (!params.subscription.endpoint) {
        return {
          accepted: false,
          error: "Subscription endpoint is required",
        };
      }

      if (!params.title) {
        return {
          accepted: false,
          error: "Push notification title is required",
        };
      }

      if (!params.body) {
        return {
          accepted: false,
          error: "Push notification body is required",
        };
      }

      // Build notification payload
      const payload = {
        title: params.title,
        body: params.body,
        icon: params.icon || "/icon-192.png",
        badge: params.badge || "/badge-72.png",
        tag: params.tag || "notification",
        actions: params.actions || [],
        data: params.data || {},
      };

      // For now, log instead of sending (mock implementation)
      console.log("Push channel - sending push notification:", {
        endpoint: params.subscription.endpoint,
        title: params.title,
        bodyLength: params.body.length,
      });

      // In production, use web-push library:
      // import webpush from 'web-push';
      // webpush.setVapidDetails(
      //   this.vapidSubject,
      //   this.vapidPublicKey,
      //   this.vapidPrivateKey
      // );
      // const result = await webpush.sendNotification(
      //   params.subscription,
      //   JSON.stringify(payload)
      // );
      // return {
      //   accepted: true,
      //   messageId: result.headers.get('x-pushnotification-id') || `push_${Date.now()}`,
      // };

      // Mock response
      const mockMessageId = `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        accepted: true,
        messageId: mockMessageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        accepted: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk push notifications
   */
  async sendBulk(pushList: PushParams[]): Promise<PushResult[]> {
    const results: PushResult[] = [];

    for (const push of pushList) {
      const result = await this.sendPush(push);
      results.push(result);

      // Add small delay between sends
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return results;
  }

  /**
   * Build actions for push notification
   */
  static buildActions(eventType: string): PushAction[] {
    switch (eventType) {
      case "out_for_delivery":
      case "delivery_arriving":
        return [
          {
            action: "open_tracking",
            title: "Track Delivery",
            icon: "/icons/map.png",
          },
          {
            action: "contact_driver",
            title: "Contact Driver",
            icon: "/icons/phone.png",
          },
        ];

      case "delivered":
        return [
          {
            action: "rate_delivery",
            title: "Rate Delivery",
            icon: "/icons/star.png",
          },
          {
            action: "view_order",
            title: "View Order",
            icon: "/icons/box.png",
          },
        ];

      case "delivery_failed":
        return [
          {
            action: "contact_support",
            title: "Contact Support",
            icon: "/icons/help.png",
          },
          {
            action: "reschedule",
            title: "Reschedule",
            icon: "/icons/calendar.png",
          },
        ];

      default:
        return [
          {
            action: "view",
            title: "View",
            icon: "/icons/arrow.png",
          },
        ];
    }
  }

  /**
   * Validate VAPID keys format
   */
  static validateVapidKeys(publicKey: string, privateKey: string): boolean {
    // Basic validation: keys should be base64url encoded
    const base64urlRegex = /^[A-Za-z0-9_-]+={0,2}$/;
    return base64urlRegex.test(publicKey) && base64urlRegex.test(privateKey);
  }

  /**
   * Get VAPID public key
   */
  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }
}
