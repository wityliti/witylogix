/**
 * WooCommerce Webhook Consumer
 * Handles webhook verification, processing, and idempotency
 */

import { createHmac } from "node:crypto";
import type { WCWebhookPayload } from "./types.js";

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  verified: boolean;
  reason?: string;
}

/**
 * Webhook event handler
 */
export interface WebhookEventHandler {
  topic: string;
  handle: (payload: WCWebhookPayload) => Promise<void>;
}

/**
 * WooCommerce Webhook Consumer
 */
export class WebhookConsumer {
  private secret: string;
  private handlers = new Map<string, WebhookEventHandler>();
  private deliveryIdLog = new Set<string>();

  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   * WooCommerce sends X-WC-Webhook-Signature header with base64-encoded signature
   */
  verifyWebhook(
    payload: string,
    signature: string | string[] | undefined,
  ): WebhookVerificationResult {
    if (!signature) {
      return {
        verified: false,
        reason: "No signature provided",
      };
    }

    const signatureStr = Array.isArray(signature) ? signature[0] : signature;

    try {
      const expectedSignature = createHmac("sha256", this.secret)
        .update(payload)
        .digest("base64");

      const isValid = this.constantTimeCompare(
        signatureStr,
        expectedSignature,
      );

      if (!isValid) {
        return {
          verified: false,
          reason: "Signature mismatch",
        };
      }

      return {
        verified: true,
      };
    } catch (error) {
      return {
        verified: false,
        reason: `Verification error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    let result = 0;

    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Check if webhook has already been processed (idempotency)
   */
  isDeliveryProcessed(deliveryId: string): boolean {
    return this.deliveryIdLog.has(deliveryId);
  }

  /**
   * Mark delivery as processed
   */
  markDeliveryProcessed(deliveryId: string): void {
    this.deliveryIdLog.add(deliveryId);
    // In production, this should be persisted to database
  }

  /**
   * Register webhook event handler
   */
  registerHandler(topic: string, handler: (payload: WCWebhookPayload) => Promise<void>): void {
    this.handlers.set(topic, {
      topic,
      handle: handler,
    });
  }

  /**
   * Get handler for topic
   */
  getHandler(topic: string): WebhookEventHandler | undefined {
    return this.handlers.get(topic);
  }

  /**
   * Process webhook payload
   */
  async processWebhook(
    payload: WCWebhookPayload,
    topic: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const handler = this.getHandler(topic);

    if (!handler) {
      return {
        success: false,
        error: `No handler registered for topic: ${topic}`,
      };
    }

    try {
      await handler.handle(payload);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Build webhook creation payload
   */
  static buildWebhookPayload(
    topic: string,
    deliveryUrl: string,
  ): Record<string, unknown> {
    return {
      topic,
      delivery_url: deliveryUrl,
      resource: topic.split(".")[0],
      event: topic.split(".")[1],
      api_version: "wc/v3",
    };
  }

  /**
   * Get webhook topics for registration
   */
  static getWebhookTopics(): string[] {
    return [
      "order.created",
      "order.updated",
      "order.deleted",
      "product.created",
      "product.updated",
      "product.deleted",
      "customer.created",
      "customer.updated",
    ];
  }

  /**
   * Parse webhook topic
   */
  static parseWebhookTopic(topic: string): {
    resource: string;
    event: string;
  } {
    const [resource, event] = topic.split(".");
    return {
      resource: resource || "",
      event: event || "",
    };
  }
}

/**
 * Create webhook consumer instance
 */
export function createWebhookConsumer(secret: string): WebhookConsumer {
  return new WebhookConsumer(secret);
}
