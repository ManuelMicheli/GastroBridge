-- supabase/migrations/20260421110000_fiscal_reorder_engine.sql
-- Cassetto Fiscale: depletion materialized view + reorder generator.

ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'reorder_suggested';

CREATE MATERIALIZED VIEW fiscal_category_depletion AS
WITH purchases AS (
  SELECT
    o.restaurant_id,
    p.category_id,
    SUM(ROUND(oi.subtotal * 100))::BIGINT AS spend_cents,
    MAX(o.created_at) AS last_order_at,
    COUNT(DISTINCT o.id)::INT AS orders_in_window
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  WHERE o.status IN ('delivered','shipping')
    AND o.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY o.restaurant_id, p.category_id
),
sales AS (
  SELECT
    fr.restaurant_id,
    m.gb_category_id AS category_id,
    SUM(ri.subtotal_cents * m.depletion_ratio)::BIGINT AS sales_weighted_cents
  FROM fiscal_receipt_items ri
  JOIN fiscal_receipts fr ON fr.id = ri.receipt_id
  JOIN fiscal_pos_items pi
    ON pi.integration_id = fr.integration_id
   AND pi.pos_item_id   = ri.pos_item_id
  JOIN fiscal_pos_item_mappings m ON m.pos_item_id = pi.id
  WHERE fr.status = 'issued'
    AND fr.business_day >= CURRENT_DATE - 30
    AND m.gb_category_id IS NOT NULL
    AND ri.is_voided = FALSE
  GROUP BY fr.restaurant_id, m.gb_category_id
)
SELECT
  COALESCE(p.restaurant_id, s.restaurant_id) AS restaurant_id,
  COALESCE(p.category_id,   s.category_id)   AS category_id,
  COALESCE(p.spend_cents, 0)            AS spend_cents,
  COALESCE(s.sales_weighted_cents, 0)   AS sales_weighted_cents,
  (COALESCE(p.spend_cents,0) - COALESCE(s.sales_weighted_cents,0)) AS estimated_remaining_cents,
  p.last_order_at,
  COALESCE(p.orders_in_window, 0) AS orders_in_window,
  CASE
    WHEN COALESCE(s.sales_weighted_cents,0) > 0
      THEN ROUND(
        (COALESCE(p.spend_cents,0) - COALESCE(s.sales_weighted_cents,0))::NUMERIC
        / (COALESCE(s.sales_weighted_cents,0)::NUMERIC / 30.0),
        1
      )
    ELSE NULL
  END AS coverage_days,
  CASE
    WHEN COALESCE(s.sales_weighted_cents,0) > 0
      THEN ROUND(COALESCE(s.sales_weighted_cents,0)::NUMERIC / 30.0, 2)
    ELSE 0
  END AS avg_daily_burn_cents
FROM purchases p
FULL OUTER JOIN sales s
  ON p.restaurant_id = s.restaurant_id
 AND p.category_id   = s.category_id
WHERE COALESCE(p.restaurant_id, s.restaurant_id) IS NOT NULL
  AND COALESCE(p.category_id,   s.category_id)   IS NOT NULL;

CREATE UNIQUE INDEX idx_fiscal_category_depletion_pk
  ON fiscal_category_depletion(restaurant_id, category_id);

-- Extend refresh helper to cover the new MV.
CREATE OR REPLACE FUNCTION refresh_fiscal_aggregates()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY fiscal_daily_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY fiscal_food_cost;
  REFRESH MATERIALIZED VIEW CONCURRENTLY fiscal_category_depletion;
END;
$$;

-- Reorder generator. Idempotent: skips categories with an open suggestion
-- unless cooldown (48h since last dismiss) has passed.
CREATE OR REPLACE FUNCTION generate_reorder_suggestions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INT := 0;
  r RECORD;
  v_urgency reorder_urgency;
  v_reason  TEXT;
  v_qty     NUMERIC;
  v_supplier UUID;
  v_has_open BOOLEAN;
  v_last_dismiss TIMESTAMPTZ;
BEGIN
  FOR r IN
    SELECT d.*, c.name AS category_name
    FROM fiscal_category_depletion d
    JOIN categories c ON c.id = d.category_id
    WHERE d.coverage_days IS NOT NULL
      AND d.coverage_days <= 7
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM reorder_suggestions
      WHERE restaurant_id = r.restaurant_id
        AND category_id   = r.category_id
        AND state         = 'open'
    ) INTO v_has_open;
    IF v_has_open THEN CONTINUE; END IF;

    -- Cooldown after user dismiss
    SELECT MAX(created_at) INTO v_last_dismiss
    FROM reorder_suggestions
    WHERE restaurant_id = r.restaurant_id
      AND category_id   = r.category_id
      AND state         = 'dismissed';
    IF v_last_dismiss IS NOT NULL AND v_last_dismiss > NOW() - INTERVAL '48 hours' THEN
      CONTINUE;
    END IF;

    IF r.coverage_days <= 3 THEN v_urgency := 'critical';
    ELSIF r.coverage_days <= 5 THEN v_urgency := 'high';
    ELSE v_urgency := 'medium';
    END IF;

    v_qty := GREATEST(
      (r.avg_daily_burn_cents::NUMERIC / 100.0) * 10.0,
      1.0
    );

    -- Preferred supplier: most recent one used for this category in last 90gg
    SELECT oi.supplier_id INTO v_supplier
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products    p  ON p.id = oi.product_id
    WHERE o.restaurant_id = r.restaurant_id
      AND p.category_id   = r.category_id
      AND o.status IN ('delivered','shipping')
      AND o.created_at >= NOW() - INTERVAL '90 days'
    ORDER BY o.created_at DESC
    LIMIT 1;

    v_reason := 'Copertura stimata ' || r.coverage_days || 'gg. '
      || 'Spesa 30gg: ' || round(r.spend_cents::numeric/100, 2) || '€. '
      || 'Vendite pesate: ' || round(r.sales_weighted_cents::numeric/100, 2) || '€.';

    INSERT INTO reorder_suggestions (
      restaurant_id, category_id,
      suggested_qty, suggested_unit,
      estimated_coverage_days, urgency, reason,
      preferred_supplier_id,
      snapshot, state
    ) VALUES (
      r.restaurant_id, r.category_id,
      ROUND(v_qty, 2), '€',
      r.coverage_days::INT, v_urgency, v_reason,
      v_supplier,
      jsonb_build_object(
        'category_id',          r.category_id,
        'category_name',        r.category_name,
        'spend_30d_cents',      r.spend_cents,
        'sales_30d_weighted',   r.sales_weighted_cents,
        'remaining_cents',      r.estimated_remaining_cents,
        'coverage_days',        r.coverage_days,
        'avg_daily_burn_cents', r.avg_daily_burn_cents,
        'last_order_at',        r.last_order_at,
        'orders_in_window',     r.orders_in_window
      ),
      'open'
    );

    -- In-app notification
    INSERT INTO in_app_notifications (
      recipient_profile_id, event_type, title, body, link, metadata
    )
    SELECT
      rest.profile_id,
      'reorder_suggested'::notification_event,
      'Ordine consigliato: ' || r.category_name,
      v_reason,
      '/finanze/ordini-consigliati?r=' || r.restaurant_id::text,
      jsonb_build_object(
        'restaurant_id', r.restaurant_id,
        'category_id',   r.category_id,
        'urgency',       v_urgency
      )
    FROM restaurants rest
    WHERE rest.id = r.restaurant_id;

    inserted_count := inserted_count + 1;
  END LOOP;

  -- Auto-expire stale open suggestions
  UPDATE reorder_suggestions
    SET state = 'expired'
  WHERE state = 'open' AND expires_at < NOW();

  RETURN inserted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_reorder_suggestions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION generate_reorder_suggestions() FROM anon;
REVOKE EXECUTE ON FUNCTION generate_reorder_suggestions() FROM authenticated;
GRANT  EXECUTE ON FUNCTION generate_reorder_suggestions() TO service_role;

-- Scheduling helper. Nightly at 02:00 Europe/Rome (01:00 UTC).
CREATE OR REPLACE FUNCTION fiscal_schedule_reorder()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'fiscal-reorder-nightly';
  IF existing_jobid IS NOT NULL THEN
    RETURN 'already scheduled: job id ' || existing_jobid::text;
  END IF;
  PERFORM cron.schedule(
    'fiscal-reorder-nightly',
    '0 1 * * *',
    $cron$SELECT refresh_fiscal_aggregates(); SELECT generate_reorder_suggestions();$cron$
  );
  RETURN 'scheduled fiscal-reorder-nightly';
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_schedule_reorder() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_schedule_reorder() FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_schedule_reorder() FROM authenticated;
