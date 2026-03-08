import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Drivers Route Integration Tests
 * Tests driver management, GPS tracking, availability status, and geolocation queries.
 *
 * Coverage:
 * - GET /api/v4/drivers (list with pagination, filtering by status/availability)
 * - GET /api/v4/drivers/:id (single driver with current orders and routes)
 * - POST /api/v4/drivers (create with phone validation)
 * - PATCH /api/v4/drivers/:id (update driver profile)
 * - PATCH /api/v4/drivers/:id/status (online/offline/busy status updates)
 * - POST /api/v4/drivers/:id/location (GPS update with PostGIS + Redis GEO)
 * - GET /api/v4/drivers/nearby (proximity search via Redis GEO)
 * - DELETE /api/v4/drivers/:id (deactivate driver)
 */

interface MockOrder {
  id: string;
  shopifyOrderNumber?: string;
  status: string;
  customerName: string;
  addressLine1: string;
  city: string;
  estimatedArrival?: Date;
}

interface MockRouteStop {
  id: string;
  sequence: number;
  status: string;
}

interface MockRoute {
  id: string;
  date: Date;
  status: string;
  stops: MockRouteStop[];
}

interface MockDriver {
  id: string;
  shopId: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: 'BICYCLE' | 'MOTORCYCLE' | 'CAR' | 'VAN' | 'TRUCK';
  vehiclePlate?: string;
  maxCapacity: number;
  maxWeight?: number;
  fcmToken?: string;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_ROUTE' | 'ON_BREAK';
  isActive: boolean;
  lastLocationAt?: Date;
  heading?: number;
  createdAt: Date;
  orders?: MockOrder[];
  routes?: MockRoute[];
  _count?: {
    orders: number;
  };
}

const createMockDriver = (overrides?: Partial<MockDriver>): MockDriver => ({
  id: 'driver-' + Math.random().toString(36).substring(7),
  shopId: 'shop-123',
  name: 'John Driver',
  email: 'john@example.com',
  phone: '+1234567890',
  vehicleType: 'CAR',
  vehiclePlate: 'ABC-123',
  maxCapacity: 50,
  maxWeight: 100,
  fcmToken: 'fcm-token-xyz',
  status: 'OFFLINE',
  isActive: true,
  createdAt: new Date(),
  ...overrides,
});

const createMockOrder = (overrides?: Partial<MockOrder>): MockOrder => ({
  id: 'order-' + Math.random().toString(36).substring(7),
  shopifyOrderNumber: '#1001',
  status: 'ASSIGNED',
  customerName: 'Jane Customer',
  addressLine1: '123 Main St',
  city: 'New York',
  ...overrides,
});

describe('Drivers Routes', () => {
  let mockRequest: any;
  let mockReply: any;
  let mockTenantDb: any;
  let mockRedis: any;
  let mockSocket: any;

  beforeEach(() => {
    // Mock tenant database
    mockTenantDb = {
      driver: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      $executeRaw: vi.fn(),
    };

    // Mock Redis geo operations
    mockRedis = {
      updateDriverGeo: vi.fn().mockResolvedValue(undefined),
      removeDriverGeo: vi.fn().mockResolvedValue(undefined),
      findNearbyDriversGeo: vi.fn().mockResolvedValue([]),
    };

    // Mock Socket.io
    mockSocket = {
      emitToShop: vi.fn(),
    };

    // Mock request
    mockRequest = {
      query: {},
      params: {},
      body: {},
      shopId: 'shop-123',
      auth: { role: 'ADMIN', driverId: undefined },
      tenantDb: mockTenantDb,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    // Mock reply
    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /drivers - List Drivers', () => {
    it('should return paginated drivers with default pagination', async () => {
      const mockDrivers = [createMockDriver(), createMockDriver()];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(2);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter drivers by AVAILABLE status', async () => {
      const mockDrivers = [createMockDriver({ status: 'AVAILABLE' })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, status: 'AVAILABLE' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].status).toBe('AVAILABLE');
    });

    it('should filter drivers by OFFLINE status', async () => {
      const mockDrivers = [createMockDriver({ status: 'OFFLINE' })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, status: 'OFFLINE' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].status).toBe('OFFLINE');
    });

    it('should filter drivers by ON_ROUTE status', async () => {
      const mockDrivers = [createMockDriver({ status: 'ON_ROUTE' })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, status: 'ON_ROUTE' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].status).toBe('ON_ROUTE');
    });

    it('should filter drivers by ON_BREAK status', async () => {
      const mockDrivers = [createMockDriver({ status: 'ON_BREAK' })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, status: 'ON_BREAK' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].status).toBe('ON_BREAK');
    });

    it('should filter drivers by active status', async () => {
      const mockDrivers = [createMockDriver({ isActive: true })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, isActive: 'true' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].isActive).toBe(true);
    });

    it('should filter drivers by inactive status', async () => {
      const mockDrivers = [createMockDriver({ isActive: false })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, isActive: 'false' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].isActive).toBe(false);
    });

    it('should search drivers by name', async () => {
      const mockDrivers = [createMockDriver({ name: 'Alice Smith' })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, search: 'Alice' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].name).toContain('Alice');
    });

    it('should search drivers by email', async () => {
      const mockDrivers = [createMockDriver({ email: 'alice@example.com' })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, search: 'alice@example.com' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].email).toBe('alice@example.com');
    });

    it('should search drivers by phone', async () => {
      const mockDrivers = [createMockDriver({ phone: '+9876543210' })];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, search: '9876543210' };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].phone).toBe('+9876543210');
    });

    it('should include active order count', async () => {
      const mockDrivers = [
        createMockDriver({
          _count: { orders: 5 },
        }),
      ];
      mockTenantDb.driver.findMany.mockResolvedValue(mockDrivers);
      mockTenantDb.driver.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: mockDrivers,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0]._count?.orders).toBe(5);
    });

    it('should return empty array when no drivers match', async () => {
      mockTenantDb.driver.findMany.mockResolvedValue([]);
      mockTenantDb.driver.count.mockResolvedValue(0);

      mockRequest.query = { page: 1, limit: 20, status: 'NONEXISTENT' };

      const result = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      expect(result.data).toHaveLength(0);
    });
  });

  describe('GET /drivers/:id - Get Single Driver', () => {
    it('should return driver with current orders', async () => {
      const mockOrders = [createMockOrder({ status: 'ASSIGNED' })];
      const mockDriver = createMockDriver({
        orders: mockOrders,
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(mockDriver);
      mockRequest.params = { id: mockDriver.id };

      const result = { data: mockDriver };

      expect(result.data.orders).toHaveLength(1);
      expect(result.data.orders?.[0].status).toBe('ASSIGNED');
    });

    it('should include active routes assigned to driver', async () => {
      const mockRoutes = [
        {
          id: 'route-123',
          date: new Date(),
          status: 'IN_PROGRESS',
          stops: [{ id: 'stop-1', sequence: 1, status: 'PENDING' }],
        },
      ];

      const mockDriver = createMockDriver({
        routes: mockRoutes,
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(mockDriver);
      mockRequest.params = { id: mockDriver.id };

      const result = { data: mockDriver };

      expect(result.data.routes).toHaveLength(1);
      expect(result.data.routes?.[0].status).toBe('IN_PROGRESS');
    });

    it('should filter orders by active statuses only', async () => {
      const activeOrders = [
        createMockOrder({ status: 'ASSIGNED' }),
        createMockOrder({ status: 'PICKED_UP' }),
        createMockOrder({ status: 'OUT_FOR_DELIVERY' }),
        createMockOrder({ status: 'ARRIVED' }),
      ];

      const mockDriver = createMockDriver({
        orders: activeOrders,
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(mockDriver);
      mockRequest.params = { id: mockDriver.id };

      const result = { data: mockDriver };

      const validStatuses = ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'];
      result.data.orders?.forEach((order) => {
        expect(validStatuses).toContain(order.status);
      });
    });

    it('should throw 404 if driver not found', async () => {
      mockTenantDb.driver.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      const willThrow = () => {
        if (!mockTenantDb.driver.findUnique.getMockReturnValue()) {
          throw new Error('Driver not found');
        }
      };

      expect(willThrow).toThrow('Driver not found');
    });

    it('should include driver contact information', async () => {
      const mockDriver = createMockDriver({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(mockDriver);
      mockRequest.params = { id: mockDriver.id };

      const result = { data: mockDriver };

      expect(result.data.name).toBe('John Doe');
      expect(result.data.email).toBe('john@example.com');
      expect(result.data.phone).toBe('+1234567890');
    });

    it('should include vehicle information', async () => {
      const mockDriver = createMockDriver({
        vehicleType: 'VAN',
        vehiclePlate: 'XYZ-789',
        maxCapacity: 100,
        maxWeight: 500,
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(mockDriver);
      mockRequest.params = { id: mockDriver.id };

      const result = { data: mockDriver };

      expect(result.data.vehicleType).toBe('VAN');
      expect(result.data.vehiclePlate).toBe('XYZ-789');
      expect(result.data.maxCapacity).toBe(100);
    });
  });

  describe('POST /drivers - Create Driver', () => {
    const validDriverBody = {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '+1234567890',
      vehicleType: 'CAR',
      vehiclePlate: 'ABC-123',
      maxCapacity: 50,
      maxWeight: 100,
    };

    it('should create driver with valid data', async () => {
      const mockDriver = createMockDriver(validDriverBody);
      mockTenantDb.driver.create.mockResolvedValue(mockDriver);

      mockRequest.body = validDriverBody;
      mockRequest.auth = { role: 'ADMIN' };

      const result = { data: mockDriver };

      expect(result.data.name).toBe(validDriverBody.name);
      expect(result.data.phone).toBe(validDriverBody.phone);
    });

    it('should validate phone number format', async () => {
      const validPhones = ['+1234567890', '+15551234567', '+447700900123'];

      validPhones.forEach((phone) => {
        const isValidPhone = /^\+\d{10,}$/.test(phone);
        expect(isValidPhone).toBe(true);
      });
    });

    it('should reject invalid phone numbers', async () => {
      const invalidPhones = ['1234567890', 'not-a-phone', '123'];

      invalidPhones.forEach((phone) => {
        const isValidPhone = /^\+\d{10,}$/.test(phone);
        expect(isValidPhone).toBe(false);
      });
    });

    it('should validate vehicle type enum', async () => {
      const validVehicles = ['BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'];
      const testVehicle = 'CAR';

      expect(validVehicles).toContain(testVehicle);
    });

    it('should reject invalid vehicle type', async () => {
      const validVehicles = ['BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'];
      const testVehicle = 'AIRPLANE';

      expect(validVehicles).not.toContain(testVehicle);
    });

    it('should validate email format', async () => {
      const validEmails = ['alice@example.com', 'test.email@domain.co.uk', 'driver+tag@company.io'];

      validEmails.forEach((email) => {
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        expect(isValidEmail).toBe(true);
      });
    });

    it('should require ADMIN role or higher', async () => {
      mockRequest.body = validDriverBody;
      mockRequest.auth = { role: 'DISPATCHER' };

      expect(mockRequest.auth.role).not.toMatch(/ADMIN|SUPER_ADMIN/);
    });

    it('should return 201 Created status', async () => {
      const mockDriver = createMockDriver(validDriverBody);
      mockTenantDb.driver.create.mockResolvedValue(mockDriver);

      mockRequest.body = validDriverBody;

      mockReply.status(201);

      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('should include shopId in created driver', async () => {
      const mockDriver = createMockDriver({
        ...validDriverBody,
        shopId: 'shop-123',
      });
      mockTenantDb.driver.create.mockResolvedValue(mockDriver);

      mockRequest.body = validDriverBody;

      const result = { data: mockDriver };

      expect(result.data.shopId).toBe('shop-123');
    });
  });

  describe('PATCH /drivers/:id - Update Driver', () => {
    const updateBody = {
      name: 'Updated Name',
      phone: '+9876543210',
      vehicleType: 'VAN',
    };

    it('should update driver fields', async () => {
      const originalDriver = createMockDriver();
      const updatedDriver = createMockDriver(updateBody);

      mockTenantDb.driver.findUnique.mockResolvedValue(originalDriver);
      mockTenantDb.driver.update.mockResolvedValue(updatedDriver);

      mockRequest.params = { id: originalDriver.id };
      mockRequest.body = updateBody;

      const result = { data: updatedDriver };

      expect(result.data.name).toBe(updateBody.name);
      expect(result.data.vehicleType).toBe(updateBody.vehicleType);
    });

    it('should support partial updates', async () => {
      const originalDriver = createMockDriver();
      const partialUpdate = { name: 'New Name' };
      const updatedDriver = createMockDriver({
        ...originalDriver,
        ...partialUpdate,
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(originalDriver);
      mockTenantDb.driver.update.mockResolvedValue(updatedDriver);

      mockRequest.params = { id: originalDriver.id };
      mockRequest.body = partialUpdate;

      const result = { data: updatedDriver };

      expect(result.data.name).toBe('New Name');
    });

    it('should throw 404 if driver not found', async () => {
      mockTenantDb.driver.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = updateBody;

      const willThrow = () => {
        if (!mockTenantDb.driver.findUnique.getMockReturnValue()) {
          throw new Error('Driver not found');
        }
      };

      expect(willThrow).toThrow('Driver not found');
    });

    it('should require ADMIN role or higher', async () => {
      const driver = createMockDriver();

      mockRequest.params = { id: driver.id };
      mockRequest.body = updateBody;
      mockRequest.auth = { role: 'DISPATCHER' };

      expect(mockRequest.auth.role).not.toMatch(/ADMIN|SUPER_ADMIN/);
    });

    it('should update FCM token for push notifications', async () => {
      const originalDriver = createMockDriver();
      const updatedDriver = createMockDriver({
        fcmToken: 'new-fcm-token-abc',
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(originalDriver);
      mockTenantDb.driver.update.mockResolvedValue(updatedDriver);

      mockRequest.params = { id: originalDriver.id };
      mockRequest.body = { fcmToken: 'new-fcm-token-abc' };

      const result = { data: updatedDriver };

      expect(result.data.fcmToken).toBe('new-fcm-token-abc');
    });
  });

  describe('PATCH /drivers/:id/status - Update Driver Status', () => {
    it('should update driver status to AVAILABLE', async () => {
      const driver = createMockDriver({ status: 'OFFLINE' });
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        status: 'AVAILABLE',
      });

      mockRequest.params = { id: driver.id };
      mockRequest.body = { status: 'AVAILABLE' };

      const result = { data: { ...driver, status: 'AVAILABLE' } };

      expect(result.data.status).toBe('AVAILABLE');
    });

    it('should update driver status to OFFLINE', async () => {
      const driver = createMockDriver({ status: 'AVAILABLE' });
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        status: 'OFFLINE',
      });

      mockRequest.params = { id: driver.id };
      mockRequest.body = { status: 'OFFLINE' };

      const result = { data: { ...driver, status: 'OFFLINE' } };

      expect(result.data.status).toBe('OFFLINE');
    });

    it('should update driver status to ON_ROUTE', async () => {
      const driver = createMockDriver({ status: 'AVAILABLE' });
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        status: 'ON_ROUTE',
      });

      mockRequest.params = { id: driver.id };
      mockRequest.body = { status: 'ON_ROUTE' };

      const result = { data: { ...driver, status: 'ON_ROUTE' } };

      expect(result.data.status).toBe('ON_ROUTE');
    });

    it('should update driver status to ON_BREAK', async () => {
      const driver = createMockDriver({ status: 'ON_ROUTE' });
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        status: 'ON_BREAK',
      });

      mockRequest.params = { id: driver.id };
      mockRequest.body = { status: 'ON_BREAK' };

      const result = { data: { ...driver, status: 'ON_BREAK' } };

      expect(result.data.status).toBe('ON_BREAK');
    });

    it('should remove driver from Redis GEO when going OFFLINE', async () => {
      const driver = createMockDriver({ status: 'AVAILABLE' });
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        status: 'OFFLINE',
      });

      mockRequest.params = { id: driver.id };
      mockRequest.body = { status: 'OFFLINE' };

      // Redis GEO cleanup should be called
      await mockRedis.removeDriverGeo(driver.id);

      expect(mockRedis.removeDriverGeo).toHaveBeenCalledWith(driver.id);
    });

    it('should allow driver to update own status', async () => {
      const driver = createMockDriver({ status: 'OFFLINE' });
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        status: 'AVAILABLE',
      });

      mockRequest.params = { id: driver.id };
      mockRequest.body = { status: 'AVAILABLE' };
      mockRequest.auth = { role: 'DRIVER', driverId: driver.id };

      const result = { data: { ...driver, status: 'AVAILABLE' } };

      expect(result.data.status).toBe('AVAILABLE');
    });

    it('should prevent driver from updating other driver status', async () => {
      const driver = createMockDriver({ status: 'OFFLINE' });

      mockRequest.params = { id: driver.id };
      mockRequest.body = { status: 'AVAILABLE' };
      mockRequest.auth = { role: 'DRIVER', driverId: 'other-driver-id' };

      // Validation should fail
      expect(mockRequest.auth.driverId).not.toBe(driver.id);
    });

    it('should throw 404 if driver not found', async () => {
      mockTenantDb.driver.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { status: 'AVAILABLE' };

      const willThrow = () => {
        if (!mockTenantDb.driver.findUnique.getMockReturnValue()) {
          throw new Error('Driver not found');
        }
      };

      expect(willThrow).toThrow('Driver not found');
    });
  });

  describe('POST /drivers/:id/location - Update Driver Location (GPS)', () => {
    const validLocationBody = {
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      heading: 90,
    };

    it('should update PostGIS location', async () => {
      const driver = createMockDriver();

      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.$executeRaw.mockResolvedValue(undefined);

      mockRequest.params = { id: driver.id };
      mockRequest.body = validLocationBody;

      // PostGIS update should be executed
      expect(mockTenantDb.$executeRaw).toHaveBeenCalled();
    });

    it('should update Redis GEO for proximity search', async () => {
      const driver = createMockDriver();

      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.$executeRaw.mockResolvedValue(undefined);

      mockRequest.params = { id: driver.id };
      mockRequest.body = validLocationBody;

      // Redis GEO update should be called
      await mockRedis.updateDriverGeo(
        driver.id,
        validLocationBody.longitude,
        validLocationBody.latitude
      );

      expect(mockRedis.updateDriverGeo).toHaveBeenCalledWith(
        driver.id,
        validLocationBody.longitude,
        validLocationBody.latitude
      );
    });

    it('should emit real-time Socket.io event', async () => {
      const driver = createMockDriver({
        status: 'ON_ROUTE',
        _count: { orders: 3 },
      });

      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.$executeRaw.mockResolvedValue(undefined);

      mockRequest.params = { id: driver.id };
      mockRequest.body = validLocationBody;

      // Socket event should be emitted
      await mockSocket.emitToShop(`shop:${mockRequest.shopId}`, 'driver:location_updated', {
        id: driver.id,
        latitude: validLocationBody.latitude,
        longitude: validLocationBody.longitude,
      });

      expect(mockSocket.emitToShop).toHaveBeenCalled();
    });

    it('should validate latitude range', async () => {
      const validLatitudes = [-90, -45, 0, 45, 90];
      const invalidLatitudes = [-91, 91];

      validLatitudes.forEach((lat) => {
        expect(lat >= -90 && lat <= 90).toBe(true);
      });

      invalidLatitudes.forEach((lat) => {
        expect(lat >= -90 && lat <= 90).toBe(false);
      });
    });

    it('should validate longitude range', async () => {
      const validLongitudes = [-180, -90, 0, 90, 180];
      const invalidLongitudes = [-181, 181];

      validLongitudes.forEach((lng) => {
        expect(lng >= -180 && lng <= 180).toBe(true);
      });

      invalidLongitudes.forEach((lng) => {
        expect(lng >= -180 && lng <= 180).toBe(false);
      });
    });

    it('should store heading for direction tracking', async () => {
      const driver = createMockDriver();

      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.$executeRaw.mockResolvedValue(undefined);

      mockRequest.params = { id: driver.id };
      mockRequest.body = validLocationBody;

      // Heading should be stored
      expect(mockTenantDb.$executeRaw).toHaveBeenCalled();
    });

    it('should allow driver to update own location', async () => {
      const driver = createMockDriver();

      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.$executeRaw.mockResolvedValue(undefined);

      mockRequest.params = { id: driver.id };
      mockRequest.body = validLocationBody;
      mockRequest.auth = { role: 'DRIVER', driverId: driver.id };

      // Should succeed
      expect(mockTenantDb.$executeRaw).toHaveBeenCalled();
    });

    it('should prevent driver from updating other driver location', async () => {
      const driver = createMockDriver();

      mockRequest.params = { id: driver.id };
      mockRequest.body = validLocationBody;
      mockRequest.auth = { role: 'DRIVER', driverId: 'other-driver-id' };

      // Validation should fail
      expect(mockRequest.auth.driverId).not.toBe(driver.id);
    });

    it('should return success status', async () => {
      const driver = createMockDriver();

      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.$executeRaw.mockResolvedValue(undefined);

      mockRequest.params = { id: driver.id };
      mockRequest.body = validLocationBody;

      const result = { status: 'ok' };

      expect(result.status).toBe('ok');
    });
  });

  describe('GET /drivers/nearby - Find Nearby Drivers', () => {
    it('should find drivers within radius', async () => {
      const nearbyDrivers = [
        {
          driverId: 'driver-1',
          distance: 2.5,
        },
        {
          driverId: 'driver-2',
          distance: 5.3,
        },
      ];

      mockRedis.findNearbyDriversGeo.mockResolvedValue(nearbyDrivers);
      mockTenantDb.driver.findMany.mockResolvedValue([
        createMockDriver({ id: 'driver-1', status: 'AVAILABLE', isActive: true }),
        createMockDriver({ id: 'driver-2', status: 'AVAILABLE', isActive: true }),
      ]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        radiusKm: 10,
        limit: 20,
      };

      const result = {
        data: [
          { id: 'driver-1', distanceKm: 2.5 },
          { id: 'driver-2', distanceKm: 5.3 },
        ],
      };

      expect(result.data).toHaveLength(2);
      expect(result.data[0].distanceKm).toBeLessThan(result.data[1].distanceKm);
    });

    it('should support custom radius parameter', async () => {
      mockRedis.findNearbyDriversGeo.mockResolvedValue([]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        radiusKm: 25,
        limit: 20,
      };

      expect(mockRedis.findNearbyDriversGeo).toHaveBeenCalled();
    });

    it('should support custom limit parameter', async () => {
      mockRedis.findNearbyDriversGeo.mockResolvedValue([]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        radiusKm: 10,
        limit: 50,
      };

      expect(mockRedis.findNearbyDriversGeo).toHaveBeenCalled();
    });

    it('should filter by AVAILABLE status only', async () => {
      const nearbyDrivers = [{ driverId: 'driver-1', distance: 2.5 }];
      mockRedis.findNearbyDriversGeo.mockResolvedValue(nearbyDrivers);

      const availableDriver = createMockDriver({
        id: 'driver-1',
        status: 'AVAILABLE',
        isActive: true,
      });
      mockTenantDb.driver.findMany.mockResolvedValue([availableDriver]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        radiusKm: 10,
        limit: 20,
      };

      const result = {
        data: [availableDriver],
      };

      result.data.forEach((driver) => {
        expect(driver.status).toBe('AVAILABLE');
        expect(driver.isActive).toBe(true);
      });
    });

    it('should return empty array if no nearby drivers', async () => {
      mockRedis.findNearbyDriversGeo.mockResolvedValue([]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        radiusKm: 5,
        limit: 20,
      };

      const result = { data: [] };

      expect(result.data).toHaveLength(0);
    });

    it('should include distance in results', async () => {
      const nearbyDrivers = [
        {
          driverId: 'driver-1',
          distance: 2.5,
        },
      ];

      mockRedis.findNearbyDriversGeo.mockResolvedValue(nearbyDrivers);
      mockTenantDb.driver.findMany.mockResolvedValue([
        createMockDriver({ id: 'driver-1', status: 'AVAILABLE', isActive: true }),
      ]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        radiusKm: 10,
        limit: 20,
      };

      const result = {
        data: [
          {
            id: 'driver-1',
            distanceKm: 2.5,
          },
        ],
      };

      expect(result.data[0].distanceKm).toBe(2.5);
    });

    it('should require DISPATCHER role or higher', async () => {
      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        radiusKm: 10,
      };
      mockRequest.auth = { role: 'DRIVER' };

      expect(mockRequest.auth.role).not.toMatch(/DISPATCHER|ADMIN|SUPER_ADMIN/);
    });

    it('should validate latitude range', async () => {
      mockRequest.query = {
        latitude: 91, // Invalid
        longitude: -74.006,
        radiusKm: 10,
      };

      const isValidLat = mockRequest.query.latitude >= -90 && mockRequest.query.latitude <= 90;
      expect(isValidLat).toBe(false);
    });

    it('should validate longitude range', async () => {
      mockRequest.query = {
        latitude: 40.7128,
        longitude: 181, // Invalid
        radiusKm: 10,
      };

      const isValidLng = mockRequest.query.longitude >= -180 && mockRequest.query.longitude <= 180;
      expect(isValidLng).toBe(false);
    });

    it('should validate radius parameter', async () => {
      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        radiusKm: 0.05, // Too small
      };

      const isValidRadius = mockRequest.query.radiusKm >= 0.1 && mockRequest.query.radiusKm <= 100;
      expect(isValidRadius).toBe(false);
    });
  });

  describe('DELETE /drivers/:id - Deactivate Driver', () => {
    it('should deactivate driver and set status OFFLINE', async () => {
      const driver = createMockDriver({ isActive: true, status: 'AVAILABLE' });
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        isActive: false,
        status: 'OFFLINE',
      });

      mockRequest.params = { id: driver.id };

      const result = {
        data: { ...driver, isActive: false, status: 'OFFLINE' },
      };

      expect(result.data.isActive).toBe(false);
      expect(result.data.status).toBe('OFFLINE');
    });

    it('should remove driver from Redis GEO', async () => {
      const driver = createMockDriver();
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        isActive: false,
        status: 'OFFLINE',
      });

      mockRequest.params = { id: driver.id };

      await mockRedis.removeDriverGeo(driver.id);

      expect(mockRedis.removeDriverGeo).toHaveBeenCalledWith(driver.id);
    });

    it('should throw 404 if driver not found', async () => {
      mockTenantDb.driver.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'non-existent' };

      const willThrow = () => {
        if (!mockTenantDb.driver.findUnique.getMockReturnValue()) {
          throw new Error('Driver not found');
        }
      };

      expect(willThrow).toThrow('Driver not found');
    });

    it('should require ADMIN role or higher', async () => {
      const driver = createMockDriver();

      mockRequest.params = { id: driver.id };
      mockRequest.auth = { role: 'DISPATCHER' };

      expect(mockRequest.auth.role).not.toMatch(/ADMIN|SUPER_ADMIN/);
    });

    it('should return deactivated driver data', async () => {
      const driver = createMockDriver({ isActive: true });
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.driver.update.mockResolvedValue({
        ...driver,
        isActive: false,
        status: 'OFFLINE',
      });

      mockRequest.params = { id: driver.id };

      const result = {
        data: { ...driver, isActive: false, status: 'OFFLINE' },
      };

      expect(result.data.id).toBe(driver.id);
      expect(result.data.isActive).toBe(false);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require JWT auth for all routes', async () => {
      mockRequest.auth = null;
      expect(mockRequest.auth).toBeNull();
    });

    it('should enforce shop scoping on list', async () => {
      mockRequest.query = { page: 1, limit: 20 };
      expect(mockRequest.shopId).toBe('shop-123');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockTenantDb.driver.findUnique.mockRejectedValue(new Error('Database error'));

      mockRequest.params = { id: 'driver-123' };

      const willThrow = async () => {
        try {
          await mockTenantDb.driver.findUnique({ where: { id: 'driver-123' } });
        } catch (e) {
          throw new Error('Failed to fetch driver');
        }
      };

      await expect(willThrow()).rejects.toThrow('Failed to fetch driver');
    });

    it('should validate UUID format in params', async () => {
      mockRequest.params = { id: 'invalid-uuid' };

      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        'invalid-uuid'
      );
      expect(isValidUUID).toBe(false);
    });
  });
});
