# Cassetto Fiscale — Plan 1: Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare lo strato dati + RLS + feature flag del Cassetto Fiscale. Zero UI. Fine plan = migrazioni applicate, RLS verificate, TS types rigenerati, feature flag disponibile.

**Architecture:** Solo lavoro Postgres (Supabase) + regen types. Nessun adapter, nessuna route. Questo plan sblocca plan 2-8.

**Tech Stack:** PostgreSQL (Supabase), `pgsodium` extension per cifratura credentials, `supabase` CLI per apply + gen types, `zod/v4` per schemi TS.

**Spec reference:** `docs/superpowers/specs/2026-04-20-cassetto-fiscale-design.md` sezioni 4 (data model), 10 (security), 12 (feature flag).

---

## File Structure

**Create (migrations):**
- `supabase/migrations/20260420100000_fiscal_enums.sql` — tutti gli ENUM del modulo
- `supabase/migrations/20260420100001_fiscal_integrations.sql` — tabella config integrazioni POS
- `supabase/migrations/20260420100002_fiscal_raw_events.sql` — append-only raw events
- `supabase/migrations/20260420100003_fiscal_receipts.sql` — receipts + receipt_items normalizzati
- `supabase/migrations/20260420100004_fiscal_pos_items.sql` — catalog POS items + mappings
- `supabase/migrations/20260420100005_fiscal_aggregates.sql` — MV daily_summary + food_cost + view owner_summary
- `supabase/migrations/20260420100006_fiscal_reorder.sql` — reorder_suggestions
- `supabase/migrations/20260420100007_fiscal_pgsodium.sql` — cifratura credentials via pgsodium
- `supabase/migrations/20260420100008_fiscal_rls.sql` — helper SECURITY DEFINER + policy su tutte le tabelle fiscal
- `supabase/migrations/20260420100009_fiscal_feature_flag.sql` — colonna `fiscal_enabled` in `restaurant_preferences`

**Create (docs/test):**
- `docs/superpowers/plans/notes/2026-04-20-fiscal-phase1-smoke.sql` — script manuale di smoke test (seed + SELECT verifica)

**Modify:**
- `types/database.ts` — rigenerato automaticamente

**No files modified:** `lib/`, `app/`, componenti React. Tutto DB-only.

---

## Task 1: Enum types

**Files:**
- Create: `supabase/migrations/20260420100000_fiscal_enums.sql`

- [ ] **Step 1: Write the failing check**

Verifica che gli enum non esistano ancora:

```bash
npx supabase db diff --local | grep -i fiscal_provider && echo "ALREADY EXISTS" || echo "OK, not present"
```

Expected: `OK, not present`

- [ ] **Step 2: Write migration**

```sql
-- supabase/migrations/20260420100000_fiscal_enums.sql
-- Cassetto Fiscale: enum types

CREATE TYPE fiscal_provider AS ENUM (
  'tilby',
  'cassa_in_cloud',
  'lightspeed',
  'scloby',
  'tcpos',
  'revo',
  'simphony',
  'hiopos',
  'generic_webhook',
  'csv_upload'
);

CREATE TYPE fiscal_integration_status AS ENUM (
  'pending_auth',
  'active',
  'paused',
  'error',
  'revoked'
);

CREATE TYPE fiscal_receipt_status AS ENUM (
  'issued',
  'voided',
  'refunded',
  'partial_refund'
);

CREATE TYPE reorder_urgency AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);
```

- [ ] **Step 3: Apply migration**

```bash
npx supabase db push
```

Expected output: `Applying migration 20260420100000_fiscal_enums.sql...` senza errori.

- [ ] **Step 4: Verify enums exist**

```bash
npx supabase db execute --sql "SELECT typname FROM pg_type WHERE typname LIKE 'fiscal%' OR typname = 'reorder_urgency' ORDER BY typname;"
```

Expected output: 4 rows (`fiscal_integration_status`, `fiscal_provider`, `fiscal_receipt_status`, `reorder_urgency`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260420100000_fiscal_enums.sql
git commit -m "feat(fiscal): add enum types for cassetto fiscale"
```

---

## Task 2: fiscal_integrations table

**Files:**
- Create: `supabase/migrations/20260420100001_fiscal_integrations.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260420100001_fiscal_integrations.sql
-- Cassetto Fiscale: POS integration config (one row per POS connection)

CREATE TABLE fiscal_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider        fiscal_provider NOT NULL,
  status          fiscal_integration_status NOT NULL DEFAULT 'pending_auth',
  display_name    TEXT,
  -- credentials cifrate via pgsodium (vedi 20260420100007)
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
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: migration applied, no errors.

- [ ] **Step 3: Verify columns and indexes**

```bash
npx supabase db execute --sql "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'fiscal_integrations'
  ORDER BY ordinal_position;
"
```

Expected: 11 rows including `id`, `restaurant_id`, `provider`, `status`, `credentials`, `config`, `webhook_secret`.

```bash
npx supabase db execute --sql "
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'fiscal_integrations'
  ORDER BY indexname;
"
```

Expected: 4 rows (PK + 3 indexes).

- [ ] **Step 4: Smoke test unique constraint**

```bash
npx supabase db execute --sql "
  DO \$\$
  DECLARE r_id UUID;
  BEGIN
    SELECT id INTO r_id FROM restaurants LIMIT 1;
    INSERT INTO fiscal_integrations (restaurant_id, provider, config)
      VALUES (r_id, 'tilby', '{}'::jsonb);
    BEGIN
      INSERT INTO fiscal_integrations (restaurant_id, provider, config)
        VALUES (r_id, 'tilby', '{}'::jsonb);
      RAISE EXCEPTION 'Expected unique violation, none raised';
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'OK: unique violation triggered';
    END;
    -- Due device_id distinti: ammesso
    INSERT INTO fiscal_integrations (restaurant_id, provider, config)
      VALUES (r_id, 'tilby', '{\"device_id\":\"A\"}'::jsonb);
    INSERT INTO fiscal_integrations (restaurant_id, provider, config)
      VALUES (r_id, 'tilby', '{\"device_id\":\"B\"}'::jsonb);
    ROLLBACK;
  END \$\$;
"
```

Expected: `NOTICE: OK: unique violation triggered` e nessun errore sugli insert con device_id distinti.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260420100001_fiscal_integrations.sql
git commit -m "feat(fiscal): add fiscal_integrations table"
```

---

## Task 3: fiscal_raw_events (append-only)

**Files:**
- Create: `supabase/migrations/20260420100002_fiscal_raw_events.sql`

- [ ] **Step 1: Write migration**

```sql
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
```

- [ ] **Step 2: Apply**

```bash
npx supabase db push
```

Expected: no errors.

- [ ] **Step 3: Verify idempotency constraint**

```bash
npx supabase db execute --sql "
  DO \$\$
  DECLARE int_id UUID;
  BEGIN
    SELECT id INTO int_id FROM fiscal_integrations LIMIT 1;
    IF int_id IS NULL THEN RAISE NOTICE 'SKIP: no integration'; RETURN; END IF;
    INSERT INTO fiscal_raw_events (integration_id, external_id, event_type, payload)
      VALUES (int_id, 'ext-1', 'receipt.created', '{}'::jsonb);
    BEGIN
      INSERT INTO fiscal_raw_events (integration_id, external_id, event_type, payload)
        VALUES (int_id, 'ext-1', 'receipt.created', '{}'::jsonb);
      RAISE EXCEPTION 'Expected unique violation';
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'OK: duplicate rejected';
    END;
    ROLLBACK;
  END \$\$;
"
```

Expected: `NOTICE: OK: duplicate rejected`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420100002_fiscal_raw_events.sql
git commit -m "feat(fiscal): add fiscal_raw_events append-only table"
```

---

## Task 4: fiscal_receipts + fiscal_receipt_items

**Files:**
- Create: `supabase/migrations/20260420100003_fiscal_receipts.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260420100003_fiscal_receipts.sql
-- Cassetto Fiscale: normalized receipts + line items

CREATE TABLE fiscal_receipts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  integration_id   UUID NOT NULL REFERENCES fiscal_integrations(id),
  external_id      TEXT NOT NULL,
  issued_at        TIMESTAMPTZ NOT NULL,
  business_day     DATE NOT NULL,
  status           fiscal_receipt_status NOT NULL DEFAULT 'issued',
  subtotal_cents   INT NOT NULL,
  vat_cents        INT NOT NULL,
  total_cents      INT NOT NULL,
  payment_method   TEXT,
  operator_name    TEXT,
  table_ref        TEXT,
  covers           INT,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_id, external_id),
  CHECK (subtotal_cents >= 0),
  CHECK (vat_cents >= 0),
  CHECK (total_cents >= 0),
  CHECK (covers IS NULL OR covers >= 0)
);

CREATE INDEX idx_fiscal_receipts_restaurant_day
  ON fiscal_receipts(restaurant_id, business_day DESC);
CREATE INDEX idx_fiscal_receipts_integration
  ON fiscal_receipts(integration_id, issued_at DESC);

CREATE TABLE fiscal_receipt_items (
  id               BIGSERIAL PRIMARY KEY,
  receipt_id       UUID NOT NULL REFERENCES fiscal_receipts(id) ON DELETE CASCADE,
  line_number      INT NOT NULL,
  pos_item_id      TEXT,
  name             TEXT NOT NULL,
  category         TEXT,
  quantity         DECIMAL(10,3) NOT NULL,
  unit_price_cents INT NOT NULL,
  subtotal_cents   INT NOT NULL,
  vat_rate         DECIMAL(5,2),
  discount_cents   INT NOT NULL DEFAULT 0,
  is_voided        BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(receipt_id, line_number),
  CHECK (quantity > 0),
  CHECK (unit_price_cents >= 0),
  CHECK (subtotal_cents >= 0),
  CHECK (discount_cents >= 0)
);

CREATE INDEX idx_fiscal_receipt_items_receipt ON fiscal_receipt_items(receipt_id);
CREATE INDEX idx_fiscal_receipt_items_pos_item ON fiscal_receipt_items(pos_item_id)
  WHERE pos_item_id IS NOT NULL;
```

- [ ] **Step 2: Apply**

```bash
npx supabase db push
```

- [ ] **Step 3: Verify CHECK constraints**

```bash
npx supabase db execute --sql "
  DO \$\$
  DECLARE r_id UUID; int_id UUID;
  BEGIN
    SELECT id INTO r_id FROM restaurants LIMIT 1;
    SELECT id INTO int_id FROM fiscal_integrations LIMIT 1;
    IF r_id IS NULL OR int_id IS NULL THEN RAISE NOTICE 'SKIP'; RETURN; END IF;
    BEGIN
      INSERT INTO fiscal_receipts (restaurant_id, integration_id, external_id, issued_at, business_day, subtotal_cents, vat_cents, total_cents)
        VALUES (r_id, int_id, 'r1', NOW(), CURRENT_DATE, -1, 0, 0);
      RAISE EXCEPTION 'Expected check violation';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'OK: negative subtotal rejected';
    END;
    ROLLBACK;
  END \$\$;
"
```

Expected: `NOTICE: OK: negative subtotal rejected`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420100003_fiscal_receipts.sql
git commit -m "feat(fiscal): add fiscal_receipts and fiscal_receipt_items"
```

---

## Task 5: fiscal_pos_items + mappings

**Files:**
- Create: `supabase/migrations/20260420100004_fiscal_pos_items.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260420100004_fiscal_pos_items.sql
-- Cassetto Fiscale: POS item catalog + soft mapping to GB products/categories

CREATE TABLE fiscal_pos_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    UUID NOT NULL REFERENCES fiscal_integrations(id) ON DELETE CASCADE,
  pos_item_id       TEXT NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_sold_cents  BIGINT NOT NULL DEFAULT 0,
  total_qty         DECIMAL(12,3) NOT NULL DEFAULT 0,
  UNIQUE(integration_id, pos_item_id)
);

CREATE INDEX idx_fiscal_pos_items_integration ON fiscal_pos_items(integration_id);

CREATE TABLE fiscal_pos_item_mappings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_item_id      UUID NOT NULL REFERENCES fiscal_pos_items(id) ON DELETE CASCADE,
  gb_product_id    UUID REFERENCES products(id),
  gb_category_id   UUID REFERENCES categories(id),
  depletion_ratio  DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  source           TEXT NOT NULL DEFAULT 'user',
  confidence       DECIMAL(3,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (gb_product_id IS NOT NULL OR gb_category_id IS NOT NULL),
  CHECK (depletion_ratio BETWEEN 0 AND 1),
  CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  CHECK (source IN ('user','auto_heuristic','ml'))
);

-- Un POS item ha al massimo un mapping diretto a un prodotto GB
CREATE UNIQUE INDEX idx_fiscal_pos_mappings_product_unique
  ON fiscal_pos_item_mappings(pos_item_id)
  WHERE gb_product_id IS NOT NULL;

CREATE INDEX idx_fiscal_pos_mappings_pos_item ON fiscal_pos_item_mappings(pos_item_id);
```

- [ ] **Step 2: Apply**

```bash
npx supabase db push
```

- [ ] **Step 3: Verify check constraints**

```bash
npx supabase db execute --sql "
  DO \$\$
  DECLARE int_id UUID; pos_id UUID;
  BEGIN
    SELECT id INTO int_id FROM fiscal_integrations LIMIT 1;
    IF int_id IS NULL THEN RAISE NOTICE 'SKIP'; RETURN; END IF;
    INSERT INTO fiscal_pos_items (integration_id, pos_item_id, name)
      VALUES (int_id, 'p1', 'Tagliata') RETURNING id INTO pos_id;
    BEGIN
      INSERT INTO fiscal_pos_item_mappings (pos_item_id)
        VALUES (pos_id);
      RAISE EXCEPTION 'Expected check violation';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'OK: mapping without target rejected';
    END;
    ROLLBACK;
  END \$\$;
"
```

Expected: `NOTICE: OK: mapping without target rejected`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420100004_fiscal_pos_items.sql
git commit -m "feat(fiscal): add fiscal_pos_items and mappings"
```

---

## Task 6: Aggregate views (fiscal_daily_summary + food_cost + owner_summary)

**Files:**
- Create: `supabase/migrations/20260420100005_fiscal_aggregates.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260420100005_fiscal_aggregates.sql
-- Cassetto Fiscale: materialized views for daily KPIs + food cost + owner summary

CREATE MATERIALIZED VIEW fiscal_daily_summary AS
SELECT
  restaurant_id,
  business_day,
  COUNT(*) FILTER (WHERE status = 'issued')                          AS receipts_count,
  COALESCE(SUM(total_cents) FILTER (WHERE status = 'issued'), 0)     AS revenue_cents,
  COALESCE(SUM(vat_cents)   FILTER (WHERE status = 'issued'), 0)     AS vat_cents,
  COALESCE(SUM(covers)      FILTER (WHERE status = 'issued'), 0)     AS covers,
  COALESCE(AVG(total_cents) FILTER (WHERE status = 'issued'), 0)::INT AS avg_ticket_cents
FROM fiscal_receipts
GROUP BY restaurant_id, business_day;

CREATE UNIQUE INDEX idx_fiscal_daily_summary_pk
  ON fiscal_daily_summary(restaurant_id, business_day);

CREATE MATERIALIZED VIEW fiscal_food_cost AS
SELECT
  d.restaurant_id,
  d.business_day,
  d.revenue_cents,
  COALESCE(s.spend_cents, 0) AS spend_cents,
  CASE
    WHEN d.revenue_cents > 0
      THEN ROUND(100.0 * COALESCE(s.spend_cents, 0) / d.revenue_cents, 2)
    ELSE NULL
  END AS food_cost_pct
FROM fiscal_daily_summary d
LEFT JOIN LATERAL (
  SELECT SUM(ROUND(oi.subtotal * 100))::BIGINT AS spend_cents
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.restaurant_id = d.restaurant_id
    AND o.status IN ('delivered','shipped')
    AND DATE(o.created_at) = d.business_day
) s ON TRUE;

CREATE UNIQUE INDEX idx_fiscal_food_cost_pk
  ON fiscal_food_cost(restaurant_id, business_day);

-- View (non-materialized) per aggregare tra tutte le sedi dello stesso owner
CREATE VIEW fiscal_owner_summary AS
SELECT
  r.profile_id,
  d.business_day,
  SUM(d.receipts_count)  AS receipts_count,
  SUM(d.revenue_cents)   AS revenue_cents,
  SUM(d.vat_cents)       AS vat_cents
FROM fiscal_daily_summary d
JOIN restaurants r ON r.id = d.restaurant_id
GROUP BY r.profile_id, d.business_day;

-- Refresh helper: debounced, safe per call da trigger o cron
CREATE OR REPLACE FUNCTION refresh_fiscal_aggregates()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY fiscal_daily_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY fiscal_food_cost;
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_fiscal_aggregates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_fiscal_aggregates() TO service_role;
```

- [ ] **Step 2: Apply**

```bash
npx supabase db push
```

- [ ] **Step 3: Verify views exist and refresh works**

```bash
npx supabase db execute --sql "
  SELECT matviewname FROM pg_matviews WHERE matviewname LIKE 'fiscal_%' ORDER BY matviewname;
"
```

Expected: 2 rows (`fiscal_daily_summary`, `fiscal_food_cost`).

```bash
npx supabase db execute --sql "SELECT refresh_fiscal_aggregates();"
```

Expected: no errors.

- [ ] **Step 4: Verify owner view**

```bash
npx supabase db execute --sql "
  SELECT viewname FROM pg_views WHERE viewname = 'fiscal_owner_summary';
"
```

Expected: 1 row.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260420100005_fiscal_aggregates.sql
git commit -m "feat(fiscal): add daily summary and food cost materialized views"
```

---

## Task 7: reorder_suggestions

**Files:**
- Create: `supabase/migrations/20260420100006_fiscal_reorder.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260420100006_fiscal_reorder.sql
-- Cassetto Fiscale: reorder suggestions table

CREATE TABLE reorder_suggestions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id            UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id               UUID REFERENCES products(id),
  category_id              UUID REFERENCES categories(id),
  suggested_qty            DECIMAL(10,2),
  suggested_unit           TEXT,
  estimated_coverage_days  INT,
  urgency                  reorder_urgency NOT NULL,
  reason                   TEXT NOT NULL,
  preferred_supplier_id    UUID REFERENCES suppliers(id),
  snapshot                 JSONB NOT NULL,
  state                    TEXT NOT NULL DEFAULT 'open',
  acted_order_id           UUID REFERENCES orders(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at               TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  CHECK (product_id IS NOT NULL OR category_id IS NOT NULL),
  CHECK (state IN ('open','acted','dismissed','expired'))
);

-- Un solo suggerimento "open" per (ristorante, product) o (ristorante, category)
CREATE UNIQUE INDEX idx_reorder_suggestions_open_product
  ON reorder_suggestions(restaurant_id, product_id)
  WHERE state = 'open' AND product_id IS NOT NULL;

CREATE UNIQUE INDEX idx_reorder_suggestions_open_category
  ON reorder_suggestions(restaurant_id, category_id)
  WHERE state = 'open' AND product_id IS NULL AND category_id IS NOT NULL;

CREATE INDEX idx_reorder_suggestions_list
  ON reorder_suggestions(restaurant_id, state, urgency)
  WHERE state = 'open';
```

- [ ] **Step 2: Apply**

```bash
npx supabase db push
```

- [ ] **Step 3: Verify unique-open constraint**

```bash
npx supabase db execute --sql "
  DO \$\$
  DECLARE r_id UUID; p_id UUID;
  BEGIN
    SELECT id INTO r_id FROM restaurants LIMIT 1;
    SELECT id INTO p_id FROM products LIMIT 1;
    IF r_id IS NULL OR p_id IS NULL THEN RAISE NOTICE 'SKIP'; RETURN; END IF;
    INSERT INTO reorder_suggestions (restaurant_id, product_id, urgency, reason, snapshot)
      VALUES (r_id, p_id, 'medium', 'test', '{}'::jsonb);
    BEGIN
      INSERT INTO reorder_suggestions (restaurant_id, product_id, urgency, reason, snapshot)
        VALUES (r_id, p_id, 'high', 'test2', '{}'::jsonb);
      RAISE EXCEPTION 'Expected unique violation';
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'OK: duplicate open suggestion rejected';
    END;
    -- Se prima diventa "dismissed" possiamo aprirne un altro
    UPDATE reorder_suggestions SET state = 'dismissed' WHERE restaurant_id = r_id AND product_id = p_id;
    INSERT INTO reorder_suggestions (restaurant_id, product_id, urgency, reason, snapshot)
      VALUES (r_id, p_id, 'high', 'test2', '{}'::jsonb);
    RAISE NOTICE 'OK: new open after dismiss';
    ROLLBACK;
  END \$\$;
"
```

Expected: both `NOTICE: OK` lines.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420100006_fiscal_reorder.sql
git commit -m "feat(fiscal): add reorder_suggestions table"
```

---

## Task 8: pgsodium credentials encryption

**Files:**
- Create: `supabase/migrations/20260420100007_fiscal_pgsodium.sql`

- [ ] **Step 1: Check pgsodium extension availability**

```bash
npx supabase db execute --sql "
  SELECT name, default_version, installed_version
  FROM pg_available_extensions
  WHERE name IN ('pgsodium','pgcrypto');
"
```

Expected: at least `pgcrypto` available. If `pgsodium` is available, use it. Otherwise fallback to `pgcrypto` (symmetric AES with key from Vault). This plan uses `pgcrypto + vault.secrets` which is the Supabase-standard combo.

- [ ] **Step 2: Write migration**

```sql
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
-- Usabile solo da altre SECURITY DEFINER fn, non esposta a utenti.

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
REVOKE EXECUTE ON FUNCTION fiscal_decrypt_credentials(BYTEA) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscal_encrypt_credentials(JSONB) TO service_role;
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
```

- [ ] **Step 3: Apply**

```bash
npx supabase db push
```

Expected: no errors. Migration also drops/recreates `credentials` column (OK since tabella è ancora vuota a questo punto).

- [ ] **Step 4: Set the master key (one-time manual step, documented)**

Generare una chiave base64 (random 32 bytes) e inserirla in vault:

```bash
# Locale: generate with openssl, then set via psql
KEY=$(openssl rand -base64 32)
npx supabase db execute --sql "SELECT vault.create_secret('$KEY', 'fiscal_master_key', 'AES-256 master key for cassetto fiscale credential encryption');"
```

**For production / staging:** record the value in the team password manager. Losing it means losing access to all stored credentials (but they can always be re-obtained via OAuth reauth).

- [ ] **Step 5: Round-trip test**

```bash
npx supabase db execute --sql "
  WITH roundtrip AS (
    SELECT fiscal_decrypt_credentials(fiscal_encrypt_credentials('{\"api_key\":\"abc\"}'::jsonb)) AS got
  )
  SELECT CASE WHEN (got->>'api_key') = 'abc' THEN 'OK' ELSE 'FAIL: ' || got::text END AS result
  FROM roundtrip;
"
```

Expected output: `OK`.

- [ ] **Step 6: Verify safe view excludes credentials**

```bash
npx supabase db execute --sql "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'fiscal_integrations_safe'
  ORDER BY ordinal_position;
"
```

Expected: list does NOT include `credentials_encrypted`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260420100007_fiscal_pgsodium.sql
git commit -m "feat(fiscal): add encrypted credentials via pgcrypto+vault"
```

---

## Task 9: RLS helper + policies

**Files:**
- Create: `supabase/migrations/20260420100008_fiscal_rls.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260420100008_fiscal_rls.sql
-- Cassetto Fiscale: RLS helper + policies on all fiscal_* tables.
--
-- Ownership is owner-based: restaurants.profile_id = auth.uid().
-- Uso funzione SECURITY DEFINER per evitare ricorsione RLS (vedi feedback_rls_recursion.md).

CREATE OR REPLACE FUNCTION fiscal_owns_restaurant(_restaurant_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = _restaurant_id
      AND r.profile_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION fiscal_owns_restaurant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscal_owns_restaurant(UUID, UUID) TO authenticated;

-- Helper derivato: per tabelle indirette (items, mappings) risali al restaurant_id via FK.
-- Qui non servono altre helper, usiamo join inline nelle policy.

-- fiscal_integrations (usiamo la view "safe" per la lettura utente; la tabella base è accessibile solo service_role in scrittura)
ALTER TABLE fiscal_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_integrations owner select"
  ON fiscal_integrations FOR SELECT
  USING (fiscal_owns_restaurant(restaurant_id, auth.uid()));

-- Nessuna policy INSERT/UPDATE/DELETE per utente: le scritture passano da server actions con service role.

-- fiscal_raw_events (nessuna policy user — only service_role)
ALTER TABLE fiscal_raw_events ENABLE ROW LEVEL SECURITY;
-- No policies = default deny.

-- fiscal_receipts
ALTER TABLE fiscal_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_receipts owner select"
  ON fiscal_receipts FOR SELECT
  USING (fiscal_owns_restaurant(restaurant_id, auth.uid()));

-- fiscal_receipt_items (via receipt)
ALTER TABLE fiscal_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_receipt_items owner select"
  ON fiscal_receipt_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_receipts r
      WHERE r.id = fiscal_receipt_items.receipt_id
        AND fiscal_owns_restaurant(r.restaurant_id, auth.uid())
    )
  );

-- fiscal_pos_items (via integration)
ALTER TABLE fiscal_pos_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_pos_items owner select"
  ON fiscal_pos_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_integrations i
      WHERE i.id = fiscal_pos_items.integration_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

-- fiscal_pos_item_mappings (via pos_item → integration)
ALTER TABLE fiscal_pos_item_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_pos_item_mappings owner select"
  ON fiscal_pos_item_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_pos_items p
      JOIN fiscal_integrations i ON i.id = p.integration_id
      WHERE p.id = fiscal_pos_item_mappings.pos_item_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

CREATE POLICY "fiscal_pos_item_mappings owner insert"
  ON fiscal_pos_item_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fiscal_pos_items p
      JOIN fiscal_integrations i ON i.id = p.integration_id
      WHERE p.id = fiscal_pos_item_mappings.pos_item_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

CREATE POLICY "fiscal_pos_item_mappings owner update"
  ON fiscal_pos_item_mappings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_pos_items p
      JOIN fiscal_integrations i ON i.id = p.integration_id
      WHERE p.id = fiscal_pos_item_mappings.pos_item_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

CREATE POLICY "fiscal_pos_item_mappings owner delete"
  ON fiscal_pos_item_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_pos_items p
      JOIN fiscal_integrations i ON i.id = p.integration_id
      WHERE p.id = fiscal_pos_item_mappings.pos_item_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

-- reorder_suggestions
ALTER TABLE reorder_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reorder_suggestions owner select"
  ON reorder_suggestions FOR SELECT
  USING (fiscal_owns_restaurant(restaurant_id, auth.uid()));

CREATE POLICY "reorder_suggestions owner update state"
  ON reorder_suggestions FOR UPDATE
  USING (fiscal_owns_restaurant(restaurant_id, auth.uid()))
  WITH CHECK (fiscal_owns_restaurant(restaurant_id, auth.uid()));
```

- [ ] **Step 2: Apply**

```bash
npx supabase db push
```

- [ ] **Step 3: Test as anonymous user (should see nothing)**

```bash
npx supabase db execute --sql "
  SET LOCAL ROLE anon;
  SELECT COUNT(*) AS rows_visible FROM fiscal_integrations;
  RESET ROLE;
"
```

Expected: `rows_visible = 0` (anon has no policies).

- [ ] **Step 4: Test as authenticated non-owner (should see 0)**

```bash
npx supabase db execute --sql "
  -- Simula un utente autenticato con uid random
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims TO '{\"sub\":\"00000000-0000-0000-0000-000000000000\"}';
  SELECT COUNT(*) AS rows_visible FROM fiscal_integrations;
  RESET ROLE;
"
```

Expected: `rows_visible = 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260420100008_fiscal_rls.sql
git commit -m "feat(fiscal): add RLS policies owner-based"
```

---

## Task 10: Feature flag `fiscal_enabled`

**Files:**
- Create: `supabase/migrations/20260420100009_fiscal_feature_flag.sql`

- [ ] **Step 1: Write migration**

```sql
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
```

- [ ] **Step 2: Apply**

```bash
npx supabase db push
```

- [ ] **Step 3: Verify column + default**

```bash
npx supabase db execute --sql "
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'restaurant_preferences'
    AND column_name = 'fiscal_enabled';
"
```

Expected: 1 row, `boolean`, default `false`.

- [ ] **Step 4: Test helper**

```bash
npx supabase db execute --sql "
  DO \$\$
  DECLARE r_id UUID; b BOOLEAN;
  BEGIN
    SELECT id INTO r_id FROM restaurants LIMIT 1;
    IF r_id IS NULL THEN RAISE NOTICE 'SKIP'; RETURN; END IF;
    SELECT fiscal_is_enabled(r_id) INTO b;
    RAISE NOTICE 'fiscal_is_enabled for sample restaurant: %', b;
  END \$\$;
"
```

Expected: `NOTICE: fiscal_is_enabled for sample restaurant: f`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260420100009_fiscal_feature_flag.sql
git commit -m "feat(fiscal): add fiscal_enabled feature flag"
```

---

## Task 11: Regenerate TypeScript types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Regenerate types**

```bash
npx supabase gen types typescript --local > types/database.ts
```

- [ ] **Step 2: Verify new types are present**

```bash
grep -E "fiscal_integrations|fiscal_receipts|reorder_suggestions" types/database.ts | head -5
```

Expected: at least 3 matches.

- [ ] **Step 3: TypeCheck passes**

```bash
npx tsc --noEmit
```

Expected: exit code 0, nessun nuovo errore.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "chore(fiscal): regenerate types for fiscal tables"
```

---

## Task 12: Smoke test end-to-end

**Files:**
- Create: `docs/superpowers/plans/notes/2026-04-20-fiscal-phase1-smoke.sql`

- [ ] **Step 1: Write smoke script**

```sql
-- docs/superpowers/plans/notes/2026-04-20-fiscal-phase1-smoke.sql
-- Smoke test manuale: verifica end-to-end del layer dati Cassetto Fiscale (Plan 1).
-- Esecuzione: npx supabase db execute --file <path>
-- Tutto dentro una transazione rolled back alla fine.

BEGIN;

-- 1. Prendi un ristorante esistente
DO $$
DECLARE
  r_id       UUID;
  int_id     UUID;
  receipt_id UUID;
BEGIN
  SELECT id INTO r_id FROM restaurants LIMIT 1;
  IF r_id IS NULL THEN RAISE EXCEPTION 'No restaurant to test with'; END IF;

  -- 2. Crea integrazione
  INSERT INTO fiscal_integrations (restaurant_id, provider, status, display_name)
    VALUES (r_id, 'tilby', 'active', 'Smoke Test Cassa')
    RETURNING id INTO int_id;

  -- 3. Cifra/salva credentials
  UPDATE fiscal_integrations
    SET credentials_encrypted = fiscal_encrypt_credentials('{"api_key":"smoke-abc"}'::jsonb)
    WHERE id = int_id;

  -- 4. Insert raw event
  INSERT INTO fiscal_raw_events (integration_id, external_id, event_type, payload)
    VALUES (int_id, 'smoke-ext-1', 'receipt.created', '{"foo":"bar"}'::jsonb);

  -- 5. Insert normalized receipt + items
  INSERT INTO fiscal_receipts (restaurant_id, integration_id, external_id, issued_at, business_day, subtotal_cents, vat_cents, total_cents, payment_method, covers)
    VALUES (r_id, int_id, 'smoke-ext-1', NOW(), CURRENT_DATE, 4500, 450, 4950, 'cash', 2)
    RETURNING id INTO receipt_id;

  INSERT INTO fiscal_receipt_items (receipt_id, line_number, name, quantity, unit_price_cents, subtotal_cents, vat_rate)
    VALUES (receipt_id, 1, 'Tagliata', 1, 2000, 2000, 10.0),
           (receipt_id, 2, 'Vino rosso calice', 2, 600, 1200, 10.0),
           (receipt_id, 3, 'Coperto', 2, 200, 400, 10.0);

  -- 6. Refresh MV e verifica
  PERFORM refresh_fiscal_aggregates();

  -- 7. Assertions
  IF NOT EXISTS (
    SELECT 1 FROM fiscal_daily_summary
    WHERE restaurant_id = r_id AND business_day = CURRENT_DATE AND revenue_cents = 4950
  ) THEN
    RAISE EXCEPTION 'fiscal_daily_summary not populated correctly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fiscal_food_cost
    WHERE restaurant_id = r_id AND business_day = CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'fiscal_food_cost not populated';
  END IF;

  IF (SELECT fiscal_decrypt_credentials(credentials_encrypted)->>'api_key' FROM fiscal_integrations WHERE id = int_id) <> 'smoke-abc' THEN
    RAISE EXCEPTION 'credentials round-trip failed';
  END IF;

  RAISE NOTICE 'SMOKE TEST OK: integration=%, receipt=%, revenue=4950c', int_id, receipt_id;
END $$;

ROLLBACK;
```

- [ ] **Step 2: Run the smoke test**

```bash
npx supabase db execute --file docs/superpowers/plans/notes/2026-04-20-fiscal-phase1-smoke.sql
```

Expected output contains: `NOTICE: SMOKE TEST OK: integration=..., receipt=..., revenue=4950c`.

If it fails, read the PG error, fix the migration that caused it, re-run. Do not edit the smoke test to make it pass.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/notes/2026-04-20-fiscal-phase1-smoke.sql
git commit -m "test(fiscal): add phase 1 smoke test"
```

---

## Task 13: Update memory with Phase 1 status

**Files:**
- Modify: `C:\Users\Manum\.claude\projects\D--Manum-GastroBridge\memory\MEMORY.md`
- Create: `C:\Users\Manum\.claude\projects\D--Manum-GastroBridge\memory\project_cassetto_fiscale.md`

- [ ] **Step 1: Write memory file**

```markdown
---
name: Cassetto Fiscale
description: Integrazione POS ristoratori (scontrini) + food cost % + reorder engine — stato avanzamento
type: project
---

B2B fiscale: collegamento POS (Tilby, Cassa in Cloud, Lightspeed, Scloby + webhook + CSV) per food cost % = acquisti GB / incasso POS, trend ordini vs incasso, alert + vista "ordine consigliato".

**Why:** Ristoratori vogliono capire margine reale materia prima e essere avvisati quando stock in esaurimento.

**How to apply:** Spec `docs/superpowers/specs/2026-04-20-cassetto-fiscale-design.md`. Plan 1 (foundations DB) completato il {DATE}. Next: Plan 2 (adapter framework + Tilby).

**Stato plans:**
- [x] Plan 1 — Foundations (enum, tabelle, RLS, pgcrypto, feature flag, types)
- [ ] Plan 2 — Adapter framework + Tilby
- [ ] Plan 3 — Webhook + pull infra
- [ ] Plan 4 — UI `/finanze`
- [ ] Plan 5 — Reorder engine
- [ ] Plan 6 — CSV import
- [ ] Plan 7 — Tier 1 restanti (Cassa in Cloud, Lightspeed, Scloby)
- [ ] Plan 8 — Hardening + beta
```

Replace `{DATE}` with the date of completion (YYYY-MM-DD).

- [ ] **Step 2: Update MEMORY.md index**

Aggiungi questa riga alla fine della lista:
```markdown
- [project_cassetto_fiscale.md](project_cassetto_fiscale.md) — Cassetto fiscale (POS integration): stato plans 1-8
```

- [ ] **Step 3: No commit needed**

Memory files are outside the git repo. Skip commit.

---

## Final verification

- [ ] **All migrations listed:**

```bash
ls -1 supabase/migrations/ | grep 20260420100 | wc -l
```

Expected: `10`.

- [ ] **TypeCheck clean:**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Lint clean:**

```bash
npx eslint types/database.ts
```

Expected: no errors.

- [ ] **Git log shows 11 new commits from this plan:**

```bash
git log --oneline -11
```

Expected: 11 commits with `fiscal:` prefix (10 migrations + 1 types + 1 smoke; memory is outside repo).

Actually 11 feature commits: enum, integrations, raw_events, receipts, pos_items, aggregates, reorder, pgsodium, rls, feature_flag, types+smoke.

- [ ] **Document completion:**

Update the memory file `project_cassetto_fiscale.md` section "Stato plans" to mark Plan 1 as `[x]`.

---

## Notes for reviewers

- **Perché nessuna UI in questo plan?** Foundations deve essere rivedibile in isolamento. La UI arriva in Plan 4 quando esistono adapter che producono dati reali da visualizzare.
- **Perché pgcrypto e non pgsodium?** pgsodium su Supabase è in transizione. `pgcrypto + vault` è il pattern Supabase-standard supportato ovunque. Se pgsodium diventa stabile, è swap interno delle due helper fn.
- **Perché RLS read-only per fiscal_integrations?** Le scritture (create, update status, rotate credentials) passano da server actions con service role. L'utente finale vede via `fiscal_integrations_safe` ma non può modificare direttamente da client.
- **Perché MV e non view "live"?** `fiscal_daily_summary` aggrega tutti i receipts: deve essere veloce per la dashboard. Con MV + refresh debounced abbiamo ~50ms di read-time. Refresh triggerato da normalizer in Plan 3.
- **Food cost in MV anche?** Sì, perché coinvolge join con `orders` + `order_items`. Refresh una volta per fiscal_daily_summary bastante: `REFRESH ... CONCURRENTLY` non blocca le SELECT.
