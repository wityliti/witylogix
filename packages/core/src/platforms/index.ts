/**
 * @witylogix/core/platforms
 * Platform adapter registry and factory
 *
 * Central entry point for platform integrations. Provides:
 * - Single source of truth for all platform adapters
 * - Factory function to get adapter for any platform
 * - Validation and registry utilities
 *
 * This module enables platform-agnostic code throughout Witylogix.
 * Consumer code doesn't need to know about specific platforms — it just
 * calls getPlatformAdapter() and uses the interface.
 *
 * See ADR-015: WooCommerce Integration
 */

import { PlatformSource, isPlatformSource } from "@witylogix/types";
import { PlatformAdapter } from "./types.js";

/**
 * Platform adapter implementations
 *
 * These will be lazy-loaded to avoid circular dependencies
 */
type AdapterConstructor = () => Promise<PlatformAdapter>;

/**
 * Platform Adapter Registry
 *
 * Maps each platform to its adapter implementation.
 * Add new platforms here when implementing integrations.
 *
 * This is the single source of truth for:
 * - Which platforms are supported
 * - How to get an adapter for a platform
 * - Version information for adapters
 */
const ADAPTER_REGISTRY: Map<PlatformSource, AdapterConstructor> = new Map();

/**
 * Register a platform adapter
 *
 * Called during module initialization to register all available adapters.
 * Adapters are lazy-loaded to avoid circular dependencies.
 *
 * @param source - Platform identifier
 * @param constructor - Function that creates adapter instance
 *
 * @example
 * ```typescript
 * registerAdapter(
 *   PlatformSource.WOOCOMMERCE,
 *   () => import('./adapters/woocommerce').then(m => new m.WooCommerceAdapter())
 * );
 * ```
 */
export function registerAdapter(
  source: PlatformSource,
  constructor: AdapterConstructor
): void {
  if (ADAPTER_REGISTRY.has(source)) {
    console.warn(`[Platforms] Adapter for ${source} already registered, overwriting`);
  }

  ADAPTER_REGISTRY.set(source, constructor);
}

/**
 * Cache for instantiated adapters
 *
 * Adapters are singletons (one instance per platform).
 * This avoids re-instantiating on every call.
 */
const ADAPTER_CACHE: Map<PlatformSource, PlatformAdapter> = new Map();

/**
 * Get adapter for a specific platform
 *
 * Factory method that returns the appropriate platform adapter.
 * This is the primary method for consumer code.
 *
 * Adapters are cached after first instantiation for performance.
 * Multiple calls with same source return same instance.
 *
 * @param source - Platform identifier (SHOPIFY, WOOCOMMERCE, MAGENTO, CUSTOM)
 * @returns Adapter instance implementing PlatformAdapter interface
 *
 * @throws Error if platform is not supported or adapter fails to load
 *
 * @example
 * ```typescript
 * // Get adapter for WooCommerce
 * const adapter = await getPlatformAdapter(PlatformSource.WOOCOMMERCE);
 *
 * // Validate webhook
 * const isValid = adapter.validateWebhook(payload, signature);
 *
 * // Map order to Witylogix format
 * const order = await adapter.mapOrder(woocommerceOrder);
 *
 * // Fetch products with pagination
 * const { products, nextCursor } = await adapter.fetchProducts(credentials);
 * ```
 */
export async function getPlatformAdapter(source: PlatformSource): Promise<PlatformAdapter> {
  // Validate platform source
  if (!isPlatformSource(source)) {
    throw new Error(
      `Invalid platform source: ${source}. Must be one of: ${Object.values(PlatformSource).join(", ")}`
    );
  }

  // Check cache first
  if (ADAPTER_CACHE.has(source)) {
    return ADAPTER_CACHE.get(source)!;
  }

  // Get adapter constructor
  const constructor = ADAPTER_REGISTRY.get(source);
  if (!constructor) {
    throw new Error(
      `No adapter registered for platform: ${source}. ` +
      `Supported platforms: ${Array.from(ADAPTER_REGISTRY.keys()).join(", ")}`
    );
  }

  // Create adapter instance
  const adapter = await constructor();

  // Validate adapter has correct source
  if (adapter.source !== source) {
    throw new Error(
      `Adapter source mismatch: expected ${source}, got ${adapter.source}`
    );
  }

  // Cache and return
  ADAPTER_CACHE.set(source, adapter);
  return adapter;
}

/**
 * Get all registered platforms
 *
 * @returns Array of supported platform sources
 *
 * @example
 * ```typescript
 * const platforms = getSupportedPlatforms();
 * // Returns: [PlatformSource.SHOPIFY, PlatformSource.WOOCOMMERCE, ...]
 *
 * for (const platform of platforms) {
 *   const adapter = await getPlatformAdapter(platform);
 *   console.log(`Platform: ${adapter.source}`);
 * }
 * ```
 */
export function getSupportedPlatforms(): PlatformSource[] {
  return Array.from(ADAPTER_REGISTRY.keys());
}

/**
 * Check if a platform is supported
 *
 * @param source - Platform to check
 * @returns true if adapter is registered for platform
 *
 * @example
 * ```typescript
 * if (isPlatformSupported(PlatformSource.WOOCOMMERCE)) {
 *   const adapter = await getPlatformAdapter(PlatformSource.WOOCOMMERCE);
 *   // Use adapter
 * } else {
 *   console.log("WooCommerce not supported");
 * }
 * ```
 */
export function isPlatformSupported(source: PlatformSource): boolean {
  return ADAPTER_REGISTRY.has(source);
}

/**
 * Clear adapter cache
 *
 * Forces adapters to be re-instantiated on next call.
 * Useful for testing or when credentials rotate.
 *
 * @example
 * ```typescript
 * // After updating platform credentials
 * clearAdapterCache();
 * // Next getPlatformAdapter() call will create fresh instance
 * ```
 */
export function clearAdapterCache(): void {
  ADAPTER_CACHE.clear();
}

/**
 * Clear specific adapter from cache
 *
 * @param source - Platform adapter to clear
 *
 * @example
 * ```typescript
 * // WooCommerce credentials rotated
 * clearAdapterCacheFor(PlatformSource.WOOCOMMERCE);
 * ```
 */
export function clearAdapterCacheFor(source: PlatformSource): void {
  ADAPTER_CACHE.delete(source);
}

/**
 * Initialize platform adapters
 *
 * Call this once at application startup to register all adapters.
 * This happens automatically when the module is imported, but can be
 * called explicitly to ensure adapters are registered before use.
 *
 * @example
 * ```typescript
 * // In main.ts or app.ts
 * import { initializePlatforms } from '@witylogix/core/platforms';
 *
 * async function main() {
 *   await initializePlatforms();
 *   // Now all platforms are registered
 * }
 * ```
 */
export async function initializePlatforms(): Promise<void> {
  // Register all built-in adapters
  // These are lazy-loaded to avoid circular dependencies

  // Shopify adapter
  registerAdapter(
    PlatformSource.SHOPIFY,
    async () => {
      const { ShopifyAdapter } = await import("./adapters/shopify");
      return new ShopifyAdapter();
    }
  );

  // WooCommerce adapter
  registerAdapter(
    PlatformSource.WOOCOMMERCE,
    async () => {
      const { WooCommerceAdapter } = await import("./adapters/woocommerce");
      return new WooCommerceAdapter();
    }
  );

  // Magento adapter (placeholder, to be implemented)
  registerAdapter(
    PlatformSource.MAGENTO,
    async () => {
      const { MagentoAdapter } = await import("./adapters/magento");
      return new MagentoAdapter();
    }
  );

  // Custom adapter (placeholder, to be implemented)
  registerAdapter(
    PlatformSource.CUSTOM,
    async () => {
      const { CustomAdapter } = await import("./adapters/custom");
      return new CustomAdapter();
    }
  );

  console.log(
    `[Platforms] Initialized ${ADAPTER_REGISTRY.size} platform adapters: ` +
    `${Array.from(ADAPTER_REGISTRY.keys()).join(", ")}`
  );
}

/**
 * Get adapter metadata (for debugging/monitoring)
 *
 * @param source - Platform to get metadata for
 * @returns Metadata object with adapter info
 *
 * @example
 * ```typescript
 * const metadata = getAdapterMetadata(PlatformSource.WOOCOMMERCE);
 * console.log(metadata);
 * // Output:
 * // {
 * //   source: "WOOCOMMERCE",
 * //   supported: true,
 * //   cached: true,
 * //   version: "1.0.0"
 * // }
 * ```
 */
export interface AdapterMetadata {
  source: PlatformSource;
  supported: boolean;
  cached: boolean;
  version?: string;
}

export function getAdapterMetadata(source: PlatformSource): AdapterMetadata {
  return {
    source,
    supported: isPlatformSupported(source),
    cached: ADAPTER_CACHE.has(source),
  };
}

/**
 * Get metadata for all adapters
 *
 * @returns Array of adapter metadata
 *
 * @example
 * ```typescript
 * const allMetadata = getAllAdapterMetadata();
 * console.table(allMetadata);
 * ```
 */
export function getAllAdapterMetadata(): AdapterMetadata[] {
  return Array.from(ADAPTER_REGISTRY.keys()).map((source) =>
    getAdapterMetadata(source)
  );
}

// Export types and utilities
export {
  PlatformAdapter,
  PlatformCredentials,
  ShopifyCredentials,
  WooCommerceCredentials,
  MagentoCredentials,
  CustomCredentials,
  CreateOrderInput,
  CreateProductInput,
  CreateCustomerInput,
  WebhookValidationError,
  PlatformError,
  PlatformAuthError,
  PlatformRateLimitError,
  PlatformNotFoundError,
} from "./types.js";

export { default as PlatformAdapter } from "./types.js";

/**
 * Default initialization
 *
 * Platforms are initialized when module is imported.
 * This ensures adapters are registered before first use.
 */
initializePlatforms().catch((error) => {
  console.error("[Platforms] Failed to initialize:", error);
  process.exit(1);
});
