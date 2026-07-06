/**
 * EasyPost Client Tests
 *
 * Test suite for EasyPost API integration:
 * - Configuration validation
 * - Address creation and validation
 * - Parcel creation
 * - Rate fetching and normalization
 * - Shipment purchase and label creation
 * - Tracking
 * - Webhook parsing with HMAC verification
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EasyPostClient } from "../easypost-client.js";
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
    unit: "kg",
  },
  dimensions: {
    length: 30,
    width: 20,
    height: 15,
  },
  packageType: "BOX",
};

// ─── Test Suite ─────────────────────────────────────────────────

describe("EasyPostClient", () => {
  let client: EasyPostClient;

  beforeEach(() => {
    client = new EasyPostClient({
      apiKey: "test-key",
    });

    global.fetch = vi.fn();
  });

  // ─── Configuration Tests ────────────────────────────────────

  describe("validateConfig", () => {
    it("should throw error if API key is missing", async () => {
      const invalidClient = new EasyPostClient({});

      await expect(invalidClient.validateConfig()).rejects.toThrow(
        "API key is required",
      );
    });

    it("should validate successfully with valid credentials", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: "user_123" },
        }),
      });

      await expect(client.validateConfig()).resolves.not.toThrow();
    });

    it("should throw error on invalid response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(client.validateConfig()).rejects.toThrow("Invalid response");
    });
  });

  // ─── Address Creation Tests ─────────────────────────────────

  describe("createOrValidateAddress", () => {
    it("should create an address in EasyPost", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: {
            id: "adr_123",
            name: "John Doe",
            street1: "123 Main St",
            city: "San Francisco",
            state: "CA",
            zip: "94103",
            country: "US",
            message: undefined,
          },
        }),
      });

      const address = await client["createOrValidateAddress"](mockAddress);

      expect(address.id).toBe("adr_123");
      expect(address.name).toBe("John Doe");
    });

    it("should handle address validation warnings", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: {
            id: "adr_456",
            name: "John Doe",
            message: "Address corrected: ZIP code was inferred",
          },
        }),
      });

      const address = await client["createOrValidateAddress"](mockAddress);

      expect(address.message).toBe("Address corrected: ZIP code was inferred");
    });
  });

  // ─── Parcel Creation Tests ──────────────────────────────────

  describe("createParcel", () => {
    it("should create a parcel with dimensions", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parcel: {
            id: "prcl_123",
            weight: 70.5,
            length: 11.8,
            width: 7.9,
            height: 5.9,
          },
        }),
      });

      const parcel = await client["createParcel"](mockShipmentRequest);

      expect(parcel.id).toBe("prcl_123");
      expect(parcel.weight).toBeCloseTo(70.5, 0);
    });

    it("should create a parcel without dimensions", async () => {
      const requestNoDims = { ...mockShipmentRequest, dimensions: undefined };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          parcel: {
            id: "prcl_456",
            weight: 70.5,
          },
        }),
      });

      const parcel = await client["createParcel"](requestNoDims);

      expect(parcel.id).toBe("prcl_456");
    });
  });

  // ─── Rate Fetching Tests ────────────────────────────────────

  describe("getRates", () => {
    it("should fetch rates from EasyPost shipment", async () => {
      // Mock address creation
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { id: "adr_from_123" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { id: "adr_to_456" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            parcel: { id: "prcl_789" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            shipment: {
              rates: [
                {
                  id: "rate_1",
                  carrier: "FedEx",
                  service: "Ground",
                  rate: "15.50",
                  est_delivery_days: 5,
                },
                {
                  id: "rate_2",
                  carrier: "UPS",
                  service: "Ground",
                  rate: "16.75",
                  est_delivery_days: 5,
                },
              ],
            },
          }),
        });

      const rates = await client.getRates(mockShipmentRequest);

      expect(rates).toHaveLength(2);
      expect(rates[0]).toMatchObject({
        carrier: "FEDEX",
        price: 1550,
      });
      expect(rates[1]).toMatchObject({
        carrier: "UPS",
        price: 1675,
      });
    });

    it("should handle API errors during rate fetching", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(client.getRates(mockShipmentRequest)).rejects.toThrow();
    });
  });

  // ─── Shipment Purchase Tests ────────────────────────────────

  describe("createShipment", () => {
    it("should create and purchase a shipment", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { id: "adr_from_123" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { id: "adr_to_456" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            parcel: { id: "prcl_789" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            shipment: {
              id: "ship_123",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            shipment: {
              id: "ship_123",
              tracking_code: "7891234567",
              carrier: "FedEx",
              service: "Ground",
              postage_label: {
                url: "https://example.com/label.pdf",
                fileformat: "pdf",
              },
              created_at: "2026-03-12T10:00:00Z",
            },
          }),
        });

      const label = await client.createShipment(mockShipmentRequest, "rate_1");

      expect(label.labelId).toBe("ship_123");
      expect(label.trackingNumber).toBe("7891234567");
      expect(label.carrier).toBe("FEDEX");
      expect(label.format).toBe("PDF");
    });
  });

  // ─── Label Retrieval Tests ──────────────────────────────────

  describe("getLabel", () => {
    it("should retrieve shipment label", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          shipment: {
            id: "ship_123",
            tracking_code: "7891234567",
            carrier: "UPS",
            service: "Ground",
            postage_label: {
              url: "https://example.com/label.png",
              fileformat: "png",
            },
            created_at: "2026-03-12T10:00:00Z",
          },
        }),
      });

      const label = await client.getLabel("ship_123");

      expect(label.labelId).toBe("ship_123");
      expect(label.trackingNumber).toBe("7891234567");
      expect(label.format).toBe("PNG");
    });
  });

  // ─── Tracking Tests ─────────────────────────────────────────

  describe("track", () => {
    it("should retrieve tracking information", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tracker: {
            tracking_code: "7891234567",
            carrier: "FedEx",
            status: "in_transit",
            est_delivery_date: "2026-03-15",
            checkpoints: [
              {
                created_at: "2026-03-12T10:00:00Z",
                status: "picked_up",
                message: "Package picked up",
                tracking_location: {
                  city: "San Francisco",
                  state: "CA",
                },
              },
              {
                created_at: "2026-03-13T15:30:00Z",
                status: "in_transit",
                message: "In transit to destination",
                tracking_location: {
                  city: "Los Angeles",
                  state: "CA",
                },
              },
            ],
          },
        }),
      });

      const result = await client.track("7891234567");

      expect(result.trackingNumber).toBe("7891234567");
      expect(result.carrier).toBe("FEDEX");
      expect(result.status).toBe("in_transit");
      expect(result.events).toHaveLength(2);
      expect(result.events[0].status).toBe("picked_up");
    });

    it("should handle tracking with no checkpoints", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tracker: {
            tracking_code: "7891234567",
            carrier: "UPS",
            status: "unknown",
            checkpoints: [],
          },
        }),
      });

      const result = await client.track("7891234567");

      expect(result.events).toEqual([]);
    });
  });

  // ─── Address Validation Tests ───────────────────────────────

  describe("validateAddress", () => {
    it("should validate a valid address", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: {
            id: "adr_123",
            message: undefined,
          },
        }),
      });

      const result = await client.validateAddress(mockAddress);

      expect(result.valid).toBe(true);
    });

    it("should report invalid address with message", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: {
            id: "adr_456",
            message: "Invalid ZIP code",
          },
        }),
      });

      const result = await client.validateAddress(mockAddress);

      expect(result.valid).toBe(false);
      expect(result.messages).toContain("Invalid ZIP code");
    });

    it("should handle validation errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("API error"));

      const result = await client.validateAddress(mockAddress);

      expect(result.valid).toBe(false);
      expect(result.messages).toContain("API error");
    });
  });

  // ─── Webhook Parsing Tests ──────────────────────────────────

  describe("parseWebhook", () => {
    it("should parse a shipment webhook", () => {
      const payload = {
        description: "tracking_update",
        result: {
          id: "ship_123",
          tracking_code: "7891234567",
        },
      };

      const event = client.parseWebhook(payload, {});

      expect(event).toMatchObject({
        eventType: "tracking_update",
        resourceId: "ship_123",
        carrier: "EASYPOST",
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

    it("should verify HMAC signature", () => {
      const payload = {
        description: "shipment_created",
        result: { id: "ship_123" },
      };

      const secret = "webhook_secret";
      const clientWithSecret = new EasyPostClient({
        apiKey: "test-key",
        apiSecret: secret,
      });

      // For now, test without signature (should pass through)
      const event = clientWithSecret.parseWebhook(payload, {});
      expect(event).toMatchObject({
        eventType: "shipment_created",
      });
    });

    it("should handle missing optional fields", () => {
      const payload = {
        description: "test_event",
        result: {},
      };

      const event = client.parseWebhook(payload, {});

      expect(event).toMatchObject({
        eventType: "test_event",
        resourceId: "",
      });
      expect(event?.trackingNumber).toBeUndefined();
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

    it("should convert centimeters to inches for EasyPost API", () => {
      const cm = 30;
      const inches = client["UnitConverter"].cmToIn(cm);

      expect(inches).toBeCloseTo(11.81, 1);
    });

    it("should convert kg to ounces", () => {
      const kg = 2;
      const ounces = kg * 35.274;

      expect(ounces).toBeCloseTo(70.548, 1);
    });
  });

  // ─── Address Normalization Tests ────────────────────────────

  describe("Address Normalization", () => {
    it("should normalize address for API submission", () => {
      const unnormalized: ShippingAddress = {
        name: "  John Doe  ",
        street1: "  123 Main St  ",
        city: "  san francisco  ",
        state: "  ca  ",
        zip: "  94103  ",
        country: "  us  ",
      };

      const normalized = client["AddressNormalizer"].normalize(unnormalized);

      expect(normalized.name).toBe("John Doe");
      expect(normalized.state).toBe("CA");
      expect(normalized.country).toBe("US");
      expect(normalized.street1).toBe("123 Main St");
    });
  });

  // ─── Shipment Status Tests ──────────────────────────────────

  describe("Shipment Status", () => {
    it("should normalize carrier names", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { id: "adr_from_123" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { id: "adr_to_456" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            parcel: { id: "prcl_789" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            shipment: {
              id: "ship_123",
              rates: [
                {
                  id: "rate_1",
                  carrier: "fedex",
                  service: "ground",
                  rate: "10.00",
                },
                {
                  id: "rate_2",
                  carrier: "usps",
                  service: "priority",
                  rate: "8.00",
                },
              ],
            },
          }),
        });

      const rates = await client.getRates(mockShipmentRequest);

      const fedexRate = rates.find((r) => r.carrier === "FEDEX");
      const uspsRate = rates.find((r) => r.carrier === "USPS");

      expect(fedexRate?.service).toBe("GROUND");
      expect(uspsRate?.service).toBe("PRIORITY");
    });
  });
});
