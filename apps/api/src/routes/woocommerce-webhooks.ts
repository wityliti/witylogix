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

import type { FastifyInstance, FastifyReply } from "fastify";
import { WooCommerceAdapter } from "@witylogix/core/platforms/adapters";
import { getWCWebhookQueue } from "../lib/queue.js";

/**
 * Find WooCommerceConnection by storeUrl to obtain tenantId and webhookSecret.
 * Uses the WooCommerceConnection model (not Shop) since webhook secrets are
 * stored per-connection, not per-shop.
 */
async function findConnectionByStoreUrl(
  db: any,
  storeUrl: string,
): Promise<{ id: string; tenantId: string; webhookSecret: string | null } | null> {
  if (!storeUrl) return null;
  return db.wooCommerceConnection.findFirst({
    where: { storeUrl, status: "active" },
    select: { id: true, tenantId: true, webhookSecret: true },
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
  const wcQueue = getWCWebhookQueue();

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
        const deliveryId = request.headers["x-wc-webhook-delivery"] as string | undefined;

        // Validate required headers
        if (!signature || !topic) {
          fastify.log.warn(
            "WooCommerce webhook missing required headers (signature, topic)"
          );
          return reply.code(200).send({ success: true }); // Return 200 to stop retries
        }

        // Get the raw request body for signature validation
        const rawBody = request.rawBody || JSON.stringify(request.body);

        // Lookup WooCommerceConnection by storeUrl to get tenantId and webhookSecret
        const connection = await findConnectionByStoreUrl((fastify as any).db, siteUrl);
        if (!connection || !connection.webhookSecret) {
          fastify.log.warn(
            { siteUrl },
            "WooCommerce webhook from unknown connection or missing webhook secret"
          );
          return reply.code(200).send({ success: true });
        }

        // Validate webhook signature using adapter
        const isValid = adapter.validateWebhook(
          rawBody,
          signature,
          connection.webhookSecret
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

        // Enqueue for async processing via dedicated wc-webhooks BullMQ queue.
        // Jobs that exhaust all retry attempts remain in the "failed" set
        // (DLQ) for 7 days so ops can inspect and replay them.
        // Per-tenant fairness: tenantId is stored on the job; worker concurrency
        // cap (10) prevents one tenant's burst from starving others.
        await wcQueue.add(
          `${topic}`,
          {
            shopId: connection.tenantId,
            topic,
            connectionId: connection.id,
            deliveryId,
            payload: request.body as Record<string, unknown>,
          },
          {
            attempts: 5,
            backoff: { type: "exponential", delay: 2000 },
            // Use deliveryId for deduplication when available, otherwise fall back
            // to tenantId-scoped window deduplication to handle rapid duplicate deliveries.
            jobId: deliveryId
              ? `${connection.tenantId}:${deliveryId}`
              : `${connection.tenantId}:${topic}:${(request.body as any)?.id}:${Math.floor(Date.now() / 5000)}`,
          },
        );

        fastify.log.info(
          { shopId: connection.tenantId, topic, resource, action, deliveryId },
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
