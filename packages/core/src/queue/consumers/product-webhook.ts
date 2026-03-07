/**
 * Product webhook consumer — processes Shopify product sync events.
 *
 * Flow:
 *   1. Validate product payload
 *   2. Sync product data to local catalog
 *   3. Update variant inventory levels
 *   4. Refresh product collections
 *   5. Emit product change event
 */

import type {
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  ProductWebhookJob,
} from "../types.js";
import {
  QueueConsumer,
  QueueValidationError,
  QueueTransientError,
  QueuePermanentError,
} from "../consumer.js";
import type { ConsumerConfig } from "../types.js";

/**
 * Product webhook consumer implementation.
 */
export class ProductWebhookConsumer extends QueueConsumer {
  constructor(config: ConsumerConfig) {
    super(config);
  }

  /**
   * Validate product webhook payload.
   *
   * @param job Job payload
   * @throws QueueValidationError if validation fails
   */
  protected async validateJob(job: QueueJobPayload): Promise<void> {
    await super.validateJob(job);

    if (job.type !== "product_webhook") {
      throw new QueueValidationError(
        `Expected product_webhook, got ${job.type}`,
      );
    }

    const { data } = job as {
      type: "product_webhook";
      data: ProductWebhookJob;
    };

    // Validate required fields
    if (!data.shopId || !data.shopifyProductId) {
      throw new QueueValidationError(
        "Product webhook missing shopId or shopifyProductId",
      );
    }

    // For delete actions, minimal validation needed
    if (data.action === "delete") {
      return;
    }

    // For create/update, validate payload structure
    if (!data.payload) {
      throw new QueueValidationError(
        "Product create/update must include payload",
      );
    }

    const { payload } = data;
    if (
      !payload.id ||
      !payload.title ||
      !Array.isArray(payload.variants) ||
      payload.variants.length === 0
    ) {
      throw new QueueValidationError(
        "Product payload missing id, title, or variants",
      );
    }

    // Validate variant structure
    for (const variant of payload.variants) {
      if (!variant.id || !variant.sku || variant.inventory_quantity === undefined) {
        throw new QueueValidationError(
          "Product variant missing required fields: id, sku, inventory_quantity",
        );
      }
    }
  }

  /**
   * Process product webhook — sync product, update inventory, refresh collections.
   *
   * @param job Product webhook job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  async process(
    job: QueueJobPayload,
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job as {
      type: "product_webhook";
      data: ProductWebhookJob;
    };
    const { shopId, action, payload } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[ProductWebhookConsumer] Processing ${action} product ${data.shopifyProductId} for shop ${shopId}`,
      );

      // Route to appropriate handler based on action
      switch (action) {
        case "create":
        case "update":
          if (!payload) {
            throw new QueueValidationError("Payload required for create/update");
          }
          await this.syncProductData(shopId, payload);
          await this.updateVariantInventory(shopId, payload);
          await this.refreshProductCollections(shopId, payload);
          break;

        case "delete":
          await this.deleteProduct(shopId, data.shopifyProductId);
          break;

        default:
          throw new QueueValidationError(`Unknown action: ${action}`);
      }

      // Emit change event
      await this.emitProductChangeEvent(shopId, data.shopifyProductId, action);

      // Calculate processing time
      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          productId: data.shopifyProductId,
          shopId,
          action,
          variantCount: payload?.variants.length || 0,
        },
      };
    } catch (error) {
      if (error instanceof QueueValidationError) {
        throw new QueuePermanentError(
          `Invalid product payload: ${error.message}`,
          { productId: data.shopifyProductId },
        );
      }

      if (
        error instanceof Error &&
        error.message.includes("database")
      ) {
        throw new QueueTransientError(
          `Database error processing product: ${error.message}`,
          { productId: data.shopifyProductId },
        );
      }

      throw new QueueTransientError(
        `Error processing product: ${error instanceof Error ? error.message : String(error)}`,
        { productId: data.shopifyProductId },
      );
    }
  }

  /**
   * Sync product metadata to local database.
   *
   * @param shopId Shop identifier
   * @param payload Product payload
   */
  private async syncProductData(
    shopId: string,
    payload: NonNullable<ProductWebhookJob["payload"]>,
  ): Promise<void> {
    try {
      console.log(
        `[ProductWebhookConsumer] Syncing product data for ${payload.title}`,
      );

      const productData = {
        id: payload.id,
        shopId,
        shopifyProductId: payload.id,
        title: payload.title,
        vendor: payload.vendor,
        productType: payload.product_type,
        handle: payload.handle,
        tags: payload.tags || [],
        variantCount: payload.variants.length,
        syncedAt: new Date(),
      };

      // TODO: Upsert into database when available
      // await prisma.product.upsert({
      //   where: { shopifyProductId: payload.id },
      //   create: productData,
      //   update: productData,
      // });

      await this.simulateAsyncOperation(40);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to sync product data: ${error instanceof Error ? error.message : String(error)}`,
        { productId: payload.id },
      );
    }
  }

  /**
   * Update variant inventory levels in database.
   *
   * @param shopId Shop identifier
   * @param payload Product payload
   */
  private async updateVariantInventory(
    shopId: string,
    payload: NonNullable<ProductWebhookJob["payload"]>,
  ): Promise<void> {
    try {
      console.log(
        `[ProductWebhookConsumer] Updating inventory for ${payload.variants.length} variants`,
      );

      for (const variant of payload.variants) {
        // TODO: Upsert variant inventory when available
        // await prisma.variant.upsert({
        //   where: { shopifyVariantId: variant.id },
        //   create: {
        //     shopifyVariantId: variant.id,
        //     sku: variant.sku,
        //     barcode: variant.barcode,
        //     title: variant.title,
        //     inventoryQuantity: variant.inventory_quantity,
        //     weight: variant.weight,
        //     price: variant.price,
        //     productId: payload.id,
        //   },
        //   update: {
        //     inventoryQuantity: variant.inventory_quantity,
        //     price: variant.price,
        //     syncedAt: new Date(),
        //   },
        // });
      }

      await this.simulateAsyncOperation(50);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to update variant inventory: ${error instanceof Error ? error.message : String(error)}`,
        { productId: payload.id, variantCount: payload.variants.length },
      );
    }
  }

  /**
   * Refresh product collection assignments.
   *
   * @param shopId Shop identifier
   * @param payload Product payload
   */
  private async refreshProductCollections(
    shopId: string,
    payload: NonNullable<ProductWebhookJob["payload"]>,
  ): Promise<void> {
    try {
      console.log(
        `[ProductWebhookConsumer] Refreshing collections for product ${payload.id}`,
      );

      if (payload.collections && payload.collections.length > 0) {
        // TODO: Update product collection assignments
        // await prisma.productCollection.deleteMany({
        //   where: { productId: payload.id },
        // });
        //
        // for (const collectionId of payload.collections) {
        //   await prisma.productCollection.create({
        //     data: {
        //       productId: payload.id,
        //       collectionId,
        //     },
        //   });
        // }
      }

      await this.simulateAsyncOperation(30);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to refresh collections: ${error instanceof Error ? error.message : String(error)}`,
        { productId: payload.id },
      );
    }
  }

  /**
   * Delete product and related data.
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
        `[ProductWebhookConsumer] Deleting product ${productId}`,
      );

      // TODO: Soft delete product when available
      // await prisma.product.update({
      //   where: { shopifyProductId: productId },
      //   data: { deletedAt: new Date() },
      // });

      await this.simulateAsyncOperation(35);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to delete product: ${error instanceof Error ? error.message : String(error)}`,
        { productId },
      );
    }
  }

  /**
   * Emit product change event for downstream subscribers.
   *
   * @param shopId Shop identifier
   * @param productId Product identifier
   * @param action Change action (create, update, delete)
   */
  private async emitProductChangeEvent(
    shopId: string,
    productId: string,
    action: string,
  ): Promise<void> {
    try {
      console.log(
        `[ProductWebhookConsumer] Emitting product change event: ${action}`,
      );

      // TODO: Emit to event system or pub/sub
      // await eventBus.publish("product:changed", {
      //   shopId,
      //   productId,
      //   action,
      //   timestamp: new Date(),
      // });

      await this.simulateAsyncOperation(20);
    } catch (error) {
      console.error(
        `[ProductWebhookConsumer] Error emitting change event:`,
        error,
      );
      // Don't fail the job for event emission errors
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
