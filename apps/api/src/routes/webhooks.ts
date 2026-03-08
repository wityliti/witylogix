/**
 * Shopify Webhook Ingestion — verified via HMAC.
 *
 * Handles:
 *   POST /orders/create    New order from Shopify
 *   POST /orders/updated   Order updated in Shopify
 *   POST /orders/cancelled Order cancelled in Shopify
 *   POST /app/uninstalled  App uninstalled from shop
 *   POST /customers/redact Customer data redact request (GDPR)
 *   POST /shop/redact      Shop data redact request (GDPR)
 *   POST /customers/data_request  Customer data request (GDPR)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyShopifyWebhook } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import { getNotificationQueue } from "../lib/queue.js";

// ─── Route Plugin ───────────────────────────────────────────

async function webhooksRoutes(fastify: FastifyInstance): Promise<void> {
  // All webhook routes use HMAC verification (not JWT)
  fastify.addHook("preHandler", verifyShopifyWebhook);
  fastify.addHook("preHandler", tenantContext);

  // ── ORDER CREATED ─────────────────────────────────────────

  fastify.post("/orders/create", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;
    const shopifyOrderId = String(payload.id);

    request.log.info(
      { shopifyOrderId, shopId: request.shopId },
      "Webhook: orders/create",
    );

    // Check if order already exists (idempotency)
    const existing = await request.tenantDb.order.findFirst({
      where: { shopifyOrderId },
    });

    if (existing) {
      request.log.warn({ shopifyOrderId }, "Order already exists, skipping");
      return { status: "skipped", reason: "duplicate" };
    }

    // Extract shipping address
    const addr = payload.shipping_address || payload.billing_address || {};
    const totalWeight = payload.total_weight ? Number(payload.total_weight) / 1000 : null;

    // Generate tracking token
    const trackingToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const order = await request.tenantDb.order.create({
      data: {
        shopId: request.shopId,
        shopifyOrderId,
        shopifyOrderNumber: payload.order_number ? String(payload.order_number) : null,
        customerName: [payload.customer?.first_name, payload.customer?.last_name]
          .filter(Boolean)
          .join(" ") || null,
        customerEmail: payload.customer?.email || payload.email || null,
        customerPhone: payload.customer?.phone || payload.phone || null,
        addressLine1: addr.address1 || null,
        addressLine2: addr.address2 || null,
        city: addr.city || null,
        province: addr.province || null,
        postalCode: addr.zip || null,
        country: addr.country_code || null,
        totalPrice: payload.total_price ? Number(payload.total_price) : null,
        totalWeight,
        itemCount: payload.line_items?.length || 1,
        lineItems: payload.line_items?.map((li: any) => ({
          shopifyLineId: String(li.id),
          title: li.title,
          quantity: li.quantity,
          price: li.price,
          sku: li.sku,
          grams: li.grams,
          variant: li.variant_title,
        })) || [],
        trackingToken,
        tags: payload.tags ? payload.tags.split(",").map((t: string) => t.trim()) : [],
        notes: payload.note || null,
      },
    });

    // Set delivery location if coordinates available
    if (addr.latitude && addr.longitude) {
      await request.tenantDb.$executeRaw`
        UPDATE orders
        SET delivery_location = ST_SetSRID(ST_MakePoint(${Number(addr.longitude)}, ${Number(addr.latitude)}), 4326)
        WHERE id = ${order.id}::uuid
      `;
    }

    // Invalidate order cache
    await request.tenantRedis.invalidateGroup("orders");

    // Enqueue notification job for new order
    const notificationQueue = getNotificationQueue();
    await notificationQueue.add(
      'webhook.new_order',
      {
        type: 'notification',
        data: {
          shopId: request.shopId,
          notificationId: `new-order-${order.id}`,
          channel: 'email',
          payload: {
            templateId: 'new-order-confirmation',
            recipientId: order.id,
            recipientAddress: order.customerEmail || '',
            templateData: {
              orderId: order.shopifyOrderNumber || order.shopifyOrderId,
              customerName: order.customerName,
              totalPrice: order.totalPrice,
              itemCount: order.itemCount,
            },
            priority: 'high',
          },
        },
      },
      { priority: 'high' }
    );

    request.log.info({ orderId: order.id, shopifyOrderId }, "Order created from webhook");
    reply.status(201);
    return { status: "created", orderId: order.id };
  });

  // ── ORDER UPDATED ─────────────────────────────────────────

  fastify.post("/orders/updated", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;
    const shopifyOrderId = String(payload.id);

    request.log.info({ shopifyOrderId }, "Webhook: orders/updated");

    const order = await request.tenantDb.order.findFirst({
      where: { shopifyOrderId },
    });

    if (!order) {
      request.log.warn({ shopifyOrderId }, "Order not found for update webhook");
      return { status: "skipped", reason: "not_found" };
    }

    const addr = payload.shipping_address || {};
    await request.tenantDb.order.update({
      where: { id: order.id },
      data: {
        customerName: [payload.customer?.first_name, payload.customer?.last_name]
          .filter(Boolean)
          .join(" ") || order.customerName,
        customerEmail: payload.customer?.email || order.customerEmail,
        customerPhone: payload.customer?.phone || order.customerPhone,
        addressLine1: addr.address1 || order.addressLine1,
        city: addr.city || order.city,
        province: addr.province || order.province,
        postalCode: addr.zip || order.postalCode,
        totalPrice: payload.total_price ? Number(payload.total_price) : undefined,
        notes: payload.note || order.notes,
        tags: payload.tags ? payload.tags.split(",").map((t: string) => t.trim()) : order.tags,
      },
    });

    await request.tenantRedis.invalidateGroup("orders");
    return { status: "updated" };
  });

  // ── ORDER CANCELLED ───────────────────────────────────────

  fastify.post("/orders/cancelled", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;
    const shopifyOrderId = String(payload.id);

    request.log.info({ shopifyOrderId }, "Webhook: orders/cancelled");

    const order = await request.tenantDb.order.findFirst({
      where: { shopifyOrderId },
    });

    if (!order) {
      return { status: "skipped", reason: "not_found" };
    }

    // Only cancel if not already delivered
    if (order.status !== "DELIVERED") {
      await request.tenantDb.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
      await request.tenantRedis.invalidateGroup("orders");
    }

    return { status: "cancelled" };
  });

  // ── APP UNINSTALLED ───────────────────────────────────────

  fastify.post("/app/uninstalled", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopDomain = request.auth.shopDomain;
    request.log.warn({ shopDomain }, "Webhook: app/uninstalled");

    // Mark shop as inactive (soft delete — preserve data)
    await prisma.shop.update({
      where: { id: request.shopId },
      data: {
        isActive: false,
        uninstalledAt: new Date(),
        shopifyAccessToken: "", // Clear token
      },
    });

    return { status: "uninstalled" };
  });

  // ── GDPR: Customer Data Request ───────────────────────────

  fastify.post("/customers/data_request", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;
    const customerId = payload.customer?.id;
    const customerEmail = payload.customer?.email;

    request.log.info(
      { shopDomain: payload.shop_domain, customerId },
      "GDPR: customers/data_request",
    );

    // Queue job to compile customer data for export
    // This is required for Shopify app certification
    const notificationQueue = getNotificationQueue();
    await notificationQueue.add(
      'gdpr.customer_data_request',
      {
        type: 'gdpr_data_export',
        data: {
          shopId: request.shopId,
          customerId,
          customerEmail,
          requestedAt: new Date().toISOString(),
          shopDomain: payload.shop_domain,
        },
      },
      { priority: 'high' }
    );

    return { status: "acknowledged" };
  });

  // ── GDPR: Customer Redact ─────────────────────────────────

  fastify.post("/customers/redact", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;
    const customerEmail = payload.customer?.email;

    request.log.info(
      { shopDomain: payload.shop_domain, customerEmail },
      "GDPR: customers/redact",
    );

    if (customerEmail) {
      // Anonymize customer data across orders
      await request.tenantDb.order.updateMany({
        where: { customerEmail },
        data: {
          customerName: "[REDACTED]",
          customerEmail: null,
          customerPhone: null,
          notes: null,
        },
      });
    }

    return { status: "redacted" };
  });

  // ── GDPR: Shop Redact ─────────────────────────────────────

  fastify.post("/shop/redact", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;
    const shopDomain = payload.shop_domain;
    const shopId = request.shopId;

    request.log.warn(
      { shopDomain },
      "GDPR: shop/redact — full tenant deletion requested",
    );

    // Queue cascading tenant data deletion job
    // This must delete ALL tenant data within 48 hours (Shopify requirement)
    const notificationQueue = getNotificationQueue();
    await notificationQueue.add(
      'gdpr.shop_redact',
      {
        type: 'gdpr_shop_deletion',
        data: {
          shopId,
          shopDomain,
          requestedAt: new Date().toISOString(),
          cascadeDelete: true,
        },
      },
      {
        priority: 'high',
        // Ensure deletion happens within 48 hours
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        }
      }
    );

    return { status: "acknowledged" };
  });
}

export default webhooksRoutes;
