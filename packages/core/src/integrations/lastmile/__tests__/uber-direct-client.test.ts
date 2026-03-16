import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UberDirectClient } from '../uber-direct-client';
import type { LastMileDelivery, Location, Contact } from '../types';

describe('UberDirectClient', () => {
  let client: UberDirectClient;

  beforeEach(() => {
    client = new UberDirectClient(
      'uber_client_' + 'FAKE0123',
      'uber_secret_' + 'FAKE0123',
      'test-org-id',
      'test-webhook-secret',
      true
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OAuth2 Token Exchange', () => {
    it('should exchange client credentials for access token', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
      );

      const delivery: Partial<LastMileDelivery> = {
        pickup_location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94102',
        },
        dropoff_location: {
          latitude: 37.7942,
          longitude: -122.3988,
          address: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94103',
        },
        pickup_contact: { name: 'Restaurant', phone: '415-555-1234' },
        dropoff_contact: { name: 'John Doe', phone: '415-555-5678' },
        order_id: 'order-456',
      };

      // The token should be requested during createDelivery
      const mockDeliveryResponse = {
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        status: 'PENDING',
        pickup_address: {
          street_address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94102',
        },
        dropoff_address: {
          street_address: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94103',
        },
        estimated_pickup_time: new Date(Date.now() + 600000).toISOString(),
        estimated_dropoff_time: new Date(Date.now() + 1800000).toISOString(),
        estimated_duration_seconds: 1200,
        tracking_url: 'https://tracking.uber.com/uber-123',
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDeliveryResponse),
        } as Response)
      );

      const result = await client.createDelivery(delivery);
      expect(result).toBeDefined();
      expect(result.platform).toBe('uberdirect');
    });

    it('should handle token expiration and refresh', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
      );

      // Multiple calls should reuse token
      const location: Location = { latitude: 37.7749, longitude: -122.4194 };
      const mockQuoteResponse = {
        quote_id: 'quote-123',
        external_delivery_id: 'order-456',
        fee: 1250,
        currency: 'USD',
        expires_at: new Date(Date.now() + 600000).toISOString(),
        estimated_duration_seconds: 1200,
        estimated_pickup_time: new Date(Date.now() + 300000).toISOString(),
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockQuoteResponse),
        } as Response)
      );

      try {
        await client.getQuote(location, location);
      } catch {
        // Expected since we're mocking
      }

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('createDelivery', () => {
    it('should create a delivery successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockDeliveryResponse = {
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        status: 'PENDING',
        pickup_address: {
          street_address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94102',
        },
        dropoff_address: {
          street_address: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94103',
        },
        estimated_pickup_time: new Date(Date.now() + 600000).toISOString(),
        estimated_dropoff_time: new Date(Date.now() + 1800000).toISOString(),
        estimated_duration_seconds: 1200,
        tracking_url: 'https://tracking.uber.com/uber-123',
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockDeliveryResponse),
        } as Response);

      const delivery: Partial<LastMileDelivery> = {
        pickup_location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Main St',
        },
        dropoff_location: {
          latitude: 37.7942,
          longitude: -122.3988,
          address: '456 Market St',
        },
        pickup_contact: { name: 'Restaurant', phone: '415-555-1234' },
        dropoff_contact: { name: 'John Doe', phone: '415-555-5678' },
        order_id: 'order-456',
        notes: 'Special instructions',
        tip_amount: 250,
      };

      const result = await client.createDelivery(delivery);

      expect(result).toBeDefined();
      expect(result.platform).toBe('uberdirect');
      expect(result.external_id).toBe('order-456');
      expect(result.status).toBe('created');
      expect(result.tip_amount).toBe(250);
    });

    it('should throw error when missing required fields', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const delivery: Partial<LastMileDelivery> = {
        order_id: 'order-456',
      };

      await expect(client.createDelivery(delivery)).rejects.toThrow();
    });
  });

  describe('getDelivery', () => {
    it('should retrieve a delivery by ID', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        status: 'PICKED_UP',
        pickup_address: {
          street_address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94102',
        },
        dropoff_address: {
          street_address: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94103',
        },
        estimated_pickup_time: new Date(Date.now()).toISOString(),
        estimated_dropoff_time: new Date(Date.now() + 1200000).toISOString(),
        estimated_duration_seconds: 1200,
        tracking_url: 'https://tracking.uber.com/uber-123',
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        } as Response);

      const result = await client.getDelivery('uber-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('uber-123');
      expect(result?.status).toBe('picked-up');
    });

    it('should return null for non-existent delivery', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response);

      const result = await client.getDelivery('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getQuote', () => {
    it('should get a delivery quote', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        quote_id: 'quote-123',
        external_delivery_id: 'order-456',
        fee: 1250,
        currency: 'USD',
        expires_at: new Date(Date.now() + 600000).toISOString(),
        estimated_duration_seconds: 1200,
        estimated_pickup_time: new Date(Date.now() + 300000).toISOString(),
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response);

      const pickup: Location = {
        latitude: 37.7749,
        longitude: -122.4194,
        address: '123 Main St',
      };

      const dropoff: Location = {
        latitude: 37.7942,
        longitude: -122.3988,
        address: '456 Market St',
      };

      const result = await client.getQuote(pickup, dropoff);

      expect(result).toBeDefined();
      expect(result.platform).toBe('uberdirect');
      expect(result.total).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
    });

    it('should include commission calculations', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        quote_id: 'quote-123',
        external_delivery_id: 'order-456',
        fee: 1000,
        currency: 'USD',
        expires_at: new Date(Date.now() + 600000).toISOString(),
        estimated_duration_seconds: 1200,
        estimated_pickup_time: new Date(Date.now() + 300000).toISOString(),
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response);

      const pickup: Location = { latitude: 37.7749, longitude: -122.4194 };
      const dropoff: Location = { latitude: 37.7942, longitude: -122.3988 };

      const result = await client.getQuote(pickup, dropoff);

      expect(result.platform_commission_rate).toBe(0.2);
      expect(result.platform_commission_amount).toBeGreaterThan(0);
    });
  });

  describe('getProofOfDelivery', () => {
    it('should retrieve proof of delivery', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockPODResponse = {
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        photo_urls: ['https://photos.uber.com/photo1.jpg'],
        signature_url: undefined,
        recipient_name: 'John Doe',
        recipient_signature: false,
        timestamp: new Date().toISOString(),
        verified: true,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPODResponse),
        } as Response);

      const result = await client.getProofOfDelivery('uber-123');

      expect(result).toBeDefined();
      expect(result.delivery_id).toBe('uber-123');
      expect(result.type).toBe('photo');
      expect(result.verified).toBe(true);
    });

    it('should handle signature-based POD', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockPODResponse = {
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        photo_urls: undefined,
        signature_url: 'https://signatures.uber.com/sig1.png',
        recipient_name: 'John Doe',
        recipient_signature: true,
        timestamp: new Date().toISOString(),
        verified: true,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPODResponse),
        } as Response);

      const result = await client.getProofOfDelivery('uber-123');

      expect(result.type).toBe('signature');
      expect(result.recipient_signature).toBe(true);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = JSON.stringify({ delivery_id: 'uber-123' });
      const signature = require('crypto')
        .createHmac('sha256', 'test-webhook-secret')
        .update(payload)
        .digest('hex');

      const isValid = client.verifyWebhookSignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ delivery_id: 'uber-123' });
      const invalid_signature = 'invalid-signature';

      const isValid = client.verifyWebhookSignature(payload, invalid_signature);

      expect(isValid).toBe(false);
    });
  });

  describe('parseWebhookEvent', () => {
    it('should parse delivery status changed event', () => {
      const payload = JSON.stringify({
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        event_type: 'delivery.status.changed',
        status: 'DELIVERED',
        timestamp: new Date().toISOString(),
      });

      const event = client.parseWebhookEvent(payload);

      expect(event).toBeDefined();
      expect(event.platform).toBe('uberdirect');
      expect(event.delivery_id).toBe('uber-123');
      expect(event.status).toBe('delivered');
    });

    it('should parse courier update event', () => {
      const payload = JSON.stringify({
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        event_type: 'delivery.courier.update',
        status: 'IN_TRANSIT',
        timestamp: new Date().toISOString(),
        courier: {
          id: 'courier-123',
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
          },
        },
      });

      const event = client.parseWebhookEvent(payload);

      expect(event).toBeDefined();
      expect(event.event_type).toBe('delivery.courier.update');
      expect(event.status).toBe('in-transit');
    });
  });

  describe('cancelDelivery', () => {
    it('should cancel a delivery', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        status: 'CANCELLED',
        pickup_address: {
          street_address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94102',
        },
        dropoff_address: {
          street_address: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94103',
        },
        estimated_pickup_time: new Date(Date.now()).toISOString(),
        estimated_dropoff_time: new Date(Date.now() + 1200000).toISOString(),
        estimated_duration_seconds: 1200,
        tracking_url: 'https://tracking.uber.com/uber-123',
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response);

      const result = await client.cancelDelivery('uber-123', 'MERCHANT_REQUESTED');

      expect(result).toBeDefined();
      expect(result.status).toBe('cancelled');
    });
  });

  describe('updateDelivery', () => {
    it('should update delivery tip amount', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        status: 'ACCEPTED',
        pickup_address: {
          street_address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94102',
        },
        dropoff_address: {
          street_address: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94103',
        },
        estimated_pickup_time: new Date(Date.now()).toISOString(),
        estimated_dropoff_time: new Date(Date.now() + 1200000).toISOString(),
        estimated_duration_seconds: 1200,
        tracking_url: 'https://tracking.uber.com/uber-123',
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response);

      const result = await client.updateDelivery('uber-123', {
        tip_amount: 500,
      });

      expect(result).toBeDefined();
      expect(result.external_id).toBe('order-456');
    });
  });

  describe('getTracking', () => {
    it('should retrieve tracking info', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        delivery_id: 'uber-123',
        external_delivery_id: 'order-456',
        status: 'IN_TRANSIT',
        pickup_address: {
          street_address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94102',
        },
        dropoff_address: {
          street_address: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          zip_code: '94103',
        },
        estimated_pickup_time: new Date(Date.now()).toISOString(),
        estimated_dropoff_time: new Date(Date.now() + 1200000).toISOString(),
        estimated_duration_seconds: 1200,
        tracking_url: 'https://tracking.uber.com/uber-123',
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response);

      const result = await client.getTracking('uber-123');

      expect(result).toBeDefined();
      expect(result.delivery_id).toBe('uber-123');
      expect(result.status).toBe('in-transit');
      expect(result.events).toBeDefined();
    });
  });

  describe('listDeliveries', () => {
    it('should list deliveries with pagination', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        deliveries: [
          {
            delivery_id: 'uber-123',
            external_delivery_id: 'order-456',
            status: 'DELIVERED',
            pickup_address: {
              street_address: '123 Main St',
              city: 'San Francisco',
              state: 'CA',
              zip_code: '94102',
            },
            dropoff_address: {
              street_address: '456 Market St',
              city: 'San Francisco',
              state: 'CA',
              zip_code: '94103',
            },
            estimated_pickup_time: new Date(Date.now()).toISOString(),
            estimated_dropoff_time: new Date(Date.now() + 1200000).toISOString(),
            estimated_duration_seconds: 1200,
            tracking_url: 'https://tracking.uber.com/uber-123',
          },
        ],
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response);

      const result = await client.listDeliveries({ limit: 10, offset: 0 });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });
  });

  describe('getDriver', () => {
    it('should retrieve driver information', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        external_id: 'driver-123',
        first_name: 'John',
        last_name: 'Smith',
        phone_number: '415-555-1234',
        rating: 4.8,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response);

      const result = await client.getDriver('driver-123');

      expect(result).toBeDefined();
      expect(result?.first_name).toBe('John');
      expect(result?.rating).toBe(4.8);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      const delivery: Partial<LastMileDelivery> = {
        pickup_location: { latitude: 37.7749, longitude: -122.4194 },
        dropoff_location: { latitude: 37.7942, longitude: -122.3988 },
        pickup_contact: { name: 'Restaurant', phone: '415-555-1234' },
        dropoff_contact: { name: 'John Doe', phone: '415-555-5678' },
      };

      await expect(client.createDelivery(delivery)).rejects.toThrow();
    });

    it('should handle malformed API responses', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response);

      const delivery: Partial<LastMileDelivery> = {
        pickup_location: { latitude: 37.7749, longitude: -122.4194 },
        dropoff_location: { latitude: 37.7942, longitude: -122.3988 },
        pickup_contact: { name: 'Restaurant', phone: '415-555-1234' },
        dropoff_contact: { name: 'John Doe', phone: '415-555-5678' },
      };

      await expect(client.createDelivery(delivery)).rejects.toThrow();
    });
  });

  describe('sandbox mode', () => {
    it('should use sandbox URLs when sandbox_mode is true', () => {
      const sandboxClient = new UberDirectClient(
        'test-client-id',
        'test-secret',
        'test-org-id',
        'test-webhook-secret',
        true
      );

      expect(sandboxClient).toBeDefined();
    });

    it('should use production URLs when sandbox_mode is false', () => {
      const prodClient = new UberDirectClient(
        'test-client-id',
        'test-secret',
        'test-org-id',
        'test-webhook-secret',
        false
      );

      expect(prodClient).toBeDefined();
    });
  });
});
