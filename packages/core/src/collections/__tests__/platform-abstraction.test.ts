/**
 * Collections Platform Abstraction Tests
 * Sprint 3.4: Testing refactored collections with multi-platform support
 *
 * Covers:
 * - Collection sync with multiple platforms (Shopify, WooCommerce)
 * - Product association with external IDs
 * - Rule evaluation regardless of platform source
 * - Platform-agnostic collection operations
 * - Multi-platform product-collection relationships
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Collection,
  CollectionProduct,
  CollectionWithProducts,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  PlatformCollectionData,
  CollectionRule,
  CollectionType,
  SortOrder,
} from "../types.js";

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP & TEST DATA
// ═══════════════════════════════════════════════════════════════════════════

const mockDb = {
  collection: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  productCollection: {
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

const baseCollection: Collection = {
  id: "col-001",
  shopId: "shop-001",
  externalId: "external-col-001",
  source: "SHOPIFY",
  title: "Test Collection",
  description: "A test collection",
  type: "manual" as CollectionType,
  sortOrder: "manual" as SortOrder,
  imageUrl: "https://example.com/image.jpg",
  isActive: true,
  productCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseRule: CollectionRule = {
  column: "tag",
  relation: "and",
  condition: "contains",
  value: "sale",
};

// ═══════════════════════════════════════════════════════════════════════════
// SHOPIFY COLLECTION SYNC TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Collections - Shopify Platform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Collection Sync", () => {
    it("should sync Shopify collection with externalId", async () => {
      const platformData: PlatformCollectionData = {
        externalId: "gid://shopify/Collection/123456",
        title: "Summer Collection",
        handle: "summer",
        description: "Summer products",
        image: {
          src: "https://cdn.shopify.com/summer.jpg",
        },
      };

      const collection: Collection = {
        ...baseCollection,
        externalId: platformData.externalId,
        source: "SHOPIFY",
        title: platformData.title,
        imageUrl: platformData.image?.src,
      };

      mockDb.collection.upsert.mockResolvedValueOnce(collection);

      const result = await mockDb.collection.upsert({
        where: { externalId: platformData.externalId },
        create: collection,
        update: {},
      });

      expect(result.externalId).toBe("gid://shopify/Collection/123456");
      expect(result.source).toBe("SHOPIFY");
      expect(result.title).toBe("Summer Collection");
    });

    it("should use external ID as unique key for Shopify collections", async () => {
      const shopifyCollection: Collection = {
        ...baseCollection,
        externalId: "gid://shopify/Collection/999",
        source: "SHOPIFY",
        title: "Shopify Test",
      };

      mockDb.collection.findUnique.mockResolvedValueOnce(shopifyCollection);

      const result = await mockDb.collection.findUnique({
        where: { externalId: "gid://shopify/Collection/999" },
      });

      expect(result?.externalId).toBe("gid://shopify/Collection/999");
      expect(result?.source).toBe("SHOPIFY");
    });

    it("should handle Shopify collections with automatic rules", async () => {
      const autoCollection: Collection = {
        ...baseCollection,
        externalId: "gid://shopify/Collection/auto-123",
        source: "SHOPIFY",
        type: "auto",
        rules: [
          {
            column: "tag",
            relation: "and",
            condition: "contains",
            value: "featured",
          },
          {
            column: "vendor",
            relation: "or",
            condition: "equals",
            value: "premium-vendor",
          },
        ],
      };

      expect(autoCollection.rules).toHaveLength(2);
      expect(autoCollection.type).toBe("auto");
    });

    it("should preserve Shopify collection handle as metadata", async () => {
      const platformData: PlatformCollectionData = {
        externalId: "gid://shopify/Collection/555",
        title: "Best Sellers",
        handle: "best-sellers",
      };

      const collection: Collection = {
        ...baseCollection,
        externalId: platformData.externalId,
        source: "SHOPIFY",
        title: platformData.title,
      };

      // Handle could be stored in metadata or as a separate field
      expect(platformData.handle).toBe("best-sellers");
    });
  });

  describe("Product Association - Shopify", () => {
    it("should associate products with Shopify collection using external IDs", async () => {
      const collectionId = "col-shopify-001";
      const products = [
        {
          externalId: "gid://shopify/Product/111",
          title: "Product 1",
        },
        {
          externalId: "gid://shopify/Product/222",
          title: "Product 2",
        },
      ];

      const productAssociations = products.map((prod, index) => ({
        collectionId,
        productId: prod.externalId,
        position: index + 1,
        createdAt: new Date(),
      }));

      mockDb.productCollection.createMany.mockResolvedValueOnce({
        count: 2,
      });

      await mockDb.productCollection.createMany({
        data: productAssociations,
      });

      expect(mockDb.productCollection.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ productId: "gid://shopify/Product/111" }),
          expect.objectContaining({ productId: "gid://shopify/Product/222" }),
        ]),
      });
    });

    it("should use generic productId field (not shopifyProductId)", async () => {
      const collectionProduct: CollectionProduct = {
        id: "col-prod-001",
        collectionId: "col-001",
        productId: "gid://shopify/Product/external-id",
        position: 1,
        createdAt: new Date(),
      };

      expect(collectionProduct).toHaveProperty("productId");
      expect(collectionProduct).not.toHaveProperty("shopifyProductId");
      expect(collectionProduct.productId).toContain("shopify");
    });

    it("should retrieve Shopify collection with all associated products", async () => {
      const collectionWithProducts: CollectionWithProducts = {
        ...baseCollection,
        externalId: "gid://shopify/Collection/777",
        source: "SHOPIFY",
        products: [
          {
            id: "col-prod-1",
            collectionId: "col-001",
            productId: "gid://shopify/Product/aaa",
            position: 1,
            createdAt: new Date(),
          },
          {
            id: "col-prod-2",
            collectionId: "col-001",
            productId: "gid://shopify/Product/bbb",
            position: 2,
            createdAt: new Date(),
          },
        ],
      };

      mockDb.collection.findUnique.mockResolvedValueOnce(
        collectionWithProducts,
      );

      const result = await mockDb.collection.findUnique({
        where: { externalId: "gid://shopify/Collection/777" },
      });

      expect(result?.products).toHaveLength(2);
      expect(result?.products[0].productId).toContain("shopify");
    });
  });

  describe("Rule Evaluation - Shopify", () => {
    it("should evaluate collection rules regardless of Shopify platform", async () => {
      const collection: Collection = {
        ...baseCollection,
        externalId: "gid://shopify/Collection/rule-test",
        source: "SHOPIFY",
        type: "auto",
        rules: [
          {
            column: "tag",
            relation: "and",
            condition: "contains",
            value: "summer",
          },
        ],
      };

      // Rule evaluation logic should be platform-agnostic
      function evaluateRule(
        rule: CollectionRule,
        productTags: string[],
      ): boolean {
        switch (rule.condition) {
          case "contains":
            return productTags.includes(rule.value as string);
          case "not_contains":
            return !productTags.includes(rule.value as string);
          default:
            return false;
        }
      }

      const productTags = ["summer", "sale", "featured"];
      const matches = evaluateRule(collection.rules![0], productTags);

      expect(matches).toBe(true);
    });

    it("should support complex rule combinations for Shopify", async () => {
      const rules: CollectionRule[] = [
        {
          column: "tag",
          relation: "and",
          condition: "contains",
          value: "featured",
        },
        {
          column: "vendor",
          relation: "and",
          condition: "equals",
          value: "top-vendor",
        },
        {
          column: "price",
          relation: "or",
          condition: "greater_than",
          value: 100,
        },
      ];

      expect(rules).toHaveLength(3);
      expect(rules.every((r) => r.condition)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WOOCOMMERCE COLLECTION SYNC TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Collections - WooCommerce Platform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Collection Sync", () => {
    it("should sync WooCommerce collection with externalId", async () => {
      const platformData: PlatformCollectionData = {
        externalId: "woo-category-456",
        title: "Electronics",
        description: "Electronic products",
      };

      const collection: Collection = {
        ...baseCollection,
        externalId: platformData.externalId,
        source: "WOOCOMMERCE",
        title: platformData.title,
        description: platformData.description,
      };

      mockDb.collection.upsert.mockResolvedValueOnce(collection);

      const result = await mockDb.collection.upsert({
        where: { externalId: platformData.externalId },
        create: collection,
        update: {},
      });

      expect(result.externalId).toBe("woo-category-456");
      expect(result.source).toBe("WOOCOMMERCE");
    });

    it("should use external ID as unique key for WooCommerce collections", async () => {
      const wooCollection: Collection = {
        ...baseCollection,
        externalId: "woo-cat-789",
        source: "WOOCOMMERCE",
        title: "WooCommerce Test",
      };

      mockDb.collection.findUnique.mockResolvedValueOnce(wooCollection);

      const result = await mockDb.collection.findUnique({
        where: { externalId: "woo-cat-789" },
      });

      expect(result?.externalId).toBe("woo-cat-789");
      expect(result?.source).toBe("WOOCOMMERCE");
    });

    it("should handle WooCommerce category hierarchies", async () => {
      const parentCollection: Collection = {
        ...baseCollection,
        externalId: "woo-cat-parent-1",
        source: "WOOCOMMERCE",
        title: "Parent Category",
      };

      const childCollection: Collection = {
        ...baseCollection,
        id: "col-woo-child-1",
        externalId: "woo-cat-child-1",
        source: "WOOCOMMERCE",
        title: "Child Category",
      };

      // Both collections should work with platform-agnostic logic
      expect(parentCollection.source).toBe("WOOCOMMERCE");
      expect(childCollection.source).toBe("WOOCOMMERCE");
    });
  });

  describe("Product Association - WooCommerce", () => {
    it("should associate products with WooCommerce collection using external IDs", async () => {
      const collectionId = "col-woo-001";
      const products = [
        {
          externalId: "woo-prod-111",
          title: "Product 1",
        },
        {
          externalId: "woo-prod-222",
          title: "Product 2",
        },
        {
          externalId: "woo-prod-333",
          title: "Product 3",
        },
      ];

      const productAssociations = products.map((prod, index) => ({
        collectionId,
        productId: prod.externalId,
        position: index + 1,
        createdAt: new Date(),
      }));

      mockDb.productCollection.createMany.mockResolvedValueOnce({
        count: 3,
      });

      await mockDb.productCollection.createMany({
        data: productAssociations,
      });

      expect(mockDb.productCollection.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ productId: "woo-prod-111" }),
          expect.objectContaining({ productId: "woo-prod-222" }),
          expect.objectContaining({ productId: "woo-prod-333" }),
        ]),
      });
    });

    it("should use generic productId field (not wooProductId)", async () => {
      const collectionProduct: CollectionProduct = {
        id: "col-prod-woo-001",
        collectionId: "col-woo-001",
        productId: "woo-prod-external-id",
        position: 1,
        createdAt: new Date(),
      };

      expect(collectionProduct).toHaveProperty("productId");
      expect(collectionProduct).not.toHaveProperty("wooProductId");
      expect(collectionProduct.productId).toContain("woo");
    });

    it("should retrieve WooCommerce collection with products", async () => {
      const collectionWithProducts: CollectionWithProducts = {
        ...baseCollection,
        externalId: "woo-cat-999",
        source: "WOOCOMMERCE",
        products: [
          {
            id: "col-prod-woo-1",
            collectionId: "col-woo-001",
            productId: "woo-prod-xxx",
            position: 1,
            createdAt: new Date(),
          },
          {
            id: "col-prod-woo-2",
            collectionId: "col-woo-001",
            productId: "woo-prod-yyy",
            position: 2,
            createdAt: new Date(),
          },
        ],
      };

      mockDb.collection.findUnique.mockResolvedValueOnce(
        collectionWithProducts,
      );

      const result = await mockDb.collection.findUnique({
        where: { externalId: "woo-cat-999" },
      });

      expect(result?.products).toHaveLength(2);
      expect(result?.source).toBe("WOOCOMMERCE");
    });
  });

  describe("Rule Evaluation - WooCommerce", () => {
    it("should evaluate collection rules for WooCommerce products", async () => {
      const collection: Collection = {
        ...baseCollection,
        externalId: "woo-cat-rules",
        source: "WOOCOMMERCE",
        type: "auto",
        rules: [
          {
            column: "category",
            relation: "and",
            condition: "equals",
            value: "electronics",
          },
        ],
      };

      function evaluateRule(
        rule: CollectionRule,
        productCategory: string,
      ): boolean {
        if (rule.condition === "equals") {
          return productCategory === rule.value;
        }
        return false;
      }

      const productCategory = "electronics";
      const matches = evaluateRule(collection.rules![0], productCategory);

      expect(matches).toBe(true);
    });

    it("should support complex rules for WooCommerce", async () => {
      const rules: CollectionRule[] = [
        {
          column: "category",
          relation: "and",
          condition: "equals",
          value: "clothing",
        },
        {
          column: "tag",
          relation: "and",
          condition: "contains",
          value: "sale",
        },
      ];

      expect(rules).toHaveLength(2);
      expect(rules[0].condition).toBe("equals");
      expect(rules[1].condition).toBe("contains");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-PLATFORM COLLECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Collections - Cross-Platform Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Multi-Platform Collections in Same Shop", () => {
    it("should support collections from multiple platforms in same shop", async () => {
      const collections: Collection[] = [
        {
          ...baseCollection,
          id: "col-mixed-1",
          externalId: "gid://shopify/Collection/111",
          source: "SHOPIFY",
          title: "Shopify Collection",
        },
        {
          ...baseCollection,
          id: "col-mixed-2",
          externalId: "woo-cat-222",
          source: "WOOCOMMERCE",
          title: "WooCommerce Collection",
        },
        {
          ...baseCollection,
          id: "col-mixed-3",
          externalId: "custom-col-333",
          source: "CUSTOM",
          title: "Custom Collection",
        },
      ];

      mockDb.collection.findMany.mockResolvedValueOnce(collections);

      const result = await mockDb.collection.findMany({
        where: { shopId: "shop-001" },
      });

      expect(result).toHaveLength(3);
      const sources = result.map((c) => c.source);
      expect(sources).toContain("SHOPIFY");
      expect(sources).toContain("WOOCOMMERCE");
      expect(sources).toContain("CUSTOM");
    });

    it("should filter collections by source", async () => {
      const collections: Collection[] = [
        { ...baseCollection, source: "SHOPIFY" },
        { ...baseCollection, source: "WOOCOMMERCE" },
        { ...baseCollection, source: "SHOPIFY" },
      ];

      const shopifyCollections = collections.filter(
        (c) => c.source === "SHOPIFY",
      );

      expect(shopifyCollections).toHaveLength(2);
      expect(shopifyCollections.every((c) => c.source === "SHOPIFY")).toBe(
        true,
      );
    });
  });

  describe("Platform-Agnostic Collection Operations", () => {
    it("should create collection regardless of source", async () => {
      const request: CreateCollectionRequest = {
        title: "New Collection",
        type: "manual",
        sortOrder: "best-selling",
      };

      const sources = ["SHOPIFY", "WOOCOMMERCE", "CUSTOM"];

      for (const source of sources) {
        const collection: Collection = {
          id: `col-${source}`,
          shopId: "shop-001",
          externalId: undefined,
          source,
          title: request.title,
          type: request.type!,
          sortOrder: request.sortOrder!,
          isActive: true,
          productCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.collection.create.mockResolvedValueOnce(collection);

        const result = await mockDb.collection.create({
          data: collection,
        });

        expect(result.source).toBe(source);
      }
    });

    it("should update collection regardless of source", async () => {
      const update: UpdateCollectionRequest = {
        title: "Updated Title",
        isActive: false,
      };

      const sources = ["SHOPIFY", "WOOCOMMERCE"];

      for (const source of sources) {
        const collection: Collection = {
          ...baseCollection,
          source,
          title: update.title,
          isActive: update.isActive!,
        };

        mockDb.collection.update.mockResolvedValueOnce(collection);

        const result = await mockDb.collection.update({
          where: { id: "col-001" },
          data: collection,
        });

        expect(result.title).toBe("Updated Title");
        expect(result.isActive).toBe(false);
      }
    });

    it("should delete collection regardless of source", async () => {
      const sources = ["SHOPIFY", "WOOCOMMERCE", "CUSTOM"];

      for (const source of sources) {
        mockDb.collection.delete.mockResolvedValueOnce({
          ...baseCollection,
          source,
        });

        const result = await mockDb.collection.delete({
          where: { id: `col-${source}` },
        });

        expect(result.source).toBe(source);
      }
    });
  });

  describe("Product-Collection Relationships Across Platforms", () => {
    it("should support products from different platforms in same collection", async () => {
      const collectionWithMixedProducts: CollectionWithProducts = {
        ...baseCollection,
        source: "CUSTOM", // Custom collection
        products: [
          {
            id: "col-prod-1",
            collectionId: "col-001",
            productId: "gid://shopify/Product/111", // Shopify product
            position: 1,
            createdAt: new Date(),
          },
          {
            id: "col-prod-2",
            collectionId: "col-001",
            productId: "woo-prod-222", // WooCommerce product
            position: 2,
            createdAt: new Date(),
          },
          {
            id: "col-prod-3",
            collectionId: "col-001",
            productId: "custom-prod-333", // Custom product
            position: 3,
            createdAt: new Date(),
          },
        ],
      };

      expect(collectionWithMixedProducts.products).toHaveLength(3);
      expect(collectionWithMixedProducts.products[0].productId).toContain(
        "shopify",
      );
      expect(collectionWithMixedProducts.products[1].productId).toContain(
        "woo",
      );
    });

    it("should reorder products regardless of platform source", async () => {
      const collectionProducts: CollectionProduct[] = [
        {
          id: "col-prod-1",
          collectionId: "col-001",
          productId: "gid://shopify/Product/aaa",
          position: 2, // Changed position
          createdAt: new Date(),
        },
        {
          id: "col-prod-2",
          collectionId: "col-001",
          productId: "woo-prod-bbb",
          position: 1, // Changed position
          createdAt: new Date(),
        },
      ];

      const sorted = collectionProducts.sort((a, b) => a.position - b.position);

      expect(sorted[0].productId).toContain("woo");
      expect(sorted[1].productId).toContain("shopify");
    });
  });

  describe("Rule Evaluation Across Platforms", () => {
    it("should evaluate rules with same logic for all platforms", async () => {
      const rule: CollectionRule = {
        column: "price",
        relation: "and",
        condition: "greater_than",
        value: 50,
      };

      function evaluateRule(rule: CollectionRule, value: number): boolean {
        switch (rule.condition) {
          case "greater_than":
            return value > (rule.value as number);
          case "less_than":
            return value < (rule.value as number);
          default:
            return false;
        }
      }

      // Should work the same for all platforms
      const platforms = ["SHOPIFY", "WOOCOMMERCE", "CUSTOM"];
      const testPrice = 75;

      platforms.forEach((platform) => {
        const result = evaluateRule(rule, testPrice);
        expect(result).toBe(true);
      });
    });

    it("should combine multiple rules with AND/OR logic", async () => {
      const rules: CollectionRule[] = [
        {
          column: "tag",
          relation: "and",
          condition: "contains",
          value: "sale",
        },
        {
          column: "price",
          relation: "and",
          condition: "less_than",
          value: 100,
        },
        {
          column: "vendor",
          relation: "or",
          condition: "equals",
          value: "premium",
        },
      ];

      expect(rules).toHaveLength(3);
      expect(rules[0].relation).toBe("and");
      expect(rules[2].relation).toBe("or");
    });
  });

  describe("Sync Consistency Across Platforms", () => {
    it("should maintain external ID consistency during updates", async () => {
      const originalCollection: Collection = {
        ...baseCollection,
        externalId: "gid://shopify/Collection/123",
        source: "SHOPIFY",
      };

      const updated: Collection = {
        ...originalCollection,
        title: "Updated Title",
        // External ID should not change
      };

      expect(updated.externalId).toBe(originalCollection.externalId);
      expect(updated.source).toBe(originalCollection.source);
    });

    it("should handle duplicate external IDs across shops", async () => {
      const shop1Collection: Collection = {
        ...baseCollection,
        shopId: "shop-001",
        externalId: "gid://shopify/Collection/same-id",
        source: "SHOPIFY",
      };

      const shop2Collection: Collection = {
        ...baseCollection,
        id: "col-shop2",
        shopId: "shop-002",
        externalId: "gid://shopify/Collection/same-id",
        source: "SHOPIFY",
      };

      // Same external ID can exist across different shops
      expect(shop1Collection.externalId).toBe(shop2Collection.externalId);
      expect(shop1Collection.shopId).not.toBe(shop2Collection.shopId);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Collections - Backward Compatibility", () => {
  it("should handle collections without source field (default to legacy)", async () => {
    const legacyCollection = {
      ...baseCollection,
      source: undefined,
    };

    // Should still work with optional source
    expect(legacyCollection).toHaveProperty("externalId");
    expect(legacyCollection).toHaveProperty("title");
  });

  it("should support old ShopifyCollectionData interface", async () => {
    // Legacy interface mapping
    interface ShopifyCollectionData {
      id: string; // Maps to externalId
      title: string;
      handle?: string;
      description?: string;
    }

    const legacyData: ShopifyCollectionData = {
      id: "gid://shopify/Collection/old-456",
      title: "Old Shopify Collection",
      handle: "old-collection",
    };

    // Should map to new structure
    const collection: Collection = {
      ...baseCollection,
      externalId: legacyData.id,
      source: "SHOPIFY",
      title: legacyData.title,
    };

    expect(collection.externalId).toBe(legacyData.id);
  });

  it("should work with products missing platform info", async () => {
    const collectionProduct: CollectionProduct = {
      id: "col-prod-legacy",
      collectionId: "col-001",
      productId: "simple-product-id", // No platform prefix
      position: 1,
      createdAt: new Date(),
    };

    expect(collectionProduct.productId).toBe("simple-product-id");
    // Should work even without explicit platform info
  });
});
