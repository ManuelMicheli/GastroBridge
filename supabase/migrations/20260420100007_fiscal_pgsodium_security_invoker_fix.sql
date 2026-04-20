-- supabase/migrations/20260420100007_fiscal_pgsodium_security_invoker_fix.sql
-- Ensure fiscal_integrations_safe enforces caller RLS instead of running as owner.
-- Without this, GRANT SELECT ... TO authenticated lets any auth user read every
-- integration row (bypassing the owner policy added in 20260420100008_fiscal_rls).

ALTER VIEW fiscal_integrations_safe SET (security_invoker = on);
