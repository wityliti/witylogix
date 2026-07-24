/**
 * Collection Manager
 * Manages product collections: creation, updates, product management, and auto-collection evaluation
 */

import { PrismaClient } from "@witylogix/db";
import {
  Collection,
  CollectionProduct,
  CollectionWithProducts,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  AddProductsRequest,
  ReorderProductsRequest,
  ShopifyCollectionData,
  PlatformCollectionData,
  PaginationOptions,
  CollectionListResponse,
  CollectionRule,
} from "./types";

// ─── ERROR CLASSES ──────────────────────────────────────────────────

export class CollectionNotFoundError extends Error {
  constructor(collectionId: string) {
    super(`Collection not found: ${collectionId}`);
    this.name = "CollectionNotFoundError";
  }
}

export class CollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionError";
  }
}

// ─── COLLECTION MANAGER ─────────────────────────────────────────────

export class CollectionManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new collection
   */
  async createCollection(
    shopId: string,
    data: CreateCollectionRequest,
    externalCollectionId?: string,
    source?: string,
  ): Promise<Collection> {
    const collection = await this.prisma.collection.create({
      data: {
        shopId,
        externalId: externalCollectionId,
        source: source || "CUSTOM",
        title: data.title,
        description: data.description,
        type: data.type || "manual",
        sortOrder: data.sortOrder || "manual",
        imageUrl: data.imageUrl,
        isActive: data.isActive ?? true,
        rules: data.rules ? JSON.parse(JSON.stringify(data.rules)) : null,
        productCount: 0,
      },
    });

    return this.mapCollection(collection);
  }

  /**
   * Update a collection
   */
  async updateCollection(
    collectionId: string,
    data: UpdateCollectionRequest,
  ): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new CollectionNotFoundError(collectionId);
    }

    const updated = await this.prisma.collection.update({
      where: { id: collectionId },
      data: {
        title: data.title ?? collection.title,
        description: data.description ?? collection.description,
        type: data.type ?? collection.type,
        sortOrder: data.sortOrder ?? collection.sortOrder,
        imageUrl: data.imageUrl ?? collection.imageUrl,
        isActive: data.isActive ?? collection.isActive,
        rules: data.rules
          ? JSON.parse(JSON.stringify(data.rules))
          : collection.rules,
      },
    });

    return this.mapCollection(updated);
  }

  /**
   * Delete a collection and all its product associations
   */
  async deleteCollection(collectionId: string): Promise<void> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new CollectionNotFoundError(collectionId);
    }

    await this.prisma.collection.delete({
      where: { id: collectionId },
    });
  }

  /**
   * Add products to a collection
   */
  async addProducts(
    collectionId: string,
    request: AddProductsRequest,
  ): Promise<CollectionProduct[]> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new CollectionNotFoundError(collectionId);
    }

    // Get current max position
    const lastProduct = await this.prisma.collectionProduct.findFirst({
      where: { collectionId },
      orderBy: { position: "desc" },
    });

    let position = lastProduct ? lastProduct.position + 1 : 0;

    // Create collection products
    const items: CollectionProduct[] = [];
    for (const productId of request.productIds) {
      const item = await this.prisma.collectionProduct.upsert({
        where: {
          collectionId_productId: {
            collectionId,
            productId,
          },
        },
        update: {},
        create: {
          collectionId,
          productId,
          position: position++,
        },
      });

      items.push(this.mapCollectionProduct(item));
    }

    // Update product count
    const count = await this.prisma.collectionProduct.count({
      where: { collectionId },
    });

    await this.prisma.collection.update({
      where: { id: collectionId },
      data: { productCount: count },
    });

    return items;
  }

  /**
   * Remove products from collection
   */
  async removeProducts(
    collectionId: string,
    productIds: string[],
  ): Promise<void> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new CollectionNotFoundError(collectionId);
    }

    await this.prisma.collectionProduct.deleteMany({
      where: {
        collectionId,
        productId: { in: productIds },
      },
    });

    // Update product count
    const count = await this.prisma.collectionProduct.count({
      where: { collectionId },
    });

    await this.prisma.collection.update({
      where: { id: collectionId },
      data: { productCount: count },
    });
  }

  /**
   * Reorder products in collection
   */
  async reorderProducts(
    collectionId: string,
    request: ReorderProductsRequest,
  ): Promise<CollectionProduct[]> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new CollectionNotFoundError(collectionId);
    }

    const items: CollectionProduct[] = [];
    for (const item of request.items) {
      const updated = await this.prisma.collectionProduct.update({
        where: {
          collectionId_productId: {
            collectionId,
            productId: item.productId,
          },
        },
        data: { position: item.position },
      });

      items.push(this.mapCollectionProduct(updated));
    }

    return items;
  }

  /**
   * Sync collections from a platform
   */
  async syncFromPlatform(
    shopId: string,
    platformCollections: PlatformCollectionData[],
    source: string = "SHOPIFY",
  ): Promise<Collection[]> {
    const collections: Collection[] = [];

    for (const platformCollection of platformCollections) {
      const collection = await this.prisma.collection.upsert({
        where: {
          shopId_externalId: {
            shopId,
            externalId: platformCollection.externalId,
          },
        },
        update: {
          title: platformCollection.title,
          description: platformCollection.description,
          imageUrl: platformCollection.image?.src,
          source,
          updatedAt: new Date(),
        },
        create: {
          shopId,
          externalId: platformCollection.externalId,
          source,
          title: platformCollection.title,
          description: platformCollection.description,
          type: platformCollection.rules ? "auto" : "manual",
          imageUrl: platformCollection.image?.src,
          rules: platformCollection.rules
            ? JSON.parse(JSON.stringify(platformCollection.rules))
            : null,
          isActive: true,
          productCount: 0,
        },
      });

      collections.push(this.mapCollection(collection));
    }

    return collections;
  }

  /**
   * Sync collections from Shopify (legacy - use syncFromPlatform instead)
   */
  async syncFromShopify(
    shopId: string,
    shopifyCollections: ShopifyCollectionData[],
  ): Promise<Collection[]> {
    // Convert ShopifyCollectionData to PlatformCollectionData format
    const platformCollections: PlatformCollectionData[] =
      shopifyCollections.map((sc) => ({
        externalId: sc.id,
        title: sc.title,
        handle: sc.handle,
        description: sc.description,
        image: sc.image,
        rules: sc.rules,
      }));

    return this.syncFromPlatform(shopId, platformCollections, "SHOPIFY");
  }

  /**
   * Evaluate auto collection rules (re-evaluate all matching products)
   */
  async evaluateAutoRules(collectionId: string): Promise<number> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new CollectionNotFoundError(collectionId);
    }

    if (collection.type !== "auto" || !collection.rules) {
      throw new CollectionError(
        "Only automatic collections can have rules evaluated",
      );
    }

    // This would normally query products and apply rules
    // For now, return the current product count
    const count = await this.prisma.collectionProduct.count({
      where: { collectionId },
    });

    return count;
  }

  /**
   * Get collection with products
   */
  async getCollectionWithProducts(
    collectionId: string,
  ): Promise<CollectionWithProducts | null> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        products: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (!collection) {
      return null;
    }

    return {
      ...this.mapCollection(collection),
      products: collection.products.map((p) => this.mapCollectionProduct(p)),
    };
  }

  /**
   * List collections for a shop
   */
  async listCollections(
    shopId: string,
    pagination?: PaginationOptions,
  ): Promise<CollectionListResponse> {
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;

    const [collections, total] = await Promise.all([
      this.prisma.collection.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.collection.count({
        where: { shopId },
      }),
    ]);

    return {
      collections: collections.map((c) => this.mapCollection(c)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get collection by ID
   */
  async getCollection(collectionId: string): Promise<Collection | null> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    return collection ? this.mapCollection(collection) : null;
  }

  /**
   * Get collection by external ID (platform-specific)
   */
  async getCollectionByExternalId(
    shopId: string,
    externalCollectionId: string,
  ): Promise<Collection | null> {
    const collection = await this.prisma.collection.findUnique({
      where: {
        shopId_externalId: {
          shopId,
          externalId: externalCollectionId,
        },
      },
    });

    return collection ? this.mapCollection(collection) : null;
  }

  /**
   * Map Prisma collection to type
   */
  private mapCollection(collection: any): Collection {
    return {
      id: collection.id,
      shopId: collection.shopId,
      externalId: collection.externalId,
      source: collection.source,
      title: collection.title,
      description: collection.description,
      type: collection.type,
      sortOrder: collection.sortOrder,
      imageUrl: collection.imageUrl,
      isActive: collection.isActive,
      rules: collection.rules
        ? JSON.parse(JSON.stringify(collection.rules))
        : undefined,
      productCount: collection.productCount,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  /**
   * Map Prisma collection product to type
   */
  private mapCollectionProduct(product: any): CollectionProduct {
    return {
      id: product.id,
      collectionId: product.collectionId,
      productId: product.productId,
      position: product.position,
      createdAt: product.createdAt,
    };
  }
}

// Export singleton instance
export const collectionManager = (prisma: PrismaClient) =>
  new CollectionManager(prisma);
