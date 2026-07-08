import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { verifyShopifyHmac } from "../middleware/hmac.js";

/**
 * Shopify Lifecycle Webhook Handlers
 *
 * These routes handle Shopify app lifecycle events and GDPR compliance.
 * NO auth middleware — uses HMAC verification instead.
 *
 * Routes:
 *   POST /app/installed        — App installation
 *   POST /app/uninstalled      — App removal
 *   POST /customers/data-request — GDPR data request
 *   POST /customers/redact     — GDPR customer redaction
 *   POST /shop/redact          — GDPR shop redaction
 *   POST /orders/create        — New order sync
 *   POST /orders/updated       — Order status update
 *   POST /products/update      — Product sync
 */

// ─── Payload Schemas ─────────────────────────────────────

const ShopifyShopSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().optional(),
  domain: z.string(),
  country_code: z.string().optional(),
  currency: z.string().optional(),
  plan_display_name: z.string().optional(),
  timezone: z.string().optional(),
});

const CustomerDataRequestSchema = z.object({
  shop_id: z.number(),
  shop_domain: z.string(),
  customer: z.object({
    id: z.number(),
    email: z.string(),
    phone: z.string().optional(),
  }),
  orders_requested: z.array(z.number()).optional(),
});

const CustomerRedactSchema = z.object({
  shop_id: z.number(),
  shop_domain: z.string(),
  customer: z.object({
    id: z.number(),
    email: z.string(),
    phone: z.string().optional(),
  }),
  orders_to_redact: z.array(z.number()).optional(),
});

const ShopRedactSchema = z.object({
  shop_id: z.number(),
  shop_domain: z.string(),
});

const OrderWebhookSchema = z.object({
  id: z.number(),
  order_number: z.number().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  financial_status: z.string().optional(),
  fulfillment_status: z.string().nullable().optional(),
  total_price: z.string().optional(),
  currency: z.string().optional(),
  line_items: z.array(z.any()).optional(),
  shipping_address: z.any().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const ProductWebhookSchema = z.object({
  id: z.number(),
  title: z.string(),
  product_type: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  status: z.string().optional(),
  variants: z.array(z.any()).optional(),
  updated_at: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET || "test-secret";

/** Find shop by Shopify domain/ID */
async function findShopByDomain(db: any, domain: string) {
  return db.shop.findFirst({
    where: {
      OR: [{ domain: domain }, { shopifyDomain: domain }],
    },
  });
}

// ─── Route Plugin ────────────────────────────────────────

export default async function shopifyWebhookRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All webhook routes use HMAC verification instead of JWT auth
  const hmacHook = verifyShopifyHmac(SHOPIFY_SECRET);

  // ── POST /app/installed ────────────────────────────────

  fastify.post(
    "/app/installed",
    { preHandler: [hmacHook] },
    async (request: any, reply: FastifyReply) => {
      try {
        const payload = ShopifyShopSchema.parse(request.body);

        // Upsert shop record
        const shop = await (fastify as any).db.shop.upsert({
          where: { shopifyId: String(payload.id) },
          update: {
            name: payload.name,
            email: payload.email || null,
            domain: payload.domain,
            currency: payload.currency || "USD",
            timezone: payload.timezone || "UTC",
            status: "ACTIVE",
            installedAt: new Date(),
            metadata: {
              shopifyPlan: payload.plan_display_name || null,
              countryCode: payload.country_code || null,
            },
          },
          create: {
            shopifyId: String(payload.id),
            name: payload.name,
            email: payload.email || null,
            domain: payload.domain,
            currency: payload.currency || "USD",
            timezone: payload.timezone || "UTC",
            status: "ACTIVE",
            installedAt: new Date(),
            metadata: {
              shopifyPlan: payload.plan_display_name || null,
              countryCode: payload.country_code || null,
            },
          },
        });

        fastify.log.info({ shopId: shop.id }, "Shopify app installed");

        // Acknowledge immediately — process setup async
        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Failed to process app/installed webhook");
        return reply.code(200).send({ success: true }); // Always 200 for webhooks
      }
    },
  );

  // ── POST /app/uninstalled ──────────────────────────────

  fastify.post(
    "/app/uninstalled",
    { preHandler: [hmacHook] },
    async (request: any, reply: FastifyReply) => {
      try {
        const payload = ShopifyShopSchema.parse(request.body);

        // Deactivate shop
        await (fastify as any).db.shop.updateMany({
          where: { shopifyId: String(payload.id) },
          data: {
            status: "INACTIVE",
            uninstalledAt: new Date(),
          },
        });

        fastify.log.info({ shopifyId: payload.id }, "Shopify app uninstalled");

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Failed to process app/uninstalled webhook");
        return reply.code(200).send({ success: true });
      }
    },
  );

  // ── POST /customers/data-request — GDPR ───────────────

  fastify.post(
    "/customers/data-request",
    { preHandler: [hmacHook] },
    async (request: any, reply: FastifyReply) => {
      try {
        const payload = CustomerDataRequestSchema.parse(request.body);

        const shop = await findShopByDomain(
          (fastify as any).db,
          payload.shop_domain,
        );

        if (shop) {
          // Log the data request for processing
          await (fastify as any).db.activityLog.create({
            data: {
              shopId: shop.id,
              entityType: "gdpr",
              entityId: shop.id,
              action: "data_request",
              actorType: "webhook",
              changes: {},
              metadata: {
                customerId: payload.customer.id,
                customerEmail: payload.customer.email,
                ordersRequested: payload.orders_requested || [],
                requestedAt: new Date().toISOString(),
              },
            },
          });

          fastify.log.info(
            {
              shopDomain: payload.shop_domain,
              customerId: payload.customer.id,
            },
            "GDPR data request received",
          );
        }

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Failed to process GDPR data request");
        return reply.code(200).send({ success: true });
      }
    },
  );

  // ── POST /customers/redact — GDPR ─────────────────────

  fastify.post(
    "/customers/redact",
    { preHandler: [hmacHook] },
    async (request: any, reply: FastifyReply) => {
      try {
        const payload = CustomerRedactSchema.parse(request.body);

        const shop = await findShopByDomain(
          (fastify as any).db,
          payload.shop_domain,
        );

        if (shop) {
          // Anonymize customer data
          await (fastify as any).db.customer.updateMany({
            where: {
              shopId: shop.id,
              shopifyCustomerId: String(payload.customer.id),
            },
            data: {
              email: `redacted-${payload.customer.id}@redacted.local`,
              firstName: "REDACTED",
              lastName: "REDACTED",
              phone: null,
              addresses: {},
              metadata: { redactedAt: new Date().toISOString() },
            },
          });

          // Log redaction
          await (fastify as any).db.activityLog.create({
            data: {
              shopId: shop.id,
              entityType: "gdpr",
              entityId: shop.id,
              action: "customer_redact",
              actorType: "webhook",
              changes: {},
              metadata: {
                customerId: payload.customer.id,
                ordersRedacted: payload.orders_to_redact || [],
                redactedAt: new Date().toISOString(),
              },
            },
          });

          fastify.log.info(
            { customerId: payload.customer.id },
            "GDPR customer data redacted",
          );
        }

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Failed to process GDPR customer redact");
        return reply.code(200).send({ success: true });
      }
    },
  );

  // ── POST /shop/redact — GDPR ──────────────────────────

  fastify.post(
    "/shop/redact",
    { preHandler: [hmacHook] },
    async (request: any, reply: FastifyReply) => {
      try {
        const payload = ShopRedactSchema.parse(request.body);

        // After app uninstall, Shopify sends this 48h later
        // Delete all shop data
        const shop = await findShopByDomain(
          (fastify as any).db,
          payload.shop_domain,
        );

        if (shop) {
          // Cascade delete will handle related records
          await (fastify as any).db.shop.delete({
            where: { id: shop.id },
          });

          fastify.log.info(
            { shopDomain: payload.shop_domain },
            "GDPR shop data deleted",
          );
        }

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Failed to process GDPR shop redact");
        return reply.code(200).send({ success: true });
      }
    },
  );

  // ── POST /orders/create — Sync new order ───────────────

  fastify.post(
    "/orders/create",
    { preHandler: [hmacHook] },
    async (request: any, reply: FastifyReply) => {
      try {
        const shopDomain = request.headers["x-shopify-shop-domain"] as string;
        const payload = OrderWebhookSchema.parse(request.body);

        if (!shopDomain) {
          return reply.code(200).send({ success: true });
        }

        const shop = await findShopByDomain((fastify as any).db, shopDomain);

        if (shop) {
          // Upsert order
          await (fastify as any).db.order.upsert({
            where: {
              shopId_externalOrderId: {
                shopId: shop.id,
                externalOrderId: String(payload.id),
              },
            },
            update: {
              status: payload.fulfillment_status || "UNFULFILLED",
              totalPrice: payload.total_price
                ? parseFloat(payload.total_price)
                : 0,
              currency: payload.currency || "USD",
              metadata: {
                financialStatus: payload.financial_status,
                lineItemCount: payload.line_items?.length || 0,
              },
              updatedAt: new Date(),
            },
            create: {
              shopId: shop.id,
              externalOrderId: String(payload.id),
              orderNumber: String(payload.order_number || payload.id),
              customerEmail: payload.email || null,
              status: payload.fulfillment_status || "UNFULFILLED",
              totalPrice: payload.total_price
                ? parseFloat(payload.total_price)
                : 0,
              currency: payload.currency || "USD",
              shippingAddress: payload.shipping_address || {},
              lineItems: payload.line_items || [],
              metadata: {
                financialStatus: payload.financial_status,
              },
            },
          });

          fastify.log.info(
            { orderId: payload.id, shopId: shop.id },
            "Order synced from Shopify",
          );
        }

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Failed to process order/create webhook");
        return reply.code(200).send({ success: true });
      }
    },
  );

  // ── POST /orders/updated — Update order ────────────────

  fastify.post(
    "/orders/updated",
    { preHandler: [hmacHook] },
    async (request: any, reply: FastifyReply) => {
      try {
        const shopDomain = request.headers["x-shopify-shop-domain"] as string;
        const payload = OrderWebhookSchema.parse(request.body);

        if (!shopDomain) {
          return reply.code(200).send({ success: true });
        }

        const shop = await findShopByDomain((fastify as any).db, shopDomain);

        if (shop) {
          await (fastify as any).db.order.updateMany({
            where: {
              shopId: shop.id,
              externalOrderId: String(payload.id),
            },
            data: {
              status: payload.fulfillment_status || "UNFULFILLED",
              totalPrice: payload.total_price
                ? parseFloat(payload.total_price)
                : 0,
              metadata: {
                financialStatus: payload.financial_status,
                lastWebhookAt: new Date().toISOString(),
              },
            },
          });

          fastify.log.info(
            { orderId: payload.id },
            "Order updated from Shopify",
          );
        }

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Failed to process order/updated webhook");
        return reply.code(200).send({ success: true });
      }
    },
  );

  // ── POST /products/update — Sync product ───────────────

  fastify.post(
    "/products/update",
    { preHandler: [hmacHook] },
    async (request: any, reply: FastifyReply) => {
      try {
        const shopDomain = request.headers["x-shopify-shop-domain"] as string;
        const payload = ProductWebhookSchema.parse(request.body);

        if (!shopDomain) {
          return reply.code(200).send({ success: true });
        }

        const shop = await findShopByDomain((fastify as any).db, shopDomain);

        if (shop) {
          await (fastify as any).db.product.upsert({
            where: {
              shopId_shopifyProductId: {
                shopId: shop.id,
                shopifyProductId: String(payload.id),
              },
            },
            update: {
              title: payload.title,
              productType: payload.product_type || null,
              vendor: payload.vendor || null,
              status: payload.status || "active",
              variants: payload.variants || {},
              lastSyncAt: new Date(),
            },
            create: {
              shopId: shop.id,
              shopifyProductId: String(payload.id),
              title: payload.title,
              productType: payload.product_type || null,
              vendor: payload.vendor || null,
              status: payload.status || "active",
              variants: payload.variants || {},
              lastSyncAt: new Date(),
            },
          });

          fastify.log.info(
            { productId: payload.id },
            "Product synced from Shopify",
          );
        }

        return reply.code(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error, "Failed to process product/update webhook");
        return reply.code(200).send({ success: true });
      }
    },
  );
}
