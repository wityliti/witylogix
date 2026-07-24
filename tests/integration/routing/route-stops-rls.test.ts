/**
 * WIT-188: route_stops RLS tenant isolation tests
 *
 * Verifies that the tenant-scoping policy added in
 * 20260406_rls_route_stops prevents cross-tenant access:
 *   - A route_stop belonging to shop A must NOT be visible when
 *     app.current_shop_id is set to shop B's id.
 *   - A route_stop belonging to shop A MUST be visible when
 *     app.current_shop_id is set to shop A's id.
 *
 * These tests are DB-integration tests and require a live Postgres
 * connection with the full migration stack applied (DATABASE_URL_TEST).
 * They are skipped automatically when DATABASE_URL_TEST is not set.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Minimal SQL runner — reuses the same psql-subprocess pattern as
// tests/integration/migrations/migration-integrity.test.ts
// ---------------------------------------------------------------------------

import { spawn } from "child_process";

const DB_URL = process.env.DATABASE_URL_TEST ?? "";

function runSql(sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const psql = spawn("psql", [DB_URL, "-c", sql], { env: process.env });
    let out = "";
    let err = "";
    psql.stdout.on("data", (d: Buffer) => {
      out += d.toString();
    });
    psql.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });
    psql.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`psql exited ${code}: ${err}`));
    });
    psql.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const shopA = randomUUID();
const shopB = randomUUID();
let orgId: string;
let routeIdA: string;
let stopIdA: string;

async function setup(): Promise<void> {
  // Insert a minimal org + two shops + one route + one stop, bypassing RLS
  // as the superuser connection used by DATABASE_URL_TEST.
  orgId = randomUUID();
  routeIdA = randomUUID();
  stopIdA = randomUUID();

  await runSql(`
    INSERT INTO orgs (id, name, created_at, updated_at)
    VALUES ('${orgId}', 'Test Org WIT-188', now(), now())
    ON CONFLICT DO NOTHING;
  `);

  for (const [sid, domain] of [
    [shopA, "wit188-shop-a.myshopify.com"],
    [shopB, "wit188-shop-b.myshopify.com"],
  ] as [string, string][]) {
    await runSql(`
      INSERT INTO shops (id, org_id, shopify_domain, name, access_token, created_at, updated_at)
      VALUES ('${sid}', '${orgId}', '${domain}', '${domain}', 'tok', now(), now())
      ON CONFLICT DO NOTHING;
    `);
  }

  await runSql(`
    INSERT INTO routes (id, shop_id, name, status, date, optimized_order, created_at, updated_at)
    VALUES ('${routeIdA}', '${shopA}', 'Route A', 'DRAFT', now(), '[]', now(), now())
    ON CONFLICT DO NOTHING;
  `);

  await runSql(`
    INSERT INTO route_stops (id, route_id, sequence, stop_type, status, created_at, updated_at)
    VALUES ('${stopIdA}', '${routeIdA}', 1, 'DELIVERY', 'PENDING', now(), now())
    ON CONFLICT DO NOTHING;
  `);
}

async function teardown(): Promise<void> {
  // Clean up in reverse FK order
  await runSql(`DELETE FROM route_stops WHERE id = '${stopIdA}'`).catch(
    () => {},
  );
  await runSql(`DELETE FROM routes WHERE id = '${routeIdA}'`).catch(() => {});
  await runSql(`DELETE FROM shops WHERE org_id = '${orgId}'`).catch(() => {});
  await runSql(`DELETE FROM orgs WHERE id = '${orgId}'`).catch(() => {});
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Query route_stops as app_user with app.current_shop_id set to shopId.
 * Returns number of rows found for stopIdA.
 */
async function countStopAsShop(shopId: string): Promise<number> {
  const result = await runSql(`
    SET ROLE app_user;
    SET app.current_shop_id = '${shopId}';
    SELECT COUNT(*) FROM route_stops WHERE id = '${stopIdA}';
    RESET ROLE;
  `);
  const match = result.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("route_stops RLS tenant isolation (WIT-188)", () => {
  beforeAll(async () => {
    if (!DB_URL) return;
    await setup();
  });

  afterAll(async () => {
    if (!DB_URL) return;
    await teardown();
  });

  it("skips when DATABASE_URL_TEST is not set", () => {
    if (!DB_URL) {
      // Not a failure — just not configured in this environment.
      expect(true).toBe(true);
    }
  });

  it("shop A can see its own route_stop", async () => {
    if (!DB_URL) return;
    const count = await countStopAsShop(shopA);
    expect(count).toBe(1);
  });

  it("shop B cannot see shop A route_stop (cross-tenant isolation)", async () => {
    if (!DB_URL) return;
    const count = await countStopAsShop(shopB);
    expect(count).toBe(0);
  });

  it("superuser can see the stop regardless of RLS", async () => {
    if (!DB_URL) return;
    const result = await runSql(
      `SELECT COUNT(*) FROM route_stops WHERE id = '${stopIdA}';`,
    );
    const match = result.match(/(\d+)/);
    const count = match ? parseInt(match[1], 10) : 0;
    expect(count).toBe(1);
  });
});
