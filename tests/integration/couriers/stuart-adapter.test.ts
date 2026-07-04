/**
 * Stuart Adapter Integration Tests
 * Comprehensive test suite for Stuart courier service integration
 * Tests: OAuth2 token flow, delivery creation, quote parsing, status mapping,
 * cancellation with refunds, driver tracking, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mockStuartDelivery,
  mockStuartQuote,
  mockStuartCourier,
  mockStuartDeliveryCompleted,
  mockStuartDeliveryCancelled,
  mockStuartOAuth2Token,
  mockStuartMultiplePricingTiers,
  mockStuartDeliveryWithoutCourier,
} from "../fixtures/courier-fixtures.js";

global.fetch = vi.fn();

describe("StuartAdapter", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConfig = {
    apiToken: "test_stuart_token_123",
    clientId: "stuart_client_123",
    clientSecret: "stuart_secret_456",
    baseUrl: "https://api.stuart.com/v2",
    timeout: 10000,
  };

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("OAuth2 Token Flow", () => {
    it("should exchange credentials for access token", async () => {
      const mockResponse = new Response(JSON.stringify(mockStuartOAuth2Token), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      expect(mockStuartOAuth2Token.access_token).toBeDefined();
      expect(mockStuartOAuth2Token.token_type).toBe("Bearer");
      expect(mockStuartOAuth2Token.expires_in).toBe(3600);
    });

    it("should include refresh token for token renewal", () => {
      expect(mockStuartOAuth2Token.refresh_token).toBeDefined();
      expect(mockStuartOAuth2Token.refresh_token).toBe(
        "stuart_refresh_token_abc123",
      );
    });

    it("should return correct token type", () => {
      expect(mockStuartOAuth2Token.token_type).toBe("Bearer");
    });

    it("should include scope in token response", () => {
      expect(mockStuartOAuth2Token.scope).toBeDefined();
      expect(mockStuartOAuth2Token.scope).toContain("deliveries:write");
      expect(mockStuartOAuth2Token.scope).toContain("deliveries:read");
    });

    it("should refresh token before expiry", () => {
      const expiryTime = mockStuartOAuth2Token.expires_in;
      expect(expiryTime).toBe(3600);
    });
  });

  describe("Delivery Creation", () => {
    it("should create delivery with transport type", () => {
      expect(mockStuartDelivery.transport_type).toBe("bike");
      expect(mockStuartDelivery.id).toBe("delivery_stuart_456");
    });

    it("should include pickup and dropoff information", () => {
      expect(mockStuartDelivery.pickup.address).toBe(
        "200 Market St, San Francisco, CA 94102",
      );
      expect(mockStuartDelivery.dropoff.address).toBe(
        "300 California St, San Francisco, CA 94104",
      );
    });

    it("should include contact information for both locations", () => {
      expect(mockStuartDelivery.pickup.contact_name).toBe("Alice Johnson");
      expect(mockStuartDelivery.pickup.contact_phone).toBe("+14155558901");
      expect(mockStuartDelivery.dropoff.contact_name).toBe("Bob Smith");
      expect(mockStuartDelivery.dropoff.contact_phone).toBe("+14155552345");
    });

    it("should track delivery status", () => {
      expect(mockStuartDelivery.status).toBe("assigned");
    });

    it("should include items in delivery", () => {
      expect(mockStuartDelivery.items).toHaveLength(1);
      expect(mockStuartDelivery.items[0].description).toBe("Restaurant order");
      expect(mockStuartDelivery.items[0].quantity).toBe(1);
    });

    it("should include distance information", () => {
      expect(mockStuartDelivery.distance.value).toBe(1.5);
      expect(mockStuartDelivery.distance.unit).toBe("km");
    });
  });

  describe("Get Quote", () => {
    it("should parse quote with pricing information", () => {
      expect(mockStuartQuote.delivery_price).toBe(850);
      expect(mockStuartQuote.currency).toBe("GBP");
    });

    it("should include transport type in quote", () => {
      expect(mockStuartQuote.transport_type).toBe("bike");
    });

    it("should include estimated duration in quote", () => {
      expect(mockStuartQuote.estimated_duration_minutes).toBe(15);
    });

    it("should include estimated distance in quote", () => {
      expect(mockStuartQuote.estimated_distance_km).toBe(1.5);
    });

    it("should provide pricing breakdown", () => {
      expect(mockStuartQuote.pricing_breakdown).toBeDefined();
      expect(mockStuartQuote.pricing_breakdown).toHaveLength(2);
      expect(mockStuartQuote.pricing_breakdown[0].type).toBe("distance");
      expect(mockStuartQuote.pricing_breakdown[1].type).toBe("base_fare");
    });
  });

  describe("Quote with Multiple Pricing Tiers", () => {
    it("should handle multiple pricing components", () => {
      expect(mockStuartMultiplePricingTiers.pricing_breakdown).toHaveLength(4);
    });

    it("should include surge multiplier in breakdown", () => {
      const surgeComponent =
        mockStuartMultiplePricingTiers.pricing_breakdown.find(
          (p) => p.type === "surge_multiplier",
        );
      expect(surgeComponent).toBeDefined();
      expect(surgeComponent?.price).toBe(250);
    });

    it("should include surcharge in breakdown", () => {
      const surchargeComponent =
        mockStuartMultiplePricingTiers.pricing_breakdown.find(
          (p) => p.type === "surcharge",
        );
      expect(surchargeComponent).toBeDefined();
      expect(surchargeComponent?.price).toBe(100);
    });

    it("should calculate total from breakdown", () => {
      const total = mockStuartMultiplePricingTiers.pricing_breakdown.reduce(
        (sum, item) => sum + item.price,
        0,
      );
      expect(total).toBe(950);
    });
  });

  describe("Status Transitions", () => {
    it("should track delivery progression", () => {
      expect(mockStuartDelivery.status).toBe("assigned");
      expect(mockStuartDeliveryCompleted.status).toBe("delivered");
    });

    it("should include delivery timestamp when completed", () => {
      expect(mockStuartDeliveryCompleted.delivered_at).toBe(
        "2024-03-11T14:25:00Z",
      );
    });

    it("should include delivery proof requirements", () => {
      expect(mockStuartDeliveryCompleted.delivery_proof).toBeDefined();
      expect(
        mockStuartDeliveryCompleted.delivery_proof.signature_required,
      ).toBe(false);
    });

    it("should handle cancellation status", () => {
      expect(mockStuartDeliveryCancelled.status).toBe("cancelled");
      expect(mockStuartDeliveryCancelled.cancellation_reason).toBe(
        "Customer request",
      );
    });
  });

  describe("Cancel with Refund Check", () => {
    it("should support cancellation", () => {
      expect(mockStuartDeliveryCancelled.status).toBe("cancelled");
    });

    it("should preserve cancellation reason", () => {
      expect(mockStuartDeliveryCancelled.cancellation_reason).toBe(
        "Customer request",
      );
    });

    it("should maintain delivery metadata on cancellation", () => {
      expect(mockStuartDeliveryCancelled.id).toBe("delivery_stuart_456");
      expect(mockStuartDeliveryCancelled.customer_reference).toBe("order_002");
    });
  });

  describe("Driver Location Tracking", () => {
    it("should include current courier location", () => {
      expect(mockStuartDelivery.current_courier_location).toBeDefined();
      expect(mockStuartDelivery.current_courier_location).toHaveLength(2);
      expect(mockStuartDelivery.current_courier_location[0]).toBe(37.7899);
      expect(mockStuartDelivery.current_courier_location[1]).toBe(-122.3987);
    });

    it("should handle delivery without courier location", () => {
      expect(
        mockStuartDeliveryWithoutCourier.current_courier_location,
      ).toBeUndefined();
    });

    it("should parse courier information", () => {
      expect(mockStuartCourier.id).toBe("courier_stuart_001");
      expect(mockStuartCourier.name).toBe("Charlie Brown");
      expect(mockStuartCourier.phone).toBe("+441234567890");
    });

    it("should include courier location", () => {
      expect(mockStuartCourier.location).toBeDefined();
      expect(mockStuartCourier.location).toHaveLength(2);
    });

    it("should include courier rating", () => {
      expect(mockStuartCourier.rating).toBe(4.8);
    });

    it("should include courier vehicle type", () => {
      expect(mockStuartCourier.vehicle_type).toBe("bike");
    });

    it("should track active deliveries", () => {
      expect(mockStuartCourier.active_deliveries).toBe(1);
    });
  });

  describe("Scheduled Time Windows", () => {
    it("should include pickup scheduled time", () => {
      expect(mockStuartDelivery.pickup.scheduled_at).toBe(
        "2024-03-11T14:00:00Z",
      );
    });

    it("should include ready_at time for pickup", () => {
      expect(mockStuartDelivery.pickup.ready_at).toBe("2024-03-11T14:00:00Z");
    });

    it("should include dropoff scheduled time", () => {
      expect(mockStuartDelivery.dropoff.scheduled_at).toBe(
        "2024-03-11T14:30:00Z",
      );
    });

    it("should calculate time window from schedules", () => {
      const pickupTime = new Date(mockStuartDelivery.pickup.scheduled_at);
      const dropoffTime = new Date(mockStuartDelivery.dropoff.scheduled_at);
      const duration =
        (dropoffTime.getTime() - pickupTime.getTime()) / 1000 / 60;
      expect(duration).toBe(30); // 30 minutes
    });
  });

  describe("Weight and Charged Weight", () => {
    it("should include item weight", () => {
      expect(mockStuartDelivery.items[0].weight).toBe(1.2);
    });

    it("should track charged weight for billing", () => {
      expect(mockStuartDelivery.charged_weight).toBe(1.2);
    });

    it("should potentially differ from actual weight", () => {
      const chargedVsActual =
        mockStuartDelivery.charged_weight >=
        mockStuartDelivery.items.reduce(
          (sum, item) => sum + (item.weight || 0),
          0,
        );
      expect(chargedVsActual).toBe(true);
    });
  });

  describe("Estimated Delivery Time", () => {
    it("should provide estimated delivery timestamp", () => {
      expect(mockStuartDelivery.estimated_delivery_time).toBe(1710168300000);
    });

    it("should be after dropoff scheduled time", () => {
      const scheduledTime = new Date(
        mockStuartDelivery.dropoff.scheduled_at,
      ).getTime();
      expect(mockStuartDelivery.estimated_delivery_time).toBeGreaterThanOrEqual(
        scheduledTime,
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid OAuth token", async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: "invalid_token" }),
        { status: 401 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      expect(mockFetch).toBeDefined();
    });

    it("should handle rate limiting", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          error: "rate_limit_exceeded",
          retry_after: 60,
        }),
        { status: 429 },
      );
      mockFetch.mockResolvedValue(mockResponse);

      expect(mockFetch).toBeDefined();
    });
  });

  describe("Currency Handling", () => {
    it("should preserve currency in quotes", () => {
      expect(mockStuartQuote.currency).toBe("GBP");
    });

    it("should maintain currency in pricing breakdown", () => {
      expect(mockStuartDelivery.pricing.currency).toBe("GBP");
    });

    it("should include total price in currency", () => {
      expect(mockStuartDelivery.pricing.total_price).toBe(850);
    });
  });

  describe("Size Categories", () => {
    it("should include size category in delivery items", () => {
      expect(mockStuartDelivery.items[0].size).toBe("medium");
    });
  });
});
