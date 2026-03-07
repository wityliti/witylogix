-- Witylogix RLS Policies
-- Applied after Prisma creates the tables
--
-- Two isolation modes:
--   1. Shop-level (app.current_shop_id) — used by Shopify webhooks, carrier service,
--      and all per-shop operations. This is the default and most common path.
--   2. Org-level (app.current_org_id) — used by dashboard users viewing across shops.
--      Only applies to shared resources (drivers, delivery_zones).
--
-- The strategy: shop-scoped tables ONLY check shop_id (simple, fast, Shopify-safe).
-- Shared tables (drivers, zones) check EITHER shop_id OR org_id, depending on
-- which session variable is set. This keeps Shopify flows untouched while enabling
-- org-level queries from the dashboard.

-- ─── Enable RLS on all tenant-scoped tables ─────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers FORCE ROW LEVEL SECURITY;

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones FORCE ROW LEVEL SECURITY;

ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots FORCE ROW LEVEL SECURITY;

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes FORCE ROW LEVEL SECURITY;

ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops FORCE ROW LEVEL SECURITY;

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE carrier_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_services FORCE ROW LEVEL SECURITY;

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members FORCE ROW LEVEL SECURITY;

-- ─── Shop-scoped policies (unchanged from before) ───────────
-- These tables are ALWAYS accessed via shop_id. Orders, time_slots,
-- routes, notifications, carriers, webhooks — all Shopify-facing.

CREATE POLICY tenant_isolation ON users
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON orders
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON time_slots
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON routes
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON notification_logs
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON carrier_services
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON webhook_subscriptions
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

-- ─── Shared resource policies (drivers, delivery_zones) ─────
-- These support BOTH shop-level and org-level access:
--   • If app.current_shop_id is set → show that shop's records + org-shared records
--   • If app.current_org_id is set → show all records in the org
-- The middleware controls which variable is active.

CREATE POLICY tenant_isolation ON drivers
    FOR ALL TO app_user
    USING (
        -- Shop-level: match shop_id OR org-shared drivers visible to this shop
        (current_setting('app.current_shop_id', TRUE) != '' AND (
            shop_id = current_setting('app.current_shop_id', TRUE)::UUID
            OR (org_id IS NOT NULL AND org_id = (
                SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID
            ))
        ))
        OR
        -- Org-level: match all drivers in the org
        (current_setting('app.current_org_id', TRUE) != '' AND
         org_id = current_setting('app.current_org_id', TRUE)::UUID)
    )
    WITH CHECK (
        (current_setting('app.current_shop_id', TRUE) != '' AND (
            shop_id = current_setting('app.current_shop_id', TRUE)::UUID
            OR (org_id IS NOT NULL AND org_id = (
                SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID
            ))
        ))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
         org_id = current_setting('app.current_org_id', TRUE)::UUID)
    );

CREATE POLICY tenant_isolation ON delivery_zones
    FOR ALL TO app_user
    USING (
        (current_setting('app.current_shop_id', TRUE) != '' AND (
            shop_id = current_setting('app.current_shop_id', TRUE)::UUID
            OR (org_id IS NOT NULL AND org_id = (
                SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID
            ))
        ))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
         org_id = current_setting('app.current_org_id', TRUE)::UUID)
    )
    WITH CHECK (
        (current_setting('app.current_shop_id', TRUE) != '' AND (
            shop_id = current_setting('app.current_shop_id', TRUE)::UUID
            OR (org_id IS NOT NULL AND org_id = (
                SELECT org_id FROM shops WHERE id = current_setting('app.current_shop_id', TRUE)::UUID
            ))
        ))
        OR
        (current_setting('app.current_org_id', TRUE) != '' AND
         org_id = current_setting('app.current_org_id', TRUE)::UUID)
    );

-- ─── Org member policy ──────────────────────────────────────

CREATE POLICY org_isolation ON org_members
    FOR ALL TO app_user
    USING (org_id = current_setting('app.current_org_id', TRUE)::UUID)
    WITH CHECK (org_id = current_setting('app.current_org_id', TRUE)::UUID);

-- ─── Spatial indexes (PostGIS) ──────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_delivery_location
    ON orders USING GIST (delivery_location);

CREATE INDEX IF NOT EXISTS idx_drivers_current_location
    ON drivers USING GIST (current_location);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_boundary
    ON delivery_zones USING GIST (boundary);

CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_location
    ON proof_of_delivery USING GIST (delivery_location);

-- ─── Partial indexes for performance ────────────────────────

CREATE INDEX IF NOT EXISTS idx_drivers_available_active
    ON drivers (shop_id, status)
    WHERE status IN ('AVAILABLE') AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_drivers_org_available
    ON drivers (org_id, status)
    WHERE status IN ('AVAILABLE') AND is_active = true AND org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_active
    ON orders (shop_id, status, created_at DESC)
    WHERE status NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED');

CREATE INDEX IF NOT EXISTS idx_shops_org
    ON shops (org_id)
    WHERE org_id IS NOT NULL;

-- ─── Helper functions ───────────────────────────────────────
-- Updated to include org-shared drivers and zones in results

CREATE OR REPLACE FUNCTION find_delivery_zone(p_shop_id UUID, p_lng DOUBLE PRECISION, p_lat DOUBLE PRECISION)
RETURNS TABLE (zone_id UUID, zone_name TEXT, base_rate NUMERIC, per_km_rate NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT id, name, base_rate, per_km_rate
    FROM delivery_zones
    WHERE (shop_id = p_shop_id OR org_id = (SELECT org_id FROM shops WHERE id = p_shop_id))
      AND is_active = true
      AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    ORDER BY priority DESC
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION find_nearby_drivers(
    p_shop_id UUID,
    p_lng DOUBLE PRECISION,
    p_lat DOUBLE PRECISION,
    p_radius_meters DOUBLE PRECISION DEFAULT 10000
)
RETURNS TABLE (driver_id UUID, driver_name TEXT, distance_meters DOUBLE PRECISION)
LANGUAGE sql STABLE AS $$
    SELECT id, name,
           ST_Distance(
               current_location::geography,
               ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
           ) AS distance_meters
    FROM drivers
    WHERE (shop_id = p_shop_id OR org_id = (SELECT org_id FROM shops WHERE id = p_shop_id))
      AND is_active = true
      AND status = 'AVAILABLE'
      AND ST_DWithin(
          current_location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius_meters
      )
    ORDER BY current_location <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    LIMIT 20;
$$;
