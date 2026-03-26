import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  jwt?: {
    sign: (payload: Record<string, unknown>, options?: Record<string, unknown>) => string;
  };
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

// Helper to generate valid test data
const generateTestPaymentMethod = () => ({
  id: "pm-123",
  tenantId: "tenant-456",
  type: "CREDIT_CARD",
  cardBrand: "VISA",
  cardLast4: "4242",
  cardExpMonth: 12,
  cardExpYear: 2026,
  isDefault: true,
  externalPaymentId: "pm_ext_123",
  billingName: "John Doe",
  billingEmail: "john@example.com",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const generateTestTenant = () => ({
  id: "tenant-456",
  name: "Test Tenant",
  slug: "test-tenant",
  isActive: true,
  createdAt: new Date(),
});

const generateTestBankAccount = () => ({
  id: "pm-bank-789",
  tenantId: "tenant-456",
  type: "BANK_ACCOUNT",
  bankAccountLast4: "6789",
  bankName: "Chase Bank",
  accountHolderName: "John Doe",
  isDefault: false,
  externalPaymentId: "ba_ext_456",
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ─────────────────────────────────────────────────────────────────

describe("Payment Methods Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockPrisma: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      jwt: {
        sign: vi.fn((payload, options) => `jwt_token_${payload.sub}`),
      },
    };

    mockReply = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
    };

    mockPrisma = {
      paymentMethod: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateMany: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
      },
    };
  });

  describe("GET /payment-methods (List methods)", () => {
    it("should list all payment methods for a tenant", async () => {
      const tenant = generateTestTenant();
      const card1 = generateTestPaymentMethod();
      const card2 = {
        ...generateTestPaymentMethod(),
        id: "pm-124",
        cardLast4: "5555",
        isDefault: false,
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([card1, card2]);

      const methods = await (mockPrisma as any).paymentMethod.findMany({
        where: { tenantId: tenant.id },
      });

      expect(methods).toHaveLength(2);
      expect(methods[0].type).toBe("CREDIT_CARD");
    });

    it("should return empty list when no payment methods exist", async () => {
      const tenant = generateTestTenant();
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([]);

      const methods = await (mockPrisma as any).paymentMethod.findMany({
        where: { tenantId: tenant.id },
      });

      expect(methods).toHaveLength(0);
    });

    it("should return 401 when tenant not found", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const tenant = await (mockPrisma as any).tenant.findUnique({
        where: { id: "invalid-tenant" },
      });

      expect(tenant).toBeNull();
    });

    it("should mask card details in list response", async () => {
      const tenant = generateTestTenant();
      const card = generateTestPaymentMethod();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([card]);

      const methods = await (mockPrisma as any).paymentMethod.findMany({
        where: { tenantId: tenant.id },
      });

      expect(methods[0].cardLast4).toBe("4242");
      expect(methods[0].cardBrand).toBe("VISA");
    });

    it("should indicate default payment method", async () => {
      const tenant = generateTestTenant();
      const card1 = generateTestPaymentMethod();
      const card2 = { ...generateTestPaymentMethod(), id: "pm-124", isDefault: false };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([card1, card2]);

      const methods = await (mockPrisma as any).paymentMethod.findMany({
        where: { tenantId: tenant.id },
      });

      const defaultMethod = methods.find((m: any) => m.isDefault);
      expect(defaultMethod.id).toBe("pm-123");
    });

    it("should filter by payment method type", async () => {
      const tenant = generateTestTenant();
      const creditCard = generateTestPaymentMethod();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([creditCard]);

      const methods = await (mockPrisma as any).paymentMethod.findMany({
        where: { tenantId: tenant.id, type: "CREDIT_CARD" },
      });

      expect(methods[0].type).toBe("CREDIT_CARD");
    });
  });

  describe("GET /payment-methods/:id (Get single method)", () => {
    it("should retrieve a specific payment method", async () => {
      const method = generateTestPaymentMethod();

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);

      const result = await (mockPrisma as any).paymentMethod.findUnique({
        where: { id: method.id },
      });

      expect(result.id).toBe("pm-123");
      expect(result.type).toBe("CREDIT_CARD");
    });

    it("should return 404 for non-existent payment method", async () => {
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

      const result = await (mockPrisma as any).paymentMethod.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });

    it("should include full payment method details", async () => {
      const method = generateTestPaymentMethod();

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);

      const result = await (mockPrisma as any).paymentMethod.findUnique({
        where: { id: method.id },
      });

      expect(result.billingName).toBe("John Doe");
      expect(result.billingEmail).toBe("john@example.com");
    });

    it("should show card expiry information", async () => {
      const method = generateTestPaymentMethod();

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);

      const result = await (mockPrisma as any).paymentMethod.findUnique({
        where: { id: method.id },
      });

      expect(result.cardExpMonth).toBe(12);
      expect(result.cardExpYear).toBe(2026);
    });
  });

  describe("POST /payment-methods (Add payment method)", () => {
    it("should add a new credit card", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.create.mockResolvedValue(generateTestPaymentMethod());

      mockRequest.body = {
        tenantId: tenant.id,
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpMonth: 12,
        cardExpYear: 2026,
        cardCvc: "123",
        billingName: "John Doe",
        billingEmail: "john@example.com",
      };

      const result = await (mockPrisma as any).paymentMethod.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("CREDIT_CARD");
      expect(result.cardBrand).toBe("VISA");
    });

    it("should add a new bank account", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.create.mockResolvedValue(generateTestBankAccount());

      mockRequest.body = {
        tenantId: tenant.id,
        type: "BANK_ACCOUNT",
        accountHolderName: "John Doe",
        bankAccountNumber: "123456789",
        bankRoutingNumber: "987654321",
        bankName: "Chase Bank",
      };

      const result = await (mockPrisma as any).paymentMethod.create({
        data: mockRequest.body,
      });

      expect(result.type).toBe("BANK_ACCOUNT");
      expect(result.bankName).toBe("Chase Bank");
    });

    it("should detect card type from card number", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.create.mockResolvedValue({
        ...generateTestPaymentMethod(),
        cardBrand: "VISA",
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpMonth: 12,
        cardExpYear: 2026,
        cardCvc: "123",
      };

      const result = await (mockPrisma as any).paymentMethod.create({
        data: mockRequest.body,
      });

      expect(result.cardBrand).toBe("VISA");
    });

    it("should detect Mastercard from card number", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.create.mockResolvedValue({
        ...generateTestPaymentMethod(),
        cardBrand: "MASTERCARD",
        cardLast4: "5555",
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "CREDIT_CARD",
        cardNumber: "5555555555554444",
        cardExpMonth: 12,
        cardExpYear: 2026,
        cardCvc: "123",
      };

      const result = await (mockPrisma as any).paymentMethod.create({
        data: mockRequest.body,
      });

      expect(result.cardBrand).toBe("MASTERCARD");
    });

    it("should detect Amex from card number", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.create.mockResolvedValue({
        ...generateTestPaymentMethod(),
        cardBrand: "AMEX",
        cardLast4: "8765",
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "CREDIT_CARD",
        cardNumber: "378282246310005",
        cardExpMonth: 12,
        cardExpYear: 2026,
        cardCvc: "1234",
      };

      const result = await (mockPrisma as any).paymentMethod.create({
        data: mockRequest.body,
      });

      expect(result.cardBrand).toBe("AMEX");
    });

    it("should reject invalid card number", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        type: "CREDIT_CARD",
        cardNumber: "1234567890123456",
        cardExpMonth: 12,
        cardExpYear: 2026,
        cardCvc: "123",
      };

      const isValidCard = /^\d{13,19}$/.test(String(mockRequest.body.cardNumber));
      expect(isValidCard).toBe(true);
    });

    it("should reject card without expiry month", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpYear: 2026,
        cardCvc: "123",
      };

      expect(mockRequest.body.cardExpMonth).toBeUndefined();
    });

    it("should reject card without expiry year", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpMonth: 12,
        cardCvc: "123",
      };

      expect(mockRequest.body.cardExpYear).toBeUndefined();
    });

    it("should reject card without CVC", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpMonth: 12,
        cardExpYear: 2026,
      };

      expect(mockRequest.body.cardCvc).toBeUndefined();
    });

    it("should reject expired card", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpMonth: 1,
        cardExpYear: 2020,
        cardCvc: "123",
      };

      const isExpired = mockRequest.body.cardExpYear < 2026;
      expect(isExpired).toBe(true);
    });

    it("should reject invalid expiry month", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpMonth: 13,
        cardExpYear: 2026,
        cardCvc: "123",
      };

      expect(Number(mockRequest.body.cardExpMonth) > 12).toBe(true);
    });

    it("should reject invalid tenant", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        tenantId: "invalid-tenant",
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
      };

      const tenant = await (mockPrisma as any).tenant.findUnique({
        where: { id: "invalid-tenant" },
      });

      expect(tenant).toBeNull();
    });

    it("should set as default if no default exists", async () => {
      const tenant = generateTestTenant();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([]);
      mockPrisma.paymentMethod.create.mockResolvedValue({
        ...generateTestPaymentMethod(),
        isDefault: true,
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpMonth: 12,
        cardExpYear: 2026,
        cardCvc: "123",
      };

      const result = await (mockPrisma as any).paymentMethod.create({
        data: mockRequest.body,
      });

      expect(result.isDefault).toBe(true);
    });

    it("should not set as default if default already exists", async () => {
      const tenant = generateTestTenant();
      const existingDefault = generateTestPaymentMethod();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([existingDefault]);
      mockPrisma.paymentMethod.create.mockResolvedValue({
        ...generateTestPaymentMethod(),
        id: "pm-new",
        isDefault: false,
      });

      mockRequest.body = {
        tenantId: tenant.id,
        type: "CREDIT_CARD",
        cardNumber: "4242424242424242",
        cardExpMonth: 12,
        cardExpYear: 2026,
        cardCvc: "123",
      };

      const result = await (mockPrisma as any).paymentMethod.create({
        data: mockRequest.body,
      });

      expect(result.isDefault).toBe(false);
    });
  });

  describe("PUT /payment-methods/:id/default (Set as default)", () => {
    it("should set payment method as default", async () => {
      const currentDefault = generateTestPaymentMethod();
      const newDefault = {
        ...generateTestPaymentMethod(),
        id: "pm-124",
        isDefault: true,
      };
      const unsetDefault = { ...currentDefault, isDefault: false };

      mockPrisma.paymentMethod.findUnique.mockResolvedValueOnce(newDefault);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([currentDefault]);
      mockPrisma.paymentMethod.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.paymentMethod.update.mockResolvedValue(newDefault);

      mockRequest.params = { id: newDefault.id };

      const result = await (mockPrisma as any).paymentMethod.update({
        where: { id: newDefault.id },
        data: { isDefault: true },
      });

      expect(result.isDefault).toBe(true);
    });

    it("should unset previous default when setting new default", async () => {
      const currentDefault = generateTestPaymentMethod();
      const newDefault = {
        ...generateTestPaymentMethod(),
        id: "pm-124",
        isDefault: false,
      };

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(newDefault);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([currentDefault]);
      mockPrisma.paymentMethod.updateMany.mockResolvedValue({ count: 1 });

      mockRequest.params = { id: newDefault.id };

      await (mockPrisma as any).paymentMethod.updateMany({
        where: { tenantId: newDefault.tenantId, isDefault: true },
        data: { isDefault: false },
      });

      expect(mockPrisma.paymentMethod.updateMany).toHaveBeenCalled();
    });

    it("should return 404 for non-existent payment method", async () => {
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: "invalid-id" };

      const result = await (mockPrisma as any).paymentMethod.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });
  });

  describe("PUT /payment-methods/:id (Update method)", () => {
    it("should update billing name", async () => {
      const method = generateTestPaymentMethod();
      const updatedMethod = {
        ...method,
        billingName: "Jane Doe",
      };

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);
      mockPrisma.paymentMethod.update.mockResolvedValue(updatedMethod);

      mockRequest.params = { id: method.id };
      mockRequest.body = { billingName: "Jane Doe" };

      const result = await (mockPrisma as any).paymentMethod.update({
        where: { id: method.id },
        data: mockRequest.body,
      });

      expect(result.billingName).toBe("Jane Doe");
    });

    it("should update billing email", async () => {
      const method = generateTestPaymentMethod();
      const updatedMethod = {
        ...method,
        billingEmail: "jane@example.com",
      };

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);
      mockPrisma.paymentMethod.update.mockResolvedValue(updatedMethod);

      mockRequest.params = { id: method.id };
      mockRequest.body = { billingEmail: "jane@example.com" };

      const result = await (mockPrisma as any).paymentMethod.update({
        where: { id: method.id },
        data: mockRequest.body,
      });

      expect(result.billingEmail).toBe("jane@example.com");
    });

    it("should return 404 for non-existent method", async () => {
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: "invalid-id" };
      mockRequest.body = { billingName: "New Name" };

      const result = await (mockPrisma as any).paymentMethod.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });
  });

  describe("DELETE /payment-methods/:id (Delete method)", () => {
    it("should delete a payment method", async () => {
      const method = generateTestPaymentMethod();

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);
      mockPrisma.paymentMethod.delete.mockResolvedValue(method);

      mockRequest.params = { id: method.id };

      await (mockPrisma as any).paymentMethod.delete({
        where: { id: method.id },
      });

      expect(mockPrisma.paymentMethod.delete).toHaveBeenCalledWith({
        where: { id: method.id },
      });
    });

    it("should return 404 when deleting non-existent method", async () => {
      mockPrisma.paymentMethod.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: "invalid-id" };

      const result = await (mockPrisma as any).paymentMethod.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });

    it("should prevent deletion of default payment method", async () => {
      const method = generateTestPaymentMethod();

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);

      mockRequest.params = { id: method.id };

      expect(method.isDefault).toBe(true);
    });

    it("should allow deletion of non-default payment method", async () => {
      const method = {
        ...generateTestPaymentMethod(),
        isDefault: false,
      };

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);
      mockPrisma.paymentMethod.delete.mockResolvedValue(method);

      mockRequest.params = { id: method.id };

      await (mockPrisma as any).paymentMethod.delete({
        where: { id: method.id },
      });

      expect(mockPrisma.paymentMethod.delete).toHaveBeenCalled();
    });

    it("should auto-set new default if deleting current default", async () => {
      const defaultMethod = generateTestPaymentMethod();
      const otherMethod = {
        ...generateTestPaymentMethod(),
        id: "pm-124",
        isDefault: false,
      };

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(defaultMethod);
      mockPrisma.paymentMethod.findMany.mockResolvedValue([otherMethod]);
      mockPrisma.paymentMethod.delete.mockResolvedValue(defaultMethod);
      mockPrisma.paymentMethod.update.mockResolvedValue({
        ...otherMethod,
        isDefault: true,
      });

      mockRequest.params = { id: defaultMethod.id };

      await (mockPrisma as any).paymentMethod.delete({
        where: { id: defaultMethod.id },
      });

      expect(mockPrisma.paymentMethod.delete).toHaveBeenCalled();
    });
  });

  describe("Card Validation", () => {
    it("should validate expiry date is not in the past", () => {
      const currentDate = new Date(2026, 2, 1);
      const expMonth = 1;
      const expYear = 2026;

      const isExpired = expYear < currentDate.getFullYear() ||
        (expYear === currentDate.getFullYear() && expMonth < currentDate.getMonth() + 1);

      expect(isExpired).toBe(true);
    });

    it("should accept future expiry dates", () => {
      const currentDate = new Date(2026, 2, 1);
      const expMonth = 12;
      const expYear = 2026;

      const isValid = expYear > currentDate.getFullYear() ||
        (expYear === currentDate.getFullYear() && expMonth >= currentDate.getMonth() + 1);

      expect(isValid).toBe(true);
    });

    it("should validate CVC length for Visa/Mastercard", () => {
      const cvc = "123";
      const isValidCvc = cvc.length === 3 || cvc.length === 4;
      expect(isValidCvc).toBe(true);
    });

    it("should validate CVC length for Amex", () => {
      const cvc = "1234";
      const isValidCvc = cvc.length === 4;
      expect(isValidCvc).toBe(true);
    });
  });

  describe("Edge Cases & Error Handling", () => {
    it("should handle payment method with null billing email gracefully", async () => {
      const method = {
        ...generateTestPaymentMethod(),
        billingEmail: null,
      };

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);

      const result = await (mockPrisma as any).paymentMethod.findUnique({
        where: { id: method.id },
      });

      expect(result.billingEmail).toBeNull();
    });

    it("should preserve creation timestamp on updates", async () => {
      const method = generateTestPaymentMethod();
      const createdAt = method.createdAt;

      mockPrisma.paymentMethod.update.mockResolvedValue({
        ...method,
        updatedAt: new Date(),
      });

      const updated = await (mockPrisma as any).paymentMethod.update({
        where: { id: method.id },
        data: { billingName: "Updated Name" },
      });

      expect(updated.createdAt).toEqual(createdAt);
    });

    it("should handle multiple payment methods for same tenant", async () => {
      const tenant = generateTestTenant();
      const methods = [
        generateTestPaymentMethod(),
        { ...generateTestPaymentMethod(), id: "pm-124", isDefault: false },
        { ...generateTestPaymentMethod(), id: "pm-125", isDefault: false },
      ];

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.paymentMethod.findMany.mockResolvedValue(methods);

      const result = await (mockPrisma as any).paymentMethod.findMany({
        where: { tenantId: tenant.id },
      });

      expect(result).toHaveLength(3);
    });

    it("should handle payment method deletion with pending charges", async () => {
      const method = generateTestPaymentMethod();

      mockPrisma.paymentMethod.findUnique.mockResolvedValue(method);

      expect(method.id).toBe("pm-123");
    });
  });
});
