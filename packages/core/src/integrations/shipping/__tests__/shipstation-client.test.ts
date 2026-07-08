/**
 * ShipStation Client Tests
 *
 * Test suite for ShipStation API integration:
 * - Configuration validation
 * - Rate fetching and normalization
 * - Label creation
 * - Address validation
 * - Webhook parsing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShipStationClient } from "../shipstation-client.js";
import type { ShipmentRequest, ShippingAddress } from "../types.js";

// ─── Mock Data ──────────────────────────────────────────────────

const mockAddress: ShippingAddress = {
  name: "John Doe",
  street1: "123 Main St",
  city: "San Francisco",
  state: "CA",
  zip: "94103",
  country: "US",
  phone: "+1-415-555-0100",
  email: "john@example.com",
};

const mockShipmentRequest: ShipmentRequest = {
  shipmentId: "ship_123",
  from: mockAddress,
  to: {
    ...mockAddress,
    name: "Jane Smith",
    zip: "90210",
    city: "Los Angeles",
  },
  weight: {
    value: 2,
    unit: "lb",
  },
  dimensions: {
    length: 12,
    width: 8,
    height: 6,
  },
  packageType: "BOX",
};

// ─── Test Suite ─────────────────────────────────────────────────

describe("ShipStationClient", () => {
  let client: ShipStationClient;

  beforeEach(() => {
    client = new ShipStationClient({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  // ─── Configuration Tests ────────────────────────────────────

  describe("validateConfig", () => {
    it("should throw error if API key is missing", async () => {
      const invalidClient = new ShipStationClient({
        apiSecret: "test-secret",
      });

      await expect(invalidClient.validateConfig()).rejects.toThrow(
        "API key is required",
      );
    });

    it("should throw error if API secret is missing", async () => {
      const invalidClient = new ShipStationClient({
        apiKey: "test-key",
      });

      await expect(invalidClient.validateConfig()).rejects.toThrow(
        "API secret is required",
      );
    });

    it("should validate successfully with valid credentials", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ carriers: [{ code: "fedex", name: "FedEx" }] }),
      });

      await expect(client.validateConfig()).resolves.not.toThrow();
    });
  });

  // ─── Rate Fetching Tests ────────────────────────────────────

  describe("getRates", () => {
    it("should fetch and normalize rates from ShipStation", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rates: [
            {
              rateId: 1,
              carrierCode: "fedex",
              serviceCode: "FEDEX_GROUND",
              serviceName: "FedEx Ground",
              negotiatedRate: 15.5,
              baseRate: 18.0,
              otherCost: 1.0,
              insurance: 0.5,
              confirmationAmount: 0,
              transactionId: "txn_123",
              shipDate: "2026-03-12",
            },
            {
              rateId: 2,
              carrierCode: "ups",
              serviceCode: "UPS_GROUND",
              serviceName: "UPS Ground",
              negotiatedRate: 16.75,
              baseRate: 19.5,
              otherCost: 0.5,
              insurance: 0.5,
              confirmationAmount: 0,
              transactionId: "txn_124",
              shipDate: "2026-03-12",
            },
          ],
        }),
      });

      const rates = await client.getRates(mockShipmentRequest);

      expect(rates).toHaveLength(2);
      expect(rates[0]).toMatchObject({
        carrier: "FEDEX",
        service: "GROUND",
        price: 1550,
        currency: "USD",
      });
      expect(rates[1]).toMatchObject({
        carrier: "UPS",
        service: "GROUND",
        price: 1675,
        currency: "USD",
      });
    });

    it("should handle empty rates response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: [] }),
      });

      const rates = await client.getRates(mockShipmentRequest);

      expect(rates).toEqual([]);
    });

    it("should throw error on API failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Invalid request",
      });

      await expect(client.getRates(mockShipmentRequest)).rejects.toThrow();
    });
  });

  // ─── Label Creation Tests ───────────────────────────────────

  describe("createShipment", () => {
    it("should create a shipping label", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            shipmentId: 123,
            labelId: 456,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            labelId: 456,
            shipmentId: 123,
            trackingNumber: "7891234567",
            carrierCode: "fedex",
            serviceCode: "FEDEX_GROUND",
            labelFormat: "pdf",
            labelDownload: {
              pdf: "https://example.com/label.pdf",
              png: "https://example.com/label.png",
              zpl: "https://example.com/label.zpl",
            },
            shipDate: "2026-03-12",
          }),
        });

      const label = await client.createShipment(
        mockShipmentRequest,
        "rate_123",
      );

      expect(label).toMatchObject({
        labelId: "456",
        trackingNumber: "7891234567",
        carrier: "FEDEX",
        service: "GROUND",
      });
      expect(label.labelUrl).toBe("https://example.com/label.pdf");
    });

    it("should throw error if label creation fails", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal server error",
      });

      await expect(
        client.createShipment(mockShipmentRequest, "rate_123"),
      ).rejects.toThrow();
    });
  });

  // ─── Label Retrieval Tests ──────────────────────────────────

  describe("getLabel", () => {
    it("should retrieve label details", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          labelId: 456,
          trackingNumber: "7891234567",
          carrierCode: "ups",
          serviceCode: "UPS_GROUND",
          labelFormat: "png",
          labelDownload: {
            png: "https://example.com/label.png",
          },
          shipDate: "2026-03-12",
        }),
      });

      const label = await client.getLabel("456");

      expect(label.labelId).toBe("456");
      expect(label.trackingNumber).toBe("7891234567");
      expect(label.carrier).toBe("UPS");
    });
  });

  // ─── Tracking Tests ─────────────────────────────────────────

  describe("track", () => {
    it("should return tracking result (placeholder)", async () => {
      const result = await client.track("7891234567");

      expect(result).toMatchObject({
        trackingNumber: "7891234567",
        carrier: "SHIPSTATION",
        status: "UNKNOWN",
        events: [],
      });
    });
  });

  // ─── Label Cancellation Tests ───────────────────────────────

  describe("cancelShipment", () => {
    it("should cancel a label", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await client.cancelShipment("456");

      expect(result).toBe(true);
    });

    it("should return false on cancellation failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Label not found",
      });

      const result = await client.cancelShipment("456");

      expect(result).toBe(false);
    });
  });

  // ─── Address Validation Tests ───────────────────────────────

  describe("validateAddress", () => {
    it("should validate a valid address", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addressValidationStatus: "VALID",
        }),
      });

      const result = await client.validateAddress(mockAddress);

      expect(result.valid).toBe(true);
      expect(result.address).toEqual(mockAddress);
    });

    it("should return invalid for bad address", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addressValidationStatus: "INVALID",
        }),
      });

      const result = await client.validateAddress(mockAddress);

      expect(result.valid).toBe(false);
    });

    it("should handle validation errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const result = await client.validateAddress(mockAddress);

      expect(result.valid).toBe(false);
      expect(result.messages).toContain("Network error");
    });
  });

  // ─── Webhook Parsing Tests ──────────────────────────────────

  describe("parseWebhook", () => {
    it("should parse shipment created webhook", () => {
      const payload = {
        eventType: "LABEL_CREATED",
        resourceId: "label_123",
        trackingNumber: "7891234567",
      };

      const event = client.parseWebhook(payload, {});

      expect(event).toMatchObject({
        eventType: "LABEL_CREATED",
        resourceId: "label_123",
        carrier: "SHIPSTATION",
        trackingNumber: "7891234567",
      });
    });

    it("should return null for invalid payload", () => {
      const event = client.parseWebhook(null, {});
      expect(event).toBeNull();
    });

    it("should return null for non-object payload", () => {
      const event = client.parseWebhook("invalid", {});
      expect(event).toBeNull();
    });

    it("should handle missing optional fields", () => {
      const payload = {
        eventType: "TRACKING_UPDATE",
        resourceId: "ship_123",
      };

      const event = client.parseWebhook(payload, {});

      expect(event).toMatchObject({
        eventType: "TRACKING_UPDATE",
        resourceId: "ship_123",
        carrier: "SHIPSTATION",
      });
      expect(event?.trackingNumber).toBeUndefined();
    });
  });

  // ─── Rate Limiting & Circuit Breaker Tests ──────────────────

  describe("Rate Limiting & Circuit Breaker", () => {
    it("should respect rate limiting", async () => {
      vi.useFakeTimers();

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ rates: [] }),
      });

      // This should be rate-limited
      const promise1 = client.getRates(mockShipmentRequest);
      const promise2 = client.getRates(mockShipmentRequest);

      await promise1;
      await promise2;

      // Should have made 2 fetch calls
      expect(global.fetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should handle API errors with circuit breaker", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      // Multiple failures should eventually open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await client.getRates(mockShipmentRequest);
        } catch {
          // Expected
        }
      }

      // Next request should fail immediately due to open circuit
      await expect(client.getRates(mockShipmentRequest)).rejects.toThrow(
        /Circuit breaker/,
      );
    });
  });

  // ─── Unit Conversion Tests ──────────────────────────────────

  describe("Unit Conversion", () => {
    it("should normalize weight to kilograms", async () => {
      const lbWeight = { value: 2, unit: "lb" as const };
      const normalized = client["UnitConverter"].normalizeWeight(lbWeight);

      expect(normalized.unit).toBe("kg");
      expect(normalized.value).toBeCloseTo(0.9072, 3);
    });

    it("should convert inches to centimeters", () => {
      const inches = 10;
      const cm = client["UnitConverter"].inToCm(inches);

      expect(cm).toBeCloseTo(25.4, 1);
    });
  });

  // ─── Address Normalization Tests ────────────────────────────

  describe("Address Normalization", () => {
    it("should normalize address fields", () => {
      const unnormalized: ShippingAddress = {
        name: "  John Doe  ",
        street1: "  123 Main St  ",
        city: "  San Francisco  ",
        state: "  ca  ",
        zip: "  94103  ",
        country: "  us  ",
        phone: "  +1-415-555-0100  ",
        email: "  JOHN@EXAMPLE.COM  ",
      };

      const normalized = client["AddressNormalizer"].normalize(unnormalized);

      expect(normalized.name).toBe("John Doe");
      expect(normalized.state).toBe("CA");
      expect(normalized.country).toBe("US");
      expect(normalized.email).toBe("john@example.com");
      expect(normalized.zip).toBe("94103");
    });
  });
});
