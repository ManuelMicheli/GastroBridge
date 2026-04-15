-- Phase 1B — low-stock threshold per prodotto + view materializzata alert scadenze

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS low_stock_threshold numeric NULL
  CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0);

COMMENT ON COLUMN products.low_stock_threshold IS
  'Soglia (in unita base) sotto la quale scatta alert stock_low. NULL = alert disattivato.';

-- View materializzata: lotti con scadenza <=60gg o prodotti sottoscorta
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stock_at_risk AS
SELECT
  w.supplier_id,
  sl.product_id,
  sl.warehouse_id,
  sl.id            AS lot_id,
  sl.lot_code,
  sl.expiry_date,
  (sl.expiry_date - CURRENT_DATE)::int AS days_to_expiry,
  sl.quantity_base,
  sl.quantity_reserved_base
FROM stock_lots sl
JOIN warehouses w ON w.id = sl.warehouse_id
WHERE sl.quantity_base > 0
  AND sl.expiry_date IS NOT NULL
  AND sl.expiry_date <= CURRENT_DATE + INTERVAL '60 days';

CREATE UNIQUE INDEX IF NOT EXISTS mv_stock_at_risk_lot_id
  ON mv_stock_at_risk(lot_id);
CREATE INDEX IF NOT EXISTS mv_stock_at_risk_supplier
  ON mv_stock_at_risk(supplier_id, days_to_expiry);

-- Refresh helper (chiamato dopo carico/rettifica/scarico)
CREATE OR REPLACE FUNCTION refresh_mv_stock_at_risk()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_at_risk;
$$;

GRANT EXECUTE ON FUNCTION refresh_mv_stock_at_risk() TO authenticated;
