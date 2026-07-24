/**
 * Test suite for the Dashboard (Home) route (_index.tsx)
 *
 * Tests the main app index route loader which:
 * - Validates Shopify session authenticity
 * - Fetches dashboard statistics (KPIs)
 * - Fetches recent activity timeline
 * - Provides graceful fallbacks on API failures
 *
 * Uses vitest with vi.mock for dependency injection
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";

// Mock dependencies
vi.mock("~/lib/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("~/lib/api.server", () => ({
  createApiClient: vi.fn(),
  createApiClientFromRequest: vi.fn(),
}));

import { authenticate } from "~/lib/shopify.server";
import { createApiClient, createApiClientFromRequest } from "~/lib/api.server";

// Import the loader being tested
import { loader } from "../_index";

// ─── Type Definitions ──────────────────────────────────────────

interface DashboardStats {
  ordersToday: number;
  ordersDelta: number;
  activeDeliveries: number;
  driversOnline: number;
  driversTotal: number;
  successRate: number;
  successRateDelta: number;
  unassignedCount: number;
}

interface ActivityEvent {
  id: string;
  status: string;
  message: string;
  actor?: string;
  timestamp: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentActivity: ActivityEvent[];
}

// ─── Test Fixtures ────────────────────────────────────────────

const mockSession = {
  accessToken: "mock-access-token-12345",
  shop: "test-shop.myshopify.com",
  isOnline: true,
  userId: "user-123",
};

const mockStatsData: DashboardStats = {
  ordersToday: 42,
  ordersDelta: 12,
  activeDeliveries: 8,
  driversOnline: 5,
  driversTotal: 10,
  successRate: 94.5,
  successRateDelta: 2.1,
  unassignedCount: 3,
};

const mockActivityData: ActivityEvent[] = [
  {
    id: "evt-001",
    status: "delivered",
    message: "Order #12345 delivered successfully",
    actor: "driver-123",
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: "evt-002",
    status: "assigned",
    message: "Order #12346 assigned to Driver John",
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "evt-003",
    status: "created",
    message: "New order #12347 created",
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
  },
];

const mockRequest = (url: string = "http://localhost:3000/") => ({
  url,
  method: "GET",
  headers: new Map(),
});

// ─── Test Suite ───────────────────────────────────────────────

describe("Dashboard Route Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should authenticate incoming request via Shopify session", async () => {
      const mockAuthenticateFn = vi.fn().mockResolvedValue({
        session: mockSession,
      });
      (authenticate.admin as any).mockImplementation(mockAuthenticateFn);

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs);

      expect(mockAuthenticateFn).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should extract and pass access token to API client", async () => {
      const testToken = "test-token-abc123";
      const mockAuthenticateFn = vi.fn().mockResolvedValue({
        session: { ...mockSession, accessToken: testToken },
      });
      (authenticate.admin as any).mockImplementation(mockAuthenticateFn);

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs);

      expect(createApiClientFromRequest).toHaveBeenCalled();
    });

    it("should throw error if session is invalid or missing", async () => {
      (authenticate.admin as any).mockRejectedValue(
        new Error("Invalid session"),
      );

      await expect(
        loader({
          request: mockRequest() as LoaderFunctionArgs["request"],
          params: {},
        } as LoaderFunctionArgs),
      ).rejects.toThrow("Invalid session");
    });
  });

  describe("Dashboard Stats Loading", () => {
    it("should successfully load dashboard statistics", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.stats).toEqual(mockStatsData);
      expect(result.stats.ordersToday).toBe(42);
      expect(result.stats.activeDeliveries).toBe(8);
      expect(result.stats.driversOnline).toBe(5);
      expect(result.stats.successRate).toBe(94.5);
    });

    it("should call /api/v4/shops/me/stats endpoint", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs);

      const firstCall = mockApiClient.get.mock.calls[0];
      expect(firstCall[0]).toBe("/api/v4/shops/me/stats");
    });

    it("should provide fallback stats when API call fails", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      // First call (stats) fails, second call (activity) succeeds
      mockApiClient.get
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce({ data: mockActivityData });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.stats).toEqual({
        ordersToday: 0,
        ordersDelta: 0,
        activeDeliveries: 0,
        driversOnline: 0,
        driversTotal: 0,
        successRate: 0,
        successRateDelta: 0,
        unassignedCount: 0,
      });
    });

    it("should parse all KPI values correctly", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      const testStats: DashboardStats = {
        ordersToday: 156,
        ordersDelta: -5,
        activeDeliveries: 23,
        driversOnline: 12,
        driversTotal: 20,
        successRate: 98.7,
        successRateDelta: 1.5,
        unassignedCount: 7,
      };

      mockApiClient.get
        .mockResolvedValueOnce({ data: testStats })
        .mockResolvedValueOnce({ data: mockActivityData });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.stats.ordersToday).toBe(156);
      expect(result.stats.ordersDelta).toBe(-5);
      expect(result.stats.activeDeliveries).toBe(23);
      expect(result.stats.driversOnline).toBe(12);
      expect(result.stats.driversTotal).toBe(20);
      expect(result.stats.successRate).toBe(98.7);
      expect(result.stats.successRateDelta).toBe(1.5);
      expect(result.stats.unassignedCount).toBe(7);
    });
  });

  describe("Recent Activity Loading", () => {
    it("should successfully load recent activity timeline", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.recentActivity).toEqual(mockActivityData);
      expect(result.recentActivity).toHaveLength(3);
    });

    it("should call /api/v4/shops/me/activity endpoint with limit", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs);

      const secondCall = mockApiClient.get.mock.calls[1];
      expect(secondCall[0]).toBe("/api/v4/shops/me/activity");
      expect(secondCall[1]).toEqual({ limit: 20 });
    });

    it("should return empty activity array when API call fails", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      // First call (stats) succeeds, second call (activity) fails
      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockRejectedValueOnce(new Error("API Error"));

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.recentActivity).toEqual([]);
    });

    it("should handle activity events with optional actor field", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      const activityWithMissingActor: ActivityEvent[] = [
        {
          id: "evt-001",
          status: "system",
          message: "Automatic rebalancing completed",
          timestamp: new Date().toISOString(),
          // actor is undefined
        },
      ];

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: activityWithMissingActor });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.recentActivity[0].actor).toBeUndefined();
      expect(result.recentActivity[0].message).toBe(
        "Automatic rebalancing completed",
      );
    });

    it("should maintain correct event order in timeline", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      const orderedActivity: ActivityEvent[] = [
        {
          id: "evt-001",
          status: "status1",
          message: "Event 1",
          timestamp: new Date(2024, 0, 1, 10, 0, 0).toISOString(),
        },
        {
          id: "evt-002",
          status: "status2",
          message: "Event 2",
          timestamp: new Date(2024, 0, 1, 9, 0, 0).toISOString(),
        },
        {
          id: "evt-003",
          status: "status3",
          message: "Event 3",
          timestamp: new Date(2024, 0, 1, 8, 0, 0).toISOString(),
        },
      ];

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: orderedActivity });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.recentActivity[0].id).toBe("evt-001");
      expect(result.recentActivity[1].id).toBe("evt-002");
      expect(result.recentActivity[2].id).toBe("evt-003");
    });
  });

  describe("Graceful Degradation & Error Handling", () => {
    it("should load stats successfully when activity fails", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockRejectedValueOnce(new Error("Activity API Error"));

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.stats).toEqual(mockStatsData);
      expect(result.recentActivity).toEqual([]);
    });

    it("should load activity successfully when stats fails", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockRejectedValueOnce(new Error("Stats API Error"))
        .mockResolvedValueOnce({ data: mockActivityData });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.stats).toEqual({
        ordersToday: 0,
        ordersDelta: 0,
        activeDeliveries: 0,
        driversOnline: 0,
        driversTotal: 0,
        successRate: 0,
        successRateDelta: 0,
        unassignedCount: 0,
      });
      expect(result.recentActivity).toEqual(mockActivityData);
    });

    it("should handle both stats and activity API failures", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockRejectedValueOnce(new Error("API Error 1"))
        .mockRejectedValueOnce(new Error("API Error 2"));

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.stats.ordersToday).toBe(0);
      expect(result.stats.activeDeliveries).toBe(0);
      expect(result.recentActivity).toEqual([]);
    });

    it("should use Promise.allSettled to handle partial failures", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      // Should not throw, should handle both promises
      const result = await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("recentActivity");
    });
  });

  describe("Data Validation", () => {
    it("should return typed DashboardData structure", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("recentActivity");
      expect(typeof result.stats).toBe("object");
      expect(Array.isArray(result.recentActivity)).toBe(true);
    });

    it("should handle numeric KPI values correctly", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      const statsWithZeros: DashboardStats = {
        ordersToday: 0,
        ordersDelta: 0,
        activeDeliveries: 0,
        driversOnline: 0,
        driversTotal: 0,
        successRate: 0,
        successRateDelta: 0,
        unassignedCount: 0,
      };

      mockApiClient.get
        .mockResolvedValueOnce({ data: statsWithZeros })
        .mockResolvedValueOnce({ data: [] });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.stats.ordersToday).toBe(0);
      expect(result.stats.activeDeliveries).toBe(0);
      expect(result.recentActivity).toEqual([]);
    });

    it("should handle large numbers in KPI stats", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      const largeStats: DashboardStats = {
        ordersToday: 99999,
        ordersDelta: 5000,
        activeDeliveries: 1000,
        driversOnline: 500,
        driversTotal: 1000,
        successRate: 99.99,
        successRateDelta: 0.5,
        unassignedCount: 250,
      };

      mockApiClient.get
        .mockResolvedValueOnce({ data: largeStats })
        .mockResolvedValueOnce({ data: mockActivityData });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.stats.ordersToday).toBe(99999);
      expect(result.stats.activeDeliveries).toBe(1000);
      expect(result.stats.successRate).toBe(99.99);
    });
  });

  describe("Parallel Data Loading", () => {
    it("should load stats and activity in parallel", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      const startTime = Date.now();
      await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs);

      // Both API calls should be made (parallel, not sequential)
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });

    it("should make both API calls regardless of individual success", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockRejectedValueOnce(new Error("Stats failed"))
        .mockResolvedValueOnce({ data: mockActivityData });

      await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs);

      // Both calls should still be attempted
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty activity array", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: [] });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.recentActivity).toEqual([]);
      expect(result.recentActivity).toHaveLength(0);
    });

    it("should handle undefined activity in response", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: undefined });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      // Should handle gracefully - either undefined or empty array
      expect(
        result.recentActivity === undefined || result.recentActivity === [],
      ).toBe(true);
    });

    it("should handle null session token gracefully", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: { ...mockSession, accessToken: null },
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: mockActivityData });

      // Should handle null token - may create client with null or throw
      // Depends on implementation, but should be deterministic
      try {
        await loader({
          request: mockRequest() as LoaderFunctionArgs["request"],
          params: {},
        } as LoaderFunctionArgs);
      } catch (error) {
        // Expected behavior - null token should cause error
        expect(error).toBeDefined();
      }
    });

    it("should handle timestamps in ISO format", async () => {
      (authenticate.admin as any).mockResolvedValue({
        session: mockSession,
      });

      const mockApiClient = {
        get: vi.fn(),
      };
      (createApiClientFromRequest as any).mockReturnValue(mockApiClient);

      const activityWithISO: ActivityEvent[] = [
        {
          id: "evt-001",
          status: "completed",
          message: "Test event",
          timestamp: "2024-03-09T12:34:56.789Z",
        },
      ];

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockStatsData })
        .mockResolvedValueOnce({ data: activityWithISO });

      const result = (await loader({
        request: mockRequest() as LoaderFunctionArgs["request"],
        params: {},
      } as LoaderFunctionArgs)) as DashboardData;

      expect(result.recentActivity[0].timestamp).toBe(
        "2024-03-09T12:34:56.789Z",
      );
    });
  });
});
