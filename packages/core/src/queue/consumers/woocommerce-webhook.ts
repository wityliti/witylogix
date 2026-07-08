// @ts-nocheck
/**
 * WooCommerce webhook consumer — processes external order/product events from WooCommerce.
 *
 * Flow:
 *   1. Validate incoming WooCommerce webhook payload
 *   2. Map WooCommerce data to normalized format using WooCommerceAdapter
 *   3. Upsert record in database with source='WOOCOMMERCE'
 *   4. Emit events via TypedEventBus for downstream processing
 *   5. Trigger fulfillment, notifications, or other workflows
 *
 * Handles events:
 *   - order.created, order.updated, order.deleted
 *   - product.created, product.updated, product.deleted
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
import { WooCommerceAdapter } from "../../platforms/adapters/woocommerce.js";
import type {
  WooCommerceOrder,
  WooCommerceProduct,
} from "../../platforms/adapters/woocommerce.js";

/**
 * WooCommerce webhook consumer implementation.
 */
export class WooCommerceWebhookConsumer extends QueueConsumer {
  private eventBus?: TypedEventBus<WitylogixEvents>;
  private adapter = new WooCommerceAdapter();

  constructor(
    config: ConsumerConfig,
    eventBus?: TypedEventBus<WitylogixEvents>,
  ) {
    super(config);
    this.eventBus = eventBus;
  }

  /**
   * Validate WooCommerce webhook payload format and content.
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
      data: OrderWebhookJob | ProductWebhookJob;
    };

    // Verify source is WOOCOMMERCE
    if (data.source && data.source !== "WOOCOMMERCE") {
      throw new QueueValidationError(
        `Expected WOOCOMMERCE source, got ${data.source}`,
      );
    }

    // Basic validation of required fields
    if (!data.shopId || (!data.externalOrderId && !data.externalProductId)) {
      throw new QueueValidationError(
        "Webhook missing required fields: shopId and externalOrderId/externalProductId",
      );
    }
  }

  /**
   * Process WooCommerce webhook — map, upsert in database, emit events.
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
      await this.validateJob(job);

      if (job.type === "order_webhook") {
        return await this.processOrderWebhook(
          job as { type: "order_webhook"; data: OrderWebhookJob },
          metadata,
        );
      } else if (job.type === "product_webhook") {
        return await this.processProductWebhook(
          job as { type: "product_webhook"; data: ProductWebhookJob },
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

      if (error instanceof Error && error.message.includes("database")) {
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
   * Process order webhook (create, update, delete)
   *
   * @param job Order webhook job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  private async processOrderWebhook(
    job: { type: "order_webhook"; data: OrderWebhookJob },
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job;
    const { shopId, payload, topic, deliveryId, connectionId } = data;
    const externalOrderId = data.externalOrderId;
    const jobId = metadata.jobId;

    // Step 1: Idempotency — skip if this delivery was already processed
    if (deliveryId && connectionId) {
      const existing = await (dbPrisma as any).wooCommerceWebhookLog.findFirst({
        where: { connectionId, deliveryId },
      });
      if (existing?.processed === true) {
        return {
          success: true,
          jobId,
          processingTimeMs: 0,
          data: { duplicate: true, deliveryId },
        };
      }
    }

    // Step 2: Validate payload has required fields
    if (!payload || typeof (payload as any).id === "undefined") {
      throw new QueueValidationError(
        "Order payload missing required field: id",
      );
    }

    // Step 3: Map WooCommerce order data using adapter
    console.log(
      `[WooCommerceWebhookConsumer] Upserting order ${externalOrderId} to database`,
    );
    const mappedOrder = this.adapter.mapOrder(
      payload as unknown as WooCommerceOrder,
    );

    // Step 4: Upsert order in database with source='WOOCOMMERCE'
    await this.upsertOrder(shopId, mappedOrder);

    // Step 5: Create Shipment for order.created (idempotent — skip if one already exists)
    let shipmentCreated = false;
    if (topic === "order.created") {
      const order = await (dbPrisma as any).order.findFirst({
        where: { shopId, externalOrderId },
      });
      if (order) {
        const existingShipment = await (dbPrisma as any).shipment.findFirst({
          where: { orderId: order.id, shopId },
        });
        if (!existingShipment) {
          const shippingAddr =
            (payload as any).shipping ?? (payload as any).billing ?? {};
          await (dbPrisma as any).shipment.create({
            data: {
              shopId,
              orderId: order.id,
              shipmentNumber: `WC-${externalOrderId}`,
              status: "PENDING",
              recipientName:
                `${shippingAddr.first_name ?? ""} ${shippingAddr.last_name ?? ""}`.trim(),
              recipientPhone: shippingAddr.phone ?? null,
              addressLine1: shippingAddr.address_1 ?? "",
              addressLine2: shippingAddr.address_2 ?? null,
              city: shippingAddr.city ?? "",
              state: shippingAddr.state ?? "",
              postalCode: shippingAddr.postcode ?? "",
              country: shippingAddr.country ?? "",
            },
          });
          shipmentCreated = true;
        }
      }
    }

    // Step 6: Mark delivery as processed in idempotency log
    if (deliveryId && connectionId) {
      const resource = topic?.split(".")[0] ?? "order";
      const event = topic?.split(".")[1] ?? "unknown";
      await (dbPrisma as any).wooCommerceWebhookLog.upsert({
        where: { connectionId_deliveryId: { connectionId, deliveryId } },
        create: {
          connectionId,
          deliveryId,
          topic: topic ?? null,
          resource,
          event,
          payload,
          verified: true,
          processed: true,
          status: "processed",
          processedAt: new Date(),
        },
        update: {
          processed: true,
          status: "processed",
          processedAt: new Date(),
        },
      });
    }

    // Step 7: Emit order events
    console.log(
      `[WooCommerceWebhookConsumer] Emitting order events for order ${externalOrderId}`,
    );
    await this.emitOrderEvents(shopId, externalOrderId, mappedOrder);

    const processingTimeMs =
      Date.now() - (metadata.processingStartedAt ?? Date.now());

    return {
      success: true,
      jobId,
      processingTimeMs,
      data: {
        orderId: externalOrderId,
        shopId,
        source: "WOOCOMMERCE",
        shipmentCreated,
        topic: topic ?? null,
      },
    };
  }

  /**
   * Process product webhook (create, update, delete)
   *
   * @param job Product webhook job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  private async processProductWebhook(
    job: { type: "product_webhook"; data: ProductWebhookJob },
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job;
    const { shopId, action, payload } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[WooCommerceWebhookConsumer] Processing ${action} product webhook ${data.externalProductId} for shop ${shopId}`,
      );

      // Route to appropriate handler based on action
      switch (action) {
        case "create":
        case "update":
          if (!payload) {
            throw new QueueValidationError(
              "Payload required for create/update",
            );
          }
          // Map WooCommerce product data using adapter
          const mappedProduct = this.adapter.mapProduct(
            payload as unknown as WooCommerceProduct,
          );
          await this.syncProductData(shopId, mappedProduct);
          await this.updateVariantInventory(shopId, mappedProduct);
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
          source: "WOOCOMMERCE",
          action,
          variantCount: payload?.variants.length || 0,
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
        `[WooCommerceWebhookConsumer] Upserting order ${order.externalOrderId} to database`,
      );

      await (dbPrisma as any).order.upsert({
        where: { externalOrderId: order.externalOrderId },
        create: {
          shopId,
          externalOrderId: order.externalOrderId,
          source: order.source,
          email: order.email,
          totalPrice: order.totalPrice,
          subtotalPrice: order.subtotalPrice,
          totalTax: order.totalTax,
          financialStatus: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          lineItems: order.lineItems,
          shippingAddress: order.shippingAddress,
          createdAt: order.createdAt,
          syncedAt: new Date(),
        },
        update: {
          email: order.email,
          totalPrice: order.totalPrice,
          subtotalPrice: order.subtotalPrice,
          totalTax: order.totalTax,
          financialStatus: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          lineItems: order.lineItems,
          shippingAddress: order.shippingAddress,
          syncedAt: new Date(),
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
   * @param financialStatus Financial status
   * @returns Whether order can be fulfilled
   */
  private async checkFulfillmentReadiness(
    shopId: string,
    orderId: string,
    financialStatus: string,
  ): Promise<boolean> {
    try {
      console.log(
        `[WooCommerceWebhookConsumer] Checking fulfillment eligibility for order ${orderId}`,
      );

      await this.simulateAsyncOperation(30);

      // Fulfill if payment is complete
      return financialStatus === "paid";
    } catch (error) {
      console.error(
        `[WooCommerceWebhookConsumer] Error checking fulfillment readiness:`,
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
        `[WooCommerceWebhookConsumer] Triggering fulfillment check for order ${orderId}`,
      );

      await this.simulateAsyncOperation(40);
    } catch (error) {
      console.error(
        `[WooCommerceWebhookConsumer] Error triggering fulfillment:`,
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
        `[WooCommerceWebhookConsumer] Emitting order events for order ${orderId}`,
      );

      if (!this.eventBus) {
        console.warn(
          "[WooCommerceWebhookConsumer] EventBus not initialized, skipping event emission",
        );
        return;
      }

      // Emit order created event
      await this.eventBus.emit(
        "order.created",
        {
          orderId,
          shopId,
          customerId: order.email,
          totalAmount: order.totalPrice,
          currency: order.currency,
          createdAt: order.createdAt.toISOString(),
        },
        { tenantId: shopId },
      );

      await this.simulateAsyncOperation(20);
    } catch (error) {
      console.error(
        `[WooCommerceWebhookConsumer] Error emitting order events:`,
        error,
      );
    }
  }

  /**
   * Trigger order confirmation notification
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
        `[WooCommerceWebhookConsumer] Queuing confirmation notification for order ${orderId}`,
      );

      if (!this.eventBus) {
        console.warn(
          "[WooCommerceWebhookConsumer] EventBus not initialized, skipping notification",
        );
        return;
      }

      // Emit order confirmed event
      await this.eventBus.emit(
        "order.confirmed",
        {
          orderId,
          shopId,
          confirmedAt: new Date().toISOString(),
        },
        { tenantId: shopId },
      );

      await this.simulateAsyncOperation(25);
    } catch (error) {
      console.error(
        `[WooCommerceWebhookConsumer] Error queuing notification:`,
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
  private async syncProductData(shopId: string, product: any): Promise<void> {
    try {
      console.log(
        `[WooCommerceWebhookConsumer] Syncing product data for ${product.title}`,
      );

      await (dbPrisma as any).product.upsert({
        where: { externalProductId: product.externalProductId },
        create: {
          shopId,
          externalProductId: product.externalProductId,
          source: product.source,
          title: product.title,
          vendor: product.vendor,
          productType: product.productType,
          handle: product.handle,
          tags: product.tags,
          variantCount: product.variants.length,
          syncedAt: new Date(),
        },
        update: {
          title: product.title,
          vendor: product.vendor,
          productType: product.productType,
          handle: product.handle,
          tags: product.tags,
          variantCount: product.variants.length,
          syncedAt: new Date(),
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
   * Update variant inventory levels
   *
   * @param shopId Shop identifier
   * @param product Mapped product from adapter
   */
  private async updateVariantInventory(
    shopId: string,
    product: any,
  ): Promise<void> {
    try {
      console.log(
        `[WooCommerceWebhookConsumer] Updating inventory for ${product.variants.length} variants`,
      );

      for (const variant of product.variants) {
        await (dbPrisma as any).variant.upsert({
          where: { wooCommerceVariantId: variant.id },
          create: {
            wooCommerceVariantId: variant.id,
            sku: variant.sku,
            barcode: variant.barcode,
            title: variant.title,
            inventoryQuantity: variant.inventoryQuantity,
            weight: variant.weight,
            price: variant.price,
            productId: product.externalProductId,
          },
          update: {
            inventoryQuantity: variant.inventoryQuantity,
            price: variant.price,
            syncedAt: new Date(),
          },
        });
      }

      await this.simulateAsyncOperation(50);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to update variant inventory: ${error instanceof Error ? error.message : String(error)}`,
        {
          productId: product.externalProductId,
          variantCount: product.variants.length,
        },
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
      console.log(`[WooCommerceWebhookConsumer] Deleting product ${productId}`);

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
        `[WooCommerceWebhookConsumer] Emitting product event: ${action}`,
      );

      if (!this.eventBus) {
        console.warn(
          "[WooCommerceWebhookConsumer] EventBus not initialized, skipping event emission",
        );
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
          { tenantId: shopId },
        );
      } else if (action === "update") {
        await this.eventBus.emit(
          "product.updated",
          {
            productId,
            shopId,
            updatedAt: new Date().toISOString(),
          },
          { tenantId: shopId },
        );
      } else if (action === "delete") {
        await this.eventBus.emit(
          "product.deleted",
          {
            productId,
            shopId,
            deletedAt: new Date().toISOString(),
          },
          { tenantId: shopId },
        );
      }

      await this.simulateAsyncOperation(20);
    } catch (error) {
      console.error(
        `[WooCommerceWebhookConsumer] Error emitting product events:`,
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
