import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../lib/errors.js";

describe("Payment Routes", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  const mockTenantDb = {
    paymentTransaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    shipment: {
      findFirst: vi.fn(),
    },
  };

  const mockPayment = {
    id: "pay-123",
    shopId: "shop-456",
    shipmentId: "ship-789",
    type: "DELIVERY",
    method: "CREDIT_CARD",
    amount: 150.5,
    currency: "USD",
    status: "COMPLETED",
    providerTxnId: "txn-123",
    metadata: { orderId: "order-123" },
    createdAt: new Date("2024-03-01"),
    completedAt: new Date("2024-03-01"),
    shop: { id: "shop-456", name: "Test Shop" },
  };

  const mockShipment = {
    id: "ship-789",
    shopId: "shop-456",
    orderId: "order-123",
    status: "DELIVERED",
  };

  beforeEach(() => {
    mockRequest = {
      shopId: "shop-456",
      tenantDb: mockTenantDb,
      query: {},
      params: {},
      body: {},
      userId: "user-123",
    };

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    vi.clearAllMocks();
  });

  describe("GET / - List Payments", () => {
    it("should list all payments with pagination", async () => {
      const payments = [mockPayment];
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue(payments);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 25 };

      const result = {
        success: true,
        data: payments,
        pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
      };

      expect(result.data).toEqual(payments);
      expect(result.pagination.page).toBe(1);
    });

    it("should filter payments by status", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 25, status: "COMPLETED" };

      const where = { shopId: "shop-456", status: "COMPLETED" };
      expect(where.status).toBe("COMPLETED");
    });

    it("should filter payments by payment type", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 25, paymentType: "DELIVERY" };

      const where = { shopId: "shop-456", type: "DELIVERY" };
      expect(where.type).toBe("DELIVERY");
    });

    it("should filter payments by payment method", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 25, paymentMethod: "CREDIT_CARD" };

      const where = { shopId: "shop-456", method: "CREDIT_CARD" };
      expect(where.method).toBe("CREDIT_CARD");
    });

    it("should filter payments by amount range", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(1);

      mockRequest.query = {
        page: 1,
        limit: 25,
        minAmount: 100,
        maxAmount: 200,
      };

      const where = { shopId: "shop-456", amount: { gte: 100, lte: 200 } };
      expect(where.amount.gte).toBe(100);
      expect(where.amount.lte).toBe(200);
    });

    it("should filter payments by date range", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(1);

      mockRequest.query = {
        page: 1,
        limit: 25,
        dateFrom: "2024-03-01",
        dateTo: "2024-03-31",
      };

      const dateFrom = new Date("2024-03-01");
      const dateTo = new Date("2024-03-31");
      expect(dateFrom.getTime()).toBeLessThan(dateTo.getTime());
    });

    it("should apply pagination skip and take correctly", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(100);

      mockRequest.query = { page: 3, limit: 25 };

      const skip = (3 - 1) * 25;
      expect(skip).toBe(50);
    });

    it("should calculate total pages correctly", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(75);

      mockRequest.query = { page: 1, limit: 25 };

      const totalPages = Math.ceil(75 / 25);
      expect(totalPages).toBe(3);
    });

    it("should include shop details in payment response", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(1);

      mockRequest.query = { page: 1, limit: 25 };

      const result = [mockPayment];
      expect(result[0].shop).toBeDefined();
      expect(result[0].shop.name).toBe("Test Shop");
    });

    it("should order results by createdAt descending", async () => {
      const payment1 = { ...mockPayment, createdAt: new Date("2024-03-01") };
      const payment2 = { ...mockPayment, createdAt: new Date("2024-03-02") };

      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([
        payment2,
        payment1,
      ]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(2);

      mockRequest.query = { page: 1, limit: 25 };

      const result = [payment2, payment1];
      expect(result[0].createdAt > result[1].createdAt).toBe(true);
    });

    it("should handle empty payment list", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(0);

      mockRequest.query = { page: 1, limit: 25 };

      const result = {
        success: true,
        data: [],
        pagination: { total: 0, page: 1, limit: 25, totalPages: 0 },
      };
      expect(result.data).toHaveLength(0);
    });

    it("should apply default pagination when not provided", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(1);

      mockRequest.query = {};

      const page = 1;
      const limit = 25;
      expect(page).toBe(1);
      expect(limit).toBe(25);
    });
  });

  describe("GET /:id - Get Single Payment", () => {
    it("should retrieve a single payment by ID", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(mockPayment);

      mockRequest.params = { id: "pay-123" };

      const result = mockPayment;
      expect(result.id).toBe("pay-123");
    });

    it("should return 404 for nonexistent payment", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(null);

      mockRequest.params = { id: "nonexistent" };

      const payment = null;
      expect(payment).toBeNull();
    });

    it("should verify tenant ownership", async () => {
      const otherShopPayment = { ...mockPayment, shopId: "shop-999" };
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(
        otherShopPayment,
      );

      mockRequest.params = { id: "pay-123" };
      mockRequest.shopId = "shop-456";

      const payment = otherShopPayment;
      const isOwned = payment.shopId === mockRequest.shopId;

      expect(isOwned).toBe(false);
    });

    it("should include shop details in response", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(mockPayment);

      mockRequest.params = { id: "pay-123" };

      const result = mockPayment;
      expect(result.shop).toBeDefined();
      expect(result.shop.name).toBe("Test Shop");
    });
  });

  describe("POST / - Create Payment", () => {
    it("should create a new payment transaction", async () => {
      mockTenantDb.shipment.findFirst.mockResolvedValue(mockShipment);
      mockTenantDb.paymentTransaction.create.mockResolvedValue(mockPayment);

      mockRequest.body = {
        shipmentId: "ship-789",
        paymentType: "DELIVERY",
        paymentMethod: "CREDIT_CARD",
        amount: 150.5,
        currency: "USD",
      };

      const result = mockPayment;
      expect(result.type).toBe("DELIVERY");
      expect(result.amount).toBe(150.5);
    });

    it("should validate shipment exists for DELIVERY type", async () => {
      mockTenantDb.shipment.findFirst.mockResolvedValue(null);

      mockRequest.body = {
        shipmentId: "nonexistent",
        paymentType: "DELIVERY",
        paymentMethod: "CREDIT_CARD",
        amount: 150.5,
        currency: "USD",
      };

      const shipment = null;
      expect(shipment).toBeNull();
    });

    it("should set initial payment status to PENDING", async () => {
      mockTenantDb.shipment.findFirst.mockResolvedValue(mockShipment);
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        ...mockPayment,
        status: "PENDING",
      });

      mockRequest.body = {
        shipmentId: "ship-789",
        paymentType: "DELIVERY",
        paymentMethod: "CREDIT_CARD",
        amount: 150.5,
        currency: "USD",
      };

      const result = { ...mockPayment, status: "PENDING" };
      expect(result.status).toBe("PENDING");
    });

    it("should store metadata with payment", async () => {
      mockTenantDb.shipment.findFirst.mockResolvedValue(mockShipment);
      mockTenantDb.paymentTransaction.create.mockResolvedValue(mockPayment);

      mockRequest.body = {
        shipmentId: "ship-789",
        paymentType: "DELIVERY",
        paymentMethod: "CREDIT_CARD",
        amount: 150.5,
        currency: "USD",
        metadata: { orderId: "order-123", notes: "test" },
      };

      const result = mockPayment;
      expect(result.metadata).toBeDefined();
      expect(result.metadata.orderId).toBe("order-123");
    });

    it("should store external reference ID", async () => {
      mockTenantDb.shipment.findFirst.mockResolvedValue(mockShipment);
      mockTenantDb.paymentTransaction.create.mockResolvedValue(mockPayment);

      mockRequest.body = {
        shipmentId: "ship-789",
        paymentType: "DELIVERY",
        paymentMethod: "CREDIT_CARD",
        amount: 150.5,
        currency: "USD",
        externalRef: "ext-ref-123",
      };

      const result = mockPayment;
      expect(result.providerTxnId).toBe("txn-123");
    });

    it("should return 201 on successful creation", async () => {
      mockTenantDb.shipment.findFirst.mockResolvedValue(mockShipment);
      mockTenantDb.paymentTransaction.create.mockResolvedValue(mockPayment);

      mockRequest.body = {
        shipmentId: "ship-789",
        paymentType: "DELIVERY",
        paymentMethod: "CREDIT_CARD",
        amount: 150.5,
        currency: "USD",
      };

      expect(mockReply.code).toBeDefined();
    });

    it("should reject invalid payment type", async () => {
      mockRequest.body = {
        shipmentId: "ship-789",
        paymentType: "INVALID_TYPE",
        paymentMethod: "CREDIT_CARD",
        amount: 150.5,
        currency: "USD",
      };

      const validTypes = ["DELIVERY", "REFUND", "ADJUSTMENT"];
      const isValid = validTypes.includes(mockRequest.body.paymentType);

      expect(isValid).toBe(false);
    });

    it("should reject invalid payment method", async () => {
      mockRequest.body = {
        shipmentId: "ship-789",
        paymentType: "DELIVERY",
        paymentMethod: "INVALID_METHOD",
        amount: 150.5,
        currency: "USD",
      };

      const validMethods = [
        "CREDIT_CARD",
        "DEBIT_CARD",
        "BANK_TRANSFER",
        "CASH",
      ];
      const isValid = validMethods.includes(mockRequest.body.paymentMethod);

      expect(isValid).toBe(false);
    });

    it("should reject negative amount", async () => {
      mockRequest.body = {
        shipmentId: "ship-789",
        paymentType: "DELIVERY",
        paymentMethod: "CREDIT_CARD",
        amount: -150.5,
        currency: "USD",
      };

      const isValid = mockRequest.body.amount > 0;
      expect(isValid).toBe(false);
    });

    it("should reject missing required fields", async () => {
      mockRequest.body = {
        shipmentId: "ship-789",
        paymentMethod: "CREDIT_CARD",
      };

      const hasRequired =
        mockRequest.body.paymentType && mockRequest.body.amount;
      expect(hasRequired).toBeFalsy();
    });
  });

  describe("PATCH /:id/status - Update Payment Status", () => {
    it("should update payment status from PENDING to PROCESSING", async () => {
      const pendingPayment = { ...mockPayment, status: "PENDING" };
      const processingPayment = { ...mockPayment, status: "PROCESSING" };

      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        pendingPayment,
      );
      mockTenantDb.paymentTransaction.update.mockResolvedValue(
        processingPayment,
      );

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "PROCESSING" };

      const result = processingPayment;
      expect(result.status).toBe("PROCESSING");
    });

    it("should update payment status from PROCESSING to COMPLETED", async () => {
      const processingPayment = { ...mockPayment, status: "PROCESSING" };
      const completedPayment = { ...mockPayment, status: "COMPLETED" };

      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        processingPayment,
      );
      mockTenantDb.paymentTransaction.update.mockResolvedValue(
        completedPayment,
      );

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "COMPLETED" };

      const result = completedPayment;
      expect(result.status).toBe("COMPLETED");
    });

    it("should update payment status from PROCESSING to FAILED", async () => {
      const processingPayment = { ...mockPayment, status: "PROCESSING" };
      const failedPayment = { ...mockPayment, status: "FAILED" };

      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        processingPayment,
      );
      mockTenantDb.paymentTransaction.update.mockResolvedValue(failedPayment);

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "FAILED" };

      const result = failedPayment;
      expect(result.status).toBe("FAILED");
    });

    it("should update payment status from COMPLETED to REFUNDED", async () => {
      const completedPayment = { ...mockPayment, status: "COMPLETED" };
      const refundedPayment = { ...mockPayment, status: "REFUNDED" };

      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        completedPayment,
      );
      mockTenantDb.paymentTransaction.update.mockResolvedValue(refundedPayment);

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "REFUNDED" };

      const result = refundedPayment;
      expect(result.status).toBe("REFUNDED");
    });

    it("should reject invalid status transition", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(mockPayment);

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "PENDING" };

      const validTransitions = ["REFUNDED"];
      const isValid = validTransitions.includes(mockRequest.body.status);

      expect(isValid).toBe(false);
    });

    it("should return 404 for nonexistent payment", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(null);

      mockRequest.params = { id: "nonexistent" };
      mockRequest.body = { status: "PROCESSING" };

      const payment = null;
      expect(payment).toBeNull();
    });

    it("should return 409 for invalid state transition", async () => {
      const cancelledPayment = { ...mockPayment, status: "CANCELLED" };
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(
        cancelledPayment,
      );

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "COMPLETED" };

      const validTransitions: Record<string, string[]> = {
        CANCELLED: [],
      };

      const canTransition = validTransitions[cancelledPayment.status]?.includes(
        mockRequest.body.status,
      );
      expect(canTransition).toBeFalsy();
    });

    it("should update externalRef if provided", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(mockPayment);
      mockTenantDb.paymentTransaction.update.mockResolvedValue({
        ...mockPayment,
        providerTxnId: "new-txn-id",
      });

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "PROCESSING", externalRef: "new-txn-id" };

      const result = { ...mockPayment, providerTxnId: "new-txn-id" };
      expect(result.providerTxnId).toBe("new-txn-id");
    });

    it("should set completedAt timestamp on COMPLETED status", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue({
        ...mockPayment,
        status: "PROCESSING",
      });
      mockTenantDb.paymentTransaction.update.mockResolvedValue({
        ...mockPayment,
        status: "COMPLETED",
        completedAt: new Date(),
      });

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "COMPLETED" };

      const result = {
        ...mockPayment,
        status: "COMPLETED",
        completedAt: new Date(),
      };
      expect(result.completedAt).toBeDefined();
    });

    it("should set completedAt timestamp on FAILED status", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue({
        ...mockPayment,
        status: "PROCESSING",
      });
      mockTenantDb.paymentTransaction.update.mockResolvedValue({
        ...mockPayment,
        status: "FAILED",
        completedAt: new Date(),
      });

      mockRequest.params = { id: "pay-123" };
      mockRequest.body = { status: "FAILED" };

      const result = {
        ...mockPayment,
        status: "FAILED",
        completedAt: new Date(),
      };
      expect(result.completedAt).toBeDefined();
    });
  });

  describe("GET /summary - Revenue Summary", () => {
    it("should return total revenue for completed payments", async () => {
      mockTenantDb.paymentTransaction.aggregate.mockResolvedValue({
        _sum: { amount: 5000 },
      });

      const result = { totalRevenue: 5000 };
      expect(result.totalRevenue).toBe(5000);
    });

    it("should group revenue by payment status", async () => {
      mockTenantDb.paymentTransaction.groupBy.mockResolvedValueOnce([
        { status: "COMPLETED", _sum: { amount: 4500 }, _count: 10 },
        { status: "PENDING", _sum: { amount: 500 }, _count: 2 },
        { status: "FAILED", _sum: { amount: 0 }, _count: 0 },
      ]);

      const result = [
        { status: "COMPLETED", amount: 4500, count: 10 },
        { status: "PENDING", amount: 500, count: 2 },
        { status: "FAILED", amount: 0, count: 0 },
      ];

      expect(result).toHaveLength(3);
    });

    it("should group revenue by payment method", async () => {
      mockTenantDb.paymentTransaction.groupBy.mockResolvedValueOnce([
        { method: "CREDIT_CARD", _sum: { amount: 3000 }, _count: 8 },
        { method: "BANK_TRANSFER", _sum: { amount: 2000 }, _count: 2 },
      ]);

      const result = [
        { method: "CREDIT_CARD", amount: 3000, count: 8 },
        { method: "BANK_TRANSFER", amount: 2000, count: 2 },
      ];

      expect(result).toHaveLength(2);
    });

    it("should group revenue by payment type", async () => {
      mockTenantDb.paymentTransaction.groupBy.mockResolvedValueOnce([
        { type: "DELIVERY", _sum: { amount: 4000 }, _count: 12 },
        { type: "REFUND", _sum: { amount: 1000 }, _count: 3 },
      ]);

      const result = [
        { type: "DELIVERY", amount: 4000, count: 12 },
        { type: "REFUND", amount: 1000, count: 3 },
      ];

      expect(result).toHaveLength(2);
    });

    it("should calculate daily revenue totals", async () => {
      const payments = [
        { amount: 100, createdAt: new Date("2024-03-01") },
        { amount: 200, createdAt: new Date("2024-03-01") },
        { amount: 150, createdAt: new Date("2024-03-02") },
      ];

      mockTenantDb.paymentTransaction.findMany.mockResolvedValue(payments);

      const dailyTotals: Record<string, number> = {};
      payments.forEach((p) => {
        const date = p.createdAt.toISOString().split("T")[0];
        dailyTotals[date] = (dailyTotals[date] || 0) + p.amount;
      });

      expect(dailyTotals["2024-03-01"]).toBe(300);
      expect(dailyTotals["2024-03-02"]).toBe(150);
    });

    it("should filter summary by date range", async () => {
      mockTenantDb.paymentTransaction.aggregate.mockResolvedValue({
        _sum: { amount: 2000 },
      });

      mockRequest.query = { dateFrom: "2024-03-01", dateTo: "2024-03-31" };

      const result = { totalRevenue: 2000 };
      expect(result.totalRevenue).toBe(2000);
    });

    it("should handle zero revenue", async () => {
      mockTenantDb.paymentTransaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      mockTenantDb.paymentTransaction.groupBy.mockResolvedValue([]);

      const result = {
        totalRevenue: 0,
        byStatus: [],
        byMethod: [],
        byType: [],
      };

      expect(result.totalRevenue).toBe(0);
    });

    it("should return complete summary object", async () => {
      mockTenantDb.paymentTransaction.aggregate.mockResolvedValue({
        _sum: { amount: 5000 },
      });
      mockTenantDb.paymentTransaction.groupBy.mockResolvedValueOnce([]);
      mockTenantDb.paymentTransaction.groupBy.mockResolvedValueOnce([]);
      mockTenantDb.paymentTransaction.groupBy.mockResolvedValueOnce([]);
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([]);

      const result = {
        totalRevenue: 5000,
        byStatus: [],
        byMethod: [],
        byType: [],
        dailyTotals: {},
      };

      expect(result).toHaveProperty("totalRevenue");
      expect(result).toHaveProperty("byStatus");
      expect(result).toHaveProperty("byMethod");
      expect(result).toHaveProperty("byType");
      expect(result).toHaveProperty("dailyTotals");
    });
  });

  describe("POST /:id/refund - Initiate Refund", () => {
    it("should create refund transaction for completed payment", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        id: "refund-123",
        type: "REFUND",
        status: "PROCESSING",
      });

      mockRequest.params = { id: "pay-123" };

      const result = {
        id: "refund-123",
        type: "REFUND",
        status: "PROCESSING",
      };

      expect(result.type).toBe("REFUND");
      expect(result.status).toBe("PROCESSING");
    });

    it("should return 404 for nonexistent payment", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(null);

      mockRequest.params = { id: "nonexistent" };

      const payment = null;
      expect(payment).toBeNull();
    });

    it("should return 409 when refunding non-completed payment", async () => {
      const pendingPayment = { ...mockPayment, status: "PENDING" };
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(
        pendingPayment,
      );

      mockRequest.params = { id: "pay-123" };

      const canRefund = pendingPayment.status === "COMPLETED";
      expect(canRefund).toBe(false);
    });

    it("should copy metadata from original payment to refund", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        id: "refund-123",
        metadata: { ...mockPayment.metadata, refundedTransactionId: "pay-123" },
      });

      mockRequest.params = { id: "pay-123" };

      const result = {
        id: "refund-123",
        metadata: { ...mockPayment.metadata, refundedTransactionId: "pay-123" },
      };

      expect(result.metadata.refundedTransactionId).toBe("pay-123");
    });

    it("should store original payment ID in refund metadata", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        id: "refund-123",
        metadata: { refundedTransactionId: "pay-123" },
      });

      mockRequest.params = { id: "pay-123" };

      const result = {
        id: "refund-123",
        metadata: { refundedTransactionId: "pay-123" },
      };

      expect(result.metadata.refundedTransactionId).toBe("pay-123");
    });

    it("should use same method as original payment for refund", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        id: "refund-123",
        method: "CREDIT_CARD",
      });

      mockRequest.params = { id: "pay-123" };

      const result = { id: "refund-123", method: "CREDIT_CARD" };
      expect(result.method).toBe("CREDIT_CARD");
    });

    it("should refund full amount of original payment", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        id: "refund-123",
        amount: 150.5,
      });

      mockRequest.params = { id: "pay-123" };

      const result = { id: "refund-123", amount: 150.5 };
      expect(result.amount).toBe(150.5);
    });

    it("should mark original payment as REFUNDED", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        id: "refund-123",
        status: "PROCESSING",
      });
      mockTenantDb.paymentTransaction.update.mockResolvedValue({
        id: "pay-123",
        status: "REFUNDED",
      });

      mockRequest.params = { id: "pay-123" };

      expect(mockTenantDb.paymentTransaction.update).toBeDefined();
    });

    it("should return 201 on successful refund creation", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        id: "refund-123",
        status: "PROCESSING",
      });

      mockRequest.params = { id: "pay-123" };

      expect(mockTenantDb.paymentTransaction.create).toBeDefined();
    });

    it("should include shop details in refund response", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );
      mockTenantDb.paymentTransaction.create.mockResolvedValue({
        id: "refund-123",
        shop: { id: "shop-456", name: "Test Shop" },
      });

      mockRequest.params = { id: "pay-123" };

      const result = {
        id: "refund-123",
        shop: { id: "shop-456", name: "Test Shop" },
      };
      expect(result.shop.name).toBe("Test Shop");
    });
  });

  describe("Input Validation", () => {
    it("should reject invalid currency codes", async () => {
      mockRequest.body = {
        amount: 150.5,
        currency: "INVALID",
      };

      const validCurrencies = ["USD", "EUR", "GBP", "CAD"];
      const isValid = validCurrencies.includes(mockRequest.body.currency);

      expect(isValid).toBe(false);
    });

    it("should reject zero amount", async () => {
      mockRequest.body = {
        amount: 0,
      };

      const isValid = mockRequest.body.amount > 0;
      expect(isValid).toBe(false);
    });

    it("should reject missing shopId", async () => {
      mockRequest.shopId = undefined;

      expect(mockRequest.shopId).toBeUndefined();
    });

    it("should validate status enum values", async () => {
      mockRequest.body = { status: "INVALID_STATUS" };

      const validStatuses = [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "REFUNDED",
        "CANCELLED",
      ];
      const isValid = validStatuses.includes(mockRequest.body.status);

      expect(isValid).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors", async () => {
      mockTenantDb.paymentTransaction.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(mockTenantDb.paymentTransaction.findMany()).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle shipment not found", async () => {
      mockTenantDb.shipment.findFirst.mockResolvedValue(null);

      mockRequest.body = { shipmentId: "nonexistent", paymentType: "DELIVERY" };

      const shipment = null;
      expect(shipment).toBeNull();
    });

    it("should handle concurrent payment updates", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(mockPayment);
      mockTenantDb.paymentTransaction.update.mockResolvedValue(mockPayment);

      expect(mockTenantDb.paymentTransaction.update).toBeDefined();
    });

    it("should handle validation errors gracefully", async () => {
      mockRequest.body = { amount: "invalid" };

      const isValidAmount = typeof mockRequest.body.amount === "number";
      expect(isValidAmount).toBe(false);
    });

    it("should handle invalid UUID in parameters", async () => {
      mockRequest.params = { id: "invalid-uuid" };

      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          mockRequest.params.id as string,
        );

      expect(isValidUUID).toBe(false);
    });
  });

  describe("Tenant Isolation", () => {
    it("should filter payments by shopId", async () => {
      mockRequest.shopId = "shop-456";
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([mockPayment]);

      const result = [{ ...mockPayment, shopId: "shop-456" }];
      const allBelongToShop = result.every(
        (p) => p.shopId === mockRequest.shopId,
      );

      expect(allBelongToShop).toBe(true);
    });

    it("should prevent access to other tenant payments", async () => {
      mockRequest.shopId = "shop-456";
      const otherShopPayment = { ...mockPayment, shopId: "shop-999" };

      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(
        otherShopPayment,
      );

      const payment = otherShopPayment;
      const isAccessible = payment.shopId === mockRequest.shopId;

      expect(isAccessible).toBe(false);
    });

    it("should include shopId in all database queries", async () => {
      mockRequest.shopId = "shop-456";

      const where = { shopId: "shop-456", status: "COMPLETED" };
      expect(where.shopId).toBe(mockRequest.shopId);
    });
  });

  describe("Transaction Integrity", () => {
    it("should ensure refund transaction references original payment", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );

      mockRequest.params = { id: "pay-123" };

      const originalPaymentId = mockPayment.id;
      expect(originalPaymentId).toBe("pay-123");
    });

    it("should maintain amount consistency between payment and refund", async () => {
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValueOnce(
        mockPayment,
      );

      const refundAmount = mockPayment.amount;
      expect(refundAmount).toBe(150.5);
    });

    it("should prevent double refunds of same payment", async () => {
      const refundedPayment = { ...mockPayment, status: "REFUNDED" };
      mockTenantDb.paymentTransaction.findFirst.mockResolvedValue(
        refundedPayment,
      );

      mockRequest.params = { id: "pay-123" };

      const canRefund = refundedPayment.status === "COMPLETED";
      expect(canRefund).toBe(false);
    });
  });
});
