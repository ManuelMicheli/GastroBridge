-- supabase/migrations/20260421100000_fiscal_cron.sql
-- Cassetto Fiscale: pg_cron schedule that calls /api/fiscal/sync every 2h.
--
-- pg_net is enabled on demand. App URL + bearer secret live in vault:
--   fiscal_app_url       → "https://<domain>"  (no trailing slash)
--   fiscal_cron_bearer   → matches FISCAL_CRON_SECRET env var in Next.js
--
-- Scheduling is NOT activated automatically — call `fiscal_schedule_sync()`
-- once after setting both vault secrets to start the recurring job.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION fiscal_trigger_sync()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions, net
AS $$
DECLARE
  app_url TEXT;
  bearer  TEXT;
  req_id  BIGINT;
BEGIN
  SELECT decrypted_secret INTO app_url FROM vault.decrypted_secrets WHERE name = 'fiscal_app_url' LIMIT 1;
  SELECT decrypted_secret INTO bearer  FROM vault.decrypted_secrets WHERE name = 'fiscal_cron_bearer' LIMIT 1;

  IF app_url IS NULL OR bearer IS NULL THEN
    RAISE EXCEPTION 'fiscal_trigger_sync: set vault secrets fiscal_app_url + fiscal_cron_bearer first';
  END IF;

  SELECT net.http_post(
    url     := app_url || '/api/fiscal/sync',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || bearer
    )
  ) INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_trigger_sync() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_trigger_sync() FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_trigger_sync() FROM authenticated;

-- Helper to schedule / unschedule the recurring job. Idempotent.
CREATE OR REPLACE FUNCTION fiscal_schedule_sync()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'fiscal-sync-2h';
  IF existing_jobid IS NOT NULL THEN
    RETURN 'already scheduled: job id ' || existing_jobid::text;
  END IF;
  PERFORM cron.schedule(
    'fiscal-sync-2h',
    '0 */2 * * *',                 -- every 2 hours on the hour
    $cron$SELECT fiscal_trigger_sync();$cron$
  );
  RETURN 'scheduled fiscal-sync-2h';
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_schedule_sync() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_schedule_sync() FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_schedule_sync() FROM authenticated;

CREATE OR REPLACE FUNCTION fiscal_unschedule_sync()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'fiscal-sync-2h';
  IF existing_jobid IS NULL THEN
    RETURN 'not scheduled';
  END IF;
  PERFORM cron.unschedule(existing_jobid);
  RETURN 'unscheduled fiscal-sync-2h';
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_unschedule_sync() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_unschedule_sync() FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_unschedule_sync() FROM authenticated;
