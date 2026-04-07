-- WIT-260: Add RLS tenant isolation to WooCommerce integration tables.
--
-- These tables were introduced without Row-Level Security policies,
-- leaving cross-tenant data exposure at the DB layer.
--
-- woocommerce_connections carries tenant_id (maps to shop.id) and is the
-- root of the cascade. The child tables (sync_records, registered_webhooks,
-- webhook_logs) have no tenant_id column of their own — they are isolated
-- through their connection_id FK relationship.
--
-- Pattern: woocommerce_connections uses tenant_id (= shop_id) directly.
-- Child tables use a sub-select on the parent connection to enforce tenant scope.

-- ─── woocommerce_connections ──────────────────────────────────────────────────

ALTER TABLE woocommerce_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_connections FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON woocommerce_connections
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_shop_id', TRUE)::UUID);

-- ─── woocommerce_sync_records ─────────────────────────────────────────────────
-- Scoped via connection_id → woocommerce_connections.tenant_id

ALTER TABLE woocommerce_sync_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_sync_records FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON woocommerce_sync_records
    FOR ALL TO app_user
    USING (
        connection_id IN (
            SELECT id FROM woocommerce_connections
            WHERE tenant_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    )
    WITH CHECK (
        connection_id IN (
            SELECT id FROM woocommerce_connections
            WHERE tenant_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    );

-- ─── woocommerce_registered_webhooks ─────────────────────────────────────────
-- Scoped via connection_id → woocommerce_connections.tenant_id

ALTER TABLE woocommerce_registered_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_registered_webhooks FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON woocommerce_registered_webhooks
    FOR ALL TO app_user
    USING (
        connection_id IN (
            SELECT id FROM woocommerce_connections
            WHERE tenant_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    )
    WITH CHECK (
        connection_id IN (
            SELECT id FROM woocommerce_connections
            WHERE tenant_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    );

-- ─── woocommerce_webhook_logs ─────────────────────────────────────────────────
-- Scoped via connection_id → woocommerce_connections.tenant_id

ALTER TABLE woocommerce_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_webhook_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON woocommerce_webhook_logs
    FOR ALL TO app_user
    USING (
        connection_id IN (
            SELECT id FROM woocommerce_connections
            WHERE tenant_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    )
    WITH CHECK (
        connection_id IN (
            SELECT id FROM woocommerce_connections
            WHERE tenant_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    );
