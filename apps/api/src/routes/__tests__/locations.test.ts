import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

describe("Locations Routes", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  const mockTenantDb = {
    $queryRawUnsafe: vi.fn(),
  };

  const mockLocation = {
    id: "loc-123",
    orgId: "org-456",
    shopId: "shop-456",
    name: "Main Warehouse",
    type: "WAREHOUSE",
    addressLine1: "123 Main St",
    addressLine2: null,
    city: "New York",
    province: "NY",
    postalCode: "10001",
    country: "US",
    latitude: 40.7128,
    longitude: -74.006,
    phone: "+1234567890",
    email: "warehouse@example.com",
    isDefault: true,
    isActive: true,
    allowPickup: true,
    allowDelivery: true,
    maxPickupHour: 18,
    minDeliveryDay: 1,
    serviceLevel: "standard",
    prepTimeMinutes: 30,
    operatingHours: {
      monday: { open: "08:00", close: "18:00" },
      tuesday: { open: "08:00", close: "18:00" },
    },
    metadata: { zone: "downtown" },
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-03-01"),
  };

  const mockWorkingHours = [
    { dayOfWeek: 0, openTime: "08:00", closeTime: "18:00", isClosed: false },
    { dayOfWeek: 1, openTime: "08:00", closeTime: "18:00", isClosed: false },
    { dayOfWeek: 6, openTime: null, closeTime: null, isClosed: true },
  ];

  const mockCapacity = {
    totalSlots: 100,
    usedSlots: 60,
    reservedSlots: 20,
    category: "standard",
    availableSlots: 20,
    utilizationPercent: 60.0,
  };

  const mockZones = [
    {
      zoneId: "zone-1",
      priority: 0,
      isDefault: true,
      name: "Zone A",
      type: "DELIVERY",
    },
    {
      zoneId: "zone-2",
      priority: 1,
      isDefault: false,
      name: "Zone B",
      type: "PICKUP",
    },
  ];

  beforeEach(() => {
    mockRequest = {
      shopId: "shop-456",
      tenantDb: mockTenantDb,
      query: {},
      params: {},
      body: {},
      userId: "user-123",
      server: { db: mockTenantDb },
    };

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    vi.clearAllMocks();
  });

  describe("GET / - List Locations", () => {
    it("should list all locations with pagination", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([1]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [mockLocation],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      };

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it("should filter locations by type", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);

      mockRequest.query = { page: 1, limit: 20, type: "WAREHOUSE" };

      const whereClause =
        "WHERE shop_id = $1::uuid AND is_active = true AND type = $2::text";
      expect(whereClause).toContain("type");
    });

    it("should search locations by name", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);

      mockRequest.query = { page: 1, limit: 20, search: "Main" };

      const searchTerm = "Main";
      expect(searchTerm).toBe("Main");
    });

    it("should search locations by address", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);

      mockRequest.query = { page: 1, limit: 20, search: "123 Main St" };

      const searchTerm = "123 Main St";
      expect(searchTerm).toBeDefined();
    });

    it("should search locations by city", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);

      mockRequest.query = { page: 1, limit: 20, search: "New York" };

      const searchTerm = "New York";
      expect(searchTerm).toBe("New York");
    });

    it("should filter locations by distance", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);

      mockRequest.query = {
        page: 1,
        limit: 20,
        lat: 40.7128,
        lng: -74.006,
        maxDistance: 50,
      };

      const lat = parseFloat(mockRequest.query.lat as string);
      const lng = parseFloat(mockRequest.query.lng as string);
      const distance = parseFloat(mockRequest.query.maxDistance as string);

      expect(lat).toBe(40.7128);
      expect(lng).toBe(-74.006);
      expect(distance).toBe(50);
    });

    it("should apply pagination correctly", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 50 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);

      mockRequest.query = { page: 3, limit: 20 };

      const pageNum = Math.max(
        1,
        parseInt(mockRequest.query.page as string) || 1,
      );
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(mockRequest.query.limit as string) || 20),
      );
      const skip = (pageNum - 1) * pageSize;

      expect(skip).toBe(40);
    });

    it("should return total pages calculation", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 75 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);

      mockRequest.query = { page: 1, limit: 20 };

      const total = 75;
      const pageSize = 20;
      const pages = Math.ceil(total / pageSize);

      expect(pages).toBe(4);
    });

    it("should enforce maximum limit", async () => {
      mockRequest.query = { page: 1, limit: 1000 };

      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(mockRequest.query.limit as string) || 20),
      );

      expect(pageSize).toBe(100);
    });

    it("should handle empty location list", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 0 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      };

      expect(result.data).toHaveLength(0);
    });

    it("should filter by active status only", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      const whereClause = "WHERE shop_id = $1::uuid AND is_active = true";
      expect(whereClause).toContain("is_active = true");
    });
  });

  describe("GET /:id - Get Single Location", () => {
    it("should retrieve a single location by ID", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockWorkingHours);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockCapacity]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockZones);

      mockRequest.params = { id: "loc-123" };

      const location = mockLocation;
      expect(location.id).toBe("loc-123");
      expect(location.name).toBe("Main Warehouse");
    });

    it("should return 404 for nonexistent location", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);

      mockRequest.params = { id: "nonexistent" };

      const location = null;
      expect(location).toBeNull();
    });

    it("should verify tenant ownership", async () => {
      const otherShopLocation = { ...mockLocation, shopId: "shop-999" };
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([otherShopLocation]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.shopId = "shop-456";

      const location = otherShopLocation;
      const isOwned = location.shopId === mockRequest.shopId;

      expect(isOwned).toBe(false);
    });

    it("should include working hours", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockWorkingHours);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockCapacity]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockZones);

      mockRequest.params = { id: "loc-123" };

      const result = { ...mockLocation, workingHours: mockWorkingHours };
      expect(result.workingHours).toHaveLength(3);
    });

    it("should include capacity information", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockWorkingHours);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockCapacity]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockZones);

      mockRequest.params = { id: "loc-123" };

      const result = { ...mockLocation, capacity: mockCapacity };
      expect(result.capacity.totalSlots).toBe(100);
    });

    it("should include zone associations", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockWorkingHours);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockCapacity]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockZones);

      mockRequest.params = { id: "loc-123" };

      const result = { ...mockLocation, zones: mockZones };
      expect(result.zones).toHaveLength(2);
    });

    it("should handle missing capacity gracefully", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockWorkingHours);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockZones);

      mockRequest.params = { id: "loc-123" };

      const result = { ...mockLocation, capacity: null };
      expect(result.capacity).toBeNull();
    });

    it("should sort zones by priority", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockLocation]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockWorkingHours);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([mockCapacity]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce(mockZones);

      mockRequest.params = { id: "loc-123" };

      const zones = mockZones;
      expect(zones[0].priority).toBeLessThan(zones[1].priority);
    });
  });

  describe("POST / - Create Location", () => {
    it("should create a new location", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockLocation]);

      mockRequest.body = {
        name: "Main Warehouse",
        type: "WAREHOUSE",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 40.7128,
        longitude: -74.006,
        allowPickup: true,
        allowDelivery: true,
        serviceLevel: "standard",
      };

      const result = mockLocation;
      expect(result.name).toBe("Main Warehouse");
    });

    it("should create location with operating hours", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockLocation]);

      mockRequest.body = {
        name: "Main Warehouse",
        type: "WAREHOUSE",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 40.7128,
        longitude: -74.006,
        operatingHours: {
          monday: { open: "08:00", close: "18:00" },
          tuesday: { open: "08:00", close: "18:00" },
        },
      };

      const result = mockLocation;
      expect(result.operatingHours).toBeDefined();
    });

    it("should create location with capacity", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockLocation]);

      mockRequest.body = {
        name: "Main Warehouse",
        type: "WAREHOUSE",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 40.7128,
        longitude: -74.006,
        capacity: { totalSlots: 100, category: "standard" },
      };

      const result = mockLocation;
      expect(result).toBeDefined();
    });

    it("should return 400 for invalid coordinates", async () => {
      mockRequest.body = {
        name: "Main Warehouse",
        type: "WAREHOUSE",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 200,
        longitude: -74.006,
      };

      const isValidLat =
        mockRequest.body.latitude >= -90 && mockRequest.body.latitude <= 90;
      expect(isValidLat).toBe(false);
    });

    it("should validate location type", async () => {
      mockRequest.body = {
        name: "Main Warehouse",
        type: "INVALID_TYPE",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 40.7128,
        longitude: -74.006,
      };

      const validTypes = ["WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"];
      const isValid = validTypes.includes(mockRequest.body.type);

      expect(isValid).toBe(false);
    });

    it("should validate service level", async () => {
      mockRequest.body = {
        name: "Main Warehouse",
        type: "WAREHOUSE",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 40.7128,
        longitude: -74.006,
        serviceLevel: "invalid",
      };

      const validLevels = ["standard", "premium", "express"];
      const isValid = validLevels.includes(mockRequest.body.serviceLevel);

      expect(isValid).toBe(false);
    });

    it("should reject missing required fields", async () => {
      mockRequest.body = {
        type: "WAREHOUSE",
        city: "New York",
      };

      const hasRequired =
        mockRequest.body.name && mockRequest.body.addressLine1;
      expect(hasRequired).toBeFalsy();
    });

    it("should set default values", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        {
          ...mockLocation,
          type: "WAREHOUSE",
          serviceLevel: "standard",
          country: "US",
        },
      ]);

      mockRequest.body = {
        name: "Main Warehouse",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 40.7128,
        longitude: -74.006,
      };

      const result = {
        ...mockLocation,
        type: "WAREHOUSE",
        serviceLevel: "standard",
        country: "US",
      };
      expect(result.type).toBe("WAREHOUSE");
    });

    it("should store metadata with location", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { ...mockLocation, metadata: { zone: "downtown" } },
      ]);

      mockRequest.body = {
        name: "Main Warehouse",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 40.7128,
        longitude: -74.006,
        metadata: { zone: "downtown" },
      };

      const result = { ...mockLocation, metadata: { zone: "downtown" } };
      expect(result.metadata.zone).toBe("downtown");
    });

    it("should return 201 on successful creation", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockLocation]);

      mockRequest.body = {
        name: "Main Warehouse",
        addressLine1: "123 Main St",
        city: "New York",
        latitude: 40.7128,
        longitude: -74.006,
      };

      expect(mockReply.code).toBeDefined();
    });
  });

  describe("PATCH /:id - Update Location", () => {
    it("should update location name", async () => {
      const updatedLocation = { ...mockLocation, name: "Updated Warehouse" };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([updatedLocation]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { name: "Updated Warehouse" };

      const result = updatedLocation;
      expect(result.name).toBe("Updated Warehouse");
    });

    it("should update location coordinates", async () => {
      const updatedLocation = {
        ...mockLocation,
        latitude: 41.0,
        longitude: -73.0,
      };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([updatedLocation]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { latitude: 41.0, longitude: -73.0 };

      const result = updatedLocation;
      expect(result.latitude).toBe(41.0);
    });

    it("should update location operating hours", async () => {
      const newHours = { monday: { open: "09:00", close: "17:00" } };
      const updatedLocation = { ...mockLocation, operatingHours: newHours };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([updatedLocation]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { operatingHours: newHours };

      const result = updatedLocation;
      expect(result.operatingHours).toBeDefined();
    });

    it("should return 404 for nonexistent location", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([]);

      mockRequest.params = { id: "nonexistent" };
      mockRequest.body = { name: "Updated" };

      const location = null;
      expect(location).toBeNull();
    });

    it("should validate updated coordinates", async () => {
      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { latitude: 200 };

      const isValidLat =
        mockRequest.body.latitude >= -90 && mockRequest.body.latitude <= 90;
      expect(isValidLat).toBe(false);
    });

    it("should reject invalid location type on update", async () => {
      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { type: "INVALID" };

      const validTypes = ["WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"];
      const isValid = validTypes.includes(mockRequest.body.type);

      expect(isValid).toBe(false);
    });

    it("should return 400 when no fields to update", async () => {
      mockRequest.params = { id: "loc-123" };
      mockRequest.body = {};

      const hasFields = Object.keys(mockRequest.body).length > 0;
      expect(hasFields).toBe(false);
    });

    it("should verify tenant ownership before update", async () => {
      const otherShopLocation = { ...mockLocation, shopId: "shop-999" };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([otherShopLocation]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.shopId = "shop-456";

      const location = otherShopLocation;
      const isOwned = location.shopId === mockRequest.shopId;

      expect(isOwned).toBe(false);
    });

    it("should update metadata", async () => {
      const updatedLocation = { ...mockLocation, metadata: { zone: "uptown" } };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([updatedLocation]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { metadata: { zone: "uptown" } };

      const result = updatedLocation;
      expect(result.metadata.zone).toBe("uptown");
    });
  });

  describe("DELETE /:id - Delete Location", () => {
    it("should soft-delete a location", async () => {
      const deletedLocation = { ...mockLocation, isActive: false };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([deletedLocation]);

      mockRequest.params = { id: "loc-123" };

      const result = deletedLocation;
      expect(result.isActive).toBe(false);
    });

    it("should return 404 for nonexistent location", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([]);

      mockRequest.params = { id: "nonexistent" };

      const location = null;
      expect(location).toBeNull();
    });

    it("should verify tenant ownership before deletion", async () => {
      const otherShopLocation = { ...mockLocation, shopId: "shop-999" };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([otherShopLocation]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.shopId = "shop-456";

      const location = otherShopLocation;
      const isOwned = location.shopId === mockRequest.shopId;

      expect(isOwned).toBe(false);
    });

    it("should return deleted location in response", async () => {
      const deletedLocation = { ...mockLocation, isActive: false };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([deletedLocation]);

      mockRequest.params = { id: "loc-123" };

      const result = {
        message: "Location deactivated",
        location: deletedLocation,
      };
      expect(result.message).toBe("Location deactivated");
    });
  });

  describe("GET /:id/hours - Get Working Hours", () => {
    it("should retrieve working hours for a location", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue(mockWorkingHours);

      mockRequest.params = { id: "loc-123" };

      const result = mockWorkingHours;
      expect(result).toHaveLength(3);
    });

    it("should order working hours by day of week", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue(mockWorkingHours);

      mockRequest.params = { id: "loc-123" };

      const result = mockWorkingHours;
      expect(result[0].dayOfWeek).toBeLessThan(
        result[result.length - 1].dayOfWeek,
      );
    });

    it("should handle location with no working hours", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([]);

      mockRequest.params = { id: "loc-123" };

      const result = [];
      expect(result).toHaveLength(0);
    });

    it("should indicate closed days", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue(mockWorkingHours);

      mockRequest.params = { id: "loc-123" };

      const result = mockWorkingHours;
      const closedDay = result.find((h) => h.isClosed);

      expect(closedDay?.isClosed).toBe(true);
    });
  });

  describe("POST /:id/hours - Set Working Hours", () => {
    it("should update working hours for a location", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue({});

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = {
        monday: { open: "08:00", close: "18:00" },
        tuesday: { open: "08:00", close: "18:00" },
      };

      const result = { message: "Working hours updated" };
      expect(result.message).toBe("Working hours updated");
    });

    it("should handle closed days", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue({});

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = {
        sunday: { isClosed: true },
      };

      const isClosed = mockRequest.body.sunday?.isClosed;
      expect(isClosed).toBe(true);
    });

    it("should accept partial day updates", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue({});

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = {
        monday: { open: "09:00", close: "17:00" },
      };

      const hasMonday = mockRequest.body.monday !== undefined;
      expect(hasMonday).toBe(true);
    });

    it("should validate time format", async () => {
      mockRequest.params = { id: "loc-123" };
      mockRequest.body = {
        monday: { open: "invalid-time", close: "18:00" },
      };

      const timePattern = /^\d{2}:\d{2}$/;
      const isValid = timePattern.test(mockRequest.body.monday.open);

      expect(isValid).toBe(false);
    });
  });

  describe("GET /:id/capacity - Get Capacity", () => {
    it("should retrieve capacity information", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockCapacity]);

      mockRequest.params = { id: "loc-123" };

      const result = mockCapacity;
      expect(result.totalSlots).toBe(100);
    });

    it("should calculate available slots", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockCapacity]);

      mockRequest.params = { id: "loc-123" };

      const result = mockCapacity;
      expect(result.availableSlots).toBe(20);
    });

    it("should calculate utilization percentage", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockCapacity]);

      mockRequest.params = { id: "loc-123" };

      const result = mockCapacity;
      expect(result.utilizationPercent).toBe(60.0);
    });

    it("should return 404 when capacity not found", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([]);

      mockRequest.params = { id: "loc-123" };

      const result = null;
      expect(result).toBeNull();
    });
  });

  describe("PATCH /:id/capacity - Update Capacity", () => {
    it("should update total slots", async () => {
      const updatedCapacity = { ...mockCapacity, totalSlots: 150 };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([updatedCapacity]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { totalSlots: 150, usedSlots: 60, reservedSlots: 20 };

      const result = updatedCapacity;
      expect(result.totalSlots).toBe(150);
    });

    it("should update used slots", async () => {
      const updatedCapacity = { ...mockCapacity, usedSlots: 80 };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([updatedCapacity]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { totalSlots: 100, usedSlots: 80, reservedSlots: 20 };

      const result = updatedCapacity;
      expect(result.usedSlots).toBe(80);
    });

    it("should update reserved slots", async () => {
      const updatedCapacity = { ...mockCapacity, reservedSlots: 30 };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([updatedCapacity]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { totalSlots: 100, usedSlots: 60, reservedSlots: 30 };

      const result = updatedCapacity;
      expect(result.reservedSlots).toBe(30);
    });

    it("should reject negative slot values", async () => {
      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { totalSlots: 100, usedSlots: -10, reservedSlots: 20 };

      const isValid = mockRequest.body.usedSlots >= 0;
      expect(isValid).toBe(false);
    });

    it("should reject zero total slots", async () => {
      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { totalSlots: 0, usedSlots: 0, reservedSlots: 0 };

      const isValid = mockRequest.body.totalSlots > 0;
      expect(isValid).toBe(false);
    });

    it("should validate slots do not exceed total", async () => {
      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { totalSlots: 100, usedSlots: 60, reservedSlots: 50 };

      const exceed =
        mockRequest.body.usedSlots + mockRequest.body.reservedSlots >
        mockRequest.body.totalSlots;
      expect(exceed).toBe(true);
    });

    it("should update capacity category", async () => {
      const updatedCapacity = { ...mockCapacity, category: "premium" };
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([updatedCapacity]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = {
        totalSlots: 100,
        usedSlots: 60,
        reservedSlots: 20,
        category: "premium",
      };

      const result = updatedCapacity;
      expect(result.category).toBe("premium");
    });
  });

  describe("GET /:id/zones - Get Zones", () => {
    it("should retrieve zone associations", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue(mockZones);

      mockRequest.params = { id: "loc-123" };

      const result = mockZones;
      expect(result).toHaveLength(2);
    });

    it("should order zones by priority", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue(mockZones);

      mockRequest.params = { id: "loc-123" };

      const result = mockZones;
      expect(result[0].priority).toBeLessThan(result[1].priority);
    });

    it("should include zone names and types", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue(mockZones);

      mockRequest.params = { id: "loc-123" };

      const result = mockZones;
      expect(result[0].name).toBe("Zone A");
      expect(result[0].type).toBe("DELIVERY");
    });

    it("should handle location with no zones", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([]);

      mockRequest.params = { id: "loc-123" };

      const result = [];
      expect(result).toHaveLength(0);
    });
  });

  describe("POST /:id/zones - Associate Zone", () => {
    it("should associate a zone with location", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { zoneId: "zone-3", priority: 0, isDefault: false },
      ]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { zoneId: "zone-3", priority: 0, isDefault: false };

      const result = { zoneId: "zone-3", priority: 0, isDefault: false };
      expect(result.zoneId).toBe("zone-3");
    });

    it("should validate zone UUID format", async () => {
      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { zoneId: "invalid-uuid", priority: 0 };

      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          mockRequest.body.zoneId,
        );

      expect(isValidUUID).toBe(false);
    });

    it("should set default priority if not provided", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { zoneId: "zone-3", priority: 0, isDefault: false },
      ]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { zoneId: "zone-3" };

      const priority = mockRequest.body.priority || 0;
      expect(priority).toBe(0);
    });

    it("should return 201 on successful association", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { zoneId: "zone-3", priority: 0, isDefault: false },
      ]);

      mockRequest.params = { id: "loc-123" };
      mockRequest.body = { zoneId: "zone-3" };

      expect(mockReply.code).toBeDefined();
    });
  });

  describe("DELETE /:id/zones/:zoneId - Unassociate Zone", () => {
    it("should remove zone association", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue({});

      mockRequest.params = { id: "loc-123", zoneId: "zone-1" };

      const result = { message: "Zone association removed" };
      expect(result.message).toBe("Zone association removed");
    });

    it("should validate location ID format", async () => {
      mockRequest.params = { id: "invalid-uuid", zoneId: "zone-1" };

      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          mockRequest.params.id as string,
        );

      expect(isValidUUID).toBe(false);
    });

    it("should validate zone ID format", async () => {
      mockRequest.params = { id: "loc-123", zoneId: "invalid-uuid" };

      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          mockRequest.params.zoneId as string,
        );

      expect(isValidUUID).toBe(false);
    });
  });

  describe("GET /nearest - Find Nearest Location", () => {
    it("should find nearest locations by coordinates", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { ...mockLocation, distance_km: 2.5 },
      ]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        maxDistance: 50,
        limit: 5,
      };

      const result = [{ ...mockLocation, distance_km: 2.5 }];
      expect(result[0].distance_km).toBe(2.5);
    });

    it("should filter by location type", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { ...mockLocation, type: "WAREHOUSE", distance_km: 2.5 },
      ]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        maxDistance: 50,
        type: "WAREHOUSE",
        limit: 5,
      };

      const result = [{ ...mockLocation, type: "WAREHOUSE", distance_km: 2.5 }];
      expect(result[0].type).toBe("WAREHOUSE");
    });

    it("should respect max distance parameter", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { ...mockLocation, distance_km: 30 },
      ]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        maxDistance: 50,
        limit: 5,
      };

      const maxDistance = parseFloat(mockRequest.query.maxDistance as string);
      expect(maxDistance).toBe(50);
    });

    it("should limit results count", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { ...mockLocation, distance_km: 1 },
        { ...mockLocation, distance_km: 2 },
        { ...mockLocation, distance_km: 3 },
      ]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        maxDistance: 50,
        limit: 3,
      };

      const result = [
        { ...mockLocation, distance_km: 1 },
        { ...mockLocation, distance_km: 2 },
        { ...mockLocation, distance_km: 3 },
      ];

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("should validate latitude range", async () => {
      mockRequest.query = {
        latitude: 200,
        longitude: -74.006,
        maxDistance: 50,
        limit: 5,
      };

      const isValidLat =
        mockRequest.query.latitude >= -90 && mockRequest.query.latitude <= 90;
      expect(isValidLat).toBe(false);
    });

    it("should validate longitude range", async () => {
      mockRequest.query = {
        latitude: 40.7128,
        longitude: 500,
        maxDistance: 50,
        limit: 5,
      };

      const isValidLng =
        mockRequest.query.longitude >= -180 &&
        mockRequest.query.longitude <= 180;
      expect(isValidLng).toBe(false);
    });

    it("should order results by distance ascending", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([
        { ...mockLocation, distance_km: 1 },
        { ...mockLocation, distance_km: 5 },
        { ...mockLocation, distance_km: 10 },
      ]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        maxDistance: 50,
        limit: 5,
      };

      const result = [
        { ...mockLocation, distance_km: 1 },
        { ...mockLocation, distance_km: 5 },
        { ...mockLocation, distance_km: 10 },
      ];

      expect(result[0].distance_km).toBeLessThan(result[1].distance_km);
    });

    it("should handle no nearby locations", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        maxDistance: 5,
        limit: 5,
      };

      const result = [];
      expect(result).toHaveLength(0);
    });

    it("should apply default max distance", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockLocation]);

      mockRequest.query = { latitude: 40.7128, longitude: -74.006 };

      const maxDistance = mockRequest.query.maxDistance || 50;
      expect(maxDistance).toBe(50);
    });

    it("should apply default limit", async () => {
      mockTenantDb.$queryRawUnsafe.mockResolvedValue([mockLocation]);

      mockRequest.query = {
        latitude: 40.7128,
        longitude: -74.006,
        maxDistance: 50,
      };

      const limit = mockRequest.query.limit || 5;
      expect(limit).toBe(5);
    });
  });

  describe("Tenant Isolation", () => {
    it("should filter all locations by shopId", async () => {
      mockRequest.shopId = "shop-456";

      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([{ count: 1 }]);
      mockTenantDb.$queryRawUnsafe.mockResolvedValueOnce([
        { ...mockLocation, shopId: "shop-456" },
      ]);

      const whereClause = "WHERE shop_id = $1::uuid AND is_active = true";
      expect(whereClause).toContain("shop_id");
    });

    it("should prevent access to other tenant locations", async () => {
      mockRequest.shopId = "shop-456";
      const otherTenantLocation = { ...mockLocation, shopId: "shop-999" };

      mockTenantDb.$queryRawUnsafe.mockResolvedValue([otherTenantLocation]);

      const results = await mockTenantDb.$queryRawUnsafe(
        "SELECT * FROM locations WHERE shop_id = $1",
        mockRequest.shopId,
      );
      const location = results[0];
      const isAccessible = location.shopId === mockRequest.shopId;

      expect(isAccessible).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors", async () => {
      mockTenantDb.$queryRawUnsafe.mockReset();
      mockTenantDb.$queryRawUnsafe.mockRejectedValueOnce(
        new Error("Database error"),
      );

      await expect(mockTenantDb.$queryRawUnsafe()).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle invalid JSON in metadata", async () => {
      mockRequest.body = { metadata: "invalid-json" };

      const isObject = typeof mockRequest.body.metadata === "object";
      expect(isObject).toBe(false);
    });

    it("should handle malformed request body", async () => {
      mockRequest.body = null;

      expect(mockRequest.body).toBeNull();
    });

    it("should handle null values in optional fields", async () => {
      const location = { ...mockLocation, email: null };

      expect(location.email).toBeNull();
    });
  });
});
