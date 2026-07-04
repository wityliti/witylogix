/**
 * WooCommerce Tracking Write-back Tests — WIT-220
 *
 * TDD coverage:
 * - Happy path: tracking number pushed via Shipment Tracking plugin endpoint
 * - Plugin not installed (404): fallback to meta_data write
 * - Network failure: exponential backoff, max 3 retries, then enqueue BullMQ job
 * - Delivered status: WC order set to `completed` when Shipment → delivered
 * - Carrier slug → WC tracking_provider mapping
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WCTrackingWritebackService,
  CARRIER_SLUG_TO_WC_PROVIDER,
  type TrackingWritebackParams,
} from "../tracking-write-back.js";
import type { WooCommerceClient } from "../wc-client.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(
  overrides: Partial<Record<string, unknown>> = {},
): WooCommerceClient {
  return {
    post: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
    ...overrides,
  } as unknown as WooCommerceClient;
}

const DEFAULT_PARAMS: TrackingWritebackParams = {
  wcOrderId: 1001,
  trackingNumber: "1Z999AA10123456784",
  carrierSlug: "ups",
  dateShipped: "2026-04-04",
};

// ── Carrier mapping ───────────────────────────────────────────────────────────

describe("CARRIER_SLUG_TO_WC_PROVIDER", () => {
  it("maps known carriers", () => {
    expect(CARRIER_SLUG_TO_WC_PROVIDER["ups"]).toBe("ups");
    expect(CARRIER_SLUG_TO_WC_PROVIDER["fedex"]).toBe("fedex");
    expect(CARRIER_SLUG_TO_WC_PROVIDER["dhl"]).toBe("dhl");
    expect(CARRIER_SLUG_TO_WC_PROVIDER["usps"]).toBe("usps");
  });

  it("returns undefined for unknown carrier", () => {
    expect(CARRIER_SLUG_TO_WC_PROVIDER["unknown-carrier"]).toBeUndefined();
  });
});

// ── pushTrackingNumber ────────────────────────────────────────────────────────

describe("WCTrackingWritebackService.pushTrackingNumber", () => {
  let client: WooCommerceClient;
  let service: WCTrackingWritebackService;
  const mockEnqueue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
    service = new WCTrackingWritebackService(client, mockEnqueue);
  });

  it("POSTs to shipment-tracking endpoint with mapped provider", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });

    await service.pushTrackingNumber(DEFAULT_PARAMS);

    expect(client.post).toHaveBeenCalledWith(
      `/orders/1001/shipment-tracking`,
      expect.objectContaining({
        tracking_number: "1Z999AA10123456784",
        tracking_provider: "ups",
        date_shipped: "2026-04-04",
      }),
    );
    expect(client.put).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("uses 'custom' provider and passes custom_tracking_link for unknown carrier", async () => {
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1 });

    await service.pushTrackingNumber({
      ...DEFAULT_PARAMS,
      carrierSlug: "localdelivery",
    });

    expect(client.post).toHaveBeenCalledWith(
      `/orders/1001/shipment-tracking`,
      expect.objectContaining({
        tracking_provider: "custom",
        custom_tracking_provider: "localdelivery",
        tracking_number: DEFAULT_PARAMS.trackingNumber,
      }),
    );
  });

  it("falls back to meta_data write when plugin returns 404", async () => {
    const notFoundError = new Error(
      "WooCommerce API Error [404]: rest_no_route",
    );
    (client.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      notFoundError,
    );
    (client.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1001,
    });

    await service.pushTrackingNumber(DEFAULT_PARAMS);

    expect(client.put).toHaveBeenCalledWith(
      `/orders/1001`,
      expect.objectContaining({
        meta_data: expect.arrayContaining([
          expect.objectContaining({
            key: "_wc_shipment_tracking_items",
          }),
        ]),
      }),
    );
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("enqueues BullMQ job after 3 failed attempts for non-404 errors", async () => {
    const networkError = new Error("Network timeout");
    (client.post as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError);

    await service.pushTrackingNumber(DEFAULT_PARAMS);

    expect(client.post).toHaveBeenCalledTimes(3);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "wc-tracking-writeback",
      expect.objectContaining({
        wcOrderId: DEFAULT_PARAMS.wcOrderId,
        trackingNumber: DEFAULT_PARAMS.trackingNumber,
        carrierSlug: DEFAULT_PARAMS.carrierSlug,
        dateShipped: DEFAULT_PARAMS.dateShipped,
      }),
    );
  });

  it("succeeds on second attempt (retry path)", async () => {
    const networkError = new Error("Network timeout");
    (client.post as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ id: 1 });

    await service.pushTrackingNumber(DEFAULT_PARAMS);

    expect(client.post).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("does NOT retry on 404 (plugin-not-installed is not transient)", async () => {
    const notFoundError = new Error(
      "WooCommerce API Error [404]: rest_no_route",
    );
    (client.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      notFoundError,
    );
    (client.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1001,
    });

    await service.pushTrackingNumber(DEFAULT_PARAMS);

    // Should go straight to meta_data fallback, not retry POST
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.put).toHaveBeenCalledTimes(1);
  });
});

// ── pushDeliveredStatus ───────────────────────────────────────────────────────

describe("WCTrackingWritebackService.pushDeliveredStatus", () => {
  let client: WooCommerceClient;
  let service: WCTrackingWritebackService;
  const mockEnqueue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
    service = new WCTrackingWritebackService(client, mockEnqueue);
  });

  it("updates WC order status to completed", async () => {
    (client.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1001,
      status: "completed",
    });

    await service.pushDeliveredStatus(1001);

    expect(client.put).toHaveBeenCalledWith(`/orders/1001`, {
      status: "completed",
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("enqueues retry job after 3 failed attempts", async () => {
    const networkError = new Error("Network timeout");
    (client.put as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError);

    await service.pushDeliveredStatus(1001);

    expect(client.put).toHaveBeenCalledTimes(3);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "wc-order-status-update",
      expect.objectContaining({
        wcOrderId: 1001,
        status: "completed",
      }),
    );
  });

  it("succeeds on second attempt", async () => {
    const networkError = new Error("Network timeout");
    (client.put as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ id: 1001, status: "completed" });

    await service.pushDeliveredStatus(1001);

    expect(client.put).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
