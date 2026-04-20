-- supabase/migrations/20260420100007_fiscal_pgsodium.sql
-- Cassetto Fiscale: encryption helpers for fiscal_integrations.credentials
--
-- Approccio: pgcrypto + Supabase Vault. Una chiave master stored in vault.secrets
-- (insert fatto manualmente tramite dashboard o SQL dopo migration).
-- Helper fn cifra/decifra il JSONB `credentials`.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Helper interno: legge chiave master da vault
CREATE OR REPLACE FUNCTION fiscal_master_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  k TEXT;
BEGIN
  SELECT decrypted_secret INTO k
  FROM vault.decrypted_secrets
  WHERE name = 'fiscal_master_key'
  LIMIT 1;
  IF k IS NULL THEN
    RAISE EXCEPTION 'fiscal_master_key not set in vault. Set via: SELECT vault.create_secret(<base64>, ''fiscal_master_key'');';
  END IF;
  RETURN k;
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_master_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_master_key() FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_master_key() FROM authenticated;

CREATE OR REPLACE FUNCTION fiscal_encrypt_credentials(plaintext JSONB)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_encrypt(plaintext::text, fiscal_master_key());
END;
$$;

CREATE OR REPLACE FUNCTION fiscal_decrypt_credentials(ciphertext BYTEA)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;
  RETURN (extensions.pgp_sym_decrypt(ciphertext, fiscal_master_key()))::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION fiscal_encrypt_credentials(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_encrypt_credentials(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_encrypt_credentials(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION fiscal_encrypt_credentials(JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION fiscal_decrypt_credentials(BYTEA) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fiscal_decrypt_credentials(BYTEA) FROM anon;
REVOKE EXECUTE ON FUNCTION fiscal_decrypt_credentials(BYTEA) FROM authenticated;
GRANT EXECUTE ON FUNCTION fiscal_decrypt_credentials(BYTEA) TO service_role;

-- Sostituisco la colonna credentials JSONB con credentials_encrypted BYTEA.
ALTER TABLE fiscal_integrations DROP COLUMN credentials;
ALTER TABLE fiscal_integrations ADD COLUMN credentials_encrypted BYTEA;

-- View "safe" che NON espone credentials, usata da tutte le app query.
CREATE OR REPLACE VIEW fiscal_integrations_safe AS
SELECT
  id, restaurant_id, provider, status, display_name, config,
  last_synced_at, last_error, webhook_secret,
  created_at, updated_at
FROM fiscal_integrations;

GRANT SELECT ON fiscal_integrations_safe TO authenticated;
