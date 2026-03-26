# Witylogix Database Documentation

Welcome to the Witylogix database documentation. This directory contains comprehensive information about the platform's data model, schema, migrations, and conventions.

## Quick Start

### For New Team Members
1. Start with **[SCHEMA.md](SCHEMA.md)** - Understand the overall structure and key entities
2. Review **[ER_DIAGRAM.md](ER_DIAGRAM.md)** - Visualize relationships between models
3. Reference **[DATA_DICTIONARY.md](DATA_DICTIONARY.md)** - Learn enum values and field conventions

### For Database Administration
1. Read **[MIGRATIONS.md](MIGRATIONS.md)** - Learn how to create and manage migrations
2. Check migration history: `pnpm prisma migrate status`
3. Follow the expand-contract pattern for schema changes

### For Application Development
1. Check **[DATA_DICTIONARY.md](DATA_DICTIONARY.md)** for field types and constraints
2. Review relevant models in **[SCHEMA.md](SCHEMA.md)** by category
3. Use Prisma types generated from schema: `pnpm prisma generate`

---

## Document Overview

### 📋 [SCHEMA.md](SCHEMA.md) (~1160 lines)
**Complete schema documentation with detailed model definitions**

- **Overview:** PostgreSQL 16, Prisma 6, PostGIS, ~55+ models
- **Core Models:** Organization, Shop, User, OrgMember hierarchy
- **Orders & Delivery:** Order, Shipment, ProofOfDelivery, Route, RouteStop
- **Fleet:** Driver, Vehicle management
- **Shipping:** Location, Shipment, ShippingProfile
- **Messaging:** Message, MessageTemplate, WhatsAppConfig
- **Billing:** BillingPlan, Subscription, Invoice, UsageQuota
- **Authentication:** AuthSession, MFA, LoginAttempt, ApiKey, Permission
- **Integrations:** IntegrationApp, Integration, IntegrationEvent
- **Onboarding & Tenant:** OnboardingProgress, Workspace, TenantConfig
- **Multi-Tenant Config:** ApiKey, UsageRecord, UsageSummary, WebhookSecret

Each model includes:
- Table name and mapping
- Complete column definitions (type, nullable, default, description)
- Indexes and constraints
- RLS policies
- Relationships
- Enum values

### 📊 [ER_DIAGRAM.md](ER_DIAGRAM.md) (~586 lines)
**Mermaid entity relationship diagrams**

- **Diagram 1:** Core tenant hierarchy (Organization → Shop → User)
- **Diagram 2:** Order → Delivery → Driver flow (main fulfillment pipeline)
- **Diagram 3:** Authentication & Authorization (sessions, MFA, RBAC)
- **Diagram 4:** Billing & Subscriptions
- **Diagram 5:** Messaging & Notifications
- **Diagram 6:** Integration Marketplace
- **Diagram 7:** Onboarding & Tenant Configuration

Additional sections:
- Key relationship patterns (org-level vs shop-level)
- Soft deletion patterns
- Immutable records
- Many-to-many examples
- RLS boundaries

### 🔄 [MIGRATIONS.md](MIGRATIONS.md) (~591 lines)
**Database migration strategies and procedures**

- **Overview:** Prisma + SQL migrations, expand-contract pattern
- **Current Migrations:** List of applied migrations with descriptions
- **How to Create:** Step-by-step guide for new migrations
- **Data Migration Patterns:** Common patterns with examples
- **Rollback Procedures:** Safe rollback steps and recovery
- **Best Practices:** Do's and don'ts for production deployments
- **RLS Policy Maintenance:** Adding and auditing RLS policies
- **Testing:** Local setup and RLS testing
- **Common Scenarios:** Add field, create enum, backfill data, refactor relationships

### 📚 [DATA_DICTIONARY.md](DATA_DICTIONARY.md) (~800 lines)
**Field-level data dictionary and conventions**

- **Enums & Status Values:** All enum types with workflows
  - OrderStatus, ShipmentStatus, DeliveryMethod, DriverStatus, VehicleType
  - RouteStatus, StopType/StopStatus, UserRole, OrgRole
  - MessageChannel, MessageDeliveryStatus, MessagePriority
  - PlanTier, SubscriptionStatus, InvoiceStatus, MfaType
  - IntegrationCategory, IntegrationAuthType, IntegrationStatus, etc.

- **Special Field Types:**
  - Geometry fields (PostGIS points and polygons)
  - JSON fields (line items, dimensions, settings, metadata)
  - Encrypted fields (tokens, passwords, secrets)
  - Array fields (tags, scopes, days of week)

- **Naming Conventions:** Table names, columns, indexes, relationships
- **Soft Delete Patterns:** is_active, deleted_at, uninstalled_at
- **Timestamp Conventions:** created_at, updated_at, event-specific timestamps
- **Cross-Reference Queries:** Common SQL patterns and joins
- **Data Validation Rules:** Constraints and format requirements
- **Performance Tips:** Index strategies and query optimization
- **Common Data Issues:** Real-world problems and fixes

---

## Key Architecture Decisions

### Multi-Tenancy Model
- **Organization** (optional): Groups multiple shops together
- **Shop**: Primary RLS boundary; always the tenant root for Shopify
- **Single-shop merchants:** Don't need org; shop operates independently
- **Multi-shop merchants:** Create org, link shops, share drivers/zones across shops

### RLS (Row-Level Security)
- **Shop-level** (primary): `app.current_shop_id` context variable
- **Organization-level** (secondary): `app.current_org_id` context variable
- **Hybrid:** Some tables support both contexts (org-level entities with shop access)

### Soft Deletion
- Uses `is_active` boolean flag (most tables) or explicit `deleted_at` timestamp
- Queries must filter: `WHERE is_active = true`
- Enables audit trails and compliance retention periods

### Expand-Contract Pattern
- **Phase 1:** Add new columns/tables with defaults (no breaking changes)
- **Phase 2:** Migrate/backfill data in background jobs
- **Phase 3:** Remove old columns after verification (contract)
- Ensures zero-downtime deployments and safe rollbacks

### Enum-Based Status Tracking
- All status fields use PostgreSQL enums (e.g., OrderStatus, ShipmentStatus)
- Guarantees data integrity (no invalid statuses)
- Clear state machines documented in DATA_DICTIONARY.md

---

## Common Tasks

### Add a New Field to Orders

```bash
# 1. Update schema
vim packages/db/prisma/schema/04-orders.prisma
# Add: newField String?

# 2. Generate migration
cd packages/db
pnpm prisma migrate dev --name add_new_field_to_orders

# 3. Review migration SQL (auto-generated)
cat prisma/migrations/20260316_add_new_field_to_orders/migration.sql

# 4. Done - migration applied automatically in dev
```

### Create a New Model

```bash
# 1. Create schema file (use next available number)
vim packages/db/prisma/schema/70-my-feature.prisma

# 2. Define model with proper RLS:
model MyFeature {
  id     UUID   @id @default(dbgenerated("gen_random_uuid()"))
  shopId UUID   @map("shop_id")
  data   String

  shop   Shop   @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@index([shopId])
  @@map("my_features")
}

# 3. Generate migration
pnpm prisma migrate dev --name add_my_feature_table

# 4. Add RLS in separate migration (optional but recommended)
# See MIGRATIONS.md for RLS examples
```

### Query Orders Efficiently

```sql
-- ✅ Good: Uses indexed columns, respects RLS
SELECT * FROM orders
WHERE shop_id = current_setting('app.current_shop_id')::uuid
  AND status = 'DELIVERED'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 100;

-- ❌ Bad: Unindexed JSON query
SELECT * FROM orders WHERE metadata->>'priority' = 'high';

-- ✅ Better: Use materialized view or computed column
```

### Monitor Migration Status

```bash
# List pending and applied migrations
pnpm prisma migrate status

# Show migration history in database
psql $DATABASE_URL << 'EOF'
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;
EOF
```

---

## Tools & Scripts

### Auto-Generate ER Diagram

```bash
# Generate from Prisma schema
pnpm exec ts-node packages/db/scripts/generate-er-diagram.ts

# Options:
# --output <path>    Output file (default: docs/database/ER_AUTO.md)
# --filter <modules> Filter by modules (core, auth, billing, etc.)
# --grouped          One diagram per module
```

### Prisma Studio (Visual Database Browser)

```bash
# Open interactive database GUI
pnpm prisma studio

# Runs on http://localhost:5555
# Browse/edit data directly (dev only)
```

### Generate Prisma Types

```bash
# After schema changes, regenerate types
pnpm prisma generate

# Types in: node_modules/.prisma/client
# Import with: import { Prisma, PrismaClient } from '@prisma/client'
```

---

## Database Connection

### Environment Variables

```bash
# .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/witylogix"
DIRECT_URL="postgresql://user:password@localhost:5432/witylogix"  # For migrations
```

### Local Development Setup

```bash
# Start PostgreSQL (Docker)
docker run --name witylogix-db \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -v witylogix-db:/var/lib/postgresql/data \
  postgres:16

# Apply all migrations
pnpm prisma migrate deploy

# Verify
pnpm prisma migrate status
```

---

## Performance & Monitoring

### Key Indexes
All critical queries use indexed columns:
- Shop isolation: `(shop_id)`
- Status filtering: `(shop_id, status, created_at DESC)`
- Date ranges: `(created_at DESC)`
- Unique lookups: `(tracking_token)`, `(shopify_domain)`

### Query Performance
```bash
# Enable query logging
psql $DATABASE_URL << 'EOF'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT query, calls, mean_time FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
EOF
```

### Slow Migrations
Long-running migrations (>5 min) can lock tables. Use `CONCURRENTLY` for indexes:
```sql
CREATE INDEX CONCURRENTLY idx_orders_status ON orders(status);
```

---

## Glossary

- **RLS**: Row-Level Security - enforces multi-tenancy at database level
- **FK**: Foreign Key - relationship constraint
- **PK**: Primary Key - unique identifier
- **UK**: Unique Key - unique constraint
- **Cascading**: When parent deleted, child records also deleted
- **Soft Delete**: Mark as inactive instead of permanently deleting
- **Expand-Contract**: Migration pattern for zero-downtime deployments
- **Mermaid**: Diagram syntax used for ER diagrams
- **Prisma**: ORM and schema management tool

---

## Contributing

When making database changes:

1. **Update Schema**: Edit `.prisma` files in `packages/db/prisma/schema/`
2. **Generate Migration**: Run `pnpm prisma migrate dev --name <description>`
3. **Review SQL**: Check auto-generated migration SQL before committing
4. **Test in Staging**: Always test migrations in staging environment first
5. **Update Docs**: If adding new models, update SCHEMA.md and ER_DIAGRAM.md
6. **Commit**: Include migration files and schema changes in same commit

---

## Support & Questions

For questions about database schema and migrations, contact the backend team or refer to:

- Prisma Docs: https://www.prisma.io/docs/
- PostgreSQL Docs: https://www.postgresql.org/docs/current/
- PostGIS Docs: https://postgis.net/docs/
- Witylogix Architecture Docs: See `/docs` directory

---

**Last Updated:** March 16, 2026
**Database Version:** PostgreSQL 16
**Prisma Version:** 6
**Total Models:** ~55
**Total Migrations:** 5+
