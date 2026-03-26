/**
 * WooCommerce Product Sync Service
 * Synchronizes products between WooCommerce and Witylogix including
 * variations, inventory, images, and categories
 */

import type {
  WCProduct,
  WCProductVariation,
  WCProductImage,
} from "./types.js";

/**
 * WooCommerce Product Sync Service
 */
export class ProductSyncService {
  /**
   * Sync product from WooCommerce to Witylogix
   */
  static syncProductFromWC(wcProduct: WCProduct): Record<string, unknown> {
    return {
      externalId: wcProduct.id.toString(),
      sku: wcProduct.sku,
      name: wcProduct.name,
      description: wcProduct.description,
      shortDescription: wcProduct.short_description,
      type: this.mapProductType(wcProduct.type),
      status: wcProduct.status === "publish" ? "active" : "inactive",
      pricing: {
        price: parseFloat(wcProduct.price),
        regularPrice: parseFloat(wcProduct.regular_price),
        salePrice: wcProduct.sale_price ? parseFloat(wcProduct.sale_price) : null,
        onSale: wcProduct.on_sale,
        currency: "USD", // Would be configurable
      },
      inventory: {
        quantity: wcProduct.stock_quantity || 0,
        managed: wcProduct.manage_stock,
        status: wcProduct.stock_status,
        trackInventory: wcProduct.manage_stock,
      },
      dimensions: {
        weight: wcProduct.weight ? parseFloat(wcProduct.weight) : null,
        length: wcProduct.dimensions.length ? parseFloat(wcProduct.dimensions.length) : null,
        width: wcProduct.dimensions.width ? parseFloat(wcProduct.dimensions.width) : null,
        height: wcProduct.dimensions.height ? parseFloat(wcProduct.dimensions.height) : null,
      },
      categories: wcProduct.categories.map((cat) => ({
        id: cat.id.toString(),
        name: cat.name,
        slug: cat.slug,
      })),
      tags: wcProduct.tags.map((tag) => ({
        id: tag.id.toString(),
        name: tag.name,
        slug: tag.slug,
      })),
      images: this.syncImages(wcProduct.images),
      attributes: this.syncAttributes(wcProduct.attributes),
      variations: wcProduct.variations.length > 0 ? wcProduct.variations : undefined,
      metadata: {
        wcProductId: wcProduct.id,
        virtual: wcProduct.virtual,
        downloadable: wcProduct.downloadable,
        taxStatus: wcProduct.tax_status,
        taxClass: wcProduct.tax_class,
        avgRating: parseFloat(wcProduct.average_rating),
        ratingCount: wcProduct.rating_count,
      },
      createdAt: new Date(wcProduct.date_created),
      updatedAt: new Date(wcProduct.date_modified),
    };
  }

  /**
   * Sync product from Witylogix to WooCommerce
   */
  static syncProductToWC(wlProduct: Record<string, unknown>): Partial<WCProduct> {
    const pricing = wlProduct.pricing as Record<string, unknown>;
    const inventory = wlProduct.inventory as Record<string, unknown>;

    return {
      name: (wlProduct.name as string) || "",
      description: (wlProduct.description as string) || "",
      short_description: (wlProduct.shortDescription as string) || "",
      sku: (wlProduct.sku as string) || "",
      price: pricing?.price ? pricing.price.toString() : "0",
      regular_price: pricing?.regularPrice ? pricing.regularPrice.toString() : "0",
      sale_price: pricing?.salePrice ? pricing.salePrice.toString() : "",
      status: (wlProduct.status as string) === "active" ? "publish" : "draft",
      stock_quantity: inventory?.quantity ? parseInt(inventory.quantity.toString()) : 0,
      manage_stock: inventory?.managed as boolean || false,
      stock_status: (inventory?.status as string) || "instock",
    };
  }

  /**
   * Sync product variation
   */
  static syncVariationFromWC(
    variation: WCProductVariation,
    parentProductId: number,
  ): Record<string, unknown> {
    return {
      externalId: variation.id.toString(),
      parentExternalId: parentProductId.toString(),
      sku: variation.sku,
      attributes: (variation.attributes || []).map((attr) => ({
        name: attr.name,
        value: attr.option,
      })),
      pricing: {
        price: parseFloat(variation.price),
        regularPrice: parseFloat(variation.regular_price),
        salePrice: variation.sale_price ? parseFloat(variation.sale_price) : null,
        onSale: variation.on_sale,
      },
      inventory: {
        quantity: variation.stock_quantity || 0,
        managed: variation.manage_stock,
        status: variation.stock_status,
      },
      image: variation.image ? this.mapImage(variation.image) : null,
      description: variation.description,
      status: variation.status === "publish" ? "active" : "inactive",
      metadata: {
        wcVariationId: variation.id,
        weight: variation.weight ? parseFloat(variation.weight) : null,
      },
    };
  }

  /**
   * Sync product variations
   */
  static syncVariationsFromWC(
    variations: WCProductVariation[],
    parentProductId: number,
  ): Record<string, unknown>[] {
    return variations.map((v) => this.syncVariationFromWC(v, parentProductId));
  }

  /**
   * Update variation inventory
   */
  static updateVariationInventory(
    variation: Partial<WCProductVariation>,
    quantity: number,
    status: "instock" | "outofstock" | "onbackorder",
  ): Partial<WCProductVariation> {
    return {
      stock_quantity: quantity,
      stock_status: status,
      manage_stock: true,
    };
  }

  /**
   * Sync images from WC product
   */
  static syncImages(images: WCProductImage[]): Array<{
    id: string;
    url: string;
    alt: string;
    name: string;
  }> {
    return images.map((img) => this.mapImage(img));
  }

  /**
   * Map single image
   */
  static mapImage(image: WCProductImage): {
    id: string;
    url: string;
    alt: string;
    name: string;
  } {
    return {
      id: image.id.toString(),
      url: image.src,
      alt: image.alt || "",
      name: image.name || "",
    };
  }

  /**
   * Sync product attributes
   */
  static syncAttributes(
    attributes: Array<{
      id: number;
      name: string;
      position: number;
      visible: boolean;
      variation: boolean;
      options: string[];
    }>,
  ): Array<{
    id: string;
    name: string;
    isVariation: boolean;
    options: string[];
  }> {
    return attributes.map((attr) => ({
      id: attr.id.toString(),
      name: attr.name,
      isVariation: attr.variation,
      options: attr.options,
    }));
  }

  /**
   * Map product type
   */
  static mapProductType(
    wcType: string,
  ): "simple" | "variable" | "bundle" | "digital" {
    switch (wcType) {
      case "variable":
        return "variable";
      case "bundle":
        return "bundle";
      case "downloadable":
        return "digital";
      case "simple":
      default:
        return "simple";
    }
  }

  /**
   * Validate product data
   */
  static validateProduct(wcProduct: WCProduct): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!wcProduct.id) {
      errors.push("Product ID is required");
    }

    if (!wcProduct.name || wcProduct.name.trim().length === 0) {
      errors.push("Product name is required");
    }

    if (!wcProduct.sku || wcProduct.sku.trim().length === 0) {
      errors.push("Product SKU is required");
    }

    if (!wcProduct.type) {
      errors.push("Product type is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if product needs update
   */
  static needsUpdate(
    currentProduct: WCProduct,
    updatedProduct: Partial<WCProduct>,
  ): boolean {
    const fieldsToCheck: Array<keyof WCProduct> = [
      "name",
      "description",
      "price",
      "regular_price",
      "sale_price",
      "stock_quantity",
      "stock_status",
      "status",
    ];

    for (const field of fieldsToCheck) {
      if (field in updatedProduct) {
        if (currentProduct[field] !== updatedProduct[field]) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate inventory status
   */
  static calculateInventoryStatus(
    quantity: number,
    managed: boolean,
  ): "instock" | "outofstock" | "onbackorder" {
    if (!managed) {
      return "instock";
    }

    if (quantity > 0) {
      return "instock";
    }

    return "outofstock";
  }

  /**
   * Get product summary
   */
  static getProductSummary(wcProduct: WCProduct): {
    totalVariations: number;
    hasImages: boolean;
    hasTags: boolean;
    hasCategories: boolean;
    onSale: boolean;
    inStock: boolean;
  } {
    return {
      totalVariations: wcProduct.variations ? wcProduct.variations.length : 0,
      hasImages: wcProduct.images && wcProduct.images.length > 0,
      hasTags: wcProduct.tags && wcProduct.tags.length > 0,
      hasCategories: wcProduct.categories && wcProduct.categories.length > 0,
      onSale: wcProduct.on_sale,
      inStock: wcProduct.stock_status === "instock",
    };
  }
}

/**
 * Create product sync service instance
 */
export function createProductSyncService(): typeof ProductSyncService {
  return ProductSyncService;
}
