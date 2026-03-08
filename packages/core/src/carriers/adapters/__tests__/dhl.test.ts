/**
 * DHL Carrier Adapter Tests
 * Comprehensive test suite for DHL Express shipping adapter
 * Tests: rates, label generation, void, tracking, pickups, address validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DhlAdapter } from '../dhl';
import { CarrierError } from '../../types';

describe('DhlAdapter', () => {
  let adapter: DhlAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    adapter = new DhlAdapter(
      'dhl-api-key-12345',
      'dhl-client-id',
      'dhl-password',
      'DHL-ACCOUNT-123',
      'https://express.api.dhl.com'
    );
  });

  describe('Basic Auth Header Construction', () => {
    it('should use API key header when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          products: [{
            productCode: 'P',
            basePrice: 20.00,
            totalPrice: 22.50,
          }],
          currency: 'USD',
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

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers['DHL-API-Key']).toBe('dhl-api-key-12345');
    });

    it('should fall back to Basic Auth when no API key', async () => {
      const adapterNoKey = new DhlAdapter(
        '',
        'client-id',
        'client-password',
        'ACCOUNT-123',
        'https://express.api.dhl.com'
      );

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          products: [{
            productCode: 'P',
            basePrice: 20.00,
            totalPrice: 22.50,
          }],
          currency: 'USD',
        }),
      });

      await adapterNoKey.getRates({
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

      const call = mockFetch.mock.calls[0];
      const authHeader = call[1].headers['Authorization'];
      expect(authHeader).toContain('Basic ');
    });
  });

  describe('getRates()', () => {
    it('should parse DHL rate response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          products: [
            {
              productCode: 'P',
              basePrice: 20.00,
              totalPrice: 22.50,
              surcharges: [
                { type: 'Fuel Surcharge', amount: 2.50 },
              ],
            },
            {
              productCode: 'N',
              basePrice: 35.00,
              totalPrice: 38.50,
              surcharges: [],
            },
          ],
          currency: 'USD',
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
        shipDate: '2026-03-15',
      });

      expect(rates).toHaveLength(2);
      expect(rates[0]).toEqual(
        expect.objectContaining({
          carrier: 'DHL Express',
          service: 'DHL PARCEL',
          serviceCode: 'P',
          totalCharge: 22.50,
          currency: 'USD',
          estimatedTransitDays: 5,
          guaranteedDelivery: false,
          breakdown: expect.arrayContaining([
            expect.objectContaining({ description: 'Base Rate', amount: 20.00 }),
            expect.objectContaining({ description: 'Fuel Surcharge', amount: 2.50 }),
          ]),
        })
      );

      expect(rates[1]).toEqual(
        expect.objectContaining({
          serviceCode: 'N',
          service: 'DHL Next Day 10:30 AM',
          estimatedTransitDays: 1,
          guaranteedDelivery: true,
        })
      );
    });

    it('should handle rate lookup errors (4xx/5xx)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Invalid address provided',
          code: 'INVALID_ADDRESS',
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

    it('should handle 401 Unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Unauthorized',
          code: 'AUTH_ERROR',
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
      ).rejects.toThrow();
    });

    it('should handle 429 Rate Limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Rate limit exceeded',
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
      ).rejects.toThrow();
    });

    it('should handle 500 Server error', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Internal server error',
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
      ).rejects.toThrow();
    });
  });

  describe('createLabel()', () => {
    it('should create shipping label with tracking number and label data', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          shipmentIdentificationNumber: '1234567890123',
          label: {
            content: 'JVBERi0xLjQK...base64encodedPDF...',
            format: 'PDF',
          },
          shipmentDetails: {
            charges: {
              totalCharge: 28.99,
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
          email: 'shipper@example.com',
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
            description: 'Electronics package',
          },
        ],
        serviceCode: 'P',
        shipDate: new Date().toISOString().split('T')[0],
      });

      expect(label).toEqual(
        expect.objectContaining({
          trackingNumber: '1234567890123',
          carrier: 'DHL Express',
          service: 'DHL PARCEL',
          labelData: expect.any(String),
          labelFormat: 'PDF',
          cost: 28.99,
          currency: 'USD',
          barcode: '1234567890123',
        })
      );
    });

    it('should extract tracking number from label response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          shipmentIdentificationNumber: '9876543210987',
          label: {
            content: 'base64labeldata',
          },
          shipmentDetails: {
            charges: {
              totalCharge: 35.50,
            },
          },
        }),
      });

      const label = await adapter.createLabel({
        origin: {
          name: 'Shipper',
          street1: '100 Oak St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94102',
          country: 'US',
        },
        destination: {
          name: 'Recipient',
          street1: '200 Elm St',
          city: 'Boston',
          state: 'MA',
          postalCode: '02101',
          country: 'US',
        },
        packages: [{ weight: 3, weightUnit: 'lb' }],
        serviceCode: 'N',
        shipDate: new Date().toISOString().split('T')[0],
      });

      expect(label.trackingNumber).toBe('9876543210987');
    });

    it('should handle label creation error', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Invalid recipient address',
          code: 'INVALID_ADDRESS',
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
          serviceCode: 'P',
        })
      ).rejects.toThrow(CarrierError);
    });
  });

  describe('voidLabel()', () => {
    it('should void shipment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          refundAmount: 28.99,
          message: 'Shipment cancelled',
        }),
      });

      const result = await adapter.voidLabel('1234567890123');

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          trackingNumber: '1234567890123',
          refund: expect.any(Number),
          currency: 'USD',
          voidedAt: expect.any(Date),
          message: 'DHL shipment successfully cancelled',
        })
      );
    });

    it('should reject invalid tracking number (too short)', async () => {
      await expect(adapter.voidLabel('SHORT')).rejects.toThrow(CarrierError);
    });

    it('should reject empty tracking number', async () => {
      await expect(adapter.voidLabel('')).rejects.toThrow(CarrierError);
    });

    it('should handle void error response (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Unauthorized',
        }),
      });

      await expect(adapter.voidLabel('1234567890123')).rejects.toThrow();
    });
  });

  describe('getTracking()', () => {
    it('should retrieve tracking information with scan events', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          shipments: [
            {
              status: 'TRANSIT',
              estimatedDeliveryDate: '2026-03-20T23:59:59Z',
              events: [
                {
                  eventType: 'PICK_UP',
                  description: 'Package picked up',
                  timestamp: '2026-03-15T10:00:00Z',
                  location: {
                    city: 'Los Angeles',
                    state: 'CA',
                    country: 'US',
                  },
                },
                {
                  eventType: 'IN_TRANSIT',
                  description: 'In transit to destination',
                  timestamp: '2026-03-16T14:30:00Z',
                  location: {
                    city: 'Denver',
                    state: 'CO',
                    country: 'US',
                  },
                },
              ],
            },
          ],
        }),
      });

      const tracking = await adapter.getTracking('1234567890123');

      expect(tracking).toEqual(
        expect.objectContaining({
          carrier: 'DHL Express',
          trackingNumber: '1234567890123',
          status: expect.any(String),
          delivered: false,
          events: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(Date),
              status: expect.any(String),
              description: expect.any(String),
              location: expect.objectContaining({
                city: expect.any(String),
                country: expect.any(String),
              }),
            }),
          ]),
          estimatedDeliveryDate: expect.any(Date),
        })
      );
    });

    it('should map DELIVERED status correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          shipments: [
            {
              status: 'DELIVERED',
              estimatedDeliveryDate: '2026-03-18T23:59:59Z',
              events: [
                {
                  eventType: 'DELIVERY',
                  description: 'Package delivered',
                  timestamp: '2026-03-18T15:30:00Z',
                  location: {
                    city: 'New York',
                    state: 'NY',
                    country: 'US',
                  },
                },
              ],
            },
          ],
        }),
      });

      const tracking = await adapter.getTracking('9876543210987');

      expect(tracking.status).toBe('delivered');
      expect(tracking.delivered).toBe(true);
    });

    it('should reject invalid tracking number (too short)', async () => {
      await expect(adapter.getTracking('SHORT')).rejects.toThrow(CarrierError);
    });

    it('should reject empty tracking number', async () => {
      await expect(adapter.getTracking('')).rejects.toThrow(CarrierError);
    });

    it('should handle tracking error response (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Tracking number not found',
        }),
      });

      await expect(adapter.getTracking('1234567890123')).rejects.toThrow();
    });
  });

  describe('schedulePickup()', () => {
    it('should schedule pickup successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          pickupConfirmationNumber: 'PICKUP123456',
          message: 'Pickup scheduled',
        }),
      });

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
          start: '09:00',
          end: '17:00',
        },
        packageCount: 5,
        totalWeight: 25,
      });

      expect(pickup).toEqual(
        expect.objectContaining({
          pickupId: expect.any(String),
          pickupDate: expect.any(Date),
          location: expect.objectContaining({
            name: 'Warehouse',
          }),
          confirmedAt: expect.any(Date),
          confirmationCode: expect.stringContaining('DHL-'),
          message: 'DHL pickup scheduled successfully',
        })
      );
    });

    it('should extract pickup confirmation number from response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          pickupConfirmationNumber: 'PKG9876543',
        }),
      });

      const pickup = await adapter.schedulePickup({
        location: {
          name: 'Store',
          street1: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
        pickupDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        packageCount: 3,
      });

      expect(pickup.pickupId).toBe('PKG9876543');
    });

    it('should handle pickup scheduling errors', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Invalid address',
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
          packageCount: 5,
        })
      ).rejects.toThrow(CarrierError);
    });
  });

  describe('validateAddress()', () => {
    it('should validate address successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          validationResults: {
            valid: true,
            standardized: true,
            standardizedAddress: {
              name: 'John Doe',
              street1: '123 Main Street',
              city: 'Los Angeles',
              state: 'CA',
              postalCode: '90001',
              country: 'US',
            },
          },
        }),
      });

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
          valid: true,
          standardized: true,
          address: expect.objectContaining({
            street1: expect.any(String),
            city: 'Los Angeles',
          }),
        })
      );
    });

    it('should detect invalid addresses', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          validationResults: {
            valid: false,
            standardized: false,
          },
        }),
      });

      const result = await adapter.validateAddress({
        name: 'John Doe',
        street1: 'Invalid Address',
        city: 'Unknown City',
        state: 'XX',
        postalCode: '00000',
        country: 'XX',
      });

      expect(result.valid).toBe(false);
    });

    it('should reject address missing required fields', async () => {
      await expect(
        adapter.validateAddress({
          name: 'John Doe',
          street1: '',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        })
      ).rejects.toThrow(CarrierError);
    });

    it('should handle validation error response (400)', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Invalid country code',
        }),
      });

      await expect(
        adapter.validateAddress({
          name: 'John Doe',
          street1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        })
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should map 401 status to AUTH_ERROR', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Authentication failed',
        }),
      });

      try {
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
      } catch (error) {
        expect(error).toBeInstanceOf(CarrierError);
      }
    });

    it('should map 429 status to RATE_LIMIT', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Rate limit exceeded',
        }),
      });

      try {
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
      } catch (error) {
        expect(error).toBeInstanceOf(CarrierError);
      }
    });

    it('should map 500 status to SERVER_ERROR', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          message: 'Internal server error',
        }),
      });

      try {
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
      } catch (error) {
        expect(error).toBeInstanceOf(CarrierError);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple surcharges in rate response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          products: [
            {
              productCode: 'A',
              basePrice: 50.00,
              totalPrice: 65.00,
              surcharges: [
                { type: 'Fuel Surcharge', amount: 5.00 },
                { type: 'Remote Area Fee', amount: 8.00 },
                { type: 'Customs Clearance', amount: 2.00 },
              ],
            },
          ],
          currency: 'EUR',
        }),
      });

      const rates = await adapter.getRates({
        origin: {
          name: 'Shipper',
          street1: '123 Main St',
          city: 'Frankfurt',
          state: 'HE',
          postalCode: '60311',
          country: 'DE',
        },
        destination: {
          name: 'Recipient',
          street1: '456 Oak Ave',
          city: 'London',
          state: 'LND',
          postalCode: 'SW1A 1AA',
          country: 'GB',
        },
        packages: [{ weight: 2, weightUnit: 'kg' }],
        shipDate: '2026-03-15',
        currency: 'EUR',
      });

      expect(rates[0].breakdown).toHaveLength(4);
      expect(rates[0].currency).toBe('EUR');
    });

    it('should handle empty surcharges array', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          products: [
            {
              productCode: 'P',
              basePrice: 25.00,
              totalPrice: 25.00,
              surcharges: [],
            },
          ],
          currency: 'USD',
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
        shipDate: '2026-03-15',
      });

      expect(rates[0].breakdown).toHaveLength(1);
      expect(rates[0].breakdown[0].description).toBe('Base Rate');
    });

    it('should handle multiple packages in shipment', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          shipmentIdentificationNumber: '1111111111111',
          label: {
            content: 'base64pdf',
          },
          shipmentDetails: {
            charges: {
              totalCharge: 45.99,
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
          { weight: 2, weightUnit: 'kg', description: 'Books' },
          { weight: 1.5, weightUnit: 'kg', description: 'Electronics' },
          { weight: 0.5, weightUnit: 'kg', description: 'Documents' },
        ],
        serviceCode: 'D',
        shipDate: new Date().toISOString().split('T')[0],
      });

      expect(label.cost).toBe(45.99);
    });

    it('should handle tracking with multiple scan events', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          shipments: [
            {
              status: 'IN_TRANSIT',
              estimatedDeliveryDate: '2026-03-20T23:59:59Z',
              events: Array.from({ length: 10 }, (_, i) => ({
                eventType: i % 2 === 0 ? 'SCAN' : 'TRANSIT',
                description: `Event ${i + 1}`,
                timestamp: new Date(Date.now() - (10 - i) * 60 * 60 * 1000).toISOString(),
                location: {
                  city: `City ${i}`,
                  state: `State ${i}`,
                  country: 'US',
                },
              })),
            },
          ],
        }),
      });

      const tracking = await adapter.getTracking('1234567890123');

      expect(tracking.events.length).toBe(10);
    });
  });
});
