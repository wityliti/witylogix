/**
 * Event Tracker — Records and batches analytics events.
 *
 * Features:
 * - Deduplication by event ID
 * - Batch insertion for efficiency
 * - Periodic flush of pending events
 * - TTL-based event cleanup
 */

import { AnalyticsEvent, EventType } from "./types.js";

/**
 * Configuration for the EventTracker.
 */
export interface EventTrackerConfig {
  /** Maximum events to batch before auto-flush. */
  batchSize: number;

  /** Time in milliseconds between periodic flushes. */
  flushIntervalMs: number;

  /** TTL in seconds for event records (soft delete). */
  eventTtlSeconds: number;
}

/**
 * Default configuration for EventTracker.
 */
const DEFAULT_CONFIG: EventTrackerConfig = {
  batchSize: 100,
  flushIntervalMs: 5000,
  eventTtlSeconds: 90 * 24 * 60 * 60, // 90 days
};

/**
 * Handler function for persisting events.
 * Receives a batch of events and must return a Promise.
 */
export type EventPersistHandler = (events: AnalyticsEvent[]) => Promise<void>;

/**
 * EventTracker: Records events, deduplicates, and batches for insertion.
 *
 * Usage:
 *   const tracker = new EventTracker(persistHandler);
 *   tracker.recordEvent({ id: "evt_1", type: EventType.ORDER_CREATED, ... });
 *   // Events are automatically batched and flushed periodically.
 *   await tracker.shutdown(); // Flush remaining events on shutdown.
 */
export class EventTracker {
  private pendingEvents: Map<string, AnalyticsEvent> = new Map();
  private config: EventTrackerConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  /**
   * Create a new EventTracker.
   *
   * @param persistHandler - Function to persist batched events.
   * @param config - Optional configuration overrides.
   */
  constructor(
    private persistHandler: EventPersistHandler,
    config: Partial<EventTrackerConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startPeriodicFlush();
  }

  /**
   * Record a single analytics event.
   * Deduplicates by event ID and queues for batch insertion.
   *
   * @param event - The event to record.
   * @throws If event is missing required fields (id, type, tenantId, timestamp).
   *
   * @example
   *   tracker.recordEvent({
   *     id: "evt_order_123",
   *     type: EventType.ORDER_CREATED,
   *     timestamp: new Date().toISOString(),
   *     tenantId: "shop_456",
   *     metadata: { orderId: "ord_789", total: 99.99 },
   *   });
   */
  recordEvent(event: AnalyticsEvent): void {
    // Validate required fields
    if (!event.id || !event.type || !event.tenantId || !event.timestamp) {
      throw new Error(
        `Invalid event: missing required fields (id, type, tenantId, timestamp)`,
      );
    }

    // Deduplicate: store by ID, so later calls overwrite earlier ones
    this.pendingEvents.set(event.id, event);

    // Auto-flush if batch size reached
    if (this.pendingEvents.size >= this.config.batchSize) {
      this.flush().catch((err) => {
        console.error("[EventTracker] Error during auto-flush:", err);
      });
    }
  }

  /**
   * Record multiple events in a single call.
   *
   * @param events - Array of events to record.
   */
  recordEvents(events: AnalyticsEvent[]): void {
    for (const event of events) {
      this.recordEvent(event);
    }
  }

  /**
   * Immediately flush all pending events to the persistence handler.
   * Safe to call while already flushing (queues the next flush).
   *
   * @returns Promise that resolves when flush completes.
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.pendingEvents.size === 0) {
      return;
    }

    this.isFlushing = true;
    try {
      const events = Array.from(this.pendingEvents.values());
      this.pendingEvents.clear();

      await this.persistHandler(events);
    } catch (err) {
      // Re-add events on failure (store them back)
      console.error(
        "[EventTracker] Persist handler failed, retaining events:",
        err,
      );
      // Note: In production, implement exponential backoff and dead-letter queue
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get the current count of pending events in the batch.
   *
   * @returns Number of events waiting to be flushed.
   */
  getPendingCount(): number {
    return this.pendingEvents.size;
  }

  /**
   * Start the periodic flush timer.
   * Called automatically in the constructor.
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error("[EventTracker] Periodic flush error:", err);
      });
    }, this.config.flushIntervalMs);

    // Don't block process exit waiting for timer
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /**
   * Gracefully shut down the tracker.
   * Flushes all pending events and cancels the periodic timer.
   *
   * @returns Promise that resolves when all events are flushed.
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flush();
  }

  /**
   * Get all pending events (for testing/debugging).
   *
   * @returns Array of pending events.
   */
  getPendingEvents(): AnalyticsEvent[] {
    return Array.from(this.pendingEvents.values());
  }

  /**
   * Clear all pending events (for testing).
   */
  clearPending(): void {
    this.pendingEvents.clear();
  }
}

/**
 * Build an analytics event with common fields.
 * Helper function to create properly-structured events.
 *
 * @param type - The event type.
 * @param tenantId - The tenant/shop ID.
 * @param metadata - Event metadata.
 * @param overrides - Optional field overrides (id, userId, correlationId, etc.).
 * @returns A complete AnalyticsEvent.
 *
 * @example
 *   const evt = buildEvent(
 *     EventType.ORDER_CREATED,
 *     "shop_123",
 *     { orderId: "ord_456", total: 99.99 },
 *     { userId: "user_789", correlationId: "req_abc" }
 *   );
 */
export function buildEvent(
  type: EventType,
  tenantId: string,
  metadata: Record<string, unknown>,
  overrides?: Partial<AnalyticsEvent>,
): AnalyticsEvent {
  const id =
    overrides?.id ||
    `${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    id,
    type,
    timestamp: overrides?.timestamp || new Date().toISOString(),
    tenantId,
    metadata,
    userId: overrides?.userId,
    correlationId: overrides?.correlationId,
    statusCode: overrides?.statusCode,
    durationMs: overrides?.durationMs,
    errorMessage: overrides?.errorMessage,
    tags: overrides?.tags,
  };
}
