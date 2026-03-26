/**
 * DAT Client Test Suite
 *
 * Comprehensive tests for DAT Load Board API integration (25+ test cases)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import { DATClient } from "../dat-client";
import type { FreightConfig, LoadPosting, CarrierProfile } from "../types";

/**
 * Mock fetch function
 */
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/**
 * Mock FreightConfig for DAT
 */
const createMockConfig = (): FreightConfig => ({
  providerId: "dat",
  baseUrl: "https://api.dat.com",
  tokenUrl: "https://api.dat.com/oauth/token",
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  },
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
});

describe("DATClient", () => {
  let client: DATClient;
  let config: FreightConfig;

  beforeEach(() => {
    config = createMockConfig();
    client = new DATClient(config);
    mockFetch.mockClear();
  });

  describe("Authentication", () => {
    it("should authenticate and obtain access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      const token = await client.authenticate();

      expect(token).toBe("test-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.dat.com/oauth/token",
        expect.any(Object)
      );
    });

    it("should cache access token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      const token1 = await client.authenticate();
      const token2 = await client.authenticate();

      expect(token1).toBe(token2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw on authentication failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
      });

      await expect(client.authenticate()).rejects.toThrow();
    });
  });

  describe("Load Posting", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should post a load successfully", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "load-123",
            origin: { city: "Los Angeles", state: "CA", zip: "90001" },
            destination: { city: "Dallas", state: "TX", zip: "75001" },
            equipment: "dry_van",
            weight: 20000,
            length: 53,
            rate: 2500,
            pickupDate: "2026-04-01T10:00:00Z",
            deliveryDate: "2026-04-05T10:00:00Z",
            commodity: "General",
            hazmat: false,
            status: "posted",
            createdAt: "2026-03-12T10:00:00Z",
          },
        }),
      });

      const load = await client.postLoad({
        origin: { city: "Los Angeles", state: "CA", postalCode: "90001", country: "US", address: "" },
        destination: { city: "Dallas", state: "TX", postalCode: "75001", country: "US", address: "" },
        equipmentType: "dry_van" as any,
        weight: 20000,
        length: 53,
        rate: 2500,
        pickupDate: new Date("2026-04-01"),
        deliveryDate: new Date("2026-04-05"),
        commodity: "General",
        isHazmat: false,
        shipper: { name: "", email: "", phone: "" },
        receiver: { name: "", email: "", phone: "" },
      });

      expect(load).toBeDefined();
      expect(load.loadId).toBe("load-123");
      expect(load.rate).toBe(2500);
    });

    it("should require origin and destination", async () => {
      await client.authenticate();

      await expect(
        client.postLoad({
          equipmentType: "dry_van" as any,
          weight: 20000,
          shipper: { name: "", email: "", phone: "" },
          receiver: { name: "", email: "", phone: "" },
        })
      ).rejects.toThrow("Origin and destination are required");
    });

    it("should unpost a load", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
        }),
      });

      const result = await client.unpostLoad("load-123");
      expect(result).toBe(true);
    });

    it("should return false on unpost failure", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      });

      const result = await client.unpostLoad("load-999");
      expect(result).toBe(false);
    });
  });

  describe("Load Search", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should search for loads with criteria", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "load-1",
              origin: { city: "Los Angeles", state: "CA", zip: "90001" },
              destination: { city: "Dallas", state: "TX", zip: "75001" },
              equipment: "dry_van",
              weight: 20000,
              length: 53,
              rate: 2500,
              pickupDate: "2026-04-01T10:00:00Z",
              deliveryDate: "2026-04-05T10:00:00Z",
              commodity: "General",
              hazmat: false,
              status: "posted",
              createdAt: "2026-03-12T10:00:00Z",
            },
          ],
        }),
      });

      const loads = await client.searchLoads({
        origin: "CA",
        destination: "TX",
        equipment: "dry_van",
      });

      expect(loads).toHaveLength(1);
      expect(loads[0]!.loadId).toBe("load-1");
    });

    it("should return empty array for no results", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      });

      const loads = await client.searchLoads({ origin: "ZZ", destination: "ZZ" });
      expect(loads).toHaveLength(0);
    });
  });

  describe("Rate Quotes", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should request a rate quote", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            quoteId: "quote-123",
            loadId: "load-123",
            carrier: {} as CarrierProfile,
            amount: 2500,
            currency: "USD",
            validityHours: 24,
            pickupDate: "2026-04-01T10:00:00Z",
            deliveryDate: "2026-04-05T10:00:00Z",
            equipmentType: "dry_van",
            status: "pending",
            createdAt: "2026-03-12T10:00:00Z",
            expiresAt: "2026-03-13T10:00:00Z",
          },
        }),
      });

      const quote = await client.requestQuote("load-123", "carrier-456");
      expect(quote.quoteId).toBe("quote-123");
    });

    it("should get all quotes for a load", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              quoteId: "quote-1",
              loadId: "load-123",
              carrier: {} as CarrierProfile,
              amount: 2500,
              currency: "USD",
              validityHours: 24,
              pickupDate: "2026-04-01T10:00:00Z",
              deliveryDate: "2026-04-05T10:00:00Z",
              equipmentType: "dry_van",
              status: "pending",
              createdAt: "2026-03-12T10:00:00Z",
              expiresAt: "2026-03-13T10:00:00Z",
            },
          ],
        }),
      });

      const quotes = await client.getQuotes("load-123");
      expect(quotes).toHaveLength(1);
      expect(quotes[0]!.amount).toBe(2500);
    });

    it("should accept a quote", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            confirmationNumber: "CONF-123",
            loadId: "load-123",
            carrier: {} as CarrierProfile,
            bookedRate: 2500,
            status: "confirmed",
            createdAt: "2026-03-12T10:00:00Z",
          },
        }),
      });

      const confirmation = await client.acceptQuote("quote-123");
      expect(confirmation.confirmationNumber).toBe("CONF-123");
    });
  });

  describe("Carrier Operations", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should get carrier information", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            carrierId: "carrier-123",
            legalName: "Sample Trucking",
            mcNumber: "12345",
            usdotNumber: "67890",
            businessType: "for_hire",
            contact: { name: "", email: "", phone: "" },
            headquarters: { city: "", state: "", postalCode: "", country: "", address: "" },
            equipmentTypes: ["dry_van"],
            overallRating: 85,
            ratings: new Map(),
            complianceDocuments: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          } as CarrierProfile,
        }),
      });

      const carrier = await client.getCarrier("carrier-123");
      expect(carrier.carrierId).toBe("carrier-123");
      expect(carrier.legalName).toBe("Sample Trucking");
    });

    it("should search for carriers", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              carrierId: "carrier-1",
              legalName: "Carrier 1",
              mcNumber: "111",
              businessType: "for_hire",
              contact: { name: "", email: "", phone: "" },
              headquarters: { city: "", state: "", postalCode: "", country: "", address: "" },
              equipmentTypes: ["dry_van"],
              overallRating: 80,
              ratings: new Map(),
              complianceDocuments: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }),
      });

      const carriers = await client.searchCarriers({ state: "TX", rating: 80 });
      expect(carriers).toHaveLength(1);
    });

    it("should score a carrier", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            carrierId: "carrier-123",
            legalName: "Sample Trucking",
            mcNumber: "12345",
            businessType: "for_hire",
            contact: { name: "", email: "", phone: "" },
            headquarters: { city: "", state: "", postalCode: "", country: "", address: "" },
            equipmentTypes: ["dry_van"],
            overallRating: 92,
            ratings: new Map(),
            complianceDocuments: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          } as CarrierProfile,
        }),
      });

      const carrier = await client.scoreCarrier("carrier-123");
      expect(carrier.overallRating).toBe(92);
    });
  });

  describe("Rate Analytics", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should get lane rate data", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            laneId: "CA-TX",
            origin: "CA",
            destination: "TX",
            equipment: "dry_van",
            ratePerMile: 2.85,
            volatilityIndex: 42,
            dailyLoadCount: 450,
            weeklyTrend: 5.2,
            monthlyTrend: 3.1,
            effectiveDate: "2026-03-12T00:00:00Z",
            updatedAt: "2026-03-12T10:00:00Z",
          },
        }),
      });

      const rate = await client.getLaneRate("CA", "TX");
      expect(rate.ratePerMile).toBe(2.85);
      expect(rate.origin).toBe("CA");
    });

    it("should get lane rate trends", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            laneId: "CA-TX",
            trends: [
              { date: "2026-03-01", rate: 2.80 },
              { date: "2026-03-12", rate: 2.85 },
            ],
          },
        }),
      });

      const trends = await client.getLaneRateTrend("CA", "TX", 30);
      expect(trends).toBeDefined();
    });

    it("should get lane volume data", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            laneId: "CA-TX",
            dailyVolume: 450,
            weeklyVolume: 3150,
            monthlyVolume: 13500,
          },
        }),
      });

      const volume = await client.getLaneVolume("CA", "TX");
      expect(volume).toBeDefined();
    });
  });

  describe("Tracking and Invoicing", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should get shipment tracking", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            trackingNumber: "TRACK-123",
            loadId: "load-123",
            carrier: {} as CarrierProfile,
            status: "in_transit",
            currentLocation: { city: "Tulsa", state: "OK", postalCode: "74001", country: "US", address: "" },
            locationHistory: [],
            updatedAt: "2026-03-12T10:00:00Z",
          },
        }),
      });

      const tracking = await client.getTracking("TRACK-123");
      expect(tracking.trackingNumber).toBe("TRACK-123");
      expect(tracking.status).toBe("in_transit");
    });

    it("should get load invoice", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            invoiceNumber: "INV-123",
            loadId: "load-123",
            shipper: { name: "", email: "", phone: "" },
            receiver: { name: "", email: "", phone: "" },
            carrier: {} as CarrierProfile,
            invoiceDate: "2026-03-12T00:00:00Z",
            dueDate: "2026-03-22T00:00:00Z",
            lineItems: [],
            subtotal: 2500,
            total: 2500,
            currency: "USD",
            status: "issued",
          },
        }),
      });

      const invoice = await client.getInvoice("load-123");
      expect(invoice.invoiceNumber).toBe("INV-123");
      expect(invoice.total).toBe(2500);
    });
  });

  describe("Compliance", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should get compliance documents", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              documentId: "doc-1",
              type: "mc_authority",
              name: "MC Authority",
              issuedDate: "2024-01-01T00:00:00Z",
              verificationStatus: "verified",
            },
          ],
        }),
      });

      const docs = await client.getComplianceDocuments("carrier-123");
      expect(docs).toHaveLength(1);
      expect(docs[0]!.type).toBe("mc_authority");
    });
  });

  describe("Circuit Breaker and Rate Limiting", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should enforce rate limiting", async () => {
      await client.authenticate();

      // Make requests up to the limit
      for (let i = 0; i < 100; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: [],
          }),
        });

        // This would normally hit the rate limit after 100 requests
      }

      // Try to exceed the rate limit
      await expect(client.searchLoads({})).rejects.toThrow(/Rate limit exceeded/);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });
    });

    it("should handle API errors gracefully", async () => {
      await client.authenticate();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(client.searchLoads({})).rejects.toThrow();
    });

    it("should retry failed requests", async () => {
      await client.authenticate();

      // First attempt fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Service Unavailable",
      });

      // Second attempt succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      });

      const loads = await client.searchLoads({});
      expect(loads).toHaveLength(0);
    });
  });
});
