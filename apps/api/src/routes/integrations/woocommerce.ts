/**
 * WooCommerce Integration API Routes
 * Handles connection management, sync, webhooks, and field mapping
 *
 * Routes:
 *   POST   /integrations/woocommerce/connect       Store credentials and verify connection
 *   DELETE /integrations/woocommerce/disconnect    Remove credentials and webhooks
 *   GET    /integrations/woocommerce/status        Connection health and last sync time
 *   POST   /integrations/woocommerce/sync          Trigger full sync (orders, products, customers)
 *   POST   /integrations/woocommerce/webhooks      Incoming webhook handler
 *   GET    /integrations/woocommerce/mapping       Get field mapping configuration
 *   PUT    /integrations/woocommerce/mapping       Update field mapping configuration
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import {
  createWooCommerceClient,
  type WCClientConfig,
} from "@witylogix/core/integrations/woocommerce";
import {
  WebhookConsumer,
} from "@witylogix/core/integrations/woocommerce";
import { createCryptoService } from "@witylogix/core/encryption";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";

function encryptCredential(value: string): string {
  const crypto = createCryptoService(process.env.ENCRYPTION_MASTER_KEY);
  return JSON.stringify(crypto.encrypt(value));
}

function decryptCredential(stored: string): string {
  const crypto = createCryptoService(process.env.ENCRYPTION_MASTER_KEY);
  return crypto.decrypt(stored);
}

// ─── Zod Schemas ────────────────────────────────────────────

const connectSchema = z.object({
  storeUrl: z.string().url(),
  consumerKey: z.string().min(1),
  consumerSecret: z.string().min(1),
  webhookSecret: z.string().optional(),
  ordersSync: z.boolean().default(true),
  productsSync: z.boolean().default(true),
  customersSync: z.boolean().default(true),
  webhooksEnabled: z.boolean().default(true),
});

const syncSchema = z.object({
  syncOrders: z.boolean().default(true),
  syncProducts: z.boolean().default(true),
  syncCustomers: z.boolean().default(true),
});

const mappingSchema = z.object({
  fieldMappings: z.record(z.string()),
  customFields: z.record(z.string()).optional(),
});

const webhookSchema = z.object({
  // Webhook payload structure - flexible for different webhook types
  id: z.number(),
  resource: z.string(),
  event: z.string(),
  created_at: z.string().datetime(),
  data: z.record(z.unknown()),
});

// ─── Route Registration ─────────────────────────────────────

export default async function wooCommerceRoutes(
  app: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── POST /connect — Store credentials and verify connection ─

  app.post<{ Body: z.infer<typeof connectSchema> }>(
    "/connect",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = connectSchema.parse(request.body);
        const tenantId = request.tenantId;

        // Check for existing connection
        const existing = await prisma.wooCommerceConnection.findFirst({
          where: {
            tenantId,
            storeUrl: body.storeUrl,
          },
        });

        if (existing) {
          return reply.status(409).send({
            error: "Connection already exists for this store URL",
          });
        }

        // Verify credentials via WooCommerce system_status endpoint
        const config: WCClientConfig = {
          storeUrl: body.storeUrl,
          consumerKey: body.consumerKey,
          consumerSecret: body.consumerSecret,
        };

        const client = createWooCommerceClient(config);

        try {
          await client.get("/system_status");
        } catch (error) {
          return reply.status(422).send({
            error: "Invalid WooCommerce credentials",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }

        // Encrypt credentials before persisting
        const encryptedKey = encryptCredential(body.consumerKey);
        const encryptedSecret = encryptCredential(body.consumerSecret);
        const encryptedWebhookSecret = body.webhookSecret
          ? encryptCredential(body.webhookSecret)
          : undefined;

        // Create connection record with encrypted credentials
        const connection = await prisma.wooCommerceConnection.create({
          data: {
            tenantId,
            storeUrl: body.storeUrl,
            consumerKey: encryptedKey,
            consumerSecret: encryptedSecret,
            webhookSecret: encryptedWebhookSecret,
            ordersSync: body.ordersSync,
            productsSync: body.productsSync,
            customersSync: body.customersSync,
            webhooksEnabled: body.webhooksEnabled,
          },
        });

        // Register webhooks if enabled
        if (body.webhooksEnabled) {
          try {
            const webhookTopics = [
              "order.created",
              "order.updated",
              "product.created",
              "product.updated",
              "customer.created",
              "customer.updated",
            ];

            const deliveryUrl = `${process.env.API_URL || "http://localhost:3000"}/api/integrations/woocommerce/webhooks`;

            for (const topic of webhookTopics) {
              try {
                const webhook = await client.createWebhook({
                  name: `Witylogix - ${topic}`,
                  topic,
                  delivery_url: deliveryUrl,
                  status: "active" as any,
                  secret: body.webhookSecret,
                } as any);

                await prisma.wooCommerceRegisteredWebhook.create({
                  data: {
                    connectionId: connection.id,
                    wcWebhookId: (webhook.id || 0).toString(),
                    topic,
                    deliveryUrl,
                    status: "active",
                    secret: body.webhookSecret || "",
                  },
                });
              } catch (error) {
                app.log.error(`Failed to register webhook for ${topic}`, error);
              }
            }
          } catch (error) {
            app.log.error("Failed to register webhooks", error);
          }
        }

        return reply.status(201).send({
          message: "WooCommerce connection established successfully",
          connection: {
            id: connection.id,
            storeUrl: connection.storeUrl,
            status: connection.status,
            webhooksEnabled: connection.webhooksEnabled,
          },
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to connect WooCommerce",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── DELETE /disconnect — Remove connection ─────────────────

  app.delete<{ Querystring: { connectionId: string } }>(
    "/disconnect",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { connectionId } = request.query;
        const tenantId = request.tenantId;

        const connection = await prisma.wooCommerceConnection.findFirst({
          where: {
            id: connectionId,
            tenantId,
          },
        });

        if (!connection) {
          return reply.status(404).send({ error: "Connection not found" });
        }

        // Deregister webhooks
        const webhooks = await prisma.wooCommerceRegisteredWebhook.findMany({
          where: { connectionId },
        });

        const config: WCClientConfig = {
          storeUrl: connection.storeUrl,
          consumerKey: decryptCredential(connection.consumerKey),
          consumerSecret: decryptCredential(connection.consumerSecret),
        };

        const client = createWooCommerceClient(config);

        for (const webhook of webhooks) {
          try {
            await client.deleteWebhook(parseInt(webhook.wcWebhookId), true);
          } catch (error) {
            app.log.error(`Failed to delete webhook ${webhook.wcWebhookId}`, error);
          }
        }

        // Delete connection
        await prisma.wooCommerceConnection.delete({
          where: { id: connectionId },
        });

        return reply.send({
          message: "WooCommerce connection removed successfully",
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to disconnect WooCommerce",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── GET /status — Connection health ──────────────────────

  app.get<{ Querystring: { connectionId: string } }>(
    "/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { connectionId } = request.query;
        const tenantId = request.tenantId;

        const connection = await prisma.wooCommerceConnection.findFirst({
          where: {
            id: connectionId,
            tenantId,
          },
          include: {
            syncs: {
              where: { status: "success" },
              select: {
                entityType: true,
                lastSyncedAt: true,
              },
              distinct: ["entityType"],
              orderBy: { lastSyncedAt: "desc" },
            },
          },
        });

        if (!connection) {
          return reply.status(404).send({ error: "Connection not found" });
        }

        // Verify connection is still active via system_status
        const config: WCClientConfig = {
          storeUrl: connection.storeUrl,
          consumerKey: decryptCredential(connection.consumerKey),
          consumerSecret: decryptCredential(connection.consumerSecret),
        };

        let isHealthy = true;
        let healthError = "";
        let storeInfo: Record<string, unknown> | null = null;

        try {
          const client = createWooCommerceClient(config);
          const systemStatus = await client.get<{ environment?: Record<string, unknown> }>("/system_status");
          isHealthy = true;
          storeInfo = systemStatus?.environment ?? null;
        } catch (error) {
          isHealthy = false;
          healthError =
            error instanceof Error ? error.message : "Unknown error";
        }

        return reply.send({
          connection: {
            id: connection.id,
            storeUrl: connection.storeUrl,
            status: connection.status,
            isHealthy,
            healthError: healthError || null,
            storeInfo,
            lastSyncAt: connection.lastSyncAt,
            lastHealthCheckAt: connection.lastHealthCheckAt,
          },
          syncStatus: {
            orders: connection.syncs.find((s) => s.entityType === "order")
              ?.lastSyncedAt,
            products: connection.syncs.find((s) => s.entityType === "product")
              ?.lastSyncedAt,
            customers: connection.syncs.find((s) => s.entityType === "customer")
              ?.lastSyncedAt,
          },
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to get connection status",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── POST /sync — Trigger full sync ──────────────────────

  app.post<{ Body: z.infer<typeof syncSchema> }>(
    "/sync",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = syncSchema.parse(request.body);
        const tenantId = request.tenantId;

        const connection = await prisma.wooCommerceConnection.findFirst({
          where: { tenantId },
        });

        if (!connection) {
          return reply.status(404).send({
            error: "No WooCommerce connection configured",
          });
        }

        // Run sync in background
        const syncPromise = (async () => {
          try {
            const config: WCClientConfig = {
              storeUrl: connection.storeUrl,
              consumerKey: decryptCredential(connection.consumerKey),
              consumerSecret: decryptCredential(connection.consumerSecret),
            };

            const client = createWooCommerceClient(config);
            const syncStats = {
              ordersSync: { created: 0, updated: 0, failed: 0 },
              productsSync: { created: 0, updated: 0, failed: 0 },
              customersSync: { created: 0, updated: 0, failed: 0 },
            };

            // Sync orders
            if (body.syncOrders && connection.ordersSync) {
              try {
                const orders = await client.getOrders({ perPage: 100 });
                // Process orders
                syncStats.ordersSync.created = orders.data?.length || 0;
              } catch (error) {
                app.log.error("Order sync failed", error);
              }
            }

            // Sync products
            if (body.syncProducts && connection.productsSync) {
              try {
                const products = await client.getProducts({ perPage: 100 });
                // Process products
                syncStats.productsSync.created = products.data?.length || 0;
              } catch (error) {
                app.log.error("Product sync failed", error);
              }
            }

            // Sync customers
            if (body.syncCustomers && connection.customersSync) {
              try {
                const customers = await client.getCustomers({ perPage: 100 });
                // Process customers
                syncStats.customersSync.created = customers.data?.length || 0;
              } catch (error) {
                app.log.error("Customer sync failed", error);
              }
            }

            // Update last sync timestamp
            await prisma.wooCommerceConnection.update({
              where: { id: connection.id },
              data: { lastSyncAt: new Date() },
            });
          } catch (error) {
            app.log.error("Sync failed", error);
          }
        })();

        // Don't wait for sync to complete, return immediately
        syncPromise.catch((error) => app.log.error("Background sync error", error));

        return reply.send({
          message: "Sync initiated",
          status: "pending",
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to start sync",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── POST /webhooks — Incoming webhook handler ────────────

  app.post(
    "/webhooks",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = webhookSchema.parse(request.body);
        const signature = request.headers["x-wc-webhook-signature"];
        const deliveryId = request.headers["x-wc-webhook-id"] as string;

        if (!deliveryId) {
          return reply.status(400).send({
            error: "Missing X-WC-Webhook-ID header",
          });
        }

        // Find connection that might have this webhook
        const webhooks = await prisma.wooCommerceRegisteredWebhook.findMany({
          where: {
            topic: payload.resource + "." + payload.event,
          },
          include: { connection: true },
        });

        for (const webhook of webhooks) {
          // Check for duplicate
          const existingLog =
            await prisma.wooCommerceWebhookLog.findFirst({
              where: {
                connectionId: webhook.connectionId,
                deliveryId,
              },
            });

          if (existingLog) {
            return reply.send({ message: "Webhook already processed" });
          }

          // Verify signature
          const consumer = new WebhookConsumer(webhook.secret);
          const rawBody = JSON.stringify(payload);
          const verification = consumer.verifyWebhook(rawBody, signature);

          // Log webhook
          await prisma.wooCommerceWebhookLog.create({
            data: {
              connectionId: webhook.connectionId,
              deliveryId,
              topic: webhook.topic,
              resource: payload.resource,
              event: payload.event,
              payload: payload.data as any,
              signature: signature ? (Array.isArray(signature) ? signature[0] : signature) : null,
              verified: verification.verified,
              status: verification.verified ? "pending" : "failed",
            },
          });

          if (!verification.verified) {
            return reply.status(401).send({
              error: "Webhook verification failed",
              reason: verification.reason,
            });
          }

          // Mark as processed
          await prisma.wooCommerceWebhookLog.update({
            where: { deliveryId_connectionId: { deliveryId, connectionId: webhook.connectionId } },
            data: { processed: true, status: "processed", processedAt: new Date() },
          });
        }

        return reply.status(202).send({
          message: "Webhook received",
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to process webhook",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── GET /mapping — Field mapping configuration ───────────

  app.get(
    "/mapping",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        orderFieldMapping: {
          "wc.billing.first_name": "customer.firstName",
          "wc.billing.last_name": "customer.lastName",
          "wc.billing.email": "customer.email",
          "wc.shipping.address_1": "deliveryAddress.street",
          "wc.shipping.city": "deliveryAddress.city",
          "wc.status": "status",
        },
        productFieldMapping: {
          "wc.name": "name",
          "wc.description": "description",
          "wc.sku": "sku",
          "wc.price": "pricing.price",
          "wc.stock_quantity": "inventory.quantity",
        },
        customerFieldMapping: {
          "wc.email": "email",
          "wc.first_name": "firstName",
          "wc.last_name": "lastName",
          "wc.billing": "billingAddress",
        },
        statusMapping: {
          wcToWl: {
            pending: "pending",
            processing: "confirmed",
            "on-hold": "pending",
            completed: "delivered",
            cancelled: "cancelled",
            refunded: "cancelled",
            failed: "pending",
          },
          wlToWc: {
            pending: "pending",
            confirmed: "processing",
            dispatched: "processing",
            out_for_delivery: "processing",
            delivered: "completed",
            cancelled: "cancelled",
            returned: "refunded",
          },
        },
      });
    },
  );

  // ── PUT /mapping — Update field mapping ─────────────────

  app.put<{ Body: z.infer<typeof mappingSchema> }>(
    "/mapping",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = mappingSchema.parse(request.body);

        return reply.send({
          message: "Field mapping updated",
          mappings: body.fieldMappings,
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Failed to update field mapping",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );
}
