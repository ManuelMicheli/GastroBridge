-- supabase/migrations/20260420100009_fiscal_feature_flag.sql
-- Cassetto Fiscale: feature flag opt-in per ristorante.

ALTER TABLE restaurant_preferences
  ADD COLUMN fiscal_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Helper per verificare se il ristorante ha attivato la feature.
CREATE OR REPLACE FUNCTION fiscal_is_enabled(_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT fiscal_enabled FROM restaurant_preferences WHERE restaurant_id = _restaurant_id),
    FALSE
  );
$$;

REVOKE EXECUTE ON FUNCTION fiscal_is_enabled(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscal_is_enabled(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fiscal_is_enabled(UUID) TO service_role;
