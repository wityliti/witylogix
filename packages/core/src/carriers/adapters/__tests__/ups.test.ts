/**
 * UPS Carrier Adapter Tests
 * Comprehensive test suite for UPS shipping adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpsAdapter } from '../ups';
import { CarrierError } from '../../types';

describe('UpsAdapter', () => {
  let adapter: UpsAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    adapter = new UpsAdapter(
      'ups-client-id-12345',
      'ups-client-secret-67890',
      'testing'
    );
  });

  describe('OAuth2 Token Flow', () => {
    it('should obtain access token via OAuth2 client credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'ups-access-token-12345',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          RateResponse: {
            Response: { ResponseStatus: { Code: '1' } },
            RatedShipment: [],
          },
        }),
      });

      await adapter.getRates({
        origin: {
          name: 'Shipper',
          street1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        },
        destination: {
          name: 'Recipient',
          street1: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
        packages: [{ weight: 5, weightUnit: 'lb' }],
        shipDate: new Date().toISOString().split('T')[0],
      });

      const tokenCall = mockFetch.mock.calls[0];
      expect(tokenCall[0]).toContain('oauth');
      expect(tokenCall[1].method).toBe('POST');
    });

    it('should cache access token and reuse', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'cached-token',
          expires_in: 3600,
        }),
      });

      // First rate request
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          RateResponse: {
            Response: { ResponseStatus: { Code: '1' } },
            RatedShipment: [],
          },
        }),
      });

      // Second rate request
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          RateResponse: {
            Response: { ResponseStatus: { Code: '1' } },
            RatedShipment: [],
          },
        }),
      });

      const request = {
        origin: {
          name: 'Shipper',
          street1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        },
        destination: {
          name: 'Recipient',
          street1: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
        packages: [{ weight: 5, weightUnit: 'lb' }],
        shipDate: new Date().toISOString().split('T')[0],
      };

      await adapter.getRates(request);
      await adapter.getRates(request);

      // Should have 3 calls: token + 2 rate requests
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle OAuth2 token request failures', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(
        adapter.getRates({
          origin: {
            name: 'Shipper',
            street1: '123 Main St',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
          },
          destination: {
            name: 'Recipient',
            street1: '456 Oak Ave',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
          },
          packages: [{ weight: 5, weightUnit: 'lb' }],
          shipDate: new Date().toISOString().split('T')[0],
        })
      ).rejects.toThrow(CarrierError);
    });
  });

  describe('getRates()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token-123',
          expires_in: 3600,
        }),
      });
    });

    it('should parse rate response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          RateResponse: {
            Response: { ResponseStatus: { Code: '1' } },
            RatedShipment: [
              {
                Service: { Code: '03', Description: 'UPS Ground' },
                RatedPackage: { TotalCharges: { MonetaryValue: '22.50' } },
                GuaranteedDelivery: { BusinessDaysInTransit: '5' },
              },
              {
                Service: { Code: '02', Description: 'UPS 2nd Day Air' },
                RatedPackage: { TotalCharges: { MonetaryValue: '35.75' } },
                GuaranteedDelivery: { BusinessDaysInTransit: '2' },
              },
            ],
          },
        }),
      });

      const rates = await adapter.getRates({
        origin: {
          name: 'Shipper',
          street1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        },
        destination: {
          name: 'Recipient',
          street1: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
        packages: [{ weight: 5, weightUnit: 'lb' }],
        shipDate: '2024-03-15',
      });

      expect(rates).toHaveLength(2);
      expect(rates[0]).toEqual(
        expect.objectContaining({
          carrier: 'UPS',
          service: 'UPS Ground',
          serviceCode: '03',
          totalCharge: 22.50,
          estimatedTransitDays: 5,
        })
      );
    });

    it('should handle rate error response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          response: {
            errors: [{ message: 'Invalid address' }],
          },
        }),
      });

      await expect(
        adapter.getRates({
          origin: {
            name: 'Shipper',
            street1: '123 Main St',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
          },
          destination: {
            name: 'Recipient',
            street1: '456 Oak Ave',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
          },
          packages: [{ weight: 5, weightUnit: 'lb' }],
          shipDate: new Date().toISOString().split('T')[0],
        })
      ).rejects.toThrow(CarrierError);
    });
  });

  describe('createLabel()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token-123',
          expires_in: 3600,
        }),
      });
    });

    it('should create shipping label with base64 PDF', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          ShipmentResponse: {
            Response: { ResponseStatus: { Code: '1' } },
            ShipmentResults: {
              ShipmentIdentificationNumber: 'TRK123456789',
              PackageResults: [
                {
                  TrackingNumber: 'TRACK123',
                  ShippingLabel: {
                    GraphicImage: 'JVBERi0xLjQK...base64encodedPDF...',
                    ImageFormat: 'PDF',
                  },
                },
              ],
              ShipmentCharges: {
                TotalCharges: {
                  MonetaryValue: '22.50',
                },
              },
            },
          },
        }),
      });

      const label = await adapter.createLabel({
        origin: {
          name: 'Shipper',
          street1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
          phone: '5551234567',
        },
        destination: {
          name: 'Recipient',
          street1: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
        packages: [
          {
            weight: 5,
            weightUnit: 'lb',
            length: 12,
            width: 8,
            height: 6,
            dimensionUnit: 'in',
          },
        ],
        serviceCode: '03',
        shipDate: new Date().toISOString().split('T')[0],
      });

      expect(label).toEqual(
        expect.objectContaining({
          trackingNumber: 'TRK123456789',
          carrier: 'UPS',
          labelData: expect.any(String),
          labelFormat: 'PDF',
          cost: 22.50,
        })
      );
    });

    it('should handle label creation error', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          response: {
            errors: [{ message: 'Invalid recipient address' }],
          },
        }),
      });

      await expect(
        adapter.createLabel({
          origin: {
            name: 'Shipper',
            street1: '123 Main St',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
          },
          destination: {
            name: 'Recipient',
            street1: '456 Oak Ave',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
          },
          packages: [{ weight: 5, weightUnit: 'lb' }],
          serviceCode: '03',
        })
      ).rejects.toThrow(CarrierError);
    });
  });

  describe('voidLabel()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token-123',
          expires_in: 3600,
        }),
      });
    });

    it('should void shipment successfully', async () => {
      const result = await adapter.voidLabel('TRK123456789');

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          trackingNumber: 'TRK123456789',
          refund: expect.any(Number),
          voidedAt: expect.any(Date),
        })
      );
    });

    it('should reject invalid tracking number', async () => {
      await expect(adapter.voidLabel('INVALID')).rejects.toThrow(CarrierError);
      await expect(adapter.voidLabel('')).rejects.toThrow(CarrierError);
    });
  });

  describe('getTracking()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token-123',
          expires_in: 3600,
        }),
      });
    });

    it('should retrieve tracking with event parsing', async () => {
      const tracking = await adapter.getTracking('TRK123456789');

      expect(tracking).toEqual(
        expect.objectContaining({
          carrier: 'UPS',
          trackingNumber: 'TRK123456789',
          status: expect.any(String),
          delivered: expect.any(Boolean),
          events: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(Date),
              status: expect.any(String),
              description: expect.any(String),
              location: expect.objectContaining({
                city: expect.any(String),
                state: expect.any(String),
                country: expect.any(String),
              }),
            }),
          ]),
          estimatedDeliveryDate: expect.any(Date),
        })
      );
    });

    it('should reject invalid tracking number', async () => {
      await expect(adapter.getTracking('INVALID')).rejects.toThrow(CarrierError);
      await expect(adapter.getTracking('')).rejects.toThrow(CarrierError);
    });
  });

  describe('schedulePickup()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token-123',
          expires_in: 3600,
        }),
      });
    });

    it('should schedule pickup successfully', async () => {
      const pickup = await adapter.schedulePickup({
        location: {
          name: 'Warehouse',
          street1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
          phone: '5551234567',
        },
        pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timeWindow: {
          openTime: '09:00',
          closeTime: '17:00',
        },
        packageCount: 5,
        totalWeight: 25,
      });

      expect(pickup).toEqual(
        expect.objectContaining({
          pickupId: expect.any(String),
          pickupDate: expect.any(Date),
          confirmedAt: expect.any(Date),
          confirmationCode: expect.any(String),
          driverInfo: expect.objectContaining({
            name: expect.any(String),
            phone: expect.any(String),
          }),
        })
      );
    });

    it('should handle pickup scheduling errors', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          response: {
            errors: [{ message: 'Invalid address' }],
          },
        }),
      });

      await expect(
        adapter.schedulePickup({
          location: {
            name: 'Warehouse',
            street1: '123 Main St',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
          },
          pickupDate: new Date(),
        })
      ).rejects.toThrow(CarrierError);
    });
  });

  describe('validateAddress()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: 'token-123',
          expires_in: 3600,
        }),
      });
    });

    it('should validate address and return candidates', async () => {
      const result = await adapter.validateAddress({
        name: 'John Doe',
        street1: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'US',
      });

      expect(result).toEqual(
        expect.objectContaining({
          valid: expect.any(Boolean),
          address: expect.objectContaining({
            name: expect.any(String),
            street1: expect.any(String),
            city: expect.any(String),
            state: expect.any(String),
            postalCode: expect.any(String),
            country: expect.any(String),
          }),
          candidates: expect.arrayContaining([
            expect.objectContaining({
              street1: expect.any(String),
              city: expect.any(String),
              state: expect.any(String),
              postalCode: expect.any(String),
            }),
          ]),
        })
      );
    });

    it('should reject incomplete addresses', async () => {
      await expect(
        adapter.validateAddress({
          name: 'John',
          street1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '',
          country: 'US',
        })
      ).rejects.toThrow(CarrierError);
    });
  });

  describe('adapter properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('UPS');
    });

    it('should have correct carrier code', () => {
      expect(adapter.code).toBe('ups');
    });
  });
});
