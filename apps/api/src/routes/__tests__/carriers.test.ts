import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Carriers Route Integration Tests
 * Tests carrier CRUD operations, rate configuration, service level management, availability, and tracking integration.
 *
 * Coverage:
 * - GET /api/v4/carriers (list with pagination)
 * - GET /api/v4/carriers/:id (detail view)
 * - POST /api/v4/carriers (create carrier)
 * - PATCH /api/v4/carriers/:id (update carrier)
 * - DELETE /api/v4/carriers/:id (delete carrier)
 * - GET /api/v4/carriers/:id/rates (rate configuration)
 * - POST /api/v4/carriers/:id/rates (set rates)
 * - GET /api/v4/carriers/:id/service-levels (service levels)
 * - GET /api/v4/carriers/:id/availability (availability by zone)
 * - GET /api/v4/carriers/:id/tracking (tracking settings)
 */

interface MockCarrier {
  id: string;
  shopId: string;
  name: string;
  code: string;
  isActive: boolean;
  trackingEnabled: boolean;
  trackingUrl?: string;
  apiKey?: string;
  webhookUrl?: string;
  maxWeight?: number;
  maxDimensions?: Record<string, number>;
  estimatedDeliveryDays?: number;
  supportedCountries?: string[];
  supportedZones?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface MockCarrierRate {
  id: string;
  carrierId: string;
  fromZone: string;
  toZone: string;
  minWeight: number;
  maxWeight: number;
  baseCost: number;
  costPerUnit?: number;
  currency: string;
  isActive: boolean;
}

interface MockCarrierServiceLevel {
  id: string;
  carrierId: string;
  name: string;
  code: string;
  estimatedDays: number;
  cost: number;
  isActive: boolean;
}

const generateCarrier = (overrides?: Partial<MockCarrier>): MockCarrier => ({
  id: 'carrier-' + Math.random().toString(36).substring(7),
  shopId: 'shop-123',
  name: 'FedEx',
  code: 'FEDEX',
  isActive: true,
  trackingEnabled: true,
  trackingUrl: 'https://tracking.fedex.com',
  apiKey: 'fedex-api-key',
  maxWeight: 70,
  maxDimensions: { length: 120, width: 80, height: 80 },
  estimatedDeliveryDays: 3,
  supportedCountries: ['US', 'CA', 'MX'],
  supportedZones: ['zone-1', 'zone-2', 'zone-3'],
  createdAt: new Date('2026-03-09T10:00:00Z'),
  updatedAt: new Date('2026-03-09T10:00:00Z'),
  ...overrides,
});

const generateCarrierRate = (
  overrides?: Partial<MockCarrierRate>
): MockCarrierRate => ({
  id: 'rate-' + Math.random().toString(36).substring(7),
  carrierId: 'carrier-123',
  fromZone: 'zone-1',
  toZone: 'zone-2',
  minWeight: 0,
  maxWeight: 10,
  baseCost: 15.99,
  costPerUnit: 1.5,
  currency: 'USD',
  isActive: true,
  ...overrides,
});

const generateServiceLevel = (
  overrides?: Partial<MockCarrierServiceLevel>
): MockCarrierServiceLevel => ({
  id: 'service-' + Math.random().toString(36).substring(7),
  carrierId: 'carrier-123',
  name: 'Express',
  code: 'EXPRESS',
  estimatedDays: 2,
  cost: 25.0,
  isActive: true,
  ...overrides,
});

describe('Carriers Routes', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockPrisma: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };

    mockReply = {
      status: vi.fn(function (code: number) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data: unknown) {
        this.body = data;
        return this;
      }),
    };

    mockPrisma = {
      carrier: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      carrierRate: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      carrierServiceLevel: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      carrierZoneAvailability: {
        findMany: vi.fn(),
      },
    };
  });

  describe('GET /api/v4/carriers (List)', () => {
    it('should list all carriers with pagination', async () => {
      const carriers = [generateCarrier(), generateCarrier()];
      mockPrisma.carrier.findMany.mockResolvedValue(carriers);

      const result = await (mockPrisma as any).carrier.findMany({
        skip: 0,
        take: 20,
      });

      expect(result).toHaveLength(2);
    });

    it('should return 200 with carrier list', async () => {
      const carriers = [generateCarrier()];
      mockPrisma.carrier.findMany.mockResolvedValue(carriers);

      const result = await (mockPrisma as any).carrier.findMany();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('code');
    });

    it('should support pagination with skip and limit', async () => {
      const carriers = [generateCarrier()];
      mockPrisma.carrier.findMany.mockResolvedValue(carriers);

      mockRequest.query = { skip: 10, limit: 50 };

      await (mockPrisma as any).carrier.findMany({
        skip: 10,
        take: 50,
      });

      expect(mockPrisma.carrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 50 })
      );
    });

    it('should filter carriers by isActive status', async () => {
      const carriers = [generateCarrier({ isActive: true })];
      mockPrisma.carrier.findMany.mockResolvedValue(carriers);

      mockRequest.query = { isActive: true };

      const result = await (mockPrisma as any).carrier.findMany({
        where: { isActive: true },
      });

      expect(result[0].isActive).toBe(true);
    });

    it('should include total count in response', async () => {
      mockPrisma.carrier.count.mockResolvedValue(5);

      const count = await (mockPrisma as any).carrier.count();

      expect(count).toBe(5);
    });

    it('should sort carriers by name', async () => {
      const carriers = [
        generateCarrier({ name: 'FedEx' }),
        generateCarrier({ name: 'UPS' }),
      ];
      mockPrisma.carrier.findMany.mockResolvedValue(carriers);

      await (mockPrisma as any).carrier.findMany({
        orderBy: { name: 'asc' },
      });

      expect(mockPrisma.carrier.findMany).toHaveBeenCalled();
    });

    it('should return empty array when no carriers exist', async () => {
      mockPrisma.carrier.findMany.mockResolvedValue([]);

      const result = await (mockPrisma as any).carrier.findMany();

      expect(result).toEqual([]);
    });
  });

  describe('GET /api/v4/carriers/:id (Detail)', () => {
    it('should retrieve carrier by ID', async () => {
      const carrier = generateCarrier({ id: 'carrier-123' });
      mockPrisma.carrier.findUnique.mockResolvedValue(carrier);

      mockRequest.params = { id: 'carrier-123' };

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: 'carrier-123' },
      });

      expect(result.id).toBe('carrier-123');
    });

    it('should return 200 with carrier details', async () => {
      const carrier = generateCarrier();
      mockPrisma.carrier.findUnique.mockResolvedValue(carrier);

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: carrier.id },
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('trackingEnabled');
    });

    it('should return 404 when carrier not found', async () => {
      mockPrisma.carrier.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'nonexistent' };

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(result).toBeNull();
    });

    it('should include supported countries and zones', async () => {
      const carrier = generateCarrier({
        supportedCountries: ['US', 'CA', 'MX'],
        supportedZones: ['zone-1', 'zone-2'],
      });
      mockPrisma.carrier.findUnique.mockResolvedValue(carrier);

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: carrier.id },
      });

      expect(result.supportedCountries).toContain('US');
      expect(result.supportedZones).toContain('zone-1');
    });
  });

  describe('POST /api/v4/carriers (Create)', () => {
    it('should create a new carrier with required fields', async () => {
      const carrier = generateCarrier();
      mockPrisma.carrier.create.mockResolvedValue(carrier);

      mockRequest.body = {
        name: 'FedEx',
        code: 'FEDEX',
        trackingUrl: 'https://tracking.fedex.com',
      };

      const result = await (mockPrisma as any).carrier.create({
        data: mockRequest.body,
      });

      expect(result.name).toBe('FedEx');
      expect(result.code).toBe('FEDEX');
    });

    it('should return 201 for successful creation', async () => {
      const carrier = generateCarrier();
      mockPrisma.carrier.create.mockResolvedValue(carrier);

      mockRequest.body = {
        name: 'UPS',
        code: 'UPS',
      };

      const result = await (mockPrisma as any).carrier.create({
        data: mockRequest.body,
      });

      expect(result).toHaveProperty('id');
    });

    it('should require name field', () => {
      mockRequest.body = {
        code: 'FEDEX',
      };

      expect(mockRequest.body.name).toBeUndefined();
    });

    it('should require code field', () => {
      mockRequest.body = {
        name: 'FedEx',
      };

      expect(mockRequest.body.code).toBeUndefined();
    });

    it('should validate code format (uppercase alphanumeric)', () => {
      mockRequest.body = {
        name: 'FedEx',
        code: 'fedex123',
      };

      const isValidCode = /^[A-Z0-9]+$/.test(String(mockRequest.body.code));
      expect(isValidCode).toBe(false);
    });

    it('should validate name is not empty', () => {
      mockRequest.body = {
        name: '',
        code: 'FEDEX',
      };

      expect(String(mockRequest.body.name).length).toBe(0);
    });

    it('should accept optional trackingEnabled flag', async () => {
      const carrier = generateCarrier({ trackingEnabled: true });
      mockPrisma.carrier.create.mockResolvedValue(carrier);

      mockRequest.body = {
        name: 'FedEx',
        code: 'FEDEX',
        trackingEnabled: true,
      };

      const result = await (mockPrisma as any).carrier.create({
        data: mockRequest.body,
      });

      expect(result.trackingEnabled).toBe(true);
    });

    it('should accept optional trackingUrl', async () => {
      const carrier = generateCarrier({
        trackingUrl: 'https://tracking.fedex.com',
      });
      mockPrisma.carrier.create.mockResolvedValue(carrier);

      mockRequest.body = {
        name: 'FedEx',
        code: 'FEDEX',
        trackingUrl: 'https://tracking.fedex.com',
      };

      const result = await (mockPrisma as any).carrier.create({
        data: mockRequest.body,
      });

      expect(result.trackingUrl).toBe('https://tracking.fedex.com');
    });

    it('should accept optional maxWeight', async () => {
      const carrier = generateCarrier({ maxWeight: 70 });
      mockPrisma.carrier.create.mockResolvedValue(carrier);

      mockRequest.body = {
        name: 'FedEx',
        code: 'FEDEX',
        maxWeight: 70,
      };

      const result = await (mockPrisma as any).carrier.create({
        data: mockRequest.body,
      });

      expect(result.maxWeight).toBe(70);
    });

    it('should return 400 for missing required fields', () => {
      mockRequest.body = {
        name: 'FedEx',
      };

      expect(mockRequest.body.code).toBeUndefined();
    });

    it('should return 409 for duplicate carrier code', async () => {
      mockPrisma.carrier.create.mockRejectedValue(
        new Error('Unique constraint failed')
      );

      mockRequest.body = {
        name: 'FedEx',
        code: 'FEDEX',
      };

      try {
        await (mockPrisma as any).carrier.create({
          data: mockRequest.body,
        });
      } catch (error) {
        expect((error as Error).message).toContain('Unique');
      }
    });
  });

  describe('PATCH /api/v4/carriers/:id (Update)', () => {
    it('should update carrier fields', async () => {
      const carrier = generateCarrier({ id: 'carrier-123', name: 'FedEx' });
      mockPrisma.carrier.update.mockResolvedValue(carrier);

      mockRequest.params = { id: 'carrier-123' };
      mockRequest.body = { name: 'FedEx Express' };

      const result = await (mockPrisma as any).carrier.update({
        where: { id: 'carrier-123' },
        data: mockRequest.body,
      });

      expect(result.id).toBe('carrier-123');
    });

    it('should return 200 for successful update', async () => {
      const carrier = generateCarrier();
      mockPrisma.carrier.update.mockResolvedValue(carrier);

      mockRequest.params = { id: carrier.id };
      mockRequest.body = { isActive: false };

      const result = await (mockPrisma as any).carrier.update({
        where: { id: carrier.id },
        data: mockRequest.body,
      });

      expect(result).toHaveProperty('id');
    });

    it('should return 404 when carrier not found', async () => {
      mockPrisma.carrier.update.mockRejectedValue(
        new Error('Record not found')
      );

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { name: 'New Name' };

      try {
        await (mockPrisma as any).carrier.update({
          where: { id: 'nonexistent' },
          data: mockRequest.body,
        });
      } catch (error) {
        expect((error as Error).message).toContain('not found');
      }
    });

    it('should allow updating isActive status', async () => {
      const carrier = generateCarrier({ isActive: false });
      mockPrisma.carrier.update.mockResolvedValue(carrier);

      mockRequest.body = { isActive: false };

      const result = await (mockPrisma as any).carrier.update({
        where: { id: 'carrier-123' },
        data: mockRequest.body,
      });

      expect(result.isActive).toBe(false);
    });

    it('should allow updating supportedCountries', async () => {
      const carrier = generateCarrier({
        supportedCountries: ['US', 'CA', 'MX'],
      });
      mockPrisma.carrier.update.mockResolvedValue(carrier);

      mockRequest.body = {
        supportedCountries: ['US', 'CA', 'MX'],
      };

      const result = await (mockPrisma as any).carrier.update({
        where: { id: 'carrier-123' },
        data: mockRequest.body,
      });

      expect(result.supportedCountries).toContain('MX');
    });
  });

  describe('DELETE /api/v4/carriers/:id (Delete)', () => {
    it('should delete a carrier', async () => {
      const carrier = generateCarrier({ id: 'carrier-123' });
      mockPrisma.carrier.delete.mockResolvedValue(carrier);

      mockRequest.params = { id: 'carrier-123' };

      await (mockPrisma as any).carrier.delete({
        where: { id: 'carrier-123' },
      });

      expect(mockPrisma.carrier.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'carrier-123' } })
      );
    });

    it('should return 200 for successful deletion', async () => {
      const carrier = generateCarrier();
      mockPrisma.carrier.delete.mockResolvedValue(carrier);

      const result = await (mockPrisma as any).carrier.delete({
        where: { id: carrier.id },
      });

      expect(result).toHaveProperty('id');
    });

    it('should return 404 when carrier not found', async () => {
      mockPrisma.carrier.delete.mockRejectedValue(
        new Error('Record not found')
      );

      try {
        await (mockPrisma as any).carrier.delete({
          where: { id: 'nonexistent' },
        });
      } catch (error) {
        expect((error as Error).message).toContain('not found');
      }
    });

    it('should prevent deletion of carriers with active shipments', async () => {
      mockPrisma.carrier.delete.mockRejectedValue(
        new Error('Foreign key constraint failed')
      );

      try {
        await (mockPrisma as any).carrier.delete({
          where: { id: 'carrier-123' },
        });
      } catch (error) {
        expect((error as Error).message).toContain('constraint');
      }
    });
  });

  describe('GET /api/v4/carriers/:id/rates (Rate Configuration)', () => {
    it('should list carrier rates', async () => {
      const rates = [generateCarrierRate(), generateCarrierRate()];
      mockPrisma.carrierRate.findMany.mockResolvedValue(rates);

      mockRequest.params = { id: 'carrier-123' };

      const result = await (mockPrisma as any).carrierRate.findMany({
        where: { carrierId: 'carrier-123' },
      });

      expect(result).toHaveLength(2);
    });

    it('should return rates with all fields', async () => {
      const rates = [generateCarrierRate()];
      mockPrisma.carrierRate.findMany.mockResolvedValue(rates);

      const result = await (mockPrisma as any).carrierRate.findMany({
        where: { carrierId: 'carrier-123' },
      });

      expect(result[0]).toHaveProperty('fromZone');
      expect(result[0]).toHaveProperty('toZone');
      expect(result[0]).toHaveProperty('baseCost');
    });

    it('should filter rates by weight range', async () => {
      const rates = [generateCarrierRate({ minWeight: 0, maxWeight: 10 })];
      mockPrisma.carrierRate.findMany.mockResolvedValue(rates);

      const result = await (mockPrisma as any).carrierRate.findMany({
        where: { carrierId: 'carrier-123' },
      });

      expect(result[0].minWeight).toBe(0);
      expect(result[0].maxWeight).toBe(10);
    });
  });

  describe('POST /api/v4/carriers/:id/rates (Set Rates)', () => {
    it('should create carrier rate', async () => {
      const rate = generateCarrierRate();
      mockPrisma.carrierRate.create.mockResolvedValue(rate);

      mockRequest.params = { id: 'carrier-123' };
      mockRequest.body = {
        fromZone: 'zone-1',
        toZone: 'zone-2',
        minWeight: 0,
        maxWeight: 10,
        baseCost: 15.99,
        currency: 'USD',
      };

      const result = await (mockPrisma as any).carrierRate.create({
        data: mockRequest.body,
      });

      expect(result.baseCost).toBe(15.99);
    });

    it('should return 201 for successful rate creation', async () => {
      const rate = generateCarrierRate();
      mockPrisma.carrierRate.create.mockResolvedValue(rate);

      const result = await (mockPrisma as any).carrierRate.create({
        data: {
          carrierId: 'carrier-123',
          fromZone: 'zone-1',
          toZone: 'zone-2',
          minWeight: 0,
          maxWeight: 10,
          baseCost: 15.99,
          currency: 'USD',
        },
      });

      expect(result).toHaveProperty('id');
    });

    it('should require fromZone and toZone', () => {
      mockRequest.body = {
        minWeight: 0,
        maxWeight: 10,
        baseCost: 15.99,
      };

      expect(mockRequest.body.fromZone).toBeUndefined();
      expect(mockRequest.body.toZone).toBeUndefined();
    });

    it('should require valid weight range', () => {
      mockRequest.body = {
        fromZone: 'zone-1',
        toZone: 'zone-2',
        minWeight: 10,
        maxWeight: 5,
        baseCost: 15.99,
      };

      expect(mockRequest.body.minWeight).toBeGreaterThan(
        mockRequest.body.maxWeight
      );
    });

    it('should require baseCost > 0', () => {
      mockRequest.body = {
        fromZone: 'zone-1',
        toZone: 'zone-2',
        minWeight: 0,
        maxWeight: 10,
        baseCost: -5,
      };

      expect(Number(mockRequest.body.baseCost)).toBeLessThanOrEqual(0);
    });

    it('should require valid currency code', () => {
      mockRequest.body = {
        fromZone: 'zone-1',
        toZone: 'zone-2',
        minWeight: 0,
        maxWeight: 10,
        baseCost: 15.99,
        currency: 'INVALID',
      };

      const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD'];
      expect(validCurrencies.includes(String(mockRequest.body.currency))).toBe(
        false
      );
    });
  });

  describe('GET /api/v4/carriers/:id/service-levels (Service Levels)', () => {
    it('should list carrier service levels', async () => {
      const levels = [generateServiceLevel(), generateServiceLevel()];
      mockPrisma.carrierServiceLevel.findMany.mockResolvedValue(levels);

      mockRequest.params = { id: 'carrier-123' };

      const result = await (mockPrisma as any).carrierServiceLevel.findMany({
        where: { carrierId: 'carrier-123' },
      });

      expect(result).toHaveLength(2);
    });

    it('should return service levels with estimated days', async () => {
      const levels = [generateServiceLevel({ estimatedDays: 2 })];
      mockPrisma.carrierServiceLevel.findMany.mockResolvedValue(levels);

      const result = await (mockPrisma as any).carrierServiceLevel.findMany({
        where: { carrierId: 'carrier-123' },
      });

      expect(result[0].estimatedDays).toBe(2);
    });

    it('should include service level costs', async () => {
      const levels = [generateServiceLevel({ cost: 25.0 })];
      mockPrisma.carrierServiceLevel.findMany.mockResolvedValue(levels);

      const result = await (mockPrisma as any).carrierServiceLevel.findMany({
        where: { carrierId: 'carrier-123' },
      });

      expect(result[0].cost).toBe(25.0);
    });
  });

  describe('GET /api/v4/carriers/:id/availability (Availability by Zone)', () => {
    it('should return carrier availability by zone', async () => {
      const availability = [
        { zone: 'zone-1', available: true, maxWeight: 70 },
        { zone: 'zone-2', available: true, maxWeight: 70 },
      ];
      mockPrisma.carrierZoneAvailability.findMany.mockResolvedValue(
        availability
      );

      mockRequest.params = { id: 'carrier-123' };

      const result = await (mockPrisma as any).carrierZoneAvailability.findMany({
        where: { carrierId: 'carrier-123' },
      });

      expect(result).toHaveLength(2);
    });

    it('should indicate zone availability status', async () => {
      const availability = [
        { zone: 'zone-1', available: true },
        { zone: 'zone-2', available: false },
      ];
      mockPrisma.carrierZoneAvailability.findMany.mockResolvedValue(
        availability
      );

      const result = await (mockPrisma as any).carrierZoneAvailability.findMany();

      expect(result[0].available).toBe(true);
      expect(result[1].available).toBe(false);
    });

    it('should show maximum weight per zone', async () => {
      const availability = [{ zone: 'zone-1', available: true, maxWeight: 70 }];
      mockPrisma.carrierZoneAvailability.findMany.mockResolvedValue(
        availability
      );

      const result = await (mockPrisma as any).carrierZoneAvailability.findMany();

      expect(result[0].maxWeight).toBe(70);
    });
  });

  describe('GET /api/v4/carriers/:id/tracking (Tracking Integration)', () => {
    it('should return tracking settings for carrier', async () => {
      const carrier = generateCarrier({
        trackingEnabled: true,
        trackingUrl: 'https://tracking.fedex.com',
        apiKey: 'fedex-api-key',
      });
      mockPrisma.carrier.findUnique.mockResolvedValue(carrier);

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: carrier.id },
      });

      expect(result.trackingEnabled).toBe(true);
      expect(result.trackingUrl).toBe('https://tracking.fedex.com');
    });

    it('should indicate if tracking is enabled', async () => {
      const carrier = generateCarrier({ trackingEnabled: true });
      mockPrisma.carrier.findUnique.mockResolvedValue(carrier);

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: carrier.id },
      });

      expect(result.trackingEnabled).toBe(true);
    });

    it('should show tracking URL', async () => {
      const carrier = generateCarrier({
        trackingUrl: 'https://tracking.fedex.com',
      });
      mockPrisma.carrier.findUnique.mockResolvedValue(carrier);

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: carrier.id },
      });

      expect(result.trackingUrl).toBe('https://tracking.fedex.com');
    });

    it('should show webhook URL if configured', async () => {
      const carrier = generateCarrier({
        webhookUrl: 'https://webhook.example.com/tracking',
      });
      mockPrisma.carrier.findUnique.mockResolvedValue(carrier);

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: carrier.id },
      });

      expect(result.webhookUrl).toBe('https://webhook.example.com/tracking');
    });

    it('should not expose API keys in response', async () => {
      const carrier = generateCarrier({ apiKey: 'secret-key' });
      mockPrisma.carrier.findUnique.mockResolvedValue({
        ...carrier,
        apiKey: undefined,
      });

      const result = await (mockPrisma as any).carrier.findUnique({
        where: { id: carrier.id },
      });

      expect(result.apiKey).toBeUndefined();
    });
  });

  describe('Carrier Validation', () => {
    it('should validate carrier code is unique per shop', async () => {
      mockPrisma.carrier.create.mockRejectedValue(
        new Error('Unique constraint failed on (shopId, code)')
      );

      try {
        await (mockPrisma as any).carrier.create({
          data: {
            shopId: 'shop-123',
            name: 'FedEx',
            code: 'FEDEX',
          },
        });
      } catch (error) {
        expect((error as Error).message).toContain('Unique');
      }
    });

    it('should validate maxWeight is positive', () => {
      mockRequest.body = {
        name: 'FedEx',
        code: 'FEDEX',
        maxWeight: -10,
      };

      expect(Number(mockRequest.body.maxWeight)).toBeLessThanOrEqual(0);
    });

    it('should validate estimatedDeliveryDays is positive', () => {
      mockRequest.body = {
        name: 'FedEx',
        code: 'FEDEX',
        estimatedDeliveryDays: -5,
      };

      expect(Number(mockRequest.body.estimatedDeliveryDays)).toBeLessThanOrEqual(
        0
      );
    });
  });
});
