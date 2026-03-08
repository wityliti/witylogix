/**
 * Platform Types Tests
 * Sprint 3.4: Testing new platform abstraction types and helper functions
 *
 * Covers:
 * - PlatformSource enum values
 * - ExternalReference interface compliance
 * - isPlatformSource() helper validation
 * - Type safety and discrimination
 */

import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM TYPES DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Supported e-commerce platforms
 */
export enum PlatformSource {
  SHOPIFY = 'SHOPIFY',
  WOOCOMMERCE = 'WOOCOMMERCE',
  MAGENTO = 'MAGENTO',
  BIGCOMMERCE = 'BIGCOMMERCE',
  CUSTOM = 'CUSTOM',
}

/**
 * External reference interface for platform-agnostic resource IDs
 */
export interface ExternalReference {
  /** Platform source */
  source: PlatformSource | string;
  /** Platform-specific external ID */
  externalId: string;
  /** Internal system ID (optional, populated after sync) */
  internalId?: string;
  /** Reference type (order, product, customer, etc.) */
  type?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Order with external reference
 */
export interface ExternalOrder {
  internalId: string;
  externalReference: ExternalReference;
  shopId: string;
  customerName: string;
  totalPrice: number;
}

/**
 * Product with external reference
 */
export interface ExternalProduct {
  internalId: string;
  externalReference: ExternalReference;
  shopId: string;
  title: string;
  variants: Array<{
    externalId: string;
    sku: string;
  }>;
}

/**
 * Helper function to check if a string is a valid PlatformSource
 */
export function isPlatformSource(value: unknown): value is PlatformSource {
  if (typeof value !== 'string') return false;
  return Object.values(PlatformSource).includes(value as PlatformSource);
}

/**
 * Helper to normalize source to uppercase
 */
export function normalizePlatformSource(source: string): PlatformSource | string {
  const normalized = source?.toUpperCase();
  return isPlatformSource(normalized) ? normalized : source;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENUM TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('PlatformSource Enum', () => {
  describe('Enum Values', () => {
    it('should have SHOPIFY platform source', () => {
      expect(PlatformSource.SHOPIFY).toBe('SHOPIFY');
    });

    it('should have WOOCOMMERCE platform source', () => {
      expect(PlatformSource.WOOCOMMERCE).toBe('WOOCOMMERCE');
    });

    it('should have MAGENTO platform source', () => {
      expect(PlatformSource.MAGENTO).toBe('MAGENTO');
    });

    it('should have BIGCOMMERCE platform source', () => {
      expect(PlatformSource.BIGCOMMERCE).toBe('BIGCOMMERCE');
    });

    it('should have CUSTOM platform source', () => {
      expect(PlatformSource.CUSTOM).toBe('CUSTOM');
    });

    it('should have exactly 5 platform sources', () => {
      const sources = Object.values(PlatformSource);
      expect(sources).toHaveLength(5);
    });
  });

  describe('Enum Iteration', () => {
    it('should iterate over all platform sources', () => {
      const sources = Object.values(PlatformSource);
      expect(sources).toEqual(
        expect.arrayContaining(['SHOPIFY', 'WOOCOMMERCE', 'MAGENTO', 'BIGCOMMERCE', 'CUSTOM'])
      );
    });

    it('should iterate in expected order', () => {
      const sources = Object.values(PlatformSource);
      expect(sources[0]).toBe('SHOPIFY');
      expect(sources[1]).toBe('WOOCOMMERCE');
      expect(sources[2]).toBe('MAGENTO');
      expect(sources[3]).toBe('BIGCOMMERCE');
      expect(sources[4]).toBe('CUSTOM');
    });
  });

  describe('Enum Type Safety', () => {
    it('should only accept valid enum values', () => {
      const validValue: PlatformSource = PlatformSource.SHOPIFY;
      expect(validValue).toBe('SHOPIFY');
    });

    it('should reject invalid values at type level', () => {
      // @ts-expect-error - Testing type safety
      const invalidValue: PlatformSource = 'INVALID';
      expect(invalidValue).not.toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL REFERENCE INTERFACE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ExternalReference Interface', () => {
  describe('Required Fields', () => {
    it('should require source field', () => {
      const ref: ExternalReference = {
        source: PlatformSource.SHOPIFY,
        externalId: 'ext-123',
      };

      expect(ref).toHaveProperty('source');
      expect(ref.source).toBe('SHOPIFY');
    });

    it('should require externalId field', () => {
      const ref: ExternalReference = {
        source: PlatformSource.WOOCOMMERCE,
        externalId: 'woo-order-456',
      };

      expect(ref).toHaveProperty('externalId');
      expect(ref.externalId).toBe('woo-order-456');
    });

    it('should accept both required fields', () => {
      const ref: ExternalReference = {
        source: PlatformSource.CUSTOM,
        externalId: 'custom-prod-789',
      };

      expect(ref).toMatchObject({
        source: 'CUSTOM',
        externalId: 'custom-prod-789',
      });
    });
  });

  describe('Optional Fields', () => {
    it('should allow optional internalId', () => {
      const ref: ExternalReference = {
        source: PlatformSource.SHOPIFY,
        externalId: 'ext-123',
        internalId: 'int-456',
      };

      expect(ref.internalId).toBe('int-456');
    });

    it('should allow optional type field', () => {
      const ref: ExternalReference = {
        source: PlatformSource.SHOPIFY,
        externalId: 'ext-order-123',
        type: 'order',
      };

      expect(ref.type).toBe('order');
    });

    it('should allow optional metadata field', () => {
      const ref: ExternalReference = {
        source: PlatformSource.WOOCOMMERCE,
        externalId: 'woo-prod-456',
        metadata: {
          syncedAt: '2026-03-08T10:00:00Z',
          lastModified: '2026-03-08T09:30:00Z',
        },
      };

      expect(ref.metadata).toMatchObject({
        syncedAt: expect.any(String),
        lastModified: expect.any(String),
      });
    });

    it('should work with all optional fields', () => {
      const ref: ExternalReference = {
        source: PlatformSource.MAGENTO,
        externalId: 'mag-123',
        internalId: 'int-mag-123',
        type: 'product',
        metadata: {
          platform: 'Magento 2.4',
          storeId: 1,
        },
      };

      expect(ref).toMatchObject({
        source: 'MAGENTO',
        externalId: 'mag-123',
        internalId: 'int-mag-123',
        type: 'product',
        metadata: {
          platform: expect.any(String),
          storeId: expect.any(Number),
        },
      });
    });
  });

  describe('Source Field Flexibility', () => {
    it('should accept enum PlatformSource value', () => {
      const ref: ExternalReference = {
        source: PlatformSource.SHOPIFY,
        externalId: 'ext-123',
      };

      expect(ref.source).toBe('SHOPIFY');
    });

    it('should accept string source value', () => {
      const ref: ExternalReference = {
        source: 'CUSTOM_PLATFORM',
        externalId: 'ext-123',
      };

      expect(ref.source).toBe('CUSTOM_PLATFORM');
    });

    it('should support arbitrary platform strings', () => {
      const customPlatforms = ['LEGACY_SYSTEM', 'PARTNER_API', 'INTERNAL_ERP'];

      customPlatforms.forEach((platform) => {
        const ref: ExternalReference = {
          source: platform,
          externalId: 'ext-123',
        };

        expect(ref.source).toBe(platform);
      });
    });
  });

  describe('Metadata Field Flexibility', () => {
    it('should accept any metadata shape', () => {
      const ref: ExternalReference = {
        source: PlatformSource.SHOPIFY,
        externalId: 'ext-123',
        metadata: {
          customField: 'value',
          nestedObj: {
            prop: 'value',
          },
          array: [1, 2, 3],
        },
      };

      expect(ref.metadata).toHaveProperty('customField');
      expect(ref.metadata).toHaveProperty('nestedObj');
      expect(ref.metadata).toHaveProperty('array');
    });

    it('should allow empty metadata', () => {
      const ref: ExternalReference = {
        source: PlatformSource.WOOCOMMERCE,
        externalId: 'woo-456',
        metadata: {},
      };

      expect(ref.metadata).toEqual({});
    });

    it('should allow undefined metadata', () => {
      const ref: ExternalReference = {
        source: PlatformSource.CUSTOM,
        externalId: 'custom-789',
        // metadata omitted
      };

      expect(ref.metadata).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('isPlatformSource() Helper', () => {
  describe('Valid Platform Sources', () => {
    it('should return true for SHOPIFY', () => {
      expect(isPlatformSource('SHOPIFY')).toBe(true);
    });

    it('should return true for WOOCOMMERCE', () => {
      expect(isPlatformSource('WOOCOMMERCE')).toBe(true);
    });

    it('should return true for MAGENTO', () => {
      expect(isPlatformSource('MAGENTO')).toBe(true);
    });

    it('should return true for BIGCOMMERCE', () => {
      expect(isPlatformSource('BIGCOMMERCE')).toBe(true);
    });

    it('should return true for CUSTOM', () => {
      expect(isPlatformSource('CUSTOM')).toBe(true);
    });

    it('should accept PlatformSource enum values', () => {
      expect(isPlatformSource(PlatformSource.SHOPIFY)).toBe(true);
      expect(isPlatformSource(PlatformSource.WOOCOMMERCE)).toBe(true);
      expect(isPlatformSource(PlatformSource.CUSTOM)).toBe(true);
    });
  });

  describe('Invalid Platform Sources', () => {
    it('should return false for unknown string', () => {
      expect(isPlatformSource('UNKNOWN')).toBe(false);
    });

    it('should return false for lowercase strings', () => {
      expect(isPlatformSource('shopify')).toBe(false);
      expect(isPlatformSource('woocommerce')).toBe(false);
    });

    it('should return false for partial matches', () => {
      expect(isPlatformSource('SHOP')).toBe(false);
      expect(isPlatformSource('WOO')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isPlatformSource(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPlatformSource(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isPlatformSource('')).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(isPlatformSource(123)).toBe(false);
      expect(isPlatformSource(0)).toBe(false);
    });

    it('should return false for objects', () => {
      expect(isPlatformSource({})).toBe(false);
      expect(isPlatformSource({ source: 'SHOPIFY' })).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isPlatformSource(['SHOPIFY'])).toBe(false);
    });

    it('should return false for booleans', () => {
      expect(isPlatformSource(true)).toBe(false);
      expect(isPlatformSource(false)).toBe(false);
    });
  });

  describe('Type Guard Behavior', () => {
    it('should be usable as type guard in conditional', () => {
      const value: unknown = 'SHOPIFY';

      if (isPlatformSource(value)) {
        // In this branch, value is narrowed to PlatformSource
        const platform: PlatformSource = value;
        expect(platform).toBe('SHOPIFY');
      } else {
        expect.fail('Should have been recognized as platform source');
      }
    });

    it('should narrow type in if-else statement', () => {
      const testValue = 'CUSTOM';

      let result: string = 'unknown';
      if (isPlatformSource(testValue)) {
        result = `Valid platform: ${testValue}`;
      } else {
        result = 'Invalid platform';
      }

      expect(result).toBe('Valid platform: CUSTOM');
    });

    it('should work in filter operations', () => {
      const values = ['SHOPIFY', 'invalid', 'WOOCOMMERCE', 'custom-string', 'CUSTOM'];
      const platformSources = values.filter(isPlatformSource);

      expect(platformSources).toEqual(['SHOPIFY', 'WOOCOMMERCE', 'CUSTOM']);
      expect(platformSources).toHaveLength(3);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// USAGE PATTERN TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Platform Types Usage Patterns', () => {
  describe('Order with External Reference', () => {
    it('should create order with Shopify external reference', () => {
      const order: ExternalOrder = {
        internalId: 'order-123',
        externalReference: {
          source: PlatformSource.SHOPIFY,
          externalId: 'gid://shopify/Order/123456',
          type: 'order',
        },
        shopId: 'shop-001',
        customerName: 'John Doe',
        totalPrice: 99.99,
      };

      expect(order.externalReference.source).toBe('SHOPIFY');
      expect(order.externalReference.externalId).toContain('shopify');
    });

    it('should create order with WooCommerce external reference', () => {
      const order: ExternalOrder = {
        internalId: 'order-456',
        externalReference: {
          source: PlatformSource.WOOCOMMERCE,
          externalId: 'woo-order-789',
          type: 'order',
        },
        shopId: 'shop-002',
        customerName: 'Jane Smith',
        totalPrice: 149.99,
      };

      expect(order.externalReference.source).toBe('WOOCOMMERCE');
      expect(order.externalReference.type).toBe('order');
    });

    it('should create order with custom platform source', () => {
      const order: ExternalOrder = {
        internalId: 'order-789',
        externalReference: {
          source: 'CUSTOM_PLATFORM',
          externalId: 'custom-order-123',
          type: 'order',
        },
        shopId: 'shop-003',
        customerName: 'Bob Johnson',
        totalPrice: 199.99,
      };

      expect(order.externalReference.source).toBe('CUSTOM_PLATFORM');
    });
  });

  describe('Product with External Reference', () => {
    it('should create product with external reference', () => {
      const product: ExternalProduct = {
        internalId: 'prod-123',
        externalReference: {
          source: PlatformSource.SHOPIFY,
          externalId: 'gid://shopify/Product/456789',
          type: 'product',
        },
        shopId: 'shop-001',
        title: 'Test Product',
        variants: [
          {
            externalId: 'gid://shopify/ProductVariant/111',
            sku: 'SKU-001',
          },
        ],
      };

      expect(product.externalReference.source).toBe('SHOPIFY');
      expect(product.externalReference.type).toBe('product');
      expect(product.variants).toHaveLength(1);
    });

    it('should support multiple variants with external references', () => {
      const product: ExternalProduct = {
        internalId: 'prod-456',
        externalReference: {
          source: PlatformSource.WOOCOMMERCE,
          externalId: 'woo-prod-123',
          type: 'product',
        },
        shopId: 'shop-002',
        title: 'Multi-Variant Product',
        variants: [
          { externalId: 'woo-var-1', sku: 'SKU-001' },
          { externalId: 'woo-var-2', sku: 'SKU-002' },
          { externalId: 'woo-var-3', sku: 'SKU-003' },
        ],
      };

      expect(product.variants).toHaveLength(3);
      expect(product.variants.every((v) => v.externalId)).toBe(true);
    });
  });

  describe('Type Discrimination', () => {
    it('should handle reference type discrimination', () => {
      const references: ExternalReference[] = [
        { source: PlatformSource.SHOPIFY, externalId: 'order-123', type: 'order' },
        { source: PlatformSource.SHOPIFY, externalId: 'prod-456', type: 'product' },
        { source: PlatformSource.SHOPIFY, externalId: 'cust-789', type: 'customer' },
      ];

      const orders = references.filter((r) => r.type === 'order');
      const products = references.filter((r) => r.type === 'product');
      const customers = references.filter((r) => r.type === 'customer');

      expect(orders).toHaveLength(1);
      expect(products).toHaveLength(1);
      expect(customers).toHaveLength(1);
    });

    it('should handle platform discrimination', () => {
      const references: ExternalReference[] = [
        { source: PlatformSource.SHOPIFY, externalId: 'ext-1' },
        { source: PlatformSource.WOOCOMMERCE, externalId: 'ext-2' },
        { source: PlatformSource.CUSTOM, externalId: 'ext-3' },
      ];

      const shopifyRefs = references.filter((r) => r.source === PlatformSource.SHOPIFY);
      const wooRefs = references.filter((r) => r.source === PlatformSource.WOOCOMMERCE);

      expect(shopifyRefs).toHaveLength(1);
      expect(wooRefs).toHaveLength(1);
    });
  });

  describe('Validation Pattern', () => {
    it('should validate external reference with helper', () => {
      const untrustedSource: unknown = 'SHOPIFY';

      if (isPlatformSource(untrustedSource)) {
        const ref: ExternalReference = {
          source: untrustedSource,
          externalId: 'ext-123',
        };

        expect(ref.source).toBe('SHOPIFY');
      } else {
        expect.fail('Should have been valid platform source');
      }
    });

    it('should handle validation in function parameter', () => {
      function createOrder(source: unknown, externalId: string) {
        if (!isPlatformSource(source)) {
          throw new Error(`Invalid platform source: ${source}`);
        }

        const ref: ExternalReference = { source, externalId };
        return ref;
      }

      expect(() => createOrder('SHOPIFY', 'ext-1')).not.toThrow();
      expect(() => createOrder('INVALID', 'ext-2')).toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZATION HELPER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('normalizePlatformSource() Helper', () => {
  it('should convert lowercase to uppercase', () => {
    expect(normalizePlatformSource('shopify')).toBe(PlatformSource.SHOPIFY);
    expect(normalizePlatformSource('woocommerce')).toBe(PlatformSource.WOOCOMMERCE);
    expect(normalizePlatformSource('custom')).toBe(PlatformSource.CUSTOM);
  });

  it('should return uppercase values unchanged', () => {
    expect(normalizePlatformSource('SHOPIFY')).toBe(PlatformSource.SHOPIFY);
    expect(normalizePlatformSource('MAGENTO')).toBe(PlatformSource.MAGENTO);
  });

  it('should return unknown values as-is', () => {
    expect(normalizePlatformSource('UNKNOWN')).toBe('UNKNOWN');
    expect(normalizePlatformSource('custom_platform')).toBe('CUSTOM_PLATFORM');
  });

  it('should handle empty string', () => {
    expect(normalizePlatformSource('')).toBe('');
  });

  it('should work with mixed case', () => {
    expect(normalizePlatformSource('ShOpIfY')).toBe(PlatformSource.SHOPIFY);
    expect(normalizePlatformSource('WoOcOmMeRcE')).toBe(PlatformSource.WOOCOMMERCE);
  });
});
