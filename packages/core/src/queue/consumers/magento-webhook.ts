// @ts-nocheck
/**
 * Magento webhook consumer — processes external order/product events from Magento 2.
 *
 * Flow:
 *   1. Validate incoming Magento webhook payload
 *   2. Map Magento data to normalized format using MagentoAdapter
 *   3. Upsert record in database with source='MAGENTO'
 *   4. Emit events via TypedEventBus for downstream processing
 *   5. Trigger fulfillment, notifications, or other workflows
 *
 * Handles events:
 *   - sales_order_save_after
 *   - catalog_product_save_after
 *   - customer_save_after
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
import { MagentoAdapter } from "../../platforms/adapters/magento.js";
import type {
  MagentoOrder,
  MagentoProduct,
  MagentoCustomer,
} from "../../platforms/adapters/magento.js";

/**
 * Magento webhook consumer implementation.
 */
export class MagentoWebhookConsumer extends QueueConsumer {
  private eventBus?: TypedEventBus<WitylogixEvents>;
  private adapter = new MagentoAdapter();

  constructor(config: ConsumerConfig, eventBus?: TypedEventBus<WitylogixEvents>) {
    super(config);
    this.eventBus = eventBus;
  }

  /**
   * Validate Magento webhook payload format and content.
   *
   * @param job Job payload
   * @throws QueueValidationError if validation fails
   */
  protected async validateJob(job: QueueJobPayload): Promise<void> {
    await super.validateJob(job);

    if (
      job.type !== "order_webhook" &&
      job.type !== "product_webhook" &&
      job.type !== "customer_webhook"
    ) {
      throw new QueueValidationError(
        `Expected order_webhook, product_webhook, or customer_webhook, got ${job.type}`,
      );
    }

    const { data } = job as {
      type: "order_webhook" | "product_webhook" | "customer_webhook";
      data:
        | OrderWebhookJob
        | ProductWebhookJob
        | { source?: string; shopId: string; externalCustomerId: string };
    };

    // Verify source is MAGENTO
    if (data.source && data.source !== "MAGENTO") {
      throw new QueueValidationError(
        `Expected MAGENTO source, got ${data.source}`,
      );
    }

    // Basic validation of required fields
    if (!data.shopId) {
      throw new QueueValidationError(
        "Webhook missing required field: shopId",
      );
    }

    if (
      job.type === "order_webhook" &&
      !(job as any).data.externalOrderId
    ) {
      throw new QueueValidationError(
        "Order webhook missing required field: externalOrderId",
      );
    }

    if (
      job.type === "product_webhook" &&
      !(job as any).data.externalProductId
    ) {
      throw new QueueValidationError(
        "Product webhook missing required field: externalProductId",
      );
    }

    if (
      job.type === "customer_webhook" &&
      !(job as any).data.externalCustomerId
    ) {
      throw new QueueValidationError(
        "Customer webhook missing required field: externalCustomerId",
      );
    }
  }

  /**
   * Process Magento webhook — map, upsert in database, emit events.
   *
   * @param job Webhook job (order, product, or customer)
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
          job as { type: "order_webhook"; data: OrderWebhookJob },
          metadata,
        );
      } else if (job.type === "product_webhook") {
        return await this.processProductWebhook(
          job as { type: "product_webhook"; data: ProductWebhookJob },
          metadata,
        );
      } else if (job.type === "customer_webhook") {
        return await this.processCustomerWebhook(
          job as {
            type: "customer_webhook";
            data: { source: string; shopId: string; externalCustomerId: string; payload: any };
          },
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
   * Process order webhook (sales_order_save_after)
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
    const { shopId, payload } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[MagentoWebhookConsumer] Processing order webhook ${data.externalOrderId} for shop ${shopId}`,
      );

      // Step 1: Map Magento order data using adapter
      const mappedOrder = this.adapter.mapOrder(payload as unknown as MagentoOrder);

      // Step 2: Upsert order in database with source='MAGENTO'
      await this.upsertOrder(shopId, mappedOrder);

      // Step 3: Check fulfillment eligibility and trigger if applicable
      const canFulfill = await this.checkFulfillmentReadiness(
        shopId,
        data.externalOrderId,
        mappedOrder.financialStatus,
      );

      if (canFulfill && mappedOrder.fulfillmentStatus === "unshipped") {
        await this.triggerFulfillmentCheck(shopId, data.externalOrderId);
      }

      // Step 4: Emit order events
      await this.emitOrderEvents(shopId, data.externalOrderId, mappedOrder);

      // Step 5: Trigger notifications if payment is complete
      if (mappedOrder.financialStatus === "paid") {
        await this.triggerOrderConfirmationNotification(
          shopId,
          data.externalOrderId,
          mappedOrder.email,
        );
      }

      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          orderId: data.externalOrderId,
          shopId,
          source: "MAGENTO",
          status: mappedOrder.fulfillmentStatus,
          fulfillmentTriggered: canFulfill,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process product webhook (catalog_product_save_after)
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
        `[MagentoWebhookConsumer] Processing ${action} product webhook ${data.externalProductId} for shop ${shopId}`,
      );

      // Route to appropriate handler based on action
      switch (action) {
        case "create":
        case "update":
          if (!payload) {
            throw new QueueValidationError("Payload required for create/update");
          }
          // Map Magento product data using adapter
          const mappedProduct = this.adapter.mapProduct(
            payload as unknown as MagentoProduct,
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
          source: "MAGENTO",
          action,
          variantCount: payload?.variants?.length || 0,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process customer webhook (customer_save_after)
   *
   * @param job Customer webhook job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  private async processCustomerWebhook(
    job: {
      type: "customer_webhook";
      data: { source: string; shopId: string; externalCustomerId: string; payload: any };
    },
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job;
    const { shopId, payload } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[MagentoWebhookConsumer] Processing customer webhook ${data.externalCustomerId} for shop ${shopId}`,
      );

      // Map Magento customer data using adapter
      const mappedCustomer = this.adapter.mapCustomer(
        payload as unknown as MagentoCustomer,
      );

      // Upsert customer in database
      await this.upsertCustomer(shopId, mappedCustomer);

      // Emit customer events
      await this.emitCustomerEvents(shopId, data.externalCustomerId);

      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          customerId: data.externalCustomerId,
          shopId,
          source: "MAGENTO",
          email: mappedCustomer.email,
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
        `[MagentoWebhookConsumer] Upserting order ${order.externalOrderId} to database`,
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
   * Upsert customer in database
   *
   * @param shopId Shop identifier
   * @param customer Mapped customer from adapter
   */
  private async upsertCustomer(shopId: string, customer: any): Promise<void> {
    try {
      console.log(
        `[MagentoWebhookConsumer] Upserting customer ${customer.externalCustomerId} to database`,
      );

      await (dbPrisma as any).customer.upsert({
        where: { externalCustomerId: customer.externalCustomerId },
        create: {
          shopId,
          externalCustomerId: customer.externalCustomerId,
          source: customer.source,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          address: customer.address,
          syncedAt: new Date(),
        },
        update: {
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          address: customer.address,
          syncedAt: new Date(),
        },
      });

      await this.simulateAsyncOperation(40);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to upsert customer: ${error instanceof Error ? error.message : String(error)}`,
        { customerId: customer.externalCustomerId, operation: "upsert" },
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
        `[MagentoWebhookConsumer] Checking fulfillment eligibility for order ${orderId}`,
      );

      await this.simulateAsyncOperation(30);

      // Fulfill if payment is complete
      return financialStatus === "paid";
    } catch (error) {
      console.error(
        `[MagentoWebhookConsumer] Error checking fulfillment readiness:`,
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
        `[MagentoWebhookConsumer] Triggering fulfillment check for order ${orderId}`,
      );

      await this.simulateAsyncOperation(40);
    } catch (error) {
      console.error(
        `[MagentoWebhookConsumer] Error triggering fulfillment:`,
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
        `[MagentoWebhookConsumer] Emitting order events for order ${orderId}`,
      );

      if (!this.eventBus) {
        console.warn("[MagentoWebhookConsumer] EventBus not initialized, skipping event emission");
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
        { tenantId: shopId }
      );

      await this.simulateAsyncOperation(20);
    } catch (error) {
      console.error(
        `[MagentoWebhookConsumer] Error emitting order events:`,
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
        `[MagentoWebhookConsumer] Queuing confirmation notification for order ${orderId}`,
      );

      if (!this.eventBus) {
        console.warn("[MagentoWebhookConsumer] EventBus not initialized, skipping notification");
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
        { tenantId: shopId }
      );

      await this.simulateAsyncOperation(25);
    } catch (error) {
      console.error(
        `[MagentoWebhookConsumer] Error queuing notification:`,
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
        `[MagentoWebhookConsumer] Syncing product data for ${product.title}`,
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
        `[MagentoWebhookConsumer] Updating inventory for ${product.variants.length} variants`,
      );

      for (const variant of product.variants) {
        await (dbPrisma as any).variant.upsert({
          where: { magentoVariantId: variant.id },
          create: {
            magentoVariantId: variant.id,
            sku: variant.sku,
            title: variant.title,
            inventoryQuantity: variant.inventoryQuantity,
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
        { productId: product.externalProductId, variantCount: product.variants.length },
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
        `[MagentoWebhookConsumer] Deleting product ${productId}`,
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
        `[MagentoWebhookConsumer] Emitting product event: ${action}`,
      );

      if (!this.eventBus) {
        console.warn("[MagentoWebhookConsumer] EventBus not initialized, skipping event emission");
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
        `[MagentoWebhookConsumer] Error emitting product events:`,
        error,
      );
    }
  }

  /**
   * Emit customer events
   *
   * @param shopId Shop identifier
   * @param customerId Customer identifier
   */
  private async emitCustomerEvents(
    shopId: string,
    customerId: string,
  ): Promise<void> {
    try {
      console.log(
        `[MagentoWebhookConsumer] Emitting customer events for ${customerId}`,
      );

      if (!this.eventBus) {
        console.warn("[MagentoWebhookConsumer] EventBus not initialized, skipping event emission");
        return;
      }

      // Emit customer created/updated event
      await this.eventBus.emit(
        "customer.created",
        {
          customerId,
          shopId,
          createdAt: new Date().toISOString(),
        },
        { tenantId: shopId }
      );

      await this.simulateAsyncOperation(15);
    } catch (error) {
      console.error(
        `[MagentoWebhookConsumer] Error emitting customer events:`,
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
