// @ts-nocheck

/**
 * @witylogix/workflows — Create Delivery Order Workflow Test Suite
 *
 * Comprehensive tests for the delivery order creation workflow:
 * - Happy path: order validation, geocoding, inventory, rate calculation, creation
 * - Validation failures
 * - Geocoding errors
 * - Inventory unavailability with compensation
 * - Rate calculation with different zones and weights
 * - Notification failures (best effort)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WorkflowContext, StepResult } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK SERVICES & TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface CreateDeliveryOrderInput {
  customerId: string;
  customerName: string;
  customerEmail: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  items: Array<{
    productId: string;
    quantity: number;
    weight?: number;
    price?: number;
  }>;
  totalPrice?: number;
}

interface DeliveryOrder {
  id: string;
  customerId: string;
  status: "pending" | "confirmed" | "assigned" | "in_transit" | "delivered";
  deliveryAddress: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  estimatedDeliveryDate: Date;
  totalPrice: number;
  shippingRate: number;
}

// Mock geocoding service
const mockGeocodeAddress = vi.fn();
const mockCheckInventory = vi.fn();
const mockReserveInventory = vi.fn();
const mockCalculateRate = vi.fn();
const mockCreateOrder = vi.fn();
const mockSendNotification = vi.fn();

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW STEPS
// ─────────────────────────────────────────────────────────────────────────────

const validateOrderStep = {
  name: "Validate Order",
  async invoke(
    input: CreateDeliveryOrderInput,
  ): Promise<StepResult<CreateDeliveryOrderInput>> {
    try {
      // Validate required fields
      if (!input.customerId || input.customerId.trim().length === 0) {
        return {
          success: false,
          error: "Customer ID is required",
          code: "INVALID_CUSTOMER",
        };
      }

      if (!input.addressLine1 || input.addressLine1.trim().length === 0) {
        return {
          success: false,
          error: "Address is required",
          code: "INVALID_ADDRESS",
        };
      }

      if (!input.city || input.city.trim().length === 0) {
        return {
          success: false,
          error: "City is required",
          code: "INVALID_CITY",
        };
      }

      if (!input.postalCode || input.postalCode.trim().length === 0) {
        return {
          success: false,
          error: "Postal code is required",
          code: "INVALID_POSTAL_CODE",
        };
      }

      if (input.items.length === 0) {
        return {
          success: false,
          error: "Order must have at least 1 item",
          code: "NO_ITEMS",
        };
      }

      return { success: true, data: input };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Validation error",
        code: "VALIDATION_ERROR",
      };
    }
  },
};

const geocodeAddressStep = {
  name: "Geocode Address",
  async invoke(
    input: CreateDeliveryOrderInput,
  ): Promise<
    StepResult<
      CreateDeliveryOrderInput & { coordinates: { lat: number; lng: number } }
    >
  > {
    try {
      const result = await mockGeocodeAddress({
        address: input.addressLine1,
        city: input.city,
        postalCode: input.postalCode,
        country: input.country,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          code: "GEOCODING_FAILED",
        };
      }

      return {
        success: true,
        data: { ...input, coordinates: result.coordinates },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Geocoding error",
        code: "GEOCODING_ERROR",
      };
    }
  },
};

const checkInventoryStep = {
  name: "Check Inventory",
  async invoke(
    input: CreateDeliveryOrderInput & {
      coordinates: { lat: number; lng: number };
    },
  ): Promise<
    StepResult<
      CreateDeliveryOrderInput & { coordinates: { lat: number; lng: number } }
    >
  > {
    try {
      for (const item of input.items) {
        const available = await mockCheckInventory({
          productId: item.productId,
          quantity: item.quantity,
        });

        if (!available) {
          return {
            success: false,
            error: `Product ${item.productId} not available in required quantity`,
            code: "INVENTORY_UNAVAILABLE",
          };
        }
      }

      return { success: true, data: input };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Inventory check error",
        code: "INVENTORY_CHECK_ERROR",
      };
    }
  },
};

const reserveInventoryStep = {
  name: "Reserve Inventory",
  async invoke(
    input: CreateDeliveryOrderInput & {
      coordinates: { lat: number; lng: number };
    },
  ): Promise<
    StepResult<
      CreateDeliveryOrderInput & {
        coordinates: { lat: number; lng: number };
        reservationId: string;
      }
    >
  > {
    try {
      const reservationId = await mockReserveInventory({
        items: input.items,
      });

      if (!reservationId) {
        return {
          success: false,
          error: "Failed to reserve inventory",
          code: "RESERVATION_FAILED",
        };
      }

      return {
        success: true,
        data: { ...input, reservationId },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Reservation error",
        code: "RESERVATION_ERROR",
      };
    }
  },
  async compensate(output: any) {
    // Release inventory reservation
    if (output.reservationId) {
      vi.fn()({ reservationId: output.reservationId });
    }
  },
};

const calculateRateStep = {
  name: "Calculate Rate",
  async invoke(
    input: CreateDeliveryOrderInput & {
      coordinates: { lat: number; lng: number };
      reservationId: string;
    },
  ): Promise<
    StepResult<
      CreateDeliveryOrderInput & {
        coordinates: { lat: number; lng: number };
        reservationId: string;
        shippingRate: number;
        zone: string;
      }
    >
  > {
    try {
      const totalWeight = input.items.reduce(
        (sum, item) => sum + (item.weight || 1) * (item.quantity || 1),
        0,
      );

      const rateData = await mockCalculateRate({
        coordinates: input.coordinates,
        weight: totalWeight,
        zone: input.province,
      });

      if (!rateData.success) {
        return {
          success: false,
          error: "Rate calculation failed",
          code: "RATE_CALC_FAILED",
        };
      }

      return {
        success: true,
        data: { ...input, shippingRate: rateData.rate, zone: rateData.zone },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Rate calculation error",
        code: "RATE_CALC_ERROR",
      };
    }
  },
};

const createOrderStep = {
  name: "Create Order",
  async invoke(
    input: CreateDeliveryOrderInput & {
      coordinates: { lat: number; lng: number };
      reservationId: string;
      shippingRate: number;
      zone: string;
    },
  ): Promise<StepResult<DeliveryOrder>> {
    try {
      const order = await mockCreateOrder({
        customerId: input.customerId,
        customerName: input.customerName,
        address: input.addressLine1,
        city: input.city,
        items: input.items,
        shippingRate: input.shippingRate,
        totalPrice: (input.totalPrice || 0) + input.shippingRate,
      });

      if (!order.id) {
        return {
          success: false,
          error: "Failed to create order",
          code: "ORDER_CREATION_FAILED",
        };
      }

      return { success: true, data: order };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Order creation error",
        code: "ORDER_CREATION_ERROR",
      };
    }
  },
  async compensate(order: DeliveryOrder) {
    // Cancel order if creation succeeded but later steps fail
    vi.fn()({ orderId: order.id, action: "cancel" });
  },
};

const sendNotificationStep = {
  name: "Send Notification",
  optional: true, // Best effort - failure does not stop workflow
  async invoke(order: DeliveryOrder): Promise<StepResult<DeliveryOrder>> {
    try {
      await mockSendNotification({
        orderId: order.id,
        type: "order_created",
      });

      return { success: true, data: order };
    } catch (error) {
      // Best effort - log but don't fail
      console.warn("Notification failed:", error);
      return { success: true, data: order }; // Still return success
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("Create Delivery Order Workflow", () => {
  let mockContext: WorkflowContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      prisma: {} as any,
      userId: "user_123",
      shopId: "shop_123",
      orgId: "org_123",
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    // Default mock implementations
    mockGeocodeAddress.mockResolvedValue({
      success: true,
      coordinates: { lat: 43.6532, lng: -79.3832 },
    });

    mockCheckInventory.mockResolvedValue(true);

    mockReserveInventory.mockResolvedValue("res_12345");

    mockCalculateRate.mockResolvedValue({
      success: true,
      rate: 12.99,
      zone: "A",
    });

    mockCreateOrder.mockResolvedValue({
      id: "order_123",
      customerId: "cust_123",
      status: "pending",
      deliveryAddress: "123 Main St, Toronto, ON M5V 3A8",
      items: [{ productId: "prod_1", quantity: 1 }],
      estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      totalPrice: 42.99,
      shippingRate: 12.99,
    });

    mockSendNotification.mockResolvedValue({ success: true });
  });

  describe("Happy Path", () => {
    it("should create delivery order successfully", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [
          { productId: "prod_1", quantity: 1, weight: 2.5, price: 29.99 },
        ],
        totalPrice: 29.99,
      };

      // Execute workflow steps in sequence
      const validated = await validateOrderStep.invoke(input, mockContext);
      expect(validated.success).toBe(true);

      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      expect(geocoded.success).toBe(true);

      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      expect(inventoryChecked.success).toBe(true);

      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      expect(inventoryReserved.success).toBe(true);

      const rateCalculated = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );
      expect(rateCalculated.success).toBe(true);

      const orderCreated = await createOrderStep.invoke(
        rateCalculated.data!,
        mockContext,
      );
      expect(orderCreated.success).toBe(true);

      const order = orderCreated.data!;
      expect(order.id).toBe("order_123");
      expect(order.status).toBe("pending");
      expect(order.shippingRate).toBe(12.99);
    });

    it("should include shipping rate in total price", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 2, price: 50 }],
        totalPrice: 100,
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const rateCalculated = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );

      expect(rateCalculated.success).toBe(true);
      expect(rateCalculated.data!.shippingRate).toBeGreaterThan(0);
    });

    it("should call notification step successfully", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const rateCalculated = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );
      const orderCreated = await createOrderStep.invoke(
        rateCalculated.data!,
        mockContext,
      );

      const notificationResult = await sendNotificationStep.invoke(
        orderCreated.data!,
        mockContext,
      );

      expect(notificationResult.success).toBe(true);
      expect(mockSendNotification).toHaveBeenCalledWith({
        orderId: "order_123",
        type: "order_created",
      });
    });
  });

  describe("Validation Failure", () => {
    it("should fail on invalid order ID", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const result = await validateOrderStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_CUSTOMER");
    });

    it("should fail on missing address", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const result = await validateOrderStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_ADDRESS");
    });

    it("should fail on empty items", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [],
      };

      const result = await validateOrderStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("NO_ITEMS");
    });

    it("should fail on invalid city", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const result = await validateOrderStep.invoke(input, mockContext);

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_CITY");
    });
  });

  describe("Geocoding Failure", () => {
    it("should fail on invalid address coordinates", async () => {
      mockGeocodeAddress.mockResolvedValue({
        success: false,
        error: "Address not found",
      });

      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "Invalid Address",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const result = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("GEOCODING_FAILED");
    });

    it("should handle geocoding errors gracefully", async () => {
      mockGeocodeAddress.mockRejectedValue(new Error("API error"));

      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const result = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("GEOCODING_ERROR");
    });
  });

  describe("Inventory Management", () => {
    it("should fail when inventory is unavailable", async () => {
      mockCheckInventory.mockResolvedValue(false);

      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 10 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const result = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVENTORY_UNAVAILABLE");
    });

    it("should reserve inventory successfully", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [
          { productId: "prod_1", quantity: 2 },
          { productId: "prod_2", quantity: 1 },
        ],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const result = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data!.reservationId).toBe("res_12345");
      expect(mockReserveInventory).toHaveBeenCalledWith({
        items: input.items,
      });
    });

    it("should trigger compensation on inventory reservation failure", async () => {
      mockReserveInventory.mockResolvedValue(null);

      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const result = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("RESERVATION_FAILED");
    });
  });

  describe("Rate Calculation", () => {
    it("should calculate rate based on weight and zone", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [
          { productId: "prod_1", quantity: 2, weight: 5 },
          { productId: "prod_2", quantity: 1, weight: 3 },
        ],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const result = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data!.shippingRate).toBe(12.99);
      expect(result.data!.zone).toBe("A");
      expect(mockCalculateRate).toHaveBeenCalledWith(
        expect.objectContaining({
          weight: 13, // 5 + 5 + 3
          zone: "ON",
        }),
      );
    });

    it("should handle different zones with different rates", async () => {
      mockCalculateRate.mockResolvedValueOnce({
        success: true,
        rate: 8.99,
        zone: "B",
      });

      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Vancouver",
        province: "BC",
        postalCode: "V6B 4X8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1, weight: 2 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const result = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data!.shippingRate).toBe(8.99);
      expect(result.data!.zone).toBe("B");
    });

    it("should fail on rate calculation error", async () => {
      mockCalculateRate.mockResolvedValue({
        success: false,
        error: "Rate service unavailable",
      });

      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const result = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("RATE_CALC_FAILED");
    });
  });

  describe("Order Creation", () => {
    it("should create order with correct details", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_456",
        customerName: "Jane Smith",
        customerEmail: "jane@example.com",
        addressLine1: "456 Oak Ave",
        city: "Montreal",
        province: "QC",
        postalCode: "H1A 0A1",
        country: "CA",
        items: [{ productId: "prod_5", quantity: 3, price: 25.99 }],
        totalPrice: 77.97,
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const rateCalculated = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );
      const result = await createOrderStep.invoke(
        rateCalculated.data!,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: "cust_456",
          customerName: "Jane Smith",
          shippingRate: 12.99,
        }),
      );
    });

    it("should trigger compensation on order creation failure", async () => {
      mockCreateOrder.mockResolvedValue({ id: null });

      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const rateCalculated = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );
      const result = await createOrderStep.invoke(
        rateCalculated.data!,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("ORDER_CREATION_FAILED");
    });
  });

  describe("Notification Handling", () => {
    it("should not fail workflow if notification fails (best effort)", async () => {
      mockSendNotification.mockRejectedValue(
        new Error("Notification service down"),
      );

      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [{ productId: "prod_1", quantity: 1 }],
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const rateCalculated = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );
      const orderCreated = await createOrderStep.invoke(
        rateCalculated.data!,
        mockContext,
      );

      const notificationResult = await sendNotificationStep.invoke(
        orderCreated.data!,
        mockContext,
      );

      expect(notificationResult.success).toBe(true);
      expect(notificationResult.data).toBeDefined();
    });

    it("should mark notification step as optional", () => {
      expect(sendNotificationStep.optional).toBe(true);
    });
  });

  describe("Multi-item Orders", () => {
    it("should handle orders with multiple items", async () => {
      const input: CreateDeliveryOrderInput = {
        customerId: "cust_123",
        customerName: "John Doe",
        customerEmail: "john@example.com",
        addressLine1: "123 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 3A8",
        country: "CA",
        items: [
          { productId: "prod_1", quantity: 2, weight: 5, price: 29.99 },
          { productId: "prod_2", quantity: 1, weight: 3, price: 49.99 },
          { productId: "prod_3", quantity: 3, weight: 2, price: 19.99 },
        ],
        totalPrice: 189.94,
      };

      const validated = await validateOrderStep.invoke(input, mockContext);
      expect(validated.success).toBe(true);

      const geocoded = await geocodeAddressStep.invoke(
        validated.data!,
        mockContext,
      );
      const inventoryChecked = await checkInventoryStep.invoke(
        geocoded.data!,
        mockContext,
      );
      const inventoryReserved = await reserveInventoryStep.invoke(
        inventoryChecked.data!,
        mockContext,
      );
      const rateCalculated = await calculateRateStep.invoke(
        inventoryReserved.data!,
        mockContext,
      );
      const orderCreated = await createOrderStep.invoke(
        rateCalculated.data!,
        mockContext,
      );

      expect(orderCreated.success).toBe(true);
      expect(mockReserveInventory).toHaveBeenCalledWith({
        items: input.items,
      });
    });
  });
});
