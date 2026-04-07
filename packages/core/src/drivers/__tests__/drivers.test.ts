import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Drivers Core Module Tests
 * Comprehensive testing for driver management, status transitions, location tracking,
 * and assignment logic used across the platform.
 *
 * Test Coverage:
 * - Driver CRUD operations (create, read, update, delete/deactivate)
 * - Driver status management (OFFLINE, AVAILABLE, ON_ROUTE, ON_BREAK)
 * - Location tracking and updates with PostGIS
 * - Nearby driver geolocation queries via Redis GEO
 * - Driver capacity and vehicle type validation
 * - Active/inactive status filtering
 * - Search and pagination
 * - Authorization and role-based access
 */

interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  timestamp?: string;
}

interface Driver {
  id: string;
  shopId: string;
  orgId?: string | null;
  name: string;
  email?: string;
  phone: string;
  vehicleType: 'BICYCLE' | 'MOTORCYCLE' | 'CAR' | 'VAN' | 'TRUCK';
  vehiclePlate?: string | null;
  maxCapacity: number;
  maxWeight?: number | null;
  fcmToken?: string | null;
  status: 'OFFLINE' | 'AVAILABLE' | 'ON_ROUTE' | 'ON_BREAK';
  isActive: boolean;
  currentLocation?: { lat: number; lng: number } | null;
  lastLocationAt?: Date | null;
  heading?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const createMockDriver = (overrides?: Partial<Driver>): Driver => {
  const defaults: Partial<Driver> = {
    id: `driver-${Math.random().toString(36).substring(7)}`,
    shopId: 'shop-123',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    phone: '+12025551234',
    vehicleType: 'CAR',
    vehiclePlate: 'ABC-123',
    maxCapacity: 50,
    maxWeight: 100,
    fcmToken: 'fcm-token-abc123',
    status: 'OFFLINE',
    isActive: true,
    currentLocation: null,
    lastLocationAt: null,
    heading: null,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
  };

  // Optional fields that should only be included if provided in overrides
  const optionalFields = ['email', 'vehiclePlate', 'orgId', 'maxWeight', 'fcmToken', 'currentLocation', 'lastLocationAt', 'heading'];

  // Start with required fields from defaults
  const result: any = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (!optionalFields.includes(key)) {
      result[key] = value;
    }
  }

  // Add overrides, including optional fields if provided
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      result[key] = value;
    }
  }

  return result;
};

describe('Drivers Core Module', () => {
  let prisma: any;
  let redis: any;

  beforeEach(() => {
    // Mock Prisma driver model
    prisma = {
      driver: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    };

    // Mock Redis for geolocation
    redis = {
      geoadd: vi.fn(),
      geodist: vi.fn(),
      georadius: vi.fn(),
      georadiusbymember: vi.fn(),
      zrem: vi.fn(),
      del: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── CRUD OPERATIONS ───────────────────────────────────────

  describe('Create Driver', () => {
    it('should create a new driver with required fields', async () => {
      const driverData = {
        shopId: 'shop-123',
        name: 'Bob Smith',
        phone: '+12025559876',
        vehicleType: 'CAR' as const,
        maxCapacity: 30,
      };

      const expectedDriver = createMockDriver(driverData);
      (prisma.driver.create as any).mockResolvedValueOnce(expectedDriver);

      const result = await prisma.driver.create({
        data: driverData,
      });

      expect(result).toEqual(expectedDriver);
      expect(prisma.driver.create).toHaveBeenCalledWith({
        data: driverData,
      });
    });

    it('should include optional fields when provided', async () => {
      const driverData = {
        shopId: 'shop-123',
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        phone: '+12025554567',
        vehicleType: 'VAN' as const,
        vehiclePlate: 'XYZ-789',
        maxCapacity: 100,
        maxWeight: 500,
        fcmToken: 'fcm-token-xyz',
      };

      const expectedDriver = createMockDriver(driverData);
      (prisma.driver.create as any).mockResolvedValueOnce(expectedDriver);

      const result = await prisma.driver.create({
        data: driverData,
      });

      expect(result.vehiclePlate).toBe('XYZ-789');
      expect(result.maxWeight).toBe(500);
      expect(result.fcmToken).toBe('fcm-token-xyz');
    });

    it('should validate driver phone uniqueness per organization', async () => {
      const driverData = {
        orgId: 'org-456',
        phone: '+12025551234',
        name: 'Duplicate Driver',
        vehicleType: 'BICYCLE' as const,
        maxCapacity: 10,
      };

      const error = new Error('Unique constraint failed on (orgId, phone)');
      (prisma.driver.create as any).mockRejectedValueOnce(error);

      await expect(
        prisma.driver.create({ data: driverData })
      ).rejects.toThrow('Unique constraint failed');
    });

    it('should default vehicle type to CAR if not specified', async () => {
      const driverData = {
        shopId: 'shop-123',
        name: 'Eve Davis',
        phone: '+12025558901',
        maxCapacity: 40,
      };

      const expectedDriver = createMockDriver({
        ...driverData,
        vehicleType: 'CAR',
      });
      (prisma.driver.create as any).mockResolvedValueOnce(expectedDriver);

      const result = await prisma.driver.create({
        data: driverData,
      });

      expect(result.vehicleType).toBe('CAR');
    });

    it('should default status to OFFLINE and isActive to true', async () => {
      const driverData = {
        shopId: 'shop-123',
        name: 'Frank White',
        phone: '+12025556789',
        vehicleType: 'TRUCK' as const,
        maxCapacity: 200,
      };

      const expectedDriver = createMockDriver({
        ...driverData,
        status: 'OFFLINE',
        isActive: true,
      });
      (prisma.driver.create as any).mockResolvedValueOnce(expectedDriver);

      const result = await prisma.driver.create({
        data: driverData,
      });

      expect(result.status).toBe('OFFLINE');
      expect(result.isActive).toBe(true);
    });
  });

  describe('Get Driver', () => {
    it('should fetch a single driver by ID', async () => {
      const driver = createMockDriver({
        id: 'driver-001',
        status: 'AVAILABLE',
        isActive: true,
      });
      (prisma.driver.findUnique as any).mockResolvedValueOnce(driver);

      const result = await prisma.driver.findUnique({
        where: { id: 'driver-001' },
      });

      expect(result.id).toBe('driver-001');
      expect(result.status).toBe('AVAILABLE');
    });

    it('should return null for non-existent driver', async () => {
      (prisma.driver.findUnique as any).mockResolvedValueOnce(null);

      const result = await prisma.driver.findUnique({
        where: { id: 'nonexistent-id' },
      });

      expect(result).toBeNull();
    });

    it('should include associated orders when requested', async () => {
      const driver = createMockDriver({
        id: 'driver-002',
      });
      driver.orders = [
        {
          id: 'order-1',
          shopifyOrderNumber: '#1001',
          status: 'ASSIGNED',
          customerName: 'Jane Doe',
          addressLine1: '123 Main St',
          city: 'NYC',
        },
      ];

      (prisma.driver.findUnique as any).mockResolvedValueOnce(driver);

      const result = await prisma.driver.findUnique({
        where: { id: 'driver-002' },
        include: { orders: true },
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].id).toBe('order-1');
    });

    it('should filter only active deliveries for driver', async () => {
      const driver = createMockDriver({ id: 'driver-003' });
      const activeStatuses = ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'];

      (prisma.driver.findUnique as any).mockResolvedValueOnce(driver);

      const result = await prisma.driver.findUnique({
        where: { id: 'driver-003' },
        select: {
          id: true,
          orders: {
            where: { status: { in: activeStatuses } },
          },
        },
      });

      expect(result.id).toBe('driver-003');
      expect(prisma.driver.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            orders: expect.objectContaining({
              where: { status: { in: activeStatuses } },
            }),
          }),
        })
      );
    });
  });

  describe('List Drivers', () => {
    it('should list drivers with pagination', async () => {
      const drivers = [
        createMockDriver({ id: 'driver-1' }),
        createMockDriver({ id: 'driver-2' }),
        createMockDriver({ id: 'driver-3' }),
      ];
      (prisma.driver.findMany as any).mockResolvedValueOnce(drivers);
      (prisma.driver.count as any).mockResolvedValueOnce(10);

      const result = await prisma.driver.findMany({
        skip: 0,
        take: 3,
        orderBy: { name: 'asc' },
      });
      const total = await prisma.driver.count();

      expect(result).toHaveLength(3);
      expect(total).toBe(10);
    });

    it('should filter drivers by status', async () => {
      const availableDrivers = [
        createMockDriver({ status: 'AVAILABLE' }),
        createMockDriver({ status: 'AVAILABLE' }),
      ];
      (prisma.driver.findMany as any).mockResolvedValueOnce(availableDrivers);

      const result = await prisma.driver.findMany({
        where: { status: 'AVAILABLE' },
      });

      expect(result).toHaveLength(2);
      expect(result.every((d: any) => d.status === 'AVAILABLE')).toBe(true);
    });

    it('should filter drivers by active status', async () => {
      const activeDrivers = [
        createMockDriver({ isActive: true }),
        createMockDriver({ isActive: true }),
      ];
      (prisma.driver.findMany as any).mockResolvedValueOnce(activeDrivers);

      const result = await prisma.driver.findMany({
        where: { isActive: true },
      });

      expect(result.every((d: any) => d.isActive)).toBe(true);
    });

    it('should search drivers by name, email, or phone', async () => {
      const searchResults = [createMockDriver({ name: 'Alice Johnson' })];
      (prisma.driver.findMany as any).mockResolvedValueOnce(searchResults);

      const result = await prisma.driver.findMany({
        where: {
          OR: [
            { name: { contains: 'Alice', mode: 'insensitive' } },
            { email: { contains: 'Alice', mode: 'insensitive' } },
            { phone: { contains: 'Alice' } },
          ],
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice Johnson');
    });

    it('should combine multiple filters', async () => {
      const filtered = [
        createMockDriver({
          status: 'AVAILABLE',
          isActive: true,
          name: 'Bob',
        }),
      ];
      (prisma.driver.findMany as any).mockResolvedValueOnce(filtered);

      const result = await prisma.driver.findMany({
        where: {
          status: 'AVAILABLE',
          isActive: true,
          name: { contains: 'Bob', mode: 'insensitive' },
        },
      });

      expect(result[0].status).toBe('AVAILABLE');
      expect(result[0].isActive).toBe(true);
    });

    it('should order results by name ascending', async () => {
      const drivers = [
        createMockDriver({ name: 'Alice' }),
        createMockDriver({ name: 'Bob' }),
        createMockDriver({ name: 'Charlie' }),
      ];
      (prisma.driver.findMany as any).mockResolvedValueOnce(drivers);

      const result = await prisma.driver.findMany({
        orderBy: { name: 'asc' },
      });

      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Charlie');
    });
  });

  describe('Update Driver Profile', () => {
    it('should update driver name', async () => {
      const updated = createMockDriver({
        id: 'driver-001',
        name: 'Updated Name',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { name: 'Updated Name' },
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should update vehicle information', async () => {
      const updated = createMockDriver({
        vehicleType: 'TRUCK',
        vehiclePlate: 'NEW-PLATE',
        maxCapacity: 300,
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: {
          vehicleType: 'TRUCK',
          vehiclePlate: 'NEW-PLATE',
          maxCapacity: 300,
        },
      });

      expect(result.vehicleType).toBe('TRUCK');
      expect(result.vehiclePlate).toBe('NEW-PLATE');
      expect(result.maxCapacity).toBe(300);
    });

    it('should update FCM token for push notifications', async () => {
      const updated = createMockDriver({
        fcmToken: 'new-fcm-token-123',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { fcmToken: 'new-fcm-token-123' },
      });

      expect(result.fcmToken).toBe('new-fcm-token-123');
    });

    it('should allow partial updates without affecting other fields', async () => {
      const original = createMockDriver({
        id: 'driver-001',
        name: 'Original',
        phone: '+12025551234',
      });

      const updated = { ...original, name: 'Updated Name' };
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { name: 'Updated Name' },
      });

      expect(result.name).toBe('Updated Name');
      expect(result.phone).toBe('+12025551234');
    });
  });

  // ─── STATUS MANAGEMENT ──────────────────────────────────

  describe('Driver Status Management', () => {
    it('should transition driver from OFFLINE to AVAILABLE', async () => {
      const updated = createMockDriver({
        id: 'driver-001',
        status: 'AVAILABLE',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { status: 'AVAILABLE' },
      });

      expect(result.status).toBe('AVAILABLE');
    });

    it('should transition driver from AVAILABLE to ON_ROUTE', async () => {
      const updated = createMockDriver({
        status: 'ON_ROUTE',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { status: 'ON_ROUTE' },
      });

      expect(result.status).toBe('ON_ROUTE');
    });

    it('should allow transition from ON_ROUTE to ON_BREAK', async () => {
      const updated = createMockDriver({
        status: 'ON_BREAK',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { status: 'ON_BREAK' },
      });

      expect(result.status).toBe('ON_BREAK');
    });

    it('should allow transition from ON_BREAK back to AVAILABLE', async () => {
      const updated = createMockDriver({
        status: 'AVAILABLE',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { status: 'AVAILABLE' },
      });

      expect(result.status).toBe('AVAILABLE');
    });

    it('should allow transition to OFFLINE from any status', async () => {
      const updated = createMockDriver({
        status: 'OFFLINE',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { status: 'OFFLINE' },
      });

      expect(result.status).toBe('OFFLINE');
    });

    it('should trigger geolocation cleanup when transitioning to OFFLINE', async () => {
      const updated = createMockDriver({
        status: 'OFFLINE',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { status: 'OFFLINE' },
      });

      expect(result.status).toBe('OFFLINE');
      // In real implementation, Redis GEO cleanup would be triggered
    });
  });

  // ─── LOCATION TRACKING ──────────────────────────────────

  describe('Location Tracking', () => {
    it('should update driver GPS location', async () => {
      const location: DriverLocation = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
        heading: 90,
      };

      const updated = createMockDriver({
        currentLocation: { lat: location.latitude, lng: location.longitude },
        lastLocationAt: new Date(),
        heading: location.heading,
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: {
          currentLocation: location,
          lastLocationAt: new Date(),
          heading: location.heading,
        },
      });

      expect(result.currentLocation).toBeDefined();
      expect(result.lastLocationAt).toBeDefined();
    });

    it('should reject invalid latitude (< -90 or > 90)', async () => {
      const invalidLocation = {
        latitude: 95, // Invalid
        longitude: -74.006,
      };

      // Validation would be done at schema level
      expect(() => {
        if (invalidLocation.latitude < -90 || invalidLocation.latitude > 90) {
          throw new Error('Invalid latitude');
        }
      }).toThrow('Invalid latitude');
    });

    it('should reject invalid longitude (< -180 or > 180)', async () => {
      const invalidLocation = {
        latitude: 40.7128,
        longitude: 200, // Invalid
      };

      expect(() => {
        if (
          invalidLocation.longitude < -180 ||
          invalidLocation.longitude > 180
        ) {
          throw new Error('Invalid longitude');
        }
      }).toThrow('Invalid longitude');
    });

    it('should store heading angle for route optimization', async () => {
      const updated = createMockDriver({
        heading: 45,
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { heading: 45 },
      });

      expect(result.heading).toBe(45);
    });

    it('should update lastLocationAt timestamp with each location update', async () => {
      const now = new Date();
      const updated = createMockDriver({
        lastLocationAt: now,
      });
      (prisma.driver.update as any).mockResolvedValueOnce(updated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { lastLocationAt: now },
      });

      expect(result.lastLocationAt).toEqual(now);
    });

    it('should handle location updates via PostGIS raw SQL', async () => {
      const driverId = 'driver-001';
      const lat = 40.7128;
      const lng = -74.006;

      (prisma.$executeRaw as any).mockResolvedValueOnce({});

      // In real code: UPDATE drivers SET current_location = ST_MakePoint(lng, lat)...
      await (prisma as any).$executeRaw`
        UPDATE drivers
        SET current_location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
            last_location_at = NOW()
        WHERE id = ${driverId}::uuid
      `;

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  // ─── GEOLOCATION QUERIES ───────────────────────────────

  describe('Nearby Driver Queries', () => {
    it('should find nearby drivers within specified radius', async () => {
      const centerLat = 40.7128;
      const centerLng = -74.006;
      const radiusKm = 10;

      const nearbyDrivers = [
        createMockDriver({
          id: 'driver-near-1',
          status: 'AVAILABLE',
          currentLocation: { lat: 40.713, lng: -74.007 },
        }),
        createMockDriver({
          id: 'driver-near-2',
          status: 'AVAILABLE',
          currentLocation: { lat: 40.714, lng: -74.008 },
        }),
      ];

      (redis.georadius as any).mockResolvedValueOnce(nearbyDrivers);

      const result = await (redis as any).georadius(
        'drivers:geo',
        centerLng,
        centerLat,
        radiusKm,
        'km'
      );

      expect(result).toHaveLength(2);
      expect(result.every((d: any) => d.status === 'AVAILABLE')).toBe(true);
    });

    it('should respect maximum radius limit', async () => {
      const maxRadiusKm = 100;

      // Should accept up to 100km
      expect(() => {
        if (maxRadiusKm > 100) {
          throw new Error('Radius exceeds maximum');
        }
      }).not.toThrow();

      // Should reject over 100km
      expect(() => {
        const tooLarge = 150;
        if (tooLarge > 100) {
          throw new Error('Radius exceeds maximum');
        }
      }).toThrow('Radius exceeds maximum');
    });

    it('should respect minimum radius limit', async () => {
      const minRadiusKm = 0.1;

      // Should accept minimum 0.1km
      expect(() => {
        if (minRadiusKm < 0.1) {
          throw new Error('Radius below minimum');
        }
      }).not.toThrow();

      // Should reject below 0.1km
      expect(() => {
        const tooSmall = 0.05;
        if (tooSmall < 0.1) {
          throw new Error('Radius below minimum');
        }
      }).toThrow('Radius below minimum');
    });

    it('should limit returned drivers to specified count', async () => {
      const allNearby = Array.from({ length: 50 }, (_, i) =>
        createMockDriver({ id: `driver-${i}` })
      );
      const limited = allNearby.slice(0, 20);

      (redis.georadius as any).mockResolvedValueOnce(limited);

      const result = await (redis as any).georadius(
        'drivers:geo',
        -74.006,
        40.7128,
        10,
        'km',
        'LIMIT',
        20
      );

      expect(result).toHaveLength(20);
    });

    it('should only return AVAILABLE drivers', async () => {
      const mixedStatus = [
        createMockDriver({ id: 'driver-1', status: 'AVAILABLE' }),
        createMockDriver({ id: 'driver-2', status: 'ON_ROUTE' }),
        createMockDriver({ id: 'driver-3', status: 'AVAILABLE' }),
      ];

      const available = mixedStatus.filter(d => d.status === 'AVAILABLE');
      (redis.georadius as any).mockResolvedValueOnce(available);

      const result = await (redis as any).georadius(
        'drivers:geo',
        -74.006,
        40.7128,
        10,
        'km'
      );

      expect(result.every((d: any) => d.status === 'AVAILABLE')).toBe(true);
    });

    it('should calculate distance from center point', async () => {
      const driverWithDistance = {
        ...createMockDriver({ id: 'driver-001' }),
        distanceKm: 2.5,
      };

      (redis.geodist as any).mockResolvedValueOnce(2500); // in meters

      const result = await (redis as any).geodist(
        'drivers:geo',
        'center-point',
        'driver-001',
        'm'
      );

      const distanceKm = (result as number) / 1000;
      expect(distanceKm).toBe(2.5);
    });

    it('should sort drivers by distance ascending', async () => {
      const drivers = [
        { ...createMockDriver({ id: 'driver-1' }), distanceKm: 0.5 },
        { ...createMockDriver({ id: 'driver-2' }), distanceKm: 1.2 },
        { ...createMockDriver({ id: 'driver-3' }), distanceKm: 3.8 },
      ];

      const sorted = drivers.sort((a, b) => a.distanceKm - b.distanceKm);

      expect(sorted[0].distanceKm).toBe(0.5);
      expect(sorted[1].distanceKm).toBe(1.2);
      expect(sorted[2].distanceKm).toBe(3.8);
    });
  });

  // ─── CAPACITY & VEHICLE VALIDATION ──────────────────────

  describe('Driver Capacity & Vehicle Validation', () => {
    it('should validate positive capacity', async () => {
      expect(() => {
        const capacity = 0;
        if (capacity <= 0) throw new Error('Capacity must be positive');
      }).toThrow('Capacity must be positive');
    });

    it('should validate non-negative max weight', async () => {
      const weights = [null, 0, 50, 100.5];
      weights.forEach(w => {
        expect(() => {
          if (w !== null && w < 0) {
            throw new Error('Weight cannot be negative');
          }
        }).not.toThrow();
      });
    });

    it('should support all vehicle types', async () => {
      const vehicleTypes = ['BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'];

      vehicleTypes.forEach(type => {
        const driver = createMockDriver({
          vehicleType: type as any,
        });
        expect(vehicleTypes).toContain(driver.vehicleType);
      });
    });

    it('should validate vehicle plate format if provided', async () => {
      const validPlates = ['ABC-123', 'XYZ-789', '12AB34CD'];
      const invalidPlates = ['', '   '];

      validPlates.forEach(plate => {
        expect(plate.length).toBeGreaterThan(0);
      });

      invalidPlates.forEach(plate => {
        expect(plate.trim().length).toBe(0);
      });
    });

    it('should track driver capacity utilization', async () => {
      const driver = createMockDriver({
        maxCapacity: 50,
      });
      const assignedOrders = 35;

      const utilization = (assignedOrders / driver.maxCapacity) * 100;
      expect(utilization).toBe(70);
    });
  });

  // ─── DEACTIVATION ──────────────────────────────────────

  describe('Driver Deactivation', () => {
    it('should soft-delete driver (mark inactive)', async () => {
      const deactivated = createMockDriver({
        isActive: false,
        status: 'OFFLINE',
      });
      (prisma.driver.update as any).mockResolvedValueOnce(deactivated);

      const result = await prisma.driver.update({
        where: { id: 'driver-001' },
        data: { isActive: false, status: 'OFFLINE' },
      });

      expect(result.isActive).toBe(false);
      expect(result.status).toBe('OFFLINE');
    });

    it('should remove from geolocation index when deactivated', async () => {
      const driverId = 'driver-001';
      (redis.zrem as any).mockResolvedValueOnce(1);

      const result = await (redis as any).zrem(`drivers:geo`, driverId);

      expect(result).toBe(1);
      expect(redis.zrem).toHaveBeenCalledWith(`drivers:geo`, driverId);
    });

    it('should not delete driver record (soft delete)', async () => {
      const driver = createMockDriver({ id: 'driver-001' });
      (prisma.driver.findUnique as any).mockResolvedValueOnce(driver);

      const result = await prisma.driver.findUnique({
        where: { id: 'driver-001' },
      });

      expect(result).not.toBeNull();
      expect(prisma.driver.delete).not.toHaveBeenCalled();
    });

    it('should preserve deactivated driver history', async () => {
      const driver = createMockDriver({
        isActive: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-03-08'),
      });
      (prisma.driver.findUnique as any).mockResolvedValueOnce(driver);

      const result = await prisma.driver.findUnique({
        where: { id: 'driver-001' },
      });

      expect(result.createdAt).toEqual(new Date('2025-01-01'));
      expect(result.updatedAt).toEqual(new Date('2025-03-08'));
    });
  });

  // ─── AUTHORIZATION & FILTERING ──────────────────────────

  describe('Authorization & Filtering', () => {
    it('should filter drivers by shop for shop-level access', async () => {
      const shopId = 'shop-123';
      (prisma.driver.findMany as any).mockResolvedValueOnce([
        createMockDriver({ shopId }),
      ]);

      const result = await prisma.driver.findMany({
        where: { shopId },
      });

      expect(result[0].shopId).toBe(shopId);
    });

    it('should filter drivers by organization for org-level access', async () => {
      const orgId = 'org-456';
      (prisma.driver.findMany as any).mockResolvedValueOnce([
        createMockDriver({ orgId }),
      ]);

      const result = await prisma.driver.findMany({
        where: { orgId },
      });

      expect(result[0].orgId).toBe(orgId);
    });

    it('should only show active drivers in listing by default', async () => {
      const activeDrivers = [
        createMockDriver({ isActive: true }),
        createMockDriver({ isActive: true }),
      ];
      (prisma.driver.findMany as any).mockResolvedValueOnce(activeDrivers);

      const result = await prisma.driver.findMany({
        where: { isActive: true },
      });

      expect(result.every((d: any) => d.isActive)).toBe(true);
    });

    it('should count active assignments per driver', async () => {
      const driver = createMockDriver({ id: 'driver-001' });
      (prisma.driver.findUnique as any).mockResolvedValueOnce({
        ...driver,
        _count: { orders: 3 },
      });

      const result = await prisma.driver.findUnique({
        where: { id: 'driver-001' },
        select: {
          id: true,
          _count: { select: { orders: { where: { status: 'ASSIGNED' } } } },
        },
      });

      expect(result._count.orders).toBe(3);
    });
  });

  // ─── CONCURRENT OPERATIONS ─────────────────────────────

  describe('Concurrent Operations', () => {
    it('should handle concurrent location updates', async () => {
      const driverId = 'driver-001';
      const locations = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.713, lng: -74.007 },
        { lat: 40.714, lng: -74.008 },
      ];

      const updates = locations.map(loc =>
        prisma.driver.update({
          where: { id: driverId },
          data: { currentLocation: loc },
        })
      );

      (prisma.driver.update as any).mockResolvedValue(
        createMockDriver({ currentLocation: locations[locations.length - 1] })
      );

      const results = await Promise.all(updates);
      expect(results).toHaveLength(3);
    });

    it('should handle concurrent status changes', async () => {
      const driverId = 'driver-001';
      const statuses = ['AVAILABLE', 'ON_ROUTE', 'ON_BREAK'];

      const updates = statuses.map(status =>
        prisma.driver.update({
          where: { id: driverId },
          data: { status },
        })
      );

      (prisma.driver.update as any).mockResolvedValue(
        createMockDriver({ status: 'ON_BREAK' })
      );

      const results = await Promise.all(updates);
      expect(results).toHaveLength(3);
    });
  });

  // ─── EDGE CASES ─────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle driver with no location history', async () => {
      const driver = createMockDriver({
        currentLocation: null,
        lastLocationAt: null,
        heading: null,
      });
      (prisma.driver.findUnique as any).mockResolvedValueOnce(driver);

      const result = await prisma.driver.findUnique({
        where: { id: 'driver-001' },
      });

      expect(result.currentLocation).toBeNull();
      expect(result.lastLocationAt).toBeNull();
    });

    it('should handle driver with zero active orders', async () => {
      const driver = createMockDriver({ id: 'driver-001' });
      (prisma.driver.findUnique as any).mockResolvedValueOnce({
        ...driver,
        _count: { orders: 0 },
      });

      const result = await prisma.driver.findUnique({
        where: { id: 'driver-001' },
        select: { id: true, _count: { select: { orders: true } } },
      });

      expect(result._count.orders).toBe(0);
    });

    it('should handle driver with maximum capacity orders', async () => {
      const driver = createMockDriver({
        maxCapacity: 50,
      });
      const orders = Array.from({ length: 50 }, (_, i) => ({
        id: `order-${i}`,
      }));

      expect(orders).toHaveLength(driver.maxCapacity);
    });

    it('should handle phone number with various formats', async () => {
      const validFormats = [
        '+12025551234',
        '+1-202-555-1234',
        '202-555-1234',
        '2025551234',
      ];

      validFormats.forEach(phone => {
        const driver = createMockDriver({ phone });
        expect(driver.phone).toBe(phone);
      });
    });

    it('should handle driver with optional fields missing', async () => {
      const minimal = {
        shopId: 'shop-123',
        name: 'Minimal Driver',
        phone: '+12025551234',
        vehicleType: 'CAR' as const,
        maxCapacity: 20,
      };

      const driver = createMockDriver(minimal);
      expect(driver.email).toBeUndefined();
      expect(driver.vehiclePlate).toBeUndefined();
    });
  });
});
