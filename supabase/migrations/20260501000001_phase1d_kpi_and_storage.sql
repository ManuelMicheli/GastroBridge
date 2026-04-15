-- Phase 1D — KPI materialized view, refresh scheduling, and storage policies
-- Refs: docs/superpowers/plans/2026-04-15-supplier-fase1d-ddt-consegne-dashboard.md (Task 2)
-- Notes:
--  * mv_stock_at_risk was introduced in 20260418000001_phase1b_stock_alerts.sql → not recreated here.
--  * order_splits uses `subtotal` (not `total_amount`) and has no own `created_at`; the day bucket is
--    derived from orders.created_at and new_customers uses orders.created_at ordering.
--  * order_status enum: {draft,submitted,confirmed,preparing,shipping,delivered,cancelled}
--    Plan mentioned `packed`/`shipped` which do not exist → filter uses `shipping` instead.

-- ---------------------------------------------------------------------------
-- 1. Enable pg_cron (idempotent). Supabase hosts this extension in schema `pg_catalog`-adjacent
--    but installs it into its own `cron` schema when created.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---------------------------------------------------------------------------
-- 2. mv_supplier_kpi_daily — pre-aggregated daily KPIs for supplier dashboard
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_supplier_kpi_daily;

CREATE MATERIALIZED VIEW mv_supplier_kpi_daily AS
SELECT
  os.supplier_id,
  ((o.created_at AT TIME ZONE 'Europe/Rome')::date) AS day,
  SUM(os.subtotal)                                   AS revenue,
  COUNT(DISTINCT os.id)                              AS orders_count,
  COUNT(DISTINCT o.restaurant_id) FILTER (
    WHERE NOT EXISTS (
      SELECT 1
      FROM order_splits os2
      JOIN orders o2 ON o2.id = os2.order_id
      WHERE os2.supplier_id = os.supplier_id
        AND o2.restaurant_id = o.restaurant_id
        AND o2.created_at < o.created_at
    )
  )                                                  AS new_customers,
  AVG(os.subtotal)                                   AS avg_ticket
FROM order_splits os
JOIN orders o ON o.id = os.order_id
WHERE os.status IN ('confirmed','preparing','shipping','delivered')
GROUP BY os.supplier_id, ((o.created_at AT TIME ZONE 'Europe/Rome')::date);

CREATE UNIQUE INDEX IF NOT EXISTS mv_supplier_kpi_daily_pk
  ON mv_supplier_kpi_daily(supplier_id, day);

-- ---------------------------------------------------------------------------
-- 3. Refresh function used by cron (and callable from triggers/backfills)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_supplier_kpi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_kpi_daily;
  BEGIN
    REFRESH MATERIALIZED VIEW mv_stock_at_risk;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Schedule refresh every 15 minutes via pg_cron (best-effort).
--    Guarded so migration still applies on environments where cron is missing.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('refresh_supplier_kpi_15m');
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'refresh_supplier_kpi_15m',
    '*/15 * * * *',
    $cron$ SELECT public.refresh_supplier_kpi(); $cron$
  );
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN undefined_table    THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Storage buckets (private)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('ddt-pdfs', 'ddt-pdfs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. RLS policies for ddt-pdfs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "ddt_pdfs_read_supplier_or_restaurant" ON storage.objects;
CREATE POLICY "ddt_pdfs_read_supplier_or_restaurant"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ddt-pdfs'
    AND (
      EXISTS (
        SELECT 1 FROM public.ddt_documents d
        WHERE d.pdf_url LIKE '%' || storage.objects.name
          AND public.is_supplier_member(d.supplier_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.ddt_documents d
        JOIN public.deliveries dv    ON dv.id = d.delivery_id
        JOIN public.order_splits os  ON os.id = dv.order_split_id
        JOIN public.orders o         ON o.id = os.order_id
        JOIN public.restaurants r    ON r.id = o.restaurant_id
        WHERE d.pdf_url LIKE '%' || storage.objects.name
          AND r.profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "ddt_pdfs_write_supplier_ddt_generate" ON storage.objects;
CREATE POLICY "ddt_pdfs_write_supplier_ddt_generate"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ddt-pdfs'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'ddt.generate'
    )
  );

-- ---------------------------------------------------------------------------
-- 7. RLS policies for delivery-proofs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "delivery_proofs_read_supplier" ON storage.objects;
CREATE POLICY "delivery_proofs_read_supplier"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'delivery-proofs'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'delivery.execute'
    )
  );

DROP POLICY IF EXISTS "delivery_proofs_write_driver_or_admin" ON storage.objects;
CREATE POLICY "delivery_proofs_write_driver_or_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND public.has_supplier_permission(
      (string_to_array(storage.objects.name, '/'))[1]::uuid,
      'delivery.execute'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Supporting index for DDT book search
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ddt_documents_supplier_year_number
  ON public.ddt_documents(supplier_id, year DESC, number DESC);
