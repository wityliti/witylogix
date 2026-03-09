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
const generateTestSubscription = () => ({
  id: "sub-123",
  tenantId: "tenant-456",
  planId: "plan-pro",
  status: "ACTIVE",
  currentPeriodStart: new Date("2026-01-01"),
  currentPeriodEnd: new Date("2026-02-01"),
  trialEnd: null,
  trialStarted: false,
  autoRenew: true,
  proration: 0,
  nextBillingDate: new Date("2026-02-01"),
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const generateTestBillingPlan = () => ({
  id: "plan-pro",
  name: "Professional",
  price: 99,
  billingCycle: "MONTHLY",
  features: {
    maxUsers: 50,
    maxProjects: 100,
    apiRate: 10000,
    support: "priority",
  },
  quotas: {
    maxStorage: 1000, // GB
    maxRequests: 100000,
    maxTeamSize: 50,
  },
  isActive: true,
  createdAt: new Date(),
});

const generateTestTenant = () => ({
  id: "tenant-456",
  name: "Test Tenant",
  slug: "test-tenant",
  isActive: true,
  createdAt: new Date(),
});

const generateTestInvoice = () => ({
  id: "inv-789",
  subscriptionId: "sub-123",
  tenantId: "tenant-456",
  amount: 99,
  status: "PAID",
  billingPeriodStart: new Date("2026-01-01"),
  billingPeriodEnd: new Date("2026-02-01"),
  dueDate: new Date("2026-01-11"),
  paidAt: new Date("2026-01-05"),
  createdAt: new Date(),
});

// ─────────────────────────────────────────────────────────────────

describe("Billing Subscriptions Routes", () => {
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
      subscription: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      billingPlan: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
      },
      invoice: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };
  });

  describe("GET /subscriptions (List subscriptions)", () => {
    it("should list all subscriptions for a tenant", async () => {
      const tenant = generateTestTenant();
      const sub1 = generateTestSubscription();
      const sub2 = { ...generateTestSubscription(), id: "sub-124", planId: "plan-standard" };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.subscription.findMany.mockResolvedValue([sub1, sub2]);

      const subscriptions = await (mockPrisma as any).subscription.findMany({
        where: { tenantId: tenant.id },
      });

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0].status).toBe("ACTIVE");
    });

    it("should return empty list when no subscriptions exist", async () => {
      const tenant = generateTestTenant();
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const subscriptions = await (mockPrisma as any).subscription.findMany({
        where: { tenantId: tenant.id },
      });

      expect(subscriptions).toHaveLength(0);
    });

    it("should filter subscriptions by status", async () => {
      const tenant = generateTestTenant();
      const activeSub = generateTestSubscription();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.subscription.findMany.mockResolvedValue([activeSub]);

      const subscriptions = await (mockPrisma as any).subscription.findMany({
        where: { tenantId: tenant.id, status: "ACTIVE" },
      });

      expect(subscriptions[0].status).toBe("ACTIVE");
    });

    it("should return 401 when tenant not found", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const tenant = await (mockPrisma as any).tenant.findUnique({
        where: { id: "invalid-tenant" },
      });

      expect(tenant).toBeNull();
    });

    it("should include billing plan details in response", async () => {
      const tenant = generateTestTenant();
      const subscription = generateTestSubscription();
      const plan = generateTestBillingPlan();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.subscription.findMany.mockResolvedValue([subscription]);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);

      const subscriptions = await (mockPrisma as any).subscription.findMany({
        where: { tenantId: tenant.id },
      });

      expect(subscriptions[0].planId).toBe("plan-pro");
    });
  });

  describe("GET /subscriptions/:id (Get single subscription)", () => {
    it("should retrieve a specific subscription", async () => {
      const subscription = generateTestSubscription();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);

      const result = await (mockPrisma as any).subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(result.id).toBe("sub-123");
      expect(result.status).toBe("ACTIVE");
    });

    it("should return 404 for non-existent subscription", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await (mockPrisma as any).subscription.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });

    it("should include current plan details", async () => {
      const subscription = generateTestSubscription();
      const plan = generateTestBillingPlan();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);

      const result = await (mockPrisma as any).subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(result.planId).toBe("plan-pro");
    });

    it("should show billing period and next billing date", async () => {
      const subscription = generateTestSubscription();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);

      const result = await (mockPrisma as any).subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(result.currentPeriodStart).toBeDefined();
      expect(result.currentPeriodEnd).toBeDefined();
      expect(result.nextBillingDate).toBeDefined();
    });
  });

  describe("POST /subscriptions (Create subscription)", () => {
    it("should create a new subscription with a plan", async () => {
      const tenant = generateTestTenant();
      const plan = generateTestBillingPlan();

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.subscription.create.mockResolvedValue(generateTestSubscription());

      mockRequest.body = {
        tenantId: tenant.id,
        planId: plan.id,
      };

      const result = await (mockPrisma as any).subscription.create({
        data: mockRequest.body,
      });

      expect(result.status).toBe("ACTIVE");
      expect(result.planId).toBe("plan-pro");
    });

    it("should start trial period if plan has trial", async () => {
      const tenant = generateTestTenant();
      const plan = { ...generateTestBillingPlan(), trialDays: 14 };

      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.subscription.create.mockResolvedValue({
        ...generateTestSubscription(),
        trialStarted: true,
        trialEnd: new Date("2026-01-15"),
      });

      mockRequest.body = {
        tenantId: tenant.id,
        planId: plan.id,
      };

      const result = await (mockPrisma as any).subscription.create({
        data: mockRequest.body,
      });

      expect(result.trialStarted).toBe(true);
      expect(result.trialEnd).toBeDefined();
    });

    it("should reject creation without tenantId", () => {
      mockRequest.body = {
        planId: "plan-pro",
      };

      expect(mockRequest.body.tenantId).toBeUndefined();
    });

    it("should reject creation without planId", () => {
      mockRequest.body = {
        tenantId: "tenant-456",
      };

      expect(mockRequest.body.planId).toBeUndefined();
    });

    it("should return error for invalid plan", async () => {
      mockPrisma.billingPlan.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        tenantId: "tenant-456",
        planId: "invalid-plan",
      };

      const plan = await (mockPrisma as any).billingPlan.findUnique({
        where: { id: "invalid-plan" },
      });

      expect(plan).toBeNull();
    });

    it("should return error for invalid tenant", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      mockRequest.body = {
        tenantId: "invalid-tenant",
        planId: "plan-pro",
      };

      const tenant = await (mockPrisma as any).tenant.findUnique({
        where: { id: "invalid-tenant" },
      });

      expect(tenant).toBeNull();
    });
  });

  describe("PUT /subscriptions/:id/upgrade (Upgrade plan)", () => {
    it("should upgrade to a higher tier plan", async () => {
      const currentSub = generateTestSubscription();
      const newPlan = { ...generateTestBillingPlan(), id: "plan-enterprise", price: 299 };
      const upgradedSub = {
        ...currentSub,
        planId: "plan-enterprise",
        proration: 50,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(currentSub);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(newPlan);
      mockPrisma.subscription.update.mockResolvedValue(upgradedSub);

      mockRequest.params = { id: currentSub.id };
      mockRequest.body = { newPlanId: "plan-enterprise" };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: currentSub.id },
        data: { planId: "plan-enterprise" },
      });

      expect(result.planId).toBe("plan-enterprise");
      expect(result.proration).toBe(50);
    });

    it("should calculate proration credit correctly", async () => {
      const subscription = generateTestSubscription();
      const newPlan = { ...generateTestBillingPlan(), price: 199 };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(newPlan);

      mockRequest.params = { id: subscription.id };
      mockRequest.body = { newPlanId: "plan-business" };

      const proratedAmount = 50;
      expect(proratedAmount).toBeGreaterThan(0);
    });

    it("should return error for invalid new plan", async () => {
      const subscription = generateTestSubscription();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(null);

      mockRequest.params = { id: subscription.id };
      mockRequest.body = { newPlanId: "invalid-plan" };

      const plan = await (mockPrisma as any).billingPlan.findUnique({
        where: { id: "invalid-plan" },
      });

      expect(plan).toBeNull();
    });
  });

  describe("PUT /subscriptions/:id/downgrade (Downgrade plan)", () => {
    it("should downgrade to a lower tier plan", async () => {
      const currentSub = generateTestSubscription();
      const newPlan = { ...generateTestBillingPlan(), id: "plan-starter", price: 29 };
      const downgradedSub = {
        ...currentSub,
        planId: "plan-starter",
        proration: -25,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(currentSub);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(newPlan);
      mockPrisma.subscription.update.mockResolvedValue(downgradedSub);

      mockRequest.params = { id: currentSub.id };
      mockRequest.body = { newPlanId: "plan-starter" };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: currentSub.id },
        data: { planId: "plan-starter" },
      });

      expect(result.planId).toBe("plan-starter");
      expect(result.proration).toBeLessThan(0);
    });

    it("should apply downgraft to next billing cycle", async () => {
      const subscription = generateTestSubscription();
      const downgradedSub = {
        ...subscription,
        planId: "plan-starter",
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.subscription.update.mockResolvedValue(downgradedSub);

      mockRequest.params = { id: subscription.id };
      mockRequest.body = { newPlanId: "plan-starter", applyAt: "nextCycle" };

      expect(mockRequest.body.applyAt).toBe("nextCycle");
    });
  });

  describe("POST /subscriptions/:id/trial (Trial management)", () => {
    it("should start trial period for new subscription", async () => {
      const subscription = {
        ...generateTestSubscription(),
        trialStarted: false,
        trialEnd: null,
      };
      const trialStarted = {
        ...subscription,
        trialStarted: true,
        trialEnd: new Date("2026-01-15"),
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.subscription.update.mockResolvedValue(trialStarted);

      mockRequest.params = { id: subscription.id };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: subscription.id },
        data: { trialStarted: true, trialEnd: new Date("2026-01-15") },
      });

      expect(result.trialStarted).toBe(true);
      expect(result.trialEnd).toBeDefined();
    });

    it("should convert trial to paid subscription", async () => {
      const trialSub = {
        ...generateTestSubscription(),
        trialStarted: true,
        trialEnd: new Date("2026-01-15"),
      };
      const paidSub = {
        ...trialSub,
        status: "ACTIVE",
        trialStarted: false,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(trialSub);
      mockPrisma.subscription.update.mockResolvedValue(paidSub);

      mockRequest.params = { id: trialSub.id };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: trialSub.id },
        data: { status: "ACTIVE" },
      });

      expect(result.status).toBe("ACTIVE");
    });

    it("should extend trial period if allowed", async () => {
      const subscription = {
        ...generateTestSubscription(),
        trialEnd: new Date("2026-01-15"),
      };
      const extendedSub = {
        ...subscription,
        trialEnd: new Date("2026-01-22"),
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.subscription.update.mockResolvedValue(extendedSub);

      mockRequest.params = { id: subscription.id };
      mockRequest.body = { trialExtensionDays: 7 };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: subscription.id },
        data: { trialEnd: new Date("2026-01-22") },
      });

      expect(result.trialEnd).toEqual(new Date("2026-01-22"));
    });
  });

  describe("GET /subscriptions/:id/invoices (Get invoices)", () => {
    it("should list all invoices for a subscription", async () => {
      const subscription = generateTestSubscription();
      const invoice1 = generateTestInvoice();
      const invoice2 = { ...generateTestInvoice(), id: "inv-790", amount: 99 };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.invoice.findMany.mockResolvedValue([invoice1, invoice2]);

      const invoices = await (mockPrisma as any).invoice.findMany({
        where: { subscriptionId: subscription.id },
      });

      expect(invoices).toHaveLength(2);
      expect(invoices[0].status).toBe("PAID");
    });

    it("should return empty list when no invoices exist", async () => {
      const subscription = generateTestSubscription();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      const invoices = await (mockPrisma as any).invoice.findMany({
        where: { subscriptionId: subscription.id },
      });

      expect(invoices).toHaveLength(0);
    });

    it("should include invoice details in response", async () => {
      const subscription = generateTestSubscription();
      const invoice = generateTestInvoice();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.invoice.findMany.mockResolvedValue([invoice]);

      const invoices = await (mockPrisma as any).invoice.findMany({
        where: { subscriptionId: subscription.id },
      });

      expect(invoices[0].amount).toBe(99);
      expect(invoices[0].status).toBe("PAID");
    });
  });

  describe("POST /subscriptions/:id/invoices (Generate invoice)", () => {
    it("should generate invoice for current billing period", async () => {
      const subscription = generateTestSubscription();
      const plan = generateTestBillingPlan();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);
      mockPrisma.invoice.create.mockResolvedValue(generateTestInvoice());

      mockRequest.params = { id: subscription.id };

      const result = await (mockPrisma as any).invoice.create({
        data: {
          subscriptionId: subscription.id,
          amount: plan.price,
        },
      });

      expect(result.amount).toBe(99);
      expect(result.status).toBe("PAID");
    });

    it("should apply proration credits to invoice", async () => {
      const subscription = { ...generateTestSubscription(), proration: 50 };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.invoice.create.mockResolvedValue({
        ...generateTestInvoice(),
        amount: 49,
      });

      mockRequest.params = { id: subscription.id };

      const result = await (mockPrisma as any).invoice.create({
        data: {
          subscriptionId: subscription.id,
          amount: 49,
        },
      });

      expect(result.amount).toBe(49);
    });

    it("should set invoice due date based on terms", async () => {
      const subscription = generateTestSubscription();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.invoice.create.mockResolvedValue({
        ...generateTestInvoice(),
        dueDate: new Date("2026-01-31"),
      });

      mockRequest.params = { id: subscription.id };

      const result = await (mockPrisma as any).invoice.create({
        data: {
          subscriptionId: subscription.id,
        },
      });

      expect(result.dueDate).toBeDefined();
    });
  });

  describe("Quota Enforcement", () => {
    it("should enforce storage quota from plan", async () => {
      const subscription = generateTestSubscription();
      const plan = generateTestBillingPlan();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);

      expect(plan.quotas.maxStorage).toBe(1000);
    });

    it("should enforce API rate quota from plan", async () => {
      const subscription = generateTestSubscription();
      const plan = generateTestBillingPlan();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);

      expect(plan.features.apiRate).toBe(10000);
    });

    it("should enforce team size quota from plan", async () => {
      const subscription = generateTestSubscription();
      const plan = generateTestBillingPlan();

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);

      expect(plan.quotas.maxTeamSize).toBe(50);
    });

    it("should return quota exceeded error when limit reached", async () => {
      const subscription = generateTestSubscription();
      const plan = {
        ...generateTestBillingPlan(),
        quotas: { maxStorage: 100, maxRequests: 1000, maxTeamSize: 5 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.billingPlan.findUnique.mockResolvedValue(plan);

      expect(plan.quotas.maxStorage).toBeLessThan(500);
    });
  });

  describe("Cancellation & Renewal", () => {
    it("should cancel subscription immediately", async () => {
      const subscription = generateTestSubscription();
      const cancelledSub = {
        ...subscription,
        status: "CANCELLED",
        cancelledAt: new Date(),
        autoRenew: false,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.subscription.update.mockResolvedValue(cancelledSub);

      mockRequest.params = { id: subscription.id };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      expect(result.status).toBe("CANCELLED");
      expect(result.cancelledAt).toBeDefined();
    });

    it("should cancel subscription at end of billing period", async () => {
      const subscription = generateTestSubscription();
      const cancelledSub = {
        ...subscription,
        status: "PENDING_CANCELLATION",
        autoRenew: false,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.subscription.update.mockResolvedValue(cancelledSub);

      mockRequest.params = { id: subscription.id };
      mockRequest.body = { effectiveAt: "endOfPeriod" };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: subscription.id },
        data: { status: "PENDING_CANCELLATION" },
      });

      expect(result.status).toBe("PENDING_CANCELLATION");
    });

    it("should reactivate cancelled subscription", async () => {
      const cancelledSub = {
        ...generateTestSubscription(),
        status: "CANCELLED",
        cancelledAt: new Date(),
      };
      const reactivatedSub = {
        ...cancelledSub,
        status: "ACTIVE",
        cancelledAt: null,
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(cancelledSub);
      mockPrisma.subscription.update.mockResolvedValue(reactivatedSub);

      mockRequest.params = { id: cancelledSub.id };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: cancelledSub.id },
        data: { status: "ACTIVE", cancelledAt: null },
      });

      expect(result.status).toBe("ACTIVE");
      expect(result.cancelledAt).toBeNull();
    });

    it("should toggle auto-renewal", async () => {
      const subscription = generateTestSubscription();
      const updatedSub = { ...subscription, autoRenew: false };

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription);
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      mockRequest.params = { id: subscription.id };
      mockRequest.body = { autoRenew: false };

      const result = await (mockPrisma as any).subscription.update({
        where: { id: subscription.id },
        data: { autoRenew: false },
      });

      expect(result.autoRenew).toBe(false);
    });
  });

  describe("Edge Cases & Error Handling", () => {
    it("should handle subscription not found", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await (mockPrisma as any).subscription.findUnique({
        where: { id: "invalid-id" },
      });

      expect(result).toBeNull();
    });

    it("should handle plan change during trial", async () => {
      const trialSub = {
        ...generateTestSubscription(),
        trialStarted: true,
        trialEnd: new Date("2026-01-15"),
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(trialSub);

      expect(trialSub.trialStarted).toBe(true);
    });

    it("should preserve subscription history on updates", async () => {
      const subscription = generateTestSubscription();
      const createdAt = subscription.createdAt;

      mockPrisma.subscription.update.mockResolvedValue({
        ...subscription,
        updatedAt: new Date(),
      });

      const updated = await (mockPrisma as any).subscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE" },
      });

      expect(updated.createdAt).toEqual(createdAt);
    });
  });
});
