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
