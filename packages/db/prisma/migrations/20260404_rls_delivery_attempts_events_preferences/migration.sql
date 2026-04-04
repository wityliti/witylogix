-- WIT-186: Add RLS tenant isolation to delivery_attempts, delivery_events,
-- and customer_delivery_preferences.
--
-- These three tables were introduced in 20260330 migrations but shipped without
-- Row-Level Security policies, leaving cross-tenant data exposure at the DB layer.
-- CVSS: 9.1 (Critical) — OWASP A01 Broken Access Control.
--
-- All three tables carry a shop_id column and follow the standard shop-scoped
-- isolation pattern established in 00000000000000_init_rls.

-- ─── delivery_attempts ────────────────────────────────────────────────────────

ALTER TABLE delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_attempts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON delivery_attempts
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

-- ─── delivery_events ─────────────────────────────────────────────────────────

ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON delivery_events
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

-- ─── customer_delivery_preferences ───────────────────────────────────────────

ALTER TABLE customer_delivery_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_delivery_preferences FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON customer_delivery_preferences
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);
