/**
 * CI lint: verify every Prisma model with shop_id or org_id has a corresponding
 * ENABLE ROW LEVEL SECURITY statement in the migrations directory.
 *
 * Run: tsx packages/db/scripts/check-rls-coverage.ts
 * Exit 1 if any tenant-scoped table is missing RLS.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, "..");

const SCHEMA_DIR = join(PKG_ROOT, "prisma/schema");
const MIGRATIONS_DIR = join(PKG_ROOT, "prisma/migrations");

// Tables that are intentionally excluded from direct RLS:
//   - No direct shop_id/org_id; isolation is transitive via parent FK + parent RLS.
const TRANSITIVE_EXCLUSIONS = new Set([
  "shipment_proofs",
  "location_zone_links",
]);

// Tables that are system-level (not tenant-scoped despite having org_id/shop_id).
const SYSTEM_EXCLUSIONS = new Set([
  "shops", // shop itself is the tenant root
]);

function getSchemaFiles(): string[] {
  return readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".prisma"))
    .map((f) => join(SCHEMA_DIR, f));
}

function getMigrationSql(): string {
  const dirs = readdirSync(MIGRATIONS_DIR).filter((d) => {
    const full = join(MIGRATIONS_DIR, d);
    return statSync(full).isDirectory();
  });

  return dirs
    .map((d) => {
      const sqlPath = join(MIGRATIONS_DIR, d, "migration.sql");
      try {
        return readFileSync(sqlPath, "utf-8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

/** Line-based Prisma schema parser — avoids false-positive `}` inside field defaults. */
function extractTenantTables(schemaFiles: string[]): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const file of schemaFiles) {
    const lines = readFileSync(file, "utf-8").split("\n");

    let inModel = false;
    let modelName = "";
    let modelLines: string[] = [];

    for (const line of lines) {
      if (!inModel) {
        const m = line.match(/^model\s+(\w+)\s*\{/);
        if (m) {
          inModel = true;
          modelName = m[1];
          modelLines = [line];
        }
      } else {
        modelLines.push(line);
        // Model ends at a `}` at the start of a line (not indented)
        if (/^\}/.test(line)) {
          const body = modelLines.join("\n");

          const hasShopId = /@map\("shop_id"\)/.test(body);
          const hasOrgId = /@map\("org_id"\)/.test(body);

          if (hasShopId || hasOrgId) {
            const mapMatch = body.match(/@@map\("([^"]+)"\)/);
            const tableName = mapMatch ? mapMatch[1] : modelName.toLowerCase();

            const cols: string[] = [];
            if (hasShopId) cols.push("shop_id");
            if (hasOrgId) cols.push("org_id");
            result.set(tableName, cols);
          }

          inModel = false;
          modelName = "";
          modelLines = [];
        }
      }
    }
  }

  return result;
}

function getTablesWithRls(allMigrationSql: string): Set<string> {
  const rlsTables = new Set<string>();
  const matches = allMigrationSql.matchAll(
    /ALTER\s+TABLE\s+(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi
  );
  for (const m of matches) {
    rlsTables.add(m[1].toLowerCase());
  }
  return rlsTables;
}

function main() {
  const schemaFiles = getSchemaFiles();
  const tenantTables = extractTenantTables(schemaFiles);
  const allMigrationSql = getMigrationSql();
  const rlsTables = getTablesWithRls(allMigrationSql);

  const missing: string[] = [];

  for (const [table, cols] of tenantTables) {
    if (TRANSITIVE_EXCLUSIONS.has(table)) continue;
    if (SYSTEM_EXCLUSIONS.has(table)) continue;

    if (!rlsTables.has(table)) {
      missing.push(`  ${table}  [${cols.join(", ")}]`);
    }
  }

  if (missing.length === 0) {
    console.log(
      `✓ RLS coverage OK — all ${tenantTables.size} tenant-scoped tables have policies.`
    );
    process.exit(0);
  }

  console.error(
    `✗ RLS coverage gap: ${missing.length} tenant-scoped table(s) missing RLS policies:\n`
  );
  console.error(missing.join("\n"));
  console.error(
    "\nAdd ENABLE ROW LEVEL SECURITY + a tenant_isolation policy in a new migration under packages/db/prisma/migrations/."
  );
  process.exit(1);
}

main();
