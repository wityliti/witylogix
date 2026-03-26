/**
 * Carrier Rate Engine Tests
 *
 * Tests for:
 * - Parallel rate fetching
 * - Ranking strategies (cheapest, fastest, best-value)
 * - Rate caching with TTL
 * - Timeout handling and partial results
 * - Per-tenant credential management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CarrierCode,
  RankingStrategy,
  type RateRequest,
  type ShippingRate,
} from '../shipping-types';
import {
  RateCache,
  CarrierCredentialManager,
  RateRanker,
  ParallelRateFetcher,
  type RateCacheConfig,
} from '../carrier-rate-engine';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockOrigin = {
  name: 'Warehouse',
  street1: '123 Main St',
  city: 'San Francisco',
  state: 'CA',
  zip: '94105',
  country: 'US',
};

const mockDestination = {
  name: 'Customer',
  street1: '456 Oak Ave',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  country: 'US',
};

const mockPackage = {
  weight: 5,
  weightUnit: 'lb' as const,
  length: 10,
  width: 8,
  height: 6,
  dimensionUnit: 'in' as const,
};

const createMockRateRequest = (): RateRequest => ({
  origin: mockOrigin,
  destination: mockDestination,
  packages: [mockPackage],
  shipDate: new Date(),
  currency: 'USD',
});

const createMockRates = (carrier: CarrierCode, count: number = 2): ShippingRate[] => {
  return Array.from({ length: count }, (_, i) => ({
    carrier,
    carrierName: carrier,
    service: `Service ${i + 1}`,
    serviceCode: `code_${i + 1}`,
    cost: 10 + i * 5,
    currency: 'USD',
    estimatedDays: 1 + i,
    deliveryDate: new Date(Date.now() + (1 + i) * 24 * 60 * 60 * 1000),
  }));
};

// ============================================================================
// RateCache Tests
// ============================================================================

describe('RateCache', () => {
  let cache: RateCache;

  beforeEach(() => {
    cache = new RateCache({ ttlMs: 5000, maxEntries: 10, enabled: true });
  });

  describe('Basic Operations', () => {
    it('should cache rates and retrieve them', () => {
      const request = createMockRateRequest();
      const rates = createMockRates(CarrierCode.UPS);

      cache.set(request, CarrierCode.UPS, rates);
      const cached = cache.get(request, CarrierCode.UPS);

      expect(cached).toEqual(rates);
    });

    it('should return undefined for cache miss', () => {
      const request = createMockRateRequest();

      const cached = cache.get(request, CarrierCode.UPS);

      expect(cached).toBeUndefined();
    });

    it('should return undefined if caching is disabled', () => {
      const disabledCache = new RateCache({ enabled: false });
      const request = createMockRateRequest();
      const rates = createMockRates(CarrierCode.UPS);

      disabledCache.set(request, CarrierCode.UPS, rates);
      const cached = disabledCache.get(request, CarrierCode.UPS);

      expect(cached).toBeUndefined();
    });

    it('should cache different carriers separately', () => {
      const request = createMockRateRequest();
      const upsRates = createMockRates(CarrierCode.UPS);
      const fedexRates = createMockRates(CarrierCode.FEDEX);

      cache.set(request, CarrierCode.UPS, upsRates);
      cache.set(request, CarrierCode.FEDEX, fedexRates);

      expect(cache.get(request, CarrierCode.UPS)).toEqual(upsRates);
      expect(cache.get(request, CarrierCode.FEDEX)).toEqual(fedexRates);
    });
  });

  describe('TTL Expiration', () => {
    it('should expire cached entries after TTL', async () => {
      const shortTtlCache = new RateCache({ ttlMs: 100, maxEntries: 10, enabled: true });
      const request = createMockRateRequest();
      const rates = createMockRates(CarrierCode.UPS);

      shortTtlCache.set(request, CarrierCode.UPS, rates);
      expect(shortTtlCache.get(request, CarrierCode.UPS)).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(shortTtlCache.get(request, CarrierCode.UPS)).toBeUndefined();
    });

    it('should not expire entries within TTL', () => {
      const request = createMockRateRequest();
      const rates = createMockRates(CarrierCode.UPS);

      cache.set(request, CarrierCode.UPS, rates);
      // Access immediately
      expect(cache.get(request, CarrierCode.UPS)).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should return cache statistics', () => {
      const request = createMockRateRequest();
      const rates = createMockRates(CarrierCode.UPS);

      cache.set(request, CarrierCode.UPS, rates);

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.maxEntries).toBe(10);
      expect(stats.enabled).toBe(true);
    });

    it('should clear all cache entries', () => {
      const request = createMockRateRequest();
      const rates = createMockRates(CarrierCode.UPS);

      cache.set(request, CarrierCode.UPS, rates);
      cache.clear();

      expect(cache.get(request, CarrierCode.UPS)).toBeUndefined();
    });

    it('should evict old entries when max capacity reached', () => {
      const smallCache = new RateCache({ ttlMs: 5000, maxEntries: 2, enabled: true });
      const request1 = createMockRateRequest();
      const request2 = { ...createMockRateRequest(), destination: { ...mockDestination, zip: '10002' } };
      const request3 = { ...createMockRateRequest(), destination: { ...mockDestination, zip: '10003' } };

      const rates = createMockRates(CarrierCode.UPS);

      smallCache.set(request1, CarrierCode.UPS, rates);
      smallCache.set(request2, CarrierCode.UPS, rates);
      smallCache.set(request3, CarrierCode.UPS, rates);

      // First entry should be evicted
      expect(smallCache.getStats().size).toBeLessThanOrEqual(2);
    });
  });
});

// ============================================================================
// CarrierCredentialManager Tests
// ============================================================================

describe('CarrierCredentialManager', () => {
  let manager: CarrierCredentialManager;

  beforeEach(() => {
    manager = new CarrierCredentialManager();
  });

  describe('Credential Storage', () => {
    it('should store and retrieve credentials', () => {
      const creds = {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key' as const,
        apiKey: 'sk_test_' + 'FAKE_UPS_KEY',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      manager.storeCredentials('tenant_1', CarrierCode.UPS, creds);
      const retrieved = manager.getCredentials('tenant_1', CarrierCode.UPS);

      expect(retrieved).toEqual(creds);
    });

    it('should return undefined for missing credentials', () => {
      const retrieved = manager.getCredentials('tenant_1', CarrierCode.UPS);

      expect(retrieved).toBeUndefined();
    });

    it('should return undefined for inactive credentials', () => {
      const inactiveCreds = {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key' as const,
        apiKey: 'sk_test_' + 'FAKE_KEY',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      manager.storeCredentials('tenant_1', CarrierCode.UPS, inactiveCreds);
      const retrieved = manager.getCredentials('tenant_1', CarrierCode.UPS);

      expect(retrieved).toBeUndefined();
    });
  });

  describe('Credential Management', () => {
    it('should check if credentials exist', () => {
      const creds = {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key' as const,
        apiKey: 'sk_test_' + 'FAKE_KEY',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(manager.hasCredentials('tenant_1', CarrierCode.UPS)).toBe(false);

      manager.storeCredentials('tenant_1', CarrierCode.UPS, creds);

      expect(manager.hasCredentials('tenant_1', CarrierCode.UPS)).toBe(true);
    });

    it('should list carriers for a tenant', () => {
      const upsCreds = {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fedexCreds = {
        carrier: CarrierCode.FEDEX,
        tenantId: 'tenant_1',
        authMethod: 'api_key' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      manager.storeCredentials('tenant_1', CarrierCode.UPS, upsCreds);
      manager.storeCredentials('tenant_1', CarrierCode.FEDEX, fedexCreds);

      const carriers = manager.listCarriers('tenant_1');

      expect(carriers).toContain(CarrierCode.UPS);
      expect(carriers).toContain(CarrierCode.FEDEX);
      expect(carriers.length).toBe(2);
    });

    it('should remove credentials', () => {
      const creds = {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      manager.storeCredentials('tenant_1', CarrierCode.UPS, creds);
      expect(manager.hasCredentials('tenant_1', CarrierCode.UPS)).toBe(true);

      manager.removeCredentials('tenant_1', CarrierCode.UPS);

      expect(manager.hasCredentials('tenant_1', CarrierCode.UPS)).toBe(false);
    });

    it('should clear all credentials for a tenant', () => {
      const upsCreds = {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fedexCreds = {
        carrier: CarrierCode.FEDEX,
        tenantId: 'tenant_1',
        authMethod: 'api_key' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      manager.storeCredentials('tenant_1', CarrierCode.UPS, upsCreds);
      manager.storeCredentials('tenant_1', CarrierCode.FEDEX, fedexCreds);

      manager.clearTenantCredentials('tenant_1');

      expect(manager.listCarriers('tenant_1')).toHaveLength(0);
    });
  });
});

// ============================================================================
// RateRanker Tests
// ============================================================================

describe('RateRanker', () => {
  describe('Cheapest Strategy', () => {
    it('should rank by lowest cost', () => {
      const rates: ShippingRate[] = [
        {
          carrier: CarrierCode.UPS,
          carrierName: 'UPS',
          service: 'Ground',
          serviceCode: 'ground',
          cost: 15,
          currency: 'USD',
          estimatedDays: 3,
        },
        {
          carrier: CarrierCode.FEDEX,
          carrierName: 'FedEx',
          service: 'Ground',
          serviceCode: 'ground',
          cost: 10,
          currency: 'USD',
          estimatedDays: 4,
        },
        {
          carrier: CarrierCode.DHL,
          carrierName: 'DHL',
          service: 'Ground',
          serviceCode: 'ground',
          cost: 20,
          currency: 'USD',
          estimatedDays: 5,
        },
      ];

      const ranked = RateRanker.rank(rates, RankingStrategy.CHEAPEST);

      expect(ranked[0].cost).toBe(10);
      expect(ranked[1].cost).toBe(15);
      expect(ranked[2].cost).toBe(20);
    });
  });

  describe('Fastest Strategy', () => {
    it('should rank by fastest delivery', () => {
      const rates: ShippingRate[] = [
        {
          carrier: CarrierCode.UPS,
          carrierName: 'UPS',
          service: 'Ground',
          serviceCode: 'ground',
          cost: 15,
          currency: 'USD',
          estimatedDays: 3,
        },
        {
          carrier: CarrierCode.FEDEX,
          carrierName: 'FedEx',
          service: 'Overnight',
          serviceCode: 'overnight',
          cost: 30,
          currency: 'USD',
          estimatedDays: 1,
        },
        {
          carrier: CarrierCode.DHL,
          carrierName: 'DHL',
          service: 'Ground',
          serviceCode: 'ground',
          cost: 20,
          currency: 'USD',
          estimatedDays: 5,
        },
      ];

      const ranked = RateRanker.rank(rates, RankingStrategy.FASTEST);

      expect(ranked[0].estimatedDays).toBe(1);
      expect(ranked[1].estimatedDays).toBe(3);
      expect(ranked[2].estimatedDays).toBe(5);
    });
  });

  describe('Best Value Strategy', () => {
    it('should rank by best value (cost × speed weighted)', () => {
      const rates: ShippingRate[] = [
        {
          carrier: CarrierCode.UPS,
          carrierName: 'UPS',
          service: 'Ground',
          serviceCode: 'ground',
          cost: 10,
          currency: 'USD',
          estimatedDays: 5,
        },
        {
          carrier: CarrierCode.FEDEX,
          carrierName: 'FedEx',
          service: 'Overnight',
          serviceCode: 'overnight',
          cost: 30,
          currency: 'USD',
          estimatedDays: 1,
        },
        {
          carrier: CarrierCode.DHL,
          carrierName: 'DHL',
          service: '2-Day',
          serviceCode: '2day',
          cost: 20,
          currency: 'USD',
          estimatedDays: 2,
        },
      ];

      const ranked = RateRanker.rank(rates, RankingStrategy.BEST_VALUE);

      // DHL should rank highest (best value: moderate cost + good speed)
      expect(ranked[0].carrier).toBe(CarrierCode.DHL);
      expect(ranked[0].rankingScore).toBeDefined();
      expect(typeof ranked[0].rankingScore).toBe('number');
    });

    it('should assign ranking scores', () => {
      const rates = createMockRates(CarrierCode.UPS, 3);

      const ranked = RateRanker.rank(rates, RankingStrategy.BEST_VALUE);

      ranked.forEach((rate) => {
        expect(rate.rankingScore).toBeDefined();
        expect(typeof rate.rankingScore).toBe('number');
      });
    });
  });
});

// ============================================================================
// ParallelRateFetcher Tests
// ============================================================================

describe('ParallelRateFetcher', () => {
  let fetcher: ParallelRateFetcher;
  let credentialManager: CarrierCredentialManager;

  beforeEach(() => {
    credentialManager = new CarrierCredentialManager();
    fetcher = new ParallelRateFetcher({ ttlMs: 5000, enabled: true }, credentialManager);
  });

  describe('Mock Carrier Registration', () => {
    it('should register and use mock carriers', async () => {
      const upsRates = createMockRates(CarrierCode.UPS, 2);
      const fedexRates = createMockRates(CarrierCode.FEDEX, 2);

      fetcher.registerMockCarrier(CarrierCode.UPS, async () => upsRates);
      fetcher.registerMockCarrier(CarrierCode.FEDEX, async () => fedexRates);

      // Setup credentials
      credentialManager.storeCredentials('tenant_1', CarrierCode.UPS, {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      credentialManager.storeCredentials('tenant_1', CarrierCode.FEDEX, {
        carrier: CarrierCode.FEDEX,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRateRequest();

      const response = await fetcher.fetchRates(request, 'tenant_1');

      expect(response.rates.length).toBeGreaterThan(0);
      expect(response.rates.length).toBe(4); // 2 from UPS + 2 from FedEx
      expect(response.failedCarriers).toHaveLength(0);
    });
  });

  describe('Parallel Fetching', () => {
    it('should fetch from multiple carriers in parallel', async () => {
      const mockFns = {
        [CarrierCode.UPS]: vi.fn(async () => createMockRates(CarrierCode.UPS, 2)),
        [CarrierCode.FEDEX]: vi.fn(async () => createMockRates(CarrierCode.FEDEX, 2)),
        [CarrierCode.DHL]: vi.fn(async () => createMockRates(CarrierCode.DHL, 2)),
      };

      fetcher.registerMockCarrier(CarrierCode.UPS, mockFns[CarrierCode.UPS]);
      fetcher.registerMockCarrier(CarrierCode.FEDEX, mockFns[CarrierCode.FEDEX]);
      fetcher.registerMockCarrier(CarrierCode.DHL, mockFns[CarrierCode.DHL]);

      credentialManager.storeCredentials('tenant_1', CarrierCode.UPS, {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      credentialManager.storeCredentials('tenant_1', CarrierCode.FEDEX, {
        carrier: CarrierCode.FEDEX,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      credentialManager.storeCredentials('tenant_1', CarrierCode.DHL, {
        carrier: CarrierCode.DHL,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRateRequest();

      const response = await fetcher.fetchRates(request, 'tenant_1');

      expect(response.rates.length).toBe(6); // 2 from each carrier
      expect(mockFns[CarrierCode.UPS]).toHaveBeenCalled();
      expect(mockFns[CarrierCode.FEDEX]).toHaveBeenCalled();
      expect(mockFns[CarrierCode.DHL]).toHaveBeenCalled();
    });
  });

  describe('Rate Caching', () => {
    it('should cache rates and return from cache on subsequent requests', async () => {
      const mockFn = vi.fn(async () => createMockRates(CarrierCode.UPS, 2));

      fetcher.registerMockCarrier(CarrierCode.UPS, mockFn);

      credentialManager.storeCredentials('tenant_1', CarrierCode.UPS, {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRateRequest();

      // First request should call mock function
      await fetcher.fetchRates(request, 'tenant_1');
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Second request should use cache
      await fetcher.fetchRates(request, 'tenant_1');
      expect(mockFn).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('Partial Results', () => {
    it('should return partial results if some carriers fail', async () => {
      fetcher.registerMockCarrier(CarrierCode.UPS, async () => createMockRates(CarrierCode.UPS, 2));
      fetcher.registerMockCarrier(CarrierCode.FEDEX, async () => {
        throw new Error('FedEx API error');
      });

      credentialManager.storeCredentials('tenant_1', CarrierCode.UPS, {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      credentialManager.storeCredentials('tenant_1', CarrierCode.FEDEX, {
        carrier: CarrierCode.FEDEX,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRateRequest();

      const response = await fetcher.fetchRates(request, 'tenant_1');

      expect(response.rates.length).toBe(2); // Only UPS rates
      expect(response.failedCarriers.length).toBe(1); // FedEx failed
      expect(response.failedCarriers[0].carrier).toBe(CarrierCode.FEDEX);
    });
  });

  describe('Ranking', () => {
    it('should rank results by strategy', async () => {
      fetcher.registerMockCarrier(CarrierCode.UPS, async () => [
        {
          carrier: CarrierCode.UPS,
          carrierName: 'UPS',
          service: 'Ground',
          serviceCode: 'ground',
          cost: 20,
          currency: 'USD',
          estimatedDays: 3,
        },
      ]);

      fetcher.registerMockCarrier(CarrierCode.FEDEX, async () => [
        {
          carrier: CarrierCode.FEDEX,
          carrierName: 'FedEx',
          service: 'Overnight',
          serviceCode: 'overnight',
          cost: 40,
          currency: 'USD',
          estimatedDays: 1,
        },
      ]);

      credentialManager.storeCredentials('tenant_1', CarrierCode.UPS, {
        carrier: CarrierCode.UPS,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      credentialManager.storeCredentials('tenant_1', CarrierCode.FEDEX, {
        carrier: CarrierCode.FEDEX,
        tenantId: 'tenant_1',
        authMethod: 'api_key',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRateRequest();

      // Clear cache for fresh ranking
      fetcher.clearCache();

      const response = await fetcher.fetchRates(request, 'tenant_1', RankingStrategy.CHEAPEST);

      expect(response.rates.length).toBe(2);
      expect(response.rates[0].cost).toBeLessThanOrEqual(response.rates[1].cost);
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', () => {
      const stats = fetcher.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxEntries');
      expect(stats).toHaveProperty('enabled');
    });

    it('should clear cache', () => {
      fetcher.clearCache();

      const stats = fetcher.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});
