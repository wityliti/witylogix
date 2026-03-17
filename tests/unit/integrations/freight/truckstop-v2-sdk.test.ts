/**
 * Truckstop v2 SDK Client Test Suite
 *
 * Comprehensive tests for Truckstop API v2 integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TruckstopV2SDKClient } from "../../../../packages/core/src/integrations/freight/truckstop-v2-sdk-client";
import type { EquipmentType, LoadStatus } from "../../../../packages/core/src/integrations/freight/freight-sdk-types";

/**
 * Mock fetch function
 */
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

/**
 * Mock configuration
 */
const createMockConfig = () => ({
  apiKey: "sk_live_" + "TESTKEY123",
  baseUrl: "https://api.truckstop.com/v2",
  debug: false,
});

describe("TruckstopV2SDKClient", () => {
  let client: TruckstopV2SDKClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new TruckstopV2SDKClient(createMockConfig());
  });

  describe("Load Posting API", () => {
    it("should post a load to the network", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-ratelimit-remaining", "490"],
          ["x-ratelimit-limit", "500"],
          [
            "x-ratelimit-reset",
            String(Math.floor(Date.now() / 1000) + 3600),
          ],
        ]),
        json: async () => ({
          loadId: "TS-LOAD-12345",
          origin: { city: "Los Angeles", state: "CA", zip: "90001" },
          destination: { city: "Chicago", state: "IL", zip: "60601" },
          equipmentType: "van",
          weight: 40000,
          length: 48,
          pickupDate: new Date().toISOString(),
          deliveryDate: new Date(Date.now() + 86400000).toISOString(),
          rate: 2400,
          currency: "USD",
          commodity: "General",
          isHazmat: false,
          status: "posted",
          postedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          shipper: { name: "Shipper A", email: "shipper@example.com", phone: "555-1234" },
          receiver: { name: "Receiver B", email: "receiver@example.com", phone: "555-5678" },
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
        commodity: "General",
        isHazmat: false,
        shipper: { name: "Shipper A", email: "shipper@example.com", phone: "555-1234" },
        receiver: { name: "Receiver B", email: "receiver@example.com", phone: "555-5678" },
      });

      expect(result.loadId).toBe("TS-LOAD-12345");
      expect(result.rate).toBe(2400);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/loads"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should update a load", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          loadId: "TS-LOAD-12345",
          rate: 2500,
          status: "active",
        }),
      });

      const result = await client.updateLoad("TS-LOAD-12345", { rate: 2500 });

      expect(result.rate).toBe(2500);
    });

    it("should remove a load", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true }),
      });

      const result = await client.removeLoad("TS-LOAD-12345");

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/loads/TS-LOAD-12345"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("should search loads by criteria", async () => {
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
        originMarket: "LA",
        destinationMarket: "CHI",
        maxRate: 2500,
      });

      expect(result.total).toBe(0);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/loads"),
        expect.any(Object)
      );
    });
  });

  describe("Rate Intelligence API", () => {
    it("should get lane rates (spot and contract)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          laneId: "LA-CHI",
          originMarket: "LA",
          destinationMarket: "CHI",
          spotRate: 2.45,
          contractRate: 2.35,
          equipmentType: "van",
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await client.getLaneRates({
        originMarket: "LA",
        destinationMarket: "CHI",
        equipmentType: "van" as EquipmentType,
      });

      expect(result.spotRate).toBe(2.45);
      expect(result.contractRate).toBe(2.35);
    });

    it("should get rate predictions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          predictions: [
            {
              date: "2024-01-08",
              forecastRate: 2.5,
              confidence: 88,
              trend: "up",
            },
          ],
        }),
      });

      const result = await client.getRatePredictions({
        originMarket: "LA",
        destinationMarket: "CHI",
        equipmentType: "van" as EquipmentType,
        days: 7,
      });

      expect(result.predictions).toHaveLength(1);
      expect(result.predictions[0].confidence).toBe(88);
    });

    it("should get seasonal trends", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          trends: [
            {
              season: "Q1",
              avgRate: 2.4,
              variance: 0.15,
              confidence: 90,
            },
          ],
        }),
      });

      const result = await client.getSeasonalTrends({
        originMarket: "LA",
        destinationMarket: "CHI",
        equipmentType: "van" as EquipmentType,
      });

      expect(result.trends).toHaveLength(1);
      expect(result.trends[0].season).toBe("Q1");
    });
  });

  describe("Carrier Matching & Profiles", () => {
    it("should find matching carriers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => [
          {
            matchId: "MATCH-1",
            loadId: "LOAD-1",
            carrier: {
              carrierId: "CARRIER-1",
              carrierName: "Reliable Freight",
              mcNumber: "123456",
              rating: 94,
            },
            matchScore: 91,
            matchedAt: new Date().toISOString(),
          },
        ],
      });

      const result = await client.findCarriers({
        originMarket: "LA",
        destinationMarket: "CHI",
        equipmentType: "van" as EquipmentType,
        minRating: 90,
      });

      expect(result).toHaveLength(1);
      expect(result[0].carrier.rating).toBe(94);
    });

    it("should get carrier profile", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          carrierId: "CARRIER-1",
          carrierName: "Reliable Freight",
          mcNumber: "123456",
          usdotNumber: "9876543",
          rating: 94,
          equipmentTypes: ["van", "reefer"],
          serviceAreas: ["CA", "IL", "TX"],
          yearsInBusiness: 12,
          truckCount: 150,
          trailerCount: 200,
        }),
      });

      const result = await client.getCarrierProfile("CARRIER-1");

      expect(result.carrierName).toBe("Reliable Freight");
      expect(result.rating).toBe(94);
      expect(result.truckCount).toBe(150);
    });
  });

  describe("Asset Tracking API", () => {
    it("should post equipment availability", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          postingId: "POSTING-1",
          postedAt: new Date().toISOString(),
        }),
      });

      const result = await client.postEquipmentAvailability({
        equipmentType: "van" as EquipmentType,
        currentLocation: { city: "Los Angeles", state: "CA", zip: "90001" },
        availableDate: new Date(),
        rate: 2400,
      });

      expect(result.postingId).toBe("POSTING-1");
    });

    it("should update ETA", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true }),
      });

      const result = await client.updateETA({
        loadId: "LOAD-1",
        estimatedArrival: new Date(Date.now() + 3600000),
        currentLocation: { city: "Kansas City", state: "MO", zip: "64101" },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Payments API", () => {
    it("should process QuickPay payment", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          transactionId: "TXN-12345",
          status: "completed",
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await client.processQuickPayment({
        loadId: "LOAD-1",
        amount: 2400,
        carrierId: "CARRIER-1",
      });

      expect(result.transactionId).toBe("TXN-12345");
      expect(result.status).toBe("completed");
    });

    it("should get payment status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          transactionId: "TXN-12345",
          status: "completed",
          amount: 2400,
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await client.getPaymentStatus("TXN-12345");

      expect(result.status).toBe("completed");
      expect(result.amount).toBe(2400);
    });
  });

  describe("RMIS Integration", () => {
    it("should get carrier safety data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          carrierId: "CARRIER-1",
          safetyRating: 89,
          inspectionScore: 92,
          crashIndicator: 1.2,
          violationScore: 0.8,
          hazmatFlag: false,
          lastUpdated: new Date().toISOString(),
        }),
      });

      const result = await client.getCarrierSafetyData("CARRIER-1");

      expect(result.safetyRating).toBe(89);
      expect(result.hazmatFlag).toBe(false);
    });

    it("should verify carrier insurance", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          carrierId: "CARRIER-1",
          insured: true,
          coverageType: "GL",
          coverageAmount: 1000000,
          expirationDate: new Date(Date.now() + 86400000 * 365).toISOString(),
          verified: true,
          verifiedAt: new Date().toISOString(),
        }),
      });

      const result = await client.verifyCarrierInsurance("CARRIER-1");

      expect(result.insured).toBe(true);
      expect(result.verified).toBe(true);
    });

    it("should check carrier authority status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          carrierId: "CARRIER-1",
          authorityStatus: "active",
          mcNumber: "123456",
          usdotNumber: "9876543",
          lastVerified: new Date().toISOString(),
        }),
      });

      const result = await client.checkCarrierAuthority("CARRIER-1");

      expect(result.authorityStatus).toBe("active");
    });
  });

  describe("Book It Now", () => {
    it("should book load instantly with digital confirmation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          confirmationNumber: "CONF-12345",
          loadId: "LOAD-1",
          carrierId: "CARRIER-1",
          carrierName: "Reliable Freight",
          bookedRate: 2400,
          status: "confirmed",
          confirmedAt: new Date().toISOString(),
        }),
      });

      const result = await client.bookItNow({
        loadId: "LOAD-1",
        carrierId: "CARRIER-1",
        rate: 2400,
      });

      expect(result.confirmationNumber).toBe("CONF-12345");
      expect(result.status).toBe("confirmed");
    });
  });

  describe("Document Management", () => {
    it("should upload a document", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          documentId: "DOC-12345",
          loadId: "LOAD-1",
          documentType: "bol",
          documentName: "BOL-001.pdf",
          documentUrl: "https://storage.example.com/DOC-12345",
          uploadedAt: new Date().toISOString(),
        }),
      });

      const result = await client.uploadDocument({
        loadId: "LOAD-1",
        documentType: "bol",
        file: Buffer.from("PDF content"),
        fileName: "BOL-001.pdf",
      });

      expect(result.documentId).toBe("DOC-12345");
      expect(result.documentType).toBe("bol");
    });

    it("should download a document", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["content-type", "application/pdf"],
          ["content-disposition", "attachment; filename=BOL-001.pdf"],
        ]),
        arrayBuffer: async () =>
          new ArrayBuffer(10),
      });

      const result = await client.downloadDocument("DOC-12345");

      expect(result.fileName).toBe("BOL-001.pdf");
      expect(result.mimeType).toBe("application/pdf");
    });
  });

  describe("Rate Limiting & Backoff", () => {
    it("should track rate limit info", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ["x-ratelimit-remaining", "480"],
          ["x-ratelimit-limit", "500"],
          [
            "x-ratelimit-reset",
            String(Math.floor(Date.now() / 1000) + 3600),
          ],
        ]),
        json: async () => ({ loads: [] }),
      });

      await client.searchLoads({});

      const rateLimitInfo = client.getRateLimitInfo();

      expect(rateLimitInfo).not.toBeNull();
      expect(rateLimitInfo?.remaining).toBe(480);
      expect(rateLimitInfo?.limit).toBe(500);
    });

    it("should handle 429 with backoff strategy", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Map([["retry-after", "1"]]),
          json: async () => ({ error: "rate_limit_exceeded" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map(),
          json: async () => ({ loads: [] }),
        });

      const result = await client.searchLoads({});

      expect(result.loads).toBeDefined();
      // Should have retried after backoff
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Caching", () => {
    it("should cache GET requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ loads: [] }),
      });

      // First request
      await client.searchLoads({});

      // Second request (should be cached)
      await client.searchLoads({});

      // Should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should clear cache", async () => {
      client.clearCache();
      // No-op test to ensure method exists
      expect(client).toBeDefined();
    });
  });

  describe("Webhooks", () => {
    it("should register webhook", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({
          webhookId: "WEBHOOK-1",
          registeredAt: new Date().toISOString(),
        }),
      });

      const result = await client.registerWebhook({
        webhookUrl: "https://example.com/webhooks/truckstop",
        eventTypes: ["load_match", "booking_confirmation"],
      });

      expect(result.webhookId).toBe("WEBHOOK-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/webhooks"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
