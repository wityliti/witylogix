/**
 * SQLite offline store schema for the Witylogix driver app.
 *
 * Tables
 * ------
 * offline_events   – delivery events captured while offline, queued for sync
 * cached_routes    – route data cached for offline navigation
 * cached_deliveries – delivery details cached for offline access
 * pod_assets       – proof-of-delivery files (signatures, photos) pending upload
 */

// ─── Table: offline_events ───────────────────────────────────────────────────

export type SyncStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "error";
export type AssetType = "signature" | "photo_delivery" | "photo_exception";

export interface OfflineEvent {
  id: string;
  event_type: string;
  delivery_id: string;
  payload: string; // JSON string
  /** ISO-8601 captured on device — NEVER overwritten with server time */
  device_captured_at: string;
  /** IANA timezone string, e.g. "America/New_York" */
  device_timezone: string;
  gps_lat: number | null;
  gps_lng: number | null;
  retry_count: number;
  sync_status: SyncStatus;
  server_received_at: string | null;
  server_response: string | null; // JSON string
}

// ─── Table: cached_routes ────────────────────────────────────────────────────

export interface CachedRoute {
  route_id: string;
  route_data: string; // JSON string
  cached_at: string; // ISO-8601
  expires_at: string; // ISO-8601
}

// ─── Table: cached_deliveries ────────────────────────────────────────────────

export interface CachedDelivery {
  delivery_id: string;
  delivery_data: string; // JSON string
  cached_at: string; // ISO-8601
}

// ─── Table: pod_assets ───────────────────────────────────────────────────────

export interface PodAsset {
  id: string;
  event_id: string;
  asset_type: AssetType;
  file_path: string;
  sync_status: SyncStatus;
}

// ─── Migration SQL ───────────────────────────────────────────────────────────

export const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT    NOT NULL UNIQUE,
    run_at  TEXT    NOT NULL
  )
`;

export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    name: "001_create_offline_events",
    sql: `
      CREATE TABLE IF NOT EXISTS offline_events (
        id                TEXT    PRIMARY KEY NOT NULL,
        event_type        TEXT    NOT NULL,
        delivery_id       TEXT    NOT NULL,
        payload           TEXT    NOT NULL DEFAULT '{}',
        device_captured_at TEXT   NOT NULL,
        device_timezone   TEXT    NOT NULL,
        gps_lat           REAL,
        gps_lng           REAL,
        retry_count       INTEGER NOT NULL DEFAULT 0,
        sync_status       TEXT    NOT NULL DEFAULT 'pending'
          CHECK (sync_status IN ('pending','syncing','synced','conflict','error')),
        server_received_at TEXT,
        server_response   TEXT
      )
    `,
  },
  {
    name: "002_create_cached_routes",
    sql: `
      CREATE TABLE IF NOT EXISTS cached_routes (
        route_id   TEXT PRIMARY KEY NOT NULL,
        route_data TEXT NOT NULL DEFAULT '{}',
        cached_at  TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `,
  },
  {
    name: "003_create_cached_deliveries",
    sql: `
      CREATE TABLE IF NOT EXISTS cached_deliveries (
        delivery_id   TEXT PRIMARY KEY NOT NULL,
        delivery_data TEXT NOT NULL DEFAULT '{}',
        cached_at     TEXT NOT NULL
      )
    `,
  },
  {
    name: "004_create_pod_assets",
    sql: `
      CREATE TABLE IF NOT EXISTS pod_assets (
        id          TEXT PRIMARY KEY NOT NULL,
        event_id    TEXT NOT NULL,
        asset_type  TEXT NOT NULL
          CHECK (asset_type IN ('signature','photo_delivery','photo_exception')),
        file_path   TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (sync_status IN ('pending','syncing','synced','conflict','error'))
      )
    `,
  },
];
