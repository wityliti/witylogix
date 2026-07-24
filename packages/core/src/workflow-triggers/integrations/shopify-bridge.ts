/**
 * Shopify Workflow Bridge — Map Shopify webhooks to workflow triggers
 *
 * Handles:
 * - Order creation/updates from Shopify
 * - Fulfillment updates (shipment status changes)
 * - Webhook signature verification
 * - Payload transformation to workflow input
 * - Error handling for malformed payloads
 *
 * Usage:
 *
 * ```typescript
 * const bridge = new ShopifyWorkflowBridge({
 *   apiKey: process.env.SHOPIFY_API_KEY,
 *   apiSecret: process.env.SHOPIFY_API_SECRET,
 *   logger: logger,
 * });
 *
 * // In webhook handler
 * app.post("/webhooks/shopify", async (request, reply) => {
 *   const result = await bridge.handleWebhook(
 *     request.body,
 *     request.headers,
 *   );
 *
 *   if (result.success) {
 *     // Trigger workflows
 *     const matches = await registry.match(result.eventType, result.context);
 *   }
 * });
 * ```
 */

import { createHmac } from "crypto";
import type { TriggerEventType, TriggerContext } from "../trigger-registry.js";

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Shopify webhook payload (order.created)
 */
export interface ShopifyOrderPayload {
  id: string;
  order_number: string;
  email: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  shipping_address?: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    zip: string;
    country: string;
  };
  line_items: Array<{
    id: string;
    product_id: string;
    variant_id: string;
    title: string;
    quantity: number;
    price: string;
    weight?: number;
  }>;
  total_price: string;
  total_weight?: number;
  created_at: string;
  updated_at: string;
  status?: string;
  tags?: string;
  note?: string;
}

/**
 * Shopify fulfillment payload
 */
export interface ShopifyFulfillmentPayload {
  id: string;
  order_id: string;
  status:
    | "pending"
    | "confirmed"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "failure";
  tracking_info?: {
    number: string;
    company: string;
    url?: string;
  };
  line_items: Array<{
    id: string;
    product_id: string;
    variant_id: string;
    title: string;
    quantity: number;
  }>;
  created_at: string;
  updated_at: string;
}

/**
 * Result of webhook processing
 */
export interface WebhookProcessResult {
  success: boolean;
  eventType?: TriggerEventType;
  context?: Partial<TriggerContext>;
  error?: string;
  payload?: any;
}

/**
 * Shopify bridge options
 */
export interface ShopifyBridgeOptions {
  apiKey?: string;
  apiSecret?: string;
  verifySignature?: boolean;
  logger?: { debug: Function; error: Function; warn: Function };
}

// ───────────────────────────────────────────────────────────────────────────
// SHOPIFY WORKFLOW BRIDGE
// ───────────────────────────────────────────────────────────────────────────

/**
 * ShopifyWorkflowBridge — Maps Shopify webhooks to workflow triggers
 */
export class ShopifyWorkflowBridge {
  private apiKey?: string;
  private apiSecret?: string;
  private verifySignature: boolean;
  private logger: { debug: Function; error: Function; warn: Function };

  constructor(options: ShopifyBridgeOptions = {}) {
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.verifySignature = options.verifySignature !== false;
    this.logger = options.logger || {
      debug: () => {},
      error: console.error,
      warn: console.warn,
    };
  }

  /**
   * Handle incoming Shopify webhook
   */
  async handleWebhook(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<WebhookProcessResult> {
    try {
      // Verify signature
      if (this.verifySignature && this.apiSecret) {
        const verified = this.verifyWebhookSignature(payload as any, headers);
        if (!verified) {
          this.logger.warn("Invalid Shopify webhook signature");
          return { success: false, error: "Invalid webhook signature" };
        }
      }

      // Parse payload
      const body = typeof payload === "string" ? JSON.parse(payload) : payload;

      // Detect webhook type from headers
      const webhookTopic =
        headers["x-shopify-topic"] || headers["X-Shopify-Topic"] || "";

      // Route to appropriate handler
      if (
        webhookTopic.includes("orders/create") ||
        webhookTopic.includes("orders/updated")
      ) {
        return this.handleOrderEvent(body as ShopifyOrderPayload, webhookTopic);
      }

      if (webhookTopic.includes("fulfillments")) {
        return this.handleFulfillmentEvent(
          body as ShopifyFulfillmentPayload,
          webhookTopic,
        );
      }

      return {
        success: false,
        error: `Unknown webhook topic: ${webhookTopic}`,
      };
    } catch (error) {
      this.logger.error(`Error processing Shopify webhook: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Handle Shopify order event
   */
  private handleOrderEvent(
    payload: ShopifyOrderPayload,
    topic: string,
  ): WebhookProcessResult {
    try {
      // Validate payload
      const validation = this.validateOrderPayload(payload);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Determine event type
      const eventType: TriggerEventType = topic.includes("orders/create")
        ? "order.created"
        : "order.updated";

      // Extract context
      const context = this.transformOrderToContext(payload, eventType);

      return {
        success: true,
        eventType,
        context,
        payload,
      };
    } catch (error) {
      this.logger.error(`Error handling Shopify order event: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Handle Shopify fulfillment event
   */
  private handleFulfillmentEvent(
    payload: ShopifyFulfillmentPayload,
    topic: string,
  ): WebhookProcessResult {
    try {
      // Validate payload
      const validation = this.validateFulfillmentPayload(payload);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Map Shopify fulfillment status to our status
      const eventType: TriggerEventType = "shipment.status_changed";

      // Extract context
      const context = this.transformFulfillmentToContext(payload);

      return {
        success: true,
        eventType,
        context,
        payload,
      };
    } catch (error) {
      this.logger.error(`Error handling Shopify fulfillment event: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Transform Shopify order to trigger context
   */
  private transformOrderToContext(
    payload: ShopifyOrderPayload,
    eventType: TriggerEventType,
  ): Partial<TriggerContext> {
    const customer = payload.customer;
    const shippingAddress = payload.shipping_address;
    const items = payload.line_items.map((item) => ({
      productId: String(item.product_id),
      variantId: String(item.variant_id),
      title: item.title,
      quantity: item.quantity,
      weight: item.weight ? parseFloat(item.weight.toString()) : undefined,
      price: parseFloat(item.price),
    }));

    const totalWeight = payload.total_weight
      ? parseFloat(payload.total_weight.toString())
      : 0;

    return {
      eventType,
      entityId: String(payload.id),
      entity: {
        id: String(payload.id),
        orderId: String(payload.id),
        externalOrderId: String(payload.id),
        externalOrderNumber: String(payload.order_number),
        customerName: customer
          ? `${customer.first_name} ${customer.last_name}`.trim()
          : "",
        customerEmail: customer?.email || payload.email || "",
        customerPhone: customer?.phone || "",
        pickupLocationId: "", // Will be filled by workflow
        deliveryAddressLine1: shippingAddress?.address1 || "",
        deliveryAddressLine2: shippingAddress?.address2,
        deliveryCity: shippingAddress?.city || "",
        deliveryProvince: shippingAddress?.province,
        deliveryPostalCode: shippingAddress?.zip || "",
        deliveryCountry: shippingAddress?.country || "",
        items,
        totalPrice: parseFloat(payload.total_price),
        totalWeight,
        notes: payload.note,
        tags: payload.tags
          ? payload.tags.split(",").map((t) => t.trim())
          : undefined,
        metadata: {
          shopifyOrderId: payload.id,
          shopifyOrderNumber: payload.order_number,
          createdAt: payload.created_at,
          updatedAt: payload.updated_at,
          status: payload.status,
        },
      },
      metadata: {
        source: "shopify",
        webhookTopic: "orders.create_or_update",
      },
    };
  }

  /**
   * Transform Shopify fulfillment to trigger context
   */
  private transformFulfillmentToContext(
    payload: ShopifyFulfillmentPayload,
  ): Partial<TriggerContext> {
    // Map Shopify status to internal status
    const statusMap: Record<string, string> = {
      pending: "PENDING",
      confirmed: "CONFIRMED",
      in_transit: "IN_TRANSIT",
      out_for_delivery: "OUT_FOR_DELIVERY",
      delivered: "DELIVERED",
      failure: "FAILED",
    };

    return {
      eventType: "shipment.status_changed",
      entityId: String(payload.id),
      entity: {
        id: String(payload.id),
        shipmentId: String(payload.id),
        orderId: String(payload.order_id),
        status: statusMap[payload.status] || payload.status,
        previousStatus: "UNKNOWN", // Would need to track separately
        trackingNumber: payload.tracking_info?.number,
        trackingCompany: payload.tracking_info?.company,
        trackingUrl: payload.tracking_info?.url,
        items: payload.line_items.map((item) => ({
          productId: String(item.product_id),
          variantId: String(item.variant_id),
          title: item.title,
          quantity: item.quantity,
        })),
        metadata: {
          shopifyFulfillmentId: payload.id,
          shopifyOrderId: payload.order_id,
          createdAt: payload.created_at,
          updatedAt: payload.updated_at,
        },
      },
      metadata: {
        source: "shopify",
        webhookTopic: "fulfillments.create_or_update",
      },
    };
  }

  /**
   * Validate Shopify order payload
   */
  private validateOrderPayload(payload: ShopifyOrderPayload): {
    valid: boolean;
    error?: string;
  } {
    if (!payload.id) return { valid: false, error: "Missing order ID" };
    if (!payload.order_number)
      return { valid: false, error: "Missing order number" };
    if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
      return { valid: false, error: "Missing line items" };
    }
    if (!payload.total_price)
      return { valid: false, error: "Missing total price" };

    return { valid: true };
  }

  /**
   * Validate Shopify fulfillment payload
   */
  private validateFulfillmentPayload(payload: ShopifyFulfillmentPayload): {
    valid: boolean;
    error?: string;
  } {
    if (!payload.id) return { valid: false, error: "Missing fulfillment ID" };
    if (!payload.order_id) return { valid: false, error: "Missing order ID" };
    if (!payload.status)
      return { valid: false, error: "Missing fulfillment status" };

    return { valid: true };
  }

  /**
   * Verify HMAC signature of webhook
   * Shopify signs webhooks with HMAC-SHA256
   */
  private verifyWebhookSignature(
    payload: any,
    headers: Record<string, string>,
  ): boolean {
    if (!this.apiSecret) return false;

    const hmac =
      headers["x-shopify-hmac-sha256"] ||
      headers["X-Shopify-Hmac-SHA256"] ||
      "";
    if (!hmac) return false;

    // Get raw body (webhook should be passed as raw string)
    const rawBody =
      typeof payload === "string" ? payload : JSON.stringify(payload);

    // Compute HMAC
    const computed = createHmac("sha256", this.apiSecret)
      .update(rawBody, "utf-8")
      .digest("base64");

    // Compare (constant-time comparison)
    return this.secureCompare(computed, hmac);
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Get bridge statistics
   */
  getStats(): {
    signatureVerificationEnabled: boolean;
    supportedEventTypes: string[];
  } {
    return {
      signatureVerificationEnabled: this.verifySignature && !!this.apiSecret,
      supportedEventTypes: [
        "orders/create",
        "orders/update",
        "fulfillments/create",
        "fulfillments/update",
      ],
    };
  }
}
