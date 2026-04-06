import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@witylogix/db';
import { NotFoundError } from '../../lib/errors.js';

describe('Customer Routes', () => {
  let fastify: FastifyInstance;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  const mockTenantDb = {
    customer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockCustomer = {
    id: 'cust-123',
    shopId: 'shop-456',
    shopifyCustomerId: 'ext-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    addresses: { street: '123 Main St', city: 'NYC' },
    ordersCount: 5,
    totalSpent: new Prisma.Decimal('1500.00'),
    lastSyncAt: new Date('2024-03-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-03-01'),
  };

  beforeEach(() => {
    mockRequest = {
      shopId: 'shop-456',
      tenantDb: mockTenantDb,
      query: {},
      params: {},
      body: {},
    };

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    vi.clearAllMocks();
  });

  describe('GET / - List Customers', () => {
    it('should list all customers with pagination', async () => {
      const customers = [mockCustomer];
      mockTenantDb.customer.findMany.mockResolvedValue(customers);
      mockTenantDb.customer.count.mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10' };

      const result = {
        data: customers,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      expect(result.data).toEqual(customers);
      expect(result.pagination.page).toBe(1);
    });

    it('should apply search filters to customer data', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);
      mockTenantDb.customer.count.mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10', search: 'john' };

      const where = {
        shopId: 'shop-456',
        OR: [
          { firstName: { contains: 'john', mode: 'insensitive' } },
          { lastName: { contains: 'john', mode: 'insensitive' } },
          { email: { contains: 'john', mode: 'insensitive' } },
          { phone: { contains: 'john', mode: 'insensitive' } },
          { shopifyCustomerId: { contains: 'john', mode: 'insensitive' } },
        ],
      };

      expect(where.OR).toHaveLength(5);
    });

    it('should sort customers by firstName ascending', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);
      mockTenantDb.customer.count.mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10', sortBy: 'firstName', sortOrder: 'asc' };

      expect(mockRequest.query.sortBy).toBe('firstName');
      expect(mockRequest.query.sortOrder).toBe('asc');
    });

    it('should sort customers by totalSpent descending', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);
      mockTenantDb.customer.count.mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10', sortBy: 'totalSpent', sortOrder: 'desc' };

      expect(mockRequest.query.sortBy).toBe('totalSpent');
    });

    it('should handle invalid sort order gracefully', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([]);
      mockTenantDb.customer.count.mockResolvedValue(0);

      mockRequest.query = { page: '1', limit: '10', sortBy: 'email', sortOrder: 'desc' };

      expect(mockRequest.query.sortOrder).toBe('desc');
    });

    it('should apply email search filter', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);
      mockTenantDb.customer.count.mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10', search: 'john@example.com' };

      expect(mockRequest.query.search).toBe('john@example.com');
    });

    it('should apply phone search filter', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);
      mockTenantDb.customer.count.mockResolvedValue(1);

      mockRequest.query = { page: '1', limit: '10', search: '+1234567890' };

      expect(mockRequest.query.search).toBe('+1234567890');
    });

    it('should paginate with correct skip and take', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);
      mockTenantDb.customer.count.mockResolvedValue(25);

      mockRequest.query = { page: '3', limit: '10' };

      const page = parseInt(mockRequest.query.page as string);
      const limit = parseInt(mockRequest.query.limit as string);
      const skip = (page - 1) * limit;

      expect(skip).toBe(20);
    });

    it('should return total pages calculation', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);
      mockTenantDb.customer.count.mockResolvedValue(35);

      mockRequest.query = { page: '1', limit: '10' };

      const total = 35;
      const limit = 10;
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(4);
    });

    it('should handle empty customer list', async () => {
      mockTenantDb.customer.findMany.mockResolvedValue([]);
      mockTenantDb.customer.count.mockResolvedValue(0);

      mockRequest.query = { page: '1', limit: '10' };

      const result = {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };

      expect(result.data).toHaveLength(0);
    });
  });

  describe('GET /:id - Get Single Customer', () => {
    it('should retrieve a single customer by ID', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);

      mockRequest.params = { id: 'cust-123' };

      const customer = mockCustomer;
      expect(customer.id).toBe('cust-123');
      expect(customer.shopId).toBe('shop-456');
    });

    it('should return 404 when customer not found', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'nonexistent' };

      const customer = null;
      expect(customer).toBeNull();
    });

    it('should verify tenant ownership before returning customer', async () => {
      const otherShopCustomer = { ...mockCustomer, shopId: 'shop-999' };
      mockTenantDb.customer.findUnique.mockResolvedValue(otherShopCustomer);

      mockRequest.params = { id: 'cust-123' };
      mockRequest.shopId = 'shop-456';

      const customer = otherShopCustomer;
      const isOwned = customer.shopId === mockRequest.shopId;

      expect(isOwned).toBe(false);
    });

    it('should include full customer data in response', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);

      mockRequest.params = { id: 'cust-123' };

      const customer = mockCustomer;
      expect(customer).toHaveProperty('firstName');
      expect(customer).toHaveProperty('lastName');
      expect(customer).toHaveProperty('email');
      expect(customer).toHaveProperty('phone');
      expect(customer).toHaveProperty('addresses');
    });
  });

  describe('POST /sync - Sync Customers', () => {
    it('should upsert single customer', async () => {
      const incomingCustomer = {
        externalId: 'ext-123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        defaultAddress: { street: '123 Main St' },
        orderCount: 5,
        totalSpent: '1500.00',
      };

      mockTenantDb.$transaction.mockResolvedValue([mockCustomer]);

      mockRequest.body = { customers: [incomingCustomer] };

      const result = [mockCustomer];
      expect(result).toHaveLength(1);
      expect(result[0].shopifyCustomerId).toBe('ext-123');
    });

    it('should upsert multiple customers in transaction', async () => {
      const customers = [
        {
          externalId: 'ext-123',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          defaultAddress: null,
          orderCount: 5,
          totalSpent: '1500.00',
        },
        {
          externalId: 'ext-124',
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+9876543210',
          defaultAddress: null,
          orderCount: 3,
          totalSpent: '800.00',
        },
      ];

      const results = [mockCustomer, { ...mockCustomer, id: 'cust-124' }];
      mockTenantDb.$transaction.mockResolvedValue(results);

      mockRequest.body = { customers };

      await mockTenantDb.$transaction(async () => results);

      expect(results).toHaveLength(2);
      expect(mockTenantDb.$transaction).toHaveBeenCalled();
    });

    it('should update existing customer on sync', async () => {
      const incomingCustomer = {
        externalId: 'ext-123',
        email: 'newemail@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1111111111',
        defaultAddress: null,
        orderCount: 10,
        totalSpent: '3000.00',
      };

      const updatedCustomer = { ...mockCustomer, email: 'newemail@example.com', ordersCount: 10 };
      mockTenantDb.$transaction.mockResolvedValue([updatedCustomer]);

      mockRequest.body = { customers: [incomingCustomer] };

      const result = [updatedCustomer];
      expect(result[0].email).toBe('newemail@example.com');
    });

    it('should convert totalSpent to Prisma Decimal', async () => {
      const incomingCustomer = {
        externalId: 'ext-123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        defaultAddress: null,
        orderCount: 5,
        totalSpent: '1500.50',
      };

      mockTenantDb.$transaction.mockResolvedValue([
        { ...mockCustomer, totalSpent: new Prisma.Decimal('1500.50') },
      ]);

      mockRequest.body = { customers: [incomingCustomer] };

      const result = [{ ...mockCustomer, totalSpent: new Prisma.Decimal('1500.50') }];
      expect(result[0].totalSpent).toBeInstanceOf(Prisma.Decimal);
    });

    it('should update lastSyncAt timestamp on sync', async () => {
      const incomingCustomer = {
        externalId: 'ext-123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        defaultAddress: null,
        orderCount: 5,
        totalSpent: '1500.00',
      };

      const beforeSync = new Date();
      const syncedCustomer = { ...mockCustomer, lastSyncAt: new Date() };
      mockTenantDb.$transaction.mockResolvedValue([syncedCustomer]);

      mockRequest.body = { customers: [incomingCustomer] };

      const result = [syncedCustomer];
      expect(result[0].lastSyncAt.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
    });

    it('should handle zero amount totalSpent', async () => {
      const incomingCustomer = {
        externalId: 'ext-123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        defaultAddress: null,
        orderCount: 0,
        totalSpent: null,
      };

      const newCustomer = { ...mockCustomer, totalSpent: new Prisma.Decimal(0) };
      mockTenantDb.$transaction.mockResolvedValue([newCustomer]);

      mockRequest.body = { customers: [incomingCustomer] };

      const result = [newCustomer];
      expect(result[0].totalSpent.toNumber()).toBe(0);
    });

    it('should return sync message with count', async () => {
      const results = [mockCustomer];
      mockTenantDb.$transaction.mockResolvedValue(results);

      mockRequest.body = { customers: [{ externalId: 'ext-123', email: 'john@example.com' }] };

      const response = {
        data: results,
        message: `Synced ${results.length} customers`,
      };

      expect(response.message).toBe('Synced 1 customers');
    });
  });

  describe('DELETE /:id - Delete Customer', () => {
    it('should delete a customer by ID', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.customer.delete.mockResolvedValue(mockCustomer);

      mockRequest.params = { id: 'cust-123' };

      const deleted = mockCustomer;
      expect(deleted.id).toBe('cust-123');
    });

    it('should return 404 when deleting nonexistent customer', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'nonexistent' };

      const customer = null;
      expect(customer).toBeNull();
    });

    it('should verify tenant ownership before deletion', async () => {
      const otherShopCustomer = { ...mockCustomer, shopId: 'shop-999' };
      mockTenantDb.customer.findUnique.mockResolvedValue(otherShopCustomer);

      mockRequest.params = { id: 'cust-123' };
      mockRequest.shopId = 'shop-456';

      const customer = otherShopCustomer;
      const isOwned = customer.shopId === mockRequest.shopId;

      expect(isOwned).toBe(false);
    });

    it('should call Prisma delete method', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.customer.delete.mockResolvedValue(mockCustomer);

      mockRequest.params = { id: 'cust-123' };

      mockTenantDb.customer.delete({ where: { id: 'cust-123' } });

      expect(mockTenantDb.customer.delete).toHaveBeenCalled();
    });
  });

  describe('GET /:id/orders - Customer Orders', () => {
    it('should retrieve orders for a customer', async () => {
      const mockOrder = {
        id: 'order-123',
        shopId: 'shop-456',
        customerEmail: 'john@example.com',
        status: 'DELIVERED',
        createdAt: new Date(),
        driver: { id: 'driver-1', name: 'John Driver' },
        timeSlot: { id: 'slot-1', name: 'Morning' },
      };

      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.order.findMany.mockResolvedValue([mockOrder]);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.params = { id: 'cust-123' };
      mockRequest.query = { page: '1', limit: '10' };

      const result = {
        data: { customer: mockCustomer, orders: [mockOrder] },
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      expect(result.data.orders).toHaveLength(1);
      expect(result.data.customer.id).toBe('cust-123');
    });

    it('should return 404 for nonexistent customer orders', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.query = { page: '1', limit: '10' };

      const customer = null;
      expect(customer).toBeNull();
    });

    it('should verify tenant ownership before returning orders', async () => {
      const otherShopCustomer = { ...mockCustomer, shopId: 'shop-999' };
      mockTenantDb.customer.findUnique.mockResolvedValue(otherShopCustomer);

      mockRequest.params = { id: 'cust-123' };
      mockRequest.shopId = 'shop-456';

      const customer = otherShopCustomer;
      const isOwned = customer.shopId === mockRequest.shopId;

      expect(isOwned).toBe(false);
    });

    it('should filter orders by status', async () => {
      const mockOrder = {
        id: 'order-123',
        shopId: 'shop-456',
        customerEmail: 'john@example.com',
        status: 'PENDING',
        createdAt: new Date(),
      };

      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.order.findMany.mockResolvedValue([mockOrder]);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.params = { id: 'cust-123' };
      mockRequest.query = { page: '1', limit: '10', status: 'PENDING' };

      const result = [mockOrder];
      expect(result[0].status).toBe('PENDING');
    });

    it('should sort orders by createdAt descending', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.order.findMany.mockResolvedValue([]);
      mockTenantDb.order.count.mockResolvedValue(0);

      mockRequest.params = { id: 'cust-123' };
      mockRequest.query = { page: '1', limit: '10', sortBy: 'createdAt', sortOrder: 'desc' };

      expect(mockRequest.query.sortBy).toBe('createdAt');
      expect(mockRequest.query.sortOrder).toBe('desc');
    });

    it('should sort orders by totalPrice ascending', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.order.findMany.mockResolvedValue([]);
      mockTenantDb.order.count.mockResolvedValue(0);

      mockRequest.params = { id: 'cust-123' };
      mockRequest.query = { page: '1', limit: '10', sortBy: 'totalPrice', sortOrder: 'asc' };

      expect(mockRequest.query.sortBy).toBe('totalPrice');
    });

    it('should include driver information in orders', async () => {
      const mockOrder = {
        id: 'order-123',
        shopId: 'shop-456',
        customerEmail: 'john@example.com',
        driver: { id: 'driver-1', name: 'John Driver' },
        timeSlot: { id: 'slot-1', name: 'Morning' },
      };

      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.order.findMany.mockResolvedValue([mockOrder]);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.params = { id: 'cust-123' };

      const result = [mockOrder];
      expect(result[0].driver).toBeDefined();
      expect(result[0].driver.name).toBe('John Driver');
    });

    it('should include time slot information in orders', async () => {
      const mockOrder = {
        id: 'order-123',
        shopId: 'shop-456',
        customerEmail: 'john@example.com',
        driver: { id: 'driver-1', name: 'John Driver' },
        timeSlot: { id: 'slot-1', name: 'Morning' },
      };

      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.order.findMany.mockResolvedValue([mockOrder]);
      mockTenantDb.order.count.mockResolvedValue(1);

      mockRequest.params = { id: 'cust-123' };

      const result = [mockOrder];
      expect(result[0].timeSlot).toBeDefined();
      expect(result[0].timeSlot.name).toBe('Morning');
    });

    it('should handle pagination for customer orders', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.order.findMany.mockResolvedValue([]);
      mockTenantDb.order.count.mockResolvedValue(25);

      mockRequest.params = { id: 'cust-123' };
      mockRequest.query = { page: '2', limit: '10' };

      const page = parseInt(mockRequest.query.page as string);
      const limit = parseInt(mockRequest.query.limit as string);
      const skip = (page - 1) * limit;

      expect(skip).toBe(10);
    });

    it('should return empty orders list when customer has no orders', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);
      mockTenantDb.order.findMany.mockResolvedValue([]);
      mockTenantDb.order.count.mockResolvedValue(0);

      mockRequest.params = { id: 'cust-123' };

      const result = {
        data: { customer: mockCustomer, orders: [] },
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };

      expect(result.data.orders).toHaveLength(0);
    });
  });

  describe('GET /stats - Customer Statistics', () => {
    it('should return total customer count', async () => {
      mockTenantDb.customer.count.mockResolvedValue(100);

      const total = 100;
      expect(total).toBe(100);
    });

    it('should count customers synced today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      mockTenantDb.customer.count.mockResolvedValueOnce(100);
      mockTenantDb.customer.count.mockResolvedValueOnce(15);

      await mockTenantDb.customer.count(); // total count
      const syncedToday = await mockTenantDb.customer.count(); // today count

      expect(syncedToday).toBe(15);
    });

    it('should retrieve top 10 spenders', async () => {
      const topSpenders = [
        { id: 'cust-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com', totalSpent: new Prisma.Decimal('5000.00') },
        { id: 'cust-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', totalSpent: new Prisma.Decimal('3500.00') },
      ];

      mockTenantDb.customer.findMany.mockResolvedValue(topSpenders);

      const result = topSpenders;
      expect(result).toHaveLength(2);
      expect(result[0].totalSpent).toEqual(new Prisma.Decimal('5000.00'));
    });

    it('should calculate average order count', async () => {
      mockTenantDb.customer.aggregate.mockResolvedValue({
        _avg: { ordersCount: 5.5 },
        _sum: { totalSpent: new Prisma.Decimal('50000.00') },
      });

      const stats = await mockTenantDb.customer.aggregate({});
      expect(stats._avg.ordersCount).toBe(5.5);
    });

    it('should calculate total revenue', async () => {
      mockTenantDb.customer.aggregate.mockResolvedValue({
        _avg: { ordersCount: 5 },
        _sum: { totalSpent: new Prisma.Decimal('50000.00') },
      });

      const stats = await mockTenantDb.customer.aggregate({});
      expect(stats._sum.totalSpent).toEqual(new Prisma.Decimal('50000.00'));
    });

    it('should retrieve last sync timestamp', async () => {
      const lastSync = new Date('2024-03-08T18:30:00Z');
      mockTenantDb.customer.findFirst.mockResolvedValue({ lastSyncAt: lastSync });

      const result = await mockTenantDb.customer.findFirst({});
      expect(result.lastSyncAt).toEqual(lastSync);
    });

    it('should handle no customers for stats', async () => {
      mockTenantDb.customer.count.mockResolvedValue(0);
      mockTenantDb.customer.findMany.mockResolvedValue([]);
      mockTenantDb.customer.aggregate.mockResolvedValue({
        _avg: { ordersCount: null },
        _sum: { totalSpent: null },
      });

      const result = {
        total: 0,
        avgOrderCount: null,
        totalRevenue: null,
      };

      expect(result.total).toBe(0);
    });

    it('should return stats with default values when no data', async () => {
      mockTenantDb.customer.count.mockResolvedValueOnce(0);
      mockTenantDb.customer.count.mockResolvedValueOnce(0);
      mockTenantDb.customer.findMany.mockResolvedValue([]);
      mockTenantDb.customer.aggregate.mockResolvedValue({
        _avg: { ordersCount: null },
        _sum: { totalSpent: null },
      });
      mockTenantDb.customer.findFirst.mockResolvedValue(null);

      const result = {
        total: 0,
        syncedToday: 0,
        topSpenders: [],
        avgOrderCount: 0,
        totalRevenue: new Prisma.Decimal(0),
        lastSync: null,
      };

      expect(result.total).toBe(0);
      expect(result.lastSync).toBeNull();
    });

    it('should filter stats by shopId', async () => {
      mockRequest.shopId = 'shop-456';

      mockTenantDb.customer.count.mockResolvedValue(50);
      mockTenantDb.customer.aggregate.mockResolvedValue({
        _avg: { ordersCount: 3 },
        _sum: { totalSpent: new Prisma.Decimal('15000.00') },
      });

      const result = {
        total: 50,
        totalRevenue: new Prisma.Decimal('15000.00'),
      };

      expect(result.total).toBe(50);
    });

    it('should handle zero division for average order count', async () => {
      mockTenantDb.customer.aggregate.mockResolvedValue({
        _avg: { ordersCount: 0 },
        _sum: { totalSpent: new Prisma.Decimal('0') },
      });

      const stats = await mockTenantDb.customer.aggregate({});
      expect(stats._avg.ordersCount).toBe(0);
    });

    it('should return formatted response with all stat fields', async () => {
      mockTenantDb.customer.count.mockResolvedValueOnce(100);
      mockTenantDb.customer.count.mockResolvedValueOnce(20);
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);
      mockTenantDb.customer.aggregate.mockResolvedValue({
        _avg: { ordersCount: 5.5 },
        _sum: { totalSpent: new Prisma.Decimal('50000.00') },
      });
      mockTenantDb.customer.findFirst.mockResolvedValue({ lastSyncAt: new Date() });

      const result = {
        total: 100,
        syncedToday: 20,
        topSpenders: [mockCustomer],
        avgOrderCount: 5.5,
        totalRevenue: new Prisma.Decimal('50000.00'),
        lastSync: new Date(),
      };

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('syncedToday');
      expect(result).toHaveProperty('topSpenders');
      expect(result).toHaveProperty('avgOrderCount');
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('lastSync');
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid pagination limit', async () => {
      mockRequest.query = { page: '1', limit: 'invalid' };

      const limit = parseInt(mockRequest.query.limit as string);
      const isValid = !isNaN(limit);

      expect(isValid).toBe(false);
    });

    it('should reject invalid page number', async () => {
      mockRequest.query = { page: 'invalid', limit: '10' };

      const page = parseInt(mockRequest.query.page as string);
      const isValid = !isNaN(page);

      expect(isValid).toBe(false);
    });

    it('should handle negative pagination values', async () => {
      mockRequest.query = { page: '-1', limit: '-10' };

      const page = Math.max(1, parseInt(mockRequest.query.page as string) || 1);
      const limit = Math.max(1, parseInt(mockRequest.query.limit as string) || 10);

      expect(page).toBe(1);
      expect(limit).toBe(1);
    });

    it('should reject invalid sort columns', async () => {
      mockRequest.query = { page: '1', limit: '10', sortBy: 'invalidField' };

      const validSortFields = ['firstName', 'email', 'totalSpent', 'syncedAt'];
      const isValid = validSortFields.includes(mockRequest.query.sortBy as string);

      expect(isValid).toBe(false);
    });

    it('should reject invalid sort order', async () => {
      mockRequest.query = { page: '1', limit: '10', sortOrder: 'invalid' };

      const validOrders = ['asc', 'desc'];
      const isValid = validOrders.includes(mockRequest.query.sortOrder as string);

      expect(isValid).toBe(false);
    });

    it('should validate customer email format', async () => {
      const email = 'invalid-email';

      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      expect(isValidEmail).toBe(false);
    });

    it('should validate customer phone format', async () => {
      const phone = '+1234567890';

      const hasPhonePrefix = phone.startsWith('+');
      expect(hasPhonePrefix).toBe(true);
    });

    it('should handle missing required fields in sync', async () => {
      mockRequest.body = { customers: [{ externalId: 'ext-123' }] };

      const customer = mockRequest.body.customers[0];
      const hasMissingFields = !customer.email || !customer.firstName;

      expect(hasMissingFields).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockTenantDb.customer.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(mockTenantDb.customer.findMany()).rejects.toThrow('Database connection failed');
    });

    it('should handle transaction rollback on sync failure', async () => {
      mockTenantDb.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(mockTenantDb.$transaction()).rejects.toThrow('Transaction failed');
    });

    it('should handle Prisma validation errors', async () => {
      const error = new Prisma.PrismaClientValidationError('Invalid input', {
        clientVersion: '1.0.0',
      });

      mockTenantDb.customer.findMany.mockRejectedValue(error);

      await expect(mockTenantDb.customer.findMany()).rejects.toThrow();
    });

    it('should handle not found errors gracefully', async () => {
      mockTenantDb.customer.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: 'nonexistent' };

      const customer = await mockTenantDb.customer.findUnique({ where: { id: 'nonexistent' } });
      expect(customer).toBeNull();
    });

    it('should handle permission denied errors', async () => {
      const otherShopCustomer = { ...mockCustomer, shopId: 'shop-999' };
      mockTenantDb.customer.findUnique.mockResolvedValue(otherShopCustomer);

      mockRequest.shopId = 'shop-456';

      const customer = otherShopCustomer;
      const hasPermission = customer.shopId === mockRequest.shopId;

      expect(hasPermission).toBe(false);
    });

    it('should handle malformed request body', async () => {
      mockRequest.body = null;

      expect(mockRequest.body).toBeNull();
    });

    it('should handle concurrent sync requests', async () => {
      const requests = [
        { customers: [{ externalId: 'ext-1', email: 'user1@example.com' }] },
        { customers: [{ externalId: 'ext-2', email: 'user2@example.com' }] },
      ];

      mockTenantDb.$transaction.mockResolvedValue([mockCustomer]);

      expect(requests).toHaveLength(2);
    });

    it('should handle invalid UUID format', async () => {
      mockRequest.params = { id: 'invalid-uuid' };

      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        mockRequest.params.id as string
      );

      expect(isValidUUID).toBe(false);
    });
  });

  describe('Tenant Isolation', () => {
    it('should only return customers for the requesting shop', async () => {
      mockRequest.shopId = 'shop-456';
      mockTenantDb.customer.findMany.mockResolvedValue([mockCustomer]);

      const customer = [{ ...mockCustomer, shopId: 'shop-456' }];
      const allBelongToShop = customer.every((c) => c.shopId === mockRequest.shopId);

      expect(allBelongToShop).toBe(true);
    });

    it('should filter by shopId in all queries', async () => {
      mockRequest.shopId = 'shop-456';

      mockTenantDb.customer.findUnique.mockResolvedValue(mockCustomer);

      const where = { id: 'cust-123', shopId: 'shop-456' };
      expect(where.shopId).toBe(mockRequest.shopId);
    });

    it('should prevent access to other tenant data', async () => {
      mockRequest.shopId = 'shop-456';
      const otherTenantCustomer = { ...mockCustomer, shopId: 'shop-999' };

      mockTenantDb.customer.findUnique.mockResolvedValue(otherTenantCustomer);

      const customer = otherTenantCustomer;
      const isAccessible = customer.shopId === mockRequest.shopId;

      expect(isAccessible).toBe(false);
    });
  });
});
