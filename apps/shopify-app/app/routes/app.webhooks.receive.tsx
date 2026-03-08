/**
 * Shopify Webhook Receiver — Main Entry Point
 *
 * This route is configured as the webhook endpoint in Shopify Admin.
 * It receives incoming webhooks, validates HMAC signatures, and routes them
 * to the appropriate handlers based on the webhook topic.
 *
 * Webhook Topics Handled:
 *   - orders/create → enqueue product-webhook job for order sync
 *   - orders/updated → update order status in local DB
 *   - orders/fulfilled → trigger delivery workflow
 *   - app/uninstalled → deactivate tenant, cleanup
 *   - customers/data_request → GDPR data export
 *   - customers/redact → GDPR data deletion
 *   - shop/redact → GDPR shop data deletion
 *
 * Security:
 *   - Validates HMAC-SHA256 signature using timing-safe comparison
 *   - Returns 200 OK immediately for async processing
 *   - Logs all webhook events for audit trail
 */

import type { ActionFunctionArgs } from "react-router";
import { json } from "react-router";
import crypto from "node:crypto";

// ─── Types ────────────────────────────────────────────────────────────

/**
 * Webhook validation result with parsed payload and metadata.
 */
interface ValidatedWebhook {
  topic: string;
  shopId: string;
  webhookId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

/**
 * Webhook context for handler functions.
 */
interface WebhookContext {
  shopId: string;
  webhookId: string;
  topic: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

/**
 * Handler result indicates success or failure of processing.
 */
interface HandlerResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ─── Main Action Handler ──────────────────────────────────────────────

/**
 * Handle incoming Shopify webhooks.
 * Route: POST /webhooks/receive
 */
export async function action({ request }: ActionFunctionArgs) {
  // Only accept POST requests
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    // Validate and parse webhook
    const validated = await validateAndParseWebhook(request);
    if (!validated) {
      return json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Create context for handlers
    const context: WebhookContext = {
      shopId: validated.shopId,
      webhookId: validated.webhookId,
      topic: validated.topic,
      timestamp: validated.timestamp,
      payload: validated.payload,
    };

    // Route to appropriate handler based on topic
    const result = await routeWebhookToHandler(context);

    // Log webhook processing
    console.log("Webhook processed", {
      webhookId: validated.webhookId,
      topic: validated.topic,
      shopId: validated.shopId,
      success: result.success,
      message: result.message,
    });

    // Always return 200 OK for webhook acknowledgment
    return json(
      {
        success: true,
        webhookId: validated.webhookId,
        topic: validated.topic,
        message: result.message,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook handler error", {
      error: error instanceof Error ? error.message : String(error),
    });

    // Return 200 OK to prevent Shopify retry loop
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}

// ─── HMAC Validation ──────────────────────────────────────────────────

/**
 * Validate Shopify webhook HMAC signature and parse webhook.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param request Request object with headers and body
 * @returns Validated webhook or null if signature is invalid
 */
async function validateAndParseWebhook(
  request: Request
): Promise<ValidatedWebhook | null> {
  try {
    // Read raw body for HMAC validation
    const rawBody = await request.text();
    const headers = Object.fromEntries(request.headers);

    // Extract required headers
    const hmacHeader = headers["x-shopify-hmac-sha256"];
    const topic = headers["x-shopify-topic"];
    const shopId = headers["x-shopify-shop-id"];
    const webhookId = headers["x-shopify-webhook-id"];
    const timestamp = headers["x-shopify-webhook-api-call-limit"];

    // Validate required headers
    if (!hmacHeader || !topic || !shopId || !webhookId) {
      console.warn("Missing required webhook headers", {
        hasHmac: !!hmacHeader,
        hasTopic: !!topic,
        hasShopId: !!shopId,
        hasWebhookId: !!webhookId,
      });
      return null;
    }

    // Validate HMAC signature
    const isValid = validateHmacSignature(
      rawBody,
      String(hmacHeader),
      process.env.SHOPIFY_WEBHOOK_SECRET || ""
    );

    if (!isValid) {
      console.warn("Invalid webhook signature", { shopId, topic, webhookId });
      return null;
    }

    // Parse webhook payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse webhook payload", { error: e });
      return null;
    }

    return {
      topic: String(topic),
      shopId: String(shopId),
      webhookId: String(webhookId),
      timestamp: new Date(),
      payload,
    };
  } catch (error) {
    console.error("Webhook validation failed", { error });
    return null;
  }
}

/**
 * Validate HMAC-SHA256 signature using timing-safe comparison.
 * Prevents timing attacks on signature verification.
 *
 * @param payload Raw request body
 * @param providedHmac HMAC header value (base64)
 * @param secret Shopify webhook secret
 * @returns true if signature is valid
 */
function validateHmacSignature(
  payload: string,
  providedHmac: string,
  secret: string
): boolean {
  try {
    // Compute HMAC-SHA256 of payload
    const computed = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("base64");

    // Use timing-safe comparison
    const providedBuffer = Buffer.from(providedHmac, "utf8");
    const computedBuffer = Buffer.from(computed, "utf8");

    return crypto.timingSafeEqual(providedBuffer, computedBuffer);
  } catch (error) {
    console.error("HMAC validation error", { error });
    return false;
  }
}

// ─── Webhook Routing ──────────────────────────────────────────────────

/**
 * Route webhook to appropriate handler based on topic.
 * Topics are mapped to handler functions that process the event.
 *
 * @param context Webhook context with topic and payload
 * @returns Handler result with success/error status
 */
async function routeWebhookToHandler(
  context: WebhookContext
): Promise<HandlerResult> {
  const { topic, payload, shopId, webhookId } = context;

  console.log("Routing webhook to handler", { topic, shopId });

  try {
    switch (topic) {
      case "orders/create":
        return await handleOrderCreated(context);

      case "orders/updated":
        return await handleOrderUpdated(context);

      case "orders/fulfilled":
        return await handleOrderFulfilled(context);

      case "app/uninstalled":
        return await handleAppUninstalled(context);

      case "customers/data_request":
        return await handleCustomerDataRequest(context);

      case "customers/redact":
        return await handleCustomerRedact(context);

      case "shop/redact":
        return await handleShopRedact(context);

      default:
        console.debug("Unhandled webhook topic", { topic, shopId });
        return {
          success: true,
          message: `No handler for topic ${topic}`,
        };
    }
  } catch (error) {
    console.error("Handler error", {
      topic,
      shopId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Handler error",
    };
  }
}

// ─── Webhook Handlers ──────────────────────────────────────────────────

/**
 * Handle orders/create webhook.
 * Enqueues a product-webhook job for order synchronization.
 */
async function handleOrderCreated(context: WebhookContext): Promise<HandlerResult> {
  const { payload, shopId, webhookId } = context;

  try {
    const orderId = (payload.id as number)?.toString() || "";
    const orderNumber = (payload.order_number as number)?.toString() || "";
    const customerId = (payload.customer as any)?.id?.toString() || "";

    if (!orderId) {
      return { success: false, error: "Missing order ID in payload" };
    }

    console.log("Processing order creation", {
      orderId,
      orderNumber,
      shopId,
      webhookId,
    });

    // Enqueue product-webhook job
    const jobId = await enqueueOrderWebhookJob({
      shopId,
      orderId,
      orderNumber,
      customerId,
      eventType: "order_created",
      payload,
      webhookId,
    });

    return {
      success: true,
      message: `Order created job enqueued: ${jobId}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to handle order creation",
    };
  }
}

/**
 * Handle orders/updated webhook.
 * Updates order status in local database.
 */
async function handleOrderUpdated(context: WebhookContext): Promise<HandlerResult> {
  const { payload, shopId, webhookId } = context;

  try {
    const orderId = (payload.id as number)?.toString() || "";
    const status = (payload.financial_status as string) || "unknown";

    if (!orderId) {
      return { success: false, error: "Missing order ID in payload" };
    }

    console.log("Updating order status", {
      orderId,
      status,
      shopId,
      webhookId,
    });

    // Update order in database
    await updateOrderStatusInDatabase({
      shopId,
      orderId,
      status,
      payload,
      webhookId,
    });

    return {
      success: true,
      message: `Order ${orderId} status updated`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update order",
    };
  }
}

/**
 * Handle orders/fulfilled webhook.
 * Triggers delivery workflow for fulfilled orders.
 */
async function handleOrderFulfilled(context: WebhookContext): Promise<HandlerResult> {
  const { payload, shopId, webhookId } = context;

  try {
    const fulfillmentId = (payload.id as number)?.toString() || "";
    const orderId = (payload.order_id as number)?.toString() || "";

    if (!orderId) {
      return { success: false, error: "Missing order ID in payload" };
    }

    console.log("Processing order fulfillment", {
      fulfillmentId,
      orderId,
      shopId,
      webhookId,
    });

    // Trigger delivery workflow
    const jobId = await triggerDeliveryWorkflow({
      shopId,
      orderId,
      fulfillmentId,
      payload,
      webhookId,
    });

    return {
      success: true,
      message: `Delivery workflow triggered: ${jobId}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to trigger delivery workflow",
    };
  }
}

/**
 * Handle app/uninstalled webhook.
 * Deactivates tenant and performs cleanup.
 */
async function handleAppUninstalled(context: WebhookContext): Promise<HandlerResult> {
  const { shopId, webhookId } = context;

  try {
    console.log("App uninstalled, deactivating tenant", {
      shopId,
      webhookId,
    });

    // Deactivate tenant
    await deactivateTenant({
      shopId,
      webhookId,
    });

    return {
      success: true,
      message: `Tenant ${shopId} deactivated`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to deactivate tenant",
    };
  }
}

/**
 * Handle customers/data_request webhook.
 * Exports customer GDPR data.
 */
async function handleCustomerDataRequest(context: WebhookContext): Promise<HandlerResult> {
  const { payload, shopId, webhookId } = context;

  try {
    const customerId = (payload.customer as any)?.id?.toString() || "";

    console.log("Processing GDPR data request", {
      customerId,
      shopId,
      webhookId,
    });

    // Export customer data
    await exportCustomerData({
      shopId,
      customerId,
      payload,
      webhookId,
    });

    return {
      success: true,
      message: `GDPR data export initiated for customer ${customerId}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to export customer data",
    };
  }
}

/**
 * Handle customers/redact webhook.
 * Deletes customer GDPR data.
 */
async function handleCustomerRedact(context: WebhookContext): Promise<HandlerResult> {
  const { payload, shopId, webhookId } = context;

  try {
    const customerId = (payload.customer_id as string) || "";

    console.log("Processing customer redaction", {
      customerId,
      shopId,
      webhookId,
    });

    // Delete customer data
    await deleteCustomerData({
      shopId,
      customerId,
      webhookId,
    });

    return {
      success: true,
      message: `Customer ${customerId} data deleted`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to redact customer data",
    };
  }
}

/**
 * Handle shop/redact webhook.
 * Deletes shop GDPR data.
 */
async function handleShopRedact(context: WebhookContext): Promise<HandlerResult> {
  const { shopId, webhookId } = context;

  try {
    console.log("Processing shop redaction", { shopId, webhookId });

    // Delete shop data
    await deleteShopData({
      shopId,
      webhookId,
    });

    return {
      success: true,
      message: `Shop ${shopId} data deleted`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to redact shop data",
    };
  }
}

// ─── Job Enqueueing & Workflow Triggering ──────────────────────────────

/**
 * Enqueue a product webhook job for order synchronization.
 */
async function enqueueOrderWebhookJob(params: {
  shopId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  eventType: string;
  payload: Record<string, unknown>;
  webhookId: string;
}): Promise<string> {
  try {
    const queue = getWorkflowQueue();
    const jobId = await queue.enqueue(
      "order-webhook",
      {
        ...params,
      },
      {
        tenantId: params.shopId,
        transactionId: `webhook:${params.webhookId}`,
      }
    );

    console.log("Order webhook job enqueued", { jobId, orderId: params.orderId });
    return jobId;
  } catch (error) {
    console.error("Failed to enqueue order webhook job", { error });
    throw error;
  }
}

/**
 * Update order status in local database.
 */
async function updateOrderStatusInDatabase(params: {
  shopId: string;
  orderId: string;
  status: string;
  payload: Record<string, unknown>;
  webhookId: string;
}): Promise<void> {
  try {
    const { PrismaClient } = require("@witylogix/db");
    const prisma = new PrismaClient();

    await (prisma as any).order.updateMany({
      where: {
        shopifyOrderId: params.orderId,
        shopId: params.shopId,
      },
      data: {
        status: mapShopifyStatusToInternal(params.status),
        lastWebhookId: params.webhookId,
        lastWebhookAt: new Date(),
      },
    });

    console.log("Order status updated", { orderId: params.orderId });
  } catch (error) {
    console.error("Failed to update order status", { error });
    throw error;
  }
}

/**
 * Trigger delivery workflow for fulfilled orders.
 */
async function triggerDeliveryWorkflow(params: {
  shopId: string;
  orderId: string;
  fulfillmentId: string;
  payload: Record<string, unknown>;
  webhookId: string;
}): Promise<string> {
  try {
    const queue = getWorkflowQueue();
    const jobId = await queue.enqueue(
      "delivery-workflow",
      {
        ...params,
      },
      {
        tenantId: params.shopId,
        transactionId: `webhook:${params.webhookId}`,
      }
    );

    console.log("Delivery workflow enqueued", { jobId, orderId: params.orderId });
    return jobId;
  } catch (error) {
    console.error("Failed to trigger delivery workflow", { error });
    throw error;
  }
}

/**
 * Deactivate tenant and perform cleanup.
 */
async function deactivateTenant(params: {
  shopId: string;
  webhookId: string;
}): Promise<void> {
  try {
    const { PrismaClient } = require("@witylogix/db");
    const prisma = new PrismaClient();

    await (prisma as any).shop.update({
      where: { shopifyId: params.shopId },
      data: {
        active: false,
        deactivatedAt: new Date(),
        lastWebhookId: params.webhookId,
      },
    });

    console.log("Tenant deactivated", { shopId: params.shopId });
  } catch (error) {
    console.error("Failed to deactivate tenant", { error });
    throw error;
  }
}

/**
 * Export customer GDPR data.
 */
async function exportCustomerData(params: {
  shopId: string;
  customerId: string;
  payload: Record<string, unknown>;
  webhookId: string;
}): Promise<void> {
  try {
    const queue = getWorkflowQueue();
    await queue.enqueue(
      "gdpr-data-export",
      {
        ...params,
      },
      {
        tenantId: params.shopId,
        transactionId: `webhook:${params.webhookId}`,
      }
    );

    console.log("GDPR data export job enqueued", {
      customerId: params.customerId,
      shopId: params.shopId,
    });
  } catch (error) {
    console.error("Failed to export customer data", { error });
    throw error;
  }
}

/**
 * Delete customer GDPR data.
 */
async function deleteCustomerData(params: {
  shopId: string;
  customerId: string;
  webhookId: string;
}): Promise<void> {
  try {
    const { PrismaClient } = require("@witylogix/db");
    const prisma = new PrismaClient();

    // Delete all customer-related data
    await (prisma as any).customer.deleteMany({
      where: {
        shopifyId: params.customerId,
        shopId: params.shopId,
      },
    });

    console.log("Customer data deleted", {
      customerId: params.customerId,
      shopId: params.shopId,
    });
  } catch (error) {
    console.error("Failed to delete customer data", { error });
    throw error;
  }
}

/**
 * Delete shop GDPR data.
 */
async function deleteShopData(params: {
  shopId: string;
  webhookId: string;
}): Promise<void> {
  try {
    const { PrismaClient } = require("@witylogix/db");
    const prisma = new PrismaClient();

    // Delete all shop-related data
    await (prisma as any).shop.delete({
      where: { shopifyId: params.shopId },
    });

    console.log("Shop data deleted", { shopId: params.shopId });
  } catch (error) {
    console.error("Failed to delete shop data", { error });
    throw error;
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────

/**
 * Get the workflow queue instance.
 */
function getWorkflowQueue() {
  const { WorkflowQueue } = require("@witylogix/framework");
  return new WorkflowQueue({
    queueName: "witylogix-webhooks",
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      timeout: 300000, // 5 minutes
    },
  });
}

/**
 * Map Shopify financial status to internal status.
 */
function mapShopifyStatusToInternal(shopifyStatus: string): string {
  const statusMap: Record<string, string> = {
    authorized: "ACCEPTED",
    pending: "PENDING",
    paid: "ACCEPTED",
    partially_paid: "ACCEPTED",
    refunded: "RETURNED",
    voided: "CANCELLED",
    partially_refunded: "RETURNED",
  };
  return statusMap[shopifyStatus.toLowerCase()] || "PENDING";
}
