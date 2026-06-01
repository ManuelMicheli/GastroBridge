-- Secure materialized views (and the owner-summary view) against cross-tenant reads.
--
-- Materialized views do NOT enforce row-level security. Because anon/authenticated
-- held SELECT on them, any signed-in user could bypass the app and call PostgREST
-- directly (e.g. GET /rest/v1/fiscal_food_cost) to read EVERY tenant's rows
-- (financials, stock, KPI). The Supabase security advisor flags this as
-- `materialized_view_in_api`.
--
-- Fix: the app now reads these objects with the service-role client behind explicit
-- ownership / membership checks (see lib/supplier/*/queries.ts, lib/fiscal/queries.ts),
-- so the anon/authenticated roles no longer need direct SELECT. Revoking it closes
-- the direct-REST hole while the app keeps working through service_role.
--
-- DEPLOY ORDER (important): ship the application code that switches these reads to
-- the service-role client BEFORE applying this migration. If this migration lands
-- first, the still-deployed app (which reads via the user client) loses access and
-- the supplier/fiscal dashboards break until the new code is live.

DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'mv_stock_at_risk',
    'mv_supplier_kpi_daily',
    'mv_supplier_catalog_summary',
    'fiscal_daily_summary',
    'fiscal_food_cost',
    'fiscal_category_depletion'
  ]
  LOOP
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', v);
    EXECUTE format('GRANT  SELECT ON public.%I TO service_role', v);
  END LOOP;
END $$;

-- Plain (non-materialized) view that aggregates revenue across all of an owner's
-- locations. A plain view runs with the view owner's privileges (bypasses RLS) and
-- is not read by the app client — same cross-tenant exposure class, so lock it down.
REVOKE SELECT ON public.fiscal_owner_summary FROM anon, authenticated;
GRANT  SELECT ON public.fiscal_owner_summary TO service_role;
