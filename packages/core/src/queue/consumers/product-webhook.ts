// @ts-nocheck
/**
 * Product webhook consumer — processes external product sync events from any platform.
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
import { prisma as dbPrisma } from "@witylogix/db";
import type { TypedEventBus } from "../../event-bus/index.js";
import type { WitylogixEvents } from "../../event-bus/types.js";

/**
 * Product webhook consumer implementation.
 */
export class ProductWebhookConsumer extends QueueConsumer {
  private eventBus?: TypedEventBus<WitylogixEvents>;

  constructor(
    config: ConsumerConfig,
    eventBus?: TypedEventBus<WitylogixEvents>,
  ) {
    super(config);
    this.eventBus = eventBus;
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
    if (!data.shopId || !data.externalProductId) {
      throw new QueueValidationError(
        "Product webhook missing shopId or externalProductId",
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
      if (
        !variant.id ||
        !variant.sku ||
        variant.inventory_quantity === undefined
      ) {
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
        `[ProductWebhookConsumer] Processing ${action} product ${data.externalProductId} for shop ${shopId}`,
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
          await this.syncProductData(shopId, payload);
          await this.updateVariantInventory(shopId, payload);
          await this.refreshProductCollections(shopId, payload);
          break;

        case "delete":
          await this.deleteProduct(shopId, data.externalProductId);
          break;

        default:
          throw new QueueValidationError(`Unknown action: ${action}`);
      }

      // Emit change event
      await this.emitProductChangeEvent(shopId, data.externalProductId, action);

      // Calculate processing time
      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          productId: data.externalProductId,
          shopId,
          action,
          variantCount: payload?.variants.length || 0,
        },
      };
    } catch (error) {
      if (error instanceof QueueValidationError) {
        throw new QueuePermanentError(
          `Invalid product payload: ${error.message}`,
          { productId: data.externalProductId },
        );
      }

      if (error instanceof Error && error.message.includes("database")) {
        throw new QueueTransientError(
          `Database error processing product: ${error.message}`,
          { productId: data.externalProductId },
        );
      }

      throw new QueueTransientError(
        `Error processing product: ${error instanceof Error ? error.message : String(error)}`,
        { productId: data.externalProductId },
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
        externalProductId: payload.id,
        title: payload.title,
        vendor: payload.vendor,
        productType: payload.product_type,
        handle: payload.handle,
        tags: payload.tags || [],
        variantCount: payload.variants.length,
        syncedAt: new Date(),
      };

      // Upsert into database using tenant-aware Prisma
      await (dbPrisma as any).product.upsert({
        where: { externalProductId: payload.id },
        create: productData,
        update: {
          title: productData.title,
          vendor: productData.vendor,
          productType: productData.productType,
          handle: productData.handle,
          tags: productData.tags,
          variantCount: productData.variantCount,
          syncedAt: productData.syncedAt,
        },
      });

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
        // Upsert variant inventory using tenant-aware Prisma
        await (dbPrisma as any).variant.upsert({
          where: { externalVariantId: variant.id },
          create: {
            externalVariantId: variant.id,
            sku: variant.sku,
            barcode: variant.barcode,
            title: variant.title,
            inventoryQuantity: variant.inventory_quantity,
            weight: variant.weight,
            price: variant.price,
            productId: payload.id,
          },
          update: {
            inventoryQuantity: variant.inventory_quantity,
            price: variant.price,
            syncedAt: new Date(),
          },
        });
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
        // Delete existing collection assignments using tenant-aware Prisma
        await (dbPrisma as any).productCollection.deleteMany({
          where: { productId: payload.id },
        });

        // Create new collection assignments
        for (const collectionId of payload.collections) {
          await (dbPrisma as any).productCollection.create({
            data: {
              productId: payload.id,
              collectionId,
            },
          });
        }
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
      console.log(`[ProductWebhookConsumer] Deleting product ${productId}`);

      // Soft delete product using tenant-aware Prisma
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

      if (!this.eventBus) {
        console.warn(
          "[ProductWebhookConsumer] EventBus not initialized, skipping event emission",
        );
        return;
      }

      // Emit typed events based on action
      if (action === "create") {
        await this.eventBus.emit(
          "order.created",
          {
            orderId: productId,
            shopId,
            customerId: "",
            totalAmount: 0,
            currency: "USD",
            createdAt: new Date().toISOString(),
          },
          { tenantId: shopId },
        );
      } else if (action === "update") {
        await this.eventBus.emit(
          "order.confirmed",
          {
            orderId: productId,
            shopId,
            confirmedAt: new Date().toISOString(),
          },
          { tenantId: shopId },
        );
      } else if (action === "delete") {
        await this.eventBus.emit(
          "order.cancelled",
          {
            orderId: productId,
            shopId,
            reason: "Product deleted",
            cancelledAt: new Date().toISOString(),
          },
          { tenantId: shopId },
        );
      }

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
