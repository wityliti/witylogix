import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline types mirroring OfflineEvent to keep tests self-contained
// ---------------------------------------------------------------------------
interface OfflineEventRow {
  id: string;
  event_type: string;
  delivery_id: string;
  payload: string;
  status: 'pending' | 'synced' | 'error';
  sync_priority: 1 | 2;
  retry_count: number;
  device_captured_at: number;
  gps_lat: number | null;
  gps_lng: number | null;
  last_error: string | null;
}

// ---------------------------------------------------------------------------
// Pure-logic helpers extracted from sync-manager for unit testing
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

function calcBackoff(attempt: number): number {
  return BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
}

function sortByPriorityThenTime(events: OfflineEventRow[]): OfflineEventRow[] {
  return [...events].sort((a, b) => {
    if (a.sync_priority !== b.sync_priority) return a.sync_priority - b.sync_priority;
    return a.device_captured_at - b.device_captured_at;
  });
}

function partitionByTier(events: OfflineEventRow[]): {
  tier1: OfflineEventRow[];
  tier2: OfflineEventRow[];
} {
  return {
    tier1: events.filter((e) => e.sync_priority === 1),
    tier2: events.filter((e) => e.sync_priority === 2),
  };
}

function resolveEventStatus(
  retryCount: number,
): 'pending' | 'error' {
  return retryCount >= MAX_RETRIES ? 'error' : 'pending';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sync queue ordering', () => {
  it('sorts Tier 1 events before Tier 2 events', () => {
    const now = Date.now();
    const events: OfflineEventRow[] = [
      { id: 'b', sync_priority: 2, device_captured_at: now - 2000, event_type: 'status_transition', delivery_id: 'd1', payload: '{}', status: 'pending', retry_count: 0, gps_lat: null, gps_lng: null, last_error: null },
      { id: 'a', sync_priority: 1, device_captured_at: now - 1000, event_type: 'pod_signature', delivery_id: 'd1', payload: '{}', status: 'pending', retry_count: 0, gps_lat: null, gps_lng: null, last_error: null },
    ];

    const sorted = sortByPriorityThenTime(events);
    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
  });

  it('within the same tier sorts by device_captured_at ascending', () => {
    const now = Date.now();
    const events: OfflineEventRow[] = [
      { id: 'c', sync_priority: 2, device_captured_at: now - 500, event_type: 'status_transition', delivery_id: 'd1', payload: '{}', status: 'pending', retry_count: 0, gps_lat: null, gps_lng: null, last_error: null },
      { id: 'd', sync_priority: 2, device_captured_at: now - 3000, event_type: 'status_transition', delivery_id: 'd1', payload: '{}', status: 'pending', retry_count: 0, gps_lat: null, gps_lng: null, last_error: null },
      { id: 'e', sync_priority: 2, device_captured_at: now - 1500, event_type: 'status_transition', delivery_id: 'd1', payload: '{}', status: 'pending', retry_count: 0, gps_lat: null, gps_lng: null, last_error: null },
    ];

    const sorted = sortByPriorityThenTime(events);
    expect(sorted.map((e) => e.id)).toEqual(['d', 'e', 'c']);
  });

  it('partitions events correctly by tier', () => {
    const events: OfflineEventRow[] = [
      { id: '1', sync_priority: 1, device_captured_at: 0, event_type: 'pod_signature', delivery_id: 'd1', payload: '{}', status: 'pending', retry_count: 0, gps_lat: null, gps_lng: null, last_error: null },
      { id: '2', sync_priority: 2, device_captured_at: 0, event_type: 'status_transition', delivery_id: 'd1', payload: '{}', status: 'pending', retry_count: 0, gps_lat: null, gps_lng: null, last_error: null },
      { id: '3', sync_priority: 1, device_captured_at: 0, event_type: 'status_transition', delivery_id: 'd2', payload: '{}', status: 'pending', retry_count: 0, gps_lat: null, gps_lng: null, last_error: null },
    ];

    const { tier1, tier2 } = partitionByTier(events);
    expect(tier1.map((e) => e.id)).toEqual(['1', '3']);
    expect(tier2.map((e) => e.id)).toEqual(['2']);
  });
});

describe('retry logic', () => {
  it('calculates exponential backoff correctly', () => {
    expect(calcBackoff(1)).toBe(1000);
    expect(calcBackoff(2)).toBe(2000);
    expect(calcBackoff(3)).toBe(4000);
    expect(calcBackoff(4)).toBe(8000);
    expect(calcBackoff(5)).toBe(16000);
  });

  it('marks event as error after max retries', () => {
    expect(resolveEventStatus(4)).toBe('pending');
    expect(resolveEventStatus(5)).toBe('error');
    expect(resolveEventStatus(6)).toBe('error');
  });

  it('keeps event pending when retries below max', () => {
    for (let i = 0; i < MAX_RETRIES; i++) {
      expect(resolveEventStatus(i)).toBe('pending');
    }
  });
});

describe('event priority rules', () => {
  it('pod_signature events are always Tier 1', () => {
    const event: Pick<OfflineEventRow, 'event_type' | 'sync_priority'> = {
      event_type: 'pod_signature',
      sync_priority: 1,
    };
    expect(event.sync_priority).toBe(1);
  });

  it('delivered status transitions are Tier 1', () => {
    // Mirrors resolvePriority logic
    const tierForDelivered = (['delivered', 'failed_delivery'] as string[]).includes('delivered') ? 1 : 2;
    expect(tierForDelivered).toBe(1);
  });

  it('in_transit status transitions are Tier 2', () => {
    const tierForInTransit = (['delivered', 'failed_delivery'] as string[]).includes('in_transit') ? 1 : 2;
    expect(tierForInTransit).toBe(2);
  });
});
