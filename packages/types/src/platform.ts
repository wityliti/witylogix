/**
 * @witylogix/types/platform
 * Platform abstraction types for multi-platform e-commerce support
 *
 * This module defines the PlatformSource enum and related types to enable
 * Witylogix to support multiple e-commerce platforms (Shopify, WooCommerce,
 * Magento, custom storefronts) without schema duplication.
 *
 * See ADR-014: Platform Source Abstraction
 */

/**
 * PlatformSource enum defines all supported e-commerce platforms
 *
 * Used as a discriminator in data models and event payloads to identify
 * which platform an external ID or reference came from.
 *
 * @example
 * const order = await db.order.findUnique({
 *   where: {
 *     shopId_externalOrderId_source: {
 *       shopId: "shop-123",
 *       externalOrderId: "12345",
 *       source: PlatformSource.SHOPIFY,
 *     },
 *   },
 * });
 */
export enum PlatformSource {
  SHOPIFY = "SHOPIFY",
  WOOCOMMERCE = "WOOCOMMERCE",
  MAGENTO = "MAGENTO",
  CUSTOM = "CUSTOM",  // Custom/self-hosted storefronts
}

/**
 * Type guard for PlatformSource
 *
 * Safely validate whether a string is a valid PlatformSource value.
 * Useful for runtime validation of external input.
 *
 * @param value - The value to check
 * @returns true if value is a valid PlatformSource
 *
 * @example
 * if (isPlatformSource(request.body.source)) {
 *   // value is now typed as PlatformSource
 *   const source: PlatformSource = request.body.source;
 * }
 */
export function isPlatformSource(value: string | unknown): value is PlatformSource {
  if (typeof value !== "string") {
    return false;
  }
  return Object.values(PlatformSource).includes(value as PlatformSource);
}

/**
 * ExternalReference interface for platform-agnostic external IDs
 *
 * Represents a reference to an external entity (order, product, customer) from
 * a specific e-commerce platform. Used in event payloads, queue messages, and
 * database queries.
 *
 * @example
 * const ref: ExternalReference = {
 *   externalId: "gid://shopify/Order/1234567890",
 *   source: PlatformSource.SHOPIFY,
 *   externalNumber: "#1001",  // Optional order/customer number
 * };
 */
export interface ExternalReference {
  /** Platform-specific external ID (e.g., Shopify GraphQL ID, WooCommerce order ID) */
  externalId: string;

  /** Which platform this ID came from */
  source: PlatformSource;

  /** Optional external number/reference (e.g., order #1001, customer #ABC) */
  externalNumber?: string;
}

/**
 * Platform-specific metadata container
 *
 * Used to store platform-specific data that doesn't fit in the generic model.
 * Each platform can store its own metadata without requiring schema changes.
 *
 * @example
 * interface Order {
 *   id: string;
 *   source: PlatformSource;
 *   externalOrderId: string;
 *   platformMetadata: PlatformMetadata;
 * }
 *
 * // Shopify-specific fields
 * const shopifyMeta = order.platformMetadata as ShopifyOrderMetadata;
 * console.log(shopifyMeta.fulfillmentStatus);
 */
export type PlatformMetadata = Record<string, unknown>;

/**
 * Discriminated union type for platform-specific logic
 *
 * Use this when you need to handle different platforms differently.
 * TypeScript will narrow the type based on the source discriminator.
 *
 * @example
 * function processPlatformSpecificLogic(ref: PlatformDiscriminatedReference) {
 *   if (ref.source === PlatformSource.SHOPIFY) {
 *     // ref.shopifyMetadata is available here
 *     const shopifyId = ref.shopifyMetadata.graphqlId;
 *   } else if (ref.source === PlatformSource.WOOCOMMERCE) {
 *     // ref.wooMetadata is available here
 *     const wooId = ref.wooMetadata.restId;
 *   }
 * }
 */
export type PlatformDiscriminatedReference =
  | {
      source: PlatformSource.SHOPIFY;
      externalId: string;
      externalNumber?: string;
      shopifyMetadata?: {
        graphqlId?: string;
        legacyId?: string;
        shop?: string;
      };
    }
  | {
      source: PlatformSource.WOOCOMMERCE;
      externalId: string;
      externalNumber?: string;
      wooMetadata?: {
        restId?: string;
        siteUrl?: string;
      };
    }
  | {
      source: PlatformSource.MAGENTO;
      externalId: string;
      externalNumber?: string;
      magentoMetadata?: {
        storeId?: string;
        baseUrl?: string;
      };
    }
  | {
      source: PlatformSource.CUSTOM;
      externalId: string;
      externalNumber?: string;
      customMetadata?: Record<string, unknown>;
    };

/**
 * Helper function to safely extract platform metadata
 *
 * @param ref - The external reference
 * @param platform - The platform to extract metadata for
 * @returns Platform-specific metadata or undefined
 *
 * @example
 * const shopifyMeta = getPlatformMetadata(ref, PlatformSource.SHOPIFY);
 * if (shopifyMeta) {
 *   console.log(shopifyMeta.graphqlId);
 * }
 */
export function getPlatformMetadata<T extends PlatformSource>(
  ref: PlatformDiscriminatedReference,
  platform: T
): Extract<PlatformDiscriminatedReference, { source: T }> | undefined {
  if (ref.source === platform) {
    return ref as Extract<PlatformDiscriminatedReference, { source: T }>;
  }
  return undefined;
}

/**
 * Assertion helper to narrow type by platform
 *
 * @example
 * if (assertPlatform(ref, PlatformSource.SHOPIFY)) {
 *   // ref is now narrowed to Shopify type
 *   console.log(ref.shopifyMetadata?.graphqlId);
 * }
 */
export function assertPlatform<T extends PlatformSource>(
  ref: PlatformDiscriminatedReference,
  platform: T
): ref is Extract<PlatformDiscriminatedReference, { source: T }> {
  return ref.source === platform;
}

/**
 * Get all supported platforms
 *
 * @returns Array of all PlatformSource values
 */
export function getAllPlatforms(): PlatformSource[] {
  return Object.values(PlatformSource);
}

/**
 * Get human-readable platform name
 *
 * @param platform - The platform to get name for
 * @returns Human-readable name (e.g., "Shopify", "WooCommerce")
 *
 * @example
 * console.log(getPlatformName(PlatformSource.SHOPIFY));  // "Shopify"
 */
export function getPlatformName(platform: PlatformSource): string {
  const names: Record<PlatformSource, string> = {
    [PlatformSource.SHOPIFY]: "Shopify",
    [PlatformSource.WOOCOMMERCE]: "WooCommerce",
    [PlatformSource.MAGENTO]: "Magento",
    [PlatformSource.CUSTOM]: "Custom",
  };
  return names[platform];
}

/**
 * Platform configuration for webhook handling
 *
 * Used to configure how webhooks from each platform are normalized and processed.
 *
 * @example
 * const shopifyConfig: PlatformWebhookConfig = {
 *   source: PlatformSource.SHOPIFY,
 *   normalizeOrderId: (id) => id.toString(),
 *   normalizeOrderNumber: (num) => num.toString(),
 * };
 */
export interface PlatformWebhookConfig {
  source: PlatformSource;
  /** Function to normalize external order ID */
  normalizeOrderId?: (id: unknown) => string;
  /** Function to normalize external order number */
  normalizeOrderNumber?: (num: unknown) => string | undefined;
  /** Function to normalize external product ID */
  normalizeProductId?: (id: unknown) => string;
  /** Function to normalize external customer ID */
  normalizeCustomerId?: (id: unknown) => string;
  /** Function to normalize external collection ID */
  normalizeCollectionId?: (id: unknown) => string;
}

export default PlatformSource;
