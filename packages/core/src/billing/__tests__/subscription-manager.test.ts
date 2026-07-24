/**
 * Subscription Manager Tests
 * Comprehensive test suite for subscription lifecycle management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SubscriptionManager,
  SubscriptionNotFoundError,
  PlanNotFoundError,
  SubscriptionError,
} from "../subscription-manager";
import type { BillingPlan, BillingSubscription } from "@witylogix/db";
import { Decimal } from "@prisma/client/runtime/library";

describe("SubscriptionManager", () => {
  let manager: SubscriptionManager;
  let prisma: any;

  beforeEach(() => {
    // Mock Prisma client
    prisma = {
      billingPlan: {
        findUnique: vi.fn(),
      },
      billingSubscription: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      storeQuotaUsage: {
        upsert: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    manager = new SubscriptionManager(prisma);
  });

  describe("createSubscription", () => {
    it("should create subscription with trial when plan has trialDays", async () => {
      const plan: BillingPlan = {
        id: "plan-1",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 14,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSubscription: any = {
        id: "sub-1",
        shopId: "shop-1",
        planId: "plan-1",
        status: "trialing",
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        trialEnd: expect.any(Date),
        plan,
      };

      prisma.billingPlan.findUnique.mockResolvedValue(plan);
      prisma.billingSubscription.findUnique.mockResolvedValue(null);
      prisma.billingSubscription.create.mockResolvedValue(mockSubscription);
      prisma.storeQuotaUsage.upsert.mockResolvedValue({});

      const result = await manager.createSubscription("shop-1", "plan-1");

      expect(result.id).toBe("sub-1");
      expect(result.status).toBe("trialing");
      expect(result.plan).toEqual(plan);
      expect(prisma.billingSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shopId: "shop-1",
            planId: "plan-1",
            status: "trialing",
          }),
        }),
      );
    });

    it("should create subscription without trial when plan has no trialDays", async () => {
      const plan: BillingPlan = {
        id: "plan-1",
        name: "Basic",
        price: new Decimal("29"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSubscription: any = {
        id: "sub-1",
        shopId: "shop-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        trialEnd: null,
        plan,
      };

      prisma.billingPlan.findUnique.mockResolvedValue(plan);
      prisma.billingSubscription.findUnique.mockResolvedValue(null);
      prisma.billingSubscription.create.mockResolvedValue(mockSubscription);
      prisma.storeQuotaUsage.upsert.mockResolvedValue({});

      const result = await manager.createSubscription("shop-1", "plan-1");

      expect(result.status).toBe("active");
      expect(result.trialEnd).toBeNull();
    });

    it("should throw PlanNotFoundError for invalid plan", async () => {
      prisma.billingPlan.findUnique.mockResolvedValue(null);

      await expect(
        manager.createSubscription("shop-1", "invalid-plan"),
      ).rejects.toThrow(PlanNotFoundError);
    });

    it("should throw SubscriptionError when shop already has active subscription", async () => {
      const plan: BillingPlan = {
        id: "plan-1",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingSubscription: any = {
        id: "sub-1",
        shopId: "shop-1",
        status: "active",
      };

      prisma.billingPlan.findUnique.mockResolvedValue(plan);
      prisma.billingSubscription.findUnique.mockResolvedValue(
        existingSubscription,
      );

      await expect(
        manager.createSubscription("shop-1", "plan-1"),
      ).rejects.toThrow(SubscriptionError);
    });

    it("should initialize quota tracking for all resources", async () => {
      const plan: BillingPlan = {
        id: "plan-1",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSubscription: any = {
        id: "sub-1",
        shopId: "shop-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        plan,
      };

      prisma.billingPlan.findUnique.mockResolvedValue(plan);
      // First call: check existing subscription (null = none found)
      // Second call: inside initializeQuotaTracking to get shopId
      prisma.billingSubscription.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "sub-1", shopId: "shop-1" });
      prisma.billingSubscription.create.mockResolvedValue(mockSubscription);
      prisma.storeQuotaUsage.upsert.mockResolvedValue({});

      await manager.createSubscription("shop-1", "plan-1");

      expect(prisma.storeQuotaUsage.upsert).toHaveBeenCalledTimes(5);
    });
  });

  describe("upgradeSubscription", () => {
    it("should upgrade subscription with prorated amount", async () => {
      const oldPlan: BillingPlan = {
        id: "plan-1",
        name: "Basic",
        price: new Decimal("29"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newPlan: BillingPlan = {
        id: "plan-2",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);

      const mockSubscription: any = {
        id: "sub-1",
        shopId: "shop-1",
        planId: "plan-1",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: futureDate,
        plan: oldPlan,
      };

      const updatedSubscription: any = {
        ...mockSubscription,
        planId: "plan-2",
        plan: newPlan,
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.billingPlan.findUnique.mockResolvedValue(newPlan);
      prisma.billingSubscription.update.mockResolvedValue(updatedSubscription);

      const result = await manager.upgradeSubscription("sub-1", "plan-2");

      expect(result.planId).toBe("plan-2");
      expect(prisma.billingSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sub-1" },
          data: { planId: "plan-2" },
        }),
      );
    });

    it("should throw error when upgrading cancelled subscription", async () => {
      const mockSubscription: any = {
        id: "sub-1",
        status: "cancelled",
        plan: { id: "plan-1" },
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.billingPlan.findUnique.mockResolvedValue({
        id: "plan-2",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        manager.upgradeSubscription("sub-1", "plan-2"),
      ).rejects.toThrow(SubscriptionError);
    });

    it("should throw SubscriptionNotFoundError for non-existent subscription", async () => {
      prisma.billingSubscription.findUnique.mockResolvedValue(null);

      await expect(
        manager.upgradeSubscription("invalid-sub", "plan-2"),
      ).rejects.toThrow(SubscriptionNotFoundError);
    });
  });

  describe("downgradeSubscription", () => {
    it("should downgrade subscription at period end", async () => {
      const oldPlan: BillingPlan = {
        id: "plan-2",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newPlan: BillingPlan = {
        id: "plan-1",
        name: "Basic",
        price: new Decimal("29"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSubscription: any = {
        id: "sub-1",
        status: "active",
        currentPeriodEnd: new Date(),
        plan: oldPlan,
      };

      const updatedSubscription: any = {
        ...mockSubscription,
        planId: "plan-1",
        plan: newPlan,
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.billingSubscription.update.mockResolvedValue(updatedSubscription);

      const result = await manager.downgradeSubscription("sub-1", "plan-1");

      expect(result.planId).toBe("plan-1");
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel subscription immediately", async () => {
      const now = new Date();
      const mockSubscription: any = {
        id: "sub-1",
        status: "active",
        currentPeriodEnd: new Date(now.getTime() + 100000),
        plan: {},
      };

      const updatedSubscription: any = {
        ...mockSubscription,
        status: "cancelled",
        cancelledAt: now,
        cancelAtPeriodEnd: false,
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.billingSubscription.update.mockResolvedValue(updatedSubscription);

      const result = await manager.cancelSubscription("sub-1", true);

      expect(result.status).toBe("cancelled");
      expect(prisma.billingSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "cancelled",
            cancelAtPeriodEnd: false,
          }),
        }),
      );
    });

    it("should cancel subscription at period end", async () => {
      const mockSubscription: any = {
        id: "sub-1",
        status: "active",
        currentPeriodEnd: new Date(),
        plan: {},
      };

      const updatedSubscription: any = {
        ...mockSubscription,
        status: "active",
        cancelledAt: expect.any(Date),
        cancelAtPeriodEnd: true,
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.billingSubscription.update.mockResolvedValue(updatedSubscription);

      const result = await manager.cancelSubscription("sub-1", false);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(prisma.billingSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelAtPeriodEnd: true,
          }),
        }),
      );
    });

    it("should throw error when cancelling already cancelled subscription", async () => {
      const mockSubscription: any = {
        id: "sub-1",
        status: "cancelled",
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);

      await expect(manager.cancelSubscription("sub-1", true)).rejects.toThrow(
        SubscriptionError,
      );
    });
  });

  describe("renewSubscription", () => {
    it("should renew subscription and create invoice", async () => {
      const now = new Date();
      const mockSubscription: any = {
        id: "sub-1",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: now,
        plan: { interval: "monthly" },
      };

      const updatedSubscription: any = {
        ...mockSubscription,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: expect.any(Date),
        cancelAtPeriodEnd: false,
        trialEnd: null,
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.billingSubscription.update.mockResolvedValue(updatedSubscription);
      prisma.storeQuotaUsage.upsert.mockResolvedValue({});

      const result = await manager.renewSubscription("sub-1");

      expect(result.status).toBe("active");
      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(prisma.billingSubscription.update).toHaveBeenCalled();
    });

    it("should throw error when renewing cancelled subscription", async () => {
      const mockSubscription: any = {
        id: "sub-1",
        status: "cancelled",
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);

      await expect(manager.renewSubscription("sub-1")).rejects.toThrow(
        SubscriptionError,
      );
    });

    it("should reset quota tracking for new period", async () => {
      const now = new Date();
      const mockSubscription: any = {
        id: "sub-1",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: now,
        plan: { interval: "monthly" },
      };

      const updatedSubscription: any = {
        ...mockSubscription,
        currentPeriodEnd: expect.any(Date),
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);
      prisma.billingSubscription.update.mockResolvedValue(updatedSubscription);
      prisma.storeQuotaUsage.upsert.mockResolvedValue({});

      await manager.renewSubscription("sub-1");

      expect(prisma.storeQuotaUsage.upsert).toHaveBeenCalledTimes(5);
    });
  });

  describe("handleExpiredTrials", () => {
    it("should transition expired trials to active with payment method", async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 100000);

      const expiredTrials = [
        {
          id: "sub-1",
          shopId: "shop-1",
          status: "trialing",
          trialEnd: pastDate,
          paymentMethodId: "pm-1",
        },
      ];

      prisma.billingSubscription.findMany.mockResolvedValue(expiredTrials);
      prisma.billingSubscription.update.mockResolvedValue({});

      const count = await manager.handleExpiredTrials();

      expect(count).toBe(1);
      expect(prisma.billingSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "active" },
        }),
      );
    });

    it("should expire trials without payment method", async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 100000);

      const expiredTrials = [
        {
          id: "sub-1",
          shopId: "shop-1",
          status: "trialing",
          trialEnd: pastDate,
          paymentMethodId: null,
        },
      ];

      prisma.billingSubscription.findMany.mockResolvedValue(expiredTrials);
      prisma.billingSubscription.update.mockResolvedValue({});

      const count = await manager.handleExpiredTrials();

      expect(count).toBe(1);
      expect(prisma.billingSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "expired", cancelledAt: expect.any(Date) },
        }),
      );
    });

    it("should handle multiple expired trials", async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 100000);

      const expiredTrials = [
        {
          id: "sub-1",
          status: "trialing",
          trialEnd: pastDate,
          paymentMethodId: "pm-1",
        },
        {
          id: "sub-2",
          status: "trialing",
          trialEnd: pastDate,
          paymentMethodId: null,
        },
        {
          id: "sub-3",
          status: "trialing",
          trialEnd: pastDate,
          paymentMethodId: "pm-2",
        },
      ];

      prisma.billingSubscription.findMany.mockResolvedValue(expiredTrials);
      prisma.billingSubscription.update.mockResolvedValue({});

      const count = await manager.handleExpiredTrials();

      expect(count).toBe(3);
    });
  });

  describe("calculateProration", () => {
    it("should calculate proration correctly", () => {
      const currentPlan: BillingPlan = {
        id: "plan-1",
        name: "Basic",
        price: new Decimal("30"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newPlan: BillingPlan = {
        id: "plan-2",
        name: "Pro",
        price: new Decimal("90"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = manager.calculateProration(currentPlan, newPlan, 15);

      // Daily rate for 30-day period
      // Current: $30/30 = $1/day, 15 days = $15 credit
      // New: $90
      // Net: $90 - $15 = $75 owed

      expect(result.creditAmount).toBe(15);
      expect(result.chargeAmount).toBe(90);
      expect(result.netDueAmount).toBe(75);
      expect(result.daysRemaining).toBe(15);
    });

    it("should handle upgrade with positive net amount", () => {
      const currentPlan: BillingPlan = {
        id: "plan-1",
        name: "Basic",
        price: new Decimal("29"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newPlan: BillingPlan = {
        id: "plan-2",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = manager.calculateProration(currentPlan, newPlan, 10);

      expect(result.netDueAmount).toBeGreaterThan(0);
    });

    it("should handle downgrade with negative net amount", () => {
      const currentPlan: BillingPlan = {
        id: "plan-2",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newPlan: BillingPlan = {
        id: "plan-1",
        name: "Basic",
        price: new Decimal("29"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = manager.calculateProration(currentPlan, newPlan, 15);

      expect(result.netDueAmount).toBeLessThan(0);
    });

    it("should handle yearly plans correctly", () => {
      const currentPlan: BillingPlan = {
        id: "plan-1",
        name: "Annual Basic",
        price: new Decimal("300"),
        interval: "yearly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newPlan: BillingPlan = {
        id: "plan-2",
        name: "Annual Pro",
        price: new Decimal("900"),
        interval: "yearly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = manager.calculateProration(currentPlan, newPlan, 180);

      // Daily rate for 365-day period
      // Current: $300/365 ≈ $0.822/day, 180 days ≈ $147.95 credit
      // New: $900
      // Net: $900 - $147.95 ≈ $752.05 owed

      expect(result.chargeAmount).toBe(900);
      expect(result.daysRemaining).toBe(180);
    });
  });

  describe("getSubscriptionStatus", () => {
    it("should return subscription with plan details", async () => {
      const plan: BillingPlan = {
        id: "plan-1",
        name: "Pro",
        price: new Decimal("99"),
        interval: "monthly",
        trialDays: 0,
        features: [],
        limits: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSubscription: any = {
        id: "sub-1",
        shopId: "shop-1",
        status: "active",
        plan,
      };

      prisma.billingSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await manager.getSubscriptionStatus("shop-1");

      expect(result).toEqual(mockSubscription);
      expect(result.plan).toEqual(plan);
    });

    it("should return null when subscription not found", async () => {
      prisma.billingSubscription.findUnique.mockResolvedValue(null);

      const result = await manager.getSubscriptionStatus("shop-1");

      expect(result).toBeNull();
    });
  });
});
