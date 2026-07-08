/**
 * FedEx Carrier Adapter Tests
 * Comprehensive test suite for FedEx shipping adapter
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FedExAdapter } from "../fedex";
import { CarrierError } from "../../types";

describe("FedExAdapter", () => {
  let adapter: FedExAdapter;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    adapter = new FedExAdapter(
      "fedex-client-id-12345",
      "fedex-client-secret-67890",
      "123456789",
      "1234567890",
      "https://apis.fedex.com",
    );
  });

  describe("OAuth2 Token Flow", () => {
    it("should obtain access token via OAuth2 client credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: "fedex-access-token-12345",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "shipping",
        }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          output: {
            rateReplyDetails: [
              {
                ratedShipmentDetails: [
                  {
                    serviceType: "FEDEX_GROUND",
                    totalNetCharge: "22.50",
                    totalBaseCharge: "20.00",
                    currency: "USD",
                    surcharges: [],
                  },
                ],
              },
            ],
          },
        }),
      });

      await adapter.getRates({
        origin: {
          name: "Shipper",
          street1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90001",
          country: "US",
        },
        destination: {
          name: "Recipient",
          street1: "456 Oak Ave",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        packages: [{ weight: 5, weightUnit: "lb" }],
        shipDate: new Date().toISOString().split("T")[0],
      });

      const tokenCall = mockFetch.mock.calls[0];
      expect(tokenCall[0]).toBe("https://apis.fedex.com/oauth/token");
      expect(tokenCall[1].method).toBe("POST");
      expect(tokenCall[1].headers["Content-Type"]).toBe(
        "application/x-www-form-urlencoded",
      );
    });

    it("should cache access token and reuse within expiry", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: "cached-token",
          expires_in: 3600,
        }),
      });

      const rateReply = {
        output: {
          rateReplyDetails: [
            {
              ratedShipmentDetails: [
                {
                  serviceType: "FEDEX_GROUND",
                  totalNetCharge: "22.50",
                  totalBaseCharge: "20.00",
                  currency: "USD",
                  surcharges: [],
                },
              ],
            },
          ],
        },
      };

      // First rate request
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce(rateReply),
      });

      // Second rate request - should reuse token
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce(rateReply),
      });

      const request = {
        origin: {
          name: "Shipper",
          street1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90001",
          country: "US",
        },
        destination: {
          name: "Recipient",
          street1: "456 Oak Ave",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        packages: [{ weight: 5, weightUnit: "lb" }],
        shipDate: new Date().toISOString().split("T")[0],
      };

      await adapter.getRates(request);
      await adapter.getRates(request);

      // Should have 3 calls: token + 2 rate requests (no second token exchange)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should handle OAuth2 token request failures", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        statusText: "Unauthorized",
      });

      const request = {
        origin: {
          name: "Shipper",
          street1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90001",
          country: "US",
        },
        destination: {
          name: "Recipient",
          street1: "456 Oak Ave",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        packages: [{ weight: 5, weightUnit: "lb" }],
        shipDate: new Date().toISOString().split("T")[0],
      };

      await expect(adapter.getRates(request)).rejects.toThrow(CarrierError);
    });
  });

  describe("getRates()", () => {
    beforeEach(() => {
      // Mock successful token response
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: "token-123",
          expires_in: 3600,
        }),
      });
    });

    it("should parse rate response correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          output: {
            rateReplyDetails: [
              {
                ratedShipmentDetails: [
                  {
                    serviceType: "FEDEX_GROUND",
                    totalNetCharge: "22.50",
                    totalBaseCharge: "20.00",
                    currency: "USD",
                    surcharges: [
                      {
                        description: "Fuel",
                        amount: "2.50",
                      },
                    ],
                  },
                  {
                    serviceType: "FEDEX_2_DAY",
                    totalNetCharge: "35.75",
                    totalBaseCharge: "32.00",
                    currency: "USD",
                    surcharges: [],
                  },
                ],
              },
            ],
          },
        }),
      });

      const rates = await adapter.getRates({
        origin: {
          name: "Shipper",
          street1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90001",
          country: "US",
        },
        destination: {
          name: "Recipient",
          street1: "456 Oak Ave",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        packages: [{ weight: 5, weightUnit: "lb" }],
        shipDate: "2024-03-15",
      });

      expect(rates).toHaveLength(2);
      expect(rates[0]).toEqual(
        expect.objectContaining({
          carrier: "FedEx",
          service: "FedEx Ground",
          serviceCode: "FEDEX_GROUND",
          totalCharge: 22.5,
          currency: "USD",
          estimatedTransitDays: 5,
          breakdown: expect.arrayContaining([
            expect.objectContaining({ description: "Base Rate", amount: 20.0 }),
            expect.objectContaining({ description: "Fuel", amount: 2.5 }),
          ]),
        }),
      );
    });

    it("should handle rate error response (4xx/5xx)", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          errors: [{ message: "Invalid address" }],
        }),
      });

      await expect(
        adapter.getRates({
          origin: {
            name: "Shipper",
            street1: "123 Main St",
            city: "Los Angeles",
            state: "CA",
            postalCode: "90001",
            country: "US",
          },
          destination: {
            name: "Recipient",
            street1: "456 Oak Ave",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "US",
          },
          packages: [{ weight: 5, weightUnit: "lb" }],
          shipDate: new Date().toISOString().split("T")[0],
        }),
      ).rejects.toThrow("Invalid address");
    });
  });

  describe("createLabel()", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: "token-123",
          expires_in: 3600,
        }),
      });
    });

    it("should create shipping label with base64 PDF", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          output: {
            transactionShipments: [
              {
                masterTrackingNumber: "TRK123456789",
                pieceResponses: [
                  {
                    trackingNumber: "PIECE123456789",
                    label: {
                      parts: [
                        {
                          image: "JVBERi0xLjQK...base64encodedPDF...",
                        },
                      ],
                    },
                  },
                ],
                shipmentRating: {
                  shipmentRateDetails: [
                    {
                      totalNetCharge: "22.50",
                    },
                  ],
                },
              },
            ],
          },
        }),
      });

      const label = await adapter.createLabel({
        origin: {
          name: "Shipper",
          street1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90001",
          country: "US",
          phone: "5551234567",
          email: "shipper@example.com",
        },
        destination: {
          name: "Recipient",
          street1: "456 Oak Ave",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        packages: [
          {
            weight: 5,
            weightUnit: "lb",
            length: 12,
            width: 8,
            height: 6,
            dimensionUnit: "in",
          },
        ],
        serviceCode: "FEDEX_GROUND",
        shipDate: new Date().toISOString().split("T")[0],
      });

      expect(label).toEqual(
        expect.objectContaining({
          trackingNumber: "TRK123456789",
          carrier: "FedEx",
          service: expect.any(String),
          labelData: expect.any(String),
          labelFormat: "PDF",
          cost: 22.5,
          currency: "USD",
        }),
      );
    });

    it("should handle label creation error", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          errors: [{ message: "Invalid recipient address" }],
        }),
      });

      await expect(
        adapter.createLabel({
          origin: {
            name: "Shipper",
            street1: "123 Main St",
            city: "Los Angeles",
            state: "CA",
            postalCode: "90001",
            country: "US",
          },
          destination: {
            name: "Recipient",
            street1: "456 Oak Ave",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "US",
          },
          packages: [{ weight: 5, weightUnit: "lb" }],
          serviceCode: "FEDEX_GROUND",
        }),
      ).rejects.toThrow(CarrierError);
    });
  });

  describe("voidLabel()", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: "token-123",
          expires_in: 3600,
        }),
      });
    });

    it("should void shipment successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      const result = await adapter.voidLabel("TRK123456789");

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          trackingNumber: "TRK123456789",
          refund: expect.any(Number),
          currency: "USD",
          voidedAt: expect.any(Date),
        }),
      );
    });

    it("should reject invalid tracking number", async () => {
      await expect(adapter.voidLabel("INVALID")).rejects.toThrow(CarrierError);
      await expect(adapter.voidLabel("")).rejects.toThrow(CarrierError);
    });
  });

  describe("getTracking()", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: "token-123",
          expires_in: 3600,
        }),
      });
    });

    it("should retrieve tracking with scan events", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          output: {
            completeTrackResults: [
              {
                trackingInfo: [
                  {
                    status: "IN_TRANSIT",
                    estimatedDeliveryDate: new Date(
                      Date.now() + 3 * 24 * 60 * 60 * 1000,
                    ).toISOString(),
                    scanEvents: [
                      {
                        date: new Date().toISOString(),
                        eventType: "IN_TRANSIT",
                        eventDescription: "Package in transit",
                        location: {
                          city: "Memphis",
                          stateOrProvinceCode: "TN",
                          countryCode: "US",
                          postalCode: "38101",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
      });

      const tracking = await adapter.getTracking("TRK123456789");

      expect(tracking).toEqual(
        expect.objectContaining({
          carrier: "FedEx",
          trackingNumber: "TRK123456789",
          status: expect.any(String),
          delivered: expect.any(Boolean),
          events: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(Date),
              status: expect.any(String),
              description: expect.any(String),
              location: expect.objectContaining({
                city: expect.any(String),
                state: expect.any(String),
                country: expect.any(String),
              }),
            }),
          ]),
          estimatedDeliveryDate: expect.any(Date),
        }),
      );
    });

    it("should reject invalid tracking number", async () => {
      await expect(adapter.getTracking("INVALID")).rejects.toThrow(
        CarrierError,
      );
      await expect(adapter.getTracking("")).rejects.toThrow(CarrierError);
    });
  });

  describe("schedulePickup()", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: "token-123",
          expires_in: 3600,
        }),
      });
    });

    it("should schedule pickup successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          output: { pickupConfirmationCode: "PICKUP-123" },
        }),
      });

      const pickup = await adapter.schedulePickup({
        location: {
          name: "Warehouse",
          street1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90001",
          country: "US",
          phone: "5551234567",
        },
        pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timeWindow: {
          openTime: "09:00",
          closeTime: "17:00",
        },
        packageCount: 5,
        totalWeight: 25,
      });

      expect(pickup).toEqual(
        expect.objectContaining({
          pickupId: expect.any(String),
          pickupDate: expect.any(Date),
          location: expect.objectContaining({
            name: "Warehouse",
          }),
          confirmedAt: expect.any(Date),
          confirmationCode: expect.stringContaining("FX-"),
          driverInfo: expect.objectContaining({
            name: expect.any(String),
            phone: expect.any(String),
          }),
        }),
      );
    });

    it("should handle pickup scheduling errors", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        ok: false,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          errors: [{ message: "Invalid address" }],
        }),
      });

      await expect(
        adapter.schedulePickup({
          location: {
            name: "Warehouse",
            street1: "123 Main St",
            city: "Los Angeles",
            state: "CA",
            postalCode: "90001",
            country: "US",
          },
          pickupDate: new Date(),
        }),
      ).rejects.toThrow(CarrierError);
    });
  });

  describe("validateAddress()", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          access_token: "token-123",
          expires_in: 3600,
        }),
      });
    });

    it("should validate address successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Map(),
        json: vi.fn().mockResolvedValueOnce({
          output: {
            resolvedAddresses: [
              {
                status: "MATCHED",
                address: {
                  streetLines: ["123 Main St"],
                  city: "Los Angeles",
                  stateOrProvinceCode: "CA",
                  postalCode: "90001",
                  countryCode: "US",
                  residential: false,
                },
              },
            ],
          },
        }),
      });

      const result = await adapter.validateAddress({
        name: "John Doe",
        street1: "123 Main St",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90001",
        country: "US",
      });

      expect(result).toEqual(
        expect.objectContaining({
          valid: expect.any(Boolean),
          address: expect.objectContaining({
            name: expect.any(String),
            street1: expect.any(String),
            city: expect.any(String),
            state: expect.any(String),
            postalCode: expect.any(String),
            country: expect.any(String),
          }),
        }),
      );
    });

    it("should reject incomplete addresses", async () => {
      await expect(
        adapter.validateAddress({
          name: "John",
          street1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          postalCode: "",
          country: "US",
        }),
      ).rejects.toThrow(CarrierError);
    });
  });

  describe("adapter properties", () => {
    it("should have correct name", () => {
      expect(adapter.name).toBe("FedEx");
    });

    it("should have correct carrier code", () => {
      expect(adapter.code).toBe("fedex");
    });
  });
});
