-- supabase/migrations/20260420100002_fiscal_raw_events.sql
-- Cassetto Fiscale: append-only raw events from POS (source of truth)

CREATE TABLE fiscal_raw_events (
  id              BIGSERIAL PRIMARY KEY,
  integration_id  UUID NOT NULL REFERENCES fiscal_integrations(id) ON DELETE CASCADE,
  external_id     TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  process_error   TEXT,
  UNIQUE(integration_id, external_id, event_type)
);

CREATE INDEX idx_fiscal_raw_events_unprocessed
  ON fiscal_raw_events(received_at)
  WHERE processed_at IS NULL;

CREATE INDEX idx_fiscal_raw_events_integration_time
  ON fiscal_raw_events(integration_id, received_at DESC);
