import type { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_MIGRATIONS_TABLE, MIGRATIONS } from './schema';

/**
 * Returns the set of migration names that have already been applied.
 */
async function getAppliedMigrations(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY id ASC',
  );
  return new Set(rows.map((r) => r.name));
}

/**
 * Runs all pending migrations inside a single transaction.
 *
 * Call this once at app startup, immediately after opening the database.
 * It is safe to call multiple times — already-applied migrations are skipped.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Bootstrap: ensure the migrations tracking table exists
  await db.execAsync(CREATE_MIGRATIONS_TABLE);

  const applied = await getAppliedMigrations(db);
  const pending = MIGRATIONS.filter((m) => !applied.has(m.name));

  if (pending.length === 0) return;

  await db.withTransactionAsync(async () => {
    for (const migration of pending) {
      await db.execAsync(migration.sql);
      await db.runAsync(
        'INSERT INTO _migrations (name, run_at) VALUES (?, ?)',
        [migration.name, new Date().toISOString()],
      );
    }
  });
}

/**
 * Returns the list of applied migration names in order.
 * Useful for diagnostics and tests.
 */
export async function listAppliedMigrations(db: SQLiteDatabase): Promise<string[]> {
  await db.execAsync(CREATE_MIGRATIONS_TABLE);
  const rows = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY id ASC',
  );
  return rows.map((r) => r.name);
}
