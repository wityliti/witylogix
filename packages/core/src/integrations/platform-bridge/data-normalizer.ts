/**
 * Platform Data Normalizer
 * Converts platform-specific data formats to unified Witylogix schema
 */

import { PlatformSource } from "./types.js";
import type {
  UnifiedOrder,
  UnifiedProduct,
  UnifiedCustomer,
  UnifiedLineItem,
  UnifiedAddress,
  NormalizationResult,
  NormalizationError,
} from "./types.js";
import type {
  WCOrder,
  WCProduct,
  WCCustomer,
  WCAddress,
  WCLineItem,
} from "../woocommerce/types.js";

/**
 * Data Normalizer Class
 */
export class DataNormalizer {
  /**
   * Normalize an order from platform-specific format to unified format
   */
  static normalizeOrder(
    source: PlatformSource,
    rawOrder: unknown,
  ): NormalizationResult<UnifiedOrder> {
    try {
      switch (source) {
        case PlatformSource.WOOCOMMERCE:
          return this.normalizeWooCommerceOrder(rawOrder as WCOrder);
        case PlatformSource.SHOPIFY:
          return this.normalizeShopifyOrder(rawOrder as any);
        case PlatformSource.MAGENTO:
          return this.normalizeMagentoOrder(rawOrder as any);
        default:
          return {
            success: false,
            errors: [
              {
                field: "source",
                value: source,
                reason: `Unknown platform: ${source}`,
              },
            ],
          };
      }
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            field: "order",
            value: rawOrder,
            reason: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      };
    }
  }

  /**
   * Normalize a product from platform-specific format to unified format
   */
  static normalizeProduct(
    source: PlatformSource,
    rawProduct: unknown,
  ): NormalizationResult<UnifiedProduct> {
    try {
      switch (source) {
        case PlatformSource.WOOCOMMERCE:
          return this.normalizeWooCommerceProduct(rawProduct as WCProduct);
        case PlatformSource.SHOPIFY:
          return this.normalizeShopifyProduct(rawProduct as any);
        case PlatformSource.MAGENTO:
          return this.normalizeMagentoProduct(rawProduct as any);
        default:
          return {
            success: false,
            errors: [
              {
                field: "source",
                value: source,
                reason: `Unknown platform: ${source}`,
              },
            ],
          };
      }
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            field: "product",
            value: rawProduct,
            reason: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      };
    }
  }

  /**
   * Normalize a customer from platform-specific format to unified format
   */
  static normalizeCustomer(
    source: PlatformSource,
    rawCustomer: unknown,
  ): NormalizationResult<UnifiedCustomer> {
    try {
      switch (source) {
        case PlatformSource.WOOCOMMERCE:
          return this.normalizeWooCommerceCustomer(rawCustomer as WCCustomer);
        case PlatformSource.SHOPIFY:
          return this.normalizeShopifyCustomer(rawCustomer as any);
        case PlatformSource.MAGENTO:
          return this.normalizeMagentoCustomer(rawCustomer as any);
        default:
          return {
            success: false,
            errors: [
              {
                field: "source",
                value: source,
                reason: `Unknown platform: ${source}`,
              },
            ],
          };
      }
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            field: "customer",
            value: rawCustomer,
            reason: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      };
    }
  }

  /**
   * WooCommerce Order Normalization
   */
  private static normalizeWooCommerceOrder(
    order: WCOrder,
  ): NormalizationResult<UnifiedOrder> {
    const errors: NormalizationError[] = [];

    try {
      const normalizedOrder: UnifiedOrder = {
        id: `wc-order-${order.id}`,
        externalId: order.id.toString(),
        platform: PlatformSource.WOOCOMMERCE,
        number: order.number || order.id.toString(),
        status: this.mapWooCommerceOrderStatus(order.status),
        currency: order.currency,
        createdAt: new Date(order.date_created),
        modifiedAt: new Date(order.date_modified),
        customer: {
          id: `wc-customer-${order.customer_id}`,
          externalId: order.customer_id.toString(),
          platform: PlatformSource.WOOCOMMERCE,
          email: order.billing.email || "",
          firstName: order.billing.first_name,
          lastName: order.billing.last_name,
          phone: order.billing.phone,
          isVerified: order.customer_id > 0,
          totalOrders: 0,
          totalSpent: 0,
          shippingAddresses: [],
          createdAt: new Date(order.date_created),
          modifiedAt: new Date(order.date_modified),
          metadata: {},
        },
        lineItems: order.line_items.map((item: WCLineItem) =>
          this.normalizeWooCommerceLineItem(item),
        ),
        shippingAddress: this.normalizeWooCommerceAddress(order.shipping),
        billingAddress: this.normalizeWooCommerceAddress(order.billing),
        paymentMethod: order.payment_method_title,
        subtotal:
          Math.round(parseFloat(order.total) * 100) -
          Math.round(parseFloat(order.total_tax) * 100),
        taxTotal: Math.round(parseFloat(order.total_tax) * 100),
        shippingTotal: Math.round(parseFloat(order.shipping_total) * 100),
        discountTotal: Math.round(parseFloat(order.discount_total) * 100),
        total: Math.round(parseFloat(order.total) * 100),
        notes: order.customer_note,
        metadata: this.extractMetadata(order.meta_data),
      };

      return {
        success: errors.length === 0,
        data: normalizedOrder,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push({
        field: "order",
        value: order,
        reason: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        errors,
      };
    }
  }

  /**
   * WooCommerce Product Normalization
   */
  private static normalizeWooCommerceProduct(
    product: WCProduct,
  ): NormalizationResult<UnifiedProduct> {
    const errors: NormalizationError[] = [];

    try {
      const normalizedProduct: UnifiedProduct = {
        id: `wc-product-${product.id}`,
        externalId: product.id.toString(),
        platform: PlatformSource.WOOCOMMERCE,
        name: product.name,
        description: product.description,
        sku: product.sku,
        price: Math.round(parseFloat(product.price) * 100),
        compareAtPrice: product.regular_price
          ? Math.round(parseFloat(product.regular_price) * 100)
          : undefined,
        cost: undefined,
        weight: product.weight ? parseFloat(product.weight) : undefined,
        status: product.status as "draft" | "active" | "archived",
        createdAt: new Date(product.date_created),
        modifiedAt: new Date(product.date_modified),
        images: product.images.map((img, index) => ({
          id: `wc-image-${product.id}-${img.id}`,
          externalId: img.id.toString(),
          url: img.src,
          alt: img.alt || "",
          position: index,
        })),
        variants: product.variations
          ? product.variations.map((varId) => ({
              id: `wc-variant-${product.id}-${varId}`,
              externalId: varId.toString(),
              title: `Variant ${varId}`,
              sku: "",
              price: Math.round(parseFloat(product.price) * 100),
              inventory: product.stock_quantity || 0,
              metadata: {},
            }))
          : [],
        categories: product.categories.map((cat) => cat.name),
        tags: product.tags.map((tag) => tag.name),
        metadata: this.extractMetadata(product.meta_data),
      };

      return {
        success: errors.length === 0,
        data: normalizedProduct,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push({
        field: "product",
        value: product,
        reason: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        errors,
      };
    }
  }

  /**
   * WooCommerce Customer Normalization
   */
  private static normalizeWooCommerceCustomer(
    customer: WCCustomer,
  ): NormalizationResult<UnifiedCustomer> {
    const errors: NormalizationError[] = [];

    try {
      const normalizedCustomer: UnifiedCustomer = {
        id: `wc-customer-${customer.id}`,
        externalId: customer.id.toString(),
        platform: PlatformSource.WOOCOMMERCE,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        defaultAddress: customer.billing
          ? this.normalizeWooCommerceAddress(customer.billing)
          : undefined,
        shippingAddresses: customer.shipping
          ? [this.normalizeWooCommerceAddress(customer.shipping)]
          : [],
        billingAddress: customer.billing
          ? this.normalizeWooCommerceAddress(customer.billing)
          : undefined,
        totalOrders: 0,
        totalSpent: 0,
        isVerified: true,
        createdAt: new Date(customer.date_created),
        modifiedAt: new Date(customer.date_modified),
        metadata: this.extractMetadata(customer.meta_data),
      };

      return {
        success: errors.length === 0,
        data: normalizedCustomer,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push({
        field: "customer",
        value: customer,
        reason: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        errors,
      };
    }
  }

  /**
   * Helper: Normalize WooCommerce Line Item
   */
  private static normalizeWooCommerceLineItem(
    item: WCLineItem,
  ): UnifiedLineItem {
    return {
      id: `wc-line-item-${item.id}`,
      externalId: item.id.toString(),
      productId: `wc-product-${item.product_id}`,
      productName: item.name,
      variantId:
        item.variation_id > 0
          ? `wc-variant-${item.product_id}-${item.variation_id}`
          : undefined,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Math.round(
        (parseFloat(item.total.toString()) / item.quantity) * 100,
      ),
      totalPrice: Math.round(parseFloat(item.total) * 100),
      taxTotal: Math.round(parseFloat(item.total_tax) * 100),
      metadata: this.extractMetadata(item.meta_data),
    };
  }

  /**
   * Helper: Normalize WooCommerce Address
   */
  private static normalizeWooCommerceAddress(
    address: WCAddress,
  ): UnifiedAddress {
    return {
      firstName: address.first_name,
      lastName: address.last_name,
      company: address.company || undefined,
      street1: address.address_1,
      street2: address.address_2 || undefined,
      city: address.city,
      state: address.state,
      postalCode: address.postcode,
      country: address.country,
      email: address.email,
      phone: address.phone,
    };
  }

  /**
   * Helper: Map WooCommerce status to unified status
   */
  private static mapWooCommerceOrderStatus(
    wcStatus: string,
  ): UnifiedOrder["status"] {
    const statusMap: Record<string, UnifiedOrder["status"]> = {
      pending: "pending",
      processing: "confirmed",
      "on-hold": "pending",
      completed: "delivered",
      cancelled: "cancelled",
      refunded: "returned",
      failed: "cancelled",
    };

    return statusMap[wcStatus] || "pending";
  }

  /**
   * Helper: Extract metadata from platform meta_data format
   */
  private static extractMetadata(
    metaData: Array<{ key: string; value: unknown }> | undefined,
  ): Record<string, unknown> {
    if (!metaData) return {};

    return metaData.reduce(
      (acc, item) => {
        acc[item.key] = item.value;
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  /**
   * Placeholder methods for other platforms
   */
  private static normalizeShopifyOrder(
    order: any,
  ): NormalizationResult<UnifiedOrder> {
    // TODO: Implement Shopify order normalization
    return {
      success: false,
      errors: [
        {
          field: "platform",
          value: "shopify",
          reason: "Shopify normalization not yet implemented",
        },
      ],
    };
  }

  private static normalizeShopifyProduct(
    product: any,
  ): NormalizationResult<UnifiedProduct> {
    return {
      success: false,
      errors: [
        {
          field: "platform",
          value: "shopify",
          reason: "Shopify product normalization not yet implemented",
        },
      ],
    };
  }

  private static normalizeShopifyCustomer(
    customer: any,
  ): NormalizationResult<UnifiedCustomer> {
    return {
      success: false,
      errors: [
        {
          field: "platform",
          value: "shopify",
          reason: "Shopify customer normalization not yet implemented",
        },
      ],
    };
  }

  private static normalizeMagentoOrder(
    order: any,
  ): NormalizationResult<UnifiedOrder> {
    return {
      success: false,
      errors: [
        {
          field: "platform",
          value: "magento",
          reason: "Magento normalization not yet implemented",
        },
      ],
    };
  }

  private static normalizeMagentoProduct(
    product: any,
  ): NormalizationResult<UnifiedProduct> {
    return {
      success: false,
      errors: [
        {
          field: "platform",
          value: "magento",
          reason: "Magento product normalization not yet implemented",
        },
      ],
    };
  }

  private static normalizeMagentoCustomer(
    customer: any,
  ): NormalizationResult<UnifiedCustomer> {
    return {
      success: false,
      errors: [
        {
          field: "platform",
          value: "magento",
          reason: "Magento customer normalization not yet implemented",
        },
      ],
    };
  }
}

/**
 * Factory function
 */
export function createDataNormalizer(): typeof DataNormalizer {
  return DataNormalizer;
}
