/**
 * Webhook Delivery — Outbound webhooks for notification events
 */

import crypto from "crypto";
import { Webhook, WebhookEventType, WebhookDeliveryResult } from "./types.js";

/**
 * In-memory webhook store (in production, use a database)
 */
const webhookStore = new Map<string, Webhook>();

/**
 * Webhook payload
 */
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: Date;
  data: Record<string, any>;
}

/**
 * Webhook Manager — handles outbound webhooks
 */
export class WebhookManager {
  /**
   * Register a webhook
   */
  static registerWebhook(
    url: string,
    events: WebhookEventType[],
    secret?: string,
  ): Webhook {
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const webhookSecret = secret || crypto.randomBytes(32).toString("hex");

    const webhook: Webhook = {
      id,
      url,
      events,
      secret: webhookSecret,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    webhookStore.set(id, webhook);
    return webhook;
  }

  /**
   * Get webhook by ID
   */
  static getWebhook(id: string): Webhook | undefined {
    return webhookStore.get(id);
  }

  /**
   * List all webhooks
   */
  static listWebhooks(): Webhook[] {
    return Array.from(webhookStore.values());
  }

  /**
   * Update webhook
   */
  static updateWebhook(
    id: string,
    updates: Partial<Webhook>,
  ): Webhook | undefined {
    const webhook = webhookStore.get(id);
    if (!webhook) {
      return undefined;
    }

    const updated = {
      ...webhook,
      ...updates,
      id: webhook.id, // Don't allow ID change
      createdAt: webhook.createdAt, // Don't allow creation date change
      updatedAt: new Date(),
    };

    webhookStore.set(id, updated);
    return updated;
  }

  /**
   * Delete webhook
   */
  static deleteWebhook(id: string): boolean {
    return webhookStore.delete(id);
  }

  /**
   * Fire a webhook
   */
  static async fireWebhook(
    webhook: Webhook,
    event: WebhookEventType,
    payload: Record<string, any>,
  ): Promise<WebhookDeliveryResult> {
    try {
      // Check if webhook is active
      if (!webhook.active) {
        return {
          success: false,
          error: "Webhook is inactive",
          timestamp: new Date(),
        };
      }

      // Check if webhook is subscribed to this event
      if (!webhook.events.includes(event)) {
        return {
          success: false,
          error: `Webhook not subscribed to event: ${event}`,
          timestamp: new Date(),
        };
      }

      // Build webhook payload
      const webhookPayload = {
        event,
        timestamp: new Date(),
        data: payload,
      };

      // Generate HMAC signature
      const signature = this.generateSignature(
        JSON.stringify(webhookPayload),
        webhook.secret,
      );

      // For now, log instead of actually delivering (mock implementation)
      console.log("Webhook delivery - firing webhook:", {
        webhookId: webhook.id,
        url: webhook.url,
        event,
        signature: signature.substring(0, 10) + "...",
      });

      // In production, actually send the webhook:
      // const response = await fetch(webhook.url, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     "X-Webhook-Signature": `sha256=${signature}`,
      //     "X-Webhook-Event": event,
      //     "X-Webhook-ID": webhook.id,
      //   },
      //   body: JSON.stringify(webhookPayload),
      //   timeout: 10000,
      // });

      // return {
      //   success: response.ok,
      //   statusCode: response.status,
      //   error: !response.ok ? `HTTP ${response.status}` : undefined,
      //   timestamp: new Date(),
      // };

      // Mock response
      return {
        success: true,
        statusCode: 200,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Fire webhook for multiple events
   */
  static async fireWebhooks(
    event: WebhookEventType,
    payload: Record<string, any>,
  ): Promise<Array<{ webhook: Webhook; result: WebhookDeliveryResult }>> {
    const webhooks = this.listWebhooks();
    const results: Array<{ webhook: Webhook; result: WebhookDeliveryResult }> =
      [];

    for (const webhook of webhooks) {
      const result = await this.fireWebhook(webhook, event, payload);
      results.push({ webhook, result });
    }

    return results;
  }

  /**
   * Generate HMAC signature for webhook
   */
  private static generateSignature(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  /**
   * Verify webhook signature (for receiving webhooks)
   */
  static verifySignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Clear all webhooks (for testing)
   */
  static clearAll(): void {
    webhookStore.clear();
  }
}
