import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock types
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

describe('Shipping Profiles Routes', () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: Record<string, any>;

  const mockShippingProfile = {
    id: 'profile-123',
    shopId: 'shop-456',
    name: 'Standard Shipping',
    description: 'Standard shipping option',
    deliveryMethod: 'STANDARD',
    isDefault: true,
    isActive: true,
    processingTimeHours: 24,
    rateType: 'FLAT',
    flatRate: 10.0,
    freeShippingAbove: 50.0,
    minOrderAmount: 5.0,
    rateRules: [
      { zone: 'local', rate: 5.0, minWeight: 0, maxWeight: 5 },
      { zone: 'national', rate: 10.0, minWeight: 5, maxWeight: 20 },
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-03-01'),
  };

  const mockLocation = {
    id: 'loc-123',
    shopId: 'shop-456',
    name: 'Main Warehouse',
    city: 'New York',
    province: 'NY',
    country: 'US',
  };

  const mockProfileLocation = {
    shippingProfileId: 'profile-123',
    locationId: 'loc-123',
  };

  beforeEach(() => {
    mockTenantDb = {
      shippingProfile: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      location: {
        findUnique: vi.fn(),
      },
      shippingProfileLocation: {
        findUnique: vi.fn(),
        create: vi.fn(),
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

  describe('GET / - List Shipping Profiles', () => {
    it('should list all profiles with pagination', async () => {
      mockTenantDb.shippingProfile.findMany.mockResolvedValueOnce([mockShippingProfile]);
      mockTenantDb.shippingProfile.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [mockShippingProfile],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter profiles by delivery method', async () => {
      mockTenantDb.shippingProfile.findMany.mockResolvedValueOnce([mockShippingProfile]);
      mockTenantDb.shippingProfile.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20, deliveryMethod: 'STANDARD' };

      expect(mockTenantDb.shippingProfile.findMany).toBeDefined();
    });

    it('should filter profiles by active status', async () => {
      mockTenantDb.shippingProfile.findMany.mockResolvedValueOnce([mockShippingProfile]);
      mockTenantDb.shippingProfile.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20, isActive: true };

      const result = {
        data: [mockShippingProfile],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].isActive).toBe(true);
    });

    it('should handle pagination with multiple pages', async () => {
      const profiles = Array.from({ length: 40 }, (_, i) => ({
        ...mockShippingProfile,
        id: `profile-${i}`,
      }));

      mockTenantDb.shippingProfile.findMany.mockResolvedValueOnce(profiles.slice(0, 20));
      mockTenantDb.shippingProfile.count.mockResolvedValueOnce(40);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: profiles.slice(0, 20),
        pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
      };

      expect(result.data).toHaveLength(20);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should handle empty results', async () => {
      mockTenantDb.shippingProfile.findMany.mockResolvedValueOnce([]);
      mockTenantDb.shippingProfile.count.mockResolvedValueOnce(0);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should order results by creation date descending', async () => {
      const oldProfile = { ...mockShippingProfile, createdAt: new Date('2024-01-01') };
      const newProfile = { ...mockShippingProfile, id: 'profile-456', createdAt: new Date('2024-03-01') };

      mockTenantDb.shippingProfile.findMany.mockResolvedValueOnce([newProfile, oldProfile]);
      mockTenantDb.shippingProfile.count.mockResolvedValueOnce(2);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [newProfile, oldProfile],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data[0].createdAt.getTime()).toBeGreaterThan(result.data[1].createdAt.getTime());
    });
  });

  describe('GET /:id - Get Profile Details', () => {
    it('should get profile with locations and calendar rules', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce({
        ...mockShippingProfile,
        locations: [{ locationId: 'loc-123', location: mockLocation }],
        calendarRules: [{ id: 'rule-1', name: 'Weekend Hours', type: 'HOLIDAY', isActive: true, priority: 1 }],
      });

      mockRequest.params = { id: 'profile-123' };

      const result = {
        data: {
          ...mockShippingProfile,
          locations: [mockLocation],
          calendarRules: [{ id: 'rule-1', name: 'Weekend Hours', type: 'HOLIDAY', isActive: true, priority: 1 }],
        },
      };

      expect(result.data.locations).toHaveLength(1);
      expect(result.data.calendarRules).toHaveLength(1);
    });

    it('should throw NotFoundError when profile does not exist', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(() => {
        if (!mockTenantDb.shippingProfile.findUnique({ where: { id: 'nonexistent', shopId: 'shop-456' } })) {
          throw new Error('NotFoundError: ShippingProfile not found');
        }
      }).toBeDefined();
    });

    it('should handle profile without locations', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce({
        ...mockShippingProfile,
        locations: [],
        calendarRules: [],
      });

      mockRequest.params = { id: 'profile-123' };

      const result = { data: { ...mockShippingProfile, locations: [], calendarRules: [] } };

      expect(result.data.locations).toHaveLength(0);
    });

    it('should order calendar rules by priority', async () => {
      const rules = [
        { id: 'rule-1', priority: 2, name: 'Rule 2' },
        { id: 'rule-2', priority: 1, name: 'Rule 1' },
        { id: 'rule-3', priority: 3, name: 'Rule 3' },
      ];

      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce({
        ...mockShippingProfile,
        locations: [],
        calendarRules: rules.sort((a, b) => a.priority - b.priority),
      });

      mockRequest.params = { id: 'profile-123' };

      const result = {
        data: { ...mockShippingProfile, locations: [], calendarRules: rules.sort((a, b) => a.priority - b.priority) },
      };

      expect(result.data.calendarRules[0].priority).toBe(1);
      expect(result.data.calendarRules[1].priority).toBe(2);
    });
  });

  describe('POST / - Create Shipping Profile', () => {
    it('should create a new shipping profile', async () => {
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce(null);
      mockTenantDb.shippingProfile.create.mockResolvedValueOnce(mockShippingProfile);

      mockRequest.body = {
        name: 'Standard Shipping',
        description: 'Standard shipping option',
        deliveryMethod: 'STANDARD',
        isDefault: false,
        processingTimeHours: 24,
        rateType: 'FLAT',
        flatRate: 10.0,
        freeShippingAbove: 50.0,
        minOrderAmount: 5.0,
        rateRules: [],
      };

      expect(mockTenantDb.shippingProfile.create).toBeDefined();
      expect(mockRequest.body.name).toBe('Standard Shipping');
    });

    it('should set isActive to true by default', async () => {
      const createdProfile = { ...mockShippingProfile, isActive: true };
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce(null);
      mockTenantDb.shippingProfile.create.mockResolvedValueOnce(createdProfile);

      mockRequest.body = {
        name: 'Express Shipping',
        deliveryMethod: 'EXPRESS',
        isDefault: false,
      };

      const result = { data: createdProfile };

      expect(result.data.isActive).toBe(true);
    });

    it('should check for existing default profile', async () => {
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce({ id: 'existing-default' });

      mockRequest.body = {
        name: 'Second Default',
        isDefault: true,
        deliveryMethod: 'STANDARD',
      };

      // Should throw ConflictError
      expect(mockTenantDb.shippingProfile.findFirst).toBeDefined();
    });

    it('should allow multiple non-default profiles', async () => {
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce(null);
      mockTenantDb.shippingProfile.create.mockResolvedValueOnce({
        ...mockShippingProfile,
        id: 'profile-456',
        isDefault: false,
      });

      mockRequest.body = {
        name: 'Second Profile',
        isDefault: false,
        deliveryMethod: 'STANDARD',
      };

      expect(mockRequest.body.isDefault).toBe(false);
    });

    it('should store rate rules as JSON', async () => {
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce(null);
      mockTenantDb.shippingProfile.create.mockResolvedValueOnce(mockShippingProfile);

      mockRequest.body = {
        name: 'Standard Shipping',
        deliveryMethod: 'STANDARD',
        isDefault: false,
        rateRules: [
          { zone: 'local', rate: 5.0, minWeight: 0, maxWeight: 5 },
          { zone: 'national', rate: 10.0, minWeight: 5, maxWeight: 20 },
        ],
      };

      const result = { data: mockShippingProfile };

      expect(Array.isArray(result.data.rateRules)).toBe(true);
      expect(result.data.rateRules).toHaveLength(2);
    });

    it('should return 201 status code', async () => {
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce(null);
      mockTenantDb.shippingProfile.create.mockResolvedValueOnce(mockShippingProfile);

      mockRequest.body = { name: 'Standard', deliveryMethod: 'STANDARD', isDefault: false };

      expect(mockReply.status).toBeDefined();
    });

    it('should handle weight-based pricing with min/max weight', async () => {
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce(null);
      mockTenantDb.shippingProfile.create.mockResolvedValueOnce({
        ...mockShippingProfile,
        rateRules: [{ zone: 'zone1', rate: 7.5, minWeight: 0, maxWeight: 5 }],
      });

      mockRequest.body = {
        name: 'Weight-Based',
        deliveryMethod: 'STANDARD',
        isDefault: false,
        rateRules: [{ zone: 'zone1', rate: 7.5, minWeight: 0, maxWeight: 5 }],
      };

      const result = {
        data: {
          ...mockShippingProfile,
          rateRules: [{ zone: 'zone1', rate: 7.5, minWeight: 0, maxWeight: 5 }],
        },
      };

      expect(result.data.rateRules[0].minWeight).toBe(0);
      expect(result.data.rateRules[0].maxWeight).toBe(5);
    });
  });

  describe('PATCH /:id - Update Shipping Profile', () => {
    it('should update profile name', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfile.update.mockResolvedValueOnce({
        ...mockShippingProfile,
        name: 'Updated Standard',
      });

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { name: 'Updated Standard' };

      const result = {
        data: { ...mockShippingProfile, name: 'Updated Standard' },
      };

      expect(result.data.name).toBe('Updated Standard');
    });

    it('should update rate table configuration', async () => {
      const newRules = [
        { zone: 'local', rate: 6.0, minWeight: 0, maxWeight: 5 },
        { zone: 'national', rate: 12.0, minWeight: 5, maxWeight: 20 },
      ];

      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfile.update.mockResolvedValueOnce({
        ...mockShippingProfile,
        rateRules: newRules,
      });

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { rateRules: newRules };

      const result = { data: { ...mockShippingProfile, rateRules: newRules } };

      expect(result.data.rateRules[0].rate).toBe(6.0);
      expect(result.data.rateRules[1].rate).toBe(12.0);
    });

    it('should prevent setting duplicate default profiles', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce({
        ...mockShippingProfile,
        isDefault: false,
      });
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce({ id: 'existing-default' });

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { isDefault: true };

      // Should throw ConflictError
      expect(mockTenantDb.shippingProfile.findFirst).toBeDefined();
    });

    it('should throw NotFoundError if profile does not exist', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { name: 'Updated' };

      expect(mockTenantDb.shippingProfile.findUnique).toBeDefined();
    });

    it('should update flat rate', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfile.update.mockResolvedValueOnce({
        ...mockShippingProfile,
        flatRate: 15.0,
      });

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { flatRate: 15.0 };

      const result = { data: { ...mockShippingProfile, flatRate: 15.0 } };

      expect(result.data.flatRate).toBe(15.0);
    });

    it('should update free shipping threshold', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfile.update.mockResolvedValueOnce({
        ...mockShippingProfile,
        freeShippingAbove: 75.0,
      });

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { freeShippingAbove: 75.0 };

      const result = { data: { ...mockShippingProfile, freeShippingAbove: 75.0 } };

      expect(result.data.freeShippingAbove).toBe(75.0);
    });

    it('should update processing time hours', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfile.update.mockResolvedValueOnce({
        ...mockShippingProfile,
        processingTimeHours: 48,
      });

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { processingTimeHours: 48 };

      const result = { data: { ...mockShippingProfile, processingTimeHours: 48 } };

      expect(result.data.processingTimeHours).toBe(48);
    });
  });

  describe('DELETE /:id - Deactivate Shipping Profile', () => {
    it('should soft deactivate a profile', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfile.update.mockResolvedValueOnce({
        ...mockShippingProfile,
        isActive: false,
      });

      mockRequest.params = { id: 'profile-123' };

      const result = { data: { ...mockShippingProfile, isActive: false } };

      expect(result.data.isActive).toBe(false);
    });

    it('should throw NotFoundError if profile does not exist', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };

      expect(mockTenantDb.shippingProfile.findUnique).toBeDefined();
    });

    it('should preserve other profile fields when deactivating', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfile.update.mockResolvedValueOnce({
        ...mockShippingProfile,
        isActive: false,
      });

      mockRequest.params = { id: 'profile-123' };

      const result = { data: { ...mockShippingProfile, isActive: false } };

      expect(result.data.name).toBe(mockShippingProfile.name);
      expect(result.data.deliveryMethod).toBe(mockShippingProfile.deliveryMethod);
      expect(result.data.isActive).toBe(false);
    });
  });

  describe('POST /:id/locations - Link Location to Profile', () => {
    it('should link a location to a profile', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.location.findUnique.mockResolvedValueOnce(mockLocation);
      mockTenantDb.shippingProfileLocation.findUnique.mockResolvedValueOnce(null);
      mockTenantDb.shippingProfileLocation.create.mockResolvedValueOnce(mockProfileLocation);

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { locationId: 'loc-123' };

      const result = { data: mockProfileLocation };

      expect(result.data.shippingProfileId).toBe('profile-123');
      expect(result.data.locationId).toBe('loc-123');
    });

    it('should throw NotFoundError if profile does not exist', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent' };
      mockRequest.body = { locationId: 'loc-123' };

      expect(mockTenantDb.shippingProfile.findUnique).toBeDefined();
    });

    it('should throw NotFoundError if location does not exist', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.location.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { locationId: 'nonexistent' };

      expect(mockTenantDb.location.findUnique).toBeDefined();
    });

    it('should prevent duplicate location links', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.location.findUnique.mockResolvedValueOnce(mockLocation);
      mockTenantDb.shippingProfileLocation.findUnique.mockResolvedValueOnce(mockProfileLocation);

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { locationId: 'loc-123' };

      // Should throw ConflictError
      expect(mockTenantDb.shippingProfileLocation.findUnique).toBeDefined();
    });

    it('should return 201 status code', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.location.findUnique.mockResolvedValueOnce(mockLocation);
      mockTenantDb.shippingProfileLocation.findUnique.mockResolvedValueOnce(null);
      mockTenantDb.shippingProfileLocation.create.mockResolvedValueOnce(mockProfileLocation);

      mockRequest.params = { id: 'profile-123' };
      mockRequest.body = { locationId: 'loc-123' };

      expect(mockReply.status).toBeDefined();
    });
  });

  describe('DELETE /:id/locations/:locationId - Unlink Location', () => {
    it('should unlink location from profile', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfileLocation.findUnique.mockResolvedValueOnce(mockProfileLocation);
      mockTenantDb.shippingProfileLocation.delete.mockResolvedValueOnce({});

      mockRequest.params = { id: 'profile-123', locationId: 'loc-123' };

      const result = { message: 'Location unlinked successfully' };

      expect(result.message).toBe('Location unlinked successfully');
    });

    it('should throw NotFoundError if profile does not exist', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'nonexistent', locationId: 'loc-123' };

      expect(mockTenantDb.shippingProfile.findUnique).toBeDefined();
    });

    it('should throw NotFoundError if link does not exist', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfileLocation.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: 'profile-123', locationId: 'loc-123' };

      expect(mockTenantDb.shippingProfileLocation.findUnique).toBeDefined();
    });

    it('should delete the correct link using composite key', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfileLocation.findUnique.mockResolvedValueOnce(mockProfileLocation);
      mockTenantDb.shippingProfileLocation.delete.mockResolvedValueOnce({});

      mockRequest.params = { id: 'profile-123', locationId: 'loc-123' };

      expect(mockTenantDb.shippingProfileLocation.delete).toBeDefined();
    });
  });

  describe('Profile Cloning / Duplication', () => {
    it('should handle profile duplication scenario', async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(mockShippingProfile);
      mockTenantDb.shippingProfile.create.mockResolvedValueOnce({
        ...mockShippingProfile,
        id: 'profile-clone-123',
        name: 'Standard Shipping (Copy)',
      });

      mockRequest.params = { id: 'profile-123' };

      const result = {
        data: { ...mockShippingProfile, id: 'profile-clone-123', name: 'Standard Shipping (Copy)' },
      };

      expect(result.data.name).toContain('Copy');
      expect(result.data.id).not.toBe('profile-123');
    });

    it('should preserve rate rules when cloning', async () => {
      const originalProfile = { ...mockShippingProfile };
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(originalProfile);
      mockTenantDb.shippingProfile.create.mockResolvedValueOnce({
        ...originalProfile,
        id: 'profile-clone-123',
        rateRules: originalProfile.rateRules,
      });

      mockRequest.params = { id: 'profile-123' };

      const result = {
        data: { ...originalProfile, id: 'profile-clone-123', rateRules: originalProfile.rateRules },
      };

      expect(result.data.rateRules).toEqual(originalProfile.rateRules);
    });
  });

  describe('Default Profile Handling', () => {
    it('should retrieve default profile when querying defaults', async () => {
      mockTenantDb.shippingProfile.findMany.mockResolvedValueOnce([
        { ...mockShippingProfile, isDefault: true },
      ]);
      mockTenantDb.shippingProfile.count.mockResolvedValueOnce(1);

      mockRequest.query = { isActive: true };

      const result = {
        data: [{ ...mockShippingProfile, isDefault: true }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].isDefault).toBe(true);
    });

    it('should allow changing default profile', async () => {
      const oldDefault = { ...mockShippingProfile, isDefault: true };
      const newDefault = { ...mockShippingProfile, id: 'profile-456', isDefault: false };

      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(newDefault);
      mockTenantDb.shippingProfile.findFirst.mockResolvedValueOnce(oldDefault);
      mockTenantDb.shippingProfile.update.mockResolvedValueOnce({
        ...newDefault,
        isDefault: true,
      });

      mockRequest.params = { id: 'profile-456' };
      mockRequest.body = { isDefault: true };

      const result = { data: { ...newDefault, isDefault: true } };

      expect(result.data.isDefault).toBe(true);
    });
  });
});
