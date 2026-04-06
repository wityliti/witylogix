-- WIT-188: Add RLS tenant isolation policy to route_stops.
--
-- route_stops had ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY applied
-- in 00000000000000_init_rls but was never given a CREATE POLICY statement.
-- PostgreSQL behaviour: when FORCE RLS is set and no policy matches, ALL rows are
-- denied for non-superuser roles.  This means every app_user query against
-- route_stops silently returned 0 rows (or the app worked only because the
-- connection used the DB owner role, bypassing RLS entirely — a security gap).
--
-- route_stops has no direct shop_id column; it references routes via route_id.
-- The policy therefore scopes access through the parent routes table, consistent
-- with the cascade relationship (route_stops ON DELETE CASCADE → routes).
--
-- Pattern follows the shop-scoped isolation mode documented in init_rls:
--   shop_id = current_setting('app.current_shop_id', TRUE)::UUID

CREATE POLICY route_stops_tenant ON route_stops
    FOR ALL TO app_user
    USING (
        route_id IN (
            SELECT id FROM routes
            WHERE shop_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    )
    WITH CHECK (
        route_id IN (
            SELECT id FROM routes
            WHERE shop_id = current_setting('app.current_shop_id', TRUE)::UUID
        )
    );
