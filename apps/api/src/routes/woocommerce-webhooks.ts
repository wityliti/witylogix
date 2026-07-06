/**
 * WooCommerce Webhook Routes
 *
 * Handles incoming WooCommerce REST API v3 webhooks and enqueues them for async processing.
 * Routes handle order and product lifecycle events.
 *
 * WooCommerce webhook signature validation:
 *   - Algorithm: HMAC-SHA256
 *   - Header: X-WC-Webhook-Signature (base64 encoded)
 *   - Secret: Webhook secret from WooCommerce settings
 *   - Topic header: X-WC-Webhook-Topic
 *
 * Routes:
 *   POST /api/v4/webhooks/woocommerce — Generic webhook handler
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { WooCommerceAdapter } from "@witylogix/core/platforms/adapters";
import type { WooCommerceOrder } from "@witylogix/core/platforms/adapters";
import { persistWCOrder } from "@witylogix/core/woocommerce/normalize";
import { verifyWooCommerceHmac } from "../middleware/hmac.js";

/**
 * WooCommerce webhook topics that we handle
 */
enum WooCommerceWebhookTopic {
  ORDER_CREATED = "order.created",
  ORDER_UPDATED = "order.updated",
  ORDER_DELETED = "order.deleted",
  PRODUCT_CREATED = "product.created",
  PRODUCT_UPDATED = "product.updated",
  PRODUCT_DELETED = "product.deleted",
}

/**
 * WooCommerce order payload schema for validation
 */
const WooCommerceOrderSchema = z.object({
  id: z.number(),
  order_number: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  status: z.string(),
  currency: z.string(),
  total: z.string(),
  subtotal: z.string(),
  total_tax: z.string(),
  customer_id: z.number().optional(),
  billing: z.object({
    first_name: z.string(),
    last_name: z.string(),
    company: z.string().optional(),
    address_1: z.string(),
    address_2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postcode: z.string(),
    country: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),
  shipping: z.object({
    first_name: z.string(),
    last_name: z.string(),
    company: z.string().optional(),
    address_1: z.string(),
    address_2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postcode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }),
  line_items: z.array(
    z.object({
      id: z.number(),
      product_id: z.number(),
      variation_id: z.number().optional(),
      name: z.string(),
      quantity: z.number(),
      sku: z.string().optional(),
      price: z.string(),
      total: z.string(),
    }),
  ),
  date_paid: z.string().optional().nullable(),
  payment_method: z.string().optional(),
  transaction_id: z.string().optional(),
  meta_data: z.array(z.any()).optional(),
});

/**
 * WooCommerce product payload schema for validation
 */
const WooCommerceProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  short_description: z.string().optional(),
  sku: z.string().optional(),
  price: z.string().optional(),
  regular_price: z.string().optional(),
  sale_price: z.string().optional(),
  on_sale: z.boolean().optional(),
  purchasable: z.boolean().optional(),
  total_sales: z.number().optional(),
  stock_quantity: z.number().optional().nullable(),
  stock_status: z.string().optional(),
  weight: z.string().optional(),
  dimensions: z
    .object({
      length: z.string().optional(),
      width: z.string().optional(),
      height: z.string().optional(),
    })
    .optional(),
  categories: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string().optional(),
      }),
    )
    .optional(),
  tags: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string().optional(),
      }),
    )
    .optional(),
  images: z
    .array(
      z.object({
        id: z.number(),
        src: z.string(),
        name: z.string().optional(),
        alt: z.string().optional(),
      }),
    )
    .optional(),
  attributes: z.array(z.any()).optional(),
  variations: z.array(z.number()).optional(),
  meta_data: z.array(z.any()).optional(),
  date_created: z.string().optional(),
  date_modified: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────

/**
 * Parse WooCommerce webhook topic to determine event type
 * Format: resource.action (e.g., "order.created", "product.updated")
 */
function parseWebhookTopic(
  topic: string,
): {
  resource: "order" | "product";
  action: "created" | "updated" | "deleted";
} | null {
  const parts = topic.split(".");
  if (parts.length !== 2) return null;

  const resource = parts[0];
  const action = parts[1];

  if (
    (resource === "order" || resource === "product") &&
    (action === "created" || action === "updated" || action === "deleted")
  ) {
    return {
      resource: resource as "order" | "product",
      action: action as "created" | "updated" | "deleted",
    };
  }

  return null;
}

// ─── Route Plugin ────────────────────────────────────────

export default async function wooCommerceWebhookRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const adapter = new WooCommerceAdapter();

  /**
   * POST /api/v4/webhooks/woocommerce
   *
   * Main webhook handler for all WooCommerce events.
   * HMAC-SHA256 signature verification is performed by the preHandler middleware
   * before this handler is reached; a 401 is returned for any invalid signature.
   */
  fastify.post(
    "/api/v4/webhooks/woocommerce",
    { preHandler: verifyWooCommerceHmac(fastify) },
    async (request: any, reply: FastifyReply) => {
      try {
        const topic = request.headers["x-wc-webhook-topic"] as string;

        if (!topic) {
          fastify.log.warn(
            "WooCommerce webhook missing X-WC-Webhook-Topic header",
          );
          return reply.code(200).send({ success: true });
        }

        // Parse topic to determine event type
        const parsed = parseWebhookTopic(topic);
        if (!parsed) {
          fastify.log.warn({ topic }, "Unknown WooCommerce webhook topic");
          return reply.code(200).send({ success: true });
        }

        const { resource, action } = parsed;

        // Route to appropriate handler
        if (resource === "order") {
          await handleOrderWebhook(
            request.body,
            topic,
            shop.id,
            action,
            fastify,
          );
        } else if (resource === "product") {
          await handleProductWebhook(
            request.body,
            topic,
            shop.id,
            action,
            fastify,
          );
        }

        fastify.log.info(
          { shopId: shop.id, topic, resource, action },
          "WooCommerce webhook enqueued",
        );

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Error processing WooCommerce webhook");
        // Always return 200 to prevent webhook retries
        return reply.code(200).send({ success: true });
      }
    },
  );
}

/**
 * Handle order webhook event (create, update, delete)
 */
async function handleOrderWebhook(
  payload: any,
  topic: string,
  shopId: string,
  action: "created" | "updated" | "deleted",
  fastify: any,
): Promise<void> {
  try {
    // Validate payload structure
    const validatedPayload = WooCommerceOrderSchema.parse(payload);

    // Persist order + shipment for created/updated events
    if (action !== "deleted") {
      const db = (fastify as any).db;
      if (!db) {
        fastify.log.warn("DB not initialized, cannot persist WC order");
      } else {
        const result = await persistWCOrder(
          payload as unknown as WooCommerceOrder,
          shopId,
          db,
        );
        fastify.log.info(
          {
            shopId,
            orderId: result.orderId,
            shipmentId: result.shipmentId,
            created: result.created,
          },
          "WC order persisted",
        );
      }
    }

    // Map WooCommerce order to normalized format
    const adapter = new WooCommerceAdapter();
    const mappedOrder = adapter.mapOrder(validatedPayload as any);

    // Enqueue for async processing
    const queue = (fastify as any).queue;
    if (!queue) {
      fastify.log.warn("Queue not initialized, cannot process order webhook");
      return;
    }

    await queue.add("order_webhook", {
      type: "order_webhook",
      data: {
        shopId,
        externalOrderId: String(validatedPayload.id),
        source: "WOOCOMMERCE",
        payload: validatedPayload,
      },
    });
  } catch (error) {
    fastify.log.error(
      error,
      `Failed to process WooCommerce order webhook: ${topic}`,
    );
    throw error;
  }
}

/**
 * Handle product webhook event (create, update, delete)
 */
async function handleProductWebhook(
  payload: any,
  topic: string,
  shopId: string,
  action: "created" | "updated" | "deleted",
  fastify: any,
): Promise<void> {
  try {
    // Validate payload structure
    const validatedPayload = WooCommerceProductSchema.parse(payload);

    // Map WooCommerce product to normalized format
    const adapter = new WooCommerceAdapter();
    const mappedProduct = adapter.mapProduct(validatedPayload as any);

    // Enqueue for async processing
    const queue = (fastify as any).queue;
    if (!queue) {
      fastify.log.warn("Queue not initialized, cannot process product webhook");
      return;
    }

    await queue.add("product_webhook", {
      type: "product_webhook",
      data: {
        shopId,
        externalProductId: String(validatedPayload.id),
        source: "WOOCOMMERCE",
        action,
        payload: validatedPayload,
      },
    });
  } catch (error) {
    fastify.log.error(
      error,
      `Failed to process WooCommerce product webhook: ${topic}`,
    );
    throw error;
  }
}
