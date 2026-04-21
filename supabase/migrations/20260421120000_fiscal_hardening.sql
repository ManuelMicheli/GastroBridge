-- supabase/migrations/20260421120000_fiscal_hardening.sql
-- Cassetto Fiscale hardening: sync logs, rate limits, retention, health.

-- Structured sync log (pull + normalize batches).
CREATE TABLE fiscal_sync_logs (
  id              BIGSERIAL PRIMARY KEY,
  integration_id  UUID REFERENCES fiscal_integrations(id) ON DELETE SET NULL,
  source          TEXT NOT NULL,               -- 'webhook' | 'pull' | 'normalize' | 'reorder'
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  fetched         INT NOT NULL DEFAULT 0,
  inserted        INT NOT NULL DEFAULT 0,
  normalized      INT NOT NULL DEFAULT 0,
  errors          INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_fiscal_sync_logs_integration
  ON fiscal_sync_logs(integration_id, started_at DESC);
CREATE INDEX idx_fiscal_sync_logs_recent
  ON fiscal_sync_logs(started_at DESC);

ALTER TABLE fiscal_sync_logs ENABLE ROW LEVEL SECURITY;
-- No user policies: logs accessible only to service_role (admin health check).

-- Webhook rate-limit window counters: one row per (integration, 60-second bucket).
CREATE TABLE fiscal_rate_limit_windows (
  integration_id UUID NOT NULL REFERENCES fiscal_integrations(id) ON DELETE CASCADE,
  bucket         TIMESTAMPTZ NOT NULL,
  count          INT NOT NULL DEFAULT 0,
  PRIMARY KEY (integration_id, bucket)
);
CREATE INDEX idx_fiscal_rate_limit_windows_bucket
  ON fiscal_rate_limit_windows(bucket);
ALTER TABLE fiscal_rate_limit_windows ENABLE ROW LEVEL SECURITY;

-- Bump + return current count atomically.
-- Returns: (count_after, limit). Caller rejects when count_after > limit.
CREATE OR REPLACE FUNCTION fiscal_bump_webhook_counter(
  _integration_id UUID,
  _limit_per_minute INT DEFAULT 100
) RETURNS TABLE(count_after INT, limit_per_minute INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket TIMESTAMPTZ := date_trunc('minute', NOW());
  v_count  INT;
BEGIN
  INSERT INTO fiscal_rate_limit_windows (integration_id, bucket, count)
    VALUES (_integration_id, v_bucket, 1)
    ON CONFLICT (integration_id, bucket) DO UPDATE
      SET count = fiscal_rate_limit_windows.count + 1
    RETURNING count INTO v_count;

  -- Garbage collect buckets older than 5 minutes
  DELETE FROM fiscal_rate_limit_windows
    WHERE integration_id = _integration_id AND bucket < v_bucket - INTERVAL '5 minutes';

  RETURN QUERY SELECT v_count, _limit_per_minute;
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_bump_webhook_counter(UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_bump_webhook_counter(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_bump_webhook_counter(UUID, INT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION fiscal_bump_webhook_counter(UUID, INT) TO service_role;

-- Retention cleanup. Hard cap preserves fiscal minimum 24 months.
CREATE OR REPLACE FUNCTION fiscal_retention_cleanup(
  _receipts_keep_months INT DEFAULT 24,
  _raw_events_keep_days INT DEFAULT 30,
  _sync_logs_keep_days  INT DEFAULT 90
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipts_deleted  BIGINT;
  v_raw_deleted       BIGINT;
  v_logs_deleted      BIGINT;
  v_suggestions_expired BIGINT;
BEGIN
  WITH d AS (
    DELETE FROM fiscal_receipts
     WHERE business_day < CURRENT_DATE - (_receipts_keep_months || ' months')::interval
    RETURNING id
  ) SELECT COUNT(*) INTO v_receipts_deleted FROM d;

  WITH d AS (
    DELETE FROM fiscal_raw_events
     WHERE processed_at IS NOT NULL
       AND received_at < NOW() - (_raw_events_keep_days || ' days')::interval
    RETURNING id
  ) SELECT COUNT(*) INTO v_raw_deleted FROM d;

  WITH d AS (
    DELETE FROM fiscal_sync_logs
     WHERE started_at < NOW() - (_sync_logs_keep_days || ' days')::interval
    RETURNING id
  ) SELECT COUNT(*) INTO v_logs_deleted FROM d;

  -- Mark overdue open suggestions as expired (safety net if nightly didn't run).
  WITH u AS (
    UPDATE reorder_suggestions
       SET state = 'expired'
     WHERE state = 'open' AND expires_at < NOW()
    RETURNING id
  ) SELECT COUNT(*) INTO v_suggestions_expired FROM u;

  RETURN jsonb_build_object(
    'receipts_deleted',      v_receipts_deleted,
    'raw_events_deleted',    v_raw_deleted,
    'sync_logs_deleted',     v_logs_deleted,
    'suggestions_expired',   v_suggestions_expired,
    'cutoff_receipts',       (CURRENT_DATE - (_receipts_keep_months || ' months')::interval)::date,
    'cutoff_raw_events',     NOW() - (_raw_events_keep_days || ' days')::interval,
    'cutoff_sync_logs',      NOW() - (_sync_logs_keep_days || ' days')::interval
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_retention_cleanup(INT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_retention_cleanup(INT, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_retention_cleanup(INT, INT, INT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION fiscal_retention_cleanup(INT, INT, INT) TO service_role;

-- Schedule retention cleanup weekly (Sunday 03:00 UTC).
CREATE OR REPLACE FUNCTION fiscal_schedule_retention()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'fiscal-retention-weekly';
  IF existing_jobid IS NOT NULL THEN
    RETURN 'already scheduled: job id ' || existing_jobid::text;
  END IF;
  PERFORM cron.schedule(
    'fiscal-retention-weekly',
    '0 3 * * 0',
    $cron$SELECT fiscal_retention_cleanup();$cron$
  );
  RETURN 'scheduled fiscal-retention-weekly';
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_schedule_retention() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_schedule_retention() FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_schedule_retention() FROM authenticated;

-- Admin health view: last sync status + consecutive-failure tally.
CREATE OR REPLACE VIEW fiscal_integrations_health AS
SELECT
  i.id                        AS integration_id,
  i.restaurant_id,
  i.provider,
  i.status,
  i.display_name,
  i.last_synced_at,
  i.last_error,
  i.created_at,
  (
    SELECT COUNT(*)::INT
    FROM fiscal_sync_logs l
    WHERE l.integration_id = i.id
      AND l.started_at >= NOW() - INTERVAL '24 hours'
      AND l.errors > 0
  ) AS errors_24h,
  (
    SELECT COUNT(*)::INT
    FROM fiscal_sync_logs l
    WHERE l.integration_id = i.id
      AND l.source = 'pull'
      AND l.started_at >= NOW() - INTERVAL '24 hours'
  ) AS pull_runs_24h,
  (
    SELECT COUNT(*)::INT
    FROM fiscal_raw_events r
    WHERE r.integration_id = i.id
      AND r.received_at >= NOW() - INTERVAL '24 hours'
  ) AS raw_events_24h,
  (
    SELECT COUNT(*)::INT
    FROM fiscal_raw_events r
    WHERE r.integration_id = i.id
      AND r.processed_at IS NULL
  ) AS pending_events
FROM fiscal_integrations i;

REVOKE ALL ON fiscal_integrations_health FROM PUBLIC;
REVOKE ALL ON fiscal_integrations_health FROM anon;
REVOKE ALL ON fiscal_integrations_health FROM authenticated;
GRANT SELECT ON fiscal_integrations_health TO service_role;
