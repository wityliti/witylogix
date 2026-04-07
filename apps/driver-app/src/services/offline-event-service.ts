import * as Location from 'expo-location';
import { getDb } from '../lib/sqlite-db';

export type EventType = 'status_transition' | 'pod_signature';

export type StatusTransitionType =
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery';

export interface OfflineEvent {
  id: string;
  event_type: EventType;
  delivery_id: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'synced' | 'error';
  sync_priority: 1 | 2;
  retry_count: number;
  device_captured_at: number;
  gps_lat: number | null;
  gps_lng: number | null;
  last_error: string | null;
  device_timezone: string | null;
}

/** Tier 1: POD and final delivery status — sync immediately */
const TIER1_STATUS: StatusTransitionType[] = ['delivered', 'failed_delivery'];

function resolvePriority(
  eventType: EventType,
  status?: StatusTransitionType,
): 1 | 2 {
  if (eventType === 'pod_signature') return 1;
  if (status && TIER1_STATUS.includes(status)) return 1;
  return 2;
}

function captureTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

async function captureGps(): Promise<{ lat: number | null; lng: number | null }> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return { lat: null, lng: null };
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return { lat: null, lng: null };
  }
}

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function captureStatusTransition(
  deliveryId: string,
  status: StatusTransitionType,
  extra?: Record<string, unknown>,
): Promise<string> {
  const db = await getDb();
  const { lat, lng } = await captureGps();
  const timezone = captureTimezone();
  const id = generateId();
  const now = Date.now();
  const priority = resolvePriority('status_transition', status);
  const payload = JSON.stringify({ status, ...extra });

  await db.runAsync(
    `INSERT INTO offline_events
       (id, event_type, delivery_id, payload, status, sync_priority, retry_count, device_captured_at, gps_lat, gps_lng, last_error, device_timezone)
     VALUES (?, ?, ?, ?, 'pending', ?, 0, ?, ?, ?, NULL, ?)`,
    [id, 'status_transition', deliveryId, payload, priority, now, lat, lng, timezone],
  );

  return id;
}

export async function capturePodSignature(
  deliveryId: string,
  signatureData: string,
  extra?: Record<string, unknown>,
): Promise<string> {
  const db = await getDb();
  const { lat, lng } = await captureGps();
  const timezone = captureTimezone();
  const id = generateId();
  const now = Date.now();
  const payload = JSON.stringify({ signatureData, ...extra });

  await db.runAsync(
    `INSERT INTO offline_events
       (id, event_type, delivery_id, payload, status, sync_priority, retry_count, device_captured_at, gps_lat, gps_lng, last_error, device_timezone)
     VALUES (?, ?, ?, ?, 'pending', 1, 0, ?, ?, ?, NULL, ?)`,
    [id, 'pod_signature', deliveryId, payload, now, lat, lng, timezone],
  );

  return id;
}

export async function getPendingEvents(): Promise<OfflineEvent[]> {
  const db = await getDb();
  return db.getAllAsync<OfflineEvent>(
    `SELECT * FROM offline_events
     WHERE status = 'pending'
     ORDER BY sync_priority ASC, device_captured_at ASC`,
  );
}

export async function markEventSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_events SET status = 'synced' WHERE id = ?`,
    [id],
  );
}

export async function markEventError(id: string, error: string, retryCount: number): Promise<void> {
  const db = await getDb();
  const status = retryCount >= 5 ? 'error' : 'pending';
  await db.runAsync(
    `UPDATE offline_events SET status = ?, retry_count = ?, last_error = ? WHERE id = ?`,
    [status, retryCount, error, id],
  );
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM offline_events WHERE status = 'pending'`,
  );
  return row?.count ?? 0;
}

export async function getErrorEvents(): Promise<OfflineEvent[]> {
  const db = await getDb();
  return db.getAllAsync<OfflineEvent>(
    `SELECT * FROM offline_events WHERE status = 'error' ORDER BY device_captured_at ASC`,
  );
}
