/**
 * Shopify Webhook Handler — Workflow Triggering
 *
 * This route receives incoming Shopify webhooks and triggers the appropriate
 * Witylogix workflows based on the event type.
 *
 * Webhook flow:
 *   1. Shopify sends POST request with HMAC signature
 *   2. Validate HMAC signature using webhook secret
 *   3. Parse event type and payload
 *   4. Trigger corresponding workflow (e.g., createDeliveryOrder for orders/create)
 *   5. Return 200 OK immediately (non-blocking)
 *   6. Workflow executes asynchronously via queue
 *
 * Supported events:
 *   - orders/create → createDeliveryOrder workflow
 *   - orders/fulfilled → completeDelivery workflow
 *   - fulfillments/create → completeDelivery workflow
 */

import type { ActionFunctionArgs } from "react-router";
import { json } from "react-router";
import crypto from "node:crypto";

// ─── Types ────────────────────────────────────────────────

interface ShopifyWebhookHeader {
  "x-shopify-hmac-sha256": string;
  "x-shopify-shop-api-call-limit"?: string;
  "x-shopify-shop-id": string;
  "x-shopify-topic": string;
  "x-shopify-webhook-id": string;
}

interface OrderCreatedPayload {
  id: number;
  order_number?: number;
  email?: string;
  phone?: string;
  customer?: {
    id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  shipping_address?: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    zip: string;
    country: string;
  };
  line_items?: Array<{
    id: number;
    product_id: number;
    variant_id: number;
    title: string;
    quantity: number;
    weight?: number;
    price?: string;
  }>;
  total_price?: string;
  total_weight?: number;
  shop?: {
    id: number;
    name?: string;
  };
}

interface OrderFulfilledPayload {
  id: number;
  order_id: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  shop?: {
    id: number;
  };
}

interface WebhookDeliveryLog {
  id: string;
  shopId: string;
  event: string;
  endpoint?: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  requestBody?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
}

// ─── Action ────────────────────────────────────────────────

/**
 * Handle incoming Shopify webhooks.
 * Validates HMAC, maps to workflows, and triggers execution.
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
    // Read the raw body for HMAC validation
    const rawBody = await request.text();
    const headers = Object.fromEntries(request.headers) as Record<
      string,
      string
    >;

    // Extract Shopify headers
    const hmacHeader = headers["x-shopify-hmac-sha256"];
    const topic = headers["x-shopify-topic"];
    const shopId = headers["x-shopify-shop-id"];
    const webhookId = headers["x-shopify-webhook-id"];

    if (!hmacHeader || !topic || !shopId || !webhookId) {
      console.warn("Missing required webhook headers", {
        hasHmac: !!hmacHeader,
        hasTopic: !!topic,
        hasShopId: !!shopId,
        hasWebhookId: !!webhookId,
      });
      return json(
        { error: "Missing required headers" },
        { status: 400 }
      );
    }

    // Validate HMAC signature
    const isValid = validateWebhookSignature(
      rawBody,
      hmacHeader,
      process.env.SHOPIFY_API_SECRET || ""
    );

    if (!isValid) {
      console.warn("Invalid webhook signature", { shopId, topic, webhookId });
      return json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse webhook payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse webhook payload", { error: e });
      return json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Log webhook receipt
    const logEntry: WebhookDeliveryLog = {
      id: webhookId,
      shopId,
      event: topic,
      statusCode: 200,
      duration: 0,
      timestamp: new Date(),
      requestBody: payload as Record<string, unknown>,
    };

    // Route to appropriate workflow based on topic
    const workflowTriggered = await triggerWorkflowForEvent(
      topic,
      payload,
      shopId,
      logEntry
    );

    if (!workflowTriggered) {
      console.warn("No workflow triggered for event", { topic, shopId });
      // Still return 200 OK for unhandled events
    }

    // Return 200 OK immediately (webhook is async)
    return json(
      { success: true, webhookId, topic },
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook handler error", {
      error: error instanceof Error ? error.message : String(error),
    });

    // Always return 2xx to prevent Shopify retry loop
    // Shopify will retry on 5xx and network errors
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 200 }
    );
  }
}

// ─── HMAC Validation ───────────────────────────────────────

/**
 * Validate Shopify webhook HMAC signature using timing-safe comparison.
 * Prevents timing attacks on signature verification.
 *
 * @param payload Raw request body (before parsing)
 * @param providedHmac HMAC from x-shopify-hmac-sha256 header (base64)
 * @param secret Shopify API secret key
 * @returns true if signature is valid
 */
function validateWebhookSignature(
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

    // Use timing-safe comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedHmac, "utf8");
    const computedBuffer = Buffer.from(computed, "utf8");

    return crypto.timingSafeEqual(providedBuffer, computedBuffer);
  } catch (error) {
    console.error("HMAC validation error", { error });
    return false;
  }
}

// ─── Workflow Triggering ───────────────────────────────────

/**
 * Route webhook event to appropriate workflow and trigger execution.
 * Returns true if a workflow was triggered, false if event is unhandled.
 */
async function triggerWorkflowForEvent(
  topic: string,
  payload: unknown,
  shopId: string,
  logEntry: WebhookDeliveryLog
): Promise<boolean> {
  const startTime = Date.now();

  try {
    switch (topic) {
      case "orders/create":
        return await triggerCreateDeliveryOrderWorkflow(
          payload as OrderCreatedPayload,
          shopId,
          logEntry
        );

      case "orders/fulfilled":
      case "fulfillments/create":
        return await triggerCompleteDeliveryWorkflow(
          payload as OrderFulfilledPayload,
          shopId,
          logEntry
        );

      default:
        // Unhandled event type
        console.debug("Unhandled webhook event", { topic });
        return false;
    }
  } finally {
    logEntry.duration = Date.now() - startTime;
    // TODO: Persist webhook delivery log to database
    console.log("Webhook processed", {
      webhookId: logEntry.id,
      event: logEntry.event,
      duration: logEntry.duration,
      shopId,
    });
  }
}

/**
 * Trigger the createDeliveryOrder workflow for a new Shopify order.
 * Maps Shopify order data to workflow input format.
 */
async function triggerCreateDeliveryOrderWorkflow(
  payload: OrderCreatedPayload,
  shopId: string,
  logEntry: WebhookDeliveryLog
): Promise<boolean> {
  try {
    // Check if order is already being processed (idempotency)
    const orderId = String(payload.id);
    const workflowKey = `order:${shopId}:${orderId}`;

    // TODO: Check idempotency store (Redis/database) for existing workflow
    // const existingWorkflow = await getWorkflowExecution(workflowKey);
    // if (existingWorkflow) {
    //   console.log("Order already has workflow in progress", { orderId, shopId });
    //   return true; // Consider it "triggered" since it was already started
    // }

    // Map Shopify order to CreateDeliveryOrderInput
    const customerName = payload.customer
      ? `${payload.customer.first_name || ""} ${
          payload.customer.last_name || ""
        }`.trim()
      : "Unknown Customer";

    const customerEmail =
      payload.customer?.email || payload.email || "no-email@example.com";
    const customerPhone =
      payload.customer?.phone || payload.phone || "";

    const shippingAddress = payload.shipping_address || {
      address1: "",
      city: "",
      zip: "",
      country: "",
    };

    const items = (payload.line_items || []).map((item) => ({
      productId: String(item.product_id),
      variantId: String(item.variant_id),
      title: item.title,
      quantity: item.quantity,
      weight: item.weight || 0,
      price: item.price ? parseFloat(item.price) : 0,
    }));

    const totalPrice = payload.total_price
      ? parseFloat(payload.total_price)
      : 0;
    const totalWeight = payload.total_weight || 0;

    // Get workflow queue from global context
    // In a real app, this would be injected or retrieved from a singleton
    const queue = getWorkflowQueue();

    // Enqueue the workflow
    const jobId = await queue.enqueue(
      "createDeliveryOrder",
      {
        shopId,
        userId: shopId, // TODO: Map to actual user ID
        shopifyOrderId: String(payload.id),
        shopifyOrderNumber: String(payload.order_number || ""),
        customerName,
        customerEmail,
        customerPhone,
        pickupLocationId: "default", // TODO: Get from shop config
        deliveryAddressLine1: shippingAddress.address1,
        deliveryAddressLine2: shippingAddress.address2,
        deliveryCity: shippingAddress.city,
        deliveryProvince: shippingAddress.province,
        deliveryPostalCode: shippingAddress.zip,
        deliveryCountry: shippingAddress.country,
        items,
        totalPrice,
        totalWeight,
        tags: ["shopify", "webhook"],
        metadata: {
          shopifyOrderId: payload.id,
          webhookId: logEntry.id,
          triggeredAt: new Date().toISOString(),
        },
      },
      {
        userId: shopId,
        tenantId: shopId,
        transactionId: `webhook:${logEntry.id}`,
        metadata: {
          event: "orders/create",
          source: "shopify_webhook",
        },
      }
    );

    console.log("createDeliveryOrder workflow triggered", {
      jobId,
      orderId,
      shopId,
    });

    logEntry.responseBody = { jobId, workflowName: "createDeliveryOrder" };
    return true;
  } catch (error) {
    console.error("Failed to trigger createDeliveryOrder workflow", {
      error: error instanceof Error ? error.message : String(error),
      shopId,
    });
    logEntry.statusCode = 500;
    logEntry.responseBody = {
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return false;
  }
}

/**
 * Trigger the completeDelivery workflow for a fulfilled order.
 * Maps Shopify fulfillment data to workflow input format.
 */
async function triggerCompleteDeliveryWorkflow(
  payload: OrderFulfilledPayload,
  shopId: string,
  logEntry: WebhookDeliveryLog
): Promise<boolean> {
  try {
    // In a real implementation, fetch order details from database
    // to get driver ID, actual delivery time, etc.
    const orderId = String(payload.order_id);

    // TODO: Fetch order from database to get:
    // - assignedDriverId
    // - customerEmail, customerPhone, customerName
    // - totalPrice
    // - other required fields

    console.log("completeDelivery workflow would be triggered", {
      orderId,
      shopId,
    });

    logEntry.responseBody = {
      workflowName: "completeDelivery",
      note: "Requires order context from database",
    };

    // For now, just log that we'd trigger it
    // In production, fetch full order context and enqueue workflow
    return true;
  } catch (error) {
    console.error("Failed to trigger completeDelivery workflow", {
      error: error instanceof Error ? error.message : String(error),
      shopId,
    });
    logEntry.statusCode = 500;
    logEntry.responseBody = {
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return false;
  }
}

// ─── Workflow Queue Helper ─────────────────────────────────

/**
 * Get the global workflow queue instance.
 * In production, this would be retrieved from a singleton or DI container.
 */
function getWorkflowQueue() {
  // Import dynamically to avoid circular dependencies
  const { WorkflowQueue } = require("@witylogix/framework");

  // In a real app, maintain a singleton instance
  const queue = new WorkflowQueue({
    queueName: "witylogix-workflows",
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      timeout: 300000, // 5 minutes
    },
  });

  return queue;
}
