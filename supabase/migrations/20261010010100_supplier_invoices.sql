-- Fatture fornitori (FatturaPA / SDI): ingestion, 3-way reconciliation,
-- disputes, payment due dates, purchase price history and the SDI
-- intermediary connection. Spec: docs/superpowers/specs/2026-10-10-fatture-fornitori-food-cost.md
--
-- Purely ADDITIVE: CREATE … IF NOT EXISTS, CREATE OR REPLACE FUNCTION and
-- policies created in DO blocks guarded by pg_policies. No DROP statements.
--
-- Storage choice: the raw FatturaPA XML is kept in a table
-- (supplier_invoice_files.xml) instead of a Storage bucket. Invoices are small
-- text documents (5–100 KB once the embedded PDF <Attachment> payloads are
-- stripped by the app), they must be re-parsed when the parser improves, and a
-- table row is covered by the very same RLS as the parsed data — no second
-- policy surface, no orphaned objects. The signed .p7m envelope is not kept:
-- legal storage ("conservazione sostitutiva") stays with the SDI intermediary
-- / the accountant; GastroBridge is a control tool, not an archive.
--
-- Access: owner (restaurants.profile_id) and active team members through
-- private.is_restaurant_owner / private.has_restaurant_permission:
--   read   → analytics.financial  (owner, manager, viewer)
--   write  → settings.manage      (owner, manager)
-- Webhook / cron processing uses the service role (bypasses RLS).

-- --------------------------------------------------------------
-- 0. Helper
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.fin_can(_restaurant_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_restaurant_owner(_restaurant_id)
      OR private.has_restaurant_permission(_restaurant_id, _permission);
$$;
REVOKE ALL ON FUNCTION private.fin_can(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fin_can(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION private.fin_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.fin_touch_updated_at() FROM PUBLIC;

-- --------------------------------------------------------------
-- 1. Raw files (one row per FatturaPA XML document)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_invoice_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  file_name      text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 300),
  source         text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'sdi', 'provider_sync')),
  provider       text NULL CHECK (provider IS NULL OR char_length(provider) <= 40),
  external_id    text NULL CHECK (external_id IS NULL OR char_length(external_id) <= 200),
  source_kind    text NOT NULL DEFAULT 'xml' CHECK (source_kind IN ('xml', 'p7m', 'p7m_base64', 'json')),
  sha256         text NOT NULL CHECK (char_length(sha256) = 64),
  xml            text NOT NULL,
  size_bytes     integer NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  uploaded_by    uuid NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_invoice_files_unique_hash UNIQUE (restaurant_id, sha256)
);
CREATE INDEX IF NOT EXISTS idx_sif_restaurant_created ON public.supplier_invoice_files (restaurant_id, created_at DESC);

-- --------------------------------------------------------------
-- 2. Invoices (one row per FatturaElettronicaBody)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  file_id            uuid NOT NULL REFERENCES public.supplier_invoice_files(id) ON DELETE CASCADE,
  body_index         integer NOT NULL DEFAULT 0 CHECK (body_index >= 0),
  supplier_vat       text NULL CHECK (supplier_vat IS NULL OR char_length(supplier_vat) <= 30),
  supplier_tax_code  text NULL CHECK (supplier_tax_code IS NULL OR char_length(supplier_tax_code) <= 30),
  supplier_name      text NULL CHECK (supplier_name IS NULL OR char_length(supplier_name) <= 300),
  supplier_id        uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  catalog_id         uuid NULL REFERENCES public.restaurant_catalogs(id) ON DELETE SET NULL,
  relationship_id    uuid NULL REFERENCES public.restaurant_suppliers(id) ON DELETE SET NULL,
  buyer_vat          text NULL CHECK (buyer_vat IS NULL OR char_length(buyer_vat) <= 30),
  buyer_name         text NULL CHECK (buyer_name IS NULL OR char_length(buyer_name) <= 300),
  document_type      text NOT NULL CHECK (char_length(document_type) <= 8),
  document_number    text NOT NULL CHECK (char_length(document_number) <= 60),
  document_date      date NULL,
  currency           text NOT NULL DEFAULT 'EUR' CHECK (char_length(currency) <= 3),
  taxable_amount     numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount         numeric(14,2) NOT NULL DEFAULT 0,
  total_amount       numeric(14,2) NOT NULL DEFAULT 0,
  -- Parsed header data shown in the UI (DDT, causale, riepilogo IVA, linked
  -- invoices, transmission, warnings). Lines/payments live in their tables.
  parsed             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status             text NOT NULL DEFAULT 'da_verificare'
                     CHECK (status IN ('da_verificare', 'ok', 'anomalie', 'contestata', 'risolta')),
  match_method       text NULL CHECK (match_method IS NULL OR match_method IN ('ddt', 'date_window', 'price_list', 'none', 'manual')),
  match_confidence   numeric(5,4) NULL,
  matched_order_ids  uuid[] NOT NULL DEFAULT '{}'::uuid[],
  -- € figures in cents, maintained by the app on every (re)reconciliation.
  found_cents        bigint NOT NULL DEFAULT 0 CHECK (found_cents >= 0),
  open_cents         bigint NOT NULL DEFAULT 0 CHECK (open_cents >= 0),
  disputed_cents     bigint NOT NULL DEFAULT 0 CHECK (disputed_cents >= 0),
  recovered_cents    bigint NOT NULL DEFAULT 0 CHECK (recovered_cents >= 0),
  findings_count     integer NOT NULL DEFAULT 0 CHECK (findings_count >= 0),
  credit_note_for    uuid NULL REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  duplicate_of       uuid NULL REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  sdi_identifier     text NULL CHECK (sdi_identifier IS NULL OR char_length(sdi_identifier) <= 200),
  received_via       text NOT NULL DEFAULT 'upload' CHECK (received_via IN ('upload', 'sdi', 'provider_sync')),
  disputed_at        timestamptz NULL,
  resolved_at        timestamptz NULL,
  reviewed_at        timestamptz NULL,
  reviewed_by        uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_invoices_file_body UNIQUE (file_id, body_index)
);
CREATE INDEX IF NOT EXISTS idx_si_restaurant_date   ON public.supplier_invoices (restaurant_id, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_si_restaurant_status ON public.supplier_invoices (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_si_restaurant_vat    ON public.supplier_invoices (restaurant_id, supplier_vat);
CREATE INDEX IF NOT EXISTS idx_si_restaurant_created ON public.supplier_invoices (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_si_credit_note_for   ON public.supplier_invoices (credit_note_for) WHERE credit_note_for IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_si_sdi_identifier
  ON public.supplier_invoices (restaurant_id, sdi_identifier, body_index) WHERE sdi_identifier IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_supplier_invoices_touch') THEN
    CREATE TRIGGER trg_supplier_invoices_touch
      BEFORE UPDATE ON public.supplier_invoices
      FOR EACH ROW EXECUTE FUNCTION private.fin_touch_updated_at();
  END IF;
END $$;

-- --------------------------------------------------------------
-- 3. Lines with their reconciliation result
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id           uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  restaurant_id        uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  line_number          integer NOT NULL,
  kind                 text NOT NULL DEFAULT 'goods'
                       CHECK (kind IN ('goods', 'discount', 'premium', 'allowance', 'accessory', 'note')),
  description          text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  item_codes           jsonb NOT NULL DEFAULT '[]'::jsonb,
  quantity             numeric(16,4) NULL,
  unit                 text NULL CHECK (unit IS NULL OR char_length(unit) <= 20),
  unit_price           numeric(18,6) NOT NULL DEFAULT 0,
  total_price          numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate             numeric(5,2) NOT NULL DEFAULT 0,
  natura               text NULL CHECK (natura IS NULL OR char_length(natura) <= 10),
  discounts            jsonb NOT NULL DEFAULT '[]'::jsonb,
  ddt_number           text NULL CHECK (ddt_number IS NULL OR char_length(ddt_number) <= 60),
  ddt_date             date NULL,
  order_id             uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  order_line_ref       text NULL CHECK (order_line_ref IS NULL OR char_length(order_line_ref) <= 120),
  product_id           uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  price_key            text NULL CHECK (price_key IS NULL OR char_length(price_key) <= 300),
  match_score          numeric(6,4) NULL,
  agreed_unit_price    numeric(18,6) NULL,
  agreed_source        text NULL CHECK (agreed_source IS NULL OR agreed_source IN ('order', 'catalog', 'listino')),
  effective_unit_price numeric(18,6) NULL,
  ordered_qty          numeric(16,4) NULL,
  received_qty         numeric(16,4) NULL,
  quantity_source      text NULL CHECK (quantity_source IS NULL OR quantity_source IN ('received', 'ordered')),
  dimension            text NULL CHECK (dimension IS NULL OR dimension IN ('pack', 'kg', 'l', 'pz')),
  note                 text NULL CHECK (note IS NULL OR char_length(note) <= 300),
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sil_invoice ON public.supplier_invoice_lines (invoice_id, line_number);
CREATE INDEX IF NOT EXISTS idx_sil_restaurant_order ON public.supplier_invoice_lines (restaurant_id, order_line_ref) WHERE order_line_ref IS NOT NULL;

-- --------------------------------------------------------------
-- 4. Findings (anomalies) with severity and € impact
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_invoice_findings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  line_number    integer NULL,
  kind           text NOT NULL CHECK (kind IN (
                   'price_above_agreed', 'qty_above_received', 'qty_above_ordered', 'not_ordered',
                   'duplicate_invoice', 'possible_duplicate', 'vat_anomaly', 'total_mismatch',
                   'missing_credit_note', 'no_order_found', 'unknown_supplier')),
  severity       text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  impact_cents   bigint NOT NULL DEFAULT 0 CHECK (impact_cents >= 0),
  recoverable    boolean NOT NULL DEFAULT false,
  title          text NOT NULL CHECK (char_length(title) <= 300),
  message        text NOT NULL CHECK (char_length(message) <= 1000),
  details        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'disputed', 'resolved', 'dismissed')),
  dispute_id     uuid NULL,
  resolved_at    timestamptz NULL,
  resolved_by    uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sifind_invoice ON public.supplier_invoice_findings (invoice_id);
CREATE INDEX IF NOT EXISTS idx_sifind_restaurant_open ON public.supplier_invoice_findings (restaurant_id, status);

-- --------------------------------------------------------------
-- 5. Payment due dates (scadenze)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_invoice_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  installment    integer NOT NULL DEFAULT 1,
  due_date       date NULL,
  amount         numeric(14,2) NULL,
  method         text NULL CHECK (method IS NULL OR char_length(method) <= 10),
  iban           text NULL CHECK (iban IS NULL OR char_length(iban) <= 40),
  paid_at        timestamptz NULL,
  paid_by        uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sipay_restaurant_due ON public.supplier_invoice_payments (restaurant_id, due_date) WHERE paid_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sipay_invoice ON public.supplier_invoice_payments (invoice_id);

-- --------------------------------------------------------------
-- 6. Disputes (contestazioni) and their resolution
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_invoice_disputes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  restaurant_id    uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  message          text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  channel          text NOT NULL CHECK (channel IN ('chat', 'email', 'copy')),
  relationship_id  uuid NULL REFERENCES public.restaurant_suppliers(id) ON DELETE SET NULL,
  requested_cents  bigint NOT NULL DEFAULT 0 CHECK (requested_cents >= 0),
  finding_ids      uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_by       uuid NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  credit_note_id   uuid NULL REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  recovered_cents  bigint NOT NULL DEFAULT 0 CHECK (recovered_cents >= 0),
  resolution       text NULL CHECK (resolution IS NULL OR resolution IN ('credit_note', 'manual', 'waived')),
  resolved_at      timestamptz NULL
);
CREATE INDEX IF NOT EXISTS idx_sidisp_invoice ON public.supplier_invoice_disputes (invoice_id);
CREATE INDEX IF NOT EXISTS idx_sidisp_restaurant_open ON public.supplier_invoice_disputes (restaurant_id) WHERE resolved_at IS NULL;

-- --------------------------------------------------------------
-- 7. Purchase price history (every goods line of every invoice)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_price_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  -- p:<product_id> | c:<catalog_id>:<name key> | i:<supplier vat>:<name key>
  price_key        text NOT NULL CHECK (char_length(price_key) <= 300),
  product_id       uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  catalog_id       uuid NULL REFERENCES public.restaurant_catalogs(id) ON DELETE SET NULL,
  supplier_vat     text NULL,
  supplier_id      uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name    text NULL,
  description      text NOT NULL CHECK (char_length(description) <= 1000),
  unit             text NULL,
  quantity         numeric(16,4) NULL,
  unit_price       numeric(18,6) NOT NULL,
  price_kg         numeric(18,6) NULL,
  price_l          numeric(18,6) NULL,
  price_pz         numeric(18,6) NULL,
  invoice_id       uuid NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  invoice_line_id  uuid NULL REFERENCES public.supplier_invoice_lines(id) ON DELETE CASCADE,
  document_date    date NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pph_restaurant_key_date ON public.purchase_price_history (restaurant_id, price_key, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_pph_restaurant_date ON public.purchase_price_history (restaurant_id, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_pph_invoice ON public.purchase_price_history (invoice_id);

-- --------------------------------------------------------------
-- 8. P.IVA → supplier / catalog links (auto or confirmed by the user)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_supplier_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_vat   text NOT NULL CHECK (char_length(supplier_vat) BETWEEN 1 AND 30),
  supplier_id    uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  catalog_id     uuid NULL REFERENCES public.restaurant_catalogs(id) ON DELETE SET NULL,
  source         text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'user')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_supplier_links_unique UNIQUE (restaurant_id, supplier_vat)
);

-- --------------------------------------------------------------
-- 9. SDI intermediary connection (one per restaurant)
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdi_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider            text NOT NULL CHECK (char_length(provider) <= 40),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'error', 'disabled')),
  fiscal_id           text NOT NULL CHECK (char_length(fiscal_id) BETWEEN 1 AND 30),
  company_name        text NULL CHECK (company_name IS NULL OR char_length(company_name) <= 300),
  recipient_code      text NULL CHECK (recipient_code IS NULL OR char_length(recipient_code) <= 7),
  provider_ref        text NULL CHECK (provider_ref IS NULL OR char_length(provider_ref) <= 200),
  webhook_configured  boolean NOT NULL DEFAULT false,
  registered_at       timestamptz NULL,
  portal_confirmed_at timestamptz NULL,
  last_invoice_at     timestamptz NULL,
  last_sync_at        timestamptz NULL,
  last_error          text NULL CHECK (last_error IS NULL OR char_length(last_error) <= 1000),
  created_by          uuid NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sdi_connections_restaurant_unique UNIQUE (restaurant_id)
);
CREATE INDEX IF NOT EXISTS idx_sdi_connections_fiscal ON public.sdi_connections (fiscal_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sdi_connections_touch') THEN
    CREATE TRIGGER trg_sdi_connections_touch
      BEFORE UPDATE ON public.sdi_connections
      FOR EACH ROW EXECUTE FUNCTION private.fin_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoice_supplier_links_touch') THEN
    CREATE TRIGGER trg_invoice_supplier_links_touch
      BEFORE UPDATE ON public.invoice_supplier_links
      FOR EACH ROW EXECUTE FUNCTION private.fin_touch_updated_at();
  END IF;
END $$;

-- --------------------------------------------------------------
-- 10. Inbound webhook events (idempotency + async-safe processing).
--     Service role only: RLS enabled, no policies.
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdi_inbound_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       text NOT NULL CHECK (char_length(provider) <= 40),
  event          text NOT NULL CHECK (char_length(event) <= 60),
  external_id    text NOT NULL CHECK (char_length(external_id) <= 200),
  restaurant_id  uuid NULL REFERENCES public.restaurants(id) ON DELETE SET NULL,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'error')),
  error          text NULL CHECK (error IS NULL OR char_length(error) <= 2000),
  attempts       integer NOT NULL DEFAULT 0,
  received_at    timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz NULL,
  CONSTRAINT sdi_inbound_events_unique UNIQUE (provider, event, external_id)
);
CREATE INDEX IF NOT EXISTS idx_sdi_inbound_pending ON public.sdi_inbound_events (status, received_at) WHERE status IN ('received', 'error');

-- --------------------------------------------------------------
-- 11. Notification de-duplication (digests, immediate alerts).
--     Service role only.
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_notification_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (char_length(kind) <= 40),
  ref            text NOT NULL CHECK (char_length(ref) <= 200),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_notification_log_unique UNIQUE (restaurant_id, kind, ref)
);

-- --------------------------------------------------------------
-- 12. RLS
-- --------------------------------------------------------------
ALTER TABLE public.supplier_invoice_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_price_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_supplier_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdi_connections           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdi_inbound_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_notification_log  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  -- Tables keyed directly by restaurant_id.
  direct text[] := ARRAY[
    'supplier_invoice_files', 'supplier_invoices', 'purchase_price_history',
    'invoice_supplier_links', 'sdi_connections'
  ];
  -- Child tables: restaurant_id must match the parent invoice.
  child text[] := ARRAY[
    'supplier_invoice_lines', 'supplier_invoice_findings',
    'supplier_invoice_payments', 'supplier_invoice_disputes'
  ];
BEGIN
  FOREACH t IN ARRAY direct || child LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || ' finance read') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (private.fin_can(restaurant_id, %L))',
        t || ' finance read', t, 'analytics.financial');
    END IF;
  END LOOP;

  FOREACH t IN ARRAY direct LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || ' finance write') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (private.fin_can(restaurant_id, %L)) WITH CHECK (private.fin_can(restaurant_id, %L))',
        t || ' finance write', t, 'settings.manage', 'settings.manage');
    END IF;
  END LOOP;

  FOREACH t IN ARRAY child LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || ' finance write') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (private.fin_can(restaurant_id, %L)) '
        'WITH CHECK (private.fin_can(restaurant_id, %L) AND EXISTS ('
        'SELECT 1 FROM public.supplier_invoices si WHERE si.id = invoice_id AND si.restaurant_id = %I.restaurant_id))',
        t || ' finance write', t, 'settings.manage', 'settings.manage', t);
    END IF;
  END LOOP;
END $$;

-- supplier_invoices: the file must belong to the same restaurant.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplier_invoices'
                 AND policyname = 'supplier_invoices same restaurant file') THEN
    CREATE POLICY "supplier_invoices same restaurant file" ON public.supplier_invoices
      AS RESTRICTIVE FOR INSERT
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.supplier_invoice_files f
        WHERE f.id = file_id AND f.restaurant_id = supplier_invoices.restaurant_id
      ));
  END IF;
END $$;
