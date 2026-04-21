-- docs/superpowers/plans/notes/2026-04-20-fiscal-phase1-smoke.sql
-- Smoke test end-to-end del layer dati Cassetto Fiscale (Plan 1).
-- Esecuzione (MCP): apply via execute_sql, oppure via psql.
-- Pulisce tutto lo stato a fine esecuzione.

DO $$
DECLARE
  r_id       UUID;
  int_id     UUID;
  receipt_id UUID;
  got_api    TEXT;
  rev_cents  BIGINT;
BEGIN
  SELECT id INTO r_id FROM restaurants LIMIT 1;
  IF r_id IS NULL THEN RAISE EXCEPTION 'SMOKE: no restaurant available'; END IF;

  -- 1. Integration + encrypted credentials
  INSERT INTO fiscal_integrations (restaurant_id, provider, status, display_name, config)
    VALUES (r_id, 'tilby', 'active', 'Smoke Test Cassa', '{"device_id":"smoke-e2e"}'::jsonb)
    RETURNING id INTO int_id;

  UPDATE fiscal_integrations
     SET credentials_encrypted = fiscal_encrypt_credentials('{"api_key":"smoke-abc"}'::jsonb)
   WHERE id = int_id;

  SELECT fiscal_decrypt_credentials(credentials_encrypted)->>'api_key'
    INTO got_api
    FROM fiscal_integrations WHERE id = int_id;

  IF got_api IS DISTINCT FROM 'smoke-abc' THEN
    RAISE EXCEPTION 'SMOKE: credentials round-trip failed (got %)', got_api;
  END IF;

  -- 2. Raw event
  INSERT INTO fiscal_raw_events (integration_id, external_id, event_type, payload)
    VALUES (int_id, 'smoke-ext-1', 'receipt.created', '{"src":"smoke"}'::jsonb);

  -- 3. Normalized receipt + items
  INSERT INTO fiscal_receipts (
    restaurant_id, integration_id, external_id, issued_at, business_day,
    subtotal_cents, vat_cents, total_cents, payment_method, covers
  )
  VALUES (
    r_id, int_id, 'smoke-ext-1', NOW(), CURRENT_DATE,
    4500, 450, 4950, 'cash', 2
  )
  RETURNING id INTO receipt_id;

  INSERT INTO fiscal_receipt_items (receipt_id, line_number, name, quantity, unit_price_cents, subtotal_cents, vat_rate)
    VALUES
      (receipt_id, 1, 'Tagliata', 1, 2000, 2000, 10.0),
      (receipt_id, 2, 'Vino rosso calice', 2, 600, 1200, 10.0),
      (receipt_id, 3, 'Coperto', 2, 200, 400, 10.0);

  -- 4. Refresh aggregates and verify daily_summary row
  PERFORM refresh_fiscal_aggregates();

  SELECT revenue_cents INTO rev_cents
    FROM fiscal_daily_summary
   WHERE restaurant_id = r_id AND business_day = CURRENT_DATE;

  IF rev_cents IS DISTINCT FROM 4950 THEN
    RAISE EXCEPTION 'SMOKE: daily_summary revenue_cents expected 4950, got %', rev_cents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fiscal_food_cost
     WHERE restaurant_id = r_id AND business_day = CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'SMOKE: fiscal_food_cost row missing';
  END IF;

  -- 5. feature flag helper
  IF fiscal_is_enabled(r_id) IS NULL THEN
    RAISE EXCEPTION 'SMOKE: fiscal_is_enabled returned NULL';
  END IF;

  -- 6. Cleanup. fiscal_receipts → fiscal_integrations FK is NO ACTION
  -- (history is preserved when integration disconnects), so delete
  -- receipts first, then the integration (raw_events cascade).
  DELETE FROM fiscal_receipts WHERE integration_id = int_id;
  DELETE FROM fiscal_integrations WHERE id = int_id;
  PERFORM refresh_fiscal_aggregates();

  RAISE NOTICE 'SMOKE TEST OK: restaurant=%, revenue=4950c', r_id;
END $$;
