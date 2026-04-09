/**
 * Unit tests for the SQLite offline store — WIT-125
 *
 * Covers:
 * - Migration runner creates all 4 tables (tracked in _migrations)
 * - Migrations are idempotent (running twice applies no duplicates)
 * - Basic CRUD for offline_events, cached_routes, cached_deliveries, pod_assets
 * - Encryption key derivation produces consistent, distinct output
 * - device_captured_at is immutable (updateOfflineEventSyncStatus never touches it)
 *
 * Strategy: use a pure JS in-memory store that implements the expo-sqlite v14
 * async API surface. This runs without native modules in any Node environment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runMigrations, listAppliedMigrations } from '../database/migrations';
import {
  insertOfflineEvent,
  getOfflineEventsByStatus,
  updateOfflineEventSyncStatus,
  incrementOfflineEventRetry,
  upsertCachedRoute,
  getCachedRoute,
  deleteExpiredRoutes,
  upsertCachedDelivery,
  getCachedDelivery,
  insertPodAsset,
  getPodAssetsByEvent,
  updatePodAssetSyncStatus,
} from '../database/index';
import { deriveEncryptionKeySync } from '../database/encryption';
import type { OfflineEvent, CachedRoute, CachedDelivery, PodAsset } from '../database/schema';
import { MIGRATIONS } from '../database/schema';

vi.mock('expo-sqlite', () => ({ openDatabaseAsync: vi.fn() }));
vi.mock('expo-crypto', () => ({
  digestStringAsync: vi.fn(async (_algo: unknown, input: string) =>
    Buffer.from(input, 'utf8').toString('hex').slice(0, 64),
  ),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
}));

// ─── Pure JS in-memory SQLite-like database ──────────────────────────────────

interface Row { [col: string]: unknown }

/**
 * Minimal SQL interpreter implementing the exact queries issued by
 * migrations.ts and index.ts, running purely in JS (no native deps).
 */
class InMemoryDb {
  private tables: Map<string, Row[]> = new Map();
  /** Per-table: col → allowed CHECK values (empty means no constraint) */
  private checks: Map<string, Map<string, string[]>> = new Map();
  private autoIncrements: Map<string, number> = new Map();

  private createTable(name: string, checkMap: Map<string, string[]>) {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
      this.checks.set(name, checkMap);
    }
  }

  /** Extract all CHECK(col IN (...)) constraints from a CREATE TABLE body */
  private parseChecks(body: string): Map<string, string[]> {
    const result = new Map<string, string[]>();
    // Match CHECK (col IN ('a','b',...)) — handles multi-char values with commas
    const re = /CHECK\s*\(\s*(\w+)\s+IN\s*\(([^)]+)\)\s*\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const col = m[1];
      const allowed = m[2].split(',').map((v) => v.trim().replace(/'/g, ''));
      result.set(col, allowed);
    }
    return result;
  }

  private assertCheck(tableName: string, col: string, val: unknown) {
    const allowed = this.checks.get(tableName)?.get(col);
    if (allowed && val !== null && val !== undefined && !allowed.includes(val as string)) {
      throw new Error(`CHECK constraint failed: ${tableName}.${col} value '${val}'`);
    }
  }

  private execute(sql: string, params: unknown[]): Row[] {
    sql = sql.trim().replace(/\s+/g, ' ');

    // ── CREATE TABLE IF NOT EXISTS ──────────────────────────────────────────
    if (/^CREATE TABLE IF NOT EXISTS/i.test(sql)) {
      const nameMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (nameMatch) {
        const body = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
        this.createTable(nameMatch[1], this.parseChecks(body));
      }
      return [];
    }

    // ── INSERT INTO ─────────────────────────────────────────────────────────
    if (/^INSERT INTO/i.test(sql)) {
      const tableMatch = sql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)/i);
      if (!tableMatch) return [];
      const tableName = tableMatch[1];
      const cols = tableMatch[2].split(',').map((c) => c.trim());
      const rows = this.tables.get(tableName);
      if (!rows) throw new Error(`Table ${tableName} not found`);

      const row: Row = {};
      // Auto-assign AUTOINCREMENT id
      const autoId = (this.autoIncrements.get(tableName) ?? 0) + 1;
      this.autoIncrements.set(tableName, autoId);
      row['id'] = autoId;

      cols.forEach((col, i) => {
        const val = params[i];
        this.assertCheck(tableName, col, val);
        row[col] = val;
      });

      // ON CONFLICT(pk) DO UPDATE
      if (/ON CONFLICT\((\w+)\) DO UPDATE/i.test(sql)) {
        const pkMatch = sql.match(/ON CONFLICT\((\w+)\)/i)!;
        const pk = pkMatch[1];
        const idx = rows.findIndex((r) => r[pk] === row[pk]);
        if (idx >= 0) { rows[idx] = { ...rows[idx], ...row }; return []; }
      }
      rows.push(row);
      return [];
    }

    // ── UPDATE col = col + 1 (arithmetic increment) ─────────────────────────
    if (/SET\s+(\w+)\s*=\s*\1\s*\+\s*1/i.test(sql)) {
      const tableMatch = sql.match(/UPDATE (\w+)/i)!;
      const colMatch = sql.match(/SET\s+(\w+)\s*=\s*\1\s*\+\s*1/i)!;
      const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i)!;
      const tableName = tableMatch[1];
      const incCol = colMatch[1];
      const whereCol = whereMatch[1];
      const rows = this.tables.get(tableName) ?? [];
      for (const row of rows) {
        if (row[whereCol] === params[0]) {
          row[incCol] = ((row[incCol] as number) ?? 0) + 1;
        }
      }
      return [];
    }

    // ── UPDATE ... SET ... WHERE ─────────────────────────────────────────────
    if (/^UPDATE/i.test(sql)) {
      const tableMatch = sql.match(/UPDATE (\w+)/i)!;
      const tableName = tableMatch[1];
      const rows = this.tables.get(tableName) ?? [];

      const setSection = sql.match(/SET\s+(.+?)\s+WHERE/i);
      if (!setSection) return [];
      const whereSection = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      const assignments = setSection[1].split(',').map((a) => a.trim());

      // Count '?' in SET to split params correctly
      const setParamCount = (setSection[1].match(/\?/g) ?? []).length;
      const setPairs: Array<[string, unknown]> = [];
      for (let i = 0; i < assignments.length; i++) {
        const [col] = assignments[i].split('=').map((s) => s.trim());
        const val = params[i];
        this.assertCheck(tableName, col, val);
        setPairs.push([col, val]);
      }
      const whereVal = params[setParamCount];
      const whereCol = whereSection ? whereSection[1] : null;

      for (const row of rows) {
        if (whereCol && row[whereCol] === whereVal) {
          for (const [col, val] of setPairs) row[col] = val;
        }
      }
      return [];
    }

    // ── SELECT ───────────────────────────────────────────────────────────────
    if (/^SELECT/i.test(sql)) {
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      if (!fromMatch) return [];
      let rows = [...(this.tables.get(fromMatch[1]) ?? [])];

      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
      if (whereMatch) {
        const cond = whereMatch[1].trim();
        const eqMatch = cond.match(/^(\w+)\s*=\s*\?$/);
        if (eqMatch) rows = rows.filter((r) => r[eqMatch[1]] === params[0]);
        const ltMatch = cond.match(/^(\w+)\s*<\s*\?$/);
        if (ltMatch) rows = rows.filter((r) => (r[ltMatch[1]] as string) < (params[0] as string));
      }

      // ORDER BY: sort numerically for integer columns, lexically otherwise
      const orderMatch = sql.match(/ORDER BY\s+(\w+)\s+(ASC|DESC)/i);
      if (orderMatch) {
        const col = orderMatch[1];
        const asc = orderMatch[2].toUpperCase() === 'ASC';
        rows.sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (typeof av === 'number' && typeof bv === 'number') {
            return asc ? av - bv : bv - av;
          }
          const as = String(av ?? '');
          const bs = String(bv ?? '');
          return asc ? as.localeCompare(bs) : bs.localeCompare(as);
        });
      }
      return rows;
    }

    // ── DELETE FROM ──────────────────────────────────────────────────────────
    if (/^DELETE FROM/i.test(sql)) {
      const tableMatch = sql.match(/DELETE FROM\s+(\w+)/i);
      if (!tableMatch) return [];
      const tableName = tableMatch[1];
      const rows = this.tables.get(tableName) ?? [];
      const whereMatch = sql.match(/WHERE\s+(.+)$/i);
      if (whereMatch) {
        const ltMatch = whereMatch[1].match(/(\w+)\s*<\s*\?/);
        if (ltMatch) {
          this.tables.set(tableName, rows.filter((r) => !((r[ltMatch[1]] as string) < (params[0] as string))));
        }
      }
      return [];
    }

    return [];
  }

  toMockDb() {
    const self = this;
    return {
      execAsync: async (sql: string) => {
        for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
          self.execute(stmt, []);
        }
      },
      runAsync: async (sql: string, params: unknown[] = []) => {
        self.execute(sql, params);
      },
      getAllAsync: async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
        return self.execute(sql, params) as T[];
      },
      getFirstAsync: async <T>(sql: string, params: unknown[] = []): Promise<T | null> => {
        const rows = self.execute(sql, params);
        return rows.length > 0 ? (rows[0] as T) : null;
      },
      withTransactionAsync: async (fn: () => Promise<void>) => {
        await fn();
      },
    } as unknown as import('expo-sqlite').SQLiteDatabase;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDb() {
  return new InMemoryDb().toMockDb();
}

function makeEvent(overrides: Partial<OfflineEvent> = {}): OfflineEvent {
  return {
    id: 'evt-001',
    event_type: 'delivery_attempt',
    delivery_id: 'del-001',
    payload: JSON.stringify({ note: 'left at door' }),
    device_captured_at: '2026-03-30T10:00:00.000Z',
    device_timezone: 'America/New_York',
    gps_lat: 40.7128,
    gps_lng: -74.006,
    retry_count: 0,
    sync_status: 'pending',
    server_received_at: null,
    server_response: null,
    ...overrides,
  };
}

function makeRoute(overrides: Partial<CachedRoute> = {}): CachedRoute {
  return {
    route_id: 'route-001',
    route_data: JSON.stringify({ stops: 5 }),
    cached_at: '2026-03-30T08:00:00.000Z',
    expires_at: '2026-03-31T08:00:00.000Z',
    ...overrides,
  };
}

function makeDelivery(overrides: Partial<CachedDelivery> = {}): CachedDelivery {
  return {
    delivery_id: 'del-001',
    delivery_data: JSON.stringify({ address: '123 Main St' }),
    cached_at: '2026-03-30T08:00:00.000Z',
    ...overrides,
  };
}

function makeAsset(overrides: Partial<PodAsset> = {}): PodAsset {
  return {
    id: 'asset-001',
    event_id: 'evt-001',
    asset_type: 'signature',
    file_path: '/data/signatures/sig-001.png',
    sync_status: 'pending',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('migrations', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
  });

  it('applies all 4 migrations on first run', async () => {
    await runMigrations(db);
    const applied = await listAppliedMigrations(db);
    expect(applied).toHaveLength(MIGRATIONS.length);
    expect(applied).toEqual(MIGRATIONS.map((m) => m.name));
  });

  it('records migration names in order', async () => {
    await runMigrations(db);
    const applied = await listAppliedMigrations(db);
    expect(applied[0]).toBe('001_create_offline_events');
    expect(applied[1]).toBe('002_create_cached_routes');
    expect(applied[2]).toBe('003_create_cached_deliveries');
    expect(applied[3]).toBe('004_create_pod_assets');
  });

  it('is idempotent — running twice does not throw', async () => {
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.toBeUndefined();
  });

  it('does not re-apply already applied migrations', async () => {
    await runMigrations(db);
    const firstCount = (await listAppliedMigrations(db)).length;
    await runMigrations(db);
    const secondCount = (await listAppliedMigrations(db)).length;
    expect(secondCount).toBe(firstCount);
  });

  it('MIGRATIONS array covers all 4 required tables', () => {
    const names = MIGRATIONS.map((m) => m.name);
    expect(names.some((n) => n.includes('offline_events'))).toBe(true);
    expect(names.some((n) => n.includes('cached_routes'))).toBe(true);
    expect(names.some((n) => n.includes('cached_deliveries'))).toBe(true);
    expect(names.some((n) => n.includes('pod_assets'))).toBe(true);
  });

  it('offline_events migration SQL contains required columns', () => {
    const migration = MIGRATIONS.find((m) => m.name.includes('offline_events'))!;
    expect(migration.sql).toMatch(/device_captured_at/);
    expect(migration.sql).toMatch(/device_timezone/);
    expect(migration.sql).toMatch(/sync_status/);
    expect(migration.sql).toMatch(/server_received_at/);
    expect(migration.sql).toMatch(/retry_count/);
    expect(migration.sql).toMatch(/gps_lat/);
    expect(migration.sql).toMatch(/gps_lng/);
  });

  it('offline_events migration SQL enforces sync_status CHECK constraint', () => {
    const migration = MIGRATIONS.find((m) => m.name.includes('offline_events'))!;
    expect(migration.sql).toMatch(/CHECK/i);
    expect(migration.sql).toMatch(/pending/);
    expect(migration.sql).toMatch(/synced/);
    expect(migration.sql).toMatch(/conflict/);
  });

  it('pod_assets migration SQL enforces asset_type CHECK constraint', () => {
    const migration = MIGRATIONS.find((m) => m.name.includes('pod_assets'))!;
    expect(migration.sql).toMatch(/CHECK/i);
    expect(migration.sql).toMatch(/signature/);
    expect(migration.sql).toMatch(/photo_delivery/);
    expect(migration.sql).toMatch(/photo_exception/);
  });
});

describe('offline_events CRUD', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(async () => {
    db = makeDb();
    await runMigrations(db);
  });

  it('inserts and retrieves an event by sync_status', async () => {
    await insertOfflineEvent(db, makeEvent());
    const pending = await getOfflineEventsByStatus(db, 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('evt-001');
  });

  it('stores device_captured_at exactly as provided', async () => {
    await insertOfflineEvent(db, makeEvent());
    const rows = await getOfflineEventsByStatus(db, 'pending');
    expect(rows[0].device_captured_at).toBe('2026-03-30T10:00:00.000Z');
  });

  it('does NOT overwrite device_captured_at on status update', async () => {
    await insertOfflineEvent(db, makeEvent());
    await updateOfflineEventSyncStatus(db, 'evt-001', 'synced', '2026-03-30T10:05:00.000Z');
    const synced = await getOfflineEventsByStatus(db, 'synced');
    // device_captured_at must remain the original value
    expect(synced[0].device_captured_at).toBe('2026-03-30T10:00:00.000Z');
  });

  it('moves event from pending to synced on status update', async () => {
    await insertOfflineEvent(db, makeEvent());
    await updateOfflineEventSyncStatus(db, 'evt-001', 'synced', '2026-03-30T10:05:00.000Z', '{"ok":true}');
    expect(await getOfflineEventsByStatus(db, 'pending')).toHaveLength(0);
    const synced = await getOfflineEventsByStatus(db, 'synced');
    expect(synced).toHaveLength(1);
    expect(synced[0].server_received_at).toBe('2026-03-30T10:05:00.000Z');
  });

  it('increments retry_count without affecting other fields', async () => {
    await insertOfflineEvent(db, makeEvent());
    await incrementOfflineEventRetry(db, 'evt-001');
    await incrementOfflineEventRetry(db, 'evt-001');
    const rows = await getOfflineEventsByStatus(db, 'pending');
    expect(rows[0].retry_count).toBe(2);
    // sync_status must not change
    expect(rows[0].sync_status).toBe('pending');
  });

  it('stores device_timezone as IANA string', async () => {
    await insertOfflineEvent(db, makeEvent({ device_timezone: 'Europe/London' }));
    const rows = await getOfflineEventsByStatus(db, 'pending');
    expect(rows[0].device_timezone).toBe('Europe/London');
  });

  it('rejects invalid sync_status via CHECK constraint', async () => {
    await expect(
      insertOfflineEvent(db, makeEvent({ sync_status: 'invalid' as never })),
    ).rejects.toThrow();
  });

  it('stores null GPS coordinates for events without location', async () => {
    await insertOfflineEvent(db, makeEvent({ gps_lat: null, gps_lng: null }));
    const rows = await getOfflineEventsByStatus(db, 'pending');
    expect(rows[0].gps_lat).toBeNull();
    expect(rows[0].gps_lng).toBeNull();
  });
});

describe('cached_routes CRUD', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(async () => {
    db = makeDb();
    await runMigrations(db);
  });

  it('inserts and retrieves a route', async () => {
    await upsertCachedRoute(db, makeRoute());
    const route = await getCachedRoute(db, 'route-001');
    expect(route).not.toBeNull();
    expect(route!.route_id).toBe('route-001');
  });

  it('upserts (updates) an existing route', async () => {
    await upsertCachedRoute(db, makeRoute());
    await upsertCachedRoute(db, makeRoute({ route_data: JSON.stringify({ stops: 10 }) }));
    const route = await getCachedRoute(db, 'route-001');
    expect(JSON.parse(route!.route_data).stops).toBe(10);
  });

  it('returns null for non-existent route', async () => {
    expect(await getCachedRoute(db, 'does-not-exist')).toBeNull();
  });

  it('deletes expired routes and keeps valid ones', async () => {
    await upsertCachedRoute(db, makeRoute({ route_id: 'expired', expires_at: '2020-01-01T00:00:00.000Z' }));
    await upsertCachedRoute(db, makeRoute({ route_id: 'valid', expires_at: '2099-01-01T00:00:00.000Z' }));
    await deleteExpiredRoutes(db);
    expect(await getCachedRoute(db, 'expired')).toBeNull();
    expect(await getCachedRoute(db, 'valid')).not.toBeNull();
  });
});

describe('cached_deliveries CRUD', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(async () => {
    db = makeDb();
    await runMigrations(db);
  });

  it('inserts and retrieves a delivery', async () => {
    await upsertCachedDelivery(db, makeDelivery());
    const delivery = await getCachedDelivery(db, 'del-001');
    expect(delivery).not.toBeNull();
    expect(delivery!.delivery_id).toBe('del-001');
  });

  it('upserts an existing delivery', async () => {
    await upsertCachedDelivery(db, makeDelivery());
    await upsertCachedDelivery(db, makeDelivery({ delivery_data: JSON.stringify({ address: '456 Oak Ave' }) }));
    const delivery = await getCachedDelivery(db, 'del-001');
    expect(JSON.parse(delivery!.delivery_data).address).toBe('456 Oak Ave');
  });

  it('returns null for non-existent delivery', async () => {
    expect(await getCachedDelivery(db, 'missing')).toBeNull();
  });
});

describe('pod_assets CRUD', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(async () => {
    db = makeDb();
    await runMigrations(db);
  });

  it('inserts and retrieves assets by event', async () => {
    await insertPodAsset(db, makeAsset());
    const assets = await getPodAssetsByEvent(db, 'evt-001');
    expect(assets).toHaveLength(1);
    expect(assets[0].asset_type).toBe('signature');
  });

  it('updates sync_status of a pod asset', async () => {
    await insertPodAsset(db, makeAsset());
    await updatePodAssetSyncStatus(db, 'asset-001', 'synced');
    const assets = await getPodAssetsByEvent(db, 'evt-001');
    expect(assets[0].sync_status).toBe('synced');
  });

  it('supports all three asset types for an event', async () => {
    await insertPodAsset(db, makeAsset({ id: 'a1', asset_type: 'signature' }));
    await insertPodAsset(db, makeAsset({ id: 'a2', asset_type: 'photo_delivery' }));
    await insertPodAsset(db, makeAsset({ id: 'a3', asset_type: 'photo_exception' }));
    expect(await getPodAssetsByEvent(db, 'evt-001')).toHaveLength(3);
  });

  it('rejects invalid asset_type via CHECK constraint', async () => {
    await expect(
      insertPodAsset(db, makeAsset({ asset_type: 'video' as never })),
    ).rejects.toThrow();
  });
});

describe('encryption key derivation', () => {
  it('returns a non-empty hex string for a given token', () => {
    const key = deriveEncryptionKeySync('my-test-token');
    expect(key.length).toBeGreaterThan(0);
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic — same token produces same key', () => {
    expect(deriveEncryptionKeySync('token-abc')).toBe(deriveEncryptionKeySync('token-abc'));
  });

  it('produces different keys for different tokens', () => {
    expect(deriveEncryptionKeySync('token-a')).not.toBe(deriveEncryptionKeySync('token-b'));
  });

  it('does not return the raw token value', () => {
    const token = 'my-secret-jwt-token';
    const key = deriveEncryptionKeySync(token);
    expect(key).not.toBe(token);
  });
});
