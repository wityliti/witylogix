# Database Migrations Guide

## Overview

Witylogix uses **Prisma** for schema management and **SQL migrations** for Row-Level Security (RLS) policies. Migrations are stored in `/packages/db/prisma/migrations/` and are version-controlled.

**Current Migrations:**
1. `00000000000000_init_rls` — Initial RLS policies (named slots)
2. `20260316_auth_system` — Authentication tables, sessions, MFA
3. `20260316_onboarding` — Onboarding flow and workspace setup
4. `20260316_tenant_config` — Multi-tenant configuration, API keys, usage tracking
5. `20260316_webhook_reliability` — Webhook signing and audit trails

---

## Migration Strategy: Expand-Contract Pattern

Witylogix follows the **expand-contract pattern** to ensure zero-downtime deployments:

### Phase 1: Expand (Add/Prepare)
- Add new columns with `nullable` or defaults
- Add new tables
- Add new indexes
- Create views or functions
- **No breaking changes**

### Phase 2: Migrate (Backfill)
- Populate new columns from old data
- Transform data as needed
- Run in background jobs

### Phase 3: Contract (Remove)
- Remove old columns after data is safe
- Remove old tables (if applicable)
- Remove deprecation flags

**Example: Renaming a Column**

```sql
-- Expand: Add new column, keep old one
ALTER TABLE orders ADD COLUMN order_status_new VARCHAR;

-- Migrate: Copy + transform data
UPDATE orders SET order_status_new = status WHERE order_status_new IS NULL;

-- Contract: Remove old column
ALTER TABLE orders DROP COLUMN status;
```

---

## Migration File Structure

Each migration directory contains:
- **`migration.sql`** — SQL statements to execute
- **Named folders** — Grouped by feature (e.g., `00000000000000_init_rls/`)

### Example Migration File

```sql
-- 00000000000000_init_rls/migration.sql

-- Enable RLS for all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ... more tables

-- Set app.current_shop_id via context
CREATE POLICY shop_isolation ON orders
  USING (shop_id = CURRENT_SETTING('app.current_shop_id')::uuid);

-- Set app.current_org_id via context
CREATE POLICY org_isolation ON organization
  USING (id = CURRENT_SETTING('app.current_org_id')::uuid);
```

---

## How to Create New Migrations

### Step 1: Update Prisma Schema

Edit the appropriate `.prisma` file in `/packages/db/prisma/schema/`:

```prisma
// schema/99-new-feature.prisma

model NewFeature {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  shopId    String   @map("shop_id") @db.Uuid
  data      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  shop Shop @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@map("new_features")
}
```

### Step 2: Generate Prisma Migration

```bash
cd packages/db

# Generate migration based on schema changes
pnpm prisma migrate dev --name <feature_name>

# Example:
pnpm prisma migrate dev --name add_new_feature_table
```

Prisma will:
1. Compare the schema to the database
2. Generate SQL in `prisma/migrations/<timestamp>_<feature_name>/migration.sql`
3. Apply the migration immediately (in dev)

### Step 3: Review Generated SQL

```sql
-- prisma/migrations/20260320_add_new_feature_table/migration.sql

-- CreateTable
CREATE TABLE "new_features" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" UUID NOT NULL,
  "data" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "new_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "new_features_shop_id_idx" ON "new_features"("shop_id");

-- AddForeignKey
ALTER TABLE "new_features"
ADD CONSTRAINT "new_features_shop_id_fkey"
FOREIGN KEY ("shop_id")
REFERENCES "shops"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
```

### Step 4: Add RLS Policies (if needed)

Create or update a migration file to add RLS:

```bash
mkdir -p packages/db/prisma/migrations/20260320_add_rls_for_new_feature
```

Create `migration.sql`:

```sql
-- Enable RLS
ALTER TABLE new_features ENABLE ROW LEVEL SECURITY;

-- Policy for shop isolation
CREATE POLICY shop_isolation ON new_features
  USING (shop_id = CURRENT_SETTING('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = CURRENT_SETTING('app.current_shop_id')::uuid);
```

### Step 5: Apply in Production

```bash
# Dry run (show SQL without executing)
pnpm prisma migrate deploy --preview

# Apply migration
pnpm prisma migrate deploy
```

---

## Migration Naming Conventions

Use **timestamp + description**:

```
20260320_add_shipment_tracking
20260321_add_rls_to_integrations
20260322_backfill_shipment_dates
20260323_add_unique_constraint_on_api_keys
```

Avoid:
- ❌ `new_table` (not descriptive)
- ❌ `fix_bug` (unclear what was fixed)
- ❌ `update_schema` (generic)

---

## Data Migration Patterns

### Pattern 1: Simple Column Addition

```sql
-- Expand
ALTER TABLE shipments ADD COLUMN carrier_tracking_number VARCHAR;

-- Migrate (async job)
UPDATE shipments SET carrier_tracking_number = external_tracking_id WHERE carrier_tracking_number IS NULL;

-- Contract
ALTER TABLE shipments DROP COLUMN external_tracking_id;
```

### Pattern 2: Enum Addition

```sql
-- PostgreSQL doesn't allow removing enum values, only adding

-- Add new enum type
ALTER TYPE shipment_status ADD VALUE 'IN_WAREHOUSE' AFTER 'PROCESSING';

-- Update app logic to use new status
-- No contract phase needed
```

### Pattern 3: Backfill with Computation

```sql
-- Expand: Add new column with default
ALTER TABLE orders ADD COLUMN estimated_delivery_date TIMESTAMP DEFAULT NULL;

-- Migrate: Compute based on existing data
UPDATE orders SET estimated_delivery_date = created_at + INTERVAL '3 days'
WHERE delivery_date IS NULL AND estimated_delivery_date IS NULL;

-- Contract: Make NOT NULL if ready
ALTER TABLE orders ALTER COLUMN estimated_delivery_date SET NOT NULL;
```

### Pattern 4: Relationship Refactoring

```sql
-- Expand: Add new FK column
ALTER TABLE shipments ADD COLUMN location_id UUID DEFAULT NULL;
ALTER TABLE shipments ADD CONSTRAINT fk_location FOREIGN KEY (location_id) REFERENCES locations(id);

-- Migrate: Copy data from related location
UPDATE shipments SET location_id = orders.location_id
FROM orders WHERE shipments.order_id = orders.id;

-- Contract: Remove old FK (in orders)
-- Handled in separate migration after verification
```

---

## Rollback Procedures

### Automatic Rollback (Development)

If a migration fails during `prisma migrate dev`, Prisma automatically:
1. Rolls back the migration
2. Deletes the migration directory
3. Reverts the schema

```bash
# Auto-rollback happens, then review the issue and try again
pnpm prisma migrate dev
```

### Manual Rollback (Production)

**Important:** Never rollback production without careful planning.

```bash
# List applied migrations
pnpm prisma migrate status

# Resolve migrations (reset to clean state if corrupted)
# Use with extreme caution!
pnpm prisma migrate resolve --rolled-back <migration_name>

# Alternatively, manually execute reverse SQL
psql $DATABASE_URL < reverse_migration.sql
```

### Reverse SQL Template

```sql
-- reverse_migration.sql
-- BEFORE executing, verify with DBA

BEGIN TRANSACTION;

-- Drop RLS policies
DROP POLICY shop_isolation ON orders;
DROP POLICY org_isolation ON organizations;

-- Drop tables
DROP TABLE new_features CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS new_features_shop_id_idx;

COMMIT;
```

---

## Monitoring Migrations

### Check Migration Status

```bash
pnpm prisma migrate status
```

Output:
```
Migrations to apply:
  20260320_add_new_feature_table

Already applied:
  00000000000000_init_rls
  20260316_auth_system
  20260316_onboarding
  20260316_tenant_config
  20260316_webhook_reliability
```

### Check Migration History

```bash
# View applied migrations in database
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;

-- Columns:
-- id: Migration ID (UUID)
-- checksum: Hash of migration SQL
-- finished_at: When applied
-- execution_time: Duration in milliseconds
-- success: Whether it succeeded
-- rollback_count: Number of rollbacks
-- started_at: When execution started
```

### Monitor Slow Migrations

Long-running migrations can lock tables. Monitor with:

```sql
-- Check active queries
SELECT pid, query, state, query_start FROM pg_stat_activity WHERE state != 'idle';

-- Cancel long-running migration (use with caution)
SELECT pg_cancel_backend(pid);
```

---

## Best Practices

### ✅ Do:
- Write migrations incrementally (one concern per migration)
- Test migrations in staging before production
- Include data validation in migration SQL
- Document complex migrations with comments
- Use `CONCURRENT` for index creation (non-blocking):
  ```sql
  CREATE INDEX CONCURRENTLY idx_shipments_status ON shipments(status);
  ```
- Back up database before applying migrations
- Include rollback plan in migration comments

### ❌ Don't:
- Write large migrations (>5 minutes runtime)
- Add NOT NULL constraints to existing columns without backfill
- Drop columns without soft-delete period (deprecation window)
- Use `DEFERRABLE INITIALLY DEFERRED` unless necessary (performance impact)
- Run migrations during peak traffic hours
- Combine schema + data migration without testing

---

## RLS Policy Maintenance

### Adding RLS to New Tables

Every table that's not platform-wide should have RLS:

```sql
-- 1. Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- 2. Create policies
CREATE POLICY shop_isolation ON new_table
  AS permissive
  FOR all
  TO authenticated
  USING (shop_id = CURRENT_SETTING('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = CURRENT_SETTING('app.current_shop_id')::uuid);

-- 3. For org-level tables
CREATE POLICY org_isolation ON new_table
  AS permissive
  FOR all
  TO authenticated
  USING (org_id = CURRENT_SETTING('app.current_org_id')::uuid)
  WITH CHECK (org_id = CURRENT_SETTING('app.current_org_id')::uuid);
```

### Auditing RLS Policies

```sql
-- List all RLS policies
SELECT schemaname, tablename, policyname, permissive, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## Testing Migrations Locally

### Setup Local Environment

```bash
# Create local PostgreSQL database
docker run --name witylogix-db \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:16

# Set DATABASE_URL
export DATABASE_URL="postgresql://postgres:password@localhost:5432/witylogix"

# Apply all migrations
pnpm prisma migrate deploy

# Verify
pnpm prisma migrate status
```

### Test RLS Policies

```bash
# Create test user/org context
psql $DATABASE_URL << 'EOF'
-- Set session vars
SET app.current_shop_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
SET app.current_org_id = 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy';

-- Query should respect RLS
SELECT * FROM orders;  -- Only returns orders from current_shop_id
EOF
```

---

## Common Scenarios

### Scenario 1: Add New Field to Existing Model

```bash
# 1. Update Prisma schema
vim packages/db/prisma/schema/04-orders.prisma
# Add field: priority Int @default(0)

# 2. Generate migration
cd packages/db
pnpm prisma migrate dev --name add_priority_to_orders

# 3. Review and apply
# migration.sql is auto-generated; just review it

# 4. Commit
git add prisma/migrations/
git commit -m "feat: add priority field to orders"
```

### Scenario 2: Create New Enum Type

```prisma
// In schema file
enum OrderPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

model Order {
  // ... other fields
  priority OrderPriority @default(NORMAL)
}
```

```bash
# Generate migration
pnpm prisma migrate dev --name add_order_priority_enum

# Migration SQL will:
# 1. Create new enum type
# 2. Add column with default
# 3. Add index if needed
```

### Scenario 3: Large Data Backfill

```sql
-- migration.sql (in two phases)

-- Phase 1: Backfill in batches (non-blocking)
DO $$
BEGIN
  FOR i IN 0..100 LOOP
    UPDATE shipments
    SET estimated_weight = weight
    WHERE estimated_weight IS NULL
    LIMIT 10000;
    COMMIT;
  END LOOP;
END $$;

-- Phase 2: Add constraint after backfill
ALTER TABLE shipments ALTER COLUMN estimated_weight SET NOT NULL;
```

---

## Deployment Checklist

Before deploying migrations to production:

- [ ] Migrations applied and tested in staging
- [ ] RLS policies verified (test with different contexts)
- [ ] No table locks during peak hours (or announce maintenance window)
- [ ] Backup created
- [ ] Rollback plan documented and tested
- [ ] Monitoring alerts set (slow queries, replication lag)
- [ ] Post-deployment verification script ready
- [ ] Team notified of any downtime or feature changes
- [ ] Prisma client regenerated (`pnpm prisma generate`)

---

## Migration Troubleshooting

### Issue: Migration fails with "permission denied"

```
Error: Could not execute migration: permission denied
```

**Solution:**
```bash
# Run with appropriate DB user
psql -U postgres $DATABASE_URL < migration.sql
```

### Issue: RLS policy not working

```sql
-- Verify policies are active
SELECT * FROM pg_policies WHERE tablename = 'orders';

-- Check session variable
SELECT CURRENT_SETTING('app.current_shop_id');

-- Disable RLS temporarily for testing (not for production)
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
```

### Issue: Migration takes too long

```sql
-- Check what's blocking
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- Cancel if needed
SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE query LIKE '%ALTER TABLE%';
```

---

## Future Improvements

1. **Automated testing:** Create test suite for migrations
2. **Pre-flight checks:** Validate migrations before deployment
3. **Monitoring:** Dashboard for migration performance
4. **Documentation:** Auto-generate from migration history
5. **Versioning:** Semantic versioning for schema versions

