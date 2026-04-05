import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('witylogix.db');
  await initSchema(db);
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      delivery_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sync_priority INTEGER NOT NULL DEFAULT 2,
      retry_count INTEGER NOT NULL DEFAULT 0,
      device_captured_at INTEGER NOT NULL,
      gps_lat REAL,
      gps_lng REAL,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_offline_events_status
      ON offline_events (status);

    CREATE INDEX IF NOT EXISTS idx_offline_events_priority_time
      ON offline_events (sync_priority ASC, device_captured_at ASC);
  `);
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
