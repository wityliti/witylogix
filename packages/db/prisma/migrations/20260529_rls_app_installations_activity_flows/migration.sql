-- WIT-448: RLS tenant isolation for app_installations and activity_flows.
--
-- These two tables were introduced in 20260419_oauth_app_platform_and_operations
-- (OAuth app platform + Operations/ActivityFlow) but were never given Row-Level
-- Security policies. The CI RLS-coverage check (scripts/check-rls-coverage.ts)
-- flags them because both carry tenant columns and are otherwise subject to
-- OWASP A01 — Broken Access Control without DB-level isolation.
--
-- Pattern follows the standard established in 00000000000000_init_rls and
-- 20260406_rls_32_tenant_tables:
--   • Shop-scoped tables → `shop_id = current_setting('app.current_shop_id', TRUE)::UUID`
--   • Dual-mode tables   → shop_id OR org_id (same dual-mode pattern as locations/drivers)

-- ─── Enable RLS ────────────────────────────────────────────────────────────────

ALTER TABLE app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_installations FORCE ROW LEVEL SECURITY;

ALTER TABLE activity_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_flows FORCE ROW LEVEL SECURITY;

-- ─── Policies ──────────────────────────────────────────────────────────────────

-- app_installations is dual-mode: scoped to an organization (org_id) and/or a shop
-- (shop_id). Mirror the locations/drivers dual-mode isolation policy.
CREATE POLICY tenant_isolation ON app_installations
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

-- activity_flows is shop-scoped only.
CREATE POLICY tenant_isolation ON activity_flows
    FOR ALL TO app_user
    USING (shop_id = current_setting('app.current_shop_id', TRUE)::UUID)
    WITH CHECK (shop_id = current_setting('app.current_shop_id', TRUE)::UUID);
