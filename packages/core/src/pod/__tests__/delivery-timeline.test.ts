/**
 * Delivery Timeline Unit Tests
 *
 * Tests for delivery timeline functionality:
 * - Record timeline events
 * - Status transitions
 * - Query timeline
 * - Validate event progression
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { deliveryTimelineService } from '../delivery-timeline.js';
import { EVENT_DESCRIPTIONS, VALID_TRANSITIONS } from '../delivery-timeline.js';
import type { TimelineEvent, TimelineRecordRequest } from '../types.js';

// ─── SETUP ──────────────────────────────────────────────────────

describe('Delivery Timeline Service', () => {
  const testDeliveryId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    deliveryTimelineService.clearTimeline(testDeliveryId);
  });

  // ─── RECORD EVENT TESTS ─────────────────────────────────────

  describe('Record Events', () => {
    it('should record CREATED event', () => {
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
        description: 'Order created',
      });

      expect(entry).toBeDefined();
      expect(entry.event).toBe('CREATED');
      expect(entry.status).toBe('pending');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should record event with location', () => {
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'PICKED_UP',
        description: 'Package picked up',
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(entry.latitude).toBe(40.7128);
      expect(entry.longitude).toBe(-74.006);
    });

    it('should record event with attachments', () => {
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'DELIVERED',
        description: 'Delivery completed',
        attachments: {
          photoUrl: 'https://example.com/photo.jpg',
          signatureUrl: 'https://example.com/signature.png',
          notes: 'Delivered in good condition',
        },
      });

      expect(entry.attachments?.photoUrl).toBeDefined();
      expect(entry.attachments?.signatureUrl).toBeDefined();
      expect(entry.attachments?.notes).toBe('Delivered in good condition');
    });

    it('should use default description for known events', () => {
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'DELIVERED',
      });

      expect(entry.description).toBe(EVENT_DESCRIPTIONS['DELIVERED']);
    });

    it('should reject unknown event types', () => {
      expect(() => {
        deliveryTimelineService.recordEvent({
          deliveryId: testDeliveryId,
          event: 'UNKNOWN_EVENT' as TimelineEvent,
        });
      }).toThrow('Unknown event type');
    });

    it('should require delivery ID', () => {
      expect(() => {
        deliveryTimelineService.recordEvent({
          deliveryId: '',
          event: 'CREATED',
        });
      }).toThrow('Delivery ID is required');
    });
  });

  // ─── STATUS TRANSITION TESTS ────────────────────────────────

  describe('Status Transitions', () => {
    it('should allow valid transitions', () => {
      // PENDING -> CONFIRMED
      let entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });
      expect(entry.status).toBe('pending');

      entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CONFIRMED',
      });
      expect(entry.status).toBe('confirmed');
    });

    it('should allow same status (idempotent)', () => {
      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      // Record CREATED again - should not fail
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      expect(entry.status).toBe('pending');
    });

    it('should reject invalid transitions', () => {
      // Start with CREATED (pending)
      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      // Try to go from PENDING -> DELIVERED (invalid)
      expect(() => {
        deliveryTimelineService.recordEvent({
          deliveryId: testDeliveryId,
          event: 'DELIVERED',
        });
      }).toThrow('Invalid status transition');
    });

    it('should support complete delivery flow', () => {
      const flow: TimelineEvent[] = [
        'CREATED',
        'CONFIRMED',
        'PICKED_UP',
        'OUT_FOR_DELIVERY',
        'ARRIVED',
        'DELIVERED',
      ];

      for (const event of flow) {
        const entry = deliveryTimelineService.recordEvent({
          deliveryId: testDeliveryId,
          event,
        });

        expect(entry.event).toBe(event);
      }
    });

    it('should allow FAILED from multiple states', () => {
      // From PENDING
      let entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'FAILED',
      });

      // Clear for next test
      deliveryTimelineService.clearTimeline(testDeliveryId);

      // From PICKED_UP
      entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'PICKED_UP',
      });

      entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'FAILED',
      });

      expect(entry.event).toBe('FAILED');
    });
  });

  // ─── QUERY TESTS ────────────────────────────────────────────

  describe('Query Timeline', () => {
    it('should retrieve complete timeline', () => {
      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CONFIRMED',
      });

      const timeline = deliveryTimelineService.getTimeline(testDeliveryId);

      expect(timeline).toHaveLength(2);
      expect(timeline[0].event).toBe('CREATED');
      expect(timeline[1].event).toBe('CONFIRMED');
    });

    it('should return empty timeline for non-existent delivery', () => {
      const timeline = deliveryTimelineService.getTimeline('non-existent');

      expect(timeline).toHaveLength(0);
    });

    it('should get current status', () => {
      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CONFIRMED',
      });

      const status = deliveryTimelineService.getCurrentStatus(testDeliveryId);

      expect(status).toBe('confirmed');
    });

    it('should get event by type', () => {
      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'PICKED_UP',
      });

      const pickedUpEvent = deliveryTimelineService.getEventByType(
        testDeliveryId,
        'PICKED_UP'
      );

      expect(pickedUpEvent).toBeDefined();
      expect(pickedUpEvent?.event).toBe('PICKED_UP');
    });

    it('should return null for non-existent event type', () => {
      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      const event = deliveryTimelineService.getEventByType(
        testDeliveryId,
        'DELIVERED'
      );

      expect(event).toBeNull();
    });

    it('should get events between timestamps', () => {
      const now = new Date();
      const before = new Date(now.getTime() - 1000);
      const after = new Date(now.getTime() + 1000);

      deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      const events = deliveryTimelineService.getEventsBetween(
        testDeliveryId,
        before,
        after
      );

      expect(events).toHaveLength(1);
    });
  });

  // ─── UPDATE EVENT TESTS ─────────────────────────────────────

  describe('Update Events', () => {
    it('should update event', () => {
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
        description: 'Original description',
      });

      const updated = deliveryTimelineService.updateEvent(
        testDeliveryId,
        entry.id,
        {
          description: 'Updated description',
          metadata: { updated: true },
        }
      );

      expect(updated?.description).toBe('Updated description');
      expect(updated?.metadata?.updated).toBe(true);
    });

    it('should preserve original timestamp on update', () => {
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
      });

      const originalTimestamp = entry.timestamp;

      const updated = deliveryTimelineService.updateEvent(
        testDeliveryId,
        entry.id,
        {
          description: 'Updated',
        }
      );

      expect(updated?.timestamp).toEqual(originalTimestamp);
    });

    it('should return null for non-existent event', () => {
      const updated = deliveryTimelineService.updateEvent(
        testDeliveryId,
        'non-existent-id',
        { description: 'New description' }
      );

      expect(updated).toBeNull();
    });
  });

  // ─── TIMELINE METADATA TESTS ────────────────────────────────

  describe('Timeline Metadata', () => {
    it('should store event metadata', () => {
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
        metadata: {
          orderId: 'ORD-123',
          customField: 'customValue',
        },
      });

      expect(entry.metadata?.orderId).toBe('ORD-123');
      expect(entry.metadata?.customField).toBe('customValue');
    });

    it('should include recorded timestamp in metadata', () => {
      const entry = deliveryTimelineService.recordEvent({
        deliveryId: testDeliveryId,
        event: 'CREATED',
        metadata: { customData: 'test' },
      });

      expect(entry.metadata?.recordedAt).toBeDefined();
    });
  });
});
