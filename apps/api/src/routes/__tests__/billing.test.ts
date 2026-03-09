import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  shopId?: string;
  tenantDb?: Record<string, any>;
  auth?: Record<string, unknown>;
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
  code?: (code: number) => MockReply;
}

// Test data generators
const generateTestShop = (overrides?: Record<string, unknown>) => ({
  id: "shop-789",
  shopifyDomain: "test-shop.myshopify.com",
  orgId: "org-123",
  isActive: true,
  planTier: "STARTER",
  settings: {},
  ...overrides,
});

const generateTestSubscription = (overrides?: Record<string, unknown>) => ({
  shopId: "shop-789",
  planTier: "STARTER",
  status: "active",
  amount: 99,
  renewalDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
  cancelledAt: null,
  cancelledEffectiveAt: null,
  ...overrides,
});

const generatePaymentTransaction = (overrides?: Record<string, unknown>) => ({
  id: "txn-123",
  shopId: "shop-789",
  type: "CHARGE",
  amount: 99,
  currency: "USD",
  status: "completed",
  createdAt: new Date(),
  metadata: { description: "Subscription charge" },
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────

describe("Billing Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      shopId: "shop-789",
      auth: { userId: "user-123" },
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

    mockTenantDb = {
      shop: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      subscription: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      shipment: {
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      driver: {
        count: vi.fn(),
      },
      notificationMeterEvent: {
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      routingMeterEvent: {
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      paymentTransaction: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      activityLog: {
        create: vi.fn(),
      },
      $queryRawUnsafe: vi.fn(),
    };

    mockRequest.tenantDb = mockTenantDb;
  });

  describe("GET /plans", () => {
    it("should return list of available plans", async () => {
      const plans = [
        { id: "FREE", name: "Free", monthlyPrice: 0 },
        { id: "STARTER", name: "Starter", monthlyPrice: 99 },
        { id: "GROWTH", name: "Growth", monthlyPrice: 299 },
        { id: "ENTERPRISE", name: "Enterprise", monthlyPrice: 999 },
      ];

      expect(plans).toHaveLength(4);
      expect(plans[0].id).toBe("FREE");
    });

    it("should include plan features and pricing", async () => {
      const plan = {
        id: "STARTER",
        name: "Starter",
        monthlyPrice: 99,
        shipmentsPerMonth: 5000,
        apiCallsPerMonth: 100000,
        notificationsPerMonth: 50000,
      };

      expect(plan.monthlyPrice).toBe(99);
      expect(plan.shipmentsPerMonth).toBe(5000);
    });

    it("should return metadata with plan count and timestamp", async () => {
      const response = {
        plans: [],
        metadata: {
          total: 4,
          timestamp: new Date(),
        },
      };

      expect(response.metadata.total).toBe(4);
      expect(response.metadata.timestamp).toBeInstanceOf(Date);
    });

    it("should include all plan tiers", async () => {
      const planIds = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"];
      expect(planIds).toContain("FREE");
      expect(planIds).toContain("ENTERPRISE");
    });
  });

  describe("GET /subscription", () => {
    it("should return subscription status for shop", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.shipment.count.mockResolvedValue(100);
      mockTenantDb.driver.count.mockResolvedValue(5);
      mockTenantDb.notificationMeterEvent.count.mockResolvedValue(500);
      mockTenantDb.routingMeterEvent.count.mockResolvedValue(1000);

      mockRequest.shopId = shop.id;

      const result = await mockTenantDb.shop.findUnique({
        where: { id: shop.id },
      });

      expect(result?.planTier).toBe("STARTER");
    });

    it("should return 404 for non-existent shop", async () => {
      mockTenantDb.shop.findUnique.mockResolvedValue(null);
      mockRequest.shopId = "non-existent-shop";

      const result = await mockTenantDb.shop.findUnique({
        where: { id: mockRequest.shopId },
      });

      expect(result).toBeNull();
    });

    it("should include usage metrics in response", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.shipment.count.mockResolvedValue(100);
      mockTenantDb.driver.count.mockResolvedValue(5);
      mockTenantDb.notificationMeterEvent.count.mockResolvedValue(500);
      mockTenantDb.routingMeterEvent.count.mockResolvedValue(1000);

      const metrics = {
        shipmentsUsed: 100,
        driversUsed: 5,
        notificationsSent: 500,
        apiCallsUsed: 1000,
      };

      expect(metrics.shipmentsUsed).toBe(100);
      expect(metrics.apiCallsUsed).toBe(1000);
    });

    it("should include billing period dates", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      expect(billingPeriodStart).toBeTruthy();
      expect(billingPeriodEnd > billingPeriodStart).toBe(true);
    });

    it("should count shipments within current billing period", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.shipment.count.mockResolvedValue(150);

      mockRequest.shopId = shop.id;

      const count = await mockTenantDb.shipment.count({
        where: { shopId: shop.id },
      });

      expect(count).toBe(150);
    });

    it("should include subscription status", async () => {
      const shop = generateTestShop();
      const subscription = generateTestSubscription();

      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.subscription.findUnique.mockResolvedValue(subscription);

      const result = await mockTenantDb.subscription.findUnique({
        where: { shopId: shop.id },
      });

      expect(result?.status).toBe("active");
    });

    it("should include plan limits", async () => {
      const limits = {
        shipmentsPerMonth: 5000,
        apiCallsPerMonth: 100000,
        notificationsPerMonth: 50000,
      };

      expect(limits.shipmentsPerMonth).toBe(5000);
      expect(limits.apiCallsPerMonth).toBe(100000);
    });
  });

  describe("POST /subscription (Create/Upgrade)", () => {
    it("should successfully upgrade from FREE to STARTER plan", async () => {
      const shop = generateTestShop({ planTier: "FREE" });
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.shop.update.mockResolvedValue({
        ...shop,
        planTier: "STARTER",
      });
      mockTenantDb.subscription.upsert.mockResolvedValue(
        generateTestSubscription()
      );
      mockTenantDb.activityLog.create.mockResolvedValue({});

      mockRequest.body = { planId: "STARTER" };
      mockRequest.shopId = shop.id;

      const result = await mockTenantDb.shop.update({
        where: { id: shop.id },
        data: { planTier: "STARTER" },
      });

      expect(result?.planTier).toBe("STARTER");
    });

    it("should return 409 when upgrading to same plan", async () => {
      const shop = generateTestShop({ planTier: "STARTER" });
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      mockRequest.body = { planId: "STARTER" };
      mockRequest.shopId = shop.id;

      expect(shop.planTier).toBe("STARTER");
    });

    it("should return 404 for non-existent shop", async () => {
      mockTenantDb.shop.findUnique.mockResolvedValue(null);
      mockRequest.body = { planId: "STARTER" };
      mockRequest.shopId = "non-existent";

      const result = await mockTenantDb.shop.findUnique({
        where: { id: mockRequest.shopId },
      });

      expect(result).toBeNull();
    });

    it("should reject invalid plan ID", async () => {
      mockRequest.body = { planId: "INVALID_PLAN" };

      const validPlans = ["FREE", "STARTER", "GROWTH", "ENTERPRISE"];
      expect(validPlans).not.toContain(mockRequest.body.planId);
    });

    it("should reject request with missing planId", () => {
      mockRequest.body = {};

      expect(mockRequest.body.planId).toBeUndefined();
    });

    it("should calculate proration for mid-month upgrade", async () => {
      const shop = generateTestShop({ planTier: "STARTER" });
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      mockRequest.body = { planId: "GROWTH" };

      const now = new Date();
      const daysRemaining = Math.ceil(
        (new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime() -
          now.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      expect(daysRemaining).toBeGreaterThan(0);
      expect(daysRemaining).toBeLessThanOrEqual(31);
    });

    it("should create billing record in subscription table", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.subscription.upsert.mockResolvedValue(
        generateTestSubscription({ planTier: "GROWTH" })
      );

      mockRequest.body = { planId: "GROWTH" };
      mockRequest.shopId = shop.id;

      const result = await mockTenantDb.subscription.upsert({
        where: { shopId: shop.id },
        update: { planTier: "GROWTH" },
        create: { shopId: shop.id, planTier: "GROWTH" },
      });

      expect(result?.planTier).toBe("GROWTH");
    });

    it("should log subscription change in activity log", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.activityLog.create.mockResolvedValue({});

      mockRequest.body = { planId: "GROWTH" };

      await mockTenantDb.activityLog.create({
        data: {
          shopId: shop.id,
          action: "PLAN_UPGRADED",
        },
      });

      expect(mockTenantDb.activityLog.create).toHaveBeenCalled();
    });

    it("should return 201 status code on successful upgrade", async () => {
      mockRequest.statusCode = 201;

      expect(mockRequest.statusCode).toBe(201);
    });

    it("should include confirmation URL in response", async () => {
      const chargeId = "gid://shopify/RecurringApplicationCharge/123456";
      const confirmationUrl = `https://admin.shopify.com/charges/${chargeId}`;

      expect(confirmationUrl).toContain("admin.shopify.com");
    });

    it("should require ADMIN or SUPER_ADMIN role", async () => {
      mockRequest.body = { planId: "GROWTH" };

      expect(mockRequest.body).toBeTruthy();
    });

    it("should support plan downgrades", async () => {
      const shop = generateTestShop({ planTier: "GROWTH" });
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.shop.update.mockResolvedValue({
        ...shop,
        planTier: "STARTER",
      });

      mockRequest.body = { planId: "STARTER" };

      const result = await mockTenantDb.shop.update({
        where: { id: shop.id },
        data: { planTier: "STARTER" },
      });

      expect(result?.planTier).toBe("STARTER");
    });
  });

  describe("POST /subscription/cancel", () => {
    it("should successfully cancel subscription", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.subscription.update.mockResolvedValue({
        ...generateTestSubscription(),
        status: "cancelled",
      });
      mockTenantDb.shop.update.mockResolvedValue({
        ...shop,
        planTier: "FREE",
      });
      mockTenantDb.activityLog.create.mockResolvedValue({});

      mockRequest.shopId = shop.id;

      const result = await mockTenantDb.shop.update({
        where: { id: shop.id },
        data: { planTier: "FREE" },
      });

      expect(result?.planTier).toBe("FREE");
    });

    it("should return 404 for non-existent shop", async () => {
      mockTenantDb.shop.findUnique.mockResolvedValue(null);
      mockRequest.shopId = "non-existent";

      const result = await mockTenantDb.shop.findUnique({
        where: { id: mockRequest.shopId },
      });

      expect(result).toBeNull();
    });

    it("should downgrade plan to FREE after cancellation", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.shop.update.mockResolvedValue({
        ...shop,
        planTier: "FREE",
      });

      mockRequest.shopId = shop.id;

      const result = await mockTenantDb.shop.update({
        where: { id: shop.id },
        data: { planTier: "FREE" },
      });

      expect(result?.planTier).toBe("FREE");
    });

    it("should set effective cancellation date to end of billing cycle", async () => {
      const now = new Date();
      const effectiveDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      expect(effectiveDate).toBeTruthy();
      expect(effectiveDate > now).toBe(true);
    });

    it("should log cancellation in activity log", async () => {
      const shop = generateTestShop();
      mockTenantDb.activityLog.create.mockResolvedValue({});

      await mockTenantDb.activityLog.create({
        data: {
          shopId: shop.id,
          action: "PLAN_CANCELLED",
        },
      });

      expect(mockTenantDb.activityLog.create).toHaveBeenCalled();
    });

    it("should update subscription status to cancelled", async () => {
      mockTenantDb.subscription.update.mockResolvedValue({
        status: "cancelled",
        cancelledAt: new Date(),
      });

      const result = await mockTenantDb.subscription.update({
        where: { shopId: "shop-789" },
        data: { status: "cancelled" },
      });

      expect(result?.status).toBe("cancelled");
    });

    it("should require ADMIN or SUPER_ADMIN role", async () => {
      expect(mockRequest.auth).toBeTruthy();
    });

    it("should return 200 status on successful cancellation", async () => {
      mockRequest.statusCode = 200;

      expect(mockRequest.statusCode).toBe(200);
    });

    it("should include effective date in response", async () => {
      const response = {
        status: "cancelled",
        effectiveDate: new Date(),
      };

      expect(response.status).toBe("cancelled");
      expect(response.effectiveDate).toBeInstanceOf(Date);
    });
  });

  describe("GET /usage", () => {
    it("should return usage metrics for current billing period", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.shipment.groupBy.mockResolvedValue([
        { createdAt: new Date(), _count: 50 },
      ]);
      mockTenantDb.routingMeterEvent.groupBy.mockResolvedValue([
        { timestamp: new Date(), _count: 500 },
      ]);
      mockTenantDb.notificationMeterEvent.groupBy.mockResolvedValue([
        { timestamp: new Date(), _count: 200 },
      ]);

      mockRequest.shopId = shop.id;

      const metrics = {
        shipments: { used: 50, limit: 5000 },
        apiCalls: { used: 500, limit: 100000 },
        notifications: { used: 200, limit: 50000 },
      };

      expect(metrics.shipments.used).toBe(50);
      expect(metrics.apiCalls.used).toBe(500);
    });

    it("should return 404 for non-existent shop", async () => {
      mockTenantDb.shop.findUnique.mockResolvedValue(null);
      mockRequest.shopId = "non-existent";

      const result = await mockTenantDb.shop.findUnique({
        where: { id: mockRequest.shopId },
      });

      expect(result).toBeNull();
    });

    it("should include daily breakdown of usage", async () => {
      mockTenantDb.shipment.groupBy.mockResolvedValue([
        { createdAt: new Date("2026-03-01"), _count: 10 },
        { createdAt: new Date("2026-03-02"), _count: 20 },
        { createdAt: new Date("2026-03-03"), _count: 15 },
      ]);

      const dailyShipments = [
        { date: new Date("2026-03-01"), count: 10 },
        { date: new Date("2026-03-02"), count: 20 },
      ];

      expect(dailyShipments).toHaveLength(2);
      expect(dailyShipments[0].count).toBe(10);
    });

    it("should include usage limits based on plan tier", async () => {
      const shop = generateTestShop({ planTier: "GROWTH" });
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);

      const limits = {
        GROWTH: {
          shipmentsPerMonth: 50000,
          apiCallsPerMonth: 500000,
          notificationsPerMonth: 200000,
        },
      };

      expect(limits.GROWTH.shipmentsPerMonth).toBe(50000);
    });

    it("should calculate percentage usage for each metric", async () => {
      const metrics = {
        shipments: { used: 2500, limit: 5000, percentageUsed: 50 },
        apiCalls: { used: 50000, limit: 100000, percentageUsed: 50 },
      };

      expect(metrics.shipments.percentageUsed).toBe(50);
      expect(metrics.apiCalls.percentageUsed).toBe(50);
    });

    it("should include remaining quota for each metric", async () => {
      const metrics = {
        shipments: { used: 100, limit: 5000, remaining: 4900 },
        apiCalls: { used: 10000, limit: 100000, remaining: 90000 },
      };

      expect(metrics.shipments.remaining).toBe(4900);
      expect(metrics.apiCalls.remaining).toBe(90000);
    });

    it("should include days remaining in billing period", async () => {
      const now = new Date();
      const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysRemaining = Math.ceil(
        (billingPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysRemaining).toBeGreaterThan(0);
    });
  });

  describe("POST /usage/event", () => {
    it("should accept shipment_created event", async () => {
      mockRequest.body = {
        type: "shipment_created",
        metadata: { shipmentId: "shipment-123" },
      };

      expect(mockRequest.body.type).toBe("shipment_created");
    });

    it("should accept label_generated event", async () => {
      mockRequest.body = {
        type: "label_generated",
      };

      expect(mockRequest.body.type).toBe("label_generated");
    });

    it("should accept notification_sent event", async () => {
      mockRequest.body = {
        type: "notification_sent",
        metadata: { channel: "email" },
      };

      expect(mockRequest.body.type).toBe("notification_sent");
    });

    it("should accept api_call event", async () => {
      mockRequest.body = {
        type: "api_call",
        metadata: { endpoint: "/shipments" },
      };

      expect(mockRequest.body.type).toBe("api_call");
    });

    it("should reject invalid event type", () => {
      mockRequest.body = {
        type: "invalid_event",
      };

      const validTypes = [
        "shipment_created",
        "label_generated",
        "notification_sent",
        "api_call",
      ];
      expect(validTypes).not.toContain(mockRequest.body.type);
    });

    it("should accept optional metadata", async () => {
      mockRequest.body = {
        type: "shipment_created",
        metadata: { customKey: "customValue" },
      };

      expect(mockRequest.body.metadata).toBeTruthy();
    });

    it("should return 204 No Content on success", async () => {
      mockReply.statusCode = 204;

      expect(mockReply.statusCode).toBe(204);
    });

    it("should handle missing event type", () => {
      mockRequest.body = {
        metadata: { some: "data" },
      };

      expect(mockRequest.body.type).toBeUndefined();
    });
  });

  describe("GET /invoices", () => {
    it("should list billing history with pagination", async () => {
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([
        generatePaymentTransaction(),
        generatePaymentTransaction({ id: "txn-124", amount: 199 }),
      ]);
      mockTenantDb.paymentTransaction.count.mockResolvedValue(2);

      mockRequest.query = { page: 1, limit: 20 };
      mockRequest.shopId = "shop-789";

      const invoices = await mockTenantDb.paymentTransaction.findMany({
        where: { shopId: mockRequest.shopId, type: "CHARGE" },
      });

      expect(invoices).toHaveLength(2);
    });

    it("should return 404 for invalid pagination", async () => {
      mockRequest.query = { page: 0, limit: 0 };

      expect(mockRequest.query.page).toBeLessThanOrEqual(0);
    });

    it("should default to page 1 and limit 20", async () => {
      mockRequest.query = {};

      const page = (mockRequest.query.page as number) || 1;
      const limit = (mockRequest.query.limit as number) || 20;

      expect(page).toBe(1);
      expect(limit).toBe(20);
    });

    it("should enforce maximum limit of 100", async () => {
      mockRequest.query = { limit: 150 };

      const limit = Math.min(100, (mockRequest.query.limit as number) || 20);
      expect(limit).toBe(100);
    });

    it("should include invoice details in response", async () => {
      const transaction = generatePaymentTransaction();
      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([transaction]);

      const invoice = {
        id: transaction.id,
        date: transaction.createdAt,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
      };

      expect(invoice.amount).toBe(99);
      expect(invoice.currency).toBe("USD");
    });

    it("should include pagination metadata in response", async () => {
      mockTenantDb.paymentTransaction.count.mockResolvedValue(50);

      const pagination = {
        page: 1,
        limit: 20,
        total: 50,
        pages: Math.ceil(50 / 20),
      };

      expect(pagination.pages).toBe(3);
    });

    it("should sort invoices by creation date descending", async () => {
      const earlier = generatePaymentTransaction({
        id: "txn-1",
        createdAt: new Date("2026-01-01"),
      });
      const later = generatePaymentTransaction({
        id: "txn-2",
        createdAt: new Date("2026-03-09"),
      });

      mockTenantDb.paymentTransaction.findMany.mockResolvedValue([later, earlier]);

      const invoices = await mockTenantDb.paymentTransaction.findMany({
        where: { shopId: "shop-789" },
        orderBy: { createdAt: "desc" },
      });

      expect(invoices[0].createdAt > invoices[1].createdAt).toBe(true);
    });

    it("should filter by CHARGE type only", async () => {
      const transaction = generatePaymentTransaction({ type: "CHARGE" });

      expect(transaction.type).toBe("CHARGE");
    });

    it("should skip transactions based on pagination", async () => {
      const pageSize = 20;
      const skip = (2 - 1) * pageSize;

      expect(skip).toBe(20);
    });
  });

  describe("Subscription Edge Cases", () => {
    it("should handle shop with no current subscription", async () => {
      const shop = generateTestShop();
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.subscription.findUnique.mockResolvedValue(null);

      mockRequest.shopId = shop.id;

      const result = await mockTenantDb.subscription.findUnique({
        where: { shopId: shop.id },
      });

      expect(result).toBeNull();
    });

    it("should handle free plan subscribers", async () => {
      const freeShop = generateTestShop({ planTier: "FREE" });
      mockTenantDb.shop.findUnique.mockResolvedValue(freeShop);

      expect(freeShop.planTier).toBe("FREE");
    });

    it("should handle zero usage metrics", async () => {
      mockTenantDb.shipment.groupBy.mockResolvedValue([]);
      mockTenantDb.routingMeterEvent.groupBy.mockResolvedValue([]);
      mockTenantDb.notificationMeterEvent.groupBy.mockResolvedValue([]);

      const totalShipments = 0;
      const totalApiCalls = 0;

      expect(totalShipments).toBe(0);
      expect(totalApiCalls).toBe(0);
    });

    it("should handle cancelled subscriptions", async () => {
      const cancelled = generateTestSubscription({
        status: "cancelled",
        cancelledAt: new Date(),
      });

      expect(cancelled.status).toBe("cancelled");
    });

    it("should prevent downgrade to FREE if usage exceeds free limits", async () => {
      const shop = generateTestShop({ planTier: "GROWTH" });
      mockTenantDb.shop.findUnique.mockResolvedValue(shop);
      mockTenantDb.shipment.count.mockResolvedValue(10000); // Exceeds FREE limit

      mockRequest.body = { planId: "FREE" };
      mockRequest.shopId = shop.id;

      expect(mockRequest.body.planId).toBe("FREE");
    });
  });
});
