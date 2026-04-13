/**
 * Custom Platform Webhook Ingestion
 *
 * Handles webhooks from self-hosted and headless storefronts with configurable
 * authentication and event type detection.
 *
 * Routes:
 *   POST /api/v4/webhooks/custom/:shopId
 *
 * Features:
 *   - Multiple authentication methods (API key, HMAC-SHA256, Bearer token)
 *   - Configurable event type detection (header or payload field)
 *   - Field mapping validation from shop settings
 *   - BullMQ queue integration for async processing
 *   - Event bus emission for downstream workflows
 *
 * Configuration stored in shop.platformConfig:
 * ```json
 * {
 *   "fieldMapping": { ... },
 *   "webhookConfig": {
 *     "auth": { "method": "hmac", "secret": "...", "headerName": "X-Signature" },
 *     "eventTypeHeader": "X-Event-Type"
 *   }
 * }
 * ```
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@witylogix/db";
import { getNotificationQueue } from "../lib/queue.js";
import { CustomAdapter } from "@witylogix/core/platforms/adapters/custom.js";
import type { CustomCredentials, CustomAuthConfig, CustomWebhookConfig, CustomFieldMapping } from "@witylogix/core/platforms/adapters/custom.js";

// ─── Route Plugin ───────────────────────────────────────────

/**
 * Custom webhook routes
 *
 * Handles webhook ingestion from custom/self-hosted platforms.
 * Each shop can configure its own field mapping and authentication method.
 *
 * @param fastify Fastify instance
 */
async function customWebhooksRoutes(fastify: FastifyInstance): Promise<void> {
  const adapter = new CustomAdapter();

  /**
   * POST /api/v4/webhooks/custom/:shopId
   *
   * Ingest webhook from custom platform
   *
   * Headers:
   *   - X-Signature: HMAC signature (if HMAC auth enabled)
   *   - X-API-Key: API key (if API key auth enabled)
   *   - Authorization: Bearer token (if Bearer auth enabled)
   *   - X-Event-Type: Event type (customizable, default from payload)
   *
   * @param shopId Shop identifier
   * @returns Webhook processing result
   */
  fastify.post<{ Params: { shopId: string } }>(
    "/api/v4/webhooks/custom/:shopId",
    async (request: FastifyRequest<{ Params: { shopId: string } }>, reply: FastifyReply) => {
      const { shopId } = request.params;
      const payload = request.body as any;

      // Validate shopId format
      if (!shopId || typeof shopId !== "string") {
        request.log.warn({ shopId }, "Invalid shop ID");
        return reply.status(400).send({ error: "Invalid shop ID" });
      }

      request.log.info(
        { shopId },
        "Webhook: custom platform"
      );

      try {
        // Step 1: Load shop and its platform configuration
        const shop = await db.shop.findUnique({
          where: { id: shopId },
          select: {
            id: true,
            platformSource: true,
            platformConfig: true,
            credentials: true,
          },
        });

        if (!shop) {
          request.log.warn({ shopId }, "Shop not found");
          return reply.status(404).send({ error: "Shop not found" });
        }

        if (shop.platformSource !== "CUSTOM") {
          request.log.warn(
            { shopId, expectedSource: "CUSTOM", actualSource: shop.platformSource },
            "Shop is not a CUSTOM platform"
          );
          return reply.status(400).send({ error: "Shop is not configured for CUSTOM platform" });
        }

        // Step 2: Extract webhook configuration from shop settings
        const platformConfig = shop.platformConfig as any;
        if (!platformConfig) {
          request.log.error({ shopId }, "Shop missing platform configuration");
          return reply.status(400).send({ error: "Shop platform configuration not found" });
        }

        const fieldMapping = platformConfig.fieldMapping as CustomFieldMapping;
        const webhookConfig = platformConfig.webhookConfig as CustomWebhookConfig;

        if (!fieldMapping) {
          request.log.error({ shopId }, "Shop missing field mapping configuration");
          return reply.status(400).send({ error: "Shop field mapping not configured" });
        }

        // Step 3: Validate webhook signature/auth
        const authConfig = webhookConfig?.auth;
        if (authConfig) {
          const isValid = validateWebhookAuth(
            request,
            adapter,
            payload,
            authConfig
          );

          if (!isValid) {
            request.log.warn({ shopId }, "Webhook authentication failed");
            return reply.status(401).send({ error: "Webhook authentication failed" });
          }
        }

        // Step 4: Extract event type from header or payload
        const eventTypeHeader = request.headers[
          webhookConfig?.eventTypeHeader?.toLowerCase() || "x-event-type"
        ] as string | undefined;

        const eventType = adapter.getWebhookEventType(
          payload,
          eventTypeHeader,
          webhookConfig
        );

        if (!eventType) {
          request.log.warn({ shopId }, "Unable to determine webhook event type");
          return reply.status(400).send({ error: "Unable to determine event type" });
        }

        request.log.info({ shopId, eventType }, "Webhook event type detected");

        // Step 5: Route to appropriate handler based on event type
        if (eventType.includes("order")) {
          return await handleOrderWebhook(
            request,
            reply,
            shopId,
            payload,
            eventType,
            fieldMapping,
            webhookConfig
          );
        } else if (eventType.includes("product")) {
          return await handleProductWebhook(
            request,
            reply,
            shopId,
            payload,
            eventType,
            fieldMapping,
            webhookConfig
          );
        } else {
          request.log.warn({ shopId, eventType }, "Unknown event type");
          return reply.status(400).send({ error: `Unknown event type: ${eventType}` });
        }
      } catch (error) {
        request.log.error(
          { shopId, error: error instanceof Error ? error.message : String(error) },
          "Error processing custom webhook"
        );
        return reply.status(500).send({
          error: "Failed to process webhook",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * Handle order webhook
   *
   * Detects create/update/delete and enqueues appropriate job
   *
   * @param request Fastify request
   * @param reply Fastify reply
   * @param shopId Shop identifier
   * @param payload Raw webhook payload
   * @param eventType Event type (e.g., "order.created")
   * @param fieldMapping Field mapping configuration
   * @param webhookConfig Webhook configuration
   * @returns Response
   */
  async function handleOrderWebhook(
    request: FastifyRequest,
    reply: FastifyReply,
    shopId: string,
    payload: any,
    eventType: string,
    fieldMapping: CustomFieldMapping,
    webhookConfig?: CustomWebhookConfig
  ) {
    try {
      // Extract external order ID from payload using field mapping
      const orderIdField = fieldMapping.order?.externalOrderId;
      if (!orderIdField) {
        request.log.error({ shopId }, "Field mapping missing externalOrderId");
        return reply.status(400).send({ error: "Field mapping not configured for externalOrderId" });
      }

      const externalOrderId = extractField(payload, orderIdField);
      if (!externalOrderId) {
        request.log.warn({ shopId }, "Unable to extract order ID from payload");
        return reply.status(400).send({ error: "Unable to extract order ID from payload" });
      }

      request.log.info(
        { shopId, externalOrderId, eventType },
        "Processing custom order webhook"
      );

      // Determine action from event type
      let action = "update";
      if (eventType.includes("create")) {
        action = "create";
      } else if (eventType.includes("delete")) {
        action = "delete";
      }

      // Enqueue webhook job to BullMQ
      const queue = getNotificationQueue();
      const jobId = `custom-order-${shopId}-${externalOrderId}-${Date.now()}`;

      await queue.add(
        "custom.order_webhook",
        {
          type: "order_webhook",
          data: {
            shopId,
            source: "CUSTOM",
            externalOrderId: String(externalOrderId),
            action,
            payload,
            fieldMapping,
            webhookConfig,
            eventTypeFromHeader: request.headers["x-event-type"] as string | undefined,
          },
        },
        {
          jobId,
          priority: "high",
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        }
      );

      request.log.info(
        { shopId, externalOrderId, jobId },
        "Custom order webhook queued"
      );

      reply.status(202);
      return { status: "accepted", jobId };
    } catch (error) {
      request.log.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error handling order webhook"
      );
      throw error;
    }
  }

  /**
   * Handle product webhook
   *
   * Detects create/update/delete and enqueues appropriate job
   *
   * @param request Fastify request
   * @param reply Fastify reply
   * @param shopId Shop identifier
   * @param payload Raw webhook payload
   * @param eventType Event type (e.g., "product.created")
   * @param fieldMapping Field mapping configuration
   * @param webhookConfig Webhook configuration
   * @returns Response
   */
  async function handleProductWebhook(
    request: FastifyRequest,
    reply: FastifyReply,
    shopId: string,
    payload: any,
    eventType: string,
    fieldMapping: CustomFieldMapping,
    webhookConfig?: CustomWebhookConfig
  ) {
    try {
      // Extract external product ID from payload using field mapping
      const productIdField = fieldMapping.product?.externalProductId;
      if (!productIdField) {
        request.log.error({ shopId }, "Field mapping missing externalProductId");
        return reply.status(400).send({ error: "Field mapping not configured for externalProductId" });
      }

      const externalProductId = extractField(payload, productIdField);
      if (!externalProductId) {
        request.log.warn({ shopId }, "Unable to extract product ID from payload");
        return reply.status(400).send({ error: "Unable to extract product ID from payload" });
      }

      request.log.info(
        { shopId, externalProductId, eventType },
        "Processing custom product webhook"
      );

      // Determine action from event type
      let action = "update";
      if (eventType.includes("create")) {
        action = "create";
      } else if (eventType.includes("delete")) {
        action = "delete";
      }

      // Enqueue webhook job to BullMQ
      const queue = getNotificationQueue();
      const jobId = `custom-product-${shopId}-${externalProductId}-${Date.now()}`;

      await queue.add(
        "custom.product_webhook",
        {
          type: "product_webhook",
          data: {
            shopId,
            source: "CUSTOM",
            externalProductId: String(externalProductId),
            action,
            payload,
            fieldMapping,
            webhookConfig,
            eventTypeFromHeader: request.headers["x-event-type"] as string | undefined,
          },
        },
        {
          jobId,
          priority: "high",
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        }
      );

      request.log.info(
        { shopId, externalProductId, jobId },
        "Custom product webhook queued"
      );

      reply.status(202);
      return { status: "accepted", jobId };
    } catch (error) {
      request.log.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error handling product webhook"
      );
      throw error;
    }
  }
}

/**
 * Validate webhook authentication
 *
 * Supports three auth methods:
 * - api_key: Validates API key in header
 * - hmac: Validates HMAC-SHA256 signature
 * - bearer: Validates Bearer token
 *
 * @param request Fastify request
 * @param adapter CustomAdapter instance
 * @param payload Parsed webhook payload
 * @param authConfig Authentication configuration
 * @returns true if valid, false otherwise
 */
function validateWebhookAuth(
  request: FastifyRequest,
  adapter: CustomAdapter,
  payload: any,
  authConfig: CustomAuthConfig
): boolean {
  try {
    switch (authConfig.method) {
      case "api_key": {
        const headerName = authConfig.headerName || "x-api-key";
        const key = request.headers[headerName.toLowerCase()];
        return adapter.validateWebhook(Buffer.from(""), String(key || ""), authConfig);
      }

      case "hmac": {
        const headerName = authConfig.headerName || "x-signature";
        const signature = request.headers[headerName.toLowerCase()] as string;
        if (!signature) {
          return false;
        }
        const payloadBuffer = Buffer.from(JSON.stringify(payload));
        return adapter.validateWebhook(payloadBuffer, signature, authConfig);
      }

      case "bearer": {
        const authHeader = request.headers.authorization as string;
        if (!authHeader) {
          return false;
        }
        return adapter.validateWebhook(Buffer.from(""), authHeader, authConfig);
      }

      default:
        return false;
    }
  } catch (error) {
    console.error("[custom-webhooks] Error validating auth:", error);
    return false;
  }
}

/**
 * Extract nested field value using dot notation
 *
 * @param obj - Object to extract from
 * @param path - Dot-separated path (e.g., "customer.email")
 * @returns Extracted value or undefined
 */
function extractField(obj: unknown, path?: string): unknown {
  if (!path || typeof obj !== "object" || !obj) {
    return undefined;
  }

  const parts = path.split(".");
  let current: any = obj;

  for (const part of parts) {
    if (typeof current !== "object" || !current || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

export default customWebhooksRoutes;
