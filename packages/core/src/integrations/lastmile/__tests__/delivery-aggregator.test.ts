import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeliveryAggregator } from '../delivery-aggregator';
import type { LastMileDelivery, Location } from '../types';

/**
 * Helper: create a URL-routing fetch mock that handles OAuth token calls
 * for Uber (sandbox.uber.com/oauth/...) and Grubhub (sandbox.grubhub.com/oauth/...).
 */
function createRoutingFetchMock(platformResponses: {
  doordash?: any;
  uber?: any;
  grubhub?: any;
}) {
  const tokenResponse = {
    access_token: 'test-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'test-refresh-token',
  };

  return vi.fn((url: string) => {
    // Handle OAuth token requests first
    if (url.includes('/oauth/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      } as Response);
    }

    if (url.includes('doordash') && platformResponses.doordash) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(platformResponses.doordash),
      } as Response);
    } else if (url.includes('uber') && platformResponses.uber) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(platformResponses.uber),
      } as Response);
    } else if (url.includes('grubhub') && platformResponses.grubhub) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(platformResponses.grubhub),
      } as Response);
    }
    return Promise.reject(new Error('Unknown URL: ' + url));
  });
}

describe('DeliveryAggregator', () => {
  let aggregator: DeliveryAggregator;

  beforeEach(() => {
    vi.clearAllMocks();

    aggregator = new DeliveryAggregator({
      doordash: {
        developer_id: 'test-dev-id',
        key_id: 'test-key-id',
        signing_secret: 'test-secret',
        webhook_secret: 'test-webhook-secret',
        enabled: true,
      },
      ubereats: {
        oauth_client_id: 'test-client-id',
        oauth_client_secret: 'test-client-secret',
        initial_token: 'test-token',
        webhook_secret: 'test-webhook-secret',
        enabled: true,
      },
      grubhub: {
        api_key: 'test-api-key',
        webhook_secret: 'test-webhook-secret',
        restaurant_id: 'test-restaurant-id',
        enabled: true,
      },
      sandbox_mode: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with all platforms enabled', () => {
      const platforms = aggregator.getEnabledPlatforms();

      expect(platforms).toContain('doordash');
      expect(platforms).toContain('ubereats');
      expect(platforms).toContain('grubhub');
      expect(platforms.length).toBe(3);
    });

    it('should show health status of all platforms', () => {
      const health = aggregator.getHealthStatus();

      expect(health.doordash).toBe(true);
      expect(health.ubereats).toBe(true);
      expect(health.grubhub).toBe(true);
    });

    it('should initialize metrics for each platform', async () => {
      const metrics = (await aggregator.getMetrics()) as Map<string, any>;

      expect(metrics.has('doordash')).toBe(true);
      expect(metrics.has('ubereats')).toBe(true);
      expect(metrics.has('grubhub')).toBe(true);
    });
  });

  describe('quote comparison', () => {
    it('should recommend cheapest platform when there is significant cost difference', async () => {
      global.fetch = createRoutingFetchMock({
        doordash: {
          quote_id: 'quote-dd',
          fee: 2000,
          currency: 'USD',
          expires_at_ms: Date.now() + 600000,
          estimated_duration_seconds: 1200,
          estimated_pickup_time_ms: Date.now() + 300000,
        },
        uber: {
          quote_id: 'quote-ue',
          fee: 1500,
          currency: 'USD',
          expires_at: new Date(Date.now() + 600000).toISOString(),
          estimated_duration_seconds: 900,
        },
        grubhub: {
          quote_id: 'quote-gh',
          delivery_fee: 1800,
          tax: 157,
          total: 1957,
          currency: 'USD',
          expires_at: new Date(Date.now() + 600000).toISOString(),
          estimated_delivery_time_minutes: 25,
        },
      }) as any;

      const pickup: Location = { latitude: 37.7749, longitude: -122.4194 };
      const dropoff: Location = { latitude: 37.7942, longitude: -122.3988 };

      const comparison = await aggregator.getQuote(pickup, dropoff);

      expect(comparison).toBeDefined();
      expect(comparison.recommended_platform).toBe('ubereats');
      expect(comparison.reason).toBe('cheapest');
      expect(comparison.ubereats).toBeDefined();
    });

    it('should return all available quotes', async () => {
      global.fetch = createRoutingFetchMock({
        doordash: {
          quote_id: 'quote-dd',
          fee: 2000,
          currency: 'USD',
          expires_at_ms: Date.now() + 600000,
          estimated_duration_seconds: 1200,
          estimated_pickup_time_ms: Date.now() + 300000,
        },
        uber: {
          quote_id: 'quote-ue',
          fee: 1500,
          currency: 'USD',
          expires_at: new Date(Date.now() + 600000).toISOString(),
          estimated_duration_seconds: 900,
        },
        grubhub: {
          quote_id: 'quote-gh',
          delivery_fee: 1800,
          tax: 157,
          total: 1957,
          currency: 'USD',
          expires_at: new Date(Date.now() + 600000).toISOString(),
          estimated_delivery_time_minutes: 25,
        },
      }) as any;

      const pickup: Location = { latitude: 37.7749, longitude: -122.4194 };
      const dropoff: Location = { latitude: 37.7942, longitude: -122.3988 };

      const comparison = await aggregator.getQuote(pickup, dropoff);

      expect(comparison.doordash).toBeDefined();
      expect(comparison.ubereats).toBeDefined();
      expect(comparison.grubhub).toBeDefined();
    });

    it('should recommend cheapest when all durations are equal', async () => {
      // All clients compute duration from coordinates (same for all platforms),
      // so the "fastest" recommendation can never trigger. The cheapest wins.
      global.fetch = createRoutingFetchMock({
        doordash: {
          quote_id: 'quote-dd',
          fee: 2000,
          currency: 'USD',
          expires_at_ms: Date.now() + 600000,
          estimated_duration_seconds: 600,
          estimated_pickup_time_ms: Date.now() + 300000,
        },
        uber: {
          quote_id: 'quote-ue',
          fee: 1500, // cheapest
          currency: 'USD',
          expires_at: new Date(Date.now() + 600000).toISOString(),
          estimated_duration_seconds: 1500,
        },
        grubhub: {
          quote_id: 'quote-gh',
          delivery_fee: 1800,
          tax: 157,
          total: 1957,
          currency: 'USD',
          expires_at: new Date(Date.now() + 600000).toISOString(),
          estimated_delivery_time_minutes: 30,
        },
      }) as any;

      const pickup: Location = { latitude: 37.7749, longitude: -122.4194 };
      const dropoff: Location = { latitude: 37.7942, longitude: -122.3988 };

      const comparison = await aggregator.getQuote(pickup, dropoff);

      // UberEats has the lowest fee (1500), so it's cheapest
      expect(comparison.recommended_platform).toBe('ubereats');
      expect(comparison.reason).toBe('cheapest');
    });
  });

  describe('delivery creation', () => {
    it('should create delivery on specified platform', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              delivery_id: 'dd-123',
              external_delivery_id: 'order-456',
              status: 'PENDING',
              pickup_address: { street_address: '123 Main St' },
              dropoff_address: { street_address: '456 Market St' },
              estimated_pickup_time_ms: Date.now(),
              estimated_dropoff_time_ms: Date.now() + 1200000,
              tracking_url: 'https://tracking.doordash.com/dd-123',
            }),
        } as Response)
      );

      const delivery: Partial<LastMileDelivery> = {
        pickup_location: { latitude: 37.7749, longitude: -122.4194, address: '123 Main St' },
        dropoff_location: { latitude: 37.7942, longitude: -122.3988, address: '456 Market St' },
        pickup_contact: { name: 'Restaurant', phone: '415-555-1234' },
        dropoff_contact: { name: 'John Doe', phone: '415-555-5678' },
      };

      const result = await aggregator.createDelivery('doordash', delivery);

      expect(result).toBeDefined();
      expect(result.platform).toBe('doordash');
    });

    it('should track delivery metrics on creation', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              delivery_id: 'dd-123',
              external_delivery_id: 'order-456',
              status: 'PENDING',
              pickup_address: { street_address: '123 Main St' },
              dropoff_address: { street_address: '456 Market St' },
              estimated_pickup_time_ms: Date.now(),
              estimated_dropoff_time_ms: Date.now() + 1200000,
              tracking_url: 'https://tracking.doordash.com/dd-123',
            }),
        } as Response)
      );

      const delivery: Partial<LastMileDelivery> = {
        pickup_location: { latitude: 37.7749, longitude: -122.4194, address: '123 Main St' },
        dropoff_location: { latitude: 37.7942, longitude: -122.3988, address: '456 Market St' },
        pickup_contact: { name: 'Restaurant', phone: '415-555-1234' },
        dropoff_contact: { name: 'John Doe', phone: '415-555-5678' },
      };

      await aggregator.createDelivery('doordash', delivery);

      const metrics = (await aggregator.getMetrics('doordash')) as any;
      expect(metrics.total_deliveries).toBe(1);
    });
  });

  describe('failover', () => {
    it('should failover to next platform on error', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('doordash')) {
          // First platform fails
          return Promise.reject(new Error('DoorDash API error'));
        }

        // Handle OAuth token requests for uber
        if (url.includes('/oauth/')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                access_token: 'test-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
              }),
          } as Response);
        }

        if (url.includes('uber')) {
          // Second platform succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                delivery_id: 'ue-123',
                external_delivery_id: 'order-456',
                status: 'PENDING',
                pickup: { latitude: 37.7749, longitude: -122.4194, address: '123 Main St', contact: {} },
                dropoff: { latitude: 37.7942, longitude: -122.3988, address: '456 Market St', contact: {} },
                estimated_pickup_time: new Date().toISOString(),
                estimated_dropoff_time: new Date(Date.now() + 1200000).toISOString(),
                tracking_url: 'https://tracking.ubereats.com/ue-123',
              }),
          } as Response);
        }

        return Promise.reject(new Error('Unknown platform'));
      }) as any;

      const delivery: Partial<LastMileDelivery> = {
        pickup_location: { latitude: 37.7749, longitude: -122.4194, address: '123 Main St' },
        dropoff_location: { latitude: 37.7942, longitude: -122.3988, address: '456 Market St' },
        pickup_contact: { name: 'Restaurant', phone: '415-555-1234' },
        dropoff_contact: { name: 'John Doe', phone: '415-555-5678' },
      };

      const result = await aggregator.failoverToNextPlatform('doordash', delivery);

      expect(result).toBeDefined();
      expect(result.platform).toBe('ubereats');
    });
  });

  describe('tracking', () => {
    it('should maintain unified tracking feed', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              delivery_id: 'dd-123',
              external_delivery_id: 'order-456',
              status: 'EN_ROUTE_TO_CONSUMER',
              pickup_address: { street_address: '123 Main St' },
              dropoff_address: { street_address: '456 Market St' },
              estimated_pickup_time_ms: Date.now(),
              estimated_dropoff_time_ms: Date.now() + 1200000,
              tracking_url: 'https://tracking.doordash.com/dd-123',
            }),
        } as Response)
      );

      await aggregator.getTracking('doordash', 'dd-123');

      const feed = await aggregator.getUnifiedTrackingFeed(10);

      expect(feed).toBeDefined();
      expect(Array.isArray(feed)).toBe(true);
    });
  });

  describe('commission analysis', () => {
    it('should calculate commission analysis across platforms', async () => {
      const analysis = await aggregator.getCommissionAnalysis();

      expect(analysis).toBeDefined();
      expect(analysis.by_platform).toBeDefined();
      expect(analysis.total).toBeGreaterThanOrEqual(0);
      expect(analysis.average_rate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      aggregator.clearCache();

      const feed = await aggregator.getUnifiedTrackingFeed();
      expect(feed.length).toBe(0);
    });
  });

  describe('platform health', () => {
    it('should report platform health status', () => {
      const health = aggregator.getHealthStatus();

      expect(health).toBeDefined();
      expect(typeof health.doordash).toBe('boolean');
      expect(typeof health.ubereats).toBe('boolean');
      expect(typeof health.grubhub).toBe('boolean');
    });
  });

  describe('sync operations', () => {
    it('should sync orders from specified platform', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              deliveries: [
                {
                  delivery_id: 'dd-123',
                  external_delivery_id: 'order-456',
                  status: 'DELIVERED',
                  pickup_address: { street_address: '123 Main St' },
                  dropoff_address: { street_address: '456 Market St' },
                  estimated_pickup_time_ms: Date.now(),
                  estimated_dropoff_time_ms: Date.now() + 1200000,
                  tracking_url: 'https://tracking.doordash.com/dd-123',
                },
              ],
            }),
        } as Response)
      );

      const deliveries = await aggregator.syncOrders('doordash');

      expect(deliveries).toBeDefined();
      expect(Array.isArray(deliveries)).toBe(true);
    });

    it('should list all deliveries across platforms', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              deliveries: [
                {
                  delivery_id: 'test-123',
                  external_delivery_id: 'order-456',
                  status: 'DELIVERED',
                  pickup_address: { street_address: '123 Main St' },
                  dropoff_address: { street_address: '456 Market St' },
                  estimated_pickup_time_ms: Date.now(),
                  estimated_dropoff_time_ms: Date.now() + 1200000,
                  tracking_url: 'https://tracking.test.com/test-123',
                },
              ],
            }),
        } as Response)
      );

      const deliveries = await aggregator.listAllDeliveries();

      expect(deliveries).toBeDefined();
      expect(Array.isArray(deliveries)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error when creating delivery on disabled platform', async () => {
      const disabled_aggregator = new DeliveryAggregator({
        sandbox_mode: true,
      });

      const delivery: Partial<LastMileDelivery> = {
        pickup_location: { latitude: 37.7749, longitude: -122.4194 },
        dropoff_location: { latitude: 37.7942, longitude: -122.3988 },
        pickup_contact: { name: 'Restaurant', phone: '415-555-1234' },
        dropoff_contact: { name: 'John Doe', phone: '415-555-5678' },
      };

      await expect(disabled_aggregator.createDelivery('doordash', delivery)).rejects.toThrow();
    });

    it('should continue with other platforms if one fails during sync', async () => {
      let call_count = 0;

      global.fetch = vi.fn((url: string) => {
        call_count++;

        if (url.includes('doordash')) {
          return Promise.reject(new Error('DoorDash error'));
        }

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orders: [],
            }),
        } as Response);
      });

      const deliveries = await aggregator.listAllDeliveries();

      expect(deliveries).toBeDefined();
      expect(Array.isArray(deliveries)).toBe(true);
    });
  });
});
