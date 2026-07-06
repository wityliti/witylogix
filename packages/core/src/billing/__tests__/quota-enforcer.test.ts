/**
 * Quota Enforcer Tests
 * Comprehensive test suite for quota tracking and enforcement
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  QuotaEnforcer,
  QuotaExceededError,
  SubscriptionNotFoundError,
  WARNING_THRESHOLD,
  HARD_LIMIT,
} from "../quota-enforcer";
import type { BillingSubscription } from "@witylogix/db";

describe("QuotaEnforcer", () => {
  let enforcer: QuotaEnforcer;
  let prisma: any;

  beforeEach(() => {
    // Mock Prisma client
    prisma = {
      billingSubscription: {
        findUnique: vi.fn(),
      },
      storeQuotaUsage: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    enforcer = new QuotaEnforcer(prisma);
  });

  describe("checkQuota", () => {
    it("should return allowed when under limit", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 30,
      });

      const result = await enforcer.checkQuota("shop-1", "orders");

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(30);
      expect(result.limit).toBe(100);
      expect(result.percentage).toBe(30);
      expect(result.isWarning).toBe(false);
      expect(result.isExceeded).toBe(false);
    });

    it("should return warning when above 80% threshold", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 85,
      });

      const result = await enforcer.checkQuota("shop-1", "orders");

      expect(result.allowed).toBe(true);
      expect(result.isWarning).toBe(true);
      expect(result.isExceeded).toBe(false);
      expect(result.percentage).toBeGreaterThanOrEqual(80);
    });

    it("should return exceeded when at 100%", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 100,
      });

      const result = await enforcer.checkQuota("shop-1", "orders");

      expect(result.allowed).toBe(false);
      expect(result.isExceeded).toBe(true);
      expect(result.percentage).toBe(100);
    });

    it("should handle unlimited resources", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: null,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });

      const result = await enforcer.checkQuota("shop-1", "orders");

      expect(result.allowed).toBe(true);
      expect(result.isExceeded).toBe(false);
      expect(result.limit).toBe(Infinity);
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage atomically", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst
        .mockResolvedValueOnce({ currentUsage: 30 })
        .mockResolvedValueOnce({ currentUsage: 31 });
      prisma.storeQuotaUsage.updateMany.mockResolvedValue({ count: 1 });

      const result = await enforcer.incrementUsage("shop-1", "orders", 1);

      expect(result).toBe(31);
      expect(prisma.storeQuotaUsage.updateMany).toHaveBeenCalled();
    });

    it("should throw QuotaExceededError when incrementing past limit", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 100,
      });

      await expect(
        enforcer.incrementUsage("shop-1", "orders", 1),
      ).rejects.toThrow(QuotaExceededError);
    });

    it("should allow unlimited resource increment", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: null,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 999999,
      });
      prisma.storeQuotaUsage.updateMany.mockResolvedValue({ count: 1 });

      const result = await enforcer.incrementUsage("shop-1", "orders", 1);

      expect(result).toBe(999999);
    });
  });

  describe("resetMonthlyUsage", () => {
    it("should reset monthly usage correctly", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.storeQuotaUsage.updateMany.mockResolvedValue({ count: 5 });

      await enforcer.resetMonthlyUsage("shop-1");

      expect(prisma.storeQuotaUsage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { subscriptionId: "sub-1" },
          data: {
            currentUsage: 0,
            periodStart: expect.any(Date),
            periodEnd: expect.any(Date),
          },
        }),
      );
    });

    it("should throw SubscriptionNotFoundError for invalid shop", async () => {
      prisma.billingSubscription.findUnique.mockResolvedValue(null);

      await expect(enforcer.resetMonthlyUsage("invalid-shop")).rejects.toThrow(
        SubscriptionNotFoundError,
      );
    });
  });

  describe("getUsageSummary", () => {
    it("should return complete usage summary", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 25,
      });

      const result = await enforcer.getUsageSummary("shop-1");

      expect(result).toHaveProperty("orders");
      expect(result).toHaveProperty("shipments");
      expect(result).toHaveProperty("api_calls");
      expect(result).toHaveProperty("storage");
      expect(result).toHaveProperty("drivers");
      expect(result.orders.current).toBe(25);
    });
  });

  describe("enforceQuotaMiddleware", () => {
    it("should allow request when under quota", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 30,
      });

      const request: any = { shopId: "shop-1" };
      const reply: any = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      const middleware = enforcer.enforceQuotaMiddleware(["orders"]);
      await middleware(request, reply);

      expect(reply.code).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it("should block request when quota exceeded", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 100,
      });

      const request: any = { shopId: "shop-1" };
      const reply: any = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      const middleware = enforcer.enforceQuotaMiddleware(["orders"]);
      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(429);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Quota exceeded",
        }),
      );
    });

    it("should return 401 when no shop context", async () => {
      const request: any = {};
      const reply: any = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      const middleware = enforcer.enforceQuotaMiddleware(["orders"]);
      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Unauthorized"),
        }),
      );
    });

    it("should return 402 when subscription not found", async () => {
      prisma.billingSubscription.findUnique.mockResolvedValue(null);

      const request: any = { shopId: "shop-1" };
      const reply: any = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      const middleware = enforcer.enforceQuotaMiddleware(["orders"]);
      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(402);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Payment Required"),
        }),
      );
    });

    it("should check multiple resources", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue({
        currentUsage: 30,
      });

      const request: any = { shopId: "shop-1" };
      const reply: any = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      const middleware = enforcer.enforceQuotaMiddleware([
        "orders",
        "shipments",
      ]);
      await middleware(request, reply);

      expect(reply.code).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle missing subscription gracefully", async () => {
      prisma.billingSubscription.findUnique.mockResolvedValue(null);

      await expect(enforcer.checkQuota("shop-1", "orders")).rejects.toThrow(
        SubscriptionNotFoundError,
      );
    });

    it("should handle cancelled subscription", async () => {
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "cancelled",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        trialEnd: null,
        cancelledAt: new Date(),
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);

      await expect(enforcer.checkQuota("shop-1", "orders")).rejects.toThrow(
        SubscriptionNotFoundError,
      );
    });

    it("should handle zero usage", async () => {
      const now = new Date();
      const mockSubscription: BillingSubscription = {
        id: "sub-1",
        shopId: "shop-1",
        userId: "user-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(now.getTime() - 10000),
        currentPeriodEnd: new Date(now.getTime() + 100000),
        trialEnd: null,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        paymentMethodId: "pm-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPlan: any = {
        limits: {
          orders: 100,
          shipments: 50,
          api_calls: 1000,
          storage: 1000,
          drivers: 10,
        },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      prisma.storeQuotaUsage.findFirst.mockResolvedValue(null);

      const result = await enforcer.checkQuota("shop-1", "orders");

      expect(result.current).toBe(0);
      expect(result.percentage).toBe(0);
    });
  });
});
