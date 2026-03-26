-- Analytics Performance Optimization: Missing Index on shipments.location_id
-- Context: WIT-57 — zone-performance and export analytics endpoints were
-- performing N+1 queries by joining via locationId without an index.
-- After batch-query refactor, this index covers the WHERE locationId IN (...)
-- clause and any future zone-scoped filters.

CREATE INDEX CONCURRENTLY IF NOT EXISTS shipments_shop_id_location_id_idx
  ON public.shipments (shop_id, location_id);
