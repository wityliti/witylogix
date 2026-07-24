/**
 * EasyPost SDK Client Test Suite
 *
 * Tests for full shipping lifecycle functionality:
 * - Address verification
 * - Shipment creation + rate fetching
 * - Label purchase + format conversion
 * - Tracking webhook verification
 * - Batch operations
 * - Rate limiting behavior
 * - Error mapping
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EasyPostSdkClient } from "../easypost-sdk-client";
import type { EasyPostSdkConfig } from "../easypost-sdk-client";
import type { IIntegrationGateway } from "../easypost-sdk-client";

// ─── Test Fixtures ──────────────────────────────────────────────────────

const mockConfig: EasyPostSdkConfig = {
  apiKey: "sk_test_" + "FAKE0123456789".padEnd(20, "x"),
  webhookSecret: "webhook_secret_test",
  testMode: true,
  timeoutMs: 5000,
  maxRetries: 2,
};

const mockGateway: IIntegrationGateway = {
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  getRateLimitStatus: vi.fn(),
};

const mockAddress = {
  id: "adr_test123",
  object: "address" as const,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  name: "John Doe",
  street1: "123 Main St",
  city: "New York",
  state: "NY",
  zip: "10001",
  country: "US",
  mode: "test" as const,
  residential: false,
};

const mockParcel = {
  id: "prcl_test123",
  object: "parcel" as const,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  weight: 16,
  length: 12,
  width: 8,
  height: 6,
  mode: "test" as const,
};

const mockRate = {
  id: "rate_test123",
  object: "rate" as const,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  mode: "test" as const,
  service: "Ground",
  carrier: "ups",
  rate: "15.50",
  currency: "USD",
  est_delivery_days: 5,
};

const mockShipment = {
  id: "shp_test123",
  object: "shipment" as const,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  mode: "test" as const,
  tracking_code: "TRACK123456789",
  status: "purchased",
  carrier: "ups",
  service: "Ground",
  rate: mockRate,
  rates: [mockRate],
  to_address: mockAddress,
  from_address: mockAddress,
  parcel: mockParcel,
  postage_label: {
    id: "label_test123",
    object: "PostageLabel" as const,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    type: "return",
    url: "https://easypost.com/label.pdf",
    filename: "label.pdf",
    fileformat: "pdf" as const,
    carrier_barcode_ability: "CONDITIONAL",
  },
};

const mockTracker = {
  id: "trk_test123",
  object: "tracker" as const,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
  mode: "test" as const,
  tracking_code: "TRACK123456789",
  status: "delivered",
  status_detail: "Delivered",
  carrier: "ups",
  weight: 16,
  finalized: true,
  is_return: false,
  public_url: "https://easypost.com/track/TRACK123456789",
  checkpoints: [
    {
      object: "TrackingLocation" as const,
      created_at: "2024-01-01T08:00:00Z",
      updated_at: "2024-01-01T08:00:00Z",
      message: "Picked up",
      status: "picked_up",
      status_detail: "Picked up",
      tracking_location: {
        object: "TrackingLocation",
        city: "New York",
        state: "NY",
        country: "US",
        zip: "10001",
      },
    },
    {
      object: "TrackingLocation" as const,
      created_at: "2024-01-02T14:00:00Z",
      updated_at: "2024-01-02T14:00:00Z",
      message: "Delivered",
      status: "delivered",
      status_detail: "Delivered",
      tracking_location: {
        object: "TrackingLocation",
        city: "Boston",
        state: "MA",
        country: "US",
        zip: "02101",
      },
    },
  ],
};

const mockBatch = {
  id: "batch_test123",
  object: "batch" as const,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  mode: "test" as const,
  state: "created",
  num_shipments: 2,
  shipments: [mockShipment],
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe("EasyPostSdkClient", () => {
  let client: EasyPostSdkClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new EasyPostSdkClient(mockConfig, mockGateway);
  });

  describe("Configuration", () => {
    it("should validate configuration successfully", async () => {
      vi.mocked(mockGateway.get).mockResolvedValueOnce({
        user: { id: "user_test" },
      });

      const isValid = await client.validateConfig();

      expect(isValid).toBe(true);
      expect(mockGateway.get).toHaveBeenCalledWith("easypost", "/user");
    });

    it("should return false on validation failure", async () => {
      vi.mocked(mockGateway.get).mockRejectedValueOnce(
        new Error("Invalid credentials"),
      );

      const isValid = await client.validateConfig();

      expect(isValid).toBe(false);
    });
  });

  describe("Addresses API", () => {
    it("should create address", async () => {
      vi.mocked(mockGateway.post).mockResolvedValueOnce({
        address: mockAddress,
      });

      const address = await client.addresses.create({
        name: "John Doe",
        street1: "123 Main St",
      });

      expect(address).toEqual(mockAddress);
      expect(mockGateway.post).toHaveBeenCalledWith(
        "easypost",
        "/addresses",
        expect.any(Object),
      );
    });

    it("should verify address", async () => {
      vi.mocked(mockGateway.get).mockResolvedValueOnce({
        address: mockAddress,
      });

      const result = await client.addresses.verify({ id: "adr_test123" });

      expect(result.address).toEqual(mockAddress);
    });

    it("should detect residential address", async () => {
      const residentialAddress = { ...mockAddress, residential: true };
      vi.mocked(mockGateway.get).mockResolvedValueOnce({
        address: residentialAddress,
      });

      const isResidential = await client.addresses.detectResidential({
        id: "adr_test123",
      });

      expect(isResidential).toBe(true);
    });

    it("should get address by ID", async () => {
      vi.mocked(mockGateway.get).mockResolvedValueOnce({
        address: mockAddress,
      });

      const address = await client.addresses.get("adr_test123");

      expect(address).toEqual(mockAddress);
    });
  });

  describe("Parcels API", () => {
    it("should create parcel with dimensions", async () => {
      vi.mocked(mockGateway.post).mockResolvedValueOnce({ parcel: mockParcel });

      const parcel = await client.parcels.create({
        weight: 16,
        length: 12,
        width: 8,
        height: 6,
      });

      expect(parcel).toEqual(mockParcel);
    });

    it("should get parcel by ID", async () => {
      vi.mocked(mockGateway.get).mockResolvedValueOnce({ parcel: mockParcel });

      const parcel = await client.parcels.get("prcl_test123");

      expect(parcel).toEqual(mockParcel);
    });
  });

  describe("Shipments API", () => {
    it("should create shipment", async () => {
      vi.mocked(mockGateway.post).mockResolvedValueOnce({
        shipment: mockShipment,
      });

      const shipment = await client.shipments.create({
        to_address: { id: "adr_to" },
        from_address: { id: "adr_from" },
        parcel: { id: "prcl_test" },
      });

      expect(shipment).toEqual(mockShipment);
    });

    it("should get rates for shipment", async () => {
      vi.mocked(mockGateway.get).mockResolvedValueOnce({
        shipment: mockShipment,
      });

      const rates = await client.shipments.getRates("shp_test123");

      expect(rates).toEqual(mockShipment.rates);
    });

    it("should buy rate and create label", async () => {
      const boughtShipment = {
        ...mockShipment,
        postage_label: mockShipment.postage_label,
      };
      vi.mocked(mockGateway.post).mockResolvedValueOnce({
        shipment: boughtShipment,
      });

      const result = await client.shipments.buyRate(
        "shp_test123",
        "rate_test123",
      );

      expect(result.tracking_code).toEqual("TRACK123456789");
    });

    it("should refund shipment", async () => {
      const refundedShipment = { ...mockShipment, status: "refunded" };
      vi.mocked(mockGateway.post).mockResolvedValueOnce({
        shipment: refundedShipment,
      });

      const result = await client.shipments.refund("shp_test123");

      expect(result.status).toEqual("refunded");
    });
  });

  describe("Rates API", () => {
    it("should filter rates by carrier", () => {
      const rates = [
        mockRate,
        { ...mockRate, id: "rate_2", carrier: "fedex", service: "Overnight" },
      ];

      const filtered = client.rates.filter(rates, "ups");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].carrier).toContain("ups");
    });

    it("should sort rates by price", () => {
      const rates = [
        { ...mockRate, rate: "25.00" },
        { ...mockRate, id: "rate_2", rate: "15.00" },
        { ...mockRate, id: "rate_3", rate: "20.00" },
      ];

      const sorted = client.rates.sortByPrice(rates);

      expect(sorted[0].rate).toBe("15.00");
      expect(sorted[1].rate).toBe("20.00");
      expect(sorted[2].rate).toBe("25.00");
    });

    it("should sort rates by delivery days", () => {
      const rates = [
        { ...mockRate, est_delivery_days: 5 },
        { ...mockRate, id: "rate_2", est_delivery_days: 1 },
        { ...mockRate, id: "rate_3", est_delivery_days: 3 },
      ];

      const sorted = client.rates.sortBySpeed(rates);

      expect(sorted[0].est_delivery_days).toBe(1);
      expect(sorted[1].est_delivery_days).toBe(3);
      expect(sorted[2].est_delivery_days).toBe(5);
    });
  });

  describe("Labels API", () => {
    it("should get label by ID", async () => {
      vi.mocked(mockGateway.get).mockResolvedValueOnce({
        shipment: mockShipment,
      });

      const label = await client.labels.get("shp_test123");

      expect(label.id).toEqual("shp_test123");
      expect(label.tracking_code).toEqual("TRACK123456789");
      expect(label.label_url).toContain("easypost.com");
    });

    it("should convert label format", async () => {
      vi.mocked(mockGateway.get).mockResolvedValueOnce({
        shipment: mockShipment,
      });

      const url = await client.labels.convertFormat("shp_test123", "PNG");

      expect(url).toContain("filetype=png");
    });

    it("should normalize shipment to label format", () => {
      const label = client.labels.normalize(mockShipment);

      expect(label).toEqual({
        id: mockShipment.id,
        tracking_code: mockShipment.tracking_code,
        label_url: mockShipment.postage_label?.url,
        label_format: "PDF",
        created_at: mockShipment.created_at,
      });
    });
  });

  describe("Tracking API", () => {
    it("should create tracker", async () => {
      vi.mocked(mockGateway.post).mockResolvedValueOnce({
        tracker: mockTracker,
      });

      const tracker = await client.tracking.create("TRACK123456789", "ups");

      expect(tracker).toEqual(mockTracker);
    });

    it("should get tracking info", async () => {
      vi.mocked(mockGateway.get).mockResolvedValueOnce({
        tracker: mockTracker,
      });

      const tracker = await client.tracking.get("TRACK123456789");

      expect(tracker.status).toEqual("delivered");
      expect(tracker.checkpoints).toHaveLength(2);
    });

    it("should register webhook", async () => {
      vi.mocked(mockGateway.post).mockResolvedValueOnce({
        webhook: { id: "hook_123", url: "https://example.com/webhook" },
      });

      const webhook = await client.tracking.registerWebhook(
        "https://example.com/webhook",
      );

      expect(webhook.id).toBe("hook_123");
    });
  });

  describe("Webhooks API", () => {
    it("should verify valid HMAC signature", () => {
      const payload = JSON.stringify({ id: "evt_123" });
      const hmac = require("crypto").createHmac(
        "sha256",
        mockConfig.webhookSecret!,
      );
      hmac.update(payload);
      const signature = hmac.digest("hex");

      const isValid = client.webhooks.verifySignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it("should reject invalid HMAC signature", () => {
      const payload = JSON.stringify({ id: "evt_123" });
      const invalidSignature = "invalid_signature_here";

      const isValid = client.webhooks.verifySignature(
        payload,
        invalidSignature,
      );

      expect(isValid).toBe(false);
    });

    it("should parse webhook event", () => {
      const payload = {
        id: "evt_123",
        description: "tracker.updated",
        result: { id: "trk_123", status: "delivered" },
        created_at: "2024-01-01T00:00:00Z",
      };

      const event = client.webhooks.parse(payload);

      expect(event).toEqual({
        id: "evt_123",
        description: "tracker.updated",
        result: { id: "trk_123", status: "delivered" },
        created_at: "2024-01-01T00:00:00Z",
      });
    });

    it("should throw on invalid webhook signature", () => {
      const payload = { id: "evt_123" };
      const signature = "invalid";

      expect(() => client.webhooks.parse(payload, signature)).toThrow(
        "Invalid webhook signature",
      );
    });
  });

  describe("Batch API", () => {
    it("should create batch", async () => {
      vi.mocked(mockGateway.post).mockResolvedValueOnce({ batch: mockBatch });

      const batch = await client.batch.create(["shp_1", "shp_2"]);

      expect(batch.num_shipments).toEqual(2);
    });

    it("should reject batch exceeding 10K shipments", async () => {
      const largeArray = Array.from({ length: 10001 }, (_, i) => `shp_${i}`);

      await expect(client.batch.create(largeArray)).rejects.toThrow(
        "cannot contain more than 10,000",
      );
    });

    it("should buy batch", async () => {
      const purchasedBatch = { ...mockBatch, state: "purchased" };
      vi.mocked(mockGateway.post).mockResolvedValueOnce({
        batch: purchasedBatch,
      });

      const result = await client.batch.buy("batch_test123");

      expect(result.state).toEqual("purchased");
    });

    it("should generate scan form", async () => {
      const scanForm = {
        id: "form_123",
        object: "ScanForm" as const,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        mode: "test" as const,
        status: "created",
        form_url: "https://easypost.com/scanform.pdf",
        batch_id: "batch_test123",
      };
      vi.mocked(mockGateway.post).mockResolvedValueOnce({
        scan_form: scanForm,
      });

      const result = await client.batch.generateScanForm("batch_test123");

      expect(result.form_url).toContain("easypost.com");
    });
  });

  describe("Rate Limiting", () => {
    it("should get rate limit info", () => {
      vi.mocked(mockGateway.getRateLimitStatus).mockReturnValueOnce({
        remaining: 18,
        resetAt: new Date(Date.now() + 5000),
      });

      const info = client.getRateLimitInfo();

      expect(info?.remaining).toBe(18);
      expect(info?.resetAt).toBeGreaterThan(Date.now());
    });

    it("should detect approaching rate limit", () => {
      vi.mocked(mockGateway.getRateLimitStatus).mockReturnValueOnce({
        remaining: 1,
        resetAt: new Date(Date.now() + 5000),
      });

      const isApproaching = client.isRateLimitApproaching();

      expect(isApproaching).toBe(true);
    });

    it("should return null rate limit if not configured", () => {
      vi.mocked(mockGateway.getRateLimitStatus).mockReturnValueOnce(null);

      const info = client.getRateLimitInfo();

      expect(info).toBeNull();
    });
  });
});
