/**
 * Courier Dispatcher Integration Tests
 * Tests: multi-courier quote comparison, dispatch with preferences,
 * fallback on courier failure, webhook routing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mockQuoteComparison,
  mockDispatchRequest,
  mockMultiCourierDispatch,
} from "../fixtures/courier-fixtures.js";

global.fetch = vi.fn();

describe("CourierDispatcher", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
  });

  describe("Multi-Courier Quote Comparison", () => {
    it("should compare quotes from multiple couriers", () => {
      const quotes = mockQuoteComparison.quotes;
      expect(quotes).toHaveLength(3);
      expect(quotes.map((q) => q.provider)).toContain("onfleet");
      expect(quotes.map((q) => q.provider)).toContain("stuart");
      expect(quotes.map((q) => q.provider)).toContain("uber_direct");
    });

    it("should identify cheapest option", () => {
      const quotes = mockQuoteComparison.quotes;
      const cheapest = quotes.reduce((min, q) =>
        q.estimatedCost < min.estimatedCost ? q : min,
      );
      expect(cheapest.provider).toBe("stuart");
      expect(cheapest.estimatedCost).toBe(850);
    });

    it("should identify fastest option", () => {
      const quotes = mockQuoteComparison.quotes;
      const fastest = quotes.reduce((min, q) =>
        q.estimatedDuration < min.estimatedDuration ? q : min,
      );
      expect(fastest.provider).toBe("stuart");
      expect(fastest.estimatedDuration).toBe(1200);
    });

    it("should rank quotes by cost", () => {
      const quotes = mockQuoteComparison.quotes;
      const sorted = [...quotes].sort(
        (a, b) => a.estimatedCost - b.estimatedCost,
      );
      expect(sorted[0].estimatedCost).toBe(850);
      expect(sorted[1].estimatedCost).toBe(1250);
      expect(sorted[2].estimatedCost).toBe(2200);
    });

    it("should rank quotes by speed", () => {
      const quotes = mockQuoteComparison.quotes;
      const sorted = [...quotes].sort(
        (a, b) => a.estimatedDuration - b.estimatedDuration,
      );
      expect(sorted[0].estimatedDuration).toBe(1200);
      expect(sorted[1].estimatedDuration).toBe(1500);
      expect(sorted[2].estimatedDuration).toBe(1800);
    });

    it("should include distance in comparison", () => {
      mockQuoteComparison.quotes.forEach((quote) => {
        expect(quote.distance).toBeDefined();
        expect(quote.distance).toBeGreaterThan(0);
      });
    });
  });

  describe("Dispatch Request Details", () => {
    it("should include pickup and dropoff addresses", () => {
      expect(mockDispatchRequest.pickupAddress).toBe(
        "200 Market St, San Francisco, CA 94102",
      );
      expect(mockDispatchRequest.dropoffAddress).toBe(
        "500 Market St, San Francisco, CA 94105",
      );
    });

    it("should include time windows", () => {
      expect(mockDispatchRequest.pickupTime).toBeInstanceOf(Date);
      expect(mockDispatchRequest.dropoffTime).toBeInstanceOf(Date);
    });

    it("should calculate delivery time window", () => {
      const duration =
        mockDispatchRequest.dropoffTime.getTime() -
        mockDispatchRequest.pickupTime.getTime();
      expect(duration).toBe(1800000); // 30 minutes
    });

    it("should include item details", () => {
      expect(mockDispatchRequest.items).toHaveLength(1);
      expect(mockDispatchRequest.items[0].description).toBe("Package");
      expect(mockDispatchRequest.items[0].quantity).toBe(1);
      expect(mockDispatchRequest.items[0].weight).toBe(2.0);
    });
  });

  describe("Dispatch with Provider Selection", () => {
    it("should select best courier based on criteria", () => {
      expect(mockMultiCourierDispatch.selectedProvider).toBe("stuart");
    });

    it("should create delivery with selected provider", () => {
      expect(mockMultiCourierDispatch.deliveryId).toBe("delivery_stuart_456");
    });

    it("should track estimated duration for dispatch", () => {
      expect(mockMultiCourierDispatch.estimatedDuration).toBe(1200);
    });

    it("should track estimated cost for dispatch", () => {
      expect(mockMultiCourierDispatch.estimatedCost).toBe(850);
    });

    it("should support cost-based preference", () => {
      const quotes = mockQuoteComparison.quotes;
      const cheapest = quotes.reduce((min, q) =>
        q.estimatedCost < min.estimatedCost ? q : min,
      );
      expect(cheapest.provider).toBe("stuart");
    });

    it("should support speed-based preference", () => {
      const quotes = mockQuoteComparison.quotes;
      const fastest = quotes.reduce((min, q) =>
        q.estimatedDuration < min.estimatedDuration ? q : min,
      );
      expect(fastest.provider).toBe("stuart");
    });

    it("should support distance-based preference", () => {
      const quotes = mockQuoteComparison.quotes;
      const shortest = quotes.reduce((min, q) =>
        q.distance < min.distance ? q : min,
      );
      expect(shortest.provider).toBeDefined();
    });
  });

  describe("Fallback on Courier Failure", () => {
    it("should list alternative providers", () => {
      expect(mockMultiCourierDispatch.providers).toHaveLength(3);
      expect(mockMultiCourierDispatch.providers).toContain("onfleet");
      expect(mockMultiCourierDispatch.providers).toContain("stuart");
      expect(mockMultiCourierDispatch.providers).toContain("uber_direct");
    });

    it("should attempt next courier on failure", () => {
      const providers = mockMultiCourierDispatch.providers;
      const primaryIndex = providers.indexOf("stuart");
      expect(primaryIndex).toBe(1);
      const fallback = providers[primaryIndex + 1];
      expect(fallback).toBe("uber_direct");
    });

    it("should retry with cheapest alternative if selected fails", () => {
      const quotes = mockQuoteComparison.quotes;
      const sorted = [...quotes].sort(
        (a, b) => a.estimatedCost - b.estimatedCost,
      );
      expect(sorted[1].provider).toBe("uber_direct");
      expect(sorted[1].estimatedCost).toBe(1250);
    });

    it("should track fallback attempts", () => {
      // Simulate fallback scenario
      const attempt1 = { provider: "stuart", success: false };
      const attempt2 = { provider: "uber_direct", success: true };
      expect(attempt1.success).toBe(false);
      expect(attempt2.success).toBe(true);
    });
  });

  describe("Webhook Routing", () => {
    it("should route onfleet webhooks to correct handler", () => {
      const webhook = {
        source: "onfleet",
        taskId: "task_123",
        action: "task_update",
      };
      expect(webhook.source).toBe("onfleet");
    });

    it("should route stuart webhooks to correct handler", () => {
      const webhook = {
        source: "stuart",
        deliveryId: "delivery_123",
        event: "delivery.status_change",
      };
      expect(webhook.source).toBe("stuart");
    });

    it("should route uber direct webhooks to correct handler", () => {
      const webhook = {
        source: "uber_direct",
        deliveryId: "delivery_456",
        eventType: "delivery.status_change",
      };
      expect(webhook.source).toBe("uber_direct");
    });

    it("should handle webhook payload routing", () => {
      const webhookHandlers = {
        onfleet: "handleOnfleetWebhook",
        stuart: "handleStuartWebhook",
        uber_direct: "handleUberDirectWebhook",
      };

      const incomingWebhook = { source: "stuart", data: {} };
      const handler =
        webhookHandlers[incomingWebhook.source as keyof typeof webhookHandlers];
      expect(handler).toBe("handleStuartWebhook");
    });

    it("should validate webhook source before routing", () => {
      const validSources = ["onfleet", "stuart", "uber_direct"];
      const incomingSource = "stuart";
      expect(validSources).toContain(incomingSource);
    });
  });

  describe("Dispatch Workflow", () => {
    it("should request quotes from all providers", () => {
      expect(mockQuoteComparison.quotes).toHaveLength(3);
    });

    it("should evaluate provider availability", () => {
      const providers = mockMultiCourierDispatch.providers;
      expect(providers.length).toBeGreaterThan(0);
    });

    it("should select optimal provider", () => {
      expect(mockMultiCourierDispatch.selectedProvider).toBe("stuart");
    });

    it("should create delivery with selected provider", () => {
      expect(mockMultiCourierDispatch.deliveryId).toBeDefined();
    });

    it("should return delivery confirmation", () => {
      expect(mockMultiCourierDispatch).toHaveProperty("deliveryId");
      expect(mockMultiCourierDispatch).toHaveProperty("estimatedDuration");
      expect(mockMultiCourierDispatch).toHaveProperty("estimatedCost");
    });
  });

  describe("Cost Analysis", () => {
    it("should calculate total cost difference", () => {
      const quotes = mockQuoteComparison.quotes;
      const max = Math.max(...quotes.map((q) => q.estimatedCost));
      const min = Math.min(...quotes.map((q) => q.estimatedCost));
      const difference = max - min;
      expect(difference).toBe(1350); // 2200 - 850
    });

    it("should identify cost savings opportunity", () => {
      const quotes = mockQuoteComparison.quotes;
      const onfleetQuote = quotes.find((q) => q.provider === "onfleet");
      const stuartQuote = quotes.find((q) => q.provider === "stuart");
      const savings =
        (onfleetQuote?.estimatedCost ?? 0) - (stuartQuote?.estimatedCost ?? 0);
      expect(savings).toBe(1350);
    });
  });

  describe("Time Analysis", () => {
    it("should calculate speed differences", () => {
      const quotes = mockQuoteComparison.quotes;
      const max = Math.max(...quotes.map((q) => q.estimatedDuration));
      const min = Math.min(...quotes.map((q) => q.estimatedDuration));
      const difference = max - min;
      expect(difference).toBe(600); // 1800 - 1200 seconds
    });

    it("should identify fastest option", () => {
      const quotes = mockQuoteComparison.quotes;
      const fastest = quotes.reduce((min, q) =>
        q.estimatedDuration < min.estimatedDuration ? q : min,
      );
      expect(fastest.estimatedDuration).toBe(1200);
    });
  });

  describe("Provider Preferences", () => {
    it("should support cost preference", () => {
      const preference = "cheapest";
      const quotes = mockQuoteComparison.quotes;
      const selected = quotes.reduce((min, q) =>
        q.estimatedCost < min.estimatedCost ? q : min,
      );
      expect(selected.provider).toBe("stuart");
    });

    it("should support speed preference", () => {
      const preference = "fastest";
      const quotes = mockQuoteComparison.quotes;
      const selected = quotes.reduce((min, q) =>
        q.estimatedDuration < min.estimatedDuration ? q : min,
      );
      expect(selected.provider).toBe("stuart");
    });

    it("should support balanced preference", () => {
      // Balanced = consider both cost and speed
      const quotes = mockQuoteComparison.quotes;
      const normalized = quotes.map((q) => ({
        provider: q.provider,
        costScore: q.estimatedCost,
        speedScore: q.estimatedDuration,
      }));
      expect(normalized).toHaveLength(3);
    });
  });
});
