-- Phase 2A — Materialized view: per-supplier catalog summary
--
-- Aggregates products counts, category count, and price range per
-- supplier. Used by admin catalog header KPI and by restaurant-side
-- supplier detail pages. Refreshed CONCURRENTLY on-demand by server
-- actions after catalog-changing mutations (create/delete/bulk).

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_supplier_catalog_summary AS
SELECT
  p.supplier_id,
  count(*)                                   AS total_products,
  count(*) FILTER (WHERE p.is_available)     AS available_products,
  count(DISTINCT p.category_id)              AS category_count,
  min(p.price)                               AS price_min,
  max(p.price)                               AS price_max
FROM products p
GROUP BY p.supplier_id;

-- Unique index required for REFRESH ... CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_supplier_catalog_summary_supplier
  ON mv_supplier_catalog_summary (supplier_id);

-- ------------------------------------------------------------------
-- Refresh helper — callable from server actions.
-- ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_catalog_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_catalog_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_catalog_summary() TO authenticated;

-- Allow authenticated users to SELECT the MV (filtered by RLS at query
-- time via joining to suppliers or supplier_members in callers).
GRANT SELECT ON mv_supplier_catalog_summary TO authenticated;
