/**
 * Delivery Timeline Module
 *
 * Tracks delivery status changes and events:
 * - Record timeline events with location, timestamp, metadata
 * - Store attachments (photos, signatures)
 * - Query timeline for delivery history
 * - Status progression: CREATED → PICKED_UP → OUT_FOR_DELIVERY → ARRIVED → DELIVERED
 */

import type { TimelineEntry, TimelineEvent, DeliveryStatus, TimelineRecordRequest } from './types.js';

// ─── EVENT DEFINITIONS ──────────────────────────────────────────

const EVENT_DESCRIPTIONS: Record<TimelineEvent, string> = {
  CREATED: 'Delivery order created',
  CONFIRMED: 'Delivery confirmed',
  PICKED_UP: 'Package picked up from sender',
  OUT_FOR_DELIVERY: 'Package out for delivery',
  ARRIVED: 'Arrived at delivery location',
  DELIVERED: 'Package delivered successfully',
  FAILED: 'Delivery failed',
  RESCHEDULED: 'Delivery rescheduled',
  RETURNED: 'Package returned to sender',
};

const EVENT_STATUS_MAP: Record<TimelineEvent, DeliveryStatus> = {
  CREATED: 'pending',
  CONFIRMED: 'confirmed',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  ARRIVED: 'arrived',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RESCHEDULED: 'rescheduled',
  RETURNED: 'returned',
};

// ─── VALID STATUS TRANSITIONS ──────────────────────────────────

const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ['confirmed', 'failed'],
  confirmed: ['picked_up', 'failed', 'rescheduled'],
  picked_up: ['out_for_delivery', 'failed', 'returned'],
  out_for_delivery: ['arrived', 'failed', 'returned'],
  arrived: ['delivered', 'failed', 'rescheduled'],
  delivered: [], // Terminal state
  failed: ['rescheduled', 'returned'], // Can retry or return
  rescheduled: ['confirmed', 'failed'],
  returned: [], // Terminal state
};

// ─── DELIVERY TIMELINE SERVICE ──────────────────────────────────

export class DeliveryTimelineService {
  private timeline: Map<string, TimelineEntry[]> = new Map();

  /**
   * Record an event on the delivery timeline
   *
   * Creates a new TimelineEntry and stores it
   */
  recordEvent(request: TimelineRecordRequest): TimelineEntry {
    const { deliveryId, event, description, latitude, longitude, attachments, metadata } = request;

    if (!deliveryId) {
      throw new Error('Delivery ID is required');
    }

    if (!event) {
      throw new Error('Event type is required');
    }

    // Validate event type
    if (!EVENT_DESCRIPTIONS[event]) {
      throw new Error(`Unknown event type: ${event}`);
    }

    // Determine status from event or use provided
    const status = request.status || EVENT_STATUS_MAP[event];

    // Validate status transition
    const currentTimeline = this.timeline.get(deliveryId) || [];
    const currentStatus = currentTimeline.length > 0
      ? currentTimeline[currentTimeline.length - 1].status
      : 'pending';

    if (!this.isValidTransition(currentStatus, status)) {
      throw new Error(
        `Invalid status transition: ${currentStatus} → ${status}. ` +
          `Allowed: ${VALID_TRANSITIONS[currentStatus as DeliveryStatus]?.join(', ') || 'none'}`
      );
    }

    // Create timeline entry
    const entry: TimelineEntry = {
      id: `tl-${deliveryId}-${Date.now()}`,
      deliveryId,
      event,
      status,
      description: description || EVENT_DESCRIPTIONS[event],
      timestamp: new Date(),
      latitude,
      longitude,
      attachments,
      metadata: {
        ...metadata,
        recordedAt: new Date().toISOString(),
      },
    };

    // Store in timeline
    const deliveryTimeline = this.timeline.get(deliveryId) || [];
    deliveryTimeline.push(entry);
    this.timeline.set(deliveryId, deliveryTimeline);

    return entry;
  }

  /**
   * Get complete timeline for a delivery
   *
   * Returns all events in chronological order
   */
  getTimeline(deliveryId: string): TimelineEntry[] {
    return this.timeline.get(deliveryId) || [];
  }

  /**
   * Get current delivery status
   */
  getCurrentStatus(deliveryId: string): DeliveryStatus | null {
    const timeline = this.getTimeline(deliveryId);
    if (timeline.length === 0) {
      return null;
    }
    return timeline[timeline.length - 1].status;
  }

  /**
   * Get specific event from timeline
   */
  getEventByType(deliveryId: string, eventType: TimelineEvent): TimelineEntry | null {
    const timeline = this.getTimeline(deliveryId);
    return timeline.find((entry) => entry.event === eventType) || null;
  }

  /**
   * Get events between timestamps
   */
  getEventsBetween(
    deliveryId: string,
    startTime: Date,
    endTime: Date
  ): TimelineEntry[] {
    const timeline = this.getTimeline(deliveryId);
    return timeline.filter((entry) => entry.timestamp >= startTime && entry.timestamp <= endTime);
  }

  /**
   * Update an event (for corrections)
   */
  updateEvent(deliveryId: string, entryId: string, updates: Partial<TimelineEntry>): TimelineEntry | null {
    const timeline = this.timeline.get(deliveryId) || [];
    const index = timeline.findIndex((e) => e.id === entryId);

    if (index === -1) {
      return null;
    }

    // Create updated entry
    const entry = timeline[index];
    const updated: TimelineEntry = {
      ...entry,
      ...updates,
      id: entry.id, // Preserve ID
      deliveryId: entry.deliveryId, // Preserve delivery ID
      timestamp: entry.timestamp, // Preserve original timestamp
    };

    // Update in array
    timeline[index] = updated;
    this.timeline.set(deliveryId, timeline);

    return updated;
  }

  /**
   * Clear timeline (for testing or data reset)
   */
  clearTimeline(deliveryId: string): void {
    this.timeline.delete(deliveryId);
  }

  /**
   * Get all deliveries with timeline
   */
  getAllDeliveries(): Map<string, TimelineEntry[]> {
    return new Map(this.timeline);
  }

  // ─── HELPERS ────────────────────────────────────────────────

  /**
   * Check if status transition is valid
   */
  private isValidTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
    // Same status is allowed (idempotent)
    if (from === to) {
      return true;
    }

    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }
}

// ─── SINGLETON INSTANCE ─────────────────────────────────────────

export const deliveryTimelineService = new DeliveryTimelineService();

// ─── EXPORTS ────────────────────────────────────────────────────

export { EVENT_DESCRIPTIONS, EVENT_STATUS_MAP, VALID_TRANSITIONS };
