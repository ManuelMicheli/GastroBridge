-- supabase/migrations/20260420100005_fiscal_aggregates.sql
-- Cassetto Fiscale: materialized views for daily KPIs + food cost + owner summary

CREATE MATERIALIZED VIEW fiscal_daily_summary AS
SELECT
  restaurant_id,
  business_day,
  COUNT(*) FILTER (WHERE status = 'issued')                          AS receipts_count,
  COALESCE(SUM(total_cents) FILTER (WHERE status = 'issued'), 0)     AS revenue_cents,
  COALESCE(SUM(vat_cents)   FILTER (WHERE status = 'issued'), 0)     AS vat_cents,
  COALESCE(SUM(covers)      FILTER (WHERE status = 'issued'), 0)     AS covers,
  COALESCE(AVG(total_cents) FILTER (WHERE status = 'issued'), 0)::INT AS avg_ticket_cents
FROM fiscal_receipts
GROUP BY restaurant_id, business_day;

CREATE UNIQUE INDEX idx_fiscal_daily_summary_pk
  ON fiscal_daily_summary(restaurant_id, business_day);

CREATE MATERIALIZED VIEW fiscal_food_cost AS
SELECT
  d.restaurant_id,
  d.business_day,
  d.revenue_cents,
  COALESCE(s.spend_cents, 0) AS spend_cents,
  CASE
    WHEN d.revenue_cents > 0
      THEN ROUND(100.0 * COALESCE(s.spend_cents, 0) / d.revenue_cents, 2)
    ELSE NULL
  END AS food_cost_pct
FROM fiscal_daily_summary d
LEFT JOIN LATERAL (
  SELECT SUM(ROUND(oi.subtotal * 100))::BIGINT AS spend_cents
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.restaurant_id = d.restaurant_id
    AND o.status IN ('delivered','shipping')
    AND DATE(o.created_at) = d.business_day
) s ON TRUE;

CREATE UNIQUE INDEX idx_fiscal_food_cost_pk
  ON fiscal_food_cost(restaurant_id, business_day);

-- View (non-materialized) per aggregare tra tutte le sedi dello stesso owner
CREATE VIEW fiscal_owner_summary AS
SELECT
  r.profile_id,
  d.business_day,
  SUM(d.receipts_count)  AS receipts_count,
  SUM(d.revenue_cents)   AS revenue_cents,
  SUM(d.vat_cents)       AS vat_cents
FROM fiscal_daily_summary d
JOIN restaurants r ON r.id = d.restaurant_id
GROUP BY r.profile_id, d.business_day;

-- Refresh helper: chiamabile da trigger o cron
CREATE OR REPLACE FUNCTION refresh_fiscal_aggregates()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY fiscal_daily_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY fiscal_food_cost;
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_fiscal_aggregates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refresh_fiscal_aggregates() FROM anon;
REVOKE EXECUTE ON FUNCTION refresh_fiscal_aggregates() FROM authenticated;
GRANT EXECUTE ON FUNCTION refresh_fiscal_aggregates() TO service_role;
