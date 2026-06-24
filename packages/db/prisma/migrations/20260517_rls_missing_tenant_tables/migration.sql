-- WIT-451: RLS tenant isolation for 6 tables missing policies.
--
-- Identified during WIT-445 production security audit. These tables all have
-- a direct shopId (shop_id) or tenantId (tenant_id) column but were never
-- included in a prior RLS migration.
--
-- Highest risk: webhook_endpoints — the `secret` column stores an HMAC-SHA256
-- signing key. Without RLS, a cross-tenant data leak would expose signing secrets.
--
-- Pattern follows the standard from 20260406_rls_32_tenant_tables:
--   • shop_id tables   → shop_id = current_setting('app.current_shop_id', TRUE)::UUID
--   • tenant_id tables → tenant_id = current_setting('app.current_shop_id', TRUE)::UUID
--     (tenant_id is always a shop UUID in this schema)

-- ─── Enable RLS ─────────────────────────────────────────────────────────────

-- webhook_endpoints (tenant_id)
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints FORCE ROW LEVEL SECURITY;

-- fleet_vehicles (tenant_id)
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_vehicles FORCE ROW LEVEL SECURITY;

-- eta_logs (tenant_id)
ALTER TABLE eta_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE eta_logs FORCE ROW LEVEL SECURITY;

-- delivery_rules (shop_id)
ALTER TABLE delivery_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_rules FORCE ROW LEVEL SECURITY;

-- saved_views (shop_id)
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views FORCE ROW LEVEL SECURITY;

-- inventory_items (shop_id)
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;

-- ─── Policies: tenant_id tables ─────────────────────────────────────────────

CREATE POLICY tenant_isolation ON webhook_endpoints
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON fleet_vehicles
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON eta_logs
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID);

-- ─── Policies: shop_id tables ───────────────────────────────────────────────

CREATE POLICY tenant_isolation ON delivery_rules
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON saved_views
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON inventory_items
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);
