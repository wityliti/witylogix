/**
 * Event-sourced append queue for WIT-94 offline mode.
 *
 * Design principles:
 * - Append-only: events are never overwritten or mutated in place after creation.
 * - Each event carries a UUID eventId used for server-side idempotency dedup.
 * - Sync priority: DELIVERY_STATUS(1) = POD_SIGNATURE(1) = FAILED_DELIVERY(1)
 *                  > PHOTO_EVIDENCE(2) > STOP_RESEQUENCED(3) > RTS_WORKFLOW(4)
 * - Conflict resolution: server returns 409 with terminal state → markConflict()
 *   surfaces the message to driver UI, event is removed from pending.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeliveryEventType =
  | 'DELIVERY_STATUS'
  | 'POD_SIGNATURE'
  | 'FAILED_DELIVERY'
  | 'STOP_RESEQUENCED'
  | 'PHOTO_EVIDENCE'
  | 'RTS_WORKFLOW';

export type FailedDeliveryReason =
  | 'not_home'
  | 'wrong_address'
  | 'refused'
  | 'damaged'
  | 'access_denied'
  | 'business_closed';

export type EventStatus = 'pending' | 'synced' | 'conflict' | 'error';

export interface DriverGPS {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface OfflineEvent {
  eventId: string;
  type: DeliveryEventType;
  deliveryId: string;
  payload: Record<string, unknown>;
  /** device_captured_at — immutable, set at append time */
  timestamp: number;
  driverGPS: DriverGPS | null;
  syncPriority: number;
  status: EventStatus;
  retryCount: number;
  conflictMessage?: string;
}

export interface AppendInput {
  type: DeliveryEventType;
  deliveryId: string;
  payload: Record<string, unknown>;
  driverGPS: DriverGPS | null;
}

export interface QueueSummary {
  pending: number;
  synced: number;
  conflict: number;
  error: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum base64 size for PHOTO_EVIDENCE payload (1 MB). */
const MAX_PHOTO_BYTES = 1_048_576;

/** Max retries before an event is moved to 'error' status. */
const MAX_RETRIES = 5;

export const SYNC_PRIORITY: Record<DeliveryEventType, number> = {
  DELIVERY_STATUS: 1,
  POD_SIGNATURE: 1,
  FAILED_DELIVERY: 1,
  PHOTO_EVIDENCE: 2,
  STOP_RESEQUENCED: 3,
  RTS_WORKFLOW: 4,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a UUID v4-style event ID for idempotency deduplication.
 * Uses crypto.randomUUID when available (Node 14.17+, browsers), with a
 * Math.random fallback for older React Native environments.
 */
export function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// AppendQueue
// ---------------------------------------------------------------------------

export class AppendQueue {
  private readonly store = new Map<string, OfflineEvent>();

  /**
   * Append a new event to the queue. Never mutates existing events.
   * Returns the eventId of the new entry.
   *
   * @throws {Error} if PHOTO_EVIDENCE payload exceeds MAX_PHOTO_BYTES
   */
  append(input: AppendInput): string {
    if (input.type === 'PHOTO_EVIDENCE') {
      const photo = input.payload.photoBase64 as string | undefined;
      if (photo && photo.length > MAX_PHOTO_BYTES) {
        throw new Error(
          `Photo size (${photo.length} bytes) exceeds the maximum allowed size of ${MAX_PHOTO_BYTES} bytes.`
        );
      }
    }

    const eventId = createEventId();
    const event: OfflineEvent = {
      eventId,
      type: input.type,
      deliveryId: input.deliveryId,
      payload: input.payload,
      timestamp: Date.now(),
      driverGPS: input.driverGPS,
      syncPriority: SYNC_PRIORITY[input.type],
      status: 'pending',
      retryCount: 0,
    };

    this.store.set(eventId, event);
    return eventId;
  }

  /** Retrieve a single event by its eventId. */
  get(eventId: string): OfflineEvent | undefined {
    return this.store.get(eventId);
  }

  /** All events in insertion order. */
  all(): OfflineEvent[] {
    return Array.from(this.store.values());
  }

  /**
   * Returns pending events sorted by syncPriority (asc) then timestamp (asc).
   * Excludes synced, conflict, and error events.
   */
  pendingByPriority(): OfflineEvent[] {
    return Array.from(this.store.values())
      .filter((e) => e.status === 'pending')
      .sort((a, b) => a.syncPriority - b.syncPriority || a.timestamp - b.timestamp);
  }

  // ── Status transitions ────────────────────────────────────────────────────

  /** Mark event as successfully synced to the server. */
  markSynced(eventId: string): void {
    const event = this.store.get(eventId);
    if (event) {
      event.status = 'synced';
    }
  }

  /**
   * Mark event as conflicted — the server has a newer terminal state.
   * The conflictMessage is surfaced to the driver via UI notification.
   */
  markConflict(eventId: string, message: string): void {
    const event = this.store.get(eventId);
    if (event) {
      event.status = 'conflict';
      event.conflictMessage = message;
    }
  }

  /**
   * Driver has acknowledged the conflict notification.
   * Removes the event from the queue entirely.
   */
  acknowledgeConflict(eventId: string): void {
    this.store.delete(eventId);
  }

  /**
   * Record a sync attempt failure. Increments retryCount.
   * After MAX_RETRIES the event is moved to 'error' status and excluded
   * from future sync attempts.
   */
  markError(eventId: string, lastError: string): void {
    const event = this.store.get(eventId);
    if (!event) return;
    event.retryCount += 1;
    if (event.retryCount >= MAX_RETRIES) {
      event.status = 'error';
    }
    // Store last error message in payload for debugging (non-breaking)
    (event.payload as Record<string, unknown>).__lastError = lastError;
  }

  /** All events currently in 'conflict' status (awaiting driver acknowledgement). */
  conflicts(): OfflineEvent[] {
    return Array.from(this.store.values()).filter((e) => e.status === 'conflict');
  }

  /** Summary counts for offline indicator UI. */
  summary(): QueueSummary {
    const events = Array.from(this.store.values());
    return {
      pending: events.filter((e) => e.status === 'pending').length,
      synced: events.filter((e) => e.status === 'synced').length,
      conflict: events.filter((e) => e.status === 'conflict').length,
      error: events.filter((e) => e.status === 'error').length,
      total: events.length,
    };
  }
}
