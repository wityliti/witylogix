/**
 * Collection Manager Tests
 * Comprehensive test suite for collection management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CollectionManager,
  CollectionNotFoundError,
  CollectionError,
} from "../collection-manager";

describe("CollectionManager", () => {
  let manager: CollectionManager;
  let prisma: any;

  beforeEach(() => {
    // Mock Prisma client
    prisma = {
      collection: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      },
      collectionProduct: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        upsert: vi.fn(),
      },
    };

    manager = new CollectionManager(prisma);
  });

  describe("createCollection", () => {
    it("should create manual collection", async () => {
      const mockCollection: any = {
        id: "col-1",
        shopId: "shop-1",
        title: "New Products",
        description: "Latest products",
        type: "manual",
        sortOrder: "manual",
        imageUrl: "https://example.com/image.jpg",
        isActive: true,
        rules: null,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.collection.create.mockResolvedValue(mockCollection);

      const result = await manager.createCollection("shop-1", {
        title: "New Products",
        description: "Latest products",
        type: "manual",
        imageUrl: "https://example.com/image.jpg",
      });

      expect(result.id).toBe("col-1");
      expect(result.type).toBe("manual");
      expect(result.title).toBe("New Products");
      expect(prisma.collection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shopId: "shop-1",
            title: "New Products",
            type: "manual",
          }),
        }),
      );
    });

    it("should create auto collection with rules", async () => {
      const rules = { condition: "tag", value: "summer" };
      const mockCollection: any = {
        id: "col-2",
        shopId: "shop-1",
        title: "Summer Items",
        type: "auto",
        rules,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.collection.create.mockResolvedValue(mockCollection);

      const result = await manager.createCollection("shop-1", {
        title: "Summer Items",
        type: "auto",
        rules,
      });

      expect(result.type).toBe("auto");
      expect(result.rules).toEqual(rules);
    });
  });

  describe("updateCollection", () => {
    it("should update collection", async () => {
      const originalCollection: any = {
        id: "col-1",
        shopId: "shop-1",
        title: "Old Title",
        description: "Old description",
        type: "manual",
        sortOrder: "manual",
        imageUrl: null,
        isActive: true,
        rules: null,
      };

      const updatedCollection: any = {
        ...originalCollection,
        title: "New Title",
        description: "New description",
      };

      prisma.collection.findUnique.mockResolvedValue(originalCollection);
      prisma.collection.update.mockResolvedValue(updatedCollection);

      const result = await manager.updateCollection("col-1", {
        title: "New Title",
        description: "New description",
      });

      expect(result.title).toBe("New Title");
      expect(result.description).toBe("New description");
    });

    it("should throw CollectionNotFoundError when updating non-existent collection", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(
        manager.updateCollection("invalid-col", { title: "Test" }),
      ).rejects.toThrow(CollectionNotFoundError);
    });
  });

  describe("deleteCollection", () => {
    it("should delete collection with cascade", async () => {
      const mockCollection: any = {
        id: "col-1",
        shopId: "shop-1",
        title: "Delete Me",
      };

      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collection.delete.mockResolvedValue(mockCollection);

      await manager.deleteCollection("col-1");

      expect(prisma.collection.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "col-1" },
        }),
      );
    });

    it("should throw CollectionNotFoundError when deleting non-existent collection", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(manager.deleteCollection("invalid-col")).rejects.toThrow(
        CollectionNotFoundError,
      );
    });
  });

  describe("addProducts", () => {
    it("should add products with positioning", async () => {
      const mockCollection: any = {
        id: "col-1",
        shopId: "shop-1",
      };

      const mockLastProduct: any = {
        position: 2,
      };

      const mockProducts: any = [
        {
          id: "cp-1",
          collectionId: "col-1",
          productId: "prod-1",
          position: 3,
        },
        {
          id: "cp-2",
          collectionId: "col-1",
          productId: "prod-2",
          position: 4,
        },
      ];

      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.findFirst.mockResolvedValue(mockLastProduct);
      prisma.collectionProduct.upsert
        .mockResolvedValueOnce(mockProducts[0])
        .mockResolvedValueOnce(mockProducts[1]);
      prisma.collectionProduct.count.mockResolvedValue(2);
      prisma.collection.update.mockResolvedValue(mockCollection);

      const result = await manager.addProducts("col-1", {
        productIds: ["prod-1", "prod-2"],
      });

      expect(result).toHaveLength(2);
      expect(result[0].position).toBe(3);
      expect(result[1].position).toBe(4);
      expect(prisma.collection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { productCount: 2 },
        }),
      );
    });

    it("should throw CollectionNotFoundError when adding products to non-existent collection", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(
        manager.addProducts("invalid-col", { productIds: ["prod-1"] }),
      ).rejects.toThrow(CollectionNotFoundError);
    });
  });

  describe("removeProducts", () => {
    it("should remove products and update count", async () => {
      const mockCollection: any = {
        id: "col-1",
        shopId: "shop-1",
      };

      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.deleteMany.mockResolvedValue({ count: 2 });
      prisma.collectionProduct.count.mockResolvedValue(3);
      prisma.collection.update.mockResolvedValue(mockCollection);

      await manager.removeProducts("col-1", ["prod-1", "prod-2"]);

      expect(prisma.collectionProduct.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            collectionId: "col-1",
            productId: { in: ["prod-1", "prod-2"] },
          },
        }),
      );
      expect(prisma.collection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { productCount: 3 },
        }),
      );
    });

    it("should throw CollectionNotFoundError when removing products from non-existent collection", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(
        manager.removeProducts("invalid-col", ["prod-1"]),
      ).rejects.toThrow(CollectionNotFoundError);
    });
  });

  describe("reorderProducts", () => {
    it("should reorder products", async () => {
      const mockCollection: any = {
        id: "col-1",
      };

      const reorderedProducts: any = [
        { id: "cp-1", collectionId: "col-1", productId: "prod-1", position: 5 },
        { id: "cp-2", collectionId: "col-1", productId: "prod-2", position: 3 },
      ];

      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.update
        .mockResolvedValueOnce(reorderedProducts[0])
        .mockResolvedValueOnce(reorderedProducts[1]);

      const result = await manager.reorderProducts("col-1", {
        items: [
          { productId: "prod-1", position: 5 },
          { productId: "prod-2", position: 3 },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0].position).toBe(5);
      expect(result[1].position).toBe(3);
    });

    it("should throw CollectionNotFoundError for non-existent collection", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(
        manager.reorderProducts("invalid-col", {
          items: [{ productId: "prod-1", position: 1 }],
        }),
      ).rejects.toThrow(CollectionNotFoundError);
    });
  });

  describe("syncFromShopify", () => {
    it("should create new collection from Shopify", async () => {
      const shopifyCollection = {
        id: "shopify-col-1",
        title: "Featured Products",
        description: "Our featured products",
        image: { src: "https://shopify.com/image.jpg" },
        rules: null,
      };

      const mockCollection: any = {
        id: "col-1",
        shopId: "shop-1",
        externalId: "shopify-col-1",
        title: "Featured Products",
        description: "Our featured products",
        type: "manual",
        imageUrl: "https://shopify.com/image.jpg",
        isActive: true,
        productCount: 0,
      };

      prisma.collection.upsert.mockResolvedValue(mockCollection);

      const result = await manager.syncFromShopify("shop-1", [
        shopifyCollection as any,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe("shopify-col-1");
      expect(result[0].type).toBe("manual");
    });

    it("should update existing collection from Shopify", async () => {
      const shopifyCollection = {
        id: "shopify-col-1",
        title: "Updated Title",
        description: "Updated description",
        image: null,
        rules: null,
      };

      const mockCollection: any = {
        id: "col-1",
        externalId: "shopify-col-1",
        title: "Updated Title",
      };

      prisma.collection.upsert.mockResolvedValue(mockCollection);

      const result = await manager.syncFromShopify("shop-1", [
        shopifyCollection as any,
      ]);

      expect(result[0].title).toBe("Updated Title");
    });
  });

  describe("evaluateAutoRules", () => {
    it("should evaluate auto collection rules", async () => {
      const mockCollection: any = {
        id: "col-1",
        type: "auto",
        rules: { condition: "tag", value: "featured" },
      };

      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.count.mockResolvedValue(15);

      const result = await manager.evaluateAutoRules("col-1");

      expect(result).toBe(15);
    });

    it("should throw error when evaluating manual collection rules", async () => {
      const mockCollection: any = {
        id: "col-1",
        type: "manual",
        rules: null,
      };

      prisma.collection.findUnique.mockResolvedValue(mockCollection);

      await expect(manager.evaluateAutoRules("col-1")).rejects.toThrow(
        CollectionError,
      );
    });

    it("should throw CollectionNotFoundError for non-existent collection", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      await expect(manager.evaluateAutoRules("invalid-col")).rejects.toThrow(
        CollectionNotFoundError,
      );
    });
  });

  describe("listCollections", () => {
    it("should list collections with pagination", async () => {
      const mockCollections: any = [
        { id: "col-1", title: "Collection 1" },
        { id: "col-2", title: "Collection 2" },
      ];

      prisma.collection.findMany.mockResolvedValue(mockCollections);
      prisma.collection.count.mockResolvedValue(10);

      const result = await manager.listCollections("shop-1", {
        limit: 20,
        offset: 0,
      });

      expect(result.collections).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it("should use default pagination if not provided", async () => {
      const mockCollections: any = [{ id: "col-1" }];

      prisma.collection.findMany.mockResolvedValue(mockCollections);
      prisma.collection.count.mockResolvedValue(1);

      const result = await manager.listCollections("shop-1");

      expect(prisma.collection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        }),
      );
    });
  });

  describe("getCollection", () => {
    it("should get collection by ID", async () => {
      const mockCollection: any = {
        id: "col-1",
        shopId: "shop-1",
        title: "Test Collection",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.collection.findUnique.mockResolvedValue(mockCollection);

      const result = await manager.getCollection("col-1");

      expect(result).toEqual(mockCollection);
    });

    it("should return null when collection not found", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      const result = await manager.getCollection("invalid-col");

      expect(result).toBeNull();
    });
  });

  describe("getCollectionWithProducts", () => {
    it("should get collection with products", async () => {
      const mockCollection: any = {
        id: "col-1",
        title: "Test Collection",
        products: [
          { id: "cp-1", productId: "prod-1", position: 0 },
          { id: "cp-2", productId: "prod-2", position: 1 },
        ],
      };

      prisma.collection.findUnique.mockResolvedValue(mockCollection);

      const result = await manager.getCollectionWithProducts("col-1");

      expect(result).not.toBeNull();
      expect(result?.products).toHaveLength(2);
    });

    it("should return null when collection not found", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      const result = await manager.getCollectionWithProducts("invalid-col");

      expect(result).toBeNull();
    });
  });

  describe("getCollectionByExternalId", () => {
    it("should get collection by external ID", async () => {
      const mockCollection: any = {
        id: "col-1",
        externalId: "shopify-col-1",
        title: "Shopify Collection",
      };

      prisma.collection.findUnique.mockResolvedValue(mockCollection);

      const result = await manager.getCollectionByExternalId(
        "shop-1",
        "shopify-col-1",
      );

      expect(result).toEqual(mockCollection);
      expect(prisma.collection.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId_externalId: {
              shopId: "shop-1",
              externalId: "shopify-col-1",
            },
          },
        }),
      );
    });

    it("should return null when not found", async () => {
      prisma.collection.findUnique.mockResolvedValue(null);

      const result = await manager.getCollectionByExternalId(
        "shop-1",
        "invalid-id",
      );

      expect(result).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty product list", async () => {
      const mockCollection: any = { id: "col-1" };

      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.findFirst.mockResolvedValue(null);
      prisma.collectionProduct.upsert.mockResolvedValue({});
      prisma.collectionProduct.count.mockResolvedValue(0);
      prisma.collection.update.mockResolvedValue(mockCollection);

      const result = await manager.addProducts("col-1", { productIds: [] });

      expect(result).toHaveLength(0);
    });

    it("should handle large product lists", async () => {
      const mockCollection: any = { id: "col-1" };
      const productIds = Array.from({ length: 100 }, (_, i) => `prod-${i}`);

      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.findFirst.mockResolvedValue(null);
      prisma.collectionProduct.upsert.mockResolvedValue({});
      prisma.collectionProduct.count.mockResolvedValue(100);
      prisma.collection.update.mockResolvedValue(mockCollection);

      const result = await manager.addProducts("col-1", { productIds });

      expect(result).toHaveLength(100);
    });
  });
});
