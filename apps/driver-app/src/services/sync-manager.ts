import { authService } from './auth';
import {
  getPendingEvents,
  markEventSynced,
  markEventError,
  OfflineEvent,
} from './offline-event-service';
import { connectivityMonitor } from './connectivity-monitor';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const BATCH_ENDPOINT = `${API_BASE}/api/deliveries/events/batch`;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

export type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

type SyncListener = (state: SyncState) => void;

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: number | null;
  errorEvents: string[];
}

class SyncManager {
  private syncInProgress = false;
  private lastSyncAt: number | null = null;
  private listeners: Set<SyncListener> = new Set();
  private state: SyncState = {
    status: 'idle',
    pendingCount: 0,
    lastSyncAt: null,
    errorEvents: [],
  };

  constructor() {
    connectivityMonitor.subscribe((isOnline) => {
      if (isOnline) {
        this.flush().catch(() => {});
      }
    });
  }

  getState(): SyncState {
    return { ...this.state };
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async flush(): Promise<void> {
    if (this.syncInProgress || !connectivityMonitor.isCurrentlyOnline()) return;
    this.syncInProgress = true;
    this.emit({ status: 'syncing' });

    try {
      const pending = await getPendingEvents();
      if (pending.length === 0) {
        this.lastSyncAt = Date.now();
        this.emit({ status: 'done', pendingCount: 0, lastSyncAt: this.lastSyncAt });
        return;
      }

      // Process tier 1 first (priority=1), then tier 2 (priority=2)
      const tier1 = pending.filter((e) => e.sync_priority === 1);
      const tier2 = pending.filter((e) => e.sync_priority === 2);

      await this.processBatch(tier1);

      // Tier 2: within 60 seconds — process after a brief yield
      if (tier2.length > 0) {
        await this.processBatch(tier2);
      }

      this.lastSyncAt = Date.now();
      const remaining = await this.countPending();
      this.emit({
        status: remaining === 0 ? 'done' : 'error',
        pendingCount: remaining,
        lastSyncAt: this.lastSyncAt,
      });
    } catch (err) {
      this.emit({ status: 'error' });
    } finally {
      this.syncInProgress = false;
    }
  }

  private async processBatch(events: OfflineEvent[]): Promise<void> {
    if (events.length === 0) return;

    const token = await authService.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const body = events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      deliveryId: e.delivery_id,
      payload: JSON.parse(e.payload as unknown as string),
      deviceCapturedAt: e.device_captured_at,
      gpsLat: e.gps_lat,
      gpsLng: e.gps_lng,
      deviceTimezone: e.device_timezone,
    }));

    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const response = await fetch(BATCH_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify({ events: body }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json() as { succeeded: string[]; failed: Array<{ id: string; error: string }> };

        for (const id of result.succeeded ?? []) {
          await markEventSynced(id);
        }

        for (const { id, error } of result.failed ?? []) {
          const event = events.find((e) => e.id === id);
          const retryCount = (event?.retry_count ?? 0) + 1;
          await markEventError(id, error, retryCount);
        }

        return;
      } catch (err) {
        attempt++;
        if (attempt >= MAX_RETRIES) {
          // Mark all events in this batch as error
          for (const event of events) {
            await markEventError(
              event.id,
              err instanceof Error ? err.message : String(err),
              MAX_RETRIES,
            );
          }
          return;
        }
        // Exponential backoff
        await delay(BASE_BACKOFF_MS * Math.pow(2, attempt - 1));
      }
    }
  }

  private async countPending(): Promise<number> {
    const events = await getPendingEvents();
    return events.length;
  }

  private emit(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.state));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const syncManager = new SyncManager();
