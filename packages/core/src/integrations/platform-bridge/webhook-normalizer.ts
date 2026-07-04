/**
 * Webhook Event Normalizer
 * Converts platform-specific webhook events to unified format
 */

import { PlatformSource } from "./types.js";
import type {
  UnifiedWebhookEvent,
  UnifiedOrder,
  UnifiedProduct,
  UnifiedCustomer,
} from "./types.js";
import { DataNormalizer } from "./data-normalizer.js";

/**
 * Webhook Event Normalizer Class
 */
export class WebhookNormalizer {
  /**
   * Normalize a webhook event from any platform
   */
  static normalizeWebhookEvent(
    platform: PlatformSource,
    topic: string,
    payload: unknown,
  ): UnifiedWebhookEvent | null {
    try {
      switch (platform) {
        case PlatformSource.WOOCOMMERCE:
          return this.normalizeWooCommerceWebhook(topic, payload as any);
        case PlatformSource.SHOPIFY:
          return this.normalizeShopifyWebhook(topic, payload as any);
        case PlatformSource.MAGENTO:
          return this.normalizeMagentoWebhook(topic, payload as any);
        default:
          console.error(`Unknown platform: ${platform}`);
          return null;
      }
    } catch (error) {
      console.error(`Error normalizing webhook event: ${error}`);
      return null;
    }
  }

  /**
   * Normalize WooCommerce webhook event
   */
  static normalizeWooCommerceWebhook(
    topic: string,
    payload: any,
  ): UnifiedWebhookEvent | null {
    try {
      const [resource, action] = topic.split(".");

      // Determine resource type and event type
      let resourceType: "order" | "product" | "customer" | "fulfillment" =
        "order";
      let eventType: "created" | "updated" | "deleted" | "action_required" =
        "updated";

      if (resource === "order") {
        resourceType = "order";
        if (action === "created") eventType = "created";
        else if (action === "updated") eventType = "updated";
        else if (action === "deleted") eventType = "deleted";
      } else if (resource === "product") {
        resourceType = "product";
        if (action === "created") eventType = "created";
        else if (action === "updated") eventType = "updated";
        else if (action === "deleted") eventType = "deleted";
      } else if (resource === "customer") {
        resourceType = "customer";
        if (action === "created") eventType = "created";
        else if (action === "updated") eventType = "updated";
        else if (action === "deleted") eventType = "deleted";
      }

      // Normalize the data
      let normalizedData:
        | UnifiedOrder
        | UnifiedProduct
        | UnifiedCustomer
        | null = null;

      if (resourceType === "order" && payload) {
        const result = DataNormalizer.normalizeOrder(
          PlatformSource.WOOCOMMERCE,
          payload,
        );
        normalizedData = result.data || null;
      } else if (resourceType === "product" && payload) {
        const result = DataNormalizer.normalizeProduct(
          PlatformSource.WOOCOMMERCE,
          payload,
        );
        normalizedData = result.data || null;
      } else if (resourceType === "customer" && payload) {
        const result = DataNormalizer.normalizeCustomer(
          PlatformSource.WOOCOMMERCE,
          payload,
        );
        normalizedData = result.data || null;
      }

      if (!normalizedData) {
        return null;
      }

      return {
        id: `wc-webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        platform: PlatformSource.WOOCOMMERCE,
        topic,
        eventType,
        resourceType,
        resourceId: payload.id?.toString() || "",
        data: normalizedData,
        timestamp: new Date(),
        metadata: {
          wcTopic: topic,
          wcResource: resource,
          wcAction: action,
        },
      };
    } catch (error) {
      console.error("Error normalizing WooCommerce webhook:", error);
      return null;
    }
  }

  /**
   * Normalize Shopify webhook event
   */
  static normalizeShopifyWebhook(
    topic: string,
    payload: any,
  ): UnifiedWebhookEvent | null {
    try {
      // Shopify topics: orders/created, orders/updated, products/create, etc.
      const [resource, action] = topic.split("/");

      let resourceType: "order" | "product" | "customer" | "fulfillment" =
        "order";
      let eventType: "created" | "updated" | "deleted" | "action_required" =
        "updated";

      if (resource === "orders") {
        resourceType = "order";
        if (action === "created") eventType = "created";
        else if (action === "updated") eventType = "updated";
        else if (action === "cancelled") eventType = "deleted";
      } else if (resource === "products") {
        resourceType = "product";
        if (action === "create") eventType = "created";
        else if (action === "update") eventType = "updated";
        else if (action === "delete") eventType = "deleted";
      } else if (resource === "customers") {
        resourceType = "customer";
        if (action === "create") eventType = "created";
        else if (action === "update") eventType = "updated";
        else if (action === "delete") eventType = "deleted";
      }

      // Normalize the data
      let normalizedData:
        | UnifiedOrder
        | UnifiedProduct
        | UnifiedCustomer
        | null = null;

      if (resourceType === "order" && payload) {
        const result = DataNormalizer.normalizeOrder(
          PlatformSource.SHOPIFY,
          payload,
        );
        normalizedData = result.data || null;
      } else if (resourceType === "product" && payload) {
        const result = DataNormalizer.normalizeProduct(
          PlatformSource.SHOPIFY,
          payload,
        );
        normalizedData = result.data || null;
      } else if (resourceType === "customer" && payload) {
        const result = DataNormalizer.normalizeCustomer(
          PlatformSource.SHOPIFY,
          payload,
        );
        normalizedData = result.data || null;
      }

      if (!normalizedData) {
        return null;
      }

      return {
        id: `shopify-webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        platform: PlatformSource.SHOPIFY,
        topic,
        eventType,
        resourceType,
        resourceId: payload.id?.toString() || "",
        data: normalizedData,
        timestamp: new Date(payload.created_at || new Date()),
        metadata: {
          shopifyTopic: topic,
          shopifyResource: resource,
          shopifyAction: action,
        },
      };
    } catch (error) {
      console.error("Error normalizing Shopify webhook:", error);
      return null;
    }
  }

  /**
   * Normalize Magento webhook event
   */
  static normalizeMagentoWebhook(
    topic: string,
    payload: any,
  ): UnifiedWebhookEvent | null {
    try {
      // TODO: Implement Magento webhook normalization
      console.warn("Magento webhook normalization not yet implemented");
      return null;
    } catch (error) {
      console.error("Error normalizing Magento webhook:", error);
      return null;
    }
  }

  /**
   * Get unified topic from platform-specific topic
   */
  static getUnifiedTopic(platform: PlatformSource, topic: string): string {
    if (platform === PlatformSource.WOOCOMMERCE) {
      // WC: order.created → unified: order.created
      return topic;
    } else if (platform === PlatformSource.SHOPIFY) {
      // Shopify: orders/created → unified: order.created
      const [resource, action] = topic.split("/");
      const singularResource = resource.replace(/s$/, ""); // Remove trailing 's'
      return `${singularResource}.${action}`;
    }

    return topic;
  }

  /**
   * Parse webhook headers for platform identification
   */
  static identifyPlatform(
    headers: Record<string, string>,
  ): PlatformSource | null {
    // Check for Shopify headers
    if (headers["x-shopify-shop-id"] || headers["x-shopify-hmac-sha256"]) {
      return PlatformSource.SHOPIFY;
    }

    // Check for WooCommerce headers
    if (headers["x-wc-webhook-id"] || headers["x-wc-webhook-topic"]) {
      return PlatformSource.WOOCOMMERCE;
    }

    // Check for Magento headers
    if (headers["x-magento-webhook-id"]) {
      return PlatformSource.MAGENTO;
    }

    return null;
  }

  /**
   * Verify webhook signature (platform-specific)
   */
  static verifyWebhookSignature(
    platform: PlatformSource,
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      switch (platform) {
        case PlatformSource.SHOPIFY:
          return this.verifyShopifySignature(payload, signature, secret);
        case PlatformSource.WOOCOMMERCE:
          return this.verifyWooCommerceSignature(payload, signature, secret);
        case PlatformSource.MAGENTO:
          return this.verifyMagentoSignature(payload, signature, secret);
        default:
          return false;
      }
    } catch (error) {
      console.error("Error verifying webhook signature:", error);
      return false;
    }
  }

  /**
   * Verify Shopify webhook signature
   */
  private static verifyShopifySignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    // Shopify uses HMAC-SHA256
    // Signature is base64-encoded
    // TODO: Implement actual verification using crypto module
    return true; // Placeholder
  }

  /**
   * Verify WooCommerce webhook signature
   */
  private static verifyWooCommerceSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    // WooCommerce uses OAuth 1.0a signature
    // TODO: Implement actual verification
    return true; // Placeholder
  }

  /**
   * Verify Magento webhook signature
   */
  private static verifyMagentoSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    // TODO: Implement Magento signature verification
    return true; // Placeholder
  }
}

/**
 * Factory function
 */
export function createWebhookNormalizer(): typeof WebhookNormalizer {
  return WebhookNormalizer;
}
