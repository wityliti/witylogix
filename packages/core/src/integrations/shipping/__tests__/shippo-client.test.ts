/**
 * Shippo Client Tests
 *
 * Tests for:
 * - Shipment creation and rate shopping
 * - Label purchase and download
 * - Tracking information retrieval
 * - Address validation and standardization
 * - Batch label creation
 * - Webhook event handling
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ShippoClient } from "../shippo-client.js";
import type { ShippingConfig, ShipmentRequest, ShippingAddress } from "../types.js";

describe("ShippoClient", () => {
  let client: ShippoClient;
  let config: ShippingConfig;

  beforeEach(() => {
    config = {
      apiKey: "shippo_test_token_123",
    };

    client = new ShippoClient(config);
  });

  describe("initialization", () => {
    it("should initialize with valid API token", () => {
      expect(client).toBeDefined();
    });

    it("should throw error if API token is missing", () => {
      const invalidConfig: ShippingConfig = { apiKey: "" };

      expect(() => new ShippoClient(invalidConfig)).toThrow(
        "Shippo API token is required"
      );
    });
  });

  describe("shipment creation and rates", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockClear();
    });

    it("should create shipment and get rates", async () => {
      const mockShipment = {
        object_id: "shipment_123",
        status: "queued",
        address_from: {
          object_id: "addr_from_1",
          name: "John Sender",
          street1: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip: "94105",
          country: "US",
        },
        address_to: {
          object_id: "addr_to_1",
          name: "Jane Receiver",
          street1: "456 Oak Ave",
          city: "Los Angeles",
          state: "CA",
          zip: "90001",
          country: "US",
        },
        parcels: [
          {
            object_id: "parcel_1",
            weight: "2.5",
            width: "10",
            height: "8",
            length: "6",
            distance_unit: "cm",
            weight_unit: "kg",
          },
        ],
        shipment_date: "2026-03-12T00:00:00Z",
      };

      const mockRates = {
        results: [
          {
            object_id: "rate_123",
            shipment: "shipment_123",
            carrier_account: "ca_123",
            carrier: "usps",
            servicelevel: { name: "Priority Mail", token: "priority" },
            rate: "15.50",
            currency: "USD",
            list_rate: "15.50",
            list_currency: "USD",
            provider: "USPS",
            estimated_days: 2,
            arrives_by: "2026-03-14T23:59:59Z",
            duration_terms: "2 days",
            messages: [],
            test: false,
          },
          {
            object_id: "rate_124",
            shipment: "shipment_123",
            carrier_account: "ca_124",
            carrier: "ups",
            servicelevel: { name: "UPS Ground", token: "ground" },
            rate: "18.75",
            currency: "USD",
            list_rate: "18.75",
            list_currency: "USD",
            provider: "UPS",
            estimated_days: 3,
            arrives_by: "2026-03-15T23:59:59Z",
            duration_terms: "3 days",
            messages: [],
            test: false,
          },
        ],
      };

      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockShipment), { status: 201 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockRates), { status: 200 })
        );

      const shipment: ShipmentRequest = {
        fromAddress: {
          name: "John Sender",
          street1: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip: "94105",
          country: "US",
        },
        toAddress: {
          name: "Jane Receiver",
          street1: "456 Oak Ave",
          city: "Los Angeles",
          state: "CA",
          zip: "90001",
          country: "US",
        },
        parcels: [
          {
            weight: { value: 5.5, unit: "lb" },
            dimensions: { length: 6, width: 10, height: 8 },
          },
        ],
      };

      const rates = await client.createShipment(shipment);

      expect(rates).toHaveLength(2);
      expect(rates[0].carrier).toBe("usps");
      expect(rates[0].service).toBe("Priority Mail");
      expect(parseFloat(rates[0].rate.toString())).toBe(15.5);
      expect(rates[1].carrier).toBe("ups");
    });

    it("should include metadata in shipment creation", async () => {
      const mockShipment = {
        object_id: "shipment_meta",
        status: "queued",
        parcels: [],
      };

      const mockRates = { results: [] };

      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockShipment), { status: 201 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockRates), { status: 200 })
        );

      const shipment: ShipmentRequest = {
        fromAddress: {
          name: "Sender",
          street1: "123 Main",
          city: "SF",
          state: "CA",
          zip: "94105",
          country: "US",
        },
        toAddress: {
          name: "Receiver",
          street1: "456 Oak",
          city: "LA",
          state: "CA",
          zip: "90001",
          country: "US",
        },
        parcels: [],
        metadata: { orderId: "order_123", reference: "REF123" },
      };

      const rates = await client.createShipment(shipment);

      expect(rates).toBeDefined();
    });
  });

  describe("label purchase", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockClear();
    });

    it("should purchase label and return tracking number", async () => {
      const mockTransaction = {
        object_id: "transaction_123",
        rate: "rate_123",
        tracking_number: "1234567890",
        tracking_status: {
          status: "unknown",
          status_date: "2026-03-12T10:00:00Z",
          status_details: "Shipping label created",
        },
        label_download: {
          pdf: "https://shippo-delivery.s3.amazonaws.com/xxx.pdf",
          png: "https://shippo-delivery.s3.amazonaws.com/xxx.png",
          zpl: "https://shippo-delivery.s3.amazonaws.com/xxx.zpl",
        },
        commercial_invoice_url: "",
        test: false,
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockTransaction), { status: 201 })
      );

      const label = await client.purchaseLabel("rate_123", "PDF");

      expect(label.id).toBe("transaction_123");
      expect(label.trackingNumber).toBe("1234567890");
      expect(label.label).toContain("shippo-delivery");
      expect(label.labelFormat).toBe("PDF");
    });

    it("should support different label formats", async () => {
      const mockTransaction = {
        object_id: "txn_zpl",
        tracking_number: "9876543210",
        tracking_status: {
          status: "unknown",
          status_date: "2026-03-12T10:00:00Z",
          status_details: "Label created",
        },
        label_download: {
          pdf: "https://example.com/label.pdf",
          png: "https://example.com/label.png",
          zpl: "https://example.com/label.zpl",
        },
        test: false,
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockTransaction), { status: 201 })
      );

      const labelZPL = await client.purchaseLabel("rate_123", "ZPL");

      expect(labelZPL.labelFormat).toBe("ZPL");
    });

    it("should throw error if label download fails", async () => {
      const mockTransaction = {
        object_id: "txn_fail",
        tracking_number: "0000000000",
        tracking_status: {
          status: "unknown",
          status_date: "2026-03-12T10:00:00Z",
          status_details: "Failed",
        },
        label_download: null,
        test: false,
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockTransaction), { status: 201 })
      );

      await expect(client.purchaseLabel("rate_123")).rejects.toThrow(
        "Failed to generate label"
      );
    });
  });

  describe("tracking", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockClear();
    });

    it("should retrieve tracking information", async () => {
      const mockTrack = {
        carrier: "usps",
        tracking_number: "9400111111111111111111",
        status: "delivered",
        eta: "2026-03-14T23:59:59Z",
        servicelevel: { name: "Priority Mail", token: "priority" },
        address_from: {
          object_id: "addr_from",
          city: "San Francisco",
          state: "CA",
          zip: "94105",
          country: "US",
        },
        address_to: {
          object_id: "addr_to",
          city: "Los Angeles",
          state: "CA",
          zip: "90001",
          country: "US",
        },
        tracking_history: [
          {
            status: "delivered",
            status_date: "2026-03-14T18:00:00Z",
            status_details: "Package delivered",
            location: {
              city: "Los Angeles",
              state: "CA",
              zip: "90001",
              country: "US",
            },
          },
          {
            status: "in_transit",
            status_date: "2026-03-13T10:00:00Z",
            status_details: "Package in transit",
            location: {
              city: "Phoenix",
              state: "AZ",
              zip: "85001",
              country: "US",
            },
          },
        ],
        test: false,
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockTrack), { status: 200 })
      );

      const tracking = await client.getTracking("usps", "9400111111111111111111");

      expect(tracking.trackingNumber).toBe("9400111111111111111111");
      expect(tracking.status).toBe("delivered");
      expect(tracking.carrier).toBe("usps");
      expect(tracking.events).toHaveLength(2);
      expect(tracking.events[0].status).toBe("delivered");
    });

    it("should map tracking statuses", async () => {
      const mockTrack = {
        carrier: "fedex",
        tracking_number: "794643794398",
        status: "transit",
        eta: "2026-03-15T23:59:59Z",
        servicelevel: { name: "FedEx Ground", token: "ground" },
        tracking_history: [
          {
            status: "transit",
            status_date: "2026-03-13T10:00:00Z",
            status_details: "In transit",
            location: {
              city: "Memphis",
              state: "TN",
              zip: "38101",
              country: "US",
            },
          },
        ],
        test: false,
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockTrack), { status: 200 })
      );

      const tracking = await client.getTracking("fedex", "794643794398");

      expect(tracking.status).toBe("in_transit");
    });
  });

  describe("address validation", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockClear();
    });

    it("should validate correct address", async () => {
      const mockValidated = {
        object_id: "addr_validated",
        name: "John Doe",
        street1: "123 Main St",
        street2: "",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        country: "US",
        phone: "4155551234",
        email: "john@example.com",
        is_residential: true,
        validation_results: {
          is_valid: true,
          messages: [],
        },
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockValidated), { status: 201 })
      );

      const address: ShippingAddress = {
        name: "John Doe",
        street1: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        country: "US",
      };

      const result = await client.validateAddress(address);

      expect(result.valid).toBe(true);
      expect(result.address).toBeDefined();
    });

    it("should return validation errors for invalid address", async () => {
      const mockValidated = {
        object_id: "addr_invalid",
        name: "Bad Address",
        street1: "Invalid St",
        city: "Nowhere",
        state: "XX",
        zip: "00000",
        country: "US",
        is_residential: false,
        validation_results: {
          is_valid: false,
          messages: [
            { text: "City/State/ZIP do not match", code: "CITY_STATE_ZIP_MISMATCH" },
          ],
        },
      };

      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockValidated), { status: 201 })
      );

      const address: ShippingAddress = {
        name: "Bad Address",
        street1: "Invalid St",
        city: "Nowhere",
        state: "XX",
        zip: "00000",
        country: "US",
      };

      const result = await client.validateAddress(address);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("batch label creation", () => {
    beforeEach(() => {
      vi.spyOn(global, "fetch").mockClear();
    });

    it("should create multiple labels", async () => {
      const mockShipment1 = { object_id: "ship_1", status: "queued", parcels: [] };
      const mockShipment2 = { object_id: "ship_2", status: "queued", parcels: [] };

      const mockRates1 = { results: [{ object_id: "rate_1", carrier: "USPS", servicelevel: { name: "Priority" }, rate: "5.00", currency: "USD", estimated_days: 3 }] };
      const mockRates2 = { results: [{ object_id: "rate_2", carrier: "USPS", servicelevel: { name: "Priority" }, rate: "6.00", currency: "USD", estimated_days: 3 }] };

      const mockTxn1 = {
        object_id: "txn_1",
        tracking_number: "1111111111",
        label_download: { pdf: "https://example.com/1.pdf" },
      };
      const mockTxn2 = {
        object_id: "txn_2",
        tracking_number: "2222222222",
        label_download: { pdf: "https://example.com/2.pdf" },
      };

      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockShipment1), { status: 201 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockRates1), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockTxn1), { status: 201 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockShipment2), { status: 201 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockRates2), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockTxn2), { status: 201 })
        );

      const shipments: ShipmentRequest[] = [
        {
          fromAddress: {
            name: "From 1",
            street1: "123 Main",
            city: "SF",
            state: "CA",
            zip: "94105",
            country: "US",
          },
          toAddress: {
            name: "To 1",
            street1: "456 Oak",
            city: "LA",
            state: "CA",
            zip: "90001",
            country: "US",
          },
          parcels: [{ weight: { value: 1, unit: "lb" } }],
        },
        {
          fromAddress: {
            name: "From 2",
            street1: "789 Pine",
            city: "SF",
            state: "CA",
            zip: "94105",
            country: "US",
          },
          toAddress: {
            name: "To 2",
            street1: "321 Elm",
            city: "SD",
            state: "CA",
            zip: "92101",
            country: "US",
          },
          parcels: [{ weight: { value: 2, unit: "lb" } }],
        },
      ];

      const labels = await client.createBatchLabels(shipments, "PDF");

      expect(labels).toHaveLength(2);
      expect(labels[0].trackingNumber).toBe("1111111111");
      expect(labels[1].trackingNumber).toBe("2222222222");
    });
  });

  describe("webhooks", () => {
    it("should handle tracking update webhook", async () => {
      const event = {
        type: "track_updated" as const,
        data: {
          tracking_number: "9400111111111111111111",
          status: "delivered",
        },
      };

      await expect(client.handleWebhook(event)).resolves.not.toThrow();
    });

    it("should handle transaction webhook", async () => {
      const event = {
        type: "transaction_created" as const,
        data: {
          tracking_number: "1234567890",
          label_download: { pdf: "https://example.com/label.pdf" },
        },
      };

      await expect(client.handleWebhook(event)).resolves.not.toThrow();
    });
  });

  describe("health check", () => {
    it("should return true if API is healthy", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [] }), { status: 200 })
      );

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it("should return false if API is unhealthy", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Connection timeout")
      );

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});
