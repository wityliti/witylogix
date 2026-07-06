/**
 * DAT v2 SDK Client Test Suite
 *
 * Comprehensive tests for DAT Freight & Analytics API v2 integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DATv2SDKClient } from "../../../../packages/core/src/integrations/freight/dat-v2-sdk-client";
import type {
  EquipmentType,
  LoadStatus,
} from "../../../../packages/core/src/integrations/freight/freight-sdk-types";

/**
 * Mock fetch function
 */
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

/**
 * Mock configuration
 */
const createMockConfig = () => ({
  clientId: "test-client-id",
  clientSecret: "sk_live_" + "FAKE0TEST",
  baseUrl: "https://api.dat.com/v2",
  debug: false,
});

describe("DATv2SDKClient", () => {
  let client: DATv2SDKClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DATv2SDKClient(createMockConfig());
  });

  describe("Authentication", () => {
    it("should authenticate and obtain OAuth2 token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "test-refresh-token",
        }),
      });

      const token = await client.authenticate();

      expect(token).toBe("test-access-token");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/oauth/token"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        }),
      );
    });

    it("should handle authentication failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
        json: async () => ({ error: "invalid_credentials" }),
      });

      await expect(client.authenticate()).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("should cache token and reuse for subsequent requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "cached-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      const token1 = await client.authenticate();
      const token2 = await client.authenticate();

      // Token should be reused without making another auth call
      expect(token1).toBe(token2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Spot Rate API", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });
    });

    it("should get spot rate for a lane", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-ratelimit-remaining", "999"],
          ["x-ratelimit-limit", "1000"],
          ["x-ratelimit-reset", String(Math.floor(Date.now() / 1000) + 3600)],
        ]),
        json: async () => ({
          spotRate: {
            rate: 2.45,
            ratePerMile: 2.45,
            percentageChange: 5.2,
          },
          equipmentType: "van",
          origin: { city: "Los Angeles", state: "CA", zip: "90001" },
          destination: { city: "Chicago", state: "IL", zip: "60601" },
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await client.getSpotRate({
        originCity: "Los Angeles",
        originState: "CA",
        originZip: "90001",
        destinationCity: "Chicago",
        destinationState: "IL",
        destinationZip: "60601",
        equipmentType: "van" as EquipmentType,
      });

      expect(result.spotRate.rate).toBe(2.45);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/rateview/spot-rate"),
        expect.any(Object),
      );
    });

    it("should get rate trends with historical data", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          avg13Week: 2.35,
          avg52Week: 2.28,
          low13Week: 2.1,
          high13Week: 2.6,
          trend: 3.5,
          weeklyData: [
            { date: "2024-01-01", rate: 2.4, volume: 1250 },
            { date: "2024-01-08", rate: 2.45, volume: 1300 },
          ],
        }),
      });

      const result = await client.getRateTrends({
        originCity: "Los Angeles",
        originState: "CA",
        destinationCity: "Chicago",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
        weeks: 13,
      });

      expect(result.avg13Week).toBe(2.35);
      expect(result.trend).toBe(3.5);
      expect(result.weeklyData).toHaveLength(2);
    });

    it("should get rate components breakdown", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          lineHaul: 2.0,
          fuel: 0.35,
          allIn: 2.35,
          fuelSurcharge: 0.35,
          accessorial: 0.0,
        }),
      });

      const result = await client.getRateComponents({
        originCity: "Los Angeles",
        originState: "CA",
        destinationCity: "Chicago",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
      });

      expect(result.lineHaul).toBe(2.0);
      expect(result.fuel).toBe(0.35);
      expect(result.allIn).toBe(2.35);
    });
  });

  describe("Load Board API", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });
    });

    it("should post a load", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          loadId: "LOAD-12345",
          origin: { city: "Los Angeles", state: "CA", zip: "90001" },
          destination: { city: "Chicago", state: "IL", zip: "60601" },
          equipmentType: "van",
          weight: 40000,
          length: 48,
          pickupDate: new Date().toISOString(),
          deliveryDate: new Date(Date.now() + 86400000).toISOString(),
          rate: 2400,
          currency: "USD",
          commodity: "Electronics",
          isHazmat: false,
          status: "posted",
          postedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          shipper: {
            name: "Shipper A",
            email: "shipper@example.com",
            phone: "555-1234",
          },
          receiver: {
            name: "Receiver B",
            email: "receiver@example.com",
            phone: "555-5678",
          },
        }),
      });

      const result = await client.postLoad({
        origin: { city: "Los Angeles", state: "CA", zip: "90001" },
        destination: { city: "Chicago", state: "IL", zip: "60601" },
        equipmentType: "van" as EquipmentType,
        weight: 40000,
        length: 48,
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
        rate: 2400,
        currency: "USD",
        commodity: "Electronics",
        isHazmat: false,
        shipper: {
          name: "Shipper A",
          email: "shipper@example.com",
          phone: "555-1234",
        },
        receiver: {
          name: "Receiver B",
          email: "receiver@example.com",
          phone: "555-5678",
        },
      });

      expect(result.loadId).toBe("LOAD-12345");
      expect(result.rate).toBe(2400);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/loadboard/loads"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should update a load", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          loadId: "LOAD-12345",
          rate: 2500,
          status: "active",
        }),
      });

      const result = await client.updateLoad("LOAD-12345", { rate: 2500 });

      expect(result.rate).toBe(2500);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/loadboard/loads/LOAD-12345"),
        expect.objectContaining({ method: "PUT" }),
      );
    });

    it("should remove a load", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true }),
      });

      const result = await client.removeLoad("LOAD-12345");

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/loadboard/loads/LOAD-12345"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("should search loads with filters", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          loads: [],
          total: 0,
          page: 1,
          pageSize: 50,
        }),
      });

      const result = await client.searchLoads({
        originState: "CA",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
        maxRate: 2500,
        page: 1,
        pageSize: 50,
      });

      expect(result.total).toBe(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/loadboard/loads"),
        expect.any(Object),
      );
    });
  });

  describe("Carrier Matching & Search", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });
    });

    it("should match carriers for a load", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            matchId: "MATCH-1",
            loadId: "LOAD-12345",
            carrier: {
              carrierId: "CARRIER-1",
              carrierName: "Fast Freight Inc",
              mcNumber: "123456",
              rating: 95,
            },
            matchScore: 92,
            matchedAt: new Date().toISOString(),
          },
        ],
      });

      const result = await client.matchCarriers("LOAD-12345");

      expect(result).toHaveLength(1);
      expect(result[0].matchScore).toBe(92);
    });

    it("should search carriers by criteria", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          carriers: [
            {
              carrierId: "CARRIER-1",
              carrierName: "Fast Freight Inc",
              mcNumber: "123456",
              rating: 95,
              equipmentTypes: ["van"],
              serviceAreas: ["CA", "IL"],
              authorityStatus: "active",
            },
          ],
          total: 1,
          page: 1,
        }),
      });

      const result = await client.searchCarriers({
        originState: "CA",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
        minRating: 90,
      });

      expect(result.carriers).toHaveLength(1);
      expect(result.carriers[0].rating).toBe(95);
    });

    it("should get carrier details", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          carrierId: "CARRIER-1",
          carrierName: "Fast Freight Inc",
          mcNumber: "123456",
          usdotNumber: "9876543",
          rating: 95,
          safetyRating: 92,
          equipmentTypes: ["van", "reefer"],
          yearsInBusiness: 15,
        }),
      });

      const result = await client.getCarrierDetails("CARRIER-1");

      expect(result.carrierName).toBe("Fast Freight Inc");
      expect(result.rating).toBe(95);
    });
  });

  describe("Market Analytics", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });
    });

    it("should get lane volume trends", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          lane: "CA-IL",
          volumeTrend: 8.5,
          avgDaily: 1250,
          maxDaily: 1500,
          dailyVolumes: [{ date: "2024-01-01", volume: 1200 }],
        }),
      });

      const result = await client.getLaneVolumeTrends({
        originState: "CA",
        destinationState: "IL",
        days: 30,
      });

      expect(result.lane).toBe("CA-IL");
      expect(result.volumeTrend).toBe(8.5);
    });

    it("should get capacity indicators", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          loadToTruckRatio: 3.2,
          capacityStatus: "tight",
          loadsPerTruck: 3.2,
          estimatedWaitTime: 45,
          trend: 5.5,
        }),
      });

      const result = await client.getCapacityIndicators({
        originState: "CA",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
      });

      expect(result.capacityStatus).toBe("tight");
      expect(result.loadToTruckRatio).toBe(3.2);
    });

    it("should get rate forecast", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          forecast: [
            {
              date: "2024-01-08",
              forecastRate: 2.5,
              confidence: 85,
              trend: "up",
            },
          ],
        }),
      });

      const result = await client.getRateForecast({
        originState: "CA",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
        days: 7,
      });

      expect(result.forecast).toHaveLength(1);
      expect(result.forecast[0].trend).toBe("up");
    });
  });

  describe("Rate Limiting", () => {
    it("should track rate limit info from response headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-ratelimit-remaining", "950"],
          ["x-ratelimit-limit", "1000"],
          ["x-ratelimit-reset", String(Math.floor(Date.now() / 1000) + 3600)],
        ]),
        json: async () => ({ spotRate: { rate: 2.45 } }),
      });

      await client.getSpotRate({
        originCity: "LA",
        originState: "CA",
        destinationCity: "CHI",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
      });

      const rateLimitInfo = client.getRateLimitInfo();

      expect(rateLimitInfo).not.toBeNull();
      expect(rateLimitInfo?.remaining).toBe(950);
      expect(rateLimitInfo?.limit).toBe(1000);
    });
  });

  describe("Caching", () => {
    it("should cache GET requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ spotRate: { rate: 2.45 } }),
      });

      // First request
      await client.getSpotRate({
        originCity: "LA",
        originState: "CA",
        destinationCity: "CHI",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
      });

      // Second request (should be cached)
      await client.getSpotRate({
        originCity: "LA",
        originState: "CA",
        destinationCity: "CHI",
        destinationState: "IL",
        equipmentType: "van" as EquipmentType,
      });

      // Should only be called once (auth + first request)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should clear cache", async () => {
      client.clearCache();
      // No-op test to ensure method exists
      expect(client).toBeDefined();
    });
  });

  describe("Webhooks", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });
    });

    it("should register webhook", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          webhookId: "WEBHOOK-1",
          registeredAt: new Date().toISOString(),
        }),
      });

      const result = await client.registerWebhook({
        webhookUrl: "https://example.com/webhooks/dat",
        eventTypes: ["load_match", "rate_alert"],
      });

      expect(result.webhookId).toBe("WEBHOOK-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/webhooks"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
