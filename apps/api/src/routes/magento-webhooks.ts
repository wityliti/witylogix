/**
 * Magento Webhook Routes
 *
 * Handles incoming Magento 2 REST API v1 webhooks and enqueues them for async processing.
 * Routes handle order and product lifecycle events.
 *
 * Magento webhook signature validation:
 *   - Algorithm: HMAC-SHA256
 *   - Header: X-Magento-Signature (hex encoded)
 *   - Secret: Integration secret from Magento settings
 *   - Topic header: X-Magento-Topic
 *
 * Routes:
 *   POST /api/v4/webhooks/magento — Generic webhook handler
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { MagentoAdapter } from "@witylogix/core/platforms/adapters";

/**
 * Magento webhook topics that we handle
 */
enum MagentoWebhookTopic {
  ORDER_SAVE_AFTER = "sales_order_save_after",
  PRODUCT_SAVE_AFTER = "catalog_product_save_after",
  CUSTOMER_SAVE_AFTER = "customer_save_after",
}

/**
 * Magento order payload schema for validation
 */
const MagentoOrderSchema = z.object({
  entity_id: z.number(),
  increment_id: z.string(),
  state: z.string(),
  status: z.string(),
  customer_email: z.string(),
  customer_firstname: z.string(),
  customer_lastname: z.string(),
  grand_total: z.number(),
  subtotal: z.number(),
  tax_amount: z.number(),
  order_currency_code: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  items: z.array(
    z.object({
      item_id: z.number(),
      product_id: z.number(),
      sku: z.string(),
      name: z.string(),
      qty_ordered: z.number(),
      price: z.number(),
      row_total: z.number(),
    })
  ),
  billing_address: z.object({
    firstname: z.string(),
    lastname: z.string(),
    street: z.array(z.string()).optional(),
    city: z.string(),
    postcode: z.string(),
    country_id: z.string(),
    email: z.string().optional(),
    telephone: z.string().optional(),
  }).optional(),
  payment: z.object({
    method: z.string(),
  }).optional(),
});

/**
 * Magento product payload schema for validation
 */
const MagentoProductSchema = z.object({
  id: z.number(),
  sku: z.string(),
  name: z.string(),
  type_id: z.string(),
  price: z.number(),
  status: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  extension_attributes: z.object({
    website_ids: z.array(z.number()).optional(),
    stock_item: z.object({
      qty: z.number(),
      is_in_stock: z.boolean(),
    }).optional(),
    configurable_product_links: z.array(z.number()).optional(),
  }).optional(),
});

/**
 * Magento customer payload schema for validation
 */
const MagentoCustomerSchema = z.object({
  id: z.number(),
  email: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  group_id: z.number(),
  store_id: z.number(),
  website_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  addresses: z.array(z.object({
    firstname: z.string(),
    lastname: z.string(),
    street: z.array(z.string()).optional(),
    city: z.string(),
    postcode: z.string(),
    country_id: z.string(),
    telephone: z.string().optional(),
  })).optional(),
});

// ─── Helpers ─────────────────────────────────────────────

/**
 * Validate Magento webhook signature
 *
 * @param rawBody Raw request body
 * @param signature X-Magento-Signature header value
 * @param secret Integration secret from Magento settings
 * @returns true if signature is valid
 */
function validateMagentoSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const bodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

  const computed = crypto
    .createHmac("sha256", secret)
    .update(bodyString, "utf-8")
    .digest("hex");

  const expectedBuffer = Buffer.from(computed, "utf-8");
  const actualBuffer = Buffer.from(signature, "utf-8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Find shop by integration secret or domain from Magento webhook
 */
async function findShopByWebhookSource(
  db: any,
  integrationSecret: string
): Promise<any> {
  // Try to match by Magento integration secret
  return db.shop.findFirst({
    where: {
      OR: [
        { magentoIntegrationSecret: integrationSecret },
        { magentoWebhookSecret: integrationSecret },
      ],
    },
  });
}

/**
 * Parse Magento webhook topic to determine event type
 * Format: resource_action (e.g., "sales_order_save_after", "catalog_product_save_after")
 */
function parseWebhookTopic(
  topic: string
): {
  resource: "order" | "product" | "customer";
  action: string;
} | null {
  if (topic === MagentoWebhookTopic.ORDER_SAVE_AFTER) {
    return { resource: "order", action: "save" };
  }

  if (topic === MagentoWebhookTopic.PRODUCT_SAVE_AFTER) {
    return { resource: "product", action: "save" };
  }

  if (topic === MagentoWebhookTopic.CUSTOMER_SAVE_AFTER) {
    return { resource: "customer", action: "save" };
  }

  return null;
}

// ─── Route Plugin ────────────────────────────────────────

export default async function magentoWebhookRoutes(
  fastify: FastifyInstance
): Promise<void> {
  const adapter = new MagentoAdapter();

  /**
   * POST /api/v4/webhooks/magento
   *
   * Main webhook handler for all Magento events
   * Validates HMAC signature, maps payload, enqueues for processing
   */
  fastify.post(
    "/api/v4/webhooks/magento",
    async (request: any, reply: FastifyReply) => {
      try {
        // Extract headers
        const signature = request.headers["x-magento-signature"] as string;
        const topic = request.headers["x-magento-topic"] as string;

        // Validate required headers
        if (!signature || !topic) {
          fastify.log.warn(
            "Magento webhook missing required headers (signature, topic)"
          );
          return reply.code(200).send({ success: true }); // Return 200 to stop retries
        }

        // Get the raw request body for signature validation
        const rawBody = request.rawBody || JSON.stringify(request.body);

        // For Magento, we use the signature itself to look up the integration
        // In production, you'd extract the integration ID from the payload or headers
        const integrationSecret = (request.body as any)?._integration_secret || signature;

        // Lookup shop to get webhook secret
        const shop = await findShopByWebhookSource((fastify as any).db, integrationSecret);
        if (!shop || !shop.magentoIntegrationSecret) {
          fastify.log.warn(
            { topic },
            "Magento webhook from unknown shop or missing integration secret"
          );
          return reply.code(200).send({ success: true });
        }

        // Validate webhook signature using adapter
        const isValid = adapter.validateWebhook(
          rawBody,
          signature,
          shop.magentoIntegrationSecret
        );

        if (!isValid) {
          fastify.log.warn(
            { topic },
            "Magento webhook signature validation failed"
          );
          return reply.code(200).send({ success: true }); // Return 200 to avoid retries for bad signatures
        }

        // Parse topic to determine event type
        const parsed = parseWebhookTopic(topic);
        if (!parsed) {
          fastify.log.warn({ topic }, "Unknown Magento webhook topic");
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
        } else if (resource === "customer") {
          await handleCustomerWebhook(
            request.body,
            topic,
            shop.id,
            action,
            fastify
          );
        }

        fastify.log.info(
          { shopId: shop.id, topic, resource, action },
          "Magento webhook enqueued"
        );

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(
          error,
          "Error processing Magento webhook"
        );
        // Always return 200 to prevent webhook retries
        return reply.code(200).send({ success: true });
      }
    }
  );
}

/**
 * Handle order webhook event (sales_order_save_after)
 */
async function handleOrderWebhook(
  payload: any,
  topic: string,
  shopId: string,
  action: string,
  fastify: any
): Promise<void> {
  try {
    // Validate payload structure
    const validatedPayload = MagentoOrderSchema.parse(payload);

    // Map Magento order to normalized format
    const adapter = new MagentoAdapter();
    const mappedOrder = adapter.mapOrder(validatedPayload as any);

    // Enqueue for async processing
    const queue = (fastify as any).queue;
    if (!queue) {
      fastify.log.warn("Queue not initialized, cannot process order webhook");
      return;
    }

    // Determine order action based on financial/fulfillment status
    let orderAction = "create";
    if (payload.status && payload.status !== "pending") {
      orderAction = "update";
    }

    await queue.add("order_webhook", {
      type: "order_webhook",
      data: {
        shopId,
        externalOrderId: String(validatedPayload.entity_id),
        source: "MAGENTO",
        action: orderAction,
        payload: validatedPayload,
      },
    });
  } catch (error) {
    fastify.log.error(
      error,
      `Failed to process Magento order webhook: ${topic}`
    );
    throw error;
  }
}

/**
 * Handle product webhook event (catalog_product_save_after)
 */
async function handleProductWebhook(
  payload: any,
  topic: string,
  shopId: string,
  action: string,
  fastify: any
): Promise<void> {
  try {
    // Validate payload structure
    const validatedPayload = MagentoProductSchema.parse(payload);

    // Map Magento product to normalized format
    const adapter = new MagentoAdapter();
    const mappedProduct = adapter.mapProduct(validatedPayload as any);

    // Enqueue for async processing
    const queue = (fastify as any).queue;
    if (!queue) {
      fastify.log.warn("Queue not initialized, cannot process product webhook");
      return;
    }

    // Magento doesn't distinguish create vs update in webhooks, so we use "update" as the action
    // The consumer can check the database to determine if this is truly an insert or update
    await queue.add("product_webhook", {
      type: "product_webhook",
      data: {
        shopId,
        externalProductId: String(validatedPayload.id),
        source: "MAGENTO",
        action: "update", // Magento webhooks don't distinguish create vs update
        payload: validatedPayload,
      },
    });
  } catch (error) {
    fastify.log.error(
      error,
      `Failed to process Magento product webhook: ${topic}`
    );
    throw error;
  }
}

/**
 * Handle customer webhook event (customer_save_after)
 */
async function handleCustomerWebhook(
  payload: any,
  topic: string,
  shopId: string,
  action: string,
  fastify: any
): Promise<void> {
  try {
    // Validate payload structure
    const validatedPayload = MagentoCustomerSchema.parse(payload);

    // Map Magento customer to normalized format
    const adapter = new MagentoAdapter();
    const mappedCustomer = adapter.mapCustomer(validatedPayload as any);

    // Enqueue for async processing
    const queue = (fastify as any).queue;
    if (!queue) {
      fastify.log.warn("Queue not initialized, cannot process customer webhook");
      return;
    }

    await queue.add("customer_webhook", {
      type: "customer_webhook",
      data: {
        shopId,
        externalCustomerId: String(validatedPayload.id),
        source: "MAGENTO",
        action: "save",
        payload: validatedPayload,
      },
    });
  } catch (error) {
    fastify.log.error(
      error,
      `Failed to process Magento customer webhook: ${topic}`
    );
    throw error;
  }
}
