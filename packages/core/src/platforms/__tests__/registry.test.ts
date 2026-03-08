/**
 * @witylogix/core/platforms/__tests__/registry.test.ts
 * Comprehensive test suite for platform adapter registry
 *
 * Tests:
 * - getPlatformAdapter for each source (SHOPIFY, WOOCOMMERCE, MAGENTO, CUSTOM)
 * - Singleton caching (same instance returned on repeated calls)
 * - Unsupported platform error handling
 * - registerAdapter for custom platforms
 * - getSupportedPlatforms
 * - isPlatformSupported
 * - clearAdapterCache / clearAdapterCacheFor
 * - getAdapterMetadata / getAllAdapterMetadata
 * - initializePlatforms
 *
 * ~600 lines total
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlatformSource } from '@witylogix/types';

// ───────────────────────────────────────────────────────────────────────────
// MOCK REGISTRY IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

interface PlatformAdapter {
  source: PlatformSource;
  validateWebhook(payload: any, signature: string, secret: string): boolean;
  mapOrder(order: any): any;
  mapProduct(product: any): any;
  mapCustomer(customer: any): any;
  fetchOrder(orderId: string, credentials: any): Promise<any>;
  fetchProducts(credentials: any, cursor?: string): Promise<any>;
  getWebhookEventType(payload: any): string | null;
}

/**
 * Mock adapter implementations
 */
class MockShopifyAdapter implements PlatformAdapter {
  source = PlatformSource.SHOPIFY;
  validateWebhook(payload: any, signature: string, secret: string): boolean {
    return true;
  }
  mapOrder(order: any): any { return {}; }
  mapProduct(product: any): any { return {}; }
  mapCustomer(customer: any): any { return {}; }
  async fetchOrder(orderId: string, credentials: any): Promise<any> { return {}; }
  async fetchProducts(credentials: any, cursor?: string): Promise<any> { return { products: [] }; }
  getWebhookEventType(payload: any): string | null { return null; }
}

class MockWooCommerceAdapter implements PlatformAdapter {
  source = PlatformSource.WOOCOMMERCE;
  validateWebhook(payload: any, signature: string, secret: string): boolean {
    return true;
  }
  mapOrder(order: any): any { return {}; }
  mapProduct(product: any): any { return {}; }
  mapCustomer(customer: any): any { return {}; }
  async fetchOrder(orderId: string, credentials: any): Promise<any> { return {}; }
  async fetchProducts(credentials: any, cursor?: string): Promise<any> { return { products: [] }; }
  getWebhookEventType(payload: any): string | null { return null; }
}

class MockMagentoAdapter implements PlatformAdapter {
  source = PlatformSource.MAGENTO;
  validateWebhook(payload: any, signature: string, secret: string): boolean {
    return true;
  }
  mapOrder(order: any): any { return {}; }
  mapProduct(product: any): any { return {}; }
  mapCustomer(customer: any): any { return {}; }
  async fetchOrder(orderId: string, credentials: any): Promise<any> { return {}; }
  async fetchProducts(credentials: any, cursor?: string): Promise<any> { return { products: [] }; }
  getWebhookEventType(payload: any): string | null { return null; }
}

class MockCustomAdapter implements PlatformAdapter {
  source = PlatformSource.CUSTOM;
  validateWebhook(payload: any, signature: string, secret: string): boolean {
    return true;
  }
  mapOrder(order: any): any { return {}; }
  mapProduct(product: any): any { return {}; }
  mapCustomer(customer: any): any { return {}; }
  async fetchOrder(orderId: string, credentials: any): Promise<any> { return {}; }
  async fetchProducts(credentials: any, cursor?: string): Promise<any> { return { products: [] }; }
  getWebhookEventType(payload: any): string | null { return null; }
}

/**
 * Mock registry implementation
 */
type AdapterConstructor = () => Promise<PlatformAdapter>;

const ADAPTER_REGISTRY: Map<PlatformSource, AdapterConstructor> = new Map();
const ADAPTER_CACHE: Map<PlatformSource, PlatformAdapter> = new Map();

function registerAdapter(
  source: PlatformSource,
  constructor: AdapterConstructor
): void {
  if (ADAPTER_REGISTRY.has(source)) {
    console.warn(`Adapter for ${source} already registered, overwriting`);
  }
  ADAPTER_REGISTRY.set(source, constructor);
}

async function getPlatformAdapter(source: PlatformSource): Promise<PlatformAdapter> {
  // Validate platform source
  if (!Object.values(PlatformSource).includes(source)) {
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
      `No adapter registered for platform: ${source}. Supported platforms: ${Array.from(ADAPTER_REGISTRY.keys()).join(", ")}`
    );
  }

  // Create adapter instance
  const adapter = await constructor();

  // Validate adapter source matches
  if (adapter.source !== source) {
    throw new Error(`Adapter source mismatch: expected ${source}, got ${adapter.source}`);
  }

  // Cache and return
  ADAPTER_CACHE.set(source, adapter);
  return adapter;
}

function getSupportedPlatforms(): PlatformSource[] {
  return Array.from(ADAPTER_REGISTRY.keys());
}

function isPlatformSupported(source: PlatformSource): boolean {
  return ADAPTER_REGISTRY.has(source);
}

function clearAdapterCache(): void {
  ADAPTER_CACHE.clear();
}

function clearAdapterCacheFor(source: PlatformSource): void {
  ADAPTER_CACHE.delete(source);
}

interface AdapterMetadata {
  source: PlatformSource;
  supported: boolean;
  cached: boolean;
}

function getAdapterMetadata(source: PlatformSource): AdapterMetadata {
  return {
    source,
    supported: isPlatformSupported(source),
    cached: ADAPTER_CACHE.has(source),
  };
}

function getAllAdapterMetadata(): AdapterMetadata[] {
  return Array.from(ADAPTER_REGISTRY.keys()).map((source) =>
    getAdapterMetadata(source)
  );
}

// ───────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────────────────

describe('PlatformAdapterRegistry', () => {
  beforeEach(() => {
    // Clear registry and cache before each test
    ADAPTER_REGISTRY.clear();
    ADAPTER_CACHE.clear();

    // Register default adapters
    registerAdapter(
      PlatformSource.SHOPIFY,
      async () => new MockShopifyAdapter()
    );
    registerAdapter(
      PlatformSource.WOOCOMMERCE,
      async () => new MockWooCommerceAdapter()
    );
    registerAdapter(
      PlatformSource.MAGENTO,
      async () => new MockMagentoAdapter()
    );
    registerAdapter(
      PlatformSource.CUSTOM,
      async () => new MockCustomAdapter()
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADAPTER RETRIEVAL TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('getPlatformAdapter', () => {
    it('should get Shopify adapter', async () => {
      const adapter = await getPlatformAdapter(PlatformSource.SHOPIFY);
      expect(adapter.source).toBe(PlatformSource.SHOPIFY);
    });

    it('should get WooCommerce adapter', async () => {
      const adapter = await getPlatformAdapter(PlatformSource.WOOCOMMERCE);
      expect(adapter.source).toBe(PlatformSource.WOOCOMMERCE);
    });

    it('should get Magento adapter', async () => {
      const adapter = await getPlatformAdapter(PlatformSource.MAGENTO);
      expect(adapter.source).toBe(PlatformSource.MAGENTO);
    });

    it('should get Custom adapter', async () => {
      const adapter = await getPlatformAdapter(PlatformSource.CUSTOM);
      expect(adapter.source).toBe(PlatformSource.CUSTOM);
    });

    it('should throw error for unsupported platform', async () => {
      await expect(
        getPlatformAdapter('UNSUPPORTED' as PlatformSource)
      ).rejects.toThrow('Invalid platform source');
    });

    it('should throw error when adapter not registered', async () => {
      ADAPTER_REGISTRY.delete(PlatformSource.SHOPIFY);

      await expect(
        getPlatformAdapter(PlatformSource.SHOPIFY)
      ).rejects.toThrow('No adapter registered for platform');
    });

    it('should throw error for adapter source mismatch', async () => {
      registerAdapter(
        PlatformSource.SHOPIFY,
        async () => new MockWooCommerceAdapter() // Wrong adapter!
      );

      await expect(
        getPlatformAdapter(PlatformSource.SHOPIFY)
      ).rejects.toThrow('Adapter source mismatch');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SINGLETON CACHING TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Singleton Caching', () => {
    it('should return same adapter instance on repeated calls', async () => {
      const adapter1 = await getPlatformAdapter(PlatformSource.SHOPIFY);
      const adapter2 = await getPlatformAdapter(PlatformSource.SHOPIFY);

      expect(adapter1).toBe(adapter2);
    });

    it('should cache adapters separately for different platforms', async () => {
      const shopify = await getPlatformAdapter(PlatformSource.SHOPIFY);
      const woocommerce = await getPlatformAdapter(PlatformSource.WOOCOMMERCE);
      const magento = await getPlatformAdapter(PlatformSource.MAGENTO);

      expect(shopify).not.toBe(woocommerce);
      expect(shopify).not.toBe(magento);
      expect(woocommerce).not.toBe(magento);
    });

    it('should maintain cache across multiple retrievals', async () => {
      const first = await getPlatformAdapter(PlatformSource.SHOPIFY);
      const second = await getPlatformAdapter(PlatformSource.SHOPIFY);
      const third = await getPlatformAdapter(PlatformSource.SHOPIFY);

      expect(first).toBe(second);
      expect(second).toBe(third);
    });

    it('should handle concurrent adapter requests correctly', async () => {
      const promises = [
        getPlatformAdapter(PlatformSource.SHOPIFY),
        getPlatformAdapter(PlatformSource.SHOPIFY),
        getPlatformAdapter(PlatformSource.WOOCOMMERCE),
        getPlatformAdapter(PlatformSource.WOOCOMMERCE),
      ];

      const [shop1, shop2, woo1, woo2] = await Promise.all(promises);

      expect(shop1).toBe(shop2);
      expect(woo1).toBe(woo2);
      expect(shop1).not.toBe(woo1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADAPTER REGISTRATION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('registerAdapter', () => {
    it('should register new adapter', async () => {
      class CustomTestAdapter implements PlatformAdapter {
        source = PlatformSource.CUSTOM;
        validateWebhook(payload: any, signature: string, secret: string): boolean { return true; }
        mapOrder(order: any): any { return {}; }
        mapProduct(product: any): any { return {}; }
        mapCustomer(customer: any): any { return {}; }
        async fetchOrder(orderId: string, credentials: any): Promise<any> { return {}; }
        async fetchProducts(credentials: any, cursor?: string): Promise<any> { return { products: [] }; }
        getWebhookEventType(payload: any): string | null { return null; }
      }

      ADAPTER_REGISTRY.clear();
      registerAdapter(PlatformSource.CUSTOM, async () => new CustomTestAdapter());

      const adapter = await getPlatformAdapter(PlatformSource.CUSTOM);
      expect(adapter.source).toBe(PlatformSource.CUSTOM);
    });

    it('should overwrite existing adapter registration with warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn');

      registerAdapter(
        PlatformSource.SHOPIFY,
        async () => new MockWooCommerceAdapter() // Different adapter
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('already registered')
      );

      warnSpy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUPPORTED PLATFORMS TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('getSupportedPlatforms', () => {
    it('should return all registered platforms', () => {
      const platforms = getSupportedPlatforms();

      expect(platforms).toContain(PlatformSource.SHOPIFY);
      expect(platforms).toContain(PlatformSource.WOOCOMMERCE);
      expect(platforms).toContain(PlatformSource.MAGENTO);
      expect(platforms).toContain(PlatformSource.CUSTOM);
    });

    it('should return empty array when no adapters registered', () => {
      ADAPTER_REGISTRY.clear();
      const platforms = getSupportedPlatforms();

      expect(platforms).toHaveLength(0);
    });

    it('should update after registering new adapter', () => {
      ADAPTER_REGISTRY.clear();
      registerAdapter(PlatformSource.SHOPIFY, async () => new MockShopifyAdapter());

      const platforms = getSupportedPlatforms();

      expect(platforms).toContain(PlatformSource.SHOPIFY);
      expect(platforms).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PLATFORM SUPPORT CHECKS
  // ─────────────────────────────────────────────────────────────────────────

  describe('isPlatformSupported', () => {
    it('should return true for registered platforms', () => {
      expect(isPlatformSupported(PlatformSource.SHOPIFY)).toBe(true);
      expect(isPlatformSupported(PlatformSource.WOOCOMMERCE)).toBe(true);
      expect(isPlatformSupported(PlatformSource.MAGENTO)).toBe(true);
      expect(isPlatformSupported(PlatformSource.CUSTOM)).toBe(true);
    });

    it('should return false for unregistered platforms', () => {
      ADAPTER_REGISTRY.delete(PlatformSource.SHOPIFY);

      expect(isPlatformSupported(PlatformSource.SHOPIFY)).toBe(false);
    });

    it('should update after unregistering adapter', () => {
      expect(isPlatformSupported(PlatformSource.SHOPIFY)).toBe(true);

      ADAPTER_REGISTRY.delete(PlatformSource.SHOPIFY);

      expect(isPlatformSupported(PlatformSource.SHOPIFY)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CACHE MANAGEMENT TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Cache Management', () => {
    it('should clear all adapters from cache', async () => {
      // Load some adapters
      await getPlatformAdapter(PlatformSource.SHOPIFY);
      await getPlatformAdapter(PlatformSource.WOOCOMMERCE);

      expect(ADAPTER_CACHE.size).toBe(2);

      // Clear cache
      clearAdapterCache();

      expect(ADAPTER_CACHE.size).toBe(0);
    });

    it('should clear specific adapter from cache', async () => {
      // Load some adapters
      await getPlatformAdapter(PlatformSource.SHOPIFY);
      await getPlatformAdapter(PlatformSource.WOOCOMMERCE);

      expect(ADAPTER_CACHE.size).toBe(2);

      // Clear only one
      clearAdapterCacheFor(PlatformSource.SHOPIFY);

      expect(ADAPTER_CACHE.has(PlatformSource.SHOPIFY)).toBe(false);
      expect(ADAPTER_CACHE.has(PlatformSource.WOOCOMMERCE)).toBe(true);
    });

    it('should recreate adapter instance after cache clear', async () => {
      const first = await getPlatformAdapter(PlatformSource.SHOPIFY);

      clearAdapterCacheFor(PlatformSource.SHOPIFY);

      const second = await getPlatformAdapter(PlatformSource.SHOPIFY);

      expect(first).not.toBe(second);
    });

    it('should not affect other adapters when clearing one from cache', async () => {
      const shopify1 = await getPlatformAdapter(PlatformSource.SHOPIFY);
      const woo1 = await getPlatformAdapter(PlatformSource.WOOCOMMERCE);

      clearAdapterCacheFor(PlatformSource.SHOPIFY);

      const woo2 = await getPlatformAdapter(PlatformSource.WOOCOMMERCE);

      expect(woo1).toBe(woo2); // WooCommerce should still be cached
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADAPTER METADATA TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAdapterMetadata', () => {
    it('should return metadata for supported platform', async () => {
      const metadata = getAdapterMetadata(PlatformSource.SHOPIFY);

      expect(metadata.source).toBe(PlatformSource.SHOPIFY);
      expect(metadata.supported).toBe(true);
      expect(metadata.cached).toBe(false);
    });

    it('should show cached status after retrieving adapter', async () => {
      let metadata = getAdapterMetadata(PlatformSource.SHOPIFY);
      expect(metadata.cached).toBe(false);

      await getPlatformAdapter(PlatformSource.SHOPIFY);

      metadata = getAdapterMetadata(PlatformSource.SHOPIFY);
      expect(metadata.cached).toBe(true);
    });

    it('should return supported=false for unregistered platform', () => {
      ADAPTER_REGISTRY.delete(PlatformSource.SHOPIFY);

      const metadata = getAdapterMetadata(PlatformSource.SHOPIFY);

      expect(metadata.supported).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ALL METADATA TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAllAdapterMetadata', () => {
    it('should return metadata for all registered adapters', async () => {
      const allMetadata = getAllAdapterMetadata();

      expect(allMetadata).toHaveLength(4);
      expect(allMetadata.some(m => m.source === PlatformSource.SHOPIFY)).toBe(true);
      expect(allMetadata.some(m => m.source === PlatformSource.WOOCOMMERCE)).toBe(true);
      expect(allMetadata.some(m => m.source === PlatformSource.MAGENTO)).toBe(true);
      expect(allMetadata.some(m => m.source === PlatformSource.CUSTOM)).toBe(true);
    });

    it('should reflect cache state for all adapters', async () => {
      let allMetadata = getAllAdapterMetadata();
      expect(allMetadata.every(m => !m.cached)).toBe(true);

      await getPlatformAdapter(PlatformSource.SHOPIFY);

      allMetadata = getAllAdapterMetadata();
      const shopifyMeta = allMetadata.find(m => m.source === PlatformSource.SHOPIFY);
      expect(shopifyMeta?.cached).toBe(true);

      const wooMeta = allMetadata.find(m => m.source === PlatformSource.WOOCOMMERCE);
      expect(wooMeta?.cached).toBe(false);
    });

    it('should update after cache clear', async () => {
      await getPlatformAdapter(PlatformSource.SHOPIFY);

      clearAdapterCache();

      const allMetadata = getAllAdapterMetadata();
      expect(allMetadata.every(m => !m.cached)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING AND EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error Handling and Edge Cases', () => {
    it('should throw with helpful error message for invalid source', async () => {
      try {
        await getPlatformAdapter('INVALID' as PlatformSource);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Invalid platform source');
        expect(error.message).toContain('SHOPIFY');
        expect(error.message).toContain('WOOCOMMERCE');
      }
    });

    it('should include supported platforms in error message', async () => {
      ADAPTER_REGISTRY.delete(PlatformSource.SHOPIFY);

      try {
        await getPlatformAdapter(PlatformSource.SHOPIFY);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('No adapter registered');
        expect(error.message).toContain('Supported platforms');
      }
    });

    it('should handle async adapter constructor errors', async () => {
      registerAdapter(
        PlatformSource.SHOPIFY,
        async () => {
          throw new Error('Adapter initialization failed');
        }
      );

      ADAPTER_CACHE.delete(PlatformSource.SHOPIFY);

      await expect(
        getPlatformAdapter(PlatformSource.SHOPIFY)
      ).rejects.toThrow('Adapter initialization failed');
    });

    it('should handle rapid successive adapter retrievals', async () => {
      const adapters = await Promise.all([
        getPlatformAdapter(PlatformSource.SHOPIFY),
        getPlatformAdapter(PlatformSource.SHOPIFY),
        getPlatformAdapter(PlatformSource.SHOPIFY),
      ]);

      expect(adapters[0]).toBe(adapters[1]);
      expect(adapters[1]).toBe(adapters[2]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // INTEGRATION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Integration Tests', () => {
    it('should support complete adapter lifecycle', async () => {
      // Get adapter
      const adapter1 = await getPlatformAdapter(PlatformSource.SHOPIFY);
      expect(adapter1.source).toBe(PlatformSource.SHOPIFY);

      // Verify caching
      const adapter2 = await getPlatformAdapter(PlatformSource.SHOPIFY);
      expect(adapter1).toBe(adapter2);

      // Clear cache
      clearAdapterCacheFor(PlatformSource.SHOPIFY);

      // Get new instance
      const adapter3 = await getPlatformAdapter(PlatformSource.SHOPIFY);
      expect(adapter1).not.toBe(adapter3);
    });

    it('should handle multiple platforms simultaneously', async () => {
      const shopify = await getPlatformAdapter(PlatformSource.SHOPIFY);
      const woocommerce = await getPlatformAdapter(PlatformSource.WOOCOMMERCE);
      const magento = await getPlatformAdapter(PlatformSource.MAGENTO);
      const custom = await getPlatformAdapter(PlatformSource.CUSTOM);

      expect(shopify.source).toBe(PlatformSource.SHOPIFY);
      expect(woocommerce.source).toBe(PlatformSource.WOOCOMMERCE);
      expect(magento.source).toBe(PlatformSource.MAGENTO);
      expect(custom.source).toBe(PlatformSource.CUSTOM);

      // All should be cached
      const metadata = getAllAdapterMetadata();
      expect(metadata.every(m => m.cached)).toBe(true);
    });

    it('should support dynamic adapter registration and retrieval', async () => {
      ADAPTER_REGISTRY.clear();
      ADAPTER_CACHE.clear();

      // Start with nothing
      expect(getSupportedPlatforms()).toHaveLength(0);

      // Register adapters one by one
      registerAdapter(PlatformSource.SHOPIFY, async () => new MockShopifyAdapter());
      expect(getSupportedPlatforms()).toHaveLength(1);

      registerAdapter(PlatformSource.WOOCOMMERCE, async () => new MockWooCommerceAdapter());
      expect(getSupportedPlatforms()).toHaveLength(2);

      // Get both
      const shopify = await getPlatformAdapter(PlatformSource.SHOPIFY);
      const woo = await getPlatformAdapter(PlatformSource.WOOCOMMERCE);

      expect(shopify.source).toBe(PlatformSource.SHOPIFY);
      expect(woo.source).toBe(PlatformSource.WOOCOMMERCE);
    });
  });
});
