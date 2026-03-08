/**
 * Platform adapters barrel export
 *
 * Provides unified access to all platform-specific adapters (Shopify, WooCommerce, etc.)
 * Each adapter implements PlatformAdapter interface for consistent order/product/customer mapping.
 */

export {
  WooCommerceAdapter,
  type WooCommerceOrder,
  type WooCommerceAddress,
  type WooCommerceLineItem,
  type WooCommerceProduct,
  type WooCommerceImage,
  type WooCommerceCustomer,
  type CreateOrderInput,
  type CreateProductInput,
  type CreateCustomerInput,
  type WooCommerceCredentials,
} from './woocommerce.js';

export {
  ShopifyAdapter,
  type ShopifyOrder,
  type ShopifyAddress,
  type ShopifyCustomer,
  type ShopifyLineItem,
  type ShopifyProduct,
  type ShopifyVariant,
  type ShopifyImage,
  type ShopifyCredentials,
} from './shopify.js';

/**
 * Union type of all platform adapters
 */
export type PlatformAdapter = typeof WooCommerceAdapter | typeof ShopifyAdapter;

/**
 * Platform source enum for normalizing across adapters
 */
export enum PlatformSource {
  SHOPIFY = 'SHOPIFY',
  WOOCOMMERCE = 'WOOCOMMERCE',
}

/**
 * Get adapter instance by platform source
 *
 * @param source Platform source (SHOPIFY, WOOCOMMERCE)
 * @param apiVersion Optional API version for Shopify
 * @returns Adapter instance
 * @throws Error if source is not supported
 */
export function getAdapter(
  source: PlatformSource | string,
  apiVersion?: string
): WooCommerceAdapter | ShopifyAdapter {
  switch (source.toUpperCase()) {
    case PlatformSource.SHOPIFY:
      return new ShopifyAdapter(apiVersion);
    case PlatformSource.WOOCOMMERCE:
      return new WooCommerceAdapter();
    default:
      throw new Error(`Unsupported platform source: ${source}`);
  }
}
