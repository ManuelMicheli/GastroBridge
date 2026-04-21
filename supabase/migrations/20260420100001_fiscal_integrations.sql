-- supabase/migrations/20260420100001_fiscal_integrations.sql
-- Cassetto Fiscale: POS integration config (one row per POS connection)

CREATE TABLE fiscal_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider        fiscal_provider NOT NULL,
  status          fiscal_integration_status NOT NULL DEFAULT 'pending_auth',
  display_name    TEXT,
  -- credentials cifrate via pgcrypto (vedi 20260420100007)
  credentials     JSONB,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at  TIMESTAMPTZ,
  last_error      TEXT,
  webhook_secret  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unicità: stesso provider nello stesso ristorante è permesso solo con device_id distinti.
-- Se device_id assente → una sola integrazione per (restaurant, provider).
CREATE UNIQUE INDEX idx_fiscal_integrations_unique
  ON fiscal_integrations (restaurant_id, provider, COALESCE((config->>'device_id'), ''));

CREATE INDEX idx_fiscal_integrations_restaurant ON fiscal_integrations(restaurant_id);
CREATE INDEX idx_fiscal_integrations_status_active
  ON fiscal_integrations(status)
  WHERE status IN ('active','error');

-- updated_at trigger (riusa handle_updated_at già definito in phase 1)
CREATE TRIGGER set_fiscal_integrations_updated_at
  BEFORE UPDATE ON fiscal_integrations
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
