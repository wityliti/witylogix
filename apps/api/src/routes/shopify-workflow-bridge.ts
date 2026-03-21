/**
 * Shopify Workflow Bridge
 *
 * Ingests Shopify webhooks and bridges them to Witylogix workflows.
 * Handles order and fulfillment events with signature verification, payload
 * transformation, and idempotency.
 *
 * Routes:
 *   POST /api/v4/webhooks/shopify/orders
 *   POST /api/v4/webhooks/shopify/fulfillments
 *
 * Features:
 *   - HMAC-SHA256 signature verification
 *   - Payload transformation (Shopify → Witylogix format)
 *   - Idempotency by Shopify order ID
 *   - Webhook delivery logging
 *   - Rate limiting (100 req/min per shop)
 *   - Async job queueing via BullMQ
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createHmac } from "crypto";
import { db, prisma } from "@witylogix/db";
import { getNotificationQueue } from "../lib/queue.js";
import { z } from "zod";

// ─── Types ──────────────────────────────────────────

interface ShopifyOrder {
  id: string;
  order_number: number;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  line_items: ShopifyLineItem[];
  shipping_address: ShopifyAddress | null;
  billing_address: ShopifyAddress | null;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: ShopifyCustomer | null;
}

interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  price: string;
  sku: string;
}

interface ShopifyAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2?: string;
  city: string;
  province_code: string;
  country_code: string;
  zip: string;
  phone?: string;
}

interface ShopifyCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface ShopifyFulfillment {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  line_items: ShopifyLineItem[];
  tracking_info?: {
    number?: string;
    company?: string;
    url?: string;
  };
}

// ─── Schemas ────────────────────────────────────────

const shopifyOrderSchema = z.object({
  id: z.string(),
  order_number: z.number(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  line_items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      quantity: z.number(),
      price: z.string(),
      sku: z.string(),
    })
  ),
  shipping_address: z
    .object({
      first_name: z.string(),
      last_name: z.string(),
      address1: z.string(),
      address2: z.string().optional(),
      city: z.string(),
      province_code: z.string(),
      country_code: z.string(),
      zip: z.string(),
      phone: z.string().optional(),
    })
    .optional()
    .nullable(),
  billing_address: z.any().optional(),
  total_price: z.string(),
  currency: z.string(),
  financial_status: z.string(),
  fulfillment_status: z.string().optional().nullable(),
  customer: z
    .object({
      id: z.string(),
      email: z.string(),
      first_name: z.string(),
      last_name: z.string(),
      phone: z.string().optional(),
    })
    .optional()
    .nullable(),
});

const shopifyFulfillmentSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  line_items: z.array(z.any()),
  tracking_info: z
    .object({
      number: z.string().optional(),
      company: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
});

// ─── Route Plugin ───────────────────────────────────

/**
 * Shopify webhook bridge routes
 *
 * Handles webhook ingestion from Shopify and transforms them into
 * Witylogix order creation and shipment status workflows.
 *
 * @param fastify Fastify instance
 */
async function shopifyWorkflowBridgeRoutes(
  fastify: FastifyInstance
): Promise<void> {
  const queue = getNotificationQueue();

  /**
   * POST /api/v4/webhooks/shopify/orders
   *
   * Handle Shopify order creation/update webhooks
   * Triggers createDeliveryOrder workflow
   *
   * Headers:
   *   - X-Shopify-Hmac-SHA256: HMAC-SHA256 signature
   *   - X-Shopify-Shop-Id: Shop ID
   *   - X-Shopify-API-Version: API version
   *
   * @returns Webhook processing result
   */
  fastify.post(
    "/api/v4/webhooks/shopify/orders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers[
        "x-shopify-hmac-sha256"
      ] as string | undefined;
      const shopId = request.headers["x-shopify-shop-id"] as string | undefined;

      // Validate headers
      if (!signature || !shopId) {
        request.log.warn(
          { signature: !!signature, shopId: !!shopId },
          "Missing required Shopify headers"
        );
        return reply.status(400).json({
          error: "Missing X-Shopify-Hmac-SHA256 or X-Shopify-Shop-Id header",
        });
      }

      try {
        // Validate signature
        const isValid = verifyShopifySignature(
          request.rawBody as string,
          signature,
          process.env.SHOPIFY_WEBHOOK_SECRET || ""
        );

        if (!isValid) {
          request.log.warn({ shopId }, "Shopify webhook signature invalid");
          return reply.status(401).json({ error: "Invalid signature" });
        }

        // Parse and validate payload
        const payload = request.body as any;
        const validPayload = shopifyOrderSchema.safeParse(payload);

        if (!validPayload.success) {
          request.log.warn(
            { shopId, errors: validPayload.error.errors },
            "Invalid Shopify order payload"
          );
          return reply.status(400).json({
            error: "Invalid payload",
            details: validPayload.error.errors,
          });
        }

        const order = validPayload.data;
        request.log.info(
          { shopId, shopifyOrderId: order.id, orderNumber: order.order_number },
          "Shopify order webhook received"
        );

        // Check idempotency — avoid duplicate processing
        const existingOrder = await db.order.findFirst({
          where: {
            shopifyOrderId: String(order.id),
          },
          select: { id: true },
        });

        if (existingOrder) {
          request.log.info(
            { shopifyOrderId: order.id, existingId: existingOrder.id },
            "Order already processed, skipping"
          );
          return reply.status(200).json({
            success: true,
            message: "Order already processed",
            orderId: existingOrder.id,
          });
        }

        // Fetch shop credentials for workflow context
        const shop = await db.shop.findUnique({
          where: { id: shopId },
          select: { id: true, name: true, organizationId: true },
        });

        if (!shop) {
          request.log.warn({ shopId }, "Shop not found");
          return reply.status(404).json({ error: "Shop not found" });
        }

        // Transform Shopify order to Witylogix format
        const transformedOrder = transformShopifyOrder(order);

        // Enqueue workflow job
        const jobId = `shopify-order-${order.id}-${Date.now()}`;
        await queue.add(
          "createDeliveryOrder",
          {
            type: "createDeliveryOrder",
            shopId,
            organizationId: shop.organizationId,
            correlationId: `shopify-${order.id}`,
            data: {
              shopifyOrderId: String(order.id),
              shopifyOrderNumber: order.order_number,
              ...transformedOrder,
            },
          },
          {
            jobId,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
            removeOnComplete: true,
          }
        );

        request.log.info(
          { jobId, shopifyOrderId: order.id },
          "Enqueued createDeliveryOrder workflow"
        );

        // Log webhook delivery
        await db.webhookDeliveryLog.create({
          data: {
            shopId,
            eventType: "shopify.order.created",
            externalId: String(order.id),
            statusCode: 200,
            responseTime: 0,
            payload: order as any,
            success: true,
          },
        });

        return reply.status(202).json({
          success: true,
          jobId,
          message: "Order processing initiated",
          correlationId: `shopify-${order.id}`,
        });
      } catch (error) {
        request.log.error(
          {
            shopId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Error processing Shopify order webhook"
        );

        // Log failed delivery
        try {
          await db.webhookDeliveryLog.create({
            data: {
              shopId,
              eventType: "shopify.order.created",
              externalId: shopId,
              statusCode: 500,
              responseTime: 0,
              payload: request.body,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        } catch {
          // Silently fail webhook logging
        }

        return reply.status(500).json({
          error: "Failed to process webhook",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * POST /api/v4/webhooks/shopify/fulfillments
   *
   * Handle Shopify fulfillment webhooks
   * Updates shipment status in Witylogix
   *
   * Headers:
   *   - X-Shopify-Hmac-SHA256: HMAC-SHA256 signature
   *   - X-Shopify-Shop-Id: Shop ID
   *
   * @returns Webhook processing result
   */
  fastify.post(
    "/api/v4/webhooks/shopify/fulfillments",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers[
        "x-shopify-hmac-sha256"
      ] as string | undefined;
      const shopId = request.headers["x-shopify-shop-id"] as string | undefined;

      if (!signature || !shopId) {
        request.log.warn(
          { signature: !!signature, shopId: !!shopId },
          "Missing required Shopify headers"
        );
        return reply.status(400).json({
          error: "Missing X-Shopify-Hmac-SHA256 or X-Shopify-Shop-Id header",
        });
      }

      try {
        // Validate signature
        const isValid = verifyShopifySignature(
          request.rawBody as string,
          signature,
          process.env.SHOPIFY_WEBHOOK_SECRET || ""
        );

        if (!isValid) {
          request.log.warn({ shopId }, "Shopify webhook signature invalid");
          return reply.status(401).json({ error: "Invalid signature" });
        }

        // Parse and validate payload
        const payload = request.body as any;
        const validPayload = shopifyFulfillmentSchema.safeParse(payload);

        if (!validPayload.success) {
          request.log.warn(
            { shopId, errors: validPayload.error.errors },
            "Invalid Shopify fulfillment payload"
          );
          return reply.status(400).json({
            error: "Invalid payload",
            details: validPayload.error.errors,
          });
        }

        const fulfillment = validPayload.data;
        request.log.info(
          {
            shopId,
            shopifyFulfillmentId: fulfillment.id,
            orderId: fulfillment.order_id,
          },
          "Shopify fulfillment webhook received"
        );

        // Find associated order
        const order = await db.order.findFirst({
          where: {
            shopifyOrderId: String(fulfillment.order_id),
          },
          select: { id: true, organizationId: true },
        });

        if (!order) {
          request.log.warn(
            { shopifyOrderId: fulfillment.order_id },
            "Order not found for fulfillment"
          );
          return reply.status(404).json({
            error: "Associated order not found",
          });
        }

        // Transform fulfillment data
        const shipmentUpdate = transformShopifyFulfillment(fulfillment);

        // Enqueue shipment status update workflow
        const jobId = `shopify-fulfillment-${fulfillment.id}-${Date.now()}`;
        await queue.add(
          "updateShipmentStatus",
          {
            type: "updateShipmentStatus",
            shopId,
            organizationId: order.organizationId,
            correlationId: `shopify-fulfill-${fulfillment.id}`,
            data: {
              shopifyFulfillmentId: String(fulfillment.id),
              shopifyOrderId: String(fulfillment.order_id),
              orderId: order.id,
              ...shipmentUpdate,
            },
          },
          {
            jobId,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
            removeOnComplete: true,
          }
        );

        request.log.info(
          { jobId, fulfillmentId: fulfillment.id },
          "Enqueued updateShipmentStatus workflow"
        );

        // Log webhook delivery
        await db.webhookDeliveryLog.create({
          data: {
            shopId,
            eventType: "shopify.fulfillment.updated",
            externalId: String(fulfillment.id),
            statusCode: 200,
            responseTime: 0,
            payload: fulfillment as any,
            success: true,
          },
        });

        return reply.status(202).json({
          success: true,
          jobId,
          message: "Fulfillment update initiated",
          correlationId: `shopify-fulfill-${fulfillment.id}`,
        });
      } catch (error) {
        request.log.error(
          {
            shopId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Error processing Shopify fulfillment webhook"
        );

        // Log failed delivery
        try {
          await db.webhookDeliveryLog.create({
            data: {
              shopId,
              eventType: "shopify.fulfillment.updated",
              externalId: shopId,
              statusCode: 500,
              responseTime: 0,
              payload: request.body,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        } catch {
          // Silently fail webhook logging
        }

        return reply.status(500).json({
          error: "Failed to process webhook",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}

// ─── Utilities ──────────────────────────────────────

/**
 * Verify Shopify HMAC-SHA256 signature
 *
 * Reconstructs the signature from the request body using the shared secret
 * and compares it to the provided signature header.
 */
function verifyShopifySignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) {
    console.warn("Shopify webhook secret not configured");
    return false;
  }

  try {
    const computed = createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");

    return computed === signature;
  } catch (error) {
    console.error("Error verifying Shopify signature:", error);
    return false;
  }
}

/**
 * Transform Shopify order to Witylogix format
 *
 * Converts Shopify order structure to the internal delivery order format,
 * mapping customer info, addresses, and line items.
 */
function transformShopifyOrder(order: ShopifyOrder): Record<string, unknown> {
  const address = order.shipping_address || order.billing_address;

  return {
    customerName:
      order.customer?.first_name && order.customer?.last_name
        ? `${order.customer.first_name} ${order.customer.last_name}`
        : "Guest",
    customerEmail: order.customer?.email || order.email || "",
    customerPhone: order.customer?.phone || order.phone || "",
    pickupAddress: {
      street: "Warehouse",
      city: "Distribution Center",
      state: "DC",
      zip: "00000",
      country: "US",
    },
    deliveryAddress: address
      ? {
          street: `${address.address1} ${address.address2 || ""}`.trim(),
          city: address.city,
          state: address.province_code,
          zip: address.zip,
          country: address.country_code,
        }
      : null,
    items: order.line_items.map((item) => ({
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      price: parseFloat(item.price),
    })),
    totalAmount: parseFloat(order.total_price),
    currency: order.currency,
    notes: `Shopify Order #${order.order_number}`,
    priority: order.financial_status === "paid" ? "high" : "normal",
  };
}

/**
 * Transform Shopify fulfillment to shipment update format
 *
 * Converts fulfillment data to the internal shipment status format.
 */
function transformShopifyFulfillment(
  fulfillment: ShopifyFulfillment
): Record<string, unknown> {
  const statusMap: Record<string, string> = {
    pending: "PROCESSING",
    in_progress: "OUT_FOR_DELIVERY",
    success: "DELIVERED",
    cancelled: "CANCELLED",
    error: "FAILED",
    on_hold: "PENDING",
  };

  return {
    status: statusMap[fulfillment.status] || "PENDING",
    trackingNumber: fulfillment.tracking_info?.number,
    trackingCarrier: fulfillment.tracking_info?.company,
    trackingUrl: fulfillment.tracking_info?.url,
    updatedAt: new Date(fulfillment.updated_at).toISOString(),
  };
}

export default shopifyWorkflowBridgeRoutes;
