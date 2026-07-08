/**
 * Tests for ZonesResource
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { WitylogixClient } from "../src/client";
import { ZonesResource } from "../src/resources/zones";
import type { Zone, PaginatedResponse, ZoneCheckResult } from "../src/types";

global.fetch = vi.fn();

describe("ZonesResource", () => {
  const mockFetch = global.fetch as any;
  const baseUrl = "https://api.witylogix.com";
  const apiKey = "test-api-key";

  let client: WitylogixClient;
  let zones: ZonesResource;

  const mockZone: Zone = {
    id: "zone-123",
    name: "Downtown Manhattan",
    polygon_coordinates: [
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 40.715, longitude: -74.01 },
      { latitude: 40.71, longitude: -74.008 },
    ],
    status: "active",
    assigned_drivers: ["driver-1", "driver-2"],
    capacity: 200,
    created_at: "2024-03-10T12:00:00Z",
    updated_at: "2024-03-10T12:00:00Z",
  };

  beforeEach(() => {
    client = new WitylogixClient({ baseUrl, apiKey });
    zones = new ZonesResource(client);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should list zones with pagination", async () => {
      const mockResponse: PaginatedResponse<Zone> = {
        data: [mockZone],
        pagination: {
          page: 1,
          limit: 20,
          total: 50,
          pages: 3,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await zones.list({ page: 1, limit: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/zones"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("zone-123");
    });
  });

  describe("get", () => {
    it("should get a single zone by ID", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockZone,
        text: async () => JSON.stringify(mockZone),
      });

      const result = await zones.get("zone-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/zones/zone-123"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.id).toBe("zone-123");
      expect(result.name).toBe("Downtown Manhattan");
    });

    it("should include all zone details in response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockZone,
        text: async () => JSON.stringify(mockZone),
      });

      const result = await zones.get("zone-123");
      expect(result.status).toBe("active");
      expect(result.polygon_coordinates).toHaveLength(3);
      expect(result.assigned_drivers).toHaveLength(2);
      expect(result.capacity).toBe(200);
    });
  });

  describe("create", () => {
    it("should create a new zone", async () => {
      const createData = {
        name: "Uptown Manhattan",
        polygon_coordinates: [
          { latitude: 40.7128, longitude: -74.006 },
          { latitude: 40.715, longitude: -74.01 },
        ],
        capacity: 250,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ ...mockZone, ...createData, id: "zone-456" }),
        text: async () =>
          JSON.stringify({ ...mockZone, ...createData, id: "zone-456" }),
      });

      const result = await zones.create(createData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/zones"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(createData),
        }),
      );
      expect(result.id).toBeDefined();
    });

    it("should include all zone fields in request body", async () => {
      const createData = {
        name: "Test Zone",
        polygon_coordinates: [
          { latitude: 40.7128, longitude: -74.006 },
          { latitude: 40.715, longitude: -74.01 },
          { latitude: 40.71, longitude: -74.008 },
        ],
        capacity: 300,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ ...mockZone, ...createData }),
        text: async () => JSON.stringify({ ...mockZone, ...createData }),
      });

      await zones.create(createData);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.polygon_coordinates).toHaveLength(3);
      expect(callBody.capacity).toBe(300);
    });
  });

  describe("update", () => {
    it("should update a zone with partial data", async () => {
      const updateData = {
        capacity: 350,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ ...mockZone, ...updateData }),
        text: async () => JSON.stringify({ ...mockZone, ...updateData }),
      });

      const result = await zones.update("zone-123", updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/zones/zone-123"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(updateData),
        }),
      );
      expect(result.capacity).toBe(350);
    });

    it("should use PATCH method for updates", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockZone,
        text: async () => JSON.stringify(mockZone),
      });

      await zones.update("zone-123", { capacity: 300 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("delete", () => {
    it("should delete a zone", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: async () => "",
      });

      await zones.delete("zone-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/zones/zone-123"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("checkPoint", () => {
    it("should check if point is inside a zone", async () => {
      const checkResult: ZoneCheckResult = {
        zone_id: "zone-123",
        inside: true,
        distance_to_boundary: 50,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => checkResult,
        text: async () => JSON.stringify(checkResult),
      });

      const result = await zones.checkPoint(40.7128, -74.006);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/zones/check-point"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ latitude: 40.7128, longitude: -74.006 }),
        }),
      );
      expect(result.zone_id).toBe("zone-123");
      expect(result.inside).toBe(true);
    });

    it("should include latitude and longitude in request body", async () => {
      const checkResult: ZoneCheckResult = {
        zone_id: "zone-123",
        inside: false,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => checkResult,
        text: async () => JSON.stringify(checkResult),
      });

      await zones.checkPoint(40.8128, -74.1006);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.latitude).toBe(40.8128);
      expect(callBody.longitude).toBe(-74.1006);
    });
  });

  describe("isPointInZone", () => {
    it("should verify if point is in specific zone", async () => {
      const checkResult: ZoneCheckResult = {
        zone_id: "zone-123",
        inside: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => checkResult,
        text: async () => JSON.stringify(checkResult),
      });

      const result = await zones.isPointInZone("zone-123", 40.7128, -74.006);

      expect(result).toBe(true);
    });

    it("should return false if point not in specified zone", async () => {
      const checkResult: ZoneCheckResult = {
        zone_id: "zone-456",
        inside: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => checkResult,
        text: async () => JSON.stringify(checkResult),
      });

      const result = await zones.isPointInZone("zone-123", 40.7128, -74.006);

      expect(result).toBe(false);
    });
  });

  describe("getByStatus", () => {
    it("should get zones filtered by status", async () => {
      const mockResponse: PaginatedResponse<Zone> = {
        data: [mockZone],
        pagination: {
          page: 1,
          limit: 20,
          total: 30,
          pages: 2,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await zones.getByStatus("active");

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("status=active");
      expect(result.data).toHaveLength(1);
    });

    it("should accept pagination params with status filter", async () => {
      const mockResponse: PaginatedResponse<Zone> = {
        data: [mockZone],
        pagination: {
          page: 2,
          limit: 10,
          total: 15,
          pages: 2,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      await zones.getByStatus("inactive", { page: 2, limit: 10 });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("status=inactive");
      expect(callUrl).toContain("page=2");
    });
  });

  describe("findByLocation", () => {
    it("should find all zones containing a location", async () => {
      const responseData = {
        zones: [mockZone],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => responseData,
        text: async () => JSON.stringify(responseData),
      });

      const result = await zones.findByLocation(40.7128, -74.006);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("latitude=40.7128");
      expect(callUrl).toContain("longitude=-74.006");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("zone-123");
    });
  });

  describe("addDriver", () => {
    it("should add a driver to a zone", async () => {
      const updatedZone = {
        ...mockZone,
        assigned_drivers: [...mockZone.assigned_drivers, "driver-3"],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => updatedZone,
        text: async () => JSON.stringify(updatedZone),
      });

      const result = await zones.addDriver("zone-123", "driver-3");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/zones/zone-123/drivers"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ driver_id: "driver-3", action: "add" }),
        }),
      );
      expect(result.assigned_drivers).toContain("driver-3");
    });
  });

  describe("removeDriver", () => {
    it("should remove a driver from a zone", async () => {
      const updatedZone = {
        ...mockZone,
        assigned_drivers: mockZone.assigned_drivers.filter(
          (d) => d !== "driver-1",
        ),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => updatedZone,
        text: async () => JSON.stringify(updatedZone),
      });

      const result = await zones.removeDriver("zone-123", "driver-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/zones/zone-123/drivers"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ driver_id: "driver-1", action: "remove" }),
        }),
      );
      expect(result.assigned_drivers).not.toContain("driver-1");
    });
  });
});
