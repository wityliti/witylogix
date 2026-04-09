-- WIT-190: Batch RLS tenant isolation for 32 tenant-scoped tables.
--
-- These tables were identified in the security audit [WIT-178] as missing
-- Row-Level Security policies. All carry shop_id or org_id columns and are
-- subject to OWASP A01 — Broken Access Control without DB-level isolation.
--
-- Pattern follows the standard established in 00000000000000_init_rls:
--   • Shop-scoped tables  → `shop_id = current_setting('app.current_shop_id', TRUE)::UUID`
--   • Dual-mode tables    → shop_id OR org_id (same dual-mode pattern as drivers/delivery_zones)
--
-- Two tables (shipment_proofs, location_zone_links) have no direct tenant column;
-- they are isolated transitively through their parent tables' RLS via FK cascade.

-- ─── Enable RLS ────────────────────────────────────────────────────────────────

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments FORCE ROW LEVEL SECURITY;

ALTER TABLE shipping_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE calendar_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_rules FORCE ROW LEVEL SECURITY;

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods FORCE ROW LEVEL SECURITY;

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds FORCE ROW LEVEL SECURITY;

ALTER TABLE cod_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cod_collections FORCE ROW LEVEL SECURITY;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_configs FORCE ROW LEVEL SECURITY;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;

ALTER TABLE broadcast_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_groups FORCE ROW LEVEL SECURITY;

ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE store_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_quota_usage FORCE ROW LEVEL SECURITY;

ALTER TABLE auth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_providers FORCE ROW LEVEL SECURITY;

ALTER TABLE auth_meter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_meter_events FORCE ROW LEVEL SECURITY;

ALTER TABLE warehouse_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_configs FORCE ROW LEVEL SECURITY;

ALTER TABLE pick_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_lists FORCE ROW LEVEL SECURITY;

ALTER TABLE putaway_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE putaway_rules FORCE ROW LEVEL SECURITY;

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;

ALTER TABLE routing_meter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_meter_events FORCE ROW LEVEL SECURITY;

ALTER TABLE notification_meter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_meter_events FORCE ROW LEVEL SECURITY;

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events FORCE ROW LEVEL SECURITY;

ALTER TABLE delivery_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_otps FORCE ROW LEVEL SECURITY;

ALTER TABLE delivery_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE cold_chain_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cold_chain_thresholds FORCE ROW LEVEL SECURITY;

ALTER TABLE cold_chain_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cold_chain_alerts FORCE ROW LEVEL SECURITY;

-- Dual-mode table (shop_id OR org_id)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;

-- ─── Shop-scoped policies ───────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON shipments
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON shipping_profiles
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON calendar_rules
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON notification_templates
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON activity_logs
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON products
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON customers
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON payment_methods
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON payment_transactions
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON refunds
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON cod_collections
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON messages
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON message_templates
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON whatsapp_configs
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON campaigns
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON broadcast_groups
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON billing_subscriptions
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON invoices
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON store_quota_usage
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON auth_providers
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON auth_meter_events
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON warehouse_configs
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON pick_lists
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON putaway_rules
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON purchase_orders
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON routing_meter_events
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON notification_meter_events
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON integrations
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON integration_events
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON delivery_otps
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON delivery_audit_logs
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON temperature_logs
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON cold_chain_thresholds
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

CREATE POLICY tenant_isolation ON cold_chain_alerts
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);

-- ─── Dual-mode policy: locations (shop_id OR org_id) ───────────────────────────
-- Matches the dual-mode pattern from drivers/delivery_zones in init_rls:
--   • shop-level: records for this shop or org-shared locations visible to this shop
--   • org-level: all locations in the org

CREATE POLICY tenant_isolation ON locations
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
