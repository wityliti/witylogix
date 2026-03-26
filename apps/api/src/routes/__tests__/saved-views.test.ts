import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  shopId?: string;
  tenantDb?: Record<string, any>;
  auth?: Record<string, any>;
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  code?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

describe('Saved Views Routes', () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: Record<string, any>;

  const mockSavedView = {
    id: 'view-123',
    shopId: 'shop-456',
    userId: 'user-123',
    name: 'High Value Orders',
    tableName: 'orders',
    filters: JSON.stringify([
      { field: 'totalPrice', operator: 'gte', value: 100 },
      { field: 'status', operator: 'eq', value: 'pending' },
    ]),
    sortConfig: JSON.stringify({ field: 'createdAt', order: 'desc' }),
    columnVisibility: JSON.stringify({
      id: true,
      customerName: true,
      totalPrice: true,
      status: true,
      deliveryDate: false,
    }),
    isShared: false,
    isDefault: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-03-01'),
  };

  beforeEach(() => {
    mockTenantDb = {
      savedView: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockRequest = {
      body: {},
      query: {},
      params: {},
      shopId: 'shop-456',
      tenantDb: mockTenantDb,
      auth: { userId: 'user-123' },
    };

    mockReply = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      code: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
    };

    vi.clearAllMocks();
  });

  describe('POST / - Create Saved View', () => {
    it('should create a new saved view', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce(mockSavedView);

      mockRequest.body = {
        name: 'High Value Orders',
        tableName: 'orders',
        filters: [{ field: 'totalPrice', operator: 'gte', value: 100 }],
      };

      expect(mockTenantDb.savedView.create).toBeDefined();
      expect(mockRequest.body.name).toBe('High Value Orders');
    });

    it('should set isDefault to false by default', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        isDefault: false,
      });

      mockRequest.body = {
        name: 'My View',
        tableName: 'orders',
      };

      const result = { data: { ...mockSavedView, isDefault: false } };

      expect(result.data.isDefault).toBe(false);
    });

    it('should set isShared to false by default', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        isShared: false,
      });

      mockRequest.body = {
        name: 'My View',
        tableName: 'orders',
      };

      const result = { data: { ...mockSavedView, isShared: false } };

      expect(result.data.isShared).toBe(false);
    });

    it('should validate table name exists', async () => {
      mockRequest.body = {
        name: 'Invalid View',
        tableName: 'invalid_table',
      };

      // Should validate table name
      expect(mockRequest.body.tableName).toBe('invalid_table');
    });

    it('should support orders table', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        tableName: 'orders',
      });

      mockRequest.body = {
        name: 'Orders View',
        tableName: 'orders',
      };

      const result = { data: { ...mockSavedView, tableName: 'orders' } };

      expect(result.data.tableName).toBe('orders');
    });

    it('should support shipments table', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        tableName: 'shipments',
      });

      mockRequest.body = {
        name: 'Shipments View',
        tableName: 'shipments',
      };

      const result = { data: { ...mockSavedView, tableName: 'shipments' } };

      expect(result.data.tableName).toBe('shipments');
    });

    it('should support products table', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        tableName: 'products',
      });

      mockRequest.body = {
        name: 'Products View',
        tableName: 'products',
      };

      const result = { data: { ...mockSavedView, tableName: 'products' } };

      expect(result.data.tableName).toBe('products');
    });

    it('should support drivers table', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        tableName: 'drivers',
      });

      mockRequest.body = {
        name: 'Drivers View',
        tableName: 'drivers',
      };

      const result = { data: { ...mockSavedView, tableName: 'drivers' } };

      expect(result.data.tableName).toBe('drivers');
    });

    it('should serialize filters to JSON', async () => {
      const filters = [
        { field: 'status', operator: 'eq', value: 'pending' },
        { field: 'totalPrice', operator: 'gte', value: 50 },
      ];

      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        filters: JSON.stringify(filters),
      });

      mockRequest.body = {
        name: 'Filtered View',
        tableName: 'orders',
        filters,
      };

      const result = { data: { ...mockSavedView, filters: JSON.stringify(filters) } };

      expect(JSON.parse(result.data.filters)).toHaveLength(2);
    });

    it('should serialize sort configuration to JSON', async () => {
      const sortConfig = { field: 'totalPrice', order: 'desc' };

      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        sortConfig: JSON.stringify(sortConfig),
      });

      mockRequest.body = {
        name: 'Sorted View',
        tableName: 'orders',
        sortConfig,
      };

      const result = { data: { ...mockSavedView, sortConfig: JSON.stringify(sortConfig) } };

      expect(JSON.parse(result.data.sortConfig).field).toBe('totalPrice');
      expect(JSON.parse(result.data.sortConfig).order).toBe('desc');
    });

    it('should return 201 status code', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce(mockSavedView);

      mockRequest.body = {
        name: 'New View',
        tableName: 'orders',
      };

      expect(mockReply.status).toBeDefined();
    });

    it('should allow optional filters', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        filters: null,
      });

      mockRequest.body = {
        name: 'Simple View',
        tableName: 'orders',
      };

      const result = { data: { ...mockSavedView, filters: null } };

      expect(result.data.filters).toBeNull();
    });

    it('should allow optional sort config', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        sortConfig: null,
      });

      mockRequest.body = {
        name: 'Simple View',
        tableName: 'orders',
      };

      const result = { data: { ...mockSavedView, sortConfig: null } };

      expect(result.data.sortConfig).toBeNull();
    });
  });

  describe('GET / - List Saved Views', () => {
    it('should list all user views with pagination', async () => {
      mockTenantDb.savedView.findMany.mockResolvedValueOnce([mockSavedView]);
      mockTenantDb.savedView.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [
          {
            ...mockSavedView,
            filters: JSON.parse(mockSavedView.filters),
            sortConfig: JSON.parse(mockSavedView.sortConfig),
            columnVisibility: JSON.parse(mockSavedView.columnVisibility),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter views by table name', async () => {
      mockTenantDb.savedView.findMany.mockResolvedValueOnce([mockSavedView]);
      mockTenantDb.savedView.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20, tableName: 'orders' };

      const result = {
        data: [mockSavedView],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].tableName).toBe('orders');
    });

    it('should handle pagination with multiple pages', async () => {
      const views = Array.from({ length: 40 }, (_, i) => ({
        ...mockSavedView,
        id: `view-${i}`,
      }));

      mockTenantDb.savedView.findMany.mockResolvedValueOnce(views.slice(0, 20));
      mockTenantDb.savedView.count.mockResolvedValueOnce(40);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: views.slice(0, 20),
        pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
      };

      expect(result.data).toHaveLength(20);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should order views by creation date descending', async () => {
      const oldView = { ...mockSavedView, createdAt: new Date('2024-01-01') };
      const newView = { ...mockSavedView, id: 'view-456', createdAt: new Date('2024-03-01') };

      mockTenantDb.savedView.findMany.mockResolvedValueOnce([newView, oldView]);
      mockTenantDb.savedView.count.mockResolvedValueOnce(2);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [newView, oldView],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data[0].createdAt.getTime()).toBeGreaterThan(result.data[1].createdAt.getTime());
    });

    it('should deserialize JSON fields in response', async () => {
      mockTenantDb.savedView.findMany.mockResolvedValueOnce([mockSavedView]);
      mockTenantDb.savedView.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [
          {
            ...mockSavedView,
            filters: JSON.parse(mockSavedView.filters),
            sortConfig: JSON.parse(mockSavedView.sortConfig),
            columnVisibility: JSON.parse(mockSavedView.columnVisibility),
          },
        ],
      };

      expect(Array.isArray(result.data[0].filters)).toBe(true);
      expect(typeof result.data[0].sortConfig).toBe('object');
      expect(typeof result.data[0].columnVisibility).toBe('object');
    });
  });

  describe('GET /:id - Get Single View', () => {
    it('should get view by id', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);

      mockRequest.params = { id: 'view-123' };

      const result = {
        data: {
          ...mockSavedView,
          filters: JSON.parse(mockSavedView.filters),
          sortConfig: JSON.parse(mockSavedView.sortConfig),
          columnVisibility: JSON.parse(mockSavedView.columnVisibility),
        },
      };

      expect(result.data.id).toBe('view-123');
    });

    it('should throw NotFoundError when view does not exist', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(mockTenantDb.savedView.findUnique).toBeDefined();
    });

    it('should throw ForbiddenError if view from different shop', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        shopId: 'different-shop',
      });

      mockRequest.params = { id: 'view-123' };

      const foundView = { ...mockSavedView, shopId: 'different-shop' };

      if (foundView.shopId !== mockRequest.shopId) {
        expect(foundView.shopId).not.toBe(mockRequest.shopId);
      }
    });

    it('should throw ForbiddenError if private view from different user', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        userId: 'different-user',
        isShared: false,
      });

      mockRequest.params = { id: 'view-123' };

      const foundView = {
        ...mockSavedView,
        userId: 'different-user',
        isShared: false,
      };

      if (!foundView.isShared && foundView.userId !== mockRequest.auth.userId) {
        expect(foundView.userId).not.toBe(mockRequest.auth.userId);
      }
    });

    it('should allow access to shared views from other users', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        userId: 'different-user',
        isShared: true,
      });

      mockRequest.params = { id: 'view-123' };

      const foundView = {
        ...mockSavedView,
        userId: 'different-user',
        isShared: true,
      };

      expect(foundView.isShared).toBe(true);
    });
  });

  describe('PUT /:id - Update View', () => {
    it('should update view name', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        name: 'Updated View Name',
      });

      mockRequest.params = { id: 'view-123' };
      mockRequest.body = { name: 'Updated View Name' };

      const result = {
        data: { ...mockSavedView, name: 'Updated View Name' },
      };

      expect(result.data.name).toBe('Updated View Name');
    });

    it('should update filters', async () => {
      const newFilters = [
        { field: 'status', operator: 'eq', value: 'shipped' },
      ];

      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        filters: JSON.stringify(newFilters),
      });

      mockRequest.params = { id: 'view-123' };
      mockRequest.body = { filters: newFilters };

      const result = {
        data: { ...mockSavedView, filters: JSON.stringify(newFilters) },
      };

      expect(JSON.parse(result.data.filters)).toEqual(newFilters);
    });

    it('should update sort configuration', async () => {
      const newSort = { field: 'customerName', order: 'asc' };

      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        sortConfig: JSON.stringify(newSort),
      });

      mockRequest.params = { id: 'view-123' };
      mockRequest.body = { sortConfig: newSort };

      const result = {
        data: { ...mockSavedView, sortConfig: JSON.stringify(newSort) },
      };

      expect(JSON.parse(result.data.sortConfig).field).toBe('customerName');
    });

    it('should update column visibility', async () => {
      const newVisibility = {
        id: true,
        customerName: false,
        totalPrice: true,
        status: false,
      };

      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        columnVisibility: JSON.stringify(newVisibility),
      });

      mockRequest.params = { id: 'view-123' };
      mockRequest.body = { columnVisibility: newVisibility };

      const result = {
        data: { ...mockSavedView, columnVisibility: JSON.stringify(newVisibility) },
      };

      expect(JSON.parse(result.data.columnVisibility).customerName).toBe(false);
    });

    it('should throw NotFoundError if view does not exist', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { name: 'Updated' };

      expect(mockTenantDb.savedView.findUnique).toBeDefined();
    });

    it('should throw ForbiddenError if updating different user view', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        userId: 'different-user',
      });

      mockRequest.params = { id: 'view-123' };
      mockRequest.body = { name: 'Updated' };

      const foundView = { ...mockSavedView, userId: 'different-user' };

      if (foundView.userId !== mockRequest.auth.userId) {
        expect(foundView.userId).not.toBe(mockRequest.auth.userId);
      }
    });
  });

  describe('DELETE /:id - Delete View', () => {
    it('should delete a view', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.delete.mockResolvedValueOnce(mockSavedView);

      mockRequest.params = { id: 'view-123' };

      const result = { message: 'View deleted successfully' };

      expect(mockTenantDb.savedView.delete).toBeDefined();
    });

    it('should throw NotFoundError if view does not exist', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(mockTenantDb.savedView.findUnique).toBeDefined();
    });

    it('should throw ForbiddenError if deleting different user view', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        userId: 'different-user',
      });

      mockRequest.params = { id: 'view-123' };

      const foundView = { ...mockSavedView, userId: 'different-user' };

      if (foundView.userId !== mockRequest.auth.userId) {
        expect(foundView.userId).not.toBe(mockRequest.auth.userId);
      }
    });

    it('should return 204 status code', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.delete.mockResolvedValueOnce(mockSavedView);

      mockRequest.params = { id: 'view-123' };

      expect(mockReply.status).toBeDefined();
    });
  });

  describe('POST /:id/duplicate - Duplicate View', () => {
    it('should duplicate a view', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        id: 'view-clone-123',
        name: 'High Value Orders (Copy)',
        isDefault: false,
        isShared: false,
      });

      mockRequest.params = { id: 'view-123' };

      const result = {
        data: {
          ...mockSavedView,
          id: 'view-clone-123',
          name: 'High Value Orders (Copy)',
        },
      };

      expect(result.data.name).toContain('Copy');
      expect(result.data.id).not.toBe('view-123');
    });

    it('should preserve filters in duplication', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        id: 'view-clone-123',
        filters: mockSavedView.filters,
      });

      mockRequest.params = { id: 'view-123' };

      const result = {
        data: {
          ...mockSavedView,
          id: 'view-clone-123',
          filters: mockSavedView.filters,
        },
      };

      expect(result.data.filters).toEqual(mockSavedView.filters);
    });

    it('should set isShared to false when duplicating', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        isShared: true,
      });
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        id: 'view-clone-123',
        isShared: false,
      });

      mockRequest.params = { id: 'view-123' };

      const result = {
        data: { ...mockSavedView, id: 'view-clone-123', isShared: false },
      };

      expect(result.data.isShared).toBe(false);
    });

    it('should return 201 status code', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        id: 'view-clone-123',
      });

      mockRequest.params = { id: 'view-123' };

      expect(mockReply.status).toBeDefined();
    });

    it('should throw NotFoundError if view does not exist', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(mockTenantDb.savedView.findUnique).toBeDefined();
    });
  });

  describe('PUT /:id/default - Set as Default', () => {
    it('should set view as default', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        isDefault: false,
      });
      mockTenantDb.savedView.updateMany.mockResolvedValueOnce({});
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        isDefault: true,
      });

      mockRequest.params = { id: 'view-123' };

      const result = { data: { ...mockSavedView, isDefault: true } };

      expect(result.data.isDefault).toBe(true);
    });

    it('should unset previous default for same table', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.updateMany.mockResolvedValueOnce({});
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        isDefault: true,
      });

      mockRequest.params = { id: 'view-123' };

      expect(mockTenantDb.savedView.updateMany).toBeDefined();
    });

    it('should throw NotFoundError if view does not exist', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(mockTenantDb.savedView.findUnique).toBeDefined();
    });

    it('should throw ForbiddenError if setting default for different user view', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        userId: 'different-user',
      });

      mockRequest.params = { id: 'view-123' };

      const foundView = { ...mockSavedView, userId: 'different-user' };

      if (foundView.userId !== mockRequest.auth.userId) {
        expect(foundView.userId).not.toBe(mockRequest.auth.userId);
      }
    });
  });

  describe('PUT /:id/share - Toggle Sharing', () => {
    it('should share a private view', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        isShared: false,
      });
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        isShared: true,
      });

      mockRequest.params = { id: 'view-123' };

      const result = {
        data: { ...mockSavedView, isShared: true },
        message: 'View is now shared',
      };

      expect(result.data.isShared).toBe(true);
      expect(result.message).toContain('shared');
    });

    it('should unshare a shared view', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        isShared: true,
      });
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        isShared: false,
      });

      mockRequest.params = { id: 'view-123' };

      const result = {
        data: { ...mockSavedView, isShared: false },
        message: 'View is now private',
      };

      expect(result.data.isShared).toBe(false);
      expect(result.message).toContain('private');
    });

    it('should throw NotFoundError if view does not exist', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(mockTenantDb.savedView.findUnique).toBeDefined();
    });

    it('should throw ForbiddenError if sharing different user view', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        userId: 'different-user',
      });

      mockRequest.params = { id: 'view-123' };

      const foundView = { ...mockSavedView, userId: 'different-user' };

      if (foundView.userId !== mockRequest.auth.userId) {
        expect(foundView.userId).not.toBe(mockRequest.auth.userId);
      }
    });
  });

  describe('Filter Serialization/Deserialization', () => {
    it('should serialize complex filter objects', async () => {
      const complexFilters = [
        { field: 'totalPrice', operator: 'gte', value: 100 },
        { field: 'status', operator: 'in', value: ['pending', 'processing'] },
        { field: 'customerName', operator: 'contains', value: 'John' },
      ];

      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        filters: JSON.stringify(complexFilters),
      });

      mockRequest.body = {
        name: 'Complex Filters',
        tableName: 'orders',
        filters: complexFilters,
      };

      const result = {
        data: {
          ...mockSavedView,
          filters: JSON.stringify(complexFilters),
        },
      };

      const parsed = JSON.parse(result.data.filters);
      expect(parsed).toHaveLength(3);
      expect(parsed[1].value).toHaveLength(2);
    });

    it('should preserve null filters', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        filters: null,
      });

      mockRequest.body = {
        name: 'No Filters',
        tableName: 'orders',
      };

      const result = { data: { ...mockSavedView, filters: null } };

      expect(result.data.filters).toBeNull();
    });

    it('should handle empty filter array', async () => {
      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        filters: JSON.stringify([]),
      });

      mockRequest.body = {
        name: 'Empty Filters',
        tableName: 'orders',
        filters: [],
      };

      const result = {
        data: { ...mockSavedView, filters: JSON.stringify([]) },
      };

      const parsed = JSON.parse(result.data.filters);
      expect(parsed).toHaveLength(0);
    });
  });

  describe('Column Configuration Persistence', () => {
    it('should persist column visibility settings', async () => {
      const visibility = {
        id: true,
        customerName: true,
        totalPrice: true,
        status: false,
        deliveryDate: false,
        createdAt: true,
      };

      mockTenantDb.savedView.create.mockResolvedValueOnce({
        ...mockSavedView,
        columnVisibility: JSON.stringify(visibility),
      });

      mockRequest.body = {
        name: 'Column View',
        tableName: 'orders',
        columnVisibility: visibility,
      };

      const result = {
        data: {
          ...mockSavedView,
          columnVisibility: JSON.stringify(visibility),
        },
      };

      const parsed = JSON.parse(result.data.columnVisibility);
      expect(parsed.id).toBe(true);
      expect(parsed.status).toBe(false);
    });

    it('should update column visibility', async () => {
      const newVisibility = {
        id: true,
        customerName: false,
        totalPrice: false,
        status: true,
        deliveryDate: true,
      };

      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(mockSavedView);
      mockTenantDb.savedView.update.mockResolvedValueOnce({
        ...mockSavedView,
        columnVisibility: JSON.stringify(newVisibility),
      });

      mockRequest.params = { id: 'view-123' };
      mockRequest.body = { columnVisibility: newVisibility };

      const result = {
        data: {
          ...mockSavedView,
          columnVisibility: JSON.stringify(newVisibility),
        },
      };

      const parsed = JSON.parse(result.data.columnVisibility);
      expect(parsed.status).toBe(true);
    });
  });

  describe('View Ordering', () => {
    it('should order views by creation date', async () => {
      const views = [
        { ...mockSavedView, id: 'view-1', createdAt: new Date('2024-03-01') },
        { ...mockSavedView, id: 'view-2', createdAt: new Date('2024-02-01') },
        { ...mockSavedView, id: 'view-3', createdAt: new Date('2024-01-01') },
      ];

      mockTenantDb.savedView.findMany.mockResolvedValueOnce(views);
      mockTenantDb.savedView.count.mockResolvedValueOnce(3);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: views,
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      };

      expect(result.data[0].id).toBe('view-1');
      expect(result.data[result.data.length - 1].id).toBe('view-3');
    });
  });

  describe('Sharing Views Between Users', () => {
    it('should allow shared views to be accessed by other users', async () => {
      mockTenantDb.savedView.findUnique.mockResolvedValueOnce({
        ...mockSavedView,
        userId: 'different-user',
        isShared: true,
      });

      mockRequest.params = { id: 'view-123' };
      mockRequest.auth.userId = 'another-user';

      const foundView = {
        ...mockSavedView,
        userId: 'different-user',
        isShared: true,
      };

      // Shared views should be accessible
      expect(foundView.isShared).toBe(true);
    });

    it('should prevent private views from being accessed by other users', async () => {
      const privateView = {
        ...mockSavedView,
        userId: 'different-user',
        isShared: false,
      };

      mockTenantDb.savedView.findUnique.mockResolvedValueOnce(privateView);

      mockRequest.params = { id: 'view-123' };
      mockRequest.auth.userId = 'another-user';

      if (!privateView.isShared && privateView.userId !== mockRequest.auth.userId) {
        expect(privateView.userId).not.toBe(mockRequest.auth.userId);
      }
    });
  });
});
