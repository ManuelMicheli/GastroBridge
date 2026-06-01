-- Move RLS-only SECURITY DEFINER helper functions out of the API-exposed `public`
-- schema into `private`, so PostgREST no longer exposes them as /rest/v1/rpc/*
-- endpoints. The Supabase advisor flags public SECURITY DEFINER functions as
-- callable by anon/authenticated; some of these take an explicit _user_id and
-- would otherwise act as an ownership/enumeration oracle.
--
-- Safe because:
--   * RLS policies reference these functions by OID (stored parsed expression),
--     so a schema move does NOT break the policies.
--   * EXECUTE grants are preserved by SET SCHEMA, so policy evaluation still runs
--     them; we only add USAGE on the new schema.
--   * Verified none of these are called by the app via .rpc() and no other
--     function/trigger body references them by name.
--
-- Functions intentionally LEFT in public (called by the app via PostgREST rpc):
--   fiscal_owns_restaurant, is_supplier_member, has_supplier_permission,
--   next_ddt_number, refresh_catalog_summary, refresh_mv_stock_at_risk
--   (plus service-role-only: fiscal_*_credentials, fiscal_bump_webhook_counter,
--   refresh_fiscal_aggregates, create_order_with_splits, generate_reorder_suggestions).

CREATE SCHEMA IF NOT EXISTS private;

-- RLS policies execute as the invoking role, which therefore needs USAGE on the
-- schema that now holds the helper functions. (USAGE does not expose the schema
-- to PostgREST — only schemas in its configured list are introspected.)
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER FUNCTION public.fiscal_is_enabled(uuid)                              SET SCHEMA private;
ALTER FUNCTION public.get_user_role()                                      SET SCHEMA private;
ALTER FUNCTION public.has_restaurant_permission(uuid, text)               SET SCHEMA private;
ALTER FUNCTION public.is_restaurant_member(uuid)                          SET SCHEMA private;
ALTER FUNCTION public.is_restaurant_owner(uuid)                           SET SCHEMA private;
ALTER FUNCTION public.is_supplier_owner(uuid)                             SET SCHEMA private;
ALTER FUNCTION public.restaurant_member_role(uuid)                        SET SCHEMA private;
ALTER FUNCTION public.supplier_has_partnership_with_restaurant(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.supplier_has_seen_restaurant(uuid, uuid)            SET SCHEMA private;
ALTER FUNCTION public.supplier_member_role(uuid)                          SET SCHEMA private;
ALTER FUNCTION public.supplier_owns_any_split_of_order(uuid, uuid)        SET SCHEMA private;
