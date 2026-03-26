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
import crypto from "crypto";
import { WooCommerceAdapter } from "@witylogix/core/platforms/adapters";

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
    })
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
  dimensions: z.object({
    length: z.string().optional(),
    width: z.string().optional(),
    height: z.string().optional(),
  }).optional(),
  categories: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string().optional(),
  })).optional(),
  tags: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string().optional(),
  })).optional(),
  images: z.array(z.object({
    id: z.number(),
    src: z.string(),
    name: z.string().optional(),
    alt: z.string().optional(),
  })).optional(),
  attributes: z.array(z.any()).optional(),
  variations: z.array(z.number()).optional(),
  meta_data: z.array(z.any()).optional(),
  date_created: z.string().optional(),
  date_modified: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────

/**
 * Validate WooCommerce webhook signature
 *
 * @param rawBody Raw request body
 * @param signature X-WC-Webhook-Signature header value
 * @param secret Webhook secret from WooCommerce settings
 * @returns true if signature is valid
 */
function validateWooCommerceSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const bodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

  const computed = crypto
    .createHmac("sha256", secret)
    .update(bodyString, "utf-8")
    .digest("base64");

  const expectedBuffer = Buffer.from(computed, "utf-8");
  const actualBuffer = Buffer.from(signature, "utf-8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Find shop by domain or ID from webhook
 */
async function findShopByWebhookSource(
  db: any,
  siteUrl: string
): Promise<any> {
  // Try to match by woocommerce site URL
  return db.shop.findFirst({
    where: {
      OR: [
        { woocommerceSiteUrl: siteUrl },
        { domain: siteUrl },
      ],
    },
  });
}

/**
 * Parse WooCommerce webhook topic to determine event type
 * Format: resource.action (e.g., "order.created", "product.updated")
 */
function parseWebhookTopic(
  topic: string
): { resource: "order" | "product"; action: "created" | "updated" | "deleted" } | null {
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
  fastify: FastifyInstance
): Promise<void> {
  const adapter = new WooCommerceAdapter();

  /**
   * POST /api/v4/webhooks/woocommerce
   *
   * Main webhook handler for all WooCommerce events
   * Validates HMAC signature, maps payload, enqueues for processing
   */
  fastify.post(
    "/api/v4/webhooks/woocommerce",
    async (request: any, reply: FastifyReply) => {
      try {
        // Extract headers
        const signature = request.headers["x-wc-webhook-signature"] as string;
        const topic = request.headers["x-wc-webhook-topic"] as string;
        const siteUrl = request.headers["x-wc-webhook-source"] as string;

        // Validate required headers
        if (!signature || !topic) {
          fastify.log.warn(
            "WooCommerce webhook missing required headers (signature, topic)"
          );
          return reply.code(200).send({ success: true }); // Return 200 to stop retries
        }

        // Get the raw request body for signature validation
        const rawBody = request.rawBody || JSON.stringify(request.body);

        // Lookup shop to get webhook secret
        const shop = await findShopByWebhookSource((fastify as any).db, siteUrl);
        if (!shop || !shop.woocommerceWebhookSecret) {
          fastify.log.warn(
            { siteUrl },
            "WooCommerce webhook from unknown shop or missing webhook secret"
          );
          return reply.code(200).send({ success: true });
        }

        // Validate webhook signature using adapter
        const isValid = adapter.validateWebhook(
          rawBody,
          signature,
          shop.woocommerceWebhookSecret
        );

        if (!isValid) {
          fastify.log.warn(
            { siteUrl, topic },
            "WooCommerce webhook signature validation failed"
          );
          return reply.code(200).send({ success: true }); // Return 200 to avoid retries for bad signatures
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
            fastify
          );
        } else if (resource === "product") {
          await handleProductWebhook(
            request.body,
            topic,
            shop.id,
            action,
            fastify
          );
        }

        fastify.log.info(
          { shopId: shop.id, topic, resource, action },
          "WooCommerce webhook enqueued"
        );

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(
          error,
          "Error processing WooCommerce webhook"
        );
        // Always return 200 to prevent webhook retries
        return reply.code(200).send({ success: true });
      }
    }
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
  fastify: any
): Promise<void> {
  try {
    // Validate payload structure
    const validatedPayload = WooCommerceOrderSchema.parse(payload);

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
      `Failed to process WooCommerce order webhook: ${topic}`
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
  fastify: any
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
      `Failed to process WooCommerce product webhook: ${topic}`
    );
    throw error;
  }
}
