/**
 * Tests for ShipmentsResource
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { WitylogixClient } from "../src/client";
import { ShipmentsResource } from "../src/resources/shipments";
import type {
  Shipment,
  ShipmentTracking,
  PaginatedResponse,
} from "../src/types";

global.fetch = vi.fn();

describe("ShipmentsResource", () => {
  const mockFetch = global.fetch as any;
  const baseUrl = "https://api.witylogix.com";
  const apiKey = "test-api-key";

  let client: WitylogixClient;
  let shipments: ShipmentsResource;

  const mockShipment: Shipment = {
    id: "shipment-123",
    order_id: "order-123",
    tracking_number: "TRK-123456",
    status: "pending",
    current_location: {
      latitude: 40.7128,
      longitude: -74.006,
      address: "123 Main St",
    },
    estimated_delivery: "2024-03-15T18:00:00Z",
    driver_id: "driver-123",
    created_at: "2024-03-10T12:00:00Z",
    updated_at: "2024-03-10T12:00:00Z",
  };

  const mockTracking: ShipmentTracking = {
    shipment_id: "shipment-123",
    tracking_number: "TRK-123456",
    status: "in_transit",
    location: {
      latitude: 40.7128,
      longitude: -74.006,
      address: "123 Main St",
    },
    last_update: "2024-03-10T13:00:00Z",
    events: [
      {
        timestamp: "2024-03-10T12:00:00Z",
        status: "picked_up",
        description: "Package picked up",
      },
    ],
  };

  beforeEach(() => {
    client = new WitylogixClient({ baseUrl, apiKey });
    shipments = new ShipmentsResource(client);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should list shipments with pagination", async () => {
      const mockResponse: PaginatedResponse<Shipment> = {
        data: [mockShipment],
        pagination: {
          page: 1,
          limit: 50,
          total: 200,
          pages: 4,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await shipments.list({ page: 1, limit: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/shipments"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("shipment-123");
    });
  });

  describe("get", () => {
    it("should get a single shipment by ID", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockShipment,
        text: async () => JSON.stringify(mockShipment),
      });

      const result = await shipments.get("shipment-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/shipments/shipment-123"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.id).toBe("shipment-123");
      expect(result.tracking_number).toBe("TRK-123456");
    });

    it("should include all shipment details in response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockShipment,
        text: async () => JSON.stringify(mockShipment),
      });

      const result = await shipments.get("shipment-123");
      expect(result.status).toBe("pending");
      expect(result.order_id).toBe("order-123");
      expect(result.driver_id).toBe("driver-123");
    });
  });

  describe("create", () => {
    it("should create a new shipment from order", async () => {
      const createData = {
        order_id: "order-123",
        driver_id: "driver-123",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockShipment,
        text: async () => JSON.stringify(mockShipment),
      });

      const result = await shipments.create(createData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/shipments"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(createData),
        }),
      );
      expect(result.id).toBeDefined();
    });

    it("should include all create fields in request body", async () => {
      const createData = {
        order_id: "order-456",
        driver_id: "driver-456",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ ...mockShipment, ...createData }),
        text: async () => JSON.stringify({ ...mockShipment, ...createData }),
      });

      await shipments.create(createData);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.order_id).toBe("order-456");
      expect(callBody.driver_id).toBe("driver-456");
    });
  });

  describe("update", () => {
    it("should update a shipment with partial data", async () => {
      const updateData = {
        driver_id: "driver-456",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ ...mockShipment, ...updateData }),
        text: async () => JSON.stringify({ ...mockShipment, ...updateData }),
      });

      const result = await shipments.update("shipment-123", updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/shipments/shipment-123"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(updateData),
        }),
      );
      expect(result.driver_id).toBe("driver-456");
    });

    it("should use PATCH method for updates", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockShipment,
        text: async () => JSON.stringify(mockShipment),
      });

      await shipments.update("shipment-123", { driver_id: "driver-789" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("delete", () => {
    it("should delete a shipment", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: async () => "",
      });

      await shipments.delete("shipment-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/shipments/shipment-123"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("updateStatus", () => {
    it("should update shipment status", async () => {
      const updatedShipment = {
        ...mockShipment,
        status: "out_for_delivery" as const,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => updatedShipment,
        text: async () => JSON.stringify(updatedShipment),
      });

      const result = await shipments.updateStatus(
        "shipment-123",
        "out_for_delivery",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/shipments/shipment-123/status"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "out_for_delivery" }),
        }),
      );
      expect(result.status).toBe("out_for_delivery");
    });

    it("should accept various status values", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockShipment,
        text: async () => JSON.stringify(mockShipment),
      });

      await shipments.updateStatus("shipment-123", "delivered");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.status).toBe("delivered");
    });
  });

  describe("getTracking", () => {
    it("should get tracking information for a shipment", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockTracking,
        text: async () => JSON.stringify(mockTracking),
      });

      const result = await shipments.getTracking("shipment-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/shipments/shipment-123/tracking"),
        expect.objectContaining({ method: "GET" }),
      );
      expect(result.shipment_id).toBe("shipment-123");
      expect(result.status).toBe("in_transit");
      expect(result.events).toHaveLength(1);
    });

    it("should include tracking events in response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockTracking,
        text: async () => JSON.stringify(mockTracking),
      });

      const result = await shipments.getTracking("shipment-123");
      expect(result.events[0].status).toBe("picked_up");
      expect(result.events[0].description).toBe("Package picked up");
    });
  });

  describe("getByStatus", () => {
    it("should get shipments filtered by status", async () => {
      const mockResponse: PaginatedResponse<Shipment> = {
        data: [mockShipment],
        pagination: {
          page: 1,
          limit: 50,
          total: 75,
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

      const result = await shipments.getByStatus("in_transit");

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("status=in_transit");
      expect(result.data).toHaveLength(1);
    });

    it("should accept pagination params with status filter", async () => {
      const mockResponse: PaginatedResponse<Shipment> = {
        data: [mockShipment],
        pagination: {
          page: 2,
          limit: 25,
          total: 75,
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

      await shipments.getByStatus("delivered", { page: 2, limit: 25 });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("status=delivered");
      expect(callUrl).toContain("page=2");
    });
  });

  describe("getByOrder", () => {
    it("should get shipments for a specific order", async () => {
      const mockResponse: PaginatedResponse<Shipment> = {
        data: [mockShipment],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          pages: 1,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await shipments.getByOrder("order-123");

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("order_id=order-123");
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getByDriver", () => {
    it("should get shipments assigned to a specific driver", async () => {
      const mockResponse: PaginatedResponse<Shipment> = {
        data: [mockShipment],
        pagination: {
          page: 1,
          limit: 50,
          total: 5,
          pages: 1,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await shipments.getByDriver("driver-123");

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("driver_id=driver-123");
      expect(result.data).toHaveLength(1);
    });
  });

  describe("trackByNumber", () => {
    it("should track shipment by tracking number", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => mockTracking,
        text: async () => JSON.stringify(mockTracking),
      });

      const result = await shipments.trackByNumber("TRK-123456");

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("tracking_number=TRK-123456");
      expect(result.tracking_number).toBe("TRK-123456");
    });
  });

  describe("bulkUpdateStatus", () => {
    it("should bulk update shipment statuses", async () => {
      const bulkResponse = {
        updated: 3,
        failed: 0,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => bulkResponse,
        text: async () => JSON.stringify(bulkResponse),
      });

      const result = await shipments.bulkUpdateStatus(
        ["shipment-1", "shipment-2", "shipment-3"],
        "delivered",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/shipments/bulk-update-status"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            shipment_ids: ["shipment-1", "shipment-2", "shipment-3"],
            status: "delivered",
          }),
        }),
      );
      expect(result.updated).toBe(3);
      expect(result.failed).toBe(0);
    });

    it("should include all shipment IDs in request body", async () => {
      const bulkResponse = {
        updated: 2,
        failed: 1,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => bulkResponse,
        text: async () => JSON.stringify(bulkResponse),
      });

      const ids = ["shipment-1", "shipment-2", "shipment-3"];
      await shipments.bulkUpdateStatus(ids, "in_transit");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.shipment_ids).toEqual(ids);
      expect(callBody.status).toBe("in_transit");
    });
  });
});
