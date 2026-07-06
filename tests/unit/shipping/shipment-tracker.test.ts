/**
 * Shipment Tracker Unit Tests
 *
 * Tests StatusMapper, ETACalculator, and UnifiedTracker classes.
 * Covers happy paths, edge cases, error paths, and boundary values.
 *
 * RED phase: written before verifying against implementation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  StatusMapper,
  ETACalculator,
  UnifiedTracker,
  ETAResult,
  TrackingSubscription,
} from "../../../packages/core/src/shipping/shipment-tracker";
import {
  CarrierCode,
  ShipmentStatus,
  TrackingInfo,
  ShippingError,
} from "../../../packages/core/src/shipping/shipping-types";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a minimal TrackingInfo object for use in mock carrier responses.
 */
function buildTrackingInfo(
  overrides: Partial<TrackingInfo> = {},
): TrackingInfo {
  return {
    trackingNumber: "TRK123",
    shipmentId: "ship_001",
    carrier: CarrierCode.UPS,
    status: ShipmentStatus.IN_TRANSIT,
    events: [],
    delivered: false,
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// StatusMapper
// ============================================================================

describe("StatusMapper", () => {
  // ------------------------------------------------------------------
  // EasyPost mappings
  // ------------------------------------------------------------------
  describe("EasyPost carrier mappings", () => {
    it('maps "unknown" to PENDING', () => {
      expect(StatusMapper.mapStatus(CarrierCode.EASYPOST, "unknown")).toBe(
        ShipmentStatus.PENDING,
      );
    });

    it('maps "label_created" to LABEL_CREATED', () => {
      expect(
        StatusMapper.mapStatus(CarrierCode.EASYPOST, "label_created"),
      ).toBe(ShipmentStatus.LABEL_CREATED);
    });

    it('maps "picked_up" to PICKED_UP', () => {
      expect(StatusMapper.mapStatus(CarrierCode.EASYPOST, "picked_up")).toBe(
        ShipmentStatus.PICKED_UP,
      );
    });

    it('maps "in_transit" to IN_TRANSIT', () => {
      expect(StatusMapper.mapStatus(CarrierCode.EASYPOST, "in_transit")).toBe(
        ShipmentStatus.IN_TRANSIT,
      );
    });

    it('maps "out_for_delivery" to OUT_FOR_DELIVERY', () => {
      expect(
        StatusMapper.mapStatus(CarrierCode.EASYPOST, "out_for_delivery"),
      ).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
    });

    it('maps "delivered" to DELIVERED', () => {
      expect(StatusMapper.mapStatus(CarrierCode.EASYPOST, "delivered")).toBe(
        ShipmentStatus.DELIVERED,
      );
    });

    it('maps "return_to_sender" to RETURNED', () => {
      expect(
        StatusMapper.mapStatus(CarrierCode.EASYPOST, "return_to_sender"),
      ).toBe(ShipmentStatus.RETURNED);
    });
  });

  // ------------------------------------------------------------------
  // Shippo mappings
  // ------------------------------------------------------------------
  describe("Shippo carrier mappings", () => {
    it('maps "unknown" to PENDING', () => {
      expect(StatusMapper.mapStatus(CarrierCode.SHIPPO, "unknown")).toBe(
        ShipmentStatus.PENDING,
      );
    });

    it('maps "label_created" to LABEL_CREATED', () => {
      expect(StatusMapper.mapStatus(CarrierCode.SHIPPO, "label_created")).toBe(
        ShipmentStatus.LABEL_CREATED,
      );
    });

    it('maps "delivered" to DELIVERED', () => {
      expect(StatusMapper.mapStatus(CarrierCode.SHIPPO, "delivered")).toBe(
        ShipmentStatus.DELIVERED,
      );
    });
  });

  // ------------------------------------------------------------------
  // ShipStation mappings
  // ------------------------------------------------------------------
  describe("ShipStation carrier mappings", () => {
    it('maps "pending" to PENDING', () => {
      expect(StatusMapper.mapStatus(CarrierCode.SHIPSTATION, "pending")).toBe(
        ShipmentStatus.PENDING,
      );
    });

    it('maps "on_hold" to PENDING', () => {
      expect(StatusMapper.mapStatus(CarrierCode.SHIPSTATION, "on_hold")).toBe(
        ShipmentStatus.PENDING,
      );
    });

    it('maps "label_printed" to LABEL_CREATED', () => {
      expect(
        StatusMapper.mapStatus(CarrierCode.SHIPSTATION, "label_printed"),
      ).toBe(ShipmentStatus.LABEL_CREATED);
    });

    it('maps "cancelled" to EXCEPTION', () => {
      expect(StatusMapper.mapStatus(CarrierCode.SHIPSTATION, "cancelled")).toBe(
        ShipmentStatus.EXCEPTION,
      );
    });
  });

  // ------------------------------------------------------------------
  // DHL mappings
  // ------------------------------------------------------------------
  describe("DHL carrier mappings", () => {
    it('maps "shipped" to PENDING', () => {
      expect(StatusMapper.mapStatus(CarrierCode.DHL, "shipped")).toBe(
        ShipmentStatus.PENDING,
      );
    });

    it('maps "exception" to EXCEPTION', () => {
      expect(StatusMapper.mapStatus(CarrierCode.DHL, "exception")).toBe(
        ShipmentStatus.EXCEPTION,
      );
    });

    it('maps "out_for_delivery" to OUT_FOR_DELIVERY', () => {
      expect(StatusMapper.mapStatus(CarrierCode.DHL, "out_for_delivery")).toBe(
        ShipmentStatus.OUT_FOR_DELIVERY,
      );
    });
  });

  // ------------------------------------------------------------------
  // USPS mappings
  // ------------------------------------------------------------------
  describe("USPS carrier mappings", () => {
    it('maps "accepted" to LABEL_CREATED', () => {
      expect(StatusMapper.mapStatus(CarrierCode.USPS, "accepted")).toBe(
        ShipmentStatus.LABEL_CREATED,
      );
    });

    it('maps "returned" to RETURNED', () => {
      expect(StatusMapper.mapStatus(CarrierCode.USPS, "returned")).toBe(
        ShipmentStatus.RETURNED,
      );
    });
  });

  // ------------------------------------------------------------------
  // UPS mappings
  // ------------------------------------------------------------------
  describe("UPS carrier mappings", () => {
    it('maps "pending" to PENDING', () => {
      expect(StatusMapper.mapStatus(CarrierCode.UPS, "pending")).toBe(
        ShipmentStatus.PENDING,
      );
    });

    it('maps "exception" to EXCEPTION', () => {
      expect(StatusMapper.mapStatus(CarrierCode.UPS, "exception")).toBe(
        ShipmentStatus.EXCEPTION,
      );
    });

    it("maps all core statuses for UPS", () => {
      const cases: [string, ShipmentStatus][] = [
        ["label_created", ShipmentStatus.LABEL_CREATED],
        ["picked_up", ShipmentStatus.PICKED_UP],
        ["in_transit", ShipmentStatus.IN_TRANSIT],
        ["out_for_delivery", ShipmentStatus.OUT_FOR_DELIVERY],
        ["delivered", ShipmentStatus.DELIVERED],
      ];

      for (const [rawStatus, expected] of cases) {
        expect(StatusMapper.mapStatus(CarrierCode.UPS, rawStatus)).toBe(
          expected,
        );
      }
    });
  });

  // ------------------------------------------------------------------
  // FedEx mappings
  // ------------------------------------------------------------------
  describe("FedEx carrier mappings", () => {
    it('maps "returned" to RETURNED', () => {
      expect(StatusMapper.mapStatus(CarrierCode.FEDEX, "returned")).toBe(
        ShipmentStatus.RETURNED,
      );
    });

    it("maps all core statuses for FedEx", () => {
      const cases: [string, ShipmentStatus][] = [
        ["pending", ShipmentStatus.PENDING],
        ["label_created", ShipmentStatus.LABEL_CREATED],
        ["picked_up", ShipmentStatus.PICKED_UP],
        ["in_transit", ShipmentStatus.IN_TRANSIT],
        ["out_for_delivery", ShipmentStatus.OUT_FOR_DELIVERY],
        ["delivered", ShipmentStatus.DELIVERED],
      ];

      for (const [rawStatus, expected] of cases) {
        expect(StatusMapper.mapStatus(CarrierCode.FEDEX, rawStatus)).toBe(
          expected,
        );
      }
    });
  });

  // ------------------------------------------------------------------
  // DoorDash mappings (last-mile delivery carrier)
  // ------------------------------------------------------------------
  describe("DoorDash carrier mappings", () => {
    it('maps "accepted" to IN_TRANSIT', () => {
      expect(StatusMapper.mapStatus(CarrierCode.DOORDASH, "accepted")).toBe(
        ShipmentStatus.IN_TRANSIT,
      );
    });

    it('maps "pickedup" (no underscore) to OUT_FOR_DELIVERY', () => {
      expect(StatusMapper.mapStatus(CarrierCode.DOORDASH, "pickedup")).toBe(
        ShipmentStatus.OUT_FOR_DELIVERY,
      );
    });

    it('maps "delivered" to DELIVERED', () => {
      expect(StatusMapper.mapStatus(CarrierCode.DOORDASH, "delivered")).toBe(
        ShipmentStatus.DELIVERED,
      );
    });
  });

  // ------------------------------------------------------------------
  // Uber mappings (last-mile delivery carrier)
  // ------------------------------------------------------------------
  describe("Uber carrier mappings", () => {
    it('maps "assigned" to IN_TRANSIT', () => {
      expect(StatusMapper.mapStatus(CarrierCode.UBER, "assigned")).toBe(
        ShipmentStatus.IN_TRANSIT,
      );
    });

    it('maps "picked_up" to OUT_FOR_DELIVERY', () => {
      expect(StatusMapper.mapStatus(CarrierCode.UBER, "picked_up")).toBe(
        ShipmentStatus.OUT_FOR_DELIVERY,
      );
    });
  });

  // ------------------------------------------------------------------
  // Case-insensitive matching
  // ------------------------------------------------------------------
  describe("case-insensitive status matching", () => {
    it("matches UPPERCASE input", () => {
      expect(StatusMapper.mapStatus(CarrierCode.FEDEX, "DELIVERED")).toBe(
        ShipmentStatus.DELIVERED,
      );
    });

    it("matches Mixed-Case input", () => {
      expect(StatusMapper.mapStatus(CarrierCode.UPS, "In_Transit")).toBe(
        ShipmentStatus.IN_TRANSIT,
      );
    });

    it("matches all-caps for USPS", () => {
      expect(StatusMapper.mapStatus(CarrierCode.USPS, "ACCEPTED")).toBe(
        ShipmentStatus.LABEL_CREATED,
      );
    });
  });

  // ------------------------------------------------------------------
  // Unknown status defaults
  // ------------------------------------------------------------------
  describe("unknown status fallback", () => {
    it("returns PENDING for an unrecognized status string", () => {
      expect(
        StatusMapper.mapStatus(CarrierCode.UPS, "totally_unknown_xyz"),
      ).toBe(ShipmentStatus.PENDING);
    });

    it("returns PENDING for empty string status", () => {
      expect(StatusMapper.mapStatus(CarrierCode.FEDEX, "")).toBe(
        ShipmentStatus.PENDING,
      );
    });
  });

  // ------------------------------------------------------------------
  // getDescription
  // ------------------------------------------------------------------
  describe("getDescription", () => {
    it("returns description for a known EasyPost status", () => {
      const desc = StatusMapper.getDescription(
        CarrierCode.EASYPOST,
        "delivered",
      );
      expect(desc).toBe("Delivered");
    });

    it("returns description for a known UPS status", () => {
      const desc = StatusMapper.getDescription(
        CarrierCode.UPS,
        "out_for_delivery",
      );
      expect(desc).toBe("Out for delivery");
    });

    it('returns description for DoorDash "accepted"', () => {
      const desc = StatusMapper.getDescription(
        CarrierCode.DOORDASH,
        "accepted",
      );
      expect(desc).toBe("Accepted");
    });

    it("returns empty string for an unknown status", () => {
      const desc = StatusMapper.getDescription(
        CarrierCode.FEDEX,
        "totally_unknown_xyz",
      );
      expect(desc).toBe("");
    });

    it("returns empty string for empty status string", () => {
      const desc = StatusMapper.getDescription(CarrierCode.UPS, "");
      expect(desc).toBe("");
    });

    it("is case-insensitive for descriptions", () => {
      const desc = StatusMapper.getDescription(
        CarrierCode.EASYPOST,
        "DELIVERED",
      );
      expect(desc).toBe("Delivered");
    });
  });
});

// ============================================================================
// ETACalculator
// ============================================================================

describe("ETACalculator", () => {
  /**
   * Return a ship date exactly N days in the past so that
   * estimatedDeliveryDate arithmetic is predictable.
   */
  function shipDateDaysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // ------------------------------------------------------------------
  // DELIVERED
  // ------------------------------------------------------------------
  describe("DELIVERED status", () => {
    it("sets daysRemaining to 0", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.DELIVERED,
        shipDateDaysAgo(3),
      );
      expect(result.daysRemaining).toBe(0);
    });

    it("sets confidence to 1.0", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.DELIVERED,
        shipDateDaysAgo(3),
      );
      expect(result.confidence).toBe(1.0);
    });

    it("returns a deliveryWindow", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.DELIVERED,
        shipDateDaysAgo(3),
      );
      expect(result.deliveryWindow).toBeDefined();
      expect(result.deliveryWindow!.start).toBeInstanceOf(Date);
      expect(result.deliveryWindow!.end).toBeInstanceOf(Date);
    });
  });

  // ------------------------------------------------------------------
  // OUT_FOR_DELIVERY
  // ------------------------------------------------------------------
  describe("OUT_FOR_DELIVERY status", () => {
    it("sets remainingDays to 1 and confidence to 0.99", () => {
      const shipDate = new Date(); // shipped today
      const result = ETACalculator.calculateETA(
        CarrierCode.FEDEX,
        ShipmentStatus.OUT_FOR_DELIVERY,
        shipDate,
      );
      expect(result.confidence).toBe(0.99);
      // estimatedDeliveryDate = shipDate + 1 day, which is in the future
      expect(result.daysRemaining).toBeGreaterThanOrEqual(0);
      // Verify estimatedDeliveryDate is ~1 day from shipDate
      const diffMs =
        result.estimatedDeliveryDate.getTime() - shipDate.getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(1, 0);
    });
  });

  // ------------------------------------------------------------------
  // IN_TRANSIT
  // ------------------------------------------------------------------
  describe("IN_TRANSIT status", () => {
    it("sets confidence to 0.9", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.IN_TRANSIT,
        new Date(),
      );
      expect(result.confidence).toBe(0.9);
    });

    it("uses ceil(defaultDays/2) as remaining days for UPS (defaultDays=3)", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.IN_TRANSIT,
        shipDate,
      );
      // defaultDays=3, ceil(3/2)=2
      const diffMs =
        result.estimatedDeliveryDate.getTime() - shipDate.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(2);
    });

    it("uses ceil(defaultDays/2) for DHL (defaultDays=4, ceil=2)", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.DHL,
        ShipmentStatus.IN_TRANSIT,
        shipDate,
      );
      // defaultDays=4, ceil(4/2)=2
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(2);
    });

    it("returns at least 1 remaining day for IN_TRANSIT", () => {
      // FedEx defaultDays=2, ceil(2/2)=1
      const result = ETACalculator.calculateETA(
        CarrierCode.FEDEX,
        ShipmentStatus.IN_TRANSIT,
        new Date(),
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - new Date().getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBeGreaterThanOrEqual(1);
    });
  });

  // ------------------------------------------------------------------
  // PICKED_UP
  // ------------------------------------------------------------------
  describe("PICKED_UP status", () => {
    it("sets confidence to 0.85", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.PICKED_UP,
        new Date(),
      );
      expect(result.confidence).toBe(0.85);
    });

    it("uses defaultDays as remaining days (UPS defaultDays=3)", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.PICKED_UP,
        shipDate,
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(3);
    });
  });

  // ------------------------------------------------------------------
  // LABEL_CREATED
  // ------------------------------------------------------------------
  describe("LABEL_CREATED status", () => {
    it("sets confidence to 0.7", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.FEDEX,
        ShipmentStatus.LABEL_CREATED,
        new Date(),
      );
      expect(result.confidence).toBe(0.7);
    });

    it("uses defaultDays + 1 as remaining days (FedEx defaultDays=2, expects 3)", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.FEDEX,
        ShipmentStatus.LABEL_CREATED,
        shipDate,
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(3);
    });
  });

  // ------------------------------------------------------------------
  // PENDING
  // ------------------------------------------------------------------
  describe("PENDING status", () => {
    it("sets confidence to 0.5", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.PENDING,
        new Date(),
      );
      expect(result.confidence).toBe(0.5);
    });

    it("uses defaultDays + 2 as remaining days (UPS defaultDays=3, expects 5)", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.PENDING,
        shipDate,
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(5);
    });
  });

  // ------------------------------------------------------------------
  // EXCEPTION
  // ------------------------------------------------------------------
  describe("EXCEPTION status", () => {
    it("sets confidence to 0.3", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.EXCEPTION,
        new Date(),
      );
      expect(result.confidence).toBe(0.3);
    });

    it("uses defaultDays + 3 as remaining days (UPS defaultDays=3, expects 6)", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.EXCEPTION,
        shipDate,
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(6);
    });
  });

  // ------------------------------------------------------------------
  // RETURNED
  // ------------------------------------------------------------------
  describe("RETURNED status", () => {
    it("sets confidence to 0.3", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.FEDEX,
        ShipmentStatus.RETURNED,
        new Date(),
      );
      expect(result.confidence).toBe(0.3);
    });

    it("uses defaultDays + 3 as remaining days (FedEx defaultDays=2, expects 5)", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.FEDEX,
        ShipmentStatus.RETURNED,
        shipDate,
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(5);
    });
  });

  // ------------------------------------------------------------------
  // estimatedDays override
  // ------------------------------------------------------------------
  describe("custom estimatedDays override", () => {
    it("uses the provided estimatedDays instead of carrier default", () => {
      const shipDate = new Date();
      // UPS default is 3, override to 7
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.PICKED_UP,
        shipDate,
        7,
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(7); // PICKED_UP uses defaultDays directly
    });

    it("custom estimatedDays affects PENDING calculation (override + 2)", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.PENDING,
        shipDate,
        10,
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(12);
    });

    it("custom estimatedDays affects IN_TRANSIT calculation (ceil(override/2))", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.FEDEX,
        ShipmentStatus.IN_TRANSIT,
        shipDate,
        6,
      );
      const diffDays = Math.round(
        (result.estimatedDeliveryDate.getTime() - shipDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(3); // ceil(6/2) = 3
    });
  });

  // ------------------------------------------------------------------
  // deliveryWindow is +/- 12 hours from estimate
  // ------------------------------------------------------------------
  describe("deliveryWindow boundaries", () => {
    it("window start is 12 hours before estimatedDeliveryDate", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.PENDING,
        shipDate,
      );
      const diffHours =
        (result.estimatedDeliveryDate.getTime() -
          result.deliveryWindow!.start.getTime()) /
        (60 * 60 * 1000);
      expect(diffHours).toBeCloseTo(12, 1);
    });

    it("window end is 12 hours after estimatedDeliveryDate", () => {
      const shipDate = new Date();
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.PENDING,
        shipDate,
      );
      const diffHours =
        (result.deliveryWindow!.end.getTime() -
          result.estimatedDeliveryDate.getTime()) /
        (60 * 60 * 1000);
      expect(diffHours).toBeCloseTo(12, 1);
    });
  });

  // ------------------------------------------------------------------
  // Return type shape
  // ------------------------------------------------------------------
  describe("return type shape", () => {
    it("returns all required fields", () => {
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.IN_TRANSIT,
        new Date(),
      );
      expect(result).toHaveProperty("estimatedDeliveryDate");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("daysRemaining");
      expect(result).toHaveProperty("deliveryWindow");
      expect(result.estimatedDeliveryDate).toBeInstanceOf(Date);
    });

    it("daysRemaining is never negative", () => {
      // Ship date far in the past, DELIVERED: should be 0
      const result = ETACalculator.calculateETA(
        CarrierCode.UPS,
        ShipmentStatus.DELIVERED,
        shipDateDaysAgo(10),
      );
      expect(result.daysRemaining).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// UnifiedTracker
// ============================================================================

describe("UnifiedTracker", () => {
  let tracker: UnifiedTracker;

  beforeEach(() => {
    tracker = new UnifiedTracker();
  });

  // ------------------------------------------------------------------
  // trackShipment
  // ------------------------------------------------------------------
  describe("trackShipment", () => {
    it("calls the registered mock carrier and returns tracking info", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "ABC123",
        carrier: CarrierCode.UPS,
        status: ShipmentStatus.IN_TRANSIT,
      });

      const mockFn = vi.fn().mockResolvedValue(mockTracking);
      tracker.registerMockCarrier(CarrierCode.UPS, mockFn);

      const result = await tracker.trackShipment("ABC123", CarrierCode.UPS);

      expect(result).toEqual(mockTracking);
      expect(mockFn).toHaveBeenCalledWith("ABC123");
    });

    it("returns cached result on second call without re-fetching", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "CACHED001",
        carrier: CarrierCode.FEDEX,
      });

      const mockFn = vi.fn().mockResolvedValue(mockTracking);
      tracker.registerMockCarrier(CarrierCode.FEDEX, mockFn);

      await tracker.trackShipment("CACHED001", CarrierCode.FEDEX);
      await tracker.trackShipment("CACHED001", CarrierCode.FEDEX);

      // Mock should only be called once because result is cached
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("throws ShippingError with INVALID_TRACKING code for empty tracking number", async () => {
      await expect(tracker.trackShipment("", CarrierCode.UPS)).rejects.toThrow(
        ShippingError,
      );

      await expect(
        tracker.trackShipment("", CarrierCode.UPS),
      ).rejects.toMatchObject({ code: "INVALID_TRACKING" });
    });

    it("includes the carrier in the thrown ShippingError for empty tracking number", async () => {
      await expect(
        tracker.trackShipment("", CarrierCode.FEDEX),
      ).rejects.toMatchObject({ carrier: CarrierCode.FEDEX });
    });

    it("throws ShippingError with CARRIER_NOT_IMPLEMENTED for unregistered carrier", async () => {
      await expect(
        tracker.trackShipment("TRK999", CarrierCode.DHL),
      ).rejects.toMatchObject({ code: "CARRIER_NOT_IMPLEMENTED" });
    });

    it("re-fetches when a different carrier is used for the same tracking number", async () => {
      const upsTracking = buildTrackingInfo({
        trackingNumber: "SHARED001",
        carrier: CarrierCode.UPS,
      });
      const fedexTracking = buildTrackingInfo({
        trackingNumber: "SHARED001",
        carrier: CarrierCode.FEDEX,
      });

      const upsMock = vi.fn().mockResolvedValue(upsTracking);
      const fedexMock = vi.fn().mockResolvedValue(fedexTracking);
      tracker.registerMockCarrier(CarrierCode.UPS, upsMock);
      tracker.registerMockCarrier(CarrierCode.FEDEX, fedexMock);

      // Fetch UPS first
      const upsResult = await tracker.trackShipment(
        "SHARED001",
        CarrierCode.UPS,
      );
      expect(upsResult.carrier).toBe(CarrierCode.UPS);

      // Fetch FedEx — cache miss because carrier differs
      const fedexResult = await tracker.trackShipment(
        "SHARED001",
        CarrierCode.FEDEX,
      );
      expect(fedexResult.carrier).toBe(CarrierCode.FEDEX);
      expect(fedexMock).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------
  // subscribeToUpdates
  // ------------------------------------------------------------------
  describe("subscribeToUpdates", () => {
    it("creates a subscription with a unique ID and correct fields", () => {
      const sub = tracker.subscribeToUpdates(
        "TRK001",
        "https://example.com/webhook",
      );

      expect(sub.subscriptionId).toBeTruthy();
      expect(sub.trackingNumber).toBe("TRK001");
      expect(sub.webhookUrl).toBe("https://example.com/webhook");
      expect(sub.isActive).toBe(true);
      expect(sub.createdAt).toBeInstanceOf(Date);
    });

    it("generates distinct subscription IDs for multiple subscriptions", () => {
      const sub1 = tracker.subscribeToUpdates("TRK001", "https://a.com/hook");
      const sub2 = tracker.subscribeToUpdates("TRK001", "https://b.com/hook");

      expect(sub1.subscriptionId).not.toBe(sub2.subscriptionId);
    });

    it("throws ShippingError with INVALID_SUBSCRIPTION when trackingNumber is empty", () => {
      expect(() =>
        tracker.subscribeToUpdates("", "https://example.com/webhook"),
      ).toThrow(ShippingError);

      expect(() =>
        tracker.subscribeToUpdates("", "https://example.com/webhook"),
      ).toThrowError(expect.objectContaining({ code: "INVALID_SUBSCRIPTION" }));
    });

    it("throws ShippingError with INVALID_SUBSCRIPTION when webhookUrl is empty", () => {
      expect(() => tracker.subscribeToUpdates("TRK001", "")).toThrowError(
        expect.objectContaining({ code: "INVALID_SUBSCRIPTION" }),
      );
    });

    it("subscription is returned as TrackingSubscription shape", () => {
      const sub = tracker.subscribeToUpdates(
        "TRK999",
        "https://example.com/hook",
      );

      // Verify the shape matches TrackingSubscription
      const typedSub: TrackingSubscription = sub;
      expect(typedSub).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // unsubscribe
  // ------------------------------------------------------------------
  describe("unsubscribe", () => {
    it("sets isActive to false for a valid subscription", () => {
      const sub = tracker.subscribeToUpdates(
        "TRK100",
        "https://example.com/hook",
      );

      tracker.unsubscribe(sub.subscriptionId);

      // The subscription should no longer appear in getSubscriptions
      const activeSubs = tracker.getSubscriptions("TRK100");
      expect(activeSubs).toHaveLength(0);
    });

    it("throws ShippingError with SUBSCRIPTION_NOT_FOUND for unknown ID", () => {
      expect(() => tracker.unsubscribe("sub_nonexistent_id")).toThrowError(
        expect.objectContaining({ code: "SUBSCRIPTION_NOT_FOUND" }),
      );
    });

    it("does not affect other active subscriptions when one is unsubscribed", () => {
      const sub1 = tracker.subscribeToUpdates("TRK200", "https://a.com/hook");
      const sub2 = tracker.subscribeToUpdates("TRK200", "https://b.com/hook");

      tracker.unsubscribe(sub1.subscriptionId);

      const activeSubs = tracker.getSubscriptions("TRK200");
      expect(activeSubs).toHaveLength(1);
      expect(activeSubs[0].subscriptionId).toBe(sub2.subscriptionId);
    });
  });

  // ------------------------------------------------------------------
  // updateTracking
  // ------------------------------------------------------------------
  describe("updateTracking", () => {
    it("adds an event to an existing tracking record", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_UPD001",
        carrier: CarrierCode.UPS,
        status: ShipmentStatus.LABEL_CREATED,
      });

      tracker.registerMockCarrier(CarrierCode.UPS, async () => mockTracking);
      await tracker.trackShipment("TRK_UPD001", CarrierCode.UPS);

      tracker.updateTracking("TRK_UPD001", CarrierCode.UPS, {
        status: ShipmentStatus.IN_TRANSIT,
        description: "Package arrived at facility",
      });

      const updated = tracker.getTracking("TRK_UPD001");
      expect(updated).toBeDefined();
      expect(updated!.events).toHaveLength(1);
      expect(updated!.events[0].status).toBe(ShipmentStatus.IN_TRANSIT);
      expect(updated!.events[0].description).toBe(
        "Package arrived at facility",
      );
    });

    it("updates the status field when an event is added", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_UPD002",
        carrier: CarrierCode.FEDEX,
        status: ShipmentStatus.PICKED_UP,
      });

      tracker.registerMockCarrier(CarrierCode.FEDEX, async () => mockTracking);
      await tracker.trackShipment("TRK_UPD002", CarrierCode.FEDEX);

      tracker.updateTracking("TRK_UPD002", CarrierCode.FEDEX, {
        status: ShipmentStatus.OUT_FOR_DELIVERY,
        description: "Out for delivery",
      });

      const updated = tracker.getTracking("TRK_UPD002");
      expect(updated!.status).toBe(ShipmentStatus.OUT_FOR_DELIVERY);
    });

    it("creates a new tracking record if one does not exist", () => {
      tracker.updateTracking("BRAND_NEW_TRK", CarrierCode.USPS, {
        status: ShipmentStatus.LABEL_CREATED,
        description: "Label created",
      });

      const tracking = tracker.getTracking("BRAND_NEW_TRK");
      expect(tracking).toBeDefined();
      expect(tracking!.trackingNumber).toBe("BRAND_NEW_TRK");
      expect(tracking!.carrier).toBe(CarrierCode.USPS);
      expect(tracking!.events).toHaveLength(1);
    });

    it("sets delivered=true and deliveredAt when status is DELIVERED", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_DLVR001",
        carrier: CarrierCode.UPS,
        status: ShipmentStatus.OUT_FOR_DELIVERY,
        delivered: false,
      });

      tracker.registerMockCarrier(CarrierCode.UPS, async () => mockTracking);
      await tracker.trackShipment("TRK_DLVR001", CarrierCode.UPS);

      tracker.updateTracking("TRK_DLVR001", CarrierCode.UPS, {
        status: ShipmentStatus.DELIVERED,
        description: "Package delivered",
      });

      const updated = tracker.getTracking("TRK_DLVR001");
      expect(updated!.delivered).toBe(true);
      expect(updated!.deliveredAt).toBeInstanceOf(Date);
    });

    it("does not set delivered flag for non-DELIVERED statuses", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_NONDLVR",
        carrier: CarrierCode.FEDEX,
        delivered: false,
      });

      tracker.registerMockCarrier(CarrierCode.FEDEX, async () => mockTracking);
      await tracker.trackShipment("TRK_NONDLVR", CarrierCode.FEDEX);

      tracker.updateTracking("TRK_NONDLVR", CarrierCode.FEDEX, {
        status: ShipmentStatus.IN_TRANSIT,
        description: "In transit",
      });

      const updated = tracker.getTracking("TRK_NONDLVR");
      expect(updated!.delivered).toBe(false);
      expect(updated!.deliveredAt).toBeUndefined();
    });

    it("event timestamp is set to a Date instance automatically", () => {
      tracker.updateTracking("TRK_TS001", CarrierCode.UPS, {
        status: ShipmentStatus.PICKED_UP,
        description: "Picked up",
      });

      const tracking = tracker.getTracking("TRK_TS001");
      expect(tracking!.events[0].timestamp).toBeInstanceOf(Date);
    });

    it("accumulates multiple events in order", () => {
      tracker.updateTracking("TRK_MULTI", CarrierCode.UPS, {
        status: ShipmentStatus.LABEL_CREATED,
        description: "Label created",
      });
      tracker.updateTracking("TRK_MULTI", CarrierCode.UPS, {
        status: ShipmentStatus.PICKED_UP,
        description: "Picked up",
      });
      tracker.updateTracking("TRK_MULTI", CarrierCode.UPS, {
        status: ShipmentStatus.IN_TRANSIT,
        description: "In transit",
      });

      const tracking = tracker.getTracking("TRK_MULTI");
      expect(tracking!.events).toHaveLength(3);
      expect(tracking!.status).toBe(ShipmentStatus.IN_TRANSIT);
    });
  });

  // ------------------------------------------------------------------
  // getTracking
  // ------------------------------------------------------------------
  describe("getTracking", () => {
    it("returns undefined for a tracking number that has never been tracked", () => {
      const result = tracker.getTracking("COMPLETELY_UNKNOWN");
      expect(result).toBeUndefined();
    });

    it("returns the tracking info after trackShipment is called", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_GET001",
        carrier: CarrierCode.UPS,
      });

      tracker.registerMockCarrier(CarrierCode.UPS, async () => mockTracking);
      await tracker.trackShipment("TRK_GET001", CarrierCode.UPS);

      const result = tracker.getTracking("TRK_GET001");
      expect(result).toEqual(mockTracking);
    });
  });

  // ------------------------------------------------------------------
  // getSubscriptions
  // ------------------------------------------------------------------
  describe("getSubscriptions", () => {
    it("returns only active subscriptions for the given tracking number", () => {
      const sub1 = tracker.subscribeToUpdates(
        "TRK_SUB001",
        "https://a.com/hook",
      );
      const sub2 = tracker.subscribeToUpdates(
        "TRK_SUB001",
        "https://b.com/hook",
      );

      // Deactivate first
      tracker.unsubscribe(sub1.subscriptionId);

      const activeSubs = tracker.getSubscriptions("TRK_SUB001");
      expect(activeSubs).toHaveLength(1);
      expect(activeSubs[0].subscriptionId).toBe(sub2.subscriptionId);
    });

    it("returns empty array when no subscriptions exist for a tracking number", () => {
      const result = tracker.getSubscriptions("TRK_NO_SUBS");
      expect(result).toEqual([]);
    });

    it("does not return subscriptions for other tracking numbers", () => {
      tracker.subscribeToUpdates("TRK_A", "https://a.com/hook");
      tracker.subscribeToUpdates("TRK_B", "https://b.com/hook");

      const subsForA = tracker.getSubscriptions("TRK_A");
      expect(subsForA).toHaveLength(1);
      expect(subsForA[0].trackingNumber).toBe("TRK_A");
    });

    it("returns empty array after all subscriptions are unsubscribed", () => {
      const sub1 = tracker.subscribeToUpdates(
        "TRK_UNSUB_ALL",
        "https://a.com/hook",
      );
      const sub2 = tracker.subscribeToUpdates(
        "TRK_UNSUB_ALL",
        "https://b.com/hook",
      );

      tracker.unsubscribe(sub1.subscriptionId);
      tracker.unsubscribe(sub2.subscriptionId);

      expect(tracker.getSubscriptions("TRK_UNSUB_ALL")).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------
  // calculateETA
  // ------------------------------------------------------------------
  describe("calculateETA", () => {
    it("returns undefined when tracking number is not in store", () => {
      const result = tracker.calculateETA("TRK_UNKNOWN_ETA");
      expect(result).toBeUndefined();
    });

    it("returns an ETAResult after tracking is loaded", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_ETA001",
        carrier: CarrierCode.UPS,
        status: ShipmentStatus.IN_TRANSIT,
        events: [],
      });

      tracker.registerMockCarrier(CarrierCode.UPS, async () => mockTracking);
      await tracker.trackShipment("TRK_ETA001", CarrierCode.UPS);

      const eta = tracker.calculateETA("TRK_ETA001");
      expect(eta).toBeDefined();
      expect(eta!.estimatedDeliveryDate).toBeInstanceOf(Date);
      expect(eta!.confidence).toBeGreaterThan(0);
    });

    it("uses first event timestamp as shipDate when events exist", async () => {
      const firstEventTimestamp = new Date(
        Date.now() - 2 * 24 * 60 * 60 * 1000,
      ); // 2 days ago

      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_ETA_EVENTS",
        carrier: CarrierCode.UPS,
        status: ShipmentStatus.IN_TRANSIT,
        events: [
          {
            timestamp: firstEventTimestamp,
            status: ShipmentStatus.LABEL_CREATED,
            description: "Label created",
          },
          {
            timestamp: new Date(),
            status: ShipmentStatus.IN_TRANSIT,
            description: "In transit",
          },
        ],
      });

      tracker.registerMockCarrier(CarrierCode.UPS, async () => mockTracking);
      await tracker.trackShipment("TRK_ETA_EVENTS", CarrierCode.UPS);

      const eta = tracker.calculateETA("TRK_ETA_EVENTS");
      expect(eta).toBeDefined();

      // ETA should be based on firstEventTimestamp as shipDate
      // UPS IN_TRANSIT = ceil(3/2) = 2 days from shipDate
      // shipDate was 2 days ago, so estimatedDeliveryDate should be around now
      const expectedDelivery = new Date(
        firstEventTimestamp.getTime() + 2 * 24 * 60 * 60 * 1000,
      );
      const diffMs = Math.abs(
        eta!.estimatedDeliveryDate.getTime() - expectedDelivery.getTime(),
      );
      // Allow 60 seconds tolerance
      expect(diffMs).toBeLessThan(60 * 1000);
    });

    it("falls back to current date as shipDate when no events", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_ETA_NOEVENTS",
        carrier: CarrierCode.UPS,
        status: ShipmentStatus.PENDING,
        events: [],
      });

      tracker.registerMockCarrier(CarrierCode.UPS, async () => mockTracking);
      await tracker.trackShipment("TRK_ETA_NOEVENTS", CarrierCode.UPS);

      const beforeCall = Date.now();
      const eta = tracker.calculateETA("TRK_ETA_NOEVENTS");
      const afterCall = Date.now();

      expect(eta).toBeDefined();
      // PENDING uses defaultDays + 2 = 5 days for UPS
      // estimatedDeliveryDate should be ~5 days from now
      const diffDays =
        (eta!.estimatedDeliveryDate.getTime() - beforeCall) /
        (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThanOrEqual(4.99);
      expect(diffDays).toBeLessThanOrEqual(5.01);
    });

    it("returns DELIVERED ETA (0 remaining, confidence 1.0) for delivered shipment", async () => {
      const mockTracking = buildTrackingInfo({
        trackingNumber: "TRK_ETA_DLVRD",
        carrier: CarrierCode.FEDEX,
        status: ShipmentStatus.DELIVERED,
        delivered: true,
        events: [],
      });

      tracker.registerMockCarrier(CarrierCode.FEDEX, async () => mockTracking);
      await tracker.trackShipment("TRK_ETA_DLVRD", CarrierCode.FEDEX);

      const eta = tracker.calculateETA("TRK_ETA_DLVRD");
      expect(eta).toBeDefined();
      expect(eta!.confidence).toBe(1.0);
      expect(eta!.daysRemaining).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // registerMockCarrier
  // ------------------------------------------------------------------
  describe("registerMockCarrier", () => {
    it("allows overriding an already registered mock carrier", async () => {
      const firstMock = vi
        .fn()
        .mockResolvedValue(
          buildTrackingInfo({
            trackingNumber: "TRK_MOCK_OVRD",
            carrier: CarrierCode.UPS,
          }),
        );
      const secondMock = vi.fn().mockResolvedValue(
        buildTrackingInfo({
          trackingNumber: "TRK_MOCK_OVRD",
          carrier: CarrierCode.UPS,
          status: ShipmentStatus.DELIVERED,
        }),
      );

      tracker.registerMockCarrier(CarrierCode.UPS, firstMock);
      tracker.registerMockCarrier(CarrierCode.UPS, secondMock);

      const result = await tracker.trackShipment(
        "TRK_MOCK_OVRD",
        CarrierCode.UPS,
      );

      // Should use the second registration
      expect(secondMock).toHaveBeenCalledTimes(1);
      expect(firstMock).not.toHaveBeenCalled();
      expect(result.status).toBe(ShipmentStatus.DELIVERED);
    });
  });
});
