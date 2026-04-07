/**
 * Admin API Tests
 * Comprehensive test suite for authorization, store/user/customer management, and impersonation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Types
type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';

interface AdminContext {
  userId: string;
  shopId: string;
  role: UserRole;
}

interface Store {
  id: string;
  name: string;
  suspended: boolean;
}

interface User {
  id: string;
  email: string;
  role: UserRole;
  suspended: boolean;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  shopId: string;
}

interface AdminAPIClient {
  authorize(context: AdminContext): void;
  listStores(): Promise<Store[]>;
  getStoreDetail(storeId: string): Promise<Store>;
  suspendStore(storeId: string, reason: string): Promise<void>;
  restoreStore(storeId: string): Promise<void>;
  listUsers(shopId: string): Promise<User[]>;
  changeUserRole(userId: string, newRole: UserRole): Promise<User>;
  suspendUser(userId: string, reason: string): Promise<void>;
  restoreUser(userId: string): Promise<void>;
  listCustomers(filters?: any): Promise<Customer[]>;
  getCustomerDetail(customerId: string): Promise<Customer>;
  getDashboardMetrics(): Promise<any>;
  impersonateUser(userId: string): Promise<{ sessionId: string }>;
}

// Mock Prisma client
const mockPrisma = {
  store: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  customer: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  order: {
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  adminAuditLog: {
    create: vi.fn(),
  },
  session: {
    create: vi.fn(),
  },
};

/**
 * Admin API Implementation
 */
class AdminAPI implements AdminAPIClient {
  private context: AdminContext | null = null;

  constructor(private prisma: any) {}

  authorize(context: AdminContext): void {
    if (context.role !== 'SUPER_ADMIN') {
      throw new Error('Unauthorized: Only SUPER_ADMIN can access admin API');
    }
    this.context = context;
  }

  private ensureAuthorized(): AdminContext {
    if (!this.context || this.context.role !== 'SUPER_ADMIN') {
      throw new Error('Unauthorized');
    }
    return this.context;
  }

  private async logAuditEvent(action: string, details: any): Promise<void> {
    const context = this.ensureAuthorized();
    await this.prisma.adminAuditLog.create({
      data: {
        adminId: context.userId,
        action,
        details,
        timestamp: new Date(),
      },
    });
  }

  async listStores(): Promise<Store[]> {
    this.ensureAuthorized();
    return this.prisma.store.findMany({
      select: { id: true, name: true, suspended: true },
    });
  }

  async getStoreDetail(storeId: string): Promise<Store> {
    this.ensureAuthorized();

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return store;
  }

  async suspendStore(storeId: string, reason: string): Promise<void> {
    this.ensureAuthorized();

    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        suspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
    });

    await this.logAuditEvent('SUSPEND_STORE', { storeId, reason });
  }

  async restoreStore(storeId: string): Promise<void> {
    this.ensureAuthorized();

    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        suspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    await this.logAuditEvent('RESTORE_STORE', { storeId });
  }

  async listUsers(shopId: string): Promise<User[]> {
    this.ensureAuthorized();

    return this.prisma.user.findMany({
      where: { shopId },
      select: {
        id: true,
        email: true,
        role: true,
        suspended: true,
      },
    });
  }

  async changeUserRole(userId: string, newRole: UserRole): Promise<User> {
    this.ensureAuthorized();

    const validRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MEMBER'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        role: true,
        suspended: true,
      },
    });

    await this.logAuditEvent('CHANGE_USER_ROLE', { userId, newRole });

    return user;
  }

  async suspendUser(userId: string, reason: string): Promise<void> {
    this.ensureAuthorized();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        suspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
      },
    });

    await this.logAuditEvent('SUSPEND_USER', { userId, reason });
  }

  async restoreUser(userId: string): Promise<void> {
    this.ensureAuthorized();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        suspended: false,
        suspensionReason: null,
        suspendedAt: null,
      },
    });

    await this.logAuditEvent('RESTORE_USER', { userId });
  }

  async listCustomers(filters?: any): Promise<Customer[]> {
    this.ensureAuthorized();

    return this.prisma.customer.findMany({
      where: filters ? { ...filters } : {},
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        shopId: true,
      },
    });
  }

  async getCustomerDetail(customerId: string): Promise<Customer> {
    this.ensureAuthorized();

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        shopId: true,
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer;
  }

  async getDashboardMetrics(): Promise<any> {
    this.ensureAuthorized();

    const [
      totalStores,
      totalUsers,
      totalCustomers,
      totalOrders,
      orderStats,
    ] = await Promise.all([
      this.prisma.store.count(),
      this.prisma.user.count(),
      this.prisma.customer.count(),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: { total: true },
        _avg: { total: true },
      }),
    ]);

    return {
      stores: totalStores,
      users: totalUsers,
      customers: totalCustomers,
      orders: totalOrders,
      orderValue: {
        total: orderStats._sum.total || 0,
        average: orderStats._avg.total || 0,
      },
    };
  }

  async impersonateUser(userId: string): Promise<{ sessionId: string }> {
    this.ensureAuthorized();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const session = await this.prisma.session.create({
      data: {
        userId,
        impersonatedBy: this.context!.userId,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    await this.logAuditEvent('IMPERSONATE_USER', { userId });

    return { sessionId: session.id };
  }
}

describe('AdminAPI', () => {
  let api: AdminAPI;
  let adminContext: AdminContext;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new AdminAPI(mockPrisma);
    adminContext = {
      userId: 'admin-1',
      shopId: 'shop-admin',
      role: 'SUPER_ADMIN',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should require SUPER_ADMIN role', () => {
      const memberContext: AdminContext = {
        userId: 'user-1',
        shopId: 'shop-1',
        role: 'MEMBER',
      };

      expect(() => {
        api.authorize(memberContext);
      }).toThrow('Only SUPER_ADMIN can access admin API');
    });

    it('should reject ADMIN role', () => {
      const adminContext: AdminContext = {
        userId: 'admin-1',
        shopId: 'shop-1',
        role: 'ADMIN',
      };

      expect(() => {
        api.authorize(adminContext);
      }).toThrow('Only SUPER_ADMIN can access admin API');
    });

    it('should accept SUPER_ADMIN role', () => {
      expect(() => {
        api.authorize(adminContext);
      }).not.toThrow();
    });

    it('should require authorization for all operations', async () => {
      const unAuthorizedApi = new AdminAPI(mockPrisma);

      await expect(unAuthorizedApi.listStores()).rejects.toThrow('Unauthorized');
    });
  });

  describe('Store Management', () => {
    beforeEach(() => {
      api.authorize(adminContext);
    });

    it('should list all stores', async () => {
      const stores: Store[] = [
        { id: 'store-1', name: 'Store One', suspended: false },
        { id: 'store-2', name: 'Store Two', suspended: false },
      ];

      mockPrisma.store.findMany.mockResolvedValue(stores);

      const result = await api.listStores();

      expect(result).toEqual(stores);
      expect(mockPrisma.store.findMany).toHaveBeenCalled();
    });

    it('should get store detail', async () => {
      const store: Store = {
        id: 'store-1',
        name: 'Store One',
        suspended: false,
      };

      mockPrisma.store.findUnique.mockResolvedValue(store);

      const result = await api.getStoreDetail('store-1');

      expect(result).toEqual(store);
    });

    it('should throw when store not found', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);

      await expect(api.getStoreDetail('non-existent')).rejects.toThrow('Store not found');
    });

    it('should suspend store', async () => {
      const reason = 'Violation of terms of service';

      mockPrisma.store.update.mockResolvedValue({ id: 'store-1' });
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.suspendStore('store-1', reason);

      expect(mockPrisma.store.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: expect.objectContaining({
          suspended: true,
          suspensionReason: reason,
        }),
      });

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'SUSPEND_STORE',
        }),
      });
    });

    it('should restore suspended store', async () => {
      mockPrisma.store.update.mockResolvedValue({ id: 'store-1' });
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.restoreStore('store-1');

      expect(mockPrisma.store.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: expect.objectContaining({
          suspended: false,
        }),
      });
    });

    it('should log audit event when suspending store', async () => {
      mockPrisma.store.update.mockResolvedValue({});
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.suspendStore('store-1', 'Violation');

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: adminContext.userId,
          action: 'SUSPEND_STORE',
        }),
      });
    });
  });

  describe('User Management', () => {
    beforeEach(() => {
      api.authorize(adminContext);
    });

    it('should list users for a shop', async () => {
      const users: User[] = [
        { id: 'user-1', email: 'user1@example.com', role: 'ADMIN', suspended: false },
        { id: 'user-2', email: 'user2@example.com', role: 'MEMBER', suspended: false },
      ];

      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await api.listUsers('shop-1');

      expect(result).toEqual(users);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { shopId: 'shop-1' },
        select: expect.any(Object),
      });
    });

    it('should change user role', async () => {
      const updatedUser: User = {
        id: 'user-1',
        email: 'user1@example.com',
        role: 'ADMIN',
        suspended: false,
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await api.changeUserRole('user-1', 'ADMIN');

      expect(result.role).toBe('ADMIN');
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalled();
    });

    it('should reject invalid role', async () => {
      await expect(
        api.changeUserRole('user-1', 'INVALID_ROLE' as any)
      ).rejects.toThrow('Invalid role');
    });

    it('should suspend user', async () => {
      const reason = 'Suspicious activity';

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.suspendUser('user-1', reason);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          suspended: true,
          suspensionReason: reason,
        }),
      });
    });

    it('should restore suspended user', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.restoreUser('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          suspended: false,
        }),
      });
    });

    it('should log audit event when changing role', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        role: 'ADMIN',
      });
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.changeUserRole('user-1', 'ADMIN');

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CHANGE_USER_ROLE',
          adminId: adminContext.userId,
        }),
      });
    });
  });

  describe('Customer Management', () => {
    beforeEach(() => {
      api.authorize(adminContext);
    });

    it('should list customers across all shops', async () => {
      const customers: Customer[] = [
        {
          id: 'cust-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '555-1234',
          shopId: 'shop-1',
        },
        {
          id: 'cust-2',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-5678',
          shopId: 'shop-2',
        },
      ];

      mockPrisma.customer.findMany.mockResolvedValue(customers);

      const result = await api.listCustomers();

      expect(result).toEqual(customers);
      expect(result).toContainEqual(expect.objectContaining({ shopId: 'shop-1' }));
      expect(result).toContainEqual(expect.objectContaining({ shopId: 'shop-2' }));
    });

    it('should list customers with filters', async () => {
      const customers: Customer[] = [
        {
          id: 'cust-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '555-1234',
          shopId: 'shop-1',
        },
      ];

      mockPrisma.customer.findMany.mockResolvedValue(customers);

      const result = await api.listCustomers({ shopId: 'shop-1' });

      expect(result).toHaveLength(1);
      expect(result[0].shopId).toBe('shop-1');
    });

    it('should get customer detail', async () => {
      const customer: Customer = {
        id: 'cust-1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        shopId: 'shop-1',
      };

      mockPrisma.customer.findUnique.mockResolvedValue(customer);

      const result = await api.getCustomerDetail('cust-1');

      expect(result).toEqual(customer);
    });

    it('should throw when customer not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(api.getCustomerDetail('non-existent')).rejects.toThrow('Customer not found');
    });
  });

  describe('Dashboard Metrics', () => {
    beforeEach(() => {
      api.authorize(adminContext);
    });

    it('should return correct aggregate counts', async () => {
      mockPrisma.store.count.mockResolvedValue(10);
      mockPrisma.user.count.mockResolvedValue(50);
      mockPrisma.customer.count.mockResolvedValue(500);
      mockPrisma.order.count.mockResolvedValue(1000);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: 50000 },
        _avg: { total: 50 },
      });

      const metrics = await api.getDashboardMetrics();

      expect(metrics.stores).toBe(10);
      expect(metrics.users).toBe(50);
      expect(metrics.customers).toBe(500);
      expect(metrics.orders).toBe(1000);
      expect(metrics.orderValue.total).toBe(50000);
      expect(metrics.orderValue.average).toBe(50);
    });

    it('should handle zero metrics', async () => {
      mockPrisma.store.count.mockResolvedValue(0);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: null },
        _avg: { total: null },
      });

      const metrics = await api.getDashboardMetrics();

      expect(metrics.stores).toBe(0);
      expect(metrics.orderValue.total).toBe(0);
      expect(metrics.orderValue.average).toBe(0);
    });
  });

  describe('Impersonation', () => {
    beforeEach(() => {
      api.authorize(adminContext);
    });

    it('should create impersonation session', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockPrisma.session.create.mockResolvedValue({
        id: 'session-123',
        userId: 'user-1',
        impersonatedBy: adminContext.userId,
      });
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await api.impersonateUser('user-1');

      expect(result.sessionId).toBe('session-123');
    });

    it('should throw when impersonating non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(api.impersonateUser('non-existent')).rejects.toThrow('User not found');
    });

    it('should log impersonation event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.impersonateUser('user-1');

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'IMPERSONATE_USER',
          details: expect.objectContaining({ userId: 'user-1' }),
        }),
      });
    });

    it('should restrict impersonation to admin-only', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.session.create.mockResolvedValue({
        id: 'session-123',
        adminOnly: true,
      });
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const result = await api.impersonateUser('user-1');

      expect(result.sessionId).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    beforeEach(() => {
      api.authorize(adminContext);
    });

    it('should log all administrative actions', async () => {
      mockPrisma.store.findMany.mockResolvedValue([]);
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      // Any admin action should trigger audit logging
      expect(mockPrisma.adminAuditLog.create).toBeDefined();
    });

    it('should include admin ID in audit logs', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.changeUserRole('user-1', 'MEMBER');

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: adminContext.userId,
        }),
      });
    });

    it('should include action details in audit logs', async () => {
      mockPrisma.store.update.mockResolvedValue({});
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      await api.suspendStore('store-1', 'Violation of ToS');

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: expect.objectContaining({
            storeId: 'store-1',
            reason: 'Violation of ToS',
          }),
        }),
      });
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      api.authorize(adminContext);
    });

    it('should handle complete store suspension workflow', async () => {
      mockPrisma.store.update.mockResolvedValue({});
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const reason = 'Payment dispute';

      await api.suspendStore('store-1', reason);
      await api.restoreStore('store-1');

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledTimes(2);
    });

    it('should handle user role promotion', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        role: 'ADMIN',
      });
      mockPrisma.adminAuditLog.create.mockResolvedValue({});

      const user = await api.changeUserRole('user-1', 'ADMIN');

      expect(user.role).toBe('ADMIN');
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalled();
    });

    it('should retrieve complete dashboard snapshot', async () => {
      mockPrisma.store.count.mockResolvedValue(5);
      mockPrisma.user.count.mockResolvedValue(25);
      mockPrisma.customer.count.mockResolvedValue(250);
      mockPrisma.order.count.mockResolvedValue(500);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: 25000 },
        _avg: { total: 50 },
      });

      const metrics = await api.getDashboardMetrics();

      expect(metrics).toHaveProperty('stores');
      expect(metrics).toHaveProperty('users');
      expect(metrics).toHaveProperty('customers');
      expect(metrics).toHaveProperty('orders');
      expect(metrics).toHaveProperty('orderValue');
    });
  });
});
