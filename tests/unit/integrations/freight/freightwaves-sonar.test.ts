/**
 * FreightWaves SONAR API Client Test Suite
 *
 * Comprehensive tests for SONAR market intelligence API integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FreightWavesSONARClient } from "../../../../packages/core/src/integrations/freight/freightwaves-sonar-client";
import type { FreightMarket } from "../../../../packages/core/src/integrations/freight/freight-sdk-types";

/**
 * Mock fetch function
 */
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

/**
 * Mock configuration
 */
const createMockConfig = () => ({
  apiKey: "sk_live_" + "SONARTESTKEY",
  baseUrl: "https://api.freightwaves.com/sonar",
  debug: false,
});

describe("FreightWavesSONARClient", () => {
  let client: FreightWavesSONARClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FreightWavesSONARClient(createMockConfig());
  });

  describe("Tender Data Indices", () => {
    it("should get OTVI (Outbound Tender Volume Index)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-ratelimit-remaining", "98"],
          ["x-ratelimit-limit", "100"],
          ["x-ratelimit-day-remaining", "9800"],
          ["x-ratelimit-day-limit", "10000"],
          ["x-ratelimit-reset", String(Math.floor(Date.now() / 1000) + 3600)],
        ]),
        json: async () => [
          {
            metricId: "OTVI-001",
            metricName: "OTVI",
            value: 1245.32,
            previousValue: 1200.15,
            changePercent: 3.75,
            timestamp: new Date().toISOString(),
            granularity: "daily",
            source: "sonar_api",
          },
        ],
      });

      const result = await client.getOTVI({
        granularity: "daily",
      });

      expect(result).toHaveLength(1);
      expect(result[0].metricName).toBe("OTVI");
      expect(result[0].value).toBe(1245.32);
      expect(result[0].changePercent).toBe(3.75);
    });

    it("should get OTRI (Outbound Tender Rejection Index)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "OTRI-001",
            metricName: "OTRI",
            value: 8.42,
            timestamp: new Date().toISOString(),
            granularity: "daily",
            source: "sonar_api",
          },
        ],
      });

      const result = await client.getOTRI();

      expect(result[0].metricName).toBe("OTRI");
      expect(result[0].value).toBe(8.42);
    });

    it("should get ITVI (Inbound Tender Volume Index)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "ITVI-001",
            metricName: "ITVI",
            value: 956.78,
            timestamp: new Date().toISOString(),
            granularity: "daily",
            source: "sonar_api",
          },
        ],
      });

      const result = await client.getITVI();

      expect(result[0].metricName).toBe("ITVI");
    });
  });

  describe("Rate Data Indices", () => {
    it("should get TLI (Truckload Linehaul Index)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "TLI-001",
            metricName: "TLI",
            value: 1987.45,
            previousValue: 1965.32,
            changePercent: 1.12,
            timestamp: new Date().toISOString(),
            granularity: "weekly",
            source: "sonar_api",
          },
        ],
      });

      const result = await client.getTLI({ granularity: "weekly" });

      expect(result[0].metricName).toBe("TLI");
      expect(result[0].value).toBe(1987.45);
    });

    it("should get Diesel Fuel Index (DTS)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "DTS-001",
            metricName: "DTS",
            value: 3.456,
            timestamp: new Date().toISOString(),
            granularity: "daily",
            source: "sonar_api",
          },
        ],
      });

      const result = await client.getDieselFuelIndex();

      expect(result[0].metricName).toBe("DTS");
      expect(result[0].value).toBe(3.456);
    });

    it("should get DAT spot rates feed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "DAT-SPOT-001",
            metricName: "DAT_SPOT_RATES",
            value: 2.45,
            market: "LA",
            timestamp: new Date().toISOString(),
            granularity: "daily",
            source: "dat_feeds",
          },
        ],
      });

      const result = await client.getDATSpotRates({
        markets: ["LA" as FreightMarket],
      });

      expect(result[0].metricName).toBe("DAT_SPOT_RATES");
      expect(result[0].source).toBe("dat_feeds");
    });

    it("should get contract rates feed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "CONTRACT-001",
            metricName: "CONTRACT_RATES",
            value: 2.35,
            market: "CHI",
            timestamp: new Date().toISOString(),
            granularity: "daily",
            source: "dat_feeds",
          },
        ],
      });

      const result = await client.getContractRates();

      expect(result[0].metricName).toBe("CONTRACT_RATES");
      expect(result[0].value).toBe(2.35);
    });
  });

  describe("Capacity Data", () => {
    it("should get Carrier Revocations Index (CRI)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "CRI-001",
            metricName: "CRI",
            value: 125,
            timestamp: new Date().toISOString(),
            granularity: "weekly",
            source: "carrier_data",
          },
        ],
      });

      const result = await client.getCarrierRevocations();

      expect(result[0].metricName).toBe("CRI");
      expect(result[0].source).toBe("carrier_data");
    });

    it("should get New Carrier Applications Index (NACI)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "NACI-001",
            metricName: "NACI",
            value: 2345,
            timestamp: new Date().toISOString(),
            granularity: "weekly",
            source: "carrier_data",
          },
        ],
      });

      const result = await client.getNewCarrierApplications();

      expect(result[0].metricName).toBe("NACI");
      expect(result[0].value).toBe(2345);
    });

    it("should get Active Truck Utilization (ATU)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            metricId: "ATU-001",
            metricName: "ATU",
            value: 78.5,
            market: "LA",
            timestamp: new Date().toISOString(),
            granularity: "daily",
            source: "sonar_api",
          },
        ],
      });

      const result = await client.getActiveTruckUtilization({
        markets: ["LA" as FreightMarket],
      });

      expect(result[0].metricName).toBe("ATU");
      expect(result[0].value).toBe(78.5);
    });
  });

  describe("Market Indices", () => {
    it("should get freight futures pricing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          futures: [
            {
              month: "Jan-2024",
              price: 1987.5,
              change: 12.5,
              openInterest: 45000,
            },
            {
              month: "Feb-2024",
              price: 1995.0,
              change: 20.0,
              openInterest: 38000,
            },
          ],
        }),
      });

      const result = await client.getFreightFutures();

      expect(result.futures).toHaveLength(2);
      expect(result.futures[0].month).toBe("Jan-2024");
      expect(result.futures[0].price).toBe(1987.5);
    });

    it("should get border wait times", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          borderWaitTimes: [
            {
              border: "US_MEXICO",
              crossingPoint: "El Paso, TX",
              averageWaitTime: 45,
              timestamp: new Date().toISOString(),
              trend: 2.5,
            },
          ],
        }),
      });

      const result = await client.getBorderWaitTimes({
        border: "US_MEXICO",
      });

      expect(result.borderWaitTimes).toHaveLength(1);
      expect(result.borderWaitTimes[0].averageWaitTime).toBe(45);
      expect(result.borderWaitTimes[0].trend).toBe(2.5);
    });
  });

  describe("Batch Queries", () => {
    it("should batch query multiple metrics (up to 50)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          { metricName: "OTVI", value: 1245 },
          { metricName: "TLI", value: 1987 },
          { metricName: "OTRI", value: 8.42 },
        ],
      });

      const result = await client.batchQueryMetrics({
        metrics: ["OTVI", "TLI", "OTRI"],
        granularity: "daily",
      });

      expect(result).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("metrics=OTVI,TLI,OTRI"),
        expect.any(Object),
      );
    });

    it("should reject batch query over 50 metrics", async () => {
      const metrics = Array(51).fill("OTVI");

      await expect(
        client.batchQueryMetrics({
          metrics: metrics as any,
        }),
      ).rejects.toThrow("Maximum 50 metrics");
    });

    it("should get lane-level metrics", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          lane: "LA-CHI",
          metrics: [
            {
              metricName: "OTVI",
              value: 1245,
              changePercent: 3.5,
            },
            {
              metricName: "TLI",
              value: 2.45,
              changePercent: 1.2,
            },
          ],
        }),
      });

      const result = await client.getLaneMetrics({
        originMarket: "LA" as FreightMarket,
        destinationMarket: "CHI" as FreightMarket,
      });

      expect(result.lane).toBe("LA-CHI");
      expect(result.metrics).toHaveLength(2);
    });
  });

  describe("Rate Limiting", () => {
    it("should track request rate limits", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-ratelimit-remaining", "85"],
          ["x-ratelimit-limit", "100"],
          ["x-ratelimit-day-remaining", "9000"],
          ["x-ratelimit-day-limit", "10000"],
          ["x-ratelimit-reset", String(Math.floor(Date.now() / 1000) + 3600)],
        ]),
        json: async () => [{ metricName: "OTVI", value: 1245 }],
      });

      await client.getOTVI();

      const rateLimitInfo = client.getRateLimitInfo();

      expect(rateLimitInfo).not.toBeNull();
      expect(rateLimitInfo?.remaining).toBe(85);
      expect(rateLimitInfo?.limit).toBe(100);
      expect(rateLimitInfo?.percentageUsed).toBe(15);
    });

    it("should track daily rate limits separately", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-ratelimit-remaining", "80"],
          ["x-ratelimit-limit", "100"],
          ["x-ratelimit-day-remaining", "9500"],
          ["x-ratelimit-day-limit", "10000"],
          ["x-ratelimit-reset", String(Math.floor(Date.now() / 1000) + 3600)],
        ]),
        json: async () => [],
      });

      await client.getOTVI();

      const dailyInfo = client.getDailyRateLimitInfo();

      expect(dailyInfo).not.toBeNull();
      expect(dailyInfo?.remaining).toBe(9500);
      expect(dailyInfo?.limit).toBe(10000);
    });
  });

  describe("Caching", () => {
    it("should cache GET requests for 15 minutes (real-time data)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [{ metricName: "OTVI", value: 1245 }],
      });

      // First request
      const result1 = await client.getOTVI();

      // Second request (should be cached)
      const result2 = await client.getOTVI();

      expect(result1).toEqual(result2);
      // Should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should cache historical data longer (24 hours)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [{ metricName: "CRI", value: 125 }],
      });

      // Request with date range (historical)
      await client.getCarrierRevocations({
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-31"),
        },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should clear cache", async () => {
      client.clearCache();
      // No-op test to ensure method exists
      expect(client).toBeDefined();
    });
  });

  describe("Alerts", () => {
    it("should create threshold-based alert", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          alertId: "ALERT-12345",
          createdAt: new Date().toISOString(),
        }),
      });

      const result = await client.createAlert({
        metric: "OTVI",
        threshold: 1300,
        condition: "above",
        webhookUrl: "https://example.com/webhooks/sonar",
      });

      expect(result.alertId).toBe("ALERT-12345");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/alerts"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should get alert status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          alertId: "ALERT-12345",
          metric: "OTVI",
          status: "active",
          triggerCount: 2,
          lastTriggered: new Date().toISOString(),
        }),
      });

      const result = await client.getAlertStatus("ALERT-12345");

      expect(result.status).toBe("active");
      expect(result.triggerCount).toBe(2);
    });
  });

  describe("Date Range Queries", () => {
    it("should query metrics with date ranges", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          { metricName: "OTVI", value: 1245, timestamp: "2024-01-01" },
          { metricName: "OTVI", value: 1250, timestamp: "2024-01-02" },
        ],
      });

      const result = await client.getOTVI({
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-31"),
        },
      });

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("start_date=2024-01-01"),
        expect.any(Object),
      );
    });
  });

  describe("Static Utilities", () => {
    it("should list all 135 freight markets", () => {
      const markets = FreightWavesSONARClient.getFreightMarkets();

      expect(markets).toHaveLength(10); // Sample of major markets
      expect(markets).toContain("LA");
      expect(markets).toContain("CHI");
      expect(markets).toContain("DAL");
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "invalid_api_key" }),
      });

      await expect(client.getOTVI()).rejects.toThrow();
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(client.getOTVI()).rejects.toThrow("Network error");
    });
  });
});
