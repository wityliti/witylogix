// @ts-nocheck
/**
 * Order webhook consumer — processes Shopify order events.
 *
 * Flow:
 *   1. Validate incoming order payload
 *   2. Upsert order record in database
 *   3. Check fulfillment readiness and trigger fulfillment if applicable
 *   4. Emit analytics event for tracking
 *   5. Trigger downstream workflows (notifications, routing, etc.)
 */

import type {
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  OrderWebhookJob,
} from "../types.js";
import {
  QueueConsumer,
  QueueValidationError,
  QueueTransientError,
  QueuePermanentError,
} from "../consumer.js";
import type { ConsumerConfig } from "../types.js";
import { prisma as dbPrisma } from "@witylogix/db";
import type { TypedEventBus } from "../../event-bus/index.js";
import type { WitylogixEvents } from "../../event-bus/types.js";

/**
 * Order webhook consumer implementation.
 */
export class OrderWebhookConsumer extends QueueConsumer {
  private eventBus?: TypedEventBus<WitylogixEvents>;

  constructor(config: ConsumerConfig, eventBus?: TypedEventBus<WitylogixEvents>) {
    super(config);
    this.eventBus = eventBus;
  }

  /**
   * Validate order webhook payload format and content.
   *
   * @param job Job payload
   * @throws QueueValidationError if validation fails
   */
  protected async validateJob(job: QueueJobPayload): Promise<void> {
    await super.validateJob(job);

    if (job.type !== "order_webhook") {
      throw new QueueValidationError(
        `Expected order_webhook, got ${job.type}`,
      );
    }

    const { data } = job as { type: "order_webhook"; data: OrderWebhookJob };
    const { payload } = data;

    // Validate core order fields
    if (!payload.id || !payload.email) {
      throw new QueueValidationError(
        "Order missing required fields: id, email",
      );
    }

    // Validate address information
    if (!payload.shipping_address) {
      throw new QueueValidationError(
        "Order missing required shipping_address",
      );
    }

    const addr = payload.shipping_address;
    if (
      !addr.address1 ||
      !addr.city ||
      !addr.province ||
      !addr.country ||
      !addr.zip
    ) {
      throw new QueueValidationError("Shipping address missing required fields");
    }

    // Validate line items
    if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
      throw new QueueValidationError("Order must have at least one line item");
    }

    for (const item of payload.line_items) {
      if (!item.product_id || !item.variant_id || !item.quantity) {
        throw new QueueValidationError(
          "Line item missing required fields: product_id, variant_id, quantity",
        );
      }
    }

    // Validate financial status
    const validStatuses = [
      "authorized",
      "pending",
      "paid",
      "refunded",
      "voided",
    ];
    if (!validStatuses.includes(payload.financial_status)) {
      throw new QueueValidationError(
        `Invalid financial_status: ${payload.financial_status}`,
      );
    }
  }

  /**
   * Process order webhook — upsert in database, check fulfillment, emit events.
   *
   * @param job Order webhook job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  async process(
    job: QueueJobPayload,
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job as { type: "order_webhook"; data: OrderWebhookJob };
    const { shopId, payload } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[OrderWebhookConsumer] Processing order ${payload.id} for shop ${shopId}`,
      );

      // Step 1: Transform and normalize order data
      const normalizedOrder = this.normalizeOrderPayload(payload, shopId);

      // Step 2: Upsert order in database
      await this.upsertOrderInDatabase(normalizedOrder);

      // Step 3: Check fulfillment readiness
      const canFulfill = await this.checkFulfillmentReadiness(
        shopId,
        payload.id,
        payload.financial_status,
      );

      // Step 4: Trigger fulfillment process if applicable
      if (canFulfill && payload.fulfillment_status === "unshipped") {
        await this.triggerFulfillmentCheck(shopId, payload.id);
      }

      // Step 5: Emit analytics event for downstream tracking
      await this.emitAnalyticsEvent(shopId, payload.id, payload);

      // Step 6: Trigger notifications based on order status
      if (payload.financial_status === "paid") {
        await this.triggerOrderConfirmationNotification(
          shopId,
          payload.id,
          payload.email,
        );
      }

      // Calculate processing time
      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          orderId: payload.id,
          shopId,
          status: payload.fulfillment_status,
          fulfillmentTriggered: canFulfill,
        },
      };
    } catch (error) {
      // Determine if error is retriable
      if (
        error instanceof Error &&
        error.message.includes("database")
      ) {
        // Database errors are transient and should be retried
        throw new QueueTransientError(
          `Database error processing order: ${error.message}`,
          { orderId: payload.id, cause: error.message },
        );
      }

      if (error instanceof QueueValidationError) {
        // Validation errors are permanent
        throw new QueuePermanentError(
          `Invalid order payload: ${error.message}`,
          { orderId: payload.id },
        );
      }

      // Default to transient for unexpected errors
      throw new QueueTransientError(
        `Unexpected error processing order: ${error instanceof Error ? error.message : String(error)}`,
        { orderId: payload.id },
      );
    }
  }

  /**
   * Normalize and enrich order payload for database storage.
   *
   * @param payload Shopify order payload
   * @param shopId Shop identifier
   * @returns Normalized order object
   */
  private normalizeOrderPayload(
    payload: OrderWebhookJob["payload"],
    shopId: string,
  ): Record<string, unknown> {
    return {
      id: payload.id,
      shopId,
      shopifyOrderId: payload.id,
      email: payload.email,
      currency: payload.currency,
      totalPrice: parseFloat(payload.total_price),
      subtotalPrice: parseFloat(payload.subtotal_price),
      totalTax: parseFloat(payload.total_tax),
      totalWeight: payload.total_weight,
      financialStatus: payload.financial_status,
      fulfillmentStatus: payload.fulfillment_status || "unshipped",
      lineItems: payload.line_items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price),
        sku: item.sku,
      })),
      shippingAddress: {
        firstName: payload.shipping_address.first_name,
        lastName: payload.shipping_address.last_name,
        address1: payload.shipping_address.address1,
        address2: payload.shipping_address.address2,
        city: payload.shipping_address.city,
        province: payload.shipping_address.province,
        country: payload.shipping_address.country,
        postalCode: payload.shipping_address.zip,
        phone: payload.shipping_address.phone,
      },
      createdAt: new Date(payload.created_at),
      syncedAt: new Date(),
    };
  }

  /**
   * Upsert order record in database with error handling.
   *
   * @param order Normalized order object
   * @throws QueueTransientError if database operation fails
   */
  private async upsertOrderInDatabase(
    order: Record<string, unknown>,
  ): Promise<void> {
    try {
      console.log(
        `[OrderWebhookConsumer] Upserting order ${order.id} to database`,
      );

      // Upsert order using tenant-aware Prisma
      await (dbPrisma as any).order.upsert({
        where: { shopifyOrderId: order.id as string },
        create: order,
        update: {
          email: order.email,
          totalPrice: order.totalPrice,
          subtotalPrice: order.subtotalPrice,
          totalTax: order.totalTax,
          financialStatus: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          syncedAt: order.syncedAt,
        },
      });

      await this.simulateAsyncOperation(50);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to upsert order: ${error instanceof Error ? error.message : String(error)}`,
        { orderId: order.id, operation: "upsert" },
      );
    }
  }

  /**
   * Check if order is eligible for fulfillment processing.
   *
   * @param shopId Shop identifier
   * @param orderId Order identifier
   * @param financialStatus Current financial status
   * @returns Whether order can be fulfilled
   */
  private async checkFulfillmentReadiness(
    shopId: string,
    orderId: string,
    financialStatus: string,
  ): Promise<boolean> {
    try {
      // In production, fetch fulfillment rules for the shop
      // and check if this order qualifies
      console.log(
        `[OrderWebhookConsumer] Checking fulfillment eligibility for order ${orderId}`,
      );

      // Simulate async operation
      await this.simulateAsyncOperation(30);

      // For now, fulfill if payment is complete
      return financialStatus === "paid";
    } catch (error) {
      console.error(
        `[OrderWebhookConsumer] Error checking fulfillment readiness:`,
        error,
      );
      return false;
    }
  }

  /**
   * Trigger fulfillment process for the order.
   *
   * @param shopId Shop identifier
   * @param orderId Order identifier
   */
  private async triggerFulfillmentCheck(
    shopId: string,
    orderId: string,
  ): Promise<void> {
    try {
      console.log(
        `[OrderWebhookConsumer] Triggering fulfillment check for order ${orderId}`,
      );

      // Queue fulfillment job via BullMQ or equivalent queue
      // In production, this would queue a fulfillment job
      // await queueManager.enqueue("fulfillment_check", {
      //   orderId,
      //   shopId,
      // });

      await this.simulateAsyncOperation(40);
    } catch (error) {
      console.error(
        `[OrderWebhookConsumer] Error triggering fulfillment:`,
        error,
      );
    }
  }

  /**
   * Emit analytics event for order tracking and reporting.
   *
   * @param shopId Shop identifier
   * @param orderId Order identifier
   * @param payload Original order payload
   */
  private async emitAnalyticsEvent(
    shopId: string,
    orderId: string,
    payload: OrderWebhookJob["payload"],
  ): Promise<void> {
    try {
      console.log(
        `[OrderWebhookConsumer] Emitting analytics event for order ${orderId}`,
      );

      if (!this.eventBus) {
        console.warn("[OrderWebhookConsumer] EventBus not initialized, skipping event emission");
        return;
      }

      // Emit order created event
      await this.eventBus.emit("order.created", {
        orderId,
        shopId,
        customerId: payload.email,
        totalAmount: parseFloat(payload.total_price),
        currency: payload.currency,
        createdAt: payload.created_at,
      }, { tenantId: shopId });

      await this.simulateAsyncOperation(20);
    } catch (error) {
      console.error(
        `[OrderWebhookConsumer] Error emitting analytics event:`,
        error,
      );
    }
  }

  /**
   * Trigger order confirmation notification.
   *
   * @param shopId Shop identifier
   * @param orderId Order identifier
   * @param email Customer email
   */
  private async triggerOrderConfirmationNotification(
    shopId: string,
    orderId: string,
    email: string,
  ): Promise<void> {
    try {
      console.log(
        `[OrderWebhookConsumer] Queuing confirmation notification for order ${orderId}`,
      );

      if (!this.eventBus) {
        console.warn("[OrderWebhookConsumer] EventBus not initialized, skipping notification");
        return;
      }

      // Emit order confirmed event
      await this.eventBus.emit("order.confirmed", {
        orderId,
        shopId,
        confirmedAt: new Date().toISOString(),
      }, { tenantId: shopId });

      await this.simulateAsyncOperation(25);
    } catch (error) {
      console.error(
        `[OrderWebhookConsumer] Error queuing notification:`,
        error,
      );
    }
  }

  /**
   * Simulate async operation for testing (remove in production).
   *
   * @param ms Milliseconds to wait
   */
  private async simulateAsyncOperation(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
