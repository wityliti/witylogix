-- Witylogix RLS Policies
-- Applied after Prisma creates the tables
-- These policies enforce tenant isolation at the database level

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

-- ─── Create RLS policies ────────────────────────────────────
-- Each policy uses current_setting('app.current_shop_id') set via SET LOCAL in transactions

CREATE POLICY tenant_isolation ON users
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY tenant_isolation ON orders
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY tenant_isolation ON drivers
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY tenant_isolation ON delivery_zones
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY tenant_isolation ON time_slots
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY tenant_isolation ON routes
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY tenant_isolation ON notification_logs
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY tenant_isolation ON carrier_services
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

CREATE POLICY tenant_isolation ON webhook_subscriptions
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id')::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id')::UUID);

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

CREATE INDEX IF NOT EXISTS idx_orders_active
    ON orders (shop_id, status, created_at DESC)
    WHERE status NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED');

-- ─── Helper functions ───────────────────────────────────────

CREATE OR REPLACE FUNCTION find_delivery_zone(p_shop_id UUID, p_lng DOUBLE PRECISION, p_lat DOUBLE PRECISION)
RETURNS TABLE (zone_id UUID, zone_name TEXT, base_rate NUMERIC, per_km_rate NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT id, name, base_rate, per_km_rate
    FROM delivery_zones
    WHERE shop_id = p_shop_id
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
    WHERE shop_id = p_shop_id
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
