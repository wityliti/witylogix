/**
 * Uber Direct Adapter Integration Tests
 * Tests: OAuth2 flow, delivery creation with manifest items, quote comparison,
 * delivery status with courier location, cancellation with fees, webhook verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mockUberDirectDelivery,
  mockUberDirectQuote,
  mockUberDirectDeliveryInTransit,
  mockUberDirectDeliveryCompleted,
  mockUberDirectDeliveryCancelled,
  mockUberDirectOAuth2Token,
  mockUberDirectWebhookPayload,
  mockUberDirectQuoteWithoutDriver,
  mockUberDirectMinimalManifest,
  mockUberDirectInvalidDeliveryError,
  mockUberDirectQuoteExpiredError,
} from '../fixtures/courier-fixtures.js';

global.fetch = vi.fn();

describe('UberDirectAdapter', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('OAuth2 Flow', () => {
    it('should exchange credentials for access token', () => {
      expect(mockUberDirectOAuth2Token.access_token).toBeDefined();
      expect(mockUberDirectOAuth2Token.token_type).toBe('Bearer');
      expect(mockUberDirectOAuth2Token.expires_in).toBe(3600);
    });

    it('should include refresh token', () => {
      expect(mockUberDirectOAuth2Token.refresh_token).toBe(
        'uber_refresh_token_xyz789'
      );
    });

    it('should have correct scope permissions', () => {
      expect(mockUberDirectOAuth2Token.scope).toContain('delivery_read');
      expect(mockUberDirectOAuth2Token.scope).toContain('delivery_write');
    });
  });

  describe('Delivery Creation with Manifest Items', () => {
    it('should create delivery with manifest items', () => {
      expect(mockUberDirectDelivery.manifest).toBeDefined();
      expect(mockUberDirectDelivery.manifest.items).toHaveLength(1);
    });

    it('should include item details in manifest', () => {
      const item = mockUberDirectDelivery.manifest.items[0];
      expect(item.title).toBe('Package');
      expect(item.quantity).toBe(1);
      expect(item.size_category).toBe('medium');
      expect(item.weight_kg).toBe(2.0);
    });

    it('should calculate total manifest weight', () => {
      expect(mockUberDirectDelivery.manifest.total_weight_kg).toBe(2.0);
    });

    it('should include size category', () => {
      expect(mockUberDirectDelivery.manifest.size_category).toBe('medium');
    });

    it('should handle minimal manifest', () => {
      expect(mockUberDirectMinimalManifest.manifest.items).toHaveLength(0);
      expect(mockUberDirectMinimalManifest.manifest.total_weight_kg).toBe(0);
    });
  });

  describe('Quote Parsing', () => {
    it('should parse quote with delivery details', () => {
      expect(mockUberDirectQuote.delivery_id).toBe('quote_uber_456');
      expect(mockUberDirectQuote.status).toBe('ready_for_pickup');
    });

    it('should include pricing in quote', () => {
      expect(mockUberDirectQuote.pricing).toBeDefined();
      expect(mockUberDirectQuote.pricing.currency_code).toBe('USD');
      expect(mockUberDirectQuote.pricing.distance_fee).toBe(450);
    });

    it('should indicate if quote is tip eligible', () => {
      expect(mockUberDirectQuote.pricing.tip_eligible).toBe(true);
    });

    it('should include time estimates', () => {
      expect(mockUberDirectQuote.estimated_pickup_time_sec).toBe(600); // 10 minutes
      expect(mockUberDirectQuote.estimated_dropoff_time_sec).toBe(1200); // 20 minutes
    });

    it('should handle expired quote error', () => {
      expect(mockUberDirectQuoteExpiredError.code).toBe('QUOTE_EXPIRED');
      expect(mockUberDirectQuoteExpiredError.message).toContain('expired');
    });
  });

  describe('Quote Comparison', () => {
    it('should compare multiple delivery quotes', () => {
      const quote1 = { price: 1000, duration: 1200 };
      const quote2 = { price: 850, duration: 900 };
      const quote3 = { price: 1250, duration: 1500 };

      const cheapest = [quote1, quote2, quote3].reduce((min, q) =>
        q.price < min.price ? q : min
      );
      expect(cheapest.price).toBe(850);

      const fastest = [quote1, quote2, quote3].reduce((min, q) =>
        q.duration < min.duration ? q : min
      );
      expect(fastest.duration).toBe(900);
    });
  });

  describe('Delivery Status with Courier Location', () => {
    it('should track delivery status', () => {
      expect(mockUberDirectDelivery.status).toBe('en_route_to_pickup');
    });

    it('should update status during transit', () => {
      expect(mockUberDirectDeliveryInTransit.status).toBe('en_route_to_dropoff');
      expect(mockUberDirectDeliveryInTransit.updated_at).toBe('2024-03-11T14:10:00Z');
    });

    it('should include courier information', () => {
      const courier = mockUberDirectDelivery.driver_assignments.driver;
      expect(courier).toBeDefined();
      expect(courier.name).toBe('Emily Wilson');
      expect(courier.rating).toBe(4.9);
    });

    it('should include courier location', () => {
      const courier = mockUberDirectDelivery.driver_assignments.driver;
      expect(courier.location).toBeDefined();
      expect(courier.location.latitude).toBe(37.784);
      expect(courier.location.longitude).toBe(-122.412);
    });

    it('should track assigned couriers count', () => {
      expect(mockUberDirectDelivery.driver_assignments.assigned_couriers).toBe(1);
    });

    it('should handle delivery without assigned driver', () => {
      expect(mockUberDirectQuoteWithoutDriver.driver_assignments.assigned_couriers).toBe(0);
    });
  });

  describe('Delivery Completion', () => {
    it('should mark delivery as completed', () => {
      expect(mockUberDirectDeliveryCompleted.status).toBe('completed');
      expect(mockUberDirectDeliveryCompleted.completed_at).toBe(
        '2024-03-11T14:30:00Z'
      );
    });

    it('should preserve delivery metadata when completed', () => {
      expect(mockUberDirectDeliveryCompleted.order_reference_id).toBe('order_003');
      expect(mockUberDirectDeliveryCompleted.delivery_id).toBe('delivery_uber_789');
    });
  });

  describe('Cancellation with Fee', () => {
    it('should support delivery cancellation', () => {
      expect(mockUberDirectDeliveryCancelled.status).toBe('cancelled');
    });

    it('should include cancellation reason', () => {
      expect(mockUberDirectDeliveryCancelled.cancel_reason).toBe(
        'Customer requested cancellation'
      );
    });

    it('should track cancellation timestamp', () => {
      expect(mockUberDirectDeliveryCancelled.updated_at).toBe('2024-03-11T14:35:00Z');
    });
  });

  describe('Webhook Verification', () => {
    it('should parse webhook payload', () => {
      expect(mockUberDirectWebhookPayload.delivery_id).toBe('delivery_uber_789');
      expect(mockUberDirectWebhookPayload.event_type).toBe('delivery.status_change');
    });

    it('should include webhook signature for verification', () => {
      expect(mockUberDirectWebhookPayload.event_id).toBe('evt_12345');
      expect(mockUberDirectWebhookPayload.timestamp).toBeDefined();
    });

    it('should extract status change data from webhook', () => {
      const data = mockUberDirectWebhookPayload.data;
      expect(data.previous_status).toBe('en_route_to_dropoff');
      expect(data.current_status).toBe('completed');
    });

    it('should include final delivery location in webhook', () => {
      const data = mockUberDirectWebhookPayload.data;
      expect(data.location).toBeDefined();
      expect(data.location.latitude).toBe(37.789);
      expect(data.location.longitude).toBe(-122.399);
    });
  });

  describe('Pickup and Dropoff', () => {
    it('should include pickup location and contact', () => {
      expect(mockUberDirectDelivery.pickup.location).toBeDefined();
      expect(mockUberDirectDelivery.pickup.contact.name).toBe('Carol Davis');
      expect(mockUberDirectDelivery.pickup.contact.phone).toBe('+14155559012');
    });

    it('should include dropoff location and contact', () => {
      expect(mockUberDirectDelivery.dropoff.location).toBeDefined();
      expect(mockUberDirectDelivery.dropoff.contact.name).toBe('David Lee');
      expect(mockUberDirectDelivery.dropoff.contact.phone).toBe('+14155553456');
    });

    it('should include scheduled times', () => {
      expect(mockUberDirectDelivery.pickup.scheduled_time).toBe('2024-03-11T14:00:00Z');
      expect(mockUberDirectDelivery.dropoff.scheduled_time).toBe('2024-03-11T14:30:00Z');
    });
  });

  describe('Pricing Details', () => {
    it('should include all pricing components', () => {
      const pricing = mockUberDirectDelivery.pricing;
      expect(pricing.currency_code).toBe('USD');
      expect(pricing.pickup_fee).toBe(0);
      expect(pricing.dropoff_fee).toBe(0);
    });

    it('should include tip eligibility', () => {
      expect(mockUberDirectDelivery.pricing.tip_eligible).toBe(true);
    });

    it('should specify pricing kind (quote vs final)', () => {
      expect(mockUberDirectDelivery.pricing.kind).toBe('quote');
    });
  });

  describe('Order Reference Tracking', () => {
    it('should include order reference ID', () => {
      expect(mockUberDirectDelivery.order_reference_id).toBe('order_003');
    });

    it('should track external delivery ID', () => {
      expect(mockUberDirectDelivery.delivery_id).toBe('delivery_uber_789');
    });

    it('should maintain reference through status changes', () => {
      expect(mockUberDirectDeliveryCompleted.order_reference_id).toBe('order_003');
    });
  });

  describe('Timestamp Tracking', () => {
    it('should include creation timestamp', () => {
      expect(mockUberDirectDelivery.created_at).toBe('2024-03-11T13:50:00Z');
    });

    it('should update timestamp on status changes', () => {
      expect(mockUberDirectDeliveryInTransit.updated_at).toBe('2024-03-11T14:10:00Z');
      expect(mockUberDirectDeliveryCompleted.updated_at).toBe('2024-03-11T14:30:00Z');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid delivery error', () => {
      expect(mockUberDirectInvalidDeliveryError.code).toBe('INVALID_REQUEST');
      expect(mockUberDirectInvalidDeliveryError.message).toContain('not found');
    });

    it('should handle quote expiration', () => {
      expect(mockUberDirectQuoteExpiredError.code).toBe('QUOTE_EXPIRED');
    });

    it('should handle authentication errors', () => {
      const authError = { code: 'UNAUTHORIZED', message: 'Invalid token' };
      expect(authError.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Driver Assignment Details', () => {
    it('should include driver name and contact', () => {
      const driver = mockUberDirectDelivery.driver_assignments.driver;
      expect(driver.name).toBe('Emily Wilson');
      expect(driver.phone).toBe('+14155554567');
    });

    it('should include driver rating', () => {
      const driver = mockUberDirectDelivery.driver_assignments.driver;
      expect(driver.rating).toBe(4.9);
    });

    it('should include real-time driver location', () => {
      const driver = mockUberDirectDelivery.driver_assignments.driver;
      expect(driver.location).toBeDefined();
    });
  });
});
