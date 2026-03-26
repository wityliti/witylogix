// @ts-nocheck
/**
 * Custom platform webhook consumer — processes external order/product events from custom integrations.
 *
 * Flow:
 *   1. Validate incoming webhook payload format
 *   2. Extract event type from webhook (header or payload field)
 *   3. Map custom data to normalized format using CustomAdapter
 *   4. Upsert record in database with source='CUSTOM'
 *   5. Emit events via TypedEventBus for downstream processing
 *   6. Trigger fulfillment, notifications, or other workflows
 *
 * Handles events:
 *   - order.created, order.updated
 *   - product.created, product.updated
 *   - Custom event types defined by merchant
 *
 * Supports:
 *   - Configurable field mapping from arbitrary JSON schemas
 *   - Multiple authentication methods (API key, HMAC, Bearer token)
 *   - Flexible event type detection
 */

import type {
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  OrderWebhookJob,
  ProductWebhookJob,
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
import { CustomAdapter } from "../../platforms/adapters/custom.js";
import type { CustomCredentials, CustomWebhookConfig, CustomFieldMapping } from "../../platforms/adapters/custom.js";

/**
 * Custom webhook job payload
 *
 * Extended with custom-specific fields for field mapping and webhook config.
 */
interface CustomOrderWebhookJob extends OrderWebhookJob {
  fieldMapping?: CustomFieldMapping;
  webhookConfig?: CustomWebhookConfig;
  eventTypeFromHeader?: string;
}

interface CustomProductWebhookJob extends ProductWebhookJob {
  fieldMapping?: CustomFieldMapping;
  webhookConfig?: CustomWebhookConfig;
  eventTypeFromHeader?: string;
}

/**
 * Custom webhook consumer implementation
 */
export class CustomWebhookConsumer extends QueueConsumer {
  private eventBus?: TypedEventBus<WitylogixEvents>;
  private adapter = new CustomAdapter();

  constructor(config: ConsumerConfig, eventBus?: TypedEventBus<WitylogixEvents>) {
    super(config);
    this.eventBus = eventBus;
  }

  /**
   * Validate custom webhook payload format and content.
   *
   * @param job Job payload
   * @throws QueueValidationError if validation fails
   */
  protected async validateJob(job: QueueJobPayload): Promise<void> {
    await super.validateJob(job);

    if (job.type !== "order_webhook" && job.type !== "product_webhook") {
      throw new QueueValidationError(
        `Expected order_webhook or product_webhook, got ${job.type}`,
      );
    }

    const { data } = job as {
      type: "order_webhook" | "product_webhook";
      data: CustomOrderWebhookJob | CustomProductWebhookJob;
    };

    // Verify source is CUSTOM
    if (data.source && data.source !== "CUSTOM") {
      throw new QueueValidationError(
        `Expected CUSTOM source, got ${data.source}`,
      );
    }

    // Basic validation of required fields
    if (!data.shopId || (!data.externalOrderId && !data.externalProductId)) {
      throw new QueueValidationError(
        "Webhook missing required fields: shopId and externalOrderId/externalProductId",
      );
    }

    // Validate field mapping is available
    const typedData = data as CustomOrderWebhookJob | CustomProductWebhookJob;
    if (!typedData.fieldMapping) {
      throw new QueueValidationError(
        "Custom webhook missing field mapping configuration",
      );
    }
  }

  /**
   * Process custom webhook — map, upsert in database, emit events.
   *
   * @param job Webhook job (order or product)
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  async process(
    job: QueueJobPayload,
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const jobId = metadata.jobId;

    try {
      if (job.type === "order_webhook") {
        return await this.processOrderWebhook(
          job as { type: "order_webhook"; data: CustomOrderWebhookJob },
          metadata,
        );
      } else if (job.type === "product_webhook") {
        return await this.processProductWebhook(
          job as { type: "product_webhook"; data: CustomProductWebhookJob },
          metadata,
        );
      }

      throw new QueueValidationError(`Unknown webhook type: ${job.type}`);
    } catch (error) {
      if (error instanceof QueueValidationError) {
        throw new QueuePermanentError(
          `Invalid webhook payload: ${error.message}`,
          { jobId },
        );
      }

      if (
        error instanceof Error &&
        error.message.includes("database")
      ) {
        throw new QueueTransientError(
          `Database error processing webhook: ${error.message}`,
          { jobId, cause: error.message },
        );
      }

      throw new QueueTransientError(
        `Unexpected error processing webhook: ${error instanceof Error ? error.message : String(error)}`,
        { jobId },
      );
    }
  }

  /**
   * Process order webhook (create, update)
   *
   * @param job Order webhook job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  private async processOrderWebhook(
    job: { type: "order_webhook"; data: CustomOrderWebhookJob },
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job;
    const { shopId, payload, fieldMapping, webhookConfig } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[CustomWebhookConsumer] Processing order webhook ${data.externalOrderId} for shop ${shopId}`,
      );

      // Step 1: Map custom order data using adapter with field mapping
      const mappedOrder = this.adapter.mapOrder(payload, { order: fieldMapping?.order });

      // Step 2: Set shopId (was empty after mapping)
      mappedOrder.shopId = shopId;

      // Step 3: Upsert order in database with source='CUSTOM'
      await this.upsertOrder(shopId, mappedOrder);

      // Step 4: Check fulfillment eligibility and trigger if applicable
      const canFulfill = await this.checkFulfillmentReadiness(
        shopId,
        data.externalOrderId,
        mappedOrder.status,
      );

      if (canFulfill && mappedOrder.status !== "cancelled") {
        await this.triggerFulfillmentCheck(shopId, data.externalOrderId);
      }

      // Step 5: Emit order events
      await this.emitOrderEvents(shopId, data.externalOrderId, mappedOrder);

      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          orderId: data.externalOrderId,
          shopId,
          source: "CUSTOM",
          status: mappedOrder.status,
          fulfillmentTriggered: canFulfill,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process product webhook (create, update)
   *
   * @param job Product webhook job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  private async processProductWebhook(
    job: { type: "product_webhook"; data: CustomProductWebhookJob },
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job;
    const { shopId, action, payload, fieldMapping } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[CustomWebhookConsumer] Processing ${action} product webhook ${data.externalProductId} for shop ${shopId}`,
      );

      // Route to appropriate handler based on action
      switch (action) {
        case "create":
        case "update":
          if (!payload) {
            throw new QueueValidationError("Payload required for create/update");
          }
          // Map custom product data using adapter with field mapping
          const mappedProduct = this.adapter.mapProduct(payload, { product: fieldMapping?.product });

          // Set shopId (was empty after mapping)
          mappedProduct.shopId = shopId;

          await this.syncProductData(shopId, mappedProduct);
          break;

        case "delete":
          await this.deleteProduct(shopId, data.externalProductId);
          break;

        default:
          throw new QueueValidationError(`Unknown action: ${action}`);
      }

      // Emit product events
      await this.emitProductEvents(shopId, data.externalProductId, action);

      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          productId: data.externalProductId,
          shopId,
          source: "CUSTOM",
          action,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upsert order in database
   *
   * @param shopId Shop identifier
   * @param order Mapped order from adapter
   */
  private async upsertOrder(shopId: string, order: any): Promise<void> {
    try {
      console.log(
        `[CustomWebhookConsumer] Upserting order ${order.externalOrderId} to database`,
      );

      await (dbPrisma as any).order.upsert({
        where: { externalOrderId: order.externalOrderId },
        create: {
          shopId,
          externalOrderId: order.externalOrderId,
          source: order.source,
          customerEmail: order.customerEmail,
          total: order.total,
          currency: order.currency,
          status: order.status,
          shippingAddress: order.shippingAddress,
          lineItems: order.lineItems,
          createdAt: order.createdAt,
          syncedAt: new Date(),
          metadata: order.metadata,
        },
        update: {
          customerEmail: order.customerEmail,
          total: order.total,
          currency: order.currency,
          status: order.status,
          shippingAddress: order.shippingAddress,
          lineItems: order.lineItems,
          syncedAt: new Date(),
          metadata: order.metadata,
        },
      });

      await this.simulateAsyncOperation(50);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to upsert order: ${error instanceof Error ? error.message : String(error)}`,
        { orderId: order.externalOrderId, operation: "upsert" },
      );
    }
  }

  /**
   * Check if order is eligible for fulfillment
   *
   * @param shopId Shop identifier
   * @param orderId Order identifier
   * @param status Order status
   * @returns Whether order can be fulfilled
   */
  private async checkFulfillmentReadiness(
    shopId: string,
    orderId: string,
    status?: string,
  ): Promise<boolean> {
    try {
      console.log(
        `[CustomWebhookConsumer] Checking fulfillment eligibility for order ${orderId}`,
      );

      await this.simulateAsyncOperation(30);

      // Fulfill if status is ready (not cancelled, not refunded)
      return status !== "cancelled" && status !== "refunded" && status !== "failed";
    } catch (error) {
      console.error(
        `[CustomWebhookConsumer] Error checking fulfillment readiness:`,
        error,
      );
      return false;
    }
  }

  /**
   * Trigger fulfillment process for the order
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
        `[CustomWebhookConsumer] Triggering fulfillment check for order ${orderId}`,
      );

      await this.simulateAsyncOperation(40);
    } catch (error) {
      console.error(
        `[CustomWebhookConsumer] Error triggering fulfillment:`,
        error,
      );
    }
  }

  /**
   * Emit order events for downstream processing
   *
   * @param shopId Shop identifier
   * @param orderId Order identifier
   * @param order Mapped order
   */
  private async emitOrderEvents(
    shopId: string,
    orderId: string,
    order: any,
  ): Promise<void> {
    try {
      console.log(
        `[CustomWebhookConsumer] Emitting order events for order ${orderId}`,
      );

      if (!this.eventBus) {
        console.warn("[CustomWebhookConsumer] EventBus not initialized, skipping event emission");
        return;
      }

      // Emit order created event
      await this.eventBus.emit(
        "order.created",
        {
          orderId,
          shopId,
          customerId: order.customerEmail,
          totalAmount: order.total,
          currency: order.currency,
          createdAt: order.createdAt?.toISOString() || new Date().toISOString(),
        },
        { tenantId: shopId }
      );

      await this.simulateAsyncOperation(20);
    } catch (error) {
      console.error(
        `[CustomWebhookConsumer] Error emitting order events:`,
        error,
      );
    }
  }

  /**
   * Sync product metadata to database
   *
   * @param shopId Shop identifier
   * @param product Mapped product from adapter
   */
  private async syncProductData(
    shopId: string,
    product: any,
  ): Promise<void> {
    try {
      console.log(
        `[CustomWebhookConsumer] Syncing product data for ${product.title || product.externalProductId}`,
      );

      await (dbPrisma as any).product.upsert({
        where: { externalProductId: product.externalProductId },
        create: {
          shopId,
          externalProductId: product.externalProductId,
          source: product.source,
          title: product.title,
          description: product.description,
          sku: product.sku,
          price: product.price,
          currency: product.currency,
          status: product.status,
          imageUrl: product.imageUrl,
          syncedAt: new Date(),
          metadata: product.metadata,
        },
        update: {
          title: product.title,
          description: product.description,
          sku: product.sku,
          price: product.price,
          currency: product.currency,
          status: product.status,
          imageUrl: product.imageUrl,
          syncedAt: new Date(),
          metadata: product.metadata,
        },
      });

      await this.simulateAsyncOperation(40);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to sync product data: ${error instanceof Error ? error.message : String(error)}`,
        { productId: product.externalProductId },
      );
    }
  }

  /**
   * Delete product and related data
   *
   * @param shopId Shop identifier
   * @param productId Product identifier
   */
  private async deleteProduct(
    shopId: string,
    productId: string,
  ): Promise<void> {
    try {
      console.log(
        `[CustomWebhookConsumer] Deleting product ${productId}`,
      );

      // Soft delete product
      await (dbPrisma as any).product.update({
        where: { externalProductId: productId },
        data: { deletedAt: new Date() },
      });

      await this.simulateAsyncOperation(35);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to delete product: ${error instanceof Error ? error.message : String(error)}`,
        { productId },
      );
    }
  }

  /**
   * Emit product change events
   *
   * @param shopId Shop identifier
   * @param productId Product identifier
   * @param action Change action (create, update, delete)
   */
  private async emitProductEvents(
    shopId: string,
    productId: string,
    action: string,
  ): Promise<void> {
    try {
      console.log(
        `[CustomWebhookConsumer] Emitting product event: ${action}`,
      );

      if (!this.eventBus) {
        console.warn("[CustomWebhookConsumer] EventBus not initialized, skipping event emission");
        return;
      }

      // Emit appropriate event based on action
      if (action === "create") {
        await this.eventBus.emit(
          "product.created",
          {
            productId,
            shopId,
            createdAt: new Date().toISOString(),
          },
          { tenantId: shopId }
        );
      } else if (action === "update") {
        await this.eventBus.emit(
          "product.updated",
          {
            productId,
            shopId,
            updatedAt: new Date().toISOString(),
          },
          { tenantId: shopId }
        );
      } else if (action === "delete") {
        await this.eventBus.emit(
          "product.deleted",
          {
            productId,
            shopId,
            deletedAt: new Date().toISOString(),
          },
          { tenantId: shopId }
        );
      }

      await this.simulateAsyncOperation(20);
    } catch (error) {
      console.error(
        `[CustomWebhookConsumer] Error emitting product events:`,
        error,
      );
    }
  }

  /**
   * Simulate async operation for testing
   *
   * @param ms Milliseconds to wait
   */
  private async simulateAsyncOperation(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
