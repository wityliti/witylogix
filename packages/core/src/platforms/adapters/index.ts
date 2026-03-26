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

export {
  MagentoAdapter,
  type MagentoOrder,
  type MagentoAddress,
  type MagentoProduct,
  type MagentoCustomer,
  type MagentoOrderItem,
  type MagentoPayment,
  type CreateOrderInput as MagentoCreateOrderInput,
  type CreateProductInput as MagentoCreateProductInput,
  type CreateCustomerInput as MagentoCreateCustomerInput,
  type MagentoCredentials,
} from './magento.js';

export {
  CustomAdapter,
  type CustomFieldMapping,
  type CustomAuthConfig,
  type CustomWebhookConfig,
  type CustomCredentials,
  DEFAULT_FIELD_MAPPING,
} from './custom.js';

/**
 * Union type of all platform adapters
 */
export type PlatformAdapter = typeof WooCommerceAdapter | typeof ShopifyAdapter | typeof MagentoAdapter | typeof CustomAdapter;

/**
 * Platform source enum for normalizing across adapters
 */
export enum PlatformSource {
  SHOPIFY = 'SHOPIFY',
  WOOCOMMERCE = 'WOOCOMMERCE',
  MAGENTO = 'MAGENTO',
  CUSTOM = 'CUSTOM',
}

/**
 * Get adapter instance by platform source
 *
 * @param source Platform source (SHOPIFY, WOOCOMMERCE, MAGENTO, CUSTOM)
 * @param apiVersion Optional API version for Shopify
 * @returns Adapter instance
 * @throws Error if source is not supported
 */
export function getAdapter(
  source: PlatformSource | string,
  apiVersion?: string
): WooCommerceAdapter | ShopifyAdapter | MagentoAdapter | CustomAdapter {
  switch (source.toUpperCase()) {
    case PlatformSource.SHOPIFY:
      return new ShopifyAdapter(apiVersion);
    case PlatformSource.WOOCOMMERCE:
      return new WooCommerceAdapter();
    case PlatformSource.MAGENTO:
      return new MagentoAdapter();
    case PlatformSource.CUSTOM:
      return new CustomAdapter();
    default:
      throw new Error(`Unsupported platform source: ${source}`);
  }
}
