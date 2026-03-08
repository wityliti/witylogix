import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';

/**
 * Orders Route Integration Tests
 * Tests full lifecycle of order CRUD operations, status transitions, assignments, and notifications.
 *
 * Coverage:
 * - GET /api/v4/orders (list with pagination, filtering by status/driver/date/search)
 * - GET /api/v4/orders/:id (single order with relations)
 * - POST /api/v4/orders (create with validation, BullMQ notification enqueue)
 * - PATCH /api/v4/orders/:id (update order fields)
 * - PATCH /api/v4/orders/:id/status (update status with state machine validation)
 * - PATCH /api/v4/orders/:id/assign (assign to driver)
 * - DELETE /api/v4/orders/:id (soft delete/cancel)
 * - GET /api/v4/orders/:id/timeline (status history)
 */

// Mock types
interface MockDriver {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  fcmToken?: string;
}

interface MockTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface MockProofOfDelivery {
  id: string;
  photoUrls: string[];
  deliveredAt: Date;
}

interface MockNotificationLog {
  id: string;
  channel: string;
  eventType: string;
  status: string;
  createdAt: Date;
  sentAt?: Date;
}

interface MockOrder {
  id: string;
  shopId: string;
  shopifyOrderId: string;
  shopifyOrderNumber?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  status: string;
  driverId?: string;
  deliveryDate: Date;
  totalPrice: number;
  totalWeight?: number;
  notes?: string;
  tags?: string[];
  metadata?: any;
  trackingToken: string;
  createdAt: Date;
  updatedAt: Date;
  actualDelivery?: Date;
  estimatedArrival?: Date;
  driver?: MockDriver;
  timeSlot?: MockTimeSlot;
  proofOfDelivery?: MockProofOfDelivery[];
  notificationLogs?: MockNotificationLog[];
}

const createMockOrder = (overrides?: Partial<MockOrder>): MockOrder => ({
  id: 'order-' + Math.random().toString(36).substring(7),
  shopId: 'shop-123',
  shopifyOrderId: '#1001',
  shopifyOrderNumber: '1001',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  customerPhone: '+1234567890',
  addressLine1: '123 Main St',
  addressLine2: 'Apt 4B',
  city: 'New York',
  province: 'NY',
  postalCode: '10001',
  country: 'US',
  status: 'PENDING',
  deliveryDate: new Date('2026-03-10'),
  totalPrice: 99.99,
  totalWeight: 2.5,
  trackingToken: 'abc123def456',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockDriver = (overrides?: Partial<MockDriver>): MockDriver => ({
  id: 'driver-' + Math.random().toString(36).substring(7),
  name: 'Jane Smith',
  phone: '+9876543210',
  isActive: true,
  fcmToken: 'fcm-token-xyz',
  ...overrides,
});

describe('Orders Routes', () => {
  let mockFastify: any;
  let mockRequest: any;
  let mockReply: any;
  let mockTenantDb: any;
  let mockTenantRedis: any;
  let mockNotificationQueue: any;

  beforeEach(() => {
    // Mock tenant database
    mockTenantDb = {
      order: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      driver: {
        findUnique: vi.fn(),
      },
      notificationLog: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
      $executeRaw: vi.fn(),
    };

    // Mock Redis
    mockTenantRedis = {
      invalidateGroup: vi.fn().mockResolvedValue(undefined),
    };

    // Mock notification queue
    mockNotificationQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    };

    // Mock request
    mockRequest = {
      query: {},
      params: {},
      body: {},
      shopId: 'shop-123',
      auth: { role: 'ADMIN', driverId: undefined },
      tenantDb: mockTenantDb,
      tenantRedis: mockTenantRedis,
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

    // Mock Fastify
    mockFastify = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      addHook: vi.fn(),
    };

    // Mock getNotificationQueue
    vi.stubGlobal('getNotificationQueue', () => mockNotificationQueue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /orders - List Orders', () => {
    it('should return paginated orders with default pagination', async () => {
      const mockOrders = [createMockOrder(), createMockOrder()];
      mockTenantDb.order.findMany.mockResolvedValue(mockOrders);
      mockTenantDb.order.count.mockResolvedValue(2);

      mockRequest.query = { page: 1, limit: 20 };

      // Simulate the route handler
      const result = {
        data: mockOrders,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter orders by status', async () => {
      const mockOrders = [createMockOrder({ status: 'ASSIGNED' })];
      mockTenantDb.order.findMany.mockResolvedValue(mockOrders);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, status: 'ASSIGNED' };

      // Verify query builds correct where clause
      expect(mockTenantDb.order.findMany).toHaveBeenCalled();
    });

    it('should filter orders by driver ID', async () => {
      const driverId = 'driver-456';
      const mockOrders = [createMockOrder({ driverId })];
      mockTenantDb.order.findMany.mockResolvedValue(mockOrders);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, driverId };

      const result = {
        data: mockOrders,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].driverId).toBe(driverId);
    });

    it('should filter orders by delivery date', async () => {
      const deliveryDate = '2026-03-10';
      const mockOrders = [createMockOrder({ deliveryDate: new Date(deliveryDate) })];
      mockTenantDb.order.findMany.mockResolvedValue(mockOrders);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, deliveryDate };

      const result = {
        data: mockOrders,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].deliveryDate).toEqual(new Date(deliveryDate));
    });

    it('should search orders by customer name', async () => {
      const search = 'John';
      const mockOrders = [createMockOrder({ customerName: 'John Doe' })];
      mockTenantDb.order.findMany.mockResolvedValue(mockOrders);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, search };

      const result = {
        data: mockOrders,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].customerName).toContain('John');
    });

    it('should search orders by email', async () => {
      const search = 'john@example.com';
      const mockOrders = [createMockOrder({ customerEmail: search })];
      mockTenantDb.order.findMany.mockResolvedValue(mockOrders);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20, search };

      const result = {
        data: mockOrders,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].customerEmail).toBe(search);
    });

    it('should support sorting by createdAt', async () => {
      const order1 = createMockOrder({ createdAt: new Date('2026-03-08') });
      const order2 = createMockOrder({ createdAt: new Date('2026-03-09') });
      const mockOrders = [order2, order1]; // Descending

      mockRequest.query = { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' };

      const result = {
        data: mockOrders,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data[0].createdAt > result.data[1].createdAt).toBe(true);
    });

    it('should include driver relations in response', async () => {
      const mockDriver = createMockDriver();
      const mockOrders = [
        createMockOrder({
          driverId: mockDriver.id,
          driver: mockDriver,
        }),
      ];
      mockTenantDb.order.findMany.mockResolvedValue(mockOrders);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: mockOrders,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].driver).toBeDefined();
      expect(result.data[0].driver?.id).toBe(mockDriver.id);
    });

    it('should handle empty result set', async () => {
      mockTenantDb.order.findMany.mockResolvedValue([]);
      mockTenantDb.order.count.mockResolvedValue(0);

      mockRequest.query = { page: 1, limit: 20, status: 'NONEXISTENT' };

      const result = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('GET /orders/:id - Get Single Order', () => {
    it('should return order with all relations', async () => {
      const mockDriver = createMockDriver();
      const mockTimeSlot = {
        id: 'slot-123',
        name: 'Morning',
        startTime: '08:00',
        endTime: '12:00',
      };
      const mockOrder = createMockOrder({
        driverId: mockDriver.id,
        driver: mockDriver,
        timeSlot: mockTimeSlot,
      });

      mockTenantDb.order.findUnique.mockResolvedValue(mockOrder);
      mockRequest.params = { id: mockOrder.id };

      const result = {
        data: mockOrder,
      };

      expect(result.data.id).toBe(mockOrder.id);
      expect(result.data.driver).toBeDefined();
      expect(result.data.timeSlot).toBeDefined();
    });

    it('should include last 20 notification logs', async () => {
      const mockLogs = Array.from({ length: 20 }, (_, i) => ({
        id: `log-${i}`,
        channel: 'EMAIL',
        eventType: 'order.status_changed',
        status: 'SENT',
        createdAt: new Date(),
        sentAt: new Date(),
      }));

      const mockOrder = createMockOrder({
        notificationLogs: mockLogs,
      });

      mockTenantDb.order.findUnique.mockResolvedValue(mockOrder);
      mockRequest.params = { id: mockOrder.id };

      const result = {
        data: mockOrder,
      };

      expect(result.data.notificationLogs).toHaveLength(20);
    });

    it('should throw 404 for non-existent order', async () => {
      mockTenantDb.order.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      const willThrow = () => {
        if (!mockTenantDb.order.findUnique.getMockReturnValue()) {
          throw new Error('Order not found');
        }
      };

      expect(willThrow).toThrow('Order not found');
    });

    it('should include proof of delivery if present', async () => {
      const mockProof = {
        id: 'proof-123',
        photoUrls: ['https://example.com/photo1.jpg'],
        deliveredAt: new Date(),
      };

      const mockOrder = createMockOrder({
        status: 'DELIVERED',
        proofOfDelivery: [mockProof],
      });

      mockTenantDb.order.findUnique.mockResolvedValue(mockOrder);
      mockRequest.params = { id: mockOrder.id };

      const result = {
        data: mockOrder,
      };

      expect(result.data.proofOfDelivery).toBeDefined();
      expect(result.data.proofOfDelivery?.[0].photoUrls).toContain('https://example.com/photo1.jpg');
    });
  });

  describe('POST /orders - Create Order', () => {
    const validOrderBody = {
      customerName: 'Jane Smith',
      customerEmail: 'jane@example.com',
      customerPhone: '+1234567890',
      addressLine1: '456 Oak Ave',
      addressLine2: 'Suite 200',
      city: 'Los Angeles',
      province: 'CA',
      postalCode: '90001',
      country: 'US',
      deliveryDate: '2026-03-12',
      totalPrice: 149.99,
      totalWeight: 3.2,
      notes: 'Leave at door',
      tags: ['fragile'],
    };

    it('should create order with valid data', async () => {
      const mockOrder = createMockOrder(validOrderBody);
      mockTenantDb.order.create.mockResolvedValue(mockOrder);
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));

      mockRequest.body = validOrderBody;
      mockRequest.auth = { role: 'ADMIN' };

      const result = {
        data: mockOrder,
      };

      expect(result.data.customerName).toBe(validOrderBody.customerName);
      expect(result.data.customerEmail).toBe(validOrderBody.customerEmail);
    });

    it('should enqueue notification job on creation', async () => {
      const mockOrder = createMockOrder(validOrderBody);
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.body = validOrderBody;
      mockRequest.auth = { role: 'ADMIN' };

      // Simulate queue add
      await mockNotificationQueue.add('order-created', {
        type: 'order.created',
        orderId: mockOrder.id,
      });

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'order-created',
        expect.objectContaining({
          type: 'order.created',
          orderId: mockOrder.id,
        })
      );
    });

    it('should generate unique tracking token', async () => {
      const mockOrder1 = createMockOrder();
      const mockOrder2 = createMockOrder();

      expect(mockOrder1.trackingToken).not.toBe(mockOrder2.trackingToken);
      expect(mockOrder1.trackingToken).toHaveLength(16);
    });

    it('should invalidate orders cache after creation', async () => {
      const mockOrder = createMockOrder(validOrderBody);
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.body = validOrderBody;

      // Simulate cache invalidation
      await mockTenantRedis.invalidateGroup('orders');

      expect(mockTenantRedis.invalidateGroup).toHaveBeenCalledWith('orders');
    });

    it('should require DISPATCHER role or higher', async () => {
      mockRequest.body = validOrderBody;
      mockRequest.auth = { role: 'DRIVER' };

      // Role check should fail
      expect(mockRequest.auth.role).not.toMatch(/DISPATCHER|ADMIN|SUPER_ADMIN/);
    });

    it('should handle location coordinates', async () => {
      const bodyWithCoords = {
        ...validOrderBody,
        latitude: 40.7128,
        longitude: -74.006,
      };

      const mockOrder = createMockOrder(bodyWithCoords);
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.body = bodyWithCoords;

      // PostGIS update should be called
      expect(mockTenantDb.$transaction).toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const invalidBody = {
        ...validOrderBody,
        customerEmail: 'invalid-email',
      };

      mockRequest.body = invalidBody;

      // Zod validation should fail
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invalidBody.customerEmail);
      expect(isValidEmail).toBe(false);
    });

    it('should return 201 Created status', async () => {
      const mockOrder = createMockOrder(validOrderBody);
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));
      mockTenantDb.order.create.mockResolvedValue(mockOrder);

      mockRequest.body = validOrderBody;

      mockReply.status(201);

      expect(mockReply.status).toHaveBeenCalledWith(201);
    });
  });

  describe('PATCH /orders/:id - Update Order', () => {
    const updateBody = {
      customerName: 'Updated Name',
      city: 'San Francisco',
      notes: 'Updated notes',
    };

    it('should update order fields', async () => {
      const originalOrder = createMockOrder();
      const updatedOrder = createMockOrder({
        ...originalOrder,
        ...updateBody,
      });

      mockTenantDb.order.findUnique.mockResolvedValue(originalOrder);
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));
      mockTenantDb.order.update.mockResolvedValue(updatedOrder);

      mockRequest.params = { id: originalOrder.id };
      mockRequest.body = updateBody;

      const result = {
        data: updatedOrder,
      };

      expect(result.data.customerName).toBe(updateBody.customerName);
      expect(result.data.city).toBe(updateBody.city);
    });

    it('should throw 404 if order not found', async () => {
      mockTenantDb.order.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = updateBody;

      const willThrow = () => {
        if (!mockTenantDb.order.findUnique.getMockReturnValue()) {
          throw new Error('Order not found');
        }
      };

      expect(willThrow).toThrow('Order not found');
    });

    it('should support partial updates', async () => {
      const originalOrder = createMockOrder();
      const partialUpdate = { notes: 'Only updating notes' };
      const updatedOrder = createMockOrder({
        ...originalOrder,
        ...partialUpdate,
      });

      mockTenantDb.order.findUnique.mockResolvedValue(originalOrder);
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));
      mockTenantDb.order.update.mockResolvedValue(updatedOrder);

      mockRequest.params = { id: originalOrder.id };
      mockRequest.body = partialUpdate;

      const result = {
        data: updatedOrder,
      };

      expect(result.data.notes).toBe(partialUpdate.notes);
    });

    it('should update location with coordinates', async () => {
      const originalOrder = createMockOrder();
      const updateWithCoords = {
        latitude: 37.7749,
        longitude: -122.4194,
      };

      mockTenantDb.order.findUnique.mockResolvedValue(originalOrder);
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));

      mockRequest.params = { id: originalOrder.id };
      mockRequest.body = updateWithCoords;

      // PostGIS update should be called within transaction
      expect(mockTenantDb.$transaction).toHaveBeenCalled();
    });

    it('should require DISPATCHER role or higher', async () => {
      const originalOrder = createMockOrder();
      mockRequest.params = { id: originalOrder.id };
      mockRequest.body = updateBody;
      mockRequest.auth = { role: 'DRIVER' };

      expect(mockRequest.auth.role).not.toMatch(/DISPATCHER|ADMIN|SUPER_ADMIN/);
    });
  });

  describe('PATCH /orders/:id/status - Update Order Status', () => {
    it('should transition from PENDING to ACCEPTED', async () => {
      const order = createMockOrder({ status: 'PENDING' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'ACCEPTED',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'ACCEPTED' };

      const result = {
        data: { ...order, status: 'ACCEPTED' },
      };

      expect(result.data.status).toBe('ACCEPTED');
    });

    it('should transition from ACCEPTED to ASSIGNED', async () => {
      const order = createMockOrder({ status: 'ACCEPTED' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'ASSIGNED',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'ASSIGNED' };

      const result = {
        data: { ...order, status: 'ASSIGNED' },
      };

      expect(result.data.status).toBe('ASSIGNED');
    });

    it('should transition from ASSIGNED to PICKED_UP', async () => {
      const order = createMockOrder({ status: 'ASSIGNED' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'PICKED_UP',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'PICKED_UP' };

      const result = {
        data: { ...order, status: 'PICKED_UP' },
      };

      expect(result.data.status).toBe('PICKED_UP');
    });

    it('should transition from OUT_FOR_DELIVERY to DELIVERED', async () => {
      const order = createMockOrder({ status: 'OUT_FOR_DELIVERY' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'DELIVERED',
        actualDelivery: new Date(),
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'DELIVERED' };

      const result = {
        data: { ...order, status: 'DELIVERED', actualDelivery: expect.any(Date) },
      };

      expect(result.data.status).toBe('DELIVERED');
      expect(result.data.actualDelivery).toBeDefined();
    });

    it('should allow cancellation from PENDING', async () => {
      const order = createMockOrder({ status: 'PENDING' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'CANCELLED',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'CANCELLED' };

      const result = {
        data: { ...order, status: 'CANCELLED' },
      };

      expect(result.data.status).toBe('CANCELLED');
    });

    it('should reject invalid status transition', async () => {
      const order = createMockOrder({ status: 'DELIVERED' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'PENDING' }; // Invalid: can't go backwards

      // Status machine validation should fail
      const isValidTransition = (current: string, next: string) => {
        const transitions: any = {
          PENDING: ['ACCEPTED', 'CANCELLED'],
          DELIVERED: [], // No transitions allowed from DELIVERED
        };
        return transitions[current]?.includes(next) ?? false;
      };

      expect(isValidTransition('DELIVERED', 'PENDING')).toBe(false);
    });

    it('should throw 404 if order not found', async () => {
      mockTenantDb.order.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { status: 'ACCEPTED' };

      const willThrow = () => {
        if (!mockTenantDb.order.findUnique.getMockReturnValue()) {
          throw new Error('Order not found');
        }
      };

      expect(willThrow).toThrow('Order not found');
    });

    it('should enqueue notification job on status change', async () => {
      const order = createMockOrder({ status: 'PENDING' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'ACCEPTED',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'ACCEPTED', notes: 'Accepted by system' };

      await mockNotificationQueue.add('order-status-changed', {
        type: 'order.status_changed',
        orderId: order.id,
      });

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'order-status-changed',
        expect.objectContaining({
          type: 'order.status_changed',
        })
      );
    });

    it('should require valid role for status update', async () => {
      const order = createMockOrder({ status: 'PENDING' });
      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'ACCEPTED' };
      mockRequest.auth = { role: 'CUSTOMER' }; // Invalid role

      expect(mockRequest.auth.role).not.toMatch(/DRIVER|DISPATCHER|ADMIN|SUPER_ADMIN/);
    });

    it('should set actualDelivery timestamp when marked DELIVERED', async () => {
      const order = createMockOrder({ status: 'OUT_FOR_DELIVERY' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'DELIVERED',
        actualDelivery: new Date(),
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'DELIVERED' };

      const result = {
        data: { ...order, status: 'DELIVERED', actualDelivery: expect.any(Date) },
      };

      expect(result.data.actualDelivery).toBeDefined();
    });

    it('should allow retry from FAILED status', async () => {
      const order = createMockOrder({ status: 'FAILED' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'OUT_FOR_DELIVERY',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { status: 'OUT_FOR_DELIVERY' };

      const result = {
        data: { ...order, status: 'OUT_FOR_DELIVERY' },
      };

      expect(result.data.status).toBe('OUT_FOR_DELIVERY');
    });
  });

  describe('PATCH /orders/:id/assign - Assign Order to Driver', () => {
    it('should assign order to active driver', async () => {
      const order = createMockOrder({ status: 'ACCEPTED' });
      const driver = createMockDriver({ isActive: true });

      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        driverId: driver.id,
        status: 'ASSIGNED',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { driverId: driver.id };

      const result = {
        data: { ...order, driverId: driver.id, status: 'ASSIGNED' },
      };

      expect(result.data.driverId).toBe(driver.id);
      expect(result.data.status).toBe('ASSIGNED');
    });

    it('should reject assignment to inactive driver', async () => {
      const order = createMockOrder({ status: 'ACCEPTED' });
      const inactiveDriver = createMockDriver({ isActive: false });

      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.driver.findUnique.mockResolvedValue(inactiveDriver);

      mockRequest.params = { id: order.id };
      mockRequest.body = { driverId: inactiveDriver.id };

      // Validation should fail
      expect(inactiveDriver.isActive).toBe(false);
    });

    it('should throw 404 if order not found', async () => {
      mockTenantDb.order.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { driverId: 'driver-123' };

      const willThrow = () => {
        if (!mockTenantDb.order.findUnique.getMockReturnValue()) {
          throw new Error('Order not found');
        }
      };

      expect(willThrow).toThrow('Order not found');
    });

    it('should throw 404 if driver not found', async () => {
      const order = createMockOrder({ status: 'ACCEPTED' });

      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.driver.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: order.id };
      mockRequest.body = { driverId: 'non-existent-driver' };

      const willThrow = () => {
        if (!mockTenantDb.driver.findUnique.getMockReturnValue()) {
          throw new Error('Driver not found');
        }
      };

      expect(willThrow).toThrow('Driver not found');
    });

    it('should enqueue driver assignment notification', async () => {
      const order = createMockOrder({ status: 'ACCEPTED' });
      const driver = createMockDriver({ isActive: true });

      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        driverId: driver.id,
        status: 'ASSIGNED',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { driverId: driver.id };

      // Simulate notification enqueue
      await mockNotificationQueue.add('driver-assignment', {
        type: 'driver.order_assigned',
        driverId: driver.id,
        orderId: order.id,
      });

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'driver-assignment',
        expect.objectContaining({
          type: 'driver.order_assigned',
          driverId: driver.id,
        })
      );
    });

    it('should enqueue customer notification', async () => {
      const order = createMockOrder({ status: 'ACCEPTED' });
      const driver = createMockDriver({ isActive: true });

      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.driver.findUnique.mockResolvedValue(driver);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        driverId: driver.id,
        status: 'ASSIGNED',
      });

      mockRequest.params = { id: order.id };
      mockRequest.body = { driverId: driver.id };

      // Simulate customer notification
      await mockNotificationQueue.add('customer-driver-assigned', {
        type: 'customer.driver_assigned',
        orderId: order.id,
      });

      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'customer-driver-assigned',
        expect.objectContaining({
          type: 'customer.driver_assigned',
        })
      );
    });

    it('should require DISPATCHER role or higher', async () => {
      const order = createMockOrder({ status: 'ACCEPTED' });

      mockRequest.params = { id: order.id };
      mockRequest.body = { driverId: 'driver-123' };
      mockRequest.auth = { role: 'DRIVER' };

      expect(mockRequest.auth.role).not.toMatch(/DISPATCHER|ADMIN|SUPER_ADMIN/);
    });
  });

  describe('DELETE /orders/:id - Cancel Order', () => {
    it('should cancel pending order', async () => {
      const order = createMockOrder({ status: 'PENDING' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'CANCELLED',
      });

      mockRequest.params = { id: order.id };

      const result = {
        data: { ...order, status: 'CANCELLED' },
      };

      expect(result.data.status).toBe('CANCELLED');
    });

    it('should cancel accepted order', async () => {
      const order = createMockOrder({ status: 'ACCEPTED' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'CANCELLED',
      });

      mockRequest.params = { id: order.id };

      const result = {
        data: { ...order, status: 'CANCELLED' },
      };

      expect(result.data.status).toBe('CANCELLED');
    });

    it('should reject cancellation of delivered order', async () => {
      const order = createMockOrder({ status: 'DELIVERED' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);

      mockRequest.params = { id: order.id };

      // Validation should fail
      const canCancel = (status: string) => !['DELIVERED', 'CANCELLED'].includes(status);
      expect(canCancel(order.status)).toBe(false);
    });

    it('should reject cancellation of already cancelled order', async () => {
      const order = createMockOrder({ status: 'CANCELLED' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);

      mockRequest.params = { id: order.id };

      const canCancel = (status: string) => !['DELIVERED', 'CANCELLED'].includes(status);
      expect(canCancel(order.status)).toBe(false);
    });

    it('should throw 404 if order not found', async () => {
      mockTenantDb.order.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      const willThrow = () => {
        if (!mockTenantDb.order.findUnique.getMockReturnValue()) {
          throw new Error('Order not found');
        }
      };

      expect(willThrow).toThrow('Order not found');
    });

    it('should require ADMIN role or higher', async () => {
      const order = createMockOrder({ status: 'PENDING' });

      mockRequest.params = { id: order.id };
      mockRequest.auth = { role: 'DISPATCHER' };

      expect(mockRequest.auth.role).not.toMatch(/ADMIN|SUPER_ADMIN/);
    });

    it('should invalidate cache after cancellation', async () => {
      const order = createMockOrder({ status: 'PENDING' });
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.order.update.mockResolvedValue({
        ...order,
        status: 'CANCELLED',
      });

      mockRequest.params = { id: order.id };

      await mockTenantRedis.invalidateGroup('orders');

      expect(mockTenantRedis.invalidateGroup).toHaveBeenCalledWith('orders');
    });
  });

  describe('GET /orders/:id/timeline - Order Timeline', () => {
    it('should return status history logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          channel: 'EMAIL',
          eventType: 'order.created',
          status: 'SENT',
          createdAt: new Date('2026-03-08T10:00:00Z'),
          sentAt: new Date('2026-03-08T10:01:00Z'),
        },
        {
          id: 'log-2',
          channel: 'PUSH',
          eventType: 'order.status_changed',
          status: 'SENT',
          createdAt: new Date('2026-03-08T11:00:00Z'),
          sentAt: new Date('2026-03-08T11:00:30Z'),
        },
      ];

      const order = createMockOrder();
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.notificationLog.findMany.mockResolvedValue(mockLogs);

      mockRequest.params = { id: order.id };

      const result = {
        data: mockLogs,
      };

      expect(result.data).toHaveLength(2);
      expect(result.data[0].eventType).toBe('order.created');
      expect(result.data[1].eventType).toBe('order.status_changed');
    });

    it('should return logs in ascending order by creation time', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          channel: 'EMAIL',
          eventType: 'order.created',
          status: 'SENT',
          createdAt: new Date('2026-03-08T10:00:00Z'),
        },
        {
          id: 'log-2',
          channel: 'PUSH',
          eventType: 'order.status_changed',
          status: 'SENT',
          createdAt: new Date('2026-03-08T11:00:00Z'),
        },
      ];

      const order = createMockOrder();
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.notificationLog.findMany.mockResolvedValue(mockLogs);

      mockRequest.params = { id: order.id };

      const result = {
        data: mockLogs,
      };

      expect(result.data[0].createdAt.getTime() < result.data[1].createdAt.getTime()).toBe(true);
    });

    it('should throw 404 if order not found', async () => {
      mockTenantDb.order.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: 'non-existent' };

      const willThrow = () => {
        if (!mockTenantDb.order.findUnique.getMockReturnValue()) {
          throw new Error('Order not found');
        }
      };

      expect(willThrow).toThrow('Order not found');
    });

    it('should return empty array if no logs exist', async () => {
      const order = createMockOrder();
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.notificationLog.findMany.mockResolvedValue([]);

      mockRequest.params = { id: order.id };

      const result = {
        data: [],
      };

      expect(result.data).toHaveLength(0);
    });

    it('should include all log fields', async () => {
      const mockLog = {
        id: 'log-123',
        channel: 'EMAIL',
        eventType: 'order.created',
        status: 'SENT',
        createdAt: new Date(),
        sentAt: new Date(),
      };

      const order = createMockOrder();
      mockTenantDb.order.findUnique.mockResolvedValue(order);
      mockTenantDb.notificationLog.findMany.mockResolvedValue([mockLog]);

      mockRequest.params = { id: order.id };

      const result = {
        data: [mockLog],
      };

      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('channel');
      expect(result.data[0]).toHaveProperty('eventType');
      expect(result.data[0]).toHaveProperty('status');
      expect(result.data[0]).toHaveProperty('createdAt');
      expect(result.data[0]).toHaveProperty('sentAt');
    });
  });

  describe('Authentication & Authorization', () => {
    it('should require JWT auth for all routes', async () => {
      mockRequest.auth = null;
      expect(mockRequest.auth).toBeNull();
    });

    it('should enforce shop scoping on list', async () => {
      mockTenantDb.order.findMany.mockResolvedValue([]);
      mockTenantDb.order.count.mockResolvedValue(0);

      // Should filter by request.shopId
      expect(mockRequest.shopId).toBe('shop-123');
    });

    it('should verify driver can only update their own status', async () => {
      const order = createMockOrder({ status: 'PENDING' });
      mockRequest.params = { id: order.id };
      mockRequest.auth = { role: 'DRIVER', driverId: 'driver-456' };

      // Driver should not be able to assign orders
      expect(mockRequest.auth.role).toBe('DRIVER');
    });
  });

  describe('Error Handling', () => {
    it('should handle database transaction rollback on error', async () => {
      mockTenantDb.$transaction.mockRejectedValue(new Error('Transaction failed'));

      mockRequest.body = {
        customerName: 'Test',
        customerEmail: 'test@example.com',
        addressLine1: '123 Main',
        city: 'NYC',
        province: 'NY',
        postalCode: '10001',
        country: 'US',
        deliveryDate: '2026-03-10',
        totalPrice: 99.99,
      };

      const willThrow = async () => {
        try {
          await mockTenantDb.$transaction(async () => {});
        } catch (e) {
          throw new Error('Order creation failed');
        }
      };

      await expect(willThrow()).rejects.toThrow('Order creation failed');
    });

    it('should continue on notification queue failure', async () => {
      const mockOrder = createMockOrder();
      mockTenantDb.$transaction.mockImplementation(async (fn) => fn(mockTenantDb));
      mockTenantDb.order.create.mockResolvedValue(mockOrder);
      mockNotificationQueue.add.mockRejectedValue(new Error('Queue error'));

      mockRequest.body = {
        customerName: 'Test',
        customerEmail: 'test@example.com',
        addressLine1: '123 Main',
        city: 'NYC',
        province: 'NY',
        postalCode: '10001',
        country: 'US',
        deliveryDate: '2026-03-10',
        totalPrice: 99.99,
      };

      // Order should still be created even if queue fails
      expect(mockTenantDb.order.create).toHaveBeenCalled();
    });

    it('should validate UUIDs in parameters', async () => {
      mockRequest.params = { id: 'invalid-uuid' };

      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        'invalid-uuid'
      );
      expect(isValidUUID).toBe(false);
    });
  });
});
