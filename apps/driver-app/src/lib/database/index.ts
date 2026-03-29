import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';
import { deriveEncryptionKey } from './encryption';
import type {
  OfflineEvent,
  CachedRoute,
  CachedDelivery,
  PodAsset,
  SyncStatus,
} from './schema';

export type { OfflineEvent, CachedRoute, CachedDelivery, PodAsset, SyncStatus };

const DB_NAME = 'witylogix_driver.db';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Opens (or returns the cached) encrypted SQLite database and runs all
 * pending schema migrations.
 *
 * Must be called once after the driver authenticates so the encryption key
 * can be derived from their auth token.
 *
 * @param authToken  Raw JWT from expo-secure-store. Used to derive the AES key.
 */
export async function openDatabase(authToken: string): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  const encryptionKey = await deriveEncryptionKey(authToken);

  _db = await SQLite.openDatabaseAsync(DB_NAME, { encryptionKey });
  await runMigrations(_db);

  return _db;
}

/**
 * Returns the open database instance. Throws if `openDatabase` has not been
 * called yet — callers should ensure the DB is initialised at app startup.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error('Database not initialised. Call openDatabase() first.');
  }
  return _db;
}

/**
 * Closes the database and clears the cached instance.
 * Call on logout so the next login re-derives the key.
 */
export async function closeDatabase(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}

// ─── offline_events ──────────────────────────────────────────────────────────

export async function insertOfflineEvent(
  db: SQLite.SQLiteDatabase,
  event: OfflineEvent,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO offline_events
       (id, event_type, delivery_id, payload, device_captured_at,
        device_timezone, gps_lat, gps_lng, retry_count, sync_status,
        server_received_at, server_response)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.event_type,
      event.delivery_id,
      event.payload,
      event.device_captured_at,
      event.device_timezone,
      event.gps_lat ?? null,
      event.gps_lng ?? null,
      event.retry_count,
      event.sync_status,
      event.server_received_at ?? null,
      event.server_response ?? null,
    ],
  );
}

export async function getOfflineEventsByStatus(
  db: SQLite.SQLiteDatabase,
  status: SyncStatus,
): Promise<OfflineEvent[]> {
  return db.getAllAsync<OfflineEvent>(
    'SELECT * FROM offline_events WHERE sync_status = ? ORDER BY device_captured_at ASC',
    [status],
  );
}

export async function updateOfflineEventSyncStatus(
  db: SQLite.SQLiteDatabase,
  id: string,
  status: SyncStatus,
  serverReceivedAt?: string,
  serverResponse?: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE offline_events
     SET sync_status = ?, server_received_at = ?, server_response = ?
     WHERE id = ?`,
    [status, serverReceivedAt ?? null, serverResponse ?? null, id],
  );
}

export async function incrementOfflineEventRetry(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE offline_events SET retry_count = retry_count + 1 WHERE id = ?',
    [id],
  );
}

// ─── cached_routes ───────────────────────────────────────────────────────────

export async function upsertCachedRoute(
  db: SQLite.SQLiteDatabase,
  route: CachedRoute,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO cached_routes (route_id, route_data, cached_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(route_id) DO UPDATE SET
       route_data = excluded.route_data,
       cached_at  = excluded.cached_at,
       expires_at = excluded.expires_at`,
    [route.route_id, route.route_data, route.cached_at, route.expires_at],
  );
}

export async function getCachedRoute(
  db: SQLite.SQLiteDatabase,
  routeId: string,
): Promise<CachedRoute | null> {
  return db.getFirstAsync<CachedRoute>(
    'SELECT * FROM cached_routes WHERE route_id = ?',
    [routeId],
  );
}

export async function deleteExpiredRoutes(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(
    'DELETE FROM cached_routes WHERE expires_at < ?',
    [new Date().toISOString()],
  );
}

// ─── cached_deliveries ───────────────────────────────────────────────────────

export async function upsertCachedDelivery(
  db: SQLite.SQLiteDatabase,
  delivery: CachedDelivery,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO cached_deliveries (delivery_id, delivery_data, cached_at)
     VALUES (?, ?, ?)
     ON CONFLICT(delivery_id) DO UPDATE SET
       delivery_data = excluded.delivery_data,
       cached_at     = excluded.cached_at`,
    [delivery.delivery_id, delivery.delivery_data, delivery.cached_at],
  );
}

export async function getCachedDelivery(
  db: SQLite.SQLiteDatabase,
  deliveryId: string,
): Promise<CachedDelivery | null> {
  return db.getFirstAsync<CachedDelivery>(
    'SELECT * FROM cached_deliveries WHERE delivery_id = ?',
    [deliveryId],
  );
}

// ─── pod_assets ──────────────────────────────────────────────────────────────

export async function insertPodAsset(
  db: SQLite.SQLiteDatabase,
  asset: PodAsset,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO pod_assets (id, event_id, asset_type, file_path, sync_status)
     VALUES (?, ?, ?, ?, ?)`,
    [asset.id, asset.event_id, asset.asset_type, asset.file_path, asset.sync_status],
  );
}

export async function getPodAssetsByEvent(
  db: SQLite.SQLiteDatabase,
  eventId: string,
): Promise<PodAsset[]> {
  return db.getAllAsync<PodAsset>(
    'SELECT * FROM pod_assets WHERE event_id = ?',
    [eventId],
  );
}

export async function updatePodAssetSyncStatus(
  db: SQLite.SQLiteDatabase,
  id: string,
  status: SyncStatus,
): Promise<void> {
  await db.runAsync(
    'UPDATE pod_assets SET sync_status = ? WHERE id = ?',
    [status, id],
  );
}
